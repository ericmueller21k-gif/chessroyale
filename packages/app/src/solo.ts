import { DEFAULT_SETTINGS, allowedMs, type PlayerState, type Settings } from "@chessroyale/core";
import { MatchRunner, netBoard, toSan, type BoardState, type NetFinal, type Opening, type RoundReport, type UciEngine } from "@chessroyale/chess";
import openingsData from "@chessroyale/chess/data/openings.json";
import { botRoster } from "@chessroyale/chess";
import type { BoardView, FinalView, GameView, Hint, MoveRecord, Phase, Standing } from "./game.ts";
import { hintsFrom, whiteExpected } from "./hints.ts";
import { RoundProgress } from "./progress.ts";

export const HUMAN = "you";
/** In the final, how long each move is shown before the next turn. */
const FINAL_SHOW_MS = 3200;
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
  private rng = Math.random;
  private playStartedAt = 0;
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
      entrants: [{ id: HUMAN, name: this.playerName, isBot: false, practice: this.practice }, ...botRoster(this.rng, this.settings.lobbySize - 1, this.settings)],
    });
    this.set({ kind: "opening", boards: [...this.runner.boards.values()].map(boardView) });
    this.timer = setTimeout(() => this.nextRound(), this.settings.openingShowSeconds * 1000);
  }

  private nextRound() {
    if (this.runner.isOver()) return this.finish();
    if (!this.you.alive) return void this.simulateRest();
    if (this.runner.isFinal()) return void this.finalTurn();
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
    const inFinal = this.runner.isFinal();
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
      inFinal ? Promise.resolve() : this.progress.finishAll(this.runner.alive().map((p) => p.id)),
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
    if (inFinal) return this.showFinalMove(report);
    const revealMs = (this.settings.revealSeconds + this.settings.drawnMoveSeconds) * 1000;
    this.set({ kind: "reveal", mine, board, until: Date.now() + revealMs });
    this.timer = setTimeout(() => this.afterReveal(), revealMs);
  }

  skipReveal() {
    if (this.phase.kind !== "reveal" && this.phase.kind !== "final") return;
    if (this.timer) clearTimeout(this.timer);
    if (this.phase.kind === "final") {
      if (this.finalState?.last) this.afterFinalMove();
      return;
    }
    this.afterReveal();
  }

  private afterReveal() {
    if (!this.runner.stageComplete()) return this.nextRound();
    const stage = this.runner.state.stage;
    const before = this.standings();
    const cutoff = this.cutoff;
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

  // ---------------- The 2v2 final ----------------

  private finalState: FinalView | null = null;

  get final(): FinalView | null {
    return this.finalState;
  }

  private setFinal(last: NetFinal["last"] = null) {
    const v = this.runner.finalView(last);
    this.finalState = v && { ...v, board: v.board };
  }

  /** One turn of the final: yours to play, or a bot's (shown thinking, then its move). */
  private async finalTurn() {
    this.runner.deal();
    this.runner.prefetch();
    const mover = [...this.runner.groups.values()][0]![0]!;
    this.setFinal();
    if (mover === HUMAN) {
      this.hint = null;
      const board = this.runner.boardOf(HUMAN)!;
      this.playStartedAt = Date.now();
      const allowed = allowedMs(this.you, this.settings);
      this.set({ kind: "play", board: boardView(board), startsAt: this.playStartedAt, deadline: this.playStartedAt + allowed, allowedMs: allowed });
      this.timer = setTimeout(() => this.submit(null), allowed + this.settings.lateGraceMs);
      return;
    }
    this.set({ kind: "final", final: this.finalState! });
    const think = Math.min(4000, Math.max(1500, this.runner.botThinkTimes()[mover] ?? 2500));
    const [report] = await Promise.all([this.runner.score(new Map()), new Promise((r) => setTimeout(r, think))]);
    if (this.phase.kind !== "final") return;
    this.showFinalMove(report);
  }

  private showFinalMove(report: RoundReport) {
    const b = report.boards[0]!;
    const p = b.result.players[0]!;
    this.setFinal({ playerId: p.playerId, move: b.result.playedMove, san: toSan(b.fenBefore, b.result.playedMove), loss: p.loss });
    this.set({ kind: "final", final: this.finalState! });
    this.timer = setTimeout(() => this.afterFinalMove(), FINAL_SHOW_MS);
  }

  private afterFinalMove() {
    if (this.runner.stageComplete()) {
      this.runner.finishFinal();
      return this.finish();
    }
    void this.finalTurn();
  }

  /** After a knockout, the rest of the match (the final too) is played quickly with no UI. */
  private async simulateRest() {
    while (!this.runner.isOver()) {
      this.set({ kind: "simulating", stage: this.runner.state.stage, round: this.runner.state.round });
      this.runner.deal();
      await this.runner.score(new Map());
      if (this.runner.stageComplete()) {
        if (this.runner.isFinal()) this.runner.finishFinal();
        else this.runner.endStage();
      }
    }
    this.finish();
  }

  private finish() {
    const winner = this.runner.state.players.find((p) => p.placement === 1);
    this.set({ kind: "results", placement: this.you.placement!, winner: winner?.name ?? "", youWon: this.you.placement === 1 });
  }
}
