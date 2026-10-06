import { describe, expect, it } from "vitest";
import { CRATES, ITEM_COLORS, ITEM_DEFS, PURITY_BANDS, TIERS, cleanLook, isShiny, itemChance, itemDef, mulberry32, purity, rollBlemish, rollCrate } from "../src/index.ts";

const crate = CRATES[0]!;

describe("crates", () => {
  it("the odds add up, and every item is in the crate", () => {
    expect(crate.strip.reduce((s, x) => s + x.weight, 0)).toBe(100);
    expect(crate.fischer.reduce((s, x) => s + x.weight, 0)).toBe(100);
    expect(ITEM_COLORS.reduce((s, x) => s + x.weight, 0)).toBeCloseTo(100);
    const total = ITEM_DEFS.reduce((s, d) => s + itemChance(crate, d.id), 0);
    expect(total).toBeCloseTo(1);
    expect(itemChance(crate, "fire-ice-crown")).toBeCloseTo(0.004);
    expect(itemChance(crate, "beanie")).toBeCloseTo(0.16);
  });

  it("each tier is rarer per item than the tier below it", () => {
    const perItem = TIERS.map((t) => ITEM_DEFS.filter((d) => d.tier === t.id).map((d) => itemChance(crate, d.id)));
    for (let i = 1; i < perItem.length; i++) expect(Math.max(...perItem[i]!)).toBeLessThan(Math.min(...perItem[i - 1]!));
  });

  it("rolls land in the right proportions (100,000 opens)", () => {
    const rng = mulberry32(42);
    const n = 100_000;
    const count: Record<string, number> = {};
    let shiny = 0;
    let fischer = 0;
    let pearl = 0;
    let middle = 0;
    let dark = 0;
    for (let i = 0; i < n; i++) {
      const r = rollCrate(rng, crate);
      count[r.def] = (count[r.def] ?? 0) + 1;
      if (isShiny(r.blemish)) shiny++;
      if (r.fischer) fischer++;
      if (r.color === "pearl") pearl++;
      if (purity(r.blemish) >= 30 && purity(r.blemish) < 70) middle++;
      if (purity(r.blemish) < 5) dark++;
      expect(r.blemish).toBeGreaterThanOrEqual(0);
      expect(r.blemish).toBeLessThanOrEqual(100);
    }
    // Novice (four items) about 64% in all, 16% each.
    expect(count["santa-beard"]! / n).toBeCloseTo(0.16, 1);
    const novice = ["santa-beard", "beanie", "ski-goggles", "tree-tee"].reduce((s, d) => s + (count[d] ?? 0), 0) / n;
    expect(novice).toBeGreaterThan(0.63);
    expect(novice).toBeLessThan(0.65);
    // Sublime (four items) about 14% in all, 3.5% each.
    const sublime = ["snowman", "present", "gingerbread", "chimney"].reduce((s, d) => s + (count[d] ?? 0), 0) / n;
    expect(sublime).toBeGreaterThan(0.13);
    expect(sublime).toBeLessThan(0.15);
    expect(fischer / n).toBeGreaterThan(0.015);
    expect(fischer / n).toBeLessThan(0.025);
    // Shiny (90%+) about 1 in 250; most between 30% and 70% (80%); under 5% about 1 in 100. Pearl about 0.5%.
    expect(shiny / n).toBeGreaterThan(0.003);
    expect(shiny / n).toBeLessThan(0.005);
    expect(middle / n).toBeGreaterThan(0.79);
    expect(middle / n).toBeLessThan(0.81);
    expect(dark / n).toBeGreaterThan(0.0085);
    expect(dark / n).toBeLessThan(0.0115);
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

  it("two-colour items (a present, goggles) roll a second colour; one-colour items don't", () => {
    const rng = mulberry32(3);
    const twos: Record<string, number> = {};
    for (let i = 0; i < 5000; i++) {
      const r = rollCrate(rng, crate);
      if (itemDef(r.def)?.colors === 2) {
        twos[r.def] = (twos[r.def] ?? 0) + 1;
        expect(ITEM_COLORS.map((c) => c.id)).toContain(r.color2);
      } else expect(r.color2).toBeUndefined();
    }
    expect(twos["present"]).toBeGreaterThan(100);
    expect(twos["ski-goggles"]).toBeGreaterThan(500);
    expect(cleanLook({ head: { def: "present", color: "red", color2: "cobalt", blemish: 3, seed: 1 } }).head?.color2).toBe("cobalt");
    expect(cleanLook({ head: { def: "santa-hat", color: "red", color2: "cobalt", blemish: 3, seed: 1 } }).head?.color2).toBeUndefined();
  });

  it("purity is shown to one decimal; shiny from 90%", () => {
    expect(purity(8.5)).toBe(91.5);
    expect(isShiny(8.5)).toBe(true);
    expect(isShiny(10)).toBe(true);
    expect(isShiny(10.1)).toBe(false);
    expect(purity(100)).toBe(0);
  });

  it("the purity bands run from 100% to 0% with no gaps, and the roll follows them", () => {
    expect(PURITY_BANDS.reduce((s, b) => s + b.weight, 0)).toBeCloseTo(100);
    expect(PURITY_BANDS[0]!.high).toBe(100);
    expect(PURITY_BANDS[PURITY_BANDS.length - 1]!.low).toBe(0);
    PURITY_BANDS.slice(1).forEach((b, i) => expect(Math.round((PURITY_BANDS[i]!.low - b.high) * 10)).toBe(1));
    const chance = (pred: (low: number) => boolean) => PURITY_BANDS.filter((b) => pred(b.low)).reduce((s, b) => s + b.weight, 0);
    expect(chance((low) => low >= 90)).toBeCloseTo(0.4); // shiny: 1 in 250
    expect(chance((low) => low < 5)).toBeCloseTo(1); // under 5%: 1 in 100
    expect(chance((low) => low >= 30 && low < 70)).toBe(80);
    // The lowest draw is perfect, the highest 0%, and every value is in tenths within 0-100.
    expect(rollBlemish(() => 0)).toBe(0);
    expect(rollBlemish(() => 0.9999999)).toBe(100);
    const rng = mulberry32(11);
    for (let i = 0; i < 20_000; i++) {
      const b = rollBlemish(rng);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(100);
      expect(Math.round(b * 10) / 10).toBe(b);
    }
    // A purer draw is never less pure.
    let last = -1;
    for (let u = 0; u < 1; u += 0.00001) {
      const b = rollBlemish(() => u);
      expect(b).toBeGreaterThanOrEqual(last);
      last = b;
    }
  });

  it("a look from elsewhere keeps only valid slots", () => {
    expect(cleanLook({ head: { def: "santa-hat", color: "emerald", blemish: 8.5, seed: 3 }, face: { def: "santa-hat" }, skin: "x" })).toEqual({
      head: { def: "santa-hat", color: "emerald", blemish: 8.5, seed: 3 },
    });
    // Any purity from 100% to 0% passes, including items rolled under the old 0-49 blemish; beyond is capped.
    expect(cleanLook({ face: { def: "santa-beard", color: "red", blemish: 49, seed: 1 } }).face?.blemish).toBe(49);
    expect(cleanLook({ face: { def: "santa-beard", color: "red", blemish: 100, seed: 1 } }).face?.blemish).toBe(100);
    expect(cleanLook({ face: { def: "santa-beard", color: "red", blemish: 140, seed: 1 } }).face?.blemish).toBe(100);
  });
});
