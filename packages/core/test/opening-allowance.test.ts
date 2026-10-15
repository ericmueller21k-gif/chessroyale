import { describe, expect, it } from "vitest";
import {
  OPENING_ALLOWANCE,
  brilliance,
  countedOf,
  matchLoss,
  mulberry32,
  openingAllowance,
  outcomesFromGroup,
  applyRound,
  createMatch,
  scoreGroup,
  type Allowance,
  type GroupEvaluation,
} from "../src/index.ts";

// docs/decisions/2026-10-15-opening-allowance-and-ties.md (Oct 15, 2026).
const A = OPENING_ALLOWANCE;

describe("the opening allowance's taper", () => {
  it("is whole through move flatThrough, falls in a line, and is gone by goneBy", () => {
    expect(openingAllowance(1)).toBe(A.points);
    expect(openingAllowance(A.flatThrough)).toBe(A.points);
    // Move 12 is halfway from 10 to 14.
    expect(openingAllowance(12, { points: 8, flatThrough: 10, goneBy: 14 })).toBeCloseTo(4);
    expect(openingAllowance(11, { points: 8, flatThrough: 10, goneBy: 14 })).toBeCloseTo(6);
    expect(openingAllowance(A.goneBy)).toBe(0);
    expect(openingAllowance(30)).toBe(0);
  });

  it("uses the settings' numbers (8 points through move 10, gone by move 14, a pawn of material)", () => {
    expect(A).toEqual({ points: 8, flatThrough: 10, goneBy: 14, materialPawns: 1 });
  });
});

describe("counted and raw loss in a group", () => {
  // Losses: a 0, b 3, c 6, d 20, e 12 (e gives up material: no allowance).
  const ev: GroupEvaluation = { bestExpected: 0.6, bestMove: "a", expectedAfter: { a: 0.6, b: 0.57, c: 0.54, d: 0.4, e: 0.48 } };
  const picks = ["a", "b", "c", "d", "e"].map((m, i) => ({ playerId: `p${i}`, move: m }));
  const allowance = (m: string): Allowance => (m === "e" ? { points: 0, material: "gave" } : { points: 5 });

  it("scores round scores from the counted losses, keeping the raw ones", () => {
    const r = scoreGroup(picks, ev, mulberry32(1), undefined, "best", allowance);
    const by = Object.fromEntries(r.players.map((p) => [p.playerId, p]));
    expect(by.p1!.loss).toBeCloseTo(3);
    expect(by.p1!.counted).toBe(0);
    expect(by.p2!.loss).toBeCloseTo(6);
    expect(by.p2!.counted).toBeCloseTo(1);
    expect(by.p3!.counted).toBeCloseTo(15);
    // A pick that gave up material keeps its whole loss, and says why.
    expect(by.p4!.loss).toBeCloseTo(12);
    expect(by.p4!.counted).toBeUndefined();
    expect(by.p4!.material).toBe("gave");
    expect(countedOf(by.p4!)).toBeCloseTo(12);
    // The best move: nothing to take off, so no `counted` either.
    expect(by.p0!.counted).toBeUndefined();
    // Average of the counted losses: (0 + 0 + 1 + 15 + 12) / 5.
    expect(r.averageLoss).toBeCloseTo(28 / 5);
    expect(by.p2!.roundScore).toBeCloseTo(28 / 5 - 1);
    expect(by.p4!.roundScore).toBeCloseTo(28 / 5 - 12);
    // Round scores still sum to zero.
    expect(r.players.reduce((s, p) => s + p.roundScore, 0)).toBeCloseTo(0, 9);
  });

  it("draws the board's move on the raw losses", () => {
    // "best" draws among the least raw loss: only a, though b's counted loss is 0 too.
    for (let seed = 1; seed < 30; seed++) expect(scoreGroup(picks, ev, mulberry32(seed), undefined, "best", allowance).playedMove).toBe("a");
  });

  it("without an allowance scores exactly as before", () => {
    const plain = scoreGroup(picks, ev, mulberry32(1));
    const none = scoreGroup(picks, ev, mulberry32(1), undefined, "random", () => ({ points: 0 }));
    expect(none.players.map((p) => p.roundScore)).toEqual(plain.players.map((p) => p.roundScore));
    expect(plain.players.every((p) => p.counted === undefined)).toBe(true);
  });

  it("costs a miss exactly as before", () => {
    const r = scoreGroup([...picks, { playerId: "m", move: null }], ev, mulberry32(1), undefined, "best", allowance);
    expect(r.players.find((p) => p.playerId === "m")!.roundScore).toBe(-25);
  });

  it("keeps brilliance on the raw losses", () => {
    // Six pickers: one finds the best; the rest give away 10 raw, which the allowance would forgive down to 2.
    const ev2: GroupEvaluation = { bestExpected: 0.6, bestMove: "a", expectedAfter: { a: 0.6, b: 0.5 } };
    const ps = ["a", "b", "b", "b", "b", "b"].map((m, i) => ({ playerId: `p${i}`, move: m }));
    const r = scoreGroup(ps, ev2, mulberry32(1), undefined, "popular", () => ({ points: 8 }));
    expect(r.players[1]!.counted).toBeCloseTo(2);
    const b = brilliance(r.players);
    expect(b?.players).toEqual(["p0"]);
    expect(b?.othersLoss).toBeCloseTo(10);
  });
});

describe("counted losses over the match", () => {
  it("keeps raw losses for ratings and counted ones for matchLoss", () => {
    let state = createMatch([{ id: "x", name: "X", isBot: false }], [0]);
    const ev: GroupEvaluation = { bestExpected: 0.6, bestMove: "a", expectedAfter: { a: 0.6, b: 0.55 } };
    const r = scoreGroup([{ playerId: "x", move: "b" }], ev, mulberry32(1), undefined, "random", () => ({ points: 3 }));
    state = applyRound(state, new Map([[0, ["x"]]]), outcomesFromGroup(r, { x: 1000 }));
    const p = state.players[0]!;
    expect(p.lossesByStage[0]![0]).toBeCloseTo(5);
    expect(p.countedLossSum).toBeCloseTo(2);
    expect(matchLoss(p)).toBeCloseTo(2);
    // A match from before the allowance (no counted sum): the raw losses count.
    expect(matchLoss({ lossesByStage: [[4, 6]], misses: 0 })).toBe(5);
  });
});
