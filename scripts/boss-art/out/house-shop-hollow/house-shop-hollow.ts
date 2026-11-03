/**
 * Inside Hollow Peak: Hollow's shop (house-shop-hollow). A room of 20 x 20 squares seen as the town square is seen (the
 * camera looks north, things stand upright at their foot, 37 px a square), but not a box: a cave. You come in at the
 * mouth (row 19, snow drifted in), and the cave runs long and narrow up the middle, opens round a frozen pond (the battle
 * spot), then curves round to the west at the back, where the counter sits in its own hollow, out of sight from the
 * mouth. The walkable floor is SHOP_HOLLOW_FLOOR (`.` floor, `#` rock); rock pieces stand on the rock squares along its
 * edge (which piece where: `rockPiece`, and the notes).
 *
 * Hollow (characters/hollow.ts, his home town/houses/hollow.ts) is not evil: a lonely soul up in a cave above the town who
 * once loved the winter holidays and secretly still does. So the cave is dark charcoal stone with frost and icicles, but
 * warm: lanterns hang from the ceiling, swaying a little, and a string of old, mismatched bulbs (a few burnt out: his
 * favourite thing) is pinned along the rock from his counter round the curve to his "tree", a tall pile of presents and
 * trinkets with a star on top. A big wooden sled parked against the wall with an overstuffed sack on it; a worn armchair
 * by a small fire pit, one stocking hung on a rock; an old telescope poked through a crack, pointed down at the town's
 * lights; a heap of things he "borrowed" from the other homes; an advent calendar with every door pried open. His dog
 * keeps the shop (out/sidekick-hollow-dog).
 *
 * Built as Dash's and Timber's shops are (out/house-shop-blitz, out/house-shop-timber): every piece its own Character
 * (`shop-hollow-<name>`), the layout, the room still. Footing: a piece's foot is the middle of its square (a wide piece's:
 * the middle of its width, on the middle of its row; a deep piece stands on its south row). Floor tiles are flat, 37 x 37,
 * foot at their middle, and seamless (their texture repeats every 37 px). The rock pieces join edge to edge too, and the
 * pieces on the east side of the cave are the west's mirrored (`flip`).
 */
import { frameKeys, type Anim, type Character, type Frame, type Layer, type Part } from "../../../../packages/app/src/characters/sprite.ts";
import { flame } from "../../../../packages/app/src/characters/paint.ts";
import { grain, groundShadow, ICE_LIGHT, LANTERN_LIGHT, paint, signBoard, signFace, TORCH, WARM, type LightPool, type LightSpot, type Pt } from "../../../../packages/app/src/town/houses/kit.ts";

const PALETTE: Record<string, string> = {
  k: "#08070c", // outline (Hollow's)
  n: "#100f15", // the rock: deepest, dark, mid, light, a lit edge
  d: "#1e1c25",
  c: "#2c2934",
  C: "#3c3946",
  h: "#524d5f",
  H: "#6d6782",
  w: "#e8eef9", // snow and frost: lit, shade, frost on dark rock
  W: "#aeb7cf",
  X: "#6c7591",
  i: "#a6cfe9", // ice: light, mid, deep (a crack), a glint
  I: "#7aa5c8",
  j: "#4a7298",
  J: "#e2f4ff",
  a: "#433d49", // the cave floor: ground, dark, light; pebbles lit, in shade
  "%": "#38333e",
  e: "#4e4855",
  o: "#625b6a",
  O: "#2b2730",
  y: "#fff7d6", // fire (paint.ts flame): core to rim
  Y: "#ffd54a",
  f: "#ff9a2e",
  F: "#e0561c",
  R: "#8a2412",
  L: "#ffe9a8", // lantern glass: bright, warm, deep amber
  l: "#ffb648",
  m: "#c8701e",
  "1": "#141218", // iron: dark, mid, light
  "2": "#2d2a33",
  "3": "#4b4753",
  "4": "#24180f", // old wood: dark to light, and a pale face (the plaque)
  "5": "#3f2a1a",
  "6": "#5f4128",
  "7": "#83603b",
  "8": "#a9845a",
  "^": "#cfb084",
  "9": "#5a4416", // brass: dark, mid, bright
  "0": "#9a7a2c",
  "!": "#dcc06a",
  r: "#4e1219", // red: dark, mid, lit (the stocking, ribbons, presents)
  s: "#8e2430",
  S: "#c9454a",
  g: "#173a28", // green: dark, lit
  G: "#2f6a42",
  t: "#b8841c", // gold: mid, bright, its hot core (the star, ornaments, the crate's light)
  T: "#f4cf5a",
  u: "#fff6c8",
  B: "#22386e", // blue: dark, lit
  b: "#3e62a8",
  v: "#4c3e30", // the sack's burlap: dark, mid, lit
  V: "#6e5c46",
  x: "#937d60",
  M: "#2e1722", // the armchair's worn plum velvet: dark, mid, lit
  N: "#4a2538",
  E: "#6b3c52",
  P: "#1b1029", // Hollow's violet darkness: dark, mid, bright, pale
  Q: "#30194f",
  U: "#9c6cff",
  Z: "#e2d6ff",
  "<": "#070b1e", // the night outside: deep sky, sky, low sky
  ">": "#121c40",
  "=": "#22325e",
  "*": "#ffd27a", // the town's lights far below: warm, orange
  "&": "#ff9a4a",
  À: "#e8403a", // the old bulbs, mismatched: red, green, blue, gold, orange, pink; a glint; a burnt-out one
  Á: "#3fc45a",
  Â: "#4a86f0",
  Ã: "#ffcf3a",
  Ä: "#ff8a2a",
  Å: "#ff7ac8",
  Æ: "#fffbe8",
  Ç: "#2a2630",
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
  return { id: `shop-hollow-${p.name}`, name: `Hollow's shop: ${p.name}`, w: p.w, h: p.h, foot: p.foot, palette: PALETTE, parts, anims: { idle: { loop: true, frames } } };
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
const fromGrid = (g: readonly string[], x: number, y: number, outline = false): Bit => ({ part: { grid: g, outline }, at: [x, y] });
/** A soft value noise that repeats every `per` pixels both ways (so a tile joins itself seamlessly): 0 to 1. */
function wrapNoise(x: number, y: number, per: number, cells: number, seed: number): number {
  const s = per / cells;
  const gx = x / s;
  const gy = y / s;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const v = (i: number, j: number) => grain(((i % cells) + cells) % cells, ((j % cells) + cells) % cells, seed);
  const sm = (t: number) => t * t * (3 - 2 * t);
  const a = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * sm(fx);
  const b = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * sm(fx);
  return a + (b - a) * sm(fy);
}

// ==== The rock: dark stone in facets (a Voronoi of tilted faces lit from the top left), cracks between them, frost on their
// ledges. Every rock piece shares the points near its west and east edges, so pieces join edge to edge.

interface Facet {
  x: number;
  y: number;
  tx: number;
  ty: number;
}
const BAND = 6;
const STEP = 13;
const facetCache = new Map<string, Facet[]>();
function facets(w: number, h: number, seed: number): Facet[] {
  const key = `${w},${h},${seed}`;
  let out = facetCache.get(key);
  if (out) return out;
  out = [];
  const tilt = (i: number, s: number) => ({ tx: grain(i, 7, s) * 2 - 1, ty: grain(i, 8, s) * 2 - 1 });
  for (let i = 0; i * STEP < h + STEP; i++) {
    out.push({ x: grain(i, 1, 901) * BAND, y: i * STEP + grain(i, 2, 901) * STEP - 5, ...tilt(i, 901) });
    out.push({ x: w - BAND + grain(i, 3, 901) * BAND, y: i * STEP + grain(i, 4, 901) * STEP - 5, ...tilt(i + 100, 901) });
  }
  const n = Math.round(((w - 2 * BAND) * h) / 140);
  for (let i = 0; i < n; i++) out.push({ x: BAND + grain(i, 1, seed) * (w - 2 * BAND), y: grain(i, 2, seed) * h, ...tilt(i, seed) });
  facetCache.set(key, out);
  return out;
}
/** The facet at (x, y) of a rock `w` wide (wrapping east to west), and whether it's on a crack between two. */
function facetAt(F: readonly Facet[], w: number, x: number, y: number) {
  let d1 = Infinity;
  let d2 = Infinity;
  let f1 = F[0]!;
  for (const p of F) {
    let dx = Math.abs(x + 0.5 - p.x);
    dx = Math.min(dx, w - dx);
    const d = Math.hypot(dx, (y + 0.5 - p.y) * 1.3);
    if (d < d1) {
      d2 = d1;
      d1 = d;
      f1 = p;
    } else if (d < d2) d2 = d;
  }
  return { f: f1, crack: d2 - d1 < 1.1 };
}
/**
 * The rock's key at (x, y) of a face `w` x `h` (seeded): `bias` lightens (a face turned to the light) or darkens (a
 * recess). Cracks dark; frost along the top of a facet; darker toward the foot and under the ceiling.
 */
function rockKey(x: number, y: number, w: number, h: number, seed: number, bias = 0): string {
  const F = facets(w, h, seed);
  const here = facetAt(F, w, x, y);
  if (here.crack && grain(x, y, seed + 5) > 0.12) return "n";
  const { f } = here;
  let l = 0.5 - 0.28 * f.tx - 0.2 * f.ty + bias - (x + 0.5 - f.x) * 0.01 - (y + 0.5 - f.y) * 0.014 + (grain(x, y, seed + 9) - 0.5) * 0.08;
  if (y > h - 26) l -= ((y - (h - 26)) / 26) * 0.22;
  const above = facetAt(F, w, x, y - 1).crack;
  const above2 = facetAt(F, w, x, y - 2).crack;
  if ((above || above2) && f.ty < 0.35 && grain(x, y, seed + 3) > 0.3) return above && l > 0.45 ? "W" : "X";
  if (grain(x, y, seed + 13) > 0.996) return "W"; // a fleck of frost
  return l < 0.28 ? "d" : l < 0.5 ? "c" : l < 0.72 ? "C" : "h";
}

/** The ceiling band's lower edge at x (it repeats every 37 px, so the band runs on unbroken from piece to piece). */
const ceilAt = (x: number) => 10 + Math.round(1.6 * Math.sin((2 * Math.PI * x) / T) + 1.2 * Math.sin((6 * Math.PI * x) / T + 1.3));
/** A stalactite (x, its length, its half width) and an icicle (x, its length). */
type Stal = readonly [number, number, number];
type Ice = readonly [number, number];
/**
 * A rock face `w` x `h` with its top at y0 on canvas `c`: the ceiling band along the top (the cave's roof coming down to
 * meet the wall), stalactites and icicles hanging from it, the stone below, a dark foot.
 */
function rockFace(c: Cv, y0: number, w: number, h: number, seed: number, o: { bias?: (x: number, y: number) => number; stal?: readonly Stal[]; ice?: readonly Ice[]; snowFoot?: boolean } = {}) {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const yb = ceilAt(x);
      let k: string;
      if (y < yb) k = grain(Math.floor(x / 3), Math.floor(y / 2), seed + 20) > 0.72 ? "d" : "n";
      else if (y === yb) k = "d";
      else if (y === yb + 1) k = "n"; // the shadow under the band
      else if (y >= h - 2) k = y === h - 1 ? "n" : "d";
      else k = rockKey(x, y, w, h, seed, o.bias?.(x, y) ?? 0);
      if (o.snowFoot && y >= h - 4 && grain(x, 0, seed + 30) > 0.35 + (h - 1 - y) * 0.15) k = y === h - 4 ? "W" : "X";
      put(c, x, y0 + y, k);
    }
  for (const [sx, len, half] of o.stal ?? []) {
    const yb = ceilAt(Math.round(sx));
    for (let j = 0; j <= len; j++) {
      const hw = half * Math.pow(1 - j / (len + 1), 0.8);
      for (let x = Math.floor(sx - hw); x <= Math.ceil(sx + hw); x++) {
        if (Math.abs(x + 0.5 - sx) > hw + 0.2) continue;
        const edge = Math.abs(x + 0.5 - sx) > hw - 0.9;
        put(c, ((x % w) + w) % w, y0 + yb + j, edge && x + 0.5 > sx ? "n" : x + 0.5 < sx - hw * 0.25 ? (j > len * 0.6 ? "h" : "C") : "c");
      }
    }
  }
  for (const [ix, len] of o.ice ?? []) {
    const yb = ceilAt(ix);
    for (let j = 0; j < len; j++) {
      put(c, ix, y0 + yb + j, j < len - 2 ? "J" : "i");
      if (j < len * 0.6) put(c, ix + 1, y0 + yb + j, j === 0 ? "W" : "I");
    }
    put(c, ix, y0 + yb + len + 1, "I"); // a drip about to fall
  }
}

// ---- The rock pieces along the floor's edge. Back faces (floor to the south) are tall like the other shops' walls; sides
// (floor to the east; mirrored for the west) show their top band in a stack; the hem (floor to the north) is low so it
// never hides the floor beyond it.

const WALL_H = 130;
const UP = 20; // the backdrop stands this much taller than the walls
const backDef = (name: string, seed: number, stal: readonly Stal[], ice: readonly Ice[], snowFoot = false) => {
  const c = cv(T, WALL_H);
  rockFace(c, 0, T, WALL_H, seed, { stal, ice, snowFoot });
  return def(name, [1, 1], T, WALL_H, [18, WALL_H - 1], [[whole(c)]]);
};
export const SHOP_HOLLOW_ROCK_BACK = backDef("rock-back", 11, [[8, 14, 3], [27, 9, 2.4]], [[15, 9], [33, 6]]);
export const SHOP_HOLLOW_ROCK_BACK_B = backDef("rock-back-b", 12, [[21, 18, 3.4]], [[6, 7], [11, 11], [30, 8]]);
export const SHOP_HOLLOW_ROCK_BACK_C = backDef("rock-back-c", 13, [[5, 8, 2.2], [31, 12, 2.8]], [[14, 14], [19, 8], [24, 11]]);

/** A side (floor to its east): the stone with a frosted lip on its inner edge, the ceiling band and icicles along the top. */
const sideDef = (name: string, seed: number, ice: readonly Ice[]) => {
  const c = cv(T, WALL_H);
  rockFace(c, 0, T, WALL_H, seed, { ice, bias: (x) => (x > 30 ? 0.12 : -0.06) });
  for (let y = 0; y < WALL_H; y++) {
    const yb = ceilAt(T - 3);
    if (y <= yb + 1 || y >= WALL_H - 2) continue;
    const lip = T - 3 + Math.round(Math.sin(y * 0.45) * 0.8);
    put(c, lip, y, grain(lip, y, seed) > 0.55 ? "W" : "X");
    for (let x = lip + 1; x < T; x++) put(c, x, y, x === lip + 1 ? "H" : "h");
  }
  return def(name, [1, 1], T, WALL_H, [18, WALL_H - 1], [[whole(c)]]);
};
export const SHOP_HOLLOW_ROCK_SIDE = sideDef("rock-side", 21, [[9, 6], [22, 10], [33, 7]]);
export const SHOP_HOLLOW_ROCK_SIDE_B = sideDef("rock-side-b", 22, [[4, 9], [17, 5], [28, 12]]);

/**
 * The outer corner (floor to its south and west; mirrored, south and east): a back face whose west part turns away to
 * face the west, lit, a frosted edge where the two meet, its top corner rounded off.
 */
const CORNER_TURN = 10;
export const SHOP_HOLLOW_ROCK_CORNER_OUT = (() => {
  const c = cv(T, WALL_H);
  rockFace(c, 0, T, WALL_H, 31, { stal: [[26, 11, 2.6]], ice: [[18, 10], [32, 7]], bias: (x) => (x < CORNER_TURN ? 0.22 : 0) });
  for (let y = 0; y < WALL_H - 2; y++) {
    const yb = ceilAt(CORNER_TURN);
    if (y > yb + 1) put(c, CORNER_TURN, y, grain(3, y, 31) > 0.4 ? "W" : "H");
  }
  // The rounded top of the corner.
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9 - y; x++) if (Math.hypot(9 - x, 9 - y) > 9) put(c, x, y, ".");
  return def("rock-corner-out", [1, 1], T, WALL_H, [18, WALL_H - 1], [[whole(c)]]);
})();
/** The inner corner (floor only to its south-east; mirrored, south-west): the stone in shadow where two walls meet. */
export const SHOP_HOLLOW_ROCK_CORNER_IN = (() => {
  const c = cv(T, WALL_H);
  rockFace(c, 0, T, WALL_H, 41, { ice: [[12, 5], [25, 8]], bias: (x) => -0.12 - Math.abs(x - 18) * 0.004 });
  return def("rock-corner-in", [1, 1], T, WALL_H, [18, WALL_H - 1], [[whole(c)]]);
})();

/** The hem (floor to its north): a low ledge of frosted boulders, snow on their tops. `end`: it rounds off to the east. */
const HEM_H = 26;
function hemCv(end: boolean, seed: number): Cv {
  const c = cv(T, HEM_H);
  const rocks = [
    { cx: 3, r: 8.5, cy: HEM_H - 9 },
    { cx: 15.5, r: 9, cy: HEM_H - 9.5 },
    { cx: 28, r: 8, cy: HEM_H - 8.5 },
  ].map((b, i) => (end && i === 2 ? { cx: 27, r: 6, cy: HEM_H - 6.5 } : b));
  for (let y = 0; y < HEM_H; y++)
    for (let x = 0; x < T; x++) {
      let best: { i: number; d: number; dx: number; dy: number } | null = null;
      rocks.forEach((b, i) => {
        for (const sh of end ? [0] : [-T, 0, T]) {
          const dx = x + 0.5 - (b.cx + sh);
          const dy = (y + 0.5 - b.cy) * 1.15;
          const d = Math.hypot(dx, dy) / b.r;
          if (d <= 1 || y + 0.5 > b.cy) {
            if (Math.abs(dx) > b.r + 0.3) continue;
            if (!best || i > best.i || (y + 0.5 > b.cy && best.d > 1)) best = { i, d: Math.min(d, 1), dx, dy };
          }
        }
      });
      if (!best) continue;
      const { d, dx, dy, i } = best as { i: number; d: number; dx: number; dy: number };
      const r = rocks[i]!.r;
      if (y >= HEM_H - 2) {
        put(c, x, y, y === HEM_H - 1 ? "n" : "d");
        continue;
      }
      const l = 0.55 - (dx / r) * 0.35 - (dy / r) * 0.45 + (grain(x, y, seed) - 0.5) * 0.12;
      let k = d > 0.9 && dy < 0 ? "k" : l < 0.3 ? "d" : l < 0.5 ? "c" : l < 0.72 ? "C" : "h";
      // Snow on their tops.
      if (dy < 0 && d > 0.62 && d <= 0.9 && dx < r * 0.6 && grain(x, y, seed + 1) > 0.18) k = l > 0.55 ? "w" : "W";
      put(c, x, y, k);
    }
  return c;
}
export const SHOP_HOLLOW_ROCK_HEM = def("rock-hem", [1, 1], T, HEM_H, [18, HEM_H - 1], [[whole(hemCv(false, 51))]]);
export const SHOP_HOLLOW_ROCK_HEM_B = def("rock-hem-b", [1, 1], T, HEM_H, [18, HEM_H - 1], [[whole(hemCv(false, 52))]]);
export const SHOP_HOLLOW_ROCK_HEM_END = def("rock-hem-end", [1, 1], T, HEM_H, [18, HEM_H - 1], [[whole(hemCv(true, 53))]]);

// ---- The rock seen from above (every `#` square, under whatever stands on it): the mountain's dark stone.

const rockTop = (seed: number) => (x: number, y: number): Key => {
  const v = wrapNoise(x, y, T, 4, seed) * 0.6 + wrapNoise(x, y, T, 8, seed + 1) * 0.4;
  if (grain(x, y, seed + 2) > 0.996) return "X";
  return v > 0.74 ? "c" : v > 0.56 ? "d" : "n";
};

// ==== The floor: dark packed stone, calm (big soft blotches that repeat every 37 px, so the tiles join seamlessly), a
// few pebbles; frost near the pond; snow blown in at the mouth.

/**
 * The ground: one calm tone at every edge (so any tile joins any other), a few flat stones set in it inside the tile
 * (lighter, a shadow on their lower right), and sparse specks.
 */
const STONES: readonly (readonly (readonly [number, number, number, number])[])[] = [
  [[12, 11, 6, 4], [26, 25, 5, 3.5]],
  [[25, 10, 5, 3.5], [11, 26, 6.5, 4]],
  [[19, 19, 7, 4.5]],
  [[9, 14, 4.5, 3], [27, 22, 5.5, 3.5], [16, 28, 3.5, 2.5]],
];
const ground = (x: number, y: number, seed = 0): string => {
  for (const [cx, cy, rx, ry] of STONES[seed % STONES.length]!) {
    const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) + (grain(x, y, 60 + seed) - 0.5) * 0.12;
    if (d < 1) return d > 0.78 && x + y > cx + cy ? "%" : "e";
  }
  const g = grain(x, y, 61 + seed);
  return g < 0.025 ? "%" : g > 0.985 ? "e" : "a";
};
/** Pebbles (x, y, size) and a little crack, drawn over the ground, kept off the tile's edges. */
const pebbles = (list: readonly (readonly [number, number, number])[]) => (x: number, y: number): Key => {
  for (const [px, py, s] of list) {
    const d = Math.hypot(x + 0.5 - px, (y + 0.5 - py) * 1.3);
    if (d < s) return x + y < px + py ? "o" : "e";
    if (d < s + 1 && x + y > px + py) return "O";
  }
  return null;
};
const flat = (fn: (x: number, y: number) => Key): Bit[][] => [[paint(0, 0, T, T, fn, false)]];
const tileDef = (name: string, fn: (x: number, y: number) => Key) => def(name, [1, 1], T, T, [18, 18], flat(fn));

const pebA = pebbles([[9, 27, 1.6], [26, 10, 1.2]]);
const pebB = pebbles([[29, 25, 1.4]]);
const floorA = (x: number, y: number) => pebA(x, y) ?? ground(x, y, 0);
const floorB = (x: number, y: number) => pebB(x, y) ?? ground(x, y, 1);
export const SHOP_HOLLOW_FLOOR_A = tileDef("floor-a", floorA);
export const SHOP_HOLLOW_FLOOR_B = tileDef("floor-b", floorB);
/** Variety: more pebbles and a hairline crack. */
const pebC = pebbles([[7, 8, 1.8], [12, 11, 1.1], [27, 28, 2.2], [31, 24, 1.1], [20, 30, 1]]);
export const SHOP_HOLLOW_FLOOR_C = tileDef("floor-c", (x, y) => {
  const p = pebC(x, y);
  if (p) return p;
  const cy = 18 + Math.round(3 * Math.sin(x * 0.35));
  if (x > 5 && x < 31 && y === cy && grain(x, 0, 71) > 0.2) return "O";
  return ground(x, y, 3);
});
/** Variety: a soft round patch of frost, speckled, thicker toward its middle. */
const frost = (x: number, y: number, cx: number, cy: number, r: number, seed: number): Key => {
  const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.15) / r;
  if (d >= 1) return null;
  const g = grain(x, y, seed);
  if (g > 0.5 + d * 0.45) return d < 0.35 && g > 0.9 ? "W" : "X";
  return null;
};
export const SHOP_HOLLOW_FLOOR_D = tileDef("floor-d", (x, y) => frost(x, y, 18, 18, 13, 72) ?? ground(x, y, 2));

/** Snow blown in at the mouth: a drift, lit and shaded in soft swells, a few sparkles. */
const snow = (x: number, y: number): string => {
  const v = wrapNoise(x, y, T, 4, 81) * 0.7 + wrapNoise(x, y, T, 8, 82) * 0.3;
  if (grain(x, y, 83) > 0.993) return "J";
  return v < 0.36 ? "W" : "w";
};
export const SHOP_HOLLOW_FLOOR_SNOW = tileDef("floor-snow", snow);
/** Thinning out north of the mouth: bare at its north edge, all snow at its south edge (so it joins both). */
export const SHOP_HOLLOW_FLOOR_SNOW_THIN = tileDef("floor-snow-thin", (x, y) => {
  const v = wrapNoise(x, y, T, 8, 84) * 0.55 + wrapNoise(x, y, T, 4, 85) * 0.45;
  const t = y / (T - 1);
  if (v < t * 1.25 - 0.2) return snow(x, y);
  if (v < t * 1.25 - 0.12) return "X";
  return ground(x, y, 1);
});
export const SHOP_HOLLOW_FLOOR_ROCK = tileDef("floor-rock", rockTop(91));
export const SHOP_HOLLOW_FLOOR_ROCK_B = tileDef("floor-rock-b", rockTop(92));

// ==== The battle spot: a frozen pond, a little cracked, its edge frosted; the two start marks on the ice.

const PX = 13 * T; // its middle, in the room's floor pixels (column 13's west edge, row 12's north edge)
const PY = 12 * T;
const PRX = 3 * T - 5;
const PRY = 2 * T - 4;
/** How far inside the pond's edge (0 at the edge, 1 at its middle), a little irregular; < 0 outside. */
function pondDepth(gx: number, gy: number): number {
  const dx = gx + 0.5 - PX;
  const dy = gy + 0.5 - PY;
  const a = Math.atan2(dy / PRY, dx / PRX);
  const wob = 1 + 0.035 * Math.sin(a * 5 + 0.7) + 0.025 * Math.sin(a * 9 + 2.1);
  return 1 - Math.hypot(dx / PRX, dy / PRY) / wob;
}
/** The cracks: short jagged lines across the ice (in the pond's pixels from its middle). */
const CRACKS: readonly (readonly Pt[])[] = [
  [[-96, -14], [-80, -9], [-71, -16], [-58, -12]],
  [[-80, -9], [-74, 4], [-79, 13]],
  [[34, 30], [48, 22], [57, 27], [72, 19], [86, 24]],
  [[57, 27], [60, 40]],
  [[-20, -46], [-12, -36], [-16, -27]],
];
const onCrack = (X: number, Y: number) => {
  for (const pts of CRACKS)
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1]!;
      const [bx, by] = pts[i]!;
      const vx = bx - ax;
      const vy = by - ay;
      const t = Math.max(0, Math.min(1, ((X - ax) * vx + (Y - ay) * vy) / (vx * vx + vy * vy)));
      const d = Math.hypot(X - ax - t * vx, Y - ay - t * vy);
      if (d < 0.75) return "j";
      if (d < 1.6 && Y < ay + t * vy) return "J";
    }
  return null;
};
/** The pond at a floor pixel: its frosted bank, the ice (deeper toward the middle, glints, frost feathers near the edge, cracks); null outside. */
function pond(gx: number, gy: number): Key {
  const e = pondDepth(gx, gy);
  const X = gx + 0.5 - PX;
  const Y = gy + 0.5 - PY;
  if (e < -0.06) return null;
  if (e < 0) return grain(gx, gy, 101) > 0.4 ? "W" : "X"; // frost on the floor round it
  if (e < 0.035) return Y < 0 && X < 30 ? "w" : "W"; // the bank's snowy rim
  if (e < 0.05) return "j";
  const c = onCrack(X, Y);
  if (c) return c;
  const v = wrapNoise(gx, gy, 8 * T, 24, 102);
  if (e < 0.16 && v > 0.45 + e * 2) return "w"; // frost feathers on the ice near its edge
  // Glints: short slanted streaks, lit from the top left.
  const s = (((gx - gy * 2) % 53) + 53) % 53;
  if (s < 2 && grain(Math.floor((gx - gy * 2) / 53), Math.floor(gy / 9), 103) > 0.6) return "J";
  if (e > 0.6 && v < 0.36) return "I";
  return e > 0.3 || v > 0.55 ? "i" : "I";
}
/** The start marks, rings etched in the ice on the middle line: the boss's (west) violet with a dark bulb, yours (east) gold with a snowflake. */
const MARKS = { boss: [11, 11.5] as Pt, you: [14, 11.5] as Pt };
export const SHOP_HOLLOW_MARKS = { boss: [11, 11.5], you: [14, 11.5] } as const;
function markAt(gx: number, gy: number): Key {
  for (const [who, [mc, mr]] of Object.entries(MARKS)) {
    const mx = (mc + 0.5) * T;
    const my = (mr + 0.5) * T; // row 11.5's middle: the line between rows 11 and 12, y = 12 x 37, the pond's middle
    const X = gx + 0.5 - mx;
    const Y = gy + 0.5 - my;
    const d = Math.hypot(X, Y);
    if (d > 15.5) continue;
    const boss = who === "boss";
    if (d > 14.2) return boss ? "Q" : "t";
    if (d > 12.6) return boss ? "U" : "T";
    if (d > 11.6) return "J";
    if (boss) {
      // A bulb, hanging tip down, dark violet.
      const bulb = Math.hypot(X / 4.6, (Y - 1.5) / 6) < 1 || (Math.abs(X) < 1.6 && Y > 1.5 && Y < 9.5);
      if (Math.abs(X) < 3.1 && Y > -8.5 && Y < -4) return Y < -7.4 ? "U" : "P";
      if (bulb) return X < -1.5 && Y < 0 ? "U" : "Q";
      return "i";
    }
    // Yours: a six-pointed snowflake.
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI) / 3;
      const u = X * Math.cos(a) + Y * Math.sin(a);
      const v = -X * Math.sin(a) + Y * Math.cos(a);
      if (Math.abs(v) < 0.8 && Math.abs(u) < 9) return "t";
      if (Math.abs(Math.abs(u) - 6) < 0.8 && Math.abs(v) < 2.6 - 0.0 && Math.abs(v) > 0.5 && Math.abs(Math.abs(v) - (9 - Math.abs(u)) * 0.9) < 1.1) return "T";
    }
    return "i";
  }
  return null;
}
/** A lost bulb frozen into the ice in the middle (where the table stands): only just seen. */
function frozenBulb(gx: number, gy: number): Key {
  const X = gx + 0.5 - PX - 3;
  const Y = gy + 0.5 - PY + 2;
  const a = 0.6;
  const u = X * Math.cos(a) + Y * Math.sin(a);
  const v = -X * Math.sin(a) + Y * Math.cos(a);
  if (Math.abs(v) < 2 && u > -7 && u < -3) return "j";
  if (Math.hypot(u / 4.5, v / 3.2) < 1) return u < -1 && v < 0 ? "S" : "s";
  return null;
}
const pondFloorAt = (col: number, row: number) => ((col + row) % 2 ? floorB : floorA);
const circleFn = (col: number, row: number) => (x: number, y: number) => {
  const gx = col * T + x;
  const gy = row * T + y;
  const p = pond(gx, gy);
  if (p === null) return pondFloorAt(col, row)(x, y);
  if (pondDepth(gx, gy) < 0.05) return p;
  return markAt(gx, gy) ?? frozenBulb(gx, gy) ?? p;
};
const CIRCLE = new Set<string>();
for (let row = 9; row <= 14; row++)
  for (let col = 9; col <= 16; col++) {
    let any = false;
    for (let y = 0; y < T && !any; y += 2) for (let x = 0; x < T && !any; x += 2) any = pond(col * T + x, row * T + y) !== null;
    if (!any) continue;
    CIRCLE.add(`${col},${row}`);
    tileDef(`circle-${col}-${row}`, circleFn(col, row));
  }

// ==== The old bulbs: a string of mismatched holiday bulbs pinned along the rock, a few burnt out (his favourite thing).

/** The string's pins: this far above a wall piece's foot (both ends of each piece, so pieces side by side join). */
const PIN_UP = 86;
const BULB_COLORS = "ÀÁÂÃÄÅ";
/** One old bulb hanging tip down from the wire at (x, y): `k` its glass (Ç: burnt out), `big` a fatter one. */
function bulb(c: Cv, x: number, y: number, k: string, big = false) {
  const dead = k === "Ç";
  put(c, x, y + 1, "1");
  put(c, x + 1, y + 1, "1");
  const rows = big ? ["xKKx", "KGKK", "KKKK", "xKKx", ".KK."] : ["KKK", "KGK", "KKK", ".K."];
  rows.forEach((r, j) =>
    [...r].forEach((ch, i) => {
      if (ch === ".") return;
      const px = x - (big ? 1 : 1) + i;
      const py = y + 2 + j;
      if (ch === "x") put(c, px, py, dead ? "Ç" : k);
      else if (ch === "G") put(c, px, py, dead ? "3" : "Æ");
      else put(c, px, py, k);
    }),
  );
}
/** A wire from (x0, y0) to (x1, y1) sagging by `sag`, with bulbs every `every` px (their colors in turn from `start`; `dead`: these go out). */
function bulbString(c: Cv, x0: number, y0: number, x1: number, y1: number, sag: number, o: { start?: number; every?: number; dead?: readonly number[]; off?: readonly number[]; offset?: number }) {
  const yAt = (x: number) => {
    const t = (x - x0) / (x1 - x0);
    return y0 + (y1 - y0) * t + sag * 4 * t * (1 - t);
  };
  for (let x = x0; x <= x1; x++) {
    const y = yAt(x);
    put(c, x, y, "2");
    const yn = yAt(x + 1);
    for (let yy = Math.round(y) + 1; yy < Math.round(yn); yy++) put(c, x, yy, "2");
    for (let yy = Math.round(y) - 1; yy > Math.round(yn); yy--) put(c, x + 1, yy, "2");
  }
  put(c, x0, y0 - 1, "3");
  put(c, x1, y1 - 1, "3");
  const every = o.every ?? 9;
  let n = 0;
  for (let x = x0 + (o.offset ?? 4); x <= x1 - 2; x += every, n++) {
    const color = BULB_COLORS[(n + (o.start ?? 0)) % BULB_COLORS.length]!;
    const dead = o.dead?.includes(n) || o.off?.includes(n);
    bulb(c, x, Math.round(yAt(x)), dead ? "Ç" : color, (n + (o.start ?? 0)) % 4 === 2);
  }
}
/**
 * The string's pieces, each the size and foot of a wall piece, to stand on the same square as the rock under it (drawn
 * after it): `bulbs`, `-b`, `-c` level; `bulbs-step` steps down a row from west to east (on an outer corner, where the
 * wall steps one square south; mirrored, up). `idle`: an old bulb flickers now and then (4 frames).
 */
const PIN_Y = WALL_H - 1 - PIN_UP;
const bulbsDef = (name: string, start: number, dead: readonly number[], flick: number | null, step = false) => {
  const frames = [0, 1, 2, 3].map((f) => {
    const c = cv(T, WALL_H);
    const off = flick !== null && (f === 1 || f === 3) ? [flick] : [];
    bulbString(c, 0, step ? PIN_Y - T : PIN_Y, T - 1, PIN_Y, step ? 4 : 5, { start, dead, off, every: step ? 10 : 9, offset: step ? 6 : 4 });
    return bits(cropBit(c, false));
  });
  return def(name, [1, 1], T, WALL_H, [18, WALL_H - 1], frames, 260);
};
export const SHOP_HOLLOW_BULBS = bulbsDef("bulbs", 0, [], 2);
export const SHOP_HOLLOW_BULBS_B = bulbsDef("bulbs-b", 3, [1], null);
export const SHOP_HOLLOW_BULBS_C = bulbsDef("bulbs-c", 1, [], 0);
export const SHOP_HOLLOW_BULBS_STEP = bulbsDef("bulbs-step", 4, [], null, true);

// ==== The crack: a back face split by a jagged crack onto the night outside, the town's lights twinkling far below, and an
// old brass telescope on a wooden tripod poked into it, pointed down at them.

const CRACK_Y0 = 40;
const CRACK_Y1 = 96;
const crackX = (y: number) => 19 + Math.round(2.2 * Math.sin(y * 0.31) + 1.2 * Math.sin(y * 0.83));
const crackHalf = (y: number) => {
  const t = (y - CRACK_Y0) / (CRACK_Y1 - CRACK_Y0);
  return t < 0 || t > 1 ? -1 : 0.6 + 3.2 * Math.sin(Math.PI * Math.pow(t, 0.8));
};
export const SHOP_HOLLOW_ROCK_CRACK = (() => {
  const frames = [0, 1, 2, 3].map((f) => {
    const c = cv(T, WALL_H);
    rockFace(c, 0, T, WALL_H, 14, { stal: [[30, 10, 2.4]], ice: [[7, 8], [12, 5]] });
    for (let y = CRACK_Y0; y <= CRACK_Y1; y++) {
      const hw = crackHalf(y);
      const cx = crackX(y);
      for (let x = Math.floor(cx - hw - 1); x <= Math.ceil(cx + hw + 1); x++) {
        const d = Math.abs(x + 0.5 - cx);
        if (d > hw + 1) continue;
        if (d > hw) {
          put(c, x, y, x < cx ? "X" : "n"); // its lip: frost on the lit side
          continue;
        }
        // The night through it: deep sky above, the snowy slope, the town's lights twinkling low down.
        let k = y < 64 ? "<" : y < 76 ? ">" : "=";
        if (y > 80 && (x + y) % 3 !== 0) k = y > 88 ? "W" : "X";
        if (y >= 72 && y <= 84 && grain(x, y, 110) > 0.62) k = (grain(x, y, 111 + f) > 0.4 ? "*" : "&");
        if (y < 60 && grain(x, y, 112) > 0.93) k = "W"; // a star
        put(c, x, y, k);
      }
    }
    // The telescope: a brass tube from its eyepiece (low, near us) up into the crack, on a wooden tripod.
    const tube = (t: number) => [5 + t * 15, 99 - t * 22] as const;
    for (let s = 0; s <= 1; s += 0.02) {
      const [tx, ty] = tube(s);
      const r = 1.6 + s * 0.9;
      for (let j = -3; j <= 3; j++) {
        if (Math.abs(j) > r) continue;
        const k = j < -r + 1 ? "!" : j > r - 1 ? "9" : "0";
        put(c, tx + j * 0.55, ty + j * 0.84, Math.abs(s - 0.45) < 0.03 || Math.abs(s - 0.8) < 0.03 ? "5" : k);
      }
    }
    put(c, 4, 100, "1");
    put(c, 3, 101, "1");
    for (const [fx, fy] of [[5, 128], [14, 128], [22, 127]] as const) {
      const [mx, my] = [13, 90];
      for (let s = 0; s <= 1; s += 0.03) put(c, mx + (fx - mx) * s, my + (fy - my) * s, s < 0.1 ? "5" : fx < mx ? "7" : "6");
    }
    stamp(c, 11, 88, ["566", "455"]);
    return [whole(c)];
  });
  return def("rock-crack", [1, 1], T, WALL_H, [18, WALL_H - 1], frames, 400);
})();

// ==== The mouth (the way out), two squares: a rough rock arch round the snowy night outside, icicles along its top, snow
// falling past, the town's lights far below, a drift on its sill.

const EW = 2 * T;
const EH = 112;
const EFOOT = EH - 1;
const openTop = (x: number) => 30 + 15 * ((x + 0.5 - EW / 2) / 26) ** 2 + Math.round(grain(Math.floor(x / 3), 0, 120) * 3);
const inOpen = (x: number, y: number) => x >= 11 && x <= EW - 12 && y >= openTop(x);
export const SHOP_HOLLOW_ENTRANCE = (() => {
  const frames = [0, 1, 2, 3].map((f) => {
    const c = cv(EW, EH);
    for (let y = 0; y < EH; y++)
      for (let x = 0; x < EW; x++) {
        if (inOpen(x, y)) {
          // The night: the sky, the far ridge, the snowy slope falling away, the town's lights in the valley.
          const ridge = 66 + Math.round(5 * Math.sin(x * 0.12) + 2 * Math.sin(x * 0.37));
          let k: string;
          if (y < ridge) k = y < 50 ? "<" : y < 60 ? ">" : "=";
          else if (y < ridge + 3) k = "X";
          else {
            const slope = 74 + Math.round((x - 10) * 0.18);
            if (y < slope) k = x > 44 && y > ridge + 2 && grain(x, y, 121) > 0.55 ? (grain(x, y, 122 + (f >> 1)) > 0.5 ? "*" : "&") : "=";
            else k = y < slope + 2 ? "W" : (x * 3 + y) % 11 === 0 ? "X" : "w";
          }
          if (y < ridge - 3 && grain(x, y, 123) > 0.985) k = "W"; // stars
          // The drift blown in over the sill.
          const drift = EFOOT - 10 + Math.round(3 * Math.sin(x * 0.2 + 1));
          if (y >= drift) k = y === drift ? "w" : y > EFOOT - 2 ? "W" : "w";
          put(c, x, y, k);
          continue;
        }
        // The rock round it.
        const near = inOpen(x + 1, y) || inOpen(x - 1, y) || inOpen(x, y + 1) || inOpen(x, y - 1);
        const near2 = inOpen(x + 2, y) || inOpen(x - 2, y) || inOpen(x, y + 2);
        if (y < 6) {
          if (y < 6 - Math.round(4 * Math.sin((Math.PI * x) / EW))) continue;
        }
        if (near) put(c, x, y, x < EW / 2 ? "X" : "n");
        else if (near2) put(c, x, y, "n");
        else put(c, x, y, y >= EH - 2 ? "d" : rockKey(x, y, EW, EH, 124, x < 12 ? 0.08 : -0.02));
      }
    // Icicles along the arch's top.
    for (const [ix, len] of [[16, 6], [22, 10], [27, 7], [33, 12], [40, 8], [46, 11], [52, 6], [57, 8]] as const) {
      const top = Math.ceil(openTop(ix));
      for (let j = 0; j < len; j++) {
        put(c, ix, top + j, j < len - 2 ? "J" : "i");
        if (j < len / 2) put(c, ix + 1, top + j, "I");
      }
    }
    // Snow falling past outside.
    for (let n = 0; n < 16; n++) {
      const fx = 12 + ((n * 23 + f * 2) % 50);
      const fy = 32 + ((n * 37 + f * 9) % 62);
      if (inOpen(fx, fy) && fy < 98) put(c, fx, fy, "w");
    }
    return [whole(c)];
  });
  return def("entrance", [2, 1], EW, EH, [EW / 2, EFOOT], frames, 300);
})();

/** A snowbank drifted in at the mouth, one square: low, soft, a sparkle. */
export const SHOP_HOLLOW_DRIFT = (() => {
  const W_ = T;
  const H_ = 28;
  const F = H_ - 4;
  const c = paint(0, 0, W_, H_, (x, y) => {
    const dx = (x + 0.5 - 18) / 18;
    const top = F - 13 * Math.sqrt(Math.max(0, 1 - dx * dx)) * (1 - 0.15 * Math.sin(x * 0.4)) + 2;
    if (y < top || y > F + 2) return null;
    if (y < top + 1.5) return x < 22 ? "w" : "W";
    if (y > F) return "X";
    const l = 0.6 - dx * 0.4 - (y - top) * 0.03;
    if (grain(x, y, 130) > 0.985) return "J";
    return l > 0.42 ? "w" : "W";
  }, false);
  return def("drift", [1, 1], W_, H_, [18, F], [[c]]);
})();

// ==== The backdrop behind the counter: the rock taller here, the bulbs across it, the advent calendar with every little
// door pried open, and a niche in the rock with his spare bulbs in a tin and a candle stub.

const BDW = 4 * T;
const BDH = WALL_H + UP;
const CAL = { x: 14, y: 58, w: 46, h: 44 } as const;
const NICHE = { x: 92, y: 72, w: 40, h: 30 } as const;
export const SHOP_HOLLOW_BACKDROP = (() => {
  const frames = [0, 1, 2, 3].map((f) => {
    const c = cv(BDW, BDH);
    rockFace(c, 0, BDW, BDH, 15, {
      stal: [[9, 16, 3.2], [40, 10, 2.6], [70, 20, 3.6], [101, 12, 2.6], [139, 15, 3]],
      ice: [[18, 9], [25, 13], [31, 7], [52, 12], [58, 8], [83, 10], [89, 14], [115, 9], [121, 12], [128, 7]],
    });
    // The niche: a dark hollow in the rock, a frosted ledge.
    for (let y = NICHE.y; y < NICHE.y + NICHE.h; y++)
      for (let x = NICHE.x; x < NICHE.x + NICHE.w; x++) {
        const dx = (x + 0.5 - (NICHE.x + NICHE.w / 2)) / (NICHE.w / 2);
        const dy = (y + 0.5 - (NICHE.y + NICHE.h)) / NICHE.h;
        const d = Math.hypot(dx, dy) + (grain(Math.floor(x / 3), Math.floor(y / 3), 140) - 0.5) * 0.12;
        if (d > 1.04) continue;
        put(c, x, y, d > 0.96 ? (dx < 0 ? "X" : "C") : y > NICHE.y + NICHE.h - 3 ? (y === NICHE.y + NICHE.h - 3 ? "W" : "d") : d > 0.86 ? "d" : "n");
      }
    // His spare bulbs in an old tin, and a candle stub (its flame flickers).
    const LY = NICHE.y + NICHE.h - 3;
    stamp(c, 98, LY - 10, ["22222222222", "3333333333.", "32323232322", "33333333332", "32323232322", "33333333332", "32323232322", "33333333332", "32323232322", "22222222222"].map((r) => r));
    for (const [bx, by, k] of [[99, LY - 13, "À"], [102, LY - 14, "Ã"], [105, LY - 13, "Â"], [107, LY - 12, "Á"], [101, LY - 12, "Ç"], [104, LY - 12, "Å"]] as const)
      stamp(c, bx, by, [k + k, k + k, "1."].map((r) => r.replace(/K/g, k)));
    stamp(c, 117, LY - 9, ["WWw", "WWW", "WWW", "WWW", "XWW", "XWW", "XXW", "2222", "3333"]);
    const fl = [["y", "Y", "f"], ["Y", "y", "f"], ["y", "f", "F"], ["Y", "Y", "f"]][f]!;
    put(c, 118, LY - 12, fl[2]!);
    put(c, 118, LY - 11, fl[1]!);
    put(c, 118, LY - 10, fl[0]!);
    // The advent calendar: a little wooden house with a peaked roof, six by four doors, every one pried open.
    const cal = cv(BDW, BDH);
    for (let y = CAL.y - 13; y < CAL.y + CAL.h; y++)
      for (let x = CAL.x - 2; x < CAL.x + CAL.w + 2; x++) {
        const j = y - CAL.y;
        const i = x - CAL.x;
        if (j < 0) {
          // The roof: two eaves over the board, faded red, a row of snow.
          const half = (CAL.w / 2 + 2) * ((j + 13) / 13);
          if (Math.abs(x + 0.5 - (CAL.x + CAL.w / 2)) > half) continue;
          put(cal, x, y, j === -13 + 0 ? "r" : j > -3 ? (j === -1 ? "4" : "s") : Math.abs(x + 0.5 - (CAL.x + CAL.w / 2)) > half - 2 ? "W" : "s");
          continue;
        }
        if (i < 0 || i >= CAL.w) continue;
        put(cal, x, y, i < 2 || j >= CAL.h - 2 || i >= CAL.w - 2 ? (i < 1 ? "7" : "5") : "6");
      }
    for (let r = 0; r < 4; r++)
      for (let q = 0; q < 6; q++) {
        const dx = CAL.x + 4 + q * 7;
        const dy = CAL.y + 3 + r * 10;
        for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) put(cal, dx + i, dy + j, j === 0 || i === 0 ? "4" : "1"); // the empty hole
        const how = (r * 6 + q) % 5;
        // Each door, pried open: swung out on its hinge, hanging by a corner, or gone.
        if (how === 0 || how === 3) for (let j = 0; j < 7; j++) put(cal, dx + 5, dy + j, j === 0 ? "8" : "7"), put(cal, dx + 6, dy + j + (how === 3 ? 1 : 0), "8");
        else if (how === 1) for (let j = 0; j < 4; j++) put(cal, dx + 4 - j, dy + 6 + j, "8"), put(cal, dx + 5 - j, dy + 6 + j, "7");
        else if (how === 2) for (let j = 0; j < 7; j++) put(cal, dx - 1, dy + j, "8");
        // (how 4: the door is gone)
      }
    // It hangs on a nail by a loop of string.
    put(cal, CAL.x + CAL.w / 2, CAL.y - 20, "3");
    for (let s = 0; s <= 1; s += 0.1) {
      put(cal, CAL.x + CAL.w / 2 - 6 * s, CAL.y - 20 + 7 * s, "2");
      put(cal, CAL.x + CAL.w / 2 + 6 * s, CAL.y - 20 + 7 * s, "2");
    }
    // The bulbs across the top, pinned at the walls' height at both ends, two swags; one bulb flickers.
    const s = cv(BDW, BDH);
    const py = BDH - 1 - PIN_UP;
    bulbString(s, 0, py, BDW / 2, py, 7, { start: 2, dead: [3], off: f === 2 ? [5] : [], every: 9, offset: 5 });
    bulbString(s, BDW / 2, py, BDW - 1, py, 6, { start: 5, dead: [6], every: 9, offset: 5 });
    return bits(whole(c), cropBit(cal), cropBit(s, false));
  });
  return def("backdrop", [4, 1], BDW, BDH, [BDW / 2, BDH - 1], frames, 300);
})();

// ==== The counter: rough planks laid across two stacks of frosted rock, low (the dog shows over it); a blank plaque.

const CW = 4 * T;
const CH = 46;
const CFOOT = CH - 3;
const CTOP = 14; // the counter is 30 px tall
/** The plaque on its front (blank: the game writes on it). */
const PLQ = { x: 44, y: CTOP + 9, w: 60, h: 16 } as const;
export const SHOP_HOLLOW_COUNTER_SIGN = signFace(PLQ.x, PLQ.y, PLQ.w, PLQ.h);
/** Where the crate stands on the counter: its foot, in the counter's pixels (on the right, clear of the plaque). */
export const SHOP_HOLLOW_CRATE_AT: Pt = [122, CTOP + 2];
export const SHOP_HOLLOW_COUNTER = (() => {
  // Two stacks of rock, three stones each.
  const stones = (x0: number, seed: number) =>
    paint(x0, CTOP + 4, 28, CFOOT - CTOP - 3, (x, y) => {
      const i = x - x0;
      const tiers = [
        { y0: CTOP + 5, y1: CTOP + 13, a: 1, b: 27 },
        { y0: CTOP + 14, y1: CTOP + 21, a: 0, b: 26 },
        { y0: CTOP + 22, y1: CFOOT, a: 0, b: 28 },
      ];
      for (const t of tiers) {
        if (y < t.y0 - 1 || y > t.y1) continue;
        const cx = (t.a + t.b) / 2;
        const hw = (t.b - t.a) / 2;
        const ry = (t.y1 - t.y0 + 1) / 2;
        const cy = (t.y0 + t.y1) / 2;
        const d = Math.hypot((i + 0.5 - cx) / hw, (y + 0.5 - cy) / (ry + 0.6));
        if (d > 1.02) continue;
        if (d > 0.92) return "n";
        const l = 0.55 - ((i - cx) / hw) * 0.3 - ((y - cy) / ry) * 0.4 + (grain(x, y, seed) - 0.5) * 0.15;
        if (y < cy - ry + 2.2 && l > 0.5 && grain(x, y, seed + 1) > 0.3) return "W";
        return l < 0.3 ? "d" : l < 0.5 ? "c" : l < 0.75 ? "C" : "h";
      }
      return null;
    });
  // The front: rough boards standing between the stacks.
  const front = paint(28, CTOP + 5, CW - 56, CFOOT - CTOP - 5, (x, y) => {
    const i = x - 28;
    const b = Math.floor(i / 11);
    const bi = i % 11;
    if (bi === 10) return "4";
    if (y > CFOOT - 2) return "4";
    if ((bi === 2 || bi === 8) && (y === CTOP + 8 || y === CFOOT - 4)) return "3"; // nails
    const gr = grain(b, Math.floor(y / 3), 150);
    return bi === 0 ? "7" : gr > 0.85 ? "5" : (y + b * 3) % 9 === 0 ? "5" : "6";
  });
  // The top: two thick planks, a little uneven, their lit edge, knots, a crack.
  const top = paint(0, CTOP, CW, 6, (x, y) => {
    const j = y - CTOP;
    const plank = x < 78 ? 0 : 1;
    const dip = plank === 0 ? 0 : 1;
    if (j < dip) return null;
    if (x === 77 || x === 78) return j === dip ? "6" : "4";
    if (j === dip) return "8";
    if (j === 5) return "4";
    if ((x === 12 || x === 13 || x === 103) && j === 3) return "4"; // knots
    return (x * 7 + j * 13) % 23 === 0 ? "5" : j === dip + 1 ? "7" : "6";
  });
  const plaque = signBoard(PLQ.x, PLQ.y, PLQ.w, PLQ.h, "4567", "78^", "3");
  const on = cv(CW, CH);
  // An old brass service bell, and a worn ledger.
  stamp(on, 20, CTOP - 7, ["...1...", "..!00..", ".!0009.", ".00009.", "9999999"]);
  stamp(on, 34, CTOP - 4, ["5555555555556", "8^^^^^^^^^^^6", "4444444444444"]);
  return def("counter", [4, 1], CW, CH, [CW / 2, CFOOT], [bits(groundShadow(CW / 2, CFOOT, CW / 2 - 2, 4), stones(0, 151), stones(CW - 28, 152), front, top, plaque, cropBit(on))]);
})();

/**
 * Hollow's Boss Crate: a battered present box in faded plum paper, dented and torn at a corner, tied with dark violet
 * ribbon in a floppy bow, faint gold light leaking from its seams. `idle`: the light inside flickers, a glint winks (6 frames).
 */
const XW = 34;
const XH = 30;
export const SHOP_HOLLOW_CRATE = (() => {
  const LEAK = [["t", "T"], ["T", "u"], ["T", "T"], ["t", "t"], ["T", "u"], ["u", "u"]];
  const frames = LEAK.map(([a, b], f) => {
    const box = paint(2, 12, 30, 16, (x, y) => {
      const j = y - 12;
      if (x > 27 && y < 15 + (x - 27)) return null; // the dent in its top corner
      if (j === 15) return "M";
      // The tear at its lower left: the light inside showing through.
      const tear = (x - 2) + (27 - y) * 0.9;
      if (tear < 4.5) return tear < 2.8 ? b! : a!;
      if (tear < 5.6) return "4";
      if (x > 27) return "M";
      return (x + y * 2) % 7 === 0 && (x * 3 + y) % 5 === 0 ? "E" : x < 5 ? "E" : "N";
    });
    const lid = paint(1, 8, 31, 5, (x, y) => {
      const j = y - 8;
      if (x > 27 && j < x - 27) return null;
      if (j === 0) return x < 22 ? "E" : "N";
      if (j === 4) return x % 4 === 1 ? a! : "M"; // the seam under the lid: light between the cracks
      return x > 28 ? "M" : "N";
    });
    const ribbon = paint(15, 8, 4, 20, (x) => (x === 15 ? "U" : x === 18 ? "P" : "Q"));
    const band = paint(2, 18, 28, 3, (_, y) => (y === 18 ? "U" : y === 20 ? "P" : "Q"));
    const bow = paint(8, 1, 19, 8, (x, y) => {
      // Two floppy loops, the right one drooping, and a knot.
      for (const [lx, ly, rx, ry] of [[12, 3.8, 4.4, 2.8], [21.5, 5, 4.2, 2.6]] as const) {
        const d = Math.hypot((x + 0.5 - lx) / rx, (y + 0.5 - ly) / ry);
        if (d <= 1 && d > 0.45) return y + 0.5 < ly - 0.8 ? "U" : "Q";
        if (d <= 0.45) return "P";
      }
      if (Math.abs(x + 0.5 - 17) < 2 && y >= 4) return "Q";
      return null;
    });
    const g = cv(XW, XH);
    const gx = [-9, 6, 12, 19, 26, -9][f]!;
    if (gx > 0) stamp(g, gx, 7, [".u.", "uÆu", ".u."]);
    if (f === 5) stamp(g, 3, 24, [".u.", "uuu", ".u."]);
    return bits(groundShadow(XW / 2, XH - 2, 15, 2), box, lid, band, ribbon, bow, cropBit(g, false));
  });
  return def("crate", [1, 1], XW, XH, [XW / 2, XH - 2], frames, 200);
})();

// ==== The lanterns: old iron lanterns hanging on chains from the ceiling, lit, swaying a little.

const LT_TOP = 50; // the lantern's ring, this far down its picture (its chain runs up out of the top)
const LANTERN_N = 8;
const lanternDef = (name: string, phase: number) => {
  const frames = Array.from({ length: LANTERN_N }, (_, f) => {
    const sw = 2.6 * Math.sin((2 * Math.PI * f) / LANTERN_N + phase);
    const c = cv(T, WALL_H);
    // The chain: links alternating, slanting with the swing.
    for (let y = 0; y < LT_TOP; y++) put(c, 18 + (sw * y) / LT_TOP, y, y % 3 === 0 ? "3" : "2");
    const lx = Math.round(18 + sw);
    const bodyRows = [
      ".....2.2.....",
      ".....222.....",
      "....22322....",
      "...2233322...",
      "..222222222..",
      ".33333333333.",
      "..1LLLLLLL1..",
      "..1LLLyLLl1..",
      "..1LLyYyLl1..",
      "..1LLyYylm1..",
      "..1LlYYYlm1..",
      "..1llYYlmm1..",
      "..1lllllmm1..",
      ".33333333333.",
      "..222222222..",
      "...2211122...",
      ".....222.....",
      "......2......",
    ];
    const fl = f % 3;
    bodyRows.forEach((r, j) =>
      [...r].forEach((k, i) => {
        if (k === ".") return;
        let kk = k;
        if (fl === 1 && (k === "y" || k === "Y")) kk = k === "y" ? "Y" : "y";
        if (fl === 2 && k === "y") kk = "L";
        put(c, lx - 6 + i, LT_TOP + 1 + j, kk);
      }),
    );
    put(c, lx, LT_TOP, "3"); // its ring
    return bits(cropBit(c, false));
  });
  return def(name, [1, 1], T, WALL_H, [18, WALL_H - 1], frames, 170);
};
export const SHOP_HOLLOW_LANTERN = lanternDef("lantern", 0);
export const SHOP_HOLLOW_LANTERN_B = lanternDef("lantern-b", 2.4);

// ==== The sled: a big old wooden sled parked against the wall, its curled front propped up on the rock, an overstuffed
// sack tied on it with things poking out.

const SLW = 2 * T;
const SLH = 74;
const SLF = SLH - 4;
export const SHOP_HOLLOW_SLED = (() => {
  const tilt = (12 * Math.PI) / 180;
  const pivot: Pt = [6, SLF - 1];
  /** A picture pixel to the sled's own (u along it from the back, v up from the runner). */
  const local = (x: number, y: number) => {
    const dx = x + 0.5 - pivot[0];
    const dy = pivot[1] - (y + 0.5);
    return [dx * Math.cos(tilt) + dy * Math.sin(tilt), -dx * Math.sin(tilt) + dy * Math.cos(tilt)] as const;
  };
  const sled = paint(0, 0, SLW, SLH, (x, y) => {
    const [u, v] = local(x, y);
    // The runner (iron-shod), its front curling up and back over.
    const R = 9;
    const cu = 56;
    const cv_ = R;
    if (u >= 0 && u <= cu && v >= 0 && v < 3) return v < 1 ? "3" : "5";
    const dr = Math.hypot(u - cu, v - cv_);
    if (u > cu && dr > R - 3 && dr <= R && v < cv_ + R) return dr > R - 1 ? "3" : "6";
    if (u > cu - 4 && u <= cu && v > cv_ && v < cv_ + R && dr > R - 3 && dr <= R) return "6";
    // Posts up to the deck.
    for (const pu of [8, 26, 44]) if (u >= pu && u < pu + 3 && v >= 3 && v < 9) return u < pu + 1 ? "7" : "5";
    // The deck: slats across, lit along their tops.
    if (u >= 1 && u <= 54 && v >= 9 && v < 13) return v >= 12 ? "8" : (Math.floor(u) % 9 === 0 ? "4" : v >= 11 ? "7" : "6");
    // The curled rail at the front.
    if (u > 48 && u < 58 && v >= 13 && v < 16) return v >= 15 ? "8" : "6";
    return null;
  });
  // The sack: bulging burlap tied at the neck with rope, a present's corner, a striped stick, a bulb string spilling out.
  const sack = paint(0, 0, SLW, SLH, (x, y) => {
    const [u, v] = local(x, y);
    const su = 28;
    const sv = 30;
    const bulge = Math.hypot((u - su) / 23, (v - sv) / 17) - 0.06 * Math.sin(u * 0.4) - 0.05 * Math.cos(v * 0.5);
    const neck = Math.abs(u - 34 - (v - 44) * 0.3) < 4 - (v - 44) * 0.25 && v >= 42 && v < 52;
    const tuft = Math.abs(u - 37 - (v - 52) * 0.6) < 2.5 + (v - 52) * 0.4 && v >= 51 && v < 56;
    if (!(bulge <= 1 || neck || tuft) || v < 12) return null;
    if ((neck || tuft) && Math.abs(v - 47) < 1.3) return "4"; // the rope
    if (bulge > 0.93 && !neck && !tuft) return "4";
    const l = 0.55 - ((u - su) / 23) * 0.25 + ((v - sv) / 17) * 0.4 + (grain(x, y, 160) - 0.5) * 0.15;
    if ((Math.floor(u) + Math.floor(v) * 2) % 6 === 0 && bulge < 0.8) return "v"; // the weave
    if (bulge < 0.9 && Math.abs(Math.sin((u - su) * 0.3 + v * 0.05)) < 0.07) return "v"; // a seam
    return l < 0.35 ? "v" : l < 0.68 ? "V" : "x";
  });
  const extra = cv(SLW, SLH);
  const at = (u: number, v: number): Pt => [pivot[0] + u * Math.cos(tilt) - v * Math.sin(tilt) - 0.5, pivot[1] - (u * Math.sin(tilt) + v * Math.cos(tilt)) - 0.5];
  // A present's corner poking out of its top (green, a red ribbon).
  stamp(extra, ...at(14, 50), ["GGGGsGG", "GGGGsGG", "gGGGsGg", "sssssss", "ggGGsgg"]);
  // A striped stick.
  for (let s = 0; s < 12; s++) {
    const [px, py] = at(24 + s * 0.3, 44 + s);
    put(extra, px, py, s % 3 === 0 ? "S" : "w");
    put(extra, px + 1, py, s % 3 === 0 ? "s" : "W");
  }
  // A string of bulbs spilling out over its side.
  const [bx0, by0] = at(44, 38);
  bulbString(extra, Math.round(bx0), Math.round(by0), Math.round(bx0) + 14, Math.round(by0) + 16, 2, { start: 1, every: 5, offset: 2 });
  return def("sled", [2, 1], SLW, SLH, [SLW / 2, SLF], [bits(groundShadow(SLW / 2 + 2, SLF, 33, 3), sled, sack, cropBit(extra, false))]);
})();

// ==== The showpiece: his "tree", a tall pile of presents, ornaments and trinkets stacked into a tree shape, a star on top,
// a string of old bulbs wound round it, chasing; the star twinkles.

const SPW = 3 * T;
const SP_RISE = 104;
const SPH = SP_RISE + 2 * T;
const SPF = SP_RISE + T + 18; // its foot: the middle of its south row
/** The presents, bottom to top: [x, width, height, paper, its shade, its lit top, ribbon, its shade]. */
const BOXES: readonly (readonly [number, number, number, string, string, string, string, string])[] = [];
{
  const rows: readonly (readonly (readonly [number, number, string])[])[] = [
    [[6, 27, "s"], [34, 30, "g"], [65, 22, "B"], [88, 18, "N"]],
    [[13, 24, "b"], [38, 28, "S"], [67, 24, "G"]],
    [[22, 25, "N"], [48, 25, "t"], [74, 14, "s"]],
    [[30, 22, "G"], [53, 22, "B"]],
    [[38, 30, "S"]],
    [[45, 20, "g"]],
    [[49, 13, "b"]],
  ];
  const H = [24, 22, 20, 18, 16, 15, 12];
  const PAPER: Record<string, [string, string, string, string]> = {
    s: ["r", "S", "T", "t"],
    S: ["s", "S", "T", "t"],
    g: ["g", "G", "S", "s"],
    G: ["g", "G", "T", "t"],
    B: ["B", "b", "T", "t"],
    b: ["B", "b", "S", "s"],
    N: ["M", "E", "T", "t"],
    t: ["t", "T", "s", "r"],
  };
  let y = SPF;
  rows.forEach((row, r) => {
    for (const [x, w, p] of row) {
      const [shade, mid, rib, ribS] = PAPER[p]!;
      (BOXES as (readonly [number, number, number, string, string, string, string, string])[]).push([x, w, H[r]!, mid, shade, p === "t" ? "u" : mid, rib, ribS]);
      void y;
    }
    y -= H[r]!;
  });
}
const rowTops: number[] = [];
{
  let y = SPF;
  for (const h of [24, 22, 20, 18, 16, 15, 12]) rowTops.push((y -= h));
}
const STAR: Pt = [55.5, rowTops[6]! - 11];
export const SHOP_HOLLOW_SHOWPIECE = (() => {
  const N = 10;
  // Each box drawn on its own (outlined), bottom row last so their lit tops overlap the row above.
  const boxBits: Bit[] = [];
  let k = 0;
  const counts = [4, 3, 3, 2, 1, 1, 1];
  const rowsOf: number[] = counts.flatMap((n, r) => Array<number>(n).fill(r));
  BOXES.forEach(([x0, w, h, mid, shade, lit, rib, ribS], bi) => {
    const r = rowsOf[bi]!;
    const y1 = r === 0 ? SPF : rowTops[r - 1]!;
    const y0 = y1 - h;
    const rx = x0 + Math.floor(w / 2) - 1 + ((bi * 5) % 5) - 2;
    const ry = y0 + Math.floor(h / 2) - (bi % 2);
    boxBits.push(
      paint(x0, y0, w, h, (x, y) => {
        const i = x - x0;
        const j = y - y0;
        if (Math.abs(x - rx) <= 1) return x === rx - 1 ? rib : x === rx + 1 ? ribS : rib;
        if (Math.abs(y - ry) <= 1) return y === ry + 1 ? ribS : rib;
        if (j < 2) return lit;
        if (i > w - 4) return shade;
        if (j === h - 1) return shade;
        return (i + j * 3) % 11 === 0 && bi % 3 === 0 ? lit : mid; // a pattern on some papers
      }),
    );
    k++;
  });
  boxBits.reverse();
  // Trinkets tucked in: an old teapot, a boot, a toy drum, a little horn; ornaments in the gaps.
  const trinkets = cv(SPW, SPH);
  stamp(trinkets, 92, SPF - 34, ["..33..", ".3223.3", "332222.3", "322222.3", "3222223", ".22222."]);
  stamp(trinkets, 2, SPF - 40, ["..55", "..65", "..65", "..65", "6665", "66655"]);
  stamp(trinkets, 84, rowTops[1]! - 10, ["TTTTTTT", "sSsSsSs", "SsSsSsS", "sSsSsSs", "ttttttt"]);
  stamp(trinkets, 24, rowTops[3]! - 4, ["!0", ".!00", "..!000", "...0900"]);
  for (const [ox, oy, a, b2] of [[33, SPF - 25, "T", "t"], [64, SPF - 23, "S", "s"], [12, rowTops[0]! - 1, "Z", "U"], [62, rowTops[1]! - 2, "T", "t"], [46, rowTops[2]! - 1, "b", "B"], [75, rowTops[2]! + 1, "Z", "U"], [51, rowTops[3]! - 1, "S", "s"], [68, rowTops[4]! + 2, "T", "t"], [44, rowTops[5]! + 4, "G", "g"]] as const) {
    stamp(trinkets, ox - 1, oy - 4, [".3.", ".2."]);
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (i * i + j * j <= 5) put(trinkets, ox + i, oy + j, i + j < -1 ? "u" : i + j > 1 ? b2 : a);
  }
  // The string wound round it: zigzags from the bottom left up to the star.
  const ZIG: readonly Pt[] = [[8, SPF - 8], [100, SPF - 26], [16, rowTops[1]! + 4], [92, rowTops[2]! + 6], [30, rowTops[3]! + 5], [78, rowTops[4]! + 5], [44, rowTops[5]! + 3], [66, rowTops[6]! + 4]];
  const pts: Pt[] = [];
  for (let i = 1; i < ZIG.length; i++) {
    const [ax, ay] = ZIG[i - 1]!;
    const [bx, by] = ZIG[i]!;
    const n = Math.ceil(Math.hypot(bx - ax, by - ay));
    for (let s = 0; s < n; s++) {
      const t = s / n;
      pts.push([ax + (bx - ax) * t, ay + (by - ay) * t + 3 * Math.sin(Math.PI * t)]);
    }
  }
  const frames = Array.from({ length: N }, (_, f) => {
    const s = cv(SPW, SPH);
    pts.forEach(([x, y]) => put(s, x, y, "2"));
    let n = 0;
    for (let i = 4; i < pts.length; i += 11, n++) {
      const [x, y] = pts[i]!;
      const lit = (n + f) % 3 !== 0;
      const col = BULB_COLORS[n % BULB_COLORS.length]!;
      bulb(s, Math.round(x), Math.round(y), n % 7 === 4 ? "Ç" : lit ? col : "Ç", n % 5 === 1);
    }
    // The star: five points in gold, a hot core; rays and sparkles turning round it.
    const star = cv(SPW, SPH);
    const [sx, sy] = STAR;
    for (let y = -12; y <= 12; y++)
      for (let x = -12; x <= 12; x++) {
        const a = Math.atan2(y, x) + Math.PI / 2;
        const r = Math.hypot(x, y);
        const lobe = 10.5 * (0.45 + 0.55 * Math.pow(Math.abs(Math.cos((5 * a) / 2)), 3));
        if (r > lobe) continue;
        put(star, sx + x, sy + y, r < 2.5 ? "u" : x + y < -1 ? "T" : r > lobe - 1.2 ? "t" : x + y > 3 ? "t" : "T");
      }
    const sp = cv(SPW, SPH);
    const ph = f % 5;
    const ray = 13 + (ph % 2);
    for (let j = 1; j <= 3; j++) {
      if (ph === 1 || ph === 3) {
        put(sp, sx, sy - ray - j, j === 3 ? "T" : "u");
        put(sp, sx, sy + ray + j - 2, j === 3 ? "T" : "u");
        put(sp, sx - ray - j, sy, j === 3 ? "T" : "u");
        put(sp, sx + ray + j, sy, j === 3 ? "T" : "u");
      }
    }
    for (const [dx, dy, ff] of [[-16, -9, 0], [17, -4, 2], [-12, 8, 4], [14, 11, 6], [-4, -17, 8]] as const) {
      if (f !== ff && f !== ff + 1) continue;
      stamp(sp, sx + dx - 1, sy + dy - 1, f === ff ? [".u.", "uÆu", ".u."] : ["...", ".T.", "..."]);
    }
    // A glint on an ornament, moving up the pile.
    return bits(groundShadow(SPW / 2, SPF, 52, 4), ...boxBits, cropBit(trinkets), cropBit(s, false), cropBit(star), cropBit(sp, false));
  });
  void k;
  return def("showpiece", [3, 2], SPW, SPH, [Math.floor(SPW / 2), SPF], frames, 150);
})();

// ==== The cozy corner: a worn armchair by a small fire pit, one stocking hung on a rock.

/** A worn wingback armchair in plum velvet, turned to the fire on its right: a patch, stuffing poking out, a knitted throw. */
export const SHOP_HOLLOW_ARMCHAIR = (() => {
  const W_ = T;
  const H_ = 54;
  const F = H_ - 4;
  const velvet = (x: number, y: number, l: number) => (grain(x, y, 170) > 0.9 ? "M" : l < 0.33 ? "M" : l < 0.66 ? "N" : "E");
  const back = paint(3, 6, 16, F - 14, (x, y) => {
    const i = x - 3;
    const j = y - 6;
    if (j < 3 && (i < 2 || i > 13)) return null; // its rounded top
    if (i > 11 && j > 18) return null;
    return velvet(x, y, 0.75 - i * 0.03 - j * 0.012);
  });
  const wing = paint(13, 9, 8, 16, (x, y) => (x - 13 > 6 - (y - 9) * 0.1 ? null : velvet(x, y, 0.45 - (x - 13) * 0.04)));
  const seat = paint(10, 26, 24, 12, (x, y) => {
    const j = y - 26;
    if (j < 3) return x === 10 ? "N" : "E"; // the cushion's top
    return velvet(x, y, 0.45 - j * 0.03);
  });
  const arm = paint(8, 22, 27, 16, (x, y) => {
    const i = x - 8;
    const j = y - 22;
    // A rolled arm along the near side, its scroll at the front.
    const scroll = Math.hypot(x + 0.5 - 30.5, y + 0.5 - 26.5);
    if (scroll < 4.6) return scroll < 1.6 ? "M" : scroll > 3.6 ? (y < 26 ? "E" : "M") : "N";
    if (i > 22) return null;
    if (j < 2) return j === 0 && i > 2 ? "E" : "N";
    // Stuffing poking out of a split along its top.
    if (j === 2 && i > 9 && i < 14) return "w";
    if (j === 3 && i > 10 && i < 13) return "W";
    // A patch of green, stitched on.
    if (i > 3 && i < 10 && j > 5 && j < 11) return i === 4 || i === 9 || j === 6 || j === 10 ? ((i + j) % 2 ? "W" : "g") : "G";
    return velvet(x, y, 0.55 - j * 0.03);
  });
  const skirt = paint(7, 38, 28, 6, (x, y) => (y === 38 ? "N" : x % 4 === 0 ? "M" : "N"));
  const legs = paint(8, 44, 26, F - 43, (x) => (x <= 9 || x >= 32 ? (x === 8 || x === 32 ? "6" : "5") : null));
  // A knitted throw over the back, striped, its fringe hanging.
  const throwC = cv(W_, H_);
  for (let y = 4; y < 22; y++)
    for (let x = 2; x < 13; x++) {
      if (x < 2 + (y - 4) * 0.15 || x > 12 - (y > 17 ? (y - 17) * 1.5 : 0)) continue;
      put(throwC, x, y, Math.floor((y - 4) / 3) % 2 ? (x % 2 ? "s" : "S") : x % 2 ? "W" : "w");
    }
  for (let x = 4; x < 12; x += 2) put(throwC, x, 22, "S"), put(throwC, x, 23, "s");
  return def("armchair", [1, 1], W_, H_, [18, F], [bits(groundShadow(20, F, 16, 3), legs, back, wing, seat, skirt, arm, cropBit(throwC))]);
})();

/** A small fire pit: a ring of frosted stones, split logs, a flame (paint.ts) that flickers, embers rising (6 frames). */
const FPW = T;
const FPH = 46;
const FPF = FPH - 6;
export const SHOP_HOLLOW_FIRE_PIT = (() => {
  const ringBack = paint(2, FPF - 9, 33, 7, (x, y) => {
    const dx = (x + 0.5 - 18.5) / 15;
    const dy = (y + 0.5 - (FPF - 5)) / 4;
    const d = Math.hypot(dx, dy);
    if (d > 1 || d < 0.62 || y > FPF - 5) return null;
    const stone = Math.floor((Math.atan2(dy, dx) + Math.PI) * 2.2);
    return (stone % 2 ? "C" : "c") === "C" && y < FPF - 7 ? "W" : stone % 2 ? "C" : "c";
  });
  const logs = cv(FPW, FPH);
  stamp(logs, 9, FPF - 8, ["....556677..", "..55667788..", "5566778.....", "4555.......7"]);
  stamp(logs, 15, FPF - 8, ["776655....", "..887766..", ".....77665", "6......554"]);
  const ringFront = paint(1, FPF - 6, 35, 9, (x, y) => {
    const dx = (x + 0.5 - 18.5) / 16.5;
    const dy = (y + 0.5 - (FPF - 4)) / 4.6;
    const d = Math.hypot(dx, dy);
    if (d > 1 || y < FPF - 4) return null;
    const stone = Math.floor((Math.atan2(dy, dx) + Math.PI) * 2.6);
    const l = 0.6 - dx * 0.35 - (y - (FPF - 4)) * 0.08;
    if (Math.abs(((Math.atan2(dy, dx) + Math.PI) * 2.6) % 1) < 0.12) return "n";
    return y === FPF - 4 && stone % 2 ? "W" : l > 0.62 ? "h" : l > 0.4 ? "C" : "c";
  });
  const frames = [0, 1, 2, 3, 4, 5].map((f) => {
    const fl = flame(13, 19, f * 1.7, f % 2 ? 1 : -1);
    const fl2 = flame(7, 11, f * 2.3 + 1, f % 3 === 0 ? -1 : 1);
    const emb = cv(FPW, FPH);
    for (const [ex, ey0, sp] of [[14, 4, 3], [22, 1, 4], [18, 7, 5]] as const) {
      const ey = FPF - 22 - ((f * sp + ey0 * 2) % 16);
      put(emb, ex + ((f + ey0) % 3) - 1, ey, (f + ex) % 2 ? "Y" : "f");
    }
    return bits(groundShadow(18, FPF, 17, 4), ringBack, fromGrid(fl, 12, FPF - 24), fromGrid(fl2, 19, FPF - 16), cropBit(logs), ringFront, cropBit(emb, false));
  });
  return def("fire-pit", [1, 1], FPW, FPH, [18, FPF], frames, 120);
})();

/** A waist-high boulder by the fire, frost on its top, and one red knitted stocking hung on a nail in it (empty, darned at the heel). */
export const SHOP_HOLLOW_STOCKING_ROCK = (() => {
  const W_ = T;
  const H_ = 50;
  const F = H_ - 4;
  const rock = paint(2, 14, 34, F - 13, (x, y) => {
    const dx = (x + 0.5 - 18.5) / 15.5;
    const dy = (y + 0.5 - 31) / 16.5;
    const d = Math.hypot(dx, dy) + (grain(Math.floor(x / 4), Math.floor(y / 4), 180) - 0.5) * 0.1;
    if (d > 1 || y > F) return null;
    const l = 0.55 - dx * 0.35 - dy * 0.45 + (grain(x, y, 181) - 0.5) * 0.12;
    if (dy < -0.55 && l > 0.45 && grain(x, y, 182) > 0.25) return l > 0.7 ? "w" : "W";
    return y > F - 2 ? "d" : l < 0.3 ? "d" : l < 0.5 ? "c" : l < 0.75 ? "C" : "h";
  });
  const st = cv(W_, H_);
  put(st, 23, 20, "3");
  stamp(st, 17, 21, ["..W..2....", ".wwwWwwW..", "wwWwwwWwW.", ".WwWWwWW..", "..sSsSsS..", "..SsSsSs..", "..sSsSsS..", "..SsSsSs..", "..sSsSsS..", "..SsGGSs..", "..sGGGsS..", "..SsSsSsS.", "..sSsSsSsS", "..rSsSsSsrr", "...rrsSsrrr", "....rrrrrr."]);
  return def("stocking-rock", [1, 1], W_, H_, [18, F], [bits(groundShadow(18, F, 16, 3), rock, cropBit(st))]);
})();

// ==== What he "borrowed" from the other homes: a plank, a red balloon tied to it (bobbing), a tin bucket, a spinning top, a mitten.

const PIW = 2 * T;
const PIH = 64;
const PIF = PIH - 4;
export const SHOP_HOLLOW_PILE = (() => {
  const plank = paint(4, 16, 22, PIF - 15, (x, y) => {
    const t = (PIF - y) / (PIF - 16);
    const cx = 9 + t * 12;
    const d = x + 0.5 - cx;
    if (Math.abs(d) > 3) return null;
    if ((y === 30 || y === 31) && Math.abs(d) < 1) return "3";
    return d < -2 ? "8" : d > 2 ? "5" : (x + y * 3) % 13 === 0 ? "5" : "7";
  });
  const bucket = paint(24, PIF - 16, 18, 17, (x, y) => {
    const j = y - (PIF - 16);
    const half = 6 + j * 0.18;
    const d = x + 0.5 - 33;
    if (Math.abs(d) > half) return null;
    if (j === 0) return "1";
    if (j % 5 === 2) return "2";
    return d < -half + 2 ? "3" : d > half - 3 ? "1" : "2";
  });
  const top = paint(44, PIF - 15, 16, 16, (x, y) => {
    const j = y - (PIF - 15);
    if (j < 4) return Math.abs(x + 0.5 - 52) < 1 ? "5" : null; // its handle
    const half = j < 9 ? 2 + (j - 4) * 1.3 : 8.5 - (j - 9) * 1.4;
    const d = x + 0.5 - 52;
    if (Math.abs(d) > half) return null;
    if (j === 9 || j === 10) return "T";
    return d < -half + 2 ? "b" : j % 3 === 0 ? "S" : "B";
  });
  const mitten = cv(PIW, PIH);
  stamp(mitten, 58, PIF - 8, ["..bb.....", ".bbbb.bb.", "bbbBbbbbb", "bBbbbBbbb", "WWWWWbbbb", "WWWWW.bb."]);
  const frames = [0, 1, 2, 3].map((f) => {
    const bob = [0, -1, -1, 0][f]!;
    const sway = [0, 1, 0, -1][f]!;
    const bal = cv(PIW, PIH);
    const [bx, by] = [41 + sway, 11 + bob];
    for (let y = -9; y <= 9; y++)
      for (let x = -8; x <= 8; x++) {
        const d = Math.hypot(x / 7.5, (y + 0.5) / 8.8);
        if (d > 1) continue;
        put(bal, bx + x, by + y, x < -2 && y < -3 && d > 0.35 && d < 0.75 ? "w" : x + y > 5 ? "s" : "S");
      }
    stamp(bal, bx - 1, by + 9, ["sSs", ".s."]);
    // Its string, down to where it's tied round the plank.
    for (let s = 0; s <= 1; s += 0.03) put(bal, bx + (20 - bx) * s + Math.sin(s * 6 + f) * 1.2, by + 11 + (34 - by - 11) * s, "W");
    return bits(groundShadow(PIW / 2, PIF, 34, 3), plank, bucket, top, cropBit(mitten), cropBit(bal));
  });
  return def("pile", [2, 1], PIW, PIH, [PIW / 2, PIF], frames, 400);
})();

// ==== The lights, each on its piece (`piece`; x, y in its own pixels). Repeated pieces (the lanterns, the bulbs) light at
// every place they stand.

const BULB_LIGHT: Record<string, string> = { À: "#ff5a4a", Á: "#5ae070", Â: "#6aa0ff", Ã: "#ffd860", Ä: "#ffa040", Å: "#ff8ad0" };
const bulbSpots = (piece: string, x: number, y: number, w: number, h: number, strength = 0.85) =>
  Object.entries(BULB_LIGHT).map(([k, color]) => ({ piece, x, y, w, h, keys: k + "Æ", color, strength }));
const STAR_GOLD = "#ffe27a";
const CRATE_GOLD = "#ffd27a";
/** The lanterns' glass (a flicker and a halo), the fire, the bulbs (each its own color), the tree's star and bulbs, the crate's leaking light, the candle, the town's lights through the crack. */
export const SHOP_HOLLOW_LIGHTS: readonly (LightSpot & { piece: string })[] = [
  ...["lantern", "lantern-b"].map((piece) => ({ piece, x: 9, y: LT_TOP + 7, w: 19, h: 8, keys: "LlyYm", color: LANTERN_LIGHT, strength: 1, flicker: true, halo: 34 })),
  { piece: "fire-pit", x: 8, y: FPF - 26, w: 22, h: 24, keys: "yYfF", color: TORCH, strength: 1, flicker: true, halo: 40 },
  ...["bulbs", "bulbs-b", "bulbs-c", "bulbs-step"].flatMap((piece) => bulbSpots(piece, 0, PIN_Y - T - 2, T, T + 16)),
  ...bulbSpots("backdrop", 0, BDH - 1 - PIN_UP - 2, BDW, 18),
  { piece: "backdrop", x: 116, y: NICHE.y + NICHE.h - 16, w: 5, h: 6, keys: "yYf", color: WARM, strength: 0.8, flicker: true, halo: 14 },
  { piece: "showpiece", x: STAR[0] - 15, y: STAR[1] - 15, w: 31, h: 31, keys: "tTuÆ", color: STAR_GOLD, strength: 1, halo: 30 },
  ...bulbSpots("showpiece", 0, rowTops[6]!, SPW, SPF - rowTops[6]!, 0.7),
  ...bulbSpots("sled", 40, 20, 30, 30, 0.6),
  { piece: "crate", x: 1, y: 8, w: 32, h: 20, keys: "tTu", color: CRATE_GOLD, strength: 0.7, flicker: true, halo: 16 },
  { piece: "rock-crack", x: 14, y: 70, w: 12, h: 16, keys: "*&", color: WARM, strength: 0.6 },
];
/** ... and pools on the floor: under each lantern, round the fire, before the tree, before the counter's wall, a cool one at the mouth. */
export const SHOP_HOLLOW_POOLS: readonly (LightPool & { piece: string })[] = [
  ...["lantern", "lantern-b"].map((piece) => ({ piece, x: 18, y: WALL_H + 2, rx: 44, ry: 14, color: LANTERN_LIGHT, strength: 0.32 })),
  { piece: "fire-pit", x: 18, y: FPF + 2, rx: 52, ry: 16, color: TORCH, strength: 0.4 },
  { piece: "showpiece", x: SPW / 2, y: SPF + 6, rx: 60, ry: 14, color: STAR_GOLD, strength: 0.2 },
  { piece: "backdrop", x: BDW / 2, y: BDH + 6, rx: 80, ry: 14, color: WARM, strength: 0.16 },
  { piece: "entrance", x: EW / 2, y: EFOOT - 4, rx: 50, ry: 14, color: ICE_LIGHT, strength: 0.18 },
];

//@@PIECES@@

// ==== The floor's shape, and which rock piece stands on each rock square.

/** The walkable floor: 20 rows of 20, `.` floor, `#` rock. In at the mouth (row 19), up the middle past the pond, round to the west at the back. */
export const SHOP_HOLLOW_FLOOR: readonly string[] = [
  "####################",
  "####################",
  "###......###########",
  "##........##########",
  "##..........########",
  "##............######",
  "##.............#####",
  "###..............###",
  "######...........###",
  "#########........###",
  "#########.........##",
  "#########.........##",
  "#########.........##",
  "#########.........##",
  "#########........###",
  "##########.......###",
  "##########.......###",
  "###########......###",
  "###########......###",
  "############....####",
];
const isOpen = (col: number, row: number) => SHOP_HOLLOW_FLOOR[row]?.[col] === ".";
/**
 * The rock piece for a rock square, from its neighbours (open = floor): floor to its south: a back face (an outer corner
 * if there's floor to its west too; mirrored if to its east); else floor to its north: the low hem (its end if floor to
 * its east; mirrored, west); else floor to its east: a side (mirrored, west); else floor only diagonally to its south-east:
 * an inner corner (mirrored, south-west). Else nothing stands there (only the rock seen from above).
 */
export function rockPiece(col: number, row: number): { kind: "back" | "corner-out" | "hem" | "hem-end" | "side" | "corner-in"; flip: boolean } | null {
  if (isOpen(col, row)) return null;
  const S = isOpen(col, row + 1);
  const N = isOpen(col, row - 1);
  const E = isOpen(col + 1, row);
  const W = isOpen(col - 1, row);
  if (S) return W ? { kind: "corner-out", flip: false } : E ? { kind: "corner-out", flip: true } : { kind: "back", flip: false };
  if (N) return E ? { kind: "hem-end", flip: false } : W ? { kind: "hem-end", flip: true } : { kind: "hem", flip: false };
  if (E) return { kind: "side", flip: false };
  if (W) return { kind: "side", flip: true };
  if (isOpen(col + 1, row + 1)) return { kind: "corner-in", flip: false };
  if (isOpen(col - 1, row + 1)) return { kind: "corner-in", flip: true };
  return null;
}

// ==== The layout.

export interface ShopPlace {
  name: string;
  col: number;
  row: number;
  solid: boolean;
  /** Quarter turns clockwise (floor tiles only), and mirrored left to right. */
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

// -- The floor (every square): rock from above on the rock, the pond, snow at the mouth, frost here and there.
const PEBBLY = new Set(["5,7", "13,17", "16,9", "10,15", "8,4", "3,3"]);
const FROSTY = new Set(["9,9", "16,14", "12,16", "7,6", "14,6", "11,4"]);
for (let row = 0; row < 20; row++)
  for (let col = 0; col < 20; col++) {
    const k = `${col},${row}`;
    if (!isOpen(col, row)) at((col * 7 + row * 3) % 5 < 2 ? "floor-rock-b" : "floor-rock", col, row, false);
    else if (CIRCLE.has(k)) at(`circle-${col}-${row}`, col, row, false);
    else if (row >= 18) at("floor-snow", col, row, false);
    else if (row === 17) at("floor-snow-thin", col, row, false);
    else if (PEBBLY.has(k)) at("floor-c", col, row, false);
    else if (FROSTY.has(k)) at("floor-d", col, row, false);
    else at((col + row) % 2 ? "floor-b" : "floor-a", col, row, false);
  }
const FLOOR_COUNT = LAYOUT.length;

// -- The rock along the floor's edge (rockPiece), the backdrop behind the counter, the crack, the bulbs pinned along it.
const BACKDROP_AT = { col: 4, row: 1 } as const;
const CRACK_AT = "11,3";
/** The bulb string's squares: from the west corner behind the counter, across the backdrop and round the curve to the tree. */
const BULB_RUN = ["2,2", "3,1", "8,1", "9,2", "10,3", "11,3", "12,4", "13,4", "14,5", "15,6", "16,6"];
for (let row = 0; row < 20; row++)
  for (let col = 0; col < 20; col++) {
    if (row === BACKDROP_AT.row && col >= BACKDROP_AT.col && col < BACKDROP_AT.col + 4) {
      if (col === BACKDROP_AT.col) at("backdrop", col, row, true);
      continue;
    }
    const rp = rockPiece(col, row);
    if (!rp) continue;
    const v = (col * 3 + row * 5) % 3;
    const k = `${col},${row}`;
    const name =
      k === CRACK_AT ? "rock-crack"
      : rp.kind === "back" ? ["rock-back", "rock-back-b", "rock-back-c"][v]!
      : rp.kind === "side" ? (row % 2 ? "rock-side" : "rock-side-b")
      : rp.kind === "hem" ? (col % 2 ? "rock-hem" : "rock-hem-b")
      : `rock-${rp.kind}`;
    at(name, col, row, true, rp.flip ? { flip: true } : {});
    const b = BULB_RUN.indexOf(k);
    if (b >= 0) at(rp.kind === "corner-out" ? "bulbs-step" : ["bulbs", "bulbs-b", "bulbs-c"][b % 3]!, col, row, false, rp.flip ? { flip: true } : {});
  }

// -- The mouth: the way out in the middle of row 19, a snowbank either side of it.
at("drift", 12, 19, true);
at("entrance", 13, 19, false, { exit: true });
at("drift", 15, 19, true);

// -- The shop and his things.
at("counter", 4, 4, true);
at("crate", 4, 4, false); // on the counter (see SHOP_HOLLOW_CRATE_AT): its place is the counter's
at("pile", 2, 3, true);
at("stocking-rock", 2, 5, true);
at("armchair", 2, 6, true);
at("fire-pit", 3, 6, true);
at("sled", 12, 5, true);
at("showpiece", 14, 8, true); // columns 14-16, rows 7-8
at("lantern", 6, 6, false);
at("lantern-b", 11, 8, false);
at("lantern", 9, 11, false);
at("lantern-b", 17, 12, false);
at("lantern", 13, 16, false);
//@@PROPS@@

/** Where every piece goes: name, column (its west-most square), row (its south-most), solid; floor tiles first, then the upright pieces north to south. */
export const SHOP_HOLLOW_LAYOUT: readonly ShopPlace[] = [...LAYOUT.slice(0, FLOOR_COUNT), ...LAYOUT.slice(FLOOR_COUNT).sort((a, b) => a.row - b.row || a.col - b.col)];

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
    return [cx - cp.foot[0] + SHOP_HOLLOW_CRATE_AT[0], cy - cp.foot[1] + SHOP_HOLLOW_CRATE_AT[1]];
  }
  return [pl.col * T + Math.floor((p.sq[0] * T) / 2), TOP + pl.row * T + 18];
};
const roomFrame = (f: number): Frame => {
  const layers: Layer[] = [];
  for (const pl of SHOP_HOLLOW_LAYOUT) {
    const p = PIECES[pl.name]!;
    const [fx, fy] = footOf(pl);
    layers.push(...placed(p, f, fx, fy, pl.flip, pl.rot));
  }
  return { ms: 100, layers };
};
const anims: Record<string, Anim> = { idle: { loop: true, frames: [roomFrame(0)] } };
/** (For review: the room with every piece's idle running.) */
anims["room-live"] = { loop: true, frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(roomFrame) };
/** Each piece alone, for review, blown up (up to 4x); a floor tile three by three, a wall three side by side. */
for (const p of Object.values(PIECES)) {
  if (p.name.startsWith("circle-")) continue; // (see review-circle)
  const ch = toChar(p);
  const flatTile = p.w === T && p.h === T;
  const [rx, ry] = flatTile ? [3, 3] : p.name.startsWith("rock") ? [3, 1] : [1, 1];
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
  // (For review: the pond as laid out (columns 8-17, rows 8-15) at 2x.)
  const floorAt2 = new Map(SHOP_HOLLOW_LAYOUT.slice(0, FLOOR_COUNT).map((p) => [`${p.col},${p.row}`, p]));
  const keyAt = (gx: number, gy: number) => PIECES[floorAt2.get(`${Math.floor(gx / T)},${Math.floor(gy / T)}`)!.name]!.frames[0]![0]!.part.grid[gy % T]![gx % T]!;
  const grid = Array.from({ length: 8 * T * 2 }, (_, y) => Array.from({ length: 10 * T * 2 }, (_, x) => keyAt(8 * T + (x >> 1), 8 * T + (y >> 1))).join(""));
  roomParts["review-circle"] = { grid, outline: false };
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
reviewRow("review-walls", ["rock-back", "rock-back-b", "rock-back-c", "rock-corner-out", "rock-corner-in", "rock-side", "rock-side-b", "rock-crack", "rock-hem", "rock-hem-end", "bulbs", "bulbs-step", "lantern", "entrance", "drift"]);
reviewRow("review-props", ["counter", "crate", "sled", "armchair", "fire-pit", "stocking-rock", "pile"], 3);
//@@REVIEW@@

/** Every piece by its name (as SHOP_HOLLOW_LAYOUT names them), each its own Character `shop-hollow-<name>`. */
export const SHOP_HOLLOW_PIECES: Readonly<Record<string, Character>> = Object.fromEntries(Object.values(PIECES).map((p) => [p.name, toChar(p)]));

export const HOUSE_SHOP_HOLLOW: Character = { id: "house-shop-hollow", name: "Hollow's shop", w: RW, h: RH, foot: [RW / 2, RH - 4], palette: PALETTE, parts: roomParts, anims };

export type { LightPool, LightSpot };
