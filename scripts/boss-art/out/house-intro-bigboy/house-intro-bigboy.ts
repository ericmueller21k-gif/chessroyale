/**
 * Big Boy's battle intro (house-intro-bigboy): the pieces of art code plays when you challenge him in his crib.
 *
 * 1. INTRO_BIGBOY_BLOCKS: his toy-block chess table. Six alphabet blocks (B, I, G, B, O, Y: they spell his name as they
 *    land) drop in one by one and stack into a 3-2-1 pyramid (`build`); the board, drawn by code, plops onto the top
 *    block (`plop`: dust and stars); two bigger blocks drop in as the stools (`chairs`); `idle` is the finished table.
 *    Same width and foot offset as park.ts PARK_TABLE (111 wide, the foot 6 px over the bottom), taller for the drop.
 * 2. INTRO_BIGBOY_TABLE_PALETTE: the slab's keys "1"-"5" (a teal foam play mat, his shirt's teal) and the board's squares
 *    L / D (INTRO_BIGBOY_TABLE_INK has the same in TABLE_INK's shape).
 * 3. INTRO_BIGBOY_SWIRL (128 x 128, tiles both ways) and INTRO_BIGBOY_SWIRL_FRONT (48 x 128, tiles top to bottom): the
 *    lollipop swirl transition, slid and tiled by code exactly as Alfil's sandstorm.
 *
 * HOUSE_INTRO_BIGBOY is the review sheet: `idle` shows every piece side by side; one extra animation per piece animation.
 * Colors are Big Boy's (characters/bigboy.ts and his shop, house-shop-bigboy).
 */
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../../../packages/app/src/characters/sprite.ts";
import { toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";

type Pt = readonly [number, number];
type Key = string | null;

// ---- Colors: one palette for every piece (so the review sheet can lay them side by side).

const PALETTE: Record<string, string> = {
  k: "#2a1712", // outline (Big Boy's)
  F: "#ffffff", // white, its shade, deeper (lollipop sticks, letters, shines)
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
  T: "#0f5c63", // his shirt's teal: dark to light
  t: "#178589",
  u: "#23a8a8",
  U: "#4fcfc6",
  N: "#9c3a60", // pink (his lips'): deep, mid, light
  z: "#e7719a",
  n: "#ffb6cc",
  K: "#3a1450", // the deep candy shadow between lollipops
  y: "#ffd84a", // stars: gold, pale
  Y: "#fff4b0",
  // Dust puffs: solid light and mid, and see-through (thick, thin, faint).
  g: "#fff8ee",
  G: "#eadfcf",
  q: "#fff6eac8",
  Q: "#f3e6d494",
  "%": "#f3e6d455",
  // The slab (INTRO_BIGBOY_TABLE_PALETTE "1"-"5"): a teal foam play mat: its light edge, top, mid, front, deep.
  a: "#8ae8dc",
  b: "#3fc2bb",
  c: "#23a8a8",
  d: "#178589",
  e: "#0f5c63",
  // The board's squares (INTRO_BIGBOY_TABLE_INK): light, its shade; dark, its shade.
  l: "#fff3c4",
  m: "#f0d98e",
  o: "#dc5f8e",
  p: "#b84675",
  // The town's pieces (unchanged): cream, its shade, its line; charcoal, its shade, its line.
  P: "#f6f1e6",
  s: "#d3c9b6",
  h: "#2b2622",
  X: "#2d2c33",
  x: "#57565f",
  j: "#0c0c10",
  "-": "#0d0e1280", // ground shadow: core, rim (see-through)
  "+": "#0d0e1244",
};
const HALO = "#fff6ea30";

const L = (part: string, at: Pt): Layer => ({ part, x: at[0], y: at[1] });
const mod = (a: number, n: number) => ((a % n) + n) % n;
/** A seeded hash of a pixel, in [0, 1) (the same as town/houses/kit.ts grain). */
function grain(x: number, y: number, seed = 1): number {
  let h = Math.imul(x + 0x9e37, 0x85ebca6b) ^ Math.imul(y + 0x7f4a, 0xc2b2ae35) ^ Math.imul(seed, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}
/** A part painted over a box in frame pixels, with where it goes. */
type Bit = { part: Part; at: Pt };
function paint(x0: number, y0: number, w: number, h: number, fn: (x: number, y: number) => Key, outline = true): Bit {
  const cv: Canvas = Array.from({ length: h }, (_, j) => Array.from({ length: w }, (_, i) => fn(x0 + i, y0 + j) ?? "."));
  return { part: { grid: toGrid(cv), outline }, at: [x0, y0] };
}
/** A soft ground shadow: a see-through oval, its core darker. */
const groundShadow = (cx: number, cy: number, rx: number, ry: number): Bit =>
  paint(Math.floor(cx - rx), Math.floor(cy - ry), 2 * rx + 1, 2 * ry + 1, (x, y) => {
    const t = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
    return t > 1 ? null : t < 0.55 ? "-" : "+";
  }, false);
/** A soft dust puff (see-through, no outline): a lumpy round cloud, its rim thinner; `thin`: only see-through. */
function puff(cx: number, cy: number, r: number, seed: number, thin = false): Bit {
  const R = Math.ceil(r) + 2;
  // A cloud of three round lumps (a big one in the middle, one lower each side), flat along its bottom.
  const s = seed % 2 ? 1 : -1;
  const lumps: [number, number, number][] = [
    [cx + s * 0.2 * r, cy - 0.15 * r, r * 0.78],
    [cx - 0.62 * r, cy + 0.2 * r, r * 0.58],
    [cx + 0.62 * r, cy + 0.2 * r, r * 0.55],
  ];
  return paint(Math.floor(cx - R), Math.floor(cy - R), 2 * R + 1, 2 * R + 1, (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    if (py > cy + 0.55 * r) return null;
    let best = Infinity;
    let lit = 0;
    for (const [lx, ly, lr] of lumps) {
      const d = Math.hypot(px - lx, py - ly) / lr;
      if (d < best) (best = d), (lit = (lx - px + ly - py) / lr);
    }
    if (best > 1) return null;
    if (thin) return best > 0.7 ? "%" : "Q";
    if (best > 0.82) return "q";
    return lit > 0.25 ? "g" : "G";
  }, false);
}
/** A little 4-point star (specks): size 0 a dot, 1 a plus, 2 a bigger twinkle. */
function star(x: number, y: number, size: number, hot = "F", arm = "Y", tip = "y"): Speck[] {
  if (size <= 0) return [[x, y, arm]];
  const out: Speck[] = [[x, y, hot]];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    out.push([x + dx, y + dy, arm]);
    if (size >= 2) out.push([x + 2 * dx, y + 2 * dy, tip]);
  }
  return out;
}

// ================================================================================================================
// 1. The block table: PARK_TABLE's width and foot offset (111 wide, foot 6 px over the bottom), taller for the drop.
// ================================================================================================================

const PX = 37; // pixels a square (TOWN_FEEL.housePxPerSquare)
const TW = 3 * PX; // 111
const TH = 100;
const TFOOT = TH - 6; // 94
const TCX = Math.floor(TW / 2); // 55
const SLAB_TOP = 26; // TABLE_BOARD.top: the slab's top over the foot (park.ts: TFOOT - TOP_Y - 1)
const SEAT_H = 10; // Math.round(TOWN_FEEL.sitSeat * 37): the park stools' seat height over the foot

/** Letters and shapes on the blocks' faces, 5 x 5. */
const GLYPHS: Record<string, readonly string[]> = {
  B: ["####.", "#...#", "####.", "#...#", "####."],
  I: ["#####", "..#..", "..#..", "..#..", "#####"],
  G: [".####", "#....", "#..##", "#...#", ".###."],
  O: [".###.", "#...#", "#...#", "#...#", ".###."],
  Y: ["#...#", ".#.#.", "..#..", "..#..", "..#.."],
  star: ["..#..", "#####", ".###.", ".#.#.", "#...#"],
  heart: [".#.#.", "#####", "#####", ".###.", "..#.."],
};
/** A block's colors: its face, shade, top (a light tint), its glyph's color and the glyph's drop shadow. */
interface Look {
  face: string;
  shade: string;
  top: string;
  ink: string;
  glyph: string;
}
const LOOKS = {
  red: { face: "1", shade: "7", top: "(", ink: "F", glyph: "B" },
  orange: { face: "2", shade: "8", top: ")", ink: "F", glyph: "I" },
  yellow: { face: "3", shade: "9", top: "[", ink: "1", glyph: "G" },
  green: { face: "4", shade: "0", top: "]", ink: "F", glyph: "B" },
  blue: { face: "5", shade: "!", top: "{", ink: "F", glyph: "O" },
  purple: { face: "6", shade: "?", top: "}", ink: "F", glyph: "Y" },
  teal: { face: "u", shade: "T", top: "U", ink: "F", glyph: "star" },
  pink: { face: "z", shade: "N", top: "n", ink: "F", glyph: "heart" },
} satisfies Record<string, Look>;

/**
 * A toy block seen from the front and a little above: `top` rows of its top face (a light tint, a white glint at its
 * left, its corners rounded), then `front` rows of its front face (its color, shaded right and bottom) with the glyph
 * in the middle and its drop shadow. `w`, `top`, `front` change for the squash and stretch.
 */
function blockPart(lk: Look, w: number, top: number, front: number): Part {
  const g = GLYPHS[lk.glyph]!;
  const gh = Math.min(5, front - 2);
  const gx = Math.floor((w - 5) / 2);
  const gy = top + 1 + Math.max(0, Math.floor((front - 2 - gh) / 2));
  const glyphAt = (i: number, j: number): boolean => {
    const c = i - gx;
    const r = j - gy;
    if (c < 0 || c > 4 || r < 0 || r >= gh) return false;
    const src = gh === 5 ? r : Math.round((r * 4) / Math.max(1, gh - 1));
    return g[src]![c] === "#";
  };
  const rows: string[] = [];
  for (let j = 0; j < top + front; j++) {
    let row = "";
    for (let i = 0; i < w; i++) {
      if (j < top) {
        if (j === 0 && (i === 0 || i === w - 1)) row += ".";
        else if (j === 0 && i >= 1 && i <= 2) row += "F";
        else row += i === w - 1 ? lk.face : lk.top;
        continue;
      }
      if (j === top + front - 1 && (i === 0 || i === w - 1)) row += lk.shade; // the rounded bottom corners, in shade
      else if (glyphAt(i, j)) row += lk.ink;
      else if (glyphAt(i - 1, j - 1)) row += lk.shade;
      else if (i === w - 1 || j === top + front - 1) row += lk.shade;
      else if (i === 0 && j === top) row += lk.top;
      else row += lk.face;
    }
    rows.push(row);
  }
  return { grid: rows };
}

/** The blocks: where each rests (its middle column and its bottom pixel row), its look, and its size. */
interface Block {
  cx: number;
  bottom: number;
  lk: Look;
  w: number;
  top: number;
  front: number;
}
const BW = 9; // a table block: 9 wide, a 3-row top face, a 7-row front (10 tall); rows stack 8 apart
const STEP = 8;
const tb = (cx: number, row: number, lk: Look): Block => ({ cx, bottom: TFOOT - 1 - row * STEP, lk, w: BW, top: 3, front: 7 });
/** In drop order: the bottom row left to right (B I G), the middle two (B O), the top (Y). */
const TABLE_BLOCKS: Block[] = [
  tb(TCX - 10, 0, LOOKS.red),
  tb(TCX, 0, LOOKS.orange),
  tb(TCX + 10, 0, LOOKS.yellow),
  tb(TCX - 5, 1, LOOKS.green),
  tb(TCX + 5, 1, LOOKS.blue),
  tb(TCX, 2, LOOKS.purple),
];
/** The stools: bigger blocks (11 wide, a 4-row top, an 8-row front) where PARK_TABLE's stools stand, their tops at its seat. */
const sb = (cx: number, lk: Look): Block => ({ cx, bottom: TFOOT - 1, lk, w: 11, top: 4, front: 8 });
const STOOL_BLOCKS: Block[] = [sb(TCX - PX, LOOKS.teal), sb(TCX + PX, LOOKS.pink)];

const blkParts: Record<string, Part> = {};
/** A block drawn at rest, squashed (landing) or stretched (bouncing), `lift` pixels up. */
type Pose = "rest" | "squash" | "stretch";
function blockLayer(b: Block, pose: Pose, lift = 0): Layer {
  const [w, top, front] = pose === "squash" ? [b.w + 2, b.top - 1, b.front - 2] : pose === "stretch" ? [b.w - 1, b.top, b.front + 1] : [b.w, b.top, b.front];
  const name = `${b.lk.glyph}-${b.lk.face}-${w}x${top}x${front}`;
  blkParts[name] ??= blockPart(b.lk, w, top, front);
  return { part: name, x: b.cx - Math.floor(w / 2), y: b.bottom - (top + front) + 1 - lift };
}
let bitN = 0;
const addBit = (b: Bit): Layer => {
  const n = `b${bitN++}`;
  blkParts[n] = b.part;
  return L(n, b.at);
};

/** The table's top: the top block's top row is the slab's height. */
const TOP_ROW = TABLE_BLOCKS[5]!.bottom - 9; // TFOOT - 26
if (TFOOT - TOP_ROW !== SLAB_TOP) throw new Error("the top block must reach the slab");

/**
 * A block's drop, by its phase (frames since it started): three falling frames (from above the picture), the landing
 * (squashed, a puff each side, its cue), a bounce (stretched, 2 up), then at rest with the puff thinning out.
 */
const FALL = [-84, -46, -16];
function dropped(b: Block, p: number, onGround: boolean): { layers: Layer[]; under: Layer[]; specks: Speck[]; landed: boolean } {
  const layers: Layer[] = [];
  const under: Layer[] = [];
  const specks: Speck[] = [];
  if (p < 0) return { layers, under, specks, landed: false };
  const h = b.top + b.front;
  if (p < 3) {
    const lay = blockLayer(b, "rest", -FALL[p]!);
    layers.push(lay);
    // Speed lines over it as it falls.
    if (p > 0)
      for (const dx of [-3, 0, 3]) for (let i = 2; i < (p === 1 ? 7 : 10); i++) if (dx !== 0 || i % 2) specks.push([b.cx + dx, lay.y - i, i < 5 ? "q" : "Q"]);
    if (onGround && p > 0) under.push(addBit(groundShadow(b.cx + 1, TFOOT, p === 1 ? 3 : 5, 1)));
    return { layers, under, specks, landed: false };
  }
  if (onGround) under.push(addBit(groundShadow(b.cx + 1, TFOOT, Math.ceil(b.w / 2) + 2, 2)));
  layers.push(blockLayer(b, p === 3 ? "squash" : p === 4 ? "stretch" : "rest", p === 4 ? 2 : 0));
  // The puff: either side of its foot, swelling out and thinning (behind every block: it shows round them).
  const pr = [4, 5, 5][p - 3];
  if (pr) {
    const out = [b.w / 2 + 2, b.w / 2 + 4, b.w / 2 + 6][p - 3]!;
    for (const d of [-1, 1]) under.push(addBit(puff(b.cx + d * out, b.bottom - 1 - (p - 3), pr, p + d, p === 5)));
  }
  if (p === 3) specks.push([b.cx - Math.ceil(b.w / 2) - 3, b.bottom - 4, "g"], [b.cx + Math.ceil(b.w / 2) + 3, b.bottom - 5, "g"]);
  void h;
  return { layers, under, specks, landed: true };
}

const restLayers = (bs: Block[]) => bs.map((b) => blockLayer(b, "rest"));
const restShadows = (bs: Block[]) => bs.filter((b) => b.bottom === TFOOT - 1).map((b) => addBit(groundShadow(b.cx + 1, TFOOT, Math.ceil(b.w / 2) + 2, 2)));
const TABLE_SHADOWS = restShadows(TABLE_BLOCKS);
const STOOL_SHADOWS = restShadows(STOOL_BLOCKS);

// ---- build: the six blocks drop in one by one, 3 frames apart; each lands squashed with a puff, bounces and settles.

const BUILD_GAP = 3;
const BUILD_N = BUILD_GAP * 5 + 6; // 21: the last block settles on the last frame
const buildFrames: Frame[] = Array.from({ length: BUILD_N }, (_, f) => {
  const under: Layer[] = [];
  const layers: Layer[] = [];
  const specks: Speck[] = [];
  let cue: string | undefined;
  TABLE_BLOCKS.forEach((b, i) => {
    const p = f - BUILD_GAP * i;
    const d = dropped(b, p, i < 3);
    under.push(...d.under);
    layers.push(...d.layers);
    specks.push(...d.specks);
    if (p === 3) cue = i === 5 ? "block-top" : "block";
  });
  // The top block's landing: a few stars spring off it.
  const pt = f - BUILD_GAP * 5;
  if (pt >= 3 && pt <= 5) {
    const t = pt - 3;
    specks.push(...star(TCX - 8 - 3 * t, TOP_ROW - 3 - 2 * t, t === 1 ? 2 : 1), ...star(TCX + 9 + 3 * t, TOP_ROW - 2 - 3 * t, t === 2 ? 0 : 1));
  }
  return { ms: f === BUILD_N - 1 ? 240 : 70, layers: [...under, ...layers], specks, ...(cue ? { cue } : {}) };
});

// ---- plop: the board lands on the top block (code drops it): dust bursts out from under it, stars spring out.

const PLOP = 5;
const SLAB_HALF = 15; // TABLE_BOARD.half (0.4 of a square)
const plopFrames: Frame[] = Array.from({ length: PLOP }, (_, t) => {
  const layers: Layer[] = [...TABLE_SHADOWS, ...restLayers(TABLE_BLOCKS)];
  const r = [4, 5, 6, 5, 4][t]!;
  const out = SLAB_HALF + 1 + [0, 3, 6, 8, 9][t]!;
  for (const d of [-1, 1]) {
    layers.push(addBit(puff(TCX + d * out, TOP_ROW + 1 - (t > 1 ? 1 : 0), r, t * 2 + d, t >= 3)));
    if (t >= 1 && t <= 3) layers.push(addBit(puff(TCX + d * (out - 6), TOP_ROW + 5 + t, r - 2, t + 5 + d, t === 3)));
  }
  const specks: Speck[] = [];
  if (t <= 3) {
    // Stars arc out and up from the slab's corners, then drop.
    const sx = [0, 4, 7, 9][t]!;
    const sy = [0, -5, -7, -6][t]!;
    specks.push(...star(TCX - SLAB_HALF - 4 - sx, TOP_ROW - 2 + sy, t === 3 ? 1 : 2));
    specks.push(...star(TCX + SLAB_HALF + 4 + sx, TOP_ROW - 3 + sy, t === 3 ? 1 : 2));
    specks.push(...star(TCX - SLAB_HALF - 1 - sx * 2, TOP_ROW + 3 + Math.round(sy / 2), t >= 2 ? 0 : 1, "F", "y", "y"));
    specks.push(...star(TCX + SLAB_HALF + 1 + sx * 2, TOP_ROW + 4 + Math.round(sy / 2), t >= 2 ? 0 : 1, "F", "y", "y"));
  } else specks.push([TCX - SLAB_HALF - 15, TOP_ROW - 2, "Y"], [TCX + SLAB_HALF + 15, TOP_ROW - 3, "Y"]);
  return { ms: t === 0 ? 90 : 80, layers, specks, ...(t === 0 ? { cue: "plop" } : {}) };
});

// ---- chairs: the two stool blocks drop in, the right one a frame after the left; each lands, bounces, settles.

const CHAIRS = 8;
const chairsFrames: Frame[] = Array.from({ length: CHAIRS }, (_, f) => {
  const under: Layer[] = [...TABLE_SHADOWS];
  const layers: Layer[] = restLayers(TABLE_BLOCKS);
  const specks: Speck[] = [];
  let cue: string | undefined;
  STOOL_BLOCKS.forEach((b, i) => {
    const p = f - i;
    const d = dropped(b, p, true);
    under.push(...d.under);
    layers.push(...d.layers);
    specks.push(...d.specks);
    if (p === 3) cue = "stool";
  });
  return { ms: f === CHAIRS - 1 ? 200 : 70, layers: [...under, ...layers], specks, ...(cue ? { cue } : {}) };
});

const blocksIdle: Frame = { ms: 1000, layers: [...TABLE_SHADOWS, ...STOOL_SHADOWS, ...restLayers(TABLE_BLOCKS), ...restLayers(STOOL_BLOCKS)] };

export const INTRO_BIGBOY_BLOCKS: Character = {
  id: "intro-bigboy-blocks",
  name: "Big Boy's toy-block table",
  w: TW,
  h: TH,
  foot: [TCX, TFOOT],
  palette: PALETTE,
  halo: HALO,
  parts: blkParts,
  anims: {
    build: { loop: false, frames: buildFrames },
    plop: { loop: false, frames: plopFrames },
    chairs: { loop: false, frames: chairsFrames },
    idle: { loop: true, frames: [blocksIdle] },
  },
};

// ================================================================================================================
// 2. The table's colors.
// ================================================================================================================

/**
 * The slab's colors for the renderer (keys "1" to "5", lightest to darkest): a teal foam play mat (his shirt's teal),
 * "1" its pale top edge, "2" its top, "4" its front. L and D: the board's squares, pale butter and his bubblegum pink.
 * P and Q the pieces (unchanged).
 */
export const INTRO_BIGBOY_TABLE_PALETTE: Record<string, string> = {
  k: PALETTE.k!,
  "1": PALETTE.a!,
  "2": PALETTE.b!,
  "3": PALETTE.c!,
  "4": PALETTE.d!,
  "5": PALETTE.e!,
  L: PALETTE.l!,
  D: PALETTE.o!,
  P: "#fbfbf6",
  Q: "#262321",
};
/** The board's squares in TABLE_INK's shape (as Alfil's INTRO_ALFIL_TABLE_INK), in case code wants the shades too. */
export const INTRO_BIGBOY_TABLE_INK = {
  light: PALETTE.l!,
  lightShade: PALETTE.m!,
  lightLine: "#c9ad5c",
  dark: PALETTE.o!,
  darkShade: PALETTE.p!,
  darkLine: "#8f3359",
} as const;

// ---- For the review: a mock slab on the blocks, and an 8 x 8 board with the town's pieces on it.

const mockSlab = paint(TCX - SLAB_HALF, TOP_ROW - 10, 2 * SLAB_HALF + 1, 13, (x, y) => {
  const i = x - (TCX - SLAB_HALF);
  const j = y - (TOP_ROW - 10);
  if (j >= 10) return j === 10 ? "c" : "d"; // the front face
  if (j === 0 || i === 0) return "a"; // the pale edge
  if (i === 2 * SLAB_HALF || j === 9) return "c";
  if (i >= 4 && i <= 2 * SLAB_HALF - 4 && j >= 2 && j <= 8) return (Math.floor((i - 4) / 3) + (j - 2)) % 2 ? "o" : "l";
  return "b";
});

/** The town's pieces (park.ts TABLE_PIECES, copied): `#` filled, `x` a hole. */
const TABLE_PIECES: Record<string, readonly string[]> = {
  P: ["..###..", "..###..", "...#...", "..###..", "..###..", ".#####.", "#######"],
  R: [".#.#.#.", ".#####.", "..###..", "..###..", "..###..", "..###..", ".#####.", "#######"],
  N: ["..#....", "..###..", ".#####.", ".######", ".##x.##", "..##...", "..###..", ".#####.", "#######"],
  B: ["...#...", "..###..", "..#x#..", "..###..", "...#...", "..###..", "..###..", ".#####.", "#######"],
  Q: ["#.#.#.#", ".#####.", "..###..", "..###..", "...#...", "..###..", "..###..", ".#####.", "#######"],
  K: ["...#...", "..###..", "...#...", ".#####.", "..###..", "..###..", "...#...", "..###..", "..###..", ".#####.", "#######"],
};
const SQ = 12;
const BOARD_PX = SQ * 8 + 4;
const boardBit = paint(0, 0, BOARD_PX, BOARD_PX, (x, y) => {
  if (x < 2 || y < 2 || x >= BOARD_PX - 2 || y >= BOARD_PX - 2) return x < 2 || y < 2 ? "a" : "d"; // the mat's edge
  const dark = (Math.floor((x - 2) / SQ) + Math.floor((y - 2) / SQ)) % 2 === 1;
  const i = (x - 2) % SQ;
  const j = (y - 2) % SQ;
  if (j === SQ - 1 || i === SQ - 1) return dark ? "p" : "m";
  return dark ? "o" : "l";
});
const BOARD_SET: [number, number, string, boolean][] = [
  [0, 0, "R", false], [1, 0, "N", false], [2, 0, "B", false], [3, 0, "Q", false], [4, 0, "K", false], [5, 0, "B", false], [7, 0, "R", false],
  [0, 1, "P", false], [1, 1, "P", false], [2, 1, "P", false], [5, 1, "P", false], [6, 1, "P", false], [7, 1, "P", false],
  [3, 2, "P", false], [5, 2, "N", false], [4, 3, "P", false], [3, 3, "P", true], [4, 4, "P", true], [2, 4, "B", true],
  [5, 5, "N", true], [0, 6, "P", true], [1, 6, "P", true], [2, 6, "P", true], [5, 6, "P", true], [6, 6, "P", true], [7, 6, "P", true],
  [0, 7, "R", true], [1, 7, "N", true], [2, 7, "B", true], [3, 7, "Q", true], [4, 7, "K", true], [7, 7, "R", true],
];
const piecesBit = (() => {
  const W = BOARD_PX;
  const fill: Key[][] = Array.from({ length: W }, () => Array<Key>(W).fill(null));
  const lineOf: Key[][] = Array.from({ length: W }, () => Array<Key>(W).fill(null));
  for (const [f, r, pc, white] of BOARD_SET) {
    const g = TABLE_PIECES[pc]!;
    const x0 = 2 + f * SQ + 2;
    const y0 = 2 + r * SQ + SQ - 2 - g.length;
    g.forEach((row, j) =>
      [...row].forEach((ch, i) => {
        const X = x0 + i;
        const Y = y0 + j;
        if (Y < 0) return;
        if (ch === "#") fill[Y]![X] = white ? (i >= 5 ? "s" : "P") : i <= 1 && j > 0 ? "x" : "X";
        else if (ch === "x") fill[Y]![X] = white ? "h" : "j";
        if (ch !== ".") for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (lineOf[Y + dy]) lineOf[Y + dy]![X + dx] ??= white ? "h" : "j";
      }),
    );
  }
  return paint(0, 0, W, W, (x, y) => fill[y]![x] ?? lineOf[y]![x] ?? null, false);
})();

// ================================================================================================================
// 3. The lollipop swirl: SWIRL (128 x 128, tiles both ways) and SWIRL_FRONT (48 x 128, tiles top to bottom), 6 frames.
// ================================================================================================================

const ST = 128;
const FW = 48;
const RAINBOW = "123456";
const SHADE_OF: Record<string, string> = { "1": "7", "2": "8", "3": "9", "4": "0", "5": "!", "6": "?" };
const TINT_OF: Record<string, string> = { "1": "(", "2": ")", "3": "[", "4": "]", "5": "{", "6": "}" };

/** A lollipop: its candy's middle (a pixel), radius, its stick's angle and length, its spin's way and starting turn. */
interface Pop {
  x: number;
  y: number;
  r: number;
  ang: number;
  len: number;
  dir: 1 | -1;
  ph: number;
}
/** The three candy sizes. */
const SIZES = [7, 11, 16] as const;
const mkPop = (x: number, y: number, r: number, i: number, lenK = 1.6): Pop => ({
  x,
  y,
  r,
  ang: grain(i, 3, 91) * 2 * Math.PI,
  len: Math.round(r * lenK + 5),
  dir: grain(i, 4, 91) < 0.5 ? 1 : -1,
  ph: Math.floor(grain(i, 5, 91) * 6),
});
const wrapD = (a: number) => mod(a + ST / 2, ST) - ST / 2;
/**
 * The crowd: a few big ones to start (placed by hand, off any grid), then over and over a lollipop in the biggest gap
 * left (the size that fits it, overlapping its neighbors by a few pixels), until the candies cover the tile.
 */
const POPS: Pop[] = (() => {
  const pops: Pop[] = [];
  const start: [number, number][] = [[17, 21], [79, 9], [112, 60], [46, 71], [93, 107], [8, 101], [70, 44]];
  start.forEach(([x, y], i) => pops.push(mkPop(x, y, 16, i)));
  for (let it = 0; it < 200; it++) {
    let best = -Infinity;
    let bx = 0;
    let by = 0;
    for (let y = 0; y < ST; y += 2)
      for (let x = 0; x < ST; x += 2) {
        let d = Infinity;
        for (const p of pops) {
          d = Math.min(d, Math.hypot(wrapD(x - p.x), wrapD(y - p.y)) - p.r);
          if (d <= best) break;
        }
        if (d > best) (best = d), (bx = x), (by = y);
      }
    if (best < 1) break;
    const r = SIZES.filter((s) => s <= best + 4).pop() ?? 7;
    pops.push(mkPop(bx + (grain(it, 1, 92) < 0.5 ? 0 : 1), by + (grain(it, 2, 92) < 0.5 ? 0 : 1), r, pops.length));
  }
  // Layered in a shuffled order, so big and small overlap each other every way.
  return pops.map((p, i) => ({ p, k: grain(i, 7, 93) })).sort((a, b) => a.k - b.k).map((e) => e.p);
})();

type Buf = Key[][];
const buf = (w: number, fillKey: Key): Buf => Array.from({ length: ST }, () => Array<Key>(w).fill(fillKey));
/**
 * Draws a lollipop into a buffer (rows wrap; columns wrap too if `wrapX`): its stick (white, lit on its upper-left
 * side, outlined), then its candy at frame f: a rainbow spiral (six arms, one per color, thin white ribbons between
 * them on the bigger ones) turned a sixth of a turn (one whole color) a frame, its rim lit on the top left and shaded
 * on the bottom right, a fixed shine on its top left, outlined. `own` records whose pixel each is.
 */
function drawPop(b: Buf, own: number[][] | null, id: number, p: Pop, f: number, wrapX: boolean): void {
  const w = b[0]!.length;
  const ex = Math.cos(p.ang) * p.len;
  const ey = Math.sin(p.ang) * p.len;
  const hw = p.r >= 16 ? 1.5 : 1.05;
  // The stick's lit side: the normal to it facing up and left.
  let nx = -Math.sin(p.ang);
  let ny = Math.cos(p.ang);
  if (nx + ny > 0) (nx = -nx), (ny = -ny);
  const R = p.r + 2;
  const x0 = Math.floor(Math.min(0, ex) - R);
  const x1 = Math.ceil(Math.max(0, ex) + R);
  const y0 = Math.floor(Math.min(0, ey) - R);
  const y1 = Math.ceil(Math.max(0, ey) + R);
  for (let dy = y0; dy <= y1; dy++)
    for (let dx = x0; dx <= x1; dx++) {
      const X = wrapX ? mod(p.x + dx, w) : p.x + dx;
      if (X < 0 || X >= w) continue;
      const Y = mod(p.y + dy, ST);
      const d = Math.hypot(dx, dy);
      let k: Key = null;
      if (d < p.r) {
        const a = Math.atan2(dy, dx);
        const v = (p.dir * a) / (2 * Math.PI) + d / (p.r * 1.05) + (f + p.ph) / 6;
        const band = v * 6;
        const col = RAINBOW[mod(Math.floor(band), 6)]!;
        k = col;
        if (p.r >= 16 && mod(band, 1) < 0.15 && d > 2) k = "F";
        if (d > p.r - 1.4) k = dx + dy > 1 ? SHADE_OF[col]! : dx + dy < -2 ? TINT_OF[col]! : col; // the rim
        // The shine: an arc up on the left, and a dot inside it.
        const da = Math.abs(mod(a + 2.36 + Math.PI, 2 * Math.PI) - Math.PI);
        if (da < 0.5 && d > p.r * 0.56 && d < p.r * 0.56 + (p.r >= 11 ? 2 : 1.3)) k = "F";
        if (p.r >= 11 && Math.round(-p.r * 0.28) === dx && Math.round(-p.r * 0.3) === dy) k = "F";
      } else if (d < p.r + 1) k = "k";
      else {
        // The stick (behind its candy).
        const t = Math.max(0, Math.min(1, (dx * ex + dy * ey) / (p.len * p.len)));
        const sx = dx - t * ex;
        const sy = dy - t * ey;
        const sd = Math.hypot(sx, sy);
        if (sd <= hw) {
          const side = sx * nx + sy * ny;
          k = side > 0.35 ? "F" : side > -0.6 ? "W" : "V";
        } else if (sd <= hw + 1) k = "k";
      }
      if (k) {
        b[Y]![X] = k;
        if (own) own[Y]![X] = id;
      }
    }
}

/** Sparkles over the swirl: fixed spots, each twinkling (out, small, big, small) on its own beat of the 6-frame loop. */
const TWINKLE = [0, 1, 2, 1, 0, -1];
const SPARKS = Array.from({ length: 14 }, (_, i) => ({ x: Math.floor(grain(i, 1, 94) * ST), y: Math.floor(grain(i, 2, 94) * ST), ph: i % 6 }));
function sparkSpecks(f: number, w: number, keep: (x: number) => boolean): Speck[] {
  const out: Speck[] = [];
  for (const s of SPARKS) {
    const size = TWINKLE[(f + s.ph) % 6]!;
    if (size < 0) continue;
    for (const [x, y, k] of star(s.x, s.y, size)) {
      const X = mod(x, ST);
      if (X < w && keep(X)) out.push([X, mod(y, ST), k]);
    }
  }
  return out;
}

/** The swirl at frame f: its keys and which lollipop owns each pixel (-1: the deep candy shadow between them). */
const SWIRL_BUFS = [0, 1, 2, 3, 4, 5].map((f) => {
  const b = buf(ST, "K");
  const own: number[][] = Array.from({ length: ST }, () => Array<number>(ST).fill(-1));
  POPS.forEach((p, i) => drawPop(b, own, i, p, f, true));
  return { b, own };
});
const full = (w: number, fn: (x: number, y: number) => Key, outline = false): Part => ({
  grid: Array.from({ length: ST }, (_, y) => Array.from({ length: w }, (_, x) => fn(x, y) ?? ".").join("")),
  outline,
});

const swirlParts: Record<string, Part> = {};
const swirlFrames: Frame[] = SWIRL_BUFS.map(({ b }, f) => {
  swirlParts[`s${f}`] = full(ST, (x, y) => b[y]![x]!);
  return { ms: 70, layers: [{ part: `s${f}`, x: 0, y: 0 }], specks: sparkSpecks(f, ST, () => true), ...(f === 0 ? { cue: "swirl" } : {}) };
});
export const INTRO_BIGBOY_SWIRL: Character = {
  id: "intro-bigboy-swirl",
  name: "Big Boy's lollipop swirl (tile)",
  w: ST,
  h: ST,
  foot: [ST / 2, ST - 1],
  palette: PALETTE,
  parts: swirlParts,
  anims: { idle: { loop: true, frames: swirlFrames } },
};

/**
 * The leading edge: on its left the swirl itself (the next tile's columns, so it meets SWIRL with no seam), keeping
 * only the lollipops whose middles lie near its left side, so the edge is ragged along their round candies and their
 * sticks poke out; then lollipops tumbling in half outside (spinning, their sticks wheeling round a sixth of a turn a
 * frame) and sparkles flying ahead.
 */
const KEEP_X = 20;
/** The tumbling ones: alternately in close (half over the edge) and out ahead. */
const TUMBLE: Pop[] = Array.from({ length: 8 }, (_, i) => {
  const r = [9, 6, 8, 7, 10, 6, 8, 7][i]!;
  const x = (i % 2 ? 34 : 25) + Math.floor(grain(i, 1, 95) * 5);
  return mkPop(x, Math.floor((i * ST) / 8 + 6 + grain(i, 2, 95) * 6), r, 40 + i, 0.9);
});
const frontParts: Record<string, Part> = {};
const frontFrames: Frame[] = SWIRL_BUFS.map(({ b, own }, f) => {
  // The kept lollipops drawn on their own, in the swirl's order (so what lay under a dropped one shows whole), the
  // deep shadow between them where the swirl has it, and the swirl's own first two columns (for the seam).
  const fb = buf(FW, null);
  POPS.forEach((p, i) => {
    const xr = wrapD(p.x);
    if (xr <= KEEP_X) drawPop(fb, null, i, { ...p, x: xr }, f, false);
  });
  for (let y = 0; y < ST; y++)
    for (let x = 0; x < FW; x++) {
      if (x < 2) fb[y]![x] = b[y]![x]!;
      else if (fb[y]![x] === null && own[y]![x] === -1 && x < KEEP_X) fb[y]![x] = "K";
    }
  TUMBLE.forEach((p, i) => {
    const turn = (Math.PI / 3) * f * p.dir;
    const bob = Math.round(Math.sin((Math.PI / 3) * f + i) * 1.2);
    drawPop(fb, null, 0, { ...p, ang: p.ang + turn, y: p.y + bob }, f, false);
  });
  // The cut edges outlined, so every candy and stick there is whole.
  const filled = (x: number, y: number) => x < 0 || (x < FW && fb[mod(y, ST)]![x] !== null);
  const out = fb.map((row, y) => row.map((k, x) => (k && k !== "k" && x > 0 && (!filled(x + 1, y) || !filled(x - 1, y) || !filled(x, y + 1) || !filled(x, y - 1)) ? "k" : k)));
  frontParts[`e${f}`] = full(FW, (x, y) => out[y]![x]!);
  // Sparkles flying ahead: each runs 3 px a frame over an 18 px stretch, so it comes round in 6 frames.
  const specks: Speck[] = sparkSpecks(f, FW, (x) => x < KEEP_X - 2);
  for (let i = 0; i < 10; i++) {
    const y = Math.floor((i * ST) / 10 + grain(i, 1, 96) * 8);
    const x = 29 + mod(Math.floor(grain(i, 2, 96) * 18) + 3 * f, 18);
    specks.push(...star(x, y, i % 3 === 0 ? 1 : 0, "F", i % 2 ? "Y" : "y"), [x - 2, y, "Q"], [x - 3, y, "%"]);
  }
  return { ms: 70, layers: [{ part: `e${f}`, x: 0, y: 0 }], specks: specks.filter(([x]) => x >= 0 && x < FW) };
});
export const INTRO_BIGBOY_SWIRL_FRONT: Character = {
  id: "intro-bigboy-swirl-front",
  name: "Big Boy's lollipop swirl (leading edge)",
  w: FW,
  h: ST,
  foot: [0, ST - 1],
  palette: PALETTE,
  parts: frontParts,
  anims: { idle: { loop: true, frames: frontFrames } },
};

// ================================================================================================================
// The review sheet.
// ================================================================================================================

/** Lays out frames side by side: each slot a character's frame at an offset (its parts copied under a prefix). */
function compose(parts: Record<string, Part>, slots: { prefix: string; ch: Character; frame: Frame; at: Pt }[], ms: number): Frame {
  const layers: Layer[] = [];
  const specks: Speck[] = [];
  for (const s of slots) {
    for (const l of s.frame.layers) {
      const name = `${s.prefix}:${l.part}`;
      parts[name] = s.ch.parts[l.part]!;
      layers.push({ ...l, part: name, x: l.x + s.at[0], y: l.y + s.at[1] });
    }
    for (const [x, y, k] of s.frame.specks ?? []) specks.push([x + s.at[0], y + s.at[1], k]);
  }
  return { ms, layers, specks };
}

const extraParts: Record<string, Part> = { slab: mockSlab.part, board: boardBit.part, pieces: piecesBit.part };
const blocksPlus: Character = { ...INTRO_BIGBOY_BLOCKS, parts: { ...blkParts, ...extraParts } };
const slabFrame: Frame = { ms: 1000, layers: [...blocksIdle.layers, L("slab", mockSlab.at)] };
const boardFrame: Frame = { ms: 1000, layers: [L("board", [0, 0]), L("pieces", [0, 0])] };

/** The swirl's seam check: SWIRL tiled 3 x 2, the FRONT column at its right (all their frames together). */
const GRID_W = 3 * ST + FW;
const GRID_H = 2 * ST;
const gridSlots = (f: number, at: Pt) => [
  ...[0, 1, 2].flatMap((i) => [0, 1].map((j) => ({ prefix: `sw${i}${j}`, ch: INTRO_BIGBOY_SWIRL, frame: swirlFrames[f]!, at: [at[0] + i * ST, at[1] + j * ST] as Pt }))),
  ...[0, 1].map((j) => ({ prefix: `fr${j}`, ch: INTRO_BIGBOY_SWIRL_FRONT, frame: frontFrames[f]!, at: [at[0] + 3 * ST, at[1] + j * ST] as Pt })),
];

const SHEET_W = 240 + GRID_W;
const SHEET_H = GRID_H + 4;
const AT = { blocks: [2, 2] as Pt, table: [2, 106] as Pt, board: [124, 6] as Pt, grid: [238, 2] as Pt };
const sheetParts: Record<string, Part> = {};
const sheetAnims: Record<string, Anim> = {};
/** The sheet with one piece's frame swapped in (the rest at rest). */
function sheetFrame(over: { blocks?: Frame; grid?: number }, ms: number): Frame {
  return compose(
    sheetParts,
    [
      { prefix: "blk", ch: blocksPlus, frame: over.blocks ?? blocksIdle, at: AT.blocks },
      { prefix: "tab", ch: blocksPlus, frame: slabFrame, at: AT.table },
      { prefix: "brd", ch: blocksPlus, frame: boardFrame, at: AT.board },
      ...gridSlots(over.grid ?? 0, AT.grid),
    ],
    ms,
  );
}
sheetAnims.idle = { loop: true, frames: [sheetFrame({}, 1000)] };
for (const [name, anim] of Object.entries(INTRO_BIGBOY_BLOCKS.anims))
  sheetAnims[`blocks-${name}`] = { loop: anim.loop, frames: anim.frames.map((fr) => ({ ...sheetFrame({ blocks: fr }, fr.ms), ...(fr.cue ? { cue: fr.cue } : {}) })) };
sheetAnims.swirl = { loop: true, frames: [0, 1, 2, 3, 4, 5].map((f) => sheetFrame({ grid: f }, 70)) };

/** (While drawing, a single piece can be reviewed on its own here; the sheet when null.) */
const DEV = null as Character | null;
export const HOUSE_INTRO_BIGBOY: Character = DEV
  ? { ...DEV, id: "house-intro-bigboy" }
  : {
      id: "house-intro-bigboy",
      name: "Big Boy's battle intro (review sheet)",
      w: SHEET_W,
      h: SHEET_H,
      foot: [SHEET_W / 2, SHEET_H - 4],
      palette: PALETTE,
      parts: sheetParts,
      anims: sheetAnims,
    };
