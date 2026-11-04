import { describe, expect, it } from "vitest";
import { SQUADS } from "@chessroyale/core";
import { START_FEN, legalMoves } from "../src/index.ts";
import {
  NO_INPUTS,
  createSquadsMatch,
  halfDuties,
  movesSinceLastPlayed,
  resolveHalf,
  seatBoard,
  upgradeMatch,
  type Lineup,
  type Side,
  type SquadsMatch,
} from "../src/squads/index.ts";

/**
 * Move replay (Eric, Nov 5; docs/decisions/2026-11-05-move-replay.md): coming back to a board, the moves played there
 * since you last played it replay, and the move's free seconds grow by SQUADS.replaySecondsPerMove (0.5 s) for each,
 * whether the replay is shown or not (the rule never hears of the replay button: the clock is the server's).
 */

const sides: [Lineup, Lineup] = [
  { squadId: 0, seats: ["a0", "a1", "a2", "a3"] },
  { squadId: 1, seats: ["b0", "b1", "b2", "b3"] },
];
const DELAY = 2_000;
const CAP = 15_000;
const PER = SQUADS.replaySecondsPerMove * 1000;

function match(format: "relay" | "pairs", bank = 10_000_000): SquadsMatch {
  const n = format === "relay" ? 4 : 2;
  return createSquadsMatch({
    key: "r0m0",
    seed: 5,
    round: format === "relay" ? 0 : 1,
    format,
    sides,
    starts: Array.from({ length: n }, () => ({ fen: START_FEN, openingId: null })),
    whites: Array.from({ length: n }, (_, k) => (k % 2) as Side),
    banksMs: [bank, bank],
    delayMs: DELAY,
    incrementMs: 0,
    capMs: CAP,
  });
}

/** Plays `halves` halves (everyone misses: random moves), so the match stands where a later turn begins. */
function playOn(m: SquadsMatch, halves: number): SquadsMatch {
  for (let i = 0; i < halves; i++) m = resolveHalf(m, NO_INPUTS).match;
  return m;
}

describe("Move replay: the free time grows by 0.5 s a move played since you last played that board", () => {
  it("is 0.5 s a move in settings (one number)", () => {
    expect(SQUADS.replaySecondsPerMove).toBe(0.5);
    expect(match("relay").replayMsPerMove).toBe(500);
  });

  it("Relay: nothing on turn 1 (your first board), then every move since you last played it: 7 once the rotation is round", () => {
    // Seat 0 plays boards 1, 2, 3, 4, 1... (White on 1 and 3, Black on 2 and 4).
    expect([0, 1, 2, 3, 4, 5].map((t) => seatBoard("relay", 4, 0, t))).toEqual([0, 1, 2, 3, 0, 1]);
    // Turn 1 (t = 0): the board you start on, nothing missed.
    expect(movesSinceLastPlayed("relay", 4, 0, 0, 0, false, 0)).toBe(0);
    // A board you've never played: every move on it so far (t = 1, Black: White's moves of turns 1 and 2 and Black's of turn 1).
    expect(movesSinceLastPlayed("relay", 4, 0, 1, 1, true, 3)).toBe(3);
    // Back on your first board at t = 4 (White): Black's reply to you, then three turns of both moves = 7.
    expect(movesSinceLastPlayed("relay", 4, 0, 0, 4, false, 8)).toBe(7);
    // Black on a board you come back to: 7 too.
    expect(movesSinceLastPlayed("relay", 4, 0, 1, 5, true, 11)).toBe(7);
    // Not your board this turn, or never changing boards (the final): 0.
    expect(movesSinceLastPlayed("relay", 4, 0, 2, 4, false, 8)).toBe(0);
    expect(movesSinceLastPlayed("final", 1, 0, 0, 4, false, 8)).toBe(0);
  });

  it("Pairs: staying on your board adds nothing; away one turn and back, 3 moves (+1.5 s)", () => {
    // Player 1 (seat 0) changes slots every turn; player 2 (seat 1) stays some turns.
    expect([0, 1, 2, 3, 4, 5].map((t) => seatBoard("pairs", 2, 0, t))).toEqual([0, 1, 0, 1, 0, 1]);
    expect([0, 1, 2, 3, 4, 5].map((t) => seatBoard("pairs", 2, 1, t))).toEqual([0, 0, 1, 1, 1, 0]);
    // Player 1 back on board 1 at t = 2 (White), last there at t = 0: their opponent's reply, then t = 1's two moves.
    expect(movesSinceLastPlayed("pairs", 2, 0, 0, 2, false, 4)).toBe(3);
    // Player 2 stays on board 1 from t = 0 to t = 1: nothing to replay (they watched it).
    expect(movesSinceLastPlayed("pairs", 2, 1, 0, 1, false, 2)).toBe(0);
    // Player 2 back on board 1 at t = 5 after t = 1: 2 · (5 − 1) − 1 = 7.
    expect(movesSinceLastPlayed("pairs", 2, 1, 0, 5, false, 10)).toBe(7);
  });

  it("each duty's free time: the free seconds + 0.5 s for each move missed; the cap stays the cap", () => {
    let m = match("relay");
    expect(halfDuties(m).duties.map((d) => d.freeMs)).toEqual([DELAY, DELAY, DELAY, DELAY]);
    m = playOn(m, 8); // turn 5 (t = 4), White's half
    expect(m.turn).toBe(4);
    for (const d of halfDuties(m).duties) {
      expect(d.replay).toEqual([7]);
      expect(d.freeMs).toBe(DELAY + 7 * PER); // 2 s + 3.5 s
      expect(d.deadlineMs).toBe(CAP);
    }
  });

  it("the bank drains past the larger free time: a move made 1 s after it costs 1 s, coming back or not", () => {
    const m = playOn(match("relay"), 8);
    const duties = halfDuties(m).duties.filter((d) => d.side === 0);
    expect(duties).toHaveLength(2);
    const think = Object.fromEntries(duties.map((d) => [d.players[0]!, d.freeMs + 1_000]));
    // Both movers move 1 s past their free time (3.5 s more than the free seconds): 1 s each = 2 s off the bank.
    const inputs = {
      ...NO_INPUTS,
      choices: Object.fromEntries(duties.map((d) => [d.players[0]!, legalMoves(m.boards[d.board]!.fen)[0]!])),
      locked: Object.fromEntries(duties.map((d) => [d.players[0]!, true])),
    };
    const after = resolveHalf(m, inputs, think).match;
    expect(m.banks[0] - after.banks[0]).toBe(2_000);
  });

  it("a pair shares one move's time: its free time is the larger of the two partners' (one coming back, one staying)", () => {
    const m = playOn(match("pairs"), 4); // t = 2
    const d = halfDuties(m).duties.find((x) => x.side === 0)!;
    expect(d.replay.length).toBe(2);
    expect(d.freeMs).toBe(DELAY + Math.max(...d.replay) * PER);
    expect(Math.max(...d.replay)).toBeGreaterThan(0);
  });

  it("in sudden death a move's deadline is its free time, the replay's extra included", () => {
    const m = playOn(match("relay"), 8);
    const sd = { ...m, banks: [0, m.banks[1]] as [number, number] };
    for (const d of halfDuties(sd).duties.filter((x) => x.side === 0)) expect(d.deadlineMs).toBe(DELAY + 7 * PER);
  });

  it("a match stored before move replay keeps its clock: no extra free time", () => {
    const m = playOn(match("relay"), 8);
    const { replayMsPerMove: _gone, ...old } = m;
    const up = upgradeMatch(old as SquadsMatch);
    expect(up.replayMsPerMove).toBe(0);
    for (const d of halfDuties(up).duties) expect(d.freeMs).toBe(DELAY);
  });
});
