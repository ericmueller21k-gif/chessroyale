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
    expect(count["santa-beard"]! / n).toBeCloseTo(0.55, 1);
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
      expect(["gift-tube", "fire-ice-crown"]).toContain(r.def);
      expect(isShiny(r.blemish)).toBe(true);
    }
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
