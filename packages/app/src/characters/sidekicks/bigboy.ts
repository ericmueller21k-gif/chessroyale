/**
 * Big Boy's sidekick (id "sidekick-bigboy"): a toddler teddy bear, a town bot that wanders the square and plays chess at
 * the park's tables. No powers, never fights: a friendly, curious kid who copies the big one, so it hugs ONE toy block
 * (a letter-less cube: red front, yellow top, blue side) the way Big Boy throws his.
 *
 * Plush and round: a big round head with round ears, button eyes with a shine, a stitched nose and smile, a round tummy,
 * stubby arms and legs, a teal bow tie with light-blue dots (Big Boy's shirt and diaper colors) and a few visible stitches.
 * Three-quarters, facing our right, light from the top left.
 *
 * Rigging: the head (one per face), the body, the ears, the bow and the block are painted once; the arms (and legs) are
 * painted from points, so a new pose is a handful of numbers (`ARMS`, `Pose`).
 */
import { canvas, ellipse, toGrid, type Canvas } from "../paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "../sprite.ts";

export const SIDEKICK_BIGBOY_PALETTE = {
  k: "#2a1712", // outline (Big Boy's)
  d: "#8a5230", // teddy fur, dark to light
  c: "#b57a45",
  C: "#d6a069",
  h: "#efc590",
  u: "#f7e4bd", // cream: muzzle, belly, toes
  U: "#dcbb88",
  q: "#f08c86", // blush, inner ear, tongue
  Q: "#c9625f",
  s: "#1b0e0a", // button eye, shine, gloss, white of an eye
  n: "#6b4330",
  x: "#ffffff",
  t: "#fff8e6",
  B: "#3a1f14", // nose, its gloss
  N: "#8a5a48",
  m: "#6a1f1f", // inside of the mouth
  S: "#4a2a18", // stitches
  T: "#0f5c63", // the bow: Big Boy's teal, dark to light
  e: "#178589",
  y: "#23a8a8",
  Y: "#4fcfc6",
  P: "#6f8fb3", // his diaper's light blue
  p: "#97b7d6",
  w: "#fff0a0", // block: yellow top
  W: "#ffd24a",
  r: "#ff7a63", // block: red front
  R: "#e2483f",
  E: "#a8282a",
  b: "#3f8cff", // block: blue side
  v: "#2560c8",
  a: "#c98f4e", // stool wood, light to dark
  A: "#a06a33",
  D: "#6c4222",
  z: "#0d0e12", // ground shadow
  g: "#b9bcc6", // dust, smoke
  G: "#7d8290",
  j: "#8fd8ff", // sweat
  f: "#ffd84a", // sparkles
  o: "#ff9bd6",
  i: "#9fe8ff",
} as const;

type Pt = readonly [number, number];

const W = 64;
const H = 64;
const GROUND = 61;

const PARTS: Record<string, Part> = {};
interface Painted {
  part: Part;
  at: Pt;
}
const PAINTED = new Map<string, Painted>();
function painted(name: string, make: () => Painted): Painted & { name: string } {
  let p = PAINTED.get(name);
  if (!p) {
    p = make();
    PAINTED.set(name, p);
    PARTS[name] = p.part;
  }
  return { ...p, name };
}
function crop(cv: Canvas): Painted {
  let x0 = W;
  let y0 = H;
  let x1 = -1;
  let y1 = -1;
  cv.forEach((row, y) =>
    row.forEach((k, x) => {
      if (k === ".") return;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }),
  );
  if (x1 < 0) return { part: { grid: ["."] }, at: [0, 0] };
  return { part: { grid: cv.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1).join("")) }, at: [x0, y0] };
}

// ---- Painting helpers (pixel-center coordinates: an integer is the middle of that pixel).

const ell = (cx: number, cy: number, rx: number, ry: number) => (x: number, y: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
/** Fur by a light value (0 dark to 1 light): banded, never blended. */
const tone = (l: number) => (l < 0.27 ? "d" : l < 0.56 ? "c" : l < 0.84 ? "C" : "h");
const roundL = (cx: number, cy: number, rx: number, ry: number, bias = 0) => (x: number, y: number) => 0.52 + bias - 0.45 * ((x - cx) / rx) - 0.55 * ((y - cy) / ry);
function fill(cv: Canvas, inside: (x: number, y: number) => boolean, light: (x: number, y: number) => number): void {
  for (let y = 0; y < cv.length; y++) for (let x = 0; x < cv[0]!.length; x++) if (inside(x, y)) cv[y]![x] = tone(light(x, y));
}
function stamp(cv: Canvas, rows: readonly string[], x0: number, y0: number): void {
  rows.forEach((row, y) =>
    [...row].forEach((k, i) => {
      if (k === "." || cv[y0 + y]?.[x0 + i] === undefined) return;
      cv[y0 + y]![x0 + i] = k;
    }),
  );
}
function dots(cv: Canvas, pts: readonly Pt[], k: string): void {
  for (const [x, y] of pts) if (cv[y]?.[x] !== undefined) cv[y]![x] = k;
}

// ---- Faces. A big round head: two button eyes with a shine, a stitched nose and smile, a cream muzzle.

export type Mood = "calm" | "blink" | "happy" | "cheer" | "think" | "thinkBlink" | "smug" | "rattled" | "hurt" | "out" | "bold" | "sleepy";
type Eye = "open" | "up" | "wide" | "half" | "arc" | "shut" | "pinch" | "x" | "sleepy";
type Brow = "up" | "worried" | "bold" | "smug";
type Mouth = "smile" | "grin" | "flat" | "smirk" | "frown" | "o" | "tongue";

/** The near eye (4 x 5, stamped at its own spot) and the far one (3 x 5). */
const NEAR_EYE: Record<Eye, { rows: readonly string[]; x: number; y: number }> = {
  open: { x: 4, y: 3, rows: [".ss.", "sxss", "ssss", "sssn", ".ss."] },
  up: { x: 4, y: 2, rows: [".ss.", "ssxs", "ssxs", "ssss", ".ss."] },
  wide: { x: 3, y: 2, rows: [".kkk.", "kttsk", "ktssk", "kttsk", ".kkk."] },
  half: { x: 4, y: 3, rows: ["....", "....", "ssss", "sxsn", ".ss."] },
  arc: { x: 4, y: 3, rows: ["....", ".ss.", "s..s", "....", "...."] },
  shut: { x: 4, y: 3, rows: ["....", "....", "....", "ssss", "...."] },
  sleepy: { x: 4, y: 3, rows: ["....", "....", "s..s", ".ss.", "...."] },
  pinch: { x: 4, y: 3, rows: ["ss..", ".ss.", "..ss", ".ss.", "ss.."] },
  x: { x: 4, y: 3, rows: ["....", "s..s", ".ss.", ".ss.", "s..s"] },
};
const FAR_EYE: Record<Eye, { rows: readonly string[]; x: number; y: number }> = {
  open: { x: 12, y: 3, rows: [".ss", "xss", "sss", "ssn", ".ss"] },
  up: { x: 12, y: 2, rows: [".ss", "xss", "xss", "sss", ".ss"] },
  wide: { x: 11, y: 2, rows: [".kkk.", "kttsk", "ktssk", "kttsk", ".kkk."] },
  half: { x: 12, y: 3, rows: ["...", "...", "sss", "xsn", ".ss"] },
  arc: { x: 12, y: 3, rows: ["...", ".s.", "s.s", "...", "..."] },
  shut: { x: 12, y: 3, rows: ["...", "...", "...", "sss", "..."] },
  sleepy: { x: 12, y: 3, rows: ["...", "...", "s.s", ".s.", "..."] },
  pinch: { x: 12, y: 3, rows: ["..s", ".s.", "s..", ".s.", "..s"] },
  x: { x: 12, y: 3, rows: ["...", "s.s", ".s.", "s.s", "..."] },
};
const BROWS: Record<Brow, readonly [readonly Pt[], readonly Pt[]]> = {
  up: [[[4, 1], [5, 1], [6, 1]], [[12, 1], [13, 1], [14, 1]]],
  worried: [[[3, 2], [4, 2], [5, 1], [6, 1]], [[12, 1], [13, 1], [14, 2], [15, 2]]],
  bold: [[[3, 1], [4, 1], [5, 2], [6, 2]], [[12, 2], [13, 2], [14, 1], [15, 1]]],
  smug: [[[4, 2], [5, 2], [6, 2]], [[12, 0], [13, 0], [14, 1]]],
};
/** Stamped under the nose: the first row is the stitch down from it. */
const MOUTHS: Record<Mouth, readonly string[]> = {
  smile: ["k...k", ".kkk."],
  grin: ["kkkkk", "kmmmk", ".kqk.", "..k.."],
  flat: [".kkk."],
  smirk: ["....k", "kkkk."],
  frown: [".kkk.", "k...k"],
  o: [".kk.", "kmmk", ".kk."],
  tongue: ["kkkkk", "kmmmk", ".kqqk", "..kk."],
};
const FACES: Record<Mood, { near: Eye; far: Eye; brow?: Brow; mouth: Mouth; blush?: boolean }> = {
  calm: { near: "open", far: "open", mouth: "smile", blush: true },
  blink: { near: "shut", far: "shut", mouth: "smile", blush: true },
  sleepy: { near: "sleepy", far: "sleepy", mouth: "smile", blush: true },
  happy: { near: "arc", far: "arc", mouth: "grin", blush: true },
  cheer: { near: "open", far: "open", brow: "up", mouth: "grin", blush: true },
  think: { near: "up", far: "up", brow: "up", mouth: "flat" },
  thinkBlink: { near: "shut", far: "shut", brow: "up", mouth: "flat" },
  smug: { near: "half", far: "half", brow: "smug", mouth: "smirk", blush: true },
  rattled: { near: "wide", far: "wide", brow: "worried", mouth: "frown" },
  hurt: { near: "pinch", far: "pinch", brow: "worried", mouth: "o" },
  out: { near: "x", far: "x", mouth: "tongue" },
  bold: { near: "open", far: "open", brow: "bold", mouth: "grin", blush: true },
};

const HW = 23;
const HH = 17;
/** Where the head grid sits at rest (its top-left), on the frame. */
const HX0 = 20;
const HY0 = 24;

function head(mood: Mood): Part {
  const cv = canvas(HW, HH);
  const skull = ell(10, 8, 10.4, 8.4);
  const muzzle = ell(16, 11.4, 6.2, 4.6);
  const inside = (x: number, y: number) => skull(x, y) || muzzle(x, y);
  fill(cv, inside, roundL(9, 7, 12, 10, 0.1));
  // The cream muzzle, lit on its top left, shaded on its bottom right.
  for (let y = 0; y < HH; y++)
    for (let x = 0; x < HW; x++)
      if (muzzle(x, y) && inside(x, y)) cv[y]![x] = (x - 16) / 6.2 + (y - 11.4) / 4.6 > 0.7 ? "U" : "u";
  // A forehead seam of stitches, and the nose.
  dots(cv, [[9, 0], [9, 1], [9, 3], [9, 4]], "S");
  stamp(cv, [".NBB.", "BBBBB", ".BBB."], 15, 8);
  const face = FACES[mood];
  const ne = NEAR_EYE[face.near];
  const fe = FAR_EYE[face.far];
  stamp(cv, ne.rows, ne.x, ne.y);
  stamp(cv, fe.rows, fe.x, fe.y);
  if (face.blush) dots(cv, [[2, 10], [3, 10], [4, 10], [3, 11]], "q");
  if (face.brow) for (const side of BROWS[face.brow]) dots(cv, side, "S");
  const mouth = MOUTHS[face.mouth];
  stamp(cv, mouth, face.mouth === "o" ? 16 : 15, 12);
  return { grid: toGrid(cv) };
}
const MOODS: readonly Mood[] = ["calm", "blink", "happy", "cheer", "think", "thinkBlink", "smug", "rattled", "hurt", "out", "bold", "sleepy"];
for (const m of MOODS) PARTS[`head:${m}`] = head(m);

/** Round ears, with a pink inside; the far one a little smaller and darker. */
function ear(far: boolean): Part {
  const cv = canvas(7, 7);
  fill(cv, ell(3, 3, 3.4, 3.4), roundL(3, 3, 4, 4, far ? -0.1 : 0.08));
  const inner = far ? ell(2.4, 3.8, 1.8, 1.8) : ell(3.6, 3.8, 1.9, 1.9);
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) if (inner(x, y) && cv[y]![x] !== ".") cv[y]![x] = x + y < 6 ? "Q" : "q";
  return { grid: toGrid(cv) };
}
PARTS["ear:n"] = ear(false);
PARTS["ear:f"] = ear(true);

/** The bow tie: Big Boy's teal with his light blue in the dots. */
PARTS["bow"] = { grid: ["Yy......ye", "YyyyTTyyye", "ypyyTTyype", "yyyyTTyyee", "ye......ee"] };
/** The toy block: red front, yellow top, blue side. No letters. */
PARTS["block"] = {
  grid: [
    "...wwwwwwwW",
    "..wwwwwwwWb",
    ".wwwwwwwWbb",
    "rrrrrrrrbbb",
    "rrrrrrrrbbb",
    "RrRRRRRRbbb",
    "RrRRRRRRbbb",
    "RRRRRRRRbbb",
    "RRRRRRRRbbv",
    "RRRRRRRRbv.",
    "EEEEEEEEv..",
  ],
};
PARTS["tail"] = { grid: [".Cc.", "CCcc", "Ccdd", ".cd."] };
PARTS["shadow"] = (() => {
  const cv = canvas(28, 3);
  ellipse(cv, 14, 1.5, 14, 1.5, "z");
  return { grid: toGrid(cv), outline: false };
})();
PARTS["stool"] = {
  grid: [
    "aaaaaaaaaaaaaaaaaa",
    "AAAAAAAAAAAAAAAAAA",
    "DDDDDDDDDDDDDDDDDD",
    "..aA..........aA..",
    "..aA..........aA..",
    "..aA..........aA..",
    "..aAAAAAAAAAAAaA..",
    "..aA..........aA..",
    "..aA..........aA..",
    "..aA..........aA..",
  ],
};

// ---- Limbs: a round stroke through a few points, three bands of light, a paw or a foot at the end.

function nearest(p: Pt, pts: readonly Pt[]): { d: number; nx: number; ny: number } {
  let best = { d: Infinity, nx: 0, ny: 0 };
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const vx = b[0] - a[0];
    const vy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy || 1)));
    const nx = p[0] - (a[0] + t * vx);
    const ny = p[1] - (a[1] + t * vy);
    const d = Math.hypot(nx, ny);
    if (d < best.d) best = { d, nx, ny };
  }
  return best;
}
function paintStroke(cv: Canvas, pts: readonly Pt[], r: number, endR: number, far: boolean): void {
  const end = pts[pts.length - 1]!;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const n = nearest([x, y], pts);
      const de = Math.hypot(x - end[0], y - end[1]);
      const inEnd = endR > 0 && de <= endR;
      if (n.d > r && !inEnd) continue;
      const [nx, ny, rr] = inEnd && de < n.d + 0.8 ? [x - end[0], y - end[1], endR] : [n.nx, n.ny, r];
      cv[y]![x] = tone(0.64 - 0.42 * (nx / rr) - 0.5 * (ny / rr) - (far ? 0.18 : 0));
    }
}
/** A bare foot with a cream toe cap, toes toward our right. */
function paintFoot(cv: Canvas, cx: number, cy: number, far: boolean): void {
  const e = ell(cx, cy, 4.7, 2.3);
  const l = roundL(cx - 1, cy - 1, 6, 3.4, 0.05);
  for (let y = Math.floor(cy - 3); y <= Math.ceil(cy + 3); y++)
    for (let x = Math.floor(cx - 5); x <= Math.ceil(cx + 5); x++)
      if (e(x, y)) cv[y]![x] = x >= cx + 3 ? (y > cy ? "U" : "u") : tone(l(x, y) - (far ? 0.12 : 0));
}

const LEG_X = { n: 24, f: 34 };
function legPart(far: boolean, lift: number): Painted & { name: string } {
  return painted(`leg:${far ? "f" : "n"}:${lift}`, () => {
    const cv = canvas(W, H);
    const cx = far ? LEG_X.f : LEG_X.n;
    paintStroke(cv, [[cx, 50], [cx, 56 - lift]], 2.6, 0, far);
    paintFoot(cv, cx + 1.5, 57.5 - lift, far);
    return crop(cv);
  });
}
/** A leg stretched out along the floor (plopped down): the thigh, then the sole of the foot, its pad toward us. */
function floorLegPart(far: boolean): Painted & { name: string } {
  return painted(`floorleg:${far ? "f" : "n"}`, () => {
    const cv = canvas(W, H);
    const y = far ? 54 : 56;
    paintStroke(cv, [[far ? 31 : 29, y], [far ? 43 : 40, y + 1]], 2.6, 0, far);
    const cx = far ? 46 : 42.5;
    const cy = y + 0.5;
    fill(cv, ell(cx, cy, 2.7, 3.6), (x, yy) => roundL(cx, cy, 3.4, 4.4, 0.04)(x, yy) - (far ? 0.14 : 0));
    for (let yy = 0; yy < H; yy++) for (let x = 0; x < W; x++) if (ell(cx + 0.2, cy + 0.3, 1.5, 2.3)(x, yy)) cv[yy]![x] = yy - cy > 0.5 ? "U" : "u";
    return crop(cv);
  });
}
/** A dangling leg over the stool's edge: thigh, knee, ankle, then the foot. */
function sitLegPart(far: boolean, swing: number): Painted & { name: string } {
  return painted(`sitleg:${far ? "f" : "n"}:${swing}`, () => {
    const cv = canvas(W, H);
    const o = far ? 2 : 0;
    paintStroke(cv, [[27 + o, 49], [33 + o, 50], [34 + o, 53 + swing]], 2.6, 0, far);
    paintFoot(cv, 36.5 + o, 55 + swing, far);
    return crop(cv);
  });
}

// ---- Body: round, with a cream tummy and a stitched patch low on the hip.

const BODY = { cx: 30, cy: 45.5, rx: 9.2, ry: 7.6 };
function bodyPart(): Painted {
  const cv = canvas(W, H);
  const body = ell(BODY.cx, BODY.cy, BODY.rx, BODY.ry);
  fill(cv, body, roundL(BODY.cx, BODY.cy, BODY.rx, BODY.ry, 0.04));
  const belly = ell(33, 47.5, 5.6, 4.9);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (body(x, y) && belly(x, y)) cv[y]![x] = (x - 33) / 5.6 + (y - 47.5) / 4.9 > 0.55 ? "U" : "u";
  return crop(cv);
}
const BODY_PART = painted("body", bodyPart);

// ---- Arms and the block they hold.

export type ArmName = "hug" | "tight" | "wave0" | "waveL" | "waveM" | "waveR" | "up" | "upL" | "upR" | "offer" | "jab" | "low" | "clutch" | "lap" | "think" | "flop" | "slump";
interface Arm {
  /** Shoulder, elbow, paw. */
  near: readonly Pt[] | null;
  far: readonly Pt[] | null;
  /** The block's top-left. */
  block: Pt | null;
  /** Drawn in front of the head (arms raised beside it). */
  nearFront?: boolean;
}
const NEAR_HUG: readonly Pt[] = [[24, 42], [26, 47], [31, 49]];
const FAR_HUG: readonly Pt[] = [[37, 42], [40, 45], [43, 46]];
const ARMS: Record<ArmName, Arm> = {
  hug: { near: NEAR_HUG, far: FAR_HUG, block: [31, 42] },
  tight: { near: [[23, 42], [25, 46], [30, 48]], far: [[37, 42], [39, 44], [42, 45]], block: [30, 41] },
  wave0: { near: NEAR_HUG, far: [[37, 42], [44, 41], [45, 33]], block: [31, 42] },
  waveL: { near: NEAR_HUG, far: [[37, 42], [46, 40], [45, 25]], block: [31, 42] },
  waveM: { near: NEAR_HUG, far: [[37, 42], [47, 40], [47, 25]], block: [31, 42] },
  waveR: { near: NEAR_HUG, far: [[37, 42], [48, 40], [49, 26]], block: [31, 42] },
  up: { near: [[23, 42], [15, 35], [24, 20]], far: [[37, 42], [45, 35], [37, 20]], block: [25, 10], nearFront: true },
  upL: { near: [[23, 42], [15, 35], [23, 20]], far: [[37, 42], [45, 35], [36, 20]], block: [24, 10], nearFront: true },
  upR: { near: [[23, 42], [15, 35], [25, 20]], far: [[37, 42], [45, 35], [38, 20]], block: [26, 10], nearFront: true },
  offer: { near: [[23, 42], [30, 45], [39, 47]], far: [[37, 42], [42, 44], [45, 46]], block: [39, 41] },
  jab: { near: [[23, 42], [31, 44], [41, 46]], far: [[37, 42], [43, 43], [47, 45]], block: [41, 40] },
  low: { near: [[23, 42], [25, 48], [31, 51]], far: [[37, 42], [39, 48], [42, 51]], block: [31, 46] },
  clutch: { near: [[23, 42], [25, 45], [30, 45]], far: [[37, 42], [39, 44], [41, 44]], block: [30, 40] },
  lap: { near: [[24, 42], [27, 46], [32, 47]], far: [[37, 42], [40, 46], [43, 47]], block: [32, 41] },
  think: { near: [[23, 42], [26, 46], [31, 47]], far: [[37, 42], [40, 45], [43, 46]], block: [31, 42] },
  flop: { near: [[24, 42], [18, 41], [14, 37]], far: [[37, 42], [43, 40], [46, 36]], block: null },
  slump: { near: [[24, 42], [20, 46], [20, 49]], far: [[37, 42], [40, 46], [41, 49]], block: null },
};
function armPart(name: ArmName, who: "n" | "f"): (Painted & { name: string }) | null {
  const pts = who === "n" ? ARMS[name].near : ARMS[name].far;
  if (!pts) return null;
  return painted(`arm:${name}:${who}`, () => {
    const cv = canvas(W, H);
    paintStroke(cv, pts, 2.5, 3.1, who === "f");
    if (who === "n") {
      // A little light-blue patch on the upper arm, stitched at its corners.
      const px = Math.round(pts[0]![0] + (pts[1]![0] - pts[0]![0]) * 0.55);
      const py = Math.round(pts[0]![1] + (pts[1]![1] - pts[0]![1]) * 0.55);
      stamp(cv, ["SpS", "ppp", "SPS"], px - 1, py - 1);
    }
    return crop(cv);
  });
}

// ---- Poses.

export interface Pose {
  mood?: Mood;
  /** The whole upper body down this many pixels (a breath, a crouch). */
  bob?: number;
  /** The upper body sideways (a toddler's wobble); the feet stay put. */
  sway?: number;
  /** The head on the body. */
  hx?: number;
  hy?: number;
  /** The whole figure sideways. */
  dx?: number;
  /** Off the ground. */
  air?: number;
  /** Feet: sideways shift and lift, near and far. */
  feet?: { n?: { x?: number; lift?: number }; f?: { x?: number; lift?: number } };
  arms?: ArmName;
  /** The block drawn this far from where the arms hold it. */
  blockAt?: Pt;
  ear?: "mid" | "up" | "down";
  tail?: number;
  sit?: boolean;
  /** Dangling legs: how far each swings down (sitting). */
  swing?: number;
  /** Plopped down on the floor, legs stretched out in front (the bear's `bob` sets how low). */
  plop?: boolean;
  /** A block lying or flying loose (top-left, quarter turns), when the arms aren't holding it. */
  loose?: { x: number; y: number; rot?: 0 | 1 | 2 | 3 };
  noShadow?: boolean;
}
const EARS = { mid: [[0, 0], [0, 0]], up: [[-1, -1], [1, -1]], down: [[-1, 1], [1, 1]] } as const;

function build(p: Pose): Layer[] {
  const dx = p.dx ?? 0;
  const air = p.air ?? 0;
  const sit = p.sit ?? false;
  const ux = dx + (p.sway ?? 0) + (sit ? -2 : 0);
  const uy = (p.bob ?? 0) - air + (sit ? -2 : 0);
  const L: Layer[] = [];
  const put = (part: string, x: number, y: number) => L.push({ part, x, y });
  const add = (l: { name: string; at: Pt }, ox = 0, oy = 0) => put(l.name, l.at[0] + ox, l.at[1] + oy);
  if (!p.noShadow) put("shadow", 16 + dx, GROUND - 2);
  if (sit) put("stool", 17 + dx, 51);
  put("tail", 19 + ux, 50 + uy + (p.tail ?? 0));

  const swing = p.swing ?? 0;
  if (sit) add(sitLegPart(true, swing ? 0 : 1), dx);
  else if (p.plop) {
    add(floorLegPart(true), dx);
    add(floorLegPart(false), dx);
  } else {
    const f = p.feet ?? {};
    add(legPart(true, f.f?.lift ?? 0), dx + (f.f?.x ?? 0), -air);
    add(legPart(false, f.n?.lift ?? 0), dx + (f.n?.x ?? 0), -air);
  }
  add(BODY_PART, ux, uy);
  if (sit) add(sitLegPart(false, swing), dx);
  if (p.loose) L.push({ part: "block", x: p.loose.x + dx, y: p.loose.y, rot: p.loose.rot });

  const arm = ARMS[p.arms ?? (sit ? "lap" : "hug")];
  const farArm = armPart(p.arms ?? (sit ? "lap" : "hug"), "f");
  const nearArm = armPart(p.arms ?? (sit ? "lap" : "hug"), "n");
  if (farArm) add(farArm, ux, uy);
  if (arm.block) put("block", arm.block[0] + ux + (p.blockAt?.[0] ?? 0), arm.block[1] + uy + (p.blockAt?.[1] ?? 0));
  if (nearArm && !arm.nearFront) add(nearArm, ux, uy);

  const hx = HX0 + (p.hx ?? 0) + ux;
  const hy = HY0 + (p.hy ?? 0) + uy;
  const e = EARS[p.ear ?? "mid"];
  put("ear:n", hx - 1 + e[0][0], hy - 2 + e[0][1]);
  put("ear:f", hx + 13 + e[1][0], hy - 2 + e[1][1]);
  put(`head:${p.mood ?? "calm"}`, hx, hy);
  put("bow", 26 + ux, 39 + uy);
  if (nearArm && arm.nearFront) add(nearArm, ux, uy);
  return L;
}

// ---- Little effects.

function seeded(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => ((s = (s * 1103515245 + 12345) >>> 0) >>> 8) / 16777216;
}
const star = (x: number, y: number, k = "f"): Speck[] => [[x, y, "x"], [x - 1, y, k], [x + 1, y, k], [x, y - 1, k], [x, y + 1, k]];
function twinkles(t: number, n = 4, box: readonly [number, number, number, number] = [8, 6, 56, 40]): Speck[] {
  const rnd = seeded(t * 31 + 5);
  return Array.from({ length: n }, (_, i) => star(Math.round(box[0] + rnd() * (box[2] - box[0])), Math.round(box[1] + rnd() * (box[3] - box[1])), (i + t) % 2 ? "f" : "i")).flat();
}
const dust = (t: number): Speck[] =>
  [-1, 1].flatMap((side) => [0, 1, 2].map((i): Speck => [Math.round(30 + side * (9 + i * 3 + t * 2)), GROUND - 1 - (i % 2) - (t > 0 ? 1 : 0), t > 1 ? "G" : "g"]));
const dropShadow = (r: number): Speck[] => Array.from({ length: r * 2 + 1 }, (_, i): Speck => [30 - r + i, GROUND - 1, "z"]);
const thoughts = (n: number): Speck[] =>
  ([[46, 24], [50, 20], [54, 16]] as const).slice(0, n).flatMap(([x, y], k): Speck[] => {
    const big = k === 2;
    return [[x, y, "t"], [x + 1, y, "t"], [x, y + 1, "t"], [x + 1, y + 1, "g"], ...(big ? ([[x - 1, y, "t"], [x + 2, y, "t"], [x, y - 1, "t"], [x + 1, y - 1, "t"], [x - 1, y + 1, "g"], [x + 2, y + 1, "G"], [x, y + 2, "g"], [x + 1, y + 2, "G"]] as Speck[]) : [])];
  });
const sweat = (i: number): Speck[] => {
  const t = i % 4;
  return [[18 - t, 26 + t, "j"], [18 - t, 27 + t, "x"], [44 + t, 24 + t, "j"], [44 + t, 25 + t, "x"]];
};
function burst([cx, cy]: Pt, r: number, seed = 0): Speck[] {
  const keys = ["f", "o", "i", "W"];
  return Array.from({ length: 8 }, (_, i): Speck => [Math.round(cx + Math.cos((i / 8) * Math.PI * 2 + seed) * r), Math.round(cy + Math.sin((i / 8) * Math.PI * 2 + seed) * r), keys[(i + seed) % 4]!]);
}
const FLASH: Record<string, string> = { d: "#c48a60", c: "#e0b088", C: "#f5d2b0", h: "#ffffff", u: "#ffffff", U: "#f3e6cf" };

function f(ms: number, p: Pose, extra: Partial<Frame> = {}): Frame {
  const specks = (extra.specks ?? []).filter(([x, y]) => x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2);
  return { ms, layers: build(p), ...extra, specks };
}

// ---- Animations.

/** Idle (3 s): sways, breathes, blinks, flicks an ear, and now and then hugs its block a little tighter. */
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 30 }, (_, i) => {
    const bob = i % 15 >= 8 ? 1 : 0;
    const sway = i < 4 ? 0 : i < 11 ? 1 : i < 19 ? 0 : i < 26 ? -1 : 0;
    const blink = i === 12 || i === 13 || i === 27;
    const squeeze = i >= 20 && i <= 25;
    const ear = i === 7 ? "down" : i === 8 ? "up" : "mid";
    return f(100, { bob: squeeze ? 1 : bob, sway, hx: sway ? -sway : 0, mood: blink ? "blink" : squeeze && i >= 21 && i <= 24 ? "happy" : "calm", arms: squeeze ? "tight" : "hug", ear, tail: i >= 3 && i <= 6 ? (i % 2 ? 1 : 0) : 0 });
  }),
};

/** Walk (0.6 s): a wobbly toddler waddle, the head bobbing, the block held to its tummy. */
const walk: Anim = {
  loop: true,
  frames: Array.from({ length: 6 }, (_, i) => {
    const nx = [1, 0, -1, -1, 0, 1][i]!;
    const nl = [0, 0, 0, 1, 2, 1][i]!;
    const fi = (i + 3) % 6;
    const fx = [1, 0, -1, -1, 0, 1][fi]!;
    const fl = [0, 0, 0, 1, 2, 1][fi]!;
    const sway = i < 3 ? -1 : 1;
    const bob = i % 3 === 0 ? 1 : 0;
    return f(100, { bob, sway, hy: bob ? 0 : -1, hx: -sway, mood: "calm", feet: { n: { x: nx, lift: nl }, f: { x: fx, lift: fl } }, ear: bob ? "down" : "mid", tail: i < 3 ? 1 : 0 }, i % 3 === 0 ? { cue: "step" } : {});
  }),
};

/** Sit (loops): on a stool at the chess table, facing the board, legs dangling, the block in its lap; a slow blink, a think. */
const sit: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) => {
    const lean = i >= 6 && i <= 11;
    const blink = i === 3 || i === 4 || i === 13;
    return f(200, { sit: true, mood: blink ? (lean ? "thinkBlink" : "sleepy") : lean ? "think" : "calm", bob: i % 8 >= 4 ? 1 : 0, hx: lean ? 2 : 0, hy: lean ? 1 : 0, swing: i % 8 < 4 ? 0 : 1, ear: i === 9 ? "down" : "mid", tail: i % 8 < 4 ? 0 : 1 });
  }),
};

/** Wave (once, 1.2 s): lifts a paw and waves hello, the block held in the other, then settles back to idle. */
const WAVES: readonly ArmName[] = ["waveL", "waveM", "waveR", "waveM", "waveL", "waveM", "waveR", "waveM"];
const wave: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 1, mood: "happy", arms: "tight" }),
    f(100, { mood: "cheer", arms: "wave0", hy: -1, ear: "up" }, {}),
    ...WAVES.map((arms, i) => f(100, { mood: i % 2 ? "cheer" : "happy", arms, hx: arms === "waveL" ? -1 : arms === "waveR" ? 1 : 0, hy: i % 2 ? 0 : -1, bob: i % 2 ? 1 : 0, tail: i % 2 ? 1 : -1, ear: i % 4 === 1 ? "up" : "mid" }, { specks: i % 3 === 0 ? star(52 + (i % 3), 20 + (i % 4) * 3) : [] })),
    f(100, { mood: "happy", arms: "hug" }),
    f(100, { mood: "calm", arms: "hug" }),
  ],
};

/** Entrance: drops in from above on its shadow, lands with a squash and a puff of dust, then lifts the block: ta-da. */
const entrance: Anim = {
  loop: false,
  frames: [
    { ms: 90, layers: [], specks: dropShadow(4) },
    { ms: 80, layers: [], specks: dropShadow(8) },
    f(70, { air: 6, mood: "cheer", arms: "up", feet: { n: { lift: 2 }, f: { lift: 3 } }, ear: "up" }, { specks: dropShadow(11) }),
    f(70, { air: 3, mood: "cheer", arms: "up", feet: { n: { lift: 1 }, f: { lift: 2 } }, ear: "up" }),
    f(100, { bob: 3, mood: "blink", arms: "tight", ear: "down" }, { cue: "step", specks: dust(0) }),
    f(90, { bob: 1, mood: "happy", arms: "hug" }, { specks: dust(1) }),
    f(110, { mood: "cheer", arms: "up", hy: -1 }, { specks: [...dust(2), ...twinkles(1, 3)] }),
    f(110, { mood: "happy", arms: "upL", hx: -1 }, { specks: twinkles(2, 3) }),
    f(110, { mood: "happy", arms: "upR", hx: 1 }),
    f(120, { mood: "happy", arms: "hug" }),
    f(300, { mood: "calm", arms: "hug" }),
  ],
};

/** Thinking (loops): head tipped up, eyes up, a foot tapping, the block hugged, thought dots popping up. */
const thinking: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) =>
    f(150, { mood: i === 8 ? "thinkBlink" : "think", arms: "think", hx: 2, hy: -1, bob: i % 6 >= 3 ? 1 : 0, feet: { f: i % 4 === 1 ? { lift: 2 } : {} }, tail: i % 6 < 3 ? 1 : 0, ear: i === 5 ? "down" : "mid" }, { specks: thoughts(i % 6 < 1 ? 0 : i % 6 < 3 ? 1 : i % 6 < 5 ? 2 : 3) }),
  ),
};

/** Its move: a hop toward the board and a push of the block at it. */
const move: Anim = {
  loop: false,
  frames: [
    f(90, { bob: 2, mood: "bold", arms: "tight" }),
    f(80, { air: 4, dx: 1, mood: "bold", arms: "offer", feet: { n: { lift: 2 }, f: { lift: 2 } }, ear: "up" }, { cue: "step" }),
    f(80, { air: 5, dx: 2, mood: "bold", arms: "offer", feet: { n: { lift: 2 }, f: { lift: 2 } } }),
    f(100, { bob: 2, dx: 2, mood: "happy", arms: "offer" }, { specks: dust(0) }),
    f(100, { bob: 1, dx: 2, mood: "happy", arms: "jab" }),
    f(110, { dx: 1, mood: "happy", arms: "hug" }),
    f(150, { mood: "calm", arms: "hug" }),
  ],
};

/** A capture: two excited hops, the block held high, twinkles everywhere. */
const capture: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 2, mood: "bold", arms: "tight" }),
    f(80, { air: 5, mood: "cheer", arms: "up", feet: { n: { lift: 2 }, f: { lift: 3 } }, ear: "up" }, { specks: twinkles(1) }),
    f(80, { air: 6, mood: "happy", arms: "upL", feet: { n: { lift: 3 }, f: { lift: 3 } }, hy: -1 }, { specks: twinkles(2) }),
    f(80, { air: 4, mood: "happy", arms: "upR" }, { specks: twinkles(3) }),
    f(80, { bob: 2, mood: "cheer", arms: "up" }, { specks: dust(0) }),
    f(80, { air: 6, mood: "happy", arms: "upL", feet: { n: { lift: 2 }, f: { lift: 3 } }, ear: "up" }, { specks: twinkles(4) }),
    f(80, { air: 6, mood: "happy", arms: "upR", feet: { n: { lift: 3 }, f: { lift: 3 } }, hy: -1 }, { specks: twinkles(5) }),
    f(80, { air: 4, mood: "happy", arms: "upL" }, { specks: twinkles(6) }),
    f(90, { bob: 2, mood: "cheer", arms: "up" }, { specks: dust(1) }),
    f(120, { bob: 1, mood: "happy", arms: "hug" }),
    f(160, { mood: "smug", arms: "hug" }),
  ],
};

/** Hurt: hit, a flash, eyes screwed shut, the block slipping; then it shakes it off with a brave little grin. */
const hurt: Anim = {
  loop: false,
  frames: [
    f(70, { bob: 2, mood: "hurt", arms: "low", ear: "down" }, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    f(80, { bob: 3, mood: "hurt", arms: "low", ear: "down" }, { shake: [-1, 0], specks: [[18, 29, "j"], [18, 30, "x"]] }),
    f(90, { bob: 2, dx: -1, mood: "hurt", arms: "low", ear: "down" }, { specks: [[17, 31, "j"], [17, 32, "x"]] }),
    f(100, { bob: 1, dx: -1, mood: "rattled", arms: "clutch" }),
    f(110, { mood: "blink", arms: "tight" }),
    f(120, { mood: "bold", arms: "hug" }),
    f(160, { mood: "calm", arms: "hug" }),
  ],
};

/** Check: two sharp pushes of the block at the board, eyes bright. */
const JAB: Pose = { bob: 2, dx: 1, mood: "bold", arms: "jab" };
const check: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 1, mood: "bold", arms: "tight" }),
    f(110, { ...JAB }),
    f(90, { bob: 1, mood: "bold", arms: "tight" }),
    f(110, { ...JAB }),
    f(90, { bob: 1, dx: 1, mood: "bold", arms: "offer" }),
    f(150, { dx: 1, mood: "happy", arms: "offer" }),
    f(160, { mood: "smug", arms: "hug" }),
  ],
};

/** Smug: chin up, eyes half shut, a little smirk, a slow nod, the block hugged just so. */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(150, { mood: "smug", arms: "hug", hy: i < 3 || i > 5 ? -1 : 0, hx: i < 4 ? 0 : 1, bob: i % 4 === 2 ? 1 : 0, ear: i === 5 ? "up" : "mid" })),
};

/** Rattled: wide eyes, worried brows, sweat flying, trembling where it stands, the block clutched to its chest. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(80, { mood: "rattled", arms: "clutch", dx: i % 2 ? 1 : -1, bob: i % 4 === 2 ? 1 : 0, ear: "down", tail: i % 2 ? 1 : -1 }, { specks: sweat(i) })),
};

/** Defeat: hit, dizzy eyes, the block flies out of its paws, a wobble, and it plops down on its bottom (the last frame holds). */
const PLOP: Pose = { plop: true, bob: 7, arms: "slump", mood: "out", ear: "down", hx: -1, hy: 1 };
const defeat: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 2, mood: "hurt", arms: "low", ear: "down" }, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    f(90, { bob: 2, dx: -1, mood: "out", arms: "low", ear: "down" }, { specks: star(18, 25, "f") }),
    f(100, { bob: 3, dx: -1, sway: -2, mood: "out", arms: "flop", ear: "down", loose: { x: 42, y: 32 } }, { specks: star(36, 22, "o") }),
    f(100, { bob: 4, sway: -2, hx: -2, mood: "out", arms: "flop", ear: "down", feet: { n: { lift: 1 } }, loose: { x: 49, y: 38 } }, { specks: star(18, 24, "i") }),
    f(110, { ...PLOP, bob: 5 }, { cue: "poof", specks: dust(0) }),
    f(120, { ...PLOP, loose: { x: 50, y: 44 } }, { specks: [...dust(1), ...star(22, 31, "f"), ...star(36, 30, "i")] }),
    f(150, { ...PLOP, bob: 6, loose: { x: 50, y: 47 } }, { specks: [...star(25, 29, "o"), ...star(33, 30, "f")] }),
    f(200, { ...PLOP, hy: 2, loose: { x: 50, y: 49 } }, { specks: [...star(23, 30, "i"), ...star(35, 29, "o")] }),
    f(1000, { ...PLOP, hy: 2, tail: -1, loose: { x: 50, y: 49 } }, { specks: [...star(26, 29, "f"), ...star(33, 31, "i")] }),
  ],
};

/** Victory: jumping for joy, the block high overhead, pastel fireworks popping all round. Then again. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const air = [0, 3, 5, 6, 5, 3, 0, 0, 3, 5, 3, 0][i]!;
    const arms: ArmName[] = ["up", "upL", "upR", "upL", "upR", "upL", "up", "up", "upR", "upL", "upR", "up"];
    return f(110, { bob: i === 0 || i === 6 || i === 7 ? 2 : 0, air, mood: air > 2 ? "happy" : "cheer", arms: arms[i]!, feet: air > 2 ? { n: { lift: 3 }, f: { lift: 3 } } : {}, hy: i % 2 ? -1 : 0, ear: air > 3 ? "up" : "mid", tail: i % 2 ? 1 : -1 }, { specks: [...burst([10 + (i % 3) * 20, 8 + (i % 4) * 3], 2 + (i % 4), i), ...twinkles(i, 2)] });
  }),
};

export const sidekickBigboy: Character = {
  id: "sidekick-bigboy",
  name: "Big Boy's sidekick",
  w: W,
  h: H,
  foot: [30, GROUND],
  palette: SIDEKICK_BIGBOY_PALETTE,
  halo: "#2e2218",
  parts: PARTS,
  anims: { idle, walk, sit, wave, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory },
};
