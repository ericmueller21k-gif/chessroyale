/**
 * The zebras' bakery kit (Nov 10, drawn by hand in code): the colors, the lettering, the bread and the little chess things shared by
 * the bakery's front (in the town), its front room (the shop) and its back room (house-shop-zebra.ts). Copy it next to them in the
 * game (town/shops/), as warehouse-kit.ts was.
 *
 * - The colors (BAKERY_PALETTE): the black and white checker floor, cream plaster, subway tile, warm wood, bread from crumb to dark
 *   crust, flour, the mixer's steel and its dough, the awning's zebra stripes, the back room's dim plaster, planks and red rug, marker
 *   inks, the TV's stream, the green card-table lamp.
 * - The lettering: the town's sign capitals (5 px tall, town/sign-font.ts) for signs ("JUST A BAKERY", "STAFF ONLY"), and a small
 *   hand-written chess hand for the back room's walls and the TV (lower-case files a to h, piece letters, digits, "x", "+", "!", "?").
 * - The bread: a baguette (long, its scoring slashes along the crust, Eric: "it's easy to put those marks along the bread"), a boule
 *   (a round loaf, a cross scored on top), a roll, a croissant, a sandwich loaf and a braided loaf.
 * - The chess things: a tiny piece (6 to 9 px), a board sketch in marker, an arrow.
 * No real brands, people or places.
 */
import type { Part } from "../../characters/sprite.ts";

export type Pt = readonly [number, number];
export type Key = string | null;
export type Bit = { part: Part; at: Pt };

export const BAKERY_PALETTE: Record<string, string> = {
  k: "#1d1916", // outline (a warm near-black)
  // The front room's checker floor: white, its shade, black, its light, the grout.
  W: "#efe9dc",
  w: "#d6cdbb",
  A: "#2b2729",
  a: "#3d3739",
  g: "#a9a090",
  // Cream plaster: shade, mid, light; subway tile and its grout.
  "1": "#cdb486",
  "2": "#e6d1a6",
  "3": "#f6e7c4",
  "4": "#f4f2ec",
  "5": "#c9c2b2",
  // Wood: deepest, dark, mid, light, lit.
  "6": "#3b2314",
  "7": "#5e3a20",
  "8": "#87572f",
  "9": "#b07a45",
  "0": "#d39f66",
  // Bread: dark crust, crust, light crust, golden, crumb; flour dust.
  B: "#6e360f",
  b: "#a65b1c",
  c: "#cf8636",
  C: "#e8b25e",
  m: "#f4dcac",
  f: "#fbf7ee",
  // Steel (the mixer, the register, the frames): dark, mid, light, bright, shine.
  S: "#363b44",
  s: "#5d6470",
  i: "#8f97a4",
  I: "#c3c9d2",
  "~": "#eef2f6",
  // Dough: shade, mid, light.
  d: "#dfc28c",
  D: "#f0dcb2",
  e: "#fff2d6",
  // The zebra black and white (the awning, the crate's stripes, the guards' marks): black, its light, white, its shade.
  Z: "#221f22",
  z: "#3a3539",
  X: "#f7f4ec",
  x: "#d9d3c5",
  // Burgundy and gold (the family's signs): burgundy, dark burgundy, gold, dark gold.
  R: "#8c2232",
  r: "#5c1520",
  Y: "#e7b84b",
  y: "#ad8126",
  // Chalkboard and chalk.
  K: "#2c3a33",
  j: "#3b4c43",
  J: "#e6ede7",
  // Glass (the display case, the window): light, mid, and the daylight outside.
  G: "#cfeaf0",
  h: "#97c7d3",
  H: "#a9d8ef",
  // Greenery (a potted basil, the sign's laurel): dark, mid.
  v: "#2e6b3c",
  V: "#4f9a5c",
  // The back room: dim plaster (shade, mid, light), planks (deep, mid, light), the rug (red, dark red), its gold border.
  "!": "#7d6c52",
  "@": "#a08d6c",
  "#": "#b8a582",
  $: "#2e1f16",
  "%": "#47301f",
  "^": "#5c4029",
  "&": "#7c2a24",
  "*": "#541a17",
  "(": "#c49a3c",
  // Marker inks: black, red, blue; cork, its shade; pins.
  ")": "#211d1f",
  "-": "#c0362c",
  _: "#2f5da8",
  "=": "#b88a57",
  "+": "#94683b",
  "[": "#e5d24a",
  // The TV: bezel, its light, the stream's background, the board's light and dark, the chat's inks (green, violet, cyan, white), the
  // little red LIVE dot.
  "]": "#141417",
  "{": "#2a2a30",
  "}": "#17202e",
  "|": "#e8d6ae",
  ";": "#8e6440",
  ":": "#5fd17a",
  "'": "#b98cf2",
  '"': "#5cc9e8",
  ",": "#e9eef4",
  "<": "#e8453a",
  // The green card-table lamp: dark, mid, light, the bulb, its warm glow.
  ">": "#1f4a2a",
  "/": "#2f6b3e",
  "?": "#4f9a61",
  L: "#fff6d2",
  l: "#ffd98a",
  // The chess pieces on the table: white's, its shade; black's, its light.
  P: "#f3efe4",
  p: "#c9c1ae",
  Q: "#262224",
  q: "#4a4447",
  // Ground shadow: core, rim (see-through).
  "`": "#0d0e1280",
};

// ---- A small canvas to stamp on.

export type Cv = string[][];
export const cv = (w: number, h: number): Cv => Array.from({ length: h }, () => Array<string>(w).fill("."));
export const put = (c: Cv, x: number, y: number, k: string) => {
  x = Math.round(x);
  y = Math.round(y);
  if (y >= 0 && y < c.length && x >= 0 && x < c[0]!.length) c[y]![x] = k;
};
export const get = (c: Cv, x: number, y: number) => c[Math.round(y)]?.[Math.round(x)] ?? ".";
export const rect = (c: Cv, x0: number, y0: number, w: number, h: number, k: string | ((x: number, y: number) => Key)) => {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const v = typeof k === "string" ? k : k(x - x0, y - y0);
      if (v) put(c, x, y, v);
    }
};
export const stamp = (c: Cv, x: number, y: number, rows: readonly string[]) => rows.forEach((r, j) => [...r].forEach((k, i) => k !== "." && put(c, x + i, y + j, k)));
/** A straight line of `k` from (x0, y0) to (x1, y1), `t` px thick. */
export function line(c: Cv, x0: number, y0: number, x1: number, y1: number, k: string, t = 1): void {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let s = 0; s <= n; s++) {
    const x = x0 + ((x1 - x0) * s) / n;
    const y = y0 + ((y1 - y0) * s) / n;
    for (let a = 0; a < t; a++) for (let b = 0; b < t; b++) put(c, x + a - (t >> 1), y + b - (t >> 1), k);
  }
}
/** An ellipse filled by `fn(dx, dy, d)` (d: 0 at the middle, 1 at the edge). */
export function blob(c: Cv, cx: number, cy: number, rx: number, ry: number, fn: (dx: number, dy: number, d: number) => Key): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const d = Math.hypot(dx, dy);
      if (d > 1) continue;
      const k = fn(dx, dy, d);
      if (k) put(c, x, y, k);
    }
}
export const whole = (c: Cv, outline = false): Bit => ({ part: { grid: c.map((r) => r.join("")), outline }, at: [0, 0] });
/** A canvas cropped to what's drawn on it, as a Bit; null if it's empty. */
export const cropBit = (c: Cv, outline = true, dx = 0, dy = 0): Bit | null => {
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
  return { part: { grid: c.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1).join("")), outline }, at: [x0 + dx, y0 + dy] };
};
export const bits = (...bs: (Bit | null)[]): Bit[] => bs.filter((b): b is Bit => b !== null);
/** A steady pseudo-random number in [0, 1) for (x, y, seed). */
export function hash(x: number, y: number, seed = 1): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Copies the rectangle (x0, y0, w, h) of `c` into a new canvas. */
export const slice = (c: Cv, x0: number, y0: number, w: number, h: number): Cv => Array.from({ length: h }, (_, j) => Array.from({ length: w }, (_, i) => c[y0 + j]?.[x0 + i] ?? "."));

// ---- Lettering: the town's sign capitals (sign-font.ts), digits and a few marks.

const CAPS: Record<string, readonly string[]> = {
  A: [".#.", "#.#", "###", "#.#", "#.#"],
  B: ["##.", "#.#", "##.", "#.#", "##."],
  C: [".##", "#..", "#..", "#..", ".##"],
  D: ["##.", "#.#", "#.#", "#.#", "##."],
  E: ["###", "#..", "##.", "#..", "###"],
  F: ["###", "#..", "##.", "#..", "#.."],
  G: [".##", "#..", "#.#", "#.#", ".##"],
  H: ["#.#", "#.#", "###", "#.#", "#.#"],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  J: ["..#", "..#", "..#", "#.#", ".#."],
  K: ["#.#", "#.#", "##.", "#.#", "#.#"],
  L: ["#..", "#..", "#..", "#..", "###"],
  M: ["#...#", "##.##", "#.#.#", "#...#", "#...#"],
  N: ["#..#", "##.#", "#.##", "#..#", "#..#"],
  O: [".#.", "#.#", "#.#", "#.#", ".#."],
  P: ["##.", "#.#", "##.", "#..", "#.."],
  Q: [".#.", "#.#", "#.#", "##.", ".##"],
  R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: [".##", "#..", ".#.", "..#", "##."],
  T: ["###", ".#.", ".#.", ".#.", ".#."],
  U: ["#.#", "#.#", "#.#", "#.#", "###"],
  V: ["#.#", "#.#", "#.#", "#.#", ".#."],
  W: ["#...#", "#...#", "#.#.#", "##.##", "#...#"],
  X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."],
  Z: ["###", "..#", ".#.", "#..", "###"],
  "'": ["#", "#", ".", ".", "."],
  "&": [".#..", "#.#.", ".#..", "#.##", ".##."],
  "!": ["#", "#", "#", ".", "#"],
  "?": ["##.", "..#", ".#.", "...", ".#."],
  ".": [".", ".", ".", ".", "#"],
  ",": [".", ".", ".", "#", "#"],
  ":": [".", "#", ".", "#", "."],
  "0": ["###", "#.#", "#.#", "#.#", "###"],
  "1": [".#", "##", ".#", ".#", ".#"],
  "2": ["##.", "..#", ".#.", "#..", "###"],
  "3": ["##.", "..#", ".#.", "..#", "##."],
  "4": ["#.#", "#.#", "###", "..#", "..#"],
  "5": ["###", "#..", "##.", "..#", "##."],
  "6": [".#.", "#..", "##.", "#.#", ".#."],
  "7": ["###", "..#", ".#.", ".#.", ".#."],
  "8": [".#.", "#.#", ".#.", "#.#", ".#."],
  "9": [".#.", "#.#", ".##", "..#", ".#."],
  "-": ["...", "...", "###", "...", "..."],
  "+": ["...", ".#.", "###", ".#.", "..."],
  "$": [".#.", "###", "##.", ".##", "###"],
  "/": ["..#", "..#", ".#.", "#..", "#.."],
};
/** A line's width in pixels (letters 1 apart, a space 2). */
export function textWidth(s: string, font = CAPS): number {
  let w = 0;
  for (const ch of s) w += ch === " " ? 2 : (font[ch]?.[0]!.length ?? 3) + 1;
  return Math.max(0, w - 1);
}
/** Writes `s` with its top-left at (x, y) in key `ink`. */
export function text(c: Cv, x: number, y: number, s: string, ink: string, font = CAPS): void {
  let X = x;
  for (const ch of s) {
    if (ch === " ") {
      X += 2;
      continue;
    }
    const g = font[ch];
    if (!g) {
      X += 4;
      continue;
    }
    g.forEach((row, j) => [...row].forEach((p, i) => p === "#" && put(c, X + i, y + j + (font === HAND ? HAND_DROP[ch] ?? 0 : 0), ink)));
    X += g[0]!.length + 1;
  }
}
/** Writes `s` centred on x. */
export const textC = (c: Cv, cx: number, y: number, s: string, ink: string, font = CAPS) => text(c, Math.round(cx - textWidth(s, font) / 2), y, s, ink, font);

/**
 * The chess hand: what the crew scribble on the walls and what the TV's chat says. Lower-case files (a to h, 3 wide, 4 tall, sitting on
 * the line like the digits' lower part), the piece letters K Q R B N (the capitals above), digits, x, +, !, ?, "=", "#", "-", "O".
 */
const HAND: Record<string, readonly string[]> = {
  ...CAPS,
  a: ["##.", "..#", "###", "###"],
  b: ["#..", "##.", "#.#", "##."],
  c: [".##", "#..", "#..", ".##"],
  d: ["..#", ".##", "#.#", ".##"],
  e: [".#.", "###", "#..", ".##"],
  f: [".##", "#..", "##.", "#.."],
  g: [".##", "#.#", ".##", "##."],
  h: ["#..", "##.", "#.#", "#.#"],
  x: ["#.#", ".#.", "#.#"],
  "=": ["###", "...", "###"],
  "#": [".#.#.", "#####", ".#.#.", "#####", ".#.#."],
};
// (The lower-case letters and the small marks sit low: drawn this many px down so they line up with the capitals' foot.)
const HAND_DROP: Record<string, number> = { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1, h: 1, x: 2, "=": 1 };
export const handText = (c: Cv, x: number, y: number, s: string, ink: string) => text(c, x, y, s, ink, HAND);
export const handTextC = (c: Cv, cx: number, y: number, s: string, ink: string) => textC(c, cx, y, s, ink, HAND);
export const handWidth = (s: string) => textWidth(s, HAND);

// ---- The bread.

/**
 * A baguette lying along a line from (x0, y0) to (x1, y1), `r` px thick at its middle (tapering to its pointed ends): golden crust lit
 * on its upper side, dark underneath, and its scoring slashes (`slashes` of them, pale crumb showing through, each a short diagonal
 * across the loaf). Eric: "it's easy to put those marks along the bread. So it clearly looks like a big roll of bread."
 */
export function baguette(c: Cv, x0: number, y0: number, x1: number, y1: number, r: number, slashes = 4, flour = false): void {
  const L = Math.hypot(x1 - x0, y1 - y0);
  const ux = (x1 - x0) / L;
  const uy = (y1 - y0) / L;
  // (The loaf's "up" side: the normal pointing up the picture.)
  let nx = -uy;
  let ny = ux;
  if (ny > 0) (nx = -nx), (ny = -ny);
  const minX = Math.floor(Math.min(x0, x1) - r - 1);
  const maxX = Math.ceil(Math.max(x0, x1) + r + 1);
  const minY = Math.floor(Math.min(y0, y1) - r - 1);
  const maxY = Math.ceil(Math.max(y0, y1) + r + 1);
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5 - x0;
      const py = y + 0.5 - y0;
      const t = (px * ux + py * uy) / L; // 0..1 along
      if (t < 0 || t > 1) continue;
      const s = px * nx + py * ny; // across: + is up
      const taper = Math.min(1, Math.sin(Math.PI * t) * 1.6);
      const half = r * Math.max(0.35, taper);
      if (Math.abs(s) > half) continue;
      const v = s / half; // -1 (underside) .. 1 (top)
      // A slash: a short diagonal across the top half at each of `slashes` evenly spaced places.
      let slash = false;
      for (let i = 0; i < slashes; i++) {
        const tc = (i + 1) / (slashes + 1);
        const along = (t - tc) * L;
        if (Math.abs(along - v * r * 0.55) < 0.9 && v > -0.35 && v < 0.85) slash = true;
      }
      let k = v > 0.55 ? "C" : v > 0.05 ? "c" : v > -0.6 ? "b" : "B";
      if (slash) k = v > 0.3 ? "m" : "C";
      if (flour && v > 0.5 && hash(x, y, 77) < 0.35) k = "f";
      put(c, x, y, k);
    }
}
/** A boule: a round loaf, `r` across (half), its cross scored on top showing crumb, lit from the top left. */
export function boule(c: Cv, cx: number, cy: number, r: number, flour = true): void {
  blob(c, cx, cy, r, r * 0.72, (dx, dy, d) => {
    const lit = -dx * 0.5 - dy * 0.8;
    if (Math.abs(dx - dy * 0.15) < 0.09 && dy < 0.3 && d < 0.75) return "m";
    if (Math.abs(dy + 0.25) < 0.08 && Math.abs(dx) < 0.5) return "m";
    if (flour && lit > 0.45 && hash(Math.round(cx + dx * r), Math.round(cy + dy * r), 5) < 0.4) return "f";
    return d > 0.9 && dy > 0 ? "B" : lit > 0.4 ? "C" : lit > -0.25 ? "c" : "b";
  });
}
/** A roll: a small oval loaf with one slash. */
export function roll(c: Cv, cx: number, cy: number, rx = 4, ry = 3): void {
  blob(c, cx, cy, rx, ry, (dx, dy, d) => {
    if (Math.abs(dx + dy * 0.6) < 0.18 && d < 0.7) return "m";
    const lit = -dx * 0.4 - dy * 0.9;
    return d > 0.85 && dy > 0.2 ? "B" : lit > 0.3 ? "C" : lit > -0.3 ? "c" : "b";
  });
}
/** A croissant: a fat crescent of golden ridges, `s` px half-wide, horns pointing down. */
export function croissant(c: Cv, cx: number, cy: number, s = 6): void {
  for (let y = -s; y <= s; y++)
    for (let x = -s - 2; x <= s + 2; x++) {
      const a = Math.atan2(y + s * 0.6, x);
      const d = Math.hypot(x, y + s * 0.6);
      if (a < 0.2 || a > Math.PI - 0.2) continue;
      const thick = s * (0.35 + 0.35 * Math.sin(a));
      if (Math.abs(d - s * 0.95) > thick) continue;
      const ridge = Math.floor((a / Math.PI) * 5) % 2;
      const lit = (s * 0.95 - d) / thick;
      put(c, cx + x, cy + y, lit > 0.4 ? "C" : ridge ? "c" : lit < -0.5 ? "B" : "b");
    }
}
/** A sandwich loaf, side on: a tall crust with a domed top, `w` x `h`. */
export function tin(c: Cv, x0: number, y0: number, w: number, h: number): void {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dome = y < 4 ? Math.abs(x - (w - 1) / 2) > (w / 2) * Math.sqrt(1 - ((4 - y) / 4.5) ** 2) : false;
      if (dome) continue;
      put(c, x0 + x, y0 + y, y < 2 ? "C" : x === 0 || y > h - 2 ? "B" : x < 2 ? "C" : "c");
    }
}
/** A braided loaf: three twisted strands, glossy, `w` long. */
export function braid(c: Cv, x0: number, y0: number, w: number): void {
  for (let x = 0; x < w; x++) {
    const t = x / w;
    const env = Math.sin(Math.PI * t) * 4 + 1;
    for (let y = -6; y <= 6; y++) {
      if (Math.abs(y) > env) continue;
      const knot = Math.cos((x / 5) * Math.PI + (y > 0 ? 1.4 : 0));
      put(c, x0 + x, y0 + y, knot > 0.6 ? "C" : knot > -0.2 ? "c" : "b");
    }
  }
}

// ---- Chess things.

/** A tiny chess piece, 5 to 8 px tall, its foot at (x, y): `kind` p n b r q k, `side` "w" or "b"; `lying` knocked over. */
export function tinyPiece(c: Cv, x: number, y: number, kind: string, side: "w" | "b", lying = false): void {
  const SHAPES: Record<string, readonly string[]> = {
    p: [".#.", "###", ".#.", "###"],
    n: [".##.", "####", "..##", ".##.", "####"],
    b: [".#.", "###", "#.#", ".#.", ".#.", "###"],
    r: ["#.#.#", "#####", ".###.", ".###.", "#####"],
    q: ["#.#.#", ".###.", ".###.", "..#..", ".###.", "#####"],
    k: ["..#..", ".###.", "..#..", ".###.", ".###.", ".###.", "#####"],
  };
  const g = SHAPES[kind]!;
  const [hi, lo] = side === "w" ? ["P", "p"] : ["q", "Q"];
  const h = g.length;
  const w = g[0]!.length;
  g.forEach((row, j) =>
    [...row].forEach((p, i) => {
      if (p !== "#") return;
      const k = i < w / 2 ? hi : lo;
      if (lying) put(c, x - h + 1 + j, y - w + 1 + i + Math.floor(w / 2) - 1, k);
      else put(c, x - Math.floor(w / 2) + i, y - h + 1 + j, k);
    }),
  );
}
/** A board sketched in marker: `n` x `n` squares of `s` px, the dark ones hatched, its top-left at (x, y). */
export function boardSketch(c: Cv, x: number, y: number, n: number, s: number, ink: string): void {
  const W = n * s;
  for (let i = 0; i <= W; i++) {
    put(c, x + i, y, ink);
    put(c, x + i, y + W, ink);
    put(c, x, y + i, ink);
    put(c, x + W, y + i, ink);
  }
  for (let r = 0; r < n; r++)
    for (let f = 0; f < n; f++) {
      if ((r + f) % 2 === 0) continue;
      for (let j = 1; j < s; j++) for (let i = 1; i < s; i++) if ((i + j) % 3 === 0) put(c, x + f * s + i, y + r * s + j, ink);
    }
}
/** An arrow from (x0, y0) to (x1, y1) with a head, `t` px thick. */
export function arrow(c: Cv, x0: number, y0: number, x1: number, y1: number, k: string, t = 1): void {
  line(c, x0, y0, x1, y1, k, t);
  const a = Math.atan2(y1 - y0, x1 - x0);
  for (const s of [-1, 1]) line(c, x1, y1, x1 - Math.cos(a + s * 0.55) * 4, y1 - Math.sin(a + s * 0.55) * 4, k, t);
}
/** A circle (a ring) of radius r round (cx, cy). */
export function ring(c: Cv, cx: number, cy: number, r: number, k: string): void {
  const n = Math.ceil(2 * Math.PI * r * 1.5);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    put(c, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.85, k);
  }
}
