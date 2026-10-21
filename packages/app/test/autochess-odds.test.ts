import { describe, expect, it } from "vitest";
import { AUTOCHESS } from "@chessroyale/core";
import { emptyArmy } from "../src/autochess/army.ts";
import { newMatch, roundSeed } from "../src/autochess/economy.ts";
import { newShop, refillSlot, rerollShop, shopSeed } from "../src/autochess/shop.ts";
import { KINDS, type Kind } from "../src/autochess/types.ts";

/**
 * Eric's second queen in his first shop (Oct 21: "that seems extremely unlikely"). With queens at 2% a slot, two or more among the
 * five offers is 1 in 260, so it is chance, unless the slots aren't independent. These tests check the odds the way the game seeds
 * its shops (the round's seed, the reroll count, the refill count): over tens of thousands of shops, each slot's kind matches the
 * odds, any two slots' kinds are independent (a chi-square test against the product of the odds), and so are a shop and its
 * reroll, a refilled slot and what it replaced, and one round and the next.
 */

const king = () => emptyArmy("w", "e1");
const P = Object.fromEntries(KINDS.map((k) => [k, AUTOCHESS.shop.odds[k] / 100])) as Record<Kind, number>;
const SLOTS = AUTOCHESS.shop.slots;
const MATCHES = 12000;
const ROUNDS = [1, 2, 3];

/** Every shop the game would show first in rounds 1 to 3 of `MATCHES` matches, as the kinds in slot order, and the shops themselves. */
const seeds: number[] = [];
for (let m = 0; m < MATCHES; m++) for (const round of ROUNDS) seeds.push(shopSeed(roundSeed({ ...newMatch(m * 104729 + 17), round })));
const shops = seeds.map((s) => newShop(s, king()));
const kinds = shops.map((s) => s.slots.map((o) => o.kind));

/** Pearson's chi-square of two lists of kinds against the product of the odds (the odds are known, not fitted: 24 degrees of freedom). */
function chiSquare(a: readonly Kind[], b: readonly Kind[]): number {
  const n = a.length;
  const seen = new Map<string, number>();
  for (let i = 0; i < n; i++) seen.set(a[i]! + b[i]!, (seen.get(a[i]! + b[i]!) ?? 0) + 1);
  let x = 0;
  for (const ka of KINDS) for (const kb of KINDS) x += ((seen.get(ka + kb) ?? 0) - n * P[ka] * P[kb]) ** 2 / (n * P[ka] * P[kb]);
  return x;
}
/** 24 degrees of freedom: 58.6 is the 99.99th percentile. Real dependence between two slots gives thousands. */
const LIMIT = 70;
const column = (rows: Kind[][], slot: number) => rows.map((r) => r[slot]!);

describe("auto chess: the shop's odds (Eric, Oct 21: two queens in a first shop)", () => {
  it("every slot rolls each kind at the odds (pawn 75, knight 10, bishop 8, rook 5, queen 2), within four standard deviations", () => {
    expect(shops.every((s) => s.slots.length === SLOTS)).toBe(true);
    for (let slot = 0; slot < SLOTS; slot++) {
      const col = column(kinds, slot);
      for (const k of KINDS) {
        const share = col.filter((x) => x === k).length / col.length;
        const sigma = Math.sqrt((P[k] * (1 - P[k])) / col.length);
        expect(Math.abs(share - P[k]), `slot ${slot}, ${k}: ${(100 * share).toFixed(2)}% against ${100 * P[k]}%`).toBeLessThan(4 * sigma);
      }
    }
  });

  it("any two slots of a shop are independent (chi-square against the product of the odds, all ten pairs)", () => {
    for (let i = 0; i < SLOTS; i++) for (let j = i + 1; j < SLOTS; j++) expect(chiSquare(column(kinds, i), column(kinds, j)), `slots ${i} and ${j}`).toBeLessThan(LIMIT);
  });

  it("the test can tell: slots made to agree (or a queen that brings another) are far over the limit", () => {
    const col = column(kinds, 0);
    expect(chiSquare(col, col)).toBeGreaterThan(1000);
    expect(chiSquare(col, col.map((k) => (k === "q" ? "q" : "p")))).toBeGreaterThan(1000);
  });

  it("queens per shop follow 5 slots at 2%: two or more is 1 in 260 (0.38%), so two in a first shop is chance", () => {
    const perShop = kinds.map((r) => r.filter((k) => k === "q").length);
    const n = perShop.length;
    const q = P.q;
    const exact = [(1 - q) ** 5, 5 * q * (1 - q) ** 4];
    const expected = [exact[0]!, exact[1]!, 1 - exact[0]! - exact[1]!];
    expect(Math.round(1 / expected[2]!)).toBe(260);
    const seen = [0, 1, 2].map((c) => perShop.filter((x) => (c === 2 ? x >= 2 : x === c)).length);
    let x = 0;
    for (let c = 0; c < 3; c++) x += (seen[c]! - n * expected[c]!) ** 2 / (n * expected[c]!);
    // (Two degrees of freedom: 18.4 is the 99.99th percentile.)
    expect(x, `shops with 0, 1, 2+ queens: ${seen.join(", ")} of ${n}`).toBeLessThan(25);
    const rate = seen[2]! / n;
    expect(rate).toBeGreaterThan(0.0025);
    expect(rate).toBeLessThan(0.0055);
  });

  it("a shop and its reroll are independent, slot by slot, and the reroll rolls at the odds too", () => {
    const rolled = shops.slice(0, 18000).map((s, i) => rerollShop(s, seeds[i]!, king()).slots.map((o) => o.kind));
    for (let slot = 0; slot < SLOTS; slot++) {
      expect(chiSquare(column(kinds.slice(0, 18000), slot), column(rolled, slot)), `slot ${slot}, before and after a reroll`).toBeLessThan(LIMIT);
      const col = column(rolled, slot);
      for (const k of KINDS) expect(Math.abs(col.filter((x) => x === k).length / col.length - P[k]), `${k} after a reroll`).toBeLessThan(4 * Math.sqrt((P[k] * (1 - P[k])) / col.length));
    }
    // The reroll's slots are independent of one another as well.
    for (let i = 0; i < SLOTS; i++) for (let j = i + 1; j < SLOTS; j++) expect(chiSquare(column(rolled, i), column(rolled, j)), `rerolled slots ${i} and ${j}`).toBeLessThan(LIMIT);
  });

  it("a refilled slot (after a buy) is independent of what it replaced and of the other slots, and rolls at the odds", () => {
    for (const slot of [0, 2, 4]) {
      const refilled = shops.slice(0, 18000).map((s, i) => refillSlot(s, slot, seeds[i]!, king()));
      const now = refilled.map((s) => s.slots.map((o) => o.kind));
      expect(chiSquare(column(kinds.slice(0, 18000), slot), column(now, slot)), `slot ${slot}: the old offer and the new`).toBeLessThan(LIMIT);
      for (const other of [0, 1, 2, 3, 4].filter((o) => o !== slot)) expect(chiSquare(column(now, slot), column(now, other)), `refilled slot ${slot} and slot ${other}`).toBeLessThan(LIMIT);
      const col = column(now, slot);
      for (const k of KINDS) expect(Math.abs(col.filter((x) => x === k).length / col.length - P[k]), `${k} refilled into slot ${slot}`).toBeLessThan(4 * Math.sqrt((P[k] * (1 - P[k])) / col.length));
      // The other slots stay as they were.
      expect(refilled.every((s, i) => s.slots.every((o, k) => k === slot || o === shops[i]!.slots[k]))).toBe(true);
    }
  });

  it("one round's shop and the next round's are independent (the round's seed moves the shop's)", () => {
    const first = kinds.filter((_, i) => i % 3 === 0);
    const second = kinds.filter((_, i) => i % 3 === 1);
    for (let slot = 0; slot < SLOTS; slot++) expect(chiSquare(column(first, slot), column(second, slot)), `slot ${slot}, round 1 and 2`).toBeLessThan(LIMIT);
    // And a slot's kind doesn't follow the other slots' of the next round.
    expect(chiSquare(column(first, 0), column(second, 1))).toBeLessThan(LIMIT);
  });

  it("a match's own seed doesn't matter: consecutive match seeds roll independent shops", () => {
    const rows = Array.from({ length: 30000 }, (_, m) => newShop(shopSeed(roundSeed({ ...newMatch(m), round: 1 })), king()).slots.map((o) => o.kind));
    for (let slot = 0; slot < SLOTS; slot++) {
      expect(chiSquare(column(rows.slice(0, -1), slot), column(rows.slice(1), slot)), `slot ${slot}, match m and m + 1`).toBeLessThan(LIMIT);
    }
    expect(chiSquare(column(rows.slice(0, -1), 0), column(rows.slice(1), 1))).toBeLessThan(LIMIT);
  });
});
