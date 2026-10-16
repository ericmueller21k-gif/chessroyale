import { isBlocked } from "./friends.ts";
import { GLOBAL_CHAT, chatSay } from "@chessroyale/core";
import type { ChatBlock } from "@chessroyale/chess";
import { chatBlockText, mutes, setChatBlock } from "./chat-mod.ts";
import { rideLive } from "./live.ts";

/**
 * The home page's global chat, the app's side (the panel is components/GlobalChat.tsx). New lines ride on the live
 * line's request (GET /api/live?chat=N, every few seconds while the home screen is open), so there's no request,
 * poll or socket of its own. Posting is POST /api/chat; the server checks everything, and the app only mirrors its
 * one-message-every-30-s limit. At most GLOBAL_CHAT.keep lines are held, so nothing grows. See DECISIONS.md, "Global
 * chat on the home page".
 */

export interface GlobalLine {
  n: number;
  at: number;
  /** An account id (their profile), or a bot's name. */
  from: string;
  name: string;
  rating: number | null;
  bot?: true;
  /** An emoji icon (a pawn for bots and anyone without a drawing). */
  icon?: string;
  /** A drawn icon: /api/chat/icon/KEY. */
  iconKey?: string;
  say: string;
}

interface Slice {
  n: number;
  lines: GlobalLine[];
  reset?: true;
}

const isSlice = (x: unknown): x is Slice => !!x && typeof x === "object" && typeof (x as Slice).n === "number" && Array.isArray((x as Slice).lines);

export class GlobalChatStore {
  private list: GlobalLine[] = [];
  private last = 0;
  /** When (this device's clock) the server lets you post again, as far as the app knows. */
  private waitUntil = 0;
  /** Why the last line didn't go, if it didn't. */
  error: string | null = null;
  sending = false;
  /** Whether the server has answered yet (the panel says "Loading" until then). */
  loaded = false;
  private listeners = new Set<() => void>();
  private opened = 0;
  private unride: (() => void) | null = null;

  constructor(private keep = GLOBAL_CHAT.keep) {
    // (Someone muted in another chat: their lines go here too.)
    mutes.on(() => this.emit());
  }

  /** The lines to show, oldest first (muted players' left out, chat-mod.ts's mutes as in every chat, and blocked accounts'). */
  lines(): GlobalLine[] {
    return this.list.filter((l) => !mutes.has(l.from) && !isBlocked(l.from));
  }

  /** New lines from the server (the live line's answer, or a post's). */
  take(slice: unknown) {
    if (!isSlice(slice)) return;
    this.loaded = true;
    if (slice.reset) this.list = [];
    const fresh = slice.lines.filter((l) => l.n > (slice.reset ? 0 : this.last) && chatSay(l.say));
    if (fresh.length) this.list = [...this.list, ...fresh].slice(-this.keep);
    this.last = slice.reset ? slice.n : Math.max(this.last, slice.n);
    this.emit();
  }

  /** The panel is on screen: new lines ride on the live line until it's closed. */
  open(): () => void {
    if (this.opened++ === 0) {
      this.unride = rideLive({ query: () => `chat=${this.last}`, take: (b) => this.take((b as { chat?: unknown }).chat) });
    }
    return () => {
      if (--this.opened === 0) {
        this.unride?.();
        this.unride = null;
      }
    };
  }

  /** When you may post again (this device's clock): the server's answer, or your last line in the chat plus the gap. */
  readyAt(you: string | undefined): number {
    let mine = 0;
    for (const l of this.list) if (you && l.from === you && !l.bot) mine = l.at;
    // (The server's clock: never more than one gap from now, whatever this device's clock says.)
    return Math.max(this.waitUntil, mine ? Math.min(mine, Date.now()) + GLOBAL_CHAT.gapMs : 0);
  }

  async say(id: string, fetcher: typeof fetch = fetch) {
    if (this.sending) return;
    this.sending = true;
    this.error = null;
    this.emit();
    try {
      const res = await fetcher("/api/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ say: id, since: this.last }),
      });
      const body = (await res.json().catch(() => ({}))) as { chat?: unknown; waitMs?: number; retryMs?: number; message?: string; block?: ChatBlock };
      this.take(body.chat);
      if (res.ok) {
        this.waitUntil = Date.now() + (body.waitMs ?? GLOBAL_CHAT.gapMs);
        setChatBlock(null);
      } else if (body.block) {
        // Your chat is off (a moderator's chat ban): the panel says why instead of its buttons.
        setChatBlock(body.block);
        this.error = chatBlockText(body.block);
      } else {
        if (typeof body.retryMs === "number") this.waitUntil = Date.now() + body.retryMs;
        this.error = body.message ?? `That didn't go (${res.status}).`;
      }
    } catch {
      this.error = "Couldn't reach the server. Try again in a moment.";
    } finally {
      this.sending = false;
      this.emit();
    }
  }

  isMuted(id: string) {
    return mutes.has(id);
  }

  /** Mute (or unmute) someone, on this device: their lines go from every chat (chat-mod.ts). */
  mute(id: string, on: boolean) {
    mutes.set(id, on);
  }

  unmuteAll() {
    mutes.clear();
  }

  /** How many players are muted on this device (in any chat). */
  mutedCount() {
    return mutes.count;
  }

  clearError() {
    if (!this.error) return;
    this.error = null;
    this.emit();
  }

  on(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }
}

/** The one global chat. */
export const globalChat = new GlobalChatStore();
