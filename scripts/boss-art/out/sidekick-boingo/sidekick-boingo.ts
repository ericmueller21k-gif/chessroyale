/**
 * Boingo's sidekick (id "sidekick-boingo"): a little clown kid, a town bot that wanders the square and plays chess at
 * the park's tables. No powers, never fights: a cheerful, mischievous kid who copies the big guy's act.
 *
 * Softer and rounder than Boingo: a big round peach head with big friendly eyes, a red ball nose that sticks out past
 * its cheek, rosy cheeks and a small smile; a tiny purple cone hat with a gold pompom and curly red tufts either side;
 * a short round baggy suit (purple with red polka dots, a white ruff, red bloomers with frilly cuffs) and big floppy
 * orange shoes. His colors, a pompom or two, and a big gold SQUIRTING FLOWER pinned at its collar that gives a little
 * arc of water now and then. No pogo stick: it walks. Three-quarters, facing our right, light from the top left.
 *
 * About 41 pixels tall (Boingo is 64 on his pogo). Rigging: the head (one per face), nose, hat, pompom and hair tufts
 * are parts moved by numbers; the legs and arms are painted from points (hip, knee, ankle / shoulder, elbow, hand) so a
 * new pose is a handful of numbers; the water is specks along a parabola from the flower's middle.
 */
import { canvas, ellipse, inEllipse, roundLight, shade, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../../../packages/app/src/characters/sprite.ts";

export const SIDEKICK_PALETTE = {
  k: "#150c11", // outline (Boingo's)
  h: "#ffe9d6", // peach skin, highlight to shadow
  f: "#f8cfae",
  F: "#e2a584",
  a: "#b87561",
  c: "#f08a82", // rosy cheeks
  r: "#e2343b", // Boingo's red: hair, nose, bloomers
  R: "#a3202b",
  q: "#5c1521",
  t: "#f2686c", // light red
  E: "#ffe3d6", // glint
  p: "#7d3b93", // Boingo's purple: hat, suit
  P: "#4b2161",
  v: "#a35fb9",
  y: "#f2c14e", // Boingo's gold: pompoms, flower
  Y: "#b58430",
  H: "#ffe58f",
  w: "#f6f1ea", // white: eyes, gloves, ruff
  W: "#d8cbc6",
  X: "#a39294",
  o: "#cf8038", // shoes
  O: "#7c4421",
  e: "#e9a45c",
  s: "#24120a", // pupil
  n: "#7a4019", // iris
  m: "#69190e", // mouth
  T: "#f28f80", // tongue
  b: "#4fb4f7", // water
  B: "#e4f7ff",
  g: "#62d06a", // confetti, the flower's leaf
  G: "#2f9a47",
  u: "#4aa3ff",
  j: "#c98f4e", // stool wood
  J: "#a06a33",
  K: "#6c4222",
  z: "#0d0e12", // ground shadow
} as const;

type Pt = readonly [number, number];

const W = 56;
const H = 55;
/** The first row below the shoes. */
const G = 52;
/** The torso's left edge at rest. */
const TX = 13;

const PARTS: Record<string, Part> = {};

// ---- Faces.

export type Mood = "calm" | "blink" | "happy" | "cheer" | "laugh" | "think" | "thinkBlink" | "smug" | "rattled" | "hurt" | "out" | "bold";
type Eye = "open" | "up" | "wide" | "half" | "arc" | "shut" | "pinch" | "x";
type Brow = "up" | "worried" | "bold" | "smug";
type Mouth = "smile" | "grin" | "laugh" | "flat" | "smirk" | "frown" | "o" | "tongue";

/** The near eye (6 x 6, on our left) and the far one (5 x 5, by the nose): a brown iris, a dark pupil, a glint. */
const NEAR_EYE: Record<Eye, readonly string[]> = {
  open: [".kkkk.", "kwnnwk", "knwsnk", "knssnk", "kwnnwk", ".kkkk."],
  up: [".kkkk.", "knwsnk", "knssnk", "kwnnwk", "kwwwwk", ".kkkk."],
  wide: [".kkkk.", "kwwwwk", "kwsswk", "kwsswk", "kwwwwk", ".kkkk."],
  half: ["......", "kkkkkk", "knssnk", "kwnnwk", ".kkkk.", "......"],
  arc: ["......", "......", ".kkkk.", "k....k", "......", "......"],
  shut: ["......", "......", "......", "k....k", ".kkkk.", "......"],
  pinch: ["......", "kk....", ".kkk..", "...kkk", ".kkk..", "kk...."],
  x: ["......", "k...k.", ".k.k..", "..k...", ".k.k..", "k...k."],
};
const FAR_EYE: Record<Eye, readonly string[]> = {
  open: [".kkk.", "knwsk", "knssk", "kwnnk", ".kkk."],
  up: [".kkk.", "knssk", "kwnnk", "kwwwk", ".kkk."],
  wide: [".kkk.", "kwwwk", "kwssk", "kwwwk", ".kkk."],
  half: [".....", "kkkkk", "knssk", ".kkk.", "....."],
  arc: [".....", ".kkk.", "k...k", ".....", "....."],
  shut: [".....", ".....", "k...k", ".kkk.", "....."],
  pinch: [".....", "...kk", "..kk.", ".kk..", "..kk."],
  x: [".....", ".k.k.", "..k..", ".k.k.", "....."],
};
const BROWS: Record<Brow, readonly [readonly Pt[], readonly Pt[]]> = {
  up: [[[3, 2], [4, 2], [5, 2], [6, 2]], [[11, 2], [12, 2], [13, 2]]],
  worried: [[[2, 3], [3, 3], [4, 2], [5, 2], [6, 2]], [[10, 2], [11, 2], [12, 2], [13, 3], [14, 3]]],
  bold: [[[2, 2], [3, 2], [4, 2], [5, 3], [6, 3]], [[10, 3], [11, 3], [12, 2], [13, 2], [14, 2]]],
  smug: [[[2, 3], [3, 3], [4, 3], [5, 3]], [[10, 2], [11, 2], [12, 2], [13, 2]]],
};
const MOUTHS: Record<Mouth, { rows: readonly string[]; x: number; y: number }> = {
  smile: { rows: ["k....k", ".kkkk."], x: 7, y: 11 },
  grin: { rows: ["kkkkkk", "kmmmmk", ".kTTk."], x: 7, y: 11 },
  laugh: { rows: ["kkkkkkkk", "kmmmmmmk", ".kkTTkk."], x: 6, y: 11 },
  flat: { rows: ["kkkk"], x: 8, y: 12 },
  smirk: { rows: ["....kk", "kkkk.."], x: 7, y: 11 },
  frown: { rows: [".kkkk.", "k....k"], x: 7, y: 12 },
  o: { rows: [".kk.", "kmmk", ".kk."], x: 8, y: 11 },
  tongue: { rows: ["kkkkkk", "kmmTTk", "..kTTk"], x: 7, y: 11 },
};
const FACES: Record<Mood, { near: Eye; far: Eye; brow?: Brow; mouth: Mouth; blush?: boolean }> = {
  calm: { near: "open", far: "open", mouth: "smile", blush: true },
  blink: { near: "shut", far: "shut", mouth: "smile", blush: true },
  happy: { near: "arc", far: "arc", mouth: "grin", blush: true },
  cheer: { near: "open", far: "open", brow: "up", mouth: "grin", blush: true },
  laugh: { near: "arc", far: "arc", mouth: "laugh", blush: true },
  think: { near: "up", far: "up", brow: "up", mouth: "flat" },
  thinkBlink: { near: "shut", far: "shut", brow: "up", mouth: "flat" },
  smug: { near: "half", far: "half", brow: "smug", mouth: "smirk", blush: true },
  rattled: { near: "wide", far: "wide", brow: "worried", mouth: "frown" },
  hurt: { near: "pinch", far: "pinch", brow: "worried", mouth: "o" },
  out: { near: "x", far: "x", mouth: "tongue" },
  bold: { near: "open", far: "open", brow: "bold", mouth: "grin", blush: true },
};

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

const HW = 20;
const HHT = 14;
function head(mood: Mood): Part {
  const cv = canvas(HW, HHT);
  shade(cv, inEllipse(9.5, 7, 9.6, 7.1), "aFfffh", roundLight(9.5, 7, 9.5, 7, 0.06));
  const face = FACES[mood];
  stamp(cv, NEAR_EYE[face.near], 2, 4);
  stamp(cv, FAR_EYE[face.far], 10, 4);
  if (face.blush) dots(cv, [[3, 10], [4, 10], [2, 11], [3, 11], [4, 11], [5, 11]], "c");
  if (face.brow) for (const side of BROWS[face.brow]) dots(cv, side, "q");
  const m = MOUTHS[face.mouth];
  stamp(cv, m.rows, m.x, m.y);
  return { grid: toGrid(cv) };
}
for (const m of Object.keys(FACES) as Mood[]) PARTS[`head:${m}`] = head(m);

/** The red ball nose: a part of its own, so it sticks out past the cheek and gets its own outline. */
PARTS["nose"] = (() => {
  const cv = canvas(5, 5);
  shade(cv, inEllipse(2.5, 2.5, 2.6, 2.6), "RRrrt", roundLight(2.5, 2.5, 2.5, 2.5, 0.1));
  dots(cv, [[1, 1], [2, 1]], "E");
  return { grid: toGrid(cv) };
})();

// ---- Hat, pompom, hair tufts.

PARTS["hat"] = {
  grid: [
    ".....pp....",
    "....vppP...",
    "...vppppP..",
    "..vpyppppP.",
    ".vppppppPPP",
    "rrrrrrrrrrr",
    "RRRRRRRRRRR",
  ],
};
PARTS["pom"] = { grid: [".HH.", "HyyY", "yyyY", ".YY."] };

/** The big curly tuft behind the head on our left. */
PARTS["hairL"] = (() => {
  const cv = canvas(8, 10);
  const inside = (x: number, y: number) => inEllipse(4, 3, 3.1, 2.9)(x, y) || inEllipse(2.8, 6.6, 2.8, 2.7)(x, y) || inEllipse(5.2, 5.4, 2.8, 2.8)(x, y);
  shade(cv, inside, "qRrrt", roundLight(4, 5.5, 4, 5.5, 0.08));
  dots(cv, [[3, 2], [4, 2], [5, 3], [4, 4], [1, 6], [2, 7], [3, 7], [2, 5]], "R");
  return { grid: toGrid(cv) };
})();
/** The far tuft, peeking out behind the top of the head on the right. */
PARTS["hairR"] = (() => {
  const cv = canvas(6, 6);
  shade(cv, (x, y) => inEllipse(3, 3, 2.9, 2.9)(x, y), "qRrrt", roundLight(3, 3, 2.9, 2.9, 0.06));
  dots(cv, [[2, 2], [3, 3], [2, 4], [1, 3]], "R");
  return { grid: toGrid(cv) };
})();

// ---- Body.

PARTS["ruff"] = { grid: [".wwwwwwwwwww.", "wwWwwWwwWwwWw", "WW.WW.WW.WW.W"] };

PARTS["torso"] = (() => {
  const cv = canvas(13, 7);
  shade(cv, (x, y) => inEllipse(6.5, 3.4, 6.6, 3.8)(x, y) || (y < 2 && x >= 2 && x <= 10), "PPpppv", roundLight(6.5, 3.5, 6.5, 3.5, 0.08));
  for (const [x, y] of [[1, 2], [2, 5], [10, 4]] as const) {
    dots(cv, [[x, y], [x + 1, y], [x, y + 1]], "r");
    dots(cv, [[x + 1, y + 1]], "R");
  }
  // Two gold pompom buttons down the front.
  stamp(cv, ["Hy", "yY"], 6, 1);
  stamp(cv, ["Hy", "yY"], 6, 4);
  return { grid: toGrid(cv) };
})();

PARTS["hips"] = (() => {
  const cv = canvas(14, 3);
  shade(cv, (x, y) => inEllipse(7, 1.5, 7.1, 1.6)(x, y), "RRrrt", roundLight(7, 1.5, 7, 1.5, 0.1));
  return { grid: toGrid(cv) };
})();

PARTS["cuff"] = { grid: ["wwwwww", "WwWwWw"] };
PARTS["cuffV"] = { grid: ["wW", "Ww", "wW", "Ww"] };

function shoe(near: boolean): Part {
  const cv = canvas(11, 4);
  shade(cv, inEllipse(5.5, 2.1, 5.6, 2.1), near ? "OOooee" : "OOOooo", roundLight(5.5, 2, 5.5, 2.1, 0.1));
  for (let x = 1; x < 10; x++) if (cv[3]![x] !== ".") cv[3]![x] = "O";
  return { grid: toGrid(cv) };
}
PARTS["shoeN"] = shoe(true);
PARTS["shoeF"] = shoe(false);

PARTS["glove"] = (() => {
  const cv = canvas(4, 4);
  shade(cv, inEllipse(2, 2, 2.1, 2.1), "XWwww", roundLight(2, 2, 2, 2, 0.12));
  return { grid: toGrid(cv) };
})();

/** The squirting flower in its hand: gold petals round a red heart; it can squirt (a blue heart) or wilt. */
function flower(kind: "n" | "spray" | "wilt"): Part {
  const cv = canvas(8, 8);
  if (kind === "wilt") {
    stamp(cv, ["..YY.Y..", ".YYYYYY.", "YYYYYYYY", "YYYrrYYY", ".YYrRYY.", "..YYYY..", "...YY...", "........"], 0, 0);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (cv[y]![x] === "Y" && (x + y) % 3 === 0) cv[y]![x] = "y";
    return { grid: toGrid(cv) };
  }
  // Six round petals round a red heart.
  for (let a = 0; a < 6; a++) {
    const ang = -Math.PI / 2 + (a * Math.PI) / 3;
    ellipse(cv, 4 + Math.cos(ang) * 2.5, 4 + Math.sin(ang) * 2.5, 1.7, 1.7, "y");
  }
  const base = cv.map((r) => [...r]);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      if (base[y]![x] !== "y") continue;
      const up = (base[y - 1]?.[x] ?? ".") === ".";
      const left = (base[y]?.[x - 1] ?? ".") === ".";
      const down = (base[y + 1]?.[x] ?? ".") === ".";
      const right = (base[y]?.[x + 1] ?? ".") === ".";
      if (up || left) cv[y]![x] = "H";
      else if (down || right) cv[y]![x] = "Y";
    }
  ellipse(cv, 4, 4, 1.5, 1.5, kind === "spray" ? "b" : "r");
  if (kind === "spray") dots(cv, [[3, 3]], "B");
  else dots(cv, [[4, 4], [3, 3]], "R");
  return { grid: toGrid(cv) };
}
/** A short green stem into the fist. */
PARTS["stem"] = { grid: ["gG.", "gGg", "gG.", "gG."] };
PARTS["flower"] = flower("n");
PARTS["flowerSpray"] = flower("spray");
PARTS["flowerWilt"] = flower("wilt");

PARTS["shadow"] = (() => {
  const cv = canvas(26, 3);
  ellipse(cv, 13, 1.5, 13, 1.5, "z");
  return { grid: toGrid(cv), outline: false };
})();
PARTS["shadowS"] = (() => {
  const cv = canvas(18, 3);
  ellipse(cv, 9, 1.5, 9, 1.5, "z");
  return { grid: toGrid(cv), outline: false };
})();

PARTS["stool"] = {
  grid: [
    "jjjjjjjjjjjjjjjjjj",
    "JJJJJJJJJJJJJJJJJJ",
    "KKKKKKKKKKKKKKKKKK",
    "..jJ.........jJ...",
    "..jJ.........jJ...",
    "..jJ.........jJ...",
    "..jJ.........jJ...",
    "..jJJJJJJJJJJJJJ..",
    "..jJ.........jJ...",
    "..jJ.........jJ...",
    "..jJ.........jJ...",
    "..jJ.........jJ...",
  ],
};

// ---- Painted limbs (legs and arms): a round stroke through points, three bands of light.

interface Painted {
  part: Part;
  at: Pt;
}
const PAINTED = new Map<string, Painted>();

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

/** A thick stroke through `pts` (pixel centers), `ramp` = dark, base, light. */
function limb(pts: readonly Pt[], r: number, ramp: string): { name: string; at: Pt } {
  const name = `limb:${ramp}:${r}:${pts.map((p) => p.join(",")).join(";")}`;
  let done = PAINTED.get(name);
  if (!done) {
    const cv = canvas(W, H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const n = nearest([x, y], pts);
        if (n.d > r) continue;
        const nd = n.d || 1;
        const u = ((-0.6 * n.nx - 0.8 * n.ny) / nd) * Math.min(1, (n.d + 0.4) / r);
        cv[y]![x] = u > 0.5 ? ramp[2]! : u < -0.3 ? ramp[0]! : ramp[1]!;
      }
    done = crop(cv);
    PAINTED.set(name, done);
    PARTS[name] = done.part;
  }
  return { name, at: done.at };
}

// ---- Poses.

/** Arms: elbow and hand, relative to the shoulder. */
type ArmA = "hold" | "squeeze" | "hip" | "point" | "up" | "high" | "down" | "side" | "lap" | "floor";
type ArmB = "rest" | "hip" | "up" | "high" | "wave1" | "wave2" | "wave3" | "down" | "ground" | "scratch";
/** The flower arm: the hand holds the flower's stem, the flower head above the fist. */
const ARM_A: Record<ArmA, readonly [Pt, Pt]> = {
  hold: [[5, 4], [9, 8]],
  squeeze: [[5, 4], [9, 9]],
  hip: [[7, 3], [3, 6]],
  point: [[7, 0], [12, 1]],
  up: [[8, -3], [12, -11]],
  high: [[7, -5], [11, -16]],
  down: [[3, 4], [4, 9]],
  side: [[5, 4], [8, 8]],
  lap: [[4, 4], [7, 6]],
  floor: [[5, 2], [9, 2]],
};
const ARM_B: Record<ArmB, readonly [Pt, Pt]> = {
  rest: [[-2, 3], [-2, 7]],
  hip: [[-5, 3], [-2, 6]],
  up: [[-7, -3], [-9, -12]],
  high: [[-6, -4], [-7, -16]],
  wave1: [[-6, -3], [-5, -11]],
  wave2: [[-7, -3], [-9, -10]],
  wave3: [[-7, -4], [-8, -13]],
  down: [[-2, 4], [-1, 8]],
  ground: [[0, 2], [3, 3]],
  scratch: [[-6, -3], [-4, -12]],
};

/** A jet of water from the flower: a parabola, from where it has got to (`head`) back to where it has gone from (`tail`). */
export interface Jet {
  head: number;
  tail?: number;
  vx?: number;
  a?: number;
  b?: number;
}

export interface Pose {
  mood?: Mood;
  /** The whole upper body down this many pixels (a breath, a crouch). */
  bob?: number;
  /** Off the ground, and sideways, for all of it. */
  air?: number;
  dx?: number;
  /** The upper body sideways (a waddle), and the head on it. */
  sway?: number;
  hx?: number;
  hy?: number;
  hatDx?: number;
  hatDy?: number;
  pomDy?: number;
  hairDx?: number;
  feet?: { n?: { x?: number; lift?: number }; f?: { x?: number; lift?: number } };
  armA?: ArmA;
  armB?: ArmB;
  /** Squirting: the jet, or none. */
  jet?: Jet;
  flower?: "n" | "wilt";
  /** The flower rides the body: an extra pixel up or down for it. */
  flowerDy?: number;
  sit?: boolean;
  /** On the ground, legs out in front (defeat). */
  slump?: boolean;
  /** The hat off the head: on the ground. */
  hatOff?: "ground";
  noShadow?: boolean;
}

/** The end of an arm's stroke, pulled back from the hand so the glove covers its round end. */
function trim(from: Pt, to: Pt, d = 1.5): Pt {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const n = Math.hypot(dx, dy) || 1;
  return [Math.round((to[0] - (dx / n) * d) * 2) / 2, Math.round((to[1] - (dy / n) * d) * 2) / 2];
}

function build(p: Pose): { layers: Layer[]; nozzle: Pt } {
  const sit = p.sit ?? false;
  const slump = p.slump ?? false;
  const dx = p.dx ?? 0;
  const air = p.air ?? 0;
  const by = (p.bob ?? 0) - air;
  /** The torso's left edge. */
  const ux = TX + dx + (p.sway ?? 0) + (sit ? -2 : 0) + (slump ? 2 : 0);
  const uy = by + (sit ? -6 : 0);
  const layers: Layer[] = [];
  const put = (part: string, x: number, y: number, extra: Partial<Layer> = {}) => layers.push({ part, x, y, ...extra });
  const add = (l: { name: string; at: Pt }) => layers.push({ part: l.name, x: l.at[0], y: l.at[1] });

  if (!p.noShadow) {
    const sx = TX + 7 + dx + (slump ? 7 : 0);
    if (air > 3) put("shadowS", sx - 9, G - 2);
    else put("shadow", sx - 13, G - 2);
  }
  if (sit) put("stool", ux - 3, G - 14);

  // The head's place, and the tufts behind it.
  const hx = ux - 2 + (p.hx ?? 0);
  const hy = G - 32 + uy + (p.hy ?? 0);
  put("hairL", hx - 4 + (p.hairDx ?? 0), hy - 1);
  put("hairR", hx + 12 + (p.hairDx ?? 0), hy - 3);

  // The back arm, behind the body.
  const armB = ARM_B[p.armB ?? "rest"];
  const shB: Pt = [ux + 1, G - 14 + uy];
  const handB: Pt = [shB[0] + armB[1][0], shB[1] + armB[1][1]];
  const elbowB: Pt = [shB[0] + armB[0][0], shB[1] + armB[0][1]];
  add(limb([shB, elbowB, trim(elbowB, handB)], 2, "Ppv"));

  // Legs.
  const legX = TX + dx;
  if (slump) {
    // Sitting on the ground, legs straight out in front.
    const gy = G - 3;
    const lx = ux + 7;
    add(limb([[lx + 2, gy - 2], [lx + 12, gy - 2]], 2, "qRr"));
    put("cuffV", lx + 12, gy - 4);
    put("shoeF", lx + 14, G - 6);
    add(limb([[lx, gy], [lx + 10, gy]], 2.4, "Rrt"));
    put("cuffV", lx + 10, gy - 2);
    put("shoeN", lx + 12, G - 4);
  } else if (sit) {
    const hipY = G - 16 + (p.bob ?? 0);
    const hxL = ux + 6;
    const [fsx, fsl] = [p.feet?.f?.x ?? 0, p.feet?.f?.lift ?? 0];
    const [nsx, nsl] = [p.feet?.n?.x ?? 0, p.feet?.n?.lift ?? 0];
    const farY = G - 11 - fsl;
    const nearY = G - 11 - nsl;
    add(limb([[hxL + 3, hipY - 1], [hxL + 12, hipY - 1], [hxL + 12 + fsx, farY - 1]], 2.1, "qRr"));
    put("cuff", hxL + 12 + fsx - 2, farY + 1);
    put("shoeF", hxL + 12 + fsx - 2, farY + 3);
    add(limb([[hxL, hipY], [hxL + 9, hipY], [hxL + 9 + nsx, nearY]], 2.4, "Rrt"));
    put("cuff", hxL + 9 + nsx - 2, nearY + 2);
    put("shoeN", hxL + 9 + nsx - 2, nearY + 4);
  } else {
    const leg = (hipX: number, f: { x?: number; lift?: number } | undefined, far: boolean) => {
      const a: Pt = [hipX + (f?.x ?? 0), G - 8 - air - (f?.lift ?? 0)];
      add(limb([[hipX, G - 10 + by], a], 2.6, far ? "qRr" : "Rrt"));
      put("cuff", a[0] - 2, a[1] + 2);
      put(far ? "shoeF" : "shoeN", a[0] - 3, a[1] + 4);
    };
    leg(legX + 3, p.feet?.f, true);
    leg(legX + 10, p.feet?.n, false);
  }

  // Body.
  put("hips", ux - 1, G - 11 + uy);
  put("torso", ux, G - 17 + uy);
  put("ruff", ux, G - 19 + uy);
  const fl = p.flower === "wilt" ? "flowerWilt" : p.jet ? "flowerSpray" : "flower";

  // The head, nose, hat.
  put(`head:${p.mood ?? "calm"}`, hx, hy);
  put("nose", hx + 17, hy + 6);
  if (p.hatOff === "ground") {
    put("hat", 3, G - 7);
    put("pom", 7, G - 10);
  } else {
    const hatX = hx + 3 + (p.hatDx ?? 0);
    const hatY = hy - 5 + (p.hatDy ?? 0);
    put("hat", hatX, hatY);
    put("pom", hatX + 4, hatY - 3 + (p.pomDy ?? 0));
  }

  // The front arm, over everything.
  const armA = ARM_A[p.armA ?? "hold"];
  const shA: Pt = [ux + 11, G - 14 + uy];
  const handA: Pt = [shA[0] + armA[1][0], shA[1] + armA[1][1]];
  const elbowA: Pt = [shA[0] + armA[0][0], shA[1] + armA[0][1]];
  add(limb([shA, elbowA, trim(elbowA, handA)], 2, "Ppv"));
  // The flower on its stem above the fist.
  const flx = handA[0] - 4;
  const fly = handA[1] - 13 + (p.flowerDy ?? 0);
  put("stem", handA[0] - 1, handA[1] - 6 + (p.flowerDy ?? 0));
  put(fl, flx, fly);
  put("glove", handA[0] - 2, handA[1] - 2);
  put("glove", handB[0] - 2, handB[1] - 2);
  const nozzle: Pt = [flx + 4, fly + 4];
  return { layers, nozzle };
}

// ---- Water and little effects.

function jetSpecks([nx, ny]: Pt, j: Jet): Speck[] {
  const vx = j.vx ?? 1;
  const a = j.a ?? 0.95;
  const b = j.b ?? 0.05;
  const tail = j.tail ?? 0;
  const out: Speck[] = [];
  const seen = new Set<string>();
  for (let t = Math.max(3, tail); t <= j.head; t += 1) {
    if (j.head - tail > 9 && t % 6 === 5) continue;
    const x = Math.round(nx + vx * t);
    const y = Math.round(ny - a * t + b * t * t);
    const fat = t < j.head - 1;
    const put2 = (yy: number, k: string) => {
      const key = `${x},${yy}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push([x, yy, k]);
    };
    put2(y, t > j.head - 2 || t % 2 === 0 ? "B" : "b");
    if (fat) put2(y + 1, "b");
  }
  return out;
}
/** A jet growing out and then leaving: stage k of K. */
function stream(k: number, K: number, reach: number): Jet {
  const head = Math.min(reach, 3 + ((k + 1) / (K * 0.55)) * (reach - 3));
  const tail = Math.max(0, ((k + 1 - K * 0.5) / (K * 0.5)) * (reach - 2));
  return { head: Math.round(head), tail: Math.round(tail) };
}

function seeded(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => ((s = (s * 1103515245 + 12345) >>> 0) >>> 8) / 16777216;
}
const star = (x: number, y: number, k = "y"): Speck[] => [[x, y, "E"], [x - 1, y, k], [x + 1, y, k], [x, y - 1, k], [x, y + 1, k]];
function twinkles(t: number, n = 3, box: readonly [number, number, number, number] = [4, 6, 46, 36]): Speck[] {
  const rnd = seeded(t * 31 + 5);
  return Array.from({ length: n }, (_, i) => star(Math.round(box[0] + rnd() * (box[2] - box[0])), Math.round(box[1] + rnd() * (box[3] - box[1])), (i + t) % 2 ? "y" : "u")).flat();
}
const CONFETTI = "ygurpw";
const confetti = (i: number): Speck[] =>
  Array.from({ length: 14 }, (_, n): Speck => [((n * 37 + 9) % 44) + 3, ((n * 23 + i * 3) % 38) + 4, CONFETTI[n % CONFETTI.length]!]);
const FOOT_X = TX + 7;
const dust = (t: number): Speck[] =>
  [-1, 1].flatMap((side) => [0, 1, 2].map((i): Speck => [Math.round(FOOT_X + side * (8 + i * 3 + t * 2)), G - 1 - (i % 2) - (t > 0 ? 1 : 0), t > 1 ? "X" : "W"]));
const dropShadow = (r: number): Speck[] =>
  Array.from({ length: r * 2 + 1 }, (_, i) => FOOT_X - r + i).flatMap((x) => [[x, G - 2, "z"] as Speck, [x, G - 1, "z"] as Speck]);
const thoughts = (n: number): Speck[] =>
  ([[35, 14], [39, 11], [43, 8]] as const).slice(0, n).flatMap(([x, y], k): Speck[] => {
    const big = k === 2;
    const o: Speck[] = [[x, y, "w"], [x + 1, y, "w"], [x, y + 1, "w"], [x + 1, y + 1, "W"]];
    if (big) o.push([x - 1, y, "w"], [x + 2, y, "w"], [x, y - 1, "w"], [x + 1, y - 1, "w"], [x - 1, y + 1, "W"], [x + 2, y + 1, "X"], [x, y + 2, "W"], [x + 1, y + 2, "X"]);
    return o;
  });
const sweat = (i: number): Speck[] => {
  const t = i % 4;
  return [[9 - t, 23 + t, "b"], [9 - t, 24 + t, "B"], [34 + t, 20 + t, "b"], [34 + t, 21 + t, "B"]];
};
/** Dizzy stars circling the head. */
function dizzy(i: number, cx: number, cy: number): Speck[] {
  return [0, 1, 2].flatMap((k) => {
    const a = ((i + k * 2.1) / 6) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * 9);
    const y = Math.round(cy + Math.sin(a) * 2.5);
    return [[x, y, k % 2 ? "y" : "H"] as Speck, [x + 1, y, "y"] as Speck];
  });
}

const FLASH: Record<string, string> = { h: "#ffffff", f: "#fff0e4", F: "#ffe0d0", p: "#ffffff", P: "#f0e0ff", v: "#ffffff", r: "#ffffff", R: "#ffe0e0", o: "#ffffff", O: "#ffe8d0", e: "#ffffff" };

/** One frame: the pose, its water and anything extra. */
function f(ms: number, p: Pose, extra: Partial<Frame> = {}): Frame {
  const b = build(p);
  const water = p.jet ? jetSpecks(b.nozzle, p.jet) : [];
  const specks = [...water, ...(extra.specks ?? [])].filter(([x, y]) => x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2);
  return { ms, layers: b.layers, ...extra, specks };
}

// ---- Animations.

/** Idle (3 s): breathes, blinks, glances ahead, its pompom bobbing; now and then the flower gives a tiny squirt. */
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 30 }, (_, i) => {
    const bob = i % 15 >= 8 ? 1 : 0;
    const blink = i === 11 || i === 12 || i === 27;
    const giggle = i >= 20 && i <= 24;
    const squirt = i >= 19 && i <= 24;
    const hx = i >= 3 && i <= 7 ? 1 : 0;
    const jet: Jet | undefined = squirt ? { ...stream(i - 19, 6, 11), a: 0.8, b: 0.12 } : undefined;
    return f(100, {
      bob: squirt && i < 21 ? 1 : bob,
      mood: blink ? "blink" : giggle ? "happy" : "calm",
      hx,
      pomDy: bob ? 1 : i % 15 === 3 ? -1 : 0,
      hairDx: hx,
      jet,
      flowerDy: squirt && i < 21 ? 1 : 0,
      armA: squirt && i >= 19 && i <= 21 ? "squeeze" : "hold",
    }, i === 19 ? { cue: "squirt" } : {});
  }),
};

/** Walk (0.6 s): a bouncy waddle in its big shoes, the head bobbing, the body swaying. */
const walk: Anim = {
  loop: true,
  frames: Array.from({ length: 6 }, (_, i) => {
    const th = (i / 6) * Math.PI * 2;
    const leg = (off: number) => ({ x: Math.round(3 * Math.sin(th + off * Math.PI * 2)), lift: Math.max(0, Math.round(2.4 * Math.cos(th + off * Math.PI * 2))) });
    const contact = i === 2 || i === 5;
    const up = i === 0 || i === 3;
    return f(100, {
      bob: contact ? 1 : 0,
      air: up ? 1 : 0,
      sway: i < 3 ? 1 : -1,
      hy: contact ? 0 : -1,
      hx: i < 3 ? 0 : 1,
      mood: "calm",
      feet: { n: leg(0), f: leg(0.5) },
      armA: i % 3 === 0 ? "side" : "hold",
      armB: i % 3 === 0 ? "hip" : "rest",
      pomDy: contact ? 1 : -1,
      hatDy: contact ? 0 : -1,
      flowerDy: contact ? 1 : 0,
      hairDx: i < 3 ? -1 : 0,
    }, contact ? { cue: "step" } : {});
  }),
};

/** Sit (loops): on a stool at the chess table facing the board, shoes swinging, slow blinks, thinking about a move. */
const sit: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) => {
    const lean = i >= 6 && i <= 11;
    const blink = i === 3 || i === 4 || i === 13;
    const ph = i % 4;
    const nSwing = [0, 1, 2, 1][ph]!;
    const fSwing = [2, 1, 0, 1][ph]!;
    return f(200, {
      sit: true,
      mood: blink ? (lean ? "thinkBlink" : "blink") : lean ? "think" : "calm",
      bob: i % 8 >= 4 ? 1 : 0,
      hx: lean ? 2 : 0,
      hy: lean ? -1 : 0,
      armA: "lap",
      armB: lean && i >= 7 && i <= 10 ? "scratch" : "rest",
      feet: { n: { x: nSwing - 1, lift: nSwing === 2 ? 1 : 0 }, f: { x: fSwing - 1, lift: fSwing === 2 ? 1 : 0 } },
      pomDy: i % 8 >= 4 ? 1 : 0,
      hairDx: lean ? 1 : 0,
    });
  }),
};

/** Wave (once, about 1.2 s): waves hello with its free hand and the flower squirts a little arc, then settles back to idle. */
const WAVES: readonly ArmB[] = ["wave1", "wave2", "wave3", "wave2", "wave1", "wave2", "wave3"];
const wave: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 1, mood: "happy", armB: "hip", flowerDy: 1 }),
    f(100, { mood: "cheer", armB: "up", hy: -1, hatDy: -1, jet: stream(0, 8, 19) }, { cue: "squirt" }),
    ...WAVES.map((armB, i) =>
      f(100, {
        mood: i % 2 ? "cheer" : "happy",
        armB,
        bob: i % 2 ? 1 : 0,
        hx: armB === "wave1" ? -1 : armB === "wave3" ? 1 : 0,
        hy: i % 2 ? 0 : -1,
        pomDy: i % 2 ? 1 : -1,
        hatDy: i % 2 ? 0 : -1,
        hairDx: i % 2 ? 0 : -1,
        flowerDy: i % 2 ? 1 : 0,
        jet: stream(i + 1, 8, 19),
      }, i === 1 ? { specks: star(7, 19) } : {}),
    ),
    f(100, { mood: "happy", armB: "hip", bob: 1 }),
    f(100, { mood: "happy" }),
    f(100, { mood: "calm" }),
  ],
};

/** Entrance: drops in from above on its shadow, lands with a squash and a puff of dust, then ta-da: arms up, a big squirt. */
const entrance: Anim = {
  loop: false,
  frames: [
    { ms: 90, layers: [], specks: dropShadow(4) },
    { ms: 80, layers: [], specks: dropShadow(8) },
    f(70, { air: 8, mood: "cheer", armA: "up", armB: "up", feet: { n: { lift: 2 }, f: { lift: 3 } }, pomDy: 1 }, { specks: dropShadow(11) }),
    f(70, { air: 3, mood: "cheer", armA: "up", armB: "up", feet: { n: { lift: 1 }, f: { lift: 2 } }, hatDy: 1, pomDy: -1 }),
    f(100, { bob: 3, mood: "blink", hatDy: 1, pomDy: 1, flowerDy: 1 }, { cue: "step", specks: dust(0) }),
    f(90, { bob: 1, mood: "happy", armA: "up", armB: "up" }, { specks: dust(1) }),
    f(110, { mood: "cheer", armA: "high", armB: "high", hy: -1, jet: stream(0, 8, 20), pomDy: -1 }, { cue: "squirt", specks: [...dust(2), ...twinkles(1, 3)] }),
    f(110, { mood: "happy", armA: "high", armB: "wave1", hx: -1, jet: stream(2, 8, 20) }, { specks: twinkles(2, 3) }),
    f(110, { mood: "happy", armA: "up", armB: "wave3", hx: 1, jet: stream(4, 8, 20), pomDy: 1 }),
    f(120, { mood: "happy", armB: "hip", jet: stream(6, 8, 20) }),
    f(300, { mood: "calm" }),
  ],
};

/** Thinking (loops): head tipped up, eyes rolled up, a hand on the chin, a foot tapping, thought dots popping up. */
const thinking: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) =>
    f(150, {
      mood: i === 8 ? "thinkBlink" : "think",
      armA: "side",
      armB: i % 6 >= 2 ? "scratch" : "hip",
      hx: 2,
      hy: -1,
      bob: i % 6 >= 3 ? 1 : 0,
      feet: { n: i % 4 === 1 ? { lift: 2 } : {} },
      pomDy: i % 6 >= 3 ? 1 : 0,
      hairDx: 1,
      hatDx: 1,
    }, { specks: thoughts(i % 6 < 1 ? 0 : i % 6 < 3 ? 1 : i % 6 < 5 ? 2 : 3) }),
  ),
};

/** Its move: a hop toward the board and a squirt at it. */
const move: Anim = {
  loop: false,
  frames: [
    f(90, { bob: 2, mood: "bold", armA: "hip", flowerDy: 1, hatDy: 1 }),
    f(80, { air: 4, dx: 1, mood: "bold", armA: "point", feet: { n: { lift: 2 }, f: { lift: 3 } }, jet: stream(0, 7, 18), pomDy: -1 }, { cue: "squirt" }),
    f(80, { air: 5, dx: 2, mood: "bold", armA: "point", feet: { n: { lift: 2 }, f: { lift: 2 } }, jet: stream(1, 7, 18) }),
    f(100, { bob: 2, dx: 2, mood: "happy", armA: "point", jet: stream(3, 7, 18), hatDy: 1, pomDy: 1 }, { specks: dust(0) }),
    f(100, { bob: 1, dx: 2, mood: "happy", armA: "point", jet: stream(5, 7, 18) }),
    f(110, { dx: 1, mood: "happy", armA: "hip" }),
    f(150, { mood: "calm" }),
  ],
};

/** A capture: two excited hops, both arms up, a big squirt, twinkles and confetti. */
const capture: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 2, mood: "bold", armA: "hip", armB: "hip", hatDy: 1 }),
    f(80, { air: 5, mood: "cheer", armA: "high", armB: "high", feet: { n: { lift: 2 }, f: { lift: 3 } }, jet: stream(0, 10, 20), pomDy: 1 }, { cue: "squirt", specks: twinkles(1) }),
    f(80, { air: 6, mood: "laugh", armA: "up", armB: "high", feet: { n: { lift: 3 }, f: { lift: 3 } }, jet: stream(2, 10, 20), hy: -1 }, { specks: twinkles(2) }),
    f(80, { air: 4, mood: "laugh", armA: "high", armB: "up", jet: stream(4, 10, 20) }, { specks: twinkles(3) }),
    f(80, { bob: 2, mood: "cheer", armA: "up", armB: "up", jet: stream(6, 10, 20), hatDy: 1 }, { specks: dust(0) }),
    f(80, { air: 6, mood: "laugh", armA: "high", armB: "high", feet: { n: { lift: 2 }, f: { lift: 3 } }, jet: stream(8, 10, 20), pomDy: 1 }, { specks: twinkles(4) }),
    f(80, { air: 6, mood: "laugh", armA: "up", armB: "wave1", feet: { n: { lift: 3 }, f: { lift: 3 } }, jet: stream(9, 10, 20), hy: -1 }, { specks: twinkles(5) }),
    f(80, { air: 4, mood: "laugh", armA: "high", armB: "wave2" }, { specks: twinkles(6) }),
    f(90, { bob: 2, mood: "cheer", armA: "up", armB: "up", hatDy: 1 }, { specks: dust(1) }),
    f(120, { bob: 1, mood: "happy", armA: "hip" }),
    f(160, { mood: "smug", armA: "hip", armB: "hip" }),
  ],
};

/** Hurt: hit, a flash, the flower squeezed so it dribbles, its hat knocked off; then a brave little grin. */
const hurt: Anim = {
  loop: false,
  frames: [
    f(70, { bob: 2, mood: "hurt", armA: "down", armB: "down", hatDy: -4, pomDy: -2, jet: { head: 9, a: 0.5, b: 0.09 } }, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    f(80, { bob: 3, mood: "hurt", armA: "down", armB: "down", hatDy: -8, hatDx: 1, jet: { head: 12, tail: 3, a: 0.45, b: 0.09 } }, { shake: [-1, 0] }),
    f(90, { bob: 2, dx: -1, mood: "hurt", armA: "down", armB: "down", hatDy: -9, hatDx: 2, jet: { head: 12, tail: 8, a: 0.4, b: 0.1 } }, { specks: [[9, 25, "b"], [9, 26, "B"]] }),
    f(100, { bob: 1, dx: -1, mood: "rattled", armA: "side", hatDy: -5, hatDx: 2 }),
    f(110, { mood: "blink", armA: "hip", hatDy: -1, hatDx: 2 }),
    f(120, { mood: "bold", armA: "hip", armB: "hip", hatDx: 1 }),
    f(160, { mood: "calm" }),
  ],
};

/** Check: two sharp jabs of squirt at the board, eyes bright. */
const JAB: Pose = { bob: 1, dx: 1, mood: "bold", armA: "point" };
const check: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 1, mood: "bold", armA: "up", armB: "hip" }),
    f(110, { ...JAB, jet: stream(0, 5, 21) }, { cue: "squirt" }),
    f(90, { ...JAB, jet: stream(2, 5, 21) }),
    f(90, { bob: 1, dx: 1, mood: "bold", armA: "up", armB: "hip", jet: stream(4, 5, 21) }),
    f(110, { ...JAB, jet: stream(0, 5, 21) }, { cue: "squirt" }),
    f(90, { ...JAB, jet: stream(2, 5, 21) }),
    f(110, { dx: 1, mood: "happy", armA: "point", jet: stream(4, 5, 21) }),
    f(160, { mood: "smug", armA: "hip", armB: "hip" }),
  ],
};

/** Smug: chin up, eyes half shut, a little smirk, a slow nod, hands on hips. */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) =>
    f(150, { mood: "smug", armA: "hip", armB: "hip", hy: i < 3 || i > 5 ? -1 : 0, hx: i < 4 ? 0 : 1, bob: i % 4 === 2 ? 1 : 0, pomDy: i % 4 === 2 ? 1 : 0, hatDx: i >= 4 ? 1 : 0, hairDx: i >= 4 ? 1 : 0 }, i === 5 ? { specks: star(TX + 8, G - 17, "H") } : {}),
  ),
};

/** Rattled: wide eyes, worried brows, sweat flying, trembling, the flower dribbling in fright. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) =>
    f(80, { mood: "rattled", armA: "side", armB: "hip", dx: i % 2 ? 1 : -1, bob: i % 4 === 2 ? 1 : 0, hatDy: i % 2 ? 1 : 0, pomDy: i % 2 ? -1 : 1, hairDx: i % 2 ? 1 : -1, flowerDy: i % 2 }, { specks: [...sweat(i), [TX + 7 + (i % 2), G - 10 + ((i * 2) % 5), "b"]] }),
  ),
};

/** Defeat: hit, dizzy eyes, the hat flies off, it plonks down on the ground, legs out, the flower wilting (the last frame holds). */
const SLUMP: Pose = { slump: true, bob: 8, mood: "out", armA: "floor", armB: "ground", hatOff: "ground", flower: "wilt" };
const defeat: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 2, mood: "hurt", armA: "down", armB: "down", hatDy: -5, jet: { head: 9, a: 0.5, b: 0.09 } }, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    f(90, { bob: 2, dx: -1, mood: "out", armA: "down", armB: "down", hatDy: -9, hatDx: 2 }),
    f(100, { bob: 4, dx: 1, mood: "out", armA: "side", armB: "hip", hatDy: -8, hatDx: 4, flower: "wilt" }, { specks: dizzy(0, 21, 14) }),
    f(100, { bob: 6, mood: "out", armA: "floor", armB: "hip", hatOff: "ground", flower: "wilt" }, { specks: dizzy(1, 21, 17) }),
    f(110, { ...SLUMP, hy: 1 }, { cue: "poof", shake: [1, 0], specks: [...dust(0), ...dizzy(2, 21, 21)] }),
    f(120, { ...SLUMP, hy: 1, hx: 1 }, { specks: dizzy(3, 21, 21) }),
    f(160, { ...SLUMP, hy: 2 }, { specks: dizzy(4, 21, 22) }),
    f(1000, { ...SLUMP, hy: 2, hx: 1 }, { specks: dizzy(5, 21, 22) }),
  ],
};

/** Victory: jumping for joy, both arms up, the flower squirting arcs, confetti. Then again. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const air = [0, 3, 5, 6, 5, 3, 0, 0, 3, 5, 3, 0][i]!;
    const arms: ArmB[] = ["high", "wave1", "wave2", "wave3", "wave2", "wave1", "high", "high", "wave3", "wave2", "wave1", "high"];
    return f(110, {
      bob: i === 0 || i === 6 || i === 7 ? 2 : 0,
      air,
      mood: air > 2 ? "laugh" : "cheer",
      armA: air > 2 ? "up" : "high",
      armB: arms[i]!,
      feet: air > 2 ? { n: { lift: 3 }, f: { lift: 3 } } : {},
      hy: i % 2 ? -1 : 0,
      pomDy: i % 2 ? 1 : -1,
      hatDy: air > 3 ? 1 : 0,
      jet: stream(i, 12, 21),
    }, { specks: [...confetti(i), ...twinkles(i, 1)], cue: i === 2 ? "squirt" : undefined });
  }),
};

export const sidekickBoingo: Character = {
  id: "sidekick-boingo",
  name: "Boingo's sidekick",
  w: W,
  h: H,
  foot: [TX + 7, G],
  palette: SIDEKICK_PALETTE,
  halo: "#2a2630",
  parts: PARTS,
  anims: { idle, walk, sit, wave, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory },
};
