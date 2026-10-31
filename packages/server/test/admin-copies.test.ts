import { afterEach, describe, expect, it, vi } from "vitest";
import { ADMIN_ROLL, ITEM_DEFS, SHOP_ITEMS, isAdminCopy, itemDef, wornFromLocker } from "@chessroyale/core";
import { buyItem, createGuest, createSession, ensureSchema, equipItem, grantReward, profile, publicProfile, shopState, signInWithIdentity, type Sql, type User } from "../src/accounts.ts";
import { isAdmin } from "../src/admin.ts";
import { handleAccountApi } from "../src/api.ts";
import { accountDownload } from "../src/account-data.ts";
import { deleteLockerItems, equipLocker, lockerState, looksOf, openCrate } from "../src/locker.ts";
import { rankedSummary } from "../src/ranked-schema.ts";
import { duelEntrant } from "../src/ranked.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * Admins own one of every item (Eric, Oct 31, 2026; docs/decisions/2026-10-31-admin-owns-all.md): admin copies, added
 * where the server builds an admin's locker and shop and where it checks ownership, never stored. Fair play and the
 * economy: no path for anyone else to get or keep one, and no way to turn one into anything real.
 */

// Buying with coins needs SHOP_FREE off (as shop-buy.test.ts); every other test here runs as the game does.
const shop = vi.hoisted(() => ({ free: null as boolean | null }));
vi.mock("@chessroyale/core", async (orig) => {
  const real = await orig<typeof import("@chessroyale/core")>();
  return {
    ...real,
    get SHOP_FREE() {
      return shop.free ?? real.SHOP_FREE;
    },
  };
});
afterEach(() => {
  shop.free = null;
});

const ERIC = "eric@example.com";
const ENV = { ADMIN_EMAILS: `${ERIC}, other@example.com` };
const admins = (u: { email: string | null }) => isAdmin(ENV, u);
const T0 = 1_000;
const KINGS = SHOP_ITEMS.filter(wornFromLocker).map((i) => i.id);
const BOUGHT_KINGS = SHOP_ITEMS.filter((i) => wornFromLocker(i) && !i.starter).map((i) => i.id);

/** Every row of the stored tables an item could live in (to show nothing is written). */
async function stored(sql: Sql) {
  return {
    items: await sql.all("SELECT * FROM items ORDER BY id"),
    inventory: await sql.all("SELECT * FROM inventory ORDER BY user_id, item_id"),
    wallets: await sql.all("SELECT * FROM wallets ORDER BY user_id"),
    equippedItems: await sql.all("SELECT * FROM equipped_items ORDER BY user_id, slot"),
    equipped: await sql.all("SELECT * FROM equipped ORDER BY user_id, slot"),
  };
}

/** An admin (Eric, signed in with an email in ADMIN_EMAILS) with one real Santa Hat, and a player with one real Beanie. */
async function setup() {
  const db = memoryDb();
  const { sql } = db;
  await ensureSchema(sql);
  const eric = await signInWithIdentity(sql, (await createGuest(sql, T0, "Eric")).user, "email", ERIC, {}, T0);
  const player = await signInWithIdentity(sql, (await createGuest(sql, T0, "Pat")).user, "email", "pat@example.com", {}, T0);
  const add = (id: string, userId: string, def: string) =>
    sql.run("INSERT INTO items (id, user_id, def, color, blemish, seed, crate, created_at) VALUES (?, ?, ?, 'cobalt', 40, 7, 'winter-1', ?)", id, userId, def, T0);
  await add("erics-hat", eric.id, "santa-hat");
  await add("pats-beanie", player.id, "beanie");
  const cookie = async (u: User) => `hc_session=${await createSession(sql, u.id, Date.now())}`;
  return { ...db, eric, player, ericCookie: await cookie(eric), playerCookie: await cookie(player) };
}

/** The account API, as the Worker runs it (`env`: its ADMIN_EMAILS, or none). */
async function call(env: object, path: string, cookie: string | null, body?: object) {
  const headers = new Headers(cookie ? { cookie } : {});
  const init: RequestInit = body ? { method: "POST", body: JSON.stringify(body), headers } : { headers };
  const res = (await handleAccountApi(new Request(`https://hunchess.com${path}`, init), env as never))!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: res.status, body: (await res.json()) as any };
}

describe("an admin owns one of every item", () => {
  it("every crate item (every slot) and every God King effect, at the fixed roll, tagged; what they really own stays; nothing stored", async () => {
    const { sql, eric } = await setup();
    const before = await stored(sql);
    const locker = await lockerState(sql, eric.id, true);
    // One of each item: the real Santa Hat as it is, an admin copy of everything else.
    expect(locker.items).toHaveLength(ITEM_DEFS.length);
    expect(new Set(locker.items.map((i) => i.def))).toEqual(new Set(ITEM_DEFS.map((d) => d.id)));
    expect(locker.items.filter((i) => i.def === "santa-hat")).toEqual([{ id: "erics-hat", def: "santa-hat", color: "cobalt", blemish: 40, seed: 7 }]);
    const copies = locker.items.filter((i) => isAdminCopy(i.id));
    expect(copies).toHaveLength(ITEM_DEFS.length - 1);
    expect(new Set(copies.map((i) => itemDef(i.def)!.slot))).toEqual(new Set(ITEM_DEFS.map((d) => d.slot)));
    for (const c of copies) {
      expect(c).toEqual({
        id: `admin:${c.def}`,
        def: c.def,
        color: ADMIN_ROLL.color,
        ...(itemDef(c.def)!.colors === 2 ? { color2: ADMIN_ROLL.color2 } : {}),
        blemish: 0,
        seed: ADMIN_ROLL.seed,
      });
    }
    // Every God King effect, the bought ones listed as admin copies; chat packs (not worn) are only what they own.
    const shopNow = await shopState(sql, eric.id, true);
    expect(shopNow.owned).toEqual(expect.arrayContaining(KINGS));
    expect(shopNow.admin).toEqual(BOUGHT_KINGS);
    expect(shopNow.owned.filter((id) => !KINGS.includes(id))).toEqual((await shopState(sql, eric.id)).owned.filter((id) => !KINGS.includes(id)));
    expect(shopNow.chat).toEqual((await shopState(sql, eric.id)).chat);
    // The profile and the API say the same, and reading them writes nothing.
    const mine = await profile(sql, eric, admins);
    expect(mine.locker).toEqual(locker);
    expect(mine.shop).toEqual(shopNow);
    expect(await stored(sql)).toEqual(before);
  });

  it("a player is unchanged: their own items only, wherever ADMIN_EMAILS is set, and a guest is never an admin", async () => {
    const { sql, d1, player, playerCookie } = await setup();
    const withAdmins = { DB: d1, ...ENV };
    const plain = await lockerState(sql, player.id);
    expect(plain.items.map((i) => i.id)).toEqual(["pats-beanie"]);
    expect((await call(withAdmins, "/api/locker", playerCookie)).body).toEqual(plain);
    expect((await call(withAdmins, "/api/me", playerCookie)).body.locker).toEqual(plain);
    const theirShop = (await call(withAdmins, "/api/shop", playerCookie)).body;
    expect(theirShop).toEqual(await shopState(sql, player.id));
    expect(theirShop.admin).toBeUndefined();
    expect(theirShop.owned).not.toContain("king-void");
    const guest = await createGuest(sql, Date.now(), "Guest");
    const g = (await call(withAdmins, "/api/me", `hc_session=${guest.token}`)).body;
    expect(g.locker.items).toEqual([]);
    expect(g.admin).toBeUndefined();
  });
});

describe("wearing an admin copy", () => {
  it("equips like any item (only which item is worn is stored); others see it; and when admin is off it's all gone", async () => {
    const { sql, d1, eric, player, ericCookie, playerCookie } = await setup();
    const on = { DB: d1, ...ENV };
    const off = { DB: d1 };
    const before = await stored(sql);
    // The crown in its slot (not another), and a God King effect.
    expect((await call(on, "/api/locker/equip", ericCookie, { slot: "face", item: "admin:fire-ice-crown" })).body).toEqual({ message: "That doesn't go there." });
    const worn = await call(on, "/api/locker/equip", ericCookie, { slot: "head", item: "admin:fire-ice-crown" });
    expect(worn.status).toBe(200);
    expect(worn.body.equipped.head).toBe("admin:fire-ice-crown");
    expect(worn.body.look.head).toEqual({ def: "fire-ice-crown", color: "red", blemish: 0, seed: ADMIN_ROLL.seed });
    const king = await call(on, "/api/shop/equip", ericCookie, { item: "king-void" });
    expect(king.body.equipped.king).toBe("king-void");
    expect(king.body.admin).toEqual(BOUGHT_KINGS);
    // Stored: which item each slot wears (as for anyone), and nothing else.
    const after = await stored(sql);
    expect({ ...after, equippedItems: before.equippedItems, equipped: before.equipped }).toEqual(before);
    expect(after.equippedItems).toEqual([{ user_id: eric.id, slot: "head", item_id: "admin:fire-ice-crown" }]);
    expect(after.equipped).toEqual([{ user_id: eric.id, slot: "king", item_id: "king-void" }]);
    // Others see it: the public profile, a ranked opponent's look in the recent games, a ranked 1 v 1 entry.
    const look = worn.body.look;
    expect((await call(on, `/api/profile/${eric.id}`, playerCookie)).body.look).toEqual(look);
    expect((await call(on, `/api/profile/${eric.id}`, null)).body.look).toEqual(look);
    expect((await call(on, `/api/profile/${eric.id}`, null)).body).not.toHaveProperty("email");
    await sql.run(
      "INSERT INTO ranked_1v1_games (id, white_id, black_id, control, result, reason, moves, times, started_at, ended_at, nonce) VALUES ('g1', ?, ?, '3+2', '1-0', 'mate', '[]', '[]', ?, ?, 'n')",
      eric.id,
      player.id,
      T0,
      T0 + 1,
    );
    expect((await rankedSummary(sql, player.id, admins)).recent[0]!.opponent.look).toEqual(look);
    expect(JSON.stringify((await call(on, `/api/profile/${player.id}`, null)).body)).not.toContain(ERIC);
    expect((await call(on, "/api/me", playerCookie)).body.ranked1v1.recent[0].opponent.look).toEqual(look);
    expect((await duelEntrant(sql, eric, T0, true)).player.look).toEqual(look);
    expect((await looksOf(sql, [eric.id, player.id], new Set([eric.id]))).get(eric.id)).toEqual(look);
    // Admin off (ADMIN_EMAILS without them): every admin copy goes, the slot reads empty, the King back to his starter.
    const gone = (await call(off, "/api/me", ericCookie)).body;
    expect(gone.locker.items.map((i: { id: string }) => i.id)).toEqual(["erics-hat"]);
    expect(gone.locker.equipped).toEqual({});
    expect(gone.locker.look).toEqual({});
    expect(gone.shop.equipped.king).toBe("king-holy");
    expect(gone.shop.owned).not.toContain("king-void");
    expect((await call(off, `/api/profile/${eric.id}`, null)).body.look).toEqual({});
    expect((await rankedSummary(sql, player.id)).recent[0]!.opponent.look).toEqual({});
    expect((await duelEntrant(sql, eric, T0)).player.look).toEqual({});
    expect((await looksOf(sql, [eric.id])).get(eric.id)).toBeUndefined();
  });

  it("a ride (Oct 31, rides): an admin has both rides, wears admin:riding-chirp in the ride slot (only there), and others see it; a player can't", async () => {
    const { sql, d1, eric, player, ericCookie, playerCookie } = await setup();
    const on = { DB: d1, ...ENV };
    const mine = (await call(on, "/api/me", ericCookie)).body.locker.items.map((i: { id: string }) => i.id);
    expect(mine).toEqual(expect.arrayContaining(["admin:riding-chirp", "admin:moon-ride"]));
    expect((await call(on, "/api/locker/equip", ericCookie, { slot: "head", item: "admin:riding-chirp" })).body).toEqual({ message: "That doesn't go there." });
    const worn = await call(on, "/api/locker/equip", ericCookie, { slot: "ride", item: "admin:riding-chirp" });
    expect(worn.status).toBe(200);
    expect(worn.body.equipped.ride).toBe("admin:riding-chirp");
    const look = { def: "riding-chirp", color: "red", blemish: 0, seed: ADMIN_ROLL.seed };
    expect(worn.body.look.ride).toEqual(look);
    // Others see it (the public profile, the looks a lobby or the town would get); the moon takes its place, one ride at a time.
    expect((await call(on, `/api/profile/${eric.id}`, playerCookie)).body.look.ride).toEqual(look);
    expect((await looksOf(sql, [eric.id], new Set([eric.id]))).get(eric.id)?.ride).toEqual(look);
    expect((await equipLocker(sql, eric.id, "ride", "admin:moon-ride", true)).ok).toBe(true);
    expect((await lockerState(sql, eric.id, true)).look.ride?.def).toBe("moon-ride");
    // A player has none, and can't wear one.
    expect((await call(on, "/api/me", playerCookie)).body.locker.items.map((i: { def: string }) => i.def)).not.toContain("riding-chirp");
    expect(await equipLocker(sql, player.id, "ride", "admin:riding-chirp")).toEqual({ ok: false, message: "That isn't yours." });
  });

  it("an item they really get fills the gap: its admin copy goes, and if they wore it, the purest real one shows in the slot (nothing stored changes)", async () => {
    const { sql, eric } = await setup();
    expect((await equipLocker(sql, eric.id, "head", "admin:beanie", true)).ok).toBe(true);
    const before = await stored(sql);
    // Two real Beanies come in (a crate, say): the purer one is worn in the copy's place, for them and for everyone.
    await sql.run("INSERT INTO items (id, user_id, def, color, blemish, seed, crate, created_at) VALUES ('rough-beanie', ?, 'beanie', 'sage', 30, 8, 'winter-1', ?)", eric.id, T0 + 4);
    await sql.run("INSERT INTO items (id, user_id, def, color, blemish, seed, crate, created_at) VALUES ('real-beanie', ?, 'beanie', 'pearl', 3, 9, 'winter-1', ?)", eric.id, T0 + 5);
    const now = await lockerState(sql, eric.id, true);
    expect(now.items.filter((i) => i.def === "beanie").map((i) => i.id)).toEqual(["real-beanie", "rough-beanie"]);
    expect(now.equipped.head).toBe("real-beanie");
    const real = { def: "beanie", color: "pearl", blemish: 3, seed: 9 };
    expect(now.look.head).toEqual(real);
    expect((await publicProfile(sql, eric.id, T0, admins))!.look.head).toEqual(real);
    expect((await looksOf(sql, [eric.id], new Set([eric.id]))).get(eric.id)?.head).toEqual(real);
    expect((await duelEntrant(sql, eric, T0, true)).player.look?.head).toEqual(real);
    // Only read so: the stored slot still names the copy, and admin off (no copies) it reads empty, as any copy worn.
    expect((await stored(sql)).equippedItems).toEqual(before.equippedItems);
    expect((await lockerState(sql, eric.id)).equipped.head).toBeUndefined();
    // The copy itself can't be worn again; a real one can.
    expect((await equipLocker(sql, eric.id, "head", "admin:beanie", true)).ok).toBe(false);
    expect((await equipLocker(sql, eric.id, "head", "rough-beanie", true)).ok).toBe(true);
    expect((await lockerState(sql, eric.id, true)).equipped.head).toBe("rough-beanie");
    // The real Santa Hat they own: no admin copy of it to wear.
    expect(await equipLocker(sql, eric.id, "head", "admin:santa-hat", true)).toEqual({ ok: false, message: "That isn't yours." });
  });
});

describe("fair play and the economy: nobody else gets one, and one never becomes anything real", () => {
  it("a player can't wear one (by the API or a planted row), and one never reaches their locker, profile or look", async () => {
    const { sql, d1, player, playerCookie } = await setup();
    const on = { DB: d1, ...ENV };
    expect(await call(on, "/api/locker/equip", playerCookie, { slot: "head", item: "admin:fire-ice-crown" })).toEqual({ status: 400, body: { message: "That isn't yours." } });
    expect(await call(on, "/api/shop/equip", playerCookie, { item: "king-void" })).toEqual({ status: 400, body: { message: "Get it first." } });
    expect(await equipLocker(sql, player.id, "head", "admin:fire-ice-crown")).toEqual({ ok: false, message: "That isn't yours." });
    // Even a row written straight into storage (no route writes one for a player) gives them nothing.
    await sql.run("INSERT INTO equipped_items (user_id, slot, item_id) VALUES (?, 'head', 'admin:fire-ice-crown')", player.id);
    await sql.run("INSERT INTO equipped (user_id, slot, item_id) VALUES (?, 'king', 'king-void')", player.id);
    const me = (await call(on, "/api/me", playerCookie)).body;
    expect(me.locker.look).toEqual({});
    expect(me.locker.equipped).toEqual({});
    expect(me.locker.items.some((i: { id: string }) => isAdminCopy(i.id))).toBe(false);
    expect(me.shop.equipped.king).toBe("king-holy");
    expect((await call(on, `/api/profile/${player.id}`, null)).body.look).toEqual({});
    expect((await looksOf(sql, [player.id], new Set())).get(player.id)).toBeUndefined();
    expect((await duelEntrant(sql, player, T0)).player.look).toEqual({});
    expect((await publicProfile(sql, player.id, T0, admins))!.look).toEqual({});
  });

  it("deleting (recycling) ignores admin copies: nothing to delete, one worn stays worn; the real ones go as before", async () => {
    const { sql, d1, eric, ericCookie } = await setup();
    const on = { DB: d1, ...ENV };
    await call(on, "/api/locker/equip", ericCookie, { slot: "skin", item: "admin:snowman" });
    const r = await call(on, "/api/locker/delete", ericCookie, { items: ["admin:snowman", "admin:katana", "erics-hat"] });
    expect(r.status).toBe(200);
    expect(r.body.equipped.skin).toBe("admin:snowman");
    expect(r.body.items.map((i: { id: string }) => i.id)).toEqual(expect.arrayContaining(["admin:snowman", "admin:katana", "admin:santa-hat"]));
    expect(r.body.items.some((i: { id: string }) => i.id === "erics-hat")).toBe(false);
    expect(await sql.all("SELECT id FROM items WHERE user_id = ?", eric.id)).toEqual([]);
    // Only admin copies: nothing happens.
    const only = await deleteLockerItems(sql, eric.id, ["admin:snowman"], true);
    expect(only.ok && only.locker.equipped.skin).toBe("admin:snowman");
  });

  it("never sold, traded or spent: an admin copy is no coins and no free pass; a real one is bought and paid for as anyone's", async () => {
    shop.free = false;
    const { sql, eric } = await setup();
    // Holding Voidborn as an admin copy, with no coins: no real one comes free.
    expect((await shopState(sql, eric.id, true)).owned).toContain("king-void");
    expect(await buyItem(sql, eric.id, "king-void", T0, true)).toEqual({ ok: false, message: "Not enough coins." });
    expect(await sql.all("SELECT * FROM inventory")).toEqual([]);
    // With the coins: a real one, paid for in full; the admin copy is no longer needed.
    const price = SHOP_ITEMS.find((i) => i.id === "king-void")!.price;
    await grantReward(sql, eric.id, price + 7, 0);
    const bought = await buyItem(sql, eric.id, "king-void", T0, true);
    if (!bought.ok) throw new Error(bought.message);
    expect(bought.shop.coins).toBe(7);
    expect(bought.shop.owned).toContain("king-void");
    expect(bought.shop.admin).not.toContain("king-void");
    expect(await sql.all("SELECT item_id FROM inventory WHERE user_id = ?", eric.id)).toEqual([{ item_id: "king-void" }]);
  });

  it("crates: a stored item's id is never an admin copy's; opening one as an admin stores only the real roll", async () => {
    const { sql, eric } = await setup();
    for (let i = 0; i < 5; i++) {
      const r = await openCrate(sql, eric.id, "beta-001", {}, T0 + i, true);
      if (!r.ok) throw new Error(r.message);
      expect(r.item.id).toMatch(/^[0-9a-f]{18}$/);
      expect(isAdminCopy(r.item.id)).toBe(false);
      expect(r.locker.items.filter((it) => it.def === r.item.def).every((it) => !isAdminCopy(it.id))).toBe(true);
    }
    const rows = await sql.all<{ id: string }>("SELECT id FROM items WHERE user_id = ?", eric.id);
    expect(rows).toHaveLength(6);
    expect(rows.some((r) => isAdminCopy(r.id))).toBe(false);
  });

  it("the account's data (Download my data) has only what's stored: no admin copy, just the id a worn slot names", async () => {
    const { sql, eric } = await setup();
    await equipLocker(sql, eric.id, "weapon", "admin:katana", true);
    await equipItem(sql, eric.id, "king-void", true);
    const file = (await accountDownload(sql, eric, T0)) as {
      locker: { items: { id: string }[]; equipped: { slot: string; item_id: string }[] };
      shop: { items: unknown[]; equipped: { slot: string; item_id: string }[] };
    };
    expect(file.locker.items.map((i) => i.id)).toEqual(["erics-hat"]);
    expect(file.locker.equipped).toEqual([{ slot: "weapon", item_id: "admin:katana" }]);
    expect(file.shop.items).toEqual([]);
    expect(file.shop.equipped).toEqual([{ slot: "king", item_id: "king-void" }]);
  });
});
