import { describe, expect, it } from "vitest";
import { PAYMENTS, boughtOf, inRefundWindow, packOf, refundableCoins, spendPlan, type Unspent } from "../src/index.ts";

/**
 * Bought coins' rules (Nov 26, payments PR 5; core's payments.ts; docs/decisions/2026-11-26-purchases-storage.md): the packs as Eric
 * approved them, earned coins spent first and then the oldest purchase's, and the refundable amount's window and cap. The server's side
 * (the ledger, the guards, races): packages/server/test/purchases.test.ts.
 */
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 26, 12, 0);
const u = (session: string, remaining: number, paidAt: number): Unspent => ({ session, remaining, paidAt });

describe("the coin packs", () => {
  it("are the five Eric approved (Nov 17): $1.99/200, $4.99/520, $9.99/1,100, $19.99/2,300, $49.99/6,000, in USD", () => {
    expect(PAYMENTS.packs.map((p) => [p.cents, p.coins])).toEqual([
      [199, 200],
      [499, 520],
      [999, 1100],
      [1999, 2300],
      [4999, 6000],
    ]);
    expect(PAYMENTS.currency).toBe("usd");
    expect(new Set(PAYMENTS.packs.map((p) => p.id)).size).toBe(PAYMENTS.packs.length);
    // (100 coins = $1 or better: a bigger pack never gives fewer coins a dollar.)
    const perDollar = PAYMENTS.packs.map((p) => (p.coins * 100) / p.cents);
    for (const [i, r] of perDollar.entries()) {
      expect(r).toBeGreaterThan(100);
      if (i) expect(r).toBeGreaterThanOrEqual(perDollar[i - 1]!);
    }
  });

  it("packOf knows each by id, and nothing else", () => {
    for (const p of PAYMENTS.packs) expect(packOf(p.id)).toBe(p);
    expect(packOf("coins-999")).toBeUndefined();
    expect(packOf(undefined)).toBeUndefined();
    expect(packOf({ id: "coins-200" })).toBeUndefined();
  });
});

describe("spending: earned coins first, then the oldest purchase's", () => {
  const twoBought = [u("cs_B", 520, T0 + 5 * DAY), u("cs_A", 200, T0)];

  it("earned covers it: no purchase is touched", () => {
    expect(spendPlan(750, twoBought, 30)).toEqual({ price: 30, earned: 30, fromEarned: 30, draws: [] });
    expect(spendPlan(750, twoBought, 0)).toEqual({ price: 0, earned: 30, fromEarned: 0, draws: [] });
  });

  it("past earned: the oldest purchase next (whatever order they come in), then the next", () => {
    expect(spendPlan(750, twoBought, 100)).toEqual({ price: 100, earned: 30, fromEarned: 30, draws: [{ session: "cs_A", take: 70, was: 200 }] });
    expect(spendPlan(750, twoBought, 300)).toEqual({
      price: 300,
      earned: 30,
      fromEarned: 30,
      draws: [
        { session: "cs_A", take: 200, was: 200 },
        { session: "cs_B", take: 70, was: 520 },
      ],
    });
    // (Everything: earned, then all of both.)
    expect(spendPlan(750, twoBought, 750)!.draws).toEqual([
      { session: "cs_A", take: 200, was: 200 },
      { session: "cs_B", take: 520, was: 520 },
    ]);
  });

  it("not enough coins: no plan", () => {
    expect(spendPlan(750, twoBought, 751)).toBeNull();
    expect(spendPlan(0, [], 1)).toBeNull();
    expect(spendPlan(-20, [], 0)).toBeNull();
  });

  it("purchases paid at the same moment go by their id; one with nothing left is passed over", () => {
    const same = [u("cs_Z", 100, T0), u("cs_M", 100, T0), u("cs_E", 0, T0 - DAY)];
    expect(spendPlan(200, same, 150)!.draws).toEqual([
      { session: "cs_M", take: 100, was: 100 },
      { session: "cs_Z", take: 50, was: 100 },
    ]);
  });

  it("earned below zero (a purchase's coins taken back): nothing from earned, all from what's bought", () => {
    // 50 coins, 200 of them bought: earned -150.
    expect(spendPlan(50, [u("cs_A", 200, T0)], 50)).toEqual({ price: 50, earned: -150, fromEarned: 0, draws: [{ session: "cs_A", take: 50, was: 200 }] });
    expect(spendPlan(50, [u("cs_A", 200, T0)], 51)).toBeNull();
  });

  it("a price that isn't whole coins, or below 0, is a mistake", () => {
    expect(() => spendPlan(100, [], 1.5)).toThrow();
    expect(() => spendPlan(100, [], -1)).toThrow();
  });

  it("bought is what the purchases hold unspent", () => {
    expect(boughtOf(twoBought)).toBe(720);
    expect(boughtOf([])).toBe(0);
  });
});

describe("refundable: unspent coins of purchases paid in the last 14 days, never more than the coins", () => {
  it("the window is 14 days of 24 hours from the payment", () => {
    expect(PAYMENTS.refundDays).toBe(14);
    expect(inRefundWindow(T0, T0)).toBe(true);
    expect(inRefundWindow(T0, T0 + 14 * DAY - 1)).toBe(true);
    expect(inRefundWindow(T0, T0 + 14 * DAY)).toBe(false);
    const both = [u("cs_A", 200, T0), u("cs_B", 520, T0 + 5 * DAY)];
    expect(refundableCoins(1000, both, T0 + 10 * DAY)).toBe(720);
    expect(refundableCoins(1000, both, T0 + 14 * DAY - 1)).toBe(720);
    expect(refundableCoins(1000, both, T0 + 14 * DAY)).toBe(520);
    expect(refundableCoins(1000, both, T0 + 19 * DAY)).toBe(0);
  });

  it("never more than the coins, never below 0", () => {
    expect(refundableCoins(300, [u("cs_A", 520, T0)], T0)).toBe(300);
    expect(refundableCoins(-40, [u("cs_A", 520, T0)], T0)).toBe(0);
    expect(refundableCoins(500, [], T0)).toBe(0);
  });
});
