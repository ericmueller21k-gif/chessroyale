import { DEFAULT_SETTINGS, allowedMs, botVotes, clockAfterVote, cutSeconds, pregameVotes, tallyVotes, type Augment, type PlayerState, type Settings } from "@chessroyale/core";
import { MatchRunner, boardSlots, netBoard, type LivePick, toSan, type BoardSlot, type BoardState, type NetFinal, type Opening, type RoundReport, type UciEngine } from "@chessroyale/chess";
import openingsData from "@chessroyale/chess/data/openings.json";
import { botRoster } from "@chessroyale/chess";
import type { BossView, BoardView, FinalView, GameView, Hint, MoveRecord, Phase, Standing, VoteView } from "./game.ts";
import { hintsFrom, whiteExpected } from "./hints.ts";
import { RoundProgress } from "./progress.ts";

export const HUMAN = "you";
/** In the final, how long each move is shown before the next turn. */
const FINAL_SHOW_MS = 3200;
/** Boss battle: how long the boss's move shows, how long it thinks at least, and how long a strike shows. */
const BOSS_SHOW_MS = 1800;
const BOSS_THINK_MS = 1200;
const BOSS_KILL_MS = 3800;
const BOSS_INTRO_MS = 5500;
/** The God King's summoning and bolt, added to a reveal where he acts. */
const KING_FX_MS = 3900;
const library = openingsData as unknown as Opening[];

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
    private readonly baseSettings: Settings = DEFAULT_SETTINGS,
    readonly practice = false,
  ) {}

  /** The match's settings (the move clock can change with Crowd augment votes). */
  get settings(): Settings {
    return this.runner?.settings ?? this.baseSettings;
  }
  /** Crowd: this round's live picks (bots decided at the start, shown as each finishes thinking). */
  private live: { startsAt: number; times: Record<string, number>; picks: ReadonlyMap<string, string> | null; mine: LivePick | null; rushFrom: number | null } | null = null;

  private startLive(startsAt: number, times: Record<string, number>) {
    if (this.settings.mode !== "crowd") return void (this.live = null);
    const live = { startsAt, times, picks: null as ReadonlyMap<string, string> | null, mine: null, rushFrom: null };
    this.live = live;
    void this.runner.planBotPicks().then((picks) => {
      if (this.live === live) {
        live.picks = picks;
        this.emit();
      }
    });
  }

  livePicks(): LivePick[] | null {
    const live = this.live;
    // Hidden until you've picked; the watching team sees them all along.
    if (!live?.picks || this.phase.kind === "play") return null;
    const out: LivePick[] = [];
    let k = 0;
    for (const [playerId, move] of live.picks) {
      let at = live.startsAt + (live.times[playerId] ?? 0);
      if (live.rushFrom !== null && at > live.rushFrom) at = live.rushFrom + 15 * k++;
      out.push({ playerId, move, at });
    }
    if (live.mine) out.push(live.mine);
    return out;
  }

  augmentVote: Augment | null = null;
  voteAugment(choice: Augment) {
    if (this.phase.kind !== "stageBreak" || !this.phase.augments) return;
    this.augmentVote = choice;
    this.emit();
  }

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
  slots(): BoardSlot[] {
    return this.runner ? boardSlots(this.runner.boards, this.runner.state.boards) : [];
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
      // A boss raid alone is just you against the boss.
      entrants: [
        { id: HUMAN, name: this.playerName, isBot: false, practice: this.practice },
        ...(this.settings.raid ? [] : botRoster(this.rng, this.settings.lobbySize - 1, this.settings)),
      ],
    });
    if (pregameVotes(this.settings).length) return this.startVote(0);
    this.set({ kind: "opening", boards: [...this.runner.boards.values()].map(boardView) });
    this.timer = setTimeout(() => this.nextRound(), this.settings.openingShowSeconds * 1000);
  }

  // ---------------- Pre-game votes ----------------

  private voteState: VoteView | null = null;
  get myVote(): number | null {
    return this.voteState?.votes.find((v) => v.playerId === HUMAN)?.option ?? null;
  }

  /** A pre-game vote: everyone pushes a pawn into a zone; the bots' votes come in over the window. */
  private startVote(index: number) {
    const votes = pregameVotes(this.settings);
    const ms = this.settings.voteSeconds * 1000;
    const now = Date.now();
    const bots = this.runner.state.players.filter((p) => p.isBot);
    const side = new Map(this.runner.state.players.map((p) => [p.id, p.colour ?? "w"]));
    this.voteState = {
      key: `vote-${index}`,
      index,
      count: votes.length,
      startsAt: now,
      until: now + ms,
      votes: botVotes(this.rng, bots.map((b) => b.id), votes[index]!.options.length, ms).map((v) => ({ playerId: v.id, option: v.option, at: now + v.atMs, side: side.get(v.id)! })),
      result: null,
    };
    this.set({ kind: "vote", vote: this.voteState });
    this.timer = setTimeout(() => this.endVote(), ms);
  }

  castVote(option: number) {
    const v = this.voteState;
    if (this.phase.kind !== "vote" || !v || v.result !== null || this.myVote !== null || Date.now() > v.until) return;
    v.votes = [...v.votes, { playerId: HUMAN, option, at: Date.now(), side: this.you.colour ?? "w" }];
    this.set({ kind: "vote", vote: { ...v } });
  }

  private endVote() {
    const v = this.voteState!;
    const def = pregameVotes(this.settings)[v.index]!;
    const result = tallyVotes(v.votes.map((x) => x.option), def.options.length, def.defaultOption, this.rng);
    this.runner.patchSettings(def.options[result]!.patch);
    const nextAt = Date.now() + this.settings.voteResultSeconds * 1000;
    this.voteState = { ...v, result, nextAt };
    this.set({ kind: "vote", vote: this.voteState });
    this.timer = setTimeout(() => (v.index + 1 < v.count ? this.startVote(v.index + 1) : this.nextRound()), nextAt - Date.now());
  }

  // ---------------- Boss battle ----------------

  private bossIntroDone = false;
  kingCalled: "play" | "strike" | null = null;
  /** Calling the God King (to play the move, or to strike the boss) is your whole turn: no move of your own. */
  callKing(strike = false) {
    if (this.phase.kind !== "play" || !this.runner.boss?.kingCharges || this.kingCalled) return;
    this.kingCalled = strike ? "strike" : "play";
    (strike ? this.runner.kingStrikers : this.runner.kingCallers).add(HUMAN);
    void this.score(null);
  }
  get boss(): BossView | null {
    const v = this.runner?.bossView();
    return v ? { ...v, board: v.board } : null;
  }
  private bossSnapshot(justKilled: string | null = null): BossView {
    const v = this.runner.bossView(justKilled)!;
    return { ...v, board: v.board };
  }

  /** The boss's turn: it thinks (for a moment at least), then its move shows before the crowd picks again. */
  private async bossTurn() {
    this.set({ kind: "boss", boss: this.bossSnapshot(), until: 0, thinking: true });
    await Promise.all([this.runner.playBoss(this.engines[0]), new Promise((r) => setTimeout(r, BOSS_THINK_MS))]);
    const until = Date.now() + BOSS_SHOW_MS;
    this.set({ kind: "boss", boss: this.bossSnapshot(), until });
    this.timer = setTimeout(() => this.nextRound(), BOSS_SHOW_MS);
  }

  /** After a crowd move in the boss battle: the boss strikes when it's due. */
  private afterBossRound() {
    if (this.runner.bossKillDue()) {
      const victim = this.runner.bossKill();
      const until = Date.now() + BOSS_KILL_MS;
      this.set({ kind: "boss", boss: this.bossSnapshot(victim), until });
      this.timer = setTimeout(() => this.nextRound(), BOSS_KILL_MS);
      return;
    }
    this.nextRound();
  }

  private nextRound() {
    if (this.runner.isOver()) return this.finish();
    if (!this.you.alive) return void this.simulateRest();
    if (this.runner.boss) {
      if (!this.bossIntroDone) {
        // The boss arrives: it takes over from an even position of the game just played.
        this.bossIntroDone = true;
        this.set({ kind: "boss", boss: this.bossSnapshot(), until: Date.now() + BOSS_INTRO_MS, intro: true });
        this.timer = setTimeout(() => this.nextRound(), BOSS_INTRO_MS);
        return;
      }
      if (this.runner.stageComplete()) {
        this.runner.finishBossBattle();
        return this.finish();
      }
      if (this.runner.bossToMove()) return void this.bossTurn();
    } else if (this.runner.isFinal()) return void this.finalTurn();
    this.runner.deal();
    this.kingCalled = null;
    this.runner.prefetch();
    if (!this.runner.boardOf(HUMAN)) return this.watchTurn();
    // The move clock starts after a short settling-in countdown on the new board.
    const intro = this.settings.boardIntroSeconds * 1000;
    this.progress.start(this.runner.botThinkTimes(), intro);
    this.startLive(Date.now() + intro, this.runner.botThinkTimes());
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
    const inFinal = !!this.runner.final;
    this.progress.mark(HUMAN);
    if (this.live) {
      // Your pick shows straight away; the bots still thinking finish quickly (as they do on the leaderboard).
      const now = Date.now();
      if (move) this.live.mine = { playerId: HUMAN, move, at: now };
      this.live.rushFrom = now;
    }
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
    const revealMs = (this.settings.revealSeconds + this.settings.drawnMoveSeconds) * 1000 + (mine.king || mine.kingStrike ? KING_FX_MS : 0);
    this.set({ kind: "reveal", mine, board, until: Date.now() + revealMs });
    this.timer = setTimeout(() => this.afterReveal(), revealMs);
  }

  /** Crowd 50 v 50: the other team's turn. You watch their vote come in, then see it. */
  private watchTurn() {
    const board = this.runner.boards.get(this.runner.state.boards[0]!)!;
    const think = Math.min(this.settings.moveClockSeconds * 1000, 5000);
    // The bots' thinking is squeezed into the few seconds you watch.
    const scale = think / (this.settings.botThinkSeconds[1] * 1000);
    const times = Object.fromEntries(Object.entries(this.runner.botThinkTimes()).map(([id, ms]) => [id, ms * scale]));
    this.progress.start(times, 0);
    const now = Date.now();
    this.startLive(now, times);
    this.set({ kind: "watching", board: boardView(board), startsAt: now, deadline: now + think });
    this.timer = setTimeout(() => void this.scoreWatched(), think);
  }

  private async scoreWatched() {
    if (this.phase.kind !== "watching") return;
    const { board } = this.phase;
    this.set({ kind: "scoring", board, move: null, watched: true });
    const [scored] = await Promise.all([this.runner.evaluate(new Map()), this.progress.finishAll(this.runner.alive().map((p) => p.id), 600)]);
    const report = this.runner.finishRound(scored.results, scored.thinkMs, scored.powerUps);
    const revealMs = (this.settings.revealSeconds + this.settings.drawnMoveSeconds) * 1000;
    this.set({ kind: "reveal", mine: report.boards[0]!, board, until: Date.now() + revealMs });
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
    if (this.runner.boss) return this.afterBossRound();
    if (!this.runner.stageComplete()) return this.nextRound();
    const stage = this.runner.state.stage;
    const before = this.standings();
    const cutoff = this.cutoff;
    const end = this.runner.endStage();
    const outIds = new Set(end.knockedOut.map((p) => p.id));
    const crowd = this.settings.mode === "crowd";
    const breakMs = cutSeconds(this.settings) * 1000;
    this.augmentVote = null;
    if (crowd) this.timer = setTimeout(() => this.continueFromBreak(), breakMs);
    this.set({
      kind: "stageBreak",
      stage,
      standings: before,
      knockedOut: before.filter((s) => outIds.has(s.id)),
      cutoff,
      youOut: outIds.has(HUMAN),
      nextBoards: this.runner.state.boards.map((id) => boardView(this.runner.boards.get(id)!)),
      ...(crowd ? { until: Date.now() + breakMs, augments: this.settings.cutClockVote && !outIds.has(HUMAN), moveClock: this.settings.moveClockSeconds } : {}),
    });
  }

  continueFromBreak() {
    if (this.phase.kind !== "stageBreak") return;
    if (this.timer) clearTimeout(this.timer);
    if (this.phase.augments) {
      // Your vote is the lobby's (the bots don't vote).
      this.runner.setMoveClock(clockAfterVote(this.settings.moveClockSeconds, this.augmentVote ? [this.augmentVote] : [], this.settings));
    }
    this.augmentVote = null;
    this.nextRound();
  }

  // ---------------- The 2v2 final ----------------

  private finalState: FinalView | null = null;

  get final(): FinalView | null {
    return this.finalState;
  }

  private setFinal(last: NetFinal["last"] = null, justOut: string[] = []) {
    const v = this.runner.finalView(last, justOut);
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
    // Team final: when a step ends, the weakest on each side go out.
    const out = this.runner.afterFinalTurn();
    this.setFinal({ playerId: p.playerId, move: b.result.playedMove, san: toSan(b.fenBefore, b.result.playedMove), loss: p.loss }, out);
    this.set({ kind: "final", final: this.finalState! });
    this.timer = setTimeout(() => this.afterFinalMove(), out.length ? FINAL_SHOW_MS + 1800 : FINAL_SHOW_MS);
  }

  private afterFinalMove() {
    if (this.runner.stageComplete()) {
      this.runner.finishFinal();
      return this.finish();
    }
    if (!this.you.alive) return void this.simulateRest();
    void this.finalTurn();
  }

  /** After a knockout, the rest of the match (the final too) is played quickly with no UI. */
  private async simulateRest() {
    while (!this.runner.isOver()) {
      this.set({ kind: "simulating", stage: this.runner.state.stage, round: this.runner.state.round });
      if (this.runner.boss) {
        if (this.runner.stageComplete()) {
          this.runner.finishBossBattle();
          break;
        }
        if (this.runner.bossToMove()) {
          await this.runner.playBoss(this.engines[0]);
          continue;
        }
        this.runner.deal();
        await this.runner.score(new Map());
        if (this.runner.bossKillDue()) this.runner.bossKill();
        continue;
      }
      this.runner.deal();
      await this.runner.score(new Map());
      if (this.runner.final) this.runner.afterFinalTurn();
      if (this.runner.stageComplete()) {
        if (this.runner.isFinal() && this.runner.final) this.runner.finishFinal();
        else if (!this.runner.isFinal()) this.runner.endStage();
      }
    }
    this.finish();
  }

  private finish() {
    const winner = this.runner.state.players.find((p) => p.placement === 1);
    this.set({
      kind: "results",
      placement: this.you.placement!,
      winner: winner?.name ?? "",
      youWon: this.you.placement === 1,
      ...(this.settings.mode === "crowd" ? { gameWinner: this.runner.gameWinner() } : {}),
      ...(this.runner.boss?.result ? { bossResult: this.runner.boss.result } : {}),
    });
  }
}
