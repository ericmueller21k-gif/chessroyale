/**
 * Inside Birdie's station, second pass (Eric, Nov 23): a 12 x 12 lobby. The back wall keeps the split-flap board (pictures
 * only), the arched windows onto the tracks with Birdie's yellow train passing, the airport seats, lamps and plants. New: a
 * separate U-shaped bar on the east side (stools outside it, little birds on three of them, the bartender's clear place inside
 * the U), the challenge table in the middle (a plain square table with a white top, a stool left and right), and the railroad
 * crossing as a strip of road with real rails and ties, its two gates kitty-corner (different rows, opposite sides).
 *
 * The room's own camera is the game's (SHOP_BIRDIE_CAM); the `idle` here is a flat three-quarter plan for review: floor tiles
 * flat, everything upright standing on its square (each piece's `at` is its picture's top-left from its footprint's south-west
 * floor corner), the side walls drawn as cut-away caps.
 */
import { frameKeys, type Anim, type Character, type Frame, type Grid, type Layer, type Part } from "../../../../packages/app/src/characters/sprite.ts";
import { canvas, ellipse, poly, shade, roundLight, inEllipse, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";

export const SHOP_BIRDIE_N = 12;
export const SHOP_BIRDIE_WALL_H = 120;
const SQ = 37;
const WALL_H = SHOP_BIRDIE_WALL_H;
const OY = WALL_H - SQ;
const M = 2;
const FW = SHOP_BIRDIE_N * SQ + 2 * M;
const FH = SHOP_BIRDIE_N * SQ + OY + 2 * M;

export interface ShopPlace {
  piece: string;
  col: number;
  row: number;
  w?: number;
  d?: number;
  /** Floor tiles: quarter turns clockwise. Upright pieces: 2 = turned to face the other way (drawn mirrored). */
  rot?: 0 | 1 | 2 | 3;
  exit?: boolean;
  solid?: boolean;
}

const PALETTE: Record<string, string> = {
  k: "#1a1714", K: "#121315",
  Y: "#f4c430", y: "#d9a21b", u: "#ffe27a",
  C: "#2b2d31", c: "#3a3d44", g: "#54575f",
  R: "#c8372d", r: "#8e1f1a",
  W: "#a86a3c", w: "#7a4a26", o: "#c99866",
  m: "#f3f1ec", M: "#ffffff", n: "#ddd6c6", N: "#bfb3a0",
  t: "#b5643a", T: "#8a4628", O: "#d4885a",
  l: "#ffe2a0", L: "#ffb85c",
  s: "#a9d4ea", S: "#dff1f8", d: "#9db4a0", D: "#7f948a",
  i: "#bfe0ea", I: "#fbfdff",
  a: "#c9a13b", A: "#f0d27a", Z: "#8c6c22",
  b: "#8f9db3", B: "#c2ccd9", V: "#ece9e0",
  p: "#8a5a34", P: "#b98a5a",
  e: "#4f7a3a", E: "#6f9a4f", h: "#2f4f25",
  f: "#ece5d7", F: "#e2d8c5", z: "#cdc1ab", X: "#a8977f", H: "#d9a878", U: "#8f9aa0",
  j: "#9aa3ad", J: "#d4dae0",
  "1": "#ff4f3c", "2": "#5c1c18", "3": "#ffc2b0",
  q: "#2f9a5a",
  "~": "#ffe2a03c", "^": "#ffc8703a", "=": "#fff6d85a",
};

// ---------- small painting helpers ----------
const set = (cv: Canvas, x: number, y: number, k: string) => {
  if (y >= 0 && y < cv.length && x >= 0 && x < cv[0]!.length) cv[y]![x] = k;
};
const get = (cv: Canvas, x: number, y: number) => cv[y]?.[x] ?? ".";
const rect = (cv: Canvas, x: number, y: number, w: number, h: number, k: string) => {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(cv, i, j, k);
};
const rnd = (x: number, y: number, s: number) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
const cell = (g: Grid, i: number, j: number) => (j >= 0 && j < g.length && i >= 0 ? (g[j]![i] ?? ".") : ".");
/** Pastes a grid; with `outline`, rings it in k first (only where `clip` allows). */
function stamp(cv: Canvas, g: Grid, x0: number, y0: number, outline = false, clip: (x: number, y: number) => boolean = () => true) {
  const H = g.length;
  const W = Math.max(...g.map((r) => r.length));
  const full = (i: number, j: number) => cell(g, i, j) !== "." && cell(g, i, j) !== " ";
  if (outline)
    for (let j = -1; j <= H; j++)
      for (let i = -1; i <= W; i++)
        if (!full(i, j) && (full(i + 1, j) || full(i - 1, j) || full(i, j + 1) || full(i, j - 1)) && clip(x0 + i, y0 + j)) set(cv, x0 + i, y0 + j, "k");
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (full(i, j) && clip(x0 + i, y0 + j)) set(cv, x0 + i, y0 + j, cell(g, i, j));
}
const mirror = (g: Grid): Grid => g.map((r) => [...r].reverse().join(""));

const P: Record<string, Part> = {};
const add = (name: string, cv: Canvas | Grid, outline = true): string => {
  P[name] = { grid: typeof cv[0] === "string" ? (cv as Grid) : toGrid(cv as Canvas), outline };
  return name;
};
/** Flattens layers of parts (each outlined as a frame draws it) into one grid. */
function bake(w: number, h: number, layers: Layer[]): Grid {
  const ch = { id: "bake", name: "bake", w, h, foot: [0, 0], palette: { k: "#000000" }, parts: P, anims: {} } as unknown as Character;
  return frameKeys(ch, { layers, ms: 0 }).map((r) => r.map((c) => c ?? ".").join(""));
}

// ---------- floor ----------
function terrazzo(base: string, seed: number): Canvas {
  const cv = canvas(SQ, SQ);
  rect(cv, 0, 0, SQ, SQ, base);
  for (let y = 1; y < SQ - 1; y++)
    for (let x = 1; x < SQ - 1; x++) {
      const r = rnd(x, y, seed);
      if (r < 0.03) cv[y]![x] = "X";
      else if (r < 0.055) cv[y]![x] = "H";
      else if (r < 0.068) cv[y]![x] = "U";
      else if (r < 0.1) cv[y]![x] = base === "f" ? "F" : "f";
    }
  for (let n = 0; n < 5; n++) {
    const x = 3 + Math.floor(rnd(n, 1, seed + 7) * 30);
    const y = 3 + Math.floor(rnd(n, 2, seed + 7) * 30);
    const k = "XHUXH"[n]!;
    set(cv, x, y, k); set(cv, x + 1, y, k); set(cv, x, y + 1, k);
  }
  rect(cv, 0, 0, SQ, 1, "z"); rect(cv, 0, SQ - 1, SQ, 1, "z"); rect(cv, 0, 0, 1, SQ, "z"); rect(cv, SQ - 1, 0, 1, SQ, "z");
  return cv;
}
const stripeV = (cv: Canvas, y0: number, y1: number) => { rect(cv, 3, y0, 5, y1 - y0, "Y"); rect(cv, 3, y0, 1, y1 - y0, "u"); rect(cv, 7, y0, 1, y1 - y0, "y"); };
add("floor-a", terrazzo("f", 1), false);
add("floor-b", terrazzo("F", 2), false);
{ const cv = terrazzo("f", 3); stripeV(cv, 0, SQ); add("floor-edge", cv, false); }
{ const cv = terrazzo("f", 4); stripeV(cv, 0, 34); rect(cv, 3, 29, 34, 5, "Y"); rect(cv, 4, 29, 33, 1, "u"); rect(cv, 3, 33, 34, 1, "y"); add("floor-edge-corner", cv, false); }
{ // the door mat, running on into the next tile (which is this one turned round)
  const cv = terrazzo("f", 5);
  rect(cv, 3, 3, 34, 31, "C"); rect(cv, 4, 4, 33, 29, "c");
  for (let y = 6; y < 32; y += 3) rect(cv, 5, y, 32, 1, "g");
  rect(cv, 3, 3, 34, 1, "Y"); rect(cv, 3, 33, 34, 1, "Y"); rect(cv, 3, 3, 1, 31, "Y");
  add("floor-door", cv, false);
}
function road(seed: number): Canvas {
  const cv = canvas(SQ, SQ);
  rect(cv, 0, 0, SQ, SQ, "c");
  for (let y = 0; y < SQ; y++) for (let x = 0; x < SQ; x++) { const r = rnd(x, y, seed); if (r < 0.07) cv[y]![x] = "g"; else if (r < 0.13) cv[y]![x] = "C"; }
  for (let y = 0; y < SQ; y++) for (let x = 0; x < 5; x++) cv[y]![x] = Math.floor((x + y) / 4) % 2 ? "Y" : "C";
  rect(cv, 5, 0, 1, SQ, "K");
  return cv;
}
const segDist = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const vx = bx - ax, vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - ax - t * vx, py - ay - t * vy);
};
{ // half of a painted crossbuck, its middle on the tile's east edge (the other half is this tile turned round)
  const cv = road(6);
  for (let y = 0; y < SQ; y++)
    for (let x = 6; x < SQ; x++) {
      const px = x + 0.5, py = y + 0.5;
      const d = Math.min(segDist(px, py, 37, 18.5, 19, 5), segDist(px, py, 37, 18.5, 19, 32));
      if (d <= 2.2) cv[y]![x] = "M"; else if (d <= 3.3) cv[y]![x] = "R";
    }
  add("road-x", cv, false);
}
function rails(cv: Canvas, onRoad: boolean) {
  const x0 = onRoad ? 6 : 0;
  for (const tx of [1, 7, 13, 19, 25, 31]) {
    if (tx + 2 < x0) continue;
    rect(cv, Math.max(tx, x0), 6, 3 - Math.max(0, x0 - tx), 26, "w");
    rect(cv, Math.max(tx, x0), 6, 1, 26, "W");
  }
  for (const ry of [11, 25]) {
    if (onRoad) { rect(cv, x0, ry - 1, SQ - x0, 1, "K"); rect(cv, x0, ry + 2, SQ - x0, 1, "K"); }
    rect(cv, x0, ry, SQ - x0, 1, "J"); rect(cv, x0, ry + 1, SQ - x0, 1, "j");
  }
}
{ const cv = road(7); rails(cv, true); add("road-track", cv, false); }
function ballast(seed: number, x1 = SQ): Canvas {
  const cv = terrazzo("f", seed);
  for (let y = 4; y < 34; y++) for (let x = 0; x < x1; x++) { const r = rnd(x, y, seed + 40); cv[y]![x] = r < 0.3 ? "N" : r < 0.55 ? "g" : r < 0.75 ? "U" : "c"; }
  return cv;
}
{ const cv = ballast(8); rails(cv, false); add("track", cv, false); }
{ // the track's end: the rails stop at a striped buffer
  const cv = ballast(9, 30);
  rails(cv, false);
  for (let y = 4; y < 34; y++) for (let x = 24; x < SQ; x++) if (x >= 30 || y < 6 || y > 31 || x > 23) cv[y]![x] = x >= 30 ? (rnd(x, y, 9) < 0.1 ? "X" : "f") : cv[y]![x]!;
  rect(cv, 24, 6, 6, 26, "C");
  for (let y = 7; y < 31; y++) for (let x = 25; x < 29; x++) cv[y]![x] = Math.floor((y + x) / 3) % 2 ? "M" : "R";
  rect(cv, 30, 0, 7, SQ, "f"); rect(cv, 36, 0, 1, SQ, "z"); rect(cv, 0, 0, SQ, 1, "z"); rect(cv, 0, 36, SQ, 1, "z");
  add("track-end", cv, false);
}

// ---------- back wall ----------
function wallBase(w: number): Canvas {
  const cv = canvas(w, WALL_H);
  rect(cv, 0, 0, w, WALL_H, "m");
  for (let y = 6; y < 76; y++) for (let x = 0; x < w; x++) if (rnd(x, y, 11) < 0.025) cv[y]![x] = "n";
  rect(cv, 0, 0, w, 3, "o"); rect(cv, 0, 3, w, 1, "w"); rect(cv, 0, 4, w, 2, "n");
  rect(cv, 0, 76, w, 1, "n"); rect(cv, 0, 77, w, 3, "R"); rect(cv, 0, 80, w, 1, "r");
  rect(cv, 0, 81, w, 34, "c"); rect(cv, 0, 81, w, 1, "g"); rect(cv, 0, 97, w, 1, "C"); rect(cv, 0, 98, w, 1, "g");
  for (let x = 18; x < w; x += SQ) { rect(cv, x, 83, 1, 13, "C"); rect(cv, x, 100, 1, 14, "C"); }
  rect(cv, 0, 115, w, 5, "C"); rect(cv, 0, 115, w, 1, "g");
  return cv;
}
function pilaster(cv: Canvas, x0: number) {
  rect(cv, x0, 6, 9, 106, "W"); rect(cv, x0, 6, 2, 106, "o"); rect(cv, x0 + 8, 6, 1, 106, "w");
  rect(cv, x0 - 2, 6, 13, 5, "W"); rect(cv, x0 - 2, 6, 13, 1, "o"); rect(cv, x0 - 2, 10, 13, 1, "w");
  rect(cv, x0 - 1, 107, 11, 8, "w"); rect(cv, x0 - 1, 107, 11, 1, "W");
}
function sconce(cv: Canvas, cx: number, y: number) {
  for (let j = -13; j <= 13; j++)
    for (let i = -13; i <= 13; i++) {
      const d = Math.hypot(i, j * 1.15), x = cx + i, yy = y + j;
      if (!"mn".includes(get(cv, x, yy))) continue;
      if (d < 8) set(cv, x, yy, "l"); else if (d < 12 && (x + yy) % 2 === 0) set(cv, x, yy, "l");
    }
  rect(cv, cx - 2, y, 5, 9, "a"); rect(cv, cx - 2, y, 1, 9, "A"); rect(cv, cx + 2, y, 1, 9, "Z");
  rect(cv, cx, y - 2, 1, 2, "Z");
  poly(cv, [[cx - 5, y - 8], [cx + 6, y - 8], [cx + 4, y - 2], [cx - 3, y - 2]], "m");
  for (let j = y - 8; j < y - 2; j++) set(cv, cx + 3 - Math.floor((j - y + 8) / 3), j, "n");
  rect(cv, cx - 5, y - 9, 11, 1, "L");
}
add("wall", wallBase(SQ));
{ const cv = wallBase(SQ); pilaster(cv, 14); sconce(cv, 18, 40); add("wall-pilaster", cv); }
add("wall-none", ["."], false);

// ---------- arches onto the tracks ----------
const AW = 74;
const archHole = (x: number, y: number, g = 0) => {
  if (y >= 79 || x < 11 - g || x >= 63 + g) return false;
  if (y >= 40) return y >= 0;
  const dx = x + 0.5 - 37, dy = y + 0.5 - 40;
  return dx * dx + dy * dy < (26 + g) * (26 + g);
};
const TRAIN_MID: Grid = [
  "..CCCCCCCCCCCCCCCCCCCC....",
  ".YYYYYYYYYYYYYYYYYYYYYYY..",
  ".YiiYiiYiiYiiYiiYiiYYiiiY.",
  "YYYYYYYYYYYYYYYYYYYYYYYYYY",
  "RRRRRRRRRRRRRRRRRRRRRRRRRR",
  "YYYYYYYYYYYYYYYYYYYYYYYYuY",
  "yyyyyyyyyyyyyyyyyyyyyyyyyy",
  "..CCgCC..........CCgCC....",
];
const TRAIN_FAR: Grid = [
  ".CCCCCCCCCC...",
  "YiYiYiYiYYiiY.",
  "RRRRRRRRRRRRRR",
  "yyyyyyyyyyyyyy",
  ".C.C......C.C.",
];
function arch(train: number | null, far: boolean): Canvas {
  const cv = wallBase(AW);
  const hole = (x: number, y: number) => archHole(x, y);
  for (let y = 0; y < 80; y++)
    for (let x = 0; x < AW; x++) {
      if (hole(x, y)) {
        let k = y < 30 ? "s" : "S";
        const hill = 47 + Math.round(2 * Math.sin(x / 5) + Math.sin(x / 2.3));
        if (y >= hill) k = "d";
        if (y >= 58) k = "D";
        cv[y]![x] = k;
      } else if (archHole(x, y, 4)) cv[y]![x] = archHole(x - 1, y, 4) && archHole(x, y - 1, 4) ? (archHole(x + 1, y) || archHole(x, y + 1) ? "w" : "W") : "o";
    }
  const inH = (x: number, y: number) => hole(x, y);
  ellipse(cv, 24, 25, 6, 2, "M"); ellipse(cv, 50, 33, 7, 2, "M");
  for (let x = 0; x < AW; x++) if (!inH(x, 30)) for (let y = 20; y < 38; y++) if (!inH(x, y) && !archHole(x, y, 4)) { /* keep wall */ }
  for (let y = 0; y < 80; y++) for (let x = 0; x < AW; x++) if (get(cv, x, y) === "M" && !inH(x, y)) cv[y]![x] = archHole(x, y, 4) ? "W" : "m";
  const tracks = (y0: number, y1: number, ry: number[], tieStep: number, tieW: number) => {
    for (let x = 0; x < AW; x++) if (inH(x, y0)) {
      for (let y = y0; y <= y1; y++) set(cv, x, y, "N");
      if (x % tieStep < tieW) for (let y = y0; y <= y1; y++) set(cv, x, y, "w");
      for (const r of ry) { set(cv, x, r, "J"); if (y1 - y0 > 5) set(cv, x, r + 1, "j"); }
    }
  };
  tracks(53, 56, [53, 56], 3, 1);
  tracks(59, 65, [60, 64], 4, 1);
  tracks(67, 77, [69, 75], 6, 2);
  if (train !== null) {
    if (far) stamp(cv, mirror(TRAIN_FAR), train, 50, true, inH);
    else stamp(cv, TRAIN_MID, train, 56, true, inH);
  }
  rect(cv, 11, 39, 52, 2, "W"); rect(cv, 11, 39, 52, 1, "o");
  rect(cv, 36, 14, 2, 25, "W"); rect(cv, 36, 14, 1, 25, "o");
  for (const [x, y] of [[17, 47], [18, 46], [19, 45], [21, 47], [56, 22], [57, 21]] as const) if (inH(x, y)) set(cv, x, y, "M");
  rect(cv, 7, 78, 60, 4, "W"); rect(cv, 7, 78, 60, 1, "o"); rect(cv, 7, 81, 60, 1, "w");
  poly(cv, [[32, 8], [42, 8], [40, 18], [34, 18]], "Y");
  for (let y = 8; y < 18; y++) { set(cv, 32 + Math.floor((y - 8) / 5), y, "u"); set(cv, 41 - Math.floor((y - 8) / 5), y, "y"); }
  return cv;
}
const ARCH_X = [-6, 16, 38, 60];
const ARCH_E_X = [58, 32, 6];
add("arch", arch(null, false));
ARCH_X.forEach((x, i) => add(`arch-t${i}`, arch(x, false)));
add("arch-east", arch(null, true));
ARCH_E_X.forEach((x, i) => add(`arch-east-t${i}`, arch(x, true)));

// ---------- the split-flap board (pictures only) ----------
const ICON: Record<string, Grid> = {
  train: [".RRRRR.", "YYYYYYY", "YiiYiiY", "YYYYYYY", "YuYYYuY", "RRRRRRR", ".g...g."],
  mount: [".......", "...M...", "..MJJ..", ".JJJJJ.", ".JjJJjJ", "JjjJjjJ", "EEEEEEE"],
  sea: ["....uu.", "....uu.", ".......", "s..s..s", ".ss.ss.", "sssssss", "sssssss"],
  city: ["....J..", ".J..J..", ".JJ.JJ.", "JJJ.JJJ", "JuJJJuJ", "JJJJJJJ", "JuJJuJJ"],
  tree: ["..EEE..", ".EEEEE.", "EEeEEEE", ".EEEEe.", "...W...", "...W...", "..WWW.."],
  sun: ["...u...", ".u.Y.u.", "..YYY..", "uYYYYYu", "..YYY..", ".u.Y.u.", "...u..."],
  clock1: ["..mmm..", ".mMCMm.", "mMMCMMm", "mMMCCCm", "mMMMMMm", ".mMMMm.", "..mmm.."],
  clock2: ["..mmm..", ".mMCMm.", "mMMCMMm", "mCCCMMm", "mMMMMMm", ".mMMMm.", "..mmm.."],
  arrowR: [".......", "....Y..", "....YY.", "YYYYYYY", "....YY.", "....Y..", "......."],
  pawn: ["..mmm..", "..mmm..", "...m...", "..mmm..", "...m...", "..mmm..", ".mmmmm."],
  cup: [".M.M...", "..M.M..", ".......", "mmmmmm.", "mmmmm.m", "mmmmmm.", ".mmmm.."],
  bird: [".......", "..BB...", ".BBCu..", "BBBBB..", ".BBBBBB", "..BBBBB", "......."],
  dotG: [".......", "..qqq..", ".qqqqq.", ".qMqqq.", ".qqqqq.", "..qqq..", "......."],
  dotY: [".......", "..YYY..", ".YYYYY.", ".YuYYY.", ".YYYYY.", "..YYY..", "......."],
  dotR: [".......", "..RRR..", ".RRRRR.", ".R3RRR.", ".RRRRR.", "..RRR..", "......."],
};
ICON.arrowL = mirror(ICON.arrowR!);
const ROWS: [string[], string[]][] = [
  [["train", "mount", "tree", "clock1", "arrowR", "cup", "dotG"], ["train", "sea", "sun", "clock2", "arrowR", "pawn", "dotY"]],
  [["train", "city", "bird", "clock2", "arrowL", "pawn", "dotG"], ["train", "tree", "mount", "clock1", "arrowR", "cup", "dotG"]],
  [["train", "sea", "sun", "clock1", "arrowL", "bird", "dotY"], ["train", "city", "tree", "clock2", "arrowL", "cup", "dotR"]],
  [["train", "tree", "city", "clock2", "arrowR", "cup", "dotG"], ["train", "mount", "sea", "clock1", "arrowR", "bird", "dotG"]],
];
const FLAP_W = 15, FLAP_H = 12, GAP = 2, BW = 148;
export const SHOP_BIRDIE_BOARD_BOX = { x: 15, y: 17, w: 7 * FLAP_W + 6 * GAP, h: 4 * FLAP_H + 3 * GAP };
function flap(cv: Canvas, x: number, y: number, icon: Grid, mid: boolean) {
  rect(cv, x, y, FLAP_W, FLAP_H, "c"); rect(cv, x, y, FLAP_W, 1, "g");
  stamp(cv, icon.slice(0, 4), x + 4, y + 2);
  rect(cv, x, y + 6, FLAP_W, 1, "K");
  if (mid) { rect(cv, x, y + 7, FLAP_W, 5, "g"); rect(cv, x, y + 7, FLAP_W, 1, "J"); rect(cv, x, y + 11, FLAP_W, 1, "c"); }
  else stamp(cv, icon.slice(4), x + 4, y + 7);
}
/** state per row: 0 A, 1 B, 2 flipping to B, 3 flipping to A. */
function board(states: number[]): Canvas {
  const cv = wallBase(BW);
  rect(cv, 30, 3, 2, 3, "g"); rect(cv, 116, 3, 2, 3, "g");
  rect(cv, 10, 6, 128, 69, "C"); rect(cv, 10, 6, 128, 1, "g"); rect(cv, 10, 6, 1, 69, "g");
  rect(cv, 12, 8, 124, 6, "Y"); rect(cv, 12, 8, 124, 1, "u"); rect(cv, 12, 13, 124, 1, "y");
  stamp(cv, ["..CCCCCCCC.", ".CCCCCCCCCC", "CCCCCCCCCCC", ".C.C...C.C."], 68, 9);
  set(cv, 20, 10, "R"); set(cv, 21, 10, "R"); set(cv, 20, 11, "R"); set(cv, 21, 11, "R");
  set(cv, 126, 10, "q"); set(cv, 127, 10, "q"); set(cv, 126, 11, "q"); set(cv, 127, 11, "q");
  const { x: gx, y: gy } = SHOP_BIRDIE_BOARD_BOX;
  states.forEach((st, r) => {
    const [a, b] = ROWS[r]!;
    const now = st === 1 || st === 2 ? b : a;
    for (let c = 0; c < 7; c++) flap(cv, gx + c * (FLAP_W + GAP), gy + r * (FLAP_H + GAP), ICON[now[c]!]!, st >= 2);
  });
  return cv;
}
const boardState = (r: number, f: number) => {
  const a = (r + 1) % 8, b = (r + 5) % 8;
  if (f === a) return 2;
  if (f === b) return 3;
  return (f - a + 8) % 8 < (b - a + 8) % 8 ? 1 : 0;
};
add("board", board([0, 0, 0, 0]));
for (let f = 0; f < 8; f++) add(`board-f${f}`, board([0, 1, 2, 3].map((r) => boardState(r, f))));

// ---------- seats, lamp, plants ----------
{
  const cv = canvas(111, 40);
  for (let s = 0; s < 3; s++) {
    const x0 = 3 + s * 36;
    rect(cv, x0 + 1, 3, 31, 6, "Y"); rect(cv, x0 + 1, 3, 31, 1, "u"); rect(cv, x0 + 30, 4, 2, 5, "y");
    rect(cv, x0, 8, 33, 22, "c"); set(cv, x0, 8, "."); set(cv, x0 + 32, 8, ".");
    rect(cv, x0 + 1, 8, 31, 1, "g"); rect(cv, x0 + 1, 9, 1, 20, "g"); rect(cv, x0 + 31, 9, 1, 21, "C"); rect(cv, x0 + 1, 29, 31, 1, "C");
    rect(cv, x0 + 6, 13, 21, 1, "C"); rect(cv, x0 + 6, 13, 1, 12, "C");
  }
  for (const ax of [0, 36, 72, 108]) { rect(cv, ax, 5, 3, 26, "C"); rect(cv, ax, 5, 3, 2, "g"); }
  rect(cv, 0, 30, 111, 4, "C"); rect(cv, 0, 30, 111, 1, "g");
  for (const lx of [9, 99]) { rect(cv, lx, 34, 3, 5, "g"); rect(cv, lx - 2, 39, 7, 1, "C"); }
  add("seats", cv);
}
{
  const cv = canvas(37, 92);
  rect(cv, 17, 1, 3, 3, "a");
  poly(cv, [[12, 4], [25, 4], [30, 20], [7, 20]], "m");
  for (let y = 4; y < 20; y++) for (let x = 0; x < 37; x++) if (get(cv, x, y) === "m" && x > 21 + (y - 4) * 0.45) cv[y]![x] = "n";
  rect(cv, 12, 4, 13, 1, "M"); rect(cv, 7, 19, 23, 1, "L"); rect(cv, 9, 20, 19, 1, "l");
  rect(cv, 17, 21, 3, 64, "W"); rect(cv, 17, 21, 1, 64, "o"); rect(cv, 19, 21, 1, 64, "w");
  ellipse(cv, 18.5, 87.5, 8, 3, "w"); rect(cv, 12, 86, 13, 1, "W");
  add("lamp", cv);
}
function pot(cv: Canvas, top: number, bot: number) {
  poly(cv, [[9, top + 2], [28, top + 2], [25, bot], [12, bot]], "t");
  for (let y = top; y < bot; y++) for (let x = 20; x < 37; x++) if (get(cv, x, y) === "t" && x > 22) cv[y]![x] = "T";
  rect(cv, 8, top, 21, 4, "O"); rect(cv, 8, top + 3, 21, 1, "t");
}
function leafy(cv: Canvas, cx: number, cy: number, rx: number, ry: number, seed: number) {
  shade(cv, inEllipse(cx, cy, rx, ry), "heE", roundLight(cx, cy, rx, ry, 0.05));
  for (let n = 0; n < 9; n++) {
    const a = rnd(n, 1, seed) * Math.PI * 2, r = 0.55 + rnd(n, 2, seed) * 0.35;
    const x = Math.round(cx + Math.cos(a) * rx * r), y = Math.round(cy + Math.sin(a) * ry * r);
    set(cv, x, y, "h"); set(cv, x + 1, y, "h"); set(cv, x - 1, y - 1, "E");
  }
}
{
  const cv = canvas(37, 58);
  for (const [x, y] of [[6, 14], [30, 12], [10, 4], [27, 3], [18, 1]] as const) poly(cv, [[18, 26], [x - 2, y], [x + 3, y + 1]], "e");
  leafy(cv, 18.5, 24, 13, 13, 3);
  pot(cv, 38, 58);
  add("plant", cv);
}
{
  const cv = canvas(37, 36);
  leafy(cv, 18.5, 14, 14, 11, 4);
  rect(cv, 6, 22, 25, 13, "W"); rect(cv, 6, 22, 25, 2, "o"); rect(cv, 28, 24, 3, 11, "w"); rect(cv, 6, 34, 25, 1, "w");
  add("shrub", cv);
}
{
  const cv = canvas(37, 60);
  poly(cv, [[18.5, 0], [31, 40], [6, 40]], "e");
  shade(cv, (x, y) => get(cv, x, y) === "e", "heE", (x, y) => 0.75 - (x - 18.5) / 14 - y / 120);
  for (let y = 8; y < 40; y += 8) for (let x = 0; x < 37; x++) if (get(cv, x, y) !== "." && rnd(x, y, 5) < 0.6) cv[y]![x] = "h";
  rect(cv, 17, 40, 3, 2, "w");
  pot(cv, 42, 60);
  add("shrub-b", cv);
}

// ---------- the U-shaped bar ----------
function grain(cv: Canvas, x0: number, y0: number, w: number, h: number, alongX: boolean, seed: number) {
  rect(cv, x0, y0, w, h, "W");
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const r = alongX ? rnd(Math.floor(x / 9), y, seed) : rnd(x, Math.floor(y / 9), seed);
      if (r < 0.16) cv[y]![x] = "o"; else if (r < 0.27) cv[y]![x] = "w";
    }
}
{
  const W = 148, cv = canvas(W, 62);
  grain(cv, 0, 8, W, 26, true, 3);
  rect(cv, 26, 8, 96, 1, "w");
  rect(cv, 0, 8, 2, 26, "m"); rect(cv, W - 2, 8, 2, 26, "n");
  rect(cv, 0, 31, W, 2, "m"); rect(cv, 0, 33, W, 1, "n");
  rect(cv, 0, 34, W, 28, "c"); rect(cv, 0, 34, W, 1, "g"); rect(cv, 0, 42, W, 3, "R"); rect(cv, 0, 45, W, 1, "r"); rect(cv, 0, 57, W, 5, "C");
  for (const x of [37, 74, 111]) { rect(cv, x, 35, 1, 7, "C"); rect(cv, x, 46, 1, 11, "C"); }
  rect(cv, 65, 47, 18, 8, "a"); rect(cv, 65, 47, 18, 1, "A"); rect(cv, 65, 47, 1, 8, "A"); rect(cv, 82, 48, 1, 7, "Z"); rect(cv, 66, 54, 17, 1, "Z");
  // the service bell
  rect(cv, 48, 27, 9, 2, "Z"); rect(cv, 51, 23, 3, 1, "a"); rect(cv, 50, 24, 5, 1, "a"); rect(cv, 49, 25, 7, 2, "a");
  set(cv, 50, 24, "A"); set(cv, 50, 25, "A"); set(cv, 51, 23, "A"); set(cv, 52, 22, "Z");
  // the little coffee urn
  rect(cv, 121, 9, 10, 14, "J"); rect(cv, 121, 9, 1, 14, "M"); rect(cv, 128, 9, 3, 14, "j");
  rect(cv, 121, 11, 10, 1, "a"); rect(cv, 121, 20, 10, 1, "a");
  rect(cv, 122, 6, 8, 3, "a"); rect(cv, 123, 5, 6, 1, "a"); rect(cv, 122, 6, 2, 1, "A"); set(cv, 125, 4, "Z"); set(cv, 126, 4, "Z");
  rect(cv, 124, 23, 2, 2, "Z"); rect(cv, 128, 23, 2, 2, "Z");
  rect(cv, 131, 17, 2, 2, "C"); set(cv, 132, 19, "a");
  add("counter", cv);
}
export const SHOP_BIRDIE_COUNTER_SIGN = { piece: "counter", x: 65, y: 47, w: 18, h: 8 };
{
  const cv = canvas(37, 150);
  grain(cv, 0, 0, 26, 122, false, 5);
  rect(cv, 0, 0, 2, 122, "m"); rect(cv, 25, 0, 1, 122, "n"); rect(cv, 0, 0, 26, 1, "n");
  rect(cv, 0, 122, 26, 28, "c"); rect(cv, 0, 125, 26, 3, "R");
  add("counter-arm", cv);
}

// ---------- stools and their birds ----------
function stoolCv(): Canvas {
  const cv = canvas(37, 34);
  ellipse(cv, 18.5, 31, 6, 2, "C"); rect(cv, 14, 30, 9, 1, "g");
  rect(cv, 17, 14, 3, 17, "C"); rect(cv, 17, 14, 1, 17, "g");
  for (let y = 19; y < 27; y++)
    for (let x = 9; x < 29; x++) {
      const v = ((x + 0.5 - 18.5) / 7) ** 2 + ((y + 0.5 - 23) / 2.2) ** 2;
      if (v <= 1 && v >= 0.4) cv[y]![x] = y < 23 ? "j" : "J";
    }
  for (let y = 19; y < 23; y++) rect(cv, 17, y, 3, 1, "C");
  rect(cv, 11, 12, 16, 2, "w");
  ellipse(cv, 18.5, 11, 8.5, 3, "W");
  ellipse(cv, 18.5, 10.5, 7, 2.2, "Y");
  rect(cv, 14, 9, 4, 1, "u");
  return cv;
}
add("stool", stoolCv());
type Pose = "sit" | "bob" | "sip" | "tuck";
function bird(kind: "dove" | "sparrow", pose: Pose): Grid {
  const cv = canvas(12, 8);
  const dove = kind === "dove";
  stamp(cv, dove ? ["..bbbbBb.", "bbbBBBBBb", ".bbbgBgbb", "...bbbbb."] : [".ppPPPp.", "pppPPPPp", ".pPpPpp.", "..pppp.."], 0, 3);
  if (pose === "tuck") stamp(cv, dove ? ["BBBb"] : ["PPPp"], 3, 2);
  const [hx, hy] = pose === "bob" ? [7, 1] : pose === "sip" ? [8, 3] : [6, 0];
  if (dove) { stamp(cv, ["bBB.", "bBCg"], hx, hy); stamp(cv, ["VV"], hx, hy + 2); }
  else { stamp(cv, ["gpP.", "pVCo"], hx, hy); stamp(cv, ["C"], hx + 2, hy + 2); }
  return toGrid(cv);
}
const POSES: Pose[] = ["sit", "bob", "sip", "tuck"];
for (const kind of ["dove", "sparrow"] as const) for (const pose of POSES) add(`${kind}-${pose}`, bird(kind, pose));
add("cup", ["MMn", "MMn", ".n."]);
function birdStool(kind: "dove" | "sparrow", pose: Pose, flip: boolean, cup: boolean): Grid {
  const layers: Layer[] = [{ part: "stool", x: 0, y: 0 }];
  if (cup) layers.push({ part: "cup", x: flip ? 9 : 25, y: 8 });
  layers.push({ part: `${kind}-${pose}`, x: flip ? 13 : 12, y: 4, flipX: flip });
  return bake(37, 34, layers);
}
const DOVE_SEQ: Pose[] = ["sit", "sit", "bob", "sit", "sip", "sip", "sit", "tuck"];
const SPARROW_SEQ: Pose[] = ["sit", "bob", "sit", "bob", "sit", "tuck", "sit", "sip"];
for (let f = 0; f < 8; f++) {
  add(`stool-dove-f${f}`, birdStool("dove", DOVE_SEQ[f]!, false, true), false);
  add(`stool-dove-b-f${f}`, birdStool("dove", DOVE_SEQ[(f + 4) % 8]!, true, true), false);
  add(`stool-sparrow-f${f}`, birdStool("sparrow", SPARROW_SEQ[f]!, false, false), false);
}

// ---------- the challenge table ----------
{
  const cv = canvas(56, 74);
  rect(cv, 8, 56, 3, 12, "w"); rect(cv, 45, 56, 3, 12, "w");
  for (const lx of [2, 51]) { rect(cv, lx, 56, 3, 18, "W"); rect(cv, lx, 56, 1, 18, "o"); rect(cv, lx + 2, 56, 1, 18, "w"); }
  rect(cv, 1, 52, 54, 4, "W"); rect(cv, 1, 52, 54, 1, "o"); rect(cv, 1, 55, 54, 1, "w");
  rect(cv, 0, 0, 56, 52, "M"); rect(cv, 0, 50, 56, 2, "n"); rect(cv, 55, 0, 1, 52, "n");
  for (let y = 30; y < 50; y++) for (let x = 0; x < 55; x++) if (x + y > 82 && (x + y) % 2 === 0) cv[y]![x] = "m";
  add("match-table", cv);
}

// ---------- the crossing gates ----------
function post(lit: 0 | 1 | 2): Canvas {
  const cv = canvas(37, 84);
  rect(cv, 11, 77, 15, 6, "c"); rect(cv, 11, 77, 15, 1, "g"); rect(cv, 11, 82, 15, 1, "C");
  rect(cv, 16, 12, 4, 65, "J"); rect(cv, 16, 12, 1, 65, "M"); rect(cv, 19, 12, 1, 65, "j");
  for (let y = 0; y < 19; y++)
    for (let x = 2; x < 35; x++) {
      const px = x + 0.5 - 18, py = y + 0.5 - 9.5;
      for (const s of [1, -1]) {
        const ca = Math.cos(0.5), sa = Math.sin(0.5) * s;
        const t = px * ca + py * sa, dn = Math.abs(-px * sa + py * ca);
        if (Math.abs(t) > 15.5) continue;
        if (dn <= 1.6) cv[y]![x] = "M"; else if (dn <= 2.7 && cv[y]![x] !== "M") cv[y]![x] = "R";
      }
    }
  rect(cv, 6, 24, 25, 2, "C");
  ([[9, 30, 1], [27, 30, 2]] as const).forEach(([cx, cy, n]) => {
    ellipse(cv, cx + 0.5, cy + 0.5, 4.6, 4.6, "C");
    ellipse(cv, cx + 0.5, cy + 0.5, 3, 3, lit === n ? "1" : "2");
    if (lit === n) { set(cv, cx - 1, cy - 1, "3"); set(cv, cx, cy - 2, "3"); }
    rect(cv, cx - 4, cy - 5, 9, 1, "C");
  });
  rect(cv, 20, 52, 9, 9, "c"); rect(cv, 20, 52, 9, 1, "g"); rect(cv, 20, 52, 1, 9, "g");
  for (let y = 18; y < 58; y++) rect(cv, 30, y, 3, 1, Math.floor((y - 18) / 5) % 2 ? "M" : "R");
  rect(cv, 29, 56, 5, 6, "C"); rect(cv, 29, 56, 5, 1, "g");
  return cv;
}
add("crossing-post", post(0));
add("crossing-post-l", post(1));
add("crossing-post-r", post(2));

// ---------- the front ----------
{
  const cv = canvas(SQ, 24);
  rect(cv, 0, 0, SQ, 24, "c"); rect(cv, 0, 0, SQ, 3, "Y"); rect(cv, 0, 0, SQ, 1, "u"); rect(cv, 0, 2, SQ, 1, "y"); rect(cv, 0, 3, SQ, 1, "C");
  for (let y = 5; y < 22; y++) for (let x = 0; x < SQ; x++) if (rnd(x, y, 21) < 0.05) cv[y]![x] = "g";
  rect(cv, 0, 22, SQ, 2, "C");
  add("hem", cv);
}
{
  const cv = canvas(74, 110);
  for (let y = 10; y < 110; y++) for (let x = 6; x < 68; x++) cv[y]![x] = y < 58 ? "I" : y < 82 ? (rnd(x, y, 3) < 0.5 ? "S" : "I") : y === 82 ? "N" : (y - 83) % 7 === 0 ? "n" : "m";
  for (let y = 12; y < 50; y++) for (let x = 6; x < 68; x++) if ((x - y + 200) % 23 < 2) cv[y]![x] = "l";
  for (const [x0, dir] of [[6, 1], [59, -1]] as const) {
    rect(cv, x0, 12, 9, 94, "W"); rect(cv, x0 + 2, 15, 5, 86, "i");
    for (let y = 18; y < 40; y++) set(cv, x0 + 3 + ((y >> 2) % 2), y, "M");
    rect(cv, dir > 0 ? x0 + 7 : x0 + 1, 58, 1, 8, "a");
    rect(cv, x0, 12, 9, 1, "o");
  }
  rect(cv, 0, 0, 6, 110, "W"); rect(cv, 0, 0, 2, 110, "o"); rect(cv, 5, 0, 1, 110, "w");
  rect(cv, 68, 0, 6, 110, "W"); rect(cv, 68, 0, 1, 110, "o"); rect(cv, 73, 0, 1, 110, "w");
  rect(cv, 0, 0, 74, 10, "W"); rect(cv, 0, 0, 74, 2, "o"); rect(cv, 0, 9, 74, 1, "w");
  rect(cv, 30, 1, 14, 8, "q"); rect(cv, 30, 1, 14, 1, "E");
  stamp(cv, ["...M..", "..MMM.", ".M.M.M", "...MM.", "..M..M", ".M....M".slice(0, 6)], 34, 2);
  rect(cv, 6, 105, 62, 5, "a"); rect(cv, 6, 105, 62, 1, "A"); rect(cv, 6, 109, 62, 1, "Z");
  add("entrance", cv);
}

// ---------- pools of light, the side walls ----------
function pool(rx: number, ry: number, k: string): Canvas {
  const cv = canvas(Math.ceil(rx * 2), Math.ceil(ry * 2));
  for (let y = 0; y < cv.length; y++)
    for (let x = 0; x < cv[0]!.length; x++) {
      const v = ((x + 0.5 - rx) / rx) ** 2 + ((y + 0.5 - ry) / ry) ** 2;
      if (v < 0.55 || (v < 1 && (x + y) % 2 === 0)) cv[y]![x] = k;
    }
  return cv;
}
export const SHOP_BIRDIE_POOLS = [
  { at: "lamp", col: 4.5, row: 2.6, rx: 34, ry: 22, color: "#ffe2a0", alpha: 0.24 },
  { at: "lamp", col: 10.5, row: 7.6, rx: 34, ry: 22, color: "#ffe2a0", alpha: 0.24 },
  { at: "bartender", col: 9, row: 2.6, rx: 46, ry: 40, color: "#ffc870", alpha: 0.23 },
  { at: "match-table", col: 5, row: 6.1, rx: 50, ry: 36, color: "#ffc870", alpha: 0.23 },
  { at: "entrance", col: 5, row: 10.4, rx: 46, ry: 22, color: "#fff6d8", alpha: 0.35 },
];
SHOP_BIRDIE_POOLS.forEach((p, i) => add(`pool-${i}`, pool(p.rx, p.ry, p.at === "entrance" ? "=" : p.at === "lamp" ? "~" : "^"), false));

function sideWall(): Canvas {
  const L = SHOP_BIRDIE_N * SQ;
  const cv = wallBase(L);
  for (let b = 0; b < 4; b++) {
    pilaster(cv, b * 111 + 107 - 4 > L - 9 ? L - 12 : b * 111 + 107);
    sconce(cv, b * 111 + 30, 40);
    if (b % 2 === 0) {
      const x0 = b * 111 + 56;
      rect(cv, x0, 26, 40, 30, "W"); rect(cv, x0, 26, 40, 1, "o"); rect(cv, x0 + 3, 29, 34, 24, "S");
      rect(cv, x0 + 3, 44, 34, 9, "d"); rect(cv, x0 + 3, 47, 34, 1, "j");
      stamp(cv, TRAIN_MID.map((r) => r.slice(0, 22)), x0 + 8, 38, true);
    }
  }
  return cv;
}
const SIDE = sideWall();
export const SHOP_BIRDIE_SIDE_WALL_GRID: Grid = toGrid(SIDE);
add("side-wall", SIDE);
{
  const H = SHOP_BIRDIE_N * SQ + OY;
  for (const [name, inner] of [["side-w", SQ - 6], ["side-e", 0]] as const) {
    const cv = canvas(SQ, H);
    rect(cv, 0, 0, SQ, H, "C");
    rect(cv, inner, 0, 6, H, "m"); rect(cv, inner === 0 ? 0 : inner + 4, 0, 2, H, "o");
    for (let y = 0; y < H; y += SQ) rect(cv, 0, y, SQ, 1, "c");
    add(name, cv, false);
  }
}

// ---------- the pieces and the layout ----------
export interface ShopPiece {
  w: number;
  d: number;
  /** The picture's size in pixels. */
  size: [number, number];
  /** The picture's top-left from the footprint's south-west floor corner, in pixels. */
  at: [number, number];
  /** Part names, one per frame of the room's 8-frame clock (500 ms each), or one for a still piece. */
  frames: string[];
  ms: number;
  floor?: boolean;
}
const piece = (w: number, d: number, at: [number, number], frames: string[], floor = false): ShopPiece => {
  const g = P[frames[0]!]!.grid;
  return { w, d, size: [Math.max(...g.map((r) => r.length)), g.length], at, frames, ms: 500, ...(floor ? { floor } : {}) };
};
const eight = (fn: (f: number) => string) => Array.from({ length: 8 }, (_, f) => fn(f));
const FLOOR_AT: [number, number] = [0, -SQ];
export const SHOP_BIRDIE_PIECES: Record<string, ShopPiece> = {
  "floor-a": piece(1, 1, FLOOR_AT, ["floor-a"], true),
  "floor-b": piece(1, 1, FLOOR_AT, ["floor-b"], true),
  "floor-edge": piece(1, 1, FLOOR_AT, ["floor-edge"], true),
  "floor-edge-corner": piece(1, 1, FLOOR_AT, ["floor-edge-corner"], true),
  "floor-door": piece(1, 1, FLOOR_AT, ["floor-door"], true),
  "road-x": piece(1, 1, FLOOR_AT, ["road-x"], true),
  "road-track": piece(1, 1, FLOOR_AT, ["road-track"], true),
  track: piece(1, 1, FLOOR_AT, ["track"], true),
  "track-end": piece(1, 1, FLOOR_AT, ["track-end"], true),
  wall: piece(1, 1, [0, -WALL_H], ["wall"]),
  "wall-pilaster": piece(1, 1, [0, -WALL_H], ["wall-pilaster"]),
  "wall-none": piece(1, 1, [0, -1], ["wall-none"]),
  arch: piece(2, 1, [0, -WALL_H], eight((f) => (f >= 1 && f <= 4 ? `arch-t${f - 1}` : "arch"))),
  "arch-east": piece(2, 1, [0, -WALL_H], eight((f) => (f >= 5 ? `arch-east-t${f - 5}` : "arch-east"))),
  board: piece(4, 1, [0, -WALL_H], eight((f) => `board-f${f}`)),
  seats: piece(3, 1, [0, -46], ["seats"]),
  lamp: piece(1, 1, [0, -103], ["lamp"]),
  plant: piece(1, 1, [0, -66], ["plant"]),
  shrub: piece(1, 1, [0, -42], ["shrub"]),
  "shrub-b": piece(1, 1, [0, -66], ["shrub-b"]),
  counter: piece(4, 1, [0, -62], ["counter"]),
  "counter-arm": piece(1, 3, [0, -139], ["counter-arm"]),
  stool: piece(1, 1, [0, -46], ["stool"]),
  "stool-dove": piece(1, 1, [0, -46], eight((f) => `stool-dove-f${f}`)),
  "stool-dove-b": piece(1, 1, [0, -46], eight((f) => `stool-dove-b-f${f}`)),
  "stool-sparrow": piece(1, 1, [0, -46], eight((f) => `stool-sparrow-f${f}`)),
  "match-table": piece(2, 2, [9, -85], ["match-table"]),
  "crossing-post": piece(1, 1, [0, -94], eight((f) => (f >= 1 && f <= 4 ? (f % 2 ? "crossing-post-l" : "crossing-post-r") : "crossing-post"))),
  hem: piece(1, 1, [0, -24], ["hem"]),
  entrance: piece(2, 1, [0, -110], ["entrance"]),
};

const L: ShopPlace[] = [];
// the floor, cols 1-10, rows 1-10
const ROAD: Record<string, [string, 0 | 2]> = {
  "2,7": ["road-x", 0], "3,7": ["road-x", 2], "2,8": ["road-track", 0], "3,8": ["road-track", 2], "2,9": ["road-x", 0], "3,9": ["road-x", 2],
  "1,8": ["track", 0], "4,8": ["track", 0], "5,8": ["track-end", 0],
};
for (let row = 1; row <= 10; row++)
  for (let col = 1; col <= 10; col++) {
    const r = ROAD[`${col},${row}`];
    if (r) L.push({ piece: r[0], col, row, rot: r[1] });
    else if (row === 10 && (col === 4 || col === 5)) L.push({ piece: "floor-door", col, row, rot: col === 5 ? 2 : 0 });
    else if (row === 10 && col === 1) L.push({ piece: "floor-edge-corner", col, row });
    else if (row === 10 && col === 10) L.push({ piece: "floor-edge-corner", col, row, rot: 3 });
    else if (row === 10) L.push({ piece: "floor-edge", col, row, rot: 3 });
    else if (col === 1) L.push({ piece: "floor-edge", col, row });
    else if (col === 10) L.push({ piece: "floor-edge", col, row, rot: 2 });
    else L.push({ piece: (col + row) % 2 ? "floor-b" : "floor-a", col, row });
  }
L.push(
  { piece: "wall-none", col: 0, row: 0, solid: true }, { piece: "arch", col: 1, row: 0, w: 2, solid: true }, { piece: "wall-pilaster", col: 3, row: 0, solid: true },
  { piece: "board", col: 4, row: 0, w: 4, solid: true }, { piece: "wall-pilaster", col: 8, row: 0, solid: true },
  { piece: "arch-east", col: 9, row: 0, w: 2, solid: true }, { piece: "wall-none", col: 11, row: 0, solid: true },
);
for (let row = 1; row <= 11; row++) L.push({ piece: "wall-none", col: 0, row, solid: true }, { piece: "wall-none", col: 11, row, solid: true });
L.push(
  { piece: "plant", col: 1, row: 1, solid: true },
  { piece: "seats", col: 1, row: 2, w: 3, solid: true }, { piece: "seats", col: 1, row: 3, w: 3, solid: true },
  { piece: "lamp", col: 4, row: 2, solid: true },
  { piece: "counter-arm", col: 7, row: 1, d: 3, solid: true }, { piece: "counter-arm", col: 10, row: 1, d: 3, rot: 2, solid: true },
  { piece: "counter", col: 7, row: 4, w: 4, solid: true },
  { piece: "stool", col: 6, row: 1, solid: true }, { piece: "stool-dove", col: 6, row: 2, solid: true }, { piece: "stool", col: 6, row: 3, solid: true },
  { piece: "stool", col: 7, row: 5, solid: true }, { piece: "stool-sparrow", col: 8, row: 5, solid: true },
  { piece: "stool", col: 9, row: 5, solid: true }, { piece: "stool-dove-b", col: 10, row: 5, solid: true },
  { piece: "match-table", col: 4, row: 5, w: 2, d: 2, solid: true },
  { piece: "stool", col: 3, row: 5, solid: true }, { piece: "stool", col: 6, row: 5, solid: true },
  { piece: "crossing-post", col: 1, row: 9, solid: true }, { piece: "crossing-post", col: 4, row: 7, rot: 2, solid: true },
  { piece: "shrub-b", col: 1, row: 5, solid: true },
  { piece: "lamp", col: 10, row: 7, solid: true }, { piece: "shrub", col: 10, row: 8, solid: true }, { piece: "plant", col: 10, row: 10, solid: true },
);
for (const col of [1, 2, 3, 6, 7, 8, 9, 10]) L.push({ piece: "hem", col, row: 11, solid: true });
L.push({ piece: "entrance", col: 4, row: 11, w: 2, exit: true });
export const SHOP_BIRDIE_LAYOUT: readonly ShopPlace[] = L;
export const SHOP_BIRDIE_BARTENDER_SPOT = { col: 8, row: 2 };

export const SHOP_BIRDIE_LIGHTS = [
  { piece: "lamp", col: 4, row: 2, x: 18, y: 20, color: "#ffe2a0", radius: 64 },
  { piece: "lamp", col: 10, row: 7, x: 18, y: 20, color: "#ffe2a0", radius: 64 },
  { piece: "wall-pilaster", col: 3, row: 0, x: 18, y: 33, color: "#ffe2a0", radius: 40 },
  { piece: "wall-pilaster", col: 8, row: 0, x: 18, y: 33, color: "#ffe2a0", radius: 40 },
  { piece: "counter", col: 7, row: 4, x: 52, y: 24, color: "#f0d27a", radius: 16, soft: true },
  { piece: "counter", col: 7, row: 4, x: 126, y: 12, color: "#ffb85c", radius: 20, soft: true },
  { piece: "entrance", col: 4, row: 11, x: 37, y: 60, color: "#fff6d8", radius: 96 },
  { piece: "arch", col: 1, row: 0, x: 37, y: 50, color: "#dff1f8", radius: 70, soft: true },
  { piece: "arch-east", col: 9, row: 0, x: 37, y: 50, color: "#dff1f8", radius: 70, soft: true },
  { piece: "crossing-post", col: 1, row: 9, x: 9, y: 30, color: "#ff4f3c", radius: 14, frames: [1, 3] },
  { piece: "crossing-post", col: 1, row: 9, x: 27, y: 30, color: "#ff4f3c", radius: 14, frames: [2, 4] },
  { piece: "crossing-post", col: 4, row: 7, x: 9, y: 30, color: "#ff4f3c", radius: 14, frames: [2, 4] },
  { piece: "crossing-post", col: 4, row: 7, x: 27, y: 30, color: "#ff4f3c", radius: 14, frames: [1, 3] },
];

/** The game's fixed camera, in squares (x east, y up, z south): from above the doorway, looking north and down. */
export const SHOP_BIRDIE_CAM = { from: { x: 6, y: 12.5, z: 15.5 }, at: { x: 6, y: 0, z: 5.6 }, fov: 42 };

// ---------- the room as one Character ----------
function placed(pl: ShopPlace, f: number): Layer {
  const def = SHOP_BIRDIE_PIECES[pl.piece]!;
  const name = def.frames[f % def.frames.length]!;
  const [pw] = def.size;
  const w = pl.w ?? def.w, d = pl.d ?? def.d;
  const flip = !def.floor && pl.rot === 2;
  const ox = flip ? w * SQ - def.at[0] - pw : def.at[0];
  const x = M + pl.col * SQ + ox, y = M + OY + (pl.row + d) * SQ + def.at[1];
  return def.floor ? { part: name, x, y, rot: pl.rot } : flip ? { part: name, x, y, flipX: true } : { part: name, x, y };
}
function roomFrame(f: number): Frame {
  const layers: Layer[] = [];
  for (let col = 1; col <= 10; col++) layers.push({ part: (col + 11) % 2 ? "floor-b" : "floor-a", x: M + col * SQ, y: M + OY + 11 * SQ });
  const floors = L.filter((p) => SHOP_BIRDIE_PIECES[p.piece]!.floor);
  for (const p of floors) layers.push(placed(p, f));
  SHOP_BIRDIE_POOLS.forEach((p, i) => layers.push({ part: `pool-${i}`, x: Math.round(M + p.col * SQ - p.rx), y: Math.round(M + OY + p.row * SQ - p.ry) }));
  layers.push({ part: "side-w", x: M, y: M }, { part: "side-e", x: M + 11 * SQ, y: M });
  const ups = L.filter((p) => !SHOP_BIRDIE_PIECES[p.piece]!.floor && p.piece !== "wall-none");
  ups.sort((a, b) => a.row + (a.d ?? SHOP_BIRDIE_PIECES[a.piece]!.d) - (b.row + (b.d ?? SHOP_BIRDIE_PIECES[b.piece]!.d)) || a.col - b.col);
  for (const p of ups) layers.push(placed(p, f));
  return { layers, ms: 500 };
}
const anims: Record<string, Anim> = { idle: { loop: true, frames: Array.from({ length: 8 }, (_, f) => roomFrame(f)) } };
for (const [name, def] of Object.entries(SHOP_BIRDIE_PIECES)) {
  const frames = def.frames.map((part): Frame => ({ layers: [{ part, x: 4, y: 4 }], ms: def.ms }));
  anims[`review-${name}`] = { loop: true, frames };
}
anims["review-floor"] = {
  loop: false,
  frames: [{
    ms: 500,
    layers: ["floor-a", "floor-b", "floor-edge", "floor-edge-corner", "floor-door", "road-x", "road-track", "track", "track-end"].flatMap((part, i): Layer[] => [{ part, x: 4 + i * SQ, y: 4 }]).concat(
      [{ part: "road-x", x: 4, y: 50 }, { part: "road-x", x: 4 + SQ, y: 50, rot: 2 }, { part: "track", x: 4 + 2 * SQ, y: 50 + SQ }, { part: "road-track", x: 4 + 3 * SQ, y: 50 + SQ }, { part: "road-track", x: 4 + 4 * SQ, y: 50 + SQ, rot: 2 }, { part: "track-end", x: 4 + 5 * SQ, y: 50 + SQ }, { part: "road-x", x: 4 + 3 * SQ, y: 50 + 2 * SQ }, { part: "road-x", x: 4 + 4 * SQ, y: 50 + 2 * SQ, rot: 2 }, { part: "road-x", x: 4 + 3 * SQ, y: 50 }, { part: "road-x", x: 4 + 4 * SQ, y: 50, rot: 2 }],
    ),
  }],
};
anims["review-side-wall"] = { loop: false, frames: [{ ms: 500, layers: [{ part: "side-wall", x: 2, y: 4 }] }] };

export const SHOP_BIRDIE_INTERIOR: Character = {
  id: "shop-birdie-interior-2",
  name: "Birdie's station, inside",
  w: FW,
  h: FH,
  foot: [Math.floor(FW / 2), FH - M],
  palette: PALETTE,
  parts: P,
  anims,
};
export default SHOP_BIRDIE_INTERIOR;
