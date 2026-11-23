/**
 * Inside Birdie's station, second pass (Eric, Nov 23): a 12 x 12 lobby. The back wall (row 0) keeps the split-flap
 * board (pictures only) between two arched windows onto the tracks, where Birdie's yellow train passes now and then.
 * The east side is a separate bar: a U-shaped counter (two arms and a south run) with stools on its outside and little
 * birds perched on three of them; the bartender's clear place is inside the U (cols 8-9, rows 1-3). The challenge spot:
 * a square white-topped table with one stool each side. A railroad crossing: a road strip (cols 7-8, rows 8-10) with
 * rails across it at row 9 and two gates kitty-corner. The way out is the open glass doors at the front.
 *
 * The view (SHOP_BIRDIE_CAM): a straight-on 3/4 view from the south. The floor is drawn square, 37 px a square; every
 * upright piece is drawn front-on, standing on its footprint's south edge (less its `lift`), so a part's grid is
 * exactly what the camera sees of it.
 */
import { frameKeys, lazyParts, type Character, type Frame, type Grid, type Layer } from "../../../../packages/app/src/characters/sprite.ts";
import { canvas, ellipse, line, poly, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";

export interface ShopPlace { piece: string; col: number; row: number; w?: number; d?: number; rot?: 0 | 1 | 2 | 3; exit?: boolean; solid?: boolean }

export const SHOP_BIRDIE_N = 12;
export const SHOP_BIRDIE_WALL_H = 120;
const S = 37;
const WH = SHOP_BIRDIE_WALL_H;
const DADO = 80;

const PALETTE: Record<string, string> = {
  k: "#1a1714",
  Y: "#f4c430", y: "#d9a21b", Z: "#ffe27a",
  c: "#2b2d31", C: "#3a3d44", F: "#33363c", g: "#54575f",
  r: "#c8372d", R: "#8e1f1a",
  w: "#a86a3c", W: "#7a4a26", v: "#c99866",
  m: "#f3f1ec", M: "#ffffff", n: "#e3ded3", N: "#cdc5b6", J: "#fbeccb",
  G: "#4f7a3a", h: "#6f9a4f", H: "#2f4f25",
  t: "#b5643a", T: "#86452a",
  L: "#ffe2a0", l: "#ffb85c",
  s: "#bfe0ee", S: "#e4f3f8",
  b: "#d9ad4e", B: "#9a7428",
  e: "#b4bac2", E: "#6c737c",
  x: "#ece6da", j: "#e3d8c4", X: "#cbbba2", q: "#b89a7a", Q: "#d3c9b8",
  o: "#9aaec2", O: "#67798f", p: "#e6ecf0",
  u: "#8a5a34", U: "#d2ab7c",
  a: "#cfe6ee", A: "#9cc2cf",
  d: "#fff8e2", D: "#fde9ab",
  "1": "#5e1c17", "2": "#5e1c17",
};
const LIT = "#ff5a44";
const DIM = "#5e1c17";

// ---------- helpers ----------
const rect = (cv: Canvas, x: number, y: number, w: number, h: number, k: string) => {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (j >= 0 && j < cv.length && i >= 0 && i < cv[0]!.length) cv[j]![i] = k;
};
const stamp = (cv: Canvas, g: Grid, x: number, y: number, clip?: (x: number, y: number) => boolean) =>
  g.forEach((row, j) => [...row].forEach((c, i) => {
    if (c === "." || c === " ") return;
    if (clip && !clip(x + i, y + j)) return;
    rect(cv, x + i, y + j, 1, 1, c);
  }));
const hash = (a: number, b: number, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const mirror = (g: Grid): Grid => g.map((r) => [...r].reverse().join(""));

// ---------- floor ----------
function terrazzo(seed: number, base: string): Canvas {
  const cv = canvas(S, S);
  rect(cv, 0, 0, S, S, base);
  for (let y = 2; y < S - 2; y++)
    for (let x = 2; x < S - 2; x++) {
      const v = hash(x, y, seed);
      if (v < 0.035) rect(cv, x, y, 2, 1, "X");
      else if (v < 0.055) cv[y]![x] = "q";
      else if (v < 0.07) cv[y]![x] = "N";
    }
  rect(cv, 0, 0, S, 1, "Q"); rect(cv, 0, S - 1, S, 1, "Q"); rect(cv, 0, 0, 1, S, "Q"); rect(cv, S - 1, 0, 1, S, "Q");
  return cv;
}
function floorEdge(corner: boolean): Grid {
  const cv = terrazzo(3, "x");
  rect(cv, 1, 3, 35, 3, "Y"); rect(cv, 1, 6, 35, 1, "y");
  if (corner) { rect(cv, 3, 3, 3, 33, "Y"); rect(cv, 6, 7, 1, 29, "y"); }
  return toGrid(cv);
}
function floorDoor(): Grid {
  const cv = terrazzo(5, "x");
  rect(cv, 3, 4, 31, 29, "c");
  rect(cv, 4, 5, 29, 1, "Y"); rect(cv, 4, 31, 29, 1, "Y"); rect(cv, 4, 5, 1, 27, "Y"); rect(cv, 32, 5, 1, 27, "Y");
  for (let y = 8; y < 30; y += 3) rect(cv, 7, y, 23, 1, "C");
  return toGrid(cv);
}
function roadTile(top: boolean, rails: boolean, east: boolean): Grid {
  const cv = canvas(S, S);
  rect(cv, 0, 0, S, S, "C");
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = hash(x, y, 11); if (v < 0.06) cv[y]![x] = "c"; else if (v < 0.09) cv[y]![x] = "g"; }
  for (let y = 0; y < S; y++) for (let x = 0; x < 5; x++) cv[y]![x] = ((x + y) >> 2) & 1 ? "Y" : "c";
  rect(cv, 5, 0, 1, S, "k");
  if (top) { for (let y = 0; y < 5; y++) for (let x = 0; x < S; x++) cv[y]![x] = ((x + y) >> 2) & 1 ? "Y" : "c"; rect(cv, 5, 5, S - 5, 1, "k"); }
  if (!rails) for (let y = top ? 8 : 2; y < S; y += 10) rect(cv, 36, y, 1, 5, "m");
  if (rails) {
    for (let x = 8; x < S; x += 7) { rect(cv, x, 6, 4, 25, "W"); rect(cv, x, 6, 1, 25, "w"); rect(cv, x, 30, 4, 1, "k"); }
    for (const ry of [11, 24]) { rect(cv, 0, ry - 1, S, 1, "k"); rect(cv, 0, ry, S, 2, "e"); rect(cv, 0, ry, S, 1, "M"); rect(cv, 0, ry + 2, S, 1, "E"); }
  }
  const g = toGrid(cv);
  return east ? mirror(g) : g;
}

// ---------- the back wall ----------
function plaster(cv: Canvas, w: number, shade = false) {
  const base = shade ? "n" : "m";
  rect(cv, 0, 0, w, DADO - 4, base);
  for (let y = 6; y < DADO - 5; y++) for (let x = 0; x < w; x++) if (hash(x, y, 7) < 0.02) cv[y]![x] = shade ? "N" : "n";
  rect(cv, 0, 0, w, 3, "v"); rect(cv, 0, 3, w, 1, "W"); rect(cv, 0, 4, w, 1, "k");
  rect(cv, 0, DADO - 5, w, 1, "k"); rect(cv, 0, DADO - 4, w, 1, "Z"); rect(cv, 0, DADO - 3, w, 2, "r"); rect(cv, 0, DADO - 1, w, 1, "R");
  rect(cv, 0, DADO, w, WH - DADO, "C"); rect(cv, 0, DADO, w, 1, "g"); rect(cv, 0, DADO + 4, w, 1, "c");
  for (let x = 0; x < w; x++) if (x % 37 === 0 || x % 37 === 18) rect(cv, x, DADO + 5, 1, WH - DADO - 11, "c");
  rect(cv, 0, WH - 6, w, 1, "k"); rect(cv, 0, WH - 5, w, 5, "c"); rect(cv, 0, WH - 5, w, 1, "g");
}
function sconce(cv: Canvas, cx: number, by: number) {
  for (let y = by - 18; y < by; y++) {
    const hw = Math.round((by - y) * 0.5 + 3);
    for (let x = cx - hw; x <= cx + hw; x++) if (cv[y]?.[x] === "m" || cv[y]?.[x] === "n") cv[y]![x] = "J";
  }
  rect(cv, cx - 2, by + 2, 5, 9, "k"); rect(cv, cx - 1, by + 3, 3, 7, "W"); rect(cv, cx - 1, by + 3, 1, 7, "w");
  rect(cv, cx - 8, by - 1, 17, 1, "k"); rect(cv, cx - 7, by, 15, 1, "L");
  rect(cv, cx - 8, by + 1, 17, 2, "m"); rect(cv, cx - 7, by + 3, 15, 2, "n"); rect(cv, cx - 5, by + 5, 11, 1, "N");
  rect(cv, cx - 9, by, 1, 3, "k"); rect(cv, cx + 9, by, 1, 3, "k"); rect(cv, cx - 8, by + 3, 1, 2, "k"); rect(cv, cx + 8, by + 3, 1, 2, "k");
  rect(cv, cx - 6, by + 5, 1, 1, "k"); rect(cv, cx + 6, by + 5, 1, 1, "k"); rect(cv, cx - 5, by + 6, 11, 1, "k");
}
function pilaster(cv: Canvas, x: number, h = WH) {
  rect(cv, x - 1, 5, 13, h - 11, "k");
  rect(cv, x, 5, 11, h - 11, "w"); rect(cv, x, 5, 2, h - 11, "v"); rect(cv, x + 9, 5, 2, h - 11, "W");
  rect(cv, x - 3, 5, 17, 5, "k"); rect(cv, x - 2, 5, 15, 4, "v"); rect(cv, x - 2, 8, 15, 1, "w");
}
function wallGrid(kind: "wall" | "pilaster" | "none"): Grid {
  const cv = canvas(S, WH);
  plaster(cv, S, kind === "none");
  if (kind === "wall") sconce(cv, 18, 42);
  if (kind === "pilaster") pilaster(cv, 13);
  return toGrid(cv);
}

// The train (Birdie's: yellow, a dark roof, a red stripe), cab to the right.
const TRAIN: Grid = [
  ".kkkkkkkkkkkkkkkkkkkkkkk..",
  "kcccccccccccccccccccccccck",
  "kYZZZZZZZZZZZZZZZZZZZZZYYk",
  "kYmmYYmmYYmmYYmmYYYYYAAAYk",
  "kYmmYYmmYYmmYYmmYYYYYAAAYk",
  "kYYYYYYYYYYYYYYYYYYYYYYYYk",
  "krrrrrrrrrrrrrrrrrrrrrrrrk",
  "kyyyyyyyyyyyyyyyyyyyyyyyyk",
  "kkkkkkkkkkkkkkkkkkkkkkkkkk",
  ".kgk.kgk..........kgk.kgk.",
];
const ARCH_IN = (x: number, y: number, r: number) =>
  y >= 44 ? Math.abs(x + 0.5 - 37) <= r && y < 76 : (x + 0.5 - 37) ** 2 + (y + 0.5 - 44) ** 2 <= r * r;
function archGrid(trainX: number | null, east: boolean): Grid {
  const cv = canvas(74, WH);
  plaster(cv, 74);
  for (let y = 0; y < 78; y++)
    for (let x = 0; x < 74; x++) {
      if (!ARCH_IN(x, y, 33)) continue;
      if (!ARCH_IN(x, y, 32)) cv[y]![x] = "k";
      else if (!ARCH_IN(x, y, 30)) cv[y]![x] = x < 37 ? "w" : "W";
      else if (!ARCH_IN(x, y, 27)) cv[y]![x] = x < 37 || y < 30 ? "v" : "w";
      else if (!ARCH_IN(x, y, 26)) cv[y]![x] = "k";
      else {
        // the view: sky, far hills, gravel and three tracks receding
        cv[y]![x] = y < 34 ? "S" : y < 48 ? "s" : y < 52 ? (hash(x >> 2, 1, 3) < 0.5 || y > 49 ? "h" : "s") : hash(x, y, 9) < 0.15 ? "N" : "X";
      }
    }
  const inside = (x: number, y: number) => ARCH_IN(x, y, 26);
  const track = (ry: number, gap: number, step: number, tw: number, rail: string) => {
    for (let x = 11; x < 64; x += step) for (let y = ry; y <= ry + gap; y++) for (let i = 0; i < tw; i++) if (inside(x + i, y)) cv[y]![x + i] = "W";
    for (let x = 11; x < 64; x++) for (const y of [ry, ry + gap]) if (inside(x, y)) cv[y]![x] = rail;
  };
  track(54, 1, 3, 1, "E");
  track(60, 3, 4, 2, "E");
  track(67, 5, 6, 3, "e");
  for (let x = 11; x < 64; x++) if (inside(x, 73)) cv[73]![x] = "E";
  if (trainX !== null) stamp(cv, TRAIN, 11 + trainX, 63, inside);
  // sill and keystone
  rect(cv, 3, 75, 68, 1, "k"); rect(cv, 3, 76, 68, 3, "v"); rect(cv, 3, 78, 68, 1, "W"); rect(cv, 3, 79, 68, 1, "k");
  rect(cv, 32, 8, 11, 10, "k"); rect(cv, 33, 9, 9, 8, "Y"); rect(cv, 33, 9, 9, 1, "Z"); rect(cv, 40, 10, 2, 7, "y");
  const g = toGrid(cv);
  return east ? mirror(g) : g;
}

// The split-flap board: pictures only, never letters or numbers.
const ICON: Record<string, Grid> = {
  train: ["YYYYYY..", "YmmYmYY.", "YmmYmYYY", "YYYYYYYY", "rrrrrrrr", "YYYYYYYY", ".g..g.g.", "........"],
  cup: ["........", ".m..m...", "..m..m..", "MMMMMM..", "MmmmmmMM", "MmmmmM.M", ".MmmM.M.", "........"],
  sun: ["...Y....", ".Y...Y..", "...ZZ...", "Y.ZYYZ.Y", "..ZYYZ..", "...ZZ...", ".Y...Y..", "...Y...."],
  tree: ["...hh...", "..hhhh..", ".hhGhhh.", "hhhhhGhh", ".hGhhhh.", "...ww...", "...ww...", "........"],
  bird: ["........", ".oo.....", "okoo..o.", ".ooooooo", "..pooo..", "...oo...", "...y....", "........"],
  plane: ["....m...", "....mm..", "mMMMMMMM", ".mmmmmmm", "....mm..", "....m...", "........", "........"],
  case: ["...rr...", "..r..r..", ".rrrrrr.", ".rRrrRr.", ".rRrrRr.", ".rrrrrr.", ".R....R.", "........"],
  wave: ["........", "........", ".ss...ss", "ssSs.ssS", "s..sss..", "........", "ssss.sss", "........"],
};
const SETS: string[][] = [
  ["train", "tree", "sun", "case", "cup", "bird", "plane", "train"],
  ["plane", "wave", "bird", "train", "sun", "tree", "case", "cup"],
  ["cup", "bird", "train", "wave", "tree", "plane", "sun", "case"],
  ["bird", "sun", "case", "plane", "train", "cup", "wave", "tree"],
  ["tree", "case", "wave", "cup", "bird", "train", "tree", "sun"],
  ["sun", "plane", "cup", "tree", "case", "wave", "train", "bird"],
];
const LAMP_OF = ["h", "Y", "h", "r", "h", "Y"];
export const SHOP_BIRDIE_BOARD_BOX = { x: 10, y: 21, w: 128, h: 51 };
function boardGrid(states: readonly number[], mid: number): Grid {
  const cv = canvas(148, WH);
  plaster(cv, 148);
  rect(cv, 3, 5, 142, 72, "k"); rect(cv, 4, 6, 140, 70, "W"); rect(cv, 4, 6, 140, 1, "v"); rect(cv, 4, 6, 1, 70, "v");
  rect(cv, 7, 8, 134, 66, "c");
  // the header band: a train and a clock face (hands only)
  rect(cv, 8, 9, 132, 9, "Y"); rect(cv, 8, 9, 132, 1, "Z"); rect(cv, 8, 17, 132, 1, "y");
  stamp(cv, ICON.train!.slice(0, 7).map((r) => r.replace(/Y/g, "c").replace(/r/g, "R").replace(/m/g, "Y")), 12, 10);
  ellipse(cv, 131.5, 13.5, 4, 4, "k"); ellipse(cv, 131.5, 13.5, 3, 3, "m"); rect(cv, 131, 11, 1, 3, "k"); rect(cv, 131, 13, 3, 1, "k");
  for (let i = 0; i < 6; i++) rect(cv, 30 + i * 16, 13, 8, 1, "y");
  const { x: bx, y: by } = SHOP_BIRDIE_BOARD_BOX;
  for (let r = 0; r < 3; r++) {
    const now = SETS[(r * 2 + states[r]! * 3) % SETS.length]!;
    const before = SETS[(r * 2 + (1 - states[r]!) * 3) % SETS.length]!;
    for (let i = 0; i < 8; i++) {
      const cx = bx + i * 16;
      const cy = by + r * 17;
      rect(cv, cx + 1, cy + 1, 14, 7, "C"); rect(cv, cx + 1, cy + 9, 14, 7, "F"); rect(cv, cx + 1, cy + 8, 14, 1, "k");
      rect(cv, cx + 1, cy + 1, 14, 1, "g");
      const isLamp = i === 7;
      const top = isLamp ? null : ICON[now[i]!]!;
      const bot = mid === r ? (isLamp ? null : ICON[before[i]!]!) : top;
      if (top) stamp(cv, top.slice(0, 4), cx + 4, cy + 3);
      if (bot) stamp(cv, bot.slice(4), cx + 4, cy + 8);
      if (isLamp) {
        const lamp = LAMP_OF[(r * 2 + states[r]! * 3) % LAMP_OF.length]!;
        rect(cv, cx + 5, cy + 4, 6, 4, lamp); rect(cv, cx + 5, cy + 9, 6, 3, mid === r ? "g" : lamp); rect(cv, cx + 5, cy + 4, 2, 1, "M");
      }
      if (mid === r) { rect(cv, cx + 1, cy + 9, 14, 3, "g"); rect(cv, cx + 1, cy + 12, 14, 1, "k"); rect(cv, cx + 1, cy + 9, 14, 1, "e"); }
    }
  }
  return toGrid(cv);
}

// ---------- furniture ----------
function seatsGrid(): Grid {
  const cv = canvas(111, 36);
  rect(cv, 4, 27, 103, 3, "E"); rect(cv, 4, 27, 103, 1, "e");
  for (const lx of [14, 93]) { rect(cv, lx, 30, 4, 5, "c"); rect(cv, lx - 4, 34, 12, 2, "c"); }
  for (let i = 0; i < 3; i++) {
    const x0 = 5 + i * 35;
    rect(cv, x0 + 2, 1, 27, 8, "Y"); rect(cv, x0 + 2, 1, 27, 1, "Z"); rect(cv, x0 + 2, 8, 27, 1, "y");
    rect(cv, x0, 8, 31, 18, "C"); rect(cv, x0, 8, 31, 1, "g"); rect(cv, x0, 8, 1, 18, "g"); rect(cv, x0, 25, 31, 1, "c");
    rect(cv, x0 + 4, 14, 23, 1, "c");
    cv[8]![x0] = "."; cv[8]![x0 + 30] = ".";
  }
  for (const ax of [1, 37, 72, 107]) { rect(cv, ax, 3, 3, 22, "c"); rect(cv, ax, 3, 3, 1, "g"); }
  return toGrid(cv);
}
function lampGrid(): Grid {
  const cv = canvas(18, 76);
  poly(cv, [[4, 0], [14, 0], [18, 13], [0, 13]], "m");
  poly(cv, [[10, 0], [14, 0], [18, 13], [11, 13]], "n");
  rect(cv, 4, 0, 10, 1, "M"); rect(cv, 0, 12, 18, 1, "L"); rect(cv, 2, 13, 14, 1, "l");
  rect(cv, 8, 14, 2, 58, "w"); rect(cv, 8, 14, 1, 58, "v");
  ellipse(cv, 9, 73.5, 7, 2.5, "W"); rect(cv, 4, 72, 10, 1, "w");
  return toGrid(cv);
}
function plantGrid(): Grid {
  const cv = canvas(30, 48);
  poly(cv, [[15, 31], [1, 9], [8, 12]], "G");
  poly(cv, [[15, 31], [29, 7], [22, 12]], "G");
  poly(cv, [[15, 30], [13, 0], [19, 9]], "h");
  ellipse(cv, 15, 21, 10, 10, "G");
  ellipse(cv, 11, 17, 6, 6, "h");
  ellipse(cv, 20, 26, 6, 5, "H");
  line(cv, 15, 30, 4, 12, "H"); line(cv, 15, 30, 26, 10, "H"); line(cv, 15, 30, 14, 4, "G");
  poly(cv, [[5, 34], [25, 34], [23, 48], [7, 48]], "t");
  poly(cv, [[17, 34], [25, 34], [23, 48], [17, 48]], "T");
  rect(cv, 4, 31, 22, 4, "t"); rect(cv, 4, 31, 22, 1, "U"); rect(cv, 4, 34, 22, 1, "T");
  return toGrid(cv);
}
function shrubGrid(b: boolean): Grid {
  const cv = canvas(30, 32);
  if (!b) {
    ellipse(cv, 15, 12, 13.5, 10, "G"); ellipse(cv, 10, 8, 7, 5, "h"); ellipse(cv, 21, 16, 7, 5, "H");
    for (let i = 0; i < 10; i++) rect(cv, 3 + Math.floor(hash(i, 1, 4) * 24), 4 + Math.floor(hash(i, 2, 4) * 14), 1, 1, i % 2 ? "h" : "H");
    rect(cv, 3, 20, 24, 12, "w"); rect(cv, 3, 20, 24, 2, "v"); rect(cv, 3, 22, 24, 1, "W"); rect(cv, 22, 22, 5, 10, "W");
    rect(cv, 3, 26, 24, 1, "W");
  } else {
    ellipse(cv, 15, 10, 10, 9.5, "G"); ellipse(cv, 12, 7, 5, 4, "h"); ellipse(cv, 19, 14, 5, 4, "H");
    rect(cv, 14, 19, 2, 4, "W");
    poly(cv, [[7, 22], [23, 22], [21, 32], [9, 32]], "t"); poly(cv, [[17, 22], [23, 22], [21, 32], [17, 32]], "T");
    rect(cv, 6, 21, 18, 3, "t"); rect(cv, 6, 21, 18, 1, "U");
  }
  return toGrid(cv);
}
function grain(cv: Canvas, x: number, y: number, w: number, h: number, seed: number) {
  rect(cv, x, y, w, h, "w");
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
    const v = hash(Math.floor(i / 6), j, seed);
    if (v < 0.12 && j % 3 === 0) cv[j]![i] = "W";
    else if (v > 0.93 && j % 4 === 1) cv[j]![i] = "v";
  }
}
// The U-shaped bar: the south run (4 x 1) and its two arms (1 x 3). 22 px tall, its top seen from above.
const FRONT = 28;
function counterGrid(): Grid {
  const cv = canvas(148, S + FRONT);
  grain(cv, 4, 0, 30, S, 2); grain(cv, 115, 0, 30, S, 3); grain(cv, 34, 15, 81, S - 15, 4);
  rect(cv, 4, 0, 1, S, "v"); rect(cv, 33, 0, 1, 15, "m"); rect(cv, 115, 0, 1, 15, "v"); rect(cv, 144, 0, 1, S, "n");
  rect(cv, 34, 15, 81, 1, "m");
  rect(cv, 4, S - 3, 141, 2, "m"); rect(cv, 4, S - 1, 141, 1, "n");
  rect(cv, 4, S, 141, FRONT, "C"); rect(cv, 4, S, 141, 1, "c");
  for (const gx of [40, 111]) rect(cv, gx, S + 2, 1, 16, "c");
  rect(cv, 4, S + 18, 141, 1, "k"); rect(cv, 4, S + 19, 141, 2, "r"); rect(cv, 4, S + 21, 141, 1, "R");
  rect(cv, 4, S + 23, 141, 5, "c"); rect(cv, 4, S + 23, 141, 1, "g");
  // the blank plaque
  rect(cv, 63, S + 3, 22, 9, "k"); rect(cv, 64, S + 4, 20, 7, "b"); rect(cv, 64, S + 4, 20, 1, "Z"); rect(cv, 83, S + 4, 1, 7, "B"); rect(cv, 64, S + 10, 20, 1, "B");
  // the brass service bell
  stamp(cv, ["...kk...", "..kbbk..", ".kbZbbk.", "kbZbbbbk", "kBBBBBBk", ".kkkkkk."], 16, 21);
  // the coffee urn
  stamp(cv, [
    "...kkkkk...", "..kcccccck.", "..kcgcccck.", ".kkkkkkkkkk", ".kMeeeeeeEk", ".kMeeeeeeEk", ".kMeeeeeeEk", ".kMeeeeeeEk",
    ".kMeebbeeEk", ".kMeeeeeeEk", "kkMeeeeeeEk", "kckMeeeeeEk", "kk.kkkkkkkk", "...kcccck..", "...kkkkkk..",
  ], 122, 9);
  rect(cv, 106, 26, 4, 3, "m"); rect(cv, 106, 25, 4, 1, "k"); rect(cv, 105, 26, 1, 3, "k"); rect(cv, 110, 26, 1, 3, "k"); rect(cv, 106, 29, 4, 1, "k"); rect(cv, 107, 26, 2, 1, "W");
  return toGrid(cv);
}
export const SHOP_BIRDIE_COUNTER_SIGN = { piece: "counter", x: 64, y: S + 4, w: 20, h: 7 };
function armGrid(): Grid {
  const cv = canvas(S, 3 * S + FRONT);
  grain(cv, 4, 0, 30, 3 * S, 5);
  rect(cv, 4, 0, 30, 1, "m"); rect(cv, 4, 0, 1, 3 * S, "m"); rect(cv, 5, 0, 1, 3 * S, "v"); rect(cv, 33, 0, 1, 3 * S, "n");
  rect(cv, 4, 3 * S, 30, FRONT, "C"); rect(cv, 4, 3 * S + 13, 30, 3, "r");
  return toGrid(cv);
}
const STOOL_H = 24;
function stoolGrid(): Grid {
  const cv = canvas(22, STOOL_H);
  rect(cv, 10, 9, 3, 11, "c"); rect(cv, 10, 9, 1, 11, "g");
  rect(cv, 5, 14, 13, 1, "b"); rect(cv, 4, 15, 15, 1, "B");
  ellipse(cv, 11, 21.5, 7, 2.5, "c"); rect(cv, 6, 20, 10, 1, "C");
  ellipse(cv, 11, 6, 10.5, 4, "W");
  ellipse(cv, 11, 4.5, 10.5, 4, "w");
  ellipse(cv, 11, 4, 8, 2.8, "Y"); rect(cv, 6, 2, 6, 1, "Z");
  return toGrid(cv);
}
function tableGrid(): Grid {
  const cv = canvas(74, 86);
  for (const lx of [9, 60]) { rect(cv, lx, 66, 5, 18, "w"); rect(cv, lx, 66, 1, 18, "v"); rect(cv, lx + 4, 66, 1, 18, "W"); rect(cv, lx - 1, 83, 7, 3, "W"); }
  rect(cv, 14, 76, 46, 2, "W");
  rect(cv, 6, 0, 62, 62, "M"); rect(cv, 65, 1, 3, 61, "m"); rect(cv, 6, 59, 62, 3, "m"); rect(cv, 8, 2, 1, 55, "m"); rect(cv, 8, 2, 55, 1, "m");
  rect(cv, 6, 62, 62, 4, "w"); rect(cv, 6, 62, 62, 1, "v"); rect(cv, 6, 65, 62, 1, "W");
  return toGrid(cv);
}
function postGrid(): Grid {
  const cv = canvas(S, 86);
  for (let y = 0; y < 52; y++) rect(cv, 30, y, 4, 1, Math.floor(y / 6) % 2 ? "M" : "r");
  rect(cv, 30, 0, 4, 1, "k");
  rect(cv, 28, 52, 8, 7, "c"); rect(cv, 28, 52, 8, 1, "g"); rect(cv, 25, 49, 5, 5, "g");
  rect(cv, 13, 8, 4, 72, "e"); rect(cv, 13, 8, 1, 72, "M"); rect(cv, 16, 8, 1, 72, "E");
  for (const t of [-1, 4]) { line(cv, 3, 2 + t, 26, 15 + t, "r"); line(cv, 3, 15 + t, 26, 2 + t, "r"); }
  for (let t = 0; t < 4; t++) { line(cv, 3, 2 + t, 26, 15 + t, "M"); line(cv, 3, 15 + t, 26, 2 + t, "M"); }
  rect(cv, 2, 23, 27, 11, "c"); rect(cv, 2, 23, 27, 1, "g");
  ellipse(cv, 8.5, 29, 3.6, 3.6, "1"); ellipse(cv, 22.5, 29, 3.6, 3.6, "2");
  rect(cv, 4, 24, 9, 1, "k"); rect(cv, 18, 24, 9, 1, "k"); rect(cv, 7, 27, 1, 1, "M"); rect(cv, 21, 27, 1, 1, "M");
  rect(cv, 12, 37, 6, 5, "c"); rect(cv, 12, 37, 6, 1, "g");
  rect(cv, 9, 80, 12, 6, "c"); rect(cv, 9, 80, 12, 1, "g");
  return toGrid(cv);
}
function hemGrid(): Grid {
  const cv = canvas(S, 24);
  rect(cv, 0, 0, S, 24, "C"); rect(cv, 0, 0, S, 1, "k"); rect(cv, 0, 1, S, 3, "Y"); rect(cv, 0, 1, S, 1, "Z"); rect(cv, 0, 4, S, 1, "y"); rect(cv, 0, 5, S, 1, "k");
  rect(cv, 0, 9, 1, 13, "c"); rect(cv, 18, 9, 1, 13, "c"); rect(cv, 0, 22, S, 2, "c");
  return toGrid(cv);
}
function entranceGrid(): Grid {
  const cv = canvas(74, 110);
  rect(cv, 0, 0, 74, 110, "w"); rect(cv, 0, 0, 74, 2, "v"); rect(cv, 0, 0, 2, 110, "v"); rect(cv, 72, 0, 2, 110, "W");
  rect(cv, 5, 7, 64, 103, "k");
  rect(cv, 6, 8, 62, 102, "d");
  rect(cv, 6, 58, 62, 30, "D");
  for (let x = 6; x < 68; x += 9) rect(cv, x, 50 - (x % 4) * 2, 7, 8 + (x % 4) * 2, "n");
  rect(cv, 46, 14, 8, 8, "Z"); rect(cv, 47, 13, 6, 10, "Z");
  rect(cv, 6, 86, 62, 2, "Y"); rect(cv, 6, 88, 62, 22, "j");
  for (let x = 6; x < 68; x += 10) rect(cv, x, 89, 1, 21, "Q");
  rect(cv, 6, 99, 62, 1, "Q");
  for (const [x, dir] of [[6, 1], [56, -1]] as const) {
    rect(cv, x, 10, 12, 98, "k"); rect(cv, x + 1, 11, 10, 96, "w");
    rect(cv, x + 3, 14, 6, 90, "a");
    for (let i = 0; i < 20; i++) rect(cv, x + 3 + Math.floor(i / 4), 30 + i * 2, 1, 2, "A");
    rect(cv, dir > 0 ? x + 9 : x + 2, 56, 1, 8, "b");
  }
  rect(cv, 4, 106, 66, 4, "b"); rect(cv, 4, 106, 66, 1, "Z");
  rect(cv, 30, 2, 14, 4, "Y"); rect(cv, 30, 2, 14, 1, "Z");
  return toGrid(cv);
}
function sideGrid(east: boolean): Grid {
  const H = 11 * S;
  const cv = canvas(S, H);
  for (let y = 0; y < H; y++) {
    rect(cv, 0, y, 24, 1, "n");
    rect(cv, 24, y, 1, 1, "k"); rect(cv, 25, y, 2, 1, "r"); rect(cv, 27, y, 1, 1, "R"); rect(cv, 28, y, 7, 1, "C"); rect(cv, 28, y, 1, 1, "g");
    rect(cv, 35, y, 1, 1, "k"); rect(cv, 36, y, 1, 1, "c");
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < 24; x++) if (hash(x, y, 13) < 0.02) cv[y]![x] = "N";
  for (const s of [1, 4, 7, 10]) { const y = s * S + 14; rect(cv, 0, y - 1, 24, 8, "k"); rect(cv, 0, y, 23, 6, "w"); rect(cv, 0, y, 23, 1, "v"); rect(cv, 0, y + 5, 23, 1, "W"); }
  for (const s of [] as number[]) {
    const y = s * S + 12;
    for (let j = -8; j < 22; j++) { const hw = 7 - Math.abs(j - 6) / 3; for (let x = Math.round(14 - hw); x <= Math.round(14 + hw); x++) if (cv[y + j]?.[x] === "n") cv[y + j]![x] = "J"; }
    rect(cv, 17, y + 2, 4, 12, "k"); rect(cv, 18, y + 3, 3, 10, "m"); rect(cv, 18, y + 3, 1, 10, "L"); rect(cv, 21, y + 6, 3, 4, "W");
  }
  const g = toGrid(cv);
  return east ? mirror(g) : g;
}
export const SHOP_BIRDIE_SIDE_WALL_GRID: Grid = (() => {
  const cv = canvas(12 * S, WH);
  plaster(cv, 12 * S);
  for (const s of [0, 4, 8, 11]) pilaster(cv, s * S + 13);
  for (const s of [2, 6, 10]) sconce(cv, s * S + 18, 42);
  return toGrid(cv);
})();

// ---------- the birds on the stools ----------
type Pose = "sit" | "bob" | "sip" | "tuck";
const BIRDS = {
  dove: { body: ["....ppp..", "..oooooo.", "OOoooOooo", ".OOOOOOO."], head: [".oo.", "oooo", "ook.", "oooE"], wing: "O" },
  sparrow: { body: [".....cU..", "..uuuUUu.", "uuWuWuuU.", ".UUUUUUU."], head: [".WW.", "WWWW", "UUk.", "UUUE"], wing: "W" },
};
function birdGrid(kind: "dove" | "sparrow", pose: Pose): Grid {
  const cv = canvas(12, 8);
  const b = BIRDS[kind];
  stamp(cv, ["MWM", "MMM"], 9, 6);
  stamp(cv, b.body, 0, 4);
  if (pose === "tuck") { rect(cv, 2, 2, 3, 2, b.wing); rect(cv, 1, 3, 1, 1, b.wing); }
  const [hx, hy] = pose === "bob" ? [6, 1] : pose === "sip" ? [7, 3] : [5, 0];
  stamp(cv, b.head, hx, hy);
  return toGrid(cv);
}
export const SHOP_BIRDIE_PATRONS = [
  { kind: "dove" as const, col: 6, row: 2, faces: "east", poses: ["sit", "sit", "bob", "sit", "sit", "sip", "sip", "sit"] as Pose[] },
  { kind: "sparrow" as const, col: 8, row: 5, faces: "east", poses: ["sit", "bob", "sit", "bob", "tuck", "sit", "sip", "sit"] as Pose[] },
  { kind: "dove" as const, col: 10, row: 5, faces: "west", poses: ["sit", "tuck", "sit", "sip", "sip", "sit", "bob", "sit"] as Pose[] },
];

// ---------- the pieces and the layout ----------
const { parts, add } = lazyParts();
interface PieceDef { w: number; d: number; gw: number; gh: number; dx: number; lift: number; solid: boolean; make: () => Grid; outline?: boolean }
const PIECE_DEFS: Record<string, PieceDef> = {
  "floor-a": { w: 1, d: 1, gw: S, gh: S, dx: 0, lift: 0, solid: false, make: () => toGrid(terrazzo(1, "x")), outline: false },
  "floor-b": { w: 1, d: 1, gw: S, gh: S, dx: 0, lift: 0, solid: false, make: () => toGrid(terrazzo(2, "j")), outline: false },
  "floor-edge": { w: 1, d: 1, gw: S, gh: S, dx: 0, lift: 0, solid: false, make: () => floorEdge(false), outline: false },
  "floor-edge-corner": { w: 1, d: 1, gw: S, gh: S, dx: 0, lift: 0, solid: false, make: () => floorEdge(true), outline: false },
  "floor-door": { w: 1, d: 1, gw: S, gh: S, dx: 0, lift: 0, solid: false, make: floorDoor, outline: false },
  "road-nw": { w: 1, d: 1, gw: S, gh: S, dx: 0, lift: 0, solid: false, make: () => roadTile(true, false, false), outline: false },
  "road-ne": { w: 1, d: 1, gw: S, gh: S, dx: 0, lift: 0, solid: false, make: () => roadTile(true, false, true), outline: false },
  "road-w": { w: 1, d: 1, gw: S, gh: S, dx: 0, lift: 0, solid: false, make: () => roadTile(false, false, false), outline: false },
  "road-e": { w: 1, d: 1, gw: S, gh: S, dx: 0, lift: 0, solid: false, make: () => roadTile(false, false, true), outline: false },
  "road-rail-w": { w: 1, d: 1, gw: S, gh: S, dx: 0, lift: 0, solid: false, make: () => roadTile(false, true, false), outline: false },
  "road-rail-e": { w: 1, d: 1, gw: S, gh: S, dx: 0, lift: 0, solid: false, make: () => roadTile(false, true, true), outline: false },
  wall: { w: 1, d: 1, gw: S, gh: WH, dx: 0, lift: 0, solid: true, make: () => wallGrid("wall"), outline: false },
  "wall-pilaster": { w: 1, d: 1, gw: S, gh: WH, dx: 0, lift: 0, solid: true, make: () => wallGrid("pilaster"), outline: false },
  "wall-none": { w: 1, d: 1, gw: S, gh: WH, dx: 0, lift: 0, solid: true, make: () => wallGrid("none"), outline: false },
  arch: { w: 2, d: 1, gw: 74, gh: WH, dx: 0, lift: 0, solid: true, make: () => archGrid(null, false), outline: false },
  "arch-east": { w: 2, d: 1, gw: 74, gh: WH, dx: 0, lift: 0, solid: true, make: () => archGrid(null, true), outline: false },
  board: { w: 4, d: 1, gw: 148, gh: WH, dx: 0, lift: 0, solid: true, make: () => boardGrid([0, 0, 0], -1), outline: false },
  seats: { w: 3, d: 1, gw: 111, gh: 36, dx: 0, lift: 3, solid: true, make: seatsGrid },
  lamp: { w: 1, d: 1, gw: 18, gh: 76, dx: 10, lift: 8, solid: true, make: lampGrid },
  plant: { w: 1, d: 1, gw: 30, gh: 48, dx: 4, lift: 5, solid: true, make: plantGrid },
  shrub: { w: 1, d: 1, gw: 30, gh: 32, dx: 4, lift: 4, solid: true, make: () => shrubGrid(false) },
  "shrub-b": { w: 1, d: 1, gw: 30, gh: 32, dx: 4, lift: 4, solid: true, make: () => shrubGrid(true) },
  counter: { w: 4, d: 1, gw: 148, gh: S + FRONT, dx: 0, lift: 0, solid: true, make: counterGrid },
  "counter-arm": { w: 1, d: 3, gw: S, gh: 3 * S + FRONT, dx: 0, lift: 0, solid: true, make: armGrid },
  stool: { w: 1, d: 1, gw: 22, gh: STOOL_H, dx: 7, lift: 5, solid: true, make: stoolGrid },
  "match-table": { w: 2, d: 2, gw: 74, gh: 86, dx: 0, lift: 6, solid: true, make: tableGrid },
  "crossing-post": { w: 1, d: 1, gw: S, gh: 86, dx: 0, lift: 3, solid: true, make: postGrid },
  hem: { w: 1, d: 1, gw: S, gh: 24, dx: 0, lift: 0, solid: true, make: hemGrid, outline: false },
  entrance: { w: 2, d: 1, gw: 74, gh: 110, dx: 0, lift: 0, solid: false, make: entranceGrid },
};
for (const [name, def] of Object.entries(PIECE_DEFS)) add(name, () => ({ grid: def.make(), outline: def.outline ?? true }));

export const SHOP_BIRDIE_PIECES = Object.fromEntries(
  Object.entries(PIECE_DEFS).map(([name, d]) => [name, { w: d.w, d: d.d, px: [d.gw, d.gh] as const, lift: d.lift, dx: d.dx, solid: d.solid, part: name }]),
);

export const SHOP_BIRDIE_LAYOUT: ShopPlace[] = [
  { piece: "wall-none", col: 0, row: 0, solid: true },
  { piece: "arch", col: 1, row: 0, w: 2, solid: true },
  { piece: "wall-pilaster", col: 3, row: 0, solid: true },
  { piece: "board", col: 4, row: 0, w: 4, solid: true },
  { piece: "wall", col: 8, row: 0, solid: true },
  { piece: "arch-east", col: 9, row: 0, w: 2, solid: true },
  { piece: "wall-none", col: 11, row: 0, solid: true },
  { piece: "plant", col: 1, row: 1, solid: true },
  { piece: "plant", col: 5, row: 1, solid: true },
  { piece: "stool", col: 6, row: 1, solid: true },
  { piece: "counter-arm", col: 7, row: 1, d: 3, solid: true },
  { piece: "counter-arm", col: 10, row: 1, d: 3, solid: true },
  { piece: "seats", col: 1, row: 2, w: 3, solid: true },
  { piece: "lamp", col: 4, row: 2, solid: true },
  { piece: "stool", col: 6, row: 2, solid: true },
  { piece: "seats", col: 1, row: 3, w: 3, solid: true },
  { piece: "stool", col: 6, row: 3, solid: true },
  { piece: "counter", col: 7, row: 4, w: 4, solid: true },
  { piece: "stool", col: 2, row: 5, solid: true },
  { piece: "match-table", col: 3, row: 5, w: 2, d: 2, solid: true },
  { piece: "stool", col: 5, row: 5, solid: true },
  { piece: "stool", col: 7, row: 5, solid: true },
  { piece: "stool", col: 8, row: 5, solid: true },
  { piece: "stool", col: 9, row: 5, solid: true },
  { piece: "stool", col: 10, row: 5, solid: true },
  { piece: "lamp", col: 1, row: 7, solid: true },
  { piece: "crossing-post", col: 10, row: 8, rot: 2, solid: true },
  { piece: "crossing-post", col: 7, row: 10, solid: true },
  { piece: "shrub-b", col: 1, row: 10, solid: true },
  { piece: "shrub", col: 10, row: 10, solid: true },
  ...[1, 2, 3, 6, 7, 8, 9, 10].map((col): ShopPlace => ({ piece: "hem", col, row: 11, solid: true })),
  { piece: "entrance", col: 4, row: 11, w: 2, exit: true },
];
export const SHOP_BIRDIE_BARTENDER_SPOT = { col: 8, row: 2 };

/** The floor, square by square (null: a wall). */
export const SHOP_BIRDIE_FLOOR: ({ piece: string; rot: 0 | 1 | 2 | 3 } | null)[][] = Array.from({ length: 12 }, (_, r) =>
  Array.from({ length: 12 }, (_, c) => {
    if (r === 0 || c === 0 || c === 11) return null;
    const road: Record<string, string> = { "8,8": "road-nw", "9,8": "road-ne", "8,9": "road-rail-w", "9,9": "road-rail-e", "8,10": "road-w", "9,10": "road-e" };
    if (road[`${c},${r}`]) return { piece: road[`${c},${r}`]!, rot: 0 };
    if (r === 10 && (c === 4 || c === 5)) return { piece: "floor-door", rot: 0 };
    if (r <= 10) {
      if (r === 10 && c === 1) return { piece: "floor-edge-corner", rot: 3 };
      if (r === 10 && c === 10) return { piece: "floor-edge-corner", rot: 2 };
      if (r === 10) return { piece: "floor-edge", rot: 2 };
      if (c === 1) return { piece: "floor-edge", rot: 3 };
      if (c === 10) return { piece: "floor-edge", rot: 1 };
    }
    return { piece: (c + r) % 2 ? "floor-b" : "floor-a", rot: 0 };
  }),
);

export const SHOP_BIRDIE_LIGHTS = [
  { piece: "lamp", col: 4, row: 2, x: 9, y: 13, color: "#ffe2a0", radius: 2.2 },
  { piece: "lamp", col: 1, row: 7, x: 9, y: 13, color: "#ffe2a0", radius: 2.2 },
  { piece: "wall", col: 8, row: 0, x: 18, y: 42, color: "#ffe2a0", radius: 1.4 },
  { piece: "counter", col: 7, row: 4, x: 20, y: 23, color: "#ffb85c", radius: 0.6, soft: true },
  { piece: "counter", col: 7, row: 4, x: 127, y: 16, color: "#ffb85c", radius: 0.7, soft: true },
  { piece: "entrance", col: 4, row: 11, x: 37, y: 50, color: "#fff8e2", radius: 2.6 },
  { piece: "arch", col: 1, row: 0, x: 37, y: 40, color: "#e4f3f8", radius: 1.5, soft: true },
  { piece: "arch-east", col: 9, row: 0, x: 37, y: 40, color: "#e4f3f8", radius: 1.5, soft: true },
  // the far gate (10,8) is drawn turned (rot 2: mirrored), so its lights sit at x 28 and 14
  { piece: "crossing-post", col: 10, row: 8, x: 28, y: 29, color: "#ff5a44", radius: 0.5 },
  { piece: "crossing-post", col: 10, row: 8, x: 14, y: 29, color: "#ff5a44", radius: 0.5 },
  { piece: "crossing-post", col: 7, row: 10, x: 8, y: 29, color: "#ff5a44", radius: 0.5 },
  { piece: "crossing-post", col: 7, row: 10, x: 22, y: 29, color: "#ff5a44", radius: 0.5 },
];
export const SHOP_BIRDIE_POOLS = [
  { col: 4.5, row: 2.5, radius: 1.6, color: "#ffe2a0" },
  { col: 1.5, row: 7.5, radius: 1.6, color: "#ffe2a0" },
  { col: 9, row: 2.5, radius: 1.5, color: "#ffb85c" },
  { col: 4, row: 6, radius: 1.8, color: "#ffe2a0" },
  { col: 5, row: 10.5, radius: 2, color: "#fff8e2" },
];

// ---------- the room as one picture ----------
const X0 = 2;
const Y0 = 2 + WH;
const colX = (c: number) => X0 + c * S;
const rowBot = (r: number) => Y0 + r * S;
const FW = X0 * 2 + 12 * S;
const FH = rowBot(11) + 2;
export const SHOP_BIRDIE_CAM = {
  kind: "front-3/4", square: S, wallH: WH, frame: [FW, FH] as const, origin: [X0, Y0] as const,
  note: "straight-on from the south; floor squares drawn square; pieces stand front-on on their footprint's south edge, less their lift",
};

const boxes: Record<string, { x: number; y: number; w: number; h: number }> = {};
function placeLayer(p: ShopPlace, part: string): Layer {
  const def = PIECE_DEFS[p.piece]!;
  const x = colX(p.col) + def.dx;
  const y = rowBot(p.row + def.d - 1) - def.lift - def.gh;
  boxes[p.piece] ??= { x, y, w: def.gw, h: def.gh };
  // rot 2 on an upright piece: turned to face the other way (the far gate's arm on the road's side)
  return { part, x, y, flipX: p.rot === 2 && def.d === 1 && def.gh > S ? true : undefined };
}
const BOARD_STATES: [number[], number][] = [
  [[0, 0, 0], -1], [[1, 0, 0], 0], [[1, 1, 0], 1], [[1, 1, 1], 2], [[1, 1, 1], -1], [[0, 1, 1], 0], [[0, 0, 1], 1], [[0, 0, 0], 2],
];
const TRAIN_AT = [null, -14, 12, 38];
function roomFrame(f: number): Frame {
  const layers: Layer[] = [];
  for (let r = 1; r < 12; r++)
    for (let c = 1; c < 11; c++) {
      const t = SHOP_BIRDIE_FLOOR[r]![c]!;
      layers.push({ part: t.piece, x: colX(c), y: rowBot(r) - S, rot: t.rot });
    }
  const west = f < 4 ? TRAIN_AT[f]! : null;
  const east = f >= 4 ? TRAIN_AT[f - 4]! : null;
  const [states, mid] = BOARD_STATES[f]!;
  const sorted = [...SHOP_BIRDIE_LAYOUT].sort((a, b) => a.row + (a.d ?? 1) - (b.row + (b.d ?? 1)) || a.col - b.col);
  for (const p of sorted) {
    let part = p.piece;
    if (p.piece === "arch" && west !== null) part = add(`arch@${west}`, () => ({ grid: archGrid(west, false), outline: false }));
    if (p.piece === "arch-east" && east !== null) part = add(`arch-east@${east}`, () => ({ grid: archGrid(east, true), outline: false }));
    if (p.piece === "board") part = add(`board@${states.join("")}${mid}`, () => ({ grid: boardGrid(states, mid), outline: false }));
    layers.push(placeLayer(p, part));
    if (p.row === 0 && p.col === 0) layers.push({ part: "side-west", x: colX(0), y: Y0 });
    if (p.row === 0 && p.col === 11) layers.push({ part: "side-east", x: colX(11), y: Y0 });
    const bird = SHOP_BIRDIE_PATRONS.find((b) => b.col === p.col && b.row === p.row && p.piece === "stool");
    if (bird) {
      const pose = bird.poses[f]!;
      const sx = colX(p.col) + 7;
      const sy = rowBot(p.row) - 5 - STOOL_H;
      layers.push({ part: add(`bird-${bird.kind}-${pose}`, () => ({ grid: birdGrid(bird.kind, pose) })), x: bird.faces === "east" ? sx + 4 : sx + 6, y: sy - 3, flipX: bird.faces === "west" });
    }
  }
  const blinking = f !== 0 && f !== 4;
  const on = f % 2 === 1;
  return { layers, ms: 500, pal: { "1": blinking && on ? LIT : DIM, "2": blinking && !on ? LIT : DIM } };
}
add("side-west", () => ({ grid: sideGrid(false), outline: false }));
add("side-east", () => ({ grid: sideGrid(true), outline: false }));
const IDLE: Frame[] = Array.from({ length: 8 }, (_, f) => roomFrame(f));

// ---------- the review animations (crops of the room, scaled up) ----------
const keysCache = new Map<number, (string | null)[][]>();
function crop(f: number, x: number, y: number, w: number, h: number, sc: number): Grid {
  let keys = keysCache.get(f);
  if (!keys) keysCache.set(f, (keys = frameKeys(SHOP_BIRDIE_INTERIOR, IDLE[f]!)));
  const rows: string[] = [];
  for (let j = 0; j < h * sc; j++) {
    let s = "";
    for (let i = 0; i < w * sc; i++) s += keys[y + Math.floor(j / sc)]?.[x + Math.floor(i / sc)] ?? ".";
    rows.push(s);
  }
  return rows;
}
function review(name: string, box: () => { x: number; y: number; w: number; h: number }) {
  return {
    loop: true,
    frames: IDLE.map((fr, f) => {
      const part = add(`rv-${name}-${f}`, () => {
        const b = box();
        const sc = Math.max(1, Math.min(4, Math.floor((FW - 4) / b.w), Math.floor((FH - 4) / b.h)));
        return { grid: crop(f, b.x, b.y, b.w, b.h, sc), outline: false };
      });
      return { layers: [{ part, x: 2, y: 2 }], ms: 500, pal: fr.pal };
    }),
  };
}
const around = (name: string, m = 6) => () => {
  const b = boxes[name]!;
  return { x: Math.max(0, b.x - m), y: Math.max(0, b.y - m), w: b.w + 2 * m, h: b.h + 2 * m };
};
const area = (c0: number, r0: number, c1: number, r1: number, up = 0) => () => ({ x: colX(c0), y: rowBot(r0) - S - up, w: (c1 - c0 + 1) * S, h: (r1 - r0 + 1) * S + up });

const ANIMS: Record<string, { frames: Frame[]; loop: boolean }> = { idle: { frames: IDLE, loop: true } };
for (const name of Object.keys(PIECE_DEFS)) {
  if (name.startsWith("road") || name.startsWith("floor")) {
    // the tile alone at 4x, twice side by side (to check the seam)
    const part = add(`rvt-${name}`, () => {
      const g = parts[name]!.grid;
      const rows: string[] = [];
      for (let j = 0; j < S * 4; j++) {
        const src = g[Math.floor(j / 4)]!;
        let s = "";
        for (let i = 0; i < S * 4; i++) s += src[Math.floor(i / 4)]!;
        rows.push(s + s.slice(0, S * 2));
      }
      return { grid: rows, outline: false };
    });
    ANIMS[`review-${name}`] = { loop: true, frames: [{ layers: [{ part, x: 2, y: 2 }], ms: 500 }] };
  } else ANIMS[`review-${name}`] = review(name, around(name));
}
ANIMS["review-bar"] = review("bar", area(6, 2, 8, 5, 20));
ANIMS["review-bar-east"] = review("bar-east", area(8, 4, 10, 5, 24));
ANIMS["review-challenge"] = review("challenge", area(2, 4, 5, 6, 30));
ANIMS["review-crossing"] = review("crossing", area(7, 8, 10, 10, 60));
ANIMS["review-floor"] = review("floor", area(5, 7, 6, 7));
ANIMS["review-road"] = review("road", area(8, 8, 9, 10));
ANIMS["review-front"] = review("front", area(0, 8, 11, 11, 10));

export const SHOP_BIRDIE_INTERIOR: Character = {
  id: "shop-birdie-interior",
  name: "Birdie's station",
  w: FW,
  h: FH,
  foot: [FW / 2, FH - 2],
  palette: PALETTE,
  parts,
  anims: ANIMS,
};
export const SHOP_BIRDIE_INTERIOR_2 = { ...SHOP_BIRDIE_INTERIOR, id: "shop-birdie-interior-2" };
