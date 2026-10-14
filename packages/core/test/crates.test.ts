import { describe, expect, it } from "vitest";
import {
  CRATES,
  FISCHER,
  ITEM_COLORS,
  ITEM_DEFS,
  PURITY_BANDS,
  TIERS,
  cleanLook,
  crateDef,
  fischerOdds,
  isShiny,
  itemChance,
  itemDef,
  liveStrip,
  mulberry32,
  presentChance,
  presentItems,
  purity,
  rollBlemish,
  rollCrate,
  stackItems,
  type CrateDef,
} from "../src/index.ts";

const crate = crateDef("winter-1")!;
const beta = crateDef("beta-001")!;

describe("crates", () => {
  it("the odds add up in every crate, and every item is in exactly one crate", () => {
    expect(ITEM_COLORS.reduce((s, x) => s + x.weight, 0)).toBeCloseTo(100);
    for (const c of CRATES) {
      expect(c.strip.reduce((s, x) => s + x.weight, 0)).toBe(100);
      expect(c.fischer.reduce((s, x) => s + x.weight, 0)).toBe(100);
      expect(fischerOdds(c).reduce((s, x) => s + x.weight, 0)).toBeCloseTo(100);
      expect(ITEM_DEFS.reduce((s, d) => s + itemChance(c, d.id), 0)).toBeCloseTo(1);
      expect(new Set(c.items).size).toBe(c.items.length);
    }
    for (const d of ITEM_DEFS) expect(CRATES.filter((c) => c.items.includes(d.id)).map((c) => c.id), d.id).toHaveLength(1);
    expect(CRATES.map((c) => c.id)).toEqual(["beta-001", "winter-1"]);
  });

  it("Winter: a present's chance, shared evenly by its items", () => {
    // Common 40% over three, Uncommon 26% over two (the Scarf joined the Antlers, Oct 11), Rare 18% over two.
    expect(itemChance(crate, "beanie")).toBeCloseTo(0.4 / 3);
    expect(itemChance(crate, "antlers")).toBeCloseTo(0.13);
    expect(itemChance(crate, "scarf")).toBeCloseTo(0.13);
    expect(itemChance(crate, "ski-goggles")).toBeCloseTo(0.09);
    // Fischer Random: Legendary 80 (the tube and the cane, 40 each), Mythic 20 (the crown), as before.
    expect(fischerOdds(crate)).toEqual([
      { item: "gift-tube", weight: 40 },
      { item: "candy-cane", weight: 40 },
      { item: "fire-ice-crown", weight: 20 },
    ]);
    expect(itemChance(crate, "fire-ice-crown")).toBeCloseTo(0.004);
    expect(itemChance(crate, "party-hat")).toBe(0);
  });

  it("Beta: the same odds as Winter; its supply boxes open evenly, and Fischer Random splits Legendary 80, Mythic 20", () => {
    expect(beta.strip).toEqual(crate.strip);
    expect(beta.fischer).toEqual(crate.fischer);
    expect(itemChance(beta, "party-hat")).toBeCloseTo(0.4 / presentItems(beta, "common").length);
    expect(itemChance(beta, "eyepatch")).toBeCloseTo(0.26 / presentItems(beta, "uncommon").length);
    expect(itemChance(beta, "dark-shades")).toBeCloseTo(0.18 / presentItems(beta, "rare").length);
    expect(itemChance(beta, "suit-and-tie")).toBeCloseTo(0.14 / presentItems(beta, "epic").length);
    const legendary = beta.items.filter((id) => itemDef(id)?.tier === "legendary").length;
    const mythic = beta.items.filter((id) => itemDef(id)?.tier === "mythic").length;
    expect(itemChance(beta, "smiley-face")).toBeCloseTo((0.02 * 0.8) / legendary);
    expect(itemChance(beta, "tommy-gun")).toBeCloseTo((0.02 * 0.2) / mythic);
    // The old shop hats are here now (Eric, Oct 11), and none of Winter's items.
    for (const id of ["party-hat", "wizard-hat", "top-hat", "viking-helm", "little-crown"]) expect(beta.items).toContain(id);
    expect(itemChance(beta, "antlers")).toBe(0);
  });

  it("Beta, complete (28 items): each box's items and every item's chance, each tier's items rarer than the one below's", () => {
    const boxes = Object.fromEntries((["common", "uncommon", "rare", "epic", "legendary", "mythic"] as const).map((t) => [t, beta.items.filter((id) => itemDef(id)?.tier === t)]));
    expect(boxes).toEqual({
      common: ["party-hat", "wizard-hat", "top-hat", "fake-mustache", "fedora", "bandana", "ninja-headband", "shuriken"],
      uncommon: ["viking-helm", "little-crown", "briefcase", "eyepatch", "hook", "ninja-mask", "nunchucks"],
      rare: ["dark-shades", "wire-earpiece", "cutlass", "spyglass", "katana"],
      epic: ["suit-and-tie", "captains-coat", "ninja-hood", "ninja-gi"],
      legendary: ["pirate-hat", "smiley-face"],
      mythic: ["tommy-gun", "parrot"],
    });
    expect(beta.items).toHaveLength(28);
    // Boxes 40/26/18/14 shared evenly (5, 3.71, 3.6 and 3.5% each); Fischer Random 2%: Legendary 80 (0.8% each),
    // Mythic 20 (0.2% each).
    const chance: Record<string, number> = { common: 0.05, uncommon: 0.26 / 7, rare: 0.036, epic: 0.035, legendary: 0.008, mythic: 0.002 };
    for (const [tier, ids] of Object.entries(boxes)) for (const id of ids) expect(itemChance(beta, id), id).toBeCloseTo(chance[tier]!, 6);
    // The ladder holds item by item: any one item is rarer than any one item of the tier below.
    const each = TIERS.map((t) => chance[t.id]!);
    for (let i = 1; i < each.length; i++) expect(each[i]!).toBeLessThan(each[i - 1]!);
    expect(fischerOdds(beta)).toEqual([
      { item: "pirate-hat", weight: 40 },
      { item: "smiley-face", weight: 40 },
      { item: "tommy-gun", weight: 10 },
      { item: "parrot", weight: 10 },
    ]);
  });

  it("the strip: a box per tier, each rarer than the one below, then Fischer Random at 2%; every tier holds something", () => {
    for (const c of CRATES) {
      const tiers = c.strip.map((x) => x.tier);
      expect(tiers).toEqual(["common", "uncommon", "rare", "epic", FISCHER]);
      for (let i = 1; i < c.strip.length; i++) expect(c.strip[i]!.weight).toBeLessThan(c.strip[i - 1]!.weight);
      expect(presentChance(c, FISCHER)).toBeCloseTo(0.02);
      // A live crate is whole: every box holds something, and so does each tier behind Fischer Random.
      expect(liveStrip(c)).toEqual(c.strip);
      for (const t of tiers.filter((t) => t !== FISCHER)) expect(presentItems(c, t).length, `${c.id} ${t}`).toBeGreaterThan(0);
      for (const f of c.fischer) expect(c.items.some((id) => itemDef(id)?.tier === f.tier), `${c.id} ${f.tier}`).toBe(true);
    }
    expect(TIERS.length).toBe(6);
  });

  it("a tier is one field: an item moves between a box and Fischer Random by its tier alone; an empty tier is left out", () => {
    // A crate being filled: no Epic items and no Mythic one yet.
    const partial: CrateDef = { ...beta, id: "test", items: ["party-hat", "eyepatch", "dark-shades", "smiley-face"] };
    expect(liveStrip(partial).map((x) => x.tier)).toEqual(["common", "uncommon", "rare", FISCHER]);
    expect(fischerOdds(partial)).toEqual([{ item: "smiley-face", weight: 100 }]);
    expect(ITEM_DEFS.reduce((s, d) => s + itemChance(partial, d.id), 0)).toBeCloseTo(1);
    const rng = mulberry32(5);
    for (let i = 0; i < 3000; i++) expect(partial.items).toContain(rollCrate(rng, partial).def);
    // Nothing behind Fischer Random: the test switch can't land there either.
    const noFischer: CrateDef = { ...partial, items: ["party-hat"] };
    expect(liveStrip(noFischer).map((x) => x.tier)).toEqual(["common"]);
    expect(rollCrate(mulberry32(1), noFischer, { fischer: true })).toMatchObject({ fischer: false, def: "party-hat" });
  });

  it("the tiers: Common to Mythic, commonest first, each in its color", () => {
    // The order sorts the locker (rarest first). The Puzzle Pirates names are player ranks now (Oct 6, 2026).
    expect(TIERS.map((t) => `${t.name} ${t.color}`)).toEqual([
      "Common #9ca3af",
      "Uncommon #4ade80",
      "Rare #60a5fa",
      "Epic #c084fc",
      "Legendary #fbbf24",
      "Mythic #f43f5e",
    ]);
    for (const t of TIERS) expect(t.id).toBe(t.name.toLowerCase());
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
    // The Common present (three items, evenly) about 40% in all, a third each; Rare (two items) 18%, 9% each.
    const common = ["santa-beard", "beanie", "tree-tee"];
    const commonShare = common.reduce((s, d) => s + (count[d] ?? 0), 0) / n;
    expect(commonShare).toBeGreaterThan(0.39);
    expect(commonShare).toBeLessThan(0.41);
    for (const d of common) {
      expect(count[d]! / n).toBeGreaterThan(0.128);
      expect(count[d]! / n).toBeLessThan(0.139);
    }
    for (const d of ["santa-hat", "ski-goggles"]) {
      expect(count[d]! / n).toBeGreaterThan(0.085);
      expect(count[d]! / n).toBeLessThan(0.095);
    }
    // Uncommon (the Antlers and the Scarf) 26%, 13% each.
    for (const d of ["antlers", "scarf"]) {
      expect(count[d]! / n).toBeGreaterThan(0.125);
      expect(count[d]! / n).toBeLessThan(0.135);
    }
    // Epic (four items) about 14% in all, 3.5% each.
    const epic = ["snowman", "present", "gingerbread", "chimney"].reduce((s, d) => s + (count[d] ?? 0), 0) / n;
    expect(epic).toBeGreaterThan(0.13);
    expect(epic).toBeLessThan(0.15);
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

  it("Beta's rolls land in the right proportions (60,000 opens)", () => {
    const rng = mulberry32(43);
    const n = 60_000;
    const tiers: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const r = rollCrate(rng, beta);
      expect(beta.items).toContain(r.def);
      const t = itemDef(r.def)!.tier;
      tiers[t] = (tiers[t] ?? 0) + 1;
    }
    expect(tiers["common"]! / n).toBeCloseTo(0.4, 1);
    expect(tiers["uncommon"]! / n).toBeCloseTo(0.26, 1);
    expect(tiers["rare"]! / n).toBeCloseTo(0.18, 1);
    expect(tiers["epic"]! / n).toBeCloseTo(0.14, 1);
    expect(((tiers["legendary"] ?? 0) + (tiers["mythic"] ?? 0)) / n).toBeGreaterThan(0.015);
    expect(((tiers["legendary"] ?? 0) + (tiers["mythic"] ?? 0)) / n).toBeLessThan(0.025);
  });

  it("the test switches force Fischer Random and a shiny", () => {
    const rng = mulberry32(7);
    for (const [c, list] of [
      [crate, ["gift-tube", "candy-cane", "fire-ice-crown"]],
      [beta, beta.items.filter((id) => ["legendary", "mythic"].includes(itemDef(id)!.tier))],
    ] as const) {
      const seen = new Set<string>();
      for (let i = 0; i < 200; i++) {
        const r = rollCrate(rng, c, { fischer: true, shiny: true });
        expect(r.fischer).toBe(true);
        expect(list).toContain(r.def);
        expect(isShiny(r.blemish)).toBe(true);
        seen.add(r.def);
      }
      expect(seen.size).toBe(list.length);
    }
  });

  it("two-color items (a present, goggles) roll a second color; one-color items don't", () => {
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
    expect(twos["ski-goggles"]).toBeGreaterThan(300);
    // Beta's: the suit (and its tie), the Tommy Gun (metal and wood) and the Parrot (body, wings and tail).
    for (let i = 0; i < 400; i++) {
      const r = rollCrate(rng, beta, { fischer: i % 2 === 0 });
      expect(r.color2 !== undefined, r.def).toBe(itemDef(r.def)?.colors === 2);
    }
    expect(itemDef("suit-and-tie")?.colors).toBe(2);
    expect(itemDef("tommy-gun")?.colors).toBe(2);
    expect(itemDef("parrot")?.colors).toBe(2);
    expect(ITEM_DEFS.filter((d) => crateDef("beta-001")!.items.includes(d.id) && d.colors === 2).map((d) => d.id)).toEqual(["suit-and-tie", "tommy-gun", "parrot"]);
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

  it("the locker stacks copies of an item in the same color (both colors, for two-color ones), the purest on top", () => {
    const it = (id: string, def: string, color: string, blemish: number, color2?: string) => ({ id, def, color, blemish, seed: 1, ...(color2 ? { color2 } : {}) });
    const stacks = stackItems([
      it("a", "santa-beard", "red", 40),
      it("b", "santa-beard", "red", 12),
      it("c", "santa-beard", "cobalt", 5),
      it("d", "present", "red", 30, "emerald"),
      it("e", "present", "red", 20, "cobalt"),
      it("f", "santa-beard", "red", 70),
      it("g", "present", "red", 50, "emerald"),
    ]);
    expect(stacks.map((s) => s.items.map((i) => i.id))).toEqual([["b", "a", "f"], ["c"], ["d", "g"], ["e"]]);
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
