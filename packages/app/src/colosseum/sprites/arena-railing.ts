/**
 * The stone ledge in front of your seat (the arena's near edge, the screen's bottom): a thick sandstone parapet seen from
 * just above and behind, drawn at 2x (every pixel a 2 x 2 block). 128 x 32, repeats side by side seamlessly.
 */
import type { Character } from "../../characters/sprite.ts";
import { grain, paint } from "../../town/houses/kit.ts";

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

const LW = 64; // logical width (one logical pixel = 2 x 2)
const wrap = (i: number) => ((i % LW) + LW) % LW;

/** The coping's top edge row: worn a little lower in two places. */
const topRow = (i: number) => (i >= 21 && i <= 24 ? 2 : i >= 49 && i <= 50 ? 2 : 1);
/** Coping joints (top stones) and face joints (offset half a block). */
const copeJoint = (i: number) => wrap(i) % 16 === 12;
const faceJoint = (i: number) => wrap(i) % 16 === 4;
/** Chips out of the rounded front edge: [x, width]. */
const CHIPS: readonly [number, number][] = [[6, 2], [33, 3], [57, 1]];
const chipAt = (i: number) => CHIPS.some(([c, w]) => i >= c && i < c + w);
/** Worn hollows on the top: [x, y, w]. */
const WORN: readonly [number, number, number][] = [[3, 4, 4], [27, 5, 3], [40, 3, 5], [58, 4, 3]];
/** Pits in the top: [x, y]. */
const PITS: readonly [number, number][] = [[17, 4], [45, 5], [9, 3]];

function cell(i: number, j: number): string | null {
  const t = topRow(i);
  if (j < t) return null;
  if (j === t) return "k";
  const chip = chipAt(i);
  // the top surface (coping), rows t+1 .. 6
  if (j <= 6) {
    if (j === 6 && chip) return "4";
    if (copeJoint(i)) return j === t + 1 ? "3" : "5";
    if (copeJoint(i - 1)) return "1";
    if (j === t + 1) return "1";
    if (PITS.some(([px, py]) => px === i && py === j)) return "5";
    if (PITS.some(([px, py]) => px === i && py + 1 === j)) return "1";
    if (WORN.some(([wx, wy, ww]) => j === wy && i >= wx && i < wx + ww)) return "3";
    const g = grain(i, j, 7);
    return g < 0.07 ? "3" : g > 0.95 ? "1" : "2";
  }
  // the rounded front edge
  if (j === 7) {
    if (chip) return "5";
    if (copeJoint(i)) return "5";
    return grain(i, j, 3) < 0.15 ? "4" : "3";
  }
  if (j === 8) {
    if (chip) return "6";
    if (copeJoint(i)) return "6";
    return grain(i, j, 4) < 0.15 ? "5" : "4";
  }
  // the coping's shadow on the face
  if (j === 9) return chip ? "k" : "6";
  // the near face, in shade, going down out of frame
  if (faceJoint(i)) return "6";
  if (j === 10 || faceJoint(i - 1)) return grain(i, j, 5) < 0.2 ? "5" : "4";
  const g = grain(i, j, 9);
  if (j === 15 && grain(i, j, 2) < 0.5) return "6"; // darker toward the bottom
  return g < 0.04 ? "6" : g > 0.96 ? "4" : "5";
}

const rail = paint(0, 0, 128, 32, (x, y) => cell(x >> 1, y >> 1), false);

export const ARENA_RAILING: Character = {
  id: "arena-railing",
  name: "Arena railing",
  w: 128,
  h: 32,
  foot: [64, 32],
  palette: PALETTE,
  parts: { rail: rail.part },
  anims: { idle: { frames: [{ layers: [{ part: "rail", x: rail.at[0], y: rail.at[1] }], ms: 1000 }], loop: true } },
};
