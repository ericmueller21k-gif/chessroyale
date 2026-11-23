/**
 * Inside Babur's circus tent: Babur's shop (house-shop-babur). A room of 20 x 20 squares seen as the town square is seen
 * (the camera looks north, things stand upright at their foot, 37 px a square), in the outside tent's palette
 * (town/houses/tiger.ts, value for value). Each piece is its own `Character` (`shop-babur-<name>`); `HOUSE_SHOP_BABUR` is the
 * whole room laid out as one still, with one extra animation per piece; `SHOP_BABUR_LAYOUT` says where each piece goes.
 *
 * Footing: a piece's foot is the middle of its square (a wide piece's: the middle of its width, on the middle of its row).
 * Floor tiles are flat, top-down, 37 x 37, foot at their middle; the ring's edge tiles are turned by `rot` (quarter turns
 * clockwise) and the east wall is the west one mirrored (`flip`).
 */
import { frameKeys, type Anim, type Character, type Frame, type Layer, type Part } from "../../characters/sprite.ts";
import { ball, crate, grain, groundShadow, paint, signBoard, signFace, TORCH, type LightPool, type LightSpot, type Pt } from "../houses/kit.ts";

const PALETTE: Record<string, string> = {
  k: "#1f1210", // outline (the tiger's)
  A: "#7d1220", // the tent's red: dark, mid, light
  B: "#c0242c",
  C: "#ee5a4f",
  D: "#c4b8a6", // the tent's white: shadow, cloth, light
  E: "#efe8da",
  F: "#fffaf0",
  G: "#1a4fa8", // blue
  H: "#2f7fe0",
  I: "#7cc0ff",
  J: "#7a4f0e", // gold
  K: "#b87a14",
  L: "#f2c14e",
  M: "#ffe58a",
  N: "#4d2813", // wood
  O: "#7a4a22",
  P: "#a8703a",
  Q: "#d09a5a",
  S: "#c9a56a", // the sign's face
  T: "#e8cc95",
  U: "#f7e4b8",
  V: "#24120c", // deep dark
  W: "#4a1d16",
  X: "#0f6a3a", // green
  Y: "#1fa856",
  Z: "#6fe08e",
  a: "#5a2a96", // purple
  b: "#9150d6",
  c: "#c79bf5",
  d: "#b88a0a", // yellow
  e: "#f2c31a",
  f: "#ffe566",
  s: "#6b4a30", // string
  "-": "#0d0e1280", // ground shadow: core, rim
  "+": "#0d0e1244",
  // ---- The room's own.
  r: "#9e1a26", // the canvas's red in the tent's shade (between A and B)
  q: "#a69a88", // the canvas's white in shade
  "1": "#e9cd96", // sawdust a: base, dark speck, light speck
  "2": "#d5b47c",
  "3": "#f6e3b6",
  "4": "#dfbe86", // sawdust b
  "5": "#c9a76f",
  "6": "#eed4a2",
  "7": "#c99464", // the ring's raked sawdust: a, b, rake shade, rake ridge
  "8": "#c38e5e",
  "9": "#a6714a",
  "0": "#d9a877",
  g: "#d9b781", // the scuffed path, its worn streaks
  h: "#e8cc98",
  y: "#fff0c8", // daylight on the floor: bright, soft
  z: "#f6dcaa",
  u: "#fff8e2", // outside the door: the bright day, sky, paving
  v: "#bfe3f7",
  p: "#ded6c6",
  o: "#cbc2b1",
  w: "#fff6dc", // a balloon's shine
  // ---- The burning hoops (Nov 2): the tiger's fire and steel, value for value (tiger.ts `p u v Q R`, `% & =`).
  i: "#7a1a0a", // fire: dark red to white-hot
  l: "#e8461c",
  m: "#ff9b22",
  n: "#ffd84a",
  R: "#fff3b0",
  "%": "#4a4756", // the hoop's steel: dark, mid, light
  "&": "#8d8a9c",
  "=": "#cfccd9",
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
  return { id: `shop-babur-${p.name}`, name: `Babur's shop: ${p.name}`, w: p.w, h: p.h, foot: p.foot, palette: PALETTE, parts, anims: { idle: { loop: true, frames } } };
}
function def(name: string, sq: readonly [number, number], w: number, h: number, foot: Pt, frames: Bit[][], ms = 1000): Character {
  PIECES[name] = { name, sq, w, h, foot, frames, ms };
  return toChar(PIECES[name]!);
}

// ---- A small canvas to stamp on (for things easier drawn pixel by pixel than as one function).

type Cv = string[][];
const cv = (w: number, h: number): Cv => Array.from({ length: h }, () => Array<string>(w).fill("."));
const fill = (c: Cv, fn: (x: number, y: number) => Key) => c.forEach((row, y) => row.forEach((_, x) => (row[x] = fn(x, y) ?? row[x]!)));
const put = (c: Cv, x: number, y: number, k: string) => {
  if (y >= 0 && y < c.length && x >= 0 && x < c[0]!.length) c[y]![x] = k;
};
const asPart = (c: Cv, outline = false): Part => ({ grid: c.map((r) => r.join("")), outline });
/** Stamps rows of keys at (x, y) ('.' leaves what's there). */
const stamp = (c: Cv, x: number, y: number, rows: readonly string[]) => rows.forEach((r, j) => [...r].forEach((k, i) => k !== "." && put(c, x + i, y + j, k)));
/** Rings the pixels `pts` with the outline where they aren't. */
function outlinePts(c: Cv, pts: readonly Pt[]) {
  const inSet = new Set(pts.map(([x, y]) => `${x},${y}`));
  for (const [x, y] of pts)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (!inSet.has(`${x + dx},${y + dy}`)) put(c, x + dx, y + dy, "k");
}

// ==== The floor: flat squares, top-down, no outline, tiling seamlessly.

const SAW_A = "213"; // dark, base, light
const SAW_B = "546";
/** Sawdust: a base with a few short flecks (two pixels long), darker and lighter. */
const sawdust = (x: number, y: number, ramp: string, seed: number) => {
  const g = grain(x >> 1, y, seed);
  return g < 0.035 ? ramp[0]! : g > 0.978 ? ramp[2]! : ramp[1]!;
};
const flat = (fn: (x: number, y: number) => Key): Bit[][] => [[paint(0, 0, T, T, fn, false)]];
const tileDef = (name: string, fn: (x: number, y: number) => Key) => def(name, [1, 1], T, T, [18, 18], flat(fn));

/** The ring's raked sawdust: faint furrows across it, each a shade with a lit ridge under it. */
const raked = (x: number, y: number, base: string) => {
  // Short furrows (3 px, a lit ridge beside each) scattered every way, so the tile reads the same however it's turned.
  const cx = Math.floor(x / 4);
  const cy = Math.floor(y / 4);
  if (grain(cx, cy, 7) < 0.5) {
    const horiz = grain(cx, cy, 8) < 0.5;
    const ox = Math.floor(grain(cx, cy, 9) * 2);
    const oy = Math.floor(grain(cx, cy, 10) * 2);
    const i = x - cx * 4;
    const j = y - cy * 4;
    const [a, b] = horiz ? [i, j] : [j, i];
    const [oa, ob] = horiz ? [ox, oy] : [oy, ox];
    if (a >= oa && a < oa + 3 && b === ob + 1) return "9";
    if (a >= oa && a < oa + 3 && b === ob) return "0";
  }
  const g = grain(x >> 1, y, 9);
  return g < 0.03 ? "9" : g > 0.98 ? "0" : base;
};

export const SHOP_BABUR_FLOOR_A = tileDef("floor-a", (x, y) => sawdust(x, y, SAW_A, 11));
export const SHOP_BABUR_FLOOR_B = tileDef("floor-b", (x, y) => sawdust(x, y, SAW_B, 12));

/** Variety on a: two wood shavings and a dropped scrap of purple balloon. */
export const SHOP_BABUR_FLOOR_C = (() => {
  const c = cv(T, T);
  fill(c, (x, y) => sawdust(x, y, SAW_A, 11));
  stamp(c, 6, 22, [".QQ..", "Q..P.", "Q.QP.", ".PP.."]);
  stamp(c, 27, 28, ["QQ.", "..P", ".P."]);
  stamp(c, 20, 7, [".bbc..", "b...cb", "a....b", ".a..ba", "..aa.."]);
  return def("floor-c", [1, 1], T, T, [18, 18], [[{ part: asPart(c), at: [0, 0] }]]);
})();
/** Variety on b: a faint scuffed footpath running north-south, worn smooth, a few streaks. */
export const SHOP_BABUR_FLOOR_D = tileDef("floor-d", (x, y) => {
  const edge = 9 + (grain(0, y >> 2, 4) - 0.5) * 3;
  const d = Math.abs(x + 0.5 - 18.5);
  if (d < edge || (d < edge + 2 && grain(x, y, 5) > 0.5)) {
    if ((x === 14 || x === 22) && grain(x, y >> 2, 6) > 0.4) return "h";
    return grain(x >> 1, y, 13) < 0.015 ? "5" : "g";
  }
  return sawdust(x, y, SAW_B, 12);
});
export const SHOP_BABUR_RING_A = tileDef("ring-a", (x, y) => raked(x, y, "7"));
export const SHOP_BABUR_RING_B = tileDef("ring-b", (x, y) => raked(x, y, "8"));

/**
 * The ring's curb seen from above, by its depth `j` into the band (0 its outer edge): a dark edge, a lit lip, red and white
 * blocks, a 2 px gold lip on the ring's side, and its shadow on the ring floor. `blk`: which block (red on even).
 */
const curb = (j: number, blk: number): string | null => {
  if (j === 0) return "A";
  if (j === 1) return blk % 2 ? "F" : "C";
  if (j < 8) return blk % 2 ? (j === 7 ? "D" : "E") : j === 7 ? "A" : "B";
  if (j === 8) return "L";
  if (j === 9) return "K";
  if (j === 10) return "9";
  return null;
};
/** Straight: the band along the tile's north side (the game turns it). Blocks: one red, one white a square. */
export const SHOP_BABUR_RING_EDGE = tileDef("ring-edge", (x, y) => curb(y, x < 19 ? 0 : 1) ?? raked(x, y, "7"));
/** The octagon's 45-degree sides: the band from the tile's lower left to its upper right, sawdust beyond it (NW cut). */
const diag = (saw: string, seed: number) => (x: number, y: number) => {
  const s = x + y;
  if (s < 36) return sawdust(x, y, saw, seed);
  return curb(s - 36, Math.floor((x - y + 37) / 13)) ?? raked(x, y, "7");
};
export const SHOP_BABUR_RING_EDGE_DIAG = tileDef("ring-edge-diag", diag(SAW_A, 11));
/** (The same on the other tone of sawdust, for the squares of b.) */
export const SHOP_BABUR_RING_EDGE_DIAG_B = tileDef("ring-edge-diag-b", diag(SAW_B, 12));
/** The ring square inside each corner, where the diagonal band's end clips its corner. */
export const SHOP_BABUR_RING_EDGE_CORNER = tileDef("ring-edge-corner", (x, y) => curb(x + y + 1, Math.floor((x - y + 37 + 37) / 13)) ?? raked(x, y, "7"));

/** The daylight through the flap: a warm wash on sawdust, bright at the door (south), fading in as it goes north. */
export const SHOP_BABUR_FLOOR_DOOR = tileDef("floor-door", (x, y) => {
  // Banded, with an ordered dither between the bands (no seam where the two squares meet).
  const t = (y + 0.5) / T; // 0 north, 1 south
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const th = (BAYER[(y % 4) * 4 + (x % 4)]! + 0.5) / 16;
  const v = t * 2.2; // 0 to 2.2: sawdust, soft light, bright light
  if (v > 1 + th) return "y";
  if (v > th * 0.9 + 0.1) return "z";
  return sawdust(x, y, SAW_B, 12);
});

// ==== The walls.

const WALL_H = 130;
const BUNT = ["GHI", "XYZ", "abc", "def"];
/** The gold rope along the top: twisted, lit on its upper side. */
const rope = (x: number, y: number) => (y === 0 ? "k" : (x + y) % 4 < 2 ? (y === 1 ? "M" : "L") : "K");

/** The striped canvas wall seen from inside, its top at y0 (rope, valance, bunting, stripes; one stripe pair a square). */
function wallCv(c: Cv, y0: number) {
  fill(c, (x, yy) => {
    const y = yy - y0;
    if (y < 0) return null;
    if (y < 4) return rope(x, y);
    if (y === 4) return "k";
    // The valance: two scallops a square, red then white, a gold edge.
    const white = x >= 18;
    const t = (x + 0.5 - (white ? 18 : 0)) / (white ? 19 : 18);
    const bot = 11 + Math.round(4 * Math.sin(Math.PI * t));
    if (y < bot - 1) return white ? (y < 7 ? "E" : "D") : y < 7 ? "B" : "r";
    if (y === bot - 1) return "K";
    if (y === bot) return "k";
    // The canvas: red 19, white 18; each stripe lit along its left, its seam in shade; darker under the valance and at the foot.
    const red = x < 19;
    const i = red ? x : x - 19;
    const n = red ? 19 : 18;
    const dark = y < bot + 7 || y > WALL_H - 5;
    if (y >= WALL_H - 1) return "W";
    // A soft fold down each stripe (dithered), where the canvas sags between its seams.
    const fold = i === 12 && (x + y) % 2 === 0;
    if (red) return i >= n - 2 || dark || fold ? "A" : i === 0 ? "B" : "r";
    return i >= n - 2 || dark || fold ? "q" : i === 0 ? "E" : "D";
  });
  // The bunting: a string sagging across the square, four pennants on it, a gold tack where it meets the next.
  const sag = (x: number) => y0 + 19 + Math.round(4 * Math.sin((Math.PI * (x + 0.5)) / T));
  for (let x = 0; x < T; x++) put(c, x, sag(x), "s");
  put(c, 0, y0 + 19, "L");
  put(c, T - 1, y0 + 19, "L");
  [5, 14, 23, 32].forEach((fx, n) => {
    const top = sag(fx) + 1;
    const ramp = BUNT[n]!;
    const pts: Pt[] = [];
    [2, 2, 1, 1, 0].forEach((half, r) => {
      for (let dx = -half; dx <= half; dx++) pts.push([fx + dx, top + r]);
    });
    outlinePts(c, pts);
    for (const [x, y] of pts) put(c, x, y, y === top ? ramp[2]! : x > fx ? ramp[0]! : ramp[1]!);
  });
}

export const SHOP_BABUR_WALL = (() => {
  const c = cv(T, WALL_H);
  wallCv(c, 0);
  return def("wall", [1, 1], T, WALL_H, [18, WALL_H - 1], [[{ part: asPart(c), at: [0, 0] }]]);
})();

/** A tent pole: a wooden mast 5 wide, a gold ball on top and a gold collar under it, from `top` to `foot`. */
const pole = (cx: number, top: number, foot: number) =>
  paint(cx - 3, top, 7, foot - top, (x, y) => {
    const X = x - cx;
    const j = y - top;
    if (j < 7) {
      const d = Math.hypot(X, j - 3);
      if (d > 3.4) return null;
      return X < 0 && j < 3 ? (X === -1 && j === 1 ? "M" : "L") : X > 0 || j > 4 ? "K" : "L";
    }
    if (j < 9) return Math.abs(X) > 2 ? null : X < 0 ? "L" : X > 1 ? "J" : "K";
    if (Math.abs(X) > 2) return null;
    if (y > foot - 4) return X < 0 ? "O" : "N"; // its foot, in the floor's shade
    return X <= -1 ? (X === -2 ? "Q" : "P") : X === 2 ? "N" : "O";
  });
/** A gold rope tied round a pole at `y`, its end hanging down its right with a tassel. */
const poleTie = (cx: number, y: number) => {
  const c = cv(9, 16);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 7; i++) put(c, i, j, (i + j) % 3 === 0 ? "K" : i < 3 ? "M" : "L");
  for (let j = 4; j < 12; j++) put(c, 5 + (j > 8 ? 1 : 0), j, j % 2 ? "K" : "L");
  stamp(c, 5, 12, ["LKK", "LKK", ".K."]);
  return { part: asPart(c, true), at: [cx - 3, y] as Pt };
};

const POLE_UP = 20; // how far the pole stands above the wall
export const SHOP_BABUR_WALL_POLE = (() => {
  const h = WALL_H + POLE_UP;
  const c = cv(T, h);
  wallCv(c, POLE_UP);
  return def("wall-pole", [1, 1], T, h, [18, h - 1], [[{ part: asPart(c), at: [0, 0] }, pole(18, 1, h), poleTie(18, POLE_UP + 58)]]);
})();

/**
 * The west wall, running away north, seen obliquely: the canvas in narrow folds (the stripes foreshortened, a red and a
 * white fold to every 9 pixels), each fold lit on its left and shaded into its crease; narrow scallops on top.
 */
function sideCv(c: Cv, y0: number) {
  fill(c, (x, yy) => {
    const y = yy - y0;
    if (y < 0) return null;
    // A thin gold edge along the top (lighter than the back wall's rope: a column of these reads as one wall going away).
    if (y === 0) return "k";
    if (y === 1) return x % 3 ? "K" : "L";
    if (y === 2) return "k";
    const fold = Math.floor(x / 9 + 0.0001);
    const i = x - fold * 9;
    const t = (x % 9 + 0.5) / 9;
    const bot = 5 + Math.round(2 * Math.sin(Math.PI * t));
    const redF = i < 5;
    if (y < bot) return redF ? "r" : "D";
    if (y === bot) return "k";
    if (y >= WALL_H - 1) return "W";
    const dark = y < bot + 6 || y > WALL_H - 5;
    if (redF) return i === 0 && !dark ? "B" : i === 4 || dark ? "A" : "r";
    return i === 5 && !dark ? "E" : i === 8 || dark ? "q" : "D";
  });
}
export const SHOP_BABUR_WALL_SIDE = (() => {
  const c = cv(T, WALL_H);
  sideCv(c, 0);
  return def("wall-side", [1, 1], T, WALL_H, [18, WALL_H - 1], [[{ part: asPart(c), at: [0, 0] }]]);
})();
export const SHOP_BABUR_WALL_SIDE_POLE = (() => {
  const h = WALL_H + POLE_UP;
  const c = cv(T, h);
  sideCv(c, POLE_UP);
  return def("wall-side-pole", [1, 1], T, h, [18, h - 1], [[{ part: asPart(c), at: [0, 0] }, pole(18, 1, h), poleTie(18, POLE_UP + 58)]]);
})();

// ==== The front (south) wall: a low hem, and the way out.

const HEM_H = 20;
/** The hem: the gold rope along its top, short stripes under it, in the tent's shade (we see it from inside). */
function hemCv(c: Cv, y0: number) {
  fill(c, (x, yy) => {
    const y = yy - y0;
    if (y < 0) return null;
    if (y < 4) return rope(x, y);
    if (y === 4) return "k";
    if (y >= HEM_H - 1) return "W";
    const red = x < 19;
    const i = red ? x : x - 19;
    const dark = y < 7 || y > HEM_H - 4;
    if (red) return i >= 17 || dark ? "A" : i === 0 ? "B" : "r";
    return i >= 16 || dark ? "q" : i === 0 ? "E" : "D";
  });
}
export const SHOP_BABUR_HEM = (() => {
  const c = cv(T, HEM_H);
  hemCv(c, 0);
  return def("hem", [1, 1], T, HEM_H, [18, HEM_H - 1], [[{ part: asPart(c), at: [0, 0] }]]);
})();
/** A front corner: the hem with a tent pole standing at it. */
export const SHOP_BABUR_HEM_POLE = (() => {
  const h = WALL_H + POLE_UP;
  const c = cv(T, h);
  hemCv(c, h - HEM_H);
  return def("hem-pole", [1, 1], T, h, [18, h - 1], [[{ part: asPart(c), at: [0, 0] }, pole(18, 1, h), poleTie(18, POLE_UP + 58)]]);
})();

/**
 * The entrance, two squares wide: a pole either side, a striped valance across the top on a gold rope, the two red curtain
 * halves drawn back and tied with gold, and the bright day outside between them (sky over the town's paving).
 */
const EW = 2 * T;
const EH = 112;
const EFOOT = EH - 1;
const ETOP = 14; // the valance's top
const ETIE = 72; // the ties' height
export const SHOP_BABUR_ENTRANCE = (() => {
  const day = paint(6, ETOP + 8, EW - 12, EFOOT - ETOP - 8, (x, y) => {
    if (y > EFOOT - 18) return (Math.floor(x / 9) + Math.floor((y - 4) / 5)) % 2 ? "o" : "p"; // the square's paving out there
    if (y > EFOOT - 20) return "D";
    const t = y - ETOP - 30; // the sky fading into the bright haze over the square
    return t < 0 ? "v" : t < 4 && (x + y) % 2 === 0 ? "v" : "u";
  });
  /** A curtain half (the left; the right is mirrored): full at the top, gathered at the tie, flaring a little to the floor. */
  const half = (right: boolean) =>
    paint(right ? EW / 2 : 5, ETOP + 6, EW / 2 - 5, EFOOT - ETOP - 6, (xx, y) => {
      const x = right ? EW - 1 - xx : xx; // mirrored
      const i = x - 5;
      const reach = y < ETIE ? 4 + 26 * (1 - (y - ETOP - 6) / (ETIE - ETOP - 6)) ** 1.6 : 5 + 6 * ((y - ETIE) / (EFOOT - ETIE)) ** 0.8;
      if (i > reach) return null;
      if (y >= ETIE - 2 && y <= ETIE + 2) return i > reach - 1 ? "K" : y === ETIE - 2 ? "M" : y === ETIE + 2 ? "K" : "L"; // the tie
      const edge = i > reach - 1.5;
      const fold = Math.floor(i * (8 / Math.max(6, reach))) % 3 === 2;
      return edge ? "C" : fold ? "A" : right ? "r" : "B";
    });
  const tail = (right: boolean) => paint(right ? EW - 14 : 11, ETIE + 2, 3, 9, (x, y) => (y > ETIE + 8 ? (x === (right ? EW - 13 : 12) ? "K" : null) : (x + y) % 2 ? "L" : "K"));
  // The valance across the top: a rope, scallops red and white.
  const val = paint(4, ETOP, EW - 8, 13, (x, y) => {
    const j = y - ETOP;
    if (j < 3) return (x + j) % 4 < 2 ? (j === 0 ? "M" : "L") : "K";
    const s = Math.floor((x - 4) / 11);
    const t = (x - 4 - s * 11 + 0.5) / 11;
    const bot = 8 + Math.round(4 * Math.sin(Math.PI * t));
    if (j > bot) return null;
    if (j === bot) return "K";
    return s % 2 ? (j < 5 ? "E" : "D") : j < 5 ? "B" : "r";
  });
  const hemL = cv(9, HEM_H);
  hemCv(hemL, 0);
  const shadow = groundShadow(EW / 2, EFOOT - 1, 30, 3);
  return def("entrance", [2, 1], EW, EH, [EW / 2, EFOOT], [
    [
      shadow,
      day,
      half(false),
      half(true),
      tail(false),
      tail(true),
      val,
      pole(4, 2, EFOOT + 1),
      pole(EW - 5, 2, EFOOT + 1),
    ],
  ]);
})();

// ==== Balloons: chess pieces twisted from balloons, as Babur's look (round, shiny, a knot under each), lit from the top left.

const SIL: Record<string, readonly string[]> = {
  pawn: ["...###...", "..#####..", ".#######.", ".#######.", "..#####..", "...###...", "..#####..", "...###...", "..#####..", ".#######.", "#########", ".#######.", "....n...."],
  rook: ["##.###.##", "#########", ".#######.", "..#####..", "..#####..", "..#####..", "..#####..", ".#######.", "#########", ".#######.", "....n...."],
  knight: ["....#.#..", "...#####.", "..#######", ".########", "#########", "###.#####", "#...#####", "....#####", "...######", "..#######", ".########", "..######.", ".....n..."],
  bishop: ["...#...", "..###..", "..###..", ".#####.", ".#####.", ".##.##.", "..###..", "...#...", "..###..", ".#####.", "#######", ".#####.", "...n..."],
  round: ["..###..", ".#####.", "#######", "#######", "#######", ".#####.", "..###..", "...n..."],
  king: [
    "......###......",
    "......###......",
    "...#########...",
    "...#########...",
    "......###......",
    ".....#####.....",
    "...#########...",
    "..###########..",
    "..###########..",
    "...#########...",
    ".....#####.....",
    "...#########...",
    "....#######....",
    ".....#####.....",
    ".....#####.....",
    "....#######....",
    "....#######....",
    ".....#####.....",
    "....#######....",
    "...#########...",
    "..###########..",
    ".#############.",
    "###############",
    "###############",
    ".#############.",
    "..###########..",
    ".......n.......",
  ],
};
/** A balloon piece with its top-left at (x, y): `ramp` dark, mid, light; a shine in its upper left. */
function balloon(x: number, y: number, kind: string, ramp: string, flip = false): Bit {
  const sil = SIL[kind]!.map((r) => (flip ? [...r].reverse().join("") : r));
  const on = (i: number, j: number) => (sil[j]?.[i] ?? ".") === "#";
  let shine = false;
  const grid = sil.map((row, j) =>
    [...row]
      .map((ch, i) => {
        if (ch === "n") return ramp[0]!;
        if (ch !== "#") return ".";
        const [l, r, u, d] = [!on(i - 1, j), !on(i + 1, j), !on(i, j - 1), !on(i, j + 1)];
        if (!shine && !l && !u && on(i - 1, j - 1) && !on(i - 2, j - 1) && j < sil.length / 2) {
          shine = true;
          return "w";
        }
        if (r || d) return ramp[0]!;
        if (l || u) return ramp[2]!;
        return ramp[1]!;
      })
      .join(""),
  );
  return { part: { grid, outline: true }, at: [x, y] };
}
const BAL = { blue: "GHI", green: "XYZ", purple: "abc", yellow: "def", red: "ABC" } as const;

// ==== The backdrop behind the counter: four squares of the wall dressed as a little stage.

const BDW = 4 * T;
const BDH = WALL_H + POLE_UP;
export const SHOP_BABUR_BACKDROP = (() => {
  const c = cv(BDW, BDH);
  const w1 = cv(T, WALL_H);
  wallCv(w1, 0);
  fill(c, (x, y) => (y < POLE_UP ? null : w1[y - POLE_UP]![x % T]!));
  // The drapes: red velvet hanging either side from the top, gathered back by gold ties.
  const drape = (right: boolean) =>
    paint(right ? BDW - 30 : 0, POLE_UP + 4, 30, WALL_H - 4, (xx, y) => {
      const x = right ? BDW - 1 - xx : xx;
      const j = y - POLE_UP - 4;
      const tie = 66;
      const reach = j < tie ? 10 + 18 * (1 - j / tie) ** 1.4 : 10 + 6 * ((j - tie) / (WALL_H - 4 - tie));
      if (x > reach) return null;
      if (j >= tie - 2 && j <= tie + 2) return x > reach - 1 ? "K" : j === tie - 2 ? "M" : "L";
      if (x > reach - 1.5) return "C";
      return Math.floor((x * 7) / Math.max(8, reach)) % 3 === 2 ? "A" : right ? "r" : "B";
    });
  // The swag across the top: a deep red sweep with a gold fringe.
  const swag = paint(0, POLE_UP + 3, BDW, 26, (x, y) => {
    const j = y - POLE_UP - 3;
    const t = (x + 0.5) / BDW;
    const bot = 9 + 12 * Math.sin(Math.PI * t);
    if (j > bot + 2) return null;
    if (j > bot) return x % 3 === 0 ? null : j > bot + 1 ? "K" : "L"; // the fringe
    if (j < 2) return "k";
    return j > bot - 2 ? "A" : Math.abs(j - bot * 0.5) < 1 ? "C" : "B";
  });
  // The medallion: a gold-rimmed round of cream with a blue balloon knight in it.
  const MX = BDW / 2;
  const MY = POLE_UP + 62;
  const medal = paint(MX - 17, MY - 17, 35, 35, (x, y) => {
    const d = Math.hypot(x + 0.5 - MX - 0.5, y + 0.5 - MY - 0.5);
    if (d > 17) return null;
    if (d > 14) return x + y < 2 * MX - 6 ? (d > 16 ? "K" : "L") : d > 16 ? "J" : "K";
    if (d > 13) return "k";
    return d > 11 && x + y > 2 * MX + 4 ? "T" : "U";
  });
  const knight = balloon(MX - 5, MY - 8, "knight", BAL.blue);
  return def("backdrop", [4, 1], BDW, BDH, [BDW / 2, BDH - 1], [
    [{ part: asPart(c), at: [0, 0] }, drape(false), drape(true), swag, medal, knight, pole(T * 2, 1, POLE_UP + 6)],
  ]);
})();

// ==== The counter: a circus ticket booth's, four squares wide.

const CW = 4 * T;
const CH = 58;
const CFOOT = CH - 3;
const CTOP = 10; // the top's upper edge
/** The plaque on its front (blank: the game writes on it). */
const PLQ = { x: 44, y: 27, w: 60, h: 20 } as const;
export const SHOP_BABUR_COUNTER_SIGN = signFace(PLQ.x, PLQ.y, PLQ.w, PLQ.h);
/** Where the crate stands on the counter: its foot, in the counter's pixels. */
export const SHOP_BABUR_CRATE_AT: Pt = [112, CTOP + 3];
const STAR = ["...L...", "..LML..", "LLLMLLK", ".LLLLK.", "..LKK..", ".LK.KK.", ".K...K."];
export const SHOP_BABUR_COUNTER = (() => {
  const body = paint(4, CTOP, CW - 8, CFOOT - CTOP, (x, y) => {
    const j = y - CTOP;
    const i = x - 4;
    const n = CW - 8;
    // The top: a plank seen a little from above, its front edge.
    if (j < 4) return j === 0 ? "Q" : j === 3 ? "O" : grain(x >> 2, j, 2) > 0.8 ? "Q" : "P";
    if (j === 4) return "N";
    const fb = CFOOT - CTOP; // its height
    if (j >= fb - 4) return j === fb - 4 ? "P" : "O"; // the plinth
    if (j === 5 || j === fb - 6) return "L";
    if (j === 6 || j === fb - 5) return "K";
    // The bulbs: a row of them under the top, unlit (pale glass on gold sockets).
    const b = (i - 3) % 10;
    if (j >= 8 && j <= 10 && b >= 0 && b <= 2 && i < n - 3) {
      if (j === 10) return b === 1 ? "K" : null;
      return j === 8 ? (b === 0 ? null : b === 1 ? "F" : null) : b === 0 ? "E" : b === 1 ? "E" : "D";
    }
    // The red panel: lit along its left, its right end in shade.
    return i < 2 ? "C" : i > n - 4 ? "A" : "B";
  });
  // Fix the bulbs' round tops (they read as little domes).
  const bulbs = paint(4, CTOP + 7, CW - 8, 4, (x, y) => {
    const i = x - 4;
    const b = (i - 3) % 10;
    if (i < 3 || i > CW - 14 || b < 0 || b > 2) return null;
    const j = y - CTOP - 7;
    if (j === 0) return b === 1 ? "D" : null;
    if (j === 3) return b === 1 ? "K" : null;
    return b === 0 ? (j === 1 ? "F" : "E") : b === 1 ? "E" : "D";
  });
  const plaque = signBoard(PLQ.x, PLQ.y, PLQ.w, PLQ.h);
  const stars = cv(CW, CH);
  stamp(stars, 17, 32, STAR);
  stamp(stars, CW - 24, 32, STAR);
  // The booth's corner posts, a gold ball on each.
  const post = (px: number) =>
    paint(px - 3, 1, 7, CFOOT - 1, (x, y) => {
      const X = x - px;
      if (y < 7) {
        const d = Math.hypot(X, y - 3.5);
        return d > 3.2 ? null : X < 0 && y < 4 ? "M" : X > 0 || y > 5 ? "K" : "L";
      }
      if (Math.abs(X) > 2) return y > CFOOT - 5 ? (X < 0 ? "P" : "O") : null;
      if (y < 9 || y > CFOOT - 6) return X < 0 ? "L" : "K";
      return X < 0 ? "C" : X > 1 ? "A" : "B";
    });
  return def("counter", [4, 1], CW, CH, [CW / 2, CFOOT], [
    [groundShadow(CW / 2, CFOOT, CW / 2 - 2, 4), body, bulbs, plaque, { part: asPart(stars, true), at: [0, 0] }, post(4), post(CW - 5)],
  ]);
})();

/**
 * Babur's Boss Crate: a wooden crate in his colors, red bands, gold corners, a gold star on its front and a bow of twisted
 * red balloons on its lid. `idle`: a glint runs round its gold corners (4 frames, slow), so it reads as the thing you buy.
 */
const XW = 30;
const XH = 27;
export const SHOP_BABUR_CRATE = (() => {
  const box = crate(1, 8, 28, 18, "NOPQ");
  const trim = paint(1, 8, 28, 18, (x, y) => {
    const i = x - 1;
    const j = y - 8;
    const corner = (i < 4 || i > 23) && (j < 4 || j > 13);
    if (corner) return (i < 4 ? i : 27 - i) + (j < 4 ? j : 17 - j) > 4 ? null : i < 4 && j < 4 ? "M" : i > 23 || j > 13 ? "K" : "L";
    if ((i >= 7 && i <= 9) || (i >= 18 && i <= 20)) return j === 0 ? "C" : i === 7 || i === 18 ? "C" : i === 9 || i === 20 ? "A" : "B";
    const star = ["..L..", ".LML.", "LLLLK", ".LKK.", ".K.K."];
    const s = star[j - 7]?.[i - 11];
    return s && s !== "." ? s : null;
  }, false);
  const loopL = paint(6, 2, 8, 6, (x, y) => {
    const d = ((x + 0.5 - 10) / 4) ** 2 + ((y + 0.5 - 5) / 3) ** 2;
    return d > 1 ? null : x < 9 && y < 4 ? "C" : x > 11 || y > 6 ? "A" : "B";
  });
  const loopR = paint(16, 2, 8, 6, (x, y) => {
    const d = ((x + 0.5 - 20) / 4) ** 2 + ((y + 0.5 - 5) / 3) ** 2;
    return d > 1 ? null : x < 19 && y < 4 ? "C" : x > 21 || y > 6 ? "A" : "B";
  });
  const knot = paint(13, 4, 4, 4, (x, y) => (y === 4 ? (x === 13 || x === 16 ? null : "C") : x > 14 ? "A" : "B"));
  const glints: Pt[] = [[3, 9], [26, 9], [26, 24], [3, 24]];
  const frames = glints.map(([gx, gy]) => {
    const g = paint(gx - 1, gy - 1, 3, 3, (x, y) => (x === gx && y === gy ? "F" : x === gx || y === gy ? "M" : null), false);
    return [groundShadow(XW / 2, XH - 2, 13, 2), box, trim, loopL, loopR, knot, g];
  });
  return def("crate", [1, 1], XW, XH, [XW / 2, XH - 2], frames, 450);
})();

// ==== The props.

/** A finished balloon's string, from its knot (kx, ky) down to (ax, ay): one pixel, no gaps, no outline. */
function strings(lines: readonly (readonly [number, number, number, number])[], w: number, h: number): Bit {
  const c = cv(w, h);
  for (const [kx, ky, ax, ay] of lines) {
    const n = Math.max(Math.abs(ax - kx), Math.abs(ay - ky));
    for (let s = 0; s <= n; s++) {
      const t = s / n;
      // A slight curve: the string sags a pixel or two sideways halfway.
      put(c, Math.round(kx + (ax - kx) * t + Math.sin(Math.PI * t) * 1.5), Math.round(ky + (ay - ky) * t), "s");
    }
  }
  return { part: asPart(c), at: [0, 0] };
}

/**
 * Babur's balloon-twisting stand, two squares wide: a little wooden cart (a red apron with gold trim, wheels), a pegboard
 * on its back with long uninflated balloons hanging from it in colors, his red and gold pump on its left, and three finished
 * balloons tied to the pump bobbing above (idle: 4 frames, each a pixel up and down, out of step).
 */
const BSW = 2 * T;
const BSH = 96;
const BSF = BSH - 4;
export const SHOP_BABUR_BALLOON_STAND = (() => {
  const TOPY = 60; // the cart's top
  const board = paint(30, 30, 38, TOPY - 30, (x, y) => {
    const i = x - 30;
    const j = y - 30;
    if (i < 2 || i > 35 || j < 2) return j === 0 || i === 0 ? "Q" : i === 37 ? "N" : "P";
    if (j % 9 === 4 && i % 6 === 3) return "N"; // the pegs' holes
    return grain(x >> 2, y, 4) > 0.85 ? "P" : "O";
  });
  // Long limp balloons hanging from the pegs: thin, a little wavy, each a color.
  const limp = cv(BSW, BSH);
  const LIMP: [number, number, string, number][] = [[33, 34, "abc", 16], [39, 34, "GHI", 20], [45, 34, "XYZ", 14], [51, 34, "def", 19], [57, 34, "ABC", 15], [63, 34, "abc", 12], [36, 43, "def", 12], [48, 43, "GHI", 11], [60, 43, "XYZ", 12]];
  for (const [lx, ly, ramp, len] of LIMP) {
    const pts: Pt[] = [];
    for (let j = 0; j < len; j++) {
      const sx = lx + Math.round(Math.sin(j * 0.6 + lx) * 0.7);
      pts.push([sx, ly + j]);
      if (j > 1 && j < len - 2) pts.push([sx + 1, ly + j]);
    }
    for (const [x, y] of pts) put(limp, x, y, x === lx + Math.round(Math.sin((y - ly) * 0.6 + lx) * 0.7) ? ramp[2]! : ramp[0]!);
  }
  const top = paint(6, TOPY, 64, 4, (x, y) => (y === TOPY ? "Q" : y === TOPY + 3 ? "N" : "P"));
  const apron = paint(8, TOPY + 4, 60, 16, (x, y) => {
    const j = y - TOPY - 4;
    const i = x - 8;
    if (j === 0 || j === 14) return "L";
    if (j === 15) return "K";
    // Scallops on its lower edge, red, a white stripe through it.
    if (j >= 6 && j <= 8) return i > 56 ? "q" : j === 6 ? "F" : "E";
    return i < 2 ? "C" : i > 56 ? "A" : "B";
  });
  const legs = paint(10, TOPY + 20, 56, BSF - TOPY - 20, (x, y) => (x <= 12 || x >= 63 ? (x === 10 || x === 63 ? "P" : "O") : null));
  const wheel = (cx: number) =>
    paint(cx - 5, BSF - 10, 11, 11, (x, y) => {
      const d = Math.hypot(x + 0.5 - cx - 0.5, y + 0.5 - (BSF - 4.5));
      if (d > 5.2) return null;
      if (d > 3.8) return x + y < cx + BSF - 6 ? "L" : "K";
      if (d < 1.3) return "L";
      return (x === cx || y === BSF - 5) ? "K" : "r";
    });
  // The pump: a red barrel with gold bands, its T-handle up, its nozzle to the right.
  const pump = paint(9, 34, 16, TOPY - 34, (x, y) => {
    const j = y - 34;
    const X = x - 16;
    if (j < 2) return Math.abs(X) <= 5 ? (j === 0 ? "Q" : "O") : null; // the T-handle
    if (j < 8) return X === 0 ? "D" : X === 1 ? "q" : null; // its rod
    if (j < 10) return Math.abs(X) <= 4 ? (X < 0 ? "L" : "K") : null; // a gold cap
    if (Math.abs(X) > 4) return X === 6 && j > 18 && j < 23 ? "K" : X === 7 && j > 18 && j < 21 ? "K" : null; // the nozzle
    if (j === 16 || j === 23) return X < 0 ? "L" : "K";
    return X < -2 ? "C" : X > 2 ? "A" : "B";
  });
  // The finished balloons above, tied to the pump's handle.
  const BOB: [string, string, number, number, number][] = [["round", BAL.yellow, 4, 7, 0], ["pawn", BAL.purple, 14, 3, 1], ["knight", BAL.blue, 23, 10, 2]];
  const frames = [0, 1, 2, 3].map((f) => {
    const balls = BOB.map(([kind, ramp, bx, by, ph]) => {
      const dy = [0, -1, 0, 1][(f + ph) % 4]!;
      return { b: balloon(bx, by + dy, kind, ramp), kx: bx + Math.floor(SIL[kind]![0]!.length / 2), ky: by + dy + SIL[kind]!.length };
    });
    const str = strings(balls.map(({ kx, ky }) => [kx, ky, 16, 34] as const), BSW, BSH);
    return [groundShadow(BSW / 2, BSF, 33, 4), board, { part: asPart(limp, true), at: [0, 0] as Pt }, top, apron, legs, wheel(16), wheel(58), str, pump, ...balls.map((b) => b.b)];
  });
  return def("balloon-stand", [2, 1], BSW, BSH, [BSW / 2, BSF], frames, 300);
})();

/** The old fire hoop, retired for good and cold: a plain gold ring on a stand, a blue ribbon tied on top. Still. */
const HSH = 86;
const HSF = HSH - 3;
export const SHOP_BABUR_HOOP_STAND = (() => {
  const CY = 26;
  const R = 15;
  const ring = paint(18 - R - 1, CY - R - 1, 2 * R + 3, 2 * R + 3, (x, y) => {
    const X = x + 0.5 - 18.5;
    const Y = y + 0.5 - CY - 0.5;
    const d = Math.hypot(X, Y);
    if (d > R || d < R - 3.2) return null;
    const lit = -X - Y; // from the top left
    if (d > R - 1) return lit > 4 ? "L" : "K"; // its outer edge
    if (d < R - 2.2) return lit > 4 ? "K" : "J"; // its inner edge, in its own shade
    return lit > 6 ? "M" : lit > -6 ? "L" : "K";
  });
  const stand = paint(16, CY + R - 1, 5, HSF - CY - R - 3, (x) => (x === 16 ? "Q" : x === 20 ? "N" : x === 17 ? "P" : "O"));
  const foot = paint(6, HSF - 5, 25, 5, (x, y) => {
    const j = y - (HSF - 5);
    const half = j < 2 ? 5 : 12;
    if (Math.abs(x - 18) > half) return null;
    return j === 0 || j === 2 ? "L" : j === 4 ? "J" : "K";
  });
  const bow = cv(37, 20);
  stamp(bow, 11, 6, ["GG.....GG", "GIG...GIG", "GHHG.GHHG", ".GHHHHHG.", "..GG.GG..", ".GH...HG.", ".H.....H.", "GH.....HG", "G.......G"]);
  stamp(bow, 15, 8, ["I"]);
  return def("hoop-stand", [1, 1], T, HSH, [18, HSF], [[groundShadow(18, HSF, 13, 3), stand, foot, ring, { part: asPart(bow, true), at: [0, 0] }]]);
})();

/** A little heap of finished balloon pieces on a low crate: a green rook and a purple pawn, a blue knight on them, a yellow bishop leaning at its side. */
const STH = 60;
const STF = STH - 3;
export const SHOP_BABUR_BALLOON_STACK = (() => {
  const box = crate(5, STF - 12, 22, 12, "NOPQ");
  return def("balloon-stack", [1, 1], T, STH, [18, STF], [
    [
      groundShadow(18, STF, 16, 3),
      box,
      balloon(5, STF - 23, "rook", BAL.green),
      balloon(15, STF - 25, "pawn", BAL.purple),
      balloon(9, STF - 34, "knight", BAL.blue),
      balloon(27, STF - 13, "bishop", BAL.yellow),
    ],
  ]);
})();

/** The centerpiece: the tiger's old circus drum (red, gold bands and studs, a star) with a big blue balloon king on it. */
const PDH = 72;
const PDF = PDH - 4;
export const SHOP_BABUR_PEDESTAL = (() => {
  const RX = 14;
  const RY = 4;
  const TOPC = PDF - 26; // the middle of its top's oval
  const drum = paint(18 - RX, TOPC - RY, 2 * RX + 1, PDF - TOPC + 2 * RY, (x, y) => {
    const X = x + 0.5 - 18.5;
    const s = X / RX;
    if (Math.abs(s) > 1) return null;
    const c = Math.sqrt(1 - s * s);
    const yTop = TOPC - RY * c;
    const yUp = TOPC + RY * c;
    const yBot = PDF - RY + RY * c;
    if (y + 0.5 < yTop || y + 0.5 > yBot) return null;
    if (y + 0.5 <= yUp) return Math.hypot(X / RX, (y + 0.5 - TOPC) / RY) > 0.8 ? (X < 2 ? "L" : "K") : X < -3 ? "F" : "E"; // its top: a gold rim round a drumskin
    const h = y + 0.5 - (yUp);
    const fromBot = yBot - (y + 0.5);
    const lit = 0.6 - 0.6 * s;
    if (h < 3 || fromBot < 3) return lit > 0.75 ? "M" : lit > 0.35 ? "L" : "K"; // gold bands
    // Studs along the bands, and the red between.
    if ((h < 4 || fromBot < 4) && Math.round(s * 5) === s * 5) return "M";
    return lit > 0.85 ? "C" : lit > 0.3 ? "B" : "A";
  });
  const star = cv(T, PDH);
  stamp(star, 15, PDF - 15, STAR);
  return def("pedestal", [1, 1], T, PDH, [18, PDF], [
    [groundShadow(18, PDF, 16, 4), drum, { part: asPart(star, true), at: [0, 0] }, balloon(11, TOPC - 26, "king", BAL.blue)],
  ]);
})();

/** A costume trunk: domed lid, red panels in a wooden frame, gold corners and lock, a spare top hat and a striped scarf on it. */
const TRH = 44;
const TRF = TRH - 3;
export const SHOP_BABUR_TRUNK = (() => {
  const body = paint(4, TRF - 15, 29, 15, (x, y) => {
    const i = x - 4;
    const j = y - (TRF - 15);
    if ((i < 3 || i > 25) && (j < 3 || j > 11)) return i < 3 && j < 3 ? "M" : "K"; // corners
    if (i < 2 || i > 26 || j < 1 || j > 13 || i === 14) return i > 26 || j > 13 ? "N" : "P";
    if (i >= 12 && i <= 16 && j >= 2 && j <= 6) return j === 2 ? "M" : i === 14 && j === 5 ? "J" : "L"; // the lock
    return i > 23 || j > 11 ? "A" : i < 4 ? "C" : "B";
  });
  const lid = paint(4, TRF - 23, 29, 8, (x, y) => {
    const X = x + 0.5 - 18.5;
    const j = y - (TRF - 23);
    if (j < 3 && Math.abs(X) > 11 + j * 1.5) return null;
    if (j >= 6) return j === 6 ? "L" : "K"; // its gold rim
    return X > 11 ? "O" : j < 2 ? "Q" : X < -9 ? "Q" : "P";
  });
  // A scarf spilling over the lid's edge, red and white striped.
  const scarf = paint(5, TRF - 20, 8, 15, (x, y) => {
    const j = y - (TRF - 20);
    const w = j < 3 ? 8 : 5;
    if (x - 5 >= w) return null;
    if (j === 14) return x % 2 ? "L" : null; // its fringe
    return Math.floor(j / 3) % 2 ? (x - 5 === w - 1 ? "D" : "E") : x - 5 === w - 1 ? "A" : "B";
  });
  // A spare top hat on the lid: black, a red band.
  const hat = paint(17, TRF - 37, 14, 15, (x, y) => {
    const j = y - (TRF - 37);
    const X = x - 24;
    if (j >= 13) return Math.abs(X) <= 6 ? (j === 13 ? "W" : "V") : null; // the brim
    if (Math.abs(X) > 4) return null;
    if (j >= 9 && j <= 11) return j === 9 ? "C" : X > 2 ? "A" : "B";
    return X < -2 ? "W" : "V";
  });
  return def("trunk", [1, 1], T, TRH, [18, TRF], [[groundShadow(18, TRF, 16, 3), body, lid, scarf, hat]]);
})();

/** A rack of juggling pins: a low wooden stand, five white pins in a row, each with a red or blue band. */
const PRH = 46;
const PRF = PRH - 3;
export const SHOP_BABUR_PIN_RACK = (() => {
  const PIN = ["..##..", ".####.", ".####.", "..##..", "..##..", "..##..", "..##..", ".####.", ".####.", "######", "######", "######", "######", "######", ".####.", ".####.", "..##.."];
  const pin = (px: number, band: string) =>
    paint(px, PRF - 21, 6, 17, (x, y) => {
      const j = y - (PRF - 21);
      const i = x - px;
      if (PIN[j]![i] !== "#") return null;
      if (j === 4 || j === 5 || j === 11) return band[i > 2 ? 0 : 1]!;
      return i >= 4 || j >= 15 ? "D" : i <= 1 && j > 0 ? "F" : "E";
    });
  // A rail behind them on two posts, and a low tray they stand in.
  const rail = paint(3, PRF - 18, 31, 15, (x, y) => {
    const j = y - (PRF - 18);
    if (j < 3) return j === 0 ? "Q" : j === 2 ? "O" : "P";
    return x === 4 ? "P" : x === 32 ? "O" : null;
  });
  const tray = paint(2, PRF - 5, 33, 5, (x, y) => {
    const j = y - (PRF - 5);
    return j === 0 ? "Q" : j === 4 ? "N" : x > 31 ? "O" : grain(x >> 2, y, 6) > 0.8 ? "Q" : "P";
  });
  return def("pin-rack", [1, 1], T, PRH, [18, PRF], [
    [groundShadow(18, PRF, 16, 3), rail, pin(4, "AB"), pin(12, "GH"), pin(20, "AB"), pin(28, "GH"), tray],
  ]);
})();

// ==== The room's showpiece (Eric, Nov 2): three burning hoops on stands, the ones Babur throws in his ultimate.

/**
 * `fire-hoop-a`, `-b`, `-c` (3 x 1 squares each, Nov 2, third pass: about 2.5 times the first): the same big steel hoop,
 * 71 px across, upright facing you, its bottom a square above the floor on a tall steel post with a gold collar gripping the
 * ring and a round steel base, layered tongues of fire licking up and outward all round it (the tiger's hoop: wrapped steel
 * lit from the top left; the fire white-hot at the ring, then yellow, orange, red, dark red at the tips). `idle`: only the
 * flames move (8 x 110 ms, looping): each tongue swells and sinks on a whole number of cycles a loop and a lick runs up it;
 * sparks rise off it now and then. The three pieces are one drawing with their frames shifted (0, 3, 5 frames), so they
 * never burn in step. The picture is 4 px wider each side than its three squares.
 */
const FHM = 4; // the margin each side
const FHW = 3 * T + 2 * FHM;
const FHH = 152;
const FHF = FHH - 3;
const FH_R = 35; // the ring's outer radius (71 across), the steel 5 thick
const FH_IN = FH_R - 5;
const FH_CY = FHF - T - FH_R; // its middle: its bottom a square above the floor
const FH_CX = FHM + Math.floor((3 * T) / 2);
const FH_N = 8; // frames
const HEAT = "ilmnR"; // dark red to white-hot
/** The steel ring and its fire at frame `f` (one canvas, the whole piece wide, outlined as one). */
function hoopFire(f: number): Bit {
  const cx = FH_CX;
  const cy = FH_CY;
  const c = cv(FHW, cy + FH_R + 3);
  const t = f / FH_N;
  // The steel: a round tube lit from the top left (bright on its upper left, its inner face lit on the hole's lower right),
  // wrapped with slanted dark tape.
  for (let y = 0; y < c.length; y++)
    for (let x = 0; x < FHW; x++) {
      const [X, Y] = [x - cx, y - cy];
      const d = Math.hypot(X, Y);
      if (d > FH_R + 0.3 || d < FH_IN + 0.3) continue;
      const ang = Math.atan2(Y, X);
      const s = (d - FH_IN - 0.3) / (FH_R - FH_IN); // 0 its inner edge, 1 its outer
      const lit = (-X - Y) / (d * Math.SQRT2);
      const b = 0.42 + 0.4 * lit * (2 * s - 1) + 0.28 * (1 - Math.abs(2 * s - 1)) + 0.12 * lit;
      const wrap = Math.floor(((ang + Math.PI) / (2 * Math.PI)) * 84 + s * 2.2) % 6 === 0;
      const k = b > 0.68 ? "=" : b > 0.36 ? "&" : "%";
      put(c, x, y, wrap ? (k === "=" ? "&" : "%") : k);
    }
  // The fire: two layers of tongues off the outer edge, big ones and short hot ones between them, each leaning out and up,
  // longest over the top, short along the bottom (none where the collar grips it).
  const g = (i: number, sd: number) => grain(i, 0, sd);
  const LAYERS = [
    { n: 28, k: 1, hot: 0, sd: 31, off: 0 },
    { n: 28, k: 0.55, hot: 0.22, sd: 41, off: 0.5 },
  ];
  for (const L of LAYERS)
    for (let i = 0; i < L.n; i++) {
      const a = ((i + L.off + 0.5 * g(i, L.sd)) / L.n) * Math.PI * 2;
      const [ox, oy] = [Math.cos(a), Math.sin(a)];
      if (oy > 0.86) continue;
      const [bx, by] = [cx + ox * (FH_R + 0.5), cy + oy * (FH_R + 0.5)];
      let [dx, dy] = [ox * 0.6 + Math.sign(ox) * Math.max(0, oy) * 1.2, -1 + Math.min(0, oy) * 0.3];
      const dl = Math.hypot(dx, dy);
      [dx, dy] = [dx / dl, dy / dl];
      const cyc = 1 + ((i + (L.off ? 1 : 0)) % 2);
      const len = (20 - 10 * Math.min(0, oy) - 6 * Math.max(0, oy)) * (0.65 + 0.35 * g(i, L.sd + 1)) * (0.7 + 0.3 * Math.sin(2 * Math.PI * (t * cyc + g(i, L.sd + 2)))) * L.k;
      const width = Math.min(5.5, 1.8 + len * 0.2);
      for (let y = Math.floor(by - len - 6); y <= by + 6; y++)
        for (let x = Math.floor(bx - len - 6); x <= bx + len + 6; x++) {
          if (y < 0 || y >= c.length || x < 0 || x >= FHW) continue;
          if (Math.hypot(x - cx, y - cy) <= FH_R + 0.3) continue; // never on the steel, never in the hole
          const [px, py] = [x - bx, y - by];
          const al = px * dx + py * dy;
          if (al < -1 || al > len) continue;
          const fr = Math.max(0, al) / len;
          // A lick: the tongue sways more toward its tip, the wave running up it twice a loop.
          const across = Math.abs(-px * dy + py * dx + Math.sin(al * 0.45 - 2 * Math.PI * 2 * t + i * 1.7) * 1.4 * fr);
          const prof = fr < 0.25 ? 0.8 + 0.8 * fr : (1 - fr) / 0.75;
          if (across > width * prof + 0.3) continue;
          const heat = 1 - fr * 0.95 - (across / (width * Math.max(prof, 0.2))) * 0.3 + L.hot;
          const key = heat > 0.78 ? "R" : heat > 0.56 ? "n" : heat > 0.36 ? "m" : heat > 0.16 ? "l" : "i";
          const old = c[y]![x]!;
          if (HEAT.indexOf(key) > HEAT.indexOf(old)) put(c, x, y, key); // the hotter wins where tongues overlap
        }
    }
  return { part: asPart(c, true), at: [0, 0] };
}
/** The stand: a round steel base, a steel post 5 wide lit on its left, a gold band at its foot. */
const hoopStand = (): Bit[] => {
  const cx = FH_CX;
  const top = FHF - 5; // the base's top face, its middle
  return [
    groundShadow(cx, FHF, 20, 4),
    paint(cx - 12, top - 4, 25, 11, (x, y) => {
      const X = x - cx;
      const sx = X / 12.4;
      if (Math.abs(sx) > 1) return null;
      const cc = Math.sqrt(1 - sx * sx);
      const [y0, y1] = [top - 3.6 * cc, top + 3.6 * cc];
      if (y + 0.5 < y0 || y + 0.5 > y1 + 3) return null;
      if (y + 0.5 <= y1) return X < 4 ? "=" : "&"; // its top face
      return y + 0.5 > y1 + 2 ? "%" : X < -4 ? "&" : "%"; // its rim
    }),
    paint(cx - 2, FH_CY + FH_R, 5, top - FH_CY - FH_R, (x) => {
      const X = x - cx;
      return X < 0 ? "=" : X === 0 ? "&" : X === 1 ? "&" : "%";
    }),
    paint(cx - 3, top - 3, 7, 3, (x, y) => {
      const X = x - cx;
      return y === top - 3 ? (X < 1 ? "M" : "L") : X < -1 ? "L" : X > 1 ? "J" : "K";
    }),
  ];
};
/** The gold collar gripping the ring's bottom. */
const hoopCollar = () =>
  paint(FH_CX - 4, FH_CY + FH_R - 4, 9, 8, (x, y) => {
    const X = x - FH_CX;
    const j = y - (FH_CY + FH_R - 4);
    if (j === 0) return Math.abs(X) > 3 ? null : X < 1 ? "M" : "L";
    if (j === 4) return X < 2 ? "L" : "K"; // a lit ridge round its middle
    return X < -2 ? "M" : X < 1 ? "L" : X > 2 ? "J" : "K";
  });
/** A spark rising off the hoop (no outline: a hot pixel over a cooler one), by its age 0 to 3. */
const spark = (x: number, y: number, age: number): Bit => paint(x, y, 1, 2, (_, yy) => (yy === y ? "Rnml"[age]! : "nmli"[age]!), false);
/** The hoop's sparks: [first frame, x off the ring's middle, y off the ring's top, drift per frame]. Each lives 4 frames. */
const SPARKS: readonly (readonly [number, number, number, number])[] = [
  [1, -9, -22, -1],
  [3, 30, -8, 1],
  [5, 12, -24, 1],
  [7, -34, -4, -1],
];
const hoopSparks = (f: number): Bit[] =>
  SPARKS.flatMap(([f0, sx, sy, dr]) => {
    const age = (f - f0 + FH_N) % FH_N;
    return age < 4 ? [spark(FH_CX + sx + dr * age, FH_CY - FH_R + sy - age * 5, age)] : [];
  });
const FIRES = Array.from({ length: FH_N }, (_, f) => hoopFire(f));
const STAND = hoopStand();
const COLLAR = hoopCollar();
/** A hoop piece: the drawing's frames from `shift` on, so each burns out of step with the others. */
const fireHoop = (name: string, shift: number) =>
  def(name, [3, 1], FHW, FHH, [FH_CX, FHF], Array.from({ length: FH_N }, (_, f) => {
    const g = (f + shift) % FH_N;
    return [...STAND, FIRES[g]!, COLLAR, ...hoopSparks(g)];
  }), 110);
export const SHOP_BABUR_FIRE_HOOP_A = fireHoop("fire-hoop-a", 0);
export const SHOP_BABUR_FIRE_HOOP_B = fireHoop("fire-hoop-b", 3);
export const SHOP_BABUR_FIRE_HOOP_C = fireHoop("fire-hoop-c", 5);
const HOOP_NAMES = ["fire-hoop-a", "fire-hoop-b", "fire-hoop-c"] as const;
/**
 * The hoops' fire at dusk and night, one per hoop piece (`piece`; x, y in that piece's own pixels): its flames (only the
 * fire's pixels light), flickering, a wide halo.
 */
export const SHOP_BABUR_HOOP_LIGHTS: readonly (LightSpot & { piece: string })[] = HOOP_NAMES.map((piece) => ({ piece, x: 0, y: 0, w: FHW, h: FH_CY + FH_R + 3, keys: HEAT, color: TORCH, strength: 1, flicker: true, halo: 56 }));
/** ... and a warm pool on the sawdust under each (in its piece's pixels, round its foot). */
export const SHOP_BABUR_HOOP_POOLS: readonly (LightPool & { piece: string })[] = HOOP_NAMES.map((piece) => ({ piece, x: FH_CX, y: FHF, rx: 52, ry: 15, color: TORCH, strength: 0.32 }));


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
  /** Squares wide, for the wide pieces (the counter 4, the backdrop 4, the balloon stand 2, the entrance 2), from `col` east. */
  w?: number;
  /** The way out (the entrance): walking into it leaves the tent. */
  exit?: boolean;
}
const LAYOUT: ShopPlace[] = [];
const at = (name: string, col: number, row: number, solid: boolean, more: Partial<ShopPlace> = {}) => {
  const p = PIECES[name];
  if (p) LAYOUT.push({ name, col, row, solid, ...(p.sq[0] > 1 ? { w: p.sq[0] } : {}), ...more });
};

// -- The floor (every square).
const DIAG: Record<string, [number, 0 | 1 | 2 | 3]> = {};
for (const [cs, rs, r] of [[[7, 6], [7, 8], 0], [[12, 13], [7, 8], 1], [[13, 12], [13, 14], 2], [[6, 7], [13, 14], 3]] as const) {
  DIAG[`${cs[0]},${rs[0]}`] = [0, r];
  DIAG[`${cs[1]},${rs[1]}`] = [0, r];
}
const CORNER: Record<string, 0 | 1 | 2 | 3> = { "7,8": 0, "12,8": 1, "12,13": 2, "7,13": 3 };
const SCRAPS = new Set(["2,6", "17,7", "4,16", "15,17", "13,4"]);
const SCUFF = new Set(["10,15", "9,16", "10,17", "9,4", "10,5", "9,6"]);
for (let row = 0; row < 20; row++)
  for (let col = 0; col < 20; col++) {
    const k = `${col},${row}`;
    const even = (col + row) % 2 === 0;
    if (DIAG[k]) at(even ? "ring-edge-diag" : "ring-edge-diag-b", col, row, false, { rot: DIAG[k]![1] });
    else if (CORNER[k] !== undefined) at("ring-edge-corner", col, row, false, { rot: CORNER[k] });
    else if (row === 7 && col >= 8 && col <= 11) at("ring-edge", col, row, false, { rot: 0 });
    else if (row === 14 && col >= 8 && col <= 11) at("ring-edge", col, row, false, { rot: 2 });
    else if (col === 6 && row >= 9 && row <= 12) at("ring-edge", col, row, false, { rot: 3 });
    else if (col === 13 && row >= 9 && row <= 12) at("ring-edge", col, row, false, { rot: 1 });
    else if (col >= 7 && col <= 12 && row >= 8 && row <= 13) at(even ? "ring-a" : "ring-b", col, row, false);
    else if (row === 18 && (col === 9 || col === 10)) at("floor-door", col, row, false);
    else if (SCRAPS.has(k) && even) at("floor-c", col, row, false);
    else if (SCUFF.has(k) && !even) at("floor-d", col, row, false);
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
  at([0, 6, 13, 19].includes(col) ? "wall-pole" : "wall", col, 0, true);
}
for (let row = 1; row < 19; row++) {
  at(row === 10 ? "wall-side-pole" : "wall-side", 0, row, true);
  at(row === 10 ? "wall-side-pole" : "wall-side", 19, row, true, { flip: true });
}
at("hem-pole", 0, 19, true);
for (let col = 1; col < 19; col++) if (col < 9 || col > 10) at("hem", col, 19, true);
at("entrance", 9, 19, false, { exit: true });
at("hem-pole", 19, 19, true, { flip: true });

// -- The shop and the props.
at("balloon-stand", 2, 3, true);
at("counter", 8, 3, true);
at("crate", 8, 3, false); // on the counter (see SHOP_BABUR_CRATE_AT): its place is the counter's
// The showpiece, burning: three big hoops down the east side, staggered (a and c on columns 15-17, b a square east on 16-18),
// four rows apart so their flames never touch; column 14 stays open beside the ring.
at("fire-hoop-a", 15, 5, true);
at("fire-hoop-b", 16, 9, true);
at("fire-hoop-c", 15, 13, true);
at("hoop-stand", 3, 7, true); // the old cold hoop, across the room out of the fire's way
at("pedestal", 9, 10, true);
at("balloon-stack", 3, 12, true);
at("trunk", 17, 16, true); // moved south, out of the hoops' way
at("pin-rack", 15, 17, true); // likewise

/** Where every piece goes: name, column (its west-most square), row, solid; floor tiles first, then the upright pieces north to south. */
export const SHOP_BABUR_LAYOUT: readonly ShopPlace[] = [...LAYOUT.slice(0, FLOOR_COUNT), ...LAYOUT.slice(FLOOR_COUNT).sort((a, b) => a.row - b.row || a.col - b.col)];

/** Every piece by its name (as SHOP_BABUR_LAYOUT names them), each its own Character `shop-babur-<name>`. */
export const SHOP_BABUR_PIECES: Readonly<Record<string, Character>> = Object.fromEntries(Object.values(PIECES).map((p) => [p.name, toChar(p)]));
