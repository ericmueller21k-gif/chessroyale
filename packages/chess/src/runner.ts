import {
  alivePlayers,
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
  type MatchState,
  type PlayerState,
  type RetireReason,
  type Rng,
  type Settings,
  type Side,
  estimateRating,
  standingPoints,
  standings,
} from "@chessroyale/core";
import type { BoardSlot, NetBoard, NetFinal, NetStanding } from "./protocol.ts";
import { boardEnd, boardStatus, newBoard, playOnBoard, recentMoves, type BoardState } from "./boards.ts";
import { pickOpenings, type Opening } from "./openings.ts";
import { legalMoves, sideToMove } from "./rules.ts";
import type { MoveScore } from "./uci.ts";

/**
 * Runs a match round by round: deal, collect picks, score with the engine, draw,
 * rotate. Used by the simulation (all bots) and the solo build (one human).
 * The engine is any object with `topMoves` and `scoreMoves`; several engines
 * can be passed to search boards in parallel.
 */
export interface EngineLike {
  topMoves(fen: string, n: number): Promise<MoveScore[]>;
  scoreMoves(fen: string, moves: readonly string[]): Promise<MoveScore[]>;
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
  boardId: number;
  fenBefore: string;
  playerIds: string[];
  result: GroupResult;
  /** All moves scored this round, best first, with loss in points. */
  scored: { move: string; expected: number; loss: number }[];
  bestMove: string;
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
    },
  ) {
    this.top = new TopMovesCache(opts.settings.botCandidateMoves);
    const plan = stagePlan(opts.settings);
    const boardCount = plan[0]!.boards;
    const plies = opts.settings.openingPlies;
    // With colours per stage, half the boards have White to move and half Black (the opening one ply longer).
    const blackBoards = opts.settings.colourPerStage && boardCount >= 2 ? Math.floor(boardCount / 2) : 0;
    const whiteOpenings = pickOpenings(opts.rng, opts.library, { classic: boardCount - blackBoards - 1, unusual: 1 }, plies, opts.settings.openingBalance);
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
    this.state = assignColours(this.state, opts.rng, this.whiteSeats());
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

  private replaceBoard(id: number): void {
    const old = this.boards.get(id)!;
    const side = sideToMove(old.fen);
    const plies = side === "w" ? this.settings.openingPlies : this.settings.openingPlies + 1;
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
  deal(): Map<number, string[]> {
    this.retiredThisRound = [];
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
    if (this.state.final) {
      this.groups = new Map([[this.state.boards[0]!, [finalMover(this.state.final)]]]);
    } else {
      this.groups = assignGroups(this.opts.rng, this.state, this.settings, undefined, this.boardSides());
    }
    // Bots' thinking times are drawn now, so a screen can show each bot finishing at its moment.
    this.botThink = new Map(
      this.alive()
        .filter((p) => p.isBot)
        .map((p) => [p.id, Math.min(botThinkMs(this.opts.rng, this.settings), allowedMs(p, this.settings))]),
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

  /** The engine's top moves in a position (shared with scoring, so a prefetched search is reused). */
  topMovesFor(fen: string): Promise<MoveScore[]> {
    return this.top.get(this.opts.engines[0]!, fen);
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

  /** Picks for every player on a board: humans as given, bots from the engine's top moves. */
  botPicksFor(boardId: number, playerIds: readonly string[], top: readonly MoveScore[]): Record<string, string> {
    const board = this.boards.get(boardId)!;
    const legal = legalMoves(board.fen);
    const best = top[0]!.expected;
    const candidates = top.map((m) => ({ move: m.move, loss: Math.max(0, (best - m.expected) * 100) }));
    const out: Record<string, string> = {};
    for (const id of playerIds) {
      const p = this.player(id);
      if (!p.isBot) continue;
      if (!this.botThink.has(id)) this.botThink.set(id, botThinkMs(this.opts.rng, this.settings));
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
    const top = await this.top.get(engine, board.fen);
    const botPicks = this.botPicksFor(boardId, playerIds, top);
    const picks: Record<string, string | null> = {};
    for (const id of playerIds) picks[id] = this.player(id).isBot ? botPicks[id]! : (humanPicks.get(id)?.move ?? null);
    const known = new Map(top.map((m) => [m.move, m.expected]));
    const missing = Object.values(picks).flatMap((m) => (m && !known.has(m) ? [m] : []));
    if (missing.length) for (const m of await engine.scoreMoves(board.fen, missing)) known.set(m.move, m.expected);
    return this.resolveBoard(boardId, playerIds, picks, {
      bestMove: top[0]!.move,
      bestExpected: top[0]!.expected,
      expectedAfter: Object.fromEntries(known),
    });
  }

  /**
   * Scores one board from evaluations and picks (bots included), and draws the
   * move to play. The lobby server calls this with evaluations from the host.
   */
  resolveBoard(
    boardId: number,
    playerIds: readonly string[],
    picks: Readonly<Record<string, string | null>>,
    evaluation: GroupEvaluation,
  ): BoardRound {
    const board = this.boards.get(boardId)!;
    const result = scoreGroup(
      playerIds.map((id) => ({ playerId: id, move: picks[id] ?? null })),
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
    return { boardId, fenBefore: board.fen, playerIds: [...playerIds], result, scored, bestMove: evaluation.bestMove };
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
    const outcomes = results.flatMap((r) => outcomesFromGroup(r.result, think, used));
    this.state = applyRound(this.state, this.groups, outcomes, this.settings);
    for (const r of results) {
      const board = this.boards.get(r.boardId)!;
      const moverExpected = r.scored.find((s) => s.move === r.result.playedMove)?.expected ?? board.expected;
      this.boards.set(r.boardId, playOnBoard(board, r.result.playedMove, moverExpected));
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
    return runner;
  }

  stageComplete(): boolean {
    if (this.state.final) return finalComplete(this.state, this.settings) || this.finalGameOver();
    return stageComplete(this.state, this.settings);
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
    if (boardEnd(board) === "checkmate") {
      // The side that just moved delivered mate. teams[0] started as the side to move at the final's start.
      const matedSide = sideToMove(board.fen);
      const startSide = f.turn % 2 === 0 ? matedSide : matedSide === "w" ? "b" : "w";
      winningTeam = matedSide === startSide ? 1 : 0;
    }
    this.state = finishFinal(this.state, this.opts.rng, winningTeam);
  }

  /** The final's teams and turn, for the screens. */
  get final() {
    return this.state.final ?? null;
  }

  /** The final as sent to the screens; `last` is the move just played (if any). */
  finalView(last: NetFinal["last"] = null): NetFinal | null {
    const f = this.state.final;
    if (!f) return null;
    const board = this.boards.get(this.state.boards[0]!)!;
    const done = this.stageComplete();
    const scores: NetFinal["scores"] = {};
    for (const id of f.order) {
      const l = this.player(id).finalLosses;
      scores[id] = { avg: l.length ? Math.round((l.reduce((s, x) => s + x, 0) / l.length) * 10) / 10 : null, moves: l.length };
    }
    return {
      board: netBoard(board),
      teams: f.teams,
      order: f.order,
      turn: f.turn,
      totalTurns: f.order.length * this.settings.finalMovesPerPlayer,
      mover: done ? null : finalMover(f),
      scores,
      last,
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
    this.state = assignColours(this.state, this.opts.rng, this.whiteSeats());
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
    });
    const alive = standings(this.state, () => 0.5, this.settings);
    const out = this.state.players.filter((p) => !p.alive).sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99));
    return [...alive, ...out].map(row);
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
    openingName: b.opening.name,
    generation: b.generation,
    ply: b.history.length,
    recent: recent.moves,
    recentFrom: recent.from,
    history: [...b.history],
    ...(withOpening ? { openingMoves: b.history.slice(0, b.openingPlies) } : {}),
  };
}
