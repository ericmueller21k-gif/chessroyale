/**
 * Inside Big Boy's Crib: Big Boy's shop (house-shop-bigboy). A room of 20 x 20 squares seen as the town square is seen (the
 * camera looks north, things stand upright at their foot, 37 px a square): the inside of the giant crib of
 * town/houses/bigboy.ts, in Big Boy's colors (characters/bigboy.ts: his toy rainbow "1"-"6", the whites, the teal of his
 * BIG BOY shirt, the light blue of his diaper, the crib's wood). The whole floor is a ball pit; a raised walkway of foam
 * play-mat squares with soft white bumpers joins the door, the battle circle (a rainbow play mat raised on giant toy
 * blocks), the shop's quilted platform and the showpiece, a toy airplane flying round on its string from the ceiling.
 * Stuffed animals poke up out of the balls. The back wall is bright and clean: big windows on a sky with a rainbow, a
 * frieze of alphabet blocks along its top (the ceiling can follow on in toy blocks).
 * Each piece is its own `Character` (`shop-bigboy-<name>`); `HOUSE_SHOP_BIGBOY` is the whole room laid out as one still,
 * with one extra animation per piece; `SHOP_BIGBOY_LAYOUT` says where each piece goes. Built as Alfil's shop is
 * (scripts/boss-art/out/house-shop-alfil).
 *
 * Footing: a piece's foot is the middle of its square (a wide piece's: the middle of its width, on the middle of its row;
 * a deep piece stands on its south row). Floor tiles are flat, top-down, 37 x 37, foot at their middle; some are turned
 * by `rot` (quarter turns clockwise) or mirrored (`flip`), and the east wall is the west one mirrored.
 */
import { frameKeys, type Anim, type Character, type Frame, type Layer, type Part } from "../../../../packages/app/src/characters/sprite.ts";
import { grain, groundShadow, LANTERN_LIGHT, paint, signBoard, signFace, type LightPool, type LightSpot, type Pt } from "../../../../packages/app/src/town/houses/kit.ts";

const PALETTE: Record<string, string> = {
  k: "#2a1712", // outline (Big Boy's)
  F: "#ffffff", // white, its shade, deeper
  W: "#e6e1d8",
  V: "#c4bdb1",
  "1": "#ff3349", // his toy rainbow: red, orange, yellow, green, blue, purple
  "2": "#ff8a1a",
  "3": "#ffe23b",
  "4": "#35c94b",
  "5": "#2e86ff",
  "6": "#a24cf5",
  "7": "#c41f30", // ... their shades
  "8": "#c4600d",
  "9": "#c9a312",
  "0": "#1f8a30",
  "!": "#1d5ec0",
  "?": "#6e2aab",
  "(": "#ff8a96", // ... their light tints
  ")": "#ffc070",
  "[": "#fff08a",
  "]": "#8be89a",
  "{": "#8cc0ff",
  "}": "#cf9cff",
  // The ball pit's balls: softened rainbow, mid and shade; the dark down between them.
  A: "#f0596a",
  a: "#bd3c52",
  B: "#f79a45",
  b: "#c76c2a",
  C: "#f5d84e",
  c: "#c4a434",
  D: "#5cc96c",
  d: "#2f8f4a",
  E: "#4f95ee",
  e: "#3062b8",
  G: "#ad78e6",
  g: "#7748b0",
  H: "#75668c",
  h: "#5a4c70",
  T: "#0f5c63", // his shirt's teal: dark to light
  t: "#178589",
  u: "#23a8a8",
  U: "#4fcfc6",
  y: "#ffd95a", // the walkway's yellow foam
  P: "#6f8fb3", // his diaper's light blue: dark to light
  p: "#97b7d6",
  q: "#bcd4ea",
  Q: "#e2eef9",
  N: "#5a3015", // the crib's wood: dark to light
  O: "#8a5228",
  J: "#b87a3e",
  K: "#dca562",
  L: "#7a4a22", // plush fur (a bear): dark, mid, light, muzzle
  l: "#a86c38",
  m: "#c99256",
  M: "#ead0a8",
  s: "#8fc8f4", // the sky through the windows: high, mid, low
  S: "#b8def8",
  x: "#dff0fb",
  n: "#ffb6cc", // pink (his lips'): light, mid
  z: "#e7719a",
  i: "#9aa3b5", // a plush elephant's grey-lilac: mid, light, shade
  j: "#c3cad6",
  w: "#6f7890",
  o: "#d9c49a", // the plaque's face: shadow, board, light
  R: "#efe0bf",
  r: "#fff6e2",
  Y: "#1b0e0a", // button eyes
  Z: "#6b6f7a", // string
  v: "#fff3b0", // a nightlight's glow: bright, warm
  f: "#ffd36b",
  "-": "#0d0e1280", // ground shadow: core, rim
  "+": "#0d0e1244",
};
const SAT = "123456";
const SHD = "7890!?";
const TNT = "()[]{}";

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
  return { id: `shop-bigboy-${p.name}`, name: `Big Boy's shop: ${p.name}`, w: p.w, h: p.h, foot: p.foot, palette: PALETTE, parts, anims: { idle: { loop: true, frames } } };
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
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number) => (BAYER[(((y % 4) + 4) % 4) * 4 + (((x % 4) + 4) % 4)]! + 0.5) / 16;

/** Letters on the toy blocks, 3 x 5 (a pixel each). */
const GLYPH: Record<string, string> = {
  A: "010101111101101",
  B: "110101110101110",
  C: "011100100100011",
  D: "110101101101110",
  E: "111100110100111",
  F: "111100110100100",
  G: "011100101101011",
  H: "101101111101101",
  I: "111010010010111",
  J: "001001001101010",
  K: "101101110101101",
  L: "100100100100111",
  O: "010101101101010",
  Y: "101101010010010",
};
const glyphAt = (l: string, i: number, j: number) => i >= 0 && j >= 0 && i < 3 && j < 5 && GLYPH[l]?.[j * 3 + i] === "1";

// ==== The floor: flat squares, top-down, no outline.

const flat = (fn: (x: number, y: number) => Key): Bit[][] => [[paint(0, 0, T, T, fn, false)]];
const tileDef = (name: string, fn: (x: number, y: number) => Key) => def(name, [1, 1], T, T, [18, 18], flat(fn));

// ---- The ball pit. Each tile is a heap of balls, lit from the top left: the ones on top in their color with a shaded
// rim and a soft light spot, the ones lower down dim, the dark between them. The balls that cross a tile's edges are the
// same in every pit tile (wrapped round), so any pit tile meets any other without a seam; inside, each tile's own.

interface Ball {
  x: number;
  y: number;
  r: number;
  k: string;
  z: number;
}
const MIDS = "ABCDEG";
const BTINT: Record<string, string> = { A: "(", B: ")", C: "[", D: "]", E: "{", G: "}" };
const EDGE_BALLS: Ball[] = [
  { x: 0, y: 0, r: 5.2, k: "E", z: 0.8 },
  { x: 10, y: -1, r: 5, k: "C", z: 0.55 },
  { x: 20.5, y: 0.5, r: 5.3, k: "A", z: 0.9 },
  { x: 29.5, y: -0.5, r: 4.9, k: "D", z: 0.5 },
  { x: 0.5, y: 10.5, r: 5.1, k: "B", z: 0.7 },
  { x: -1, y: 20, r: 5.2, k: "G", z: 0.6 },
  { x: 0, y: 29, r: 5, k: "C", z: 0.85 },
];
const wrapped = (bs: Ball[]) => bs.flatMap((b) => [-1, 0, 1].flatMap((i) => [-1, 0, 1].map((j) => ({ ...b, x: b.x + i * T, y: b.y + j * T }))));
function pitBalls(seed: number): Ball[] {
  const balls = wrapped(EDGE_BALLS);
  const add = (minD: number, zLo: number, zHi: number, tries: number, s: number) => {
    for (let n = 0; n < tries; n++) {
      const x = 5.5 + grain(n, 1, s) * 26;
      const y = 5.5 + grain(n, 2, s) * 26;
      const r = 4.9 + grain(n, 3, s) * 0.6;
      let near: Ball | null = null;
      let nd = Infinity;
      let ok = true;
      for (const b of balls) {
        const d = Math.hypot(b.x - x, b.y - y);
        if (d < minD && (zLo > 0.4 || b.z < 0.4 || d < minD * 0.6)) ok = false;
        if (d < nd) [nd, near] = [d, b];
      }
      if (!ok) continue;
      let k = MIDS[Math.floor(grain(n, 4, s) * 6)]!;
      if (near && near.k === k) k = MIDS[(MIDS.indexOf(k) + 1 + Math.floor(grain(n, 5, s) * 5)) % 6]!;
      balls.push({ x, y, r, k, z: zLo + grain(n, 6, s) * (zHi - zLo) });
    }
  };
  add(8.4, 0.45, 1, 600, seed);
  add(5.5, 0.05, 0.35, 500, seed + 100);
  return balls;
}
const BALLS = new Map<number, Ball[]>();
const ballsOf = (seed: number) => {
  let b = BALLS.get(seed);
  if (!b) BALLS.set(seed, (b = pitBalls(seed)));
  return b;
};
/** The pit at pixel (x, y) of a tile of seed `seed`. */
function pitPx(seed: number, x: number, y: number): string {
  const px = x + 0.5;
  const py = y + 0.5;
  let best: Ball | null = null;
  let near = Infinity;
  for (const b of ballsOf(seed)) {
    const d = Math.hypot(px - b.x, py - b.y);
    if (d <= b.r && (!best || b.z > best.z)) best = b;
    near = Math.min(near, d - b.r);
  }
  if (!best) return near < 1.3 ? "H" : "h";
  const dx = px - best.x;
  const dy = py - best.y;
  const d = Math.hypot(dx, dy);
  const sh = best.k.toLowerCase();
  if (best.z < 0.4) return dx + dy > best.r * 0.35 || d > best.r - 0.8 ? "H" : sh;
  if (Math.hypot(dx + best.r * 0.42, dy + best.r * 0.42) < 1.3) return BTINT[best.k]!;
  if (d > best.r - 0.85 || dx + dy > best.r * 0.62) return sh;
  return best.k;
}
/** The same pit in shadow, a step darker. */
const DIM: Record<string, string> = { A: "a", B: "b", C: "c", D: "d", E: "e", G: "g", a: "H", b: "H", c: "H", d: "H", e: "H", g: "H", "(": "A", ")": "B", "[": "C", "]": "D", "{": "E", "}": "G", H: "h" };
const dim = (k: string) => DIM[k] ?? k;

const PIT_SEEDS = [11, 12, 13];
export const SHOP_BIGBOY_PIT_A = tileDef("pit-a", (x, y) => pitPx(11, x, y));
export const SHOP_BIGBOY_PIT_B = tileDef("pit-b", (x, y) => pitPx(12, x, y));
export const SHOP_BIGBOY_PIT_C = tileDef("pit-c", (x, y) => pitPx(13, x, y));
const pitVar = (col: number, row: number) => Math.floor(grain(col, row, 77) * 3);

/**
 * The raised floors' south faces, seen just over the balls where the pit lies south of them (the camera looks north):
 * `w` and `c` the giant toy blocks the walkway and the circle stand on (a row of rainbow blocks), `p` the platform's
 * quilted mattress side. `col` turns the blocks' colors along.
 */
const FACE = 6;
const faceAt = (x: number, j: number, kind: string, col: number): string => {
  if (kind === "p") return j === 0 ? "T" : j === FACE - 1 ? "P" : x % 4 === 0 ? "p" : "q";
  const i = x < 12 ? 0 : x < 24 ? 1 : 2;
  const bx = x - i * 12;
  const bw = i === 2 ? 13 : 12;
  const c = (col * 3 + i + (kind === "c" ? 1 : 0)) % 6;
  if (bx === 0) return "k";
  if (j === 0) return TNT[c]!;
  if (j === FACE - 1) return SHD[c]!;
  return bx >= bw - 2 ? SHD[c]! : SAT[c]!;
};
/** A pit tile at the edge of a raised floor: its face along the north (`face` the kind), shade on its west, a corner of shade. */
function pitEdge(v: number, face: string, col: number, west: boolean, corner: boolean): string {
  const name = `pit-${"abc"[v]}-${face || "x"}${face && face !== "p" ? col % 2 : ""}${west ? "w" : ""}${corner ? "c" : ""}`;
  if (!PIECES[name])
    tileDef(name, (x, y) => {
      if (face && y < FACE) return faceAt(x, y, face, col);
      const k = pitPx(PIT_SEEDS[v]!, x, y);
      const th = bayer(x, y) < 0.5 ? 1 : 0;
      const shade = (face && y < FACE + 3 + th) || (west && x < 3 + th) || (corner && x + y < 5 + th);
      return shade ? dim(k) : k;
    });
  return name;
}

// ---- The walkway: big squares of foam play mat, teal and yellow by turns (puzzle teeth on their edges, a soft lit
// bevel), raised over the pit with soft white bumpers along every side that meets the balls.

interface Sides {
  n?: boolean;
  e?: boolean;
  s?: boolean;
  w?: boolean;
  ne?: boolean;
  se?: boolean;
  sw?: boolean;
  nw?: boolean;
}
const sideKey = (s: Sides) => {
  const a = (["n", "e", "s", "w"] as const).filter((k) => s[k]).join("");
  const b = (["ne", "se", "sw", "nw"] as const).filter((k) => s[k]).join("");
  return a + (b ? "-" + b : "");
};
const foamPx = (x: number, y: number, c: string): string => {
  const [base, seam, speck, other] = c === "t" ? ["u", "t", "U", "y"] : ["y", "9", "[", "u"];
  const tooth = (a: number, d: number): string | null => {
    const k = a >= 7 && a <= 11 ? 9 : a >= 25 && a <= 29 ? 27 : -1;
    if (k < 0 || d > 3) return null;
    return d === 3 || Math.abs(a - k) === 2 ? seam : other;
  };
  for (const [d, a] of [[y, x], [T - 1 - y, x], [x, y], [T - 1 - x, y]] as const) {
    const r = tooth(a, d);
    if (r) return r;
  }
  const e = Math.min(x, y, T - 1 - x, T - 1 - y);
  if (e === 0) return seam;
  if (e === 1) return speck;
  return grain(x, y, c === "t" ? 3 : 4) > 0.986 ? speck : base;
};
/** A soft bumper `depth` in from its outer edge (0 to 5), `along` it: padded white, creased every 18 px. */
const BUMP = ["V", "W", "F", "F", "W", "V"];
const bumpPx = (depth: number, along: number): string => {
  const k = BUMP[depth]!;
  if (along >= 0 && along % 18 === 0 && depth > 0 && depth < 5) return k === "F" ? "W" : "V";
  return k;
};
/** Where a tile's bumpers (or pipings) are: the depth and along of the nearest, or null. */
const bumperAt = (x: number, y: number, s: Sides, bw: number): [number, number] | null => {
  const ds: [number, number][] = [];
  if (s.n && y < bw) ds.push([y, x]);
  if (s.s && T - 1 - y < bw) ds.push([T - 1 - y, x]);
  if (s.w && x < bw) ds.push([x, y]);
  if (s.e && T - 1 - x < bw) ds.push([T - 1 - x, y]);
  if (s.nw && x < bw && y < bw) ds.push([Math.max(x, y), -1]);
  if (s.ne && T - 1 - x < bw && y < bw) ds.push([Math.max(T - 1 - x, y), -1]);
  if (s.sw && x < bw && T - 1 - y < bw) ds.push([Math.max(x, T - 1 - y), -1]);
  if (s.se && T - 1 - x < bw && T - 1 - y < bw) ds.push([Math.max(T - 1 - x, T - 1 - y), -1]);
  if (!ds.length) return null;
  return ds.reduce((m, d) => (d[0] < m[0] ? d : m));
};
const walkPx = (x: number, y: number, c: string, s: Sides): string => {
  const b = bumperAt(x, y, s, 6);
  if (b) return bumpPx(b[0], b[1]);
  if ((s.n && y === 6) || (s.w && x === 6)) return c === "t" ? "t" : "9"; // the bumper's shadow on the mat
  return foamPx(x, y, c);
};
function walkTile(c: string, s: Sides): string {
  const name = `walk-${c}${sideKey(s) ? "-" + sideKey(s) : ""}`;
  if (!PIECES[name]) tileDef(name, (x, y) => walkPx(x, y, c, s));
  return name;
}

/** The door's mat: a rainbow rug with a white fringe laid over the foam, two squares wide (the east one is this mirrored). */
export const SHOP_BIGBOY_FLOOR_DOOR = tileDef("floor-door", (x, y) => {
  if (x >= 9 && y >= 5 && y <= 31) {
    if (y === 5 || y === 31) return x % 2 ? "F" : null; // the fringe
    if (x === 9) return "W";
    if (y === 6 || y === 30) return "F";
    return TNT[Math.min(5, Math.floor((y - 7) / 4))]!;
  }
  return walkPx(x, y, "t", { w: true });
});

// ---- The shop's platform: a quilted crib mattress in his diaper's light blue (diamond stitching, teal buttons), a teal
// piping roll along every side that meets the balls.

const quiltPx = (x: number, y: number): string => {
  if ((x === 18 && (y === 0 || y === T - 1)) || (y === 18 && (x === 0 || x === T - 1))) return "u"; // buttons
  const X = x - 18;
  const Y = y - 18;
  const s = Math.abs(X) + Math.abs(Y) - 18;
  if (Math.abs(s) < 0.5) return (x + y) % 3 === 0 ? "q" : "p"; // the stitching
  // Each diamond puffs up: shade near its seam on its lower right, light on its upper left.
  const [cx, cy] = s < 0 ? [0, 0] : [Math.sign(X) * 18.5, Math.sign(Y) * 18.5];
  const rx = X - cx;
  const ry = Y - cy;
  if (Math.abs(s) < 3 && rx + ry > 0) return "q";
  if (Math.abs(s) < 2 && rx + ry < -4) return "F";
  return "Q";
};
const PIPE = ["T", "t", "u", "U", "u"];
function platTile(s: Sides): string {
  const name = `plat${sideKey(s) ? "-" + sideKey(s) : ""}`;
  if (!PIECES[name])
    tileDef(name, (x, y) => {
      const b = bumperAt(x, y, s, 5);
      if (b) return PIPE[b[0]]!;
      if ((s.n && y === 5) || (s.w && x === 5)) return "q";
      return quiltPx(x, y);
    });
  return name;
}

// ==== The battle circle: an octagon of rainbow play mat (columns 6-13, rows 7-14) raised on toy blocks over the pit.

/** Its middle, in floor pixels (a pixel corner), and the distance in from its edge. */
const CCX = 10 * T;
const CCY = 11 * T;
const octD = (X: number, Y: number) => Math.min(148 - Math.abs(X), 148 - Math.abs(Y), (222 - Math.abs(X) - Math.abs(Y)) / Math.SQRT2);
/** (X, Y) turned by quarter turns into the quarter where both are positive (exact, so the tiles come out the same turned). */
const canon = (X: number, Y: number): [number, number] => {
  let [a, b] = [X, Y];
  while (!(a > 0 && b > 0)) [a, b] = [-b, a];
  return [a, b];
};
/** A 5-pointed star of radius `r`, point up: 2 its rim, 1 inside, 0 outside. */
const starAt = (X: number, Y: number, r: number): number => {
  const a = Math.atan2(Y, X) + Math.PI / 2;
  const t = Math.abs(((((a * 5) / (2 * Math.PI)) % 1) + 1) % 1 - 0.5) * 2;
  const lim = r * (0.45 + 0.55 * t);
  const d = Math.hypot(X, Y);
  return d > lim ? 0 : d > lim - 1.1 ? 2 : 1;
};
/**
 * The mat at (X, Y) from its middle; null outside. Rainbow wedges (24, soft tints) like a play parachute, a white ring, a
 * padded bumper round the edge in the wedges' full colors (open where the walkways join, at the middle of each side);
 * the lollipop-swirl emblem, the white middle line and the two star start marks over it.
 */
function circleMat(X: number, Y: number): string | null {
  const d = octD(X, Y);
  if (d < 0) return null;
  const [cx, cy] = canon(X, Y);
  const wf = Math.atan2(cy, cx) / (Math.PI / 12);
  const w = Math.min(5, Math.floor(wf));
  const gap = (cx < 37 && cy > 74) || (cy < 37 && cx > 74);
  if (!gap && d < 7) {
    if (d >= 6) return SHD[w]!;
    const fr = wf - w;
    if ((fr < 0.05 || fr > 0.95) && d >= 1 && d < 5) return SHD[w]!;
    return [SHD, SAT, TNT, SAT, SAT, SHD][Math.floor(d)]![w]!;
  }
  const r = Math.hypot(X, Y);
  // The emblem: Big Boy's lollipop, a rainbow swirl in a white ring.
  if (r < 36) {
    if (r > 34.6) return "k";
    if (r > 31) return r > 33.6 || X + Y > 30 ? "W" : "F";
    if (r < 2.5) return "F";
    const ang = Math.atan2(Y, X);
    const band = ((Math.floor((ang / (2 * Math.PI)) * 6 + r / 5.5) % 6) + 6) % 6;
    if (r > 20 && r < 25 && Math.abs(ang + 2.36) < 0.42) return "F"; // its shine
    return X + Y > 18 ? SHD[band]! : SAT[band]!;
  }
  // The start marks: a white pad with a yellow star, inside the north and south edges.
  for (const my of [-92.5, 92.5]) {
    const Yr = Y - my;
    const dm = Math.hypot(Math.max(0, Math.abs(X) - 17), Yr) - 10.5;
    if (dm <= 0) {
      if (dm > -1.3) return "T";
      const st = starAt(X, Yr + 0.5, 8.5);
      if (st) return st === 2 ? "8" : X + Yr < -2 ? "[" : "3";
      return dm > -2.5 || Yr > 7 ? "W" : "F";
    }
  }
  if (Math.abs(Y) < 2) return Math.abs(Y) < 1 ? "F" : "W"; // the middle line
  if (Math.abs(r - 104) < 1.25) return "F"; // the ring
  return TNT[w]!;
}

// The circle's squares: each square's picture, the same tile reused (turned) wherever the mat repeats.
const rotCW = (g: readonly string[]) => g.map((_, y) => g.map((_, x) => g[T - 1 - x]![y]!).join(""));
const CIRCLE_AT: Record<string, { name: string; rot: 0 | 1 | 2 | 3; full: boolean }> = {};
{
  const found: { name: string; turns: string[][] }[] = [];
  for (let row = 7; row <= 14; row++)
    for (let col = 6; col <= 13; col++) {
      let any = false;
      let full = true;
      const v = pitVar(col, row);
      const grid = Array.from({ length: T }, (_, y) =>
        Array.from({ length: T }, (_, x) => {
          const X = col * T + x + 0.5 - CCX;
          const Y = row * T + y + 0.5 - CCY;
          const m = circleMat(X, Y);
          if (m) {
            any = true;
            return m;
          }
          full = false;
          const k = pitPx(PIT_SEEDS[v]!, x, y);
          return octD(X - 5, Y - 5) >= 0 ? dim(k) : k; // the mat's shade on the balls
        }).join(""),
      );
      if (!any) continue;
      const key = grid.join("\n");
      let hit: { name: string; rot: 0 | 1 | 2 | 3 } | null = null;
      for (const f of found) {
        const r = f.turns.findIndex((t) => t.join("\n") === key);
        if (r >= 0) {
          hit = { name: f.name, rot: r as 0 | 1 | 2 | 3 };
          break;
        }
      }
      if (!hit) {
        const name = `circle-${found.length + 1}`;
        def(name, [1, 1], T, T, [18, 18], [[{ part: { grid, outline: false }, at: [0, 0] }]]);
        const turns = [grid];
        for (let q = 1; q < 4; q++) turns.push(rotCW(turns[q - 1]!));
        found.push({ name, turns });
        hit = { name, rot: 0 };
      }
      CIRCLE_AT[`${col},${row}`] = { ...hit, full };
    }
}

// ==== The back wall: a frieze of alphabet blocks along its top, nursery paper, big bright windows, a teal wainscot.

const WALL_H = 130;
const PILLAR_UP = 20; // how far the block stacks stand above the wall
/** The frieze: a row of toy blocks (three a square: 12, 12, 13 wide), letters on them, the colors running round the rainbow. */
const frieze = (x: number, y: number, letters: string, off: number): string => {
  const sq = Math.floor(x / T);
  const lx = x % T;
  const i = lx < 12 ? 0 : lx < 24 ? 1 : 2;
  const bx = lx - i * 12;
  const bw = i === 2 ? 13 : 12;
  const n = sq * 3 + i;
  const c = (off + n) % 6;
  if (bx === 0) return "k";
  if (y === 1) return TNT[c]!;
  if (y === 12) return SHD[c]!;
  if (bx >= bw - 2) return SHD[c]!;
  if (glyphAt(letters[n % letters.length]!, bx - Math.floor((bw - 4) / 2), y - 4)) return "F";
  return SAT[c]!;
};
/** The paper: his diaper's palest blue in white stripes. */
const paper = (x: number): string => {
  const lx = x % T;
  return [4, 13, 22, 31].some((s) => lx >= s && lx < s + 3) ? "F" : "Q";
};
/** Under it all: a white chair rail, a wainscot of teal boards, a white skirting. */
const lower = (x: number, y: number): string => {
  if (y === 104) return "F";
  if (y === 105) return "W";
  if (y === 106) return "V";
  if (y >= WALL_H - 5) return y === WALL_H - 5 ? "F" : y === WALL_H - 1 ? "V" : "W";
  if (y === 107) return "t";
  return x % 9 === 0 ? "u" : "U";
};
/** A wall's band at the top: an outline, the frieze, a white trim. Returns null under it. */
const topBand = (x: number, y: number, letters: string, off: number): string | null => {
  if (y === 0 || y === 13) return "k";
  if (y < 13) return frieze(x, y, letters, off);
  if (y < 17) return y === 16 ? "W" : "F";
  return null;
};

/** A puffy cloud round (cx, cy), `s` its size: lit white on top, shaded under. */
const cloudAt = (x: number, y: number, cx: number, cy: number, s: number): string | null => {
  const X = x + 0.5 - cx;
  const Y = y + 0.5 - cy;
  if (Y > 4 * s) return null;
  const puffs: [number, number, number][] = [[-7, 0, 4.5], [0, -3, 6.5], [7, 0, 4.5], [-2, 1, 5]];
  if (!puffs.some(([px, py, pr]) => Math.hypot(X - px * s, Y - py * s) < pr * s)) return null;
  return Y > 1.5 * s ? "W" : "F";
};

/**
 * The big window, four squares wide: a white frame and a cross of mullions; through it a clean bright sky, a rainbow
 * arching over green hills, soft clouds. (The east wall's is this mirrored.)
 */
const WW = 4 * T;
const FX0 = 7;
const FX1 = WW - 8;
const FY0 = 20;
const FY1 = 98;
const skyAt = (x: number, y: number): string => {
  for (const [cx, cy, s] of [[24, 87, 1.25], [124, 87, 1.25], [42, 36, 0.85], [106, 42, 0.75]] as const) {
    const k = cloudAt(x, y, cx, cy, s);
    if (k) return k;
  }
  const hy = 86 + 3 * Math.sin(x * 0.07) + 2 * Math.sin(x * 0.19 + 1);
  if (y > hy) return y < hy + 1.5 ? "]" : x % 11 === 0 && y > hy + 4 ? "]" : "4";
  const rr = Math.hypot(x + 0.5 - WW / 2, y + 0.5 - 116);
  if (rr > 44 && rr < 68) return TNT[Math.floor((68 - rr) / 4)]!;
  const t = (y - FY0) / (FY1 - FY0);
  const th = bayer(x, y);
  if (t < 0.4) return t / 0.4 < th * 0.8 ? "s" : "S";
  return (t - 0.4) / 0.6 < th ? "S" : "x";
};
const windowPx = (x: number, y: number, letters = "ABCDEFGHIJKL"): string => {
  const band = topBand(x, y, letters, 0);
  if (band) return band;
  if (y >= 104) return lower(x, y);
  // The sill under the window, wider than it.
  if (y > FY1 && y <= FY1 + 3 && x >= FX0 - 3 && x <= FX1 + 3) return y === FY1 + 1 ? "F" : y === FY1 + 2 ? "W" : "V";
  if (x < FX0 || x > FX1 || y < FY0 || y > FY1) return y === 17 ? "q" : paper(x);
  const e = Math.min(x - FX0, FX1 - x, y - FY0, FY1 - y);
  if (e < 4) {
    if (e === 0) return "V";
    if (e === 3) return "V";
    return x - FX0 === e || y - FY0 === e ? "F" : "W";
  }
  const mx = x - Math.floor(WW / 2);
  if (mx >= -2 && mx <= 1) return mx === -2 ? "F" : mx === 1 ? "V" : "W";
  const my = y - 58;
  if (my >= -1 && my <= 1) return my === -1 ? "F" : my === 1 ? "V" : "W";
  return skyAt(x, y);
};
export const SHOP_BIGBOY_WALL_WINDOW = def("wall-window", [4, 1], WW, WALL_H, [WW / 2, WALL_H - 1], [[paint(0, 0, WW, WALL_H, (x, y) => windowPx(x, y), false)]]);
/** The east one: the same view mirrored, its frieze going on with the alphabet (not mirrored: letters read). */
export const SHOP_BIGBOY_WALL_WINDOW_B = def("wall-window-b", [4, 1], WW, WALL_H, [WW / 2, WALL_H - 1], [
  [paint(0, 0, WW, WALL_H, (x, y) => (y < 17 ? windowPx(x, y, "ABCDEFGHIJKL") : windowPx(WW - 1 - x, y)), false)],
]);

/** A plain square of the wall between the windows: paper, the frieze spelling BIG or BOY, a decal (a star, a moon). */
function plainWall(c: Cv, y0: number, letters: string, off: number, decal: number) {
  fill(c, (x, yy) => {
    const y = yy - y0;
    if (y < 0) return null;
    const band = topBand(x, y, letters, off);
    if (band) return band;
    if (y >= 104) return lower(x, y);
    if (y === 17) return "q";
    // The decal: a big star with little ones (0), or a moon with a star (1).
    const X = x + 0.5 - 18.5;
    const Y = y + 0.5 - 56;
    if (decal === 0) {
      const st = starAt(X, Y, 11);
      if (st) return st === 2 ? "9" : X + Y < -3 ? "[" : "3";
      for (const [sx, sy] of [[-11, -22], [10, 20], [11, -17]] as const) if (starAt(X - sx, Y - sy, 3.5)) return "3";
    } else {
      const d = Math.hypot(X, Y);
      if (d < 11 && Math.hypot(X - 5, Y - 4) > 9) return d > 9.9 ? "9" : X < -4 ? "[" : "3";
      for (const [sx, sy] of [[8, -12], [-9, 19], [10, 17]] as const) if (starAt(X - sx, Y - sy, 3.5)) return "3";
    }
    return paper(x);
  });
}
export const SHOP_BIGBOY_WALL = (() => {
  const c = cv(T, WALL_H);
  plainWall(c, 0, "BIG", 0, 0);
  return def("wall", [1, 1], T, WALL_H, [18, WALL_H - 1], [[whole(c)]]);
})();
export const SHOP_BIGBOY_WALL_B = (() => {
  const c = cv(T, WALL_H);
  plainWall(c, 0, "BOY", 3, 1);
  return def("wall-b", [1, 1], T, WALL_H, [18, WALL_H - 1], [[whole(c)]]);
})();

/**
 * A tall stack of toy blocks (front, top and side faces, a big letter on each) standing from `foot` up, a little
 * crooked, a star on the top. Reads top to bottom: `letters`.
 */
function blockStack(w: number, foot: number, letters: string, off: number): Bit[] {
  const S = 22;
  const c = cv(w, foot + 1);
  const n = letters.length;
  const jit = [0, 1, -1, 1, 0, -1, 1, 0];
  for (let b = 0; b < n; b++) {
    const y1 = foot - b * S; // the block's bottom
    const x0 = Math.floor((w - S - 3) / 2) + jit[b]!;
    const col = (off + b) % 6;
    const l = letters[n - 1 - b]!;
    for (let j = 0; j < S + 3; j++)
      for (let i = 0; i < S + 3; i++) {
        const y = y1 - (S + 2) + j;
        const x = x0 + i;
        let k: string | null = null;
        if (j < 3) k = i >= 3 - j && i < S + 3 - j ? (j === 0 ? "F" : TNT[col]!) : null; // the top
        else if (i >= S) k = i - S < 3 && j - 3 < S - (i - S) ? SHD[col]! : null; // the side
        else {
          const fi = i;
          const fj = j - 3;
          if (fi === 0 || fj === 0 || fi === S - 1 || fj === S - 1) k = "k";
          else if (glyphAt(l, Math.floor((fi - 5) / 2) + (fi >= 5 ? 0 : -9), Math.floor((fj - 6) / 2) + (fj >= 6 ? 0 : -9))) k = "F";
          else k = fi < 3 || fj < 3 ? TNT[col]! : SAT[col]!;
        }
        if (k) put(c, x, y, k);
      }
  }
  // A star on the top block.
  const topY = foot - n * S - 2;
  for (let j = -12; j <= 1; j++)
    for (let i = -8; i <= 8; i++) {
      const st = starAt(i, j + 5.5, 7.5);
      if (st) put(c, Math.floor(w / 2) + i, topY + j, st === 2 ? "9" : i + j < -5 ? "[" : "3");
    }
  return [cropBit(c, true)!];
}
export const SHOP_BIGBOY_WALL_PILLAR = (() => {
  const h = WALL_H + PILLAR_UP;
  const c = cv(T, h);
  plainWall(c, PILLAR_UP, "BIG", 0, 0);
  return def("wall-pillar", [1, 1], T, h, [18, h - 1], [[whole(c), ...blockStack(T, h - 1, "BIGBOY", 0)]]);
})();

/**
 * The west wall, running away north, seen obliquely: each square shows its top (a square of the wall above the next one
 * south), so the picture repeats every 37 px down: along its inner edge the wall's top, a column of toy blocks two a
 * square, and the paper of its face with a star or a cloud on it; the last square shows the wainscot too. `kind` turns
 * the blocks' colors and the decal, so a column of them runs round the rainbow.
 */
function sideCv(c: Cv, y0: number, kind: number) {
  fill(c, (x, yy) => {
    const y = yy - y0;
    if (y < 0) return null;
    if (y >= 104) return x === 25 ? "W" : lower(x, y);
    const py = y % T;
    if (x >= 26) {
      const b = py < 18 ? 0 : 1;
      const by = py - b * 18;
      const col = [[0, 2], [4, 1]][kind]![b]!;
      if (by === 0 || x === 26) return "k";
      if (by === 1 || x === 27) return TNT[col]!;
      if (x >= 34 || by === (b ? 18 : 17)) return SHD[col]!;
      return SAT[col]!;
    }
    if (x === 25) return "W";
    if (x === 24) return "q";
    const X = x + 0.5 - 13;
    const Y = py + 0.5 - 18;
    if (kind === 0) {
      const st = starAt(X, Y, 6.5);
      if (st) return st === 2 ? "9" : "3";
    } else {
      const k = cloudAt(x, py, 13, 19, 0.7);
      if (k) return k === "F" ? "F" : "q";
    }
    return x < 3 ? "q" : x % 9 === 4 || x % 9 === 5 ? "F" : "Q";
  });
}
export const SHOP_BIGBOY_WALL_SIDE = (() => {
  const c = cv(T, WALL_H);
  sideCv(c, 0, 0);
  return def("wall-side", [1, 1], T, WALL_H, [18, WALL_H - 1], [[whole(c)]]);
})();
export const SHOP_BIGBOY_WALL_SIDE_B = (() => {
  const c = cv(T, WALL_H);
  sideCv(c, 0, 1);
  return def("wall-side-b", [1, 1], T, WALL_H, [18, WALL_H - 1], [[whole(c)]]);
})();
export const SHOP_BIGBOY_WALL_SIDE_PILLAR = (() => {
  const h = WALL_H + PILLAR_UP;
  const c = cv(T, h);
  sideCv(c, PILLAR_UP, 0);
  return def("wall-side-pillar", [1, 1], T, h, [18, h - 1], [[whole(c), ...blockStack(T, h - 1, "YAHOO", 2)]]); // letters that read mirrored too
})();

// ==== The front (south): low, a crib's rail and bars (see-through), and the way out.

const HEM_H = 24;
/** The crib's front rail: a rounded top rail, bars (the floor shows between them), a bottom rail. */
function hemCv(c: Cv, y0: number) {
  fill(c, (x, yy) => {
    const y = yy - y0;
    if (y < 0) return null;
    if (y < 5) return ["K", "K", "J", "O", "N"][y]!;
    if (y >= HEM_H - 4) return ["K", "J", "O", "N"][y - (HEM_H - 4)]!;
    const b = [3, 12, 21, 30].find((s2) => x >= s2 && x < s2 + 4);
    if (b === undefined) return null;
    return x === b ? "K" : x === b + 3 ? "O" : "J";
  });
}
export const SHOP_BIGBOY_HEM = (() => {
  const c = cv(T, HEM_H);
  hemCv(c, 0);
  return def("hem", [1, 1], T, HEM_H, [18, HEM_H - 1], [[cropBit(c, true)!]]);
})();
export const SHOP_BIGBOY_HEM_PILLAR = (() => {
  const h = WALL_H + PILLAR_UP;
  const c = cv(T, h);
  hemCv(c, h - HEM_H);
  return def("hem-pillar", [1, 1], T, h, [18, h - 1], [[cropBit(c, true)!, ...blockStack(T, h - 1, "YAHOO", 4)]]);
})();

/**
 * The entrance, two squares wide: a giant rainbow stacking arch (his six colors, each a band lit along its outer edge)
 * standing in the front rail, and through it the bright day outside: sky, the town square's grass and a path, a wooden
 * step. Plainly the way out.
 */
const EW = 2 * T;
const EH = 112;
const EFOOT = EH - 1;
const ACY = 50; // the arch's middle
const AR0 = 17.5; // its inner and outer radius
const AR1 = 36;
export const SHOP_BIGBOY_ENTRANCE = (() => {
  const band = (r: number) => Math.floor((AR1 - r) / ((AR1 - AR0) / 6));
  const arch = paint(0, 0, EW, EH, (x, y) => {
    const X = x + 0.5 - EW / 2;
    const Y = y + 0.5 - ACY;
    const r = Y < 0 ? Math.hypot(X, Y) : Math.abs(X);
    if (r > AR1 || r < AR0) return null;
    if (y >= EFOOT - 1) return "k";
    const b = Math.min(5, band(r));
    const inB = (AR1 - r) - b * ((AR1 - AR0) / 6);
    if (inB < 0.8) return b === 0 ? SAT[0]! : "k"; // the line between two bands
    if (inB < 1.7) return TNT[b]!; // each band lit along its outer edge
    return (Y < 0 ? X + Y > 6 : X > 0) ? SHD[b]! : SAT[b]!;
  });
  const DY = Math.floor(ACY - AR0);
  const day = paint(0, DY, EW, EFOOT - DY, (x, y) => {
    const X = x + 0.5 - EW / 2;
    const Y = y + 0.5 - ACY;
    const r = Y < 0 ? Math.hypot(X, Y) : Math.abs(X);
    if (r >= AR0 + 0.5) return null;
    if (y >= EFOOT - 6) return y === EFOOT - 6 ? "K" : y > EFOOT - 3 ? "O" : "J"; // the step
    const ground = 78 + Math.round(1.5 * Math.sin(x * 0.3));
    if (y >= ground) {
      const pw = 3 + (y - ground) * 0.45; // the path, widening toward us
      if (Math.abs(X) < pw) return y % 4 === 0 ? "J" : "K";
      return y === ground ? "]" : (x * 3 + y * 5) % 13 === 0 ? "]" : "4";
    }
    const cl = cloudAt(x, y, 30, 46, 0.6);
    if (cl) return cl;
    const t = (y - (ACY - AR0)) / (ground - (ACY - AR0));
    return t < bayer(x, y) * 0.9 ? "S" : "x";
  }, false);
  return def("entrance", [2, 1], EW, EH, [EW / 2, EFOOT], [[groundShadow(EW / 2, EFOOT - 1, 36, 3), day, arch]]);
})();

// ==== The backdrop behind the counter: four squares of the wall, a big white toy shelf full of his toys.

const BDW = 4 * T;
const BDH = WALL_H + PILLAR_UP;
/** A ball seen from the front, lit top left: `k` its rainbow index. */
const toyBall = (c: Cv, cx: number, cy: number, r: number, k: number, stripe = false) => {
  for (let y = Math.floor(cy - r); y <= cy + r; y++)
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const X = x + 0.5 - cx;
      const Y = y + 0.5 - cy;
      const d = Math.hypot(X, Y);
      if (d > r) continue;
      if (d > r - 0.9) put(c, x, y, "k");
      else if (Math.hypot(X + r * 0.4, Y + r * 0.4) < r * 0.25) put(c, x, y, "F");
      else {
        const kk = stripe ? Math.floor(((Math.atan2(Y, X) + Math.PI) / (2 * Math.PI)) * 6) % 3 : 0;
        const ci = stripe ? [0, 2, 4][kk]! : k;
        put(c, x, y, stripe && kk === 1 ? (X + Y > r * 0.4 ? "W" : "F") : X + Y > r * 0.4 ? SHD[ci]! : SAT[ci]!);
      }
    }
};
/** A small toy block, front face s x s, its top and side showing; a letter on its face. */
const toyBlock = (c: Cv, x0: number, y0: number, s: number, k: number, l = "") => {
  for (let j = 0; j < s + 3; j++)
    for (let i = 0; i < s + 3; i++) {
      let key: string | null = null;
      if (j < 3) key = i >= 3 - j && i < s + 3 - j ? (j === 0 ? "k" : TNT[k]!) : null;
      else if (i >= s) key = i - s < 3 && j - 3 < s - (i - s) ? (i === s + 2 || j - 3 === s - (i - s) - 1 ? "k" : SHD[k]!) : null;
      else if (i === 0 || j === 3 || i === s - 1 || j === s + 2) key = "k";
      else key = l && glyphAt(l, i - Math.floor((s - 3) / 2), j - 3 - Math.floor((s - 5) / 2)) ? "F" : SAT[k]!;
      if (key) put(c, x0 + i, y0 - 3 + j, key);
    }
};
export const SHOP_BIGBOY_BACKDROP = (() => {
  const back = paint(0, PILLAR_UP, BDW, WALL_H, (x, yy) => {
    const y = yy - PILLAR_UP;
    const band = topBand(x, y, "BIGBOYBIGBOY", 2);
    if (band) return band;
    if (y >= 104) return lower(x, y);
    return y === 17 ? "q" : paper(x);
  }, false);
  // The shelf: a white frame, a pale blue back, three shelves, a scalloped cloud top.
  const S0 = 8;
  const S1 = BDW - 9;
  const STOP = 34;
  const SHELF = [72, 104, 136];
  const shelf = paint(S0 - 2, STOP - 8, S1 - S0 + 5, BDH - STOP + 8, (x, y) => {
    if (y < STOP) {
      // Clouds along its top.
      const lx = (x - S0) % 18;
      const r = Math.hypot(lx - 9, y - STOP);
      return r < 9.5 ? (y < STOP - 4 ? "F" : "W") : null;
    }
    if (x < S0 || x > S1) return null;
    if (x < S0 + 5 || x > S1 - 5) return x === S0 || x === S1 - 4 ? "F" : x === S1 || x === S0 + 4 ? "V" : "W"; // its sides
    if (y < STOP + 4) return y === STOP ? "F" : y === STOP + 3 ? "V" : "W";
    for (const s of SHELF) if (y >= s && y < s + 4) return y === s ? "F" : y === s + 3 ? "V" : "W";
    const under = SHELF.some((s) => y > s + 3 && y < s + 7) || (y > STOP + 3 && y < STOP + 7);
    return under ? "p" : "q";
  });
  const t = cv(BDW, BDH);
  const s0 = SHELF[0]!;
  // Top shelf: a stacking-ring tower, a ball, a drum, three little blocks, a rocket.
  const rings = [5, 4, 3, 2, 1, 0];
  rings.forEach((k, i) => {
    const hw = 9 - i * 1.2;
    for (let j = 0; j < 4; j++) for (let x = Math.ceil(19 - hw); x <= 19 + hw; x++) put(t, x, s0 - 3 - i * 4 - j + 2, j === 0 || x === Math.ceil(19 - hw) || x >= 19 + hw - 0.5 ? "k" : j === 3 ? TNT[k]! : x > 19 + hw * 0.4 ? SHD[k]! : SAT[k]!);
  });
  stamp(t, 17, s0 - 29, [".kk.", "k3[k", "k99k", ".kk."]);
  toyBall(t, 40, s0 - 8, 7.5, 4, true);
  stamp(t, 51, s0 - 15, ["kkkkkkkkkkkkk", "kFFFFFFFFFFFk", "kWWWWWWWWWWWk", "k1F1F1F1F1F1k", "k1F1F1F1F1F7k", "k1F1F1F1F1F7k", "k7F7F7F7F7F7k", "kWWWWWWWWWWWk", "kkkkkkkkkkkkk"].map((r) => r));
  stamp(t, 54, s0 - 19, ["k.......k", ".k.....k.", "..k...k.."]);
  toyBlock(t, 68, s0 - 9, 9, 0, "A");
  toyBlock(t, 80, s0 - 9, 9, 4, "B");
  toyBlock(t, 74, s0 - 21, 9, 2, "C");
  stamp(t, 98, s0 - 26, [
    "....kk....",
    "...k11k...",
    "..k1(17k..",
    "..kFFFWk..",
    "..kF55Wk..",
    "..kF55Wk..",
    "..kFFFWk..",
    "..kFFFWk..",
    ".k1kFWk1k.",
    "k11kFWk17k",
    "k1kk22kk7k",
    "kk.k32k.kk",
    "....kk....",
  ]);
  toyBall(t, 120, s0 - 6, 5.5, 0);
  toyBall(t, 131, s0 - 5, 4.5, 2);
  // Middle shelf: picture books leaning, a xylophone, a rubber duck, a ball.
  const s1 = SHELF[1]!;
  [0, 4, 2, 5, 1, 3].forEach((k, i) => {
    for (let j = 0; j < 22 - (i % 2) * 3; j++) for (let x = 0; x < 4; x++) put(t, 14 + i * 4 + x, s1 - 1 - j, x === 0 || x === 3 || j === 0 || j === 21 - (i % 2) * 3 ? "k" : j % 7 === 3 ? "F" : x === 1 ? TNT[k]! : SAT[k]!);
  });
  for (let i = 0; i < 6; i++) for (let j = 0; j < 14 - i * 1.5; j++) for (let x = 0; x < 5; x++) put(t, 44 + i * 6 + x, s1 - 5 - j + Math.floor(i * 0.75), x === 0 || x === 4 || j === 0 ? "k" : j === 1 ? TNT[i]! : x === 3 ? SHD[i]! : SAT[i]!);
  stamp(t, 42, s1 - 5, ["kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk", "kNOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOk", "kk.................................kk", ".kk...............................kk."].map((r) => r));
  stamp(t, 86, s1 - 15, [
    ".....kkk......",
    "....k333k.....",
    "...k3k333kk...",
    "...k3333k22k..",
    "....k333kkk...",
    ".kkkk333kkk...",
    "k[33333333k...",
    "k[333333333k..",
    "k[3333333339k.",
    ".k339999999k..",
    "..kkkkkkkkk...",
  ]);
  toyBall(t, 111, s1 - 8, 7.5, 5);
  toyBall(t, 127, s1 - 6, 5.5, 3);
  // Bottom shelf: a dump truck, a stack of blocks, a toy piano.
  const s2 = SHELF[2]!;
  stamp(t, 14, s2 - 17, [
    "........kkkkkkkkkkkkkk",
    ".kkkkk..k333333333333k",
    "k5555kk.k[33333333339k",
    "k5{F5k5kk[33333333339k",
    "k5FF5k5kk3333333333399k",
    "k55555555k999999999999k",
    "k5555555555555555555555k",
    "k!!!!!!!!!!!!!!!!!!!!!!k",
    "kkkkkkkkkkkkkkkkkkkkkkkk",
    "..kkkk.........kkkk.....",
    ".kZZZZk.......kZZZZk....",
    ".kZFFZk.......kZFFZk....",
    ".kZZZZk.......kZZZZk....",
    "..kkkk.........kkkk.....",
  ]);
  toyBlock(t, 46, s2 - 12, 12, 3, "B");
  toyBlock(t, 62, s2 - 12, 12, 1, "I");
  toyBlock(t, 54, s2 - 27, 12, 5, "G");
  stamp(t, 84, s2 - 18, [
    "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
    "k1111111111111111111111111111111(k",
    "k1kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk1k",
    "k1kFkFkFkFkFkFkFkFkFkFkFkFkFkFkF7k",
    "k1kFkFkFkFkFkFkFkFkFkFkFkFkFkFkF7k",
    "k1kFkkkFkkkFkFkkkFkkkFkkkFkFkkkF7k",
    "k1kFkkkFkkkFkFkkkFkkkFkkkFkFkkkF7k",
    "k1kFFFFFFFFFFFFFFFFFFFFFFFFFFFFF7k",
    "k1kWWWWWWWWWWWWWWWWWWWWWWWWWWWWW7k",
    "k7777777777777777777777777777777k.",
    "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.",
    ".k7k........................k7k..",
    ".kkk........................kkk..",
  ]);
  return def("backdrop", [4, 1], BDW, BDH, [BDW / 2, BDH - 1], [[back, shelf, cropBit(t, true)!]]);
})();

// ==== The counter: big ABC blocks in a row under a white board, low (the kid shows over it), a blank plaque on its front.

const CW = 4 * T;
const CH = 44; // its picture (things on its top stand above it)
const CFOOT = CH - 3;
const CTOP = 12; // the board's top: the counter itself is 30 px tall
/** The plaque on its front (blank: the game writes on it). */
const PLQ = { x: 43, y: CTOP + 8, w: 62, h: 17 } as const;
export const SHOP_BIGBOY_COUNTER_SIGN = signFace(PLQ.x, PLQ.y, PLQ.w, PLQ.h);
/** Where the crate stands on the counter: its foot, in the counter's pixels (on the right, clear of the plaque). */
export const SHOP_BIGBOY_CRATE_AT: Pt = [124, CTOP + 3];
export const SHOP_BIGBOY_COUNTER = (() => {
  const c = cv(CW, CH);
  // The blocks: six, 24 wide, letters A B C D E F (the plaque covers the middle two).
  const L = "ABCDEF";
  for (let b = 0; b < 6; b++) {
    const x0 = 2 + b * 24;
    const k = [0, 4, 2, 3, 5, 1][b]!;
    for (let y = CTOP + 5; y <= CFOOT; y++)
      for (let i = 0; i < 24; i++) {
        const j = y - (CTOP + 5);
        const H = CFOOT - (CTOP + 5);
        let key: string;
        if (i === 0 || j === H) key = "k";
        else if (j < 2 || i < 3) key = TNT[k]!;
        else if (i > 20 || j > H - 3) key = SHD[k]!;
        else key = glyphAt(L[b]!, Math.floor((i - 9) / 2) + (i >= 9 ? 0 : -9), Math.floor((j - 5) / 2) + (j >= 5 ? 0 : -9)) ? "F" : SAT[k]!;
        put(c, x0 + i, y, key);
      }
  }
  // The board on top: white, its front edge, seen a little from above.
  for (let y = CTOP; y < CTOP + 5; y++) for (let x = 0; x < CW; x++) put(c, x, y, y === CTOP ? "F" : y === CTOP + 4 ? "V" : y === CTOP + 3 ? "W" : x < 3 ? "F" : "F");
  const plaque = signBoard(PLQ.x, PLQ.y, PLQ.w, PLQ.h, "TtuU", "oRr", "3");
  // On its left end: a little stack of blocks and a rattle lying by it (it's a toy shop).
  const on = cv(CW, CH);
  toyBlock(on, 6, CTOP - 1, 8, 1);
  toyBlock(on, 15, CTOP - 1, 8, 5);
  toyBlock(on, 10, CTOP - 12, 8, 3);
  stamp(on, 28, CTOP - 7, ["..kkk.......", ".k(11k......", "k(1F17kkkkk.", "k11117kFFWWk", ".k777k.kkkk.", "..kkk......."].map((r) => r));
  return def("counter", [4, 1], CW, CH, [CW / 2, CFOOT], [[groundShadow(CW / 2, CFOOT, CW / 2 - 2, 4), { part: asPart(c, true), at: [0, 0] }, plaque, cropBit(on)!]]);
})();

/**
 * Big Boy's Boss Crate: a toy box striped in his rainbow, a white lid with a teal rim, his swirly lollipop lying on the
 * lid, a white star on the front. `idle`: a glint runs along the lid and winks on the lollipop (6 frames).
 */
const XW = 30;
const XH = 27;
export const SHOP_BIGBOY_CRATE = (() => {
  const box = paint(1, 12, 28, 13, (x, y) => {
    const i = x - 1;
    const j = y - 12;
    const st = starAt(i + 0.5 - 14, j + 0.5 - 6.5, 5);
    if (st) return st === 2 ? "W" : "F";
    const b = Math.min(5, Math.floor(i / (28 / 6)));
    if (j === 12) return SHD[b]!;
    return i % 5 === 4 && j > 0 ? SHD[b]! : j === 0 ? TNT[b]! : SAT[b]!;
  });
  const lid = paint(0, 7, 30, 6, (x, y) => {
    const j = y - 7;
    if (j < 4) return j === 0 ? "F" : x > 26 ? "W" : "F";
    return j === 4 ? "u" : "T";
  });
  const pop = cv(XW, XH);
  // The lollipop on the lid: its stick to the left, the swirl to the right.
  stamp(pop, 4, 6, ["FFFFFFFFFV", "VVVVVVVVVV"]);
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 11; x++) {
      const X = x + 0.5 - 5.5;
      const Y = y + 0.5 - 4.5;
      const r = Math.hypot(X, Y);
      if (r > 5.2) continue;
      const band = ((Math.floor((Math.atan2(Y, X) / (2 * Math.PI)) * 6 + r / 2) % 6) + 6) % 6;
      put(pop, 13 + x, y, SAT[band]!);
    }
  const frames = [0, 1, 2, 3, 4, 5].map((f) => {
    const g = cv(XW, XH);
    const gx = [-9, 3, 10, 17, 24, -9][f]!;
    if (gx > 0) stamp(g, gx, 7, [".F.", "FFF", ".F."]);
    if (f === 5) stamp(g, 15, 0, [".F.", "FFF", ".F."]);
    return [groundShadow(XW / 2, XH - 2, 13, 2), box, lid, cropBit(pop)!, ...(cropBit(g, false) ? [cropBit(g, false)!] : [])];
  });
  return def("crate", [1, 1], XW, XH, [XW / 2, XH - 2], frames, 220);
})();

// ==== The showpiece: a toy airplane on a string from the ceiling, flying round and round over the pit.

/**
 * A little 3D toy plane, drawn by marching each pixel's ray into its shape (so it turns smoothly as it flies round): a red
 * body, yellow wings, a blue tail, a light blue canopy, a white spinner and a two-bladed propeller, little wheels. Its
 * shape in its own frame (x forward, y to its left, z up), as distance and material.
 */
type V3 = readonly [number, number, number];
const sdEll = (p: V3, c: V3, r: V3) => {
  const k = Math.hypot((p[0] - c[0]) / r[0], (p[1] - c[1]) / r[1], (p[2] - c[2]) / r[2]);
  return (k - 1) * Math.min(r[0], r[1], r[2]);
};
const sdBox = (p: V3, c: V3, h: V3, round = 0) => {
  const q = [Math.abs(p[0] - c[0]) - h[0], Math.abs(p[1] - c[1]) - h[1], Math.abs(p[2] - c[2]) - h[2]];
  return Math.hypot(Math.max(q[0]!, 0), Math.max(q[1]!, 0), Math.max(q[2]!, 0)) + Math.min(Math.max(q[0]!, q[1]!, q[2]!), 0) - round;
};
const PLANE_MAT: Record<string, string> = { body: "(17", wing: "[39", tail: "{5!", glass: "xSs", prop: "FWV", wheel: "VZk" };
function planeSd(p: V3, prop: number): [number, string] {
  const parts: [number, string][] = [
    [sdEll(p, [0, 0, 0], [12, 3.8, 4]), "body"],
    [sdEll(p, [1.5, 0, 3], [4.2, 2.6, 2.7]), "glass"],
    [sdBox(p, [0.5, 0, -1.2], [3.2, 14.5, 0.5], 0.5), "wing"],
    [sdBox(p, [-10, 0, 0.6], [1.8, 6, 0.3], 0.4), "tail"],
    [sdBox(p, [-10.4, 0, 4], [2, 0.3, 3.4], 0.4), "tail"],
    [sdEll(p, [12.3, 0, 0], [2, 1.8, 1.8]), "prop"],
    [sdEll(p, [3, 3.4, -5], [1.7, 0.8, 1.7]), "wheel"],
    [sdEll(p, [3, -3.4, -5], [1.7, 0.8, 1.7]), "wheel"],
  ];
  // The propeller, turned by `prop` round the plane's axis.
  const cy = Math.cos(prop);
  const sy = Math.sin(prop);
  const q: V3 = [p[0], p[1] * cy + p[2] * sy, -p[1] * sy + p[2] * cy];
  parts.push([sdBox(q, [13.2, 0, 0], [0.3, 0.8, 6.8], 0.3), "prop"]);
  return parts.reduce((m, d) => (d[0] < m[0] ? d : m));
}
const AW = 3 * T;
const A_RISE = 100; // how far its picture rises above its north row
const AH = A_RISE + 3 * T;
const AFOOT = A_RISE + 2 * T + 18; // its foot: the middle of its south row
const A_CX = Math.floor(AW / 2);
const A_GY = A_RISE + T + 18; // the loop's middle on the floor: the middle of its middle row
const LOOP_RX = 33;
const LOOP_RY = 17;
const FLY_H = 86; // how high it flies over the balls
const HOOK: Pt = [A_CX, A_GY - FLY_H - 300]; // the string's hook in the ceiling, far over the picture
const A_N = 16;
/**
 * The plane at frame `f` of the loop: where it is on its ellipse (round anticlockwise seen from above: away up the right
 * side, across the back to the left, toward us down the left, across the front to the right), banked into the turn, a
 * little smaller at the back. Returns its pixels (key per pixel) and the string's top end on it.
 */
function planeFrame(f: number) {
  const th = (2 * Math.PI * f) / A_N;
  const X = A_CX + LOOP_RX * Math.cos(th);
  const Yn = LOOP_RY * Math.sin(th); // north of the loop's middle
  const psi = Math.atan2(LOOP_RY * Math.cos(th), -LOOP_RX * Math.sin(th));
  const bank = 0.38;
  const s = 1.08 - 0.12 * Math.sin(th);
  const prop = f * 2.2;
  const [cp, sp, cb, sb] = [Math.cos(psi), Math.sin(psi), Math.cos(bank), Math.sin(bank)];
  const local = (q: V3): V3 => {
    const d = [(q[0] - X) / s, (q[1] - Yn) / s, (q[2] - FLY_H) / s];
    const x = d[0]! * cp + d[1]! * sp;
    const y1 = -d[0]! * sp + d[1]! * cp;
    return [x, y1 * cb - d[2]! * sb, y1 * sb + d[2]! * cb];
  };
  const world = (l: V3): V3 => {
    const y1 = l[1] * cb + l[2] * sb;
    const z = -l[1] * sb + l[2] * cb;
    return [X + s * (l[0] * cp - y1 * sp), Yn + s * (l[0] * sp + y1 * cp), FLY_H + s * z];
  };
  const sd = (q: V3) => {
    const [d, m] = planeSd(local(q), prop);
    return [d * s, m] as const;
  };
  const scy = A_GY - Yn - FLY_H; // its middle on screen
  const L = [-0.5, -0.4, 0.77];
  const box = 22;
  const px = new Map<string, { k: string; t: number }>();
  for (let sy0 = Math.floor(scy - box); sy0 <= scy + box; sy0++)
    for (let sx0 = Math.floor(X - box); sx0 <= X + box; sx0++) {
      const sx = sx0 + 0.5;
      const syc = sy0 + 0.5;
      const Z0 = FLY_H + 30;
      const Y0 = A_GY - syc - Z0;
      let t = 0;
      let hit: string | null = null;
      for (let n = 0; n < 70 && t < 90; n++) {
        const q: V3 = [sx, Y0 + t * Math.SQRT1_2, Z0 - t * Math.SQRT1_2];
        const [d, m] = sd(q);
        if (d < 0.08) {
          hit = m;
          break;
        }
        t += Math.max(d, 0.08);
      }
      if (!hit) continue;
      const q: V3 = [sx, Y0 + t * Math.SQRT1_2, Z0 - t * Math.SQRT1_2];
      const e = 0.15;
      const g = [0, 1, 2].map((a) => {
        const qp = [...q] as [number, number, number];
        const qm = [...q] as [number, number, number];
        qp[a] += e;
        qm[a] -= e;
        return sd(qp)[0] - sd(qm)[0];
      });
      const gl = Math.hypot(g[0]!, g[1]!, g[2]!) || 1;
      const lit = (g[0]! * L[0]! + g[1]! * L[1]! + g[2]! * L[2]!) / gl;
      const ramp = PLANE_MAT[hit]!;
      px.set(`${sx0},${sy0}`, { k: lit > 0.55 ? ramp[0]! : lit > 0 ? ramp[1]! : ramp[2]!, t });
    }
  // A dark line where a nearer part of it passes in front of a farther one.
  const c = cv(AW, AH);
  for (const [key, v] of px) {
    const [x, y] = key.split(",").map(Number) as [number, number];
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const o = px.get(`${x + dx},${y + dy}`);
      return o && v.t - o.t > 3;
    });
    put(c, x, y, nb ? "k" : v.k);
  }
  const top = world([0.5, 0, 5.2]);
  return { c, X, Yn, s, top: [top[0], A_GY - top[1] - top[2]] as Pt };
}
export const SHOP_BIGBOY_AIRPLANE = (() => {
  const frames = Array.from({ length: A_N }, (_, f) => {
    const { c, X, Yn, s, top } = planeFrame(f);
    // The string: from the top of the plane straight up to the hook (off the top of the picture), swinging as it goes round.
    const str = cv(AW, AH);
    for (let y = Math.floor(top[1]); y >= 0; y--) {
      const t = (top[1] - y) / (top[1] - HOOK[1]);
      put(str, Math.round(top[0] + (HOOK[0] - top[0]) * t - 0.5), y, "Z");
    }
    const shadow = groundShadow(X, A_GY - Yn, 10 * s, 4.5 * s);
    return [shadow, cropBit(str, false)!, cropBit(c, true)!];
  });
  return def("airplane", [3, 3], AW, AH, [A_CX, AFOOT], frames, 90);
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
  /** Squares deep, for the deep pieces, from `row` north: it stands on `row`, and covers the rows north of it too. */
  d?: number;
  /** The way out (the entrance): walking into it leaves the crib. */
  exit?: boolean;
}
const LAYOUT: ShopPlace[] = [];
const at = (name: string, col: number, row: number, solid: boolean, more: Partial<ShopPlace> = {}) => {
  const p = PIECES[name];
  if (p) LAYOUT.push({ name, col, row, solid, ...(p.sq[0] > 1 ? { w: p.sq[0] } : {}), ...(p.sq[1] > 1 ? { d: p.sq[1] } : {}), ...more });
};

// -- Where the raised floors are.
const rect = (set: Set<string>, c0: number, c1: number, r0: number, r1: number) => {
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) set.add(`${c},${r}`);
};
const WALK = new Set<string>();
rect(WALK, 9, 10, 15, 17); // from the door to the circle's south mark
rect(WALK, 9, 10, 5, 6); // from its north mark to the shop
rect(WALK, 14, 17, 10, 11); // east, under the airplane
rect(WALK, 2, 5, 10, 11); // west, to the rocking horse
const DOOR = new Set(["9,18", "10,18"]);
const PLAT = new Set<string>();
rect(PLAT, 4, 15, 1, 4);
const isWalk = (c: number, r: number) => WALK.has(`${c},${r}`) || DOOR.has(`${c},${r}`);
const isCircleFull = (c: number, r: number) => !!CIRCLE_AT[`${c},${r}`]?.full;
const raised = (c: number, r: number) => isWalk(c, r) || PLAT.has(`${c},${r}`) || isCircleFull(c, r);
/** Squares a bumper is not wanted against: the raised floors, the walls, the doorway. */
const noBump = (c: number, r: number) => raised(c, r) || !!CIRCLE_AT[`${c},${r}`] || r <= 0 || c <= 0 || c >= 19 || (r === 19 && (c === 9 || c === 10));
const sidesOf = (c: number, r: number): Sides => {
  const o = (dc: number, dr: number) => !noBump(c + dc, r + dr);
  const s: Sides = { n: o(0, -1), e: o(1, 0), s: o(0, 1), w: o(-1, 0) };
  s.ne = !s.n && !s.e && o(1, -1);
  s.se = !s.s && !s.e && o(1, 1);
  s.sw = !s.s && !s.w && o(-1, 1);
  s.nw = !s.n && !s.w && o(-1, -1);
  return s;
};

// -- The floor (every square).
for (let row = 0; row < 20; row++)
  for (let col = 0; col < 20; col++) {
    const k = `${col},${row}`;
    const ci = CIRCLE_AT[k];
    if (ci) at(ci.name, col, row, false, ci.rot ? { rot: ci.rot } : {});
    else if (DOOR.has(k)) at("floor-door", col, row, false, col === 10 ? { flip: true } : {});
    else if (WALK.has(k)) at(walkTile((col + row) % 2 ? "t" : "y", sidesOf(col, row)), col, row, false);
    else if (PLAT.has(k)) at(platTile(sidesOf(col, row)), col, row, false);
    else {
      const v = pitVar(col, row);
      const face = isWalk(col, row - 1) ? "w" : PLAT.has(`${col},${row - 1}`) ? "p" : isCircleFull(col, row - 1) ? "c" : "";
      const west = raised(col - 1, row);
      const corner = !face && !west && raised(col - 1, row - 1);
      at(face || west || corner ? pitEdge(v, face, col, west, corner) : ["pit-a", "pit-b", "pit-c"][v]!, col, row, true);
    }
  }
const FLOOR_COUNT = LAYOUT.length;

// -- The walls: the back (north) wall on row 0, the sides on columns 0 and 19, the low front on row 19.
const BACKDROP = !!PIECES["backdrop"];
at("wall-pillar", 0, 0, true);
at("wall-window", 1, 0, true);
at("wall-pillar", 5, 0, true);
at("wall", 6, 0, true);
at("wall-b", 7, 0, true);
if (BACKDROP) at("backdrop", 8, 0, true);
else for (let c = 8; c <= 11; c++) at(c % 2 ? "wall-b" : "wall", c, 0, true);
at("wall", 12, 0, true);
at("wall-b", 13, 0, true);
at("wall-pillar", 14, 0, true);
at("wall-window-b", 15, 0, true);
at("wall-pillar", 19, 0, true);
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
at("crate", 8, 3, false); // on the counter (see SHOP_BIGBOY_CRATE_AT): its place is the counter's
at("airplane", 15, 9, true); // over columns 15-17, rows 7-9, the east walkway passing under it
//@@PROPS@@

/** Where every piece goes: name, column (its west-most square), row (its south-most), solid; floor tiles first, then the upright pieces north to south. */
export const SHOP_BIGBOY_LAYOUT: readonly ShopPlace[] = [...LAYOUT.slice(0, FLOOR_COUNT), ...LAYOUT.slice(FLOOR_COUNT).sort((a, b) => a.row - b.row || a.col - b.col)];

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
const CRATE_AT_: Pt = SHOP_BIGBOY_CRATE_AT;
const footOf = (pl: ShopPlace): Pt => {
  const p = PIECES[pl.name]!;
  if (pl.name === "crate") {
    const cp = PIECES["counter"]!;
    const [cx, cy] = footOf({ name: "counter", col: pl.col, row: pl.row, solid: true });
    return [cx - cp.foot[0] + CRATE_AT_[0], cy - cp.foot[1] + CRATE_AT_[1]];
  }
  return [pl.col * T + Math.floor((p.sq[0] * T) / 2), TOP + pl.row * T + 18];
};
const roomFrame = (f: number): Frame => {
  const layers: Layer[] = [];
  for (const pl of SHOP_BIGBOY_LAYOUT) {
    const p = PIECES[pl.name]!;
    const [fx, fy] = footOf(pl);
    layers.push(...placed(p, f, fx, fy, pl.flip, pl.rot));
  }
  return { ms: 90, layers };
};
const anims: Record<string, Anim> = { idle: { loop: true, frames: [roomFrame(0)] } };
/** (For review: the room with every piece's idle running.) */
anims["room-live"] = { loop: true, frames: Array.from({ length: 16 }, (_, f) => roomFrame(f)) };

/** The floor's picture at room pixel (gx, gy) (tiles turned and mirrored as laid). */
const floorAt = new Map(SHOP_BIGBOY_LAYOUT.slice(0, FLOOR_COUNT).map((p) => [`${p.col},${p.row}`, p]));
const floorKey = (gx: number, gy: number): string => {
  const p = floorAt.get(`${Math.floor(gx / T)},${Math.floor(gy / T)}`);
  if (!p) return ".";
  const g = PIECES[p.name]!.frames[0]![0]!.part.grid;
  let [x, y] = [gx % T, gy % T];
  if (p.flip) x = T - 1 - x;
  for (let q = 0; q < (p.rot ?? 0); q++) [x, y] = [y, T - 1 - x]; // undo a quarter turn clockwise
  return g[y]![x]!;
};
/** (For review: squares c0..c1, r0..r1 of the floor as laid, at `z`x.) */
const reviewFloor = (name: string, c0: number, r0: number, c1: number, r1: number, z: number) => {
  const grid = Array.from({ length: (r1 - r0 + 1) * T * z }, (_, y) => Array.from({ length: (c1 - c0 + 1) * T * z }, (_, x) => floorKey(c0 * T + Math.floor(x / z), r0 * T + Math.floor(y / z))).join(""));
  roomParts[name] = { grid, outline: false };
  anims[name] = { loop: true, frames: [{ ms: 1000, layers: [{ part: name, x: 0, y: 0 }] }] };
};
reviewFloor("review-circle", 5, 6, 14, 15, 2);
reviewFloor("review-pit", 13, 12, 18, 17, 3);
reviewFloor("review-floor", 0, 0, 19, 19, 1);
reviewFloor("review-walk", 1, 8, 7, 13, 3);
reviewFloor("review-shop", 7, 2, 12, 7, 3);

/** Each piece alone, for review, blown up (up to 4x); a floor tile three by three, a wall three side by side. */
const ZOOM_FLOORS = new Set(["pit-a", "pit-b", "pit-c", "floor-door", "plat", "walk-t", "walk-y"]);
for (const p of Object.values(PIECES)) {
  const flatTile = p.w === T && p.h === T;
  if (flatTile && !ZOOM_FLOORS.has(p.name)) continue;
  const ch = toChar(p);
  const [rx, ry] = flatTile ? [3, 3] : p.name === "wall" || p.name === "wall-b" || p.name === "hem" ? [3, 1] : [1, 1];
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
/** (For review: every frame of an animated piece in a grid, rows y0..y1 of its picture, at `z`x: `strip-<name>`.) */
const strip = (name: string, y0: number, y1: number, z: number, cols: number) => {
  const p = PIECES[name];
  if (!p) return;
  const ch = toChar(p);
  const keys = ch.anims.idle!.frames.map((fr) => frameKeys(ch, fr));
  const cw = p.w * z + 4;
  const chh = (y1 - y0) * z + 4;
  const rows = Math.ceil(keys.length / cols);
  const grid = Array.from({ length: rows * chh }, (_, y) =>
    Array.from({ length: cols * cw }, (_, x) => {
      const f = Math.floor(y / chh) * cols + Math.floor(x / cw);
      const lx = (x % cw) - 2;
      const ly = (y % chh) - 2;
      if (f >= keys.length || lx < 0 || ly < 0 || lx >= p.w * z || ly >= (y1 - y0) * z) return ".";
      return keys[f]![y0 + Math.floor(ly / z)]?.[Math.floor(lx / z)] ?? ".";
    }).join(""),
  );
  roomParts[`strip-${name}`] = { grid, outline: false };
  anims[`strip-${name}`] = { loop: true, frames: [{ ms: 1000, layers: [{ part: `strip-${name}`, x: 0, y: 0 }] }] };
};
strip("airplane", 20, 175, 2, 3);
//@@REVIEW@@

/** Every piece by its name (as SHOP_BIGBOY_LAYOUT names them), each its own Character `shop-bigboy-<name>`. */
export const SHOP_BIGBOY_PIECES: Readonly<Record<string, Character>> = Object.fromEntries(Object.values(PIECES).map((p) => [p.name, toChar(p)]));

export const HOUSE_SHOP_BIGBOY: Character = { id: "house-shop-bigboy", name: "Big Boy's shop", w: RW, h: RH, foot: [RW / 2, RH - 4], palette: PALETTE, parts: roomParts, anims };

void signBoard;
void signFace;
void groundShadow;
void LANTERN_LIGHT;
void get;
void asPart;
void stamp;
export type { LightPool, LightSpot };
