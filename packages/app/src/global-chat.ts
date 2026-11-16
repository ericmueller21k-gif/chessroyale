import { isBlocked } from "./friends.ts";
import { GLOBAL_CHAT, chatSay } from "@chessroyale/core";
import type { ChatBlock } from "@chessroyale/chess";
import { chatBlockText, mutes, setChatBlock } from "./chat-mod.ts";
import { rideLive } from "./live.ts";
import { testSwitchesAllowed } from "./test-switches.ts";

/**
 * The global chat, the app's side (the panel is components/GlobalChat.tsx, in the computer's right column). New lines ride on the
 * live line's request (GET /api/live?chat=N, every few seconds while a front-door page is open), so there's no request, poll or
 * socket of its own. Posting is POST /api/chat (typed text, or a preset line's id); the server checks everything, and the app only
 * mirrors its one-message-every-5-s limit. At most GLOBAL_CHAT.keep lines are held, so nothing grows. DECISIONS.md, "Global chat
 * on the home page"; docs/decisions/2026-11-07-typed-chat-column.md.
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
  /** A preset line's id (core/chat.ts)… */
  say?: string;
  /** …or what the player typed (the server's filter passed it): one or the other. */
  text?: string;
}

/** A line's words as shown: what was typed, or the preset line's text (null: a line this app doesn't know). */
export const lineText = (l: Pick<GlobalLine, "say" | "text">): string | null => (typeof l.text === "string" ? l.text : (chatSay(l.say)?.text ?? null));

/**
 * `?chatroom=` as the page opened: a test's own global chat (the server keeps it apart only where its test switches are on; global-chat-api.ts
 * `globalRoomOf`), so an e2e can fill it without other tests' lines and bots.
 */
const ROOM_ASKED = (() => {
  try {
    return new URLSearchParams(globalThis.location?.search ?? "").get("chatroom");
  } catch {
    return null;
  }
})();
export const globalTestRoom = (): string | null => (ROOM_ASKED && testSwitchesAllowed() ? ROOM_ASKED : null);

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
  /** The last line went but waits its turn in line (the chat is busy): it shows in a few seconds. */
  late = false;
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
    const fresh = slice.lines.filter((l) => l.n > (slice.reset ? 0 : this.last) && lineText(l) !== null);
    if (fresh.length) this.list = [...this.list, ...fresh].slice(-this.keep);
    this.last = slice.reset ? slice.n : Math.max(this.last, slice.n);
    this.emit();
  }

  /** The panel is on screen: new lines ride on the live line until it's closed. */
  open(): () => void {
    if (this.opened++ === 0) {
      const room = globalTestRoom();
      this.unride = rideLive({ query: () => `chat=${this.last}${room ? `&chatroom=${encodeURIComponent(room)}` : ""}`, take: (b) => this.take((b as { chat?: unknown }).chat) });
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

  /** Says a preset line (the quick chips: a device the age gate marked too young, or CHAT_TYPED off). */
  say(id: string, fetcher: typeof fetch = fetch) {
    return this.send({ say: id }, fetcher);
  }

  /** Sends what you typed. True when it went (the field empties); false when it didn't (`error` says why, the words stay). */
  type(text: string, fetcher: typeof fetch = fetch) {
    return this.send({ text }, fetcher);
  }

  private async send(said: { say: string } | { text: string }, fetcher: typeof fetch): Promise<boolean> {
    if (this.sending) return false;
    this.sending = true;
    this.error = null;
    this.late = false;
    this.emit();
    let ok = false;
    try {
      const room = globalTestRoom();
      const res = await fetcher("/api/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...said, since: this.last, ...(room ? { chatroom: room } : {}) }),
      });
      const body = (await res.json().catch(() => ({}))) as { chat?: unknown; waitMs?: number; retryMs?: number; delayMs?: number; message?: string; block?: ChatBlock };
      this.take(body.chat);
      if (res.ok) {
        ok = true;
        this.waitUntil = Date.now() + (body.waitMs ?? GLOBAL_CHAT.gapMs);
        // (The chat is busy: it waits its turn in line and shows in a few seconds.)
        this.late = (body.delayMs ?? 0) > 0;
        setChatBlock(null);
      } else if (body.block) {
        // Your chat is off (a moderator's chat ban): the panel says why instead of its field.
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
    return ok;
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
    if (!this.error && !this.late) return;
    this.error = null;
    this.late = false;
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
