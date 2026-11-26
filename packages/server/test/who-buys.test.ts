import { describe, expect, it } from "vitest";
import { BUY_LINES, PAYMENTS, buyMonthStart, capLine } from "@chessroyale/core";
import { createGuest, ensureSchema, signInWithIdentity, type Sql, type User } from "../src/accounts.ts";
import { handleAccountApi } from "../src/api.ts";
import {
  answerBand,
  buyStatus,
  creditPurchase,
  expireCheckout,
  heldTap,
  holdCount,
  openCheckouts,
  recordCheckout,
  type PaidSession,
} from "../src/purchases.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * Who may buy (Nov 26, payments PR 6; server/purchases.ts, core's buyAnswer; docs/decisions/2026-11-26-who-may-buy.md; the design's
 * sections 3, 4 and 9): the band asked once, stored and guarded; the 16-17 band's $50 month at its edge and its turn, counted from the
 * checkouts; under 16; the country; a hold and its end, and the quiet flag's count that starts it; a closed account (no checkout, and
 * a payment begun before it closed kept unclaimed); one open checkout at a time, two at once; held taps; and the API. Every refusal's
 * line is core's BUY_LINES. Nothing is sold yet: PR 7 renders buyStatus, PR 8 calls recordCheckout.
 */

const T0 = Date.UTC(2026, 10, 26, 12, 0);
const DAY = 86_400_000;
const MIN = 60_000;
const pack = (cents: number) => PAYMENTS.packs.find((p) => p.cents === cents)!;

async function world() {
  const { sql, db, d1 } = memoryDb();
  await ensureSchema(sql);
  return { sql, db, d1 };
}
/** A signed-in account, its band not asked yet (and its session's token, for the API). */
async function account(sql: Sql, email: string, now = T0): Promise<User & { token: string }> {
  const g = await createGuest(sql, now, "Player");
  return { ...(await signInWithIdentity(sql, g.user, "email", email, {}, now)), token: g.token };
}
/** A signed-in account with its band answered. */
async function buyer(sql: Sql, email: string, band: "under-16" | "16-17" | "18+", now = T0) {
  const user = await account(sql, email, now);
  expect(await answerBand(sql, user.id, band, "US", now)).toMatchObject({ ok: true });
  return user;
}
const bandOf = (sql: Sql, id: string) => sql.first<{ buy_band: string | null; buy_band_at: number | null }>("SELECT buy_band, buy_band_at FROM users WHERE id = ?", id);
const purchases = (sql: Sql) => sql.all<{ session_id: string; status: string }>("SELECT session_id, status FROM purchases ORDER BY created_at, session_id");
/** A paid Checkout Session for `session`, as PR 8 will read it from Stripe. */
async function paid(sql: Sql, session: string): Promise<PaidSession> {
  const row = await sql.first<{ cents: number }>("SELECT cents FROM purchases WHERE session_id = ?", session);
  return { id: session, paid: true, subtotalCents: row?.cents ?? 0, taxCents: 0, currency: "usd", paymentIntent: `pi_${session}`, cardCountry: "US" };
}
/** A pack checked out and paid at `now`. */
async function buy(sql: Sql, user: User, cents: number, session: string, now = T0) {
  expect(await recordCheckout(sql, user, pack(cents).id, session, now, "US")).toMatchObject({ ok: true });
  expect(await creditPurchase(sql, await paid(sql, session), now + 1000)).toMatchObject({ ok: true, credited: "now" });
}
const lines = async (sql: Sql, id: string, now: number, country = "US") => (await buyStatus(sql, id, country, now)).packs.map((p) => p.line);
const all = (line: string | null) => PAYMENTS.packs.map(() => line);

describe("the band: asked once, stored, guarded", () => {
  it("never answered: the question comes first; the first answer is kept as given, with its time, and asked once", async () => {
    const { sql } = await world();
    const ann = await account(sql, "ann@example.com");
    expect(await buyStatus(sql, ann.id, "US", T0)).toMatchObject({ line: null, askBand: true, leftCents: null });
    expect(await lines(sql, ann.id, T0)).toEqual(all(null));
    // No checkout before the answer.
    expect(await recordCheckout(sql, ann, "coins-200", "cs_test_ann_1", T0, "US")).toEqual({ ok: false, message: BUY_LINES.band });
    expect(await answerBand(sql, ann.id, "16-17", "US", T0)).toMatchObject({ ok: true, status: { askBand: false, leftCents: 5000 } });
    expect(await bandOf(sql, ann.id)).toEqual({ buy_band: "16-17", buy_band_at: T0 });
    // Asked once: another answer changes nothing until its time to ask again (6 months for under 18).
    expect(await answerBand(sql, ann.id, "18+", "US", T0 + DAY)).toEqual({ ok: false, message: "You've answered this already." });
    expect(await bandOf(sql, ann.id)).toEqual({ buy_band: "16-17", buy_band_at: T0 });
    // Not a band: nothing stored.
    const bo = await account(sql, "bo@example.com");
    for (const bad of ["18", "", null, 18, { band: "18+" }]) expect(await answerBand(sql, bo.id, bad, "US", T0)).toEqual({ ok: false, message: "Answer the question." });
    expect(await bandOf(sql, bo.id)).toEqual({ buy_band: null, buy_band_at: null });
  });

  it("an 18+ answer is never asked again; an under-18 one is, 6 months on, up one band at most, and the clock starts again", async () => {
    const { sql } = await world();
    const adult = await buyer(sql, "adult@example.com", "18+");
    expect(await buyStatus(sql, adult.id, "US", T0 + 3 * 365 * DAY)).toMatchObject({ askBand: false, line: null });
    expect(await answerBand(sql, adult.id, "16-17", "US", T0 + 3 * 365 * DAY)).toEqual({ ok: false, message: "You've answered this already." });

    const kid = await buyer(sql, "kid@example.com", "under-16");
    const again = Date.UTC(2027, 4, 26, 12);
    expect(await buyStatus(sql, kid.id, "US", again - 1)).toMatchObject({ line: BUY_LINES.young, askBand: false });
    expect(await answerBand(sql, kid.id, "18+", "US", again - 1)).toEqual({ ok: false, message: BUY_LINES.young });
    expect(await buyStatus(sql, kid.id, "US", again)).toMatchObject({ line: null, askBand: true });
    // 18+ asked: up one band only (16-17), and asked again 6 months from now.
    expect(await answerBand(sql, kid.id, "18+", "US", again)).toMatchObject({ ok: true, status: { askBand: false, leftCents: 5000 } });
    expect(await bandOf(sql, kid.id)).toEqual({ buy_band: "16-17", buy_band_at: again });
    const later = Date.UTC(2027, 10, 26, 12);
    expect(await answerBand(sql, kid.id, "18+", "US", later - 1)).toEqual({ ok: false, message: "You've answered this already." });
    expect(await answerBand(sql, kid.id, "18+", "US", later)).toMatchObject({ ok: true, status: { askBand: false, leftCents: null } });
    expect(await bandOf(sql, kid.id)).toEqual({ buy_band: "18+", buy_band_at: later });

    // A lower answer is kept as given.
    const teen = await buyer(sql, "teen@example.com", "16-17");
    expect(await answerBand(sql, teen.id, "under-16", "US", again)).toMatchObject({ ok: true, status: { line: BUY_LINES.young } });
    expect(await bandOf(sql, teen.id)).toEqual({ buy_band: "under-16", buy_band_at: again });
  });

  it("two answers at once (two tabs): one is stored", async () => {
    const { sql } = await world();
    const ann = await account(sql, "ann@example.com");
    const both = await Promise.all([answerBand(sql, ann.id, "16-17", "US", T0), answerBand(sql, ann.id, "18+", "US", T0)]);
    expect(both.map((r) => r.ok).sort()).toEqual([false, true]);
    expect(both.find((r) => !r.ok)).toEqual({ ok: false, message: "You've answered this already." });
    const kept = both.findIndex((r) => r.ok) === 0 ? "16-17" : "18+";
    expect(await bandOf(sql, ann.id)).toEqual({ buy_band: kept, buy_band_at: T0 });
  });

  it("no age is asked of an account that can't buy anyway: a guest, held, closed, or outside the US and Canada", async () => {
    const { sql } = await world();
    const { user: gus } = await createGuest(sql, T0, "Gus");
    expect(await buyStatus(sql, gus.id, "US", T0)).toMatchObject({ line: BUY_LINES.guest, askBand: false });
    expect(await answerBand(sql, gus.id, "18+", "US", T0)).toEqual({ ok: false, message: BUY_LINES.guest });
    const ann = await account(sql, "ann@example.com");
    expect(await answerBand(sql, ann.id, "18+", "FR", T0)).toEqual({ ok: false, message: BUY_LINES.country });
    expect(await answerBand(sql, ann.id, "18+", null, T0)).toEqual({ ok: false, message: BUY_LINES.country });
    await sql.run("UPDATE users SET hold_until = ? WHERE id = ?", T0 + DAY, ann.id);
    expect(await answerBand(sql, ann.id, "18+", "US", T0)).toEqual({ ok: false, message: BUY_LINES.held });
    await sql.run("UPDATE users SET hold_until = NULL, closed_at = ? WHERE id = ?", T0, ann.id);
    expect(await answerBand(sql, ann.id, "18+", "US", T0)).toEqual({ ok: false, message: BUY_LINES.closed });
    expect(await bandOf(sql, ann.id)).toEqual({ buy_band: null, buy_band_at: null });
    expect(await bandOf(sql, gus.id)).toEqual({ buy_band: null, buy_band_at: null });
  });
});

describe("under 16, and the country", () => {
  it("under 16: every Buy greyed with its line, and no checkout; nothing written", async () => {
    const { sql } = await world();
    const kid = await buyer(sql, "kid@example.com", "under-16");
    expect(await buyStatus(sql, kid.id, "US", T0)).toMatchObject({ line: "Buying coins is for players 16 and older.", askBand: false, held: false, leftCents: null });
    expect(await lines(sql, kid.id, T0)).toEqual(all(BUY_LINES.young));
    expect(await recordCheckout(sql, kid, "coins-200", "cs_test_kid_1", T0, "US")).toEqual({ ok: false, message: BUY_LINES.young });
    expect(await purchases(sql)).toEqual([]);
  });

  it("packs are sold in the US and Canada only, by the request's country (unknown: not sold)", async () => {
    const { sql } = await world();
    const ann = await buyer(sql, "ann@example.com", "18+");
    for (const c of ["FR", "GB", "XX", "T1", null]) {
      expect(await lines(sql, ann.id, T0, c as string)).toEqual(all(BUY_LINES.country));
      expect(await recordCheckout(sql, ann, "coins-200", "cs_test_ann_fr", T0, c)).toEqual({ ok: false, message: BUY_LINES.country });
    }
    expect(await purchases(sql)).toEqual([]);
    expect(await recordCheckout(sql, ann, "coins-200", "cs_test_ann_ca", T0, "CA")).toMatchObject({ ok: true });
  });
});

describe("16-17: $50 a buying month", () => {
  it("at the edge: up to $50 exactly is bought, a cent over is refused with what's left, the statement holds it too", async () => {
    const { sql } = await world();
    const teen = await buyer(sql, "teen@example.com", "16-17");
    await buy(sql, teen, 4999, "cs_test_a");
    // $0.01 left: every pack greyed with it, and refused at checkout.
    expect(await buyStatus(sql, teen.id, "US", T0 + MIN)).toMatchObject({ line: null, leftCents: 1 });
    expect(await lines(sql, teen.id, T0 + MIN)).toEqual(all("Monthly limit for players under 18: $0.01 left."));
    expect(await recordCheckout(sql, teen, "coins-200", "cs_test_b", T0 + MIN, "US")).toEqual({ ok: false, message: capLine(1) });
    // A refund gives back what it returned: $1.98 back is $1.99 left, so the $1.99 fits exactly; $1.97 back isn't enough.
    await sql.run("UPDATE purchases SET refunded_cents = 197, status = 'part_refunded' WHERE session_id = 'cs_test_a'");
    expect(await lines(sql, teen.id, T0 + MIN)).toEqual(all(capLine(198)));
    expect(await recordCheckout(sql, teen, "coins-200", "cs_test_b", T0 + MIN, "US")).toEqual({ ok: false, message: capLine(198) });
    await sql.run("UPDATE purchases SET refunded_cents = 198 WHERE session_id = 'cs_test_a'");
    expect(await lines(sql, teen.id, T0 + MIN)).toEqual([null, ...all(capLine(199)).slice(1)]);
    expect(await recordCheckout(sql, teen, "coins-200", "cs_test_b", T0 + MIN, "US")).toMatchObject({ ok: true });
    // The pending one counts: nothing left, even before it's paid.
    expect(await expireCheckout(sql, "cs_test_b")).toBe(true);
    expect(await buyStatus(sql, teen.id, "US", T0 + MIN)).toMatchObject({ leftCents: 199 });
    expect(await recordCheckout(sql, teen, "coins-200", "cs_test_c", T0 + 2 * MIN, "US")).toMatchObject({ ok: true });
    expect(await buyStatus(sql, teen.id, "US", T0 + 2 * MIN)).toMatchObject({ leftCents: 0 });
    // An adult's spend has no cap.
    const adult = await buyer(sql, "adult@example.com", "18+");
    for (const [i, s] of ["cs_test_d1", "cs_test_d2", "cs_test_d3"].entries()) await buy(sql, adult, 4999, s, T0 + i * MIN);
    expect(await buyStatus(sql, adult.id, "US", T0 + 4 * MIN)).toMatchObject({ line: null, leftCents: null });
    expect(await lines(sql, adult.id, T0 + 4 * MIN)).toEqual(all(null));
  });

  it("the statement refuses past the cap even when the read let it through (another checkout paid between them)", async () => {
    const { sql } = await world();
    const teen = await buyer(sql, "teen@example.com", "16-17");
    // Between this checkout's reads and its INSERT, a $49.99 is checked out and paid (another tab): the INSERT's own cap refuses it.
    let raced = false;
    const racing: Sql = {
      ...sql,
      async run(q, ...p) {
        if (!raced && /^\s*INSERT INTO purchases/.test(q) && p.includes("cs_test_late")) {
          raced = true;
          await buy(sql, teen, 4999, "cs_test_first", T0);
        }
        return sql.run(q, ...p);
      },
    };
    expect(await recordCheckout(racing, teen, "coins-520", "cs_test_late", T0 + 2000, "US")).toEqual({ ok: false, message: capLine(1) });
    expect(raced).toBe(true);
    expect(await purchases(sql)).toEqual([{ session_id: "cs_test_first", status: "paid" }]);
  });

  it("the month turns at 08:00 UTC on the 1st (midnight Pacific); a checkout counts in the month it was made", async () => {
    const { sql } = await world();
    const dec1 = Date.UTC(2026, 11, 1, 8);
    const teen = await buyer(sql, "teen@example.com", "16-17", dec1 - 10 * DAY);
    // Made at 11:50 pm Pacific on Nov 30, paid after the turn: November's.
    expect(await recordCheckout(sql, teen, "coins-6000", "cs_test_nov", dec1 - 10 * MIN, "US")).toMatchObject({ ok: true });
    expect(await creditPurchase(sql, await paid(sql, "cs_test_nov"), dec1 + 10 * MIN)).toMatchObject({ ok: true });
    expect(await buyStatus(sql, teen.id, "US", dec1 - 1)).toMatchObject({ leftCents: 1 });
    expect(await recordCheckout(sql, teen, "coins-200", "cs_test_x", dec1 - 1, "US")).toEqual({ ok: false, message: capLine(1) });
    // December: $50 again.
    expect(buyMonthStart(dec1)).toBe(dec1);
    expect(await buyStatus(sql, teen.id, "US", dec1)).toMatchObject({ leftCents: 5000 });
    expect(await lines(sql, teen.id, dec1)).toEqual(all(null));
    expect(await recordCheckout(sql, teen, "coins-6000", "cs_test_dec", dec1 + 20 * MIN, "US")).toMatchObject({ ok: true });
    expect(await buyStatus(sql, teen.id, "US", dec1 + 21 * MIN)).toMatchObject({ leftCents: 1 });
  });

  it("counts every checkout made this month, pending or paid, less refunds; never one expired or unclaimed", async () => {
    const { sql } = await world();
    const teen = await buyer(sql, "teen@example.com", "16-17");
    const row = (session: string, cents: number, status: string, refunded = 0, at = T0) =>
      sql.run(
        "INSERT INTO purchases (session_id, ref, user_id, pack, coins, cents, status, refunded_cents, created_at) VALUES (?, ?, ?, 'coins-200', 200, ?, ?, ?, ?)",
        session,
        `ref_${session}`,
        teen.id,
        cents,
        status,
        refunded,
        at,
      );
    await row("cs_test_paid", 999, "paid");
    await row("cs_test_pending", 499, "pending", 0, T0 - 3 * 60 * MIN);
    await row("cs_test_refunded", 1999, "refunded", 1999);
    await row("cs_test_part", 1999, "part_refunded", 1000);
    await row("cs_test_disputed", 199, "disputed");
    await row("cs_test_expired", 4999, "expired");
    await row("cs_test_unclaimed", 4999, "unclaimed");
    await row("cs_test_last_month", 4999, "paid", 0, buyMonthStart(T0) - 1);
    // 999 + 499 + 0 + 999 + 199 = 2696.
    expect(await buyStatus(sql, teen.id, "US", T0)).toMatchObject({ leftCents: 5000 - 2696 });
  });
});

describe("a hold, and the quiet flag's count that starts it", () => {
  it("the 3rd refund or chargeback starts 90 days; each one after starts them again; two at once count two", async () => {
    const { sql } = await world();
    const ann = await buyer(sql, "ann@example.com", "18+");
    const state = () => sql.first<{ refund_count: number; hold_until: number | null }>("SELECT refund_count, hold_until FROM users WHERE id = ?", ann.id);
    expect([PAYMENTS.hold.after, PAYMENTS.hold.days]).toEqual([3, 90]);
    await sql.batch([holdCount(ann.id, T0)]);
    await sql.batch([holdCount(ann.id, T0 + DAY)]);
    expect(await state()).toEqual({ refund_count: 2, hold_until: null });
    expect(await buyStatus(sql, ann.id, "US", T0 + DAY)).toMatchObject({ line: null, held: false });
    await sql.batch([holdCount(ann.id, T0 + 2 * DAY)]);
    expect(await state()).toEqual({ refund_count: 3, hold_until: T0 + 92 * DAY });
    await sql.batch([holdCount(ann.id, T0 + 10 * DAY)]);
    expect(await state()).toEqual({ refund_count: 4, hold_until: T0 + 100 * DAY });
    // (Never shortened: a later end stays, here one set longer by hand.)
    await sql.run("UPDATE users SET hold_until = ? WHERE id = ?", T0 + 500 * DAY, ann.id);
    await sql.batch([holdCount(ann.id, T0 + 11 * DAY)]);
    expect(await state()).toEqual({ refund_count: 5, hold_until: T0 + 500 * DAY });
    const bo = await buyer(sql, "bo@example.com", "18+");
    await Promise.all([sql.batch([holdCount(bo.id, T0)]), sql.batch([holdCount(bo.id, T0)]), sql.batch([holdCount(bo.id, T0)])]);
    expect(await sql.first("SELECT refund_count, hold_until FROM users WHERE id = ?", bo.id)).toEqual({ refund_count: 3, hold_until: T0 + 90 * DAY });
  });

  it("held: every Buy greyed with a line that names no reason, no checkout; from the hold's end, buying again", async () => {
    const { sql } = await world();
    const ann = await buyer(sql, "ann@example.com", "18+");
    for (let i = 0; i < 3; i++) await sql.batch([holdCount(ann.id, T0)]);
    const end = T0 + 90 * DAY;
    expect(await buyStatus(sql, ann.id, "US", end - 1)).toMatchObject({ line: "Purchasing isn't available on this account.", held: true, askBand: false, leftCents: null });
    expect(await lines(sql, ann.id, end - 1)).toEqual(all(BUY_LINES.held));
    expect(await recordCheckout(sql, ann, "coins-200", "cs_test_held", end - 1, "US")).toEqual({ ok: false, message: BUY_LINES.held });
    expect(await purchases(sql)).toEqual([]);
    expect(await buyStatus(sql, ann.id, "US", end)).toMatchObject({ line: null, held: false });
    expect(await recordCheckout(sql, ann, "coins-200", "cs_test_after", end, "US")).toMatchObject({ ok: true });
  });

  it("a hold started between the checkout's read and its INSERT: the statement refuses it", async () => {
    const { sql } = await world();
    const ann = await buyer(sql, "ann@example.com", "18+");
    const racing: Sql = {
      ...sql,
      async run(q, ...p) {
        if (/^\s*INSERT INTO purchases/.test(q)) await sql.run("UPDATE users SET hold_until = ? WHERE id = ?", T0 + DAY, ann.id);
        return sql.run(q, ...p);
      },
    };
    expect(await recordCheckout(racing, ann, "coins-200", "cs_test_ann", T0, "US")).toEqual({ ok: false, message: BUY_LINES.held });
    expect(await purchases(sql)).toEqual([]);
  });

  it("taps on a greyed Buy while held: counted at most once a minute; never when not held", async () => {
    const { sql } = await world();
    const ann = await buyer(sql, "ann@example.com", "18+");
    const taps = async () => (await sql.first<{ held_taps: number }>("SELECT held_taps FROM users WHERE id = ?", ann.id))!.held_taps;
    expect(PAYMENTS.hold.tapGapMs).toBe(MIN);
    expect(await heldTap(sql, ann.id, T0)).toBe(false);
    expect(await taps()).toBe(0);
    await sql.run("UPDATE users SET hold_until = ? WHERE id = ?", T0 + 10 * DAY, ann.id);
    expect(await heldTap(sql, ann.id, T0 + 1)).toBe(true);
    expect(await heldTap(sql, ann.id, T0 + 2)).toBe(false);
    expect(await heldTap(sql, ann.id, T0 + MIN)).toBe(false);
    expect(await heldTap(sql, ann.id, T0 + MIN + 1)).toBe(true);
    expect(await taps()).toBe(2);
    // The hold over: not counted.
    expect(await heldTap(sql, ann.id, T0 + 10 * DAY)).toBe(false);
    expect(await taps()).toBe(2);
  });
});

describe("a closed account", () => {
  it("can't buy: every Buy greyed with the closed line, no checkout; a payment begun before it closed is kept unclaimed, no coins", async () => {
    const { sql } = await world();
    const ann = await buyer(sql, "ann@example.com", "18+");
    expect(await recordCheckout(sql, ann, "coins-520", "cs_test_before", T0, "US")).toMatchObject({ ok: true });
    await sql.run("UPDATE users SET closed_at = ?, closed_reason = 'chargebacks' WHERE id = ?", T0 + MIN, ann.id);
    expect(await buyStatus(sql, ann.id, "US", T0 + 2 * MIN)).toMatchObject({ line: "This account is closed. Questions: support@hunchess.com", askBand: false, held: false });
    expect(await lines(sql, ann.id, T0 + 2 * MIN)).toEqual(all(BUY_LINES.closed));
    expect(await recordCheckout(sql, ann, "coins-200", "cs_test_after", T0 + 40 * MIN, "US")).toEqual({ ok: false, message: BUY_LINES.closed });
    expect(await creditPurchase(sql, await paid(sql, "cs_test_before"), T0 + 3 * MIN)).toEqual({ ok: false, why: "closed" });
    expect(await sql.first("SELECT status, remaining, paid_at FROM purchases WHERE session_id = 'cs_test_before'")).toEqual({ status: "unclaimed", remaining: 0, paid_at: T0 + 3 * MIN });
    expect(await sql.first("SELECT COUNT(*) AS n FROM ledger WHERE reason = 'purchase'")).toEqual({ n: 0 });
    // Closed between the credit's reads and its write: the op's own statement refuses it, and it's kept unclaimed all the same.
    const bo = await buyer(sql, "bo@example.com", "18+");
    expect(await recordCheckout(sql, bo, "coins-200", "cs_test_bo", T0, "US")).toMatchObject({ ok: true });
    let closed = false;
    const racing: Sql = {
      ...sql,
      async batch(statements) {
        if (!closed) (closed = true), await sql.run("UPDATE users SET closed_at = ? WHERE id = ?", T0 + MIN, bo.id);
        return sql.batch(statements);
      },
    };
    expect(await creditPurchase(racing, await paid(sql, "cs_test_bo"), T0 + 2 * MIN)).toEqual({ ok: false, why: "closed" });
    expect(await sql.first("SELECT status, remaining FROM purchases WHERE session_id = 'cs_test_bo'")).toEqual({ status: "unclaimed", remaining: 0 });
    expect(await sql.first("SELECT COUNT(*) AS n FROM wallets WHERE user_id = ?", bo.id)).toEqual({ n: 0 });
  });
});

describe("one open checkout at a time", () => {
  it("another while one is open is refused; closed (expired) or 30 minutes on, the next goes through; a paid one isn't open", async () => {
    const { sql } = await world();
    const ann = await buyer(sql, "ann@example.com", "18+");
    expect(PAYMENTS.buyers.checkoutMinutes).toBe(30);
    expect(await recordCheckout(sql, ann, "coins-200", "cs_test_1", T0, "US")).toMatchObject({ ok: true });
    expect(await openCheckouts(sql, ann.id, T0 + 1)).toEqual(["cs_test_1"]);
    // The same session again is still the one checkout.
    expect(await recordCheckout(sql, ann, "coins-200", "cs_test_1", T0 + 2, "US")).toMatchObject({ ok: true });
    expect(await recordCheckout(sql, ann, "coins-520", "cs_test_2", T0 + 30 * MIN - 1, "US")).toEqual({ ok: false, message: BUY_LINES.open });
    // 30 minutes on (Stripe's session has expired by then): no longer open.
    expect(await openCheckouts(sql, ann.id, T0 + 30 * MIN)).toEqual([]);
    expect(await recordCheckout(sql, ann, "coins-520", "cs_test_2", T0 + 30 * MIN, "US")).toMatchObject({ ok: true });
    // A new Buy closes the open one first (PR 8 expires it at Stripe, then here), and goes through.
    expect(await recordCheckout(sql, ann, "coins-1100", "cs_test_3", T0 + 31 * MIN, "US")).toEqual({ ok: false, message: BUY_LINES.open });
    expect(await expireCheckout(sql, "cs_test_2")).toBe(true);
    expect(await expireCheckout(sql, "cs_test_2")).toBe(false);
    expect(await recordCheckout(sql, ann, "coins-1100", "cs_test_3", T0 + 31 * MIN, "US")).toMatchObject({ ok: true });
    // Paid: not open (and an expired or paid one is never marked expired again).
    expect(await creditPurchase(sql, await paid(sql, "cs_test_3"), T0 + 32 * MIN)).toMatchObject({ ok: true });
    expect(await expireCheckout(sql, "cs_test_3")).toBe(false);
    expect(await openCheckouts(sql, ann.id, T0 + 33 * MIN)).toEqual([]);
    expect(await recordCheckout(sql, ann, "coins-200", "cs_test_4", T0 + 33 * MIN, "US")).toMatchObject({ ok: true });
    expect(await purchases(sql)).toEqual([
      { session_id: "cs_test_1", status: "pending" },
      { session_id: "cs_test_2", status: "expired" },
      { session_id: "cs_test_3", status: "paid" },
      { session_id: "cs_test_4", status: "pending" },
    ]);
    // Another account's open checkout is its own.
    const bo = await buyer(sql, "bo@example.com", "18+");
    expect(await recordCheckout(sql, bo, "coins-200", "cs_test_bo", T0 + 33 * MIN, "US")).toMatchObject({ ok: true });
  });

  it("two Buys at once: one checkout is recorded, the other refused", async () => {
    const { sql } = await world();
    const ann = await buyer(sql, "ann@example.com", "18+");
    const both = await Promise.all([recordCheckout(sql, ann, "coins-200", "cs_test_a", T0, "US"), recordCheckout(sql, ann, "coins-520", "cs_test_b", T0, "US")]);
    expect(both.filter((r) => r.ok)).toHaveLength(1);
    expect(both.find((r) => !r.ok)).toEqual({ ok: false, message: BUY_LINES.open });
    expect(await purchases(sql)).toHaveLength(1);
  });
});

describe("the API: GET /api/buy, POST /api/buy/band, POST /api/buy/tap", () => {
  const origin = "https://hunchess.com";
  const call = async (env: object, path: string, init: RequestInit & { cookie?: string; country?: string } = {}) => {
    const headers = new Headers(init.headers);
    if (init.cookie) headers.set("cookie", init.cookie);
    const request = new Request(origin + path, { ...init, headers });
    // (Cloudflare's own: the request's country.)
    if (init.country) Object.defineProperty(request, "cf", { value: { country: init.country } });
    return (await handleAccountApi(request, env as never))!;
  };
  const asJson = { origin, "content-type": "application/json" };

  it("answers may this account buy, each Buy's line; takes the band once, from this site as JSON; counts held taps", async () => {
    const { sql, d1 } = await world();
    const env = { DB: d1 };
    const now = Date.now();
    const ann = await account(sql, "ann@example.com", now);
    const cookie = `hc_session=${ann.token}`;
    const get = async (country?: string) => (await (await call(env, "/api/buy", { cookie, ...(country ? { country } : {}) })).json()) as Record<string, unknown>;
    expect(await get("US")).toMatchObject({ line: null, askBand: true, held: false, leftCents: null });
    // (No country from Cloudflare: not sold.)
    expect(await get()).toMatchObject({ line: BUY_LINES.country, askBand: false });
    expect(await get("FR")).toMatchObject({ line: BUY_LINES.country });

    const band = (body: unknown, headers: Record<string, string> = asJson, country = "US") => call(env, "/api/buy/band", { method: "POST", cookie, country, headers, body: JSON.stringify(body) });
    expect((await band({ band: "18+" }, { origin: "https://evil.example", "content-type": "application/json" })).status).toBe(403);
    expect((await band({ band: "18+" }, { origin })).status).toBe(415);
    expect(await bandOf(sql, ann.id)).toEqual({ buy_band: null, buy_band_at: null });
    const answered = await band({ band: "16-17" });
    expect(answered.status).toBe(200);
    expect(await answered.json()).toMatchObject({ line: null, askBand: false, leftCents: 5000, packs: PAYMENTS.packs.map((p) => ({ id: p.id, coins: p.coins, cents: p.cents, line: null })) });
    const again = await band({ band: "18+" });
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ message: "You've answered this already." });
    expect(await bandOf(sql, ann.id)).toMatchObject({ buy_band: "16-17" });

    // Held: the line, `held`, and a tap counted once.
    await sql.run("UPDATE users SET hold_until = ? WHERE id = ?", now + DAY, ann.id);
    expect(await get("US")).toMatchObject({ line: BUY_LINES.held, held: true });
    const tap = async () => (await (await call(env, "/api/buy/tap", { method: "POST", cookie })).json()) as { counted: boolean };
    expect(await tap()).toEqual({ counted: true });
    expect(await tap()).toEqual({ counted: false });
    expect(await sql.first("SELECT held_taps FROM users WHERE id = ?", ann.id)).toEqual({ held_taps: 1 });

    // A guest: the sign-in line, and no band taken.
    const g = await createGuest(sql, now, "Gus");
    const guest = (await (await call(env, "/api/buy", { cookie: `hc_session=${g.token}`, country: "US" })).json()) as Record<string, unknown>;
    expect(guest).toMatchObject({ line: BUY_LINES.guest, askBand: false });
    const gb = await call(env, "/api/buy/band", { method: "POST", cookie: `hc_session=${g.token}`, country: "US", headers: asJson, body: JSON.stringify({ band: "18+" }) });
    expect([gb.status, await gb.json()]).toEqual([409, { message: BUY_LINES.guest }]);
    // No session at all: nothing to answer for.
    expect((await call(env, "/api/buy", { country: "US" })).status).toBe(401);
  });
});
