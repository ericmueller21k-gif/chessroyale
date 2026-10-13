/**
 * A position as a plain map of squares to pieces (FEN letters), and the few chess facts the bosses' generators need on
 * it (attackers, a king in check, material left hanging), worked out on the grid itself: Big Boy's bounce and
 * Wrangler's drag and showdown try many positions, and making a chess.js board for each was most of their time.
 */
import type { Side } from "./base.ts";

export type Grid = Map<string, string>;

const FILES = "abcdefgh";

/** The pieces of a FEN's placement, by square. */
export const gridOf = (fen: string): Grid => {
  const g: Grid = new Map();
  fen
    .split(" ")[0]!
    .split("/")
    .forEach((row, r) => {
      let f = 0;
      for (const c of row) {
        if (c >= "1" && c <= "8") f += Number(c);
        else g.set(`${FILES[f++]}${8 - r}`, c);
      }
    });
  return g;
};

/** A grid as a FEN's placement field. */
export const placementOf = (g: Grid): string =>
  [8, 7, 6, 5, 4, 3, 2, 1]
    .map((r) => [...FILES].map((f) => g.get(`${f}${r}`) ?? ".").join("").replace(/\.+/g, (d) => String(d.length)))
    .join("/");

/** A light square (a1 is dark). */
export const isLight = (sq: string) => (sq.charCodeAt(0) - 97 + Number(sq[1])) % 2 === 0;

/** A piece letter is `side`'s (upper case White). */
export const sideOf = (c: string): Side => (c === c.toUpperCase() ? "w" : "b");

export const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]] as const;
const AROUND = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]] as const;

/**
 * The squares of `by`'s pieces attacking `sq` on a grid (as chess.js's `attackers`: pawns diagonally, knights, the king,
 * sliders up to the first piece in the way).
 */
export function gridAttackers(g: Grid, sq: string, by: Side): string[] {
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]);
  const mine = (c: string) => (c === c.toUpperCase()) === (by === "w");
  const at = (ff: number, rr: number) => (ff >= 0 && ff < 8 && rr >= 1 && rr <= 8 ? `${FILES[ff]}${rr}` : null);
  const out: string[] = [];
  const is = (s2: string | null, types: string) => {
    const c = s2 ? g.get(s2) : undefined;
    return !!c && mine(c) && types.includes(c.toLowerCase());
  };
  for (const df of [-1, 1]) {
    const s2 = at(f + df, by === "w" ? r - 1 : r + 1);
    if (is(s2, "p")) out.push(s2!);
  }
  for (const [df, dr] of KNIGHT) if (is(at(f + df, r + dr), "n")) out.push(at(f + df, r + dr)!);
  for (const [df, dr] of AROUND) {
    if (is(at(f + df, r + dr), "k")) out.push(at(f + df, r + dr)!);
    const slider = df && dr ? "bq" : "rq";
    for (let k = 1; k < 8; k++) {
      const s2 = at(f + df * k, r + dr * k);
      if (!s2) break;
      const c = g.get(s2);
      if (!c) continue;
      if (mine(c) && slider.includes(c.toLowerCase())) out.push(s2);
      break;
    }
  }
  return out;
}

/** Where `side`'s king stands on a grid (null: none). */
export const gridKing = (g: Grid, side: Side): string | null => [...g].find(([, c]) => c === (side === "w" ? "K" : "k"))?.[0] ?? null;

/** `side`'s king is attacked on a grid (or missing). */
export const gridKingAttacked = (g: Grid, side: Side): boolean => {
  const k = gridKing(g, side);
  return !k || gridAttackers(g, k, side === "w" ? "b" : "w").length > 0;
};

/** The material `side` has hanging on a grid (as rules.ts hangingValue: attacked by a cheaper piece, or attacked and undefended). */
export function gridHanging(g: Grid, side: Side): number {
  let total = 0;
  for (const [sq, c] of g) {
    if ((c === c.toUpperCase()) !== (side === "w") || c.toLowerCase() === "k") continue;
    const att = gridAttackers(g, sq, side === "w" ? "b" : "w");
    if (!att.length) continue;
    const v = PIECE_VALUE[c.toLowerCase()]!;
    const cheaper = att.some((a) => PIECE_VALUE[g.get(a)!.toLowerCase()]! < v);
    if (cheaper || !gridAttackers(g, sq, side).length) total += v;
  }
  return total;
}
