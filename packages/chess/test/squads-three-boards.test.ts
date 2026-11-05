import { describe, expect, it } from "vitest";
import { SQUADS } from "@chessroyale/core";
import { START_FEN } from "../src/index.ts";
import {
  NO_INPUTS,
  blackDraws,
  createSquadsMatch,
  endByMaterial,
  halfDuties,
  matchResultOf,
  movesSinceLastPlayed,
  newSquadsBoard,
  relayBoardOf,
  relayMovesOf,
  relayRing,
  relaySeat,
  resolveHalf,
  roundScale,
  upgradeMatch,
  type Lineup,
  type Side,
  type SquadsBoard,
  type SquadsMatch,
} from "../src/squads/index.ts";

/**
 * Relay on 3 boards (Eric, Nov 5; docs/decisions/2026-11-05-squads-three-boards.md): squads stay 4 players, so each squad
 * has one more player than boards. The ring: a squad's moves in the order they're played, move k seat k mod 4's.
 */

const sides: [Lineup, Lineup] = [
  { squadId: 0, seats: ["a0", "a1", "a2", "a3"] },
  { squadId: 1, seats: ["b0", "b1", "b2", "b3"] },
];

function relay(boards = 3, bank = 10_000_000): SquadsMatch {
  return createSquadsMatch({
    key: "r0m0",
    seed: 7,
    round: 0,
    format: "relay",
    sides,
    starts: Array.from({ length: boards }, () => ({ fen: START_FEN, openingId: null })),
    whites: Array.from({ length: boards }, (_, k) => (k % 2) as Side),
    banksMs: [bank, bank],
    delayMs: 2_000,
    incrementMs: 0,
    capMs: 15_000,
  });
}

/** A squad's moves in order: [turn, half, board, seat] for `turns` turns, from the match's own duties. */
function squadMoves(side: Side, turns: number, boards = 3): [number, "w" | "b", number, number][] {
  let m = relay(boards);
  const out: [number, "w" | "b", number, number][] = [];
  while (m.turn < turns && !m.result) {
    const mine = halfDuties(m).duties.filter((d) => d.side === side);
    // (Within a half, in the ring's order.)
    const ring = relayRing(boards, side);
    mine.sort((a, b) => ring.indexOf(a.board) - ring.indexOf(b.board));
    for (const d of mine) out.push([m.turn, m.half, d.board, sides[side].seats.indexOf(d.players[0]!)]);
    m = resolveHalf(m, NO_INPUTS).match;
  }
  return out;
}

const done = (b: SquadsBoard, winner: "w" | "b" | null): SquadsBoard => ({ ...b, result: { winner, reason: winner ? "checkmate" : "stalemate" } });

describe("Relay on 3 boards: the ring", () => {
  it("is 3 boards a match, squads of 4", () => {
    expect(SQUADS.boards.relay).toBe(3);
    expect(SQUADS.squadSize).toBe(4);
  });

  it("orders a squad's moves in a turn by when they're played, one board along: side 0 boards 3, 1 (White), 2 (Black); side 1 board 2, then 3, 1", () => {
    expect(relayRing(3, 0)).toEqual([2, 0, 1]);
    expect(relayRing(3, 1)).toEqual([1, 2, 0]);
  });

  it("every squad move has exactly one mover, the next player in the ring, every place fixed", () => {
    for (const side of [0, 1] as const) {
      const moves = squadMoves(side, 12);
      expect(moves).toHaveLength(36);
      // Move k is seat k mod 4's: the same order, round and round.
      expect(moves.map((x) => x[3])).toEqual(moves.map((_, k) => k % 4));
      // Each half, every board has one of each squad's players (a board's side to move: one mover).
      let m = relay();
      for (let h = 0; h < 12; h++) {
        const d = halfDuties(m).duties;
        expect(d.map((x) => x.board).sort()).toEqual([0, 1, 2]);
        expect(d.every((x) => x.players.length === 1)).toBe(true);
        m = resolveHalf(m, NO_INPUTS).match;
      }
    }
  });

  it("three sit at the boards at the start and the fourth waits, then takes the first board that becomes free", () => {
    for (const side of [0, 1] as const) {
      // Turn 1: seats 1-3 have a board each, seat 4 none.
      expect([0, 1, 2, 3].map((seat) => relayBoardOf(seat, 0, 3, side))).toEqual([...relayRing(3, side), null]);
      // Its first move: turn 2, on the board its squad moved on first (free once that move is made).
      expect(relayMovesOf(3, 0, 1, 3, side)).toEqual([{ turn: 1, board: relayRing(3, side)[0] }]);
      // Then one seat of each squad sits out each turn, in turn: 4, 3, 2, 1, 4...
      const waiting = (t: number) => [0, 1, 2, 3].filter((seat) => relayBoardOf(seat, t, 3, side) === null);
      expect([0, 1, 2, 3, 4].map(waiting)).toEqual([[3], [2], [1], [0], [3]]);
    }
  });

  it("after you move you go one board along, to the next board needing your squad's move", () => {
    for (const side of [0, 1] as const) {
      for (let seat = 0; seat < 4; seat++) {
        const mine = relayMovesOf(seat, 0, 9, 3, side);
        for (let i = 1; i < mine.length; i++) expect(mine[i]!.board).toBe((mine[i - 1]!.board + 1) % 3);
        // relaySeat is relayBoardOf's inverse.
        for (const x of mine) expect(relaySeat(3, x.board, x.turn, 4, side)).toBe(seat);
      }
    }
  });

  it("colors: every player of a squad has the same split, its squad's (side 0: 2 White to 1 Black), never 3 of a color running", () => {
    for (const side of [0, 1] as const) {
      const moves = squadMoves(side, 12);
      for (let seat = 0; seat < 4; seat++) {
        const colors = moves.filter((x) => x[3] === seat).map((x) => x[1]);
        expect(colors).toHaveLength(9);
        const whites = colors.filter((c) => c === "w").length;
        expect(whites).toBe(side === 0 ? 6 : 3);
        expect(colors.join("")).not.toMatch(/www|bbb/);
        // Each board once every three of your moves (3 boards, one along each time).
        const boards = moves.filter((x) => x[3] === seat).map((x) => x[2]);
        for (let i = 3; i < boards.length; i++) expect(boards[i]).toBe(boards[i - 3]);
      }
    }
  });

  it("move replay's free time: back on a board once round, the 7 moves since (as on 4 boards); a board never played, all of its moves", () => {
    // Side 0, seat 0: board 3 at turn 1 (White), board 1 at turn 2 (White), board 2 at turn 3 (Black), board 3 at turn 5.
    expect(relayMovesOf(0, 0, 4, 3, 0)).toEqual([
      { turn: 0, board: 2 },
      { turn: 1, board: 0 },
      { turn: 2, board: 1 },
      { turn: 4, board: 2 },
    ]);
    expect(movesSinceLastPlayed("relay", 3, 0, 2, 4, false, 8, 0)).toBe(7);
    // Board 1 at turn 2, never played there: every move on it (turns 1 and 2's, then turn 3's White move).
    expect(movesSinceLastPlayed("relay", 3, 0, 0, 1, false, 2, 0)).toBe(2);
    // The waiting player's first board: every move on it so far.
    expect(movesSinceLastPlayed("relay", 3, 3, 2, 1, false, 2, 0)).toBe(2);
    // The match's duties carry it.
    let m = relay();
    for (let h = 0; h < 8; h++) m = resolveHalf(m, NO_INPUTS).match;
    const d = halfDuties(m).duties.find((x) => x.side === 0 && x.board === 2)!;
    expect(d.players).toEqual(["a0"]);
    expect(d.replay).toEqual([7]);
    expect(d.freeMs).toBe(2_000 + 7 * SQUADS.replaySecondsPerMove * 1000);
  });

  it("drains two of a squad's moves at once in its two-board half, one in the other", () => {
    const m = relay(3, 60_000);
    const think = Object.fromEntries(halfDuties(m).duties.map((d) => [d.players[0]!, 5_000]));
    const bank = resolveHalf(m, NO_INPUTS, think).events.filter((e) => e.kind === "bank");
    // (Everyone missed: each move ran to the cap, 15 s, past the 2 s free.)
    expect(bank.map((e) => (e.kind === "bank" ? e.drainedMs : 0))).toEqual([2 * 13_000, 13_000]);
  });

  it("a finished board: whoever's place in the ring it is scouts; the ring doesn't shift", () => {
    let m = relay();
    m = { ...m, boards: m.boards.map((b) => (b.id === 0 ? done(b, null) : b)) };
    const h = halfDuties(m);
    expect(h.scouts.map((d) => [d.board, d.players])).toEqual([[0, ["a1"]]]);
    expect(h.duties.map((d) => [d.board, d.players])).toEqual([
      [1, ["b0"]],
      [2, ["a0"]],
    ]);
  });
});

describe("Relay on 3 boards: the result", () => {
  const withResults = (rs: ("w" | "b" | null | undefined)[], banks: [number, number] = [5_000, 5_000]) => {
    const m = relay();
    return { ...m, banks, boards: m.boards.map((b, i) => (rs[i] === undefined ? b : done(b, rs[i]!))) };
  };

  it("best 2 of 3: two boards won clinch it at once; so does a lead the other can't catch up; a level finish still possible plays on", () => {
    // Side 0 is White on boards 1 and 3.
    expect(matchResultOf(withResults(["w", undefined, "w"]))).toMatchObject({ winner: 0, how: "clinch", points: [2, 0] });
    expect(matchResultOf(withResults(["w", "w", undefined]))).toBeNull();
    expect(matchResultOf(withResults(["w", null, undefined]))).toBeNull();
    // Ended as soon as the other squad can't catch up even winning every board left. Each finished board shares out one
    // point, so that is exactly more than half the points: 1½–½ with one board left can still end level, and plays on.
    expect(matchResultOf(withResults(["w", undefined, null]))).toBeNull();
    for (let p = 0; p <= 3; p += 0.5) for (let q = 0; q + p <= 3; q += 0.5) for (let left = 0; left <= 3 - p - q; left++) if (p + q + left === 3) expect(p > q + left).toBe(p > 1.5);
    expect(matchResultOf(withResults(["w", undefined, undefined]))).toBeNull();
    expect(matchResultOf(withResults(["w", null, "b"]))).toMatchObject({ points: [1.5, 1.5] });
    expect(matchResultOf(withResults(["w", "b", "w"]))).toMatchObject({ winner: 0, how: "boards", points: [3, 0] });
    expect(matchResultOf(withResults(["w", "w", "w"]))).toMatchObject({ winner: 0, how: "boards", points: [2, 1] });
  });

  it("a level score: more drawn boards as Black first, then more team bank left, then the seeded coin", () => {
    // All three drawn: side 1 drew two as Black (boards 1 and 3), side 0 one (board 2).
    expect(blackDraws(withResults([null, null, null]).boards)).toEqual([1, 2]);
    expect(matchResultOf(withResults([null, null, null], [90_000, 0]))).toMatchObject({ winner: 1, how: "black_draws", blackDraws: [1, 2] });
    // Side 0 wins board 1, side 1 board 2, board 3 drawn (side 1 Black there).
    expect(matchResultOf(withResults(["w", "w", null], [90_000, 0]))).toMatchObject({ winner: 1, how: "black_draws" });
    // Board 2 drawn (side 0 Black there).
    expect(matchResultOf(withResults(["w", null, "b"], [0, 90_000]))).toMatchObject({ winner: 0, how: "black_draws" });
    // Level on draws as Black (Pairs: both drawn, one as Black each): the bank, then the coin.
    const pairs = { ...relay(2), format: "pairs" as const };
    const both = { ...pairs, boards: pairs.boards.map((b) => done(b, null)) };
    expect(matchResultOf({ ...both, banks: [1_000, 2_000] })).toMatchObject({ winner: 1, how: "time" });
    const coin = matchResultOf({ ...both, banks: [1_000, 1_000] })!;
    expect(coin.how).toBe("coin");
    expect(matchResultOf({ ...both, banks: [1_000, 1_000] })).toEqual(coin);
  });

  it("the test-only Next round settles a level score the same way", () => {
    const m = withResults([null, null, undefined], [90_000, 0]);
    // Board 3 still going, level material: a draw (side 1 Black there): side 1 has two drawn as Black.
    const { match } = endByMaterial(m);
    expect(match.result).toMatchObject({ winner: 1, how: "admin" });
  });

  it("a whole match on 3 boards plays to a result", () => {
    let m = relay();
    for (let i = 0; i < 2 * SQUADS.safetyCap + 4 && !m.result; i++) m = resolveHalf(m, NO_INPUTS).match;
    expect(m.result).not.toBeNull();
    expect(m.boards).toHaveLength(3);
  });
});

describe("Relay: a match stored on 4 boards before Nov 5", () => {
  it("finishes on 4 boards, everyone one board along a turn as before", () => {
    let m = upgradeMatch(relay(4));
    expect(m.boards).toHaveLength(4);
    for (let h = 0; h < 8; h++) {
      const d = halfDuties(m).duties;
      expect(d).toHaveLength(4);
      for (const x of d) expect(x.players[0]).toBe(sides[x.side].seats[(((x.board - m.turn) % 4) + 4) % 4]);
      m = resolveHalf(m, NO_INPUTS).match;
    }
    for (let i = 0; i < 2 * SQUADS.safetyCap + 4 && !m.result; i++) m = resolveHalf(m, NO_INPUTS).match;
    expect(m.result).not.toBeNull();
    expect(m.boards).toHaveLength(4);
  });

  it("Mercenary's coins: 3 boards at ×4/3 pay what 4 did at ×1, and a stored 4-board match keeps ×1", () => {
    expect(roundScale(0)).toBeCloseTo(4 / 3);
    expect(roundScale(0, SQUADS, 4)).toBeCloseTo(1);
    expect(roundScale(0, SQUADS, 3)).toBeCloseTo(4 / 3);
    expect(roundScale(1, SQUADS, 2)).toBe(2);
    expect(3 * roundScale(0)).toBeCloseTo(4 * roundScale(0, SQUADS, 4));
  });

  it("(a board is a board: newSquadsBoard is unchanged)", () => {
    expect(newSquadsBoard(2, { fen: START_FEN, openingId: null }, 0).id).toBe(2);
  });
});
