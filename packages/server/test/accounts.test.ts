import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import {
  isPixelIcon,
  buyItem,
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
    await recordResult(sql, user.id, { mode: "crowd", online: true, placement: 30, players: 100, team: "w", teamWon: true }, 3000);
    await recordResult(sql, user.id, { mode: "crowd", online: true, placement: 3, players: 100, team: "w", teamWon: false }, 4000);
    const p = await profile(sql, user);
    expect(p.stats.all).toMatchObject({ matches: 3, wins: 1, finals: 2, best: 1, avgPlacement: 11.3, teamWins: 1 });
    expect(p.stats.crowd.matches).toBe(2);
    expect(p.recent[0]!.placement).toBe(3);
    expect(p.rating).toBe(1700);
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

  it("the shop: starters for everyone, get (free while testing) and equip, and a guest's items follow them when they sign in", async () => {
    const sql = memorySql();
    await ensureSchema(sql);
    const { user: guest } = await createGuest(sql, 1000, "Guest");
    // Everyone starts with the starters, equipped.
    let shop = await shopState(sql, guest.id);
    expect(shop.equipped).toEqual({ king: "king-holy", hat: "hat-none" });
    expect(shop.owned).toEqual(expect.arrayContaining(["king-holy", "hat-none"]));
    expect(shop.coins).toBe(0);
    // You can't equip what you don't own, or anything not in the shop.
    expect(await equipItem(sql, guest.id, "hat-crown")).toEqual({ ok: false, message: "Get it first." });
    expect((await buyItem(sql, guest.id, "hat-nope", 1100)).ok).toBe(false);
    // Get it (free while testing), then equip it.
    const bought = await buyItem(sql, guest.id, "hat-crown", 1100);
    expect(bought.ok && bought.shop.owned).toContain("hat-crown");
    const eq = await equipItem(sql, guest.id, "hat-crown");
    expect(eq.ok && eq.shop.equipped.hat).toBe("hat-crown");
    await buyItem(sql, guest.id, "king-storm", 1200);
    await equipItem(sql, guest.id, "king-storm");
    // The profile carries it, so a match knows your look.
    expect((await profile(sql, guest)).shop.equipped).toEqual({ king: "king-storm", hat: "hat-crown" });
    // An existing account keeps its own choices; the guest's items join it.
    const account = await signInWithIdentity(sql, null, "email", "owner@example.com", {}, 1300);
    await buyItem(sql, account.id, "king-hellfire", 1300);
    await equipItem(sql, account.id, "king-hellfire");
    const merged = await signInWithIdentity(sql, guest, "email", "owner@example.com", {}, 1400);
    expect(merged.id).toBe(account.id);
    shop = await shopState(sql, account.id);
    expect(shop.owned).toEqual(expect.arrayContaining(["hat-crown", "king-storm", "king-hellfire"]));
    expect(shop.equipped).toEqual({ king: "king-hellfire", hat: "hat-crown" });
    expect((await shopState(sql, guest.id)).owned).not.toContain("hat-crown");
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
