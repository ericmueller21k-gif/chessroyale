import { retireReason, type BoardStatus, type RetireReason, type Settings } from "@chessroyale/core";
import type { Opening } from "./openings.ts";
import { applyMove, fenAfter, gameEnd, START_FEN, type GameEnd } from "./rules.ts";

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
}

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
  };
}

export function boardEnd(board: BoardState): GameEnd {
  return gameEnd(START_FEN, board.history);
}

export function boardStatus(board: BoardState): BoardStatus {
  return { id: board.id, expected: board.expected, gameOver: boardEnd(board) !== null };
}

export function boardRetireReason(board: BoardState, settings: Settings): RetireReason | null {
  return retireReason(boardStatus(board), settings);
}

/** The last `n` moves played on a board and the position before them (for replaying what a player missed). */
export function recentMoves(board: BoardState, n = 4): { from: string; moves: string[] } {
  const k = Math.min(n, board.history.length);
  return { from: fenAfter(board.history.slice(0, board.history.length - k)), moves: board.history.slice(board.history.length - k) };
}
