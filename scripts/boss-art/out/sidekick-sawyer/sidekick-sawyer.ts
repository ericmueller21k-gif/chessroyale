/**
 * Sawyer's sidekick (id "sidekick-sawyer"): a little raccoon kit, a town bot that scampers round the square and plays
 * chess at the park's tables. No powers, never fights: a friendly, curious kid who copies the big one. Its link to
 * Sawyer: a yellow hard hat far too big for it (it slips down over its eyes now and then) and a little wooden toy saw.
 *
 * Softer and rounder than Sawyer: a big round head with a soft black bandit mask round big shiny eyes, a small
 * friendly smile (no teeth), a round body, little white gloves, a fluffy ringed tail. Three-quarters, facing our right,
 * light from the top left.
 *
 * Rigging: the head (one per face), the hat (one per tilt), the ears, the body are painted once; the legs, the tail, the
 * saw arm and the saw are painted from points per pose, so a new pose is a handful of numbers.
 */
import { canvas, ellipse, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../../../packages/app/src/characters/sprite.ts";

export const SIDEKICK_SAWYER_PALETTE = {
  k: "#1c1413", // outline
  a: "#44322e", // fur, dark to light (Sawyer's warm gray-brown)
  b: "#5f4843",
  c: "#7e635e",
  d: "#a08883",
  h: "#bfaaa3",
  e: "#c0aea5", // cream: cheeks, muzzle, belly
  f: "#e3d5cb",
  g: "#f8f1ea",
  m: "#140e0e", // the mask, and its soft edge
  M: "#2e211f",
  w: "#ffffff", // eye shine
  s: "#1a0f0d", // pupil
  n: "#8c5127", // iris
  t: "#d49a55", // iris, lit lower rim
  N: "#0b0707", // nose
  q: "#f28f80", // blush, ear inside, tongue
  u: "#6b1f24", // inside the mouth
  Y: "#f6c21c", // Sawyer's hard hat: yellow, light, highlight, shadow, deep shadow
  y: "#ffe05a",
  L: "#fff3ad",
  O: "#d39a0b",
  P: "#946404",
  j: "#fbf9f5", // gloves: white, shade, lines
  J: "#d4cec6",
  i: "#9c948c",
  R: "#e1262c", // the toy saw's red handle
  r: "#9c141a",
  Q: "#ff6b57",
  W: "#f0d9a0", // its wooden blade: light, mid, dark, ferrule
  U: "#d9b374",
  V: "#a97b43",
  v: "#6e4a24",
  x: "#ffffff", // twinkles
  S: "#b8b0b8", // dust, smoke
  T: "#7d7580",
  l: "#7fd3ff", // sweat
  A: "#9fe8ff", // pastel confetti
  B: "#ff9bd6",
  C: "#c98f4e", // stool wood, light to dark
  D: "#a06a33",
  E: "#6c4222",
  z: "#0d0e12", // ground shadow
} as const;

type Pt = readonly [number, number];

/** The frame, and the ground (the first row below the paws). */
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
/** Fur by a light value (0 dark to 1 light): banded, never blended. */
const tone = (l: number) => (l < 0.2 ? "b" : l < 0.48 ? "c" : l < 0.78 ? "d" : "h");
/** Cream by a light value. */
const cream = (l: number) => (l < 0.42 ? "e" : l < 0.72 ? "f" : "g");
/** Light from the top left on a round surface. */
const roundL = (cx: number, cy: number, rx: number, ry: number, bias = 0) => (x: number, y: number) => 0.52 + bias - 0.45 * ((x - cx) / rx) - 0.55 * ((y - cy) / ry);
function fill(cv: Canvas, inside: (x: number, y: number) => boolean, light: (x: number, y: number) => number, ramp: (l: number) => string = tone): void {
  for (let y = 0; y < cv.length; y++) for (let x = 0; x < cv[0]!.length; x++) if (inside(x, y)) cv[y]![x] = ramp(light(x, y));
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

// ---- Faces. A big round head: soft black mask round two big shiny eyes, a little smile.

export type Mood = "calm" | "blink" | "happy" | "cheer" | "think" | "thinkBlink" | "smug" | "rattled" | "hurt" | "out" | "bold";
type Eye = "open" | "up" | "wide" | "half" | "arc" | "shut" | "pinch" | "x";
type Brow = "up" | "worried" | "bold" | "smug";
type Mouth = "smile" | "grin" | "flat" | "smirk" | "wavy" | "o" | "tongue" | "gasp";

/** The near eye (6 x 6, on our left) and the far one (5 x 5), by look: a pale ring, a dark pupil, a white shine. */
const NEAR_EYE: Record<Eye, readonly string[]> = {
  open: [".nnnn.", "nwwssn", "nwsssn", "nssssn", "nssswn", ".tttt."],
  up: [".nnnn.", "nsswwn", "nsswsn", "nssssn", "nttttn", ".nnnn."],
  wide: [".ffff.", "ffffff", "fwsfff", "fsssff", "ffffff", ".ffff."],
  half: ["......", "......", "ffffff", "nwsssn", ".tttt.", "......"],
  arc: ["......", ".ffff.", "f....f", "......", "......", "......"],
  shut: ["......", "......", "......", "ffffff", "......", "......"],
  pinch: ["ff....", ".fff..", "...fff", ".fff..", "ff....", "......"],
  x: ["......", "f...f.", ".f.f..", "..f...", ".f.f..", "f...f."],
};
const FAR_EYE: Record<Eye, readonly string[]> = {
  open: [".nnn.", "nwssn", "nsssn", "nsswn", ".ttt."],
  up: [".nnn.", "nsswn", "nsssn", "nttsn", ".nnn."],
  wide: [".fff.", "fffff", "fwsff", "fssff", ".fff."],
  half: [".....", ".....", "fffff", "nwssn", ".ttt."],
  arc: [".....", ".fff.", "f...f", ".....", "....."],
  shut: [".....", ".....", ".....", "fffff", "....."],
  pinch: [".....", "...ff", "..ff.", ".ff..", "..ff."],
  x: [".....", ".f.f.", "..f..", ".f.f.", "....."],
};
/** Brows (little pale marks on the mask): [near, far] pixel lists on the head grid. */
const BROWS: Record<Brow, readonly [readonly Pt[], readonly Pt[]]> = {
  up: [[[6, 6], [7, 6], [8, 6], [9, 6]], [[17, 6], [18, 6], [19, 6]]],
  worried: [[[5, 7], [6, 7], [7, 6], [8, 6], [9, 5]], [[17, 5], [18, 6], [19, 6], [20, 7]]],
  bold: [[[5, 6], [6, 6], [7, 7], [8, 7], [9, 7]], [[17, 7], [18, 7], [19, 6], [20, 6]]],
  smug: [[[5, 6], [6, 6], [7, 6]], [[18, 5], [19, 5], [20, 6]]],
};
const MOUTHS: Record<Mouth, { rows: readonly string[]; at: Pt }> = {
  smile: { rows: ["k...k", ".kkk."], at: [20, 16] },
  grin: { rows: ["kkkkk", "kuuuk", ".kqk."], at: [20, 15] },
  flat: { rows: ["kkkk"], at: [21, 17] },
  smirk: { rows: ["...kk", "kkkk."], at: [20, 16] },
  wavy: { rows: ["k.k.k", ".k.k."], at: [20, 16] },
  o: { rows: [".kk.", "kuuk", ".kk."], at: [21, 15] },
  tongue: { rows: ["kkkkk", "kuqqk", "..kqk", "...k."], at: [20, 15] },
  gasp: { rows: ["kkkk", "kuuk", "kuuk", "kkkk"], at: [21, 15] },
};
const FACES: Record<Mood, { near: Eye; far: Eye; brow?: Brow; mouth: Mouth; blush?: boolean }> = {
  calm: { near: "open", far: "open", mouth: "smile", blush: true },
  blink: { near: "shut", far: "shut", mouth: "smile", blush: true },
  happy: { near: "arc", far: "arc", mouth: "grin", blush: true },
  cheer: { near: "open", far: "open", brow: "up", mouth: "grin", blush: true },
  think: { near: "up", far: "up", brow: "up", mouth: "flat" },
  thinkBlink: { near: "shut", far: "shut", brow: "up", mouth: "flat" },
  smug: { near: "half", far: "half", brow: "smug", mouth: "smirk", blush: true },
  rattled: { near: "wide", far: "wide", brow: "worried", mouth: "wavy" },
  hurt: { near: "pinch", far: "pinch", brow: "worried", mouth: "o" },
  out: { near: "x", far: "x", mouth: "tongue" },
  bold: { near: "open", far: "open", brow: "bold", mouth: "grin", blush: true },
};

const HW = 29;
const HH = 21;
/** Where the head grid sits at rest (its top-left), on the frame. */
const HX0 = 15;
const HY0 = 22;

function head(mood: Mood): Part {
  const cv = canvas(HW, HH);
  const skull = ell(13.5, 10.8, 12, 9.4);
  const snout = ell(22.5, 14.8, 5.4, 3.9);
  const inside = (x: number, y: number) => skull(x, y) || snout(x, y);
  const L = roundL(14, 11, 14, 11, 0.1);
  fill(cv, inside, L);
  // The pale lower face: cheeks and muzzle.
  const lower = ell(16, 17.2, 11.6, 4.3);
  fill(cv, (x, y) => inside(x, y) && (lower(x, y) || snout(x, y)), (x, y) => L(x, y) + 0.1, cream);
  // Cheek tufts, pointing out and down.
  dots(cv, [[1, 15], [1, 16], [2, 17], [0, 16]], "e");
  dots(cv, [[1, 14]], "f");
  // The bandit mask: a soft black patch round each eye, joined over the bridge of the nose, sweeping back on the cheek.
  const near = ell(7.8, 10.8, 5.9, 5.0);
  const far = ell(19.2, 10.4, 4.7, 4.6);
  const sweep = ell(4.6, 13.8, 2.8, 2.1);
  const bridge = (x: number, y: number) => x >= 11 && x <= 15 && y >= 8 && y <= 11;
  const mask = (x: number, y: number) => inside(x, y) && (near(x, y) || far(x, y) || sweep(x, y) || bridge(x, y));
  const edgeOf = (x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inside(x + dx!, y + dy!) && !mask(x + dx!, y + dy!));
  for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) if (mask(x, y)) cv[y]![x] = edgeOf(x, y) ? "M" : "m";
  // A dark stripe up the forehead (mostly under the hat).
  for (let y = 2; y <= 7; y++) {
    cv[y]![12] = "b";
    cv[y]![13] = "b";
  }
  const face = FACES[mood];
  stamp(cv, NEAR_EYE[face.near], 5, 8);
  stamp(cv, FAR_EYE[face.far], 17, 8);
  if (face.brow) for (const side of BROWS[face.brow]) dots(cv, side, "f");
  if (face.blush) dots(cv, [[5, 15], [6, 15], [7, 15]], "q");
  stamp(cv, [".NN", "NNN"], 25, 12);
  dots(cv, [[25, 12]], "d");
  const mouth = MOUTHS[face.mouth];
  stamp(cv, mouth.rows, mouth.at[0], mouth.at[1]);
  return { grid: toGrid(cv) };
}
const MOODS: readonly Mood[] = ["calm", "blink", "happy", "cheer", "think", "thinkBlink", "smug", "rattled", "hurt", "out", "bold"];
for (const m of MOODS) PARTS[`head:${m}`] = head(m);

/** The near ear, out to our left under the hat's brim (a 10 x 10 canvas, placed at the head's (-4, 1)): three ways. */
function ear(kind: "mid" | "up" | "down"): Part {
  const cv = canvas(10, 10);
  const [cx, cy, rx, ry] = kind === "mid" ? [4.5, 4.5, 3.8, 4] : kind === "up" ? [4.5, 3.4, 3.4, 4.2] : [4.2, 5.6, 4.1, 3.2];
  fill(cv, ell(cx, cy, rx, ry), roundL(cx, cy, rx, ry, 0.05));
  const inner = ell(cx + 0.5, cy + 0.9, rx * 0.5, ry * 0.5);
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) if (inner(x, y) && cv[y]![x] !== ".") cv[y]![x] = "q";
  return { grid: toGrid(cv) };
}
for (const k of ["mid", "up", "down"] as const) PARTS[`ear:${k}`] = ear(k);

/**
 * The hard hat, Sawyer's yellow, much too big: a tall dome with a ridge, a wide brim. Painted on a 31 x 19 canvas whose
 * row 4 is the dome's top; `tilt` slants it (-2 pushed back, brim front up; +2 slipping forward, brim front down).
 */
const HAT_W = 31;
const HAT_H = 19;
const HAT_TOP = 4;
function hat(tilt: number): Part {
  const raw = canvas(HAT_W, HAT_H);
  const oy = HAT_TOP;
  const dome = (x: number, y: number) => ell(14.8, oy + 8.6, 12.6, 8.4)(x, y) && y <= oy + 8;
  const l = roundL(10, oy + 3, 14, 9, 0.1);
  fill(raw, dome, l, (v) => (v < 0.28 ? "O" : v < 0.58 ? "Y" : v < 0.84 ? "y" : "L"));
  // The ridge down the dome, and a faint seam either side.
  for (let y = oy + 1; y <= oy + 8; y++) {
    if (raw[y]![16] !== ".") {
      raw[y]![16] = "L";
      if (raw[y]![17] !== ".") raw[y]![17] = "O";
    }
    for (const x of [9, 23]) if (raw[y]![x] !== ".") raw[y]![x] = "O";
  }
  // The brim: wide, lit along its top, its underside in shadow.
  const brim = ell(15.2, oy + 9.4, 15.2, 2.1);
  for (let y = 0; y < HAT_H; y++)
    for (let x = 0; x < HAT_W; x++)
      if (brim(x, y)) raw[y]![x] = y <= oy + 8 ? "y" : y === oy + 9 ? "Y" : y === oy + 10 ? "O" : "P";
  // Slant it: each column slides by whole pixels along the brim.
  const cv = canvas(HAT_W, HAT_H);
  for (let x = 0; x < HAT_W; x++) {
    const sh = Math.round((tilt * 1.5 * (x - 15)) / 15);
    for (let y = 0; y < HAT_H; y++) if (raw[y]![x] !== "." && cv[y + sh]?.[x] !== undefined) cv[y + sh]![x] = raw[y]![x]!;
  }
  return { grid: toGrid(cv) };
}
const TILTS = [-2, -1, 0, 1, 2] as const;
for (const t of TILTS) PARTS[`hat:${t}`] = hat(t);

PARTS["shadow"] = (() => {
  const cv = canvas(30, 3);
  ellipse(cv, 15, 1.5, 15, 1.5, "z");
  return { grid: toGrid(cv), outline: false };
})();

PARTS["paw"] = { grid: ["..ccbb...", ".bcccbbb.", "bbbbbbbbb"] };
PARTS["stool"] = {
  grid: [
    "CCCCCCCCCCCCCCCCCCCCCC",
    "DDDDDDDDDDDDDDDDDDDDDD",
    "EEEEEEEEEEEEEEEEEEEEEE",
    "..DE..............DE..",
    "..DE..............DE..",
    "..DE..............DE..",
    "..DEEEEEEEEEEEEEEEDE..",
    "..DE..............DE..",
    "..DE..............DE..",
    "..DE..............DE..",
  ],
};

// ---- The body: a round body with a cream belly.

const BODY = { cx: 27.5, cy: 46.5, rx: 7.8, ry: 5.6 };
function bodyPart(): Painted {
  const cv = canvas(W, H);
  const body = ell(BODY.cx, BODY.cy, BODY.rx, BODY.ry);
  const bl = roundL(BODY.cx, BODY.cy, BODY.rx, BODY.ry, 0.02);
  fill(cv, body, bl);
  const belly = ell(30, 48.2, 4.9, 3.9);
  fill(cv, (x, y) => body(x, y) && belly(x, y), (x, y) => bl(x, y) + 0.1, cream);
  return crop(cv);
}
const BODY_PART = painted("body", bodyPart);

// ---- Limbs, the tail and the toy saw: painted from points.

function near(p: Pt, a: Pt, b: Pt): { d: number; nx: number; ny: number; t: number } {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy || 1)));
  const nx = p[0] - (a[0] + t * vx);
  const ny = p[1] - (a[1] + t * vy);
  return { d: Math.hypot(nx, ny), nx, ny, t };
}
function nearest(p: Pt, pts: readonly Pt[]): { d: number; nx: number; ny: number; s: number } {
  let best = { d: Infinity, nx: 0, ny: 0, s: 0 };
  let run = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const n = near(p, pts[i]!, pts[i + 1]!);
    const len = Math.hypot(pts[i + 1]![0] - pts[i]![0], pts[i + 1]![1] - pts[i]![1]);
    if (n.d < best.d) best = { d: n.d, nx: n.nx, ny: n.ny, s: run + n.t * len };
    run += len;
  }
  return best;
}

interface StrokeOpts {
  r: number;
  far?: boolean;
  /** A white glove this big at the end. */
  glove?: number;
}
function stroke(pts: readonly Pt[], o: StrokeOpts): Painted {
  const cv = canvas(W, H);
  const end = pts[pts.length - 1]!;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const de = o.glove ? Math.hypot(x - end[0], y - end[1]) : 99;
      if (de <= o.glove!) {
        const l = 0.55 - 0.2 * (x - end[0]) - 0.25 * (y - end[1]);
        cv[y]![x] = l > 0.4 ? "j" : l > 0.05 ? "J" : "i";
        continue;
      }
      const n = nearest([x, y], pts);
      if (n.d > o.r) continue;
      const u = n.nx / o.r;
      let k = u < -0.1 ? "d" : u < 0.6 ? "c" : "b";
      if (o.far) k = k === "d" ? "c" : k === "c" ? "b" : "a";
      cv[y]![x] = k;
    }
  return crop(cv);
}

/** The tail: a fat, fluffy ringed crescent behind it, dark at the tip. `style` "up" curls up behind, "down" hangs and curls. */
function tailPart(swish: number, style: "up" | "down" | "ground"): Painted {
  const p0: Pt = style === "up" ? [22, 50] : style === "down" ? [22, 49] : [22, 52];
  const p1: Pt = style === "up" ? [7 + swish, 51] : style === "down" ? [5 + swish, 62] : [12 + swish, 58];
  const p2: Pt = style === "up" ? [9 + swish * 2, 33] : style === "down" ? [6 + swish, 51] : [11 + swish, 52];
  const spine: Pt[] = Array.from({ length: 21 }, (_, i) => {
    const t = i / 20;
    return [(1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]];
  });
  const total = spine.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - spine[i]![0], q[1] - spine[i]![1]), 0);
  const cv = canvas(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const n = nearest([x, y], spine);
      const t = n.s / total;
      const r = 2.7 + 1.7 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)) - (t > 0.9 ? (t - 0.9) * 14 : 0);
      if (n.d > r) continue;
      const along = total - n.s + (n.d / r) ** 2 * 1.6;
      const dark = Math.floor(along / 3.7) % 2 === 0;
      const l = 0.55 - 0.45 * (n.nx / r) - 0.5 * (n.ny / r);
      cv[y]![x] = dark ? (l < 0.5 ? "a" : "b") : tone(l * 0.9 + 0.1);
    }
  return crop(cv);
}

/** The toy saw: a red grip under the glove, a dark ferrule, a wooden blade with a row of big teeth along one edge. */
function sawPart(fist: Pt, dir: Pt, len: number): Painted & { name: string } {
  return painted(`saw:${fist}:${dir}:${len}`, () => {
    const cv = canvas(W, H);
    const n = Math.hypot(dir[0], dir[1]);
    const dx = dir[0] / n;
    const dy = dir[1] / n;
    const nx = -dy;
    const ny = dx;
    const end = 5.6 + len;
    const bladeS = new Map<number, number>();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const rx = x - fist[0];
        const ry = y - fist[1];
        const s = rx * dx + ry * dy;
        const t = rx * nx + ry * ny;
        if (s >= -2.8 && s <= 5.6 && Math.abs(t) <= 2.0) cv[y]![x] = t < -0.9 ? "Q" : t > 0.9 ? "r" : "R";
        else if (s > 5.6 && s <= end) {
          const lo = -3.0;
          const hi = 1.6;
          // The tip is cut on a slant.
          const slant = end - 0.55 * (t - lo);
          if (s <= slant && t >= lo && t <= hi) {
            cv[y]![x] = t < -1.7 ? "W" : t > hi - 0.9 ? "V" : "U";
            bladeS.set(y * W + x, s);
          }
        }
      }
    // Teeth: along the blade's edge facing the saw's clockwise side, every other pixel sticks out two pixels.
    const ax: Pt = Math.abs(nx) >= Math.abs(ny) ? [Math.sign(nx), 0] : [0, Math.sign(ny)];
    for (const [i, s] of bladeS) {
      const x = i % W;
      const y = (i - x) / W;
      if (bladeS.has((y + ax[1]) * W + x + ax[0])) continue;
      if (Math.floor((s - 5.6) / 1.9) % 2 !== 0 || s > end - 2) continue;
      for (const d of [1, 2]) if (cv[y + ax[1] * d]?.[x + ax[0] * d] === ".") cv[y + ax[1] * d]![x + ax[0] * d] = d === 1 ? "U" : "V";
    }
    return crop(cv);
  });
}

type LegKey = "n" | "f";
/** Feet: where a standing leg's hip and paw go (frame pixels). */
const HIP: Record<LegKey, Pt> = { n: [26, 51], f: [31, 51] };
const FOOT_X: Record<LegKey, number> = { n: 27, f: 33 };
const ANKLE_Y = 58;

/** The saw arm: shoulder, elbow, fist, and the saw's direction and length. */
interface Arm {
  pts: readonly [Pt, Pt, Pt];
  dir: Pt;
  len: number;
}
export type ArmName = "hold" | "up" | "high" | "waveL" | "waveM" | "waveR" | "point" | "down" | "side" | "lap" | "poke" | "drop";
const SH: Pt = [32, 44];
const ARMS: Record<ArmName, Arm> = {
  hold: { pts: [SH, [40, 49], [46, 46]], dir: [0.35, -1], len: 14 },
  up: { pts: [SH, [41, 47], [48, 42]], dir: [0.3, -1], len: 14 },
  high: { pts: [SH, [42, 46], [49, 38]], dir: [0.15, -1], len: 14 },
  waveL: { pts: [SH, [42, 47], [47, 42]], dir: [-0.45, -1], len: 14 },
  waveM: { pts: [SH, [42, 47], [48, 42]], dir: [0.3, -1], len: 14 },
  waveR: { pts: [SH, [42, 47], [48, 43]], dir: [1, -0.8], len: 11 },
  point: { pts: [SH, [40, 48], [44, 45]], dir: [1, -0.2], len: 10 },
  down: { pts: [SH, [38, 49], [42, 50]], dir: [1, 0.25], len: 6 },
  side: { pts: [SH, [40, 50], [45, 49]], dir: [0.9, -0.6], len: 9 },
  lap: { pts: [[31, 46], [35, 51], [39, 50]], dir: [1, 0.45], len: 9 },
  poke: { pts: [SH, [42, 49], [46, 46]], dir: [-0.2, -1], len: 14 },
  drop: { pts: [SH, [38, 49], [41, 50]], dir: [1, -0.1], len: 9 },
};

// ---- Poses.

export interface Pose {
  mood?: Mood;
  /** The whole upper body down this many pixels (a breath, a crouch). */
  bob?: number;
  /** The head on the body. */
  hx?: number;
  hy?: number;
  dx?: number;
  /** Off the ground. */
  air?: number;
  /** Feet: sideways shift and lift off the ground, per leg. */
  feet?: Partial<Record<LegKey, { x?: number; lift?: number }>>;
  /** The saw arm (null: no arm, no saw). */
  arm?: ArmName | null;
  tail?: number;
  ear?: "mid" | "up" | "down";
  /** The hard hat: down this many pixels (over the eyes), sideways, slanted. */
  hat?: { dy?: number; dx?: number; tilt?: -2 | -1 | 0 | 1 | 2 };
  sit?: boolean;
  /** Plopped on its bottom on the ground (defeat). */
  slump?: boolean;
  /** The saw lying on the ground (dropped). */
  sawDown?: boolean;
  noShadow?: boolean;
}

function build(p: Pose): Layer[] {
  const dx = p.dx ?? 0;
  const air = p.air ?? 0;
  const bob = p.bob ?? 0;
  const sit = p.sit ?? false;
  const slump = p.slump ?? false;
  const by = bob - air + (sit ? -1 : slump ? 0 : 3);
  const ux = dx;
  const uy = by;
  const layers: Layer[] = [];
  const add = (l: { name: string; at: Pt }, ox = 0, oy = 0) => layers.push({ part: l.name, x: l.at[0] + ox, y: l.at[1] + oy });
  const put = (part: string, x: number, y: number) => layers.push({ part, x, y });
  const arm = slump ? null : p.arm === undefined ? "hold" : p.arm;
  if (!p.noShadow) put("shadow", 13 + dx, GROUND - 2);

  // The tail, behind everything.
  const tl = p.tail ?? 0;
  const tailStyle = slump ? "ground" : sit ? "down" : "up";
  add(painted(`tail:${tl}:${tailStyle}`, () => tailPart(tl, tailStyle)), dx, slump ? 0 : Math.min(by, 4));
  if (sit) put("stool", 11 + dx, 51);
  // A dropped saw lies on the ground in front of it, handle to our right.
  if (p.sawDown) add(sawPart([56, 58], [-1, 0], 9));

  const foot = (k: LegKey): Pt => [FOOT_X[k] + (p.feet?.[k]?.x ?? 0) + dx, ANKLE_Y - air - (p.feet?.[k]?.lift ?? 0)];
  const leg = (pts: readonly Pt[], near: boolean, r = 2.2) => add(painted(`leg:${near ? "n" : "f"}:${r}:${pts.map((q) => q.join(",")).join(";")}`, () => stroke(pts, { r, far: !near })));
  const stand = (k: LegKey) => {
    const hip: Pt = [HIP[k][0] + dx, HIP[k][1] + by];
    const a = foot(k);
    const knee: Pt = [Math.round((hip[0] + a[0]) / 2 + 1), Math.round((hip[1] + a[1]) / 2)];
    leg([hip, knee, a], k === "n");
    put("paw", a[0] - 3, a[1]);
  };
  if (slump) {
    leg([[31 + dx, 57], [35 + dx, 58], [39 + dx, 58]], false, 2.6);
    put("paw", 38 + dx, 58);
  } else if (sit) {
    const s = p.feet?.f?.x ?? 0;
    leg([[31 + dx, 51 + by], [37 + dx, 53 + by], [38 + dx + s, 56]], false);
    put("paw", 36 + dx + s, 56);
  } else {
    stand("f");
    stand("n");
  }

  add(BODY_PART, ux, uy);
  if (slump) {
    leg([[28 + dx, 56], [32 + dx, 58], [36 + dx, 58]], true, 2.8);
    put("paw", 35 + dx, 58);
  } else if (sit) {
    const s = p.feet?.n?.x ?? 0;
    leg([[28 + dx, 51 + by], [35 + dx, 54 + by], [36 + dx + s, 57]], true);
    put("paw", 34 + dx + s, 57);
  }

  // The ear behind the head, then the head, then the hat.
  const hx = HX0 + (p.hx ?? 0) + ux;
  const hy = HY0 + (p.hy ?? 0) + uy;
  put(`ear:${p.ear ?? "mid"}`, hx - 4, hy + 1);
  put(`head:${p.mood ?? "calm"}`, hx, hy);
  const h = p.hat ?? {};
  put(`hat:${h.tilt ?? 0}`, hx - 1 + (h.dx ?? 0), hy - 6 - HAT_TOP + (h.dy ?? 0));

  // The saw and the arm that holds it, in front.
  if (arm !== null) {
    const spec = ARMS[arm];
    const pts = spec.pts.map((q, i): Pt => [q[0] + dx, Math.min(q[1] + by, i === 2 ? 54 : 55)]);
    const [s, e, fist] = pts as [Pt, Pt, Pt];
    add(sawPart(fist, spec.dir, spec.len));
    add(painted(`arm:${arm}:${s};${e};${fist}`, () => stroke([s, e, fist], { r: 1.6, glove: 2.5 })));
  }
  return layers;
}

// ---- Specks and little effects.

function seeded(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => ((s = (s * 1103515245 + 12345) >>> 0) >>> 8) / 16777216;
}
/** A twinkle: a little plus. */
const star = (x: number, y: number, k = "Y"): Speck[] => [[x, y, "x"], [x - 1, y, k], [x + 1, y, k], [x, y - 1, k], [x, y + 1, k]];
/** Twinkles scattered round the figure, a new set per `t`. */
function twinkles(t: number, n = 4, box: readonly [number, number, number, number] = [6, 6, 56, 46]): Speck[] {
  const rnd = seeded(t * 31 + 5);
  return Array.from({ length: n }, (_, i) => star(Math.round(box[0] + rnd() * (box[2] - box[0])), Math.round(box[1] + rnd() * (box[3] - box[1])), (i + t) % 2 ? "Y" : "A")).flat();
}
/** Dust puffing out along the ground at the feet. */
const dust = (t: number): Speck[] =>
  [-1, 1].flatMap((side) =>
    [0, 1, 2].map((i): Speck => [Math.round(30 + side * (9 + i * 3 + t * 2)), GROUND - 1 - (i % 2) - (t > 0 ? 1 : 0), t > 1 ? "T" : "S"]),
  );
/** The shadow on the ground, growing as it drops in. */
const dropShadow = (r: number): Speck[] => Array.from({ length: r * 2 + 1 }, (_, i): Speck => [28 - r + i, GROUND - 1, "z"]);
/** Thought dots beside the head. */
const thoughts = (n: number): Speck[] => {
  const blob = (x: number, y: number, rows: readonly string[]): Speck[] => rows.flatMap((row, j) => [...row].flatMap((c, i): Speck[] => (c === "." ? [] : [[x + i, y + j, c]])));
  const parts: Speck[][] = [
    blob(49, 26, [".kk.", "kggk", "kgSk", ".kk."]),
    blob(51, 19, [".kkk.", "kgggk", "kgggk", "kgSSk", ".kkk."]),
    blob(51, 5, ["..kkkkkkk..", ".kgggggggk.", "kgggggggggk", "kgTgTgTgggk", "kggggggSSgk", ".kSSSSSSSk.", "..kkkkkkk.."]),
  ];
  return parts.slice(0, n).flat();
};
/** Sweat flying off the head. */
const sweat = (i: number): Speck[] => {
  const t = i % 4;
  return [[17 - t, 29 + t, "l"], [17 - t, 30 + t, "x"], [44 + t, 24 + t, "l"], [44 + t, 25 + t, "x"]];
};
/** Sawdust in the air, a few chips flying out from a point. */
function chips([cx, cy]: Pt, t: number, n = 7): Speck[] {
  const rnd = seeded(cx * 7 + cy * 3 + t * 11);
  return Array.from({ length: n }, (_, i): Speck => {
    const a = -Math.PI * (0.1 + rnd() * 0.8);
    const d = 2 + t * (1.2 + rnd() * 1.4);
    return [Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d * 0.9 + t * t * 0.25), i % 3 ? "W" : "V"];
  });
}
/** Confetti, a burst round a point. */
function burst([cx, cy]: Pt, r: number, seed = 0): Speck[] {
  const keys = ["Y", "B", "A", "R"];
  return Array.from({ length: 8 }, (_, i): Speck => [Math.round(cx + Math.cos((i / 8) * Math.PI * 2 + seed) * r), Math.round(cy + Math.sin((i / 8) * Math.PI * 2 + seed) * r), keys[(i + seed) % 4]!]);
}

const FLASH: Record<string, string> = { a: "#5f4843", b: "#7e635e", c: "#a08883", d: "#c0aea5", h: "#f8f1ea", Y: "#ffe05a", O: "#f6c21c", y: "#fff3ad" };

/** One frame: the pose and anything extra. */
function f(ms: number, p: Pose, extra: Partial<Frame> = {}): Frame {
  const specks = (extra.specks ?? []).filter(([x, y]) => x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2);
  return { ms, layers: build(p), ...extra, specks };
}

// ---- Animations.

/** Idle (3 s): breathes, blinks, swishes its tail; then the hat slips down over its eyes and it bumps it back up with the saw. */
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 30 }, (_, i) => {
    const bob = i % 15 >= 8 ? 1 : 0;
    const blink = i === 11 || i === 12 || i === 27;
    const tail = i >= 3 && i <= 8 ? (i % 2 ? 2 : 1) : i >= 19 && i <= 21 ? -1 : 0;
    const slip = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0][i]!;
    const poke = i === 22 || i === 23;
    const hat = i === 24 ? { dy: -2, tilt: -1 as const } : i === 25 ? { dy: -1, tilt: -1 as const } : i === 26 ? { dy: 0, tilt: 0 as const } : { dy: slip, tilt: (slip >= 2 ? 1 : 0) as 0 | 1 };
    const hx = i >= 27 ? 1 : 0;
    return f(100, { bob, mood: blink ? "blink" : "calm", ear: i === 14 ? "down" : i === 15 ? "up" : "mid", tail, hat, hx, arm: poke || i === 24 ? "poke" : "hold" }, {});
  }),
};

/** Walk (0.6 s): a quick scamper on little legs, the head bobbing, the tail swinging, the saw held up. */
const walk: Anim = {
  loop: true,
  frames: Array.from({ length: 6 }, (_, i) => {
    const th = (i / 6) * Math.PI * 2;
    const leg = (off: number) => ({ x: Math.round(4 * Math.sin(th + off * Math.PI * 2)), lift: Math.max(0, Math.round(3 * Math.cos(th + off * Math.PI * 2))) });
    const j = i % 3;
    const bob = j === 0 ? 1 : 0;
    return f(100, { bob, air: j === 1 ? 1 : 0, hy: j === 1 ? -1 : 0, mood: "calm", feet: { n: leg(0), f: leg(0.5) }, tail: i < 3 ? 2 : -1, ear: bob ? "down" : "mid", arm: bob ? "hold" : "up", hat: { dy: bob ? 1 : j === 1 ? -1 : 0, tilt: bob ? 1 : j === 1 ? -1 : 0, dx: i < 3 ? 0 : 1 } }, j === 0 ? { cue: "step" } : {});
  }),
};

/** Sit (loops): on a stool at the chess table, facing the board, legs dangling, the saw across its lap; thinks about a move. */
const sit: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) => {
    const lean = i >= 6 && i <= 11;
    const blink = i === 3 || i === 4 || i === 13;
    const swing = i % 8 < 4 ? 0 : 1;
    return f(200, { sit: true, arm: "lap", mood: blink ? (lean ? "thinkBlink" : "blink") : lean ? "think" : "calm", bob: i % 8 >= 4 ? 1 : 0, hx: lean ? 2 : 0, hy: lean ? 1 : 0, ear: i === 9 ? "down" : "mid", tail: swing, feet: { n: { x: swing }, f: { x: swing ? 0 : 1 } }, hat: { dy: lean ? 1 : 0, tilt: lean ? 1 : 0 } }, {});
  }),
};

/** Wave (once, 1.2 s): lifts the saw and waves it hello, the hat wobbling, then settles back to its idle pose. */
const WAVES: readonly ArmName[] = ["waveL", "waveM", "waveR", "waveM", "waveL", "waveM", "waveR", "waveM"];
const wave: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 1, mood: "happy", arm: "hold", hat: { dy: 1 } }),
    f(100, { mood: "cheer", arm: "up", hy: -1, ear: "up", hat: { dy: -1, tilt: -1 } }),
    ...WAVES.map((arm, i) => f(100, { mood: i % 2 ? "cheer" : "happy", arm, hx: arm === "waveL" ? -1 : arm === "waveR" ? 1 : 0, hy: i % 2 ? 0 : -1, bob: i % 2 ? 1 : 0, tail: i % 2 ? 2 : -1, ear: i % 4 === 1 ? "up" : "mid", hat: { dx: i % 2 ? 1 : -1, dy: i % 2 ? 0 : -1, tilt: (i % 2 ? 1 : -1) as 1 | -1 } }, { specks: i % 3 === 0 ? star(51 + (i % 4), 14 + (i % 4) * 3) : [] })),
    f(100, { mood: "happy", arm: "hold", hat: { dy: 1, tilt: 1 } }),
    f(100, { mood: "calm", arm: "hold" }),
  ],
};

/** Entrance: drops in on its shadow, lands with a squash and a puff of dust, the hat slips over its eyes, a bump with the saw, ta-da. */
const entrance: Anim = {
  loop: false,
  frames: [
    { ms: 90, layers: [], specks: dropShadow(4) },
    { ms: 80, layers: [], specks: dropShadow(8) },
    f(70, { air: 8, mood: "cheer", arm: "up", feet: { n: { lift: 2 }, f: { lift: 3 } }, ear: "up", hat: { dy: -2, tilt: -2 } }, { specks: dropShadow(11) }),
    f(70, { air: 3, mood: "cheer", arm: "up", feet: { n: { lift: 1 }, f: { lift: 2 } }, ear: "up", hat: { dy: -1, tilt: -1 } }),
    f(100, { bob: 3, mood: "blink", arm: "hold", ear: "down", hat: { dy: 4, tilt: 2 } }, { cue: "step", specks: dust(0) }),
    f(120, { bob: 1, mood: "calm", arm: "hold", hat: { dy: 3, tilt: 1 } }, { specks: dust(1) }),
    f(110, { mood: "calm", arm: "poke", hat: { dy: 3, tilt: 1 } }, { specks: dust(2) }),
    f(110, { mood: "cheer", arm: "poke", hat: { dy: -2, tilt: -1 }, hy: -1 }),
    f(110, { mood: "cheer", arm: "high", hy: -1, hat: { dy: -1, tilt: -1 }, tail: 2 }, { specks: twinkles(1, 3) }),
    f(110, { mood: "happy", arm: "waveL", hx: -1, hat: { dx: -1 }, tail: -1 }, { specks: twinkles(2, 3) }),
    f(120, { mood: "happy", arm: "hold", hat: { dy: 1 } }),
    f(300, { mood: "calm", arm: "hold" }),
  ],
};

/** Thinking (loops): head tipped up, eyes rolled up, a foot tapping, the saw low, the hat sliding, thought dots popping up. */
const thinking: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) =>
    f(150, { mood: i === 8 ? "thinkBlink" : "think", arm: "side", hx: 2, hy: -1, bob: i % 6 >= 3 ? 1 : 0, feet: { f: i % 4 === 1 ? { lift: 2 } : {} }, tail: i % 6 < 3 ? 1 : 0, ear: i === 5 ? "down" : "mid", hat: { dy: i % 6 >= 3 ? 1 : 0, tilt: i % 6 >= 3 ? 1 : 0, dx: 1 } }, { specks: thoughts(i % 6 < 1 ? 0 : i % 6 < 3 ? 1 : i % 6 < 5 ? 2 : 3) }),
  ),
};

/** Its move: a hop toward the board and a flick of the saw at it. */
const move: Anim = {
  loop: false,
  frames: [
    f(90, { bob: 2, mood: "bold", arm: "hold", hat: { dy: 1 } }),
    f(80, { air: 4, dx: 1, mood: "bold", arm: "point", feet: { n: { lift: 2 }, f: { lift: 3 } }, ear: "up", hat: { dy: -1, tilt: -1 } }),
    f(80, { air: 5, dx: 2, mood: "bold", arm: "point", feet: { n: { lift: 2 }, f: { lift: 2 } }, hat: { dy: -1, tilt: -1 } }),
    f(100, { bob: 2, dx: 2, mood: "happy", arm: "point", hat: { dy: 2, tilt: 1 } }, { cue: "step", specks: [...dust(0), ...chips([56, 40], 1)] }),
    f(100, { bob: 1, dx: 2, mood: "happy", arm: "point", hat: { dy: 1, tilt: 1 } }, { specks: chips([57, 39], 2, 5) }),
    f(110, { dx: 1, mood: "happy", arm: "hold" }),
    f(150, { mood: "calm", arm: "hold" }),
  ],
};

/** A capture: two excited hops, the saw waving high, the hat bouncing, confetti and twinkles. */
const capture: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 2, mood: "bold", arm: "hold", hat: { dy: 1 } }),
    f(80, { air: 5, mood: "cheer", arm: "high", feet: { n: { lift: 2 }, f: { lift: 3 } }, ear: "up", hat: { dy: -2, tilt: -1 } }, { specks: twinkles(1) }),
    f(80, { air: 6, mood: "happy", arm: "waveL", feet: { n: { lift: 3 }, f: { lift: 3 } }, hy: -1, hat: { dy: -2, tilt: -2 } }, { specks: twinkles(2) }),
    f(80, { air: 4, mood: "happy", arm: "waveR", hat: { dy: -1, tilt: -1 } }, { specks: twinkles(3) }),
    f(80, { bob: 2, mood: "cheer", arm: "high", hat: { dy: 2, tilt: 1 } }, { cue: "step", specks: dust(0) }),
    f(80, { air: 6, mood: "happy", arm: "waveM", feet: { n: { lift: 2 }, f: { lift: 3 } }, ear: "up", hat: { dy: -2, tilt: -2 } }, { specks: twinkles(4) }),
    f(80, { air: 6, mood: "happy", arm: "waveR", feet: { n: { lift: 3 }, f: { lift: 3 } }, hy: -1, hat: { dy: -2, tilt: -1 } }, { specks: twinkles(5) }),
    f(80, { air: 4, mood: "happy", arm: "waveL", hat: { dy: -1 } }, { specks: twinkles(6) }),
    f(90, { bob: 2, mood: "cheer", arm: "high", hat: { dy: 2, tilt: 1 } }, { specks: dust(1) }),
    f(120, { bob: 1, mood: "happy", arm: "up", hat: { dy: 1 } }),
    f(160, { mood: "smug", arm: "hold" }),
  ],
};

/** Hurt: hit, a flash, the hat knocked down over its eyes; then it pushes the hat up and shakes it off with a brave little grin. */
const hurt: Anim = {
  loop: false,
  frames: [
    f(70, { bob: 2, mood: "hurt", arm: "down", ear: "down", hat: { dy: 4, tilt: 2, dx: 1 } }, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    f(80, { bob: 3, mood: "hurt", arm: "down", ear: "down", hat: { dy: 5, tilt: 2 } }, { shake: [-1, 0], specks: [[16, 28, "l"], [16, 29, "x"]] }),
    f(90, { bob: 2, dx: -1, mood: "hurt", arm: "down", ear: "down", hat: { dy: 4, tilt: 2 } }, { specks: [[15, 31, "l"], [15, 32, "x"]] }),
    f(100, { bob: 1, dx: -1, mood: "rattled", arm: "side", hat: { dy: 3, tilt: 1 } }),
    f(110, { mood: "blink", arm: "poke", hat: { dy: 2, tilt: 1 } }),
    f(120, { mood: "bold", arm: "poke", hat: { dy: -1, tilt: -1 } }),
    f(160, { mood: "calm", arm: "hold" }),
  ],
};

/** Check: two sharp jabs of the saw at the board, eyes bright. */
const JAB: Pose = { bob: 2, dx: 1, mood: "bold", arm: "point", hat: { dy: 1, tilt: 1 } };
const check: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 1, mood: "bold", arm: "up" }),
    f(110, { ...JAB }, { specks: chips([57, 40], 1, 5) }),
    f(90, { bob: 1, mood: "bold", arm: "up" }),
    f(110, { ...JAB }, { specks: chips([57, 40], 1, 5) }),
    f(90, { bob: 1, dx: 1, mood: "bold", arm: "point" }),
    f(150, { dx: 1, mood: "happy", arm: "point" }),
    f(160, { mood: "smug", arm: "hold" }),
  ],
};

/** Smug: chin up, eyes half shut, a little smirk, the hat pushed back, a slow nod. */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(150, { mood: "smug", arm: "hold", hy: i < 3 || i > 5 ? -1 : 0, hx: i < 4 ? 0 : 1, bob: i % 4 === 2 ? 1 : 0, ear: i === 5 ? "up" : "mid", hat: { dy: -1, tilt: -1 } })),
};

/** Rattled: wide eyes, worried brows, sweat flying, trembling where it stands, the hat sliding about. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(80, { mood: "rattled", arm: "side", dx: i % 2 ? 1 : -1, bob: i % 4 === 2 ? 1 : 0, ear: "down", tail: i % 2 ? 1 : -1, hat: { dy: 1 + (i % 4 === 1 ? 1 : 0), tilt: 1, dx: i % 2 ? 1 : 0 } }, { specks: sweat(i) })),
};

/** Defeat: hit, dizzy, the saw drops, the hat flops down over its face and it plops onto its bottom (the last frame holds). */
const SLUMP: Pose = { slump: true, bob: 6, dx: -2, mood: "out", ear: "down", hx: 1, hy: 2, tail: 1, sawDown: true, hat: { dy: 6, tilt: 2 } };
const defeat: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 2, mood: "hurt", arm: "down", ear: "down", hat: { dy: 4, tilt: 2 } }, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    f(90, { bob: 2, dx: -1, mood: "out", arm: "drop", ear: "down", hat: { dy: 5, tilt: 2 } }, { specks: [...star(24, 15, "A"), ...star(40, 13)] }),
    f(110, { bob: 3, dx: 1, mood: "out", arm: "drop", ear: "down", hat: { dy: 5, tilt: 2 } }, { specks: [...star(20, 17), ...star(44, 15, "B")] }),
    f(110, { bob: 4, mood: "out", arm: "drop", ear: "down", hy: 1, hat: { dy: 6, tilt: 2 } }, { specks: [...star(24, 14, "B"), ...star(41, 17, "A")] }),
    f(110, { ...SLUMP, bob: 4 }, { specks: [...star(25, 12), ...star(43, 14, "A")] }),
    f(120, { ...SLUMP }, { cue: "step", shake: [1, 0], specks: [...star(22, 14, "B"), ...star(40, 14), ...dust(0)] }),
    f(160, { ...SLUMP, tail: 2 }, { specks: [...star(28, 11, "A"), ...star(44, 14)] }),
    f(200, { ...SLUMP }, { specks: [...star(24, 12), ...star(40, 12, "B")] }),
    f(1000, { ...SLUMP, tail: 2 }, { specks: [...star(27, 11, "B"), ...star(42, 13, "A")] }),
  ],
};

/** Victory: jumping for joy, the saw waving high, the hat flying about, confetti popping all round. Then again. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const air = [0, 3, 5, 6, 5, 3, 0, 0, 3, 5, 3, 0][i]!;
    const arms: ArmName[] = ["high", "waveL", "waveM", "waveR", "waveM", "waveL", "high", "high", "waveR", "waveM", "waveL", "high"];
    return f(110, { bob: i === 0 || i === 6 || i === 7 ? 2 : 0, air, mood: air > 2 ? "happy" : "cheer", arm: arms[i]!, feet: air > 2 ? { n: { lift: 3 }, f: { lift: 3 } } : {}, hy: i % 2 ? -1 : 0, ear: air > 3 ? "up" : "mid", tail: i % 2 ? 2 : -1, hat: { dy: air > 2 ? -2 : i === 0 || i === 6 || i === 7 ? 2 : 0, tilt: air > 2 ? -2 : 0, dx: i % 2 ? 1 : 0 } }, { specks: [...burst([12 + (i % 3) * 18, 12 + (i % 4) * 3], 2 + (i % 4), i), ...twinkles(i, 2)], cue: i === 0 ? "step" : undefined });
  }),
};

export const sidekickSawyer: Character = {
  id: "sidekick-sawyer",
  name: "Sawyer's sidekick",
  w: W,
  h: H,
  foot: [30, GROUND],
  palette: SIDEKICK_SAWYER_PALETTE,
  halo: "#2c2624",
  parts: PARTS,
  anims: { idle, walk, sit, wave, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory },
};
