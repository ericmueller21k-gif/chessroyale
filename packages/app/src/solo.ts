import { RECLUSE_PHASE2, BOSS_BRAIN, BOSS_POWERS, DEFAULT_SETTINGS, MATCHMAKING, type ItemLook, type MatchmakingType, botVotes, castPregameVote, clockAfterVote, closePregameVote, cutSeconds, pregameVotes, type Augment, type BossBrain, type PlayerState, type Settings } from "@chessroyale/core";
import { GUARD_WORDS, MatchRunner, ShowdownScout, brainLine as brainWords, boardSlots, type HumanUciEngine, netBoard, type LobbyPlayer, type LivePick, toSan, type BoardSlot, type BoardState, type NetFinal, type Opening, type RoundReport, type UciEngine } from "@chessroyale/chess";
import openingsData from "@chessroyale/chess/data/openings.json";
import { crowdRace, phase2Numbers, phase2ToMove, botRoster, bossIntroTimeline, bossThinkMs, landedEarlyMs, fullMoonMs, bossTurnShowMs, judgeTaps, bossRules, kingHelpBlocked, kingMoveMs, kingStrikeMs, lightsDeadline, lightsOutTimeline, lightsRoundEnd, LAST_STAND_MS, powerMomentMs } from "@chessroyale/chess";
import type { BossView, BoardView, DarkNote, ExitKind, FinalView, GameView, Hint, LightsView, MoveRecord, Phase, SimulView, Standing, VoteView } from "./game.ts";
import { PHASE2_ULT_ANIMS, PHASE_CHANGE, Phase2Game, phase2Follows, phase2Mates, phaseChangeRun } from "./recluse-phase2.ts";
import { RECLUSE_LINES } from "./characters/recluse-lines.ts";
import { playInPlace, setEngineAt, setFigureRun } from "./components/BossCharacter.tsx";
import { play, warmSounds } from "./sound.ts";
import { trackCamo } from "./camo.ts";
import { hintsFrom, whiteExpected } from "./hints.ts";
import { RoundProgress } from "./progress.ts";
import { ownEngine, pauseEngines, warmEngineServer, withServerRecheck } from "./engine.ts";
import { moveRecordFrom, type GroupReveal } from "./game.ts";
import { crowdMoveCues, kingSay, resetKingSpeech } from "./godKing.ts";
import { CRITICAL, LOW, NORMAL, bossVoice } from "./speech.tsx";
import { SoloLobbyChat } from "./chat.ts";
import { account } from "./account.ts";
import { crumb } from "./problems.ts";
import { engineMoveAllowed, isAdmin, maiaAllowed, soloBrain } from "./boss-brain.ts";
import { prefetchMaia, startMaia } from "./maia.ts";
import { MaiaGate, type GateEnd } from "./maia-gate.ts";
import { testParams } from "./test-switches.ts";

export const HUMAN = "you";
/** In the final, how long each move is shown before the next turn. */
const FINAL_SHOW_MS = 3200;
/** Boss battle: how long the boss's move shows, how long it thinks at least, and how long a strike shows. */
const BOSS_KILL_MS = 3800;
const library = openingsData as unknown as Opening[];

export function boardView(b: BoardState): BoardView {
  return netBoard(b, true);
}

/**
 * You against bots, entirely in the browser (Solo; and Boss alone, you against the boss). Drives the shared
 * MatchRunner round by round. Solo starts on the queue screen: you in seat 1, then the bots who'll play pop into their
 * seats (`fill`), then the match.
 */
export class SoloMatch implements GameView {
  phase: Phase = { kind: "loading" };
  /** Solo games never count for your ranking (all bots, and no server sees them). */
  readonly ranked = false;
  /** The queue screen (Solo): who has a seat so far, and when they're all in. */
  readonly queueType: MatchmakingType = "solo";
  auto = false;
  readonly myId = HUMAN;
  players: LobbyPlayer[] = [];
  readonly looks = new Map<string, ItemLook>();
  readonly fillAt: number | null = null;
  filledAt: number | null = null;
  /** Quick chat in the queue (Crowd and raids) while your bots sit down; it closes as the match begins. */
  private lobbyChat = new SoloLobbyChat(
    HUMAN,
    () => this.emit(),
    () => account().profile?.shop?.owned,
    () => account().profile?.shop?.chat,
  );
  get chat() {
    return this.lobbyChat.chat;
  }
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
  forceLastStand = testParams().get("laststand") === "1";
  /** Test switch (?side=b): a boss raid alone, playing Black (to see the God King in black). */
  private raidSide = testParams().get("side") === "b" ? ("b" as const) : undefined;

  constructor(
    private readonly engines: UciEngine[],
    readonly playerName: string,
    private readonly baseSettings: Settings = DEFAULT_SETTINGS,
    readonly practice = false,
    /** A boss raid with bots in the crowd (Solo); without, it's you against the boss (Boss alone). Other modes always have bots. */
    private readonly raidBots = false,
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
    // (Chub & Chirp's race: the judge weighs moves by what the carrots are worth, not by the position, so the bar reads
    // the engine's own numbers then, carrots ignored, as online always does.)
    const raw = !!crowdRace(this.runner.boss, fen);
    return whiteExpected(fen, await (raw ? this.runner.engineTop(fen) : this.runner.topMovesFor(fen)));
  }
  get cutoff(): number {
    return this.runner.cutoff();
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private set(phase: Phase) {
    // (Stopped: an engine answer or a timer on its way changes nothing.)
    if (this.stopped) return;
    this.phase = phase;
    this.listeners.forEach((l) => l());
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  dispose() {
    this.halt();
    this.listeners.clear();
  }

  // ---------------- Resigning (LEAVING in settings.ts) ----------------

  /**
   * Stopped (resigned, left, or done with): no timer runs, no engine answer still on its way changes anything (every
   * step after an engine search checks this), Maia's worker and the showdown scout are closed. The engine pool's
   * workers stay up for the next match, idle.
   */
  private stopped = false;
  /** Move 1 has come (your first move's clock, or the boss's first move): leaving from here is resigning. */
  private begun = false;

  private halt() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.freeBrain();
    this.runner?.showdownScout?.stop();
    this.progress.reset();
    this.live = null;
    this.lights = null;
    this.lobbyChat.close();
    this.phase2?.stop();
  }

  get exit(): ExitKind | null {
    const k = this.phase.kind;
    // (The Hidden Boss's phase change plays through; in phase 2, resigning is your board's, and once it's decided,
    // leaving ends the battle where it stands. Nothing once every board is decided: the result is on its way.)
    if (k === "phaseChange") return null;
    if (k === "simul") {
      const g = this.phase2;
      if (this.stopped || !g || !this.phase2Playing || g.outcome.decided) return null;
      return g.board(0)?.result ? "leave" : "resign";
    }
    // (Nor while a beaten boss falls: the battle is over, its result on its way.)
    if (this.stopped || k === "results" || k === "loading" || (k === "boss" && this.phase.kind === "boss" && this.phase.fall)) return null;
    if (!this.begun) return "leave";
    return this.you.alive ? "resign" : "leave";
  }

  get exitHome(): boolean {
    return !this.begun;
  }

  /**
   * Resign: the match stops here, at once, a loss: you're out in the last place still open (Boss alone: the boss won).
   * Already out (a cut, the boss's strike): the rest isn't played out; your place stands. Before move 1: nothing to
   * record (the app goes home).
   */
  resign() {
    const exit = this.exit;
    if (!exit) return;
    // (Phase 2: your board is lost and the others play on; already decided, the battle ends here.)
    if (this.phase.kind === "simul" && this.phase2) {
      if (exit === "resign") return this.phase2.resign(0);
      return this.finishPhase2();
    }
    const home = this.exitHome;
    const alive = this.you.alive;
    const alone = this.alone;
    const boss = !!this.runner.boss;
    this.halt();
    // (Nothing more for him or the boss to say.)
    resetKingSpeech();
    bossVoice.reset();
    if (home) return this.emit();
    const placement = alive ? this.runner.retire(HUMAN) : (this.you.placement ?? this.runner.alive().length + 1);
    this.phase = {
      kind: "results",
      placement,
      winner: "",
      youWon: false,
      left: { how: alive ? "resigned" : "out" },
      ...(boss && alive && alone ? { bossResult: "boss" as const } : {}),
    };
    this.emit();
  }

  get you(): PlayerState {
    return this.runner.player(HUMAN);
  }

  /** Starts at once (Boss alone; and tests). */
  start() {
    this.createRunner();
    this.begin();
  }

  /**
   * Solo: the queue screen first. You're in seat 1, then the bots who'll play pop into their seats over
   * MATCHMAKING.soloFillMs, the full lobby shows for a moment, and the match begins.
   */
  fill(fillMs: number = MATCHMAKING.soloFillMs, holdMs: number = MATCHMAKING.soloHoldMs) {
    this.createRunner();
    // A boss battle is coming (a Solo raid, or a Crowd match set to end in one): Maia's files ahead, if it may play.
    if ((this.settings.raid || this.settings.finalFormat === "boss") && maiaAllowed()) prefetchMaia();
    const bots = this.runner.state.players.filter((p) => p.isBot).map((p): LobbyPlayer => ({ id: p.id, name: p.name, isBot: true, connected: true }));
    const me: LobbyPlayer = { id: HUMAN, name: this.playerName, isBot: false, connected: true };
    this.auto = true;
    this.players = [me];
    // Lobby chat (Crowd and raids, as online; Classic has none): your lines, and a hello or two from the bots.
    if (this.settings.mode === "crowd") this.lobbyChat.open();
    this.set({ kind: "lobby" });
    const t0 = Date.now();
    let greeted = false;
    const tick = () => {
      // Easing in and out: a few, a rush, the last few.
      const t = Math.min(1, (Date.now() - t0) / fillMs);
      const n = Math.round(bots.length * (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2));
      if (n > this.players.length - 1) {
        this.players = [me, ...bots.slice(0, n)];
        this.emit();
      }
      // Halfway in, those already seated say hello (so their lines land while the queue is still up).
      if (!greeted && n >= bots.length / 2 && n > 0) {
        greeted = true;
        this.lobbyChat.botsArrived(bots.slice(0, n).map((b) => b.id));
      }
      if (n < bots.length) return void (this.timer = setTimeout(tick, 40));
      this.filledAt = Date.now();
      this.emit();
      this.timer = setTimeout(() => {
        this.auto = false;
        // (Solo matches have no chat.)
        this.lobbyChat.close();
        this.begin();
      }, holdMs);
    };
    tick();
  }

  private createRunner() {
    warmEngineServer();
    this.runner = new MatchRunner({
      settings: this.settings,
      rng: this.rng,
      // Re-checks go to the engine server first (see withServerRecheck).
      engines: this.engines.map((e) => withServerRecheck(e, () => this.runner?.state.boards.length ?? 1)),
      library,
      raidSide: this.raidSide,
      // Boss alone is just you against the boss; a Solo raid has bots in the crowd.
      entrants: [
        { id: HUMAN, name: this.playerName, isBot: false, practice: this.practice },
        ...(this.settings.raid && !this.raidBots ? [] : botRoster(this.rng, this.settings.lobbySize - 1, this.settings)),
      ],
    });
    this.runner.forceLastStand = this.forceLastStand;
  }

  /** The match begins: the pre-game votes, the boss's intro (a raid) or the opening. */
  private begin() {
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
      votes: botVotes(this.rng, bots.map((b) => b.id), votes[index]!.options.length, ms, this.settings.voteBotSkip).map((v) => ({ playerId: v.id, option: v.option, at: now + v.atMs, side: side.get(v.id)! })),
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
    // The winner, then everyone who didn't vote (you, and the bots that didn't) joins it: they walk there now.
    const at = Date.now();
    const side = new Map(this.runner.state.players.map((p) => [p.id, p.colour ?? "w"]));
    const everyone = this.runner.state.players.map((p) => p.id);
    const { result, votes } = closePregameVote(v.votes, everyone, def, this.rng, (playerId, option) => ({ playerId, option, at, side: side.get(playerId)!, joined: true as const }));
    this.runner.patchSettings(def.options[result]!.patch);
    // (The crowd voted for a boss battle at the end: Maia's files ahead, if it may play.)
    if (def.options[result]!.patch.finalFormat === "boss" && maiaAllowed()) prefetchMaia();
    const nextAt = at + this.settings.voteResultSeconds * 1000;
    this.voteState = { ...v, votes, result, nextAt };
    this.set({ kind: "vote", vote: this.voteState });
    this.timer = setTimeout(() => (v.index + 1 < v.count ? this.startVote(v.index + 1) : this.nextRound()), nextAt - Date.now());
  }

  // ---------------- Boss battle ----------------

  /** Maia's worker, when the boss plays with the Maia brain (BOSS_BRAIN); closed after the battle. */
  private maia: HumanUciEngine | null = null;
  /** The admins' debug line is on. */
  private brainShown = false;
  /** The battle's Maia brain, when it has one (the admins' line, while Maia's worker isn't started yet). */
  private brainPlan: { brain: BossBrain; rating: number; stockfishShare?: number } | null = null;
  /** The loading step under way, before the intro (maia-gate.ts). */
  private gate: MaiaGate | null = null;
  /** How the loading step ended, and why Maia's first try failed if it was tried again (the admins' line). */
  private gateEnd: GateEnd | null = null;
  private maiaFirstError: string | null = null;
  /** Maia was closed because this device's Stockfish didn't answer again beside it (the admins' line). */
  private brainDropped = false;

  /**
   * Any boss battle, as it begins (Boss alone, a Solo raid, the Crowd's boss battle): the boss's brain, then `next` (the
   * intro). On the Maia brain (every boss's own; in Boss alone an admin may pick another), the loading step first
   * (DECISIONS.md, "Maia's loading step", Oct 14): this device's Stockfish paused, Maia loaded alone, at most
   * BOSS_BRAIN.loadGateMs, with its screen (BossScreen's `loading`). Not ready by then: the boss plays Stockfish until
   * it is, as before.
   */
  private startBrain(next: (afterLoading?: boolean) => void) {
    if (!this.runner.state.boss || this.maia) return next();
    const { picked, maia } = soloBrain(this.settings.raid && !this.raidBots);
    const plan = this.runner.bossBrainPlan(picked, maia)!;
    this.brainShown = isAdmin();
    if (plan.brain === "stockfish" || plan.rating === null || typeof Worker === "undefined") return next();
    const brain = { brain: plan.brain, rating: plan.rating, ...(plan.stockfishShare ? { stockfishShare: plan.stockfishShare } : {}) };
    this.brainPlan = brain;
    // (Its files: already here, or under way since the boss menu; else from now, so the bar can show them coming.)
    prefetchMaia();
    const gate = new MaiaGate({
      start: (after) => {
        const engine = startMaia(BOSS_BRAIN.loadTimeoutMs, after);
        this.maia = engine;
        this.runner.humanBrain = engine ? { ...brain, engine } : null;
        return engine;
      },
      pause: (until) => pauseEngines(until, () => this.dropBrain(), BOSS_BRAIN.stockfishBackMs),
      gateMs: BOSS_BRAIN.loadGateMs,
    });
    this.gate = gate;
    this.set({ kind: "boss", boss: this.bossSnapshot(), until: 0, intro: true, loading: true });
    void gate.done.then((end) => {
      if (this.gate !== gate) return;
      this.gate = null;
      this.gateEnd = end;
      this.maiaFirstError = gate.firstError;
      if (!this.stopped) next(true);
    });
  }

  /** The boss's intro (bossIntroTimeline), then the battle. `afterLoading`: the loading step was on screen. */
  private bossIntro(afterLoading = false) {
    const powers = this.runner.state.boss?.powers;
    const introMs = bossIntroTimeline(this.runner.boards.get(this.runner.state.boards[0]!)!.history.length, !!powers?.claimed, !!powers?.snack).total;
    this.set({ kind: "boss", boss: this.bossSnapshot(), until: Date.now() + introMs, intro: true, ...(afterLoading ? { afterLoading } : {}) });
    this.timer = setTimeout(() => this.nextRound(), introMs);
  }

  /** Frees Maia (its model holds a few hundred MB) once the battle is over. */
  private freeBrain() {
    this.gate?.stop();
    this.gate = null;
    this.maia?.close();
    this.maia = null;
    this.brainPlan = null;
    if (this.runner) this.runner.humanBrain = null;
  }

  /** This device's Stockfish didn't answer again beside Maia (short of memory): Maia goes, the battle plays on Stockfish. */
  private dropBrain() {
    if (!this.maia) return;
    this.freeBrain();
    this.brainDropped = true;
    this.emit();
  }

  /** Testing, admins: what the boss's brain did with its last move ("Maia 1450 · no guard · Maia's #1 · 120 ms"). */
  get brainLine(): string | null {
    if (!this.brainShown || !this.runner) return null;
    // (Phase 2: Stockfish only, at his fixed strength, within his time a move.)
    if (this.phase2) {
      const ms = this.phase2.lastMs;
      return `Stockfish ${RECLUSE_PHASE2.elo} · at most ${RECLUSE_PHASE2.moveMs} ms${ms !== null ? ` · last ${Math.round(ms)} ms` : ""}`;
    }
    const note = this.runner.brainNote;
    // (Maia failed to load: why, for the admin reading it, e.g. "load timed out" or the worker's error.)
    if (note) return `${brainWords(note)}${this.maia?.status === "failed" ? ` · ${this.maia.error ?? "no reason"}` : ""}`;
    const hb = this.runner.humanBrain ?? this.brainPlan;
    if (!hb) return this.brainDropped ? "Stockfish (Maia closed: Stockfish didn't start again beside it)" : "Stockfish";
    const share = hb.stockfishShare ? ` · ${Math.round(hb.stockfishShare * 100)}% Stockfish` : "";
    const status = this.maia?.status === "ready" ? "ready" : this.maia?.status === "failed" ? `failed: Stockfish (${this.maia.error ?? "no reason"})` : this.gateEnd === "timeout" ? `loading (waited ${Math.round(BOSS_BRAIN.loadGateMs / 1000)} s)` : "loading";
    // (Ready, or failed, on a second try: why the first failed.)
    return `Maia ${hb.rating} · ${GUARD_WORDS[hb.brain]}${share} · ${status}${this.maiaFirstError ? ` (2nd try; the 1st: ${this.maiaFirstError})` : ""}`;
  }

  private bossIntroDone = false;
  kingCalled = false;
  /** This move's strike on screen, if the King struck (the clock stood still from `at` to `until`). */
  private frozen: { at: number; until: number } | null = null;
  /**
   * Calling the God King. To play the move: your whole turn, no move of your own. To strike the boss: he comes
   * now if enough of the crowd has called, the clock stands still while he strikes, and then you pick as usual.
   * Against the Hidden Boss neither comes, but the try spends its charge as if it had (Eric, Oct 14), on your move in
   * phase 1; the dock has him mock it, and your move goes on (its clock too). In phase 2 there's no God King to call: the
   * boss absorbed him in the phase change (Eric, Oct 14), and the dock has no button for him.
   */
  callKing(strike = false) {
    if (kingHelpBlocked(this.runner?.boss)) {
      if (this.phase.kind === "play" && this.runner.kingTried()) this.emit();
      return;
    }
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
    const ms = kingStrikeMs(this.settings);
    const at = Date.now();
    this.frozen = { at, until: at + ms };
    this.progress.postpone(ms);
    if (this.live) for (const [id, t] of Object.entries(this.live.times)) if (this.live.startsAt + t > at) this.live.times[id] = t + ms;
    const deadline = phase.deadline + ms;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.submit(null), deadline - at + this.settings.lateGraceMs);
    this.set({ ...phase, deadline, strike: { calls, needed, mine: true, at, until: at + ms } });
  }
  /** Hollow's dark: how your last attempt into the dark went this turn. */
  darkNote: DarkNote | null = null;
  /**
   * Hollow's dark: a move attempt touching a dark square, judged here as the server would: a legal move is your pick;
   * an illegal one costs points and you pick again, until your last try ends the turn as a miss.
   */
  darkTry(move: string) {
    if (this.phase.kind !== "play" || !this.runner.boss || Date.now() < this.playStartedAt - 300) return;
    if (this.frozen && Date.now() < this.frozen.until) return; // While the King strikes.
    const out = this.runner.darkTry(HUMAN, move);
    if (out.kind === "move") {
      this.darkNote = null;
      return this.submit(out.move);
    }
    if (out.kind === "refused") return;
    this.darkNote = { move, at: Date.now(), tries: out.tries, out: out.out };
    if (out.out) return void this.score(null);
    this.emit();
  }

  // ---------------- Hollow's Lights out ----------------

  /** Lights out in progress: when it began, how many rounds are over, your taps round by round. */
  private lights: { key: string; at: number; ended: number; endedAt: number[]; taps: string[][]; tapAt: number[][] } | null = null;

  /** The test's beats, with the rounds over so far (when each ended). */
  private lightsTimeline() {
    const test = this.runner.state.boss!.powers!.lightsOut!;
    return lightsOutTimeline(test.rounds.map((r, i) => ({ ms: r.ms, endedAt: this.lights?.endedAt[i] })), this.settings.lateGraceMs);
  }
  /** When the round on is over (ms from the test's start): you're done, by your tries or your own time (as online). */
  private lightsRoundEnd(): number {
    const l = this.lights!;
    const k = l.ended;
    const pieces = this.runner.state.boss!.powers!.lightsOut!.rounds[k]!.pieces.length;
    return lightsRoundEnd(this.lightsTimeline().rounds[k]!, pieces, this.you.alive ? [l.tapAt[k] ?? []] : [], this.settings.lateGraceMs);
  }

  /** At the start of his turn (the clocks stopped): the rounds, timed here as the server times them online. */
  private lightsOutTurn() {
    const test = this.runner.startLightsOut();
    const at = Date.now();
    this.lights = { key: `l-${at}`, at, ended: 0, endedAt: [], taps: test.rounds.map(() => []), tapAt: test.rounds.map(() => []) };
    this.showLights();
    this.armLights();
  }
  private armLights() {
    const l = this.lights!;
    if (this.timer) clearTimeout(this.timer);
    const tl = this.lightsTimeline();
    this.timer = setTimeout(() => this.lightsStep(), l.at + (l.ended < tl.rounds.length ? this.lightsRoundEnd() : tl.total) - Date.now());
  }
  /** A round is over (its answers show), or the lights are back: each piece you missed costs; then his move. */
  private lightsStep() {
    const l = this.lights;
    if (!l) return;
    const test = this.runner.state.boss!.powers!.lightsOut!;
    if (l.ended < test.rounds.length) {
      const end = this.lightsRoundEnd();
      if (Date.now() < l.at + end) return this.armLights();
      l.endedAt.push(Math.max(end, Date.now() - l.at));
      l.ended++;
      this.showLights();
      return this.armLights();
    }
    const missed = this.lightsMine().reduce((n, r, i) => n + test.rounds[i]!.pieces.length - r.found.length, 0);
    this.runner.finishLightsOut(this.you.alive ? { [HUMAN]: missed } : {});
    this.lights = null;
    void this.bossTurn();
  }

  /** Your taps in Lights out, judged round by round. */
  private lightsMine(): { found: string[]; wrong: string[]; used: number }[] {
    const test = this.runner.boss?.powers ? this.runner.state.boss?.powers?.lightsOut : null;
    if (!test || !this.lights) return [];
    const fen = this.runner.boards.get(this.runner.state.boards[0]!)!.fen;
    const side = this.runner.state.boss!.crowdSide === "w" ? "b" : "w";
    return test.rounds.map((r, i) => {
      const j = judgeTaps(r, fen, side, this.lights!.taps[i] ?? []);
      return { found: j.found, wrong: j.wrong, used: j.used };
    });
  }

  private showLights() {
    const l = this.lights!;
    const test = this.runner.state.boss!.powers!.lightsOut!;
    const mine = this.lightsMine();
    const lights: LightsView = {
      key: l.key,
      at: l.at,
      rounds: test.rounds.map((r, i) => ({ pieces: r.pieces, targets: r.targets, ms: r.ms, ...(i < l.ended ? { answers: r.answers, endedAt: l.endedAt[i] } : {}) })),
      mine,
      // The crowd's count (you, and any bots as each round ends), worked out here as the server does online.
      crowd: this.runner.lightsTally(this.you.alive ? { [HUMAN]: mine } : {}, l.ended),
    };
    this.set({ kind: "boss", boss: this.bossSnapshot(), until: 0, lights });
  }

  /** Lights out: a tap in the round on, while it's open for you (each tap gives you a second more; one try a piece). */
  lightsTap(square: string) {
    const l = this.lights;
    const test = this.runner.state.boss?.powers?.lightsOut;
    if (!l || !test || this.phase.kind !== "boss" || !this.phase.lights || !this.you.alive) return;
    const k = l.ended;
    const r = this.lightsTimeline().rounds[k];
    const taps = l.taps[k];
    if (!r || !taps || taps.includes(square) || taps.length >= test.rounds[k]!.pieces.length) return;
    const t = Date.now() - l.at;
    if (t < r.at - 300 || t > lightsDeadline(r, taps.length) + this.settings.lateGraceMs) return;
    taps.push(square);
    l.tapAt[k]!.push(t);
    this.showLights();
    // Your last try ends the round at once (as online, once everyone's done); otherwise it now ends later.
    if (this.lightsRoundEnd() <= t) return this.lightsStep();
    this.armLights();
  }

  /** Testing, admins in Boss alone: the "Engine move" button shows (see engineMoveAllowed). */
  get engineMoveShown(): boolean {
    return !!this.runner?.boss && engineMoveAllowed(this.settings.raid && !this.raidBots);
  }
  /** The engine's move is being searched (the button waits, so a double tap sends one move). */
  engineThinking = false;
  /**
   * Testing, admins in Boss alone: Stockfish's best move played as your own, through the normal move path (clocks,
   * the boss's reply and powers as usual). The power-up hints' search: the moves this turn allows, already under way.
   */
  engineMove() {
    // (The Hidden Boss's phase 2: your board, its Chess960 position, on this device's engine; then your move as usual.)
    if (this.phase.kind === "simul") return this.engineMove960();
    if (!this.engineMoveShown || this.engineThinking || this.phase.kind !== "play") return;
    if (Date.now() < this.playStartedAt - 300) return;
    const fen = this.phase.board.fen;
    this.engineThinking = true;
    this.emit();
    void this.runner
      .topMovesFor(fen)
      .catch(() => [])
      .then((top) => {
        this.engineThinking = false;
        const best = top[0]?.move;
        if (best && !this.stopped && this.phase.kind === "play" && this.phase.board.fen === fen) this.submit(best);
        else this.emit();
      });
  }

  /** Engine move on your phase 2 board: Stockfish's best (UCI_Chess960 on for the position), played as your move. */
  private engineMove960() {
    const b = this.phase2?.board(0);
    if (!this.engineMoveShown || this.engineThinking || !this.phase2Playing || !b || b.result || b.turnAt === null) return;
    const fen = b.board.fen;
    this.engineThinking = true;
    this.emit();
    void this.engines[this.engines.length - 1]!
      .topMoves(fen, 1)
      .catch(() => [])
      .then((top) => {
        this.engineThinking = false;
        const best = top[0]?.move;
        if (best && !this.stopped && this.phase2?.board(0)?.board.fen === fen) this.simulMove(0, best);
        this.emit();
      });
  }

  /** Testing (admins): the boss's ultimate as the next crowd turn begins. */
  triggerUltimate() {
    if (!BOSS_POWERS.ultimateTestButton || !account().profile?.admin) return;
    // (The Hidden Boss's phase 2: his ultimate now.)
    if (this.phase.kind === "simul") return void (this.phase2Playing && this.phase2?.ult());
    if (this.runner.triggerUltimate()) this.emit();
  }
  get boss(): BossView | null {
    const v = this.runner?.bossView();
    const boss = v ? { ...v, board: v.board } : null;
    // (What its screens draw of a hidden rook, Smudgy's: camo.ts is told each time the view is made.)
    trackCamo(boss);
    return boss;
  }
  private bossSnapshot(justKilled: string | null = null): BossView {
    const v = this.runner.bossView(justKilled)!;
    const boss = { ...v, board: v.board };
    trackCamo(boss);
    return boss;
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
    this.begun = true;
    const snap = this.bossSnapshot();
    this.set({ kind: "boss", boss: snap, until: 0, thinking: true });
    // (Alone, it has been "thinking" since your move went in: scoring your move counts toward it.)
    // (G-REX's fire has just burnt something, or Alfil's pieces came down early, or Moo's Full Moon came: it plays out
    // before the boss's move.)
    const burnt = !!snap.powers?.burnt?.some((b) => b.turn === snap.crowdMoves && (b.piece || b.fizzled));
    const landed = landedEarlyMs(snap) + fullMoonMs(snap);
    const minThink = bossThinkMs(snap, burnt, landed) - (this.alone && !burnt && !landed ? Date.now() - this.movedAt : 0);
    await Promise.all([this.runner.playBoss(this.engines[0]), new Promise((r) => setTimeout(r, Math.max(0, minThink)))]);
    if (this.stopped) return;
    // As the turn passes to you, any power that comes with it (a freeze, a pie, the warning, the blizzard) plays out
    // before your clock starts.
    // (At a mate, the boss's attack on your king, if it has one: the result waits for it.)
    const view = this.runner.bossView();
    const showMs = bossTurnShowMs(view, this.alone);
    const until = Date.now() + showMs;
    this.set({ kind: "boss", boss: this.bossSnapshot(), until });
    this.timer = setTimeout(() => this.nextRound(), showMs);
  }

  /**
   * Hollow's extra move (the crowd failed Lights out): after his own move he thinks again, then plays a quiet move that
   * gains him only a little, with its banner; then your turn. None such: he skips it.
   */
  private async extraTurn() {
    const snap = this.bossSnapshot();
    this.set({ kind: "boss", boss: snap, until: 0, thinking: true });
    // (No engine answer: he skips it, as online.)
    const pick = this.runner.playExtraMove(this.engines[0]).catch(() => this.runner.applyExtraMove(null));
    const [played] = await Promise.all([pick, new Promise((r) => setTimeout(r, bossThinkMs(snap)))]);
    if (this.stopped) return;
    if (!played) return this.nextRound();
    const showMs = powerMomentMs([{ kind: "extra" }]);
    this.set({ kind: "boss", boss: this.bossSnapshot(), until: Date.now() + showMs });
    this.timer = setTimeout(() => this.nextRound(), showMs);
  }

  /**
   * Boingo's funhouse (as it comes, your turn about to begin): he plays your move for you (a weak but recoverable one,
   * unscored) on a screen of its own, then he replies. No engine answer: the first allowed move, as online.
   */
  private async funhouseTurn() {
    await this.runner.playFunhouse(this.engines[0]).catch(() => this.runner.applyFunhouse(""));
    if (this.stopped) return;
    const showMs = powerMomentMs([{ kind: "funhouse" }]);
    this.set({ kind: "boss", boss: this.bossSnapshot(), until: Date.now() + showMs });
    this.timer = setTimeout(() => this.nextRound(), showMs);
  }

  /**
   * Big Boy's Big Bounce (at the start of his turn, after your move): he gets ready (thinking) while this device's
   * engines score the candidate positions, then the bounce plays out (nobody's clock runs), then his move. No engine
   * answer: the bounces play and nothing moves, as online. (Your move took his queen: its banner plays in this thinking,
   * held for it, and not again in the thinking after the bounce: queenSlain.)
   */
  private async bounceTurn() {
    const snap = this.bossSnapshot();
    this.set({ kind: "boss", boss: snap, until: 0, thinking: true });
    const bounce = this.runner.playBounce(this.engines).catch(() => this.runner.applyBounce(null));
    await Promise.all([bounce, new Promise((r) => setTimeout(r, bossThinkMs(snap)))]);
    if (this.stopped) return;
    const showMs = powerMomentMs([{ kind: "bounce" }]);
    this.set({ kind: "boss", boss: this.bossSnapshot(), until: Date.now() + showMs });
    this.timer = setTimeout(() => this.nextRound(), showMs);
  }

  /**
   * Alfil's turn begins with a step (the Mammoth Slam, the fusion of his last cast, a new cast): he gets ready
   * (thinking) while this device's engines pick the cast's pair, the fusion's square or the Slam's lift, then it plays
   * out (nobody's clock runs), then the next step or his move. His fusion is his move: then your turn, its moments (the
   * fusion's first) before your clock starts, as after his move (one with no square fails with no moment, and he moves).
   * No engine answer: the cast's first pair, the fusion's first square, nothing lifts (the Slam again on his next turn),
   * as online. A step nothing came of (a Slam that lifted nothing, a fusion the pass guard has wait, a pick the admins'
   * trigger overtook) shows nothing.
   * (Your move took his queen, or his pieces came down early: that plays in this thinking first; not again after it.)
   */
  private async alfilTurn() {
    const snap = this.bossSnapshot();
    this.set({ kind: "boss", boss: snap, until: 0, thinking: true });
    const step = this.runner.playAlfil(this.engines).catch(() => this.runner.applyAlfil(null));
    const [done] = await Promise.all([step, new Promise((r) => setTimeout(r, bossThinkMs(snap, false, landedEarlyMs(snap))))]);
    if (this.stopped) return;
    const showMs = !this.runner.bossToMove() ? bossTurnShowMs(this.runner.bossView(), this.alone) : done && done !== "fuse" ? powerMomentMs([{ kind: done }]) : 0;
    this.set({ kind: "boss", boss: this.bossSnapshot(), until: Date.now() + showMs });
    this.timer = setTimeout(() => this.nextRound(), showMs);
  }

  /**
   * Chub & Chirp's Leapfrog (at the start of his turn, after your move): he gets ready (thinking) while this device's
   * engines pick which pawn hops (one alone hops at once), then it plays out (nobody's clock runs), then his move. No
   * engine answer: the first pawn that can, as online. (Your move took his queen: that plays in this thinking first.)
   */
  private async hopTurn() {
    const snap = this.bossSnapshot();
    this.set({ kind: "boss", boss: snap, until: 0, thinking: true });
    const hop = this.runner.playHop(this.engines).catch(() => this.runner.applyHop(null));
    const [done] = await Promise.all([hop, new Promise((r) => setTimeout(r, bossThinkMs(snap)))]);
    if (this.stopped) return;
    const showMs = done ? powerMomentMs([{ kind: "hop" }]) : 0;
    this.set({ kind: "boss", boss: this.bossSnapshot(), until: Date.now() + showMs });
    this.timer = setTimeout(() => this.nextRound(), showMs);
  }

  /**
   * Chub & Chirp's Carrot Patch (at the start of his turn after its warning, or the admins' trigger): he gets ready
   * (thinking; your queen banner first, if your move took his queen) while this device's engines check the pass guard,
   * then the cast, his whole turn (the placement is the position's and the seed's, as online); then your turn, its
   * moments (the cast's first) before your clock starts, as after his move. When passing would lose real material it
   * waits, the warning staying, and he plays his move (as online). No engine answer: the cast.
   */
  private async carrotTurn() {
    const snap = this.bossSnapshot();
    this.set({ kind: "boss", boss: snap, until: 0, thinking: true });
    const cast = this.runner.playCarrots(this.engines).catch(() => this.runner.applyCarrots(null));
    await Promise.all([cast, new Promise((r) => setTimeout(r, bossThinkMs(snap)))]);
    if (this.stopped) return;
    const showMs = !this.runner.bossToMove() ? bossTurnShowMs(this.runner.bossView(), this.alone) : 0;
    this.set({ kind: "boss", boss: this.bossSnapshot(), until: Date.now() + showMs });
    this.timer = setTimeout(() => this.nextRound(), showMs);
  }

  /**
   * Smudgy's Repaint (at the start of his turn after its warning, or the admins' trigger): he gets ready (thinking; your
   * queen banner first, if your move took his queen) while this device's engines pick the pair (repaintFrom), then the
   * Repaint, his whole turn; then your turn, its moments (the Repaint's first) before your clock starts, as after his
   * move. No pair in the band, or no engine answer: no Repaint this turn (it waits for his next), and he plays his move.
   */
  private async repaintTurn() {
    const snap = this.bossSnapshot();
    this.set({ kind: "boss", boss: snap, until: 0, thinking: true });
    const paint = this.runner.playRepaint(this.engines).catch(() => this.runner.applyRepaint(null));
    await Promise.all([paint, new Promise((r) => setTimeout(r, bossThinkMs(snap)))]);
    if (this.stopped) return;
    const showMs = !this.runner.bossToMove() ? bossTurnShowMs(this.runner.bossView(), this.alone) : 0;
    this.set({ kind: "boss", boss: this.bossSnapshot(), until: Date.now() + showMs });
    this.timer = setTimeout(() => this.nextRound(), showMs);
  }

  /**
   * As your turn begins: if Wrangler's showdown may follow before long (the rules' `scout`: from his move showdownFrom
   * while he has one left; or the test trigger), his scout searches line-ups of three pairs and two on this position (an
   * engine of its own) until his turn; else it stops.
   */
  private scoutShowdown() {
    const v = this.runner.bossView();
    const p = v?.powers;
    const soon = !!p && (!!p.scout || !!p.ultNext);
    if (!v || v.id !== "pig" || !p || v.result || p.ultAt !== null || !soon) return void this.runner.showdownScout?.stop();
    this.runner.showdownScout ??= new ShowdownScout(() => ownEngine());
    this.runner.showdownScout.scout(v.board.fen, [3, 2]);
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

  // ---------------- The Hidden Boss's phase 2 ----------------

  /** Testing (?phase=2): an admin's Hidden Boss starts at his phase change, skipping phase 1. */
  private phase2Jump = testParams().get("phase") === "2";
  /** Phase 2's boards (from the phase change on), and whether its clocks have started. */
  private phase2: Phase2Game | null = null;
  private phase2Playing = false;
  private phase2From = "";
  private simulCache: { state: unknown; playing: boolean; view: SimulView } | null = null;

  /**
   * Phase 1 won against the Hidden Boss: his phase 2 follows, alone (Boss alone) or in a solo Crowd's boss final you
   * fought in (Oct 14: the bots who reached it with you take the other boards). Never a Solo raid (49 bots, no boards for
   * them). (Out before the final, you never get here: the battle plays out without you.)
   */
  private phase2Due(): boolean {
    return phase2Follows({ bossId: this.runner.boss?.id, result: this.runner.boss?.result, raid: !!this.settings.raid, raidBots: this.raidBots, crowdFinal: !this.settings.raid && this.settings.mode === "crowd" });
  }

  /**
   * His phase change (PHASE_CHANGE, about 25 s; not skippable, like a boss's intro): he absorbs the God King (who's gone
   * from then on: he says nothing in phase 2, and can't be called), his half-engine look igniting; up in a rage, his leap
   * onto the board, the book thrown down, the chant and its light, the split and its arcs, the book back in his hands, the
   * shuffle, his leap back. Phase 2's boards are set up now (each its own Chess960 start, from the battle's seed), so the
   * shuffle shows where they go; their clocks start after it, and a countdown on them (startSimul). `fromFall`: after phase 1's fall, whose mumbling carries
   * on into it.
   * `mates`: who fought phase 1 beside you (a solo Crowd's finalists), on the other boards; fresh bots for the rest.
   */
  private startPhaseChange(fromFall = false, mates: readonly { id: string; name: string }[] = []) {
    if (this.timer) clearTimeout(this.timer);
    this.begun = true;
    this.freeBrain();
    this.brainShown = isAdmin();
    // (Phase 1's words are over: neither voice carries a line into the phase change. His were cleared as he fell, so his
    // mumbling goes on until his chant cuts in.)
    if (!fromFall) bossVoice.reset();
    resetKingSpeech();
    const at = Date.now();
    const seed = this.runner.state.boss?.powers?.seed ?? Math.floor(this.rng() * 2 ** 32);
    this.phase2From = this.runner.boards.get(this.runner.state.boards[0]!)!.fen;
    const bots = phase2Mates(mates, RECLUSE_PHASE2.boards, (n) => botRoster(this.rng, n, this.settings));
    this.phase2Names = new Map(bots.map((b) => [b.id, b.name]));
    const engines = this.engines;
    this.phase2 = new Phase2Game({
      players: [HUMAN, ...bots.map((b) => b.id)],
      numbers: phase2Numbers(seed),
      human: HUMAN,
      boss: engines[0]!,
      bots: engines[engines.length - 1]!,
      win: !!this.settings.bossWinTest,
      rng: this.rng,
      onChange: () => this.emit(),
      onResult: (b) => this.phase2Result(b.result!.winner),
      onSlow: (id, ult) => this.phase2Slow(id, ult),
      onUlt: () => this.phase2Ult(),
      onDone: () => this.phase2Done(),
    });
    this.lastSlow = null;
    // (The slow move's sound made ahead, off the page, before play begins.)
    warmSounds(["recluseSlow", "recluseDrain", "recluseSpark", "recluseArc"]);
    // Where he stands: slumped while the God King gloats, then he seizes his power and gets up in a rage; from his leap the
    // board draws him (his place stands empty), and once he's back he rests in phase 2's idle. His half-engine look comes on
    // as the power lands, for the rest of the fight.
    setFigureRun(phaseChangeRun(at));
    setEngineAt(at + PHASE_CHANGE.igniteAt);
    this.set({ kind: "phaseChange", at });
    this.timer = setTimeout(() => this.startSimul(), PHASE_CHANGE.total);
  }
  private phase2Names = new Map<string, string>();

  /**
   * Phase 2's boards, set: a countdown on every one first (PHASE_CHANGE.countdownMs; Eric, Oct 17: "you're going to be so
   * confused what's going on"), nothing running, nobody moving; then play.
   */
  private startSimul() {
    if (!this.phase2 || this.stopped) return;
    this.set({ kind: "simul", at: Date.now() + PHASE_CHANGE.countdownMs });
    this.timer = setTimeout(() => this.startClocks(), PHASE_CHANGE.countdownMs);
  }

  /** Phase 2's play: every clock starts. His line (the God King is gone: absorbed in the phase change). */
  private startClocks() {
    if (!this.phase2 || this.stopped) return;
    this.phase2Playing = true;
    this.set({ kind: "simul", at: Date.now() });
    this.phase2.start();
    const lines = RECLUSE_LINES.phase2;
    // (NORMAL: his ultimate's line, if it comes this soon, cuts in.)
    bossVoice.say(lines[Math.floor(this.rng() * lines.length)]!, "recluse:phase2", NORMAL);
  }

  private phase2Lines = { won: 0, lost: 0, slow: 0 };

  /**
   * A slow move (the team's count, the X marks beside every board): a soft sound, and his word on it if nothing else is
   * being said (one bubble: it waits a little, then lapses).
   */
  private phase2Slow(boardId: number, ult: boolean) {
    // (Soft and low: two notes falling. The board it was on flashes its marks, and the dock names it, for a moment.)
    play("recluseSlow");
    this.lastSlow = { board: boardId, at: Date.now() };
    // (The one that brings his ultimate: his ultimate's line instead.)
    if (ult) return;
    const lines = RECLUSE_LINES.slow;
    bossVoice.say(lines[this.phase2Lines.slow++ % lines.length]!, `recluse:p2:slow:${this.phase2Lines.slow}`, LOW);
  }
  /** The last slow move: on which board, and when (its marks flash, the dock names it). */
  private lastSlow: { board: number; at: number } | null = null;

  /** His ultimate: his line, the spellbook where he stands; from now on a few seconds a move on every board. */
  private phase2Ult() {
    const at = Date.now();
    playInPlace(`recluse:ult2:${at}`, PHASE2_ULT_ANIMS, at);
    const lines = RECLUSE_LINES.ult2;
    bossVoice.say(lines[Math.floor(this.rng() * lines.length)]!, `recluse:p2:ult:${at}`, CRITICAL);
  }
  /** A board decided: his word on it (a draw: nothing). The board's own tag says won or lost; the God King is gone. */
  private phase2Result(winner: "crowd" | "boss" | "draw") {
    if (winner === "draw" || this.phase2?.outcome.decided) return;
    const key = `recluse:p2:${winner}:${this.phase2Lines.won + this.phase2Lines.lost}`;
    if (winner === "boss") bossVoice.say(RECLUSE_LINES.boardWon[this.phase2Lines.lost++ % RECLUSE_LINES.boardWon.length]!, key, CRITICAL);
    else bossVoice.say(RECLUSE_LINES.boardLost[this.phase2Lines.won++ % RECLUSE_LINES.boardLost.length]!, key, CRITICAL);
  }

  /**
   * Every board decided: his reaction holds the boards (RECLUSE_PHASE2.endMs), then the result. Beaten: a placeholder
   * for his "super saiyan" transformation (the spellbook's glow and wind, from his phase 2 frames); he won: his laugh.
   */
  private phase2Done() {
    const o = this.phase2!.outcome;
    const now = Date.now();
    if (o.beaten) {
      setFigureRun({ since: now, anims: ["spellbook2"], loop: "spellLoop2" });
      bossVoice.say(RECLUSE_LINES.beaten2[Math.floor(this.rng() * RECLUSE_LINES.beaten2.length)]!, "recluse:p2:beaten", CRITICAL);
    } else {
      setFigureRun({ since: now, anims: ["laugh2"], loop: "idle2" });
      bossVoice.say(RECLUSE_LINES.victory[Math.floor(this.rng() * RECLUSE_LINES.victory.length)]!, "recluse:p2:victory", CRITICAL);
    }
    this.emit();
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.finishPhase2(), RECLUSE_PHASE2.endMs);
  }

  /**
   * The result: Victory only with every board won; else a defeat that says how many of the four were won. Your place
   * is the match's (alone, first of one; a solo Crowd's, your place in the crowd, from phase 1's end).
   */
  private finishPhase2() {
    const o = this.phase2?.outcome ?? { won: 0, of: RECLUSE_PHASE2.boards, beaten: false };
    this.halt();
    const top = this.runner.state.players.find((p) => p.placement === 1);
    this.phase = { kind: "results", placement: this.you.placement ?? 1, winner: top?.name ?? "", youWon: o.beaten, bossResult: o.beaten ? "crowd" : "boss", simul: { won: o.won, of: o.of } };
    this.emit();
  }

  /** Your move on your board. */
  simulMove(boardId: number, move: string) {
    if (this.phase.kind !== "simul" || !this.phase2Playing) return;
    this.phase2?.move(boardId, move);
  }

  get simul(): SimulView | null {
    const g = this.phase2;
    if (!g || (this.phase.kind !== "phaseChange" && this.phase.kind !== "simul")) return null;
    // (Built again only when the boards change: the screens read this every frame.)
    if (this.simulCache?.state === g.state && this.simulCache.playing === this.phase2Playing) return this.simulCache.view;
    const o = g.outcome;
    const view: SimulView = {
      from: this.phase2From,
      playing: this.phase2Playing,
      ...o,
      slow: g.state.slow,
      lastSlow: this.lastSlow,
      ultAt: g.state.ultAt,
      boards: g.state.boards.map((b) => ({
        id: b.id,
        you: b.player === HUMAN,
        name: b.player === HUMAN ? "You" : (this.phase2Names.get(b.player) ?? "Bot"),
        number: b.number,
        fen: b.board.fen,
        lastMove: b.board.lastMove,
        history: b.board.history,
        bases: b.board.bases,
        bankMs: b.bankMs,
        turnAt: this.phase2Playing ? b.turnAt : null,
        toMove: this.phase2Playing ? phase2ToMove(b) : null,
        result: b.result,
      })),
    };
    this.simulCache = { state: g.state, playing: this.phase2Playing, view };
    return view;
  }

  get bossNote(): string | null {
    const v = this.simul;
    if (!v) return null;
    // (Only what the title, "BOSS · phase 2", doesn't say: nothing in the phase change, then how many are won.)
    return v.playing ? `${v.won} of ${v.of} won` : "";
  }

  private nextRound() {
    if (this.runner.isOver()) return this.finish();
    if (!this.you.alive) return void this.simulateRest();
    if (this.runner.boss) {
      // (Testing, ?phase=2: the Hidden Boss's phase 2 at once, from the phase change.)
      if (!this.bossIntroDone && this.phase2Jump && this.runner.state.boss?.id === "recluse") {
        this.bossIntroDone = true;
        return this.startPhaseChange(false, this.runner.alive().filter((p) => p.id !== HUMAN));
      }
      if (!this.bossIntroDone) {
        // The boss arrives: it takes over from an even position of the game just played (on Maia, its loading step
        // first).
        this.bossIntroDone = true;
        return this.startBrain((afterLoading) => this.bossIntro(afterLoading));
      }
      if (this.runner.stageComplete()) {
        // (Who fought it beside you: a solo Crowd's finalists, phase 2's other players if it follows.)
        const mates = this.runner.alive().filter((p) => p.id !== HUMAN);
        this.runner.finishBossBattle();
        // (A boss with a fall beaten, the Hidden Boss: the board holds while he collapses and starts to mumble; then his
        // phase change and phase 2 (Boss alone, a solo Crowd's final), or the result screen, where he goes on mumbling.
        // Before his phase change the fall is short, and his words are cleared as he falls, so his mumbling carries on.)
        const phase2 = this.phase2Due();
        const fallMs = this.runner.boss?.result !== "crowd" ? undefined : phase2 ? PHASE_CHANGE.fallMs : bossRules(this.runner.boss)?.fallMs;
        if (fallMs) {
          if (phase2) bossVoice.reset();
          const next = phase2 ? () => this.startPhaseChange(true, mates) : () => this.finish();
          this.set({ kind: "boss", boss: this.bossSnapshot(), until: Date.now() + fallMs, fall: true });
          this.timer = setTimeout(next, fallMs);
          return;
        }
        return this.finish();
      }
      // (Hollow's Lights out, Big Boy's Big Bounce, Alfil's steps, Chub & Chirp's Carrot Patch cast (his whole turn) and
      // hop come at the start of his turn, before his move.)
      if (this.runner.bossToMove()) return void (this.runner.lightsOutDue() ? this.lightsOutTurn() : this.runner.bounceDue() ? this.bounceTurn() : this.runner.alfilStep() ? this.alfilTurn() : this.runner.carrotDue() ? this.carrotTurn() : this.runner.repaintDue() ? this.repaintTurn() : this.runner.hopDue() ? this.hopTurn() : this.bossTurn());
      // (A failed Lights out: his extra move, after his own and before your turn.)
      if (this.runner.extraMoveDue()) return void this.extraTurn();
      // (Boingo's funhouse: his move for you, as your turn begins.)
      if (this.runner.funhouseDue()) return void this.funhouseTurn();
    } else if (this.runner.isFinal()) return void this.finalTurn();
    this.begun = true;
    this.runner.deal();
    this.kingCalled = false;
    this.frozen = null;
    this.darkNote = null;
    this.runner.prefetch();
    // (Wrangler's showdown may follow your move: this device scouts line-ups while you think.)
    this.scoutShowdown();
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
    const { board, allowedMs: allowed } = this.phase;
    if (move !== null && Date.now() < this.playStartedAt - 300) return; // Before the clock starts.
    // Boss battle: only a move allowed this turn (a power's limits; the move the God King took back).
    if (move !== null && this.runner.boss && !(this.runner.crowdAllowed() ?? [move]).includes(move)) return;
    const now = Date.now();
    if (move !== null && this.frozen && now < this.frozen.until) return; // While the King strikes.
    // (Only now, the move accepted: a refused one leaves the turn's timeout running, so the turn still ends.)
    if (this.timer) clearTimeout(this.timer);
    const frozen = this.frozen ? Math.max(0, Math.min(now, this.frozen.until) - this.frozen.at) : 0;
    const thinkMs = Math.max(0, Math.min(now - this.playStartedAt - frozen, allowed));
    const usedPowerUp = this.hint !== null;
    const inFinal = !!this.runner.final;
    this.movedAt = now;
    this.progress.mark(HUMAN);
    crumb(move ? `move ${move}` : "no move in time");
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
    if (this.stopped) return;
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
    const revealMs = (this.settings.revealSeconds + this.settings.drawnMoveSeconds) * 1000 + (mine.king ? kingMoveMs(this.settings) : 0) + (mine.lastStand ? LAST_STAND_MS : 0);
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
    if (this.stopped) return;
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
    if (this.stopped || this.phase.kind !== "final") return;
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
      // (You left: the rest isn't played out.)
      if (this.stopped) return;
      this.set({ kind: "simulating", stage: this.runner.state.stage, round: this.runner.state.round });
      if (this.runner.boss) {
        if (this.runner.stageComplete()) {
          this.runner.finishBossBattle();
          break;
        }
        if (this.runner.bossToMove()) {
          // (Lights out with nobody watching: the bots' finds from the seed.)
          if (this.runner.lightsOutDue()) {
            this.runner.startLightsOut();
            this.runner.finishLightsOut({});
          }
          if (this.runner.bounceDue()) await this.runner.playBounce(this.engines).catch(() => this.runner.applyBounce(null));
          // (Alfil's steps, one after another: no engine answer, the cast's first pair, the fusion's first square or nothing
          // lifts. His fusion is his move: then his turn is over.)
          for (let i = 0; i < 3 && this.runner.alfilStep(); i++) await this.runner.playAlfil(this.engines).catch(() => this.runner.applyAlfil(null));
          // (Chub & Chirp's Carrot Patch cast: his whole turn, unless the pass guard has it wait. Else his hop: no engine
          // answer, the first pawn that can.)
          if (this.runner.carrotDue()) await this.runner.playCarrots(this.engines).catch(() => this.runner.applyCarrots(null));
          // (Smudgy's Repaint: his whole turn; no pair in the band, or no engine answer: he moves.)
          if (this.runner.repaintDue()) await this.runner.playRepaint(this.engines).catch(() => this.runner.applyRepaint(null));
          if (this.runner.hopDue()) await this.runner.playHop(this.engines).catch(() => this.runner.applyHop(null));
          if (this.runner.bossToMove()) await this.runner.playBoss(this.engines[0]);
          continue;
        }
        if (this.runner.extraMoveDue()) {
          await this.runner.playExtraMove(this.engines[0]);
          continue;
        }
        if (this.runner.funhouseDue()) {
          await this.runner.playFunhouse(this.engines[0]).catch(() => this.runner.applyFunhouse(""));
          continue;
        }
        this.runner.deal();
        await this.runner.score(new Map());
        if (this.stopped) return;
        if (this.runner.bossKillDue()) this.runner.bossKill();
        continue;
      }
      this.runner.deal();
      await this.runner.score(new Map());
      if (this.stopped) return;
      if (this.runner.final) this.runner.afterFinalTurn();
      if (this.runner.stageComplete()) {
        if (this.runner.isFinal() && this.runner.final) this.runner.finishFinal();
        else if (!this.runner.isFinal()) this.runner.endStage();
      }
    }
    if (this.stopped) return;
    this.finish();
  }

  private finish() {
    this.freeBrain();
    this.runner.showdownScout?.reset();
    const winner = this.runner.state.players.find((p) => p.placement === 1);
    this.set({
      kind: "results",
      placement: this.you.placement!,
      winner: winner?.name ?? "",
      youWon: this.you.placement === 1,
      ...(this.settings.mode === "crowd" ? { gameWinner: this.runner.gameWinner() } : {}),
      ...(this.runner.boss?.result ? { bossResult: this.runner.boss.result } : {}),
      // (The bullet clock ran out: the Hidden Boss won on time.)
      ...(this.runner.bossTimedOut ? { timeout: true } : {}),
      ...(this.runner.bossCarrotWin ? { carrots: true } : {}),
    });
  }
}
