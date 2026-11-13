import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BANNED_LINE, FAIRPLAY } from "@chessroyale/core";
import { createSession, ensureSchema, markAgeOk, sha256, signInWithIdentity, type Sql, type User } from "../src/accounts.ts";
import { caseOf, decide, setCase } from "../src/fairplay.ts";
import { deleteAccount } from "../src/account-data.ts";
import { memoryDb } from "./memory-db.ts";

// (The engine server's container needs the Workers runtime; nothing here reaches it.)
vi.mock("@cloudflare/containers", () => ({ Container: class {}, getContainer: () => ({ fetch: async () => new Response("{}") }) }));
vi.mock("../src/engine.ts", async (real) => ({ ...(await real<object>()), serverScoreAt: async () => null }));
const { default: worker } = await import("../src/index.ts");

/**
 * A ban means you can't sign in (Eric, Nov 13: "When I think of the word banned, I think of you can't sign in anymore"; "No URLs
 * work"; docs/decisions/2026-11-13-ban-blocks-sign-in.md). Through the whole Worker, its ban gate included (ban-gate.ts): signing in to
 * a banned account (by email or Google, or by ban evasion) is refused with Eric's line and no session; a session signed in when the
 * ban lands gets the ban answer on its next request, and is ended; the browser is marked, so every route answers the same until the
 * ban is lifted; a lifted ban signs in as before; the engine pool and guests pass as ever.
 */

const origin = "https://hunchess.test";
const ctx = { waitUntil: (p: Promise<unknown>) => void p.catch(() => undefined), passThroughOnException() {} } as unknown as ExecutionContext;

/** A fresh database and the Worker's environment over it (email and Google sign-in set up; no per-address limit). */
async function setUp() {
  const { sql, d1 } = memoryDb();
  await ensureSchema(sql, d1);
  const codes = new Map<string, string>();
  /** The Google account Google's page signs in as (a test sets it). */
  const google = { sub: "g-none", email: "none@gmail.com" };
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    if (String(url).startsWith("https://api.resend.com")) {
      const b = JSON.parse(String(init.body)) as { to: string[]; subject: string };
      const code = /(\d{6}) is your/.exec(b.subject)?.[1];
      if (code) codes.set(b.to[0]!, code);
      return new Response("{}");
    }
    const claims = btoa(JSON.stringify({ sub: google.sub, aud: "cid", email: google.email, email_verified: true }));
    return new Response(JSON.stringify({ id_token: `x.${claims}.y` }));
  });
  const env = { DB: d1, RESEND_API_KEY: "re_test", GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "secret", LOAD_TEST: "1" };
  return { sql, env, codes, google };
}
type World = Awaited<ReturnType<typeof setUp>>;

/** An account (an email, or a Google account) whose holder said they were old enough. */
async function account(sql: Sql, kind: "email" | "google", value: string): Promise<User> {
  const u = await signInWithIdentity(sql, null, kind, value, {}, 1000);
  await markAgeOk(sql, u.id, 1000);
  return u;
}

/** A browser: its cookies kept between requests (Max-Age=0 removes one), every request through the Worker. */
function browser(w: World) {
  const jar = new Map<string, string>();
  const call = async (path: string, init: RequestInit & { json?: unknown } = {}) => {
    const headers = new Headers(init.headers);
    if (jar.size) headers.set("cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "));
    if (init.json !== undefined) headers.set("content-type", "application/json");
    const body = init.json !== undefined ? JSON.stringify(init.json) : init.body;
    const res = await worker.fetch(new Request(origin + path, { method: init.method ?? (init.json !== undefined ? "POST" : "GET"), headers, body }), w.env as never, ctx);
    for (const c of res.headers.getSetCookie()) {
      const [pair, ...attrs] = c.split(";");
      const i = pair!.indexOf("=");
      const [k, v] = [pair!.slice(0, i), pair!.slice(i + 1)];
      if (attrs.some((a) => a.trim().toLowerCase() === "max-age=0")) jar.delete(k);
      else jar.set(k, v);
    }
    const text = await res.text();
    let read: Record<string, unknown> | null = null;
    try {
      read = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // (A redirect, or a page.)
    }
    return { res, status: res.status, body: read, banHeader: res.headers.get("x-hc-banned") };
  };
  /** Signs in by an emailed code (this device answers "old enough" first, as Sign up does). */
  const emailSignIn = async (email: string) => {
    // (The app has its guest first: its first /api/me.)
    if (!jar.has("hc_session")) await call("/api/me");
    await call("/api/auth/age", { json: { oldEnough: true }, headers: { origin } });
    expect((await call("/api/auth/email/start", { json: { email } })).status).toBe(200);
    return call("/api/auth/email/verify", { json: { email, code: w.codes.get(email) } });
  };
  /** "Continue with Google": the start, Google's page, the callback. Answers where the callback sends the page. */
  const googleSignIn = async () => {
    const start = await call("/api/auth/google/start?next=/town");
    const to = new URL(start.res.headers.get("location")!);
    expect(to.origin).toBe("https://accounts.google.com");
    const back = await call(`/api/auth/google/callback?state=${to.searchParams.get("state")}&code=c`);
    return back.res.headers.get("location");
  };
  return { jar, call, emailSignIn, googleSignIn };
}

/** The ban answer, exactly: 403, Eric's line, the app's header. */
function isBanAnswer(r: { status: number; body: Record<string, unknown> | null; banHeader: string | null }) {
  expect([r.status, r.body, r.banHeader]).toEqual([403, { banned: true, message: BANNED_LINE }, "1"]);
}

const sessionsOf = async (sql: Sql, userId: string) => (await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?", userId))!.n;
const users = async (sql: Sql) => (await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM users"))!.n;

/** Routes a banned browser tries (a lobby link's, the town's, the shop's, PLAY, the sign-in's own): each the ban answer. */
const ROUTES: [string, RequestInit & { json?: unknown }][] = [
  ["/api/me", {}],
  ["/api/status", {}],
  ["/api/auth/config", {}],
  ["/api/live", {}],
  ["/api/shop", {}],
  ["/api/quests", {}],
  ["/api/lobby/ABCDE", {}],
  ["/api/friends", {}],
  ["/api/profile/someone", {}],
  ["/api/play", { method: "POST" }],
  ["/api/town/here", { json: { at: [1, 1] } }],
  ["/api/auth/email/start", { json: { email: "other@example.com" } }],
  ["/api/fairplay/status", {}],
  ["/admin/fairplay", {}],
];

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("signing in to a banned account (Eric, Nov 13)", () => {
  it("by email: once the code is right, the ban answer and nothing else; no session; the browser marked, so every route answers the same", async () => {
    const w = await setUp();
    const pat = await account(w.sql, "email", "pat@example.com");
    await setCase(w.sql, pat.id, "banned", "admin:eric@example.com", "engine moves", 1500);
    const b = browser(w);
    expect((await b.call("/api/me")).status).toBe(200);
    const guest = b.jar.get("hc_session");
    // A wrong code is only a wrong code (nothing said about the address).
    await b.call("/api/auth/age", { json: { oldEnough: true }, headers: { origin } });
    await b.call("/api/auth/email/start", { json: { email: "pat@example.com" } });
    const wrong = await b.call("/api/auth/email/verify", { json: { email: "pat@example.com", code: "000000" } });
    expect([wrong.status, wrong.banHeader]).toEqual([400, null]);
    const refused = await b.call("/api/auth/email/verify", { json: { email: "pat@example.com", code: w.codes.get("pat@example.com") } });
    isBanAnswer(refused);
    // No session for Pat; this browser's guest session is ended too; the browser carries Pat's mark.
    expect(await sessionsOf(w.sql, pat.id)).toBe(0);
    expect(b.jar.has("hc_session")).toBe(false);
    expect(b.jar.get("hc_banned")).toBe(pat.id);
    expect(await w.sql.first("SELECT 1 FROM sessions WHERE token_hash = ?", await sha256(decodeURIComponent(guest!)))).toBeNull();
    // Every route: the ban answer, and no guest made for the browser.
    const before = await users(w.sql);
    for (const [path, init] of ROUTES) {
      const r = await b.call(path, init);
      isBanAnswer(r);
    }
    expect(await users(w.sql)).toBe(before);
    expect(b.jar.has("hc_session")).toBe(false);
    // The account's own sign-in cookie never gets it past: a session of Pat's (made some other way) is refused and ended.
    b.jar.set("hc_session", await createSession(w.sql, pat.id, Date.now()));
    isBanAnswer(await b.call("/api/me"));
    expect(await sessionsOf(w.sql, pat.id)).toBe(0);
    // Nor does clearing the session cookie alone: the mark holds.
    b.jar.delete("hc_session");
    isBanAnswer(await b.call("/api/me"));
  });

  it("by Google: back to the page with ?signin=banned, no session, the browser marked; nothing about the Google account kept for a new one", async () => {
    const w = await setUp();
    const gus = await account(w.sql, "google", "g-gus");
    await decide(w.sql, gus.id, "ban", "admin:eric@example.com", "engine moves", 1500);
    w.google.sub = "g-gus";
    const b = browser(w);
    await b.call("/api/me");
    expect(await b.googleSignIn()).toBe(`${origin}/town?signin=banned`);
    expect(await sessionsOf(w.sql, gus.id)).toBe(0);
    expect(b.jar.get("hc_banned")).toBe(gus.id);
    expect(b.jar.has("hc_session")).toBe(false);
    // (The page it lands on asks the server first thing: the ban answer.)
    isBanAnswer(await b.call("/api/me"));
    // Google's verified email a banned account's address (a new Google account): refused, and no account made for it.
    const cleo = await account(w.sql, "email", "cleo@gmail.com");
    await setCase(w.sql, cleo.id, "banned", "admin:eric@example.com", "engine moves", 1600);
    Object.assign(w.google, { sub: "g-new-cleo", email: "c.l.e.o@gmail.com" });
    const c = browser(w);
    await c.call("/api/me");
    const made = await users(w.sql);
    expect(await c.googleSignIn()).toBe(`${origin}/town?signin=banned`);
    expect(await users(w.sql)).toBe(made);
    expect(await w.sql.first("SELECT id FROM users WHERE google_sub = ?", "g-new-cleo")).toBeNull();
    expect(c.jar.get("hc_banned")).toBe(cleo.id);
  });

  it("ban evasion: a banned account's identity, new to us (a +tag, or the account deleted while banned), is refused; an account with one is banned by evasion as it signs in", async () => {
    const w = await setUp();
    const cheat = await account(w.sql, "email", "a.b@gmail.com");
    // An alias made before the ban (making it runs no check): banned by evasion the moment it signs in.
    const alias = await account(w.sql, "email", "ab+chess@gmail.com");
    await setCase(w.sql, cheat.id, "banned", "admin:eric@example.com", "engine moves", 1500);
    const b = browser(w);
    isBanAnswer(await b.emailSignIn("ab+chess@gmail.com"));
    expect(await caseOf(w.sql, alias.id)).toMatchObject({ status: "banned", decided_by: "evasion" });
    expect(b.jar.get("hc_banned")).toBe(alias.id);
    // A new address that's the cheat's (Gmail's dots and a +tag): refused, nothing made, the browser marked with the cheat.
    const c = browser(w);
    const made = await users(w.sql);
    isBanAnswer(await c.emailSignIn("a.b+2@gmail.com"));
    expect(await users(w.sql) - made).toBe(1); // (only this browser's own guest, from its first request)
    expect(await w.sql.first("SELECT id FROM users WHERE email = ?", "a.b+2@gmail.com")).toBeNull();
    // (Marked with a banned account that had the address: the cheat, or the alias banned for it a moment ago.)
    expect([cheat.id, alias.id]).toContain(c.jar.get("hc_banned"));
    // Deleted while banned: its address can't come back as a new account.
    const dee = await account(w.sql, "email", "dee@example.com");
    await setCase(w.sql, dee.id, "banned", "admin:eric@example.com", "engine moves", 1700);
    await deleteAccount(w.sql, (await w.sql.first<User>("SELECT id, name, icon, email, google_sub, created_at FROM users WHERE id = ?", dee.id))!, 1800);
    const d = browser(w);
    isBanAnswer(await d.emailSignIn("dee@example.com"));
    expect(await w.sql.first("SELECT id FROM users WHERE email = ?", "dee@example.com")).toBeNull();
  });
});

describe("a session signed in when the ban lands (Eric, Nov 13)", () => {
  it("its next request gets the ban answer, the session ended and the browser marked; a ban made on another server counts within FAIRPLAY.banCheckMs", async () => {
    const w = await setUp();
    vi.useFakeTimers({ now: Date.UTC(2026, 10, 13, 12), toFake: ["Date"] });
    const pat = await account(w.sql, "email", "pat@example.com");
    const b = browser(w);
    b.jar.set("hc_session", await createSession(w.sql, pat.id, Date.now()));
    expect((await b.call("/api/me")).status).toBe(200);
    // A person bans Pat (on this server): the very next request.
    await decide(w.sql, pat.id, "ban", "admin:eric@example.com", "engine moves", Date.now());
    isBanAnswer(await b.call("/api/live"));
    expect(await sessionsOf(w.sql, pat.id)).toBe(0);
    expect(b.jar.get("hc_banned")).toBe(pat.id);
    isBanAnswer(await b.call("/api/me"));

    // Banned on another server (this one never hears of it): its kept "not banned" answer holds at most FAIRPLAY.banCheckMs.
    const ann = await account(w.sql, "email", "ann@example.com");
    const a = browser(w);
    a.jar.set("hc_session", await createSession(w.sql, ann.id, Date.now()));
    expect((await a.call("/api/me")).status).toBe(200);
    await w.sql.run("INSERT INTO fairplay_cases (user_id, status, opened_at, updated_at) VALUES (?, 'banned', ?, ?)", ann.id, Date.now(), Date.now());
    vi.setSystemTime(Date.now() + FAIRPLAY.banCheckMs - 1);
    expect((await a.call("/api/live")).status).toBe(200);
    vi.setSystemTime(Date.now() + 2);
    isBanAnswer(await a.call("/api/live"));
    expect(await sessionsOf(w.sql, ann.id)).toBe(0);
  });

  it("PLAY catching ban evasion (banCheck) gives the same answer, and the next request too", async () => {
    const w = await setUp();
    const cheat = await account(w.sql, "email", "cheat@example.com");
    const alias = await account(w.sql, "email", "cheat+alt@example.com");
    const b = browser(w);
    b.jar.set("hc_session", await createSession(w.sql, alias.id, Date.now()));
    await setCase(w.sql, cheat.id, "banned", "admin:eric@example.com", "engine moves", Date.now());
    // (No queue here: the ban answer comes before any.)
    isBanAnswer(await b.call("/api/play", { method: "POST" }));
    expect(await caseOf(w.sql, alias.id)).toMatchObject({ status: "banned", decided_by: "evasion" });
    expect(await sessionsOf(w.sql, alias.id)).toBe(0);
    isBanAnswer(await b.call("/api/me"));
  });
});

describe("what passes the gate", () => {
  it("a lifted ban: the browser's mark goes on its next request, and the account signs in as before", async () => {
    const w = await setUp();
    const pat = await account(w.sql, "email", "pat@example.com");
    await setCase(w.sql, pat.id, "banned", "admin:eric@example.com", "engine moves", 1500);
    const b = browser(w);
    isBanAnswer(await b.emailSignIn("pat@example.com"));
    expect(b.jar.get("hc_banned")).toBe(pat.id);
    await decide(w.sql, pat.id, "clear", "admin:eric@example.com", "appealed by email: a club player", Date.now());
    const back = await b.call("/api/me");
    expect([back.status, back.banHeader]).toEqual([200, null]);
    expect(b.jar.has("hc_banned")).toBe(false);
    // (A new code: the last one went more than RESEND_SECONDS ago.)
    await w.sql.run("UPDATE email_codes SET sent_at = sent_at - 60000");
    const signed = await b.emailSignIn("pat@example.com");
    expect(signed.status).toBe(200);
    expect((signed.body as { user: { id: string } }).user.id).toBe(pat.id);
    expect(await sessionsOf(w.sql, pat.id)).toBe(1);
    expect((await b.call("/api/shop")).status).toBe(200);
  });

  it("the engine pool is never a ban: a pooled account signs in and plays its routes as anyone; so does a guest, and a reviewed one", async () => {
    const w = await setUp();
    const pooled = await account(w.sql, "email", "pooled@example.com");
    await setCase(w.sql, pooled.id, "pool", "detection", "level ban: test", 1500);
    const reviewed = await account(w.sql, "email", "reviewed@example.com");
    await setCase(w.sql, reviewed.id, "review", "reports", "three reports", 1500);
    for (const email of ["pooled@example.com", "reviewed@example.com"]) {
      const b = browser(w);
      const signed = await b.emailSignIn(email);
      expect([signed.status, signed.banHeader]).toEqual([200, null]);
      for (const path of ["/api/me", "/api/live", "/api/shop"]) expect((await b.call(path)).status).toBe(200);
      expect(b.jar.has("hc_banned")).toBe(false);
    }
    expect((await caseOf(w.sql, pooled.id))?.status).toBe("pool");
    const guest = browser(w);
    for (const path of ["/api/me", "/api/live", "/api/status"]) expect((await guest.call(path)).status).toBe(200);
    // A mark that names no banned account (made up, or an account never banned): taken away, nothing refused.
    guest.jar.set("hc_banned", pooled.id);
    expect((await guest.call("/api/me")).status).toBe(200);
    expect(guest.jar.has("hc_banned")).toBe(false);
  });

  it("a banned test account's sign-in (the scripts' way in) is refused too", async () => {
    const w = await setUp();
    const env = { ...w.env, E2E_SQL: "e2e-key-0123456789abcdef-0123456789abcdef" };
    const post = (name: string) =>
      worker.fetch(new Request(`${origin}/api/admin/test-accounts`, { method: "POST", headers: { "content-type": "application/json", "x-e2e-sql": env.E2E_SQL }, body: JSON.stringify({ name }) }), env as never, ctx);
    const made = await post("Eddie");
    expect(made.status).toBe(200);
    const { id } = (await made.json()) as { id: string };
    await setCase(w.sql, id, "banned", "admin:eric@example.com", "engine moves", Date.now());
    const before = await sessionsOf(w.sql, id);
    const refused = await post("Eddie");
    expect([refused.status, refused.headers.get("x-hc-banned"), await refused.json()]).toEqual([403, "1", { banned: true, message: BANNED_LINE }]);
    expect(await sessionsOf(w.sql, id)).toBe(before);
  });
});
