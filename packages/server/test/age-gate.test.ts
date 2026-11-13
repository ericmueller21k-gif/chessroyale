import { describe, expect, it } from "vitest";
import { AGE_GATE, AGE_STEP_LINE, TOO_YOUNG_LINE } from "@chessroyale/core";
import { ensureSchema, markAgeOk, signInWithIdentity, startEmailCode } from "../src/accounts.ts";
import { ageAnswer, handleAccountApi } from "../src/api.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * The age gate on the server (docs/decisions/2026-10-16-age-gate-and-real-money.md; since Nov 12,
 * docs/decisions/2026-11-12-signin-without-age.md): an account that has answered signs in with no question; no account is made,
 * and none that never answered signs in, without this device's "old enough" answer; a "too young" device can't sign in or
 * change its name at all; and nothing but the answer (and, on an account, when its holder gave it) is ever kept.
 */

const origin = "https://hunchess.com";

/** A fresh database and the Worker's environment over it: email and Google sign-in set up. */
async function setUp() {
  const { db, sql, d1 } = memoryDb();
  await ensureSchema(sql, d1);
  const sent: { to: string; code: string }[] = [];
  /** The Google account Google's page signs in as (a test changes it). */
  const google = { sub: "g-kid", email: "kid@gmail.com" };
  const fetcher = (async (url: string, init: RequestInit) => {
    if (url.startsWith("https://api.resend.com")) {
      const b = JSON.parse(String(init.body)) as { to: string[]; subject: string };
      sent.push({ to: b.to[0]!, code: /(\d{6}) is your/.exec(b.subject)![1]! });
      return new Response("{}");
    }
    // Google's token endpoint: an ID token for that Google account.
    const claims = btoa(JSON.stringify({ sub: google.sub, aud: "cid", email: google.email, email_verified: true }));
    return new Response(JSON.stringify({ id_token: `x.${claims}.y` }));
  }) as unknown as typeof fetch;
  const env = { DB: d1, RESEND_API_KEY: "re_test", GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "secret" };
  /** Every row of every table, to see what a request wrote. */
  const dump = () => {
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[]).map((t) => t.name);
    return Object.fromEntries(tables.map((t) => [t, db.prepare(`SELECT * FROM ${t}`).all()]));
  };
  return { db, sql, env, fetcher, sent, google, dump };
}
type World = Awaited<ReturnType<typeof setUp>>;

/** An account whose holder said they were old enough (on another device, earlier): its id and when. */
async function account(s: World, kind: "email" | "google", value: string) {
  const u = await signInWithIdentity(s.sql, null, kind, value, {}, 1000);
  await markAgeOk(s.sql, u.id, 2000);
  return { id: u.id, answeredAt: 2000 };
}

/**
 * "Continue with Google" on `p`: the start, Google's page (the account it signs in as: s.google), and its callback. `between` runs
 * before the callback (an answer running out); `seen` gets the callback's address. Answers where the callback sends the page.
 */
async function google(p: ReturnType<typeof phone>, next: string, between: () => unknown = () => undefined, seen: (url: string) => unknown = () => undefined) {
  const start = await p.call(`/api/auth/google/start?next=${encodeURIComponent(next)}`);
  const to = new URL(start.res.headers.get("location")!);
  if (to.origin !== "https://accounts.google.com") return to.toString();
  await between();
  const back = `/api/auth/google/callback?state=${to.searchParams.get("state")}&code=c`;
  seen(back);
  return (await p.call(back)).res.headers.get("location");
}

/** Every table but a code's try count, which a check counts whatever it finds. */
const withoutTries = (dump: Record<string, unknown[]>) => ({ ...dump, email_codes: (dump.email_codes as { attempts: number }[]).map(({ attempts: _n, ...row }) => row) });

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

describe("the age gate: Sign up (the answer first)", () => {
  it("the answer lets this device make an account; it keeps when its holder said so, nothing else; then it signs in with no question", async () => {
    const s = await setUp();
    const p = phone(s);
    await p.call("/api/me");
    expect((await p.call("/api/auth/config")).body.age).toBeUndefined();
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
    // Used up by the sign-in.
    expect(p.jar.has("hc_age")).toBe(false);
    expect((await p.call("/api/auth/config")).body.age).toBeUndefined();
    // Signed out, the account signs in again with no question (Eric, Nov 12), keeps the first time, and no age cookie is set.
    const ageCookies = p.setCookies.filter((c) => c.startsWith("hc_age=")).length;
    await p.post("/api/auth/logout", {});
    await s.sql.run("UPDATE email_codes SET sent_at = 0, hour_start = 0");
    expect((await p.post("/api/auth/email/start", { email: "ann@example.com" })).body).toEqual({ ok: true });
    expect((await p.post("/api/auth/email/verify", { email: "ann@example.com", code: s.sent[1]!.code })).body.user.signedIn).toBe(true);
    expect(s.db.prepare("SELECT age_ok_at FROM users WHERE email = 'ann@example.com'").get()).toEqual(ann);
    expect(p.setCookies.filter((c) => c.startsWith("hc_age=")).length).toBe(ageCookies);
  });

  it("Google: the account made keeps when, and the answer is used up; an answer gone on the way asks (an unknown account) or doesn't (a known one)", async () => {
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
    // The answer ran out on the way: an unknown Google account is asked first (nothing made), a known one that answered signs in.
    s.google.sub = "g-new";
    const q = phone(s);
    await q.call("/api/me");
    await q.answer(true);
    const back = await google(q, "/settings", () => q.jar.delete("hc_age"));
    expect(back).toBe(`${origin}/settings?signin=age-google`);
    expect(s.db.prepare("SELECT COUNT(*) AS n FROM users WHERE google_sub = 'g-new'").get()).toEqual({ n: 0 });
    s.google.sub = "g-kid";
    await q.answer(true);
    expect(await google(q, "/", () => q.jar.delete("hc_age"))).toBe(`${origin}/?signin=google`);
    expect((await q.call("/api/me")).body.user).toMatchObject({ signedIn: true, google: true });
  });

  it("a sign-in that starts gives an answer its time again, so it can't run out between the start and the end; no answer, no cookie", async () => {
    const s = await setUp();
    const p = phone(s);
    await p.call("/api/me");
    await p.answer(true);
    const fresh = `hc_age=ok; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${AGE_GATE.answerMinutes * 60}`;
    // An emailed code: the start gives the answer another AGE_GATE.answerMinutes (a code lasts 10).
    const start = await p.post("/api/auth/email/start", { email: "ann@example.com" });
    expect(ageCookie(start.res)).toBe(fresh);
    // A refused start gives nothing.
    expect(ageCookie((await p.post("/api/auth/email/start", { email: "nope" })).res)).toBeUndefined();
    // Google: the trip there does too (its state cookie lasts 10 minutes).
    const google = await p.call("/api/auth/google/start");
    expect(new URL(google.res.headers.get("location")!).origin).toBe("https://accounts.google.com");
    expect(ageCookie(google.res)).toBe(fresh);
    // A device that hasn't answered starts a sign-in with no age cookie at all (it isn't given an answer it never gave).
    const q = phone(s);
    await q.call("/api/me");
    expect(ageCookie((await q.post("/api/auth/email/start", { email: "bob@example.com" })).res)).toBeUndefined();
    const g = await q.call("/api/auth/google/start");
    expect(new URL(g.res.headers.get("location")!).origin).toBe("https://accounts.google.com");
    expect(ageCookie(g.res)).toBeUndefined();
  });
});

describe("the age gate: Sign in without the question (Eric, Nov 12)", () => {
  it("known and answered, by email: a fresh device signs in with no question, its guest's progress moves, and nothing about its age changes", async () => {
    const s = await setUp();
    const ann = await account(s, "email", "ann@example.com");
    const p = phone(s);
    const guest = (await p.call("/api/me")).body.user.id as string;
    await s.sql.run("INSERT INTO results (id, user_id, mode, online, placement, players, played_at) VALUES (77, ?, 'classic', 0, 3, 100, 1)", guest);
    expect((await p.post("/api/auth/email/start", { email: "ann@example.com" })).body).toEqual({ ok: true });
    const ok = await p.post("/api/auth/email/verify", { email: "ann@example.com", code: s.sent[0]!.code });
    expect(ok.body.user).toMatchObject({ id: ann.id, signedIn: true, email: "ann@example.com" });
    expect(s.db.prepare("SELECT user_id FROM results WHERE id = 77").get()).toEqual({ user_id: ann.id });
    expect(s.db.prepare("SELECT age_ok_at FROM users WHERE id = ?").get(ann.id)).toEqual({ age_ok_at: ann.answeredAt });
    expect(p.setCookies.some((c) => c.startsWith("hc_age="))).toBe(false);
    // The code is used up: it doesn't sign in twice.
    expect((await p.post("/api/auth/email/verify", { email: "ann@example.com", code: s.sent[0]!.code })).res.status).toBe(400);
  });

  it("known and answered, by Google: a fresh device signs in with one trip and no question", async () => {
    const s = await setUp();
    const kid = await account(s, "google", "g-kid");
    const p = phone(s);
    await p.call("/api/me");
    expect(await google(p, "/profile")).toBe(`${origin}/profile?signin=google`);
    expect((await p.call("/api/me")).body.user).toMatchObject({ id: kid.id, signedIn: true });
    expect(p.setCookies.some((c) => c.startsWith("hc_age="))).toBe(false);
    expect(s.db.prepare("SELECT age_ok_at FROM users WHERE id = ?").get(kid.id)).toEqual({ age_ok_at: kid.answeredAt });
  });

  it("an account from before the question, by email: asked once, at that sign-in; the same code finishes it; then never again", async () => {
    const s = await setUp();
    await signInWithIdentity(s.sql, null, "email", "old@example.com", {}, 1000);
    expect(s.db.prepare("SELECT age_ok_at FROM users WHERE email = 'old@example.com'").get()).toEqual({ age_ok_at: null });
    const p = phone(s);
    const guest = (await p.call("/api/me")).body.user.id as string;
    await p.post("/api/auth/email/start", { email: "old@example.com" });
    const before = s.dump();
    const asked = await p.post("/api/auth/email/verify", { email: "old@example.com", code: s.sent[0]!.code });
    expect([asked.res.status, asked.body]).toEqual([403, { message: AGE_STEP_LINE, askAge: true }]);
    // Nothing signed in, moved or written (but the try the check counted).
    expect(asked.res.headers.getSetCookie()).toEqual([]);
    expect((await p.call("/api/me")).body.user).toMatchObject({ id: guest, signedIn: false });
    expect(withoutTries(s.dump())).toEqual(withoutTries(before));
    // Answered: the same code finishes it.
    await p.answer(true);
    expect((await p.post("/api/auth/email/verify", { email: "old@example.com", code: s.sent[0]!.code })).body.user.email).toBe("old@example.com");
    expect((s.db.prepare("SELECT age_ok_at FROM users WHERE email = 'old@example.com'").get() as { age_ok_at: number }).age_ok_at).toBeGreaterThan(1000);
    expect(p.jar.has("hc_age")).toBe(false);
    // A fresh device: no question.
    const q = phone(s);
    await q.call("/api/me");
    await s.sql.run("UPDATE email_codes SET sent_at = 0, hour_start = 0");
    await q.post("/api/auth/email/start", { email: "old@example.com" });
    expect((await q.post("/api/auth/email/verify", { email: "old@example.com", code: s.sent[1]!.code })).body.user.signedIn).toBe(true);
  });

  it("an account from before the question, by Google: asked when it comes back; one more pick of the account finishes it", async () => {
    const s = await setUp();
    const old = await signInWithIdentity(s.sql, null, "google", "g-kid", {}, 1000);
    const p = phone(s);
    const guest = (await p.call("/api/me")).body.user.id as string;
    const before = s.dump();
    expect(await google(p, "/settings")).toBe(`${origin}/settings?signin=age-google`);
    expect(s.dump()).toEqual(before);
    expect((await p.call("/api/me")).body.user).toMatchObject({ id: guest, signedIn: false });
    await p.answer(true);
    expect(await google(p, "/settings")).toBe(`${origin}/settings?signin=google`);
    expect((await p.call("/api/me")).body.user).toMatchObject({ id: old.id, signedIn: true });
    expect((s.db.prepare("SELECT age_ok_at FROM users WHERE id = ?").get(old.id) as { age_ok_at: number }).age_ok_at).toBeGreaterThan(1000);
  });

  it("an email with no account: asked before anything is made; the same code makes it; too young instead makes nothing", async () => {
    const s = await setUp();
    const p = phone(s);
    const guest = (await p.call("/api/me")).body.user.id as string;
    await p.post("/api/auth/email/start", { email: "new@example.com" });
    const before = s.dump();
    const asked = await p.post("/api/auth/email/verify", { email: "new@example.com", code: s.sent[0]!.code });
    expect([asked.res.status, asked.body]).toEqual([403, { message: AGE_STEP_LINE, askAge: true }]);
    expect(withoutTries(s.dump())).toEqual(withoutTries(before));
    expect(s.db.prepare("SELECT COUNT(*) AS n FROM users WHERE email IS NOT NULL OR google_sub IS NOT NULL").get()).toEqual({ n: 0 });
    // Old enough: the same code, and the guest becomes the account, keeping when.
    await p.answer(true);
    const done = await p.post("/api/auth/email/verify", { email: "new@example.com", code: s.sent[0]!.code });
    expect(done.body.user).toMatchObject({ id: guest, signedIn: true, email: "new@example.com" });
    expect((s.db.prepare("SELECT age_ok_at FROM users WHERE id = ?").get(guest) as { age_ok_at: number | null }).age_ok_at).not.toBeNull();

    // Too young instead: refused with the code in hand, nothing made, and this device can't sign in to anything after.
    const q = phone(s);
    await q.call("/api/me");
    await q.post("/api/auth/email/start", { email: "kid@example.com" });
    expect((await q.post("/api/auth/email/verify", { email: "kid@example.com", code: s.sent[1]!.code })).body.askAge).toBe(true);
    await q.answer(false);
    const refused = await q.post("/api/auth/email/verify", { email: "kid@example.com", code: s.sent[1]!.code });
    expect([refused.res.status, refused.body.tooYoung]).toEqual([403, true]);
    expect(s.db.prepare("SELECT COUNT(*) AS n FROM users WHERE email = 'kid@example.com'").get()).toEqual({ n: 0 });
    expect((await q.post("/api/auth/email/start", { email: "new@example.com" })).body.tooYoung).toBe(true);
  });

  it("a Google account with no account: asked, with nothing made or kept (not even who it is); one more pick of the account makes it", async () => {
    const s = await setUp();
    const p = phone(s);
    const guest = (await p.call("/api/me")).body.user.id as string;
    const before = s.dump();
    expect(await google(p, "/")).toBe(`${origin}/?signin=age-google`);
    expect(s.dump()).toEqual(before);
    // This trip's state is spent (and nothing about the Google account is in a cookie).
    expect(p.jar.has("hc_oauth")).toBe(false);
    expect(p.jar.has("hc_next")).toBe(false);
    expect([...p.jar.values()].join(" ")).not.toMatch(/g-kid|kid@gmail/);
    await p.answer(true);
    expect(await google(p, "/")).toBe(`${origin}/?signin=google`);
    expect((await p.call("/api/me")).body.user).toMatchObject({ id: guest, signedIn: true, google: true, email: "kid@gmail.com" });
    expect((s.db.prepare("SELECT age_ok_at FROM users WHERE id = ?").get(guest) as { age_ok_at: number | null }).age_ok_at).not.toBeNull();
  });

  it("a new identity for a signed-in account that has answered joins it with no question; one that hasn't is asked", async () => {
    const s = await setUp();
    s.google.email = ""; // (a Google account that brings no email, so the account has none to start with)
    await account(s, "google", "g-kid");
    const p = phone(s);
    await p.call("/api/me");
    await google(p, "/");
    await p.post("/api/auth/email/start", { email: "kid@example.com" });
    expect((await p.post("/api/auth/email/verify", { email: "kid@example.com", code: s.sent[0]!.code })).body.user).toMatchObject({ google: true, email: "kid@example.com" });
    // (An account from before the question can't add one without the answer.)
    await signInWithIdentity(s.sql, null, "google", "g-old", {}, 1000);
    s.google.sub = "g-old";
    const q = phone(s);
    await q.call("/api/me");
    await q.answer(true);
    await google(q, "/");
    await q.post("/api/auth/email/start", { email: "old@example.com" });
    expect((await q.post("/api/auth/email/verify", { email: "old@example.com", code: s.sent[1]!.code })).body.user.email).toBe("old@example.com");
    await s.sql.run("UPDATE users SET age_ok_at = NULL WHERE google_sub = 'g-old'");
    await s.sql.run("UPDATE users SET email = NULL WHERE google_sub = 'g-old'");
    await s.sql.run("UPDATE email_codes SET sent_at = 0, hour_start = 0");
    await q.post("/api/auth/email/start", { email: "old@example.com" });
    expect((await q.post("/api/auth/email/verify", { email: "old@example.com", code: s.sent[2]!.code })).body.askAge).toBe(true);
  });

  it("a code kept for the question is still the code: one finish, its tries, its 10 minutes; and a wrong code says the same, known or not", async () => {
    const s = await setUp();
    await account(s, "email", "ann@example.com");
    const p = phone(s);
    await p.call("/api/me");
    const wrong = (code: string) => (code === "000000" ? "111111" : "000000");
    // A wrong code: the same answer for an account that answered and for an email with no account.
    await p.post("/api/auth/email/start", { email: "ann@example.com" });
    await p.post("/api/auth/email/start", { email: "new@example.com" });
    const known = await p.post("/api/auth/email/verify", { email: "ann@example.com", code: wrong(s.sent[0]!.code) });
    const unknown = await p.post("/api/auth/email/verify", { email: "new@example.com", code: wrong(s.sent[1]!.code) });
    expect([unknown.res.status, unknown.body]).toEqual([known.res.status, known.body]);
    expect(known.res.status).toBe(400);
    // Kept for the question, the code still counts its tries: 5 in all.
    const code = s.sent[1]!.code;
    for (let i = 0; i < 4; i++) expect((await p.post("/api/auth/email/verify", { email: "new@example.com", code })).body.askAge).toBe(true);
    await p.answer(true);
    expect((await p.post("/api/auth/email/verify", { email: "new@example.com", code })).res.status).toBe(400);
    // And its 10 minutes: past them, the answer can't finish it.
    const q = phone(s);
    await q.call("/api/me");
    await q.post("/api/auth/email/start", { email: "late@example.com" });
    expect((await q.post("/api/auth/email/verify", { email: "late@example.com", code: s.sent[2]!.code })).body.askAge).toBe(true);
    await s.sql.run("UPDATE email_codes SET expires_at = ? WHERE email = 'late@example.com'", Date.now() - 1);
    await q.answer(true);
    expect((await q.post("/api/auth/email/verify", { email: "late@example.com", code: s.sent[2]!.code })).res.status).toBe(400);
    expect(s.db.prepare("SELECT COUNT(*) AS n FROM users WHERE email IN ('new@example.com', 'late@example.com')").get()).toEqual({ n: 0 });
  });
});

describe("the age gate: between steps, two tabs, a replayed callback", () => {
  it("an answer that runs out between the code and its check: an email with no account is asked again, and the same code finishes it", async () => {
    const s = await setUp();
    const p = phone(s);
    await p.call("/api/me");
    await p.answer(true);
    await p.post("/api/auth/email/start", { email: "new@example.com" });
    p.jar.delete("hc_age"); // (its minutes are up)
    expect((await p.post("/api/auth/email/verify", { email: "new@example.com", code: s.sent[0]!.code })).body).toEqual({ message: AGE_STEP_LINE, askAge: true });
    await p.answer(true);
    expect((await p.post("/api/auth/email/verify", { email: "new@example.com", code: s.sent[0]!.code })).body.user.signedIn).toBe(true);
  });

  it("two tabs: one's sign-in uses up the answer the other gave, so the other is asked; two finishes at once sign in once", async () => {
    const s = await setUp();
    await account(s, "email", "ann@example.com");
    const p = phone(s);
    await p.call("/api/me");
    // Tab 1 answers to sign up; tab 2 signs in to an account that has answered, with the answer on the device: it's used up.
    await p.answer(true);
    await p.post("/api/auth/email/start", { email: "ann@example.com" });
    expect((await p.post("/api/auth/email/verify", { email: "ann@example.com", code: s.sent[0]!.code })).body.user.signedIn).toBe(true);
    expect(p.jar.has("hc_age")).toBe(false);
    await p.post("/api/auth/logout", {});
    await p.post("/api/auth/email/start", { email: "new@example.com" });
    expect((await p.post("/api/auth/email/verify", { email: "new@example.com", code: s.sent[1]!.code })).body.askAge).toBe(true);
    // Both tabs answer and finish at once with the same code: one account, one sign-in.
    await p.answer(true);
    const [a, b] = await Promise.all([1, 2].map(() => p.post("/api/auth/email/verify", { email: "new@example.com", code: s.sent[1]!.code })));
    expect([a!.res.status, b!.res.status].sort()).toEqual([200, 400]);
    expect(s.db.prepare("SELECT COUNT(*) AS n FROM users WHERE email = 'new@example.com'").get()).toEqual({ n: 1 });
  });

  it("a replayed callback signs nobody in: on another device (no state), or after the trip that asked (its state spent)", async () => {
    const s = await setUp();
    await account(s, "google", "g-kid");
    const p = phone(s);
    await p.call("/api/me");
    let url = "";
    await google(p, "/", () => undefined, (u) => (url = u));
    // Another device, the same callback address: no state cookie there.
    const q = phone(s);
    await q.call("/api/me");
    expect((await q.call(url)).res.headers.get("location")).toBe(`${origin}/?signin=failed`);
    expect((await q.call("/api/me")).body.user.signedIn).toBe(false);
    // The trip that asked: its state is spent, so the same address again fails.
    s.google.sub = "g-new";
    const r = phone(s);
    await r.call("/api/me");
    let asked = "";
    expect(await google(r, "/", () => undefined, (u) => (asked = u))).toBe(`${origin}/?signin=age-google`);
    expect((await r.call(asked)).res.headers.get("location")).toBe(`${origin}/?signin=failed`);
    expect(s.db.prepare("SELECT COUNT(*) AS n FROM users WHERE google_sub = 'g-new'").get()).toEqual({ n: 0 });
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
    expect(google.res.headers.get("location")).toBe(`${origin}/?signin=age`);
    expect(p.jar.has("hc_oauth")).toBe(false);
    p.jar.set("hc_oauth", "forged");
    expect((await p.call("/api/auth/google/callback?state=forged&code=c")).res.headers.get("location")).toBe(`${origin}/?signin=failed`);
    // No account was made or given an identity.
    expect(s.db.prepare("SELECT COUNT(*) AS n FROM users WHERE email IS NOT NULL OR google_sub IS NOT NULL").get()).toEqual({ n: 0 });
    expect((await p.call("/api/me")).body.user.signedIn).toBe(false);
  });

  it("Sign in included: a known account that answered, one from before, or none, by email or Google, never signs in on that device", async () => {
    const s = await setUp();
    await account(s, "email", "ann@example.com");
    await account(s, "google", "g-kid");
    await signInWithIdentity(s.sql, null, "email", "old@example.com", {}, 1000);
    const p = phone(s);
    await p.call("/api/me");
    // A Google trip started before the answer (its state cookie kept), then "too young".
    const start = await p.call("/api/auth/google/start");
    const state = new URL(start.res.headers.get("location")!).searchParams.get("state");
    await p.answer(false);
    const before = s.dump();
    for (const email of ["ann@example.com", "old@example.com", "new@example.com"]) {
      const started = await p.post("/api/auth/email/start", { email });
      expect([started.res.status, started.body], email).toEqual([403, { message: TOO_YOUNG_LINE, tooYoung: true }]);
      // A code got some other way (another device) doesn't help either.
      const code = await startEmailCode(s.sql, email, Date.now());
      const verify = await p.post("/api/auth/email/verify", { email, code: code.ok ? code.code : "" });
      expect([verify.res.status, verify.body.tooYoung], email).toEqual([403, true]);
    }
    expect(s.sent).toEqual([]);
    for (const sub of ["g-kid", "g-new"]) {
      s.google.sub = sub;
      expect((await p.call("/api/auth/google/start")).res.headers.get("location"), sub).toBe(`${origin}/?signin=age`);
      expect((await p.call(`/api/auth/google/callback?state=${state}&code=c`)).res.headers.get("location"), sub).toBe(`${origin}/?signin=failed`);
    }
    expect((await p.call("/api/me")).body.user.signedIn).toBe(false);
    // Nothing moved or made (only those test codes, and no try was counted on them).
    expect({ ...s.dump(), email_codes: [] }).toEqual({ ...before, email_codes: [] });
    expect((s.db.prepare("SELECT MAX(attempts) AS n FROM email_codes").get() as { n: number }).n).toBe(0);
  });

  it("any hc_age=under in the request counts, wherever it sits (a second hc_age set by hand for another path can't hide it)", async () => {
    const at = (cookie: string) => new Request(`${origin}/api/auth/email/start`, { headers: { cookie } });
    expect(ageAnswer(at("hc_age=ok; hc_session=x; hc_age=under"))).toBe("under");
    expect(ageAnswer(at("hc_age=under; hc_age=ok"))).toBe("under");
    expect(ageAnswer(at("hc_session=x; hc_age=ok"))).toBe("ok");
    expect(ageAnswer(at("hc_age=yes; hc_ages=under"))).toBeNull();
    // And the server refuses the sign-in.
    const s = await setUp();
    const p = phone(s);
    await p.call("/api/me");
    await p.answer(false);
    // (The browser sends the more specific path's cookie first: "ok" before this device's "under".)
    const cookie = `hc_age=ok; ${[...p.jar].map(([k, v]) => `${k}=${v}`).join("; ")}`;
    expect(cookie).toMatch(/^hc_age=ok; .*hc_age=under/);
    const res = (await handleAccountApi(
      new Request(`${origin}/api/auth/email/start`, { method: "POST", headers: { origin, "content-type": "application/json", cookie }, body: JSON.stringify({ email: "kid@example.com" }) }),
      s.env as never,
      s.fetcher,
    ))!;
    expect([res.status, ((await res.json()) as { tooYoung?: boolean }).tooYoung]).toEqual([403, true]);
    expect(s.sent).toEqual([]);
  });

  it("someone already signed in on that device (a tab from before the answer) keeps their account as it is", async () => {
    const s = await setUp();
    const p = phone(s);
    await p.call("/api/me");
    await p.answer(true);
    await p.post("/api/auth/email/start", { email: "ann@example.com" });
    await p.post("/api/auth/email/verify", { email: "ann@example.com", code: s.sent[0]!.code });
    await p.call("/api/me", { method: "PATCH", body: JSON.stringify({ name: "Ann" }) });
    // Another tab still showing the question answers "too young".
    await p.answer(false);
    expect(p.jar.get("hc_age")).toBe("under");
    const me = (await p.call("/api/me")).body.user;
    expect(me).toMatchObject({ signedIn: true, name: "Ann" });
    expect((await p.call("/api/me", { method: "PATCH", body: JSON.stringify({ name: "Annie" }) })).body.user.name).toBe("Annie");
    // Signed out, the guest on this device is under the gate.
    await p.post("/api/auth/logout", {});
    expect((await p.call("/api/me", { method: "PATCH", body: JSON.stringify({ name: "Sam" }) })).res.status).toBe(403);
    expect((await p.post("/api/auth/email/start", { email: "ann@example.com" })).body.tooYoung).toBe(true);
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
  it("the answer comes only from this site's page, as JSON, and must be one; a device with no session yet may answer (a browser marked banned has none, and anyone else may sign in on it: ban-gate.ts)", async () => {
    const s = await setUp();
    const p = phone(s);
    expect((await p.answer(true)).res.status).toBe(200);
    p.jar.delete("hc_age");
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
