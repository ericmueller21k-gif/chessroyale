import type { ChatBlock } from "@chessroyale/chess";
import { d1Sql, ensureSchema, userFromToken, type Sql, type User } from "./accounts.ts";
import { SESSION_COOKIE, isSignedIn, readCookie, signInRequired, type AccountEnv } from "./api.ts";
import type { AdminEnv } from "./admin.ts";
import { ALREADY_REPORTED, MESSAGE_GONE, REPORTED, chatNoticeSeen, contextAround, reportChat, type ChatChannel, type ContextLine, type ReportedLine } from "./chat-mod.ts";
import { chatSay } from "@chessroyale/core";
import type { GlobalChatSnapshot, GlobalLine } from "./global-chat.ts";
import { liveHub } from "./live-hub.ts";

/**
 * Chat moderation's routes for players (chat-mod.ts): POST /api/chat/report and POST /api/chat/notice. The review
 * page is chat-mod-admin.ts. See docs/areas/chat.md.
 */

/** What a lobby (the Durable Object, lobby-do.ts) answers for chat moderation. */
export interface ChatModLobby {
  chatReportLine(userId: string, n: number): Promise<{ line: ReportedLine } | { error: string }>;
  chatStandingChanged(userId: string, block: ChatBlock | null): Promise<void>;
}

export interface ChatModEnv extends AccountEnv, AdminEnv {
  LOBBIES: { idFromName(name: string): DurableObjectId; get(id: DurableObjectId): ChatModLobby };
  /**
   * "1" (local and e2e only, never production): anyone may use the chat review page, but only while no way to sign
   * in is set up (so it can't open the page where accounts are real). Else admins only.
   */
  CHAT_MOD_TEST?: string;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export const SIGN_IN_TO_REPORT = "Sign in to report.";
const WHY_NOT: Record<string, string> = {
  gone: MESSAGE_GONE,
  bot: "That's a bot's line: bots only say the preset lines.",
  self: "That's your own message.",
};

/** A lobby's Durable Object by its code. */
export const lobbyOf = (env: Pick<ChatModEnv, "LOBBIES">, code: string) => env.LOBBIES.get(env.LOBBIES.idFromName(code));

/** The lobbies a channel list names ("lobby:CODE"), once each. */
export const lobbyCodes = (channels: readonly string[]) => [...new Set(channels.filter((c) => c.startsWith("lobby:")).map((c) => c.slice(6)))];

/**
 * The global chat's line numbered `n` as anyone reading it saw it (the hub's own copy), with the lines around it;
 * never a bot's line nor the reporter's own.
 */
export function globalReportLine(snap: GlobalChatSnapshot, reporterId: string, n: number): { line: ReportedLine } | { error: string } {
  const lines = [...snap.lines].sort((a, b) => a.n - b.n);
  const i = lines.findIndex((l) => l.n === n);
  const said = lines[i];
  if (!said) return { error: "gone" };
  if (said.bot) return { error: "bot" };
  if (said.from === reporterId) return { error: "self" };
  const words = (l: GlobalLine) => chatSay(l.say)?.text ?? l.say;
  const mark = (l: GlobalLine): ContextLine["mark"] => (l.n === n ? "this" : l.bot ? "bot" : l.from === said.from ? "sender" : l.from === reporterId ? "reporter" : undefined);
  const context = contextAround(lines, i).map((l) => {
    const m = mark(l);
    return { at: l.at, name: l.name, text: words(l), ...(m ? { mark: m } : {}) };
  });
  return { line: { target: said.from, name: said.name, text: words(said), saidAt: said.at, context } };
}

/**
 * POST /api/chat/report {n, lobby?}: a report about the line numbered `n` in a lobby's chat (its code) or the global
 * chat. Signed in, wherever a way to sign in is set up (as for chatting). The line comes from the server's own copy.
 */
async function report(request: Request, env: ChatModEnv, sql: Sql, me: User, now: number): Promise<Response> {
  if (signInRequired(env) && !isSignedIn(me)) return json({ message: SIGN_IN_TO_REPORT }, 401);
  const b = (await request.json().catch(() => ({}))) as { n?: unknown; lobby?: unknown };
  const n = Number(b.n);
  if (!Number.isInteger(n) || n < 1) return json({ message: "Which message?" }, 400);
  let channel: ChatChannel;
  let found: { line: ReportedLine } | { error: string };
  let lobby: ChatModLobby | null = null;
  if (b.lobby !== undefined) {
    const code = typeof b.lobby === "string" ? b.lobby.toUpperCase() : "";
    if (!/^[A-Z2-9]{5}$/.test(code)) return json({ message: "Which lobby?" }, 400);
    lobby = lobbyOf(env, code);
    channel = `lobby:${code}`;
    found = await lobby.chatReportLine(me.id, n).catch(() => ({ error: "gone" }));
  } else {
    if (!env.LIVE) return json({ message: "The chat isn't set up here." }, 503);
    channel = "global";
    found = globalReportLine((await liveHub(env as Required<Pick<AccountEnv, "LIVE">>).chatRead()) as GlobalChatSnapshot, me.id, n);
  }
  if ("error" in found) return json({ message: WHY_NOT[found.error] ?? MESSAGE_GONE }, found.error === "gone" ? 404 : 400);
  const r = await reportChat(sql, me, channel, found.line, now);
  if (!r.ok) return json({ message: r.message }, r.status);
  // Paused by this report: at once in the lobby it was made in (elsewhere when they next join or chat).
  if (r.block && lobby) await lobby.chatStandingChanged(found.line.target, r.block).catch(() => undefined);
  return json({ ok: true, ...(r.already ? { already: true } : {}), message: r.already ? ALREADY_REPORTED : REPORTED });
}

/** Chat moderation's routes for players; null for any other path. */
export async function handleChatMod(request: Request, env: ChatModEnv): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (!((path === "/api/chat/report" || path === "/api/chat/notice") && request.method === "POST")) return null;
  if (!env.DB) return json({ message: "Accounts aren't set up yet." }, 503);
  const sql = d1Sql(env.DB);
  await ensureSchema(sql, env.DB);
  const now = Date.now();
  const me = await userFromToken(sql, readCookie(request, SESSION_COOKIE), now);
  if (!me) return json({ message: "No account on this device yet." }, 401);
  if (path === "/api/chat/report") return report(request, env, sql, me, now);
  // POST /api/chat/notice: the player has read their chat notice (a warning, a chat ban).
  await chatNoticeSeen(sql, me.id);
  return json({ ok: true });
}
