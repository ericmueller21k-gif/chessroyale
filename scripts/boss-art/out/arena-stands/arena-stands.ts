/**
 * Arena stands: one 64 x 88 slice of the Colosseum's tiered stone benches, seen from the front and a little above, made
 * to repeat side by side round the ring. Four rows (back row first, each its own part) and the low front parapet of the
 * lowest row, which sits on arena-wall. Seats every 16 px; the game draws a pawn at each seat point, then the next lower
 * row's stone over it, so only its top shows above the bench in front.
 */
import type { Character, Layer, Part } from "../../../../packages/app/src/characters/sprite.ts";
import { grain, paint } from "../../../../packages/app/src/town/houses/kit.ts";

const PALETTE: Record<string, string> = {
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
};

const W = 64;
const H = 88;
/** Each row's top (its bench top's back edge); rows are 19 px apart. */
const TOPS = [1, 20, 39, 58] as const;
const ROW_H = 18;
/** The lowest row's front parapet (sits on arena-wall). */
const FRONT_TOP = 77;
/** A seat's foot this far below the top of the stone in front of it. */
const SINK = 9;

/** One row: a lit bench top with seat grooves, its bright front lip, then the riser in shade with block joints. */
function row(T: number, r: number): { part: Part; at: readonly [number, number] } {
  const off = (r % 2) * 8;
  return paint(0, T, W, ROW_H, (x, y) => {
    const j = y - T;
    const g = grain(x, y, 7 + r);
    if (j <= 4) {
      // the bench top
      if (j === 0) return x % 16 === 0 ? "4" : "3";
      if (x % 16 === 0) return "3";
      if (x % 16 === 1) return "1";
      if (g > 0.88) return "3";
      if (g < 0.05) return "1";
      return "2";
    }
    if (j === 5) return x % 16 === 0 ? "2" : "1"; // the lip, catching the light
    if (j === 6) return "5"; // shadow under the lip
    if (j === 12) return "5"; // course joint
    if (j === 17) return "5";
    const shift = j < 12 ? off : off + 8;
    const p = (x + shift) % 16;
    if (p === 4) return "6";
    if (p === 5) return "3";
    if (j === 7 || j === 13) return g > 0.5 ? "3" : "4";
    if (g > 0.96) return "3";
    if (g < 0.04) return "5";
    return "4";
  });
}

/** The front parapet: a lit coping over a low wall face. */
const front = paint(0, FRONT_TOP, W, H - FRONT_TOP, (x, y) => {
  const j = y - FRONT_TOP;
  const g = grain(x, y, 31);
  if (j === 0) return "3";
  if (j <= 2) return g > 0.9 ? "3" : g < 0.05 ? "1" : "2";
  if (j === 3) return "1";
  if (j === 4) return "5";
  const p = (x + 12) % 16;
  if (p === 0) return "6";
  if (p === 1) return "3";
  if (j === 5) return "3";
  if (g > 0.96) return "3";
  if (g < 0.05) return "5";
  return "4";
});

const rows = TOPS.map((T, r) => row(T, r));

const parts: Record<string, Part> = { front: front.part };
const layers: Layer[] = [];
rows.forEach((p, r) => {
  parts[`row${r}`] = p.part;
  layers.push({ part: `row${r}`, x: p.at[0], y: p.at[1] });
});
layers.push({ part: "front", x: front.at[0], y: front.at[1] });

/** Where a seated pawn's foot goes (bottom center of a ~16 x 20 pawn), back row first, left to right. */
export const ARENA_STANDS_SEATS: [number, number][] = TOPS.flatMap((_, r) => {
  const nextTop = r + 1 < TOPS.length ? TOPS[r + 1]! : FRONT_TOP;
  return [8, 24, 40, 56].map((x): [number, number] => [x, nextTop + SINK]);
});

/** Each row's band of pixels (top and bottom inclusive, outline included), back row first. */
export const ARENA_STANDS_ROWS: { top: number; bottom: number }[] = TOPS.map((T) => ({ top: T - 1, bottom: T + ROW_H }));

/** The lowest row's front parapet band: draw it after the lowest row's crowd. */
export const ARENA_STANDS_FRONT: { top: number; bottom: number } = { top: FRONT_TOP - 1, bottom: H - 1 };

export const ARENA_STANDS: Character = {
  id: "arena-stands",
  name: "Arena stands",
  w: W,
  h: H,
  foot: [W / 2, H],
  palette: PALETTE,
  parts,
  anims: { idle: { loop: true, frames: [{ layers, ms: 1000 }] } },
};
