import {
  QUICK_CHAT,
  canSayToAll,
  chatCheck,
  chatPicksOf,
  chatReadyAt,
  chatSay,
  chatSays,
  chatSent,
  noChatSent,
  ownedChatPacks,
  type ChatSay,
  type ChatSent,
  type ChatTo,
  type StoredChatPicks,
} from "@chessroyale/core";
import type { ChatRefusal, ClientMessage, NetChatLine } from "@chessroyale/chess";
import { chatBubbles, chatOff, onPrefsChange, setChatOff } from "./prefs.ts";
import { play } from "./sound.ts";

/** A chat line as this device keeps it: `at` is local time (when it shows). */
export type ChatLine = NetChatLine;

/**
 * An emoji floating on the scoreboard: from its sender's row, or from the header when the sender has no row there.
 * `team`: it went to everyone, from that side (the header's float shows their chip).
 */
export interface ChatFloat {
  text: string;
  key: number;
  team?: "w" | "b";
}

/** What the chat needs from its match. */
export interface ChatHost {
  code: () => string;
  me: () => string | null;
  send: (msg: ClientMessage) => void;
  emit: () => void;
  /** Server time to local time. */
  local: (serverTime: number) => number;
  /** Two teams talking separately (a 50 v 50, before any boss battle): the Team / All switch shows. */
  teams: () => boolean;
  /** The lines and emoji this player picked in their profile (their account's; missing: the defaults). */
  picks: () => StoredChatPicks | null | undefined;
}

/**
 * Quick chat in one online match: the lines this player can see, the icons that came with them, their packs, who
 * they muted, and the limits mirrored from the server (so the buttons grey out instead of failing). The server
 * decides everything; this only shows it.
 */
export class MatchChat {
  /** The server opened chat for this match (Crowd and boss raids, once the match has begun). */
  enabled = false;
  /** The packs the server knows this player owns (their buttons). */
  packs: string[] = ownedChatPacks([]);
  /** Who this player's lines go to (only Hello and Sporting lines, and emoji, can go to everyone). */
  to: ChatTo = "team";
  /** Senders' icons, kept as they come with their first line. */
  readonly icons = new Map<string, string>();
  private list: ChatLine[] = [];
  private mutedSet: Set<string> | null = null;
  private sent: ChatSent = noChatSent();
  /** The server said wait until then (local time). */
  private blockedUntil = 0;
  /** Lines up to this number have been seen (with chat on screen); later ones count as unread. */
  private seenN = 0;
  /** Chat panels on screen right now (while one is, nothing is unread and no bubble shows). */
  private onScreen = new Set<object>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private lastTick = 0;
  private offPrefs: (() => void) | null = null;

  constructor(private readonly host: ChatHost) {}

  /** Muted for this match (kept on the device with the lobby's code, so a reload keeps them). */
  private get muted(): Set<string> {
    if (!this.mutedSet) {
      this.mutedSet = new Set(this.loadMuted());
      // (A chat switch changed in a panel or in settings: redraw.)
      this.offPrefs ??= onPrefsChange(() => this.host.emit());
    }
    return this.mutedSet;
  }

  // ---------------- From the server ----------------

  /** Chat opened, or this player (re)joined: the recent lines and their packs. */
  onLog(lines: NetChatLine[], packs: string[]) {
    this.enabled = true;
    this.packs = packs.length ? packs : ownedChatPacks([]);
    const now = Date.now();
    const known = new Map(this.list.map((l) => [l.n, l]));
    for (const l of lines) {
      if (l.icon) this.icons.set(l.from, l.icon);
      known.set(l.n, { ...this.strip(l), at: this.host.local(l.at) });
    }
    this.list = [...known.values()].sort((a, b) => a.n - b.n).slice(-QUICK_CHAT.feedSize * 2);
    // What came with the log is history, not news.
    this.seenN = Math.max(this.seenN, ...this.list.filter((l) => l.at <= now).map((l) => l.n));
    for (const l of this.list) if (l.at > now) this.later(l);
    this.host.emit();
  }

  onLine(line: NetChatLine) {
    if (line.icon) this.icons.set(line.from, line.icon);
    if (this.list.some((l) => l.n === line.n)) return;
    const l = { ...this.strip(line), at: this.host.local(line.at) };
    this.list = [...this.list, l].sort((a, b) => a.n - b.n).slice(-QUICK_CHAT.feedSize * 2);
    if (l.at > Date.now() + 30) this.later(l);
    else this.arrived(l);
  }

  /** The server dropped a line: grey the buttons until it says. */
  onRefused(say: string, reason: ChatRefusal, retryAt: number) {
    if (reason === "gap" || reason === "burst") this.blockedUntil = Math.max(this.blockedUntil, this.host.local(retryAt));
    if (reason === "repeat") this.sent = { ...this.sent, last: { say, at: this.host.local(retryAt) - QUICK_CHAT.repeatMs } };
    this.wakeAt(this.readyAt());
    this.host.emit();
  }

  /** Once welcomed: tell the server this device's choices (chat off, who's muted). */
  onWelcome() {
    const muted = [...this.muted];
    if (chatOff() || muted.length) this.host.send({ t: "chatPrefs", ...(chatOff() ? { off: true } : {}), ...(muted.length ? { muted } : {}) });
  }

  // ---------------- Saying things ----------------

  /**
   * The buttons: the lines and emoji this player picked in their profile, in their order (the defaults until they
   * choose), among the packs the server knows they own.
   */
  picked(): { lines: ChatSay[]; emoji: ChatSay[] } {
    const p = chatPicksOf(this.host.picks(), this.packs);
    return { lines: chatSays(p.lines), emoji: chatSays(p.emoji) };
  }

  /** When anything can be sent again (local time). */
  readyAt(): number {
    return Math.max(chatReadyAt(this.sent), this.blockedUntil);
  }

  /** Whether this line's button works right now (owned, the switch allows it, within the limits). */
  canSay(id: string, now = Date.now()): boolean {
    const say = chatSay(id);
    if (!say || !this.packs.includes(say.pack) || chatOff()) return false;
    if (this.to === "all" && this.host.teams() && !canSayToAll(id)) return false;
    return now >= this.blockedUntil && chatCheck(this.sent, id, now).ok;
  }

  say(id: string) {
    const now = Date.now();
    if (!this.enabled || !this.canSay(id, now)) return;
    const to: ChatTo = this.to === "all" && this.host.teams() && canSayToAll(id) ? "all" : "team";
    this.host.send({ t: "chat", say: id, to });
    this.sent = chatSent(this.sent, id, now);
    // The buttons come back when the limits allow (and the repeat when it's allowed again).
    this.wakeAt(this.readyAt());
    this.wakeAt(now + QUICK_CHAT.repeatMs);
    this.host.emit();
  }

  setTo(to: ChatTo) {
    this.to = to;
    this.host.emit();
  }

  /** The match has two teams talking separately (a 50 v 50 before any boss battle): the Team / All switch shows. */
  hasTeams(): boolean {
    return this.host.teams();
  }

  // ---------------- Muting and off ----------------

  isMuted(id: string) {
    return this.muted.has(id);
  }

  mutedIds(): string[] {
    return [...this.muted];
  }

  /** Mutes (or unmutes) a player for this match: their lines and emoji disappear, and the server stops sending them. */
  mute(id: string, on: boolean) {
    if (id === this.host.me()) return;
    if (on) this.muted.add(id);
    else this.muted.delete(id);
    this.saveMuted();
    this.host.send({ t: "chatPrefs", muted: [...this.muted] });
    this.host.emit();
  }

  get off() {
    return chatOff();
  }

  setOff(off: boolean) {
    setChatOff(off);
    this.host.send({ t: "chatPrefs", off });
    this.host.emit();
  }

  // ---------------- What shows ----------------

  /** The feed: the last lines this player can see (shown now, not muted). */
  lines(now = Date.now()): ChatLine[] {
    return this.list.filter((l) => l.at <= now && !this.muted.has(l.from)).slice(-QUICK_CHAT.feedSize);
  }

  /** Lines that arrived while no chat was on screen (not your own). */
  unread(now = Date.now()): number {
    if (chatOff()) return 0;
    const me = this.host.me();
    return this.lines(now).filter((l) => l.n > this.seenN && l.from !== me).length;
  }

  /** A chat panel is on screen (it says so while it is): nothing is unread, and no bubble. */
  shown(panel: object, on: boolean) {
    const had = this.onScreen.size > 0;
    if (on) this.onScreen.add(panel);
    else this.onScreen.delete(panel);
    if (this.onScreen.size > 0) this.markSeen();
    if (had !== this.onScreen.size > 0) this.host.emit();
  }

  get visible() {
    return this.onScreen.size > 0;
  }

  /** The newest line from someone else, for the bubble: while chat is hidden, for QUICK_CHAT.bubbleMs after it shows. */
  bubble(now = Date.now()): ChatLine | null {
    if (chatOff() || !chatBubbles() || this.visible) return null;
    const me = this.host.me();
    const last = this.lines(now).filter((l) => l.from !== me).at(-1);
    return last && now - last.at < QUICK_CHAT.bubbleMs && last.n > this.seenBeforeBubble ? last : null;
  }
  /** Lines seen on screen before the panel was hidden don't bubble up again. */
  private seenBeforeBubble = 0;

  /**
   * Emoji floating above their senders' rows on the scoreboard right now (by sender). `team` marks one sent to
   * everyone (with the sender's side): a scoreboard without the sender's row (the other team's) floats it from its
   * header, with their team's chip.
   */
  floats(now = Date.now()): Map<string, ChatFloat> {
    const out = new Map<string, ChatFloat>();
    if (chatOff()) return out;
    for (const l of this.lines(now)) {
      const say = chatSay(l.say);
      if (say?.kind === "emoji" && now - l.at < QUICK_CHAT.emojiFloatMs)
        out.set(l.from, { text: say.text, key: l.n, ...(l.to === "all" && l.team && this.host.teams() ? { team: l.team } : {}) });
    }
    return out;
  }

  dispose() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.offPrefs?.();
  }

  // ---------------- Inside ----------------

  private strip(l: NetChatLine): ChatLine {
    const { icon: _icon, ...rest } = l;
    return rest;
  }

  private markSeen() {
    const top = Math.max(0, ...this.list.filter((l) => l.at <= Date.now()).map((l) => l.n));
    this.seenN = Math.max(this.seenN, top);
    this.seenBeforeBubble = this.seenN;
  }

  /** A line is on screen now: a soft tick for a team message, and everyone redraws (the feed, the bubble, a float). */
  private arrived(l: ChatLine) {
    const me = this.host.me();
    if (this.visible) this.markSeen();
    if (l.from !== me && l.to === "team" && !chatOff() && !this.muted.has(l.from) && Date.now() - this.lastTick > QUICK_CHAT.tickGapMs) {
      this.lastTick = Date.now();
      play("chat");
    }
    this.host.emit();
    // Redraw again once its bubble and float are over.
    this.wakeAt(l.at + Math.max(QUICK_CHAT.bubbleMs, QUICK_CHAT.emojiFloatMs) + 50);
  }

  /** A bot's line shows a moment after it was sent. */
  private later(l: ChatLine) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      this.arrived(l);
    }, Math.max(0, l.at - Date.now()));
    this.timers.add(t);
  }

  private wakeAt(at: number) {
    const ms = at - Date.now();
    if (ms <= 0 || ms > 120_000) return;
    const t = setTimeout(() => {
      this.timers.delete(t);
      this.host.emit();
    }, ms + 20);
    this.timers.add(t);
  }

  private mutedKey() {
    return `brc.chatMuted.${this.host.code()}`;
  }

  private loadMuted(): string[] {
    try {
      const v = JSON.parse(localStorage.getItem(this.mutedKey()) ?? "[]");
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  }

  private saveMuted() {
    try {
      if (this.muted.size) localStorage.setItem(this.mutedKey(), JSON.stringify([...this.muted]));
      else localStorage.removeItem(this.mutedKey());
    } catch {
      // Not important: the mute lasts until a reload.
    }
  }
}
