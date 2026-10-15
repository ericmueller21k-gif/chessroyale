import { useEffect, useReducer, useRef, useState } from "preact/hooks";
import { START_FEN, applyMove, baseAt } from "@chessroyale/chess";
import type { BoardView, GameView } from "./game.ts";
import { crowdAnimations, crowdTrail, onPrefsChange } from "./prefs.ts";

const MAX_REPLAY = 5;

export const seenKey = (b: Pick<BoardView, "id" | "generation">) => `${b.id}:${b.generation}`;

/** How often a screen that draws every frame draws its still parts (ms): as often as your move's screen draws (Play). */
export const STILL_MS = 200;

/**
 * For a screen that draws every frame (a boss's effects), when its still parts are drawn: the header, the boss by the
 * board, the chat, the dock. A key that changes whenever the match does, whenever the boss's state does (in solo it can
 * change between the match's changes, e.g. as its ultimate is readied: the boss's view is new then) and every STILL_MS
 * (what they read as they're drawn, such as the admins' brain line or the chat's wait, keeps up as on your move's
 * screen), never every frame. Use it as the dependency of a useMemo that makes the part's element: the same element,
 * and Preact leaves it alone.
 */
export function useStillKey(match: GameView, now: number): string {
  const [changes, changed] = useReducer((n: number, _: unknown) => n + 1, 0);
  useEffect(() => match.subscribe(() => changed(undefined)), [match]);
  const boss = useRef<{ board: unknown; n: number }>({ board: null, n: 0 });
  const board = match.boss?.board ?? null;
  if (board !== boss.current.board) boss.current = { board, n: boss.current.n + 1 };
  return `${changes}:${boss.current.n}:${Math.floor(now / STILL_MS)}`;
}

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

/** Settings → Board, "Animations" (picks as ghost pieces), kept in sync if it changes. */
export function useBoardAnimations(): boolean {
  const [on, setOn] = useState(crowdAnimations());
  useEffect(() => onPrefsChange(() => setOn(crowdAnimations())), []);
  return on;
}

/** Settings → Board, "Motion trail" (picks fly to their squares, with animations on), kept in sync if it changes. */
export function useMotionTrail(): boolean {
  const [on, setOn] = useState(crowdTrail());
  useEffect(() => onPrefsChange(() => setOn(crowdTrail())), []);
  return on;
}
