/**
 * Inside Puddles' Botanical Garden: Puddles' shop (house-shop-puddles). A room of 20 x 20 squares seen as the town square
 * is seen (the camera looks north, things stand upright at their foot, 37 px a square), the inside of the wood-and-glass
 * greenhouse of town/houses/gardener.ts, in its colors (his greens, pinks, water blues, wood, stone, glass and terra cotta).
 * Each piece is its own `Character` (`shop-puddles-<name>`); `HOUSE_SHOP_PUDDLES` is the whole room laid out as one still,
 * with one extra animation per piece; `SHOP_PUDDLES_LAYOUT` says where each piece goes. Built as Babur's shop is
 * (scripts/boss-art/out/house-shop-babur).
 *
 * Footing: a piece's foot is the middle of its square (a wide piece's: the middle of its width, on the middle of its row;
 * a deep piece, the pond garden, stands on its south row). Floor tiles are flat, top-down, 37 x 37, foot at their middle;
 * the circle's edge tiles are turned by `rot` (quarter turns clockwise) and the east wall is the west one mirrored (`flip`).
 */
import { frameKeys, type Anim, type Character, type Frame, type Layer, type Part } from "../../../../packages/app/src/characters/sprite.ts";
import { crate, flower, grain, groundShadow, paint, signBoard, signFace, type Pt } from "../../../../packages/app/src/town/houses/kit.ts";

const PALETTE: Record<string, string> = {
  k: "#1d1019", // outline (Puddles')
  E: "#17483f", // his greens (the hose's): dark to light
  F: "#22705a",
  G: "#33a479",
  H: "#7fe0ae",
  f: "#b5545f", // his pinks: dark to light
  g: "#d6747b",
  h: "#f0a191",
  i: "#f8c4b0",
  w: "#ffffff",
  J: "#7a4f0e", // brass: dark to light
  K: "#b87a14",
  L: "#f2c14e",
  M: "#ffe58a",
  "1": "#2a6fc2", // water: deep to pale
  "2": "#4fa3ee",
  "3": "#8bcdfb",
  "4": "#d4f0ff",
  N: "#5a3418", // wood: dark to light (the greenhouse's)
  O: "#80512a",
  P: "#a8743e",
  Q: "#cfa066",
  q: "#cfe8e8", // glass: light, mid, its glare (the greenhouse's)
  r: "#9cc8cc",
  t: "#f4fbfb",
  s: "#8e8a86", // stone: dark, mid, light
  S: "#b5b0a8",
  T: "#d8d2c8",
  c: "#b5562f", // terra cotta pots: mid, dark, light
  C: "#7e3518",
  e: "#d98258",
  "5": "#4a2f1a", // earth: dark, mid, light
  "6": "#8a5a2c",
  "7": "#d8a85a",
  A: "#c9a56a", // the sign's face: shadow, board, light
  B: "#e8cc95",
  D: "#f7e4b8",
  "-": "#0d0e1280", // ground shadow: core, rim
  "+": "#0d0e1244",
  // ---- The room's own.
  W: "#f6f2ea", // the white-painted wood: lit, mid, shade
  V: "#d9d3c7",
  U: "#a49c8e",
  u: "#b6dac8", // the glass tinted green low down, and the garden outside seen through it
  v: "#8fc29f",
  a: "#c98c62", // the terra cotta floor a: base, worn patch, light fleck
  l: "#bf8159",
  m: "#d49a70",
  b: "#bb7c55", // floor b
  n: "#b0724d",
  o: "#c78962",
  d: "#9c6646", // the grout
  y: "#e9b98c", // daylight on the floor: soft, bright
  z: "#f8dcb8",
  x: "#dcd3c2", // the circle's flagstones: a, b, worn, joint, fleck
  X: "#d3c9b6",
  Y: "#c8bda9",
  Z: "#a99c86",
  R: "#ece6d9",
  I: "#cfe6b8", // the emblem's pale leaf green
  "8": "#bfe3f7", // outside the doors: sky, haze, paving
  "9": "#fff8e2",
  "0": "#ded6c6",
  "@": "#cbc2b1",
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
  return { id: `shop-puddles-${p.name}`, name: `Puddles' shop: ${p.name}`, w: p.w, h: p.h, foot: p.foot, palette: PALETTE, parts, anims: { idle: { loop: true, frames } } };
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
  if (y >= 0 && y < c.length && x >= 0 && x < c[0]!.length) c[y]![x] = k;
};
const asPart = (c: Cv, outline = false): Part => ({ grid: c.map((r) => r.join("")), outline });
const stamp = (c: Cv, x: number, y: number, rows: readonly string[]) => rows.forEach((r, j) => [...r].forEach((k, i) => k !== "." && put(c, x + i, y + j, k)));
const whole = (c: Cv, outline = false): Bit => ({ part: asPart(c, outline), at: [0, 0] });

/** Smooth value noise (soft blobs, not specks), cell `s` px. */
function vnoise(x: number, y: number, s: number, seed: number): number {
  const gx = x / s;
  const gy = y / s;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const sm = (t: number) => t * t * (3 - 2 * t);
  const u = sm(gx - x0);
  const v = sm(gy - y0);
  const a = grain(x0, y0, seed);
  const b = grain(x0 + 1, y0, seed);
  const c = grain(x0, y0 + 1, seed);
  const d = grain(x0 + 1, y0 + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// ==== The floor: flat squares, top-down, no outline, tiling seamlessly.

/**
 * Worn terra cotta: one big tile a square, a 1 px grout on all four edges (so a 2 px joint between two, and a tile reads
 * the same however it's turned), a few soft worn patches and a fleck or two. `ramp`: base, worn, fleck.
 */
const terra = (x: number, y: number, ramp: string, seed: number): string => {
  if (x === 0 || y === 0 || x === T - 1 || y === T - 1) return "d";
  const g = grain(x >> 1, y, seed + 50);
  return g < 0.016 ? ramp[1]! : g > 0.99 ? ramp[2]! : ramp[0]!;
};
const TA = "alm";
const TB = "bno";
const flat = (fn: (x: number, y: number) => Key): Bit[][] => [[paint(0, 0, T, T, fn, false)]];
const tileDef = (name: string, fn: (x: number, y: number) => Key) => def(name, [1, 1], T, T, [18, 18], flat(fn));

export const SHOP_PUDDLES_FLOOR_A = tileDef("floor-a", (x, y) => terra(x, y, TA, 11));
export const SHOP_PUDDLES_FLOOR_B = tileDef("floor-b", (x, y) => terra(x, y, TB, 12));

/** Variety on a: moss creeping along the grout, thickest at one corner. */
export const SHOP_PUDDLES_FLOOR_C = tileDef("floor-c", (x, y) => {
  const base = terra(x, y, TA, 11);
  // How near the grout (0 on it), and a soft amount of moss along it, more toward the lower-left corner.
  const e = Math.min(x, y, T - 1 - x, T - 1 - y);
  // A soft clump in the lower-left corner, thinning out along the two cracks from it.
  const r = Math.hypot(x, T - 1 - y);
  const n = vnoise(x, y, 3, 31);
  const clump = r + n * 4 < 9;
  const along = e < 2 && r + n * 10 < 26;
  if (clump || along) {
    if (r + n * 4 > 8 || (along && !clump && e === 1)) return "E";
    return vnoise(x, y, 2, 36) > 0.55 ? "H" : grain(x, y, 37) < 0.5 ? "G" : "F";
  }
  return base;
});

/** Variety on b: a puddle (he's Puddles) with the sky in it, and two fallen leaves. */
export const SHOP_PUDDLES_FLOOR_D = (() => {
  const c = cv(T, T);
  fill(c, (x, y) => {
    const d = Math.hypot((x + 0.5 - 17) / 13, (y + 0.5 - 20) / 8) + (vnoise(x, y, 4, 41) - 0.5) * 0.35;
    if (d < 1) {
      if (d > 0.8) return x + y < 34 ? "2" : "3"; // its rim, darker where it's shaded
      return (x - 2 * (y - 17) === 9 || x - 2 * (y - 17) === 10) && d < 0.7 ? "4" : "3"; // the sky glare across it
    }
    if (d < 1.12) return "n"; // the wet edge
    return terra(x, y, TB, 12);
  });
  stamp(c, 26, 6, ["..GG", ".GHG", "GGF.", "F..."]);
  stamp(c, 5, 27, ["LL..", "KLL.", ".KKL", "...J"]);
  return def("floor-d", [1, 1], T, T, [18, 18], [[whole(c)]]);
})();

/** The daylight through the doors: a warm wash on the tiles, bright at the door (south), fading in as it goes north. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const SHOP_PUDDLES_FLOOR_DOOR = tileDef("floor-door", (x, y) => {
  const base = terra(x, y, TB, 12);
  if (base === "d") return y > 26 ? "o" : base;
  const th = (BAYER[(y % 4) * 4 + (x % 4)]! + 0.5) / 16;
  const v = ((y + 0.5) / T) * 2.1;
  if (v > 1 + th) return "z";
  if (v > th * 0.9 + 0.1) return "y";
  return base;
});

// ==== The battle circle: a garden arena of flagstones in a low clipped hedge with flowers set in it.

/** A flagstone: one a square, a 1 px joint on every edge, a soft worn patch or two. `tone`: x or X. */
const flag = (x: number, y: number, tone: string, seed = 21): string => {
  if (x === 0 || y === 0 || x === T - 1 || y === T - 1) return "Z";
  if (x === 1 || y === 1) return "R"; // a soft bevel: lit top and left, worn at the foot and right
  if ((x === T - 2 || y === T - 2) && (x + y) % 2 === 0) return "Y";
  const g = grain(x >> 1, y, seed + 9);
  return g < 0.012 ? "Y" : g > 0.994 ? "R" : tone;
};
export const SHOP_PUDDLES_CIRCLE_A = tileDef("circle-a", (x, y) => flag(x, y, "x", 21));
export const SHOP_PUDDLES_CIRCLE_B = tileDef("circle-b", (x, y) => flag(x, y, "X", 22));

/**
 * The circle's border by depth `j` into the band (0 its outer edge) and `al` along it: a clipped hedge seen from above (a
 * dark edge, its top lit in soft clumps, pink and white flowers set in it), then a stone edging lip and its shadow.
 */
const hedge = (j: number, al: number): string | null => {
  if (j < 0) return null;
  if (j === 0) return "E";
  if (j < 12) {
    // Flowers every 12 px along, pink and white by turns, a heart of gold; the hedge's top in soft lit clumps.
    const fa = ((al % 24) + 24) % 24;
    const fi = fa < 12 ? fa : fa - 12;
    const pink = fa < 12;
    const fx = fi - 6;
    const fy = j - 5;
    const m = Math.abs(fx) + Math.abs(fy);
    if (m <= 1) return m === 0 ? "L" : pink ? "h" : "w";
    if (m === 2 && Math.abs(fx) < 2 && Math.abs(fy) < 2) return pink ? "g" : "i";
    if (m === 2) return pink ? "f" : "V";
    if (j === 1) return "G";
    if (j > 9) return j === 11 ? "E" : "F";
    const n = vnoise(al, j, 3, 61);
    return n < 0.3 ? "H" : n < 0.62 ? "G" : "F";
  }
  if (j === 12) return "T"; // the stone edging: lit, mid, shade
  if (j === 13) return "S";
  if (j === 14) return "S";
  if (j === 15) return "s";
  if (j === 16) return "Z"; // its shadow on the stones
  return null;
};
/** Straight: the band along the tile's north side (the game turns it). */
export const SHOP_PUDDLES_CIRCLE_EDGE = tileDef("circle-edge", (x, y) => hedge(y, x) ?? flag(x, y, "x"));
/** The octagon's 45-degree sides: the band from the tile's lower left to its upper right, tiles beyond it (the NW cut). */
const diag = (ramp: string, seed: number) => (x: number, y: number) => {
  const s = x + y;
  if (s < 36) return terra(x, y, ramp, seed);
  return hedge(s - 36, x - y + 37) ?? flag(x, y, "x");
};
export const SHOP_PUDDLES_CIRCLE_EDGE_DIAG = tileDef("circle-edge-diag", diag(TA, 11));
export const SHOP_PUDDLES_CIRCLE_EDGE_DIAG_B = tileDef("circle-edge-diag-b", diag(TB, 12));
/** The circle's square inside each corner, where the diagonal band's end clips its corner. */
export const SHOP_PUDDLES_CIRCLE_EDGE_CORNER = tileDef("circle-edge-corner", (x, y) => hedge(x + y + 1, x - y + 74) ?? flag(x, y, "x"));

/** The middle line: a 3 px green stripe along the tile's south edge (turned twice for the square south of it). */
const midLine = (tone: string) => (x: number, y: number) => (y >= T - 3 ? (y === T - 3 ? "G" : "F") : flag(x, y, tone));
export const SHOP_PUDDLES_CIRCLE_LINE = tileDef("circle-line", midLine("x"));
export const SHOP_PUDDLES_CIRCLE_LINE_B = tileDef("circle-line-b", midLine("X"));

/** A start mark: a green-edged pad (two squares wide) with a leaf on it, one inside each of the north and south edges. */
const mark = (x: number, y: number): string | null => {
  const X = Math.abs(x + 0.5 - 37);
  const Y = Math.abs(y + 0.5 - 18.5);
  const d = Math.hypot(Math.max(0, X - 17), Y) - 11; // a pill 56 wide, 22 tall
  if (d > 0) return null;
  if (d > -1) return "E";
  if (d > -3.2) return "F";
  if (d > -4) return "G";
  // A leaf across its middle.
  const lx = (x + 0.5 - 37) / 9;
  const ly = (y + 0.5 - 18.5 + lx * 2) / 3.6;
  const L = lx * lx + ly * ly;
  if (L < 1) return Math.abs(ly) < 0.22 && Math.abs(lx) < 0.8 ? "F" : ly < 0 ? "H" : "G";
  if (L < 1.35) return "E";
  return "I";
};
export const SHOP_PUDDLES_CIRCLE_MARK_L = tileDef("circle-mark-l", (x, y) => mark(x, y) ?? flag(x, y, "X"));
export const SHOP_PUDDLES_CIRCLE_MARK_R = tileDef("circle-mark-r", (x, y) => mark(x + T, y) ?? flag(x, y, "x"));

/**
 * The emblem, two by two squares in the circle's middle: a green medallion ringed in deep green, a sprout in it (two leaves
 * on a stem from a mound of earth), the middle line running into it either side.
 */
const emblem = (x: number, y: number): string | null => {
  const X = x + 0.5 - 37;
  const Y = y + 0.5 - 37;
  const d = Math.hypot(X, Y);
  if (d > 35) return Math.abs(Y) < 3 ? (Y < -2 ? "G" : "F") : null;
  if (d > 34) return "E";
  if (d > 29.5) return d > 33 || X + Y > 24 ? "F" : d < 31 && X + Y < -10 ? "H" : "G";
  if (d > 28.5) return "E";
  // The sprout: a stem, a little mound, two leaves.
  const leaf = (cx: number, cy: number, ang: number, a: number, b: number) => {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const u = ((X - cx) * c + (Y - cy) * s) / a;
    const v = (-(X - cx) * s + (Y - cy) * c) / b;
    return { r: u * u + v * v, u, v };
  };
  const L1 = leaf(-10, -7, -2.6, 12, 6);
  const L2 = leaf(11, -11, -0.65, 14, 7);
  for (const L of [L2, L1]) {
    if (L.r < 1) return Math.abs(L.v) < 0.16 && Math.abs(L.u) < 0.85 ? "F" : L.v < 0 ? "H" : "G";
    if (L.r < 1.3) return "E";
  }
  if (Math.abs(X) < 1.6 && Y > -6 && Y < 12) return X < 0 ? "G" : "F";
  if (Math.abs(X - 0) < 2.6 && Y > -6 && Y < 12) return "E";
  const m = Math.hypot(X / 13, (Y - 15) / 5);
  if (Y < 19 && m < 1) return m > 0.8 ? "5" : Y < 12 ? "7" : "6";
  return d > 25 ? "I" : "I";
};
const emTile = (ox: number, oy: number, tone: string) => (x: number, y: number) => emblem(x + ox, y + oy) ?? flag(x, y, tone);
export const SHOP_PUDDLES_EMBLEM_NW = tileDef("emblem-nw", emTile(0, 0, "X"));
export const SHOP_PUDDLES_EMBLEM_NE = tileDef("emblem-ne", emTile(T, 0, "x"));
export const SHOP_PUDDLES_EMBLEM_SW = tileDef("emblem-sw", emTile(0, T, "x"));
export const SHOP_PUDDLES_EMBLEM_SE = tileDef("emblem-se", emTile(T, T, "X"));

// ==== The walls: greenhouse glass in white-painted wood.

const WALL_H = 130;
const TRANS = [46, 84]; // the transoms' tops
const KNEE = 108; // the knee wall's top (the sill)

/** The glass: a sky glow up high, clear in the middle, tinted green low down with the garden outside showing through. */
const pane = (x: number, y: number, glareStep = 0.6): string => {
  const gl = (((x + y * glareStep) % 26) + 26) % 26;
  if (y < TRANS[1]! && (gl < 2 || gl === 4)) return "t";
  const th = (BAYER[(y % 4) * 4 + (x % 4)]! + 0.5) / 16;
  if (y < TRANS[0]!) return (y - 6) / 26 < th ? "t" : "q";
  if (y < TRANS[1]!) return (y - TRANS[0]!) / 40 < th ? "q" : "r";
  // Low down: leaves outside against the glass.
  const n = vnoise(x, y, 6, 71) + (y - TRANS[1]!) / 40;
  return n > 0.95 ? "v" : n > 0.7 ? "u" : "r";
};
/** A white-painted bar across, `y` its top, 4 px (lit top, shade at the foot). */
const bar = (j: number) => (j === 0 ? "W" : j === 3 ? "U" : "V");

/** The back wall seen from inside, its top at y0: a beam, panes, two transoms, a mullion on each square's east side, the knee wall. */
function wallCv(c: Cv, y0: number) {
  fill(c, (x, yy) => {
    const y = yy - y0;
    if (y < 0) return null;
    if (y === 0) return "k";
    if (y < 6) return y === 1 ? "W" : y === 5 ? "U" : "V"; // the top beam
    if (y >= KNEE) {
      const j = y - KNEE;
      if (j < 4) return bar(j);
      // Planks across, lit along their tops.
      if (y >= WALL_H - 1) return "N";
      const p = (j - 4) % 6;
      return p === 0 ? "P" : p === 5 ? "N" : "O";
    }
    for (const t of TRANS) if (y >= t && y < t + 4) return bar(y - t);
    if (x >= T - 4) return x === T - 4 ? "W" : x === T - 1 ? "U" : "V"; // the mullion
    if (x === T - 5 || y === 6 || TRANS.includes(y - 4)) return "r"; // the glass's shade by the bars
    return pane(x, y);
  });
}
/** The vine along the top: a wavy stem over the beam, leaves, a few pink flowers and a strand hanging down (tiles across). */
function vine(y0: number, seed: number): Bit {
  const c = cv(T, 30);
  const sy = (x: number) => 3 + Math.round(1.5 * Math.sin((2 * Math.PI * (x + 0.5)) / T));
  for (let x = 0; x < T; x++) put(c, x, sy(x), "F");
  const leafAt = (lx: number, ly: number, up: boolean) => stamp(c, lx, ly, up ? [".HG", "GGF", "FF."] : ["GG.", "GGF", ".FF"]);
  [3, 11, 20, 28].forEach((lx, i) => leafAt(lx, sy(lx) + (i % 2 ? -2 : 1), i % 2 === 1));
  // A strand hanging down at one spot, leaves on it.
  const hx = 7 + Math.floor(grain(seed, 0, 81) * 20);
  const len = 10 + Math.floor(grain(seed, 1, 81) * 10);
  for (let j = 0; j < len; j++) put(c, hx + Math.round(Math.sin(j * 0.5)), sy(hx) + j, "F");
  for (let j = 4; j < len; j += 5) stamp(c, hx + Math.round(Math.sin(j * 0.5)) + (j % 10 ? 1 : -2), sy(hx) + j, ["GG", "FG"]);
  // Flowers: pink, one white.
  stamp(c, 15, sy(15) - 2, [".h.", "hLh", ".g."]);
  stamp(c, 32, sy(32), [".w.", "wLw", ".i."]);
  return { part: asPart(c, true), at: [0, y0] };
}

export const SHOP_PUDDLES_WALL = (() => {
  const c = cv(T, WALL_H);
  wallCv(c, 0);
  return def("wall", [1, 1], T, WALL_H, [18, WALL_H - 1], [[whole(c), vine(1, 3)]]);
})();

/** A cast-iron column, painted his deep green: a capital, a fluted shaft lit on its left, a base, from `top` to `foot`. */
const column = (cx: number, top: number, foot: number) =>
  paint(cx - 4, top, 9, foot - top, (x, y) => {
    const X = x - cx;
    const j = y - top;
    if (j < 3) return j === 0 ? "G" : "F"; // the capital's slab
    if (j < 6) return Math.abs(X) > 3 ? null : j === 3 ? "G" : "E";
    if (y > foot - 6) return Math.abs(X) > 3 + (y > foot - 3 ? 1 : 0) ? null : y === foot - 5 || y === foot - 2 ? "G" : X > 1 ? "E" : "F"; // its base
    if (Math.abs(X) > 2) return null;
    return X === -2 ? "G" : X === -1 ? "H" : X === 2 ? "E" : X === 1 ? "F" : "G";
  });
/** A hanging basket on a bracket out from the column at `y`: a chain, a mossy basket, pink and white flowers, trailing leaves. */
const basket = (cx: number, y: number): Bit => {
  const c = cv(24, 30);
  for (let i = 0; i < 9; i++) put(c, 4 + i, 1, "k"); // the bracket
  put(c, 4, 2, "k");
  put(c, 5, 2, "k");
  for (let j = 2; j < 9; j++) put(c, 12, j, j % 2 ? "U" : "s"); // the chain
  stamp(c, 3, 9, [
    "....hhG.whh..GGh..",
    "..GhLhGGwLwGhLhGG.",
    ".GGGhGFGGwGGGhGFGG",
    ".FGGGGGFGGGHGGGGFF",
    "PPQQQQQQQQQQQQQQPO",
    ".OPPPOPPPOPPPOPPN.",
    "..OOPOOOPOOOPOON..",
    "...NOOOONOOOOON...",
    "....FNNNNNNNNF....",
    "....G........F....",
    "....F........F....",
    "...G..........G...",
    "...F..............",
  ]);
  return { part: asPart(c, true), at: [cx - 12, y] };
};

const PILLAR_UP = 20; // how far the column stands above the wall
export const SHOP_PUDDLES_WALL_PILLAR = (() => {
  const h = WALL_H + PILLAR_UP;
  const c = cv(T, h);
  wallCv(c, PILLAR_UP);
  return def("wall-pillar", [1, 1], T, h, [18, h - 1], [[whole(c), vine(PILLAR_UP + 1, 7), column(18, 1, h), basket(22, PILLAR_UP + 30)]]);
})();

/**
 * The west wall, running away north, seen obliquely: each square's top shows its white top plate, then glass with the
 * glare slanting the other way, a post on its inner (east) edge; a column of them reads as the glass wall going away.
 */
function sideCv(c: Cv, y0: number) {
  fill(c, (x, yy) => {
    const y = yy - y0;
    if (y < 0) return null;
    if (y === 0) return "k";
    if (y < 5) return y === 1 ? "W" : y === 4 ? "U" : "V"; // the top plate
    if (y >= KNEE) {
      const j = y - KNEE;
      if (j < 4) return bar(j);
      if (y >= WALL_H - 1) return "N";
      const p = (j - 4) % 6;
      return p === 0 ? "P" : p === 5 ? "N" : "O";
    }
    if (x >= T - 5) return x === T - 5 ? "W" : x === T - 1 ? "U" : "V"; // the post on its inner edge
    if (y === 5) return "r";
    // Glass: the sky in it up high, slanting glare, the garden low down; a little darker toward the far (outer) side.
    const gl = (((x * 0.8 - y) % 24) + 24) % 24;
    if (y < 90 && (gl < 1.6 || (gl > 3 && gl < 4))) return "t";
    const th = (BAYER[(y % 4) * 4 + (x % 4)]! + 0.5) / 16;
    if (y > 80) return vnoise(x, y, 5, 73) + (y - 80) / 40 > 0.8 ? "v" : "u";
    if (x < 6) return "r";
    return (y - 5) / 30 < th ? "t" : (x - 6) / 26 < th ? "r" : "q";
  });
}
/** A few leaves of the vine along the side wall's top plate. */
const sideVine = (y0: number): Bit => {
  const c = cv(T, 12);
  stamp(c, 6, 0, ["..GG......GH...", "FFGFFFFFFGGFFF.", ".F..GG...F..GG.", ".....F.......F."]);
  stamp(c, 12, 0, [".h.", "hLh", ".g."]);
  return { part: asPart(c, true), at: [0, y0] };
};
export const SHOP_PUDDLES_WALL_SIDE = (() => {
  const c = cv(T, WALL_H);
  sideCv(c, 0);
  return def("wall-side", [1, 1], T, WALL_H, [18, WALL_H - 1], [[whole(c), sideVine(1)]]);
})();
export const SHOP_PUDDLES_WALL_SIDE_PILLAR = (() => {
  const h = WALL_H + PILLAR_UP;
  const c = cv(T, h);
  sideCv(c, PILLAR_UP);
  return def("wall-side-pillar", [1, 1], T, h, [18, h - 1], [[whole(c), sideVine(PILLAR_UP + 1), column(18, 1, h), basket(22, PILLAR_UP + 30)]]);
})();

// ==== The front (south) wall: low, glass over wood, and the way out.

const HEM_H = 22;
function hemCv(c: Cv, y0: number) {
  fill(c, (x, yy) => {
    const y = yy - y0;
    if (y < 0) return null;
    if (y === 0) return "k";
    if (y < 5) return y === 1 ? "W" : y === 4 ? "U" : "V"; // its rail
    if (y < 11) return x >= T - 3 ? (x === T - 3 ? "W" : "U") : (x + y) % 9 < 1 ? "t" : y < 7 ? "r" : "u"; // a band of glass
    if (y < 13) return y === 11 ? "W" : "U";
    if (y >= HEM_H - 1) return "N";
    return (y - 13) % 4 === 0 ? "P" : (y - 13) % 4 === 3 ? "N" : "O";
  });
}
export const SHOP_PUDDLES_HEM = (() => {
  const c = cv(T, HEM_H);
  hemCv(c, 0);
  return def("hem", [1, 1], T, HEM_H, [18, HEM_H - 1], [[whole(c)]]);
})();
export const SHOP_PUDDLES_HEM_PILLAR = (() => {
  const h = WALL_H + PILLAR_UP;
  const c = cv(T, h);
  hemCv(c, h - HEM_H);
  return def("hem-pillar", [1, 1], T, h, [18, h - 1], [[whole(c), column(18, 1, h), basket(22, PILLAR_UP + 30)]]);
})();

/**
 * The entrance, two squares wide: an arched white door frame, the two glass doors standing open into the room, and the
 * bright day outside between them (sky, the town's trees, its paving, a stone step).
 */
const EW = 2 * T;
const EH = 112;
const EFOOT = EH - 1;
const ARCH_Y = 40; // the arch's middle
const ARCH_R = 26;
export const SHOP_PUDDLES_ENTRANCE = (() => {
  const inArch = (x: number, y: number, r: number) => (y >= ARCH_Y ? Math.abs(x + 0.5 - 37) < r : Math.hypot(x + 0.5 - 37, y + 0.5 - ARCH_Y) < r);
  const day = paint(0, 0, EW, EH, (x, y) => {
    if (!inArch(x, y, ARCH_R)) return null;
    if (y > EFOOT - 6) return y === EFOOT - 5 ? "T" : "S"; // the stone step
    if (y > EFOOT - 26) return (Math.floor(x / 8) + Math.floor((y - 3) / 5)) % 2 ? "@" : "0"; // the square's paving
    const tree = 66 - 6 * vnoise(x, 0, 5, 91) - 4 * Math.sin(x * 0.4);
    if (y > tree) return y > EFOOT - 30 ? "F" : vnoise(x, y, 3, 92) > 0.6 ? "H" : "G"; // the town's greenery
    const t = (y - 22) / 30;
    const th = (BAYER[(y % 4) * 4 + (x % 4)]! + 0.5) / 16;
    return t < th ? "8" : "9";
  }, false);
  const frame = paint(0, 0, EW, EH, (x, y) => {
    if (inArch(x, y, ARCH_R) || !inArch(x, y, ARCH_R + 6)) return null;
    const outer = !inArch(x, y, ARCH_R + 5);
    const inner = !inArch(x, y, ARCH_R + 1);
    if (y >= EFOOT - 1) return "U";
    return outer ? "W" : !inner ? "U" : x < 37 && y > ARCH_Y ? "W" : "V";
  });
  // The fanlight's bars in the arch, and the keystone.
  const fan = paint(0, 0, EW, ARCH_Y + 1, (x, y) => {
    if (!inArch(x, y, ARCH_R) || y > ARCH_Y) return null;
    if (y === ARCH_Y) return "V";
    const a = Math.atan2(ARCH_Y - y, x + 0.5 - 37);
    const d = Math.hypot(x + 0.5 - 37, y + 0.5 - ARCH_Y);
    if (d < 7) return d > 5.8 ? "V" : null;
    return [Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4].some((s) => Math.abs(a - s) * d < 0.8) ? "V" : null;
  }, false);
  const key = paint(33, 6, 9, 9, (x, y) => (Math.abs(x + 0.5 - 37.5) > 4.5 - (y - 6) * 0.35 ? null : y === 6 ? "W" : x > 38 ? "U" : "V"));
  /** A door leaf standing open into the room, nearly edge-on: a white frame round glass, its top sloping away. */
  const leaf = (right: boolean) =>
    paint(right ? EW - 16 : 3, 22, 13, EFOOT - 22 + 3, (xx, y) => {
      const x = right ? EW - 1 - xx : xx; // mirrored
      const i = x - 3; // 0 at the hinge (outside), 12 its free edge (in the room)
      const top = 32 - i * 0.8;
      const bot = EFOOT + 1 + i * 0.25;
      if (y < top || y > bot) return null;
      const frame = i < 2 || i > 10 || y < top + 3 || y > bot - 9 || Math.abs(y - (top + bot) / 2) < 1.5;
      if (frame) return y > bot - 9 && !(y > bot - 2) && i > 1 && i < 11 ? (y === Math.round(bot - 9) ? "W" : "V") : i > 10 ? "U" : i < 2 ? "W" : "V";
      return (i + y) % 11 < 2 ? "t" : y < top + 20 ? "q" : "r";
    });
  const handle = (right: boolean) => paint(right ? EW - 6 : 4, 74, 2, 4, () => "L");
  return def("entrance", [2, 1], EW, EH, [EW / 2, EFOOT], [
    [groundShadow(EW / 2, EFOOT - 1, 32, 3), day, frame, fan, key, leaf(false), leaf(true), handle(false), handle(true)],
  ]);
})();

// ==== The backdrop behind the counter: four squares of the glass wall, a rose arbor over shelves of seeds and pots.

const BDW = 4 * T;
const BDH = WALL_H + PILLAR_UP;
/** A small terra cotta pot (w wide, h tall, its top-left at x, y) with a plant `kind` in it: sprout, fern, or a flower. */
function pot(c: Cv, x: number, y: number, w: number, h: number, kind: "sprout" | "fern" | "pink" | "white" | "cactus") {
  // The plant first (the pot covers its foot).
  const cx = x + Math.floor(w / 2);
  if (kind === "sprout") stamp(c, cx - 3, y - 5, ["GH.HG.", ".GHG..", "..F...", "..F..."]);
  if (kind === "fern") stamp(c, cx - 6, y - 9, ["...G...G....", "..GH.G.HG...", ".GGFGHGFGG..", "GF.GFGF.GFG.", "F.GGFHFGG.F.", "..F.FFF.F...", "....FFF....."]);
  if (kind === "pink" || kind === "white") {
    const [p, q] = kind === "pink" ? ["h", "g"] : ["w", "i"];
    stamp(c, cx - 5, y - 8, [`..${p}${p}...${p}..`, `.${p}L${p}..${p}L${p}.`, `..${q}${q}G..${q}..`, `.GG.FG.GG.`, `..GFGFGF..`, `...FFF....`]);
  }
  if (kind === "cactus") stamp(c, cx - 3, y - 9, ["..hh..", "..GH..", "G.GH..", "GGGH.G", "..GHGG", "..GH..", "..GF..", "..GF..", "..GF.."]);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const narrow = j > 1 ? Math.floor((j - 1) / 3) : 0;
      if (j > 1 && (i < narrow || i >= w - narrow)) continue;
      put(c, x + i, y + j, j === 0 ? "e" : j === 1 ? "C" : i <= narrow ? "e" : i >= w - 1 - narrow ? "C" : "c");
    }
}
/** A seed packet: a paper sleeve in a color, a picture of its flower on it. */
const packet = (c: Cv, x: number, y: number, col: string, pic: string) =>
  stamp(c, x, y, ["DDDDD", `D${col}${col}${col}D`, `D${pic}L${pic}D`, `D.${pic}.D`.replace(".", "B").replace(".", "B"), "DBGBD", "ABBBA"].map((r) => r.replace(/\./g, "B")));
/** His watering can (Drizzle carries a little one): deep green, a brass rose on its spout, a handle over the top. */
const WATERING_CAN = [
  "......FFFFF.......",
  ".....F.....F......",
  "....F.......F.....",
  "...GGGGGGGGGF....J",
  "...HGGGGGGGGF...LK",
  "...HGGGGGGGFFF.LK.",
  "...GGGGGGGGFF.FK..",
  "...GGGGGGGGFFF....",
  "...GGGGGGGGFF.....",
  "...FFFFFFFFFE.....",
  "....EEEEEEEE......",
];
export const SHOP_PUDDLES_BACKDROP = (() => {
  const c = cv(BDW, BDH);
  const w1 = cv(T, WALL_H);
  wallCv(w1, 0);
  fill(c, (x, y) => (y < PILLAR_UP ? null : w1[y - PILLAR_UP]![x % T]!));
  // The shelves: two uprights, three boards, a back of planks between them.
  const S0 = 16;
  const S1 = BDW - 17;
  const SHELF = [PILLAR_UP + 52, PILLAR_UP + 80, PILLAR_UP + 108];
  const shelves = paint(S0, PILLAR_UP + 30, S1 - S0 + 1, BDH - PILLAR_UP - 30, (x, y) => {
    if (x < S0 + 4 || x > S1 - 4) return x === S0 || x === S1 - 3 ? "P" : x === S1 || x === S0 + 3 ? "N" : "O"; // the uprights
    for (const s of SHELF) if (y >= s && y < s + 4) return y === s ? "Q" : y === s + 3 ? "N" : "P";
    if (y < SHELF[0]! - 22) return null; // above the top shelf: the glass shows
    return (x - S0) % 12 === 0 ? "N" : y > SHELF[2]! + 3 ? "N" : "O";
  });
  const things = cv(BDW, BDH);
  // The top shelf: pots of flowers and sprouts, the watering can.
  const s0 = SHELF[0]!;
  pot(things, 24, s0 - 9, 9, 9, "pink");
  pot(things, 38, s0 - 7, 7, 7, "sprout");
  pot(things, 50, s0 - 8, 8, 8, "white");
  stamp(things, 64, s0 - 11, WATERING_CAN);
  pot(things, 88, s0 - 7, 7, 7, "cactus");
  pot(things, 100, s0 - 9, 9, 9, "fern");
  pot(things, 114, s0 - 7, 7, 7, "sprout");
  // The middle shelf: seed packets in a row, leaning, a stack of empty pots.
  const s1 = SHELF[1]!;
  [["h", "g"], ["G", "h"], ["L", "w"], ["g", "L"], ["H", "g"], ["h", "w"]].forEach(([col, pic], i) => packet(things, 24 + i * 7, s1 - 6, col!, pic!));
  stamp(things, 70, s1 - 9, ["eccccccC", ".eccccC.", "eccccccC", ".eccccC.", "eccccccC", ".eccccC.", "..ccccC.", "..cccC..", "...cC..."]);
  [["g", "h"], ["L", "g"], ["w", "h"], ["G", "L"]].forEach(([col, pic], i) => packet(things, 86 + i * 7, s1 - 6, col!, pic!));
  pot(things, 116, s1 - 8, 8, 8, "pink");
  // The bottom shelf: a sack of soil, trays of seedlings, a trowel.
  const s2 = SHELF[2]!;
  stamp(things, 24, s2 - 13, ["..BBBBBB...", ".BDDBBBBA..", "BDBBBBBBBA.", "BBBB66BBBA.", "BBB6556BBA.", "BBBB66BBBA.", "BBBBBBBBBA.", "BBBBBBBBBA.", "BBBBBBBBAA.", "ABBBBBBBAA.", ".ABBBBBAA..", "..AAAAAA..."]);
  for (let t = 0; t < 2; t++) stamp(things, 42 + t * 26, s2 - 6, ["G.H.G.H.G.H.G.H.G.H.", "FGFGFGFGFGFGFGFGFGFG", "QQQQQQQQQQQQQQQQQQQQ", "PPPPPPPPPPPPPPPPPPPN", "NNNNNNNNNNNNNNNNNNNN"]);
  stamp(things, 96, s2 - 3, ["sSTTTTO PPP".replace(" ", "N"), "ssSSS.NNNN."]);
  pot(things, 112, s2 - 9, 9, 9, "fern");
  // The rose arbor across the top: a wooden arch of trellis, climbing roses all over it.
  const arbor = paint(0, 0, BDW, PILLAR_UP + 56, (x, y) => {
    const X = (x + 0.5 - BDW / 2) / (BDW / 2);
    const top = 6 + 22 * X * X; // its arch
    const j = y - top;
    if (j < 0 || j > 12) return x < 10 || x > BDW - 11 ? (y > top ? (x < 6 || x > BDW - 7 ? "P" : null) : null) : null;
    const g = vnoise(x, y, 3, 95);
    const r = grain(x, y, 96);
    if (r < 0.08 && j > 1) return "h";
    if (r < 0.11 && j > 1) return "g";
    if (r < 0.13) return "w";
    if (j > 9 && g < 0.4) return (x + y) % 5 === 0 ? "O" : null;
    return g < 0.35 ? "E" : g < 0.65 ? "F" : g < 0.85 ? "G" : "H";
  });
  // Roses trailing down both sides of the shelves.
  const trail = paint(0, PILLAR_UP + 20, BDW, BDH - PILLAR_UP - 40, (x, y) => {
    const side = x < BDW / 2 ? x - 8 : BDW - 9 - x;
    const w = 5 + 3 * Math.sin(y * 0.15);
    if (side < 0 || side > w) return null;
    const r = grain(x, y, 97);
    if (r < 0.1) return "h";
    if (r < 0.14) return "g";
    const g = vnoise(x, y, 3, 98);
    return g < 0.35 ? "E" : g < 0.7 ? "F" : "G";
  });
  return def("backdrop", [4, 1], BDW, BDH, [BDW / 2, BDH - 1], [[whole(c), vine(PILLAR_UP + 1, 9), shelves, whole(things, true), arbor, trail]]);
})();

// ==== The counter: a potting-shed counter, four squares wide and low (Drizzle shows over it).

const CW = 4 * T;
const CH = 44; // its picture (the pots on its top stand above it)
const CFOOT = CH - 3;
const CTOP = 13; // the top's upper edge: the counter itself is 29 px tall
/** The plaque on its front (blank: the game writes on it). */
const PLQ = { x: 34, y: CTOP + 7, w: 62, h: 16 } as const;
export const SHOP_PUDDLES_COUNTER_SIGN = signFace(PLQ.x, PLQ.y, PLQ.w, PLQ.h);
/** Where the crate stands on the counter: its foot, in the counter's pixels (on the right, clear of the plaque). */
export const SHOP_PUDDLES_CRATE_AT: Pt = [119, CTOP + 3];
export const SHOP_PUDDLES_COUNTER = (() => {
  const body = paint(2, CTOP, CW - 4, CFOOT - CTOP, (x, y) => {
    const j = y - CTOP;
    const i = x - 2;
    const n = CW - 4;
    // The top: a thick plank seen a little from above, its front edge.
    if (j < 4) return j === 0 ? "Q" : j === 3 ? "O" : grain(x >> 2, j, 2) > 0.8 ? "Q" : "P";
    if (j === 4) return "N";
    const fb = CFOOT - CTOP;
    if (j >= fb - 3) return j === fb - 3 ? "P" : "O"; // the plinth
    if (j === 5) return "E"; // the top's shadow on the front
    // The front: upright planks painted his green, each lit on its left, a dark seam; the right end in shade.
    const p = (i + 3) % 9;
    if (p === 0) return "E";
    if (i > n - 4) return "E";
    if (p === 1) return "G";
    if (i < 2) return "H";
    return grain(i, j >> 1, 5) > 0.93 ? "G" : "F";
  });
  const plaque = signBoard(PLQ.x, PLQ.y, PLQ.w, PLQ.h, "NOPQ", "ABD", "L");
  // Two pots of flowers on its left end.
  const pots = cv(CW, CH);
  pot(pots, 6, CTOP - 8, 10, 9, "pink");
  pot(pots, 19, CTOP - 6, 8, 7, "white");
  // A painted leaf either side of the plaque.
  const leaves = cv(CW, CH);
  stamp(leaves, 22, CTOP + 12, ["..HG", ".HGG", "HGGF", "GGF.", "F..."]);
  stamp(leaves, 103, CTOP + 12, ["GH..", "GGH.", "FGGH", ".FGG", "...F"]);
  return def("counter", [4, 1], CW, CH, [CW / 2, CFOOT], [
    [groundShadow(CW / 2, CFOOT, CW / 2 - 2, 4), body, plaque, whole(leaves), whole(pots, true)],
  ]);
})();

/**
 * Puddles' Boss Crate: a wooden crate bound in his green, a big water drop on its front, a pink ribbon tied in a bow on
 * its lid. `idle`: a bead of water runs down its side and a glint winks on the drop (6 frames), so it reads as the thing you buy.
 */
const XW = 30;
const XH = 27;
export const SHOP_PUDDLES_CRATE = (() => {
  const box = crate(1, 8, 28, 18, "NOPQ");
  const bands = paint(1, 8, 28, 18, (x, y) => {
    const i = x - 1;
    const j = y - 8;
    if (i === 3 || i === 4 || i === 23 || i === 24) return j === 0 ? "H" : i === 3 || i === 23 ? "G" : "F"; // green bands
    // A pink ribbon down the middle.
    if (i >= 13 && i <= 14) return i === 13 ? "g" : "f";
    // The drop, either side of the ribbon? no: on a round green plate over it.
    return null;
  }, false);
  const DROP = ["....kk....", "...k33k...", "..k3443k..", ".k334332k.", ".k343322k.", "k33332221k", "k33322221k", ".k322211k.", "..k1111k..", "...kkkk..."];
  const drop = cv(XW, XH);
  stamp(drop, 10, 12, DROP);
  const bow = cv(XW, XH);
  stamp(bow, 7, 1, [".kk......kk.", "khgk....kghk", "khggk..kgggk", ".khggkkgggk.", "..kffghgffk.", ".kgfk..kfgk.", "kgfk....kfgk", "kk........kk"]);
  const frames = [0, 1, 2, 3, 4, 5].map((f) => {
    const extra = cv(XW, XH);
    if (f === 1) stamp(extra, 13, 13, ["w"]);
    if (f === 2) stamp(extra, 12, 13, [".w.", "www", ".w."]);
    if (f === 3) stamp(extra, 13, 13, ["w"]);
    // The bead running down the crate's right side.
    if (f >= 2) {
      const by = [0, 0, 9, 13, 18, 22][f]!;
      stamp(extra, 26, by, f === 5 ? ["3", "2"] : ["4", "3", "2"]);
    }
    return [groundShadow(XW / 2, XH - 2, 13, 2), box, bands, whole(drop), whole(bow), whole(extra)];
  });
  return def("crate", [1, 1], XW, XH, [XW / 2, XH - 2], frames, 260);
})();

// ==== The props.

/**
 * The potting bench, two squares wide: a pegboard back with a trowel, a hand fork and a little rake hung on it; on the top,
 * seed trays of sprouts, small pots and a trowel; underneath, a sack of soil and a stack of pots.
 */
const PBW = 2 * T;
const PBH = 72;
const PBF = PBH - 3;
export const SHOP_PUDDLES_POTTING_BENCH = (() => {
  const TOPY = 40;
  const back = paint(6, 10, 62, TOPY - 10, (x, y) => {
    const i = x - 6;
    const j = y - 10;
    if (j < 3) return j === 0 ? "Q" : j === 2 ? "O" : "P"; // its top rail
    if (i < 3 || i > 58) return i === 0 ? "Q" : i === 61 ? "N" : "P";
    if (j % 6 === 3 && i % 6 === 3) return "N"; // pegs' holes
    return (i - 3) % 14 === 0 ? "N" : "O";
  });
  const tools = cv(PBW, PBH);
  stamp(tools, 14, 15, ["..N..", "..O..", "..O..", "..O..", ".SSS.", "STTSs", "STSSs", ".STs.", "..s.."]); // a trowel
  stamp(tools, 26, 15, ["..N..", "..O..", "..O..", "..O..", "SSSSS", "S.S.S", "S.S.S", "s.s.s"]); // a hand fork
  stamp(tools, 50, 13, ["...N...", "...O...", "...O...", "...O...", "...O...", "...O...", "...O...", "...O...", ".SSSSS.", "S.S.S.S", "s.s.s.s"]); // a little rake
  stamp(tools, 37, 16, ["..LL..", ".L..L.", "L....L", ".L..L.", "..LL.."]); // a coil of twine
  const top = paint(2, TOPY, 70, 5, (x, y) => (y === TOPY ? "Q" : y === TOPY + 4 ? "N" : grain(x >> 2, y, 3) > 0.8 ? "Q" : "P"));
  const legs = paint(4, TOPY + 5, 66, PBF - TOPY - 5, (x, y) => {
    if (y === PBF - 9 || y === PBF - 8) return x > 5 && x < 68 ? (y === PBF - 9 ? "P" : "O") : null; // the low shelf
    if (x <= 7 || x >= 66) return x === 4 || x === 66 ? "P" : x === 7 || x === 69 ? "N" : "O";
    return null;
  });
  const on = cv(PBW, PBH);
  // A seed tray of sprouts, two pots, a trowel on the top.
  stamp(on, 6, TOPY - 6, ["G.H.G.H.G.H.G.H.G.H.", "FGFGFGFGFGFGFGFGFGFG", "QQQQQQQQQQQQQQQQQQQQ", "PPPPPPPPPPPPPPPPPPPN", "NNNNNNNNNNNNNNNNNNNN"]);
  pot(on, 30, TOPY - 8, 9, 8, "sprout");
  pot(on, 42, TOPY - 9, 9, 9, "pink");
  pot(on, 55, TOPY - 7, 7, 7, "sprout");
  stamp(on, 63, TOPY - 2, ["sSSTO", ".ssNN"]);
  // Underneath: a sack of soil and a stack of empty pots.
  stamp(on, 10, PBF - 21, ["..BBBBBBBB..", ".BDDBBBBBBA.", "BDBBBBBBBBBA", "BBBBB66BBBBA", "BBBB6556BBBA", "BBBBB66BBBBA", "BBBBBBBBBBBA", "BBBBBBBBBBBA", "BBBBBBBBBBAA", "ABBBBBBBBBAA", ".ABBBBBBBAA.", "..AAAAAAAA.."]);
  stamp(on, 44, PBF - 19, ["eccccccccC", ".eccccccC.", "eccccccccC", ".eccccccC.", "eccccccccC", ".eccccccC.", "..eccccC..", "..eccccC..", "...eccC..."]);
  // A little soil spilled on the floor.
  stamp(on, 30, PBF - 1, ["6.66.6"]);
  return def("potting-bench", [2, 1], PBW, PBH, [PBW / 2, PBF], [
    [groundShadow(PBW / 2, PBF, 34, 4), back, whole(tools, true), legs, top, whole(on, true)],
  ]);
})();

/** A big potted palm: a terra cotta pot, a short ringed trunk, fronds arching out all round. `idle`: the fronds sway a pixel. */
const PAW = 64;
const PAH = 112;
const PAF = PAH - 3;
export const SHOP_PUDDLES_PALM = (() => {
  const potP = paint(PAW / 2 - 12, PAF - 22, 25, 22, (x, y) => {
    const j = y - (PAF - 22);
    const X = x + 0.5 - PAW / 2;
    const half = j < 4 ? 12.5 : 11 - (j - 4) * 0.2;
    if (Math.abs(X) > half) return null;
    if (j < 4) return j === 0 ? "e" : j === 3 ? "C" : X > 8 ? "c" : "e"; // its rim
    if (j === 4 && Math.abs(X) < 10) return "5"; // the earth showing
    return X < -7 ? "e" : X > 5 ? "C" : "c";
  });
  const trunk = paint(PAW / 2 - 3, 46, 7, PAF - 22 - 46 + 2, (x, y) => {
    const X = x - PAW / 2;
    if (Math.abs(X + 0.5) > 3 - ((y - 46) % 5 === 0 ? 0 : 0.6)) return null;
    return (y - 46) % 5 === 0 ? "N" : X < 0 ? "P" : "O";
  });
  // Fronds: [angle from straight up (deg), length, droop, ramp (dark, mid, light), behind?]
  const FRONDS: [number, number, number, string, number][] = [
    [-70, 28, 14, "EFG", 1],
    [70, 28, 14, "EFG", 1],
    [-20, 26, 8, "EFG", 1],
    [25, 26, 9, "EFG", 1],
    [-50, 30, 16, "FGH", 0],
    [50, 30, 16, "FGH", 0],
    [-5, 24, 10, "FGH", 0],
    [-95, 24, 16, "FGH", 0],
    [95, 24, 16, "FGH", 0],
  ];
  const crown: Pt = [PAW / 2, 48];
  const frondPart = (sway: number, back: number) => {
    const c = cv(PAW, PAH);
    for (const [ang, len, droop, ramp, b] of FRONDS) {
      if (b !== back) continue;
      const a = (ang * Math.PI) / 180;
      const dx = Math.sin(a);
      const dy = -Math.cos(a);
      const pts: Pt[] = [];
      for (let t = 0; t <= 1.0001; t += 1 / (len * 1.5)) {
        const px = crown[0] + dx * len * t + sway * t * t;
        const py = crown[1] + dy * len * t + droop * t * t;
        pts.push([Math.round(px), Math.round(py)]);
      }
      // Leaflets: short strokes out either side, hanging a little, shorter toward the tip.
      pts.forEach(([px, py], i) => {
        const t = i / pts.length;
        put(c, px, py, ramp[1]!);
        if (i % 2 || t < 0.12) return;
        const l = Math.round(5 * (1 - t) + 1);
        const nx = -dy;
        const ny = dx;
        for (let s = 1; s <= l; s++) {
          put(c, Math.round(px + nx * s * 0.8), Math.round(py + ny * s * 0.5 + s * 0.5), s === 1 ? ramp[1]! : ramp[2]!);
          put(c, Math.round(px - nx * s * 0.8), Math.round(py - ny * s * 0.5 + s * 0.5), ramp[0]!);
        }
      });
    }
    return whole(c, true);
  };
  const frames = [0, 1, 2, 3].map((f) => {
    const sway = [0, 1, 0, -1][f]!;
    return [groundShadow(PAW / 2, PAF, 15, 3), frondPart(sway, 1), trunk, frondPart(sway, 0), potP];
  });
  return def("palm", [1, 1], PAW, PAH, [PAW / 2, PAF], frames, 420);
})();

/** A small tiered stone fountain, as the one outside his door: a basin, a bowl, a top bowl. `idle`: its water runs (4 frames). */
const FOW = 44;
const FOH = 72;
const FOF = FOH - 4;
export const SHOP_PUDDLES_FOUNTAIN = (() => {
  const FX = FOW / 2;
  const frames = [0, 1, 2, 3].map((f) => {
    const stone = paint(0, 0, FOW, FOH, (x, y) => {
      const X = x + 0.5 - FX;
      // The basin: an oval rim seen from above, water in it, its side below.
      const by = FOF - 12;
      const e = Math.hypot(X / 20, (y + 0.5 - by) / 6);
      if (y + 0.5 > by && Math.abs(X) < 20 && y < FOF) return y > FOF - 3 ? "s" : X < -12 ? "T" : X < 8 ? "S" : "s";
      if (e < 1) {
        if (e > 0.78) return X + (y - by) * 2 < 0 ? "T" : "S"; // its rim
        const ring = (Math.hypot(X / 14, (y + 0.5 - by) / 4) * 4 - f * 0.5) % 2;
        return ring < 0.35 ? "3" : "2";
      }
      // The pedestal, the bowl, the top bowl.
      const bowl = FOF - 36;
      const eb = Math.hypot(X / 12, (y + 0.5 - bowl) / 3.5);
      if (eb < 1) return eb > 0.72 ? (X < 2 ? "T" : "S") : "3";
      if (y + 0.5 > bowl && y < bowl + 5 && Math.abs(X) < 11 - (y - bowl) * 1.8) return X < -1 ? "T" : X < 4 ? "S" : "s";
      const top = FOF - 52;
      const et = Math.hypot(X / 6, (y + 0.5 - top) / 2.2);
      if (et < 1) return et > 0.6 ? (X < 1 ? "T" : "S") : "4";
      if (y + 0.5 > top && y < top + 3 && Math.abs(X) < 5 - (y - top) * 1.5) return X < 0 ? "T" : "s";
      if (Math.abs(X) < 2.5 && y > top && y < by) return X < -0.5 ? "T" : X < 1 ? "S" : "s";
      if (Math.abs(X) < 1.5 && y >= top - 6 && y < top) return "S"; // the spout
      return null;
    });
    // The water: a jet up from the spout, falling from the bowls' lips in streams that run (dashes moving down).
    const water = paint(0, 0, FOW, FOH, (x, y) => {
      const X = x + 0.5 - FX;
      const top = FOF - 52;
      const bowl = FOF - 36;
      const run = (y + 8 - f * 2) % 4 < 2;
      if (Math.abs(X) < 1 && y >= top - 10 && y < top - 6) return y === top - 10 ? "w" : "4";
      if (y === top - 9 && Math.abs(X) > 1 && Math.abs(X) < 3) return "4";
      if (Math.abs(Math.abs(X) - 6) < 0.6 && y > top && y < bowl - 2) return run ? "4" : "3";
      if (Math.abs(Math.abs(X) - 12.5) < 0.6 && y > bowl && y < FOF - 15) return run ? "4" : "3";
      return null;
    }, false);
    const splash = cv(FOW, FOH);
    const sp = [["4..4", ".33."], [".4.4", "3..3"], ["4.4.", ".3.3"], [".44.", "3..3"]][f]!;
    stamp(splash, FX - 15, FOF - 17, sp);
    stamp(splash, FX + 11, FOF - 17, sp);
    return [groundShadow(FX, FOF, 20, 3), stone, water, whole(splash)];
  });
  return def("fountain", [1, 1], FOW, FOH, [FOW / 2, FOF], frames, 180);
})();

//@@PIECES@@

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
  /** Squares deep, for the deep pieces (the pond garden: 2), from `row` north: it stands on `row`, and covers the rows north of it too. */
  d?: number;
  /** The way out (the entrance): walking into it leaves the greenhouse. */
  exit?: boolean;
}
const LAYOUT: ShopPlace[] = [];
const at = (name: string, col: number, row: number, solid: boolean, more: Partial<ShopPlace> = {}) => {
  const p = PIECES[name];
  if (p) LAYOUT.push({ name, col, row, solid, ...(p.sq[0] > 1 ? { w: p.sq[0] } : {}), ...(p.sq[1] > 1 ? { d: p.sq[1] } : {}), ...more });
};

// -- The floor (every square).
const DIAG: Record<string, 0 | 1 | 2 | 3> = {};
for (const [cs, rs, r] of [[[7, 6], [7, 8], 0], [[12, 13], [7, 8], 1], [[13, 12], [13, 14], 2], [[6, 7], [13, 14], 3]] as const) {
  DIAG[`${cs[0]},${rs[0]}`] = r;
  DIAG[`${cs[1]},${rs[1]}`] = r;
}
const CORNER: Record<string, 0 | 1 | 2 | 3> = { "7,8": 0, "12,8": 1, "12,13": 2, "7,13": 3 };
const SPECIAL: Record<string, [string, 0 | 2]> = {
  "9,8": ["circle-mark-l", 0],
  "10,8": ["circle-mark-r", 0],
  "10,13": ["circle-mark-l", 2],
  "9,13": ["circle-mark-r", 2],
  "9,10": ["emblem-nw", 0],
  "10,10": ["emblem-ne", 0],
  "9,11": ["emblem-sw", 0],
  "10,11": ["emblem-se", 0],
};
const MOSS = new Set(["2,6", "17,5", "4,16", "15,16", "14,4", "1,10", "18,13", "5,2"]);
const PUDDLE = new Set(["3,8", "16,13", "13,17", "6,4"]);
for (let row = 0; row < 20; row++)
  for (let col = 0; col < 20; col++) {
    const k = `${col},${row}`;
    const even = (col + row) % 2 === 0;
    if (DIAG[k] !== undefined) at(even ? "circle-edge-diag" : "circle-edge-diag-b", col, row, false, { rot: DIAG[k] });
    else if (CORNER[k] !== undefined) at("circle-edge-corner", col, row, false, { rot: CORNER[k] });
    else if (SPECIAL[k]) at(SPECIAL[k]![0], col, row, false, SPECIAL[k]![1] ? { rot: SPECIAL[k]![1] } : {});
    else if (row === 7 && col >= 8 && col <= 11) at("circle-edge", col, row, false, { rot: 0 });
    else if (row === 14 && col >= 8 && col <= 11) at("circle-edge", col, row, false, { rot: 2 });
    else if (col === 6 && row >= 9 && row <= 12) at("circle-edge", col, row, false, { rot: 3 });
    else if (col === 13 && row >= 9 && row <= 12) at("circle-edge", col, row, false, { rot: 1 });
    else if ((row === 10 || row === 11) && col >= 7 && col <= 12) at(even ? "circle-line" : "circle-line-b", col, row, false, row === 11 ? { rot: 2 } : {});
    else if (col >= 7 && col <= 12 && row >= 8 && row <= 13) at(even ? "circle-a" : "circle-b", col, row, false);
    else if (row === 18 && (col === 9 || col === 10)) at("floor-door", col, row, false);
    else if (MOSS.has(k) && even) at("floor-c", col, row, false);
    else if (PUDDLE.has(k) && !even) at("floor-d", col, row, false);
    else at(even ? "floor-a" : "floor-b", col, row, false);
  }
const FLOOR_COUNT = LAYOUT.length;

// -- The walls: the back (north) wall on row 0, the sides on columns 0 and 19, the low front on row 19.
const BACKDROP = !!PIECES["backdrop"];
for (let col = 0; col < 20; col++) {
  if (BACKDROP && col >= 8 && col <= 11) {
    if (col === 8) at("backdrop", 8, 0, true);
    continue;
  }
  at([0, 5, 14, 19].includes(col) ? "wall-pillar" : "wall", col, 0, true, col === 19 ? { flip: true } : {});
}
for (let row = 1; row < 19; row++) {
  at(row === 10 ? "wall-side-pillar" : "wall-side", 0, row, true);
  at(row === 10 ? "wall-side-pillar" : "wall-side", 19, row, true, { flip: true });
}
at("hem-pillar", 0, 19, true);
for (let col = 1; col < 19; col++) if (col < 9 || col > 10) at("hem", col, 19, true);
at("entrance", 9, 19, false, { exit: true });
at("hem-pillar", 19, 19, true, { flip: true });

// -- The shop and the props.
at("potting-bench", 2, 3, true);
at("counter", 8, 3, true);
at("crate", 8, 3, false); // on the counter (see SHOP_PUDDLES_CRATE_AT): its place is the counter's
at("palm", 16, 3, true);
at("hose-reel", 17, 6, true);
at("fountain", 3, 9, true);
at("pond-garden", 15, 10, true);
at("flower-bed", 2, 14, true);
at("wheelbarrow", 16, 15, true);

/** Where every piece goes: name, column (its west-most square), row (its south-most), solid; floor tiles first, then the upright pieces north to south. */
export const SHOP_PUDDLES_LAYOUT: readonly ShopPlace[] = [...LAYOUT.slice(0, FLOOR_COUNT), ...LAYOUT.slice(FLOOR_COUNT).sort((a, b) => a.row - b.row || a.col - b.col)];

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
const CRATE_AT = SHOP_PUDDLES_CRATE_AT;
const footOf = (pl: ShopPlace): Pt => {
  const p = PIECES[pl.name]!;
  if (pl.name === "crate") {
    const cp = PIECES["counter"]!;
    const [cx, cy] = footOf({ name: "counter", col: pl.col, row: pl.row, solid: true });
    return [cx - cp.foot[0] + CRATE_AT[0], cy - cp.foot[1] + CRATE_AT[1]];
  }
  return [pl.col * T + Math.floor((p.sq[0] * T) / 2), TOP + pl.row * T + 18];
};
const roomFrame = (f: number): Frame => {
  const layers: Layer[] = [];
  for (const pl of SHOP_PUDDLES_LAYOUT) {
    const p = PIECES[pl.name]!;
    const [fx, fy] = footOf(pl);
    layers.push(...placed(p, f, fx, fy, pl.flip, pl.rot));
  }
  return { ms: 160, layers };
};
const anims: Record<string, Anim> = { idle: { loop: true, frames: [roomFrame(0)] } };
/** (For review: the room with every piece's idle running.) */
anims["room-live"] = { loop: true, frames: [0, 1, 2, 3, 4, 5, 6, 7].map(roomFrame) };
/** Each piece alone, for review, blown up (up to 4x); a floor tile three by three, a wall three side by side. */
for (const p of Object.values(PIECES)) {
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
  // (For review: a patch of floor, 6 x 6 squares at 3x.)
  const pick = (c: number, r: number) => (c === 2 || c === 3) && r === 5 ? "floor-door" : c === 4 && r === 2 ? "floor-c" : c === 1 && r === 1 ? "floor-d" : (c + r) % 2 ? "floor-b" : "floor-a";
  const Z = 3;
  const grid = Array.from({ length: 6 * T * Z }, (_, y) =>
    Array.from({ length: 6 * T * Z }, (_, x) => {
      const c = Math.floor(x / (T * Z));
      const r = Math.floor(y / (T * Z));
      return PIECES[pick(c, r)]!.frames[0]![0]!.part.grid[Math.floor(y / Z) % T]![Math.floor(x / Z) % T]!;
    }).join(""),
  );
  roomParts["review-floor"] = { grid, outline: false };
  anims["review-floor"] = { loop: true, frames: [{ ms: 1000, layers: [{ part: "review-floor", x: 4, y: 4 }] }] };
  // The circle as laid out (columns 5-14, rows 6-15) at 2x, each tile turned as the layout says.
  const floorAt = new Map(SHOP_PUDDLES_LAYOUT.slice(0, FLOOR_COUNT).map((p) => [`${p.col},${p.row}`, p]));
  const keyAt = (gx: number, gy: number) => {
    const p = floorAt.get(`${Math.floor(gx / T)},${Math.floor(gy / T)}`)!;
    const g = PIECES[p.name]!.frames[0]![0]!.part.grid;
    let [x, y] = [gx % T, gy % T];
    for (let q = 0; q < (p.rot ?? 0); q++) [x, y] = [y, T - 1 - x]; // undo a quarter turn clockwise
    return g[y]![x]!;
  };
  const ringGrid = Array.from({ length: 10 * T * 2 }, (_, y) => Array.from({ length: 10 * T * 2 }, (_, x) => keyAt(5 * T + (x >> 1), 6 * T + (y >> 1))).join(""));
  roomParts["review-circle"] = { grid: ringGrid, outline: false };
  anims["review-circle"] = { loop: true, frames: [{ ms: 1000, layers: [{ part: "review-circle", x: 0, y: 4 }] }] };
}

/** Every piece by its name (as SHOP_PUDDLES_LAYOUT names them), each its own Character `shop-puddles-<name>`. */
export const SHOP_PUDDLES_PIECES: Readonly<Record<string, Character>> = Object.fromEntries(Object.values(PIECES).map((p) => [p.name, toChar(p)]));

export const HOUSE_SHOP_PUDDLES: Character = { id: "house-shop-puddles", name: "Puddles' shop", w: RW, h: RH, foot: [RW / 2, RH - 4], palette: PALETTE, parts: roomParts, anims };
