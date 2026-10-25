import { describe, expect, it } from "vitest";
import {
  BOSS_ALONE_SCORING,
  CROWD_SCORING,
  CROWD_SETTINGS,
  DEFAULT_SETTINGS,
  RAID_SCORING,
  RAID_SETTINGS,
  applyRound,
  bossKill,
  bossKillDue,
  capFor,
  createMatch,
  mulberry32,
  outcomesFromGroup,
  round2,
  scoreGroup,
  softCap,
  standingPoints,
  strikeVictim,
  type GroupEvaluation,
  type MatchState,
  type ScoreContext,
  type Settings,
} from "../src/index.ts";

// docs/decisions/2026-10-25-raid-scoring.md: raids score with 50 v 50's math, the cap widening by the crowd's move; the
// boss's strike still goes by the points given away; Boss alone scores as before.

const R: Settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS };
const RS = R.crowdScoring!;
const rng = () => 0.5;

/** A group's evaluation from each move's loss in points (the best move "best" at 0). */
function evalOf(losses: Record<string, number>): GroupEvaluation {
  return { bestMove: "best", bestExpected: 0.6, expectedAfter: Object.fromEntries(Object.entries({ best: 0, ...losses }).map(([m, l]) => [m, 0.6 - l / 100])) };
}
const picksOf = (moves: readonly (string | null)[]) => moves.map((move, i) => ({ playerId: `p${i}`, move }));
const ctx = (move: number, streaks = false, streakOf?: (id: string) => number): ScoreContext => ({ stage: 0, move, streaks, ...(streakOf ? { streakOf } : {}) });
const score = (r: ReturnType<typeof scoreGroup>, id: string) => r.players.find((p) => p.playerId === id)!.roundScore;

describe("raids score with 50 v 50's math; Boss alone as before", () => {
  it("a raid (online and Solo) has RAID_SCORING: 50 v 50's numbers, the cap by crowd move, no bubble", () => {
    expect(RAID_SETTINGS.crowdScoring).toBe(RAID_SCORING);
    const { capFromMove, cutGrace, streakMinAverage, ...rest } = RAID_SCORING;
    const { capFromMove: _c, cutGrace: _g, streakMinAverage: _s, ...crowd } = CROWD_SCORING;
    expect(rest).toEqual(crowd);
    expect(capFromMove).toHaveLength(RAID_SCORING.cap.length);
    expect(cutGrace).toBe(0);
    expect(streakMinAverage).toBeGreaterThan(0);
    // 50 v 50 is untouched: by stage.
    expect(CROWD_SETTINGS.crowdScoring).toBe(CROWD_SCORING);
    expect(CROWD_SCORING.capFromMove).toBeUndefined();
  });

  it("Boss alone scores as before (no crowd scoring)", () => {
    expect({ ...R, ...BOSS_ALONE_SCORING }.crowdScoring).toBeUndefined();
    const alone = { ...R, ...BOSS_ALONE_SCORING };
    const r = scoreGroup(picksOf(["a"]), evalOf({ a: 10 }), rng, alone, "popular", undefined, ctx(1));
    expect(score(r, "p0")).toBe(0);
    expect(scoreGroup(picksOf([null]), evalOf({}), rng, alone, "popular", undefined, ctx(1)).players[0]!.roundScore).toBe(alone.missedMoveScore);
  });
});

describe("a raid's cap widens by the crowd's move", () => {
  it("cap[i] from crowd move capFromMove[i]; the stage plays no part", () => {
    const from = RS.capFromMove!;
    expect(capFor(RS, 0, 1)).toBe(RS.cap[0]);
    from.forEach((m, i) => {
      expect(capFor(RS, 0, m)).toBe(RS.cap[i]);
      if (m > 1) expect(capFor(RS, 0, m - 1)).toBe(RS.cap[i - 1]);
      // (A raid's stage never moves; were it to, the move still decides.)
      expect(capFor(RS, 7, m)).toBe(RS.cap[i]);
    });
    // Tight early, looser later.
    const caps = [1, 10, 11, 15, 19, 40].map((m) => capFor(RS, 0, m)!);
    for (let i = 1; i < caps.length; i++) expect(caps[i]!).toBeGreaterThanOrEqual(caps[i - 1]!);
    expect(caps[0]).toBe(2);
    expect(caps.at(-1)).toBe(8);
    // 50 v 50's cap (no capFromMove) ignores the move: by stage, as before.
    expect(capFor(CROWD_SCORING, 0, 40)).toBe(CROWD_SCORING.cap[0]);
  });

  it("scores a move under the cap of its crowd move; a piece hung stays whole; a miss is 2 caps", () => {
    // p4 loses 30 (not material): about -2 early, wider late. p5 hangs a piece: its whole score. (6 pickers: one each
    // is too few for the shared relief.)
    const picks = picksOf(["best", "best", "best", "best", "a", "b"]);
    const allowance = (m: string) => (m === "b" ? { points: 0, uncap: "gave" as const } : { points: 0 });
    const ev = evalOf({ a: 30, b: 45 });
    for (const move of [1, 12, 16, 25]) {
      const r = scoreGroup(picks, ev, rng, R, "popular", allowance, ctx(move));
      const avg = (30 + 45) / 6;
      const cap = capFor(RS, 0, move);
      expect(score(r, "p4")).toBe(round2(softCap(avg - 30, cap, RS.capCurve)));
      expect(score(r, "p5")).toBe(round2(avg - 45));
      expect(score(r, "p0")).toBe(round2(softCap(avg, cap, RS.capCurve)));
    }
    const early = scoreGroup(picks, ev, rng, R, "popular", allowance, ctx(3));
    const late = scoreGroup(picks, ev, rng, R, "popular", allowance, ctx(30));
    expect(score(early, "p4")).toBeGreaterThan(score(late, "p4"));
    expect(Math.abs(score(early, "p0"))).toBeLessThan(2);
    const miss = (move: number) => scoreGroup(picksOf(["best", null]), evalOf({}), rng, R, "popular", undefined, ctx(move)).players[1]!.roundScore;
    expect(miss(1)).toBe(-RS.missCaps * 2);
    expect(miss(30)).toBe(-RS.missCaps * 8);
  });

  it("a move that plays itself (the crowd gave away less than streakMinAverage on average) neither builds nor ends a streak", () => {
    const min = RS.streakMinAverage!;
    // Every pick within a hair of the best (a decided game): the streak holds at 4, no bonus.
    const dead = scoreGroup(picksOf(["best", "a"]), evalOf({ a: min / 2 }), rng, R, "popular", undefined, ctx(20, true, () => 4));
    expect(dead.players.map((p) => [p.streak, p.streakBonus ?? 0])).toEqual([
      [4, 0],
      [4, 0],
    ]);
    // Something to find: the strong pick goes on (5 in a row), the weak one ends it.
    const live = scoreGroup(picksOf(["best", "a"]), evalOf({ a: 3 * min + RS.streakStrong }), rng, R, "popular", undefined, ctx(20, true, () => 4));
    expect(live.players[0]!.streak).toBe(5);
    expect(live.players[0]!.streakBonus).toBeGreaterThan(0);
    expect(live.players[1]!.streak).toBe(0);
    // 50 v 50 (no streakMinAverage): every move counts, as before.
    const crowd = { ...R, crowdScoring: CROWD_SCORING };
    expect(scoreGroup(picksOf(["best", "a"]), evalOf({ a: min / 2 }), rng, crowd, "popular", undefined, ctx(20, true, () => 4)).players[0]!.streak).toBe(5);
  });
});

describe("a raid's strike: still the player who gave away the most, its tie-break explicit", () => {
  /** A raid of `n` mid-battle, everyone in, the strike due. */
  function raid(n: number): MatchState {
    const state = createMatch(Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, isBot: false })), [0], R);
    return { ...state, boss: { elo: 1500, crowdSide: "w", crowdMoves: 3, sinceKill: 0, kills: [], minSurvivors: 1 } };
  }
  /** Plays rounds (each: the picks' losses, in points, by player) through scoreGroup and applyRound, as the runner does. */
  function play(state: MatchState, rounds: number[][]): MatchState {
    for (const losses of rounds) {
      const moves = losses.map((_, i) => `m${i}`);
      const r = scoreGroup(picksOf(moves), evalOf(Object.fromEntries(moves.map((m, i) => [m, losses[i]!]))), rng, R, "popular", undefined, ctx(state.boss!.crowdMoves + 1));
      state = applyRound(state, new Map([[0, state.players.map((p) => p.id)]]), outcomesFromGroup(r, {}), R);
    }
    return state;
  }

  it("goes by the points given away since its last strike, not the capped round points", () => {
    // p1 one big positional slip (30), p2 three middling ones (9 each): the cap puts p2 lowest on the scoreboard, but p1
    // gave away the most (30 against 27), and the boss strikes p1.
    const s = play(raid(4), [
      [0, 30, 9, 0],
      [0, 0, 9, 0],
      [0, 0, 9, 0],
    ]);
    const pts = s.players.map((p) => standingPoints(p, R));
    expect(pts[2]!).toBeLessThan(pts[1]!);
    expect(bossKillDue(s, R)).toBe(true);
    expect(strikeVictim(s, R)).toBe("p1");
    expect(bossKill(s, mulberry32(1), R).victim).toBe("p1");
  });

  it("a tie on the window goes against the worse match; tied on both, nobody: it waits a move", () => {
    // p1 and p2 both gave away 12 over the window; p2 also gave away more before it: p2.
    let s = play(raid(3), [[0, 0, 6]]);
    s = { ...s, boss: { ...s.boss!, sinceKill: 0 } };
    s = play(s, [
      [0, 6, 3],
      [0, 6, 9],
      [0, 0, 0],
    ]);
    expect(strikeVictim(s, R)).toBe("p2");
    // Tied on both: no coin flip.
    const tied = play(raid(3), [
      [0, 8, 8],
      [0, 4, 4],
      [0, 0, 0],
    ]);
    expect(strikeVictim(tied, R)).toBeNull();
    expect(bossKillDue(tied, R)).toBe(false);
    // One more move, one of them gives something away: the strike lands on them.
    const next = play(tied, [[0, 0, 2]]);
    expect(strikeVictim(next, R)).toBe("p2");
  });
});
