import { GLOBAL_CHAT, GLOBAL_CHAT_BOTS, canSayHome, chatSay, homeBotLine } from "@chessroyale/core";
import { BOT_NAMES } from "@chessroyale/chess";

/**
 * The home page's global chat, as pure logic (the live hub, live-hub.ts, keeps one and stores what it holds). One
 * shared room: preset lines only (canSayHome), one message per account every GLOBAL_CHAT.gapMs, the last
 * GLOBAL_CHAT.keep lines kept for newcomers, and, with GLOBAL_CHAT_BOTS on, a bot line every so often while someone
 * has the chat open. Nothing runs on a timer: bot lines are made when someone asks for the chat (watch), so nothing
 * happens while nobody is watching. See DECISIONS.md, "Global chat on the home page".
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
  /** The line's id (core/chat.ts). */
  say: string;
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
}

export type GlobalPost =
  | { ok: true; line: GlobalLine }
  | { ok: false; reason: "unknown"; message: string }
  | { ok: false; reason: "rate"; message: string; retryMs: number };

export interface GlobalChatSnapshot {
  /** The newest line's number (0 for none yet). */
  n: number;
  /** The lines kept, oldest first. */
  lines: GlobalLine[];
}

export type GlobalChatOptions = typeof GLOBAL_CHAT & { bots: boolean };

export const PAWN = "♟";

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

  /** The lines a newcomer gets (the last GLOBAL_CHAT.keep, none older than maxAgeMs). */
  snapshot(now: number): GlobalChatSnapshot {
    const lines = this.kept.filter((l) => now - l.at <= this.o.maxAgeMs);
    return { n: this.n, lines };
  }

  /** When this account may post again (now or later). */
  readyAt(accountId: string, now: number): number {
    const last = Math.max(this.lastPost.get(accountId) ?? -Infinity, ...this.kept.filter((l) => l.from === accountId && !l.bot).map((l) => l.at));
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
    const ready = this.readyAt(sender.id, now);
    if (ready > now) return { ok: false, reason: "rate", message: `One message every ${this.o.gapMs / 1000} s.`, retryMs: ready - now };
    for (const [id, at] of this.lastPost) if (now - at >= this.o.gapMs) this.lastPost.delete(id);
    this.lastPost.set(sender.id, now);
    const drawing = isDrawing(sender.icon) ? sender.icon! : null;
    const key = drawing ? iconKey(drawing) : null;
    if (drawing && key) this.drawn.set(key, drawing);
    const icon = key ? { iconKey: key } : { icon: sender.icon?.trim() ? sender.icon.slice(0, 16) : PAWN };
    return { ok: true, line: this.add({ at: now, from: sender.id, name: sender.name, rating: sender.rating ?? null, ...icon, say: say as string }) };
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
    this.botAt = now + this.between(this.o.botGapMs);
    const { name, say } = homeBotLine(this.rng, this.botNames, this.kept);
    return this.add({ at: now, from: name, name, rating: null, bot: true, icon: PAWN, say });
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
