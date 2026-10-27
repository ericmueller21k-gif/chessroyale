/**
 * Chub & Chirp's sidekick (id "sidekick-chubchirp"): a baby bunny, a town bot that wanders the square and plays chess at
 * the park's tables. No powers, never fights: a curious little one who copies the big one. It wears a small green scarf
 * with a gold clasp (Chub's), and a tiny green grasshopper (Chirp's little friend) sits on its head between its ears.
 *
 * Round and soft: a big round head with big shiny eyes and a twitchy pink nose, long floppy ears, a cream chest and a
 * cotton tail, a round pear body, big back feet. Three-quarters, facing our right, light from the top left.
 *
 * Rigging: the head (one per face and nose), the body, the haunch, the feet and the grasshopper are painted once; the
 * ears and arms are painted from points per pose; the scarf's tail ripples (a wave); the grasshopper's antennae are loose
 * pixels (specks). A new pose is a handful of numbers.
 */
import { canvas, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";
import { lieDown, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "../../../../packages/app/src/characters/sprite.ts";

export const SIDEKICK_PALETTE = {
  k: "#1b150e", // outline
  F: "#56392a", // fur (Chub's browns), dark to light
  G: "#7b5739",
  H: "#a07a51",
  I: "#c39e70",
  C: "#cbb592", // cream: muzzle, chest, tail, toes; shade, mid, light
  D: "#e7d8b8",
  E: "#f8f0de",
  p: "#e6939b", // pink: nose, inside the ears, blush; and its shade
  q: "#b65f6e",
  x: "#0b0a08", // eyes
  w: "#ffffff", // their glints
  i: "#6b4a2e", // the lower iris
  a: "#2b5218", // the grasshopper's greens (Chirp's), dark to light
  b: "#447a1f",
  c: "#62a02a",
  d: "#86c13a",
  e: "#b3de5f",
  m: "#959431", // yellow-greens: legs, antennae
  n: "#c0bb49",
  o: "#e3da7a",
  S: "#17492f", // the scarf, dark to light
  T: "#22694a",
  U: "#2f8c5f",
  V: "#57b47f",
  Y: "#f2c14e", // gold: the clasp, sparkles
  y: "#ffe58a",
  O: "#b4840f",
  R: "#e8667a", // a heart
  t: "#c98f4e", // stool wood, light to dark
  u: "#a06a33",
  v: "#6c4222",
  z: "#0d0e12", // ground shadow
  g: "#4d4538", // dust, dark and light
  h: "#7d705a",
  j: "#9fd8ff", // sweat
} as const;

type Pt = readonly [number, number];

/** The frame, and the ground (the first row below the feet). */
const W = 64;
const H = 64;
const GROUND = 61;

const PARTS: Record<string, Part> = {};
interface Painted {
  part: Part;
  at: Pt;
}
const PAINTED = new Map<string, Painted>();
/** A painted part, made once by name and registered. */
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

// ---- Small painting helpers (pixel-center coordinates: an integer is the middle of that pixel).

const ell = (cx: number, cy: number, rx: number, ry: number) => (x: number, y: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
/** Light from the top left on a round surface: 0 dark to 1 light. */
const roundL = (cx: number, cy: number, rx: number, ry: number, bias = 0) => (x: number, y: number) => 0.52 + bias - 0.45 * ((x - cx) / rx) - 0.55 * ((y - cy) / ry);
const fur = (l: number) => (l < 0.2 ? "F" : l < 0.45 ? "G" : l < 0.8 ? "H" : "I");
const cream = (l: number) => (l < 0.4 ? "C" : l < 0.78 ? "D" : "E");
function fill(cv: Canvas, inside: (x: number, y: number) => boolean, color: (x: number, y: number) => string): void {
  for (let y = 0; y < cv.length; y++) for (let x = 0; x < cv[0]!.length; x++) if (inside(x, y)) cv[y]![x] = color(x, y);
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

// ---- The face: big shiny eyes, a pink nose at the muzzle's tip, a small mouth.

export type Mood = "calm" | "blink" | "happy" | "cheer" | "think" | "thinkBlink" | "smug" | "sleepy" | "rattled" | "hurt" | "out" | "bold";
type Eye = "open" | "up" | "wide" | "half" | "arc" | "shut" | "pinch" | "x";
type Brow = "up" | "worried" | "bold" | "smug";
type Mouth = "smile" | "grin" | "flat" | "smirk" | "wavy" | "o" | "tongue" | "gasp";

/** The near eye (5 x 6, on our left) and the far one (4 x 5, nearer the nose). */
const NEAR_EYE: Record<Eye, readonly string[]> = {
  open: [".xxx.", "xwwxx", "xwxxx", "xxxxx", "xxiix", ".xxx."],
  up: [".xxx.", "xiixx", "xwwxx", "xxxxx", "xxxxx", ".xxx."],
  wide: [".xxx.", "xwwwx", "xwxwx", "xwxwx", "xwwwx", ".xxx."],
  half: [".....", "xxxxx", "xwxxx", "xxxxx", ".xxx.", "....."],
  arc: [".....", ".....", ".xxx.", "x...x", ".....", "....."],
  shut: [".....", ".....", ".....", "xxxxx", ".....", "....."],
  pinch: [".....", "xx...", ".xxx.", "...xx", ".xxx.", "xx..."],
  x: [".....", "x...x", ".x.x.", "..x..", ".x.x.", "x...x"],
};
const FAR_EYE: Record<Eye, readonly string[]> = {
  open: [".xx.", "xwxx", "xxxx", "xiix", ".xx."],
  up: [".xx.", "xiix", "xwwx", "xxxx", ".xx."],
  wide: [".xx.", "xwwx", "xwxx", "xwwx", ".xx."],
  half: ["....", "xxxx", "xwxx", ".xx.", "...."],
  arc: ["....", ".xx.", "x..x", "....", "...."],
  shut: ["....", "....", "xxxx", "....", "...."],
  pinch: ["....", "...x", "xxx.", "...x", "...."],
  x: ["....", "x..x", ".xx.", "x..x", "...."],
};
/** Brows: [near, far] pixel lists on the head grid. */
const BROWS: Record<Brow, readonly [readonly Pt[], readonly Pt[]]> = {
  up: [[[7, 5], [8, 5], [9, 5]], [[16, 5], [17, 5], [18, 5]]],
  worried: [[[6, 7], [7, 6], [8, 5], [9, 5]], [[15, 5], [16, 5], [17, 6], [18, 7]]],
  bold: [[[6, 5], [7, 5], [8, 6], [9, 6]], [[16, 7], [17, 6], [18, 5], [19, 5]]],
  smug: [[[6, 6], [7, 6], [8, 6]], [[16, 4], [17, 4], [18, 5]]],
};
const MOUTHS: Record<Mouth, { rows: readonly string[]; at: Pt }> = {
  smile: { rows: ["k...k", ".kkk."], at: [18, 15] },
  grin: { rows: ["kkkkk", "kqqqk", ".kqk.", "..k.."], at: [18, 15] },
  flat: { rows: ["kkkk"], at: [18, 16] },
  smirk: { rows: ["...kk", "kkkk."], at: [18, 15] },
  wavy: { rows: ["k.k.k", ".k.k."], at: [18, 16] },
  o: { rows: [".kk.", "kqqk", ".kk."], at: [19, 15] },
  tongue: { rows: ["kkkkk", "kqqqk", "..kqk", "...k."], at: [18, 15] },
  gasp: { rows: ["kkkk", "kqqk", "kqqk", "kkkk"], at: [19, 15] },
};
const FACES: Record<Mood, { near: Eye; far: Eye; brow?: Brow; mouth: Mouth; blush?: boolean }> = {
  calm: { near: "open", far: "open", mouth: "smile", blush: true },
  blink: { near: "shut", far: "shut", mouth: "smile", blush: true },
  happy: { near: "arc", far: "arc", mouth: "grin", blush: true },
  cheer: { near: "open", far: "open", brow: "up", mouth: "grin", blush: true },
  think: { near: "up", far: "up", brow: "up", mouth: "flat" },
  thinkBlink: { near: "shut", far: "shut", brow: "up", mouth: "flat" },
  smug: { near: "half", far: "half", brow: "smug", mouth: "smirk", blush: true },
  sleepy: { near: "half", far: "half", mouth: "smile", blush: true },
  rattled: { near: "wide", far: "wide", brow: "worried", mouth: "wavy" },
  hurt: { near: "pinch", far: "pinch", brow: "worried", mouth: "o" },
  out: { near: "x", far: "x", mouth: "tongue" },
  bold: { near: "open", far: "open", brow: "bold", mouth: "grin", blush: true },
};

const HW = 25;
const HH = 21;
/** Where the head grid sits at rest (its top-left), on the frame. */
const HX0 = 19;
const HY0 = 19;

function head(mood: Mood, nose: number): Part {
  const cv = canvas(HW, HH);
  const skull = ell(11.5, 10, 11.7, 10.4);
  const snout = ell(19.5, 14.5, 5.4, 4.8);
  const inside = (x: number, y: number) => skull(x, y) || snout(x, y);
  const L = roundL(13, 11, 13, 12, 0.1);
  fill(cv, inside, (x, y) => fur(L(x, y)));
  // The cream muzzle.
  const muzzle = ell(19.8, 15, 4.8, 4.0);
  fill(cv, (x, y) => inside(x, y) && muzzle(x, y), (x, y) => cream(0.55 - 0.07 * (x - 19) - 0.08 * (y - 14)));
  const face = FACES[mood];
  stamp(cv, NEAR_EYE[face.near], 7, 7);
  stamp(cv, FAR_EYE[face.far], 16, 8);
  if (face.blush) dots(cv, [[6, 14], [7, 14], [8, 14]], "p");
  if (face.brow) for (const side of BROWS[face.brow]) dots(cv, side, "k");
  const m = MOUTHS[face.mouth];
  stamp(cv, m.rows, m.at[0], m.at[1] - nose);
  // The twitchy nose: a pink 2 x 2 at the muzzle's tip; twitching, it hops up a pixel.
  stamp(cv, ["pp", "pq"], 23, nose ? 11 : 12);
  return { grid: toGrid(cv) };
}
const MOODS: readonly Mood[] = ["calm", "blink", "happy", "cheer", "think", "thinkBlink", "smug", "sleepy", "rattled", "hurt", "out", "bold"];
for (const m of MOODS) for (const n of [0, 1]) PARTS[`head:${m}:${n}`] = head(m, n);

// ---- Strokes: ears and arms, painted along a few points and shaded like a cylinder.

function nearestSeg(p: Pt, a: Pt, b: Pt): { d: number; nx: number; ny: number; t: number } {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy || 1)));
  const nx = p[0] - (a[0] + t * vx);
  const ny = p[1] - (a[1] + t * vy);
  return { d: Math.hypot(nx, ny), nx, ny, t };
}
function along(pts: readonly Pt[], rs: readonly number[], p: Pt): { s: number; d: number; nx: number; ny: number; rr: number; side: number } {
  let best = { s: 0, d: Infinity, nx: 0, ny: 0, rr: rs[0]!, side: 0 };
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const n = nearestSeg(p, a, b);
    const rr = rs[i]! + (rs[i + 1]! - rs[i]!) * n.t;
    if (n.d - rr < best.d - best.rr) {
      const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
      best = { s: (i + n.t) / (pts.length - 1), d: n.d, nx: n.nx, ny: n.ny, rr, side: Math.max(-1, Math.min(1, Math.sign(cross) * (n.d / rr))) };
    }
  }
  return best;
}
type StrokeColor = (light: number, s: number, side: number) => string;
function stroke(pts: readonly Pt[], rs: readonly number[], color: StrokeColor): Painted {
  const cv = canvas(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const a = along(pts, rs, [x, y]);
      if (a.d > a.rr) continue;
      cv[y]![x] = color(0.6 - 0.45 * (a.nx / a.rr) - 0.5 * (a.ny / a.rr), a.s, a.side);
    }
  return crop(cv);
}
const key = (pts: readonly Pt[]) => pts.map((p) => `${p[0]},${p[1]}`).join(";");

/** An ear: long, wide in the middle, rounded at its tip, pink inside. */
function earPart(pts: readonly Pt[], near: boolean) {
  const rs = near ? [2.4, 3.0, 1.9] : [2.2, 2.7, 1.7];
  return painted(`ear:${near ? "n" : "f"}:${key(pts)}`, () =>
    stroke(pts, rs, (l, s, side) => (s > 0.1 && s < 0.9 && Math.abs(side) < 0.5 ? (near && l > 0.5 ? "p" : "q") : fur(near ? l : l - 0.2))),
  );
}
/** The ears, relative to the head's top-left: [near, far], each root, bend and tip. */
export type EarName = "mid" | "up" | "flick" | "down" | "back" | "bent" | "flop";
const EARS: Record<EarName, readonly [readonly [Pt, Pt, Pt], readonly [Pt, Pt, Pt]]> = {
  mid: [[[5, 5], [3, -6], [-3, -10]], [[18, 5], [20, -6], [27, -9]]],
  up: [[[5, 5], [4, -6], [0, -12]], [[18, 5], [19, -6], [23, -12]]],
  flick: [[[5, 5], [2, -3], [-5, -4]], [[18, 5], [20, -6], [27, -9]]],
  down: [[[5, 5], [0, 1], [-6, 8]], [[18, 5], [22, -1], [27, 4]]],
  back: [[[5, 5], [1, -2], [-6, -2]], [[18, 5], [18, -3], [13, -4]]],
  bent: [[[5, 5], [4, -6], [-1, -11]], [[18, 5], [21, -3], [28, -3]]],
  flop: [[[6, 4], [-3, 1], [-13, 6]], [[18, 3], [10, -3], [1, 0]]],
};

/** The near arm: shoulder, elbow, paw (a lighter, cream paw). */
export type ArmName = "hold" | "up" | "waveL" | "waveM" | "waveR" | "chin" | "point" | "down" | "table" | "cheer";
const SH: Pt = [32, 44];
const ARMS: Record<ArmName, readonly [Pt, Pt]> = {
  hold: [[33, 46], [35, 48]],
  up: [[38, 45], [43, 38]],
  waveL: [[37, 44], [40, 36]],
  waveM: [[39, 44], [44, 35]],
  waveR: [[40, 44], [48, 37]],
  chin: [[36, 46], [38, 41]],
  point: [[38, 45], [45, 43]],
  down: [[34, 48], [35, 52]],
  table: [[37, 46], [43, 46]],
  cheer: [[38, 43], [41, 34]],
};
function armPart(pts: readonly Pt[]) {
  return painted(`arm:${key(pts)}`, () => stroke(pts, [2.3, 2.1, 2.7], (l, s) => (s > 0.78 ? cream(l - 0.2) : fur(l - 0.12))));
}

// ---- The body, haunch, feet, cotton tail, scarf, stool and shadow.

const BODY_STAND = painted("body:stand", () => {
  const cv = canvas(W, H);
  const lower = ell(26, 48, 11.5, 9);
  const upper = ell(29, 42, 8, 6);
  const inside = (x: number, y: number) => lower(x, y) || upper(x, y);
  const L = roundL(27, 46, 14, 13, 0.08);
  fill(cv, inside, (x, y) => fur(L(x, y)));
  const chest = ell(33.5, 48, 4.8, 7.5);
  fill(cv, (x, y) => inside(x, y) && chest(x, y), (x, y) => cream(0.62 - 0.05 * (x - 33) - 0.03 * (y - 48)));
  return crop(cv);
});
const BODY_SIT = painted("body:sit", () => {
  const cv = canvas(W, H);
  const lower = ell(26, 47, 11.5, 6.5);
  const upper = ell(29, 43, 8, 5.5);
  const inside = (x: number, y: number) => lower(x, y) || upper(x, y);
  const L = roundL(27, 45, 14, 10, 0.08);
  fill(cv, inside, (x, y) => fur(L(x, y)));
  const chest = ell(33.5, 47, 4.8, 5.5);
  fill(cv, (x, y) => inside(x, y) && chest(x, y), (x, y) => cream(0.62 - 0.05 * (x - 33) - 0.03 * (y - 47)));
  return crop(cv);
});
const BODY_LIE = painted("body:lie", () => {
  const cv = canvas(W, H);
  const body = ell(23, 54, 13.5, 5.8);
  const L = roundL(23, 52, 15, 8, 0.08);
  fill(cv, body, (x, y) => fur(L(x, y)));
  return crop(cv);
});

/** A rounded blob as a grid of its own (w x h), lit from the top left. */
function blob(w: number, h: number, color: (x: number, y: number, l: number) => string, rx = w / 2, ry = h / 2): Part {
  const cv = canvas(w, h);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const e = ell(cx, cy, rx, ry);
  const L = roundL(cx, cy, rx, ry, 0.1);
  fill(cv, e, (x, y) => color(x, y, L(x, y)));
  return { grid: toGrid(cv) };
}
PARTS["haunch"] = blob(15, 13, (_x, _y, l) => fur(l + 0.04));
PARTS["haunch:sit"] = blob(19, 10, (_x, _y, l) => fur(l + 0.04));
PARTS["foot:near"] = blob(16, 6, (x, y, l) => (x >= 12 ? (x === 14 && (y === 2 || y === 3) ? "C" : cream(l - 0.05)) : fur(l + 0.06)));
PARTS["foot:far"] = blob(13, 5, (x, _y, l) => (x >= 9 ? cream(l - 0.25) : fur(l - 0.18)));
PARTS["foot:dangle"] = (() => {
  const cv = canvas(6, 10);
  const e = ell(2.5, 4.5, 3, 5);
  const L = roundL(2.5, 4.5, 3, 5, 0.1);
  fill(cv, e, (x, y) => (y >= 6 ? cream(L(x, y) - 0.05) : fur(L(x, y) + 0.06)));
  return { grid: toGrid(cv) };
})();
PARTS["foot:dangleFar"] = (() => {
  const cv = canvas(5, 9);
  const e = ell(2, 4, 2.5, 4.6);
  const L = roundL(2, 4, 2.5, 4.6, 0.1);
  fill(cv, e, (x, y) => (y >= 5 ? cream(L(x, y) - 0.25) : fur(L(x, y) - 0.18)));
  return { grid: toGrid(cv) };
})();
PARTS["tail"] = blob(7, 7, (_x, _y, l) => cream(l + 0.1));

/** The scarf: a chunky band round the neck (under the head), a knot at the back, a gold clasp at the front. */
const BAND = painted("band", () => {
  const cv = canvas(W, H);
  const band = ell(30, 41.5, 10.5, 2.8);
  const knot = ell(21, 42, 2.6, 2.6);
  const L = roundL(30, 41.5, 11, 4, 0.1);
  const col = (l: number) => (l < 0.25 ? "S" : l < 0.5 ? "T" : l < 0.8 ? "U" : "V");
  fill(cv, (x, y) => band(x, y) || knot(x, y), (x, y) => col(L(x, y)));
  stamp(cv, ["yY", "YO"], 35, 42);
  return crop(cv);
});
/** The scarf's tail: hangs from the knot, rippling; turned, it streams back. */
PARTS["scarf"] = { grid: ["VUUTS", "VUUTS", "UUUTS", "UUUTS", "UUUTS", "VVVVT", "UUUTS", "UUTTS", "UUTTS", "UU.TS"] };

PARTS["stool"] = {
  grid: [
    "tttttttttttttttttttttt",
    "uuuuuuuuuuuuuuuuuuuuuu",
    "vvvvvvvvvvvvvvvvvvvvvv",
    "..uv..............uv..",
    "..uv..............uv..",
    "..uvvvvvvvvvvvvvvvvv..",
    "..uv..............uv..",
    "..uv..............uv..",
    "..uv..............uv..",
  ],
};
const shadowPart = (w: number): Part => {
  const cv = canvas(w, 3);
  const e = ell((w - 1) / 2, 1, w / 2, 1.6);
  fill(cv, e, () => "z");
  return { grid: toGrid(cv), outline: false };
};
PARTS["shadow"] = shadowPart(34);
PARTS["shadow:s"] = shadowPart(26);
PARTS["shadow:l"] = shadowPart(50);

// ---- The grasshopper, on its head: a tiny green body, a big black eye, a hind knee up, antennae.

PARTS["bug:rest"] = { grid: ["..mn.ddd.", ".bcccdwxx", "bbcccddxx", ".bbmmb.dd", "..m.m.m.."] };
PARTS["bug:hop"] = { grid: ["..mn.ddd.", ".bcccdwxx", "bbcccddxx", "mmbmmb.dd", "m..m..m.."] };
const ANTS: Record<string, readonly [readonly Pt[], readonly Pt[]]> = {
  "0": [[[0, 0], [-1, -1], [-1, -2], [-2, -3]], [[0, 0], [1, -1], [2, -2], [3, -2]]],
  "1": [[[0, 0], [0, -1], [-1, -2], [-1, -3]], [[0, 0], [1, -1], [2, -1], [3, -1]]],
  "2": [[[0, 0], [-1, -1], [-2, -1], [-3, -2]], [[0, 0], [1, -1], [1, -2], [2, -3]]],
  up: [[[0, 0], [0, -1], [0, -2], [0, -3], [0, -4]], [[0, 0], [1, -1], [1, -2], [1, -3], [1, -4]]],
  droop: [[[0, 0], [-1, -1], [-2, -1], [-3, 0], [-3, 1]], [[0, 0], [1, -1], [2, -1], [3, 0], [3, 1]]],
};
export type AntName = "0" | "1" | "2" | "up" | "droop";
function antennae(ax: number, ay: number, ant: AntName): Speck[] {
  const [a, b] = ANTS[ant]!;
  const out: Speck[] = [];
  a.forEach(([ox, oy], i) => out.push([ax + ox, ay + oy, i === a.length - 1 ? "o" : i < 2 ? "m" : "n"]));
  b.forEach(([ox, oy], i) => out.push([ax + 1 + ox, ay + oy, i === b.length - 1 ? "o" : i < 2 ? "m" : "n"]));
  return out;
}

// ---- Poses.

export interface Pose {
  mood?: Mood;
  /** 1: the nose twitched up a pixel. */
  nose?: 0 | 1;
  /** The upper body down this many pixels (a breath, a crouch). */
  bob?: number;
  /** The whole bunny up (a hop). */
  air?: number;
  dx?: number;
  /** The head on the neck. */
  hx?: number;
  hy?: number;
  ear?: EarName;
  /** The near arm. */
  arm?: ArmName;
  /** The cotton tail's shift. */
  tail?: number;
  /** The scarf's tail streams back (a hop) instead of hanging; its ripple phase. */
  flow?: boolean;
  sway?: number;
  ant?: AntName;
  /** The grasshopper hopping on the head: lifted this many pixels, legs out. */
  bugDy?: number;
  bugDx?: number;
  bugHop?: boolean;
  /** The feet's shift: sideways and down, apart from the bunny's lift. */
  fx?: number;
  fy?: number;
  /** The far foot lifted (a tap). */
  tap?: number;
  /** Sitting on the stool: the far and near feet's swing. */
  sit?: boolean;
  swing?: number;
  /** Flopped on its belly (defeat). */
  lie?: boolean;
  noShadow?: boolean;
}

interface Built {
  layers: Layer[];
  specks: Speck[];
}

function build(p: Pose): Built {
  const dx = p.dx ?? 0;
  const air = p.air ?? 0;
  const bob = p.bob ?? 0;
  const sit = p.sit ?? false;
  const lie = p.lie ?? false;
  const uy = (sit ? 3 : 0) + bob - air;
  const ux = (sit ? -1 : 0) + dx;
  const ly = Math.min(bob, 2) - air;
  const sway = p.sway ?? 0;
  const layers: Layer[] = [];
  const put = (part: string, x: number, y: number, extra: Partial<Layer> = {}) => layers.push({ part, x, y, ...extra });
  const add = (l: { name: string; at: Pt }, ox = 0, oy = 0, extra: Partial<Layer> = {}) => put(l.name, l.at[0] + ox, l.at[1] + oy, extra);
  if (!p.noShadow) {
    if (lie) put("shadow:l", 6 + dx, GROUND - 2);
    else if (air > 3) put("shadow:s", 15 + dx, GROUND - 2);
    else put("shadow", 12 + dx, GROUND - 2);
  }
  const fx = dx + (p.fx ?? 0);
  const fy = -air + (p.fy ?? 0);
  const tl = p.tail ?? 0;
  const scarfTail = (x: number, y: number) =>
    p.flow
      ? put("scarf", x - 5, y - 5, { rot: 1, wave: { along: "cols", amp: 2, len: 7, phase: sway, pin: "right" } })
      : put("scarf", x, y, { wave: { along: "rows", amp: 1, len: 7, phase: sway, pin: "top" } });

  // Head origin (its top-left) on the frame.
  let hx0 = HX0 + (p.hx ?? 0) + ux;
  let hy0 = HY0 + (p.hy ?? 0) + uy;

  if (lie) {
    hx0 = 32 + (p.hx ?? 0) + dx;
    hy0 = 40 + (p.hy ?? 0);
    put("tail", 8 + dx + tl, 50);
    put("foot:far", 5 + dx, 54, { flipX: true });
    add(BODY_LIE, 2 + dx, 1);
    put("foot:near", 3 + dx, 55, { flipX: true });
    add(BAND, 8 + dx, 12);
  } else if (sit) {
    put("stool", 10 + dx, 52);
    put("tail", 8 + dx + tl, 46);
    const sw = p.swing ?? 0;
    put("foot:dangleFar", 35 + dx + (sw > 0 ? 1 : 0), 51 + (sw > 0 ? -1 : 0));
    add(BODY_SIT, dx, 0);
    put("haunch:sit", 14 + dx, 44);
    put("foot:dangle", 31 + dx + (sw < 0 ? -1 : 0), 51 + (sw < 0 ? -1 : 0));
    add(BAND, ux, uy);
    scarfTail(16 + dx, 43 + (p.bob ?? 0) + 3 - 3);
  } else {
    put("tail", 9 + dx + tl, 48 + ly);
    put("foot:far", 29 + fx, 54 + fy - (p.tap ?? 0));
    add(BODY_STAND, dx, ly);
    put("haunch", 14 + dx, 44 + ly);
    put("foot:near", 21 + fx, 55 + fy);
    add(BAND, dx, uy);
    scarfTail(16 + dx, 43 + uy);
  }

  // Ears, head, the grasshopper's body and the near ear.
  const ears = EARS[p.ear ?? "mid"];
  const earPts = (set: readonly Pt[]): Pt[] => set.map(([x, y]) => [hx0 + x, hy0 + y]);
  const earF = earPart(earPts(ears[1]), false);
  add(earF);
  put(`head:${p.mood ?? "calm"}:${p.nose ?? 0}`, hx0, hy0);
  const earN = earPart(earPts(ears[0]), true);
  add(earN);
  const bx = hx0 + 8 + (p.bugDx ?? 0);
  const by = hy0 - 5 + (p.bugDy ?? 0);
  put(p.bugHop ? "bug:hop" : "bug:rest", bx, by);
  const specks = antennae(bx + 6, by - 2, p.ant ?? "0");

  // The near arm, in front.
  const armName = p.arm ?? "hold";
  const [elbow, paw] = ARMS[armName];
  const sh: Pt = lie ? [0, 0] : [SH[0] + ux, SH[1] + uy];
  if (!lie) {
    const o = (q: Pt): Pt => [q[0] + ux, q[1] + uy];
    add(armPart([sh, o(elbow), o(paw)]));
  }
  return { layers, specks };
}

// ---- Effects.

const star = (x: number, y: number, k = "y"): Speck[] => [[x, y, "w"], [x - 1, y, k], [x + 1, y, k], [x, y - 1, k], [x, y + 1, k]];
const heart = (x: number, y: number): Speck[] => [
  [x + 1, y, "R"], [x + 3, y, "R"],
  [x, y + 1, "R"], [x + 1, y + 1, "p"], [x + 2, y + 1, "R"], [x + 3, y + 1, "R"], [x + 4, y + 1, "R"],
  [x + 1, y + 2, "R"], [x + 2, y + 2, "R"], [x + 3, y + 2, "R"],
  [x + 2, y + 3, "R"],
];
const dust = (t: number): Speck[] =>
  [-1, 1].flatMap((side) => [0, 1, 2].map((i): Speck => [Math.round(29 + side * (9 + i * 3 + t * 2)), GROUND - 1 - (i % 2) - (t > 0 ? 1 : 0), t > 1 ? "h" : "g"]));
const dropShadow = (r: number): Speck[] => Array.from({ length: r * 2 + 1 }, (_, i): Speck => [29 - r + i, GROUND - 1, "z"]);
const thoughts = (n: number): Speck[] => {
  const out: Speck[] = [];
  // Three puffs rising from its head: a dot, a ball, and a little cloud with a gold spark in it.
  if (n >= 1) out.push([48, 24, "E"], [49, 24, "E"], [48, 25, "D"], [49, 25, "D"]);
  if (n >= 2) out.push([51, 19, "E"], [52, 19, "E"], [53, 19, "D"], [50, 20, "E"], [51, 20, "E"], [52, 20, "E"], [53, 20, "D"], [51, 21, "D"], [52, 21, "D"], [53, 21, "C"]);
  if (n >= 3) {
    const cloud = ["..EEE...", ".EEEEE..", "EEEEEEE.", "EEEEEDD.", ".DDDDD.."];
    cloud.forEach((row, j) => [...row].forEach((k, i) => k !== "." && out.push([53 + i, 8 + j, k])));
    out.push([57, 10, "Y"], [56, 10, "y"], [58, 10, "y"], [57, 9, "y"], [57, 11, "y"]);
  }
  return out;
};
const sweat = (i: number): Speck[] => {
  const t = i % 4;
  return [[17 - t, 22 + t, "j"], [17 - t, 23 + t, "w"], [47 + t, 20 + t, "j"], [47 + t, 21 + t, "w"]];
};
const tufts = (t: number): Speck[] =>
  ([[-1, -1.2], [1.2, -1.4], [1.6, -0.4], [-1.7, -0.3]] as const).flatMap(([vx, vy], i): Speck[] => {
    const px = Math.round(30 + vx * t * 2.4 + (vx > 0 ? 12 : 0));
    const py = Math.round(34 + vy * t * 2.4 + 0.5 * t * t);
    return [[px, py, i % 2 ? "H" : "I"], [px + 1, py, "D"]];
  });
const dizzy = (t: number): Speck[] => {
  const out: Speck[] = [];
  for (let i = 0; i < 3; i++) {
    const a = ((t * 0.9 + i * 2.1) % (Math.PI * 2));
    out.push(...star(Math.round(42 + Math.cos(a) * 9), Math.round(34 + Math.sin(a) * 2.5 - 8)));
  }
  return out;
};

const FLASH: Record<string, string> = { F: "#8d6f5d", G: "#b4917a", H: "#d6b596", I: "#efd6b6", C: "#efe3cc", D: "#fbf4e6", E: "#ffffff" };

function f(ms: number, p: Pose, extra: Partial<Frame> = {}): Frame {
  const b = build(p);
  const specks = [...b.specks, ...(extra.specks ?? [])].filter(([x, y]) => x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2);
  return { ms, layers: b.layers, ...extra, specks };
}

// ---- Animations.

/** Idle (3 s): breathes, blinks, twitches its nose, flicks an ear and its tail, glances ahead; the grasshopper waves its antennae and hops once. */
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 30 }, (_, i) => {
    const bob = i % 15 >= 8 ? 1 : 0;
    const blink = i === 11 || i === 12 || i === 27;
    const ear = i === 20 || i === 21 ? "flick" : "mid";
    const nose = (i >= 4 && i <= 7 && i % 2 === 1) || i === 18 || i === 19 ? 1 : 0;
    const tail = i >= 4 && i <= 7 ? (i % 2 ? 1 : 0) : 0;
    const hx = i >= 24 ? 1 : 0;
    const ant = (["0", "0", "1", "1", "2", "2", "1", "1"] as const)[i % 8]!;
    const hopping = i === 15 || i === 16;
    return f(100, { bob, mood: blink ? "blink" : "calm", ear, nose, tail, hx, ant, sway: i * 0.45, bugDy: i === 15 ? -2 : i === 16 ? -1 : 0, bugHop: hopping });
  }),
};

/** Walk (0.6 s): two soft hops, ears bouncing, the scarf flicking behind, the grasshopper bouncing on its head. */
const HOP: readonly Pose[] = [
  { bob: 2, mood: "calm", ear: "down", fx: 0, fy: 0, ant: "1" },
  { air: 2, mood: "happy", ear: "back", fx: -2, fy: 2, flow: true, bugDy: 1, ant: "2" },
  { air: 5, mood: "happy", ear: "back", fx: -3, fy: 1, flow: true, bugDy: 0, bugHop: true, ant: "up" },
  { air: 2, mood: "calm", ear: "mid", fx: 2, fy: 2, flow: true, bugDy: -1, ant: "0" },
];
const walk: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => {
    const h = HOP[i % 4]!;
    return f(75, { ...h, sway: i * 1.1, arm: "hold", tail: i % 4 === 2 ? 1 : 0, nose: i % 2 }, i % 4 === 0 ? { cue: "step" } : {});
  }),
};

/** Sit (loops): on a stool at the chess table, facing the board, feet dangling, paws on the table's edge; a slow blink, a thoughtful lean. */
const SIT: Pose = { sit: true, arm: "table" };
const sit: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) => {
    const lean = i >= 6 && i <= 11;
    const blink = i === 3 || i === 4 || i === 13;
    const swing = i % 8 < 2 ? 1 : i % 8 >= 4 && i % 8 < 6 ? -1 : 0;
    return f(200, { ...SIT, mood: blink ? (lean ? "thinkBlink" : "blink") : lean ? "think" : i >= 14 ? "sleepy" : "calm", bob: i % 8 >= 4 ? 1 : 0, hx: lean ? 2 : 0, hy: lean ? 1 : 0, ear: i === 9 ? "flick" : "mid", swing, ant: (["0", "1", "2", "1"] as const)[i % 4]!, nose: i === 8 ? 1 : 0, tail: swing > 0 ? 1 : 0, sway: i * 0.5 });
  }),
};

/** Wave (once, 1.2 s): a paw up and waving hello, the grasshopper hopping, a little heart; then it settles back to its idle pose. */
const WAVES: readonly ArmName[] = ["waveL", "waveM", "waveR", "waveM", "waveL", "waveM", "waveR", "waveM"];
const wave: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 1, mood: "happy", arm: "hold" }),
    f(100, { mood: "cheer", arm: "up", ear: "up", hy: -1, ant: "up" }, { cue: "squeak" }),
    ...WAVES.map((arm, i) =>
      f(100, { mood: i % 2 ? "cheer" : "happy", arm, ear: i % 4 === 1 ? "up" : "mid", hx: arm === "waveL" ? -1 : arm === "waveR" ? 1 : 0, hy: i % 2 ? 0 : -1, bob: i % 2 ? 1 : 0, tail: i % 2, bugDy: [-1, -3, -5, -3, -1, 0, 0, 0][i]!, bugHop: i >= 0 && i <= 4, ant: (["0", "2", "up", "2", "1", "0", "1", "0"] as const)[i]!, sway: i * 0.8 }, { specks: i === 2 ? heart(47, 24) : i === 3 ? heart(49, 20) : i === 4 ? star(52, 22) : [] }),
    ),
    f(100, { mood: "happy", arm: "hold", ant: "1" }),
    f(100, { mood: "calm", arm: "hold" }),
  ],
};

/** Entrance: drops in on its shadow, lands with a squash and a puff of dust, then waves hello. */
const entrance: Anim = {
  loop: false,
  frames: [
    { ms: 90, layers: [], specks: dropShadow(4) },
    { ms: 80, layers: [], specks: dropShadow(8) },
    f(70, { air: 5, mood: "cheer", ear: "back", fx: -1, fy: 2, flow: true, ant: "up", bugDy: 1 }),
    f(70, { air: 2, mood: "cheer", ear: "back", fx: 1, fy: 2, flow: true, ant: "2", bugDy: -1 }),
    f(100, { bob: 3, mood: "blink", ear: "down", ant: "droop" }, { cue: "step", specks: dust(0) }),
    f(90, { bob: 1, mood: "happy", ear: "mid", ant: "1" }, { specks: dust(1) }),
    f(110, { mood: "cheer", arm: "up", ear: "up", hy: -1, ant: "up", bugHop: true, bugDy: -2 }, { cue: "squeak", specks: [...dust(2), ...star(50, 26)] }),
    f(110, { mood: "happy", arm: "waveL", hx: -1, ant: "0", bugDy: -1 }),
    f(110, { mood: "happy", arm: "waveR", hx: 1, ant: "2" }, { specks: heart(48, 22) }),
    f(120, { mood: "happy", arm: "hold", ant: "1" }),
    f(300, { mood: "calm", arm: "hold" }),
  ],
};

/** Thinking (loops): head tipped up, eyes rolled up, a paw to its chin, a foot tapping, thought dots popping up. */
const thinking: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) =>
    f(150, { mood: i === 8 ? "thinkBlink" : "think", arm: "chin", hx: 2, hy: -1, bob: i % 6 >= 3 ? 1 : 0, tap: i % 4 === 1 ? 1 : 0, ear: i === 5 ? "flick" : "bent", ant: (["0", "1", "2", "1"] as const)[i % 4]!, sway: i * 0.6, nose: i % 5 === 2 ? 1 : 0 }, { specks: thoughts(i % 6 < 1 ? 0 : i % 6 < 3 ? 1 : i % 6 < 5 ? 2 : 3) }),
  ),
};

/** Its move: a hop toward the board, a paw out. */
const move: Anim = {
  loop: false,
  frames: [
    f(90, { bob: 2, mood: "bold", ear: "down", ant: "1" }),
    f(80, { air: 3, dx: 1, mood: "bold", arm: "point", ear: "back", fx: -2, fy: 2, flow: true, bugDy: 1, ant: "2" }, { cue: "step" }),
    f(80, { air: 5, dx: 2, mood: "bold", arm: "point", ear: "back", fx: -3, fy: 1, flow: true, bugHop: true, ant: "up" }),
    f(100, { bob: 2, dx: 2, mood: "happy", arm: "point", ear: "down", ant: "droop" }, { specks: dust(0) }),
    f(100, { bob: 1, dx: 2, mood: "happy", arm: "point", ant: "1" }),
    f(110, { dx: 1, mood: "happy", arm: "hold", ant: "0" }),
    f(150, { mood: "calm", arm: "hold" }),
  ],
};

/** A capture: two excited hops, paws up, hearts and sparkles. */
const capture: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 2, mood: "bold", ear: "down", ant: "1" }),
    f(80, { air: 3, mood: "cheer", arm: "cheer", ear: "up", fx: -2, fy: 2, flow: true, bugDy: 1, ant: "up" }, { cue: "squeak", specks: star(52, 24) }),
    f(80, { air: 5, mood: "happy", arm: "waveL", ear: "back", fx: -3, fy: 1, flow: true, bugHop: true, hy: -1, ant: "2" }, { specks: heart(48, 18) }),
    f(80, { air: 3, mood: "happy", arm: "waveR", ear: "back", fx: 1, fy: 2, flow: true, ant: "0" }, { specks: star(55, 26) }),
    f(80, { bob: 2, mood: "cheer", arm: "cheer", ear: "down", ant: "droop" }, { specks: dust(0) }),
    f(80, { air: 3, mood: "happy", arm: "waveM", ear: "up", fx: -2, fy: 2, flow: true, ant: "up", bugDy: 1 }, { specks: heart(50, 16) }),
    f(80, { air: 5, mood: "happy", arm: "waveR", ear: "back", fx: -3, fy: 1, flow: true, bugHop: true, hy: -1, ant: "2" }, { specks: star(54, 20) }),
    f(80, { air: 2, mood: "happy", arm: "waveL", ear: "mid", fx: 2, fy: 2, flow: true, ant: "0" }),
    f(90, { bob: 2, mood: "cheer", arm: "cheer", ear: "down", ant: "droop" }, { specks: dust(1) }),
    f(120, { bob: 1, mood: "happy", arm: "up", ant: "1" }),
    f(160, { mood: "smug", arm: "hold" }),
  ],
};

/** Hurt: hit, a flash, fur flies, eyes squeezed shut, the grasshopper jumps in fright; then it shakes it off. */
const hurt: Anim = {
  loop: false,
  frames: [
    f(70, { bob: 2, mood: "hurt", arm: "down", ear: "down", ant: "up" }, { cue: "poof", pal: FLASH, shake: [1, 0], specks: tufts(0) }),
    f(80, { bob: 3, mood: "hurt", arm: "down", ear: "down", ant: "droop", bugDy: -3, bugHop: true }, { shake: [-1, 0], specks: tufts(1) }),
    f(90, { bob: 2, dx: -1, mood: "hurt", arm: "down", ear: "down", ant: "up", bugDy: -4, bugHop: true }, { specks: tufts(2) }),
    f(100, { bob: 1, dx: -1, mood: "rattled", arm: "hold", ear: "down", ant: "2", bugDy: -1 }),
    f(110, { mood: "blink", arm: "hold", ear: "mid", ant: "1" }),
    f(120, { mood: "bold", arm: "hold", ear: "up", ant: "up" }),
    f(160, { mood: "calm", arm: "hold" }),
  ],
};

/** Check: two sharp points at the board, eyes bright, the grasshopper's antennae straight up. */
const JAB: Pose = { bob: 2, dx: 1, mood: "bold", arm: "point", ear: "up", ant: "up" };
const check: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 1, mood: "bold", arm: "up", ear: "up", ant: "1" }),
    f(110, JAB, { cue: "squeak" }),
    f(90, { bob: 1, mood: "bold", arm: "up", ear: "up", ant: "2" }),
    f(110, JAB, { cue: "squeak" }),
    f(90, { bob: 1, dx: 1, mood: "bold", arm: "point", ear: "mid", ant: "1" }),
    f(150, { dx: 1, mood: "happy", arm: "point", ant: "0" }),
    f(160, { mood: "smug", arm: "hold" }),
  ],
};

/** Smug: chin up, eyes half shut, a little smirk, a slow nod, ears back; the grasshopper strikes a pose. */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(150, { mood: "smug", arm: "hold", hy: i < 3 || i > 5 ? -1 : 0, hx: i < 4 ? 0 : 1, bob: i % 4 === 2 ? 1 : 0, ear: i === 5 ? "up" : "back", ant: (["0", "0", "1", "1", "0", "0", "2", "2"] as const)[i]!, sway: i * 0.7 })),
};

/** Rattled: wide eyes, worried brows, sweat flying, trembling where it stands, the grasshopper's antennae quivering. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(80, { mood: "rattled", arm: "hold", dx: i % 2 ? 1 : -1, bob: i % 4 === 2 ? 1 : 0, ear: "down", tail: i % 2, ant: i % 2 ? "up" : "2", bugDy: i % 4 === 1 ? -1 : 0, sway: i * 1.7 }, { specks: sweat(i) })),
};

/**
 * Defeat: hit, a flash, dizzy eyes, and it keels over onto its back (the standing bunny turned a quarter, its head to our
 * left, feet in the air), the grasshopper's antennae drooping, stars circling (the last frame holds).
 */
const flat = (ms: number, p: Pose, extra: Partial<Frame> = {}): Frame => {
  const b = build({ ...p, noShadow: true });
  const r = lieDown(PARTS, { layers: b.layers, specks: b.specks }, 36, 37, "left");
  const specks = [...r.specks, ...(extra.specks ?? [])].filter(([x, y]) => x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2);
  return { ms, ...extra, layers: [{ part: "shadow:l", x: 7, y: GROUND - 2 }, ...r.layers], specks };
};
const FLOP: Pose = { lie: true, mood: "out", ear: "flop", ant: "droop" };
const SLUMP: Pose = { bob: 4, hx: 2, hy: 3, mood: "out", ear: "down", arm: "hold", ant: "droop" };
const defeat: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 2, mood: "hurt", arm: "hold", ear: "down", ant: "up" }, { cue: "poof", pal: FLASH, shake: [1, 0], specks: tufts(0) }),
    f(90, { bob: 2, dx: -1, mood: "out", arm: "hold", ear: "down", ant: "droop", bugDy: -2, bugHop: true }, { specks: dizzy(0) }),
    f(110, { bob: 3, dx: 1, hx: 1, hy: 1, mood: "out", arm: "hold", ear: "down", ant: "droop" }, { specks: dizzy(1.5) }),
    f(130, { ...SLUMP, dx: -1 }, { specks: dizzy(3) }),
    f(140, SLUMP, { specks: dizzy(4.5) }),
    f(120, { ...FLOP }, { cue: "poof", shake: [1, 0], specks: dust(0) }),
    f(160, { ...FLOP, tail: 1 }, { specks: dizzy(4.5) }),
    f(200, { ...FLOP }, { specks: dizzy(6) }),
    f(1000, { ...FLOP, tail: 1 }, { specks: dizzy(2) }),
  ],
};

/** Victory: jumping for joy, a paw high, the grasshopper bouncing on its head, hearts and sparkles. Then again. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const air = [0, 2, 4, 5, 4, 2, 0, 0, 2, 4, 2, 0][i]!;
    const arms: ArmName[] = ["cheer", "waveL", "waveM", "waveR", "waveM", "waveL", "cheer", "cheer", "waveR", "waveM", "waveL", "cheer"];
    return f(110, { bob: i === 0 || i === 6 || i === 7 ? 2 : 0, air, mood: air > 2 ? "happy" : "cheer", arm: arms[i]!, ear: air > 3 ? "back" : air > 0 ? "up" : "mid", fx: air > 0 ? -2 : 0, fy: air > 0 ? 2 : 0, flow: air > 0, hy: i % 2 ? -1 : 0, tail: i % 2, ant: (["up", "2", "0", "2", "up", "1"] as const)[i % 6]!, bugHop: air > 2, bugDy: air > 3 ? -1 : 0, sway: i * 1.3 }, { cue: i === 2 ? "squeak" : undefined, specks: [...(i % 4 === 0 ? heart(46 + (i % 3) * 3, 14 + (i % 2) * 4) : []), ...(i % 3 === 1 ? star(8 + (i % 4) * 4, 22 + (i % 3) * 5) : [])] });
  }),
};

export const sidekickChubchirp: Character = {
  id: "sidekick-chubchirp",
  name: "Chub & Chirp's sidekick",
  w: W,
  h: H,
  foot: [29, GROUND],
  palette: SIDEKICK_PALETTE,
  halo: "#2a2a20",
  parts: PARTS,
  anims: { idle, walk, sit, wave, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory },
};
