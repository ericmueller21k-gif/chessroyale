import { describe, expect, it } from "vitest";
import { FRIEND_BOTS } from "@chessroyale/core";
import { createGuest, createSession, ensureSchema, publicProfile, signInWithIdentity, type Sql } from "../src/accounts.ts";
import { friendsOnline, friendsState, searchPlayers } from "../src/friends.ts";
import { FRIEND_BOT_PREFIX, botPresence, isFriendBot } from "../src/friend-bot-schedule.ts";
import { handleFriendBots } from "../src/friend-bots.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * Friend bots (Eric, Nov 20; docs/decisions/2026-11-20-friend-bots.md): an admin's own test accounts on their friends list, whose
 * presence is worked out from the time and their id. The schedule is the same every time it's asked and differs from bot to bot, with
 * sessions of 10 to 60 minutes, hours apart, more in the evening; only an admin (or the e2e's key) can add them; they're friends of
 * that admin only, and nobody else finds them.
 */

const T0 = Date.UTC(2026, 10, 16, 12);
const MIN = 60_000;
const HOUR = 60 * MIN;
const ADMINS = "boss@example.com, second@example.com";
const URL_ = "https://hunchess.test/api/admin/friend-bots";
const ORIGIN = { origin: "https://hunchess.test" };
const E2E_KEY = "k".repeat(40);
const IDS = Array.from({ length: 8 }, (_, i) => `${FRIEND_BOT_PREFIX}${(i * 7_919 + 4_242).toString(16).padStart(12, "0")}`);

/** A bot's week, a minute at a time from `from`: its sessions (start, end) and what it was doing. */
function week(id: string, from = T0) {
  const sessions: { start: number; end: number }[] = [];
  const doing = new Set<string>();
  let onMinutes = 0;
  for (let t = from; t < from + 7 * 24 * HOUR; t += MIN) {
    const p = botPresence(id, t);
    if (!p.online) continue;
    onMinutes++;
    doing.add(p.doing!);
    const last = sessions.at(-1);
    if (last && last.end === t) last.end = t + MIN;
    else sessions.push({ start: t, end: t + MIN });
  }
  return { sessions, doing, onMinutes };
}

describe("friend bots: the schedule", () => {
  it("is the same every time it's asked (no state: the time and the id)", () => {
    for (const id of IDS) for (let t = T0; t < T0 + 6 * HOUR; t += 7 * MIN) expect(botPresence(id, t)).toEqual(botPresence(id, t));
    expect(IDS.every(isFriendBot)).toBe(true);
    expect(isFriendBot("test-abc")).toBe(false);
  });

  it("each bot comes and goes: a few sessions a day, 10 to 60 minutes (overlaps aside), hours apart, doing varied things", () => {
    const weeks = IDS.map((id) => week(id));
    for (const w of weeks) {
      expect(w.sessions.length / 7).toBeGreaterThanOrEqual(1);
      expect(w.sessions.length / 7).toBeLessThanOrEqual(FRIEND_BOTS.perDay[1] + 1);
      const share = w.onMinutes / (7 * 24 * 60);
      expect(share).toBeGreaterThan(0.01);
      expect(share).toBeLessThan(0.25);
      // (Two sessions that overlap read as one longer one: a few may pass an hour.)
      const lengths = w.sessions.map((s) => (s.end - s.start) / MIN).sort((a, b) => a - b);
      expect(lengths[Math.floor(lengths.length / 2)]!).toBeGreaterThanOrEqual(FRIEND_BOTS.sessionMinutes[0]);
      expect(lengths[Math.floor(lengths.length / 2)]!).toBeLessThanOrEqual(FRIEND_BOTS.sessionMinutes[1]);
      // (The median gap between sessions is hours, not minutes.)
      const gaps = w.sessions.slice(1).map((s, i) => s.start - w.sessions[i]!.end).sort((a, b) => a - b);
      expect(gaps[Math.floor(gaps.length / 2)]!).toBeGreaterThan(HOUR);
      expect(w.doing.size).toBeGreaterThanOrEqual(5);
      expect([...w.doing].every((d) => ["home", "town", "queue", "crowd", "boss", "duel", "squads", "autochess"].includes(d))).toBe(true);
    }
    // (Not all alike: the bots' online minutes differ.)
    expect(new Set(weeks.map((w) => w.onMinutes)).size).toBeGreaterThan(4);
  });

  it("is busiest in the evening (US time) and quietest at night", () => {
    let evening = 0;
    let night = 0;
    for (const id of IDS)
      for (let t = T0; t < T0 + 14 * 24 * HOUR; t += 5 * MIN) {
        if (!botPresence(id, t).online) continue;
        // (Central time's hour: the bots' zones are UTC−5 to −8.)
        const h = new Date(t - 6 * HOUR).getUTCHours();
        if (h >= 18) evening++;
        if (h >= 1 && h < 7) night++;
      }
    expect(evening).toBeGreaterThan(night * 4);
  });

  it("in a match it shows busy; offline, when it was last on (a session's end)", () => {
    for (const id of IDS) {
      const { sessions } = week(id);
      expect(sessions.length).toBeGreaterThan(2);
      const s = sessions[1]!;
      // Offline (unless the next session already began): on until the very moment it says, and off from then to now.
      const at = s.end + 30 * MIN;
      const p = botPresence(id, at);
      if (!p.online) {
        expect(p.lastSeen).toBeLessThanOrEqual(at);
        expect(p.lastSeen).toBeGreaterThan(at - 24 * HOUR);
        expect(botPresence(id, p.lastSeen - 1).online).toBe(true);
        for (let t = p.lastSeen; t <= at; t += MIN) expect(botPresence(id, t).online).toBe(false);
      }
      for (let t = s.start; t < s.end; t += MIN) {
        const q = botPresence(id, t);
        expect(q.online).toBe(true);
        expect(q.busy).toBe(["crowd", "boss", "duel", "squads"].includes(q.doing!));
        expect(q.lastSeen).toBe(t);
      }
    }
  });
});

async function signedIn(sql: Sql, email: string) {
  const g = await createGuest(sql, T0 - 1000, "Someone");
  const u = await signInWithIdentity(sql, g.user, "email", email, {}, T0 - 1000);
  return { id: u.id, cookie: `hc_session=${await createSession(sql, u.id, T0 - 1000)}` };
}

async function world() {
  const { sql, d1 } = memoryDb();
  await ensureSchema(sql);
  const env = { DB: d1, ADMIN_EMAILS: ADMINS, E2E_SQL: E2E_KEY };
  const call = async (method: string, headers: Record<string, string> = {}, form?: string) =>
    (await handleFriendBots(
      new Request(URL_, { method, headers: { ...(form ? { "content-type": "application/x-www-form-urlencoded" } : {}), ...headers }, ...(form ? { body: form } : {}) }),
      env,
      { now: T0 },
    ))!;
  return { sql, call };
}

const friendIds = async (sql: Sql, id: string) => (await sql.all<{ friend_id: string }>("SELECT friend_id FROM friends WHERE user_id = ?", id)).map((r) => r.friend_id);

describe("friend bots: the route", () => {
  it("is Not found to anyone but an admin (or the e2e's key with a session), and a change only from the site itself", async () => {
    const { sql, call } = await world();
    const guest = await createGuest(sql, T0, "Guest");
    const player = await signedIn(sql, "player@example.com");
    const admin = await signedIn(sql, "boss@example.com");
    for (const headers of [{}, { cookie: `hc_session=${guest.token}` }, { cookie: player.cookie }, { "x-e2e-sql": E2E_KEY }] as Record<string, string>[])
      for (const method of ["GET", "POST", "DELETE"]) expect((await call(method, { ...headers, ...ORIGIN })).status).toBe(404);
    // (An admin's change from another site.)
    expect((await call("POST", { cookie: admin.cookie, origin: "https://evil.test" })).status).toBe(404);
    expect((await call("POST", { cookie: admin.cookie })).status).toBe(404);
    expect(await sql.all("SELECT id FROM users WHERE id LIKE 'fbot-%'")).toEqual([]);
    // (Not its path.)
    expect(await handleFriendBots(new Request("https://hunchess.test/api/admin/test-accounts"), { DB: memoryDb().d1 })).toBeNull();
  });

  it("an admin's Add makes FRIEND_BOTS.count bots, friends of that admin only, both ways; again, none new", async () => {
    const { sql, call } = await world();
    const admin = await signedIn(sql, "boss@example.com");
    const other = await signedIn(sql, "second@example.com");
    const player = await signedIn(sql, "player@example.com");
    const res = await call("POST", { cookie: admin.cookie, ...ORIGIN });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { added: number; bots: { id: string; name: string; online: boolean }[] };
    expect(body.added).toBe(FRIEND_BOTS.count);
    expect(body.bots).toHaveLength(FRIEND_BOTS.count);
    expect(new Set(body.bots.map((b) => b.name)).size).toBe(FRIEND_BOTS.count);
    const ids = body.bots.map((b) => b.id).sort();
    expect(ids.every(isFriendBot)).toBe(true);
    expect((await friendIds(sql, admin.id)).sort()).toEqual(ids);
    for (const id of ids) expect(await friendIds(sql, id)).toEqual([admin.id]);
    expect(await friendIds(sql, other.id)).toEqual([]);
    expect(await friendIds(sql, player.id)).toEqual([]);
    // (Test accounts: no email a person reads, never in the player search.)
    const rows = await sql.all<{ test: number; email: string }>("SELECT test, email FROM users WHERE id LIKE 'fbot-%'");
    expect(rows.every((r) => r.test === 1 && r.email.endsWith("@test.hunchess"))).toBe(true);
    for (const b of body.bots) expect(await searchPlayers(sql, player.id, b.name.slice(0, 4), true)).toEqual([]);

    expect(((await (await call("POST", { cookie: admin.cookie, ...ORIGIN })).json()) as { added: number }).added).toBe(0);
    expect(await friendIds(sql, admin.id)).toHaveLength(FRIEND_BOTS.count);

    // Another admin's are their own; Remove takes only the asker's.
    const theirs = (await (await call("POST", { cookie: other.cookie, ...ORIGIN })).json()) as { added: number; bots: { id: string }[] };
    expect(theirs.added).toBe(FRIEND_BOTS.count);
    expect(theirs.bots.some((b) => ids.includes(b.id))).toBe(false);
    expect((await friendIds(sql, admin.id)).sort()).toEqual(ids);
    expect(((await (await call("DELETE", { cookie: other.cookie, ...ORIGIN })).json()) as { removed: number }).removed).toBe(FRIEND_BOTS.count);
    expect(await friendIds(sql, other.id)).toEqual([]);
    expect((await friendIds(sql, admin.id)).sort()).toEqual(ids);
  });

  it("the friends list shows each bot as its schedule says, with no live hub asked for it; its profile agrees", async () => {
    const { sql, call } = await world();
    const admin = await signedIn(sql, "boss@example.com");
    await call("POST", { cookie: admin.cookie, ...ORIGIN });
    const asked: string[][] = [];
    for (const at of [T0, T0 + 5 * HOUR, T0 + 9 * HOUR]) {
      const state = await friendsState(sql, admin.id, at, async (ids) => (asked.push(ids), {}));
      expect(state.friends).toHaveLength(FRIEND_BOTS.count);
      for (const f of state.friends) {
        const p = botPresence(f.id, at);
        expect({ online: f.online, busy: f.busy, doing: f.doing, lastSeen: f.lastSeen }).toEqual({ online: p.online, busy: p.busy, doing: p.online ? p.doing : undefined, lastSeen: p.lastSeen });
        const profile = (await publicProfile(sql, f.id, at))!;
        expect({ online: profile.online, lastSeen: profile.lastSeen }).toEqual({ online: p.online, lastSeen: p.lastSeen });
      }
      const online = await friendsOnline(sql, admin.id, at, async (ids) => (asked.push(ids), {}));
      for (const [id, o] of Object.entries(online)) expect(o.online).toBe(botPresence(id, at).online);
    }
    expect(asked.flat()).toEqual([]);
  });

  it("the ops page's buttons: a form's add and remove, then back to the page; the e2e's key with a session adds for that account", async () => {
    const { sql, call } = await world();
    const admin = await signedIn(sql, "boss@example.com");
    const add = await call("POST", { cookie: admin.cookie, ...ORIGIN }, "action=add");
    expect(add.status).toBe(303);
    expect(add.headers.get("location")).toBe("/admin/ops#friend-bots");
    expect(await friendIds(sql, admin.id)).toHaveLength(FRIEND_BOTS.count);
    expect((await call("POST", { cookie: admin.cookie, ...ORIGIN }, "action=remove")).status).toBe(303);
    expect(await friendIds(sql, admin.id)).toEqual([]);
    expect(await sql.all("SELECT id FROM users WHERE id LIKE 'fbot-%'")).toEqual([]);

    const player = await signedIn(sql, "player@example.com");
    expect((await call("POST", { cookie: player.cookie, "x-e2e-sql": E2E_KEY })).status).toBe(200);
    expect(await friendIds(sql, player.id)).toHaveLength(FRIEND_BOTS.count);
  });
});
