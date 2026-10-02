import { DEFAULT_SETTINGS, allowedMs, finishDuel, type DrawRule, type Settings } from "@chessroyale/core";
import {
  MatchRunner,
  START_FEN,
  applyMove,
  botRoster,
  gameEnd,
  legalMoves,
  netBoard,
  sideToMove,
  type BoardScore,
  type ClientMessage,
  type NetBoard,
  type NetDuel,
  type NetStanding,
  type Opening,
  type RunnerSnapshot,
  type ScoreJob,
  type ServerMessage,
} from "@chessroyale/chess";

/**
 * One lobby's logic, independent of Cloudflare: players and tokens, the round
 * clock, picks, scoring via the host's browser, the draw, stage breaks and the
 * duel. The Durable Object stores `record` between messages and calls `alarm()`
 * at `nextAlarm`.
 */

type Outgoing = ServerMessage extends infer M ? (M extends { now: number } ? Omit<M, "now"> : never) : never;

export interface LobbyIO {
  send(playerId: string, msg: Outgoing): void;
  now(): number;
}

interface Human {
  id: string;
  name: string;
  token: string;
  connected: boolean;
  device: "phone" | "computer";
  practice?: boolean;
}

type Timer =
  | "startRound"
  | "lock"
  | "afterReveal"
  | "nextRound"
  | "scoreTimeout"
  | "colourTimeout"
  | "duelFlag"
  | "botMoveTimeout";

export interface LobbyRecord {
  code: string;
  createdAt: number;
  phase: "lobby" | "opening" | "play" | "scoring" | "reveal" | "stageBreak" | "chooseColour" | "duel" | "results";
  humans: Human[];
  hostId: string | null;
  runner: RunnerSnapshot | null;
  bots: { id: string; name: string; skill: number }[];
  round: null | {
    key: string;
    /** The latest personal deadline (the round locks then at the latest). */
    deadline: number;
    deadlines: Record<string, number>;
    startedAt: number;
    picks: Record<string, { move: string; thinkMs: number }>;
    powerUps: Record<string, true>;
  };
  timer: null | { at: number; kind: Timer };
  /** Last phase message per human, re-sent on reconnect. */
  last: Record<string, Outgoing>;
  scoreRequest: null | { key: string; jobs: ScoreJob[] };
  finalFour: Record<string, number>;
  placements: Record<string, number>;
  duel: null | (NetDuel & { losses: Record<string, number[]> });
  chooserId: string | null;
  mismatches: number;
  counter: number;
  /** Per-lobby playtest overrides (rounds per stage, move clock, duel clock). */
  overrides?: Partial<Pick<Settings, "roundsPerStage" | "moveClockSeconds" | "duelClockSeconds" | "revealSeconds" | "drawnMoveSeconds" | "boardIntroSeconds">> & {
    drawRuleByStage?: DrawRule[];
  };
}

export function newLobbyRecord(code: string, now: number, overrides?: LobbyRecord["overrides"]): LobbyRecord {
  return {
    overrides,
    code,
    createdAt: now,
    phase: "lobby",
    humans: [],
    hostId: null,
    runner: null,
    bots: [],
    round: null,
    timer: null,
    last: {},
    scoreRequest: null,
    finalFour: {},
    placements: {},
    duel: null,
    chooserId: null,
    mismatches: 0,
    counter: 0,
  };
}

const SCORE_TIMEOUT_MS = 15_000;
const BOT_MOVE_TIMEOUT_MS = 8000;

export class LobbyCore {
  private runner: MatchRunner | null = null;

  constructor(
    public record: LobbyRecord,
    private readonly io: LobbyIO,
    private readonly library: readonly Opening[],
    private readonly rng: () => number = Math.random,
    private settings: Settings = DEFAULT_SETTINGS,
  ) {
    this.settings = { ...settings, ...(record.overrides ?? {}) };
    if (record.runner) {
      this.runner = MatchRunner.restore(record.runner, { settings: this.settings, rng, engines: [], library });
    }
  }

  /** Call after every event so the record can be stored. */
  save(): LobbyRecord {
    if (this.runner) this.record.runner = this.runner.snapshot();
    return this.record;
  }

  get nextAlarm(): number | null {
    return this.record.timer?.at ?? null;
  }

  // ---------------- Helpers ----------------

  private get r() {
    return this.record;
  }

  private human(id: string) {
    return this.r.humans.find((h) => h.id === id);
  }

  private send(id: string, msg: Outgoing, remember = true) {
    if (remember) this.r.last[id] = msg;
    this.io.send(id, msg);
  }

  private broadcast(msg: Outgoing, remember = true) {
    for (const h of this.r.humans) this.send(h.id, msg, remember);
  }

  private setTimer(kind: Timer, at: number) {
    this.r.timer = { kind, at };
  }

  private nameOf(id: string): string {
    return this.human(id)?.name ?? this.r.bots.find((b) => b.id === id)?.name ?? id;
  }

  private lobbyMessage(): Outgoing {
    return {
      t: "lobby",
      players: [
        ...this.r.humans.map((h) => ({ id: h.id, name: h.name, isBot: false, connected: h.connected })),
        ...this.r.bots.map((b) => ({ id: b.id, name: b.name, isBot: true, connected: true })),
      ],
      hostId: this.r.hostId,
      started: this.r.phase !== "lobby",
      lobbySize: this.settings.lobbySize,
    };
  }

  private standings(): NetStanding[] {
    return this.runner?.leaderboard() ?? [];
  }

  private cutoff(): number {
    const alive = this.runner!.alive().length;
    return alive - (this.settings.knockoutsPerStage[this.runner!.state.stage] ?? 0);
  }

  private aliveHumans(): Human[] {
    const alive = new Set(this.runner?.alive().map((p) => p.id) ?? []);
    return this.r.humans.filter((h) => alive.has(h.id));
  }

  /** The host scores rounds; prefer a connected computer. */
  private pickHost(exclude?: string): string | null {
    const candidates = this.r.humans.filter((h) => h.connected && h.id !== exclude);
    const computer = candidates.find((h) => h.device === "computer");
    return (computer ?? candidates[0])?.id ?? null;
  }

  // ---------------- Connections ----------------

  connect(token: string | undefined, name: string | undefined, device: "phone" | "computer" = "computer", practice = false) {
    const existing = token ? this.r.humans.find((h) => h.token === token) : undefined;
    if (existing) {
      existing.connected = true;
      if (!this.r.hostId || !this.human(this.r.hostId)?.connected) this.r.hostId = existing.id;
      this.send(existing.id, { t: "welcome", playerId: existing.id, token: existing.token, code: this.r.code }, false);
      this.broadcast(this.lobbyMessage(), false);
      const last = this.r.last[existing.id];
      if (last) this.send(existing.id, last, false);
      this.resendHostWork();
      return { ok: true as const, playerId: existing.id };
    }
    if (this.r.phase !== "lobby") return { ok: false as const, message: "This match has already started." };
    if (this.r.humans.length >= this.settings.lobbySize) return { ok: false as const, message: "This lobby is full." };
    const clean = (name ?? "").replace(/\s+/g, " ").trim().slice(0, 16) || `Player ${this.r.humans.length + 1}`;
    const id = `p${++this.r.counter}`;
    const newToken = Array.from({ length: 24 }, () => Math.floor(this.rng() * 16).toString(16)).join("");
    this.r.humans.push({ id, name: clean, token: newToken, connected: true, device, practice });
    if (!this.r.hostId) this.r.hostId = id;
    this.send(id, { t: "welcome", playerId: id, token: newToken, code: this.r.code }, false);
    this.broadcast(this.lobbyMessage(), false);
    return { ok: true as const, playerId: id };
  }

  /** Sends a (re)connected player everything they need: welcome, lobby, the current phase, any host work. */
  resendTo(playerId: string) {
    const h = this.human(playerId);
    if (!h) return;
    this.io.send(playerId, { t: "welcome", playerId, token: h.token, code: this.r.code });
    this.io.send(playerId, this.lobbyMessage());
    const last = this.r.last[playerId];
    if (last) this.io.send(playerId, last);
    if (playerId === this.r.hostId) this.resendHostWork();
  }

  disconnect(playerId: string) {
    const h = this.human(playerId);
    if (!h) return;
    h.connected = false;
    if (this.r.hostId === playerId) {
      this.r.hostId = this.pickHost(playerId) ?? playerId;
      this.resendHostWork();
    }
    this.broadcast(this.lobbyMessage(), false);
  }

  /** If the host owes the server work (scores, a bot's duel move), (re)send it to the current host. */
  private resendHostWork() {
    const host = this.r.hostId;
    if (!host || !this.human(host)?.connected) return;
    if (this.r.phase === "scoring" && this.r.scoreRequest) {
      this.io.send(host, { t: "scoreRequest", ...this.r.scoreRequest });
    }
    if (this.r.phase === "duel" && this.r.duel && !this.r.duel.over) this.requestBotMoveIfNeeded();
  }

  // ---------------- Messages ----------------

  message(playerId: string, msg: ClientMessage) {
    switch (msg.t) {
      case "start":
        return this.start(playerId);
      case "pick":
        return this.pick(playerId, msg.key, msg.move);
      case "powerUp":
        return this.powerUp(playerId, msg.key);
      case "scores":
        return this.scores(playerId, msg.key, msg.boards);
      case "crossCheck":
        if (!msg.ok) {
          this.r.mismatches++;
          console.log(`cross-check mismatch in ${this.r.code} (${msg.key}, board ${msg.boardId}): ${msg.detail ?? ""}`);
        }
        return;
      case "chooseColour":
        if (this.r.phase === "chooseColour" && playerId === this.r.chooserId) this.beginDuel(msg.colour);
        return;
      case "duelMove":
        return this.duelMove(playerId, msg.move);
      case "resign":
        if (this.r.duel && !this.r.duel.over && [this.r.duel.white, this.r.duel.black].includes(playerId)) {
          const winner = this.r.duel.white === playerId ? this.r.duel.black : this.r.duel.white;
          this.endDuel(winner, `${this.nameOf(playerId)} resigned`);
        }
        return;
      case "botMove":
        return this.botMove(playerId, msg.ply, msg.move, msg.loss);
      case "duelLoss":
        if (this.r.duel && playerId === this.r.hostId) {
          const mover = msg.ply % 2 === 0 ? this.r.duel.white : this.r.duel.black;
          (this.r.duel.losses[mover] ??= []).push(msg.loss);
        }
        return;
      case "hello":
        return;
    }
  }

  // ---------------- Match flow ----------------

  private start(playerId: string) {
    if (this.r.phase !== "lobby" || playerId !== this.r.hostId) return;
    const empty = this.settings.lobbySize - this.r.humans.length;
    const bots = botRoster(this.rng, empty, this.settings);
    this.r.bots = bots.map((b) => ({ id: b.id, name: b.name, skill: b.skill ?? 5 }));
    this.runner = new MatchRunner({
      settings: this.settings,
      rng: this.rng,
      engines: [],
      library: this.library,
      entrants: [...this.r.humans.map((h) => ({ id: h.id, name: h.name, isBot: false, practice: !!h.practice })), ...bots],
    });
    this.r.phase = "opening";
    const now = this.io.now();
    this.broadcast(this.lobbyMessage(), false);
    this.broadcast({
      t: "opening",
      boards: [...this.runner.boards.values()].map((b) => netBoard(b, true)),
      until: now + this.settings.openingShowSeconds * 1000,
    });
    this.setTimer("startRound", now + this.settings.openingShowSeconds * 1000);
  }

  alarm() {
    const timer = this.r.timer;
    if (!timer || timer.at > this.io.now() + 50) return;
    this.r.timer = null;
    switch (timer.kind) {
      case "startRound":
      case "nextRound":
        return this.nextRound();
      case "lock":
        return this.lock();
      case "afterReveal":
        return this.afterReveal();
      case "scoreTimeout":
        return this.scoreTimeout();
      case "colourTimeout":
        if (this.r.phase === "chooseColour") this.beginDuel("w");
        return;
      case "duelFlag":
        return this.checkFlag();
      case "botMoveTimeout":
        return this.botMoveFallback();
    }
  }

  private nextRound() {
    if (!this.runner) return;
    if (this.runner.isDuel()) return this.startDuel();
    this.runner.deal();
    // The move clock starts after a short settling-in countdown on the new board.
    const now = this.io.now() + this.settings.boardIntroSeconds * 1000;
    const key = `${this.runner.state.stage}-${this.runner.state.round}-${++this.r.counter}`;
    // Each human's deadline comes from their own time bank.
    const deadlines: Record<string, number> = {};
    for (const h of this.aliveHumans()) deadlines[h.id] = now + allowedMs(this.runner.player(h.id), this.settings);
    const deadline = Math.max(now, ...Object.values(deadlines));
    this.r.round = { key, deadline, deadlines, startedAt: now, picks: {}, powerUps: {} };
    this.r.phase = "play";
    const st = this.standings();
    const cutoff = this.cutoff();
    const alive = new Set(this.runner.alive().map((p) => p.id));
    for (const h of this.r.humans) {
      const board = alive.has(h.id) ? this.runner.boardOf(h.id) : null;
      this.send(h.id, {
        t: "round",
        key,
        stage: this.runner.state.stage,
        round: this.runner.state.round,
        startsAt: now,
        deadline: deadlines[h.id] ?? deadline,
        board: board ? netBoard(board) : null,
        standings: st,
        cutoff,
        alive: alive.has(h.id),
        botsDoneIn: this.runner.botThinkTimes(),
      });
      if (!alive.has(h.id)) this.sendSpectate(h.id);
    }
    if (this.r.hostId) {
      const fens = [...this.runner.groups.keys()].map((id) => this.runner!.boards.get(id)!.fen);
      this.send(this.r.hostId, { t: "prefetch", fens }, false);
    }
    if (!this.aliveHumans().length) return this.lock();
    this.setTimer("lock", deadline + this.settings.lateGraceMs);
  }

  private sendSpectate(id: string) {
    if (!this.runner) return;
    this.send(
      id,
      {
        t: "spectate",
        boards: this.runner.state.boards.map((b) => netBoard(this.runner!.boards.get(b)!)),
        standings: this.standings(),
        stage: this.runner.state.stage,
        round: this.runner.state.round,
      },
      false,
    );
  }

  private pick(playerId: string, key: string, move: string) {
    const round = this.r.round;
    if (this.r.phase !== "play" || !round || round.key !== key || round.picks[playerId]) return;
    const now = this.io.now();
    const deadline = round.deadlines?.[playerId] ?? round.deadline;
    if (now > deadline + this.settings.lateGraceMs) return; // Late picks count as a miss.
    if (now < round.startedAt - 500) return; // Before the clock starts.
    const board = this.runner?.boardOf(playerId);
    if (!board || !legalMoves(board.fen).includes(move)) return;
    round.picks[playerId] = { move, thinkMs: Math.max(0, Math.min(now - round.startedAt, deadline - round.startedAt)) };
    for (const h of this.r.humans) this.send(h.id, { t: "moved", key, playerId }, false);
    if (this.aliveHumans().every((h) => round.picks[h.id])) this.lock();
  }

  /** A power-up: the player's browser shows the engine's top moves; the server just counts it. */
  private powerUp(playerId: string, key: string) {
    const round = this.r.round;
    if (this.r.phase !== "play" || !round || round.key !== key || round.picks[playerId] || !this.runner) return;
    if (this.io.now() < round.startedAt - 500) return;
    const p = this.runner.state.players.find((x) => x.id === playerId);
    if (!p?.alive || !(p.practice || p.powerUps > 0)) return;
    (round.powerUps ??= {})[playerId] = true;
  }

  /** Picks are locked: ask the host's browser to score every board. */
  private lock() {
    if (!this.runner || !this.r.round || this.r.phase !== "play") return;
    this.r.phase = "scoring";
    const skills = new Map(this.r.bots.map((b) => [b.id, b.skill]));
    const jobs: ScoreJob[] = [...this.runner.groups.entries()].map(([boardId, ids]) => ({
      boardId,
      fen: this.runner!.boards.get(boardId)!.fen,
      humanPicks: Object.fromEntries(ids.filter((id) => !skills.has(id)).map((id) => [id, this.r.round!.picks[id]?.move ?? null])),
      bots: ids
        .filter((id) => skills.has(id))
        .map((id) => ({ id, skill: skills.get(id)!, powerUps: this.runner!.player(id).powerUps })),
    }));
    this.r.scoreRequest = { key: this.r.round.key, jobs };
    for (const h of this.r.humans) this.io.send(h.id, { t: "locked", key: this.r.round.key });
    const host = this.r.hostId && this.human(this.r.hostId)?.connected ? this.r.hostId : this.pickHost();
    this.r.hostId = host;
    if (host) this.io.send(host, { t: "scoreRequest", ...this.r.scoreRequest });
    this.setTimer("scoreTimeout", this.io.now() + SCORE_TIMEOUT_MS);
  }

  private scoreTimeout() {
    if (this.r.phase !== "scoring" || !this.r.scoreRequest) return;
    const next = this.pickHost(this.r.hostId ?? undefined);
    if (next && next !== this.r.hostId) {
      this.r.hostId = next;
      this.broadcast(this.lobbyMessage(), false);
      this.io.send(next, { t: "scoreRequest", ...this.r.scoreRequest });
      this.setTimer("scoreTimeout", this.io.now() + SCORE_TIMEOUT_MS);
      return;
    }
    // Nobody can score: treat every pick as equal so the match can go on.
    const boards: BoardScore[] = this.r.scoreRequest.jobs.map((j) => {
      const legal = legalMoves(j.fen);
      const botPicks = Object.fromEntries(j.bots.map((b) => [b.id, legal[Math.floor(this.rng() * legal.length)]!]));
      const moves = [...Object.values(j.humanPicks).filter((m): m is string => !!m), ...Object.values(botPicks)];
      return {
        boardId: j.boardId,
        bestMove: moves[0] ?? legal[0]!,
        bestExpected: 0.5,
        expectedAfter: Object.fromEntries([...moves, legal[0]!].map((m) => [m, 0.5])),
        botPicks,
        botThinkMs: Object.fromEntries(j.bots.map((b) => [b.id, 5000])),
      };
    });
    this.applyScores(boards);
  }

  private scores(playerId: string, key: string, boards: BoardScore[]) {
    if (this.r.phase !== "scoring" || playerId !== this.r.hostId || this.r.scoreRequest?.key !== key) return;
    this.applyScores(boards);
  }

  private applyScores(boards: BoardScore[]) {
    const runner = this.runner!;
    const round = this.r.round!;
    const byBoard = new Map(boards.map((b) => [b.boardId, b]));
    const results = this.r.scoreRequest!.jobs.map((job) => {
      const s = byBoard.get(job.boardId);
      const ids = runner.groups.get(job.boardId)!;
      const picks: Record<string, string | null> = { ...job.humanPicks };
      const legal = legalMoves(job.fen);
      for (const b of job.bots) {
        const m = s?.botPicks[b.id];
        picks[b.id] = m && legal.includes(m) ? m : legal[0]!;
        if (s?.botPowerUps?.includes(b.id)) runner.setBotPowerUp(b.id);
      }
      const bestExpected = s?.bestExpected ?? 0.5;
      const expectedAfter: Record<string, number> = { ...(s?.expectedAfter ?? {}) };
      // A pick the host didn't score counts as the best (no loss) rather than failing the round.
      for (const m of Object.values(picks)) if (m && expectedAfter[m] === undefined) expectedAfter[m] = bestExpected;
      const bestMove = s?.bestMove && legal.includes(s.bestMove) ? s.bestMove : legal[0]!;
      if (expectedAfter[bestMove] === undefined) expectedAfter[bestMove] = bestExpected;
      return runner.resolveBoard(job.boardId, ids, picks, { bestMove, bestExpected, expectedAfter });
    });
    const think = Object.fromEntries(Object.entries(round.picks).map(([id, p]) => [id, p.thinkMs]));
    // A miss uses the whole of the player's time for the move.
    for (const h of this.aliveHumans()) think[h.id] ??= (round.deadlines?.[h.id] ?? round.deadline) - round.startedAt;
    const report = runner.finishRound(results, think, new Set(Object.keys(round.powerUps ?? {})));
    this.r.scoreRequest = null;
    this.r.phase = "reveal";
    const until = this.io.now() + (this.settings.revealSeconds + this.settings.drawnMoveSeconds) * 1000;
    const st = this.standings();
    const cutoff = this.cutoff();
    for (const h of this.r.humans) {
      const mine = report.boards.find((b) => b.playerIds.includes(h.id));
      const score = mine ? byBoard.get(mine.boardId) : undefined;
      this.send(h.id, {
        t: "reveal",
        key: round.key,
        stage: runner.state.stage,
        roundsPlayed: runner.state.round,
        board: mine ? netBoard(runner.boards.get(mine.boardId)!) : null,
        fenBefore: mine?.fenBefore ?? null,
        bestMove: mine?.bestMove ?? null,
        playedMove: mine?.result.playedMove ?? null,
        picks: mine?.result.players.map((p) => ({ playerId: p.playerId, move: p.move, loss: p.loss, roundScore: p.roundScore })) ?? [],
        drawRule: mine?.result.drawRule ?? "random",
        expectedAfter: score?.expectedAfter ?? {},
        bestExpected: score?.bestExpected ?? null,
        standings: st,
        cutoff,
        until,
      });
      if (!mine) this.sendSpectate(h.id);
    }
    this.setTimer("afterReveal", until);
  }

  private afterReveal() {
    const runner = this.runner!;
    if (!runner.stageComplete()) return this.nextRound();
    const stage = runner.state.stage;
    const before = this.standings();
    const cutoff = this.cutoff();
    if (stage === this.settings.knockoutsPerStage.length - 1) for (const s of before) if (!s.out) this.r.finalFour[s.id] = s.points;
    const end = runner.endStage();
    for (const p of end.knockedOut) this.r.placements[p.id] = p.placement!;
    this.r.phase = "stageBreak";
    const until = this.io.now() + this.settings.stageBreakSeconds * 1000;
    this.broadcast({
      t: "stageBreak",
      stage,
      standings: before,
      knockedOut: end.knockedOut.map((p) => p.id),
      cutoff,
      nextBoards: runner.state.boards.map((b) => netBoard(runner.boards.get(b)!)),
      until,
      placements: { ...this.r.placements },
    });
    this.setTimer("nextRound", until);
  }

  // ---------------- Duel ----------------

  private isBot(id: string) {
    return this.r.bots.some((b) => b.id === id);
  }

  private startDuel() {
    const [a, b] = this.runner!.alive();
    if (this.isBot(a!.id) && this.isBot(b!.id)) {
      // Two bots: the one with the lower average loss over the match wins.
      const avg = (p: typeof a) => {
        const all = p!.lossesByStage.flat();
        return all.reduce((s, x) => s + x, 0) / Math.max(1, all.length);
      };
      const winner = avg(a) <= avg(b) ? a! : b!;
      return this.finishMatch(winner.id);
    }
    const chooser = (this.r.finalFour[a!.id] ?? 0) >= (this.r.finalFour[b!.id] ?? 0) ? a! : b!;
    const other = chooser === a ? b! : a!;
    this.r.chooserId = chooser.id;
    this.r.duel = {
      white: chooser.id,
      black: other.id,
      fen: START_FEN,
      history: [],
      lastMove: null,
      clocks: { w: this.settings.duelClockSeconds * 1000, b: this.settings.duelClockSeconds * 1000 },
      turnStartedAt: 0,
      over: null,
      losses: {},
    };
    if (this.isBot(chooser.id)) return this.beginDuel("w");
    this.r.phase = "chooseColour";
    const until = this.io.now() + this.settings.colourChoiceSeconds * 1000;
    this.broadcast({ t: "chooseColour", chooserId: chooser.id, until });
    this.setTimer("colourTimeout", until);
  }

  private beginDuel(chooserColour: "w" | "b") {
    const d = this.r.duel!;
    const chooser = this.r.chooserId!;
    const other = d.white === chooser ? d.black : d.white;
    d.white = chooserColour === "w" ? chooser : other;
    d.black = chooserColour === "w" ? other : chooser;
    d.turnStartedAt = this.io.now();
    this.r.phase = "duel";
    this.broadcastDuel();
    this.setTimer("duelFlag", d.turnStartedAt + d.clocks.w);
    this.requestBotMoveIfNeeded();
  }

  private broadcastDuel() {
    const { losses: _losses, ...duel } = this.r.duel!;
    this.broadcast({ t: "duel", duel, finalists: [duel.white, duel.black] });
  }

  private mover(): string {
    const d = this.r.duel!;
    return sideToMove(d.fen) === "w" ? d.white : d.black;
  }

  private requestBotMoveIfNeeded() {
    const d = this.r.duel!;
    if (d.over || !this.isBot(this.mover())) return;
    const host = this.r.hostId;
    const skill = this.r.bots.find((b) => b.id === this.mover())!.skill;
    if (host) this.io.send(host, { t: "botMoveRequest", ply: d.history.length, fen: d.fen, skill });
    this.setTimer("botMoveTimeout", Math.min(this.io.now() + BOT_MOVE_TIMEOUT_MS, this.flagAt()));
  }

  private flagAt(): number {
    const d = this.r.duel!;
    return d.turnStartedAt + d.clocks[sideToMove(d.fen)];
  }

  private applyDuelMove(move: string) {
    const d = this.r.duel!;
    const side = sideToMove(d.fen);
    const now = this.io.now();
    d.clocks[side] = Math.max(0, d.clocks[side] - (now - d.turnStartedAt));
    if (d.clocks[side] <= 0) return this.checkFlag();
    const fenBefore = d.fen;
    d.fen = applyMove(d.fen, move);
    d.history.push(move);
    d.lastMove = move;
    d.turnStartedAt = now;
    const end = gameEnd(START_FEN, d.history);
    if (end === "checkmate") return this.endDuel(side === "w" ? d.white : d.black, "Checkmate");
    if (end) {
      // A draw goes to the player with the lower average loss per move in the duel.
      const avg = (id: string) => {
        const l = d.losses[id] ?? [];
        return l.reduce((s, x) => s + x, 0) / Math.max(1, l.length);
      };
      const winner = avg(d.white) <= avg(d.black) ? d.white : d.black;
      return this.endDuel(winner, `Draw (${end.replace("_", " ")}), decided on move quality`);
    }
    this.broadcastDuel();
    if (this.r.hostId && !this.isBot(side === "w" ? d.white : d.black)) {
      this.io.send(this.r.hostId, { t: "duelScoreRequest", ply: d.history.length - 1, fen: fenBefore, move });
    }
    this.setTimer("duelFlag", this.flagAt());
    this.requestBotMoveIfNeeded();
  }

  private duelMove(playerId: string, move: string) {
    const d = this.r.duel;
    if (this.r.phase !== "duel" || !d || d.over || this.mover() !== playerId || !legalMoves(d.fen).includes(move)) return;
    this.applyDuelMove(move);
  }

  private botMove(playerId: string, ply: number, move: string, loss: number | null) {
    const d = this.r.duel;
    if (!d || d.over || playerId !== this.r.hostId || ply !== d.history.length || !this.isBot(this.mover())) return;
    if (!legalMoves(d.fen).includes(move)) return;
    if (loss !== null) (d.losses[this.mover()] ??= []).push(loss);
    this.applyDuelMove(move);
  }

  private botMoveFallback() {
    const d = this.r.duel;
    if (!d || d.over) return;
    if (this.flagAt() <= this.io.now()) return this.checkFlag();
    if (!this.isBot(this.mover())) return this.setTimer("duelFlag", this.flagAt());
    const legal = legalMoves(d.fen);
    this.applyDuelMove(legal[Math.floor(this.rng() * legal.length)]!);
  }

  private checkFlag() {
    const d = this.r.duel;
    if (!d || d.over) return;
    const side = sideToMove(d.fen);
    if (this.flagAt() > this.io.now()) {
      this.setTimer(this.isBot(this.mover()) ? "botMoveTimeout" : "duelFlag", this.flagAt());
      return;
    }
    d.clocks[side] = 0;
    this.endDuel(side === "w" ? d.black : d.white, "Out of time");
  }

  private endDuel(winnerId: string, reason: string) {
    const d = this.r.duel!;
    d.over = { winner: winnerId, reason };
    this.r.timer = null;
    this.broadcastDuel();
    this.finishMatch(winnerId);
  }

  private finishMatch(winnerId: string) {
    const runner = this.runner!;
    runner.state = finishDuel(runner.state, winnerId);
    for (const p of runner.state.players) this.r.placements[p.id] = p.placement!;
    this.r.phase = "results";
    this.r.timer = null;
    const msg: Outgoing = {
      t: "results",
      placements: { ...this.r.placements },
      winner: this.nameOf(winnerId),
      lossesByStage: Object.fromEntries(this.r.humans.map((h) => [h.id, runner.player(h.id).lossesByStage])),
    };
    this.broadcast(msg);
  }
}
