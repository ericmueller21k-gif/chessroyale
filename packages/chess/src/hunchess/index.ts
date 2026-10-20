/**
 * The HunChess engine: our own chess engine for Auto chess, written from scratch, that knows every rule of a fight (no
 * promotion: a pawn on its last rank cashes in; 5 checks in a row win; a side left with only its king loses; the quiet and move
 * caps decide by material) and plays the ordinary game too (to measure it against Stockfish).
 * docs/decisions/2026-10-21-hunchess-engine.md.
 */

import { CHESS_RULES, moveUci, Position, type HunResult, type HunRules } from "./board.ts";
import { DEFAULT_EVAL, evaluate, type EvalOptions } from "./eval.ts";
import { Searcher, WIN } from "./search.ts";

export * from "./board.ts";
export { evaluate, DEFAULT_EVAL, type EvalOptions } from "./eval.ts";
export { Searcher, WIN, type SearchOptions, type SearchResult } from "./search.ts";

/** A game so far: where it started, the moves since (UCI), and the rules it is played by. */
export interface HunGame {
  startFen: string;
  moves: readonly string[];
  rules: HunRules;
}

/** The position a game has reached (its history kept, for repetitions and the fight's counters). Throws on an illegal move. */
export function replay(game: HunGame): Position {
  const pos = new Position(game.startFen, game.rules);
  for (const m of game.moves) pos.play(m);
  pos.commit();
  return pos;
}

/** The legal moves (UCI) of a game's position: in a fight a cash-in is the plain from-to ("e7e8"). Empty when the game is over. */
export function gameMoves(game: HunGame): string[] {
  const pos = replay(game);
  if (pos.result()) return [];
  return pos.legalMoves().map(moveUci);
}

/** The game's result if it is over, else null. */
export function gameResult(game: HunGame): HunResult | null {
  return replay(game).result();
}

/** A score in centipawns as an expected result, 0 to 1 (a win is 1). */
export function expectedScore(cp: number): number {
  if (cp >= WIN - 1000) return 1;
  if (cp <= -(WIN - 1000)) return 0;
  return 1 / (1 + Math.pow(10, -cp / 400));
}

export interface HunEngineOptions {
  /** Nodes a move: the fixed budget, the same for both sides. */
  nodes: number;
  /** A cashed-in pawn's worth (centipawns). */
  cashInValue?: number;
  /** The table holds 2^ttBits entries. */
  ttBits?: number;
}

export interface HunMove {
  /** UCI, or null when the game is over (no move to play). */
  move: string | null;
  /** Centipawns for the side to move. */
  score: number;
  /** The side to move's expected result, 0 to 1. */
  expected: number;
  depth: number;
  nodes: number;
  pv: string[];
}

/** One engine: its table carries over between moves of a game (`newGame` forgets it). Deterministic: same game, same history, same move. */
export class HunchessEngine {
  private searcher: Searcher;
  nodes: number;

  constructor(opts: HunEngineOptions) {
    const evalOpts: EvalOptions = { ...DEFAULT_EVAL, ...(opts.cashInValue !== undefined ? { cashInValue: opts.cashInValue } : {}) };
    this.searcher = new Searcher(evalOpts, opts.ttBits ?? 18);
    this.nodes = opts.nodes;
  }

  newGame(): void {
    this.searcher.clear();
  }

  /** The best move for a game's position, searched to the node budget (or `nodes`). */
  best(game: HunGame, nodes = this.nodes): HunMove {
    const pos = replay(game);
    if (pos.result()) return { move: null, score: 0, expected: 0.5, depth: 0, nodes: 0, pv: [] };
    const r = this.searcher.search(pos, { nodes });
    return { move: r.move ? moveUci(r.move) : null, score: r.score, expected: expectedScore(r.score), depth: r.depth, nodes: r.nodes, pv: r.pv.map(moveUci) };
  }

  /** The static evaluation of a game's position (centipawns, side to move). */
  static(game: HunGame): number {
    return evaluate(replay(game), this.searcher.evalOpts);
  }
}

export { CHESS_RULES };
