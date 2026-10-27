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
import { ownEngine, pauseEngines } from "./engine.ts";
import { prefetchMaia, startMaia } from "./maia.ts";
import { MaiaGate } from "./maia-gate.ts";
import { crumb } from "./problems.ts";
import { testParams, testSwitchesAllowed } from "./test-switches.ts";

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
  /** A town bot's game: Maia's loading step is on (the board under its card; the vote after). */
  loading?: boolean;
  /** A game with a town bot (casual: no rank, no coins, nothing recorded); its result goes back to the town. */
  town?: boolean;
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
  /** Your move shown before the server's answer (its ply), and the move (sent again after a reconnect if still due). */
  private pending: number | null = null;
  private pendingMove: { uci: string; ply: number } | null = null;
  private ws: WebSocket | null = null;
  /**
   * The server's clock minus this device's (ms). Each message gives a sample, short by however long it took to
   * arrive, so the largest sample (the quickest message) is kept; a fresh connection, or one older than OFFSET_KEEP_MS,
   * starts over.
   */
  private offset = 0;
  private offsetAt: number | null = null;
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
    this.offsetAt = null;
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

  /** One message's clock sample: kept if it's the quickest yet (the largest), or the kept one has grown old. */
  private sampleOffset(serverNow: number) {
    const now = Date.now();
    const sample = serverNow - now;
    if (this.offsetAt === null || sample > this.offset || now - this.offsetAt > OFFSET_KEEP_MS) {
      this.offset = sample;
      this.offsetAt = now;
    }
  }

  private onMessage(msg: DuelServerMessage) {
    if (typeof msg.now === "number") this.sampleOffset(msg.now);
    switch (msg.t) {
      case "welcome": {
        this.you = msg.you;
        this.view = this.localView(msg.game);
        this.pending = null;
        this.chat.onWelcome();
        // Back after a dropped socket with your move unanswered: sent again if the game is still waiting for it (the
        // server never plays a ply twice); gone if it was played meanwhile, or the game moved on.
        const p = this.pendingMove;
        this.pendingMove = null;
        if (p && this.view.moves.length === p.ply) this.move(p.uci);
        break;
      }
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
        if (this.pending === msg.ply) {
          this.pending = null;
          this.pendingMove = null;
        }
        break;
      }
      case "moveNo":
        crumb(`1v1 move refused: ${msg.reason}`);
        this.view = this.localView(msg.game);
        this.pending = null;
        this.pendingMove = null;
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
        // An app on an older protocol: reload once for the new one (twice in a minute: say so instead).
        if (msg.reload && reloadOnce()) return;
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
    this.pendingMove = { uci, ply };
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

/** A kept clock sample is replaced by a slower one after this long (the two clocks drift a little). */
const OFFSET_KEEP_MS = 5 * 60_000;

/** Reloads the page for a new app, unless it did so in the last minute (then false: a loop helps nobody). */
function reloadOnce(): boolean {
  const key = "brc.duelReloadAt";
  try {
    const at = Number(sessionStorage.getItem(key));
    if (Number.isFinite(at) && Date.now() - at < 60_000) return false;
    sessionStorage.setItem(key, String(Date.now()));
  } catch {
    return false;
  }
  location.reload();
  return true;
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
  /** A town bot's game: Maia's loading step (Boss alone's: this device's Stockfish paused, Maia loaded alone). */
  private gate: MaiaGate | null = null;
  private readonly town: TownBotGame | null;

  /**
   * `town`: a game with a town bot (docs/areas/town-square.md, "The bots and playing them"): its name and look, its
   * rating on its pill (the number alone: "Tempo Tess (bot)" and "Rating 1400" don't fit a phone's strip together); no
   * versus moment; Maia's loading step first, as Boss alone's (the same rule for who may run it, the same Stockfish
   * fallback), then the vote and the game as the bot game's.
   */
  constructor(
    private readonly rating: number,
    town: TownBotGame | null = null,
  ) {
    const now = Date.now();
    this.town = town;
    this.you = Math.random() < 0.5 ? "w" : "b";
    const look = town ? town.look : botLook(`bot-${Math.floor(Math.random() * 1e9)}`).look;
    const bot: DuelSide = { uid: null, name: town?.name ?? "Bot", look, rank: { ...rankView(null), placement: null, tier: "Bot", label: town ? String(rating) : "Unranked" }, bot: true };
    // (A town game is casual: your pill says so, not your 1 v 1 rank.)
    const me = town ? { ...yourSide(), rank: { ...rankView(null), placement: null, tier: "Casual", label: "Casual" } } : yourSide();
    this.players = this.you === "w" ? { w: me, b: bot } : { w: bot, b: me };
    this.versusAt = now;
    this.ticker = setInterval(() => this.tick(), 100);
    const maia = maiaAllowed() && rating >= RANKED_1V1.bot.maiaMin && rating <= RANKED_1V1.bot.maiaMax;
    if (!town) {
      this.state = this.begin(now + RANKED_1V1.versusMs);
      // Maia loads during the versus moment and the vote (from the service worker's cache after the first time).
      if (maia) this.maia = startMaia(BOSS_BRAIN.loadTimeoutMs);
      return;
    }
    // A town bot: its game waits (no vote yet) while Maia loads alone, at most BOSS_BRAIN.loadGateMs; then the vote.
    this.state = newDuel(Infinity);
    if (!maia || typeof Worker === "undefined") {
      this.state = this.begin(now);
      return;
    }
    prefetchMaia();
    const gate = new MaiaGate({
      start: (after) => (this.maia = startMaia(BOSS_BRAIN.loadTimeoutMs, after)),
      pause: (until) => pauseEngines(until, () => this.dropMaia(), BOSS_BRAIN.stockfishBackMs),
      gateMs: BOSS_BRAIN.loadGateMs,
    });
    this.gate = gate;
    void gate.done.then(() => {
      if (this.gate !== gate) return;
      this.gate = null;
      if (this.disposed || this.state.end) return;
      this.set(this.begin(Date.now()));
    });
  }

  /** A new game whose vote opens at `voteAt`, and the bot's pick in it: a zone at random, 0.8-3.5 s into the vote. */
  private begin(voteAt: number): DuelState {
    const test = Number(testParams().get("clock"));
    const zones: DuelZone[] = ["bullet", "blitz", "rapid"];
    setTimeout(() => this.botPick(zones[Math.floor(Math.random() * 3)]!), voteAt - Date.now() + rnd(800, 3500));
    return newDuel(voteAt, { testSeconds: Number.isFinite(test) && test > 0 ? test : null });
  }

  /** This device's Stockfish didn't answer again beside Maia (short of memory): Maia goes, the bot plays Stockfish. */
  private dropMaia() {
    this.maia?.close();
    this.maia = null;
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
    this.gate?.stop();
    this.gate = null;
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
    const loading = !!this.town && !s.end && s.voteAt === Infinity;
    const phase: DuelGamePhase = s.end ? "over" : loading ? "vote" : s.phase === "vote" && now < s.voteAt ? "versus" : s.phase;
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
      loading,
      town: !!this.town,
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

/** A town bot's game: the bot's name ("Tempo Tess (bot)") and its crate items. */
export interface TownBotGame {
  name: string;
  look: ItemLook | null;
}

// ---------------- The queue ----------------

export type DuelQueueState =
  | { kind: "searching"; since: number }
  /** Refused: resting (the kill switch), signing in needed, banned, or an error; `message` says so. */
  | { kind: "refused"; message: string; banned?: boolean; signIn?: boolean }
  | { kind: "found"; code: string }
  | { kind: "cancelled" };

/** Where a search in progress is kept for this tab (sessionStorage), so a reload carries on with it. */
const SAVED_QUEUE_KEY = "brc.duelQueue";
/** A saved search older than this (no ask since) is dropped: the server forgets an unasked ticket long before. */
const SAVED_QUEUE_MS = 2 * 60_000;

/** A search in progress, as saved: its ticket, when it began, its test switches, and when it last asked. */
interface SavedQueue {
  ticket: string | null;
  since: number;
  at: number;
  test: Record<string, string>;
}

/** The search this tab was in before a reload (null: none, or too old). */
export function savedDuelQueue(): SavedQueue | null {
  try {
    const raw = sessionStorage.getItem(SAVED_QUEUE_KEY);
    const q = raw ? (JSON.parse(raw) as SavedQueue) : null;
    return q && typeof q.since === "number" && typeof q.at === "number" && Date.now() - q.at < SAVED_QUEUE_MS ? q : null;
  } catch {
    return null;
  }
}

function saveQueue(q: SavedQueue | null) {
  try {
    if (q) sessionStorage.setItem(SAVED_QUEUE_KEY, JSON.stringify(q));
    else sessionStorage.removeItem(SAVED_QUEUE_KEY);
  } catch {
    // No storage: a reload ends the search (the server forgets its ticket).
  }
}

/**
 * The 1 v 1 queue: asks the server for an opponent (POST /api/1v1/play) and asks again at once with its ticket (each
 * ask waits up to a few seconds on the server) until it's paired, or busy (asks again when told); a ticket the server
 * no longer knows (`expired`) is dropped and it asks afresh. Cancel stops it and tells the server (a pairing made
 * that very moment is called off there). It belongs to the app, not to a screen: it keeps asking while you browse the
 * shop or a profile (docs/areas/ranked.md, "Browsing while queued"), and a reload carries on with it (`savedDuelQueue`).
 */
export class DuelQueue {
  state: DuelQueueState;
  /** Your hidden rating, rounded (the first answer's): the bot game's strength. */
  botRating: number | null = null;
  /** "Keep waiting" was picked: no more "Few players online right now" for this search. */
  keepWaiting = false;
  /** When "Few players online right now" is due (RANKED_1V1.fewPlayersSeconds after the search began; `?fewAfter=`). */
  readonly fewAt: number;
  private ticket: string | null;
  /** Test switches, read once (the address changes as you browse): a pool of its own, each side's clock. */
  private readonly test: Record<string, string>;
  private stopped = false;
  private listeners = new Set<() => void>();

  /** `resume`: carry on with a search saved before a reload (its ticket, its wait). */
  constructor(resume?: SavedQueue | null) {
    const t = testParams();
    // (A resumed search keeps its own, where the test switches are allowed: the address may have lost them.)
    this.test = resume && testSwitchesAllowed() ? { ...resume.test } : {};
    if (!resume)
      for (const k of ["pool", "clock", "fewAfter"]) {
        const v = t.get(k);
        if (v) this.test[k] = v;
      }
    this.ticket = resume?.ticket ?? null;
    const since = resume?.since ?? Date.now();
    this.state = { kind: "searching", since };
    const few = Number(this.test.fewAfter);
    this.fewAt = since + (Number.isFinite(few) && few > 0 ? few : RANKED_1V1.fewPlayersSeconds) * 1000;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  private set(s: DuelQueueState) {
    this.state = s;
    if (s.kind !== "searching") saveQueue(null);
    this.emit();
  }

  /** The test switches the server reads (`pool`, `clock`), and the ticket. */
  private params(): string {
    const q = new URLSearchParams();
    for (const k of ["pool", "clock"]) if (this.test[k]) q.set(k, this.test[k]!);
    if (this.ticket) q.set("ticket", this.ticket);
    const s = q.toString();
    return s ? `?${s}` : "";
  }

  /** Saved for a reload, after every ask. */
  private save() {
    if (this.stopped || this.state.kind !== "searching") return;
    saveQueue({ ticket: this.ticket, since: this.state.since, at: Date.now(), test: this.test });
  }

  async start() {
    this.save();
    while (!this.stopped) {
      let res: Response;
      try {
        res = await fetch(`/api/1v1/play${this.params()}`, { method: "POST" });
      } catch {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      const body = (await res.json().catch(() => ({}))) as {
        code?: string;
        ticket?: string;
        searching?: boolean;
        busy?: boolean;
        retryMs?: number;
        botRating?: number;
        message?: string;
        banned?: boolean;
        expired?: boolean;
      };
      if (this.stopped) {
        // Cancelled while this ask was out, before any ticket was known (the first ask): the server made one, so it's
        // told now; otherwise that ticket would wait in the queue to be paired with someone who has gone.
        if (this.state.kind === "cancelled" && !this.ticket && body.ticket) this.tellCancel(body.ticket);
        return;
      }
      if (typeof body.botRating === "number") this.botRating = body.botRating;
      // The server doesn't know this ticket any more (it went while this device slept): ask afresh, still searching.
      // (Expired with no ticket sent can't be: refused, rather than asking again and again.)
      if (body.expired) {
        if (!this.ticket) return this.set({ kind: "refused", message: "Couldn't find a match. Try again." });
        this.ticket = null;
        this.save();
        continue;
      }
      if (body.ticket) this.ticket = body.ticket;
      this.save();
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
    // (No ticket yet: the first ask is still out; its answer's ticket is told when it comes, in start.)
    if (this.ticket) this.tellCancel(this.ticket);
    this.set({ kind: "cancelled" });
  }

  private tellCancel(ticket: string) {
    void fetch(`/api/1v1/cancel?ticket=${encodeURIComponent(ticket)}`, { method: "POST" }).catch(() => undefined);
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
