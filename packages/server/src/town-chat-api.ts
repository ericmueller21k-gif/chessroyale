import { TOWN_CHAT, pausedLine } from "@chessroyale/core";
import type { Sql, User } from "./accounts.ts";
import { caseOf } from "./fairplay.ts";
import { CHAT_OFF, chatBlock } from "./chat-mod.ts";
import { isBlockedText } from "./text-filter.ts";
import { cachedUserId } from "./presence.ts";
import { BANNED_FROM_CHAT } from "./global-chat-api.ts";
import { TOWN_INPUT_MAX, TOWN_TOO_LONG, tidyColor, townSince, type TownLine, type TownPost, type TownSender, type TownSlice, type TownSnapshot } from "./town-chat.ts";
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
  forcedAt = -Infinity;
  signed.clear();
};
/**
 * Lets go of this instance's copy of the room once it's older than TOWN_CHAT.readCacheMs: called on every request the
 * Worker handles (index.ts), and by a timer set when the copy is made (`keep`), so the copy's lines never stay in an
 * instance's memory past a moment.
 */
export function expireTownCache(now: number) {
  if (cache && now - cache.at > TOWN_CHAT.readCacheMs) cache = null;
}
/** Keeps a fresh copy of the room, and lets it go TOWN_CHAT.readCacheMs later (the request's waitUntil keeps the timer). */
function keep(snap: TownSnapshot, now: number, waitUntil?: (p: Promise<unknown>) => void) {
  cache = { at: now, snap };
  waitUntil?.(new Promise((r) => setTimeout(r, TOWN_CHAT.readCacheMs + 50)).then(() => expireTownCache(Date.now())));
}
/**
 * A reader ahead of this instance's copy makes it read the room again, at most this often (a bogus `since` or `room` can't
 * turn every poll into a read of the hub).
 */
const FORCE_MS = 250;
let forcedAt = -Infinity;
/** The most a send's body may be (bytes): an 80-character message is far less; anything bigger never reaches the hub. */
export const TOWN_BODY_MAX = 8192;

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

/**
 * The room's lines after `since` in the reader's `room` (this instance's copy, read again from the hub every
 * TOWN_CHAT.readCacheMs, and at once when the reader is ahead of the copy: it saw a newer one, from its own send or another
 * instance, so the copy is stale, not the room reset).
 */
export async function townSlice(hub: TownHub, since: number, now: number, room?: string | null, waitUntil?: (p: Promise<unknown>) => void): Promise<TownSlice> {
  const old = !cache || now - cache.at > TOWN_CHAT.readCacheMs;
  const ahead = !!cache && (since > cache.snap.n || (!!room && room !== cache.snap.room));
  if (old || (ahead && now - forcedAt >= FORCE_MS)) {
    if (!old) forcedAt = now;
    keep(await hub.townRead(), now, waitUntil);
  } else if (ahead) {
    // (Asked again within FORCE_MS, a bogus `since` or `room` say: nothing new, and the reader keeps what it has.)
    return { room: room || cache!.snap.room, n: since, lines: [] };
  }
  const snap = cache!.snap;
  return townSince(snap, since, TOWN_CHAT.keep, room);
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
 * POST /api/town/chat {text, since?, room?, color?}: a signed-in player sends a message. The name comes from the account (a name the
 * filter refuses goes out as "Player"), never from the request; `color` is only the name color their device picked when it joined
 * the town (a whole number below TOWN_COLOR_LIMIT, else ignored); the room checks the message and the limits. The answer
 * carries the room after it (the lines after `since`), so the sender's log has it at once.
 */
export async function townPostResponse(request: Request, sql: Sql, hub: TownHub, a: TownAsker, now: number, waitUntil?: (p: Promise<unknown>) => void): Promise<Response> {
  const refused = refusal(a);
  if (refused) return refused;
  // (A huge body never reaches the shared hub: refused by its size, and the text cut to TOWN_INPUT_MAX before it goes.)
  if (Number(request.headers.get("content-length")) > TOWN_BODY_MAX) return json({ message: TOWN_TOO_LONG }, 413);
  const raw = await request.text().catch(() => "");
  if (raw.length > TOWN_BODY_MAX) return json({ message: TOWN_TOO_LONG }, 413);
  const body = ((): { text?: unknown; since?: unknown; room?: unknown; color?: unknown } => {
    try {
      return JSON.parse(raw) ?? {};
    } catch {
      return {};
    }
  })();
  if ((await caseOf(sql, a.user.id))?.status === "banned") return json({ message: BANNED_FROM_CHAT, banned: true }, 403);
  // A moderator's chat ban (chat-mod.ts) stops the town's typing too.
  const block = await chatBlock(sql, a.user.id, now);
  if (block) return json({ message: CHAT_OFF, block }, 403);
  const row = await sql.first<{ name: string }>("SELECT name FROM users WHERE id = ?", a.user.id);
  const name = row?.name ?? a.user.name;
  const color = tidyColor(body.color);
  const sender: TownSender = { id: a.user.id, name: isBlockedText(name) ? "Player" : name, ...(color !== undefined ? { color } : {}) };
  const { post, town } = (await hub.townPost(sender, typeof body.text === "string" ? body.text.slice(0, TOWN_INPUT_MAX) : "")) as { post: TownPost; town: TownSnapshot };
  keep(town, now, waitUntil);
  const since = Number(body.since);
  const slice = townSince(town, Number.isFinite(since) ? since : 0, TOWN_CHAT.keep, typeof body.room === "string" ? body.room : null);
  if (post.ok) return json({ ok: true, line: post.line, town: slice, waitMs: TOWN_CHAT.gapMs });
  if (post.reason === "text") return json({ ok: false, reason: post.reason, message: post.message, town: slice }, 400);
  return json({ ok: false, reason: post.reason, message: post.message, retryMs: post.retryMs, town: slice }, 429, { "retry-after": String(Math.ceil(post.retryMs / 1000)) });
}

/** POST /api/town/chat/remove {n}: a moderator (`admin`: ADMIN_EMAILS) takes one line out of everyone's log. */
export async function townRemoveResponse(request: Request, hub: TownHub, admin: boolean, now: number, waitUntil?: (p: Promise<unknown>) => void): Promise<Response> {
  if (!admin) return json({ message: "Only a moderator can do that." }, 403);
  const body = (await request.json().catch(() => ({}))) as { n?: unknown };
  const n = Number(body.n);
  if (!Number.isSafeInteger(n) || n < 1) return json({ message: "No such line." }, 400);
  const { removed, town } = (await hub.townRemove(n)) as { removed: boolean; town: TownSnapshot };
  keep(town, now, waitUntil);
  return removed ? json({ ok: true }) : json({ message: "That line has already gone." }, 404);
}

/**
 * A report of a line (fair play's report with TOWN_CHAT's reason): the line as the room holds it, said by the reported
 * player. Null when it has gone (each lasts TOWN_CHAT.lineMs, 5 minutes) or isn't theirs: the report is refused, so a report can only ever
 * carry words the player really sent.
 */
export async function reportedLine(hub: TownHub, n: unknown, target: unknown): Promise<TownLine | null> {
  const k = Number(n);
  if (!Number.isSafeInteger(k) || k < 1) return null;
  const line = (await hub.townLine(k).catch(() => null)) as TownLine | null;
  return line && line.from === target ? line : null;
}
