import { DEFAULT_SETTINGS, allowedMs, botPick, finishDuel, type PlayerState, type Settings } from "@chessroyale/core";
import {
  MatchRunner,
  applyMove,
  netBoard,
  gameEnd,
  legalMoves,
  sideToMove,
  START_FEN,
  toSan,
  type BoardState,
  type Opening,
  type UciEngine,
} from "@chessroyale/chess";
import openingsData from "@chessroyale/chess/data/openings.json";
import { botRoster } from "@chessroyale/chess";
import type { BoardView, DuelView, GameView, Hint, MoveRecord, Phase, Standing } from "./game.ts";
import { hintsFrom, whiteExpected } from "./hints.ts";
import { RoundProgress } from "./progress.ts";

export const HUMAN = "you";
const library = openingsData as Opening[];

export function boardView(b: BoardState): BoardView {
  return netBoard(b, true);
}

/**
 * One human against 31 bots, entirely in the browser. Drives the shared
 * MatchRunner round by round.
 */
export class SoloMatch implements GameView {
  phase: Phase = { kind: "loading" };
  runner!: MatchRunner;
  moves: MoveRecord[] = [];
  scoringMs: number[] = [];
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private finalFourScores = new Map<string, number>();
  private rng = Math.random;
  private playStartedAt = 0;
  private duelOpponent: PlayerState | null = null;
  private duelLosses = { you: [] as number[], bot: [] as number[] };
  hint: Hint[] | null = null;
  readonly seen = new Map<string, number>();
  private progress = new RoundProgress(() => this.emit());

  constructor(
    private readonly engines: UciEngine[],
    readonly playerName: string,
    readonly settings: Settings = DEFAULT_SETTINGS,
    readonly practice = false,
  ) {}

  // ---- GameView ----

  get stage() {
    return this.runner.state.stage;
  }
  get roundsPlayed() {
    return this.runner.state.round;
  }
  get totalPlayers() {
    return this.runner.state.players.length;
  }
  get placement() {
    return this.you.placement;
  }
  get done(): ReadonlySet<string> {
    return this.progress.done;
  }
  get lossesByStage() {
    return this.you.lossesByStage;
  }
  nameOf(id: string) {
    return this.runner.player(id).name;
  }
  isYou(id: string) {
    return id === HUMAN;
  }
  standings(): Standing[] {
    return this.runner.leaderboard().map((s) => ({ ...s, isYou: s.id === HUMAN }));
  }
  powerUpsLeft(): number {
    if (this.practice) return Infinity;
    return this.hint ? 0 : this.you.powerUps;
  }
  usePowerUp() {
    if (this.phase.kind !== "play" || this.hint || this.powerUpsLeft() <= 0) return;
    const fen = this.phase.board.fen;
    this.hint = [];
    this.emit();
    void this.runner.topMovesFor(fen).then((top) => {
      if (this.phase.kind === "play" && this.phase.board.fen === fen) {
        this.hint = hintsFrom(fen, top);
        this.emit();
      }
    });
  }
  async evaluate(fen: string): Promise<number | null> {
    return whiteExpected(fen, await this.runner.topMovesFor(fen));
  }
  get cutoff(): number {
    return this.runner.alive().length - (this.settings.knockoutsPerStage[this.runner.state.stage] ?? 0);
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private set(phase: Phase) {
    this.phase = phase;
    this.listeners.forEach((l) => l());
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
    this.progress.reset();
    this.listeners.clear();
  }

  get you(): PlayerState {
    return this.runner.player(HUMAN);
  }

  start() {
    this.runner = new MatchRunner({
      settings: this.settings,
      rng: this.rng,
      engines: this.engines,
      library,
      entrants: [{ id: HUMAN, name: this.playerName, isBot: false, practice: this.practice }, ...botRoster(this.rng, 31, this.settings)],
    });
    this.set({ kind: "opening", boards: [...this.runner.boards.values()].map(boardView) });
    this.timer = setTimeout(() => this.nextRound(), this.settings.openingShowSeconds * 1000);
  }

  private nextRound() {
    if (this.runner.isDuel()) return this.startDuel();
    if (!this.you.alive) return void this.simulateRest();
    this.runner.deal();
    this.runner.prefetch();
    // The move clock starts after a short settling-in countdown on the new board.
    const intro = this.settings.boardIntroSeconds * 1000;
    this.progress.start(this.runner.botThinkTimes(), intro);
    const board = this.runner.boardOf(HUMAN)!;
    this.playStartedAt = Date.now() + intro;
    this.hint = null;
    const allowed = allowedMs(this.you, this.settings);
    this.set({ kind: "play", board: boardView(board), startsAt: this.playStartedAt, deadline: this.playStartedAt + allowed, allowedMs: allowed });
    this.timer = setTimeout(() => this.submit(null), intro + allowed + this.settings.lateGraceMs);
  }

  /** The human's pick; final once made. */
  submit(move: string | null) {
    void this.score(move);
  }

  private async score(move: string | null) {
    if (this.phase.kind !== "play") return;
    if (this.timer) clearTimeout(this.timer);
    const { board, allowedMs: allowed } = this.phase;
    if (move !== null && Date.now() < this.playStartedAt - 300) return; // Before the clock starts.
    const thinkMs = Math.max(0, Math.min(Date.now() - this.playStartedAt, allowed));
    const usedPowerUp = this.hint !== null;
    this.progress.mark(HUMAN);
    this.set({ kind: "scoring", board, move });
    const t = performance.now();
    // Score while the bots still thinking finish (they light up the leaderboard), then reveal.
    // Scores and the leaderboard only change once everyone has finished.
    const [scored] = await Promise.all([
      this.runner.evaluate(new Map([[HUMAN, { move, thinkMs, usedPowerUp }]])).then((r) => {
        this.scoringMs.push(performance.now() - t);
        return r;
      }),
      this.progress.finishAll(this.runner.alive().map((p) => p.id)),
    ]);
    const report = this.runner.finishRound(scored.results, scored.thinkMs, scored.powerUps);
    const mine = report.boards.find((b) => b.playerIds.includes(HUMAN))!;
    const me = mine.result.players.find((p) => p.playerId === HUMAN)!;
    this.moves.push({
      stage: report.stage,
      round: report.round,
      fen: mine.fenBefore,
      move,
      san: move ? toSan(mine.fenBefore, move) : "—",
      loss: me.loss,
      roundScore: me.roundScore,
    });
    const revealMs = (this.settings.revealSeconds + this.settings.drawnMoveSeconds) * 1000;
    this.set({ kind: "reveal", mine, board, until: Date.now() + revealMs });
    this.timer = setTimeout(() => this.afterReveal(), revealMs);
  }

  skipReveal() {
    if (this.phase.kind !== "reveal") return;
    if (this.timer) clearTimeout(this.timer);
    this.afterReveal();
  }

  private afterReveal() {
    if (!this.runner.stageComplete()) return this.nextRound();
    const stage = this.runner.state.stage;
    const before = this.standings();
    const cutoff = this.cutoff;
    if (stage === this.settings.knockoutsPerStage.length - 1) for (const s of before) if (!s.out) this.finalFourScores.set(s.id, s.points);
    const end = this.runner.endStage();
    const outIds = new Set(end.knockedOut.map((p) => p.id));
    this.set({
      kind: "stageBreak",
      stage,
      standings: before,
      knockedOut: before.filter((s) => outIds.has(s.id)),
      cutoff,
      youOut: outIds.has(HUMAN),
      nextBoards: this.runner.state.boards.map((id) => boardView(this.runner.boards.get(id)!)),
    });
  }

  continueFromBreak() {
    if (this.phase.kind === "stageBreak") this.nextRound();
  }

  /** After a knockout, the rest of the match is played quickly with no UI. */
  private async simulateRest() {
    while (!this.runner.isDuel()) {
      this.set({ kind: "simulating", stage: this.runner.state.stage, round: this.runner.state.round });
      this.runner.deal();
      await this.runner.score(new Map());
      if (this.runner.stageComplete()) this.runner.endStage();
    }
    // Two bots in the duel: the one with the lower average loss over the match wins.
    const [a, b] = this.runner.alive();
    const avg = (p: PlayerState) => {
      const all = p.lossesByStage.flat();
      return all.reduce((s, x) => s + x, 0) / Math.max(1, all.length);
    };
    const winner = avg(a!) <= avg(b!) ? a! : b!;
    this.runner.state = finishDuel(this.runner.state, winner.id);
    this.finish(winner.name);
  }

  private finish(winnerName: string) {
    this.set({ kind: "results", placement: this.you.placement!, winner: winnerName, youWon: this.you.placement === 1 });
  }

  // ---------------- Duel ----------------

  private startDuel() {
    const [a, b] = this.runner.alive();
    const opponent = a!.id === HUMAN ? b! : a!;
    this.duelOpponent = opponent;
    const yours = this.finalFourScores.get(HUMAN) ?? 0;
    const theirs = this.finalFourScores.get(opponent.id) ?? 0;
    // The higher final-four score chooses; a bot always takes White.
    if (yours >= theirs) return this.set({ kind: "duelColour", opponentName: opponent.name });
    this.beginDuel("b");
  }

  chooseColour(colour: "w" | "b") {
    if (this.phase.kind === "duelColour") this.beginDuel(colour);
  }

  private beginDuel(youColour: "w" | "b") {
    const ms = this.settings.duelClockSeconds * 1000;
    this.duelLosses = { you: [], bot: [] };
    this.set({
      kind: "duel",
      duel: {
        opponentName: this.duelOpponent!.name,
        youColour,
        fen: START_FEN,
        history: [],
        lastMove: null,
        clocks: { w: ms, b: ms },
        turnStartedAt: Date.now(),
        over: null,
      },
    });
    this.duelTick();
    if (youColour === "b") void this.botMove();
  }

  duelClocks(d: DuelView): { w: number; b: number } {
    const side = sideToMove(d.fen);
    const running = d.over ? 0 : Date.now() - d.turnStartedAt;
    return { ...d.clocks, [side]: Math.max(0, d.clocks[side] - running) };
  }

  private duelTick() {
    if (this.phase.kind !== "duel" || this.phase.duel.over) return;
    const d = this.phase.duel;
    const side = sideToMove(d.fen);
    if (this.duelClocks(d)[side] <= 0) {
      const youFlagged = side === d.youColour;
      return this.endDuel({ winner: youFlagged ? "opponent" : "you", reason: youFlagged ? "You ran out of time" : "Out of time" });
    }
    this.emit();
    this.timer = setTimeout(() => this.duelTick(), 200);
  }

  private applyDuelMove(move: string, byYou: boolean) {
    if (this.phase.kind !== "duel") return;
    const d = this.phase.duel;
    const side = sideToMove(d.fen);
    const next: DuelView = {
      ...d,
      fen: applyMove(d.fen, move),
      history: [...d.history, move],
      lastMove: move,
      clocks: { ...d.clocks, [side]: Math.max(0, d.clocks[side] - (Date.now() - d.turnStartedAt)) },
      turnStartedAt: Date.now(),
    };
    this.phase = { kind: "duel", duel: next };
    const end = gameEnd(START_FEN, next.history);
    if (end === "checkmate") return this.endDuel({ winner: byYou ? "you" : "opponent", reason: "Checkmate" });
    if (end) {
      // A draw goes to the player with the lower average loss per move in the duel.
      const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
      const youBetter = avg(this.duelLosses.you) <= avg(this.duelLosses.bot);
      return this.endDuel({ winner: youBetter ? "you" : "opponent", reason: `Draw (${end.replace("_", " ")}), decided on move quality` });
    }
    this.emit();
    if (byYou) void this.botMove();
  }

  /** Your duel move. Its quality is scored in the background, for the draw tie-break. */
  duelMove(move: string) {
    if (this.phase.kind !== "duel") return;
    const d = this.phase.duel;
    if (d.over || sideToMove(d.fen) !== d.youColour || !legalMoves(d.fen).includes(move)) return;
    const fenBefore = d.fen;
    this.applyDuelMove(move, true);
    const engine = this.engines[1] ?? this.engines[0]!;
    void engine.analyse(fenBefore, [move], 1).then((a) => {
      const mine = a.moves.find((m) => m.move === move);
      if (mine) this.duelLosses.you.push(Math.max(0, (a.best.expected - mine.expected) * 100));
    });
  }

  private async botMove() {
    if (this.phase.kind !== "duel" || this.phase.duel.over) return;
    const d = this.phase.duel;
    const fen = d.fen;
    const top = await this.engines[0]!.topMoves(fen, this.settings.botCandidateMoves);
    const best = top[0]!.expected;
    const candidates = top.map((m) => ({ move: m.move, loss: Math.max(0, (best - m.expected) * 100) }));
    const move = botPick(this.rng, candidates, this.duelOpponent!.skill ?? 3, legalMoves(fen), this.settings);
    const loss = candidates.find((c) => c.move === move)?.loss;
    if (loss !== undefined) this.duelLosses.bot.push(loss);
    const left = this.duelClocks(d)[sideToMove(fen)];
    await new Promise((r) => setTimeout(r, Math.min(left * 0.05, 800 + Math.random() * 2200)));
    if (this.phase.kind !== "duel" || this.phase.duel.over || this.phase.duel.fen !== fen) return;
    this.applyDuelMove(move, false);
  }

  resign() {
    if (this.phase.kind === "duel" && !this.phase.duel.over) this.endDuel({ winner: "opponent", reason: "You resigned" });
  }

  private endDuel(over: NonNullable<DuelView["over"]>) {
    if (this.phase.kind !== "duel") return;
    if (this.timer) clearTimeout(this.timer);
    this.phase = { kind: "duel", duel: { ...this.phase.duel, over, clocks: this.duelClocks(this.phase.duel) } };
    this.runner.state = finishDuel(this.runner.state, over.winner === "you" ? HUMAN : this.duelOpponent!.id);
    this.emit();
  }

  finishAfterDuel() {
    if (this.phase.kind !== "duel" || !this.phase.duel.over) return;
    this.finish(this.phase.duel.over.winner === "you" ? this.playerName : this.duelOpponent!.name);
  }
}
