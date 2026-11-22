import { DASH_STALL, RECLUSE_CHILD, RECLUSE_CUTSCENE, RECLUSE_PHASE2, BOSS_ALONE_SCORING, bossClockSettings, BOSS_BRAIN, BOSS_POWERS, DEFAULT_SETTINGS, MATCHMAKING, type ItemLook, type MatchmakingType, botVotes, castPregameVote, clockAfterVote, closePregameVote, cutSeconds, pregameVotes, voteResultMs, type Augment, type BossBrain, type PlayerState, type Settings } from "@chessroyale/core";
import { GUARD_WORDS, MatchRunner, START_FEN, baseAt, ShowdownScout, brainLine as brainWords, boardSlots, type HumanUciEngine, netBoard, type LobbyPlayer, type LivePick, toSan, type BoardSlot, type BoardState, type NetFinal, type Opening, type RoundReport, type UciEngine } from "@chessroyale/chess";
import { type Phase2Board, bulletClock, crowdRace, phase2Numbers, phase2Standings, phase2ToMove, botRoster, bossIntroTimeline, bossThinkMs, fireShows, landedEarlyMs, fullMoonMs, gingerTurnMs, folioTurnMs, sawyerTurnMs, popOffMs, zebraTurnMs, chandyTurnMs, bigboyTurnMs, dodgeTimeline, dodgeArena, dodgeEndAt, dodgeOver, bossTurnShowMs, judgeTaps, bossRules, kingHelpBlocked, kingMoveMs, kingStrikeMs, lightsDeadline, lightsOutTimeline, lightsRoundEnd, lastStandMs, powerMomentMs, isHop, rushKeep, rushMovesLeft, rushSquares, rushTimeline, stallTimeline, nextBeat, type StallPlan } from "@chessroyale/chess";
import type { BossView, BoardView, DarkNote, ExitKind, FinalView, GameView, Hint, LightsView, MoveRecord, RushView, Phase, SimulView, Standing, VoteView } from "./game.ts";
import { PHASE_CHANGE, Phase2Game, cueSlash, phase2Follows, phase2Mates, phaseChangeRun } from "./recluse-phase2.ts";
import { RECLUSE_LINES } from "./characters/recluse-lines.ts";
import { playInPlace, resetBeats, setSuitAt, setFigureRun } from "./components/BossCharacter.tsx";
import { resetBattleBanners } from "./battle-banners.ts";
import { clearPremoves } from "./board/yours.ts";
import { BLACKOUT, DARK_FORCED } from "./components/Hollow.tsx";
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
import { engineMoveAllowed, isAdmin, maiaAllowed, soloBrain, winFormAllowed } from "./boss-brain.ts";
import { prefetchMaia, startMaia } from "./maia.ts";
import { MaiaGate, type GateEnd } from "./maia-gate.ts";
import { testParams, timingOnDevice } from "./test-switches.ts";
import { gardenClock, setGardenSource } from "./garden-clock.ts";
import { chunk } from "./stale.ts";
import { type FloorPlay, type KeptGame, floorOutcome, leaveIsFree } from "./tower.ts";

export const HUMAN = "you";
/** A solo match's result, as its result screen shows it (and SoloMatch.decided, from the moment it's known). */
export type Results = Extract<Phase, { kind: "results" }>;
/** In the final, how long each move is shown before the next turn. */
const FINAL_SHOW_MS = 3200;
/** Boss battle: how long the boss's move shows, how long it thinks at least, and how long a strike shows. */
const BOSS_KILL_MS = 3800;
/** The moments of the crowd's move that his thinking waits for (Alfil's early landing, Moo's Full Moon, Folio, Boingo's pop, Zebra, Chandy, Big Boy's topple, Sawyer's Saw Swap): the server's sum (thinkMinAt). */
const landedMs = (snap: BossView) => landedEarlyMs(snap) + fullMoonMs(snap) + gingerTurnMs(snap) + folioTurnMs(snap) + popOffMs(snap) + zebraTurnMs(snap) + chandyTurnMs(snap) + bigboyTurnMs(snap) + sawyerTurnMs(snap);
/**
 * The opening library (packages/chess/data/openings.json: 350 kB of the first load's main chunk until Nov 6): its own chunk now,
 * loaded on first use. Home asks for it once the page is idle (App.tsx), and a solo match waits for it before it starts
 * (`startSolo`), so nothing on screen changes; a test awaits it before `start()`.
 */
let library: readonly Opening[] | null = null;
let libraryLoad: Promise<readonly Opening[]> | null = null;
export function loadOpenings(): Promise<readonly Opening[]> {
  libraryLoad ??= chunk(import("@chessroyale/chess/data/openings.json")).then(
    (m) => (library = m.default as unknown as Opening[]),
    (e) => {
      // (A failed fetch is tried again next time.)
      libraryLoad = null;
      throw e;
    },
  );
  return libraryLoad;
}
function openings(): readonly Opening[] {
  if (!library) throw new Error("The opening library isn't loaded yet: await loadOpenings() first");
  return library;
}

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
  /** A solo match (App.tsx tells it apart by this, without loading this chunk). */
  readonly isSolo = true;
  /** The queue screen (Solo): who has a seat so far, and when they're all in. */
  readonly queueType: MatchmakingType = "solo";
  auto = false;
  readonly myId = HUMAN;
  players: LobbyPlayer[] = [];
  readonly looks = new Map<string, ItemLook>();
  readonly fillAt: number | null = null;
  filledAt: number | null = null;
  /**
   * Quick chat in the queue (Crowd and raids) while your bots sit down. A 50 v 50 keeps it through the match, the bots
   * chatting as online (never on the cut screen: Eric, Nov 1); a raid's closes as the match begins.
   */
  private lobbyChat = new SoloLobbyChat(
    HUMAN,
    () => this.emit(),
    () => account().profile?.shop?.owned,
    () => account().profile?.shop?.chat,
    () => this.phase.kind === "stageBreak",
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
  ) {
    // Boss alone (a raid without bots) keeps the old scoring; a Solo raid scores as every raid (RAID_SCORING). Boss alone
    // plays on Boss Battle's clock, 10 + 10 (BOSS_CLOCK; Eric, Oct 30), with no boss strikes (Eric, Oct 31); a Solo raid
    // keeps the raid's clock and strikes.
    // Against Hollow, Boss alone plays his ten bulbs instead of points (Eric, Nov 5: `hollowBulbs`, solo only).
    if (baseSettings.raid && !raidBots) this.baseSettings = { ...baseSettings, ...BOSS_ALONE_SCORING, bossNoStrikes: true, hollowBulbs: true, ...(baseSettings.bossAloneClock ? bossClockSettings(baseSettings) : {}) };
    // (The hippo gardener's seeds count by this page's visible time, not an earlier online match's server.)
    setGardenSource(null);
    // (A game on this device: a tester's ?bannerplus= counts.)
    timingOnDevice(true);
  }

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
    const rows = this.runner.leaderboard();
    // (The Hidden Boss's phase 2 players still in from his fall until the results: phase2Standings. Phase 1's end placed everyone,
    // and that stays the truth for the result.)
    const k = this.phase.kind;
    const boards = k === "phaseChange" || k === "simul" ? this.phase2?.state.boards : k === "boss" && this.phase.toPhase2 ? this.phase2Seats.map((player) => ({ player })) : null;
    const extra = this.crowdRows;
    return (boards ? phase2Standings(rows, boards) : rows).map((s) => ({ ...s, ...(extra?.[s.id] ?? {}), isYou: s.id === HUMAN }));
  }
  /** The 50 v 50 rework's results rows (MatchRunner.crowdResults), once it's over: out at move, points a move. */
  private crowdRows: Record<string, { outAtMove: number | null; perMove: number | null }> | null = null;
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
    this.noteEnded();
    this.listeners.forEach((l) => l());
  }

  private emit() {
    this.noteEnded();
    this.listeners.forEach((l) => l());
  }

  /**
   * The game's result from the moment it's decided, not only on the result screen (`phase`): through any end moment that plays first
   * (a beaten boss's fall, the final's last move held, the Hidden Boss's reaction to phase 2's end). The app keeps it on the device
   * then, so a page closed or reloaded meanwhile still sends it and a won game is never recorded as left (xp.ts, SOLO_ABANDON).
   */
  get decided(): Results | null {
    return this.phase.kind === "results" ? this.phase : this.ended;
  }
  private ended: Results | null = null;
  /**
   * Worked out at every update (before its listeners hear of it) from the game's own state, not from the paths that end it: once the
   * runner has placed everyone (with no form or phase 2 still to come), or phase 2's boards are all decided, the result is as finish
   * (or finishPhase2) will show it. So any end moment, now or added later, comes after the result is known. (Classic, once you're out:
   * your own result as it will be, your place fixed; who wins isn't known yet: placedInClassic.)
   */
  private noteEnded() {
    if (this.ended || !this.runner || this.phase.kind === "results") return;
    const g = this.phase2;
    if (g ? g.outcome.decided : (this.runner.isOver() && !this.phase2Due()) || this.placedInClassic()) this.ended = g ? this.phase2Results() : this.results();
  }

  /**
   * Classic: your own place is fixed once you're out (a cut, a team final's step), whoever goes on to win, so your result is decided
   * then: a page closed on "You're out" or while the rest plays out keeps that place (the second delta review). Not Crowd: out, your
   * team can still win the game.
   */
  private placedInClassic(): boolean {
    return this.settings.mode === "classic" && !this.runner.boss && this.you?.placement != null;
  }

  /** The timer on its way when it's the next round's (nextRoundIn: a step shown, then the next round), until it fires. */
  private roundTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * The page is going (pagehide: closed or reloaded) once the game is over but not yet ended: the runner decides as the step on screen
   * ends (as online), so it ends now, and its result is known (`decided`) before the page goes. A boss battle over (`stageComplete`:
   * a mate, the move cap, the clock, his last carrot, a blackout, a Dodge hit): the crowd's last move's reveal ends as a tap would
   * (skipReveal), a strike due after it plays (afterBossRound), and the step shown then (that strike, his last move or power) ends with
   * the next round, which ends the battle (finishBossBattle). A 50 v 50's game over: its last reveal. Anything else plays on (skipping it
   * would start the next turn's clock in a page kept for Back).
   */
  endOnHide(): void {
    if (this.stopped || this.decided || !this.runner) return;
    if (!this.runner.boss) {
      if (this.phase.kind === "reveal" && this.runner.crowdGameEnd()) this.skipReveal();
      return;
    }
    if (!this.runner.stageComplete()) return;
    if (this.phase.kind === "reveal") this.skipReveal();
    if (this.stopped || this.decided || this.roundTimer === null || this.timer !== this.roundTimer) return;
    clearTimeout(this.roundTimer);
    this.timer = this.roundTimer = null;
    this.nextRound();
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
    this.awayWatch?.();
    this.awayWatch = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.clearStall();
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
    // (A tower floor: free before your 2nd move, core's leaveFloor; a loss after.)
    if (this.tower && this.runner?.boss) return leaveIsFree(this.runner.boss.crowdMoves) ? "leave" : "resign";
    if (!this.begun) return "leave";
    return this.you.alive ? "resign" : "leave";
  }

  get exitHome(): boolean {
    // (A tower floor: leaving before your 2nd move is free, and goes back to the tower: no result.)
    if (this.tower && this.runner?.boss) return leaveIsFree(this.runner.boss.crowdMoves);
    return !this.begun;
  }

  // ---------------- The Battle Tower (tower.ts) ----------------

  /** A Battle Tower floor: its run (the strip, the result's buttons) and the floor kept on this device after every step. */
  tower: FloorPlay | null = null;

  /**
   * The floor's game kept on the device as it stands now, so a reload rejoins it here: as each round begins (nextRound) and as each
   * step of the bosses' turn has played (nextRoundIn: his move, each power's step), so a reload rejoins after his reply, never before
   * it to draw another (audit 2, finding 2). With it, the time you've used on this turn (turnUsedMs).
   */
  private keepFloor() {
    if (!this.tower || this.stopped || !this.runner?.boss || this.runner.boss.result) return;
    this.watchAway();
    const turnMs = this.turnUsedMs();
    this.tower.keep({ snapshot: this.runner.snapshot(), moves: this.moves, intro: this.bossIntroDone, ...(turnMs > 0 ? { turnMs } : {}) });
  }

  /** The step just played shows for `ms`, then the next round: the floor kept first, so a reload rejoins after the step (keepFloor). */
  private nextRoundIn(ms: number) {
    this.keepFloor();
    const t = setTimeout(() => {
      if (this.roundTimer === t) this.roundTimer = null;
      this.nextRound();
    }, ms);
    this.timer = this.roundTimer = t;
  }

  /**
   * A tower floor's clock while you're away (the director's call on audit 2's finding 2): no time passes. The time you've used on this
   * turn is kept with the game as the page is hidden or closed, and given back as used on a rejoin (`resumeTurnMs`); while the page is
   * hidden your turn's clock stands still (`awayAt`), as a locked phone left overnight would otherwise come back lost on time.
   */
  private resumeTurnMs = 0;
  private awayAt = 0;
  private awayWatch: (() => void) | null = null;
  /** The time you've used on this turn of yours (ms): its clock's, less its pauses; 0 when it isn't your turn. */
  private turnUsedMs(now = Date.now()): number {
    if (this.phase.kind !== "play") return this.resumeTurnMs;
    return Math.max(0, (this.awayAt || now) - this.playStartedAt - this.frozenMs(this.awayAt || now));
  }
  private watchAway() {
    if (this.awayWatch || typeof document === "undefined") return;
    const changed = () => (document.visibilityState === "hidden" ? this.goneAway() : this.cameBack());
    const gone = () => this.goneAway();
    document.addEventListener("visibilitychange", changed);
    globalThis.addEventListener?.("pagehide", gone);
    this.awayWatch = () => {
      document.removeEventListener("visibilitychange", changed);
      globalThis.removeEventListener?.("pagehide", gone);
    };
  }
  /** The page hidden (or closed) on your turn: its clock stops, and the time used so far is kept with the floor. */
  private goneAway() {
    if (!this.tower || this.stopped || this.phase.kind !== "play" || this.awayAt) return;
    this.awayAt = Date.now();
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.cancelStall();
    this.tower.keepTurn(this.turnUsedMs());
  }
  /** Back on the page: your turn's clock goes on from where it stood (its start and deadline moved on by the time away). */
  private cameBack() {
    const phase = this.phase;
    if (!this.awayAt) return;
    const now = Date.now();
    const away = now - this.awayAt;
    this.awayAt = 0;
    if (this.stopped || phase.kind !== "play") return;
    this.playStartedAt += away;
    const deadline = phase.deadline + away;
    this.timer = setTimeout(() => this.submit(null), deadline - now + this.settings.lateGraceMs);
    this.set({ ...phase, startsAt: phase.startsAt + away, deadline });
    this.armStall();
  }

  /**
   * A tower floor rejoined after a reload (or a reopened app): the match as it was kept at its last step, played on from there (the
   * boss's brain loaded again; his entrance not played again once it has). The position is the same, so a reload can't dodge a loss.
   */
  resume(game: KeptGame) {
    warmEngineServer();
    this.runner = MatchRunner.restore(game.snapshot, {
      settings: this.baseSettings,
      rng: this.rng,
      engines: this.engines.map((e) => withServerRecheck(e, () => this.runner?.state.boards.length ?? 1)),
      library: openings(),
      clock: gardenClock,
    });
    this.moves = [...game.moves];
    // (The time you'd used on your turn as you went: given back as used, nothing for the time away: keepFloor.)
    this.resumeTurnMs = game.turnMs ?? 0;
    this.begun = this.runner.boss ? this.runner.boss.crowdMoves > 0 || game.intro : false;
    this.bossIntroDone = game.intro;
    if (game.intro) this.startBrain(() => this.nextRound());
    else this.nextRound();
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
    // (A tower floor: the leave to send, kept here until the server takes it; it decides free or a loss, by your moves.)
    if (this.tower && this.runner?.boss) this.tower.done("left", this.runner.boss.crowdMoves);
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

  /**
   * Crowd 50 v 50: removed for being away (more misses in the game than CrowdMisses allows): as resigning, the match
   * stops here, a loss, out in the last place still open; the results say why ("Removed for being away").
   */
  private removeAway() {
    this.halt();
    resetKingSpeech();
    bossVoice.reset();
    const placement = this.runner.retire(HUMAN);
    this.phase = { kind: "results", placement, winner: "", youWon: false, left: { how: "afk", misses: this.you.misses ?? 0 } };
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
        // (A 50 v 50's chat carries on into the match, with teams; a raid has none.)
        if (this.settings.mode === "crowd" && !this.settings.raid) {
          const seats = this.runner.state.players;
          this.lobbyChat.startMatch(
            (id) => (this.runner.boss ? null : (seats.find((p) => p.id === id)?.colour ?? null)),
            seats.filter((p) => p.isBot).map((p) => p.id),
          );
        } else this.lobbyChat.close();
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
      library: openings(),
      raidSide: this.raidSide,
      // (The hippo gardener's seeds: this device's time while the page is in view.)
      clock: gardenClock,
      // Boss alone is just you against the boss; a Solo raid has bots in the crowd.
      entrants: [
        { id: HUMAN, name: this.playerName, isBot: false, practice: this.practice },
        ...(this.settings.raid && !this.raidBots ? [] : botRoster(this.rng, this.settings.lobbySize - 1, this.settings)),
      ],
    });
    this.runner.forceLastStand = this.forceLastStand;
    // Test switches (50 v 50's scoring): ?streaks=1, everyone on a streak (every tier of the scoreboard's fire);
    // ?shoutout=1, the first move you pick gets a brilliant find's shoutout.
    if (this.settings.crowdScoring && testParams().get("streaks") === "1") this.runner.testStreaks();
    if (this.settings.crowdScoring && testParams().get("shoutout") === "1") this.runner.forceShoutout = true;
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
      id: votes[index]!.id,
      count: votes.length,
      startsAt: now,
      until: now + ms,
      votes: botVotes(this.rng, bots.map((b) => b.id), votes[index]!.options.length, ms, this.settings.voteBotSkip).map((v) => ({ playerId: v.id, option: v.option, at: now + v.atMs, side: side.get(v.id)! })),
      result: null,
      ...(this.settings.voteChangeAllowed ? { changeAllowed: true } : {}),
      ...this.voteStart(),
    };
    this.set({ kind: "vote", vote: this.voteState });
    this.timer = setTimeout(() => this.endVote(), ms);
  }

  /** The position the game starts from once the start vote made it another (Freestyle's), for the pieces that drop in. */
  private voteStart(): { start?: string } {
    const board = this.runner.boards.get(this.runner.state.boards[0] ?? 0);
    const start = board ? baseAt(0, board.bases).fen : START_FEN;
    return start !== START_FEN ? { start } : {};
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
    const nextAt = at + voteResultMs(this.settings);
    this.voteState = { ...v, votes, result, nextAt, ...this.voteStart() };
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

  /**
   * The Hidden Boss's child beaten and grown up: a new match against his adult form (the runner's nextBossForm: the board from the
   * start, his powers, the clocks), his entrance again as a new battle's (his beats, lines and banners forgotten: the boss screen
   * stays up through it, so it doesn't reset them itself), then play. His brain carries on (Maia, at his adult form's rating). Your
   * premoves on the child's last position are dropped: the same board starts again, and they'd play themselves on the man's first move.
   */
  private nextForm() {
    if (this.stopped) return;
    if (!this.runner.nextBossForm()) return this.finish();
    resetKingSpeech();
    bossVoice.reset();
    resetBeats();
    resetBattleBanners();
    clearPremoves(this);
    this.kingCalled = false;
    this.frozen = null;
    this.clearStall();
    this.bossIntro();
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
    const plan = this.runner.humanBrain ?? this.brainPlan;
    // (The Hidden Boss's child: the rating his next move is played at, rising with the game.)
    const child = this.runner.childRatingNow();
    const hb = plan && child !== null ? { ...plan, rating: child } : plan;
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
   * phase 1; the dock has him mock it, and your move goes on (its clock too). In phase 2 the God King can't be called: he stays
   * in his place, greyed (Eric, Nov 14).
   */
  callKing(strike = false) {
    if (kingHelpBlocked(this.runner?.boss)) {
      if (this.phase.kind === "play" && this.runner.kingTried()) this.emit();
      return;
    }
    if (this.phase.kind !== "play" || !this.runner.boss?.kingCharges || this.kingCalled) return;
    // (Not while Dash's fake move is on the board: the board takes no move then, the King's neither.)
    if (this.stallHolding(Date.now())) return;
    if (strike) return this.callStrike();
    this.kingCalled = true;
    this.runner.kingCallers.add(HUMAN);
    void this.score(null);
  }
  private callStrike() {
    const phase = this.phase;
    if (phase.kind !== "play" || phase.strike?.mine || Date.now() < this.playStartedAt - 300) return;
    // (Not during Dash's stall beat: his skit has the clock stopped. One still to come waits for a later move: StallPlan.)
    if (this.stallBeatOn(Date.now())) return;
    const { struck, calls } = this.runner.callStrike(HUMAN);
    const needed = Math.floor((this.runner.groups.values().next().value?.length ?? 1) / 2) + 1;
    if (!struck) return this.set({ ...phase, strike: { calls, needed, mine: true } });
    const ms = kingStrikeMs(this.settings);
    const at = Date.now();
    this.frozen = { at, until: at + ms };
    this.cancelStall();
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
    if (this.stallHolding(Date.now())) return; // While Dash's fake move is on the board.
    if (this.darkNote?.forced || this.darkNote?.blackout) return;
    const out = this.runner.darkTry(HUMAN, move);
    if (out.kind === "move") {
      this.darkNote = null;
      return this.submit(out.move);
    }
    if (out.kind === "refused") return;
    this.darkNote = { move, at: Date.now(), tries: out.tries, out: out.out, ...(out.bulbs !== undefined ? { bulbs: out.bulbs } : {}), ...(out.forced ? { forced: true } : {}), ...(out.blackout ? { blackout: true } : {}) };
    // Boss alone, his bulbs (Nov 5): the 3rd and 7th out, the dark plays your move; the last, the battle is his.
    if (out.forced) return void this.darkForcedTurn();
    if (out.blackout) return this.blackoutTurn();
    // (Your turn, though no move went in: XP's minimum counts it, as the match room does online. Nov 21.)
    if (out.out) return void this.score(null, true);
    // (A tower floor: the wrong try kept as it happens, so a reload mid-turn has the same bulbs out (Nov 20). The dark's move and the
    // blackout are kept by the step after them: a rejoin can't play a dark's move still due.)
    this.keepFloor();
    this.emit();
  }

  /**
   * The dark plays your move (Boss alone, the 3rd or 7th bulb out): your clock stops, the dark flashes over the board and
   * he says so (DARK_FORCED), the rules pick a bad move (darkForcedMoveFrom, on this device's engine), and it's played as
   * your move. Nothing else is taken meanwhile (the turn's only move is the dark's).
   */
  private async darkForcedTurn() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const started = Date.now();
    this.emit();
    const move = await this.runner.playDarkForced(this.engines[0]).catch(() => this.runner.applyDarkForced(""));
    const wait = DARK_FORCED.ms - (Date.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if (this.stopped || this.phase.kind !== "play") return;
    void this.score(move);
  }

  /** The last bulb went out (Boss alone): the screen goes black (BLACKOUT), then the battle ends as his. */
  private blackoutTurn() {
    if (this.timer) clearTimeout(this.timer);
    this.emit();
    this.nextRoundIn(BLACKOUT.ms);
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

  // ---------------- Chandy's queen lock and Dodge ----------------

  /**
   * Chandy's queen lock (at the start of his turn, his meter's pick): he gets ready (thinking) while this device's engines check the
   * pass guard, then the aim, his whole turn; then your turn, its moments (the aim's first) before your clock starts. When passing
   * would lose real material it waits and he plays his move (as online). No engine answer: the aim.
   */
  private async queenLockTurn() {
    const snap = this.bossSnapshot();
    this.set({ kind: "boss", boss: snap, until: 0, thinking: true });
    const aim = this.runner.playQueenLock(this.engines).catch(() => this.runner.applyQueenLock(null));
    await Promise.all([aim, new Promise((r) => setTimeout(r, bossThinkMs(snap)))]);
    if (this.stopped) return;
    const showMs = !this.runner.bossToMove() ? bossTurnShowMs(this.runner.bossView(), this.alone) : 0;
    this.set({ kind: "boss", boss: this.bossSnapshot(), until: Date.now() + showMs });
    this.nextRoundIn(showMs);
  }

  /** Dodge on (your turn waits for it): its key, when it began, the round on and your vote in it. */
  private dodge: { key: string; at: number; round: number; mine?: string } | null = null;

  /** As your turn begins: the scope-in, the warning volley, then three rounds of the vote, each closed here as the server closes them online. */
  private dodgeTurn() {
    if (this.timer) clearTimeout(this.timer);
    const at = Date.now();
    this.dodge = { key: `d-${at}`, at, round: 0 };
    this.showDodge();
    this.armDodge();
  }
  private showDodge() {
    const d = this.dodge!;
    this.set({ kind: "boss", boss: this.bossSnapshot(), until: 0, dodge: { key: d.key, at: d.at, round: d.round, votes: d.mine ? { [d.mine]: 1 } : {}, ...(d.mine ? { mine: d.mine } : {}) } });
  }
  private armDodge() {
    const d = this.dodge!;
    const full = this.runner.state.boss?.powers?.chandy?.dodge;
    const tl = dodgeTimeline();
    if (this.timer) clearTimeout(this.timer);
    const due = !full || dodgeOver(full) ? d.at + (full ? dodgeEndAt(full) : tl.rounds[0]!.end) : d.at + tl.rounds[full.results.length]!.closeAt;
    this.timer = setTimeout(() => this.dodgeStep(), Math.max(0, due - Date.now()));
  }
  /** A round closes (your vote, or a square from the seed; in a Solo raid the bots' too), or (over) on with the battle. */
  private dodgeStep() {
    const d = this.dodge;
    const full = this.runner.state.boss?.powers?.chandy?.dodge;
    if (!d || !full || this.stopped) return;
    if (!dodgeOver(full)) {
      this.runner.finishDodgeRound(this.you.alive && d.mine ? { [HUMAN]: d.mine } : {});
      d.round++;
      d.mine = undefined;
      this.showDodge();
      return this.armDodge();
    }
    this.dodge = null;
    this.nextRound();
  }
  /** Dodge: your vote in the round on, while its vote is open (as the server counts it online). */
  dodgeVote(square: string) {
    const d = this.dodge;
    const full = this.runner.state.boss?.powers?.chandy?.dodge;
    if (!d || !full || dodgeOver(full) || this.phase.kind !== "boss" || !this.phase.dodge || !this.you.alive || !dodgeArena(full.center).includes(square)) return;
    const r = dodgeTimeline().rounds[d.round]!;
    const t = Date.now() - d.at;
    if (t < r.voteAt - 300 || t > r.voteEnd) return;
    d.mine = square;
    this.showDodge();
  }

  // ---------------- Dash's Scramble Rush ----------------

  /** The Rush on (your turn waits for it): its key, when it began, your placements so far. */
  private rush: RushView | null = null;

  /** As your turn begins: the countdown and his sweep, his line and the God King's, your ten seconds; timed here as online. */
  private rushTurn() {
    if (this.timer) clearTimeout(this.timer);
    const at = Date.now();
    this.rush = { key: `r-${at}`, at, places: {}, moved: {} };
    this.showRush();
    this.timer = setTimeout(() => this.rushStep(), rushTimeline().placeUntil);
  }
  private showRush() {
    const r = this.rush!;
    this.set({ kind: "boss", boss: this.bossSnapshot(), until: 0, rush: { ...r, places: { ...r.places }, moved: { ...r.moved } } });
  }
  /** Time's up: your placements judged (rushJudge), the board as it was and the verdict; then his extra move, or your turn. */
  private rushStep() {
    const r = this.rush;
    if (!r || this.stopped) return;
    if (this.runner.rushDue()) {
      // (Solo: only your own put-back counts, no bots and no mean; Eric, Nov 8. Out of the battle: the bots' as online.)
      this.runner.finishRush(this.you.alive ? { [HUMAN]: r.places } : {}, this.you.alive ? HUMAN : undefined);
      this.showRush();
      this.timer = setTimeout(() => this.rushStep(), Math.max(0, r.at + rushTimeline().total - Date.now()));
      return;
    }
    this.rush = null;
    this.nextRound();
  }
  /** The Rush: you put the swept piece from `from` on `to` (a free square), while your ten seconds are on, each at most movesPerPiece times. */
  rushPlace(from: string, to: string) {
    const r = this.rush;
    const rush = this.runner.state.boss?.powers?.dash?.rush;
    if (!r || !rush || rush.correct !== undefined || this.phase.kind !== "boss" || !this.phase.rush || !this.you.alive) return;
    const t = Date.now() - r.at;
    const tl = rushTimeline();
    if (t < tl.placeAt - 300 || t > tl.placeUntil || rushMovesLeft(r.moved, from) <= 0) return;
    const places = { ...r.places, [from]: to };
    if (rushSquares(this.runner.boards.get(this.runner.state.boards[0]!)!.fen, rush, places).get(from) !== to) return;
    const kept = rushKeep(rush, r.places, r.moved, places);
    r.places = kept.places;
    r.moved = kept.moved;
    this.showRush();
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

  /** Testing, admins in any boss battle (Boss alone, a Battle Tower floor): the 🏆 shows, "Win this match" ("Win this form" against the Hidden Boss; winFormAllowed). */
  get winFormShown(): boolean {
    return winFormAllowed(!!this.runner?.boss);
  }
  get winFormArmed(): boolean {
    return this.phase.kind === "simul" ? !!this.phase2?.winNext : !!this.runner?.bossForceWin;
  }
  /**
   * "Win this match" (Nov 20, Eric's tower test; the Hidden Boss's "Win this form", Nov 13): your next move beats the boss (or the
   * floor's bosses), the same end a mate takes (the runner's bossForceWin: the result, its XP, a tower floor's write and the elevator
   * up follow as for real; against the Hidden Boss his fall, the phase change and its music); in his phase 2, your next move wins
   * every board and the result plays.
   */
  winForm() {
    if (!this.winFormShown || this.stopped) return;
    if (this.phase.kind === "simul") {
      if (!this.phase2 || !this.phase2Playing || this.phase2.outcome.decided) return;
      this.phase2.winNext = true;
    } else {
      if (this.phase.kind === "phaseChange" || this.runner.boss?.result) return;
      this.runner.bossForceWin = true;
    }
    this.emit();
  }

  /** Testing, admins in Boss alone: the "Engine move" button shows (see engineMoveAllowed). */
  get engineMoveShown(): boolean {
    return !!this.runner?.boss && engineMoveAllowed(this.settings.raid && !this.raidBots);
  }
  /** The engine's move is being searched (the button waits, so a double tap sends one move). */
  engineThinking = false;
  /**
   * Testing, admins in Boss alone: Stockfish's best move played as your own, through the normal move path (clocks,
   * the boss's reply and powers as usual). Its own search (Nov 2): Stockfish at full strength, one line, engineMoveNodes, over the
   * moves this turn allows (runner.engineBest); before, the power-up hints' search.
   */
  engineMove() {
    // (The Hidden Boss's phase 2: your board, its Chess960 position, on this device's engine; then your move as usual.)
    if (this.phase.kind === "simul") return this.engineMove960();
    if (!this.engineMoveShown || this.engineThinking || this.phase.kind !== "play") return;
    if (Date.now() < this.playStartedAt - 300) return;
    const fen = this.phase.board.fen;
    this.engineThinking = true;
    this.emit();
    // (Stockfish at full strength, its own search: never Maia's move, never the boss's brain. Eric, Nov 2.)
    void this.runner
      .engineBest(fen, BOSS_POWERS.engineMoveNodes)
      .catch(() => null)
      .then((best) => {
        this.engineThinking = false;
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
    // (The Hidden Boss's phase 2 has no ultimate since Nov 16: the trigger cuts one of your hearts now, the slash on demand.)
    if (this.phase.kind === "simul") return void (this.phase2Playing && this.phase2?.slash());
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
    // (G-REX's fire has just burnt something, or Alfil's pieces came down early, or Moo's Full Moon came, or Folio folded a
    // piece or wrote its Revision: it plays out before the boss's move.)
    const burnt = fireShows(snap);
    const landed = landedMs(snap);
    const minThink = bossThinkMs(snap, burnt, landed) - (this.alone && !burnt && !landed ? Date.now() - this.movedAt : 0);
    const thinkEnd = Date.now() + Math.max(0, minThink);
    // (Chandy's first capture: once the thinking's moments are done, the crosshair locks onto the piece he's about to take, then his
    // move shows; as the server holds the host's move.)
    const beforeShow = async (ms: number) => {
      await new Promise((r) => setTimeout(r, Math.max(0, thinkEnd - Date.now())));
      if (this.stopped) return;
      this.set({ kind: "boss", boss: this.bossSnapshot(), until: 0, thinking: true });
      await new Promise((r) => setTimeout(r, ms));
    };
    await Promise.all([this.runner.playBoss(this.engines[0], beforeShow), new Promise((r) => setTimeout(r, Math.max(0, minThink)))]);
    if (this.stopped) return;
    // As the turn passes to you, any power that comes with it (a freeze, a pie, the warning, the blizzard) plays out
    // before your clock starts.
    // (At a mate, the boss's attack on your king, if it has one: the result waits for it.)
    const view = this.runner.bossView();
    const showMs = bossTurnShowMs(view, this.alone);
    const until = Date.now() + showMs;
    this.set({ kind: "boss", boss: this.bossSnapshot(), until });
    this.nextRoundIn(showMs);
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
    const showMs = powerMomentMs([{ kind: this.runner.boss?.id === "dash" ? "rushExtra" : "extra" }]);
    this.set({ kind: "boss", boss: this.bossSnapshot(), until: Date.now() + showMs });
    this.nextRoundIn(showMs);
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
    this.nextRoundIn(showMs);
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
    // (Your move's moments play out first, your topple of his tower among them: the same sum as his move's thinking and the server's.)
    await Promise.all([bounce, new Promise((r) => setTimeout(r, bossThinkMs(snap, false, landedMs(snap))))]);
    if (this.stopped) return;
    const showMs = powerMomentMs([{ kind: "bounce" }]);
    this.set({ kind: "boss", boss: this.bossSnapshot(), until: Date.now() + showMs });
    this.nextRoundIn(showMs);
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
    this.nextRoundIn(showMs);
  }

  /**
   * Chub & Chirp's Leapfrog (at the start of his turn, after your move): he gets ready (thinking) while this device's
   * engines pick which pawn hops (one alone hops at once, as their Pawn Bounce does), then it plays out (nobody's clock
   * runs), then his move. No
   * engine answer: the first pawn that can, as online. (Your move took his queen: that plays in this thinking first.)
   */
  private async hopTurn() {
    const snap = this.bossSnapshot();
    this.set({ kind: "boss", boss: snap, until: 0, thinking: true });
    const hop = this.runner.playHop(this.engines).catch(() => this.runner.applyHop(null));
    const [done] = await Promise.all([hop, new Promise((r) => setTimeout(r, bossThinkMs(snap)))]);
    if (this.stopped) return;
    const showMs = done ? powerMomentMs([{ kind: isHop(done) ? "hop" : "pawnBounce" }]) : 0;
    this.set({ kind: "boss", boss: this.bossSnapshot(), until: Date.now() + showMs });
    this.nextRoundIn(showMs);
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
    this.nextRoundIn(showMs);
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
    this.nextRoundIn(showMs);
  }

  /**
   * The hippo gardener's watering (at the start of his turn after its warning, or the admins' trigger): he gets ready
   * (thinking; your queen banner first, if your move took his queen) while this device's engines place what the seeds
   * rolled (waterFrom), then the watering, his whole turn; then your turn, its moments (the watering's first) before your
   * clock starts, as after his move. The pass guard, or no engine answer: no watering this turn (it waits for his next),
   * and he plays his move.
   */
  private async waterTurn() {
    const snap = this.bossSnapshot();
    this.set({ kind: "boss", boss: snap, until: 0, thinking: true });
    const water = this.runner.playWater(this.engines).catch(() => this.runner.applyWater(null));
    await Promise.all([water, new Promise((r) => setTimeout(r, bossThinkMs(snap)))]);
    if (this.stopped) return;
    const showMs = !this.runner.bossToMove() ? bossTurnShowMs(this.runner.bossView(), this.alone) : 0;
    this.set({ kind: "boss", boss: this.bossSnapshot(), until: Date.now() + showMs });
    this.nextRoundIn(showMs);
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
      this.nextRoundIn(BOSS_KILL_MS);
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
   * His phase change (PHASE_CHANGE, about 23 s; not skippable, like a boss's intro): his transformation by the book's light,
   * carrying on from his cutscene (the white-out, his final form, his first line), his leap and the split on the music's drop,
   * the book back in his hands, the shuffle, his leap back. The God King stays in his place, greyed (he says nothing in phase 2,
   * and can't be called). Phase 2's boards are set up now (each its own Chess960 start, from the battle's seed), so the
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
      onSlash: (b) => this.phase2Slash(b),
      onDone: () => this.phase2Done(),
    });
    // (The slash's sound made ahead, off the page, before play begins.)
    warmSounds(["recluseSlash", "recluseSpark", "recluseArc"]);
    // Where he stands: empty while the board draws him (from the start, as in his cutscene), and once he's back he rests in
    // phase 2's idle. His final form from the white-out on, for the rest of the fight.
    setFigureRun(phaseChangeRun(at));
    setSuitAt(at + PHASE_CHANGE.whiteFull);
    // (The board cracks into four at `splitAt`: his music's drop is put there, music.ts.)
    this.set({ kind: "phaseChange", at, splitAt: at + PHASE_CHANGE.crackAt });
    this.timer = setTimeout(() => this.startSimul(), PHASE_CHANGE.total);
  }
  private phase2Names = new Map<string, string>();
  /** His fall, phase 2 to follow: who takes his boards (the scoreboard's, until the boards are set up: `standings`). */
  private phase2Seats: string[] = [];

  /**
   * Phase 2's boards, set: a countdown on every one first (PHASE_CHANGE.countdownMs; Eric, Oct 17: "you're going to be so
   * confused what's going on"), nothing running, nobody moving; then play.
   */
  private startSimul() {
    if (!this.phase2 || this.stopped) return;
    this.set({ kind: "simul", at: Date.now() + PHASE_CHANGE.countdownMs });
    // The countdown counts from the boards' first frame on screen: the four boards' first draw is one long frame (50 to
    // 120 ms on a busy computer), and counted from before it the 5 was up short of its second (889 to 974 ms measured).
    // docs/decisions/2026-10-28-two-flaky-tests.md.
    afterFirstFrame(() => {
      if (!this.phase2 || this.stopped || this.phase.kind !== "simul" || this.phase2Playing) return;
      this.set({ kind: "simul", at: Date.now() + PHASE_CHANGE.countdownMs });
      this.timer = setTimeout(() => this.startClocks(), PHASE_CHANGE.countdownMs);
    });
  }

  /** Phase 2's play: every clock starts. His line (the God King stays greyed in his place: he can't be called in phase 2). */
  private startClocks() {
    if (!this.phase2 || this.stopped) return;
    this.phase2Playing = true;
    this.set({ kind: "simul", at: Date.now() });
    this.phase2.start();
    const lines = RECLUSE_LINES.phase2;
    // (NORMAL: his ultimate's line, if it comes this soon, cuts in.)
    bossVoice.say(lines[Math.floor(this.rng() * lines.length)]!, "recluse:phase2", NORMAL);
  }

  private phase2Lines = { won: 0, lost: 0 };

  /** A heart cut (Eric, Nov 16): yours, the slash's sound and his line; a bot's, the slash on its board alone (Recluse2.tsx). */
  private phase2Slash(b: Phase2Board) {
    // (Which last line from the moment it came, not the match's random source: drawing from it would move everything drawn after.)
    if (b.player === HUMAN) cueSlash(b.hearts, `solo:${b.slashAt}`, b.slashAt ?? 0);
  }
  /** A board decided: his word on it (a draw: nothing). The board's own tag says won or lost; the God King says nothing. */
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
    // (Read while the phase is still phase 2's: your board as it ended, for the result's review.)
    const results = this.phase2Results();
    this.halt();
    this.phase = results;
    this.emit();
  }
  /** Phase 2's result as it stands: its boards' outcome, your board as it ended; your place phase 1's end's. */
  private phase2Results(): Results {
    const o = this.phase2?.outcome ?? { won: 0, of: RECLUSE_PHASE2.boards, beaten: false };
    const simulBoard = this.simul?.boards.find((b) => b.you);
    const top = this.runner.state.players.find((p) => p.placement === 1);
    return { kind: "results", placement: this.you.placement ?? 1, winner: top?.name ?? "", youWon: o.beaten, bossResult: o.beaten ? "crowd" : "boss", simul: { won: o.won, of: o.of }, ...(simulBoard ? { simulBoard } : {}) };
  }

  /** Your move on your board. */
  simulMove(boardId: number, move: string) {
    if (this.phase.kind !== "simul" || !this.phase2Playing) return;
    this.phase2?.move(boardId, move);
  }

  /** The Hidden Boss's cutscene, after his fall (its times, this device's). */
  private cutsceneAt: { at: number; until: number } | null = null;
  get cutscene(): { at: number; until: number } | null {
    return this.cutsceneAt;
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
        hearts: b.hearts,
        slashAt: b.slashAt,
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
    this.keepFloor();
    if (this.runner.isOver()) return this.finish();
    // (The 50 v 50 rework: its one game over (by the rules or the move limit) ends the match for everyone still in.)
    if (this.runner.endGameIfOver()) return this.finish();
    // (Out: the rest played out at once, your result straight after; in the 50 v 50 rework, once you tap Spectate, you watch it to
    // the podium instead (C3). Not by default: the bots' game at watch pace can run to move 60, and nothing then needs you.)
    if (!this.you.alive && !this.watchesToEnd()) return void this.simulateRest();
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
        // (The Hidden Boss's child beaten: the board holds while he says so and grows up into the man (RecluseChild.ts), then a new
        // match against his adult form.)
        if (this.runner.boss?.form === "child" && this.runner.boss.result === "crowd") {
          this.set({ kind: "boss", boss: this.bossSnapshot(), until: Date.now() + RECLUSE_CHILD.fallMs, fall: true });
          this.timer = setTimeout(() => this.nextForm(), RECLUSE_CHILD.fallMs);
          return;
        }
        // (A boss with a fall beaten, the Hidden Boss: the board holds while he collapses and starts to mumble; then his
        // phase change and phase 2 (Boss alone, a solo Crowd's final), or the result screen, where he goes on mumbling.
        // Before his phase change the fall is short, and his words are cleared as he falls, so his mumbling carries on.)
        const phase2 = this.phase2Due();
        // (Who takes his boards, for the scoreboard through his fall and cutscene: you, then those phase2Mates keeps.)
        this.phase2Seats = phase2 ? [HUMAN, ...mates.slice(0, RECLUSE_PHASE2.boards - 1).map((m) => m.id)] : [];
        const fallMs = this.runner.boss?.result !== "crowd" ? undefined : phase2 ? PHASE_CHANGE.fallMs : bossRules(this.runner.boss)?.fallMs;
        if (fallMs) {
          if (phase2) bossVoice.reset();
          // (Then, before his phase change, his cutscene (Eric, Nov 12): from the fall's end, its hold long; the fall's screen stays up
          // under it, and the phase change starts as it ends, as online.)
          const now = Date.now();
          const hold = this.settings.cutsceneHoldMs ?? RECLUSE_CUTSCENE.holdMs;
          if (phase2) this.cutsceneAt = { at: now + fallMs, until: now + fallMs + hold };
          const next = phase2 ? () => this.startPhaseChange(true, mates) : () => this.finish();
          this.set({ kind: "boss", boss: this.bossSnapshot(), until: now + fallMs, fall: true, ...(phase2 ? { toPhase2: true } : {}) });
          this.timer = setTimeout(next, phase2 ? fallMs + hold : fallMs);
          return;
        }
        return this.finish();
      }
      // (Hollow's Lights out, Big Boy's Big Bounce, Alfil's steps, Chub & Chirp's Carrot Patch cast (his whole turn) and
      // hop come at the start of his turn, before his move.)
      if (this.runner.bossToMove()) return void (this.runner.lightsOutDue() ? this.lightsOutTurn() : this.runner.bounceDue() ? this.bounceTurn() : this.runner.alfilStep() ? this.alfilTurn() : this.runner.carrotDue() ? this.carrotTurn() : this.runner.repaintDue() ? this.repaintTurn() : this.runner.waterDue() ? this.waterTurn() : this.runner.hopDue() ? this.hopTurn() : this.runner.queenLockDue() ? this.queenLockTurn() : this.bossTurn());
      // (Dash's Scramble Rush, as your turn begins: the turn waits for it; Chandy's Dodge too.)
      if (this.runner.rushDue()) return void this.rushTurn();
      if (this.runner.dodgeDue()) return void this.dodgeTurn();
      // (A failed Lights out or Scramble Rush: his extra move, after his own and before your turn.)
      if (this.runner.extraMoveDue()) return void this.extraTurn();
      // (Boingo's funhouse: his move for you, as your turn begins.)
      if (this.runner.funhouseDue()) return void this.funhouseTurn();
    } else if (this.runner.isFinal()) return void this.finalTurn();
    this.begun = true;
    this.runner.deal();
    this.kingCalled = false;
    this.frozen = null;
    this.clearStall();
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
    // (A tower floor rejoined on your turn: the time you'd used on it, as used: keepFloor.)
    const used = this.resumeTurnMs;
    this.resumeTurnMs = 0;
    this.playStartedAt = Date.now() + intro - used;
    this.hint = null;
    const allowed = this.runner.allowedMsFor(HUMAN);
    this.set({ kind: "play", board: boardView(board), startsAt: this.playStartedAt, deadline: this.playStartedAt + allowed, allowedMs: allowed, clock: this.runner.moveClock() });
    this.timer = setTimeout(() => this.submit(null), intro + allowed - used + this.settings.lateGraceMs);
    // (Dash's clock tap or stall skit, each once a battle: his beats on this move's clock, if one comes on this move.)
    const plan = this.runner.stallPlan(HUMAN);
    if (plan) {
      this.stall = { plan, timer: null };
      this.armStall();
    }
    // (A tower floor's turn that begins while you're away (his reply came with the page hidden): its clock waits for you.)
    if (this.tower && typeof document !== "undefined" && document.visibilityState === "hidden") this.goneAway();
  }

  /**
   * Dash's beats on this move (his rules' stallPlan and nextBeat): his clock tap (no pause: your clock runs; nothing more of his on
   * this move after it; docs/decisions/2026-11-17-dash-tap-when-slow.md), or his stall skit (docs/decisions/2026-11-17-dash-stall.md): the slam and the fake move,
   * each when the move's clock reaches it (its pauses left out: the King's strike, the slam), each stopping the clock for its
   * length as the King's strike does (the deadline moved back, the bots still thinking too). Each is recorded as it comes, each
   * once a battle apart (runner.slammed, runner.stalled): a move of yours between them leaves the fake move for a later move,
   * where it comes alone (the plan's `slamAt` null).
   */
  private stall: { plan: StallPlan; tap?: { at: number; until: number }; slam?: { at: number; until: number }; fake?: { at: number; until: number }; timer: ReturnType<typeof setTimeout> | null } | null = null;
  private clearStall() {
    if (this.stall?.timer) clearTimeout(this.stall.timer);
    this.stall = null;
  }
  /** The beats still to come won't (you moved, or the King struck): each not yet come waits for a later move. */
  private cancelStall() {
    if (this.stall?.timer) clearTimeout(this.stall.timer);
    if (this.stall) this.stall.timer = null;
  }
  /** The windows the clock stood still this move: the King's strike and the stall's beats. */
  private frozenWindows(): { at: number; until: number }[] {
    return [this.frozen, this.stall?.slam, this.stall?.fake].filter((w): w is { at: number; until: number } => !!w).sort((a, b) => a.at - b.at);
  }
  /** Time the clock stood still this move, up to `now`. */
  private frozenMs(now: number): number {
    return this.frozenWindows().reduce((t, w) => t + Math.max(0, Math.min(now, w.until) - w.at), 0);
  }
  private stallBeatOn(now: number): boolean {
    return [this.stall?.slam, this.stall?.fake].some((w) => !!w && now >= w.at && now < w.until);
  }
  private stallHolding(now: number): boolean {
    const f = this.stall?.fake;
    return !!f && now >= f.at && now < f.until;
  }
  /** The next beat, set for when the move's clock reaches it. */
  private armStall() {
    const st = this.stall;
    if (!st) return;
    const nb = nextBeat(st.plan, st);
    if (!nb) return;
    let at = this.playStartedAt + nb.at;
    for (const w of this.frozenWindows()) if (w.at < at) at += w.until - w.at;
    st.timer = setTimeout(() => this.stallBeat(nb.beat), Math.max(0, at - Date.now()));
  }
  private stallBeat(beat: "tap" | "slam" | "fake") {
    const phase = this.phase;
    const st = this.stall;
    if (this.stopped || phase.kind !== "play" || !st) return;
    st.timer = null;
    const now = Date.now();
    if (beat === "tap") {
      // (His clock tap: no pause, your clock runs; nothing more of his on this move.)
      st.tap = { at: now, until: now };
      this.runner.tapped();
      return this.set({ ...phase, stall: { beat, at: now, until: now } });
    }
    const ms = beat === "slam" ? DASH_STALL.slamMs : stallTimeline().total;
    st[beat] = { at: now, until: now + ms };
    this.progress.postpone(ms);
    if (this.live) for (const [id, t] of Object.entries(this.live.times)) if (this.live.startsAt + t > now) this.live.times[id] = t + ms;
    const deadline = phase.deadline + ms;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.submit(null), deadline - now + this.settings.lateGraceMs);
    if (beat === "slam") this.runner.slammed();
    else this.runner.stalled(st.plan.move!);
    this.set({ ...phase, deadline, stall: { beat, at: now, until: now + ms, ...(beat === "fake" ? { move: st.plan.move!, ...(st.slam ? {} : { alone: true }) } : {}) } });
    this.armStall();
  }

  /** The human's pick; final once made. */
  submit(move: string | null) {
    void this.score(move);
  }

  /** `darkOut`: Hollow's dark ended your turn at your last wrong try (no move: still your turn, MoveRecord.darkOut). */
  private async score(move: string | null, darkOut = false) {
    if (this.phase.kind !== "play") return;
    const { board, allowedMs: allowed } = this.phase;
    if (move !== null && Date.now() < this.playStartedAt - 300) return; // Before the clock starts.
    // Boss battle: only a move allowed this turn (a power's limits; the move the God King took back).
    if (move !== null && this.runner.boss && !(this.runner.crowdAllowed() ?? [move]).includes(move)) return;
    const now = Date.now();
    if (move !== null && this.frozen && now < this.frozen.until) return; // While the King strikes.
    if (move !== null && this.stallHolding(now)) return; // While Dash's fake move is on the board.
    // (Only now, the move accepted: a refused one leaves the turn's timeout running, so the turn still ends.)
    if (this.timer) clearTimeout(this.timer);
    const frozen = this.frozenMs(now);
    this.cancelStall();
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
    if (record) this.moves.push(darkOut && record.move === null && !record.abstained ? { ...record, darkOut: true } : record);
    // Crowd 50 v 50: your miss past CrowdMisses.allowed (the 4th in the game) removes you for being away, as resigning.
    if (report.away?.includes(HUMAN)) return this.removeAway();
    if (inFinal) return this.showFinalMove(report);
    if (this.alone && !mine.king && move !== null) {
      // Alone, your move is already on the board: no reveal, straight to the boss's reply. Only a Last Stand stops
      // the game (and the clock): it plays out, then you pick again. (Out of time, the reveal shows the move made.)
      if (!mine.lastStand) {
        const played = mine.result.playedMove;
        for (const c of crowdMoveCues(mine.fenBefore, played, mine.result.players.find((p) => p.move === played)?.loss ?? null)) if (kingSay(c.cue, c.key)) break;
        return this.afterReveal();
      }
      const standMs = lastStandMs() + 400;
      this.set({ kind: "reveal", mine, board, until: Date.now() + standMs });
      this.timer = setTimeout(() => this.afterReveal(), standMs);
      return;
    }
    // The God King's Last Stand plays out in the reveal; the next move's clock starts after it (nobody loses time).
    const revealMs = (this.settings.revealSeconds + this.settings.drawnMoveSeconds) * 1000 + (mine.king ? kingMoveMs(this.settings) : 0) + (mine.lastStand ? lastStandMs() : 0);
    this.moveChat(mine);
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
    this.moveChat(report.boards[0]!);
    this.set({ kind: "reveal", mine: report.boards[0]!, board, until: Date.now() + revealMs });
    this.timer = setTimeout(() => this.afterReveal(), revealMs);
  }

  /** A crowd move just played (a 50 v 50 with chat): a bot on the team that picked it may say it was a great one, as online. */
  private moveChat(b: RoundReport["boards"][number]) {
    const loss = b.result.players.find((p) => p.move === b.result.playedMove)?.loss;
    if (loss == null) return;
    const bots = b.playerIds.filter((id) => this.runner.player(id).isBot && this.runner.player(id).alive);
    this.lobbyChat.botsSay({ kind: "greatMove", loss }, bots);
    // (And now and then, after your team's move, a teammate's everyday line.)
    if (b.playerIds.includes(HUMAN)) this.lobbyChat.chatter(bots);
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
    // (The 50 v 50 rework: a game over on any move ends the match, before a cut due on that move: it cuts nobody.)
    if (this.runner.endGameIfOver()) return this.finish();
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

  /** The 50 v 50 rework (C3): out, you watch the game to its end once you've tapped the cut screen's Spectate. */
  private watchesToEnd(): boolean {
    return this.spectateAsked && this.settings.mode === "crowd" && !this.settings.raid && !!this.settings.crowdCuts?.length;
  }

  spectateAsked = false;
  /** The cut screen's Spectate, out: the break ends now and the game plays on before you. */
  spectate() {
    this.spectateAsked = true;
    this.continueFromBreak();
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
    this.setFinal({ playerId: p.playerId, move: b.result.playedMove, san: toSan(b.fenBefore, b.result.playedMove), loss: p.loss, ...(p.missNo ? { missNo: p.missNo } : {}) }, out);
    // (The final's last move: the finalists are placed as it's played, its view already taken, so the result is known (`decided`)
    // while the move is shown.)
    if (this.runner.stageComplete()) this.runner.finishFinal();
    this.set({ kind: "final", final: this.finalState! });
    this.timer = setTimeout(() => this.afterFinalMove(), out.length ? FINAL_SHOW_MS + 1800 : FINAL_SHOW_MS);
  }

  private afterFinalMove() {
    if (!this.runner.isOver() && this.runner.stageComplete()) this.runner.finishFinal();
    if (this.runner.isOver()) return this.finish();
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
          // (The Hidden Boss's child beaten: the bots play his adult form out too.)
          if (this.runner.nextBossForm()) continue;
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
          // (The hippo gardener's watering: his whole turn; the pass guard, or no engine answer: he moves.)
          if (this.runner.waterDue()) await this.runner.playWater(this.engines).catch(() => this.runner.applyWater(null));
          if (this.runner.hopDue()) await this.runner.playHop(this.engines).catch(() => this.runner.applyHop(null));
          // (Chandy's queen lock: his whole turn, unless the pass guard has it wait.)
          if (this.runner.queenLockDue()) await this.runner.playQueenLock(this.engines).catch(() => this.runner.applyQueenLock(null));
          if (this.runner.bossToMove()) await this.runner.playBoss(this.engines[0]);
          continue;
        }
        // (Dash's Scramble Rush with nobody watching: the bots' from the seed; Chandy's Dodge: the bots' votes.)
        if (this.runner.rushDue()) this.runner.finishRush({});
        while (this.runner.dodgeDue()) this.runner.finishDodgeRound({});
        if (this.runner.stageComplete()) continue;
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
      // (The 50 v 50 rework: its game over ends the match, ahead of any cut.)
      if (this.runner.endGameIfOver()) break;
      this.runner.deal();
      await this.runner.score(new Map());
      if (this.stopped) return;
      if (this.runner.endGameIfOver()) break;
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
    // (A tower floor: its result, kept until the server takes it.)
    if (this.tower) this.tower.done(floorOutcome(this.runner.boss?.result ?? "boss"), this.runner.boss?.crowdMoves ?? 0);
    this.lobbyChat.botsSay({ kind: "end" }, this.runner.state.players.filter((p) => p.isBot).map((p) => p.id));
    this.freeBrain();
    this.runner.showdownScout?.reset();
    // (The 50 v 50 rework, as online: each row's out at move and points a move: standings().)
    this.crowdRows = this.runner.crowdResults()?.players ?? null;
    this.set(this.results());
  }

  /** The result as the runner has it, once it has placed everyone (finish; `decided` before that, through any end moment). */
  private results(): Results {
    const winner = this.runner.state.players.find((p) => p.placement === 1);
    // (The 50 v 50 rework, as online: the podium's titles.)
    const rework = this.runner.crowdResults();
    return {
      kind: "results",
      placement: this.you.placement!,
      winner: winner?.name ?? "",
      youWon: this.you.placement === 1,
      ...(this.settings.mode === "crowd" ? { gameWinner: this.runner.gameWinner() } : {}),
      ...(rework ? { podium: rework.podium } : {}),
      ...(this.runner.boss?.result ? { bossResult: this.runner.boss.result } : {}),
      // (The bullet clock ran out: the Hidden Boss won on time.)
      ...(this.runner.bossTimedOut ? { timeout: true } : {}),
      ...(this.runner.bossCarrotWin ? { carrots: true } : {}),
      ...(this.runner.bossBlackout ? { blackout: true } : {}),
    };
  }
}

/**
 * Calls `fn` once, after the frame that draws what was just set is on screen (two animation frames on), or after `maxMs`
 * when no frames come (a hidden tab, or no page at all: the unit tests).
 */
function afterFirstFrame(fn: () => void, maxMs = 250) {
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    fn();
  };
  const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame : null;
  if (raf) raf(() => raf(go));
  setTimeout(go, raf ? maxMs : 0);
}
