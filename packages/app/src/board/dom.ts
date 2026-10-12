/**
 * Finding the big board's parts from what's drawn over it, whichever board draws it (chessground's or ours, BOARD.impl):
 * its squares' box (for measuring), and its piece elements (Sawyer's split pawns restyle them).
 */
import { realSquare, type QuarterTurn } from "../board-view.ts";

/** The element exactly over the 64 squares: chessground's `cg-board`, or ours. */
export const BOARD_SQUARES = "cg-board, .hb-board";

/** The squares' box of the board in (or containing) an element of a `.board-wrap`. */
export function boardSquares(near: Element | null | undefined): HTMLElement | null {
  const wrap = near?.closest(".board-wrap") ?? near;
  return (wrap?.querySelector<HTMLElement>(BOARD_SQUARES) ?? null) as HTMLElement | null;
}

const ROLES = ["pawn", "knight", "bishop", "rook", "queen", "king"] as const;

export interface PieceEl {
  el: HTMLElement;
  /** The real square it stands on. */
  square: string;
  /** Its colour and kind as its classes name it: "white pawn". */
  name: string;
}

/**
 * The board's pieces standing on squares (not a captured piece fading out, the dragging ghost or a drag in progress'
 * origin), each with the real square it's on. `wrap`: the `.board-wrap`.
 */
export function boardPieces(wrap: Element): PieceEl[] {
  const squares = wrap.querySelector(BOARD_SQUARES);
  if (!squares) return [];
  const turn = Number((wrap as HTMLElement).dataset.turn ?? 0) as QuarterTurn;
  const out: PieceEl[] = [];
  for (const el of Array.from(squares.children) as (HTMLElement & { cgKey?: string; cgPiece?: string })[]) {
    if (el.tagName !== "PIECE" || el.classList.contains("fading") || el.classList.contains("ghost")) continue;
    // (Chessground keeps its view square and piece on the element; ours says the real square.)
    const square = el.dataset.square ?? (el.cgKey ? realSquare(el.cgKey, turn) : undefined);
    const colour = el.classList.contains("white") ? "white" : el.classList.contains("black") ? "black" : "";
    const role = ROLES.find((r) => el.classList.contains(r));
    const name = el.cgPiece ?? (colour && role ? `${colour} ${role}` : "");
    if (square && name) out.push({ el, square, name });
  }
  return out;
}
