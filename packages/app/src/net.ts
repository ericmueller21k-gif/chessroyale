import { DEFAULT_SETTINGS, botPick, type Settings } from "@chessroyale/core";
import {
  legalMoves,
  sideToMove,
  toSan,
  type BoardScore,
  type ClientMessage,
  type LobbyPlayer,
  type NetBoard,
  type NetStanding,
  type ScoreJob,
  type ServerMessage,
  type UciEngine,
} from "@chessroyale/chess";
import type { BoardView, DuelView, GameView, MoveRecord, Phase, Standing } from "./game.ts";

/**
 * A multiplayer match: the lobby server runs the clock and the draw; this
 * browser shows the screens. When this player is the host, it also scores
 * every group and picks the bots' moves (the server can't run an engine on
 * the free plan). Every player cross-checks their own group's scores.
 */
export class NetMatch implements GameView {
  phase: Phase = { kind: "loading" };
  settings: Settings = DEFAULT_SETTINGS;
  moves: MoveRecord[] = [];
  scoringMs: number[] = [];
  lossesByStage: number[][] = [];
  placement: number | null = null;
  players: LobbyPlayer[] = [];
  hostId: string | null = null;
  myId: string | null = null;
  started = false;
  error: string | null = null;
  stage = 0;
  roundsPlayed = 0;
  cutoff = 0;
  /** Lobby view of the waiting duel chooser (when someone else chooses). */
  waitingFor: string | null = null;
  readonly serverPaced = true;

  private ws: WebSocket | null = null;
  private listeners = new Set<() => void>();
  private offset = 0;
  private key: string | null = null;
  private myPick: string | null = null;
  private currentBoard: NetBoard | null = null;
  private standingsList: NetStanding[] = [];
  private pendingResults: Extract<ServerMessage, { t: "results" }> | null = null;
  private closed = false;
  private retry = 0;

  constructor(
    readonly code: string,
    readonly playerName: string,
    private readonly engines: () => Promise<UciEngine[]>,
  ) {}

  get totalPlayers() {
    return this.players.length || this.settings.lobbySize;
  }
  get isHost() {
    return this.myId !== null && this.myId === this.hostId;
  }
  nameOf(id: string) {
    return this.players.find((p) => p.id === id)?.name ?? id;
  }
  isYou(id: string) {
    return id === this.myId;
  }
  standings(): Standing[] {
    return this.standingsList.map((s) => ({ ...s, isYou: s.id === this.myId }));
  }
  get inviteUrl() {
    return `${location.origin}/lobby/${this.code}`;
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private emit() {
    this.listeners.forEach((l) => l());
  }
  private setPhase(p: Phase) {
    this.phase = p;
    this.emit();
  }

  private local(serverTime: number) {
    return serverTime - this.offset;
  }

  private tokenKey() {
    return `brc.lobby.${this.code}`;
  }

  connect() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/api/lobby/${this.code}/ws`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      let token: string | undefined;
      try {
        token = localStorage.getItem(this.tokenKey()) ?? undefined;
      } catch {
        // No storage: join as a new player.
      }
      const device = matchMedia("(pointer: coarse)").matches ? "phone" : "computer";
      this.send({ t: "hello", token, name: this.playerName, device });
    };
    ws.onmessage = (e) => this.onMessage(JSON.parse(e.data as string) as ServerMessage);
    ws.onclose = () => {
      if (this.closed) return;
      // Reconnect with backoff; the token brings us back to the same seat.
      const delay = Math.min(8000, 500 * 2 ** this.retry++);
      setTimeout(() => !this.closed && this.connect(), delay);
    };
  }

  dispose() {
    this.closed = true;
    this.ws?.close();
    this.listeners.clear();
  }

  private send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private toView(b: NetBoard): BoardView {
    return { id: b.id, fen: b.fen, lastMove: b.lastMove, openingName: b.openingName, openingMoves: b.openingMoves };
  }

  private onMessage(m: ServerMessage) {
    this.offset = m.now - Date.now();
    switch (m.t) {
      case "welcome":
        this.myId = m.playerId;
        try {
          localStorage.setItem(this.tokenKey(), m.token);
        } catch {
          // Reconnecting from this device won't keep the seat.
        }
        if (this.phase.kind === "loading") this.setPhase({ kind: "lobby" });
        return;
      case "error":
        this.error = m.message;
        this.closed = true;
        return this.emit();
      case "lobby":
        this.players = m.players;
        this.hostId = m.hostId;
        this.started = m.started;
        if (!m.started && this.phase.kind !== "lobby") this.phase = { kind: "lobby" };
        return this.emit();
      case "opening":
        return this.setPhase({ kind: "opening", boards: m.boards.map((b) => this.toView(b)) });
      case "round":
        this.key = m.key;
        this.myPick = null;
        this.stage = m.stage;
        this.roundsPlayed = m.round;
        this.standingsList = m.standings;
        this.cutoff = m.cutoff;
        if (m.board) {
          this.currentBoard = m.board;
          this.playStartedAt = Date.now();
          return this.setPhase({ kind: "play", board: this.toView(m.board), deadline: this.local(m.deadline) });
        }
        return this.emit();
      case "locked":
        if (this.phase.kind === "play" && m.key === this.key) {
          this.setPhase({ kind: "scoring", board: this.phase.board, move: this.myPick });
        }
        return;
      case "scoreRequest":
        return void this.hostScore(m.key, m.jobs);
      case "reveal":
        return this.onReveal(m);
      case "stageBreak": {
        this.standingsList = m.standings;
        const youOut = !!this.myId && m.knockedOut.includes(this.myId);
        if (this.myId && m.placements[this.myId]) this.placement = m.placements[this.myId]!;
        return this.setPhase({
          kind: "stageBreak",
          stage: m.stage,
          standings: this.standings(),
          knockedOut: this.standings().filter((s) => m.knockedOut.includes(s.id)),
          cutoff: m.cutoff,
          youOut,
          nextBoards: m.nextBoards.map((b) => this.toView(b)),
        });
      }
      case "spectate":
        this.standingsList = m.standings;
        this.stage = m.stage;
        if (this.phase.kind !== "stageBreak") this.setPhase({ kind: "spectating", boards: m.boards.map((b) => this.toView(b)) });
        return;
      case "chooseColour":
        if (m.chooserId === this.myId) return this.setPhase({ kind: "duelColour", opponentName: "your opponent" });
        this.waitingFor = this.nameOf(m.chooserId);
        return this.setPhase({ kind: "spectating", boards: [] });
      case "duel": {
        const d = m.duel;
        const mine = this.myId === d.white || this.myId === d.black;
        const youColour = this.myId === d.black ? "b" : "w";
        const opponentId = youColour === "w" ? d.black : d.white;
        const over = d.over
          ? {
              winner: d.over.winner === this.myId ? ("you" as const) : mine ? ("opponent" as const) : ("draw" as const),
              reason: mine ? d.over.reason : `${this.nameOf(d.over.winner)} wins: ${d.over.reason}`,
            }
          : null;
        const view: DuelView = {
          opponentName: mine ? this.nameOf(opponentId) : `${this.nameOf(d.white)} vs ${this.nameOf(d.black)}`,
          youColour,
          fen: d.fen,
          history: d.history,
          lastMove: d.lastMove,
          clocks: d.clocks,
          turnStartedAt: this.local(d.turnStartedAt),
          over,
          spectator: !mine,
        };
        return this.setPhase({ kind: "duel", duel: view });
      }
      case "botMoveRequest":
        return void this.hostBotMove(m.ply, m.fen, m.skill);
      case "duelScoreRequest":
        return void this.hostDuelScore(m.ply, m.fen, m.move);
      case "results":
        if (this.myId) {
          this.placement = m.placements[this.myId] ?? this.placement;
          this.lossesByStage = m.lossesByStage[this.myId] ?? [];
        }
        // A finalist sees the final position first and taps through to results.
        if (this.phase.kind === "duel" && !this.phase.duel.spectator) {
          this.pendingResults = m;
          return this.emit();
        }
        return this.showResults(m);
    }
  }

  private playStartedAt = 0;

  private showResults(m: Extract<ServerMessage, { t: "results" }>) {
    const placement = (this.myId && m.placements[this.myId]) || this.placement || this.totalPlayers;
    this.setPhase({ kind: "results", placement, winner: m.winner, youWon: placement === 1 });
  }

  private onReveal(m: Extract<ServerMessage, { t: "reveal" }>) {
    this.stage = m.stage;
    this.roundsPlayed = m.roundsPlayed;
    this.standingsList = m.standings;
    this.cutoff = m.cutoff;
    if (!m.fenBefore || !this.currentBoard) return this.emit();
    const me = m.picks.find((p) => p.playerId === this.myId);
    if (me) {
      this.moves.push({
        stage: m.stage,
        round: m.roundsPlayed - 1,
        fen: m.fenBefore,
        move: me.move,
        san: me.move ? toSan(m.fenBefore, me.move) : "—",
        loss: me.loss,
        roundScore: me.roundScore,
      });
    }
    this.setPhase({
      kind: "reveal",
      board: this.toView(this.currentBoard),
      mine: {
        fenBefore: m.fenBefore,
        bestMove: m.bestMove!,
        playerIds: m.picks.map((p) => p.playerId),
        result: { players: m.picks, playedMove: m.playedMove! },
      },
    });
    void this.crossCheck(m);
  }

  /** Re-scores this player's group and tells the server if it disagrees with the host. */
  private async crossCheck(m: Extract<ServerMessage, { t: "reveal" }>) {
    if (this.isHost || !m.fenBefore) return;
    try {
      const [engine] = await this.engines();
      const moves = [...new Set(m.picks.flatMap((p) => (p.move ? [p.move] : [])))];
      // Same searches as the host (hostScore): the top moves, then one search over the picks outside them.
      const top = await engine!.topMoves(m.fenBefore, this.settings.botCandidateMoves);
      const mine: Record<string, number> = Object.fromEntries(top.map((x) => [x.move, x.expected]));
      const missing = moves.filter((mv) => mine[mv] === undefined);
      if (missing.length) for (const s of await engine!.scoreMoves(m.fenBefore, missing)) mine[s.move] = s.expected;
      const bad = moves.filter((mv) => m.expectedAfter[mv] !== undefined && Math.abs((mine[mv] ?? -1) - m.expectedAfter[mv]!) > 0.002);
      const detail = bad.map((mv) => `${mv} host ${m.expectedAfter[mv]!.toFixed(3)} mine ${(mine[mv] ?? -1).toFixed(3)}`).join(", ");
      this.send({ t: "crossCheck", key: m.key, boardId: this.currentBoard?.id ?? -1, ok: bad.length === 0, detail: detail ? `${detail} @ ${m.fenBefore}` : "" });
    } catch {
      // No engine on this device; skip the check.
    }
  }

  // ---------------- Host work ----------------

  private async hostScore(key: string, jobs: ScoreJob[]) {
    const engines = await this.engines();
    const t = performance.now();
    const out: BoardScore[] = new Array(jobs.length);
    let next = 0;
    await Promise.all(
      engines.map(async (engine) => {
        while (next < jobs.length) {
          const i = next++;
          const job = jobs[i]!;
          const top = await engine.topMoves(job.fen, this.settings.botCandidateMoves);
          const best = top[0]!.expected;
          const candidates = top.map((mv) => ({ move: mv.move, loss: Math.max(0, (best - mv.expected) * 100) }));
          const legal = legalMoves(job.fen);
          const botPicks: Record<string, string> = {};
          const botThinkMs: Record<string, number> = {};
          for (const b of job.bots) {
            botPicks[b.id] = botPick(Math.random, candidates, b.skill, legal, this.settings);
            botThinkMs[b.id] = Math.round((2 + Math.random() * 6) * 1000);
          }
          const expectedAfter: Record<string, number> = Object.fromEntries(top.map((mv) => [mv.move, mv.expected]));
          const missing = [...Object.values(job.humanPicks), ...Object.values(botPicks)].filter(
            (mv): mv is string => !!mv && expectedAfter[mv] === undefined,
          );
          if (missing.length) for (const s of await engine.scoreMoves(job.fen, missing)) expectedAfter[s.move] = s.expected;
          out[i] = { boardId: job.boardId, bestMove: top[0]!.move, bestExpected: best, expectedAfter, botPicks, botThinkMs };
        }
      }),
    );
    this.scoringMs.push(performance.now() - t);
    this.send({ t: "scores", key, boards: out });
  }

  private async hostBotMove(ply: number, fen: string, skill: number) {
    const [engine] = await this.engines();
    const top = await engine!.topMoves(fen, this.settings.botCandidateMoves);
    const best = top[0]!.expected;
    const candidates = top.map((mv) => ({ move: mv.move, loss: Math.max(0, (best - mv.expected) * 100) }));
    const move = botPick(Math.random, candidates, skill, legalMoves(fen), this.settings);
    // Think for a moment so the bot doesn't move instantly.
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 1500));
    this.send({ t: "botMove", ply, move, loss: candidates.find((c) => c.move === move)?.loss ?? null });
  }

  private async hostDuelScore(ply: number, fen: string, move: string) {
    const engines = await this.engines();
    const engine = engines[1] ?? engines[0]!;
    const a = await engine.analyse(fen, [move], 1);
    const mine = a.moves.find((x) => x.move === move);
    if (mine) this.send({ t: "duelLoss", ply, loss: Math.max(0, (a.best.expected - mine.expected) * 100) });
  }

  // ---------------- Player actions ----------------

  startMatch() {
    this.send({ t: "start" });
  }

  submit(move: string | null) {
    if (this.phase.kind !== "play" || !this.key || !move) return;
    this.myPick = move;
    this.send({ t: "pick", key: this.key, move });
    this.setPhase({ kind: "scoring", board: this.phase.board, move });
  }

  skipReveal() {}
  continueFromBreak() {}

  chooseColour(colour: "w" | "b") {
    this.send({ t: "chooseColour", colour });
  }

  duelMove(move: string) {
    if (this.phase.kind !== "duel" || this.phase.duel.over || this.phase.duel.spectator) return;
    const d = this.phase.duel;
    if (sideToMove(d.fen) !== d.youColour || !legalMoves(d.fen).includes(move)) return;
    this.send({ t: "duelMove", move });
  }

  resign() {
    this.send({ t: "resign" });
  }

  finishAfterDuel() {
    if (this.pendingResults) this.showResults(this.pendingResults);
  }

  duelClocks(d: DuelView) {
    const side = sideToMove(d.fen);
    const running = d.over ? 0 : Date.now() - d.turnStartedAt;
    return { ...d.clocks, [side]: Math.max(0, d.clocks[side] - running) };
  }
}
