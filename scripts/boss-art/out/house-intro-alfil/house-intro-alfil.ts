/**
 * Alfil's battle intro (house-intro-alfil): the three pieces of art code plays when you challenge him in his shop.
 *
 * 1. INTRO_ALFIL_PYRAMID: a smooth sand pyramid that rises out of the floor in the middle of his battle circle (`rise`),
 *    holds while he speaks (`idle`), cracks with gold light (`crack`) and falls away (`crumble`), leaving his table.
 *    Same foot as the table.
 * 2. INTRO_ALFIL_TABLE: the town's chess table (park.ts PARK_TABLE), same geometry, in his colors: a sandstone column
 *    with a gold band, two sandstone drums with a red and a blue band. INTRO_ALFIL_TABLE_PALETTE drives the slab the
 *    renderer draws; INTRO_ALFIL_TABLE_INK the board.
 * 3. INTRO_ALFIL_STORM (128 x 128, tiles both ways) and INTRO_ALFIL_FRONT (48 x 128, tiles top to bottom): the sandstorm
 *    transition, as two small looping pictures code slides and tiles.
 *
 * HOUSE_INTRO_ALFIL is the review sheet: `idle` shows every piece side by side; one extra animation per piece animation.
 * Colors from Alfil (characters/alfil.ts), his pyramid (town/houses/alfil.ts) and his shop (house-shop-alfil).
 */
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../../../packages/app/src/characters/sprite.ts";
import { grain, groundShadow, paint } from "../../../../packages/app/src/town/houses/kit.ts";
import { TABLE_PIECES } from "../../../../packages/app/src/town/houses/park.ts";
import { TOWN_FEEL } from "../../../../packages/app/src/town/feel.ts";

type Pt = readonly [number, number];
type Key = string | null;

// ---- Colors: one palette for every piece (so the review sheet can lay them side by side).

const PALETTE: Record<string, string> = {
  k: "#1d120d", // outline (Alfil's)
  R: "#e0312a", // his red, its shade
  r: "#a51d24",
  B: "#2f63cc", // his blue, its shade, a light blue
  N: "#1d3d8c",
  I: "#6d97e6",
  Y: "#f2c14e", // gold: mid, light, shade, deepest
  y: "#ffe58a",
  O: "#b4840f",
  P: "#7c5609",
  v: "#ffffff", // a glint, the hottest light in a crack
  a: "#f0d6a0", // sandstone (his pyramid's): lightest to darkest
  b: "#e0bd80",
  c: "#c99e62",
  d: "#a87e48",
  e: "#7d5c33",
  // Desert sand (the shop's dunes and fountain sand): highlight, lit, mid, shade, deep shade, darkest ochre.
  h: "#fff3d6",
  i: "#f8da9e",
  j: "#ecbf74",
  l: "#d49e58",
  m: "#b07a40",
  n: "#86592c",
  // Dust: solid light and mid, and see-through (thick, thin, faint).
  g: "#f3e2bd",
  G: "#d8bb90",
  q: "#f5cf88d0",
  Q: "#eab565a0",
  "%": "#f0c88060",
  // The table's slab keys (INTRO_ALFIL_TABLE_PALETTE): gold edge, sandstone top, mid, front, deep.
  "1": "#ffd75e",
  "2": "#dcb77c",
  "3": "#c49a5e",
  "4": "#a87e48",
  "5": "#7d5c33",
  // The board (INTRO_ALFIL_TABLE_INK): light square, its shade, its line; dark square, its shade, its line.
  "6": "#ecc98c",
  "7": "#d9b170",
  "8": "#b8904f",
  "9": "#3768c4",
  "0": "#2a539f",
  "=": "#1d3d8c",
  // The pieces (the town's, unchanged): cream, its shade, its line; charcoal, its shade, its line.
  W: "#f6f1e6",
  w: "#d3c9b6",
  Z: "#2b2622",
  X: "#2d2c33",
  x: "#57565f",
  z: "#0c0c10",
  "-": "#0d0e1280", // ground shadow: core, rim (see-through)
  "+": "#0d0e1244",
};
const HALO = "#fff3d630";

/** A part from a function over a box in frame pixels (kit.ts paint), as {part, at}. */
type Bit = { part: Part; at: Pt };
const L = (part: string, at: Pt): Layer => ({ part, x: at[0], y: at[1] });

// ================================================================================================================
// 2. The table: PARK_TABLE's geometry (park.ts), in his colors.
// ================================================================================================================

const PX = 37;
const TW = 3 * PX; // 111
const TH = 50;
const TFOOT = TH - 6; // 44
const TCX = Math.floor(TW / 2); // 55
const TOP_Y = TFOOT - 27; // 17: the slab's top, as park.ts
const SEAT_H = Math.round(TOWN_FEEL.sitSeat * PX);

/** The leg: a short sandstone column on a stepped plinth, a gold band round its middle, a capital under the slab. */
const tableLeg = paint(TCX - 7, TOP_Y + 4, 15, TFOOT - TOP_Y - 4, (x, y) => {
  const X = x - TCX;
  const j = TFOOT - y; // 1 at the ground, up to 23 under the slab
  const lit = (w: number) => (X < -w + 2 ? "a" : X < 0 ? "b" : X < w - 1 ? "c" : "d");
  if (j <= 2) return Math.abs(X) > 7 ? null : j === 2 ? (X < -3 ? "a" : X < 4 ? "b" : "c") : X < -3 ? "c" : X < 4 ? "d" : "e"; // plinth
  if (j === 3) return Math.abs(X) > 6 ? null : X < -3 ? "b" : X < 3 ? "c" : "d";
  if (j >= 21) return Math.abs(X) > 6 ? null : j === 23 ? (X < 2 ? "a" : "b") : lit(6); // capital
  if (j === 20) return Math.abs(X) > 5 ? null : X < 0 ? "c" : "d";
  if (Math.abs(X) > 4) return null;
  if (j >= 10 && j <= 12) return j === 12 ? (X < 1 ? "y" : "Y") : j === 11 ? (X < -1 ? "y" : X < 2 ? "Y" : "O") : X < 0 ? "O" : "P"; // the gold band
  if (X === 1 && j > 4 && j < 19 && j !== 9 && j !== 13) return "c"; // a flute
  return lit(4);
});

/** A stool: a little sandstone drum, its top a round seat, a red band over a blue one round its middle. */
const tableStool = (sx: number) =>
  paint(sx - 8, TFOOT - SEAT_H - 3, 17, SEAT_H + 4, (x, y) => {
    const X = x + 0.5 - sx;
    const j = TFOOT - (y + 0.5);
    if (j > SEAT_H - 2) {
      const t = (X / 8) ** 2 + ((j - SEAT_H) / 3) ** 2;
      if (t > 1) return null;
      if (t > 0.7 && j < SEAT_H) return X < 2 ? "b" : "c"; // the seat's front rim
      return X < -2 && j > SEAT_H ? "a" : X < 4 ? "b" : "c";
    }
    const w = j < 2 ? 6 : 5;
    if (Math.abs(X) > w) return null;
    const jj = Math.floor(j);
    const band = Math.round(SEAT_H * 0.5);
    if (jj === band + 1 || jj === band) return X > 2 ? "r" : "R";
    if (jj === band - 1 || jj === band - 2) return X > 2 ? "N" : "B";
    if (jj === band + 2 || jj === band - 3) return X < -1.5 ? "y" : X > 2 ? "O" : "Y"; // gold edging
    if (j < 2) return X < -1.5 ? "c" : X > 2 ? "e" : "d";
    return X < -1.5 ? "a" : X > 2 ? "c" : "b";
  });

const TABLE_BITS: Record<string, Bit> = {
  shadow: groundShadow(TCX + 1, TFOOT, 14, 4),
  shL: groundShadow(TCX - PX + 1, TFOOT, 8, 3),
  shR: groundShadow(TCX + PX + 1, TFOOT, 8, 3),
  stoolL: tableStool(TCX - PX),
  stoolR: tableStool(TCX + PX),
  leg: tableLeg,
};
const tableParts: Record<string, Part> = {};
for (const [n, b] of Object.entries(TABLE_BITS)) tableParts[n] = b.part;
const tableFrame: Frame = { ms: 1000, layers: Object.entries(TABLE_BITS).map(([n, b]) => L(n, b.at)) };

export const INTRO_ALFIL_TABLE: Character = {
  id: "intro-alfil-table",
  name: "Alfil's chess table",
  w: TW,
  h: TH,
  foot: [TCX, TFOOT],
  palette: PALETTE,
  parts: tableParts,
  anims: { idle: { loop: true, frames: [tableFrame] } },
};

/**
 * The slab's colors for the renderer (keys "1" to "5", lightest to darkest): "1" the top's gold edge, "2" the sandstone
 * top, "4" its front face. L and D: the board's squares (as park.ts's palette), P and Q the pieces (unchanged).
 */
export const INTRO_ALFIL_TABLE_PALETTE: Record<string, string> = {
  k: PALETTE.k!,
  "1": PALETTE["1"]!,
  "2": PALETTE["2"]!,
  "3": PALETTE["3"]!,
  "4": PALETTE["4"]!,
  "5": PALETTE["5"]!,
  L: PALETTE["6"]!,
  D: PALETTE["9"]!,
  P: "#fbfbf6",
  Q: "#262321",
};
/** The board in his colors: pale sand and his blue (a mid blue, so the charcoal pieces still show on it). */
export const INTRO_ALFIL_TABLE_INK = {
  light: PALETTE["6"]!,
  lightShade: PALETTE["7"]!,
  lightLine: PALETTE["8"]!,
  dark: PALETTE["9"]!,
  darkShade: PALETTE["0"]!,
  darkLine: PALETTE["="]!,
} as const;

// ---- For the review: a mock slab on the table, and an 8 x 8 board with the town's pieces on it.

const SLAB_HALF = 16;
const mockSlab = paint(TCX - SLAB_HALF, TOP_Y - 9, 2 * SLAB_HALF + 1, 13, (x, y) => {
  const i = x - (TCX - SLAB_HALF);
  const j = y - (TOP_Y - 9);
  if (j >= 10) return j === 10 ? "3" : "4"; // the front face
  if (j === 0 || i === 0) return "1"; // the gold edge
  if (i === 2 * SLAB_HALF || j === 9) return "3";
  // the board set in its top
  if (i >= 4 && i <= 2 * SLAB_HALF - 4 && j >= 2 && j <= 8) return (Math.floor((i - 4) / 3.2) + Math.floor((j - 2) / 1)) % 2 ? "9" : "6";
  return "2";
});

const SQ = 12;
const BOARD_N = 8;
const BOARD_PX = SQ * BOARD_N + 4;
const boardBit = paint(0, 0, BOARD_PX, BOARD_PX, (x, y) => {
  if (x < 2 || y < 2 || x >= BOARD_PX - 2 || y >= BOARD_PX - 2) return x < 2 || y < 2 ? "1" : "4"; // a sandstone frame, gold edge
  const c = Math.floor((x - 2) / SQ);
  const r = Math.floor((y - 2) / SQ);
  const dark = (c + r) % 2 === 1;
  const i = (x - 2) % SQ;
  const j = (y - 2) % SQ;
  if (j === SQ - 1 || i === SQ - 1) return dark ? "0" : "7"; // each square's shaded edge
  return dark ? "9" : "6";
});
/** The town's pieces on the board: [file, rank (0 at top), piece, white?]. */
const BOARD_SET: [number, number, string, boolean][] = [
  [0, 0, "R", false], [1, 0, "N", false], [2, 0, "B", false], [3, 0, "Q", false], [4, 0, "K", false], [5, 0, "B", false], [7, 0, "R", false],
  [0, 1, "P", false], [1, 1, "P", false], [2, 1, "P", false], [5, 1, "P", false], [6, 1, "P", false], [7, 1, "P", false],
  [3, 2, "P", false], [5, 2, "N", false], [4, 3, "P", false], [3, 3, "P", true], [4, 4, "P", true], [2, 4, "B", true],
  [5, 5, "N", true], [0, 6, "P", true], [1, 6, "P", true], [2, 6, "P", true], [5, 6, "P", true], [6, 6, "P", true], [7, 6, "P", true],
  [0, 7, "R", true], [1, 7, "N", true], [2, 7, "B", true], [3, 7, "Q", true], [4, 7, "K", true], [7, 7, "R", true],
];
const piecesBit = (() => {
  const W = BOARD_PX;
  const fill: Key[][] = Array.from({ length: W }, () => Array<Key>(W).fill(null));
  const lineOf: Key[][] = Array.from({ length: W }, () => Array<Key>(W).fill(null));
  for (const [f, r, p, white] of BOARD_SET) {
    const g = TABLE_PIECES[p]!;
    const x0 = 2 + f * SQ + 2;
    const y0 = 2 + r * SQ + SQ - 2 - g.length;
    g.forEach((row, j) =>
      [...row].forEach((ch, i) => {
        const X = x0 + i;
        const Y = y0 + j;
        if (Y < 0) return;
        if (ch === "#") fill[Y]![X] = white ? (i >= 5 ? "w" : "W") : i >= 5 ? "X" : i <= 1 && j > 0 ? "x" : "X";
        else if (ch === "x") fill[Y]![X] = white ? "Z" : "z";
        if (ch !== ".") for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) lineOf[Y + dy]![X + dx] ??= white ? "Z" : "z";
      }),
    );
  }
  return paint(0, 0, W, W, (x, y) => fill[y]![x] ?? lineOf[y]![x] ?? null, false);
})();

// ================================================================================================================
// 1. The pyramid: a smooth sand pyramid on the table's square. Same foot as the table: 111 wide, foot at [55, 106].
// ================================================================================================================

const PW = TW; // 111
const PH = 116;
const PCX = TCX; // 55
const PF = PH - 10; // 106 (the table's 6 below its foot, plus 4 for the pyramid's front corner and the drift)
const P_HT = 94; // the whole pyramid's height over its back corners
const P_HW = 48; // its half-width
const RIDGE_DX = 6; // its front corner sits this far right of the apex (we see its lit left face and shaded right face)
const BACK_Y = PF - 2; // the base's left and right corners
const FRONT_Y = PF + 4; // its front corner

/** A frame's shape: height, half-width and how pyramid it is (0: a round mound, 1: a sharp pyramid). */
interface Shape {
  ht: number;
  hw: number;
  s: number;
}
const FULL: Shape = { ht: P_HT, hw: P_HW, s: 1 };
const full = (fn: (x: number, y: number) => Key, outline = true, w = PW, h = PH): Part => ({
  grid: Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => fn(x, y) ?? ".").join("")),
  outline,
});
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function profile(sh: Shape, X: number): number {
  const u = Math.abs(X) / sh.hw;
  if (u >= 1) return -1;
  return sh.ht * ((1 - sh.s) * Math.sqrt(1 - u * u) + sh.s * (1 - u));
}
function baseY(sh: Shape, X: number): number {
  const rx = RIDGE_DX * sh.s;
  const t = X < rx ? (rx - X) / (sh.hw + rx) : (X - rx) / (sh.hw - rx);
  const lin = FRONT_Y - (FRONT_Y - BACK_Y) * Math.min(1, t);
  const arc = BACK_Y + (FRONT_Y - BACK_Y) * Math.sqrt(Math.max(0, 1 - t * t));
  return sh.s * lin + (1 - sh.s) * arc;
}
function inside(sh: Shape, x: number, y: number): boolean {
  const X = x + 0.5 - PCX;
  const p = profile(sh, X);
  return p >= 0 && y + 0.5 >= BACK_Y - p && y + 0.5 < baseY(sh, X);
}
/**
 * The sand's color at a pixel: lit left face, shaded right face (blended from a round mound's light as it grows), the
 * lit left edge, and the streams of sand pouring down from the apex (dashes along lines fanning out from it, at `phase`).
 */
function sandKey(sh: Shape, x: number, y: number, phase: number | null): string {
  const X = x + 0.5 - PCX;
  const Y = y + 0.5;
  const top = BACK_Y - sh.ht;
  const v = (Y - top) / (FRONT_Y - top); // 0 at the apex, 1 at the front corner
  const ridge = RIDGE_DX * sh.s * v;
  const leftFace = X < ridge;
  const face = leftFace ? 0.74 + (v < 0.14 ? 0.1 : 0) : 0.32 - (v > 0.93 ? 0.12 : 0);
  const round = 0.52 - 0.42 * (X / sh.hw) - 0.42 * ((Y - (BACK_Y - sh.ht * 0.5)) / (sh.ht * 0.6 + 4));
  let l = sh.s * face + (1 - sh.s) * round;
  if (!inside(sh, x - 1, y) || (!inside(sh, x, y - 1) && X < 0)) l += 0.25; // its lit left edge
  if (!inside(sh, x + 1, y) && X > 0) l -= 0.1;
  if (Y > baseY(sh, X) - 2.5) l -= 0.12; // its foot, in its own shade
  const d = Y - top;
  if (phase !== null && d > 4) {
    // The streams: lines fanning from the apex; dashes slide down them as `phase` grows.
    const n = Math.round((X / d) * 6.5);
    const off = X - (n * d) / 6.5;
    const dash = (((d - phase * 3 + n * 7) % 11) + 11) % 11;
    if (n !== 0 && dash < 6) {
      // A rivulet of sand: a lit streak with its little shadow to its right.
      if (Math.abs(off) < 0.5) l += 0.2;
      else if (off >= 0.5 && off < 1.5 && dash < 5) l -= 0.22;
    }
  }
  if (sh.s > 0.6 && grain(x, y, 13) > 0.94) l += leftFace ? -0.12 : 0.12; // a few loose grains on the faces
  return "mljih"[Math.floor(clamp(l, 0, 0.999) * 5)]!;
}
/** The pyramid's left and right edge on a row (the first and last sand pixel), or null. */
function edges(sh: Shape, y: number): [number, number] | null {
  let a = -1;
  let b = -1;
  for (let x = 0; x < PW; x++) if (inside(sh, x, y)) (a < 0 && (a = x), (b = x));
  return a < 0 ? null : [a, b];
}

/** A soft dust puff (see-through, no outline): a lumpy round cloud, its rim thinner. */
function puff(cx: number, cy: number, r: number, seed: number, rimOnly = false): Bit {
  const R = Math.ceil(r) + 2;
  return paint(Math.floor(cx - R), Math.floor(cy - R), 2 * R + 1, 2 * R + 1, (x, y) => {
    const dx = x + 0.5 - cx;
    const dy = (y + 0.5 - cy) * 1.4;
    const lump = r * (0.82 + 0.25 * Math.sin(Math.atan2(dy, dx) * 3 + seed));
    const d = Math.hypot(dx, dy);
    if (d > lump) return null;
    if (rimOnly) return d > lump * 0.6 ? "%" : "Q"; // a thinning puff: see-through
    if (d > lump * 0.82) return "q";
    return d < lump * 0.6 && dy < 1 && dx < 2 ? "g" : "G";
  }, false);
}

/** The pieces' parts, frames and anims as they're made. */
const pyParts: Record<string, Part> = {};
let pyN = 0;
const addBit = (b: Bit): Layer => {
  const n = `p${pyN++}`;
  pyParts[n] = b.part;
  return L(n, b.at);
};
const addPart = (p: Part, at: Pt = [0, 0]): Layer => addBit({ part: p, at });
const shadowFor = (sh: Shape) => addBit(groundShadow(PCX + 2, PF, sh.hw + 3, 6));

/** Grains running down both edges of the pyramid (specks): `n` per side, `f` slides them. */
function edgeGrains(sh: Shape, f: number, n: number, keys = "ij"): Speck[] {
  const out: Speck[] = [];
  const top = BACK_Y - sh.ht;
  for (let side = 0; side < 2; side++)
    for (let g = 0; g < n; g++) {
      const span = BACK_Y - top - 4;
      if (span < 4) continue;
      const y = Math.floor(top + 4 + ((g * 23 + side * 11 + f * 5) % span));
      const e = edges(sh, y);
      if (!e) continue;
      const x = side === 0 ? e[0] - 1 - (g % 2) : e[1] + 1 + (g % 2);
      out.push([x, y, keys[(g + side) % keys.length]!]);
      if (g % 2 === 0) out.push([x + (side ? -1 : 1) * 0, y - 2, keys[0]!]);
    }
  return out;
}

// ---- rise: a mound swells out of the floor and climbs into the pyramid; sand pours down, dust puffs at its foot.

const RISE: readonly [number, number, number][] = [
  [0.1, 0.42, 0],
  [0.22, 0.58, 0],
  [0.36, 0.7, 0.12],
  [0.5, 0.8, 0.32],
  [0.64, 0.88, 0.52],
  [0.78, 0.94, 0.72],
  [0.9, 0.98, 0.9],
  [1, 1, 1],
];
const riseFrames: Frame[] = RISE.map(([kh, kw, s], f) => {
  const sh: Shape = { ht: P_HT * kh, hw: P_HW * kw, s };
  const body = addPart(full((x, y) => (inside(sh, x, y) ? sandKey(sh, x, y, f) : null)));
  // Dust: puffs rolling out at its foot, biggest in the middle of the climb.
  const pr = [8, 11, 13, 14, 14, 12, 10, 7][f]!;
  const spread = Math.min(sh.hw + 2, 46 - pr);
  const dust = [
    addBit(puff(PCX - spread, BACK_Y + 1, pr, f)),
    addBit(puff(PCX + spread, BACK_Y + 2, pr - 1, f + 2)),
    ...(f > 0 && f < 6 ? [addBit(puff(PCX - spread * 0.55, FRONT_Y - 1, pr - 2, f + 4)), addBit(puff(PCX + spread * 0.6, FRONT_Y - 1, pr - 2, f + 5))] : []),
  ];
  // Clods of floor sand thrown up as it breaks out, early on.
  const clods: Speck[] = f < 4 ? [-1, 1].flatMap((d) => [0, 1, 2].map((i): Speck => [Math.round(PCX + d * (sh.hw * 0.6 + i * 6 + f * 3)), Math.round(BACK_Y - sh.ht * 0.6 - 3 + i * 4 + f * 2), i % 2 ? "j" : "i"])) : [];
  return { ms: 90, layers: [shadowFor(sh), body, ...dust], specks: [...edgeGrains(sh, f, f < 2 ? 1 : 3), ...clods], ...(f === 0 ? { cue: "rumble" } : {}) };
});

// ---- idle: the whole pyramid, a grain or two trickling down its edges.

const fullBody = full((x, y) => (inside(FULL, x, y) ? sandKey(FULL, x, y, 0) : null));
const fullBodyL = addPart(fullBody);
const idleFrames: Frame[] = [0, 1].map((f) => ({
  ms: 420,
  layers: [shadowFor(FULL), fullBodyL],
  specks: [...edgeGrains(FULL, f * 2 + 7, 1), ...(f ? [[PCX - 1, BACK_Y - P_HT - 1, "h"] as Speck] : [])],
}));

// ---- crack: cracks run down from the apex, gold light shining through them, brighter each frame; sand spills out.

/** Rasterized line through points (8-connected, in order). */
function path(pts: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    let [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (!out.length || out[out.length - 1]![0] !== x0 || out[out.length - 1]![1] !== y0) out.push([x0, y0]);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) (err += dy), (x0 += sx);
      if (e2 <= dx) (err += dx), (y0 += sy);
    }
  }
  return out;
}
const AP = BACK_Y - P_HT; // the apex's row (10)
/** The cracks: their points, and the crack frames they start and finish growing on. */
const CRACKS: { pts: Pt[]; from: number; to: number }[] = [
  { pts: path([[PCX, AP + 1], [PCX - 3, AP + 13], [PCX - 1, AP + 23], [PCX - 8, AP + 37], [PCX - 6, AP + 49], [PCX - 14, AP + 64], [PCX - 12, AP + 78], [PCX - 19, AP + 96]]), from: 0, to: 4 },
  { pts: path([[PCX + 1, AP + 1], [PCX + 4, AP + 15], [PCX + 2, AP + 29], [PCX + 7, AP + 43], [PCX + 5, AP + 58], [PCX + 10, AP + 74], [PCX + 8, AP + 88], [PCX + 9, AP + 101]]), from: 0, to: 4 },
  { pts: path([[PCX - 8, AP + 37], [PCX - 17, AP + 44], [PCX - 23, AP + 54], [PCX - 33, AP + 60], [PCX - 46, AP + 64]]), from: 2, to: 5 },
  { pts: path([[PCX + 2, AP + 29], [PCX + 11, AP + 35], [PCX + 18, AP + 47], [PCX + 27, AP + 52], [PCX + 40, AP + 58]]), from: 2, to: 5 },
  { pts: path([[PCX - 12, AP + 78], [PCX - 22, AP + 82], [PCX - 30, AP + 90], [PCX - 42, AP + 94]]), from: 3, to: 5 },
  { pts: path([[PCX + 10, AP + 74], [PCX + 20, AP + 79], [PCX + 29, AP + 87], [PCX + 46, AP + 92]]), from: 3, to: 5 },
];
const crackAt = (f: number): Set<string> => {
  const s = new Set<string>();
  for (const c of CRACKS) {
    const k = clamp((f - c.from + 1) / (c.to - c.from + 1), 0, 1);
    c.pts.slice(0, Math.round(c.pts.length * k)).forEach(([x, y]) => s.add(`${x},${y}`));
  }
  return s;
};
/** Crack frame looks: the core's key, its dark lip (below and right), and its glow round it (1 and 2 pixels). */
const CRACK_LOOK: readonly [string, string | null, string | null, string | null][] = [
  ["n", "m", null, null],
  ["O", "n", null, null],
  ["Y", "n", null, null],
  ["y", "n", "Y", null],
  ["v", null, "y", "Y"],
  ["v", null, "y", "Y"],
];
const N4: readonly Pt[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function crackedKey(cr: Set<string>, look: (typeof CRACK_LOOK)[number], x: number, y: number): string | null {
  if (!inside(FULL, x, y)) return null;
  const has = (dx: number, dy: number) => cr.has(`${x + dx},${y + dy}`);
  if (has(0, 0)) return look[0];
  if (look[2] && N4.some(([dx, dy]) => has(dx, dy))) return look[2];
  if (look[3] && N4.some(([dx, dy]) => has(2 * dx, 2 * dy)) && grain(x, y, 5) > 0.3) return look[3];
  if (look[1] && (has(-1, 0) || has(0, -1))) return look[1];
  return sandKey(FULL, x, y, 0);
}
const crackFrames: Frame[] = CRACK_LOOK.map((look, f) => {
  const cr = crackAt(f);
  const body = addPart(full((x, y) => crackedKey(cr, look, x, y)));
  // Sand spilling out of the cracks: grains falling under a few of their points.
  const pts = [...cr].map((s) => s.split(",").map(Number) as unknown as Pt).filter((_, i) => i % 9 === 4);
  const spill: Speck[] = pts.flatMap(([x, y], i): Speck[] => [[x + 1, y + 2 + ((f + i) % 3), "i"], [x + 1, y + 4 + ((f + i) % 3), "j"]]);
  // At the last two frames the apex flares.
  const flare: Speck[] = f >= 4 ? [[PCX, AP - 2, "y"], [PCX, AP - 3, f === 5 ? "v" : "y"], [PCX - 2, AP - 1, "Y"], [PCX + 2, AP - 1, "Y"], ...(f === 5 ? ([[PCX, AP - 5, "Y"], [PCX - 4, AP - 2, "Y"], [PCX + 4, AP - 2, "Y"]] as Speck[]) : [])] : [];
  return { ms: f < 3 ? 140 : 120, layers: [shadowFor(FULL), body], specks: [...spill, ...flare, ...edgeGrains(FULL, f, 1)], ...(f === 0 ? { cue: "crack" } : {}), ...(f === 5 ? { shake: [1, 0] as const } : {}) };
});

// ---- crumble: the pyramid breaks along its cracks and falls away outward and down; the middle clears from frame 3.

/** Extra splits that open only as it breaks. */
const SPLITS: Pt[][] = [
  path([[PCX - 6, AP + 49], [PCX - 20, AP + 50], [PCX - 30, AP + 47]]),
  path([[PCX + 5, AP + 58], [PCX + 18, AP + 66], [PCX + 34, AP + 70]]),
  path([[PCX - 3, AP + 13], [PCX - 8, AP + 22], [PCX - 18, AP + 26]]),
  path([[PCX + 4, AP + 15], [PCX + 11, AP + 22]]),
  path([[PCX - 6, AP + 49], [PCX + 5, AP + 58]]),
  path([[PCX - 12, AP + 78], [PCX + 10, AP + 74]]),
];
const WALL = new Set<string>([...CRACKS.flatMap((c) => c.pts), ...SPLITS.flat()].map(([x, y]) => `${x},${y}`));
/** Each sand pixel's chunk (flood fill between the cracks), and each chunk's middle. */
const chunkOf: number[][] = Array.from({ length: PH }, () => Array<number>(PW).fill(-1));
const chunks: { cx: number; cy: number; n: number }[] = [];
for (let y = 0; y < PH; y++)
  for (let x = 0; x < PW; x++) {
    if (chunkOf[y]![x] !== -1 || !inside(FULL, x, y) || WALL.has(`${x},${y}`)) continue;
    const id = chunks.length;
    const c = { cx: 0, cy: 0, n: 0 };
    const stack: Pt[] = [[x, y]];
    chunkOf[y]![x] = id;
    while (stack.length) {
      const [px, py] = stack.pop()!;
      c.cx += px;
      c.cy += py;
      c.n++;
      for (const [dx, dy] of N4) {
        const nx = px + dx;
        const ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= PW || ny >= PH || chunkOf[ny]![nx] !== -1 || !inside(FULL, nx, ny) || WALL.has(`${nx},${ny}`)) continue;
        chunkOf[ny]![nx] = id;
        stack.push([nx, ny]);
      }
    }
    chunks.push({ cx: c.cx / c.n, cy: c.cy / c.n, n: c.n });
  }
/** Each sand pixel's depth inside its chunk (1 on its rim), so a chunk wears away from its edges in. */
const depthOf: number[][] = Array.from({ length: PH }, () => Array<number>(PW).fill(0));
{
  let ring: Pt[] = [];
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < PW; x++) {
      const id = chunkOf[y]![x]!;
      if (id >= 0 && N4.some(([dx, dy]) => chunkOf[y + dy]?.[x + dx] !== id)) (depthOf[y]![x] = 1), ring.push([x, y]);
    }
  for (let d = 2; ring.length; d++) {
    const next: Pt[] = [];
    for (const [x, y] of ring)
      for (const [dx, dy] of N4) {
        const nx = x + dx;
        const ny = y + dy;
        if (chunkOf[ny]?.[nx] === chunkOf[y]![x] && depthOf[ny]![nx] === 0) (depthOf[ny]![nx] = d), next.push([nx, ny]);
      }
    ring = next;
  }
}
/** Each chunk's box, so it can be kept in the frame as it flies. */
const chunkBox = chunks.map(() => ({ x0: PW, x1: 0 }));
chunkOf.forEach((row, y) => row.forEach((id, x) => id >= 0 && ((chunkBox[id]!.x0 = Math.min(chunkBox[id]!.x0, x)), (chunkBox[id]!.x1 = Math.max(chunkBox[id]!.x1, x)))));
/**
 * The clear middle where the table stands, from crumble frame 3 (index 2) on: at least 61 x 50 over the foot, its sides
 * ragged outward by a pixel or three (so what's cut off there reads as crumbling sand, not a straight edge).
 */
const CLEAR = { x0: PCX - 30, x1: PCX + 31, y0: PF - 46, y1: PF + 4 };
const inClear = (x: number, y: number) => {
  const j = Math.floor(grain(0, y >> 1, 41) * 4);
  return x >= CLEAR.x0 - j && x < CLEAR.x1 + j && y >= CLEAR.y0 - (grain(x >> 1, 0, 42) < 0.5 ? 1 : 2) && y < CLEAR.y1;
};
const OUT = [1, 4, 11, 18, 24, 29, 33, 36];
const FALL = [0, -1, 1, 5, 11, 19, 28, 40];
const ERODE = [0, 0, 0, 1, 2, 3, 5, 99];
const HEAP = [0, 1, 3, 5, 7, 7, 6, 4];
/** The drifted sand round the foot: heaps either side that build up as the chunks land, a low drift along the front. */
function drift(t: number): Part {
  return full((x, y) => {
    const X = x + 0.5 - PCX;
    const Y = y + 0.5;
    if (Math.abs(X) > 50) return null;
    const bump = HEAP[t]! * Math.exp(-(((Math.abs(X) - 45) / 7) ** 2));
    const top = PF + 2 - bump - (t >= 2 ? 1 : 0);
    const bot = PF + 4 + 2 * Math.sqrt(Math.max(0, 1 - (X / 50) ** 2));
    if (Y < top || Y >= bot) return null;
    if (t < 2 && Math.abs(X) < 40) return null;
    if (inClear(x, y)) return null;
    const l = 0.6 - 0.35 * (X / 53) + (Y < top + 1.5 ? 0.25 : 0) - (Y > bot - 1.5 ? 0.2 : 0) + (grain(x, y, 9) - 0.5) * 0.3;
    return "mljih"[Math.floor(clamp(l, 0, 0.999) * 5)]!;
  });
}
const crumbleFrames: Frame[] = OUT.map((out, t) => {
  const layers: Layer[] = t < 2 ? [shadowFor(FULL)] : [];
  // The gold light behind the breaking pyramid, its first two frames: shows in the gaps between the chunks.
  if (t < 2)
    layers.push(addPart(full((x, y) => {
      if (!inside({ ht: P_HT - 4, hw: P_HW - 3, s: 1 }, x, y)) return null;
      return t === 1 && inside({ ht: P_HT - 34, hw: P_HW - 20, s: 1 }, x, y) ? "v" : "y";
    }, false)));
  layers.push(addPart(drift(t)));
  if (t === 0) {
    // Its first frame: still whole, every crack and split blazing white-hot (the light about to burst it).
    const cr = new Set([...crackAt(5), ...WALL]);
    layers.push(addPart(full((x, y) => crackedKey(cr, ["v", null, "y", "Y"], x, y))));
  }
  for (let id = 0; id < chunks.length && t > 0; id++) {
    const c = chunks[id]!;
    const X = c.cx - PCX;
    const side = Math.abs(X) < 2 ? (id % 2 ? 1 : -1) : Math.sign(X);
    const high = (BACK_Y - c.cy) / P_HT; // 0 at the foot, 1 at the apex
    // The low middle slumps straight down into the floor as sliding sand; everything else is thrown out and falls.
    const slump = Math.abs(X) < 20 && c.cy > CLEAR.y0;
    const box = chunkBox[id]!;
    const ox = slump ? 0 : clamp(Math.round(side * out * (0.7 + Math.abs(X) / 60 + high * 0.4)), 3 - box.x0, PW - 4 - box.x1);
    const oy = slump ? [0, 3, 9, 16, 24, 32, 40, 48][t]! : Math.round(FALL[t]! * (0.5 + high) - (t > 0 && t < 3 ? high * 3 : 0));
    const wear = slump ? [0, 1, 99, 99, 99, 99, 99, 99][t]! : ERODE[t]!;
    const grid = full((x, y) => {
      const sx = x - ox;
      const sy = y - oy;
      if (sx < 0 || sy < 0 || sx >= PW || sy >= PH || chunkOf[sy]![sx] !== id) return null;
      if (y > PF + 3 - Math.round(high * 2)) return null; // sunk into the drift
      if (depthOf[sy]![sx]! <= wear + (grain(sx >> 1, sy >> 1, 77) > 0.6 ? 1 : 0) && wear > 0) return null;
      if (t >= 2 && inClear(x, y)) return null;
      return crackedKey(new Set(), CRACK_LOOK[0]!, sx, sy);
    });
    if (grid.grid.some((r) => /[^.]/.test(r))) layers.push(addPart(grid));
  }
  // Dust: puffs rolling out at the sides as it falls (never over the middle).
  if (t >= 1 && t <= 6) {
    const r = [0, 6, 8, 9, 10, 9, 7][t]!;
    for (const d of [-1, 1]) {
      layers.push(addBit(puff(PCX + d * 41, PF - 5 - t, r, t + d, t >= 5)));
      if (t >= 2) layers.push(addBit(puff(PCX + d * (26 + t), CLEAR.y0 - 7 - t * 2, r * 0.6, t * 3 + d, t >= 5)));
    }
  }
  // Flying grains and chips.
  const specks: Speck[] = [];
  if (t >= 1 && t <= 6)
    for (let i = 0; i < 14; i++) {
      const d = i % 2 ? 1 : -1;
      const x = PCX + d * (20 + ((i * 7) % 23) + t * (4 + (i % 4)));
      const y = PF - 70 + ((i * 13) % 50) + t * t * 1.2;
      if ((!inClear(Math.round(x), Math.round(y)) || t < 2) && x > 2 && x < PW - 3 && y < PF + 4) specks.push([Math.round(x), Math.round(y), "ijlh"[i % 4]!]);
    }
  return { ms: t < 2 ? 110 : 90, layers, specks, ...(t === 0 ? { cue: "crumble" } : {}), ...(t === 2 ? { cue: "table" } : {}), ...(t === 1 ? { shake: [0, 1] as const } : {}) };
});

export const INTRO_ALFIL_PYRAMID: Character = {
  id: "intro-alfil-pyramid",
  name: "Alfil's sand pyramid",
  w: PW,
  h: PH,
  foot: [PCX, PF],
  palette: PALETTE,
  halo: HALO,
  parts: pyParts,
  anims: {
    rise: { loop: false, frames: riseFrames },
    idle: { loop: true, frames: idleFrames },
    crack: { loop: false, frames: crackFrames },
    crumble: { loop: false, frames: crumbleFrames },
  },
};

// ================================================================================================================
// 3. The sandstorm: STORM (128 x 128, tiles both ways) and FRONT (48 x 128, tiles top to bottom), 6 frames each.
// ================================================================================================================

const ST = 128;
const FW = 48;
const mod = (a: number, n: number) => ((a % n) + n) % n;
const cum = (steps: number[]) => steps.map((_, i) => steps.slice(0, i).reduce((s, v) => s + v, 0));
/**
 * Three layers race right, each repeating every P pixels across: the haze (P 32, slow, behind), the gusts and swirls
 * (P 128) and the streaks and grains (P 128, both fast, in front). Each frame a layer moves a whole number of pixels, and
 * over the 6 frames exactly P, so the loop closes with no jump: 5,5,6,5,5,6 (32), 21,22,21,22,21,21 and
 * 21,21,22,21,21,22 (128).
 */
const SHIFT = {
  back: cum([5, 5, 6, 5, 5, 6]),
  mid: cum([21, 22, 21, 22, 21, 21]),
  front: cum([21, 21, 22, 21, 21, 22]),
};
type Pat = Key[][];
const pat = (w: number): Pat => Array.from({ length: ST }, () => Array<Key>(w).fill(null));
const stamp = (p: Pat, x: number, y: number, k: string) => (p[mod(Math.round(y), ST)]![mod(Math.round(x), p[0]!.length)] = k);

/** The haze: bands of ochre and sand blowing in long waves (opaque, the storm's body). */
const BACK_BANDS = "jlijljmljiljlmjl";
const BAND_TOP = cum([9, 6, 11, 7, 5, 10, 8, 6, 12, 7, 9, 5, 8, 10, 7, 8]);
const backPat: Pat = pat(32);
for (let y = 0; y < ST; y++)
  for (let u = 0; u < 32; u++) {
    // Each band's lower seam is ragged: it steps up and down by a pixel or two in runs along the band (a hash per run).
    const run = (b: number) => Math.floor(grain(Math.floor((u + b * 5) / 4) % 8, b, 31) * 3.2) - 1;
    const wave = 1.2 * Math.sin((2 * Math.PI * 3 * y) / ST);
    const by0 = mod(y + wave, ST);
    let b0 = 0;
    while (b0 < 15 && BAND_TOP[b0 + 1]! <= by0) b0++;
    const band = by0 - BAND_TOP[b0]! < run(b0) ? mod(b0 - 1, 16) : b0;
    backPat[y]![u] = BACK_BANDS[band]!;
  }

/** The gusts: dark wind-shaped blobs (a round head, a tapering tail), swirls of lit sand curling off, pale dust wisps. */
const MID_P = 128;
const midPat: Pat = pat(MID_P);
for (let i = 0; i < 9; i++) {
  const ex = Math.floor(grain(i, 1, 51) * MID_P);
  const ey = i * 14 + Math.floor(grain(i, 2, 51) * 8);
  const rx = 15 + Math.floor(grain(i, 3, 51) * 9);
  const ry = 3 + Math.floor(grain(i, 4, 51) * 3);
  for (let dx = -rx * 2; dx <= rx; dx++) {
    const t = dx / rx;
    const h = t > 0 ? ry * Math.sqrt(1 - t * t) : ry * Math.pow(Math.max(0, 1 + t / 2), 1.3);
    for (let dy = -Math.ceil(h); dy <= Math.ceil(h); dy++) {
      if (Math.abs(dy) > h) continue;
      stamp(midPat, ex + dx, ey + dy, Math.abs(dy) < h * 0.5 && t > -1.2 ? "n" : "m");
    }
  }
}
for (let i = 0; i < 6; i++) {
  // A swirl: a tail of lit sand running in from the left, curling up into a spiral.
  const cx = Math.floor(grain(i, 5, 52) * MID_P);
  const cy = i * 21 + 10 + Math.floor(grain(i, 6, 52) * 8);
  const R = 5 + (i % 2);
  for (let x = -16; x <= 0; x++) stamp(midPat, cx + x, cy + R, x < -10 ? "j" : "i");
  for (let a = 0; a < 2 * Math.PI * 1.15; a += 0.04) {
    const r = R * (1 - a / (2 * Math.PI * 1.5));
    const th = Math.PI / 2 - a; // from the bottom, round clockwise (up the right side, over the top)
    stamp(midPat, cx + r * Math.cos(th + Math.PI), cy + r * Math.sin(th + Math.PI) * -1, a > 4.5 ? "h" : "i");
  }
}
for (let i = 0; i < 5; i++) {
  // A pale wisp of dust haze.
  const ex = Math.floor(grain(i, 7, 53) * MID_P);
  const ey = i * 26 + 18;
  for (let x = 0; x < 30 + (i % 3) * 12; x++) stamp(midPat, ex + x, ey + 2 * Math.sin(x / 6 + i), x > 8 && x < 34 ? "g" : "G");
}

/** The streaks and grains: bright dashes of pale sand and gold, brightest at their heads (right), and loose grains. */
const frontPat: Pat = pat(ST);
for (let i = 0; i < 46; i++) {
  const ex = Math.floor(grain(i, 1, 61) * ST);
  const ey = Math.floor(grain(i, 2, 61) * ST);
  const len = 6 + Math.floor(grain(i, 3, 61) * 24);
  const kind = grain(i, 4, 61);
  const keys = kind < 0.55 ? "hij" : kind < 0.85 ? "yYO" : "gGG";
  for (let x = 0; x < len; x++) {
    const t = x / len; // 0 at its head
    stamp(frontPat, ex - x, ey, keys[t < 0.3 ? 0 : t < 0.7 ? 1 : 2]!);
    if (kind > 0.4 && kind < 0.7 && x > 1 && x < len * 0.6) stamp(frontPat, ex - x - 2, ey + 1, keys[1]!); // a thick one
  }
}
for (let i = 0; i < 80; i++) {
  const ex = Math.floor(grain(i, 5, 62) * ST);
  const ey = Math.floor(grain(i, 6, 62) * ST);
  const g = grain(i, 7, 62);
  stamp(frontPat, ex, ey, g < 0.1 ? "v" : g < 0.5 ? "h" : "y");
  for (let x = 1; x <= 1 + (i % 3); x++) stamp(frontPat, ex - x, ey, g < 0.5 ? "i" : "Y");
}

/** The storm's color at a pixel of frame f (x may run past the tile: it repeats). */
const stormKey = (x: number, y: number, f: number): string =>
  frontPat[mod(y, ST)]![mod(x - SHIFT.front[f]!, ST)] ?? midPat[mod(y, ST)]![mod(x - SHIFT.mid[f]!, MID_P)] ?? backPat[mod(y, ST)]![mod(x - SHIFT.back[f]!, 32)]!;

const stormParts: Record<string, Part> = {};
const stormFrames: Frame[] = [0, 1, 2, 3, 4, 5].map((f) => {
  stormParts[`s${f}`] = full((x, y) => stormKey(x, y, f), false, ST, ST);
  return { ms: 70, layers: [{ part: `s${f}`, x: 0, y: 0 }], ...(f === 0 ? { cue: "storm" } : {}) };
});
export const INTRO_ALFIL_STORM: Character = {
  id: "intro-alfil-storm",
  name: "Alfil's sandstorm (tile)",
  w: ST,
  h: ST,
  foot: [ST / 2, ST - 1],
  palette: PALETTE,
  parts: stormParts,
  anims: { idle: { loop: true, frames: stormFrames } },
};

/**
 * The leading edge: the storm itself on its left (the next tile's columns, so it meets STORM with no seam), a ragged edge
 * of billowing lobes that churn round each frame, then thinning see-through dust and grains flying ahead.
 */
/** The billows: big lobes along the edge and smaller ones out ahead of them, each churning round on its own phase. */
const LOBES = [
  ...Array.from({ length: 6 }, (_, i) => ({ y: (i * 128) / 6 + grain(i, 1, 81) * 6, x: 15 + grain(i, 2, 81) * 6, r: 12 + grain(i, 3, 81) * 5, p: grain(i, 4, 81) * 6.28 })),
  ...Array.from({ length: 6 }, (_, i) => ({ y: ((i + 0.5) * 128) / 6 + grain(i, 5, 81) * 4, x: 25 + grain(i, 6, 81) * 5, r: 6 + grain(i, 7, 81) * 3, p: grain(i, 8, 81) * 6.28 })),
];
/** How far (pixels) a point lies outside the storm's billowing edge at frame f (0: inside). */
function outside(x: number, y: number, f: number): number {
  const ph = (2 * Math.PI * f) / 6;
  const body = 17 + 2 * Math.sin((2 * Math.PI * 2 * y) / ST + ph);
  let out = x < body ? 0 : x - body;
  for (const l of LOBES) {
    const cy = l.y + 2 * Math.sin(ph + l.p);
    const cx = l.x + 3 * Math.cos(ph + l.p);
    const r = l.r * (1 + 0.12 * Math.sin(ph * 1 + l.p * 2));
    const dy = mod(y + 0.5 - cy + 64, ST) - 64;
    out = Math.min(out, Math.max(0, Math.hypot(x + 0.5 - cx, dy * 1.1) - r));
    if (out === 0) return 0;
  }
  return out;
}
function frontKey(x: number, y: number, f: number): Key {
  const out = outside(x, y, f);
  if (out === 0) {
    // The billows' edges: lit where they face up and left, in shade where they face down, a pale rim where they face out.
    const o = (dx: number, dy: number) => outside(x + dx, y + dy, f) > 0;
    if (o(0, -2) || o(-2, -1)) return o(0, -1) ? "h" : "g";
    if (o(0, 2)) return o(0, 1) ? "m" : "l";
    if (o(1, 0)) return "G";
    if (o(2, 0)) return "j";
    return stormKey(x, y, f);
  }
  if (out < 1.5) return "q";
  if (out < 3.5) return "Q";
  // Thinning dust ahead: wisps streaming right, dashes along each row sliding 3 px a frame (an 18 px repeat: 6 frames).
  const wisp = grain(mod(Math.floor((x - 3 * f) / 6), 3), y >> 1, 71);
  if (out < 7) return wisp > 0.3 ? "%" : null;
  if (out < 12) return wisp > 0.72 ? "%" : null;
  return null;
}
const frontParts: Record<string, Part> = {};
const frontFrames: Frame[] = [0, 1, 2, 3, 4, 5].map((f) => {
  frontParts[`e${f}`] = full((x, y) => frontKey(x, y, f), false, FW, ST);
  // Grains and wisps flying ahead: each runs 3 px a frame over an 18 px stretch, so it comes round in 6 frames.
  const specks: Speck[] = [];
  for (let i = 0; i < 18; i++) {
    const y = Math.floor((i * 128) / 18 + grain(i, 1, 72) * 5);
    const x = 28 + mod(Math.floor(grain(i, 2, 72) * 18) + 3 * f, 18);
    const k = i % 3 === 0 ? "y" : i % 3 === 1 ? "h" : "i";
    specks.push([x, y, k], [x - 1, y, i % 2 ? "q" : "Q"]);
    if (i % 4 === 0) specks.push([x - 2, y, "Q"]);
  }
  return { ms: 70, layers: [{ part: `e${f}`, x: 0, y: 0 }], specks };
});
export const INTRO_ALFIL_FRONT: Character = {
  id: "intro-alfil-front",
  name: "Alfil's sandstorm (leading edge)",
  w: FW,
  h: ST,
  foot: [0, ST - 1],
  palette: PALETTE,
  parts: frontParts,
  anims: { idle: { loop: true, frames: frontFrames } },
};

// ================================================================================================================
// The review sheet.
// ================================================================================================================

/** Copies a character's frame into the sheet at (dx, dy): its parts under a prefix, its layers and specks moved. */
function place(sheetParts: Record<string, Part>, prefix: string, ch: Character, frame: Frame, dx: number, dy: number): { layers: Layer[]; specks: Speck[] } {
  const layers = frame.layers.map((l) => {
    const name = `${prefix}:${l.part}`;
    sheetParts[name] = ch.parts[l.part]!;
    return { ...l, part: name, x: l.x + dx, y: l.y + dy };
  });
  const specks = (frame.specks ?? []).map(([x, y, k]): Speck => [x + dx, y + dy, k]);
  return { layers, specks };
}

/** Lays out frames side by side: each slot a character's frame at an offset. */
function compose(parts: Record<string, Part>, slots: { prefix: string; ch: Character; frame: Frame; at: Pt }[], ms: number): Frame {
  const layers: Layer[] = [];
  const specks: Speck[] = [];
  for (const s of slots) {
    const p = place(parts, s.prefix, s.ch, s.frame, s.at[0], s.at[1]);
    layers.push(...p.layers);
    specks.push(...p.specks);
  }
  return { ms, layers, specks };
}

// ---- The storm's seam check: STORM tiled 3 x 2, the FRONT column at its right (and its frames all animate together).

const GRID_W = 3 * ST + FW;
const GRID_H = 2 * ST;
const stormGridSlots = (f: number) => [
  ...[0, 1, 2].flatMap((i) => [0, 1].map((j) => ({ prefix: `storm${i}${j}`, ch: INTRO_ALFIL_STORM, frame: stormFrames[f]!, at: [i * ST, j * ST] as Pt }))),
  ...[0, 1].map((j) => ({ prefix: `front${j}`, ch: INTRO_ALFIL_FRONT, frame: frontFrames[f]!, at: [3 * ST, j * ST] as Pt })),
];
const gridParts: Record<string, Part> = {};
const STORM_GRID: Character = {
  id: "intro-alfil-storm-grid",
  name: "Alfil's sandstorm: seam check",
  w: GRID_W,
  h: GRID_H,
  foot: [GRID_W / 2, GRID_H - 1],
  palette: PALETTE,
  parts: gridParts,
  anims: { idle: { loop: true, frames: [0, 1, 2, 3, 4, 5].map((f) => compose(gridParts, stormGridSlots(f), 70)) } },
};

// ---- The sheet: the pyramid, the table (with a mock slab: its palette's top, gold edge and front) and a board in its
// ink, then the storm's seam check.

const SHEET_W = 230 + GRID_W;
const SHEET_H = GRID_H + 4;
const sheetParts: Record<string, Part> = {};
const sheetAnims: Record<string, Anim> = {};
const tableWithSlab: Character = {
  ...INTRO_ALFIL_TABLE,
  parts: { ...tableParts, slab: mockSlab.part, board: boardBit.part, pieces: piecesBit.part },
};
const slabFrame: Frame = { ms: 1000, layers: [...tableFrame.layers, L("slab", mockSlab.at)] };
const boardFrame: Frame = { ms: 1000, layers: [L("board", [0, 0]), L("pieces", [0, 0])] };
const AT = { pyramid: [2, 2] as Pt, table: [2, 132] as Pt, table2: [2, 196] as Pt, board: [120, 8] as Pt, grid: [230, 2] as Pt };
/** The sheet with one piece's frame swapped in (the rest at rest). */
function sheetFrame(over: { pyramid?: Frame; table?: Frame; grid?: number }, ms: number): Frame {
  return compose(
    sheetParts,
    [
      { prefix: "pyr", ch: INTRO_ALFIL_PYRAMID, frame: over.pyramid ?? idleFrames[0]!, at: AT.pyramid },
      { prefix: "tab", ch: tableWithSlab, frame: over.table ?? slabFrame, at: AT.table },
      { prefix: "tab2", ch: tableWithSlab, frame: tableFrame, at: AT.table2 },
      { prefix: "brd", ch: tableWithSlab, frame: boardFrame, at: AT.board },
      ...stormGridSlots(over.grid ?? 0).map((s) => ({ ...s, at: [s.at[0] + AT.grid[0], s.at[1] + AT.grid[1]] as Pt })),
    ],
    ms,
  );
}
sheetAnims.idle = { loop: true, frames: [sheetFrame({}, 1000)] };
for (const [name, anim] of Object.entries(INTRO_ALFIL_PYRAMID.anims))
  sheetAnims[`pyramid-${name}`] = { loop: anim.loop, frames: anim.frames.map((fr) => ({ ...sheetFrame({ pyramid: fr }, fr.ms), cue: fr.cue })) };
sheetAnims.table = { loop: true, frames: [sheetFrame({ table: tableFrame }, 1000)] };
sheetAnims.storm = { loop: true, frames: [0, 1, 2, 3, 4, 5].map((f) => sheetFrame({ grid: f }, 70)) };

/** The check that the feet match: the table (with its mock slab) drawn behind the pyramid's crumble from frame 3 on. */
const overParts: Record<string, Part> = {};
const OVERLAY: Character = {
  id: "intro-alfil-overlay",
  name: "Crumble over the table",
  w: PW,
  h: PH,
  foot: [PCX, PF],
  palette: PALETTE,
  parts: overParts,
  anims: {
    idle: {
      loop: false,
      frames: crumbleFrames.map((fr, t) =>
        compose(overParts, [...(t >= 2 ? [{ prefix: "t", ch: tableWithSlab, frame: slabFrame, at: [PCX - TCX, PF - TFOOT] as Pt }] : []), { prefix: `c${t}`, ch: INTRO_ALFIL_PYRAMID, frame: fr, at: [0, 0] as Pt }], fr.ms),
      ),
    },
  },
};
sheetAnims["crumble-over-table"] = { loop: false, frames: OVERLAY.anims.idle!.frames.map((fr) => ({ ...sheetFrame({}, fr.ms), layers: [...sheetFrame({}, fr.ms).layers.filter((l) => !l.part.startsWith("pyr:")), ...fr.layers.map((l) => ({ ...l, x: l.x + AT.pyramid[0], y: l.y + AT.pyramid[1] }))], specks: (fr.specks ?? []).map(([x, y, k]): Speck => [x + AT.pyramid[0], y + AT.pyramid[1], k]) })) };
for (const [n, p] of Object.entries(overParts)) sheetParts[n] = p;

/** (While drawing, a single piece can be reviewed on its own here; the sheet when null.) */
const DEV = null as Character | null;
export const HOUSE_INTRO_ALFIL: Character = DEV ? { ...DEV, id: "house-intro-alfil" } : {
  id: "house-intro-alfil",
  name: "Alfil's battle intro (review sheet)",
  w: SHEET_W,
  h: SHEET_H,
  foot: [SHEET_W / 2, SHEET_H - 4],
  palette: PALETTE,
  parts: sheetParts,
  anims: sheetAnims,
};
