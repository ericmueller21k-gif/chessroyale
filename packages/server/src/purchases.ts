import {
  BUY_LINES,
  PAYMENTS,
  bandAfter,
  buyAnswer,
  buyMonthStart,
  checkoutLine,
  inRefundWindow,
  isBuyBand,
  packOf,
  refundableCoins,
  spendPlan,
  type BuyFacts,
  type BuyStatus,
  type CoinPack,
  type SpendPlan,
  type Unspent,
} from "@chessroyale/core";
import type { Sql, Stmt, User } from "./accounts.ts";
import { SIGNED_IN } from "./friends.ts";
import { RateLimiter } from "./limits.ts";
import { applyOp, cond, firstLeg, leg, ledgerAccount, newId, spendLegs, type Cond, type Leg, type LedgerAccount, type Op, type Outcome } from "./ledger.ts";

/**
 * Purchases: bought coins, stored (Nov 26; the payments design's section 2, docs/decisions/2026-11-17-payments-design.md, PR 5 of its
 * build; docs/decisions/2026-11-26-purchases-storage.md; docs/areas/payments.md). One coin on screen; underneath, each purchase keeps
 * its coins still unspent (`remaining`), a balance the ledger moves (asset kind `purchase`, ledger.ts) beside the wallet's coins, by
 * the purchase's own random ledger reference (`ref`), never by Stripe's ids: those name the buyer, and the row outlives the account.
 *   - **Bought** = the sum of `remaining`; **earned** = coins − bought (coinSplit). Every row but a paid one holds 0.
 *   - **Credit once** (creditPurchase, PR 8's webhook will call it): a paid Checkout Session credits its pack's coins, as recorded at
 *     checkout, to the row's account, once (op `pay:<ref>`): a second call pays nothing. No account to credit (deleted, a guest's): the
 *     payment is recorded all the same, `unclaimed`, for PR 8 to refund.
 *   - **Spend earned first** (applySpend, every coin spend): then the oldest purchase's `remaining`, in the spend's own op, each draw
 *     guarded at its read value and earned at its own: a race changes nothing and is retried once.
 *   - **Refundable** (refundable): the `remaining` of purchases paid in the last PAYMENTS.refundDays days, never more than the coins.
 *   - **Guests can't buy** (buyRefusal): checked at checkout (recordCheckout) and again at the credit, in the statement itself.
 *   - **Who may buy** (Nov 26, PR 6; core's buyAnswer, the whole rule): signed in, 16 or older by the band answered at the first Buy,
 *     16-17 at most PAYMENTS.buyers.minorCapCents a buying month, in the US or Canada, not held, not closed; one open checkout at a
 *     time. buyStatus is the answer the coin screen renders; recordCheckout refuses by the same rule, and its statement holds it too.
 *   - **Deleting an account** keeps its purchase and refund rows as the shared "deleted" account's (sales records, for tax): ledger.ts
 *     eraseMoves closes their unspent coins with every balance and drops each purchase's `ref`; refundsErase drops the comments and
 *     each refund's op id (a new random one), so no kept row leads to the ledger. "Download my data" has them all.
 * (Only types come from accounts.ts: it imports this file's schema while it loads.)
 */

const stmt = (sql: string, ...params: unknown[]): Stmt => ({ sql, params });

export const PURCHASES_SCHEMA = [
  // One row per Checkout Session (Stripe's id), made as the buyer goes to Stripe's page (PR 8), with the pack's coins and price as they
  // were then. `ref`: the purchase's ledger reference (random, made at checkout; review M1): its ledger asset id, the credit's op
  // (`pay:<ref>`) and its legs' source. Stripe's ids never go in the ledger, as they name the buyer; deleting the account sets `ref` to
  // NULL, so the kept row can't be joined to its ledger rows. `remaining`: its coins still unspent, moved only through the ledger
  // (ledger.ts leg.purchase, kind `purchase`): 0 until it's paid, then the pack's coins, down as they're spent or refunded. `status`:
  // pending | paid | unclaimed (paid with no account to credit: deleted, or a guest's; PR 8 refunds it) | expired | refunded |
  // part_refunded | disputed (text, so a later status needs no rebuild). Money in cents, USD (PAYMENTS.currency); `tax_cents` Stripe
  // Tax's, `refunded_cents` what refunds have returned. `payment_intent` matches Stripe's later events (a refund made in its Dashboard,
  // a dispute) to the row; `card_country` the card's country, as Stripe reports it. Never a card number or an email.
  `CREATE TABLE IF NOT EXISTS purchases (
    session_id TEXT PRIMARY KEY,
    ref TEXT,
    user_id TEXT NOT NULL,
    pack TEXT NOT NULL,
    coins INTEGER NOT NULL CHECK (coins > 0),
    remaining INTEGER NOT NULL DEFAULT 0 CHECK (remaining >= 0 AND remaining <= coins),
    cents INTEGER NOT NULL CHECK (cents > 0),
    tax_cents INTEGER NOT NULL DEFAULT 0,
    payment_intent TEXT,
    card_country TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    refunded_cents INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    paid_at INTEGER
  )`,
  // (An account's purchases, oldest paid first: the spend's read, the refundable read.)
  `CREATE INDEX IF NOT EXISTS purchases_user ON purchases (user_id, paid_at)`,
  `CREATE INDEX IF NOT EXISTS purchases_intent ON purchases (payment_intent)`,
  // (Each ref once; the kept rows' NULLs don't clash.)
  `CREATE UNIQUE INDEX IF NOT EXISTS purchases_ref ON purchases (ref)`,
  // One row per refund or take-back (PR 9 writes them), keyed by its op (the ledger's). `kind`: coins (the player's Refund button) |
  // claim (a parent's or an unauthorized claim, the admins' Refund everything) | dashboard (made in Stripe's Dashboard) | chargeback.
  // `comment`: the refund message's optional text (PAYMENTS.commentMax characters at most); erased with the account, and `op_id` then
  // replaced by a random one (refundsErase), so the kept row can't be joined to the ledger.
  `CREATE TABLE IF NOT EXISTS refunds (
    op_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    cents INTEGER NOT NULL DEFAULT 0,
    coins INTEGER NOT NULL DEFAULT 0,
    stripe_ref TEXT,
    status TEXT NOT NULL,
    comment TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS refunds_user ON refunds (user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS refunds_session ON refunds (session_id)`,
];

/**
 * The account's columns for buying (the payments design's sections 3, 4, 5 and 9; set by PRs 6 and 9, stored from now). Every row
 * from before gets the defaults: no band answered, no refunds or chargebacks, no hold, not closed.
 */
export const PURCHASES_COLUMNS: { table: string; column: string; type: string }[] = [
  // The buyer's age band, as answered at their first Buy ("under-16", "16-17", "18+"; never a birth date) and when. NULL: never asked.
  { table: "users", column: "buy_band", type: "TEXT" },
  { table: "users", column: "buy_band_at", type: "INTEGER" },
  // Refunds and chargebacks together, all time (the quiet flag: the 3rd starts a hold), and the hold's end. NULL: never held.
  { table: "users", column: "refund_count", type: "INTEGER NOT NULL DEFAULT 0" },
  { table: "users", column: "hold_until", type: "INTEGER" },
  // Chargebacks (the 2nd closes the account), and a closed account's when and why. NULL: open.
  { table: "users", column: "chargebacks", type: "INTEGER NOT NULL DEFAULT 0" },
  { table: "users", column: "closed_at", type: "INTEGER" },
  { table: "users", column: "closed_reason", type: "TEXT" },
  // Taps on a greyed Buy while held (at most one a minute counted), for the admins' Payments tab.
  { table: "users", column: "held_taps", type: "INTEGER NOT NULL DEFAULT 0" },
];

/** Why this account can't buy coins, as a guest: "Sign in to buy coins." (the rest of the rule: core's buyAnswer, from buyFacts). */
export function buyRefusal(user: Pick<User, "email" | "google_sub">): string | null {
  return user.email || user.google_sub ? null : BUY_LINES.guest;
}

// ---------------- Who may buy (Nov 26, payments PR 6; docs/decisions/2026-11-26-who-may-buy.md) ----------------

const DAY_MS = 86_400_000;
/** A checkout still open: pending, and made less than PAYMENTS.buyers.checkoutMinutes ago (Stripe's session expires by then). */
const openSince = (now: number) => now - PAYMENTS.buyers.checkoutMinutes * 60_000;

/**
 * This buying month's spend of account ?1 in cents before tax (?2: the month's start, core's buyMonthStart), by checkout: every
 * checkout made since, pending ones too (so one paid but not yet credited counts), less what refunds returned; never one that ended
 * unpaid (`expired`), was paid with no account to credit (`unclaimed`: refunded at once), or is still open (made after ?3, openSince):
 * a new Buy replaces an open checkout (PR 8 expires it first), so it doesn't stand in that Buy's way, and the checkout's statement
 * refuses while one is open anyway.
 */
const SPENT = `COALESCE((SELECT SUM(cents - refunded_cents) FROM purchases WHERE user_id = ?1 AND created_at >= ?2 AND status NOT IN ('expired', 'unclaimed')
  AND NOT (status = 'pending' AND created_at > ?3)), 0)`;

/** The account's buying columns as stored, with this month's spend: one read. Null: no such account. */
interface BuyRow {
  email: string | null;
  google_sub: string | null;
  closed_at: number | null;
  hold_until: number | null;
  buy_band: string | null;
  buy_band_at: number | null;
  spent: number;
}
const readBuyRow = (sql: Sql, userId: string, now: number) =>
  sql.first<BuyRow>(`SELECT email, google_sub, closed_at, hold_until, buy_band, buy_band_at, ${SPENT} AS spent FROM users WHERE id = ?1`, userId, buyMonthStart(now), openSince(now));

/** The facts core's buyAnswer needs, from the account as stored now (never a session's view of it) and the request's country. */
const factsOf = (row: BuyRow | null, country: string | null): BuyFacts => ({
  signedIn: !!row && !buyRefusal(row),
  closed: row?.closed_at != null,
  holdUntil: row?.hold_until ?? null,
  country,
  band: isBuyBand(row?.buy_band) ? row.buy_band : null,
  bandAt: isBuyBand(row?.buy_band) ? (row.buy_band_at ?? null) : null,
  spentCents: row?.spent ?? 0,
});

/**
 * May this account buy now, and if not, the exact greyed line (GET /api/buy; PR 7's coin screen renders it as it is: core's
 * BuyStatus). `country`: the request's (`request.cf.country`); unknown is not sold.
 */
export async function buyStatus(sql: Sql, userId: string, country: string | null, now: number): Promise<BuyStatus> {
  return buyAnswer(factsOf(await readBuyRow(sql, userId, now), country), now);
}

/**
 * The band question's answer (POST /api/buy/band): only the band, worked out on the device from a birth month and year (core's
 * buyBandOf). Taken only when the question is due (buyStatus's `askBand`: never answered, or an under-18 band asked again): the first
 * as given, asked again at most one band up (core's bandAfter), with the time (`buy_band_at`). Asked once: an answer when it isn't due
 * changes nothing. One statement, guarded on the band as read, so two answers at once (two tabs) store one.
 */
export async function answerBand(
  sql: Sql,
  userId: string,
  answer: unknown,
  country: string | null,
  now: number,
): Promise<{ ok: true; status: BuyStatus } | { ok: false; message: string }> {
  if (!isBuyBand(answer)) return { ok: false, message: "Answer the question." };
  const row = await readBuyRow(sql, userId, now);
  const facts = factsOf(row, country);
  const status = buyAnswer(facts, now);
  if (!status.askBand || !row) return { ok: false, message: status.line ?? "You've answered this already." };
  const stored = await sql.first<{ ok: number }>(
    `UPDATE users SET buy_band = ?1, buy_band_at = ?2 WHERE id = ?3 AND (${SIGNED_IN}) AND buy_band IS ?4 AND buy_band_at IS ?5 RETURNING 1 AS ok`,
    bandAfter(facts.band, answer),
    now,
    userId,
    row.buy_band,
    row.buy_band_at,
  );
  if (!stored) return { ok: false, message: "You've answered this already." };
  return { ok: true, status: await buyStatus(sql, userId, country, now) };
}

/** Taps counted while held: at most one each PAYMENTS.hold.tapGapMs an account (in this Worker instance's memory, as the API's limits). */
const heldTaps = new RateLimiter(1, PAYMENTS.hold.tapGapMs);

/**
 * A greyed Buy tapped while held (POST /api/buy/tap; the design's section 3: "adds 1 to held_taps ... at most once a minute counted"),
 * for the admins' "Buy taps while held". Counted only while the hold lasts (and the account is signed in and open). Answers whether
 * this tap was counted.
 */
export async function heldTap(sql: Sql, userId: string, now: number): Promise<boolean> {
  const row = await sql.first<{ hold_until: number | null }>("SELECT hold_until FROM users WHERE id = ?", userId);
  if (!row?.hold_until || now >= row.hold_until || !heldTaps.hit(userId, now).ok) return false;
  const counted = await sql.first<{ ok: number }>(
    `UPDATE users SET held_taps = held_taps + 1 WHERE id = ? AND hold_until > ? AND closed_at IS NULL AND (${SIGNED_IN}) RETURNING 1 AS ok`,
    userId,
    now,
  );
  return !!counted;
}

/**
 * The quiet flag's count (the design's section 3 and call 4), for PR 9's refund batch (and a chargeback's): one more refund or
 * chargeback, all time; the PAYMENTS.hold.after-th starts a hold of PAYMENTS.hold.days days, and each one after it starts the days
 * again (never shortening a later end). In the statement, so two at once count two. Nothing calls it yet but tests.
 */
export const holdCount = (userId: string, now: number): Stmt =>
  stmt(
    `UPDATE users SET refund_count = refund_count + 1,
       hold_until = CASE WHEN refund_count + 1 >= ? THEN MAX(COALESCE(hold_until, 0), ?) ELSE hold_until END
     WHERE id = ?`,
    PAYMENTS.hold.after,
    now + PAYMENTS.hold.days * DAY_MS,
    userId,
  );

/**
 * The account's open checkouts (normally one at most), oldest first: PR 8 expires each at Stripe, then here (expireCheckout), before
 * it makes a new one, so a new Buy replaces an open one rather than waiting for it.
 */
export async function openCheckouts(sql: Sql, userId: string, now: number): Promise<string[]> {
  const rows = await sql.all<{ session_id: string }>(
    "SELECT session_id FROM purchases WHERE user_id = ? AND status = 'pending' AND created_at > ? ORDER BY created_at, session_id",
    userId,
    openSince(now),
  );
  return rows.map((r) => r.session_id);
}

/**
 * A checkout that ended unpaid (PR 8: once Stripe has expired it, at a new Buy or on its `checkout.session.expired` event): no longer
 * open, and its price no longer counts toward the month. Only while pending (a paid one is never undone); answers whether it was.
 */
export async function expireCheckout(sql: Sql, sessionId: string): Promise<boolean> {
  return !!(await sql.first("UPDATE purchases SET status = 'expired' WHERE session_id = ? AND status = 'pending' RETURNING 1 AS ok", sessionId));
}

/** Stripe's Checkout Session ids ("cs_test_…", "cs_live_…"), and a test's: letters, digits and "_", 8 to 255 long. */
const SESSION_ID = /^[A-Za-z0-9_]{8,255}$/;

type CheckoutAnswer = { ok: true; pack: CoinPack } | { ok: false; message: string };

/** The session's row if it was recorded: ours and this pack's, the pack as stored; else why not. Null: never recorded. */
async function recorded(sql: Sql, userId: string, pack: CoinPack, sessionId: string): Promise<CheckoutAnswer | null> {
  const row = await sql.first<{ user_id: string; pack: string; coins: number; cents: number }>("SELECT user_id, pack, coins, cents FROM purchases WHERE session_id = ?", sessionId);
  if (!row) return null;
  if (row.user_id !== userId) return { ok: false, message: "That checkout isn't yours." };
  if (row.pack !== pack.id) return { ok: false, message: "That checkout is for another coin pack." };
  return { ok: true, pack: { id: row.pack, coins: row.coins, cents: row.cents } };
}

/** Why a checkout of `pack` is refused now (who may buy, then another checkout open), or null. */
async function refusal(sql: Sql, userId: string, pack: CoinPack, country: string | null, now: number): Promise<string | null> {
  const line = checkoutLine(await buyStatus(sql, userId, country, now), pack.id);
  if (line) return line;
  return (await openCheckouts(sql, userId, now)).length ? BUY_LINES.open : null;
}

/**
 * A checkout begun (PR 8 calls it once Stripe has made the session, with the request's country; nothing calls it yet but tests): the
 * purchase's row, pending, with its pack's coins and price as they are now and its ledger reference (random). Only by the rule (core's
 * buyAnswer: never a guest's, a closed or held account's, outside the US and Canada, under 16, past the 16-17 month's cap, nor before
 * the band question is answered when it's due), and with no other checkout of the account's open. The statement holds the rule's
 * stored parts too (the account as it is then; the month's spend; no checkout open), so two Buys at once can't both pass the cap or
 * open two checkouts. Made once: the same session again changes nothing and answers the pack as stored; another pack for the same
 * session is refused (review n2). A refusal answers its line: PR 8 then expires the Stripe session it made.
 */
export async function recordCheckout(
  sql: Sql,
  // (The session's account: the rule reads it as stored now, never this view of it.)
  user: Pick<User, "id" | "email" | "google_sub">,
  packId: unknown,
  sessionId: string,
  now: number,
  country: string | null,
): Promise<CheckoutAnswer> {
  const pack = packOf(packId);
  if (!pack) return { ok: false, message: "That coin pack isn't sold." };
  if (!SESSION_ID.test(sessionId)) throw new Error(`recordCheckout: not a session id: ${sessionId.slice(0, 40)}`);
  const had = await recorded(sql, user.id, pack, sessionId);
  if (had) return had;
  const no = await refusal(sql, user.id, pack, country, now);
  if (no) return { ok: false, message: no };
  // (The account as it is now: signed in, open, not held, a band that may buy and, for 16-17, the month's spend with this price under
  // the cap; and no checkout of its open. ?1 the account, ?2 the month's start, ?3 the open checkouts' start (both SPENT's too), ?4-?9
  // the row, ?10 the cap. The band's time to ask again and the country were checked just before: time only moves on, and the request's
  // country is the same.)
  await sql.run(
    `INSERT INTO purchases (session_id, ref, user_id, pack, coins, cents, created_at)
     SELECT ?4, ?5, ?1, ?6, ?7, ?8, ?9
     WHERE EXISTS (
       SELECT 1 FROM users WHERE id = ?1 AND (${SIGNED_IN}) AND closed_at IS NULL AND (hold_until IS NULL OR hold_until <= ?9)
         AND (buy_band = '18+' OR (buy_band = '16-17' AND ${SPENT} + ?8 <= ?10))
     )
     AND NOT EXISTS (SELECT 1 FROM purchases WHERE user_id = ?1 AND status = 'pending' AND created_at > ?3)
     ON CONFLICT (session_id) DO NOTHING`,
    user.id,
    buyMonthStart(now),
    openSince(now),
    sessionId,
    newId(),
    pack.id,
    pack.coins,
    pack.cents,
    now,
    PAYMENTS.buyers.minorCapCents,
  );
  return (await recorded(sql, user.id, pack, sessionId)) ?? { ok: false, message: (await refusal(sql, user.id, pack, country, now)) ?? "That didn't go through. Try again." };
}

/**
 * A paid Checkout Session, as PR 8's webhook (or the return trip's check) reads it from Stripe. The coins and the buyer come from our
 * row, never from it: it carries no account (the director's call on review M1, Nov 26: the ledger id never goes to Stripe as
 * `client_reference_id`; our row maps the session to its account).
 */
export interface PaidSession {
  /** Its id: our purchase row's key. */
  id: string;
  /** Its `payment_status` is "paid". */
  paid: boolean;
  /** `amount_subtotal`, before tax: must be the price recorded at checkout. */
  subtotalCents: number;
  /** `total_details.amount_tax`. */
  taxCents: number;
  /** Its currency (Stripe's lowercase code): must be PAYMENTS.currency. */
  currency: string;
  paymentIntent: string | null;
  /** The card's country (two letters), as Stripe reports it. */
  cardCountry: string | null;
}

/**
 * What a credit did: paid now, paid before (a second call pays nothing), or why it paid nothing. `gone`, `guest` and `closed`: no
 * account to credit (deleted or merged away; a guest's; closed since the checkout, PR 6: a closed account can't buy), and the row says
 * what's to do: `unclaimed`, the payment recorded just now or before (PR 8 refunds it at once); `paid`, the coins were credited before.
 */
export type Credit =
  | { ok: true; credited: "now" | "before"; coins: number; user: string }
  | { ok: false; why: "unknown" | "unpaid" | "mismatch" | "guest" | "gone" | "closed" | "not-pending" };
type NoCredit = "gone" | "guest" | "closed";

/** The credit's op id: one per purchase, by its ledger reference (`pay:<ref>`; the design's `pay:<session>` before review M1). */
export const creditOpId = (ref: string) => `pay:${ref}`;

/** The payment on its row (when, the tax, the payment intent, the card's country) and its status, if `guard` holds. */
const paidRow = (s: PaidSession, now: number, status: "paid" | "unclaimed", guard: Cond): Stmt =>
  stmt(
    `UPDATE purchases SET status = ?, paid_at = ?, tax_cents = ?, payment_intent = ?, card_country = ? WHERE session_id = ? AND ${guard.sql}`,
    status,
    now,
    Number.isFinite(s.taxCents) ? Math.max(0, Math.round(s.taxCents)) : 0,
    s.paymentIntent,
    s.cardCountry,
    s.id,
    ...guard.params,
  );

/** Why an account can't be credited: gone (deleted, or merged into another), a guest's, or closed (PR 6). Null: it can. */
async function nobodyToCredit(sql: Sql, userId: string): Promise<NoCredit | null> {
  const user = await sql.first<{ email: string | null; google_sub: string | null; closed_at: number | null }>("SELECT email, google_sub, closed_at FROM users WHERE id = ?", userId);
  return !user ? "gone" : buyRefusal(user) ? "guest" : user.closed_at !== null ? "closed" : null;
}

/**
 * Paid, with no account to credit (deleted since the checkout, or a guest's; review m1; closed since, PR 6): no coins, `remaining`
 * stays 0, but the payment is recorded (the sales record must match Stripe's charge, and PR 8 finds it by its payment intent to refund
 * it at once), as `unclaimed`, in one statement, only while the row is pending.
 */
async function unclaimed(sql: Sql, s: PaidSession, now: number, why: NoCredit): Promise<Credit> {
  const record = paidRow(s, now, "unclaimed", cond("status = 'pending'"));
  await sql.run(record.sql, ...record.params);
  return { ok: false, why };
}

/**
 * Credits a paid Checkout Session's coins (PR 8's webhook and return check will call it; nothing does yet but tests) to its row's
 * account: one ledger op, `pay:<ref>` (reason `purchase`), its coins into the wallet and into the purchase's `remaining`, the row marked
 * paid (when, the tax, the payment intent, the card's country) in the same batch. Once: a second call, or two at once, pay nothing more
 * (`before`). Nothing at all for a session we never recorded, one not paid, or one whose price or currency isn't the row's. No coins
 * for a guest's, an account gone or closed since (`guest`, `gone`, `closed`): the payment is recorded, `unclaimed`. Nothing for a
 * purchase no longer pending (`not-pending`). (A hold started since doesn't stop it: the hold stops new checkouts, not one paid for.)
 */
export async function creditPurchase(sql: Sql, s: PaidSession, now: number): Promise<Credit> {
  const row = await sql.first<{ user_id: string; ref: string | null; coins: number; cents: number }>("SELECT user_id, ref, coins, cents FROM purchases WHERE session_id = ?", s.id);
  if (!row) return { ok: false, why: "unknown" };
  if (row.ref && (await firstLeg(sql, creditOpId(row.ref)))) return { ok: true, credited: "before", coins: row.coins, user: row.user_id };
  if (!s.paid) return { ok: false, why: "unpaid" };
  if (s.currency.toLowerCase() !== PAYMENTS.currency || s.subtotalCents !== row.cents) return { ok: false, why: "mismatch" };
  // (No ref: a deleted account's kept row, which has no users row either.)
  const no = await nobodyToCredit(sql, row.user_id);
  const me = no || !row.ref ? null : await ledgerAccount(sql, row.user_id);
  if (!me || !row.ref) return unclaimed(sql, s, now, no ?? "gone");
  const ref = row.ref;
  const done = await applyOp(sql, me, {
    id: creditOpId(ref),
    reason: "purchase",
    now,
    when: cond(
      `EXISTS (SELECT 1 FROM purchases WHERE session_id = ? AND ref = ? AND user_id = ? AND status = 'pending' AND remaining = 0)
       AND EXISTS (SELECT 1 FROM users WHERE id = ? AND (${SIGNED_IN}) AND closed_at IS NULL)`,
      s.id,
      ref,
      me.user,
      me.user,
    ),
    legs: [leg.coins(me.user, row.coins, ref), leg.purchase(me.user, ref, row.coins, ref)],
    also: (ours) => [paidRow(s, now, "paid", ours)],
  });
  if (done !== "refused") return { ok: true, credited: done === "applied" ? "now" : "before", coins: row.coins, user: me.user };
  // (Refused: the account went or signed out of its identity since, or the purchase isn't pending any more.)
  const after = await nobodyToCredit(sql, me.user);
  return after ? unclaimed(sql, s, now, after) : { ok: false, why: "not-pending" };
}

/** A purchase with coins still unspent, as read with the coins. */
interface Held {
  session_id: string;
  ref: string;
  pack: string;
  coins: number;
  remaining: number;
  cents: number;
  tax_cents: number;
  paid_at: number;
}

/** An account's coins and every purchase with coins still unspent, in one statement (the two as of the same moment). */
async function readCoins(sql: Sql, userId: string): Promise<{ coins: number; held: Held[] }> {
  const rows = await sql.all<{ wallet: number } & { [K in keyof Held]: Held[K] | null }>(
    `SELECT w.coins AS wallet, p.session_id, p.ref, p.pack, p.coins, p.remaining, p.cents, p.tax_cents, p.paid_at
     FROM (SELECT COALESCE((SELECT coins FROM wallets WHERE user_id = ?1), 0) AS coins) w
     LEFT JOIN purchases p ON p.user_id = ?1 AND p.remaining > 0
     ORDER BY p.paid_at, p.ref`,
    userId,
  );
  return {
    coins: rows[0]?.wallet ?? 0,
    held: rows.flatMap(({ wallet: _, ...p }) => (p.session_id !== null && p.ref !== null ? [{ ...p, paid_at: p.paid_at ?? 0 } as Held] : [])),
  };
}
const unspentOf = (h: Held): Unspent => ({ ref: h.ref, remaining: h.remaining, paidAt: h.paid_at });

/** An account's coins and every purchase's coins still unspent, in one read (one statement: the two as of the same moment). */
export async function coinState(sql: Sql, userId: string): Promise<{ coins: number; unspent: Unspent[] }> {
  const { coins, held } = await readCoins(sql, userId);
  return { coins, unspent: held.map(unspentOf) };
}

/** One coin on screen; underneath, what's bought (every purchase's unspent coins) and earned (the rest; below 0 only after a take-back). */
export async function coinSplit(sql: Sql, userId: string): Promise<{ coins: number; bought: number; earned: number }> {
  const { coins, unspent } = await coinState(sql, userId);
  const bought = unspent.reduce((n, u) => n + u.remaining, 0);
  return { coins, bought, earned: coins - bought };
}

const and = (...cs: Cond[]): Cond => cond(cs.map((c) => `(${c.sql})`).join(" AND "), ...cs.flatMap((c) => c.params));
const COINS = "COALESCE((SELECT coins FROM wallets WHERE user_id = ?), 0)";
const BOUGHT = "COALESCE((SELECT SUM(remaining) FROM purchases WHERE user_id = ?), 0)";

/**
 * A spend's guard. Drawing on no purchase: the coins are there and earned covers the price. Drawing on purchases: the coins and earned
 * are both as read (so bought is too: a grant, a spend or a give-back to an older purchase since is seen, review n1, and it's planned
 * again), and each purchase drawn on still holds what was read. 3 values a draw (PAYMENTS.maxDraws keeps the statement under D1's 100).
 */
export function spendGuard(user: string, plan: SpendPlan): Cond {
  if (!plan.price) return cond("1");
  if (!plan.draws.length) return and(cond(`${COINS} >= ?`, user, plan.price), cond(`${COINS} - ${BOUGHT} >= ?`, user, user, plan.price));
  return and(
    cond(`${COINS} = ?`, user, plan.coins),
    cond(`${COINS} - ${BOUGHT} = ?`, user, user, plan.earned),
    ...plan.draws.map((d) => cond("EXISTS (SELECT 1 FROM purchases WHERE ref = ? AND user_id = ? AND remaining = ?)", d.ref, user, d.was)),
  );
}

/** A spend for an op: its guard (`when`, to add to the op's own) and its legs (after the op's own first leg). */
export interface Spend {
  when: Cond;
  legs: Leg[];
}

/**
 * Every coin spend (Nov 26): `price` coins, earned first, then the oldest purchase's unspent coins (core's spendPlan), as part of the
 * op `build` makes (its id the same each try: a replay is still one). Read, planned and applied; refused by a race (a grant, a spend
 * or a refund since the read: the coins read again differ), it's planned again from that read, once. Refused with the coins as they
 * were, it was the op's own guard (the item is yours already): not tried again. Answers the op's outcome, or "short": not enough coins
 * as last read.
 */
export async function applySpend(sql: Sql, me: LedgerAccount, price: number, build: (spend: Spend) => Op): Promise<Outcome | "short"> {
  let done: Outcome = "refused";
  let read = "";
  for (let attempt = 0; attempt < 2 && done === "refused"; attempt++) {
    const state = await coinState(sql, me.user);
    const plan = spendPlan(state.coins, state.unspent, price);
    if (!plan) return "short";
    if (JSON.stringify(state) === read) return "refused";
    read = JSON.stringify(state);
    done = await applyOp(sql, me, build({ when: spendGuard(me.user, plan), legs: spendLegs(me.user, plan) }));
  }
  return done;
}

/** A purchase that can be refunded now (PR 9's Purchases page lists them): its coins still unspent, and what it cost. */
export interface RefundablePurchase {
  session: string;
  pack: string;
  coins: number;
  remaining: number;
  cents: number;
  taxCents: number;
  paidAt: number;
}

/**
 * Refundable now (Eric, Nov 17: "Refunds should be hassle free"; the design: unspent bought coins within 14 days): the total, the
 * `remaining` of purchases paid in the last PAYMENTS.refundDays days but never more than the coins (core's refundableCoins), and those
 * purchases (each one's own unspent coins: how a total under them is shared out is PR 9's), both from one read (review n4). For the
 * profile's "Refundable N" (PR 7) and the Refund buttons (PR 9).
 */
export async function refundable(sql: Sql, userId: string, now: number): Promise<{ coins: number; purchases: RefundablePurchase[] }> {
  const { coins, held } = await readCoins(sql, userId);
  return {
    coins: refundableCoins(coins, held.map(unspentOf), now),
    purchases: held
      .filter((h) => inRefundWindow(h.paid_at, now))
      .map((h) => ({ session: h.session_id, pack: h.pack, coins: h.coins, remaining: h.remaining, cents: h.cents, taxCents: h.tax_cents, paidAt: h.paid_at })),
  };
}

/** The account's part of "Download my data": every purchase (pending ones too) and every refund, comments included. */
export const purchasesDownload = async (sql: Sql, userId: string) => ({
  purchases: await sql.all(
    `SELECT session_id, ref, pack, coins, remaining, cents, tax_cents, payment_intent, card_country, status, refunded_cents, created_at, paid_at
     FROM purchases WHERE user_id = ? ORDER BY created_at, session_id`,
    userId,
  ),
  refunds: await sql.all("SELECT session_id, kind, cents, coins, stripe_ref, status, comment, created_at FROM refunds WHERE user_id = ? ORDER BY created_at, op_id", userId),
});

/**
 * Deleting an account (account-data.ts): its refunds stay as `keptAs`'s (the shared "deleted" account), for tax, without the comment
 * (the player's own words), and each under a new random op id (`deleted:<hex>`): the old one is its ledger op's, which would lead back
 * to the account's ledger rows (review M1); only its day kept, as its exact time is its op's (delta D1). Stripe's refund id (`stripe_ref`) and the session stay, to match its later events. Its
 * purchases are kept by the ledger's part (ledger.ts eraseMoves: their unspent coins closed first, their `ref` dropped).
 */
export const refundsErase = (userId: string, keptAs: string): Stmt[] => [
  stmt(
    "UPDATE refunds SET op_id = 'deleted:' || lower(hex(randomblob(12))), user_id = ?, comment = NULL, created_at = created_at - created_at % 86400000 WHERE user_id = ?",
    keptAs,
    userId,
  ),
];
