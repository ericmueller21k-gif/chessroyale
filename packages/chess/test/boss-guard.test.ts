import { describe, expect, it } from "vitest";
import { DEFAULT_BOSS_GUARD, bossMoveFrom, bossThinkMs, lastMoveTookQueen, moveLoss, withinGuard, type EngineLike } from "../src/index.ts";
import { START_FEN } from "../src/rules.ts";

/** An engine whose top moves and limited-strength pick are scripted. */
function scripted(top: { move: string; expected: number }[], eloPick: string, other = 0.05): EngineLike {
  return {
    topMoves: async (_f, n) => top.slice(0, n),
    scoreMoves: async (_f, moves) => moves.map((m) => ({ move: m, expected: top.find((t) => t.move === m)?.expected ?? other })),
    playAtElo: async () => eloPick,
  };
}

const TOP = [
  { move: "e2e4", expected: 0.52 },
  { move: "d2d4", expected: 0.5 },
  { move: "g1f3", expected: 0.47 },
  { move: "b1c3", expected: 0.44 },
  { move: "f2f3", expected: 0.3 },
];

describe("the boss's blunder guard", () => {
  it("keeps a limited-strength move that's only a little worse", async () => {
    expect(await bossMoveFrom(scripted(TOP, "g1f3"), START_FEN, 1600, 1000, "elo")).toBe("g1f3");
  });

  it("swaps a move that throws material away (outside its top moves) for a small slip", async () => {
    const move = await bossMoveFrom(scripted(TOP, "a2a4", 0.02), START_FEN, 1600, 1000, "elo");
    expect(["d2d4", "g1f3"]).toContain(move);
  });

  it("swaps a top-list move that gives away too much", async () => {
    expect(await bossMoveFrom(scripted(TOP, "f2f3"), START_FEN, 1400, 1000, "elo")).not.toBe("f2f3");
  });

  it("a slip is a small inaccuracy from the top moves, never a blunder", async () => {
    for (let i = 0; i < 5; i++) {
      const move = await bossMoveFrom(scripted(TOP, "e2e4"), START_FEN, 1400, 1000, "stumble");
      const loss = (0.52 - TOP.find((t) => t.move === move)!.expected) * 100;
      expect(loss).toBeGreaterThanOrEqual(DEFAULT_BOSS_GUARD.slipLoss[0]);
      expect(loss).toBeLessThanOrEqual(DEFAULT_BOSS_GUARD.slipLoss[1]);
    }
  });

  it("guards a position that's already lost too (log-odds), where points shrink", () => {
    // 6% to 1%: only 5 points, but it throws the rest of the game away.
    expect(withinGuard(moveLoss(0.06, 0.01), DEFAULT_BOSS_GUARD)).toBe(false);
    expect(withinGuard(moveLoss(0.5, 0.45), DEFAULT_BOSS_GUARD)).toBe(true);
    expect(withinGuard(moveLoss(0.5, 0.1), DEFAULT_BOSS_GUARD)).toBe(false);
  });
});

describe("queen captures in the boss battle", () => {
  // 1. e4 d5 2. exd5 Qxd5 3. Nc3 Qe5+?? 4. ... (a made-up line where White's knight later takes the queen)
  const line = ["e2e4", "d7d5", "e4d5", "d8d5", "b1c3", "d5d4", "g1f3", "d4c4", "f1c4"];
  it("spots the crowd taking the queen, and the boss waits for its banner", () => {
    expect(lastMoveTookQueen(line)).toBe(true);
    expect(lastMoveTookQueen(line.slice(0, -1))).toBe(false);
    expect(bossThinkMs(line)).toBeGreaterThan(bossThinkMs(line.slice(0, -1)));
  });
});
