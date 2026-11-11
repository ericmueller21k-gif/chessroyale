/**
 * Don Dough's ultimate, Gold Plate (Eric, Nov 11): "He makes his queen gold plated and it becomes shiny gold, and can no longer
 * be captured by pawns for the rest of the game." Drawn by hand on the weekly plan usage.
 *
 * The gold pieces themselves are the board's own drawings (cburnett, BSD), recolored gold: `pieces/gold-<k><l|d>.svg` for the
 * queen, rook, bishop and knight, both colors (`l` white's set: bright gold, a dark brown outline; `d` black's set: an antique
 * gold, the black outline kept, its light details pale gold), so the two sides stay told apart. Draw them as the board draws
 * `piece.<color>.<kind>`, in place of his piece once gilded.
 *
 * GOLD_FX (32 x 32, a board square's effect frame as effects/common.ts SQUARE; foot [16, 31]), drawn over the square:
 * - `gild` (once, 8 frames, about 0.8 s): a band of gold sweeps up over the piece from its foot, a shower of glitter, a big
 *   four-point sparkle at its top (cue `gild` f0, `shine` f5). Swap his piece for the gold one at f3, under the band.
 * - `glint` (loops, about 2.6 s): the gold piece's idle: nothing for most of it, then a small sparkle runs over it (a twinkle at
 *   its shoulder, then its top). Three frames carry pixels; the rest are empty (cue `glint` f2: very soft, or none).
 * - `clink` (once, 6 frames, about 0.5 s): a pawn bouncing off it. Drawn for a pawn coming from the square's bottom left (a
 *   white pawn taking up and to the right); mirror it left to right, and top to bottom for one coming down. A star of sparks at
 *   the corner it hits (cue `clink` f1), little "ting" lines, a spark or two. GOLD_CLINK_PAWN gives, per frame, how far the real
 *   pawn has come toward the gold piece (squares, along its diagonal): it comes in, hits, and bounces back home.
 */
import type { Anim, Character, Frame, Speck } from "../../../../packages/app/src/characters/sprite.ts";

const S = 32;
const PALETTE: Record<string, string> = {
  k: "#4a2e06",
  w: "#ffffff", // the sparkle: white-hot, pale gold, gold, deep gold
  y: "#fff2b0",
  g: "#f6cf55",
  G: "#d99a1c",
  a: "#f6cf5570", // the gilding band, see-through: light, bright edge
  A: "#fff2b0a0",
  t: "#e8f4ff", // the clink's ting lines
};
type Pt = readonly [number, number];
function hash(x: number, y: number, seed = 1): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** A four-point sparkle at (x, y), arms `r` px: a white heart, pale-gold arms, gold tips. */
function sparkle([x, y]: Pt, r: number): Speck[] {
  const out: Speck[] = [[x, y, "w"]];
  for (let i = 1; i <= r; i++) {
    const k = i === 1 ? "w" : i < r ? "y" : "g";
    out.push([x + i, y, k], [x - i, y, k], [x, y + i, k], [x, y - i, k]);
  }
  if (r >= 3) out.push([x + 1, y + 1, "y"], [x - 1, y - 1, "y"], [x + 1, y - 1, "y"], [x - 1, y + 1, "y"]);
  return out;
}
const inside = (sp: Speck[]): Speck[] => sp.filter(([x, y]) => x >= 1 && y >= 1 && x <= S - 2 && y <= S - 2);

/** The gilding band: a slanted bar of see-through gold sweeping up the square (its leading edge at height `h` from the foot). */
function band(h: number): Speck[] {
  const out: Speck[] = [];
  for (let y = 2; y <= 29; y++)
    for (let x = 4; x <= 27; x++) {
      const up = 29 - y + (x - 16) * 0.35; // slanted: higher to the right
      const d = h - up;
      if (d < 0 || d > 7) continue;
      out.push([x, y, d < 1.5 ? "A" : "a"]);
    }
  return out;
}
/** Glitter falling off behind the band. */
function glitter(h: number, seed: number): Speck[] {
  const out: Speck[] = [];
  for (let n = 0; n < 9; n++) {
    const x = 5 + Math.floor(hash(n, 1, seed) * 22);
    const y = 29 - h + 6 + Math.floor(hash(n, 2, seed) * 10);
    if (y >= 2 && y <= 29) out.push([x, y, n % 3 === 0 ? "w" : n % 3 === 1 ? "y" : "G"]);
  }
  return out;
}
const gild: Anim = {
  loop: false,
  frames: [0, 1, 2, 3, 4, 5, 6, 7].map((f): Frame => {
    const h = [3, 9, 15, 21, 27, 33, 40, 40][f]!;
    const sp: Speck[] = [];
    if (f <= 5) sp.push(...band(h), ...glitter(h, f + 1));
    if (f === 5) sp.push(...sparkle([16, 6], 3));
    if (f === 6) sp.push(...sparkle([16, 6], 5), ...sparkle([7, 18], 1), ...sparkle([25, 14], 1));
    if (f === 7) sp.push(...sparkle([16, 6], 2));
    return { ms: f === 6 ? 160 : f === 7 ? 120 : 80, layers: [], specks: inside(sp), ...(f === 0 ? { cue: "gild" } : f === 5 ? { cue: "shine" } : {}) };
  }),
};
const glint: Anim = {
  loop: true,
  frames: [
    { ms: 1800, layers: [] },
    { ms: 70, layers: [], specks: inside(sparkle([11, 16], 1)) },
    { ms: 90, layers: [], specks: inside(sparkle([13, 11], 2)), cue: "glint" },
    { ms: 80, layers: [], specks: inside(sparkle([16, 6], 2)) },
    { ms: 600, layers: [] },
  ],
};
/** The pawn's place per clink frame: how far it has come toward the gold piece, in squares (0 home, 0.5 the touch). */
export const GOLD_CLINK_PAWN = [0.3, 0.42, 0.28, 0.12, 0.04, 0] as const;
const clink: Anim = {
  loop: false,
  frames: [
    { ms: 60, layers: [] },
    {
      ms: 70,
      layers: [],
      cue: "clink",
      specks: inside([...sparkle([5, 27], 3), [8, 22, "t"], [9, 21, "t"], [10, 25, "t"], [11, 25, "t"], [3, 23, "t"], [3, 22, "t"]]),
    },
    { ms: 80, layers: [], specks: inside([...sparkle([5, 27], 2), [9, 20, "t"], [10, 19, "t"], [12, 25, "t"], [13, 25, "t"], [2, 21, "t"], [2, 20, "t"], [8, 29, "g"]]) },
    { ms: 90, layers: [], specks: inside([...sparkle([6, 26], 1), [11, 18, "y"], [14, 24, "y"], [3, 29, "G"]]) },
    { ms: 90, layers: [], specks: inside([[12, 17, "g"], [15, 23, "g"]]) },
    { ms: 80, layers: [] },
  ],
};
export const GOLD_FX: Character = {
  id: "zebra-gold-fx",
  name: "Don Dough's Gold Plate (the board's effects)",
  w: S,
  h: S,
  foot: [16, 31],
  palette: PALETTE,
  parts: {},
  anims: { gild, glint, clink },
};
