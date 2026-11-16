import { describe, expect, it } from "vitest";
import {
  CROWD_CUTS,
  CROWD_PRE_REWORK,
  CROWD_REWORK,
  CROWD_SCORING,
  CROWD_SETTINGS,
  DEFAULT_SETTINGS,
  RAID_SETTINGS,
  alivePlayers,
  applyRound,
  bestPlayer,
  createMatch,
  crowdCutKnockouts,
  crowdLimitReached,
  crowdLimitVerdict,
  crowdPickOdds,
  crowdPodium,
  cutPlan,
  drawMove,
  endStage,
  finishGame,
  isFinal,
  isLastCut,
  mulberry32,
  roundsInStage,
  scoreGroup,
  shuffle,
  standings,
  type GroupEvaluation,
  type MatchState,
  type PlayerState,
  type Settings,
  type Side,
} from "../src/index.ts";

// The 50 v 50 rework in core (Eric, Nov 16; notes/designs/crowd-rework.md, step C1; docs/decisions/2026-11-16-crowd-rework-core.md):
// the pick modes, the cuts to a 1 v 1, the soft reset, the move limit, the places, the winner and the best player. Every
// 50 v 50's since C2 spread CROWD_REWORK into CROWD_SETTINGS (the runner's side: packages/chess/test/crowd.test.ts).
const REWORK: Settings = { ...DEFAULT_SETTINGS, ...CROWD_SETTINGS, ...CROWD_REWORK };

/** Picks as the draw sees them: one entry per pick. */
const picks = (counts: Record<string, number>) => Object.entries(counts).flatMap(([m, n]) => Array<string>(n).fill(m));
/** The judge's numbers for these moves: the best at 0.6, each move its loss (points) below it. */
const judged = (losses: Record<string, number>): GroupEvaluation => {
  const best = Object.entries(losses).sort((a, b) => a[1] - b[1])[0]![0];
  return { bestMove: best, bestExpected: 0.6, expectedAfter: Object.fromEntries(Object.entries(losses).map(([m, l]) => [m, 0.6 - l / 100])) };
};
/** How often each move is played over many seeds. */
function played(moves: readonly string[], losses: Record<string, number>, settings: Settings, n = 3000): Map<string, number> {
  const seen = new Map<string, number>();
  for (let seed = 1; seed <= n; seed++) {
    const m = drawMove(moves, losses, "popular", mulberry32(seed), settings);
    seen.set(m, (seen.get(m) ?? 0) + 1);
  }
  return seen;
}

describe("how moves are picked (crowdPick)", () => {
  const strong: Settings = { ...REWORK, crowdPick: "strong" };
  const majority: Settings = { ...REWORK, crowdPick: "majority" };
  const chaos: Settings = { ...REWORK, crowdPick: "chaos" };

  it("Strong: the judge's best of the team's 3 most-picked; a 4th never, even the engine's best", () => {
    // d is the engine's best, but 4th by picks: out. Of a, b, c the best is c, and a and b are more than 3 points worse.
    expect(crowdPickOdds("strong", picks({ a: 30, b: 12, c: 6, d: 4 }), { a: 8, b: 20, c: 0.5, d: 0 })).toEqual({ c: 1 });
    // The best of the three is played even when the fewest of them picked it.
    expect(crowdPickOdds("strong", picks({ a: 30, b: 10, c: 2 }), { a: 8, b: 20, c: 0 })).toEqual({ c: 1 });
  });

  it("Strong: any within 3% expected score (3 points) of the best is close, and the close ones are drawn at equal odds", () => {
    expect(crowdPickOdds("strong", picks({ a: 20, b: 15, c: 10 }), { a: 10, b: 0, c: 2 })).toEqual({ b: 0.5, c: 0.5 });
    // Exactly 3 is close; a little over isn't.
    expect(crowdPickOdds("strong", picks({ a: 5, b: 4 }), { a: 0, b: 3 })).toEqual({ a: 0.5, b: 0.5 });
    expect(crowdPickOdds("strong", picks({ a: 5, b: 4 }), { a: 0, b: 3.1 })).toEqual({ a: 1 });
    const seen = played(picks({ a: 20, b: 15, c: 10, d: 1 }), { a: 1, b: 0, c: 2.5, d: 0 }, strong);
    expect(seen.has("d")).toBe(false);
    for (const m of ["a", "b", "c"]) expect(seen.get(m)! / 3000).toBeCloseTo(1 / 3, 1);
  });

  it("Strong: a tie for 3rd goes to the better-scored", () => {
    // c and d both have 5 picks: d gives away less, so it's 3rd; then a (2) is within 3 of d (1), b (9) isn't.
    expect(crowdPickOdds("strong", picks({ a: 20, b: 15, c: 5, d: 5 }), { a: 2, b: 9, c: 20, d: 1 })).toEqual({ d: 0.5, a: 0.5 });
  });

  it("Majority: the most-picked; a tie drawn evenly among the tied, whatever the judge says", () => {
    expect(crowdPickOdds("majority", picks({ a: 11, b: 10, c: 3 }), { a: 40, b: 0, c: 0 })).toEqual({ a: 1 });
    expect(crowdPickOdds("majority", picks({ a: 10, b: 10, c: 3 }), { a: 40, b: 0, c: 0 })).toEqual({ a: 0.5, b: 0.5 });
    const seen = played(picks({ a: 10, b: 10, c: 3 }), { a: 40, b: 0, c: 0 }, majority);
    expect(seen.has("c")).toBe(false);
    expect(seen.get("a")! / 3000).toBeCloseTo(0.5, 1);
  });

  it("Chaos: every move the team picked equally likely, one pick or forty", () => {
    expect(crowdPickOdds("chaos", picks({ a: 40, b: 1, c: 9 }), { a: 0, b: 50, c: 3 })).toEqual({ a: 1 / 3, b: 1 / 3, c: 1 / 3 });
    const seen = played(picks({ a: 40, b: 1, c: 9 }), { a: 0, b: 50, c: 3 }, chaos);
    for (const m of ["a", "b", "c"]) expect(seen.get(m)! / 3000).toBeCloseTo(1 / 3, 1);
  });

  it("the same seed draws the same move on every device", () => {
    const moves = picks({ a: 20, b: 15, c: 10 });
    const losses = { a: 1, b: 0, c: 2 };
    for (const s of [strong, majority, chaos]) expect(drawMove(moves, losses, "popular", mulberry32(9), s)).toBe(drawMove(moves, losses, "popular", mulberry32(9), s));
  });

  it("a miss's pick made for it never counts; nobody picked leaves the move to the runner (the engine's top 5)", () => {
    // Three real picks (a, a, b) and five misses: the tally is the three.
    const group = [...["a", "a", "b"].map((m, i) => ({ playerId: `p${i}`, move: m })), ...Array.from({ length: 5 }, (_, i) => ({ playerId: `m${i}`, move: null }))];
    const r = scoreGroup(group, judged({ a: 5, b: 0, c: 1 }), mulberry32(1), majority, "popular");
    expect(r.drawOdds).toEqual({ a: 1 });
    expect(r.playedMove).toBe("a");
    const none = scoreGroup(
      group.map((p) => ({ ...p, move: null })),
      judged({ a: 5, b: 0 }),
      mulberry32(1),
      strong,
      "popular",
    );
    expect(none.drawOdds).toEqual({});
  });

  it("the reveal's odds are the mode's (scoreGroup's drawOdds)", () => {
    const group = ["a", "a", "a", "b", "b", "c"].map((m, i) => ({ playerId: `p${i}`, move: m }));
    expect(scoreGroup(group, judged({ a: 4, b: 0, c: 2 }), mulberry32(1), strong, "popular").drawOdds).toEqual({ b: 0.5, c: 0.5 });
    expect(scoreGroup(group, judged({ a: 4, b: 0, c: 2 }), mulberry32(1), chaos, "popular").drawOdds).toEqual({ a: 1 / 3, b: 1 / 3, c: 1 / 3 });
  });
});

/** 100 players, 50 a side (p0-p49 White, p50-p99 Black). */
function lobby(settings: Settings = REWORK, n = 100): MatchState {
  const s = createMatch(
    Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, isBot: true })),
    [0],
    settings,
  );
  return { ...s, players: s.players.map((p, i) => ({ ...p, colour: (i < n / 2 ? "w" : "b") as Side })) };
}

/** One round for everyone still in: their scores come out distinct, in a shuffled order (no ties at a line), and a counted loss each. */
function round(state: MatchState, seed: number, settings: Settings = REWORK): MatchState {
  const alive = alivePlayers(state);
  const order = shuffle(mulberry32(seed), alive);
  const outcomes = order.map((p, k) => ({ playerId: p.id, roundScore: k - order.length / 2 - p.stageScore, loss: k % 7, thinkMs: 1000 }));
  return applyRound(state, new Map(), outcomes, settings);
}

const side = (state: MatchState, c: Side) => alivePlayers(state).filter((p) => p.colour === c).length;

describe("the cuts, equal from each side, down to a 1 v 1 (CROWD_CUTS)", () => {
  it("after moves 14, 18, 22, 26, 30, 33, 39 and 42, leaving 34, 23, 15, 10, 6, 4, 2 and 1 a side", () => {
    expect(CROWD_CUTS.map((c) => c.after)).toEqual([14, 18, 22, 26, 30, 33, 39, 42]);
    expect(CROWD_CUTS.map((c) => c.keep)).toEqual([34, 23, 15, 10, 6, 4, 2, 1]);
    expect(crowdCutKnockouts(CROWD_CUTS)).toEqual([32, 22, 16, 10, 8, 4, 4, 2]);
    expect(REWORK.knockoutsPerStage).toEqual(crowdCutKnockouts(CROWD_CUTS));
  });

  it("each stage's plies run to its cut's move by the game's move number, then the 1 v 1 to move 60", () => {
    const plies = Array.from({ length: 9 }, (_, i) => roundsInStage(REWORK, i));
    expect(plies).toEqual([28, 8, 8, 8, 8, 6, 12, 6, 36]);
    // Moves 1-14, 15-18, ... 34-39 (the 4 v 4's 6), 40-42, then 43-60 (the 1 v 1's up to 18).
    let done = 0;
    expect(plies.map((p) => (done += p) / 2)).toEqual([14, 18, 22, 26, 30, 33, 39, 42, 60]);
    // A Random opening (4 moves a side in, so the game starts at move 5): the first cut still comes after move 14.
    expect(roundsInStage({ ...REWORK, openingMoves: 4 }, 0)).toBe(20);
    expect(roundsInStage({ ...REWORK, openingMoves: 4 }, 1)).toBe(8);
    // A test's ?rounds=N (stageRounds emptied): every stage N, as before.
    expect(roundsInStage({ ...REWORK, stageRounds: [], firstStageRounds: 2, roundsPerStage: 2 }, 0)).toBe(2);
  });

  it("a whole match: each cut takes the same from each side, to 1 v 1; never a final; nobody is cut in the 1 v 1", () => {
    let state = lobby();
    const sizes: number[] = [];
    for (let stage = 0; stage < CROWD_CUTS.length; stage++) {
      expect(isFinal(state, REWORK)).toBe(false);
      expect(isLastCut(state, REWORK)).toBe(stage === CROWD_CUTS.length - 1);
      state = round(state, 100 + stage);
      state = endStage(state, mulberry32(stage), [0], REWORK).state;
      expect(side(state, "w")).toBe(side(state, "b"));
      sizes.push(side(state, "w"));
    }
    expect(sizes).toEqual([34, 23, 15, 10, 6, 4, 2, 1]);
    // The 1 v 1: an ordinary stage, one player a side; no final, and no cut.
    expect(state.stage).toBe(8);
    expect(state.final).toBeUndefined();
    expect(isFinal(state, REWORK)).toBe(false);
    expect(cutPlan(state, standings(state, () => 0.5, REWORK), REWORK).out).toEqual([]);
  });

  it("every 50 v 50 has the rework since C2 (CROWD_SETTINGS); the 50 v 50 before it only with CROWD_PRE_REWORK (the old endings' tests)", () => {
    const today: Settings = { ...DEFAULT_SETTINGS, ...CROWD_SETTINGS };
    expect(today).toMatchObject(CROWD_REWORK);
    expect(today.crowdCuts).toBe(CROWD_CUTS);
    expect(today.crowdPick).toBe("strong");
    expect(today.crowdCarry).toBe(0.5);
    expect(today.crowdMoveLimit).toBe(60);
    expect(today.knockoutsPerStage).toEqual(crowdCutKnockouts(CROWD_CUTS));
    expect(roundsInStage(today, 0)).toBe(28);
    const before: Settings = { ...today, ...CROWD_PRE_REWORK };
    expect(before.crowdCuts).toBeUndefined();
    expect(before.crowdPick).toBeUndefined();
    expect(before.crowdCarry).toBeUndefined();
    expect(roundsInStage(before, 0)).toBe(20);
    // Raids never take it, even once CROWD_SETTINGS has it.
    const raid: Settings = { ...DEFAULT_SETTINGS, ...CROWD_SETTINGS, ...CROWD_REWORK, ...RAID_SETTINGS };
    for (const k of ["crowdPick", "crowdCuts", "crowdCarry", "crowdMoveLimit", "crowdLimitWin"] as const) expect(raid[k]).toBeUndefined();
  });
});

describe("the soft reset: each survivor keeps 50% at a cut (crowdCarry)", () => {
  it("survivors' scores halve, to 2 decimals; those cut keep their score at the cut; streaks are untouched", () => {
    const base = lobby();
    const scores = (i: number) => (i % 50) / 10 - 1.25;
    const state: MatchState = {
      ...base,
      players: base.players.map((p, i) => ({ ...p, stageScore: scores(i), streak: i % 5, streakPoints: 0.25 })),
    };
    const end = endStage(state, mulberry32(1), [0], REWORK);
    for (const p of end.state.players) {
      const i = Number(p.id.slice(1));
      if (p.alive) expect(p.stageScore).toBe(Math.round(scores(i) * 50) / 100);
      else expect(p.stageScore).toBe(scores(i));
      expect(p.streak).toBe(i % 5);
      expect(p.streakPoints).toBe(0.25);
    }
    // 1.25 keeps 0.63 (2 decimals), as the screens show it.
    expect(end.state.players.find((p) => p.alive && p.stageScore === 0.63)).toBeTruthy();
    // Without crowdCarry (the 50 v 50 before the rework), scores carry whole.
    const today: Settings = { ...REWORK, crowdCarry: undefined };
    for (const p of endStage(state, mulberry32(1), [0], today).state.players.filter((x) => x.alive)) expect(p.stageScore).toBe(scores(Number(p.id.slice(1))));
  });

  it("the round's play adds to what was kept", () => {
    let state = lobby();
    state = { ...state, players: state.players.map((p, i) => ({ ...p, stageScore: i < 50 ? 50 - i : 100 - i })) };
    state = endStage(state, mulberry32(1), [0], REWORK).state;
    const top = state.players.find((p) => p.id === "p0")!;
    expect(top.stageScore).toBe(25);
    state = applyRound(state, new Map(), [{ playerId: "p0", roundScore: 1.5, loss: 0, thinkMs: 0 }], REWORK);
    expect(state.players.find((p) => p.id === "p0")!.stageScore).toBe(26.5);
  });
});

describe("rounds of 2 and 1 a side", () => {
  const scoring = { stage: 6, streaks: false };

  it("2 a side: a round score is half the difference (then the soft cap); Strong plays the better unless they're close", () => {
    const group = [
      { playerId: "a", move: "e2e4" },
      { playerId: "b", move: "a2a3" },
    ];
    const ev = judged({ e2e4: 0, a2a3: 6 });
    const plain = scoreGroup(group, ev, mulberry32(1), { ...REWORK, crowdScoring: undefined }, "popular");
    expect(plain.players[0]!.roundScore).toBeCloseTo(3, 9);
    expect(plain.players[1]!.roundScore).toBeCloseTo(-3, 9);
    // 50 v 50's scoring at that stage: no shared-blunder relief with 4 or fewer picks (the director's call in C2,
    // sharedMinPicks 5: a lone pick of two isn't a crowd's shared blunder); then the cap (8, the ratio curve): 3 / (1 + 3/8).
    const crowd = scoreGroup(group, ev, mulberry32(1), REWORK, "popular", undefined, scoring);
    expect(CROWD_SCORING.sharedShare).toBe(0.25);
    expect(CROWD_SCORING.sharedMinPicks).toBe(5);
    expect(CROWD_SCORING.capCurve).toBe("ratio");
    expect(crowd.players.map((p) => p.roundScore)).toEqual([2.18, -2.18]);
    // With the relief at any size (C1's numbers), one pick of two counted as shared: the 6 as 3, then 1.5 / (1 + 1.5/8).
    const shared = scoreGroup(group, ev, mulberry32(1), { ...REWORK, crowdScoring: { ...CROWD_SCORING, sharedMinPicks: undefined } }, "popular", undefined, scoring);
    expect(shared.players.map((p) => p.roundScore)).toEqual([1.26, -1.26]);
    expect(crowd.drawOdds).toEqual({ e2e4: 1 });
    // A 1-1 split within 3 points: either, at equal odds (Majority: any 1-1 split is a tie).
    expect(scoreGroup(group, judged({ e2e4: 0, a2a3: 2 }), mulberry32(1), REWORK, "popular").drawOdds).toEqual({ e2e4: 0.5, a2a3: 0.5 });
    expect(scoreGroup(group, ev, mulberry32(1), { ...REWORK, crowdPick: "majority" }, "popular").drawOdds).toEqual({ a2a3: 0.5, e2e4: 0.5 });
  });

  it("the shared-blunder relief from 5 real picks (sharedMinPicks): 2 of 5 on a blunder count it less; 2 of 4 count it whole; misses don't add", () => {
    const ev = judged({ e2e4: 0, a2a3: 10 });
    const group = (moves: readonly (string | null)[]) => moves.map((move, i) => ({ playerId: `p${i}`, move }));
    const loss = (r: ReturnType<typeof scoreGroup>) => r.players.find((p) => p.move === "a2a3")!.shared ?? 10;
    // 2 of 5 is 40% of the picks: counted times 1 - 0.4.
    expect(loss(scoreGroup(group(["e2e4", "e2e4", "e2e4", "a2a3", "a2a3"]), ev, mulberry32(1), REWORK, "popular", undefined, scoring))).toBeCloseTo(6, 9);
    expect(loss(scoreGroup(group(["e2e4", "e2e4", "a2a3", "a2a3"]), ev, mulberry32(1), REWORK, "popular", undefined, scoring))).toBe(10);
    expect(loss(scoreGroup(group(["e2e4", "e2e4", "a2a3", "a2a3", null, null]), ev, mulberry32(1), REWORK, "popular", undefined, scoring))).toBe(10);
  });

  it("1 a side: the round score is always 0, and their pick is played in every mode, a blunder too", () => {
    const one = [{ playerId: "a", move: "g2g4" }];
    for (const mode of ["strong", "majority", "chaos"] as const) {
      const r = scoreGroup(one, judged({ e2e4: 0, g2g4: 40 }), mulberry32(3), { ...REWORK, crowdPick: mode }, "popular", undefined, scoring);
      expect(r.players[0]!.roundScore).toBe(0);
      expect(r.playedMove).toBe("g2g4");
    }
  });
});

describe("the end: places, the winner and the best player", () => {
  /** A match played to the 1 v 1, then the game's result. */
  function toTheEnd(winner: Side | null): MatchState {
    let state = lobby();
    for (let stage = 0; stage < CROWD_CUTS.length; stage++) state = endStage(round(state, 200 + stage), mulberry32(stage), [0], REWORK).state;
    return finishGame(state, mulberry32(99), winner, REWORK);
  }

  it("everyone gets one place, 1 to 100: the 1 v 1's winner 1st; each cut's players below the next cut's", () => {
    const end = toTheEnd("b");
    const places = end.players.map((p) => p.placement!).sort((a, b) => a - b);
    expect(places).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
    const first = end.players.find((p) => p.placement === 1)!;
    expect(first.colour).toBe("b");
    expect(first.outInStage).toBeNull();
    expect(end.players.find((p) => p.placement === 2)!.colour).toBe("w");
    // Each cut's players sit below every later cut's, both sides together: the last cut's (1 a side) are 3rd and 4th.
    const worst = (stage: number) => Math.max(...end.players.filter((p) => p.outInStage === stage).map((p) => p.placement!));
    const bestOf = (stage: number) => Math.min(...end.players.filter((p) => p.outInStage === stage).map((p) => p.placement!));
    for (let s = 1; s < CROWD_CUTS.length; s++) expect(worst(s)).toBeLessThan(bestOf(s - 1));
    expect(end.players.filter((p) => p.outInStage === 7).map((p) => p.placement).sort()).toEqual([3, 4]);
    expect(worst(0)).toBe(100);
  });

  it("within a cut, both sides together by their score at that cut", () => {
    const end = toTheEnd("w");
    for (let s = 0; s < CROWD_CUTS.length; s++) {
      const out = end.players.filter((p) => p.outInStage === s && p.placement! > 2).sort((a, b) => a.placement! - b.placement!);
      for (let i = 1; i < out.length; i++) expect(out[i - 1]!.stageScore).toBeGreaterThanOrEqual(out[i]!.stageScore);
      expect(new Set(out.map((p) => p.colour)).size).toBe(2);
    }
  });

  it("a drawn 1 v 1: the better score is 1st, an exact tie the fewer points given away a move", () => {
    const base = lobby({ ...REWORK }, 2);
    const state: MatchState = {
      ...base,
      stage: 8,
      players: base.players.map((p, i) => ({ ...p, stageScore: i === 0 ? 0.5 : 1.25, lossesByStage: [[3, 1]], countedLossSum: 4 })),
    };
    expect(finishGame(state, mulberry32(1), null, REWORK).players.find((p) => p.placement === 1)!.id).toBe("p1");
    // Won: the winner is 1st, whatever the score.
    expect(finishGame(state, mulberry32(1), "w", REWORK).players.find((p) => p.placement === 1)!.id).toBe("p0");
    const level: MatchState = { ...state, players: state.players.map((p, i) => ({ ...p, stageScore: 1, countedLossSum: i === 0 ? 2 : 6 })) };
    expect(finishGame(level, mulberry32(1), null, REWORK).players.find((p) => p.placement === 1)!.id).toBe("p0");
  });

  it("a game over before the 1 v 1: the winning side's players still in first, each side by score; drawn, both sides together", () => {
    let state = lobby();
    for (let stage = 0; stage < 3; stage++) state = endStage(round(state, 300 + stage), mulberry32(stage), [0], REWORK).state;
    expect(side(state, "w")).toBe(15);
    const won = finishGame(state, mulberry32(5), "w", REWORK);
    const top = won.players.filter((p) => p.placement! <= 30).sort((a, b) => a.placement! - b.placement!);
    expect(top.slice(0, 15).every((p) => p.colour === "w")).toBe(true);
    expect(top.slice(15).every((p) => p.colour === "b")).toBe(true);
    for (let i = 1; i < 15; i++) expect(top[i - 1]!.stageScore).toBeGreaterThanOrEqual(top[i]!.stageScore);
    const drawn = finishGame(state, mulberry32(5), null, REWORK);
    const firsts = drawn.players.filter((p) => p.placement! <= 30).sort((a, b) => a.placement! - b.placement!);
    expect(new Set(firsts.slice(0, 15).map((p) => p.colour)).size).toBe(2);
    for (let i = 1; i < 30; i++) expect(firsts[i - 1]!.stageScore).toBeGreaterThanOrEqual(firsts[i]!.stageScore);
  });

  /** Players with these places, cut stages (null: still in at the end) and counted losses a move. */
  function finished(rows: readonly { place: number; out: number | null; perMove: number }[], stage = 8): MatchState {
    const base = lobby(REWORK, rows.length);
    return {
      ...base,
      stage,
      players: base.players.map((p, i): PlayerState => {
        const r = rows[i]!;
        return { ...p, alive: false, placement: r.place, outInStage: r.out, lossesByStage: [[1, 1, 1, 1]], countedLossSum: 4 * r.perMove, rawLossSum: 4 * r.perMove };
      }),
    };
  }

  it("the best player: the fewest points given away a move among those who survived at least half the cuts made", () => {
    const state = finished([
      { place: 1, out: null, perMove: 2 }, // p0: the winner
      { place: 2, out: 8, perMove: 1.5 }, // p1: still in at the end
      { place: 9, out: 4, perMove: 1 }, // p2: survived 4 of 8: in
      { place: 20, out: 3, perMove: 0.1 }, // p3: survived 3 of 8: too few
      { place: 60, out: 0, perMove: 0 }, // p4: cut at the first
    ]);
    expect(bestPlayer(state, REWORK)).toBe("p2");
    // Those who left the match never are.
    expect(bestPlayer(state, REWORK, new Set(["p2"]))).toBe("p1");
    // An exact tie goes to the better place.
    const tied = finished([
      { place: 5, out: 6, perMove: 1 },
      { place: 3, out: 7, perMove: 1 },
    ]);
    expect(bestPlayer(tied, REWORK)).toBe("p1");
  });

  it("a game over early counts the cuts it made: 3 made, 2 survived is enough", () => {
    const state = finished(
      [
        { place: 1, out: null, perMove: 3 },
        { place: 40, out: 2, perMove: 0.5 },
        { place: 70, out: 1, perMove: 0.1 },
      ],
      3,
    );
    expect(bestPlayer(state, REWORK)).toBe("p1");
  });

  it("the podium: the winner is 1st of a won game, none in a draw; one player can be both", () => {
    const end = toTheEnd("b");
    const first = end.players.find((p) => p.placement === 1)!.id;
    expect(crowdPodium(end, "b", REWORK).winner).toBe(first);
    expect(crowdPodium(end, null, REWORK).winner).toBeUndefined();
    expect(crowdPodium(end, "b", REWORK).best).toBe(bestPlayer(end, REWORK));
    const solo = finished([
      { place: 1, out: null, perMove: 0.5 },
      { place: 2, out: 8, perMove: 1 },
    ]);
    expect(crowdPodium(solo, "w", REWORK)).toEqual({ winner: "p0", best: "p0" });
  });
});

describe("the move limit: after Black's 60th move, the judge's verdict", () => {
  it("reached once the position's move number is past 60", () => {
    expect(crowdLimitReached(REWORK, 60)).toBe(false);
    expect(crowdLimitReached(REWORK, 61)).toBe(true);
    expect(crowdLimitReached({ crowdMoveLimit: undefined }, 500)).toBe(false);
  });

  it("a side at 75% expected score or more wins; otherwise a draw", () => {
    expect(crowdLimitVerdict(0.75, "w", REWORK)).toBe("w");
    expect(crowdLimitVerdict(0.25, "w", REWORK)).toBe("b");
    expect(crowdLimitVerdict(0.9, "b", REWORK)).toBe("b");
    expect(crowdLimitVerdict(0.74, "w", REWORK)).toBeNull();
    expect(crowdLimitVerdict(0.3, "b", REWORK)).toBeNull();
  });
});
