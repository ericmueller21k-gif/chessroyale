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
 * ban lands gets the ban answer on its next request, and is ended; the browser is marked, so every route answers the same to it until
 * the ban is lifted, sign-in included, whoever uses it (the whole device is banned: Eric, Nov 13); a lifted ban signs in as before; the
 * engine pool and guests pass as ever.
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
    // (JSON from this site's own page, as the app sends it: the sign-in routes check both.)
    if (init.json !== undefined) headers.set("content-type", "application/json");
    if (init.json !== undefined && !headers.has("origin")) headers.set("origin", origin);
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

/**
 * Routes a banned browser tries (a lobby link's and its WebSocket, the town's, the shop's, PLAY, signing out): each the ban answer.
 * The sign-in's own routes too: the whole device is banned (Eric, Nov 13). (Not the admin pages.)
 */
const ROUTES: [string, RequestInit & { json?: unknown }][] = [
  ["/api/me", {}],
  ["/api/status", {}],
  ["/api/live", {}],
  ["/api/shop", {}],
  ["/api/quests", {}],
  ["/api/lobby/ABCDE", {}],
  ["/api/lobby/ABCDE/ws", { headers: { upgrade: "websocket" } }],
  ["/api/friends", {}],
  ["/api/profile/someone", {}],
  ["/api/play", { method: "POST" }],
  ["/api/town/here", { json: { at: [1, 1] } }],
  ["/api/auth/logout", { method: "POST" }],
  ["/api/fairplay/status", {}],
  ["/api/auth/config", {}],
  ["/api/auth/age", { json: { oldEnough: true } }],
  ["/api/auth/email/start", { json: { email: "someone@example.com" } }],
  ["/api/auth/email/verify", { json: { email: "someone@example.com", code: "123456" } }],
  ["/api/auth/google/start?next=/", {}],
  ["/api/auth/google/callback?state=s&code=c", {}],
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
    // Google's verified email a banned account's address (a new Google account): ban evasion. Asked the age question first, as any new
    // account is (nothing made); then its own account is made, banned by evasion (a person can clear it), and the browser marked with it.
    const cleo = await account(w.sql, "email", "cleo@gmail.com");
    await setCase(w.sql, cleo.id, "banned", "admin:eric@example.com", "engine moves", 1600);
    Object.assign(w.google, { sub: "g-new-cleo", email: "c.l.e.o@gmail.com" });
    const c = browser(w);
    await c.call("/api/me");
    const made = await users(w.sql);
    expect(await c.googleSignIn()).toBe(`${origin}/town?signin=age-google`);
    expect(await users(w.sql)).toBe(made);
    expect(c.jar.has("hc_banned")).toBe(false);
    await c.call("/api/auth/age", { json: { oldEnough: true } });
    expect(await c.googleSignIn()).toBe(`${origin}/town?signin=banned`);
    const evader = await w.sql.first<{ id: string }>("SELECT id FROM users WHERE google_sub = ?", "g-new-cleo");
    expect(await caseOf(w.sql, evader!.id)).toMatchObject({ status: "banned", decided_by: "evasion" });
    expect(c.jar.get("hc_banned")).toBe(evader!.id);
    expect(await sessionsOf(w.sql, evader!.id)).toBe(0);
    // (Its guest, the one signing in, is ended; nothing joined it to the new account.)
    expect(c.jar.has("hc_session")).toBe(false);
  });

  it("ban evasion: an account with a banned account's identity is banned by evasion as it signs in; one new to us (a +tag, or the account deleted while banned) gets its own account, banned by evasion, which a person can clear", async () => {
    const w = await setUp();
    const cheat = await account(w.sql, "email", "a.b@gmail.com");
    // An alias made before the ban (making it runs no check): banned by evasion the moment it signs in.
    const alias = await account(w.sql, "email", "ab+chess@gmail.com");
    await setCase(w.sql, cheat.id, "banned", "admin:eric@example.com", "engine moves", 1500);
    const b = browser(w);
    isBanAnswer(await b.emailSignIn("ab+chess@gmail.com"));
    expect(await caseOf(w.sql, alias.id)).toMatchObject({ status: "banned", decided_by: "evasion" });
    expect(b.jar.get("hc_banned")).toBe(alias.id);
    // A new address that's the cheat's (Gmail's dots and a +tag): refused, with its own account made and banned by evasion (as PLAY's
    // check did, so a person can clear it: the review of #687, minor 4); the browser marked with that account, its guest ended.
    const c = browser(w);
    const made = await users(w.sql);
    isBanAnswer(await c.emailSignIn("a.b+2@gmail.com"));
    const evader = (await w.sql.first<{ id: string }>("SELECT id FROM users WHERE email = ?", "a.b+2@gmail.com"))!;
    expect(await caseOf(w.sql, evader.id)).toMatchObject({ status: "banned", decided_by: "evasion" });
    expect(await users(w.sql) - made).toBe(2); // (this browser's own guest, from its first request, and the new account)
    expect(c.jar.get("hc_banned")).toBe(evader.id);
    expect(await sessionsOf(w.sql, evader.id)).toBe(0);
    // The code is spent: it can't be refused again (and mark another browser).
    const again = browser(w);
    await again.call("/api/me");
    expect((await again.call("/api/auth/email/verify", { json: { email: "a.b+2@gmail.com", code: w.codes.get("a.b+2@gmail.com") } })).status).toBe(400);
    // A person clears it (an email to support: a cousin sharing the mailbox): the browser's mark goes, it signs in, and stays cleared.
    await decide(w.sql, evader.id, "clear", "admin:eric@example.com", "a cousin, not the cheat", Date.now());
    await w.sql.run("UPDATE email_codes SET sent_at = sent_at - 60000");
    const signed = await c.emailSignIn("a.b+2@gmail.com");
    expect([signed.status, (signed.body as { user: { id: string } }).user.id]).toEqual([200, evader.id]);
    expect(c.jar.has("hc_banned")).toBe(false);
    expect((await c.call("/api/live")).status).toBe(200);
    // Deleted while banned: its address comes back only as a new account banned by evasion.
    const dee = await account(w.sql, "email", "dee@example.com");
    await setCase(w.sql, dee.id, "banned", "admin:eric@example.com", "engine moves", 1700);
    await deleteAccount(w.sql, (await w.sql.first<User>("SELECT id, name, icon, email, google_sub, created_at FROM users WHERE id = ?", dee.id))!, 1800);
    const d = browser(w);
    isBanAnswer(await d.emailSignIn("dee@example.com"));
    const back = (await w.sql.first<{ id: string }>("SELECT id FROM users WHERE email = ?", "dee@example.com"))!;
    expect(await caseOf(w.sql, back.id)).toMatchObject({ status: "banned", decided_by: "evasion" });
    expect(d.jar.get("hc_banned")).toBe(back.id);
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

describe("the whole device is banned (Eric, Nov 13: \"If you get banned and your sister gets upset about it, so be it\")", () => {
  it("a family tablet marked by one banned account: nobody signs in on it, the sister included; a session of hers on it is ended; only the line", async () => {
    const w = await setUp();
    const bro = await account(w.sql, "email", "bro@example.com");
    const sis = await account(w.sql, "email", "sis@example.com");
    const tablet = browser(w);
    tablet.jar.set("hc_session", await createSession(w.sql, bro.id, Date.now()));
    expect((await tablet.call("/api/me")).status).toBe(200);
    await decide(w.sql, bro.id, "ban", "admin:eric@example.com", "engine moves", Date.now());
    isBanAnswer(await tablet.call("/api/live"));
    expect([tablet.jar.get("hc_banned"), tablet.jar.has("hc_session")]).toEqual([bro.id, false]);
    // Signed out, the tablet gets only the line (no guest made for it), the sign-in's own routes included.
    const made = await users(w.sql);
    isBanAnswer(await tablet.call("/api/me"));
    isBanAnswer(await tablet.call("/api/auth/config"));
    isBanAnswer(await tablet.call("/api/auth/google/start?next=/"));
    isBanAnswer(await tablet.call("/api/auth/age", { json: { oldEnough: true } }));
    // His sister tries her own account on it: the line, no code sent, no session, nothing made.
    isBanAnswer(await tablet.call("/api/auth/email/start", { json: { email: "sis@example.com" } }));
    expect(w.codes.has("sis@example.com")).toBe(false);
    isBanAnswer(await tablet.call("/api/auth/email/verify", { json: { email: "sis@example.com", code: "123456" } }));
    expect([await sessionsOf(w.sql, sis.id), await users(w.sql)]).toEqual([0, made]);
    // A session of hers on it (signed in before the ban, or brought some other way): the ban answer, and that session ended.
    tablet.jar.set("hc_session", await createSession(w.sql, sis.id, Date.now()));
    isBanAnswer(await tablet.call("/api/me"));
    expect([await sessionsOf(w.sql, sis.id), tablet.jar.has("hc_session"), tablet.jar.get("hc_banned")]).toEqual([0, false, bro.id]);
    // Her account isn't banned or opened as a case: on her own phone she plays as ever.
    expect(await caseOf(w.sql, sis.id)).toBeNull();
    const phone = browser(w);
    expect((await phone.emailSignIn("sis@example.com")).status).toBe(200);
    expect((await phone.call("/api/live")).status).toBe(200);
    // The admin pages aren't behind the gate (only admins see them: an admin's browser that met a ban can still lift it).
    const marked = browser(w);
    marked.jar.set("hc_banned", bro.id);
    const admin = await marked.call("/admin/fairplay");
    expect([admin.status, admin.banHeader]).toEqual([404, null]);
  });
});

describe("the review of #687's fixes", () => {
  it("the stale-token case: once a banned session's row is gone (ended by another instance's gate), this instance's presence cache can't serve the account (M2)", async () => {
    const w = await setUp();
    vi.useFakeTimers({ now: Date.UTC(2026, 10, 13, 12), toFake: ["Date"] });
    const pat = await account(w.sql, "email", "pat3@example.com");
    const token = await createSession(w.sql, pat.id, Date.now());
    const b = browser(w);
    b.jar.set("hc_session", token);
    expect((await b.call("/api/friends/online")).status).toBe(200);
    // Another instance bans Pat and its gate ends the session (this one hears of neither).
    await w.sql.run("INSERT INTO fairplay_cases (user_id, status, opened_at, updated_at) VALUES (?, 'banned', ?, ?)", pat.id, Date.now(), Date.now());
    await w.sql.run("DELETE FROM sessions WHERE token_hash = ?", await sha256(token));
    vi.setSystemTime(Date.now() + FAIRPLAY.banCheckMs + 1);
    const after = await b.call("/api/friends/online");
    expect([after.status, after.banHeader]).toEqual([401, null]);
    // (As a made-up token.)
    const c = browser(w);
    c.jar.set("hc_session", "e2enotarealtoken0123456789abcdefgh");
    expect((await c.call("/api/friends/online")).status).toBe(401);
  });

  it("a mark that no longer holds isn't taken away over a route's own ban answer: the browser stays marked (minor 1)", async () => {
    const w = await setUp();
    const old = await account(w.sql, "email", "old@example.com");
    const pat = await account(w.sql, "email", "pat5@example.com");
    await setCase(w.sql, pat.id, "banned", "admin:eric@example.com", "engine moves", 1500);
    const b = browser(w);
    await b.call("/api/me");
    await b.call("/api/auth/age", { json: { oldEnough: true } });
    expect((await b.call("/api/auth/email/start", { json: { email: "pat5@example.com" } })).status).toBe(200);
    b.jar.set("hc_banned", old.id);
    const refused = await b.call("/api/auth/email/verify", { json: { email: "pat5@example.com", code: w.codes.get("pat5@example.com") } });
    isBanAnswer(refused);
    expect(refused.res.headers.getSetCookie().filter((c) => c.startsWith("hc_banned="))).toEqual([expect.stringMatching(new RegExp(`^hc_banned=${pat.id};.*Max-Age=34560000`))]);
    expect(b.jar.get("hc_banned")).toBe(pat.id);
    isBanAnswer(await b.call("/api/me"));
  });

  it("the emailed code's routes take JSON from this site's own page only, and a refused code is spent (minor 2)", async () => {
    const w = await setUp();
    const cheat = await account(w.sql, "email", "cheat@example.com");
    await setCase(w.sql, cheat.id, "banned", "admin:eric@example.com", "engine moves", 1500);
    // (An account from before the age question: a code for it is kept while the device hasn't answered.)
    await w.sql.run("UPDATE users SET age_ok_at = NULL WHERE id = ?", cheat.id);
    const b = browser(w);
    await b.call("/api/me");
    const xsite = { origin: "https://evil.example", "content-type": "text/plain" };
    expect((await b.call("/api/auth/email/start", { method: "POST", headers: xsite, body: `{"email":"cheat@example.com"}` })).status).toBe(403);
    expect((await b.call("/api/auth/email/start", { method: "POST", headers: { origin, "content-type": "text/plain" }, body: `{"email":"cheat@example.com"}` })).status).toBe(415);
    expect(w.codes.has("cheat@example.com")).toBe(false);
    expect((await b.call("/api/auth/email/start", { json: { email: "cheat@example.com" } })).status).toBe(200);
    const body = JSON.stringify({ email: "cheat@example.com", code: w.codes.get("cheat@example.com") });
    for (const headers of [xsite, { origin, "content-type": "text/plain" }]) {
      const r = await b.call("/api/auth/email/verify", { method: "POST", headers, body });
      expect([r.status, r.banHeader, b.jar.has("hc_banned")]).toEqual([headers === xsite ? 403 : 415, null, false]);
    }
    // From the page: the ban answer (before the age question), and the code is spent, not kept.
    isBanAnswer(await b.call("/api/auth/email/verify", { json: JSON.parse(body) }));
    const other = browser(w);
    await other.call("/api/me");
    const again = await other.call("/api/auth/email/verify", { json: JSON.parse(body) });
    expect([again.status, other.jar.has("hc_banned")]).toEqual([400, false]);
  });
});
