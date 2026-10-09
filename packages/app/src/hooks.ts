import { useEffect, useState } from "preact/hooks";
import { START_FEN, applyMove, baseAt } from "@chessroyale/chess";
import type { BoardView, GameView } from "./game.ts";

const MAX_REPLAY = 5;

export const seenKey = (b: Pick<BoardView, "id" | "generation">) => `${b.id}:${b.generation}`;

/**
 * Replays the moves played on a board since this player last saw it (up to
 * 5), or the whole game from move 0 on a board that's new to them, then
 * settles on the current position. The steps are paced to fill `withinMs`
 * (the new board's settling-in time). Returns the position to show and
 * whether it's replaying.
 */
export function useReplay(
  match: GameView,
  board: BoardView,
  withinMs = 2500,
): { fen: string; lastMove: string | null; replaying: boolean; fromStart: boolean } {
  const [frames] = useState(() => {
    const key = seenKey(board);
    const last = match.seen.get(key);
    match.seen.set(key, board.ply);
    if (last === undefined && board.history.length) {
      // First time on this board: the whole game from the starting position.
      const out = [{ fen: START_FEN, lastMove: null as string | null }];
      let fen = START_FEN;
      board.history.forEach((m, i) => {
        fen = applyMove(fen, m);
        // (A piece G-REX's fire destroyed after this move: gone from here on.)
        const base = baseAt(i + 1, board.bases);
        if (base.ply === i + 1) fen = base.fen;
        out.push({ fen, lastMove: m });
      });
      return out;
    }
    const missed = last === undefined ? 0 : board.ply - last;
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
  // A long game from move 0 plays quickly; a few missed moves play at a readable pace.
  const stepMs = Math.max(moves > MAX_REPLAY ? 90 : 350, Math.min(800, (withinMs - 1000) / moves));
  useEffect(() => {
    if (step >= frames.length - 1) return;
    const t = setTimeout(() => setStep((s) => s + 1), step === 0 ? 400 : stepMs);
    return () => clearTimeout(t);
  }, [step, frames.length]);
  // A replay from move 0 starts at the initial position.
  const fromStart = frames[0]?.fen === START_FEN && frames.length > 1;
  if (!frames.length || step >= frames.length - 1) return { fen: board.fen, lastMove: board.lastMove, replaying: false, fromStart };
  return { ...frames[step]!, replaying: true, fromStart };
}
