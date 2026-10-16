import { BOSS_BRAIN, ENGINE_MAX_ELO, ENGINE_MIN_ELO, RANKED_1V1, botLook, rankView, type DuelZone, type ItemLook, type RankView } from "@chessroyale/core";
import { applyMove, toSan, type ClientMessage, type HumanUciEngine } from "@chessroyale/chess";
import {
  DUEL_PROTOCOL,
  canOfferDraw,
  clocksRun,
  declineDraw,
  firstMoveBy,
  gameControl,
  move as playMove,
  newDuel,
  nextDeadline,
  offerDraw,
  other,
  pick as castPick,
  resign as resignGame,
  tick,
  type Color,
  type DuelClientMessage,
  type DuelEnd,
  type DuelGamePhase,
  type DuelOutcome,
  type DuelServerMessage,
  type DuelState,
  type DuelView,
} from "@chessroyale/chess/duel";
import { MatchChat } from "./chat.ts";
import { account } from "./account.ts";
import { maiaAllowed } from "./boss-brain.ts";
import { ownEngine } from "./engine.ts";
import { startMaia } from "./maia.ts";
import { crumb } from "./problems.ts";
import { testParams } from "./test-switches.ts";

/**
 * Ranked 1 v 1 in the app (docs/areas/ranked.md): the queue (`DuelQueue`), a game against a person through its
 * server object (`NetDuel`), and the unranked bot game played on this device by the same rules (`BotDuel`). Both
 * games give the screens one shape, `DuelSnapshot`, so the board, the vote, the clocks and the result card are the
 * same either way. The server decides everything in a person's game; the app only shows it, and plays your own move on
 * the board at once while the server confirms it.
 */

/** A player as the screens show them. */
export interface DuelSide {
  /** Their account (for their profile); null for the bot. */
  uid: string | null;
  name: string;
  look: ItemLook | null;
  rank: RankView;
  bot?: boolean;
}

/** Everything a 1 v 1 screen draws, in this device's time. */
export interface DuelSnapshot {
  /** The game's code (null: the bot game). */
  code: string | null;
  bot: boolean;
  you: Color;
  phase: DuelGamePhase;
  players: Record<Color, DuelSide>;
  versusAt: number | null;
  voteAt: number | null;
  voteEndsAt: number | null;
  picks: Record<Color, DuelZone | null>;
  /** The control the vote gave (its id), and the clock it plays. */
  control: string | null;
  clock: { baseSeconds: number; incrementSeconds: number } | null;
  startsAt: number | null;
  fen: string;
  moves: readonly string[];
  sans: readonly string[];
  lastMove: string | null;
  clocks: Record<Color, number>;
  turnAt: number;
  running: boolean;
  firstMoveBy: number | null;
  drawOffer: Color | null;
  canOffer: Record<Color, boolean>;
  connected: Record<Color, boolean>;
  end: DuelEnd | null;
  /** What the game did for you (your rank, your coins), once the server has recorded it. */
  outcome: DuelOutcome | null;
  /** The game can't be shown (refused, ended before you got there), and why. */
  gone: string | null;
}

/** A side's time left at `now` (only the side to move's runs, and only once the clocks run). */
export function clockAt(s: Pick<DuelSnapshot, "clocks" | "turnAt" | "running" | "moves">, c: Color, now: number): number {
  const toMove: Color = s.moves.length % 2 === 0 ? "w" : "b";
  return s.running && c === toMove ? Math.max(0, s.clocks[c] - Math.max(0, now - s.turnAt)) : s.clocks[c];
}

/** What the screens drive. */
export interface DuelSession {
  snapshot(): DuelSnapshot;
  subscribe(fn: () => void): () => void;
  pick(zone: DuelZone): void;
  move(uci: string): void;
  /** Resign; before both first moves, abort. */
  resign(): void;
  /** Offer a draw, or accept the other side's offer. */
  draw(): void;
  drawNo(): void;
  /** Quick chat (none in the bot game). */
  readonly chat: MatchChat | null;
  dispose(): void;
}

const wsBase = () => `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;
const sideOf = (moves: readonly string[]): Color => (moves.length % 2 === 0 ? "w" : "b");

/** Your own side as the screens show it: your account's name, look and 1 v 1 rank. */
function yourSide(): DuelSide {
  const p = account().profile;
  return { uid: p?.user.id ?? null, name: p?.user.name ?? "You", look: p?.locker?.look ?? null, rank: p?.ranked1v1?.rank ?? rankView(null) };
}

// ---------------- A game against a person ----------------

/**
 * A ranked game through its server object (`/api/1v1/game/CODE/ws`): the game's view as the server sends it, its
 * times turned into this device's; your move shown at once (the server's answer confirms it, or puts the board back).
 * A dropped socket reconnects (your clock keeps running meanwhile); a game that has gone is said so.
 */
export class NetDuel implements DuelSession {
  private view: DuelView | null = null;
  private you: Color = "w";
  private outcome: DuelOutcome | null = null;
  private gone: string | null = null;
  /** Your move shown before the server's answer (its ply). */
  private pending: number | null = null;
  private ws: WebSocket | null = null;
  private offset = 0;
  private retry = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private listeners = new Set<() => void>();

  readonly chat = new MatchChat({
    code: () => `1v1-${this.code}`,
    me: () => this.you,
    send: (m: ClientMessage) => {
      if (m.t === "chat") this.send({ t: "chat", say: m.say });
      else if (m.t === "chatPrefs") this.send({ t: "chatPrefs", ...(m.off !== undefined ? { off: m.off } : {}), ...(m.muted ? { muted: m.muted } : {}) });
    },
    emit: () => this.emit(),
    local: (t) => this.local(t),
    teams: () => false,
    picks: () => account().profile?.shop?.chat,
    // (Each side's account: a mute is by account, for every chat on this device.)
    uidOf: (id) => (id === "w" || id === "b" ? this.view?.players[id].uid : undefined),
    seats: () => ["w", "b"],
  });

  constructor(readonly code: string) {}

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  private local(t: number): number {
    return t - this.offset;
  }

  connect() {
    if (this.closed) return;
    const ws = new WebSocket(`${wsBase()}/api/1v1/game/${this.code}/ws`);
    this.ws = ws;
    let opened = false;
    ws.onopen = () => {
      opened = true;
      this.retry = 0;
      this.send({ t: "hello", v: DUEL_PROTOCOL });
    };
    ws.onmessage = (e) => this.onMessage(JSON.parse(e.data as string) as DuelServerMessage);
    ws.onclose = (e) => {
      if (this.closed) return;
      if (e.code === 4000) return this.goneNow("That game has ended.");
      const again = () => {
        if (this.closed) return;
        this.retryTimer = setTimeout(() => this.connect(), Math.min(8000, 500 * 2 ** this.retry++));
      };
      if (opened) return again();
      // Refused before it opened (a refused socket says nothing about why): ask.
      void duelStatus(this.code).then((s) => (s && !s.open ? this.goneNow(s.message ?? "That game has ended.") : again()));
    };
    document.addEventListener("visibilitychange", this.onVisible);
  }

  private onVisible = () => {
    if (document.visibilityState !== "visible" || this.closed || !this.retryTimer) return;
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.connect();
  };

  private goneNow(why: string) {
    // (A finished game keeps its result on screen; only a game that never showed says it's gone.)
    if (!this.view?.end) this.gone = why;
    this.dispose();
    this.emit();
  }

  dispose() {
    this.closed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    document.removeEventListener("visibilitychange", this.onVisible);
    this.chat.dispose();
    try {
      this.ws?.close();
    } catch {
      // Already closed.
    }
  }

  private send(msg: DuelClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  /** The server's view, in this device's time. */
  private localView(g: DuelView): DuelView {
    const l = (t: number | null) => (t === null ? null : this.local(t));
    return {
      ...g,
      versusAt: l(g.versusAt),
      voteAt: l(g.voteAt),
      voteEndsAt: l(g.voteEndsAt),
      startsAt: l(g.startsAt),
      turnAt: this.local(g.turnAt),
      firstMoveBy: l(g.firstMoveBy),
      end: g.end ? { ...g.end, at: this.local(g.end.at) } : null,
    };
  }

  private onMessage(msg: DuelServerMessage) {
    if (typeof msg.now === "number") this.offset = msg.now - Date.now();
    switch (msg.t) {
      case "welcome":
        this.you = msg.you;
        this.view = this.localView(msg.game);
        this.pending = null;
        this.chat.onWelcome();
        break;
      case "game":
        this.view = this.localView(msg.game);
        this.pending = null;
        break;
      case "picks":
        if (this.view) this.view = { ...this.view, picks: msg.picks };
        break;
      case "move": {
        const v = this.view;
        if (!v) break;
        const known = msg.ply < v.moves.length;
        this.view = {
          ...v,
          fen: msg.fen,
          moves: known ? v.moves.slice(0, msg.ply).concat(msg.uci) : [...v.moves, msg.uci],
          sans: known ? v.sans.slice(0, msg.ply).concat(msg.san) : [...v.sans, msg.san],
          clocks: msg.clocks,
          turnAt: this.local(msg.turnAt),
          running: msg.running,
          firstMoveBy: msg.firstMoveBy === null ? null : this.local(msg.firstMoveBy),
          drawOffer: msg.drawOffer,
          canOffer: msg.canOffer,
        };
        if (this.pending === msg.ply) this.pending = null;
        break;
      }
      case "moveNo":
        crumb(`1v1 move refused: ${msg.reason}`);
        this.view = this.localView(msg.game);
        this.pending = null;
        break;
      case "draw":
        if (this.view) this.view = { ...this.view, drawOffer: msg.drawOffer, canOffer: msg.canOffer };
        break;
      case "presence":
        if (this.view) this.view = { ...this.view, connected: msg.connected };
        break;
      case "outcome":
        this.outcome = msg.outcome;
        break;
      case "chat":
        this.chat.onLine(msg.line);
        break;
      case "chatLog":
        this.chat.onLog(msg.lines, msg.packs);
        break;
      case "chatNo":
        this.chat.onRefused(msg.say, msg.reason, msg.retryAt, msg.block);
        break;
      case "error":
        this.gone = msg.message;
        break;
      case "closed":
        this.closed = true;
        break;
    }
    this.emit();
  }

  snapshot(): DuelSnapshot {
    const v = this.view;
    const you = this.you;
    const fallback: DuelSide = { uid: null, name: "…", look: null, rank: rankView(null) };
    // (The versus moment ends at the vote's opening by the clock: the server sends nothing then.)
    const phase: DuelGamePhase = v ? (v.phase === "versus" && v.voteAt !== null && Date.now() >= v.voteAt ? "vote" : v.phase) : "waiting";
    return {
      code: this.code,
      bot: false,
      you,
      phase,
      players: v ? { w: { ...v.players.w }, b: { ...v.players.b } } : { w: you === "w" ? yourSide() : fallback, b: you === "b" ? yourSide() : fallback },
      versusAt: v?.versusAt ?? null,
      voteAt: v?.voteAt ?? null,
      voteEndsAt: v?.voteEndsAt ?? null,
      picks: v?.picks ?? { w: null, b: null },
      control: v?.control ?? null,
      clock: v?.clock ?? null,
      startsAt: v?.startsAt ?? null,
      fen: v?.fen ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      moves: v?.moves ?? [],
      sans: v?.sans ?? [],
      lastMove: v?.moves.at(-1) ?? null,
      clocks: v?.clocks ?? { w: 0, b: 0 },
      turnAt: v?.turnAt ?? Date.now(),
      running: v?.running ?? false,
      firstMoveBy: v?.firstMoveBy ?? null,
      drawOffer: v?.drawOffer ?? null,
      canOffer: v?.canOffer ?? { w: false, b: false },
      connected: v?.connected ?? { w: false, b: false },
      end: v?.end ?? null,
      outcome: this.outcome,
      gone: this.gone,
    };
  }

  pick(zone: DuelZone) {
    const v = this.view;
    if (!v || this.snapshot().phase !== "vote") return;
    // (Shown at once; the server's "picks" confirms it.)
    this.view = { ...v, picks: { ...v.picks, [this.you]: zone } };
    this.send({ t: "pick", zone });
    this.emit();
  }

  move(uci: string) {
    const v = this.view;
    if (!v || v.phase !== "play" || v.end || sideOf(v.moves) !== this.you || this.pending !== null) return;
    let fen: string;
    let san: string;
    try {
      san = toSan(v.fen, uci);
      fen = applyMove(v.fen, uci);
    } catch {
      return;
    }
    const ply = v.moves.length;
    const now = Date.now();
    const inc = (v.clock?.incrementSeconds ?? 0) * 1000;
    // Your move on the board at once, your clock stopped where it was (with the increment): the server's answer
    // confirms it with its own numbers.
    this.view = {
      ...v,
      fen,
      moves: [...v.moves, uci],
      sans: [...v.sans, san],
      clocks: v.running ? { ...v.clocks, [this.you]: clockAt(v, this.you, now) + inc } : v.clocks,
      turnAt: now,
      running: v.running || ply >= 1,
      firstMoveBy: ply === 0 ? now + RANKED_1V1.firstMoveSeconds * 1000 : null,
      drawOffer: v.drawOffer === this.you ? v.drawOffer : null,
    };
    this.pending = ply;
    crumb(`1v1 move ${uci}`);
    this.send({ t: "move", uci, ply });
    this.emit();
  }

  resign() {
    this.send({ t: "resign" });
  }

  draw() {
    this.send({ t: "draw" });
  }

  drawNo() {
    this.send({ t: "drawNo" });
  }
}

/** GET /api/1v1/game/CODE: whether a game is still open (null: no answer). */
export async function duelStatus(code: string): Promise<{ open: boolean; phase?: string; message?: string } | null> {
  try {
    const res = await fetch(`/api/1v1/game/${code}`);
    return (await res.json()) as { open: boolean; phase?: string; message?: string };
  } catch {
    return null;
  }
}

// ---------------- The bot game ----------------

/** The bot's own random draws (a pick, its thinking time). */
const rnd = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

/**
 * The unranked bot game (the queue's "Play a bot (unranked)"): played on this device by the game's own rules, against
 * Maia at your hidden rating (the bosses' human-like engine, its own draw from its likeliest moves), or Stockfish at
 * that strength while Maia loads, if it can't load here, or above its ceiling (RANKED_1V1.bot). The same vote and
 * board as a ranked game; no chat, no rank, no coins, nothing recorded.
 */
export class BotDuel implements DuelSession {
  readonly chat = null;
  private state: DuelState;
  private readonly players: Record<Color, DuelSide>;
  private readonly you: Color;
  private readonly versusAt: number;
  private listeners = new Set<() => void>();
  private ticker: ReturnType<typeof setInterval> | null = null;
  private thinking: number | null = null;
  private maia: HumanUciEngine | null = null;
  private disposed = false;

  constructor(private readonly rating: number) {
    const now = Date.now();
    this.you = Math.random() < 0.5 ? "w" : "b";
    const look = botLook(`bot-${Math.floor(Math.random() * 1e9)}`).look;
    const bot: DuelSide = { uid: null, name: "Bot", look, rank: { ...rankView(null), placement: null, tier: "Bot", label: "Unranked" }, bot: true };
    this.players = this.you === "w" ? { w: yourSide(), b: bot } : { w: bot, b: yourSide() };
    this.versusAt = now;
    const test = Number(testParams().get("clock"));
    this.state = newDuel(now + RANKED_1V1.versusMs, { testSeconds: Number.isFinite(test) && test > 0 ? test : null });
    // The bot's pick, a moment into the vote (or none, now and then: then yours decides).
    const voteAt = this.state.voteAt;
    const zones: DuelZone[] = ["bullet", "blitz", "rapid"];
    setTimeout(() => this.botPick(zones[Math.floor(Math.random() * 3)]!), voteAt - now + rnd(800, 3500));
    this.ticker = setInterval(() => this.tick(), 100);
    // Maia loads during the versus moment and the vote (from the service worker's cache after the first time).
    if (maiaAllowed() && rating >= RANKED_1V1.bot.maiaMin && rating <= RANKED_1V1.bot.maiaMax) this.maia = startMaia(BOSS_BRAIN.loadTimeoutMs);
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  private get botColor(): Color {
    return other(this.you);
  }

  private set(next: DuelState) {
    const changed = next !== this.state;
    this.state = next;
    if (changed) this.emit();
  }

  private botPick(zone: DuelZone) {
    if (this.disposed) return;
    const r = castPick(this.state, this.botColor, zone, Date.now());
    if (r.ok) this.set(r.state);
  }

  private tick() {
    if (this.disposed) return;
    const now = Date.now();
    const before = this.state;
    const next = tick(before, now);
    if (next.phase !== before.phase || next.end !== before.end) this.set(next);
    else this.state = next;
    if (this.state.end) return this.stopTicker();
    if (this.state.phase === "play" && sideOf(this.state.moves) === this.botColor && this.thinking !== this.state.moves.length) void this.think(this.state.moves.length);
  }

  private stopTicker() {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
    this.maia?.close();
    this.maia = null;
  }

  /** The bot's move at this ply: an engine's, after a think that fits its clock. */
  private async think(ply: number) {
    this.thinking = ply;
    const s = this.state;
    const started = Date.now();
    const [lo, hi] = RANKED_1V1.bot.thinkMs;
    const left = clocksRun(s) ? s.clocks[this.botColor] : RANKED_1V1.firstMoveSeconds * 1000;
    const think = Math.max(200, Math.min(rnd(lo, hi), left * RANKED_1V1.bot.clockShare));
    let move: string | null = null;
    try {
      move = await this.engineMove(s.fen, think);
    } catch {
      move = null;
    }
    const wait = think - (Date.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if (this.disposed || this.state.moves.length !== ply || this.state.end || !move) return;
    const r = playMove(this.state, this.botColor, move, Date.now());
    if (r.ok) this.set(r.state);
  }

  /** Maia's own draw at the player's rating when it's ready, else Stockfish at that strength. */
  private async engineMove(fen: string, budgetMs: number): Promise<string> {
    const m = this.maia;
    if (m?.ready()) {
      const a = await m.candidates(fen, Math.round(this.rating), null, { temperature: BOSS_BRAIN.temperature, topP: BOSS_BRAIN.topP, multipv: BOSS_BRAIN.multipv }).catch(() => null);
      if (a?.best) return a.best;
    }
    const engine = await ownEngine();
    return engine.playAtElo(fen, Math.max(ENGINE_MIN_ELO, Math.min(ENGINE_MAX_ELO, this.rating)), undefined, Math.max(150, budgetMs * 0.8));
  }

  snapshot(): DuelSnapshot {
    const s = this.state;
    const now = Date.now();
    const ctl = s.control ? gameControl(s) : null;
    const phase: DuelGamePhase = s.end ? "over" : s.phase === "vote" && now < s.voteAt ? "versus" : s.phase;
    return {
      code: null,
      bot: true,
      you: this.you,
      phase,
      players: this.players,
      versusAt: this.versusAt,
      voteAt: s.voteAt,
      voteEndsAt: s.voteEndsAt,
      picks: s.picks,
      control: s.control,
      clock: ctl ? { baseSeconds: ctl.baseSeconds, incrementSeconds: ctl.incrementSeconds } : null,
      startsAt: s.startsAt,
      fen: s.fen,
      moves: s.moves,
      sans: s.sans,
      lastMove: s.moves.at(-1) ?? null,
      clocks: s.clocks,
      turnAt: s.turnAt,
      running: clocksRun(s),
      firstMoveBy: firstMoveBy(s),
      drawOffer: s.drawOffer,
      canOffer: { w: canOfferDraw(s, "w"), b: canOfferDraw(s, "b") },
      connected: { w: true, b: true },
      end: s.end,
      outcome: s.end ? { change: null, coins: 0 } : null,
      gone: null,
    };
  }

  pick(zone: DuelZone) {
    const r = castPick(this.state, this.you, zone, Date.now());
    if (r.ok) this.set(r.state);
  }

  move(uci: string) {
    const r = playMove(this.state, this.you, uci, Date.now());
    if (r.ok) this.set(r.state);
    else this.emit();
  }

  resign() {
    const r = resignGame(this.state, this.you, Date.now());
    if (r.ok) this.set(r.state);
  }

  /** The bot takes a draw when it's clearly behind on the board's material, never otherwise. */
  draw() {
    const now = Date.now();
    const r = offerDraw(this.state, this.you, now);
    if (!r.ok) return;
    this.set(r.state);
    setTimeout(() => {
      if (this.disposed || this.state.drawOffer !== this.you) return;
      const take = materialFor(this.state.fen, this.botColor) < materialFor(this.state.fen, this.you) - 2;
      const answer = take ? offerDraw(this.state, this.botColor, Date.now()) : declineDraw(this.state, this.botColor, Date.now());
      if (answer.ok) this.set(answer.state);
    }, rnd(700, 1500));
  }

  drawNo() {
    const r = declineDraw(this.state, this.you, Date.now());
    if (r.ok) this.set(r.state);
  }

  /** When the bot game next needs to wake (the screens' clocks run on their own). */
  next(): number | null {
    return nextDeadline(this.state);
  }

  dispose() {
    this.disposed = true;
    this.stopTicker();
  }
}

/** Material on the board for a side (pawn 1, knight and bishop 3, rook 5, queen 9). */
function materialFor(fen: string, c: Color): number {
  const worth: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  let n = 0;
  for (const ch of fen.split(" ")[0]!) {
    const low = ch.toLowerCase();
    if (!worth[low]) continue;
    if ((ch === low) === (c === "b")) n += worth[low]!;
  }
  return n;
}

// ---------------- The queue ----------------

export type DuelQueueState =
  | { kind: "searching"; since: number }
  /** Refused: resting (the kill switch), signing in needed, banned, or an error; `message` says so. */
  | { kind: "refused"; message: string; banned?: boolean; signIn?: boolean }
  | { kind: "found"; code: string }
  | { kind: "cancelled" };

/**
 * The 1 v 1 queue: asks the server for an opponent (POST /api/1v1/play) and asks again at once with its ticket (each
 * ask waits up to a few seconds on the server) until it's paired, or busy (asks again when told). Cancel stops it and
 * tells the server (a pairing made that very moment is called off there).
 */
export class DuelQueue {
  state: DuelQueueState = { kind: "searching", since: Date.now() };
  /** Your hidden rating, rounded (the first answer's): the bot game's strength. */
  botRating: number | null = null;
  private ticket: string | null = null;
  private stopped = false;
  private listeners = new Set<() => void>();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  private set(s: DuelQueueState) {
    this.state = s;
    this.emit();
  }

  /** Test switches: a queue of its own (`pool`) and each side's clock (`clock`, seconds). */
  private params(): string {
    const q = new URLSearchParams();
    const t = testParams();
    for (const k of ["pool", "clock"]) {
      const v = t.get(k);
      if (v) q.set(k, v);
    }
    if (this.ticket) q.set("ticket", this.ticket);
    const s = q.toString();
    return s ? `?${s}` : "";
  }

  async start() {
    while (!this.stopped) {
      let res: Response;
      try {
        res = await fetch(`/api/1v1/play${this.params()}`, { method: "POST" });
      } catch {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      if (this.stopped) return;
      const body = (await res.json().catch(() => ({}))) as {
        code?: string;
        ticket?: string;
        searching?: boolean;
        busy?: boolean;
        retryMs?: number;
        botRating?: number;
        message?: string;
        banned?: boolean;
      };
      if (typeof body.botRating === "number") this.botRating = body.botRating;
      if (body.ticket) this.ticket = body.ticket;
      if (res.status === 429 || body.busy) {
        await new Promise((r) => setTimeout(r, body.retryMs ?? 3000));
        continue;
      }
      if (!res.ok) return this.set({ kind: "refused", message: body.message ?? "Couldn't find a match. Try again.", ...(body.banned ? { banned: true } : {}), ...(res.status === 401 ? { signIn: true } : {}) });
      if (body.code) {
        this.stopped = true;
        return this.set({ kind: "found", code: body.code });
      }
    }
  }

  cancel() {
    if (this.stopped) return;
    this.stopped = true;
    if (this.ticket) void fetch(`/api/1v1/cancel?ticket=${encodeURIComponent(this.ticket)}`, { method: "POST" }).catch(() => undefined);
    this.set({ kind: "cancelled" });
  }
}

// ---------------- The way in ----------------

/**
 * The one way into ranked 1 v 1 for any screen (the home screen's button, `/1v1`): one tap, straight into the queue.
 * The app registers what it does (App.tsx); a screen just calls this.
 */
let starter: (() => void) | null = null;
export function setRanked1v1Starter(fn: (() => void) | null) {
  starter = fn;
}
export function startRanked1v1() {
  starter?.();
}
