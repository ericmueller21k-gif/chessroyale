import { AUTOCHESS, type AutoChessSettings } from "@chessroyale/core";
import { inHalf, onBoard, squareOf } from "./army.ts";
import type { Army } from "./types.ts";

/**
 * The adjust step: each piece may make one legal chess move, the king too. The piece's own move, onto an empty square of
 * your own half with the path clear; no captures, nothing into their half, no castling, no en passant. A pawn pushes one
 * square (two from its start rank when both are empty). Check doesn't matter here: the fight's start rule covers it.
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

/** An army in the adjust step: where its pieces stand now, and each moved piece's square now → the square it came from. */
export interface Adjusted {
  army: Army;
  moved: Record<string, string>;
}

export const startAdjust = (army: Army): Adjusted => ({ army, moved: {} });

export type AdjustBlock = "moved" | "cap" | "none" | "illegal";

/** Why this piece can't make this move, or null. */
export function adjustBlock(state: Adjusted, from: string, to: string, cfg: AutoChessSettings = AUTOCHESS): AdjustBlock | null {
  const { army, moved } = state;
  if (army.king !== from && !army.board[from]) return "none";
  if (moved[from] !== undefined) return "moved";
  if (cfg.adjustMoveCap !== null && Object.keys(moved).length >= cfg.adjustMoveCap) return "cap";
  return adjustTargets(army, from).includes(to) ? null : "illegal";
}

/** Makes the move (the caller checked `adjustBlock`). */
export function adjustMove(state: Adjusted, from: string, to: string): Adjusted {
  const { army, moved } = state;
  const next: Army = army.king === from ? { ...army, king: to } : { ...army, board: Object.fromEntries(Object.entries(army.board).map(([sq, k]) => [sq === from ? to : sq, k])) };
  return { army: next, moved: { ...moved, [to]: from } };
}

/** Why a move can't be taken back (its square is taken again), or null. */
export function undoBlock(state: Adjusted, at: string): "none" | "taken" | null {
  const from = state.moved[at];
  if (from === undefined) return "none";
  return state.army.king === from || state.army.board[from] ? "taken" : null;
}

/** Takes a moved piece back to the square it came from (the caller checked `undoBlock`). */
export function undoMove(state: Adjusted, at: string): Adjusted {
  const from = state.moved[at]!;
  const { [at]: _gone, ...moved } = state.moved;
  const { army } = state;
  const back: Army = army.king === at ? { ...army, king: from } : { ...army, board: Object.fromEntries(Object.entries(army.board).map(([sq, k]) => [sq === at ? from : sq, k])) };
  return { army: back, moved };
}

/** The words for a refused adjust move. */
export function adjustWords(block: AdjustBlock, cfg: AutoChessSettings = AUTOCHESS): string {
  switch (block) {
    case "moved":
      return "That piece has moved already. Tap it to take the move back.";
    case "cap":
      return `${cfg.adjustMoveCap} moves at most.`;
    case "none":
      return "Pick one of your pieces.";
    case "illegal":
      return "That piece can't move there: one chess move, onto an empty square of your half.";
  }
}
