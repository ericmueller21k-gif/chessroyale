/**
 * (Copied from claude/boss-art, scripts/boss-art/out/shop-birdie-interior-4 (1d94041d), Nov 23: the art as drawn; only its preview-only
 * close-ups and review sheets left out. The game's room is shops/birdie-art.ts, built from these parts.)
 *
 * Inside Birdie's station, round 4: the lobby (12 x 12 squares of 37 px under an 83 px back wall: 444 x 527 px).
 *
 * Round 4 changes (Eric, Nov 23): the bar's two arms are raised counters like its front run (a charcoal side face with the red
 * stripe facing the stools, the warm-wood top with a cream edge, a mitred corner where the side face meets the front face);
 * stools along both arms' outsides; a bigger seed heap in the vat and on the counter; the railroad crossing moved from the
 * front-left corner to the table's row (a gravel strip with rails on ties, cols 2-9 of row 7); two crossing gates kitty-corner
 * across the table (col 4 row 6 arm east, col 8 row 8 arm west) with idle / lower / down; no feeders at the table; the table a
 * square chess table (an 8 x 8 board of cream and warm wood, a charcoal and yellow rim) on one leg.
 */
import { type Anim, type Character, type Frame, type Layer, type Part } from "../../characters/sprite.ts";
import { canvas, ellipse, poly, toGrid, type Canvas } from "../../characters/paint.ts";

/** The room is N x N squares. */
export const SHOP_BIRDIE_N = 12;
/** One square, in pixels. */
export const SHOP_BIRDIE_SQUARE = 37;
/** The back wall's height above row 0, in pixels (row r's top is at WALL + r * SQUARE). */
export const SHOP_BIRDIE_WALL = 83;

const S = SHOP_BIRDIE_SQUARE;
const Y0 = SHOP_BIRDIE_WALL;
const W = SHOP_BIRDIE_N * S; // 444
const H = Y0 + SHOP_BIRDIE_N * S; // 527
const colX = (c: number) => c * S;
const rowY = (r: number) => Y0 + r * S;

const LIT = "#ff4a38";
const LIT_HI = "#ffd8c8";
const PALETTE: Record<string, string> = {
  k: "#1b1a1f", // outline
  a: "#efe6d2", // floor-a
  b: "#e3d5ba", // floor-b
  c: "#cbb999", // floor speck
  d: "#a08e72", // floor speck dark
  e: "#fbf8f0", // floor speck light
  w: "#f4ecdc", // wall
  W: "#ddd0b4", // wall shade
  m: "#30333b", // charcoal
  M: "#22242a", // charcoal dark
  n: "#4a505c", // charcoal light
  X: "#16171b", // charcoal deepest (kick under the dark face)
  r: "#cc362d", // red stripe
  R: "#8a2420", // red dark
  y: "#f2c14e", // yellow
  Y: "#c48f25", // yellow dark
  z: "#ffe697", // yellow light
  o: "#9c5f33", // wood
  O: "#6b3c1e", // wood dark
  p: "#c27f48", // wood light
  t: "#8d5a34", // bar top
  u: "#a9703f", // bar top light grain
  v: "#6c4225", // bar top dark grain
  i: "#f6e5bd", // cream edge
  s: "#c6ccd5", // steel
  S: "#7e8692", // steel dark
  g: "#8f8a83", // gravel
  G: "#68645f", // gravel dark
  h: "#b3aea6", // gravel light
  l: "#9fd1ee", // sky
  L: "#4f8fbf", // sea
  f: "#78a956", // green
  F: "#3d7538", // green dark
  j: "#a2d06c", // green light
  P: "#c3643a", // pot
  Q: "#8b4024", // pot dark
  B: "#8d95a1", // bird
  C: "#c5cbd4", // bird light
  D: "#5b626e", // bird dark
  E: "#e8963a", // beak, feet
  A: "#fff4c8", // lamp glow
  H: "#b6def0", // glass
  I: "#e8f6fb", // glass light
  T: "#ffffff", // white
  Z: "#7a4a22", // seed brown
  "1": "#6e211c", // crossing light, left (off: dark red)
  "2": "#6e211c", // crossing light, right (off)
  "7": "#94352b", // crossing light's shine, left (off)
  "8": "#94352b", // crossing light's shine, right (off)
};
const LEFT_ON = { "1": LIT, "7": LIT_HI };
const RIGHT_ON = { "2": LIT, "8": LIT_HI };

// ---------------------------------------------------------------- helpers

const put = (cv: Canvas, x: number, y: number, k: string) => {
  if (y >= 0 && y < cv.length && x >= 0 && x < cv[0]!.length) cv[y]![x] = k;
};
const at = (cv: Canvas, x: number, y: number) => cv[y]?.[x] ?? ".";
const box = (cv: Canvas, x: number, y: number, w: number, h: number, k: string) => {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(cv, i, j, k);
};
/** A steady pseudo-random number in [0, 1) for a pixel (speckles that never change between frames). */
const rnd = (x: number, y: number, s = 0) => {
  let n = Math.imul(x + 7919 * s + 1, 374761393) ^ Math.imul(y + 31 * s + 7, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
};
const stamp = (cv: Canvas, rows: readonly string[], x: number, y: number) =>
  rows.forEach((row, j) => [...row].forEach((k, i) => k !== "." && put(cv, x + i, y + j, k)));
const part = (cv: Canvas, outline = true): Part => ({ grid: toGrid(cv), outline });

// ---------------------------------------------------------------- floor, walls

/** The floor (cream checker, speckled), the side walls, the safety line and the front wall: one flat piece, W x H. */
function floorPart(): Part {
  const cv = canvas(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = Math.floor(x / S);
      const r = Math.floor((y - Y0) / S);
      let k = (((c + r) % 2) + 2) % 2 === 0 ? "a" : "b";
      const n = rnd(x, y, 1);
      if (n < 0.028) k = "c";
      else if (n < 0.038) k = "d";
      else if (n < 0.06) k = "e";
      cv[y]![x] = k;
    }
  // the side walls, seen from above: cream, a brown frame every few squares, a charcoal and red inner edge
  for (const side of [0, 1])
    for (let y = 0; y < H; y++)
      for (let j = 0; j < 35; j++) {
        const x = side ? W - 1 - j : j;
        let k = j < 2 ? "W" : j < 28 ? "w" : j < 31 ? "m" : j < 33 ? "r" : "M";
        if (j >= 2 && j < 28) {
          const m = (y - 60) % 115;
          if (m >= 0 && m < 4) k = m === 0 ? "p" : m === 3 ? "O" : "o";
          else if (rnd(x, y, 2) < 0.03) k = "W";
        }
        cv[y]![x] = k;
      }
  // the safety line: yellow, edged dark, along both sides and the front
  for (let y = 118; y < 489; y++) {
    box(cv, 37, y, 1, 1, "m");
    box(cv, 38, y, 3, 1, "y");
    box(cv, 403, y, 3, 1, "y");
    box(cv, 406, y, 1, 1, "m");
  }
  box(cv, 38, 486, 368, 3, "y");
  box(cv, 37, 489, 370, 1, "m");
  // the front wall
  box(cv, 0, 494, W, 1, "r");
  box(cv, 0, 495, W, 1, "R");
  box(cv, 0, 496, W, 1, "n");
  box(cv, 0, 497, W, H - 497, "m");
  for (let x = 0; x < W; x += S) box(cv, x, 497, 1, H - 497, "M");
  box(cv, 0, H - 1, W, 1, "M");
  return part(cv, false);
}

/** The back wall: a wood cornice, the cream wall, a red stripe and the charcoal wainscot behind row 0. W x 119. */
function backWallPart(): Part {
  const cv = canvas(W, 119);
  for (let y = 0; y < 119; y++)
    for (let x = 0; x < W; x++) {
      let k: string;
      if (y === 0) k = "O";
      else if (y === 1) k = "p";
      else if (y < 4) k = "o";
      else if (y < 73) k = rnd(x, y, 4) < 0.02 ? "W" : "w";
      else if (y < 75) k = "i";
      else if (y < 76) k = "O";
      else if (y < 79) k = "r";
      else if (y < 80) k = "R";
      else if (y < 81) k = "n";
      else if (y < 115) k = x % S === 0 ? "M" : x % S === 1 ? "n" : "m";
      else k = "M";
      cv[y]![x] = k;
    }
  box(cv, 0, 4, W, 1, "W");
  return part(cv, false);
}

/** An arched window, 70 x 72: sky, sea, grass and the outside track; `train` puts a yellow train on it. */
function windowPart(train: boolean): Part {
  const cv = canvas(70, 72);
  const inner = (x: number, y: number) =>
    x >= 6 && x < 64 && y >= 6 && y < 66 && (y >= 35 || (x + 0.5 - 35) ** 2 + (y + 0.5 - 35) ** 2 <= 29 * 29);
  for (let y = 0; y < 72; y++)
    for (let x = 0; x < 70; x++) {
      if (!(y >= 35 || (x + 0.5 - 35) ** 2 + (y + 0.5 - 35) ** 2 <= 35 * 35)) continue;
      if (!inner(x, y)) {
        cv[y]![x] = "o";
        continue;
      }
      let k = y < 44 ? "l" : y < 49 ? "L" : y < 55 ? "f" : "g";
      if (y >= 55 && rnd(x, y, 5) < 0.2) k = "G";
      if (y === 58 || y === 62) k = "S";
      else if (y > 56 && y < 64 && x % 5 === 0) k = "O";
      if (y === 49 && x % 3 === 0) k = "j";
      cv[y]![x] = k;
    }
  // clouds
  for (const [ex, ey, rx, ry] of [[22, 24, 7, 2.6], [46, 17, 5, 2], [50, 31, 4, 1.6]] as const) {
    const c2 = canvas(70, 72);
    ellipse(c2, ex, ey, rx, ry, "T");
    c2.forEach((row, y) => row.forEach((k, x) => k === "T" && at(cv, x, y) === "l" && put(cv, x, y, "T")));
  }
  if (train) {
    for (let x = 32; x < 64; x++)
      for (let y = 40; y < 55; y++) {
        if (!inner(x, y)) continue;
        let k = y === 40 ? "z" : y < 51 ? "y" : y < 53 ? "r" : "m";
        if (y >= 43 && y <= 46 && (x - 32) % 7 >= 2 && (x - 32) % 7 <= 5) k = "H";
        if ((x - 32) % 15 === 14) k = "O";
        put(cv, x, y, k);
      }
  }
  // the frame: lit at the top left, an inner shadow line, a keystone, a sill
  const src = cv.map((r) => [...r]);
  for (let y = 0; y < 72; y++)
    for (let x = 0; x < 70; x++) {
      if (src[y]![x] !== "o") continue;
      const nearIn = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inner(x + dx!, y + dy!));
      if (nearIn) cv[y]![x] = "O";
      else if ((at(src, x - 1, y) === "." || at(src, x, y - 1) === ".") && x < 40) cv[y]![x] = "p";
    }
  box(cv, 31, 0, 8, 6, "y");
  box(cv, 31, 5, 8, 1, "Y");
  box(cv, 0, 66, 70, 6, "o");
  box(cv, 0, 66, 70, 1, "p");
  box(cv, 0, 71, 70, 1, "O");
  return part(cv);
}

const ICONS: Record<string, readonly string[]> = {
  tree: ["...f...", "..fjf..", ".fjfff.", "fffffFf", "..FfF..", "...O...", "...O..."],
  sun: ["...y...", ".y.y.y.", "..yzy..", "yyzzzyy", "..yyy..", ".y.y.y.", "...y..."],
  cake: [".......", "..iii..", ".iiiii.", "ppppppp", "ooooooo", "OOOOOOO", "......."],
  star: ["...T...", "...T...", "TTTTTTT", ".TTTTT.", "..TTT..", ".TT.TT.", "T.....T"],
  train: [".......", "yyyyyy.", "yHyHyyy", "yyyyyyy", "rrrrrrr", ".S..S..", "......."],
  bird: [".......", "..CC...", ".CCkE..", "BBBB...", ".BBBB..", "..BB...", "......."],
  ok: [".......", "......f", ".....ff", "f...ff.", "ff.ff..", ".fff...", "..f...."],
  late: ["..rrr..", ".rrrrr.", "rrTrrrr", "rrTTTrr", "rrrrrrr", ".rrrrr.", "..rrr.."],
  wave: [".......", ".......", "..L..L.", ".LLLLLL", "LLLLLLL", "LLLLLLL", "......."],
  tent: ["...r...", "..rTr..", ".rTrTr.", "rTrTrTr", "TrTrTrT", "rT...Tr", "......."],
};

/** The split-flap board, 140 x 74: a yellow header and four rows of picture flaps (no letters). `alt` turns the last row's flaps. */
function boardPart(alt: boolean): Part {
  const cv = canvas(140, 74);
  box(cv, 0, 0, 140, 74, "o");
  box(cv, 0, 0, 140, 1, "p");
  box(cv, 0, 0, 1, 74, "p");
  box(cv, 0, 73, 140, 1, "O");
  box(cv, 3, 3, 134, 9, "y");
  box(cv, 3, 3, 134, 1, "z");
  box(cv, 3, 11, 134, 1, "Y");
  ellipse(cv, 9, 7.5, 2.6, 2.6, "r");
  box(cv, 129, 6, 3, 3, "T");
  box(cv, 3, 12, 134, 59, "M");
  const rows = [
    ["train", "cake", "cake", "tree", "sun", ".", ".", "ok"],
    ["bird", "tree", "tree", "wave", "sun", ".", ".", "ok"],
    ["train", "tent", "star", "tent", ".", ".", ".", "ok"],
    alt ? ["bird", "wave", "tree", "sun", "star", ".", ".", "ok"] : ["train", "wave", "wave", "tree", ".", ".", ".", "late"],
  ];
  rows.forEach((row, ri) =>
    row.forEach((icon, ci) => {
      const x = 6 + ci * 16;
      const y = 15 + ri * 14;
      box(cv, x, y, 14, 11, "m");
      box(cv, x, y + 5, 14, 1, "M");
      box(cv, x, y, 14, 1, "n");
      if (icon !== ".") stamp(cv, ICONS[icon]!, x + 4, y + 2);
    }),
  );
  return part(cv);
}

/** The shelves of seed jars, 76 x 80. */
function shelvesPart(): Part {
  const cv = canvas(76, 80);
  box(cv, 0, 0, 76, 80, "o");
  box(cv, 0, 0, 76, 1, "p");
  box(cv, 0, 0, 1, 80, "p");
  box(cv, 3, 3, 70, 74, "O");
  const jars = ["y", "i", "Z", "y", "f", "i"];
  [24, 49, 74].forEach((sy, si) => {
    box(cv, 3, sy, 70, 3, "p");
    box(cv, 3, sy + 2, 70, 1, "o");
    for (let j = 0; j < 6; j++) {
      const x = 5 + j * 11;
      const body = jars[(j + si * 2) % 6]!;
      const top = sy - 13;
      box(cv, x, top, 9, 2, "r");
      box(cv, x, top, 9, 1, "z");
      box(cv, x, top + 2, 9, 11, body);
      box(cv, x + 2, top + 6, 5, 4, "T");
      box(cv, x + 1, top + 3, 1, 6, "e");
      box(cv, x + 8, top + 2, 1, 11, body === "Z" ? "O" : "Y");
    }
  });
  return part(cv);
}

/** A wall sconce, 16 x 20. */
function sconcePart(): Part {
  const cv = canvas(16, 20);
  box(cv, 7, 0, 2, 5, "Y");
  poly(cv, [[3, 5], [13, 5], [16, 14], [0, 14]], "i");
  box(cv, 11, 6, 3, 8, "W");
  box(cv, 0, 13, 16, 2, "A");
  box(cv, 4, 5, 8, 1, "Y");
  box(cv, 5, 15, 6, 3, "A");
  return part(cv);
}

// ---------------------------------------------------------------- furniture

/** A floor lamp, 20 x 78. */
function lampPart(): Part {
  const cv = canvas(20, 78);
  poly(cv, [[5, 0], [15, 0], [20, 12], [0, 12]], "i");
  poly(cv, [[12, 0], [15, 0], [20, 12], [15, 12]], "W");
  box(cv, 0, 11, 20, 1, "A");
  box(cv, 0, 12, 20, 1, "Y");
  box(cv, 9, 13, 2, 60, "O");
  box(cv, 9, 13, 1, 60, "p");
  ellipse(cv, 10, 75, 7, 2.6, "O");
  box(cv, 5, 74, 4, 1, "o");
  return part(cv);
}

/** A snake plant in a clay pot, 28 x 52. */
function snakePlantPart(): Part {
  const cv = canvas(28, 52);
  const leaves: [number, number, number, string][] = [[4, 10, 9, "F"], [9, 2, 12, "f"], [14, 0, 14, "j"], [19, 6, 16, "f"], [24, 12, 18, "F"], [12, 8, 15, "F"]];
  for (const [tx, ty, bx, k] of leaves) {
    poly(cv, [[bx - 2.5, 40], [bx + 2.5, 40], [tx + 0.5, ty]], k);
    if (k !== "j") for (let y = ty + 6; y < 38; y += 7) put(cv, Math.round(tx + ((bx - tx) * (y - ty)) / (40 - ty)), y, "j");
  }
  poly(cv, [[4, 36], [24, 36], [22, 52], [6, 52]], "P");
  poly(cv, [[17, 36], [24, 36], [22, 52], [17, 52]], "Q");
  box(cv, 3, 36, 22, 3, "P");
  box(cv, 3, 36, 22, 1, "p");
  box(cv, 18, 37, 7, 2, "Q");
  return part(cv);
}

/** A round topiary in a pot, 30 x 48. */
function topiaryPart(): Part {
  const cv = canvas(30, 48);
  ellipse(cv, 15, 15, 13.5, 13.5, "f");
  ellipse(cv, 18, 18, 10, 10, "F");
  ellipse(cv, 14, 14, 10, 10, "f");
  ellipse(cv, 11, 10, 5, 4, "j");
  for (let y = 2; y < 28; y++) for (let x = 2; x < 28; x++) if (at(cv, x, y) !== "." && rnd(x, y, 6) < 0.08) put(cv, x, y, "F");
  box(cv, 14, 28, 3, 9, "O");
  poly(cv, [[6, 36], [24, 36], [22, 48], [8, 48]], "P");
  poly(cv, [[18, 36], [24, 36], [22, 48], [18, 48]], "Q");
  box(cv, 5, 36, 20, 2, "p");
  return part(cv);
}

/** A wide bush in a wooden planter, 38 x 40. */
function planterPart(): Part {
  const cv = canvas(38, 40);
  ellipse(cv, 10, 16, 9, 9, "f");
  ellipse(cv, 27, 16, 10, 9, "F");
  ellipse(cv, 19, 12, 11, 10, "f");
  ellipse(cv, 15, 8, 5, 3.5, "j");
  for (let y = 0; y < 26; y++) for (let x = 0; x < 38; x++) if (at(cv, x, y) !== "." && rnd(x, y, 7) < 0.08) put(cv, x, y, "F");
  box(cv, 1, 24, 36, 16, "o");
  box(cv, 1, 24, 36, 2, "p");
  box(cv, 1, 38, 36, 2, "O");
  for (let x = 9; x < 36; x += 9) box(cv, x, 26, 1, 12, "O");
  return part(cv);
}

/** A row of three airport seats, 110 x 38: yellow cushions on charcoal backs, a steel rail and legs. */
function seatsPart(): Part {
  const cv = canvas(110, 38);
  for (let i = 0; i < 3; i++) {
    const x = i * 37;
    box(cv, x, 0, 35, 7, "y");
    box(cv, x, 1, 35, 1, "z");
    box(cv, x, 0, 1, 7, "z");
    box(cv, x, 6, 35, 1, "Y");
    box(cv, x, 7, 35, 20, "m");
    box(cv, x, 7, 1, 20, "n");
    box(cv, x, 7, 35, 1, "M");
    box(cv, x, 26, 35, 1, "M");
  }
  box(cv, 0, 28, 110, 2, "s");
  box(cv, 0, 29, 110, 1, "S");
  for (const lx of [8, 54, 100]) {
    box(cv, lx, 30, 2, 6, "S");
    box(cv, lx - 2, 36, 6, 2, "m");
  }
  return part(cv);
}

/** A bar stool, 22 x 32: a yellow round seat, a charcoal pole, a foot ring, a round base. */
function stoolPart(): Part {
  const cv = canvas(22, 32);
  ellipse(cv, 11, 29, 8, 2.7, "m");
  box(cv, 5, 28, 6, 1, "n");
  box(cv, 9, 8, 4, 20, "m");
  box(cv, 9, 8, 1, 20, "n");
  box(cv, 4, 18, 14, 2, "y");
  box(cv, 4, 19, 14, 1, "Y");
  ellipse(cv, 11, 4.5, 11, 4.5, "Y");
  ellipse(cv, 11, 3.6, 11, 3.6, "y");
  box(cv, 4, 1, 7, 1, "z");
  box(cv, 2, 2, 4, 1, "z");
  return part(cv);
}

/** A little grey station bird, 12 x 9, facing left (flip for right). */
const BIRD = [
  "..CCC.......",
  ".CkCCC......",
  "ECCCCC......",
  "..CCBBBBB...",
  "..BBBBBBBBB.",
  ".BBBCCBBBDDD",
  ".BBBBCCBBBD.",
  "..BBBBBBBB..",
  "....E..E....",
];
/** A little house-shaped bird feeder, 12 x 13 (stays on the bar). */
const FEEDER = [
  ".....rr.....",
  "....rrrr....",
  "...rrrrrr...",
  "..rrrrrrRR..",
  ".RRRRRRRRRR.",
  "..iiiiiiii..",
  "..iyyyyyyi..",
  "..iyzyZyyi..",
  "..iyyyyrZi..",
  "..iiiiiiii..",
  ".pppppppppp.",
  ".oooooooooo.",
  "..OOOOOOOO..",
];

/** A mound of seed (yellow, cream, brown, red), lit from the top left, w x h, its base the bottom row. */
function heap(cv: Canvas, cx: number, base: number, rx: number, ry: number, seed: number) {
  for (let y = Math.floor(base - ry); y <= base; y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - (base + 0.5)) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const n = rnd(x, y, seed);
      const lit = -0.6 * nx - 0.8 * ny;
      let k = lit > 0.55 ? "z" : lit < 0.2 ? "Y" : "y";
      if (n < 0.14) k = "i";
      else if (n < 0.27) k = "Z";
      else if (n < 0.33) k = "r";
      else if (n < 0.37) k = "o";
      put(cv, x, y, k);
    }
}

/** The seed vat, 42 x 40: a steel bucket heaped high with seed (twice round 3's heap), a scoop in it. */
function vatPart(): Part {
  const cv = canvas(42, 40);
  poly(cv, [[5, 21], [37, 21], [34, 40], [8, 40]], "s");
  poly(cv, [[29, 21], [37, 21], [34, 40], [28, 40]], "S");
  box(cv, 10, 22, 2, 17, "T");
  box(cv, 6, 27, 31, 2, "S");
  box(cv, 7, 35, 29, 2, "S");
  heap(cv, 21, 22, 20, 21, 8);
  box(cv, 4, 21, 34, 2, "s");
  box(cv, 4, 21, 34, 1, "T");
  box(cv, 31, 21, 7, 2, "S");
  // the scoop: a wooden handle out of the heap
  for (let i = 0; i < 9; i++) box(cv, 30 + i, 9 - i, 2, 2, i < 2 ? "s" : "o");
  box(cv, 28, 9, 5, 3, "s");
  box(cv, 28, 9, 5, 1, "T");
  return part(cv);
}

/** The pile of seed on the counter, 24 x 12 (twice round 3's). */
function pilePart(): Part {
  const cv = canvas(24, 12);
  heap(cv, 12, 11, 12, 11, 9);
  return part(cv);
}

// ---------------------------------------------------------------- the bar

/** The bar's footprint: arms at cols 5 and 8 (rows 1-3), the front run on row 4 (cols 5-8). */
const BAR_X = colX(5); // 185
const BAR_W = 4 * S; // 148
/** How far the counter's top is raised above its footprint (the front face's height). */
const BAR_UP = 36;
const BAR_Y = rowY(1) - BAR_UP; // 84: the arms' raised top starts here
const BAR_H = rowY(5) - BAR_Y; // to the front face's foot (y 268)
/** The width of the arms' side faces. */
const SIDE = 14;

/**
 * The whole U-shaped counter, raised: a warm-wood top with a cream lip, a charcoal front face and the two arms' charcoal
 * side faces (west lit, east in shade), each with the red stripe near the floor and a dark kick; the side faces meet the
 * front face at mitred corners, the stripes meeting on the seam. 148 x 184.
 */
function barPart(): Part {
  const cv = canvas(BAR_W, BAR_H);
  const frontTop = BAR_H - BAR_UP; // 148: the front face's top row
  const runTop = frontTop - S; // 111: the front run's raised top starts here
  const faceKey = (d: number, side: "w" | "f" | "e") => {
    const [kick, red] = side === "f" ? [0.2, 0.3] : [0.15, 0.37];
    if (d < kick) return "M";
    if (d < red) return side === "f" && d > 0.27 ? "R" : "r";
    if (d > (side === "f" ? 0.92 : 0.86)) return "M";
    return side === "w" ? "n" : "m";
  };
  for (let y = 0; y < BAR_H; y++)
    for (let x = 0; x < BAR_W; x++) {
      const dW = x < SIDE ? (x + 0.5) / SIDE : 9;
      const dE = x >= BAR_W - SIDE ? (BAR_W - x - 0.5) / SIDE : 9;
      const dF = y >= frontTop ? (BAR_H - y - 0.5) / BAR_UP : 9;
      const d = Math.min(dW, dE, dF);
      if (d < 9) {
        cv[y]![x] = faceKey(d, d === dF ? "f" : d === dW ? "w" : "e");
        continue;
      }
      const onArm = x < S || x >= BAR_W - S || y >= runTop;
      if (!onArm) continue;
      const n = rnd(x, y, 3);
      let k = n < 0.12 ? "u" : n < 0.2 ? "v" : "t";
      if ((x + Math.floor(y / 3)) % 11 === 0 && n < 0.5) k = "u";
      cv[y]![x] = k;
    }
  // the top's lip: cream on the outer edges, a dark line on the inner edges (the counter's thickness)
  for (let y = 0; y < frontTop; y++) {
    box(cv, SIDE, y, 2, 1, "i");
    box(cv, BAR_W - SIDE - 2, y, 2, 1, "i");
    if (y < runTop) {
      box(cv, S - 1, y, 1, 1, "O");
      box(cv, BAR_W - S, y, 1, 1, "O");
    }
  }
  box(cv, SIDE, frontTop - 2, BAR_W - 2 * SIDE, 2, "i");
  box(cv, S, runTop, BAR_W - 2 * S, 1, "O");
  box(cv, SIDE, 0, S - SIDE, 1, "i");
  box(cv, BAR_W - S, 0, S - SIDE, 1, "i");
  // the mitred corners: a 1 px seam where the side faces meet the front face
  for (let i = 0; i < BAR_UP; i++) {
    const x = Math.floor(((i + 0.5) / BAR_UP) * SIDE);
    put(cv, x, BAR_H - 1 - i, at(cv, x, BAR_H - 1 - i) === "r" ? "r" : "X");
    put(cv, BAR_W - 1 - x, BAR_H - 1 - i, at(cv, BAR_W - 1 - x, BAR_H - 1 - i) === "r" ? "r" : "X");
  }
  // the brass plaque on the front face, a bird on it (a picture, no letters)
  const px = BAR_W / 2 - 14;
  const py = frontTop + 7;
  box(cv, px, py, 28, 9, "Y");
  box(cv, px + 1, py + 1, 26, 7, "y");
  box(cv, px + 1, py + 1, 26, 1, "z");
  stamp(cv, ["..rr.", ".rrrR", "rrrr.", ".R.R."], px + 11, py + 3);
  return part(cv);
}

// ---------------------------------------------------------------- the table on the crossing

/** The chess table, 30 x 47: a square top with an 8 x 8 board (cream and warm wood) in a charcoal and yellow rim, on one leg. */
function tablePart(): Part {
  const cv = canvas(30, 47);
  box(cv, 0, 0, 30, 30, "y");
  box(cv, 0, 0, 30, 1, "z");
  box(cv, 0, 0, 1, 30, "z");
  box(cv, 29, 0, 1, 30, "Y");
  box(cv, 0, 29, 30, 1, "Y");
  box(cv, 1, 1, 28, 28, "m");
  box(cv, 1, 1, 28, 1, "n");
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) box(cv, 3 + c * 3, 3 + r * 3, 3, 3, (r + c) % 2 === 0 ? "i" : "o");
  box(cv, 1, 30, 28, 3, "O");
  box(cv, 1, 30, 28, 1, "o");
  box(cv, 11, 33, 8, 10, "o");
  box(cv, 11, 33, 2, 10, "p");
  box(cv, 17, 33, 2, 10, "O");
  box(cv, 5, 43, 20, 4, "O");
  box(cv, 5, 43, 20, 1, "o");
  box(cv, 5, 43, 2, 3, "p");
  return part(cv);
}

/** The crossing: a gravel strip with two steel rails on wooden ties, hazard-striped edges, cols 2-9 of row 7: 296 x 36. */
const TRACK_X = colX(2);
const TRACK_Y = rowY(7) + 1;
function tracksPart(): Part {
  const w = 8 * S;
  const h = 36;
  const cv = canvas(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const n = rnd(x, y, 10);
      cv[y]![x] = n < 0.2 ? "G" : n < 0.32 ? "h" : "g";
    }
  for (let x = 0; x < w; x++)
    for (const y of [0, 1, h - 2, h - 1]) cv[y]![x] = Math.floor((x + y) / 4) % 2 ? "y" : "M";
  for (let x = 5; x < w - 5; x += 10) {
    box(cv, x, 5, 5, 26, "o");
    box(cv, x, 5, 5, 1, "p");
    box(cv, x + 4, 5, 1, 26, "O");
    box(cv, x, 30, 5, 1, "O");
  }
  for (const ry of [10, 23]) {
    box(cv, 0, ry, w, 1, "T");
    box(cv, 0, ry + 1, w, 1, "s");
    box(cv, 0, ry + 2, w, 1, "S");
  }
  return part(cv);
}

/** The doorway, 74 x 111: a wood frame, glass side lights, the lit town beyond. */
function doorPart(): Part {
  const cv = canvas(74, 111);
  box(cv, 0, 0, 74, 111, "o");
  box(cv, 0, 0, 74, 1, "p");
  box(cv, 0, 0, 1, 111, "p");
  box(cv, 73, 0, 1, 111, "O");
  box(cv, 28, 3, 18, 5, "y");
  box(cv, 28, 3, 18, 1, "z");
  box(cv, 28, 7, 18, 1, "Y");
  box(cv, 6, 10, 62, 1, "O");
  for (const sx of [7, 60]) {
    box(cv, sx, 11, 7, 100, "H");
    box(cv, sx, 11, 2, 100, "I");
  }
  box(cv, 14, 11, 2, 100, "O");
  box(cv, 58, 11, 2, 100, "O");
  box(cv, 16, 11, 42, 100, "A");
  for (const [bx, by, bw] of [[17, 50, 8], [25, 40, 9], [34, 56, 7], [41, 44, 10], [51, 52, 7]] as const) box(cv, bx, by, bw, 76 - by, "z");
  box(cv, 16, 76, 42, 35, "y");
  for (let y = 80; y < 111; y += 8) box(cv, 16, y, 42, 1, "z");
  for (let x = 22; x < 58; x += 9) box(cv, x, 76, 1, 35, "z");
  box(cv, 44, 11, 1, 11, "O");
  box(cv, 40, 22, 10, 8, "z");
  box(cv, 40, 22, 10, 1, "Y");
  box(cv, 40, 29, 10, 1, "Y");
  return part(cv);
}

// ---------------------------------------------------------------- the crossing gate

/** The gate's striped post on its base, 10 x 66. */
function postPart(): Part {
  const cv = canvas(10, 66);
  for (let y = 0; y < 62; y++) {
    const white = Math.floor(y / 5) % 2 === 1;
    box(cv, 3, y, 4, 1, white ? "T" : "r");
    put(cv, 6, y, white ? "W" : "R");
  }
  box(cv, 0, 62, 10, 4, "m");
  box(cv, 0, 62, 10, 1, "n");
  return part(cv);
}

/** The crossbuck, 24 x 16: two white boards edged red. */
function crossbuckPart(): Part {
  const cv = canvas(24, 16);
  const len = Math.hypot(23, 15);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 24; x++) {
      const d1 = Math.abs(15 * x - 23 * y) / len;
      const d2 = Math.abs(15 * (23 - x) - 23 * y) / len;
      const d = Math.min(d1, d2);
      if (d <= 2.3) cv[y]![x] = d <= 1.0 ? "T" : "r";
    }
  box(cv, 11, 7, 2, 2, "m");
  return part(cv);
}

/** The two red lights side by side on their bar, 24 x 9 (keys 1/7 the left, 2/8 the right: a frame's `pal` lights them). */
function lightsPart(): Part {
  const cv = canvas(24, 9);
  box(cv, 2, 3, 20, 3, "m");
  for (const [cx, key, hi] of [[5.5, "1", "7"], [18.5, "2", "8"]] as const) {
    ellipse(cv, cx, 4.5, 4.5, 4.5, "M");
    ellipse(cv, cx, 4.5, 2.8, 2.8, key);
    put(cv, Math.floor(cx) - 1, 3, hi);
    box(cv, Math.floor(cx) - 3, 0, 7, 1, "n");
  }
  return part(cv);
}

/** The arm's motor box on the post, 6 x 8. */
function motorPart(): Part {
  const cv = canvas(6, 8);
  box(cv, 0, 0, 6, 8, "m");
  box(cv, 0, 0, 6, 1, "n");
  box(cv, 0, 0, 1, 8, "n");
  return part(cv);
}

const ARM_LEN = 42;
const PIV: [number, number] = [8.5, 49.5];
/** The striped barrier arm at `deg` above level (90 up, 0 level), pointing east from its pivot (PIV), with its counterweight. 58 x 58. */
function armPart(deg: number): Part {
  const cv = canvas(58, 58);
  const a = (deg * Math.PI) / 180;
  const [ux, uy] = [Math.cos(a), -Math.sin(a)];
  const [nx, ny] = [Math.sin(a), Math.cos(a)];
  for (let y = 0; y < 58; y++)
    for (let x = 0; x < 58; x++) {
      const px = x + 0.5 - PIV[0];
      const py = y + 0.5 - PIV[1];
      const t = px * ux + py * uy;
      const s = px * nx + py * ny;
      if (t >= -8 && t <= 0 && Math.abs(s) <= 2.6) cv[y]![x] = s < -1.2 ? "n" : "m";
      else if (t > 0 && t <= ARM_LEN && Math.abs(s) <= 1.6) {
        const white = Math.floor(t / 6) % 2 === 1;
        cv[y]![x] = s > 0.7 ? (white ? "W" : "R") : white ? "T" : "r";
      }
    }
  ellipse(cv, PIV[0], PIV[1], 2.6, 2.6, "S");
  put(cv, Math.floor(PIV[0]), Math.floor(PIV[1]), "m");
  return part(cv);
}
const ARM_UP = "arm-90";
const ARM_LOWER = ["arm-62", "arm-34", "arm-10", "arm-0"];
const ARM_DOWN = "arm-0";

// ---------------------------------------------------------------- parts

const PARTS: Record<string, Part> = {
  floor: floorPart(),
  "back-wall": backWallPart(),
  "window-sea": windowPart(false),
  "window-train": windowPart(true),
  "flap-board": boardPart(false),
  "flap-board-b": boardPart(true),
  shelves: shelvesPart(),
  sconce: sconcePart(),
  lamp: lampPart(),
  "snake-plant": snakePlantPart(),
  topiary: topiaryPart(),
  planter: planterPart(),
  "airport-seats": seatsPart(),
  stool: stoolPart(),
  bird: part(BIRD.map((r) => [...r])),
  feeder: part(FEEDER.map((r) => [...r])),
  vat: vatPart(),
  "seed-pile": pilePart(),
  bar: barPart(),
  "chess-table": tablePart(),
  "crossing-track": tracksPart(),
  door: doorPart(),
  "gate-post": postPart(),
  "gate-crossbuck": crossbuckPart(),
  "gate-lights": lightsPart(),
  "gate-motor": motorPart(),
  ...Object.fromEntries([90, 62, 34, 10, 0].map((d) => [`arm-${d}`, armPart(d)])),
};
const partW = (p: string) => Math.max(...PARTS[p]!.grid.map((r) => r.length));

// ---------------------------------------------------------------- the gates

export type GateDir = "east" | "west";
/** The two crossing gates, kitty-corner across the table: each one's square, its post's foot (px) and where its arm points. */
export const SHOP_BIRDIE_GATES: readonly { col: number; row: number; foot: readonly [number, number]; arm: GateDir }[] = [
  { col: 4, row: 6, foot: [177, 339], arm: "east" }, // north of the tracks, just left of the bar's front-left corner
  { col: 8, row: 8, foot: [305, 413], arm: "west" }, // south of the tracks, just right of the table's east stool
];

const L = (p: string, x: number, y: number, flipX = false): Layer => (flipX ? { part: p, x, y, flipX } : { part: p, x, y });

/** One gate's layers, its post's foot at (fx, fy), its arm `arm` (a part), pointing `dir`. */
function gateLayers(fx: number, fy: number, arm: string, dir: GateDir): Layer[] {
  const raw: [string, number, number][] = [
    ["gate-post", fx - 5, fy - 66],
    ["gate-motor", fx + 2, fy - 31],
    // the arm behind the lights and the crossbuck, so raised it never hides them
    [arm, fx + 5 - Math.floor(PIV[0]), fy - 27 - Math.floor(PIV[1])],
    ["gate-lights", fx - 12, fy - 54],
    ["gate-crossbuck", fx - 12, fy - 72],
  ];
  return raw.map(([p, x, y]) => (dir === "east" ? L(p, x, y) : L(p, 2 * fx - x - partW(p), y, true)));
}

// ---------------------------------------------------------------- the room

interface Scene {
  /** 0 or 1: which birds have their heads down. */
  bob: number;
  board: string;
  arm: string;
}

const WEST_STOOL_X = BAR_X - 20; // 165: the seat's rim tucked against the west side face
const EAST_STOOL_X = BAR_X + BAR_W - 2; // 331: against the east side face
const FRONT_STOOL_Y = BAR_Y + BAR_H + 3; // 271
const TABLE_X = colX(6) + 4; // 226
const TABLE_Y = rowY(7) - 13; // 329: its foot on the gravel at y 375

function room(sc: Scene): Layer[] {
  const birdOn = (sx: number, sy: number, i: number, flip: boolean) => L("bird", sx + 5, sy - 7 + ((i + sc.bob) % 2), flip);
  const ls: Layer[] = [
    L("floor", 0, 0),
    L("back-wall", 0, 0),
    L("window-sea", 39, 4),
    L("window-train", 335, 4),
    L(sc.board, 114, 4),
    L("shelves", 257, 4),
    L("sconce", 10, 16),
    L("sconce", 418, 16),
    L("crossing-track", TRACK_X, TRACK_Y),
    L("snake-plant", 44, 104),
    L("lamp", 121, 78),
    L("vat", 224, 115),
    L("bar", BAR_X, BAR_Y),
    // the feeders stand on the raised tops of the arms and the front run; the seed pile on the front run
    L("feeder", 204, 98),
    L("feeder", 204, 160),
    L("feeder", 301, 102),
    L("feeder", 301, 164),
    L("feeder", 204, 206),
    L("seed-pile", 294, 207),
  ];
  // stools along the arms (cols 4 and 9, rows 1-3), against the side faces
  for (let r = 1; r <= 3; r++) {
    ls.push(L("stool", WEST_STOOL_X, rowY(r) + 3));
    ls.push(L("stool", EAST_STOOL_X, rowY(r) + 3));
  }
  ls.push(birdOn(WEST_STOOL_X, rowY(1) + 3, 0, true), birdOn(WEST_STOOL_X, rowY(3) + 3, 1, false), birdOn(EAST_STOOL_X, rowY(2) + 3, 1, false));
  ls.push(L("airport-seats", 40, 222), L("airport-seats", 40, 260));
  // stools along the front run (row 5)
  [5, 6, 7, 8].forEach((c) => ls.push(L("stool", colX(c) + 7, FRONT_STOOL_Y)));
  ls.push(birdOn(colX(5) + 7, FRONT_STOOL_Y, 0, false), birdOn(colX(7) + 7, FRONT_STOOL_Y, 1, true));
  ls.push(L("snake-plant", 374, 251));
  const [wg, eg] = SHOP_BIRDIE_GATES;
  ls.push(...gateLayers(wg!.foot[0], wg!.foot[1], sc.arm, wg!.arm));
  // the table on the crossing, a stool each side facing each other
  ls.push(L("stool", colX(5) + 7, rowY(7)), L("stool", colX(7) + 7, rowY(7)), L("chess-table", TABLE_X, TABLE_Y));
  ls.push(L("lamp", 45, 298), L("lamp", 379, 298));
  ls.push(...gateLayers(eg!.foot[0], eg!.foot[1], sc.arm, eg!.arm));
  ls.push(L("topiary", 302, 443), L("planter", 368, 450), L("door", 148, 416));
  return ls;
}

const IDLE: Frame[] = [0, 1, 2, 3].map((i) => ({
  layers: room({ bob: i % 2, board: i < 2 ? "flap-board" : "flap-board-b", arm: ARM_UP }),
  ms: 700,
}));
const LOWER: Frame[] = ARM_LOWER.map((arm, i) => ({
  layers: room({ bob: 0, board: "flap-board", arm }),
  ms: 160,
  pal: i % 2 ? RIGHT_ON : LEFT_ON,
  ...(i === 0 ? { cue: "crossing" } : {}),
}));
const DOWN: Frame[] = [LEFT_ON, RIGHT_ON].map((pal, i) => ({ layers: room({ bob: i, board: "flap-board", arm: ARM_DOWN }), ms: 500, pal }));

const idleAnim: Anim = { frames: IDLE, loop: true };
const still: Anim = { frames: [IDLE[0]!], loop: false };

/** The whole lobby: its idle has both gates up and dark; `gates-lower` / `gates-down` play them for a battle's start. */
export const SHOP_BIRDIE_INTERIOR_4: Character = {
  id: "shop-birdie-interior-4",
  name: "Inside Birdie's station",
  w: W,
  h: H,
  foot: [W / 2, H - 1],
  palette: PALETTE,
  parts: PARTS,
  anims: {
    idle: idleAnim,
    "gates-lower": { frames: LOWER, loop: false },
    "gates-down": { frames: DOWN, loop: true },
    ...Object.fromEntries(["entrance", "thinking", "move", "capture", "hurt", "check", "smug", "rattled", "defeat", "victory"].map((n) => [n, n === "thinking" ? idleAnim : still])),
  },
};

/**
 * One crossing gate on its own (`crossing-post`, a 1 x 1 square's piece; place it by `foot`, the post's foot), drawn with its
 * arm pointing east: flip it for SHOP_BIRDIE_GATES' west gate. idle: arm up, lights dark. lower: 4 frames, the arm swinging
 * down to level, the lights flashing. down: arm level, the lights in turn, 500 ms each, looping.
 */
const GFX = 16;
const GFY = 80;
export const SHOP_BIRDIE_GATE: Character = {
  id: "shop-birdie-gate",
  name: "Crossing gate",
  w: 76,
  h: 82,
  foot: [GFX, GFY],
  palette: PALETTE,
  parts: PARTS,
  anims: {
    idle: { frames: [{ layers: gateLayers(GFX, GFY, ARM_UP, "east"), ms: 1000 }], loop: true },
    lower: { frames: ARM_LOWER.map((arm, i) => ({ layers: gateLayers(GFX, GFY, arm, "east"), ms: 160, pal: i % 2 ? RIGHT_ON : LEFT_ON })), loop: false },
    down: { frames: [LEFT_ON, RIGHT_ON].map((pal) => ({ layers: gateLayers(GFX, GFY, ARM_DOWN, "east"), ms: 500, pal })), loop: true },
  },
};
