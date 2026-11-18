/**
 * Copied as drawn from the art branch `claude/boss-art` (scripts/boss-art/out/zebra-props/zebra-dough.ts, Nov 11, 2026; Eric approved the
 * art Nov 11: "Art looks great"); only the import path changed and the animations are made on first use (lazyAnim), each part
 * painted the first time a frame needs it.
 *
 * Don Dough's Rising Dough (Eric's design, Nov 11; drawn by hand on the weekly plan usage): he tosses lumps of raw dough onto
 * the board; each is shaped like the piece it will become; if you don't squash it in time it rises and bakes into his piece.
 *
 * 1. ZEBRA_DOUGH (32 x 32, a board square's effect frame, as characters/effects/common.ts SQUARE; foot [16, 31], the base at
 *    the square's bottom middle). For each kind `k` of p, n, b, r, q:
 *    - `k` (loops, 4 x 320 ms): the lump sitting on its square, proofing (a slow breath, a px), shaped roughly like that piece.
 *    - `kRise` (once, 8 frames, about 0.9 s): it swells, browns to a golden crust, and pops in a burst of flour (cue `rise` f0,
 *      `pop` f4); the burst thins to nothing so his real piece (drawn by the board under it from the pop on) shows through.
 *    - `kSquash` (once, 6 frames, about 0.6 s): flattened to a pancake as your piece lands on it, a splat and a puff of flour
 *      round your piece (cue `squash` f0), the pancake fading out. Your piece is drawn by the board on top.
 *    - `land` (once, 4 frames, 0.3 s): a plain lump dropping onto the square from above and plopping down (cue `plop` f2);
 *      then show the kind's own `k`.
 * 2. ZEBRA_TIMER (38 x 22, foot [19, 20]): the oven timer on his side, one per dough on the board: a white kitchen timer with
 *    a red button, the dough's kind printed on its left, an LCD showing MM:00 (minutes are moves: one off for every move, yours
 *    and his). The last minute's digits are red.
 *    - `kNN` (NN 00 to TIMER_MAX, 30: room for any doughTimers setting; Nov 12, was 15): still, showing NN:00.
 *    - `kRollNN` (NN 01 to TIMER_MAX, once, 7 frames, about 0.25 s): the drop from NN:00 to (NN-1):00: the minute goes and the seconds
 *      race 59 to 00 in a blink, "all of a sudden a minute passed" (cue `roll` f0). It ends on k(NN-1).
 *    - `kDing` (once, 6 frames, about 0.8 s): at 00:00, the LCD flashes and it rings, bell lines off its top, a jiggle (cue
 *      `ding` f0). Then play the dough's `kRise`.
 * Sizes: the dough is a board square's effect, drawn at the board's square size. The timer: 2x on a phone (76 x 44 CSS px),
 * 3x on a computer (114 x 66), stacked down his side, the newest at the bottom.
 */
import type { Anim, Character, Frame, Layer, Part, Speck } from "./sprite.ts";
import { lazyAnim } from "./sprite.ts";

type Pt = readonly [number, number];
export type Kind = "p" | "n" | "b" | "r" | "q";
export const KINDS: readonly Kind[] = ["p", "n", "b", "r", "q"];
const S = 32;

const PALETTE: Record<string, string> = {
  k: "#5a3818", // outline: a warm brown, soft for dough
  w: "#fff6e0", // raw dough: lit, light, mid, shade
  l: "#f4e2b8",
  m: "#e6cb92",
  d: "#c9a466",
  f: "#ffffff", // flour, and its haze
  h: "#efe8d8",
  H: "#d9cdb0",
  "0": "#f0b45a", // baked crust: lit, light, mid, deep (the bread rifle's)
  "9": "#d68a35",
  "8": "#ab5f1d",
  "7": "#7a3f12",
  "*": "#fffbe8", // the pop's heart
  "-": "#0d0e1260", // shadow on the square
  // The timer.
  T: "#f4f2ec", // its white plastic: light, shade, deep
  U: "#d5d2c8",
  V: "#a9a59a",
  R: "#d23a2c", // the button: red, its shade
  Q: "#8e2018",
  L: "#a9bf9e", // the LCD: its green-grey ground, shade; the digits; the digits' ghost; the last minute's red
  M: "#869a7c",
  D: "#1d2a22",
  G: "#9aae90",
  E: "#b0281c",
  I: "#3a2a1a", // the printed kind
  Y: "#ffd23a", // the ding's bell lines
};

// ---- A small canvas.

type Cv = string[][];
const cv = (w = S, h = S): Cv => Array.from({ length: h }, () => Array<string>(w).fill("."));
const put = (c: Cv, x: number, y: number, k: string) => {
  x = Math.round(x);
  y = Math.round(y);
  if (y >= 0 && y < c.length && x >= 0 && x < c[0]!.length) c[y]![x] = k;
};
const at = (c: Cv, x: number, y: number) => c[y]?.[x] ?? ".";
function hash(x: number, y: number, seed = 1): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function blob(c: Cv, cx: number, cy: number, rx: number, ry: number, k = "m"): void {
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) put(c, x, y, k);
    }
}
function poly(c: Cv, pts: readonly Pt[], k = "m"): void {
  const ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    const yy = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % pts.length]!;
      if ((a[1] <= yy && b[1] > yy) || (b[1] <= yy && a[1] > yy)) xs.push(a[0] + ((yy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.round(xs[i]!); x < Math.round(xs[i + 1]!); x++) put(c, x, y, k);
  }
}
/** Shades a filled shape (every "m" pixel) as soft dough lit from the top left: lit edges, shaded edges, a flour dusting. */
function shade(c: Cv, ramp = "wlmd", flour = true, seed = 1): void {
  const src = c.map((r) => r.slice());
  const f = (x: number, y: number) => src[y]?.[x] !== undefined && src[y]![x] !== ".";
  for (let y = 0; y < c.length; y++)
    for (let x = 0; x < c[0]!.length; x++) {
      if (!f(x, y)) continue;
      const tl = !f(x - 1, y) || !f(x, y - 1);
      const tl2 = !f(x - 2, y) || !f(x, y - 2);
      const br = !f(x + 1, y) || !f(x, y + 1);
      const br2 = !f(x + 2, y) || !f(x, y + 2) || !f(x + 1, y + 1);
      let k = ramp[2]!;
      if (tl) k = ramp[0]!;
      else if (tl2) k = ramp[1]!;
      if (br) k = ramp[3]!;
      else if (br2 && !tl && !tl2 && hash(x, y, seed) < 0.5) k = ramp[3]!;
      if (flour && (tl || tl2) && hash(x, y, seed + 7) < 0.18) k = "f";
      c[y]![x] = k;
    }
}

/**
 * A lump of dough shaped like piece `k`, its base on the square's bottom (y 27), `p`: how much it has risen (0 raw, 1 a breath,
 * up to 5 nearly baked: bigger and rounder).
 */
function doughShape(c: Cv, k: Kind, p: number): void {
  const s = 1 + p * 0.06;
  const B = 27;
  const X = 16;
  // The base: a soft round foot.
  blob(c, X, B - 2, 7.5 * s, 3.4 * s);
  const up = (y: number) => B - (B - y) * s;
  switch (k) {
    case "p":
      blob(c, X, up(20.5), 4.6 * s, 4.4 * s);
      blob(c, X, up(13.5), 4 * s, 3.8 * s);
      break;
    case "b":
      blob(c, X, up(18), 4.4 * s, 6.5 * s);
      blob(c, X, up(10.2), 3.2 * s, 3.2 * s);
      blob(c, X, up(7.4), 1.5 * s, 1.5 * s);
      break;
    case "r":
      poly(c, [[X - 5.6 * s, B - 1], [X + 5.6 * s, B - 1], [X + 5.2 * s, up(12)], [X - 5.2 * s, up(12)]]);
      for (const ox of [-4.2, 0, 4.2]) blob(c, X + ox * s, up(11), 2.1 * s, 2.3 * s);
      break;
    case "n":
      // A horse's head on a neck, looking left: a lump of a neck, the head, the snout, an ear.
      poly(c, [[X - 5 * s, B - 1], [X + 5.6 * s, B - 1], [X + 5 * s, up(13)], [X + 1, up(9)], [X - 3 * s, up(15)]]);
      blob(c, X - 1.2 * s, up(11), 5.2 * s, 3.6 * s);
      blob(c, X - 5.2 * s, up(12.4), 2.6 * s, 2.3 * s);
      blob(c, X + 2.6 * s, up(8), 1.5 * s, 2 * s);
      break;
    case "q":
      blob(c, X, up(19), 3.8 * s, 5.4 * s);
      blob(c, X, up(13), 4.6 * s, 1.6 * s);
      // The crown's points: five little balls fanning up and out, the middle highest, gaps between.
      for (const [ox, oy] of [[-4.6, 9.6], [-2.3, 7.6], [0, 6.4], [2.3, 7.6], [4.6, 9.6]] as const) {
        poly(c, [[X + ox * 0.55 * s - 0.8, up(12.5)], [X + ox * 0.55 * s + 0.8, up(12.5)], [X + ox * s + 0.4, up(oy + 1)], [X + ox * s - 0.4, up(oy + 1)]]);
        blob(c, X + ox * s, up(oy), 1.3 * s, 1.3 * s);
      }
      break;
  }
}
/** Small marks that make each lump read as its piece at square size (a bishop's slit, a knight's eye and mane line). */
function doughMarks(c: Cv, k: Kind, p: number): void {
  const s = 1 + p * 0.06;
  const up = (y: number) => 27 - (27 - y) * s;
  if (k === "b") for (let i = 0; i < 3; i++) put(c, 17 + i * 0.6, up(8.5) + i, "d");
  if (k === "n") put(c, 13, up(10), "k"), put(c, 18, up(12), "d"), put(c, 18, up(14), "d"), put(c, 19, up(16), "d");
  if (k === "r") for (const x of [13, 18]) put(c, x, up(10.5), "."), put(c, x, up(9.5), ".");
  if (k === "p") for (let x = 13; x <= 19; x++) if (at(c, x, Math.round(up(17))) !== ".") put(c, x, up(17), "d"); // the collar
}

// ---- The parts.

const PARTS: Record<string, Part> = {};
const L = (part: string, x = 0, y = 0): Layer => ({ part, x, y });
function addPart(name: string, c: Cv, outline = true): string {
  PARTS[name] = { grid: c.map((r) => r.join("")), outline };
  return name;
}
const shadow = (w: number): string => {
  const name = `shadow${w}`;
  if (PARTS[name]) return name;
  const c = cv();
  for (let x = Math.round(16 - w); x <= Math.round(16 + w); x++) put(c, x, 28, "-");
  return addPart(name, c, false);
};
function lump(k: Kind, p: number, crust = 0): string {
  const name = `${k}:${p}:${crust}`;
  if (PARTS[name]) return name;
  const c = cv();
  doughShape(c, k, p);
  // Browning: 0 raw, 1 lightly golden, 2 a golden crust.
  shade(c, crust === 0 ? "wlmd" : crust === 1 ? "lm9d" : "0998", crust < 2, k.charCodeAt(0));
  if (crust < 2) doughMarks(c, k, p);
  return addPart(name, c);
}

/** A ring of flour bursting out (`t` 0 the pop, 1-3 thinning), round (16, y). */
function flourBurst(t: number, y = 18, R = 12): Speck[] {
  const out: Speck[] = [];
  for (let yy = 1; yy < S - 1; yy++)
    for (let x = 1; x < S - 1; x++) {
      const d = Math.hypot(x + 0.5 - 16, (yy + 0.5 - y) * 1.15);
      const r = R * [0.55, 0.8, 0.95, 1.05][t]!;
      if (t === 0 && d < 4.5) out.push([x, yy, d < 2.5 ? "*" : "f"]);
      else if (d < r && d > r * [0.0, 0.35, 0.55, 0.75][t]!) {
        if (hash(x, yy, t + 2) < [0.9, 0.6, 0.35, 0.15][t]!) out.push([x, yy, d > r - 1.5 ? "H" : hash(x, yy, 4) < 0.5 ? "f" : "h"]);
      }
    }
  return out;
}

const dough: Record<string, Anim> = {};
for (const k of KINDS) {
  dough[k] = lazyAnim(() => ({
    loop: true,
    frames: [0, 0.6, 1, 0.6].map((p) => ({ ms: 320, layers: [L(shadow(8)), L(lump(k, p))] })),
  }));
  dough[`${k}Rise`] = lazyAnim(() => ({
    loop: false,
    frames: [
      { ms: 110, layers: [L(shadow(8)), L(lump(k, 1.4))], cue: "rise" },
      { ms: 110, layers: [L(shadow(9)), L(lump(k, 2, 1))] },
      { ms: 110, layers: [L(shadow(9)), L(lump(k, 2.6, 1))] },
      { ms: 140, layers: [L(shadow(10)), L(lump(k, 2.8, 2))] },
      { ms: 90, layers: [], specks: flourBurst(0), cue: "pop" },
      { ms: 100, layers: [], specks: flourBurst(1) },
      { ms: 110, layers: [], specks: flourBurst(2) },
      { ms: 120, layers: [], specks: flourBurst(3) },
    ],
  }));
  // Squashed: the lump pressed flat (rows kept from its bottom), then a pancake with splats, a puff of flour round the piece.
  const squashed = (f: number): string => {
    const name = `${k}:sq${f}`;
    if (PARTS[name]) return name;
    const c = cv();
    if (f === 0) {
      blob(c, 16, 24.5, 10, 3.8);
      blob(c, 16, 21.5, 6, 2.8);
    } else {
      blob(c, 16, 26, 12.5 - (f > 2 ? 1 : 0), 2.6);
      if (f <= 2) for (const [x, y, r] of [[3.5, 23.5, 1.5], [28, 24, 1.3], [6, 21, 1], [26, 20.5, 0.9]] as const) blob(c, x, y, r, r);
    }
    shade(c, f >= 3 ? "lmdd" : "wlmd", true, 5 + f);
    return addPart(name, c);
  };
  dough[`${k}Squash`] = lazyAnim(() => ({
    loop: false,
    frames: [
      { ms: 70, layers: [L(squashed(0))], cue: "squash", specks: flourBurst(0, 24, 9) },
      { ms: 90, layers: [L(squashed(1))], specks: flourBurst(1, 22, 13) },
      { ms: 100, layers: [L(squashed(2))], specks: flourBurst(2, 22, 13) },
      { ms: 120, layers: [L(squashed(3))], specks: flourBurst(3, 22, 13) },
      { ms: 140, layers: [L(squashed(4))] },
      { ms: 80, layers: [] },
    ],
  }));
}
{
  // The toss landing: a plain round lump drops in, stretches, plops flat, settles.
  const ball = (name: string, cy: number, rx: number, ry: number) => {
    if (PARTS[name]) return name;
    const c = cv();
    blob(c, 16, cy, rx, ry);
    shade(c);
    return addPart(name, c);
  };
  dough.land = lazyAnim(() => ({
    loop: false,
    frames: [
      { ms: 60, layers: [L(ball("fall0", 6, 3.6, 3.6))] },
      { ms: 60, layers: [L(shadow(5)), L(ball("fall1", 16, 3, 4.6))] },
      { ms: 90, layers: [L(shadow(9)), L(ball("plop", 25, 7.5, 2.8))], cue: "plop", specks: flourBurst(3, 25, 8) },
      { ms: 90, layers: [L(shadow(8)), L(ball("settle", 23, 5.6, 4.2))] },
    ],
  }));
}

export const ZEBRA_DOUGH: Character = {
  id: "zebra-dough",
  name: "Don Dough's rising dough",
  w: S,
  h: S,
  foot: [16, 31],
  palette: PALETTE,
  parts: PARTS,
  anims: dough,
};

// ================================================================================================================
// 2. The oven timer.

const TW = 38;
const TH = 22;
/** Seven segments, 3 x 5: which are lit for each digit (a top, b top right, c bottom right, d bottom, e bottom left, f top left, g middle). */
const SEG: Record<string, string> = { "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg" };
function digit(c: Cv, x: number, y: number, ch: string, ink: string, ghost: string): void {
  const on = SEG[ch] ?? "";
  const cells: Record<string, Pt[]> = {
    a: [[0, 0], [1, 0], [2, 0]],
    b: [[2, 0], [2, 1], [2, 2]],
    c: [[2, 2], [2, 3], [2, 4]],
    d: [[0, 4], [1, 4], [2, 4]],
    e: [[0, 2], [0, 3], [0, 4]],
    f: [[0, 0], [0, 1], [0, 2]],
    g: [[0, 2], [1, 2], [2, 2]],
  };
  // The unlit segments show faintly, as on a real LCD; then the lit ones over them.
  for (const s of "abcdefg") for (const [i, j] of cells[s]!) put(c, x + i, y + j, ghost);
  for (const s of on) for (const [i, j] of cells[s]!) put(c, x + i, y + j, ink);
}
const ICON: Record<Kind, string[]> = {
  p: [".....", "..I..", ".III.", "..I..", ".III.", "IIIII"],
  n: [".II..", "IIII.", "I.II.", "..II.", ".III.", "IIIII"],
  b: ["..I..", ".III.", ".I.I.", ".III.", "..I..", "IIIII"],
  r: ["I.I.I", "IIIII", ".III.", ".III.", ".III.", "IIIII"],
  q: [".I.I.", "I.I.I", ".III.", "..I..", ".III.", "IIIII"],
};
/** The timer's body (shared), and an LCD for a reading: minutes, seconds; `flash`: inverted (the ding). */
function timerBody(k: Kind): string {
  const name = `timer:${k}`;
  if (PARTS[name]) return name;
  const c = cv(TW, TH);
  // The button on top.
  for (let x = 14; x <= 19; x++) put(c, x, 1, x > 17 ? "Q" : "R"), put(c, x, 2, "Q");
  // The body: a rounded white box, lit top left.
  for (let y = 3; y <= 18; y++)
    for (let x = 1; x <= 32; x++) {
      const corner = (x <= 1 || x >= 32) && (y <= 3 || y >= 18);
      if (corner) continue;
      put(c, x, y, y >= 17 || x >= 31 ? "V" : "T");
    }
  for (let x = 2; x <= 31; x++) put(c, x, 17, "U");
  // The kind, printed on its left.
  ICON[k].forEach((row, j) => [...row].forEach((ch, i) => ch === "I" && put(c, 3 + i, 7 + j, "I")));
  return addPart(name, c);
}
function lcd(mm: number, ss: number, flash = false): string {
  const name = `lcd:${mm}:${ss}:${flash ? 1 : 0}`;
  if (PARTS[name]) return name;
  const c = cv(TW, TH);
  const bg = flash ? "D" : "L";
  for (let y = 5; y <= 14; y++) for (let x = 10; x <= 30; x++) put(c, x, y, y === 5 || x === 10 ? "M" : bg);
  const ink = flash ? "L" : mm <= 1 && mm + ss > 0 ? "E" : "D";
  const ghost = flash ? "D" : "G";
  const t = `${String(mm).padStart(2, "0")}${String(ss).padStart(2, "0")}`;
  digit(c, 12, 7, t[0]!, ink, ghost);
  digit(c, 16, 7, t[1]!, ink, ghost);
  put(c, 20, 8, ink);
  put(c, 20, 10, ink);
  digit(c, 22, 7, t[2]!, ink, ghost);
  digit(c, 26, 7, t[3]!, ink, ghost);
  return addPart(name, c, false);
}
const timer: Record<string, Anim> = {};
const nn = (n: number) => String(n).padStart(2, "0");
/** The highest minute the timer has frames for (each made only when first drawn): above every doughTimers value. */
export const TIMER_MAX = 30;
for (const k of KINDS) {
  // (Its body, painted the first time a frame needs it.)
  const body = () => timerBody(k);
  for (let m = 0; m <= TIMER_MAX; m++) timer[`${k}${nn(m)}`] = lazyAnim(() => ({ loop: false, frames: [{ ms: 1000, layers: [L(body(), 2, 1), L(lcd(m, 0), 2, 1)] }] }));
  for (let m = 1; m <= TIMER_MAX; m++)
    timer[`${k}Roll${nn(m)}`] = lazyAnim(() => ({
      loop: false,
      frames: [
        { ms: 40, layers: [L(body(), 2, 1), L(lcd(m - 1, 59), 2, 1)], cue: "roll" },
        ...[47, 36, 24, 13, 5].map((s) => ({ ms: 30, layers: [L(body(), 2, 1), L(lcd(m - 1, s), 2, 1)] })),
        { ms: 60, layers: [L(body(), 2, 1), L(lcd(m - 1, 0), 2, 1)] },
      ],
    }));
  const bell = (t: number): Speck[] => {
    const o = t % 2;
    return [
      [13 - o, 2, "Y"], [12 - o, 1, "Y"], [14 - o, 3, "Y"],
      [24 + o, 2, "Y"], [25 + o, 1, "Y"], [23 + o, 3, "Y"],
      [10 - o, 5, "Y"], [9 - o, 5, "Y"], [28 + o, 5, "Y"], [29 + o, 5, "Y"],
    ];
  };
  timer[`${k}Ding`] = lazyAnim(() => ({
    loop: false,
    frames: [0, 1, 2, 3, 4, 5].map((t): Frame => ({
      ms: t === 5 ? 200 : 120,
      layers: [L(body(), t === 5 ? 2 : t % 2 ? 3 : 1, 1), L(lcd(0, 0, t % 2 === 0 && t < 5), t === 5 ? 2 : t % 2 ? 3 : 1, 1)],
      ...(t < 5 ? { specks: bell(t) } : {}),
      ...(t === 0 ? { cue: "ding" } : {}),
    })),
  }));
}
export const ZEBRA_TIMER: Character = {
  id: "zebra-timer",
  name: "Don Dough's oven timer",
  w: TW,
  h: TH,
  foot: [19, 20],
  palette: PALETTE,
  parts: PARTS,
  anims: timer,
};
