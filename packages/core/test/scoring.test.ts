import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  drawOdds,
  drawRuleFor,
  isDeadRound,
  mulberry32,
  scoreGroup,
  type DrawRule,
  type GroupEvaluation,
  type Pick,
} from "../src/index.ts";

// buildspec.md worked example: the best move leaves the mover 0.62.
const evaluation: GroupEvaluation = {
  bestExpected: 0.62,
  bestMove: "e2e4",
  expectedAfter: { e2e4: 0.62, d2d4: 0.58, h2h4: 0.3 },
};
const picks: Pick[] = [
  { playerId: "A", move: "e2e4" },
  { playerId: "B", move: "d2d4" },
  { playerId: "C", move: "d2d4" },
  { playerId: "D", move: "h2h4" },
];

describe("worked example", () => {
  it("scores each pick against the group average", () => {
    const r = scoreGroup(picks, evaluation, mulberry32(1));
    const by = Object.fromEntries(r.players.map((p) => [p.playerId, p]));
    expect(by.A!.loss).toBeCloseTo(0);
    expect(by.B!.loss).toBeCloseTo(4);
    expect(by.C!.loss).toBeCloseTo(4);
    expect(by.D!.loss).toBeCloseTo(32);
    expect(r.averageLoss).toBeCloseTo(10);
    expect(by.A!.roundScore).toBeCloseTo(10);
    expect(by.B!.roundScore).toBeCloseTo(6);
    expect(by.C!.roundScore).toBeCloseTo(6);
    expect(by.D!.roundScore).toBeCloseTo(-22);
  });

  it("gives the shared move twice the chance in the draw", () => {
    const odds = drawOdds(picks);
    expect(odds.d2d4).toBeCloseTo(0.5);
    expect(odds.e2e4).toBeCloseTo(0.25);
    expect(odds.h2h4).toBeCloseTo(0.25);
  });

  it("handles a miss: -25, left out of the average and the draw", () => {
    const withMiss = picks.map((p) => (p.playerId === "D" ? { ...p, move: null } : p));
    const r = scoreGroup(withMiss, evaluation, mulberry32(1));
    const by = Object.fromEntries(r.players.map((p) => [p.playerId, p]));
    expect(r.averageLoss).toBeCloseTo(8 / 3);
    expect(by.A!.roundScore).toBeCloseTo(2.67, 2);
    expect(by.B!.roundScore).toBeCloseTo(-1.33, 2);
    expect(by.C!.roundScore).toBeCloseTo(-1.33, 2);
    expect(by.D!.roundScore).toBe(-25);
    expect(drawOdds(withMiss).d2d4).toBeCloseTo(2 / 3);
  });
});

describe("checks from the spec", () => {
  it("round scores in a group with no misses sum to zero", () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 200; i++) {
      const ev: GroupEvaluation = {
        bestExpected: rng(),
        bestMove: "a",
        expectedAfter: { a: rng(), b: rng(), c: rng(), d: rng() },
      };
      const ps: Pick[] = ["a", "b", "c", "d"].map((m, k) => ({ playerId: `p${k}`, move: m }));
      const r = scoreGroup(ps, ev, rng);
      expect(r.players.reduce((s, p) => s + p.roundScore, 0)).toBeCloseTo(0, 9);
    }
  });

  it("a player in a losing position can still top their group", () => {
    const lost: GroupEvaluation = { bestExpected: 0.05, bestMove: "a", expectedAfter: { a: 0.05, b: 0.01, c: 0.0 } };
    const r = scoreGroup(
      [
        { playerId: "me", move: "a" },
        { playerId: "x", move: "b" },
        { playerId: "y", move: "c" },
      ],
      lost,
      mulberry32(1),
    );
    expect(r.players.find((p) => p.playerId === "me")!.roundScore).toBeGreaterThan(0);
  });

  it("treats a pick that beats the engine's choice as the best, so loss is never negative", () => {
    const ev: GroupEvaluation = { bestExpected: 0.5, bestMove: "a", expectedAfter: { a: 0.5, b: 0.53 } };
    const r = scoreGroup(
      [
        { playerId: "p", move: "a" },
        { playerId: "q", move: "b" },
      ],
      ev,
      mulberry32(1),
    );
    expect(r.players.map((p) => p.loss)).toEqual([expect.closeTo(3), 0]);
  });

  it("plays the engine's best move when nobody picked", () => {
    const r = scoreGroup([{ playerId: "p", move: null }], evaluation, mulberry32(1));
    expect(r.playedMove).toBe("e2e4");
    expect(r.averageLoss).toBeNull();
  });

  it("draws picks in proportion to tickets", () => {
    const rng = mulberry32(9);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 20_000; i++) {
      const m = scoreGroup(picks, evaluation, rng).playedMove;
      counts[m] = (counts[m] ?? 0) + 1;
    }
    expect(counts.d2d4! / 20_000).toBeCloseTo(0.5, 1);
    expect(counts.e2e4! / 20_000).toBeCloseTo(0.25, 1);
  });

  it("flags dead rounds", () => {
    const flat: GroupEvaluation = { bestExpected: 0.5, bestMove: "a", expectedAfter: { a: 0.5, b: 0.495, c: 0.492 } };
    const ps: Pick[] = ["a", "b", "c"].map((m, k) => ({ playerId: `p${k}`, move: m }));
    expect(isDeadRound(scoreGroup(ps, flat, mulberry32(1)))).toBe(true);
    expect(isDeadRound(scoreGroup(picks, evaluation, mulberry32(1)))).toBe(false);
  });
});

describe("draw rules", () => {
  const share = (rule: DrawRule, ps: Pick[] = picks) => {
    const rng = mulberry32(5);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 4000; i++) {
      const m = scoreGroup(ps, evaluation, rng, DEFAULT_SETTINGS, rule).playedMove;
      counts[m] = (counts[m] ?? 0) + 1 / 4000;
    }
    return counts;
  };

  it("popular plays the most-picked move, drawing among ties", () => {
    expect(Object.keys(share("popular"))).toEqual(["d2d4"]);
    const allDifferent = [picks[0]!, picks[1]!, picks[3]!];
    const s = share("popular", allDifferent);
    expect(Object.keys(s).sort()).toEqual(["d2d4", "e2e4", "h2h4"]);
    expect(s.e2e4!).toBeCloseTo(1 / 3, 1);
  });

  it("best plays the best move picked", () => {
    expect(Object.keys(share("best"))).toEqual(["e2e4"]);
    expect(scoreGroup(picks, evaluation, mulberry32(1), DEFAULT_SETTINGS, "best").drawRule).toBe("best");
  });

  it("weighted favours better moves but still plays weaker ones sometimes", () => {
    const s = share("weighted");
    // Losses 0, 4, 4, 32 with 4-point weights: e2e4 1, d2d4 2 × e^-1, h2h4 e^-8.
    expect(s.e2e4!).toBeCloseTo(1 / (1 + 2 * Math.exp(-1)), 1);
    expect(s.d2d4!).toBeGreaterThan(0.3);
    expect(s.h2h4 ?? 0).toBeLessThan(0.01);
  });

  it("uses the stage's rule, and the last rule for later stages", () => {
    const settings = { ...DEFAULT_SETTINGS, drawRuleByStage: ["popular", "best"] as DrawRule[] };
    expect(drawRuleFor(0, settings)).toBe("popular");
    expect(drawRuleFor(1, settings)).toBe("best");
    expect(drawRuleFor(4, settings)).toBe("best");
  });
});
