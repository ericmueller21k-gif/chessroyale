import { describe, expect, it } from "vitest";
import { MODE_RANKS, RANKED_1V1, botSkillForRating } from "../src/settings.ts";
import { expectedScore, glickoUpdate, ladderRating } from "../src/ranked.ts";
import {
  crowdField,
  crowdPairScore,
  crowdRanks,
  fieldUpdate,
  leaverBotSkill,
  modeMatch,
  modePoints,
  modeRankSettings,
  newModeRecord,
  seedModeRating,
  squadStrength,
  squadsRanks,
  type CrowdEntrant,
  type ModeRecord,
  type SquadEntrant,
} from "../src/mode-ranks.ts";

const NOW = Date.UTC(2026, 10, 27);
const crowd = MODE_RANKS.crowd;
const crowdS = modeRankSettings("crowd");

/** A settled player (RD at the floor, placed, ladder where the hidden rating stands so the catch-up starts at 0). */
const settled = (rating: number): ModeRecord => ({
  rating,
  rd: RANKED_1V1.rating.minRd,
  games: 20,
  wins: 0,
  ladder: Math.round((rating - RANKED_1V1.baseRating) / RANKED_1V1.ratingPerPoint),
  peak: null,
  lastAt: NOW,
});

const seat = (id: string, place: number, record: ModeRecord | null, more: Partial<CrowdEntrant> = {}): CrowdEntrant => ({
  id,
  record,
  party: null,
  place,
  perMove: null,
  moves: 20,
  left: false,
  ...more,
});

/** A 50 v 50 of `n` real players at `others`' rating, with `me` (at `mine`) finishing at `myPlace`; places otherwise in order. */
function field(n: number, others: number, mine: number, myPlace: number): CrowdEntrant[] {
  const out: CrowdEntrant[] = [seat("me", myPlace, settled(mine))];
  for (let i = 0, place = 1; i < n - 1; i++, place++) {
    if (place === myPlace) place++;
    out.push(seat(`p${i}`, place, settled(others)));
  }
  return out;
}

describe("mode ranks: settings", () => {
  it("each mode is 1 v 1's tiers and scale with its own placements and points a match", () => {
    for (const mode of ["crowd", "squads"] as const) {
      const s = modeRankSettings(mode);
      expect(s.placements.games).toBe(MODE_RANKS[mode].placements);
      expect(s.points.perGame).toBe(MODE_RANKS[mode].perMatch);
      expect(s.tiers).toBe(RANKED_1V1.tiers);
      expect(s.topFloor).toBe(RANKED_1V1.topFloor);
      expect(s.rating).toBe(RANKED_1V1.rating);
      expect(s.placements.maxLadder).toBe(RANKED_1V1.placements.maxLadder);
    }
    expect(MODE_RANKS.squads.placeWeight).toBe(1); // Eric: "entirely on your placement"
  });
});

describe("mode ranks: the field's Glicko-1", () => {
  const me = { rating: 1500, rd: 200 };
  const opp = { rating: 1650, rd: 80 };

  it("one opponent at full weight is exactly 1 v 1's update", () => {
    for (const score of [0, 0.5, 1, 0.85]) {
      const one = fieldUpdate(me, [{ rating: opp, score }], 3);
      const duel = glickoUpdate(me, opp, score);
      expect(one.rating).toBeCloseTo(duel.rating, 9);
      expect(one.rd).toBeCloseTo(duel.rd, 9);
    }
  });

  it("a whole field is worth fullField games, however many play", () => {
    const many = fieldUpdate(me, Array.from({ length: 60 }, () => ({ rating: opp, score: 1 })), 3);
    const three = fieldUpdate(me, Array.from({ length: 3 }, () => ({ rating: opp, score: 1 })), 3);
    expect(many.rating).toBeCloseTo(three.rating, 9);
    expect(many.rd).toBeCloseTo(three.rd, 9);
  });

  it("an empty field changes nothing; the deviation never drops below the floor", () => {
    expect(fieldUpdate(me, [], 3)).toEqual(me);
    const sure = fieldUpdate({ rating: 1500, rd: 61 }, Array.from({ length: 3 }, () => ({ rating: opp, score: 0.5 })), 3);
    expect(sure.rd).toBe(RANKED_1V1.rating.minRd);
  });

  it("a field of equals with equal deviations moves no rating in total", () => {
    const entrants = Array.from({ length: 40 }, (_, i) => seat(`p${i}`, i + 1, settled(1500), { perMove: (i * 7) % 11 / 5, moves: 12 }));
    const changes = crowdRanks(entrants, NOW);
    expect(changes.size).toBe(40);
    const total = [...changes.values()].reduce((t, c) => t + c.next.rating - 1500, 0);
    expect(Math.abs(total)).toBeLessThan(1e-6);
  });
});

describe("mode ranks: 50 v 50's result against each opponent", () => {
  const a = seat("a", 3, settled(1500), { perMove: 1.0 });
  const b = seat("b", 7, settled(1500), { perMove: 1.5 });

  it("placement and engine score, 70 / 30", () => {
    expect(crowdPairScore(a, b)).toBeCloseTo(1, 9); // ahead and better
    expect(crowdPairScore({ ...a, perMove: 2 }, b)).toBeCloseTo(crowd.placeWeight, 9); // ahead, worse score
    expect(crowdPairScore({ ...a, place: 7, perMove: 1.45 }, b)).toBeCloseTo(0.5, 9); // equal place, score within the band
    expect(crowdPairScore(b, a)).toBeCloseTo(0, 9);
  });

  it("is always theirs' complement", () => {
    const cases = [a, b, { ...a, perMove: 1.55 }, { ...b, place: 3 }, { ...b, left: true }, { ...a, moves: 2 }, { ...a, perMove: null }];
    for (const x of cases) for (const y of cases) if (x !== y) expect(crowdPairScore(x, y) + crowdPairScore(y, x)).toBeCloseTo(1, 9);
  });

  it("place only when either left, has no score or played too few moves", () => {
    for (const odd of [{ left: true }, { perMove: null }, { moves: crowd.scoreMinMoves - 1 }]) {
      expect(crowdPairScore({ ...b, perMove: 0.1, ...odd }, a)).toBe(0); // behind, however good the score
      expect(crowdPairScore(a, { ...b, perMove: 0.1, ...odd })).toBe(1);
    }
  });

  it("the field: other real players outside your party; bots never", () => {
    const me = seat("me", 5, settled(1500), { party: "x" });
    const all = [me, seat("friend", 1, settled(1500), { party: "x" }), seat("bot", 2, null), seat("stranger", 9, settled(1600), { party: "y" }), seat("solo", 4, settled(1400))];
    const f = crowdField(me, all, NOW);
    expect(f.map((o) => o.rating.rating).sort()).toEqual([1400, 1600]);
    expect(crowdField({ ...me, party: null }, all, NOW)).toHaveLength(3);
  });

  it("nobody to compare with: no change, and not a placement match", () => {
    const alone = crowdRanks([seat("me", 1, settled(1500)), seat("b1", 2, null), seat("b2", 3, null)], NOW);
    expect(alone.size).toBe(0);
    const party = crowdRanks([seat("me", 1, settled(1500), { party: "x" }), seat("friend", 2, settled(1500), { party: "x" }), seat("b", 3, null)], NOW);
    expect(party.size).toBe(0);
    expect(modeMatch(settled(1500), [], true, NOW, "crowd")).toBeNull();
  });
});

describe("mode ranks: RP judged against the lobby (Eric's cases)", () => {
  const rp = (n: number, others: number, mine: number, place: number) => crowdRanks(field(n, others, mine, place), NOW).get("me")!.change.points!;

  it("among equals: the middle holds, last loses about a 1 v 1 loss, 1st gains about a win", () => {
    expect(Math.abs(rp(60, 1500, 1500, 30))).toBeLessThanOrEqual(2);
    expect(rp(60, 1500, 1500, 60)).toBeGreaterThanOrEqual(-22);
    expect(rp(60, 1500, 1500, 60)).toBeLessThanOrEqual(-18);
    expect(rp(60, 1500, 1500, 1)).toBeGreaterThanOrEqual(18);
  });

  it('"100 super strong players... you should not lose a lot"', () => {
    expect(rp(100, 1900, 1200, 100)).toBeGreaterThanOrEqual(-3);
    expect(rp(100, 1700, 1400, 100)).toBeGreaterThanOrEqual(-9);
    expect(rp(100, 1700, 1400, 10)).toBeGreaterThan(20);
  });

  it("a strong player in a weak lobby gains little, and 1st never loses", () => {
    expect(rp(100, 1200, 1900, 10)).toBeLessThanOrEqual(0);
    expect(rp(100, 1200, 1900, 1)).toBeGreaterThanOrEqual(0);
    expect(rp(100, 1200, 1900, 1)).toBeLessThanOrEqual(3);
  });

  it("fewer real players, smaller moves: one other is a third of a full field", () => {
    const s = crowdS;
    const ladder = Math.round((1500 - s.baseRating) / s.ratingPerPoint);
    expect(ladderRating(ladder, s)).toBeCloseTo(1500, 0);
    expect(modePoints(1, 0.5, 3, 1500, ladder, false, crowd, s)).toBe(20);
    expect(modePoints(1, 0.5, 1, 1500, ladder, false, crowd, s)).toBe(7);
    expect(Math.abs(rp(2, 1500, 1500, 2))).toBeLessThan(Math.abs(rp(4, 1500, 1500, 4)));
  });

  it("above the expected never takes points, below never gives them, 1st never loses", () => {
    const s = crowdS;
    // A rank far above its hidden rating: the catch-up pulls down by its most.
    expect(modePoints(0.55, 0.5, 3, 1000, 2000, false, crowd, s)).toBe(0);
    expect(modePoints(0.45, 0.5, 3, 2400, 0, false, crowd, s)).toBe(0);
    expect(modePoints(0.4, 0.5, 3, 1500, 1225, true, crowd, s)).toBe(0);
  });
});

describe("mode ranks: placements, peak, wins", () => {
  it("3 counted matches, then placed from the hidden rating (at most Radiant 5 0)", () => {
    let r = newModeRecord("crowd", { account: 1700 });
    const others = (place: number) => Array.from({ length: 10 }, (_, i) => ({ rating: { rating: 1500, rd: 80 }, score: place <= i ? 1 : 0 }));
    for (let i = 1; i <= crowd.placements; i++) {
      const done = modeMatch(r, others(0), true, NOW + i * 1000, "crowd")!;
      expect(done.change.points).toBeNull();
      expect(done.change.placed).toBe(i === crowd.placements);
      expect(done.change.after.placement === null).toBe(i === crowd.placements);
      r = done.next;
    }
    expect(r.games).toBe(3);
    expect(r.wins).toBe(3);
    expect(r.ladder).not.toBeNull();
    expect(r.ladder!).toBeLessThanOrEqual(RANKED_1V1.placements.maxLadder);
    expect(r.peak).toBe(r.ladder);
    expect(modeMatch(newModeRecord("crowd"), [], false, NOW, "crowd")).toBeNull();
    expect(newModeRecord("crowd").games).toBe(0);
  });

  it("the peak only goes up", () => {
    const start = { ...settled(1500), peak: 2000 };
    const lost = modeMatch(start, [{ rating: { rating: 1500, rd: 60 }, score: 0 }], false, NOW, "crowd")!;
    expect(lost.change.points!).toBeLessThan(0);
    expect(lost.next.peak).toBe(2000);
    expect(lost.next.ladder).toBe(start.ladder! + lost.change.points!);
  });

  it("the shown rank uses the mode's placements", () => {
    const one = modeMatch(newModeRecord("squads"), [{ rating: { rating: 1500, rd: 60 }, score: 1 }], true, NOW, "squads")!;
    expect(one.change.after.label).toBe(`Placement 1/${MODE_RANKS.squads.placements}`);
  });
});

describe("mode ranks: Squads", () => {
  const squad = (id: string, place: number, people: [string, number][], bots: number[] = []): SquadEntrant => ({
    id,
    place,
    people: people.map(([pid, rating]) => ({ id: pid, record: settled(rating) })),
    bots,
  });

  it("a squad's strength: the mean of its seats, bots at their fixed rating", () => {
    const q = squad("a", 1, [["x", 1600], ["y", 1400]], [1000, 2000]);
    expect(squadStrength(q, NOW).rating).toBeCloseTo(1500, 9);
    expect(squadStrength(q, NOW).rd).toBeCloseTo(RANKED_1V1.rating.minRd, 9);
  });

  it("placement only: every member the same result; all-bot squads aren't opponents", () => {
    const squads = [
      squad("a", 1, [["a1", 1500], ["a2", 1500]], [1500, 1500]),
      squad("b", 2, [["b1", 1500]], [1500, 1500, 1500]),
      squad("c", 3, [["c1", 1500]], [1500, 1500, 1500]),
      squad("d", 3, [], [1500, 1500, 1500, 1500]),
      squad("e", 5, [["e1", 1500], ["e2", 1500], ["e3", 1500], ["e4", 1500]]),
    ];
    const ch = squadsRanks(squads, NOW);
    expect([...ch.keys()].sort()).toEqual(["a1", "a2", "b1", "c1", "e1", "e2", "e3", "e4"]);
    for (const c of ch.values()) expect(c.change.opponents).toBe(3);
    expect(ch.get("a1")!.change.points).toBe(ch.get("a2")!.change.points);
    expect(ch.get("a1")!.change.points!).toBeGreaterThan(0);
    expect(ch.get("e1")!.change.points!).toBeLessThan(0);
    expect(ch.get("a1")!.next.wins).toBe(1);
    expect(ch.get("b1")!.next.wins).toBe(0);
  });

  it("the expected comes from the squad's strength: a strong squad that comes last loses more than a weak one", () => {
    const run = (mine: number) =>
      squadsRanks([squad("me", 5, [["me1", 1500]], [mine, mine, mine]), squad("o1", 1, [["o", 1500]], [1500, 1500, 1500]), squad("o2", 2, [["p", 1500]], [1500, 1500, 1500])], NOW).get("me1")!.change.points!;
    expect(run(1900)).toBeLessThan(run(1100));
  });

  it("a leaver's result is their own place (the worst the squad could still finish), the squad's strength unchanged", () => {
    const squads = [squad("me", 1, [["stay", 1500], ["gone", 1500]], [1500, 1500]), squad("o", 2, [["o1", 1500]], [1500, 1500, 1500]), squad("p", 5, [["p1", 1500]], [1500, 1500, 1500])];
    squads[0] = { ...squads[0]!, people: [squads[0]!.people[0]!, { ...squads[0]!.people[1]!, place: 5 }] };
    const ch = squadsRanks(squads, NOW);
    expect(ch.get("stay")!.change.points!).toBeGreaterThan(0);
    expect(ch.get("stay")!.next.wins).toBe(1);
    expect(ch.get("gone")!.change.points!).toBeLessThan(0);
    expect(ch.get("gone")!.next.wins).toBe(0);
    expect(ch.get("o1")!.change.opponents).toBe(2);
    expect(ch.get("o1")!.change.points!).toBeLessThan(0); // behind the leaver's squad, which finished 1st
    expect(squadStrength(squads[0]!, NOW).rating).toBeCloseTo(1500, 9);
  });

  it("no other real squad: no change", () => {
    expect(squadsRanks([squad("a", 1, [["a1", 1500]], [1500, 1500, 1500]), squad("b", 2, [], [1500, 1500, 1500, 1500])], NOW).size).toBe(0);
  });
});

describe("mode ranks: seeding and leavers", () => {
  it("50 v 50 from the account's Rating, else 1 v 1; Squads from 50 v 50, else 1 v 1, else the Rating; clamped", () => {
    expect(seedModeRating("crowd", { account: 1700, duel: 1300 })).toBe(1700);
    expect(seedModeRating("crowd", { account: null, duel: 1300 })).toBe(1300);
    expect(seedModeRating("crowd", {})).toBe(RANKED_1V1.rating.start);
    expect(seedModeRating("squads", { crowd: 1650, duel: 1300, account: 1700 })).toBe(1650);
    expect(seedModeRating("squads", { duel: 1300, account: 1700 })).toBe(1300);
    expect(seedModeRating("squads", { account: 1700 })).toBe(1700);
    expect(seedModeRating("crowd", { account: 3000 })).toBe(RANKED_1V1.rating.seedMax);
    expect(seedModeRating("squads", { crowd: 100 })).toBe(RANKED_1V1.rating.seedMin);
    expect(newModeRecord("squads", { crowd: 1650 })).toEqual({ rating: 1650, rd: RANKED_1V1.rating.startRd, games: 0, wins: 0, ladder: null, peak: null, lastAt: null });
  });

  it("a leaver's bot plays at the leaver's level", () => {
    expect(leaverBotSkill(1800)).toBe(botSkillForRating(1800));
    expect(leaverBotSkill(2000)).toBeLessThan(leaverBotSkill(1000));
  });

  it("a leaver's result is the place part only (no credit for the score before leaving)", () => {
    const entrants = [seat("me", 9, settled(1500), { left: true, perMove: 0.2 }), ...Array.from({ length: 8 }, (_, i) => seat(`p${i}`, i + 1, settled(1500), { perMove: 3 }))];
    const f = crowdField(entrants[0]!, entrants, NOW);
    expect(f.every((o) => o.score === 0)).toBe(true);
    expect(expectedScore({ rating: 1500, rd: 60 }, f[0]!.rating)).toBeCloseTo(0.5, 9);
  });
});
