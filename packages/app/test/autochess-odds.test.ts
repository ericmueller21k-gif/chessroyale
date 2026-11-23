import { describe, expect, it } from "vitest";
import { AUTOCHESS } from "@chessroyale/core";
import { emptyArmy } from "../src/autochess/army.ts";
import { newMatch, roundSeed } from "../src/autochess/economy.ts";
import { newShop, oddsFor, refillSlot, rerollShop, shopSeed } from "../src/autochess/shop.ts";
import { KINDS, type Kind } from "../src/autochess/types.ts";

/**
 * The shop's odds by level (v7, Eric Oct 21: "when you level you have slightly higher chances for better pieces and pawn odds
 * slightly decrease... Queens... shouldn't even appear till level 7 like in TFT"; "Rooks should start at level 5"): the table, and the
 * way the game seeds its shops (the round's seed, the reroll count, the refill count) checked the way Eric's second queen was (Oct 21):
 * over tens of thousands of shops at three levels, each slot's kind matches its level's row, any two slots' kinds are independent (a
 * chi-square test against the product of the odds), and so are a shop and its reroll, a refilled slot and what it replaced, and one
 * round and the next.
 */

const king = () => emptyArmy("w", "e1");
const SLOTS = AUTOCHESS.shop.slots;

/** The design's table (percent P/N/B/R/Q), level 1 to 10: Eric's, Oct 21. */
const TABLE: Record<number, readonly number[]> = {
  1: [82, 10, 8, 0, 0],
  2: [80, 11, 9, 0, 0],
  3: [77, 12, 11, 0, 0],
  4: [74, 14, 12, 0, 0],
  5: [66, 14, 13, 7, 0],
  6: [60, 16, 15, 9, 0],
  7: [54, 18, 16, 11, 1],
  8: [48, 19, 18, 12, 3],
  9: [42, 20, 19, 14, 5],
  10: [36, 21, 20, 16, 7],
};

describe("auto chess: the shop's odds table (v7)", () => {
  it("has four slots, and the odds are Eric's table: every level's row, in percent P/N/B/R/Q", () => {
    expect(SLOTS).toBe(4);
    expect(AUTOCHESS.shop.oddsByLevel).toHaveLength(AUTOCHESS.levels.max);
    for (let level = 1; level <= 10; level++) {
      const row = oddsFor(level);
      expect([row.p, row.n, row.b, row.r, row.q], `level ${level}`).toEqual(TABLE[level]);
    }
  });

  it("every row adds up to 100, pawns fall and the better pieces rise with the level, no rook before level 5 and no queen before level 7", () => {
    let last = oddsFor(1);
    for (let level = 1; level <= 10; level++) {
      const row = oddsFor(level);
      expect(row.p + row.n + row.b + row.r + row.q, `level ${level}`).toBe(100);
      if (level < 5) expect(row.r, `rooks at level ${level}`).toBe(0);
      else expect(row.r, `rooks at level ${level}`).toBeGreaterThan(0);
      if (level < 7) expect(row.q, `queens at level ${level}`).toBe(0);
      else expect(row.q, `queens at level ${level}`).toBeGreaterThan(0);
      expect(row.p, `pawns at level ${level}`).toBeLessThanOrEqual(last.p);
      for (const k of ["n", "b", "r", "q"] as const) expect(row[k], `${k} at level ${level}`).toBeGreaterThanOrEqual(last[k]);
      last = row;
    }
    // (Play starts at level 4 and tops out at 10, as before.)
    expect(AUTOCHESS.levels.start).toBe(4);
    expect(AUTOCHESS.levels.max).toBe(10);
  });

  it("a level outside the table takes the nearest row", () => {
    expect(oddsFor(0)).toEqual(oddsFor(1));
    expect(oddsFor(-3)).toEqual(oddsFor(1));
    expect(oddsFor(11)).toEqual(oddsFor(10));
    expect(oddsFor(4.9)).toEqual(oddsFor(4));
  });
});

const MATCHES = 12000;
const ROUNDS = [1, 2, 3];
const seeds: number[] = [];
for (let m = 0; m < MATCHES; m++) for (const round of ROUNDS) seeds.push(shopSeed(roundSeed({ ...newMatch(m * 104729 + 17), round })));

/** Pearson's chi-square of two lists of kinds against the product of the odds (the odds are known, not fitted; kinds at 0% can't show up, so they are left out). */
function chiSquare(a: readonly Kind[], b: readonly Kind[], P: Record<Kind, number>): number {
  const n = a.length;
  const seen = new Map<string, number>();
  for (let i = 0; i < n; i++) seen.set(a[i]! + b[i]!, (seen.get(a[i]! + b[i]!) ?? 0) + 1);
  let x = 0;
  for (const ka of KINDS) for (const kb of KINDS) if (P[ka] > 0 && P[kb] > 0) x += ((seen.get(ka + kb) ?? 0) - n * P[ka] * P[kb]) ** 2 / (n * P[ka] * P[kb]);
  return x;
}
const column = (rows: Kind[][], slot: number) => rows.map((r) => r[slot]!);

for (const level of [4, 7, 10]) {
  describe(`auto chess: the shop rolls at level ${level}'s odds (Eric, Oct 21: two queens in a first shop)`, () => {
    const row = oddsFor(level);
    const P = Object.fromEntries(KINDS.map((k) => [k, row[k] / 100])) as Record<Kind, number>;
    const shown = KINDS.filter((k) => P[k] > 0).length;
    // (The cells of the table, less one: 99.99th percentile about df + 5 sqrt(2 df) + 20, where real dependence gives thousands.)
    const df = shown * shown - 1;
    const LIMIT = df + 5 * Math.sqrt(2 * df) + 20;
    const shops = seeds.map((s) => newShop(s, king(), AUTOCHESS, level));
    const kinds = shops.map((s) => s.slots.map((o) => o.kind));

    it("every slot rolls each kind at the level's row, within four standard deviations, and a kind at 0% never shows up", () => {
      expect(shops.every((s) => s.slots.length === SLOTS)).toBe(true);
      for (let slot = 0; slot < SLOTS; slot++) {
        const col = column(kinds, slot);
        for (const k of KINDS) {
          const share = col.filter((x) => x === k).length / col.length;
          if (P[k] === 0) expect(share, `slot ${slot}, ${k} at 0%`).toBe(0);
          const sigma = Math.sqrt((P[k] * (1 - P[k])) / col.length);
          expect(Math.abs(share - P[k]), `slot ${slot}, ${k}: ${(100 * share).toFixed(2)}% against ${100 * P[k]}%`).toBeLessThanOrEqual(4 * sigma);
        }
      }
    });

    it("any two slots of a shop are independent (chi-square against the product of the odds, all pairs)", () => {
      for (let i = 0; i < SLOTS; i++) for (let j = i + 1; j < SLOTS; j++) expect(chiSquare(column(kinds, i), column(kinds, j), P), `slots ${i} and ${j}`).toBeLessThan(LIMIT);
    });

    it("the test can tell: slots made to agree are far over the limit", () => {
      const col = column(kinds, 0);
      expect(chiSquare(col, col, P)).toBeGreaterThan(1000);
    });

    it("a shop and its reroll are independent, slot by slot, and the reroll rolls at the odds too", () => {
      const rolled = shops.slice(0, 18000).map((s, i) => rerollShop(s, seeds[i]!, king(), AUTOCHESS, level).slots.map((o) => o.kind));
      for (let slot = 0; slot < SLOTS; slot++) {
        expect(chiSquare(column(kinds.slice(0, 18000), slot), column(rolled, slot), P), `slot ${slot}, before and after a reroll`).toBeLessThan(LIMIT);
        const col = column(rolled, slot);
        for (const k of KINDS) expect(Math.abs(col.filter((x) => x === k).length / col.length - P[k]), `${k} after a reroll`).toBeLessThanOrEqual(4 * Math.sqrt((P[k] * (1 - P[k])) / col.length));
      }
      for (let i = 0; i < SLOTS; i++) for (let j = i + 1; j < SLOTS; j++) expect(chiSquare(column(rolled, i), column(rolled, j), P), `rerolled slots ${i} and ${j}`).toBeLessThan(LIMIT);
    });

    it("a refilled slot (after a buy) is independent of what it replaced and of the other slots, and rolls at the odds", () => {
      for (const slot of [0, 2, 3]) {
        const refilled = shops.slice(0, 18000).map((s, i) => refillSlot(s, slot, seeds[i]!, king(), AUTOCHESS, level));
        const now = refilled.map((s) => s.slots.map((o) => o.kind));
        expect(chiSquare(column(kinds.slice(0, 18000), slot), column(now, slot), P), `slot ${slot}: the old offer and the new`).toBeLessThan(LIMIT);
        for (const other of [0, 1, 2, 3].filter((o) => o !== slot)) expect(chiSquare(column(now, slot), column(now, other), P), `refilled slot ${slot} and slot ${other}`).toBeLessThan(LIMIT);
        const col = column(now, slot);
        for (const k of KINDS) expect(Math.abs(col.filter((x) => x === k).length / col.length - P[k]), `${k} refilled into slot ${slot}`).toBeLessThanOrEqual(4 * Math.sqrt((P[k] * (1 - P[k])) / col.length));
        // The other slots stay as they were.
        expect(refilled.every((s, i) => s.slots.every((o, k) => k === slot || o === shops[i]!.slots[k]))).toBe(true);
      }
    });

    it("one round's shop and the next round's are independent (the round's seed moves the shop's)", () => {
      const first = kinds.filter((_, i) => i % 3 === 0);
      const second = kinds.filter((_, i) => i % 3 === 1);
      for (let slot = 0; slot < SLOTS; slot++) expect(chiSquare(column(first, slot), column(second, slot), P), `slot ${slot}, round 1 and 2`).toBeLessThan(LIMIT);
      expect(chiSquare(column(first, 0), column(second, 1), P)).toBeLessThan(LIMIT);
    });
  });
}

describe("auto chess: queens in a shop (Eric, Oct 21: two queens in a first shop)", () => {
  it("at level 10 (7% a slot, 4 slots) the queens per shop follow the binomial: two or more is about 2.7%, so two in a first shop is chance; at level 4 there are none", () => {
    const q = oddsFor(10).q / 100;
    const perShop = seeds.map((s) => newShop(s, king(), AUTOCHESS, 10).slots.filter((o) => o.kind === "q").length);
    const n = perShop.length;
    const exact = [(1 - q) ** SLOTS, SLOTS * q * (1 - q) ** (SLOTS - 1)];
    const expected = [exact[0]!, exact[1]!, 1 - exact[0]! - exact[1]!];
    const seen = [0, 1, 2].map((c) => perShop.filter((x) => (c === 2 ? x >= 2 : x === c)).length);
    let x = 0;
    for (let c = 0; c < 3; c++) x += (seen[c]! - n * expected[c]!) ** 2 / (n * expected[c]!);
    // (Two degrees of freedom: 18.4 is the 99.99th percentile.)
    expect(x, `shops with 0, 1, 2+ queens: ${seen.join(", ")} of ${n}`).toBeLessThan(25);
    expect(seen[2]! / n).toBeGreaterThan(expected[2]! * 0.8);
    expect(seen[2]! / n).toBeLessThan(expected[2]! * 1.2);
    for (const s of seeds.slice(0, 5000)) expect(newShop(s, king(), AUTOCHESS, 4).slots.some((o) => o.kind === "q" || o.kind === "r")).toBe(false);
  });

  it("a match's own seed doesn't matter: consecutive match seeds roll independent shops", () => {
    const P = Object.fromEntries(KINDS.map((k) => [k, oddsFor(4)[k] / 100])) as Record<Kind, number>;
    const rows = Array.from({ length: 30000 }, (_, m) => newShop(shopSeed(roundSeed({ ...newMatch(m), round: 1 })), king()).slots.map((o) => o.kind));
    for (let slot = 0; slot < SLOTS; slot++) {
      expect(chiSquare(column(rows.slice(0, -1), slot), column(rows.slice(1), slot), P), `slot ${slot}, match m and m + 1`).toBeLessThan(48);
    }
    expect(chiSquare(column(rows.slice(0, -1), 0), column(rows.slice(1), 1), P)).toBeLessThan(48);
  });
});
