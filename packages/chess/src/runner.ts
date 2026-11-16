import {
  alivePlayers,
  isTeamMatch,
  openingPlies,
  allowedMs,
  applyRound,
  startBanks,
  assignColours,
  assignGroups,
  botChoose,
  botLeanFor,
  botThinkMs,
  createMatch,
  drawRuleFor,
  endStage,
  finalComplete,
  finalMover,
  finishFinal,
  isFinal,
  keepBoards,
  outcomesFromGroup,
  scoreGroup,
  crowdBrilliant,
  streakCounts,
  type ScoreContext,
  bestOf,
  openingAllowance,
  OPENING_ALLOWANCE,
  type Allowance,
  type MaterialSlip,
  stageComplete,
  stagePlan,
  type GroupEvaluation,
  type GroupResult,
  type BossState,
  type MatchState,
  type PlayerState,
  type RetireReason,
  type BotLean,
  type Rng,
  hashPick,
  type Settings,
  type Side,
  estimateRating,
  standingPoints,
  standings,
  cutCount,
  cutPlan,
  bossElo,
  bossStrength,
  bossThreat,
  chooseBoss,
  crowdFinalBoss,
  rosterWithout,
  BOSS_POWERS,
  bossStumbleChance,
  bossStartPly,
  kingCharges,
  raidBossElo,
  bossKill,
  bossKillDue,
  finishBoss,
  matchLoss,
  teamFinalCutIn,
  teamFinalStep,
  finalToTheEnd,
  interleave,
  lastStandBar,
  lastStandDue,
  moveClockAt,
} from "@chessroyale/core";
import type { BoardSlot, NetBoard, NetBoss, NetFinal, NetStanding } from "./protocol.ts";
import { BOSS_OPENING, FREESTYLE_OPENING, boardEnd, boardStatus, freestyleBoard, newBoard, playOnBoard, recentMoves, type BoardState } from "./boards.ts";
import { freestyleStart } from "./chess960.ts";
import { pickOpenings, type Opening } from "./openings.ts";
import { START_FEN, applyMove, baseAt, gameEnd, legalMoves, materialSlips, moveNumber, sideToMove, toSan } from "./rules.ts";
import type { MoveScore } from "./uci.ts";
import { BOSS_BRAIN, BOSS_LEVEL, ENGINE_MAX_ELO, RECLUSE_CHILD, bossBrainFor, bossLevelBase, bossLevelNow, bossRatingShown, childRating, childStep, levelForMaia, type BossBrain, type BossBrainPlan, type BossForm } from "@chessroyale/core";
import { humanBrainMove, within, type BrainNote, type HumanEngineLike } from "./boss-brain.ts";
import {
  allowedSearch,
  boardAltered,
  bossAllowed,
  boardFlipped,
  crowdAllowed,
  icedSquares,
  initPowers,
  judgeCandidates,
  powerTurn,
  prepareTurn,
  rageOf,
  ragePaused,
  strikeRage,
  bossPowers,
  ablaze,
  bossRules,
  fireShadows,
  fireStage,
  judgeEvaluation,
  judgeMustScore,
  judgeOffers,
  judgeRanked,
  triggerUltimate,
  type LightsTally,
  darkSquares,
  bigboyBattle,
  boingoBattle,
  shownAngle,
  hollowBattle,
  blackedOut,
  type DarkTryResult,
  moveLoss,
  pigBattle,
  pigTurn,
  bulletClock,
  dashMoveClock,
  dashBattle,
  bulletIncrement,
  stopReason,
  alfilBattle,
  hopperBattle,
  carrotBattle,
  smudgyBattle,
  mooBattle,
  gardenerBattle,
  type WaterAsk,
  tigerBattle,
  hoopsAnswer,
  folioBattle,
  creasePick,
  type CreaseAsk,
  type JudgedMove,
  type BalloonAsk,
  type HoopsAsk,
  beamLines,
  bossRace,
  crowdRace,
  pullsOf,
  raceAfter,
  raceAdjust,
  raceWorth,
  landsAfterHisMove,
  slamAhead,
  topEach,
  type AlfilStep,
  type Battle,
  type BossAsks,
  type BossLastMove,
  type BossMoveExtras,
  type ShowdownScout,
  type CarrotRace,
} from "./boss-powers.ts";
import type { BossPowerSettings, BounceResult, CarrotPatch, LeapfrogHop, LightsOutTest, RepaintResult, WaterResult } from "@chessroyale/core";
import { MATE_TEST_MOVES, TopMovesCache, WIN_TEST_MOVES, bossGuardFrom, bossMoveFrom, netBoard, raceGuard, recheckCloseCalls, repliesFrom, type BossAhead, type BossMoveKind, type BossRace, type EngineLike, type LandingCheck, type RaceCheck } from "./runner-tools.ts";
// (The judge's re-check, the boss's guards and move, the boards' wire form: their own file, runner-tools.ts, so a page that
// needs only those, home, doesn't load the runner. Nov 10, phone load.)
export * from "./runner-tools.ts";

export interface Entrant {
  id: string;
  name: string;
  isBot: boolean;
  skill?: number | null;
  practice?: boolean;
}

export interface HumanPick {
  move: string | null;
  thinkMs: number;
  usedPowerUp?: boolean;
}

export interface BoardRound {
  /** Boss battle: the King played the move (the crowd called him), and how many called. */
  king?: boolean;
  /** Boss battle: nobody picked in time and the boss's rules played this move for the crowd (Dash's flag: BossRules.outOfTime). */
  flag?: boolean;
  kingCalls?: number;
  boardId: number;
  fenBefore: string;
  playerIds: string[];
  result: GroupResult;
  /** All moves scored this round, best first, with loss in points. */
  scored: { move: string; expected: number; loss: number }[];
  bestMove: string;
  /**
   * Boss battle: the God King's Last Stand. The crowd's move (`move`, the played move) gave away `loss` points,
   * over the bar of `bar`: he takes the blow, the move is taken back and the crowd picks again without it.
   * The round's scores stand.
   */
  lastStand?: LastStandRound;
  /**
   * Boss battle: a boss power touched this turn (a frozen piece, a pie, the blizzard, a flipped board), or the boss's
   * judge changed the engine's best move's score (Chub & Chirp's race): no fair-play signal.
   */
  power?: boolean;
  /**
   * Boss battle, a turn that counts where the boss's judge changed the numbers (Chub & Chirp's race, the engine's best
   * also the race's): the engine's own numbers, as `scored`, for fair play to record instead of the round's.
   */
  fairScored?: { move: string; expected: number; loss: number }[];
}

/**
 * The God King's Last Stand on a crowd move: the move he took back, what it gave away (`loss`, points of expected
 * score against the best move) over the bar it crossed, and, for the warning and the results card, the crowd's
 * chances (expected score, 0-1) after the best move (`before`) and after the blunder (`after`), the boss's best
 * reply to it (from the judge's own search) and a forced mate it allowed (`mateIn`, the boss's moves to mate).
 */
export interface LastStandRound {
  move: string;
  loss: number;
  bar: number;
  before?: number;
  after?: number;
  reply?: string;
  mateIn?: number;
}

/**
 * A board's numbers from the judge (as scoring takes them), plus, from the same searches, each move's best reply
 * and any forced mate in its line (moves, from the mover's side: negative when the mover gets mated).
 */
export type BoardEvaluation = GroupEvaluation & { replies?: Readonly<Record<string, string>>; mates?: Readonly<Record<string, number>> };

export interface RoundReport {
  stage: number;
  round: number;
  boards: BoardRound[];
  /** Boards replaced before this round was dealt, and why. */
  retired: { boardId: number; reason: RetireReason }[];
  /** Crowd 50 v 50: people this round's miss took past CrowdMisses.allowed (awayOut): the lobby or SoloMatch removes them. */
  away?: string[];
}

export interface RunnerSnapshot {
  state: MatchState;
  boards: (Omit<BoardState, "opening"> & { opening: string })[];
  groups: [number, string[]][];
  usedFamilies: string[];
  retired: { boardId: number; reason: RetireReason }[];
  /** Bots' thinking times for the round dealt (drawn at the deal, so screens can show bots finishing). */
  botThink?: [string, number][];
}

/**
 * Runs a match round by round: deal, collect picks, score with the engine, draw,
 * rotate. Used by the simulation (all bots) and the solo build (one human).
 * The engine is any object with `topMoves` and `scoreMoves`; several engines
 * can be passed to search boards in parallel.
 */
export class MatchRunner {
  state: MatchState;
  boards = new Map<number, BoardState>();
  /** Groups for the round currently dealt. */
  groups = new Map<number, string[]>();
  private retiredThisRound: { boardId: number; reason: RetireReason }[] = [];
  private usedFamilies = new Set<string>();
  private top: TopMovesCache;

  constructor(
    private readonly opts: {
      settings: Settings;
      rng: Rng;
      engines: readonly EngineLike[];
      library: readonly Opening[];
      entrants: readonly Entrant[];
      /** Boss raid: the side the crowd plays (White unless "b": a test switch, so the God King can be seen in black). */
      raidSide?: Side;
      /**
       * The clock for powers that run in real time (the hippo gardener's seeds), in ms: the lobby's (the server's time)
       * online, the page's visible time solo. Without one, a stand-in (Battle.now).
       */
      clock?: () => number;
    },
  ) {
    this.top = new TopMovesCache(opts.settings.botCandidateMoves);
    const plan = stagePlan(opts.settings);
    const boardCount = plan[0]?.boards ?? 1;
    const plies = openingPlies(opts.settings);
    // With colors per stage, half the boards have White to move and half Black (the opening one ply longer).
    const raidBlack = !!opts.settings.raid && opts.raidSide === "b";
    const blackBoards = raidBlack ? boardCount : opts.settings.colourPerStage && boardCount >= 2 ? Math.floor(boardCount / 2) : 0;
    const unusual = boardCount - blackBoards > 2 ? 1 : 0;
    const whiteOpenings = pickOpenings(opts.rng, opts.library, { classic: boardCount - blackBoards - unusual, unusual }, plies, opts.settings.openingBalance);
    const blackOpenings = pickOpenings(
      opts.rng,
      opts.library,
      { classic: blackBoards, unusual: 0 },
      plies + 1,
      opts.settings.openingBalance,
      new Set(whiteOpenings.map((o) => o.family)),
    );
    const openings = [...whiteOpenings.map((o) => [o, plies] as const), ...blackOpenings.map((o) => [o, plies + 1] as const)];
    if (openings.length < boardCount) throw new Error("Not enough openings in the library");
    openings.forEach(([o, n], i) => {
      this.boards.set(i, newBoard(i, o, n));
      this.usedFamilies.add(o.family);
    });
    this.state = createMatch(opts.entrants, openings.map((_, i) => i), opts.settings);
    // Crowd 50 v 50: a random half play White all match, the rest Black.
    this.state = assignColours(this.state, opts.rng, isTeamMatch(this.settings) ? Math.floor(this.alive().length / 2) : this.whiteSeats());
    if (this.settings.raid) this.startRaid();
    // (A start set before the match, the ?start= test switch: Random opening is the openings above; Freestyle here.)
    else this.setUpStart();
  }

  /**
   * Crowd 50 v 50's start (the pre-game vote "How does it start?"; docs/decisions/2026-10-24-opening-vote.md), set up
   * before move 1 on every board still at its start (the 50 v 50 has one, so everyone shares it). Normal: the starting
   * position; Random opening: a balanced named line from the library, `openingMoves` moves a side in, as Classic's boards
   * are drawn; Freestyle: a Chess960 start drawn from the match's own random source (never the usual one), in a base at
   * ply 0. A board already as asked is left alone (so Normal draws nothing), and once a move is played nothing changes.
   */
  private setUpStart() {
    if (!isTeamMatch(this.settings) || this.settings.raid || this.state.round > 0) return;
    const want = this.settings.crowdStart ?? "normal";
    const plies = openingPlies(this.settings);
    for (const id of this.state.boards) {
      const b = this.boards.get(id)!;
      if (b.history.length !== b.openingPlies) continue;
      const now = b.opening.id === FREESTYLE_OPENING.id ? "freestyle" : b.openingPlies > 0 ? "random" : "normal";
      if (now === want && (want === "freestyle" || b.openingPlies === plies)) continue;
      this.freshStart(id, b.generation);
    }
  }

  /** A board slot's fresh game from this match's start: Freestyle's own Chess960 start, else an opening from the library. */
  private freshStart(id: number, generation: number) {
    if (this.settings.crowdStart === "freestyle") {
      this.boards.set(id, freestyleBoard(id, freestyleStart(this.opts.rng).fen, generation));
      return;
    }
    const plies = openingPlies(this.settings);
    const [opening] = pickOpenings(this.opts.rng, this.opts.library, { classic: 1, unusual: 0 }, plies, this.settings.openingBalance, this.usedFamilies);
    const chosen = opening ?? this.opts.library.find((o) => o.expected[plies] !== undefined) ?? this.opts.library[0]!;
    this.usedFamilies.add(chosen.family);
    this.boards.set(id, newBoard(id, chosen, plies, generation));
  }

  /** Boss raid: the boss is there from the start, from the starting position; strikes stop at half the group; the King has every charge. */
  private startRaid() {
    const id = this.state.boards[0]!;
    const board = this.boards.get(id)!;
    const n = this.alive().length;
    this.bossLast = null;
    // Which boss: the one picked, else a random playable one (not the one to avoid). One draw from the match's random
    // source, which also seeds its powers.
    const seed = Math.floor(this.opts.rng() * 2 ** 32);
    // (Never a boss that's resting: a kill switch, rosterWithout.)
    const def = chooseBoss(seed / 2 ** 32, this.settings.bossId, this.settings.bossAvoid, rosterWithout(this.settings.bossesOff), this.settings.bossUnfinished, !!this.settings.bossHidden);
    let crowdSide = sideToMove(board.fen);
    // Every raid starts from the starting position, no opening moves (Eric, Oct 21: "Everything starts from the starting
    // position... the more I play it, the more it's a must"), but with `raidOpening` (tests that need a book position) only
    // a boss marked `fromStart`. The crowd keeps the side the usual pick gave it, so against a crowd that's Black the boss
    // moves first. A boss who always plays Black (Hollow): if the usual pick made the crowd Black, he claims the dark side
    // before move 1.
    const opening = bossRules(def)?.opening;
    const claimed = !!opening?.crowdWhite && crowdSide === "b" && !this.settings.bossMateTest && !this.settings.bossWinTest;
    if (!this.settings.raidOpening || opening?.fromStart) this.boards.set(id, newBoard(id, BOSS_OPENING, 0, board.generation));
    if (opening?.crowdWhite) crowdSide = "w";
    // Anything else the boss does to the board before move 1 (Big Boy eats one of the crowd's center pawns).
    let setUp = opening?.setUp?.(this.battle, { boardId: id, seed, crowdSide, generation: board.generation }) ?? null;
    // (Test switch: the crowd White, mated in one, the boss to move. Instead of any other set-up.)
    if (this.settings.bossMateTest) {
      this.boards.set(id, newBoard(id, { ...BOSS_OPENING, moves: [...MATE_TEST_MOVES] }, MATE_TEST_MOVES.length, board.generation));
      crowdSide = "w";
      setUp = null;
    }
    // (Test switch: the crowd White to move, mating in one. Instead of any other set-up.)
    if (this.settings.bossWinTest) {
      this.boards.set(id, newBoard(id, { ...BOSS_OPENING, moves: [...WIN_TEST_MOVES] }, WIN_TEST_MOVES.length, board.generation));
      crowdSide = "w";
      setUp = null;
    }
    const fen = this.boards.get(id)!.fen;
    this.state = {
      ...this.state,
      players: this.state.players.map((p) => ({ ...p, colour: null, powerUps: 0 })),
      boss: {
        id: def.id,
        ...this.firstForm(def.id),
        powers: { ...initPowers(seed, fen, crowdSide), ...(claimed ? { claimed: true } : {}), ...(setUp ?? {}) },
        tier: this.settings.bossFixedElo || raidBossElo([]),
        elo: bossStrength(this.settings.bossFixedElo || raidBossElo([]), def, this.settings.bossDifficulty),
        crowdSide,
        startPly: this.boards.get(id)!.history.length,
        crowdMoves: 0,
        sinceKill: 0,
        kills: [],
        kingCharges: this.settings.kingChargesMax,
        kingMoves: [],
        kingStrikes: [],
        minSurvivors: Math.ceil(n / 2),
      },
    };
    this.preparePowers();
  }

  /**
   * Boss battle: the powers for the crowd turn about to begin (once per turn; see prepareTurn). None once the board's
   * game is over, but for his fifth carrot's moments (the pull and his win) when the same move stalemates or mates: they
   * play before the result, as after any fifth carrot.
   */
  private preparePowers() {
    const b = this.state.boss;
    if (!b?.powers || (this.finalGameOver() && !carrotBattle.won(b))) return;
    const board = this.boards.get(this.state.boards[0]!)!;
    if (sideToMove(board.fen) !== b.crowdSide) return;
    // (The boss's move just played: Hollow covers its piece's square after his first.)
    const next = prepareTurn(b, board.fen, this.settings.bossPowerTest, BOSS_POWERS, board.lastMove);
    this.state = { ...this.state, boss: next };
    // (A new turn set up: the boss's own match effect, once a turn: the Hidden Boss's bullet clock sets every bank.)
    if (next.powers?.turn !== b.powers.turn) bossRules(next)?.turnBegun?.(this.battle);
  }

  /** Boss battle, Hollow's dark: the squares covered this turn (their pieces hidden; a move touching one goes unchecked). */
  darkSquares(): string[] {
    return darkSquares(this.state.boss);
  }

  /** Hollow's dark: a move attempt that touches a dark square, sent unchecked (see hollowBattle.darkTry). */
  darkTry(playerId: string, move: string): DarkTryResult {
    return hollowBattle.darkTry(this.battle, playerId, move);
  }

  /** Hollow in Boss alone: the dark is to play your move this turn (a 3rd or 7th bulb out), not yet picked. */
  darkForcedDue(): boolean {
    return hollowBattle.darkForcedDue(this.battle);
  }

  /** The dark's move for you (a bad one: darkForcedMoveFrom), from this device's engine: the turn's only move from now. */
  async playDarkForced(engine: EngineLike = this.opts.engines[0]!): Promise<string> {
    return hollowBattle.playDarkForced(this.battle, engine);
  }

  /** Sets the dark's move for you (an engine's answer; see hollowBattle.applyDarkForced). */
  applyDarkForced(move: string): string {
    return hollowBattle.applyDarkForced(this.battle, move);
  }

  /** The battle was Hollow's by his last bulb (Boss alone): for the result screen (the results' `blackout`). */
  get bossBlackout(): boolean {
    return blackedOut(this.state.boss);
  }

  /** Hollow's dark: each player's wrong attempts into the dark this round. */
  darkTries(): Record<string, number> {
    return hollowBattle.darkTries(this.battle);
  }

  /** Boss battle, G-REX's fire: the tiles ablaze this crowd turn (a crowd piece left on one burns after the move). */
  fireBurn(): string[] {
    return this.state.boss ? ablaze(this.state.boss) : [];
  }

  /** Boss battle: the moves the crowd may play this turn (a power's limits, the Last Stand's barred move); null: any. */
  crowdAllowed(boardId = this.state.boards[0]!): string[] | null {
    const b = this.state.boss;
    if (!b) return null;
    return crowdAllowed(b, this.boards.get(boardId)!.fen);
  }

  /** Side to move on each board in play. */
  boardSides(): Map<number, Side> {
    return new Map(this.state.boards.map((id) => [id, sideToMove(this.boards.get(id)!.fen)]));
  }

  /** How many players play White this stage: half (null when colors aren't fixed: one board left, or the final). */
  private whiteSeats(): number | null {
    if (!this.settings.colourPerStage || this.state.boards.length < 2 || this.state.final) return null;
    return Math.floor(this.alive().length / 2);
  }

  get settings() {
    return this.opts.settings;
  }

  /** Crowd augments: the move clock for the rounds from now on (a fixed one: it replaces a rising schedule). */
  setMoveClock(seconds: number): void {
    this.opts.settings = { ...this.opts.settings, moveClockSeconds: seconds, moveClockSteps: [] };
  }

  /**
   * The move number this round's clock goes by: the top bar's "Move N" on the board in play (the team final and the
   * duel play on the same board, so they carry on counting). A boss battle rewinds the board to an earlier position
   * of the game, but not the clock: its moves count on from the move the game had reached.
   */
  clockMove(boardId?: number): number {
    const b = this.state.boss;
    if (b?.clockFromMove !== undefined) return b.clockFromMove + b.crowdMoves;
    const board = this.boards.get(boardId ?? this.state.boards[0]!);
    return board ? moveNumber(board.fen) : 1;
  }

  /** This round's move clock in seconds (see moveClockAt): the same everywhere a clock is set. */
  moveClock(boardId?: number): number {
    // (Dash's clock: a scrambled move's seconds, a slapped move's shorter clock on a raid's timer: dashMoveClock.)
    return dashMoveClock(this.state.boss, moveClockAt(this.settings, this.clockMove(boardId)));
  }

  /**
   * How long a player may think this round: their bank plus the increment, capped by this move's clock. On the bullet
   * clock (the Hidden Boss's ultimate), no per-move cap: the bank, plus its increment once he has added one.
   */
  allowedMsFor(playerId: string): number {
    const board = [...this.groups].find(([, ids]) => ids.includes(playerId))?.[0];
    return allowedMs(this.player(playerId), this.roundSettings(board), this.clockMove(board));
  }

  /**
   * The settings with this round's clock fixed in moveClockSeconds (for the bots' timing and capping think times). On the
   * bullet clock: its own increment (none for its first moves, then BOSS_POWERS.bulletIncrementSeconds: bulletIncrement),
   * and a cap no bank can reach (the bullet bank plus the increment on every move a battle can have), so the bank decides.
   */
  private roundSettings(boardId?: number): Settings {
    if (!bulletClock(this.state.boss)) return { ...this.settings, moveClockSeconds: this.moveClock(boardId), moveClockSteps: [] };
    return {
      ...this.settings,
      moveClockSeconds: BOSS_POWERS.bulletBankSeconds + BOSS_POWERS.bulletIncrementSeconds * this.settings.bossMaxMoves,
      moveClockSteps: [],
      timeIncrementSeconds: bulletIncrement(this.state.boss),
    };
  }

  /**
   * A Boss Battle party's one team clock (BOSS_CLOCK): every member's bank set to the team's, so each one's allowed time
   * and bossOutOfTime read the team's. The lobby works it out from the turn's length (the time until it resolved).
   */
  setTeamBank(ms: number): void {
    this.state = { ...this.state, players: this.state.players.map((p) => (p.alive ? { ...p, bankMs: Math.max(0, Math.round(ms)) } : p)) };
  }

  /** The team's bank now (a party): the first member still in's. */
  teamBankMs(): number {
    return this.alive()[0]?.bankMs ?? 0;
  }

  /**
   * The battle's bank has run out: under the Hidden Boss's bullet clock (his ultimate), or on Boss Battle's own clock
   * (`bossClock`, BOSS_CLOCK: 10 + 10), nobody still in the battle has any time left in their bank. The battle is lost on
   * time (finishBossBattle).
   */
  bossOutOfTime(): boolean {
    if (!this.state.boss || (!bulletClock(this.state.boss) && !this.settings.bossClock)) return false;
    // (Against a boss with noTimeLoss, Dash, an empty bank isn't a loss: a move nobody picked in time is played for the crowd.)
    if (bossRules(this.state.boss)?.noTimeLoss) return false;
    const alive = this.alive();
    return alive.length > 0 && alive.every((p) => p.bankMs <= 0);
  }

  /**
   * Pre-game votes: settings from the winning options (how it ends, the clock) for the rest of the match. A time
   * control (the clock vote) also sets the bank everyone starts with, as long as no move has been played.
   */
  patchSettings(patch: Partial<Settings>): void {
    this.opts.settings = { ...this.opts.settings, ...patch };
    if (patch.timeBankSeconds !== undefined) this.state = startBanks(this.state, this.settings);
    // (The start vote: the board set up afresh from the start that won, before move 1.)
    if (patch.crowdStart !== undefined) this.setUpStart();
  }

  private replaceBoard(id: number): void {
    const old = this.boards.get(id)!;
    // (Freestyle: a new game from another Chess960 start.)
    if (this.settings.crowdStart === "freestyle" && isTeamMatch(this.settings)) return this.freshStart(id, old.generation + 1);
    const side = sideToMove(old.fen);
    const plies = side === "w" ? openingPlies(this.settings) : openingPlies(this.settings) + 1;
    const [opening] = pickOpenings(
      this.opts.rng,
      this.opts.library,
      { classic: 1, unusual: 0 },
      plies,
      this.settings.openingBalance,
      this.usedFamilies,
    );
    const fallback = this.opts.library.find((o) => o.expected[plies] !== undefined && !this.usedFamilies.has(o.family));
    const chosen = opening ?? fallback ?? this.opts.library[0]!;
    this.usedFamilies.add(chosen.family);
    this.boards.set(id, newBoard(id, chosen, plies, old.generation + 1));
  }

  /**
   * Groups the players for the next round. Boards are never swapped: a board
   * whose game has ended leaves play (its players spread over the others until
   * the cut), unless it's the last board, which then gets a fresh opening.
   * In the final, the "group" is the finalist whose turn it is.
   */
  /** Boss battle: humans who called the King this move (set by the screens or the lobby server before scoring). */
  kingCallers = new Set<string>();
  /** Boss battle: humans who called for the King's strike this move. */
  kingStrikers = new Set<string>();
  /** Boss battle: how many bots back a strike this move (drawn when a human first calls for one). */
  private strikeBots: number | null = null;

  deal(): Map<number, string[]> {
    this.retiredThisRound = [];
    this.kingCallers = new Set();
    this.kingStrikers = new Set();
    this.strikeBots = null;
    this.planned = new Map();
    this.planning = null;
    const over = this.state.boards.filter((id) => boardStatus(this.boards.get(id)!).gameOver);
    if (over.length) {
      const live = this.state.boards.filter((id) => !over.includes(id));
      for (const id of over) this.retiredThisRound.push({ boardId: id, reason: "game_over" });
      if (live.length) this.state = { ...this.state, boards: live };
      else {
        this.replaceBoard(over[0]!);
        this.state = { ...this.state, boards: [over[0]!] };
        this.retiredThisRound = [{ boardId: over[0]!, reason: "replaced" }];
      }
    }
    if (this.state.boss) {
      // Boss battle: everyone left picks the crowd's move together (call playBoss first when it's the boss's turn).
      this.groups = new Map([[this.state.boards[0]!, this.alive().map((p) => p.id)]]);
    } else if (this.state.final) {
      this.groups = new Map([[this.state.boards[0]!, [finalMover(this.state.final)]]]);
    } else if (isTeamMatch(this.settings)) {
      // Crowd 50 v 50: the team whose side is to move picks; the other team watches.
      const board = this.state.boards[0]!;
      const side = sideToMove(this.boards.get(board)!.fen);
      this.groups = new Map([[board, this.alive().filter((p) => p.colour === side).map((p) => p.id)]]);
    } else {
      this.groups = assignGroups(this.opts.rng, this.state, this.settings, undefined, this.boardSides());
    }
    // Bots' thinking times are drawn now, so a screen can show each bot finishing at its moment.
    const picking = new Set([...this.groups.values()].flat());
    const round = this.roundSettings();
    this.botThink = new Map(
      this.alive()
        .filter((p) => p.isBot && picking.has(p.id))
        .map((p) => [p.id, Math.min(botThinkMs(this.opts.rng, round), allowedMs(p, round))]),
    );
    return this.groups;
  }

  /** Each bot's thinking time this round (ms after the round starts). */
  botThinkTimes(): Record<string, number> {
    return Object.fromEntries(this.botThink);
  }

  /** Starts this round's top-move searches now, so scoring after the picks lock is quick. */
  prefetch(): void {
    this.top.prefetch(this.opts.engines, [...this.groups.keys()].map((id) => this.boards.get(id)!.fen));
  }

  /** The engine's own top moves in a position (the same cached search as topMovesFor's), no boss rule applied. */
  engineTop(fen: string): Promise<MoveScore[]> {
    return this.top.get(this.opts.engines[0]!, fen);
  }

  /**
   * The engine's top moves in a position (shared with scoring, so a prefetched search is reused). Boss battle, the
   * crowd's turn: only the moves allowed this turn (a power's limits; the Last Stand's barred move), as the judge
   * sees them, so a power-up's hints and the eval bar follow the crowd's rules too (but for Chub & Chirp's race, where
   * solo's bar reads engineTop).
   */
  async topMovesFor(fen: string): Promise<MoveScore[]> {
    const engine = this.opts.engines[0]!;
    const all = await this.engineTop(fen);
    const id = this.state.boards[0];
    const crowdTurn = !!this.state.boss && id !== undefined && this.boards.get(id)?.fen === fen;
    const allowed = crowdTurn ? (this.crowdAllowed(id) ?? undefined) : undefined;
    // (The boss's rules for the judge, e.g. G-REX's fire: a piece left on a tile ablaze counts as gone, and the moves
    // that save it are always looked at.)
    const boss = crowdTurn ? this.state.boss : null;
    const escapes = judgeMustScore(boss, fen).filter((m) => !all.some((x) => x.move === m) && (!allowed || allowed.includes(m)));
    const withEscapes = escapes.length ? [...all, ...(await engine.scoreMoves(fen, escapes))] : all;
    if (!allowed) return judgeRanked(boss, withEscapes, fen).slice(0, Math.max(all.length, 1));
    const top = judgeCandidates({ allowed }, withEscapes, (await allowedSearch(engine, { fen, allowed }, withEscapes)) ?? []);
    return judgeRanked(boss, top.length ? top : all, fen);
  }

  /**
   * Stockfish's own best move at full strength (the admins' Engine move, Eric, Nov 2): one search of one line with no strength
   * limit, at `nodes`, over the moves the crowd may play this turn (a power's limits, as the judge sees them). The judge's
   * engine, so it waits for Stockfish while it's paused or busy; never Maia (the boss's brain), never a boss's re-ranking.
   * Null: no move.
   */
  async engineBest(fen: string, nodes: number): Promise<string | null> {
    const engine = this.opts.engines[0]!;
    const id = this.state.boards[0];
    const crowdTurn = !!this.state.boss && id !== undefined && this.boards.get(id)?.fen === fen;
    const allowed = crowdTurn ? (this.crowdAllowed(id) ?? undefined) : undefined;
    if (allowed && !allowed.length) return null;
    const top = engine.topMovesAt ? await engine.topMovesAt(fen, 1, nodes, allowed) : allowed ? await engine.scoreMoves(fen, allowed) : await engine.topMoves(fen, 1);
    const best = [...top].sort((a, b) => b.expected - a.expected)[0]?.move;
    return best && (!allowed || allowed.includes(best)) ? best : null;
  }

  boardOf(playerId: string): BoardState | null {
    for (const [b, ids] of this.groups) if (ids.includes(playerId)) return this.boards.get(b)!;
    return null;
  }

  player(id: string): PlayerState {
    return this.state.players.find((p) => p.id === id)!;
  }

  /**
   * Scores the round once every human pick is locked: one engine search per
   * board, bot picks from that search, then the draw. Boards are searched in
   * parallel across the engines.
   */
  async score(humanPicks: ReadonlyMap<string, HumanPick>): Promise<RoundReport> {
    const scored = await this.evaluate(humanPicks);
    return this.finishRound(scored.results, scored.thinkMs, scored.powerUps);
  }

  /**
   * The engine work of `score` without applying it: every board scored and its
   * move drawn, but scores and boards unchanged until `finishRound` (so a
   * screen can wait for everyone to finish before showing results).
   */
  async evaluate(
    humanPicks: ReadonlyMap<string, HumanPick>,
  ): Promise<{ results: BoardRound[]; thinkMs: Record<string, number>; powerUps: Set<string> }> {
    const { rng } = this.opts;
    if (this.planning) await this.planning;
    const entries = [...this.groups.entries()];
    const results: BoardRound[] = new Array(entries.length);
    let next = 0;
    await Promise.all(
      this.opts.engines.map(async (engine) => {
        while (next < entries.length) {
          const i = next++;
          const [boardId, playerIds] = entries[i]!;
          results[i] = await this.scoreBoard(engine, boardId, playerIds, humanPicks, rng);
        }
      }),
    );
    const thinkMs: Record<string, number> = {};
    const powerUps = new Set<string>();
    for (const [id, p] of humanPicks) {
      thinkMs[id] = p.thinkMs;
      if (p.usedPowerUp) powerUps.add(id);
    }
    return { results, thinkMs, powerUps };
  }

  private botThink = new Map<string, number>();
  private botPowerUps = new Set<string>();
  /** Bot picks decided early this round (so a screen can show them live as each bot finishes). */
  private planned = new Map<string, string>();
  /** Crowd 50 v 50: this turn's lean for the team's bots (botLean), by stage, round, board and position. */
  private lean: { key: string; lean: BotLean } | null = null;
  private planning: Promise<unknown> | null = null;

  /**
   * Decides every bot's pick for this round now, from the engine's top moves,
   * instead of at scoring time. Scoring then uses these picks.
   */
  planBotPicks(): Promise<ReadonlyMap<string, string>> {
    const groups = [...this.groups.entries()];
    const run = (async () => {
      for (const [boardId, ids] of groups) {
        const fen = this.boards.get(boardId)!.fen;
        const all = await this.topMovesFor(fen);
        // Boss battle: a power left none of the top moves open: the bots pick from a search over the allowed ones.
        const allowed = this.crowdAllowed(boardId) ?? undefined;
        const open = await allowedSearch(this.opts.engines[0]!, { fen, allowed }, all);
        const top = judgeCandidates({ allowed }, all, open ?? []);
        if (this.groups.get(boardId) !== ids) return this.planned; // a new round has been dealt meanwhile
        for (const [id, move] of Object.entries(this.botPicksFor(boardId, ids, top))) this.planned.set(id, move);
      }
      return this.planned;
    })();
    this.planning = run;
    return run;
  }

  /** Picks for every player on a board: humans as given, bots from the engine's top moves. */
  botPicksFor(boardId: number, playerIds: readonly string[], top: readonly MoveScore[]): Record<string, string> {
    const board = this.boards.get(boardId)!;
    // Boss battle: only the moves allowed this turn (a power's limits; the move the God King took back is off the table).
    const allowed = this.crowdAllowed(boardId);
    const legal = allowed ?? legalMoves(board.fen);
    // (The boss's rules for the judge, e.g. G-REX's fire: the bots see a piece left on a tile ablaze as gone.)
    const open = judgeRanked(this.state.boss, allowed ? judgeCandidates({ allowed }, top) : [...top], board.fen);
    const best = open[0]?.expected ?? top[0]!.expected;
    const candidates = open.map((m) => ({ move: m.move, loss: Math.max(0, (best - m.expected) * 100) }));
    // Crowd 50 v 50: the team's lean this turn, drawn once (the plan and the scoring share it).
    const leanKey = `${this.state.stage}:${this.state.round}:${boardId}:${board.fen}`;
    if (this.lean?.key !== leanKey) {
      const lean = botLeanFor(this.opts.rng, candidates, this.settings);
      this.lean = lean ? { key: leanKey, lean } : null;
    }
    const lean = this.lean?.lean;
    const out: Record<string, string> = {};
    for (const id of playerIds) {
      const p = this.player(id);
      if (!p.isBot) continue;
      const plannedMove = this.planned.get(id);
      if (plannedMove) {
        out[id] = plannedMove;
        continue;
      }
      if (!this.botThink.has(id)) this.botThink.set(id, botThinkMs(this.opts.rng, this.roundSettings()));
      const choice = botChoose(this.opts.rng, candidates, p, legal, this.settings, lean);
      if (choice.usedPowerUp) this.botPowerUps.add(id);
      out[id] = choice.move;
    }
    return out;
  }

  private async scoreBoard(
    engine: EngineLike,
    boardId: number,
    playerIds: string[],
    humanPicks: ReadonlyMap<string, HumanPick>,
    rng: Rng,
  ): Promise<BoardRound> {
    void rng;
    const board = this.boards.get(boardId)!;
    // Boss battle: the judge plays by the crowd's rules. Only the moves allowed this turn count (a power's limits; the
    // move the God King took back), so the best is the best of those; with none of them among the top moves, one
    // search covers them all.
    const allowed = this.crowdAllowed(boardId) ?? undefined;
    const all = await this.top.get(engine, board.fen);
    const humans = playerIds.flatMap((id) => (this.player(id).isBot ? [] : [humanPicks.get(id)?.move ?? null])).filter((m): m is string => !!m && (!allowed || allowed.includes(m)));
    const open = await allowedSearch(engine, { fen: board.fen, allowed, picks: humans }, all);
    const top = judgeCandidates({ allowed }, all, open ?? []);
    // (The boss's rules may offer the bots more moves, scored first: Chub & Chirp's race, the moves that pull a carrot.)
    const offers = judgeOffers(this.state.boss, board.fen).filter((m) => (!allowed || allowed.includes(m)) && !top.some((t) => t.move === m));
    const offered = offers.length ? await engine.scoreMoves(board.fen, offers) : [];
    const botPicks = this.botPicksFor(boardId, playerIds, [...top, ...offered]);
    const picks: Record<string, string | null> = {};
    for (const id of playerIds) picks[id] = this.player(id).isBot ? botPicks[id]! : (humanPicks.get(id)?.move ?? null);
    const known = new Map(top.map((m) => [m.move, m.expected]));
    for (const m of open ?? []) known.set(m.move, m.expected);
    for (const m of offered) known.set(m.move, m.expected);
    // (The boss's rules for the judge, e.g. G-REX's fire: every move that takes a piece off a tile ablaze is scored too.)
    const escapes = judgeMustScore(this.state.boss, board.fen).filter((m) => !allowed || allowed.includes(m));
    const missing = [...new Set([...Object.values(picks), ...escapes].flatMap((m) => (m && !known.has(m) ? [m] : [])))];
    const extra = [...(open ?? []), ...offered, ...(missing.length ? await engine.scoreMoves(board.fen, missing) : [])];
    for (const m of extra) known.set(m.move, m.expected);
    // Close calls are re-checked where a person is playing (a group of bots affects nobody real).
    const people = playerIds.some((id) => !this.player(id).isBot && humanPicks.get(id)?.move);
    const evaluation = { bestMove: top[0]!.move, bestExpected: top[0]!.expected, expectedAfter: Object.fromEntries(known) };
    const checked = people ? await recheckCloseCalls(engine, board.fen, evaluation, Object.values(picks), this.settings) : evaluation;
    return this.resolveBoard(boardId, playerIds, picks, {
      bestMove: checked.bestMove,
      bestExpected: checked.bestExpected,
      expectedAfter: checked.expectedAfter,
      // (Kept from the same searches, for the God King's Last Stand: what a blunder loses. No extra engine time.)
      ...repliesFrom([top, extra]),
    });
  }

  /**
   * Scores one board from evaluations and picks (bots included), and draws the
   * move to play. The lobby server calls this with evaluations from the host.
   */
  resolveBoard(
    boardId: number,
    playerIds: readonly string[],
    rawPicks: Readonly<Record<string, string | null>>,
    rawEvaluation: BoardEvaluation,
  ): BoardRound {
    const board = this.boards.get(boardId)!;
    const limited = this.withoutBarred(rawPicks, rawEvaluation, boardId);
    const picks = limited.picks;
    // The boss's rules for the judge, e.g. G-REX's fire: a piece left on a tile ablaze counts as already gone (every
    // path's numbers come in raw). Then the best move is the highest-scored of the judge's best and the picks (bestOf:
    // after any re-check, which weighed a pick above the first line against it like for like), on every path.
    const pickList = playerIds.map((id) => picks[id] ?? null);
    const judged = judgeEvaluation(this.state.boss, limited.evaluation, board.fen);
    const evaluation = bestOf(judged, pickList);
    // Boss battle: humans who called the King instead of picking abstain: no score, not a miss.
    const abstained = new Set(this.state.boss ? playerIds.filter((id) => !picks[id] && !this.player(id).isBot && this.kingCallers.has(id)) : []);
    const result = scoreGroup(
      playerIds.filter((id) => !abstained.has(id)).map((id) => ({ playerId: id, move: picks[id] ?? null })),
      evaluation,
      this.opts.rng,
      // (A boss battle keeps the most popular pick: crowdPlayedFromTop is 50 v 50's.)
      this.state.boss ? { ...this.settings, crowdPlayedFromTop: 1 } : this.settings,
      drawRuleFor(this.state.stage, this.settings),
      this.allowanceFor(board.fen, evaluation.bestMove, pickList),
      this.scoreContext(board),
    );
    // Every scored move, best first, with its loss in points from the highest of the best and the picks (as moveLosses).
    const scoredFrom = (e: BoardEvaluation) => {
      const high = Math.max(e.bestExpected, ...pickList.flatMap((m) => (m && e.expectedAfter[m] !== undefined ? [e.expectedAfter[m]!] : [])));
      const list = Object.entries(e.expectedAfter)
        .map(([move, expected]) => ({ move, expected, loss: Math.max(0, (high - expected) * 100) }))
        .sort((a, b) => b.expected - a.expected);
      return { high, list };
    };
    const { high: best, list: scored } = scoredFrom(evaluation);
    this.missesOn(board.fen, result, scored);
    for (const id of abstained) result.players.push({ playerId: id, move: null, loss: null, roundScore: 0, abstained: true });
    // The boss's own costs on the round (Hollow's wrong attempts into the dark).
    if (this.state.boss) bossRules(this.state.boss)?.scoreRound?.(this.battle, result.players);
    const king = this.kingDecision(playerIds, result);
    if (king.plays) result.playedMove = evaluation.bestMove;
    // Nobody picked in time: a boss's rules may play another move for the crowd than the engine's best (Dash's flag: one of the
    // judge's top moves at random). The lobby resolves its rounds here too, so solo and online agree.
    const flag = this.state.boss && !king.plays && !pickList.some((m) => m) ? (bossRules(this.state.boss)?.outOfTime?.(this.state.boss, board.fen, this.crowdAllowed(boardId) ?? legalMoves(board.fen), scored.map((m) => m.move)) ?? null) : null;
    if (flag) result.playedMove = flag;
    const lastStand = king.plays ? undefined : this.lastStandFor(board.fen, result.playedMove, best, scored, rawEvaluation);
    // Fair play where the boss's judge changed the numbers (Chub & Chirp's race): the turn counts only when the engine's
    // best keeps its own score, i.e. it is the race's best too (the race keeps only the race's best's score, and raises
    // none above 0.1%: below that the logit's clamp can lift one, by under 0.001). Fair play then records the engine's own
    // numbers (`fairScored`), as on a turn without the race: each move's loss is at most the round's, or within 0.1 point
    // of it for a move already lost (expected under 0.1%). Any other such turn doesn't count (`power`): there the engine's numbers can charge a
    // carrot move more than the game does, and the race's read differently from any engine's (another best, other finds,
    // only moves, decided).
    const power = powerTurn(this.state.boss);
    let fairScored: BoardRound["fairScored"];
    let raceOff = false;
    if (!power && judged !== limited.evaluation) {
      const raw = scoredFrom(bestOf(limited.evaluation, pickList)).list;
      if (raw[0] && evaluation.expectedAfter[raw[0].move] === raw[0].expected) fairScored = raw;
      else raceOff = true;
    }
    return {
      boardId,
      fenBefore: board.fen,
      playerIds: [...playerIds],
      result,
      scored,
      bestMove: evaluation.bestMove,
      ...(this.state.boss ? { king: king.plays, kingCalls: king.calls } : {}),
      ...(lastStand ? { lastStand } : {}),
      ...(power || raceOff ? { power: true } : {}),
      ...(fairScored ? { fairScored } : {}),
      ...(flag ? { flag: true } : {}),
    };
  }

  /**
   * Crowd 50 v 50's misses (CrowdMisses): each miss gets a pick made for it, one of the engine's top `defaultFromTop`
   * moves (the judge's best first) picked by the position and the player, not the match's random source, so a miss moves
   * nothing drawn after it; shown to them only (`move` stays null: never in the tally). Its number in the game too. Nobody
   * in a team turn picked: the team plays one of those moves at random (a final's mover and a boss battle as before).
   */
  private missesOn(fen: string, result: GroupResult, scored: readonly { move: string }[]) {
    const cm = this.settings.crowdMisses;
    if (!cm) return;
    const top = scored.slice(0, cm.defaultFromTop).map((m) => m.move);
    if (!top.length) return;
    for (const p of result.players) {
      if (p.move !== null || p.abstained) continue;
      p.defaultMove = top[hashPick(`${fen}|${p.playerId}`, top.length)]!;
      p.missNo = (this.player(p.playerId).misses ?? 0) + 1;
    }
    if (!this.state.boss && !this.state.final && !result.players.some((p) => p.move !== null)) result.playedMove = top[Math.floor(this.opts.rng() * top.length)]!;
  }

  /**
   * Crowd 50 v 50: the people with more misses in the game than CrowdMisses allows (the 4th), still in: removed for being
   * away (the lobby and SoloMatch take them out as "left the match", LeftHow "afk"). Bots never: they always pick.
   */
  awayOut(): string[] {
    const cm = this.settings.crowdMisses;
    if (!cm) return [];
    return this.state.players.filter((p) => p.alive && !p.isBot && (p.misses ?? 0) > cm.allowed).map((p) => p.id);
  }

  /**
   * The opening allowance on a board's position, for each picked move (OPENING_ALLOWANCE, on the game's own move number:
   * the position's fullmove number). A pick that gives up material against the best move by the exchange check gets
   * none (`materialSlips`, run on the distinct picks only, and only while there's an allowance). Crowd 50 v 50 also
   * marks, all game, a pick that gives up a piece (`uncap`: CrowdScoring.uncapPawns), which the cap doesn't cover.
   * Undefined once it's nothing.
   */
  private allowanceFor(fen: string, best: string, picks: readonly (string | null)[]): ((move: string) => Allowance) | undefined {
    const points = openingAllowance(moveNumber(fen));
    // (Crowd 50 v 50's scoring needs the exchange check all game: a pick that gives up material isn't capped.)
    if (points <= 0 && !this.settings.crowdScoring) return undefined;
    const moves = picks.flatMap((m) => (m ? [m] : []));
    const slips = points > 0 ? materialSlips(fen, best, moves, OPENING_ALLOWANCE.materialPawns) : new Map<string, MaterialSlip>();
    const cs = this.settings.crowdScoring;
    const pieces = cs ? materialSlips(fen, best, moves, cs.uncapPawns) : new Map<string, MaterialSlip>();
    return (m) => {
      const material = slips.get(m);
      const uncap = pieces.get(m);
      return { points: material ? 0 : points, ...(material ? { material } : {}), ...(uncap ? { uncap } : {}) };
    };
  }

  /**
   * Crowd 50 v 50's and a raid's scoring on a board's move (settings.crowdScoring): the stage (its cap; a boss battle's
   * crowd move too, by which a raid's cap widens), whether streaks count (from
   * the first picked move: the game's move number less the opening the board was dealt, so Random opening's move 5 is
   * the first) and each player's streak so far. Undefined in every other mode.
   */
  private scoreContext(board: BoardState): ScoreContext | undefined {
    const cs = this.settings.crowdScoring;
    if (!cs) return undefined;
    const picked = moveNumber(board.fen) - Math.floor(board.openingPlies / 2);
    // (A raid's cap widens by the crowd's move, this one 1 up: RAID_SCORING's capFromMove.)
    const move = this.state.boss ? this.state.boss.crowdMoves + 1 : undefined;
    return { stage: this.state.stage, ...(move !== undefined ? { move } : {}), streaks: streakCounts(cs, this.settings.crowdStart, picked, this.state.stage), streakOf: (id) => this.player(id).streak ?? 0 };
  }

  /** Test switch (?shoutout=1 in solo): the next round's people who picked get a brilliant find's bonus and shoutout. */
  forceShoutout = false;

  /**
   * Test switch (?streaks=1 in solo): every player starts on a streak, 3 to 9 in a row by seat (the first seat 3), so
   * the scoreboard shows every tier of the fire. Streaks don't count until the streak rule's first move, so they hold.
   */
  testStreaks(): void {
    this.state = { ...this.state, players: this.state.players.map((p, i) => ({ ...p, streak: 3 + (i % 7) })) };
  }

  /**
   * Boss battle: a pick of a move not allowed this turn (a boss power's limits, or the move the God King took back,
   * which the screens and the server don't allow) counts as no move, and such a move isn't the best on offer either.
   */
  private withoutBarred(picks: Readonly<Record<string, string | null>>, evaluation: BoardEvaluation, boardId: number) {
    const allowed = this.crowdAllowed(boardId);
    if (!allowed) return { picks, evaluation };
    const ok = new Set(allowed);
    const clean = Object.fromEntries(Object.entries(picks).map(([id, m]) => [id, m && !ok.has(m) ? null : m]));
    const expectedAfter = Object.fromEntries(Object.entries(evaluation.expectedAfter).filter(([m]) => ok.has(m)));
    let { bestMove, bestExpected } = evaluation;
    if (!ok.has(bestMove)) {
      const next = Object.entries(expectedAfter).sort((a, b) => b[1] - a[1])[0];
      if (next) [bestMove, bestExpected] = next;
    }
    return { picks: clean, evaluation: { ...evaluation, bestMove, bestExpected, expectedAfter } };
  }

  /**
   * Boss battle: the test switch (?laststand=1 in solo) makes the next crowd move call for the God King's Last
   * Stand, whatever it gives away.
   */
  forceLastStand = false;

  /**
   * Boss battle: whether the God King makes his Last Stand on the crowd's played move. Once per game, whether or
   * not he has charges left: the move gave away at least the bar (lastStandBar: it falls the longer the battle
   * goes without one, and in a weak position it's a share of the chances left), and the crowd wasn't already lost
   * (lastStandFrom). The judge's numbers decide, as given. Never while a boss's power has changed the board
   * (boardAltered), nor on the crowd's first lastStandFromMove moves of the battle (Eric, Nov 2; lastStandDue: here
   * `b.crowdMoves` is the crowd's moves already played in this battle, the one being judged not yet counted).
   */
  private lastStandFor(
    fen: string,
    played: string,
    best: number,
    scored: readonly { move: string; expected: number; loss: number }[],
    evaluation: BoardEvaluation,
  ): LastStandRound | undefined {
    const b = this.state.boss;
    // (Never when only one move was open: his re-pick has to leave the crowd another, a power's limits included. Never
    // against a boss his help doesn't work against: the Hidden Boss.)
    if (!b || b.lastStand || b.barred || bossRules(b)?.blocksKing || (crowdAllowed(b, fen) ?? legalMoves(fen)).length < 2) return undefined;
    const mine = scored.find((m) => m.move === played);
    const loss = mine?.loss ?? 0;
    const charges = b.kingCharges ?? 0;
    const bar = Math.round(lastStandBar(best, b.crowdMoves, charges, this.settings) * 10) / 10;
    if (!this.forceLastStand && !lastStandDue(loss, best, b.crowdMoves, charges, this.settings)) return undefined;
    // (Never while a boss's power has changed the board: the judge's numbers are plain chess's, and the reply they fear
    // may be one the board doesn't allow (Eric, Oct 24: Babur's hoop). The move stands and nothing is spent. The test
    // switch, ?laststand=1, still calls him on any board.)
    if (!this.forceLastStand && boardAltered(b, fen)) return undefined;
    // What it loses: the boss's best reply (only if it's a legal move there) and a mate it allows (the crowd mated).
    const reply = evaluation.replies?.[played];
    const mate = evaluation.mates?.[played];
    const legalReply = !!reply && legalMoves(applyMove(fen, played)).includes(reply);
    const round3 = (x: number) => Math.round(x * 1000) / 1000;
    return {
      move: played,
      loss: Math.round(loss * 10) / 10,
      bar,
      before: round3(best),
      after: round3(mine?.expected ?? best),
      ...(legalReply ? { reply } : {}),
      ...(mate !== undefined && mate < 0 ? { mateIn: -mate } : {}),
    };
  }

  /**
   * Boss battle: the King plays (the judge's best move: stronger than the boss) when more than
   * half the crowd calls him and he has a charge left. Bots call him when the crowd's popular move would lose
   * kingBotLoss points or more, and back a human's call with kingBotFollow chance.
   */
  private kingDecision(playerIds: readonly string[], result: GroupResult): { plays: boolean; calls: number } {
    const b = this.state.boss;
    // (A boss the God King's help doesn't work against, the Hidden Boss: he never plays, and nothing is spent.)
    if (!b || !(b.kingCharges ?? 0) || bossRules(b)?.blocksKing) return { plays: false, calls: 0 };
    const humans = playerIds.filter((id) => this.kingCallers.has(id)).length;
    const popularLoss = result.players.find((p) => p.move === result.playedMove)?.loss ?? 0;
    let calls = humans;
    for (const id of playerIds) {
      if (!this.player(id).isBot) continue;
      if (popularLoss >= this.settings.kingBotLoss || (humans > 0 && this.opts.rng() < this.settings.kingBotFollow)) calls++;
    }
    // (A Boss Battle party: any one member's call acts for the team, its charges being the team's.)
    return { plays: this.settings.kingAnyCall ? humans > 0 : calls * 2 > playerIds.length, calls };
  }

  /**
   * Boss battle: `playerId` calls for the King's strike, in the middle of the crowd's move. He strikes at once
   * when more than half the crowd has called (bots never start one, but back a human's call with kingBotFollow
   * chance): a charge is spent, the boss's next move is a weaker one, and the boss's rage meter gains a chunk
   * (strikeRage). The move itself goes on: everyone still picks. One strike per move. Returns whether he struck, and
   * how many have called.
   */
  callStrike(playerId: string): { struck: boolean; calls: number } {
    const b = this.state.boss;
    const ids = [...this.groups.values()][0] ?? [];
    if (!b || !(b.kingCharges ?? 0) || b.staggerNext || !ids.includes(playerId) || bossRules(b)?.blocksKing) return { struck: false, calls: 0 };
    this.kingStrikers.add(playerId);
    this.strikeBots ??= ids.filter((id) => this.player(id).isBot && this.opts.rng() < this.settings.kingBotFollow).length;
    const calls = ids.filter((id) => this.kingStrikers.has(id)).length + this.strikeBots;
    if (this.settings.kingAnyCall ? calls < 1 : calls * 2 <= ids.length) return { struck: false, calls };
    this.state = {
      ...this.state,
      boss: strikeRage({ ...b, kingCharges: Math.max(0, (b.kingCharges ?? 0) - 1), kingStrikes: [...(b.kingStrikes ?? []), b.crowdMoves + 1], staggerNext: true }),
    };
    return { struck: true, calls };
  }

  /**
   * Boss battle: the God King's move or strike tried against a boss his help doesn't work against (the Hidden Boss,
   * BossRules.blocksKing). He doesn't come, but the try spends a charge as if it had worked (Eric, Oct 14: "using the
   * king's move doesn't draw down on the usage vs him like it should"); nothing else changes (no move, no strike, the
   * clock runs on). Each try spends one, until none is left. Returns whether one was spent.
   */
  kingTried(): boolean {
    const b = this.state.boss;
    if (!b || !(b.kingCharges ?? 0) || !bossRules(b)?.blocksKing) return false;
    this.state = { ...this.state, boss: { ...b, kingCharges: b.kingCharges! - 1 } };
    return true;
  }

  /** Applies scored boards: updates scores and plays the drawn moves. */
  finishRound(
    results: readonly BoardRound[],
    thinkMs: Readonly<Record<string, number>>,
    usedPowerUp: ReadonlySet<string> = new Set(),
    /** A Boss Battle party: the turn's length, which comes out of the team's one bank (each pick's own time doesn't). */
    teamMs?: number,
  ): RoundReport {
    const think: Record<string, number> = { ...thinkMs };
    const team = teamMs === undefined ? null : { before: this.teamBankMs(), inc: this.roundSettings().timeIncrementSeconds * 1000 };
    for (const r of results) for (const p of r.playerIds) think[p] ??= this.botThink.get(p) ?? 0;
    const used = new Set([...usedPowerUp, ...this.botPowerUps]);
    this.botPowerUps = new Set();
    // Marked on the results (sent to every screen): a pick made with a power-up is never brilliant.
    for (const r of results) for (const p of r.result.players) if (used.has(p.playerId)) p.usedPowerUp = true;
    // Crowd 50 v 50: a rare brilliant find's bonus and shoutout, once power-ups are known (a pick made with one never is).
    if (this.settings.crowdScoring) {
      for (const r of results) {
        const force = this.forceShoutout ? r.result.players.filter((p) => p.move && !this.player(p.playerId).isBot && !p.usedPowerUp).map((p) => p.playerId) : undefined;
        crowdBrilliant(r.result, this.settings, force);
        if (r.result.brilliant) this.forceShoutout = false;
      }
    }
    const outcomes = results.flatMap((r) => outcomesFromGroup(r.result, think, used));
    const kingPlayed = results.some((r) => r.king);
    const stand = results.find((r) => r.lastStand)?.lastStand;
    // (With this round's clock, worked out before the move count moves on.)
    this.state = applyRound(this.state, this.groups, outcomes, this.roundSettings());
    if (team) this.setTeamBank(team.before + team.inc - Math.min(teamMs!, team.before + team.inc));
    if (kingPlayed && this.state.boss) {
      const b = this.state.boss;
      this.state = {
        ...this.state,
        boss: {
          ...b,
          kingCharges: Math.max(0, (b.kingCharges ?? 0) - 1),
          kingMoves: [...(b.kingMoves ?? []), b.crowdMoves],
        },
      };
    }
    if (this.state.boss) {
      const { barred: _done, ...b } = this.state.boss;
      // The God King's Last Stand: the scores stand, but the move is taken back (it isn't a move on the board, so
      // the move count goes back one, and so does the count to the boss's next strike, which waits for the re-pick). He falls, and leaves his charges to
      // the crowd: every player still in gets lastStandPowerUps power-ups for each (the engine's top 3 moves, as in
      // Crowd). Otherwise a re-pick that's been played clears the bar on the move he took back.
      const r = stand ? results.find((x) => x.lastStand)! : null;
      const charges = b.kingCharges ?? 0;
      const gift = charges * this.settings.lastStandPowerUps;
      this.state = {
        ...this.state,
        ...(stand && gift > 0 ? { players: this.state.players.map((p) => (p.alive ? { ...p, powerUps: p.powerUps + gift } : p)) } : {}),
        boss: stand
          ? { ...b, crowdMoves: b.crowdMoves - 1, sinceKill: Math.max(0, b.sinceKill - 1), kingCharges: 0, lastStand: { atMove: b.crowdMoves, charges, ...stand, fen: r!.fenBefore, bestMove: r!.bestMove }, barred: stand.move }
          : b,
      };
      if (stand) this.forceLastStand = false;
    }
    // (The bank ran out on this move, the bullet clock's or Boss Battle's: the battle is lost on time, and no move is played.)
    const outOfTime = this.bossOutOfTime();
    // (Rounds whose move a power crossed out after it was played (Folio's Revision): fair play skips them.)
    const crossed = new Set<number>();
    for (const r of results) {
      if (r.lastStand || outOfTime) continue;
      const board = this.boards.get(r.boardId)!;
      const moverExpected = r.scored.find((s) => s.move === r.result.playedMove)?.expected ?? board.expected;
      this.boards.set(r.boardId, playOnBoard(board, r.result.playedMove, moverExpected));
      // Boss battle: the judged eval feeds the ultimate's meter, and the boss's own after-move effect (G-REX's fire
      // burns what was left on its tiles; Folio's Revision reads the judge's numbers).
      if (this.state.boss?.powers) {
        this.state = { ...this.state, boss: { ...this.state.boss, powers: { ...this.state.boss.powers, judged: moverExpected } } };
        this.afterCrowdMove(r.result.playedMove, { best: Math.max(moverExpected, r.scored[0]?.expected ?? moverExpected), played: moverExpected, ...(r.king ? { king: true } : {}), ...(r.flag ? { flag: true } : {}) });
        if (bossRules(this.state.boss)?.crossedOut?.(this.state.boss!)) crossed.add(r.boardId);
      }
    }
    const away = this.awayOut();
    return { stage: this.state.stage, round: this.state.round - 1, boards: results.map((r) => (crossed.has(r.boardId) ? { ...r, power: true } : r)), retired: this.retiredThisRound, ...(away.length ? { away } : {}) };
  }

  /** Records a bot's thinking time (when bot picks come from outside, e.g. the lobby host). */
  setBotThink(id: string, ms: number) {
    this.botThink.set(id, ms);
  }

  /** Records that a bot used a power-up this round (when bot picks come from outside). */
  setBotPowerUp(id: string) {
    this.botPowerUps.add(id);
  }

  /** Everything needed to rebuild the runner later (the lobby server stores this between messages). */
  snapshot(): RunnerSnapshot {
    return {
      state: this.state,
      boards: [...this.boards.values()].map((b) => ({ ...b, opening: b.opening.id })),
      groups: [...this.groups.entries()],
      usedFamilies: [...this.usedFamilies],
      retired: this.retiredThisRound,
      botThink: [...this.botThink],
    };
  }

  static restore(
    snapshot: RunnerSnapshot,
    opts: { settings: Settings; rng: Rng; engines: readonly EngineLike[]; library: readonly Opening[]; clock?: () => number },
  ): MatchRunner {
    // (A Freestyle board's opening isn't in the library either.)
    const byId = new Map([...opts.library, FREESTYLE_OPENING].map((o) => [o.id, o]));
    const runner = Object.create(MatchRunner.prototype) as MatchRunner;
    Object.assign(runner, {
      opts: { ...opts, entrants: [] },
      top: new TopMovesCache(opts.settings.botCandidateMoves),
      state: snapshot.state,
      boards: new Map(snapshot.boards.map((b) => [b.id, { ...b, opening: byId.get(b.opening)! }])),
      groups: new Map(snapshot.groups),
      usedFamilies: new Set(snapshot.usedFamilies),
      retiredThisRound: snapshot.retired,
      botThink: new Map(snapshot.botThink ?? []),
      botPowerUps: new Set(),
      // (Not made from the snapshot, but fields every runner has: Object.create skips the class's own initializers. A
      // restored runner without the bosses' store crashed Big Boy's Big Bounce online: every event of a lobby restores.)
      kingCallers: new Set(),
      kingStrikers: new Set(),
      strikeBots: null,
      planned: new Map(),
      planning: null,
      forceLastStand: false,
      showdownScout: null,
      bossTimedOut: false,
      humanBrain: null,
      brainNote: null,
      landingCheck: null,
      raceCheck: null,
      bossLast: null,
      bossMemo: new Map(),
      bossViewMemo: null,
    });
    // The boss battle's board isn't in the opening library.
    for (const [id, b] of runner.boards) if (!b.opening) runner.boards.set(id, { ...b, opening: BOSS_OPENING });
    return runner;
  }

  stageComplete(): boolean {
    if (this.state.boss) return this.finalGameOver() || this.state.boss.crowdMoves >= this.settings.bossMaxMoves || this.bossOutOfTime() || carrotBattle.won(this.state.boss) || blackedOut(this.state.boss) || (this.bossForceWin && this.bossToMove());
    if (this.state.final) return finalComplete(this.state, this.settings) || this.finalGameOver();
    return stageComplete(this.state, this.settings);
  }

  // ---------------- Boss battle ----------------

  /** The boss battle, once on. */
  get boss() {
    return this.state.boss ?? null;
  }

  /** The boss is to move (and the game isn't over). */
  bossToMove(): boolean {
    const b = this.state.boss;
    if (!b || this.finalGameOver()) return false;
    return sideToMove(this.boards.get(this.state.boards[0]!)!.fen) !== b.crowdSide;
  }

  /** Whether the boss slips this move (a small inaccuracy from its top moves): only a weak boss does, now and then. */
  bossStumbles(): boolean {
    return this.opts.rng() < bossStumbleChance(this.state.boss!.elo, this.settings);
  }

  /**
   * How the boss plays its next move: staggered by the King's strike, the engine's best (a power's follow-up its search
   * scored: Wrangler's reply to the showdown's duel), stumbling (a weak boss), or at its strength.
   */
  bossMoveKind(): BossMoveKind {
    if (this.state.boss?.staggerNext) return "stagger";
    // (The stumble's draw comes first, as ever: a best reply moves nothing else the match's random source draws.)
    const stumbles = this.bossStumbles();
    if (this.bossBestReply()) return "best";
    return stumbles ? "stumble" : "elo";
  }

  /**
   * How strong the boss plays his next move, for his bar's level: "weak" after the King's strike (until his move lands),
   * "full" for the Full Moon's whole stretch (BossRules.fullStretch) and for a power's engine-best follow-up when he's to
   * move (bestReply: Wrangler's reply to the showdown), else "usual". A slip (bossStumbles) isn't here: it's drawn as his
   * move begins, so it can't be shown before (docs/decisions/2026-10-23-boss-bar.md).
   */
  bossStrengthNow(b: BossState | null | undefined = this.state.boss): "usual" | "weak" | "full" {
    if (!b) return "usual";
    if (b.staggerNext) return "weak";
    const rules = bossRules(b);
    if (rules?.fullStretch?.(b)) return "full";
    return rules?.bestReply && this.bossToMove() && rules.bestReply(b, this.boards.get(this.state.boards[0]!)!) ? "full" : "usual";
  }

  /** The boss's move now is a power's follow-up its engine search scored (BossRules.bestReply): the engine's best. */
  bossBestReply(): boolean {
    const b = this.state.boss;
    if (!b?.powers || !this.bossToMove()) return false;
    return bossRules(b)?.bestReply?.(b, this.boards.get(this.state.boards[0]!)!) ?? false;
  }

  /**
   * The boss's move from an engine (at its strength), played on the board. Wrangler's turn also works out his long pull,
   * drag or showdown on this device's engines (pigTurn), as the host does online.
   */
  async playBoss(engine: EngineLike = this.opts.engines[0]!): Promise<string> {
    const fen = this.boards.get(this.state.boards[0]!)!.fen;
    const kind = this.bossMoveKind();
    // (Test switch: a mate in one whenever there is one.)
    const mate = this.settings.bossMateTest ? (this.bossAllowed() ?? legalMoves(fen)).find((m) => gameEnd(applyMove(fen, m), []) === "checkmate") : undefined;
    // (Test switch ?paint=1: Smudgy's hidden rook steps like a pawn, whose name the e2e reads.)
    const paint = this.settings.bossPaintTest ? smudgyBattle.paintStep(this.battle, this.bossAllowed() ?? legalMoves(fen)) : undefined;
    // (The Hidden Boss's child: Maia at his rating now, and Stockfish at the strength that rating stands for while Maia isn't there.)
    const child = this.childRatingNow();
    const brain = this.humanBrain && child !== null ? { ...this.humanBrain, rating: child } : this.humanBrain;
    const elo = this.bossEloNow();
    // (Alfil's Slam's pieces land as the crowd's turn after this move begins: his move is judged with them down.)
    const look = this.bossAhead();
    this.landingCheck = null;
    const ahead = look && { ...look, onCheck: (c: LandingCheck) => (this.landingCheck = c) };
    // (Chub & Chirp's Carrot Patch: his race brain, on his ordinary moves in the race.)
    const raceLook = this.bossRace(kind);
    this.raceCheck = null;
    const race = raceLook && { ...raceLook, onCheck: (c: RaceCheck) => (this.raceCheck = c) };
    const ordinary = async () =>
      mate ??
      paint ??
      (await bossMoveFrom(engine, fen, elo, this.settings.bossNodes, kind, this.opts.rng, this.settings.kingStrikeLoss, bossGuardFrom(this.settings), this.bossAllowed(), brain ? { ...brain, onNote: (n) => (this.brainNote = n) } : undefined, ahead, race));
    const asks = this.bossAsks();
    if (asks) {
      // (His long pull, drag or showdown on every engine of this device; his ordinary move on `engine`, as ever.)
      const answer = await pigTurn(this.opts.engines.length ? this.opts.engines : [engine], fen, asks, ordinary, this.showdownScout);
      this.applyBossMove(answer.move, kind === "stagger", { drag: answer.drag ?? null, showdown: answer.showdown ?? null, edge: answer.edge ?? null, outside: answer.outside ?? null });
      return answer.move;
    }
    // (Moo's Moonbeam lands after this move: the crowd's top moves after it, on this device's engine, as the host does online.)
    const beam = this.bossBeam();
    // (The circus tiger's balloon, if it's due at the end of this turn: decided as his turn's work begins, as online; and his
    // hoops, if they're due after this move.)
    const balloon = this.balloonAsk();
    const hoops = this.hoopsAsk();
    // (Folio's Crease, wanted with this move: its line on the position after it, on this device's engines, as the host's.)
    const crease = this.creaseAsk();
    const move = await ordinary();
    const end = balloon || hoops ? await this.tigerTurnEnd(fen, move, hoops, balloon, engine) : {};
    const line = crease ? await creasePick(this.opts.engines.length ? this.opts.engines : [engine], applyMove(fen, move), crease).catch(() => null) : null;
    this.applyBossMove(move, kind === "stagger", { ...(beam ? { beam: await beamLines(engine, fen, move, beam) } : {}), ...end, ...(crease ? { crease: line?.line ?? null, creaseLoss: line?.loss ?? null } : {}) });
    return move;
  }

  /**
   * Moo's Moonbeam (or the Full Moon's flurry) lands after the boss's move now: how many of the crowd's top lines it
   * weighs after it (the boss request's `beam`), or null: none.
   */
  bossBeam(): number | null {
    return mooBattle.beamAsk(this.battle);
  }

  /**
   * What the boss's turn must work out besides its move, with the engine (Wrangler's long pull, drag or showdown), or
   * null: the server sends it to the host with the request for the move; solo works it out in playBoss.
   */
  bossAsks(): BossAsks | null {
    return pigBattle.asks(this.battle);
  }

  /** Wrangler's showdown scout on this device (solo's), searching line-ups while the crowd thinks; null: none. */
  showdownScout: ShowdownScout | null = null;

  /**
   * The boss's brain when it isn't plain Stockfish (solo's Boss alone sets it as the battle begins: Maia-3 at a
   * rating, with its engine; see BOSS_BRAIN). Null: Stockfish, as everywhere else.
   */
  humanBrain: { brain: BossBrain; rating: number; stockfishShare?: number; engine: HumanEngineLike } | null = null;
  /** What the brain did with the boss's last move (the admins' debug line). */
  brainNote: BrainNote | null = null;
  /** What the landing guard did with the boss's last move (null: it didn't look); the sims count it. */
  landingCheck: LandingCheck | null = null;
  /** What his race brain did with his last move (null: it didn't look); the sims count it. */
  raceCheck: RaceCheck | null = null;

  /**
   * The landing guard's look ahead for the boss's move now, or null: Alfil's Slam's pieces land as the crowd's turn
   * after his move begins (landsAfterHisMove), so it's judged with them down as the rules will put them (slamAhead).
   * Moves still come from the board as it is.
   */
  bossAhead(): BossAhead | null {
    const pieces = landsAfterHisMove(this.state.boss);
    return pieces ? slamAhead(pieces) : null;
  }

  /**
   * How the boss plays this battle (bossBrainFor): an admin's pick (`picked`, "" for the boss's own), and whether Maia
   * may play here at all; a crowd's margin when more than one picks the crowd's moves (not Boss alone).
   */
  bossBrainPlan(picked: BossBrain | "", maia: boolean): BossBrainPlan | null {
    const b = this.state.boss;
    if (!b) return null;
    return bossBrainFor(b.id ?? "", b.elo, picked, maia, { crowd: this.alive().length > 1, alone: this.settings.bossAloneMaia || undefined });
  }

  /** The moves the boss may play now (a pie stops it too), or null: any legal move. */
  bossAllowed(): string[] | null {
    return bossAllowed(this.state.boss, this.boards.get(this.state.boards[0]!)!.fen);
  }

  /**
   * Plays the boss's move (from the host's engine online). The last check, whoever picked it: an illegal move, or one a
   * power stops (onto a pie, across Sawyer's saw), never lands; the first allowed one is played instead and the error
   * is logged (every brain picks from the allowed moves and bossMoveFrom checks its own pick, so only a host that's out
   * of date or tampered with gets here). Then the crowd's next turn begins: its powers are set (a freeze, a pie, the
   * ultimate).
   */
  applyBossMove(move: string, staggered = !!this.state.boss?.staggerNext, extras: BossMoveExtras = {}): string {
    const id = this.state.boards[0]!;
    const board = this.boards.get(id)!;
    const legal = this.bossAllowed() ?? legalMoves(board.fen);
    // (A move its rules play as something else: Wrangler's long pull, played as its double step.)
    const boss = this.state.boss;
    const special = boss?.powers ? (bossRules(boss)?.specialMove?.(boss, board.fen, move) ?? null) : null;
    const m = special && legal.includes(special.play) ? special.play : legal.includes(move) ? move : legal[0]!;
    if (m !== move && !(special && m === special.play)) console.error(`boss move refused: ${move} isn't one he may play in ${board.fen}; ${m} instead`);
    const shown = special && m === special.play ? move : m;
    const played = playOnBoard(board, m, 1 - board.expected);
    this.boards.set(id, played);
    // (What it took: the record playOnBoard wrote for it.)
    const taken = played.captures?.at(-1);
    const captured = taken && taken.ply === played.history.length ? taken.piece : undefined;
    // (A power stops it: it stopped every move he had, so the limit lifted for the turn. The screens say which power.)
    const through = boss?.powers && bossRules(boss)?.bossStops?.(boss)?.(m, board.fen) ? stopReason(boss, board.fen, m) : null;
    this.bossLast = { move: shown, san: special && m === special.play ? special.san : toSan(board.fen, m), ...(staggered ? { staggered: true } : {}), ...(captured ? { captured } : {}), ...(through ? { through } : {}) };
    if (this.state.boss?.staggerNext) this.state = { ...this.state, boss: { ...this.state.boss, staggerNext: false } };
    // (The boss's own after-move effect: Sawyer's split pawn after his first move; Wrangler's pull, drag or showdown.)
    if (this.state.boss?.powers) bossRules(this.state.boss)?.afterBossMove?.(this.battle, m, { ...extras, ...(shown !== m ? { special: shown } : {}) });
    this.preparePowers();
    return m;
  }

  /**
   * After the crowd's move: the boss's own effect, if it has one (G-REX's fire: what was left on a tile ablaze burns).
   * `judged`: the judge's numbers for it, when a scored round played it.
   */
  private afterCrowdMove(move: string | null, judged: JudgedMove | null = null) {
    const b = this.state.boss;
    if (b) bossRules(b)?.afterCrowdMove?.(this.battle, move, judged);
  }

  /** Folio's Crease is wanted with the boss's move now: what the host's engines need to pick its line after it, or null. */
  creaseAsk(): CreaseAsk | null {
    return folioBattle.creaseAsk(this.battle);
  }

  /**
   * The test trigger (an admin's): the boss's ultimate comes as the next crowd turn begins, without the warning. Does
   * nothing (false) when it can't: no ultimate, spent, the battle over. Never touches a turn in progress.
   */
  triggerUltimate(): boolean {
    if (!this.state.boss || this.finalGameOver() || this.isOver()) return false;
    const t = triggerUltimate(this.state.boss);
    if (t.ok && t.boss) this.state = { ...this.state, boss: t.boss };
    return t.ok;
  }

  /** Hollow's Lights out is due: the start of his turn (the crowd has moved), from the full meter or the test trigger. */
  lightsOutDue(): boolean {
    return hollowBattle.lightsOutDue(this.battle);
  }

  /** Lights out begins (the clocks stopped): its rounds (see hollowBattle.startLightsOut). */
  startLightsOut(): LightsOutTest {
    return hollowBattle.startLightsOut(this.battle);
  }

  /** Lights out is over: each player's misses cost them (see hollowBattle.finishLightsOut). Returns what each missed. */
  finishLightsOut(missed: Readonly<Record<string, number>>): Record<string, number> {
    return hollowBattle.finishLightsOut(this.battle, missed);
  }

  /** Lights out's crowd count so far (see hollowBattle.lightsTally). */
  lightsTally(people: Readonly<Record<string, readonly { found: readonly unknown[]; used?: number }[]>>, ended: number): LightsTally {
    return hollowBattle.lightsTally(this.battle, people, ended);
  }

  /** Hollow's extra move is due (the crowd failed Lights out, and he has played his own move), or Dash's (a failed Scramble Rush). */
  extraMoveDue(): boolean {
    return hollowBattle.extraMoveDue(this.battle) || dashBattle.extraMoveDue(this.battle);
  }

  /** His extra move: a quiet one that gains him only a little (extraMoveFrom), from this device's engine. */
  async playExtraMove(engine: EngineLike = this.opts.engines[0]!): Promise<string | null> {
    return dashBattle.extraMoveDue(this.battle) ? dashBattle.playExtraMove(this.battle, engine) : hollowBattle.playExtraMove(this.battle, engine);
  }

  /** Plays his extra move (from the host's engine online; see hollowBattle.applyExtraMove, dashBattle's). Returns it, or null. */
  applyExtraMove(move: string | null): string | null {
    return dashBattle.extraMoveDue(this.battle) ? dashBattle.applyExtraMove(this.battle, move) : hollowBattle.applyExtraMove(this.battle, move);
  }

  /** Dash's Scramble Rush is due: it came as this crowd turn began, and the turn waits for it (dashBattle.rushDue). */
  rushDue(): boolean {
    return dashBattle.rushDue(this.battle);
  }

  /**
   * The Rush is over: each person's placements judged, each bot's from the seed, the verdict (dashBattle.finishRush). `only`
   * (solo: you): only that player's put-back counts, no bots and no mean (Eric, Nov 8).
   */
  finishRush(places: Readonly<Record<string, Readonly<Record<string, unknown>>>>, only?: string): { correct: Record<string, number>; mean: number; held: boolean } {
    return dashBattle.finishRush(this.battle, places, only);
  }

  /** Boingo's funhouse: he plays the crowd's move this turn (the funhouse's first, once), before the crowd picks. */
  funhouseDue(): boolean {
    return boingoBattle.funhouseDue(this.battle);
  }

  /** The funhouse: the boss picks the crowd's move (a weak but recoverable one) and plays it. */
  async playFunhouse(engine: EngineLike = this.opts.engines[0]!): Promise<string> {
    return boingoBattle.playFunhouse(this.battle, engine);
  }

  /** Plays the funhouse's move for the crowd (from the host's engine online; see boingoBattle.applyFunhouse). */
  applyFunhouse(move: string): string {
    return boingoBattle.applyFunhouse(this.battle, move);
  }

  /** Big Boy's Big Bounce is due: the start of his turn (the crowd has moved), from the warning or the test trigger. */
  bounceDue(): boolean {
    return bigboyBattle.bounceDue(this.battle);
  }

  /** The Big Bounce's candidate positions (him to move): the same list on the server, the host and in solo. */
  bounceCandidates(): string[] {
    return bigboyBattle.bounceCandidates(this.battle);
  }

  /** The Big Bounce, from this device's engines (bounceFrom: the candidates scored, the pick within the loss band). */
  async playBounce(engines: readonly EngineLike[] = this.opts.engines): Promise<BounceResult> {
    return bigboyBattle.playBounce(this.battle, engines);
  }

  /** The Big Bounce lands (from the host's engine online; see bigboyBattle.applyBounce). */
  applyBounce(pick: string | null, loss: number | null = null): BounceResult {
    return bigboyBattle.applyBounce(this.battle, pick, loss);
  }

  /**
   * Alfil's turn begins with a step (alfilBattle.step: the Mammoth Slam, the fusion of his last cast, a new cast), or
   * null. Several can come one after another, each its own screen, then his move; the fusion is his move (his turn
   * ends with it: bossToMove() is false after it, unless it failed).
   */
  alfilStep(): AlfilStep | null {
    return alfilBattle.step(this.battle);
  }

  /** The positions the step's engine pick weighs (the cast's pairs, the fusion's squares, the Slam's lifts): the same on the server, the host and in solo. */
  alfilCandidates(): string[] {
    return alfilBattle.candidates(this.battle);
  }

  /** His fusion's look ahead: its squares weighed with the Slam's pieces down when they land right after it (alfilBattle.fusionAhead); null: none. */
  alfilFusionAhead(): ((fen: string) => string) | null {
    return alfilBattle.fusionAhead(this.battle);
  }

  /** The step needs an engine's pick: a cast with a choice, a fusion or a Slam with a way to go to weigh (else it lands at once). */
  alfilNeedsEngine(): boolean {
    return alfilBattle.needsEngine(this.battle);
  }

  /** The step, from this device's engines (the cast's pair and the fusion's square: fuseFrom; the fusion's wait: the pass guard; the Slam's lift: slamFrom); null: nothing came of it. */
  async playAlfil(engines: readonly EngineLike[] = this.opts.engines): Promise<AlfilStep | null> {
    return alfilBattle.play(this.battle, engines);
  }

  /**
   * The step lands (from the host's engine online: one of the candidates, else the cast's first pair, the fusion's first
   * square or nothing; alfilBattle.apply). `step`: the one the pick was asked for (another now: the pick is dropped).
   * Null: nothing came of it.
   */
  applyAlfil(pick: string | null, loss: number | null = null, step: AlfilStep | null = null): AlfilStep | null {
    return alfilBattle.apply(this.battle, pick, loss, step);
  }

  /**
   * Chub & Chirp's Leapfrog is due: his turn begins and a pawn of his can hop over one of the crowd's (hopperBattle.due).
   * The hop comes before his move: he moves after it.
   */
  hopDue(): boolean {
    return hopperBattle.due(this.battle);
  }

  /** The hop's candidate positions (one per hop he could make): the same on the server, the host and in solo. */
  hopCandidates(): string[] {
    return hopperBattle.candidates(this.battle);
  }

  /** The hop needs an engine's pick: more than one pawn can hop (one alone hops at once). */
  hopNeedsEngine(): boolean {
    return hopperBattle.needsEngine(this.battle);
  }

  /** The hop, from this device's engines (hopFrom: the one best for him); null: none was due. */
  async playHop(engines: readonly EngineLike[] = this.opts.engines): Promise<LeapfrogHop | null> {
    return hopperBattle.play(this.battle, engines);
  }

  /** The hop (from the host's engine online: one of the candidates, else the first; hopperBattle.apply); null: none was due. */
  applyHop(pick: string | null): LeapfrogHop | null {
    return hopperBattle.apply(this.battle, pick);
  }

  /**
   * Chub & Chirp's Carrot Patch is due: the start of his turn after its warning (or the test trigger), once a battle
   * (carrotBattle.due). The cast is his whole turn: no move of his follows it. Not when it waited this turn (the pass
   * guard): then his move.
   */
  carrotDue(): boolean {
    return carrotBattle.due(this.battle);
  }

  /** The cast from this device's engines (solo, the sims: castAnswer, the pass guard); null: none was due, or it waits. */
  async playCarrots(engines: readonly EngineLike[] = this.opts.engines): Promise<CarrotPatch | null> {
    return carrotBattle.play(this.battle, engines);
  }

  /**
   * The Carrot Patch's cast (the placement the same on the server, the host and in solo): `answer` PASS_WAIT (the host's
   * pass guard) waits a turn, anything else or none casts; null: none was due, or it waits.
   */
  applyCarrots(answer: string | null = null): CarrotPatch | null {
    return carrotBattle.apply(this.battle, answer);
  }

  /**
   * Smudgy's Repaint is due: the start of his turn after its warning (or the test trigger), his forced moves done, a pair
   * he could paint (smudgyBattle.repaintDue). It's his whole turn: no move of his follows it. Not when it waited this turn
   * (no pair in the band): then his move.
   */
  repaintDue(): boolean {
    return smudgyBattle.repaintDue(this.battle);
  }

  /** The Repaint's candidate positions (one per pair, the crowd to move): the same on the server, the host and in solo. */
  repaintCandidates(): string[] {
    return smudgyBattle.candidates(this.battle);
  }

  /** The Repaint's pick may fall outside the band: the test switch's first, or the admins' trigger. */
  repaintAny(): boolean {
    return smudgyBattle.any(this.battle);
  }

  /** The Repaint from this device's engines (repaintFrom); null: none was due, or no pair in the band (he moves). */
  async playRepaint(engines: readonly EngineLike[] = this.opts.engines): Promise<RepaintResult | null> {
    return smudgyBattle.play(this.battle, engines);
  }

  /** The Repaint (from the host's engine online: one of the candidates; anything else, none now, and he moves). */
  applyRepaint(pick: string | null, gain: number | null = null): RepaintResult | null {
    return smudgyBattle.apply(this.battle, pick, gain);
  }

  /** The Carrot Patch's race as the crowd's judge weighs its move now (the score jobs' `race`), or null. */
  raceJob(): CarrotRace | null {
    const b = this.state.boss;
    return b ? crowdRace(b, this.boards.get(this.state.boards[0]!)!.fen) : null;
  }

  /**
   * His race brain's look for his move now (the boss request's `race`), or null: in the Carrot Patch's race, on his
   * ordinary moves (not a slip, not the King's strike: he races as he plays), as raceGuard weighs it.
   */
  bossRace(kind: BossMoveKind = this.state.boss?.staggerNext ? "stagger" : "elo"): BossRace | null {
    if (kind !== "elo") return null;
    const race = bossRace(this.state.boss, this.boards.get(this.state.boards[0]!)!.fen);
    return race ? { race, looks: BOSS_POWERS.carrotLooks, nodes: BOSS_POWERS.carrotNodes, ...(this.settings.bossCarrotTest !== undefined ? { eager: true } : {}) } : null;
  }

  /**
   * The battle was his by his last carrot (the Carrot Patch): for the result screen (the results' `carrots`). It wins
   * over a draw the same move makes on the board (a stalemate, the fifty-move rule, a repetition: Eric's sheet, "he wins
   * on the spot"); a mate is his anyway, with the mate's own line.
   */
  get bossCarrotWin(): boolean {
    return carrotBattle.won(this.state.boss) && boardEnd(this.boards.get(this.state.boards[0]!)!) !== "checkmate";
  }

  /**
   * The match's clock for powers that run in real time (Battle.now): the runner's `clock` (the server's time online, the
   * page's visible time solo); without one (tests, the sims), each crowd move counts as BOSS_POWERS.seedEverySec.
   */
  clockNow(): number {
    return this.opts.clock ? this.opts.clock() : (this.state.boss?.crowdMoves ?? 0) * BOSS_POWERS.seedEverySec * 1000;
  }

  /**
   * The hippo gardener's watering is due: the start of his turn after its warning (or the admins' trigger), not waiting
   * after this crowd move (gardenerBattle.due). It's his whole turn: no move of his follows it. Not when it waits (the pass
   * guard, no answer): then his move.
   */
  waterDue(): boolean {
    return gardenerBattle.due(this.battle);
  }

  /**
   * What the watering needs placed (the boss request's `water`): the seeds' rolls, taken the first time it's asked for and
   * kept, the plain plants on the board, the order of the squares tried. Null when none is due.
   */
  waterAsk(): WaterAsk | null {
    return gardenerBattle.ask(this.battle);
  }

  /** The watering comes even when it would lose him real material (the test switch's first, or the admins' trigger). */
  waterAny(): boolean {
    return gardenerBattle.any(this.battle);
  }

  /** The watering from this device's engines (waterFrom); null: none was due, or it waits (he moves). */
  async playWater(engines: readonly EngineLike[] = this.opts.engines): Promise<WaterResult | null> {
    return gardenerBattle.play(this.battle, engines);
  }

  /** The watering (online the host's answer, checked: waterCheck); anything else, none now, and he moves. */
  applyWater(answer: string | null, gain: number | null = null): WaterResult | null {
    return gardenerBattle.apply(this.battle, answer, gain);
  }

  /**
   * What the circus tiger's hoops need placed after his move now (the boss request's `hoops`: the order their blocks are
   * tried in), or null when none is due: from the turn after their warning (or the admins' trigger), none standing.
   * Thrown at the end of his turn, after his move (tigerBattle.cast, from afterBossMove): he keeps his turn.
   */
  hoopsAsk(): HoopsAsk | null {
    return tigerBattle.hoopsAsk(this.battle);
  }

  /**
   * The circus tiger's balloon is due at the end of the boss's turn now (decided once a turn, as its work is asked for:
   * the request for his move or his cast; tigerBattle.balloonAsk): what the engines need to land it (the boss request's
   * `balloon`), or null: none due. Asked the same whether it will pop or not.
   */
  balloonAsk(): BalloonAsk | null {
    return tigerBattle.balloonAsk(this.battle);
  }

  /**
   * The end of the circus tiger's turn after his `move` from `fen`, on this device's engines (hoopsAnswer, as the host's
   * online): the hoops when they're due (`hoops`), then a due balloon's landing outside them (`balloon`), as his move's
   * extras. Nothing: none fits, no square, or no answer.
   */
  async tigerTurnEnd(fen: string, move: string, hoops: HoopsAsk | null, balloon: BalloonAsk | null, engine?: EngineLike): Promise<Pick<BossMoveExtras, "hoops" | "hoopsGain" | "balloon" | "balloonGain">> {
    let after: string;
    try {
      after = applyMove(fen, move);
    } catch {
      return {};
    }
    const engines = this.opts.engines.length ? this.opts.engines : engine ? [engine] : [];
    const { answer, pick, land } = await hoopsAnswer(engines, after, hoops, balloon).catch(() => ({ answer: "", pick: null, land: null }));
    return { ...(answer ? { hoops: answer, hoopsGain: pick?.gain ?? null } : {}), ...(land ? { balloon: land.square, balloonGain: land.gain } : {}) };
  }

  /** The boss's last move, and the piece it took (if any). */
  private bossLast: BossLastMove | null = null;
  /** The bosses' battle code's own store (Battle's memo). */
  private bossMemo = new Map<string, unknown>();

  /** What a boss's battle code (bosses/<boss>.ts) may use of this runner. */
  private get battle(): Battle {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const runner = this;
    return {
      get state() {
        return runner.state;
      },
      set state(v) {
        runner.state = v;
      },
      boards: runner.boards,
      get settings() {
        return runner.settings;
      },
      get bossLast() {
        return runner.bossLast;
      },
      set bossLast(v) {
        runner.bossLast = v;
      },
      engines: runner.opts.engines,
      alive: () => runner.alive(),
      finalGameOver: () => runner.finalGameOver(),
      bossToMove: () => runner.bossToMove(),
      crowdAllowed: (boardId) => runner.crowdAllowed(boardId),
      boardOf: (playerId) => runner.boardOf(playerId),
      afterCrowdMove: (move) => runner.afterCrowdMove(move),
      bossPassed: () => runner.preparePowers(),
      memo: runner.bossMemo,
      now: () => runner.clockNow(),
      random: () => runner.opts.rng(),
      library: runner.opts.library,
    };
  }

  /**
   * The boss strikes now (every bossKillEvery crowd moves; never a boss that doesn't strike, BossRules.noStrikes, nor in
   * Boss Battle, settings.bossNoStrikes).
   */
  bossKillDue(): boolean {
    return bossKillDue(this.state, this.settings) && !this.finalGameOver() && !bossRules(this.state.boss)?.noStrikes && !this.settings.bossNoStrikes;
  }

  /** The boss strikes down the player with the worst recent moves; returns who. */
  bossKill(): string | null {
    const k = bossKill(this.state, this.opts.rng, this.settings);
    this.state = k.state;
    return k.victim;
  }

  /**
   * Ends the boss battle: the result from the board (mate, a draw, or the engine's verdict at the move cap), or the boss
   * on time when the bullet clock ran out (bossOutOfTime), or the boss by his last carrot (Chub & Chirp's Carrot Patch:
   * bossCarrotWin).
   */
  finishBossBattle(): "crowd" | "boss" | "draw" {
    const b = this.state.boss!;
    const timeout = this.bossOutOfTime() && !this.finalGameOver();
    const winner = this.gameWinner();
    // (Hollow's last bulb out, Boss alone: his, whatever the board says.)
    const result = this.bossForceWin ? "crowd" : timeout || this.bossCarrotWin || blackedOut(b) ? "boss" : winner === null ? "draw" : winner === b.crowdSide ? "crowd" : "boss";
    // (The Hidden Boss's child beaten: the fight goes on, a new match against his adult form (nextBossForm). Nobody is placed.)
    if (b.form === "child" && result === "crowd") {
      this.state = { ...this.state, boss: { ...b, result } };
      this.bossForceWin = false;
      return result;
    }
    this.state = finishBoss(this.state, this.opts.rng, result, this.settings);
    this.bossTimedOut = timeout;
    return result;
  }

  /**
   * Testing (admins, solo: "Win this form", the Hidden Boss): the boss is beaten as the crowd's next move lands, by the same end a
   * mate takes (stageComplete, then finishBossBattle's "crowd"). Kept on the runner, never in the match state; online, only an admin's
   * press in his room's fight from the town sets it (LobbyCore.winFormTrigger, which keeps it in the lobby's record).
   */
  bossForceWin = false;

  /**
   * The form a boss battle against `id` starts in: the Hidden Boss's child (RECLUSE_CHILD), where the settings ask for it
   * (`recluseChild`, from RECLUSE_FORMS: solo, his room's fight and the Crowd's boss final online), else his usual form (nothing set).
   */
  private firstForm(id: string): { form?: BossForm } {
    return id === "recluse" && this.settings.recluseChild ? { form: "child" } : {};
  }

  /** Moves played on the board in this form (both sides'): the child's ramp counts them (RECLUSE_CHILD.everyPlies). */
  private formPlies(b: BossState): number {
    return Math.max(0, this.boards.get(this.state.boards[0]!)!.history.length - (b.startPly ?? 0));
  }

  /** The step of the child's ramp now (core childStep), or 0 in any other form. */
  childStepNow(b: BossState | null | undefined = this.state.boss): number {
    return b?.form === "child" ? childStep(this.formPlies(b)) : 0;
  }

  /** The Hidden Boss's child: the Maia rating he plays his next move at (core childRating); null in any other form. */
  childRatingNow(b: BossState | null | undefined = this.state.boss): number | null {
    return b?.form === "child" ? childRating(this.formPlies(b)) : null;
  }

  /**
   * The strength the boss's next move is played at on Stockfish: the battle's, or the Hidden Boss's child's (the level his Maia
   * rating now stands for: Stockfish's stand-in while Maia isn't there). Solo's playBoss and the lobby's request (the host's engine).
   */
  bossEloNow(): number {
    const child = this.childRatingNow();
    return child !== null ? levelForMaia(child) : this.state.boss!.elo;
  }

  /**
   * The Hidden Boss's child beaten (finishBossBattle left him "crowd" and placed nobody): a new match against his adult form
   * (Eric, Nov 12: "after beating the child, a new match starts (reset)"), from the starting position (a mate in one again under
   * the ?win=1 test switch), the same sides and the same seed; his powers from scratch (his bullet meter from empty), fresh
   * clocks, the crowd's move count, strikes and the God King's record of this match cleared (his charges carry on: the crowd's
   * for the whole fight; and he's back if he fell in a Last Stand). False when there's no next form.
   */
  nextBossForm(): boolean {
    const b = this.state.boss;
    if (!b || b.form !== "child" || b.result !== "crowd") return false;
    const id = this.state.boards[0]!;
    const old = this.boards.get(id)!;
    const generation = old.generation + 1;
    const win = !!this.settings.bossWinTest;
    this.boards.set(id, win ? newBoard(id, { ...BOSS_OPENING, moves: [...WIN_TEST_MOVES] }, WIN_TEST_MOVES.length, generation) : { ...newBoard(id, BOSS_OPENING, 0, generation), opening: BOSS_OPENING });
    const fen = this.boards.get(id)!.fen;
    const { form: _form, result: _result, lastStand: _stand, barred: _barred, staggerNext: _stagger, ...rest } = b;
    const next: BossState = { ...rest, startPly: this.boards.get(id)!.history.length, crowdMoves: 0, sinceKill: 0, kills: [], kingMoves: [], kingStrikes: [], powers: initPowers(b.powers?.seed ?? 0, fen, b.crowdSide) };
    this.state = { ...startBanks(this.state, this.settings), boss: next };
    this.bossLast = null;
    this.bossForceWin = false;
    this.bossTimedOut = false;
    this.brainNote = null;
    this.preparePowers();
    return true;
  }

  /**
   * The boss battle was lost on time (the bullet clock ran out): for the result screen. Kept on the runner, not in the
   * match state, so nothing stored changes: solo reads it at the end, and online the lobby reads it as it sends the
   * results (finishBossBattle and finishMatch run in the same event), as the results' `timeout`.
   */
  bossTimedOut = false;

  /**
   * The boss battle as sent to the screens. Built once per change: a solo battle's screens ask for it many times on
   * every redraw (several a second), and building it (the board's view, the moves the powers allow) on every ask was
   * the lag that grew with the match (.claude/LESSONS.md: "Lag that grows with the match"). The key is everything the
   * view is made from, so a cached view is always the one a fresh build would give.
   *
   * Asking again when nothing has changed costs no more than comparing a few values (Oct 14, 2026: a boss screen asks
   * many times a frame, and serializing the battle's state and its whole history for the key grew with the match): the
   * runner replaces the boss's state, a board and its last move rather than changing them in place, so the same
   * objects, with the same position and history, are the same view. Anything else goes on to the full key.
   */
  bossView(justKilled: string | null = null): NetBoss | null {
    const b = this.state.boss;
    if (!b) return null;
    const board = this.boards.get(this.state.boards[0]!)!;
    const s = this.settings;
    const same = [b, board, board.fen, board.lastMove, board.history, board.history.length, board.bases, this.alive().length, this.bossLast, justKilled, s.bossMinSurvivors, s.bossMaxMoves, s.bossKillEvery, !!s.raid, !!s.bossNoStrikes];
    const m = this.bossViewMemo;
    if (m && m.same.length === same.length && m.same.every((x, i) => x === same[i])) return m.view;
    const key = JSON.stringify([b, board.id, board.generation, board.fen, board.lastMove, board.history.join(" "), this.alive().length, this.bossLast, justKilled, s.bossMinSurvivors, s.bossMaxMoves, s.bossKillEvery, !!s.raid, !!s.bossNoStrikes]);
    this.bossViewMemo = { key, same, view: m?.key === key ? m.view : this.buildBossView(b, justKilled) };
    return this.bossViewMemo.view;
  }
  private bossViewMemo: { key: string; same: unknown[]; view: NetBoss } | null = null;

  private buildBossView(b: BossState, justKilled: string | null): NetBoss {
    const def = chooseBoss(0, b.id, null, undefined, true, true);
    const info = { name: def.name, icon: def.icon, threat: bossThreat(b.elo) };
    // (His bar's level: the battle's own, and what his strength now makes of it; "???" for the Hidden Boss.)
    // (The Hidden Boss's child: his level from his Maia rating, rising a step at a time from his first: RECLUSE_CHILD.)
    const child = b.form === "child" ? this.childRatingNow(b) : null;
    const rating = child !== null ? RECLUSE_CHILD.startRating : bossRatingShown(b.elo, this.settings);
    const levelBase = def.levelUnknown && child === null ? null : bossLevelBase(rating, b.powers?.seed ?? 0);
    const strength = this.bossStrengthNow(b);
    const nowRating = child ?? rating;
    const levelNow = levelBase === null ? null : bossLevelNow(levelBase, rating, strength === "full" ? ENGINE_MAX_ELO : strength === "weak" ? nowRating - BOSS_LEVEL.weakDrop : nowRating);
    const fen = this.boards.get(this.state.boards[0]!)!.fen;
    const powers = bossPowers(b);
    const p = b.powers;
    const strikes = this.alive().length > (b.minSurvivors ?? this.settings.bossMinSurvivors) && !b.result && !bossRules(b)?.noStrikes && !this.settings.bossNoStrikes;
    return {
      board: netBoard(this.boards.get(this.state.boards[0]!)!),
      name: info.name,
      icon: info.icon,
      threat: info.threat,
      level: levelNow,
      ...(levelBase !== null ? { levelBase } : {}),
      crowdSide: b.crowdSide,
      crowdMoves: b.crowdMoves,
      maxMoves: this.settings.bossMaxMoves,
      strikeIn: strikes ? Math.max(0, this.settings.bossKillEvery - b.sinceKill) : null,
      kills: b.kills,
      startMove: Math.floor((b.startPly ?? 0) / 2) + 1,
      kingCharges: b.kingCharges ?? 0,
      kingMoves: b.kingMoves ?? [],
      kingStrikes: b.kingStrikes ?? [],
      staggerNext: !!b.staggerNext,
      raid: !!this.settings.raid,
      // (Hollow starts from the starting position: no opening to name.)
      openingName: this.settings.raid && (b.startPly ?? 0) > 0 ? netBoard(this.boards.get(this.state.boards[0]!)!).openingName : null,
      lastMove: this.bossLast,
      justKilled,
      lastStand: b.lastStand ?? null,
      barred: b.barred ?? null,
      ...(b.result ? { result: b.result } : {}),
      id: def.id,
      ...(b.form ? { form: b.form, formStep: this.childStepNow(b) } : {}),
      ...(powers && p
        ? {
            powers: {
              passive: powers.passive,
              ultimate: powers.ultimate,
              turn: p.turn,
              rage: rageOf(b),
              paused: ragePaused(b),
              warned: p.warnAt !== undefined && p.ultAt === undefined,
              ultAt: p.ultAt ?? null,
              ults: p.ults ?? 0,
              frozen: p.frozen ? { square: p.frozen.square, until: p.frozen.until } : null,
              pie: p.pies?.length ? { ...p.pies[p.pies.length - 1]! } : null,
              pies: (p.pies ?? []).map((x) => ({ ...x })),
              // (Through the boss's turn too: the frozen piece, the blizzard's ice until it thaws.)
              iced: icedSquares(b, fen),
              // (The funhouse's angle as this crowd turn was set up: it turns as the next begins, with its moment.)
              angle: shownAngle(p.funhouse, p.turn),
              flipped: shownAngle(p.funhouse, p.turn) === 180,
              funhouse: p.funhouse ? { ...p.funhouse } : null,
              events: p.events,
              allowed: sideToMove(fen) === b.crowdSide ? crowdAllowed(b, fen) : null,
              fire: (p.fire ?? []).map((t) => ({ square: t.square, lit: t.lit, stage: fireStage(t, p.turn) })),
              burnt: p.burnt ?? [],
              candle: p.candle ? { at: p.candle.at, left: p.candle.left } : null,
              shadows: fireShadows(p),
              stepped: p.stepped ?? null,
              ultNext: !!p.ultNext,
              ...(bossRules(b)?.view?.(p) ?? {}),
            },
          }
        : {}),
    };
  }

  /** Sets up the boss battle after the last cut: a fresh board, the crowd as White, the boss's strength from the crowd's ratings. */
  private startBoss() {
    const id = this.state.boards[0] ?? 0;
    const old = this.boards.get(id)!;
    // From the game just played: a roughly even position between moves 5 and 12, White (the crowd) to move.
    let startPly = bossStartPly(old.evals ?? [], old.history.length);
    const alive = this.alive();
    // Which boss: always the Hidden Boss (Eric, Oct 14: crowdFinalBoss, for everyone, though he's hidden from players
    // everywhere else), whatever was picked or met last; with none marked, a random playable one, as in a raid. Its
    // strength: the crowd's plus its own offset (his is fixed). One draw from the match's random source either way, which
    // also seeds its powers.
    const seed = Math.floor(this.opts.rng() * 2 ** 32);
    // (He or a random boss only while not resting: a kill switch, rosterWithout.)
    const roster = rosterWithout(this.settings.bossesOff);
    const def = crowdFinalBoss(roster) ?? chooseBoss(seed / 2 ** 32, this.settings.bossId, this.settings.bossAvoid, roster, this.settings.bossUnfinished);
    // (A boss who plays from the starting position: Hollow, the Hidden Boss; Big Boy too, less the pawn he eats.)
    const start = bossRules(def)?.opening;
    // (After a Freestyle game, from the usual starting position too: his powers and Maia, his phase 1's brain, know only
    // normal chess; docs/decisions/2026-10-24-opening-vote.md.)
    if (start?.fromStart || baseAt(0, old.bases).fen !== START_FEN) startPly = 0;
    const opening = { ...BOSS_OPENING, moves: old.history.slice(0, startPly), expected: { [startPly]: old.evals?.[startPly] ?? 0.5 } };
    this.boards.set(id, { ...newBoard(id, opening, startPly, old.generation + 1), opening: BOSS_OPENING });
    let setUp = start?.setUp?.(this.battle, { boardId: id, seed, crowdSide: "w", generation: old.generation + 1 }) ?? null;
    // (Test switch, solo: the crowd White to move, mating in one, as in a raid; to see the final's boss beaten.)
    if (this.settings.bossWinTest) {
      startPly = WIN_TEST_MOVES.length;
      this.boards.set(id, { ...newBoard(id, { ...BOSS_OPENING, moves: [...WIN_TEST_MOVES] }, startPly, old.generation + 1), opening: BOSS_OPENING });
      setUp = null;
    }
    // From the people's ratings (Eric, Oct 12: "the crowd's ratings, people only"); all bots left: theirs.
    const people = alive.filter((p) => !p.isBot);
    const tier = bossElo((people.length ? people : alive).map((p) => estimateRating(p.lossesByStage.flat())), this.settings);
    const elo = bossStrength(tier, def, this.settings.bossDifficulty);
    this.bossLast = null;
    this.state = {
      ...this.state,
      boards: [id],
      // One crowd now: no teams.
      // Their leftover power-ups become the King's charges.
      players: this.state.players.map((p) => (p.alive ? { ...p, colour: null, finalLosses: [], powerUps: 0 } : p)),
      boss: {
        id: def.id,
        ...this.firstForm(def.id),
        powers: { ...initPowers(seed, this.boards.get(id)!.fen, "w"), ...(setUp ?? {}) },
        tier,
        elo,
        crowdSide: "w",
        startPly,
        clockFromMove: moveNumber(old.fen),
        crowdMoves: 0,
        sinceKill: 0,
        kills: [],
        kingCharges: kingCharges(alive.reduce((n, p) => n + p.powerUps, 0), this.settings),
        kingMoves: [],
      },
    };
    this.preparePowers();
  }

  // ---------------- Team final ----------------

  /** Team final: after a turn, the weakest on each side go out when a step ends. Returns who went out. */
  afterFinalTurn(): string[] {
    if (!this.state.final || this.finalGameOver()) return [];
    const step = teamFinalStep(this.state, this.opts.rng, this.settings);
    this.state = step.state;
    return step.out;
  }

  /** The final board's game has ended. */
  private finalGameOver(): boolean {
    const id = this.state.boards[0];
    return id !== undefined && boardStatus(this.boards.get(id)!).gameOver;
  }

  /** Ends the final: finalists placed 1st to 4th by move quality (a tie goes to the team that won the game). */
  finishFinal() {
    const f = this.state.final!;
    const board = this.boards.get(this.state.boards[0]!)!;
    let winningTeam: 0 | 1 | null = null;
    if (finalToTheEnd(f)) {
      // Played to the end (or the cap): the winner of the game, by mate or the engine's verdict.
      const winner = this.gameWinner();
      const side0 = this.player(f.teams[0][0]!).colour;
      if (winner && side0) winningTeam = winner === side0 ? 0 : 1;
    } else if (boardEnd(board) === "checkmate") {
      // The side that just moved delivered mate. teams[0] started as the side to move at the final's start.
      const matedSide = sideToMove(board.fen);
      const startSide = f.turn % 2 === 0 ? matedSide : matedSide === "w" ? "b" : "w";
      winningTeam = matedSide === startSide ? 1 : 0;
    }
    this.state = finishFinal(this.state, this.opts.rng, winningTeam, this.settings);
  }

  /** The final's teams and turn, for the screens. */
  get final() {
    return this.state.final ?? null;
  }

  /** The final as sent to the screens; `last` is the move just played (if any). */
  finalView(last: NetFinal["last"] = null, justOut: string[] = []): NetFinal | null {
    const f = this.state.final;
    if (!f) return null;
    const board = this.boards.get(this.state.boards[0]!)!;
    const done = this.stageComplete();
    const scores: NetFinal["scores"] = {};
    for (const id of [...f.order, ...(f.out ?? []).map((o) => o.id)]) {
      const p = this.player(id);
      const l = p.finalLosses;
      const ml = matchLoss(p, this.settings);
      scores[id] = {
        avg: l.length ? Math.round((l.reduce((s, x) => s + x, 0) / l.length) * 10) / 10 : null,
        moves: l.length,
        matchLoss: Number.isFinite(ml) ? Math.round(ml * 10) / 10 : null,
        rating: estimateRating(p.lossesByStage.flat()),
      };
    }
    return {
      board: netBoard(board),
      teams: f.teams,
      order: f.order,
      turn: f.turn,
      totalTurns: finalToTheEnd(f) ? this.settings.finalMaxTurns : f.order.length * this.settings.finalMovesPerPlayer,
      mover: done ? null : finalMover(f),
      scores,
      last,
      format: f.format ?? "classic",
      cutIn: teamFinalCutIn(f, this.settings),
      out: f.out ?? [],
      justOut,
    };
  }

  /** Ends the stage: knockouts, then shrink to the most balanced boards. */
  endStage() {
    const plan = stagePlan(this.settings);
    // The plan's boards for the next stage, or more when ties at the cut line kept more players in (cutPlan): never more
    // than groupSize a board on average, so groups keep their size (one board fewer each cut, as long as the numbers allow).
    const survivors = this.alive().length - cutCount(this.state, this.settings);
    const nextBoards = Math.max(plan[this.state.stage + 1]?.boards ?? 1, Math.ceil(survivors / this.settings.groupSize));
    // One board fewer each cut (finished games first, then the most lopsided); boards are never swapped.
    // Keep both sides to move as even as possible, so each color still has boards to play on.
    const status = this.state.boards.map((id) => boardStatus(this.boards.get(id)!));
    const count = Math.min(nextBoards, this.state.boards.length);
    const sides = this.boardSides();
    const white = status.filter((b) => sides.get(b.id) === "w");
    const black = status.filter((b) => sides.get(b.id) === "b");
    let keepWhite = Math.min(white.length, Math.ceil(count / 2));
    const keepBlack = Math.min(black.length, count - keepWhite);
    keepWhite = Math.min(white.length, count - keepBlack);
    const keep =
      this.settings.colourPerStage && count >= 2
        ? [...keepBoards(white, keepWhite), ...keepBoards(black, keepBlack)]
        : keepBoards(status, count);
    const end = endStage(this.state, this.opts.rng, keep, this.settings);
    this.state = end.state;
    if (!isTeamMatch(this.settings)) this.state = assignColours(this.state, this.opts.rng, this.whiteSeats());
    if (isTeamMatch(this.settings) && this.settings.finalFormat === "boss" && this.isFinal() && !this.state.boss) this.startBoss();
    const f = this.state.final;
    if (f && isTeamMatch(this.settings)) {
      // teams[0] must be the side to move when the final starts.
      const side = sideToMove(this.boards.get(this.state.boards[0]!)!.fen);
      if (this.player(f.teams[0][0]!).colour !== side) {
        const [a, b] = f.teams;
        this.state = { ...this.state, final: { ...f, teams: [b, a], order: interleave(b, a) } };
      }
    }
    return { ...end, state: this.state };
  }

  /** The live leaderboard: alive players best first, then knocked-out players by placement. */
  leaderboard(): NetStanding[] {
    const dp = this.settings.crowdScoring ? 100 : 10;
    const streakFrom = this.settings.crowdScoring?.streakFrom;
    const row = (p: PlayerState): NetStanding => ({
      id: p.id,
      name: p.name,
      // (Crowd 50 v 50's scores are kept to 2 decimals: CrowdScoring.)
      points: Math.round(standingPoints(p, this.settings) * dp) / dp,
      stageScore: Math.round(p.stageScore * dp) / dp,
      avg: p.stageRounds ? Math.round((p.stageScore / p.stageRounds) * dp) / dp : 0,
      bankMs: p.bankMs,
      avgThinkMs: p.movesTimed ? Math.round(p.thinkMsTotal / p.movesTimed) : 0,
      rating: estimateRating(p.lossesByStage.flat()),
      powerUps: p.powerUps,
      powerUpsUsed: p.powerUpsUsed,
      practice: p.practice,
      isBot: p.isBot,
      out: !p.alive,
      placement: p.placement,
      team: isTeamMatch(this.settings) ? p.colour : null,
      // (The scoreboard's fire from streakFrom in a row: CrowdScoring.)
      ...(streakFrom !== undefined && p.alive && (p.streak ?? 0) >= streakFrom ? { streak: p.streak } : {}),
    });
    const alive = standings(this.state, () => 0.5, this.settings);
    const out = this.state.players.filter((p) => !p.alive).sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99));
    // Who the stage's cut would take now (ties at the line go through), so every screen draws the same line.
    const cut = new Set(this.state.final || this.state.boss ? [] : cutPlan(this.state, alive, this.settings).out);
    return [...alive, ...out].map((p) => (cut.has(p.id) ? { ...row(p), cut: true } : row(p)));
  }

  /** How many of those still in would go through if the stage's cut came now (ties at the line go through: cutPlan). */
  cutoff(): number {
    return this.alive().length - (this.state.final || this.state.boss ? 0 : cutCount(this.state, this.settings));
  }

  /**
   * Who won the game on the board when the match ended: the side that mated,
   * or the side the engine rates clearly ahead (60%+) if it's unfinished;
   * otherwise a draw (null).
   */
  gameWinner(): Side | null {
    const id = this.state.boards[0];
    if (id === undefined) return null;
    const board = this.boards.get(id)!;
    const end = boardEnd(board);
    const toMove = sideToMove(board.fen);
    const other: Side = toMove === "w" ? "b" : "w";
    if (end === "checkmate") return other;
    if (end) return null;
    return board.expected >= 0.6 ? toMove : board.expected <= 0.4 ? other : null;
  }

  isFinal(): boolean {
    return isFinal(this.state, this.settings);
  }

  /** The match is over: everyone placed. */
  isOver(): boolean {
    return this.state.players.every((p) => p.placement !== null);
  }

  alive(): PlayerState[] {
    return alivePlayers(this.state);
  }

  // ---- Leaving the match (settings.ts, LEAVING) ----

  /**
   * Someone leaves for good and `bot` takes their seat from now on, under a new id: the seat's score, bank, power-ups,
   * team, losses and turns in a final carry on as the bot's (the person's own result is taken before this). In the
   * middle of a round the seat simply has no pick of its own this time.
   */
  handOver(id: string, bot: { id: string; name: string; skill: number }): void {
    const rename = (x: string) => (x === id ? bot.id : x);
    const s = this.state;
    const f = s.final;
    this.state = {
      ...s,
      players: s.players.map((p) =>
        p.id === id
          ? { ...p, id: bot.id, name: bot.name, isBot: true, skill: bot.skill, practice: false, lastGroupmates: p.lastGroupmates.map(rename) }
          : p.lastGroupmates.includes(id)
            ? { ...p, lastGroupmates: p.lastGroupmates.map(rename) }
            : p,
      ),
      ...(f ? { final: { ...f, order: f.order.map(rename), teams: [f.teams[0].map(rename), f.teams[1].map(rename)] as [string[], string[]] } } : {}),
    };
    this.groups = new Map([...this.groups].map(([b, ids]) => [b, ids.map(rename)]));
    // (A runner the lobby server restored has these only once a move has been dealt.)
    this.kingCallers?.delete(id);
    this.kingStrikers?.delete(id);
  }

  /**
   * Someone leaves for good and nobody takes their seat: they're out now, in the last place still open (where a cut
   * would put them; the later cuts place below it). Returns their placement (already out: the one they had).
   */
  retire(id: string): number {
    const p = this.state.players.find((x) => x.id === id);
    if (!p) return this.state.players.length;
    if (!p.alive) return p.placement ?? this.alive().length + 1;
    const place = this.alive().length;
    this.state = { ...this.state, players: this.state.players.map((x) => (x.id === id ? { ...x, alive: false, outInStage: this.state.stage, placement: place } : x)) };
    this.groups = new Map([...this.groups].map(([b, ids]) => [b, ids.filter((x) => x !== id)]));
    this.kingCallers?.delete(id);
    this.kingStrikers?.delete(id);
    return place;
  }

  /** Before move 1: someone who leaves and whose seat nobody takes is simply gone (no place, no result). */
  withdraw(id: string): void {
    this.state = { ...this.state, players: this.state.players.filter((p) => p.id !== id) };
    this.groups = new Map([...this.groups].map(([b, ids]) => [b, ids.filter((x) => x !== id)]));
  }
}
