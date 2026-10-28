/**
 * Puddles's sidekick (id "sidekick-puddles"): a baby hippo, a town bot that wanders the square and plays chess at the
 * park's tables. No powers, never fights: a friendly, curious kid who copies the big one, so it carries ONE little green
 * watering can (brass rose and rim, like his nozzle), a few drops falling from the spout now and then, and a small sprout
 * stuck behind one ear.
 *
 * Smaller and rounder than Puddles, no hose: a big round head with a wide soft muzzle and two nostrils, big shiny eyes,
 * small round ears, pink cheeks and belly, a round egg of a body and short stubby legs. His skin colors. Upright like him,
 * three-quarters, facing our right, light from the top left.
 *
 * Rigging: the head (one per face), the body, the ears and the sprout are painted once; the legs, the arm, the tail and
 * the can are painted from numbers per pose (the can turns by a tilt), so a new pose is a handful of numbers.
 */
import { canvas, ellipse, toGrid, type Canvas } from "../paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "../sprite.ts";

export const SIDEKICK_PALETTE = {
  k: "#1d1019", // outline
  a: "#6c404b", // skin, grey-mauve: dark to light (Puddles's)
  b: "#8d5762",
  c: "#aa7079",
  d: "#c88f8e",
  e: "#e0aba3",
  f: "#b5545f", // the pink of belly and cheeks: dark to light
  g: "#d6747b",
  h: "#f0a191",
  i: "#f8c4b0",
  u: "#46303c", // toenails, a shine in the eye
  v: "#7b6068",
  x: "#1b0e15", // eyes
  w: "#ffffff", // glints
  y: "#4a1f2e", // nostrils, the line of the mouth
  X: "#7a2a38", // inside of the mouth
  W: "#d4636e", // tongue
  T: "#f3ead2", // thought bubbles
  t: "#cdbf9f",
  E: "#17483f", // the can: deep teal green, dark to light
  F: "#22705a",
  G: "#33a479",
  H: "#7fe0ae",
  J: "#7a4f0e", // brass: dark to light
  K: "#b87a14",
  L: "#f2c14e",
  M: "#ffe58a",
  "1": "#2a6fc2", // water: deep to pale
  "2": "#4fa3ee",
  "3": "#8bcdfb",
  "4": "#d4f0ff",
  "5": "#6c4222", // stool wood: dark, mid, light
  "6": "#a06a33",
  "7": "#c98f4e",
  z: "#0d0e12", // ground shadow
  "9": "#4d4538", // dust
  "0": "#7d705a",
  "~": "#9fd8ff", // sweat
} as const;

type Pt = readonly [number, number];

/** The frame, and the ground (the first row below the feet). */
const W = 64;
const H = 64;
const GROUND = 61;
/** Everything is drawn in a layout 3 pixels to the right of where it ends up (room for the can and its drops on the right). */
const SHIFT = -3;

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
  let x0 = cv[0]!.length;
  let y0 = cv.length;
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
/** Skin by a light value (0 dark to 1 light): banded, never blended. */
const skin = (l: number) => (l < 0.2 ? "b" : l < 0.45 ? "c" : l < 0.72 ? "d" : "e");
const pink = (l: number) => (l < 0.25 ? "f" : l < 0.5 ? "g" : l < 0.78 ? "h" : "i");
const green = (l: number) => (l < 0.2 ? "E" : l < 0.48 ? "F" : l < 0.78 ? "G" : "H");
const brass = (l: number) => (l < 0.2 ? "J" : l < 0.48 ? "K" : l < 0.78 ? "L" : "M");
/** Light from the top left on a round surface. */
const roundL = (cx: number, cy: number, rx: number, ry: number, bias = 0) => (x: number, y: number) => 0.55 + bias - 0.42 * ((x - cx) / rx) - 0.5 * ((y - cy) / ry);
function fill(cv: Canvas, inside: (x: number, y: number) => boolean, light: (x: number, y: number) => number, tone: (l: number) => string = skin): void {
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

// ---- The face: a big round head, big shiny eyes, a wide soft muzzle with two nostrils, pink cheeks.

export type Mood = "calm" | "blink" | "happy" | "cheer" | "think" | "thinkBlink" | "smug" | "rattled" | "hurt" | "out" | "bold";
type Eye = "open" | "up" | "wide" | "half" | "arc" | "shut" | "pinch" | "x";
type Brow = "up" | "worried" | "bold" | "smug";
type Mouth = "smile" | "grin" | "flat" | "smirk" | "wavy" | "o" | "tongue" | "gasp";

/** The near eye (6 x 6, on our left) and the far one (5 x 6, by the bridge of its nose). */
const NEAR_EYE: Record<Eye, readonly string[]> = {
  open: [".xxxx.", "xwwxxx", "xwxxxx", "xxxxxx", "xxxxvx", ".xxxx."],
  up: [".xxxx.", "xxxwwx", "xxxwxx", "xxxxxx", "xxxxxx", ".xxxx."],
  wide: [".xxxx.", "xwwwwx", "xwxxwx", "xwxxwx", "xwwwwx", ".xxxx."],
  half: ["......", "......", "xxxxxx", "xwxxxx", "xxxxvx", ".xxxx."],
  arc: ["......", "......", ".xxxx.", "xx..xx", "x....x", "......"],
  shut: ["......", "......", "......", "xxxxxx", ".xxxx.", "......"],
  pinch: ["......", "xx....", ".xxx..", "...xxx", ".xxx..", "xx...."],
  x: ["x....x", ".x..x.", "..xx..", "..xx..", ".x..x.", "x....x"],
};
const FAR_EYE: Record<Eye, readonly string[]> = {
  open: [".xxx.", "xwwxx", "xwxxx", "xxxxx", "xxxvx", ".xxx."],
  up: [".xxx.", "xxwwx", "xxwxx", "xxxxx", "xxxxx", ".xxx."],
  wide: [".xxx.", "xwwwx", "xwxxx", "xwxxx", "xwwwx", ".xxx."],
  half: [".....", ".....", "xxxxx", "xwxxx", "xxxvx", ".xxx."],
  arc: [".....", ".....", ".xxx.", "xx.xx", "x...x", "....."],
  shut: [".....", ".....", ".....", "xxxxx", ".xxx.", "....."],
  pinch: [".....", "...xx", "..xx.", ".xx..", "..xx.", "...xx"],
  x: ["x...x", ".x.x.", "..x..", "..x..", ".x.x.", "x...x"],
};
/** Brows (dark pixels on the head grid): [near, far]. */
const BROWS: Record<Brow, readonly [readonly Pt[], readonly Pt[]]> = {
  up: [[[7, 6], [8, 6], [9, 6], [10, 6]], [[15, 5], [16, 5], [17, 5], [18, 5]]],
  worried: [[[6, 7], [7, 7], [8, 6], [9, 6], [10, 5]], [[14, 5], [15, 5], [16, 6], [17, 6], [18, 7]]],
  bold: [[[6, 6], [7, 6], [8, 6], [9, 7], [10, 7]], [[15, 6], [16, 5], [17, 5], [18, 5]]],
  smug: [[[6, 6], [7, 6], [8, 6], [9, 6]], [[15, 4], [16, 4], [17, 5], [18, 5]]],
};
const MOUTHS: Record<Mouth, readonly string[]> = {
  smile: ["y........y", ".yyyyyyyy."],
  grin: ["yyyyyyyyyy", "yXXXXXXXXy", ".yXXWWXXy.", "..yyyyyy.."],
  flat: ["yyyyyyyy"],
  smirk: ["......yyyy", "yyyyyy...."],
  wavy: ["y.y.y.y.y", ".y.y.y.y."],
  o: [".yyy.", "yXXXy", "yXXXy", ".yyy."],
  tongue: ["yyyyyyyyyy", "yXXWWWWXXy", "..yyWWWWy.", "....yyyy.."],
  gasp: ["yyyyy", "yXXXy", "yXXXy", "yyyyy"],
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

const HW = 34;
const HH = 26;
/** Where the head grid sits at rest (its top-left), on the frame. */
const HX0 = 11;
const HY0 = 19;

function head(mood: Mood): Part {
  const cv = canvas(HW, HH);
  const skull = ell(12.5, 14, 11, 10);
  const muz = ell(23, 18.8, 9.8, 6.5);
  const inside = (x: number, y: number) => skull(x, y) || muz(x, y);
  fill(cv, inside, roundL(14, 13, 15, 12, 0.06));
  // The muzzle: wide and soft, a little lighter than the skull.
  const mz = ell(23.5, 19, 9.1, 5.9);
  const mzL = roundL(22, 18, 11, 8, 0.15);
  fill(cv, (x, y) => inside(x, y) && mz(x, y), mzL);
  // The crease where the muzzle meets the cheek.
  dots(cv, [[14, 14], [14, 15], [14, 16], [14, 17], [15, 18], [15, 19]], "b");
  const face = FACES[mood];
  // Pink cheek.
  if (face.blush) fill(cv, (x, y) => ell(10.5, 18.4, 3.3, 2.2)(x, y) && inside(x, y), roundL(10.5, 18.4, 3.3, 2.2, 0.12), pink);
  // Nostrils on the muzzle's top.
  dots(cv, [[24, 13], [25, 13], [24, 14], [25, 14], [29, 14], [29, 15]], "y");
  dots(cv, [[23, 12], [24, 12], [28, 13]], "e");
  stamp(cv, NEAR_EYE[face.near], 7, 9);
  stamp(cv, FAR_EYE[face.far], 16, 8);
  if (face.brow) for (const side of BROWS[face.brow]) dots(cv, side.map(([x, y]): Pt => [x + 1, y + 1]), "y");
  const mouth = MOUTHS[face.mouth];
  const mx = face.mouth === "grin" || face.mouth === "tongue" ? 19 : face.mouth === "o" || face.mouth === "gasp" ? 22 : face.mouth === "flat" ? 21 : face.mouth === "wavy" ? 20 : 19;
  const my = face.mouth === "grin" || face.mouth === "tongue" ? 19 : face.mouth === "gasp" ? 19 : face.mouth === "o" ? 19 : face.mouth === "smile" ? 20 : 21;
  stamp(cv, mouth, mx, my);
  return { grid: toGrid(cv) };
}
const MOODS: readonly Mood[] = ["calm", "blink", "happy", "cheer", "think", "thinkBlink", "smug", "rattled", "hurt", "out", "bold"];
for (const m of MOODS) PARTS[`head:${m}`] = head(m);

/** An ear: round and small, pink inside. `kind` is how it sits (perked up, level, flopped back). */
function earPart(kind: "mid" | "up" | "down", far: boolean): Part {
  const cv = canvas(8, 8);
  const [cx, cy, rx, ry] = kind === "up" ? [3.5, 3.4, 2.9, 3.4] : kind === "down" ? [3.6, 4, 3.4, 2.7] : [3.5, 3.6, 3.1, 3.1];
  const o = ell(cx, cy, rx, ry);
  fill(cv, o, roundL(cx, cy, rx, ry, far ? -0.05 : 0.05));
  const inner = ell(cx + 0.5, cy + 0.5, rx - 1.2, ry - 1.1);
  fill(cv, (x, y) => o(x, y) && inner(x, y), roundL(cx + 0.5, cy + 0.5, rx, ry, 0.12), pink);
  return crop(cv).part;
}
for (const kind of ["mid", "up", "down"] as const) {
  PARTS[`ear:${kind}`] = earPart(kind, false);
  PARTS[`earF:${kind}`] = earPart(kind, true);
}

/** The sprout stuck behind the ear: a stalk, two leaves; leaning, drooping, or in flower. */
export type Sprout = "mid" | "l" | "r" | "bud" | "bloom" | "wilt";
const SPROUT_BASE = [
  "HG...GG",
  "GGG.GGH",
  ".GGFGG.",
  "..GFG..",
  "...F...",
  "...F...",
];
function sproutPart(kind: Sprout): Part {
  const w = 11;
  const cv = canvas(w, 12);
  const ox = 2;
  const oy = 4;
  if (kind === "bloom") {
    stamp(cv, ["..TTT..", ".TTLTT.", ".tTLTt.", "..ttt..", ".G.F.G.", ".GGFGG.", "...F...", "...F..."], ox, 2);
  } else if (kind === "bud") {
    stamp(cv, ["...hh..", "..hhhg.", "..hhgg.", "...FG..", ".G.F.G.", ".GGFGG.", "...F...", "...F..."], ox, 2);
  } else if (kind === "wilt") {
    stamp(cv, ["...FFG..", "..F..GG.", ".GF...GG", "GG..", "...F....", "...F...."], ox - 1, oy);
  } else {
    const lean = kind === "l" ? -1 : kind === "r" ? 1 : 0;
    SPROUT_BASE.forEach((row, i) => {
      const s = i === 0 ? lean * 2 : i === 1 ? lean : 0;
      stamp(cv, [row], ox + s, oy + i);
    });
  }
  return crop(cv).part;
}
for (const s of ["mid", "l", "r", "bud", "bloom", "wilt"] as const) PARTS[`sprout:${s}`] = sproutPart(s);
/** Where each sprout's top-left sits relative to the "mid" one (so the stalk's foot stays put). */
const SPROUT_AT: Record<Sprout, Pt> = { mid: [0, 0], l: [-1, 0], r: [-1, 0], bud: [0, 1], bloom: [0, -2], wilt: [-1, 0] };

PARTS["shadow"] = (() => {
  const cv = canvas(32, 3);
  ellipse(cv, 16, 1.5, 16, 1.5, "z");
  return { grid: toGrid(cv), outline: false };
})();

PARTS["stool"] = {
  grid: [
    "77777777777777777777",
    "66666666666666666666",
    "55555555555555555555",
    "..65............65..",
    "..65............65..",
    `..65${"5".repeat(12)}65..`,
    "..65............65..",
    "..65............65..",
  ],
};

/** The hand: a round mitt. */
PARTS["fist"] = { grid: [".cddc.", "cdeddc", "cddddb", "cdddbb", ".bccb."] };

// ---- The body: an egg, grey over its back and pink on its belly.

function bodyPart(): Painted {
  const cv = canvas(W, H);
  const a = ell(24, 47.5, 12.2, 8.3);
  const b = ell(24, 43, 10, 5.8);
  const inside = (x: number, y: number) => a(x, y) || b(x, y);
  const soft = (cx: number, cy: number, rx: number, ry: number, bias = 0) => (x: number, y: number) => 0.6 + bias - 0.3 * ((x - cx) / rx) - 0.38 * ((y - cy) / ry);
  fill(cv, inside, soft(23, 47, 13, 11, 0.02));
  const belly = ell(28.5, 50, 7.6, 5.8);
  fill(cv, (x, y) => inside(x, y) && belly(x, y), soft(28.5, 50, 7.6, 5.8, 0.08), pink);
  dots(cv, [[28, 50]], "f");
  return crop(cv);
}
const BODY_PART = painted("body", bodyPart);

// ---- Limbs: round strokes in skin.

function strokePart(pts: readonly Pt[], r: number, far = false): Painted {
  const cv = canvas(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const n = nearest([x, y], pts);
      if (n.d > r) continue;
      cv[y]![x] = skin(0.55 - 0.42 * (n.nx / r) - 0.5 * (n.ny / r) - (far ? 0.18 : 0));
    }
  return crop(cv);
}

/** A leg and its foot: a stub of a column into a wide foot with toenails at the front. `ax`, `ay`: the foot's middle. */
function legPart(hip: Pt, ax: number, ay: number, far: boolean): Painted & { name: string } {
  return painted(`leg:${hip.join(",")}:${ax},${ay}:${far ? 1 : 0}`, () => {
    const cv = canvas(W, H);
    const col = [hip, [ax, ay - 1]] as const;
    const foot = ell(ax + 1.5, ay, 5.4, 2.6);
    const fl = roundL(ax + 1, ay - 1, 7, 4, far ? -0.16 : 0.02);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const n = nearest([x, y], col);
        if (n.d <= 3.1 && y < ay + 2) cv[y]![x] = skin(0.55 - 0.42 * (n.nx / 3.1) - 0.2 * (n.ny / 3.1) - (far ? 0.16 : 0));
        if (foot(x, y)) cv[y]![x] = skin(fl(x, y));
      }
    // Toes: two grooves and a nail on each tip.
    dots(cv, [[ax + 2, ay + 1], [ax + 2, ay + 2], [ax + 4, ay + 1], [ax + 4, ay + 2]], "b");
    dots(cv, [[ax + 6, ay], [ax + 6, ay + 1], [ax + 5, ay - 1]], "v");
    return crop(cv);
  });
}

// ---- The watering can: a green can with a brass rim and rose, a loop handle, held by the hand at its pivot.

function canPart(tilt: number): Painted & { name: string; tip: Pt } {
  // (A tilt of 0 is the can's own drawing turned 8 degrees up: the hold pose, tilted -22, leans it 14 degrees forward.)
  const th = (-(tilt + 8) * Math.PI) / 180;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const rot = ([x, y]: Pt): Pt => [x * c - y * s, x * s + y * c];
  const P = 22;
  const base = painted(`can:${tilt}`, () => {
    const cv = canvas(44, 44);
    const inv = (x: number, y: number): Pt => [(x - P) * c + (y - P) * s, -(x - P) * s + (y - P) * c];
    const bodyC = rot([7.5, 0.8]);
    const bodyL = (x: number, y: number) => 0.55 - 0.42 * ((x - P - bodyC[0]) / 5.2) - 0.5 * ((y - P - bodyC[1]) / 5.2);
    const handleC = rot([1.2, 0.5]);
    const handleL = (x: number, y: number) => 0.5 - 0.4 * ((x - P - handleC[0]) / 4) - 0.5 * ((y - P - handleC[1]) / 5.5);
    const spoutA: Pt = [10.5, 3.6];
    const spoutB: Pt = [16.2, -2.6];
    const dir: Pt = [0.68, -0.73];
    const roseC: Pt = [spoutB[0] + dir[0] * 0.9, spoutB[1] + dir[1] * 0.9];
    const roseRot = rot(roseC);
    for (let y = 0; y < 44; y++)
      for (let x = 0; x < 44; x++) {
        const [lx, ly] = inv(x, y);
        // handle
        const ho = ((lx - 1.2) / 3.4) ** 2 + ((ly - 0.5) / 5.6) ** 2 <= 1;
        const hi = ((lx - 1.2) / 1.5) ** 2 + ((ly - 0.5) / 3.3) ** 2 <= 1;
        if (ho && !hi) cv[y]![x] = green(handleL(x, y) - 0.12);
        // spout: a tapering tube from the body's lower front up to the rose
        const sx = spoutB[0] - spoutA[0];
        const sy = spoutB[1] - spoutA[1];
        const t = Math.max(0, Math.min(1, ((lx - spoutA[0]) * sx + (ly - spoutA[1]) * sy) / (sx * sx + sy * sy)));
        const d = Math.hypot(lx - (spoutA[0] + t * sx), ly - (spoutA[1] + t * sy));
        if (d <= 2.1 - 0.85 * t) {
          const nl = 0.55 - 0.5 * ((x - P - roseRot[0]) / 8) - 0.35 * ((y - P - roseRot[1]) / 8) + 0.2;
          cv[y]![x] = green(nl);
        }
        // body: a rounded block
        const bx = Math.abs(lx - 7.5);
        const by = Math.abs(ly - 0.8);
        if (bx <= 5.2 && by <= 5 && !(bx > 3.9 && by > 3.7)) cv[y]![x] = green(bodyL(x, y) + 0.05);
        // the open top: a brass rim round a dark mouth
        if (((lx - 7.5) / 5.7) ** 2 + ((ly + 3.9) / 1.9) ** 2 <= 1) cv[y]![x] = brass(bodyL(x, y) + 0.15);
        if (((lx - 7.5) / 3.9) ** 2 + ((ly + 3.9) / 1.0) ** 2 <= 1) cv[y]![x] = "E";
        // the rose on the spout's tip: a flat brass disc across its axis
        const ax = lx - roseC[0];
        const ay = ly - roseC[1];
        const along = ax * dir[0] + ay * dir[1];
        const across = -ax * dir[1] + ay * dir[0];
        if (Math.abs(along) <= 1.25 && Math.abs(across) <= 3.0) cv[y]![x] = brass(0.55 - 0.35 * (across / 3.0) * (dir[1] < 0 ? 1 : -1) - 0.3 * (along / 1.25) + 0.1);
      }
    return crop(cv);
  });
  const tipRot = rot([roseC0[0] + 1.2, roseC0[1] - 1.2]);
  return { ...base, at: [base.at[0] - P, base.at[1] - P], tip: [Math.round(tipRot[0]), Math.round(tipRot[1])] };
}
const roseC0: Pt = [16.8, -3.3];

// ---- Poses.

type Mood2 = Mood;
export type ArmName = "hold" | "up" | "high" | "waveL" | "waveM" | "waveR" | "point" | "low" | "side" | "lap" | "limp" | "cheer";
interface Arm {
  hand: Pt;
  tilt: number;
  /** An elbow's sag below the line from shoulder to hand. */
  sag?: number;
}
const SHOULDER: Pt = [30, 45];
const ARMS: Record<ArmName, Arm> = {
  hold: { hand: [29, 48], tilt: -22 },
  up: { hand: [34, 47], tilt: -12, sag: 2 },
  high: { hand: [37, 44], tilt: 6, sag: 1 },
  waveL: { hand: [36, 45], tilt: -4, sag: 1 },
  waveM: { hand: [37, 44], tilt: 6, sag: 1 },
  waveR: { hand: [38, 44], tilt: 16, sag: 1 },
  point: { hand: [34, 45], tilt: -42, sag: 1 },
  low: { hand: [31, 45], tilt: -50 },
  side: { hand: [30, 48], tilt: -32 },
  lap: { hand: [26, 49], tilt: -14 },
  limp: { hand: [33, 52], tilt: -80 },
  cheer: { hand: [34, 43], tilt: 20, sag: 1 },
};

export interface Pose {
  mood?: Mood2;
  /** The whole upper body down this many pixels (a breath, a crouch). */
  bob?: number;
  /** The upper body sideways (a sway); the feet stay. */
  sx?: number;
  /** The head on the body. */
  hx?: number;
  hy?: number;
  dx?: number;
  /** Off the ground. */
  air?: number;
  /** Feet: sideways shift and lift off the ground, per leg. */
  near?: { x?: number; lift?: number };
  far?: { x?: number; lift?: number };
  arm?: ArmName;
  /** Overrides for the arm: the can's tilt. */
  tilt?: number;
  /** A can set loose, apart from the hand: pivot x, y and tilt. */
  lone?: readonly [number, number, number];
  ear?: "mid" | "up" | "down";
  sprout?: Sprout;
  tail?: number;
  sit?: boolean;
  /** Sat down on the ground, legs out in front. */
  plop?: boolean;
  noShadow?: boolean;
}

interface Built {
  layers: Layer[];
  tip: Pt | null;
}

function build(p: Pose): Built {
  const dx = p.dx ?? 0;
  const air = p.air ?? 0;
  const bob = p.bob ?? 0;
  const sit = p.sit ?? false;
  const plop = p.plop ?? false;
  const ux = (sit ? -2 : 0) + dx + (p.sx ?? 0);
  const uy = (sit ? -2 : plop ? 4 : 0) + bob - air;
  const layers: Layer[] = [];
  const add = (l: { name: string; at: Pt }, ox = 0, oy = 0) => layers.push({ part: l.name, x: l.at[0] + ox, y: l.at[1] + oy });
  const put = (part: string, x: number, y: number) => layers.push({ part, x, y });
  if (!p.noShadow) put("shadow", 14 + dx, GROUND - 2);
  if (sit) put("stool", 12, 53);

  // The tail: a little stub off the back.
  const tl = p.tail ?? 0;
  add(painted(`tail:${tl}:${uy}`, () => strokePart([[14, 49 + uy], [10, 48 + uy - tl]], 1.5, true)), ux);

  // Legs.
  const legY = 58 - air;
  if (plop) {
    add(legPart([26, 54], 35, 58, true), dx, 0);
    add(legPart([22, 55], 32, 59, false), dx, 0);
  } else if (sit) {
    add(legPart([28 + dx, 51 + uy], 35 + (p.far?.x ?? 0) + dx, 57 - (p.far?.lift ?? 0), true));
  } else {
    const fl = p.far?.lift ?? 0;
    const nl = p.near?.lift ?? 0;
    add(legPart([30 + dx, 52 + uy], 29 + (p.far?.x ?? 0) + dx, legY - fl, true));
    add(legPart([19 + dx, 52 + uy], 18 + (p.near?.x ?? 0) + dx, legY - nl, false));
  }

  add(BODY_PART, ux, uy);
  if (sit) add(legPart([25 + dx, 52 + uy], 31 + (p.near?.x ?? 0) + dx, 58 - (p.near?.lift ?? 0), false));

  // The head: far ear behind it, sprout and near ear in front.
  const hx = HX0 + (p.hx ?? 0) + ux;
  const hy = HY0 + (p.hy ?? 0) + uy;
  const ear = p.ear ?? "mid";
  put(`earF:${ear}`, hx + 16, hy + (ear === "up" ? 0 : 1));
  put(`head:${p.mood ?? "calm"}`, hx, hy);
  const sp = p.sprout ?? "mid";
  put(`sprout:${sp}`, hx + 3 + SPROUT_AT[sp][0], hy - 6 + SPROUT_AT[sp][1]);
  put(`ear:${ear}`, hx + 3, hy + (ear === "up" ? 0 : ear === "down" ? 2 : 1));

  // The arm and the can.
  let tip: Pt | null = null;
  const armName = p.arm ?? "hold";
  const arm = ARMS[armName];
  const hand: Pt = [arm.hand[0] + ux, arm.hand[1] + uy];
  const tilt = p.tilt ?? arm.tilt;
  const shoulder: Pt = [SHOULDER[0] + ux, SHOULDER[1] + uy];
  const elbow: Pt = [Math.round((shoulder[0] + hand[0]) / 2), Math.round((shoulder[1] + hand[1]) / 2 + (arm.sag ?? 0) + 1)];
  add(painted(`arm:${shoulder};${elbow};${hand}`, () => strokePart([shoulder, elbow, hand], 2.7)));
  if (p.lone) {
    const lc = canPart(p.lone[2]);
    add(lc, p.lone[0], p.lone[1] - air);
    tip = [p.lone[0] + lc.tip[0], p.lone[1] - air + lc.tip[1]];
  } else {
    const can = canPart(tilt);
    add(can, hand[0], hand[1]);
    tip = [hand[0] + can.tip[0], hand[1] + can.tip[1]];
  }
  put("fist", hand[0] - 3, hand[1] - 2);
  return { layers, tip };
}

// ---- Effects: water, sparkles, dust, sweat, thoughts.

function seeded(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => ((s = (s * 1103515245 + 12345) >>> 0) >>> 8) / 16777216;
}
/** A drop: a pale pixel over a deeper one (water has no outline). */
const drop = (x: number, y: number, big = false): Speck[] => (big ? [[x, y, "4"], [x, y + 1, "3"], [x, y + 2, "2"]] : [[x, y, "3"], [x, y + 1, "2"]]);
/** A drop forming at the rose, then falling (`i` 0 to 4). */
function drip(tip: Pt, i: number): Speck[] {
  const ys = [2, 4, 8, 14, 20];
  const [x, y] = tip;
  const yy = Math.min(y + ys[i]!, GROUND - 3);
  return i === 0 ? [[x, yy, "3"]] : i === 4 ? [[x, GROUND - 2, "3"], [x - 1, GROUND - 2, "2"], [x + 1, GROUND - 2, "2"], [x, GROUND - 3, "4"]] : drop(x, yy, i === 3);
}
/** A little arc of drops thrown off the rose, `t` a frame number (the drops travel along it). */
function arcDrops(tip: Pt, t: number, reach = 12, height = 6, n = 10): Speck[] {
  const out: Speck[] = [];
  for (let k = 0; k < n; k++) {
    const fan = k % 2 ? 0.55 : 1;
    const u = (Math.floor(k / 2) / (n / 2) + t * 0.11 + (k % 2) * 0.09) % 1;
    const x = Math.round(tip[0] + 1 + u * reach * (k % 2 ? 0.85 : 1));
    const y = Math.round(tip[1] - height * fan * 4 * u * (1 - u) * (1 - 0.3 * u) + u * u * 9);
    out.push([x, y, u < 0.3 ? "4" : u < 0.65 ? "3" : "2"]);
    if (u > 0.3) out.push([x, y + 1, u > 0.65 ? "1" : "2"]);
    if (u < 0.3 && k % 2 === 0) out.push([x - 1, y + 1, "3"]);
  }
  return out;
}
/** A shower: drops thrown up and falling round the can (`t` a frame number). */
function shower(tip: Pt, t: number, n = 9): Speck[] {
  const rnd = seeded(t * 17 + 3);
  const out: Speck[] = [];
  for (let k = 0; k < n; k++) {
    const x = Math.round(tip[0] - 7 + rnd() * 20);
    const y = Math.round(tip[1] - 8 + rnd() * 24);
    out.push(...drop(x, y, k % 4 === 0));
  }
  return out;
}
/** A twinkle: a little plus. */
const star = (x: number, y: number, k = "M"): Speck[] => [[x, y, "w"], [x - 1, y, k], [x + 1, y, k], [x, y - 1, k], [x, y + 1, k]];
function twinkles(t: number, n = 3, box: readonly [number, number, number, number] = [6, 5, 58, 44]): Speck[] {
  const rnd = seeded(t * 31 + 5);
  return Array.from({ length: n }, (_, i) => star(Math.round(box[0] + rnd() * (box[2] - box[0])), Math.round(box[1] + rnd() * (box[3] - box[1])), (i + t) % 2 ? "M" : "3")).flat();
}
/** Petals drifting down (the sprout in flower). */
function petals(t: number, n = 6): Speck[] {
  const rnd = seeded(t * 13 + 1);
  return Array.from({ length: n }, (_, i): Speck => [Math.round(8 + rnd() * 48), Math.round(6 + rnd() * 40), i % 3 === 0 ? "M" : i % 3 === 1 ? "i" : "h"]);
}
/** Dust puffing out along the ground at the feet. */
const dust = (t: number): Speck[] =>
  [-1, 1].flatMap((side) =>
    [0, 1, 2].map((i): Speck => [Math.round(25 + side * (9 + i * 3 + t * 2)), GROUND - 1 - (i % 2) - (t > 0 ? 1 : 0), t > 1 ? "9" : "0"]),
  );
/** The shadow on the ground, growing as it drops in. */
const dropShadow = (r: number): Speck[] => Array.from({ length: r * 2 + 1 }, (_, i): Speck => [29 - r + i, GROUND - 1, "z"]);
/** Thought bubbles beside the head. */
const thoughts = (n: number): Speck[] => {
  const bubble = (rows: readonly string[], x0: number, y0: number): Speck[] =>
    rows.flatMap((row, j) => [...row].flatMap((k, i): Speck[] => (k === "." ? [] : [[x0 + i, y0 + j, k]])));
  const all: Speck[][] = [
    bubble(["TT", "tt"], 50, 24),
    bubble([".TT.", "TTTt", "TTtt", ".tt."], 53, 18),
    bubble([".TTTT..", "TTTTTT.", "TTTTTtt", "TTTTttt", ".tttttt", "..tttt."], 55, 7),
  ];
  return all.slice(0, n).flat();
};
/** Sweat flying off the head. */
const sweat = (i: number): Speck[] => {
  const t = i % 4;
  return [[10 - t, 22 + t, "~"], [10 - t, 23 + t, "w"], [47 + t, 20 + t, "~"], [47 + t, 21 + t, "w"]];
};
/** Wisps of dizziness (little stars) circling the head. */
const dizzy = (t: number, dy = 0, dx = 0): Speck[] => {
  const pts: Pt[] = [[20, 13], [28, 11], [36, 14], [32, 17], [24, 17]];
  return pts.flatMap(([x, y], i): Speck[] => ((i + t) % 3 === 0 ? star(x + dx, y + dy, "M") : [[x + dx, y + dy, "M"]]));
};
/** Water spilled along the ground from the fallen can's mouth (`n` 1 to 3: it spreads). */
const puddle = (n: number): Speck[] => {
  const w = [0, 3, 6, 9][n]!;
  const out: Speck[] = [];
  for (let i = 0; i < w; i++) {
    out.push([44 - i, GROUND - 1, i % 4 === 2 ? "3" : "2"]);
    if (i >= 1 && i <= w - 2) out.push([44 - i, GROUND - 2, i % 3 === 0 ? "4" : "3"]);
  }
  return out;
};

const FLASH: Record<string, string> = { a: "#a97c86", b: "#c4949a", c: "#dcb0b0", d: "#ecc9c3", e: "#f8e2da", f: "#e29aa2", g: "#edb0b3", h: "#f8cfc5", i: "#fde6dc", G: "#7fcfae", F: "#5fb596", H: "#bff0d6", E: "#4f8e7c" };

/** One frame: the pose, its water and anything extra. `pour`: what the can gives off this frame. */
type Pour = "none" | "drip" | "arc" | "shower" | "trickle";
interface Extras extends Partial<Frame> {
  pour?: Pour;
  t?: number;
  /** drip stage 0-4 */
  d?: number;
  reach?: number;
  height?: number;
}
function f(ms: number, p: Pose, extra: Extras = {}): Frame {
  const b = build(p);
  const { pour, t, d, reach, height, specks: more, ...rest } = extra;
  const tt = t ?? 0;
  let water: Speck[] = [];
  if (b.tip) {
    if (pour === "drip") water = drip(b.tip, d ?? 0);
    else if (pour === "arc") water = arcDrops(b.tip, tt, reach ?? 12, height ?? 6);
    else if (pour === "shower") water = [...arcDrops(b.tip, tt, reach ?? 10, height ?? 9), ...shower(b.tip, tt)];
    else if (pour === "trickle") water = [...drop(b.tip[0] + 1, b.tip[1] + 2 + (tt % 3)), ...drop(b.tip[0] + 2, b.tip[1] + 7 + ((tt * 2) % 5))];
  }
  const specks = [...water, ...(more ?? [])].map(([x, y, k]): Speck => [x + SHIFT, y, k]).filter(([x, y]) => x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2);
  return { ms, layers: b.layers.map((l) => ({ ...l, x: l.x + SHIFT })), ...rest, specks };
}

// ---- Animations.

/** Idle (3 s): sways, breathes, blinks, wiggles an ear; now and then the can drips a drop or two. */
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 30 }, (_, i) => {
    const bob = i % 15 >= 8 ? 1 : 0;
    const blink = i === 11 || i === 12 || i === 27;
    const ear = i === 20 || i === 21 ? "down" : i === 22 ? "up" : "mid";
    const sway = Math.round(1.1 * Math.sin((i / 30) * Math.PI * 2));
    const sprout: Sprout = sway > 0 ? "l" : sway < 0 ? "r" : "mid";
    const tail = i >= 4 && i <= 7 ? (i % 2 ? 2 : 1) : 0;
    const dripI = i >= 14 && i <= 18 ? i - 14 : i >= 23 && i <= 27 ? i - 23 : -1;
    return f(100, { bob, mood: blink ? "blink" : "calm", ear, sx: sway, hx: sway > 0 ? 1 : 0, sprout, tail, tilt: -22 }, dripI >= 0 ? { pour: "drip", d: dripI } : {});
  }),
};

/** Walk (0.6 s): a heavy, waddly little step, head bobbing, the can held close. */
const walk: Anim = {
  loop: true,
  frames: Array.from({ length: 6 }, (_, i) => {
    const th = (i / 6) * Math.PI * 2;
    const sn = Math.sin(th);
    const near = { x: Math.round(2 * Math.cos(th)), lift: Math.max(0, Math.round(3 * sn)) };
    const far = { x: Math.round(-2 * Math.cos(th)), lift: Math.max(0, Math.round(-3 * sn)) };
    const sx = sn > 0.4 ? 1 : sn < -0.4 ? -1 : 0;
    const bob = i % 3 === 0 ? 1 : 0;
    return f(100, { bob, sx, hy: bob ? 0 : -1, hx: sx, near, far, mood: "calm", ear: bob ? "down" : "mid", sprout: sx > 0 ? "l" : sx < 0 ? "r" : "mid", tail: sx, arm: "hold", tilt: -22 - (bob ? 4 : 0) }, i % 3 === 0 ? { cue: "step" } : {});
  }),
};

/** Sit (loops): on a stool at the chess table, facing the board, legs dangling, the can low in its lap; thinks about a move. */
const SIT: Pose = { sit: true, arm: "lap" };
const sit: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) => {
    const lean = i >= 6 && i <= 11;
    const blink = i === 3 || i === 4 || i === 13;
    const swing = i % 8 < 4 ? 0 : 1;
    return f(200, { ...SIT, mood: blink ? (lean ? "thinkBlink" : "blink") : lean ? "think" : "calm", bob: i % 8 >= 4 ? 1 : 0, hx: lean ? 2 : 0, hy: lean ? 1 : 0, ear: i === 9 ? "down" : "mid", sprout: i % 8 < 4 ? "mid" : "r", far: { lift: swing }, near: { lift: 1 - swing }, tail: swing }, i === 10 ? { pour: "trickle", t: i } : {});
  }),
};

/** Wave (once, 1.2 s): lifts the can and sprinkles a little arc of drops (a happy hello), then settles back to idle. */
const WAVES: readonly ArmName[] = ["waveL", "waveM", "waveR", "waveM", "waveL", "waveM"];
const wave: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 1, mood: "happy", arm: "hold" }),
    f(100, { mood: "cheer", arm: "up", hy: -1, ear: "up" }),
    ...WAVES.map((arm, i) => f(100, { mood: i % 2 ? "cheer" : "happy", arm, hx: arm === "waveL" ? -1 : arm === "waveR" ? 1 : 0, hy: i % 2 ? 0 : -1, bob: i % 2 ? 1 : 0, tail: i % 2 ? 2 : -1, ear: i % 3 === 1 ? "up" : "mid", sprout: i % 2 ? "l" : "r" }, { pour: "arc", t: i, reach: 13, height: 6, cue: i === 0 ? "sprinkle" : undefined })),
    f(100, { mood: "happy", arm: "up", sprout: "mid" }, { pour: "arc", t: 7, reach: 8, height: 3 }),
    f(100, { mood: "calm", arm: "hold", tilt: -22 }),
    f(200, { mood: "calm", arm: "hold", tilt: -22 }),
  ],
};

/** Entrance: drops in from above on its shadow, lands with a squash and a puff of dust, then lifts the can: ta-da. */
const entrance: Anim = {
  loop: false,
  frames: [
    { ms: 90, layers: [], specks: dropShadow(4).map(([x, y, k]): Speck => [x + SHIFT, y, k]) },
    { ms: 80, layers: [], specks: dropShadow(8).map(([x, y, k]): Speck => [x + SHIFT, y, k]) },
    f(70, { air: 7, mood: "cheer", arm: "up", near: { lift: 2 }, far: { lift: 3 }, ear: "up", noShadow: true }, { specks: dropShadow(11) }),
    f(70, { air: 3, mood: "cheer", arm: "up", near: { lift: 1 }, far: { lift: 2 }, ear: "up" }),
    f(100, { bob: 3, mood: "blink", arm: "hold", ear: "down", sprout: "r" }, { cue: "step", specks: dust(0) }),
    f(90, { bob: 1, mood: "happy", arm: "up", sprout: "l" }, { specks: dust(1) }),
    f(110, { mood: "cheer", arm: "high", hy: -1, ear: "up" }, { pour: "arc", t: 1, reach: 12, height: 7, specks: [...dust(2), ...twinkles(1, 2)] }),
    f(110, { mood: "happy", arm: "waveL", hx: -1, sprout: "r" }, { pour: "arc", t: 3, reach: 13, height: 6, specks: twinkles(2, 2) }),
    f(110, { mood: "happy", arm: "waveR", hx: 1, sprout: "l" }, { pour: "arc", t: 5, reach: 13, height: 6 }),
    f(120, { mood: "happy", arm: "hold", tilt: -22 }),
    f(300, { mood: "calm", arm: "hold", tilt: -22 }),
  ],
};

/** Thinking (loops): head tipped up, eyes up, a foot tapping, the can low, thought bubbles popping up. */
const thinking: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) =>
    f(150, { mood: i === 8 ? "thinkBlink" : "think", arm: "side", hx: 1, hy: -1, bob: i % 6 >= 3 ? 1 : 0, far: { lift: i % 4 === 1 ? 2 : 0 }, tail: i % 6 < 3 ? 1 : 0, ear: i === 5 ? "down" : "mid", sprout: i % 6 < 3 ? "l" : "mid" }, { specks: thoughts(i % 6 < 1 ? 0 : i % 6 < 3 ? 1 : i % 6 < 5 ? 2 : 3) }),
  ),
};

/** Its move: a hop toward the board and a little splash of the can at it. */
const move: Anim = {
  loop: false,
  frames: [
    f(90, { bob: 2, mood: "bold", arm: "hold" }),
    f(80, { air: 4, dx: 1, mood: "bold", arm: "point", near: { lift: 2 }, far: { lift: 3 }, ear: "up", sprout: "l" }, { cue: "sprinkle", pour: "arc", t: 1, reach: 10, height: 3 }),
    f(80, { air: 5, dx: 2, mood: "bold", arm: "point", near: { lift: 2 }, far: { lift: 2 } }, { pour: "arc", t: 3, reach: 11, height: 3 }),
    f(100, { bob: 2, dx: 2, mood: "happy", arm: "point", sprout: "r" }, { pour: "arc", t: 5, reach: 9, height: 2, specks: dust(0) }),
    f(100, { bob: 1, dx: 2, mood: "happy", arm: "point" }, { pour: "trickle", t: 2 }),
    f(110, { dx: 1, mood: "happy", arm: "hold" }),
    f(150, { mood: "calm", arm: "hold", tilt: -22 }),
  ],
};

/** A capture: two excited hops, the can waving high, a shower of drops and twinkles. */
const capture: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 2, mood: "bold", arm: "hold" }),
    f(80, { air: 5, mood: "cheer", arm: "high", near: { lift: 2 }, far: { lift: 3 }, ear: "up" }, { cue: "sprinkle", pour: "shower", t: 1, specks: twinkles(1) }),
    f(80, { air: 6, mood: "happy", arm: "waveL", near: { lift: 3 }, far: { lift: 3 }, hy: -1, sprout: "l" }, { pour: "shower", t: 2, specks: twinkles(2) }),
    f(80, { air: 4, mood: "happy", arm: "waveR", sprout: "r" }, { pour: "shower", t: 3, specks: twinkles(3) }),
    f(80, { bob: 2, mood: "cheer", arm: "high" }, { pour: "arc", t: 4, specks: dust(0) }),
    f(80, { air: 6, mood: "happy", arm: "waveM", near: { lift: 2 }, far: { lift: 3 }, ear: "up", sprout: "l" }, { pour: "shower", t: 5, specks: twinkles(4) }),
    f(80, { air: 6, mood: "happy", arm: "waveR", near: { lift: 3 }, far: { lift: 3 }, hy: -1, sprout: "r" }, { pour: "shower", t: 6, specks: twinkles(5) }),
    f(80, { air: 4, mood: "happy", arm: "waveL" }, { pour: "shower", t: 7, specks: twinkles(6) }),
    f(90, { bob: 2, mood: "cheer", arm: "high" }, { pour: "arc", t: 8, specks: dust(1) }),
    f(120, { bob: 1, mood: "happy", arm: "up" }, { pour: "arc", t: 9, reach: 8, height: 3 }),
    f(160, { mood: "smug", arm: "hold", tilt: -22 }),
  ],
};

/** Hurt: hit, a flash, eyes screwed shut, the can spilling; then it shakes it off with a brave little grin. */
const hurt: Anim = {
  loop: false,
  frames: [
    f(70, { bob: 2, mood: "hurt", arm: "low", ear: "down", sprout: "wilt" }, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    f(80, { bob: 3, mood: "hurt", arm: "low", ear: "down", sprout: "wilt" }, { shake: [-1, 0], pour: "trickle", t: 1, specks: sweat(0) }),
    f(90, { bob: 2, dx: -1, mood: "hurt", arm: "low", ear: "down", sprout: "wilt" }, { pour: "trickle", t: 2, specks: sweat(1) }),
    f(100, { bob: 1, dx: -1, mood: "rattled", arm: "side", sprout: "wilt" }, { pour: "trickle", t: 3 }),
    f(110, { mood: "blink", arm: "up", sprout: "r" }),
    f(120, { mood: "bold", arm: "up", sprout: "l" }),
    f(160, { mood: "calm", arm: "hold", tilt: -22 }),
  ],
};

/** Check: two sharp jabs of the can at the board, spraying, eyes bright. */
const JAB: Pose = { bob: 2, dx: 1, mood: "bold", arm: "point", ear: "up" };
const check: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 1, mood: "bold", arm: "up" }),
    f(110, { ...JAB }, { cue: "sprinkle", pour: "arc", t: 1, reach: 14, height: 3 }),
    f(90, { bob: 1, mood: "bold", arm: "up", sprout: "l" }),
    f(110, { ...JAB, sprout: "r" }, { cue: "sprinkle", pour: "arc", t: 4, reach: 14, height: 3 }),
    f(90, { bob: 1, dx: 1, mood: "bold", arm: "point" }, { pour: "arc", t: 6, reach: 10, height: 2 }),
    f(150, { dx: 1, mood: "happy", arm: "point" }, { pour: "trickle", t: 1 }),
    f(160, { mood: "smug", arm: "hold", tilt: -22 }),
  ],
};

/** Smug: chin up, eyes half shut, a little smirk, a slow nod, the can held just so. */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(150, { mood: "smug", arm: "hold", tilt: -26, hy: i < 3 || i > 5 ? -1 : 0, hx: i < 4 ? 0 : 1, bob: i % 4 === 2 ? 1 : 0, ear: i === 5 ? "up" : "mid", sprout: i < 4 ? "mid" : "l" })),
};

/** Rattled: wide eyes, worried brows, sweat flying, trembling where it stands, the can slopping water. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(80, { mood: "rattled", arm: "side", dx: i % 2 ? 1 : -1, bob: i % 4 === 2 ? 1 : 0, ear: "down", tail: i % 2 ? 1 : -1, sprout: i % 2 ? "l" : "r", tilt: i % 2 ? -26 : -36 }, { specks: sweat(i), pour: i % 2 ? "trickle" : "none", t: i })),
};

/** Defeat: hit, dizzy eyes, the can slips and spills a puddle, and it plops down on its bottom, dazed (the last frame holds). */
/** The dropped can, standing a little crooked on the ground beside the feet (the water already spilled out of it). */
const CAN_DOWN: readonly [number, number, number] = [44, 51, -22];
const defeat: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 2, mood: "hurt", arm: "low", ear: "down", sprout: "wilt" }, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    f(90, { bob: 2, dx: -1, mood: "out", arm: "low", ear: "down", sprout: "wilt" }, { pour: "trickle", t: 1, specks: dizzy(0) }),
    f(110, { bob: 3, dx: -1, mood: "out", arm: "limp", ear: "down", sprout: "wilt", lone: [43, 49, 24] }, { specks: dizzy(1) }),
    f(110, { plop: true, dx: -3, mood: "out", arm: "limp", ear: "down", sprout: "wilt", hy: 1, lone: CAN_DOWN }, { cue: "poof", shake: [0, 1], specks: [...dust(0), ...puddle(1), ...dizzy(2, 6)] }),
    f(120, { plop: true, dx: -3, mood: "out", arm: "limp", ear: "down", sprout: "wilt", hy: 2, hx: 1, lone: CAN_DOWN }, { specks: [...puddle(2), ...dizzy(0, 7)] }),
    f(1000, { plop: true, dx: -3, mood: "out", arm: "limp", ear: "down", sprout: "wilt", hy: 2, hx: 1, lone: CAN_DOWN, tail: 1 }, { specks: [...puddle(3), ...dizzy(1, 7)] }),
  ],
};

/** Victory: jumping for joy, the can high and showering, the sprout bursting into flower. Then again. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const air = [0, 3, 5, 5, 5, 3, 0, 0, 3, 5, 3, 0][i]!;
    const arms: ArmName[] = ["high", "waveL", "waveM", "waveR", "waveM", "waveL", "high", "high", "waveR", "waveM", "waveL", "high"];
    return f(110, { bob: i === 0 || i === 6 || i === 7 ? 2 : 0, air, mood: air > 2 ? "happy" : "cheer", arm: arms[i]!, near: air > 2 ? { lift: 3 } : {}, far: air > 2 ? { lift: 3 } : {}, hy: i % 2 ? -1 : 0, ear: air > 3 ? "up" : "mid", tail: i % 2 ? 2 : -1, sprout: "bloom" }, { pour: "shower", t: i, cue: i === 2 ? "sprinkle" : undefined, specks: [...petals(i, 4), ...twinkles(i, 1)] });
  }),
};

export const sidekickPuddles: Character = {
  id: "sidekick-puddles",
  name: "Puddles's sidekick",
  w: W,
  h: H,
  foot: [29 + SHIFT, GROUND],
  palette: SIDEKICK_PALETTE,
  halo: "#2c2430",
  parts: PARTS,
  anims: { idle, walk, sit, wave, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory },
};
