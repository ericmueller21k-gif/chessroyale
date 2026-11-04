/**
 * Copied as drawn from `claude/boss-art` (scripts/boss-art/out/house-shop-grex/warehouse-kit.ts at 0e4f6482, Nov 4, 2026; Eric approved the build Nov 4).
 * Changed: the import paths. The notes: scripts/boss-art/out/shop-grex-nov4.md and intro-grex-nov4.md on that branch.
 */
/**
 * Jefferson's warehouse kit (Nov 4, drawn by hand on the weekly plan usage): the colors, the box lettering and the stock,
 * shared by the room (house-shop-grex.ts), the crew's pallet (npc-grex/npc-grex.ts) and the intro's crate-stack table
 * (house-intro-grex/house-intro-grex.ts). Copy it next to them in the game (town/shops/), as hunchess-bucket.ts was.
 *
 * - The colors (WAREHOUSE_PALETTE): grey concrete, painted lines, pallet racking (blue uprights, orange beams), cardboard,
 *   pallet and crate wood, the firework boxes' bright inks, steel, the night outside.
 * - The lettering: the town's sign capitals (5 px tall, mostly 3 wide; town/sign-font.ts), plus digits and "!", for the
 *   made-up names on the boxes ("BOINGO BOTTLE ROCKETS", "MOON SHOT"...); and "SHOP" hand-drawn like a marker on paper.
 * - The stock: a firework carton (a printed front with its name and a burst), a load of cartons on a pallet, a wooden pallet,
 *   a slatted wooden crate (the table's stack), an open box of loose rockets.
 * No real brands or companies; toy-like fireworks.
 */
import type { Part } from "../../characters/sprite.ts";

export type Pt = readonly [number, number];
export type Key = string | null;
export type Bit = { part: Part; at: Pt };

export const WAREHOUSE_PALETTE: Record<string, string> = {
  k: "#1b1a20", // outline (a cool near-black)
  "1": "#5f5e5b", // concrete: seam, dark, base, light, speck
  "2": "#77756f",
  "3": "#878580",
  "4": "#95938d",
  "5": "#a9a69f",
  "6": "#5a5753", // an oil stain
  Y: "#efc02a", // painted line yellow, worn yellow
  y: "#c59a1c",
  "0": "#232228", // black (hazard stripes, the marker's ink, lettering)
  r: "#d0342b", // red: paint, the boss's mark, the sign's ring; dark
  R: "#8e1f1a",
  B: "#2f62b5", // the racking's blue uprights: mid, dark, lit
  b: "#1f4385",
  n: "#5c8fe3",
  O: "#f07c1e", // the racking's orange beams: mid, dark, lit
  o: "#b2540f",
  P: "#ffac5a",
  m: "#373a42", // steel: dark, mid, light, bright
  M: "#575b66",
  i: "#868b96",
  I: "#b9bec8",
  "9": "#26272e", // the racks' dark insides, deep and less deep
  "8": "#34353d",
  K: "#b98a52", // cardboard: mid, shade, lit, deep
  j: "#8e6435",
  J: "#d7ab70",
  "7": "#6b4a26",
  x: "#f4f6f8", // white: highlights, a carton's print, shrink-wrap shine
  w: "#6a4322", // wood (pallets, crates): dark, mid, light, lit, deepest
  u: "#93602f",
  U: "#b98045",
  v: "#d8a565",
  V: "#45290f",
  g: "#3faf4f", // the firework inks: green, dark green
  G: "#22713a",
  p: "#9150d6", // purple, deep purple
  q: "#5a2a96",
  t: "#2fa0e2", // sky blue, deep blue
  T: "#1d5f9c",
  z: "#ffd23a", // gold, deep gold
  Z: "#de9d10",
  h: "#ff6fb5", // pink, deep pink
  H: "#c03a82",
  "~": "#fbfaf3", // paper white (the SHOP sign), its shade
  "`": "#d9d6ca",
  "^": "#e8dfb2", // masking tape
  L: "#fffbe2", // a lamp's bulb, its warm glow
  "&": "#ffe7a0",
  N: "#141a38", // the night outside: deep, mid, low glow
  "=": "#26336a",
  "%": "#4a3f7a",
  "*": "#ffffff", // a star, a spark's white-hot core
  E: "#ffe24a", // a fuse's spark: yellow, orange, red
  f: "#ff9a1f",
  F: "#e8521b",
  "?": "#b9b2ba", // smoke: light, dark
  "|": "#8b848e",
  A: "#f4e4b8", // the chessboard: cream, orange, its dark edge
  C: "#cc5a2c",
  D: "#7a3418",
  "-": "#0d0e1280", // ground shadow: core, rim
  "+": "#0d0e1244",
};

// ---- A small canvas to stamp on.

export type Cv = string[][];
export const cv = (w: number, h: number): Cv => Array.from({ length: h }, () => Array<string>(w).fill("."));
export const put = (c: Cv, x: number, y: number, k: string) => {
  x = Math.round(x);
  y = Math.round(y);
  if (y >= 0 && y < c.length && x >= 0 && x < c[0]!.length) c[y]![x] = k;
};
export const get = (c: Cv, x: number, y: number) => c[y]?.[x] ?? ".";
export const fill = (c: Cv, fn: (x: number, y: number) => Key) => c.forEach((row, y) => row.forEach((_, x) => (row[x] = fn(x, y) ?? row[x]!)));
export const rect = (c: Cv, x0: number, y0: number, w: number, h: number, k: string | ((x: number, y: number) => Key)) => {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const v = typeof k === "string" ? k : k(x - x0, y - y0);
      if (v) put(c, x, y, v);
    }
};
export const stamp = (c: Cv, x: number, y: number, rows: readonly string[]) => rows.forEach((r, j) => [...r].forEach((k, i) => k !== "." && put(c, x + i, y + j, k)));
export const whole = (c: Cv, outline = false): Bit => ({ part: { grid: c.map((r) => r.join("")), outline }, at: [0, 0] });
/** A canvas cropped to what's drawn on it, as a Bit; null if it's empty. */
export const cropBit = (c: Cv, outline = true): Bit | null => {
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
export const bits = (...bs: (Bit | null)[]): Bit[] => bs.filter((b): b is Bit => b !== null);
/** A steady pseudo-random number in [0, 1) for (x, y, seed). */
export function hash(x: number, y: number, seed = 1): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---- Lettering: the town's sign capitals (sign-font.ts), digits and "!".

const GLYPHS: Record<string, readonly string[]> = {
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
};
/** A line's width in pixels (letters 1 apart, a space 2). */
export function textWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += ch === " " ? 2 : (GLYPHS[ch]?.[0]!.length ?? 3) + 1;
  return Math.max(0, w - 1);
}
/** Writes `s` with its top-left at (x, y) in key `ink`. */
export function text(c: Cv, x: number, y: number, s: string, ink: string): void {
  let X = x;
  for (const ch of s) {
    if (ch === " ") {
      X += 2;
      continue;
    }
    const g = GLYPHS[ch];
    if (!g) {
      X += 4;
      continue;
    }
    g.forEach((row, j) => [...row].forEach((p, i) => p === "#" && put(c, X + i, y + j, ink)));
    X += g[0]!.length + 1;
  }
}
/** Writes `s` centred on x. */
export const textC = (c: Cv, cx: number, y: number, s: string, ink: string) => text(c, Math.round(cx - textWidth(s) / 2), y, s, ink);

/**
 * "SHOP" hand-drawn in marker (Eric: "like Sharpie"): thick, a bit uneven, the letters not quite on one line, the H's right
 * leg leaning. 25 x 9 px of ink (`0`), its top-left at (x, y).
 */
export function marker(c: Cv, x: number, y: number): void {
  const S = [".###.", "##..#", "##...", ".###.", "...##", "#..##", ".###."];
  const H = ["##..#", "##.##", "##.##", "#####", "##.##", "##.##", "##.##"];
  const O = [".###.", "##.##", "##..#", "##..#", "##.##", "##.##", ".###."];
  const P = ["####.", "##.##", "##.##", "####.", "##...", "##...", "##..."];
  stamp(c, x, y + 1, S.map((r) => r.replace(/#/g, "0")));
  stamp(c, x + 6, y, H.map((r) => r.replace(/#/g, "0")));
  stamp(c, x + 12, y + 1, O.map((r) => r.replace(/#/g, "0")));
  stamp(c, x + 18, y + 2, P.map((r) => r.replace(/#/g, "0")));
}

/** The little taped-up SHOP sign: a sheet of white paper, 29 x 15, the corners taped (masking tape), its top-left at (x, y). */
export function shopSign(c: Cv, x: number, y: number): void {
  for (let j = 0; j < 15; j++)
    for (let i = 0; i < 29; i++) {
      const curl = (i === 28 && j > 11) || (i > 25 && j === 14); // the bottom-right corner lifting off
      if (curl) continue;
      put(c, x + i, y + j, j === 14 || i === 28 ? "`" : "~");
    }
  put(c, x + 27, y + 13, "`");
  marker(c, x + 2, y + 3);
  // Tape: a strip slanted over each top corner, one at the bottom left.
  stamp(c, x - 2, y - 1, ["^^^..", ".^^^^", "..^^^"]);
  stamp(c, x + 25, y - 1, ["..^^^", "^^^^.", "^^^.."]);
  stamp(c, x - 1, y + 12, ["^^...", "^^^^.", ".^^^"]);
}

// ---- The stock.

/** A firework's box design: its name in one or two lines, the box's ink and its shade, the name's ink, a burst's inks. */
export interface BoxDesign {
  lines: readonly string[];
  ink: string;
  shade: string;
  letters: string;
  burst: string;
}
export const DESIGNS: Readonly<Record<string, BoxDesign>> = {
  boingo: { lines: ["BOINGO", "ROCKETS"], ink: "t", shade: "T", letters: "x", burst: "zE" },
  timber: { lines: ["TIMBER", "TUMBLERS"], ink: "g", shade: "G", letters: "x", burst: "zh" },
  dash: { lines: ["DASH", "DAZZLERS"], ink: "z", shade: "Z", letters: "0", burst: "rt" },
  wrangler: { lines: ["WRANGLER", "ROUNDUP"], ink: "r", shade: "R", letters: "x", burst: "zE" },
  hollow: { lines: ["HOLLOW", "NIGHT"], ink: "q", shade: "0", letters: "z", burst: "tx" },
  bigboy: { lines: ["BIG BOY", "BOOMERS"], ink: "h", shade: "H", letters: "x", burst: "zt" },
  puddles: { lines: ["PUDDLES", "POPPERS"], ink: "t", shade: "T", letters: "z", burst: "gx" },
  moon: { lines: ["MOON", "SHOT"], ink: "T", shade: "0", letters: "z", burst: "xz" },
  roman: { lines: ["ROMAN", "CANDLES"], ink: "r", shade: "R", letters: "z", burst: "zx" },
  stripes: { lines: ["SKY", "STRIPES"], ink: "p", shade: "q", letters: "x", burst: "hz" },
  fizz: { lines: ["FIZZ", "WHIZ"], ink: "g", shade: "G", letters: "z", burst: "xh" },
  stars: { lines: ["STAR", "SHOWER"], ink: "z", shade: "Z", letters: "r", burst: "pt" },
  tall: { lines: ["TALL", "TALES"], ink: "O", shade: "o", letters: "x", burst: "zt" },
  neck: { lines: ["NECK &", "NECK"], ink: "h", shade: "H", letters: "0", burst: "zx" },
};

/** A little four-armed burst with a dot of white in the middle (a firework's star on a box), centred on (x, y). */
export function burst(c: Cv, x: number, y: number, inks: string, big = false): void {
  const a = inks[0]!;
  const b = inks[1] ?? a;
  put(c, x, y, "x");
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) put(c, x + dx, y + dy, a);
  for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as const) put(c, x + dx, y + dy, b);
  for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) put(c, x + dx * 2, y + dy * 2, a);
  if (big) for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3]] as const) put(c, x + dx, y + dy, b);
}

/**
 * A firework carton seen from the front, its top-left at (x, y), `w` x `h`: cardboard with a printed panel (the design's
 * color, a darker band at its foot), the name in white or black capitals, a burst or two, a lit top edge and a shaded
 * right edge. `wrap`: shrink-wrap shine (a few pale diagonal glints).
 */
export function carton(c: Cv, x: number, y: number, w: number, h: number, d: BoxDesign, seed = 1, wrap = false): void {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      let k = j === 0 ? "J" : i === w - 1 ? "j" : j === h - 1 ? "j" : "K";
      // The printed panel: inset 1, with a darker band along its foot.
      if (i >= 1 && i < w - 1 && j >= 2 && j < h - 1) k = j >= h - 3 ? d.shade : d.ink;
      put(c, x + i, y + j, k);
    }
  // A seam of tape down the middle of the top flap.
  put(c, x + Math.floor(w / 2), y, "^");
  put(c, x + Math.floor(w / 2), y + 1, "^");
  // The name: as many lines as fit, centred.
  const fits = d.lines.filter((l) => textWidth(l) <= w - 3);
  const lines = h - 5 >= 12 ? fits.slice(0, 2) : fits.slice(0, 1);
  const top = y + 3 + Math.max(0, Math.floor((h - 6 - lines.length * 6) / 2));
  lines.forEach((l, i) => textC(c, x + w / 2, top + i * 6, l, d.letters));
  // A burst in a spare corner (where there's room above or beside the name).
  if (h - 6 - lines.length * 6 >= 7) burst(c, x + w - 5, y + h - 6, d.burst);
  else if (w - 3 - Math.max(0, ...lines.map(textWidth)) >= 12) burst(c, x + 4, y + h / 2, d.burst);
  if (wrap)
    for (let n = 0; n < 3; n++) {
      const sx = x + 2 + Math.floor(hash(n, seed, 7) * (w - 6));
      for (let s = 0; s < 3; s++) if (get(c, sx + s, y + 2 + s) !== ".") put(c, sx + s, y + 2 + s, "x");
    }
}

/**
 * A wooden pallet seen from the front, `w` wide, 6 tall, its top-left at (x, y): a deck board on top, three blocks with the
 * two fork openings dark between them, a bottom board.
 */
export function pallet(c: Cv, x: number, y: number, w: number): void {
  const blocks = [0, Math.floor(w / 2) - 2, w - 4];
  for (let j = 0; j < 6; j++)
    for (let i = 0; i < w; i++) {
      let k: string;
      if (j <= 1) k = j === 0 ? "v" : "U";
      else if (j === 5) k = "u";
      else k = blocks.some((b) => i >= b && i < b + 4) ? (i % 4 === 0 ? "v" : "U") : j === 2 ? "V" : "9";
      if (j <= 1 && hash(i, j, w) < 0.12) k = "u";
      put(c, x + i, y + j, k);
    }
}

/** A load on a pallet: cartons stacked on it (rows of 1 or 2), its foot (the pallet's bottom middle) at (fx, fy). Returns its top. */
export function load(c: Cv, fx: number, fy: number, w: number, rows: readonly (readonly [string, number] | readonly [string, number, string, number])[], seed = 1): number {
  pallet(c, fx - Math.floor(w / 2), fy - 6, w);
  let y = fy - 6;
  rows.forEach((row, n) => {
    const h = row[1];
    y -= h;
    const inset = n === 0 ? 1 : 1 + Math.round(hash(n, seed, 3) * 2) - 1;
    if (row.length === 2) carton(c, fx - Math.floor(w / 2) + inset, y, w - 2 * Math.abs(inset) - (n % 2), h, DESIGNS[row[0]]!, seed + n, n === rows.length - 1);
    else {
      const half = Math.floor((w - 2) / 2);
      carton(c, fx - Math.floor(w / 2) + 1, y, half, h, DESIGNS[row[0]]!, seed + n);
      carton(c, fx - Math.floor(w / 2) + 1 + half, y + (row[3] < h ? h - row[3] : 0), w - 2 - half, Math.min(h, row[3]), DESIGNS[row[2]]!, seed + n + 9);
    }
  });
  return y;
}

/**
 * A slatted wooden crate, front on, `w` x `h`, its top-left at (x, y): a frame of dark boards round it, three slats across
 * with dark gaps, a lit top edge, a stencil (a star) on its middle slat. `lid`: a top board showing (the crate seen a little
 * from above, `lid` px deep).
 */
export function crate(c: Cv, x: number, y: number, w: number, h: number, seed = 1, lid = 0, mark: "star" | "arrow" | "none" = "star"): void {
  for (let j = 0; j < lid; j++) for (let i = 1; i < w - 1; i++) put(c, x + i, y + j, j === 0 ? "v" : (i + seed) % 7 === 0 ? "u" : "U");
  const y0 = y + lid;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const frame = i < 2 || i >= w - 2 || j < 2 || j >= h - 2;
      const gap = !frame && (j - 2) % Math.max(4, Math.floor((h - 4) / 3)) === 0 && j > 2;
      let k = frame ? (i < 2 && j >= 2 ? "u" : j < 2 ? (j === 0 ? "v" : "U") : "w") : gap ? "V" : hash(i >> 2, j, seed) < 0.3 ? "u" : "U";
      if (!frame && !gap && hash(i, j, seed + 5) < 0.06) k = "w";
      if (frame && (i === 0 || i === w - 1 || j === h - 1)) k = j === 0 ? "v" : "w";
      put(c, x + i, y0 + j, k);
    }
  // Nails at the corners.
  for (const [i, j] of [[1, 1], [w - 2, 1], [1, h - 2], [w - 2, h - 2]] as const) put(c, x + i, y0 + j, "m");
  const cx = x + Math.floor(w / 2);
  const cy = y0 + Math.floor(h / 2);
  if (mark === "star" && h >= 9) {
    // A stencilled firework star (red), slightly worn.
    for (const [dx, dy] of [[0, -2], [-1, -1], [0, -1], [1, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-1, 1], [1, 1], [-2, 2], [2, 2]] as const)
      if (hash(dx, dy, seed) > 0.12) put(c, cx + dx, cy + dy, "R");
  } else if (mark === "arrow" && h >= 9) {
    // "This way up" arrows, stencilled black.
    for (const ox of [-4, 3]) for (const [dx, dy] of [[0, -2], [-1, -1], [1, -1], [0, -1], [0, 0], [0, 1], [0, 2]] as const) put(c, cx + ox + dx, cy + dy, "0");
  }
}

/** An open carton with loose fireworks sticking out (rockets on sticks, a few fat candles), front on, its foot at (fx, fy). */
export function openBox(c: Cv, fx: number, fy: number, w: number, h: number, d: BoxDesign, seed = 1): void {
  const x0 = fx - Math.floor(w / 2);
  const y0 = fy - h;
  // What sticks out of it, behind its front: rocket tubes in the inks, their sticks, their cone tips.
  const inks = ["r", "t", "g", "z", "p", "h"];
  for (let n = 0; n < Math.floor(w / 4); n++) {
    const x = x0 + 2 + n * 4 + Math.round(hash(n, seed, 2));
    const tall = 6 + Math.floor(hash(n, seed, 4) * 7);
    const ink = inks[Math.floor(hash(n, seed, 6) * inks.length)]!;
    const lean = hash(n, seed, 8) < 0.3 ? -1 : hash(n, seed, 8) > 0.7 ? 1 : 0;
    for (let j = 0; j < tall; j++) {
      const lx = x + (lean * j) / 6;
      const key = j >= tall - 2 ? (j === tall - 1 ? "x" : "R") : j % 3 === 0 ? "x" : ink;
      put(c, lx, y0 + 2 - j, key);
      put(c, lx + 1, y0 + 2 - j, j >= tall - 2 ? "R" : ink === "z" ? "Z" : "0");
    }
  }
  // Its flaps, open: the near two folded down out front, the far two up behind.
  for (let i = -2; i < w + 2; i++) {
    put(c, x0 + i, y0 + 1, i < 0 || i >= w ? "j" : "J");
  }
  carton(c, x0, y0 + 2, w, h - 2, d, seed);
}
