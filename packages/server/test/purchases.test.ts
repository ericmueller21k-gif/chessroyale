import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { PAYMENTS, shopItem } from "@chessroyale/core";
import { buyItem, createGuest, d1Sql, ensureSchema, grantReward, schemaParts, signInWithIdentity, type Sql, type User } from "../src/accounts.ts";
import { accountDownload, deleteAccount } from "../src/account-data.ts";
import { applyOp, backfillLedger, leg, ledgerAccount, ledgerCheck, ledgerMismatches, spendLegs } from "../src/ledger.ts";
import { coinSplit, creditOpId, creditPurchase, recordCheckout, refundable, type PaidSession } from "../src/purchases.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * Purchases' storage (Nov 26, payments PR 5; server/purchases.ts, ledger.ts's kind `purchase`; docs/decisions/2026-11-26-purchases-storage.md):
 * the migration on a copy of the schema as it was the day before (fixtures/schema-2026-11-26.json, made by ensureSchema on main at
 * 92320601), a checkout and its credit (once, however often or at once it's called; never a guest's), earned coins spent first and
 * then the oldest purchase's, the guarded races (a spend, a grant meanwhile; refused twice), the refundable amount, deleting and the
 * download, a guest's merge, and the reconciliation covering the new kind. Coins cost money only once Stripe is wired (PR 8): nothing
 * calls recordCheckout or creditPurchase yet but these tests.
 */

// (Everything in the shop is free while SHOP_FREE is on: these spend coins, so it's off, as shop-buy.test.ts does.)
vi.mock("@chessroyale/core", async (orig) => ({ ...(await orig<typeof import("@chessroyale/core")>()), SHOP_FREE: false }));

const T0 = Date.UTC(2026, 10, 26, 12, 0);
const DAY = 86_400_000;
const price = (id: string) => shopItem(id)!.price;
/** God King effects and their prices (300, 350, 400): what these tests buy with coins. */
const STORM = "king-storm";
const EMERALD = "king-emerald";
const HELLFIRE = "king-hellfire";

async function world() {
  const { sql, db } = memoryDb();
  await ensureSchema(sql);
  return { sql, db };
}
const signedIn = async (sql: Sql, email: string, now = T0) => signInWithIdentity(sql, (await createGuest(sql, now, "Player")).user, "email", email, {}, now);
const coinsOf = async (sql: Sql, id: string) => (await sql.first<{ coins: number }>("SELECT coins FROM wallets WHERE user_id = ?", id))?.coins ?? 0;
const remainingOf = async (sql: Sql, session: string) => (await sql.first<{ remaining: number }>("SELECT remaining FROM purchases WHERE session_id = ?", session))?.remaining;
/** Earned coins, as a game or a reward pays them. */
const earn = (sql: Sql, id: string, coins: number, now = T0) => grantReward(sql, id, coins, 0, undefined, now);
const pack = (coins: number) => PAYMENTS.packs.find((p) => p.coins === coins)!;

/** A paid Checkout Session for `session`, as PR 8 will read it from Stripe (the buyer's ledger id, the pack's price). */
async function paid(sql: Sql, user: User, session: string, over: Partial<PaidSession> = {}): Promise<PaidSession> {
  const row = await sql.first<{ cents: number }>("SELECT cents FROM purchases WHERE session_id = ?", session);
  return {
    id: session,
    account: (await ledgerAccount(sql, user.id))!.account,
    paid: true,
    subtotalCents: row?.cents ?? 0,
    taxCents: 12,
    currency: "usd",
    paymentIntent: `pi_${session}`,
    cardCountry: "US",
    ...over,
  };
}
/** A pack bought and paid at `now`: its checkout, then its credit. */
async function buy(sql: Sql, user: User, coins: number, session: string, now = T0) {
  expect(await recordCheckout(sql, user, pack(coins).id, session, now - 60_000)).toMatchObject({ ok: true });
  expect(await creditPurchase(sql, await paid(sql, user, session), now)).toMatchObject({ ok: true, credited: "now", coins });
}

describe("the migration, on a copy of the schema as it was before (live data, every account before it)", () => {
  const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "fixtures/schema-2026-11-26.json");

  it("adds the two tables and the account's columns with their defaults; every row as it was; the ledger and balances still agree", async () => {
    const before = JSON.parse(readFileSync(FIXTURE, "utf8")) as { version: string; statements: string[] };
    const { sql, db, d1 } = memoryDb();
    for (const s of before.statements) db.exec(s);
    db.prepare("INSERT INTO meta (key, value) VALUES ('schema', ?)").run(before.version);
    expect(before.version).not.toBe(schemaParts.version);
    // (Today's data: a signed-in account with coins and their ledger rows, a guest, a result.)
    db.prepare("INSERT INTO users (id, name, email, created_at, last_seen, age_ok_at) VALUES ('ann', 'Ann', 'ann@example.com', 1, 2, 1)").run();
    db.prepare("INSERT INTO users (id, name, created_at, last_seen) VALUES ('gus', 'Player', 3, 4)").run();
    db.prepare("INSERT INTO wallets (user_id, coins, xp) VALUES ('ann', 420, 900)").run();
    db.prepare("INSERT INTO ledger_accounts (user_id, account) VALUES ('ann', 'L-ann')").run();
    db.prepare(
      "INSERT INTO ledger (op_id, leg, account, asset_kind, asset_id, delta, reason, source_id, created_at, nonce) VALUES ('p1', 0, 'L-ann', 'coins', '', 420, 'play', 'g1', 5, 'n'), ('p2', 0, 'L-ann', 'xp', '', 900, 'xp', 'g1', 5, 'n')",
    ).run();
    db.prepare("INSERT INTO results (user_id, mode, online, placement, players, played_at) VALUES ('ann', 'crowd', 1, 1, 100, 6)").run();
    const rowsBefore = (t: string) => db.prepare(`SELECT * FROM ${t} ORDER BY 1`).all();
    const kept = Object.fromEntries(["wallets", "ledger", "ledger_accounts", "results"].map((t) => [t, rowsBefore(t)]));

    // (As a request runs it: the D1 binding, its batches.)
    const live = d1Sql(d1);
    await ensureSchema(live, {});
    expect(await live.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('purchases', 'refunds') ORDER BY name")).toEqual([{ name: "purchases" }, { name: "refunds" }]);
    expect(await live.all("SELECT COUNT(*) AS n FROM purchases UNION ALL SELECT COUNT(*) FROM refunds")).toEqual([{ n: 0 }, { n: 0 }]);
    expect(
      await live.all("SELECT id, buy_band, buy_band_at, refund_count, hold_until, chargebacks, closed_at, closed_reason, held_taps, email FROM users ORDER BY id"),
    ).toEqual([
      { id: "ann", buy_band: null, buy_band_at: null, refund_count: 0, hold_until: null, chargebacks: 0, closed_at: null, closed_reason: null, held_taps: 0, email: "ann@example.com" },
      { id: "gus", buy_band: null, buy_band_at: null, refund_count: 0, hold_until: null, chargebacks: 0, closed_at: null, closed_reason: null, held_taps: 0, email: null },
    ]);
    for (const [t, rows] of Object.entries(kept)) expect(rowsBefore(t), t).toEqual(rows);
    expect(await ledgerCheck(live, 10)).toEqual([]);
    expect(await live.first("SELECT value FROM meta WHERE key = 'schema'")).toEqual({ value: schemaParts.version });

    // The same tables and columns as a fresh database's, and a second run (another Worker instance) changes nothing.
    const fresh = await world();
    const shape = (s: Sql) =>
      s.all<{ name: string; cols: string }>(
        "SELECT m.name, (SELECT group_concat(p.name || ' ' || p.type || ' ' || p.\"notnull\" || ' ' || COALESCE(p.dflt_value, ''), ', ') FROM pragma_table_info(m.name) p) AS cols FROM sqlite_master m WHERE m.type = 'table' ORDER BY m.name",
      );
    expect(await shape(live)).toEqual(await shape(fresh.sql));
    await ensureSchema(live, {});
    for (const [t, rows] of Object.entries(kept)) expect(rowsBefore(t), t).toEqual(rows);

    // And it works: Ann (from before) buys a pack and spends earned coins first.
    const ann = { id: "ann", name: "Ann", icon: "♟", email: "ann@example.com", google_sub: null, created_at: 1 } satisfies User;
    await buy(live, ann, 200, "cs_test_after_migration", T0);
    expect(await coinSplit(live, "ann")).toEqual({ coins: 620, bought: 200, earned: 420 });
    expect(await buyItem(live, "ann", HELLFIRE, T0 + 1)).toMatchObject({ ok: true });
    expect(await coinSplit(live, "ann")).toEqual({ coins: 220, bought: 200, earned: 20 });
    expect(await ledgerMismatches(live, "ann")).toEqual([]);
  });
});

describe("a checkout, and its credit: once, never a guest's", () => {
  it("a checkout is a pending row with its pack's coins and price as they are then; the same session again changes nothing", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    expect(await recordCheckout(sql, ann, "coins-520", "cs_test_ann_1", T0)).toEqual({ ok: true, pack: pack(520) });
    expect(await recordCheckout(sql, ann, "coins-520", "cs_test_ann_1", T0 + 5)).toEqual({ ok: true, pack: pack(520) });
    expect(await sql.all("SELECT * FROM purchases")).toEqual([
      {
        session_id: "cs_test_ann_1",
        user_id: ann.id,
        pack: "coins-520",
        coins: 520,
        remaining: 0,
        cents: 499,
        tax_cents: 0,
        payment_intent: null,
        card_country: null,
        status: "pending",
        refunded_cents: 0,
        created_at: T0,
        paid_at: null,
      },
    ]);
    // Someone else's session, an unknown pack, a session id that isn't one.
    const bo = await signedIn(sql, "bo@example.com");
    expect(await recordCheckout(sql, bo, "coins-200", "cs_test_ann_1", T0)).toEqual({ ok: false, message: "That checkout isn't yours." });
    expect(await recordCheckout(sql, bo, "coins-7", "cs_test_bo_1", T0)).toEqual({ ok: false, message: "That coin pack isn't sold." });
    await expect(recordCheckout(sql, bo, "coins-200", "cs'; DROP TABLE purchases; --", T0)).rejects.toThrow(/not a session id/);
    expect(await sql.first("SELECT COUNT(*) AS n FROM purchases")).toEqual({ n: 1 });
  });

  it("guests can't buy: no checkout, and no credit even for a row that got past (checked in the statement too)", async () => {
    const { sql } = await world();
    const { user: gus } = await createGuest(sql, T0, "Gus");
    expect(await recordCheckout(sql, gus, "coins-200", "cs_test_gus_1", T0)).toEqual({ ok: false, message: "Sign in to buy coins." });
    // (A stale signed-in view of a guest: the statement's own check refuses it.)
    expect(await recordCheckout(sql, { ...gus, email: "gus@example.com" }, "coins-200", "cs_test_gus_1", T0)).toEqual({ ok: false, message: "Sign in to buy coins." });
    expect(await sql.first("SELECT COUNT(*) AS n FROM purchases")).toEqual({ n: 0 });
    await sql.run("INSERT INTO purchases (session_id, user_id, pack, coins, cents, created_at) VALUES ('cs_test_gus_2', ?, 'coins-200', 200, 199, ?)", gus.id, T0);
    expect(await creditPurchase(sql, await paid(sql, gus, "cs_test_gus_2"), T0)).toEqual({ ok: false, why: "guest" });
    expect(await coinsOf(sql, gus.id)).toBe(0);
    expect(await sql.first("SELECT COUNT(*) AS n FROM ledger")).toEqual({ n: 0 });
  });

  it("credits once: its coins into the wallet and the purchase, one op `pay:<session>`; again, or three at once, pay nothing more", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await recordCheckout(sql, ann, "coins-520", "cs_test_ann_1", T0 - 60_000);
    const s = await paid(sql, ann, "cs_test_ann_1");
    expect(await creditPurchase(sql, s, T0)).toEqual({ ok: true, credited: "now", coins: 520, user: ann.id });
    expect(await creditPurchase(sql, s, T0 + 1)).toEqual({ ok: true, credited: "before", coins: 520, user: ann.id });
    expect(await sql.first("SELECT remaining, status, paid_at, tax_cents, payment_intent, card_country FROM purchases")).toEqual({
      remaining: 520,
      status: "paid",
      paid_at: T0,
      tax_cents: 12,
      payment_intent: "pi_cs_test_ann_1",
      card_country: "US",
    });
    const acct = (await ledgerAccount(sql, ann.id))!.account;
    expect(await sql.all("SELECT op_id, leg, account, asset_kind, asset_id, delta, reason, source_id FROM ledger ORDER BY leg")).toEqual([
      { op_id: creditOpId("cs_test_ann_1"), leg: 0, account: acct, asset_kind: "coins", asset_id: "", delta: 520, reason: "purchase", source_id: "cs_test_ann_1" },
      { op_id: "pay:cs_test_ann_1", leg: 1, account: acct, asset_kind: "purchase", asset_id: "cs_test_ann_1", delta: 520, reason: "purchase", source_id: "cs_test_ann_1" },
    ]);
    // Three at once of another session: one credits.
    await recordCheckout(sql, ann, "coins-200", "cs_test_ann_2", T0);
    const s2 = await paid(sql, ann, "cs_test_ann_2");
    const race = await Promise.all([creditPurchase(sql, s2, T0 + 2), creditPurchase(sql, s2, T0 + 2), creditPurchase(sql, s2, T0 + 2)]);
    expect(race.map((r) => (r.ok ? r.credited : r.why)).sort()).toEqual(["before", "before", "now"]);
    expect(await coinSplit(sql, ann.id)).toEqual({ coins: 720, bought: 720, earned: 0 });
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("pays nothing for a session we never made, one not paid, a price, currency or buyer not the row's, one not pending", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const bo = await signedIn(sql, "bo@example.com");
    await recordCheckout(sql, ann, "coins-1100", "cs_test_ann_1", T0);
    const s = await paid(sql, ann, "cs_test_ann_1");
    expect(await creditPurchase(sql, { ...s, id: "cs_test_nobody" }, T0)).toEqual({ ok: false, why: "unknown" });
    expect(await creditPurchase(sql, { ...s, paid: false }, T0)).toEqual({ ok: false, why: "unpaid" });
    expect(await creditPurchase(sql, { ...s, subtotalCents: 199 }, T0)).toEqual({ ok: false, why: "mismatch" });
    expect(await creditPurchase(sql, { ...s, currency: "cad" }, T0)).toEqual({ ok: false, why: "mismatch" });
    expect(await creditPurchase(sql, { ...s, account: (await ledgerAccount(sql, bo.id))!.account }, T0)).toEqual({ ok: false, why: "mismatch" });
    await sql.run("UPDATE purchases SET status = 'expired' WHERE session_id = 'cs_test_ann_1'");
    expect(await creditPurchase(sql, s, T0)).toEqual({ ok: false, why: "not-pending" });
    expect(await coinsOf(sql, ann.id)).toBe(0);
    expect(await coinsOf(sql, bo.id)).toBe(0);
    expect(await sql.first("SELECT COUNT(*) AS n FROM ledger")).toEqual({ n: 0 });
    expect(await sql.first("SELECT remaining, paid_at FROM purchases")).toEqual({ remaining: 0, paid_at: null });
  });
});

describe("spending: earned coins first, then the oldest purchase's", () => {
  it("across several purchases: earned, then the oldest paid, then the next, each draw a leg of the spend's own op", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await earn(sql, ann.id, 30);
    // (Paid in this order: B's checkout began first, but A was paid first, so A is the older purchase.)
    await recordCheckout(sql, ann, "coins-520", "cs_test_B", T0);
    await buy(sql, ann, 200, "cs_test_A", T0 + 1000);
    expect(await creditPurchase(sql, await paid(sql, ann, "cs_test_B"), T0 + 2000)).toMatchObject({ credited: "now" });
    expect(await coinSplit(sql, ann.id)).toEqual({ coins: 750, bought: 720, earned: 30 });

    expect(await buyItem(sql, ann.id, STORM, T0 + 3000)).toMatchObject({ ok: true });
    // 300: earned's 30, all of A's 200, then 70 of B's.
    expect([await remainingOf(sql, "cs_test_A"), await remainingOf(sql, "cs_test_B")]).toEqual([0, 450]);
    expect(await coinSplit(sql, ann.id)).toEqual({ coins: 450, bought: 450, earned: 0 });
    const acct = (await ledgerAccount(sql, ann.id))!.account;
    expect(await sql.all("SELECT asset_kind, asset_id, delta FROM ledger WHERE op_id = ? ORDER BY leg", `shop:${acct}:${STORM}`)).toEqual([
      { asset_kind: "shop", asset_id: STORM, delta: 1 },
      { asset_kind: "coins", asset_id: "", delta: -price(STORM) },
      { asset_kind: "purchase", asset_id: "cs_test_A", delta: -200 },
      { asset_kind: "purchase", asset_id: "cs_test_B", delta: -70 },
    ]);

    // Earned again, then a spend bigger than it: earned first, the rest from B.
    await earn(sql, ann.id, 100, T0 + 4000);
    expect(await buyItem(sql, ann.id, EMERALD, T0 + 5000)).toMatchObject({ ok: true });
    expect(await remainingOf(sql, "cs_test_B")).toBe(450 - (price(EMERALD) - 100));
    expect(await coinSplit(sql, ann.id)).toEqual({ coins: 200, bought: 200, earned: 0 });
    // A spend earned covers touches no purchase.
    await earn(sql, ann.id, price(HELLFIRE), T0 + 6000);
    expect(await buyItem(sql, ann.id, HELLFIRE, T0 + 7000)).toMatchObject({ ok: true });
    expect(await coinSplit(sql, ann.id)).toEqual({ coins: 200, bought: 200, earned: 0 });
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
    expect(await sql.first("SELECT COUNT(*) AS n FROM ledger WHERE op_id = ? AND asset_kind = 'purchase'", `shop:${acct}:${HELLFIRE}`)).toEqual({ n: 0 });
  });

  it("a guest spends its earned coins as before (it has no purchases)", async () => {
    const { sql } = await world();
    const { user: gus } = await createGuest(sql, T0, "Gus");
    await earn(sql, gus.id, price(STORM));
    expect(await buyItem(sql, gus.id, STORM, T0)).toMatchObject({ ok: true });
    expect(await coinSplit(sql, gus.id)).toEqual({ coins: 0, bought: 0, earned: 0 });
  });

  it("a coin never leaves through leg.coins: only a spend's legs take coins (none for a price of 0)", () => {
    expect(() => leg.coins("ann", -1)).toThrow(/spendLegs/);
    expect(spendLegs("ann", { price: 0, draws: [] })).toEqual([]);
    expect(spendLegs("ann", { price: 5, draws: [{ session: "cs_A", take: 5, was: 9 }] }).map((l) => [l.kind, l.asset, l.delta])).toEqual([
      ["coins", "", -5],
      ["purchase", "cs_A", -5],
    ]);
  });
});

describe("the guarded race: a change between the read and the write changes nothing, and it's planned again once", () => {
  /** The SQL interface, with `before` run ahead of the first `times` batches (another device's write, landing meanwhile). */
  function racing(sql: Sql, times: number, before: (i: number) => Promise<unknown>): Sql {
    let n = 0;
    return {
      ...sql,
      async batch(statements) {
        if (n < times) await before(n++);
        return sql.batch(statements);
      },
    };
  }

  it("two spends drawing on the same purchase: the later write is refused, planned again from the new read, and both are paid right", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await buy(sql, ann, 1100, "cs_test_A");
    // EMERALD's spend lands between STORM's read and write: STORM's draw (A: 1100 as read) is refused, then planned on A's 750.
    const got = await buyItem(
      racing(sql, 1, () => buyItem(sql, ann.id, EMERALD, T0 + 1)),
      ann.id,
      STORM,
      T0 + 2,
    );
    expect(got).toMatchObject({ ok: true });
    expect(await remainingOf(sql, "cs_test_A")).toBe(1100 - price(STORM) - price(EMERALD));
    expect(await coinSplit(sql, ann.id)).toEqual({ coins: 450, bought: 450, earned: 0 });
    const acct = (await ledgerAccount(sql, ann.id))!.account;
    expect(await sql.all("SELECT op_id, delta FROM ledger WHERE asset_kind = 'purchase' AND delta < 0 ORDER BY created_at")).toEqual([
      { op_id: `shop:${acct}:${EMERALD}`, delta: -price(EMERALD) },
      { op_id: `shop:${acct}:${STORM}`, delta: -price(STORM) },
    ]);
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("coins earned meanwhile: the spend that would have taken bought coins is refused, and takes the earned ones instead", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await buy(sql, ann, 520, "cs_test_A");
    const got = await buyItem(
      racing(sql, 1, () => earn(sql, ann.id, price(STORM), T0 + 1)),
      ann.id,
      STORM,
      T0 + 2,
    );
    expect(got).toMatchObject({ ok: true });
    // The purchase is untouched: its coins stay refundable.
    expect(await remainingOf(sql, "cs_test_A")).toBe(520);
    expect(await coinSplit(sql, ann.id)).toEqual({ coins: 520, bought: 520, earned: 0 });
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("refused twice (changes landing before both writes): nothing is charged, and it says to try again; the next try buys it", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await buy(sql, ann, 520, "cs_test_A");
    const got = await buyItem(
      racing(sql, 2, (i) => earn(sql, ann.id, 10, T0 + 1 + i)),
      ann.id,
      STORM,
      T0 + 3,
    );
    expect(got).toEqual({ ok: false, message: "That didn't go through. Try again." });
    expect(await coinSplit(sql, ann.id)).toEqual({ coins: 540, bought: 520, earned: 20 });
    expect(await sql.first("SELECT COUNT(*) AS n FROM inventory WHERE user_id = ?", ann.id)).toEqual({ n: 0 });
    expect(await buyItem(sql, ann.id, STORM, T0 + 4)).toMatchObject({ ok: true });
    expect(await coinSplit(sql, ann.id)).toEqual({ coins: 240, bought: 240, earned: 0 });
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("the purchase's own CHECK holds below the guard: a write that would take a purchase below zero is refused by the database", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await buy(sql, ann, 200, "cs_test_A");
    await expect(sql.run("UPDATE purchases SET remaining = remaining - 201 WHERE session_id = 'cs_test_A'")).rejects.toThrow(/CHECK/);
    await expect(sql.run("UPDATE purchases SET remaining = remaining + 1 WHERE session_id = 'cs_test_A'")).rejects.toThrow(/CHECK/);
    expect(await remainingOf(sql, "cs_test_A")).toBe(200);
  });
});

describe("refundable: unspent coins of purchases paid in the last 14 days, never more than the coins", () => {
  it("each purchase's own 14 days; spends take from the oldest first; never more than the coins; a pending one never counts", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await buy(sql, ann, 200, "cs_test_A", T0);
    await buy(sql, ann, 520, "cs_test_B", T0 + 5 * DAY);
    await recordCheckout(sql, ann, "coins-6000", "cs_test_C", T0 + 6 * DAY);
    expect((await refundable(sql, ann.id, T0 + 10 * DAY)).coins).toBe(720);
    expect((await refundable(sql, ann.id, T0 + 14 * DAY - 1)).coins).toBe(720);
    expect(await refundable(sql, ann.id, T0 + 14 * DAY)).toEqual({
      coins: 520,
      purchases: [{ session: "cs_test_B", pack: "coins-520", coins: 520, remaining: 520, cents: 499, taxCents: 12, paidAt: T0 + 5 * DAY }],
    });
    expect((await refundable(sql, ann.id, T0 + 19 * DAY)).coins).toBe(0);
    // A spend takes A's first: B's stays refundable.
    expect(await buyItem(sql, ann.id, HELLFIRE, T0 + 6 * DAY)).toMatchObject({ ok: true });
    expect([await remainingOf(sql, "cs_test_A"), await remainingOf(sql, "cs_test_B")]).toEqual([0, 320]);
    expect((await refundable(sql, ann.id, T0 + 10 * DAY)).coins).toBe(320);
    // Fewer coins than that (a purchase's coins taken back, PR 9: here by hand): never more than the coins.
    await sql.run("UPDATE wallets SET coins = 100 WHERE user_id = ?", ann.id);
    expect((await refundable(sql, ann.id, T0 + 10 * DAY)).coins).toBe(100);
    await sql.run("UPDATE wallets SET coins = -50 WHERE user_id = ?", ann.id);
    expect((await refundable(sql, ann.id, T0 + 10 * DAY)).coins).toBe(0);
    expect(await refundable(sql, "nobody", T0)).toEqual({ coins: 0, purchases: [] });
  });
});

describe("deleting the account, and Download my data", () => {
  it("the download has every purchase, refund and the account's buying columns; deleting keeps the rows as 'deleted's, naming nobody", async () => {
    const { sql, db } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const bo = await signedIn(sql, "bo@example.com");
    await earn(sql, ann.id, 50);
    await buy(sql, ann, 520, "cs_test_A", T0);
    await buyItem(sql, ann.id, STORM, T0 + 1);
    await recordCheckout(sql, ann, "coins-200", "cs_test_B", T0 + 2);
    await buy(sql, bo, 200, "cs_test_bo", T0);
    // (A refund row as PR 9 will write it, with its comment.)
    await sql.run(
      "INSERT INTO refunds (op_id, session_id, user_id, kind, cents, coins, stripe_ref, status, comment, created_at) VALUES ('refund:x', 'cs_test_A', ?, 'coins', 0, 0, 're_1', 'done', 'Not for me.', ?)",
      ann.id,
      T0 + 3,
    );
    const acct = (await ledgerAccount(sql, ann.id))!.account;

    const data = await accountDownload(sql, ann, T0 + 4);
    const iso = (t: number) => new Date(t).toISOString();
    expect(data.purchases).toEqual({
      purchases: [
        {
          session_id: "cs_test_A",
          pack: "coins-520",
          coins: 520,
          remaining: 270,
          cents: 499,
          tax_cents: 12,
          payment_intent: "pi_cs_test_A",
          card_country: "US",
          status: "paid",
          refunded_cents: 0,
          created_at: iso(T0 - 60_000),
          paid_at: iso(T0),
        },
        expect.objectContaining({ session_id: "cs_test_B", status: "pending", remaining: 0, created_at: iso(T0 + 2), paid_at: null }),
      ],
      refunds: [{ session_id: "cs_test_A", kind: "coins", cents: 0, coins: 0, stripe_ref: "re_1", status: "done", comment: "Not for me.", created_at: iso(T0 + 3) }],
    });
    expect(data.account).toMatchObject({ buy_band: null, refund_count: 0, hold_until: null, chargebacks: 0, closed_at: null, closed_reason: null, held_taps: 0 });
    expect(JSON.stringify(data)).not.toContain("cs_test_bo");

    await deleteAccount(sql, ann, T0 + 5);
    expect(await sql.all("SELECT session_id, user_id, coins, remaining, cents, tax_cents, payment_intent, status FROM purchases ORDER BY session_id")).toEqual([
      { session_id: "cs_test_A", user_id: "deleted", coins: 520, remaining: 0, cents: 499, tax_cents: 12, payment_intent: "pi_cs_test_A", status: "paid" },
      { session_id: "cs_test_B", user_id: "deleted", coins: 200, remaining: 0, cents: 199, tax_cents: 0, payment_intent: null, status: "pending" },
      { session_id: "cs_test_bo", user_id: bo.id, coins: 200, remaining: 200, cents: 199, tax_cents: 12, payment_intent: "pi_cs_test_bo", status: "paid" },
    ]);
    expect(await sql.all("SELECT op_id, user_id, comment, stripe_ref FROM refunds")).toEqual([{ op_id: "refund:x", user_id: "deleted", comment: null, stripe_ref: "re_1" }]);
    // The unspent coins closed in the ledger with the rest: every balance of that ledger id sums to 0, and nothing names Ann.
    expect(await sql.all("SELECT asset_kind, asset_id, delta FROM ledger WHERE account = ? AND reason = 'erase' ORDER BY asset_kind", acct)).toEqual([
      { asset_kind: "coins", asset_id: "", delta: -270 },
      { asset_kind: "purchase", asset_id: "cs_test_A", delta: -270 },
      { asset_kind: "shop", asset_id: STORM, delta: -1 },
    ]);
    expect(await sql.all("SELECT asset_kind, asset_id, SUM(delta) AS n FROM ledger WHERE account = ? GROUP BY asset_kind, asset_id HAVING n <> 0", acct)).toEqual([]);
    expect(JSON.stringify(db.prepare("SELECT * FROM ledger").all())).not.toContain(ann.id);
    expect(JSON.stringify(db.prepare("SELECT * FROM purchases").all())).not.toContain(ann.id);
    expect(await ledgerCheck(sql, 10)).toEqual([]);
    // A webhook after it (Stripe's for the pending checkout) credits nothing: the account is gone.
    expect(await creditPurchase(sql, { ...(await paid(sql, bo, "cs_test_B")), account: acct }, T0 + 6)).toEqual({ ok: false, why: "gone" });
    expect(await sql.first("SELECT COUNT(*) AS n FROM wallets WHERE user_id = 'deleted'")).toEqual({ n: 0 });
  });
});

describe("a guest's merge, and the reconciliation", () => {
  it("a guest can't buy, but if one had a purchase its row would move with its coins on sign-in, and the two still agree", async () => {
    const { sql } = await world();
    const bo = await signedIn(sql, "bo@example.com");
    await buy(sql, bo, 200, "cs_test_bo");
    const { user: gus } = await createGuest(sql, T0, "Gus");
    // (Made by hand, past the guards: a pending row, then its coins in through the ledger as a credit would.)
    await sql.run("INSERT INTO purchases (session_id, user_id, pack, coins, cents, created_at) VALUES ('cs_test_gus', ?, 'coins-520', 520, 499, ?)", gus.id, T0);
    const g = (await ledgerAccount(sql, gus.id))!;
    await applyOp(sql, g, { id: "test:gus", reason: "test", now: T0, legs: [leg.coins(gus.id, 520), leg.purchase(gus.id, "cs_test_gus", 520)] });
    await sql.run("UPDATE purchases SET status = 'paid', paid_at = ? WHERE session_id = 'cs_test_gus'", T0);
    await sql.run("INSERT INTO refunds (op_id, session_id, user_id, kind, status, created_at) VALUES ('refund:gus', 'cs_test_gus', ?, 'coins', 'done', ?)", gus.id, T0);
    expect(await ledgerMismatches(sql, gus.id)).toEqual([]);

    await signInWithIdentity(sql, gus, "email", "bo@example.com", {}, T0 + 1);
    expect(await sql.all("SELECT session_id, user_id, remaining FROM purchases ORDER BY session_id")).toEqual([
      { session_id: "cs_test_bo", user_id: bo.id, remaining: 200 },
      { session_id: "cs_test_gus", user_id: bo.id, remaining: 520 },
    ]);
    expect(await sql.all("SELECT user_id FROM refunds")).toEqual([{ user_id: bo.id }]);
    expect(await coinSplit(sql, bo.id)).toEqual({ coins: 720, bought: 720, earned: 0 });
    expect(await ledgerMismatches(sql, bo.id)).toEqual([]);
  });

  it("covers the new kind: a purchase's remaining changed outside the ledger is found by the daily check and the backfill evens it", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await buy(sql, ann, 520, "cs_test_A");
    expect(await ledgerCheck(sql, 10)).toEqual([]);
    await sql.run("UPDATE purchases SET remaining = remaining - 20 WHERE session_id = 'cs_test_A'");
    expect(await ledgerMismatches(sql, ann.id)).toEqual([{ kind: "purchase", asset: "cs_test_A", diff: -20 }]);
    expect(await ledgerCheck(sql, 10)).toEqual([
      { user: ann.id, account: (await ledgerAccount(sql, ann.id))!.account, mismatches: [{ kind: "purchase", asset: "cs_test_A", diff: -20 }] },
    ]);
    expect(await backfillLedger(sql, T0 + 1)).toBe(1);
    expect(await ledgerCheck(sql, 10)).toEqual([]);
  });
});
