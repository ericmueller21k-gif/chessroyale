import { GLOBAL_CHAT } from "@chessroyale/core";
import { shopState, type Sql, type User } from "./accounts.ts";
import { caseOf } from "./fairplay.ts";
import { CHAT_OFF, chatBlock } from "./chat-mod.ts";
import { isBlockedText } from "./text-filter.ts";
import { isIconKey, linesSince, typedTooLong, type GlobalChatSnapshot, type GlobalPost, type GlobalSender } from "./global-chat.ts";
import { TOWN_INPUT_MAX } from "./town-chat.ts";
import { TOWN_BODY_MAX, mayTownChat } from "./town-chat-api.ts";
import type { LiveHub } from "./live-hub.ts";

/**
 * The global chat over HTTP (the computer's right column). Reading rides on the live line's poll (GET /api/live?chat=N, which the
 * front door already makes every few seconds): no new request, poll or socket. Posting is POST /api/chat {text | say}; a drawn
 * icon is GET /api/chat/icon/KEY, cached by the browser. See DECISIONS.md, "Global chat on the home page", and
 * docs/decisions/2026-11-07-typed-chat-column.md.
 */

/** The hub's side of it (the live hub, or a stand-in in tests). */
export type ChatHub = Pick<LiveHub, "chatRead" | "chatPost" | "chatIcon">;

/** The chat as this Worker instance last heard it (by room: the one chat, or a test's), shared by every request to it for a few seconds (like the live line). */
const cache = new Map<string, { at: number; snap: GlobalChatSnapshot }>();
const CACHE_MS = 3_000;
/** Forgets the cached chat (tests). */
export const forgetChatCache = () => void cache.clear();

export const SIGN_IN_TO_CHAT = "Sign in to chat. Guests can read.";
export const BANNED_FROM_CHAT = "Your account can't chat: it was banned for fair play.";
/** Chat is off for this account (the opt-in, off by default): nothing goes until they turn it on. */
export const CHAT_NOT_ON = "Turn on chat first.";

/** The global chat a request means: a test's own (`chatroom`) where the test switches are on, else the one chat (null). */
export const globalRoomOf = (room: unknown, testSwitches: boolean): string | null =>
  testSwitches && typeof room === "string" && /^[\w-]{1,40}$/.test(room) ? room : null;

/**
 * For GET /api/live?chat=N: the lines after N. Asking is what tells the hub someone has the chat open. `typed` false (a device the
 * age gate marked too young): players' typed lines are left out, as the town square's are; the preset lines and the bots' stay.
 */
export async function chatSlice(hub: ChatHub, since: number, now: number, o: { room?: string | null; typed?: boolean } = {}) {
  const key = o.room ?? "";
  let hit = cache.get(key);
  if (!hit || now - hit.at > CACHE_MS) {
    hit = { at: now, snap: await hub.chatRead(o.room ?? null) };
    if (cache.size > 60) cache.clear();
    cache.set(key, hit);
  }
  const slice = linesSince(hit.snap, since);
  return o.typed === false ? { ...slice, lines: slice.lines.filter((l) => !l.text) } : slice;
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });

/** GET /api/chat/icon/KEY: a drawn icon on a line in the chat, as a PNG the browser keeps (its key is its content). */
export async function chatIconResponse(hub: ChatHub, key: string): Promise<Response> {
  const icon = isIconKey(key) ? await hub.chatIcon(key) : null;
  const m = icon?.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return json({ message: "No such icon." }, 404);
  const bytes = Uint8Array.from(atob(m[1]!), (c) => c.charCodeAt(0));
  return new Response(bytes, { headers: { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable" } });
}

/** Who's posting, as the route needs it: the account, whether this device answered "too young", and the test switches. */
export interface ChatAsker {
  user: User;
  tooYoung: boolean;
  testSwitches?: boolean;
}

/**
 * POST /api/chat {text | say, since?}: a signed-in player (an email or Google, always, as for the town square's chat; guests read)
 * who has chat on (the opt-in, users.chat_on) types a message (`text`), or says a preset line (`say`: the quick chips a device the
 * age gate marked too young keeps). The account's name, rating, icon and packs come from the database, never from the request; the
 * hub runs the filter on typed text and checks the line, the one-message-every-5-s limit and the server-wide cap.
 */
export async function chatPostResponse(request: Request, sql: Sql, hub: ChatHub, a: ChatAsker, now: number): Promise<Response> {
  const { user } = a;
  if (!mayTownChat(user)) return json({ message: SIGN_IN_TO_CHAT }, 401);
  if (Number(request.headers.get("content-length")) > TOWN_BODY_MAX) return json({ message: typedTooLong(GLOBAL_CHAT.maxChars) }, 413);
  const raw = await request.text().catch(() => "");
  if (raw.length > TOWN_BODY_MAX) return json({ message: typedTooLong(GLOBAL_CHAT.maxChars) }, 413);
  const body = ((): { say?: unknown; text?: unknown; since?: unknown; chatroom?: unknown } => {
    try {
      return JSON.parse(raw) ?? {};
    } catch {
      return {};
    }
  })();
  const typed = typeof body.text === "string";
  if (!typed && typeof body.say !== "string") return json({ message: "Only the preset lines can go in the chat." }, 400);
  // (A line's id is short, a typed message at most TOWN_INPUT_MAX before it's tidied: nothing bigger goes on to the shared hub.)
  const said = typed ? { text: (body.text as string).slice(0, TOWN_INPUT_MAX) } : { say: (body.say as string).slice(0, 64) };
  if ((await caseOf(sql, user.id))?.status === "banned") return json({ message: BANNED_FROM_CHAT, banned: true }, 403);
  // A moderator's chat ban (chat-mod.ts): reading only.
  const block = await chatBlock(sql, user.id, now);
  if (block) return json({ message: CHAT_OFF, block }, 403);
  const row = await sql.first<{ name: string; icon: string | null; rating: number | null; chat_on: number | null }>("SELECT name, icon, rating, chat_on FROM users WHERE id = ?", user.id);
  if (row?.chat_on !== 1) return json({ message: CHAT_NOT_ON, chatOff: true }, 403);
  // (A name from before the name filter that it refuses goes out as "Player".)
  const name = row?.name ?? user.name;
  const sender: GlobalSender = {
    id: user.id,
    name: isBlockedText(name) ? "Player" : name,
    rating: typeof row?.rating === "number" ? Math.round(row.rating) : null,
    icon: row?.icon ?? null,
    owned: (await shopState(sql, user.id)).owned,
    typed: !a.tooYoung,
  };
  const room = globalRoomOf(body.chatroom, !!a.testSwitches);
  const { post, chat } = (await hub.chatPost(sender, said, room)) as { post: GlobalPost; chat: GlobalChatSnapshot };
  cache.set(room ?? "", { at: now, snap: chat });
  const since = Number(body.since);
  const slice = linesSince(chat, Number.isFinite(since) ? since : 0);
  const shown = a.tooYoung ? { ...slice, lines: slice.lines.filter((l) => !l.text) } : slice;
  if (post.ok) return json({ ok: true, line: post.line, chat: shown, waitMs: GLOBAL_CHAT.gapMs, ...(post.delayMs > 0 ? { delayMs: post.delayMs } : {}) });
  if (post.reason === "rate") return json({ ok: false, message: post.message, retryMs: post.retryMs, chat: shown }, 429, { "retry-after": String(Math.ceil(post.retryMs / 1000)) });
  if (post.reason === "busy") return json({ ok: false, message: post.message, busy: true, chat: shown }, 503, { "retry-after": "2" });
  return json({ ok: false, message: post.message, chat: shown }, post.reason === "typed" ? 403 : 400);
}
