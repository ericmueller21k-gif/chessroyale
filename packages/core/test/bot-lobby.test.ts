import { describe, expect, it } from "vitest";
import { BOT_LOBBY, WEAK_BOT_SKILL, botRatingForSkill, botRatingOf, botSkillForRating, botStrength } from "../src/index.ts";

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
