/** Auto chess (docs/decisions/2026-10-19-autochess-demo.md): the plain data the rules work on. */

/** The pieces you can buy: pawn, knight, bishop, rook, queen. The king is placed by the game. */
export type Kind = "p" | "n" | "b" | "r" | "q";
export const KINDS: readonly Kind[] = ["p", "n", "b", "r", "q"];
export type Color = "w" | "b";

export const KIND_NAME: Record<Kind | "k", string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

/** One shop offer (v6): a piece and the square of your half it will land on. A held piece is the same: it keeps its square. */
export interface Offer {
  kind: Kind;
  square: string;
}

/** A star count worth showing: 2 or 3 (a plain piece has none: 1 star, no mark). */
export type StarCount = 2 | 3;

/** A piece held on the bench: an offer's kind and the square it keeps, and its stars if it has any (v8; a plain piece has no `stars`). */
export interface Held extends Offer {
  stars?: StarCount;
}

/**
 * One side's army for a round: its king, the pieces standing on its half (square → kind) and the pieces it holds on its bench
 * (each with the square it will land on). Only plain data (no classes), so a test can build one in a line and compare results
 * with `toEqual`. Only the board fights; the bench is what a side owns beyond it. **Stars** (v8): `stars` has the starred pieces on the
 * board by square (2 or 3; a plain piece is not in it, and the key is left off when nothing is starred); a bench piece's are its own `stars`.
 */
export interface Army {
  color: Color;
  king: string;
  board: Record<string, Kind>;
  stars?: Record<string, StarCount>;
  bench: Held[];
}

export const other = (c: Color): Color => (c === "w" ? "b" : "w");
