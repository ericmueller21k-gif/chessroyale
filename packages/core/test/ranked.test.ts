import { describe, expect, it } from "vitest";
import {
  DUEL_ZONES,
  RANKED_1V1,
  divisionsEnd,
  controlLabel,
  duelCoins,
  duelControl,
  expectedScore,
  glickoUpdate,
  ladderRating,
  mayBeTop,
  newRankedRecord,
  pairRange,
  pairUp,
  placeLadder,
  pointsFor,
  rankView,
  rankedGame,
  rdAfterIdle,
  seedRating,
  votedControl,
  zoneControl,
  type DuelZone,
  type RankedRecord,
} from "../src/index.ts";

const DAY = 86_400_000;

describe("1 v 1's time-control vote", () => {
  it("five controls, fastest first, each named and written as chess writes it", () => {
    expect(RANKED_1V1.controls.map(controlLabel)).toEqual(["Bullet 1+1", "Bullet 2+1", "Blitz 3+2", "Blitz 5+3", "Rapid 10+5"]);
    expect(DUEL_ZONES).toEqual(["bullet", "blitz", "rapid"]);
    expect(DUEL_ZONES.map((z) => controlLabel(zoneControl(z)))).toEqual(["Bullet 1+1", "Blitz 3+2", "Rapid 10+5"]);
  });

  it("every pair of picks: the same, that; neighbors, the one between; Bullet against Rapid, Blitz", () => {
    const want: Record<string, string> = {
      "bullet,bullet": "Bullet 1+1",
      "bullet,blitz": "Bullet 2+1",
      "bullet,rapid": "Blitz 3+2",
      "blitz,bullet": "Bullet 2+1",
      "blitz,blitz": "Blitz 3+2",
      "blitz,rapid": "Blitz 5+3",
      "rapid,bullet": "Blitz 3+2",
      "rapid,blitz": "Blitz 5+3",
      "rapid,rapid": "Rapid 10+5",
    };
    for (const w of DUEL_ZONES) for (const b of DUEL_ZONES) expect(controlLabel(votedControl(w, b)), `${w} v ${b}`).toBe(want[`${w},${b}`]);
  });

  it("a missing pick has no say: the other's counts; neither: Blitz", () => {
    for (const z of DUEL_ZONES) {
      expect(votedControl(z, null).id).toBe(z);
      expect(votedControl(null, z).id).toBe(z);
      expect(votedControl(undefined, z).id).toBe(z);
    }
    expect(votedControl(null, null).id).toBe("blitz");
    // (Anything that isn't a zone is no pick.)
    expect(votedControl("fast" as DuelZone, "rapid").id).toBe("rapid");
  });

  it("a control by its stored id, the default for one it doesn't know", () => {
    expect(duelControl("blitz-rapid").baseSeconds).toBe(300);
    expect(duelControl("nope").id).toBe("blitz");
    expect(duelControl(null).id).toBe("blitz");
  });
});

describe("the hidden rating (Glicko-1)", () => {
  it("equal players: a win moves both by the same amount, more with a big deviation", () => {
    const a = { rating: 1500, rd: 350 };
    const b = { rating: 1500, rd: 350 };
    expect(expectedScore(a, b)).toBeCloseTo(0.5, 9);
    const won = glickoUpdate(a, b, 1);
    const lost = glickoUpdate(b, a, 0);
    expect(won.rating - 1500).toBeCloseTo(1500 - lost.rating, 9);
    expect(won.rating - 1500).toBeGreaterThan(150);
    expect(won.rd).toBeLessThan(350);
    // A settled player moves little.
    const settled = glickoUpdate({ rating: 1500, rd: 60 }, { rating: 1500, rd: 60 }, 1);
    expect(settled.rating - 1500).toBeGreaterThan(5);
    expect(settled.rating - 1500).toBeLessThan(12);
    expect(settled.rd).toBe(RANKED_1V1.rating.minRd);
  });

  it("Glickman's worked example (1500/200 against 1400/30): the expected score and the right direction", () => {
    const me = { rating: 1500, rd: 200 };
    expect(expectedScore(me, { rating: 1400, rd: 30 })).toBeCloseTo(0.639, 3);
    expect(glickoUpdate(me, { rating: 1400, rd: 30 }, 1).rating).toBeGreaterThan(1500);
    expect(glickoUpdate(me, { rating: 1400, rd: 30 }, 0.5).rating).toBeLessThan(1500);
  });

  it("the deviation grows back with idle days, never past the start", () => {
    expect(rdAfterIdle(60, 0)).toBe(60);
    expect(rdAfterIdle(60, 30)).toBeCloseTo(Math.sqrt(60 * 60 + 18 * 18 * 30), 9);
    expect(rdAfterIdle(60, 10_000)).toBe(350);
  });

  it("a new player's seed: their account's rating, clamped, or 1500", () => {
    expect(seedRating(null)).toBe(1500);
    expect(seedRating(Number.NaN)).toBe(1500);
    expect(seedRating(1712.4)).toBe(1712);
    expect(seedRating(400)).toBe(800);
    expect(seedRating(3100)).toBe(2400);
  });
});

describe("the ladder", () => {
  it("tiers with divisions 5 → 1 of 80 RP (Wood 5 the lowest), at every edge", () => {
    const at = (ladder: number) => {
      const v = rankView({ games: 9, ladder });
      return [v.tier, v.division, v.points, v.label, v.emblem];
    };
    expect(at(0)).toEqual(["Wood", 5, 0, "Wood 5 · 0 RP", "wood-d5"]);
    expect(at(79)).toEqual(["Wood", 5, 79, "Wood 5 · 79 RP", "wood-d5"]);
    expect(at(80)).toEqual(["Wood", 4, 0, "Wood 4 · 0 RP", "wood-d4"]);
    expect(at(399)).toEqual(["Wood", 1, 79, "Wood 1 · 79 RP", "wood-d1"]);
    expect(at(400)).toEqual(["Silver", 5, 0, "Silver 5 · 0 RP", "silver-d5"]);
    expect(at(1245)).toEqual(["Paragon", 5, 45, "Paragon 5 · 45 RP", "paragon-d5"]);
    expect(at(2399)).toEqual(["Sublime", 1, 79, "Sublime 1 · 79 RP", "sublime-d1"]);
    expect(at(2400)).toEqual(["Radiant", 5, 0, "Radiant 5 · 0 RP", "radiant-d5"]);
    expect(at(2799)).toEqual(["Radiant", 1, 79, "Radiant 1 · 79 RP", "radiant-d1"]);
    // (No place known: the top tiers need one. Radiant 1, the RP counting on past 79.)
    expect(at(2800)).toEqual(["Radiant", 1, 80, "Radiant 1 · 80 RP", "radiant-d1"]);
    expect(divisionsEnd()).toBe(2800);
    expect(RANKED_1V1.topFloor).toBe(divisionsEnd());
    const tiers = new Set<string>();
    for (let l = 0; l < 2800; l += 80) tiers.add(rankView({ games: 9, ladder: l }).tier);
    expect([...tiers]).toEqual(["Wood", "Silver", "Gold", "Paragon", "Illustrious", "Sublime", "Radiant"]);
    // Every division of every tier, in order, each 80 RP wide.
    for (let l = 0; l < 2800; l++) {
      const v = rankView({ games: 9, ladder: l });
      expect(v.division).toBe(5 - (Math.floor(l / 80) % 5));
      expect(v.points).toBe(l % 80);
    }
  });

  it("the top tiers: from 2800 ladder points, Pearlescent in the top 500, Transcendent in the top 100", () => {
    const top = (ladder: number, place: number | null) => rankView({ games: 9, ladder, place }).label;
    // The floor: below 2800 no place counts.
    expect(top(2799, 1)).toBe("Radiant 1 · 79 RP");
    expect(top(2800, 1)).toBe("Transcendent · 0 RP");
    expect(top(3120, 100)).toBe("Transcendent · 320 RP");
    expect(top(3120, 101)).toBe("Pearlescent · 320 RP");
    expect(top(2900, 500)).toBe("Pearlescent · 100 RP");
    // Outside the top 500: Radiant 1, the RP counting on past 80.
    expect(top(2815, 501)).toBe("Radiant 1 · 95 RP");
    expect(top(4000, 501)).toBe("Radiant 1 · 1280 RP");
    expect(top(2815, null)).toBe("Radiant 1 · 95 RP");
    const t = rankView({ games: 9, ladder: 3000, place: 7 });
    expect([t.tier, t.division, t.points, t.emblem, t.color]).toEqual(["Transcendent", null, 200, "transcendent", RANKED_1V1.topTiers[1]!.color]);
    expect(rankView({ games: 9, ladder: 3000, place: 300 }).emblem).toBe("pearlescent");
    expect(mayBeTop(2799)).toBe(false);
    expect(mayBeTop(2800)).toBe(true);
    expect(mayBeTop(null)).toBe(false);
    // (Placements never show a top tier, whatever the place.)
    expect(rankView({ games: 3, ladder: 3000, place: 1 }).label).toBe("Placement 3/5");
  });

  it("stored data keeps its meaning: every ladder from 0 to 4000 stands for the same hidden rating as before Oct 28", () => {
    // Before Oct 28 (Iron 4 … Diamond 1 of 100 RP, then Master): 800 at 0, +1600/2800 a point; placed at most 2400; each
    // tier 400 points wide. Written out here, not read from settings, so a settings change can't move it unseen.
    const before = (ladder: number) => 800 + ladder * (1600 / 2800);
    for (let l = 0; l <= 4000; l++) {
      expect(ladderRating(l)).toBe(before(l));
      // The same 400-point band per tier: Iron's is Wood's, Bronze's Silver's … Diamond's Radiant's.
      if (l < 2800) expect(RANKED_1V1.tiers.findIndex((t) => t.name === rankView({ games: 9, ladder: l }).tier)).toBe(Math.floor(l / 400));
    }
    for (let r = 0; r <= 4000; r += 0.5) expect(placeLadder(r)).toBe(Math.max(0, Math.min(2400, Math.floor((r - 800) / (1600 / 2800)))));
    expect([RANKED_1V1.baseRating, RANKED_1V1.ratingPerPoint, RANKED_1V1.placements.maxLadder, RANKED_1V1.points.perGame]).toEqual([800, 1600 / 2800, 2400, 20]);
    expect(RANKED_1V1.tiers.length * RANKED_1V1.divisions * RANKED_1V1.pointsPerDivision).toBe(7 * 4 * 100);
  });

  it("every tier's pill reads at 4.5:1 or better on both themes (styles.css, .dv-rank)", () => {
    const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v * t + b[i]! * (1 - t));
    const lum = (c: number[]) => {
      const [r, g, b] = c.map((v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const contrast = (a: number[], b: number[]) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    for (const t of [...RANKED_1V1.tiers, ...RANKED_1V1.topTiers]) {
      const c = rgb(t.color);
      // As RATING_RANKS: dark, the color on a 20% tint of the panel (#1b1e25); light, the color darkened (55% with black) on a 20% tint of white.
      expect(contrast(c, mix(c, rgb("#1b1e25"), 0.2)), `${t.name} dark`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mix(c, [0, 0, 0], 0.55), mix(c, [255, 255, 255], 0.2)), `${t.name} light`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("placements: Placement N/5 until the fifth game, whatever the ladder", () => {
    expect(rankView(null).label).toBe("Placement 0/5");
    expect(rankView(null).emblem).toBeNull();
    expect(rankView({ games: 2, ladder: null }).label).toBe("Placement 2/5");
    expect(rankView({ games: 4, ladder: null }).placement).toEqual({ played: 4, of: 5 });
    expect(rankView({ games: 5, ladder: null }).label).toBe("Placement 5/5");
  });

  it("the ladder and the hidden rating: Wood 5 is 800, the top tiers' floor 2400; placing caps at Radiant 5", () => {
    expect(ladderRating(0)).toBe(800);
    expect(ladderRating(2800)).toBeCloseTo(2400, 9);
    expect(placeLadder(1500)).toBe(1225);
    expect(rankView({ games: 5, ladder: placeLadder(1500) }).label).toBe("Paragon 5 · 25 RP");
    expect(placeLadder(500)).toBe(0);
    expect(placeLadder(2390)).toBe(2400);
    expect(rankView({ games: 5, ladder: placeLadder(3000) }).label).toBe("Radiant 5 · 0 RP");
  });

  it("rank points: ±20 between equals at par; more when the hidden rating is above the rank (within ±10)", () => {
    const par = ladderRating(1200);
    expect(pointsFor(1, 0.5, par, 1200)).toBe(20);
    expect(pointsFor(0, 0.5, par, 1200)).toBe(-20);
    expect(pointsFor(0.5, 0.5, par, 1200)).toBe(0);
    expect(pointsFor(1, 0.5, par + 100, 1200)).toBe(25);
    expect(pointsFor(0, 0.5, par + 100, 1200)).toBe(-15);
    expect(pointsFor(0.5, 0.5, par + 100, 1200)).toBe(3);
    expect(pointsFor(1, 0.5, par + 1000, 1200)).toBe(30);
    expect(pointsFor(0, 0.5, par + 1000, 1200)).toBe(-10);
    expect(pointsFor(1, 0.5, par - 1000, 1200)).toBe(10);
    expect(pointsFor(0, 0.5, par - 1000, 1200)).toBe(-30);
    expect(pointsFor(0.5, 0.5, par - 1000, 1200)).toBe(-5);
  });

  it("rank points follow the expected result: beating someone stronger pays more, someone weaker less; a win never takes points", () => {
    const par = ladderRating(1200);
    expect(pointsFor(1, 0.25, par, 1200)).toBe(30);
    expect(pointsFor(0, 0.25, par, 1200)).toBe(-10);
    expect(pointsFor(1, 0.75, par, 1200)).toBe(10);
    expect(pointsFor(0, 0.75, par, 1200)).toBe(-30);
    expect(pointsFor(0.5, 0.25, par, 1200)).toBe(10);
    // Far above your play, beating someone far weaker: nothing (never a loss of points); losing to them: plenty.
    expect(pointsFor(1, 0.97, par - 1000, 1200)).toBe(0);
    expect(pointsFor(0, 0.97, par - 1000, 1200)).toBe(-49);
    // Far below your play, losing to someone far stronger: nothing taken.
    expect(pointsFor(0, 0.03, par + 1000, 1200)).toBe(0);
  });

  it("a rank can't be farmed by beating far weaker players: it stops where the hidden rating says", () => {
    // Beating the same far weaker player again and again: the ladder climbs only until it's level with the hidden
    // rating (which barely moves for such wins), then stays.
    let me = settled(1200);
    const weak = settled(400);
    for (let i = 0; i < 300; i++) me = rankedGame(me, weak, 1, DAY + i * 60_000).next;
    expect(ladderRating(me.ladder!)).toBeLessThan(me.rating + 50);
    expect(me.ladder!).toBeLessThan(1700);
  });
});

/** A record after its placements, at a ladder place, with its hidden rating at that place. */
const settled = (ladder: number, over: Partial<RankedRecord> = {}): RankedRecord => ({
  rating: ladderRating(ladder),
  rd: 60,
  games: 40,
  wins: 20,
  losses: 20,
  draws: 0,
  ladder,
  lastAt: 0,
  ...over,
});

describe("a rated game", () => {
  it("five placements, then placed by the hidden rating", () => {
    let me = newRankedRecord(null);
    const opp = newRankedRecord(null);
    const labels: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = rankedGame(me, opp, 1, 1000 + i);
      expect(r.change.points).toBeNull();
      expect(r.change.placed).toBe(i === 4);
      me = r.next;
      labels.push(r.change.after.label);
    }
    expect(labels.slice(0, 4)).toEqual(["Placement 1/5", "Placement 2/5", "Placement 3/5", "Placement 4/5"]);
    expect(me.ladder).toBe(placeLadder(me.rating));
    expect(me.rating).toBeGreaterThan(1700);
    expect(labels[4]).toBe(rankView(me).label);
    expect(me).toMatchObject({ games: 5, wins: 5, losses: 0, draws: 0, lastAt: 1004 });
    // The sixth game moves rank points.
    const sixth = rankedGame(me, opp, 0, 2000);
    expect(sixth.change.points).toBeLessThan(0);
    expect(sixth.next.ladder).toBe(me.ladder! + sixth.change.points!);
  });

  it("promotion and demotion are the 80s crossed, the excess carried", () => {
    const up = rankedGame(settled(1270), settled(1270), 1, DAY);
    expect(up.change.before.label).toBe("Paragon 5 · 70 RP");
    expect(up.change.after.label).toBe(`Paragon 4 · ${70 + up.change.points! - 80} RP`);
    expect(up.change.after.emblem).toBe("paragon-d4");
    const down = rankedGame(settled(1205), settled(1205), 0, DAY);
    expect(down.change.after.tier).toBe("Gold");
    expect(down.change.after.division).toBe(1);
    expect(down.next.ladder).toBe(1205 + down.change.points!);
    // Past the divisions' end (no place known in core: the server adds it) and back.
    const past = rankedGame(settled(2795), settled(2795), 1, DAY).change.after;
    expect([past.tier, past.division]).toEqual(["Radiant", 1]);
    expect(past.points).toBeGreaterThan(79);
    expect(rankedGame(settled(2805), settled(2805), 0, DAY).change.after.label).toMatch(/^Radiant 1 · \d+ RP$/);
  });

  it("the floor: never below Wood 5 0", () => {
    const r = rankedGame(settled(5), settled(5), 0, DAY);
    expect(r.change.points).toBeLessThan(-5);
    expect(r.next.ladder).toBe(0);
    expect(r.change.after.label).toBe("Wood 5 · 0 RP");
    expect(rankedGame(r.next, settled(0), 0, DAY).next.ladder).toBe(0);
  });

  it("a draw counts as a game and moves the ladder by the adjustment only", () => {
    const r = rankedGame(settled(1500), settled(1500), 0.5, DAY);
    expect(r.next.draws).toBe(1);
    expect(r.next.games).toBe(41);
    expect(Math.abs(r.change.points!)).toBeLessThanOrEqual(5);
  });

  it("idle days widen the deviation, so the first game back moves the rating more", () => {
    const fresh = rankedGame(settled(1500, { lastAt: 100 * DAY }), settled(1500, { lastAt: 100 * DAY }), 1, 100 * DAY);
    const back = rankedGame(settled(1500, { lastAt: 0 }), settled(1500, { lastAt: 100 * DAY }), 1, 100 * DAY);
    expect(back.next.rating - ladderRating(1500)).toBeGreaterThan(fresh.next.rating - ladderRating(1500) + 5);
  });
});

describe("pairing by the hidden rating", () => {
  it("the range widens with the wait, up to its cap", () => {
    expect(pairRange(0)).toBe(100);
    expect(pairRange(10_000)).toBe(200);
    expect(pairRange(45_000)).toBe(550);
    expect(pairRange(10 * 60_000)).toBe(1000);
  });

  it("an uncertain rating (placements) widens it by the larger deviation, so two new players after one game still meet", () => {
    expect(pairRange(0, 60)).toBe(160);
    expect(pairRange(0, 300)).toBe(400);
    expect(pairRange(10 * 60_000, 350)).toBe(1000);
    // One game apart: the winner up, the loser down, both still uncertain. They meet at once.
    const a = newRankedRecord(null);
    const won = rankedGame(a, a, 1, 0).next;
    const lost = rankedGame(a, a, 0, 0).next;
    const now = 100_000;
    expect(won.rating - lost.rating).toBeGreaterThan(200);
    const e = (id: string, r: typeof won) => ({ id, uid: id, rating: r.rating, rd: r.rd, at: now });
    expect(pairUp([e("w", won), e("l", lost)], now)).toHaveLength(1);
    // Settled players 250 apart still wait for the range to widen.
    expect(pairUp([{ id: "a", uid: "a", rating: 1500, rd: 60, at: now }, { id: "b", uid: "b", rating: 1750, rd: 60, at: now }], now)).toEqual([]);
  });

  it("the longest wait first, with the closest rating in range; never yourself", () => {
    const e = (id: string, uid: string, rating: number, at: number) => ({ id, uid, rating, at });
    const now = 100_000;
    // a and b are 250 apart: too far at once, close enough after 15 s.
    expect(pairUp([e("a", "u1", 1500, now), e("b", "u2", 1750, now)], now)).toEqual([]);
    expect(pairUp([e("a", "u1", 1500, now - 15_000), e("b", "u2", 1750, now)], now).map(([x, y]) => [x.id, y.id])).toEqual([["a", "b"]]);
    // The closest of those in range.
    const four = [e("a", "u1", 1500, now - 30_000), e("b", "u2", 1800, now), e("c", "u3", 1550, now), e("d", "u4", 1820, now)];
    expect(pairUp(four, now).map(([x, y]) => [x.id, y.id])).toEqual([["a", "c"], ["b", "d"]]);
    // The same account twice (two tabs) never plays itself.
    expect(pairUp([e("a", "u1", 1500, now - 60_000), e("b", "u1", 1500, now)], now)).toEqual([]);
    // Nor two accounts on one device (its marker); a device unknown to either side doesn't count as the same.
    const on = (id: string, uid: string, device: string | null) => ({ ...e(id, uid, 1500, now), device });
    expect(pairUp([on("a", "u1", "d1"), on("b", "u2", "d1")], now)).toEqual([]);
    expect(pairUp([on("a", "u1", "d1"), on("b", "u2", "d1"), on("c", "u3", "d2")], now).map(([x, y]) => [x.id, y.id])).toEqual([["a", "c"]]);
    expect(pairUp([on("a", "u1", null), on("b", "u2", null)], now)).toHaveLength(1);
    // An odd one out waits.
    expect(pairUp([e("a", "u1", 1500, now), e("b", "u2", 1500, now), e("c", "u3", 1500, now)], now)).toHaveLength(1);
  });
});

describe("coins", () => {
  it("by the minute, by result, at least 1 and at most the cap; nothing under 10 moves each", () => {
    expect(duelCoins("win", 6 * 60_000, 30)).toBe(14);
    expect(duelCoins("draw", 6 * 60_000, 30)).toBe(10);
    expect(duelCoins("loss", 6 * 60_000, 30)).toBe(5);
    expect(duelCoins("loss", 20_000, 10)).toBe(1);
    expect(duelCoins("win", 3 * 60 * 60_000, 80)).toBe(70);
    expect(duelCoins("win", 6 * 60_000, 9)).toBe(0);
  });
});
