import { describe, expect, it } from "vitest";
import {
  CRATES,
  ITEM_SLOTS,
  SLOT_NAMES,
  aboveHat,
  FISCHER,
  ITEM_COLORS,
  ITEM_DEFS,
  PURITY_BANDS,
  purityOddsText,
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
  secondColor,
  smileyExpression,
  itemName,
  SMILEY_EXPRESSIONS,
  rollCrate,
  stackItems,
  shownLook,
  mountOf,
  hiddenByOutfit,
  ownsOutfit,
  BOSS_CRATES,
  BOSS_CRATE_POOL,
  MYTHIC_CRATE_ITEMS,
  MYTHIC_CRATE,
  MYTHIC_CRATE_ODDS,
  OUTFIT,
  BOSS_ADMIN_FIRST,
  HUNCHESS_RIDES,
  WELCOME_CRATE,
  hunchessBase,
  rollWelcome,
  type CrateDef,
  type ItemLook,
} from "../src/index.ts";

/** Items in no crate yet (Oct 31: the rides; admins have them, and their crate comes later). One by one, never a whole slot. */
// (Every ride, Nov 1: admins only until their crate comes.)
const NO_CRATE_YET = ["riding-chirp", "moon-ride", "hollow-bulb", "smudgy-brush", "alfil-howdah", "balloon-pup", "bigboy-buggy", "boingo-pogo", "folio-crane", "ginger-sled", "jefferson-giraffe", "puddles-mower", "sawyer-dozer", "rodeo-bull", "cheetah-shoes", "log-roller", "pen-pony", "birdie-train"];

const crate = crateDef("winter-1")!;
const beta = crateDef("beta-001")!;

describe("crates", () => {
  it("the odds add up in every crate, and every item is in exactly one crate (but the rides with no crate yet: theirs comes later)", () => {
    expect(ITEM_COLORS.reduce((s, x) => s + x.weight, 0)).toBeCloseTo(100);
    for (const c of CRATES) {
      expect(c.strip.reduce((s, x) => s + x.weight, 0)).toBe(100);
      expect(c.fischer.reduce((s, x) => s + x.weight, 0)).toBe(100);
      expect(fischerOdds(c).reduce((s, x) => s + x.weight, 0)).toBeCloseTo(100);
      expect(ITEM_DEFS.reduce((s, d) => s + itemChance(c, d.id), 0)).toBeCloseTo(1);
      expect(new Set(c.items).size).toBe(c.items.length);
    }
    // (A HunChess colorway, Nov 6: in none of these, only the Welcome Crate: welcome.test.ts.)
    for (const d of ITEM_DEFS) expect(CRATES.filter((c) => c.items.includes(d.id)).map((c) => c.id), d.id).toHaveLength(NO_CRATE_YET.includes(d.id) || d.hunchess || d.slot === "outfit" ? 0 : 1);
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
    // Exactly 100% and exactly 0%: bands of their own, 1 in 5,000 each (Eric, Nov 27); shiny still 1 in 250 in all.
    const top = PURITY_BANDS.find((b) => b.low === 100 && b.high === 100)!;
    const zero = PURITY_BANDS.find((b) => b.low === 0 && b.high === 0)!;
    expect(Math.round(100 / top.weight)).toBe(5000);
    expect(Math.round(100 / zero.weight)).toBe(5000);
    // The roll's first draw gives 100% (blemish 0), its last 0% (blemish 100); just inside them, 99.9% and 0.1%.
    const total = PURITY_BANDS.reduce((s, b) => s + b.weight, 0);
    expect(rollBlemish(() => top.weight / 2 / total)).toBe(0);
    expect(rollBlemish(() => (top.weight * 1.0001) / total)).toBe(0.1);
    expect(rollBlemish(() => (total - zero.weight / 2) / total)).toBe(100);
    expect(rollBlemish(() => (total - zero.weight * 1.5) / total)).toBe(99.9);
    // (Unchanged per tenth: 99.0-99.9 each 0.004/11 %, 0.1-4.9 each 0.02%.)
    const b99 = PURITY_BANDS.find((b) => b.low === 99)!;
    expect(b99.weight / 10).toBeCloseTo(0.004 / 11, 12);
    const b0 = PURITY_BANDS.find((b) => b.low === 0.1)!;
    expect(b0.weight / 49).toBeCloseTo(0.02, 12);
    // (Shown exactly, never a long float: the review of #1007.)
    expect(PURITY_BANDS.map((b) => purityOddsText(b.weight))).toEqual(["1 in 5,000", "1 in 27,500", "0.376%", "9.6%", "80%", "9%", "0.98%", "1 in 5,000"]);
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

  it("the gift tube's second stripe color comes from its seed: stable, never its first color, by the color odds", () => {
    const tube = (color: string, seed: number) => ({ def: "gift-tube", color, seed });
    const counts = new Map<string, number>();
    for (let seed = 0; seed < 20000; seed++) {
      const c2 = secondColor(tube("red", seed * 104729 + 7))!;
      expect(c2).toBe(secondColor(tube("red", seed * 104729 + 7)));
      expect(c2).not.toBe("red");
      counts.set(c2, (counts.get(c2) ?? 0) + 1);
    }
    // Every other color turns up, by its odds among the colors that aren't the first (yellow 30 of 70).
    expect([...counts.keys()].sort()).toEqual(ITEM_COLORS.map((c) => c.id).filter((c) => c !== "red").sort());
    expect(counts.get("yellow")! / 20000).toBeCloseTo(30 / 70, 1);
    // A different first color can give a different second; a stored second color (two-color items) is kept; other
    // one-color items have none.
    for (const c of ITEM_COLORS) expect(secondColor(tube(c.id, 123))).not.toBe(c.id);
    expect(secondColor({ def: "present", color: "red", color2: "emerald", seed: 5 })).toBe("emerald");
    expect(secondColor({ def: "santa-beard", color: "red", seed: 5 })).toBeUndefined();
    // So the locker stacks tubes by both colors.
    const a = tube("red", 1);
    const b = [2, 3, 4, 5, 6, 7, 8].map((s) => tube("red", s)).find((t) => secondColor(t) !== secondColor(a))!;
    const items = [a, b, { ...a, seed: a.seed }].map((t, i) => ({ ...t, id: String(i), blemish: i }));
    expect(stackItems(items).map((s) => s.items.map((i) => i.id))).toEqual([["0", "2"], ["1"]]);
  });

  it("a Smiley Face's expression comes from its seed: stable, even odds across the six, named on its card; nothing stored", () => {
    const smiley = (seed: number) => ({ def: "smiley-face", color: "yellow", seed });
    const counts = new Map<string, number>();
    for (let seed = 0; seed < 24000; seed++) {
      const s = smiley(seed * 104729 + 7);
      const face = smileyExpression(s)!;
      expect(smileyExpression(s)).toBe(face);
      // (The color and purity don't change it: only the seed.)
      expect(smileyExpression({ ...s, color: "pearl" } as typeof s)).toBe(face);
      counts.set(face.id, (counts.get(face.id) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual(SMILEY_EXPRESSIONS.map((e) => e.id).sort());
    for (const n of counts.values()) expect(n / 24000).toBeCloseTo(1 / 6, 1);
    // Other items have none; the name says it ("Smiley Face · Wink"), others keep theirs.
    expect(smileyExpression({ def: "pirate-hat", seed: 5 })).toBeUndefined();
    const wink = [...Array(50).keys()].map(smiley).find((s) => smileyExpression(s)!.id === "wink")!;
    expect(itemName(wink)).toBe("Smiley Face · Wink");
    expect(itemName({ def: "pirate-hat", seed: 5 })).toBe("Pirate Hat");
    // The locker doesn't stack two expressions together; the same one stacks.
    const other = [...Array(50).keys()].map(smiley).find((s) => smileyExpression(s)!.id !== "wink")!;
    const items = [wink, other, { ...wink }].map((t, i) => ({ ...t, id: String(i), blemish: i }));
    expect(stackItems(items).map((s) => s.items.map((i) => i.id))).toEqual([["0", "2"], ["1"]]);
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

describe("face items over or under a hat", () => {
  it("every face item says which (faceLayer), no other item does, and only goggles and shades go above (Eric, Oct 30)", () => {
    for (const d of ITEM_DEFS) {
      if (d.slot === "face") expect(["above", "below"], d.id).toContain(d.faceLayer);
      else expect(d.faceLayer, d.id).toBeUndefined();
    }
    expect(ITEM_DEFS.filter((d) => d.faceLayer === "above").map((d) => d.id).sort()).toEqual(["dark-shades", "ski-goggles"]);
    expect(aboveHat("ski-goggles")).toBe(true);
    expect(aboveHat("smiley-face")).toBe(false);
  });
});

describe("boss crates", () => {
  it("every one the same template (Nov 23, Birdie's too): the Beta strip and its 80/20 Fischer Random, the Beta pool and its boss's ride, the only Mythic, at one chance", () => {
    const ride = itemChance(BOSS_CRATES[0]!, BOSS_CRATES[0]!.ride);
    for (const c of BOSS_CRATES) {
      expect([c.id, c.look, c.strip, c.fischer], c.id).toEqual([`boss-${c.boss}`, "beta", beta.strip, [{ tier: "legendary", weight: 80 }, { tier: "mythic", weight: 20 }]]);
      expect(c.items, c.id).toEqual([...BOSS_CRATE_POOL, c.ride]);
      expect(c.items.filter((id) => itemDef(id)!.tier === "mythic"), c.id).toEqual([c.ride]);
      expect(itemChance(c, c.ride), c.id).toBeCloseTo(ride, 12);
      expect(ITEM_DEFS.reduce((t, d) => t + itemChance(c, d.id), 0), c.id).toBeCloseTo(1);
    }
    // (No Legendary in the pool: the ride is the only item behind Fischer Random, so it is all of its 2%; shop.md, "The crates".)
    expect(fischerOdds(BOSS_CRATES[0]!)).toEqual([{ item: BOSS_CRATES[0]!.ride, weight: 100 }]);
    expect(ride).toBeCloseTo(0.02, 12);
    expect(BOSS_CRATES.find((c) => c.boss === "birdie")).toMatchObject({ name: "Birdie's Boss Crate", ride: "birdie-train", blurb: "Birdie's Train, and the Beta Crate's hats, shades and gear" });
  });

  it("no Welcome Crate ride belongs to an admins-first boss (Nov 23): every other ride's HunChess colorway is in, and a holder's left-out ride leaves out nothing", () => {
    const bossOf = (def: string) => BOSS_CRATES.find((c) => c.ride === hunchessBase(def))?.boss;
    const out = HUNCHESS_RIDES.filter((d) => BOSS_ADMIN_FIRST.includes(bossOf(d.id) ?? "")).map((d) => d.id);
    // (Timber's, Dash's and Birdie's while they're admins first; each comes back by itself when its boss leaves BOSS_ADMIN_FIRST.)
    for (const boss of ["timber", "dash", "birdie"].filter((b) => BOSS_ADMIN_FIRST.includes(b))) expect(out).toContain(`${BOSS_CRATES.find((c) => c.boss === boss)!.ride}-hunchess`);
    expect(WELCOME_CRATE.items).toEqual(HUNCHESS_RIDES.map((d) => d.id).filter((id) => !out.includes(id)));
    // (A holder's left-out ride as `won`: a roll at each listed ride's middle reaches every listed ride, so it drops none.)
    const n = WELCOME_CRATE.items.length;
    const rolled = WELCOME_CRATE.items.map((_, i) => rollWelcome(() => (i + 0.5) / n, out.slice(0, 1)).def);
    expect(new Set(rolled)).toEqual(new Set(WELCOME_CRATE.items));
  });
});

describe("rides (Oct 31)", () => {
  it("a slot of their own, one ride at a time, Mythic, in no crate yet (admins only until its crate comes)", () => {
    expect(ITEM_SLOTS).toEqual(["head", "face", "skin", "weapon", "ride", "outfit"]);
    expect(SLOT_NAMES.ride).toBe("Ride");
    // (Nov 6: each ride's HunChess colorway is a ride too, made from it: welcome.test.ts. These are the rides themselves.)
    const rides = ITEM_DEFS.filter((d) => d.slot === "ride" && !d.hunchess);
    // (Nov 1, every boss's: the drawings' names.)
    expect(rides.map((d) => [d.id, d.name, d.tier])).toEqual([
      ["riding-chirp", "Riding Chirp", "mythic"],
      ["moon-ride", "Moon's Ride", "mythic"],
      ["hollow-bulb", "Hollow's Bulb", "mythic"],
      ["smudgy-brush", "Brush Ride", "mythic"],
      ["alfil-howdah", "Alfil's Howdah", "mythic"],
      ["balloon-pup", "Balloon Pup", "mythic"],
      ["bigboy-buggy", "Big Boy's Buggy", "mythic"],
      ["boingo-pogo", "Boingo's Pogo", "mythic"],
      ["folio-crane", "Paper Crane", "mythic"],
      ["ginger-sled", "Candy Cane Sled", "mythic"],
      ["jefferson-giraffe", "Giraffe Gallop", "mythic"],
      ["puddles-mower", "Puddles's Mower", "mythic"],
      ["sawyer-dozer", "Sawyer's Dozer", "mythic"],
      ["rodeo-bull", "Rodeo Bull", "mythic"],
      ["cheetah-shoes", "Cheetah Shoes", "mythic"],
      ["log-roller", "The Log Roller", "mythic"],
      ["pen-pony", "Pen Pony", "mythic"],
      ["birdie-train", "Birdie's Train", "mythic"],
    ]);
    for (const d of rides) {
      expect(CRATES.some((c) => c.items.includes(d.id)), d.id).toBe(false);
      for (const c of CRATES) expect(itemChance(c, d.id)).toBe(0);
      // (One color, but Hollow's Bulb: its glow is the second, as drawn.)
      expect(d.colors).toBe(d.id === "hollow-bulb" ? 2 : undefined);
      expect(d.faceLayer).toBeUndefined();
    }
  });

  it("a look keeps its ride (color, purity, seed) and drops one in another slot or that isn't a ride", () => {
    const ride = { def: "moon-ride", color: "cobalt", blemish: 37.5, seed: 9 };
    expect(cleanLook({ ride, head: { def: "beanie", color: "red", blemish: 1, seed: 2 } })).toEqual({ ride, head: { def: "beanie", color: "red", blemish: 1, seed: 2 } });
    expect(cleanLook({ ride: { def: "beanie", color: "red", blemish: 1, seed: 2 } })).toEqual({});
    expect(cleanLook({ head: ride })).toEqual({});
    expect(cleanLook({ ride: { def: "riding-chirp", color: "nope", blemish: 500, seed: -3 } }).ride).toEqual({ def: "riding-chirp", color: "red", blemish: 100, seed: 3 });
  });
});

describe("outfits (Eric, Nov 10)", () => {
  const it_ = (def: string) => ({ def, color: "red", blemish: 10, seed: 3 });
  const look: ItemLook = { head: it_("top-hat"), face: it_("ski-goggles"), skin: it_("snowman"), weapon: it_("katana"), ride: it_("moon-ride"), outfit: it_("banana-suit") };

  it("a secret slot of its own; the Banana Suit is Mythic, the Mythic Crate's secret item, in no other crate", () => {
    expect(SLOT_NAMES.outfit).toBe("Outfit");
    expect(ITEM_DEFS.filter((d) => d.slot === "outfit").map((d) => [d.id, d.name, d.tier])).toEqual([["banana-suit", "Banana Suit", "mythic"]]);
    expect(MYTHIC_CRATE_ITEMS).toEqual(["banana-suit"]);
    for (const c of [...CRATES, ...BOSS_CRATES]) expect(c.items, c.id).not.toContain("banana-suit");
    expect(ownsOutfit([{ def: "top-hat" }])).toBe(false);
    expect(ownsOutfit([{ def: "top-hat" }, { def: "banana-suit" }])).toBe(true);
    expect(cleanLook({ outfit: it_("banana-suit") }).outfit?.def).toBe("banana-suit");
    expect(cleanLook({ outfit: it_("top-hat") }).outfit).toBeUndefined();
  });

  it("an outfit hides every other worn item but eyewear (goggles, shades), which still shows", () => {
    expect(OUTFIT.eyewear).toBe(true);
    expect(ITEM_DEFS.filter((d) => d.eyewear).map((d) => d.id).sort()).toEqual(["dark-shades", "ski-goggles"]);
    expect(shownLook(look)).toEqual({ outfit: look.outfit, face: look.face });
    expect(shownLook({ ...look, face: it_("santa-beard") })).toEqual({ outfit: look.outfit });
    expect(mountOf(shownLook(look))?.def).toBe("banana-suit");
    for (const d of ["top-hat", "snowman", "katana", "moon-ride", "santa-beard"]) expect(hiddenByOutfit(look, d), d).toBe(true);
    for (const d of ["ski-goggles", "dark-shades", "banana-suit"]) expect(hiddenByOutfit(look, d), d).toBe(false);
  });

  it("taking it off brings everything back: nothing else is unequipped (the look keeps every slot)", () => {
    const { outfit: _, ...rest } = look;
    expect(shownLook(rest)).toBe(rest);
    expect(mountOf(rest)?.def).toBe("moon-ride");
    expect(hiddenByOutfit(rest, "top-hat")).toBe(false);
    expect(shownLook(undefined)).toBeUndefined();
  });
});

describe("the Mythic Crate and its secret prize, the Banana Suit (Eric, Nov 10; Nov 27)", () => {
  const pullOf = (c: CrateDef) => c.items.filter((id) => ["legendary", "mythic"].includes(itemDef(id)!.tier));

  it("every opening is a Transcendent spin over the series crates' Legendary and Mythic items, and the suit", () => {
    expect(crateDef("mythic")).toBe(MYTHIC_CRATE);
    expect(CRATES.map((c) => c.id)).not.toContain("mythic");
    expect(liveStrip(MYTHIC_CRATE)).toEqual([{ tier: FISCHER, weight: 100 }]);
    expect(presentChance(MYTHIC_CRATE, FISCHER)).toBe(1);
    expect([...MYTHIC_CRATE.items].sort()).toEqual([...new Set([...CRATES.flatMap(pullOf), "banana-suit"])].sort());
    expect(MYTHIC_CRATE.prize).toEqual({ item: "banana-suit", weight: MYTHIC_CRATE_ODDS.bananaSuit });
  });

  it("the suit's odds are the setting's; Legendary keeps its 80; the other Mythic items share the rest of the 20", () => {
    expect(MYTHIC_CRATE_ODDS.bananaSuit).toBe(2);
    const odds = new Map(fischerOdds(MYTHIC_CRATE).map((x) => [x.item, x.weight]));
    expect(odds.get("banana-suit")).toBeCloseTo(2, 9);
    const legendary = pullOf(MYTHIC_CRATE).filter((id) => itemDef(id)!.tier === "legendary");
    const mythic = pullOf(MYTHIC_CRATE).filter((id) => itemDef(id)!.tier === "mythic" && id !== "banana-suit");
    for (const id of legendary) expect(odds.get(id), id).toBeCloseTo(80 / legendary.length, 9);
    for (const id of mythic) expect(odds.get(id), id).toBeCloseTo(18 / mythic.length, 9);
    expect([...odds.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(100, 9);
    // The crate page's odds (itemChance) say the same, and add up to every opening.
    expect(itemChance(MYTHIC_CRATE, "banana-suit")).toBeCloseTo(0.02, 9);
    expect(MYTHIC_CRATE.items.reduce((a, id) => a + itemChance(MYTHIC_CRATE, id), 0)).toBeCloseTo(1, 9);
  });

  it("no other crate's odds change: each Transcendent tier still shared evenly, no prize anywhere else", () => {
    for (const c of [...CRATES, ...BOSS_CRATES]) {
      expect(c.prize, c.id).toBeUndefined();
      const live = c.fischer.filter((f) => pullOf(c).some((id) => itemDef(id)!.tier === f.tier));
      const total = live.reduce((a, f) => a + f.weight, 0);
      const was = live.flatMap((f) => {
        const list = pullOf(c).filter((id) => itemDef(id)!.tier === f.tier);
        return list.map((item) => ({ item, weight: (100 * f.weight) / total / list.length }));
      });
      expect(fischerOdds(c), c.id).toEqual(was);
    }
  });

  it("rolls by its odds over many seeds (the suit about 2%, Legendary about 80%), each a whole item with a color and purity", () => {
    const n = 40000;
    const counts = new Map<string, number>();
    for (let seed = 0; seed < n; seed++) {
      const roll = rollCrate(mulberry32(seed * 7919 + 1), MYTHIC_CRATE);
      expect(roll.fischer).toBe(true);
      counts.set(roll.def, (counts.get(roll.def) ?? 0) + 1);
      if (roll.def === "banana-suit") expect(ITEM_COLORS.map((c) => c.id)).toContain(roll.color);
    }
    expect([...counts.keys()].sort()).toEqual([...MYTHIC_CRATE.items].sort());
    expect(Math.abs(counts.get("banana-suit")! / n - 0.02)).toBeLessThan(0.004);
    const legendary = MYTHIC_CRATE.items.filter((id) => itemDef(id)!.tier === "legendary").reduce((a, id) => a + (counts.get(id) ?? 0), 0);
    expect(Math.abs(legendary / n - 0.8)).toBeLessThan(0.01);
  });

  it("the suit never rolls from any other crate (Transcendent forced, many seeds)", () => {
    for (const c of [...CRATES, ...BOSS_CRATES, WELCOME_CRATE]) {
      expect(c.items, c.id).not.toContain("banana-suit");
      for (let seed = 0; seed < 2000; seed++) {
        expect(rollCrate(mulberry32(seed), c).def, c.id).not.toBe("banana-suit");
        expect(rollCrate(mulberry32(seed), c, { fischer: true }).def, c.id).not.toBe("banana-suit");
      }
    }
  });
});
