/** Auto chess (docs/decisions/2026-10-19-autochess-demo.md): the plain data the rules work on. */

/** The pieces you can buy: pawn, knight, bishop, rook, queen. The king is placed by the game. */
export type Kind = "p" | "n" | "b" | "r" | "q";
export const KINDS: readonly Kind[] = ["p", "n", "b", "r", "q"];
export type Color = "w" | "b";

export const KIND_NAME: Record<Kind | "k", string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

/**
 * One side's army for a round: its king, the pieces standing on its half (square → kind) and the pieces waiting on the
 * bench. Only plain data (no classes), so a test can build one in a line and compare results with `toEqual`.
 */
export interface Army {
  color: Color;
  king: string;
  board: Record<string, Kind>;
  bench: Kind[];
  /**
   * Each pawn may be picked up once while buying (v5): after that its next placement is final (it can still be sold). The
   * board squares of the pawns that are final now, and the bench slots whose pawn's next placement is. Left out when empty.
   */
  fixed?: string[];
  benchFixed?: number[];
}

export const other = (c: Color): Color => (c === "w" ? "b" : "w");
