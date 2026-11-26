import { PAYMENTS } from "./settings.ts";

/**
 * Bought coins (the payments design, docs/decisions/2026-11-17-payments-design.md section 2; its storage, PR 5:
 * docs/decisions/2026-11-26-purchases-storage.md; PAYMENTS in settings.ts; the server's side in server/purchases.ts): the rules, pure.
 * One coin on screen; underneath, each purchase keeps its coins still unspent (`remaining`), moved only through the ledger.
 *   - **Bought** = the sum of every purchase's `remaining`; **earned** = coins − bought. Earned is below zero only after a purchase's
 *     coins were taken back (a chargeback, later): earned coins then pay that back before any are spent.
 *   - **Spending takes earned coins first,** then the oldest purchase's `remaining`, then the next (spendPlan).
 *   - **Refundable** = the `remaining` of purchases paid in the last PAYMENTS.refundDays days, never more than the coins (refundableCoins).
 */

/** A coin pack (PAYMENTS.packs). */
export type CoinPack = (typeof PAYMENTS.packs)[number];
/** The pack with this id, if it's sold. */
export const packOf = (id: unknown): CoinPack | undefined => PAYMENTS.packs.find((p) => p.id === id);

/** A purchase's coins still unspent: its id (the Checkout Session's), how many, and when it was paid (the oldest are spent first). */
export interface Unspent {
  session: string;
  remaining: number;
  paidAt: number;
}

/** Bought coins: what every purchase still holds unspent. */
export const boughtOf = (unspent: readonly Unspent[]): number => unspent.reduce((n, u) => n + Math.max(0, u.remaining), 0);

/** How a spend of `price` coins is paid: earned coins first, then each purchase drawn on, oldest first. */
export interface SpendPlan {
  price: number;
  /** Earned coins as read (coins − bought). The spend is guarded on it, so a change since (a grant, another spend) is seen. */
  earned: number;
  /** Of the price, what earned coins pay. */
  fromEarned: number;
  /** Then each purchase drawn on, oldest first: what it pays (`take`) and its `remaining` as read (`was`: the spend's guard). */
  draws: { session: string; take: number; was: number }[];
}

/** Oldest paid first; a tie by its id, so every read draws in the same order. */
const oldestFirst = (a: Unspent, b: Unspent) => a.paidAt - b.paidAt || (a.session < b.session ? -1 : a.session > b.session ? 1 : 0);

/**
 * A spend of `price` (whole coins, 0 or more) from `coins` with these purchases unspent: earned coins first (none while earned is
 * below zero), then the oldest purchase's remaining, then the next. Null: not enough coins.
 */
export function spendPlan(coins: number, unspent: readonly Unspent[], price: number): SpendPlan | null {
  if (!Number.isInteger(price) || price < 0) throw new Error(`spendPlan: a price of whole coins, 0 or more (${price})`);
  if (coins < price) return null;
  const earned = coins - boughtOf(unspent);
  const fromEarned = Math.min(price, Math.max(0, earned));
  let rest = price - fromEarned;
  const draws: SpendPlan["draws"] = [];
  for (const u of [...unspent].sort(oldestFirst)) {
    if (!rest) break;
    if (u.remaining <= 0) continue;
    const take = Math.min(rest, u.remaining);
    draws.push({ session: u.session, take, was: u.remaining });
    rest -= take;
  }
  // (Unreachable: coins ≥ price, and what earned doesn't pay, bought holds, as coins = earned + bought.)
  if (rest) throw new Error(`spendPlan: ${rest} coins unplaced (coins ${coins}, bought ${boughtOf(unspent)}, price ${price})`);
  return { price, earned, fromEarned, draws };
}

const DAY_MS = 86_400_000;
/** Paid within the refund window at `now`: less than PAYMENTS.refundDays days (of 24 hours) ago. */
export const inRefundWindow = (paidAt: number, now: number): boolean => now - paidAt < PAYMENTS.refundDays * DAY_MS;

/** Refundable coins: the unspent coins of purchases paid in the refund window, never more than `coins` (and never below 0). */
export function refundableCoins(coins: number, unspent: readonly Unspent[], now: number): number {
  const recent = boughtOf(unspent.filter((u) => inRefundWindow(u.paidAt, now)));
  return Math.max(0, Math.min(coins, recent));
}
