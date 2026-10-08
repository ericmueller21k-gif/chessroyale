import { describe, expect, it } from "vitest";
import { FAIRPLAY, type FairMove } from "@chessroyale/core";
import { createGuest, createSession, ensureSchema, publicProfile, recordResult, signInWithIdentity, type Sql, type User } from "../src/accounts.ts";
import { appeal, banCheck, caseOf, decide, decideAppeal, eligibleForRanked, fairStatus, normalizeEmail, recordFairPlay, setCase, type CaseMailer } from "../src/fairplay.ts";
import { caseEmail, caseMailer, fairplayFrom } from "../src/fairplay-mail.ts";
import { handleAdmin, isAdmin } from "../src/admin.ts";
import { forgetSecrets, handleAccountApi, withSecrets } from "../src/api.ts";
import { memoryDb } from "./memory-db.ts";

const DAY = 86_400_000;
const TOKEN = "test-review-token-0123456789";

async function player(sql: Sql, name: string, email = `${name.toLowerCase()}@example.com`, now = 1000): Promise<User> {
  const g = await createGuest(sql, now, name);
  return signInWithIdentity(sql, g.user, "email", email, {}, now);
}

/** Collects the emails a decision would send. */
function mailbox() {
  const sent: { to: string | null; kind: string; notice: string | null }[] = [];
  const mail: CaseMailer = async (u, kind, notice) => void sent.push({ to: u.email, kind, notice });
  return { sent, mail };
}

function picks(n: number): FairMove[] {
  return Array.from({ length: n }, (_, i) => ({ ply: 14 + 2 * i, fen: "8/8/8/8/8/8/8/K6k w - - 0 1", move: "a1a2", best: "a1a2", loss: 0, bestExp: 0.55, near: 2, gap: 3, crowd: 40, crowdFound: i % 4 === 0 ? 2 : 24, thinkMs: 3500, away: 0, legal: 3 }));
}

describe("bans", () => {
  it("a ban holds every online result, takes the rating away, shows Banned on the profile; a clearing gives them back", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const p = await player(sql, "Pat");
    await recordResult(sql, p.id, { mode: "crowd", online: true, placement: 1, players: 100, rating: 2600, ranked: true }, 10 * DAY);
    await recordResult(sql, p.id, { mode: "crowd", online: true, placement: 2, players: 100, rating: 2700, ranked: true }, 40 * DAY);
    const { sent, mail } = mailbox();
    expect(await decide(sql, p.id, "ban", "admin:eric@example.com", "engine moves, 2 matches", 41 * DAY, { mail })).toEqual({ ok: true, status: "banned" });
    expect(sent).toEqual([{ to: "pat@example.com", kind: "banned", notice: null }]);
    const prof = (await publicProfile(sql, p.id, 41 * DAY))!;
    expect(prof).toMatchObject({ banned: true, rating: null, topPercent: null, tier: null });
    expect((await sql.all<{ held: number }>("SELECT held FROM results WHERE user_id = ?", p.id)).map((r) => r.held)).toEqual([1, 1]);
    expect(await eligibleForRanked(sql, p.id)).toBe(false);
    expect(await fairStatus(sql, p.id)).toEqual({ banned: true, appeal: null });
    // Cleared (an appeal overturned): everything counts again, and an email says so.
    await decide(sql, p.id, "clear", "admin:eric@example.com", "appeal: a strong honest player", 42 * DAY, { mail });
    expect((await publicProfile(sql, p.id, 42 * DAY))!).toMatchObject({ banned: false, rating: 2700 });
    expect(sent[1]).toMatchObject({ kind: "cleared" });
  });

  it("a ban needs a reason and a real decision; clearing a watch nobody knew about sends no email", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const p = await player(sql, "Pat");
    expect(await decide(sql, p.id, "ban", "admin:e", "", 1000)).toMatchObject({ ok: false, status: 400 });
    expect(await decide(sql, p.id, "smite", "admin:e", "because", 1000)).toMatchObject({ ok: false, status: 400 });
    expect(await decide(sql, "nobody", "ban", "admin:e", "because", 1000)).toMatchObject({ ok: false, status: 404 });
    const { sent, mail } = mailbox();
    await setCase(sql, p.id, "watch", "detection", "a match scored 4", 1000);
    await decide(sql, p.id, "clear", "reviewer", "nothing unusual in the games", 2000, { mail });
    expect(sent).toEqual([]);
    await setCase(sql, p.id, "review", "reports", "3 reports", 3000);
    await decide(sql, p.id, "clear", "reviewer", "normal strength, normal timing", 4000, { mail });
    expect(sent.map((s) => s.kind)).toEqual(["cleared"]);
  });

  it("evasion: a new account with a banned account's email (Gmail dots and +tags too) is banned; one on its device goes to review", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    expect(normalizeEmail("A.B+chess@GMail.com")).toBe("ab@gmail.com");
    expect(normalizeEmail("a.b+x@example.com")).toBe("a.b@example.com");
    const cheat = await player(sql, "Cheat", "a.b@gmail.com");
    const device = "dev_0123456789abcdef";
    expect(await banCheck(sql, cheat, device, 1000)).toEqual({ banned: false });
    await decide(sql, cheat.id, "ban", "admin:e", "engine", 2000);
    expect(await banCheck(sql, cheat, device, 3000)).toEqual({ banned: true });
    // Same person, new address spelling: banned as evasion.
    const again = await player(sql, "Again", "ab+2@gmail.com");
    expect(await banCheck(sql, again, null, 4000)).toEqual({ banned: true });
    expect(await caseOf(sql, again.id)).toMatchObject({ status: "banned", decided_by: "evasion" });
    // Someone else on the banned account's device: review, not a ban (families share devices).
    const sibling = await player(sql, "Sibling", "sib@example.com");
    expect(await banCheck(sql, sibling, device, 5000)).toEqual({ banned: false });
    expect((await caseOf(sql, sibling.id))?.status).toBe("review");
    // Cleared bans free their identities (both accounts were banned with that address).
    await decide(sql, cheat.id, "clear", "admin:e", "appeal: it was a cousin", 6000);
    const third0 = await player(sql, "Third0", "a.b+4@gmail.com");
    expect(await banCheck(sql, third0, null, 6500)).toEqual({ banned: true });
    await decide(sql, again.id, "clear", "admin:e", "appeal: the cousin's account", 6600);
    await decide(sql, third0.id, "clear", "admin:e", "appeal: the cousin's account", 6700);
    const third = await player(sql, "Third", "a.b+3@gmail.com");
    expect(await banCheck(sql, third, null, 7000)).toEqual({ banned: false });
  });
});

describe("appeals", () => {
  it("only a banned player appeals, once at a time; a person upholds or overturns it, with a reply and an email", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const p = await player(sql, "Pat");
    expect(await appeal(sql, p.id, "I didn't cheat, honestly.", 1000)).toEqual({ ok: false, message: "Your account isn't banned." });
    await decide(sql, p.id, "ban", "admin:e", "engine", 2000);
    expect((await appeal(sql, p.id, "no", 3000)).ok).toBe(false);
    expect(await appeal(sql, p.id, "I didn't cheat, I'm a FIDE master.", 3000)).toEqual({ ok: true });
    expect((await appeal(sql, p.id, "Please look again at my games.", 3001)).ok).toBe(false);
    expect((await fairStatus(sql, p.id)).appeal).toMatchObject({ status: "open" });
    const id = (await sql.first<{ id: number }>("SELECT id FROM fairplay_appeals"))!.id;
    // The automated reviewer never decides appeals or bans.
    expect(await decide(sql, p.id, "clear", "reviewer", "looks fine", 4000)).toMatchObject({ ok: false, status: 409 });
    const { sent, mail } = mailbox();
    expect(await decideAppeal(sql, id, "upheld", "admin:e", "Your timing matched the engine's on every hard move.", 5000, mail)).toEqual({ ok: true });
    expect((await caseOf(sql, p.id))?.status).toBe("banned");
    expect(sent).toEqual([{ to: "pat@example.com", kind: "upheld", notice: "Your timing matched the engine's on every hard move." }]);
    expect((await fairStatus(sql, p.id)).appeal).toMatchObject({ status: "upheld", reply: expect.stringMatching(/timing/) });
    // A second appeal, overturned: cleared.
    await appeal(sql, p.id, "Here's a video of me playing that match.", 6000);
    const id2 = (await sql.first<{ id: number }>("SELECT id FROM fairplay_appeals WHERE status = 'open'"))!.id;
    await decideAppeal(sql, id2, "overturned", "admin:e", "Thanks for the video: you're cleared.", 7000, mail);
    expect((await caseOf(sql, p.id))?.status).toBe("cleared");
    expect(sent[1]).toMatchObject({ kind: "cleared" });
  });
});

describe("emails", () => {
  it("say what happened and how to appeal, from fairplay@ the sign-in emails' domain; nothing without a key or an address", async () => {
    expect(fairplayFrom({ EMAIL_FROM: "HunChess <login@hunchess.com>" })).toBe("HunChess <fairplay@hunchess.com>");
    expect(fairplayFrom({})).toBe("HunChess <fairplay@hunchess.com>");
    const ban = caseEmail({ name: "Pat" }, "banned", null);
    expect(ban.subject).toMatch(/can't play online/);
    expect(ban.text).toMatch(/appeal/);
    expect(ban.text).toMatch(/Solo games against bots are still open/);
    expect(caseEmail({ name: "Pat" }, "cleared", null).text).toMatch(/now count again/);
    expect(caseMailer({})).toBeUndefined();
    const calls: { url: string; body: { to: string[]; from: string } }[] = [];
    const fetcher = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return new Response("{}");
    }) as unknown as typeof fetch;
    const mail = caseMailer({ RESEND_API_KEY: "k" }, fetcher)!;
    await mail({ id: "u", name: "Pat", icon: "♟", email: "pat@example.com", google_sub: null, created_at: 0 }, "banned", null);
    await mail({ id: "g", name: "Guest", icon: "♟", email: null, google_sub: null, created_at: 0 }, "banned", null);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://api.resend.com/emails");
    expect(calls[0]!.body.to).toEqual(["pat@example.com"]);
  });
});

describe("the review page and the reviewer's API", () => {
  async function world() {
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql, d1);
    const eric = await player(sql, "Eric", "eric@example.com");
    const other = await player(sql, "Other", "other@example.com");
    const cheat = await player(sql, "Cheat", "cheat@example.com");
    await recordFairPlay(sql, cheat.id, { lobby: "AAAAA", mode: "crowd", moves: picks(20) }, Date.now() - 1000);
    const cookieOf = async (u: User) => `hc_session=${await createSession(sql, u.id, Date.now())}`;
    const env = { DB: d1, ADMIN_EMAILS: "Eric@Example.com, someone@else.com", FAIRPLAY_REVIEW_TOKEN: TOKEN };
    const call = (path: string, init: RequestInit & { cookie?: string; token?: string } = {}) =>
      handleAdmin(
        new Request(`https://hunchess.test${path}`, {
          ...init,
          headers: { ...(init.cookie ? { cookie: init.cookie } : {}), ...(init.token ? { authorization: `Bearer ${init.token}` } : {}), ...(init.headers ?? {}) },
        }),
        env,
      );
    return { sql, env, eric, other, cheat, ericCookie: await cookieOf(eric), otherCookie: await cookieOf(other), call };
  }

  it("admins only: the page is 'Not found' for anyone else; the API takes the reviewer's token or an admin", async () => {
    const w = await world();
    expect(isAdmin(w.env, w.eric)).toBe(true);
    expect(isAdmin(w.env, w.other)).toBe(false);
    expect(isAdmin({}, w.eric)).toBe(false);
    expect((await w.call("/admin/fairplay"))!.status).toBe(404);
    expect((await w.call("/admin/fairplay", { cookie: w.otherCookie }))!.status).toBe(404);
    const page = (await w.call("/admin/fairplay", { cookie: w.ericCookie }))!;
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("Cheat");
    expect((await w.call("/api/admin/fairplay/cases"))!.status).toBe(404);
    expect((await w.call("/api/admin/fairplay/cases", { token: "wrong-token-0123456789abc" }))!.status).toBe(404);
    expect((await w.call("/api/admin/fairplay/cases", { token: TOKEN }))!.status).toBe(200);
    expect((await w.call("/api/admin/fairplay/cases", { cookie: w.ericCookie }))!.status).toBe(200);
    // A token that's too short never works (an unset or careless secret).
    expect((await handleAdmin(new Request("https://hunchess.test/api/admin/fairplay/cases", { headers: { authorization: "Bearer short" } }), { ...w.env, FAIRPLAY_REVIEW_TOKEN: "short" }))!.status).toBe(404);
    // Not the admin's paths: not handled here.
    expect(await w.call("/admin/other")).toBeNull();
  });

  it("lists open cases with their evidence, serves one case's games, and logs each decision with who made it and why", async () => {
    const w = await world();
    const list = (await (await w.call("/api/admin/fairplay/cases", { token: TOKEN }))!.json()) as { cases: { userId: string; status: string; maxScore: number }[]; policy: { enforcement: string } };
    expect(list.cases.map((c) => c.userId)).toEqual([w.cheat.id]);
    expect(list.policy.enforcement).toBe(FAIRPLAY.enforcement);
    const detail = (await (await w.call(`/api/admin/fairplay/cases/${w.cheat.id}`, { token: TOKEN }))!.json()) as {
      player: { email: string | null };
      matches: { moves: { pick: string; counted: boolean; crowdRate: number | null; thinkS: number }[] }[];
    };
    expect(detail.player.email).toBeNull(); // (the reviewer doesn't need anyone's email)
    expect(detail.matches[0]!.moves[0]).toMatchObject({ pick: "Ka2", counted: true, crowdRate: 0.05, thinkS: 3.5 });
    const post = (body: unknown, auth: { token?: string; cookie?: string }) =>
      w.call(`/api/admin/fairplay/cases/${w.cheat.id}/decision`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" }, ...auth });
    expect((await post({ decision: "ban" }, { token: TOKEN }))!.status).toBe(400);
    const r = await post({ decision: "review", reason: "super-GM strength on 20 counted moves" }, { token: TOKEN });
    expect(await r!.json()).toEqual({ ok: true, status: "review", by: "reviewer" });
    await post({ decision: "ban", reason: "two matches at 3000+, flat 3-4 s timing" }, { cookie: w.ericCookie });
    const log = await w.sql.all<{ action: string; by: string; reason: string }>("SELECT action, by, reason FROM fairplay_log WHERE user_id = ? ORDER BY id", w.cheat.id);
    expect(log.slice(-2)).toEqual([
      { action: "review", by: "reviewer", reason: "super-GM strength on 20 counted moves" },
      { action: "banned", by: "admin:eric@example.com", reason: "two matches at 3000+, flat 3-4 s timing" },
    ]);
    // Now banned: the reviewer can't touch it.
    expect((await post({ decision: "clear", reason: "changed my mind" }, { token: TOKEN }))!.status).toBe(409);
  });

  it("the page's forms: a decision from this page only (its origin), then back to the case", async () => {
    const w = await world();
    const form = (fields: Record<string, string>, origin = "https://hunchess.test") =>
      w.call(`/admin/fairplay/case/${w.cheat.id}`, { method: "POST", body: new URLSearchParams(fields), cookie: w.ericCookie, headers: { origin, "content-type": "application/x-www-form-urlencoded" } });
    expect((await form({ action: "ban", reason: "engine" }, "https://evil.test"))!.status).toBe(403);
    const r = (await form({ action: "watch", reason: "keep an eye on the next matches" }))!;
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toContain(`/admin/fairplay/case/${w.cheat.id}?note=Done.`);
    expect((await caseOf(w.sql, w.cheat.id))?.status).toBe("watch");
    const page = await (await w.call(`/admin/fairplay/case/${w.cheat.id}`, { cookie: w.ericCookie }))!.text();
    expect(page).toContain("keep an eye on the next matches");
    expect(page).toContain("Ka2");
    expect(page).toContain("cheat@example.com");
    // Names are escaped.
    await w.sql.run("UPDATE users SET name = '<b>x</b>' WHERE id = ?", w.cheat.id);
    expect(await (await w.call(`/admin/fairplay/case/${w.cheat.id}`, { cookie: w.ericCookie }))!.text()).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});

describe("the review page's deep re-check button", () => {
  it("runs the deep re-check on that player's matches now, whatever the hour", async () => {
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql, d1);
    const eric = await player(sql, "Eric", "eric@example.com");
    const cheat = await player(sql, "Cheat", "cheat@example.com");
    await recordFairPlay(sql, cheat.id, { lobby: "AAAAA", mode: "crowd", moves: picks(12) }, Date.now() - 1000);
    const cookie = `hc_session=${await createSession(sql, eric.id, Date.now())}`;
    const searched: string[][] = [];
    const search = async (_fen: string, moves: readonly string[]) => (searched.push([...moves]), moves.map((m) => ({ move: m, expected: m === "a1a2" ? 0.6 : 0.5 })));
    const res = (await handleAdmin(
      new Request(`https://hunchess.test/admin/fairplay/case/${cheat.id}`, { method: "POST", body: new URLSearchParams({ action: "deep" }), headers: { cookie, origin: "https://hunchess.test", "content-type": "application/x-www-form-urlencoded" } }),
      { DB: d1, ADMIN_EMAILS: "eric@example.com" },
      undefined,
      undefined,
      search,
    ))!;
    expect(res.status).toBe(303);
    expect(decodeURIComponent(res.headers.get("location")!)).toContain("Deep re-check: 12 searches, 1 matches done.");
    expect(searched).toHaveLength(12);
  });
});

describe("admin settings kept in the Secrets Store", () => {
  it("ADMIN_EMAILS and FAIRPLAY_REVIEW_TOKEN work as Secrets Store bindings ({ get() }) as well as plain values", async () => {
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql, d1);
    const eric = await player(sql, "Eric", "eric@example.com");
    const cookie = `hc_session=${await createSession(sql, eric.id, Date.now())}`;
    const raw = { DB: d1, ADMIN_EMAILS: { get: async () => "eric@example.com" }, FAIRPLAY_REVIEW_TOKEN: { get: async () => TOKEN } };
    const page = (env: object) => handleAdmin(new Request("https://hunchess.test/admin/fairplay", { headers: { cookie } }), env as never);
    const api = (env: object) => handleAdmin(new Request("https://hunchess.test/api/admin/fairplay/cases", { headers: { authorization: `Bearer ${TOKEN}` } }), env as never);
    // Unread bindings never crash anything; they just don't count.
    expect((await page(raw))!.status).toBe(404);
    expect((await api(raw))!.status).toBe(404);
    // Read the way the Worker reads every request's environment: both work.
    forgetSecrets();
    const env = await withSecrets(raw);
    forgetSecrets();
    expect((await page(env))!.status).toBe(200);
    expect((await api(env))!.status).toBe(200);
  });
});

describe("the player's side of the API", () => {
  it("/api/me gives the device a marker; a banned account sees its status and appeals", async () => {
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql, d1);
    const env = { DB: d1 };
    const res = (await handleAccountApi(new Request("https://hunchess.test/api/me"), env))!;
    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith("hc_device="))).toBe(true);
    const session = cookies.find((c) => c.startsWith("hc_session="))!.split(";")[0]!;
    const again = (await handleAccountApi(new Request("https://hunchess.test/api/me", { headers: { cookie: `${session}; hc_device=abc` } }), env))!;
    expect(again.headers.getSetCookie().some((c) => c.startsWith("hc_device="))).toBe(false);
    const me = (await again.json()) as { user: { id: string } };
    await decide(sql, me.user.id, "ban", "admin:e", "engine", Date.now());
    const status = (await handleAccountApi(new Request("https://hunchess.test/api/fairplay/status", { headers: { cookie: session } }), env))!;
    expect(await status.json()).toEqual({ banned: true, appeal: null });
    const sent = (await handleAccountApi(
      new Request("https://hunchess.test/api/appeal", { method: "POST", headers: { cookie: session, "content-type": "application/json" }, body: JSON.stringify({ text: "I play at a club, I didn't cheat." }) }),
      env,
    ))!;
    expect(await sent.json()).toMatchObject({ ok: true, banned: true, appeal: { status: "open" } });
  });
});
