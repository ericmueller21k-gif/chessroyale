/**
 * Moo's sidekick (id "sidekick-moo"): a tiny Holstein calf, a town bot that wanders the square and plays chess at the
 * park's tables. No powers, never fights: a friendly, curious kid who copies the big one. It wears ONE little yellow
 * star (the Moon's friend) on a red ribbon round its neck; it swings, and twinkles now and then.
 *
 * Smaller and plainer than Moo: all four legs on the ground, a big round head with big shiny eyes, a pink snout, floppy
 * brown ears with pink insides, no horns yet (just a cream tuft), cream with a few dark-brown patches, a round little
 * body and stubby legs with dark hooves, a thin tail with a dark tuft. Moo's cream, browns, pinks and yellows (his
 * palette). Three-quarters, facing our right, light from the top left.
 *
 * Rigging: the body (with its neck), the head (one per face) and the ears are painted once; the legs, the tail and the
 * ears are painted from points per pose, so a new pose is a handful of numbers (`Pose`). The star hangs on its ribbon
 * from the chest (`star`: how far it swings; `glow`: how brightly it twinkles).
 */
import { canvas, ellipse, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../../../packages/app/src/characters/sprite.ts";

export const SIDEKICK_MOO_PALETTE = {
  k: "#25140d", // outline
  C: "#bf9f78", // cream: shade, mid, light, highlight
  D: "#e0c8a2",
  E: "#f5e6c6",
  F: "#fff6e0",
  a: "#37201a", // brown: dark to light
  b: "#552f27",
  c: "#744339",
  d: "#92594a",
  p: "#b95a63", // pink: shade, mid, light, highlight
  q: "#dd7b80",
  r: "#f19c96",
  s: "#ffc1b2",
  n: "#6e2a33", // nostrils, inside of the mouth
  v: "#f08e80", // blush
  e: "#b07240", // eye shine (amber)
  x: "#1f0f0a",
  w: "#ffffff",
  M: "#e3a22b", // the star: shade, mid, light, highlight, and its darker rim
  N: "#f8c744",
  O: "#ffdc6c",
  P: "#fff0a8",
  Q: "#c9801f",
  R: "#e0342c", // ribbon
  S: "#a8221c",
  "1": "#c98f4e", // stool wood: light to dark
  "2": "#a06a33",
  "3": "#6c4222",
  z: "#0d0e12", // ground shadow
  t: "#8a7d66", // dust
  y: "#4d4538",
  j: "#9fd8ff", // sweat
  g: "#8fb0ff", // confetti
} as const;

type Pt = readonly [number, number];
type Inside = (x: number, y: number) => boolean;

/** The frame, and the ground (the first row below the hooves). */
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

const CREAM = "CDEF";
const BROWN = "abcd";
const PINK = "pqrs";
const ramp = (r: string, l: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(l * r.length)))]!;
const ell = (cx: number, cy: number, rx: number, ry: number): Inside => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
/** Light from the top left on a round surface (0 dark to 1 light). */
const roundL = (cx: number, cy: number, rx: number, ry: number, bias = 0) => (x: number, y: number) => 0.5 + bias - 0.42 * ((x - cx) / rx) - 0.5 * ((y - cy) / ry);

/** A patch of brown: an ellipse with a wavering edge, so no patch is a neat oval. */
function patch(cx: number, cy: number, rx: number, ry: number, seed: number): Inside {
  return (x, y) => {
    const nx = (x - cx) / rx;
    const ny = (y - cy) / ry;
    const a = Math.atan2(ny, nx);
    const r = 1 + 0.13 * Math.sin(3 * a + seed) + 0.07 * Math.sin(5 * a + seed * 2.3);
    return nx * nx + ny * ny <= r * r;
  };
}
function stamp(cv: Canvas, rows: readonly string[], x0: number, y0: number): void {
  rows.forEach((row, y) =>
    [...row].forEach((k, i) => {
      if (k === "." || cv[y0 + y]?.[x0 + i] === undefined) return;
      cv[y0 + y]![x0 + i] = k;
    }),
  );
}
function dots(cv: Canvas, pts: readonly Pt[], k: string, ox = 0, oy = 0): void {
  for (const [x, y] of pts) if (cv[y + oy]?.[x + ox] !== undefined) cv[y + oy]![x + ox] = k;
}

/** How far a point is from a polyline, the side it is on, the way along (0 to 1) and the radius there. */
function along(pts: readonly Pt[], r: readonly number[], p: Pt): { s: number; d: number; nx: number; ny: number; rr: number } {
  let best = { s: 0, d: Infinity, nx: 0, ny: 0, rr: r[0]! };
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const vx = b[0] - a[0];
    const vy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy || 1)));
    const nx = p[0] - (a[0] + t * vx);
    const ny = p[1] - (a[1] + t * vy);
    const rr = r[i]! + (r[i + 1]! - r[i]!) * t;
    const d = Math.hypot(nx, ny);
    if (d - rr < best.d - best.rr) best = { s: (i + t) / (pts.length - 1), d, nx, ny, rr };
  }
  return best;
}
interface Stroke {
  pts: readonly Pt[];
  r: readonly number[];
  key: (light: number, s: number, rel: number, x: number, y: number) => string | null;
}
/** Strokes painted into one part (a limb and its tuft), each over the ones before. */
function strokes(list: readonly Stroke[]): Painted {
  const cv = canvas(W, H);
  for (const st of list)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const a = along(st.pts, st.r, [x, y]);
        if (a.d > a.rr) continue;
        const k = st.key(0.6 - 0.45 * (a.nx / a.rr) - 0.5 * (a.ny / a.rr), a.s, a.d / a.rr, x, y);
        if (k) cv[y]![x] = k;
      }
  return crop(cv);
}

// ---- The head. A big round skull, a cream muzzle with a pink pad, big shiny eyes, a tuft. One part per face.

export type Mood = "calm" | "blink" | "happy" | "cheer" | "think" | "thinkBlink" | "smug" | "rattled" | "hurt" | "out" | "bold" | "sleepy";
type Eye = "open" | "up" | "wide" | "half" | "arc" | "shut" | "pinch" | "x";
type Brow = "up" | "worried" | "bold" | "smug";
type Mouth = "smile" | "grin" | "flat" | "smirk" | "wavy" | "o" | "tongue" | "chew";

const NEAR_EYE: Record<Eye, readonly string[]> = {
  open: [".kkk.", "kwwkk", "kwkkk", "kkkkk", "kkeek", ".kkk."],
  up: [".kkk.", "kkkwk", "kkkkk", "kkkkk", "kwekk", ".kkk."],
  wide: [".kkk.", "kwwwk", "kwkwk", "kwkwk", "kwwwk", ".kkk."],
  half: [".....", "kkkkk", "kwkkk", "kkeek", ".kkk.", "....."],
  arc: [".....", ".....", ".kkk.", "k...k", ".....", "....."],
  shut: [".....", ".....", ".....", "kkkkk", ".....", "....."],
  pinch: [".....", "kk...", ".kkk.", "...kk", ".kkk.", "kk..."],
  x: [".....", "k...k", ".k.k.", "..k..", ".k.k.", "k...k"],
};
const FAR_EYE: Record<Eye, readonly string[]> = {
  open: [".kk.", "kwkk", "kkkk", "kkek", ".kk."],
  up: [".kk.", "kkwk", "kkkk", "kwkk", ".kk."],
  wide: [".kkk.", "kwwwk", "kwkwk", "kwwwk", ".kkk."],
  half: ["....", "kkkk", "kwkk", ".kk.", "...."],
  arc: ["....", ".kk.", "k..k", "....", "...."],
  shut: ["....", "....", "kkkk", "....", "...."],
  pinch: ["....", "kk..", ".kk.", "kk..", "...."],
  x: ["....", "k..k", ".kk.", "k..k", "...."],
};
/** Brows: [near, far] pixels on the head grid. */
const BROWS: Record<Brow, readonly [readonly Pt[], readonly Pt[]]> = {
  up: [[[4, 8], [5, 8], [6, 8], [7, 8]], [[12, 8], [13, 8], [14, 8]]],
  worried: [[[3, 10], [4, 9], [5, 9], [6, 8], [7, 8]], [[12, 8], [13, 8], [14, 9], [15, 10]]],
  bold: [[[3, 8], [4, 8], [5, 9], [6, 9], [7, 10]], [[12, 10], [13, 9], [14, 8], [15, 8]]],
  smug: [[[4, 9], [5, 9], [6, 9], [7, 9]], [[12, 8], [13, 7], [14, 7], [15, 7]]],
};
const MOUTHS: Record<Mouth, readonly string[]> = {
  smile: ["k....k", ".kkkk."],
  grin: ["kkkkkk", "knnnnk", ".kqqk."],
  flat: ["kkkk"],
  smirk: ["....kk", "kkkk.."],
  wavy: ["k.k.k", ".k.k."],
  o: [".kk.", "knnk", ".kk."],
  tongue: ["kkkkkk", "knqqnk", "..kqqk"],
  chew: ["k...k", ".kkk."],
};
const FACES: Record<Mood, { near: Eye; far: Eye; brow?: Brow; mouth: Mouth; blush?: boolean }> = {
  calm: { near: "open", far: "open", mouth: "smile", blush: true },
  blink: { near: "shut", far: "shut", mouth: "smile", blush: true },
  happy: { near: "arc", far: "arc", mouth: "grin", blush: true },
  cheer: { near: "open", far: "open", brow: "up", mouth: "grin", blush: true },
  think: { near: "up", far: "up", brow: "up", mouth: "chew" },
  thinkBlink: { near: "shut", far: "shut", brow: "up", mouth: "chew" },
  smug: { near: "half", far: "half", brow: "smug", mouth: "smirk", blush: true },
  rattled: { near: "wide", far: "wide", brow: "worried", mouth: "wavy" },
  hurt: { near: "pinch", far: "pinch", brow: "worried", mouth: "o" },
  out: { near: "x", far: "x", mouth: "tongue" },
  bold: { near: "open", far: "open", brow: "bold", mouth: "grin", blush: true },
  sleepy: { near: "half", far: "half", mouth: "smile", blush: true },
};

const HW = 27;
const HH = 24;
/** Where the head grid sits at rest (its top-left), on the frame. */
const HX0 = 28;
const HY0 = 22;

function head(mood: Mood): Part {
  const cv = canvas(HW, HH);
  const skull = ell(11.5, 13, 10.5, 8.8);
  const muzzle = ell(19.5, 17.5, 6.5, 5);
  const pad = ell(21, 16.5, 4.4, 3.4);
  const inside: Inside = (x, y) => skull(x, y) || muzzle(x, y);
  const light = roundL(12, 12, 13, 11, 0.14);
  const padL = roundL(20, 15.5, 5, 4, 0.14);
  const brown = patch(3.5, 7, 5, 3.2, 0.9);
  for (let y = 0; y < HH; y++)
    for (let x = 0; x < HW; x++) {
      if (!inside(x, y)) continue;
      if (pad(x, y)) cv[y]![x] = ramp(PINK, padL(x, y));
      else if (skull(x, y) && brown(x, y)) cv[y]![x] = ramp(BROWN, light(x, y) + 0.04);
      else cv[y]![x] = ramp(CREAM, light(x, y) + 0.12);
    }
  // The cream tuft where the horns will be.
  stamp(cv, ["..FE.E.", ".FEEEED", "EEEEEDD", "DEEEDDD"], 11, 1);
  // Nostrils.
  dots(cv, [[19, 16], [19, 17], [23, 16], [23, 17]], "n");
  const face = FACES[mood];
  stamp(cv, NEAR_EYE[face.near], 4, 11);
  stamp(cv, FAR_EYE[face.far], 12, 11);
  if (face.blush) dots(cv, [[4, 18], [5, 18], [6, 18]], "v");
  if (face.brow) for (const side of BROWS[face.brow]) dots(cv, side, "a");
  const mouth = MOUTHS[face.mouth];
  const mx = face.mouth === "flat" || face.mouth === "o" ? 19 : 18;
  const my = face.mouth === "flat" ? 21 : 20;
  stamp(cv, mouth, mx, my);
  return { grid: toGrid(cv) };
}
const MOODS: readonly Mood[] = ["calm", "blink", "happy", "cheer", "think", "thinkBlink", "smug", "rattled", "hurt", "out", "bold", "sleepy"];
for (const m of MOODS) PARTS[`head:${m}`] = head(m);

// ---- Ears: a floppy leaf of brown with a pink inside, from the head out to its side.

type EarState = "mid" | "up" | "down" | "flat";
const EAR_ANG: Record<EarState, readonly [number, number]> = { mid: [32, -4], up: [-18, -38], down: [62, 30], flat: [10, 42] };
function earPart(side: 1 | -1, state: EarState): Painted & { name: string } {
  return painted(`ear:${side}:${state}`, () => {
    const ang = (EAR_ANG[state][side === -1 ? 0 : 1] * Math.PI) / 180;
    const root: Pt = side === -1 ? [HX0 + 5, HY0 + 9] : [HX0 + 15, HY0 + 7];
    const len = side === -1 ? 10.5 : 9;
    const d: Pt = [side * Math.cos(ang), Math.sin(ang)];
    const droop = state === "up" ? 0 : 1.6;
    const tip: Pt = [root[0] + d[0] * len, root[1] + d[1] * len + droop];
    const mid: Pt = [root[0] + d[0] * len * 0.5, root[1] + d[1] * len * 0.5 + droop * 0.3];
    return strokes([
      {
        pts: [root, mid, tip],
        r: [1.8, 3.3, 1.7],
        key: (l, s, rel) => (rel < 0.62 && s > 0.12 && s < 0.9 ? ramp(PINK, l + 0.1) : ramp(BROWN, l + 0.02)),
      },
    ]);
  });
}

// ---- Body: a round barrel with a short neck, cream with a few brown patches; legs and tail are painted per pose.

const BX = 24;
const BY = 46;
const BRX = 13;
const BRY = 7;

function bodyPart(): Painted {
  const cv = canvas(W, H);
  const body = ell(BX, BY, BRX, BRY);
  const neck = ell(32, 41, 5.5, 5);
  const inside: Inside = (x, y) => body(x, y) || neck(x, y);
  const light = roundL(21, 42, 15, 10, 0.12);
  const brown = (x: number, y: number) => patch(17, 43, 6.5, 4.6, 1.3)(x, y) || patch(29, 49, 3.4, 2.8, 2.7)(x, y) || patch(33, 39, 2.4, 2.4, 4.1)(x, y);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!inside(x, y)) continue;
      cv[y]![x] = brown(x, y) ? ramp(BROWN, light(x, y) + 0.05) : ramp(CREAM, light(x, y) + 0.12);
    }
  return crop(cv);
}
const BODY_PART = painted("body", bodyPart);

/** A leg: a stubby tube from the hip through the knee to the ankle, cream, shaded from the top left; far legs a tone darker. */
function legPart(hip: Pt, knee: Pt, ankle: Pt, near: boolean): Painted & { name: string } {
  return painted(`leg:${near ? "n" : "f"}:${[hip, knee, ankle].map((p) => p.join(",")).join(";")}`, () =>
    strokes([{ pts: [hip, knee, ankle], r: [2.1, 2.1, 2.0], key: (l) => (near ? ramp(CREAM, l + 0.1) : ramp(CREAM, l - 0.12)) }]),
  );
}
PARTS["hoof"] = { grid: ["cbbbb", "aaaaa"] };

/** The tail: a thin cream stalk from the rump (x 12, y 42) swung `tl` out, with a small dark tuft. `at` moves its root (sitting: lower and further back). */
function tailPart(tl: number, uy: number, drop: number, rx = 12, ry = 42): Painted & { name: string } {
  return painted(`tail:${tl}:${uy}:${drop}:${rx}:${ry}`, () => {
    const r0: Pt = [rx, ry + uy];
    return strokes([
      { pts: [r0, [rx - 3 + tl * 0.3, ry + 1 + uy], [rx - 5 + tl * 0.7, ry + 4 + uy + drop * 0.4], [rx - 6 + tl, ry + 7 + uy + drop]], r: [0.8, 0.8, 0.7, 0.7], key: (l) => ramp(CREAM, l + 0.05) },
      { pts: [[rx - 6 + tl, ry + 6 + uy + drop], [rx - 6 + tl, ry + 9 + uy + drop]], r: [1.2, 1.5], key: (l) => ramp(BROWN, l - 0.05) },
    ]);
  });
}

/** The star on its ribbon: a red V (the top hidden behind the chin) down to a little yellow star. */
const STAR_GRID = [
  "R.......R",
  "R.......R",
  "R.......R",
  ".R.....R.",
  "..R...R..",
  "...R.R...",
  "....S....",
  "....P....",
  "...OPN...",
  "..OOONM..",
  "POOOOONNM",
  ".NOOONNM.",
  "..NOONM..",
  "..NNNMM..",
  ".NNM.MMQ.",
  ".NM...MQ.",
];
PARTS["star"] = { grid: STAR_GRID };
/** The same, set down: just the star. */
PARTS["starLying"] = { grid: STAR_GRID.slice(7) };

PARTS["shadow"] = (() => {
  const cv = canvas(40, 3);
  ellipse(cv, 20, 1.5, 20, 1.5, "z");
  return { grid: toGrid(cv), outline: false };
})();
PARTS["stool"] = {
  grid: [
    "1111111111111111111111",
    "2222222222222222222222",
    "3333333333333333333333",
    "..23..............23..",
    "..23..............23..",
    "..23333333333333333...",
    "..23..............23..",
    "..23..............23..",
    "..23..............23..",
    "..23..............23..",
  ],
};

// ---- Poses.

type LegKey = "nh" | "fh" | "ff" | "nf";
export interface Pose {
  mood?: Mood;
  /** The whole upper body down this many pixels (a breath, a crouch); the feet stay. */
  bob?: number;
  /** The head on the neck. */
  hx?: number;
  hy?: number;
  dx?: number;
  /** Off the ground. */
  air?: number;
  /** Feet: sideways shift and lift off the ground, per leg. */
  feet?: Partial<Record<LegKey, { x?: number; lift?: number }>>;
  tail?: number;
  ear?: EarState;
  earN?: EarState;
  earF?: EarState;
  /** The star's swing (-2 to 2 pixels) and how brightly it twinkles (0 to 3). */
  star?: number;
  glow?: 0 | 1 | 2 | 3;
  dim?: boolean;
  sit?: boolean;
  /** Flopped on its belly (defeat). */
  lie?: boolean;
  noShadow?: boolean;
}

/** Where each leg's left column is, standing. */
const LEG_X: Record<LegKey, number> = { nh: 12, fh: 17, ff: 28, nf: 33 };

// ---- Sitting: on a stool, like a kid: the body tipped up, the thighs along the seat and the shins hanging, the forelegs dangling.

const SIT_TILT = (32 * Math.PI) / 180;
const SCX = 25;
const SCY = 37;
const suv = (x: number, y: number): Pt => [(x - SCX) * Math.cos(SIT_TILT) - (y - SCY) * Math.sin(SIT_TILT), (x - SCX) * Math.sin(SIT_TILT) + (y - SCY) * Math.cos(SIT_TILT)];
function sitTorso(): Painted {
  const cv = canvas(W, H);
  const body: Inside = (x, y) => {
    const [u, v] = suv(x, y);
    return (u / 12.5) ** 2 + (v / 7.5) ** 2 <= 1;
  };
  const neck = ell(34, 31, 4.5, 4.5);
  const light = roundL(23, 33, 15, 11, 0.12);
  const pa = patch(-5, -2, 6, 4.4, 1.3);
  const pb = patch(5.5, 3.5, 3.2, 2.8, 2.7);
  const pc = patch(10, -3.5, 2.4, 2.4, 4.1);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!body(x, y) && !neck(x, y)) continue;
      const [u, v] = suv(x, y);
      cv[y]![x] = pa(u, v) || pb(u, v) || pc(u, v) ? ramp(BROWN, light(x, y) + 0.05) : ramp(CREAM, light(x, y) + 0.12);
    }
  return crop(cv);
}
const SIT_TORSO = painted("sitTorso", sitTorso);

/** A hanging limb painted through points, with its hoof drawn at the last one. */
function limb(pts: readonly Pt[], r: readonly number[], near: boolean): Painted & { name: string } {
  return painted(`limb:${near ? "n" : "f"}:${pts.map((p) => p.join(",")).join(";")}`, () => strokes([{ pts, r, key: (l) => (near ? ramp(CREAM, l + 0.1) : ramp(CREAM, l - 0.12)) }]));
}

function buildSit(p: Pose): { layers: Layer[]; star: Pt } {
  const bob = p.bob ?? 0;
  const dx = p.dx ?? 0;
  const layers: Layer[] = [];
  const add = (l: { name: string; at: Pt }, ox = 0, oy = 0) => layers.push({ part: l.name, x: l.at[0] + ox, y: l.at[1] + oy });
  const put = (part: string, x: number, y: number) => layers.push({ part, x, y });
  const fx = (k: LegKey) => p.feet?.[k]?.x ?? 0;
  const fl = (k: LegKey) => p.feet?.[k]?.lift ?? 0;
  put("shadow", 9 + dx, GROUND - 2);
  put("stool", 8 + dx, 47);
  add(tailPart(p.tail ?? 0, 0, 5, 14, 41 + bob), dx);
  // A hanging leg: hip, knee, ankle; the hoof under the ankle.
  const hang = (hip: Pt, knee: Pt, ankle: Pt, near: boolean, w: number) => {
    const h: Pt = [hip[0] + dx, hip[1] + bob];
    const k: Pt = [knee[0] + dx, knee[1] + bob * 0.5];
    const a: Pt = [ankle[0] + dx, ankle[1]];
    add(limb([h, k, [a[0], a[1] - 1]], [w, w - 0.3, 2.0], near));
    put("hoof", Math.round(a[0] - 1.5), Math.round(a[1]));
  };
  // Far legs, behind the body.
  hang([18, 42], [26, 45], [29 + fx("fh"), 52 - fl("fh")], false, 2.5);
  hang([33, 38], [34, 43], [35 + fx("ff"), 49 - fl("ff")], false, 2.0);
  add(SIT_TORSO, dx, bob);
  // Near legs in front.
  hang([15, 42.5], [24, 45.5], [25.5 + fx("nh"), 54 - fl("nh")], true, 3.3);
  hang([36, 39], [37, 43.5], [38 + fx("nf"), 50 - fl("nf")], true, 2.0);
  const sw = p.star ?? 0;
  const sx = 40 + sw + dx;
  const sy = 30 + bob + (p.hy ?? 0);
  put("star", sx, sy);
  const star: Pt = [sx + 4, sy + 12];
  const hx = (p.hx ?? 0) + dx + 1;
  const hy = (p.hy ?? 0) + bob - 10;
  add(earPart(1, p.earF ?? p.ear ?? "mid"), hx, hy);
  add(earPart(-1, p.earN ?? p.ear ?? "mid"), hx, hy);
  put(`head:${p.mood ?? "calm"}`, HX0 + hx, HY0 + hy);
  return { layers, star };
}

function build(p: Pose): { layers: Layer[]; star: Pt } {
  return p.sit ? buildSit(p) : buildStand(p);
}

function buildStand(p: Pose): { layers: Layer[]; star: Pt } {
  const air = p.air ?? 0;
  const bob = p.bob ?? 0;
  const lie = p.lie ?? false;
  const dx = (p.dx ?? 0) + (lie ? -1 : 0);
  const uy = bob - air - 1 + (lie ? 8 : 0);
  const layers: Layer[] = [];
  const add = (l: { name: string; at: Pt }, ox = 0, oy = 0) => layers.push({ part: l.name, x: l.at[0] + ox, y: l.at[1] + oy });
  const put = (part: string, x: number, y: number) => layers.push({ part, x, y });
  if (!p.noShadow) put("shadow", 9 + dx, GROUND - 2);

  // The tail.
  add(tailPart(p.tail ?? 0, uy, lie ? -3 : 0), dx);

  // Legs, behind the body.
  const foot = (k: LegKey): Pt => {
    const ox = LEG_X[k] + (p.feet?.[k]?.x ?? 0) + dx;
    const ay = 59 - air - (p.feet?.[k]?.lift ?? 0);
    return [ox, ay];
  };
  const leg = (k: LegKey, near: boolean) => {
    const [ox, ay] = foot(k);
    const hip: Pt = [ox + 1.5, 49 + uy];
    const ankle: Pt = [ox + 1.5, ay - 1];
    const out = (k === "ff" || k === "nf" ? 1 : -1) * 0.5;
    const knee: Pt = [Math.round((hip[0] + ankle[0]) / 2 + out) + 0.5, Math.round((hip[1] + ankle[1]) / 2)];
    add(legPart(hip, knee, ankle, near));
    put("hoof", ox, ay);
  };
  if (lie) {
    // Hind hooves tucked out behind; the forelegs under the head.
    add(legPart([14.5 + dx, 55], [12.5 + dx, 57], [10.5 + dx, 57], false));
    put("hoof", 8 + dx, 57);
  } else {
    leg("fh", false);
    leg("ff", false);
    leg("nh", true);
    leg("nf", true);
  }

  add(BODY_PART, dx, uy);

  // The star on its ribbon, hanging from the chest.
  const sw = p.star ?? 0;
  let star: Pt;
  if (lie) {
    star = [55 + dx, 55];
    put("starLying", star[0] - 3, star[1] - 3);
  } else {
    const sx = 37 + sw + dx;
    const sy = 40 + uy + (Math.abs(sw) >= 2 ? -1 : 0);
    put("star", sx, sy);
    star = [sx + 4, sy + 12];
  }

  // Ears behind the head, then the head.
  const hx = (p.hx ?? 0) + dx;
  const hy = (p.hy ?? 0) + uy + (lie ? 8 : 0);
  add(earPart(1, p.earF ?? p.ear ?? "mid"), hx, hy);
  add(earPart(-1, p.earN ?? p.ear ?? "mid"), hx, hy);
  put(`head:${p.mood ?? "calm"}`, HX0 + hx, HY0 + hy);
  return { layers, star };
}

// ---- Specks: twinkles, dust, sweat, thoughts.

/** A four-point sparkle: white at its heart; `big` reaches two pixels. */
const sparkle = (x: number, y: number, big = false): Speck[] => [
  [x, y, "w"], [x - 1, y, "P"], [x + 1, y, "P"], [x, y - 1, "P"], [x, y + 1, "P"],
  ...(big ? ([[x - 2, y, "O"], [x + 2, y, "O"], [x, y - 2, "O"], [x, y + 2, "O"]] as Speck[]) : []),
];
/** Twinkles scattered round the figure, a new set per `t`. */
function twinkles(t: number, n = 3, box: readonly [number, number, number, number] = [5, 8, 58, 44]): Speck[] {
  let s = (t * 2654435761 + 12345) >>> 0 || 1;
  const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) >>> 8) / 16777216;
  return Array.from({ length: n }, (_, i) => sparkle(Math.round(box[0] + rnd() * (box[2] - box[0])), Math.round(box[1] + rnd() * (box[3] - box[1])), (i + t) % 2 === 0)).flat();
}
/** Dust puffing out along the ground at the feet. */
const dust = (t: number): Speck[] =>
  [-1, 1].flatMap((side) =>
    [0, 1, 2].map((i): Speck => [Math.round(31 + side * (13 + i * 3 + t * 2)), GROUND - 2 - (i % 2) - (t > 0 ? 1 : 0), t > 1 ? "y" : "t"]),
  );
/** The shadow on the ground, growing as it drops in. */
const dropShadow = (r: number): Speck[] => Array.from({ length: r * 2 + 1 }, (_, i): Speck => [30 - r + i, GROUND - 2, "z"]);
/** Stamps rows of palette keys as specks (a cloud, a drop) with their top-left at (x, y). */
const speckRows = (rows: readonly string[], x: number, y: number): Speck[] =>
  rows.flatMap((row, j) => [...row].flatMap((k, i): Speck[] => (k === "." ? [] : [[x + i, y + j, k]])));
/** Thought bubbles up and to the right of the head: a dot, a bigger dot, then a little cloud. */
const thoughts = (n: number): Speck[] => [
  ...(n >= 1 ? speckRows(["ww", "EE"], 53, 19) : []),
  ...(n >= 2 ? speckRows([".w.", "www", "wEw", ".E."], 55, 13) : []),
  ...(n >= 3
    ? [
        ...speckRows(["....wwwww....", "..wwwwwwwww..", ".wwwwwwwwwww.", "wwwwwwwwwwwww", "wwwwwwwwwwwww", "wwwwwwwwwwwwE", ".wwwwwwwwwwE.", "..EEEEEEEEE..", "....EEEEE...."], 48, 1),
        // A pawn in it: a piece on its mind.
        ...speckRows([".ccc.", ".cdc.", "..c..", ".ccc.", "ccccc"], 52, 3),
      ]
    : []),
];
/** A drop of sweat, its top-left at (x, y). */
const drop = (x: number, y: number): Speck[] => speckRows([".j.", "jjj", "jwj", ".j."], x, y);
/** Sweat flying off the head, both ways. */
const sweat = (i: number): Speck[] => {
  const t = i % 4;
  return [...drop(22 - t, 24 + t * 2), ...drop(57 + (t % 2), 20 + t * 2)];
};
/** Falling confetti: little two-pixel pieces drifting down, a new set of places per `t`. */
function confetti(t: number, n = 10): Speck[] {
  const keys = ["N", "q", "j", "g", "w"];
  return Array.from({ length: n }, (_, i): Speck[] => {
    const x = ((i * 17 + 5) % 54) + 5;
    const y = ((i * 11 + t * 4) % 36) + 4;
    return (i + t) % 2 ? [[x, y, keys[i % 5]!], [x + 1, y, keys[i % 5]!]] : [[x, y, keys[i % 5]!], [x, y + 1, keys[i % 5]!]];
  }).flat();
}
/** A big twinkle: a white heart and arms three pixels long. */
const glint = (x: number, y: number): Speck[] => [
  [x, y, "w"], [x - 1, y, "w"], [x + 1, y, "w"], [x, y - 1, "w"], [x, y + 1, "w"],
  [x - 2, y, "P"], [x + 2, y, "P"], [x, y - 2, "P"], [x, y + 2, "P"],
  [x - 3, y, "O"], [x + 3, y, "O"], [x, y - 3, "O"], [x, y + 3, "O"],
];

/** The star's yellow as it twinkles (levels 1 to 3), and dimmed (defeat). */
const STAR_BRIGHT: readonly Record<string, string>[] = [
  {},
  { M: "#eab22f", N: "#ffd24d", O: "#ffe37e", P: "#fff6bd" },
  { M: "#f4c443", N: "#ffe266", O: "#fff09a", P: "#fffbd8", Q: "#e09a24" },
  { M: "#ffd65e", N: "#ffec80", O: "#fff6b4", P: "#ffffee", Q: "#f0a82a" },
];
const STAR_DIM: Record<string, string> = { M: "#8f7a3c", N: "#a8924a", O: "#bba35a", P: "#cdb872", Q: "#6e5a2a" };

/** A hit: every color goes pale. */
const FLASH: Record<string, string> = Object.fromEntries(
  Object.entries(SIDEKICK_MOO_PALETTE)
    .filter(([k]) => "CDEFabcdpqrsMNOPRS".includes(k))
    .map(([k, c]) => {
      const n = parseInt(c.slice(1), 16);
      const mix = (v: number) => Math.round(v + (255 - v) * 0.55).toString(16).padStart(2, "0");
      return [k, `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`];
    }),
);

/** One frame: the pose, the star's twinkle and anything extra. */
function f(ms: number, p: Pose, extra: Partial<Frame> = {}): Frame {
  const b = build(p);
  const g = p.glow ?? 0;
  const twinkle: Speck[] = g === 3 ? [...glint(b.star[0] + 5, b.star[1] - 5), ...sparkle(b.star[0] - 6, b.star[1] + 3)] : g === 2 ? sparkle(b.star[0] + 4, b.star[1] - 4) : [];
  const specks = [...twinkle, ...(extra.specks ?? [])].filter(([x, y]) => x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2);
  const pal = { ...(g ? STAR_BRIGHT[g] : {}), ...(p.dim ? STAR_DIM : {}), ...(extra.pal ?? {}) };
  const { pal: _pal, specks: _specks, ...rest } = extra;
  return { ms, layers: b.layers, ...rest, ...(Object.keys(pal).length ? { pal } : {}), specks };
}

// ---- Animations.

const TAU = Math.PI * 2;
const rnd = Math.round;

/** Idle (3 s): breathes, sways, blinks, flicks an ear and its tail; the star swings and twinkles now and then. */
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 30 }, (_, i) => {
    const bob = i % 15 >= 8 ? 1 : 0;
    const blink = i === 11 || i === 12 || i === 27;
    const earN: EarState = i === 20 || i === 21 ? "down" : "mid";
    const earF: EarState = i === 6 ? "up" : "mid";
    const tail = i >= 4 && i <= 8 ? (i % 2 ? 3 : 1) : i >= 22 && i <= 24 ? -2 : 0;
    const hx = i >= 24 ? 1 : 0;
    const glow = ([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 2, 1][i] ?? 0) as 0 | 1 | 2 | 3;
    return f(100, { bob, mood: blink ? "blink" : "calm", earN, earF, tail, hx, star: rnd(1.1 * Math.sin((TAU * i) / 15)), glow });
  }),
};

/** Walk (0.6 s): a wobbly little trot, head bobbing, the star swinging. */
const walk: Anim = {
  loop: true,
  frames: Array.from({ length: 6 }, (_, i) => {
    const th = (i / 6) * TAU;
    const leg = (off: number) => ({ x: rnd(3 * Math.sin(th + off * TAU)), lift: Math.max(0, rnd(3 * Math.cos(th + off * TAU))) });
    const down = i % 3 === 0;
    return f(100, { bob: down ? 0 : 1, hy: down ? 0 : -1, hx: down ? 0 : 1, mood: "calm", feet: { nh: leg(0), ff: leg(0), fh: leg(0.5), nf: leg(0.5) }, tail: i < 3 ? 1 : -1, ear: down ? "mid" : "down", star: [-1, 0, 1, 2, 1, 0][i]! }, down ? { cue: "step" } : {});
  }),
};

/** Sit (loops): on a stool at the chess table, facing the board, legs dangling; blinks and thinks about a move. */
const sit: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) => {
    const lean = i >= 6 && i <= 11;
    const blink = i === 3 || i === 4 || i === 13;
    const sw = i % 8 < 4 ? 0 : 1;
    const feet = { nh: { x: sw }, fh: { x: -sw + 1 }, ff: { x: 1 - sw }, nf: { x: sw } };
    return f(200, { sit: true, mood: blink ? (lean ? "thinkBlink" : "blink") : lean ? "think" : "calm", bob: i % 8 >= 4 ? 1 : 0, hx: lean ? 2 : 1, hy: lean ? 1 : 0, earF: i === 9 ? "down" : "mid", earN: "mid", tail: sw, feet, star: i % 8 < 4 ? 0 : 1, glow: i === 14 ? 1 : i === 15 ? 2 : 0 });
  }),
};

/** Wave (once, 1.2 s): lifts its head and the star twinkles brightly; a happy hello, then it settles. */
const wave: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 1, mood: "calm", hy: 0, star: 0 }),
    f(100, { mood: "cheer", hy: -1, hx: 1, ear: "up", glow: 1, star: -1 }, { cue: "twinkle" }),
    f(100, { mood: "happy", hy: -2, hx: 1, air: 1, ear: "up", glow: 2, star: 1, tail: 2 }, { specks: sparkle(12, 30) }),
    f(100, { mood: "happy", hy: -2, hx: 1, ear: "mid", glow: 3, star: -1, tail: -1 }),
    f(100, { bob: 1, mood: "cheer", hy: -1, hx: 1, ear: "down", glow: 3, star: 1, tail: 2 }, { specks: sparkle(50, 12, true) }),
    f(100, { mood: "happy", hy: -2, hx: 1, air: 1, ear: "up", glow: 3, star: -1, tail: -1 }),
    f(100, { bob: 1, mood: "happy", hy: -2, hx: 1, ear: "mid", glow: 2, star: 1, tail: 2 }, { specks: sparkle(9, 22) }),
    f(100, { mood: "cheer", hy: -1, hx: 1, ear: "up", glow: 3, star: 0, tail: 1 }),
    f(100, { bob: 1, mood: "happy", hx: 1, ear: "mid", glow: 2, star: 1 }),
    f(100, { mood: "happy", hx: 0, glow: 1, star: -1 }),
    f(100, { mood: "calm", glow: 0, star: 0 }),
    f(100, { bob: 1, mood: "calm" }),
  ],
};

/** Entrance: drops in from above on its shadow, lands with a squash and a puff of dust, then lifts its head: the star twinkles. */
const entrance: Anim = {
  loop: false,
  frames: [
    { ms: 90, layers: [], specks: dropShadow(5) },
    { ms: 80, layers: [], specks: dropShadow(10) },
    f(70, { air: 14, mood: "cheer", ear: "up", feet: { nh: { lift: 2 }, fh: { lift: 3 }, ff: { lift: 2 }, nf: { lift: 3 } }, star: 2, tail: 2 }, { specks: dropShadow(14) }),
    f(70, { air: 6, mood: "cheer", ear: "up", feet: { nh: { lift: 1 }, fh: { lift: 2 }, ff: { lift: 1 }, nf: { lift: 2 } }, star: 1, tail: 2 }),
    f(100, { bob: 3, mood: "blink", ear: "down", star: -1 }, { cue: "step", specks: dust(0) }),
    f(90, { bob: 1, mood: "happy", ear: "mid", star: 1 }, { specks: dust(1) }),
    f(110, { mood: "cheer", hy: -2, hx: 1, ear: "up", glow: 2, star: -1 }, { cue: "twinkle", specks: dust(2) }),
    f(110, { mood: "happy", hy: -2, hx: 1, ear: "up", glow: 3, star: 1, tail: 2 }, { specks: twinkles(1, 3) }),
    f(110, { mood: "happy", hy: -1, hx: 1, glow: 2, star: -1, tail: -1 }, { specks: twinkles(2, 2) }),
    f(120, { mood: "happy", glow: 1, star: 0 }),
    f(300, { mood: "calm" }),
  ],
};

/** Thinking (loops): head up, eyes rolled up, a hoof tapping, chewing, thought dots popping up. */
const thinking: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) =>
    f(150, { mood: i === 8 ? "thinkBlink" : "think", hx: 2, hy: -1, bob: i % 6 >= 3 ? 1 : 0, feet: { ff: i % 4 === 1 ? { lift: 2 } : {} }, tail: i % 6 < 3 ? 1 : 0, earF: i === 5 ? "down" : "mid", star: i % 6 < 3 ? 0 : 1 }, { specks: thoughts(i % 6 < 1 ? 0 : i % 6 < 3 ? 1 : i % 6 < 5 ? 2 : 3) }),
  ),
};

/** Its move: a little hop toward the board and a happy nod. */
const move: Anim = {
  loop: false,
  frames: [
    f(90, { bob: 2, mood: "bold", ear: "down", star: -1 }),
    f(80, { air: 4, dx: 1, mood: "bold", feet: { nh: { lift: 2 }, fh: { lift: 3 }, ff: { lift: 2 }, nf: { lift: 3 } }, ear: "up", hx: 1, star: 2, tail: 2 }),
    f(80, { air: 5, dx: 2, mood: "bold", feet: { nh: { lift: 2 }, fh: { lift: 2 }, ff: { lift: 2 }, nf: { lift: 2 } }, hx: 2, hy: -1, star: 2 }),
    f(100, { bob: 2, dx: 2, mood: "happy", ear: "down", hx: 1, hy: 1, star: -1 }, { specks: dust(0) }),
    f(100, { bob: 1, dx: 2, mood: "happy", hx: 1, star: 1 }),
    f(110, { dx: 1, mood: "happy", star: 0 }),
    f(150, { mood: "calm" }),
  ],
};

/** A capture: two excited hops, the star twinkling, sparkles everywhere. */
const capture: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 2, mood: "bold", ear: "down", star: -1 }),
    f(80, { air: 6, mood: "cheer", ear: "up", feet: { nh: { lift: 2 }, fh: { lift: 3 }, ff: { lift: 2 }, nf: { lift: 3 } }, hy: -1, glow: 1, star: 2, tail: 2 }, { cue: "twinkle", specks: twinkles(1) }),
    f(80, { air: 8, mood: "happy", ear: "up", feet: { nh: { lift: 3 }, fh: { lift: 3 }, ff: { lift: 3 }, nf: { lift: 3 } }, hy: -2, glow: 2, star: -2 }, { specks: twinkles(2) }),
    f(80, { air: 5, mood: "happy", ear: "mid", glow: 3, star: 2, tail: -1 }, { specks: twinkles(3) }),
    f(80, { bob: 2, mood: "cheer", ear: "down", glow: 2, star: -1 }, { specks: dust(0) }),
    f(80, { air: 7, mood: "happy", ear: "up", feet: { nh: { lift: 2 }, fh: { lift: 2 }, ff: { lift: 3 }, nf: { lift: 3 } }, glow: 3, star: 2, tail: 2 }, { specks: twinkles(4) }),
    f(80, { air: 8, mood: "happy", ear: "up", feet: { nh: { lift: 3 }, fh: { lift: 3 }, ff: { lift: 3 }, nf: { lift: 3 } }, hy: -2, glow: 3, star: -2 }, { specks: twinkles(5) }),
    f(80, { air: 4, mood: "happy", ear: "mid", glow: 2, star: 1 }, { specks: twinkles(6) }),
    f(90, { bob: 2, mood: "cheer", ear: "down", glow: 1, star: -1 }, { specks: dust(1) }),
    f(120, { bob: 1, mood: "happy", star: 1 }),
    f(160, { mood: "smug", star: 0 }),
  ],
};

/** Hurt: hit, a flash, eyes screwed shut, the star flung; then it shakes it off with a brave little grin. */
const hurt: Anim = {
  loop: false,
  frames: [
    f(70, { bob: 2, mood: "hurt", ear: "flat", star: 2, hx: -1 }, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    f(80, { bob: 3, mood: "hurt", ear: "flat", star: -2, hx: -1 }, { shake: [-1, 0], specks: sweat(0) }),
    f(90, { bob: 2, dx: -1, mood: "hurt", ear: "down", star: 1 }, { specks: sweat(1) }),
    f(100, { bob: 1, dx: -1, mood: "rattled", ear: "down", star: -1 }),
    f(110, { mood: "blink", star: 1 }),
    f(120, { mood: "bold", hy: -1, star: 0 }),
    f(160, { mood: "calm" }),
  ],
};

/** Check: two sharp jabs of its snout at the board, eyes bright, the star flaring. */
const check: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 1, mood: "bold", ear: "up", star: -1 }),
    f(110, { bob: 2, dx: 1, mood: "bold", hx: 3, hy: 1, glow: 3, star: 2 }, { cue: "twinkle" }),
    f(90, { bob: 1, mood: "bold", hx: 1, glow: 2, star: -1 }),
    f(110, { bob: 2, dx: 1, mood: "bold", hx: 3, hy: 1, glow: 3, star: 2 }, { cue: "twinkle" }),
    f(90, { bob: 1, dx: 1, mood: "bold", hx: 2, glow: 2, star: 0 }),
    f(150, { dx: 1, mood: "happy", glow: 1, star: -1 }),
    f(160, { mood: "smug", star: 0 }),
  ],
};

/** Smug: chin up, eyes half shut, a little smirk, a slow nod; the star glints once. */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(150, { mood: "smug", hy: i < 3 || i > 5 ? -1 : 0, hx: i < 4 ? 0 : 1, bob: i % 4 === 2 ? 1 : 0, earF: i === 5 ? "up" : "mid", star: i % 4 === 1 ? 1 : 0, glow: i === 6 ? 1 : i === 7 ? 2 : 0 })),
};

/** Rattled: wide eyes, worried brows, sweat flying, trembling where it stands; the star jiggles. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(80, { mood: "rattled", dx: i % 2 ? 1 : -1, bob: i % 4 === 2 ? 1 : 0, ear: "down", tail: i % 2 ? 1 : -1, star: i % 2 ? 2 : -2 }, { specks: sweat(i) })),
};

/** Defeat: hit, dizzy eyes, then it flops onto its belly and lies there, the star set down beside it (the last frame holds). */
const defeat: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 2, mood: "hurt", ear: "flat", star: 2 }, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    f(90, { bob: 2, dx: -1, mood: "out", ear: "down", star: -2 }),
    f(110, { bob: 4, dx: 1, mood: "out", ear: "down", hy: 1, star: 1, feet: { nh: { x: -1 }, fh: { x: -2 }, ff: { x: 2 }, nf: { x: 3 } } }),
    f(110, { bob: 6, mood: "out", ear: "down", hy: 2, star: -1, feet: { nh: { x: -2 }, fh: { x: -3 }, ff: { x: 3 }, nf: { x: 4 } } }),
    f(120, { lie: true, mood: "out", ear: "flat", dim: true }, { cue: "poof", specks: dust(0) }),
    f(160, { lie: true, mood: "out", ear: "flat", dim: true, tail: 1 }, { specks: sparkle(40, 22) }),
    f(200, { lie: true, mood: "out", ear: "flat", dim: true }),
    f(1000, { lie: true, mood: "out", ear: "flat", dim: true, tail: 1 }),
  ],
};

/** Victory: jumping for joy, the star twinkling, confetti popping all round. Then again. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const air = [0, 3, 6, 8, 6, 3, 0, 0, 3, 6, 3, 0][i]!;
    return f(110, { bob: i === 0 || i === 6 || i === 7 ? 2 : 0, air, mood: air > 2 ? "happy" : "cheer", feet: air > 2 ? { nh: { lift: 2 }, fh: { lift: 3 }, ff: { lift: 3 }, nf: { lift: 2 } } : {}, hy: i % 2 ? -1 : 0, ear: air > 3 ? "up" : "mid", tail: i % 2 ? 2 : -1, star: i % 2 ? 2 : -2, glow: ([1, 2, 3, 3, 3, 2, 1, 1, 2, 3, 2, 1][i] ?? 0) as 0 | 1 | 2 | 3 }, { specks: [...confetti(i), ...(i % 3 === 0 ? twinkles(i, 1) : [])], cue: i === 2 ? "twinkle" : undefined });
  }),
};

export const sidekickMoo: Character = {
  id: "sidekick-moo",
  name: "Moo's sidekick",
  w: W,
  h: H,
  foot: [31, GROUND],
  palette: SIDEKICK_MOO_PALETTE,
  halo: "#2c2624",
  parts: PARTS,
  anims: { idle, walk, sit, wave, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory },
};
