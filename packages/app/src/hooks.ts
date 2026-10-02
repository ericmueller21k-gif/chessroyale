import { useEffect, useState } from "preact/hooks";
import { applyMove } from "@chessroyale/chess";
import type { BoardView, GameView } from "./game.ts";

const MAX_REPLAY = 5;

export const seenKey = (b: Pick<BoardView, "id" | "generation">) => `${b.id}:${b.generation}`;

/**
 * Replays the moves played on a board since this player last saw it (or the
 * last 2 moves of a board that's new to them), up to 5, then settles on the
 * current position. The steps are paced to fill `withinMs` (the new board's
 * settling-in time). Returns the position to show and whether it's replaying.
 */
export function useReplay(
  match: GameView,
  board: BoardView,
  withinMs = 2500,
): { fen: string; lastMove: string | null; replaying: boolean } {
  const [frames] = useState(() => {
    const key = seenKey(board);
    const last = match.seen.get(key);
    const missed = last === undefined ? 2 : board.ply - last;
    match.seen.set(key, board.ply);
    const k = Math.max(0, Math.min(MAX_REPLAY, missed, board.recent.length));
    if (k === 0) return [];
    const head = board.recent.slice(0, board.recent.length - k);
    let fen = head.reduce((f, m) => applyMove(f, m), board.recentFrom);
    const out = [{ fen, lastMove: head[head.length - 1] ?? null }];
    for (const m of board.recent.slice(board.recent.length - k)) {
      fen = applyMove(fen, m);
      out.push({ fen, lastMove: m });
    }
    return out;
  });
  const [step, setStep] = useState(0);
  const moves = Math.max(1, frames.length - 1);
  const stepMs = Math.max(350, Math.min(800, (withinMs - 1100) / moves));
  useEffect(() => {
    if (step >= frames.length - 1) return;
    const t = setTimeout(() => setStep((s) => s + 1), step === 0 ? 500 : stepMs);
    return () => clearTimeout(t);
  }, [step, frames.length]);
  if (!frames.length || step >= frames.length - 1) return { fen: board.fen, lastMove: board.lastMove, replaying: false };
  return { ...frames[step]!, replaying: true };
}
