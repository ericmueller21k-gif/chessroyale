import { GLOBAL_CHAT } from "@chessroyale/core";
import { shopState, type Sql, type User } from "./accounts.ts";
import { caseOf } from "./fairplay.ts";
import { isIconKey, linesSince, type GlobalChatSnapshot, type GlobalPost, type GlobalSender } from "./global-chat.ts";
import type { LiveHub } from "./live-hub.ts";

/**
 * The home page's global chat over HTTP. Reading rides on the live line's poll (GET /api/live?chat=N, which the home
 * screen already makes every few seconds): no new request, poll or socket. Posting is POST /api/chat {say}; a drawn
 * icon is GET /api/chat/icon/KEY, cached by the browser. See DECISIONS.md, "Global chat on the home page".
 */

/** The hub's side of it (the live hub, or a stand-in in tests). */
export type ChatHub = Pick<LiveHub, "chatRead" | "chatPost" | "chatIcon">;

/** The chat as this Worker instance last heard it, shared by every request to it for a few seconds (like the live line). */
let cache: { at: number; snap: GlobalChatSnapshot } | null = null;
const CACHE_MS = 3_000;
/** Forgets the cached chat (tests). */
export const forgetChatCache = () => void (cache = null);

export const SIGN_IN_TO_CHAT = "Sign in to chat. Guests can read.";
export const BANNED_FROM_CHAT = "Your account can't chat: it was banned for fair play.";

/** For GET /api/live?chat=N: the lines after N. Asking is what tells the hub someone has the chat open. */
export async function chatSlice(hub: ChatHub, since: number, now: number) {
  if (!cache || now - cache.at > CACHE_MS) cache = { at: now, snap: await hub.chatRead() };
  return linesSince(cache.snap, since);
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

/**
 * POST /api/chat {say, since?}: a signed-in player says a preset line (`mayPost`: signed in, wherever a way to sign in
 * is set up, as for online play; guests read). The account's name, rating, icon and packs come
 * from the database, never from the request; the hub checks the line and the one-message-every-30-s limit.
 */
export async function chatPostResponse(request: Request, sql: Sql, hub: ChatHub, user: User, mayPost: boolean, now: number): Promise<Response> {
  if (!mayPost) return json({ message: SIGN_IN_TO_CHAT }, 401);
  const body = (await request.json().catch(() => ({}))) as { say?: unknown; since?: unknown };
  if (typeof body.say !== "string") return json({ message: "Only the preset lines can go in the chat." }, 400);
  if ((await caseOf(sql, user.id))?.status === "banned") return json({ message: BANNED_FROM_CHAT, banned: true }, 403);
  const row = await sql.first<{ name: string; icon: string | null; rating: number | null }>("SELECT name, icon, rating FROM users WHERE id = ?", user.id);
  const sender: GlobalSender = {
    id: user.id,
    name: row?.name ?? user.name,
    rating: typeof row?.rating === "number" ? Math.round(row.rating) : null,
    icon: row?.icon ?? null,
    owned: (await shopState(sql, user.id)).owned,
  };
  const { post, chat } = (await hub.chatPost(sender, body.say)) as { post: GlobalPost; chat: GlobalChatSnapshot };
  cache = { at: now, snap: chat };
  const since = Number(body.since);
  const slice = linesSince(chat, Number.isFinite(since) ? since : 0);
  if (post.ok) return json({ ok: true, line: post.line, chat: slice, waitMs: GLOBAL_CHAT.gapMs });
  if (post.reason === "rate") return json({ ok: false, message: post.message, retryMs: post.retryMs, chat: slice }, 429, { "retry-after": String(Math.ceil(post.retryMs / 1000)) });
  return json({ ok: false, message: post.message, chat: slice }, 400);
}
