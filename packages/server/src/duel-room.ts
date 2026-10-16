import { QUICK_CHAT, RANKED_1V1, canSay, chatCheck, chatSay, chatSent, noChatSent, ownedChatPacks, type ChatSent } from "@chessroyale/core";
import { START_FEN, type ChatBlock, type ChatRefusal, type NetChatLine } from "@chessroyale/chess";
import {
  DUEL_PROTOCOL,
  callOff,
  canOfferDraw,
  clocksRun,
  declineDraw,
  firstMoveBy,
  gameControl,
  move,
  newDuel,
  nextDeadline,
  offerDraw,
  other,
  pick,
  resign,
  tick,
  type Color,
  type DuelClientMessage,
  type DuelEnd,
  type DuelGamePhase,
  type DuelOutcome,
  type DuelPlayerView,
  type DuelServerMessage,
  type DuelState,
  type DuelView,
} from "@chessroyale/chess/duel";
import type { FinishedDuel } from "./ranked.ts";

/**
 * One ranked 1 v 1 game's room, as pure logic (duel-do.ts is its Durable Object; docs/areas/ranked.md): the two seats,
 * who's connected, the game's timeline around the rules (@chessroyale/chess/duel), quick chat, and handing the
 * finished game over to be recorded. Its life:
 *   waiting (both players connect, within RANKED_1V1.joinSeconds, or it's called off) → versus (the "found" moment,
 *   versusMs) → the vote → the overlay → play → over (results kept resultsKeepMinutes, then it closes).
 * Every way it ends: a result, an abort (a first move that never came, Abort before both first moves), nobody turning
 * up, a flag when nobody's there any more. Nothing here waits on anything but time and the two players.
 */

export type DuelOutgoing = DuelServerMessage extends infer M ? (M extends unknown ? Omit<M, "now"> : never) : never;

export interface DuelIO {
  now(): number;
  send(c: Color, msg: DuelOutgoing): void;
  /** A socket of this side is open now. */
  connected(c: Color): boolean;
}

interface DuelChat {
  n: number;
  lines: NetChatLine[];
  sent: Partial<Record<Color, ChatSent>>;
  /** Each player's shop items (their chat packs), read when they connect. */
  owned: Partial<Record<Color, string[]>>;
  off: Partial<Record<Color, true>>;
  /** This side has muted the other (their lines aren't sent to it). */
  muted: Partial<Record<Color, true>>;
  /** Chat moderation: a side with a chat ban in force (it can't send), as the game's object last read it. */
  blocked?: Partial<Record<Color, ChatBlock>>;
}

export interface DuelRecord {
  code: string;
  /** Unique: the code and when it was made (a code is used again once its game has closed). */
  id: string;
  createdAt: number;
  players: Record<Color, DuelPlayerView>;
  /** Both players connected by then, or the game is called off. */
  joinBy: number;
  versusAt: number | null;
  game: DuelState | null;
  /** Called off before it began (nobody, or only one, turned up). */
  noShow: DuelEnd | null;
  /** A test's clock (seconds a side, no increment): the test switch `clock=`. */
  testSeconds: number | null;
  /** The finished game has been handed over to be recorded (and how often that failed). */
  handedOver: boolean;
  recordTries: number;
  /** What it did for each player (their rank, their coins), once recorded. */
  outcomes: Partial<Record<Color, DuelOutcome>> | null;
  /** When the room closes (its results kept until then). */
  closeAt: number | null;
  chat: DuelChat;
}

export function newDuelRecord(code: string, now: number, players: Record<Color, DuelPlayerView>, opts: { testSeconds?: number | null } = {}): DuelRecord {
  return {
    code,
    id: `${code}-${now.toString(36)}`,
    createdAt: now,
    players,
    joinBy: now + RANKED_1V1.joinSeconds * 1000,
    versusAt: null,
    game: null,
    noShow: null,
    testSeconds: opts.testSeconds && opts.testSeconds > 0 ? Math.min(3600, Math.round(opts.testSeconds)) : null,
    handedOver: false,
    recordTries: 0,
    outcomes: null,
    closeAt: null,
    chat: { n: 0, lines: [], sent: {}, owned: {}, off: {}, muted: {} },
  };
}

/** A recording that failed is tried again this long after, at most this many times. */
const RECORD_RETRY_MS = 15_000;
const RECORD_TRIES = 4;

export class DuelCore {
  constructor(
    readonly r: DuelRecord,
    private readonly io: DuelIO,
  ) {}

  /** The game's end, if it has ended (a result, an abort, or called off). */
  get end(): DuelEnd | null {
    return this.r.noShow ?? this.r.game?.end ?? null;
  }

  phase(now = this.io.now()): DuelGamePhase {
    if (this.end) return "over";
    const g = this.r.game;
    if (!g) return "waiting";
    if (g.phase === "vote" && now < g.voteAt) return "versus";
    return g.phase;
  }

  /** The game as both players see it. */
  view(): DuelView {
    const r = this.r;
    const g = r.game;
    const ctl = g?.control ? gameControl(g) : null;
    return {
      code: r.code,
      phase: this.phase(),
      players: r.players,
      versusAt: r.versusAt,
      voteAt: g?.voteAt ?? null,
      voteEndsAt: g?.voteEndsAt ?? null,
      picks: g?.picks ?? { w: null, b: null },
      control: g?.control ?? null,
      clock: ctl ? { baseSeconds: ctl.baseSeconds, incrementSeconds: ctl.incrementSeconds } : null,
      startsAt: g?.startsAt ?? null,
      fen: g?.fen ?? START_FEN,
      moves: g?.moves ?? [],
      sans: g?.sans ?? [],
      clocks: g?.clocks ?? { w: 0, b: 0 },
      turnAt: g?.turnAt ?? r.createdAt,
      running: !!g && clocksRun(g),
      firstMoveBy: g ? firstMoveBy(g) : null,
      drawOffer: g?.drawOffer ?? null,
      canOffer: { w: !!g && canOfferDraw(g, "w"), b: !!g && canOfferDraw(g, "b") },
      connected: { w: this.io.connected("w"), b: this.io.connected("b") },
      end: this.end,
    };
  }

  private both(msg: DuelOutgoing) {
    this.io.send("w", msg);
    this.io.send("b", msg);
  }

  /** The game in full to both: a phase changed, or the game ended. */
  private broadcastGame() {
    this.both({ t: "game", game: this.view() });
  }

  // ---------------- Coming and going ----------------

  /** A player connected (or reconnected): the game as it is, the chat so far; when both are here, the versus moment. */
  connect(c: Color) {
    this.advance();
    const outcome = this.r.outcomes?.[c];
    this.io.send(c, { t: "welcome", you: c, game: this.view(), v: DUEL_PROTOCOL });
    if (outcome) this.io.send(c, { t: "outcome", outcome });
    this.sendChatLog(c);
    this.both({ t: "presence", connected: { w: this.io.connected("w"), b: this.io.connected("b") } });
    this.startIfBoth();
  }

  /** A player's last socket closed: the other sees them gone (their clock keeps running; they can come back). */
  disconnect(c: Color) {
    this.io.send(other(c), { t: "presence", connected: { w: this.io.connected("w"), b: this.io.connected("b") } });
  }

  /** Both here, in time: the versus moment, then the vote. */
  private startIfBoth() {
    const now = this.io.now();
    if (this.r.game || this.r.noShow || !this.io.connected("w") || !this.io.connected("b")) return;
    this.r.versusAt = now;
    this.r.game = newDuel(now + RANKED_1V1.versusMs, { testSeconds: this.r.testSeconds });
    this.broadcastGame();
  }

  // ---------------- Time ----------------

  /**
   * Moves the room on to now: nobody (or one) turned up by joinBy, the vote closing, the start, a first move that
   * never came, a flag. Tells both players when the phase changed.
   */
  advance() {
    const now = this.io.now();
    const before = `${this.phase(now)}:${!!this.end}`;
    if (!this.r.game && !this.r.noShow && now >= this.r.joinBy) {
      const here = (["w", "b"] as const).filter((c) => this.io.connected(c));
      // (The one who didn't turn up, when one did.)
      this.r.noShow = { result: "aborted", reason: "no_show", by: here.length === 1 ? other(here[0]!) : null, at: this.r.joinBy };
    }
    if (this.r.game) this.r.game = tick(this.r.game, now);
    if (`${this.phase(now)}:${!!this.end}` !== before) this.broadcastGame();
    this.ended();
  }

  alarm() {
    this.advance();
  }

  /** When the room next has something to do: join time, the game's next deadline, a retry, its closing. */
  get nextAlarm(): number | null {
    const r = this.r;
    const times: number[] = [];
    if (!r.game && !r.noShow) times.push(r.joinBy);
    if (r.game && !r.game.end) {
      const d = nextDeadline(r.game);
      if (d !== null) times.push(d);
      // (The vote opens after the versus moment: no event of its own.)
    }
    if (this.end && !r.handedOver && r.recordTries > 0 && r.recordTries < RECORD_TRIES) times.push(this.end.at + r.recordTries * RECORD_RETRY_MS);
    if (r.closeAt !== null) times.push(r.closeAt);
    return times.length ? Math.min(...times) : null;
  }

  /** The game has just ended: results are kept a while, then the room closes. */
  private ended() {
    const end = this.end;
    if (end && this.r.closeAt === null) this.r.closeAt = this.io.now() + RANKED_1V1.resultsKeepMinutes * 60_000;
  }

  // ---------------- Recording ----------------

  /**
   * The finished game, to be recorded (ranks, coins, the kept game): once, and again after a failed try (`recordFailed`)
   * while tries are left. Null when there's nothing to record (not over, aborted, or handed over already).
   */
  takeFinished(): FinishedDuel | null {
    const r = this.r;
    const g = r.game;
    if (r.handedOver || !g?.end || g.end.result === "aborted" || r.recordTries >= RECORD_TRIES) return null;
    if (r.recordTries > 0 && this.io.now() < g.end.at + r.recordTries * RECORD_RETRY_MS) return null;
    r.handedOver = true;
    return {
      id: r.id,
      players: { w: r.players.w.uid, b: r.players.b.uid },
      control: g.control ?? RANKED_1V1.defaultControl,
      result: g.end.result,
      reason: g.end.reason,
      moves: g.moves,
      times: g.times,
      startedAt: g.startsAt ?? g.end.at,
      endedAt: g.end.at,
    };
  }

  /** The recording failed: tried again later (nextAlarm), a few times. */
  recordFailed() {
    this.r.handedOver = false;
    this.r.recordTries++;
  }

  /** The recording's answer: each player hears what the game did for them (null: nothing changed). */
  recorded(outcomes: Record<Color, DuelOutcome> | null) {
    const o = outcomes ?? { w: { change: null, coins: 0 }, b: { change: null, coins: 0 } };
    this.r.outcomes = o;
    for (const c of ["w", "b"] as const) this.io.send(c, { t: "outcome", outcome: o[c] });
  }

  // ---------------- What players send ----------------

  message(c: Color, msg: DuelClientMessage) {
    this.advance();
    const g = this.r.game;
    const now = this.io.now();
    switch (msg.t) {
      case "sync":
        this.io.send(c, { t: "game", game: this.view() });
        return;
      case "chat":
        return this.chatSay(c, msg.say);
      case "chatPrefs":
        return this.chatPrefs(c, msg.off, msg.muted);
      case "pick": {
        // (Before the vote opens, during the versus moment: nothing.)
        if (!g || now < g.voteAt) return;
        const r = pick(g, c, msg.zone, now);
        if (!r.ok) return;
        this.r.game = r.state;
        this.both({ t: "picks", picks: r.state.picks });
        return;
      }
      case "move": {
        if (!g || typeof msg.ply !== "number") return;
        // A move resent after it was played (a reconnect): nothing. One for another ply than the game is at: out of step.
        if (msg.ply < g.moves.length) return;
        if (msg.ply > g.moves.length) return this.io.send(c, { t: "moveNo", ply: msg.ply, reason: "step", game: this.view() });
        const r = move(g, c, msg.uci, now);
        this.r.game = r.state;
        if (!r.ok) {
          this.io.send(c, { t: "moveNo", ply: msg.ply, reason: r.reason, game: this.view() });
          return;
        }
        const s = r.state;
        this.both({
          t: "move",
          uci: msg.uci,
          san: r.san!,
          ply: s.moves.length - 1,
          fen: s.fen,
          clocks: s.clocks,
          turnAt: s.turnAt,
          running: clocksRun(s),
          firstMoveBy: firstMoveBy(s),
          drawOffer: s.drawOffer,
          canOffer: { w: canOfferDraw(s, "w"), b: canOfferDraw(s, "b") },
        });
        if (s.end) this.broadcastGame();
        this.ended();
        return;
      }
      case "resign": {
        // (Before both first moves, an abort: the vote and the versus moment included.)
        if (!g) {
          if (this.r.noShow) return;
          this.r.noShow = { result: "aborted", reason: "abort", by: c, at: now };
        } else {
          const r = resign(g, c, now);
          if (!r.ok) return;
          this.r.game = r.state;
        }
        this.broadcastGame();
        this.ended();
        return;
      }
      case "draw":
      case "drawNo": {
        if (!g) return;
        const r = msg.t === "draw" ? offerDraw(g, c, now) : declineDraw(g, c, now);
        if (!r.ok) return;
        this.r.game = r.state;
        if (r.state.end) {
          this.broadcastGame();
          this.ended();
        } else this.both({ t: "draw", drawOffer: r.state.drawOffer, canOffer: { w: canOfferDraw(r.state, "w"), b: canOfferDraw(r.state, "b") } });
        return;
      }
    }
  }

  // ---------------- Quick chat ----------------

  /** Who hears a line: chat on, and the sender not muted (their own lines always). */
  private hears(c: Color, line: NetChatLine): boolean {
    const ch = this.r.chat;
    if (ch.off[c]) return false;
    if (line.from === c) return true;
    return !ch.muted[c];
  }

  private sendChatLog(c: Color) {
    const ch = this.r.chat;
    this.io.send(c, { t: "chatLog", lines: ch.lines.filter((l) => this.hears(c, l)).slice(-QUICK_CHAT.feedSize), packs: ownedChatPacks(ch.owned[c]) });
  }

  /** A player's shop items (their chat packs), read as they connect. */
  chatOwned(c: Color, owned: readonly string[]) {
    this.r.chat.owned[c] = owned.filter((x) => typeof x === "string").slice(0, 200);
  }

  /**
   * Chat moderation (chat-mod.ts): a side's chat ban as the game's object read it (as they connect, and again at most
   * every CHAT_MOD.recheckMs as they chat). Null: none.
   */
  chatStanding(c: Color, block: ChatBlock | null) {
    const ch = this.r.chat;
    if (block) ch.blocked = { ...ch.blocked, [c]: block };
    else if (ch.blocked?.[c]) {
      const { [c]: _gone, ...rest } = ch.blocked;
      ch.blocked = rest;
    }
  }

  /**
   * A line from a player: only known lines they own, within the limits (QUICK_CHAT: one every 3 s, 5 in 30 s, no
   * repeats), and never from a player with a chat ban in force. There are no teams in a 1 v 1, so every line goes to
   * both (as the lobby's chat before a match).
   */
  private chatSay(c: Color, say: unknown) {
    const now = this.io.now();
    const ch = this.r.chat;
    const refuse = (reason: ChatRefusal, retryAt = now, block?: ChatBlock) =>
      this.io.send(c, { t: "chatNo", say: String(say).slice(0, 40), reason, retryAt, ...(block ? { block } : {}) });
    if (ch.off[c]) return refuse("off");
    const block = ch.blocked?.[c];
    if (block && (block.until === null || block.until > now)) return refuse("mod", block.until ?? now, block);
    const line = chatSay(say);
    if (!line) return refuse("unknown");
    if (!canSay(line.id, ch.owned[c])) return refuse("locked");
    const sent = ch.sent[c] ?? noChatSent();
    const check = chatCheck(sent, line.id, now);
    if (!check.ok) return refuse(check.limit, check.retryAt);
    ch.sent[c] = chatSent(sent, line.id, now);
    const full: NetChatLine = { n: ++ch.n, from: c, say: line.id, to: "all", team: null, at: now };
    ch.lines = [...ch.lines, full].slice(-QUICK_CHAT.logSize);
    for (const to of ["w", "b"] as const) if (this.hears(to, full)) this.io.send(to, { t: "chat", line: full });
  }

  /** This device's chat choices: chat off, and whether it muted the other player (by their side: "w" or "b"). */
  private chatPrefs(c: Color, off: unknown, muted: unknown) {
    const ch = this.r.chat;
    const wasOff = !!ch.off[c];
    const wasMuted = !!ch.muted[c];
    if (off === true) ch.off[c] = true;
    else if (off === false) delete ch.off[c];
    if (Array.isArray(muted)) {
      if (muted.includes(other(c))) ch.muted[c] = true;
      else delete ch.muted[c];
    }
    // Back on, or unmuted: the lines missed meanwhile.
    if ((wasOff && !ch.off[c]) || (wasMuted && !ch.muted[c])) this.sendChatLog(c);
  }
}
