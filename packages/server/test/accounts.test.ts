import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { QUICK_CHAT, defaultChatPicks, itemDef, ownedChatPacks } from "@chessroyale/core";
import {
  isPixelIcon,
  buyItem,
  setChatPicks,
  createGuest,
  equipItem,
  shopState,
  ensureSchema,
  profile,
  recordResult,
  signInWithIdentity,
  startEmailCode,
  updateProfile,
  userFromToken,
  verifyEmailCode,
  type Sql,
} from "../src/accounts.ts";
import { handleAccountApi, isSignedIn, signInRequired } from "../src/api.ts";
import { deleteLockerItems, equipLocker, lockerState, openCrate } from "../src/locker.ts";

// node:sqlite through require (Vite doesn't know it as a built-in yet).
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

/** The SQL interface over an in-memory SQLite (stands in for D1). */
function memorySql(): Sql {
  const db = new DatabaseSync(":memory:");
  return {
    async run(sql, ...p) {
      db.prepare(sql).run(...(p as never[]));
    },
    async first(sql, ...p) {
      return (db.prepare(sql).get(...(p as never[])) ?? null) as never;
    },
    async all(sql, ...p) {
      return db.prepare(sql).all(...(p as never[])) as never;
    },
  };
}

/** A fake D1 binding over the same in-memory SQLite, for the HTTP handler. */
function memoryD1(): D1Database {
  const db = new DatabaseSync(":memory:");
  const stmt = (sql: string, params: unknown[] = []) => ({
    bind: (...p: unknown[]) => stmt(sql, p),
    run: async () => (db.prepare(sql).run(...(params as never[])), { success: true }),
    first: async () => db.prepare(sql).get(...(params as never[])) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...(params as never[])) }),
  });
  return { prepare: (sql: string) => stmt(sql) } as unknown as D1Database;
}

describe("accounts", () => {
  it("guest accounts, sessions, profile edits", async () => {
    const sql = memorySql();
    await ensureSchema(sql);
    const { user, token } = await createGuest(sql, 1000, "  Eric  ");
    expect(user.name).toBe("Eric");
    expect((await userFromToken(sql, token, 2000))!.id).toBe(user.id);
    expect(await userFromToken(sql, "nope", 2000)).toBeNull();
    const u = await updateProfile(sql, user.id, { name: "Hunter", icon: "🦁" });
    expect([u.name, u.icon]).toEqual(["Hunter", "🦁"]);
    expect((await updateProfile(sql, user.id, { icon: "not-an-icon" })).icon).toBe("🦁");
  });

  it("profile stats from results", async () => {
    const sql = memorySql();
    await ensureSchema(sql);
    const { user } = await createGuest(sql, 1000);
    await recordResult(sql, user.id, { mode: "classic", online: false, placement: 1, players: 64, rating: 1700 }, 2000);
    await recordResult(sql, user.id, { mode: "crowd", online: true, placement: 30, players: 100, team: "w", teamWon: true, rating: 1650, ranked: true }, 3000);
    await recordResult(sql, user.id, { mode: "crowd", online: true, placement: 3, players: 100, team: "w", teamWon: false }, 4000);
    const p = await profile(sql, user);
    expect(p.stats.all).toMatchObject({ matches: 3, wins: 1, finals: 2, best: 1, avgPlacement: 11.3, teamWins: 1 });
    expect(p.stats.crowd.matches).toBe(2);
    expect(p.recent[0]!.placement).toBe(3);
    // Your rating is your latest ranked one: the solo game (all bots) counts in the stats, not for ranking.
    expect(p.rating).toBe(1650);
  });

  it("signing in: attaches to the guest, or switches to the existing account and brings the guest's results", async () => {
    const sql = memorySql();
    await ensureSchema(sql);
    const a = await createGuest(sql, 1000);
    const linked = await signInWithIdentity(sql, a.user, "google", "sub-1", { email: "e@x.com", name: "Eric" }, 2000);
    expect(linked.id).toBe(a.user.id);
    expect(linked.google_sub).toBe("sub-1");
    expect(linked.email).toBe("e@x.com");
    // A new device: a guest plays a match, then signs in with the same Google account.
    const b = await createGuest(sql, 3000);
    await recordResult(sql, b.user.id, { mode: "classic", online: false, placement: 5, players: 64 }, 3500);
    const back = await signInWithIdentity(sql, b.user, "google", "sub-1", {}, 4000);
    expect(back.id).toBe(a.user.id);
    expect((await profile(sql, back)).stats.all.matches).toBe(1);
    // The email from Google signs in to the same account too.
    const c = await createGuest(sql, 5000);
    expect((await signInWithIdentity(sql, c.user, "email", "e@x.com", {}, 6000)).id).toBe(a.user.id);
  });

  it("email codes: one use, expiry, attempts and rate limits", async () => {
    const sql = memorySql();
    await ensureSchema(sql);
    const s = await startEmailCode(sql, "a@b.co", 0);
    expect(s.ok).toBe(true);
    const code = s.ok ? s.code : "";
    expect(code).toMatch(/^\d{6}$/);
    expect((await startEmailCode(sql, "a@b.co", 10_000)).ok).toBe(false); // too soon
    expect(await verifyEmailCode(sql, "a@b.co", code === "000000" ? "111111" : "000000", 20_000)).toBe(false);
    expect(await verifyEmailCode(sql, "a@b.co", code, 20_000)).toBe(true);
    expect(await verifyEmailCode(sql, "a@b.co", code, 21_000)).toBe(false); // used
    const t = await startEmailCode(sql, "a@b.co", 60_000);
    expect(t.ok).toBe(true);
    expect(await verifyEmailCode(sql, "a@b.co", t.ok ? t.code : "", 60_000 + 11 * 60_000)).toBe(false); // expired
    // 5 a hour.
    for (let i = 2; i < 5; i++) expect((await startEmailCode(sql, "a@b.co", 60_000 + i * 40_000)).ok).toBe(true);
    expect((await startEmailCode(sql, "a@b.co", 60_000 + 6 * 40_000)).ok).toBe(false);
  });
});

describe("account API", () => {
  const origin = "https://hunchess.com";
  const call = async (env: object, path: string, init: RequestInit & { cookie?: string } = {}, fetcher?: typeof fetch) => {
    const headers = new Headers(init.headers);
    if (init.cookie) headers.set("cookie", init.cookie);
    const res = (await handleAccountApi(new Request(origin + path, { ...init, headers }), env as never, fetcher))!;
    const set = res.headers.get("set-cookie");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = res.status === 302 ? null : await res.json().catch(() => null);
    return { res, cookie: set?.split(";")[0] ?? init.cookie, body };
  };

  it("config says what's set up; /api/me makes a guest; email code sign-in works end to end", async () => {
    const env = { DB: memoryD1(), RESEND_API_KEY: "re_test" };
    expect((await call(env, "/api/auth/config")).body).toEqual({ accounts: true, google: false, email: true, onlineNeedsSignIn: true });
    const me = await call(env, "/api/me?name=Eric");
    expect(me.body.user.name).toBe("Eric");
    expect(me.body.user.signedIn).toBe(false);
    let sentCode = "";
    const fakeResend = (async (_url: string, init: RequestInit) => {
      sentCode = /(\d{6}) is your/.exec(JSON.parse(String(init.body)).subject)![1]!;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const start = await call(env, "/api/auth/email/start", { method: "POST", body: JSON.stringify({ email: "Eric@Example.com" }), cookie: me.cookie }, fakeResend);
    expect(start.body).toEqual({ ok: true });
    const bad = await call(env, "/api/auth/email/verify", { method: "POST", body: JSON.stringify({ email: "eric@example.com", code: "000000" === sentCode ? "111111" : "000000" }), cookie: me.cookie });
    expect(bad.res.status).toBe(400);
    const ok = await call(env, "/api/auth/email/verify", { method: "POST", body: JSON.stringify({ email: "eric@example.com", code: sentCode }), cookie: me.cookie });
    expect(ok.body.user.signedIn).toBe(true);
    expect(ok.body.user.email).toBe("eric@example.com");
    // Results go on the profile.
    await call(env, "/api/results", { method: "POST", body: JSON.stringify({ mode: "crowd", placement: 2, players: 100 }), cookie: ok.cookie });
    expect((await call(env, "/api/me", { cookie: ok.cookie })).body.stats.crowd.matches).toBe(1);
  });

  it("POST /api/shop/chat: your quick chat picks, saved to your account and on your profile", async () => {
    const env = { DB: memoryD1() };
    const me = await call(env, "/api/me?name=Chatty");
    expect(me.body.shop.chat).toEqual(defaultChatPicks());
    const post = (body: unknown) => call(env, "/api/shop/chat", { method: "POST", body: JSON.stringify(body), cookie: me.cookie });
    const r = await post({ lines: ["push-pawns", "gg", "gk-crown"], emoji: ["e-fire"] });
    expect(r.res.status).toBe(200);
    expect(r.body.chat).toEqual({ lines: ["push-pawns", "gg"], emoji: ["e-fire"] });
    expect((await call(env, "/api/me", { cookie: me.cookie })).body.shop.chat).toEqual({ lines: ["push-pawns", "gg"], emoji: ["e-fire"] });
    expect((await post({ emoji: null })).body.chat.emoji).toEqual(defaultChatPicks().emoji);
    expect((await post("junk")).body.chat.lines).toEqual(["push-pawns", "gg"]);
    // Only for someone with an account on this device.
    expect((await call(env, "/api/shop/chat", { method: "POST", body: "{}" })).res.status).toBe(401);
  });

  it("Google: start redirects with state; the callback checks it and signs in", async () => {
    const env = { DB: memoryD1(), GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "secret" };
    const me = await call(env, "/api/me");
    const start = await call(env, "/api/auth/google/start", { cookie: me.cookie });
    const loc = new URL(start.res.headers.get("location")!);
    expect(loc.origin).toBe("https://accounts.google.com");
    expect(loc.searchParams.get("redirect_uri")).toBe(`${origin}/api/auth/google/callback`);
    const state = loc.searchParams.get("state")!;
    const stateCookie = start.res.headers.get("set-cookie")!.split(";")[0]!;
    const claims = btoa(JSON.stringify({ sub: "g-123", aud: "cid", email: "e@gmail.com", email_verified: true, name: "Eric M" }));
    const fakeGoogle = (async () => new Response(JSON.stringify({ id_token: `x.${claims}.y` }), { status: 200 })) as unknown as typeof fetch;
    // A wrong state is refused.
    const forged = await call(env, `/api/auth/google/callback?state=nope&code=c`, { cookie: `${me.cookie}; ${stateCookie}` }, fakeGoogle);
    expect(forged.res.headers.get("location")).toContain("signin=failed");
    const cb = await call(env, `/api/auth/google/callback?state=${state}&code=c`, { cookie: `${me.cookie}; ${stateCookie}` }, fakeGoogle);
    expect(cb.res.headers.get("location")).toBe(`${origin}/?signin=google`);
    const after = await call(env, "/api/me", { cookie: cb.cookie });
    expect(after.body.user).toMatchObject({ signedIn: true, google: true, email: "e@gmail.com" });
  });

  it("Google sends you back where you started (an invite link), and only to a path on this site", async () => {
    const env = { DB: memoryD1(), GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "secret" };
    const claims = btoa(JSON.stringify({ sub: "g-9", aud: "cid" }));
    const fakeGoogle = (async () => new Response(JSON.stringify({ id_token: `x.${claims}.y` }), { status: 200 })) as unknown as typeof fetch;
    for (const [next, back] of [["/lobby/ABCDE", "/lobby/ABCDE"], ["//evil.example", "/"], ["https://evil.example", "/"]] as const) {
      const me = await call(env, "/api/me");
      const start = await call(env, `/api/auth/google/start?next=${encodeURIComponent(next)}`, { cookie: me.cookie });
      const cookies = start.res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
      const state = new URL(start.res.headers.get("location")!).searchParams.get("state");
      const cb = await call(env, `/api/auth/google/callback?state=${state}&code=c`, { cookie: `${me.cookie}; ${cookies}` }, fakeGoogle);
      expect(cb.res.headers.get("location")).toBe(`${origin}${back}?signin=google`);
    }
  });

  it("online play needs a signed-in account once sign-in is set up", () => {
    expect(signInRequired({})).toBe(false);
    expect(signInRequired({ RESEND_API_KEY: "k" })).toBe(true);
    expect(signInRequired({ GOOGLE_CLIENT_ID: "a" })).toBe(false);
    expect(signInRequired({ GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b" })).toBe(true);
    const base = { id: "u", name: "P", icon: "♟", created_at: 0 };
    expect(isSignedIn(null)).toBe(false);
    expect(isSignedIn({ ...base, email: null, google_sub: null })).toBe(false);
    expect(isSignedIn({ ...base, email: "a@b.co", google_sub: null })).toBe(true);
    expect(isSignedIn({ ...base, email: null, google_sub: "g" })).toBe(true);
  });

  it("without a database, only the config answers", async () => {
    expect((await call({}, "/api/auth/config")).body).toEqual({ accounts: false, google: false, email: false, onlineNeedsSignIn: false });
    expect((await call({}, "/api/me")).res.status).toBe(503);
  });

  it("pawn hats and God King effects: everyone has them all (in the locker), equips one of each, and a guest's choices follow them when they sign in", async () => {
    const sql = memorySql();
    await ensureSchema(sql);
    const { user: guest } = await createGuest(sql, 1000, "Guest");
    // Everyone starts with the starters equipped, and has every hat and King effect.
    let shop = await shopState(sql, guest.id);
    expect(shop.equipped).toEqual({ king: "king-holy", hat: "hat-none" });
    expect(shop.owned).toEqual(expect.arrayContaining(["king-holy", "hat-none", "hat-crown", "hat-party", "king-storm", "king-void"]));
    expect(shop.coins).toBe(0);
    // Nothing to get first; only things that aren't items fail.
    expect((await buyItem(sql, guest.id, "hat-nope", 1100)).ok).toBe(false);
    expect((await equipItem(sql, guest.id, "hat-nope")).ok).toBe(false);
    const eq = await equipItem(sql, guest.id, "hat-crown");
    expect(eq.ok && eq.shop.equipped.hat).toBe("hat-crown");
    await equipItem(sql, guest.id, "king-storm");
    // The profile carries it, so a match knows your look.
    expect((await profile(sql, guest)).shop.equipped).toEqual({ king: "king-storm", hat: "hat-crown" });
    // An existing account keeps its own choices.
    const account = await signInWithIdentity(sql, null, "email", "owner@example.com", {}, 1300);
    await equipItem(sql, account.id, "king-hellfire");
    const merged = await signInWithIdentity(sql, guest, "email", "owner@example.com", {}, 1400);
    expect(merged.id).toBe(account.id);
    shop = await shopState(sql, account.id);
    expect(shop.equipped).toEqual({ king: "king-hellfire", hat: "hat-crown" });
  });

  it("one head: a pawn hat takes off a crate head item, and a crate head item takes off the pawn hat", async () => {
    const sql = memorySql();
    await ensureSchema(sql);
    const { user } = await createGuest(sql, 1000, "Guest");
    await sql.run("INSERT INTO items (id, user_id, def, color, blemish, seed, crate, created_at) VALUES ('beanie-1', ?, 'beanie', 'red', 40, 7, 'winter-1', 900)", user.id);
    await equipItem(sql, user.id, "hat-party");
    const on = await equipLocker(sql, user.id, "head", "beanie-1");
    expect(on.ok && on.locker.equipped.head).toBe("beanie-1");
    expect((await shopState(sql, user.id)).equipped.hat).toBe("hat-none");
    await equipItem(sql, user.id, "hat-wizard");
    expect((await lockerState(sql, user.id)).equipped.head).toBeUndefined();
    // Taking the pawn hat off ("No hat") leaves the head bare, and a God King effect doesn't touch it.
    await equipLocker(sql, user.id, "head", "beanie-1");
    await equipItem(sql, user.id, "king-void");
    expect((await lockerState(sql, user.id)).equipped.head).toBe("beanie-1");
  });

  it("deleting crate items: your own only, for good, taken off first if worn", async () => {
    const sql = memorySql();
    await ensureSchema(sql);
    const { user } = await createGuest(sql, 1000, "Guest");
    const { user: other } = await createGuest(sql, 1000, "Other");
    const add = (id: string, userId: string, blemish: number) =>
      sql.run("INSERT INTO items (id, user_id, def, color, blemish, seed, crate, created_at) VALUES (?, ?, 'santa-beard', 'red', ?, 7, 'winter-1', 900)", id, userId, blemish);
    await add("a", user.id, 10);
    await add("b", user.id, 40);
    await add("c", user.id, 70);
    await add("theirs", other.id, 5);
    await equipLocker(sql, user.id, "face", "b");
    expect((await deleteLockerItems(sql, user.id, "b")).ok).toBe(false);
    expect((await deleteLockerItems(sql, user.id, [])).ok).toBe(false);
    const r = await deleteLockerItems(sql, user.id, ["b", "c", "theirs"]);
    if (!r.ok) throw new Error(r.message);
    expect(r.locker.items.map((i) => i.id)).toEqual(["a"]);
    expect(r.locker.equipped.face).toBeUndefined();
    expect((await lockerState(sql, other.id)).items.map((i) => i.id)).toEqual(["theirs"]);
  });

  it("chat packs: the free ones everyone has; a pack you get is yours to use (nothing to equip) and follows you when you sign in", async () => {
    const sql = memorySql();
    await ensureSchema(sql);
    const { user: guest } = await createGuest(sql, 1000, "Guest");
    let shop = await shopState(sql, guest.id);
    expect(shop.owned).toEqual(expect.arrayContaining(["chat-basics", "chat-emoji-basics"]));
    expect(shop.owned).not.toContain("chat-godking");
    expect(ownedChatPacks(shop.owned)).toEqual(["basics", "emoji-basics"]);
    const got = await buyItem(sql, guest.id, "chat-godking", 1100);
    expect(got.ok && got.shop.owned).toContain("chat-godking");
    // Equipping a pack changes nothing: the equipped slots are the King's and the hat's.
    const eq = await equipItem(sql, guest.id, "chat-godking");
    expect(eq.ok && eq.shop.equipped).toEqual({ king: "king-holy", hat: "hat-none" });
    shop = await shopState(sql, guest.id);
    expect(ownedChatPacks(shop.owned)).toEqual(["basics", "emoji-basics", "godking"]);
    const account = await signInWithIdentity(sql, guest, "email", "chatty@example.com", {}, 1200);
    expect(ownedChatPacks((await shopState(sql, account.id)).owned)).toContain("godking");
  });

  it("quick chat picks: the defaults until chosen; cleaned, in order, capped; a pack fills empty slots; they follow you when you sign in", async () => {
    const sql = memorySql();
    await ensureSchema(sql);
    const { user: guest } = await createGuest(sql, 1000, "Guest");
    // New (and existing) players: the defaults, in the shop state the profile and the match read.
    expect((await shopState(sql, guest.id)).chat).toEqual(defaultChatPicks());
    expect((await profile(sql, guest)).shop.chat).toEqual(defaultChatPicks());
    // Chosen: kept in their order; unknown ids, the other kind, repeats and lines from packs they don't own dropped.
    let shop = await setChatPicks(sql, guest.id, { lines: ["rematch", "gg", "free text!", "e-fire", "gg", "gk-crown", "push-pawns"] });
    expect(shop.chat.lines).toEqual(["rematch", "gg", "push-pawns"]);
    expect(shop.chat.emoji).toEqual(defaultChatPicks().emoji);
    // At most the caps.
    shop = await setChatPicks(sql, guest.id, { emoji: ["e-fire", "e-skull"] });
    expect(shop.chat).toEqual({ lines: ["rematch", "gg", "push-pawns"], emoji: ["e-fire", "e-skull"] });
    const tooMany = await setChatPicks(sql, guest.id, { lines: defaultChatPicks().lines.concat(["rematch", "hi-all", "lets-go"]) });
    expect(tooMany.chat.lines).toHaveLength(QUICK_CHAT.maxLines);
    // Junk changes nothing; null puts a kind back to the defaults.
    expect((await setChatPicks(sql, guest.id, { lines: "gg", emoji: 3 })).chat).toEqual(tooMany.chat);
    shop = await setChatPicks(sql, guest.id, { lines: ["gg", "wow"] });
    expect(shop.chat.lines).toEqual(["gg", "wow"]);
    // Getting a pack: its lines go into the empty slots (in its order, up to the cap).
    let got = await buyItem(sql, guest.id, "chat-godking", 1100);
    expect(got.ok && got.shop.chat.lines).toEqual(["gg", "wow", "gk-crown", "gk-stand", "gk-call", "gk-long-live"]);
    got = await buyItem(sql, guest.id, "chat-emoji-royal", 1150);
    expect(got.ok && got.shop.chat.emoji).toEqual(["e-fire", "e-skull", "e-prince", "e-princess", "e-gem", "e-trophy", "e-fleur", "e-dragon"]);
    // A pack's lines can be picked once it's owned.
    shop = await setChatPicks(sql, guest.id, { lines: ["gk-crown", "gg"] });
    expect(shop.chat.lines).toEqual(["gk-crown", "gg"]);
    // Full picks (the defaults are 10/10 and 8/8): getting a pack changes nothing in them.
    const { user: other } = await createGuest(sql, 1200, "Other");
    got = await buyItem(sql, other.id, "chat-winter", 1200);
    expect(got.ok && got.shop.chat).toEqual(defaultChatPicks());
    got = await buyItem(sql, other.id, "chat-emoji-chess", 1200);
    expect(got.ok && got.shop.chat).toEqual(defaultChatPicks());
    // Signing in to an existing account: the guest's picks come along unless the account has its own.
    const fresh = await signInWithIdentity(sql, null, "email", "fresh@example.com", {}, 1300);
    const merged = await signInWithIdentity(sql, guest, "email", "fresh@example.com", {}, 1400);
    expect(merged.id).toBe(fresh.id);
    expect((await shopState(sql, fresh.id)).chat.lines).toEqual(["gk-crown", "gg"]);
    const owner = await signInWithIdentity(sql, null, "email", "owner@example.com", {}, 1500);
    await setChatPicks(sql, owner.id, { lines: ["thanks"] });
    await setChatPicks(sql, other.id, { lines: ["wow"] });
    await signInWithIdentity(sql, other, "email", "owner@example.com", {}, 1600);
    expect((await shopState(sql, owner.id)).chat.lines).toEqual(["thanks"]);
  });

  it("the locker: crates open on the server (free while testing), items equip by slot, and a guest's items follow them", async () => {
    const sql = memorySql();
    await ensureSchema(sql);
    const { user: guest } = await createGuest(sql, 1000, "Guest");
    expect((await lockerState(sql, guest.id)).items).toEqual([]);
    expect((await openCrate(sql, guest.id, "nope", {}, 1100)).ok).toBe(false);
    // The test switch lands on Fischer Random: a Legendary or Mythic item, shiny when asked.
    const r = await openCrate(sql, guest.id, "winter-1", { fischer: true, shiny: true }, 1100);
    if (!r.ok) throw new Error(r.message);
    expect(r.roll.fischer).toBe(true);
    expect(["gift-tube", "candy-cane", "fire-ice-crown"]).toContain(r.item.def);
    expect(r.item.blemish).toBeLessThan(10);
    expect(r.locker.items).toHaveLength(1);
    // Equip it in its own slot only; empty the slot again.
    const slot = r.item.def === "fire-ice-crown" ? "head" : "weapon";
    expect((await equipLocker(sql, guest.id, slot === "head" ? "face" : "head", r.item.id)).ok).toBe(false);
    const eq = await equipLocker(sql, guest.id, slot, r.item.id);
    expect(eq.ok && eq.locker.look[slot]?.def).toBe(r.item.def);
    expect((await profile(sql, guest)).locker.equipped[slot]).toBe(r.item.id);
    // Someone else's item can't be equipped.
    const { user: other } = await createGuest(sql, 1200, "Other");
    expect(await equipLocker(sql, other.id, slot, r.item.id)).toEqual({ ok: false, message: "That isn't yours." });
    // Signing in to an existing account brings the guest's items along.
    const account = await signInWithIdentity(sql, null, "email", "crates@example.com", {}, 1300);
    await signInWithIdentity(sql, guest, "email", "crates@example.com", {}, 1400);
    const merged = await lockerState(sql, account.id);
    expect(merged.items.map((i) => i.id)).toContain(r.item.id);
    expect(merged.equipped[slot]).toBe(r.item.id);
    const emptied = await equipLocker(sql, account.id, slot, null);
    expect(emptied.ok && emptied.locker.equipped[slot]).toBeUndefined();
  });

  it("the locker keeps a present's second colour, and adding that column again is harmless", async () => {
    const sql = memorySql();
    await ensureSchema(sql);
    await ensureSchema(sql, {}); // a second connection runs the column migration again
    const { user } = await createGuest(sql, 1000, "Guest");
    let present;
    for (let i = 0; i < 400 && !present; i++) {
      const r = await openCrate(sql, user.id, "winter-1", {}, 1100 + i);
      if (r.ok && r.item.def === "present") present = r.item;
    }
    if (!present) throw new Error("no present in 400 opens");
    expect(present.color2).toBeTruthy();
    const eq = await equipLocker(sql, user.id, "head", present.id);
    expect(eq.ok && eq.locker.look.head?.color2).toBe(present.color2);
    const st = await lockerState(sql, user.id);
    // One-colour items have none (goggles, like the present, have two).
    for (const i of st.items) if (itemDef(i.def)?.colors !== 2) expect(i.color2).toBeUndefined();
  });

  it("items rolled under the old purity odds (51-100%) keep their purity", async () => {
    const sql = memorySql();
    await ensureSchema(sql);
    const { user } = await createGuest(sql, 1000, "Guest");
    const old = (id: string, blemish: number) =>
      sql.run("INSERT INTO items (id, user_id, def, color, blemish, seed, crate, created_at) VALUES (?, ?, 'santa-hat', 'red', ?, 7, 'winter-1', 900)", id, user.id, blemish);
    await old("old-rough", 49);
    await old("old-shiny", 9.5);
    const eq = await equipLocker(sql, user.id, "head", "old-shiny");
    expect(eq.ok && eq.locker.look.head?.blemish).toBe(9.5);
    const st = await lockerState(sql, user.id);
    expect(Object.fromEntries(st.items.map((i) => [i.id, i.blemish]))).toEqual({ "old-rough": 49, "old-shiny": 9.5 });
    // New rolls use the whole range, 100% down to 0%.
    const r = await openCrate(sql, user.id, "winter-1", {}, 1100);
    if (!r.ok) throw new Error(r.message);
    expect(r.item.blemish).toBeGreaterThanOrEqual(0);
    expect(r.item.blemish).toBeLessThanOrEqual(100);
  });

  it("icons: a drawn 48 × 48 PNG is accepted; other sizes, other formats and junk are not", async () => {
    // Real PNG headers: 48 × 48 and 32 × 32 (signature, IHDR, then a little data).
    const png = (w: number, h: number) => {
      const bytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, w, 0, 0, 0, h, 8, 6, 0, 0, 0, 1, 2, 3];
      return "data:image/png;base64," + btoa(String.fromCharCode(...bytes));
    };
    expect(isPixelIcon(png(48, 48))).toBe(true);
    expect(isPixelIcon(png(32, 32))).toBe(false);
    expect(isPixelIcon("data:image/jpeg;base64,/9j/4AAQ")).toBe(false);
    expect(isPixelIcon("data:image/png;base64,<script>")).toBe(false);
    expect(isPixelIcon(png(48, 48) + "A".repeat(20_000))).toBe(false);
    const sql = memorySql();
    await ensureSchema(sql);
    const { user } = await createGuest(sql, 1000, "Artist");
    expect((await updateProfile(sql, user.id, { icon: png(48, 48) })).icon).toBe(png(48, 48));
    // A bad one leaves the icon as it was.
    expect((await updateProfile(sql, user.id, { icon: png(64, 64) })).icon).toBe(png(48, 48));
    // The old emoji still work for older accounts.
    expect((await updateProfile(sql, user.id, { icon: "🐉" })).icon).toBe("🐉");
  });
});
