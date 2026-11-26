import { PAYMENTS, XP } from "./settings.ts";
import { ageInMonths } from "./age-gate.ts";

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

/**
 * A purchase's coins still unspent: its ledger reference (`purchases.ref`: its own random id, never the Checkout Session's, so a kept
 * sales record can't lead back to the ledger), how many, and when it was paid (the oldest are spent first).
 */
export interface Unspent {
  ref: string;
  remaining: number;
  paidAt: number;
}

/** Bought coins: what every purchase still holds unspent. */
export const boughtOf = (unspent: readonly Unspent[]): number => unspent.reduce((n, u) => n + Math.max(0, u.remaining), 0);

/** How a spend of `price` coins is paid: earned coins first, then each purchase drawn on, oldest first. */
export interface SpendPlan {
  price: number;
  /** The coins as read. A spend that draws on purchases is guarded on them too, so a give-back to an older purchase since is seen. */
  coins: number;
  /** Earned coins as read (coins − bought). The spend is guarded on it, so a change since (a grant, another spend) is seen. */
  earned: number;
  /** Of the price, what earned coins pay. */
  fromEarned: number;
  /** Then each purchase drawn on, oldest first: what it pays (`take`) and its `remaining` as read (`was`: the spend's guard). */
  draws: { ref: string; take: number; was: number }[];
}

/** Oldest paid first; a tie by its id, so every read draws in the same order. */
const oldestFirst = (a: Unspent, b: Unspent) => a.paidAt - b.paidAt || (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0);

/**
 * A spend of `price` (whole coins, 0 or more) from `coins` with these purchases unspent: earned coins first (none while earned is
 * below zero), then the oldest purchase's remaining, then the next. Null: not enough coins. Drawing on more than PAYMENTS.maxDraws
 * purchases is refused (it throws): the spend's guard binds 3 values a draw, and D1 allows 100 a statement.
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
    draws.push({ ref: u.ref, take, was: u.remaining });
    rest -= take;
  }
  if (draws.length > PAYMENTS.maxDraws) throw new Error(`spendPlan: ${draws.length} purchases drawn on, more than PAYMENTS.maxDraws (${PAYMENTS.maxDraws})`);
  // (Unreachable: coins ≥ price, and what earned doesn't pay, bought holds, as coins = earned + bought.)
  if (rest) throw new Error(`spendPlan: ${rest} coins unplaced (coins ${coins}, bought ${boughtOf(unspent)}, price ${price})`);
  return { price, coins, earned, fromEarned, draws };
}

const DAY_MS = 86_400_000;
/** Paid within the refund window at `now`: less than PAYMENTS.refundDays days (of 24 hours) ago. */
export const inRefundWindow = (paidAt: number, now: number): boolean => now - paidAt < PAYMENTS.refundDays * DAY_MS;

/** Refundable coins: the unspent coins of purchases paid in the refund window, never more than `coins` (and never below 0). */
export function refundableCoins(coins: number, unspent: readonly Unspent[], now: number): number {
  const recent = boughtOf(unspent.filter((u) => inRefundWindow(u.paidAt, now)));
  return Math.max(0, Math.min(coins, recent));
}

// ---------------- Who may buy (Nov 26, payments PR 6; the design's sections 3, 4 and 9; docs/decisions/2026-11-26-who-may-buy.md) ----------------
// Signed in; 16 or older by the age band answered at the first Buy; 16-17 at most PAYMENTS.buyers.minorCapCents a month; in the US or
// Canada; not held; not closed. buyAnswer is the whole rule, pure: the server reads the facts (purchases.ts buyStatus) and refuses a
// checkout by it (recordCheckout, in its statement too); the coin screen (PR 7) shows each Buy greyed with its line.

/**
 * The age bands asked at the first Buy, youngest first: only the band leaves the device and is stored (`users.buy_band`), never a birth
 * date. Their names are the bands at PAYMENTS.buyers' ages (minAge 16, adultAge 18).
 */
export const BUY_BANDS = ["under-16", "16-17", "18+"] as const;
export type BuyBand = (typeof BUY_BANDS)[number];
export const isBuyBand = (v: unknown): v is BuyBand => (BUY_BANDS as readonly unknown[]).includes(v);

/** The band of a birth month (1-12) and year on `today`, counted in whole months as the age gate counts (the device works it out). */
export function buyBandOf(month: number, year: number, today: Date): BuyBand {
  const months = ageInMonths(month, year, today);
  return months < PAYMENTS.buyers.minAge * 12 ? "under-16" : months < PAYMENTS.buyers.adultAge * 12 ? "16-17" : "18+";
}

/** `at` plus whole calendar months (UTC; a day the month hasn't, as the 31st, runs into the next month, as Date does). */
const addMonths = (at: number, months: number) => {
  const d = new Date(at);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds());
};

/** When an answered band is asked again: an under-18 one, PAYMENTS.buyers.askAgainMonths after it was answered; 18+ never (null). */
export const bandAskAgainAt = (band: BuyBand, at: number): number | null => (band === "18+" ? null : addMonths(at, PAYMENTS.buyers.askAgainMonths));

/** The band question comes first at a Buy: never answered, or an under-18 band whose time to ask again has come. */
export function bandDue(band: BuyBand | null, at: number | null, now: number): boolean {
  if (!band || at === null) return true;
  const again = bandAskAgainAt(band, at);
  return again !== null && now >= again;
}

/**
 * The band kept after an answer: the first one as given; asked again, at most one band above the one stored (so under-16 reaches 18+
 * in two askings, a year apart at least). A lower answer is kept as given: the safer reading of a young player's own word.
 */
export function bandAfter(stored: BuyBand | null, answer: BuyBand): BuyBand {
  if (!stored) return answer;
  return BUY_BANDS[Math.min(BUY_BANDS.indexOf(answer), BUY_BANDS.indexOf(stored) + 1)]!;
}

/**
 * The start of the buying month holding `t` (the 16-17 cap's month): the 1st at XP.dayStartUtcHour UTC, when the XP day turns too
 * (midnight Pacific, 3 am Eastern: overnight where packs are sold). UTC, never the device's clock: it can't be moved by changing the
 * phone's time zone, and nothing about where the player lives is stored.
 */
export function buyMonthStart(t: number): number {
  const shift = XP.dayStartUtcHour * 3_600_000;
  const d = new Date(t - shift);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) + shift;
}

/** Money as the coin screen shows it: whole dollars bare ("$50"), else with cents ("$45.01"). */
export const dollars = (cents: number): string => (cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`);

/**
 * Every refusal's line, in one place (the design's section 9 for the first four, section 3 for a hold's, section 4 for closed). A Buy
 * that can't be bought shows greyed with its line, and a tap shows it (Eric, Nov 18: "just gray it out ... you can still click it").
 */
export const BUY_LINES = {
  guest: "Sign in to buy coins.",
  young: `Buying coins is for players ${PAYMENTS.buyers.minAge} and older.`,
  country: "Coin packs aren't sold in your country yet. You can still earn coins by playing.",
  /** A hold's: no reason, no date (the design's section 3). */
  held: "Purchasing isn't available on this account.",
  /** The design's line for a closed account's sign-in (section 4); until PR 9 refuses that sign-in, its Buy says it too. */
  closed: "This account is closed. Questions: support@hunchess.com",
  /** Not a greyed line: a Buy with the band question due asks it first (`askBand`). A checkout without the answer is refused with it. */
  band: "Before you buy coins: when were you born?",
  /** Not a greyed line: a new Buy closes the open checkout first (PR 8). Two Buys at once: the second is refused with it. */
  open: "Another checkout is open. Finish it, or try again in a moment.",
} as const;
/** The 16-17 cap's line, on each pack that no longer fits this month (the design's section 9). */
export const capLine = (leftCents: number): string => `Monthly limit for players under ${PAYMENTS.buyers.adultAge}: ${dollars(Math.max(0, leftCents))} left.`;

/** What the rule needs to know about an account, read on the server (purchases.ts buyFacts) as of one moment. */
export interface BuyFacts {
  /** Signed in (a guest never buys). */
  signedIn: boolean;
  /** `users.closed_at` is set (two chargebacks, PR 9). */
  closed: boolean;
  /** `users.hold_until`: held while now is before it. */
  holdUntil: number | null;
  /** The request's country (`request.cf.country`, two capital letters), or null: unknown, so not sold. */
  country: string | null;
  /** The band answered (`users.buy_band`; null: never, or not a band) and when (`buy_band_at`). */
  band: BuyBand | null;
  bandAt: number | null;
  /**
   * This buying month's checkouts, in cents before tax: pending ones too, paid ones less what refunds returned; never expired or
   * unclaimed ones, nor the one still open (a new Buy replaces it: PR 8 expires it first).
   */
  spentCents: number;
}

/** A pack as the coin screen offers it, with its Buy's greyed line (null: it can be bought now). */
export interface BuyPack {
  id: string;
  coins: number;
  cents: number;
  line: string | null;
}

/**
 * May this account buy, and if not, why (GET /api/buy; PR 7's coin screen renders it): the one answer.
 *   - `line`: the greyed line for every Buy (signed out, closed, held, the country, under 16), or null.
 *   - `askBand`: a Buy asks the band question first (never answered, or an under-18 band due again); every pack is tappable then.
 *   - `held`: the line is a hold's, so a greyed Buy's tap is counted (POST /api/buy/tap; the admins' "Buy taps while held").
 *   - `leftCents`: the 16-17 band's money left this month (null: no cap applies now).
 *   - `packs`: each pack with its own line: the account's, or the cap's when its price is more than what's left, or null.
 */
export interface BuyStatus {
  line: string | null;
  askBand: boolean;
  held: boolean;
  leftCents: number | null;
  packs: BuyPack[];
}

/** Held at `now`: a hold that hasn't ended (it ends at `hold_until` itself). */
export const heldAt = (holdUntil: number | null, now: number): boolean => holdUntil !== null && now < holdUntil;

/**
 * The rule, pure. Its order: who the account is (a guest, closed, held), where the request is from, then the band (asked only when
 * nothing before refuses: no age is asked of someone who couldn't buy anyway), then the 16-17 cap per pack.
 */
export function buyAnswer(f: BuyFacts, now: number): BuyStatus {
  const account = !f.signedIn
    ? BUY_LINES.guest
    : f.closed
      ? BUY_LINES.closed
      : heldAt(f.holdUntil, now)
        ? BUY_LINES.held
        : !f.country || !PAYMENTS.buyers.countries.includes(f.country)
          ? BUY_LINES.country
          : null;
  const askBand = !account && bandDue(f.band, f.bandAt, now);
  const line = account ?? (!askBand && f.band === "under-16" ? BUY_LINES.young : null);
  const leftCents = !line && !askBand && f.band === "16-17" ? Math.max(0, PAYMENTS.buyers.minorCapCents - f.spentCents) : null;
  return {
    line,
    askBand,
    held: line === BUY_LINES.held,
    leftCents,
    packs: PAYMENTS.packs.map((p) => ({ id: p.id, coins: p.coins, cents: p.cents, line: line ?? (leftCents !== null && p.cents > leftCents ? capLine(leftCents) : null) })),
  };
}

/** Why a checkout of this pack is refused now (the line its Buy shows, or the band question's), or null: the rule lets it through. */
export function checkoutLine(status: BuyStatus, packId: string): string | null {
  const pack = status.packs.find((p) => p.id === packId);
  if (!pack) return "That coin pack isn't sold.";
  return pack.line ?? (status.askBand ? BUY_LINES.band : null);
}
