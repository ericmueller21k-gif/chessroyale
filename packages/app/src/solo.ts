import { DEFAULT_SETTINGS, botVotes, castPregameVote, clockAfterVote, cutSeconds, pregameVotes, tallyVotes, type Augment, type PlayerState, type Settings } from "@chessroyale/core";
import { MatchRunner, boardSlots, netBoard, type LivePick, toSan, type BoardSlot, type BoardState, type NetFinal, type Opening, type RoundReport, type UciEngine } from "@chessroyale/chess";
import openingsData from "@chessroyale/chess/data/openings.json";
import { botRoster, bossIntroTimeline, bossShowMs, bossThinkMs, LAST_STAND_MS } from "@chessroyale/chess";
import type { BossView, BoardView, FinalView, GameView, Hint, MoveRecord, Phase, Standing, VoteView } from "./game.ts";
import { hintsFrom, whiteExpected } from "./hints.ts";
import { RoundProgress } from "./progress.ts";
import { warmEngineServer, withServerRecheck } from "./engine.ts";
import { moveRecordFrom, type GroupReveal } from "./game.ts";
import { crowdMoveCues, kingSay } from "./godKing.ts";

export const HUMAN = "you";
/** In the final, how long each move is shown before the next turn. */
const FINAL_SHOW_MS = 3200;
/** Boss battle: how long the boss's move shows, how long it thinks at least, and how long a strike shows. */
const BOSS_KILL_MS = 3800;
/** The God King's summoning, cut-in banner and bolt, added to a reveal where he plays the move. */
const KING_FX_MS = 5400;
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
  /** When your last move went in (alone, the boss's thinking time counts from there). */
  private movedAt = 0;
  hint: Hint[] | null = null;
  readonly seen = new Map<string, number>();
  private progress = new RoundProgress(() => this.emit());
  /** Test switch (?laststand=1): the boss battle's first crowd move calls for the God King's Last Stand, whatever it is. */
  forceLastStand = typeof location !== "undefined" && new URLSearchParams(location.search).get("laststand") === "1";
  /** Test switch (?side=b): a boss raid alone, playing Black (to see the God King in black). */
  private raidSide = typeof location !== "undefined" && new URLSearchParams(location.search).get("side") === "b" ? ("b" as const) : undefined;

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
    const live = { startsAt, times: { ...times }, picks: null as ReadonlyMap<string, string> | null, mine: null, rushFrom: null };
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
    warmEngineServer();
    this.runner = new MatchRunner({
      settings: this.settings,
      rng: this.rng,
      // Re-checks go to the engine server first (see withServerRecheck).
      engines: this.engines.map((e) => withServerRecheck(e, () => this.runner?.state.boards.length ?? 1)),
      library,
      raidSide: this.raidSide,
      // A boss raid alone is just you against the boss.
      entrants: [
        { id: HUMAN, name: this.playerName, isBot: false, practice: this.practice },
        ...(this.settings.raid ? [] : botRoster(this.rng, this.settings.lobbySize - 1, this.settings)),
      ],
    });
    this.runner.forceLastStand = this.forceLastStand;
    if (pregameVotes(this.settings).length) return this.startVote(0);
    // Boss raid: straight to the boss's intro, which replays the opening from the starting position itself.
    if (this.settings.raid) return this.nextRound();
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
      ...(this.settings.voteChangeAllowed ? { changeAllowed: true } : {}),
    };
    this.set({ kind: "vote", vote: this.voteState });
    this.timer = setTimeout(() => this.endVote(), ms);
  }

  castVote(option: number) {
    const v = this.voteState;
    if (this.phase.kind !== "vote" || !v || v.result !== null || Date.now() > v.until) return;
    // One vote each (a later one replaces it only with voteChangeAllowed on).
    const votes = castPregameVote(v.votes, { playerId: HUMAN, option, at: Date.now(), side: this.you.colour ?? "w" }, this.settings.voteChangeAllowed);
    if (!votes) return;
    v.votes = votes;
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
  kingCalled = false;
  /** This move's strike on screen, if the King struck (the clock stood still from `at` to `until`). */
  private frozen: { at: number; until: number } | null = null;
  /**
   * Calling the God King. To play the move: your whole turn, no move of your own. To strike the boss: he comes
   * now if enough of the crowd has called, the clock stands still while he strikes, and then you pick as usual.
   */
  callKing(strike = false) {
    if (this.phase.kind !== "play" || !this.runner.boss?.kingCharges || this.kingCalled) return;
    if (strike) return this.callStrike();
    this.kingCalled = true;
    this.runner.kingCallers.add(HUMAN);
    void this.score(null);
  }
  private callStrike() {
    const phase = this.phase;
    if (phase.kind !== "play" || phase.strike?.mine || Date.now() < this.playStartedAt - 300) return;
    const { struck, calls } = this.runner.callStrike(HUMAN);
    const needed = Math.floor((this.runner.groups.values().next().value?.length ?? 1) / 2) + 1;
    if (!struck) return this.set({ ...phase, strike: { calls, needed, mine: true } });
    const ms = this.settings.kingStrikeMs;
    const at = Date.now();
    this.frozen = { at, until: at + ms };
    this.progress.postpone(ms);
    if (this.live) for (const [id, t] of Object.entries(this.live.times)) if (this.live.startsAt + t > at) this.live.times[id] = t + ms;
    const deadline = phase.deadline + ms;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.submit(null), deadline - at + this.settings.lateGraceMs);
    this.set({ ...phase, deadline, strike: { calls, needed, mine: true, at, until: at + ms } });
  }
  get boss(): BossView | null {
    const v = this.runner?.bossView();
    return v ? { ...v, board: v.board } : null;
  }
  private bossSnapshot(justKilled: string | null = null): BossView {
    const v = this.runner.bossView(justKilled)!;
    return { ...v, board: v.board };
  }

  /**
   * A boss raid alone: you against the boss, so the game flows like any chess site. Your move is simply played (no
   * reveal), the boss replies, and your clock starts as its move lands. Only the God King interrupts: his Last Stand,
   * or a move he plays for you.
   */
  private get alone(): boolean {
    return !!this.runner.boss && this.runner.alive().length === 1;
  }

  /** The boss's turn: it thinks (for a moment at least), then its move shows before the crowd picks again. */
  private async bossTurn() {
    const snap = this.bossSnapshot();
    this.set({ kind: "boss", boss: snap, until: 0, thinking: true });
    // (Alone, it has been "thinking" since your move went in: scoring your move counts towards it.)
    const minThink = bossThinkMs(snap.board.history) - (this.alone ? Date.now() - this.movedAt : 0);
    await Promise.all([this.runner.playBoss(this.engines[0]), new Promise((r) => setTimeout(r, Math.max(0, minThink)))]);
    const showMs = bossShowMs(this.runner.bossView()?.lastMove, this.alone);
    const until = Date.now() + showMs;
    this.set({ kind: "boss", boss: this.bossSnapshot(), until });
    this.timer = setTimeout(() => this.nextRound(), showMs);
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
        const introMs = bossIntroTimeline(this.runner.boards.get(this.runner.state.boards[0]!)!.history.length).total;
        this.set({ kind: "boss", boss: this.bossSnapshot(), until: Date.now() + introMs, intro: true });
        this.timer = setTimeout(() => this.nextRound(), introMs);
        return;
      }
      if (this.runner.stageComplete()) {
        this.runner.finishBossBattle();
        return this.finish();
      }
      if (this.runner.bossToMove()) return void this.bossTurn();
    } else if (this.runner.isFinal()) return void this.finalTurn();
    this.runner.deal();
    this.kingCalled = false;
    this.frozen = null;
    this.runner.prefetch();
    if (!this.runner.boardOf(HUMAN)) return this.watchTurn();
    // The move clock starts after a short settling-in countdown on the new board (alone, at once: nothing to settle).
    const intro = this.alone ? 0 : this.settings.boardIntroSeconds * 1000;
    this.progress.start(this.runner.botThinkTimes(), intro);
    this.startLive(Date.now() + intro, this.runner.botThinkTimes());
    const board = this.runner.boardOf(HUMAN)!;
    this.playStartedAt = Date.now() + intro;
    this.hint = null;
    const allowed = this.runner.allowedMsFor(HUMAN);
    this.set({ kind: "play", board: boardView(board), startsAt: this.playStartedAt, deadline: this.playStartedAt + allowed, allowedMs: allowed, clock: this.runner.moveClock() });
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
    if (move !== null && move === this.runner.boss?.barred) return; // The move the God King took back.
    const now = Date.now();
    if (move !== null && this.frozen && now < this.frozen.until) return; // While the King strikes.
    const frozen = this.frozen ? Math.max(0, Math.min(now, this.frozen.until) - this.frozen.at) : 0;
    const thinkMs = Math.max(0, Math.min(now - this.playStartedAt - frozen, allowed));
    const usedPowerUp = this.hint !== null;
    const inFinal = !!this.runner.final;
    this.movedAt = now;
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
    const record = moveRecordFrom(report.stage, report.round, mine, (id) => id === HUMAN);
    if (record) this.moves.push(record);
    if (inFinal) return this.showFinalMove(report);
    if (this.alone && !mine.king && move !== null) {
      // Alone, your move is already on the board: no reveal, straight to the boss's reply. Only a Last Stand stops
      // the game (and the clock): it plays out, then you pick again. (Out of time, the reveal shows the move made.)
      if (!mine.lastStand) {
        const played = mine.result.playedMove;
        for (const c of crowdMoveCues(mine.fenBefore, played, mine.result.players.find((p) => p.move === played)?.loss ?? null)) if (kingSay(c.cue, c.key)) break;
        return this.afterReveal();
      }
      const standMs = LAST_STAND_MS + 400;
      this.set({ kind: "reveal", mine, board, until: Date.now() + standMs });
      this.timer = setTimeout(() => this.afterReveal(), standMs);
      return;
    }
    // The God King's Last Stand plays out in the reveal; the next move's clock starts after it (nobody loses time).
    const revealMs = (this.settings.revealSeconds + this.settings.drawnMoveSeconds) * 1000 + (mine.king ? KING_FX_MS : 0) + (mine.lastStand ? LAST_STAND_MS : 0);
    this.set({ kind: "reveal", mine, board, until: Date.now() + revealMs });
    this.timer = setTimeout(() => this.afterReveal(), revealMs);
  }

  /** Crowd 50 v 50: the other team's turn. You watch their vote come in, then see it. */
  private watchTurn() {
    const board = this.runner.boards.get(this.runner.state.boards[0]!)!;
    const think = Math.min(this.runner.moveClock() * 1000, 5000);
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
      ...(crowd ? { until: Date.now() + breakMs, augments: this.settings.cutClockVote && !outIds.has(HUMAN), moveClock: this.runner.moveClock() } : {}),
    });
  }

  continueFromBreak() {
    if (this.phase.kind !== "stageBreak") return;
    if (this.timer) clearTimeout(this.timer);
    if (this.phase.augments) {
      // Your vote is the lobby's (the bots don't vote).
      this.runner.setMoveClock(clockAfterVote(this.runner.moveClock(), this.augmentVote ? [this.augmentVote] : [], this.settings));
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
      const allowed = this.runner.allowedMsFor(HUMAN);
      this.set({ kind: "play", board: boardView(board), startsAt: this.playStartedAt, deadline: this.playStartedAt + allowed, allowedMs: allowed, clock: this.runner.moveClock() });
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
