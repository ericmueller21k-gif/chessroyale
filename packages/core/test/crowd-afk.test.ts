import { describe, expect, it } from "vitest";
import { CROWD_MISSES, CROWD_SETTINGS, DEFAULT_SETTINGS, crowdTopOdds, drawMove, mulberry32, scoreGroup, type GroupEvaluation, type ScoreContext, type Settings } from "../src/index.ts";

// docs/decisions/2026-11-04-crowd-votes-afk.md: 50 v 50's sure majority (crowdSureShare) and its misses (CrowdMisses).
// The runner's side (the pick made for a miss, the 4th miss's removal, bots never): packages/chess/test/crowd.test.ts.

const CROWD: Settings = { ...DEFAULT_SETTINGS, ...CROWD_SETTINGS };
const picks = (counts: Record<string, number>) => Object.entries(counts).flatMap(([m, n]) => Array<string>(n).fill(m));
/** How often each move is played over many seeds. */
function played(moves: readonly string[], settings = CROWD, seeds = 2000): Map<string, number> {
  const seen = new Map<string, number>();
  for (let seed = 1; seed <= seeds; seed++) {
    const m = drawMove(moves, {}, "popular", mulberry32(seed), settings);
    seen.set(m, (seen.get(m) ?? 0) + 1);
  }
  return seen;
}

describe("a big majority always wins (crowdSureShare, Eric, Nov 4)", () => {
  it("is 50 v 50's 0.7, and only 50 v 50 draws from the top", () => {
    expect(CROWD.crowdSureShare).toBe(0.7);
    expect(CROWD.crowdPlayedFromTop).toBeGreaterThan(1);
  });

  it("10 on a team, 7-2-1: the 7 always (every seed); 85%: always, a blunder too", () => {
    expect(crowdTopOdds(picks({ a: 7, b: 2, c: 1 }), 3, CROWD.crowdSureShare)).toEqual({ a: 1 });
    expect([...played(picks({ a: 7, b: 2, c: 1 }))]).toEqual([["a", 2000]]);
    expect([...played(picks({ blunder: 17, best: 2, c: 1 }))]).toEqual([["blunder", 2000]]);
    expect([...played(picks({ a: 35, b: 10, c: 5 }))]).toEqual([["a", 2000]]);
  });

  it("6-3-1: the draw as before (60 / 30 / 10), so the 3 sometimes", () => {
    expect(crowdTopOdds(picks({ a: 6, b: 3, c: 1 }), 3, CROWD.crowdSureShare)).toEqual({ a: 0.6, b: 0.3, c: 0.1 });
    const seen = played(picks({ a: 6, b: 3, c: 1 }));
    expect(seen.get("b")!).toBeGreaterThan(400);
    expect(seen.get("c")!).toBeGreaterThan(100);
    expect(seen.get("a")! / 2000).toBeCloseTo(0.6, 1);
  });

  it("ties as before: a tie for the most is never sure; a tie across third place is left out", () => {
    expect(crowdTopOdds(picks({ a: 5, b: 5 }), 3, CROWD.crowdSureShare)).toEqual({ a: 0.5, b: 0.5 });
    expect(crowdTopOdds(picks({ a: 1, b: 1, c: 1, d: 1 }), 3, CROWD.crowdSureShare)).toEqual({ a: 0.25, b: 0.25, c: 0.25, d: 0.25 });
    expect(crowdTopOdds(picks({ a: 6, b: 2, c: 1, d: 1 }), 3, CROWD.crowdSureShare)).toEqual({ a: 0.75, b: 0.25 });
    // (A share of 0.5 or less can't make a tie sure either.)
    expect(crowdTopOdds(picks({ a: 5, b: 5 }), 3, 0.5)).toEqual({ a: 0.5, b: 0.5 });
  });

  it("the share counts real picks only: misses (and the moves picked for them) never dilute it", () => {
    const evaluation: GroupEvaluation = { bestMove: "a", bestExpected: 0.6, expectedAfter: { a: 0.6, b: 0.55, c: 0.5 } };
    const group = [...picks({ a: 7, b: 2, c: 1 }), null, null, null, null, null].map((move, i) => ({ playerId: `p${i}`, move }));
    for (let seed = 1; seed <= 200; seed++) {
      const r = scoreGroup(group, evaluation, mulberry32(seed), CROWD, "popular", undefined, { stage: 0, streaks: false });
      expect(r.playedMove).toBe("a");
      expect(r.drawOdds).toEqual({ a: 1 });
    }
  });
});

describe("a miss in 50 v 50 (CrowdMisses, Eric, Nov 4)", () => {
  const evaluation: GroupEvaluation = { bestMove: "best", bestExpected: 0.6, expectedAfter: { best: 0.6, ok: 0.57, bad: 0.4 } };
  const ctx: ScoreContext = { stage: 3, streaks: false };
  const group = (moves: readonly (string | null)[]) => moves.map((move, i) => ({ playerId: `p${i}`, move }));

  it("is on in 50 v 50 (5 top moves, 3 misses allowed), off in a raid", () => {
    expect(CROWD.crowdMisses).toEqual(CROWD_MISSES);
    expect(CROWD_MISSES).toEqual({ defaultFromTop: 5, allowed: 3 });
  });

  it("scores the lowest round score of anyone on the team who picked, never better than the worst real pick", () => {
    const r = scoreGroup(group(["best", "ok", "bad", "bad", null, null]), evaluation, () => 0.5, CROWD, "popular", undefined, ctx);
    const real = r.players.filter((p) => p.move !== null).map((p) => p.roundScore);
    const low = Math.min(...real);
    expect(low).toBeLessThan(0);
    for (const id of ["p4", "p5"]) {
      const p = r.players.find((x) => x.playerId === id)!;
      expect(p).toMatchObject({ move: null, loss: null, roundScore: low, streak: 0 });
    }
    // (Before: missCaps times the cap below zero, worse than this worst pick.)
    const before = scoreGroup(group(["best", "ok", "bad", "bad", null, null]), evaluation, () => 0.5, { ...CROWD, crowdMisses: null }, "popular", undefined, ctx);
    expect(before.players[4]!.roundScore).toBeLessThan(low);
  });

  it("nobody on the team picked: as before (missCaps times the cap below zero)", () => {
    const r = scoreGroup(group([null, null]), evaluation, () => 0.5, CROWD, "popular", undefined, ctx);
    const off = scoreGroup(group([null, null]), evaluation, () => 0.5, { ...CROWD, crowdMisses: null }, "popular", undefined, ctx);
    expect(r.players.map((p) => p.roundScore)).toEqual(off.players.map((p) => p.roundScore));
  });

  it("the team's average and the tally leave the misses out", () => {
    const withMisses = scoreGroup(group(["best", "ok", "bad", null, null, null]), evaluation, () => 0.5, CROWD, "popular", undefined, ctx);
    const without = scoreGroup(group(["best", "ok", "bad"]), evaluation, () => 0.5, CROWD, "popular", undefined, ctx);
    expect(withMisses.averageLoss).toBe(without.averageLoss);
    expect(withMisses.drawOdds).toEqual(without.drawOdds);
    expect(withMisses.players.slice(0, 3)).toEqual(without.players);
  });
});
