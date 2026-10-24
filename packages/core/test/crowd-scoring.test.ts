import { describe, expect, it } from "vitest";
import {
  CROWD_SCORING,
  CROWD_SETTINGS,
  DEFAULT_SETTINGS,
  applyRound,
  capFor,
  createMatch,
  crowdBrilliant,
  cutPlan,
  endStage,
  mulberry32,
  outcomesFromGroup,
  round2,
  scoreGroup,
  sharedFactor,
  softCap,
  standings,
  streakBonusAt,
  streakCounts,
  type CrowdScoring,
  type GroupEvaluation,
  type MatchState,
  type PlayerState,
  type ScoreContext,
  type Settings,
} from "../src/index.ts";

// docs/decisions/2026-10-24-crowd-scoring.md: Crowd 50 v 50's scoring (the soft cap by stage, material uncapped, the
// shared-blunder relief, streaks, rare brilliant finds, the bubble grace, 2 decimals).

const S: Settings = { ...DEFAULT_SETTINGS, ...CROWD_SETTINGS };
const CS = S.crowdScoring!;
const rng = () => 0.5;

/** A group's evaluation from each move's loss in points (the best move "best" at 0). */
function evalOf(losses: Record<string, number>): GroupEvaluation {
  return { bestMove: "best", bestExpected: 0.6, expectedAfter: Object.fromEntries(Object.entries({ best: 0, ...losses }).map(([m, l]) => [m, 0.6 - l / 100])) };
}
/** Picks: each entry a move (or null), one player each (p0, p1, ...). */
const picksOf = (moves: readonly (string | null)[]) => moves.map((move, i) => ({ playerId: `p${i}`, move }));
const ctx = (stage = 0, streaks = false, streakOf?: (id: string) => number): ScoreContext => ({ stage, streaks, ...(streakOf ? { streakOf } : {}) });
const score = (r: ReturnType<typeof scoreGroup>, id: string) => r.players.find((p) => p.playerId === id)!.roundScore;

describe("the soft cap", () => {
  it("stays inside the cap, keeps order and is near the raw score for small ones", () => {
    for (const y of [-40, -9, 9, 40].map((x) => softCap(x, 2))) expect(Math.abs(y)).toBeLessThanOrEqual(2);
    const xs = [-9, -4, -2, -1, -0.3, 0, 0.3, 1, 2, 4, 9];
    const ys = xs.map((x) => softCap(x, 2));
    for (const y of ys) expect(Math.abs(y)).toBeLessThan(2);
    for (let i = 1; i < ys.length; i++) expect(ys[i]!).toBeGreaterThan(ys[i - 1]!);
    expect(softCap(0.3, 2)).toBeCloseTo(0.3, 1);
    // A bigger miss still scores worse than a smaller one, to 2 decimals, inside the range.
    expect(round2(softCap(-4, 2))).toBeLessThan(round2(softCap(-2, 2)));
    expect(softCap(-7, null)).toBe(-7);
  });

  it("the ratio curve: inside the cap, and a bigger miss still shows worse to 2 decimals where tanh has flattened", () => {
    for (const x of [-100, -20, -5, 5, 20, 100]) expect(Math.abs(softCap(x, 2, "ratio"))).toBeLessThan(2);
    expect(round2(softCap(-20, 2, "ratio"))).toBeLessThan(round2(softCap(-10, 2, "ratio")));
    expect(round2(softCap(-20, 2, "tanh"))).toBe(round2(softCap(-10, 2, "tanh")));
    expect(softCap(0.1, 2, "ratio")).toBeCloseTo(0.1, 2);
  });

  it("widens by stage: before the first cut, then from capFrom", () => {
    expect(capFor(CS, 0)).toBe(CS.cap[0]);
    for (const [i, from] of CS.capFrom.entries()) {
      expect(capFor(CS, from)).toBe(CS.cap[i]);
      if (from > 0) expect(capFor(CS, from - 1)).toBe(CS.cap[i - 1]);
    }
    expect(capFor({ ...CS, cap: [3, 5, 8, null] }, 30)).toBeNull();
    const caps = [0, 1, 5, 9, 20].map((st) => capFor(CS, st)!);
    for (let i = 1; i < caps.length; i++) expect(caps[i]!).toBeGreaterThanOrEqual(caps[i - 1]!);
  });

  it("caps a round score by its stage, in 2 decimals", () => {
    // 9 found the best, one gave away 30 points (no material): the average 3, so +3 / -27 before the cap.
    const picks = picksOf([...Array(9).fill("best"), "bad"]);
    const early = scoreGroup(picks, evalOf({ bad: 30 }), rng, S, "popular", undefined, ctx(0));
    const cap0 = capFor(CS, 0)!;
    expect(score(early, "p0")).toBe(round2(softCap(3, cap0, CS.capCurve)));
    expect(score(early, "p9")).toBe(round2(softCap(-27, cap0, CS.capCurve)));
    expect(score(early, "p9")).toBeGreaterThanOrEqual(-cap0);
    const late = scoreGroup(picks, evalOf({ bad: 30 }), rng, S, "popular", undefined, ctx(20));
    expect(score(late, "p9")).toBeLessThan(score(early, "p9"));
    for (const p of [...early.players, ...late.players]) expect(Math.round(p.roundScore * 100) / 100).toBe(p.roundScore);
  });

  it("is off without a context or crowdScoring: today's scores", () => {
    const picks = picksOf([...Array(9).fill("best"), "bad"]);
    const today = scoreGroup(picks, evalOf({ bad: 30 }), rng, S, "popular");
    expect(score(today, "p9")).toBeCloseTo(-27, 9);
    const raid = scoreGroup(picks, evalOf({ bad: 30 }), rng, { ...S, crowdScoring: undefined }, "popular", undefined, ctx(0));
    expect(score(raid, "p9")).toBeCloseTo(-27, 9);
  });
});

describe("material blunders outside the cap", () => {
  it("a pick that gives up material takes its minus score uncapped (with or without the allowance on)", () => {
    const picks = picksOf([...Array(9).fill("best"), "hang"]);
    for (const a of [{ points: 0, material: "gave" as const, uncap: "gave" as const }, { points: 0, uncap: "gave" as const }]) {
      const r = scoreGroup(picks, evalOf({ hang: 30 }), rng, S, "popular", (m) => (m === "hang" ? a : { points: 0 }), ctx(0));
      const p = r.players.find((x) => x.playerId === "p9")!;
      expect(p.roundScore).toBe(round2(3 - 30));
      expect(p.uncapped).toBe("gave");
      // The good picks are still capped.
      expect(score(r, "p0")).toBe(round2(softCap(3, capFor(CS, 0), CS.capCurve)));
    }
  });

  it("a pawn's slip (no allowance, but not a piece) is still capped", () => {
    const picks = picksOf([...Array(9).fill("best"), "pawn"]);
    const r = scoreGroup(picks, evalOf({ pawn: 30 }), rng, S, "popular", (m) => (m === "pawn" ? { points: 0, material: "gave" } : { points: 0 }), ctx(0));
    expect(score(r, "p9")).toBe(round2(softCap(-27, capFor(CS, 0), CS.capCurve)));
    expect(r.players[9]!.material).toBe("gave");
    expect(r.players[9]!.uncapped).toBeUndefined();
  });

  it("only the minus side: a material pick that still beat the field is capped", () => {
    const picks = picksOf(["gambit", "bad", "bad", "bad"]);
    const r = scoreGroup(picks, evalOf({ gambit: 1, bad: 20 }), rng, S, "popular", (m) => (m === "gambit" ? { points: 0, uncap: "gave" } : { points: 0 }), ctx(0));
    const p = r.players[0]!;
    expect(p.roundScore).toBeLessThanOrEqual(capFor(CS, 0)!);
    expect(p.uncapped).toBeUndefined();
  });
});

describe("shared-blunder relief", () => {
  const cs: CrowdScoring = { ...CROWD_SCORING, sharedMin: 3, sharedShare: 0.25, sharedK: 1, sharedFloor: 0.4, sharedFrom: 5 };
  it("needs sharedMin pickers or sharedShare of the group, and a losing pick", () => {
    expect(sharedFactor(cs, 20, 2, 50)).toBe(1);
    expect(sharedFactor(cs, 20, 3, 50)).toBeCloseTo(1 - 3 / 50, 9);
    // 2 of 4 is half the group.
    expect(sharedFactor(cs, 20, 2, 4)).toBeCloseTo(0.5, 9);
    expect(sharedFactor(cs, 4.9, 30, 50)).toBe(1);
    // Never below the floor.
    expect(sharedFactor(cs, 20, 45, 50)).toBe(cs.sharedFloor);
  });

  it("a blunder many made costs each of them less than the same blunder made alone", () => {
    const S2: Settings = { ...S, crowdScoring: { ...cs, cap: [null], capFrom: [0] } };
    const alone = scoreGroup(picksOf([...Array(19).fill("best"), "bad"]), evalOf({ bad: 30 }), rng, S2, "popular", undefined, ctx(0));
    const many = scoreGroup(picksOf([...Array(10).fill("best"), ...Array(10).fill("bad")]), evalOf({ bad: 30 }), rng, S2, "popular", undefined, ctx(0));
    expect(score(many, "p19")).toBeGreaterThan(score(alone, "p19"));
    const p = many.players.find((x) => x.playerId === "p19")!;
    expect(p.shared).toBeCloseTo(30 * 0.5, 9);
    // Today's averaging alone: 30 - 15 = -15; with the relief the loss counts 15, the average 7.5: -7.5.
    expect(p.roundScore).toBeCloseTo(-7.5, 2);
  });
});

describe("streaks", () => {
  it("count from streakFromMove picked moves on the usual start, from the first in Random opening and Freestyle", () => {
    expect(streakCounts(CS, "normal", CS.streakFromMove - 1, 0)).toBe(false);
    expect(streakCounts(CS, "normal", CS.streakFromMove, 0)).toBe(true);
    expect(streakCounts(CS, undefined, 1, 0)).toBe(false);
    expect(streakCounts(CS, "random", 1, 0)).toBe(true);
    expect(streakCounts(CS, "freestyle", 1, 0)).toBe(true);
    // (The sim's variant: only from the first cut.)
    expect(streakCounts({ ...CS, streakFromCut: true }, "random", 9, 0)).toBe(false);
    expect(streakCounts({ ...CS, streakFromCut: true }, "random", 11, 1)).toBe(true);
  });

  it("the ramp: nothing below streakFrom, then the bonus list, its last entry from then on", () => {
    for (let n = 0; n < CS.streakFrom; n++) expect(streakBonusAt(CS, n)).toBe(0);
    CS.streakBonus.forEach((b, i) => expect(streakBonusAt(CS, CS.streakFrom + i)).toBe(b));
    expect(streakBonusAt(CS, CS.streakFrom + 40)).toBe(CS.streakBonus[CS.streakBonus.length - 1]);
    for (let n = CS.streakFrom; n < 20; n++) expect(streakBonusAt(CS, n + 1)).toBeGreaterThanOrEqual(streakBonusAt(CS, n));
  });

  it("a strong move adds one; any other pick or a miss ends it; frozen while streaks don't count", () => {
    const strong = CS.streakStrong;
    const e = evalOf({ near: strong, far: strong + 5 });
    const r = scoreGroup(picksOf(["best", "near", "far", null]), e, rng, S, "popular", undefined, ctx(0, true, () => 4));
    expect(r.players.map((p) => p.streak)).toEqual([5, 5, 0, 0]);
    expect(r.players[0]!.streakBonus).toBe(streakBonusAt(CS, 5));
    expect(r.players[2]!.streakBonus).toBeUndefined();
    const frozen = scoreGroup(picksOf(["best", "far"]), e, rng, S, "popular", undefined, ctx(0, false, () => 4));
    expect(frozen.players.map((p) => p.streak)).toEqual([4, 4]);
    expect(frozen.players[0]!.streakBonus).toBeUndefined();
  });

  it("strong is the raw loss, not what the opening allowance left of it", () => {
    const e = evalOf({ meh: 6 });
    const r = scoreGroup(picksOf(["meh", "best"]), e, rng, S, "popular", () => ({ points: 8 }), ctx(0, true, () => 2));
    expect(r.players[0]!.streak).toBe(0);
    expect(r.players[1]!.streak).toBe(3);
  });

  it("the bonus is added after the cap, and the standings keep the streak and its points", () => {
    const e = evalOf({ bad: 30 });
    const picks = picksOf([...Array(9).fill("best"), "bad"]);
    const r = scoreGroup(picks, e, rng, S, "popular", undefined, ctx(0, true, () => 2));
    const cap0 = capFor(CS, 0)!;
    expect(score(r, "p0")).toBe(round2(softCap(3, cap0, CS.capCurve) + streakBonusAt(CS, 3)));
    // (Past the cap itself: the bonus isn't squeezed.)
    const tanh: Settings = { ...S, crowdScoring: { ...CS, capCurve: "tanh" } };
    expect(score(scoreGroup(picks, e, rng, tanh, "popular", undefined, ctx(0, true, () => 2)), "p0")).toBeGreaterThan(cap0);
    let state: MatchState = createMatch(picks.map((p) => ({ id: p.playerId, name: p.playerId, isBot: true })), [0], S);
    state = applyRound(state, new Map([[0, picks.map((p) => p.playerId)]]), outcomesFromGroup(r, {}), S);
    expect(state.players[0]!.streak).toBe(3);
    expect(state.players[0]!.streakPoints).toBe(streakBonusAt(CS, 3));
    expect(state.players[9]!.streak).toBe(0);
    expect(state.players[9]!.streakPoints).toBeUndefined();
  });
});

describe("a miss", () => {
  it("scores missCaps times the stage's cap below zero, and missedMoveScore with no cap", () => {
    const r = scoreGroup(picksOf(["best", null]), evalOf({}), rng, S, "popular", undefined, ctx(0));
    expect(score(r, "p1")).toBe(round2(-CS.missCaps * capFor(CS, 0)!));
    const S2: Settings = { ...S, crowdScoring: { ...CS, cap: [null], capFrom: [0] } };
    expect(score(scoreGroup(picksOf(["best", null]), evalOf({}), rng, S2, "popular", undefined, ctx(0)), "p1")).toBe(S.missedMoveScore);
  });
});

describe("brilliant finds", () => {
  /** n pickers, `found` of them on the only good move, the rest giving away `gap` points (brilliantMinGap's 5 more). */
  const field = (n: number, found: number, usedPowerUp: readonly number[] = [], gap = CS.brilliantMinGap + 5) => {
    const r = scoreGroup(picksOf(Array.from({ length: n }, (_, i) => (i < found ? "best" : "bad"))), evalOf({ bad: gap }), rng, S, "popular", undefined, ctx(0));
    for (const i of usedPowerUp) r.players[i]!.usedPowerUp = true;
    return r;
  };

  it("a bonus and a shoutout when 3 or fewer found it", () => {
    for (const found of [1, 2, 3]) {
      const r = field(50, found);
      const before = r.players.map((p) => p.roundScore);
      crowdBrilliant(r, S);
      expect(r.brilliant?.players.length).toBe(found);
      for (let i = 0; i < found; i++) {
        expect(r.players[i]!.roundScore).toBe(round2(before[i]! + CS.brilliantBonus));
        expect(r.players[i]!.brilliantBonus).toBe(CS.brilliantBonus);
      }
      expect(r.players[found]!.roundScore).toBe(before[found]);
    }
    // The rest gave away less than brilliantMinGap: brilliant by brilliance's own bar, but no shoutout.
    expect(crowdBrilliant(field(50, 1, [], CS.brilliantMinGap - 5), S).brilliant).toBeUndefined();
    // 4 found it among 50: brilliant, but not rare.
    const four = crowdBrilliant(field(50, 4), S);
    expect(four.brilliant).toBeUndefined();
    expect(four.players[0]!.brilliantBonus).toBeUndefined();
  });

  it("exactly 1 when 10 or fewer picked", () => {
    expect(crowdBrilliant(field(10, 1), S).brilliant?.players).toEqual(["p0"]);
    expect(crowdBrilliant(field(10, 2), S).brilliant).toBeUndefined();
  });

  it("never for a power-up's pick, never changes the move played, and off in other modes", () => {
    const r = field(50, 1, [0]);
    const played = r.playedMove;
    crowdBrilliant(r, S);
    expect(r.brilliant).toBeUndefined();
    expect(r.playedMove).toBe(played);
    expect(crowdBrilliant(field(50, 1), { ...S, crowdScoring: undefined }).brilliant).toBeUndefined();
  });

  it("the test switch names the given players", () => {
    const r = crowdBrilliant(field(50, 30), S, ["p40"]);
    expect(r.brilliant).toEqual({ moves: ["bad"], players: ["p40"] });
  });
});

describe("the bubble grace at the cut", () => {
  /** A 50 v 50 match at stage 1, each team's players with these scores. */
  function teams(w: readonly number[], b: readonly number[], settings: Settings): MatchState {
    const rows = [...w.map((s) => ({ s, c: "w" as const })), ...b.map((s) => ({ s, c: "b" as const }))];
    const state = createMatch(rows.map((_, i) => ({ id: `p${i}`, name: `P${i}`, isBot: true })), [0], settings);
    return { ...state, stage: 1, players: state.players.map((p, i): PlayerState => ({ ...p, stageScore: rows[i]!.s, colour: rows[i]!.c, lossesByStage: [[], []] })) };
  }
  const K: Settings = { ...S, knockoutsPerStage: [2, 2, 2, 2] };

  it("players within cutGrace of the last one through go through; what that leaves carries", () => {
    const g = CS.cutGrace;
    // One out of each team. White's bottom is cutGrace below the last one through (1.00): saved, and owed later.
    const saved = teams([3, 2, 1, round2(1 - g)], [3, 2, 1, 0], K);
    const plan = cutPlan(saved, standings(saved, mulberry32(1), K), K);
    expect(plan.out).toEqual(["p7"]);
    expect(plan.carry).toEqual({ w: 1 });
    expect(endStage(saved, mulberry32(1), [0], K).state.cutCarry).toEqual({ w: 1 });
    // A hundredth more and it goes.
    const out = teams([3, 2, 1, round2(1 - g - 0.01)], [3, 2, 1, 0], K);
    expect(cutPlan(out, standings(out, mulberry32(1), K), K).out.sort()).toEqual(["p3", "p7"]);
  });

  it("not at the last cut before the ending, and not without crowdScoring", () => {
    const g = CS.cutGrace;
    const last: Settings = { ...S, knockoutsPerStage: [2, 2] };
    const state = teams([3, 2, 1, round2(1 - g / 2)], [3, 2, 1, 0], last);
    expect(cutPlan(state, standings(state, mulberry32(1), last), last).out).toContain("p3");
    const none: Settings = { ...K, crowdScoring: undefined };
    const s2 = teams([3, 2, 1, round2(1 - g / 2)], [3, 2, 1, 0], none);
    expect(cutPlan(s2, standings(s2, mulberry32(1), none), none).out).toContain("p3");
  });
});
