import { AUTOCHESS, type AutoChessSettings } from "@chessroyale/core";
import { inHalf, onBoard, squareOf } from "./army.ts";
import type { Army } from "./types.ts";

/**
 * The adjust step (v5): after the reveal you get one chess move in total (any one of your pieces, the king too), which can be
 * taken back while the step lasts. A move is the piece's own move, onto an empty square of your own half with the path clear; no
 * captures, nothing into their half, no castling, no en passant. A pawn pushes one square (two from its start rank when both are
 * empty). Check doesn't matter here: the fight's start rule covers it.
 */

const ORTHO: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG: readonly (readonly [number, number])[] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const KNIGHT: readonly (readonly [number, number])[] = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

/** Where the piece on `from` can go (empty squares of its own half), or [] if there is no piece of this army there. */
export function adjustTargets(army: Army, from: string): string[] {
  const isKing = army.king === from;
  const kind = isKing ? "k" : army.board[from];
  if (!kind) return [];
  const taken = (sq: string) => sq === army.king || !!army.board[sq];
  const free = (file: number, rank: number) => onBoard(file, rank) && inHalf(squareOf(file, rank), army.color) && !taken(squareOf(file, rank));
  const f0 = from.charCodeAt(0) - 97;
  const r0 = Number(from[1]);
  const out: string[] = [];
  const step = (dirs: readonly (readonly [number, number])[], slide: boolean) => {
    for (const [df, dr] of dirs) {
      for (let n = 1; n <= (slide ? 7 : 1); n++) {
        const f = f0 + df * n;
        const r = r0 + dr * n;
        // (Blocked by anything standing there, or by the half's edge: nothing is passed through, nothing captured.)
        if (!free(f, r)) break;
        out.push(squareOf(f, r));
      }
    }
  };
  switch (kind) {
    case "p": {
      const dir = army.color === "w" ? 1 : -1;
      const start = army.color === "w" ? 2 : 7;
      if (free(f0, r0 + dir)) {
        out.push(squareOf(f0, r0 + dir));
        if (r0 === start && free(f0, r0 + 2 * dir)) out.push(squareOf(f0, r0 + 2 * dir));
      }
      break;
    }
    case "n":
      for (const [df, dr] of KNIGHT) if (free(f0 + df, r0 + dr)) out.push(squareOf(f0 + df, r0 + dr));
      break;
    case "b":
      step(DIAG, true);
      break;
    case "r":
      step(ORTHO, true);
      break;
    case "q":
      step([...ORTHO, ...DIAG], true);
      break;
    case "k":
      step([...ORTHO, ...DIAG], false);
      break;
  }
  return out;
}

/** One thing done in the adjust step: a chess move. */
export type AdjustAction = { type: "move"; from: string; to: string };

/** An army in the adjust step: the army it began with, where its pieces stand now, and what was done to get there, in order. */
export interface Adjusted {
  start: Army;
  army: Army;
  actions: AdjustAction[];
}

export const startAdjust = (army: Army): Adjusted => ({ start: army, army, actions: [] });

export const movesUsed = (state: Adjusted) => state.actions.length;

/** Plays one action on an army, or null if it isn't legal there. */
function play(army: Army, a: AdjustAction): Army | null {
  if (!adjustTargets(army, a.from).includes(a.to)) return null;
  return army.king === a.from ? { ...army, king: a.to } : { ...army, board: Object.fromEntries(Object.entries(army.board).map(([sq, k]) => [sq === a.from ? a.to : sq, k])) };
}

/** The army after these actions from `start`, or null if one of them isn't legal in that order. */
function replay(start: Army, actions: readonly AdjustAction[]): Army | null {
  let army: Army | null = start;
  for (const a of actions) {
    army = army && play(army, a);
    if (!army) return null;
  }
  return army;
}

export type AdjustBlock = "used" | "none" | "illegal";

/** Why this piece can't make this move, or null. */
export function adjustBlock(state: Adjusted, from: string, to: string, cfg: AutoChessSettings = AUTOCHESS): AdjustBlock | null {
  const { army } = state;
  if (army.king !== from && !army.board[from]) return "none";
  if (movesUsed(state) >= cfg.adjustMoves) return "used";
  return adjustTargets(army, from).includes(to) ? null : "illegal";
}

/** Makes the move (the caller checked `adjustBlock`). */
export function adjustMove(state: Adjusted, from: string, to: string): Adjusted {
  const action: AdjustAction = { type: "move", from, to };
  return { ...state, army: play(state.army, action)!, actions: [...state.actions, action] };
}

/** The squares of the pieces you moved (each shows ↩: tap it to take the move back): where a moved piece stands now. */
export function adjustMarks(state: Adjusted): { square: string; action: "move" }[] {
  const { army, actions } = state;
  const out: { square: string; action: "move" }[] = [];
  actions.forEach((a, i) => {
    const here = army.king === a.to || !!army.board[a.to];
    // (A piece moved on again isn't there any more, and its later move holds the mark.)
    const movedOn = actions.slice(i + 1).some((b) => b.from === a.to);
    if (here && !movedOn) out.push({ square: a.to, action: "move" });
  });
  return out;
}

/** The action a tap on this square would take back (the last one that left a piece there), or -1. */
const actionAt = (state: Adjusted, square: string) => {
  if (!adjustMarks(state).some((m) => m.square === square)) return -1;
  for (let i = state.actions.length - 1; i >= 0; i--) if (state.actions[i]!.to === square) return i;
  return -1;
};

/** Why a move can't be taken back, or null: nothing moved there, or a later move of yours stands on it. */
export function undoBlock(state: Adjusted, square: string): "none" | "needed" | null {
  const i = actionAt(state, square);
  if (i < 0) return "none";
  return replay(state.start, state.actions.filter((_, j) => j !== i)) ? null : "needed";
}

/** Takes the move on this square back (the caller checked `undoBlock`). */
export function undoAction(state: Adjusted, square: string): Adjusted {
  const i = actionAt(state, square);
  const actions = state.actions.filter((_, j) => j !== i);
  return { ...state, army: replay(state.start, actions)!, actions };
}

/** The words for a refused adjust move. */
export function adjustWords(block: AdjustBlock, cfg: AutoChessSettings = AUTOCHESS): string {
  switch (block) {
    case "used":
      return cfg.adjustMoves === 1 ? "You've made your move. Tap the piece you moved (↩) to take it back." : `${cfg.adjustMoves} moves at most. Tap a piece you moved (↩) to take its move back.`;
    case "none":
      return "Pick one of your pieces.";
    case "illegal":
      return "That piece can't move there: one chess move, onto an empty square of your half.";
  }
}

export const undoWords = (block: "none" | "needed") => (block === "needed" ? "Take back your other move first." : "Nothing to take back there.");
