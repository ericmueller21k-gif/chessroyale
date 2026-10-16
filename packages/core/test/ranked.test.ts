import { describe, expect, it } from "vitest";
import {
  DUEL_ZONES,
  RANKED_1V1,
  apexStart,
  controlLabel,
  duelCoins,
  duelControl,
  expectedScore,
  glickoUpdate,
  ladderRating,
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
  it("tiers 4 → 1, then Master, Grandmaster and Champion with no divisions", () => {
    expect(rankView({ games: 9, ladder: 0 }).label).toBe("Iron 4 · 0 RP");
    expect(rankView({ games: 9, ladder: 99 }).label).toBe("Iron 4 · 99 RP");
    expect(rankView({ games: 9, ladder: 100 }).label).toBe("Iron 3 · 0 RP");
    expect(rankView({ games: 9, ladder: 399 }).label).toBe("Iron 1 · 99 RP");
    expect(rankView({ games: 9, ladder: 400 }).label).toBe("Bronze 4 · 0 RP");
    expect(rankView({ games: 9, ladder: 1245 }).label).toBe("Gold 4 · 45 RP");
    expect(rankView({ games: 9, ladder: 2799 }).label).toBe("Diamond 1 · 99 RP");
    expect(apexStart()).toBe(2800);
    expect(rankView({ games: 9, ladder: 2800 }).label).toBe("Master · 0 RP");
    expect(rankView({ games: 9, ladder: 2999 }).label).toBe("Master · 199 RP");
    expect(rankView({ games: 9, ladder: 3000 }).label).toBe("Grandmaster · 200 RP");
    expect(rankView({ games: 9, ladder: 3300 }).label).toBe("Champion · 500 RP");
    expect(rankView({ games: 9, ladder: 9999 }).tier).toBe("Champion");
    const tiers = new Set<string>();
    for (let l = 0; l < 2800; l += 100) tiers.add(rankView({ games: 9, ladder: l }).tier);
    expect([...tiers]).toEqual(["Iron", "Bronze", "Silver", "Gold", "Platinum", "Emerald", "Diamond"]);
  });

  it("placements: Placement N/5 until the fifth game, whatever the ladder", () => {
    expect(rankView(null).label).toBe("Placement 0/5");
    expect(rankView({ games: 2, ladder: null }).label).toBe("Placement 2/5");
    expect(rankView({ games: 4, ladder: null }).placement).toEqual({ played: 4, of: 5 });
    expect(rankView({ games: 5, ladder: null }).label).toBe("Placement 5/5");
  });

  it("the ladder and the hidden rating: Iron 4 is 800, Master 2400; placing caps at Diamond 4", () => {
    expect(ladderRating(0)).toBe(800);
    expect(ladderRating(2800)).toBeCloseTo(2400, 9);
    expect(placeLadder(1500)).toBe(1225);
    expect(rankView({ games: 5, ladder: placeLadder(1500) }).label).toBe("Gold 4 · 25 RP");
    expect(placeLadder(500)).toBe(0);
    expect(placeLadder(2390)).toBe(2400);
    expect(rankView({ games: 5, ladder: placeLadder(3000) }).label).toBe("Diamond 4 · 0 RP");
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

  it("promotion and demotion are the 100s crossed, the excess carried", () => {
    const up = rankedGame(settled(1290), settled(1290), 1, DAY);
    expect(up.change.before.label).toBe("Gold 4 · 90 RP");
    expect(up.change.after.label).toBe(`Gold 3 · ${90 + up.change.points! - 100} RP`);
    const down = rankedGame(settled(1205), settled(1205), 0, DAY);
    expect(down.change.after.tier).toBe("Silver");
    expect(down.change.after.division).toBe(1);
    expect(down.next.ladder).toBe(1205 + down.change.points!);
    // Into Master and out of it.
    expect(rankedGame(settled(2795), settled(2795), 1, DAY).change.after.tier).toBe("Master");
    expect(rankedGame(settled(2805), settled(2805), 0, DAY).change.after.label).toMatch(/^Diamond 1 · \d+ RP$/);
  });

  it("the floor: never below Iron 4 0", () => {
    const r = rankedGame(settled(5), settled(5), 0, DAY);
    expect(r.change.points).toBeLessThan(-5);
    expect(r.next.ladder).toBe(0);
    expect(r.change.after.label).toBe("Iron 4 · 0 RP");
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
