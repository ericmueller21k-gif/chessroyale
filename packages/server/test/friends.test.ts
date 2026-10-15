import { describe, expect, it } from "vitest";
import { FRIENDS } from "@chessroyale/core";
import { createGuest, ensureSchema, publicProfile, signInWithIdentity, type Sql } from "../src/accounts.ts";
import {
  FRIEND_TEXT,
  answerRequest,
  block,
  cancelRequest,
  deleteSocial,
  dismissInvite,
  friendsState,
  pruneFriends,
  recentNews,
  removeFriend,
  sendInvite,
  sendRequest,
  setFriendSettings,
  unblock,
} from "../src/friends.ts";
import { friendsOn, handleFriendsApi } from "../src/friends-api.ts";
import { LiveBoard } from "../src/live.ts";
import { rateLimited } from "../src/limits.ts";
import { memoryDb } from "./memory-db.ts";

const T0 = 1_800_000_000_000;

async function world(names = ["Ann", "Bo", "Cy"]) {
  const { sql, d1 } = memoryDb();
  await ensureSchema(sql);
  const users: { id: string; token: string }[] = [];
  for (const n of names) {
    const g = await createGuest(sql, T0 - 60_000, n);
    users.push({ id: g.user.id, token: g.token });
  }
  return { sql, d1, users, ids: users.map((u) => u.id) };
}

const state = (sql: Sql, id: string, now = T0) => friendsState(sql, id, now);
const rows = async (sql: Sql, table: string) => (await sql.first<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))!.n;

describe("friend requests", () => {
  it("a request is accepted or declined; asking someone who asked you makes you friends at once", async () => {
    const { sql, ids } = await world();
    const [a, b, c] = ids as [string, string, string];
    expect(await sendRequest(sql, a, b, false, T0)).toEqual({ ok: true, notify: [b] });
    // Asking again changes nothing (no second notice, nothing counted).
    expect(await sendRequest(sql, a, b, false, T0 + 1)).toEqual({ ok: true });
    expect((await state(sql, a)).sent.map((r) => r.name)).toEqual(["Bo"]);
    expect((await state(sql, b)).requests.map((r) => [r.name, r.at])).toEqual([["Ann", T0]]);
    // Bo accepts: friends both ways, the request gone, Ann told (her list changes).
    expect(await answerRequest(sql, b, a, true, T0 + 10)).toEqual({ ok: true, notify: [a] });
    expect((await state(sql, a)).friends.map((f) => [f.name, f.since])).toEqual([["Bo", T0 + 10]]);
    expect((await state(sql, b)).friends.map((f) => f.name)).toEqual(["Ann"]);
    expect((await state(sql, b)).requests).toEqual([]);
    expect(await answerRequest(sql, b, a, true, T0 + 11)).toMatchObject({ ok: false, message: FRIEND_TEXT.noRequest, status: 404 });
    // Cy asks Ann, Ann declines: nothing for Cy to see but an empty "sent" list.
    await sendRequest(sql, c, a, false, T0);
    expect(await answerRequest(sql, a, c, false, T0 + 1)).toEqual({ ok: true });
    expect((await state(sql, c)).sent).toEqual([]);
    expect((await state(sql, a)).friends.map((f) => f.name)).toEqual(["Bo"]);
    // Both ask: the second request is an accept.
    await sendRequest(sql, c, b, false, T0);
    expect(await sendRequest(sql, b, c, false, T0 + 5)).toEqual({ ok: true, notify: [c] });
    expect((await state(sql, c)).friends.map((f) => f.name)).toEqual(["Bo"]);
    // Taking back a request, and removing a friend (both sides).
    await sendRequest(sql, a, c, false, T0);
    await cancelRequest(sql, a, c);
    expect((await state(sql, c)).requests).toEqual([]);
    await removeFriend(sql, a, b);
    expect((await state(sql, b)).friends.map((f) => f.name)).toEqual(["Cy"]);
    expect((await state(sql, a)).friends).toEqual([]);
  });

  it("refuses yourself, nobody, and (where signing in is set up) a guest", async () => {
    const { sql, ids } = await world();
    const [a, b] = ids as [string, string];
    expect(await sendRequest(sql, a, a, false, T0)).toMatchObject({ ok: false, message: FRIEND_TEXT.self });
    expect(await sendRequest(sql, a, "nobody-here", false, T0)).toMatchObject({ ok: false, status: 404 });
    expect(await sendRequest(sql, a, b, true, T0)).toMatchObject({ ok: false, message: FRIEND_TEXT.guestTarget });
    await sql.run("UPDATE users SET email = 'bo@example.com' WHERE id = ?", b);
    expect((await sendRequest(sql, a, b, true, T0)).ok).toBe(true);
  });

  it("caps: requests waiting at once, requests a day, friends", async () => {
    const names = Array.from({ length: FRIENDS.maxPendingSent + 2 }, (_, i) => `P${i}`);
    const { sql, ids } = await world(names);
    const [me, ...rest] = ids as [string, ...string[]];
    // (This test needs a day's requests to fall short of the cap on requests waiting, and two days' to pass it.)
    expect(FRIENDS.requestsPerDay < FRIENDS.maxPendingSent && FRIENDS.maxPendingSent < 2 * FRIENDS.requestsPerDay).toBe(true);
    for (let i = 0; i < FRIENDS.requestsPerDay; i++) expect((await sendRequest(sql, me, rest[i]!, false, T0 + i)).ok).toBe(true);
    expect(await sendRequest(sql, me, rest[FRIENDS.requestsPerDay]!, false, T0 + 100)).toMatchObject({ ok: false, message: FRIEND_TEXT.requestsToday, status: 429 });
    // The next day, up to the cap on requests waiting at once.
    const day2 = T0 + 86_400_000;
    for (let i = FRIENDS.requestsPerDay; i < FRIENDS.maxPendingSent; i++) expect((await sendRequest(sql, me, rest[i]!, false, day2 + i)).ok).toBe(true);
    expect(await sendRequest(sql, me, rest[FRIENDS.maxPendingSent]!, false, day2 + 100)).toMatchObject({ ok: false, message: FRIEND_TEXT.maxPending });
    // An answer makes room.
    await answerRequest(sql, rest[0]!, me, false, day2 + 200);
    expect((await sendRequest(sql, me, rest[FRIENDS.maxPendingSent]!, false, day2 + 300)).ok).toBe(true);
    // The friends cap, for both sides.
    const { sql: s2, ids: two } = await world(["X", "Y"]);
    const fill = Array.from({ length: FRIENDS.max }, (_, i) => `(?, 'f${i}', 0)`).join(", ");
    await s2.run(`INSERT INTO friends (user_id, friend_id, since) VALUES ${fill}`, ...Array(FRIENDS.max).fill(two[1]));
    expect(await sendRequest(s2, two[0]!, two[1]!, false, T0)).toEqual({ ok: true, notify: [two[1]] });
    expect(await answerRequest(s2, two[1]!, two[0]!, true, T0)).toMatchObject({ ok: false, message: FRIEND_TEXT.maxFriends });
  });
});

describe("blocking", () => {
  it("ends the friendship, requests and invites; their requests stay unseen and their invites are refused", async () => {
    const { sql, ids } = await world();
    const [a, b] = ids as [string, string];
    await sendRequest(sql, a, b, false, T0);
    await answerRequest(sql, b, a, true, T0);
    await sendInvite(sql, b, a, "crowd", "ABCDE", false, T0);
    expect((await state(sql, a)).invites.map((i) => i.name)).toEqual(["Bo"]);
    expect(await block(sql, a, b, T0 + 1)).toEqual({ ok: true });
    const sa = await state(sql, a);
    expect([sa.friends, sa.invites, sa.blocked.map((x) => x.name)]).toEqual([[], [], ["Bo"]]);
    expect((await state(sql, b)).friends).toEqual([]);
    // Bo asks again: it looks sent to him, Ann never sees it, and nobody is told.
    expect(await sendRequest(sql, b, a, false, T0 + 2)).toEqual({ ok: true, notify: [] });
    expect((await state(sql, b)).sent.map((r) => r.name)).toEqual(["Ann"]);
    expect((await state(sql, a)).requests).toEqual([]);
    expect(await answerRequest(sql, a, b, true, T0 + 3)).toMatchObject({ ok: false, status: 404 });
    // His invites: the same answer as an invite setting that doesn't allow him.
    expect(await sendInvite(sql, b, a, "raid", "ABCDE", false, T0 + 60_000)).toMatchObject({ ok: false, message: FRIEND_TEXT.notTaking, status: 403 });
    // Ann can't ask or invite him without unblocking first.
    expect(await sendRequest(sql, a, b, false, T0)).toMatchObject({ ok: false, message: FRIEND_TEXT.unblockFirst });
    expect(await sendInvite(sql, a, b, "crowd", "ABCDE", false, T0)).toMatchObject({ ok: false, message: FRIEND_TEXT.unblockFirst });
    await unblock(sql, a, b);
    expect((await state(sql, a)).blocked).toEqual([]);
    expect((await sendInvite(sql, b, a, "raid", "ABCDE", false, T0 + 120_000)).ok).toBe(true);
    expect(await block(sql, a, a, T0)).toMatchObject({ ok: false, message: FRIEND_TEXT.self });
  });
});

describe("invites", () => {
  it("follow the player's setting, can't be repeated within seconds, expire, and are capped an hour", async () => {
    const { sql, ids } = await world();
    const [a, b, c] = ids as [string, string, string];
    expect(await sendInvite(sql, a, b, "squads", "PARTY", false, T0)).toEqual({ ok: true, notify: [b] });
    const inv = (await state(sql, b)).invites;
    expect(inv).toEqual([{ from: a, name: "Ann", kind: "squads", code: "PARTY", at: T0, expiresAt: T0 + FRIENDS.inviteMinutes * 60_000 }]);
    expect(await sendInvite(sql, a, b, "squads", "PARTY", false, T0 + 1000)).toMatchObject({ ok: false, message: FRIEND_TEXT.reinvite, status: 429 });
    // A new one replaces the old (one per pair).
    expect((await sendInvite(sql, a, b, "crowd", "LOBBY", false, T0 + FRIENDS.reinviteMs)).ok).toBe(true);
    expect((await state(sql, b, T0 + FRIENDS.reinviteMs)).invites.map((i) => i.code)).toEqual(["LOBBY"]);
    // Expired: gone from the list, then pruned.
    const later = T0 + FRIENDS.reinviteMs + FRIENDS.inviteMinutes * 60_000 + 1;
    expect((await state(sql, b, later)).invites).toEqual([]);
    await pruneFriends(sql, later);
    expect(await rows(sql, "invites")).toBe(0);
    // Dismissed.
    await sendInvite(sql, c, b, "crowd", "LOBBY", false, T0);
    await dismissInvite(sql, b, c);
    expect((await state(sql, b)).invites).toEqual([]);
    // Friends only: Cy (not a friend) is refused, Ann (a friend) isn't. No one: nobody.
    await setFriendSettings(sql, b, { invites: "friends" });
    expect((await state(sql, b)).settings).toEqual({ invites: "friends", showOnline: true });
    expect(await sendInvite(sql, c, b, "crowd", "LOBBY", false, T0 + 60_000)).toMatchObject({ ok: false, message: FRIEND_TEXT.notTaking });
    await sendRequest(sql, a, b, false, T0);
    await answerRequest(sql, b, a, true, T0);
    expect((await sendInvite(sql, a, b, "crowd", "LOBBY", false, T0 + 10 * 60_000)).ok).toBe(true);
    await setFriendSettings(sql, b, { invites: "none" });
    expect(await sendInvite(sql, a, b, "crowd", "LOBBY", false, T0 + 20 * 60_000)).toMatchObject({ ok: false, message: FRIEND_TEXT.notTaking });
    await setFriendSettings(sql, b, { invites: "nonsense" });
    expect((await state(sql, b)).settings.invites).toBe("none");
    await setFriendSettings(sql, b, { invites: "everyone" });
    expect((await state(sql, b)).settings.invites).toBe("everyone");
    // A guest can't be invited where signing in is set up.
    expect(await sendInvite(sql, a, c, "crowd", "LOBBY", true, T0)).toMatchObject({ ok: false, message: FRIEND_TEXT.guestInvite });
  });

  it("an hour's cap", async () => {
    const names = Array.from({ length: FRIENDS.invitesPerHour + 2 }, (_, i) => `P${i}`);
    const { sql, ids } = await world(names);
    const [me, ...rest] = ids as [string, ...string[]];
    for (let i = 0; i < FRIENDS.invitesPerHour; i++) expect((await sendInvite(sql, me, rest[i]!, "crowd", "LOBBY", false, T0 + i)).ok).toBe(true);
    expect(await sendInvite(sql, me, rest[FRIENDS.invitesPerHour]!, "crowd", "LOBBY", false, T0 + 1000)).toMatchObject({ ok: false, message: FRIEND_TEXT.invitesHour, status: 429 });
    expect((await sendInvite(sql, me, rest[FRIENDS.invitesPerHour]!, "crowd", "LOBBY", false, T0 + 3_600_000)).ok).toBe(true);
  });
});

describe("online status", () => {
  it("friends online first (then in a match, then the rest), from the live hub; hidden means hidden everywhere", async () => {
    const { sql, ids } = await world(["Ann", "Zed", "Bo", "Cy"]);
    const [a, z, b, c] = ids as [string, string, string, string];
    for (const f of [z, b, c]) {
      await sendRequest(sql, f, a, false, T0);
      await answerRequest(sql, a, f, true, T0);
    }
    const presence = async (list: string[]) => Object.fromEntries(list.map((id) => [id, { online: id !== b, busy: id === z }]));
    const s = await friendsState(sql, a, T0, presence);
    expect(s.friends.map((f) => [f.name, f.online, f.busy])).toEqual([
      ["Cy", true, false],
      ["Zed", true, true],
      ["Bo", false, false],
    ]);
    // Cy hides it: no status in friends lists, and none on the profile.
    await setFriendSettings(sql, c, { showOnline: false });
    const asked: string[][] = [];
    const s2 = await friendsState(sql, a, T0, async (list) => (asked.push(list), presence(list)));
    expect(asked.map((l) => [...l].sort())).toEqual([[z, b].sort()]);
    expect(s2.friends.find((f) => f.name === "Cy")).toMatchObject({ online: false, busy: false, hidden: true });
    await sql.run("UPDATE users SET last_seen = ? WHERE id = ?", T0, c);
    expect(await publicProfile(sql, c, T0)).toMatchObject({ online: false, lastSeen: null, hidden: true });
    await setFriendSettings(sql, c, { showOnline: true });
    expect(await publicProfile(sql, c, T0)).toMatchObject({ online: true, lastSeen: T0 });
    expect((await publicProfile(sql, c, T0))?.hidden).toBeUndefined();
  });

  it("the live board: who's in a match, and friends' news for the instances that see them", () => {
    const board = new LiveBoard();
    board.markSeen(["a", "b"], T0, { a: true });
    expect(board.presenceOf(["a", "b", "c"], T0 + 1000)).toEqual({ a: { online: true, busy: true }, b: { online: true, busy: false }, c: { online: false, busy: false } });
    // Other requests leave it as it was; the live line's next one says the match is over.
    board.markSeen(["a"], T0 + 2000);
    expect(board.presenceOf(["a"], T0 + 2000).a!.busy).toBe(true);
    board.markSeen(["a"], T0 + 3000, { a: false });
    expect(board.presenceOf(["a"], T0 + 3000).a!.busy).toBe(false);
    // In a match, but gone: offline (and not "in a match").
    board.markSeen(["b"], T0, { b: true });
    expect(board.presenceOf(["b"], T0 + 61_000).b).toEqual({ online: false, busy: false });
    board.notify(["a"], T0 + 5000);
    board.notify(["a"], T0 + 4000);
    expect(board.newsFor(["a", "b"])).toEqual({ a: T0 + 5000 });
    board.prune(T0 + 2 * 60 * 60_000);
    expect(board.newsFor(["a"])).toEqual({});
  });
});

describe("keeping it tidy", () => {
  it("deleteSocial removes an account from every table, on both sides; old requests and caps are pruned", async () => {
    const { sql, ids } = await world();
    const [a, b, c] = ids as [string, string, string];
    await sendRequest(sql, a, b, false, T0);
    await answerRequest(sql, b, a, true, T0);
    await sendRequest(sql, c, a, false, T0);
    await block(sql, b, c, T0);
    await sendInvite(sql, a, c, "crowd", "LOBBY", false, T0);
    expect((await recentNews(sql, T0)).map((n) => n.id).sort()).toEqual([a, c].sort());
    await deleteSocial(sql, a);
    for (const t of ["friends", "friend_requests", "invites"]) expect(await rows(sql, t)).toBe(0);
    expect(await rows(sql, "blocks")).toBe(1);
    expect(await sql.first("SELECT 1 AS x FROM friend_limits WHERE user_id = ?", a)).toBeNull();
    await sendRequest(sql, b, a, false, T0);
    await pruneFriends(sql, T0 + FRIENDS.requestDays * 86_400_000 + 1);
    expect(await rows(sql, "friend_requests")).toBe(0);
    expect(await rows(sql, "friend_limits")).toBe(0);
  });

  it("a guest who signs in to an existing account takes nothing of friends with them (their rows go)", async () => {
    const { sql, ids } = await world();
    const [a, b] = ids as [string, string];
    await sql.run("UPDATE users SET email = 'bo@example.com' WHERE id = ?", b);
    await sendRequest(sql, a, b, false, T0);
    const guest = (await sql.first<{ id: string; name: string; icon: string; email: null; google_sub: null; created_at: number }>("SELECT id, name, icon, email, google_sub, created_at FROM users WHERE id = ?", a))!;
    await signInWithIdentity(sql, guest, "email", "bo@example.com", {}, T0);
    expect(await rows(sql, "friend_requests")).toBe(0);
  });
});

describe("the friends API", () => {
  const origin = "https://hunchess.com";
  const call = async (env: object, token: string | null, path: string, body?: unknown) => {
    const headers = new Headers();
    if (token) headers.set("cookie", `hc_session=${token}`);
    // (Background work isn't awaited: presence batches wait for their timer. The fake hub's notify records at once.)
    const res = (await handleFriendsApi(new Request(origin + path, body === undefined ? { headers } : { method: "POST", headers, body: JSON.stringify(body) }), env as never, () => undefined))!;
    return { status: res.status, body: (await res.json()) as any };
  };

  it("answers with the list after every action; refuses guests where signing in is set up; the kill switch", async () => {
    const { d1, users } = await world();
    const [a, b] = users as [{ id: string; token: string }, { id: string; token: string }];
    const env = { DB: d1 };
    expect((await call(env, null, "/api/friends")).status).toBe(401);
    expect((await call(env, a.token, "/api/friends")).body.state.friends).toEqual([]);
    const sent = await call(env, a.token, "/api/friends/request", { id: b.id });
    expect(sent.body.state.sent.map((r: { id: string }) => r.id)).toEqual([b.id]);
    expect((await call(env, b.token, "/api/friends/answer", { id: a.id, accept: true })).body.state.friends.map((f: { id: string }) => f.id)).toEqual([a.id]);
    expect((await call(env, b.token, "/api/friends/answer", { id: a.id, accept: true })).status).toBe(404);
    expect((await call(env, a.token, "/api/friends/request", { id: "../x" })).status).toBe(400);
    expect((await call(env, a.token, "/api/friends/nonsense", { id: b.id })).status).toBe(404);
    // Invites: a kind and a code, else a bad request.
    expect((await call(env, a.token, "/api/friends/invite", { id: b.id, kind: "chess", code: "ABCDE" })).status).toBe(400);
    expect((await call(env, a.token, "/api/friends/invite", { id: b.id, kind: "crowd", code: "abc" })).status).toBe(400);
    expect((await call(env, a.token, "/api/friends/invite", { id: b.id, kind: "crowd", code: "ABCDE" })).status).toBe(200);
    expect((await call(env, b.token, "/api/friends")).body.state.invites.map((i: { code: string }) => i.code)).toEqual(["ABCDE"]);
    const set = await call(env, b.token, "/api/friends/settings", { invites: "none", showOnline: false });
    expect(set.body.state.settings).toEqual({ invites: "none", showOnline: false });
    expect((await call(env, a.token, "/api/friends/invite", { id: b.id, kind: "crowd", code: "ABCDE" })).body.message).toBe(FRIEND_TEXT.notTaking);
    // Signing in set up: a guest gets { signIn } and can't act.
    const signedUp = { DB: d1, RESEND_API_KEY: "re_test" };
    expect((await call(signedUp, a.token, "/api/friends")).body).toEqual({ signIn: true });
    expect((await call(signedUp, a.token, "/api/friends/request", { id: b.id })).status).toBe(401);
    // Switched off.
    expect(friendsOn({})).toBe(true);
    expect(friendsOn({ PAUSE_FRIENDS: "0" })).toBe(true);
    const off = { DB: d1, PAUSE_FRIENDS: "1" };
    expect(friendsOn(off)).toBe(false);
    expect((await call(off, a.token, "/api/friends")).body).toEqual({ off: true });
    expect((await call(off, a.token, "/api/friends/request", { id: b.id })).status).toBe(503);
    // Other paths aren't the friends API's.
    expect(await handleFriendsApi(new Request(origin + "/api/friendship"), env as never, () => undefined)).toBeNull();
  });

  it("tells the live hub who has news, and checks an invite's game is still open", async () => {
    const { d1, users } = await world();
    const [a, b] = users as [{ id: string; token: string }, { id: string; token: string }];
    const notified: string[][] = [];
    const hub = { notify: async (ids: string[]) => void notified.push(ids), presenceOf: async () => ({}), seen: async () => ({}) };
    const LIVE = { idFromName: () => "hub", get: () => hub };
    const open = new Set(["OPENS"]);
    const LOBBIES = { idFromName: (c: string) => c, get: (c: string) => ({ status: async () => (open.has(c) ? { phase: "waiting" } : c === "PLAYS" ? { phase: "playing" } : null) }) };
    const PARTIES = { idFromName: (c: string) => c, get: (c: string) => ({ status: async () => (c === "PARTY" ? { members: 1, state: "open" } : null) }) };
    const env = { DB: d1, LIVE, LOBBIES, PARTIES };
    await call(env, a.token, "/api/friends/request", { id: b.id });
    expect(notified).toEqual([[b.id]]);
    for (const code of ["GONE2", "PLAYS"]) expect((await call(env, a.token, "/api/friends/invite", { id: b.id, kind: "crowd", code })).status).toBe(409);
    expect((await call(env, a.token, "/api/friends/invite", { id: b.id, kind: "squads", code: "NOPE2" })).status).toBe(409);
    expect((await call(env, a.token, "/api/friends/invite", { id: b.id, kind: "crowd", code: "OPENS" })).status).toBe(200);
    expect((await call(env, b.token, "/api/friends/invite", { id: a.id, kind: "squads", code: "PARTY" })).status).toBe(200);
    expect(notified).toEqual([[b.id], [b.id], [a.id]]);
  });

  it("friends' actions have a burst limit of their own (limits.ts)", () => {
    let wait: number | null = null;
    for (let i = 0; i < 40 && wait === null; i++) wait = rateLimited({ ip: null, session: "friends-burst", play: false, friends: true }, T0);
    expect(wait).not.toBeNull();
    expect(rateLimited({ ip: null, session: "friends-burst", play: false }, T0)).toBeNull();
  });
});
