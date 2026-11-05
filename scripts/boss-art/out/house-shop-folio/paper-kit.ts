/**
 * The paper kit for Folio's sanctuary (house-shop-folio), its shopkeeper (sidekick-folio-turtle) and its intro props
 * (house-intro-folio): one palette built on Folio's own (FOLIO_PALETTE, key for key where they meet), and the few ways
 * this paper is drawn:
 * - faces: a fold's flat face in one tone, its lit edges (top, left) a step lighter and its shaded edges (bottom, right) a
 *   step darker, a crease where two faces meet;
 * - ink: Folio's blue-black cursive (`cursive`: 1-px strokes with rounded humps, now and then a tall loop, no letters),
 *   and the sketch line (`inkLine`: a thin hand-drawn line that wobbles a hair, breaks now and then, and can be drawn only
 *   part of the way, for a line being written as you watch);
 * - gilt along a cut edge, and Folio's vermilion seal.
 * Light from the top left, as everywhere in the game. Pixel art: every pixel one palette key, nothing smoothed.
 */
import type { Part } from "../../../../packages/app/src/characters/sprite.ts";

export type Pt = readonly [number, number];

/** One palette for every piece of the sanctuary (Folio's paper, ink, gilt and seal are its own: characters/folio.ts). */
export const PAPER_PALETTE: Record<string, string> = {
  k: "#2b2330", // outline (Folio's)
  // Paper: highlight, the blank page, lit face, between, mid face, shaded face, crease (Folio's A B C D E, plus two between).
  A: "#fff7e6",
  a: "#faf2df",
  B: "#f3e7cc",
  b: "#eadbbb",
  C: "#d3bd95",
  D: "#a58e69",
  E: "#76624c",
  F: "#e3dccd", // the paper's back: cream-grey
  f: "#cbc3b3",
  // Ink (Folio's): on lit paper, on mid, on shade; the sketch line, strong and fading; the ruled lines; the margin line.
  i: "#8a93b8",
  j: "#717898",
  l: "#575c78",
  I: "#3d4163",
  J: "#6a7096",
  K: "#a9afc9",
  r: "#d7dcea",
  m: "#efb4a4",
  // Gilt (Folio's): gold, a glint, deep, in shade.
  G: "#f2c14e",
  H: "#fff0b4",
  g: "#b8862a",
  o: "#c9973c",
  // The seal (Folio's): vermilion, pressed deeper.
  v: "#d8432a",
  w: "#a3301e",
  // Stone paper (the fountain's basin, the pots, the inkstone's rim): lit to deep, grey-blue.
  "1": "#e4e6ec",
  "2": "#c6cad5",
  "3": "#a3a8b8",
  "4": "#7e8499",
  "5": "#5a5f76",
  // Tissue paper lit from behind (the stained glass, the cranes): light and deep, rose, gold, blue, jade, violet.
  p: "#ffbfae",
  P: "#ec7a62",
  y: "#ffe39a",
  Y: "#f2ad3f",
  u: "#b4cdf6",
  U: "#6286d0",
  q: "#bfeacb",
  Q: "#5fb487",
  x: "#dcc3f4",
  X: "#9c78d2",
  // Leaves: pleated green paper, light to dark.
  n: "#c6dfa4",
  N: "#97c37c",
  e: "#66995f",
  "6": "#3e6a48",
  // Kraft paper (the frames, stands, the desk, the turtle's spectacles): light to dark.
  "7": "#cfa878",
  "8": "#a37a4b",
  "9": "#6e4d30",
  "0": "#45301f",
  // The inkstone and wet ink: stone dark, mid, lit; wet ink.
  s: "#2c2e39",
  S: "#474a59",
  t: "#6a6e80",
  T: "#13141b",
  // Shadows on the paper floor: core, rim (warm, see-through).
  "-": "#76624c66",
  "+": "#76624c30",
  // Light through tissue on a surface (the moon window's glow).
  L: "#fff3c8",
};

export type Cv = string[][];
export const cv = (w: number, h: number): Cv => Array.from({ length: h }, () => Array<string>(w).fill("."));
export const W_ = (c: Cv) => c[0]?.length ?? 0;
export const H_ = (c: Cv) => c.length;
export const put = (c: Cv, x: number, y: number, k: string) => {
  x = Math.round(x);
  y = Math.round(y);
  if (y >= 0 && y < c.length && x >= 0 && x < c[0]!.length) c[y]![x] = k;
};
/** Put only where something is already drawn (ink on paper, never in the air). */
export const putOn = (c: Cv, x: number, y: number, k: string) => {
  x = Math.round(x);
  y = Math.round(y);
  if (c[y]?.[x] !== undefined && c[y]![x] !== ".") c[y]![x] = k;
};
export const get = (c: Cv, x: number, y: number) => c[Math.round(y)]?.[Math.round(x)] ?? ".";
export const fill = (c: Cv, fn: (x: number, y: number, k: string) => string | null) =>
  c.forEach((row, y) => row.forEach((k, x) => (row[x] = fn(x, y, k) ?? k)));
export const asPart = (c: Cv, outline = false): Part => ({ grid: c.map((r) => r.join("")), outline });
export const stamp = (c: Cv, x: number, y: number, rows: readonly string[]) =>
  rows.forEach((r, j) => [...r].forEach((k, i) => k !== "." && k !== " " && put(c, x + i, y + j, k)));

/** A small seeded hash in [0, 1). */
export function hash(a: number, b: number, s = 0): number {
  let h = Math.imul(a + 0x9e37, 0x85ebca6b) ^ Math.imul(b + 0x7f4a, 0xc2b2ae35) ^ Math.imul(s + 11, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** Is the pixel centre (x + 0.5, y + 0.5) inside the polygon? */
export function inPoly(pts: readonly Pt[]): (x: number, y: number) => boolean {
  return (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i]!;
      const [xj, yj] = pts[j]!;
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
}
/** A polygon's box, pixel-rounded. */
const boxOf = (pts: readonly Pt[]) => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [Math.floor(Math.min(...xs)) - 1, Math.floor(Math.min(...ys)) - 1, Math.ceil(Math.max(...xs)) + 1, Math.ceil(Math.max(...ys)) + 1] as const;
};
/**
 * A flat face of a fold: filled with `k`, its lit edges (the pixels with open space above or to the left) in `hi`, its
 * shaded edges (open below or to the right) in `lo`. `key` may instead be a function of the pixel (a gradient, a grain).
 */
export function face(c: Cv, pts: readonly Pt[], k: string | ((x: number, y: number) => string), o: { hi?: string; lo?: string } = {}) {
  const ins = inPoly(pts);
  const [x0, y0, x1, y1] = boxOf(pts);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (!ins(x, y)) continue;
      let key = typeof k === "string" ? k : k(x, y);
      if (o.lo && (!ins(x, y + 1) || !ins(x + 1, y))) key = o.lo;
      else if (o.hi && (!ins(x, y - 1) || !ins(x - 1, y))) key = o.hi;
      put(c, x, y, key);
    }
}
export function rect(c: Cv, x: number, y: number, w: number, h: number, k: string) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(c, x + i, y + j, k);
}
export function ellipse(c: Cv, cx: number, cy: number, rx: number, ry: number, k: string | ((x: number, y: number, d: number) => string | null)) {
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (d > 1) continue;
      const key = typeof k === "string" ? k : k(x, y, d);
      if (key) put(c, x, y, key);
    }
}

/** A plain 1-px line (Bresenham). */
export function line(c: Cv, x0: number, y0: number, x1: number, y1: number, k: string, only?: (x: number, y: number) => boolean) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    if (!only || only(x0, y0)) put(c, x0, y0, k);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) (err += dy), (x0 += sx);
    if (e2 <= dx) (err += dx), (y0 += sy);
  }
}

/**
 * The sketch line: a thin ink line from a to b drawn by hand. It wobbles a pixel now and then (seeded, so it stays put),
 * breaks once in a while (`gaps`: the chance a 3-px stretch is left out), overshoots its ends a hair, and can be drawn only
 * part of the way (`upTo`, 0 to 1: a line being written, its pen end a darker dot). `fade` picks the ink by how far along
 * the line a pixel is (a line fading out from its start).
 */
export function inkLine(c: Cv, a: Pt, b: Pt, k: string, o: { seed?: number; gaps?: number; upTo?: number; wobble?: number; pen?: string; over?: number } = {}) {
  const { seed = 1, gaps = 0, upTo = 1, wobble = 0.6, pen, over = 0 } = o;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const d: Pt = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  const n: Pt = [-d[1], d[0]];
  const steps = Math.ceil(len * 1.6);
  let last: [number, number] | null = null;
  const t0 = -over / len;
  const t1 = (1 + over / len) * upTo + t0 * (1 - upTo);
  for (let s = 0; s <= steps; s++) {
    const t = t0 + ((t1 - t0) * s) / steps;
    const along = t * len;
    const seg = Math.floor(along / 3);
    if (gaps > 0 && hash(seg, 7, seed) < gaps) continue;
    // A slow wobble: a value noise along the line, at most `wobble` px.
    const w0 = hash(Math.floor(along / 7), 3, seed) - 0.5;
    const w1 = hash(Math.floor(along / 7) + 1, 3, seed) - 0.5;
    const f = (along / 7) % 1;
    const wob = (w0 + (w1 - w0) * f) * 2 * wobble;
    const x = Math.round(a[0] + d[0] * along + n[0] * wob);
    const y = Math.round(a[1] + d[1] * along + n[1] * wob);
    if (last && last[0] === x && last[1] === y) continue;
    put(c, x, y, k);
    last = [x, y];
  }
  if (pen && upTo < 1 && last) put(c, last[0], last[1], pen);
}

/** An ink curve through points (a polyline of inkLines), drawn up to `upTo` of its whole length. */
export function inkPath(c: Cv, pts: readonly Pt[], k: string, o: { seed?: number; gaps?: number; upTo?: number; wobble?: number; pen?: string } = {}) {
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]));
  const total = lens.reduce((s, l) => s + l, 0) || 1;
  let want = (o.upTo ?? 1) * total;
  for (let i = 0; i < lens.length; i++) {
    if (want <= 0) break;
    const part = Math.min(1, want / lens[i]!);
    inkLine(c, pts[i]!, pts[i + 1]!, k, { ...o, seed: (o.seed ?? 1) + i * 13, upTo: part, pen: part < 1 ? o.pen : undefined });
    want -= lens[i]!;
  }
}

/**
 * One line of Folio's cursive, `len` px long: per step the stroke's lift off its line (0 on it, 1 a hump, 2 a loop's top),
 * or -1 for a blank between words. Words of 6 to 14 px: an entry stroke, rounded humps every 3 to 4 px (n, m, u), now and
 * then a tall loop (l, h), 2 or 3 px between words. No letters: it reads as handwriting, not as words.
 */
export function cursiveLifts(len: number, seed: number): number[] {
  const a: number[] = [];
  for (let n = 0; a.length < len; n++) {
    const wl = 6 + Math.floor(hash(n, 1, seed) * 9);
    const w: number[] = [0];
    for (let m = 0; w.length < wl; m++) {
      const r = hash(n * 17 + m, 2, seed);
      if (r < 0.16 && w.length > 1) w.push(1, 2, 2, 1, 0);
      else w.push(1, 1, 0, ...(r > 0.66 ? [0] : []));
    }
    a.push(...w, -1, -1, ...(hash(n, 4, seed) < 0.3 ? [-1] : []));
  }
  return a.slice(0, len);
}
/** Draws a line of cursive from (x0, y0) (its baseline) rightward, `len` px, in `k` (or a key per pixel); only on paper if `onPaper`. */
export function cursive(c: Cv, x0: number, y0: number, len: number, k: string | ((x: number, y: number) => string | null), seed: number, onPaper = true) {
  const lifts = cursiveLifts(len, seed);
  let prev = -1;
  lifts.forEach((lift, i) => {
    if (lift < 0) {
      prev = -1;
      return;
    }
    const x = x0 + i;
    const draw = (yy: number) => {
      const key = typeof k === "string" ? k : k(x, yy);
      if (!key) return;
      if (onPaper) putOn(c, x, yy, key);
      else put(c, x, yy, key);
    };
    draw(y0 - lift);
    if (prev >= 0 && Math.abs(lift - prev) > 1) draw(y0 - Math.min(lift, prev) - 1);
    prev = lift;
  });
}
/** A short paragraph of cursive on a face: `lines` lines `gap` px apart, each a little shorter or longer, centred in [x0, x1]. */
export function paragraph(c: Cv, x0: number, x1: number, y0: number, lines: number, gap: number, k: string | ((x: number, y: number) => string | null), seed: number, inside?: (x: number, y: number) => boolean) {
  for (let li = 0; li < lines; li++) {
    const shrink = Math.floor(hash(li, 9, seed) * 6);
    const len = Math.max(4, x1 - x0 - shrink - (li === lines - 1 ? Math.floor((x1 - x0) / 3) : 0));
    const key = inside ? (x: number, y: number) => (inside(x, y) ? (typeof k === "string" ? k : k(x, y)) : null) : k;
    cursive(c, x0 + (li % 2), y0 + li * gap, len, key, seed + li * 31);
  }
}

/** Gilt along a cut edge from a to b: gold, a glint every so often. */
export function gilt(c: Cv, a: Pt, b: Pt, o: { glint?: number; deep?: boolean } = {}) {
  const len = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])));
  for (let s = 0; s <= len; s++) {
    const x = a[0] + ((b[0] - a[0]) * s) / len;
    const y = a[1] + ((b[1] - a[1]) * s) / len;
    put(c, x, y, o.glint !== undefined && Math.abs(s - o.glint * len) < 0.6 ? "H" : o.deep ? "o" : "G");
  }
}

/** Folio's seal: a vermilion stamp turned a hair, as pressed by hand, the paper pawn knocked out in it (6 x 6; small, 4 x 4). */
export const SEAL = [".vvvvv", "vvvBvv", "vvvBvv", "vvBBBv", "vvvvvw", "vvvww."];
export const SEAL_SMALL = ["vvvv", "vBBv", "vvvw", ".ww."];
export const seal = (c: Cv, x: number, y: number, small = false) => stamp(c, x, y, small ? SEAL_SMALL : SEAL);

/** A tiny paper crane, 7 x 5, in a tissue color (`lit`, `deep`), facing right or left: a V of wings, a neck, a gold beak. */
export function tinyCrane(c: Cv, x: number, y: number, lit: string, deep: string, left = false, wings: 0 | 1 = 0) {
  const R = wings
    ? ["..L....", ".LL..H.", "DLLLLG.", ".DDD...", "......."] // wings down a hair
    : ["L......", "LL...H.", "DLLLLG.", ".DDD...", "......."];
  R.forEach((row, j) =>
    [...row].forEach((k, i) => {
      if (k === ".") return;
      const key = k === "L" ? lit : k === "D" ? deep : k === "H" ? lit : "G";
      put(c, left ? x + 6 - i : x + i, y + j, key);
    }),
  );
}

/** A canvas cropped to what's drawn on it: its grid and where it sat. Null when empty. */
export function crop(c: Cv): { grid: string[]; at: Pt } | null {
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
  return { grid: c.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1).join("")), at: [x0, y0] };
}

/** A soft ground shadow (an ellipse, its rim lighter). */
export function shadow(c: Cv, cx: number, cy: number, rx: number, ry: number) {
  ellipse(c, cx, cy, rx, ry, (_x, _y, d) => (d < 0.55 ? "-" : "+"));
}
