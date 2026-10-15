import type { ChatBlock } from "@chessroyale/chess";
import { account, onAccountChange } from "./account.ts";

/**
 * Chat moderation, the app's side (the server's is server/src/chat-mod.ts; docs/areas/chat.md):
 *   - mutes: the players you muted, by account, on this device, for every chat (the global chat, lobbies, matches),
 *     until you unmute them. A player without an account (a bot) is muted for one match instead (chat.ts);
 *   - reporting a chat line (the server finds the line in its own copy and answers with what to tell you);
 *   - your own chat's pause (a moderator's chat ban, or reports waiting for a moderator): from your profile, or from
 *     what a chat's server said since. While it lasts, the chat panels show why instead of their buttons.
 */

const MUTE_KEY = "brc.muted";
/** The global chat's own list, from before mutes covered every chat (read once, then folded in). */
const OLD_KEY = "brc.globalChatMuted";
const MUTE_MAX = 300;

const read = (key: string): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

/** The players muted on this device (account ids), in the order they were muted. */
export class Mutes {
  private list: string[] | null = null;
  private listeners = new Set<() => void>();

  private get ids(): string[] {
    if (!this.list) {
      const old = read(OLD_KEY);
      this.list = [...new Set([...read(MUTE_KEY), ...old])].slice(-MUTE_MAX);
      if (old.length) {
        this.save();
        try {
          localStorage.removeItem(OLD_KEY);
        } catch {
          // (Read again next time.)
        }
      }
    }
    return this.list;
  }

  has(uid: string | undefined | null): boolean {
    return !!uid && this.ids.includes(uid);
  }

  set(uid: string, on: boolean) {
    const rest = this.ids.filter((x) => x !== uid);
    this.list = on ? [...rest, uid].slice(-MUTE_MAX) : rest;
    this.save();
    this.listeners.forEach((l) => l());
  }

  get count(): number {
    return this.ids.length;
  }

  clear() {
    this.list = [];
    this.save();
    this.listeners.forEach((l) => l());
  }

  on(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Forgets what it read (tests, and another tab's change on the next read). */
  reload() {
    this.list = null;
  }

  private save() {
    try {
      if (this.list?.length) localStorage.setItem(MUTE_KEY, JSON.stringify(this.list));
      else localStorage.removeItem(MUTE_KEY);
    } catch {
      // Kept for this visit only.
    }
  }
}

/** The one list of muted players on this device. */
export const mutes = new Mutes();

/** Your chat's pause as a chat's server last said it (undefined: nothing since your profile came). */
let said: ChatBlock | null | undefined;
onAccountChange(() => void (said = undefined));

/** A chat's server said your chat is paused (or, null, that a line went). */
export function setChatBlock(block: ChatBlock | null) {
  said = block;
}

/** Your chat's pause right now, if any. */
export function chatBlockNow(now = Date.now()): ChatBlock | null {
  const b = said !== undefined ? said : (account().profile?.chatMod?.block ?? null);
  return b && (b.until === null || b.until > now) ? b : null;
}

const day = (t: number) => new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** What the chat panels say while your chat is paused. */
export function chatBlockText(b: ChatBlock): string {
  if (b.auto) return "Your chat is paused while a moderator looks at reports about it.";
  return b.until ? `Your chat is off until ${day(b.until)}: a moderator's decision.` : "Your chat is off: a moderator's decision.";
}

/**
 * Reports a chat line: the line numbered `n` in a lobby's chat (`lobby`: its code) or, without one, the global chat.
 * Answers with what to tell you ("Reported. Thanks…", or why not).
 */
export async function reportChatLine(n: number, lobby?: string): Promise<string> {
  try {
    const res = await fetch("/api/chat/report", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ n, ...(lobby ? { lobby } : {}) }),
    });
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    return body.message ?? (res.ok ? "Reported." : `That didn't go (${res.status}).`);
  } catch {
    return "Couldn't reach the server. Try again in a moment.";
  }
}

/** You've read the moderators' notice (a warning, a chat ban): it won't show again. */
export async function chatNoticeSeen(): Promise<void> {
  await fetch("/api/chat/notice", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
}
