import { BANNED_LINE, HIDDEN_ROOM } from "@chessroyale/core";
import { testParams, testSwitchesAllowed } from "../test-switches.ts";
import { tooYoung } from "../account.ts";
import { mayTownChat } from "./chat-net.ts";
import { showBanNotice } from "../components/FairPlay.tsx";

/**
 * The Hidden Boss's room challenge, the app's side (Eric, Nov 12 and 13; the server's: server/src/hidden-room.ts; POST /api/town/hidden).
 * One client while you're at his room: `enter` on the stairs up (four at most: "The door is locked."), then a look every
 * HIDDEN_ROOM.pollMs while you're in it (where you stand, whether the page is hidden: the server drops a disconnect and a page hidden
 * too long; an idle player is dropped by the town's own away rule, watchAway, which takes them out of the town and so out of the room), Challenge,
 * Cancel, "Fill with 3 bots" (admins; the server checks), and `leave` (the stairs down, back, the town closed). Its answers are the
 * room as the server has it (`info`): the count ("2 of 4"), who's waiting, the others in the room, and your request's end (`onOutcome`,
 * once per end: into the fight, or "Sorry, not enough players."). Nothing here runs in a frame loop.
 */

/** Someone else in his room (server/src/hidden-room.ts `RoomPerson`): where they stand; a bot: null (the board's places). */
export interface RoomPerson {
  id: string;
  name: string;
  c: number | null;
  r: number | null;
  bot?: true;
}

/** How your request ended: into the fight (your pass, your seat), or not (its words). Each its own `n`. */
export type RoomOutcome = { n: number; kind: "fight"; lobby: string; pass: string; seat: number; names: string[] } | { n: number; kind: "ended"; message: string };

/** The room as the server last said. */
export interface RoomInfo {
  in: boolean;
  people: number;
  max: number;
  count: number;
  yours: boolean;
  names: string[];
  others: RoomPerson[];
  bots: boolean;
  /** You're an admin (the server's word: the test tools show). */
  admin?: boolean;
  outcome?: RoomOutcome;
  message?: string;
}

export type RoomAction = "enter" | "look" | "challenge" | "cancel" | "leave" | "fill";

const isInfo = (b: unknown): b is RoomInfo => {
  const x = b as RoomInfo;
  return !!x && typeof x.in === "boolean" && typeof x.count === "number" && Array.isArray(x.others) && Array.isArray(x.names);
};

/** The test switches' town (`?townroom=`, as here-net.ts): a test's own room, so other tests' players never walk in. */
function testRoom(): Record<string, unknown> {
  if (!testSwitchesAllowed()) return {};
  const room = testParams().get("townroom") ?? new URLSearchParams(location.search).get("townroom");
  return room ? { room } : {};
}

/** "2 of 4" (the request's count, for everyone in the room). */
export const countText = (count: number, max: number = HIDDEN_ROOM.players): string => `${count} of ${max}`;

export class HiddenRoomClient {
  info: RoomInfo | null = null;
  /** Not signed in (or too young): you watch the room, you aren't in its count, and Challenge says why (`refused`). */
  refused: string | null = null;
  /** A request in flight (the card's buttons wait). */
  busy = false;
  private subs = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private seen = new Set<number>();
  private done = false;
  private inFlight = false;

  constructor(
    /** Where you stand in the room (its squares); `idleMs` 0 (the town's own away rule handles idle: the header). */
    private readonly self: () => { c: number; r: number; idleMs: number } | null,
    /** Your request's end, once each. */
    private readonly onOutcome: (o: RoomOutcome) => void,
    /** The server says you're no longer in the room (a disconnect dropped you) and it's full now: you can't stay. */
    private readonly onShut: (message: string) => void,
  ) {}

  subscribe(cb: () => void): () => void {
    this.subs.add(cb);
    return () => this.subs.delete(cb);
  }

  private emit() {
    for (const cb of this.subs) cb();
  }

  /** One request to the server; its answer (null: none). `keepalive`: as the page closes. */
  async ask(action: RoomAction, keepalive = false): Promise<RoomInfo | null> {
    // (A guest, or a device the age gate marked too young: never in the room's count, so nothing to ask. The server refuses them too.)
    if (!mayTownChat() || tooYoung()) {
      if (!this.refused) {
        this.refused = tooYoung() ? "Online games are for accounts 13 and older." : "Sign in to challenge him.";
        this.emit();
      }
      return null;
    }
    const me = this.self();
    const body = { action, ...(me ? { c: me.c, r: me.r, idleMs: me.idleMs } : {}), hidden: document.hidden, ...testRoom() };
    try {
      const res = await fetch("/api/town/hidden", { method: "POST", credentials: "same-origin", keepalive, headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: keepalive ? undefined : AbortSignal.timeout(10_000) });
      const b = (await res.json().catch(() => null)) as unknown;
      if (res.status === 401 || res.status === 403) {
        const no = b as { message?: string; banned?: boolean } | null;
        // (Banned for fair play: fair play's notice, as PLAY shows it, with its appeal; the card's line the short of it, so the card
        // keeps its size; the room watches on, uncounted. Review M1.)
        this.refused = no?.banned ? BANNED_LINE : (no?.message ?? "Sign in to challenge him.");
        if (no?.banned) showBanNotice();
        this.emit();
        return null;
      }
      if (!res.ok || !isInfo(b)) {
        const m = (b as { message?: string } | null)?.message;
        if (m && this.info) this.info = { ...this.info, message: m };
        this.emit();
        return null;
      }
      if (this.done && action !== "leave") return b;
      this.info = b;
      if (b.outcome && !this.seen.has(b.outcome.n)) {
        this.seen.add(b.outcome.n);
        // (Into the fight, from any answer, a cancel's or a leave's racing the start too: the server has taken you out of the room, so
        // nothing more to ask. Review m1.)
        if (b.outcome.kind === "fight") {
          this.done = true;
          this.stop();
        }
        this.onOutcome(b.outcome);
      }
      this.emit();
      return b;
    } catch {
      return null;
    }
  }

  /**
   * The stairs up: in, or "The door is locked." (`locked`). A guest (or a device too young) watches: in, uncounted. No answer (the
   * server down): in, as a guest is, so the stairs never strand you. Your fight made meanwhile (a lost answer): not in, no words
   * (`message` null): its summoning takes you.
   */
  async enter(): Promise<{ ok: true } | { ok: false; message: string | null }> {
    this.done = false;
    const b = await this.ask("enter");
    if (b && !b.in) return { ok: false, message: this.done ? null : (b.message ?? "The door is locked.") };
    return { ok: true };
  }

  /** In the room: a look every HIDDEN_ROOM.pollMs until `stop`. */
  start() {
    this.stop();
    this.done = false;
    this.timer = setInterval(() => void this.look(), HIDDEN_ROOM.pollMs);
  }

  private async look() {
    if (this.done || this.inFlight || this.refused) return;
    this.inFlight = true;
    const b = await this.ask("look");
    this.inFlight = false;
    if (!b || this.done || b.in || b.outcome?.kind === "fight") return;
    // (Dropped meanwhile, a disconnect: back in if there's room; full, out you go.)
    const again = await this.ask("enter");
    if (again && !again.in && !this.done) this.onShut(again.message ?? "The door is locked.");
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async act(action: RoomAction) {
    if (this.busy) return;
    this.busy = true;
    this.emit();
    await this.ask(action);
    this.busy = false;
    this.emit();
  }

  challenge = () => this.act("challenge");
  cancel = () => this.act("cancel");
  fill = () => this.act("fill");

  /** Out of the room (and its request): the stairs down, back, the town closed. */
  leave(keepalive = false) {
    this.stop();
    if (this.done) return;
    this.done = true;
    if (!this.refused) void this.ask("leave", keepalive);
    this.info = null;
    this.emit();
  }

  /** Your request is in (leaving asks first: "Cancel your game request?"). */
  get waiting(): boolean {
    return !this.done && !!this.info?.yours;
  }
}
