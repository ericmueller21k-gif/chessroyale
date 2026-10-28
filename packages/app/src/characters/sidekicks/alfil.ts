/**
 * Alfil's sidekick (id "sidekick-alfil"): a woolly baby mammoth, a town bot that wanders the square and plays chess at
 * the park's tables. No powers, never fights: a friendly, curious kid who copies the big one.
 *
 * Small, round and shaggy: a big fluffy head, big shiny eyes, a short trunk that curls and uncurls, tiny ivory nubs for
 * tusks, a round woolly body and four stubby legs. Its link to Alfil: his browns, the pale toenails, and ONE small prop
 * worn on its head: a little red and blue cap (a baby Nettipattam) with a gold tassel that swings. Three-quarters,
 * facing our right, light from the top left.
 *
 * Rigging: the body, the ears, the head (one per face) and the cap are painted once; the legs, the tail and the trunk
 * are painted from points per pose, so a new pose is a handful of numbers. Fur is soft: locks hang a pixel or two
 * below every lower edge.
 */
import { canvas, ellipse, inPoly, toGrid, type Canvas } from "../paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "../sprite.ts";

export const SIDEKICK_ALFIL_PALETTE = {
  k: "#1d120d", // outline
  a: "#4a2a17", // fur, dark to light (Alfil's browns)
  b: "#6f4124",
  c: "#94592f",
  d: "#b8743f",
  e: "#d39257",
  f: "#ebbb82",
  T: "#fffaea", // ivory: nubs and toenails
  t: "#ece0c1",
  U: "#c9b78f",
  V: "#9a8762",
  w: "#fbf7ee", // eye whites
  v: "#ffffff", // eye shine
  x: "#0c0806", // pupils, brows
  n: "#7f4a28", // the lower iris
  R: "#e0312a", // the cap: red, shade, highlight; blue, shade
  r: "#a51d24",
  Q: "#f5675a",
  B: "#2f63cc",
  N: "#1d3d8c",
  Y: "#f2c14e", // gold, its light, its shade
  y: "#ffe58a",
  O: "#b4840f",
  q: "#f28f80", // blush, ear inside, tongue
  s: "#c4695a",
  m: "#69190e", // mouth
  l: "#c98f4e", // stool wood, light to dark
  p: "#a06a33",
  o: "#6c4222",
  z: "#0d0e12", // ground shadow
  g: "#6e6253", // dust, thought bubbles
  G: "#a39582",
  j: "#8fd3ff", // sweat
  h: "#ff8fb8", // a heart
} as const;

type Pt = readonly [number, number];
type In = (x: number, y: number) => boolean;

/** The frame, and the ground (the first row below the toes). */
const W = 64;
const H = 54;
const GROUND = 51;

// ---- Painting kit.

const PARTS: Record<string, Part> = {};
interface Painted {
  name: string;
  at: Pt;
}
const MADE = new Map<string, Painted>();

function crop(cv: Canvas): { part: Part; at: Pt } {
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

/** A part painted once, by name, on a canvas the size of the frame, then cropped. */
function make(name: string, draw: (cv: Canvas) => void, outline = true): Painted {
  let p = MADE.get(name);
  if (!p) {
    const cv = canvas(W, H);
    draw(cv);
    const c = crop(cv);
    PARTS[name] = outline ? c.part : { ...c.part, outline: false };
    p = { name, at: c.at };
    MADE.set(name, p);
  }
  return p;
}

const ell = (cx: number, cy: number, rx: number, ry: number): In => (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
/** Light from the top left on a round surface (0 dark to 1 light). */
const roundL = (cx: number, cy: number, rx: number, ry: number, bias = 0) => (x: number, y: number) =>
  0.52 + bias - 0.42 * ((x + 0.5 - cx) / rx) - 0.5 * ((y + 0.5 - cy) / ry);

function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x + 1013, 374761393) ^ Math.imul(y + 7919, 668265263) ^ Math.imul(seed + 31, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A shape with soft locks hanging a pixel or two below its lower edges (top edges stay smooth). */
function shaggy(inside: In, seed: number, long: number): In {
  if (long <= 0) return inside;
  return (x, y) => {
    if (inside(x, y)) return true;
    const lock = Math.floor((x + seed) / 2);
    const len = Math.min(long, 1 + Math.floor(hash(lock, 0, seed) * long));
    for (let d = 1; d <= len; d++) if (inside(x, y - d) && (d < len || (x + seed) % 2 === 0)) return true;
    return false;
  };
}

/** Fur, banded by the light (dark to light), with short darker strands and a few bright glints. */
function fur(cv: Canvas, inside: In, light: (x: number, y: number) => number, seed: number, long = 1, ramp = "bcde", box: readonly [number, number, number, number] = [0, 0, W, H]): void {
  const all = shaggy(inside, seed, long);
  for (let y = Math.max(0, box[1]); y < Math.min(H, box[3]); y++)
    for (let x = Math.max(0, box[0]); x < Math.min(W, box[2]); x++) {
      if (!all(x, y)) continue;
      const core = inside(x, y);
      let i = Math.max(0, Math.min(ramp.length - 1, Math.floor(light(x, y) * ramp.length)));
      if (!core) i = Math.max(0, i - 2);
      else if (i >= 1 && hash(x, Math.floor((y + (x % 3)) / 3), seed) < 0.22) i -= 1;
      let k = ramp[i]!;
      if (core && i === ramp.length - 1 && hash(x, y, seed + 9) < 0.1) k = "f";
      cv[y]![x] = k;
    }
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

// ---- Strokes: a round stroke along points (legs, trunk, tail).

function segNear(p: Pt, a: Pt, b: Pt): { d: number; nx: number; ny: number; t: number } {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy || 1)));
  const nx = p[0] - (a[0] + t * vx);
  const ny = p[1] - (a[1] + t * vy);
  return { d: Math.hypot(nx, ny), nx, ny, t };
}
function strokeAt(pts: readonly Pt[], r0: number, r1: number, p: Pt): { s: number; d: number; nx: number; ny: number; rr: number } {
  let best = { s: 0, d: 1e9, nx: 0, ny: 0, rr: r0 };
  for (let i = 0; i + 1 < pts.length; i++) {
    const n = segNear(p, pts[i]!, pts[i + 1]!);
    const s = (i + n.t) / (pts.length - 1);
    const rr = r0 + (r1 - r0) * s;
    if (n.d - rr < best.d - best.rr) best = { s, d: n.d, nx: n.nx, ny: n.ny, rr };
  }
  return best;
}
/** A smooth curve through points (Catmull-Rom). */
function smooth(pts: readonly Pt[], n = 4): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const c = (a: number, b: number, cc: number, d: number) => 0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (-a + 3 * b - 3 * cc + d) * t3);
      out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
}
const boxOf = (pts: readonly Pt[], pad: number): [number, number, number, number] => [
  Math.floor(Math.min(...pts.map((p) => p[0]))) - pad,
  Math.floor(Math.min(...pts.map((p) => p[1]))) - pad,
  Math.ceil(Math.max(...pts.map((p) => p[0]))) + pad + 1,
  Math.ceil(Math.max(...pts.map((p) => p[1]))) + pad + 1,
];
const r2 = (v: number) => Math.round(v * 2) / 2;
const keyOf = (pts: readonly Pt[]) => pts.map((p) => `${r2(p[0])},${r2(p[1])}`).join(";");

// ---- Faces: big round shiny eyes (a dark eye with a white shine), blush, a little smile.

export type Mood = "calm" | "blink" | "happy" | "cheer" | "think" | "thinkBlink" | "smug" | "rattled" | "hurt" | "out" | "bold";
type Eye = "open" | "up" | "wide" | "half" | "arc" | "shut" | "pinch" | "x";
type Brow = "up" | "worried" | "bold" | "smug";
type Mouth = "smile" | "grin" | "flat" | "smirk" | "wavy" | "o" | "tongue";

/** The near eye (6 x 6, on our left) and the far one (5 x 5). */
const NEAR_EYE: Record<Eye, readonly string[]> = {
  open: [".kkkk.", "kvvxxk", "kvxxxk", "kxxxnk", "kxxnnk", ".kkkk."],
  up: [".kkkk.", "kxxvvk", "kxxxvk", "knxxxk", "knnxxk", ".kkkk."],
  wide: [".kkkk.", "kwwwwk", "kwwxxk", "kwwxxk", "kwwwwk", ".kkkk."],
  half: ["......", "kkkkkk", "kvxxxk", "kxxxnk", ".kkkk.", "......"],
  arc: ["......", "......", ".kkkk.", "k....k", "......", "......"],
  shut: ["......", "......", "......", "kkkkkk", "......", "......"],
  pinch: ["......", "kk....", ".kkk..", "...kkk", ".kkk..", "kk...."],
  x: ["k....k", ".k..k.", "..kk..", "..kk..", ".k..k.", "k....k"],
};
const FAR_EYE: Record<Eye, readonly string[]> = {
  open: [".kkk.", "kvxxk", "kvxxk", "kxxnk", ".kkk."],
  up: [".kkk.", "kxvvk", "kxxvk", "knxxk", ".kkk."],
  wide: [".kkk.", "kwwwk", "kwxxk", "kwwwk", ".kkk."],
  half: [".....", "kkkkk", "kvxxk", ".kkk.", "....."],
  arc: [".....", ".....", ".kkk.", "k...k", "....."],
  shut: [".....", ".....", ".....", "kkkkk", "....."],
  pinch: [".....", "kk...", ".kkk.", "...kk", "....."],
  x: ["k...k", ".k.k.", "..k..", ".k.k.", "k...k"],
};
/** Brows (frame coordinates at rest): [near, far]. */
const BROWS: Record<Brow, readonly [readonly Pt[], readonly Pt[]]> = {
  up: [[[27, 18], [28, 18], [29, 18]], [[42, 18], [43, 18], [44, 18]]],
  worried: [[[26, 20], [27, 19], [28, 19], [29, 18]], [[41, 18], [42, 19], [43, 19], [44, 20]]],
  bold: [[[26, 19], [27, 19], [28, 19], [29, 19]], [[41, 19], [42, 19], [43, 19], [44, 19]]],
  smug: [[[26, 19], [27, 19], [28, 19]], [[42, 17], [43, 17], [44, 18]]],
};
const MOUTHS: Record<Mouth, { rows: readonly string[]; at: Pt }> = {
  smile: { rows: ["k....k", ".kkkk."], at: [26, 29] },
  grin: { rows: ["kkkkk", "kmmmk", ".kqk."], at: [26, 29] },
  flat: { rows: ["kkkk"], at: [27, 30] },
  smirk: { rows: ["...kk", "kkkk."], at: [26, 30] },
  wavy: { rows: ["k.k.k", ".k.k."], at: [26, 30] },
  o: { rows: [".kk.", "kmmk", ".kk."], at: [27, 29] },
  tongue: { rows: ["kkkkk", "kmqqk", ".kqk."], at: [26, 29] },
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
const MOODS = Object.keys(FACES) as Mood[];

// ---- The head: skull and muzzle in soft fur, the face, two ivory nubs by the trunk.

const HEAD = { cx: 33.5, cy: 25, rx: 13.5, ry: 11.5 };

function headPart(mood: Mood): Painted {
  return make(`head:${mood}`, (cv) => {
    const skull = ell(HEAD.cx, HEAD.cy, HEAD.rx, HEAD.ry);
    const muzzle = ell(38, 30, 8, 6.4);
    // Tufts of hair standing up either side of the cap.
    // A high dome of hair on the back of its head (a mammoth's), its top a little scalloped.
    const crownL = inPoly([[21, 22], [20.8, 16], [22, 13.4], [23.2, 12.2], [24.2, 10.4], [26, 10.6], [27.4, 9.2], [29.2, 9.8], [30.4, 10.6], [32, 12], [33, 16], [33, 22]]);
    const crownR = inPoly([[40, 17], [41, 14.6], [43, 15.4], [44.6, 15.2], [45.4, 19]]);
    const inside: In = (x, y) => skull(x, y) || muzzle(x, y) || crownL(x, y) || crownR(x, y);
    fur(cv, inside, roundL(31, 21, 17, 15, 0.12), 3, 3);
    // Bangs hanging over the brow, under the cap.
    for (let x = 27; x <= 40; x++) {
      if (hash(x, 0, 21) < 0.65) cv[17]![x] = x % 3 === 0 ? "b" : "c";
      if (hash(x, 1, 22) < 0.3) cv[18]![x] = "b";
    }
    // Ivory nubs: tiny, either side of the trunk.
    stamp(cv, [".kkk.", "kTTtk", "kTtUk", ".kUVk", "..kk."], 29, 31);
    stamp(cv, [".kk.", "kTUk", "kUVk", ".kk."], 40, 32);
    const face = FACES[mood];
    stamp(cv, NEAR_EYE[face.near], 26, 21);
    stamp(cv, FAR_EYE[face.far], 41, 21);
    if (face.blush) {
      dots(cv, [[24, 28], [25, 28], [26, 28]], "q");
      dots(cv, [[43, 27], [44, 27], [45, 27]], "q");
    }
    if (face.brow) for (const side of BROWS[face.brow]) dots(cv, side, "a");
    const m = MOUTHS[face.mouth];
    stamp(cv, m.rows, m.at[0], m.at[1]);
  });
}
for (const m of MOODS) headPart(m);

/** An ear behind the head, sticking out to our left: round and soft, pink inside. */
function earPart(kind: "mid" | "up" | "down"): Painted {
  return make(`ear:${kind}`, (cv) => {
    const [cx, cy, rx, ry] = kind === "mid" ? [19, 25.5, 6.5, 8] : kind === "up" ? [16.5, 22.5, 6.5, 8] : [20, 29, 6, 8];
    const e = ell(cx, cy, rx, ry);
    fur(cv, e, roundL(cx - 1, cy - 2, rx * 1.4, ry * 1.4, 0.0), 4, 1);
    const inner = ell(cx + 0.5, cy + 0.5, rx * 0.55, ry * 0.62);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inner(x, y) && e(x, y)) cv[y]![x] = x + y < cx + cy - 3 ? "q" : "s";
  });
}

/** The little cap: red dome, a blue band with a small gold diamond, a gold rim and a button on top. */
function capPart(): Painted {
  return make("cap", (cv) => {
    const dome = ell(35.2, 16.5, 7.8, 6.6);
    const light = roundL(32.5, 12.5, 10, 7, 0.04);
    for (let y = 9; y <= 14; y++)
      for (let x = 22; x <= 45; x++) {
        if (!dome(x, y)) continue;
        const band = y >= 13;
        const l = light(x, y);
        cv[y]![x] = band ? (l > 0.42 ? "B" : "N") : l > 0.78 ? "Q" : l > 0.4 ? "R" : "r";
      }
    for (let x = 28; x <= 42; x++) {
      cv[15]![x] = x < 34 ? "y" : "Y";
      cv[16]![x] = "O";
    }
    stamp(cv, [".y.", "YRO", ".O."], 34, 12);
    stamp(cv, ["yY"], 34, 9);
  });
}

/** The tassel, hanging from the cap's back rim: `s` swings its tip a pixel or two. */
function tasselPart(s: number): Painted {
  return make(`tassel:${s}`, (cv) => {
    const rows = [".O.", ".Y.", "yYO", "yYO", "YyO", "YyO", "YOO", ".O."];
    rows.forEach((row, i) => {
      const sh = i < 2 ? 0 : i < 5 ? Math.trunc(s / 2) : s;
      stamp(cv, [row], 22 + sh, 16 + i);
    });
    // The cord from the cap's rim.
    dots(cv, [[25, 16], [26, 16], [27, 16]], "O");
  });
}

// ---- The body: a round woolly barrel, a skirt of locks along its belly.

const BODY = { cx: 26, cy: 35.5, rx: 14.5, ry: 9 };
function bodyPart(): Painted {
  return make("body", (cv) => {
    // A hump over the shoulders, the rump lower and rounder behind.
    const a = ell(27.5, 33.5, 13.5, 9.4);
    const b = ell(19.5, 36.5, 9.5, 7);
    const e: In = (x, y) => a(x, y) || b(x, y);
    fur(cv, e, roundL(24, 29, 18, 15, -0.1), 5, 0);
    // A skirt of pointed locks along its belly, hanging over the tops of the legs.
    for (let x = 11; x <= 41; x++) {
      let yb = -1;
      for (let y = H - 1; y >= 0; y--) if (cv[y]![x] !== ".") { yb = y; break; }
      if (yb < 0) continue;
      const q = Math.floor((x + 1) / 3);
      const amp = 2 + Math.floor(hash(q, 5, 8) * 2);
      const len = (x + 1) % 3 === 1 ? amp : 1;
      for (let d = 1; d <= len; d++) cv[yb + d]![x] = d === len ? "a" : "b";
    }
    // Little tufts standing up along the back, over the shoulders.
    for (let x = 12; x <= 24; x++) {
      let y = 0;
      while (y < H && cv[y]![x] === ".") y++;
      if (y > 2 && y < H && hash(x >> 1, 4, 11) < 0.5) cv[y - 1]![x] = "d";
    }
    // Locks sticking out behind the rump.
    for (let y = 30; y <= 44; y++) {
      let x = 0;
      while (x < W && cv[y]![x] === ".") x++;
      if (x > 6 && hash(0, y >> 1, 7) < 0.55) cv[y]![x - 1] = hash(1, y, 3) < 0.5 ? "b" : "c";
    }
  });
}

// ---- Legs, tail, trunk.

const NAILS = "tUtU";
/** A stubby furry leg through `pts`, flat at `clipY` (its last row), pale toenails along its foot. */
function legPart(pts: readonly Pt[], clipY: number, far: boolean, seed: number, r = 3): Painted {
  return make(`leg:${far ? 1 : 0}:${clipY}:${r}:${keyOf(pts)}`, (cv) => {
    const sp = smooth(pts, 3);
    const inside: In = (x, y) => y <= clipY && strokeAt(sp, r, r, [x + 0.5, y + 0.5]).d <= r;
    const light = (x: number, y: number) => {
      const s = strokeAt(sp, r, r, [x + 0.5, y + 0.5]);
      return (far ? 0.4 : 0.58) - 0.45 * (s.nx / r) - 0.3 * (s.ny / r);
    };
    fur(cv, inside, light, seed, 0, "bcde", boxOf(pts, 5));
    const end = pts[pts.length - 1]!;
    const ex = Math.round(end[0]);
    for (let i = 0; i < 4; i++) if (cv[clipY]?.[ex - 2 + i] && cv[clipY]![ex - 2 + i] !== ".") cv[clipY]![ex - 2 + i] = NAILS[i]!;
  });
}

/** The tail: a short rope of fur with a darker tuft. */
function tailPart(pts: readonly Pt[], key: string): Painted {
  return make(`tail:${key}`, (cv) => {
    const sp = smooth(pts, 3);
    const end = pts[pts.length - 1]!;
    const rope: In = (x, y) => strokeAt(sp, 1, 0.8, [x + 0.5, y + 0.5]).d <= 1;
    const tuft = ell(end[0], end[1] + 0.5, 1.7, 2.2);
    const inside: In = (x, y) => rope(x, y) || tuft(x, y);
    fur(cv, inside, (x, y) => 0.5 + 0.1 * (tuft(x, y) ? 0 : 1) - 0.08 * (y - end[1]), 2, 0, "bcde", boxOf([...pts, [end[0], end[1] + 3]], 4));
  });
}

type TrunkKind = "hang0" | "hang1" | "hang2" | "hang3" | "chin" | "lift" | "up" | "point" | "limp";
const ROOT: Pt = [36.5, 26.5];
/** The trunk's points at rest (before the head's offset). `s` sways a raised or pointing one. */
function trunkShape(kind: TrunkKind, s = 0): Pt[] {
  switch (kind) {
    case "hang0":
      return [ROOT, [36.8, 31], [37, 35], [37.2, 38.4]];
    case "hang1":
      return [ROOT, [36.8, 31], [37.2, 35], [38.2, 38], [40.4, 39]];
    case "hang2":
      return [ROOT, [36.8, 31], [37.4, 35], [39, 37.8], [41.6, 38.2], [42.8, 36]];
    case "hang3":
      return [ROOT, [36.8, 31], [37.6, 34.8], [39.6, 37.2], [42.4, 37], [43.4, 34.4], [41.6, 33.2]];
    case "chin":
      return [ROOT, [37, 31], [38.6, 34.8], [41.6, 35.6], [44.2, 33.4], [43.8, 30.4], [41.6, 30.2]];
    case "lift":
      return [ROOT, [38.5, 31], [42, 34], [46, 33.6], [48.2, 30.4]];
    case "up":
      return [ROOT, [41, 30], [46.5, 29.5], [50, 25], [51 + s * 0.5, 19], [50.5 + s * 1.8, 13.5]];
    case "point":
      return [ROOT, [38.5, 30.5], [42.5, 33], [47, 33.4], [50, 32.2], [51.4, 30]];
    case "limp":
      return [ROOT, [37.5, 31.5], [38.5, 36.5], [41, 40], [45, 41.6], [48, 41]];
  }
}
function trunkPart(pts: readonly Pt[]): Painted {
  return make(`trunk:${keyOf(pts)}`, (cv) => {
    const sp = smooth(pts, 4);
    let total = 0;
    for (let i = 0; i + 1 < sp.length; i++) total += Math.hypot(sp[i + 1]![0] - sp[i]![0], sp[i + 1]![1] - sp[i]![1]);
    const r0 = 2.5;
    const r1 = 1.5;
    const box = boxOf(pts, 4);
    for (let y = Math.max(0, box[1]); y < Math.min(H, box[3]); y++)
      for (let x = Math.max(0, box[0]); x < Math.min(W, box[2]); x++) {
        const s = strokeAt(sp, r0, r1, [x + 0.5, y + 0.5]);
        if (s.d > s.rr) continue;
        let l = 0.64 - 0.45 * (s.nx / s.rr) - 0.35 * (s.ny / s.rr);
        const along = s.s * total;
        if (s.s > 0.12 && s.s < 0.86 && Math.floor(along / 2.6) % 2 === 1 && Math.abs(s.nx) < s.rr * 0.8) l -= 0.2;
        cv[y]![x] = "bcde"[Math.max(0, Math.min(3, Math.floor(l * 4)))]!;
      }
  });
}

const shadowPart = (): Painted =>
  make(
    "shadow",
    (cv) => {
      ellipse(cv, 26, GROUND - 1, 17, 1.5, "z");
    },
    false,
  );

const stoolPart = (): Painted =>
  make("stool", (cv) => {
    for (let x = 8; x <= 32; x++) {
      cv[41]![x] = "l";
      cv[42]![x] = "p";
      cv[43]![x] = "o";
    }
    for (const x of [10, 29]) for (let y = 44; y <= 50; y++) [cv[y]![x], cv[y]![x + 1]] = [y < 50 ? "p" : "o", "o"];
    for (let x = 12; x <= 28; x++) cv[48]![x] = "o";
  });

/** The body sitting up on its haunches: tilted, its rump low on the stool, its chest up toward the board. */
function bodySitPart(): Painted {
  return make("bodySit", (cv) => {
    const a = (24 * Math.PI) / 180;
    const cx = 25;
    const cy = 31.5;
    const e: In = (x, y) => {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const u = dx * Math.cos(a) - dy * Math.sin(a);
      const v = dx * Math.sin(a) + dy * Math.cos(a);
      return (u / 14.2) ** 2 + (v / 9.6) ** 2 <= 1;
    };
    fur(cv, e, roundL(22, 28, 18, 15, -0.1), 5, 0);
    for (let x = 10; x <= 41; x++) {
      let yb = -1;
      for (let y = H - 1; y >= 0; y--) if (cv[y]![x] !== ".") { yb = y; break; }
      if (yb < 0) continue;
      const q = Math.floor((x + 1) / 3);
      const amp = 2 + Math.floor(hash(q, 5, 8) * 2);
      const len = (x + 1) % 3 === 1 ? amp : 1;
      for (let d = 1; d <= len; d++) cv[yb + d]![x] = d === len ? "a" : "b";
    }
    for (let x = 11; x <= 22; x++) {
      let y = 0;
      while (y < H && cv[y]![x] === ".") y++;
      if (y > 2 && y < H && hash(x >> 1, 4, 11) < 0.5) cv[y - 1]![x] = "d";
    }
  });
}

// ---- Poses.

export interface Pose {
  mood?: Mood;
  /** Everything above the feet down this many pixels (a breath, a crouch). */
  bob?: number;
  /** The head on the body. */
  hx?: number;
  hy?: number;
  dx?: number;
  /** Off the ground. */
  air?: number;
  /** Feet: sideways shift and lift, per leg. */
  feet?: Partial<Record<LegKey, { x?: number; lift?: number }>>;
  trunk?: TrunkKind;
  /** Sway of a raised or pointing trunk. */
  ts?: number;
  ear?: "mid" | "up" | "down";
  /** The tassel's swing (-2 to 2) and the cap knocked askew. */
  tassel?: number;
  capDx?: number;
  capDy?: number;
  tail?: 0 | 1 | 2;
  /** Sitting on the stool: how far its feet swing (-1, 0, 1). */
  sit?: boolean;
  swing?: number;
  /** Slumped on its belly (defeat). */
  lie?: boolean;
  noShadow?: boolean;
}
type LegKey = "nh" | "fh" | "ff" | "nf";
const LEG_X: Record<LegKey, number> = { nh: 16, fh: 21, ff: 29, nf: 34 };

function build(p: Pose): { layers: Layer[]; tip: Pt } {
  const dx = p.dx ?? 0;
  const air = p.air ?? 0;
  const sit = !!p.sit;
  const lie = !!p.lie;
  const by = (lie ? 4 : sit ? -2 : 0) + (p.bob ?? 0) - air;
  const hox = dx + (p.hx ?? 0) + (lie ? 3 : 0);
  const hoy = by + (p.hy ?? 0) + (lie ? 3 : 0);
  const layers: Layer[] = [];
  const put = (l: Painted, ox = 0, oy = 0) => layers.push({ part: l.name, x: l.at[0] + ox, y: l.at[1] + oy });
  if (!p.noShadow) put(shadowPart(), dx, 0);

  // The tail, behind the body (hanging behind the stool, when it sits).
  const t = p.tail ?? 0;
  const tailPts: Pt[] = sit ? (t === 0 ? [[12, 38 + by], [9, 40 + by], [7.5, 44 + by]] : [[12, 38 + by], [8.5, 39 + by], [6, 42.5 + by]]) : t === 0 ? [[12, 33 + by], [9, 34 + by], [8, 38 + by]] : t === 1 ? [[12, 33 + by], [8.5, 33 + by], [6.5, 35.5 + by]] : [[12, 33 + by], [8.5, 31 + by], [6.5, 28.5 + by]];
  put(tailPart(tailPts, `${t}:${by}:${sit ? 1 : 0}`), dx, 0);
  if (sit) put(stoolPart(), dx, 0);

  const footY = (lift: number) => GROUND - 1 - air - lift;
  const stand = (k: LegKey, far: boolean) => {
    const f = p.feet?.[k] ?? {};
    const lift = f.lift ?? 0;
    const cy = footY(lift);
    const x = LEG_X[k];
    put(legPart([[x, 36 + by], [x + (f.x ?? 0), cy - 1]], cy, far, far ? 11 : 13 + (k === "nf" ? 4 : 0)), dx, 0);
  };
  const SW = p.swing ?? 0;
  if (lie) {
    // Tucked under it: only the forelegs stretch out ahead on the ground.
  } else if (sit) {
    put(legPart([[26, 38 + by], [31, 41 + by], [34 + SW, 45]], 46, true, 11), dx, 0);
    put(legPart([[39, 36 + by], [40.5, 40 + by], [41 - SW, 44]], 45, true, 17), dx, 0);
  } else {
    stand("fh", true);
    stand("ff", true);
    stand("nh", false);
    stand("nf", false);
  }
  put(sit ? bodySitPart() : bodyPart(), dx, by);
  if (sit) {
    put(legPart([[23, 36 + by], [29, 39 + by], [32, 42 + by], [33 + SW, 46]], 47, false, 13, 3.6), dx, 0);
    put(legPart([[35.5, 36 + by], [37, 40 + by], [38 - SW, 44.5]], 46, false, 19), dx, 0);
  }
  if (lie) put(legPart([[34, 45], [39, 47.5], [44, 48.5]], 49, false, 13), dx, 0);

  // The head: ear behind, then the face, the cap and its tassel, the trunk in front.
  put(earPart(p.ear ?? "mid"), hox, hoy);
  put(headPart(p.mood ?? "calm"), hox, hoy);
  put(capPart(), hox + (p.capDx ?? 0), hoy + (p.capDy ?? 0));
  put(tasselPart(p.tassel ?? 0), hox + (p.capDx ?? 0), hoy + (p.capDy ?? 0));
  const tr = trunkShape(p.trunk ?? "hang1", p.ts ?? 0).map(([x, y]): Pt => [x + hox, y + hoy]);
  put(trunkPart(tr));
  return { layers, tip: tr[tr.length - 1]! };
}

// ---- Little effects.

const star = (x: number, y: number, k = "y"): Speck[] => [[x, y, "v"], [x - 1, y, k], [x + 1, y, k], [x, y - 1, k], [x, y + 1, k]];
const heart = (x: number, y: number): Speck[] => [[x, y, "h"], [x + 2, y, "h"], [x - 1, y + 1, "h"], [x, y + 1, "h"], [x + 1, y + 1, "h"], [x + 2, y + 1, "h"], [x + 3, y + 1, "h"], [x, y + 2, "h"], [x + 1, y + 2, "h"], [x + 2, y + 2, "h"], [x + 1, y + 3, "h"]];
/** A toot: short lines fanning out from the trunk's tip. */
const toot = ([x, y]: Pt, t: number): Speck[] => {
  const X = Math.round(x);
  const Y = Math.round(y);
  const r = 3 + t;
  return [[X + r, Y - 2 - t, "y"], [X + r + 1, Y - 3 - t, "y"], [X + r + 1, Y, "y"], [X + r + 2, Y, "y"], [X + r - 1, Y - 5 - t, "y"], [X + r - 1, Y - 6 - t, "y"]];
};
const dust = (t: number): Speck[] =>
  [-1, 1].flatMap((side) => [0, 1, 2].map((i): Speck => [Math.round(26 + side * (9 + i * 3 + t * 2)), GROUND - 1 - (i % 2) - (t > 0 ? 1 : 0), t > 1 ? "G" : "g"]));
const dropShadow = (r: number): Speck[] => Array.from({ length: r * 2 + 1 }, (_, i): Speck => [26 - r + i, GROUND - 1, "z"]);
const thoughts = (n: number): Speck[] =>
  ([[50, 17], [54, 13], [58, 9]] as const).slice(0, n).flatMap(([x, y], k): Speck[] => {
    const big = k === 2;
    return [[x, y, "w"], [x + 1, y, "w"], [x, y + 1, "w"], [x + 1, y + 1, "G"], ...(big ? ([[x - 1, y, "w"], [x + 2, y, "w"], [x, y - 1, "w"], [x + 1, y - 1, "w"], [x - 1, y + 1, "G"], [x + 2, y + 1, "G"], [x, y + 2, "G"], [x + 1, y + 2, "G"]] as Speck[]) : [])];
  });
const sweat = (i: number): Speck[] => {
  const t = i % 4;
  return [[21 - t, 17 + t, "j"], [21 - t, 18 + t, "v"], [47 + t, 15 + t, "j"], [47 + t, 16 + t, "v"]];
};
/** Tufts of fur knocked off by a hit. */
const tufts = (t: number): Speck[] =>
  [[-1.2, -1.2, 18, 20], [1.2, -1.4, 46, 20], [1.7, -0.3, 47, 26], [-1.8, -0.3, 16, 28]].flatMap(([vx, vy, ox, oy], i): Speck[] => {
    const px = Math.round(ox! + vx! * t * 2.6);
    const py = Math.round(oy! + vy! * t * 2.6 + 0.6 * t * t);
    return [[px, py, i % 2 ? "e" : "f"], [px + 1, py, "d"]];
  });
const dizzy = (t: number, cx: number, cy: number): Speck[] =>
  [0, 1, 2].flatMap((i) => {
    const a = (t * 0.9 + i * 2.09);
    return star(Math.round(cx + Math.cos(a) * 9), Math.round(cy + Math.sin(a) * 2.5), i % 2 ? "y" : "Y");
  });

const FLASH: Record<string, string> = { a: "#8a6f5e", b: "#b49580", c: "#d8bba3", d: "#efd9c4", e: "#fff1e2", f: "#ffffff" };

function f(ms: number, p: Pose, extra: Partial<Frame> = {}): Frame {
  const b = build(p);
  const specks = (extra.specks ?? []).filter(([x, y]) => x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2);
  return { ms, layers: b.layers, ...extra, specks };
}
const tipOf = (p: Pose): Pt => build(p).tip;

// ---- Animations.

/** Idle (3 s): breathes, blinks, its trunk curls and uncurls, an ear flaps, its tail flicks, the tassel nods. */
const CURL: readonly TrunkKind[] = ["hang1", "hang1", "hang1", "hang1", "hang2", "hang2", "hang2", "hang3", "hang3", "hang3", "hang2", "hang2", "hang1", "hang1", "hang1", "hang0", "hang0", "hang0", "hang0", "hang1", "hang1", "hang1", "hang1", "hang1"];
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 24 }, (_, i) => {
    const bob = i % 12 >= 6 ? 1 : 0;
    const blink = i === 9 || i === 10 || i === 21;
    const hx = i >= 4 && i <= 9 ? 1 : 0;
    const tail = ([14, 16].includes(i) ? 1 : i === 15 ? 2 : 0) as 0 | 1 | 2;
    return f(125, { bob, hx, mood: blink ? "blink" : "calm", trunk: CURL[i]!, tail, ear: i === 6 || i === 7 ? "up" : i === 19 || i === 20 ? "down" : "mid", tassel: i === 5 || i === 11 ? 1 : i === 4 || i === 10 ? -1 : 0 });
  }),
};

/** Walk (0.6 s): a plodding four-legged step, diagonal pairs, the head bobbing, the tassel swinging. */
const walk: Anim = {
  loop: true,
  frames: Array.from({ length: 6 }, (_, i) => {
    const th = (i / 6) * Math.PI * 2;
    const leg = (off: number) => ({ x: Math.round(2.5 * Math.sin(th + off * Math.PI * 2)), lift: Math.max(0, Math.round(2.2 * Math.cos(th + off * Math.PI * 2))) });
    const down = i % 3 === 0 ? 0 : 1;
    return f(100, { bob: down, hy: i % 3 === 0 ? -1 : 0, hx: 1, mood: "calm", feet: { nh: leg(0), ff: leg(0), fh: leg(0.5), nf: leg(0.5) }, trunk: i % 3 === 0 ? "hang1" : "hang2", tail: i < 3 ? 1 : 0, ear: down ? "down" : "mid", tassel: [1, 2, 0, -1, -2, 0][i]! }, i % 3 === 0 ? { cue: "step" } : {});
  }),
};

/** Sit (loops): on a stool at the chess table, feet dangling, a slow blink, a thinking lean now and then. */
const sit: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) => {
    const lean = i >= 6 && i <= 11;
    const blink = i === 3 || i === 4 || i === 13;
    return f(200, { sit: true, mood: blink ? (lean ? "thinkBlink" : "blink") : lean ? "think" : "calm", bob: i % 8 >= 4 ? 1 : 0, hx: lean ? 2 : 0, hy: lean ? 1 : 0, trunk: lean ? "chin" : "hang2", swing: i % 8 < 4 ? 0 : 1, ear: i === 9 ? "down" : "mid", tail: i % 8 < 4 ? 0 : 1, tassel: lean ? 1 : 0 });
  }),
};

/** Wave (once, 1.2 s): lifts its trunk, waves it hello with a toot, then settles. */
const SWAYS = [-1, 0, 1, 0, -1, 0, 1, 0];
const wave: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 1, mood: "happy", trunk: "hang3", tassel: 1 }),
    f(100, { mood: "cheer", trunk: "lift", hy: -1, ear: "up", tassel: -1 }),
    ...SWAYS.map((s, i) => {
      const p: Pose = { mood: i % 2 ? "cheer" : "happy", trunk: "up", ts: s, hy: i % 2 ? 0 : -1, bob: i % 2 ? 1 : 0, ear: i % 4 === 1 ? "up" : "mid", tail: i % 2 ? 1 : 0, tassel: s };
      return f(90, p, { cue: i === 0 ? "toot" : undefined, specks: i % 3 === 0 ? toot(tipOf(p), i % 2) : [] });
    }),
    f(100, { mood: "happy", trunk: "lift", tassel: 1 }),
    f(100, { mood: "happy", trunk: "hang2" }),
    f(120, { mood: "calm", trunk: "hang1" }),
  ],
};

/** Entrance: drops in from above on its shadow, lands with a squash and a puff of dust, then waves hello. */
const entrance: Anim = {
  loop: false,
  frames: [
    { ms: 90, layers: [], specks: dropShadow(4) },
    { ms: 80, layers: [], specks: dropShadow(8) },
    f(70, { air: 7, mood: "cheer", trunk: "lift", ear: "up", feet: { nh: { lift: 2 }, fh: { lift: 3 }, ff: { lift: 2 }, nf: { lift: 3 } }, tassel: -2 }, { specks: dropShadow(11) }),
    f(70, { air: 3, mood: "cheer", trunk: "lift", ear: "up", feet: { nh: { lift: 1 }, fh: { lift: 2 }, ff: { lift: 1 }, nf: { lift: 2 } }, tassel: -1 }),
    f(100, { bob: 3, mood: "blink", trunk: "hang3", ear: "down", tassel: 2, capDy: 1 }, { cue: "step", specks: dust(0) }),
    f(90, { bob: 1, mood: "happy", trunk: "hang2", tassel: 1 }, { specks: dust(1) }),
    f(110, { mood: "cheer", trunk: "up", ts: -1, hy: -1, ear: "up" }, { cue: "toot", specks: [...dust(2), ...toot(tipOf({ trunk: "up", ts: -1, hy: -1 }), 0)] }),
    f(110, { mood: "happy", trunk: "up", ts: 1, tassel: 1 }),
    f(110, { mood: "happy", trunk: "up", ts: -1, hy: -1, tassel: -1 }),
    f(120, { mood: "happy", trunk: "lift" }),
    f(300, { mood: "calm", trunk: "hang1" }),
  ],
};

/** Thinking (loops): eyes rolled up, trunk curled to its chin, a foot tapping, thought bubbles. */
const thinking: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) =>
    f(150, { mood: i === 8 ? "thinkBlink" : "think", trunk: i % 6 < 3 ? "chin" : "hang3", hx: 2, hy: -1, bob: i % 6 >= 3 ? 1 : 0, feet: { ff: i % 4 === 1 ? { lift: 2 } : {} }, tail: i % 6 < 3 ? 1 : 0, ear: i === 5 ? "down" : "mid", tassel: i % 6 < 3 ? 1 : 0 }, { specks: thoughts(i % 6 < 1 ? 0 : i % 6 < 3 ? 1 : i % 6 < 5 ? 2 : 3) }),
  ),
};

/** Its move: a hop toward the board and a trunk-point at it. */
const move: Anim = {
  loop: false,
  frames: [
    f(90, { bob: 2, mood: "bold", trunk: "hang2", capDy: 1 }),
    f(80, { air: 4, dx: 1, mood: "bold", trunk: "lift", feet: { nh: { lift: 2 }, fh: { lift: 3 }, ff: { lift: 2 }, nf: { lift: 3 } }, ear: "up", tassel: -2 }, { cue: "toot" }),
    f(80, { air: 5, dx: 2, mood: "bold", trunk: "point", feet: { nh: { lift: 2 }, fh: { lift: 2 }, ff: { lift: 2 }, nf: { lift: 2 } }, tassel: -2 }),
    f(100, { bob: 2, dx: 2, mood: "happy", trunk: "point", tassel: 1 }, { specks: dust(0) }),
    f(100, { bob: 1, dx: 2, mood: "happy", trunk: "point", ts: 1 }),
    f(110, { dx: 1, mood: "happy", trunk: "hang2" }),
    f(150, { mood: "calm", trunk: "hang1" }),
  ],
};

/** A capture: two excited hops, trunk high, hearts and twinkles. */
const capture: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 2, mood: "bold", trunk: "hang2" }),
    f(80, { air: 5, mood: "cheer", trunk: "up", ts: -1, feet: { nh: { lift: 2 }, fh: { lift: 3 }, ff: { lift: 2 }, nf: { lift: 3 } }, ear: "up", tassel: -2 }, { cue: "toot", specks: star(8, 20) }),
    f(80, { air: 5, mood: "happy", trunk: "up", ts: 1, feet: { nh: { lift: 3 }, fh: { lift: 3 }, ff: { lift: 3 }, nf: { lift: 3 } }, hy: -1, tassel: 1 }, { specks: [...heart(50, 8), ...star(12, 12)] }),
    f(80, { air: 4, mood: "happy", trunk: "up", ts: -1, tassel: -1 }, { specks: heart(52, 5) }),
    f(80, { bob: 2, mood: "cheer", trunk: "up", ts: 1, tassel: 2 }, { specks: dust(0) }),
    f(80, { air: 5, mood: "happy", trunk: "up", ts: 0, feet: { nh: { lift: 2 }, fh: { lift: 2 }, ff: { lift: 3 }, nf: { lift: 3 } }, ear: "up", tassel: -2 }, { specks: [...star(10, 16), ...star(55, 22)] }),
    f(80, { air: 5, mood: "happy", trunk: "up", ts: 1, feet: { nh: { lift: 3 }, fh: { lift: 3 }, ff: { lift: 3 }, nf: { lift: 3 } }, hy: -1, tassel: 1 }, { specks: star(14, 6) }),
    f(80, { air: 4, mood: "happy", trunk: "up", ts: -1, tassel: -1 }),
    f(90, { bob: 2, mood: "cheer", trunk: "lift", tassel: 2 }, { specks: dust(1) }),
    f(120, { bob: 1, mood: "happy", trunk: "hang2" }),
    f(160, { mood: "smug", trunk: "hang1" }),
  ],
};

/** Hurt: hit, a flash, eyes screwed shut, tufts fly; then it shakes it off with a brave little smile. */
const hurt: Anim = {
  loop: false,
  frames: [
    f(70, { bob: 2, mood: "hurt", trunk: "hang0", ear: "down", dx: 1, tassel: 2 }, { cue: "poof", pal: FLASH, shake: [1, 0], specks: tufts(0) }),
    f(80, { bob: 3, mood: "hurt", trunk: "hang0", ear: "down", dx: 1, tassel: 2, capDx: 1, capDy: -1 }, { shake: [-1, 0], specks: tufts(1) }),
    f(90, { bob: 2, dx: 1, mood: "hurt", trunk: "hang0", ear: "down", tassel: -1, capDx: 1 }, { specks: [...tufts(2), [20, 17, "j"], [20, 18, "v"]] }),
    f(100, { bob: 1, mood: "rattled", trunk: "hang1", tassel: 1 }, { specks: tufts(3) }),
    f(110, { mood: "blink", trunk: "hang2" }),
    f(120, { mood: "bold", trunk: "hang2", tassel: -1 }),
    f(160, { mood: "calm", trunk: "hang1" }),
  ],
};

/** Check: two sharp trunk-pointings at the board, eyes bright. */
const JAB: Pose = { bob: 1, dx: 1, mood: "bold", trunk: "point", ear: "up" };
const check: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 1, mood: "bold", trunk: "lift" }),
    f(110, { ...JAB, ts: 1 }, { cue: "toot", specks: toot(tipOf({ ...JAB, ts: 1 }), 0) }),
    f(90, { bob: 1, mood: "bold", trunk: "lift", tassel: -1 }),
    f(110, { ...JAB, ts: 1 }, { cue: "toot", specks: toot(tipOf({ ...JAB, ts: 1 }), 1) }),
    f(90, { bob: 1, dx: 1, mood: "bold", trunk: "point" }),
    f(150, { dx: 1, mood: "happy", trunk: "point" }),
    f(160, { mood: "smug", trunk: "hang2" }),
  ],
};

/** Smug: chin up, eyes half shut, a little smirk, a slow nod, its trunk curled just so. */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(150, { mood: "smug", trunk: i % 4 < 2 ? "hang3" : "hang2", hy: i < 3 || i > 5 ? -1 : 0, hx: i < 4 ? 0 : 1, bob: i % 4 === 2 ? 1 : 0, ear: i === 5 ? "up" : "mid", tassel: i % 4 === 1 ? 1 : 0 })),
};

/** Rattled: wide eyes, worried brows, sweat flying, trembling where it stands. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(80, { mood: "rattled", trunk: i % 2 ? "hang0" : "hang1", dx: i % 2 ? 1 : -1, bob: i % 4 === 2 ? 1 : 0, ear: "up", tail: i % 2 ? 1 : 2, tassel: i % 2 ? 2 : -2 }, { specks: sweat(i) })),
};

/** Defeat: hit, dizzy eyes, it wobbles and plops onto its belly, the cap askew, the trunk limp (the last frame holds). */
const FLOP: Pose = { lie: true, mood: "out", ear: "down", trunk: "limp", tassel: 2, capDx: 2, capDy: 1, hx: 1 };
const defeat: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 2, mood: "hurt", trunk: "hang0", ear: "down", tassel: 2 }, { cue: "poof", pal: FLASH, shake: [1, 0], specks: tufts(0) }),
    f(90, { bob: 2, dx: -1, mood: "out", trunk: "hang0", ear: "down", tassel: -2 }, { specks: tufts(1) }),
    f(110, { bob: 4, dx: 1, mood: "out", trunk: "hang0", ear: "down", tassel: 2, capDx: 1 }),
    f(110, { bob: 3, hy: 1, mood: "out", trunk: "limp", ear: "down", tassel: 2, capDx: 1, capDy: 1, feet: { nh: { x: -1 }, nf: { x: 2 } } }),
    f(120, { ...FLOP, bob: -2 }, { specks: dust(0) }),
    f(120, { ...FLOP }, { cue: "poof", shake: [0, 1], specks: [...dust(1), ...dizzy(0, 38, 13)] }),
    f(160, { ...FLOP }, { specks: dizzy(1, 38, 13) }),
    f(200, { ...FLOP }, { specks: dizzy(2, 38, 13) }),
    f(1000, { ...FLOP }, { specks: dizzy(3, 38, 13) }),
  ],
};

/** Victory: jumping for joy, trunk high, hearts and twinkles. Then again. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const air = [0, 2, 4, 5, 4, 2, 0, 0, 2, 4, 2, 0][i]!;
    const lift = air > 1 ? 3 : 0;
    return f(110, { bob: i === 0 || i === 6 || i === 7 ? 2 : 0, air, mood: air > 1 ? "happy" : "cheer", trunk: "up", ts: [0, -1, 0, 1, 0, -1, 0, 0, 1, 0, -1, 0][i]!, feet: lift ? { nh: { lift }, fh: { lift }, ff: { lift }, nf: { lift } } : {}, hy: i % 2 && air < 5 ? -1 : 0, ear: air > 3 ? "up" : "mid", tail: i % 2 ? 2 : 0, tassel: i % 2 ? 2 : -2 }, { cue: i === 2 ? "toot" : undefined, specks: [...(i % 4 === 1 ? star(10 + (i % 3) * 3, 14) : i % 4 === 3 ? heart(55, 5 + (i % 3)) : []), ...(i === 6 ? dust(0) : [])] });
  }),
};

export const sidekickAlfil: Character = {
  id: "sidekick-alfil",
  name: "Alfil's sidekick",
  w: W,
  h: H,
  foot: [26, GROUND],
  palette: SIDEKICK_ALFIL_PALETTE,
  halo: "#2c2624",
  parts: PARTS,
  anims: { idle, walk, sit, wave, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory },
};
