/**
 * (Copied from claude/boss-art, scripts/boss-art/out/shop-birdie-interior-3, Nov 23: the art as drawn; only its preview-only close-ups
 * left out. The game's room is shops/birdie-art.ts, built from these parts.)
 *
 * Inside Birdie's station, third pass: the lobby the player walks into from Birdie's train station.
 *
 * A 12 x 12 room (columns 0-11 west to east, rows 0-11 north to south, the way in at the south), seen from round 1's
 * fixed camera: straight down on the floor, the back wall (row 0) standing up as a face WALL_H tall, the side walls
 * (cols 0 and 11) laid out as strips. One square is 37 px. Row r's floor starts at y = 83 + 37 r; the back wall's face
 * fills y 0-119 (its last 37 px are row 0's footprint, the wainscot). Pieces stand on their footprint's bottom edge.
 *
 * New this pass: shelves of seed behind the bar, stools on all three outer sides of the U with birds on them, feeders on
 * the counter in place of drinks, a seed vat inside the U beside the bartender's place, a small white-top challenge
 * table with a stool each side and feeders on and beside it, and a gravel railroad crossing in the front-left corner
 * with its two gates kitty-corner.
 */
import { type Character, type Frame, type Grid, type Layer, type Part } from "../../characters/sprite.ts";
import { canvas, ellipse, line, poly, toGrid, type Canvas } from "../../characters/paint.ts";

// ---------------------------------------------------------------------------------------------------------------------
// Geometry

/** Squares per side. */
export const SHOP_BIRDIE_N = 12;
/** One square, in pixels. */
const T = 37;
/** The back wall's face height in pixels (row 0's footprint is its bottom 37 px). */
export const SHOP_BIRDIE_WALL_H = 120;
/** The top of row 0's footprint. */
const Y0 = SHOP_BIRDIE_WALL_H - T;
const RW = SHOP_BIRDIE_N * T; // 444
const RH = Y0 + SHOP_BIRDIE_N * T; // 527
const colX = (c: number) => c * T;
const rowY = (r: number) => Y0 + r * T;
/** The counter's height: its top surface is drawn this far above its footprint. */
const COUNTER_H = 31;

// ---------------------------------------------------------------------------------------------------------------------
// Palette: Birdie's train (yellow, charcoal, red), warm wood, cream terrazzo, seed colors

const PALETTE: Record<string, string> = {
  k: "#1a1714", // outline, warm near-black
  K: "#241f1b", // a sparrow's bib, deep shadow
  // train yellow
  y: "#f4c430",
  Y: "#d9a21b",
  u: "#ffe27a",
  // charcoal
  c: "#2b2d31",
  C: "#3a3d44",
  g: "#54575f",
  // train red
  r: "#c8372d",
  R: "#8e1f1a",
  // warm wood
  w: "#a86a3c",
  W: "#7a4a26",
  o: "#c99866",
  // cream and white
  e: "#f3f1ec",
  q: "#ffffff",
  E: "#dcd6cc", // cream in shade
  // terrazzo floor
  f: "#efe7d9",
  F: "#e4d8c4",
  G: "#d4c6ae", // grout
  "1": "#c9b494",
  "2": "#b59f80",
  "3": "#faf6ee",
  "4": "#a9b9bf",
  // greens and pots
  v: "#4f7a3a",
  V: "#6f9a4f",
  n: "#2f4f25",
  t: "#b5643a",
  T: "#87452a",
  // seed
  s: "#e8c15a",
  S: "#f2e3b8",
  b: "#8a5a2e",
  x: "#b5452e",
  // warm light
  l: "#ffe2a0",
  L: "#ffb85c",
  // steel, glass, sky
  m: "#9aa3ad",
  M: "#cdd5dc",
  j: "#6d7580",
  i: "#bfe3ef",
  I: "#e8f7fb",
  a: "#d8eef6",
  A: "#a9d3e6",
  // gravel
  z: "#948b7e",
  Z: "#6f675d",
  p: "#b4ab9c",
  // birds: dove gray-blue, sparrow brown
  d: "#97a5ba",
  D: "#6c7a91",
  P: "#e9edf2",
  B: "#a2703f",
  N: "#5e3b1f",
};

// ---------------------------------------------------------------------------------------------------------------------
// Helpers

const parts: Record<string, Part> = {};
const def = (name: string, grid: Grid, outline = true): string => {
  parts[name] = { grid, outline };
  return name;
};

const put = (cv: Canvas, x: number, y: number, k: string) => {
  if (y >= 0 && y < cv.length && x >= 0 && x < cv[0]!.length) cv[y]![x] = k;
};
const rect = (cv: Canvas, x: number, y: number, w: number, h: number, k: string) => {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(cv, i, j, k);
};
const hline = (cv: Canvas, x0: number, x1: number, y: number, k: string) => rect(cv, x0, y, x1 - x0 + 1, 1, k);
const vline = (cv: Canvas, x: number, y0: number, y1: number, k: string) => rect(cv, x, y0, 1, y1 - y0 + 1, k);

/** A steady pseudo-random number in [0, 1) for a pixel and a seed. */
function hash(x: number, y: number, s: number): number {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 982451653)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

/** Pastes typed rows onto a canvas (`.` stays). */
function stamp(cv: Canvas, rows: Grid, x: number, y: number, flip = false) {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const k = row[flip ? row.length - 1 - i : i]!;
      if (k !== "." && k !== " ") put(cv, x + i, y + j, k);
    }
  });
}

/** Pastes typed rows with a 1-pixel `k` outline of their own (for small things inside a bigger part). */
function stampOutlined(cv: Canvas, rows: Grid, x: number, y: number, flip = false) {
  const w = Math.max(...rows.map((r) => r.length));
  const at = (i: number, j: number) => {
    const row = rows[j];
    if (!row || i < 0 || i >= w) return false;
    const k = row[flip ? w - 1 - i : i];
    return k !== undefined && k !== "." && k !== " ";
  };
  for (let j = -1; j <= rows.length; j++)
    for (let i = -1; i <= w; i++)
      if (!at(i, j) && (at(i + 1, j) || at(i - 1, j) || at(i, j + 1) || at(i, j - 1))) put(cv, x + i, y + j, "k");
  stamp(cv, rows.map((r) => r.padEnd(w, ".")), x, y, flip);
}

/** Scatters flecks over a rectangle: `keys` with their chances. */
function fleck(cv: Canvas, x: number, y: number, w: number, h: number, seed: number, keys: readonly (readonly [string, number])[]) {
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + w; i++) {
      let r = hash(i, j, seed);
      for (const [k, p] of keys) {
        if (r < p) {
          put(cv, i, j, k);
          // some flecks are little dashes
          if (hash(i, j, seed + 7) < 0.35 && i + 1 < x + w) put(cv, i + 1, j, k);
          break;
        }
        r -= p;
      }
    }
}

// ---------------------------------------------------------------------------------------------------------------------
// Floor: terrazzo, cream and warm stone flecks, grout on all four sides (so turned tiles meet with no seam)

function terrazzo(base: string, seed: number): Canvas {
  const cv = canvas(T, T);
  rect(cv, 0, 0, T, T, "G");
  rect(cv, 1, 1, T - 2, T - 2, base);
  fleck(cv, 2, 2, T - 4, T - 4, seed, [["1", 0.045], ["2", 0.018], ["3", 0.03], ["4", 0.006]]);
  return cv;
}
def("floor-a", toGrid(terrazzo("f", 11)), false);
def("floor-b", toGrid(terrazzo("F", 23)), false);
/** The yellow safety line along the tile's west side (turn it for the others). */
function safety(cv: Canvas, side: "w" | "s") {
  if (side === "w") {
    vline(cv, 2, 0, T - 1, "Y");
    vline(cv, 3, 0, T - 1, "y");
    vline(cv, 4, 0, T - 1, "y");
    vline(cv, 5, 0, T - 1, "k");
  } else {
    hline(cv, 0, T - 1, T - 3, "Y");
    hline(cv, 0, T - 1, T - 4, "y");
    hline(cv, 0, T - 1, T - 5, "y");
    hline(cv, 0, T - 1, T - 6, "k");
  }
}
{
  const a = terrazzo("f", 31);
  safety(a, "w");
  def("floor-edge", toGrid(a), false);
  const b = terrazzo("F", 37);
  safety(b, "s");
  safety(b, "w");
  // tidy the corner: the west line stops at the south line
  rect(b, 2, T - 6, 4, 1, "y");
  put(b, 5, T - 6, "y");
  rect(b, 5, T - 6, 1, 1, "y");
  def("floor-edge-corner", toGrid(b), false);
}
{
  // the doormat at the way in: charcoal bristle with a yellow inset border (west half; mirrored for the east half)
  const cv = terrazzo("f", 41);
  rect(cv, 3, 3, T - 3, T - 6, "c");
  hline(cv, 3, T - 1, 3, "k");
  hline(cv, 3, T - 1, T - 4, "k");
  vline(cv, 3, 3, T - 4, "k");
  hline(cv, 5, T - 1, 5, "Y");
  hline(cv, 5, T - 1, T - 6, "Y");
  vline(cv, 5, 5, T - 6, "Y");
  for (let j = 7; j < T - 7; j += 2) for (let i = 7; i < T; i += 3) put(cv, i + (j % 4 === 1 ? 1 : 0), j, "C");
  def("floor-door", toGrid(cv), false);
}

// ---------------------------------------------------------------------------------------------------------------------
// The side walls: one surface each, laid out flat like the floor (cream plaster, wood bands every 3 squares, the
// charcoal wainscot with its red stripe along the floor's edge). East is the west one mirrored.

const SIDE_H = SHOP_BIRDIE_N * T - T; // rows 1-11: 407 px
function sideWall(): Canvas {
  const cv = canvas(T, SIDE_H);
  rect(cv, 0, 0, 26, SIDE_H, "e");
  fleck(cv, 0, 0, 26, SIDE_H, 51, [["E", 0.05], ["1", 0.01]]);
  vline(cv, 25, 0, SIDE_H - 1, "E");
  vline(cv, 26, 0, SIDE_H - 1, "k");
  vline(cv, 27, 0, SIDE_H - 1, "r");
  vline(cv, 28, 0, SIDE_H - 1, "r");
  vline(cv, 29, 0, SIDE_H - 1, "k");
  rect(cv, 30, 0, 6, SIDE_H, "C");
  vline(cv, 30, 0, SIDE_H - 1, "g");
  vline(cv, 36, 0, SIDE_H - 1, "c");
  for (let y = 18; y < SIDE_H; y += 18) hline(cv, 30, 35, y, "c");
  for (let y = 51; y < SIDE_H; y += 111) {
    hline(cv, 0, 25, y, "k");
    hline(cv, 0, 25, y + 1, "o");
    rect(cv, 0, y + 2, 26, 3, "w");
    hline(cv, 0, 25, y + 5, "W");
    hline(cv, 0, 25, y + 6, "k");
  }
  return cv;
}
export const SHOP_BIRDIE_SIDE_WALL_GRID: Grid = toGrid(sideWall());
def("side-wall", SHOP_BIRDIE_SIDE_WALL_GRID, false);

// ---------------------------------------------------------------------------------------------------------------------
// The back wall, one square wide a segment: wood cornice, cream plaster, a red stripe, the charcoal wainscot

function wallSeg(seed: number, kind: "wall" | "pilaster" | "none"): Canvas {
  const cv = canvas(T, SHOP_BIRDIE_WALL_H);
  hline(cv, 0, T - 1, 0, "k");
  rect(cv, 0, 1, T, 2, "w");
  hline(cv, 0, T - 1, 1, "o");
  hline(cv, 0, T - 1, 3, "W");
  rect(cv, 0, 4, T, 73, "e");
  fleck(cv, 0, 5, T, 71, seed, [["E", 0.05], ["1", 0.008]]);
  hline(cv, 0, T - 1, 4, "E");
  hline(cv, 0, T - 1, 77, "k");
  rect(cv, 0, 78, T, 2, "r");
  hline(cv, 0, T - 1, 80, "k");
  rect(cv, 0, 81, T, 34, "C");
  hline(cv, 0, T - 1, 81, "g");
  for (let x = 0; x < T; x++) if ((x + seed * 0) % 18 === 8) vline(cv, x, 82, 114, "c");
  rect(cv, 0, 115, T, 4, "c");
  hline(cv, 0, T - 1, 115, "k");
  hline(cv, 0, T - 1, 119, "k");
  if (kind === "pilaster") {
    rect(cv, 13, 2, 11, 2, "W");
    rect(cv, 14, 4, 9, 111, "w");
    vline(cv, 14, 4, 114, "o");
    vline(cv, 22, 4, 114, "W");
    vline(cv, 13, 4, 114, "k");
    vline(cv, 23, 4, 114, "k");
    hline(cv, 12, 24, 4, "k");
    hline(cv, 12, 24, 5, "o");
    hline(cv, 12, 24, 6, "k");
  }
  if (kind === "none") {
    // the room's back corner: a soft shade down the plaster and the wainscot
    vline(cv, 0, 4, 76, "E");
    vline(cv, 1, 4, 76, "E");
  }
  return cv;
}
def("wall", toGrid(wallSeg(61, "wall")), false);
def("wall-b", toGrid(wallSeg(67, "wall")), false);
def("wall-pilaster", toGrid(wallSeg(71, "pilaster")), false);
def("wall-none", toGrid(wallSeg(73, "none")), false);

// ---------------------------------------------------------------------------------------------------------------------
// The arched windows onto the tracks: a wood arch, a yellow keystone, sky, a hedge, the rails; a train passes now and then

const ARCH_W = 66;
const ARCH_H = 72;
/** `train`: the train's nose x inside the window (null: no train); `dir` 1 runs east, -1 west. */
function arch(train: number | null, dir: 1 | -1): Canvas {
  const cv = canvas(ARCH_W, ARCH_H);
  const cx = 33;
  const cy = 32;
  const outer = (x: number, y: number) =>
    x >= 0 && x < ARCH_W && y >= 0 && y < ARCH_H - 4 && (y >= cy || (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= 33 * 33);
  const inner = (x: number, y: number) =>
    x >= 6 && x < ARCH_W - 6 && y < ARCH_H - 6 && (y >= cy || (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= 27 * 27);
  for (let y = 0; y < ARCH_H; y++)
    for (let x = 0; x < ARCH_W; x++) {
      if (!outer(x, y)) continue;
      if (inner(x, y)) {
        // the view: sky, hedge, ballast and rails
        let k = y < 30 ? "a" : y < 43 ? "A" : y < 47 ? "V" : y < 49 ? "p" : "z";
        if (y === 43 && hash(x, y, 3) < 0.5) k = "V";
        if (y === 46 && hash(x, y, 5) < 0.4) k = "v";
        if (y >= 50 && y <= 55 && x % 5 < 2) k = "W";
        if (y === 51 || y === 55) k = "m";
        if (y >= 57 && hash(x, y, 9) < 0.2) k = "Z";
        cv[y]![x] = k;
      } else {
        const lit = !outer(x - 1, y) || !outer(x, y - 1);
        const dark = !outer(x + 1, y) || inner(x - 1, y) || inner(x, y - 1);
        cv[y]![x] = lit ? "o" : dark ? "W" : "w";
      }
    }
  // the window's own edge
  for (let y = 0; y < ARCH_H; y++)
    for (let x = 0; x < ARCH_W; x++)
      if (inner(x, y) && (!inner(x - 1, y) || !inner(x + 1, y) || !inner(x, y - 1))) cv[y]![x] = "k";
  if (train !== null) {
    // two yellow cars with a red stripe, clipped to the window
    const car = (x0: number) => {
      for (let y = 33; y <= 50; y++)
        for (let x = x0; x < x0 + 30; x++) {
          if (!inner(x, y) || cv[y]![x] === "k") continue;
          const lx = x - x0;
          const nose = dir === 1 ? lx >= 27 && y < 36 + (lx - 27) : lx <= 2 && y < 36 + (2 - lx);
          if (nose) continue;
          let k = y === 33 ? "Y" : y <= 41 ? "y" : y <= 43 ? "r" : y <= 46 ? "y" : y <= 48 ? "c" : "k";
          if (y >= 35 && y <= 39 && lx % 7 >= 2 && lx % 7 <= 5) k = y === 35 ? "i" : "I";
          if (y === 49 && (lx % 10 === 3 || lx % 10 === 6)) k = "g";
          if (lx === 0 || lx === 29) k = y >= 47 ? "k" : "Y";
          cv[y]![x] = k;
        }
    };
    car(train);
    car(train - dir * 32);
    car(train - dir * 64);
  }
  // keystone
  rect(cv, 28, 0, 10, 8, "k");
  rect(cv, 29, 1, 8, 6, "y");
  vline(cv, 36, 1, 6, "Y");
  hline(cv, 29, 35, 1, "u");
  // sill
  hline(cv, 0, ARCH_W - 1, ARCH_H - 4, "k");
  rect(cv, 0, ARCH_H - 3, ARCH_W, 2, "w");
  hline(cv, 0, ARCH_W - 1, ARCH_H - 3, "o");
  hline(cv, 0, ARCH_W - 1, ARCH_H - 1, "W");
  return cv;
}
/** The train's nose per idle frame (null: none). West arch: an eastbound train; east arch: a westbound one, later. */
const TRAIN_W = [null, -10, 22, 54, 86, 118, null, null] as const;
const TRAIN_E = [18, -14, -46, -78, null, null, null, 50] as const;
for (let f = 0; f < 8; f++) {
  def(`arch-${f}`, toGrid(arch(TRAIN_W[f] ?? null, 1)));
  def(`arch-east-${f}`, toGrid(arch(TRAIN_E[f] ?? null, -1)));
}
def("arch", parts["arch-0"]!.grid);
def("arch-east", parts["arch-east-4"]!.grid);

// ---------------------------------------------------------------------------------------------------------------------
// The split-flap board: pictures only, no letters or numbers. Three rows of seven picture flaps and a green status
// flap; each row flips in turn.

const ICONS: Record<string, Grid> = {
  train: [".YYYYY.", "yyyyyyy", "yIyIyIy", "yyyyyyy", "rrrrrrr", "yyyyyyy", ".m...m."],
  tree: ["...V...", "..VVV..", ".VVVVV.", "..VvV..", ".VVvVV.", "VVVVVvV", "...W..."],
  sun: ["u..y..u", "..yyy..", ".yuuuy.", "yyuuuyy", ".yuuuy.", "..yyy..", "u..y..u"],
  dove: ["..qq...", ".qkqY..", ".qqq...", "qqqqqq.", ".qqqqqq", "..qqq..", "..Y.Y.."],
  cloud: [".......", "..MM...", ".MqqM..", "MqqqqMM", "MqqqqqM", ".MMMMM.", "......."],
  plane: ["...m...", "...M...", "..mMm..", "mmMMMmm", "...M...", "..mMm..", "...m..."],
  sack: ["..sxs..", ".osSso.", ".owwwo.", "owwwwwo", "owWwWwo", "owwwwwo", ".ooooo."],
  feeder: ["..WWW..", ".WWWWW.", "..IsI..", "..IsI..", "..IxI..", ".wwwww.", "...W..."],
};
const ICON_ORDER = ["train", "tree", "sun", "sack", "dove", "plane", "cloud", "feeder"] as const;
const BOARD_W = 140;
const BOARD_H = 72;
const FLAP_X = 6;
const FLAP_Y = 14;
/** The flap grid in the board's pixels. */
export const SHOP_BIRDIE_BOARD_BOX = { x: FLAP_X, y: FLAP_Y, w: 128, h: 52 } as const;

/** `offs`: each row's icon offset; `flipRow`: the row caught mid-flip (or -1). */
function board(offs: readonly number[], flipRow: number, nextOffs: readonly number[]): Canvas {
  const cv = canvas(BOARD_W, BOARD_H);
  rect(cv, 0, 0, BOARD_W, BOARD_H, "w");
  hline(cv, 0, BOARD_W - 1, 0, "o");
  vline(cv, 0, 0, BOARD_H - 1, "o");
  hline(cv, 0, BOARD_W - 1, BOARD_H - 1, "W");
  vline(cv, BOARD_W - 1, 0, BOARD_H - 1, "W");
  rect(cv, 3, 3, BOARD_W - 6, BOARD_H - 6, "k");
  rect(cv, 4, 4, BOARD_W - 8, BOARD_H - 8, "c");
  // header: a yellow strip with a little train, dashes and a clock face (no letters)
  rect(cv, 5, 4, BOARD_W - 10, 8, "y");
  hline(cv, 5, BOARD_W - 6, 4, "u");
  hline(cv, 5, BOARD_W - 6, 11, "Y");
  stamp(cv, ["rrrrr.", "rIrIrr", "rrrrrr", "k...k."], 8, 6);
  for (let x = 22; x < BOARD_W - 22; x += 10) hline(cv, x, x + 5, 8, "Y");
  stamp(cv, [".kkk.", "kqqqk", "kqkqk", "kqkkk", ".kkk."], BOARD_W - 14, 5);
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 8; col++) {
      const x = FLAP_X + col * 16;
      const y = FLAP_Y + row * 18;
      rect(cv, x, y, 15, 16, "C");
      hline(cv, x, x + 14, y, "g");
      hline(cv, x, x + 14, y + 8, "c");
      if (col === 7) {
        rect(cv, x + 5, y + 3, 5, 10, "v");
        vline(cv, x + 5, y + 3, y + 12, "V");
        hline(cv, x + 5, x + 9, y + 8, "c");
        continue;
      }
      const name = ICON_ORDER[(offs[row]! + col * 3 + row * 5) % ICON_ORDER.length]!;
      if (row === flipRow) {
        // mid-flip: the new picture's top half shows, the old flap falls as a dark band with a lit edge
        const next = ICON_ORDER[(nextOffs[row]! + col * 3 + row * 5) % ICON_ORDER.length]!;
        stamp(cv, ICONS[next]!.slice(0, 4), x + 4, y + 4);
        rect(cv, x, y + 8, 15, 8, "c");
        hline(cv, x, x + 14, y + 8, "g");
        hline(cv, x + 1, x + 13, y + 9, "C");
        stamp(cv, ICONS[name]!.slice(5).map((r) => r.replace(/[^.]/g, "g")), x + 4, y + 11);
      } else stamp(cv, ICONS[name]!, x + 4, y + 4);
    }
  return cv;
}
/** Idle frame f: row (f % 4) flips (a rest on the fourth beat); each row's pictures alternate between two sets. */
function boardAt(f: number): Canvas {
  const flipsBefore = (r: number, upTo: number) => {
    let n = 0;
    for (let g = 0; g < upTo; g++) if (g % 4 === r) n++;
    return n;
  };
  const offs = [0, 1, 2].map((r) => (flipsBefore(r, f + (f % 4 === r ? 1 : 0)) % 2) * 3 + r * 2);
  const prev = [0, 1, 2].map((r) => (flipsBefore(r, f) % 2) * 3 + r * 2);
  const fr = f % 4 < 3 ? f % 4 : -1;
  return fr < 0 ? board(offs, -1, offs) : board(prev, fr, offs);
}
for (let f = 0; f < 8; f++) def(`board-${f}`, toGrid(boardAt(f)));
def("board", parts["board-3"]!.grid);

// ---------------------------------------------------------------------------------------------------------------------
// Shelves behind the bar (2 x 1): warm wood, three shelves of seed jars, burlap sacks and tins. Pictures only.

const jar = (a: string, b: string): Grid => [
  ".yyyyy.",
  ".YYYYY.",
  "IIiiiii",
  "Iiiiiii",
  `I${a}${b}${a}${b}${a}i`,
  `I${b}${a}S${a}${b}i`,
  `I${a}b${a}${b}${a}i`,
  `I${b}${a}${b}x${a}i`,
  `I${a}${b}${a}${b}${a}i`,
  ".iiiii.",
];
const SACK: Grid = [
  "..sSsxs...",
  "..oSsso...",
  "..WWWWW...",
  ".owwwwwo..",
  "owwwowwwo.",
  "owwwwwwwW.",
  "owwowwwwW.",
  "owwwwwowW.",
  "owwwwwwwW.",
  ".WWWWWWW..",
];
const tin = (a: string, b: string): Grid => [".MMMMM.", "jmmmmmj", `${a}${a}${a}${a}${a}${a}${b}`, `${a}uuuuu${b}`, `${a}u${b}${b}u${b}${b}`.slice(0, 7), `${a}uuuuu${b}`, `${a}${a}${a}${a}${a}${a}${b}`, `${a}${a}${a}${a}${a}${a}${b}`, ".jjjjj."];
const SHELF_W = 72;
const SHELF_H = 80;
function shelves(): Canvas {
  const cv = canvas(SHELF_W, SHELF_H);
  rect(cv, 0, 0, SHELF_W, SHELF_H, "W");
  for (let x = 3; x < SHELF_W - 3; x += 11) vline(cv, x, 4, 73, "N");
  for (const x of [0, SHELF_W - 3]) {
    rect(cv, x, 0, 3, SHELF_H, "w");
    vline(cv, x, 0, SHELF_H - 1, "o");
    vline(cv, x + 2, 0, SHELF_H - 1, "W");
  }
  const board = (y: number, h = 3) => {
    rect(cv, 0, y, SHELF_W, h, "w");
    hline(cv, 0, SHELF_W - 1, y, "o");
    hline(cv, 0, SHELF_W - 1, y + h - 1, "W");
    hline(cv, 3, SHELF_W - 4, y + h, "N");
  };
  board(0, 4);
  board(27);
  board(53);
  rect(cv, 0, 74, SHELF_W, 6, "W");
  hline(cv, 0, SHELF_W - 1, 74, "o");
  rect(cv, 3, 76, SHELF_W - 6, 3, "c");
  const on = (g: Grid, x: number, floorY: number) => stampOutlined(cv, g, x, floorY - g.length + 1);
  // top shelf: jars and tins
  on(jar("s", "S"), 5, 25);
  on(jar("x", "s"), 15, 25);
  on(tin("r", "R"), 25, 25);
  on(jar("b", "s"), 35, 25);
  on(jar("S", "s"), 46, 25);
  on(tin("y", "Y"), 57, 25);
  // middle: a sack, jars, tins
  on(SACK, 4, 51);
  on(jar("s", "x"), 17, 51);
  on(tin("V", "v"), 27, 51);
  on(tin("r", "R"), 37, 51);
  on(SACK, 47, 51);
  on(jar("s", "b"), 60, 51);
  // bottom: sacks and a tin
  on(SACK, 4, 72);
  on(SACK, 16, 72);
  on(tin("y", "Y"), 29, 72);
  on(SACK, 39, 72);
  on(jar("x", "S"), 53, 72);
  return cv;
}
def("shelves", toGrid(shelves()));

// a wall sconce: a cream bowl on a wood bracket, its glow fanning up the wall
def("sconce", ["qeeeeeeeeeeE", ".EeeeeeeeeE.", "..EEEEEEEE..", ".....WW.....", "....WWWW...."]);
{
  const cv = canvas(22, 14);
  poly(cv, [[6, 14], [16, 14], [22, 0], [0, 0]], "l");
  def("sconce-glow", toGrid(cv), false);
}

// ---------------------------------------------------------------------------------------------------------------------
// The seed vat (1 x 1): a galvanized tub with a rolled rim, heaped high with millet, sunflower and cracked corn; a scoop
// standing in the heap

const VAT_W = 34;
const VAT_H = 46;
function vat(): Canvas {
  const cv = canvas(VAT_W, VAT_H);
  // the tub, a little wider at the rim
  for (let y = 22; y < VAT_H; y++) {
    const inset = 2 + Math.floor((y - 22) / 10);
    for (let x = inset; x < VAT_W - inset; x++) {
      const t = (x - inset) / (VAT_W - 2 * inset);
      cv[y]![x] = t < 0.18 ? "M" : t < 0.7 ? "m" : "j";
    }
  }
  for (const y of [30, 40]) {
    const inset = 2 + Math.floor((y - 22) / 10);
    hline(cv, inset, VAT_W - inset - 1, y, "j");
    hline(cv, inset, VAT_W - inset - 1, y - 1, "M");
  }
  for (let y = 23; y < VAT_H; y++) {
    const inset = 2 + Math.floor((y - 22) / 10);
    put(cv, inset, y, "k");
    put(cv, VAT_W - inset - 1, y, "k");
  }
  hline(cv, 4, VAT_W - 5, VAT_H - 1, "k");
  // rolled rim
  ellipse(cv, 17, 22, 17, 4.5, "k");
  ellipse(cv, 17, 22, 16, 3.6, "M");
  ellipse(cv, 17, 22.6, 14.5, 2.6, "m");
  // the heap of seed, rising well over the rim
  const heap = (x: number, y: number) => y <= 23 && ((x + 0.5 - 17) / 14.5) ** 2 + ((y + 0.5 - 22) / 15) ** 2 <= 1;
  for (let y = 0; y < 24; y++)
    for (let x = 0; x < VAT_W; x++) {
      if (!heap(x, y)) continue;
      const lit = 0.5 - 0.4 * ((x - 17) / 14) - 0.5 * ((y - 15) / 10);
      let k = lit > 0.85 ? "u" : lit > 0.45 ? "s" : "Y";
      const h = hash(x, y, 77);
      if (h < 0.1) k = "S";
      else if (h < 0.17) k = "b";
      else if (h < 0.22) k = "x";
      else if (h < 0.26) k = "q";
      cv[y]![x] = k;
      if (!heap(x, y - 1) || !heap(x - 1, y) || !heap(x + 1, y)) cv[y]![x] = "k";
    }
  // the scoop: a steel bowl half in the heap, its wood handle standing up out of it
  line(cv, 23, 13, 30, 1, "k");
  line(cv, 24, 13, 31, 1, "k");
  line(cv, 22, 12, 29, 0, "k");
  line(cv, 23, 12, 30, 0, "w");
  line(cv, 24, 12, 31, 0, "W");
  stampOutlined(cv, ["MMMMMm", ".mmmj.", "..sS.."], 18, 12);
  return cv;
}
def("vat", toGrid(vat()));

// ---------------------------------------------------------------------------------------------------------------------
// The U-shaped bar: two arms (1 x 3) and the bottom run (4 x 1). Warm-wood top with a cream edge; the run's charcoal
// front with a brass plate and a red stripe. Feeders and the bell stand on it as pieces of their own.

function woodTop(cv: Canvas, x0: number, y0: number, w: number, h: number, seed: number) {
  rect(cv, x0, y0, w, h, "w");
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const r = hash(x, y, seed);
      if (r < 0.035) hline(cv, x, Math.min(x0 + w - 1, x + 2 + Math.floor(r * 100)), y, "W");
      else if (r < 0.05) hline(cv, x, Math.min(x0 + w - 1, x + 1), y, "o");
    }
}
const ARM_W = 31;
const ARM_H = 3 * T + 4;
function arm(seed: number): Canvas {
  const cv = canvas(ARM_W, ARM_H);
  woodTop(cv, 0, 0, ARM_W, ARM_H, seed);
  vline(cv, 0, 0, ARM_H - 1, "e");
  vline(cv, ARM_W - 1, 0, ARM_H - 1, "e");
  hline(cv, 0, ARM_W - 1, 0, "e");
  vline(cv, 1, 1, ARM_H - 1, "o");
  hline(cv, 1, ARM_W - 2, 1, "o");
  return cv;
}
def("counter-arm", toGrid(arm(81)));
def("counter-arm-east", toGrid(arm(83)));

const RUN_W = 4 * T - 4; // the run's pixels between its own outline columns: 144 with them
const RUN_H = COUNTER_H + T; // 68
/** The brass plate on the run's front, in the counter piece's pixels. */
export const SHOP_BIRDIE_COUNTER_SIGN = { x: 59, y: 40, w: 26, h: 7 } as const;
function counterRun(): Canvas {
  // Drawn with its own outline, open where the arms join it, so the U reads as one bar.
  const W_ = RUN_W + 4; // 144: local 0 and 143 are the outline, lining up with the arms' outlines
  const cv = canvas(W_, RUN_H);
  woodTop(cv, 1, 0, W_ - 2, 35, 85);
  // the outline
  vline(cv, 0, 0, RUN_H - 1, "k");
  vline(cv, W_ - 1, 0, RUN_H - 1, "k");
  hline(cv, 0, W_ - 1, RUN_H - 1, "k");
  hline(cv, 32, 111, 0, "k");
  // cream edges: the U's inner lip, the outer sides, the front lip
  hline(cv, 33, 110, 1, "e");
  hline(cv, 33, 110, 2, "o");
  vline(cv, 1, 0, 34, "e");
  vline(cv, W_ - 2, 0, 34, "e");
  vline(cv, 31, 0, 1, "e");
  vline(cv, 112, 0, 1, "e");
  hline(cv, 1, W_ - 2, 33, "e");
  hline(cv, 1, W_ - 2, 34, "E");
  hline(cv, 0, W_ - 1, 35, "k");
  // the front
  rect(cv, 1, 36, W_ - 2, 31, "C");
  hline(cv, 1, W_ - 2, 36, "g");
  for (const x of [48, 96]) vline(cv, x, 37, 58, "c");
  const s = SHOP_BIRDIE_COUNTER_SIGN;
  rect(cv, s.x - 1, s.y - 1, s.w + 2, s.h + 2, "k");
  rect(cv, s.x, s.y, s.w, s.h, "y");
  hline(cv, s.x, s.x + s.w - 1, s.y, "u");
  hline(cv, s.x, s.x + s.w - 1, s.y + s.h - 1, "Y");
  stamp(cv, ["..WW..", ".WWWWY", "WWWWW.", "..W.W."], s.x + 10, s.y + 1);
  hline(cv, 1, W_ - 2, 53, "k");
  rect(cv, 1, 54, W_ - 2, 2, "r");
  hline(cv, 1, W_ - 2, 56, "R");
  hline(cv, 1, W_ - 2, 57, "k");
  rect(cv, 1, 58, W_ - 2, 9, "c");
  hline(cv, 1, W_ - 2, 58, "C");
  return cv;
}
def("counter", toGrid(counterRun()), false);

// the brass service bell
def("bell", ["...u...", "..uyy..", ".uyyyY.", ".yyyYY.", "YYYYYYY"]);

// ---------------------------------------------------------------------------------------------------------------------
// Bird feeders: a little wood-roofed hopper with a glass tube of seed, a tray and a steel perch; the floor one smaller,
// on a pole

def("feeder", [
  "....r....",
  "...rrR...",
  "..rrrrR..",
  ".RRRRRRR.",
  "..IsSsi..",
  "..IxssI..",
  "..IsSbi..",
  "..IssxI..",
  "..IbsSi..",
  ".osssssW.",
  "jjWWWWWjj",
]);
def("feeder-floor", [
  "...r...",
  "..rrR..",
  ".RRRRR.",
  ".IsSi..",
  ".Ixsi..",
  ".Isbi..",
  "osssW..",
  "jWWWWj.",
  "..W....",
  "..W....",
  "..W....",
  ".WWW...",
]);

// ---------------------------------------------------------------------------------------------------------------------
// Stools: a tall round stool, a yellow cushion on a wood seat, a charcoal post, a ring footrest

const STOOL_W = 22;
const STOOL_H = 26;
function stool(): Canvas {
  const cv = canvas(STOOL_W, STOOL_H);
  rect(cv, 9, 7, 4, 17, "C");
  vline(cv, 9, 7, 23, "g");
  vline(cv, 12, 7, 23, "c");
  ellipse(cv, 11, 23, 7, 2.6, "c");
  hline(cv, 7, 14, 21, "C");
  hline(cv, 5, 16, 15, "y");
  hline(cv, 4, 17, 16, "Y");
  hline(cv, 5, 16, 17, "W");
  ellipse(cv, 11, 4.6, 11, 3.6, "W");
  ellipse(cv, 11, 4.0, 11, 3.4, "w");
  ellipse(cv, 11, 3.2, 10.5, 3.2, "y");
  hline(cv, 4, 9, 1, "u");
  hline(cv, 3, 5, 2, "u");
  hline(cv, 14, 18, 5, "Y");
  return cv;
}
def("stool", toGrid(stool()));

// Birds on the stools: doves (gray-blue, pale collar) and sparrows (brown, black bib); four poses each, facing east
const BIRDS: Record<string, Grid> = {
  "dove-up": [".....dd..", "....ddkY.", ".....Pd..", ".dddddPd.", "DDDdddddd", ".DDDdeee.", "...DDdd..", "....r.r.."],
  "dove-bob": [".........", ".....dd..", "....ddkY.", ".dddddPd.", "DDDdddddd", ".DDDdeee.", "...DDdd..", "....r.r.."],
  "dove-sip": [".........", ".........", ".........", ".dddddd..", "DDDdddPdd", ".DDDdedkY", "...DDdd..", "....r.r.."],
  "dove-tuck": [".........", ".DD......", "DDDD.dd..", ".DDDddkY.", "DDDddPdd.", ".DDDdeee.", "...DDdd..", "....r.r.."],
  "sparrow-up": [".........", ".....NN..", "....NNkY.", "....BeK..", ".BNBBBKB.", "NBNBBeee.", ".NNBBee..", "....W.W.."],
  "sparrow-bob": [".........", ".........", ".....NN..", "....NNkY.", ".BNBBeKB.", "NBNBBeee.", ".NNBBee..", "....W.W.."],
  "sparrow-sip": [".........", ".........", ".........", ".BNBBN...", "NBNBBNNN.", ".NNBBekNY", "...BBeK..", "....W.W.."],
  "sparrow-tuck": [".........", ".NN......", "NBNN.NN..", ".NBNNNkY.", "NBNBBeK..", "NBNBBeee.", ".NNBBee..", "....W.W.."],
};
for (const [name, g] of Object.entries(BIRDS)) def(name, g);

// ---------------------------------------------------------------------------------------------------------------------
// The challenge table (`match-table`, 1 x 1): a small plain square table, a white top on a warm-wood base

const TABLE_W = 30;
const TABLE_H = 44;
function table(): Canvas {
  const cv = canvas(TABLE_W, TABLE_H);
  rect(cv, 0, 0, TABLE_W, 28, "q");
  vline(cv, TABLE_W - 1, 1, 27, "e");
  hline(cv, 1, TABLE_W - 1, 27, "e");
  hline(cv, 0, TABLE_W - 1, 28, "k");
  rect(cv, 0, 29, TABLE_W, 2, "E");
  rect(cv, 0, 31, TABLE_W, 4, "w");
  hline(cv, 0, TABLE_W - 1, 31, "o");
  hline(cv, 0, TABLE_W - 1, 34, "W");
  for (const x of [1, TABLE_W - 4]) {
    rect(cv, x, 35, 3, 9, "w");
    vline(cv, x, 35, 43, "o");
    vline(cv, x + 2, 35, 43, "W");
  }
  hline(cv, 4, TABLE_W - 5, 39, "W");
  return cv;
}
def("match-table", toGrid(table()));

// ---------------------------------------------------------------------------------------------------------------------
// The railroad crossing: a gravel road strip (2 squares wide, running north-south) with a yellow-and-black edge and a
// painted red-and-white crossbuck at each end, and the track across it: steel rails on wood ties set in ballast

function hazard(cv: Canvas, x0: number, y0: number, w: number, h: number) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(cv, x, y, (x + y) % 6 < 3 ? "y" : "c");
}
function gravel(cv: Canvas, seed: number, dark: boolean) {
  rect(cv, 0, 0, 2 * T, T, dark ? "Z" : "z");
  fleck(cv, 0, 0, 2 * T, T, seed, dark ? [["z", 0.18], ["c", 0.08], ["p", 0.04]] : [["p", 0.16], ["Z", 0.12], ["e", 0.02]]);
}
function edges(cv: Canvas, end: boolean) {
  hazard(cv, 0, 0, 4, T);
  hazard(cv, 2 * T - 4, 0, 4, T);
  vline(cv, 4, 0, T - 1, "k");
  vline(cv, 2 * T - 5, 0, T - 1, "k");
  if (end) {
    hazard(cv, 0, 0, 2 * T, 4);
    hline(cv, 4, 2 * T - 5, 4, "k");
  }
}
{
  const cv = canvas(2 * T, T);
  gravel(cv, 91, false);
  // the painted crossbuck
  for (let d = -2; d <= 2; d++) {
    line(cv, 24, 12 + d, 50, 30 + d, d === -2 || d === 2 ? "k" : Math.abs(d) === 1 ? "r" : "q");
    line(cv, 24, 30 + d, 50, 12 + d, d === -2 || d === 2 ? "k" : Math.abs(d) === 1 ? "r" : "q");
  }
  for (let d = -1; d <= 1; d++) {
    line(cv, 24, 12 + d, 50, 30 + d, d === 0 ? "q" : "r");
    line(cv, 24, 30 + d, 50, 12 + d, d === 0 ? "q" : "r");
  }
  edges(cv, true);
  def("road", toGrid(cv), false);
}
{
  const cv = canvas(2 * T, T);
  gravel(cv, 97, true);
  for (let x = 7; x < 2 * T - 6; x += 8) {
    rect(cv, x, 4, 5, 29, "w");
    vline(cv, x, 4, 32, "o");
    vline(cv, x + 4, 4, 32, "W");
    hline(cv, x, x + 4, 33, "k");
  }
  for (const y of [10, 24]) {
    hline(cv, 5, 2 * T - 6, y, "M");
    hline(cv, 5, 2 * T - 6, y + 1, "m");
    hline(cv, 5, 2 * T - 6, y + 2, "j");
    hline(cv, 5, 2 * T - 6, y + 3, "k");
  }
  edges(cv, false);
  def("road-rails", toGrid(cv), false);
}

// The crossing gate (1 x 1, about 84 px tall): a crossbuck on a steel pole, a pair of red lights, the striped barrier
// arm raised out of the way beside the pole
const POST_W = 26;
const POST_H = 84;
function post(lit: 0 | 1 | -1): Canvas {
  const cv = canvas(POST_W, POST_H);
  rect(cv, 11, 12, 3, 68, "m");
  vline(cv, 11, 12, 79, "M");
  vline(cv, 13, 12, 79, "j");
  rect(cv, 6, 79, 14, 5, "c");
  hline(cv, 6, 19, 79, "g");
  // crossbuck
  for (let d = -2; d <= 2; d++) {
    const k = Math.abs(d) === 2 ? "k" : Math.abs(d) === 1 ? "r" : "q";
    line(cv, 1, 1 + d + 2, 24, 13 + d + 2, k);
    line(cv, 1, 13 + d + 2, 24, 1 + d + 2, k);
  }
  for (let d = -1; d <= 1; d++) {
    line(cv, 1, 3 + d, 24, 15 + d, d === 0 ? "q" : "r");
    line(cv, 1, 15 + d, 24, 3 + d, d === 0 ? "q" : "r");
  }
  // the lights
  rect(cv, 0, 30, POST_W, 10, "k");
  rect(cv, 1, 31, POST_W - 2, 8, "c");
  for (const [i, cx] of [[0, 6], [1, 19]] as const) {
    ellipse(cv, cx + 0.5, 35, 3.6, 3.6, "k");
    const on = lit === i;
    ellipse(cv, cx + 0.5, 35, 2.6, 2.6, on ? "r" : "R");
    if (on) {
      put(cv, cx - 1, 34, "L");
      put(cv, cx, 34, "u");
      put(cv, cx, 33, "L");
    }
    hline(cv, cx - 3, cx + 3, 30, "g");
  }
  rect(cv, 9, 40, 7, 4, "c");
  // the barrier arm, raised: red and white stripes, its counterweight at the foot
  rect(cv, 20, 18, 3, 54, "q");
  for (let y = 18; y < 72; y++) if (Math.floor((y - 18) / 5) % 2 === 0) hline(cv, 20, 22, y, "r");
  vline(cv, 19, 18, 71, "k");
  vline(cv, 23, 18, 71, "k");
  hline(cv, 19, 23, 17, "k");
  rect(cv, 17, 70, 8, 7, "k");
  rect(cv, 18, 71, 6, 5, "C");
  hline(cv, 18, 23, 71, "g");
  return cv;
}
def("crossing-post", toGrid(post(-1)));
def("crossing-post-l", toGrid(post(0)));
def("crossing-post-r", toGrid(post(1)));

// ---------------------------------------------------------------------------------------------------------------------
// Airport seats (3 x 1), the standing lamp, plants and shrubs (as round 1)

const SEATS_W = 110;
function seats(): Canvas {
  const cv = canvas(SEATS_W, 40);
  for (let s = 0; s < 3; s++) {
    const x = 2 + s * 36;
    rect(cv, x, 0, 34, 7, "y");
    hline(cv, x, x + 33, 0, "u");
    hline(cv, x, x + 33, 6, "Y");
    rect(cv, x, 7, 34, 19, "C");
    hline(cv, x + 3, x + 30, 15, "c");
    vline(cv, x, 7, 25, "g");
  }
  for (const x of [0, 36, 72, 108]) rect(cv, x, 2, 2, 25, "c");
  rect(cv, 2, 28, SEATS_W - 4, 3, "m");
  hline(cv, 2, SEATS_W - 5, 28, "M");
  hline(cv, 2, SEATS_W - 5, 30, "j");
  for (const x of [14, 90]) {
    rect(cv, x, 31, 4, 6, "c");
    rect(cv, x - 4, 37, 12, 3, "c");
  }
  return cv;
}
def("seats", toGrid(seats()));
{
  const cv = canvas(18, 76);
  poly(cv, [[4, 0], [14, 0], [18, 12], [0, 12]], "e");
  for (let y = 0; y < 12; y++) put(cv, 4 + Math.floor(y / 3), y, "q");
  for (let y = 2; y < 12; y++) put(cv, 13 + Math.floor(y / 3), y, "E");
  hline(cv, 0, 17, 12, "u");
  hline(cv, 2, 15, 13, "L");
  rect(cv, 8, 14, 2, 58, "w");
  vline(cv, 9, 14, 71, "W");
  ellipse(cv, 9, 73, 7, 2.6, "W");
  hline(cv, 4, 13, 71, "o");
  def("lamp", toGrid(cv));
}
{
  const cv = canvas(32, 50);
  const blade = (bx: number, tx: number, ty: number, k: string) => poly(cv, [[bx - 2.5, 34], [bx + 2.5, 34], [tx, ty]], k);
  blade(10, 3, 8, "v");
  blade(22, 29, 6, "v");
  blade(14, 9, 0, "V");
  blade(18, 22, 1, "V");
  blade(16, 16, 4, "n");
  blade(12, 4, 20, "V");
  blade(20, 28, 18, "n");
  for (let y = 0; y < 34; y++) for (let x = 0; x < 32; x++) if (cv[y]![x] === "V" && hash(x, y, 5) < 0.12) cv[y]![x] = "v";
  poly(cv, [[5, 33], [27, 33], [24, 50], [8, 50]], "t");
  rect(cv, 4, 32, 24, 4, "t");
  hline(cv, 4, 27, 32, "o");
  hline(cv, 4, 27, 36, "T");
  for (let y = 37; y < 50; y++) put(cv, 22 - Math.floor((y - 37) / 5), y, "T");
  def("plant", toGrid(cv));
}
const bush = (cv: Canvas, cx: number, cy: number, rx: number, ry: number) => {
  for (let y = 0; y < cv.length; y++)
    for (let x = 0; x < cv[0]!.length; x++) {
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 > 1) continue;
      const l = 0.5 - 0.42 * ((x - cx) / rx) - 0.5 * ((y - cy) / ry) + (hash(x, y, 13) - 0.5) * 0.35;
      cv[y]![x] = l > 0.75 ? "V" : l > 0.3 ? "v" : "n";
    }
};
{
  const cv = canvas(32, 36);
  bush(cv, 16, 13, 15, 12);
  rect(cv, 2, 22, 28, 14, "w");
  hline(cv, 2, 29, 22, "o");
  hline(cv, 2, 29, 28, "W");
  vline(cv, 29, 22, 35, "W");
  hline(cv, 2, 29, 35, "W");
  def("shrub", toGrid(cv));
}
{
  const cv = canvas(24, 38);
  bush(cv, 12, 10, 11, 10);
  rect(cv, 11, 20, 2, 4, "W");
  poly(cv, [[3, 24], [21, 24], [18, 38], [6, 38]], "t");
  hline(cv, 3, 20, 24, "o");
  hline(cv, 3, 20, 26, "T");
  def("shrub-b", toGrid(cv));
}

// ---------------------------------------------------------------------------------------------------------------------
// The front: the hem (charcoal, a yellow edge) and the way out (glass doors standing open, the bright day beyond)

PALETTE.h = "#fff8e2"; // the day through the doors
PALETTE.H = "#efe2bd"; // the street's buildings in that light
{
  const cv = canvas(T, 24);
  hline(cv, 0, T - 1, 0, "k");
  rect(cv, 0, 1, T, 2, "y");
  hline(cv, 0, T - 1, 1, "u");
  hline(cv, 0, T - 1, 3, "Y");
  hline(cv, 0, T - 1, 4, "k");
  rect(cv, 0, 5, T, 19, "c");
  hline(cv, 0, T - 1, 5, "C");
  vline(cv, 18, 6, 23, "k");
  def("hem", toGrid(cv), false);
}
const DOOR_W = 74;
const DOOR_H = 110;
function entrance(): Canvas {
  const cv = canvas(DOOR_W, DOOR_H);
  rect(cv, 0, 0, DOOR_W, DOOR_H, "w");
  // the day: sky, the sun, the street's low buildings, the sunny pavement
  rect(cv, 6, 10, DOOR_W - 12, DOOR_H - 10, "h");
  rect(cv, 46, 16, 7, 7, "u");
  hline(cv, 47, 51, 16, "q");
  for (const [x, h] of [[14, 14], [24, 10], [32, 18], [42, 12], [52, 16]] as const) rect(cv, x, 62 - h, 8, h, "H");
  rect(cv, 6, 62, DOOR_W - 12, 14, "u");
  for (let y = 76; y < DOOR_H; y++) for (let x = 6; x < DOOR_W - 6; x++) cv[y]![x] = (x - 6) % 12 === 0 || (y - 76) % 10 === 0 ? "H" : "h";
  // the doors, standing open against the jambs
  for (const x0 of [6, DOOR_W - 16]) {
    rect(cv, x0, 10, 10, DOOR_H - 12, "w");
    rect(cv, x0 + 2, 13, 6, DOOR_H - 18, "i");
    vline(cv, x0 + 3, 16, DOOR_H - 20, "I");
    vline(cv, x0 + 1, 10, DOOR_H - 3, "W");
    vline(cv, x0 + 9, 10, DOOR_H - 3, "k");
  }
  // frame: header with a yellow plate, jambs, threshold
  rect(cv, 0, 0, DOOR_W, 10, "w");
  hline(cv, 0, DOOR_W - 1, 0, "o");
  hline(cv, 0, DOOR_W - 1, 9, "W");
  rect(cv, 4, 6, DOOR_W - 8, 2, "k");
  rect(cv, 29, 2, 16, 4, "y");
  hline(cv, 29, 44, 2, "u");
  vline(cv, 0, 0, DOOR_H - 1, "o");
  vline(cv, 5, 10, DOOR_H - 1, "W");
  vline(cv, DOOR_W - 6, 10, DOOR_H - 1, "o");
  vline(cv, DOOR_W - 1, 0, DOOR_H - 1, "W");
  rect(cv, 6, DOOR_H - 3, DOOR_W - 12, 3, "y");
  hline(cv, 6, DOOR_W - 7, DOOR_H - 3, "u");
  return cv;
}
def("entrance", toGrid(entrance()));

// ---------------------------------------------------------------------------------------------------------------------
// The layout

export interface ShopPlace {
  piece: string;
  col: number;
  row: number;
  /** Footprint in squares (default 1 x 1). */
  w?: number;
  d?: number;
  /** Quarter turns clockwise (floor tiles, the road's south end). */
  rot?: 0 | 1 | 2 | 3;
  /** Mirrored east-west. */
  flip?: boolean;
  /** The way out. */
  exit?: boolean;
  /** Blocks walking (default true for furniture, false for floor and things standing on the counter or table). */
  solid?: boolean;
  /** Pixel nudge from the piece's usual spot (a feeder on a counter or table top, a sconce over the shelves). */
  dx?: number;
  dy?: number;
  /** Draw order (back to front); default the footprint's south edge, row + d. */
  z?: number;
}

/** Where a piece's picture sits, from its footprint's top-left corner (pixels). */
const ART: Record<string, { ox: number; oy: number }> = {
  wall: { ox: 0, oy: -Y0 },
  "wall-b": { ox: 0, oy: -Y0 },
  "wall-none": { ox: 0, oy: -Y0 },
  "wall-pilaster": { ox: 0, oy: -Y0 },
  arch: { ox: 4, oy: 6 - Y0 },
  "arch-east": { ox: 4, oy: 6 - Y0 },
  board: { ox: 4, oy: 6 - Y0 },
  shelves: { ox: 1, oy: 8 - Y0 },
  sconce: { ox: 12, oy: 30 - Y0 },
  "counter-arm": { ox: 3, oy: -COUNTER_H },
  counter: { ox: 2, oy: -COUNTER_H },
  vat: { ox: 2, oy: T - 3 - VAT_H },
  stool: { ox: 8, oy: 7 },
  feeder: { ox: 14, oy: -16 },
  "feeder-floor": { ox: 15, oy: T - 4 - 13 },
  bell: { ox: 15, oy: -12 },
  "match-table": { ox: 4, oy: -10 },
  road: { ox: 0, oy: 0 },
  "road-rails": { ox: 0, oy: 0 },
  "crossing-post": { ox: 6, oy: T - 3 - POST_H },
  seats: { ox: 0, oy: T - 2 - 40 },
  lamp: { ox: 10, oy: T - 3 - 76 },
  plant: { ox: 3, oy: T - 3 - 50 },
  shrub: { ox: 3, oy: T - 2 - 36 },
  "shrub-b": { ox: 7, oy: T - 3 - 38 },
  hem: { ox: 0, oy: T - 24 },
  entrance: { ox: 0, oy: T - DOOR_H },
  "side-wall": { ox: 0, oy: 0 },
};
const FLOORISH = new Set(["floor-a", "floor-b", "floor-edge", "floor-edge-corner", "floor-door", "road", "road-rails", "side-wall"]);

const L: ShopPlace[] = [];
// side walls
L.push({ piece: "side-wall", col: 0, row: 1, d: 11, solid: true }, { piece: "side-wall", col: 11, row: 1, d: 11, solid: true, flip: true });
// floor: a checker of terrazzo, the yellow safety line one square in from the side walls and along the front
for (let r = 1; r <= 11; r++)
  for (let c = 1; c <= 10; c++) {
    const base = (c + r) % 2 === 0 ? "floor-a" : "floor-b";
    if (r === 10 && (c === 4 || c === 5)) L.push({ piece: "floor-door", col: c, row: r, flip: c === 5, solid: false });
    else if (r === 10 && (c === 1 || c === 10)) L.push({ piece: "floor-edge-corner", col: c, row: r, flip: c === 10, solid: false });
    else if (r === 10) L.push({ piece: "floor-edge", col: c, row: r, rot: 3, solid: false });
    else if (r < 10 && (c === 1 || c === 10)) L.push({ piece: "floor-edge", col: c, row: r, flip: c === 10, solid: false });
    else L.push({ piece: base, col: c, row: r, solid: false });
  }
// the railroad crossing in the front-left corner: the road at cols 2-3, rows 8-10, the track across it at row 9
L.push(
  { piece: "road", col: 2, row: 8, w: 2, solid: false },
  { piece: "road-rails", col: 2, row: 9, w: 2, solid: false },
  { piece: "road", col: 2, row: 10, w: 2, rot: 2, solid: false },
);
// the back wall
for (let c = 0; c < 12; c++) L.push({ piece: c === 0 || c === 11 ? "wall-none" : c % 2 ? "wall" : "wall-b", col: c, row: 0, solid: true });
L.push(
  { piece: "sconce", col: 0, row: 0, solid: false, z: 0.5 },
  { piece: "sconce", col: 11, row: 0, solid: false, z: 0.5 },
  { piece: "arch", col: 1, row: 0, w: 2, solid: true, z: 0.5 },
  { piece: "board", col: 3, row: 0, w: 4, solid: true, z: 0.5 },
  { piece: "shelves", col: 7, row: 0, w: 2, solid: true, z: 0.5 },
  { piece: "arch-east", col: 9, row: 0, w: 2, solid: true, z: 0.5 },
);
// the U-shaped bar, the seed vat inside it beside the bartender's clear place (cols 6-7, rows 2-3)
L.push(
  { piece: "vat", col: 6, row: 1 },
  { piece: "counter-arm", col: 5, row: 1, d: 3 },
  { piece: "counter-arm", col: 8, row: 1, d: 3, flip: true },
  { piece: "feeder", col: 5, row: 1, solid: false, z: 4.1, dy: 4 },
  { piece: "feeder", col: 5, row: 3, solid: false, z: 4.1, dy: -2 },
  { piece: "feeder", col: 8, row: 1, solid: false, z: 4.1, dy: 4 },
  { piece: "feeder", col: 8, row: 3, solid: false, z: 4.1, dy: -2 },
  { piece: "counter", col: 5, row: 4, w: 4 },
  { piece: "feeder", col: 5, row: 4, solid: false, z: 5.1, dx: -2 },
  { piece: "feeder", col: 6, row: 4, solid: false, z: 5.1, dx: 4 },
  { piece: "feeder", col: 7, row: 4, solid: false, z: 5.1, dx: -4 },
  { piece: "bell", col: 8, row: 4, solid: false, z: 5.1, dx: -4 },
);
// stools on all three outer sides of the U
const BAR_STOOLS: readonly (readonly [number, number])[] = [[4, 1], [4, 2], [4, 3], [5, 5], [6, 5], [7, 5], [8, 5], [9, 1], [9, 2], [9, 3]];
for (const [c, r] of BAR_STOOLS) L.push({ piece: "stool", col: c, row: r });
// the challenge spot: a small white-top table, a stool each side, two feeders on top and two on the floor beside it
L.push(
  { piece: "stool", col: 5, row: 7 },
  { piece: "match-table", col: 6, row: 7 },
  { piece: "stool", col: 7, row: 7 },
  { piece: "feeder", col: 6, row: 7, dx: -7, dy: 17, solid: false, z: 8.1 },
  { piece: "feeder", col: 6, row: 7, dx: 8, dy: 15, solid: false, z: 8.1 },
  { piece: "feeder-floor", col: 5, row: 8, dx: 12, dy: -10, solid: false },
  { piece: "feeder-floor", col: 7, row: 8, dx: -12, dy: -10, solid: false },
);
// the crossing's gates, kitty-corner: west of the road before the tracks (from the door), east of it after them
L.push({ piece: "crossing-post", col: 1, row: 10 }, { piece: "crossing-post", col: 4, row: 8, flip: true });
// seats, lamps, plants
L.push(
  { piece: "plant", col: 1, row: 1 },
  { piece: "lamp", col: 3, row: 1 },
  { piece: "seats", col: 1, row: 4, w: 3 },
  { piece: "seats", col: 1, row: 5, w: 3 },
  { piece: "lamp", col: 1, row: 7 },
  { piece: "plant", col: 10, row: 5 },
  { piece: "lamp", col: 10, row: 7 },
  { piece: "shrub-b", col: 8, row: 10 },
  { piece: "shrub", col: 10, row: 10 },
);
// the front
for (const c of [1, 2, 3, 6, 7, 8, 9, 10]) L.push({ piece: "hem", col: c, row: 11, solid: true });
L.push({ piece: "entrance", col: 4, row: 11, w: 2, exit: true, solid: false });
export const SHOP_BIRDIE_LAYOUT: readonly ShopPlace[] = L;

/** The bartender's clear place (2 x 2 at cols 6-7, rows 2-3); he stands at its top-left, facing south. */
export const SHOP_BIRDIE_BARTENDER_SPOT = { col: 6, row: 2 } as const;

// Birds on the stools: which stool, which bird, its facing and its own timing over the idle's 8 beats
// (u: up, b: head bob, s: a sip, t: a wing tuck)
const BIRD_SEATS: readonly { col: number; row: number; bird: "dove" | "sparrow"; west?: boolean; beat: string }[] = [
  { col: 4, row: 1, bird: "dove", beat: "uubuuubu" },
  { col: 4, row: 3, bird: "sparrow", beat: "uuuussuu" },
  { col: 5, row: 5, bird: "dove", beat: "tttuuuuu" },
  { col: 7, row: 5, bird: "sparrow", west: true, beat: "ubuubuuu" },
  { col: 9, row: 1, bird: "sparrow", west: true, beat: "suuuuuus" },
  { col: 9, row: 2, bird: "dove", west: true, beat: "uuuuubuu" },
];
const POSE: Record<string, string> = { u: "up", b: "bob", s: "sip", t: "tuck" };

// ---------------------------------------------------------------------------------------------------------------------
// Pieces, lights and pools

const FOOT: Record<string, readonly [number, number]> = {
  arch: [2, 1], "arch-east": [2, 1], board: [4, 1], shelves: [2, 1], "counter-arm": [1, 3], counter: [4, 1],
  road: [2, 1], "road-rails": [2, 1], seats: [3, 1], entrance: [2, 1], "side-wall": [1, 11],
};
const PIECE_NAMES = [
  "floor-a", "floor-b", "floor-edge", "floor-edge-corner", "floor-door", "side-wall", "wall", "wall-b", "wall-pilaster", "wall-none",
  "arch", "arch-east", "board", "shelves", "sconce", "counter-arm", "counter", "vat", "stool", "feeder", "feeder-floor", "bell",
  "match-table", "road", "road-rails", "crossing-post", "seats", "lamp", "plant", "shrub", "shrub-b", "hem", "entrance",
] as const;
/** Each piece: its footprint in squares, its picture, and where the picture sits from the footprint's top-left. */
export const SHOP_BIRDIE_PIECES: Readonly<Record<string, { w: number; d: number; grid: Grid; ox: number; oy: number }>> = Object.fromEntries(
  PIECE_NAMES.map((n) => {
    const [w, d] = FOOT[n] ?? [1, 1];
    const a = ART[n] ?? { ox: 0, oy: 0 };
    return [n, { w, d, grid: parts[n]!.grid, ox: a.ox, oy: a.oy }];
  }),
);

const at = (p: ShopPlace) => {
  const a = ART[p.piece] ?? { ox: 0, oy: 0 };
  return { x: colX(p.col) + a.ox + (p.dx ?? 0), y: rowY(p.row) + a.oy + (p.dy ?? 0) };
};
const places = (n: string) => L.filter((p) => p.piece === n);

export interface ShopLight {
  piece: string;
  x: number;
  y: number;
  r: number;
  color: string;
  soft?: boolean;
  /** Blinking in turn with its pair (the crossing lights): on in the idle's even ("a") or odd ("b") beats. */
  blink?: "a" | "b";
}
export const SHOP_BIRDIE_LIGHTS: readonly ShopLight[] = [
  ...places("lamp").map((p) => ({ piece: "lamp", x: at(p).x + 9, y: at(p).y + 12, r: 44, color: "#ffe2a0" })),
  ...places("sconce").map((p) => ({ piece: "sconce", x: at(p).x + 6, y: at(p).y, r: 26, color: "#ffe2a0" })),
  ...places("bell").map((p) => ({ piece: "bell", x: at(p).x + 3, y: at(p).y + 2, r: 10, color: "#ffe27a", soft: true })),
  ...places("entrance").map((p) => ({ piece: "entrance", x: at(p).x + 37, y: at(p).y + 50, r: 64, color: "#fff8e2" })),
  ...places("arch").concat(places("arch-east")).map((p) => ({ piece: p.piece, x: at(p).x + 33, y: at(p).y + 36, r: 36, color: "#d8eef6", soft: true })),
  ...places("crossing-post").flatMap((p, i) =>
    [6, 19].map((lx, j) => ({
      piece: "crossing-post",
      x: at(p).x + (p.flip ? POST_W - 1 - lx : lx),
      y: at(p).y + 35,
      r: 9,
      color: "#c8372d",
      blink: ((i + j + (p.flip ? 1 : 0)) % 2 ? "b" : "a") as "a" | "b",
    })),
  ),
];
export interface ShopPool {
  x: number;
  y: number;
  rx: number;
  ry: number;
  color: string;
}
export const SHOP_BIRDIE_POOLS: readonly ShopPool[] = [
  ...places("lamp").map((p) => ({ x: colX(p.col) + 18, y: rowY(p.row) + 30, rx: 30, ry: 14, color: "#ffe2a0" })),
  { x: colX(7), y: rowY(3), rx: 40, ry: 30, color: "#ffe2a0" },
  { x: colX(6) + 18, y: rowY(7) + 18, rx: 44, ry: 26, color: "#ffe2a0" },
  { x: colX(5), y: rowY(10) + 22, rx: 42, ry: 22, color: "#fff8e2" },
];
/** The fixed camera: the whole 12 x 12 room straight down, the back wall standing up WALL_H tall, 37 px a square. */
export const SHOP_BIRDIE_CAM = { x: 0, y: 0, w: RW, h: RH, tile: T, wallH: SHOP_BIRDIE_WALL_H, floorY: Y0 } as const;

// ---------------------------------------------------------------------------------------------------------------------
// Frames: the room as one picture

function partFor(p: ShopPlace, f: number): string {
  switch (p.piece) {
    case "arch":
      return `arch-${f}`;
    case "arch-east":
      return `arch-east-${f}`;
    case "board":
      return `board-${f}`;
    case "counter-arm":
      return p.col === 8 ? "counter-arm-east" : "counter-arm";
    case "crossing-post":
      // the two lights blink in turn, the far gate a beat behind the near one
      return (f + (p.flip ? 1 : 0)) % 2 ? "crossing-post-r" : "crossing-post-l";
    default:
      return p.piece;
  }
}
const zOf = (p: ShopPlace) => p.z ?? (p.row === 0 && p.piece.startsWith("wall") ? 0.1 : p.row + (p.d ?? 1));

function roomLayers(f: number, keep: (piece: string) => boolean = () => true): Layer[] {
  const back: Layer[] = [];
  const items: { z: number; i: number; layers: Layer[] }[] = [];
  L.forEach((p, i) => {
    if (!keep(p.piece)) return;
    const { x, y } = at(p);
    const layer: Layer = { part: partFor(p, f), x, y, rot: p.rot, flipX: p.flip };
    if (FLOORISH.has(p.piece)) return void back.push(layer);
    const layers: Layer[] = [];
    if (p.piece === "sconce") layers.push({ part: "sconce-glow", x: x - 5, y: y - 14 });
    layers.push(layer);
    items.push({ z: zOf(p), i, layers });
  });
  if (keep("stool"))
    BIRD_SEATS.forEach((b, i) => {
      const x = colX(b.col) + ART.stool!.ox + 6;
      const y = rowY(b.row) + ART.stool!.oy - 4;
      items.push({ z: b.row + 1.05, i: 10000 + i, layers: [{ part: `${b.bird}-${POSE[b.beat[f]!]}`, x, y, flipX: b.west }] });
    });
  items.sort((a, b) => a.z - b.z || a.i - b.i);
  return [...back, ...items.flatMap((it) => it.layers)];
}

const IDLE_MS = 500;
const idle: Frame[] = Array.from({ length: 8 }, (_, f) => ({ layers: roomLayers(f), ms: IDLE_MS }));

export const SHOP_BIRDIE_INTERIOR_3: Character = {
  id: "shop-birdie-interior-3",
  name: "Inside Birdie's station",
  w: RW,
  h: RH,
  foot: [RW / 2, RH],
  palette: PALETTE,
  parts,
  anims: {
    idle: { frames: idle, loop: true },
    // a room has no moods: every moment shows the lobby at rest
    entrance: { frames: idle, loop: false },
    thinking: { frames: idle, loop: true },
    move: { frames: idle.slice(0, 2), loop: false },
    capture: { frames: idle.slice(0, 2), loop: false },
    hurt: { frames: idle.slice(0, 2), loop: false },
    check: { frames: idle.slice(0, 2), loop: false },
    smug: { frames: idle, loop: true },
    rattled: { frames: idle, loop: true },
    defeat: { frames: idle.slice(0, 2), loop: false },
    victory: { frames: idle, loop: true },
  },
};
