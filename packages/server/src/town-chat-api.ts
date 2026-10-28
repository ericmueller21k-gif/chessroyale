import { TOWN_CHAT, pausedLine } from "@chessroyale/core";
import type { Sql, User } from "./accounts.ts";
import { caseOf } from "./fairplay.ts";
import { CHAT_OFF, chatBlock } from "./chat-mod.ts";
import { isBlockedText } from "./text-filter.ts";
import { cachedUserId } from "./presence.ts";
import { BANNED_FROM_CHAT } from "./global-chat-api.ts";
import { townSince, type TownLine, type TownPost, type TownSender, type TownSlice, type TownSnapshot } from "./town-chat.ts";
import type { LiveHub } from "./live-hub.ts";

/**
 * The town square's typed chat over HTTP (town-chat.ts is the room). Reading rides on the live line's poll
 * (GET /api/live?town=N, every FRONT_DOOR.livePollMs while the town is open): no socket or poll of its own. Sending is
 * POST /api/town/chat {text}; a moderator takes a line out with POST /api/town/chat/remove {n}; a report of a line is
 * fair play's POST /api/report with the line's number (api.ts reads the line from the room).
 *
 * Who may: a signed-in account (an email or Google: accounts are 13 and older), always, even where signing in isn't
 * set up (local runs), and never from a device the age gate marked too young. Guests never get players' lines.
 * docs/decisions/2026-10-28-town-chat-typing.md.
 */

/** The hub's side of it (the live hub, or a stand-in in tests). */
export type TownHub = Pick<LiveHub, "townRead" | "townPost" | "townLine" | "townRemove">;

export const SIGN_IN_TO_TOWN_CHAT = "Sign in to chat with other players.";
export const TOWN_CHAT_AGE = "Chat with other players is for accounts 13 and older.";
export const TOWN_CHAT_PAUSED = pausedLine("town-chat");

/** The room as this Worker instance last read it, shared by every reader on it for TOWN_CHAT.readCacheMs. */
let cache: { at: number; snap: TownSnapshot } | null = null;
/** Accounts this instance has found signed in (by id, for a minute): a reader's poll is usually no D1 read. */
const signed = new Map<string, number>();
const SIGNED_MS = 60_000;
const SIGNED_MAX = 20_000;
/** Forgets the cached room and sign-ins (tests). */
export const forgetTownCache = () => {
  cache = null;
  signed.clear();
};

/** Whether this user may chat in the town: signed in (an email or Google). */
export const mayTownChat = (user: Pick<User, "email" | "google_sub"> | null) => !!(user && (user.email || user.google_sub));

/** The signed-in account behind a session token (this instance's caches, else one or two D1 reads), or null. */
export async function signedInReader(sql: Sql, token: string | null | undefined, now: number): Promise<string | null> {
  const id = await cachedUserId(sql, token, now);
  if (!id) return null;
  if ((signed.get(id) ?? 0) > now) return id;
  const row = await sql.first<{ email: string | null; google_sub: string | null }>("SELECT email, google_sub FROM users WHERE id = ?", id);
  if (!mayTownChat(row)) return null;
  if (signed.size >= SIGNED_MAX) signed.delete(signed.keys().next().value!);
  signed.set(id, now + SIGNED_MS);
  return id;
}

/** The room's lines after `since` (this instance's copy, read again from the hub every TOWN_CHAT.readCacheMs). */
export async function townSlice(hub: TownHub, since: number, now: number): Promise<TownSlice> {
  if (!cache || now - cache.at > TOWN_CHAT.readCacheMs) cache = { at: now, snap: await hub.townRead() };
  return townSince(cache.snap, since);
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });

/** Who's asking, as the routes need it: the account, whether this device answered "too young", and the switch. */
export interface TownAsker {
  user: User;
  tooYoung: boolean;
  paused: boolean;
}

/** Why this asker can't send or read players' lines (a response to give), or null when they may. */
function refusal(a: TownAsker): Response | null {
  if (!mayTownChat(a.user)) return json({ message: SIGN_IN_TO_TOWN_CHAT }, 401);
  if (a.tooYoung) return json({ message: TOWN_CHAT_AGE }, 403);
  if (a.paused) return json({ message: TOWN_CHAT_PAUSED, paused: "town-chat" }, 503);
  return null;
}

/**
 * POST /api/town/chat {text, since?}: a signed-in player sends a message. The name comes from the account (a name the
 * filter refuses goes out as "Player"), never from the request; the room checks the message and the limits. The answer
 * carries the room after it (the lines after `since`), so the sender's log has it at once.
 */
export async function townPostResponse(request: Request, sql: Sql, hub: TownHub, a: TownAsker, now: number): Promise<Response> {
  const refused = refusal(a);
  if (refused) return refused;
  const body = (await request.json().catch(() => ({}))) as { text?: unknown; since?: unknown };
  if ((await caseOf(sql, a.user.id))?.status === "banned") return json({ message: BANNED_FROM_CHAT, banned: true }, 403);
  // A moderator's chat ban (chat-mod.ts) stops the town's typing too.
  const block = await chatBlock(sql, a.user.id, now);
  if (block) return json({ message: CHAT_OFF, block }, 403);
  const row = await sql.first<{ name: string }>("SELECT name FROM users WHERE id = ?", a.user.id);
  const name = row?.name ?? a.user.name;
  const sender: TownSender = { id: a.user.id, name: isBlockedText(name) ? "Player" : name };
  const { post, town } = (await hub.townPost(sender, typeof body.text === "string" ? body.text : "")) as { post: TownPost; town: TownSnapshot };
  cache = { at: now, snap: town };
  const since = Number(body.since);
  const slice = townSince(town, Number.isFinite(since) ? since : 0);
  if (post.ok) return json({ ok: true, line: post.line, town: slice, waitMs: TOWN_CHAT.gapMs });
  if (post.reason === "text") return json({ ok: false, reason: post.reason, message: post.message, town: slice }, 400);
  return json({ ok: false, reason: post.reason, message: post.message, retryMs: post.retryMs, town: slice }, 429, { "retry-after": String(Math.ceil(post.retryMs / 1000)) });
}

/** POST /api/town/chat/remove {n}: a moderator (`admin`: ADMIN_EMAILS) takes one line out of everyone's log. */
export async function townRemoveResponse(request: Request, hub: TownHub, admin: boolean, now: number): Promise<Response> {
  if (!admin) return json({ message: "Only a moderator can do that." }, 403);
  const body = (await request.json().catch(() => ({}))) as { n?: unknown };
  const n = Number(body.n);
  if (!Number.isSafeInteger(n) || n < 1) return json({ message: "No such line." }, 400);
  const { removed, town } = (await hub.townRemove(n)) as { removed: boolean; town: TownSnapshot };
  cache = { at: now, snap: town };
  return removed ? json({ ok: true }) : json({ message: "That line has already gone." }, 404);
}

/**
 * A report of a line (fair play's report with TOWN_CHAT's reason): the line as the room holds it, said by the reported
 * player. Null when it has gone (each lasts a minute) or isn't theirs: the report is refused, so a report can only ever
 * carry words the player really sent.
 */
export async function reportedLine(hub: TownHub, n: unknown, target: unknown): Promise<TownLine | null> {
  const k = Number(n);
  if (!Number.isSafeInteger(k) || k < 1) return null;
  const line = (await hub.townLine(k).catch(() => null)) as TownLine | null;
  return line && line.from === target ? line : null;
}
