import { FRIENDS, FRONT_DOOR, CAPACITY, isInviteSetting, type FriendsState, type InviteKind, type InviteSetting } from "@chessroyale/core";
import type { Sql } from "./accounts.ts";

/**
 * Friends and invites in D1 (DECISIONS.md, "Friends and invites"; the tables are listed in docs/areas/accounts.md for the
 * privacy page and account deletion). Friend requests are accepted or declined; an invite points at a private lobby or
 * a Squads party (their links) and expires; a block hides each from the other: requests, invites, chat (the app hides
 * a blocked account's chat lines) and the friendship. Who may add or invite whom (signed in, not banned, the game
 * still open) is the API's (friends-api.ts); this file keeps the rules on the stored rows.
 */

export const FRIENDS_SCHEMA = [
  // A friendship is two rows, one per side, so anyone's list is one indexed read.
  `CREATE TABLE IF NOT EXISTS friends (
    user_id TEXT NOT NULL,
    friend_id TEXT NOT NULL,
    since INTEGER NOT NULL,
    PRIMARY KEY (user_id, friend_id)
  )`,
  `CREATE INDEX IF NOT EXISTS friends_friend ON friends (friend_id)`,
  // Requests waiting for an answer (answered ones are deleted; unanswered ones after FRIENDS.requestDays).
  `CREATE TABLE IF NOT EXISTS friend_requests (
    from_id TEXT NOT NULL,
    to_id TEXT NOT NULL,
    at INTEGER NOT NULL,
    PRIMARY KEY (from_id, to_id)
  )`,
  `CREATE INDEX IF NOT EXISTS friend_requests_to ON friend_requests (to_id)`,
  `CREATE TABLE IF NOT EXISTS blocks (
    user_id TEXT NOT NULL,
    blocked_id TEXT NOT NULL,
    at INTEGER NOT NULL,
    PRIMARY KEY (user_id, blocked_id)
  )`,
  `CREATE INDEX IF NOT EXISTS blocks_blocked ON blocks (blocked_id)`,
  // One open invite per pair (a new one replaces it), gone after FRIENDS.inviteMinutes.
  `CREATE TABLE IF NOT EXISTS invites (
    from_id TEXT NOT NULL,
    to_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    code TEXT NOT NULL,
    at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    PRIMARY KEY (from_id, to_id)
  )`,
  `CREATE INDEX IF NOT EXISTS invites_to ON invites (to_id)`,
  // The daily and hourly caps: requests sent today, invites sent this hour (one row per account and kind).
  `CREATE TABLE IF NOT EXISTS friend_limits (
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    window_start INTEGER NOT NULL,
    n INTEGER NOT NULL,
    PRIMARY KEY (user_id, kind)
  )`,
];

/** Settings kept on the account: who may invite you (NULL: everyone), and hiding when you're online (1). */
export const FRIENDS_COLUMNS = [
  { table: "users", column: "allow_invites", type: "TEXT" },
  { table: "users", column: "hide_online", type: "INTEGER" },
];

export const FRIEND_TEXT = {
  self: "That's you.",
  noPlayer: "No such player.",
  guestTarget: "This player isn't signed in, so they can't add friends yet.",
  guestInvite: "This player isn't signed in, so they can't join online games yet.",
  unblockFirst: "You've blocked this player. Unblock them first.",
  maxFriends: `You have ${FRIENDS.max} friends, the most you can have.`,
  theirMax: "This player has as many friends as they can have.",
  maxPending: `You have ${FRIENDS.maxPendingSent} friend requests waiting for an answer. Wait for some answers first.`,
  requestsToday: "You've sent as many friend requests as you can today. Try again tomorrow.",
  noRequest: "That request isn't there any more.",
  maxBlocked: `You've blocked ${FRIENDS.maxBlocked} players, the most you can. Unblock someone first.`,
  notTaking: "This player isn't taking invites right now.",
  reinvite: "You just invited them. Give them a moment.",
  invitesHour: "You've sent a lot of invites. Try again in a while.",
} as const;

export type Done = { ok: true; notify?: string[] } | { ok: false; message: string; status: number };
const fail = (message: string, status = 400): Done => ({ ok: false, message, status });

const isBlocking = async (sql: Sql, who: string, whom: string) => !!(await sql.first("SELECT 1 AS x FROM blocks WHERE user_id = ? AND blocked_id = ?", who, whom));
const areFriends = async (sql: Sql, a: string, b: string) => !!(await sql.first("SELECT 1 AS x FROM friends WHERE user_id = ? AND friend_id = ?", a, b));
const countOf = async (sql: Sql, q: string, ...p: unknown[]) => (await sql.first<{ n: number }>(q, ...p))?.n ?? 0;
const friendCount = (sql: Sql, id: string) => countOf(sql, "SELECT COUNT(*) AS n FROM friends WHERE user_id = ?", id);

interface Target {
  id: string;
  email: string | null;
  google_sub: string | null;
  allow_invites: string | null;
}
const target = (sql: Sql, id: string) => sql.first<Target>("SELECT id, email, google_sub, allow_invites FROM users WHERE id = ?", id);
const signedIn = (t: Pick<Target, "email" | "google_sub">) => !!(t.email || t.google_sub);

/**
 * Counts one action against a cap (`limit` per `windowMs`, per account): false when the cap is reached (nothing
 * counted). Kept in D1 because a Worker instance's memory sees only its own share of an account's requests.
 */
async function spend(sql: Sql, userId: string, kind: "request" | "invite", limit: number, windowMs: number, now: number): Promise<boolean> {
  const row = await sql.first<{ window_start: number; n: number }>("SELECT window_start, n FROM friend_limits WHERE user_id = ? AND kind = ?", userId, kind);
  const fresh = !row || now - row.window_start >= windowMs;
  if (!fresh && row.n >= limit) return false;
  await sql.run(
    `INSERT INTO friend_limits (user_id, kind, window_start, n) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, kind) DO UPDATE SET window_start = excluded.window_start, n = excluded.n`,
    userId,
    kind,
    fresh ? now : row.window_start,
    fresh ? 1 : row.n + 1,
  );
  return true;
}

/**
 * A friend request from `me` to `toId`. If they had already asked you, you're friends at once. A request to someone
 * who has blocked you is kept but never shown to them (you see it as sent, as with anyone who doesn't answer), so a
 * block can't be found out this way. `needSignIn`: signing in is set up, so a guest can't be added.
 */
export async function sendRequest(sql: Sql, meId: string, toId: string, needSignIn: boolean, now: number): Promise<Done> {
  if (toId === meId) return fail(FRIEND_TEXT.self);
  const t = await target(sql, toId);
  if (!t) return fail(FRIEND_TEXT.noPlayer, 404);
  if (needSignIn && !signedIn(t)) return fail(FRIEND_TEXT.guestTarget);
  if (await isBlocking(sql, meId, toId)) return fail(FRIEND_TEXT.unblockFirst);
  if (await areFriends(sql, meId, toId)) return { ok: true };
  const blockedByThem = await isBlocking(sql, toId, meId);
  if (!blockedByThem && (await sql.first("SELECT 1 AS x FROM friend_requests WHERE from_id = ? AND to_id = ?", toId, meId))) return befriend(sql, meId, toId, now);
  if (await sql.first("SELECT 1 AS x FROM friend_requests WHERE from_id = ? AND to_id = ?", meId, toId)) return { ok: true };
  if ((await friendCount(sql, meId)) >= FRIENDS.max) return fail(FRIEND_TEXT.maxFriends);
  if ((await countOf(sql, "SELECT COUNT(*) AS n FROM friend_requests WHERE from_id = ?", meId)) >= FRIENDS.maxPendingSent) return fail(FRIEND_TEXT.maxPending);
  if (!(await spend(sql, meId, "request", FRIENDS.requestsPerDay, 86_400_000, now))) return fail(FRIEND_TEXT.requestsToday, 429);
  await sql.run("INSERT INTO friend_requests (from_id, to_id, at) VALUES (?, ?, ?)", meId, toId, now);
  return { ok: true, notify: blockedByThem ? [] : [toId] };
}

/** `meId` accepts `fromId`'s request (or both asked): friends, both ways; any request between them is gone. */
async function befriend(sql: Sql, meId: string, fromId: string, now: number): Promise<Done> {
  if ((await friendCount(sql, meId)) >= FRIENDS.max) return fail(FRIEND_TEXT.maxFriends);
  if ((await friendCount(sql, fromId)) >= FRIENDS.max) return fail(FRIEND_TEXT.theirMax);
  await sql.run("INSERT OR IGNORE INTO friends (user_id, friend_id, since) VALUES (?, ?, ?), (?, ?, ?)", meId, fromId, now, fromId, meId, now);
  await sql.run("DELETE FROM friend_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)", meId, fromId, fromId, meId);
  // (Their list changes: a new friend. No toast for it, only a fresh list.)
  return { ok: true, notify: [fromId] };
}

/** Accept or decline a request to you. Declining tells the sender nothing (their request just stops showing as sent). */
export async function answerRequest(sql: Sql, meId: string, fromId: string, accept: boolean, now: number): Promise<Done> {
  const row = await sql.first("SELECT 1 AS x FROM friend_requests WHERE from_id = ? AND to_id = ?", fromId, meId);
  if (!row || (await isBlocking(sql, meId, fromId))) return fail(FRIEND_TEXT.noRequest, 404);
  if (accept) return befriend(sql, meId, fromId, now);
  await sql.run("DELETE FROM friend_requests WHERE from_id = ? AND to_id = ?", fromId, meId);
  return { ok: true };
}

/** Takes back your request to `toId`. */
export async function cancelRequest(sql: Sql, meId: string, toId: string): Promise<Done> {
  await sql.run("DELETE FROM friend_requests WHERE from_id = ? AND to_id = ?", meId, toId);
  return { ok: true };
}

/** No longer friends (both sides). */
export async function removeFriend(sql: Sql, meId: string, otherId: string): Promise<Done> {
  await sql.run("DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)", meId, otherId, otherId, meId);
  return { ok: true };
}

/**
 * Blocks `otherId`: no longer friends, requests and invites between you gone, and from now on their requests never
 * reach you (kept unseen), their invites are refused as "not taking invites" (the same words as your invite setting),
 * and the app hides their chat lines.
 */
export async function block(sql: Sql, meId: string, otherId: string, now: number): Promise<Done> {
  if (otherId === meId) return fail(FRIEND_TEXT.self);
  if (!(await target(sql, otherId))) return fail(FRIEND_TEXT.noPlayer, 404);
  if (await isBlocking(sql, meId, otherId)) return { ok: true };
  if ((await countOf(sql, "SELECT COUNT(*) AS n FROM blocks WHERE user_id = ?", meId)) >= FRIENDS.maxBlocked) return fail(FRIEND_TEXT.maxBlocked);
  await removeFriend(sql, meId, otherId);
  await sql.run("DELETE FROM friend_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)", meId, otherId, otherId, meId);
  await sql.run("DELETE FROM invites WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)", meId, otherId, otherId, meId);
  await sql.run("INSERT OR IGNORE INTO blocks (user_id, blocked_id, at) VALUES (?, ?, ?)", meId, otherId, now);
  return { ok: true };
}

export async function unblock(sql: Sql, meId: string, otherId: string): Promise<Done> {
  await sql.run("DELETE FROM blocks WHERE user_id = ? AND blocked_id = ?", meId, otherId);
  return { ok: true };
}

/**
 * An invite from `meId` to `toId` to play in a lobby or party (the API has checked it's still open). Anyone may invite
 * anyone, as their setting allows: everyone (the default), friends only, or no one. Someone who blocked you, or whose
 * setting doesn't allow you, gets nothing, and you're told they aren't taking invites.
 */
export async function sendInvite(sql: Sql, meId: string, toId: string, kind: InviteKind, code: string, needSignIn: boolean, now: number): Promise<Done> {
  if (toId === meId) return fail(FRIEND_TEXT.self);
  const t = await target(sql, toId);
  if (!t) return fail(FRIEND_TEXT.noPlayer, 404);
  if (needSignIn && !signedIn(t)) return fail(FRIEND_TEXT.guestInvite);
  if (await isBlocking(sql, meId, toId)) return fail(FRIEND_TEXT.unblockFirst);
  const setting: InviteSetting = isInviteSetting(t.allow_invites) ? t.allow_invites : "everyone";
  if (setting === "none" || (await isBlocking(sql, toId, meId)) || (setting === "friends" && !(await areFriends(sql, meId, toId)))) return fail(FRIEND_TEXT.notTaking, 403);
  const last = await sql.first<{ at: number }>("SELECT at FROM invites WHERE from_id = ? AND to_id = ?", meId, toId);
  if (last && now - last.at < FRIENDS.reinviteMs) return fail(FRIEND_TEXT.reinvite, 429);
  if (!(await spend(sql, meId, "invite", FRIENDS.invitesPerHour, 3_600_000, now))) return fail(FRIEND_TEXT.invitesHour, 429);
  await sql.run(
    `INSERT INTO invites (from_id, to_id, kind, code, at, expires_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (from_id, to_id) DO UPDATE SET kind = excluded.kind, code = excluded.code, at = excluded.at, expires_at = excluded.expires_at`,
    meId,
    toId,
    kind,
    code,
    now,
    now + FRIENDS.inviteMinutes * 60_000,
  );
  return { ok: true, notify: [toId] };
}

/** An invite to you, dismissed (or used: joining takes it off your list). */
export async function dismissInvite(sql: Sql, meId: string, fromId: string): Promise<Done> {
  await sql.run("DELETE FROM invites WHERE from_id = ? AND to_id = ?", fromId, meId);
  return { ok: true };
}

/** Your settings: who may invite you, and whether others see when you're online. Unknown values are ignored. */
export async function setFriendSettings(sql: Sql, meId: string, patch: { invites?: unknown; showOnline?: unknown }): Promise<Done> {
  if (isInviteSetting(patch.invites)) await sql.run("UPDATE users SET allow_invites = ? WHERE id = ?", patch.invites === "everyone" ? null : patch.invites, meId);
  if (typeof patch.showOnline === "boolean") await sql.run("UPDATE users SET hide_online = ? WHERE id = ?", patch.showOnline ? null : 1, meId);
  return { ok: true };
}

/** Who's online and who's in a match, for a list of accounts (the live hub's memory, else D1's last_seen). */
export type PresenceOf = (ids: string[]) => Promise<Record<string, { online: boolean; busy: boolean }> | null>;

/**
 * Your friends list: friends (online first, then in a match, then the rest, each by name), requests to you, your
 * requests, open invites to you, who you've blocked and your settings. Nothing from or about someone you've blocked.
 */
export async function friendsState(sql: Sql, meId: string, now: number, presenceOf?: PresenceOf): Promise<FriendsState> {
  const me = await sql.first<{ allow_invites: string | null; hide_online: number | null }>("SELECT allow_invites, hide_online FROM users WHERE id = ?", meId);
  const rows = await sql.all<{ id: string; name: string; since: number; last_seen: number | null; hide_online: number | null }>(
    "SELECT u.id, u.name, f.since, u.last_seen, u.hide_online FROM friends f JOIN users u ON u.id = f.friend_id WHERE f.user_id = ?",
    meId,
  );
  const shown = rows.filter((r) => !r.hide_online).map((r) => r.id);
  const live = shown.length && presenceOf ? await presenceOf(shown).catch(() => null) : null;
  // (Without the live hub: D1's last_seen, which a request touches every 15 s there.)
  const fallback = (r: (typeof rows)[number]) => ({ online: r.last_seen !== null && now - r.last_seen < FRONT_DOOR.onlineWindowMs + CAPACITY.presence.lastSeenWriteMs, busy: false });
  const friends = rows
    .map((r) => {
      const p = r.hide_online ? { online: false, busy: false } : (live?.[r.id] ?? (live ? { online: false, busy: false } : fallback(r)));
      return { id: r.id, name: r.name, since: r.since, online: p.online, busy: p.online && p.busy, hidden: !!r.hide_online };
    })
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  const requests = await sql.all<{ id: string; name: string; at: number }>(
    `SELECT u.id, u.name, r.at FROM friend_requests r JOIN users u ON u.id = r.from_id
     WHERE r.to_id = ? AND NOT EXISTS (SELECT 1 FROM blocks b WHERE b.user_id = r.to_id AND b.blocked_id = r.from_id)
     ORDER BY r.at DESC`,
    meId,
  );
  const sent = await sql.all<{ id: string; name: string; at: number }>(
    "SELECT u.id, u.name, r.at FROM friend_requests r JOIN users u ON u.id = r.to_id WHERE r.from_id = ? ORDER BY r.at DESC",
    meId,
  );
  const invites = await sql.all<{ from_id: string; name: string; kind: InviteKind; code: string; at: number; expires_at: number }>(
    `SELECT i.from_id, u.name, i.kind, i.code, i.at, i.expires_at FROM invites i JOIN users u ON u.id = i.from_id
     WHERE i.to_id = ? AND i.expires_at > ? AND NOT EXISTS (SELECT 1 FROM blocks b WHERE b.user_id = i.to_id AND b.blocked_id = i.from_id)
     ORDER BY i.at DESC`,
    meId,
    now,
  );
  const blocked = await sql.all<{ id: string; name: string }>("SELECT u.id, u.name FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.user_id = ? ORDER BY b.at DESC", meId);
  return {
    friends,
    requests,
    sent,
    invites: invites.map((i) => ({ from: i.from_id, name: i.name, kind: i.kind, code: i.code, at: i.at, expiresAt: i.expires_at })),
    blocked,
    settings: { invites: isInviteSetting(me?.allow_invites) ? me.allow_invites : "everyone", showOnline: !me?.hide_online },
  };
}

const rank = (f: { online: boolean; busy: boolean }) => (f.online ? (f.busy ? 1 : 0) : 2);

/** Accounts with something new in the last hour (open invites, recent requests): the live hub's start, after a restart. */
export async function recentNews(sql: Sql, now: number): Promise<{ id: string; at: number }[]> {
  return sql.all<{ id: string; at: number }>(
    `SELECT to_id AS id, MAX(at) AS at FROM (
       SELECT to_id, at FROM invites WHERE expires_at > ?
       UNION ALL SELECT to_id, at FROM friend_requests WHERE at > ?
     ) GROUP BY to_id`,
    now,
    now - 3_600_000,
  );
}

/** Expired invites, requests nobody answered in FRIENDS.requestDays, and spent caps (the live hub, every 10 minutes). */
export async function pruneFriends(sql: Sql, now: number): Promise<void> {
  await sql.run("DELETE FROM invites WHERE expires_at < ?", now);
  await sql.run("DELETE FROM friend_requests WHERE at < ?", now - FRIENDS.requestDays * 86_400_000);
  await sql.run("DELETE FROM friend_limits WHERE window_start < ?", now - 86_400_000);
}

/**
 * Everything friends keeps about an account, on either side (account deletion; a guest's account when its player
 * signs in to another). The two settings live on the users row and go with it.
 */
export async function deleteSocial(sql: Sql, userId: string): Promise<void> {
  await sql.run("DELETE FROM friends WHERE user_id = ? OR friend_id = ?", userId, userId);
  await sql.run("DELETE FROM friend_requests WHERE from_id = ? OR to_id = ?", userId, userId);
  await sql.run("DELETE FROM blocks WHERE user_id = ? OR blocked_id = ?", userId, userId);
  await sql.run("DELETE FROM invites WHERE from_id = ? OR to_id = ?", userId, userId);
  await sql.run("DELETE FROM friend_limits WHERE user_id = ?", userId);
}
