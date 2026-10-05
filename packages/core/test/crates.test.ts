import { describe, expect, it } from "vitest";
import { CRATES, ITEM_COLORS, ITEM_DEFS, cleanLook, isShiny, itemChance, mulberry32, purity, rollCrate } from "../src/index.ts";

const crate = CRATES[0]!;

describe("crates", () => {
  it("the odds add up, and every item is in the crate", () => {
    expect(crate.strip.reduce((s, x) => s + x.weight, 0)).toBe(100);
    expect(crate.fischer.reduce((s, x) => s + x.weight, 0)).toBe(100);
    expect(ITEM_COLORS.reduce((s, x) => s + x.weight, 0)).toBeCloseTo(100);
    const total = ITEM_DEFS.reduce((s, d) => s + itemChance(crate, d.id), 0);
    expect(total).toBeCloseTo(1);
    expect(itemChance(crate, "fire-ice-crown")).toBeCloseTo(0.004);
  });

  it("rolls land in the right proportions (100,000 opens)", () => {
    const rng = mulberry32(42);
    const n = 100_000;
    const count: Record<string, number> = {};
    let shiny = 0;
    let fischer = 0;
    let pearl = 0;
    for (let i = 0; i < n; i++) {
      const r = rollCrate(rng, crate);
      count[r.def] = (count[r.def] ?? 0) + 1;
      if (isShiny(r.blemish)) shiny++;
      if (r.fischer) fischer++;
      if (r.color === "pearl") pearl++;
      expect(r.blemish).toBeGreaterThanOrEqual(0);
      expect(r.blemish).toBeLessThanOrEqual(49);
    }
    expect(count["santa-beard"]! / n).toBeCloseTo(0.42, 1);
    // Sublime (four items) about 14% in all, 3.5% each.
    const sublime = ["snowman", "present", "gingerbread", "chimney"].reduce((s, d) => s + (count[d] ?? 0), 0) / n;
    expect(sublime).toBeGreaterThan(0.13);
    expect(sublime).toBeLessThan(0.15);
    expect(fischer / n).toBeGreaterThan(0.015);
    expect(fischer / n).toBeLessThan(0.025);
    // Shiny about 2.5% of the time; Pearl about 0.5%.
    expect(shiny / n).toBeGreaterThan(0.018);
    expect(shiny / n).toBeLessThan(0.032);
    expect(pearl / n).toBeGreaterThan(0.003);
    expect(pearl / n).toBeLessThan(0.007);
  });

  it("the test switches force Fischer Random and a shiny", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 50; i++) {
      const r = rollCrate(rng, crate, { fischer: true, shiny: true });
      expect(r.fischer).toBe(true);
      expect(["gift-tube", "candy-cane", "fire-ice-crown"]).toContain(r.def);
      expect(isShiny(r.blemish)).toBe(true);
    }
  });

  it("a present rolls a second colour; one-colour items don't", () => {
    const rng = mulberry32(3);
    let presents = 0;
    for (let i = 0; i < 5000; i++) {
      const r = rollCrate(rng, crate);
      if (r.def === "present") {
        presents++;
        expect(ITEM_COLORS.map((c) => c.id)).toContain(r.color2);
      } else expect(r.color2).toBeUndefined();
    }
    expect(presents).toBeGreaterThan(100);
    expect(cleanLook({ head: { def: "present", color: "red", color2: "cobalt", blemish: 3, seed: 1 } }).head?.color2).toBe("cobalt");
    expect(cleanLook({ head: { def: "santa-hat", color: "red", color2: "cobalt", blemish: 3, seed: 1 } }).head?.color2).toBeUndefined();
  });

  it("purity is shown to one decimal", () => {
    expect(purity(8.5)).toBe(91.5);
    expect(isShiny(8.5)).toBe(true);
    expect(isShiny(10)).toBe(false);
  });

  it("a look from elsewhere keeps only valid slots", () => {
    expect(cleanLook({ head: { def: "santa-hat", color: "emerald", blemish: 8.5, seed: 3 }, face: { def: "santa-hat" }, skin: "x" })).toEqual({
      head: { def: "santa-hat", color: "emerald", blemish: 8.5, seed: 3 },
    });
  });
});
