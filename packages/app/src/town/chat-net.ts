import { FAIRPLAY, TOWN_CHAT } from "@chessroyale/core";
import type { ChatBlock } from "@chessroyale/chess";
import { account, reportPlayer, tooYoung } from "../account.ts";
import { chatBlockNow, chatBlockText, mutes, setChatBlock } from "../chat-mod.ts";
import { isBlocked } from "../friends.ts";
import { rideLive, watchLive } from "../live.ts";
import { isPaused } from "../status.ts";

/**
 * The town square's typed chat, the app's side of the server (the log's look is chat.ts and TownChat.tsx; the server's
 * room is server/src/town-chat.ts). Players' lines ride on the live line's request (GET /api/live?town=N, every
 * FRONT_DOOR.livePollMs while the town is open and the tab is visible): no request, poll or socket of its own beyond
 * that. Sending is POST /api/town/chat; the server checks everything, and the app mirrors its numbers (TOWN_CHAT).
 *
 * Only a signed-in player on a device the age gate didn't mark too young asks for players' lines at all; anyone else's
 * log has the bosses' and kids' chatter alone. Muted and blocked players' lines never reach the log, and muting someone
 * takes their lines out of it. Parsing an answer happens in the request's callback, never in the town's frame loop.
 * docs/decisions/2026-10-28-town-chat-typing.md.
 */

export interface TownLine {
  /** Its number in the room (a report and a moderator's removal go by it). */
  n: number;
  /** When it was said (the server's clock). */
  at: number;
  /** Who said it: their account id. */
  from: string;
  name: string;
  text: string;
}

interface Slice {
  n: number;
  lines: TownLine[];
  gone?: number[];
  reset?: true;
}

/** Where players' lines go: the log. */
export interface TownSink {
  /** A player's line to show. */
  line(l: TownLine): void;
  /** Takes players' lines out of the log: those a moderator removed (by number) or a player you just muted. */
  drop(test: (l: { n: number; from: string }) => boolean): void;
  /** The chat was paused or came back (the switch: "Chat is paused."). */
  paused?(on: boolean): void;
}

/** Whether this device chats with other players in the town: a signed-in account, not on a device answered "too young". */
export const mayTownChat = () => !!account().profile?.user.signedIn && !tooYoung();

const isLine = (l: unknown): l is TownLine => {
  const x = l as TownLine;
  return !!x && typeof x.n === "number" && typeof x.at === "number" && typeof x.from === "string" && typeof x.name === "string" && typeof x.text === "string";
};
const isSlice = (x: unknown): x is Slice => !!x && typeof x === "object" && typeof (x as Slice).n === "number" && Array.isArray((x as Slice).lines);

/** The one feed (the town is open at most once). */
class TownFeed {
  /** The last line's number taken (the next ask is for lines after it). */
  last = 0;
  /** Whether the server last said the chat is paused. */
  pausedSaid = false;
  /** When (this device's clock) the server lets you send again, as far as the app knows. */
  waitUntil = 0;
  private sink: TownSink | null = null;

  /** The server's answer: the live line's `town`, or a send's. Lines from muted or blocked players never reach the log. */
  take(slice: unknown) {
    const sink = this.sink;
    if (!sink) return;
    if (slice && typeof slice === "object" && (slice as { paused?: unknown }).paused === true) return this.setPaused(true);
    if (!isSlice(slice)) return;
    this.setPaused(false);
    if (slice.gone?.length) {
      const gone = new Set(slice.gone);
      sink.drop((l) => gone.has(l.n));
    }
    const after = slice.reset ? 0 : this.last;
    for (const l of slice.lines) if (isLine(l) && l.n > after && !mutes.has(l.from) && !isBlocked(l.from)) sink.line(l);
    this.last = slice.reset ? slice.n : Math.max(this.last, slice.n);
  }

  /** The town opened its log: players' lines flow into `sink` until the returned function is called. */
  open(sink: TownSink): () => void {
    if (!mayTownChat()) return () => undefined;
    this.sink = sink;
    this.last = 0;
    this.pausedSaid = false;
    const unride = rideLive({ query: () => `town=${this.last}`, take: (b) => this.take((b as { town?: unknown }).town) });
    const unwatch = watchLive();
    // (Someone muted, here or in another chat: their lines leave the log.)
    const unmute = mutes.on(() => sink.drop((l) => mutes.has(l.from)));
    return () => {
      unride();
      unwatch();
      unmute();
      if (this.sink === sink) this.sink = null;
    };
  }

  private setPaused(on: boolean) {
    if (this.pausedSaid === on) return;
    this.pausedSaid = on;
    this.sink?.paused?.(on);
  }
}

const feed = new TownFeed();

/** Starts the players' lines into the log (nothing for a guest or a young device); call the answer to stop. */
export const openTownFeed = (sink: TownSink) => feed.open(sink);

/** The server's answer, taken as the live line's (tests). */
export const takeTownSlice = (slice: unknown) => feed.take(slice);

/**
 * Why the field can't send right now, as it shows in place of typing (null: it can): a guest, a young device, the
 * switch, your chat ban.
 */
export function townChatOff(now = Date.now()): string | null {
  if (!account().profile?.user.signedIn) return "Sign in to chat with other players.";
  if (tooYoung()) return "Chat with other players is for accounts 13 and older.";
  if (feed.pausedSaid || isPaused("town-chat")) return "Chat is paused.";
  const block = chatBlockNow(now);
  return block ? chatBlockText(block) : null;
}

/** How long until you may send again (ms; 0: now). */
export const townSendWaitMs = (now = Date.now()): number => Math.max(0, feed.waitUntil - now);

/** A message as the server tidies it (spaces run together and trimmed), and its length in characters (an emoji is one). */
export const tidyTownText = (text: string) => text.replace(/\s+/g, " ").trim();
export const townChars = (text: string) => [...text].length;

export type TownSendResult = { ok: true } | { ok: false; reason: "empty" | "wait" | "refused"; waitMs: number; message?: string };

/**
 * Sends a message as you. The app mirrors the server's numbers (TOWN_CHAT: at most `maxChars`, one every `gapMs`); the
 * server decides, and its reason comes back as `message` ("That message isn't allowed.", "No links or contact details
 * in chat.", …). Your line comes back in the answer and goes into the log like everyone's.
 */
export async function sendTownChat(raw: string, fetcher: typeof fetch = fetch): Promise<TownSendResult> {
  const text = tidyTownText(raw);
  if (!text) return { ok: false, reason: "empty", waitMs: 0 };
  const off = townChatOff();
  if (off) return { ok: false, reason: "refused", waitMs: 0, message: off };
  if (townChars(text) > TOWN_CHAT.maxChars) return { ok: false, reason: "refused", waitMs: 0, message: `Messages are at most ${TOWN_CHAT.maxChars} characters.` };
  const waitMs = townSendWaitMs();
  if (waitMs > 0) return { ok: false, reason: "wait", waitMs };
  try {
    const res = await fetcher("/api/town/chat", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, since: feed.last }),
    });
    const body = (await res.json().catch(() => ({}))) as { town?: unknown; waitMs?: number; retryMs?: number; reason?: string; message?: string; block?: ChatBlock; paused?: string };
    feed.take(body.town);
    if (res.ok) {
      feed.waitUntil = Date.now() + (body.waitMs ?? TOWN_CHAT.gapMs);
      setChatBlock(null);
      return { ok: true };
    }
    if (body.block) setChatBlock(body.block);
    if (body.paused === "town-chat") feed.take({ paused: true });
    // (The 15 s wait shows in the field as the count; a repeat or anything else says why.)
    if (body.reason === "rate" && typeof body.retryMs === "number") {
      feed.waitUntil = Date.now() + body.retryMs;
      return { ok: false, reason: "wait", waitMs: body.retryMs };
    }
    return { ok: false, reason: "refused", waitMs: 0, message: body.block ? chatBlockText(body.block) : (body.message ?? `That didn't go (${res.status}).`) };
  } catch {
    return { ok: false, reason: "refused", waitMs: 0, message: "Couldn't reach the server. Try again in a moment." };
  }
}

/** Report on a player's line: fair play's report, reason "Offensive chat", with the line (the server reads its words). */
export const reportTownLine = (l: Pick<TownLine, "from" | "n">) => reportPlayer(l.from, FAIRPLAY.reports.chatReason, undefined, l.n);

/** A moderator takes a line out of everyone's log. Answers what to say. */
export async function removeTownLine(n: number, fetcher: typeof fetch = fetch): Promise<string> {
  try {
    const res = await fetcher("/api/town/chat/remove", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ n }) });
    if (res.ok) {
      feed.take({ n: feed.last, lines: [], gone: [n] });
      return "Removed for everyone.";
    }
    return ((await res.json().catch(() => ({}))) as { message?: string }).message ?? `That didn't go (${res.status}).`;
  } catch {
    return "Couldn't reach the server. Try again in a moment.";
  }
}
