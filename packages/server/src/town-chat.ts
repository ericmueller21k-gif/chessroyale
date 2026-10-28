import { TOWN_CHAT } from "@chessroyale/core";
import { FILLERS, chatRefusal } from "./text-filter.ts";

/**
 * The town square's chat room, as pure logic (the live hub, live-hub.ts, keeps one). The one chat with typed messages
 * (Eric, Oct 28): signed-in players only (the Worker checks that before anything reaches here), at most
 * TOWN_CHAT.maxChars after trimming, one message per account every TOWN_CHAT.gapMs, not the same message again within
 * TOWN_CHAT.repeatMs, and through the filter (slurs, hate terms and swear words refused alike; links and contact details
 * refused with their own reason: text-filter.ts).
 *
 * Nothing is stored: the lines live in this object's memory for TOWN_CHAT.lineMs each, and a restart forgets them (a new
 * `room`, so every app starts its players' lines afresh). The live hub sweeps it on an alarm at the next line's minute
 * (`sweep`, `nextExpiry`), so nothing stays past it even in an empty town; what's kept for the wait and the repeat is
 * when and a hash of the words, never the words. A newcomer gets the last TOWN_CHAT.keep. A moderator can take one line
 * out (`remove`); its number is kept for the same minute so every reader's log drops it too.
 * See docs/decisions/2026-10-28-town-chat-typing.md.
 */

export interface TownLine {
  /** Its number, counting up (the app asks for the lines after the last one it has). */
  n: number;
  /** When it was said (ms, the server's clock). */
  at: number;
  /** Who said it: their account id (their profile, Mute and Report go by it). */
  from: string;
  /** From the account, never from the message. */
  name: string;
  /** What they typed, tidied (the filter has passed it). */
  text: string;
}

/** What the server knows of someone sending, from their account (never from the request). */
export interface TownSender {
  id: string;
  name: string;
}

export type TownPost =
  | { ok: true; line: TownLine }
  | { ok: false; reason: "text"; message: string }
  | { ok: false; reason: "rate" | "repeat"; message: string; retryMs: number };

export interface TownSnapshot {
  /** This room's id: a new one after a restart, so an app knows its line numbers start over. */
  room: string;
  /** The newest line's number (0 for none yet). */
  n: number;
  /** The lines held (said within TOWN_CHAT.lineMs), oldest first. */
  lines: TownLine[];
  /** Lines a moderator took out within the last TOWN_CHAT.lineMs: every log drops them. */
  gone: number[];
}

/** What a reader gets: the lines after the last one it has (at most TOWN_CHAT.keep, the newest), and lines taken out. */
export interface TownSlice {
  room: string;
  n: number;
  lines: TownLine[];
  gone?: number[];
  /** A new room (a restart), or the reader's count is ahead of it: the app forgets its players' lines and takes these. */
  reset?: true;
}

export type TownChatOptions = { [K in keyof typeof TOWN_CHAT]: number };

export const TOWN_TOO_LONG = `Messages are at most ${TOWN_CHAT.maxChars} characters.`;
export const TOWN_EMPTY = "Type a message first.";
export const TOWN_REPEAT = "You said that a moment ago.";
export const townWait = (gapMs: number) => `One message every ${Math.round(gapMs / 1000)} s.`;

/** The most of a message the Worker passes on to the room (the rest is cut before it leaves the Worker). */
export const TOWN_INPUT_MAX = 1024;

/**
 * A message as it's shown: invisible and control characters out (a zero-width joiner stays between two emoji, so 👩‍💻
 * and 🏳️‍🌈 hold together), fillers that show as nothing out, a pile of accents on one letter cut to two, spaces tidied and
 * trimmed. Null when it isn't text.
 */
export function tidyMessage(text: unknown): string | null {
  if (typeof text !== "string") return null;
  return text
    .slice(0, TOWN_INPUT_MAX)
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, " ")
    .replace(/(?!\u200D)\p{Cf}/gu, "")
    .replace(/(?<![\p{Extended_Pictographic}\uFE0F\u{1F3FB}-\u{1F3FF}])\u200D|\u200D(?!\p{Extended_Pictographic})/gu, "")
    .replace(FILLERS, "")
    .replace(/(\p{M}{2})\p{M}+/gu, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
/** A character made of more code points than this counts as its code points (a long joined chain, a pile of skin tones). */
export const CHAR_MAX_PARTS = 8;
/** At most this many code points in all (3 × maxChars), so 80 medium characters can't carry hundreds of emoji. */
export const TOWN_MAX_PARTS = 3 * TOWN_CHAT.maxChars;
/**
 * Its length as people count it: what shows as one character is one (an emoji with its skin tone, or joined into one, as
 * 👩‍💻), up to CHAR_MAX_PARTS code points; a "character" longer than that counts every code point, so 80 can't be beaten
 * with one huge one. The app counts the same way (chat-net.ts, `townChars`).
 */
export function charCount(text: string): number {
  let n = 0;
  for (const { segment } of graphemes.segment(text)) {
    const parts = [...segment].length;
    n += parts <= CHAR_MAX_PARTS ? 1 : parts;
  }
  return n;
}

/**
 * The same message, whatever its case, spacing, accents or punctuation ("gg!!" is "GG"), as a hash (53 bits): what the
 * room keeps to spot a repeat, never the words.
 */
export function sameKey(text: string): number {
  const key = text.normalize("NFKD").replace(/[\p{M}\p{Cf}]/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "") || text;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export class TownChat {
  /** This room's id (a new one with every start). */
  readonly room = crypto.randomUUID().slice(0, 8);
  private held: TownLine[] = [];
  private n = 0;
  private gone: { n: number; at: number }[] = [];
  /** Each account's messages within TOWN_CHAT.repeatMs: when, and a hash of what (`sameKey`), for the wait and the repeat. */
  private sent = new Map<string, { at: number; key: number }[]>();

  constructor(private o: TownChatOptions = TOWN_CHAT) {}

  /** When this account may send again (now or later). */
  readyAt(accountId: string, now: number): number {
    const last = this.sent.get(accountId)?.at(-1)?.at ?? -Infinity;
    return Math.max(now, last + this.o.gapMs);
  }

  /**
   * Someone sends. The Worker has already checked they're signed in, old enough, not banned and that the chat isn't
   * paused; this tidies the message and checks its length, the filter, the wait and the repeat. A refused message
   * doesn't start the wait.
   */
  post(sender: TownSender, raw: unknown, now: number): TownPost {
    const text = tidyMessage(raw);
    if (!text) return { ok: false, reason: "text", message: TOWN_EMPTY };
    if (charCount(text) > this.o.maxChars || [...text].length > TOWN_MAX_PARTS) return { ok: false, reason: "text", message: TOWN_TOO_LONG };
    const refused = chatRefusal(text);
    if (refused) return { ok: false, reason: "text", message: refused };
    const ready = this.readyAt(sender.id, now);
    if (ready > now) return { ok: false, reason: "rate", message: townWait(this.o.gapMs), retryMs: ready - now };
    this.sweep(now);
    const key = sameKey(text);
    const mine = this.sent.get(sender.id) ?? [];
    const same = mine.find((s) => s.key === key);
    if (same) return { ok: false, reason: "repeat", message: TOWN_REPEAT, retryMs: same.at + this.o.repeatMs - now };
    mine.push({ at: now, key });
    this.sent.set(sender.id, mine);
    const line: TownLine = { n: ++this.n, at: now, from: sender.id, name: sender.name, text };
    this.held.push(line);
    if (this.held.length > this.o.holdMax) this.held.splice(0, this.held.length - this.o.holdMax);
    return { ok: true, line };
  }

  /** The room now: the lines held and the ones taken out, each within TOWN_CHAT.lineMs. */
  snapshot(now: number): TownSnapshot {
    this.sweep(now);
    return { room: this.room, n: this.n, lines: this.held.slice(), gone: this.gone.map((g) => g.n) };
  }

  /** One line still held, by its number (a report reads what was said from here, never from the reporter). */
  line(n: number, now: number): TownLine | null {
    this.sweep(now);
    return this.held.find((l) => l.n === n) ?? null;
  }

  /** A moderator takes one line out: it leaves the room, and every log drops it. Whether it was there. */
  remove(n: number, now: number): boolean {
    const i = this.held.findIndex((l) => l.n === n);
    if (i < 0) return false;
    this.held.splice(i, 1);
    this.gone.push({ n, at: now });
    return true;
  }

  /**
   * A player's lines leave (a deleted account, or a moderator reset their name). Whether any did. Their wait to send
   * again stays (a deleted account's goes: `forget`).
   */
  dropAccount(accountId: string, now: number, forget = false): boolean {
    if (forget) this.sent.delete(accountId);
    const mine = this.held.filter((l) => l.from === accountId);
    for (const l of mine) this.remove(l.n, now);
    return mine.length > 0;
  }

  /**
   * Lines past their minute go, and so do old removals, and sends past the wait and the repeat (TOWN_CHAT.repeatMs). The
   * live hub calls it on its alarm too, at `nextExpiry`.
   */
  sweep(now: number) {
    const old = (at: number) => now - at >= this.o.lineMs;
    if (this.held.length && old(this.held[0]!.at)) this.held = this.held.filter((l) => !old(l.at));
    if (this.gone.length && old(this.gone[0]!.at)) this.gone = this.gone.filter((g) => !old(g.at));
    const keep = Math.max(this.o.repeatMs, this.o.gapMs);
    for (const [id, s] of this.sent) {
      const recent = s.filter((x) => now - x.at < keep);
      if (!recent.length) this.sent.delete(id);
      else if (recent.length !== s.length) this.sent.set(id, recent);
    }
  }

  /** When the next thing held goes (a line, a removal or a send), or null when the room holds nothing. */
  nextExpiry(): number | null {
    let at = Infinity;
    if (this.held.length) at = Math.min(at, this.held[0]!.at + this.o.lineMs);
    if (this.gone.length) at = Math.min(at, this.gone[0]!.at + this.o.lineMs);
    const keep = Math.max(this.o.repeatMs, this.o.gapMs);
    for (const s of this.sent.values()) if (s.length) at = Math.min(at, s[0]!.at + keep);
    return at === Infinity ? null : at;
  }

  /** Whether it holds anything at all (tests: nothing outlives its minute). */
  get empty(): boolean {
    return !this.held.length && !this.gone.length && !this.sent.size;
  }
}

/**
 * The lines after `since`, the newest TOWN_CHAT.keep at most. All of them again, marked `reset`, when the reader's room
 * isn't this one (a restart) or its count is ahead of it.
 */
export function townSince(snap: TownSnapshot, since: number, keep: number = TOWN_CHAT.keep, room?: string | null): TownSlice {
  const reset = !(since >= 0) || since > snap.n || (!!room && room !== snap.room);
  const lines = (reset ? snap.lines : snap.lines.filter((l) => l.n > since)).slice(-keep);
  return { room: snap.room, n: snap.n, lines, ...(snap.gone.length ? { gone: snap.gone } : {}), ...(reset ? { reset: true as const } : {}) };
}
