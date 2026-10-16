import { describe, expect, it } from "vitest";
import { AGE_GATE, TOO_YOUNG_LINE } from "@chessroyale/core";
import { ensureSchema, signInWithIdentity, startEmailCode } from "../src/accounts.ts";
import { handleAccountApi } from "../src/api.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * The age gate on the server (docs/decisions/2026-10-16-age-gate-and-real-money.md): every sign-in needs this device's
 * "old enough" answer first, a "too young" device can't sign in or change its name at all, and nothing but the answer
 * (and, on an account, when its holder gave it) is ever kept.
 */

const origin = "https://hunchess.com";

/** A fresh database and the Worker's environment over it: email and Google sign-in set up. */
async function setUp() {
  const { db, sql, d1 } = memoryDb();
  await ensureSchema(sql, d1);
  const sent: { to: string; code: string }[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    if (url.startsWith("https://api.resend.com")) {
      const b = JSON.parse(String(init.body)) as { to: string[]; subject: string };
      sent.push({ to: b.to[0]!, code: /(\d{6}) is your/.exec(b.subject)![1]! });
      return new Response("{}");
    }
    // Google's token endpoint: an ID token for one Google account.
    const claims = btoa(JSON.stringify({ sub: "g-kid", aud: "cid", email: "kid@gmail.com", email_verified: true }));
    return new Response(JSON.stringify({ id_token: `x.${claims}.y` }));
  }) as unknown as typeof fetch;
  const env = { DB: d1, RESEND_API_KEY: "re_test", GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "secret" };
  /** Every row of every table, to see what a request wrote. */
  const dump = () => {
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[]).map((t) => t.name);
    return Object.fromEntries(tables.map((t) => [t, db.prepare(`SELECT * FROM ${t}`).all()]));
  };
  return { db, sql, env, fetcher, sent, dump };
}

/** A browser on one device: its cookies kept between requests (Max-Age=0 removes one), as a phone keeps them. */
function phone({ env, fetcher }: { env: object; fetcher: typeof fetch }) {
  const jar = new Map<string, string>();
  const setCookies: string[] = [];
  const call = async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (jar.size) headers.set("cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "));
    const res = (await handleAccountApi(new Request(origin + path, { ...init, headers }), env as never, fetcher))!;
    for (const c of res.headers.getSetCookie()) {
      setCookies.push(c);
      const [pair, ...attrs] = c.split(";");
      const [k, v] = pair!.split("=") as [string, string];
      if (attrs.some((a) => a.trim().toLowerCase() === "max-age=0")) jar.delete(k);
      else jar.set(k, v);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = res.status === 302 ? null : await res.json().catch(() => null);
    return { res, body };
  };
  const post = (path: string, body: unknown) => call(path, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
  /** The age question's answer, as the app sends it: only whether they're old enough. */
  const answer = (oldEnough: boolean, extra: object = {}) => post("/api/auth/age", { oldEnough, ...extra });
  return { jar, setCookies, call, post, answer };
}

/** The Set-Cookie line for the age cookie in a response. */
const ageCookie = (res: Response) => res.headers.getSetCookie().find((c) => c.startsWith("hc_age="));

describe("the age gate: old enough", () => {
  it("every sign-in asks first; the answer lets this device sign in once, and the account keeps when, nothing else", async () => {
    const s = await setUp();
    const p = phone(s);
    await p.call("/api/me");
    expect((await p.call("/api/auth/config")).body.age).toBeUndefined();
    // Not answered: no email is taken, Google sends you back to the page (which asks).
    const unasked = await p.post("/api/auth/email/start", { email: "ann@example.com" });
    expect([unasked.res.status, unasked.body.askAge]).toEqual([403, true]);
    expect((await p.post("/api/auth/email/verify", { email: "ann@example.com", code: "123456" })).res.status).toBe(403);
    const google = await p.call("/api/auth/google/start?next=/settings");
    expect(google.res.headers.get("location")).toBe(`${origin}/settings`);
    expect(s.sent).toEqual([]);

    const a = await p.answer(true);
    expect(a.body).toEqual({ age: "ok" });
    expect(ageCookie(a.res)).toBe(`hc_age=ok; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${AGE_GATE.answerMinutes * 60}`);
    expect((await p.call("/api/auth/config")).body.age).toBe("ok");
    const before = Date.now();
    expect((await p.post("/api/auth/email/start", { email: "ann@example.com" })).body).toEqual({ ok: true });
    const ok = await p.post("/api/auth/email/verify", { email: "ann@example.com", code: s.sent[0]!.code });
    expect(ok.body.user).toMatchObject({ signedIn: true, email: "ann@example.com" });
    const ann = s.db.prepare("SELECT age_ok_at FROM users WHERE email = 'ann@example.com'").get() as { age_ok_at: number };
    expect(ann.age_ok_at).toBeGreaterThanOrEqual(before);
    expect(ann.age_ok_at).toBeLessThanOrEqual(Date.now());
    // Used up by the sign-in: the next one on this device asks again.
    expect(p.jar.has("hc_age")).toBe(false);
    expect((await p.call("/api/auth/config")).body.age).toBeUndefined();
    await p.post("/api/auth/logout", {});
    expect((await p.post("/api/auth/email/start", { email: "ann@example.com" })).body.askAge).toBe(true);
    // Asked again and signed in again: the account keeps the first time.
    await p.answer(true);
    await s.sql.run("UPDATE email_codes SET sent_at = 0, hour_start = 0");
    await p.post("/api/auth/email/start", { email: "ann@example.com" });
    expect((await p.post("/api/auth/email/verify", { email: "ann@example.com", code: s.sent[1]!.code })).body.user.signedIn).toBe(true);
    expect(s.db.prepare("SELECT age_ok_at FROM users WHERE email = 'ann@example.com'").get()).toEqual(ann);
  });

  it("Google: start and the callback need the answer; the account made keeps when, and the answer is used up", async () => {
    const s = await setUp();
    const p = phone(s);
    await p.call("/api/me");
    await p.answer(true);
    const start = await p.call("/api/auth/google/start?next=/lobby/ABCDE");
    const state = new URL(start.res.headers.get("location")!).searchParams.get("state");
    expect(new URL(start.res.headers.get("location")!).origin).toBe("https://accounts.google.com");
    const cb = await p.call(`/api/auth/google/callback?state=${state}&code=c`);
    expect(cb.res.headers.get("location")).toBe(`${origin}/lobby/ABCDE?signin=google`);
    expect(s.db.prepare("SELECT google_sub, age_ok_at > 0 AS asked FROM users WHERE google_sub = 'g-kid'").get()).toEqual({ google_sub: "g-kid", asked: 1 });
    expect(p.jar.has("hc_age")).toBe(false);
    // The answer ran out on the way (or never was): the callback signs nobody in.
    const q = phone(s);
    await q.call("/api/me");
    await q.answer(true);
    const start2 = await q.call("/api/auth/google/start");
    const state2 = new URL(start2.res.headers.get("location")!).searchParams.get("state");
    q.jar.delete("hc_age");
    expect((await q.call(`/api/auth/google/callback?state=${state2}&code=c`)).res.headers.get("location")).toBe(`${origin}/?signin=failed`);
  });

  it("an account from before the gate is asked at its next sign-in, and keeps that time from then on", async () => {
    const s = await setUp();
    await signInWithIdentity(s.sql, null, "email", "old@example.com", {}, 1000);
    expect(s.db.prepare("SELECT age_ok_at FROM users WHERE email = 'old@example.com'").get()).toEqual({ age_ok_at: null });
    const p = phone(s);
    await p.call("/api/me");
    expect((await p.post("/api/auth/email/start", { email: "old@example.com" })).body.askAge).toBe(true);
    await p.answer(true);
    await p.post("/api/auth/email/start", { email: "old@example.com" });
    expect((await p.post("/api/auth/email/verify", { email: "old@example.com", code: s.sent[0]!.code })).body.user.email).toBe("old@example.com");
    expect((s.db.prepare("SELECT age_ok_at FROM users WHERE email = 'old@example.com'").get() as { age_ok_at: number }).age_ok_at).toBeGreaterThan(1000);
  });
});

describe("the age gate: too young", () => {
  it("this device can't sign in at all, by email or Google, and a later answer doesn't change that", async () => {
    const s = await setUp();
    const p = phone(s);
    await p.call("/api/me");
    const a = await p.answer(false);
    expect(a.body).toEqual({ age: "under" });
    expect(ageCookie(a.res)).toBe(`hc_age=under; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${AGE_GATE.tooYoungDays * 86_400}`);
    expect((await p.call("/api/auth/config")).body.age).toBe("under");
    // Back and answer again: still too young.
    expect((await p.answer(true)).body).toEqual({ age: "under" });
    expect(p.jar.get("hc_age")).toBe("under");
    // Email: refused before an email is taken or sent, and at the code too (a code started before the answer).
    const start = await p.post("/api/auth/email/start", { email: "kid@example.com" });
    expect([start.res.status, start.body]).toEqual([403, { message: TOO_YOUNG_LINE, tooYoung: true }]);
    expect(s.sent).toEqual([]);
    const code = await startEmailCode(s.sql, "kid@example.com", Date.now());
    const verify = await p.post("/api/auth/email/verify", { email: "kid@example.com", code: code.ok ? code.code : "" });
    expect([verify.res.status, verify.body.tooYoung]).toEqual([403, true]);
    // Google: back to the page at the start (no state, no trip to Google), and the callback refuses.
    const google = await p.call("/api/auth/google/start");
    expect(google.res.headers.get("location")).toBe(`${origin}/`);
    expect(p.jar.has("hc_oauth")).toBe(false);
    p.jar.set("hc_oauth", "forged");
    expect((await p.call("/api/auth/google/callback?state=forged&code=c")).res.headers.get("location")).toBe(`${origin}/?signin=failed`);
    // No account was made or given an identity.
    expect(s.db.prepare("SELECT COUNT(*) AS n FROM users WHERE email IS NOT NULL OR google_sub IS NOT NULL").get()).toEqual({ n: 0 });
    expect((await p.call("/api/me")).body.user.signedIn).toBe(false);
  });

  it("its guest goes back to the default name and icon, and keeps them", async () => {
    const s = await setUp();
    const p = phone(s);
    await p.call("/api/me?name=Sam%20Lee");
    await p.call("/api/me", { method: "PATCH", body: JSON.stringify({ icon: "🦁" }) });
    expect((await p.call("/api/me")).body.user).toMatchObject({ name: "Sam Lee", icon: "🦁" });
    await p.answer(false);
    expect((await p.call("/api/me")).body.user).toMatchObject({ name: "Player", icon: "♟" });
    const rename = await p.call("/api/me", { method: "PATCH", body: JSON.stringify({ name: "Sam Lee", icon: "🐉" }) });
    expect(rename.res.status).toBe(403);
    expect((await p.call("/api/me")).body.user).toMatchObject({ name: "Player", icon: "♟" });
    // A new guest on this device (its account deleted, say) starts under the default name too.
    p.jar.delete("hc_session");
    expect((await p.call("/api/me?name=Sam%20Lee")).body.user.name).toBe("Player");
  });
});

describe("the age gate: what's sent and kept", () => {
  it("the answer comes only from this site's page, as JSON, from a device with its guest account, and must be one", async () => {
    const s = await setUp();
    const p = phone(s);
    expect((await p.answer(true)).res.status).toBe(401); // (no account on this device yet)
    await p.call("/api/me");
    const send = (headers: Record<string, string>, body = JSON.stringify({ oldEnough: false })) => p.call("/api/auth/age", { method: "POST", headers, body });
    expect((await send({ "content-type": "application/json" })).res.status).toBe(403);
    expect((await send({ origin: "https://evil.example", "content-type": "application/json" })).res.status).toBe(403);
    expect((await send({ origin, "content-type": "text/plain" })).res.status).toBe(415);
    for (const body of [JSON.stringify({ oldEnough: "no" }), JSON.stringify({ month: 3, year: 2015 }), "{"]) {
      expect((await send({ origin, "content-type": "application/json" }, body)).res.status, body).toBe(400);
    }
    // None of those marked the device.
    expect(p.jar.has("hc_age")).toBe(false);
  });

  it("no birth date is stored: an answer writes nothing (too young: only the name and icon reset), and its cookie is the answer alone", async () => {
    const s = await setUp();
    const p = phone(s);
    await p.call("/api/me?name=Sam");
    // (Even if a birth date came along, it's ignored.)
    const before = s.dump();
    const ok = await p.answer(true, { month: 7, year: 1987, born: "1987-07" });
    expect(s.dump()).toEqual(before);
    expect(ageCookie(ok.res)?.split(";")[0]).toBe("hc_age=ok");
    const q = phone(s);
    const guest = (await q.call("/api/me?name=Kim")).body.user.id as string;
    const before2 = s.dump();
    const under = await q.answer(false, { month: 3, year: 2015, born: "2015-03" });
    expect(ageCookie(under.res)?.split(";")[0]).toBe("hc_age=under");
    const after = s.dump();
    const users = (rows: unknown[]) => (rows as { id: string }[]).map((u) => (u.id === guest ? { ...u, name: "Player", icon: "♟" } : u));
    expect({ ...after, users: users(after.users!) }).toEqual({ ...before2, users: users(before2.users!) });
    // Signing in keeps only when they said so: the users row's columns are pinned in account-data.test.ts.
    await p.post("/api/auth/email/start", { email: "ann@example.com" });
    await p.post("/api/auth/email/verify", { email: "ann@example.com", code: s.sent[0]!.code });
    const ann = s.db.prepare("SELECT * FROM users WHERE email = 'ann@example.com'").get() as Record<string, unknown>;
    expect(Object.keys(ann).filter((k) => k.startsWith("age"))).toEqual(["age_ok_at"]);
    expect(typeof ann.age_ok_at).toBe("number");
    // The age cookie was only ever the answer (or cleared when a sign-in used it up).
    const ageValues = new Set(p.setCookies.concat(q.setCookies).flatMap((c) => (c.startsWith("hc_age=") ? [c.split(";")[0]] : [])));
    expect([...ageValues].sort()).toEqual(["hc_age=", "hc_age=ok", "hc_age=under"]);
  });
});
