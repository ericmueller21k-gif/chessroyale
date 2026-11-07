import { CHAT_TYPED, GLOBAL_CHAT, GLOBAL_CHAT_BOTS, canSayHome, chatSay, homeBotLine } from "@chessroyale/core";
import { BOT_NAMES } from "@chessroyale/chess";
import { TYPED_AGE, TYPED_EMPTY, typedText, typedTooLong } from "./typed-chat.ts";

/**
 * The global chat (the computer's right column), as pure logic (the live hub, live-hub.ts, keeps one and stores what it holds).
 * One shared room: typed messages (postText: CHAT_TYPED, the filter, GLOBAL_CHAT.maxChars) and the preset lines (post: canSayHome,
 * the quick chips a device the age gate marked too young keeps), one message per account every GLOBAL_CHAT.gapMs, at most
 * GLOBAL_CHAT.capCount a GLOBAL_CHAT.capWindowMs server-wide (the rest wait in line up to GLOBAL_CHAT.queueMs, then "Chat is busy"),
 * the last GLOBAL_CHAT.keep lines kept for newcomers, and, with GLOBAL_CHAT_BOTS on, a bot line every so often while someone
 * has the chat open. Nothing runs on a timer: bot lines are made when someone asks for the chat (watch), and a line waiting in line
 * is simply not shown until its time. DECISIONS.md, "Global chat on the home page"; docs/decisions/2026-11-07-typed-chat-column.md.
 */

export interface GlobalLine {
  /** Its number, counting up (the app asks for lines after the last one it has). */
  n: number;
  /** When it was said (ms). */
  at: number;
  /** Who said it: an account id (their profile), or for a bot its name. */
  from: string;
  /** From the account (or the bot list), never from the message. */
  name: string;
  /** Their ranking rating, when they have one. */
  rating: number | null;
  /** A bot (shown with a "bot" tag). */
  bot?: true;
  /** An emoji icon: older accounts' pick, or a pawn for bots and anyone without a drawing. */
  icon?: string;
  /** A drawn icon, served at GET /api/chat/icon/KEY (so each one is fetched once and cached by the browser). */
  iconKey?: string;
  /** A preset line's id (core/chat.ts)… */
  say?: string;
  /** …or what the player typed (tidied and passed by the filter): one or the other. */
  text?: string;
}

/** What the server knows of someone posting, from their account (never from the request). */
export interface GlobalSender {
  id: string;
  name: string;
  rating: number | null;
  /** Their icon: a drawing (a PNG data URL) or an emoji. */
  icon: string | null;
  /** Shop items owned (packs they can use). */
  owned: readonly string[];
  /** May type (signed in, and not on a device the age gate marked too young): else the preset lines only. */
  typed?: boolean;
}

export type GlobalPost =
  | { ok: true; line: GlobalLine; /** How long until it shows (0, or its wait in line while the chat is busy). */ delayMs: number }
  | { ok: false; reason: "unknown" | "typed" | "text"; message: string }
  | { ok: false; reason: "rate"; message: string; retryMs: number }
  | { ok: false; reason: "busy"; message: string };

/** What the sender hears when the server-wide line is longer than GLOBAL_CHAT.queueMs. */
export const CHAT_BUSY = "Chat is busy, try again.";
export { TYPED_AGE, TYPED_EMPTY, typedTooLong };
export const globalWait = (gapMs: number) => `One message every ${Math.round(gapMs / 1000)} s.`;

export interface GlobalChatSnapshot {
  /** The newest line's number (0 for none yet). */
  n: number;
  /** The lines kept, oldest first. */
  lines: GlobalLine[];
}

export type GlobalChatOptions = { [K in keyof typeof GLOBAL_CHAT]: (typeof GLOBAL_CHAT)[K] extends number ? number : (typeof GLOBAL_CHAT)[K] } & { bots: boolean; typed?: boolean };

export const PAWN = "♟";

/**
 * A test's own global chat (the test switches only: an e2e's `?chatroom=`): no bots, and a cap of one message a second with a 2 s line,
 * so a test can show "Chat is busy" with four players instead of fifty.
 */
export const TEST_GLOBAL_CHAT: GlobalChatOptions = { ...GLOBAL_CHAT, bots: false, capCount: 1, capWindowMs: 1_000, queueMs: 2_000 };

/** A short key for an icon's content (53-bit cyrb53, in hex): the same drawing always has the same key. */
export function iconKey(icon: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < icon.length; i++) {
    const c = icon.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

export const isIconKey = (k: unknown): k is string => typeof k === "string" && /^[0-9a-f]{14}$/.test(k);

const isDrawing = (icon: string | null | undefined): boolean => !!icon && icon.startsWith("data:image/png");

export class GlobalChat {
  private kept: GlobalLine[] = [];
  private n = 0;
  /** Drawn icons of the lines kept, by key. */
  private drawn = new Map<string, string>();
  /** When each account last posted (only those inside the gap are kept). */
  private lastPost = new Map<string, number>();
  private watchedAt = -Infinity;
  private botAt: number | null = null;
  /** When each of the latest messages shows (ascending): the server-wide cap's count. Only the last capWindowMs and those still waiting. */
  private shows: number[] = [];

  constructor(
    private o: GlobalChatOptions = { ...GLOBAL_CHAT, bots: GLOBAL_CHAT_BOTS },
    private rng: () => number = Math.random,
    private botNames: readonly string[] = BOT_NAMES,
  ) {}

  /** Back from storage (after a restart): the lines and the count. */
  restore(saved: GlobalChatSnapshot | null | undefined) {
    if (!saved || !Array.isArray(saved.lines)) return;
    this.kept = saved.lines.slice(-this.o.keep);
    this.n = Math.max(saved.n || 0, this.kept.at(-1)?.n ?? 0);
  }

  /** What to store: the count and the lines. */
  saved(): GlobalChatSnapshot {
    return { n: this.n, lines: this.kept };
  }

  /**
   * The lines a newcomer gets (the last GLOBAL_CHAT.keep, none older than maxAgeMs), and none still waiting in line: a line's `at` is
   * when it shows, and lines are numbered in that order, so what shows is always everything up to a number (`n`).
   */
  snapshot(now: number): GlobalChatSnapshot {
    const shown = this.kept.filter((l) => l.at <= now);
    const waiting = this.kept.find((l) => l.at > now);
    return { n: waiting ? waiting.n - 1 : this.n, lines: shown.filter((l) => now - l.at <= this.o.maxAgeMs) };
  }

  /** When this account may post again (now or later). */
  readyAt(accountId: string, now: number): number {
    // (When they last sent, as this object heard it; after a restart, their latest line kept. A kept line's `at` is when it showed, a
    // moment after it was sent if it waited in line, so it's read only when there's nothing better.)
    const last = this.lastPost.get(accountId) ?? Math.max(-Infinity, ...this.kept.filter((l) => l.from === accountId && !l.bot && l.at <= now).map((l) => l.at));
    return Math.max(now, last + this.o.gapMs);
  }

  /**
   * Someone posts. The server has already checked they're signed in and not banned; this checks the line is a preset
   * they own that suits the home page (anything else never reaches anyone) and the gap since their last message.
   */
  post(sender: GlobalSender, say: unknown, now: number): GlobalPost {
    if (!canSayHome(say, sender.owned)) {
      return { ok: false, reason: "unknown", message: chatSay(say) ? "That line can't go in the global chat." : "Only the preset lines can go in the chat." };
    }
    return this.send(sender, { say: say as string }, now);
  }

  /**
   * Someone types a message (CHAT_TYPED). The server has checked they're signed in, opted in and not banned; this checks they may
   * type (`sender.typed`: not a device the age gate marked too young), tidies it as the town square does, runs the filter on it
   * (anything it refuses never reaches anyone: "That message isn't allowed." or "No links or contact details in chat."), its length,
   * and then the limits. Nothing refused is kept.
   */
  postText(sender: GlobalSender, text: unknown, now: number): GlobalPost {
    if (!(this.o.typed ?? CHAT_TYPED)) return { ok: false, reason: "unknown", message: "Only the preset lines can go in the chat." };
    if (!sender.typed) return { ok: false, reason: "typed", message: TYPED_AGE };
    const t = typedText(text, this.o.maxChars);
    if (!t.ok) return { ok: false, reason: "text", message: t.message };
    return this.send(sender, { text: t.text }, now);
  }

  /**
   * When a message sent now would show under the server-wide cap: now, or the earliest moment that keeps every capWindowMs to
   * capCount (the line waits its turn). Shows are kept in order, so the capCount-th latest decides.
   */
  private showAt(now: number): number {
    this.shows = this.shows.filter((t) => t > now - this.o.capWindowMs);
    const k = this.shows.length - this.o.capCount;
    return k >= 0 ? Math.max(now, this.shows[k]! + this.o.capWindowMs) : now;
  }

  /** A checked message: the player's wait (one every gapMs), then the server-wide line (busy past queueMs); then it's kept. */
  private send(sender: GlobalSender, said: { say: string } | { text: string }, now: number): GlobalPost {
    const ready = this.readyAt(sender.id, now);
    if (ready > now) return { ok: false, reason: "rate", message: globalWait(this.o.gapMs), retryMs: ready - now };
    const at = this.showAt(now);
    if (at - now > this.o.queueMs) return { ok: false, reason: "busy", message: CHAT_BUSY };
    this.shows.push(at);
    // (Kept past the gap by the longest wait in line too, so the kept lines' show times are never read for someone who just sent.)
    for (const [id, t] of this.lastPost) if (now - t >= this.o.gapMs + this.o.queueMs) this.lastPost.delete(id);
    this.lastPost.set(sender.id, now);
    const drawing = isDrawing(sender.icon) ? sender.icon! : null;
    const key = drawing ? iconKey(drawing) : null;
    if (drawing && key) this.drawn.set(key, drawing);
    const icon = key ? { iconKey: key } : { icon: sender.icon?.trim() ? sender.icon.slice(0, 16) : PAWN };
    return { ok: true, line: this.add({ at, from: sender.id, name: sender.name, rating: sender.rating ?? null, ...icon, ...said }), delayMs: at - now };
  }

  /**
   * Someone has the chat open (their app asked for it). With bots on, a bot says something when one is due: the first
   * soon after someone opens it when nobody had it open, then about every GLOBAL_CHAT.botGapMs while anyone does.
   * Returns the bot's line, if one was said.
   */
  watch(now: number): GlobalLine | null {
    const wasWatched = now - this.watchedAt <= this.o.watchMs;
    this.watchedAt = now;
    if (!this.o.bots) return null;
    if (!wasWatched || this.botAt === null) {
      this.botAt = now + this.between(this.o.botFirstMs);
      return null;
    }
    if (now < this.botAt) return null;
    // (Never while players' lines wait in line: a bot's line would show ahead of them. It comes at its next turn.)
    if ((this.kept.at(-1)?.at ?? 0) > now) return null;
    this.botAt = now + this.between(this.o.botGapMs);
    const { name, say } = homeBotLine(this.rng, this.botNames, this.kept);
    return this.add({ at: now, from: name, name, rating: null, bot: true, icon: PAWN, say });
  }

  /** A player's own lines still kept (their download). */
  linesOf(accountId: string): GlobalLine[] {
    return this.kept.filter((l) => l.from === accountId && !l.bot);
  }

  /** A deleted account: its lines leave the chat (their drawn icons with them, by unusedIcons). Whether any did. */
  forgetAccount(accountId: string): boolean {
    this.lastPost.delete(accountId);
    return this.dropLines(accountId);
  }

  /** A player's lines leave the chat (a moderator reset their name and icon); their wait to post again stays. Whether any did. */
  dropLines(accountId: string): boolean {
    const before = this.kept.length;
    this.kept = this.kept.filter((l) => l.from !== accountId || !!l.bot);
    return this.kept.length !== before;
  }

  /** A drawn icon by its key (one on a line still kept). */
  icon(key: string): string | undefined {
    return this.drawn.get(key);
  }

  /** A drawn icon back from storage (after a restart), if a kept line still uses it. */
  rememberIcon(key: string, icon: string) {
    if (this.kept.some((l) => l.iconKey === key)) this.drawn.set(key, icon);
  }

  /** Keys of drawn icons no line uses any more (they're forgotten here; the hub deletes them from storage). */
  unusedIcons(): string[] {
    const used = new Set(this.kept.flatMap((l) => (l.iconKey ? [l.iconKey] : [])));
    const gone = [...this.drawn.keys()].filter((k) => !used.has(k));
    for (const k of gone) this.drawn.delete(k);
    return gone;
  }

  private between([lo, hi]: readonly [number, number]) {
    return Math.round(lo + this.rng() * (hi - lo));
  }

  private add(line: Omit<GlobalLine, "n">): GlobalLine {
    const full = { n: ++this.n, ...line } as GlobalLine;
    this.kept.push(full);
    if (this.kept.length > this.o.keep) this.kept.splice(0, this.kept.length - this.o.keep);
    return full;
  }
}

/** The lines after `since` (all of them if `since` is ahead of the server's count: it was reset). */
export function linesSince(snap: GlobalChatSnapshot, since: number): { n: number; lines: GlobalLine[]; reset?: true } {
  if (!(since >= 0) || since > snap.n) return { n: snap.n, lines: snap.lines, reset: true };
  return { n: snap.n, lines: snap.lines.filter((l) => l.n > since) };
}
