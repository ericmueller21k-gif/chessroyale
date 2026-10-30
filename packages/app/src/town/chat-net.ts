import { FAIRPLAY, TOWN_CHAT } from "@chessroyale/core";
import type { ChatBlock } from "@chessroyale/chess";
import { account, onAccountChange, reportPlayer, tooYoung } from "../account.ts";
import { chatBlockNow, chatBlockText, mutes, setChatBlock } from "../chat-mod.ts";
import { isBlocked, onFriendsChange } from "../friends.ts";
import { rideLive, watchLive } from "../live.ts";
import { isPaused } from "../status.ts";
import { pickNameColor } from "./names.ts";

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
  /** The name color their device picked when it joined the town (a number into the palette: names.ts); absent from an older app. */
  color?: number;
}

interface Slice {
  /** The room's id: a new one after the server's room restarted. */
  room?: string;
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
  /** The last line's number taken (the next ask is for lines after it), in this room. */
  last = 0;
  room: string | null = null;
  /** Whether the server last said the chat is paused. */
  pausedSaid = false;
  /** When (this device's clock) the server lets you send again, as far as the app knows. */
  waitUntil = 0;
  /** Your name color for this visit to the town: picked at random when it opens, sent with each message, the same all session. */
  color = pickNameColor();
  private sink: TownSink | null = null;

  /** The server's answer: the live line's `town`, or a send's. Lines from muted or blocked players never reach the log. */
  take(slice: unknown) {
    const sink = this.sink;
    if (!sink) return;
    if (slice && typeof slice === "object" && (slice as { paused?: unknown }).paused === true) return this.setPaused(true);
    if (!isSlice(slice)) return;
    this.setPaused(false);
    // A new room (the server's restarted) or a reset: its numbers start over, so the players' lines shown go first (a
    // Remove or a Report must never reach another line by an old number).
    const fresh = !!slice.reset || (!!slice.room && !!this.room && slice.room !== this.room);
    if (fresh) sink.drop(() => true);
    if (slice.room) this.room = slice.room;
    if (slice.gone?.length) {
      const gone = new Set(slice.gone);
      sink.drop((l) => gone.has(l.n));
    }
    const after = fresh ? 0 : this.last;
    for (const l of slice.lines) if (isLine(l) && l.n > after && !mutes.has(l.from) && !isBlocked(l.from)) sink.line(l);
    this.last = fresh ? slice.n : Math.max(this.last, slice.n);
  }

  /** The town opened its log: players' lines flow into `sink` until the returned function is called. */
  open(sink: TownSink): () => void {
    if (!mayTownChat()) return () => undefined;
    this.sink = sink;
    this.color = pickNameColor();
    this.last = 0;
    this.room = null;
    this.pausedSaid = false;
    const unride = rideLive({ query: () => `town=${this.last}${this.room ? `&room=${this.room}` : ""}`, take: (b) => this.take((b as { town?: unknown }).town) });
    const unwatch = watchLive();
    // (Someone muted, here or in another chat, or blocked: their lines leave the log at once.)
    const unmute = mutes.on(() => sink.drop((l) => mutes.has(l.from)));
    const unblock = onFriendsChange(() => sink.drop((l) => isBlocked(l.from)));
    // (Signed out, or the device marked too young: every player's line leaves the log at once.)
    const unaccount = onAccountChange(() => {
      if (!mayTownChat()) sink.drop(() => true);
    });
    return () => {
      unride();
      unwatch();
      unmute();
      unblock();
      unaccount();
      if (this.sink === sink) this.sink = null;
    };
  }

  /** The switch: while it's off, players' lines leave the log at once (the bosses' chatter stays). */
  private setPaused(on: boolean) {
    if (this.pausedSaid === on) return;
    this.pausedSaid = on;
    if (on) this.sink?.drop(() => true);
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

/** Your name color for this visit to the town (a number into names.ts' palette), as it goes out with your messages. */
export const townColor = (): number => feed.color;

/** How long until you may send again (ms; 0: now). */
export const townSendWaitMs = (now = Date.now()): number => Math.max(0, feed.waitUntil - now);

/** A message as the server tidies it (spaces run together and trimmed). */
export const tidyTownText = (text: string) => text.replace(/\s+/g, " ").trim();
/** What shows as one character, as the server cuts it (a browser without Intl.Segmenter: each code point). */
const graphemes = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
const pieces = (text: string): string[] => (graphemes ? [...graphemes.segment(text)].map((s) => s.segment) : [...text]);
/** A character's weight: one, or its code points when it's made of more than 8 (the server's `charCount`). */
const weight = (c: string) => {
  const parts = [...c].length;
  return parts <= 8 ? 1 : parts;
};
/** Its length as the server counts it: an emoji (with its skin tone, or joined into one) is one. */
export const townChars = (text: string): number => pieces(text).reduce((n, c) => n + weight(c), 0);
/** At most this many code points in all (3 × maxChars), as the server caps it. */
export const TOWN_MAX_PARTS = 3 * TOWN_CHAT.maxChars;
/** The text cut to `max` characters as the server counts them, and to TOWN_MAX_PARTS code points (the field stops there). */
export function cutTownText(text: string, max: number = TOWN_CHAT.maxChars): string {
  let n = 0;
  let parts = 0;
  let out = "";
  for (const c of pieces(text)) {
    n += weight(c);
    parts += [...c].length;
    if (n > max || parts > TOWN_MAX_PARTS) break;
    out += c;
  }
  return out;
}

export type TownSendResult = { ok: true } | { ok: false; reason: "empty" | "wait" | "refused"; waitMs: number; message?: string };

/**
 * Sends a message as you. The app mirrors the server's numbers (TOWN_CHAT: at most `maxChars`, one every `gapMs`): within the wait
 * it answers `wait` without asking the server at all (the screen says so in a line only you see). Otherwise the server decides,
 * and its reason comes back as `message` ("That message isn't allowed.", "No links or contact details in chat.", …). Your line
 * comes back in the answer and goes into the log like everyone's.
 */
export async function sendTownChat(raw: string, fetcher: typeof fetch = fetch): Promise<TownSendResult> {
  const text = tidyTownText(raw);
  if (!text) return { ok: false, reason: "empty", waitMs: 0 };
  const off = townChatOff();
  if (off) return { ok: false, reason: "refused", waitMs: 0, message: off };
  if (townChars(text) > TOWN_CHAT.maxChars || [...text].length > TOWN_MAX_PARTS) return { ok: false, reason: "refused", waitMs: 0, message: `Messages are at most ${TOWN_CHAT.maxChars} characters.` };
  const waitMs = townSendWaitMs();
  if (waitMs > 0) return { ok: false, reason: "wait", waitMs };
  try {
    const res = await fetcher("/api/town/chat", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, since: feed.last, color: feed.color, ...(feed.room ? { room: feed.room } : {}) }),
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
    // (The 15 s wait and anything else the server refuses come back to the log as a line only you see: TownChat.tsx.)
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
