/**
 * Jefferson's sidekick (id "sidekick-jefferson-sonnet-2"): a baby giraffe, a town bot that wanders the square and plays
 * chess at the park's tables. No powers, never fights: a curious kid who copies the big guy, so it carries ONE small
 * sparkler in one hoof, held up proudly.
 *
 * Softer and rounder than Jefferson: paler yellow, a few round pale-orange spots, a big round head with big shiny
 * eyes, short stubby ossicones with no flames, a plain brown tuft down its neck and on its tail, a round little body
 * and knobbly legs. Three-quarters, facing our right, light from the top left.
 *
 * Rigging: the head (one per face), the neck+torso (one part, no seam) and the ears are painted once; the legs, the
 * tail and the sparkler arm are painted from points (hip, knee, ankle) per pose, so a new pose is a handful of numbers.
 * The sparkler spits seeded sparks (specks), so every frame fizzles a little differently.
 */
import { canvas, ellipse, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../../../packages/app/src/characters/sprite.ts";

export const SIDEKICK_PALETTE = {
  k: "#1e0e05", // outline
  d: "#d99b34", // pale giraffe yellow, dark to light
  c: "#f0bf4c",
  C: "#fbd96e",
  h: "#fff0a8",
  o: "#dd8f33", // soft round spots
  O: "#bd7120",
  u: "#fff3cf", // cream: muzzle, belly
  U: "#f1d38f",
  b: "#7a4019", // hooves, ossicone knobs, tufts
  B: "#4a230c",
  N: "#a35d2c",
  s: "#24120a", // eye: pupil, lower iris, shine, white
  n: "#74401f",
  t: "#fff8e6",
  q: "#f28f80", // blush, ear inside, tongue
  m: "#69190e", // mouth
  x: "#ffffff", // white-hot spark, eye shine
  y: "#fff7b8", // sparks: core to rim
  Y: "#ffd23a",
  f: "#ff9a1f",
  F: "#f2541b",
  R: "#b3270f",
  w: "#b4b4c0", // sparkler wire
  W: "#62626c",
  g: "#b8b0b8", // smoke, dust
  G: "#7d7580",
  j: "#7fd3ff", // sweat
  i: "#9fe8ff", // pastel fireworks
  l: "#ff9bd6",
  r: "#c98f4e", // stool wood, light to dark
  p: "#a06a33",
  P: "#6c4222",
  z: "#0d0e12", // ground shadow
} as const;

type Pt = readonly [number, number];

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

const ell = (cx: number, cy: number, rx: number, ry: number) => (x: number, y: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
/** Pale yellow by a light value (0 dark to 1 light): banded, never blended. */
const tone = (l: number) => (l < 0.27 ? "d" : l < 0.58 ? "c" : l < 0.86 ? "C" : "h");
/** Light from the top left on a round surface. */
const roundL = (cx: number, cy: number, rx: number, ry: number, bias = 0) => (x: number, y: number) => 0.52 + bias - 0.45 * ((x - cx) / rx) - 0.55 * ((y - cy) / ry);
function fill(cv: Canvas, inside: (x: number, y: number) => boolean, light: (x: number, y: number) => number): void {
  for (let y = 0; y < cv.length; y++) for (let x = 0; x < cv[0]!.length; x++) if (inside(x, y)) cv[y]![x] = tone(light(x, y));
}
/** A round spot on the yellow only. */
function spot(cv: Canvas, cx: number, cy: number, rx: number, ry = rx): void {
  const e = ell(cx, cy, rx, ry);
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
    for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      const k = cv[y]?.[x];
      if (k && "dcCh".includes(k) && e(x, y)) cv[y]![x] = k === "d" ? "O" : "o";
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

// ---- Faces. A big round head: two big shiny eyes (a dark eye with a white shine), blush, a little muzzle.

export type Mood = "calm" | "blink" | "happy" | "cheer" | "think" | "thinkBlink" | "smug" | "rattled" | "hurt" | "out" | "bold";
type Eye = "open" | "up" | "wide" | "half" | "arc" | "shut" | "pinch" | "x";
type Brow = "up" | "worried" | "bold" | "smug";
type Mouth = "smile" | "grin" | "flat" | "smirk" | "wavy" | "o" | "tongue" | "gasp";

/** The near eye (6 x 6, on our left) and the far one (5 x 5, by the bridge of its nose), by look. */
const NEAR_EYE: Record<Eye, readonly string[]> = {
  open: [".kkkk.", "kxxssk", "kxsssk", "ksssnk", "kssnnk", ".kkkk."],
  up: [".kkkk.", "kssxxk", "ksssxk", "knsssk", "knnssk", ".kkkk."],
  wide: [".kkkk.", "kttttk", "kttssk", "kttssk", "kttttk", ".kkkk."],
  half: ["......", "kkkkkk", "kxsssk", "ksssnk", ".kkkk.", "......"],
  arc: ["......", "......", ".kkkk.", "k....k", "......", "......"],
  shut: ["......", "......", "......", "kkkkkk", "......", "......"],
  pinch: ["......", "kk....", ".kkk..", "...kkk", ".kkk..", "kk...."],
  x: ["......", "k...k.", ".k.k..", "..k...", ".k.k..", "k...k."],
};
const FAR_EYE: Record<Eye, readonly string[]> = {
  open: [".kkk.", "kxssk", "ksssk", "ksnnk", ".kkk."],
  up: [".kkk.", "kssxk", "kssxk", "knssk", ".kkk."],
  wide: [".kkk.", "kttsk", "ktssk", "kttsk", ".kkk."],
  half: [".....", "kkkkk", "kxssk", ".kkk.", "....."],
  arc: [".....", ".....", ".kkk.", "k...k", "....."],
  shut: [".....", ".....", ".....", "kkkkk", "....."],
  pinch: [".....", "...kk", "..kk.", ".kk..", "..kk."],
  x: [".....", ".k.k.", "..k..", ".k.k.", "....."],
};
/** Brows: [near, far] pixel lists on the head grid, dark brown. */
const BROWS: Record<Brow, readonly [readonly Pt[], readonly Pt[]]> = {
  up: [[[7, 7], [8, 7], [9, 7]], [[15, 6], [16, 6], [17, 6]]],
  worried: [[[5, 9], [6, 8], [7, 8], [8, 7]], [[14, 6], [15, 7], [16, 7]]],
  bold: [[[5, 8], [6, 8], [7, 9], [8, 9]], [[14, 8], [15, 7], [16, 7]]],
  smug: [[[5, 8], [6, 8], [7, 8]], [[15, 5], [16, 5], [17, 6]]],
};
const MOUTHS: Record<Mouth, readonly string[]> = {
  smile: ["k....k", ".kkkk."],
  grin: ["kkkkkk", "kmmmmk", ".kqqk.", "..kk.."],
  flat: ["kkkk"],
  smirk: ["....kk", "kkkk.."],
  wavy: ["k.k.k", ".k.k."],
  o: [".kk.", "kmmk", ".kk."],
  tongue: ["kkkkkk", "kmmqqk", "..kqqk", "...kk."],
  gasp: ["kkkk", "kmmk", "kmmk", "kkkk"],
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

const HW = 25;
const HH = 21;
/** Where the head grid sits at rest (its top-left), on the frame. */
const HX0 = 21;
const HY0 = 8;

function head(mood: Mood): Part {
  const cv = canvas(HW, HH);
  // The far ear, peeking out above and ahead of the skull.
  const earPoly = ell(21, 6.5, 3.4, 3.4);
  fill(cv, (x, y) => earPoly(x, y) && x >= 17, (x, y) => 0.5 - 0.1 * (x - 20) + 0.04 * (6 - y));
  dots(cv, [[20, 5], [21, 5], [21, 6]], "q");
  // Ossicones: short stalks with brown knobs.
  for (const hx of [7, 13]) {
    for (let y = 3; y <= 7; y++) {
      cv[y]![hx] = "C";
      cv[y]![hx + 1] = "c";
    }
    cv[6]![hx + 1] = "d";
    stamp(cv, [".Nb.", "NbbB", ".bB."], hx - 1, 0);
  }
  // Skull and snout, lit from the top left; the muzzle cream.
  const skull = ell(12, 13, 9.6, 7.4);
  const snout = ell(19, 15.5, 5.6, 4.8);
  const inside = (x: number, y: number) => skull(x, y) || snout(x, y);
  fill(cv, inside, roundL(14, 14, 11.5, 9, 0.12));
  const muzzle = ell(20, 16.2, 4.9, 4.2);
  fill(cv, (x, y) => inside(x, y) && muzzle(x, y), (x, y) => 0.7 - 0.04 * (y - 12) - 0.03 * (x - 18));
  for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) if (cv[y]![x] === "d" && muzzle(x, y)) cv[y]![x] = "U";
  for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) if (muzzle(x, y) && inside(x, y) && "cCh".includes(cv[y]![x]!)) cv[y]![x] = cv[y]![x] === "c" ? "U" : "u";
  // A couple of round spots, and the nostrils.
  spot(cv, 11, 7, 1.1, 0.8);
  spot(cv, 7, 18, 1.3, 1);
  dots(cv, [[22, 13], [23, 13], [23, 14]], "B");
  const face = FACES[mood];
  stamp(cv, NEAR_EYE[face.near], 5, 10);
  stamp(cv, FAR_EYE[face.far], 14, 9);
  if (face.blush) dots(cv, [[6, 17], [7, 17], [8, 17]], "q");
  if (face.brow) for (const side of BROWS[face.brow]) dots(cv, side, "B");
  const mouth = MOUTHS[face.mouth];
  const mx = face.mouth === "grin" || face.mouth === "tongue" ? 17 : face.mouth === "o" || face.mouth === "gasp" ? 19 : face.mouth === "flat" ? 19 : 17;
  const my = face.mouth === "grin" || face.mouth === "tongue" ? 16 : face.mouth === "gasp" ? 16 : face.mouth === "o" ? 17 : face.mouth === "smile" ? 17 : 18;
  stamp(cv, mouth, mx, my);
  return { grid: toGrid(cv) };
}
const MOODS: readonly Mood[] = ["calm", "blink", "happy", "cheer", "think", "thinkBlink", "smug", "rattled", "hurt", "out", "bold"];
for (const m of MOODS) PARTS[`head:${m}`] = head(m);

/** The near ear: out to our left behind the head, three ways. */
PARTS["ear:mid"] = { grid: ["..ddcc..", ".dqqqCc.", "dqqqCCcc", ".dqqCccc", "..ddcc.."] };
PARTS["ear:up"] = { grid: ["dd......", "dqdcc...", ".dqqCc..", "..dqCCcc", "...dcccc"] };
PARTS["ear:down"] = { grid: ["........", "...ddcc.", ".ddqqCcc", "dqqqCccc", ".dqqCcc.", "..dd...."] };

PARTS["shadow"] = (() => {
  const cv = canvas(34, 3);
  ellipse(cv, 17, 1.5, 17, 1.5, "z");
  return { grid: toGrid(cv), outline: false };
})();

PARTS["hoof"] = { grid: ["bNb..", "bbbbb", "BBBBB"] };
PARTS["tuft"] = { grid: [".Nb.", "NbbB", "bbBb", ".bB."] };
PARTS["stool"] = {
  grid: [
    "rrrrrrrrrrrrrrrrrrrrrr",
    "pppppppppppppppppppppp",
    "PPPPPPPPPPPPPPPPPPPPPP",
    "..pP..............pP..",
    "..pP..............pP..",
    "..pPPPPPPPPPPPPPPPPP..",
    "..pP..............pP..",
    "..pP..............pP..",
    "..pP..............pP..",
  ],
};

// ---- Torso and neck: one part (one outline round both), with a plain brown tuft down the back of the neck.

const BODY = { cx: 24, cy: 42, rx: 11.5, ry: 7.6 };
const NECK: readonly Pt[] = [[29, 41], [31, 33], [32, 24]];
const NECK_R = 4.0;

function near(p: Pt, a: Pt, b: Pt): { d: number; nx: number; ny: number } {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy || 1)));
  const nx = p[0] - (a[0] + t * vx);
  const ny = p[1] - (a[1] + t * vy);
  return { d: Math.hypot(nx, ny), nx, ny };
}
function nearest(p: Pt, pts: readonly Pt[]): { d: number; nx: number; ny: number } {
  let best = { d: Infinity, nx: 0, ny: 0 };
  for (let i = 0; i + 1 < pts.length; i++) {
    const n = near(p, pts[i]!, pts[i + 1]!);
    if (n.d < best.d) best = n;
  }
  return best;
}

function bodyPart(): Painted {
  const cv = canvas(W, H);
  const body = ell(BODY.cx, BODY.cy, BODY.rx, BODY.ry);
  const bodyL = roundL(BODY.cx, BODY.cy, BODY.rx, BODY.ry, 0.02);
  const neck = (x: number, y: number) => nearest([x, y], NECK).d <= NECK_R;
  fill(cv, (x, y) => body(x, y) || neck(x, y), (x, y) => {
    const bl = bodyL(x, y);
    if (!neck(x, y)) return bl;
    const n = nearest([x, y], NECK);
    const nl = 0.5 - 0.32 * (n.nx / NECK_R) - 0.1 * (n.ny / NECK_R);
    const w = Math.max(0, Math.min(1, (y - 31) / 7));
    return nl * (1 - w) + bl * w;
  });
  // A cream tummy.
  const belly = ell(27, 49, 9, 4.2);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (body(x, y) && belly(x, y) && "dcCh".includes(cv[y]![x]!)) cv[y]![x] = cv[y]![x] === "d" || cv[y]![x] === "c" ? "U" : "u";
  // Fewer, rounder spots.
  for (const [x, y, r] of [[17, 39, 2], [23, 37, 1.6], [20, 44, 1.5], [33, 42, 1.5], [29, 31, 1.5], [34, 29, 1.3]] as const) spot(cv, x, y, r, r * 0.9);
  // The mane: a plain brown tuft down the back of the neck.
  for (const y of [25, 28, 31, 34]) {
    let x = 0;
    while (x < W && cv[y]![x] === ".") x++;
    if (x >= 20 && x < 30) stamp(cv, ["NN", "bb"], x - 2, y);
  }
  return crop(cv);
}
const BODY_PART = painted("body", bodyPart);

// ---- Limbs: a round stroke through a few points, three bands of light, a knobbly knee, a hoof or a ball at the end.

interface StrokeOpts {
  r: number;
  far?: boolean;
  knee?: number;
  ball?: number;
  spot?: boolean;
}
function stroke(pts: readonly Pt[], o: StrokeOpts): Painted {
  const cv = canvas(W, H);
  const end = pts[pts.length - 1]!;
  const knee = pts.length >= 3 ? pts[1]! : null;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const n = nearest([x, y], pts);
      const dk = knee && o.knee ? Math.hypot(x - knee[0], y - knee[1]) : 99;
      const de = o.ball ? Math.hypot(x - end[0], y - end[1]) : 99;
      if (de <= o.ball!) {
        const l = 0.55 - 0.2 * (x - end[0]) - 0.25 * (y - end[1]);
        cv[y]![x] = l > 0.8 ? "N" : l > 0.3 ? "b" : "B";
        continue;
      }
      if (n.d > o.r && dk > (o.knee ?? 0)) continue;
      const u = dk <= o.knee! && n.d > o.r ? (x - knee![0]) / o.knee! : n.nx / o.r;
      let k = u < -0.4 ? "C" : u < 0.45 ? "c" : "d";
      if (o.far) k = k === "C" ? "c" : "d";
      if (dk <= o.knee! && x < knee![0] && y < knee![1] && !o.far) k = "h";
      cv[y]![x] = k;
    }
  if (o.spot && pts.length >= 2) {
    const [a, b] = [pts[0]!, pts[1]!];
    const sx = Math.round(a[0] + (b[0] - a[0]) * 0.45);
    const sy = Math.round(a[1] + (b[1] - a[1]) * 0.45);
    for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
      const k = cv[sy + oy]?.[sx + ox];
      if (k && "dcCh".includes(k)) cv[sy + oy]![sx + ox] = k === "d" ? "O" : "o";
    }
  }
  return crop(cv);
}

type LegKey = "nh" | "fh" | "ff" | "nf";
const HIP: Record<LegKey, Pt> = { nh: [15, 45], fh: [19, 45], ff: [28, 45], nf: [32, 45] };
const FOOT_X: Record<LegKey, number> = { nh: 14, fh: 18, ff: 29, nf: 33 };
const ANKLE_Y = 58;

function legPart(hip: Pt, knee: Pt, ankle: Pt, near: boolean, r = 1.5): Painted & { name: string } {
  const pts = [hip, knee, ankle] as const;
  return painted(`leg:${near ? "n" : "f"}:${r}:${pts.map((p) => p.join(",")).join(";")}`, () => stroke(pts, { r, far: !near, knee: r + 0.7, spot: near }));
}

/** The sparkler arm (the near foreleg held up): shoulder, elbow, hoof, and the sparkler's direction and length. */
interface Arm {
  pts: readonly [Pt, Pt, Pt];
  dir: Pt;
  len: number;
}
export type ArmName = "hold" | "up" | "high" | "waveL" | "waveM" | "waveR" | "point" | "down" | "side" | "tuck";
const SH: Pt = [32, 43];
const ARMS: Record<ArmName, Arm> = {
  hold: { pts: [SH, [38, 46], [44, 39]], dir: [0.35, -1], len: 9 },
  up: { pts: [SH, [40, 44], [47, 36]], dir: [0.3, -1], len: 9 },
  high: { pts: [SH, [41, 44], [48, 32]], dir: [0.15, -1], len: 9 },
  waveL: { pts: [SH, [40, 46], [45, 37]], dir: [0.1, -1], len: 9 },
  waveM: { pts: [SH, [40, 46], [47, 36]], dir: [0.45, -1], len: 9 },
  waveR: { pts: [SH, [40, 46], [49, 37]], dir: [0.8, -1], len: 8 },
  point: { pts: [SH, [40, 44], [47, 38]], dir: [1, -0.3], len: 6 },
  down: { pts: [SH, [37, 49], [40, 53]], dir: [1, 0.3], len: 5 },
  side: { pts: [SH, [38, 47], [43, 45]], dir: [0.7, -0.8], len: 6 },
  tuck: { pts: [[30, 47], [35, 51], [38, 48]], dir: [0.5, -1], len: 5 },
};

function wirePart(from: Pt, to: Pt, lit: boolean): Painted & { name: string } {
  return painted(`wire:${from}:${to}:${lit ? 1 : 0}`, () => {
    const cv = canvas(W, H);
    const path: Pt[] = [];
    let [x, y] = from;
    const dx = Math.abs(to[0] - x);
    const dy = -Math.abs(to[1] - y);
    const sx = x < to[0] ? 1 : -1;
    const sy = y < to[1] ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      path.push([x, y]);
      if (x === to[0] && y === to[1]) break;
      const e2 = 2 * err;
      if (e2 >= dy) (err += dy), (x += sx);
      if (e2 <= dx) (err += dx), (y += sy);
    }
    path.forEach(([px, py], i) => (cv[py]![px] = i >= path.length - 2 ? (lit ? "f" : "W") : i % 3 === 2 ? "W" : "w"));
    return crop(cv);
  });
}

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
  /** The sparkler arm (null: that foreleg just stands). */
  arm?: ArmName | null;
  tail?: number;
  ear?: "mid" | "up" | "down";
  /** The sparkler lit (spitting sparks), seeded; `size` how big the spray. */
  lit?: boolean;
  spark?: number;
  size?: number;
  sit?: boolean;
  /** Flopped on its belly (defeat). */
  lie?: boolean;
  noShadow?: boolean;
}

function build(p: Pose): { layers: Layer[]; tip: Pt | null } {
  const dx = p.dx ?? 0;
  const air = p.air ?? 0;
  const bob = p.bob ?? 0;
  const sit = p.sit ?? false;
  const by = bob - air;
  const ux = (sit ? -2 : 0) + dx;
  const uy = (sit ? 2 : 0) + by;
  const layers: Layer[] = [];
  const add = (l: { name: string; at: Pt }, ox = 0, oy = 0) => layers.push({ part: l.name, x: l.at[0] + ox, y: l.at[1] + oy });
  const put = (part: string, x: number, y: number) => layers.push({ part, x, y });
  const lie = p.lie ?? false;
  const arm = lie ? null : p.arm === undefined ? "hold" : p.arm;
  if (!p.noShadow) put("shadow", 9 + dx, GROUND - 2);
  if (sit) put("stool", 11 + dx, 52);

  // The tail: a thin stroke out the back, ending in a plain brown tuft.
  const tl = p.tail ?? 0;
  const tailEnd: Pt = [8 + tl, 48 - air + (sit ? 3 : 0)];
  const tailStroke = painted(`tail:${tl}:${sit ? 1 : 0}:${air}:${by}`, () => stroke([[12, 40 + by], [Math.round(9 + tl / 2), 43 + by], tailEnd], { r: 0.7 }));
  add(tailStroke, dx);
  put("tuft", tailEnd[0] - 1 + dx, tailEnd[1] - 1);

  const foot = (k: LegKey): Pt => [FOOT_X[k] + (p.feet?.[k]?.x ?? 0) + dx, ANKLE_Y - air - (p.feet?.[k]?.lift ?? 0)];
  const stand = (k: LegKey, near: boolean) => {
    const hip: Pt = [HIP[k][0] + dx, HIP[k][1] + by];
    const a = foot(k);
    const out = (k === "ff" || k === "nf" ? 1 : -1) * (1 + (bob > 1 ? 1 : 0));
    const knee: Pt = [Math.round((hip[0] + a[0]) / 2 + out), Math.round((hip[1] + a[1]) / 2)];
    add(legPart(hip, knee, a, near));
    put("hoof", a[0] - 1, a[1]);
  };
  if (lie) {
    // Flopped down on its belly, forelegs stretched out in front.
    add(legPart([30 + dx, 54], [37 + dx, 57], [42 + dx, 58], false));
    put("hoof", 41 + dx, 58);
  } else if (sit) {
    // Dangling over the edge of the stool: the far legs behind, the near thigh folded over the body.
    const far = legPart([20 + dx, 49 + by], [30 + dx, 52 + by], [33 + dx, 57], false);
    add(far);
    put("hoof", 32 + dx, 57);
    const farF = legPart([30 + dx, 49 + by], [35 + dx, 53 + by], [35 + dx, 58], false);
    add(farF);
    put("hoof", 34 + dx, 58);
  } else {
    stand("fh", false);
    stand("ff", false);
    stand("nh", true);
    if (arm === null) stand("nf", true);
  }

  add(BODY_PART, ux, uy);
  if (lie) {
    add(legPart([27 + dx, 54], [34 + dx, 57], [39 + dx, 58], true));
    put("hoof", 38 + dx, 58);
    add(wirePart([46 + dx, 59], [54 + dx, 59], false));
  }
  if (sit) {
    const th = legPart([17 + dx, 49 + by], [28 + dx, 51 + by], [31 + dx, 57], true, 2.2);
    add(th);
    put("hoof", 30 + dx, 57);
  }

  // The ear behind the head, then the head.
  const hx = HX0 + (p.hx ?? 0) + ux;
  const hy = Math.max(3, HY0 + (p.hy ?? 0) + uy);
  put(`ear:${p.ear ?? "mid"}`, hx - 3, hy + 7);
  put(`head:${p.mood ?? "calm"}`, hx, hy);

  // The sparkler arm, in front.
  let tip: Pt | null = null;
  if (arm !== null) {
    const spec = ARMS[arm];
    const pts = spec.pts.map((q, i): Pt => [q[0] + dx, Math.min(q[1] + by, i === 2 ? 55 : 54)]);
    const [s, e, fist] = pts as [Pt, Pt, Pt];
    add(painted(`arm:${arm}:${s};${e};${fist}`, () => stroke([s, e, fist], { r: 1.5, ball: 2.3, knee: 2.1 })));
    const n = Math.hypot(spec.dir[0], spec.dir[1]);
    const from: Pt = [Math.round(fist[0] + (spec.dir[0] / n) * 2), Math.round(fist[1] + (spec.dir[1] / n) * 2)];
    tip = [Math.round(fist[0] + (spec.dir[0] / n) * (spec.len + 2)), Math.round(fist[1] + (spec.dir[1] / n) * (spec.len + 2))];
    add(wirePart(from, tip, p.lit !== false));
  }
  return { layers, tip };
}

// ---- Sparks and little effects.

function seeded(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => ((s = (s * 1103515245 + 12345) >>> 0) >>> 8) / 16777216;
}

/** A sparkler's burning head: a white-hot core, four short rays (crossed or diagonal) and a few loose sparks. */
function spray([x, y]: Pt, seed: number, size = 1): Speck[] {
  const rnd = seeded(seed * 7 + 3);
  const out: Speck[] = [];
  const reach = size < 0.7 ? 2 : 3;
  const rays: readonly Pt[] = seed % 2 ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dy] of rays) for (let d = 1; d <= reach; d++) out.push([x + dx * d, y + dy * d, d === reach ? "F" : d === 1 ? "Y" : "f"]);
  const n = Math.round(3 + 6 * size);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const d = reach + 1 + rnd() * 3 * size;
    out.push([Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), d > reach + 2.5 ? "F" : d > reach + 1.2 ? "f" : "Y"]);
  }
  out.push([x - 1, y, "Y"], [x + 1, y, "Y"], [x, y - 1, "Y"], [x, y + 1, "Y"], [x, y, "x"]);
  return out;
}
/** A twinkle: a little plus. */
const star = (x: number, y: number, k = "Y"): Speck[] => [[x, y, "x"], [x - 1, y, k], [x + 1, y, k], [x, y - 1, k], [x, y + 1, k]];
/** Twinkles scattered round the figure, a new set per `t`. */
function twinkles(t: number, n = 4, box: readonly [number, number, number, number] = [6, 4, 54, 44]): Speck[] {
  const rnd = seeded(t * 31 + 5);
  return Array.from({ length: n }, (_, i) => star(Math.round(box[0] + rnd() * (box[2] - box[0])), Math.round(box[1] + rnd() * (box[3] - box[1])), (i + t) % 2 ? "Y" : "i")).flat();
}
/** Dust puffing out along the ground at the feet. */
const dust = (t: number): Speck[] =>
  [-1, 1].flatMap((side) =>
    [0, 1, 2].map((i): Speck => [Math.round(26 + side * (9 + i * 3 + t * 2)), GROUND - 1 - (i % 2) - (t > 0 ? 1 : 0), t > 1 ? "G" : "g"]),
  );
/** The shadow on the ground, growing as it drops in. */
const dropShadow = (r: number): Speck[] => Array.from({ length: r * 2 + 1 }, (_, i): Speck => [26 - r + i, GROUND - 1, "z"]);
/** Thought dots beside the head. */
const thoughts = (n: number): Speck[] =>
  ([[49, 17], [53, 14], [57, 11]] as const).slice(0, n).flatMap(([x, y], k): Speck[] => {
    const big = k === 2;
    return [[x, y, "t"], [x + 1, y, "t"], [x, y + 1, "t"], [x + 1, y + 1, "g"], ...(big ? ([[x - 1, y, "t"], [x + 2, y, "t"], [x, y - 1, "t"], [x + 1, y - 1, "t"], [x - 1, y + 1, "g"], [x + 2, y + 1, "G"], [x, y + 2, "g"], [x + 1, y + 2, "G"]] as Speck[]) : [])];
  });
/** Smoke wisps rising from a point. */
const wisps = ([x, y]: Pt, t: number, n = 3): Speck[] =>
  Array.from({ length: n }, (_, i): Speck[] => {
    const yy = y - ((t * 2 + i * 4) % 11);
    const xx = x + Math.round(Math.sin(t * 0.9 + i * 2) * 1.5);
    return [[xx, yy, i % 2 ? "g" : "G"], [xx + 1, yy - 1, "G"]];
  }).flat();
/** Sweat flying off the head. */
const sweat = (i: number): Speck[] => {
  const t = i % 4;
  return [[22 - t, 14 + t, "j"], [22 - t, 15 + t, "x"], [44 + t, 10 + t, "j"], [44 + t, 11 + t, "x"]];
};
/** A burst of pastel fireworks. */
function burst([cx, cy]: Pt, r: number, seed = 0): Speck[] {
  const keys = ["Y", "l", "i", "f"];
  return Array.from({ length: 8 }, (_, i): Speck => [Math.round(cx + Math.cos((i / 8) * Math.PI * 2 + seed) * r), Math.round(cy + Math.sin((i / 8) * Math.PI * 2 + seed) * r), keys[(i + seed) % 4]!]);
}

const FLASH: Record<string, string> = { d: "#f0c46e", c: "#fbe0a0", C: "#fff1c8", h: "#ffffff", o: "#f0b070", O: "#d89a50" };

/** One frame: the pose, its sparks and anything extra. */
function f(ms: number, p: Pose, extra: Partial<Frame> = {}): Frame {
  const b = build(p);
  const sparks = b.tip && p.lit !== false ? spray(b.tip, p.spark ?? 0, p.size ?? 1) : [];
  const specks = [...sparks, ...(extra.specks ?? [])].filter(([x, y]) => x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2);
  return { ms, layers: b.layers, ...extra, specks };
}

// ---- Animations.

/** Idle (3 s): breathes, blinks, flicks an ear and its tail, glances ahead; the sparkler fizzles all the while. */
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 30 }, (_, i) => {
    const bob = i % 15 >= 8 ? 1 : 0;
    const blink = i === 11 || i === 12 || i === 27;
    const ear = i === 20 || i === 21 ? "down" : i === 22 ? "up" : "mid";
    const tail = i >= 4 && i <= 7 ? (i % 2 ? 2 : 1) : 0;
    const hx = i >= 24 && i <= 29 ? 1 : 0;
    return f(100, { bob, mood: blink ? "blink" : "calm", ear, tail, hx, spark: i }, {});
  }),
};

/** Walk (0.6 s): a short trot on knobbly legs, the head bobbing, the sparkler held up. */
const walk: Anim = {
  loop: true,
  frames: Array.from({ length: 6 }, (_, i) => {
    const th = (i / 6) * Math.PI * 2;
    const leg = (off: number) => ({ x: Math.round(3 * Math.sin(th + off * Math.PI * 2)), lift: Math.max(0, Math.round(3 * Math.cos(th + off * Math.PI * 2))) });
    const bob = i % 3 === 0 ? 0 : 1;
    return f(100, { bob, hy: i % 3 === 0 ? -1 : 0, hx: i % 3 === 0 ? 1 : 0, mood: "calm", feet: { nh: leg(0), ff: leg(0), fh: leg(0.5) }, tail: i < 3 ? 1 : -1, ear: bob ? "down" : "mid", spark: i * 3 + 1 }, i % 3 === 0 ? { cue: "step" } : {});
  }),
};

/** Sit (loops): on a stool at the chess table, facing the board, legs dangling, the sparkler low in its lap; thinks about a move. */
const SIT: Pose = { sit: true, arm: "tuck", size: 0.5 };
const sit: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) => {
    const lean = i >= 6 && i <= 11;
    const blink = i === 3 || i === 4 || i === 13;
    const swing = i % 8 < 4 ? 0 : 1;
    return f(200, { ...SIT, mood: blink ? (lean ? "thinkBlink" : "blink") : lean ? "think" : "calm", bob: i % 8 >= 4 ? 1 : 0, hx: lean ? 2 : 0, hy: lean ? 1 : 0, ear: i === 9 ? "down" : "mid", tail: swing, spark: i }, {});
  }),
};

/** Wave (once, 1.2 s): lifts the sparkler and waves it in a little arc, then settles back to its idle pose. */
const WAVES: readonly ArmName[] = ["waveL", "waveM", "waveR", "waveM", "waveL", "waveM", "waveR", "waveM"];
const wave: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 1, mood: "happy", arm: "hold", spark: 1 }),
    f(100, { mood: "cheer", arm: "up", size: 1.2, hy: -1, spark: 2 }, { cue: "fizz" }),
    ...WAVES.map((arm, i) => f(100, { mood: i % 2 ? "cheer" : "happy", arm, size: 1.3, hx: arm === "waveL" ? -1 : arm === "waveR" ? 1 : 0, hy: i % 2 ? 0 : -1, bob: i % 2 ? 1 : 0, tail: i % 2 ? 2 : -1, ear: i % 4 === 1 ? "up" : "mid", spark: 3 + i }, { specks: i % 3 === 0 ? star(46 + (i % 5), 8 + (i % 4) * 2) : [] })),
    f(100, { mood: "happy", arm: "hold", spark: 12 }),
    f(100, { mood: "calm", arm: "hold", spark: 0 }),
  ],
};

/** Entrance: drops in from above on its shadow, lands with a squash and a puff of dust, then lifts the sparkler: ta-da. */
const entrance: Anim = {
  loop: false,
  frames: [
    { ms: 90, layers: [], specks: dropShadow(4) },
    { ms: 80, layers: [], specks: dropShadow(8) },
    f(70, { air: 7, mood: "cheer", arm: "up", feet: { nh: { lift: 2 }, fh: { lift: 3 }, ff: { lift: 2 } }, ear: "up", size: 0.8, spark: 1 }, { specks: dropShadow(11) }),
    f(70, { air: 3, mood: "cheer", arm: "up", feet: { nh: { lift: 1 }, fh: { lift: 2 }, ff: { lift: 1 } }, ear: "up", size: 0.8, spark: 2 }),
    f(100, { bob: 3, mood: "blink", arm: "hold", ear: "down", size: 0.6, spark: 3 }, { cue: "step", specks: dust(0) }),
    f(90, { bob: 1, mood: "happy", arm: "up", spark: 4 }, { specks: dust(1) }),
    f(110, { mood: "cheer", arm: "high", size: 1.5, hy: -1, spark: 5 }, { cue: "fizz", specks: [...dust(2), ...twinkles(1, 3)] }),
    f(110, { mood: "happy", arm: "waveL", size: 1.3, hx: -1, spark: 6 }, { specks: twinkles(2, 3) }),
    f(110, { mood: "happy", arm: "waveR", size: 1.3, hx: 1, spark: 7 }),
    f(120, { mood: "happy", arm: "hold", spark: 8 }),
    f(300, { mood: "calm", arm: "hold", spark: 9 }),
  ],
};

/** Thinking (loops): head tipped up, eyes rolled up, a foot tapping, the sparkler low, thought dots popping up. */
const thinking: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) =>
    f(150, { mood: i === 8 ? "thinkBlink" : "think", arm: "side", size: 0.5, hx: 2, hy: -1, bob: i % 6 >= 3 ? 1 : 0, feet: { ff: i % 4 === 1 ? { lift: 2 } : {} }, tail: i % 6 < 3 ? 1 : 0, ear: i === 5 ? "down" : "mid", spark: i }, { specks: thoughts(i % 6 < 1 ? 0 : i % 6 < 3 ? 1 : i % 6 < 5 ? 2 : 3) }),
  ),
};

/** Its move: a hop toward the board and a flick of the sparkler at it. */
const move: Anim = {
  loop: false,
  frames: [
    f(90, { bob: 2, mood: "bold", arm: "hold", spark: 1 }),
    f(80, { air: 4, dx: 1, mood: "bold", arm: "point", feet: { nh: { lift: 2 }, fh: { lift: 3 }, ff: { lift: 2 } }, size: 1.2, ear: "up", spark: 2 }, { cue: "fizz" }),
    f(80, { air: 5, dx: 2, mood: "bold", arm: "point", feet: { nh: { lift: 2 }, fh: { lift: 2 }, ff: { lift: 2 } }, size: 1.2, spark: 3 }),
    f(100, { bob: 2, dx: 2, mood: "happy", arm: "point", size: 1.4, spark: 4 }, { specks: dust(0) }),
    f(100, { bob: 1, dx: 2, mood: "happy", arm: "point", size: 1, spark: 5 }),
    f(110, { dx: 1, mood: "happy", arm: "hold", spark: 6 }),
    f(150, { mood: "calm", arm: "hold", spark: 7 }),
  ],
};

/** A capture: two excited hops, the sparkler waving high, twinkles everywhere. */
const capture: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 2, mood: "bold", arm: "hold", spark: 1 }),
    f(80, { air: 5, mood: "cheer", arm: "high", feet: { nh: { lift: 2 }, fh: { lift: 3 }, ff: { lift: 2 } }, size: 1.5, ear: "up", spark: 2 }, { cue: "fizz", specks: twinkles(1) }),
    f(80, { air: 6, mood: "happy", arm: "waveL", feet: { nh: { lift: 3 }, fh: { lift: 3 }, ff: { lift: 3 } }, size: 1.5, hy: -1, spark: 3 }, { specks: twinkles(2) }),
    f(80, { air: 4, mood: "happy", arm: "waveR", size: 1.5, spark: 4 }, { specks: twinkles(3) }),
    f(80, { bob: 2, mood: "cheer", arm: "high", size: 1.4, spark: 5 }, { specks: dust(0) }),
    f(80, { air: 6, mood: "happy", arm: "waveM", feet: { nh: { lift: 2 }, fh: { lift: 2 }, ff: { lift: 3 } }, size: 1.5, ear: "up", spark: 6 }, { specks: twinkles(4) }),
    f(80, { air: 6, mood: "happy", arm: "waveR", feet: { nh: { lift: 3 }, fh: { lift: 3 }, ff: { lift: 3 } }, size: 1.5, hy: -1, spark: 7 }, { specks: twinkles(5) }),
    f(80, { air: 4, mood: "happy", arm: "waveL", size: 1.5, spark: 8 }, { specks: twinkles(6) }),
    f(90, { bob: 2, mood: "cheer", arm: "high", size: 1.3, spark: 9 }, { specks: dust(1) }),
    f(120, { bob: 1, mood: "happy", arm: "up", spark: 10 }),
    f(160, { mood: "smug", arm: "hold", spark: 11 }),
  ],
};

/** Hurt: hit, a flash, eyes screwed shut, the sparkler sputtering; then it shakes it off with a brave little grin. */
const hurt: Anim = {
  loop: false,
  frames: [
    f(70, { bob: 2, mood: "hurt", arm: "down", ear: "down", size: 0.4, spark: 1 }, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    f(80, { bob: 3, mood: "hurt", arm: "down", ear: "down", size: 0.4, spark: 2 }, { shake: [-1, 0], specks: [[22, 13, "j"], [22, 14, "x"]] }),
    f(90, { bob: 2, dx: -1, mood: "hurt", arm: "down", ear: "down", size: 0.4, spark: 3 }, { specks: [[21, 15, "j"], [21, 16, "x"]] }),
    f(100, { bob: 1, dx: -1, mood: "rattled", arm: "side", size: 0.6, spark: 4 }),
    f(110, { mood: "blink", arm: "up", size: 0.9, spark: 5 }),
    f(120, { mood: "bold", arm: "up", size: 1, spark: 6 }),
    f(160, { mood: "calm", arm: "hold", spark: 7 }),
  ],
};

/** Check: two sharp jabs of the sparkler at the board, eyes bright. */
const JAB: Pose = { bob: 2, dx: 1, mood: "bold", arm: "point", size: 1.6 };
const check: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 1, mood: "bold", arm: "up", spark: 1 }),
    f(110, { ...JAB, spark: 2 }, { cue: "fizz" }),
    f(90, { bob: 1, mood: "bold", arm: "up", spark: 3 }),
    f(110, { ...JAB, spark: 4 }, { cue: "fizz" }),
    f(90, { bob: 1, dx: 1, mood: "bold", arm: "point", spark: 5 }),
    f(150, { dx: 1, mood: "happy", arm: "point", size: 1.2, spark: 6 }),
    f(160, { mood: "smug", arm: "hold", spark: 7 }),
  ],
};

/** Smug: chin up, eyes half shut, a little smirk, a slow nod, the sparkler held just so. */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(150, { mood: "smug", arm: "hold", hy: i < 3 || i > 5 ? -1 : 0, hx: i < 4 ? 0 : 1, bob: i % 4 === 2 ? 1 : 0, ear: i === 5 ? "up" : "mid", spark: i })),
};

/** Rattled: wide eyes, worried brows, sweat flying, trembling where it stands, the sparkler sputtering. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(80, { mood: "rattled", arm: "side", dx: i % 2 ? 1 : -1, bob: i % 4 === 2 ? 1 : 0, ear: "down", tail: i % 2 ? 1 : -1, size: 0.4, spark: i * 5 }, { specks: sweat(i) })),
};

/** Defeat: hit, dizzy eyes, the sparkler fizzles out, and it keels over onto its back, legs in the air (the last frame holds). */
const FLOP: Pose = { lie: true, bob: 10, mood: "out", ear: "down", lit: false, hx: 1, hy: 2 };
const defeat: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 2, mood: "hurt", arm: "down", ear: "down", size: 0.4, spark: 1 }, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    f(90, { bob: 2, dx: -1, mood: "out", arm: "down", ear: "down", size: 0.3, spark: 2 }),
    f(110, { bob: 4, dx: 1, mood: "out", arm: "down", ear: "down", lit: false }, { specks: wisps([44, 50], 1, 2) }),
    f(110, { bob: 6, dx: 0, hx: 1, mood: "out", arm: "down", ear: "down", lit: false }, { specks: wisps([44, 52], 2, 2) }),
    f(110, { ...FLOP, bob: 8, hy: 0 }, { specks: wisps([46, 52], 3, 2) }),
    f(120, { ...FLOP }, { cue: "poof", shake: [1, 0], specks: [...star(33, 20), ...star(46, 24, "i"), ...dust(0)] }),
    f(160, { ...FLOP, tail: 1 }, { specks: [...star(36, 18, "l"), ...star(28, 22), ...wisps([54, 58], 1, 2)] }),
    f(200, { ...FLOP }, { specks: [...star(31, 19), ...star(43, 23, "i"), ...wisps([54, 58], 2, 2)] }),
    f(1000, { ...FLOP, tail: 1 }, { specks: [...star(34, 20, "l"), ...wisps([54, 58], 3, 1)] }),
  ],
};

/** Victory: jumping for joy, the sparkler waving high, pastel fireworks popping all round. Then again. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const air = [0, 3, 5, 6, 5, 3, 0, 0, 3, 5, 3, 0][i]!;
    const arms: ArmName[] = ["high", "waveL", "waveM", "waveR", "waveM", "waveL", "high", "high", "waveR", "waveM", "waveL", "high"];
    return f(110, { bob: i === 0 || i === 6 || i === 7 ? 2 : 0, air, mood: air > 2 ? "happy" : "cheer", arm: arms[i]!, size: 1.5, feet: air > 2 ? { nh: { lift: 3 }, fh: { lift: 3 }, ff: { lift: 3 } } : {}, hy: i % 2 ? -1 : 0, ear: air > 3 ? "up" : "mid", tail: i % 2 ? 2 : -1, spark: i }, { specks: [...burst([14 + (i % 3) * 14, 12 + (i % 4) * 3], 2 + (i % 4), i), ...twinkles(i, 2)], cue: i === 2 ? "fizz" : undefined });
  }),
};

export const sidekickJeffersonSonnet2: Character = {
  id: "sidekick-jefferson-sonnet-2",
  name: "Jefferson's sidekick",
  w: W,
  h: H,
  foot: [26, GROUND],
  palette: SIDEKICK_PALETTE,
  halo: "#2e2218",
  parts: PARTS,
  anims: { idle, walk, sit, wave, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory },
};
