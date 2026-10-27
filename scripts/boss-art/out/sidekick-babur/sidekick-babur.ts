/**
 * Babur's sidekick (id "sidekick-babur"): a tiger cub, a town bot that wanders the square and plays chess at the park's tables.
 * No powers, never fights: a friendly, curious little one who copies the big one, so it holds ONE shiny purple pawn balloon on
 * a string, like his.
 *
 * Smaller and rounder than Babur: no vest, no hat. A big round head with big amber eyes, a cream muzzle and cheeks, round
 * ears, a few soft stripes, stubby legs with big cream paws and a short ringed tail. Three-quarters, facing our right, light
 * from the top left. His oranges and stripes come from TIGER_PALETTE.
 *
 * Rigging: the head (one per face), the body and the ears are painted once; the legs, tail, near arm (the one holding the
 * string), the far arm (the wave) and the string are painted from points per pose, so a new pose is a handful of numbers.
 * The balloon is one part; its string is redrawn from the paw to the knot wherever they are.
 */
import { canvas, ellipse, inPoly, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../../../packages/app/src/characters/sprite.ts";

export const SIDEKICK_BABUR_PALETTE = {
  k: "#1f1210", // outline
  a: "#6e2c0c", // orange: deep shadow to highlight (his)
  b: "#a24512",
  c: "#d06a18",
  d: "#e8892a",
  e: "#f5ad55",
  f: "#b79c78", // cream: shadow to highlight (his)
  g: "#dcc7a3",
  h: "#f3e6c8",
  i: "#fff8e8",
  s: "#2a160f", // stripes: black-brown, and a softer brown for the far side
  t: "#4d2813",
  n: "#e0837e", // nose, mouth, tongue
  o: "#8c3b3d",
  q: "#5a1f26",
  r: "#d4636e",
  p: "#f08a78", // blush
  x: "#140a08", // pupil
  y: "#f3a81f", // amber of the eyes
  Y: "#ffd45a",
  w: "#fff6dc", // glints, eye whites
  "8": "#6b4a30", // string
  "9": "#9a7a56",
  X: "#5a2a96", // the pawn balloon's purple: dark, round, light (his)
  Z: "#9150d6",
  "0": "#c79bf5",
  u: "#c98f4e", // stool wood, light to dark
  v: "#a06a33",
  m: "#6c4222",
  j: "#7fd3ff", // sweat
  l: "#ff9bd6", // confetti pink
  I: "#9fe8ff", // confetti blue
  D: "#b9a88f", // dust
  E: "#7d6c5a",
  z: "#0d0e12", // ground shadow
} as const;

type Pt = readonly [number, number];

const W = 64;
const H = 64;
/** The first row below the paws. */
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
function crop(cv: Canvas, outline = true): Painted {
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
  if (x1 < 0) return { part: { grid: ["."], outline: false }, at: [0, 0] };
  return { part: { grid: cv.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1).join("")), outline }, at: [x0, y0] };
}

// ---- Painting helpers (pixel (x, y) has its center at x + 0.5, y + 0.5).

const ell = (cx: number, cy: number, rx: number, ry: number) => (x: number, y: number) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
/** Orange by a light value (0 dark to 1 light): banded, never blended. */
const orange = (l: number) => (l < 0.2 ? "b" : l < 0.48 ? "c" : l < 0.78 ? "d" : "e");
const cream = (l: number) => (l < 0.3 ? "f" : l < 0.58 ? "g" : l < 0.85 ? "h" : "i");
/** Light from the top left on a round surface. */
const roundL = (cx: number, cy: number, rx: number, ry: number, bias = 0) => (x: number, y: number) => 0.55 + bias - 0.42 * ((x + 0.5 - cx) / rx) - 0.5 * ((y + 0.5 - cy) / ry);
function fill(cv: Canvas, inside: (x: number, y: number) => boolean, key: (x: number, y: number) => string): void {
  for (let y = 0; y < cv.length; y++) for (let x = 0; x < cv[0]!.length; x++) if (inside(x, y)) cv[y]![x] = key(x, y);
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

/** Where a pixel sits along a polyline of radii: its distance past the edge (<= 0 inside), the normal, how far along (pixels). */
function along(pts: readonly Pt[], rs: readonly number[], px: number, py: number) {
  let best = { score: Infinity, rr: rs[0]!, nx: 0, ny: 0, s: 0 };
  let acc = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const vx = b[0] - a[0];
    const vy = b[1] - a[1];
    const len = Math.hypot(vx, vy);
    const t = Math.max(0, Math.min(1, ((px - a[0]) * vx + (py - a[1]) * vy) / (vx * vx + vy * vy || 1)));
    const nx = px - (a[0] + t * vx);
    const ny = py - (a[1] + t * vy);
    const rr = rs[i]! + (rs[i + 1]! - rs[i]!) * t;
    const score = Math.hypot(nx, ny) - rr;
    if (score < best.score) best = { score, rr, nx, ny, s: acc + t * len };
    acc += len;
  }
  return best;
}
const lengthOf = (pts: readonly Pt[]) => pts.slice(1).reduce((n, q, i) => n + Math.hypot(q[0] - pts[i]![0], q[1] - pts[i]![1]), 0);

interface LimbOpts {
  far?: boolean;
  bars?: readonly number[];
  /** Tail: ring stripes every `ring` pixels and a dark tip of `tip` pixels. */
  ring?: number;
  tip?: number;
}
/** A round limb through `pts`, orange, lit from the top left, with stripes across it. */
function limb(cv: Canvas, pts: readonly Pt[], rs: readonly number[], o: LimbOpts = {}): void {
  const total = lengthOf(pts);
  const stripe = o.far ? "t" : "s";
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const a = along(pts, rs, x + 0.5, y + 0.5);
      if (a.score > 0) continue;
      const l = 0.62 - 0.4 * (a.nx / a.rr) - 0.34 * (a.ny / a.rr) - (o.far ? 0.2 : 0);
      let k = orange(l);
      if (o.bars?.some((b) => Math.abs(a.s - b) < 0.62)) k = stripe;
      if (o.ring && a.s > 3 && (a.s - 3) % o.ring < 1.2) k = stripe;
      if (o.tip && a.s > total - o.tip) k = stripe;
      cv[y]![x] = k;
    }
}
/** A cream paw (an ellipse), with two toe lines. */
function paw(cv: Canvas, cx: number, cy: number, rx: number, ry: number, o: { far?: boolean; fist?: boolean } = {}): void {
  const e = ell(cx, cy, rx, ry);
  fill(cv, e, (x, y) => cream(0.7 - 0.28 * ((x + 0.5 - cx) / rx) - 0.4 * ((y + 0.5 - cy) / ry) - (o.far ? 0.22 : 0)));
  const tk = o.far ? "f" : "t";
  const X = Math.round(cx);
  const Y = Math.round(cy);
  if (o.fist) {
    dots(cv, [[X - 1, Y + 1], [X - 1, Y + 2], [X + 1, Y + 1], [X + 1, Y + 2]], tk);
  } else {
    dots(cv, [[X, Y + 1], [X, Y], [X + 2, Y + 1], [X + 2, Y]], tk);
  }
}

/** A soft stripe: a tapered bar from a to b, painted only over orange. */
function bar(cv: Canvas, a: Pt, b: Pt, r0: number, r1: number, k = "s"): void {
  for (let y = 0; y < cv.length; y++)
    for (let x = 0; x < cv[0]!.length; x++) {
      const c = cv[y]![x]!;
      if (!"bcde".includes(c) || c === ".") continue;
      const e = along([a, b], [r0, r1], x + 0.5, y + 0.5);
      if (e.score <= 0) cv[y]![x] = k;
    }
}

// ---- The head: a big round face, big amber eyes, a cream muzzle, soft forehead stripes.

export type Mood = "calm" | "blink" | "lookUp" | "happy" | "cheer" | "think" | "thinkBlink" | "smug" | "rattled" | "hurt" | "out" | "bold";
type Eye = "open" | "up" | "wide" | "half" | "arc" | "shut" | "pinch" | "x";
type Brow = "up" | "worried" | "bold" | "smug";
type Mouth = "smile" | "grin" | "flat" | "smirk" | "wavy" | "o" | "tongue" | "gasp";

/** The near eye (6 x 7, on our left) and the far one (5 x 7, by the bridge of its nose). */
const NEAR_EYE: Record<Eye, readonly string[]> = {
  open: [".kkkk.", "kYyyyk", "kywxyk", "kyxxyk", "kyxxyk", "kyyyyk", ".kkkk."],
  up: [".kkkk.", "kyxxwk", "kyxxyk", "kyyyyk", "kyyyyk", "kyyyyk", ".kkkk."],
  wide: [".kkkk.", "kwwwwk", "kwxxwk", "kwxxwk", "kwwwwk", "kwwwwk", ".kkkk."],
  half: ["......", "kkkkkk", "kyxxyk", "kyxxyk", ".kkkk.", "......", "......"],
  arc: ["......", "......", ".kkkk.", "k....k", "......", "......", "......"],
  shut: ["......", "......", "......", "......", "kkkkkk", "......", "......"],
  pinch: ["......", "kk....", ".kkk..", "...kkk", ".kkk..", "kk....", "......"],
  x: ["......", "k....k", ".k..k.", "..kk..", ".k..k.", "k....k", "......"],
};
const FAR_EYE: Record<Eye, readonly string[]> = {
  open: [".kkk.", "kYyyk", "kwxyk", "kxxyk", "kxxyk", "kyyyk", ".kkk."],
  up: [".kkk.", "kxxwk", "kxxyk", "kyyyk", "kyyyk", "kyyyk", ".kkk."],
  wide: [".kkk.", "kwwwk", "kxxwk", "kxxwk", "kwwwk", "kwwwk", ".kkk."],
  half: [".....", "kkkkk", "kxxyk", "kxxyk", ".kkk.", ".....", "....."],
  arc: [".....", ".....", ".kkk.", "k...k", ".....", ".....", "....."],
  shut: [".....", ".....", ".....", ".....", "kkkkk", ".....", "....."],
  pinch: [".....", "...kk", "..kk.", ".kk..", "..kk.", "...kk", "....."],
  x: [".....", "k...k", ".k.k.", "..k..", ".k.k.", "k...k", "....."],
};
/** Brows: [near, far] pixel lists on the head grid. */
const BROWS: Record<Brow, readonly [readonly Pt[], readonly Pt[]]> = {
  up: [[[6, 5], [7, 5], [8, 5]], [[15, 5], [16, 5], [17, 5]]],
  worried: [[[5, 7], [6, 6], [7, 6], [8, 5]], [[14, 5], [15, 6], [16, 6]]],
  bold: [[[5, 6], [6, 6], [7, 7], [8, 7]], [[14, 7], [15, 6], [16, 6]]],
  smug: [[[5, 6], [6, 6], [7, 6]], [[15, 4], [16, 4], [17, 5]]],
};
const MOUTHS: Record<Mouth, readonly string[]> = {
  smile: ["k....k", ".kkkk."],
  grin: ["kkkkkk", "kqqqqk", ".kqrk.", "..kk.."],
  flat: ["kkkk"],
  smirk: ["....kk", "kkkk.."],
  wavy: ["k.k.k", ".k.k."],
  o: [".kk.", "kqqk", ".kk."],
  tongue: ["kkkkkk", "kqqrrk", "..krrk", "...kk."],
  gasp: ["kkkk", "kqqk", "kqqk", "kkkk"],
};
const FACES: Record<Mood, { near: Eye; far: Eye; brow?: Brow; mouth: Mouth; blush?: boolean }> = {
  calm: { near: "open", far: "open", mouth: "smile", blush: true },
  blink: { near: "shut", far: "shut", mouth: "smile", blush: true },
  lookUp: { near: "up", far: "up", mouth: "smile", blush: true },
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

const HW = 26;
const HH = 22;
/** The head grid's top-left at rest, on the frame. */
const HX0 = 20;
const HY0 = 26;

function head(mood: Mood): Part {
  const cv = canvas(HW, HH);
  const skull = ell(11.5, 12, 11, 9.8);
  const muzzle = ell(19.4, 16.4, 5.9, 4.6);
  const inside = (x: number, y: number) => skull(x, y) || muzzle(x, y);
  const L = roundL(13, 13, 13, 11, 0.08);
  fill(cv, inside, (x, y) => orange(L(x, y)));
  // The cream lower face: the muzzle and the cheeks below a wavy line.
  const low = inPoly([[-1, 16.6], [4, 17.6], [9, 16.6], [13, 15.2], [14, 14.8], [14, 23], [-1, 23]]);
  fill(cv, (x, y) => inside(x, y) && (muzzle(x, y) || low(x, y)), (x, y) => cream(L(x, y) + 0.3));
  // Soft stripes: three bars down the forehead, one back from each temple, two across the cheek.
  bar(cv, [11.5, 2], [11.8, 6.4], 0.9, 0.35);
  bar(cv, [8.4, 2.6], [8.6, 5.6], 0.8, 0.3);
  bar(cv, [14.6, 2.8], [14.6, 5.6], 0.8, 0.3);
  bar(cv, [0.5, 10.5], [3.6, 11.2], 0.8, 0.4);
  bar(cv, [0.8, 13], [3.8, 13.4], 0.8, 0.4);
  // The cheek ruff: little points of cream at the back of the jaw.
  dots(cv, [[0, 16], [0, 17], [1, 18]], "g");
  // The nose and its mouth line, and the dots the whiskers grow from.
  stamp(cv, ["oooo", "nnnn", ".nn."], 21, 12);
  dots(cv, [[18, 15], [19, 16]], "f");
  const face = FACES[mood];
  stamp(cv, NEAR_EYE[face.near], 5, 8);
  stamp(cv, FAR_EYE[face.far], 15, 8);
  if (face.blush) dots(cv, [[4, 15], [5, 15], [6, 15]], "p");
  if (face.brow) for (const side of BROWS[face.brow]) dots(cv, side, "s");
  const mouth = MOUTHS[face.mouth];
  const mx = face.mouth === "grin" || face.mouth === "tongue" ? 18 : face.mouth === "o" || face.mouth === "gasp" ? 20 : face.mouth === "flat" ? 20 : 18;
  const my = face.mouth === "grin" || face.mouth === "tongue" ? 16 : face.mouth === "gasp" ? 16 : face.mouth === "o" ? 17 : face.mouth === "smile" ? 17 : 18;
  stamp(cv, mouth, mx, my);
  return { grid: toGrid(cv) };
}
const MOODS: readonly Mood[] = ["calm", "blink", "lookUp", "happy", "cheer", "think", "thinkBlink", "smug", "rattled", "hurt", "out", "bold"];
for (const m of MOODS) PARTS[`head:${m}`] = head(m);

/** An ear: a round orange disc with a cream middle (`ry` its height; a flat ear is short). */
function ear(ry: number, tilt = 0): Part {
  const w = 7;
  const h = Math.ceil(ry * 2) + 1;
  const cv = canvas(w, h);
  const e = ell(3.5 + tilt * 0.3, ry, 3.5, ry);
  const L = roundL(3.5, ry, 3.5, ry);
  fill(cv, e, (x, y) => orange(L(x, y)));
  const inner = ell(3.7 + tilt * 0.3, ry + 0.8, 1.9, ry * 0.55);
  fill(cv, (x, y) => e(x, y) && inner(x, y), (x, y) => (y > ry + 0.6 ? "g" : "h"));
  return { grid: toGrid(cv) };
}
PARTS["ear:mid"] = ear(3.2);
PARTS["ear:up"] = ear(3.9, -1);
PARTS["ear:down"] = ear(2.4, 1);

PARTS["shadow"] = (() => {
  const cv = canvas(40, 3);
  ellipse(cv, 20, 1.5, 20, 1.5, "z");
  return { grid: toGrid(cv), outline: false };
})();

PARTS["stool"] = {
  grid: [
    "uuuuuuuuuuuuuuuuuuuuu",
    "vvvvvvvvvvvvvvvvvvvvv",
    "mmmmmmmmmmmmmmmmmmmmm",
    "..vm.............vm..",
    "..vm.............vm..",
    "..vmmmmmmmmmmmmmmvm..",
    "..vm.............vm..",
    "..vm.............vm..",
    "..vm.............vm..",
  ],
};

// ---- The balloon: a purple pawn, round and shiny. One part; its string is drawn per frame.

const BALLOON_SIL = [
  "....#####....",
  "...#######...",
  "..#########..",
  "..#########..",
  "..#########..",
  "...#######...",
  "....#####....",
  ".....###.....",
  "...#######...",
  ".....###.....",
  "....#####....",
  "...#######...",
  "..#########..",
  ".###########.",
  "#############",
  "#############",
  ".###########.",
  ".....nnn.....",
];
function balloonPart(): Part {
  const rows = BALLOON_SIL.map((r) => [...r]);
  const h = rows.length;
  const w = rows[0]!.length;
  const at = (x: number, y: number) => rows[y]?.[x] ?? ".";
  const cv = canvas(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = at(x, y);
      if (c === ".") continue;
      if (c === "n") {
        cv[y]![x] = "X";
        continue;
      }
      const left = at(x - 1, y) === ".";
      const up = at(x, y - 1) === "." || at(x, y - 1) === "n";
      const right = at(x + 1, y) === ".";
      const down = at(x, y + 1) === "." || at(x, y + 1) === "n";
      const down2 = at(x, y + 2) === "." || at(x, y + 2) === "n";
      const right2 = at(x + 2, y) === ".";
      cv[y]![x] = right || down || (right2 && y > 6 && down2) ? "X" : left || up ? "0" : "Z";
      if (right2 && !right && !down) cv[y]![x] = "Z";
    }
  // The shine, on the head and on the base.
  dots(cv, [[4, 2], [4, 3], [3, 3]], "w");
  dots(cv, [[3, 13]], "w");
  return { grid: toGrid(cv) };
}
PARTS["balloon"] = balloonPart();
const BALLOON_W = 13;
const BALLOON_H = 18;

/** A string: a line from `a` (the balloon's knot) to `b` (the paw), bowing `bow` pixels sideways in the middle. */
function stringPart(a: Pt, b: Pt, bow: number): Painted & { name: string } {
  return painted(`string:${a};${b};${bow}`, () => {
    const cv = canvas(W, H);
    const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2));
    const c: Pt = [(a[0] + b[0]) / 2 + bow, (a[1] + b[1]) / 2];
    let i = 0;
    for (let t = 0; t <= n; t++) {
      const u = t / n;
      const x = Math.floor((1 - u) ** 2 * a[0] + 2 * (1 - u) * u * c[0] + u * u * b[0]);
      const y = Math.floor((1 - u) ** 2 * a[1] + 2 * (1 - u) * u * c[1] + u * u * b[1]);
      if (cv[y]?.[x] === ".") cv[y]![x] = i++ % 5 === 4 ? "9" : "8";
    }
    return crop(cv, false);
  });
}

// ---- Limbs and the body.

type LegKey = "nh" | "fh" | "ff";
const HIP: Record<LegKey, Pt> = { nh: [18, 49], fh: [25, 50], ff: [34, 50] };
const FOOT_X: Record<LegKey, number> = { nh: 17, fh: 24, ff: 33 };
const ANKLE_Y = 57;

function legPart(hip: Pt, knee: Pt, ankle: Pt, near: boolean, r: number | readonly number[] = 3): Painted & { name: string } {
  const pts = [hip, knee, ankle] as const;
  const rs = typeof r === "number" ? [r + 0.8, r, r - 0.4] : r;
  return painted(`leg:${near ? "n" : "f"}:${rs.join(",")}:${pts.map((q) => q.join(",")).join(";")}`, () => {
    const cv = canvas(W, H);
    limb(cv, pts, rs, { far: !near, bars: near ? [1.8, 4.8] : [] });
    paw(cv, ankle[0] + 1.2, ankle[1] + 1, 3.7, 2.5, { far: !near });
    return crop(cv);
  });
}

function bodyPart(kind: "stand" | "sit" | "lie"): Painted {
  const cv = canvas(W, H);
  const B = kind === "stand" ? { cx: 22, cy: 47.8, rx: 12, ry: 7.3 } : kind === "sit" ? { cx: 18, cy: 44.5, rx: 10, ry: 8.4 } : { cx: 24, cy: 55, rx: 12.5, ry: 5.2 };
  const body = ell(B.cx, B.cy, B.rx, B.ry);
  const L = roundL(B.cx, B.cy, B.rx, B.ry, 0.06);
  fill(cv, body, (x, y) => orange(L(x, y)));
  // A cream belly underneath and toward the front.
  const belly = kind === "sit" ? ell(B.cx + 5, B.cy + 3, 6, 6) : kind === "lie" ? ell(B.cx + 2, B.cy + 6, 10, 3) : ell(B.cx + 5, B.cy + 7.5, 8, 3.2);
  fill(cv, (x, y) => body(x, y) && belly(x, y), (x, y) => cream(L(x, y) + 0.3));
  // Stripes down from the spine: the near ones long enough to show below the chin.
  const xs = kind === "stand" ? [10.5, 14, 17.5] : kind === "sit" ? [10.5, 13.5, 16.5] : [11, 15, 19, 23, 27, 31];
  for (const x of xs) {
    let top = 0;
    while (top < H && cv[top]![Math.floor(x)] === ".") top++;
    const len = kind === "sit" ? 7 : kind === "lie" ? 4.2 : 5.4;
    const lean = kind === "sit" ? -0.8 : (30 - x) * 0.05;
    bar(cv, [x, top - 0.5], [x + lean, top + len], 0.85, 0.3);
  }
  return crop(cv);
}
const BODY = { stand: painted("body:stand", () => bodyPart("stand")), sit: painted("body:sit", () => bodyPart("sit")), lie: painted("body:lie", () => bodyPart("lie")) };

/** The tail: a short striped rope curling up behind, a dark tip; `t` swishes it. */
function tailPart(t: number, base: Pt, hang: boolean): Painted & { name: string } {
  return painted(`tail:${t}:${base};${hang ? 1 : 0}`, () => {
    const cv = canvas(W, H);
    const [bx, by] = base;
    const pts: Pt[] = hang
      ? [[bx, by], [bx - 3, by + 2], [bx - 4 + t * 0.5, by + 6], [bx - 4 + t, by + 9]]
      : [[bx, by], [bx - 4, by + 0.5], [bx - 7 + t * 0.4, by - 3.5], [bx - 7.5 + t * 0.8, by - 9 - Math.max(0, t) * 0.4]];
    limb(cv, pts, [1.8, 1.7, 1.55, 1.45], { ring: 3, tip: 2.6 });
    return crop(cv);
  });
}

// ---- Arms.

export type ArmName = "hold" | "holdR" | "up" | "high" | "down" | "side" | "point" | "tuck" | "chin";
interface Arm {
  /** Shoulder, elbow, the fist's middle. */
  pts: readonly [Pt, Pt, Pt];
}
const SH: Pt = [34, 49];
const ARMS: Record<ArmName, Arm> = {
  hold: { pts: [SH, [40, 52], [47, 47]] },
  up: { pts: [SH, [40, 50], [48, 43]] },
  high: { pts: [SH, [41, 48], [49, 39]] },
  down: { pts: [SH, [39, 54], [44, 56]] },
  side: { pts: [SH, [40, 52], [46, 51]] },
  point: { pts: [SH, [42, 51], [51, 49]] },
  holdR: { pts: [SH, [43, 54], [53, 49]] },
  tuck: { pts: [[24, 45], [28, 50], [31, 51]] },
  chin: { pts: [[24, 45], [29, 50], [33, 47]] },
};
function armPart(pts: readonly [Pt, Pt, Pt], far = false): Painted & { name: string } {
  return painted(`arm${far ? "F" : "N"}:${pts.map((q) => q.join(",")).join(";")}`, () => {
    const cv = canvas(W, H);
    limb(cv, pts, [2.7, 2.5, 2.3], { far, bars: far ? [5] : [4.5] });
    paw(cv, pts[2][0], pts[2][1], 3.3, 3, { far, fist: true });
    return crop(cv);
  });
}
/** The far arm raised to wave: out from behind the head, a paw by the face. */
const WAVE_PAWS: readonly Pt[] = [[46, 36], [48, 33], [45, 32], [47, 35]];

// ---- Poses.

export interface Pose {
  mood?: Mood;
  /** The whole upper body down this many pixels (a breath, a crouch). */
  bob?: number;
  /** The head on the neck. */
  hx?: number;
  hy?: number;
  dx?: number;
  /** Off the ground. */
  air?: number;
  /** Feet: sideways shift and lift off the ground, per leg. */
  feet?: Partial<Record<LegKey, { x?: number; lift?: number }>>;
  arm?: ArmName;
  /** The balloon moved from where it floats (a bob, a sway, a trail), and how its string bows. */
  bal?: Pt;
  bow?: number;
  /** The far paw waving (a step of WAVE_PAWS), the wave's lean. */
  wave?: number;
  tail?: number;
  ear?: "mid" | "up" | "down";
  sit?: boolean;
  /** Flat on its belly (defeat). */
  lie?: boolean;
  /** The balloon let go: its knot's place on the frame (null: gone). */
  free?: Pt | null;
  /** The balloon follows the paw wherever it goes (a drop in from above the frame), not held to the frame. */
  drop?: boolean;
  noShadow?: boolean;
}

function build(p: Pose): { layers: Layer[] } {
  // Sitting is drawn 5 px to the right, so the stool and the cub sit about where the standing cub's middle is.
  const dx = (p.dx ?? 0) + (p.sit ? 5 : 0);
  const air = p.air ?? 0;
  const bob = p.bob ?? 0;
  const sit = p.sit ?? false;
  const lie = p.lie ?? false;
  const by = bob - air;
  const layers: Layer[] = [];
  const add = (l: { name: string; at: Pt }, ox = 0, oy = 0) => layers.push({ part: l.name, x: l.at[0] + ox, y: l.at[1] + oy });
  const put = (part: string, x: number, y: number) => layers.push({ part, x, y });
  const arm = lie ? null : p.arm ?? (sit ? "tuck" : "hold");
  if (!p.noShadow) put("shadow", (sit ? -2 : 8) + dx, GROUND - 2);
  if (sit) put("stool", 8 + dx, 52);

  // The body is painted in place for each stance; only the bob and the sideways shift move it.
  const ux = dx;
  const uy = by;

  // The balloon's place: knot and the paw's top (or the stool, when tied).
  const armSpec = arm ? ARMS[arm] : null;
  const armPts = armSpec ? (armSpec.pts.map((q): Pt => [q[0] + dx, Math.min(q[1] + by, 58)]) as unknown as [Pt, Pt, Pt]) : null;
  const fist: Pt | null = armPts ? armPts[2] : null;
  const bal = p.bal ?? [0, 0];
  let knot: Pt | null = null;
  let anchor: Pt | null = null;
  if (p.free === null) knot = null;
  else if (p.free) {
    knot = p.free;
    anchor = [p.free[0] + (bal[0] > 0 ? 1 : -1), p.free[1] + 9];
  } else if (sit) {
    anchor = [9 + dx, 52];
    knot = [10 + dx + bal[0], 25 + bal[1] - air];
  } else if (fist) {
    anchor = [fist[0], fist[1] - 3];
    knot = [Math.max(fist[0] - 3, 44) + bal[0], p.drop ? fist[1] - 24 + bal[1] : Math.max(20, Math.min(23, fist[1] - 24) + bal[1])];
  }
  // The string goes behind everything when tied to the stool.
  if (sit && knot && anchor) add(stringPart([knot[0], knot[1] + 2], anchor, p.bow ?? 0));

  // The tail.
  const tl = p.tail ?? 0;
  if (sit) add(tailPart(tl, [9 + dx, 50 + by], true));
  else if (lie) add(tailPart(tl, [14 + dx, 55 + by], false));
  else add(tailPart(tl, [14 + dx, 49 + by], false));

  const foot = (k: LegKey): Pt => [FOOT_X[k] + (p.feet?.[k]?.x ?? 0) + dx, ANKLE_Y - air - (p.feet?.[k]?.lift ?? 0)];
  const stand = (k: LegKey, near: boolean) => {
    const hip: Pt = [HIP[k][0] + dx, HIP[k][1] + by];
    const a = foot(k);
    const out = k === "ff" ? 1 : -1;
    const knee: Pt = [Math.round((hip[0] + a[0]) / 2 + out), Math.round((hip[1] + a[1]) / 2)];
    add(legPart(hip, knee, a, near, near ? [4.8, 3.5, 2.6] : 3));
  };
  if (lie) {
    // Flat on its belly: hind legs stretched back, forelegs forward under the chin.
    add(legPart([15 + dx, 56 + by], [11 + dx, 58 + by], [6 + dx, 57], false, 2.6));
    add(legPart([36 + dx, 56 + by], [44 + dx, 57 + by], [50 + dx, 57], false, 2.6));
  } else if (sit) {
    // Dangling over the front of the stool: the far hind leg behind.
    add(legPart([21 + dx, 50 + by], [28 + dx, 53 + by], [35 + dx + (p.feet?.fh?.x ?? 0), 57 - (p.feet?.fh?.lift ?? 0)], false, 2.8));
  } else {
    stand("fh", false);
    stand("ff", false);
  }

  add(sit ? BODY.sit : lie ? BODY.lie : BODY.stand, ux, uy);

  if (lie) {
    add(legPart([18 + dx, 56 + by], [13 + dx, 58 + by], [9 + dx, 57], true, 2.8));
    add(legPart([34 + dx, 56 + by], [41 + dx, 57 + by], [46 + dx, 57], true, 2.8));
  } else if (sit) {
    // The near thigh folded over the belly, the foot dangling.
    add(legPart([15 + dx, 49 + by], [23 + dx, 51 + by], [31 + dx - (p.feet?.fh?.x ?? 0), 56], true, [4.4, 3.4, 2.6]));
  } else {
    stand("nh", true);
  }

  // The waving far arm comes out from behind the head.
  if (p.wave !== undefined && !sit && !lie) {
    const [wx, wy] = WAVE_PAWS[p.wave % WAVE_PAWS.length]!;
    add(armPart([[34 + dx, 48 + by], [40 + dx, 44 + by], [wx + dx, wy + by]]));
  }

  // The near arm: its root is hidden behind the chin (a paw at the chin goes in front of the head).
  if (armPts && arm !== "chin") add(armPart(armPts));

  // Ears and the head.
  const hx = (sit ? HX0 - 5 : lie ? 27 : HX0) + (p.hx ?? 0) + ux;
  const hy = (sit ? HY0 - 3 : lie ? 38 : HY0) + (p.hy ?? 0) + uy;
  const e = p.ear ?? "mid";
  put(`ear:${e}`, hx + 14, hy + (e === "up" ? 0 : 1));
  put(`ear:${e}`, hx + 2, hy + (e === "up" ? -1 : 0));
  put(`head:${p.mood ?? "calm"}`, hx, hy);
  if (armPts && arm === "chin") add(armPart(armPts));

  // The string and the balloon.
  if (!sit && knot && anchor) add(stringPart([knot[0], knot[1] + 2], anchor, p.bow ?? 0));
  if (knot) put("balloon", knot[0] - Math.floor(BALLOON_W / 2), knot[1] - BALLOON_H + 1);
  return { layers };
}

// ---- Effects.

function seeded(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => ((s = (s * 1103515245 + 12345) >>> 0) >>> 8) / 16777216;
}
/** A twinkle: a little plus. */
const star = (x: number, y: number, k = "Y"): Speck[] => [[x, y, "w"], [x - 1, y, k], [x + 1, y, k], [x, y - 1, k], [x, y + 1, k]];
function twinkles(t: number, n = 3, box: readonly [number, number, number, number] = [4, 6, 60, 44]): Speck[] {
  const rnd = seeded(t * 31 + 5);
  return Array.from({ length: n }, (_, i) => star(Math.round(box[0] + rnd() * (box[2] - box[0])), Math.round(box[1] + rnd() * (box[3] - box[1])), (i + t) % 2 ? "Y" : "I")).flat();
}
/** Dust puffing out along the ground at the feet. */
const dust = (t: number): Speck[] =>
  [-1, 1].flatMap((side) =>
    [0, 1, 2].map((i): Speck => [Math.round(26 + side * (11 + i * 3 + t * 2)), GROUND - 1 - (i % 2) - (t > 0 ? 1 : 0), t > 1 ? "E" : "D"]),
  );
const dropShadow = (r: number): Speck[] =>
  [-1, 0, 1].flatMap((row) => {
    const rr = row === 0 ? r : r - 2;
    return Array.from({ length: rr * 2 + 1 }, (_, i): Speck => [28 - rr + i, GROUND - 1 + row, "z"]);
  });
/** Thought dots up and to the left of the head. */
const thoughts = (n: number): Speck[] =>
  ([[16, 22], [11, 17], [8, 9]] as const).slice(0, n).flatMap(([x, y], k): Speck[] => {
    if (k === 0) return [[x, y, "i"], [x + 1, y, "i"], [x, y + 1, "h"], [x + 1, y + 1, "g"]];
    if (k === 1) return [[x + 1, y, "i"], [x, y + 1, "i"], [x + 1, y + 1, "i"], [x + 2, y + 1, "h"], [x + 1, y + 2, "g"]];
    // The big thought: a round cloud with a dot dot dot in it.
    const out: Speck[] = [];
    for (let yy = -3; yy <= 3; yy++)
      for (let xx = -6; xx <= 6; xx++) {
        const e = (xx / 6.2) ** 2 + (yy / 3.6) ** 2;
        if (e <= 1) out.push([x + xx, y + yy, e > 0.72 || yy > 1 ? "g" : "i"]);
      }
    out.push([x - 3, y, "t"], [x, y, "t"], [x + 3, y, "t"]);
    return out;
  });
const sweat = (i: number): Speck[] => {
  const t = i % 4;
  return [[19 - t, 31 + t, "j"], [19 - t, 32 + t, "w"], [47 + t, 28 + t, "j"], [47 + t, 29 + t, "w"]];
};
/** Confetti and pops of color. */
function confetti(t: number, n = 9): Speck[] {
  const rnd = seeded(t * 17 + 3);
  const keys = ["Y", "l", "I", "0", "Z", "w"];
  return Array.from({ length: n }, (_, i): Speck[] => {
    const x = Math.round(3 + rnd() * 56);
    const y = Math.round(3 + rnd() * 38);
    const k = keys[(i + t) % keys.length]!;
    return i % 2 ? [[x, y, k], [x + 1, y, k], [x, y + 1, k]] : [[x, y, k], [x + 1, y + 1, k]];
  }).flat();
}

const FLASH: Record<string, string> = { b: "#d58a56", c: "#e8a977", d: "#f6c8a0", e: "#fde6cc", g: "#f1e8d4", h: "#fbf5e8", i: "#ffffff", Z: "#c9a0ee", X: "#a77ad6", "0": "#e6d0fb" };

/** One frame: the pose and anything extra. */
function f(ms: number, p: Pose, extra: Partial<Frame> = {}): Frame {
  const b = build(p);
  const specks = (extra.specks ?? []).filter(([x, y]) => x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2);
  return { ms, layers: b.layers, ...extra, specks };
}

// ---- Animations.

/** The balloon's lazy bob: a pixel or two up and down, its string swaying. */
const floatBy = (i: number, n: number, amp = 1.2): Pose => ({ bal: [Math.round(Math.sin((i / n) * Math.PI * 4) * 1), Math.round(Math.sin((i / n) * Math.PI * 2) * amp)], bow: Math.round(Math.sin((i / n) * Math.PI * 2 + 1) * 1.4) });

/** Idle (3 s): breathes, blinks, flicks an ear and its tail, glances; the balloon bobs on its string. */
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 30 }, (_, i) => {
    const bob = i % 15 >= 8 ? 1 : 0;
    const blink = i === 11 || i === 12 || i === 27;
    const ear = i === 20 || i === 21 ? "down" : i === 22 ? "up" : "mid";
    const tail = i >= 4 && i <= 7 ? (i % 2 ? 2 : 1) : i >= 19 && i <= 21 ? -1 : 0;
    const hx = i >= 24 && i <= 29 ? 1 : 0;
    // Glances up at its balloon for a moment.
    const look = i >= 15 && i <= 18;
    return f(100, { bob, mood: blink ? "blink" : look ? "lookUp" : "calm", ear, tail, hx: look ? 1 : hx, hy: look ? -1 : 0, ...floatBy(i, 30) });
  }),
};

/** Walk (0.6 s): a playful pounce-trot, the head bobbing, the balloon trailing above. */
const walk: Anim = {
  loop: true,
  frames: Array.from({ length: 6 }, (_, i) => {
    const th = (i / 6) * Math.PI * 2;
    const leg = (off: number) => ({ x: Math.round(3 * Math.sin(th + off * Math.PI * 2)), lift: Math.max(0, Math.round(3 * Math.cos(th + off * Math.PI * 2))) });
    const down = i % 3 === 0;
    return f(100, { bob: down ? 1 : 0, air: i % 3 === 1 ? 1 : 0, hy: down ? 0 : -1, hx: 1, mood: "calm", feet: { nh: leg(0), ff: leg(0), fh: leg(0.5) }, tail: i < 3 ? 1 : -1, ear: down ? "down" : "mid", bal: [-3 + (i % 3 === 1 ? 1 : 0), down ? 1 : -1], bow: -3 }, down ? { cue: "step" } : {});
  }),
};

/** Sit (loops): on a stool at the chess table, facing the board, legs dangling, the balloon tied to the stool; thinks about a move. */
const SIT: Pose = { sit: true, arm: "tuck" };
const sit: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) => {
    const lean = i >= 6 && i <= 11;
    const blink = i === 3 || i === 4 || i === 13;
    const swing = i % 8 < 4 ? 0 : 1;
    return f(200, { ...SIT, mood: blink ? (lean ? "thinkBlink" : "blink") : lean ? "think" : "calm", arm: i === 8 || i === 9 ? "chin" : "tuck", bob: i % 8 >= 4 ? 1 : 0, hx: lean ? 2 : 0, hy: lean ? 1 : 0, ear: i === 9 ? "down" : "mid", tail: swing, feet: { fh: { x: swing, lift: swing } }, ...floatBy(i, 16, 1) });
  }),
};

/** Wave (once, 1.2 s): a hello with the free paw, the balloon bouncing, then it settles. */
const waveSteps = [0, 1, 2, 3, 0, 1, 2, 3];
const wave: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 1, mood: "happy", bal: [0, 1] }),
    f(100, { mood: "cheer", hy: -1, wave: 0, arm: "holdR", bal: [0, -1], ear: "up" }, { cue: "squeak" }),
    ...waveSteps.map((w, i) => f(100, { mood: i % 2 ? "cheer" : "happy", wave: w, arm: "holdR", hx: 0, hy: i % 2 ? 0 : -1, bob: i % 2 ? 1 : 0, tail: i % 2 ? 2 : -1, ear: i % 4 === 1 ? "up" : "mid", bal: [i % 2 ? 1 : -1, i % 2 ? 1 : -2], bow: i % 2 ? 2 : -2 }, { specks: i % 3 === 0 ? star(10 + (i % 4) * 3, 14 + (i % 3) * 3) : [] })),
    f(100, { mood: "happy", arm: "up", bal: [0, -1] }),
    f(100, { mood: "calm" }),
  ],
};

/** Entrance: drifts down under its balloon, lands with a squash and a puff of dust, then waves. */
const entrance: Anim = {
  loop: false,
  frames: [
    { ms: 90, layers: [], specks: [...dropShadow(4), ...star(30, 40)] },
    { ms: 80, layers: [], specks: [...dropShadow(8), ...star(22, 46, "I"), ...star(38, 36)] },
    f(80, { air: 10, noShadow: true, mood: "cheer", feet: { nh: { lift: 2 }, fh: { lift: 3 }, ff: { lift: 2 } }, ear: "up", bal: [3, 0], tail: 2 }, { specks: dropShadow(11) }),
    f(80, { air: 6, noShadow: true, mood: "cheer", feet: { nh: { lift: 2 }, fh: { lift: 3 }, ff: { lift: 2 } }, ear: "up", bal: [2, 0], tail: 2 }, { specks: dropShadow(13) }),
    f(80, { air: 3, noShadow: true, mood: "cheer", feet: { nh: { lift: 1 }, fh: { lift: 2 }, ff: { lift: 1 } }, ear: "up", bal: [1, 0] }, { specks: dropShadow(15) }),
    f(100, { bob: 3, mood: "blink", ear: "down", bal: [0, 1] }, { cue: "step", specks: dust(0) }),
    f(90, { bob: 1, mood: "happy", bal: [0, -2] }, { specks: dust(1) }),
    f(100, { mood: "cheer", hy: -1, wave: 0, arm: "holdR", bal: [1, -1], ear: "up" }, { cue: "squeak", specks: [...dust(2), ...twinkles(1, 2)] }),
    f(100, { mood: "happy", wave: 1, arm: "holdR", bal: [-1, -2] }, { specks: twinkles(2, 2) }),
    f(100, { mood: "happy", wave: 2, arm: "holdR", bal: [1, -1] }),
    f(110, { mood: "happy", wave: 3, arm: "holdR", bal: [0, -1] }),
    f(300, { mood: "calm" }),
  ],
};

/** Thinking (loops): head tipped up, eyes rolled up toward its balloon, a foot tapping, thought dots popping up. */
const thinking: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) =>
    f(150, { mood: i === 8 ? "thinkBlink" : "think", hx: 2, hy: -1, bob: i % 6 >= 3 ? 1 : 0, feet: { ff: i % 4 === 1 ? { lift: 2 } : {} }, tail: i % 6 < 3 ? 1 : 0, ear: i === 5 ? "down" : "mid", arm: "side", ...floatBy(i, 12, 1) }, { specks: thoughts(i % 6 < 1 ? 0 : i % 6 < 3 ? 1 : i % 6 < 5 ? 2 : 3) }),
  ),
};

/** Its move: a hop toward the board, the balloon swinging out ahead of it. */
const move: Anim = {
  loop: false,
  frames: [
    f(90, { bob: 2, mood: "bold", bal: [-1, 2] }),
    f(80, { air: 4, dx: 1, mood: "bold", arm: "point", feet: { nh: { lift: 2 }, fh: { lift: 3 }, ff: { lift: 2 } }, ear: "up", bal: [3, -1] }, { cue: "squeak" }),
    f(80, { air: 5, dx: 2, mood: "bold", arm: "point", feet: { nh: { lift: 2 }, fh: { lift: 2 }, ff: { lift: 2 } }, bal: [4, 0], bow: 1 }),
    f(100, { bob: 2, dx: 2, mood: "happy", arm: "point", bal: [2, 2] }, { specks: dust(0) }),
    f(100, { bob: 1, dx: 2, mood: "happy", arm: "point", bal: [1, -1] }),
    f(110, { dx: 1, mood: "happy", bal: [0, -1] }),
    f(150, { mood: "calm" }),
  ],
};

/** A capture: two excited hops, the balloon flying high, twinkles everywhere. */
const capture: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 2, mood: "bold", bal: [0, 2] }),
    f(80, { air: 5, mood: "cheer", arm: "high", feet: { nh: { lift: 2 }, fh: { lift: 3 }, ff: { lift: 2 } }, ear: "up", bal: [1, -3] }, { cue: "squeak", specks: twinkles(1) }),
    f(80, { air: 6, mood: "happy", arm: "high", feet: { nh: { lift: 3 }, fh: { lift: 3 }, ff: { lift: 3 } }, hy: -1, bal: [-1, -4], bow: 2 }, { specks: twinkles(2) }),
    f(80, { air: 4, mood: "happy", arm: "up", bal: [1, -2] }, { specks: twinkles(3) }),
    f(80, { bob: 2, mood: "cheer", arm: "hold", bal: [0, 2] }, { specks: dust(0) }),
    f(80, { air: 6, mood: "happy", arm: "high", feet: { nh: { lift: 2 }, fh: { lift: 2 }, ff: { lift: 3 } }, ear: "up", bal: [-1, -4] }, { specks: twinkles(4) }),
    f(80, { air: 6, mood: "happy", arm: "high", feet: { nh: { lift: 3 }, fh: { lift: 3 }, ff: { lift: 3 } }, hy: -1, bal: [1, -4], bow: -2 }, { specks: twinkles(5) }),
    f(80, { air: 4, mood: "happy", arm: "up", bal: [0, -2] }, { specks: twinkles(6) }),
    f(90, { bob: 2, mood: "cheer", bal: [0, 2] }, { specks: dust(1) }),
    f(120, { bob: 1, mood: "happy", arm: "up", bal: [0, -1] }),
    f(160, { mood: "smug" }),
  ],
};

/** Hurt: hit, a flash, eyes screwed shut, the balloon yanked; then it shakes it off with a brave little grin. */
const hurt: Anim = {
  loop: false,
  frames: [
    f(70, { bob: 2, dx: 1, mood: "hurt", arm: "down", ear: "down", bal: [3, 1], bow: 2 }, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    f(80, { bob: 3, mood: "hurt", arm: "down", ear: "down", bal: [2, 2], bow: 2 }, { shake: [-1, 0], specks: [[20, 33, "j"], [20, 34, "w"]] }),
    f(90, { bob: 2, dx: -1, mood: "hurt", arm: "side", ear: "down", bal: [1, 1] }, { specks: [[19, 35, "j"], [19, 36, "w"]] }),
    f(100, { bob: 1, dx: -1, mood: "rattled", arm: "side", ear: "down", bal: [0, 0] }),
    f(110, { mood: "blink", arm: "up", bal: [0, -1] }),
    f(120, { mood: "bold", bal: [0, -2] }),
    f(160, { mood: "calm" }),
  ],
};

/** Check: two sharp jabs of the balloon at the board, eyes bright. */
const JAB: Pose = { bob: 2, dx: 1, mood: "bold", arm: "point", bal: [4, 1], bow: 1 };
const check: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 1, mood: "bold", arm: "up", bal: [0, -1] }),
    f(110, { ...JAB }, { cue: "squeak" }),
    f(90, { bob: 1, mood: "bold", arm: "up", bal: [0, -2] }),
    f(110, { ...JAB }, { cue: "squeak" }),
    f(90, { bob: 1, dx: 1, mood: "bold", arm: "point", bal: [2, 0] }),
    f(150, { dx: 1, mood: "happy", arm: "point", bal: [1, -1] }),
    f(160, { mood: "smug" }),
  ],
};

/** Smug: chin up, eyes half shut, a little smirk, a slow nod, the balloon bobbing. */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(150, { mood: "smug", hy: i < 3 || i > 5 ? -1 : 0, hx: i < 4 ? 0 : 1, bob: i % 4 === 2 ? 1 : 0, ear: i === 5 ? "up" : "mid", tail: [0, 1, 2, 1, 0, -1, -1, 0][i]!, ...floatBy(i, 8) })),
};

/** Rattled: wide eyes, worried brows, sweat flying, trembling where it stands, the balloon jittering. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(80, { mood: "rattled", arm: "side", dx: i % 2 ? 1 : -1, bob: i % 4 === 2 ? 1 : 0, ear: "down", tail: i % 2 ? 1 : -1, bal: [i % 2 ? 1 : -1, i % 3 === 0 ? 1 : 0], bow: i % 2 ? 1 : -1 }, { specks: sweat(i) })),
};

/** Defeat: hit, dizzy eyes, it lets go and the balloon drifts up and away; it flops onto its belly (the last frame holds). */
const FLOP: Pose = { lie: true, bob: 0, mood: "out", ear: "down", free: null, hx: 1 };
const defeat: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 2, mood: "hurt", arm: "down", ear: "down", bal: [2, 1] }, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    f(90, { bob: 2, dx: -1, mood: "out", arm: "down", ear: "down", bal: [1, 0] }),
    f(100, { bob: 3, mood: "out", arm: "side", ear: "down", free: [46, 22], bal: [1, 0] }),
    f(110, { bob: 4, dx: 1, mood: "out", arm: "side", ear: "down", free: [47, 21], bal: [-1, 0] }),
    f(110, { bob: 5, mood: "out", arm: "side", ear: "down", free: [46, 20], bal: [1, 0] }),
    f(110, { ...FLOP, hy: -2, free: [47, 20], bal: [-1, 0] }, { specks: dust(0) }),
    f(120, { ...FLOP, free: [46, 20], bal: [1, 0] }, { cue: "poof", shake: [1, 0], specks: [...star(32, 28), ...star(46, 32, "I"), ...dust(1)] }),
    f(160, { ...FLOP, tail: 1, free: [47, 21], bal: [-1, 0] }, { specks: [...star(30, 26, "l"), ...star(44, 30)] }),
    f(200, { ...FLOP, free: [46, 21], bal: [1, 0] }, { specks: [...star(33, 27), ...star(45, 31, "I")] }),
    f(1000, { ...FLOP, tail: 1, free: [47, 20], bal: [-1, 0] }, { specks: [...star(31, 27, "l")] }),
  ],
};

/** Victory: jumping for joy, the balloon waving high, confetti popping all round. Then again. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const air = [0, 3, 5, 6, 5, 3, 0, 0, 3, 5, 3, 0][i]!;
    const arms: ArmName[] = ["high", "up", "high", "high", "up", "up", "high", "high", "up", "high", "high", "up"];
    return f(110, { bob: i === 0 || i === 6 || i === 7 ? 2 : 0, air, mood: air > 2 ? "happy" : "cheer", arm: arms[i]!, feet: air > 2 ? { nh: { lift: 3 }, fh: { lift: 3 }, ff: { lift: 3 } } : {}, hy: i % 2 ? -1 : 0, ear: air > 3 ? "up" : "mid", tail: i % 2 ? 2 : -1, bal: [i % 2 ? 1 : -1, -2 - (air > 3 ? 2 : 0)], bow: i % 2 ? 2 : -2 }, { specks: [...confetti(i), ...twinkles(i, 1)], cue: i === 2 ? "squeak" : undefined });
  }),
};

export const sidekickBabur: Character = {
  id: "sidekick-babur",
  name: "Babur's sidekick",
  w: W,
  h: H,
  foot: [28, GROUND],
  palette: SIDEKICK_BABUR_PALETTE,
  halo: "#3a2a22",
  parts: PARTS,
  anims: { idle, walk, sit, wave, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory },
};
