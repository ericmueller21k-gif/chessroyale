import { describe, expect, it } from "vitest";
import {
  FAIRPLAY,
  crowdRate,
  honestChance,
  moveEvidence,
  matchPerf,
  matchSignals,
  playerLevel,
  ratingForLoss,
  referenceStrength,
  skipReason,
  spearman,
  type FairMove,
} from "../src/index.ts";

const S = FAIRPLAY.signals;

/** A counted middlegame move unless the patch says otherwise. */
function mv(patch: Partial<FairMove> = {}): FairMove {
  return { ply: 20, fen: "x", move: "e2e4", best: "e2e4", loss: 0, bestExp: 0.55, near: 2, gap: 3, crowd: 40, crowdFound: 20, thinkMs: 8000, away: 0, legal: 30, ...patch };
}

describe("which positions count", () => {
  it("skips the opening, forced moves, decided positions and power-up picks", () => {
    expect(skipReason(mv())).toBeNull();
    expect(skipReason(mv({ ply: S.bookPlies - 1 }))).toBe("book");
    expect(skipReason(mv({ ply: S.bookPlies }))).toBeNull();
    expect(skipReason(mv({ legal: 1 }))).toBe("forced");
    expect(skipReason(mv({ bestExp: 0.98 }))).toBe("decided");
    expect(skipReason(mv({ bestExp: 0.95 }))).toBeNull();
    expect(skipReason(mv({ bestExp: 0.02 }))).toBe("decided");
    expect(skipReason(mv({ powerUp: true }))).toBe("powerUp");
  });

  it("skips only moves and recaptures most of the crowd found, but counts the ones the crowd missed", () => {
    expect(skipReason(mv({ gap: S.onlyGap, crowdFound: 30 }))).toBe("only");
    expect(skipReason(mv({ gap: S.onlyGap, crowdFound: 2 }))).toBeNull();
    // No crowd to say: an only move is taken as obvious.
    expect(skipReason(mv({ gap: S.onlyGap, crowd: 3, crowdFound: 0 }))).toBe("only");
    expect(skipReason(mv({ recapture: true, crowdFound: 35 }))).toBe("recapture");
    expect(skipReason(mv({ recapture: true, crowdFound: 4 }))).toBeNull();
  });

  it("knows the crowd's find rate only with enough of a crowd", () => {
    expect(crowdRate({ crowd: 40, crowdFound: 4 })).toBe(0.1);
    expect(crowdRate({ crowd: S.minCrowd - 1, crowdFound: 4 })).toBeNull();
  });
});

describe("signals", () => {
  it("match strength: an engine rating over counted moves, pulled towards 1500 at first", () => {
    expect(matchPerf([])).toBeNull();
    expect(matchPerf(Array(40).fill(0.5))!).toBeGreaterThan(3000);
    expect(matchPerf(Array(40).fill(10))!).toBeLessThan(1600);
    // Three perfect moves aren't super-GM strength yet; thirty are.
    expect(matchPerf([0, 0, 0])!).toBeLessThan(2400);
    expect(matchPerf(Array(30).fill(0))!).toBeGreaterThan(ratingForLoss(2));
  });

  it("an honest player's chance of the best move: from the crowd's rate, more for a stronger player, with a floor", () => {
    const m = S.findDeep;
    const weak = honestChance(40, 2, 1500, m, S.soloDeep);
    const strong = honestChance(40, 2, 2700, m, S.soloDeep);
    expect(strong).toBeGreaterThan(weak);
    expect(honestChance(40, 30, 1500, m, S.soloDeep)).toBeGreaterThan(weak);
    // Nobody in the crowd found it: a strong player still sometimes does (the floor).
    expect(honestChance(40, 0, 2700, [1, 0, 0, 0, -1.5, 0], S.soloDeep)).toBeCloseTo(1 / (1 + Math.exp(1.5)), 5);
    // Without a crowd: from strength alone.
    expect(honestChance(3, 0, 1500, m, [-1, 0.5])).toBeCloseTo(1 / (1 + Math.exp(1)), 5);
  });

  it("evidence: the best move the crowd missed points to an engine; a pick outside the engine's top 3 points away", () => {
    const deep = (rank: number) => mv({ crowdFound: 2, picks: { e2e4: 2, d2d4: 20, g1f3: 10 }, deep: { best: "e2e4", rank, loss: rank === 1 ? 0 : 6, top: ["e2e4", "d2d4", "g1f3"] } });
    const hard = moveEvidence(deep(1), 2000);
    const second = moveEvidence(deep(2), 2000);
    const outside = moveEvidence(deep(5), 2000);
    expect(hard.outcome).toBe(0);
    expect(hard.evidence).toBeGreaterThan(0.5);
    expect(second.outcome).toBe(1);
    expect(outside.outcome).toBe(2);
    expect(outside.evidence).toBeLessThan(-2);
    expect(second.evidence).toBeGreaterThan(outside.evidence);
    // An easy best move (most of the crowd picked it) is barely evidence.
    const easy = moveEvidence(mv({ crowdFound: 35, picks: { e2e4: 35 }, deep: { best: "e2e4", rank: 1, loss: 0, top: ["e2e4"] } }), 2000);
    expect(easy.evidence).toBeLessThan(0.3);
    // Not deep-checked: the judges' best within a point, against cheatFind.
    const judged = moveEvidence(mv({ loss: 0, crowdFound: 2 }), 2000);
    expect(judged.evidence).toBeGreaterThan(0.5);
    expect(moveEvidence(mv({ loss: 9, crowdFound: 30 }), 2000).evidence).toBeLessThan(0);
  });

  it("spearman: rank correlation, null without enough or without spread", () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1);
    expect(spearman([1, 2], [1, 2])).toBeNull();
    expect(spearman([1, 2, 3], [5, 5, 5])).toBeNull();
  });

  it("an engine user: strength, hard finds, flat fast timing; an honest club player scores nothing", () => {
    // 20 counted moves; every fourth position is hard (2 of 40 found it).
    const positions = Array.from({ length: 20 }, (_, i) => ({ ply: 14 + 2 * i, hard: i % 4 === 0 }));
    const engine = positions.map((p, i) => mv({ ply: p.ply, loss: 0, crowdFound: p.hard ? 2 : 24, thinkMs: 3000 + ((i * 1777) % 1900) }));
    const honest = positions.map((p, i) => mv({ ply: p.ply, loss: p.hard ? 15 : i % 3 === 0 ? 10 : 2, crowdFound: p.hard ? 2 : 24, thinkMs: p.hard ? 15_000 : 5000 + ((i * 911) % 2000) }));
    const e = matchSignals(engine, null);
    expect(e.counted).toBe(20);
    expect(e.perf!).toBeGreaterThan(3000);
    expect(e.hard).toBe(5);
    expect(e.hardFinds).toBe(5);
    expect(e.hardStreak).toBe(5);
    expect(e.topStreak).toBe(20);
    expect(e.evidence).toBeGreaterThan(2);
    expect(e.fastHard).toBe(5);
    expect(e.parts.perf).toBe(FAIRPLAY.score.perfMax);
    expect(e.parts.time).toBeGreaterThan(0);
    expect(e.score).toBeGreaterThan(FAIRPLAY.levels.reviewOne);
    const h = matchSignals(honest, null);
    expect(h.perf!).toBeLessThan(2000);
    expect(h.hardFinds).toBe(0);
    expect(h.evidence).toBeLessThan(0);
    expect(h.timeCorr!).toBeGreaterThan(0.5);
    expect(h.score).toBe(0);
  });

  it("a strong player measured against their own strength: finds at their level are less evidence", () => {
    // Six hard finds with a so-so match around them: measured against a new player's strength, and a 2700's.
    const moves = Array.from({ length: 12 }, (_, i) => mv({ ply: 14 + 2 * i, loss: i % 2 === 0 ? 0 : 12, crowdFound: i % 2 === 0 ? 2 : 30 }));
    const asNew = matchSignals(moves, null);
    const asStrong = matchSignals(moves, 2700);
    expect(asNew.hardFinds).toBe(6);
    const finds = (ref: number) => moves.filter((x) => x.loss === 0).reduce((t, x) => t + moveEvidence(x, ref).evidence, 0);
    expect(finds(2700)).toBeLessThan(finds(Math.max(1500, asNew.perf!)));
    expect(asStrong.evidence).toBeLessThan(asNew.evidence + 3);
  });

  it("a jump far above the player's own history adds points", () => {
    const moves = Array.from({ length: 20 }, (_, i) => mv({ ply: 14 + 2 * i, loss: i % 5 === 0 ? 2 : 0 }));
    const fresh = matchSignals(moves, null);
    const jumped = matchSignals(moves, 1500);
    expect(fresh.parts.jump).toBe(0);
    expect(jumped.parts.jump).toBeGreaterThan(1);
  });

  it("look-aways: points only when moves with a look-away find the best far more often than the rest", () => {
    const base = Array.from({ length: 20 }, (_, i) => mv({ ply: 14 + 2 * i, loss: i % 2 ? 0 : 8 }));
    // Every look-away move found the best; the rest found it less than half the time.
    const looked = base.map((m, i) => (i % 2 && i < 10 ? { ...m, away: 1 } : m));
    const s = matchSignals(looked, null);
    expect(s.awayMoves).toBe(5);
    expect(s.awayFound).toBe(5);
    expect(s.parts.away).toBe(FAIRPLAY.score.away);
    // Look-aways with ordinary results: nothing.
    const random = base.map((m, i) => (i < 6 ? { ...m, away: 1 } : m));
    expect(matchSignals(random, null).parts.away).toBe(0);
  });

  it("the deep re-check: picks matching its best far more often than a strong player's would are evidence", () => {
    const moves = Array.from({ length: 12 }, (_, i) =>
      mv({ ply: 14 + 2 * i, loss: 0.5, crowdFound: 12, picks: { e2e4: 12, d2d4: 15 }, deep: { best: "e2e4", rank: i < 11 ? 1 : 2, loss: i < 11 ? 0 : 3, top: ["e2e4", "d2d4", "g1f3"] } }),
    );
    const s = matchSignals(moves, null);
    expect([s.deepChecked, s.deepMatch, s.deepTop3]).toEqual([12, 11, 12]);
    expect(s.deepLoss).toBe(0.25);
    expect(s.evidence).toBeGreaterThan(2);
    // Like a strong player (the engine's best a third of the time, often outside its top 3): evidence the other way.
    const human = moves.map((x, i) => ({ ...x, deep: { ...x.deep!, rank: i % 3 === 0 ? 1 : 5, loss: i % 3 === 0 ? 0 : 6 } }));
    expect(matchSignals(human, null).evidence).toBeLessThan(-5);
  });

  it("reference strength: the median of 3+ recent match strengths, else the rating", () => {
    expect(referenceStrength([1800, null, 2000, 1900], 1500)).toBe(1900);
    expect(referenceStrength([1800, 2000], 1500)).toBe(1500);
    expect(referenceStrength([], null)).toBeNull();
  });
});

describe("levels", () => {
  const L = FAIRPLAY.levels;
  const day = 86_400_000;
  const now = 100 * day;
  const m = (score: number, perf = 2000, counted = 15, daysAgo = 1) => ({ score, perf, counted, at: now - daysAgo * day });


  it("watch, then review on one high match or two adding up", () => {
    expect(playerLevel([], now).level).toBe("none");
    expect(playerLevel([m(L.watch - 0.1)], now).level).toBe("none");
    expect(playerLevel([m(L.watch)], now).level).toBe("watch");
    expect(playerLevel([m(L.reviewOne)], now).level).toBe("review");
    expect(playerLevel([m(L.reviewTwo / 2), m(L.reviewTwo / 2)], now).level).toBe("review");
    // Outside the window, it doesn't count.
    expect(playerLevel([m(L.reviewOne, 2000, 15, L.windowDays + 1)], now).level).toBe("none");
  });

  it("bans only on overwhelming evidence from deep-checked matches: two adding up past the bars, or one past every bar", () => {
    const strong = { ...m(L.banEvidence, L.banPerf), evidence: L.banEvidence / 2, deepChecked: L.banDeepChecked / 2, deepMatch: Math.ceil((L.banDeep * L.banDeepChecked) / 2) };
    expect(playerLevel([strong], now).level).toBe("review");
    expect(playerLevel([strong, strong], now)).toMatchObject({ level: "ban", reasons: [expect.stringMatching(/2 deep-checked matches/)] });
    // Not without the deep re-check, nor short of any bar.
    expect(playerLevel([strong, { ...strong, deepChecked: 0, deepMatch: 0 }], now).level).not.toBe("ban");
    expect(playerLevel([strong, { ...strong, evidence: L.banEvidence / 2 - 0.1 }], now).level).not.toBe("ban");
    expect(playerLevel([strong, { ...strong, deepChecked: L.banDeepChecked / 2 - 1, deepMatch: L.banDeepChecked / 2 - 1 }], now).level).not.toBe("ban");
    expect(playerLevel([strong, { ...strong, deepMatch: 0 }], now).level).not.toBe("ban");
    expect(playerLevel([{ ...strong, perf: L.banPerf - 1 }, { ...strong, perf: L.banPerf - 1 }], now).level).not.toBe("ban");
    const one = { ...m(L.banOneEvidence, L.banOnePerf), evidence: L.banOneEvidence, deepChecked: L.banOneDeepChecked, deepMatch: Math.ceil(L.banOneDeep * L.banOneDeepChecked) };
    expect(playerLevel([one], now)).toMatchObject({ level: "ban", reasons: [expect.stringMatching(/one match/)] });
  });
});
