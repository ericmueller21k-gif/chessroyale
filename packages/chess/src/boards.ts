import type { BoardStatus } from "@chessroyale/core";
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
  /** Side to move's expected score after each ply (index = moves played), as searched when the move was played. */
  evals?: number[];
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
  return gameEnd(START_FEN, board.history);
}

export function boardStatus(board: BoardState): BoardStatus {
  return { id: board.id, expected: board.expected, gameOver: boardEnd(board) !== null };
}


/**
 * The position after each line of moves asked for lately. A board's view asks for the position a few moves back
 * every time it's built, and replaying the whole game for it made each build slower as the game went on
 * (.claude/LESSONS.md: "Lag that grows with the match"): a line seen before is looked up, and a line a move or two
 * on from one seen before carries on from there.
 */
const positions = new Map<string, string>();
const POSITIONS_KEPT = 256;
function positionAfter(moves: readonly string[]): string {
  const key = moves.join(" ");
  let fen = positions.get(key);
  if (fen !== undefined) return fen;
  let from = moves.length;
  let base: string | undefined;
  while (base === undefined && from > 0 && moves.length - from < 8) base = positions.get(moves.slice(0, --from).join(" "));
  fen = base === undefined ? fenAfter(moves) : fenAfter(moves.slice(from), base);
  positions.set(key, fen);
  if (positions.size > POSITIONS_KEPT) positions.delete(positions.keys().next().value!);
  return fen;
}

/** The last `n` moves played on a board and the position before them (for replaying what a player missed). */
export function recentMoves(board: BoardState, n = 4): { from: string; moves: string[] } {
  const k = Math.min(n, board.history.length);
  return { from: positionAfter(board.history.slice(0, board.history.length - k)), moves: board.history.slice(board.history.length - k) };
}
