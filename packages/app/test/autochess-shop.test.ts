import { describe, expect, it } from "vitest";
import { AUTOCHESS, mulberry32 } from "@chessroyale/core";
import { emptyArmy } from "../src/autochess/army.ts";
import { beginRound, newMatch, roundSeed } from "../src/autochess/economy.ts";
import { buyFromSlot, newShop, refillSlot, rerollBlock, rerollFor, rerollShop, rerollWords, rollKind, shopSeed } from "../src/autochess/shop.ts";
import { KINDS, type Army, type Kind } from "../src/autochess/types.ts";

const share = (kinds: readonly Kind[]) => Object.fromEntries(KINDS.map((k) => [k, (100 * kinds.filter((x) => x === k).length) / kinds.length])) as Record<Kind, number>;

describe("auto chess: the shop (v5)", () => {
  it("holds the design's numbers: 5 slots, pawn 75% knight 10% bishop 8% rook 5% queen 2%, a reroll for 5, prices unchanged", () => {
    expect(AUTOCHESS.shop).toEqual({ slots: 5, odds: { p: 75, n: 10, b: 8, r: 5, q: 2 }, rerollCost: 5 });
    expect(Object.values(AUTOCHESS.shop.odds).reduce((a, b) => a + b, 0)).toBe(100);
    expect(AUTOCHESS.prices).toEqual({ p: 10, n: 30, b: 32, r: 50, q: 90 });
  });

  it("rolls pieces at the odds, over many rolls (single rolls, and the slots of many seeded shops)", () => {
    const rng = mulberry32(12345);
    const rolled = Array.from({ length: 40000 }, () => rollKind(rng));
    for (const k of KINDS) expect(Math.abs(share(rolled)[k] - AUTOCHESS.shop.odds[k]), `${k} rolled`).toBeLessThan(1);
    const slots = Array.from({ length: 6000 }, (_, seed) => newShop(shopSeed(seed)).slots).flat();
    expect(slots).toHaveLength(30000);
    for (const k of KINDS) expect(Math.abs(share(slots)[k] - AUTOCHESS.shop.odds[k]), `${k} in shops`).toBeLessThan(1);
    // The odds are a setting: all queens when the setting says so.
    const queens = { ...AUTOCHESS, shop: { ...AUTOCHESS.shop, odds: { p: 0, n: 0, b: 0, r: 0, q: 1 } } };
    expect(newShop(7, queens).slots).toEqual(["q", "q", "q", "q", "q"]);
  });

  it("a round's shop has 5 slots and is the same for the same seed; another round shows another shop", () => {
    const a = newShop(shopSeed(99));
    expect(a.slots).toHaveLength(5);
    expect(a).toEqual(newShop(shopSeed(99)));
    let differs = 0;
    for (let seed = 0; seed < 100; seed++) {
      const m1 = beginRound(newMatch(seed)).match;
      const m2 = beginRound(m1).match;
      expect(newShop(shopSeed(roundSeed(m1))).slots).toHaveLength(5);
      if (newShop(shopSeed(roundSeed(m1))).slots.join("") !== newShop(shopSeed(roundSeed(m2))).slots.join("")) differs++;
    }
    expect(differs).toBeGreaterThan(80);
  });

  it("buying a piece rolls a new piece into that slot only, takes the price, and is repeatable", () => {
    const army: Army = emptyArmy("w", "e1");
    const shop = { slots: ["p", "n", "r", "p", "q"] as Kind[], rerolls: 0, refills: 0 };
    const bought = buyFromSlot({ army, gold: 100, shop }, 1, 5);
    if ("block" in bought) throw new Error("should buy");
    expect(bought.army.bench).toEqual(["n"]);
    expect(bought.gold).toBe(70);
    expect(bought.shop.slots).toHaveLength(5);
    // Only slot 1 may have changed.
    expect(bought.shop.slots.filter((_, i) => i !== 1)).toEqual(["p", "r", "p", "q"]);
    expect(KINDS).toContain(bought.shop.slots[1]);
    expect(buyFromSlot({ army, gold: 100, shop }, 1, 5)).toEqual(bought);
    // Buying the same slot again rolls again (the refill count moves the seed on): over many buys it isn't always the same piece.
    let s = shop;
    const seen = new Set<Kind>();
    for (let i = 0; i < 40; i++) {
      s = refillSlot(s, 0, 5);
      seen.add(s.slots[0]!);
    }
    expect(seen.size).toBeGreaterThan(1);
    expect(s.refills).toBe(40);
    // A slot you can't buy stays as it is, and its reason is the shop's usual one.
    expect(buyFromSlot({ army, gold: 60, shop }, 4, 5)).toEqual({ block: "gold" });
    expect(buyFromSlot({ army: { ...army, bench: Array<Kind>(8).fill("p") }, gold: 500, shop }, 0, 5)).toEqual({ block: "pawns" });
    expect(buyFromSlot({ army: { ...army, bench: Array<Kind>(8).fill("n").map((k, i) => (i < 2 ? "n" : "b")) }, gold: 500, shop }, 0, 5)).toEqual({ block: "bench" });
    expect(buyFromSlot({ army: { ...army, bench: ["q"] }, gold: 500, shop }, 4, 5)).toEqual({ block: "queen" });
  });

  it("a reroll costs 5 for all five slots, is refused under 5, and is seeded by the reroll count", () => {
    const shop = newShop(shopSeed(3));
    const next = rerollFor({ gold: 12, shop }, shopSeed(3));
    if ("block" in next) throw new Error("should reroll");
    expect(next.gold).toBe(7);
    expect(next.shop.slots).toHaveLength(5);
    expect(next.shop.rerolls).toBe(1);
    expect(rerollFor({ gold: 12, shop }, shopSeed(3))).toEqual(next);
    expect(rerollFor({ gold: 4, shop }, shopSeed(3))).toEqual({ block: "gold" });
    expect(rerollFor({ gold: 5, shop }, shopSeed(3))).toMatchObject({ gold: 0 });
    expect(rerollBlock(4)).toBe("gold");
    expect(rerollBlock(5)).toBeNull();
    expect(rerollWords(2)).toBe("Not enough gold: a reroll costs 5 and you have 2.");
    // Each reroll shows a different roll of all the slots (over many seeds, nearly always a different shop).
    let changed = 0;
    for (let seed = 0; seed < 200; seed++) {
      const a = newShop(seed);
      const b = rerollShop(a, seed);
      const c = rerollShop(b, seed);
      if (a.slots.join("") !== b.slots.join("") && b.slots.join("") !== c.slots.join("")) changed++;
    }
    expect(changed).toBeGreaterThan(80);
    // A reroll after buys starts the refill count over.
    const bought = refillSlot(shop, 2, shopSeed(3));
    expect(rerollShop(bought, shopSeed(3)).refills).toBe(0);
    expect(rerollShop(bought, shopSeed(3))).toEqual(rerollShop(shop, shopSeed(3)));
  });

  it("the shop refills free at each round's start: new slots, and gold only from the round's income", () => {
    const m1 = beginRound(newMatch(21)).match;
    expect(m1.you.gold).toBe(100);
    const m2 = beginRound(m1).match;
    // (Gold: the saved 100 + 10 interest + 120 income; the new shop cost nothing.)
    expect(m2.you.gold).toBe(100 + 10 + 120);
    expect(newShop(shopSeed(roundSeed(m2))).slots).toHaveLength(5);
  });
});
