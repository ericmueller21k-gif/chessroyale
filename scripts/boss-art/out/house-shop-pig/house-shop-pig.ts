/**
 * Inside Wrangler's barn: Wrangler's shop (house-shop-pig). A room of 20 x 20 squares seen as the town square is seen (the
 * camera looks north, things stand upright at their foot, 37 px a square), in his colors (characters/pig.ts PIG_PALETTE:
 * leather browns, rope, gold, his stall's red stripe; houses/pig.ts "Wrangler's Stall"). Drawn by hand (Nov 4, weekly plan
 * usage), built exactly as Dash's and Timber's shops are (scripts/boss-art/out/house-shop-blitz).
 *
 * Weathered plank walls and beams, a red top beam, straw on a plank floor, hay bales stacked high, two hanging lanterns'
 * worth of light, his coiled ropes hung on the walls, a saddle on a rail, a water trough. Two wooden pens with chess
 * knights in them (white ones in one, black in the other) hopping round in little L-shaped hops, with a skip now and
 * then. The board on its stand, set back in the north-west corner: a hay bale with the chessboard on it (the intro lassos
 * it and drags it to the middle). The counter at the back, 30 px tall, a blank plaque on it, Wrangler's Boss Crate on it
 * (a wooden crate with a rope round it and a gold star brand). In the middle, the battle spot: a straw bed in a ring of
 * rope laid on the floor (a lasso, its knot at the south), a painted gold star in a red ring where the table stands, his
 * mark (a red saddle-blanket mat with a gold star) on the west and yours (a denim mat with a gold horseshoe) on the east.
 *
 * Footing: a piece's foot is the middle of its square (a wide piece's: the middle of its width, on the middle of its row;
 * a deep piece stands on its south row). Floor tiles are flat, top-down, 37 x 37, foot at their middle. The circle's
 * tiles are each drawn where they lie (no turning); the east wall is the west one mirrored (`flip`).
 */
import { frameKeys, type Anim, type Character, type Frame, type Layer, type Part } from "../../../../packages/app/src/characters/sprite.ts";
import { grain, groundShadow, LANTERN_LIGHT, paint, signBoard, signFace, WARM, type LightPool, type LightSpot, type Pt } from "../../../../packages/app/src/town/houses/kit.ts";
import { BUCKET_PALETTE, standingBucket } from "./hunchess-bucket.ts";

const PALETTE: Record<string, string> = {
  k: "#2b1411", // outline (Wrangler's)
  "1": "#2e1a10", // barn wood: the gaps, dark, mid-dark, mid, light, bright (cut ends, lit edges)
  "2": "#4a2c19",
  "3": "#6b4126",
  "4": "#8c5a33",
  "5": "#ad7744",
  "6": "#cf9c62",
  f: "#7d5d3d", // the floorboards: a board, a lighter board, the grain, the seam
  F: "#87663f",
  g: "#6b4e33",
  i: "#4d3522",
  o: "#8f6c1f", // straw and hay: deep, mid, light, bright
  p: "#c29a35",
  q: "#e3c35a",
  Q: "#f6e29a",
  h: "#5e4512", // a bale's edge (the dark between stacked bales)
  O: "#a8700f", // gold (his stars and buckles): shade, mid, light, shine
  Y: "#e6ac2a",
  y: "#ffd451",
  L: "#fff3b0",
  r: "#8c5a26", // rope (his): dark, mid, light
  R: "#c58f4b",
  t: "#ecc47c",
  s: "#b8322a", // red (his stall's stripe, the barn's trim): mid, dark, lit
  S: "#7e1d19",
  u: "#dc5a48",
  m: "#33363d", // iron: dark, mid, light
  M: "#62666f",
  n: "#9ca2ac",
  e: "#4a2611", // leather (his hat, the saddle): dark, mid, light, lit
  E: "#6c3d1c",
  G: "#8f5629",
  J: "#b5733a",
  w: "#2f6f96", // water: deep, mid, a glint
  x: "#5aa3c8",
  c: "#bfe6f4",
  "7": "#ffe2a8", // the view outside: the sky low (warm), the haze, the sky high
  "8": "#f2b46a",
  "9": "#a9cfe9",
  "0": "#86b462", // the prairie: lit, shade; the mesas far off
  "!": "#5e8a45",
  "?": "#c49068",
  l: "#fff1b8", // a lantern's glass: bright, warm, deep amber
  z: "#ffc94a",
  Z: "#e0902a",
  V: "#f6f1e6", // the knights: white and its shade (the town's cream pieces), black and its lit edge (the town's charcoal)
  v: "#d3c9b6",
  X: "#2d2c33",
  U: "#57565f",
  B: "#efd9a4", // the chessboard's squares: straw cream, barn red
  D: "#b5523a",
  N: "#355886", // denim (your mark): dark, mid, light
  P: "#5379ad",
  T: "#8eb0da",
  A: "#c9a56a", // the plaque's face: shadow, board, light
  C: "#e8cc95",
  K: "#f7e4b8",
  "-": "#0d0e1280", // ground shadow: core, rim
  "+": "#0d0e1244",
  ...BUCKET_PALETTE, // the HunChess buckets (hunchess-bucket.ts)
};

const T = 37;
type Key = string | null;
type Bit = { part: Part; at: Pt };
interface Piece {
  name: string;
  /** Its footprint in squares (wide, deep) and its picture's size and foot in pixels. */
  sq: readonly [number, number];
  w: number;
  h: number;
  foot: Pt;
  frames: Bit[][];
  ms: number;
}
const PIECES: Record<string, Piece> = {};

function toChar(p: Piece): Character {
  const parts: Record<string, Part> = {};
  const frames: Frame[] = p.frames.map((bits, f) => ({
    ms: p.ms,
    layers: bits.map((b, i) => {
      const n = `f${f}p${i}`;
      parts[n] = b.part;
      return { part: n, x: b.at[0], y: b.at[1] };
    }),
  }));
  return { id: `shop-pig-${p.name}`, name: `Wrangler's barn: ${p.name}`, w: p.w, h: p.h, foot: p.foot, palette: PALETTE, parts, anims: { idle: { loop: true, frames } } };
}
function def(name: string, sq: readonly [number, number], w: number, h: number, foot: Pt, frames: Bit[][], ms = 1000): Character {
  PIECES[name] = { name, sq, w, h, foot, frames, ms };
  return toChar(PIECES[name]!);
}

// ---- A small canvas to stamp on.

type Cv = string[][];
const cv = (w: number, h: number): Cv => Array.from({ length: h }, () => Array<string>(w).fill("."));
const fill = (c: Cv, fn: (x: number, y: number) => Key) => c.forEach((row, y) => row.forEach((_, x) => (row[x] = fn(x, y) ?? row[x]!)));
const put = (c: Cv, x: number, y: number, k: string) => {
  x = Math.round(x);
  y = Math.round(y);
  if (y >= 0 && y < c.length && x >= 0 && x < c[0]!.length) c[y]![x] = k;
};
const get = (c: Cv, x: number, y: number) => c[y]?.[x] ?? ".";
const stamp = (c: Cv, x: number, y: number, rows: readonly string[]) => rows.forEach((r, j) => [...r].forEach((k, i) => k !== "." && put(c, x + i, y + j, k)));
const whole = (c: Cv, outline = false): Bit => ({ part: { grid: c.map((r) => r.join("")), outline }, at: [0, 0] });
/** A canvas cropped to what's drawn on it, as a Bit; null if it's empty. */
const cropBit = (c: Cv, outline = true): Bit | null => {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  c.forEach((row, y) =>
    row.forEach((k, x) => {
      if (k === ".") return;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }),
  );
  if (x1 < 0) return null;
  return { part: { grid: c.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1).join("")), outline }, at: [x0, y0] };
};
const bits = (...bs: (Bit | null)[]): Bit[] => bs.filter((b): b is Bit => b !== null);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number) => (BAYER[(((y % 4) + 4) % 4) * 4 + (((x % 4) + 4) % 4)]! + 0.5) / 16;

// ---- Shared bits: rope, a coil of rope, a star, straw.

/** Rope along points, 2 px thick (its underside dark), twisted: a darker tick every 3 px, the lit twist between. */
function rope(c: Cv, pts: readonly Pt[], phase = 0) {
  let s = phase;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1]!;
    const [bx, by] = pts[i]!;
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 3));
    for (let j = 0; j < n; j++) {
      const x = ax + ((bx - ax) * j) / n;
      const y = ay + ((by - ay) * j) / n;
      s += Math.hypot(bx - ax, by - ay) / n;
      const u = ((s % 3) + 3) % 3;
      const X = Math.floor(x);
      const Y = Math.floor(y);
      put(c, X, Y, u < 1 ? "r" : u < 2 ? "R" : "t");
      if (get(c, X, Y + 1) !== "t" && get(c, X, Y + 1) !== "R") put(c, X, Y + 1, u < 1.2 ? "r" : "R");
    }
  }
}
const ellipsePts = (cx: number, cy: number, rx: number, ry: number, n = 48, a0 = 0, a1 = 2 * Math.PI): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as Pt;
  });
/** A coil of rope hung on a peg at (px, py): three loops hanging down, the peg (dark wood) over them, a tail. */
function coil(c: Cv, px: number, py: number, rx = 8, ry = 10) {
  for (let i = 2; i >= 0; i--) rope(c, ellipsePts(px + i * 1.4 - 1.4, py + ry + 1 + i * 0.6, rx - i * 0.3, ry - i * 0.3, 40), i);
  rope(c, [[px + rx - 2, py + 2 * ry - 1], [px + rx + 1, py + 2 * ry + 4], [px + rx, py + 2 * ry + 8]], 1); // the tail
  stamp(c, px - 1, py - 1, ["32", "21"]);
}
/** A five-pointed star (outer radius R) at (cx, cy): its key by (x, y), or null outside. Lit to the top left. */
function starKey(x: number, y: number, cx: number, cy: number, R: number, keys = "OYyL"): Key {
  const X = x + 0.5 - cx;
  const Y = y + 0.5 - cy;
  // Its ten corners (points and the notches between them), from straight up.
  const pts: Pt[] = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? R * 0.46 : R;
    return [r * Math.cos(a), r * Math.sin(a)] as Pt;
  });
  let inside = false;
  pts.forEach(([ax, ay], i) => {
    const [bx, by] = pts[(i + 1) % 10]!;
    if (ay <= Y !== by <= Y && X < ax + ((Y - ay) / (by - ay)) * (bx - ax)) inside = !inside;
  });
  if (!inside) return null;
  // Lit facets: each point split down its middle, the half toward the top left lit.
  const a = Math.atan2(Y, X) + Math.PI / 2;
  const seg = (2 * Math.PI) / 5;
  const t = ((((a + seg / 2) % seg) + seg) % seg) / seg; // 0..1 across a point, 0.5 its ridge
  const mid = Math.atan2(Y, X);
  const lit = Math.cos(mid + Math.PI * 0.75) > 0; // the half facing the top left
  if (Math.hypot(X, Y) < R * 0.18 && R > 6) return keys[3]!;
  return t < 0.5 ? (lit ? keys[2]! : keys[1]!) : lit ? keys[1]! : keys[0]!;
}
/** Straw: short strands at a slant. `dense` 0..1. Returns a straw key or null (bare). */
function straw(gx: number, gy: number, dense: number, seed: number): Key {
  const u = Math.floor(gx * 0.42 + gy * 0.95);
  const v = Math.floor((gx - gy * 0.45) / 2.6);
  const g = grain(u, v, seed);
  if (g > dense) return null;
  const h = grain(v, u, seed + 1);
  return h < 0.18 ? "o" : h < 0.62 ? "p" : h < 0.92 ? "q" : "Q";
}

// ==== The floor: weathered floorboards running north to south (9 px wide), straw scattered on them.

function boards(x: number, y: number, seed: number): string {
  const b = x < 9 ? 0 : x < 18 ? 1 : x < 27 ? 2 : 3;
  const bx = x - [0, 9, 18, 27][b]!;
  if (bx === 0) return "i";
  // An end joint, somewhere along each board in some tiles.
  const jy = Math.floor(grain(b, seed, 3) * 50) - 6;
  if (y === jy) return "i";
  const tone = grain(b, seed, 4) > 0.5 ? "F" : "f";
  if (bx === 1 && tone === "F") return "F";
  if (grain(bx + b * 11, Math.floor(y / 5), seed + 9) > 0.86 && y % 5 !== 0) return "g"; // the grain
  return tone;
}
function floorFn(seed: number, dense: number) {
  return (x: number, y: number) => straw(x + seed * 37, y + seed * 13, dense, 70 + (seed % 3)) ?? boards(x, y, seed);
}
const floorA = floorFn(1, 0.03);
const floorB = floorFn(2, 0.035);
const floorAt = (col: number, row: number) => ((col + row) % 2 ? floorB : floorA);

const flat = (fn: (x: number, y: number) => Key): Bit[][] => [[paint(0, 0, T, T, fn, false)]];
const tileDef = (name: string, fn: (x: number, y: number) => Key) => def(name, [1, 1], T, T, [18, 18], flat(fn));

export const SHOP_PIG_FLOOR_A = tileDef("floor-a", floorA);
export const SHOP_PIG_FLOOR_B = tileDef("floor-b", floorB);
/** Variety on a: a drift of loose straw in one corner. */
export const SHOP_PIG_FLOOR_C = tileDef("floor-c", (x, y) => {
  const d = Math.hypot((x - 24) / 13, (y - 22) / 9);
  return straw(x + 11, y + 5, d < 1 ? 0.6 - d * 0.45 : 0.04, 81) ?? boards(x, y, 3);
});
/** Variety on b: a wisp of straw and a dropped horseshoe nail's glint (a worn knot in a board). */
export const SHOP_PIG_FLOOR_D = tileDef("floor-d", (x, y) => {
  if (Math.hypot(x - 13.5, (y - 12.5) * 1.4) < 2.2) return Math.hypot(x - 13.5, (y - 12.5) * 1.4) < 1.1 ? "i" : "g"; // a knot
  const d = Math.hypot((x - 9) / 9, (y - 27) / 6);
  return straw(x + 3, y + 21, d < 1 ? 0.5 : 0.05, 82) ?? boards(x, y, 4);
});
/** The path: straw thick on the boards, two squares wide, from the door to the circle and on to the counter; a ragged edge. */
const lane = (side: number) => (x: number, y: number) => {
  const i = side ? T - 1 - x : x; // from its outer edge
  const edge = 3 + Math.round(2 * grain(Math.floor(y / 3), side, 90));
  if (i < edge) return straw(x, y, i === edge - 1 ? 0.35 : 0.08, 91) ?? floorAt(side, 0)(x, y);
  return straw(x, y, 0.82, 92) ?? (grain(x, y, 93) > 0.5 ? "o" : "p");
};
export const SHOP_PIG_LANE_W = tileDef("floor-lane-w", lane(0));
export const SHOP_PIG_LANE_E = tileDef("floor-lane-e", lane(1));

// ==== The battle spot: a straw bed in a ring of rope laid on the floor (a lasso, its knot to the south).

const CX = 10 * T; // its middle, in the room's floor pixels (column 10's west edge, row 11's north edge)
const CY = 11 * T;
const RING = 140; // the rope's middle, from the middle
/** The bed of straw inside the ring (calm: strands at a slant, a few lit, a few deep), or the rope ring, or null outside. */
function bed(gx: number, gy: number): Key {
  const X = gx + 0.5 - CX;
  const Y = gy + 0.5 - CY;
  const d = Math.hypot(X, Y);
  if (d > RING + 4.2) return null;
  if (d > RING + 3.2) return "2"; // the rope's shadow on the boards
  if (d > RING - 3.2) {
    // The rope: twisted (ticks run round it), lit on its inner top, dark at its edges.
    const a = Math.atan2(Y, X);
    const s = a * RING;
    const u = (((s + (d - RING) * 1.4) % 5) + 5) % 5;
    if (d > RING + 2.3 || d < RING - 2.3) return "k";
    if (u < 1.2) return "r";
    return u < 3 ? "R" : (d < RING ? "t" : "R");
  }
  if (d > RING - 6) return grain(gx, gy, 94) > 0.5 ? "o" : "p"; // the straw's edge, pressed by the rope
  const u = Math.floor(gx * 0.42 + gy * 0.95);
  const v = Math.floor((gx - gy * 0.45) / 2.6);
  const g = grain(u, v, 95);
  return g < 0.07 ? "o" : g < 0.78 ? "p" : g < 0.97 ? "q" : "Q";
}
/** The knot of the lasso (its honda) on the ring at the south, and its tail curling off it. */
function knot(gx: number, gy: number): Key {
  const kx = CX + 6;
  const ky = CY + RING;
  const X = gx + 0.5 - kx;
  const Y = gy + 0.5 - ky;
  const d = Math.hypot(X * 0.7, Y);
  if (d < 6) return d > 5 ? "k" : d > 4 ? "r" : X + Y < -1 ? "t" : "R";
  // The tail: off the knot, curling east and back.
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const tx = kx + 5 + t * 30 + 5 * Math.sin(t * 3);
    const ty = ky + 1 + 7 * Math.sin(t * Math.PI) - t * 4;
    const dd = Math.hypot(gx + 0.5 - tx, gy + 0.5 - ty);
    if (dd < 2.4) return dd > 1.7 ? "k" : dd < 0.9 ? ((i % 4) < 2 ? "R" : "t") : "r";
  }
  return null;
}

/** The marks: his (west) a red saddle-blanket mat with a gold star, yours (east) a denim mat with a gold horseshoe. */
const MARKS = { boss: [8, 10.5] as Pt, you: [11, 10.5] as Pt };
export const SHOP_PIG_MARKS = { boss: [8, 10.5], you: [11, 10.5] } as const;
const SHOE = ["..OYYYO..", ".OY...YO.", "OY.....YO", "Y.......Y", "Y.......Y", "Y.......Y", "YO.....OY", "yO.....Oy", "yY.....Yy", "OO.....OO"];
function markAt(gx: number, gy: number): Key {
  for (const [who, [mc, mr]] of Object.entries(MARKS)) {
    const mx = (mc + 0.5) * T;
    const my = (mr + 0.5) * T; // row 10.5's middle: the line between rows 10 and 11, y = 11 x 37, the star's middle
    const X = gx + 0.5 - mx;
    const Y = gy + 0.5 - my;
    const d = Math.hypot(X, Y);
    if (d > 15.5) continue;
    const boss = who === "boss";
    if (d > 14.3) return boss ? "S" : "N"; // the rim
    if (d > 12.6) return (Math.round(Math.atan2(Y, X) * 9) % 2 === 0 ? (boss ? "K" : "K") : boss ? "s" : "P"); // a stitched border
    if (d > 11.4) return boss ? "s" : "P";
    if (boss) return starKey(gx, gy, mx, my - 0.5, 9.5) ?? (X + Y > 8 ? "S" : "s");
    const i = Math.floor(X + 4.5);
    const j = Math.floor(Y + 5);
    const sh = SHOE[j]?.[i];
    if (sh && sh !== ".") return sh;
    return X + Y > 8 ? "N" : "P";
  }
  return null;
}
/** The star in the middle (where the table stands), 2 x 2 squares: the floorboards swept clean, a red ring, a gold star painted on. */
function emblemAt(gx: number, gy: number): Key {
  const X = gx + 0.5 - CX;
  const Y = gy + 0.5 - CY;
  const d = Math.hypot(X, Y);
  if (d > 34) return null;
  if (d > 32.5) return straw(gx, gy, 0.6, 96) ?? "g"; // straw swept up round its edge
  if (d > 30.5) return "S";
  if (d > 27.5) return d > 29.5 ? "s" : "u";
  if (d > 26.5) return "S";
  const st = starKey(gx, gy, CX, CY - 1, 24);
  if (st) return st;
  return boards(((gx % T) + T) % T, ((gy % T) + T) % T, 7);
}

/** The circle's tiles: every square the ring touches, drawn where it lies (marks and the star in it), plain floor round it. */
const circleFn = (col: number, row: number) => (x: number, y: number) => {
  const gx = col * T + x;
  const gy = row * T + y;
  return knot(gx, gy) ?? (bed(gx, gy) === null ? floorAt(col, row)(x, y) : emblemAt(gx, gy) ?? markAt(gx, gy) ?? bed(gx, gy));
};
const CIRCLE = new Set<string>();
for (let row = 6; row <= 15; row++)
  for (let col = 5; col <= 14; col++) {
    let any = false;
    for (let y = 0; y < T && !any; y += 2) for (let x = 0; x < T && !any; x += 2) any = bed(col * T + x, row * T + y) !== null || knot(col * T + x, row * T + y) !== null;
    if (!any) continue;
    CIRCLE.add(`${col},${row}`);
    tileDef(`circle-${col}-${row}`, circleFn(col, row));
  }

// ==== The walls: weathered vertical planks, a heavy top beam painted red, a girt across the middle, ropes and shoes hung.

const WALL_H = 130;
const PILLAR_UP = 20;
const BEAM = 12;
const GIRT = 74; // the girt's top
/** The top beam (the plate): dark wood under a red-painted face, lit along its top. */
const plate = (y: number): Key => (y === 0 ? "k" : y === 1 ? "u" : y < 8 ? (y === 7 ? "S" : "s") : y < BEAM - 1 ? "2" : "1");
/** Planks: 6 px wide, each its own tone, a dark gap between, a knot now and then; the girt across; the skirting at the foot. */
function plank(x: number, y: number, seed: number): string {
  if (y >= WALL_H - 5) return y === WALL_H - 5 ? "3" : "2"; // the skirting board
  if (y >= GIRT && y < GIRT + 7) return y === GIRT ? "6" : y === GIRT + 1 ? "5" : y === GIRT + 6 ? "1" : "4"; // the girt
  const i = Math.floor((x + 2) / 6);
  const bx = (x + 2) % 6;
  if (bx === 0) return "1";
  if ((y === GIRT + 9 || y === GIRT - 3) && bx === 3) return "m"; // nails
  const tone = grain(i, seed, 11);
  if (grain(i, Math.floor(y / 7), seed + 3) > 0.94 && bx > 1 && bx < 5) return "2"; // a knot
  const base = tone < 0.33 ? "3" : tone < 0.8 ? "4" : "5";
  if (bx === 1) return base === "3" ? "4" : base === "4" ? "5" : "6"; // lit on the left
  if (bx === 5) return base === "5" ? "4" : "3";
  if (grain(x, Math.floor(y / 3), seed + 5) > 0.9) return base === "3" ? "2" : "3"; // grain
  return base;
}
function wallCv(c: Cv, y0: number, seed: number) {
  fill(c, (x, yy) => {
    const y = yy - y0;
    if (y < 0) return null;
    if (y < BEAM) return plate(y);
    return plank(x, y, seed);
  });
}
const wallDef = (name: string, seed: number, extra?: (c: Cv) => void) => {
  const c = cv(T, WALL_H);
  wallCv(c, 0, seed);
  extra?.(c);
  return def(name, [1, 1], T, WALL_H, [18, WALL_H - 1], [[whole(c)]]);
};
/** A horseshoe on a nail, open end up (for luck): 9 x 10, iron. */
const HSHOE = ["MM.....MM", "nM.....Mn", "nM.....Mn", "nM.....Mm", "nM.....Mm", "nM.....Mm", ".nM...Mm.", ".nnM.MMm.", "..nMMMm..", "...mmm..."];
export const SHOP_PIG_WALL = wallDef("wall", 1);
/** With a coil of his rope on a peg. */
export const SHOP_PIG_WALL_B = wallDef("wall-b", 2, (c) => coil(c, 17, 30, 9, 12));
/** With two horseshoes and a bridle's loop of leather on nails. */
export const SHOP_PIG_WALL_C = wallDef("wall-c", 3, (c) => {
  stamp(c, 5, 34, HSHOE);
  stamp(c, 21, 40, HSHOE);
  put(c, 9, 33, "m");
  put(c, 25, 39, "m");
  // A loop of leather strap under the girt.
  rope(c, ellipsePts(18, 92, 6, 9, 30, -Math.PI / 2, (3 * Math.PI) / 2).map(([x, y]) => [x, y] as Pt), 0);
  for (let y = 83; y <= 101; y++) for (let x = 11; x <= 25; x++) if ("rRt".includes(get(c, x, y))) put(c, x, y, get(c, x, y) === "t" ? "J" : get(c, x, y) === "R" ? "G" : "e");
  put(c, 18, 82, "m");
});
/** A window: a red-trimmed frame of four panes onto the evening prairie (mesas, a low sun, the grass), a sill. */
const WIN = { x0: 6, x1: 30, y0: 24, y1: 62 } as const;
function prairie(vx: number, y: number): string {
  // The sky: high blue to a warm low glow; a low sun; mesas; the grass.
  const GR = 48;
  if (y >= GR) return (vx * 5 + y * 3) % 17 === 0 ? "!" : y === GR ? "!" : "0";
  const mesa = GR - 6 - (vx % 37 < 14 ? 4 : 0) - (Math.abs((vx % 37) - 25) < 4 ? 2 : 0);
  if (y >= mesa) return y === mesa ? "8" : "?";
  if (Math.hypot(vx - 22, y - 40) < 4) return "L";
  const t = (y - WIN.y0) / (GR - WIN.y0);
  return t < 0.45 ? (t / 0.45 < bayer(vx, y) ? "9" : "7") : (t - 0.45) / 0.55 < bayer(vx, y) ? "7" : "8";
}
export const SHOP_PIG_WALL_WIN = wallDef("wall-win", 4, (c) => {
  for (let y = WIN.y0 - 3; y <= WIN.y1 + 4; y++)
    for (let x = WIN.x0 - 3; x <= WIN.x1 + 3; x++) {
      const inX = x >= WIN.x0 && x <= WIN.x1;
      const inY = y >= WIN.y0 && y <= WIN.y1;
      if (y > WIN.y1 + 1) put(c, x, y, y === WIN.y1 + 2 ? "6" : y === WIN.y1 + 4 ? "2" : "4"); // the sill
      else if (inX && inY) {
        const mid = x === 18 || y === 43;
        put(c, x, y, mid ? (x === 18 && y !== 43 ? "s" : "u") : prairie(x, y));
      } else put(c, x, y, x === WIN.x0 - 3 || y === WIN.y0 - 3 ? "u" : x === WIN.x1 + 3 || y === WIN.y1 + 1 ? "S" : "s");
    }
  // Glass: a slant of reflection on each pane.
  for (let i = 0; i < 5; i++) {
    put(c, 9 + i, 28 + i * 2, "K");
    put(c, 21 + i, 47 + i * 2, "K");
  }
});
/** A post at a corner or a bay: a thick squared timber, lit on its left, a knee brace up to the beam. */
const post = (cx: number, top: number, foot: number, hw = 6) =>
  paint(cx - hw, top, 2 * hw + 1, foot - top, (x, y) => {
    const X = x - cx;
    const j = y - top;
    if (j < 2) return j === 0 ? "6" : "5";
    if (y >= foot - 5) return y === foot - 5 ? "3" : "2";
    if (grain(X + 9, Math.floor(j / 6), 33) > 0.93 && Math.abs(X) < hw - 2) return "3";
    return X < -hw + 2 ? "6" : X > hw - 3 ? (X === hw ? "2" : "3") : grain(X + 9, j, 34) > 0.88 ? "4" : "5";
  });
const brace = (x0: number, y0: number, dir: number) =>
  paint(dir > 0 ? x0 : x0 - 14, y0, 15, 15, (x, y) => {
    const i = dir > 0 ? x - x0 : x0 - x;
    const j = y - y0;
    const d = i + j - 14;
    if (Math.abs(d) > 2) return null;
    return d < -1 ? "6" : d > 0 ? "3" : "4";
  });
export const SHOP_PIG_WALL_POST = (() => {
  const h = WALL_H + PILLAR_UP;
  const c = cv(T, h);
  wallCv(c, PILLAR_UP, 5);
  return def("wall-post", [1, 1], T, h, [18, h - 1], [bits(whole(c), brace(23, PILLAR_UP + 12, 1), post(18, 1, h))]);
})();

// ==== The side walls: the same planks, the plate and the girt, a corner post on the inner edge (the walls run away north).

function sideCv(c: Cv, y0: number, seed: number) {
  fill(c, (x, yy) => {
    const y = yy - y0;
    if (y < 0) return null;
    if (y < BEAM) return plate(y);
    if (x >= T - 4) return x === T - 4 ? "2" : x === T - 3 ? "6" : "5"; // the corner trim on its inner (east) edge
    return plank(x, y, seed);
  });
}
const sideDef = (name: string, seed: number, extra?: (c: Cv) => void) => {
  const c = cv(T, WALL_H);
  sideCv(c, 0, seed);
  extra?.(c);
  return def(name, [1, 1], T, WALL_H, [18, WALL_H - 1], [[whole(c)]]);
};
export const SHOP_PIG_WALL_SIDE = sideDef("wall-side", 6);
export const SHOP_PIG_WALL_SIDE_B = sideDef("wall-side-b", 7, (c) => coil(c, 15, 28, 8, 11));
export const SHOP_PIG_WALL_SIDE_POST = (() => {
  const h = WALL_H + PILLAR_UP;
  const c = cv(T, h);
  sideCv(c, PILLAR_UP, 8);
  return def("wall-side-post", [1, 1], T, h, [18, h - 1], [bits(whole(c), post(18, 1, h))]);
})();

// ==== The front (south) wall: a low plank wall with a rail on top, and the way out (the big barn doors, open).

const HEM_H = 24;
function hemCv(c: Cv, y0: number, seed: number) {
  fill(c, (x, yy) => {
    const y = yy - y0;
    if (y < 0) return null;
    if (y === 0) return "k";
    if (y < 4) return y === 1 ? "6" : y === 3 ? "3" : "5"; // the rail along its top
    if (y >= HEM_H - 3) return y === HEM_H - 3 ? "3" : "2";
    return plank(x, y + 40, seed);
  });
}
export const SHOP_PIG_HEM = (() => {
  const c = cv(T, HEM_H);
  hemCv(c, 0, 9);
  return def("hem", [1, 1], T, HEM_H, [18, HEM_H - 1], [[whole(c)]]);
})();
export const SHOP_PIG_HEM_POST = (() => {
  const h = WALL_H + PILLAR_UP;
  const c = cv(T, h);
  hemCv(c, h - HEM_H, 10);
  return def("hem-post", [1, 1], T, h, [18, h - 1], [bits(whole(c), post(18, 1, h))]);
})();

/**
 * The way out, two squares wide: a heavy timber frame round the big doorway, both barn doors swung wide (their red
 * planks and white Z braces showing edge-on against the frame), the bright prairie outside, a horseshoe on the lintel.
 */
const EW = 2 * T;
const EH = 112;
const EFOOT = EH - 1;
const E_TOP = 36; // the opening's top
const EO0 = 9; // the opening's west and east
const EO1 = 64;
export const SHOP_PIG_ENTRANCE = (() => {
  const out = paint(EO0, E_TOP, EO1 - EO0 + 1, EFOOT - E_TOP + 1, (x, y) => {
    if (y >= EFOOT - 3) return y === EFOOT - 3 ? "6" : y === EFOOT ? "2" : "4"; // the threshold
    if (y >= 84) return (x * 3 + y * 7) % 11 === 0 ? "p" : y === 84 ? "!" : (x + y) % 5 === 0 ? "!" : "0"; // the grass out front
    if (y >= 74) {
      // A split-rail fence across the yard.
      if (y === 76 || y === 81) return "5";
      if ((x - EO0) % 16 === 5 && y < 84) return "3";
      return "0";
    }
    if (y >= 66) return y === 66 ? "8" : (x * 7) % 13 === 0 ? "!" : "?"; // the mesas
    const t = (y - E_TOP) / 30;
    return t < 0.5 ? (t / 0.5 < bayer(x, y) ? "9" : "7") : (t - 0.5) / 0.5 < bayer(x, y) ? "7" : "8";
  }, false);
  // The two doors, swung open against the frame: narrow slivers of red planks, a white brace edge.
  const doors = [EO0, EO1 - 5].map((dx) =>
    paint(dx, E_TOP + 1, 6, EFOOT - E_TOP - 4, (x, y) => {
      const i = x - dx;
      if (i === 0 || i === 5) return "S";
      if ((y - E_TOP) % 18 < 2) return "K";
      return i < 3 ? "u" : "s";
    }),
  );
  const frame = paint(0, E_TOP - 20, EW, EFOOT - E_TOP + 22, (x, y) => {
    if (x >= EO0 && x <= EO1 && y >= E_TOP) return null;
    if (y < E_TOP - 18) return y === E_TOP - 20 ? "6" : "5";
    if (y < E_TOP) return y === E_TOP - 1 ? "2" : y < E_TOP - 12 ? "4" : "3"; // the lintel
    return x < 3 ? "6" : x > EW - 4 ? "2" : x < EO0 ? "4" : "3";
  });
  const shoe = cv(EW, EH);
  stamp(shoe, EW / 2 - 4, E_TOP - 15, HSHOE.map((r) => r.replace(/M/g, "Y").replace(/n/g, "y").replace(/m/g, "O")));
  return def("entrance", [2, 1], EW, EH, [EW / 2, EFOOT], [bits(groundShadow(EW / 2, EFOOT - 1, 34, 3), out, ...doors, frame, cropBit(shoe))]);
})();

// ==== The backdrop behind the counter: his tack wall. A big gold wooden star, two lassos hung either side, a shelf of hats.

const BDW = 4 * T;
const BDH = WALL_H + PILLAR_UP;
export const SHOP_PIG_BACKDROP = (() => {
  const c = cv(BDW, BDH);
  fill(c, (x, yy) => {
    const y = yy - PILLAR_UP;
    if (y < 0) return null;
    if (y < BEAM) return plate(y);
    return plank(x, y, 12);
  });
  // The big star: a wooden star painted gold, nailed up, its points' edges worn.
  const SX = BDW / 2;
  const SY = PILLAR_UP + 42;
  for (let y = SY - 26; y <= SY + 26; y++)
    for (let x = SX - 27; x <= SX + 27; x++) {
      const k = starKey(x, y, SX, SY, 25);
      if (!k) continue;
      put(c, x, y, k);
      if (grain(x, y, 40) > 0.97) put(c, x, y, "5"); // the paint worn through
    }
  // Its dark edge, so it stands off the planks.
  const inStar = (x: number, y: number) => starKey(x, y, SX, SY, 25) !== null;
  for (let y = SY - 30; y <= SY + 30; y++)
    for (let x = SX - 30; x <= SX + 30; x++) if (!inStar(x, y) && (inStar(x - 1, y) || inStar(x + 1, y) || inStar(x, y - 1) || inStar(x, y + 1))) put(c, x, y, "k");
  put(c, SX, SY - 1, "m");
  // Two lassos hung on pegs, either side of it.
  coil(c, 24, PILLAR_UP + 22, 11, 14);
  coil(c, BDW - 26, PILLAR_UP + 22, 11, 14);
  // The shelf, and three of his hats on it (brown, a gold star on each band), spurs hung under it.
  const SH = PILLAR_UP + 84;
  for (let x = 4; x < BDW - 4; x++) {
    put(c, x, SH, "6");
    put(c, x, SH + 1, "4");
    put(c, x, SH + 2, "2");
  }
  for (const bx of [10, BDW - 16]) for (let j = 3; j < 9; j++) put(c, bx + Math.floor(j / 2), SH + j, j % 2 ? "3" : "2"); // brackets
  const HAT = ["....eeeee....", "...eGGJGGe...", "..eGGJJGGEe..", "..eEEyYEEEe..", "eeeEEEEEEEEee", "EGGGEEEEEEEGG", ".eeeeeeeeeee."];
  for (const hx of [22, 68, 114]) stamp(c, hx, SH - 7, HAT);
  for (const sx of [45, 97]) {
    stamp(c, sx, SH + 4, ["e.e", "e.e", "OYO", ".y.", "yOy", ".y."]);
    stamp(c, sx + 5, SH + 4, ["e.e", "e.e", "OYO", ".y.", "yOy", ".y."]);
  }
  return def("backdrop", [4, 1], BDW, BDH, [BDW / 2, BDH - 1], [[whole(c)]]);
})();

// ==== The counter: a plank counter with barn-door X braces, a plank top, low (the rooster shows over it).

const CW = 4 * T;
const CH = 46;
const CFOOT = CH - 3;
const CTOP = 14; // the counter is 30 px tall
/** The plaque on its front (blank: the game writes on it). */
const PLQ = { x: 43, y: CTOP + 7, w: 62, h: 17 } as const;
export const SHOP_PIG_COUNTER_SIGN = signFace(PLQ.x, PLQ.y, PLQ.w, PLQ.h);
/** Where the crate stands on the counter: its foot, in the counter's pixels (on the right, clear of the plaque). */
export const SHOP_PIG_CRATE_AT: Pt = [124, CTOP + 2];
export const SHOP_PIG_COUNTER = (() => {
  const n = CW - 4;
  const body = paint(2, CTOP, n, CFOOT - CTOP + 1, (x, y) => {
    const j = y - CTOP;
    const i = x - 2;
    if (j < 4) return j === 0 ? "6" : j === 1 ? "5" : j === 2 ? "4" : "2"; // the plank top
    if (j >= CFOOT - CTOP - 2) return j === CFOOT - CTOP - 2 ? "3" : "2"; // the kick board
    // Panels in red-painted frames, an X brace in each (as a barn door).
    const panels = [[2, 36], [n - 37, n - 3]] as const;
    for (const [a, b] of panels) {
      if (i < a || i > b) continue;
      const ii = i - a;
      const jj = j - 6;
      const w = b - a;
      const h = CFOOT - CTOP - 10;
      if (ii < 2 || ii > w - 2 || jj < 0 || jj > h) return ii === 0 || jj === -1 ? "u" : ii > w - 2 || jj > h ? "S" : "s";
      const d1 = Math.abs(ii - 2 - ((w - 4) * (jj / h)));
      const d2 = Math.abs(w - 2 - ii - ((w - 4) * (jj / h)));
      if (d1 < 1.5 || d2 < 1.5) return d1 < 0.7 || d2 < 0.7 ? "u" : "s";
      return plank(ii + 3, jj + 20, 13);
    }
    return i < 3 ? "6" : i > n - 4 ? "3" : plank(i, j + 30, 14);
  });
  const plaque = signBoard(PLQ.x, PLQ.y, PLQ.w, PLQ.h, "2345", "ACK", "m");
  const on = cv(CW, CH);
  // A brass bell on the left.
  stamp(on, 9, CTOP - 8, ["...y...", "..OYy..", ".OYYyL.", ".OYYYy.", "OOYYYYy", "mmmmmmm"]);
  // A basket of corn cobs.
  stamp(on, 24, CTOP - 11, [".q.Q.q.q..", "qQqyQqQqy.", "pqQqQqqQq.", "4434443443", "3433434334", "2323232323", ".2222222.."]);
  // A coil of rope.
  const rc = cv(CW, CH);
  for (let i = 0; i < 3; i++) rope(rc, ellipsePts(97, CTOP - 3 - i * 2, 8 - i, 2.5, 30), i);
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (get(rc, x, y) !== ".") put(on, x, y, get(rc, x, y));
  return def("counter", [4, 1], CW, CH, [CW / 2, CFOOT], [bits(groundShadow(CW / 2, CFOOT, CW / 2 - 2, 4), body, plaque, cropBit(on))]);
})();

/**
 * Wrangler's Boss Crate: a sturdy wooden crate, a rope tied round it (a band each way, knotted on top, its ends hanging),
 * a gold star branded on its front. `idle`: a glint runs across the star and winks on the knot (6 frames).
 */
const XW = 34;
const XH = 30;
export const SHOP_PIG_CRATE = (() => {
  const box = paint(1, 8, 32, 20, (x, y) => {
    const j = y - 8;
    const i = x - 1;
    if (i === 0 || i === 31 || j === 0 || j === 19 || i === 1 || i === 30) return j === 0 ? "6" : i <= 1 ? "5" : i >= 30 || j === 19 ? "2" : "4"; // the frame
    if (j === 1) return "3";
    const st = starKey(x, y, 9.5, 19, 6.5, "OYyy");
    if (st) return st;
    if (Math.abs(i - 2 - (j - 1) * 1.5) < 1.2 && i > 14) return "5"; // a brace (behind the rope)
    return j % 6 === 0 ? "2" : grain(i, j, 50) > 0.9 ? "3" : "4";
  });
  const lid = paint(0, 5, 34, 4, (x, y) => (y === 5 ? "6" : y === 8 ? "2" : x < 2 ? "6" : "5"));
  const ropeC = cv(XW, XH);
  rope(ropeC, [[17, 5], [17, 28]], 0);
  rope(ropeC, [[1, 15], [33, 15]], 1);
  rope(ropeC, [[17, 4], [13, 1], [11, 3], [15, 5]], 2); // the knot's loops
  rope(ropeC, [[17, 4], [21, 1], [23, 3], [19, 5]], 0);
  rope(ropeC, [[18, 5], [22, 8], [23, 12]], 1); // an end hanging
  const frames = [0, 1, 2, 3, 4, 5].map((f) => {
    const g = cv(XW, XH);
    const gx = [-9, 4, 8, 12, 16, -9][f]!;
    if (gx > 0) stamp(g, gx - 1, 15 + (f % 2), [".L.", "LLL", ".L."]);
    if (f === 5) stamp(g, 16, 0, [".L.", "LLL", ".L."]);
    return bits(groundShadow(XW / 2, XH - 2, 15, 2), box, lid, cropBit(ropeC), cropBit(g, false));
  });
  return def("crate", [1, 1], XW, XH, [XW / 2, XH - 2], frames, 200);
})();

// ==== Hay: a single bale, and bales stacked high (the twine round each, loose wisps).

/** A bale lying on its long side, its front face (w x h) with its top-left at (x0, y0) and its top face `top` px deep. */
function bale(c: Cv, x0: number, y0: number, w: number, h: number, top: number, seed: number) {
  for (let y = y0 - top; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const onTop = y < y0;
      const i = x - x0;
      const j = onTop ? y - (y0 - top) : y - y0;
      // The top face leans back: its left and right edges step in.
      if (onTop && (i < top - j || i > w - 1 - (top - j) * 0.3)) continue;
      const twine = Math.abs(i - Math.round(w * 0.27)) < 1 || Math.abs(i - Math.round(w * 0.73)) < 1;
      let k: string;
      if (onTop) k = twine ? "r" : grain(x, y, seed) > 0.6 ? "Q" : "q";
      else {
        const l = 0.75 - (j / h) * 0.6 - (i > w - 4 ? 0.3 : 0) + (i < 2 ? 0.2 : 0);
        const g = grain(Math.floor(x / 2), y, seed + 1);
        k = twine ? (j % 3 === 0 ? "t" : "R") : g > 0.85 ? (l > 0.5 ? "Q" : "q") : g < 0.15 ? "o" : l > 0.62 ? "q" : l > 0.3 ? "p" : "o";
        if (j === h - 1 || i === w - 1) k = "h";
        else if (i === 0) k = "o";
      }
      if (onTop && (i === top - j || j === 0)) k = "p";
      put(c, x, y, k);
    }
  // Wisps sticking out of the ends.
  for (let n = 0; n < 4; n++) {
    const yy = y0 + 2 + Math.floor(grain(n, seed, 3) * (h - 4));
    put(c, x0 - 1, yy, "q");
    if (n % 2) put(c, x0 + w, yy + 1, "p");
  }
}
export const SHOP_PIG_HAY_BALE = (() => {
  const W_ = T;
  const H_ = 32;
  const F = H_ - 4;
  const c = cv(W_, H_);
  bale(c, 2, 11, 33, 17, 5, 60);
  return def("hay-bale", [1, 1], W_, H_, [18, F], [bits(groundShadow(18, F, 17, 2), cropBit(c))]);
})();
export const SHOP_PIG_HAY_STACK = (() => {
  const W_ = 2 * T;
  const H_ = 82;
  const F = H_ - 4;
  const c = cv(W_, H_);
  bale(c, 37, 4, 32, 16, 4, 64); // the top one, set back
  bale(c, 4, 25, 33, 17, 4, 61);
  bale(c, 36, 24, 33, 18, 4, 62);
  bale(c, 2, 45, 34, 17, 4, 63);
  bale(c, 36, 45, 35, 17, 4, 65);
  bale(c, 18, 60, 36, 17, 0, 66); // one pulled out front, low
  return def("hay-stack", [2, 1], W_, H_, [W_ / 2, F], [bits(groundShadow(W_ / 2, F, 35, 3), cropBit(c))]);
})();

// ==== A barrel with a pitchfork in it; his saddle on a rail; the water trough.

export const SHOP_PIG_BARREL = (() => {
  const W_ = T;
  const H_ = 58;
  const F = H_ - 4;
  const body = paint(7, 26, 23, F - 26 + 1, (x, y) => {
    const X = x + 0.5 - 18.5;
    const j = y - 26;
    const bulge = 10.5 + 1.5 * Math.sin((j / (F - 26)) * Math.PI);
    if (Math.abs(X) > bulge) return null;
    if (j < 3) return j === 0 ? "1" : "3"; // its rim's inside
    if (j === 6 || j === 7 || j === F - 26 - 5 || j === F - 26 - 4) return X < -bulge + 3 ? "n" : X > bulge - 3 ? "m" : "M"; // iron hoops
    const st = Math.floor((X + 12) / 4);
    if ((X + 12) % 4 < 0.9) return "2";
    const l = 0.7 - (X / bulge) * 0.55;
    return l > 0.85 ? "6" : l > 0.6 ? "5" : l > 0.35 ? "4" : st % 2 ? "3" : "3";
  });
  // A pitchfork stood in it: its handle up out of the barrel, its tines up.
  const fork = cv(W_, H_);
  for (let y = 6; y < 30; y++) put(fork, 22 - Math.round((y - 6) * 0.1), y, y < 28 ? "5" : "4");
  stamp(fork, 20, 0, ["n.n.n", "n.n.n", "M.M.M", "MMMMM", "..M.."]);
  return def("barrel", [1, 1], W_, H_, [18, F], [bits(groundShadow(18, F, 12, 2), cropBit(fork), body)]);
})();

export const SHOP_PIG_SADDLE = (() => {
  const W_ = 2 * T;
  const H_ = 56;
  const F = H_ - 4;
  const legs = cv(W_, H_);
  for (const [x0, dir] of [[10, -1], [16, 1], [56, -1], [62, 1]] as const)
    for (let y = 26; y <= F; y++) {
      const x = x0 + dir * (y - 26) * 0.18;
      put(legs, x, y, dir < 0 ? "5" : "3");
      put(legs, x + 1, y, "3");
    }
  const rail = paint(4, 22, 66, 5, (x, y) => (y === 22 ? "6" : y === 26 ? "2" : x < 6 ? "5" : "4"));
  // The red blanket under the saddle, the saddle (seat, cantle, horn, skirt), a stirrup hanging.
  const s = cv(W_, H_);
  for (let y = 12; y < 36; y++)
    for (let x = 18; x < 56; x++) {
      if (y >= 20 && y < 36 && x >= 20 && x < 54) put(s, x, y, (x + y) % 6 === 0 ? "u" : y === 35 ? "S" : x > 50 ? "S" : "s"); // the blanket
    }
  for (let x = 20; x < 54; x += 3) put(s, x, 34, "K"); // its fringe
  for (let y = 8; y < 30; y++)
    for (let x = 22; x < 52; x++) {
      const X = x + 0.5 - 37;
      const seat = y >= 14 + Math.round(0.006 * X * X) && y < 26 + (Math.abs(X) < 9 ? 2 : 0) && Math.abs(X) < 15;
      const cantle = X < -8 && X > -14 && y >= 10 && y < 18;
      const horn = X > 9 && X < 13 && y >= 8 && y < 16;
      if (!(seat || cantle || horn)) continue;
      const l = 0.6 - X / 30 - (y - 14) / 20;
      put(s, x, y, horn && y < 10 ? "G" : l > 0.55 ? "J" : l > 0.3 ? "G" : l > 0.05 ? "E" : "e");
    }
  stamp(s, 34, 17, ["..y..", ".yYy.", "yYLYy", ".OYO.", ".O.O."]); // a gold star on the skirt
  for (let y = 26; y < 40; y++) put(s, 40, y, "e"); // the stirrup's strap
  stamp(s, 37, 40, ["MnnnM", "M...M", "MMMMM"]);
  return def("saddle", [2, 1], W_, H_, [W_ / 2, F], [bits(groundShadow(W_ / 2, F, 30, 3), cropBit(legs), rail, cropBit(s))]);
})();

/** The trough: a long plank box of water, the water's top showing a ripple and a glint that drift (4 frames). */
export const SHOP_PIG_TROUGH = (() => {
  const W_ = 2 * T;
  const H_ = 36;
  const F = H_ - 4;
  const frames = [0, 1, 2, 3].map((f) => {
    const box = paint(3, 8, 68, F - 8, (x, y) => {
      const i = x - 3;
      const j = y - 8;
      const top = j < 9 && i >= 2 && i <= 65 && j >= 1;
      if (top) {
        if (j === 1) return "2"; // the far inside edge
        if (i === 2 || i === 65) return "3";
        const r = (x + f * 3 + Math.round(2 * Math.sin((y + f) * 1.3))) % 11;
        if (j > 2 && j < 8 && r === 0) return "c";
        if (j > 2 && j < 8 && (r === 1 || r === 10)) return "x";
        return j < 4 ? "w" : "x";
      }
      if (j === 0) return "6";
      if (j < 9) return i < 2 ? "5" : "3";
      if (j === 9) return "6";
      if (i < 2 || i > 65 || i === 22 || i === 44) return i < 2 ? "5" : "2"; // the end posts, the iron bands
      return (j - 10) % 6 === 5 ? "2" : grain(i, j, 70) > 0.88 ? "3" : "4";
    });
    return bits(groundShadow(W_ / 2, F, 34, 3), box);
  });
  return def("trough", [2, 1], W_, H_, [W_ / 2, F], frames, 260);
})();

// ==== HunChess buckets, standing the right way up, as decoration (hunchess-bucket.ts): muted green, red and yellow, and a
//      little stack (a yellow one, a green one with a white one nested in it). "HunChess" reads normally on each.

const BK_W = T;
const BK_H = 44;
const BK_F = 40;
const oneBucket = (name: string, color: "green" | "red" | "yellow", swing: number) =>
  def(name, [1, 1], BK_W, BK_H, [18, BK_F], [[groundShadow(18, BK_F, 15, 2), ...standingBucket(color, 18, BK_F, swing)]]);
export const SHOP_PIG_BUCKET = oneBucket("bucket", "green", 1.3);
export const SHOP_PIG_BUCKET_B = oneBucket("bucket-b", "red", -1.3);
export const SHOP_PIG_BUCKET_C = oneBucket("bucket-c", "yellow", 1.3);
export const SHOP_PIG_BUCKET_STACK = (() => {
  const W_ = 2 * T;
  const H_ = 52;
  const F = 48;
  return def("bucket-stack", [2, 1], W_, H_, [W_ / 2, F], [
    [groundShadow(W_ / 2, F, 34, 3), ...standingBucket("yellow", 19, F, -1.3), ...standingBucket("w", 54, F - 1, 1.2, 9), ...standingBucket("green", 54, F, 1.3)],
  ]);
})();

// ==== The lanterns: iron lanterns on chains from the rafters, lit, swaying a little (out of step: two pieces).

const LT_TOP = 46; // the lantern's ring, this far down its picture (its chain runs up out of the top)
const LANTERN_N = 8;
const lanternDef = (name: string, phase: number) => {
  const frames = Array.from({ length: LANTERN_N }, (_, f) => {
    const sw = 2.4 * Math.sin((2 * Math.PI * f) / LANTERN_N + phase);
    const c = cv(T, WALL_H);
    for (let y = 0; y < LT_TOP; y++) put(c, 18 + (sw * y) / LT_TOP, y, y % 3 === 0 ? "n" : "M");
    const lx = Math.round(18 + sw);
    const bodyRows = [
      ".....M.M.....",
      ".....MMM.....",
      "....MMnMM....",
      "...MMnnnMM...",
      "..MMMMMMMMM..",
      ".mmmmmmmmmmm.",
      "..mlllllllm..",
      "..mllzlllZm..",
      "..mlzLzlZZm..",
      "..mlzLzlZZm..",
      "..mlzzzlZZm..",
      "..mllzllZZm..",
      "..mZZZZZZZm..",
      ".mmmmmmmmmmm.",
      "..MMMMMMMMM..",
      "...MMmmmMM...",
      ".....MMM.....",
    ];
    const fl = f % 3;
    bodyRows.forEach((r, j) =>
      [...r].forEach((k, i) => {
        if (k === ".") return;
        let kk = k;
        if (fl === 1 && (k === "z" || k === "L")) kk = k === "z" ? "L" : "z";
        if (fl === 2 && k === "z") kk = "l";
        put(c, lx - 6 + i, LT_TOP + 1 + j, kk);
      }),
    );
    put(c, lx, LT_TOP, "n");
    return bits(cropBit(c, false));
  });
  return def(name, [1, 1], T, WALL_H, [18, WALL_H - 1], frames, 170);
};
export const SHOP_PIG_LANTERN = lanternDef("lantern", 0);
export const SHOP_PIG_LANTERN_B = lanternDef("lantern-b", 2.4);

// ==== The board on its stand: a hay bale on its side, the board's slab on it, the chessboard on top. The same geometry as
//      INTRO_PIG_TABLE's middle (its foot, the slab's top 27 over it): the intro lassos it and drags it to the middle.

const BSW = T;
const BSH = 50;
const BSF = 44; // its foot, as the table's (TFOOT)
const SLAB_Y = BSF - 27; // the slab's top, as TABLE_BOARD.top over the foot
/** Draws the stand's bale on `c` with its foot at (fx, BSF): a bale 34 wide, 20 tall to the slab, twine round it. */
export function standBale(c: Cv, fx: number, seed = 67) {
  bale(c, fx - 16, SLAB_Y + 6, 33, BSF - SLAB_Y - 7, 3, seed);
}
export const SHOP_PIG_BOARD_STAND = (() => {
  const c = cv(BSW, BSH);
  standBale(c, 18);
  // The slab (a plank top) and the board on it, its squares seen a little from above (8 x 4 rows of 3 x 2 px).
  const top = paint(4, SLAB_Y - 7, 29, 11, (x, y) => {
    const j = y - (SLAB_Y - 7);
    const i = x - 4;
    if (j >= 8) return j === 8 ? "5" : j === 9 ? "4" : "2"; // the slab's front edge
    if (j === 0 || i === 0 || i === 28) return j === 0 ? "6" : i === 0 ? "5" : "3";
    const bi = Math.floor((i - 2) / 3);
    const bj = Math.floor((j - 1) / 2) + 0;
    if (i < 2 || i > 26 || j < 1) return "4";
    return (bi + bj) % 2 ? "D" : "B";
  });
  return def("board-stand", [1, 1], BSW, BSH, [18, BSF], [bits(groundShadow(18, BSF, 17, 2), cropBit(c), top)]);
})();

// ==== The pens: a 3 x 2 corral of split rails, straw inside, chess knights hopping round in little L-shaped hops.

const PW = 3 * T;
const RISE = 34; // the back fence and the knights' heads over the pen's north edge
const PH = RISE + 2 * T + 4;
const PF = RISE + T + 18; // its foot: the middle of its south row
const PN = RISE + 3; // the back fence's foot (the pen's north edge, a little in)
const PS = RISE + 2 * T - 3; // the front fence's foot
const PX0 = 4;
const PX1 = PW - 5;
/** A knight, nose to the right: `a` its body, `b` its shade, `m` its mane, `e` its eye. 12 x 16. */
const KNIGHT = [
  "....a.a.....",
  "...maaaa....",
  "..mmaaaaa...",
  ".mmaaeaaaa..",
  ".mmaaaaaaaa.",
  "mmaaaaaaaaab",
  "mmaaaaa.bbbb",
  "mmaaaab.....",
  ".mmaaab.....",
  ".mmaaaab....",
  "..maaaaab...",
  "..aaaaaaab..",
  ".bbbbbbbbb..",
  ".aaaaaaaaab.",
  "aaaaaaaaaaab",
  "bbbbbbbbbbbb",
];
/** Squashed on landing: its neck a row shorter. */
const KNIGHT_SQUASH = [...KNIGHT.slice(0, 8), ...KNIGHT.slice(9)];
function knightAt(c: Cv, fx: number, fy: number, color: "w" | "b", right: boolean, squash = false) {
  const g = squash ? KNIGHT_SQUASH : KNIGHT;
  const keys = color === "w" ? { a: "V", b: "v", m: "v", e: "k" } : { a: "X", b: "1", m: "U", e: "y" };
  g.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (ch === ".") return;
      put(c, right ? fx - 6 + i : fx + 5 - i, fy - g.length + j, keys[ch as "a" | "b" | "m" | "e"]);
    }),
  );
}
/** One knight's tour in the pen: four L moves round a diamond, each a long hop (2) and a short one (1) at a right angle. */
type Tour = { o: Pt; ux: number; uy: number; moves: readonly Pt[] };
const TOURS: readonly Tour[] = [
  { o: [30, PN + 13], ux: 11, uy: 9, moves: [[2, 1], [-2, 1], [-2, -1], [2, -1]] },
  { o: [68, PN + 22], ux: 10, uy: 9, moves: [[1, 2], [1, -2], [-1, -2], [-1, 2]] },
];
/** 8 frames a move: a long hop (3 frames in the air), a short hop (2), a landing squash, a rest (one knight skips in it). */
const HOP_LONG = [0.35, 0.8, 0.98];
const HOP_SHORT = [0.5, 1];
const KN_FRAMES = 32;
function knightPose(tour: Tour, f: number, skip: boolean): { x: number; y: number; z: number; right: boolean; squash: boolean } {
  const m = Math.floor(f / 8) % 4;
  const s = f % 8;
  let px = 0;
  let py = 0;
  for (let i = 0; i < m; i++) {
    px += tour.moves[i]![0];
    py += tour.moves[i]![1];
  }
  const [mx, my] = tour.moves[m]!;
  // The long leg is along the move's 2, the short along its 1.
  const longX = Math.abs(mx) === 2;
  const lx = longX ? mx : 0;
  const ly = longX ? 0 : my;
  const sx = longX ? 0 : mx;
  const sy = longX ? my : 0;
  let x = px;
  let y = py;
  let z = 0;
  let squash = false;
  if (s < 3) {
    const t = HOP_LONG[s]!;
    x += lx * t;
    y += ly * t;
    z = Math.sin(Math.PI * Math.min(1, t * 1.02)) * 7;
  } else if (s < 5) {
    x += lx;
    y += ly;
    const t = HOP_SHORT[s - 3]!;
    x += sx * t;
    y += sy * t;
    z = s === 3 ? 4 : 0;
    squash = s === 4;
  } else {
    x += mx;
    y += my;
    if (skip && (s === 6)) z = 3; // a skip in place
    squash = skip && s === 7;
  }
  const dir = mx !== 0 ? mx > 0 : true;
  return { x: tour.o[0] + x * tour.ux, y: tour.o[1] + y * tour.uy, z, right: dir, squash };
}
function penDef(name: string, color: "w" | "b", phase: number) {
  const frames = Array.from({ length: KN_FRAMES }, (_, f) => {
    const floor = cv(PW, PH);
    // The pen's floor: straw over boards inside the fence.
    for (let y = PN; y <= PS; y++)
      for (let x = PX0; x <= PX1; x++) put(floor, x, y, straw(x + 300, y, 0.7, 97) ?? (grain(x, y, 98) > 0.5 ? "p" : "o"));
    const back = cv(PW, PH);
    const rail = (c: Cv, x0: number, x1: number, y: number) => {
      for (let x = x0; x <= x1; x++) {
        put(c, x, y, "6");
        put(c, x, y + 1, grain(x, y, 99) > 0.85 ? "3" : "4");
        put(c, x, y + 2, "2");
      }
    };
    const postAt = (c: Cv, x: number, foot: number, h = 22) => {
      for (let y = foot - h; y <= foot; y++) {
        put(c, x - 1, y, y === foot - h ? "6" : "5");
        put(c, x, y, y === foot - h ? "5" : "4");
        put(c, x + 1, y, "2");
      }
    };
    // Back fence, then the side fences (rails run north to south: seen edge-on, a lit strip on the post's height).
    for (const y of [PN - 18, PN - 9]) rail(back, PX0, PX1, y);
    for (const x of [PX0, Math.round(PW / 2), PX1]) postAt(back, x, PN);
    for (const x of [PX0, PX1])
      for (const h of [18, 9])
        for (let y = PN - h; y <= PS - h; y++) {
          put(back, x, y, "5");
          put(back, x + (x === PX0 ? 1 : -1), y, "3");
        }
    for (const x of [PX0, PX1]) postAt(back, x, Math.round((PN + PS) / 2));
    // The knights, far to near.
    const kn = cv(PW, PH);
    const shadows: Bit[] = [];
    const poses = TOURS.map((tour, i) => knightPose(tour, (f + phase + i * 12) % KN_FRAMES, i === 1));
    poses
      .map((p, i) => ({ p, i }))
      .sort((a, b) => a.p.y - b.p.y)
      .forEach(({ p }) => {
        shadows.push(groundShadow(p.x, p.y, 5 - p.z * 0.2, 1.6));
        knightAt(kn, Math.round(p.x), Math.round(p.y - p.z), color, p.right, p.squash);
      });
    // The front fence.
    const front = cv(PW, PH);
    for (const y of [PS - 18, PS - 9]) rail(front, PX0, PX1, y);
    for (const x of [PX0, Math.round(PW / 2), PX1]) postAt(front, x, PS);
    return bits(groundShadow(PW / 2, PS + 1, 54, 3), whole(floor, false), cropBit(back), ...shadows, cropBit(kn), cropBit(front));
  });
  return def(name, [3, 2], PW, PH, [Math.floor(PW / 2), PF], frames, 110);
}
/** The pen of white knights (`pen`) and of black knights (`pen-b`): deep (3 x 2) but upright, as Dash's halfpipe. */
export const SHOP_PIG_PEN = penDef("pen", "w", 0);
export const SHOP_PIG_PEN_B = penDef("pen-b", "b", 17);

// ==== The lights, each on its piece (`piece`; x, y in its own pixels).

const DAY = "#ffe2a8";
/** The lanterns' glass (a flicker and a halo), the windows' and the doorway's evening light. */
export const SHOP_PIG_LIGHTS: readonly (LightSpot & { piece: string })[] = [
  ...["lantern", "lantern-b"].map((piece) => ({ piece, x: 9, y: LT_TOP + 7, w: 19, h: 8, keys: "lzLZ", color: LANTERN_LIGHT, strength: 1, flicker: true, halo: 34 })),
  { piece: "wall-win", x: WIN.x0, y: WIN.y0, w: WIN.x1 - WIN.x0 + 1, h: WIN.y1 - WIN.y0 + 1, keys: "789L?0!", color: DAY, strength: 0.6, halo: 20 },
  { piece: "entrance", x: EO0, y: E_TOP, w: EO1 - EO0 + 1, h: EFOOT - E_TOP - 3, keys: "789?0!35p", color: DAY, strength: 0.55 },
  { piece: "crate", x: 4, y: 12, w: 12, h: 13, keys: "yL", color: WARM, strength: 0.35 },
];
/** ... and pools on the floor: under each lantern, before the windows and the doorway. */
export const SHOP_PIG_POOLS: readonly (LightPool & { piece: string })[] = [
  ...["lantern", "lantern-b"].map((piece) => ({ piece, x: 18, y: WALL_H + 2, rx: 46, ry: 15, color: LANTERN_LIGHT, strength: 0.3 })),
  { piece: "wall-win", x: 18, y: WALL_H + 10, rx: 22, ry: 8, color: DAY, strength: 0.18 },
  { piece: "entrance", x: EW / 2, y: EFOOT - 8, rx: 40, ry: 12, color: DAY, strength: 0.25 },
];

// ==== The layout.

export interface ShopPlace {
  name: string;
  col: number;
  row: number;
  solid: boolean;
  /** Quarter turns clockwise (floor tiles only), and mirrored left to right (the east wall). */
  rot?: 0 | 1 | 2 | 3;
  flip?: boolean;
  /** Squares wide, for the wide pieces, from `col` east. */
  w?: number;
  /** Squares deep, for the deep pieces, from `row` north: it stands on `row`, and covers the rows north of it too. */
  d?: number;
  /** The way out (the entrance): walking into it leaves the shop. */
  exit?: boolean;
}
const LAYOUT: ShopPlace[] = [];
const at = (name: string, col: number, row: number, solid: boolean, more: Partial<ShopPlace> = {}) => {
  const p = PIECES[name];
  if (p) LAYOUT.push({ name, col, row, solid, ...(p.sq[0] > 1 ? { w: p.sq[0] } : {}), ...(p.sq[1] > 1 ? { d: p.sq[1] } : {}), ...more });
};

// -- The floor (every square): the straw path from the door (rows 15-18) and before the counter (rows 4-6), the circle, boards.
const DRIFT = new Set(["3,6", "16,11", "5,16", "14,17", "2,9", "17,4"]);
const KNOT = new Set(["4,13", "15,6", "17,16", "12,5", "6,3", "1,12"]);
for (let row = 0; row < 20; row++)
  for (let col = 0; col < 20; col++) {
    const k = `${col},${row}`;
    const even = (col + row) % 2 === 0;
    if (CIRCLE.has(k)) at(`circle-${col}-${row}`, col, row, false);
    else if ((col === 9 || col === 10) && ((row >= 15 && row <= 18) || (row >= 4 && row <= 5))) at(col === 9 ? "floor-lane-w" : "floor-lane-e", col, row, false);
    else if (DRIFT.has(k) && even) at("floor-c", col, row, false);
    else if (KNOT.has(k) && !even) at("floor-d", col, row, false);
    else at(even ? "floor-a" : "floor-b", col, row, false);
  }
const FLOOR_COUNT = LAYOUT.length;

// -- The walls: the back (north) wall on row 0, the sides on columns 0 and 19, the low front on row 19.
const BACK: Record<number, string> = { 0: "wall-post", 1: "wall-b", 2: "wall", 3: "wall-c", 4: "wall-win", 5: "wall-post", 6: "wall-b", 7: "wall-win" };
for (let col = 0; col < 20; col++) {
  if (col >= 8 && col <= 11) {
    if (col === 8) at("backdrop", 8, 0, true);
    continue;
  }
  const west = col < 10 ? col : 19 - col;
  const name = BACK[west] ?? "wall";
  at(name, col, 0, true, col >= 10 && name !== "wall-win" ? { flip: true } : {});
}
for (let row = 1; row < 19; row++) {
  const side = row === 10 ? "wall-side-post" : row % 4 === 2 ? "wall-side-b" : "wall-side";
  at(side, 0, row, true);
  at(side, 19, row, true, { flip: true });
}
at("hem-post", 0, 19, true);
for (let col = 1; col < 19; col++) if (col < 9 || col > 10) at("hem", col, 19, true);
at("entrance", 9, 19, false, { exit: true });
at("hem-post", 19, 19, true, { flip: true });

// -- The barn and its things.
at("counter", 8, 3, true);
at("crate", 8, 3, false); // on the counter (see SHOP_PIG_CRATE_AT): its place is the counter's
at("board-stand", 4, 3, true); // the board on its hay bale, set back in the north-west corner (the intro lassos it)
at("hay-stack", 1, 1, true);
at("saddle", 5, 1, true);
at("barrel", 7, 1, true);
at("barrel", 12, 1, true);
at("pen", 13, 4, true); // columns 13-15, rows 3-4: the white knights
at("hay-stack", 17, 2, true);
at("hay-bale", 18, 4, true);
at("trough", 16, 7, true);
at("pen-b", 1, 9, true); // columns 1-3, rows 8-9: the black knights
at("hay-bale", 1, 6, true);
at("saddle", 16, 11, true);
at("hay-bale", 18, 13, true);
at("hay-bale", 1, 13, true);
at("trough", 2, 15, true);
at("hay-stack", 1, 17, true);
at("hay-bale", 3, 17, true);
at("barrel", 6, 17, true);
at("barrel", 13, 17, true);
at("hay-bale", 15, 17, true);
at("hay-stack", 17, 17, true);
at("bucket-stack", 11, 6, true); // HunChess buckets, standing the right way up
at("bucket-c", 6, 5, true);
at("bucket", 18, 7, true); // by the trough
at("bucket-b", 4, 9, true); // by the black knights' pen
at("lantern", 5, 6, false);
at("lantern-b", 14, 7, false);
at("lantern-b", 5, 15, false);
at("lantern", 14, 15, false);

/** Where every piece goes: name, column (its west-most square), row (its south-most), solid; floor tiles first, then the upright pieces north to south. */
export const SHOP_PIG_LAYOUT: readonly ShopPlace[] = [...LAYOUT.slice(0, FLOOR_COUNT), ...LAYOUT.slice(FLOOR_COUNT).sort((a, b) => a.row - b.row || a.col - b.col)];
/** The board on its stand: its square (the intro's lasso target; INTRO_PIG_TABLE's foot starts here). */
export const SHOP_PIG_BOARD_AT = { col: 4, row: 3 } as const;

// ==== The room still: the floor flat on its squares, each upright piece stood at its foot, north first.

const TOP = 150; // room above row 0 for the back wall's pictures
const RW = 20 * T;
const RH = TOP + 20 * T + 4;
const roomParts: Record<string, Part> = {};
const partName = new Map<Part, string>();
const nameOf = (p: Part) => {
  let n = partName.get(p);
  if (!n) {
    n = `r${partName.size}`;
    partName.set(p, n);
    roomParts[n] = p;
  }
  return n;
};
function placed(p: Piece, f: number, fx: number, fy: number, flip = false, rot?: 0 | 1 | 2 | 3): Layer[] {
  const footX = flip ? p.w - 1 - p.foot[0] : p.foot[0];
  return p.frames[f % p.frames.length]!.map((b) => {
    const pw = Math.max(...b.part.grid.map((r) => r.length));
    const x = flip ? p.w - b.at[0] - pw : b.at[0];
    return { part: nameOf(b.part), x: fx - footX + x, y: fy - p.foot[1] + b.at[1], ...(flip ? { flipX: true } : {}), ...(rot ? { rot } : {}) };
  });
}
const footOf = (pl: ShopPlace): Pt => {
  const p = PIECES[pl.name]!;
  if (pl.name === "crate") {
    const cp = PIECES["counter"]!;
    const [cx, cy] = footOf({ name: "counter", col: pl.col, row: pl.row, solid: true });
    return [cx - cp.foot[0] + SHOP_PIG_CRATE_AT[0], cy - cp.foot[1] + SHOP_PIG_CRATE_AT[1]];
  }
  return [pl.col * T + Math.floor((p.sq[0] * T) / 2), TOP + pl.row * T + 18];
};
const roomFrame = (f: number): Frame => {
  const layers: Layer[] = [];
  for (const pl of SHOP_PIG_LAYOUT) {
    const p = PIECES[pl.name]!;
    const [fx, fy] = footOf(pl);
    layers.push(...placed(p, f, fx, fy, pl.flip, pl.rot));
  }
  return { ms: 110, layers };
};
const anims: Record<string, Anim> = { idle: { loop: true, frames: [roomFrame(0)] } };
/** (For review: the room with every piece's idle running.) */
anims["room-live"] = { loop: true, frames: Array.from({ length: 16 }, (_, f) => roomFrame(f * 2)) };
/** Each piece alone, for review, blown up (up to 4x); a floor tile three by three, a wall three side by side. */
for (const p of Object.values(PIECES)) {
  if (p.name.startsWith("circle-")) continue;
  const ch = toChar(p);
  const flatTile = p.w === T && p.h === T;
  const [rx, ry] = flatTile ? [3, 3] : p.name.startsWith("wall") || p.name === "hem" ? [3, 1] : [1, 1];
  const z = Math.max(1, Math.min(4, Math.floor((RW - 8) / (p.w * rx)), Math.floor((RH - 8) / (p.h * ry))));
  const frames = ch.anims.idle!.frames.map((fr, f) => {
    const keys = frameKeys(ch, fr);
    const grid = Array.from({ length: p.h * ry * z }, (_, y) =>
      Array.from({ length: p.w * rx * z }, (_, x) => keys[Math.floor(y / z) % p.h]![Math.floor(x / z) % p.w] ?? ".").join(""),
    );
    const n = `zoom-${p.name}-${f}`;
    roomParts[n] = { grid, outline: false };
    return { ms: p.ms, layers: [{ part: n, x: 4, y: 4 }] };
  });
  anims[p.name] = { loop: true, frames };
}
{
  // (For review: the circle as laid out (columns 5-14, rows 6-15) at 2x.)
  const floorAt2 = new Map(SHOP_PIG_LAYOUT.slice(0, FLOOR_COUNT).map((p) => [`${p.col},${p.row}`, p]));
  const keyAt = (gx: number, gy: number) => PIECES[floorAt2.get(`${Math.floor(gx / T)},${Math.floor(gy / T)}`)!.name]!.frames[0]![0]!.part.grid[gy % T]![gx % T]!;
  const ringGrid = Array.from({ length: 10 * T * 2 }, (_, y) => Array.from({ length: 10 * T * 2 }, (_, x) => keyAt(5 * T + (x >> 1), 6 * T + (y >> 1))).join(""));
  roomParts["review-circle"] = { grid: ringGrid, outline: false };
  anims["review-circle"] = { loop: true, frames: [{ ms: 1000, layers: [{ part: "review-circle", x: 0, y: 4 }] }] };
}
/** (For review: some pieces side by side, blown up 3x, in one frame.) */
const reviewRow = (name: string, props: string[], z = 3) => {
  let x = 4;
  let y = 4;
  let rowH = 0;
  const layers: Layer[] = [];
  for (const n of props) {
    const q = PIECES[n];
    if (!q) continue;
    if (x + q.w * z > RW) {
      x = 4;
      y += rowH + 6;
      rowH = 0;
    }
    const qc = toChar(q);
    const k = frameKeys(qc, qc.anims.idle!.frames[0]!);
    const g = Array.from({ length: q.h * z }, (_, yy) => Array.from({ length: q.w * z }, (_, xx) => k[Math.floor(yy / z)]![Math.floor(xx / z)] ?? ".").join(""));
    roomParts[`${name}-${n}`] = { grid: g, outline: false };
    layers.push({ part: `${name}-${n}`, x, y });
    x += q.w * z + 6;
    rowH = Math.max(rowH, q.h * z);
  }
  anims[name] = { loop: true, frames: [{ ms: 1000, layers }] };
};
reviewRow("review-walls", ["wall", "wall-b", "wall-c", "wall-win", "wall-post", "wall-side", "wall-side-b", "hem", "entrance"]);
reviewRow("review-props", ["board-stand", "hay-bale", "hay-stack", "barrel", "saddle", "trough", "lantern", "counter", "crate", "bucket", "bucket-b", "bucket-c", "bucket-stack"]);
reviewRow("review-pens", ["pen", "pen-b"]);

/** Every piece by its name (as SHOP_PIG_LAYOUT names them), each its own Character `shop-pig-<name>`. */
export const SHOP_PIG_PIECES: Readonly<Record<string, Character>> = Object.fromEntries(Object.values(PIECES).map((p) => [p.name, toChar(p)]));

export const HOUSE_SHOP_PIG: Character = { id: "house-shop-pig", name: "Wrangler's barn", w: RW, h: RH, foot: [RW / 2, RH - 4], palette: PALETTE, parts: roomParts, anims };

/** The barn's palette (the intro's props use the same colors). */
export const SHOP_PIG_PALETTE: Readonly<Record<string, string>> = PALETTE;
export type { LightPool, LightSpot };
