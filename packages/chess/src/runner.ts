import {
  alivePlayers,
  isTeamMatch,
  openingPlies,
  allowedMs,
  applyRound,
  assignColours,
  assignGroups,
  botChoose,
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
  stageComplete,
  stagePlan,
  type GroupEvaluation,
  type GroupResult,
  type BossState,
  type MatchState,
  type PlayerState,
  type RetireReason,
  type Rng,
  type Settings,
  type Side,
  estimateRating,
  standingPoints,
  standings,
  bossElo,
  bossStrength,
  bossThreat,
  chooseBoss,
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
import { BOSS_OPENING, boardEnd, boardStatus, newBoard, playOnBoard, recentMoves, type BoardState } from "./boards.ts";
import { pickOpenings, type Opening } from "./openings.ts";
import { applyMove, legalMoves, moveNumber, pieceAt, sideToMove, toSan } from "./rules.ts";
import type { MoveScore } from "./uci.ts";
import {
  allowedSearch,
  bossAllowed,
  boardFlipped,
  crowdAllowed,
  icedSquares,
  initPowers,
  judgeCandidates,
  powerTurn,
  prepareTurn,
  rageOf,
  bossPowers,
  ablaze,
  bossRules,
  fireShadows,
  fireStage,
  judgeEvaluation,
  judgeMustScore,
  judgeRanked,
  triggerUltimate,
  type LightsTally,
  darkSquares,
  bigboyBattle,
  boingoBattle,
  hollowBattle,
  moveLoss,
  type Battle,
  type BossLastMove,
} from "./boss-powers.ts";
import type { BounceResult, LightsOutTest } from "@chessroyale/core";

/**
 * Runs a match round by round: deal, collect picks, score with the engine, draw,
 * rotate. Used by the simulation (all bots) and the solo build (one human).
 * The engine is any object with `topMoves` and `scoreMoves`; several engines
 * can be passed to search boards in parallel.
 */
export interface EngineLike {
  topMoves(fen: string, n: number): Promise<MoveScore[]>;
  scoreMoves(fen: string, moves: readonly string[]): Promise<MoveScore[]>;
  /** A move at a limited strength (the boss); engines without it play their top move. */
  playAtElo?(fen: string, elo: number, nodes?: number): Promise<string>;
  /** A deeper search over a few moves (the re-check); engines without it skip the re-check. */
  scoreMovesAt?(fen: string, moves: readonly string[], nodes: number): Promise<MoveScore[]>;
  /** Top moves at another budget (the Big Bounce's quick look at a few positions); engines without it use topMoves. */
  topMovesAt?(fen: string, n: number, nodes: number): Promise<MoveScore[]>;
}

/** The re-check's settings (see recheckLoss, recheckMax, recheckNodes and recheckCut* in settings). */
export interface RecheckSettings {
  recheckLoss: readonly [number, number];
  recheckMax: number;
  recheckNodes: number;
  /** Picks that can decide a cut (`priority`): re-checked first, over this wider range of losses, up to this many. */
  recheckCutLoss?: readonly [number, number];
  recheckCutMax?: number;
}

type Evaluation = { bestMove: string; bestExpected: number; expectedAfter: Record<string, number> };

/**
 * Which picks the re-check searches again: those losing between recheckLoss[0] and [1] points, the most picked
 * first, up to recheckMax. Picks that can decide a cut (`priority`, from the lobby: players near the cut line) come
 * first, over the wider recheckCutLoss range, up to recheckCutMax of them; the rest fill up to recheckMax.
 * The same choice on every device and on the server (it's how a judge's re-check is verified).
 */
export function recheckTargets(evaluation: Evaluation, picks: readonly (string | null)[], s: RecheckSettings, priority: readonly string[] = []): string[] {
  if (s.recheckMax <= 0) return [];
  const best = Math.max(evaluation.bestExpected, ...picks.flatMap((m) => (m && evaluation.expectedAfter[m] !== undefined ? [evaluation.expectedAfter[m]!] : [])));
  const count = new Map<string, number>();
  for (const m of picks) if (m) count.set(m, (count.get(m) ?? 0) + 1);
  const lossOf = (m: string) => {
    const e = evaluation.expectedAfter[m];
    return e === undefined ? 0 : (best - e) * 100;
  };
  const byCount = (a: string, b: string) => count.get(b)! - count.get(a)! || (a < b ? -1 : a > b ? 1 : 0);
  const inRange = (m: string, [lo, hi]: readonly [number, number]) => m !== evaluation.bestMove && lossOf(m) >= lo && lossOf(m) <= hi;
  const wanted = new Set(priority);
  const first = s.recheckCutMax && s.recheckCutLoss
    ? [...count.keys()].filter((m) => wanted.has(m) && inRange(m, s.recheckCutLoss!)).sort(byCount).slice(0, s.recheckCutMax)
    : [];
  const rest = [...count.keys()].filter((m) => !first.includes(m) && inRange(m, s.recheckLoss)).sort(byCount).slice(0, Math.max(0, s.recheckMax - first.length));
  return [...first, ...rest];
}

/** Puts a re-check's deep numbers in: re-anchored to the deep number for the best move; a move that beats the best becomes it. */
export function applyRecheck(evaluation: Evaluation, flagged: readonly string[], deep: readonly MoveScore[]): Evaluation & { rechecked: string[] } {
  const deepBest = deep.find((m) => m.move === evaluation.bestMove);
  if (!flagged.length || !deepBest) return { ...evaluation, rechecked: [] };
  const shift = evaluation.bestExpected - deepBest.expected;
  const expectedAfter = { ...evaluation.expectedAfter };
  for (const m of deep) if (m.move !== evaluation.bestMove && flagged.includes(m.move)) expectedAfter[m.move] = Math.min(1, Math.max(0, m.expected + shift));
  let bestMove = evaluation.bestMove;
  let bestExpected = evaluation.bestExpected;
  for (const m of flagged) if ((expectedAfter[m] ?? 0) > bestExpected) [bestMove, bestExpected] = [m, expectedAfter[m]!];
  return { bestMove, bestExpected, expectedAfter, rechecked: [...flagged] };
}

/**
 * Re-checks the close calls before they cost anyone. The top-8 search gives each move only an eighth of the
 * budget, so a good move is now and then marked a mistake (reports/judge-accuracy.md). The picks recheckTargets
 * chooses are searched again with the best move, in one search restricted to them at recheckNodes, and those
 * numbers replace the first ones. Big losses are rechecked too (up to recheckLoss[1]): a sacrifice the quick
 * search called a blunder is the worst miss.
 */
export async function recheckCloseCalls(
  engine: EngineLike,
  fen: string,
  evaluation: Evaluation,
  picks: readonly (string | null)[],
  s: RecheckSettings,
  priority: readonly string[] = [],
): Promise<Evaluation & { rechecked: string[] }> {
  const none = { ...evaluation, rechecked: [] as string[] };
  if (!engine.scoreMovesAt) return none;
  const flagged = recheckTargets(evaluation, picks, s, priority);
  if (!flagged.length) return none;
  const deep = await engine.scoreMovesAt(fen, [evaluation.bestMove, ...flagged], s.recheckNodes);
  return applyRecheck(evaluation, flagged, deep);
}

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
  /** Boss battle: a boss power touched this turn (a frozen piece, a pie, the blizzard, a flipped board): no fair-play signal. */
  power?: boolean;
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

/** Each move's best reply and mate score from a set of searches, for a BoardEvaluation (the first search of a move wins). */
export function repliesFrom(searches: readonly (readonly MoveScore[])[]): { replies: Record<string, string>; mates: Record<string, number> } {
  const replies: Record<string, string> = {};
  const mates: Record<string, number> = {};
  for (const list of searches)
    for (const m of list) {
      if (m.reply && replies[m.move] === undefined) replies[m.move] = m.reply;
      if (m.mate !== undefined && mates[m.move] === undefined) mates[m.move] = m.mate;
    }
  return { replies, mates };
}

export interface RoundReport {
  stage: number;
  round: number;
  boards: BoardRound[];
  /** Boards replaced before this round was dealt, and why. */
  retired: { boardId: number; reason: RetireReason }[];
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
 * Top-move searches started early (while players are still thinking), keyed by
 * position. Boards are known when a round starts and the top-moves search
 * doesn't depend on anyone's pick, so only picks outside the top moves need a
 * search after the picks lock.
 */
export class TopMovesCache {
  private searches = new Map<string, Promise<MoveScore[]>>();
  constructor(private readonly n: number) {}

  /** Starts a search for each position, spread across the engines; forgets older positions. */
  prefetch(engines: readonly EngineLike[], fens: readonly string[]): void {
    const keep = new Map<string, Promise<MoveScore[]>>();
    fens.forEach((fen, i) => {
      let search = this.searches.get(fen);
      if (!search) {
        search = engines[i % engines.length]!.topMoves(fen, this.n);
        search.catch(() => this.searches.delete(fen));
      }
      keep.set(fen, search);
    });
    this.searches = keep;
  }

  /** The prefetched search for this position, or a fresh one on `engine`. */
  get(engine: EngineLike, fen: string): Promise<MoveScore[]> {
    return this.searches.get(fen) ?? engine.topMoves(fen, this.n);
  }
}

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
    },
  ) {
    this.top = new TopMovesCache(opts.settings.botCandidateMoves);
    const plan = stagePlan(opts.settings);
    const boardCount = plan[0]?.boards ?? 1;
    const plies = openingPlies(opts.settings);
    // With colours per stage, half the boards have White to move and half Black (the opening one ply longer).
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
  }

  /** Boss raid: the boss is there from the start, on a named opening; strikes stop at half the group; the King has every charge. */
  private startRaid() {
    const id = this.state.boards[0]!;
    const board = this.boards.get(id)!;
    const n = this.alive().length;
    this.bossLast = null;
    // Which boss: the one picked, else a random playable one (not the one to avoid). One draw from the match's random
    // source, which also seeds its powers.
    const seed = Math.floor(this.opts.rng() * 2 ** 32);
    const def = chooseBoss(seed / 2 ** 32, this.settings.bossId, this.settings.bossAvoid, undefined, this.settings.bossUnfinished);
    let crowdSide = sideToMove(board.fen);
    // A boss whose battle starts from the starting position (no opening moves), and one who always plays Black (Hollow):
    // if the usual pick made the crowd Black, he claims the dark side before move 1.
    const opening = bossRules(def)?.opening;
    const claimed = !!opening?.crowdWhite && crowdSide === "b";
    if (opening?.fromStart) this.boards.set(id, newBoard(id, BOSS_OPENING, 0, board.generation));
    if (opening?.crowdWhite) crowdSide = "w";
    // Anything else the boss does to the board before move 1 (Big Boy eats one of the crowd's centre pawns).
    const setUp = opening?.setUp?.(this.battle, { boardId: id, seed, crowdSide, generation: board.generation }) ?? null;
    const fen = this.boards.get(id)!.fen;
    this.state = {
      ...this.state,
      players: this.state.players.map((p) => ({ ...p, colour: null, powerUps: 0 })),
      boss: {
        id: def.id,
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

  /** Boss battle: the powers for the crowd turn about to begin (once per turn; see prepareTurn). */
  private preparePowers() {
    const b = this.state.boss;
    if (!b?.powers || this.finalGameOver()) return;
    const board = this.boards.get(this.state.boards[0]!)!;
    if (sideToMove(board.fen) !== b.crowdSide) return;
    // (The boss's move just played: Hollow covers its piece's square after his first.)
    this.state = { ...this.state, boss: prepareTurn(b, board.fen, this.settings.bossPowerTest, BOSS_POWERS, board.lastMove) };
  }

  /** Boss battle, Hollow's dark: the squares covered this turn (their pieces hidden; a move touching one goes unchecked). */
  darkSquares(): string[] {
    return darkSquares(this.state.boss);
  }

  /** Hollow's dark: a move attempt that touches a dark square, sent unchecked (see hollowBattle.darkTry). */
  darkTry(playerId: string, move: string): { kind: "move"; move: string } | { kind: "wrong"; tries: number; out: boolean } | { kind: "refused" } {
    return hollowBattle.darkTry(this.battle, playerId, move);
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

  /** How many players play White this stage: half (null when colours aren't fixed: one board left, or the final). */
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
    return moveClockAt(this.settings, this.clockMove(boardId));
  }

  /** How long a player may think this round: their bank plus the increment, capped by this move's clock. */
  allowedMsFor(playerId: string): number {
    const board = [...this.groups].find(([, ids]) => ids.includes(playerId))?.[0];
    return allowedMs(this.player(playerId), this.settings, this.clockMove(board));
  }

  /** The settings with this round's clock fixed in moveClockSeconds (for the bots' timing and capping think times). */
  private roundSettings(): Settings {
    return { ...this.settings, moveClockSeconds: this.moveClock(), moveClockSteps: [] };
  }

  /** Pre-game votes: settings from the winning options (how it ends, the clock) for the rest of the match. */
  patchSettings(patch: Partial<Settings>): void {
    this.opts.settings = { ...this.opts.settings, ...patch };
  }

  private replaceBoard(id: number): void {
    const old = this.boards.get(id)!;
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

  /**
   * The engine's top moves in a position (shared with scoring, so a prefetched search is reused). Boss battle, the
   * crowd's turn: only the moves allowed this turn (a power's limits; the Last Stand's barred move), as the judge
   * sees them, so a power-up's hints and the eval bar follow the crowd's rules too.
   */
  async topMovesFor(fen: string): Promise<MoveScore[]> {
    const engine = this.opts.engines[0]!;
    const all = await this.top.get(engine, fen);
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
      const choice = botChoose(this.opts.rng, candidates, p, legal, this.settings);
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
    const botPicks = this.botPicksFor(boardId, playerIds, top);
    const picks: Record<string, string | null> = {};
    for (const id of playerIds) picks[id] = this.player(id).isBot ? botPicks[id]! : (humanPicks.get(id)?.move ?? null);
    const known = new Map(top.map((m) => [m.move, m.expected]));
    for (const m of open ?? []) known.set(m.move, m.expected);
    // (The boss's rules for the judge, e.g. G-REX's fire: every move that takes a piece off a tile ablaze is scored too.)
    const escapes = judgeMustScore(this.state.boss, board.fen).filter((m) => !allowed || allowed.includes(m));
    const missing = [...new Set([...Object.values(picks), ...escapes].flatMap((m) => (m && !known.has(m) ? [m] : [])))];
    const extra = [...(open ?? []), ...(missing.length ? await engine.scoreMoves(board.fen, missing) : [])];
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
    // path's numbers come in raw).
    const evaluation = judgeEvaluation(this.state.boss, limited.evaluation, board.fen);
    // Boss battle: humans who called the King instead of picking abstain: no score, not a miss.
    const abstained = new Set(this.state.boss ? playerIds.filter((id) => !picks[id] && !this.player(id).isBot && this.kingCallers.has(id)) : []);
    const result = scoreGroup(
      playerIds.filter((id) => !abstained.has(id)).map((id) => ({ playerId: id, move: picks[id] ?? null })),
      evaluation,
      this.opts.rng,
      this.settings,
      drawRuleFor(this.state.stage, this.settings),
    );
    const pickedExpected = playerIds.flatMap((id) => {
      const m = picks[id];
      return m && evaluation.expectedAfter[m] !== undefined ? [evaluation.expectedAfter[m]!] : [];
    });
    const best = Math.max(evaluation.bestExpected, ...pickedExpected);
    const scored = Object.entries(evaluation.expectedAfter)
      .map(([move, expected]) => ({ move, expected, loss: Math.max(0, (best - expected) * 100) }))
      .sort((a, b) => b.expected - a.expected);
    for (const id of abstained) result.players.push({ playerId: id, move: null, loss: null, roundScore: 0, abstained: true });
    // The boss's own costs on the round (Hollow's wrong attempts into the dark).
    if (this.state.boss) bossRules(this.state.boss)?.scoreRound?.(this.battle, result.players);
    const king = this.kingDecision(playerIds, result);
    if (king.plays) result.playedMove = evaluation.bestMove;
    const lastStand = king.plays ? undefined : this.lastStandFor(board.fen, result.playedMove, best, scored, rawEvaluation);
    return {
      boardId,
      fenBefore: board.fen,
      playerIds: [...playerIds],
      result,
      scored,
      bestMove: evaluation.bestMove,
      ...(this.state.boss ? { king: king.plays, kingCalls: king.calls } : {}),
      ...(lastStand ? { lastStand } : {}),
      ...(powerTurn(this.state.boss) ? { power: true } : {}),
    };
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
   * (lastStandFrom). The judge's numbers decide, as given.
   */
  private lastStandFor(
    fen: string,
    played: string,
    best: number,
    scored: readonly { move: string; expected: number; loss: number }[],
    evaluation: BoardEvaluation,
  ): LastStandRound | undefined {
    const b = this.state.boss;
    // (Never when only one move was open: his re-pick has to leave the crowd another, a power's limits included.)
    if (!b || b.lastStand || b.barred || (crowdAllowed(b, fen) ?? legalMoves(fen)).length < 2) return undefined;
    const mine = scored.find((m) => m.move === played);
    const loss = mine?.loss ?? 0;
    const charges = b.kingCharges ?? 0;
    const bar = Math.round(lastStandBar(best, b.crowdMoves, charges, this.settings) * 10) / 10;
    if (!this.forceLastStand && !lastStandDue(loss, best, b.crowdMoves, charges, this.settings)) return undefined;
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
   * Boss battle: the King plays (the engine's best move, at full strength: stronger than the boss) when more than
   * half the crowd calls him and he has a charge left. Bots call him when the crowd's popular move would lose
   * kingBotLoss points or more, and back a human's call with kingBotFollow chance.
   */
  private kingDecision(playerIds: readonly string[], result: GroupResult): { plays: boolean; calls: number } {
    const b = this.state.boss;
    if (!b || !(b.kingCharges ?? 0)) return { plays: false, calls: 0 };
    const humans = playerIds.filter((id) => this.kingCallers.has(id)).length;
    const popularLoss = result.players.find((p) => p.move === result.playedMove)?.loss ?? 0;
    let calls = humans;
    for (const id of playerIds) {
      if (!this.player(id).isBot) continue;
      if (popularLoss >= this.settings.kingBotLoss || (humans > 0 && this.opts.rng() < this.settings.kingBotFollow)) calls++;
    }
    return { plays: calls * 2 > playerIds.length, calls };
  }

  /**
   * Boss battle: `playerId` calls for the King's strike, in the middle of the crowd's move. He strikes at once
   * when more than half the crowd has called (bots never start one, but back a human's call with kingBotFollow
   * chance): a charge is spent and the boss's next move is a weaker one. The move itself goes on: everyone
   * still picks. One strike per move. Returns whether he struck, and how many have called.
   */
  callStrike(playerId: string): { struck: boolean; calls: number } {
    const b = this.state.boss;
    const ids = [...this.groups.values()][0] ?? [];
    if (!b || !(b.kingCharges ?? 0) || b.staggerNext || !ids.includes(playerId)) return { struck: false, calls: 0 };
    this.kingStrikers.add(playerId);
    this.strikeBots ??= ids.filter((id) => this.player(id).isBot && this.opts.rng() < this.settings.kingBotFollow).length;
    const calls = ids.filter((id) => this.kingStrikers.has(id)).length + this.strikeBots;
    if (calls * 2 <= ids.length) return { struck: false, calls };
    this.state = {
      ...this.state,
      boss: { ...b, kingCharges: Math.max(0, (b.kingCharges ?? 0) - 1), kingStrikes: [...(b.kingStrikes ?? []), b.crowdMoves + 1], staggerNext: true },
    };
    return { struck: true, calls };
  }

  /** Applies scored boards: updates scores and plays the drawn moves. */
  finishRound(
    results: readonly BoardRound[],
    thinkMs: Readonly<Record<string, number>>,
    usedPowerUp: ReadonlySet<string> = new Set(),
  ): RoundReport {
    const think: Record<string, number> = { ...thinkMs };
    for (const r of results) for (const p of r.playerIds) think[p] ??= this.botThink.get(p) ?? 0;
    const used = new Set([...usedPowerUp, ...this.botPowerUps]);
    this.botPowerUps = new Set();
    // Marked on the results (sent to every screen): a pick made with a power-up is never brilliant.
    for (const r of results) for (const p of r.result.players) if (used.has(p.playerId)) p.usedPowerUp = true;
    const outcomes = results.flatMap((r) => outcomesFromGroup(r.result, think, used));
    const kingPlayed = results.some((r) => r.king);
    const stand = results.find((r) => r.lastStand)?.lastStand;
    // (With this round's clock, worked out before the move count moves on.)
    this.state = applyRound(this.state, this.groups, outcomes, this.roundSettings());
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
    for (const r of results) {
      if (r.lastStand) continue;
      const board = this.boards.get(r.boardId)!;
      const moverExpected = r.scored.find((s) => s.move === r.result.playedMove)?.expected ?? board.expected;
      this.boards.set(r.boardId, playOnBoard(board, r.result.playedMove, moverExpected));
      // Boss battle: the judged eval feeds the ultimate's meter, and the boss's own after-move effect (G-REX's fire
      // burns what was left on its tiles).
      if (this.state.boss?.powers) {
        this.state = { ...this.state, boss: { ...this.state.boss, powers: { ...this.state.boss.powers, judged: moverExpected } } };
        this.afterCrowdMove(r.result.playedMove);
      }
    }
    return { stage: this.state.stage, round: this.state.round - 1, boards: [...results], retired: this.retiredThisRound };
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
    opts: { settings: Settings; rng: Rng; engines: readonly EngineLike[]; library: readonly Opening[] },
  ): MatchRunner {
    const byId = new Map(opts.library.map((o) => [o.id, o]));
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
    });
    // The boss battle's board isn't in the opening library.
    for (const [id, b] of runner.boards) if (!b.opening) runner.boards.set(id, { ...b, opening: BOSS_OPENING });
    return runner;
  }

  stageComplete(): boolean {
    if (this.state.boss) return this.finalGameOver() || this.state.boss.crowdMoves >= this.settings.bossMaxMoves;
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

  /** How the boss plays its next move: staggered by the King's strike, stumbling (a weak boss), or at its strength. */
  bossMoveKind(): BossMoveKind {
    if (this.state.boss?.staggerNext) return "stagger";
    return this.bossStumbles() ? "stumble" : "elo";
  }

  /** The boss's move from an engine (at its strength), played on the board. */
  async playBoss(engine: EngineLike = this.opts.engines[0]!): Promise<string> {
    const fen = this.boards.get(this.state.boards[0]!)!.fen;
    const kind = this.bossMoveKind();
    const move = await bossMoveFrom(engine, fen, this.state.boss!.elo, this.settings.bossNodes, kind, this.opts.rng, this.settings.kingStrikeLoss, bossGuardFrom(this.settings), this.bossAllowed());
    this.applyBossMove(move, kind === "stagger");
    return move;
  }

  /** The moves the boss may play now (a pie stops it too), or null: any legal move. */
  bossAllowed(): string[] | null {
    return bossAllowed(this.state.boss, this.boards.get(this.state.boards[0]!)!.fen);
  }

  /**
   * Plays the boss's move (from the host's engine online). An illegal move (or one onto a pie) is replaced by the
   * first allowed one. Then the crowd's next turn begins: its powers are set (a freeze, a pie, the ultimate).
   */
  applyBossMove(move: string, staggered = !!this.state.boss?.staggerNext): string {
    const id = this.state.boards[0]!;
    const board = this.boards.get(id)!;
    const legal = this.bossAllowed() ?? legalMoves(board.fen);
    const m = legal.includes(move) ? move : legal[0]!;
    this.boards.set(id, playOnBoard(board, m, 1 - board.expected));
    const captured = pieceAt(board.fen, m.slice(2, 4))?.type;
    this.bossLast = { move: m, san: toSan(board.fen, m), ...(staggered ? { staggered: true } : {}), ...(captured ? { captured } : {}) };
    if (this.state.boss?.staggerNext) this.state = { ...this.state, boss: { ...this.state.boss, staggerNext: false } };
    this.preparePowers();
    return m;
  }

  /** Boss battle: the boss plays the crowd's move this turn (its funhouse), before the crowd picks. */
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

  /** After the crowd's move: the boss's own effect, if it has one (G-REX's fire: what was left on a tile ablaze burns). */
  private afterCrowdMove(move: string | null) {
    const b = this.state.boss;
    if (b) bossRules(b)?.afterCrowdMove?.(this.battle, move);
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

  /** Hollow's extra move is due: the crowd failed Lights out, and he has played his own move. */
  extraMoveDue(): boolean {
    return hollowBattle.extraMoveDue(this.battle);
  }

  /** His extra move: a quiet one that gains him only a little (extraMoveFrom), from this device's engine. */
  async playExtraMove(engine: EngineLike = this.opts.engines[0]!): Promise<string | null> {
    return hollowBattle.playExtraMove(this.battle, engine);
  }

  /** Plays his extra move (from the host's engine online; see hollowBattle.applyExtraMove). Returns it, or null. */
  applyExtraMove(move: string | null): string | null {
    return hollowBattle.applyExtraMove(this.battle, move);
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
      memo: runner.bossMemo,
    };
  }

  /** The boss strikes now (every bossKillEvery crowd moves). */
  bossKillDue(): boolean {
    return bossKillDue(this.state, this.settings) && !this.finalGameOver();
  }

  /** The boss strikes down the player with the worst recent moves; returns who. */
  bossKill(): string | null {
    const k = bossKill(this.state, this.opts.rng, this.settings);
    this.state = k.state;
    return k.victim;
  }

  /** Ends the boss battle: the result from the board (mate, a draw, or the engine's verdict at the move cap). */
  finishBossBattle(): "crowd" | "boss" | "draw" {
    const b = this.state.boss!;
    const winner = this.gameWinner();
    const result = winner === null ? "draw" : winner === b.crowdSide ? "crowd" : "boss";
    this.state = finishBoss(this.state, this.opts.rng, result, this.settings);
    return result;
  }

  /**
   * The boss battle as sent to the screens. Built once per change: a solo battle's screens ask for it many times on
   * every redraw (several a second), and building it (the board's view, the moves the powers allow) on every ask was
   * the lag that grew with the match (.claude/LESSONS.md: "Lag that grows with the match"). The key is everything the
   * view is made from, so a cached view is always the one a fresh build would give.
   */
  bossView(justKilled: string | null = null): NetBoss | null {
    const b = this.state.boss;
    if (!b) return null;
    const board = this.boards.get(this.state.boards[0]!)!;
    const s = this.settings;
    const key = JSON.stringify([b, board.id, board.generation, board.fen, board.lastMove, board.history.join(" "), this.alive().length, this.bossLast, justKilled, s.bossMinSurvivors, s.bossMaxMoves, s.bossKillEvery, !!s.raid]);
    if (this.bossViewMemo?.key !== key) this.bossViewMemo = { key, view: this.buildBossView(b, justKilled) };
    return this.bossViewMemo.view;
  }
  private bossViewMemo: { key: string; view: NetBoss } | null = null;

  private buildBossView(b: BossState, justKilled: string | null): NetBoss {
    const def = chooseBoss(0, b.id, null, undefined, true);
    const info = { name: def.name, icon: def.icon, threat: bossThreat(b.elo) };
    const fen = this.boards.get(this.state.boards[0]!)!.fen;
    const powers = bossPowers(b);
    const p = b.powers;
    const strikes = this.alive().length > (b.minSurvivors ?? this.settings.bossMinSurvivors) && !b.result;
    return {
      board: netBoard(this.boards.get(this.state.boards[0]!)!),
      name: info.name,
      icon: info.icon,
      threat: info.threat,
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
      ...(powers && p
        ? {
            powers: {
              passive: powers.passive,
              ultimate: powers.ultimate,
              turn: p.turn,
              rage: rageOf(b),
              warned: p.warnAt !== undefined && p.ultAt === undefined,
              ultAt: p.ultAt ?? null,
              frozen: p.frozen ? { square: p.frozen.square, until: p.frozen.until } : null,
              pie: p.pie ? { square: p.pie.square, until: p.pie.until } : null,
              iced: sideToMove(fen) === b.crowdSide ? icedSquares(b, fen) : p.frozen ? [p.frozen.square] : [],
              flipped: boardFlipped(b),
              funhouse: p.funhouse ?? null,
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
    // Which boss: a random playable one (as in a raid), at the crowd's strength plus its own offset.
    const seed = Math.floor(this.opts.rng() * 2 ** 32);
    const def = chooseBoss(seed / 2 ** 32, this.settings.bossId, this.settings.bossAvoid, undefined, this.settings.bossUnfinished);
    // (A boss who plays from the starting position: Hollow; Big Boy too, less the pawn he eats.)
    const start = bossRules(def)?.opening;
    if (start?.fromStart) startPly = 0;
    const opening = { ...BOSS_OPENING, moves: old.history.slice(0, startPly), expected: { [startPly]: old.evals?.[startPly] ?? 0.5 } };
    this.boards.set(id, { ...newBoard(id, opening, startPly, old.generation + 1), opening: BOSS_OPENING });
    const setUp = start?.setUp?.(this.battle, { boardId: id, seed, crowdSide: "w", generation: old.generation + 1 }) ?? null;
    const tier = bossElo(alive.map((p) => estimateRating(p.lossesByStage.flat())), this.settings);
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
    const nextBoards = plan[this.state.stage + 1]?.boards ?? 1;
    // One board fewer each cut (finished games first, then the most lopsided); boards are never swapped.
    // Keep both sides to move as even as possible, so each colour still has boards to play on.
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
    const row = (p: PlayerState): NetStanding => ({
      id: p.id,
      name: p.name,
      points: Math.round(standingPoints(p, this.settings) * 10) / 10,
      stageScore: Math.round(p.stageScore * 10) / 10,
      avg: p.stageRounds ? Math.round((p.stageScore / p.stageRounds) * 10) / 10 : 0,
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
    });
    const alive = standings(this.state, () => 0.5, this.settings);
    const out = this.state.players.filter((p) => !p.alive).sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99));
    return [...alive, ...out].map(row);
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
}

export type BossMoveKind = "elo" | "stumble" | "stagger";

/** The limits on a boss's moves (see bossSlipLoss, bossMaxLoss and bossMaxLogitLoss in settings). */
export interface BossGuard {
  slipLoss: readonly [number, number];
  maxLoss: number;
  maxLogitLoss: number;
}

export const DEFAULT_BOSS_GUARD: BossGuard = { slipLoss: [2, 7], maxLoss: 10, maxLogitLoss: 1 };

export const bossGuardFrom = (s: { bossSlipLoss: readonly [number, number]; bossMaxLoss: number; bossMaxLogitLoss: number }): BossGuard => ({
  slipLoss: s.bossSlipLoss,
  maxLoss: s.bossMaxLoss,
  maxLogitLoss: s.bossMaxLogitLoss,
});

/** Within the guard: never more than maxLoss points, nor more than maxLogitLoss log-odds (a couple of points is always fine). */
export function withinGuard(loss: { points: number; logit: number }, guard: BossGuard): boolean {
  return loss.points <= guard.maxLoss && (loss.logit <= guard.maxLogitLoss || loss.points <= 2);
}

/** From the top moves, the one nearest the middle of `range` (points lost) that the guard allows; the best if none is in range. */
function pickByLoss(top: readonly MoveScore[], range: readonly [number, number], guard: BossGuard): string {
  const best = top[0]!.expected;
  const scored = top.map((m) => ({ move: m.move, loss: moveLoss(best, m.expected) })).filter((m) => withinGuard(m.loss, guard));
  const [lo, hi] = range;
  const mid = (lo + hi) / 2;
  const inRange = scored.filter((m) => m.loss.points >= lo && m.loss.points <= hi);
  if (!inRange.length) return top[0]!.move;
  return [...inRange].sort((a, b) => Math.abs(a.loss.points - mid) - Math.abs(b.loss.points - mid))[0]!.move;
}

/**
 * The boss's move. "elo": Stockfish at its strength. "stumble" (a weak boss, now and then): a slip, a small
 * deliberate inaccuracy from its top moves. "stagger" (the King struck it): from its top moves, one that gives
 * away `strikeLoss` points: a clear step back. Every move then passes the blunder guard: Stockfish's limited
 * strength picks some moves that hang a piece or the queen; one that gives away more than the guard allows is
 * swapped for a slip. A boss loses on mistakes, never by throwing material away.
 */
export async function bossMoveFrom(
  engine: EngineLike,
  fen: string,
  elo: number,
  nodes: number,
  kind: BossMoveKind | boolean,
  _rng: Rng = Math.random,
  strikeLoss: readonly [number, number] = [5, 15],
  guard: BossGuard = DEFAULT_BOSS_GUARD,
  allowed: readonly string[] | null = null,
): Promise<string> {
  const k: BossMoveKind = kind === true ? "stumble" : kind === false ? "elo" : kind;
  // A boss power can stop the boss too (nobody moves onto a pie): it plays the best of what's allowed.
  const all = await engine.topMoves(fen, 8);
  const ok = allowed ? new Set(allowed) : null;
  let top = ok ? all.filter((m) => ok.has(m.move)) : all;
  if (ok && !top.length) top = await engine.scoreMoves(fen, [...ok]);
  if (!top.length) return allowed?.[0] ?? legalMoves(fen)[0]!;
  const bestMove = top[0]!.move;
  // A move other than the best is checked once more, head to head with the best in one focused search (the
  // eight-line search spreads itself thin and now and then misjudges a move); failing that, the best is played.
  const confirm = async (move: string, g: BossGuard): Promise<string> => {
    if (move === bestMove) return move;
    const scored = await engine.scoreMoves(fen, [bestMove, move]);
    const best = scored.find((m) => m.move === bestMove)?.expected;
    const got = scored.find((m) => m.move === move)?.expected;
    if (best === undefined || got === undefined) return bestMove;
    return withinGuard(moveLoss(Math.max(best, got), got), g) ? move : bestMove;
  };
  if (k === "stumble") return confirm(pickByLoss(top, guard.slipLoss, guard), guard);
  // The King's strike may give away more than a slip, up to its own range (still never a piece for nothing).
  if (k === "stagger") {
    const g = { ...guard, maxLoss: Math.max(guard.maxLoss, strikeLoss[1]), maxLogitLoss: Math.max(guard.maxLogitLoss, 1.5) };
    return confirm(pickByLoss(top, strikeLoss, g), g);
  }
  if (!engine.playAtElo) return bestMove;
  const move = await engine.playAtElo(fen, elo, nodes);
  if (ok && !ok.has(move)) return confirm(pickByLoss(top, guard.slipLoss, guard), guard);
  const best = top[0]!.expected;
  const got = top.find((m) => m.move === move)?.expected ?? (await engine.scoreMoves(fen, [move]))[0]?.expected ?? 0;
  return confirm(withinGuard(moveLoss(best, got), guard) ? move : pickByLoss(top, guard.slipLoss, guard), guard);
}

/** A board as sent to (and shown in) the app. */
/** Every board slot (live or closed), in slot order, for the strip of tiny boards. */
export function boardSlots(boards: Map<number, BoardState>, live: number[]): BoardSlot[] {
  return [...boards.values()]
    .sort((a, b) => a.id - b.id)
    .map((b) => ({ id: b.id, fen: b.fen, lastMove: b.lastMove, live: live.includes(b.id) }));
}

export function netBoard(b: BoardState, withOpening = false): NetBoard {
  const recent = recentMoves(b, 5);
  return {
    id: b.id,
    fen: b.fen,
    lastMove: b.lastMove,
    openingName: b.opening.names?.[b.openingPlies] ?? b.opening.name,
    generation: b.generation,
    ply: b.history.length,
    recent: recent.moves,
    recentFrom: recent.from,
    history: [...b.history],
    ...(b.bases?.length ? { bases: b.bases.map((x) => ({ ...x })) } : {}),
    ...(withOpening ? { openingMoves: b.history.slice(0, b.openingPlies) } : {}),
  };
}
