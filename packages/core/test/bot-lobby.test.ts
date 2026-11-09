import { describe, expect, it } from "vitest";
import { BOT_LEVELS, BOT_LOBBY, CROWD_PARTY_MAX, WEAK_BOT_SKILL, botLevelMean, botRatingForSkill, botRatingOf, botSkillForRating, botStrength, lobbyPeopleCap } from "../src/index.ts";

const names = Array.from({ length: 3000 }, (_, i) => `Bot name ${i}`);

describe("the bots' ratings (BOT_LOBBY)", () => {
  it("each bot's rating is fixed by its name: a lobby mostly from 800 to 1500, some above and below", () => {
    expect(botRatingOf("Queenie")).toBe(botRatingOf("Queenie"));
    const rs = names.map((n) => botRatingOf(n));
    for (const r of rs) {
      expect(r).toBeGreaterThanOrEqual(BOT_LOBBY.ratings.min);
      expect(r).toBeLessThanOrEqual(BOT_LOBBY.ratings.max);
      expect(r % BOT_LOBBY.ratings.step).toBe(0);
    }
    const share = (f: (r: number) => boolean) => rs.filter(f).length / rs.length;
    expect(share((r) => r >= 800 && r <= 1500)).toBeGreaterThan(0.75);
    expect(share((r) => r < 800)).toBeGreaterThan(0.03);
    expect(share((r) => r > 1500)).toBeGreaterThan(0.03);
    expect(share((r) => r >= 1900)).toBeLessThan(0.03);
    expect(Math.abs(rs.reduce((a, b) => a + b, 0) / rs.length - BOT_LOBBY.ratings.mean)).toBeLessThan(30);
  });

  it("a rating's temperature: looser for weaker ratings, at the fitted points, and back again", () => {
    for (const [r, s] of BOT_LOBBY.skillAt) expect(botSkillForRating(r)).toBe(s);
    const [lo, hi] = [BOT_LOBBY.skillAt[0]![0], BOT_LOBBY.skillAt.at(-1)![0]];
    for (let r = lo; r < hi; r += 100) {
      expect(botSkillForRating(r)).toBeGreaterThan(botSkillForRating(r + 100));
      expect(botRatingForSkill(botSkillForRating(r))).toBe(r);
    }
    // (Held at the ends.)
    expect(botRatingForSkill(0.01)).toBe(hi);
    expect(botRatingForSkill(1e6)).toBe(lo);
  });

  it("?weakbots=1: never stronger than its loosest skill allows", () => {
    for (const n of names.slice(0, 300)) {
      const s = botStrength(n, { botSkillRange: WEAK_BOT_SKILL });
      expect(s.skill).toBeGreaterThanOrEqual(WEAK_BOT_SKILL[0]);
      expect(botSkillForRating(s.rating)).toBeGreaterThanOrEqual(WEAK_BOT_SKILL[0] - 0.01);
    }
  });
});

describe("solo's Bot level (BOT_LEVELS, Nov 9)", () => {
  // (99 bot-like names: a solo 50 v 50's bots.)
  const ninetyNine = names.slice(0, 99);
  const avg = (rs: number[]) => rs.reduce((a, b) => a + b, 0) / rs.length;
  it("each level's bots average within about 50 of its mean, each fixed by name within the level; Medium is today's curve", () => {
    for (const l of BOT_LEVELS) {
      if (l.mean === null) continue;
      const rs = ninetyNine.map((n) => botRatingOf(n, BOT_LOBBY, l.mean));
      expect(Math.abs(avg(rs) - l.mean), l.id).toBeLessThan(50);
      for (const r of rs) {
        expect(r).toBeGreaterThanOrEqual(BOT_LOBBY.ratings.min);
        expect(r).toBeLessThanOrEqual(BOT_LOBBY.ratings.max);
      }
      // ("They fluctuate a few hundred points up and down": not all one rating.)
      expect(new Set(rs).size, l.id).toBeGreaterThan(3);
      expect(ninetyNine.map((n) => botRatingOf(n, BOT_LOBBY, l.mean))).toEqual(rs);
    }
    expect(ninetyNine.map((n) => botRatingOf(n, BOT_LOBBY, 1150))).toEqual(ninetyNine.map((n) => botRatingOf(n)));
    expect(botStrength("Queenie", { botSkillRange: [0.25, 32], botLevel: 1900 }).rating).toBe(botRatingOf("Queenie", BOT_LOBBY, 1900));
  });
  it("Random spans the whole range, fixed by name; My level is your rating clamped, or Medium without one", () => {
    const rs = names.slice(0, 500).map((n) => botRatingOf(n, BOT_LOBBY, "random"));
    expect(Math.min(...rs)).toBeLessThanOrEqual(BOT_LOBBY.ratings.min + 100);
    expect(Math.max(...rs)).toBeGreaterThanOrEqual(BOT_LOBBY.ratings.max - 100);
    expect(rs.filter((r) => r > 1800).length / rs.length).toBeGreaterThan(0.15);
    expect(names.slice(0, 500).map((n) => botRatingOf(n, BOT_LOBBY, "random"))).toEqual(rs);
    expect(botLevelMean("mine", 1320)).toBe(1320);
    expect(botLevelMean("mine", 3000)).toBe(BOT_LOBBY.ratings.max);
    expect(botLevelMean("mine", null)).toBe(BOT_LOBBY.ratings.mean);
    expect(botLevelMean("random", 1500)).toBe("random");
    expect(botLevelMean("very-easy", 1500)).toBe(700);
  });
  it("a 50 v 50 party seats you and up to 8 friends; other lobbies their whole size", () => {
    expect(lobbyPeopleCap({ mode: "crowd", raid: false, lobbySize: 100 }, true)).toBe(CROWD_PARTY_MAX);
    expect(lobbyPeopleCap({ mode: "crowd", raid: false, lobbySize: 100 }, false)).toBe(100);
    expect(lobbyPeopleCap({ mode: "crowd", raid: true, lobbySize: 50 }, true)).toBe(50);
    expect(lobbyPeopleCap({ mode: "classic", raid: false, lobbySize: 64 }, true)).toBe(64);
  });
});
