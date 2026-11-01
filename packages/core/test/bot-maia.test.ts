import { describe, expect, it } from "vitest";
import { BOT_MAIA, WEAK_BOT_SKILL, botChooseWith, botRatingForSkill, botRatingOf, botSkillForRating, botStrength, maiaDraw, mulberry32 } from "../src/index.ts";

const names = Array.from({ length: 3000 }, (_, i) => `Bot name ${i}`);

describe("the bots' ratings (BOT_MAIA)", () => {
  it("each bot's rating is fixed by its name: a lobby mostly from 800 to 1500, some above and below", () => {
    expect(botRatingOf("Queenie")).toBe(botRatingOf("Queenie"));
    const rs = names.map((n) => botRatingOf(n));
    for (const r of rs) {
      expect(r).toBeGreaterThanOrEqual(BOT_MAIA.ratings.min);
      expect(r).toBeLessThanOrEqual(BOT_MAIA.ratings.max);
      expect(r % BOT_MAIA.ratings.step).toBe(0);
    }
    const share = (f: (r: number) => boolean) => rs.filter(f).length / rs.length;
    expect(share((r) => r >= 800 && r <= 1500)).toBeGreaterThan(0.75);
    expect(share((r) => r < 800)).toBeGreaterThan(0.03);
    expect(share((r) => r > 1500)).toBeGreaterThan(0.03);
    expect(share((r) => r >= 1900)).toBeLessThan(0.03);
    expect(Math.abs(rs.reduce((a, b) => a + b, 0) / rs.length - BOT_MAIA.ratings.mean)).toBeLessThan(30);
  });

  it("a rating's temperature: looser for weaker ratings, at the calibrated points, and back again", () => {
    for (const [r, s] of BOT_MAIA.skillAt) expect(botSkillForRating(r)).toBe(s);
    for (let r = 600; r < 2400; r += 100) {
      expect(botSkillForRating(r)).toBeGreaterThan(botSkillForRating(r + 100));
      expect(botRatingForSkill(botSkillForRating(r))).toBe(r);
    }
    // (Held at the ends: a seat's bot at a strong temperature plays Maia's top rating.)
    expect(botRatingForSkill(0.25)).toBe(2400);
    expect(botRatingForSkill(500)).toBe(600);
  });

  it("?weakbots=1: never stronger than its loosest skill allows", () => {
    for (const n of names.slice(0, 300)) {
      const s = botStrength(n, { botSkillRange: WEAK_BOT_SKILL });
      expect(s.skill).toBeGreaterThanOrEqual(WEAK_BOT_SKILL[0]);
      expect(botSkillForRating(s.rating)).toBeGreaterThanOrEqual(WEAK_BOT_SKILL[0] - 0.01);
    }
  });
});

describe("a bot's Maia move", () => {
  const moves = [
    { move: "e2e4", p: 0.6 },
    { move: "d2d4", p: 0.3 },
    { move: "g1f3", p: 0.1 },
  ];
  it("drawn from Maia's likeliest within top-p, among the moves allowed", () => {
    const rng = mulberry32(3);
    const seen = new Set(Array.from({ length: 300 }, () => maiaDraw(rng, moves, ["e2e4", "d2d4", "g1f3"], 1, 0.95)));
    expect(seen).toEqual(new Set(["e2e4", "d2d4"]));
    expect(maiaDraw(rng, moves, ["g1f3", "a2a3"], 1, 0.9)).toBe("g1f3");
    expect(maiaDraw(rng, moves, ["a2a3"], 1, 0.9)).toBeNull();
  });

  it("a power-up in a sharp position as before; no answer from Maia: today's pick", () => {
    const rng = mulberry32(4);
    const cands = [
      { move: "d2d4", loss: 0 },
      { move: "e2e4", loss: 40 },
    ];
    const legal = ["e2e4", "d2d4", "g1f3"];
    expect(botChooseWith(rng, cands, { skill: 50, powerUps: 1 }, legal, moves, BOT_MAIA)).toEqual({ move: "d2d4", usedPowerUp: true, byMaia: false });
    expect(botChooseWith(rng, cands, { skill: 50, powerUps: 0 }, legal, [{ move: "g1f3", p: 1 }], BOT_MAIA)).toEqual({ move: "g1f3", usedPowerUp: false, byMaia: true });
    expect(botChooseWith(rng, cands, { skill: 0.01, powerUps: 0 }, legal, null, BOT_MAIA)).toMatchObject({ move: "d2d4", byMaia: false });
  });
});

