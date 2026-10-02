import {
  alivePlayers,
  applyRound,
  assignGroups,
  botPick,
  botThinkMs,
  createMatch,
  endStage,
  isDuel,
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
} from "@chessroyale/core";
import { boardRetireReason, boardStatus, newBoard, playOnBoard, type BoardState } from "./boards.ts";
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
}

export interface HumanPick {
  move: string | null;
  thinkMs: number;
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
}

export class MatchRunner {
  state: MatchState;
  boards = new Map<number, BoardState>();
  /** Groups for the round currently dealt. */
  groups = new Map<number, string[]>();
  private retiredThisRound: { boardId: number; reason: RetireReason }[] = [];
  private usedFamilies = new Set<string>();

  constructor(
    private readonly opts: {
      settings: Settings;
      rng: Rng;
      engines: readonly EngineLike[];
      library: readonly Opening[];
      entrants: readonly Entrant[];
    },
  ) {
    const plan = stagePlan(opts.settings);
    const boardCount = plan[0]!.boards;
    const openings = pickOpenings(
      opts.rng,
      opts.library,
      { classic: boardCount - 1, unusual: 1 },
      opts.settings.openingPlies,
      opts.settings.openingBalance,
    );
    if (openings.length < boardCount) throw new Error("Not enough openings in the library");
    openings.forEach((o, i) => {
      this.boards.set(i, newBoard(i, o, opts.settings.openingPlies));
      this.usedFamilies.add(o.family);
    });
    this.state = createMatch(opts.entrants, openings.map((_, i) => i));
  }

  get settings() {
    return this.opts.settings;
  }

  /** Side to move on every board this round. */
  get sideToMove(): "w" | "b" {
    const first = this.boards.get(this.state.boards[0]!)!;
    return sideToMove(first.fen);
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

  /** Retires finished or decided boards, then groups the players. */
  deal(): Map<number, string[]> {
    this.retiredThisRound = [];
    for (const id of this.state.boards) {
      const reason = boardRetireReason(this.boards.get(id)!, this.settings);
      if (reason) {
        this.retiredThisRound.push({ boardId: id, reason });
        this.replaceBoard(id);
      }
    }
    this.groups = assignGroups(this.opts.rng, this.state, this.settings);
    return this.groups;
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
    for (const [id, p] of humanPicks) thinkMs[id] = p.thinkMs;
    return this.finishRound(results, thinkMs);
  }

  private botThink = new Map<string, number>();

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
      this.botThink.set(id, botThinkMs(this.opts.rng, this.settings));
      out[id] = botPick(this.opts.rng, candidates, p.skill ?? 5, legal, this.settings);
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
    const top = await engine.topMoves(board.fen, this.settings.botCandidateMoves);
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
  finishRound(results: readonly BoardRound[], thinkMs: Readonly<Record<string, number>>): RoundReport {
    const think: Record<string, number> = { ...thinkMs };
    for (const r of results) for (const p of r.playerIds) think[p] ??= this.botThink.get(p) ?? 0;
    const outcomes = results.flatMap((r) => outcomesFromGroup(r.result, think));
    this.state = applyRound(this.state, this.groups, outcomes);
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

  /** Everything needed to rebuild the runner later (the lobby server stores this between messages). */
  snapshot(): RunnerSnapshot {
    return {
      state: this.state,
      boards: [...this.boards.values()].map((b) => ({ ...b, opening: b.opening.id })),
      groups: [...this.groups.entries()],
      usedFamilies: [...this.usedFamilies],
      retired: this.retiredThisRound,
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
      state: snapshot.state,
      boards: new Map(snapshot.boards.map((b) => [b.id, { ...b, opening: byId.get(b.opening)! }])),
      groups: new Map(snapshot.groups),
      usedFamilies: new Set(snapshot.usedFamilies),
      retiredThisRound: snapshot.retired,
      botThink: new Map(),
    });
    return runner;
  }

  stageComplete(): boolean {
    return stageComplete(this.state, this.settings);
  }

  /** Ends the stage: knockouts, then shrink to the most balanced boards. */
  endStage() {
    const plan = stagePlan(this.settings);
    const nextBoards = plan[this.state.stage + 1]?.boards ?? 1;
    const keep = keepBoards(
      this.state.boards.map((id) => boardStatus(this.boards.get(id)!)),
      nextBoards,
    );
    const end = endStage(this.state, this.opts.rng, keep, this.settings);
    this.state = end.state;
    return end;
  }

  isDuel(): boolean {
    return isDuel(this.state, this.settings);
  }

  alive(): PlayerState[] {
    return alivePlayers(this.state);
  }
}
