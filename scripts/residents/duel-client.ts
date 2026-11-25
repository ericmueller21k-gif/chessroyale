/**
 * One resident's ranked 1 v 1 game, through the game's object as the app's NetDuel plays it (packages/app/src/duel.ts;
 * docs/areas/ranked.md, "The protocol"): hello, the vote (a pick by temperament), moves drawn from Maia at the resident's rating
 * after a clock-aware think, rare draw offers, resigning lost games, quick chat (presets only), and what its behavior does (never
 * moving, stalling, walking away, a dropped socket that comes back). Moves carry their ply, so one resent after a reconnect is never
 * played twice.
 */
import WebSocket from "ws";
import { applyMove, legalMoves } from "@chessroyale/chess";
import { DUEL_PROTOCOL, type Color, type DuelClientMessage, type DuelServerMessage, type DuelView, type DuelOutcome } from "@chessroyale/chess/duel";
import { RESIDENTS, type Rng } from "@chessroyale/core";
import type { Api } from "./client.ts";
import { MoveSource, inCheck } from "./engine.ts";
import type { Profile } from "./profiles.ts";
import { acceptsDraw, chooseZone, materialEdge, shouldOfferDraw, shouldResign, thinkMs, type GamePlan } from "./play.ts";
import { between } from "./profiles.ts";

export type GameEnd =
  /** Played to its end (any result, an abort included). */
  | "over"
  /** This resident walked away (a leaver): the game goes on without it. */
  | "left"
  /** The game was gone, or never opened. */
  | "gone"
  /** The server turned residents away (PAUSE_RESIDENTS). */
  | "paused"
  /** The program is stopping: resigned. */
  | "stopped"
  | "error";

export interface GameReport {
  how: GameEnd;
  code: string;
  you: Color | null;
  /** The opponent's account, and whether it's one of ours. */
  opponent: { uid: string; name: string } | null;
  end: DuelView["end"];
  outcome: DuelOutcome | null;
  control: string | null;
  moves: number;
  /** Moves that weren't Maia's (it was down). */
  fallbacks: number;
  note?: string;
}

const sideOf = (moves: readonly string[]): Color => (moves.length % 2 === 0 ? "w" : "b");

export class DuelGameClient {
  private ws: WebSocket | null = null;
  private view: DuelView | null = null;
  private you: Color | null = null;
  private outcome: DuelOutcome | null = null;
  private offset = 0;
  private finished = false;
  private done: ((r: GameReport) => void) | null = null;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private reconnects = 0;
  /** The ply a move was sent for (awaiting the server's answer), and the ply a move is being chosen for. */
  private pending: number | null = null;
  private thinking: number | null = null;
  private picked = false;
  private greeted = false;
  private ggSent = false;
  private dropped = false;
  private answeredOffer = -1;
  private moves = 0;
  private fallbacks = 0;
  private endTimer = false;

  constructor(
    private readonly api: Api,
    readonly code: string,
    private readonly profile: Profile,
    private readonly engine: MoveSource,
    private readonly rng: Rng,
    private readonly plan: GamePlan,
    private readonly log: (line: string) => void,
  ) {}

  /** Plays the game to its end for this resident. */
  play(): Promise<GameReport> {
    return new Promise((resolve) => {
      this.done = resolve;
      // (A game never lasts this long: two Rapid clocks and their increments, and then some.)
      this.later(60 * 60_000, () => this.finish("error", "the game ran past an hour"));
      this.connect();
    });
  }

  /** The program is stopping (or the session must end at once): resign (an abort before both first moves), then close. */
  stop(): void {
    if (this.finished) return;
    if (this.view && !this.view.end) this.send({ t: "resign" });
    this.later(300, () => this.finish("stopped"));
  }

  /** The server paused residents: close at once, without a word. */
  pausedNow(): void {
    this.finish("paused");
  }

  private later(ms: number, fn: () => void) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      if (!this.finished) fn();
    }, Math.max(0, ms));
    this.timers.add(t);
  }

  private serverNow() {
    return Date.now() + this.offset;
  }

  private report(how: GameEnd, note?: string): GameReport {
    const v = this.view;
    const other = this.you && v ? v.players[this.you === "w" ? "b" : "w"] : null;
    return {
      how,
      code: this.code,
      you: this.you,
      opponent: other ? { uid: other.uid, name: other.name } : null,
      end: v?.end ?? null,
      outcome: this.outcome,
      control: v?.control ?? null,
      moves: this.moves,
      fallbacks: this.fallbacks,
      ...(note ? { note } : {}),
    };
  }

  private finish(how: GameEnd, note?: string) {
    if (this.finished) return;
    this.finished = true;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    try {
      this.ws?.close();
    } catch {
      // Closed already.
    }
    this.done?.(this.report(how, note));
  }

  private connect() {
    if (this.finished) return;
    const ws = this.api.socket(`/api/1v1/game/${this.code}/ws`);
    this.ws = ws;
    let opened = false;
    ws.on("open", () => {
      opened = true;
      this.reconnects = 0;
      this.send({ t: "hello", v: DUEL_PROTOCOL });
    });
    ws.on("message", (data: unknown) => {
      let m: DuelServerMessage;
      try {
        m = JSON.parse(String(data)) as DuelServerMessage;
      } catch {
        return;
      }
      this.onMessage(m);
    });
    ws.on("unexpected-response", (_req: unknown, res: { statusCode?: number }) => {
      // (Refused before it opened: 503 while residents are paused; 404 for a game that has ended.)
      if (res.statusCode === 503) this.finish("paused");
      else if (res.statusCode === 404) this.finish(this.view?.end ? "over" : "gone", "the game has ended");
      // (Anything else: dropped, and tried again as a lost connection is.)
      else ws.terminate();
    });
    ws.on("error", () => undefined);
    ws.on("close", (code: number) => {
      if (this.finished || this.ws !== ws) return;
      if (code === 4000) return this.finish(this.view?.end ? "over" : "gone", "the game has ended");
      // (A drop this resident made itself comes back after a few seconds, as a phone in a tunnel would.)
      if (this.dropped && opened) {
        this.dropped = false;
        this.log(`${this.profile.name}: socket dropped on purpose, back soon`);
        return this.later(between(this.rng, 2000, 8000), () => this.connect());
      }
      if (this.view?.end) return this.finish("over");
      if (++this.reconnects > 8) return this.finish("error", "connection lost");
      this.later(Math.min(8000, 500 * 2 ** this.reconnects), () => this.connect());
    });
  }

  private send(msg: DuelClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private onMessage(m: DuelServerMessage) {
    if (typeof m.now === "number") this.offset = m.now - Date.now();
    switch (m.t) {
      case "welcome":
        this.you = m.you;
        this.view = m.game;
        this.pending = null;
        break;
      case "game":
        this.view = m.game;
        this.pending = null;
        break;
      case "picks":
        if (this.view) this.view = { ...this.view, picks: m.picks };
        break;
      case "move": {
        const v = this.view;
        if (!v) break;
        const known = m.ply < v.moves.length;
        this.view = {
          ...v,
          fen: m.fen,
          moves: known ? v.moves.slice(0, m.ply).concat(m.uci) : [...v.moves, m.uci],
          sans: known ? v.sans.slice(0, m.ply).concat(m.san) : [...v.sans, m.san],
          clocks: m.clocks,
          turnAt: m.turnAt,
          running: m.running,
          firstMoveBy: m.firstMoveBy,
          drawOffer: m.drawOffer,
          canOffer: m.canOffer,
        };
        if (this.pending === m.ply) this.pending = null;
        // (A chatty resident reacts to the other side's capture now and then.)
        const mover: Color = m.ply % 2 === 0 ? "w" : "b";
        if (this.profile.behavior === "chatty" && this.you && mover !== this.you && !known && m.san.includes("x") && this.rng() < RESIDENTS.duel.chat.react) {
          this.later(between(this.rng, 800, 2500), () => this.chat(this.rng() < 0.5 ? "nice-move" : "wow"));
        }
        break;
      }
      case "moveNo":
        this.log(`${this.profile.name}: move refused (${m.reason})`);
        this.view = m.game;
        this.pending = null;
        break;
      case "draw":
        if (this.view) this.view = { ...this.view, drawOffer: m.drawOffer, canOffer: m.canOffer };
        break;
      case "presence":
        if (this.view) this.view = { ...this.view, connected: m.connected };
        break;
      case "outcome":
        this.outcome = m.outcome;
        if (this.view?.end) this.later(300, () => this.finish("over"));
        return;
      case "error":
        return this.finish("error", m.reload ? "protocol mismatch (the program is out of date)" : m.message);
      case "closed":
        return this.finish(this.view?.end ? "over" : "gone", m.reason);
      default:
        return;
    }
    this.act();
  }

  private chat(say: string) {
    this.send({ t: "chat", say });
  }

  /** What to do now, given the game as it stands (called after every message; each step is taken once). */
  private act() {
    const v = this.view;
    const me = this.you;
    if (!v || !me) return;
    if (v.end) {
      if (this.plan.gg && !this.ggSent && v.end.result !== "aborted") {
        this.ggSent = true;
        this.later(between(this.rng, 1000, 3000), () => this.chat("gg"));
      }
      // (The outcome follows the end; without one in a few seconds, the game is over all the same.)
      if (!this.endTimer) {
        this.endTimer = true;
        this.later(this.outcome ? 300 : 8000, () => this.finish("over"));
      }
      return;
    }
    // The vote: the pawn dragged into a zone a moment after the vote opens (by the clock: the server sends nothing then).
    if (!this.picked && v.voteAt !== null && (v.phase === "versus" || v.phase === "vote")) {
      this.picked = true;
      const at = v.voteAt - this.serverNow() + between(this.rng, RESIDENTS.duel.pickMs[0], RESIDENTS.duel.pickMs[1]);
      this.later(at, () => {
        if (this.view && !this.view.end && (this.view.phase === "versus" || this.view.phase === "vote")) this.send({ t: "pick", zone: chooseZone(this.profile, this.rng) });
      });
    }
    if (v.phase !== "play") return;
    if (this.plan.greet && !this.greeted) {
      this.greeted = true;
      this.later(between(this.rng, 500, 2500), () => this.chat(this.rng() < 0.5 ? "good-luck" : "have-fun"));
    }
    // The other side's draw offer: answered once, after a moment.
    const ply = v.moves.length;
    if (v.drawOffer && v.drawOffer !== me && this.answeredOffer !== ply) {
      this.answeredOffer = ply;
      const take = acceptsDraw(materialEdge(v.fen, me), ply, this.rng);
      this.later(between(this.rng, 1000, 4000), () => {
        if (this.view?.drawOffer && this.view.drawOffer !== me && !this.view.end) this.send({ t: take ? "draw" : "drawNo" });
      });
    }
    if (sideOf(v.moves) !== me || this.pending !== null || this.thinking === ply) return;
    void this.move(v, me, ply);
  }

  private async move(v: DuelView, me: Color, ply: number) {
    const mine = me === "w" ? Math.ceil(ply / 2) : Math.floor(ply / 2);
    // What its behavior does: never a first move (AFK), stalls (AFK), walks away (a leaver), a dropped socket (anyone).
    if (this.plan.noShow) return;
    if (this.plan.stallAfter !== null && mine >= this.plan.stallAfter) {
      if (this.thinking !== -2) this.log(`${this.profile.name}: AFK, stops moving (${this.code})`);
      this.thinking = -2;
      return;
    }
    if (this.plan.leaveAfter !== null && mine >= this.plan.leaveAfter) return this.finish("left", `walked away after ${mine} moves`);
    if (this.plan.dropAfter !== null && mine >= this.plan.dropAfter && !this.dropped) {
      this.plan.dropAfter = null;
      this.dropped = true;
      this.ws?.close();
      return;
    }
    this.thinking = ply;
    const edge = materialEdge(v.fen, me);
    if (ply >= 2 && shouldResign(edge, mine, this.profile.behavior, this.rng)) {
      this.log(`${this.profile.name}: resigns (${edge} in material, ${this.code})`);
      this.send({ t: "resign" });
      return;
    }
    const began = Date.now();
    const clockMs = v.running ? v.clocks[me] - Math.max(0, this.serverNow() - v.turnAt) : v.clocks[me];
    const inc = (v.clock?.incrementSeconds ?? 0) * 1000;
    const choice = await this.engine.choose(v.fen, this.profile.rating, this.rng);
    if (this.finished) return;
    const think = thinkMs({ ply, clockMs, incrementMs: inc, inCheck: inCheck(v.fen), close: choice.close, behavior: this.profile.behavior }, this.rng);
    this.later(think - (Date.now() - began), () => {
      const now = this.view;
      // (The game moved on meanwhile: a sync, a resend, the end.)
      if (!now || now.end || now.phase !== "play" || now.moves.length !== ply || this.thinking !== ply) return;
      if (!legalMoves(now.fen).includes(choice.move)) {
        this.thinking = null;
        return this.act();
      }
      if (now.canOffer[me] && !now.drawOffer && shouldOfferDraw(edge, ply, this.rng)) this.send({ t: "draw" });
      this.moves++;
      if (choice.fallback) this.fallbacks++;
      this.pending = ply;
      this.thinking = null;
      // (Shown at once, as the app does; the server's `move` confirms it, or `moveNo` puts the game back.)
      try {
        this.view = { ...now, fen: applyMove(now.fen, choice.move), moves: [...now.moves, choice.move] };
      } catch {
        // The server's answer will say.
      }
      this.send({ t: "move", uci: choice.move, ply });
    });
  }
}
