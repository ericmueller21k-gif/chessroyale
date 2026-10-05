import { DEFAULT_SETTINGS, botChoose, botThinkMs as thinkMs, type Augment, type Settings } from "@chessroyale/core";
import {
  legalMoves,
  toSan,
  type BoardScore,
  type ClientMessage,
  type LobbyPlayer,
  type BoardSlot,
  type NetBoard,
  type NetStanding,
  type LivePick,
  type ScoreJob,
  type ServerMessage,
  type UciEngine,
  TopMovesCache,
  bossGuardFrom,
  recheckCloseCalls,
  bossMoveFrom,
} from "@chessroyale/chess";
import type { BossView, BoardView, FinalView, GameView, Hint, MoveRecord, Phase, Standing, VoteView } from "./game.ts";
import { hintsFrom, whiteExpected } from "./hints.ts";
import { account } from "./account.ts";
import { RoundProgress } from "./progress.ts";
import { moveRecordFrom, type GroupReveal } from "./game.ts";

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
  /** The 2v2 final once it has started. */
  final: FinalView | null = null;
  /** The boss battle once it has started. */
  boss: BossView | null = null;
  /** Matchmade lobby ("Play now"): starts by itself at fillAt (local time). */
  auto = false;
  fillAt: number | null = null;
  readonly serverPaced = true;
  private voteState: VoteView | null = null;

  private ws: WebSocket | null = null;
  private listeners = new Set<() => void>();
  private offset = 0;
  private key: string | null = null;
  private myPick: string | null = null;
  private currentBoard: NetBoard | null = null;
  private standingsList: NetStanding[] = [];
  private slotList: BoardSlot[] = [];
  private closed = false;
  private retry = 0;
  /** Top-move searches started while players think (the host's for every board, others' for their own). */
  private top = new TopMovesCache(DEFAULT_SETTINGS.botCandidateMoves);
  hint: Hint[] | null = null;
  readonly seen = new Map<string, number>();
  private progress = new RoundProgress(() => this.emit());
  get done(): ReadonlySet<string> {
    return this.progress.done;
  }

  constructor(
    readonly code: string,
    readonly playerName: string,
    private readonly engines: () => Promise<UciEngine[]>,
    readonly practice = false,
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
  slots(): BoardSlot[] {
    return this.slotList;
  }
  powerUpsLeft(): number {
    if (this.practice) return Infinity;
    if (this.hint) return 0;
    return this.standingsList.find((s) => s.id === this.myId)?.powerUps ?? 0;
  }
  usePowerUp() {
    if (this.phase.kind !== "play" || !this.key || this.hint || this.powerUpsLeft() <= 0) return;
    const fen = this.phase.board.fen;
    this.send({ t: "powerUp", key: this.key });
    this.hint = [];
    this.emit();
    void this.engines()
      .then((engines) => this.top.get(engines[0]!, fen))
      .then((top) => {
        if (this.phase.kind === "play" && this.phase.board.fen === fen) {
          this.hint = hintsFrom(fen, top);
          this.emit();
        }
      })
      .catch(() => undefined);
  }
  async evaluate(fen: string): Promise<number | null> {
    const engines = await this.engines();
    return whiteExpected(fen, await this.top.get(engines[0]!, fen));
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
      this.send({ t: "hello", token, name: this.playerName, device, practice: this.practice, rating: account().profile?.rating ?? null });
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
    this.progress.reset();
    this.ws?.close();
    this.listeners.clear();
  }

  private send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private toView(b: NetBoard): BoardView {
    return b;
  }

  private onMessage(m: ServerMessage) {
    this.offset = m.now - Date.now();
    if ("slots" in m && m.slots) this.slotList = m.slots;
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
        this.auto = !!m.auto;
        this.fillAt = m.fillAt ? this.local(m.fillAt) : null;
        if (!m.started && this.phase.kind !== "lobby") this.phase = { kind: "lobby" };
        return this.emit();
      case "opening":
        return this.setPhase({ kind: "opening", boards: m.boards.map((b) => this.toView(b)) });
      case "round":
        this.key = m.key;
        this.kingCalled = false;
        this.tally = null;
        this.myPick = null;
        this.hint = null;
        this.progress.start(m.botsDoneIn ?? {}, this.local(m.startsAt ?? m.now) - Date.now());
        this.stage = m.stage;
        this.roundsPlayed = m.round;
        this.standingsList = m.standings;
        this.cutoff = m.cutoff;
        if (m.moveClock) this.settings = { ...this.settings, moveClockSeconds: m.moveClock };
        if (m.board && m.watching) {
          // Crowd 50 v 50: the other team is choosing.
          this.currentBoard = m.board;
          return this.setPhase({ kind: "watching", board: this.toView(m.board), startsAt: this.local(m.startsAt ?? m.now), deadline: this.local(m.deadline) });
        }
        if (m.board) {
          this.prefetch([m.board.fen]);
          this.currentBoard = m.board;
          const startsAt = this.local(m.startsAt ?? m.now);
          this.playStartedAt = startsAt;
          const deadline = this.local(m.deadline);
          return this.setPhase({ kind: "play", board: this.toView(m.board), startsAt, deadline, allowedMs: Math.max(0, deadline - startsAt) });
        }
        return this.emit();
      case "moved":
        if (m.key === this.key) this.progress.mark(m.playerId);
        return;
      case "locked":
        if (m.key !== this.key) return;
        // Everyone's in: anyone still shown as thinking (bots) finishes quickly while the host scores.
        void this.progress.finishAll(this.standingsList.filter((s) => !s.out).map((s) => s.id), 900);
        if (this.phase.kind === "play") this.setPhase({ kind: "scoring", board: this.phase.board, move: this.myPick, strike: this.phase.strike });
        else if (this.phase.kind === "watching") this.setPhase({ kind: "scoring", board: this.phase.board, move: null, watched: true });
        return;
      case "prefetch":
        this.prefetch(m.fens);
        if (m.plan) void this.planBots(m.plan);
        return;
      case "strike": {
        // Players who already picked see him strike too.
        if (m.key !== this.key || (this.phase.kind !== "play" && (this.phase.kind !== "scoring" || this.phase.watched))) return;
        const prev = this.phase.strike;
        const strike = { calls: m.calls, needed: m.needed, mine: !!prev?.mine, ...(m.at !== undefined ? { at: this.local(m.at), until: this.local(m.until!) } : {}) };
        // He struck: the clock stood still meanwhile, for the bots still thinking too.
        if (m.at !== undefined && m.until !== undefined && prev?.at === undefined) this.progress.postpone(m.until - m.at);
        if (this.phase.kind === "scoring") return this.setPhase({ ...this.phase, strike });
        return this.setPhase({ ...this.phase, ...(m.deadline !== undefined ? { deadline: this.local(m.deadline) } : {}), strike });
      }
      case "tally":
        if (m.key !== this.key) return;
        this.tally = m.picks.map((p) => ({ ...p, at: this.local(p.at) }));
        return this.emit();
      case "scoreRequest":
        return void this.hostScore(m.key, m.jobs, !!m.serverRecheck);
      case "reveal":
        return this.onReveal(m);
      case "stageBreak": {
        this.standingsList = m.standings;
        this.augmentVote = null;
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
          until: this.local(m.until),
          augments: m.augments,
          moveClock: m.moveClock,
        });
      }
      case "spectate":
        this.standingsList = m.standings;
        this.stage = m.stage;
        if (this.phase.kind !== "stageBreak") this.setPhase({ kind: "spectating", boards: m.boards.map((b) => this.toView(b)) });
        return;
      case "final":
        this.final = { ...m.final, board: this.toView(m.final.board) };
        this.standingsList = m.standings;
        // During your own turn the play screen stays up; otherwise watch the final.
        if (this.phase.kind === "play" && m.final.mover === this.myId) return this.emit();
        return this.setPhase({ kind: "final", final: this.final });
      case "vote": {
        this.standingsList = m.standings;
        const v = m.vote;
        this.voteState = { ...v, startsAt: this.local(v.startsAt), until: this.local(v.until), votes: v.votes.map((x) => ({ ...x, at: this.local(x.at) })), ...(v.nextAt ? { nextAt: this.local(v.nextAt) } : {}) };
        // Keep your own vote if the server's copy hasn't caught up yet.
        if (this.myVoteLocal && this.myVoteLocal.key === v.key && !this.voteState.votes.some((x) => x.playerId === this.myId)) {
          this.voteState.votes.push(this.myVoteLocal.entry);
        }
        return this.setPhase({ kind: "vote", vote: this.voteState });
      }
      case "voteCast": {
        const v = this.voteState;
        if (!v || v.key !== m.key || v.votes.some((x) => x.playerId === m.playerId)) return;
        this.voteState = { ...v, votes: [...v.votes, { playerId: m.playerId, option: m.option, at: this.local(m.at), side: m.side }] };
        return this.setPhase({ kind: "vote", vote: this.voteState });
      }
      case "boss":
        this.boss = { ...m.boss, board: this.toView(m.boss.board) };
        this.standingsList = m.standings;
        this.currentBoard = m.boss.board;
        return this.setPhase({ kind: "boss", boss: this.boss, until: m.until ? this.local(m.until) : 0, thinking: m.thinking, intro: m.intro });
      case "bossRequest":
        return void this.hostBoss(m.key, m.fen, m.elo, m.nodes, m.stumble ? "stumble" : m.stagger ? "stagger" : "elo");
      case "results":
        if (this.myId) {
          this.placement = m.placements[this.myId] ?? this.placement;
          this.lossesByStage = m.lossesByStage[this.myId] ?? [];
        }
        if (m.standings) this.standingsList = m.standings;
        return this.showResults(m);
    }
  }

  private playStartedAt = 0;

  private showResults(m: Extract<ServerMessage, { t: "results" }>) {
    const placement = (this.myId && m.placements[this.myId]) || this.placement || this.totalPlayers;
    this.setPhase({ kind: "results", placement, winner: m.winner, youWon: placement === 1, gameWinner: m.gameWinner, ...(m.bossResult ? { bossResult: m.bossResult } : {}) });
  }

  private onReveal(m: Extract<ServerMessage, { t: "reveal" }>) {
    this.stage = m.stage;
    this.roundsPlayed = m.roundsPlayed;
    this.standingsList = m.standings;
    this.cutoff = m.cutoff;
    if (!m.fenBefore || !this.currentBoard) return this.emit();
    const mine: GroupReveal = {
      fenBefore: m.fenBefore,
      bestMove: m.bestMove!,
      playerIds: m.picks.map((p) => p.playerId),
      result: { players: m.picks, playedMove: m.playedMove!, drawRule: m.drawRule ?? "random" },
      ...(m.king !== undefined ? { king: m.king, kingCalls: m.kingCalls } : {}),
    };
    const record = moveRecordFrom(m.stage, m.roundsPlayed - 1, mine, (id) => id === this.myId);
    if (record) this.moves.push(record);
    this.setPhase({ kind: "reveal", until: this.local(m.until), board: this.toView(this.currentBoard), mine });
    void this.crossCheck(m);
  }

  /** Re-scores this player's group and tells the server if it disagrees with the host. */
  private async crossCheck(m: Extract<ServerMessage, { t: "reveal" }>) {
    if (this.isHost || !m.fenBefore) return;
    try {
      const [engine] = await this.engines();
      const moves = [...new Set(m.picks.flatMap((p) => (p.move ? [p.move] : [])))];
      // Same searches as the host (hostScore): the top moves, then one search over the picks outside them.
      const top = await this.top.get(engine!, m.fenBefore);
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

  /** Boss battle, host only: play the boss's move with this device's engine at the boss's strength. */
  private async hostBoss(key: string, fen: string, elo: number, nodes: number, kind: "elo" | "stumble" | "stagger") {
    try {
      const [engine] = await this.engines();
      const move = await bossMoveFrom(engine!, fen, elo, nodes, kind, Math.random, this.settings.kingStrikeLoss, bossGuardFrom(this.settings));
      this.send({ t: "bossMove", key, move });
    } catch {
      // No engine here: the server asks someone else, or plays a random move.
    }
  }

  private prefetch(fens: string[]) {
    void this.engines()
      .then((engines) => this.top.prefetch(engines, fens))
      .catch(() => undefined);
  }

  /** Crowd, host only: decide the bots' picks now (from the round's search) so everyone can watch them come in. */
  private async planBots(plan: NonNullable<Extract<ServerMessage, { t: "prefetch" }>["plan"]>) {
    try {
      const engines = await this.engines();
      const top = await this.top.get(engines[0]!, plan.fen);
      const best = top[0]!.expected;
      const candidates = top.map((mv) => ({ move: mv.move, loss: Math.max(0, (best - mv.expected) * 100) }));
      const legal = legalMoves(plan.fen);
      const picks: Record<string, string> = {};
      const powerUps: string[] = [];
      for (const b of plan.bots) {
        const choice = botChoose(Math.random, candidates, { skill: b.skill, powerUps: b.powerUps ?? 0 }, legal, this.settings);
        picks[b.id] = choice.move;
        if (choice.usedPowerUp) powerUps.push(b.id);
      }
      if (this.key === plan.key) this.send({ t: "botPlan", key: plan.key, picks, powerUps });
    } catch {
      // No engine: the bots pick at scoring time instead.
    }
  }

  private async hostScore(key: string, jobs: ScoreJob[], serverRecheck = false) {
    const engines = await this.engines();
    const t = performance.now();
    const out: BoardScore[] = new Array(jobs.length);
    let next = 0;
    await Promise.all(
      engines.map(async (engine) => {
        while (next < jobs.length) {
          const i = next++;
          const job = jobs[i]!;
          const top = await this.top.get(engine, job.fen);
          const best = top[0]!.expected;
          const candidates = top.map((mv) => ({ move: mv.move, loss: Math.max(0, (best - mv.expected) * 100) }));
          const legal = legalMoves(job.fen);
          const botPicks: Record<string, string> = {};
          const botThinkMs: Record<string, number> = {};
          const botPowerUps: string[] = [];
          for (const b of job.bots) {
            // Crowd: picks decided at the start of the round (and already shown live) stand.
            const planned = job.botPlan?.[b.id];
            if (planned) {
              botPicks[b.id] = planned;
              if (job.botPlanPowerUps?.includes(b.id)) botPowerUps.push(b.id);
              botThinkMs[b.id] = thinkMs(Math.random, this.settings);
              continue;
            }
            const choice = botChoose(Math.random, candidates, { skill: b.skill, powerUps: b.powerUps ?? 0 }, legal, this.settings);
            botPicks[b.id] = choice.move;
            if (choice.usedPowerUp) botPowerUps.push(b.id);
            botThinkMs[b.id] = thinkMs(Math.random, this.settings);
          }
          const expectedAfter: Record<string, number> = Object.fromEntries(top.map((mv) => [mv.move, mv.expected]));
          const missing = [...Object.values(job.humanPicks), ...Object.values(botPicks)].filter(
            (mv): mv is string => !!mv && expectedAfter[mv] === undefined,
          );
          if (missing.length) for (const s of await engine.scoreMoves(job.fen, missing)) expectedAfter[s.move] = s.expected;
          const people = Object.values(job.humanPicks).some((m) => !!m);
          const checked = serverRecheck || !people
            ? { bestMove: top[0]!.move, bestExpected: best, expectedAfter }
            : await recheckCloseCalls(engine, job.fen, { bestMove: top[0]!.move, bestExpected: best, expectedAfter }, [...Object.values(job.humanPicks), ...Object.values(botPicks)], this.settings);
          out[i] = { boardId: job.boardId, bestMove: checked.bestMove, bestExpected: checked.bestExpected, expectedAfter: checked.expectedAfter, botPicks, botThinkMs, botPowerUps };
        }
      }),
    );
    this.scoringMs.push(performance.now() - t);
    this.send({ t: "scores", key, boards: out });
  }

  // ---------------- Player actions ----------------

  startMatch() {
    this.send({ t: "start" });
  }

  submit(move: string | null) {
    if (this.phase.kind !== "play" || !this.key || !move) return;
    if (Date.now() < this.phase.startsAt - 300) return; // Before the clock starts.
    if (this.phase.strike?.until && Date.now() < this.phase.strike.until) return; // While the King strikes.
    this.myPick = move;
    this.send({ t: "pick", key: this.key, move });
    if (this.myId) this.progress.mark(this.myId);
    this.setPhase({ kind: "scoring", board: this.phase.board, move, strike: this.phase.strike });
  }

  /** Crowd: the picks visible to you so far this round (null while you still have to pick). */
  private tally: LivePick[] | null = null;
  livePicks(): LivePick[] | null {
    return this.tally;
  }

  kingCalled = false;
  callKing(strike = false) {
    if (this.phase.kind !== "play" || !this.key || !this.boss?.kingCharges || this.kingCalled) return;
    if (strike) {
      // A strike isn't your turn: you still pick once he's done (the server says when he strikes).
      if (this.phase.strike?.mine) return;
      this.send({ t: "king", key: this.key, strike: true });
      const crowd = this.standingsList.filter((x) => !x.out).length;
      const prev = this.phase.strike;
      return this.setPhase({ ...this.phase, strike: { calls: (prev?.calls ?? 0) + 1, needed: prev?.needed ?? Math.floor(crowd / 2) + 1, mine: true } });
    }
    this.kingCalled = true;
    this.send({ t: "king", key: this.key });
    // Calling him to play is your turn: wait for the others like after a move.
    if (this.myId) this.progress.mark(this.myId);
    this.setPhase({ kind: "scoring", board: this.phase.board, move: null, strike: this.phase.strike });
  }

  private myVoteLocal: { key: string; entry: VoteView["votes"][number] } | null = null;
  castVote(option: number) {
    const v = this.voteState;
    if (this.phase.kind !== "vote" || !v || v.result !== null || !this.myId || v.votes.some((x) => x.playerId === this.myId) || Date.now() > v.until) return;
    const side = this.standingsList.find((s) => s.id === this.myId)?.team ?? "w";
    const entry = { playerId: this.myId, option, at: Date.now(), side };
    this.myVoteLocal = { key: v.key, entry };
    this.send({ t: "vote", key: v.key, option });
    this.voteState = { ...v, votes: [...v.votes, entry] };
    this.setPhase({ kind: "vote", vote: this.voteState });
  }

  augmentVote: Augment | null = null;
  voteAugment(choice: Augment) {
    if (this.phase.kind !== "stageBreak" || !this.phase.augments) return;
    this.augmentVote = choice;
    this.send({ t: "augment", choice });
    this.emit();
  }

  skipReveal() {}
  continueFromBreak() {}
}
