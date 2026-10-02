import { sideToMove, toSan, type MoveScore } from "@chessroyale/chess";
import type { Hint } from "./game.ts";

/** A power-up's suggestions: the engine's top 3 moves, best first. */
export function hintsFrom(fen: string, top: readonly MoveScore[]): Hint[] {
  return top.slice(0, 3).map((m) => ({ move: m.move, san: toSan(fen, m.move), expected: m.expected }));
}

/** White's expected score from a top-moves search (scores are from the mover's side). */
export function whiteExpected(fen: string, top: readonly MoveScore[]): number | null {
  const best = top[0];
  if (!best) return null;
  return sideToMove(fen) === "w" ? best.expected : 1 - best.expected;
}
