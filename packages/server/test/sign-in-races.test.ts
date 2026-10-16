import { describe, expect, it } from "vitest";
import { createGuest, ensureSchema, grantReward, shopState, signInWithIdentity, startEmailCode, verifyEmailCode } from "../src/accounts.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * Sign-ins at once (docs/decisions/2026-10-16-sign-in-races.md): a guest's wallet joins the account exactly once, and
 * an email code works once and allows its tries, however many requests arrive together.
 */

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
