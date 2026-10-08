import { describe, expect, it } from "vitest";
import {
  FAIRPLAY,
  crowdRate,
  honestFindChance,
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
    expect(skipReason(mv({ bestExp: 0.95 }))).toBe("decided");
    expect(skipReason(mv({ bestExp: 0.04 }))).toBe("decided");
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

  it("an honest player finds what the crowd misses more often the stronger they are", () => {
    const weak = honestFindChance(40, 2, 1500);
    const strong = honestFindChance(40, 2, 2500);
    expect(weak).toBeCloseTo(2.5 / 41, 3);
    expect(strong).toBeGreaterThan(weak * 1.5);
    expect(honestFindChance(40, 2, 2500, { ...S, hardSlope: 1 })).toBeGreaterThan(strong);
    expect(honestFindChance(40, 38, 1500)).toBeGreaterThan(0.9);
  });

  it("spearman: rank correlation, null without enough or without spread", () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1);
    expect(spearman([1, 2], [1, 2])).toBeNull();
    expect(spearman([1, 2, 3], [5, 5, 5])).toBeNull();
  });

  it("an engine user: super-GM strength, hard finds, flat fast timing; an honest club player scores nothing", () => {
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
    // (How much evidence hard finds give depends on the tuned model; with a modest one, five of five is plenty.)
    expect(matchSignals(engine, null, { ...S, hardSlope: 0.6 }).hardEvidence).toBeGreaterThan(2);
    expect(e.fastHard).toBe(5);
    expect(e.parts.perf).toBe(FAIRPLAY.score.perfMax);
    expect(e.parts.time).toBeGreaterThan(0);
    expect(e.score).toBeGreaterThan(FAIRPLAY.levels.reviewOne);
    const h = matchSignals(honest, null);
    expect(h.perf!).toBeLessThan(2000);
    expect(h.hardFinds).toBe(0);
    expect(h.hardEvidence).toBeLessThan(0);
    expect(h.timeCorr!).toBeGreaterThan(0.5);
    expect(h.score).toBe(0);
  });

  it("a strong player measured against their own strength: hard finds at their level aren't evidence", () => {
    // 12 hard positions (2 of 40 found the best), 3 found: a little suspicious for a 1500, not for a 2500.
    const moves = Array.from({ length: 12 }, (_, i) => mv({ ply: 14 + 2 * i, loss: i % 4 === 0 ? 0 : 12, crowdFound: 2 }));
    const st = { ...S, hardSlope: 0.3, strengthCap: 2500 };
    const asNew = matchSignals(moves, null, st);
    const asStrong = matchSignals(moves, 2500, st);
    expect(asNew.hardFinds).toBe(3);
    expect(asNew.hardEvidence).toBeGreaterThan(0);
    expect(asStrong.hardEvidence).toBeLessThan(0);
    expect(asStrong.parts.hard).toBe(0);
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

  it("bans only on overwhelming evidence: super-GM strength over two matches with high scores, or one match past every bar", () => {
    const strong = m(L.banScore, L.banPerf, L.banCounted);
    expect(playerLevel([strong], now).level).toBe("review");
    expect(playerLevel([strong, strong], now).level).toBe("ban");
    // Not on too few counted moves, too low a strength or too low a score.
    expect(playerLevel([strong, m(L.banScore, L.banPerf, L.banCounted - 1)], now).level).toBe("review");
    expect(playerLevel([strong, m(L.banScore, L.banPerf - 1, L.banCounted)], now).level).toBe("review");
    expect(playerLevel([strong, m(L.banScore - 0.1, L.banPerf, L.banCounted)], now).level).toBe("review");
    expect(playerLevel([m(L.banOneScore, L.banOnePerf, L.banOneCounted)], now)).toMatchObject({ level: "ban", reasons: [expect.stringMatching(/one match/)] });
  });
});
