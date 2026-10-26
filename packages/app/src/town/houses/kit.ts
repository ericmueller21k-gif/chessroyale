/**
 * What the houses share: painting a part pixel by pixel over its box, banded light, and the blank sign board on two posts
 * (the game writes each home's name on it: no letters in the art). Same format as the bosses (characters/sprite.ts).
 */
import type { Part } from "../../characters/sprite.ts";

export type Pt = readonly [number, number];
export type Key = string | null;

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
/** A ramp of three keys by a light value (0 dark to 1 light): banded, never blended. */
export const tone = (l: number, ramp: string): string => ramp[l < 0.3 ? 0 : l > 0.8 ? 2 : 1]!;

/** A part painted over the box (x0, y0, w, h) in frame pixels: `fn` gives each pixel's palette key (null: empty). */
export function paint(x0: number, y0: number, w: number, h: number, fn: (x: number, y: number) => Key, outline = true): { part: Part; at: Pt } {
  const grid = Array.from({ length: h }, (_, j) => Array.from({ length: w }, (_, i) => fn(x0 + i, y0 + j) ?? ".").join(""));
  return { part: { grid, outline }, at: [x0, y0] };
}

/** A small seeded hash of a pixel, in [0, 1): for speckles and grain that stay put. */
export function grain(x: number, y: number, seed = 1): number {
  let h = Math.imul(x + 0x9e37, 0x85ebca6b) ^ Math.imul(y + 0x7f4a, 0xc2b2ae35) ^ Math.imul(seed, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/**
 * The sign: a blank board in a wooden frame (lit along the top and left, a nail in each corner). Keys: `wood` dark to
 * light (4), `face` shadow, board, light (3), `nail`.
 */
export function signBoard(x0: number, y0: number, w: number, h: number, wood = "NOPQ", face = "STU", nail = "L"): { part: Part; at: Pt } {
  return paint(x0, y0, w, h, (x, y) => {
    const i = x - x0;
    const j = y - y0;
    const edge = Math.min(i, j, w - 1 - i, h - 1 - j);
    if (edge < 2) {
      if ((i === 1 || i === w - 2) && (j === 1 || j === h - 2)) return nail;
      if (j === 0 || (i === 0 && j < h - 1)) return wood[3]!;
      if (j === h - 1 || i === w - 1) return wood[0]!;
      return j === h - 2 || i === w - 2 ? wood[1]! : wood[2]!;
    }
    if (j === 2) return face[2]!;
    if (j === h - 3 || i === w - 3) return face[0]!;
    return face[1]!;
  });
}

/** Where the game writes on a sign board made by signBoard at (x0, y0, w, h): its face, inside the frame. */
export const signFace = (x0: number, y0: number, w: number, h: number) => ({ x: x0 + 2, y: y0 + 3, w: w - 5, h: h - 6 }) as const;

/** A sign's post, 3 pixels wide, from `top` down to `foot`: lit on its left. Keys: wood dark to light (4). */
export const signPost = (px: number, top: number, foot: number, wood = "NOPQ") => paint(px, top, 3, foot - top, (x) => (x === px ? wood[2]! : x === px + 2 ? wood[0]! : wood[1]!));

/** A soft shadow on the ground: an ellipse around (cx, cy) of half-axes rx, ry; its rim see-through (keys `core`, `rim`). */
export const groundShadow = (cx: number, cy: number, rx: number, ry: number, core = "-", rim = "+") =>
  paint(Math.floor(cx - rx), Math.floor(cy - ry), Math.ceil(2 * rx) + 1, Math.ceil(2 * ry) + 1, (x, y) => {
    const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
    return d > 1 ? null : d > 0.55 ? rim : core;
  }, false);
