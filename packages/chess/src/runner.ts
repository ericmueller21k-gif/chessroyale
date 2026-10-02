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
    const outcomes = results.flatMap((r) => {
      for (const p of r.playerIds) thinkMs[p] = humanPicks.get(p)?.thinkMs ?? this.botThink.get(p) ?? 0;
      return outcomesFromGroup(r.result, thinkMs);
    });
    this.state = applyRound(this.state, this.groups, outcomes);
    for (const r of results) {
      const board = this.boards.get(r.boardId)!;
      const moverExpected = r.scored.find((s) => s.move === r.result.playedMove)?.expected ?? board.expected;
      this.boards.set(r.boardId, playOnBoard(board, r.result.playedMove, moverExpected));
    }
    return {
      stage: this.state.stage,
      round: this.state.round - 1,
      boards: results,
      retired: this.retiredThisRound,
    };
  }

  private botThink = new Map<string, number>();

  private async scoreBoard(
    engine: EngineLike,
    boardId: number,
    playerIds: string[],
    humanPicks: ReadonlyMap<string, HumanPick>,
    rng: Rng,
  ): Promise<BoardRound> {
    const board = this.boards.get(boardId)!;
    const top = await engine.topMoves(board.fen, this.settings.botCandidateMoves);
    const legal = legalMoves(board.fen);
    const bestExpected = top[0]!.expected;
    const candidates = top.map((m) => ({ move: m.move, loss: Math.max(0, (bestExpected - m.expected) * 100) }));

    const picks = playerIds.map((id) => {
      const p = this.player(id);
      if (!p.isBot) return { playerId: id, move: humanPicks.get(id)?.move ?? null };
      this.botThink.set(id, botThinkMs(rng, this.settings));
      return { playerId: id, move: botPick(rng, candidates, p.skill ?? 5, legal, this.settings) };
    });

    const known = new Map(top.map((m) => [m.move, m.expected]));
    const missing = picks.flatMap((p) => (p.move && !known.has(p.move) ? [p.move] : []));
    if (missing.length) for (const m of await engine.scoreMoves(board.fen, missing)) known.set(m.move, m.expected);

    const evaluation: GroupEvaluation = {
      bestExpected,
      bestMove: top[0]!.move,
      expectedAfter: Object.fromEntries(known),
    };
    const result = scoreGroup(picks, evaluation, rng, this.settings);
    const best = Math.max(bestExpected, ...picks.flatMap((p) => (p.move ? [known.get(p.move)!] : [])));
    const scored = [...known.entries()]
      .map(([move, expected]) => ({ move, expected, loss: Math.max(0, (best - expected) * 100) }))
      .sort((a, b) => b.expected - a.expected);
    return { boardId, fenBefore: board.fen, playerIds, result, scored, bestMove: top[0]!.move };
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
