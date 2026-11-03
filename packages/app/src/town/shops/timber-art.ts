/**
 * Inside Timber's Lumber Lodge: Timber's shop (house-shop-timber). A room of 20 x 20 squares seen as the town square is
 * seen (the camera looks north, things stand upright at their foot, 37 px a square): the inside of the log lodge of
 * house-timber, in Timber's colors (boss-beaver: his fur browns, hard-hat orange, tool-belt yellow, hammer red, the planks'
 * wood). A woodshop and showroom: wide honey plank floor, board walls hung with tools, big bright windows between log posts
 * looking out on a pine forest and a river with a beaver dam. In the middle, the battle circle: the polished end grain of a
 * giant sawn log, cut to an octagon, in its bark. Built as Alfil's shop is (scripts/boss-art/out/house-shop-alfil).
 *
 * Footing: a piece's foot is the middle of its square (a wide piece's: the middle of its width, on the middle of its row;
 * a deep piece stands on its south row). Floor tiles are flat, top-down, 37 x 37, foot at their middle; the circle's tiles
 * are drawn for its north-west quarter and turned by `rot` (quarter turns clockwise) for the others; the east wall is the
 * west one mirrored (`flip`).
 *
 * Copied as drawn from `claude/boss-art` (scripts/boss-art/out/house-shop-timber/house-shop-timber.ts, Nov 3), its imports moved, its
 * room still and review strips (HOUSE_SHOP_TIMBER) left there, and the showpiece's squares made its picture's four (below). Built as
 * Big Boy's shop is (shops/bigboy-art.ts).
 */
import { frameKeys, type Anim, type Character, type Frame, type Layer, type Part } from "../../characters/sprite.ts";
import { grain, groundShadow, paint, signBoard, signFace, TORCH, WARM, type LightPool, type LightSpot, type Pt } from "../houses/kit.ts";

const PALETTE: Record<string, string> = {
  k: "#1e130d", // outline (Timber's)
  a: "#3e2415", // his fur browns, dark to light: logs, posts, the walls' boards, bark
  b: "#5d361d",
  c: "#7d4a27",
  d: "#9c6334",
  e: "#b97f4a",
  x: "#24160d", // bark's crevices
  o: "#b4520c", // his hard hat's orange: shadow, mid, light, highlight
  O: "#ea7816",
  L: "#ff9d3a",
  l: "#ffc77e",
  Y: "#f2c230", // his tool belt's yellow: mid, shadow, light
  y: "#c48f18",
  Z: "#ffe47c",
  R: "#d8302c", // his hammer's red: mid, shade
  r: "#8c1916",
  H: "#f6d38e", // raw wood (his planks'): light, mid, shade, grain
  h: "#e0aa5c",
  j: "#b47b36",
  J: "#7e5222",
  s: "#e2e7ec", // steel: light, mid, dark
  S: "#9aa4af",
  T: "#5c6570",
  v: "#ffffff", // a glint; the sale signs' white
  I: "#f6eed6", // cream (the marks' icons)
  q: "#3a170a", // varnished wood (the finished pieces): deep, dark, mid, light, shine
  Q: "#6b2c12",
  w: "#9c461c",
  W: "#cf7535",
  X: "#ffd08a",
  f: "#b98a55", // the floor's planks: one, the other, a lit edge, grain, the joints
  m: "#ae7e4a",
  g: "#c99b65",
  i: "#a0713f",
  n: "#6a4325",
  u: "#f5e2b4", // sawdust
  p: "#d4a76c", // daylight on the floor: soft, bright
  P: "#ebc78f",
  A: "#ecc285", // the circle's end grain: early wood, late wood, a dark ring, the pith, the sapwood
  B: "#dcaa6a",
  C: "#bf8547",
  D: "#8e5a2a",
  E: "#f7dca6",
  "1": "#9dd3f0", // the view: sky high, mid, the haze
  "2": "#c6e7f6",
  "3": "#ecf8fb",
  "4": "#a9cbbf", // far hills
  "5": "#4e9a56", // pines: lit, mid, deep
  "6": "#2f6d44",
  "7": "#1f4a33",
  "8": "#4aa0d4", // the river, its glints
  "9": "#a6def5",
  "0": "#7cbd5a", // the grassy bank: lit, shade
  "!": "#57934a",
  N: "#2b2522", // iron (the stove): dark, mid, light
  V: "#4a4440",
  z: "#77706a",
  "@": "#ffe08a", // fire: bright, mid, deep
  "#": "#ff9a3c",
  $: "#d9431c",
  "%": "#c9a56a", // the plaque's face: shadow, board, light
  "^": "#e8cc95",
  "&": "#f7e4b8",
  "-": "#0d0e1280", // ground shadow: core, rim
  "+": "#0d0e1244",
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
  return { id: `shop-timber-${p.name}`, name: `Timber's shop: ${p.name}`, w: p.w, h: p.h, foot: p.foot, palette: PALETTE, parts, anims: { idle: { loop: true, frames } } };
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
/** A shade by how far across a round form `X` (-1 its left edge to 1 its right): lit on the left. `ramp` light to dark (4). */
const roundTone = (X: number, ramp: string) => ramp[X < -0.55 ? 0 : X < 0.15 ? 1 : X < 0.7 ? 2 : 3]!;

// ==== The floor: wide honey planks running north to south, top-down, no outline, tiling seamlessly.

const PX = 18; // the joint between a tile's two planks (and one on its west edge)
/**
 * Two wide planks a tile: a dark joint on the west edge and between them, an end joint across each (staggered: `ends`), a
 * lit edge along each plank's west side and below each end joint, and two soft wavy grain lines a plank, broken in dashes.
 */
function boards(x: number, y: number, ends: readonly [number, number], seed: number): string {
  if (x === 0 || x === PX) return "n";
  const p = x < PX ? 0 : 1;
  const e = ends[p]!;
  if (y === e) return "n";
  if (x === 1 || x === PX + 1 || y === (e + 1) % T) return "g";
  const lx = x - (p ? PX + 1 : 1);
  for (let s = 0; s < 2; s++) {
    const sx = 4 + s * 8 + Math.floor(grain(p, s, seed) * 3);
    const wob = Math.round(Math.sin((y + s * 11 + seed * 3) / 6));
    if (lx === sx + wob && grain(Math.floor((y + s * 5 + seed) / 6), p * 2 + s, seed) > 0.4) return "i";
  }
  return p ? "m" : "f";
}
const ENDS_A = [11, 29] as const;
const ENDS_B = [27, 6] as const;
const boardA = (x: number, y: number) => boards(x, y, ENDS_A, 1);
const boardB = (x: number, y: number) => boards(x, y, ENDS_B, 2);
/** The plain floor at a square (checkered a and b). */
const floorAt = (col: number, row: number) => ((col + row) % 2 ? boardB : boardA);

const flat = (fn: (x: number, y: number) => Key): Bit[][] => [[paint(0, 0, T, T, fn, false)]];
const tileDef = (name: string, fn: (x: number, y: number) => Key) => def(name, [1, 1], T, T, [18, 18], flat(fn));

export const SHOP_TIMBER_FLOOR_A = tileDef("floor-a", boardA);
export const SHOP_TIMBER_FLOOR_B = tileDef("floor-b", boardB);

/** Variety on a: a knot in the west plank, the grain swirling round it; a little sprinkle of sawdust on the east one. */
export const SHOP_TIMBER_FLOOR_C = tileDef("floor-c", (x, y) => {
  const d = Math.hypot((x + 0.5 - 9.5) / 2.6, (y + 0.5 - 20) / 3.4);
  if (x > 1 && x < PX) {
    if (d < 0.55) return "J";
    if (d < 1) return "n";
    if (d < 1.6 && Math.abs(y + 0.5 - 20) > 1 && (x === 6 || x === 13)) return "i";
  }
  const s = Math.hypot(x + 0.5 - 27, (y + 0.5 - 9) * 1.4);
  if (x > PX + 1 && s < 5 && grain(x, y, 61) < 0.5 - s * 0.07) return "u";
  return boardA(x, y);
});

/** Variety on b: two curled shavings lying on the boards and a little sawdust round them. */
const SHAVING = [".hHHh..", "hH..Hh.", "H..h.H.", "Hh..jh.", ".hHHj.."];
export const SHOP_TIMBER_FLOOR_D = (() => {
  const c = cv(T, T);
  fill(c, (x, y) => {
    const s = Math.hypot(x + 0.5 - 16, (y + 0.5 - 24) * 1.3);
    if (s < 8 && grain(x, y, 62) < 0.42 - s * 0.04) return "u";
    return boardB(x, y);
  });
  stamp(c, 8, 18, SHAVING);
  stamp(c, 20, 25, SHAVING.map((r) => [...r].reverse().join("")));
  return def("floor-d", [1, 1], T, T, [18, 18], [[whole(c)]]);
})();

/** The daylight through the open door: a warm wash on the planks, bright at the door (south), fading as it goes north. */
export const SHOP_TIMBER_FLOOR_DOOR = tileDef("floor-door", (x, y) => {
  const base = boardB(x, y);
  if (base === "n") return base;
  const v = ((y + 0.5) / T) * 2.1;
  const th = bayer(x, y);
  if (v > 1 + th) return base === "g" ? "P" : "P";
  if (v > th * 0.9 + 0.1) return base === "i" ? "f" : "p";
  return base;
});

// ==== The battle circle: the polished end grain of a giant sawn log, cut to an octagon, in its bark.

const CX = 10 * T; // its middle, in the room's floor pixels (column 10's west edge, row 11's north edge)
const CY = 11 * T;
const HALF = 4 * T; // its straight sides' distance from the middle
const CUT = 6 * T; // |dx| + |dy| on its slanted sides
/** A point turned into the north-west quarter (the rings and the bark are the same in every quarter, so tiles turn). */
const canon = (dx: number, dy: number): [number, number] => {
  let [a, b] = [dx, dy];
  for (let i = 0; i < 4 && !(a < 0 && b < 0); i++) [a, b] = [b, -a];
  return [a, b];
};
/** The log round at a floor pixel (gx, gy): bark, sapwood, growth rings, the pith; null outside it. No marks. */
function logRound(gx: number, gy: number): Key {
  const [dx, dy] = canon(gx + 0.5 - CX, gy + 0.5 - CY);
  const ax = -dx;
  const ay = -dy;
  const e = Math.min(HALF - ax, HALF - ay, (CUT - ax - ay) / Math.SQRT2); // how deep inside its edge
  if (e < 0) return null;
  if (e < 10) {
    // The bark: a dark rim, ridges split by deep crevices across it, a pale inner bark.
    if (e < 1.2) return "x";
    if (e > 8.6) return "j";
    // Along the edge, the same at both ends of the quarter (so the turned quarters meet): 35 ridges a quarter.
    const al = ((Math.atan2(dy, dx) + Math.PI) / (Math.PI / 2)) * 245;
    const f = (((al + 2 * Math.sin((al * 2 * Math.PI) / 35) + (e > 5 ? 1 : 0)) % 7) + 7) % 7;
    if (f < 1.3) return "x";
    if (f < 2.2 || e > 7.4) return "a";
    return e < 3.5 ? "b" : f > 5 ? "b" : "c";
  }
  const r = Math.hypot(dx, dy);
  if (e < 17) return e < 11 ? "B" : "E"; // the pale sapwood ring
  const on = Math.max(ax, ay, (ax + ay) / 1.5);
  const t = Math.min(1, Math.max(0, (r - 30) / 100));
  // A wobble in the rings, by angle with a quarter turn's period (so the turned quarters meet).
  const th = Math.atan2(dy, dx);
  const m = r * (1 - t) + on * t + 1.8 * Math.sin(4 * th + r / 23) + 1.1 * Math.sin(12 * th + r / 9) * Math.min(1, r / 40);
  if (r < 3.2) return "D";
  if (r < 6) return "C";
  const idx = m / 6.2;
  const ring = Math.floor(idx);
  const fr = idx - ring;
  if (fr > 0.84) return ring % 4 === 3 ? "C" : "B";
  if (fr > 0.6) return "B";
  return "A";
}

/** The start marks: round brand-marks burnt into the wood, painted bold: the boss's in his orange with a hard hat, yours in yellow with a pawn. */
const MARKS = { boss: [8, 10.5] as Pt, you: [11, 10.5] as Pt };
export const SHOP_TIMBER_MARKS = { boss: [8, 10.5], you: [11, 10.5] } as const;
const HAT_ICON = ["....III....", "..IIIIIII..", ".IIIIIIIII.", ".IIIIIIIII.", "IIIIIIIIIII", "IIIIIIIIIII"];
const PAWN_ICON = ["...III...", "..IIIII..", "..IIIII..", "...III...", "..IIIII..", "...III...", "...III...", "..IIIII..", ".IIIIIII.", "IIIIIIIII"];
function markAt(gx: number, gy: number): Key {
  for (const [who, [mc, mr]] of Object.entries(MARKS)) {
    const mx = (mc + 0.5) * T;
    const my = mr * T;
    const X = gx + 0.5 - mx;
    const Y = gy + 0.5 - my;
    const d = Math.hypot(X, Y);
    if (d > 15.5) continue;
    const boss = who === "boss";
    if (d > 14.3) return "x"; // the scorched rim
    if (d > 12.8) return boss ? "o" : "y";
    if (d > 11.5) return boss ? "L" : "Z";
    const icon = boss ? HAT_ICON : PAWN_ICON;
    const ix = Math.floor(X + icon[0]!.length / 2);
    const iy = Math.floor(Y + icon.length / 2 + (boss ? 0 : 0));
    if (icon[iy]?.[ix] === "I") return "I";
    if (boss && iy === icon.length && ix >= -2 && ix <= icon[0]!.length + 1) return "I"; // the hat's brim
    return boss ? (X + Y > 9 ? "o" : "O") : X + Y > 9 ? "y" : "Y";
  }
  return null;
}

/**
 * The emblem in the circle's middle (where the table stands), 2 x 2 squares: a disc of dark varnish ringed in his yellow,
 * a red-handled hammer crossed over a hand saw.
 */
function emblemAt(gx: number, gy: number): Key {
  const X = gx + 0.5 - CX;
  const Y = gy + 0.5 - CY;
  const d = Math.hypot(X, Y);
  if (d > 34) return null;
  if (d > 33) return "x";
  if (d > 30) return d < 31.2 && X + Y < -10 ? "Z" : X + Y > 14 ? "y" : "Y";
  if (d > 29) return "x";
  // The hammer: handle bottom-left to top-right, its head across the top-right end.
  const hu = (X - Y) / Math.SQRT2; // along the handle
  const hv = (X + Y) / Math.SQRT2; // across it
  if (hu > 9 && hu < 17 && hv > -12 && hv < 10) {
    if (hv < -6 && hu > 12.2 && hu < 13.8) return "Q"; // the claw's split
    if (hv < -6 && (hu < 11 || hu > 15)) return d < 29 ? "Q" : null;
    if (hv > 6 && hu < 10) return d < 29 ? "Q" : null;
    return hu < 11 || hv < -10 ? "s" : hu > 15.5 || hv > 8.5 ? "T" : "S";
  }
  if (hu > -24 && hu <= 9 && Math.abs(hv) < 2.4) return hv < -0.8 ? "R" : hv > 1 ? "r" : "R";
  if (hu > -27 && hu <= -24 && Math.abs(hv) < 2.4) return "r";
  // The saw under it: blade from the top left, widening to its handle at the bottom right; teeth along its lower edge.
  const su = (X + Y) / Math.SQRT2;
  const sv = (X - Y) / Math.SQRT2; // > 0: toward the top right
  const bw = 3 + (su + 25) * 0.12;
  if (su > -25 && su < 9 && sv < bw && sv > -bw) {
    if (sv < -bw + 1.5) return ((Math.floor(su) % 3) + 3) % 3 === 0 ? "T" : "S"; // teeth
    return sv > bw - 1.5 ? "s" : "S";
  }
  if (su >= 9 && su < 22 && Math.abs(sv) < 6.5) {
    if (Math.hypot(su - 15.5, sv) < 2.4) return "Q";
    return sv > 3.5 ? "h" : sv < -3.5 ? "J" : "j";
  }
  return d > 27 ? "q" : X + Y < -30 ? "w" : "Q";
}

/** A circle tile at a square: the log round (with the marks and the emblem if `all`), plain floor where it's outside. */
const circleFn = (col: number, row: number, all: boolean) => (x: number, y: number) => {
  const gx = col * T + x;
  const gy = row * T + y;
  if (all) {
    const k = emblemAt(gx, gy) ?? markAt(gx, gy);
    if (k) return k;
  }
  return logRound(gx, gy) ?? floorAt(col, row)(x, y);
};
/** The north-west quarter's tiles (columns 6-9, rows 7-10), turned for the other quarters. */
for (let j = 0; j < 4; j++)
  for (let i = 0; i < 4; i++) {
    if (i + j < 2) continue; // its corner (outside) and the slanted side's two squares: drawn where they lie
    tileDef(`circle-${i}-${j}`, circleFn(6 + i, 7 + j, false));
  }
/** The slanted sides' squares (where the bark crosses the planks), each drawn where it lies so its planks run true. */
const SLANT: Pt[] = [[7, 7], [6, 8], [12, 7], [13, 8], [13, 13], [12, 14], [6, 13], [7, 14]];
for (const [c, r] of SLANT) tileDef(`circle-slant-${c}-${r}`, circleFn(c, r, false));
/** The marks' and the emblem's squares, drawn where they lie. */
const DRAWN: Record<string, string> = {
  "8,10": "circle-mark-boss-n",
  "8,11": "circle-mark-boss-s",
  "11,10": "circle-mark-you-n",
  "11,11": "circle-mark-you-s",
  "9,10": "emblem-nw",
  "10,10": "emblem-ne",
  "9,11": "emblem-sw",
  "10,11": "emblem-se",
};
for (const [k, name] of Object.entries(DRAWN)) {
  const [c, r] = k.split(",").map(Number) as [number, number];
  tileDef(name, circleFn(c, r, true));
}

// ==== The back wall: board walls under a squared beam, big windows between them on the pines and the river.

const WALL_H = 130;
const PILLAR_UP = 20;
const BEAM = 12;
const WIN_T = 16; // the window frame's outer top
const SILL = 96; // the sill's top
const WX0 = 3; // the frame's outer west and east
const WX1 = 33;
const GT = WIN_T + 3; // the glass
const GB = SILL - 1;
const GX0 = WX0 + 3;
const GX1 = WX1 - 3;
const HILLS = 60;
const RIVER = 80;
const BANK = 89;

/** The squared beam along the top: a lit top face, a face with grain, its shade under. */
const beam = (x: number, y: number) => (y <= 2 ? (y === 1 ? "e" : "d") : y >= BEAM - 1 ? "a" : grain(x >> 2, y, 7) > 0.86 ? "b" : "c");
/** Upright wall boards, 6 wide: a dark gap, a lit edge, a grain mark here and there. */
const boardsV = (x: number, y: number) => {
  const bx = ((x % 6) + 6) % 6;
  if (bx === 0) return "a";
  if (bx === 1) return "e";
  return bx === 3 && grain(Math.floor(x / 6), Math.floor(y / 9), 9) > 0.8 ? "c" : "d";
};
/** The wainscot under the sill: lap boards 7 tall, lit along their tops, a nail at the ends. */
const wainscot = (x: number, y: number) => {
  const j = y - (SILL + 5);
  const r = ((j % 7) + 7) % 7;
  if (y >= WALL_H - 1) return "a";
  if (r === 0) return "e";
  if (r === 6) return "b";
  if (r === 3 && (x === 2 || x === 34)) return "T";
  return r === 5 ? "c" : "d";
};
/** A pine on the far bank: tiers of boughs, lit on the left. */
const pineAt = (x: number, y: number, cx: number, top: number, bot: number) => {
  if (y < top || y > bot) return null;
  const X = x + 0.5 - cx;
  const t = (y - top) / (bot - top);
  const half = 0.6 + t * 6.5 * (0.55 + 0.45 * (((y - top) % 7) / 7));
  if (Math.abs(X) > half) return null;
  return X < -half * 0.3 ? "5" : X < half * 0.5 ? "6" : "7";
};
/** The view out of one window, `kind` 0: pines and the river; 1: the beaver dam across the river. */
function view(x: number, y: number, kind: number): string {
  if (y >= BANK) return y === BANK ? "0" : (x * 5 + y * 3) % 13 === 0 ? "0" : "!";
  if (kind === 1) {
    // The dam: a low mound of sticks across the river, the water spilling white over its lip, a little lodge on it.
    const X = x + 0.5 - 18;
    const top = 74 + (X * X) / 34;
    const lodge = Math.hypot(X - 3, (y + 0.5 - 76) * 1.5) < 6.5;
    if ((y >= top && y < 84) || lodge) {
      const k = (x * 2 + y) % 5 === 0 || (x - y * 2) % 7 === 0 ? "b" : (x + y) % 3 ? "c" : "d";
      return y === Math.ceil(top) && !lodge ? "e" : k;
    }
    if (y >= 84 && y < 86 && Math.abs(X) < 14) return (x + y) % 2 ? "3" : "9"; // the spill
  }
  if (y >= RIVER) return y === RIVER ? "9" : (x * 3 + y * 7) % 17 === 0 ? "9" : (x + y * 2) % 23 === 0 ? "3" : "8";
  const pines = kind === 0 ? [[10, 40, 79], [21, 50, 79], [27, 36, 79]] : [[8, 52, 79], [27, 46, 79]];
  for (const [cx, top, bot] of pines) {
    const k = pineAt(x, y, cx!, top!, bot!);
    if (k) return k;
  }
  const line = 70 - Math.round(Math.abs(Math.sin(x * 1.1 + kind)) * 4);
  if (y >= line) return (x + y) % 4 === 0 ? "6" : "7"; // the forest's edge
  const hill = HILLS + Math.round(3 * Math.sin(x * 0.17 + kind * 2));
  if (y >= hill) return "4";
  const tt = (y - GT) / (hill - GT);
  const th = bayer(x, y);
  if (tt < 0.5) return tt / 0.5 < th * 0.9 ? "1" : "2";
  return (tt - 0.5) / 0.5 < th ? "2" : "3";
}
/** The back wall seen from inside, its top at y0. */
function wallCv(c: Cv, y0: number, kind: number) {
  fill(c, (x, yy) => {
    const y = yy - y0;
    if (y < 0) return null;
    if (y === 0) return "k";
    if (y < BEAM) return beam(x, y);
    if (y === BEAM) return "a";
    if (y >= SILL) {
      // The sill: a thick plank, lit on top.
      if (y < SILL + 5) return x < 1 || x > 35 ? (y === SILL + 4 ? "a" : "c") : ["H", "h", "h", "j", "J"][y - SILL]!;
      return wainscot(x, y);
    }
    if (x < WX0 || x > WX1 || y < WIN_T) return boardsV(x + 3, y);
    // The window frame: raw wood, lit on its top and left.
    if (x < GX0 || x > GX1 || y < GT) {
      if (x === WX0 || y === WIN_T) return "J";
      if (x === WX1) return "a";
      if (x > GX1) return x === GX1 + 1 ? "J" : "j";
      if (y < GT) return y === GT - 1 ? "J" : "H";
      return x === GX0 - 1 ? "J" : "h";
    }
    if (y === GT + 24 || y === GT + 25) return y === GT + 24 ? "h" : "j"; // a transom bar
    return view(x, y, kind);
  });
}
export const SHOP_TIMBER_WALL = (() => {
  const c = cv(T, WALL_H);
  wallCv(c, 0, 0);
  return def("wall", [1, 1], T, WALL_H, [18, WALL_H - 1], [[whole(c)]]);
})();
export const SHOP_TIMBER_WALL_B = (() => {
  const c = cv(T, WALL_H);
  wallCv(c, 0, 1);
  return def("wall-b", [1, 1], T, WALL_H, [18, WALL_H - 1], [[whole(c)]]);
})();

/** A log post from `top` to `foot`: round, lit on its left, bark streaks down it, its sawn end on top. */
const logPost = (cx: number, top: number, foot: number, hw = 7) =>
  paint(cx - hw, top, 2 * hw + 1, foot - top, (x, y) => {
    const X = x + 0.5 - cx - 0.5;
    if (Math.abs(X) > hw) return null;
    const j = y - top;
    if (j < 4) {
      const d = Math.hypot(X / hw, (j - 1.5) / 2.2);
      if (d > 1) return null;
      return d > 0.8 ? "j" : d < 0.3 ? "j" : "H";
    }
    const t = roundTone(X / hw, "edcb");
    if (grain(x, Math.floor((y + x * 3) / 6), 13) > 0.8) return t === "e" ? "d" : t === "d" ? "c" : "a";
    return t;
  });
export const SHOP_TIMBER_WALL_PILLAR = (() => {
  const h = WALL_H + PILLAR_UP;
  const c = cv(T, h);
  wallCv(c, PILLAR_UP, 0);
  return def("wall-pillar", [1, 1], T, h, [18, h - 1], [[whole(c), logPost(18, 1, h)]]);
})();

// ==== The side walls: lap boards running away north, tools hung on pegs (what shows of each square is its top band).

/** The west wall's face: a top plate, lap boards 8 tall, a corner board on its inner (east) edge. */
function sideFace(x: number, y: number): string {
  if (y === 0) return "k";
  if (y < 5) return y === 1 ? "e" : y === 4 ? "a" : "c";
  if (y >= WALL_H - 1) return "a";
  if (x >= T - 4) return x === T - 4 ? "a" : x === T - 3 ? "e" : "d";
  const r = (y - 5) % 8;
  if (r === 3 && (x === 3 || x === 29)) return "T";
  return r === 0 ? "e" : r === 7 ? "b" : r === 6 ? "c" : x < 3 ? "c" : "d";
}
/** The tools on a square's band: 0 a hand saw; 1 a level over two chisels and a mallet; 2 an axe and a coil of yellow rope. */
function sideTools(kind: number): Bit | null {
  const c = cv(T, 40);
  if (kind === 0) {
    put(c, 27, 9, "J");
    for (let x = 3; x <= 25; x++) {
      const bh = 4 + Math.round(((x - 3) / 22) * 4); // the blade widens to the handle
      for (let y = 13; y < 13 + bh; y++) put(c, x, y, y === 13 ? "s" : y === 12 + bh ? "T" : "S");
      if (x % 2 === 0) put(c, x, 13 + bh, "T"); // teeth
    }
    stamp(c, 24, 10, [".jjhhh.", "jhHHHhj", "jH...hj", "jH...hj", "jhh..hj", ".jhh.hj", "..jhhhj", "...jjjj"]);
  } else if (kind === 1) {
    stamp(c, 4, 10, ["TZZZZZZZZZZZZZZZZZZZZZZZZT", "TYYYYYYYYYY9v99YYYYYYYYYYT", "TYYYYYYYYYY9999YYYYYYYYYYT", "Tyyyyyyyyyyyyyyyyyyyyyyyyy"]);
    const chisel = [".hh.", "hHhj", "hHhj", "hHhj", "hHhj", "jjjj", ".TT.", ".sS.", ".sS.", ".sS.", ".sS.", ".sS.", ".ST."];
    stamp(c, 5, 17, chisel);
    stamp(c, 11, 18, chisel.slice(0, 12));
    stamp(c, 19, 17, ["HHhhhhhj", "Hhhhhhhj", "Hhhhhhhj", "hhhhhhhj", "jjjjjjjj", "...hj...", "...hj...", "...hj...", "...hj...", "...hj...", "...hj...", "...jj..."]);
  } else {
    // An axe hung by its head, its red handle down; a coil of rope on a peg.
    stamp(c, 3, 9, ["..TSSSs", ".TSSsss", "TTSSsss", "..TSSSs", "...RR..", "...RR..", "...RR..", "...Rr..", "...Rr..", "...Rr..", "...Rr..", "...Rr..", "...Rr..", "...Rr..", "...rr..", "...Rr..", "...Rr..", "...rr.."]);
    for (let y = 0; y < 40; y++)
      for (let x = 0; x < T; x++) {
        const d = Math.hypot(x + 0.5 - 22, (y + 0.5 - 21) * 1.1);
        if (d < 9 && d > 3.5) put(c, x, y, Math.floor(d * 1.6) % 2 ? "Y" : x + y < 40 ? "Z" : "y");
      }
    put(c, 22, 11, "J");
    stamp(c, 26, 27, ["Y.", "yY", ".y", ".Y", "y."]);
  }
  return cropBit(c);
}
function sideCv(c: Cv, y0: number) {
  fill(c, (x, yy) => (yy < y0 ? null : sideFace(x, yy - y0)));
}
const sideDef = (name: string, kind: number) => {
  const c = cv(T, WALL_H);
  sideCv(c, 0);
  return def(name, [1, 1], T, WALL_H, [18, WALL_H - 1], [bits(whole(c), sideTools(kind))]);
};
export const SHOP_TIMBER_WALL_SIDE = sideDef("wall-side", 0);
export const SHOP_TIMBER_WALL_SIDE_B = sideDef("wall-side-b", 1);
export const SHOP_TIMBER_WALL_SIDE_C = sideDef("wall-side-c", 2);
export const SHOP_TIMBER_WALL_SIDE_PILLAR = (() => {
  const h = WALL_H + PILLAR_UP;
  const c = cv(T, h);
  sideCv(c, PILLAR_UP);
  return def("wall-side-pillar", [1, 1], T, h, [18, h - 1], [[whole(c), logPost(18, 1, h)]]);
})();

// ==== The front (south) wall: two low logs, and the way out.

const HEM_H = 24;
/** A horizontal log's tone by its row j (0 its top, 9 its foot): lit on top. */
const LOG_ROWS = ["e", "e", "d", "d", "d", "c", "c", "b", "b", "a"];
function hemCv(c: Cv, y0: number) {
  fill(c, (x, yy) => {
    const y = yy - y0;
    if (y < 0) return null;
    if (y === 0) return "k";
    if (y >= HEM_H - 2) return y === HEM_H - 1 ? "x" : "a";
    const j = (y - 1) % 10;
    const t = LOG_ROWS[j]!;
    if (j > 1 && j < 8 && grain(x >> 2, y, 17) > 0.82) return t === "e" ? "d" : t === "d" ? "c" : "b";
    return t;
  });
}
export const SHOP_TIMBER_HEM = (() => {
  const c = cv(T, HEM_H);
  hemCv(c, 0);
  return def("hem", [1, 1], T, HEM_H, [18, HEM_H - 1], [[whole(c)]]);
})();
export const SHOP_TIMBER_HEM_PILLAR = (() => {
  const h = WALL_H + PILLAR_UP;
  const c = cv(T, h);
  hemCv(c, h - HEM_H);
  return def("hem-pillar", [1, 1], T, h, [18, h - 1], [[whole(c), logPost(18, 1, h)]]);
})();

/**
 * The entrance, two squares wide: log posts and a log lintel round the open doorway, the plank door swung wide open
 * against its east post, Timber's spare hard hat hung on a peg over it, and the bright day outside: sky, the pines, the
 * grass and the path out. Plainly the way out.
 */
const EW = 2 * T;
const EH = 112;
const EFOOT = EH - 1;
const E_TOP = 42; // the opening's top
const EO0 = 15; // the opening's west and east
const EO1 = 58;
export const SHOP_TIMBER_ENTRANCE = (() => {
  const day = paint(EO0, E_TOP, EO1 - EO0 + 1, EFOOT - E_TOP + 1, (x, y) => {
    const X = x + 0.5 - EW / 2;
    if (y >= EFOOT - 4) return y === EFOOT - 4 ? "H" : y === EFOOT ? "J" : "h"; // the threshold
    const ground = 72;
    if (y >= ground) {
      const pw = 4 + (y - ground) * 0.75; // the path, widening toward us
      if (Math.abs(X - (y - ground) * 0.1) < pw) return (x * 3 + y * 5) % 11 === 0 ? "p" : "P";
      return y === ground ? "0" : (x * 5 + y * 3) % 9 === 0 ? "!" : "0";
    }
    const line = 57 + Math.abs((x % 6) - 3) * 2; // a row of pine tips
    if (y >= line) return (x + y) % 3 ? "6" : "5";
    const t = (y - E_TOP) / (line - E_TOP);
    return t < bayer(x, y) * 0.9 ? "2" : "3";
  }, false);
  // The door, swung out against the east post: its plank face seen edge-on-ish, iron straps across.
  const door = paint(EO1 - 12, E_TOP + 2, 13, EFOOT - E_TOP - 5, (x, y) => {
    const i = x - (EO1 - 12);
    const j = y - (E_TOP + 2);
    const top = 3 - i * 0.25;
    const bot = EFOOT - E_TOP - 7 + i * 0.2;
    if (j < top || j > bot) return null;
    if (Math.abs(j - 12 - i * 0.12) < 1 || Math.abs(j - 50 - i * 0.12) < 1) return i % 4 === 1 ? "z" : "N";
    if (i % 4 === 0) return "b";
    return i < 2 ? "e" : "d";
  });
  const posts = [logPost(8, E_TOP - 12, EFOOT + 1, 6), logPost(EW - 9, E_TOP - 12, EFOOT + 1, 6)];
  const lintel = paint(0, E_TOP - 12, EW, 12, (x, y) => {
    const j = y - (E_TOP - 12);
    const t = LOG_ROWS[Math.min(9, Math.floor(j * 0.85))]!;
    // Its sawn ends, rings showing.
    for (const ex of [3, EW - 4]) {
      const d = Math.hypot(x + 0.5 - ex - 0.5, (j + 0.5 - 6) * 0.6);
      if (d < 3.6) return d > 2.8 ? "j" : Math.floor(d) % 2 ? "h" : "H";
    }
    return j > 1 && j < 10 && grain(x >> 2, y, 19) > 0.85 ? "c" : t;
  });
  const hat = paint(EW / 2 - 9, E_TOP - 22, 19, 12, (x, y) => {
    const X = x + 0.5 - EW / 2;
    const j = y - (E_TOP - 22);
    if (j >= 8) return Math.abs(X) < 9 - (j - 8) * 0.5 ? (j === 8 ? "L" : "o") : null; // its brim
    const d = Math.hypot(X / 6.5, (j - 8) / 8);
    if (d > 1) return null;
    if (Math.abs(X) < 1) return "o"; // its ridge
    return X < -2 && j < 5 ? "l" : X < 2 ? "L" : "O";
  });
  return def("entrance", [2, 1], EW, EH, [EW / 2, EFOOT], [[groundShadow(EW / 2, EFOOT - 1, 34, 3), day, door, ...posts, lintel, hat]]);
})();

// ==== The backdrop behind the counter: a cabinet of finished, varnished boards and a rack of raw planks, a crosscut saw over it.

const BDW = 4 * T;
const BDH = WALL_H + PILLAR_UP;
const CAB_T = 46; // the cabinet's top
const CAB_MID = 74; // its middle post
/** A stack of `n` boards lying on a shelf (their front edges), `w` wide, from its foot up: `ramp` lit, mid, shade; a shine. */
function boardStack(c: Cv, x: number, foot: number, w: number, n: number, ramp: string, shine = "", seed = 1) {
  for (let b = 0; b < n; b++) {
    const off = Math.round((grain(b, seed, 71) - 0.5) * 4);
    const y = foot - 3 * (b + 1);
    for (let i = 0; i < w - Math.abs(off); i++) {
      const px = x + i + Math.max(0, off);
      put(c, px, y, ramp[0]!);
      put(c, px, y + 1, shine && grain(px, b, seed) > 0.85 ? shine : ramp[1]!);
      put(c, px, y + 2, ramp[2]!);
    }
  }
}
/** A small chess piece's outline, h tall (k: "p" pawn, "r" rook, "b" bishop, "q" queen, "k" king): its half width at row j. */
function pieceHalf(kind: string, j: number, h: number): number {
  const t = j / (h - 1);
  if (t > 0.86) return 0.5 * h * 0.36; // the base
  if (t > 0.72) return 0.5 * h * 0.28;
  if (kind === "p") return t < 0.32 ? Math.sqrt(Math.max(0, 1 - ((t - 0.16) / 0.16) ** 2)) * h * 0.17 : t < 0.4 ? h * 0.15 : h * 0.09 + (t - 0.4) * h * 0.25;
  if (kind === "r") return t < 0.22 ? (j % 3 === 2 && t < 0.1 ? h * 0.08 : h * 0.17) : h * 0.12 + (t - 0.22) * h * 0.12;
  if (kind === "b") return t < 0.1 ? h * 0.05 : t < 0.42 ? Math.sin(((t - 0.1) / 0.32) * Math.PI) * h * 0.14 + 0.5 : t < 0.48 ? h * 0.15 : h * 0.08 + (t - 0.48) * h * 0.2;
  return 1;
}
const smallPiece = (c: Cv, cx: number, foot: number, h: number, kind: string, ramp = "WwQq") => {
  for (let j = 0; j < h; j++) {
    const hw = pieceHalf(kind, j, h);
    for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
      const X = (x + 0.5 - cx) / Math.max(hw, 0.6);
      if (Math.abs(X) > 1) continue;
      put(c, x, foot - h + j, roundTone(X, ramp));
    }
  }
};
export const SHOP_TIMBER_BACKDROP = (() => {
  const c = cv(BDW, BDH);
  fill(c, (x, yy) => {
    const y = yy - PILLAR_UP;
    if (y < 0) return null;
    if (y === 0) return "k";
    if (y < BEAM) return beam(x, y);
    if (y === BEAM) return "a";
    return boardsV(x + 3, y);
  });
  const cab = paint(4, CAB_T, BDW - 8, BDH - CAB_T, (x, y) => {
    const j = y - CAB_T;
    const i = x - 4;
    const n = BDW - 8;
    if (j < 6) return j === 0 ? "W" : j === 1 && grain(x, 0, 3) > 0.8 ? "X" : j < 3 ? "w" : j < 5 ? "Q" : "q"; // its cornice
    const post = (pc: number) => Math.abs(i + 0.5 - pc) < 3;
    for (const pc of [3, CAB_MID - 4, n - 3]) if (post(pc)) return roundTone((i + 0.5 - pc) / 3, "WwQq");
    if (y >= BDH - 4) return y === BDH - 4 ? "w" : "Q"; // the plinth
    if (i < CAB_MID - 4) {
      for (const s of [34, 66, 98]) if (j >= s && j < s + 4) return j === s ? "W" : j === s + 3 ? "q" : "w"; // varnished shelves
      return [34, 66, 98, 6].some((s) => j >= s + (s === 6 ? 0 : 4) && j < s + (s === 6 ? 3 : 7)) ? "a" : "b";
    }
    return j < 9 ? "a" : "b"; // the plank rack's back
  });
  const fin = cv(BDW, BDH);
  const s0 = CAB_T + 34;
  const s1 = CAB_T + 66;
  const s2 = CAB_T + 98;
  // Finished: polished boards stacked on the shelves, small varnished chess pieces, a live-edge slab.
  boardStack(fin, 12, s0, 26, 6, "WwQ", "X", 1);
  smallPiece(fin, 46, s0, 14, "r");
  smallPiece(fin, 54, s0, 12, "p");
  smallPiece(fin, 62, s0, 18, "b");
  boardStack(fin, 11, s1, 30, 4, "WwQ", "X", 2);
  boardStack(fin, 45, s1, 21, 7, "XWw", "v", 3);
  boardStack(fin, 12, s2, 54, 3, "WwQ", "X", 4);
  for (let x = 14; x < 64; x++) {
    const top = s2 - 9 - Math.round(2 * Math.sin(x * 0.3) + Math.sin(x * 0.7));
    for (let y = top; y < s2 - 9; y++) put(fin, x, y, y === top ? "e" : "w");
    put(fin, x, s2 - 9, "X");
  }
  // Raw: tall planks standing in the rack, lighter, and a stack of raw boards lying at its foot.
  const raw = cv(BDW, BDH);
  const PL: [number, number, number][] = [[80, 58, 7], [88, 52, 6], [95, 64, 8], [104, 55, 6], [111, 60, 7], [119, 50, 6], [126, 66, 7]];
  for (const [px, top, w] of PL)
    for (let y = CAB_T + top - 40; y < BDH - 22; y++)
      for (let i = 0; i < w; i++) {
        const tp = y === CAB_T + top - 40;
        put(raw, px + i, y, tp ? "J" : i === 0 ? "H" : i === w - 1 ? "j" : i === 3 && grain(px, Math.floor(y / 5), 8) > 0.55 ? "j" : "h");
      }
  boardStack(raw, 77, BDH - 4, 58, 6, "Hhj", "", 5);
  // The crosscut saw hung over the cabinet: a long toothed blade bellying down, a wooden handle up at each end.
  const saw = paint(12, PILLAR_UP + 15, BDW - 24, 18, (x, y) => {
    const t = (x - 22) / (BDW - 44);
    const top = PILLAR_UP + 19 + Math.round(1.5 * Math.sin(Math.PI * Math.max(0, Math.min(1, t))));
    const bot = PILLAR_UP + 23 + Math.round(5 * Math.sin(Math.PI * Math.max(0, Math.min(1, t))));
    if (t >= 0 && t <= 1 && y >= top && y <= bot + (x % 3 === 0 ? 1 : 0)) return y === top ? "s" : y >= bot ? "T" : "S";
    for (const hx of [16, BDW - 17]) if (Math.abs(x + 0.5 - hx - 0.5) < 2 && y < PILLAR_UP + 32) return x < hx + 1 ? "h" : "j";
    return null;
  });
  const lamps = [0, 1].map((s) =>
    paint(s ? BDW - 12 : 4, CAB_T + 8, 8, 14, (x, y) => {
      const i = x - (s ? BDW - 12 : 4);
      const j = y - (CAB_T + 8);
      if (j < 2) return i >= 3 && i <= 4 ? "N" : null;
      if (j === 2 || j === 13) return i >= 1 && i <= 6 ? "N" : null;
      if (i === 0 || i === 7) return j === 3 ? "N" : null;
      if (i === 1 || i === 6) return "N";
      return j < 7 && i < 4 ? "@" : "#";
    }),
  );
  return def("backdrop", [4, 1], BDW, BDH, [BDW / 2, BDH - 1], [bits(whole(c), cab, cropBit(raw), cropBit(fin), saw, ...lamps)]);
})();
const LAMP_XS = [4, BDW - 12];

// ==== The counter: a sturdy workbench of varnished planks on raw legs, a vise at its west end, low (the kid shows over it).

const CW = 4 * T;
const CH = 46;
const CFOOT = CH - 3;
const CTOP = 14; // the bench is 30 px tall
/** The plaque on its front (blank: the game writes on it). */
const PLQ = { x: 43, y: CTOP + 8, w: 62, h: 17 } as const;
export const SHOP_TIMBER_COUNTER_SIGN = signFace(PLQ.x, PLQ.y, PLQ.w, PLQ.h);
/** Where the crate stands on the counter: its foot, in the counter's pixels (on the right, clear of the plaque). */
export const SHOP_TIMBER_CRATE_AT: Pt = [120, CTOP + 3];
export const SHOP_TIMBER_COUNTER = (() => {
  const n = CW - 4;
  const fb = CFOOT - CTOP;
  const body = paint(2, CTOP, n, fb + 1, (x, y) => {
    const j = y - CTOP;
    const i = x - 2;
    // The top: a thick varnished slab seen a little from above, a shine along it.
    if (j < 5) return j === 0 ? "W" : j === 1 ? (grain(x, 1, 5) > 0.75 || (i > 20 && i < 34) ? "X" : "W") : j < 4 ? "w" : "Q";
    if (j === 5) return "q";
    // Its legs: heavy raw posts at the ends.
    if (i < 7 || i > n - 8) {
      const li = i < 7 ? i : i - (n - 7);
      return j === fb ? "J" : li === 0 ? "H" : li === 6 ? "j" : "h";
    }
    if (j >= fb - 3) return j === fb - 3 ? "w" : "Q"; // the bottom rail
    // The front: varnished upright boards.
    const bx = (i - 7) % 9;
    if (bx === 0) return "q";
    if (bx === 1) return "W";
    return j === 6 ? "q" : bx === 5 && grain(Math.floor(i / 9), Math.floor(j / 6), 4) > 0.7 ? "Q" : "w";
  });
  const plaque = signBoard(PLQ.x, PLQ.y, PLQ.w, PLQ.h, "JjhH", "%^&", "T");
  // The vise on its west end: a steel jaw against the front, its screw and T-bar handle.
  const vise = paint(1, CTOP - 2, 26, 16, (x, y) => {
    const i = x - 1;
    const j = y - (CTOP - 2);
    if (i >= 8 && i <= 22 && j <= 10) return j === 0 ? "s" : j === 10 || i === 22 ? "T" : i === 8 ? "s" : j === 2 ? "T" : "S"; // the jaws
    if (j >= 5 && j <= 6 && i >= 3 && i < 8) return j === 5 ? "s" : "S"; // the screw
    if (i >= 1 && i <= 2 && j >= 1 && j <= 13) return j === 1 || j === 13 ? "T" : i === 1 ? "s" : "S"; // the T-bar
    return null;
  });
  // On its top: a yellow tape measure and a pencil.
  const on = cv(CW, CH);
  stamp(on, 32, CTOP - 6, [".ZYY.", "ZYBYy", "YBTBy", "YYBYy", "TyyyT"].map((r) => r.replace(/B/g, "N")));
  stamp(on, 40, CTOP - 1, ["TYYYYYYYYRr"]);
  return def("counter", [4, 1], CW, CH, [CW / 2, CFOOT], [bits(groundShadow(CW / 2, CFOOT, CW / 2 - 2, 4), body, plaque, vise, cropBit(on))]);
})();

/**
 * Timber's Boss Crate: a sturdy crate of raw planks with dark corner posts, two orange safety straps buckled over it, a
 * beaver's two big front teeth stenciled on its front, a red-handled hammer lying on its lid. `idle`: a glint runs along
 * the lid and winks on the hammer's head (6 frames), so it reads as the thing you buy.
 */
const XW = 32;
const XH = 28;
export const SHOP_TIMBER_CRATE = (() => {
  const front = paint(1, 9, 30, 16, (x, y) => {
    const i = x - 1;
    const j = y - 9;
    if (i < 3 || i > 26) return i === 0 ? "e" : i > 28 ? "b" : "c"; // the corner posts
    if (Math.abs(i - 8.5) < 2 || Math.abs(i - 20.5) < 2) return j === 7 ? "Z" : Math.abs(i - 8.5) < 1 || Math.abs(i - 20.5) < 1 ? "O" : i < 8 || (i > 19 && i < 21) ? "L" : "o"; // the straps (a buckle)
    if (j % 5 === 4) return "j";
    return j % 5 === 0 ? "H" : "h";
  });
  // Two big beaver teeth, stenciled in cream between the straps.
  // Two big front teeth, each its own (so they part), under a strip of brown lip.
  const tooth = (x0: number) =>
    paint(x0, 13, 4, 8, (x, y) => {
      const i = x - x0;
      const j = y - 13;
      if (j === 7 && (i === 0 || i === 3)) return null;
      return i === 0 ? "v" : i === 3 ? "S" : "I";
    });
  const lip = paint(10, 11, 11, 2, () => "c");
  const teeth = [lip, tooth(11), tooth(16)];
  const lid = paint(1, 5, 30, 4, (x, y) => {
    const i = x - 1;
    const j = y - 5;
    if (Math.abs(i - 8.5) < 2 || Math.abs(i - 20.5) < 2) return j === 0 ? "L" : "O";
    return j === 0 ? "H" : j === 3 ? "j" : "h";
  });
  const feet = paint(2, 25, 28, 2, (x) => (x < 6 || x > 25 ? "b" : null));
  const hammer = cv(XW, XH);
  stamp(hammer, 6, 0, ["...............TSS", "RRRRRRRRRRRRrrTSSS", "rrrrrrrrrrrrr.TSSS", "..............TTT."]);
  const frames = [0, 1, 2, 3, 4, 5].map((f) => {
    const g = cv(XW, XH);
    const gx = [-9, 5, 11, 17, 24, -9][f]!;
    if (gx > 0) stamp(g, gx, 5, [".v.", "vvv", ".v."]);
    if (f === 5) stamp(g, 21, 0, [".v.", "vvv", ".v."]);
    return bits(groundShadow(XW / 2, XH - 2, 14, 2), front, lid, ...teeth, feet, cropBit(hammer), cropBit(g, false));
  });
  return def("crate", [1, 1], XW, XH, [XW / 2, XH - 2], frames, 220);
})();

// ==== The chess pieces: finished ones in a glossy varnish (for sale), unfinished ones in raw wood.

/** A profile: [t, half width] points from the top (t 0) to the foot (t 1), joined straight; a repeated t makes a step. */
type Prof = readonly (readonly [number, number])[];
const profAt = (prof: Prof, t: number): number => {
  for (let i = 0; i < prof.length - 1; i++) {
    const [t0, w0] = prof[i]!;
    const [t1, w1] = prof[i + 1]!;
    if (t1 > t0 && t >= t0 && t <= t1) return w0 + ((w1 - w0) * (t - t0)) / (t1 - t0);
  }
  return t < prof[0]![0] ? 0 : prof[prof.length - 1]![1];
};
/** Varnish across a round form (X -1 to 1): a lit edge, a bright streak of shine, the mid, the shade. */
const VARNISH = (X: number) => (X < -0.66 ? "W" : X < -0.36 ? "X" : X < 0.2 ? "w" : X < 0.66 ? "Q" : "q");
const RAW = (X: number) => (X < -0.5 ? "H" : X < 0.25 ? "h" : X < 0.7 ? "j" : "J");
/**
 * A turned piece standing at (cx, foot), h tall, by its profile; `top` draws its crown rows (t below `topT`) instead.
 * Each ledge (where it widens) catches the light along its top.
 */
function turned(cx: number, foot: number, h: number, prof: Prof, shade = VARNISH, top?: (X: number, t: number) => boolean, topT = 0) {
  return paint(Math.floor(cx - 20), foot - h, 41, h, (x, y) => {
    const t = (y - (foot - h) + 0.5) / h;
    const X = x + 0.5 - cx;
    if (t < topT) return top && top(X, t) ? (X < -0.5 ? "W" : X < 1 ? "w" : "Q") : null;
    const hw = profAt(prof, t);
    if (Math.abs(X) > hw) return null;
    const above = profAt(prof, t - 1 / h);
    if (hw > above + 1.2 && Math.abs(X) > above - 0.5 && shade === VARNISH) return X < hw * 0.4 ? "X" : "w";
    return shade(X / hw);
  });
}
const KING_PROF: Prof = [[0.13, 5], [0.17, 9.5], [0.27, 6.5], [0.27, 10.5], [0.31, 10.5], [0.31, 7.5], [0.36, 6.5], [0.66, 9], [0.66, 11], [0.71, 11], [0.71, 10], [0.76, 12.5], [0.84, 13], [0.84, 15], [0.93, 15.5], [1, 15.5]];
const kingCross = (X: number, t: number) => (t > 0.11 ? Math.abs(X) < 3 : Math.abs(X) < 1.6 || (t > 0.03 && t < 0.07 && Math.abs(X) < 5));
const QUEEN_PROF: Prof = [[0.15, 9], [0.25, 6.5], [0.25, 10.5], [0.29, 10.5], [0.29, 7], [0.34, 6], [0.66, 9], [0.66, 11], [0.71, 11], [0.71, 10], [0.76, 12], [0.84, 12.5], [0.84, 14.5], [1, 14.5]];
/** The queen's coronet: five points round a ball, over a band. (X in the big queen's pixels, t 0 to 0.15.) */
const queenTop = (X: number, t: number) => {
  if (Math.hypot(X, (t - 0.035) * 64) < 2.6) return true; // the ball
  if (t < 0.06) return false;
  if (t > 0.12) return Math.abs(X) < 9;
  const near = Math.min(...[-8, -4, 0, 4, 8].map((p) => Math.abs(X - p)));
  return near < 0.6 + (t - 0.06) * 25 && Math.abs(X) < 9;
};
const PAWN_PROF: Prof = [[0, 2], [0.06, 5], [0.2, 6], [0.32, 4], [0.36, 3.5], [0.36, 6], [0.42, 6], [0.42, 4], [0.66, 6.5], [0.66, 8.5], [0.76, 9], [0.76, 10.5], [1, 10.5]];
const ROOK_PROF: Prof = [[0, 9], [0.22, 9], [0.22, 8], [0.3, 6.5], [0.7, 8], [0.7, 10], [0.78, 10], [0.78, 11.5], [1, 11.5]];
const rookTop = (X: number, t: number) => Math.abs(X) < 9 && Math.floor((X + 9) / 3.6) % 2 === 0;
const BISHOP_PROF: Prof = [[0.12, 1], [0.14, 3.5], [0.3, 6.5], [0.42, 4.5], [0.42, 7], [0.46, 7], [0.46, 4.5], [0.72, 7], [0.72, 9.5], [0.8, 10], [0.8, 11.5], [1, 11.5]];
const bishopTop = (X: number, t: number) => Math.hypot(X, (t - 0.06) * 30) < 2.4;

/** The knight's head, facing the board (our left): its mane down its back. Then a turned collar and base. */
const KNIGHT_HEAD = [
  "..........##..##.......",
  ".........###.###.......",
  ".........#######.......",
  "........#########......",
  ".......###########.....",
  "......#############....",
  ".....##############....",
  "....################...",
  "...#################...",
  "..##################...",
  ".###################...",
  "####################...",
  "####################...",
  "#####..##############..",
  ".###.....############..",
  "..#.......###########..",
  "..........###########..",
  ".........############..",
  "........#############..",
  ".......##############..",
  "......###############..",
  ".....################..",
  ".....#################.",
  "....##################.",
  "....##################.",
  "...###################.",
  "...###################.",
  "..####################.",
];
function knight(cx: number, foot: number): Bit[] {
  const base = turned(cx, foot, 16, [[0, 12], [0.15, 12], [0.15, 10], [0.45, 11], [0.45, 13], [0.6, 13.5], [0.6, 14.5], [1, 14.5]]);
  const c = cv(64, 120);
  const x0 = cx - 12;
  const y0 = foot - 16 - KNIGHT_HEAD.length;
  KNIGHT_HEAD.forEach((row, j) => {
    const l = row.indexOf("#");
    const r = row.lastIndexOf("#");
    [...row].forEach((k, i) => {
      if (k !== "#") return;
      let key = VARNISH(((i - l) / Math.max(1, r - l)) * 2 - 1);
      if (i >= r - 1 && j > 0 && j < 22) key = (j + i) % 3 === 0 ? "q" : "Q"; // the mane
      put(c, x0 + i, y0 + j, key);
    });
  });
  put(c, x0 + 9, y0 + 6, "q");
  put(c, x0 + 8, y0 + 6, "v");
  put(c, x0 + 1, y0 + 11, "q");
  return bits(cropBit(c), base);
}

/**
 * A FOR SALE sign like a house's lawn sign: a white post with an arm, a board hung from it by two links, red over white,
 * FOR in white on the red, SALE in red on the white. Its stake stands at (x, foot); 25 x 36.
 */
const LETTERS: Record<string, string[]> = {
  F: ["###", "#..", "##.", "#..", "#.."],
  O: ["###", "#.#", "#.#", "#.#", "###"],
  R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: ["###", "#..", "###", "..#", "###"],
  A: [".#.", "#.#", "###", "#.#", "#.#"],
  L: ["#..", "#..", "#..", "#..", "###"],
  E: ["###", "#..", "##.", "#..", "###"],
};
function saleSign(x: number, foot: number): Bit[] {
  const post = paint(x, foot - 36, 24, 36, (px, py) => {
    const i = px - x;
    const j = py - (foot - 36);
    if (i < 2) return i === 0 ? "v" : "S"; // the post
    if (j < 2) return j === 0 ? "v" : "S"; // the arm
    if (j === 2 && (i === 6 || i === 19)) return "T"; // the links
    return null;
  });
  const board = cv(x + 30, foot + 2);
  const bx = x + 4;
  const by = foot - 33;
  for (let j = 0; j < 15; j++)
    for (let i = 0; i < 19; i++) put(board, bx + i, by + j, i === 0 || j === 0 || i === 18 || j === 14 ? (j < 7 ? "r" : "S") : j < 7 ? "R" : "v");
  const word = (w: string, wx: number, wy: number, k: string) =>
    [...w].forEach((ch, n) => LETTERS[ch]!.forEach((row, j) => [...row].forEach((p, i) => p === "#" && put(board, wx + n * 4 + i, wy + j, k))));
  word("FOR", bx + 4, by + 1, "v");
  word("SALE", bx + 2, by + 8, "R");
  return bits(post, cropBit(board));
}

const BPW = 40;
const bigPiece = (name: string, h: number, draw: (cx: number, foot: number) => Bit[]) => {
  const H = h + 6;
  const foot = H - 3;
  return def(name, [1, 1], BPW, H, [BPW / 2, foot], [[groundShadow(BPW / 2, foot - 1, 16, 3), ...draw(BPW / 2, foot)]]);
};
/** The big finished pieces, standing on the floor (a king two squares tall), each glossy with a streak of shine. */
export const SHOP_TIMBER_KING = bigPiece("king-big", 72, (cx, f) => [turned(cx, f, 72, KING_PROF, VARNISH, kingCross, 0.13)]);
export const SHOP_TIMBER_QUEEN = bigPiece("queen-big", 64, (cx, f) => [turned(cx, f, 64, QUEEN_PROF, VARNISH, queenTop, 0.15)]);
export const SHOP_TIMBER_KNIGHT = bigPiece("knight-big", 46, (cx, f) => knight(cx, f));
/** The lawn sign alone, to stand beside a piece or a group. */
export const SHOP_TIMBER_SALE_SIGN = (() => {
  const W_ = 30;
  const H_ = 40;
  return def("sale-sign", [1, 1], W_, H_, [12, H_ - 3], [[groundShadow(12, H_ - 4, 10, 2), ...saleSign(3, H_ - 3)]]);
})();

/**
 * A low display table of varnished wood, two squares: the small pieces for sale lined up on it (a king, a queen, a
 * bishop, a rook and pawns), all glossy, and its own FOR SALE sign stuck in the floor at its east end.
 */
const DTW = 2 * T;
const DTH = 64;
const DTF = DTH - 3;
export const SHOP_TIMBER_DISPLAY = (() => {
  const TY = DTF - 18; // the table's top
  const table = paint(1, TY, 50, DTF - TY + 1, (x, y) => {
    const i = x - 1;
    const j = y - TY;
    if (j < 4) return j === 0 ? "X" : j === 1 ? "W" : j === 2 ? "w" : "Q";
    if (j < 7) return i < 3 || i > 46 ? "Q" : j === 6 ? "q" : "w"; // its apron
    if (i < 4 || i > 45) return y >= DTF - 1 ? "q" : i === 0 || i === 46 ? "W" : "Q"; // its legs
    return null;
  });
  const sm = (cx: number, h: number, prof: Prof, top?: (X: number, t: number) => boolean, topT = 0) => {
    // A small piece: the big profile drawn at its size (half widths scaled with it).
    const k = h / 64;
    return turned(cx, TY, h, prof.map(([t, w]) => [t, w * k * 1.15] as const), VARNISH, top ? (X, t) => top(X / (k * 1.15), t) : undefined, topT);
  };
  const pieces = [
    sm(7, 11, PAWN_PROF),
    sm(15, 22, KING_PROF, kingCross, 0.13),
    sm(24, 20, QUEEN_PROF, queenTop, 0.15),
    sm(32, 15, BISHOP_PROF, bishopTop, 0.12),
    sm(39, 12, ROOK_PROF, rookTop, 0.07),
    sm(45, 11, PAWN_PROF),
  ];
  return def("display-table", [2, 1], DTW, DTH, [DTW / 2, DTF], [[groundShadow(28, DTF - 1, 28, 3), table, ...pieces, ...saleSign(49, DTF + 1)]]);
})();

/**
 * Unfinished pieces, two squares: a log section with a rook half carved out of its top (the bark still on below, rough
 * facets where the chisel's at), a rough-hewn pawn blank in raw wood with chisel marks, a chisel and a mallet set down,
 * curls of shavings round them.
 */
const URW = 2 * T;
const URH = 70;
const URF = URH - 3;
/** A log standing, hw wide, from y top to its foot: bark round, lit on its left, fissures down it. */
const logStand = (cx: number, top: number, foot: number, hw: number) =>
  paint(Math.floor(cx - hw), top, Math.ceil(2 * hw) + 1, foot - top + 1, (x, y) => {
    const X = x + 0.5 - cx;
    if (Math.abs(X) > hw) return null;
    if (y < top + 2) return "j"; // its rough top edge
    const t = roundTone(X / hw, "dcba");
    return grain(x, Math.floor((y + x * 2) / 5), 23) > 0.72 ? "x" : t;
  });
/** Rough-hewn facets of raw wood: the chisel's flat cuts, each a tone, on a form `hw` wide at (X, row). */
const facet = (x: number, y: number, X: number, hw: number) => {
  const f = grain(Math.floor((x + y * 0.6) / 4), Math.floor(y / 3), 29);
  const base = RAW(X / hw);
  if (f > 0.82) return base === "H" ? "h" : base === "h" ? "j" : "J";
  if (f < 0.12 && base !== "J") return "H";
  return base;
};
export const SHOP_TIMBER_CARVING_ROUGH = (() => {
  const LX = 19;
  const log = logStand(LX, URF - 34, URF, 14);
  // The rook coming out of its top: crenels, a waist, then rough facets down into the log.
  const rook = paint(LX - 14, URF - 64, 29, 32, (x, y) => {
    const X = x + 0.5 - LX;
    const j = y - (URF - 64);
    let hw: number;
    if (j < 4) hw = Math.floor((X + 10) / 4) % 2 === 0 ? 10 : -1;
    else if (j < 9) hw = 10;
    else if (j < 22) hw = 7.5 + (j - 9) * 0.12;
    else hw = 10 + (j - 22) * 0.4 + (grain(Math.floor(X / 3), j >> 1, 31) - 0.5) * 2;
    if (Math.abs(X) > hw || hw < 0) return null;
    if (j >= 22) return facet(x, y, X, hw);
    if (j === 9 && Math.abs(X) > 7.5) return "J";
    return RAW(X / hw);
  });
  const blank = paint(37, URF - 34, 20, 35, (x, y) => {
    const X = x + 0.5 - 47;
    const j = y - (URF - 34);
    // A pawn's shape blocked out in flat cuts: a head, a neck, a flaring body, faceted.
    const hw = j < 9 ? Math.round(4.5 - Math.abs(j - 4.5) * 0.25) + 0.5 : j < 12 ? 3.5 : j < 26 ? 4 + (j - 12) * 0.33 : 9;
    if (Math.abs(X) > hw) return null;
    if ((X + j) % 7 === 0 && j > 12 && j < 30) return "J"; // chisel marks
    return facet(x, y, X, hw);
  });
  const tools = cv(URW, URH);
  stamp(tools, 34, URF - 3, ["hhhhhjTSSSSSs"]);
  stamp(tools, 34, URF - 2, ["jjjjjjTTTTTT."]);
  stamp(tools, 54, URF - 7, ["HHhj.", "hhhjJ", "hhhjJ", "jjjJ.", ".hJ..", ".hJ..", ".hJ.."].map((r) => r));
  stamp(tools, 50, URF - 1, ["hj", "jj"].map((r) => r));
  const curls = cv(URW, URH);
  for (const [sx, sy] of [[3, URF - 3], [28, URF - 2], [62, URF - 4], [44, URF]] as const) stamp(curls, sx, sy, [".hH.", "H..h", ".Hj."]);
  return def("carving-rough", [2, 1], URW, URH, [URW / 2, URF], [bits(groundShadow(URW / 2, URF - 1, 34, 3), log, rook, blank, cropBit(tools), cropBit(curls, false))]);
})();

/**
 * The showpiece, three squares wide and two deep: the giant king Timber's carving. A low plank dais; on it the king, its
 * crown and body already shaped in fresh raw wood, its foot still the log it's cut from (bark and all), rough facets
 * between where the work is; a mallet and chisel working by themselves at the rough part, a blueprint of the king on an
 * easel, shavings heaped round. `idle` (10 frames, 110 ms): the mallet draws back, swings, strikes the chisel (it bites
 * in a pixel), chips fly out in arcs and drop, the mallet eases back to wait. One tap a loop, lively but calm.
 */
const SPW = 4 * T;
const SP_RISE = 108;
const SPH = SP_RISE + 2 * T;
const SPF = SP_RISE + T + 18; // its foot: the middle of its south row
const SP_CX = 66;
const SP_FOOT = SP_RISE + 34; // where the king stands on the dais
const SP_HIT: Pt = [SP_CX + 19, SP_FOOT - 50]; // where the chisel bites
export const SHOP_TIMBER_SHOWPIECE = (() => {
  const N = 10;
  const DTOP = SP_RISE + 8; // the dais' top (far edge), its front edge, its face
  const DFRONT = SP_RISE + 2 * T - 14;
  const dais = paint(2, DTOP, SPW - 4, DFRONT - DTOP + 8, (x, y) => {
    const i = x - 2;
    if (y > DFRONT) return y === DFRONT + 1 ? "e" : y === DFRONT + 7 ? "a" : (i % 18 === 0 ? "b" : "d"); // its face
    if (y === DTOP) return "e";
    // Its top: planks running across, seen from above.
    const r = (y - DTOP) % 9;
    return r === 0 ? "c" : r === 1 ? "e" : "d";
  });
  // The log foot: bark, the sawn ring showing at its base.
  const LOG_T = SP_FOOT - 40;
  const log = logStand(SP_CX, LOG_T, SP_FOOT, 21);
  // The carved king above: profile scaled up, raw wood; rough facets where it meets the log.
  const KH = 112;
  const ROUGH0 = SP_FOOT - 58;
  const king = paint(SP_CX - 24, SP_FOOT - KH, 49, KH - 38, (x, y) => {
    const X = x + 0.5 - SP_CX;
    const t = (y - (SP_FOOT - KH) + 0.5) / KH;
    if (y >= ROUGH0) {
      const hw = 18 + (y - ROUGH0) * 0.18 + (grain(Math.floor((X + 30) / 4), (y - ROUGH0) >> 2, 37) - 0.5) * 3;
      return Math.abs(X) > hw ? null : facet(x, y, X, hw);
    }
    const prof: Prof = [[0.12, 7], [0.17, 15.5], [0.28, 10], [0.28, 16], [0.32, 16], [0.32, 11], [0.37, 10], [0.48, 12.5], [0.48, 15], [0.52, 15], [0.52, 13.5], [0.6, 17]];
    if (t < 0.12) return kingCross(X / 1.45, t) ? RAW(X / 4.5) : null;
    const hw = profAt(prof, t);
    if (Math.abs(X) > hw) return null;
    if ((y - (SP_FOOT - KH)) % 13 === 7 && X > -hw * 0.3 && X < hw * 0.5) return "j"; // pencil lines round it, for the next cuts
    return RAW(X / hw);
  });
  // The blueprint on its easel, west of the king: a blue sheet, the king drawn on it in white lines.
  const easel = cv(SPW, SPH);
  const EX = 8;
  const EY = SP_FOOT - 46;
  for (let j = 0; j < 46; j++) {
    put(easel, EX + 1 + Math.floor(j * 0.12), EY + j, "j");
    put(easel, EX + 20 - Math.floor(j * 0.12), EY + j, "j");
  }
  for (let j = 0; j < 22; j++)
    for (let i = 0; i < 20; i++) put(easel, EX + 1 + i, EY + 2 + j, i === 0 || j === 0 || i === 19 || j === 21 ? "9" : "8");
  const BLUE_KING = ["...v...", "..vvv..", "...v...", ".v...v.", "..v.v..", "..v.v..", "..v.v..", ".v...v.", "..v.v..", "..v.v..", ".v...v.", "v.....v", "vvvvvvv"];
  stamp(easel, EX + 7, EY + 5, BLUE_KING);
  stamp(easel, EX + 3, EY + 5, ["v", "v", "v", "v", "v", "v", "v", "v", "v", "v", "v", "v", "v"]);
  stamp(easel, EX + 2, EY + 25, ["jjjjjjjjjjjjjjjjjjjj"]);
  // A wooden caddy of spare chisels and gouges on the dais' east end, red handles up.
  stamp(easel, 116, SP_FOOT - 4, [
    "..Rr..Rr.Rr...",
    "..Rr..Rr.Rr...",
    "..Rr.RrRrRr...",
    "..rr.RrRrrr...",
    "HHHHHHHHHHHHHj",
    "Hhhhhhhhhhhhhj",
    "Hhhhh....hhhhj",
    "Hhhhhhhhhhhhhj",
    "jjjjjjjjjjjjjJ",
  ]);
  // Shavings heaped round the log's foot and scattered on the dais.
  const shav = cv(SPW, SPH);
  const CURLS = [["..hHH.", ".H..jh", "h.Hh.j", ".jhj.."], [".HHh..", "H..hj.", "h.H..j", ".hjjh."], ["hHh.", "H.jh", ".hj."]];
  for (const [n, [sx, sy]] of ([[SP_CX - 28, SP_FOOT - 4], [SP_CX + 17, SP_FOOT - 3], [SP_CX - 8, SP_FOOT + 3], [SP_CX + 30, SP_FOOT + 9], [SP_CX - 40, SP_FOOT + 13], [SP_CX + 6, SP_FOOT + 16], [SP_CX + 50, SP_FOOT + 2], [SP_CX - 20, SP_FOOT + 8], [SP_CX + 22, SP_FOOT + 4], [SP_CX - 2, SP_FOOT - 1]] as const).entries())
    stamp(shav, sx, sy, CURLS[n % 3]!);
  // The chisel: its blade bites the rough wood at SP_HIT, its handle out to the east.
  const chisel = (bite: number) =>
    paint(SP_HIT[0] - bite, SP_HIT[1] - 2, 22, 5, (x, y) => {
      const i = x - (SP_HIT[0] - bite);
      const j = y - (SP_HIT[1] - 2);
      if (i < 8) return j >= 1 && j <= 3 && (i > 1 || j === 2) ? (j === 1 ? "s" : j === 3 ? "T" : "S") : null; // the blade
      if (i < 10) return "T"; // the ferrule
      return j === 0 || j === 4 ? (i < 21 ? (j === 0 ? "h" : "J") : null) : i === 21 ? "j" : j === 1 ? "H" : "h"; // the handle
    });
  // The mallet: a barrel head of raw wood, its handle down and back; placed by its striking face.
  const mallet = (fx: number, fy: number) =>
    paint(fx, fy - 9, 26, 32, (x, y) => {
      const i = x - fx;
      const j = y - (fy - 9);
      if (i < 13 && j < 18) {
        // The head: a round barrel of raw wood, its striking face to the west, end grain rings on it.
        if ((i === 0 || i === 12) && (j === 0 || j === 17)) return null;
        if (i < 2) return j < 9 ? "H" : "h";
        return j < 2 ? "H" : j > 14 ? "j" : i > 9 ? "j" : i < 5 ? "H" : "h";
      }
      const hx = 6 + (j - 18) * 0.95; // the handle, angling down and out
      if (j >= 18 && j < 31 && Math.abs(i + 0.5 - hx - 0.5) < 2) return i < hx - 0.5 ? "R" : "r";
      return null;
    });
  // By frame: the mallet's face (dx from the chisel's butt, dy), the chisel's bite, the chips (x, y, key) from the hit.
  const BUTT = SP_HIT[0] + 22;
  const MAL: [number, number][] = [[9, -3], [13, -6], [16, -8], [7, -3], [0, 0], [3, -1], [6, -2], [8, -3], [9, -3], [9, -4]];
  const CHIPS: [number, number, number, number][] = [
    [-4, -9, 0.9, 0], [3, -11, 1.1, 1], [-1, -7, 1.3, 2], [6, -6, 0.8, 3], [-6, -4, 1, 4],
  ];
  const frames = Array.from({ length: N }, (_, f) => {
    const bite = f >= 4 && f < 9 ? 1 : 0;
    const [mx, my] = MAL[f]!;
    const ch = cv(SPW, SPH);
    if (f >= 4 && f <= 8) {
      const s = f - 4 + 0.6;
      for (const [vx, vy, g, n] of CHIPS) {
        const px = Math.round(SP_HIT[0] - 1 + vx * s * 0.9);
        const py = Math.round(SP_HIT[1] + vy * s + g * s * s * 1.6);
        if (py > SP_FOOT + 10) continue;
        stamp(ch, px, py, n % 2 ? ["Hh", "hj"] : ["HH", "j."]);
      }
    }
    const dust = cv(SPW, SPH);
    if (f === 4) stamp(dust, SP_HIT[0] - 4, SP_HIT[1] - 5, ["u...u", ".u.u.", "u...u"]); // a puff of dust at the bite
    if (f === 5) stamp(dust, SP_HIT[0] - 5, SP_HIT[1] - 7, ["u.....u", "...u...", "u.....u"]);
    return bits(
      groundShadow(SPW / 2, DFRONT + 6, 54, 4),
      dais,
      cropBit(easel),
      log,
      king,
      cropBit(shav, false),
      chisel(bite),
      mallet(BUTT - bite + mx, SP_HIT[1] - 3 + my),
      cropBit(ch),
      cropBit(dust, false),
    );
  });
  // (The app's copy: [4, 2], its picture's own 4 squares (SPW) and the art's notes' "4 x 2 squares, columns 15-18"; the art's file
  // said [3, 2], which stood it a half square west of its dais and left column 18 walkable under it. Nothing drawn changes.)
  return def("showpiece", [4, 2], SPW, SPH, [Math.floor(SPW / 2), SPF], frames, 110);
})();

// ==== The lumber, round the sides.

/** A stack of sawn planks on two bearers, two squares: their long edges toward us, a little uneven, tied with yellow rope. */
export const SHOP_TIMBER_PLANK_STACK = (() => {
  const W_ = 2 * T;
  const H_ = 44;
  const F = H_ - 3;
  const bearers = paint(6, F - 5, 62, 6, (x) => (x < 16 || x > 51 ? (x === 6 || x === 52 ? "h" : x === 15 || x === 67 ? "J" : "j") : null));
  const st = cv(W_, H_);
  boardStack(st, 3, F - 5, 68, 9, "Hhj", "", 7);
  const rope = paint(18, F - 33, 40, 30, (x, y) => {
    if (x !== 19 && x !== 20 && x !== 54 && x !== 55) return null;
    if (y === F - 33 && (x === 20 || x === 55)) return "Z";
    return (y + x) % 3 === 0 ? "y" : x % 2 ? "Y" : "Z";
  });
  return def("plank-stack", [2, 1], W_, H_, [W_ / 2, F], [bits(groundShadow(W_ / 2, F - 1, 35, 3), bearers, cropBit(st), rope)]);
})();

/** A pile of logs, two squares: three, two and one, their sawn ends toward us (rings, a dark pith), bark round them. */
export const SHOP_TIMBER_LOG_PILE = (() => {
  const W_ = 2 * T;
  const H_ = 58;
  const F = H_ - 3;
  const end = (cx: number, cy: number, r: number) =>
    paint(Math.floor(cx - r), Math.floor(cy - r), Math.ceil(2 * r) + 1, Math.ceil(2 * r) + 1, (x, y) => {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > r) return null;
      if (d > r - 1.6) return x + y < cx + cy - 4 ? "c" : "b"; // the bark
      if (d < 1.2) return "J";
      return Math.floor(d * 0.75) % 2 ? "h" : x + y < cx + cy ? "H" : "h";
    });
  const logs = [[13, F - 9], [37, F - 9], [61, F - 9], [25, F - 25], [49, F - 25], [37, F - 41]].map(([cx, cy]) => end(cx! + 0.5, cy! + 0.5, 9.5));
  return def("log-pile", [2, 1], W_, H_, [W_ / 2, F], [[groundShadow(W_ / 2, F - 1, 35, 3), ...logs]]);
})();

/** A sawhorse, two squares: a board laid across it with a hand saw stuck half through, sawdust heaped under the cut. */
export const SHOP_TIMBER_SAWHORSE = (() => {
  const W_ = 2 * T;
  const H_ = 52;
  const F = H_ - 3;
  const TOPY = F - 22;
  const legs = paint(2, TOPY, 70, 23, (x, y) => {
    const j = y - TOPY;
    for (const cx of [14, 58])
      for (const s of [-1, 1]) {
        const lx = cx + s * (1 + j * 0.3);
        if (Math.abs(x + 0.5 - lx) < 1.6) return s < 0 ? "h" : "j";
      }
    return null;
  });
  const beam = paint(6, TOPY - 3, 62, 4, (x, y) => (y === TOPY - 3 ? "H" : y === TOPY ? "J" : "h"));
  const board = paint(1, TOPY - 7, 72, 4, (x, y) => (x > 41 && x < 44 ? null : y === TOPY - 7 ? "H" : y === TOPY - 4 ? "j" : "h"));
  const saw = cv(W_, H_);
  for (let i = 0; i < 18; i++) {
    const x = 42 + Math.round(i * 0.15);
    const y = TOPY - 6 - i;
    for (let w = 0; w < 6 - i * 0.15; w++) put(saw, x + w - 2, y, w === 0 ? "T" : w < 2 ? "S" : "s");
  }
  stamp(saw, 41, TOPY - 31, ["jhhhhj", "hH..hj", "hH..hj", "jhhhjj", "..jj.."]);
  const dust = paint(30, F - 4, 26, 5, (x, y) => (Math.hypot((x + 0.5 - 43) / 12, (y + 0.5 - F) / 4) < 1 ? (y < F - 2 ? "u" : "H") : null), false);
  return def("sawhorse", [2, 1], W_, H_, [W_ / 2, F], [bits(groundShadow(W_ / 2, F - 1, 32, 3), dust, legs, beam, board, cropBit(saw))]);
})();

/** A chopping block: a stout stump, its cut top showing rings, an axe with a red handle bitten into it, chips round its foot. */
export const SHOP_TIMBER_CHOPPING_BLOCK = (() => {
  const W_ = 40;
  const H_ = 52;
  const F = H_ - 3;
  const stump = logStand(20, F - 18, F, 13);
  const top = paint(7, F - 23, 27, 9, (x, y) => {
    const d = Math.hypot((x + 0.5 - 20.5) / 13, (y + 0.5 - (F - 19)) / 4.2);
    if (d > 1) return null;
    if (d > 0.86) return "b";
    return Math.floor(d * 5) % 2 ? "h" : "H";
  });
  const axe = cv(W_, H_);
  for (let i = 0; i < 17; i++) {
    const x = 22 + Math.round(i * 0.55);
    const y = F - 22 - i;
    put(axe, x, y, "R");
    put(axe, x + 1, y, "r");
  }
  stamp(axe, 14, F - 27, ["..TTSSs", ".TSSsss", "TTSSss.", "..TSS.."]);
  const chips = cv(W_, H_);
  for (const [cx, cy] of [[4, F - 1], [33, F], [8, F + 1], [30, F - 2]] as const) stamp(chips, cx, cy, ["Hh"]);
  return def("chopping-block", [1, 1], W_, H_, [20, F], [bits(groundShadow(20, F - 1, 16, 3), stump, top, cropBit(axe), cropBit(chips, false))]);
})();

/** A toolbox in his yellow: a steel handle, a hammer's red handle and a saw's grip poking out. */
export const SHOP_TIMBER_TOOLBOX = (() => {
  const W_ = 36;
  const H_ = 40;
  const F = H_ - 3;
  const box = paint(3, F - 15, 30, 16, (x, y) => {
    const j = y - (F - 15);
    const i = x - 3;
    if (j === 0) return "Z";
    if (j === 4) return "y";
    if (j === 15) return "y";
    if (i === 0) return "Z";
    if (i === 29) return "y";
    if (j > 6 && j < 10 && i > 12 && i < 17) return j === 8 ? "T" : "S"; // the latch
    return "Y";
  });
  const handle = paint(10, F - 22, 16, 7, (x, y) => {
    const j = y - (F - 22);
    if (j === 0 && x > 10 && x < 25) return "s";
    if (j > 0 && j < 7 && (x === 11 || x === 24)) return "S";
    return null;
  });
  const tools = cv(W_, H_);
  stamp(tools, 5, F - 26, ["TTSSs.", "..Rr..", "..Rr..", "..Rr..", "..Rr..", "..Rr..", "..Rr..", "..Rr..", "..Rr..", "..Rr..", "..Rr.."]);
  stamp(tools, 27, F - 21, [".jhh", "jh.h", "jhhh", ".jh."]);
  return def("toolbox", [1, 1], W_, H_, [18, F], [bits(groundShadow(18, F - 1, 15, 2), cropBit(tools), handle, box)]);
})();

/**
 * A pot-belly stove of black iron, one square: a round belly on short legs, a little door with the fire behind its grate,
 * a pipe up out of the picture. `idle` (6 frames): the fire flickers. Its light: SHOP_TIMBER_LIGHTS.
 */
const STW = 40;
const STH = 96;
const STF = STH - 3;
const ST_WIN = { x: 15, y: STF - 20, w: 10, h: 7 } as const;
export const SHOP_TIMBER_STOVE = (() => {
  const cx = 20;
  const body = paint(5, STF - 34, 31, 35, (x, y) => {
    const X = x + 0.5 - cx - 0.5;
    const j = y - (STF - 34);
    if (j < 3) return Math.abs(X) < 10 ? (j === 0 ? "z" : "V") : null; // its top
    if (j < 5) return Math.abs(X) < 8 ? "N" : null; // its neck
    if (j < 29) {
      const hw = 9 + 5 * Math.sin(((j - 5) / 24) * Math.PI);
      if (Math.abs(X) > hw) return null;
      if (j === 16 && Math.abs(X) < hw - 1) return "z"; // a band round its belly
      return roundTone(X / hw, "zVNN");
    }
    if (j < 30) return Math.abs(X) < 11 ? "V" : null;
    return Math.abs(Math.abs(X) - 8) < 1.6 ? "N" : null; // its legs
  });
  // Its pipe, up to a damper ring and a little rain cap (the ceiling's out of sight).
  const pipe = paint(cx - 5, 22, 11, STF - 34 - 22, (x, y) => {
    const X = x - cx;
    if (y < 27) return Math.abs(X) <= 5 - (y - 22) * 0.6 + (y === 26 ? 3 : 0) && y < 27 ? (y === 26 ? "N" : X < 0 ? "z" : "V") : null; // the cap
    if (Math.abs(X) > 3) return y > 48 && y < 51 ? (Math.abs(X) < 5 ? "V" : null) : null;
    return X === -3 ? "z" : X === 3 ? "N" : "V";
  });
  const door = paint(ST_WIN.x - 1, ST_WIN.y - 1, ST_WIN.w + 2, ST_WIN.h + 2, (x, y) => {
    const i = x - ST_WIN.x;
    const j = y - ST_WIN.y;
    if (i < 0 || j < 0 || i >= ST_WIN.w || j >= ST_WIN.h) return "N";
    return i % 3 === 2 ? "N" : null; // the grate's bars (the fire shows between)
  }, false);
  const frames = Array.from({ length: 6 }, (_, f) => {
    const fire = paint(ST_WIN.x, ST_WIN.y, ST_WIN.w, ST_WIN.h, (x, y) => {
      const i = x - ST_WIN.x;
      const j = y - ST_WIN.y;
      const lick = ST_WIN.h - 1 - j - (2.5 + 2 * Math.sin(i * 1.3 + f * 2.1));
      return lick < 0 ? "@" : lick < 2 ? "#" : "$";
    }, false);
    const kettle = paint(cx - 6, STF - 41, 13, 7, (x, y) => {
      const X = x + 0.5 - cx - 0.5;
      const j = y - (STF - 41);
      if (j === 0) return Math.abs(X) < 1.5 ? "N" : null;
      return Math.abs(X) < 2 + j * 0.9 ? (X < -1 ? "z" : "V") : null;
    });
    return [groundShadow(cx, STF - 1, 15, 3), pipe, body, fire, door, kettle];
  });
  return def("stove", [1, 1], STW, STH, [cx, STF], frames, 140);
})();

/** The lights at dusk and night, each on its piece (`piece`; x, y in its own pixels): the stove's fire, the two lanterns by the counter. */
export const SHOP_TIMBER_LIGHTS: readonly (LightSpot & { piece: string })[] = [
  { piece: "stove", x: ST_WIN.x, y: ST_WIN.y, w: ST_WIN.w, h: ST_WIN.h, keys: "@#$", color: TORCH, strength: 1, flicker: true, halo: 30 },
  ...LAMP_XS.map((lx) => ({ piece: "backdrop", x: lx + 1, y: CAB_T + 11, w: 6, h: 10, keys: "@#", color: WARM, strength: 0.85, flicker: true, halo: 26 })),
];
/** ... and warm pools on the floor: before the stove, along the counter's backdrop. */
export const SHOP_TIMBER_POOLS: readonly (LightPool & { piece: string })[] = [
  { piece: "stove", x: STW / 2, y: STF + 4, rx: 34, ry: 12, color: TORCH, strength: 0.3 },
  { piece: "backdrop", x: BDW / 2, y: BDH + 6, rx: 80, ry: 14, color: WARM, strength: 0.22 },
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
  /** The way out (the entrance): walking into it leaves the lodge. */
  exit?: boolean;
}
const LAYOUT: ShopPlace[] = [];
const at = (name: string, col: number, row: number, solid: boolean, more: Partial<ShopPlace> = {}) => {
  const p = PIECES[name];
  if (p) LAYOUT.push({ name, col, row, solid, ...(p.sq[0] > 1 ? { w: p.sq[0] } : {}), ...(p.sq[1] > 1 ? { d: p.sq[1] } : {}), ...more });
};

// -- The floor (every square).
const SLANTS = new Set(SLANT.map(([c, r]) => `${c},${r}`));
/** Knots and shavings here and there (not in the paths' middle). */
const KNOT = new Set(["2,4", "5,15", "16,3", "14,16", "3,11", "17,12", "7,17", "12,5"]);
const SHAV = new Set(["4,8", "15,6", "13,17", "2,16", "17,9", "6,4", "11,16"]);
for (let row = 0; row < 20; row++)
  for (let col = 0; col < 20; col++) {
    const k = `${col},${row}`;
    const even = (col + row) % 2 === 0;
    const inBox = col >= 6 && col <= 13 && row >= 7 && row <= 14;
    if (inBox) {
      if (DRAWN[k]) {
        at(DRAWN[k]!, col, row, false);
        continue;
      }
      if (SLANTS.has(k)) {
        at(`circle-slant-${col}-${row}`, col, row, false);
        continue;
      }
      // Its quarter: the north-west tile it's a turn of.
      const [c, r, rot]: [number, number, 0 | 1 | 2 | 3] =
        col <= 9 && row <= 10 ? [col, row, 0] : col >= 10 && row <= 10 ? [row - 1, 20 - col, 1] : col >= 10 ? [19 - col, 21 - row, 2] : [20 - row, col + 1, 3];
      const i = c - 6;
      const j = r - 7;
      if (i + j >= 2) {
        at(`circle-${i}-${j}`, col, row, false, rot ? { rot } : {});
        continue;
      }
    }
    if (row === 18 && (col === 9 || col === 10)) at("floor-door", col, row, false);
    else if (KNOT.has(k) && even) at("floor-c", col, row, false);
    else if (SHAV.has(k) && !even) at("floor-d", col, row, false);
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
  at([0, 4, 15, 19].includes(col) ? "wall-pillar" : col % 3 === 1 ? "wall-b" : "wall", col, 0, true, col === 19 ? { flip: true } : {});
}
for (let row = 1; row < 19; row++) {
  const side = row === 10 ? "wall-side-pillar" : ["wall-side", "wall-side-b", "wall-side-c"][row % 3]!;
  at(side, 0, row, true);
  at(side, 19, row, true, { flip: true });
}
at("hem-pillar", 0, 19, true);
for (let col = 1; col < 19; col++) if (col < 9 || col > 10) at("hem", col, 19, true);
at("entrance", 9, 19, false, { exit: true });
at("hem-pillar", 19, 19, true, { flip: true });

// -- The shop and the props.
at("counter", 8, 3, true);
at("crate", 8, 3, false); // on the counter (see SHOP_TIMBER_CRATE_AT): its place is the counter's
at("king-big", 2, 8, true);
at("queen-big", 3, 8, true);
at("sale-sign", 4, 8, true);
at("knight-big", 2, 11, true);
at("sale-sign", 3, 11, true);
at("display-table", 2, 14, true);
at("showpiece", 15, 4, true); // columns 15-18, rows 3-4
at("carving-rough", 15, 8, true);
at("stove", 2, 3, true);
at("plank-stack", 4, 2, true);
at("log-pile", 1, 17, true);
at("chopping-block", 4, 17, true);
at("sawhorse", 15, 12, true);
at("toolbox", 17, 15, true);
at("plank-stack", 15, 17, true);
//@@PROPS@@

/** Where every piece goes: name, column (its west-most square), row (its south-most), solid; floor tiles first, then the upright pieces north to south. */
export const SHOP_TIMBER_LAYOUT: readonly ShopPlace[] = [...LAYOUT.slice(0, FLOOR_COUNT), ...LAYOUT.slice(FLOOR_COUNT).sort((a, b) => a.row - b.row || a.col - b.col)];

/** Every piece by its name (as SHOP_TIMBER_LAYOUT names them), each its own Character `shop-timber-<name>`. */
export const SHOP_TIMBER_PIECES: Readonly<Record<string, Character>> = Object.fromEntries(Object.values(PIECES).map((p) => [p.name, toChar(p)]));


void signBoard;
void signFace;
void vnoise;
void groundShadow;
void TORCH;
void WARM;
export type { LightPool, LightSpot };
