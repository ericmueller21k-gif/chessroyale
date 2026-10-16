import { afterEach, describe, expect, it, vi } from "vitest";
import { shopItem } from "@chessroyale/core";
import { buyItem, createGuest, ensureSchema, grantReward, setChatPicks, shopState, type Sql } from "../src/accounts.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * Buying with coins (docs/decisions/2026-10-16-atomic-shop-purchase.md): the charge and the grant are one transaction,
 * so buys at once (two taps, two devices) never take the coins below zero or charge twice for one item. Everything is
 * free while SHOP_FREE is on, so these turn it off (and back on for the free path).
 */
const shop = vi.hoisted(() => ({ free: false }));
vi.mock("@chessroyale/core", async (orig) => {
  const real = await orig<typeof import("@chessroyale/core")>();
  return {
    ...real,
    get SHOP_FREE() {
      return shop.free;
    },
  };
});

const price = (id: string) => shopItem(id)!.price;

/** A guest with this many coins (none: no wallet at all). */
async function player(coins: number) {
  const { sql, db } = memoryDb();
  await ensureSchema(sql);
  const { user } = await createGuest(sql, 1000, "Buyer");
  await grantReward(sql, user.id, coins, 0);
  return { sql, db, id: user.id };
}

describe("buying with coins", () => {
  afterEach(() => {
    shop.free = false;
  });

  it("two items at once with coins for one: exactly one is bought, and the coins never go below zero", async () => {
    const [a, b] = ["king-hellfire", "king-void"] as const;
    const coins = Math.max(price(a), price(b));
    expect(price(a) + price(b)).toBeGreaterThan(coins);
    const { sql, id } = await player(coins);
    const results = await Promise.all([buyItem(sql, id, a, 1100), buyItem(sql, id, b, 1100)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, message: "Not enough coins." });
    const after = await shopState(sql, id);
    const got = after.owned.filter((i) => i === a || i === b);
    expect(got).toHaveLength(1);
    expect(after.coins).toBe(coins - price(got[0]!));
    expect(after.coins).toBeGreaterThanOrEqual(0);
  });

  it("the same item twice at once: both succeed, it's charged once", async () => {
    const item = "king-storm";
    const { sql, db, id } = await player(2 * price(item));
    const results = await Promise.all([buyItem(sql, id, item, 1100), buyItem(sql, id, item, 1100)]);
    expect(results.every((r) => r.ok && r.shop.owned.includes(item))).toBe(true);
    expect((await shopState(sql, id)).coins).toBe(price(item));
    expect(db.prepare("SELECT COUNT(*) AS n FROM inventory WHERE user_id = ? AND item_id = ?").get(id, item)).toEqual({ n: 1 });
    // Owned already: a no-op success, nothing charged.
    expect((await buyItem(sql, id, item, 1200)).ok).toBe(true);
    expect((await shopState(sql, id)).coins).toBe(price(item));
  });

  it("owned by the time the write runs (another device got it): the batch rolls back, no charge, a no-op success", async () => {
    const item = "king-storm";
    const { sql, db, id } = await player(price(item));
    const racing: Sql = {
      ...sql,
      async batch(statements) {
        db.prepare("INSERT INTO inventory (user_id, item_id, acquired_at) VALUES (?, ?, 900)").run(id, item);
        return sql.batch(statements);
      },
    };
    const got = await buyItem(racing, id, item, 1100);
    expect(got.ok && got.shop.owned).toContain(item);
    expect((await shopState(sql, id)).coins).toBe(price(item));
    expect(db.prepare("SELECT acquired_at FROM inventory WHERE user_id = ? AND item_id = ?").all(id, item)).toEqual([{ acquired_at: 900 }]);
  });

  it("a write that fails for any other reason: the error, and no charge", async () => {
    const item = "king-storm";
    const { sql, id } = await player(price(item));
    const down: Sql = { ...sql, batch: async () => Promise.reject(new Error("D1 is down")) };
    await expect(buyItem(down, id, item, 1100)).rejects.toThrow("D1 is down");
    expect((await shopState(sql, id)).coins).toBe(price(item));
  });

  it("not enough coins: no charge, no item", async () => {
    const item = "king-storm";
    const { sql, id } = await player(price(item) - 1);
    expect(await buyItem(sql, id, item, 1100)).toEqual({ ok: false, message: "Not enough coins." });
    const after = await shopState(sql, id);
    expect(after.coins).toBe(price(item) - 1);
    expect(after.owned).not.toContain(item);
    // No wallet at all.
    const { sql: sql2, id: id2 } = await player(0);
    expect(await buyItem(sql2, id2, item, 1100)).toEqual({ ok: false, message: "Not enough coins." });
    expect((await shopState(sql2, id2)).owned).not.toContain(item);
  });

  it("a paid chat pack still fills the empty quick chat slots", async () => {
    const { sql, id } = await player(price("chat-godking"));
    await setChatPicks(sql, id, { lines: ["gg"] });
    const got = await buyItem(sql, id, "chat-godking", 1100);
    expect(got.ok && got.shop.chat.lines).toEqual(expect.arrayContaining(["gg", "gk-crown"]));
    expect(got.ok && got.shop.coins).toBe(0);
  });

  it("free (SHOP_FREE): granted without a wallet, and no wallet made", async () => {
    shop.free = true;
    const { sql, db, id } = await player(0);
    const got = await buyItem(sql, id, "king-storm", 1100);
    expect(got.ok && got.shop.owned).toContain("king-storm");
    expect(got.ok && got.shop.coins).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS n FROM wallets").get()).toEqual({ n: 0 });
  });
});
