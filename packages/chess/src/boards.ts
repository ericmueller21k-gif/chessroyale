import type { BoardStatus } from "@chessroyale/core";
import type { Opening } from "./openings.ts";
import { applyMove, baseAt, fenAfter, gameEndWith, withoutPiece, type Base, type GameEnd } from "./rules.ts";

/** A board is a supply of positions: an opening played out, then one drawn move per round. */
export interface BoardState {
  id: number;
  opening: Opening;
  /** Plies of the opening shown before play starts. */
  openingPlies: number;
  /** All moves from the starting position (opening plus drawn moves). */
  history: string[];
  fen: string;
  /** Side to move's expected score, from the latest search. */
  expected: number;
  lastMove: string | null;
  /** How many replacements this slot has had. */
  generation: number;
  /** Side to move's expected score after each ply (index = moves played), as searched when the move was played. */
  evals?: number[];
  /** Positions changed between moves (a piece G-REX's fire destroyed): the moves after each are played from it. */
  bases?: Base[];
}

/** The boss battle's board: a fresh game from the starting position. */
export const BOSS_OPENING: Opening = { id: "boss", eco: "", name: "Boss battle", family: "Boss battle", unusual: false, moves: [], namedPlies: 0, expected: { 0: 0.5 } };

export function newBoard(id: number, opening: Opening, plies: number, generation = 0): BoardState {
  const history = opening.moves.slice(0, plies);
  return {
    id,
    opening,
    openingPlies: plies,
    history,
    fen: fenAfter(history),
    expected: opening.expected[plies] ?? 0.5,
    lastMove: history[history.length - 1] ?? null,
    generation,
    evals: [...Array(history.length).fill(0.5), opening.expected[plies] ?? 0.5],
  };
}

/** Plays the drawn move. `moverExpected` is the mover's expected score after it (from the round's search). */
export function playOnBoard(board: BoardState, move: string, moverExpected: number): BoardState {
  return {
    ...board,
    history: [...board.history, move],
    fen: applyMove(board.fen, move),
    expected: 1 - moverExpected,
    lastMove: move,
    evals: [...(board.evals ?? []), 1 - moverExpected],
  };
}

export function boardEnd(board: BoardState): GameEnd {
  return gameEndWith(board.history, board.bases);
}

/** A piece destroyed between moves (G-REX's fire): the square emptied, and the moves from here on played from it. */
export function burnOnBoard(board: BoardState, square: string): BoardState {
  const fen = withoutPiece(board.fen, square);
  const ply = board.history.length;
  return { ...board, fen, bases: [...(board.bases ?? []).filter((b) => b.ply !== ply), { ply, fen }] };
}

export function boardStatus(board: BoardState): BoardStatus {
  return { id: board.id, expected: board.expected, gameOver: boardEnd(board) !== null };
}


/** The last `n` moves played on a board and the position before them (for replaying what a player missed). */
export function recentMoves(board: BoardState, n = 4): { from: string; moves: string[] } {
  // (Only moves since the last change between moves: a replay from before it would bring a destroyed piece back.)
  const base = baseAt(board.history.length, board.bases);
  const k = Math.min(n, board.history.length - base.ply);
  return { from: fenAfter(board.history.slice(base.ply, board.history.length - k), base.fen), moves: board.history.slice(board.history.length - k) };
}
