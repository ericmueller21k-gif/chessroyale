import type { Character } from "../../../../packages/app/src/characters/sprite.ts";
import { paint } from "../../../../packages/app/src/town/houses/kit.ts";

/**
 * The six giant chess pieces on the arena's board, white marble and black slate, trimmed in gold.
 * Each piece is a mask (body `#`, gold `g`, top surface `t`, dark detail `d`) built from a profile, then banded by
 * where its edges are (lit on the left and top, shade on the right), and coloured per side. White and black share
 * the same masks.
 */

const W = 32;
const H = 56;
type Mask = (string | null)[][];

const blank = (): Mask => Array.from({ length: H }, () => Array<string | null>(W).fill(null));
/** h: rows up from the base's bottom row (y 54). X: from the centre line (between columns 15 and 16). */
const yOf = (h: number) => 54 - h;
const Xof = (x: number) => x + 0.5 - 16;

function row(m: Mask, h: number, half: number, code: string, test?: (X: number) => boolean) {
  const y = yOf(h);
  for (let x = 0; x < W; x++) {
    const X = Xof(x);
    if (Math.abs(X) < half && (!test || test(X))) m[y]![x] = code;
  }
}
function taper(m: Mask, h0: number, h1: number, a: number, b: number, code = "#") {
  for (let h = h0; h <= h1; h++) row(m, h, a + ((b - a) * (h - h0)) / Math.max(1, h1 - h0), code);
}
function ballAt(m: Mask, cH: number, r: number, code: string) {
  for (let h = Math.floor(cH - r - 1); h <= Math.ceil(cH + r + 1); h++) {
    const y = yOf(h);
    if (y < 0 || y >= H) continue;
    for (let x = 0; x < W; x++) if (Math.hypot(Xof(x), h - cH) <= r) m[y]![x] = code;
  }
}

/** The shared plinth: a round foot, a gold ring, its top seen from above as a lit band. Rows h0..h6. */
function base(m: Mask) {
  row(m, 0, 10, "#");
  row(m, 1, 11, "#");
  row(m, 2, 11, "g");
  row(m, 3, 11, "#");
  row(m, 4, 10.5, "t");
  row(m, 5, 9, "t");
  row(m, 6, 7.5, "#");
}

function pawn(): Mask {
  const m = blank();
  base(m);
  taper(m, 7, 13, 6, 3.5);
  row(m, 14, 6, "g");
  row(m, 15, 4.5, "#");
  ballAt(m, 20.5, 5.2, "#");
  return m;
}

function rook(): Mask {
  const m = blank();
  base(m);
  taper(m, 7, 9, 7, 6);
  taper(m, 10, 22, 6, 5.5);
  row(m, 23, 7, "g");
  row(m, 24, 7, "#");
  taper(m, 25, 28, 7.5, 8);
  for (let h = 29; h <= 31; h++) row(m, h, 8, "#", (X) => Math.abs(X) < 2 || Math.abs(X) > 4);
  return m;
}

function bishop(): Mask {
  const m = blank();
  base(m);
  taper(m, 7, 17, 6, 3.5);
  row(m, 18, 6.5, "g");
  row(m, 19, 5, "#");
  row(m, 20, 4, "#");
  for (let h = 21; h <= 35; h++) {
    const t = (h - 27.5) / 8;
    const half = 6 * Math.sqrt(Math.max(0, 1 - t * t)) * (t > 0 ? 1 - 0.35 * t : 1);
    row(m, h, Math.max(1, half), "#");
  }
  for (let h = 27; h <= 33; h++) row(m, h, 9, "d", (X) => Math.abs(X - (-1.5 + (33 - h) * 0.75)) < 0.6);
  ballAt(m, 37.6, 1.9, "g");
  return m;
}

function queen(): Mask {
  const m = blank();
  base(m);
  taper(m, 7, 23, 6.5, 3.5);
  row(m, 24, 7, "g");
  row(m, 25, 5, "#");
  row(m, 26, 4, "#");
  row(m, 27, 5, "g");
  taper(m, 28, 37, 4, 7.5);
  row(m, 38, 8, "g");
  const pt = (X: number) => [-6, -3, 0, 3, 6].some((c) => Math.abs(X - c) < 1);
  row(m, 39, 8, "#", pt);
  row(m, 40, 8, "g", pt);
  ballAt(m, 43, 2, "g");
  return m;
}

function king(): Mask {
  const m = blank();
  base(m);
  taper(m, 7, 26, 6.5, 3.5);
  row(m, 27, 7, "g");
  row(m, 28, 5, "#");
  row(m, 29, 4, "#");
  row(m, 30, 5, "g");
  taper(m, 31, 40, 4, 7.5);
  row(m, 41, 8, "g");
  row(m, 42, 6.5, "#");
  row(m, 43, 5, "#");
  row(m, 44, 2.5, "#");
  for (let h = 45; h <= 51; h++) row(m, h, h === 48 || h === 49 ? 3.5 : 1.5, "g");
  return m;
}

// The knight's head, facing left: '#' body, 'g' the gold edge of the mane, 'd' the eye and nostril.
const KNIGHT = [
  "...........#..#.....",
  "..........##.##.....",
  ".........#######....",
  "........#########...",
  ".......###########..",
  "......##dd####d##...",
  ".....###dd#####d##..",
  "....############d##.",
  "...#############d##.",
  "..###############d#.",
  ".################d#.",
  "d################d#.",
  "###d############d##.",
  "####....#######d###.",
  ".##......######d###.",
  "........#######d####",
  "........#######d####",
  ".......########d####",
  ".......########d####",
  "......#########d####",
  "......#########d####",
  ".....##########d####",
  ".....###############",
  ".....###############",
  "....################",
  "....################",
  "....################",
  "...#################",
];
function knight(): Mask {
  const m = blank();
  base(m);
  row(m, 6, 8, "#");
  row(m, 7, 8, "g");
  const x0 = 7;
  const top = yOf(35);
  KNIGHT.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) if (r[i] !== ".") m[top + j]![x0 + i] = r[i]!;
  });
  return m;
}

const SIDES = {
  w: { lit: "M", mid: "m", shade: "o", det: "q" },
  b: { lit: "c", mid: "b", shade: "a", det: "v" },
} as const;

function colour(m: Mask, side: keyof typeof SIDES) {
  const s = SIDES[side];
  const empty = (x: number, y: number) => x < 0 || y < 0 || x >= W || y >= H || !m[y]![x];
  return paint(0, 0, W, H, (x, y) => {
    const c = m[y]![x];
    if (!c) return null;
    if (c === "d") return s.det;
    if (c === "t") return empty(x + 1, y) ? s.mid : s.lit;
    if (c === "g") return empty(x + 1, y) || empty(x + 2, y) ? "O" : empty(x - 1, y) || empty(x - 2, y) || empty(x, y - 1) ? "y" : "Y";
    if (empty(x + 1, y) || empty(x + 2, y)) return s.shade;
    if (empty(x - 1, y) || empty(x - 2, y) || empty(x, y - 1)) return s.lit;
    if (empty(x + 3, y) || empty(x, y + 1)) return s.shade;
    return s.mid;
  }).part;
}

const SHAPES = { k: king, q: queen, r: rook, b: bishop, n: knight, p: pawn } as const;

const parts: Record<string, Character["parts"][string]> = {};
const anims: Record<string, Character["anims"][string]> = {};
for (const side of ["w", "b"] as const) {
  for (const [p, make] of Object.entries(SHAPES)) {
    const id = side + p;
    parts[id] = colour(make(), side);
    anims[id] = { loop: false, frames: [{ layers: [{ part: id, x: 0, y: 0 }], ms: 1000 }] };
  }
}

export const ARENA_PIECES: Character = {
  id: "arena-pieces",
  name: "Arena chess pieces",
  w: W,
  h: H,
  foot: [16, 55],
  palette: {
    k: "#2a1c14",
    "1": "#fbf0d8",
    "2": "#ecd9b2",
    "3": "#d8bf93",
    "4": "#bb9e70",
    "5": "#93784f",
    "6": "#6a5539",
    x: "#2e2018",
    z: "#150e0a",
    N: "#1f2a44",
    n: "#34466e",
    Y: "#f4b740",
    y: "#ffe08a",
    O: "#b97c10",
    M: "#f7f4ee",
    m: "#d9d3c7",
    o: "#a39b8d",
    q: "#7d7466",
    a: "#2b2d3a",
    b: "#3d4152",
    c: "#666d8a",
    v: "#191a23",
  },
  parts,
  anims,
};
