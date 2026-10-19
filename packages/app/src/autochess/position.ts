import { kingAttacked } from "@chessroyale/chess";
import type { Army, Color, Kind } from "./types.ts";

/** The armies as a chess position, who moves first, and what is left standing. */

type Piece = { square: string; color: Color; kind: Kind | "k" };

/** A FEN (no castling, no en passant square) from pieces on squares. */
export function fenFrom(pieces: readonly Piece[], side: Color = "w"): string {
  const grid: string[][] = Array.from({ length: 8 }, () => Array<string>(8).fill(""));
  for (const p of pieces) {
    const f = p.square.charCodeAt(0) - 97;
    const r = Number(p.square[1]);
    grid[8 - r]![f] = p.color === "w" ? p.kind.toUpperCase() : p.kind;
  }
  const placement = grid
    .map((row) => {
      let out = "";
      let gap = 0;
      for (const c of row) {
        if (!c) gap++;
        else {
          if (gap) out += gap;
          gap = 0;
          out += c;
        }
      }
      return out + (gap ? gap : "");
    })
    .join("/");
  return `${placement} ${side} - - 0 1`;
}

/** An army's pieces and its king, as pieces on squares. */
export const armyPieces = (army: Army): Piece[] => [
  { square: army.king, color: army.color, kind: "k" },
  ...Object.entries(army.board).map(([square, kind]) => ({ square, color: army.color, kind })),
];

/** The position on the board before the fight, side to move as given (or White). */
export const armiesFen = (a: Army, b: Army, side: Color = "w") => fenFrom([...armyPieces(a), ...armyPieces(b)], side);

/**
 * How a fight starts: White moves first, except a side whose king is attacked as it starts moves first; if both are, the
 * round is a draw and there is no fight. (The engine refuses a position whose side not to move is in check, so a first move
 * for the attacked side is also what keeps the position one it will play.)
 */
export function fightStart(a: Army, b: Army): { fen: string; mover: Color; draw: boolean } {
  const probe = armiesFen(a, b, "w");
  const w = kingAttacked(probe, "w");
  const bl = kingAttacked(probe, "b");
  const mover: Color = !w && bl ? "b" : "w";
  return { fen: armiesFen(a, b, mover), mover, draw: w && bl };
}

const VALUE: Record<Kind, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };

/** The pieces on the board in a position (kings left out), by color. */
export function piecesOn(fen: string): { w: Kind[]; b: Kind[] } {
  const out: { w: Kind[]; b: Kind[] } = { w: [], b: [] };
  for (const ch of fen.split(" ")[0]!) {
    const lower = ch.toLowerCase();
    if (!"pnbrq".includes(lower)) continue;
    out[ch === lower ? "b" : "w"].push(lower as Kind);
  }
  return out;
}

/** Material by the usual values (pawn 1, knight 3, bishop 3, rook 5, queen 9), by color. */
export function material(fen: string): { w: number; b: number } {
  const on = piecesOn(fen);
  const sum = (kinds: Kind[]) => kinds.reduce((s, k) => s + VALUE[k], 0);
  return { w: sum(on.w), b: sum(on.b) };
}
