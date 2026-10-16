import { describe, expect, it, vi } from "vitest";
import { shopItem } from "@chessroyale/core";
import { buyItem, createGuest, ensureSchema, grantReward, shopState, signInWithIdentity, startEmailCode, stmt, verifyEmailCode, type Sql } from "../src/accounts.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * Sign-ins at once (docs/decisions/2026-10-16-sign-in-races.md): a guest's merge into an account is one transaction,
 * so its wallet joins the account exactly once and a buy can't land halfway; an email code works once and allows its
 * tries, however many requests arrive together. Prices count here, so SHOP_FREE is off.
 */
vi.mock("@chessroyale/core", async (orig) => ({ ...(await orig<typeof import("@chessroyale/core")>()), SHOP_FREE: false }));

async function setup() {
  const { sql, db } = memoryDb();
  await ensureSchema(sql);
  const wallet = (userId: string) => db.prepare("SELECT coins, crates FROM wallets WHERE user_id = ?").get(userId) ?? null;
  return { sql, db, wallet };
}

describe("a guest signing in to an existing account", () => {
  it("twice at once: the guest's coins and crates join the account once", async () => {
    const { sql, wallet } = await setup();
    const owner = await signInWithIdentity(sql, null, "email", "owner@example.com", {}, 1000);
    await grantReward(sql, owner.id, 50, 0);
    const { user: guest } = await createGuest(sql, 1100, "Guest");
    await grantReward(sql, guest.id, 100, 2);
    const both = await Promise.all([1, 2].map(() => signInWithIdentity(sql, guest, "email", "owner@example.com", {}, 1200)));
    expect(both.map((u) => u.id)).toEqual([owner.id, owner.id]);
    expect(wallet(owner.id)).toEqual({ coins: 150, crates: 2 });
    expect((await shopState(sql, owner.id)).coins).toBe(150);
    expect(wallet(guest.id)).toBeNull();
  });

  it("into an account with no wallet: it gets the guest's; a guest with nothing makes no wallet", async () => {
    const { sql, wallet } = await setup();
    const owner = await signInWithIdentity(sql, null, "email", "owner@example.com", {}, 1000);
    const { user: guest } = await createGuest(sql, 1100, "Guest");
    await grantReward(sql, guest.id, 30, 0);
    await Promise.all([1, 2].map(() => signInWithIdentity(sql, guest, "email", "owner@example.com", {}, 1200)));
    expect(wallet(owner.id)).toEqual({ coins: 30, crates: 0 });
    const other = await signInWithIdentity(sql, null, "email", "other@example.com", {}, 1300);
    const { user: empty } = await createGuest(sql, 1300, "Guest");
    await signInWithIdentity(sql, empty, "email", "other@example.com", {}, 1400);
    expect(wallet(other.id)).toBeNull();
  });

  it("a buy in another tab lands wholly before the merge (the item and the charge move) or wholly after (no charge)", async () => {
    const item = "king-storm";
    const price = shopItem(item)!.price;
    /** The guest signs in while, in another tab, the whole buy runs just before the sign-in's step `at` (or after it). */
    async function buyDuringSignIn(at: number) {
      const { sql, db, wallet } = await setup();
      const owner = await signInWithIdentity(sql, null, "email", "owner@example.com", {}, 1000);
      const { user: guest } = await createGuest(sql, 1100, "Guest");
      await grantReward(sql, guest.id, price, 0);
      let steps = 0;
      let bought: Awaited<ReturnType<typeof buyItem>> | null = null;
      const step = async () => {
        if (steps++ === at) bought = await buyItem(sql, guest.id, item, 1150);
      };
      const tab: Sql = {
        async run(q, ...p) {
          await step();
          return sql.run(q, ...p);
        },
        async first(q, ...p) {
          await step();
          return sql.first(q, ...p);
        },
        async all(q, ...p) {
          await step();
          return sql.all(q, ...p);
        },
        async batch(list) {
          await step();
          return sql.batch(list);
        },
      };
      await signInWithIdentity(tab, guest, "email", "owner@example.com", {}, 1200);
      bought ??= await buyItem(sql, guest.id, item, 1300);
      const left = db.prepare("SELECT (SELECT COUNT(*) FROM inventory WHERE user_id = ?1) + (SELECT COUNT(*) FROM wallets WHERE user_id = ?1) AS n").get(guest.id);
      return { steps, bought, shop: await shopState(sql, owner.id), wallet: wallet(owner.id), left };
    }
    const { steps } = await buyDuringSignIn(Infinity);
    for (let at = 0; at <= steps; at++) {
      const r = await buyDuringSignIn(at);
      // Bought: the item is the account's, paid for. Not: no item, and every coin moved.
      if (r.bought.ok) expect([at, r.shop.owned.includes(item), r.shop.coins]).toEqual([at, true, 0]);
      else expect([at, r.bought.message, r.shop.owned.includes(item), r.shop.coins]).toEqual([at, "Not enough coins.", false, price]);
      expect(r.left).toEqual({ n: 0 });
    }
  });

  it("a merge that fails moves nothing: the whole merge is the one batch", async () => {
    const { sql, db, wallet } = await setup();
    const owner = await signInWithIdentity(sql, null, "email", "owner@example.com", {}, 1000);
    const { user: guest } = await createGuest(sql, 1100, "Guest");
    await grantReward(sql, guest.id, 100, 0);
    await sql.run("INSERT INTO inventory (user_id, item_id, acquired_at) VALUES (?, 'king-storm', 1150)", guest.id);
    const failing: Sql = { ...sql, batch: (list) => sql.batch([...list, stmt("INSERT INTO nowhere VALUES (1)")]) };
    await expect(signInWithIdentity(failing, guest, "email", "owner@example.com", {}, 1200)).rejects.toThrow();
    expect(wallet(guest.id)).toEqual({ coins: 100, crates: 0 });
    expect(wallet(owner.id)).toBeNull();
    expect((await shopState(sql, guest.id)).owned).toContain("king-storm");
    expect((await shopState(sql, owner.id)).owned).not.toContain("king-storm");
    expect(db.prepare("SELECT COUNT(*) AS n FROM users WHERE id = ?").get(guest.id)).toEqual({ n: 1 });
  });
});

describe("email codes", () => {
  it("one code, two checks at once: exactly one gets in", async () => {
    const { sql } = await setup();
    const s = await startEmailCode(sql, "a@b.co", 0);
    if (!s.ok) throw new Error(s.message);
    const checks = await Promise.all([1, 2].map(() => verifyEmailCode(sql, "a@b.co", s.code, 1000)));
    expect(checks.filter(Boolean)).toHaveLength(1);
    expect(await verifyEmailCode(sql, "a@b.co", s.code, 2000)).toBe(false);
  });

  it("tries at once count against the five: ten wrong guesses together check five, then the right code is refused", async () => {
    const { sql, db } = await setup();
    const s = await startEmailCode(sql, "a@b.co", 0);
    if (!s.ok) throw new Error(s.message);
    const wrong = s.code === "000000" ? "111111" : "000000";
    const checks = await Promise.all(Array.from({ length: 10 }, () => verifyEmailCode(sql, "a@b.co", wrong, 1000)));
    expect(checks.some(Boolean)).toBe(false);
    expect(db.prepare("SELECT attempts FROM email_codes WHERE email = ?").get("a@b.co")).toEqual({ attempts: 5 });
    expect(await verifyEmailCode(sql, "a@b.co", s.code, 2000)).toBe(false);
  });

  it("the right code after a wrong one still gets in, once", async () => {
    const { sql } = await setup();
    const s = await startEmailCode(sql, "a@b.co", 0);
    if (!s.ok) throw new Error(s.message);
    expect(await verifyEmailCode(sql, "a@b.co", s.code === "000000" ? "111111" : "000000", 1000)).toBe(false);
    expect(await verifyEmailCode(sql, "a@b.co", ` ${s.code} `, 2000)).toBe(true);
    expect(await verifyEmailCode(sql, "a@b.co", s.code, 3000)).toBe(false);
  });
});
