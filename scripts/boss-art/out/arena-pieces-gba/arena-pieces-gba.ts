/**
 * The Colosseum's giant chess pieces as crisp GBA-style pixel art (scenery, not a boss).
 *
 * Every piece is drawn ONCE as a template grid of tone keys, then recoloured per side:
 *   O outline · 1 highlight · 2 light · 3 mid · 4 shade (the body material)
 *   T U V gold band (highlight, gold, shade: gold on both sides)
 *   R S Q collar ring (gold on Black; on White too, see COLLAR_WHITE)
 *   M N  mane (light, shade) · E eye
 * The frame is 26 x 34, the foot (bottom centre of the base) at (13, 33). Pieces are drawn with their own outline
 * (outline: false on the part) so White can use `k` and Black `K`.
 */
import type { Anim, Character, Grid, Part } from "../../../../packages/app/src/characters/sprite.ts";

export const W_FRAME = 26;
export const H_FRAME = 34;
export const FOOT_X = 13;
export const FOOT_Y = 33;

/** The palette (keys from the brief). */
export const PALETTE: Record<string, string> = {
  // White (cream)
  W: "#fcf8ec",
  w: "#eedec2",
  c: "#ccb494",
  C: "#967a60",
  // Black (navy-charcoal)
  B: "#646a84",
  b: "#3c3e4e",
  d: "#242530",
  // Gold
  Y: "#ffde8c",
  G: "#e4a848",
  g: "#966426",
  // Outlines
  k: "#2e211a",
  K: "#141216",
};

/** Template key -> palette key, per side. */
export const WHITE_KEYS: Record<string, string> = {
  O: "k", 1: "W", 2: "w", 3: "c", 4: "C",
  T: "Y", U: "G", V: "g",
  R: "Y", S: "G", Q: "g",
  M: "G", N: "g",
  E: "k",
};
export const BLACK_KEYS: Record<string, string> = {
  O: "K", 1: "B", 2: "b", 3: "d", 4: "d",
  T: "Y", U: "G", V: "g",
  R: "Y", S: "G", Q: "g",
  M: "G", N: "g",
  E: "Y",
};

/** A row of body tones for an interior `n` pixels wide, lit from the left: highlight, light, mid, shade bands. */
export function shadeRow(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) {
    if (i === 0 || (n >= 9 && i === 1)) s += "1";
    else if (i < n * 0.55) s += "2";
    else if (i < n * 0.78) s += "3";
    else s += "4";
  }
  return s;
}

/**
 * The shared stepped base, `w` wide (odd), 9 rows (frame rows 25..33 when the foot is at row 33):
 * the body's neck (`neck` px of interior) meeting a collar ring, the upper step, the lower step's top lip and its gold
 * band. Stamp it with its left edge at FOOT_X - (w - 1) / 2.
 */
export function base(w: number, neck: number): string[] {
  const c = (w - 1) / 2;
  const n0 = c - (neck - 1) / 2;
  const row0: string[] = Array.from({ length: w }, (_, x) => (x >= 1 && x <= w - 2 ? "O" : "."));
  const sr = shadeRow(neck);
  for (let i = 0; i < neck; i++) row0[n0 + i] = sr[i]!;
  const ring = "R" + "S".repeat(w - 7) + "QQ";
  const lip = "1".repeat(w - 4) + "33";
  return [
    row0.join(""),
    ".O" + ring + "O.",
    "." + "O".repeat(w - 2) + ".",
    ".O" + shadeRow(w - 4) + "O.",
    ".O" + "3".repeat(w - 6) + "44" + "O.",
    "O" + lip + "O",
    "OT" + "U".repeat(w - 5) + "VVO".slice(0, 3),
    ".O" + "U".repeat(w - 6) + "VV" + "O.",
    ".." + "O".repeat(w - 4) + "..",
  ];
}

/** Rook top: 13 wide, frame rows 15..24 (crown with three merlons, then the tower). */
const ROOK_TOP: string[] = [
  "OOO.OOOOO.OOO",
  "O1O.O222O.O4O",
  "O1OOO222OOO4O",
  "O" + shadeRow(11) + "O",
  "OOO" + shadeRow(7) + "OOO",
  "..O" + shadeRow(7) + "O..",
  "..O" + shadeRow(7) + "O..",
  "..O" + shadeRow(7) + "O..",
  "..O" + shadeRow(7) + "O..",
  "..O" + shadeRow(7) + "O..",
];

/** Knight head: 15 wide (left edge at frame x 6), frame rows 12..24, facing left, mane down the back. */
const KNIGHT_TOP: string[] = [
  ".........O.....",
  "........O1O....",
  "......OO12OOO..",
  ".....O11222MNO.",
  "....O12E222MNNO",
  "...O1222222MNNO",
  "..O12222222MNO.",
  ".O122222233MNO.",
  ".O222222333MNNO",
  ".O2O3333344MNNO",
  ".OOOOO33344MNO.",
  ".....O33344MNO.",
  "....O233344MNO.",
];

/** Stamps template grids onto a blank frame. */
function compose(stamps: readonly [grid: readonly string[], x: number, y: number][]): string[][] {
  const cv = Array.from({ length: H_FRAME }, () => Array<string>(W_FRAME).fill("."));
  for (const [grid, x0, y0] of stamps)
    grid.forEach((row, y) => [...row].forEach((k, x) => {
      if (k !== "." && k !== " ") cv[y0 + y]![x0 + x] = k;
    }));
  return cv;
}

/** A template frame recoloured for one side. */
function colour(cv: string[][], keys: Record<string, string>): Grid {
  return cv.map((row) => row.map((k) => (k === "." ? "." : (keys[k] ?? k))).join(""));
}

const BASE13 = base(13, 7);
const BASE_X = FOOT_X - 6;

export const PIECES: Record<string, string[][]> = {
  r: compose([[ROOK_TOP, BASE_X, 15], [BASE13, BASE_X, 25]]),
  n: compose([[KNIGHT_TOP, 6, 12], [BASE13, BASE_X, 25]]),
};

const parts: Record<string, Part> = {};
const anims: Record<string, Anim> = {};
for (const [p, cv] of Object.entries(PIECES)) {
  for (const [side, keys] of [["w", WHITE_KEYS], ["b", BLACK_KEYS]] as const) {
    const id = side + p;
    parts[id] = { grid: colour(cv, keys), outline: false };
    anims[id] = { loop: false, frames: [{ layers: [{ part: id, x: 0, y: 0 }], ms: 1000 }] };
  }
}

export const ARENA_PIECES_GBA: Character = {
  id: "arena-pieces-gba",
  name: "Arena pieces (GBA)",
  w: W_FRAME,
  h: H_FRAME,
  foot: [FOOT_X, FOOT_Y],
  palette: PALETTE,
  parts,
  anims,
};
