/**
 * Inside Alfil's Pyramid: Alfil's shop (house-shop-alfil). A room of 20 x 20 squares seen as the town square is seen (the
 * camera looks north, things stand upright at their foot, 37 px a square): the inside of the stepped sandstone pyramid of
 * town/houses/alfil.ts, in its colors (the sandstone, Alfil's red, blue and gold of his Nettipattam and caparison, his
 * browns). Bright and airy, not a tomb: the back wall is a row of tall openings between carved piers, looking out on
 * golden dunes and far pyramids under a pale desert sky (the clean "windows" of the other shops).
 * Each piece is its own `Character` (`shop-alfil-<name>`); `SHOP_ALFIL_LAYOUT` says where each piece goes. Copied as drawn from
 * `claude/boss-art` (scripts/boss-art/out/house-shop-alfil/house-shop-alfil.ts, Nov 2), its imports moved and its room still and
 * review strips (HOUSE_SHOP_ALFIL) left there. Built as Puddles' shop is
 * (scripts/boss-art/out/house-shop-puddles).
 *
 * Footing: a piece's foot is the middle of its square (a wide piece's: the middle of its width, on the middle of its row;
 * a deep piece stands on its south row). Floor tiles are flat, top-down, 37 x 37, foot at their middle; the circle's edge
 * tiles are turned by `rot` (quarter turns clockwise) and the east wall is the west one mirrored (`flip`).
 */
import { frameKeys, type Anim, type Character, type Frame, type Layer, type Part } from "../../characters/sprite.ts";
import { grain, groundShadow, paint, signBoard, signFace, TORCH, type LightPool, type LightSpot, type Pt } from "../houses/kit.ts";

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
  v: "#ffffff", // a glint
  a: "#f0d6a0", // sandstone (the pyramid's): lightest to darkest
  b: "#e0bd80",
  c: "#c99e62",
  d: "#a87e48",
  e: "#7d5c33",
  x: "#1e140c", // dark, less dark
  X: "#3a2818",
  W: "#5a3a1e", // wood: dark to light
  w: "#86592c",
  V: "#b07a40",
  U: "#d4a466",
  s: "#c9a56a", // the sign's face: shadow, board, light
  t: "#e8cc95",
  u: "#f7e4b8",
  T: "#fffaea", // ivory: light, mid, shade (tusks)
  S: "#ece0c1",
  M: "#c9b78f",
  "-": "#0d0e1280", // ground shadow: core, rim
  "+": "#0d0e1244",
  // ---- The room's own.
  "1": "#bfe0ef", // the desert sky through the openings: high, mid, the haze at the horizon
  "2": "#e0f0f0",
  "3": "#fff3d6",
  "7": "#f0d9ae", // far pyramids in the haze: lit, shade
  "8": "#d8bb90",
  "4": "#f8da9e", // dunes: lit, mid, shade
  "5": "#ecbf74",
  "6": "#d49e58",
  g: "#d8b57e", // the floor's flags a: base, worn, fleck
  h: "#d0ac74",
  i: "#e2c28c",
  j: "#ceaa72", // flags b
  l: "#c6a168",
  m: "#d8b67e",
  n: "#a9844f", // the joints
  o: "#ead097", // daylight on the floor: soft, bright
  p: "#f7e6bd",
  q: "#f1e1bf", // the circle's polished flags: a, b, worn, joint, light
  Q: "#e9d5ac",
  z: "#ddc597",
  Z: "#b39566",
  A: "#fbf0d8",
  F: "#c76a50", // the wall paintings' faded red, blue, gold
  G: "#6a89c0",
  H: "#e0b45c",
  C: "#38b0a2", // faience turquoise (gems, amulets): mid, light
  D: "#9ae2d4",
  "9": "#d9431c", // fire: deep, mid, bright
  "0": "#ff9a3c",
  "@": "#ffdf7a",
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
  return { id: `shop-alfil-${p.name}`, name: `Alfil's shop: ${p.name}`, w: p.w, h: p.h, foot: p.foot, palette: PALETTE, parts, anims: { idle: { loop: true, frames } } };
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
const get = (c: Cv, x: number, y: number) => (y >= 0 && y < c.length && x >= 0 && x < c[0]!.length ? c[y]![x]! : ".");
const asPart = (c: Cv, outline = false): Part => ({ grid: c.map((r) => r.join("")), outline });
const stamp = (c: Cv, x: number, y: number, rows: readonly string[]) => rows.forEach((r, j) => [...r].forEach((k, i) => k !== "." && put(c, x + i, y + j, k)));
const whole = (c: Cv, outline = false): Bit => ({ part: asPart(c, outline), at: [0, 0] });
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
/**
 * A carved figure: `fn` gives each pixel's fill (null: none) over a w x h box; every filled pixel on the shape's edge
 * becomes the carved line `line` (so a painted relief reads with a cut outline). Returns stamp rows.
 */
function figure(w: number, h: number, fn: (i: number, j: number) => Key, line = "e"): string[] {
  const g = Array.from({ length: h }, (_, j) => Array.from({ length: w }, (_, i) => fn(i, j)));
  const on = (i: number, j: number) => i >= 0 && j >= 0 && i < w && j < h && g[j]![i] !== null;
  return g.map((row, j) => row.map((k, i) => (k === null ? "." : !on(i - 1, j) || !on(i + 1, j) || !on(i, j - 1) || !on(i, j + 1) ? line : k)).join(""));
}

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
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number) => (BAYER[(((y % 4) + 4) % 4) * 4 + (((x % 4) + 4) % 4)]! + 0.5) / 16;

/** An elephant in profile facing left on a 28 x 18 plan (as the carving over the pyramid's door): which bit (i, j) is. */
function elephantAt(i: number, j: number): "eye" | "tusk" | "ear" | "cloth" | "trim" | "body" | null {
  const body = ((i - 16) / 8) ** 2 + ((j - 8) / 4.5) ** 2 < 1;
  const head = Math.hypot(i - 8, j - 6) < 4;
  const ear = ((i - 10.5) / 2.2) ** 2 + ((j - 7) / 3.2) ** 2 < 1;
  const trunk = (i >= 4 && i <= 6.2 && j >= 7 && j <= 14) || (i >= 2.4 && i <= 4.5 && j >= 13 && j <= 15.2);
  const legs = j >= 11 && j <= 16 && [11.5, 14.5, 18.5, 21.5].some((lx) => i >= lx && i <= lx + 2);
  const tail = i >= 24 && i <= 25.2 && j >= 8 && j <= 11;
  if (Math.hypot(i - 8.6, j - 5) < 0.8) return "eye";
  if (i >= 4.5 && i <= 8 && Math.abs(j - 10.4) < 0.75) return "tusk";
  if (ear) return "ear";
  if (body && i > 12.5 && i < 20.5 && j > 3.4 && j < 8.6) return j > 7.4 ? "trim" : "cloth";
  return body || head || trunk || legs || tail ? "body" : null;
}

// ==== The floor: flat squares, top-down, no outline, tiling seamlessly.

/**
 * A sandstone flag: one a square, a 1 px joint on every edge (2 px between two, the same however it's turned), a soft
 * lit bevel on its top and left, a broad worn patch or two and a rare fleck. `ramp`: base, worn, fleck.
 */
const flagstone = (x: number, y: number, ramp: string, seed: number): string => {
  if (x === 0 || y === 0 || x === T - 1 || y === T - 1) return "n";
  if ((x === 1 || y === 1) && x < T - 2 && y < T - 2) return ramp[2]!;
  const n = vnoise(x, y, 12, seed);
  if (n > 0.76 && (x + y) % 2 === 0) return ramp[1]!;
  const g = grain(x >> 1, y, seed + 50);
  return g < 0.008 ? ramp[1]! : g > 0.996 ? ramp[2]! : ramp[0]!;
};
const FA = "ghi";
const FB = "jlm";
const flat = (fn: (x: number, y: number) => Key): Bit[][] => [[paint(0, 0, T, T, fn, false)]];
const tileDef = (name: string, fn: (x: number, y: number) => Key) => def(name, [1, 1], T, T, [18, 18], flat(fn));

export const SHOP_ALFIL_FLOOR_A = tileDef("floor-a", (x, y) => flagstone(x, y, FA, 11));
export const SHOP_ALFIL_FLOOR_B = tileDef("floor-b", (x, y) => flagstone(x, y, FB, 12));

/** Variety on a: desert sand blown in and drifted into its lower-left corner, rippled by the wind, a few grains loose. */
export const SHOP_ALFIL_FLOOR_C = tileDef("floor-c", (x, y) => {
  const r = Math.hypot(x + 0.5, T - 0.5 - y);
  const n = vnoise(x, y, 4, 31);
  const d = r + n * 6;
  if (d < 23) {
    if (d > 21.6) return "5"; // its soft rim
    const rip = (((x * 0.9 - y + 0.3 * r) % 6) + 6) % 6;
    return rip < 1 ? "5" : "4";
  }
  // Loose grains a little way out from it.
  if (d < 29 && grain(x, y, 33) > 0.9) return "4";
  return flagstone(x, y, FA, 11);
});

/** Variety on b: a cracked flag (a jagged crack from its top edge, forking, its lip catching the light), a chip off a corner. */
export const SHOP_ALFIL_FLOOR_D = (() => {
  const c = cv(T, T);
  fill(c, (x, y) => flagstone(x, y, FB, 12));
  const crack = (pts: Pt[]) => {
    for (let s = 0; s < pts.length - 1; s++) {
      const [x0, y0] = pts[s]!;
      const [x1, y1] = pts[s + 1]!;
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let t = 0; t <= n; t++) {
        const px = Math.round(x0 + ((x1 - x0) * t) / n);
        const py = Math.round(y0 + ((y1 - y0) * t) / n);
        put(c, px, py, "e");
        if (get(c, px - 1, py) !== "e" && get(c, px - 1, py) !== "n") put(c, px - 1, py, "m");
      }
    }
  };
  crack([[14, 0], [15, 5], [13, 9], [17, 14], [16, 19], [20, 24], [19, 28]]);
  crack([[16, 19], [11, 22], [9, 27]]);
  crack([[17, 14], [23, 13]]);
  stamp(c, 30, 31, ["....nn", "...nll", "..nlll", ".nllll", "nlllll"].map((r) => r));
  return def("floor-d", [1, 1], T, T, [18, 18], [[whole(c)]]);
})();

/** The daylight through the doorway: a warm wash on the flags, bright at the door (south), fading as it goes north. */
export const SHOP_ALFIL_FLOOR_DOOR = tileDef("floor-door", (x, y) => {
  const base = flagstone(x, y, FB, 12);
  if (base === "n") return y > 26 ? "j" : base;
  const v = ((y + 0.5) / T) * 2.1;
  const th = bayer(x, y);
  if (v > 1 + th) return "p";
  if (v > th * 0.9 + 0.1) return "o";
  return base;
});

// ==== The battle circle: polished pale stone in a band of his blue set with gold glyphs between gold borders.

/** A polished flag: one a square, a 1 px joint, a soft bevel (lit top-left, worn at the foot and right). `tone`: q or Q. */
const pflag = (x: number, y: number, tone: string, seed = 21): string => {
  if (x === 0 || y === 0 || x === T - 1 || y === T - 1) return "Z";
  if (x === 1 || y === 1) return "A";
  if ((x === T - 2 || y === T - 2) && (x + y) % 2 === 0) return "z";
  const n = vnoise(x, y, 12, seed);
  if (n > 0.84 && (x + y) % 2 === 0) return "z";
  const g = grain(x >> 1, y, seed + 9);
  return g < 0.01 ? "z" : g > 0.995 ? "A" : tone;
};
export const SHOP_ALFIL_CIRCLE_A = tileDef("circle-a", (x, y) => pflag(x, y, "q", 21));
export const SHOP_ALFIL_CIRCLE_B = tileDef("circle-b", (x, y) => pflag(x, y, "Q", 22));

/** The glyphs set in gold in the blue band, 6 x 6: an ankh, a sun disk, the alfil chess piece. */
const GLYPHS = [
  ["..YY..", ".Y..Y.", "..YY..", "YYYYYY", "..YY..", "..YY.."],
  [".YYYY.", "Y....Y", "Y.yY.Y", "Y.YO.Y", "Y....Y", ".YYYY."],
  ["..YY..", ".YyYY.", ".YYYY.", "..YY..", ".YYYY.", "YYYYYY"],
];
/**
 * The circle's border by depth `j` into the band (0 its outer edge) and `al` along it: a dark edge, a gold border, a blue
 * band with gold glyphs every 12 px (on the 45-degree sides, gold studs: the glyphs won't draw on the slant), a gold
 * border, a thin red line, and its shadow on the stones.
 */
const frieze = (j: number, al: number, slant = false): string | null => {
  if (j < 0) return null;
  if (j === 0) return "e";
  if (j === 1) return "O";
  if (j === 2) return "y";
  if (j === 3) return "Y";
  if (j === 4) return "O";
  if (j < 13) {
    if (j === 5) return "N";
    if (j === 12) return "N";
    const fa = ((al % 12) + 12) % 12;
    if (slant) {
      const m = Math.abs(fa - 6) + Math.abs(j - 8.5);
      return m < 2 ? "y" : m < 3.2 ? "Y" : "B";
    }
    const gi = Math.floor((((al % 36) + 36) % 36) / 12);
    const row = GLYPHS[gi]![j - 6];
    const k = row && fa >= 3 && fa < 9 ? row[fa - 3]! : ".";
    return k !== "." ? k : j === 6 ? "I" : "B";
  }
  if (j === 13) return "O";
  if (j === 14) return "Y";
  if (j === 15) return "R";
  if (j === 16) return "Z";
  return null;
};
/** Straight: the band along the tile's north side (the game turns it). */
export const SHOP_ALFIL_CIRCLE_EDGE = tileDef("circle-edge", (x, y) => frieze(y, x) ?? pflag(x, y, "q"));
/** The octagon's 45-degree sides: the band from the tile's lower left to its upper right, floor beyond it (the NW cut). */
const diag = (ramp: string, seed: number) => (x: number, y: number) => {
  const s = x + y;
  if (s < 36) return flagstone(x, y, ramp, seed);
  return frieze(s - 36, x - y + 37, true) ?? pflag(x, y, "q");
};
export const SHOP_ALFIL_CIRCLE_EDGE_DIAG = tileDef("circle-edge-diag", diag(FA, 11));
export const SHOP_ALFIL_CIRCLE_EDGE_DIAG_B = tileDef("circle-edge-diag-b", diag(FB, 12));
/** The circle's square inside each corner, where the diagonal band's end clips its corner. */
export const SHOP_ALFIL_CIRCLE_EDGE_CORNER = tileDef("circle-edge-corner", (x, y) => frieze(x + y + 1, x - y + 74, true) ?? pflag(x, y, "q"));

/** The middle line: a 3 px band along the tile's south edge, gold then blue (turned twice for the square south of it). */
const midLine = (tone: string) => (x: number, y: number) => (y >= T - 3 ? (y === T - 3 ? "Y" : y === T - 2 ? "B" : "N") : pflag(x, y, tone));
export const SHOP_ALFIL_CIRCLE_LINE = tileDef("circle-line", midLine("q"));
export const SHOP_ALFIL_CIRCLE_LINE_B = tileDef("circle-line-b", midLine("Q"));

/** The gold lotus on a start mark: three petals and two buds fanning up from a cup, 13 x 11. */
const LOTUS = [
  "......y......",
  ".....yYO.....",
  ".y...yYO...O.",
  ".yY..yYO..YO.",
  "..yY.yYO.YO..",
  "..yYYyYOYYO..",
  "...yYYYYYO...",
  "....yYYYO....",
  ".....OOO.....",
  "...yYYYYYO...",
  "....OOOOO....",
];
/** A start mark: a gold-edged red pad (two squares wide) with a gold lotus on it, inside each of the north and south edges. */
const mark = (x: number, y: number): string | null => {
  const X = x + 0.5 - 37;
  const Y = y + 0.5 - 19.5;
  const d = Math.hypot(Math.max(0, Math.abs(X) - 17), Y) - 10.5; // a pill 55 wide, 21 tall
  if (d > 0) return null;
  if (d > -1) return "e";
  if (d > -2.2) return "Y";
  if (d > -3) return "O";
  // A lotus: three petals fanning up from a little cup.
  const petal = (ang: number, len: number) => {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const u = (X * s - (Y - 5) * -c) / len; // along it (up and out)
    const v = (X * c + (Y - 5) * s) / (len * 0.32);
    return u > 0 && u < 1 && Math.abs(v) < Math.sin(Math.PI * u) ? (v < 0 ? "y" : "Y") : null;
  };
  void petal;
  const lx = Math.floor(X + 6.5);
  const ly = Math.floor(Y + 5.5);
  const k = LOTUS[ly]?.[lx];
  if (k && k !== ".") return k;
  return Y > 6.5 ? "r" : "R";
};
export const SHOP_ALFIL_CIRCLE_MARK_L = tileDef("circle-mark-l", (x, y) => mark(x, y) ?? pflag(x, y, "Q"));
export const SHOP_ALFIL_CIRCLE_MARK_R = tileDef("circle-mark-r", (x, y) => mark(x + T, y) ?? pflag(x, y, "q"));

/**
 * The emblem, two by two squares in the circle's middle: a gold sun disk in a ring of his blue (gold studs round it, gold
 * rims), and on the disk Alfil's head front on in deep blue, ivory tusks, his red Nettipattam on his brow; the middle line
 * runs into it either side.
 */
const emblem = (x: number, y: number): string | null => {
  const X = x + 0.5 - 37;
  const Y = y + 0.5 - 37;
  const d = Math.hypot(X, Y);
  if (d > 35) return Math.abs(Y) < 3 ? (Math.abs(Y) > 2 ? "Y" : Math.abs(Y) > 1 ? "B" : "N") : null;
  if (d > 34) return "e";
  if (d > 30) return d < 31.3 && X + Y < -14 ? "y" : X + Y > 18 ? "O" : "Y";
  if (d > 29) return "O";
  if (d > 24) {
    const a = Math.atan2(Y, X);
    const st = Math.round((a / (2 * Math.PI)) * 16);
    const sa = (st * 2 * Math.PI) / 16;
    if (Math.hypot(X - Math.cos(sa) * 26.5, Y - Math.sin(sa) * 26.5) < 1.6) return X + Y < 0 ? "y" : "Y";
    return d > 28 || X + Y > 20 ? "N" : "B";
  }
  if (d > 23) return "O";
  // The head: tusks, trunk, dome, ears (front on).
  const tusk = (sx: number) => {
    const t = (Y - 3) / 10;
    if (t < 0 || t > 1) return false;
    const cx = sx * (4.5 + 4 * t * t);
    return Math.abs(X - cx) < 1.4 - t * 0.5;
  };
  if (tusk(-1) || tusk(1)) return X < 0 ? "T" : "S";
  const trunkCx = Y > 10 ? 1.5 * Math.sin((Y - 10) / 3) : 0;
  const trunk = Y > -2 && Y < 16 && Math.abs(X - trunkCx) < 3.4 - (Y - -2) * 0.1;
  const dome = Math.hypot(X / 8.5, (Y + 4) / 8) < 1;
  const ear = (sx: number) => Math.hypot((X - sx * 11) / 6.5, (Y + 2) / 8.5) < 1;
  const nett = Math.abs(X) + Math.abs(Y + 7) < 4.5;
  if (nett) return Math.abs(X) + Math.abs(Y + 7) < 2 ? "Y" : "R";
  if (Math.hypot(Math.abs(X) - 4, Y + 1.5) < 1) return "y"; // his eyes, gold
  if (trunk || dome) {
    const rim = !(Math.abs(X - trunkCx) < 2.4 - (Y + 2) * 0.1) && trunk && !dome;
    return rim ? "N" : X < -2 && Y < 2 ? "I" : (Y > 12 && Y % 3 < 1) ? "N" : "B";
  }
  if (ear(-1) || ear(1)) return Math.hypot((Math.abs(X) - 11) / 6.5, (Y + 2) / 8.5) > 0.78 ? "N" : X < 0 ? "B" : "N";
  return X + Y < -14 && d > 16 ? "y" : "Y";
};
const emTile = (ox: number, oy: number, tone: string) => (x: number, y: number) => emblem(x + ox, y + oy) ?? pflag(x, y, tone);
export const SHOP_ALFIL_EMBLEM_NW = tileDef("emblem-nw", emTile(0, 0, "Q"));
export const SHOP_ALFIL_EMBLEM_NE = tileDef("emblem-ne", emTile(T, 0, "q"));
export const SHOP_ALFIL_EMBLEM_SW = tileDef("emblem-sw", emTile(0, T, "q"));
export const SHOP_ALFIL_EMBLEM_SE = tileDef("emblem-se", emTile(T, T, "Q"));

// ==== The back wall: tall openings between sandstone piers, the desert outside.

const WALL_H = 130;
const CORNICE = 14; // the cornice's foot (the openings start a little below)
const OPEN_TOP = 18;
const SILL = 100; // the sill's top
const HORIZON = 74;
const OX0 = 4; // the opening's west and east edges (a pier of 8 between two squares' openings)
const OX1 = 32;

/** The cornice along the top: a lit lip, painted flutes (blue, gold, red, gold) curving into shade, a gold roll under. */
const cornice = (x: number, y: number): string => {
  if (y === 1) return "a";
  if (y === 2) return "b";
  if (y < 11) {
    const fx = x >= 36 ? 0 : x % 6;
    if (fx === 0) return y > 8 ? "d" : "c";
    const col = ["B", "Y", "R", "Y", "B", "Y"][Math.floor(x / 6) % 6]!;
    const shade: Record<string, string> = { B: "N", Y: "O", R: "r" };
    return y > 8 || fx === 5 ? shade[col]! : y === 3 && fx < 3 ? (col === "Y" ? "y" : col === "B" ? "I" : col) : col;
  }
  if (y === 11) return "y";
  if (y === 12) return "Y";
  return "O";
};
/** The view out of one opening: sky (high to hazy), `pyr` far pyramids [middle x, half width], far dunes, near dunes. */
const view = (x: number, y: number, pyr: readonly (readonly [number, number])[], phase: number): string => {
  // Far pyramids standing on the horizon, lit on their left.
  for (const [px, hw] of pyr) {
    const X = x + 0.5 - px;
    if (y < HORIZON && Math.abs(X) < hw - (HORIZON - y - 0.5)) return X < 0 ? "7" : "8";
  }
  const far = HORIZON + 1 + Math.round(2 * Math.sin((2 * Math.PI * x) / T + phase));
  const near = 86 + Math.round(4 * Math.sin((2 * Math.PI * x) / T + phase + 2.2));
  if (y >= near) {
    // The near dune: its crest lit, the slope facing the light bright, the other in shade, a ripple or two.
    const slope = Math.cos((2 * Math.PI * x) / T + phase + 2.2); // > 0: rising to the east (faces west, the light)
    if (y === near) return "4";
    if (y > near + 6 && (x * 2 + y * 3) % 17 === 0) return "5";
    return slope > 0.2 ? "4" : slope > -0.4 ? (bayer(x, y) < 0.5 ? "4" : "5") : "5";
  }
  if (y >= far) return y === far ? "4" : y > near - 3 ? "6" : "5";
  if (y >= HORIZON - 1) return "3";
  // The sky: blue up high, paling to the haze at the horizon (dithered).
  const t = (y - OPEN_TOP) / (HORIZON - OPEN_TOP);
  const th = bayer(x, y);
  if (t < 0.45) return t / 0.45 < th * 0.9 ? "1" : "2";
  return (t - 0.45) / 0.55 < th ? "2" : "3";
};
/** A plain block of the piers and the low wall: courses 8 tall, joints staggered; lit at `lit` (0 dark to 1 light). */
const ashlar = (x: number, y: number, lit: number, seed = 3): string => {
  const course = Math.floor(y / 8);
  if (y % 8 === 7) return "d";
  if ((x + course * 9) % 18 === 0) return "d";
  const g = grain(Math.floor((x + course * 9) / 18), course, seed);
  const l = lit + (g - 0.5) * 0.25;
  return l > 0.7 ? "a" : l > 0.35 ? "b" : "c";
};
/** The dado under the sill: a band of red, gold and blue paint across a course of blocks. */
const dado = (x: number, y: number): string => {
  const j = y - SILL;
  if (j === 0) return "a"; // the sill: lit lip, its face, its shadow
  if (j < 3) return "b";
  if (j === 3) return "c";
  if (j === 4) return "e";
  if (y >= WALL_H - 1) return "e";
  if (j >= 9 && j <= 14) return ["Y", "R", "R", "Y", "B", "B"][j - 9]! === "R" && j === 11 ? "r" : ["Y", "R", "R", "Y", "B", "N"][j - 9]!;
  return ashlar(x, j < 9 ? j + 3 : j - 15, 0.55, 5);
};
/** The back wall seen from inside, its top at y0. `pyr`: the far pyramids in its opening. */
function wallCv(c: Cv, y0: number, pyr: readonly (readonly [number, number])[], phase: number) {
  fill(c, (x, yy) => {
    const y = yy - y0;
    if (y < 0) return null;
    if (y === 0) return "k";
    if (y < CORNICE) return cornice(x, y);
    if (y >= SILL) return dado(x, y);
    // The piers: half of one on each side of the square (lit edge on the east half's west side, shade by the opening).
    if (x < OX0 || x > OX1) {
      if (x === OX1 + 1) return "a";
      if (x === OX0 - 1) return "d";
      return ashlar(x + 40, y, x > OX1 ? 0.65 : 0.4, 4);
    }
    if (y < OPEN_TOP) return y === OPEN_TOP - 1 ? "e" : ashlar(x + 40, y, 0.55, 4); // the lintel over the opening
    // The opening's reveals: its underside and west side in shade, its east side lit (it faces the light).
    if (y < OPEN_TOP + 2) return y === OPEN_TOP ? "d" : "c";
    if (x < OX0 + 2) return x === OX0 ? "d" : "c";
    if (x > OX1 - 2) return x === OX1 ? "b" : "a";
    return view(x, y, pyr, phase);
  });
}
export const SHOP_ALFIL_WALL = (() => {
  const c = cv(T, WALL_H);
  wallCv(c, 0, [[22, 10]], 0);
  return def("wall", [1, 1], T, WALL_H, [18, WALL_H - 1], [[whole(c)]]);
})();
/** The same wall, another view out: two far pyramids, the dunes a little turned (laid between the plain ones). */
export const SHOP_ALFIL_WALL_B = (() => {
  const c = cv(T, WALL_H);
  wallCv(c, 0, [[13, 13], [26, 7]], 1.3);
  return def("wall-b", [1, 1], T, WALL_H, [18, WALL_H - 1], [[whole(c)]]);
})();

/**
 * A papyrus column standing proud of the wall, from `top` to `foot`: a square abacus, a bell capital of blue and gold
 * petals, bands of red, gold and blue at its neck and near its foot, a round shaft lit on its left, a cartouche carved
 * down it, a round base.
 */
const column = (cx: number, top: number, foot: number) =>
  paint(cx - 12, top, 25, foot - top, (x, y) => {
    const X = x + 0.5 - cx - 0.5;
    const j = y - top;
    const lit = (hw: number) => (X < -hw * 0.45 ? "a" : X < hw * 0.25 ? "b" : X < hw * 0.75 ? "c" : "d");
    if (j < 5) return Math.abs(X) > 9.5 ? null : j === 0 ? "a" : j === 4 ? "d" : X > 6 ? "c" : "b"; // the abacus
    if (j < 24) {
      // The bell: widest at its lip, narrowing to the neck; petals by angle round it.
      const t = (j - 5) / 19;
      const hw = 11.5 - 6 * t * t;
      if (Math.abs(X) > hw) return null;
      if (j === 5) return X < 3 ? "y" : "Y";
      const p = Math.floor((X / hw) * 3.5 + 3.5);
      const edge = Math.abs((X / hw) * 3.5 + 3.5 - p - 0.5) > 0.38;
      if (edge) return "O";
      const blue = p % 2 === 0;
      const dark = X > hw * 0.45 || j > 20;
      return blue ? (dark ? "N" : X < -hw * 0.4 ? "I" : "B") : dark ? "O" : X < -hw * 0.4 ? "y" : "Y";
    }
    const hw = 5.5;
    const H = foot - top;
    if (j >= H - 6) {
      const bh = j >= H - 3 ? 8.5 : 7.5;
      if (Math.abs(X) > bh) return null;
      return j === H - 6 || j === H - 3 ? "a" : X > 4 ? "d" : "c";
    }
    if (Math.abs(X) > hw) return null;
    if (j < 31) return ["R", "Y", "B", "B", "Y", "R", "O"][j - 24] === "R" && X > 2 ? "r" : ["R", "Y", "B", "B", "Y", "R", "O"][j - 24] === "B" && X > 2 ? "N" : ["R", "Y", "B", "B", "Y", "R", "O"][j - 24]!;
    const band = j - (H - 22);
    if (band >= 0 && band < 6) return ["Y", "B", "Y", "R", "Y", "O"][band] === "B" && X > 2 ? "N" : ["Y", "B", "Y", "R", "Y", "O"][band] === "R" && X > 2 ? "r" : ["Y", "B", "Y", "R", "Y", "O"][band]!;
    // A cartouche carved down the shaft: an oval frame, marks inside.
    const cj = j - 38;
    if (cj >= 0 && cj < 40 && Math.abs(X) < 3.2) {
      const edge = Math.abs(X) > 2.2 || cj === 0 || cj === 39;
      if (edge) return "d";
      if (cj % 7 === 3 || (cj % 7 === 5 && Math.abs(X) < 1)) return "e";
    }
    return lit(hw);
  });

const PILLAR_UP = 20; // how far the column stands above the wall
export const SHOP_ALFIL_WALL_PILLAR = (() => {
  const h = WALL_H + PILLAR_UP;
  const c = cv(T, h);
  wallCv(c, PILLAR_UP, [[22, 10]], 0);
  return def("wall-pillar", [1, 1], T, h, [18, h - 1], [[whole(c), column(18, 1, h)]]);
})();

/**
 * The west wall, running away north, seen obliquely: each square's top shows the cornice's top, then a register of
 * painted carvings (faded red, blue and gold, cut outlines) over a ground line, a pier on its inner (east) edge; a column
 * of them reads as a carved wall going away, a procession of figures. `kind` 0: an elephant in his caparison under a row
 * of glyphs; 1: chess pieces (the old elephant piece, the alfil, beside the shah) with an ankh.
 */
const SIDE_REG = 33; // a register's height (the first is what shows of each square)
const ALFIL_PIECE = [
  "..e...e..",
  ".eHe.eHe.",
  ".eGGeGGe.",
  "eGGGGGGGe",
  "eGaGGGGGe",
  "eGaGGGGGe",
  ".eGGGGGe.",
  "..eGGGe..",
  ".eHHHHHe.",
  "..eGGGe..",
  "..eGGGe..",
  ".eGGGGGe.",
  "eGGGGGGGe",
  "eHHHHHHHe",
  "eeeeeeeee",
];
const SHAH_PIECE = [
  "....e....",
  "...eHe...",
  "..eeHee..",
  ".eFFFFFe.",
  ".eFaFFFe.",
  ".eFaFFFe.",
  "..eFFFe..",
  "..eFFFe..",
  ".eHHHHHe.",
  "..eFFFe..",
  "..eFFFe..",
  "..eFFFe..",
  ".eFFFFFe.",
  "eFFFFFFFe",
  "eHHHHHHHe",
  "eeeeeeeee",
];
const ANKH = [".eee.", "eHeHe", "eHeHe", ".eHe.", "eeHee", "HHHHH", "eeHee", ".eHe.", ".eHe.", ".eHe.", ".eee."];
const SUN_GLYPH = [".FFF.", "FFFFF", "FFHFF", "FFFFF", ".FFF."];
const WATER_GLYPH = ["G...G", ".G.G.", "..G..", "G...G", ".G.G."];
const MINI_ALFIL = [".H.H.", "eGGGe", "eGGGe", ".eGe.", "eGGGe", "eeeee"];
const ELEPHANT_SIDE = figure(27, 17, (i, j) => {
  const k = elephantAt(i, j);
  return k === null ? null : k === "eye" ? "e" : k === "tusk" ? "T" : k === "ear" ? "c" : k === "cloth" ? "F" : k === "trim" ? "H" : "d";
});
function register(c: Cv, y0: number, kind: number) {
  // The band over it (faded blue, gold), the ground line under it.
  for (let x = 0; x < T - 5; x++) {
    put(c, x, y0, "G");
    put(c, x, y0 + 1, "H");
    put(c, x, y0 + SIDE_REG - 3, "d");
  }
  if (kind === 0) {
    stamp(c, 3, y0 + 3, SUN_GLYPH);
    stamp(c, 12, y0 + 3, WATER_GLYPH);
    stamp(c, 21, y0 + 2, MINI_ALFIL);
    stamp(c, 3, y0 + 13, ELEPHANT_SIDE);
  } else {
    stamp(c, 3, y0 + 14, ALFIL_PIECE);
    stamp(c, 14, y0 + 13, SHAH_PIECE);
    stamp(c, 25, y0 + 18, ANKH);
    stamp(c, 3, y0 + 4, WATER_GLYPH);
    stamp(c, 13, y0 + 4, SUN_GLYPH);
    stamp(c, 23, y0 + 3, MINI_ALFIL);
  }
}
function sideCv(c: Cv, y0: number, kind: number) {
  const s = cv(T, WALL_H);
  fill(s, (x, y) => {
    if (y === 0) return "k";
    if (y === 1) return "a";
    if (y < 4) return x % 4 === 0 ? "c" : ["B", "Y", "R", "Y"][Math.floor(x / 4) % 4]!;
    if (y === 4) return "O";
    if (y >= SILL) return dado(x, y);
    if (x >= T - 5) return x === T - 5 ? "a" : x === T - 1 ? "c" : "b"; // the pier on its inner edge
    // The dressed stone, a little darker toward the far (outer) side.
    return x < 4 ? "b" : x < 6 && (x + y) % 2 === 0 ? "b" : "a";
  });
  for (let r = 0; r < 3; r++) register(s, 5 + r * SIDE_REG, (kind + r) % 2);
  fill(c, (x, yy) => {
    const y = yy - y0;
    return y < 0 ? null : s[y]![x]!;
  });
}
export const SHOP_ALFIL_WALL_SIDE = (() => {
  const c = cv(T, WALL_H);
  sideCv(c, 0, 0);
  return def("wall-side", [1, 1], T, WALL_H, [18, WALL_H - 1], [[whole(c)]]);
})();
export const SHOP_ALFIL_WALL_SIDE_B = (() => {
  const c = cv(T, WALL_H);
  sideCv(c, 0, 1);
  return def("wall-side-b", [1, 1], T, WALL_H, [18, WALL_H - 1], [[whole(c)]]);
})();
export const SHOP_ALFIL_WALL_SIDE_PILLAR = (() => {
  const h = WALL_H + PILLAR_UP;
  const c = cv(T, h);
  sideCv(c, PILLAR_UP, 0);
  return def("wall-side-pillar", [1, 1], T, h, [18, h - 1], [[whole(c), column(18, 1, h)]]);
})();

// ==== The front (south) wall: low sandstone, a painted band, and the way out.

const HEM_H = 22;
function hemCv(c: Cv, y0: number) {
  fill(c, (x, yy) => {
    const y = yy - y0;
    if (y < 0) return null;
    if (y === 0) return "k";
    if (y < 3) return y === 1 ? "a" : "b"; // its coping
    if (y === 3) return "d";
    if (y < 7) return ["Y", "R", "B"][y - 4]!; // a painted band
    if (y === 7) return "O";
    if (y >= HEM_H - 1) return "e";
    return ashlar(x, y - 8, 0.55, 7);
  });
}
export const SHOP_ALFIL_HEM = (() => {
  const c = cv(T, HEM_H);
  hemCv(c, 0);
  return def("hem", [1, 1], T, HEM_H, [18, HEM_H - 1], [[whole(c)]]);
})();
export const SHOP_ALFIL_HEM_PILLAR = (() => {
  const h = WALL_H + PILLAR_UP;
  const c = cv(T, h);
  hemCv(c, h - HEM_H);
  return def("hem-pillar", [1, 1], T, h, [18, h - 1], [[whole(c), column(18, 1, h)]]);
})();

/**
 * A winged sun disk: a gold disk with a red heart, two wings spreading level from it (gold coverts, a red row, long blue
 * feathers), drooping a little to their tips. `span`: each wing's reach from the middle.
 */
const wingedDisk = (cx: number, cy: number, span: number) =>
  paint(cx - span, cy - 8, 2 * span + 1, 17, (x, y) => {
    const X = x - cx;
    const Y = y + 0.5 - cy;
    const d = Math.hypot(X, Y);
    if (d < 3.6) return X + Y > 1.5 ? "r" : "R";
    if (d < 6.5) return X + Y < -3 ? "y" : X + Y > 4 ? "O" : "Y";
    const ax = Math.abs(X);
    if (ax < 6) return null;
    const t = (ax - 6) / (span - 6);
    const top = -5 + 3 * t;
    const bot = 6 - 6.5 * t * t;
    if (Y < top || Y > bot) return null;
    const k = (Y - top) / (bot - top);
    if (k < 0.12) return "y";
    if (k < 0.34) return ax % 2 === 0 ? "O" : "Y";
    if (k < 0.5) return "R";
    return ax % 3 === 0 ? "N" : Y > bot - 1 ? "N" : "B";
  });

/**
 * The entrance, two squares wide: a sandstone gateway of the pyramid (its jambs leaning in a little as they rise), a
 * fluted cornice over it with a winged sun disk on the lintel, and the bright day outside through it: pale sky, the
 * square's sand, a stone step. Plainly the way out.
 */
const EW = 2 * T;
const EH = 112;
const EFOOT = EH - 1;
const E_LINTEL = 44; // the opening's top
export const SHOP_ALFIL_ENTRANCE = (() => {
  const openHalf = (y: number) => 13 + (y - E_LINTEL) * 0.03;
  const outerHalf = (y: number) => 34 + (y / EH) * 3;
  const gate = paint(0, 0, EW, EH, (x, y) => {
    const X = x + 0.5 - EW / 2;
    if (y < 4) return null;
    // The cornice: overhanging the whole gate, flutes, a gold roll.
    if (y < 20) {
      if (Math.abs(X) > 36.5) return null;
      const j = y - 4;
      if (j === 0) return "a";
      if (j === 1) return "b";
      if (j < 11) {
        const fx = ((x % 5) + 5) % 5;
        if (fx === 0) return j > 8 ? "d" : "c";
        const col = ["B", "Y", "R", "Y"][Math.floor(x / 5) % 4]!;
        return j > 8 || fx === 4 ? ({ B: "N", Y: "O", R: "r" } as Record<string, string>)[col]! : col;
      }
      if (j < 13) return j === 11 ? "y" : "Y";
      if (j === 13) return "O";
      return Math.abs(X) > 35.5 ? null : j === 14 ? "e" : ashlar(x, j, 0.5, 9);
    }
    const oh = outerHalf(y);
    if (Math.abs(X) > oh) return null;
    if (y >= E_LINTEL && Math.abs(X) < openHalf(y)) return null; // the opening
    if (y >= EFOOT - 1) return "e";
    // The jambs' inner reveals (the west one in shade, the east one lit) and outer edges.
    if (y >= E_LINTEL && Math.abs(X) < openHalf(y) + 2) return X < 0 ? "d" : "a";
    if (y === E_LINTEL - 1 && Math.abs(X) < openHalf(y) + 2) return "e";
    if (Math.abs(X) > oh - 1.5) return X < 0 ? "a" : "d";
    // A painted band down each jamb, and the lintel's stone.
    if (y >= E_LINTEL + 4 && y < EFOOT - 8) {
      const bx = Math.abs(X) - openHalf(y) - 5;
      if (bx >= 0 && bx < 4) return ["Y", "R", "B", "Y"][Math.floor(bx)] === "R" && (y - E_LINTEL) % 10 === 0 ? "Y" : ["Y", "R", "B", "O"][Math.floor(bx)]!;
    }
    return ashlar(x + 3, y, X < 0 ? 0.7 : 0.45, 9);
  });
  const day = paint(0, E_LINTEL, EW, EFOOT - E_LINTEL, (x, y) => {
    const X = x + 0.5 - EW / 2;
    if (Math.abs(X) >= openHalf(y)) return null;
    if (y >= EFOOT - 6) return y === EFOOT - 6 ? "a" : y > EFOOT - 3 ? "c" : "b"; // the step
    const ground = 78 + Math.round(1.5 * Math.sin(x * 0.25));
    if (y >= ground) return y === ground ? "4" : (x * 3 + y * 5) % 23 === 0 ? "5" : y > EFOOT - 12 ? "p" : "4"; // the square's sand
    const t = (y - E_LINTEL) / (ground - E_LINTEL);
    return t < bayer(x, y) * 0.8 ? "2" : "3";
  }, false);
  const disk = wingedDisk(EW / 2, 31, 30);
  return def("entrance", [2, 1], EW, EH, [EW / 2, EFOOT], [[groundShadow(EW / 2, EFOOT - 1, 34, 3), day, gate, disk]]);
})();

// ==== The backdrop behind the counter: four squares of the wall, a carved shrine of shelves full of relics under a winged sun disk.

const BDW = 4 * T;
const BDH = WALL_H + PILLAR_UP;
/** A papyrus scroll lying on its side, `w` long: a cream roll lit on top, its rolled ends showing, a red tie. */
const scroll = (c: Cv, x: number, y: number, w: number, tie = "R") => {
  stamp(c, x, y, ["s" + "u".repeat(w - 2) + "s", "t" + "t".repeat(w - 2) + "s", "s" + "s".repeat(w - 2) + "s"].map((r, j) => r));
  put(c, x + Math.floor(w / 2), y, tie);
  put(c, x + Math.floor(w / 2), y + 1, tie);
  put(c, x + Math.floor(w / 2), y + 2, tie === "R" ? "r" : "N");
  put(c, x, y + 1, "e");
  put(c, x + w - 1, y + 1, "e");
};
/** A jar w wide, h tall: a round body in `ramp` (light, mid, dark), a rim, a painted band. */
const jar = (c: Cv, x: number, y: number, w: number, h: number, ramp: string, band = "") => {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const X = (i + 0.5 - w / 2) / (w / 2);
      const t = j / (h - 1);
      if (j < 2) {
        if (Math.abs(X) < 0.55) put(c, x + i, y + j, j === 0 ? ramp[0]! : ramp[2]!);
        continue;
      }
      const half = j === 2 ? 0.5 : Math.sin(Math.PI * Math.min(1, (t - 0.05) * 1.1 + 0.15)) * 1.02;
      if (Math.abs(X) > half) continue;
      const k = band && j === Math.round(h * 0.45) ? band : X < -0.35 ? ramp[0]! : X > 0.4 ? ramp[2]! : ramp[1]!;
      put(c, x + i, y + j, k);
    }
};
export const SHOP_ALFIL_BACKDROP = (() => {
  const c = cv(BDW, BDH);
  const w1 = cv(T, WALL_H);
  wallCv(w1, 0, [[22, 10]], 0);
  const w2 = cv(T, WALL_H);
  wallCv(w2, 0, [[13, 13], [26, 7]], 1.3);
  fill(c, (x, y) => (y < PILLAR_UP ? null : (Math.floor(x / T) % 2 ? w2 : w1)[y - PILLAR_UP]![x % T]!));
  // The shrine: a framed niche of three shelves, posts painted in his colors, a cornice over it.
  const S0 = 16;
  const S1 = BDW - 17;
  const STOP = 50; // the shrine's cornice top
  const SHELF = [86, 114, 142];
  const shrine = paint(S0 - 3, STOP, S1 - S0 + 7, BDH - STOP, (x, y) => {
    const j = y - STOP;
    if (j < 12) {
      // Its cornice, a little wider than the shrine: flutes and a gold roll.
      if (j === 0) return "a";
      if (j < 8) {
        const fx = x % 5;
        if (fx === 0) return j > 5 ? "d" : "c";
        const col = ["B", "Y", "R", "Y"][Math.floor(x / 5) % 4]!;
        return j > 5 || fx === 4 ? ({ B: "N", Y: "O", R: "r" } as Record<string, string>)[col]! : col;
      }
      return j < 10 ? (j === 8 ? "y" : "Y") : "O";
    }
    if (x < S0 || x > S1) return null;
    // The posts: gold rolls on their edges, bands of red and blue down them.
    if (x < S0 + 7 || x > S1 - 7) {
      const i = x < S0 + 7 ? x - S0 : S1 - x;
      if (i === 0) return x < S0 + 7 ? "y" : "O";
      if (i === 6) return "O";
      if (i === 1) return "Y";
      const band = Math.floor((j - 12) / 6) % 3;
      return (j - 12) % 6 === 5 ? "O" : ["R", "B", "Y"][band] === "R" ? (i > 3 ? "r" : "R") : ["R", "B", "Y"][band] === "B" ? (i > 3 ? "N" : "B") : i > 3 ? "O" : "Y";
    }
    for (const s of SHELF) if (y >= s && y < s + 4) return y === s ? "a" : y === s + 3 ? "e" : "b"; // the shelves
    // The niche's back, in shade under each shelf.
    const under = SHELF.some((s) => y > s + 3 && y < s + 7) || (y > STOP + 11 && y < STOP + 15);
    return under ? "d" : (x + y) % 23 === 0 ? "d" : "c";
  });
  const things = cv(BDW, BDH);
  const s0 = SHELF[0]!;
  // Top shelf: a stack of scrolls, a gold elephant head, canopic jars, a gold ankh, a stack of scrolls.
  scroll(things, 25, s0 - 3, 14);
  scroll(things, 27, s0 - 6, 12, "B");
  scroll(things, 26, s0 - 9, 13);
  jar(things, 43, s0 - 12, 8, 12, "aca", "B");
  stamp(things, 56, s0 - 17, [
    "...yyYYY...",
    ".yyYYYYYYO.",
    "yYYYkYkYYYO",
    "yYYYYYYYYYO",
    "yYYYyYYYYYO",
    ".YYOyYYOYO.",
    "..T.yYO.T..",
    "..T.yYO.T..",
    "...TyYOT...",
    "....yYO....",
    "...YyYO....",
    "...OOO.....",
    "..yYYYYO...",
    ".OOOOOOOO..",
  ].map((r) => r.replace(/k/g, "N")));
  stamp(things, 66, s0 - 13, [".yY.", "y..O", "y..O", ".yO.", "yYYO", ".yO.", ".yO.", ".yO.", ".YO.", "YYOO"]);
  jar(things, 72, s0 - 11, 7, 11, "IBN", "Y");
  jar(things, 81, s0 - 12, 8, 12, "aca", "R");
  stamp(things, 90, s0 - 8, ["..yy..", ".yYYO.", "yYYYYO", "yYCYYO", "yYYYYO", ".OOOO.", "..OO..", ".OOOO."]);
  scroll(things, 99, s0 - 3, 14);
  scroll(things, 101, s0 - 6, 11);
  jar(things, 116, s0 - 10, 7, 10, "yYO");
  // Middle shelf: a rack of scrolls (their ends in a lattice), a row of chess pieces in gold and blue.
  const s1 = SHELF[1]!;
  for (let r = 0; r < 3; r++)
    for (let q = 0; q < 5; q++) stamp(things, 25 + q * 5, s1 - 16 + r * 5, ["eWWe", "Wuts", "Wtss", "esse"]);
  const pieces: [number, string][] = [[54, "Y"], [62, "B"], [70, "Y"], [78, "B"], [86, "Y"]];
  for (const [px, col] of pieces) {
    const [l, m, d] = col === "Y" ? ["y", "Y", "O"] : ["I", "B", "N"];
    stamp(things, px, s1 - 12, [`.${m}.${m}.`, `${l}${m}${m}${m}${d}`, `${l}${m}${m}${m}${d}`, `.${l}${m}${d}.`, `.${l}${m}${d}.`, `.${l}${m}${d}.`, `${l}${m}${m}${m}${d}`, `${l}${m}${m}${m}${d}`, `${d}${d}${d}${d}${d}`]);
  }
  for (let r = 0; r < 3; r++)
    for (let q = 0; q < 5; q++) stamp(things, 98 + q * 5, s1 - 16 + r * 5, ["eWWe", "Wuts", "Wtss", "esse"]);
  // Bottom shelf: a folded cloth in his red and blue, a gold bowl of gems, a casket, jars.
  const s2 = SHELF[2]!;
  stamp(things, 24, s2 - 9, ["RRRRRRRRRRRR", "RYRRYRRYRRYr", "BBBBBBBBBBBN", "RRRRRRRRRRRr", "YYYYYYYYYYYO", "BBBBBBBBBBBN", "RRRRRRRRRRRr", "rrrrrrrrrrrr", "YOYOYOYOYOYO"]);
  stamp(things, 40, s2 - 8, ["..R.C.D.B..", ".DCRyBRCyR.", "yYYYYYYYYYO", ".yYYYYYYYO.", "..OOOOOOO..", "...OOOOO...", "..OOOOOOO.."]);
  jar(things, 55, s2 - 13, 9, 13, "aca", "R");
  stamp(things, 67, s2 - 12, ["yYYYYYYYYYYYO", "BBBBBBBBBBBBN", "yYYYYYYYYYYYO", "wVVVVYVVVVVVW", "wVVVYCYVVVVVW", "wVVVVYVVVVVVW", "wVVVVVVVVVVVW", "yYYYYYYYYYYYO", "wwwwwwwwwwwwW", "O..........O", "O..........O", "O..........O"].map((r) => r));
  jar(things, 84, s2 - 10, 7, 10, "IBN", "Y");
  jar(things, 93, s2 - 13, 9, 13, "yYO", "R");
  stamp(things, 105, s2 - 6, ["...TT", "..TSM", ".TSM.", "TSM..", "SM...", "M...."]);
  jar(things, 113, s2 - 11, 8, 11, "aca", "B");
  const disk = wingedDisk(BDW / 2, 37, 58);
  return def("backdrop", [4, 1], BDW, BDH, [BDW / 2, BDH - 1], [[whole(c), shrine, cropBit(things)!, disk]]);
})();

// ==== The counter: a sandstone counter, low (the kid shows over it), gold-trimmed, his cloth hung at its ends.

const CW = 4 * T;
const CH = 44; // its picture (things on its top stand above it)
const CFOOT = CH - 3;
const CTOP = 12; // the top's upper edge: the counter itself is 30 px tall
/** The plaque on its front (blank: the game writes on it). */
const PLQ = { x: 43, y: CTOP + 9, w: 62, h: 17 } as const;
export const SHOP_ALFIL_COUNTER_SIGN = signFace(PLQ.x, PLQ.y, PLQ.w, PLQ.h);
/** Where the crate stands on the counter: its foot, in the counter's pixels (on the right, clear of the plaque). */
export const SHOP_ALFIL_CRATE_AT: Pt = [122, CTOP + 3];
const CRATE_AT: Pt = SHOP_ALFIL_CRATE_AT;
export const SHOP_ALFIL_COUNTER = (() => {
  const body = paint(2, CTOP, CW - 4, CFOOT - CTOP, (x, y) => {
    const j = y - CTOP;
    const i = x - 2;
    const n = CW - 4;
    const fb = CFOOT - CTOP;
    // The top: a polished slab seen a little from above, its front edge.
    if (j < 4) return j === 0 ? "a" : j === 3 ? "c" : i < 3 ? "a" : "b";
    if (j === 4) return "d";
    if (j === 5 || j === 6) return j === 5 ? "y" : "O"; // a gold trim under the slab
    if (j >= fb - 3) return j === fb - 3 ? "b" : i > n - 3 ? "d" : "c"; // the plinth
    if (j === 7) return "d"; // the trim's shadow
    // The front: dressed blocks, lit on the left, a carved frame line round a panel.
    if (i > n - 3) return "d";
    if (i < 2) return "a";
    if ((i - 2) % 34 === 0) return "c";
    return j === 8 ? "c" : "b";
  });
  const plaque = signBoard(PLQ.x, PLQ.y, PLQ.w, PLQ.h, "PObY".replace("b", "Y").slice(0, 2) + "Yy", "stu", "R");
  // His cloth hung over each end: red with a blue border, gold diamonds, a gold fringe.
  const cloth = (x0: number) =>
    paint(x0, CTOP + 3, 26, 26, (x, y) => {
      const i = x - x0;
      const j = y - (CTOP + 3);
      const foot = 22 - Math.abs(i - 12.5) * 0.25;
      if (j > foot + 3) return null;
      if (j > foot) return i % 2 ? "Y" : "O"; // the fringe
      if (j < 2) return j === 0 ? "a" : "c"; // over the slab's edge
      if (i < 2 || i > 23 || j > foot - 3) return i > 23 || j === Math.floor(foot) ? "N" : "B";
      const d = Math.abs(i - 12.5) + Math.abs(j - 11.5);
      if (d < 2) return "y";
      if (d < 4) return "Y";
      if (d < 5) return "O";
      if (j === 4 || j === 18) return "Y";
      return i > 19 ? "r" : "R";
    });
  // On its left end: stacks of gold coins (it's a shop), a scroll.
  const on = cv(CW, CH);
  stamp(on, 9, CTOP - 9, [
    "yYYYO.......",
    "OOPOO.......",
    "yYYYO.yYYYO.",
    "OOPOO.OOPOO.",
    "yYYYO.yYYYO.",
    "OOPOO.OOPOO.",
    "yYYYOyYYYOO.",
    "OOPOOOOPOOO.",
  ]);
  stamp(on, 21, CTOP - 2, ["yYYO", "OOPO"]);
  scroll(on, 26, CTOP - 3, 11);
  return def("counter", [4, 1], CW, CH, [CW / 2, CFOOT], [[groundShadow(CW / 2, CFOOT, CW / 2 - 2, 4), body, plaque, cloth(6), cloth(CW - 32), cropBit(on)!]]);
})();

/**
 * Alfil's Boss Crate: a cedar casket with a vaulted blue lid banded in gold, gold corners, a band of his red set with blue
 * squares across its front, a gold scarab on the band, a little gold elephant standing on the lid. `idle`: a glint runs
 * along the lid's gold edge and winks on the elephant (6 frames), so it reads as the thing you buy.
 */
const XW = 30;
const XH = 27;
export const SHOP_ALFIL_CRATE = (() => {
  const box = paint(1, 12, 28, 13, (x, y) => {
    const i = x - 1;
    const j = y - 12;
    const corner = (i < 4 || i > 23) && (j < 3 || j > 9);
    if (corner) return i < 2 || j < 1 ? "y" : i > 25 || j > 11 ? "O" : "Y";
    if (j >= 4 && j <= 8) {
      if (j === 4 || j === 8) return "Y";
      return (i + 1) % 6 < 2 ? (j === 6 ? "B" : "N") : i > 24 ? "r" : "R";
    }
    if (j === 12) return "W";
    return i < 2 ? "V" : i > 25 ? "W" : (i + j * 3) % 9 === 0 ? "W" : "w";
  });
  const lid = paint(1, 5, 28, 8, (x, y) => {
    const i = x - 1;
    const j = y - 5;
    const X = Math.abs(i + 0.5 - 14);
    const top = 3.5 * (X / 14) ** 2;
    if (j < top) return null;
    if (j > 5) return j === 6 ? "y" : "O"; // its gold rim
    if (Math.abs(i - 13.5) < 1 || i === 4 || i === 23) return "Y"; // gold bands over it
    return i < 6 && j < 4 ? "I" : i > 21 ? "N" : "B";
  });
  const feet = paint(2, 25, 26, 2, (x) => (x < 5 || x > 24 ? "O" : null));
  const top = cv(XW, XH);
  stamp(top, 10, 1, ["...yyYYYY..", ".yyYYYYYYYO", "yYOOYYYYYYO", "yPOOYYYYYYO", "yY.OYYYYYOO", "yY.yYO.yYO.", "O..OO..OO.."]);
  stamp(top, 12, 17, [".yy.", "yYYO", ".OO."]);
  const frames = [0, 1, 2, 3, 4, 5].map((f) => {
    const g = cv(XW, XH);
    const gx = [-9, 3, 9, 15, 21, -9][f]!;
    if (gx > 0) stamp(g, gx, 9, [".v.", "vvv", ".v."]);
    if (f === 5) stamp(g, 13, 1, [".v.", "vvv", ".v."]);
    return [groundShadow(XW / 2, XH - 2, 13, 2), box, lid, feet, cropBit(top)!, ...(cropBit(g, false) ? [cropBit(g, false)!] : [])];
  });
  return def("crate", [1, 1], XW, XH, [XW / 2, XH - 2], frames, 220);
})();

// ==== The props.

/** A shade by how far across a round form `X` (-1 its left edge to 1 its right): lit on the left. `ramp` light to dark (4). */
const roundTone = (X: number, ramp: string) => ramp[X < -0.55 ? 0 : X < 0.15 ? 1 : X < 0.7 ? 2 : 3]!;
const SAND4 = "abcd";

/**
 * The elephant statue, the room's landmark, two squares wide and 172 px tall: the alfil, the old elephant chess piece, as
 * a great carved piece in sandstone on a fluted plinth. A turned base of rings banded in gold, a body draped in his red
 * caparison (blue border, gold diamonds, a gold fringe), a gold collar, and for its head Alfil's own, front on: fanned
 * ears, his Nettipattam on his brow, ivory tusks, the trunk hanging down over the cloth and curling at its tip.
 */
const ESW = 2 * T;
const ESH = 174;
const ESF = ESH - 4;
export const SHOP_ALFIL_ELEPHANT_STATUE = (() => {
  const cx = ESW / 2;
  const X_ = (x: number) => x + 0.5 - cx;
  const plinth = paint(0, 118, ESW, ESF - 118 + 1, (x, y) => {
    const X = X_(x);
    if (y < 126) {
      if (Math.abs(X) > 31) return null;
      const j = y - 118; // the top slab, its edge fluted in his colors
      if (j === 0) return "a";
      if (j < 6) return x % 4 === 0 ? (j > 4 ? "d" : "c") : (["B", "Y", "R", "Y"][Math.floor(x / 4) % 4]! + (j > 4 ? "" : "")).replace(/./, (k) => (j > 4 ? ({ B: "N", Y: "O", R: "r" } as Record<string, string>)[k]! : k));
      return j === 6 ? "y" : "O";
    }
    if (y < 158) {
      if (Math.abs(X) > 27) return null;
      // The block: a gold-framed panel on its face, an elephant walking in it under a band of glyph marks.
      const i = x - (cx - 27);
      const j = y - 126;
      if (j < 2) return "d";
      if (i >= 5 && i < 49 && j >= 4 && j < 29) {
        const pi = i - 5;
        const pj = j - 4;
        if (pi === 0 || pj === 0) return "y";
        if (pi === 43 || pj === 24) return "O";
        if (pi === 1 || pj === 1 || pi === 42 || pj === 23) return "Y";
        const e = elephantAt((pi - 8 + 0.5) * 1.05, pj - 4 + 0.5);
        if (e) return e === "cloth" ? "R" : e === "trim" ? "Y" : e === "tusk" ? "T" : e === "eye" ? "x" : e === "ear" ? "e" : "d";
        if (pj < 5 && pi > 30 && pi % 4 === 1) return "e";
        return "b";
      }
      return X < -20 ? "a" : X > 22 ? "c" : "b";
    }
    if (Math.abs(X) > 33) return null;
    const j = y - 158; // the bottom step
    if (j === 0) return "a";
    if (y >= ESF) return "e";
    return ashlar(x, j - 1, X < 0 ? 0.65 : 0.4, 13);
  });
  const rings = paint(cx - 25, 104, 50, 14, (x, y) => {
    const X = X_(x);
    const j = y - 104;
    const hw = j < 3 ? 17 : j < 6 ? 19.5 : j < 9 ? 21 : 24;
    if (Math.abs(X) > hw) return null;
    if (j >= 6 && j < 9) return roundTone(X / hw, "yYOO"); // a gold band
    if (j === 0 || j === 3 || j === 9) return roundTone(X / hw, "aabc");
    return roundTone(X / hw, SAND4);
  });
  const body = paint(cx - 19, 60, 38, 45, (x, y) => {
    const X = X_(x);
    const j = y - 60;
    if (j < 5) return Math.abs(X) > 16.5 ? null : roundTone(X / 16.5, j === 0 ? "yyYO" : "yYOP"); // the gold collar
    const hw = 14.5 + (j - 5) * 0.1;
    if (Math.abs(X) > hw) return null;
    return roundTone(X / hw, SAND4);
  });
  const cloth = paint(cx - 13, 66, 26, 38, (x, y) => {
    const X = X_(x);
    const j = y - 66;
    const foot = 31 - Math.abs(X) * 0.9;
    if (j > foot + 3) return null;
    if (j > foot) return x % 2 ? "Y" : "O"; // the fringe
    if (Math.abs(X) > 12.2) return null;
    if (Math.abs(X) > 10 || j > foot - 2.5) return X > 0 ? "N" : "B";
    const dx = Math.abs(X);
    const row = (j + 3) % 9;
    const diam = Math.abs(dx - 5.5) + Math.abs(row - 4) < 3;
    if (diam) return Math.abs(dx - 5.5) + Math.abs(row - 4) < 1.5 ? "y" : "Y";
    return X > 5 ? "r" : "R";
  });
  // The head: ears behind, the dome, the brow's Nettipattam, eyes.
  const ears = paint(0, 18, ESW, 44, (x, y) => {
    const X = X_(x);
    for (const s of [-1, 1]) {
      const ex = (X - s * 20) / 12;
      const ey = (y + 0.5 - 38) / 17;
      const d = Math.hypot(ex, ey);
      if (d < 1) {
        if (d > 0.82) return s < 0 ? (ey < 0 ? "a" : "c") : "d";
        return (s < 0 ? ex < 0.3 : ex < -0.5) ? "b" : "c";
      }
    }
    return null;
  });
  const head = paint(cx - 15, 14, 30, 50, (x, y) => {
    const X = X_(x);
    const Y = y + 0.5 - 36;
    const d = Math.hypot(X / 14, Y / 19);
    if (d > 1) return null;
    if (Math.hypot(Math.abs(X) - 8, Y - 3) < 1.6) return Math.abs(X) - 8 < 0 && Y - 3 < 0 ? "y" : "x"; // eyes (gold inlaid)
    return roundTone(X / 14 - (Y < -12 ? 0.25 : 0), SAND4);
  });
  const nett = paint(cx - 10, 21, 21, 26, (x, y) => {
    const X = X_(x);
    const j = y - 21;
    const hw = 9 - j * 0.38;
    if (hw < 0.5 || Math.abs(X) > hw) return null;
    if (Math.abs(X) > hw - 1.5 || j < 1.5) return "Y";
    if (Math.abs(X) > hw - 3) return X > 0 ? "N" : "B";
    if ((j - 4) % 6 === 0 && Math.abs(X) < hw - 3) return "y"; // gold bosses
    return X > 2 ? "r" : "R";
  });
  const tassels = paint(cx - 12, 44, 25, 7, (x, y) => {
    const X = Math.abs(X_(x));
    return (Math.abs(X - 5) < 1 || Math.abs(X - 10) < 1) && y - 44 < (X > 7 ? 6 : 5) ? (y - 44 > 3 ? "O" : "Y") : null;
  });
  const tusk = (s: number) =>
    paint(cx - 22, 52, 44, 32, (x, y) => {
      const X = X_(x) * s;
      const t = (y - 52) / 28;
      if (t < 0 || t > 1) return null;
      const tx = 6 + 11 * t ** 1.4;
      const w = 2.4 - t * 1.4;
      if (Math.abs(X - tx) > w) return null;
      return X - tx < -0.6 * w ? "T" : X - tx > 0.5 * w ? "M" : "S";
    });
  const trunk = paint(cx - 12, 42, 24, 58, (x, y) => {
    const X = X_(x);
    const j = y - 42;
    const tx = j > 42 ? (j - 42) ** 1.3 * 0.6 : 0;
    const hw = 5.2 - j * 0.045;
    if (j > 52) {
      // The tip, curling out to the right.
      const d = Math.hypot(X - 5, y + 0.5 - 92);
      if (d < 4.8 && d > 1.8 && !(X < 5 && y < 92)) return d > 3.8 ? "c" : "b";
      return null;
    }
    if (Math.abs(X - tx) > hw) return null;
    if (j % 5 === 0 && j > 6 && Math.abs(X - tx) < hw - 1) return "c"; // the trunk's folds
    return roundTone((X - tx) / hw, SAND4);
  });
  return def("elephant-statue", [2, 1], ESW, ESH, [cx, ESF], [
    [groundShadow(cx, ESF - 1, 35, 4), plinth, rings, body, cloth, ears, head, nett, tassels, tusk(-1), tusk(1), trunk],
  ]);
})();

/**
 * The pharaoh statue, one square, 144 px tall: a king of the old land with an elephant's head, standing on a plinth: a
 * nemes headdress striped in his blue and gold, ivory tusks, his trunk down over a broad collar of gold, red and blue,
 * arms crossed holding the crook and flail, a white kilt with a gold belt and striped apron.
 */
const PHW = 44;
const PHH = 146;
const PHF = PHH - 3;
export const SHOP_ALFIL_PHARAOH_STATUE = (() => {
  const cx = PHW / 2;
  const X_ = (x: number) => x + 0.5 - cx;
  const plinth = paint(cx - 16, 122, 32, PHF - 122 + 1, (x, y) => {
    const X = X_(x);
    const j = y - 122;
    if (j < 2) return j === 0 ? "a" : "b";
    if (j === 2) return "d";
    if (j >= 5 && j < 8) return ["Y", "R", "B"][j - 5] === "R" ? (X > 10 ? "r" : "R") : ["Y", "R", "B"][j - 5] === "B" ? (X > 10 ? "N" : "B") : "Y";
    if (y >= PHF) return "e";
    return X < -10 ? "a" : X > 10 ? "c" : "b";
  });
  const legs = paint(cx - 8, 100, 16, 22, (x, y) => {
    const X = X_(x);
    const j = y - 100;
    for (const s of [-1, 1]) {
      const lx = s * 3.5 + (s > 0 ? j * 0.05 : 0);
      if (Math.abs(X - lx) < 2.6) return j > 18 ? (Math.abs(X - lx) < 3 ? "c" : null) : roundTone((X - lx) / 2.6, SAND4);
    }
    if (j > 18 && Math.abs(X) < 7.5) return j === 19 ? "b" : "c"; // the feet
    return null;
  });
  const kilt = paint(cx - 10, 78, 20, 24, (x, y) => {
    const X = X_(x);
    const j = y - 78;
    const hw = 7.5 + j * 0.1;
    if (Math.abs(X) > hw) return null;
    if (j < 3) return j === 1 ? "y" : "Y"; // the belt
    // The apron down the front: stripes of gold and blue, a point at its foot.
    if (Math.abs(X) < 3.5 - (j > 17 ? (j - 17) * 0.6 : 0) && j < 22) return Math.floor(j / 2) % 2 ? "B" : "Y";
    return X > hw - 2.5 ? "s" : x % 3 === 0 ? "t" : "u";
  });
  const torso = paint(cx - 14, 44, 28, 35, (x, y) => {
    const X = X_(x);
    const j = y - 44;
    const hw = j < 4 ? 10 + j : 13.5 - (j - 4) * 0.17; // broad shoulders, tapering to the waist
    if (Math.abs(X) > hw) return null;
    return roundTone(X / hw, SAND4);
  });
  const collar = paint(cx - 13, 44, 26, 16, (x, y) => {
    const X = X_(x);
    const d = Math.hypot(X / 13, (y + 0.5 - 44) / 14);
    if (d > 1 || y < 45) return null;
    const band = Math.floor((1 - d) * 6);
    return (["Y", "R", "B", "Y", "R", "B", "y"][band] ?? "y") === "B" && X > 6 ? "N" : ["Y", "R", "B", "Y", "R", "B", "y"][band] ?? "y";
  });
  /** The headcloth: striped blue and gold, wide over the ears, its two lappets hanging in front of the shoulders. */
  const stripes = (X: number, j: number) => (Math.floor(j / 2) % 2 ? (X > 5 ? "N" : "B") : X > 5 ? "O" : "Y");
  const nemes = paint(cx - 15, 12, 30, 46, (x, y) => {
    const X = X_(x);
    const j = y - 12;
    if (j < 22) {
      const hw = j < 10 ? 9 + j * 0.45 : 13.5 + (j - 10) * 0.1;
      if (Math.abs(X) > hw) return null;
      return j === 0 ? "y" : stripes(X, j);
    }
    // The lappets.
    const ax = Math.abs(X);
    if (ax < 6.5 || ax > 12.5 - (j - 22) * 0.06) return null;
    if (j > 43) return null;
    return j === 43 ? "O" : stripes(X, j);
  });
  // Arms crossed on the chest, the crook (gold and blue) and the flail held up against the shoulders.
  const arms = paint(cx - 14, 30, 28, 40, (x, y) => {
    const X = X_(x);
    const j = y - 30;
    if (j >= 29 && j <= 34) return Math.abs(X) < 12 ? (j === 29 ? "a" : j === 34 ? "d" : roundTone(X / 12, "abcc")) : null; // the crossed forearms
    if (j >= 28 && j <= 35 && Math.abs(Math.abs(X) - 3) < 2.2) return "b"; // the fists
    // The crook, up against his left (our right) shoulder, its hook curling out at the top.
    const ck = X - 4 - (31 - j) * 0.12;
    if (j > 10 && j < 34 && Math.abs(ck) < 1.2) return j % 4 < 2 ? "Y" : "B";
    const hk = Math.hypot(X - 9.5, j - 11);
    if (j <= 11 && hk < 3.6 && hk > 1.9) return j % 2 ? "Y" : "B";
    // The flail, up against his right (our left) shoulder: a handle and three strands falling outward.
    const fl = X + 4 + (31 - j) * 0.12;
    if (j > 12 && j < 34 && Math.abs(fl) < 1.2) return j % 4 < 2 ? "Y" : "O";
    if (j >= 9 && j <= 20 && [-7, -9, -11].some((sx) => Math.abs(X - sx + (j - 12) * 0.25) < 0.7)) return j % 3 ? "Y" : "R";
    return null;
  });
  const face = paint(cx - 9, 20, 18, 26, (x, y) => {
    const X = X_(x);
    const Y = y + 0.5 - 32;
    if (Y < -9 && Math.abs(X) < 9) return Y < -10.5 ? "Y" : "O"; // the headband
    const d = Math.hypot(X / 8, Y / 11);
    if (d > 1 || Y < -10.5) return null;
    if (Math.hypot(Math.abs(X) - 4, Y + 2) < 1.2) return "x";
    return roundTone(X / 8, SAND4);
  });
  const uraeus = paint(cx - 2, 15, 4, 6, (x, y) => (Math.abs(X_(x)) < (y < 17 ? 1 : 2) ? (y < 17 ? "R" : "y") : null));
  const tusks = paint(cx - 9, 40, 18, 12, (x, y) => {
    const X = Math.abs(X_(x));
    const t = (y - 40) / 10;
    const tx = 4 + 4 * t * t;
    return t >= 0 && t <= 1 && Math.abs(X - tx) < 1.4 - t * 0.6 ? (X_(x) < 0 ? "T" : "S") : null;
  });
  const trunk = paint(cx - 5, 38, 10, 26, (x, y) => {
    const X = X_(x);
    const j = y - 38;
    const tx = j > 18 ? (j - 18) * 0.4 : 0;
    const hw = 3.4 - j * 0.05;
    if (Math.abs(X - tx) > hw) return null;
    if (j % 4 === 3 && Math.abs(X - tx) < hw - 1) return "c";
    return roundTone((X - tx) / hw, SAND4);
  });
  return def("pharaoh-statue", [1, 1], PHW, PHH, [cx, PHF], [
    [groundShadow(cx, PHF - 1, 17, 3), plinth, legs, kilt, torso, collar, nemes, face, uraeus, tusks, trunk, arms],
  ]);
})();

/**
 * A model of the pyramid in gold, one square, 62 px tall: Alfil's stepped pyramid small, its tiers lit on the left, a
 * bright capstone, on a red cushion on a little stand of dark wood with gold feet. `idle`: the capstone glints.
 */
const PMW = 40;
const PMH = 62;
const PMF = PMH - 3;
export const SHOP_ALFIL_PYRAMID_MODEL = (() => {
  const cx = PMW / 2;
  const stand = paint(cx - 14, 36, 28, PMF - 36 + 1, (x, y) => {
    const X = x + 0.5 - cx;
    const j = y - 36;
    if (j < 4) return Math.abs(X) > 13.5 ? null : j === 0 ? "V" : j === 3 ? "W" : "w"; // the top
    if (Math.abs(X) > 12) return null;
    if (j < 7) return j === 4 ? "Y" : null; // a gold apron
    if (Math.abs(Math.abs(X) - 10) < 1.6) return y > PMF - 3 ? "Y" : X < 0 ? "w" : "W"; // legs, gold feet
    if (j === 14) return "w"; // a stretcher
    return null;
  });
  const cushion = paint(cx - 13, 31, 26, 6, (x, y) => {
    const X = x + 0.5 - cx;
    const j = y - 31;
    if (Math.abs(X) > 12.5 - (j === 0 || j === 5 ? 1 : 0)) return null;
    if (Math.abs(Math.abs(X) - 12) < 1 && j > 3) return "Y"; // tassels
    return j < 2 ? "R" : j === 5 ? "r" : X > 7 ? "r" : "R";
  });
  const pyramid = paint(cx - 12, 8, 24, 25, (x, y) => {
    const X = x + 0.5 - cx;
    const j = 32 - y; // height above the cushion
    const tier = Math.floor(j / 5);
    const hw = 11.5 - tier * 2.3;
    if (j < 0 || Math.abs(X) > hw) return null;
    if (tier >= 4) return null;
    const r = 4 - (j % 5);
    if (r === 0) return X < hw * 0.3 ? "y" : "Y"; // each tier's lit ledge
    return X < -hw * 0.3 ? "y" : X < hw * 0.35 ? "Y" : "O";
  });
  const cap = paint(cx - 4, 6, 8, 8, (x, y) => {
    const X = x + 0.5 - cx;
    const j = y - 6; // narrow at its point, widening down to sit on the top tier
    if (Math.abs(X) > j * 0.5 + 0.2) return null;
    return X < 0 ? "v" : "y";
  });
  const frames = [0, 1, 2, 3].map((f) => {
    const g = cv(PMW, PMH);
    if (f === 1) stamp(g, cx - 1, 9, ["v"]);
    if (f === 2) stamp(g, cx - 2, 7, [".v.", "vvv", ".v."]);
    return [groundShadow(cx, PMF - 1, 15, 3), stand, cushion, pyramid, cap, ...(cropBit(g, false) ? [cropBit(g, false)!] : [])];
  });
  return def("pyramid-model", [1, 1], PMW, PMH, [cx, PMF], frames, 300);
})();

/**
 * A low table of relics, two squares wide, 62 px tall: a dark wood table with gold feet and a red cloth runner; on it a
 * tall gold jar, a gold ankh set with turquoise, a great blue scarab with gold legs, a bowl heaped with gems, a small
 * alabaster jar. `idle` (8 frames): a glint travels across them one by one.
 */
const RLW = 2 * T;
const RLH = 62;
const RLF = RLH - 3;
export const SHOP_ALFIL_RELICS = (() => {
  const TOPY = 40;
  const table = paint(3, TOPY, RLW - 6, RLF - TOPY + 1, (x, y) => {
    const i = x - 3;
    const j = y - TOPY;
    const n = RLW - 6;
    if (j < 4) return j === 0 ? "V" : j === 3 ? "W" : "w";
    if (j < 9 && i > 6 && i < n - 7) return j === 4 ? "R" : j < 8 ? ((i % 6) < 3 ? "R" : "r") : "Y"; // the runner's hang, a gold fringe
    if (i < 4 || i > n - 5) return y > RLF - 3 ? "Y" : i === 0 || i === n - 4 ? "V" : "W"; // legs, gold feet
    if (j === 12) return "w";
    return null;
  });
  const on = cv(RLW, RLH);
  jar(on, 7, TOPY - 26, 11, 26, "yYO", "B");
  stamp(on, 8, TOPY - 17, ["..R.R.R..".padStart(10, ".")]);
  stamp(on, 21, TOPY - 22, [
    "..yYYO..",
    ".yO..YO.",
    ".y....O.",
    ".y.CD.O.",
    "..yYYO..",
    "yYYCCYYO",
    "OOOYYOOO",
    "...yO...",
    "...yO...",
    "...yC...",
    "...yO...",
    "...yO...",
    "...yO...",
    "...yO...",
    "..yYYO..",
    ".OOOOOO.",
  ]);
  stamp(on, 31, TOPY - 14, [
    "......YY......",
    ".....yBBO.....",
    "..O.yIBBNO.O..",
    "...OyIBBNOO...",
    ".OOyIIBNNNOO..",
    "...yIDBBNNO...",
    ".OOYYYYYYYYOO.",
    "..yIIBBBBNNO..",
    ".OyIBBBBBNNOO.",
    "..yIBBBBBNNO..",
    "...yBBBBNNO...",
    "....OONNOO....",
    "....O....O....",
    "..OOOOOOOOOO..",
  ]);
  stamp(on, 47, TOPY - 10, ["..R.C.B.D..", ".CDRyBCRDyR.", "yYYYYYYYYYYO", ".yYYYYYYYYO.", "..OYYYYYYO..", "...OOOOOO...", "..yYYYYYYO..", ".OOOOOOOOOO."]);
  jar(on, 61, TOPY - 14, 8, 14, "aca", "R");
  const GLINTS: Pt[] = [[9, TOPY - 22], [12, TOPY - 10], [24, TOPY - 21], [26, TOPY - 15], [36, TOPY - 10], [41, TOPY - 6], [51, TOPY - 8], [63, TOPY - 10]];
  const frames = GLINTS.map(([gx, gy], f) => {
    const g = cv(RLW, RLH);
    stamp(g, gx - 1, gy - 1, [".v.", "vvv", ".v."]);
    return [groundShadow(RLW / 2, RLF - 1, 34, 4), table, cropBit(on)!, cropBit(g, false)!];
  });
  return def("relics", [2, 1], RLW, RLH, [RLW / 2, RLF], frames, 200);
})();

/**
 * Canopic jars, one square, 50 px tall: three alabaster jars painted with bands of his red, blue and gold, a column of
 * glyphs down each, their lids carved as heads: an elephant's (gold), a king's in a striped headcloth, a falcon's.
 */
const URW = 40;
const URH = 52;
const URF = URH - 3;
export const SHOP_ALFIL_URNS = (() => {
  const body = (x0: number, h: number, band: string) =>
    paint(x0, URF - h, 12, h + 1, (x, y) => {
      const X = (x + 0.5 - x0 - 6) / 6;
      const j = y - (URF - h);
      const t = j / h;
      const hw = j < 2 ? 0.85 : Math.sin(Math.PI * (0.25 + t * 0.62)) * 1.05;
      if (Math.abs(X) > hw) return null;
      if (j === 2 || j === 3) return band === "R" ? (X > 0.4 ? "r" : "R") : X > 0.4 ? "N" : "B";
      if (j === 4 || j === h - 3) return "Y";
      if (Math.abs(X) < 0.2 && j > 6 && j < h - 5 && j % 3 === 0) return "e"; // glyphs down it
      return roundTone(X, "aabc");
    });
  const lidE = paint(1, URF - 31, 14, 13, (x, y) => {
    const X = x + 0.5 - 8;
    const Y = y + 0.5 - (URF - 25);
    if (Math.hypot((Math.abs(X) - 4.5) / 2.8, Y / 4) < 1) return X < 0 ? "Y" : "O"; // ears
    if (Math.hypot(X / 3.6, Y / 4.2) < 1) return Math.hypot(Math.abs(X) - 1.6, Y + 0.5) < 0.8 ? "P" : X < 0 ? "y" : "Y";
    if (Math.abs(X - (Y > 5 ? 1 : 0)) < 1.2 && Y > 2 && Y < 7) return "Y"; // the trunk
    return null;
  });
  const lidK = paint(14, URF - 38, 12, 14, (x, y) => {
    const X = x + 0.5 - 20;
    const j = y - (URF - 38);
    const hw = j < 6 ? 3.5 + j * 0.25 : 5;
    if (Math.abs(X) > hw) return null;
    if (j > 3 && j < 11 && Math.abs(X) < 2.6) return Math.hypot(Math.abs(X) - 1.2, j - 6) < 0.6 ? "x" : X < 0 ? "b" : "c"; // the face
    return Math.floor(j / 2) % 2 ? "B" : "Y";
  });
  const lidF = paint(26, URF - 30, 12, 10, (x, y) => {
    const X = x + 0.5 - 32;
    const Y = y + 0.5 - (URF - 25);
    if (Math.hypot(X / 3.6, Y / 4) < 1) return Math.hypot(X + 0.8, Y + 1) < 0.8 ? "x" : X < 0 ? "c" : "d";
    if (Y > -2 && Y < 1 && X < -2 && X > -5.5 + (Y + 2) * 0.5) return "Y"; // the beak
    return null;
  });
  return def("urns", [1, 1], URW, URH, [URW / 2, URF], [
    [groundShadow(URW / 2, URF - 1, 18, 3), body(2, 20, "R"), body(26, 20, "R"), lidE, lidF, body(14, 26, "B"), lidK],
  ]);
})();

// ==== Fire, for the braziers.

/** A brazier's flame from its foot (cx, base), by frame `f` of 8: tongues licking up, a bright heart, deep red at the edges. */
const flame = (cx: number, base: number, hw: number, h: number, f: number) =>
  paint(Math.floor(cx - hw - 1), Math.floor(base - h - 4), 2 * hw + 4, h + 5, (x, y) => {
    const X = x + 0.5 - cx;
    const j = base - y; // height above the bowl
    if (j < 0) return null;
    // Three tongues, each rising and falling out of step.
    const tongues = [-hw * 0.55, 0, hw * 0.55].map((tx, i) => ({ tx: tx + (i === 1 ? Math.round(Math.sin((f * Math.PI) / 4)) * 0.6 : 0), th: h * (i === 1 ? 1 : 0.7) * (0.82 + 0.18 * Math.sin((f * Math.PI) / 4 + i * 2.1)) }));
    let best = -1;
    for (const { tx, th } of tongues) {
      const w = hw * (i0(tx) ? 0.55 : 0.5) * (1 - j / th);
      const d = Math.abs(X - tx) / Math.max(0.01, w);
      if (j < th && d < 1) best = Math.max(best, 1 - d * 0.7 - (j / th) * 0.5);
    }
    if (j < 2 && Math.abs(X) < hw) best = Math.max(best, 0.5);
    if (best < 0) return null;
    return best > 0.55 ? "@" : best > 0.3 ? "0" : "9";
  }, false);
const i0 = (tx: number) => Math.abs(tx) < 0.7;

/**
 * A brazier, one square, 60 px tall: a gold bowl on three slender legs, a fire in it. `idle` (8 frames): the fire
 * licks. Two stand either side of the counter. Its light: SHOP_ALFIL_LIGHTS.
 */
const BZW = 30;
const BZH = 62;
const BZF = BZH - 3;
const BZ_BOWL = 30; // the bowl's rim
export const SHOP_ALFIL_BRAZIER = (() => {
  const cx = BZW / 2;
  const stand = paint(cx - 10, BZ_BOWL, 21, BZF - BZ_BOWL + 1, (x, y) => {
    const X = x + 0.5 - cx - 0.5;
    const j = y - BZ_BOWL;
    if (j < 8) {
      // The bowl: a lip, then curving in.
      const hw = j < 2 ? 10 : 10 - (j - 2) * 1.1;
      if (Math.abs(X) > hw) return null;
      if (j === 0) return "y";
      if (j === 1) return "O";
      if (j === 4) return X > 3 ? "N" : "B"; // a blue band
      return roundTone(X / hw, "yYOP");
    }
    // Three legs splaying to the floor, a ring tying them.
    const t = (j - 8) / (BZF - BZ_BOWL - 8);
    for (const s of [-1, 0, 1]) {
      const lx = s * (2 + t * 6);
      if (Math.abs(X - lx) < 1) return s < 0 ? "Y" : s > 0 ? "O" : "y";
    }
    if (Math.abs(j - 16) < 1 && Math.abs(X) < 4.5) return "Y";
    if (y >= BZF - 1 && [-8, 0, 8].some((fx) => Math.abs(X - fx) < 1.6)) return "O"; // feet
    return null;
  });
  const coals = paint(cx - 8, BZ_BOWL - 2, 17, 3, (x, y) => (Math.abs(x + 0.5 - cx - 0.5) < 8 - (BZ_BOWL - y) * 1.5 ? ((x + y) % 3 ? "9" : "0") : null), false);
  const frames = Array.from({ length: 8 }, (_, f) => [groundShadow(cx, BZF - 1, 11, 2), stand, coals, flame(cx + 0.5, BZ_BOWL - 1, 7, 20, f)]);
  return def("brazier", [1, 1], BZW, BZH, [cx, BZF], frames, 120);
})();

/**
 * The showpiece, the Elephant Sand Fountain, three squares wide and two deep: a sandstone pylon at its back with Alfil's
 * head carved on it, his trunk curling forward into a gold spout, golden desert sand pouring from it into a wide stone
 * basin of sand; braziers burn on the basin's back corners. The basin's sand lies flat (seen from above, as the floor is),
 * the pylon, the braziers and the falling sand stand upright, each its own layer.
 * `idle` (8 frames, 130 ms): the stream of sand runs (grains sliding down it), rings spread out across the basin from
 * where it lands (one ring's width a loop, so it never jumps), grains kick up where it lands, the fires lick.
 */
const SFW = 4 * T;
const SF_RISE = 122; // how far its picture rises above its north row
const SFH = SF_RISE + 3 * T;
const SFF = SF_RISE + 2 * T + 18; // its foot: the middle of its south row
const SF_CX = 74;
const SF_LAND: Pt = [SF_CX, SF_RISE + 42]; // where the sand lands
const SF_SPOUT_Y = 114; // the spout's mouth
const SF_FIRES: Pt[] = [[14, SF_RISE + 6], [SFW - 15, SF_RISE + 6]];
export const SHOP_ALFIL_SAND_FOUNTAIN = (() => {
  const N = 8;
  const R = SF_RISE;
  const cx = SF_CX;
  const X_ = (x: number) => x + 0.5 - cx;
  // ---- The pylon: a battered sandstone wall, its edges banded, a cornice, the elephant's head carved on it.
  const PTOP = 16;
  const PBOT = R + 10;
  const pylonHalf = (y: number) => 29 + ((y - PTOP) / (PBOT - PTOP)) * 6;
  const pylon = paint(cx - 38, 4, 77, PBOT - 4, (x, y) => {
    const X = X_(x);
    if (y < PTOP) {
      if (Math.abs(X) > 36.5) return null;
      const j = y - 4;
      if (j === 0) return "a";
      if (j < 8) {
        const fx = ((x % 4) + 4) % 4;
        if (fx === 0) return j > 6 ? "d" : "c";
        const col = ["B", "Y", "R", "Y"][Math.floor(x / 4) % 4]!;
        return j > 6 || fx === 3 ? ({ B: "N", Y: "O", R: "r" } as Record<string, string>)[col]! : col;
      }
      return j === 8 ? "y" : j === 9 ? "Y" : j === 10 ? "O" : "e";
    }
    const hw = pylonHalf(y);
    if (Math.abs(X) > hw) return null;
    const ax = Math.abs(X);
    // Bands down its edges: gold, red, blue, gold.
    if (ax > hw - 5) {
      const b = Math.floor(hw - ax);
      return b === 0 ? (X < 0 ? "a" : "d") : ["Y", "Y", "R", "B", "Y"][b] === "R" ? (X > 0 ? "r" : "R") : ["Y", "Y", "R", "B", "Y"][b] === "B" ? (X > 0 ? "N" : "B") : X > 0 ? "O" : "Y";
    }
    // Columns of glyphs either side of the head.
    if (ax > hw - 11 && ax < hw - 6 && y > PTOP + 4 && y < PBOT - 8) {
      const gy = (y - PTOP - 4) % 9;
      const gx = Math.floor(ax - (hw - 11));
      const mark = grain(Math.floor((y - PTOP - 4) / 9), X < 0 ? 1 : 2, 41);
      if (gy < 6 && (mark < 0.33 ? gy === 0 || gy === 5 || gx === 2 : mark < 0.66 ? (gx + gy) % 3 === 0 : Math.hypot(gx - 2, gy - 2.5) < 2.4 && Math.hypot(gx - 2, gy - 2.5) > 1.2)) return "d";
    }
    return ashlar(x, y - PTOP, X < -8 ? 0.75 : X < 10 ? 0.55 : 0.35, 43);
  });
  // The head: ears, the dome, his Nettipattam, gold eyes; the trunk curling forward into a gold spout.
  const HY = 56; // the head's middle
  const head = paint(cx - 31, HY - 26, 63, 50, (x, y) => {
    const X = X_(x);
    const Y = y + 0.5 - HY;
    const dome = Math.hypot(X / 13.5, (Y + 3) / 17);
    for (const s of [-1, 1]) {
      const ex = (X - s * 17) / 13;
      const ey = (Y + 1) / 16;
      const d = Math.hypot(ex, ey);
      if (d < 1 && dome > 1) return d > 0.84 ? (s < 0 ? "a" : "d") : (s < 0 ? ex < 0.2 : ex < -0.5) ? "b" : "c";
    }
    if (dome > 1) return null;
    const nw = 8.5 - (Y + 17) * 0.42;
    if (Y > -18 && nw > 0.5 && Math.abs(X) < nw) return Math.abs(X) > nw - 1.5 ? "Y" : (Y + 17) % 5 < 1 ? "y" : X > 1 ? "r" : "R";
    if (Math.hypot(Math.abs(X) - 7.5, Y - 1) < 1.7) return X < 0 ? "y" : "Y";
    return roundTone(X / 13.5 - (Y < -11 ? 0.3 : 0), SAND4);
  });
  const tusks = paint(cx - 20, HY + 12, 41, 26, (x, y) => {
    const X = X_(x);
    const t = (y - HY - 12) / 22;
    if (t < 0 || t > 1) return null;
    const tx = 6 + 10 * t * t;
    if (Math.abs(Math.abs(X) - tx) > 2.2 - t * 1.2) return null;
    return X < 0 ? "T" : "S";
  });
  const trunk = paint(cx - 7, HY + 8, 15, SF_SPOUT_Y - HY - 8 + 5, (x, y) => {
    const X = X_(x);
    const j = y - HY - 8;
    if (y >= SF_SPOUT_Y - 5) {
      // The gold spout at its tip, its mouth toward us.
      const d = Math.hypot(X, (y + 0.5 - SF_SPOUT_Y) * 1.3);
      if (d < 2.4) return "x";
      if (d < 5.6) return X + (y - SF_SPOUT_Y) < -1 ? "y" : X > 2 ? "O" : "Y";
      return null;
    }
    const hw = 6 - j * 0.06;
    if (Math.abs(X) > hw) return null;
    if (j % 5 === 2 && Math.abs(X) < hw - 1) return "c"; // its folds
    return roundTone(X / hw, SAND4);
  });
  // ---- The basin: a rim seen from above, its front face, the sand inside (flat), shade under the far rim.
  const BX0 = 3;
  const BX1 = SFW - 4;
  const BY0 = R + 6;
  const BY1 = R + 3 * T - 16; // the near rim's front edge
  const FACE = 11;
  const RIM = 5;
  const rim = paint(BX0, BY0, BX1 - BX0 + 1, BY1 - BY0 + FACE + 1, (x, y) => {
    const inner = x >= BX0 + RIM && x <= BX1 - RIM && y >= BY0 + RIM - 1 && y <= BY1 - RIM;
    if (inner) return null;
    if (y > BY1) {
      // The front face: a painted band, then blocks; lit on the left.
      const j = y - BY1;
      if (j === 1) return "d";
      if (j >= 2 && j <= 4) return ["Y", "R", "B"][j - 2] === "R" ? "R" : ["Y", "R", "B"][j - 2]!;
      if (j === 5) return "O";
      if (j === FACE) return "e";
      return ashlar(x, j - 6, x < 30 ? 0.6 : 0.4, 47);
    }
    // The rim's top: lit along its inner far edge, a gold inlay line round it.
    const dIn = Math.min(x - BX0, BX1 - x, y - BY0, BY1 - y);
    if (dIn === 2) return "Y";
    if (y === BY0 || x === BX0) return "a";
    return y === BY1 ? "c" : "b";
  });
  const sand = (f: number) =>
    paint(BX0 + RIM, BY0 + RIM - 1, BX1 - BX0 - 2 * RIM + 1, BY1 - BY0 - 2 * RIM + 2, (x, y) => {
      if (y < BY0 + RIM + 2) return y === BY0 + RIM - 1 ? "6" : "5"; // shade under the far rim
      if (x < BX0 + RIM + 1) return "5";
      const dx = x + 0.5 - SF_LAND[0];
      const dy = (y + 0.5 - SF_LAND[1]) * 2.2;
      const de = Math.hypot(dx, dy);
      if (de < 4) return de < 2.2 ? "y" : "4"; // the little heap where it lands
      const ph = (((de - f * 1.25 - 4) % 10) + 10) % 10;
      if (de < 74) {
        if (ph < 1.4) return "4";
        if (ph < 2.6) return de > 60 && (x + y) % 2 ? "5" : "6";
      }
      return (x * 7 + y * 13) % 41 === 0 ? "4" : "5";
    }, false);
  // ---- The falling sand: a stream of grains sliding down, grains kicked up where it lands.
  const stream = (f: number) =>
    paint(cx - 2, SF_SPOUT_Y + 1, 5, SF_LAND[1] - SF_SPOUT_Y - 1, (x, y) => {
      const X = x - cx; // -2..2
      const j = y - SF_SPOUT_Y;
      const k = (((j - f * 3) % 6) + 6) % 6; // 3 px a frame: 24 px a loop, four dashes, so it loops clean
      if (Math.abs(X) === 2) return j > 3 && (k + (X > 0 ? 3 : 0)) % 6 < 1 ? "4" : null; // loose grains at its edges
      return X === -1 ? (k < 3 ? "v" : "y") : X === 0 ? (k < 3 ? "y" : "4") : k < 3 ? "4" : "5";
    }, false);
  const KICK: [number, number, string][][] = [
    [[-4, -2, "4"], [4, -3, "y"]],
    [[-6, -4, "4"], [5, -5, "4"], [-2, -3, "y"]],
    [[-7, -5, "5"], [7, -6, "4"], [2, -4, "4"]],
    [[-8, -4, "5"], [8, -5, "5"], [3, -6, "y"]],
    [[-3, -2, "y"], [9, -3, "5"], [4, -5, "4"]],
    [[-5, -3, "4"], [2, -2, "y"]],
    [[-6, -5, "4"], [6, -4, "y"], [-1, -3, "4"]],
    [[-7, -4, "5"], [7, -5, "4"]],
  ];
  const kick = (f: number): Bit | null => {
    const c = cv(SFW, SFH);
    for (const [dx, dy, k] of KICK[f]!) put(c, SF_LAND[0] + dx, SF_LAND[1] + dy, k);
    return cropBit(c, false);
  };
  // ---- The braziers on the basin's back corners: short gold bowls on low stands, fires in them.
  const bowl = (bx: number, by: number) =>
    paint(bx - 6, by, 13, 9, (x, y) => {
      const X = x + 0.5 - bx - 0.5;
      const j = y - by;
      const hw = j < 2 ? 6 : j < 5 ? 6 - (j - 1) * 1.2 : 1.5 + (j > 7 ? 1.5 : 0);
      if (Math.abs(X) > hw) return null;
      return j === 0 ? "y" : j === 3 ? "B" : roundTone(X / Math.max(hw, 1), "yYOP");
    });
  const PYLON_DISK = wingedDisk(cx, 24, 27);
  const frames = Array.from({ length: N }, (_, f) => {
    const kb = kick(f);
    return [
      groundShadow(SFW / 2, BY1 + FACE - 1, 72, 4),
      pylon,
      PYLON_DISK,
      head,
      tusks,
      trunk,
      rim,
      sand(f),
      ...SF_FIRES.map(([bx, by]) => bowl(bx, by - 4)),
      ...SF_FIRES.map(([bx, by], i) => flame(bx + 0.5, by - 5, 5, 13, (f + i * 3) % N)),
      stream(f),
      ...(kb ? [kb] : []),
    ];
  });
  return def("sand-fountain", [4, 3], SFW, SFH, [Math.floor(SFW / 2), SFF], frames, 130);
})();

/**
 * A shatranj table, one square: a low table of dark wood, the old chess board on its top (seen from above at the town's
 * angle, its squares gold and deep brown), three old pieces standing on it: the alfil in gold, the shah in red, a pawn in blue.
 */
const CTW = 44;
const CTH = 46;
const CTF = CTH - 3;
export const SHOP_ALFIL_CHESS_TABLE = (() => {
  const TY = 20;
  const TB = 32; // the top's near edge
  const table = paint(2, TY, CTW - 4, CTF - TY + 1, (x, y) => {
    const i = x - 2;
    const n = CTW - 4;
    if (y <= TB) {
      // The board: a border of wood round 8 x 4 squares (foreshortened).
      if (i < 2 || i > n - 3 || y < TY + 2 || y > TB - 1) return y === TY || i === 0 ? "V" : y === TB ? "W" : "w";
      const cx = Math.floor((i - 2) / 4.5);
      const cy = Math.floor((y - TY - 2) / 2.5);
      return (cx + cy) % 2 ? "Y" : "X";
    }
    if (y <= TB + 3) return y === TB + 3 ? "W" : "w"; // its front edge
    if (i < 3 || i > n - 4) return y > CTF - 2 ? "Y" : i === 0 || i === n - 3 ? "V" : "W"; // legs
    return null;
  });
  const pieces = cv(CTW, CTH);
  stamp(pieces, 10, TY - 5, [".y.y.", "yYYYO", ".yYO.", ".yYO.", "yYYYO"]);
  stamp(pieces, 20, TY - 7, ["..y..", ".RRr.", ".RRr.", "..Rr.", "..Rr.", ".RRRr", ".rrrr"].map((r) => r));
  stamp(pieces, 30, TY - 1, [".IB.", ".BN.", "IBBN", "NNNN"]);
  return def("chess-table", [1, 1], CTW, CTH, [CTW / 2, CTF], [[groundShadow(CTW / 2, CTF - 1, 18, 3), table, cropBit(pieces)!]]);
})();

/**
 * The lights at dusk and night, each on its piece (`piece`; x, y in that piece's own pixels): the braziers' fires (only the
 * flame's pixels light), flickering, a halo round each; the sand fountain's two corner fires.
 */
export const SHOP_ALFIL_LIGHTS: readonly (LightSpot & { piece: string })[] = [
  { piece: "brazier", x: 4, y: 4, w: BZW - 8, h: BZ_BOWL, keys: "90@", color: TORCH, strength: 1, flicker: true, halo: 40 },
  ...SF_FIRES.map(([bx, by]) => ({ piece: "sand-fountain", x: bx - 7, y: by - 24, w: 15, h: 20, keys: "90@", color: TORCH, strength: 0.9, flicker: true, halo: 32 })),
];
/** ... and warm pools on the floor under them. */
export const SHOP_ALFIL_POOLS: readonly (LightPool & { piece: string })[] = [
  { piece: "brazier", x: BZW / 2, y: BZF, rx: 34, ry: 11, color: TORCH, strength: 0.3 },
  { piece: "sand-fountain", x: SF_CX, y: SF_RISE + 40, rx: 60, ry: 26, color: TORCH, strength: 0.22 },
];

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
  /** Squares deep, for the deep pieces, from `row` north: it stands on `row`, and covers the rows north of it too. */
  d?: number;
  /** The way out (the entrance): walking into it leaves the pyramid. */
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
/** Sand blown in and drifted against the walls: where, and the turn that puts its drift in the corner by the wall. */
const SAND_AT: Record<string, 0 | 1 | 2 | 3> = { "1,1": 1, "18,1": 2, "1,6": 0, "6,1": 2, "13,1": 1, "18,13": 3, "1,12": 1, "1,18": 0, "18,18": 3, "14,18": 0, "5,18": 3, "18,5": 2 };
const SAND = new Set(Object.keys(SAND_AT));
const CRACK = new Set(["4,6", "15,15", "3,12", "13,3", "6,17"]);
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
    else if (SAND.has(k)) at("floor-c", col, row, false, SAND_AT[k] ? { rot: SAND_AT[k] } : {});
    else if (CRACK.has(k) && !even) at("floor-d", col, row, false);
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
  at([0, 5, 14, 19].includes(col) ? "wall-pillar" : col % 3 === 1 ? "wall-b" : "wall", col, 0, true, col === 19 ? { flip: true } : {});
}
for (let row = 1; row < 19; row++) {
  const side = row === 10 ? "wall-side-pillar" : row % 2 ? "wall-side" : "wall-side-b";
  at(side, 0, row, true);
  at(side, 19, row, true, { flip: true });
}
at("hem-pillar", 0, 19, true);
for (let col = 1; col < 19; col++) if (col < 9 || col > 10) at("hem", col, 19, true);
at("entrance", 9, 19, false, { exit: true });
at("hem-pillar", 19, 19, true, { flip: true });

// -- The shop and the props.
at("counter", 8, 3, true);
at("crate", 8, 3, false); // on the counter (see SHOP_ALFIL_CRATE_AT): its place is the counter's
at("elephant-statue", 2, 9, true);
at("relics", 2, 14, true);
at("pyramid-model", 3, 3, true);
at("urns", 17, 2, true);
at("brazier", 7, 3, true);
at("brazier", 12, 3, true);
at("sand-fountain", 15, 10, true); // columns 15-18, rows 8-10 (its pylon rises over rows 5-7)
at("chess-table", 16, 15, true);
at("urns", 3, 17, true);
at("pharaoh-statue", 7, 18, true);
at("pharaoh-statue", 12, 18, true, { flip: true });
//@@PROPS@@

/** Where every piece goes: name, column (its west-most square), row (its south-most), solid; floor tiles first, then the upright pieces north to south. */
export const SHOP_ALFIL_LAYOUT: readonly ShopPlace[] = [...LAYOUT.slice(0, FLOOR_COUNT), ...LAYOUT.slice(FLOOR_COUNT).sort((a, b) => a.row - b.row || a.col - b.col)];

/** Every piece by its name (as SHOP_ALFIL_LAYOUT names them), each its own Character `shop-alfil-<name>`. */
export const SHOP_ALFIL_PIECES: Readonly<Record<string, Character>> = Object.fromEntries(Object.values(PIECES).map((p) => [p.name, toChar(p)]));

export type { LightPool, LightSpot };
