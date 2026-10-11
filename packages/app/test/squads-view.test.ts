import { describe, expect, it } from "vitest";
import type { NetDuty, NetSquadsLobby, NetSquadsHalf, NetTeamClock } from "@chessroyale/chess/squads";
import { START_FEN } from "@chessroyale/chess";
import {
  SQUAD_NAMES,
  bankText,
  drainRate,
  liveBank,
  movesOfHalf,
  myBoards,
  points,
  shownMatches,
  squadClocks,
  standingLine,
  standingsOrder,
  type LocalMatch,
} from "../src/squads-view.ts";

/** A match as the client keeps it: two squads of four, `boards` boards, a half begun at t=0. */
function match(over: Partial<LocalMatch> = {}, boards = 4): LocalMatch {
  return {
    key: "r0m0",
    round: 0,
    index: 0,
    format: boards === 4 ? "relay" : boards === 2 ? "pairs" : "final",
    armageddon: false,
    sides: [
      { squadId: 0, seats: ["a0", "a1", "a2", "a3"] },
      { squadId: 1, seats: ["b0", "b1", "b2", "b3"] },
    ],
    boards: Array.from({ length: boards }, (_, i) => ({ id: i, startFen: START_FEN, openingId: null, fen: START_FEN, moves: [], ply: 0, lastMove: null, white: (i % 2) as 0 | 1, result: null })),
    turn: 0,
    half: "w",
    banks: [60_000, 60_000],
    delayMs: 3000,
    incrementMs: 0,
    state: "half",
    startsAt: null,
    current: null,
    result: null,
    visible: {},
    locked: [],
    lockedAt: {},
    choiceAt: {},
    last: null,
    ...over,
  };
}

const duty = (board: number, side: 0 | 1, players: string[], role: NetDuty["role"] = "move", deadline = 20_000): NetDuty => ({ board, side, role, players, deadline });
const half = (duties: NetDuty[]): NetSquadsHalf => ({ seq: 0, turn: 0, half: "w", startedAt: 0, duties, scouts: [], mercy: null, forced: [] });

describe("Squads screens: the team clock as the screen runs it", () => {
  it("drains past the free seconds, once for each move being thought about (twice as fast with two)", () => {
    const m = match({ current: half([duty(0, 0, ["a0"]), duty(2, 0, ["a2"]), duty(1, 1, ["b1"])]) });
    // Within the free seconds: nothing drains.
    expect(liveBank(m, 0, 2000)).toBe(60_000);
    expect(drainRate(m, 0, 2000)).toBe(0);
    // At 5 s: side 0's two movers have each drained 2 s; side 1's one mover 2 s.
    expect(liveBank(m, 0, 5000)).toBe(56_000);
    expect(liveBank(m, 1, 5000)).toBe(58_000);
    expect(drainRate(m, 0, 5000)).toBe(2);
    expect(drainRate(m, 1, 5000)).toBe(1);
  });

  it("a move locked in stops draining when it was locked; blockers never drain", () => {
    const m = match({ current: half([duty(0, 0, ["a0", "a1"], "pick"), duty(0, 1, ["b2", "b3"], "block")]), locked: ["a0", "a1", "b2"], lockedAt: { a0: 4000, a1: 6000, b2: 9000 } }, 1);
    // The pair's slower picker locked at 6 s: 3 s drained, then still.
    expect(liveBank(m, 0, 10_000)).toBe(57_000);
    expect(drainRate(m, 0, 10_000)).toBe(0);
    expect(liveBank(m, 1, 10_000)).toBe(60_000);
  });

  it("stops at zero (sudden death), and in sudden death shows zero", () => {
    const m = match({ banks: [4000, 0], current: half([duty(0, 0, ["a0"]), duty(1, 1, ["b1"], "move", 3000)]) });
    expect(liveBank(m, 0, 10_000)).toBe(0);
    expect(liveBank(m, 1, 1000)).toBe(0);
    expect(drainRate(m, 1, 5000)).toBe(0);
    const clocks: NetTeamClock[] = [0, 1, 2].map((squadId) => ({ squadId, bankMs: 50_000, suddenDeath: false, key: null, since: null }));
    const shown = squadClocks(clocks, [m], 10_000);
    expect(shown.map((c) => [c.squadId, c.bankMs, c.suddenDeath])).toEqual([
      [0, 0, true],
      [1, 0, true],
      [2, 50_000, false],
    ]);
  });

  it("between halves the bank stands still", () => {
    const m = match({ state: "show", banks: [41_000, 39_500] });
    expect(liveBank(m, 0, 99_999)).toBe(41_000);
    expect(drainRate(m, 1, 99_999)).toBe(0);
  });
});

describe("Squads screens: YOU and NEXT", () => {
  it("Relay: one board along each turn", () => {
    const m = match();
    expect(myBoards(m, "a0")).toEqual({ you: 0, next: 1 });
    expect(myBoards({ ...m, turn: 3 }, "b2")).toEqual({ you: 1, next: 2 });
    expect(myBoards(m, "spectator")).toBeNull();
  });

  it("Pairs: your pair's slot this turn and next (player 1's pair alternates)", () => {
    const m = match({}, 2);
    // Turn 0: 1+2 play board 1, 3+4 board 2; turn 1: 2+4 on board 1, 1+3 on board 2.
    expect(myBoards(m, "a0")).toEqual({ you: 0, next: 1 });
    expect(myBoards(m, "a3")).toEqual({ you: 1, next: 0 });
  });

  it("the final: its one board, no next", () => {
    expect(myBoards(match({}, 1), "b1")).toEqual({ you: 0, next: null });
  });
});

describe("Squads screens: words and numbers", () => {
  it("bank and points", () => {
    expect(bankText(185_400)).toBe("3:05");
    expect(bankText(9_440)).toBe("9.4");
    expect(bankText(-5)).toBe("0.0");
    expect(points(2.5)).toBe("2½");
    expect(points(0.5)).toBe("½");
    expect(points(0)).toBe("0");
  });

  it("every squad has a short name", () => {
    expect(SQUAD_NAMES).toHaveLength(8);
    expect(new Set(SQUAD_NAMES).size).toBe(8);
    for (const n of SQUAD_NAMES) expect(n.length).toBeLessThanOrEqual(7);
  });

  it("where each squad stands, best placed first", () => {
    const lobby = {
      phase: "bracket",
      squads: [
        { id: 0, seats: [], placement: 5 },
        { id: 1, seats: [], placement: null },
        { id: 2, seats: [], placement: null },
        { id: 3, seats: [], placement: 1 },
      ],
      bracket: [
        { key: "r0m0", round: 0, index: 0, format: "relay", squads: [0, 1], winner: 1, state: "over" },
        { key: "r1m0", round: 1, index: 0, format: "pairs", squads: [1, 2], winner: null, state: "playing" },
      ],
    } as unknown as NetSquadsLobby;
    expect(standingLine(lobby, 0)).toBe("Out · 5th–8th");
    expect(standingLine(lobby, 1)).toBe("Round 2 · v Bishops");
    expect(standingLine(lobby, 3)).toBe("Champions");
    expect(standingsOrder(lobby)).toEqual([3, 1, 2, 0]);
  });

  it("the tiny boards: live matches and the latest round's finished ones", () => {
    const a = match({ key: "r0m0", state: "over" });
    const b = match({ key: "r0m1", index: 1 });
    const c = match({ key: "r1m0", round: 1, state: "break" }, 2);
    expect(shownMatches([a, b]).map((m) => m.key)).toEqual(["r0m0", "r0m1"]);
    expect(shownMatches([a, b, c]).map((m) => m.key)).toEqual(["r0m1", "r1m0"]);
  });

  it("a half's moves, board by board", () => {
    const events = [
      { kind: "relay", turn: 0, half: "w", board: 0, side: 0, player: "a0", move: "e2e4", missed: false },
      { kind: "forced", turn: 0, half: "w", board: 1, side: 1, move: "e1f1" },
      { kind: "bank", turn: 0, half: "w", side: 0, drainedMs: 1, leftMs: 2, suddenDeath: false },
    ] as const;
    expect(movesOfHalf(events as never, 0)).toEqual(["e2e4"]);
    expect(movesOfHalf(events as never, 1)).toEqual(["e1f1"]);
    expect(movesOfHalf(events as never, 2)).toEqual([]);
  });
});
