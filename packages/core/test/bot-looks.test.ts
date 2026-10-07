import { describe, expect, it } from "vitest";
import { BOT_LOOKS, ITEM_DEFS, SHOP_ITEMS, botLook, isShiny, itemDef, type BotLook } from "../src/index.ts";

/** How many things a look puts on: a shop hat (shown only without a crate head piece) and each crate item. */
const things = (l: BotLook) => Object.keys(l.look).length + (l.hat !== "none" && !l.look.head ? 1 : 0);

describe("bots' outfits", () => {
  const seeds = Array.from({ length: 3000 }, (_, i) => `Bot ${i}`);
  const looks = seeds.map(botLook);

  it("seeded: the same bot always looks the same", () => {
    for (const s of seeds.slice(0, 200)) expect(botLook(s)).toEqual(botLook(s));
    // And bots don't all look alike.
    expect(new Set(looks.map((l) => JSON.stringify(l))).size).toBeGreaterThan(1000);
  });

  it("mostly simple: plenty plain, mostly one thing, rarely two, never more", () => {
    const share = (n: number) => looks.filter((l) => things(l) === n).length / looks.length;
    expect(Math.max(...looks.map(things))).toBe(2);
    expect(share(0)).toBeGreaterThan(0.35);
    expect(share(1)).toBeGreaterThan(0.45);
    expect(share(2)).toBeLessThan(0.1);
    // The odds as set (out of 100).
    const o = BOT_LOOKS.odds;
    const total = Object.values(o).reduce((a, b) => a + b, 0);
    expect(share(0)).toBeCloseTo(o.plain / total, 1);
    expect(share(2)).toBeCloseTo(o.two / total, 1);
    // Weapons now and then.
    const weapons = looks.filter((l) => l.look.weapon).length / looks.length;
    expect(weapons).toBeGreaterThan(0.03);
    expect(weapons).toBeLessThan(0.1);
  });

  it("only items that exist, in their own slots: shop hats and crate head, face and weapon pieces; no skins, no Mythic, never shiny", () => {
    const hats = new Set(SHOP_ITEMS.filter((i) => i.slot === "hat").map((i) => i.look.hat));
    const used = new Set<string>();
    for (const l of looks) {
      expect(hats.has(l.hat)).toBe(true);
      expect(l.look.skin).toBeUndefined();
      for (const [slot, it] of Object.entries(l.look)) {
        const def = itemDef(it!.def)!;
        expect(def.slot).toBe(slot);
        expect(def.tier).not.toBe("mythic");
        expect(isShiny(it!.blemish)).toBe(false);
        expect(it!.color2 !== undefined).toBe(def.colors === 2);
        used.add(def.id);
      }
      if (l.hat !== "none") used.add(l.hat);
    }
    // Every listed item turns up somewhere.
    for (const id of [...BOT_LOOKS.head, ...BOT_LOOKS.face, ...BOT_LOOKS.weapon, ...BOT_LOOKS.shopHats]) expect(used.has(id)).toBe(true);
    expect(ITEM_DEFS.filter((d) => used.has(d.id)).every((d) => d.slot !== "skin")).toBe(true);
  });
});
