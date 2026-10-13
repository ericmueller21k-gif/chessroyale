/**
 * Finding the board's parts from what's drawn over it: its squares' box (for measuring), and its piece elements
 * (Sawyer's split pawns restyle them).
 */

/** The element exactly over the 64 squares. */
export const BOARD_SQUARES = ".hb-board";

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
  /** Its color and kind as its classes name it: "white pawn". */
  name: string;
}

/**
 * The board's pieces standing on squares (not a captured piece fading out, or the dragging ghost), each with the real
 * square it's on. `wrap`: the `.board-wrap`.
 */
export function boardPieces(wrap: Element): PieceEl[] {
  const squares = wrap.querySelector(BOARD_SQUARES);
  if (!squares) return [];
  const out: PieceEl[] = [];
  for (const el of Array.from(squares.children) as HTMLElement[]) {
    if (el.tagName !== "PIECE" || el.classList.contains("fading") || el.classList.contains("ghost")) continue;
    const square = el.dataset.square;
    const colour = el.classList.contains("white") ? "white" : el.classList.contains("black") ? "black" : "";
    const role = ROLES.find((r) => el.classList.contains(r));
    if (square && colour && role) out.push({ el, square, name: `${colour} ${role}` });
  }
  return out;
}
