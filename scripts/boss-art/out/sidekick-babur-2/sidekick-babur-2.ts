/**
 * Babur's sidekick (id "sidekick-babur-2"): a tiger cub, a town bot that wanders the square and plays chess at the park's
 * tables. No powers, never fights: a small round cub that copies the big one, but where Babur holds four chess-piece balloons
 * on strings and pops them, the cub hugs ONE big plain purple party balloon like a stuffed animal. It is too little for
 * claws: paws are plainly soft and round, and the balloon only ever squishes in where it is held, bulges round the arms and
 * springs back.
 *
 * Rounder and smaller than Babur: a big round head with big amber eyes, round ears, a cream muzzle and cheeks, a few soft
 * stripes, a short striped tail, stubby legs with big cream feet. No vest, no hat. Three-quarters, facing our right, light
 * from the top left.
 *
 * Rigging: the head (one per face), the ears, the body and the balloon (one per squeeze) are painted once; the arms, the
 * legs and the tail are painted from points per pose, so a new pose is a handful of numbers. The balloon is a shape of its
 * own per squeeze level (-1 springing out, 0 resting, up to 4 squashed hard): it dents in where the near arm and the far paw
 * hold it and swells above and below them.
 */
import { canvas, ellipse, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../../../packages/app/src/characters/sprite.ts";

export const SIDEKICK_PALETTE = {
  k: "#1f1210", // outline
  b: "#a24512", // fur orange, dark to light
  c: "#d06a18",
  d: "#e8892a",
  e: "#f5ad55",
  f: "#b79c78", // cream: shadow to light
  g: "#dcc7a3",
  h: "#f3e6c8",
  i: "#fff8e8",
  s: "#3b1c10", // soft stripes
  y: "#f3a81f", // eyes: amber, light amber, dark amber, pupil, shine/white
  Y: "#ffd45a",
  v: "#c97a10",
  x: "#140a08",
  w: "#fff6dc",
  n: "#e0837e", // nose, nose rim, mouth inside, tongue, blush
  o: "#8c3b3d",
  q: "#5a1f26",
  r: "#d4636e",
  B: "#f2877f",
  P: "#431c7a", // balloon: dark to light, and its shine
  Q: "#6a31b2",
  R: "#8b50d4",
  S: "#a874ea",
  T: "#c9a2f7",
  W: "#f6eaff",
  m: "#d6c9e8", // balloon string
  M: "#8e80a8",
  z: "#0d0e12", // ground shadow
  D: "#b9a88f", // dust
  E: "#7d6c5a",
  j: "#7fd3ff", // sweat
  J: "#dff4ff",
  "1": "#c98f4e", // stool wood, light to dark
  "2": "#a06a33",
  "3": "#6c4222",
  l: "#ff8fc7", // hearts
  L: "#ffd0e8",
  u: "#ffd23a", // twinkles
  I: "#9fe8ff",
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
/** Light from the top left on a round surface (0 dark to 1 light). */
const roundL = (cx: number, cy: number, rx: number, ry: number, bias = 0) => (x: number, y: number) => 0.52 + bias - 0.45 * ((x - cx) / rx) - 0.55 * ((y - cy) / ry);
/** Orange fur by a light value: banded, never blended. */
const fur = (l: number) => (l < 0.24 ? "b" : l < 0.5 ? "c" : l < 0.8 ? "d" : "e");
const crm = (l: number) => (l < 0.34 ? "g" : l < 0.8 ? "h" : "i");
const bal = (l: number) => (l < 0.18 ? "P" : l < 0.38 ? "Q" : l < 0.64 ? "R" : l < 0.86 ? "S" : "T");

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
function fill(cv: Canvas, inside: (x: number, y: number) => boolean, key: (x: number, y: number) => string): void {
  for (let y = 0; y < cv.length; y++) for (let x = 0; x < cv[0]!.length; x++) if (inside(x, y)) cv[y]![x] = key(x, y);
}

// ---- Faces. A big round head: two big amber eyes with a white shine, blush, a little cream muzzle with a pink nose.

export type Mood = "calm" | "blink" | "happy" | "cheer" | "think" | "thinkBlink" | "smug" | "rattled" | "hurt" | "out" | "bold" | "gasp";
type Eye = "open" | "up" | "wide" | "half" | "arc" | "shut" | "pinch" | "x";
type Brow = "up" | "worried" | "bold" | "smug";
type Mouth = "smile" | "grin" | "flat" | "smirk" | "wavy" | "o" | "tongue" | "big";

/** The near eye (6 x 6, on our left) and the far one (5 x 5, by the bridge of its nose), by look. */
const NEAR_EYE: Record<Eye, readonly string[]> = {
  open: [".kkkk.", "kvywxk", "kyyxxk", "kyyxxk", "kYYYYk", ".kkkk."],
  up: [".kkkk.", "kyxwxk", "kyxxxk", "kyyyyk", "kYYYYk", ".kkkk."],
  wide: [".kkkk.", "kwwwwk", "kwxxwk", "kwxxwk", "kwwwwk", ".kkkk."],
  half: ["......", "kkkkkk", "kyxxyk", "kYYYYk", ".kkkk.", "......"],
  arc: ["......", "......", ".kkkk.", "k....k", "......", "......"],
  shut: ["......", "......", "......", "kkkkkk", "......", "......"],
  pinch: ["......", "kk....", ".kkk..", "...kkk", ".kkk..", "kk...."],
  x: ["......", "k...k.", ".k.k..", "..k...", ".k.k..", "k...k."],
};
const FAR_EYE: Record<Eye, readonly string[]> = {
  open: [".kkk.", "kywxk", "kyxxk", "kYYYk", ".kkk."],
  up: [".kkk.", "kxwxk", "kxxxk", "kYYYk", ".kkk."],
  wide: [".kkk.", "kwwwk", "kwxwk", "kwwwk", ".kkk."],
  half: [".....", "kkkkk", "kyxxk", ".kkk.", "....."],
  arc: [".....", ".....", ".kkk.", "k...k", "....."],
  shut: [".....", ".....", ".....", "kkkkk", "....."],
  pinch: [".....", "...kk", "..kk.", ".kk..", "..kk."],
  x: [".....", ".k.k.", "..k..", ".k.k.", "....."],
};
/** Brows: [near, far] pixel lists on the head grid. */
const BROWS: Record<Brow, readonly [readonly Pt[], readonly Pt[]]> = {
  up: [[[7, 8], [8, 7], [9, 7], [10, 8]], [[19, 7], [20, 6], [21, 6], [22, 7]]],
  worried: [[[6, 9], [7, 9], [8, 8], [9, 7], [10, 7]], [[18, 6], [19, 7], [20, 7], [21, 8], [22, 8]]],
  bold: [[[6, 7], [7, 8], [8, 8], [9, 9], [10, 9]], [[18, 9], [19, 8], [20, 8], [21, 7], [22, 7]]],
  smug: [[[6, 8], [7, 8], [8, 8], [9, 8]], [[18, 6], [19, 5], [20, 5], [21, 6]]],
};
const MOUTHS: Record<Mouth, readonly string[]> = {
  smile: [".k..k.", "..kk.."],
  grin: ["kkkkkk", "kqqqqk", ".krrk.", "..kk.."],
  big: ["kkkkkk", "kqqqqk", "kqrrqk", ".kkkk."],
  flat: [".kkkk."],
  smirk: [".....k", "kkkkk."],
  wavy: ["k.k.k.", ".k.k.k"],
  o: [".kk.", "kqqk", ".kk."],
  tongue: ["kkkkkk", "kqrrqk", "..krrk", "...kk."],
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
  gasp: { near: "wide", far: "wide", brow: "up", mouth: "big" },
};

const HW = 30;
const HH = 26;
/** Where the head grid sits at rest (its top-left), on the frame. */
const HX0 = 9;
const HY0 = 14;

function head(mood: Mood): Part {
  const cv = canvas(HW, HH);
  const skull = ell(15, 13, 12.6, 10.4);
  const snout = ell(22, 17.6, 6.9, 4.8);
  // The cheek ruff: soft tufts out behind the cheek (our left).
  const ruff = (x: number, y: number) => {
    const tufts: readonly (readonly [number, number, number, number])[] = [[3.8, 17.5, 2.6, 2.4]];
    return tufts.some(([cx, cy, rx, ry]) => ell(cx, cy, rx, ry)(x, y));
  };
  const inside = (x: number, y: number) => skull(x, y) || snout(x, y) || ruff(x, y);
  const light = roundL(14, 12, 14, 12, 0.18);
  fill(cv, inside, (x, y) => fur(light(x, y)));
  // Cream: the muzzle at the front, and the chin and the underside of the cheeks.
  const muzzle = ell(22.5, 18.4, 6.2, 4.3);
  const chin = ell(14, 23, 9.5, 4.6);
  fill(cv, (x, y) => inside(x, y) && (muzzle(x, y) || chin(x, y)), (x, y) => crm(light(x, y) + 0.3));
  // Soft stripes: three bars down the brow, a pair at the sides, and two across the near cheek.
  dots(cv, [[15, 4], [15, 5], [15, 6], [15, 7], [15, 8]], "s");
  dots(cv, [[10, 4], [11, 5], [11, 6], [12, 7]], "s");
  dots(cv, [[20, 4], [19, 5], [19, 6], [18, 7]], "s");
  dots(cv, [[5, 7], [5, 8], [6, 8]], "s");
  dots(cv, [[24, 6], [24, 7], [23, 7]], "s");
  dots(cv, [[3, 14], [4, 14], [5, 14], [3, 15], [4, 15]], "s");
  dots(cv, [[2, 18], [3, 18], [4, 18]], "s");
  // The nose and its rim.
  dots(cv, [[25, 14], [26, 14], [27, 14]], "o");
  dots(cv, [[26, 15]], "n");
  const face = FACES[mood];
  stamp(cv, NEAR_EYE[face.near], 6, 10);
  stamp(cv, FAR_EYE[face.far], 18, 10);
  if (face.blush) dots(cv, [[6, 17], [7, 17], [8, 17], [7, 18]], "B");
  if (face.brow) for (const side of BROWS[face.brow]) dots(cv, side, "s");
  const mouth = MOUTHS[face.mouth];
  const big = face.mouth === "grin" || face.mouth === "tongue" || face.mouth === "big";
  stamp(cv, mouth, big ? 22 : face.mouth === "o" ? 24 : 23, 17);
  return { grid: toGrid(cv) };
}
const MOODS: readonly Mood[] = ["calm", "blink", "happy", "cheer", "think", "thinkBlink", "smug", "rattled", "hurt", "out", "bold", "gasp"];
for (const m of MOODS) PARTS[`head:${m}`] = head(m);

// ---- Ears: round, orange, with a pink inside.

export type EarStyle = "mid" | "up" | "down" | "flat";
const EAR_SHAPE: Record<EarStyle, { rx: number; ry: number; dy: number; dx: number }> = {
  mid: { rx: 5.2, ry: 4.9, dy: 0, dx: 0 },
  up: { rx: 4.6, ry: 5.7, dy: -1, dx: 0 },
  down: { rx: 5.6, ry: 4, dy: 2, dx: 1 },
  flat: { rx: 5.8, ry: 3.2, dy: 3, dx: 2 },
};
/** An ear drawn round (6, 6) on a small canvas; the layer is put so that point is the ear's middle. */
function earPart(far: boolean, style: EarStyle): Painted & { name: string } {
  return painted(`ear:${far ? "f" : "n"}:${style}`, () => {
    const cv = canvas(14, 14);
    const sh = EAR_SHAPE[style];
    const rx = sh.rx - (far ? 0.5 : 0);
    const e = ell(7, 7, rx, sh.ry);
    const L = roundL(7, 7, rx, sh.ry, far ? -0.12 : 0.05);
    fill(cv, e, (x, y) => fur(L(x, y)));
    const inner = ell(7 + (far ? -0.4 : 0.5), 7.8, rx * 0.52, sh.ry * 0.58);
    fill(cv, inner, (x, y) => (y < 7.2 && x < 7 ? "h" : "B"));
    return crop(cv);
  });
}

PARTS["shadow"] = (() => {
  const cv = canvas(40, 3);
  ellipse(cv, 20, 1.5, 20, 1.5, "z");
  return { grid: toGrid(cv), outline: false };
})();

PARTS["stool"] = {
  grid: [
    "11111111111111111111111111",
    "22222222222222222222222222",
    "33333333333333333333333333",
    "..23..................23..",
    "..23..................23..",
    "..23333333333333333333323.",
    "..23..................23..",
  ],
};

// ---- Limbs: a round stroke through points, three bands of light, soft stripes; an end blob (a paw or a foot) in cream.

function pathNear(p: Pt, pts: readonly Pt[]): { d: number; nx: number; ny: number; s: number; total: number } {
  let best = { d: Infinity, nx: 0, ny: 0, s: 0 };
  let acc = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const vx = b[0] - a[0];
    const vy = b[1] - a[1];
    const len = Math.hypot(vx, vy) || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (len * len)));
    const nx = p[0] - (a[0] + t * vx);
    const ny = p[1] - (a[1] + t * vy);
    const d = Math.hypot(nx, ny);
    if (d < best.d) best = { d, nx, ny, s: acc + t * len };
    acc += len;
  }
  return { ...best, total: acc };
}

interface LimbOpts {
  r: number;
  far?: boolean;
  /** Stripes across the limb, at these distances along it. */
  bands?: readonly number[];
  /** The last pixels along it are dark (a tail's tip). */
  tip?: number;
  /** An end blob [cx, cy, rx, ry]: a paw or a foot. */
  blob?: readonly [number, number, number, number];
  toes?: "paw" | "foot";
  /** Nothing of the stroke (the blob aside) below this row: a leg's round end stops at its ankle. */
  maxY?: number;
}
function limb(pts: readonly Pt[], o: LimbOpts): Painted {
  const cv = canvas(W, H);
  const total = pathNear([0, 0], pts).total;
  const blob = o.blob ? ell(...o.blob) : null;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (blob && blob(x, y)) {
        const [bx, by, rx, ry] = o.blob!;
        cv[y]![x] = crm(0.64 - 0.4 * ((x - bx) / rx) - 0.5 * ((y - by) / ry) - (o.far ? 0.3 : 0));
        continue;
      }
      if (o.maxY !== undefined && y > o.maxY) continue;
      const n = pathNear([x, y], pts);
      if (n.d > o.r) continue;
      let k: string;
      if (o.tip && n.s > total - o.tip) k = "s";
      else if (o.bands?.some((b) => Math.abs(n.s - b) < 0.7)) k = "s";
      else k = fur(0.55 - (0.45 * n.nx) / o.r - (0.55 * n.ny) / o.r - (o.far ? 0.22 : 0));
      cv[y]![x] = k;
    }
  if (o.blob && o.toes === "paw") {
    const cx = Math.round(o.blob[0]);
    const cy = Math.round(o.blob[1]);
    dots(cv, [[cx - 1, cy + 1], [cx - 1, cy + 2], [cx + 1, cy + 1], [cx + 1, cy + 2]], "g");
  }
  if (o.blob && o.toes === "foot") {
    const cx = Math.round(o.blob[0]);
    const cy = Math.round(o.blob[1]);
    dots(cv, [[cx + 2, cy], [cx + 2, cy + 1], [cx + 4, cy + 1]], "g");
  }
  return crop(cv);
}

// ---- The body: a round egg, orange with a few soft stripes down its back, a cream tummy.

const BODY = { cx: 22, cy: 46.5, rx: 9.5, ry: 9.7 };
function bodyPart(): Painted {
  const cv = canvas(W, H);
  const body = ell(BODY.cx, BODY.cy, BODY.rx, BODY.ry);
  const L = roundL(BODY.cx, BODY.cy, BODY.rx, BODY.ry, 0.1);
  fill(cv, body, (x, y) => fur(L(x, y)));
  const belly = ell(28, 50.5, 7, 7.2);
  fill(cv, (x, y) => body(x, y) && belly(x, y), (x, y) => crm(L(x, y) + 0.32));
  for (const y of [41, 45, 49, 53]) {
    let x0 = 0;
    while (x0 < W && cv[y]![x0] === ".") x0++;
    dots(cv, [[x0, y], [x0 + 1, y], [x0 + 2, y], [x0 + 3, y], [x0, y + 1], [x0 + 1, y + 1]], "s");
  }
  return crop(cv);
}
const BODY_PART = painted("body", bodyPart);

// ---- The balloon: a plain round purple party balloon, shiny, with one soft highlight; a shape per squeeze level.

const BALLOON = { cx: 40, cy: 39, rx: 13.5, ry: 14 };
/** Where the near arm crosses the balloon and where the far paw grips it (rows), for the dents. */
const NEAR_ROW = 46;
const FAR_ROW = 40;
function balloonPart(s: number): Painted & { name: string; cx: number } {
  const { cx, cy, rx, ry } = BALLOON;
  const cx2 = cx + 0.3 * s;
  const cy2 = cy - 0.35 * s;
  const ry2 = ry + 0.35 * s;
  const rx2 = rx + 0.55 * s;
  const p = painted(`balloon:${s}`, () => {
    const cv = canvas(W, H);
    const L = roundL(cx2, cy2, rx2, ry2, 0.06);
    for (let y = 0; y < H; y++) {
      const ty = (y - cy2) / ry2;
      if (Math.abs(ty) > 1) continue;
      const taper = ty > 0 ? 1 - 0.14 * ty * ty : 1;
      const hw = rx2 * Math.sqrt(1 - ty * ty) * taper;
      const dl = 1.7 * s * Math.exp(-(((y - NEAR_ROW) / 4.5) ** 2));
      const dr = 1.3 * s * Math.exp(-(((y - FAR_ROW) / 4) ** 2));
      for (let x = Math.ceil(cx2 - hw + dl); x <= Math.floor(cx2 + hw - dr); x++) cv[y]![x] = bal(L(x, y));
    }
    // One soft highlight near the top: a short curved dash with a lighter edge.
    const hx = Math.round(cx2);
    const hy = Math.round(cy2);
    dots(cv, [[hx - 2, hy - 8], [hx - 1, hy - 9], [hx, hy - 10], [hx + 1, hy - 10], [hx + 2, hy - 10]], "W");
    dots(cv, [[hx - 3, hy - 8], [hx - 2, hy - 9], [hx - 1, hy - 10], [hx + 3, hy - 10], [hx + 4, hy - 9]], "T");
    return crop(cv);
  });
  return { ...p, cx: cx2 };
}
const BALLOON_BOTTOM = BALLOON.cy + BALLOON.ry; // the last row of a resting balloon

/** The knot, hanging from the balloon's bottom, and the short string under it (swaying). */
function knotLayers(kx: number, ky: number, sway: number): Layer[] {
  PARTS["knot"] ??= { grid: [".Q.", "QRQ"] };
  // The string is cut short by the ground (the frame's last row but one).
  const rows = Math.min(4, 60 - ky);
  const stringName = `string:${sway % 3}:${rows}`;
  if (rows > 0)
    PARTS[stringName] ??= {
      grid: [
        [".m..", ".m..", "..M.", "..M."],
        ["m...", "m...", ".m..", ".M.."],
        ["..m.", "..m.", ".M..", ".M.."],
      ][sway % 3]!.slice(0, rows),
      outline: false,
    };
  return [{ part: "knot", x: kx - 1, y: ky }, ...(rows > 0 ? [{ part: stringName, x: kx - 1, y: ky + 3 }] : [])];
}

// ---- Poses.

export interface Pose {
  mood?: Mood;
  /** The whole upper body (body, head, arms, balloon) down this many pixels (a breath, a crouch). */
  bob?: number;
  /** The head on the body. */
  hx?: number;
  hy?: number;
  dx?: number;
  /** Off the ground. */
  air?: number;
  /** Feet: sideways shift and lift off the ground (near, far). */
  feet?: { n?: { x?: number; lift?: number }; f?: { x?: number; lift?: number } };
  /** The balloon's squeeze: -1 springing out, 0 resting, up to 4 squashed hard. */
  sq?: number;
  /** The balloon moved from where it rests. */
  bx?: number;
  by?: number;
  /** The near arm: across the balloon, or a paw up at its chin. */
  near?: "hug" | "chin";
  /** The far arm: gripping the balloon's side, or up behind it with the paw at this point. */
  far?: "hug" | Pt;
  tail?: number;
  ear?: EarStyle;
  /** On the stool at the chess table; or slumped on the ground. */
  sit?: boolean;
  floor?: boolean;
  /** The head tucked behind the balloon (peeking round it). */
  peek?: boolean;
  sway?: number;
  noShadow?: boolean;
}

function build(p: Pose): Layer[] {
  const dx = p.dx ?? 0;
  const air = p.air ?? 0;
  const bob = p.bob ?? 0;
  const sit = p.sit ?? false;
  const floor = p.floor ?? false;
  const sq = p.sq ?? 0;
  const dy = sit ? -3 : floor ? 3 : 0;
  const by = bob - air + dy;
  const layers: Layer[] = [];
  const add = (l: { name: string; at: Pt }, ox = 0, oy = 0) => layers.push({ part: l.name, x: l.at[0] + ox, y: l.at[1] + oy });
  const put = (part: string, x: number, y: number) => layers.push({ part, x, y });
  if (!p.noShadow) put("shadow", 10 + dx, GROUND - 2);
  if (sit) put("stool", 10 + dx, 54);

  // The tail: a striped curl out behind, ending in a dark tip (hanging down when it sits).
  const tl = p.tail ?? 0;
  const down = sit || floor;
  const tailPts: Pt[] = floor
    ? [[15, 53 + by - 3], [11, 57], [8, 57], [6 + tl, 54]]
    : down
    ? [[15, 51 + by], [11, 52 + by], [9, 55 + by], [8 + tl, 58]]
    : [[16, 52 + by], [11, 53 + by], [8, 50 + by], [7 + Math.round(tl / 2), 47 + by], [6 + tl, 45 + by + (tl > 1 ? 1 : 0)]];
  add(painted(`tail:${tailPts.map((q) => q.join(",")).join(";")}`, () => limb(tailPts, { r: 1.7, bands: down ? [7, 11] : [7, 12], tip: 3 })), dx);

  // Legs.
  const nf = p.feet?.n ?? {};
  const ff = p.feet?.f ?? {};
  const leg = (pts: readonly Pt[], far: boolean) => {
    const end = pts[pts.length - 1]!;
    add(painted(`leg:${far ? 1 : 0}:${pts.map((q) => q.join(",")).join(";")}`, () => limb(pts, { r: 3.3, far, bands: [3], blob: [end[0] + 1.5, end[1] + 0.5, 4.8, 2.4], toes: "foot", maxY: end[1] + 1 })));
  };
  if (sit) {
    leg([[22 + dx, 50 + by], [32 + dx, 51 + by], [34 + dx + (ff.x ?? 0), 57 - (ff.lift ?? 0)]], true);
  } else if (floor) {
    leg([[22 + dx, 56 + by - 3], [31 + dx, 57], [38 + dx, 58]], true);
  } else {
    leg([[26 + dx, 52 + by], [27 + dx + (ff.x ?? 0), 58 - air - (ff.lift ?? 0)]], true);
  }
  add(BODY_PART, dx, by);
  if (sit) {
    leg([[20 + dx, 50 + by], [30 + dx, 51 + by], [31 + dx + (nf.x ?? 0), 57 - (nf.lift ?? 0)]], false);
  } else if (floor) {
    leg([[20 + dx, 55 + by - 3], [27 + dx, 57], [31 + dx, 58]], false);
  } else {
    leg([[18 + dx, 52 + by], [19 + dx + (nf.x ?? 0), 58 - air - (nf.lift ?? 0)]], false);
  }

  // The head's place, and the ears behind it.
  const hx = HX0 + (p.hx ?? 0) + dx;
  const hy = HY0 + (p.hy ?? 0) + by;
  const ears = () => {
    const sh = EAR_SHAPE[p.ear ?? "mid"];
    const n = earPart(false, p.ear ?? "mid");
    const f = earPart(true, p.ear ?? "mid");
    add(n, hx + 7 - sh.dx - 7, hy + 5 + sh.dy - 7);
    add(f, hx + 23 + sh.dx - 7, hy + 4 + sh.dy - 7);
  };
  const headLayers = () => {
    ears();
    put(`head:${p.mood ?? "calm"}`, hx, hy);
  };

  // The balloon, bobbing with the body.
  const bx = p.bx ?? 0;
  const bby = (p.by ?? 0) + by;
  const balloon = balloonPart(sq);
  const sq0 = sq;
  const far = p.far ?? "hug";
  const farUp = far !== "hug";
  const shoulder: Pt = [21 + dx, 40 + by];

  // A raised far arm is behind the balloon.
  if (farUp) {
    const target = far as Pt;
    const from: Pt = [44 + dx + bx, 34 + bby];
    const to: Pt = [target[0] + dx, target[1] + by];
    const elbow: Pt = [Math.round((from[0] + to[0]) / 2) + 3, Math.round((from[1] + to[1]) / 2)];
    add(painted(`farup:${from};${elbow};${to}`, () => limb([from, elbow, to], { r: 2.6, bands: [9], blob: [to[0], to[1], 3.8, 3.5], toes: "paw" })));
  } else {
    // Hugging: the arm goes round behind the balloon and only its wrist shows at the edge.
    const from: Pt = [45 + dx + bx, 33 + bby];
    const wrist: Pt = [Math.round(54 - 0.6 * sq) + dx + bx, 39 + bby];
    add(painted(`farback:${from};${wrist}`, () => limb([from, wrist], { r: 2.6, far: true, bands: [6] })));
  }
  if (p.peek) headLayers();
  add(balloon, bx, bby);
  const kx = Math.round(balloon.cx) + bx;
  layers.push(...knotLayers(kx, BALLOON_BOTTOM + 2 + bby, p.sway ?? 0));
  void sq0;

  // The near arm: shoulder, elbow, paw.
  const chin = p.near === "chin";
  const nearPts: Pt[] = chin
    ? [shoulder, [26 + dx, 46 + by], [30 + dx, 38 + by]]
    : [shoulder, [25 + dx, 49 + by], [Math.round(38 - 0.6 * sq) + dx + bx, Math.round(47 - 0.3 * sq) + bby]];
  const nearEnd = nearPts[2]!;
  const nearArm = painted(`near:${nearPts.map((q) => q.join(",")).join(";")}`, () => limb(nearPts, { r: 2.7, bands: [7], blob: [nearEnd[0], nearEnd[1], 3.6, 3.3], toes: "paw" }));
  if (!chin) add(nearArm);
  if (!farUp) {
    const to: Pt = [Math.round(51 - 0.8 * sq) + dx + bx, 41 + bby];
    add(painted(`farhug:${to}`, () => limb([to, to], { r: 2.6, blob: [to[0], to[1], 3.6, 3.3], toes: "paw" })));
  }
  if (!p.peek) headLayers();
  if (chin) add(nearArm);
  return layers;
}

// ---- Sparks and little effects.

function seeded(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => ((s = (s * 1103515245 + 12345) >>> 0) >>> 8) / 16777216;
}
/** A twinkle: a little plus. */
const star = (x: number, y: number, k = "u"): Speck[] => [[x, y, "w"], [x - 1, y, k], [x + 1, y, k], [x, y - 1, k], [x, y + 1, k]];
function twinkles(t: number, n = 4, box: readonly [number, number, number, number] = [4, 4, 60, 40]): Speck[] {
  const rnd = seeded(t * 31 + 5);
  return Array.from({ length: n }, (_, i) => star(Math.round(box[0] + rnd() * (box[2] - box[0])), Math.round(box[1] + rnd() * (box[3] - box[1])), (i + t) % 2 ? "u" : "I")).flat();
}
/** A small heart. */
const heart = (x: number, y: number): Speck[] => [[x + 1, y, "l"], [x + 3, y, "l"], [x, y + 1, "l"], [x + 1, y + 1, "L"], [x + 2, y + 1, "l"], [x + 3, y + 1, "l"], [x + 4, y + 1, "l"], [x + 1, y + 2, "l"], [x + 2, y + 2, "l"], [x + 3, y + 2, "l"], [x + 2, y + 3, "l"]];
/** Dust puffing out along the ground at the feet. */
const dust = (t: number): Speck[] =>
  [-1, 1].flatMap((side) =>
    [0, 1, 2].map((i): Speck => [Math.round(26 + side * (9 + i * 3 + t * 2)), GROUND - 1 - (i % 2) - (t > 0 ? 1 : 0), t > 1 ? "E" : "D"]),
  );
/** The shadow on the ground, growing as it drops in. */
const dropShadow = (r: number): Speck[] => Array.from({ length: r * 2 + 1 }, (_, i): Speck => [30 - r + i, GROUND - 1, "z"]);
/** Thought dots beside the head. */
const thoughts = (n: number): Speck[] =>
  ([[47, 17], [52, 13], [57, 8]] as const).slice(0, n).flatMap(([x, y], k): Speck[] => {
    const big = k === 2;
    return [[x, y, "w"], [x + 1, y, "w"], [x, y + 1, "w"], [x + 1, y + 1, "D"], ...(big ? ([[x - 1, y, "w"], [x + 2, y, "w"], [x, y - 1, "w"], [x + 1, y - 1, "w"], [x - 1, y + 1, "D"], [x + 2, y + 1, "E"], [x, y + 2, "D"], [x + 1, y + 2, "E"]] as Speck[]) : [])];
  });
/** Sweat flying off the head. */
const sweat = (i: number): Speck[] => {
  const t = i % 4;
  return [[10 - t, 18 + t, "j"], [10 - t, 19 + t, "J"], [40 + t, 15 + t, "j"], [40 + t, 16 + t, "J"]];
};
/** Dizzy stars circling over the head. */
const dizzy = (t: number, cx = 25, cy = 12): Speck[] =>
  [0, 1, 2].flatMap((k) => {
    const a = t * 0.9 + (k * Math.PI * 2) / 3;
    return star(Math.round(cx + Math.cos(a) * 11), Math.round(cy + Math.sin(a) * 3), k % 2 ? "u" : "I");
  });

const FLASH: Record<string, string> = { b: "#f0a066", c: "#f6bb88", d: "#fad0a4", e: "#ffe8cc", g: "#f6ecd8", h: "#ffffff", i: "#ffffff", Q: "#a07ae0", R: "#bd99ec", S: "#d3b9f4", T: "#e8dafa", P: "#7c52c4", s: "#6a4a3c" };

/** One frame: the pose and anything extra. */
function f(ms: number, p: Pose, extra: Partial<Frame> = {}): Frame {
  const specks = (extra.specks ?? []).filter(([x, y]) => x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2);
  return { ms, layers: build(p), ...extra, specks };
}

// ---- Animations.

/** Idle (3 s): breathes, blinks, flicks an ear and its tail, glances; once a loop it gives the balloon a big happy squeeze. */
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 30 }, (_, i) => {
    const bob = i >= 8 && i <= 14 ? 1 : 0;
    const blink = i === 11 || i === 12 || i === 27;
    const SQ: Record<number, number> = { 19: 1, 20: 2, 21: 4, 22: 4, 23: -1, 24: 1 };
    const sq = SQ[i] ?? 0;
    const mood: Mood = blink ? "blink" : i >= 19 && i <= 22 ? "happy" : i === 23 ? "cheer" : i === 24 ? "happy" : "calm";
    const squeezing = sq >= 2;
    const tail = i >= 4 && i <= 8 ? [1, 2, 3, 2, 1][i - 4]! : i >= 25 && i <= 27 ? -1 : 0;
    const ear: EarStyle = i === 14 ? "down" : i === 15 ? "up" : "mid";
    const hx = squeezing ? 1 : i >= 28 ? 1 : 0;
    const hy = squeezing ? 1 : i === 18 ? 1 : 0;
    return f(100, { bob, mood, sq, hx, hy, tail, ear, by: sq === -1 ? -1 : 0, sway: i % 12 < 6 ? 0 : 1 }, { cue: i === 21 ? "squeak" : undefined, specks: i >= 21 && i <= 24 ? heart(30 + (i - 21), 9 - (i - 21) * 2) : [] });
  }),
};

/** Walk (0.6 s): a waddling trot on its back legs, the balloon hugged to its chest, the head bobbing. */
const walk: Anim = {
  loop: true,
  frames: Array.from({ length: 6 }, (_, i) => {
    const th = (i / 6) * Math.PI * 2;
    const leg = (off: number) => ({ x: Math.round(2 * Math.sin(th + off)), lift: Math.max(0, Math.round(2.5 * Math.cos(th + off))) });
    const bob = i % 3 === 0 ? 0 : 1;
    return f(100, { bob, hy: i % 3 === 0 ? -1 : 0, hx: i % 3 === 0 ? 1 : 0, mood: "calm", feet: { n: leg(0), f: leg(Math.PI) }, tail: i < 3 ? 1 : -1, ear: bob ? "down" : "mid", sway: i % 3, by: bob ? -1 : 0 }, i % 3 === 0 ? { cue: "step" } : {});
  }),
};

/** Sit (loops): on a stool at the chess table facing the board, legs dangling, the balloon in its lap; thinks about a move. */
const sit: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) => {
    const lean = i >= 6 && i <= 11;
    const blink = i === 3 || i === 4 || i === 13;
    const swing = i % 8 < 4 ? 0 : 1;
    const sq = i === 9 || i === 10 ? 1 : 0;
    return f(200, { sit: true, mood: blink ? (lean ? "thinkBlink" : "blink") : lean ? "think" : "calm", bob: i % 8 >= 4 ? 1 : 0, hx: lean ? 2 : 0, hy: lean ? 1 : 0, ear: i === 9 ? "down" : "mid", tail: swing, sq, sway: swing, feet: { n: { x: swing }, f: { x: -swing, lift: swing } } });
  }),
};

/** Wave (once, 1.2 s): ducks behind the balloon, pops out and waves one paw over it while the other arm keeps hugging, then settles. */
const WAVE_PAW: readonly Pt[] = [[53, 20], [49, 13], [55, 13], [49, 13], [55, 13], [51, 15]];
const wave: Anim = {
  loop: false,
  frames: [
    f(90, { mood: "calm", hx: 1 }),
    f(110, { peek: true, hx: 4, hy: 2, mood: "calm", ear: "mid" }),
    f(130, { peek: true, hx: 4, hy: 1, mood: "thinkBlink", ear: "up" }),
    f(90, { hx: 0, hy: -1, mood: "cheer", ear: "up", far: [54, 26], sq: 0 }, { cue: "squeak" }),
    ...WAVE_PAW.map((paw, i) => f(100, { mood: i % 2 ? "cheer" : "happy", far: paw, hy: i % 2 ? 0 : -1, bob: i % 2 ? 1 : 0, tail: i % 2 ? 2 : -1, ear: i % 3 === 1 ? "up" : "mid", sway: i % 3 }, { specks: i === 1 || i === 4 ? star(44 + i * 2, 6 + (i % 2) * 2) : [] })),
    f(100, { mood: "happy", sq: 1, hx: 1, hy: 1 }),
    f(120, { mood: "calm" }),
  ],
};

/** Entrance: the balloon floats it gently down from above, feet dangling; it lands with a squash and a puff of dust, then a happy squeeze. */
const entrance: Anim = {
  loop: false,
  frames: [
    { ms: 90, layers: [], specks: dropShadow(4) },
    { ms: 80, layers: [], specks: dropShadow(8) },
    f(90, { air: 9, mood: "cheer", ear: "up", noShadow: true, feet: { n: { lift: 1, x: -1 }, f: { lift: 2, x: 1 } }, sq: 1, sway: 1, tail: 2 }, { specks: dropShadow(10) }),
    f(90, { air: 8, mood: "cheer", ear: "up", noShadow: true, feet: { n: { lift: 1 }, f: { lift: 2 } }, sway: 2, tail: 1 }, { specks: dropShadow(12) }),
    f(90, { air: 5, mood: "happy", ear: "up", noShadow: true, feet: { n: { lift: 1 }, f: { lift: 1 } }, sway: 1 }, { specks: dropShadow(14) }),
    f(80, { air: 2, mood: "happy", ear: "up", noShadow: true, sway: 0 }, { specks: dropShadow(16) }),
    f(110, { bob: 3, mood: "blink", ear: "down", sq: 2, sway: 2 }, { cue: "thump", specks: dust(0) }),
    f(90, { bob: 1, mood: "happy", sq: 0, by: -1, sway: 1 }, { specks: dust(1) }),
    f(100, { mood: "happy", sq: 2, hx: 1, hy: 1, ear: "mid" }, { cue: "squeak", specks: [...dust(2), ...heart(31, 9)] }),
    f(110, { mood: "cheer", sq: -1, by: -1, ear: "up", tail: 2 }, { specks: twinkles(1, 3, [6, 6, 58, 30]) }),
    f(120, { mood: "happy", sq: 1, hx: 0 }, { specks: twinkles(2, 2, [6, 6, 58, 30]) }),
    f(300, { mood: "calm" }),
  ],
};

/** Thinking (loops): a paw up at its chin, eyes rolled up, a foot tapping, thought dots popping up. */
const thinking: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) =>
    f(150, { mood: i === 8 ? "thinkBlink" : "think", near: "chin", hx: 2, hy: -1, bob: i % 6 >= 3 ? 1 : 0, feet: { f: i % 4 === 1 ? { lift: 2 } : {} }, tail: i % 6 < 3 ? 1 : 0, ear: i === 5 ? "down" : "mid", sway: i % 6 < 3 ? 0 : 1 }, { specks: thoughts(i % 6 < 1 ? 0 : i % 6 < 3 ? 1 : i % 6 < 5 ? 2 : 3) }),
  ),
};

/** Its move: a squeeze, a happy hop toward the board with a paw pointing at it, then back to hugging. */
const move: Anim = {
  loop: false,
  frames: [
    f(90, { bob: 2, mood: "bold", sq: 2, hx: 1, hy: 1 }, { cue: "squeak" }),
    f(80, { air: 5, dx: 1, mood: "bold", far: [54, 31], feet: { n: { lift: 2 }, f: { lift: 3 } }, ear: "up", sq: 0, by: -1 }),
    f(80, { air: 6, dx: 1, mood: "bold", far: [55, 29], feet: { n: { lift: 2 }, f: { lift: 2 } }, by: -1 }),
    f(100, { bob: 2, dx: 1, mood: "happy", far: [54, 31], sq: 1 }, { specks: dust(0) }),
    f(100, { bob: 1, dx: 1, mood: "happy", sq: 1 }),
    f(110, { dx: 1, mood: "happy" }),
    f(150, { mood: "calm" }),
  ],
};

/** A capture: two excited hops with the paw waving high, a big squeeze on each landing, twinkles everywhere. */
const capture: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 2, mood: "bold", sq: 2 }),
    f(80, { air: 5, mood: "cheer", far: [53, 18], feet: { n: { lift: 2 }, f: { lift: 3 } }, ear: "up", sq: -1, by: -1 }, { cue: "squeak", specks: twinkles(1) }),
    f(80, { air: 7, mood: "happy", far: [49, 13], feet: { n: { lift: 3 }, f: { lift: 3 } }, hy: -1, by: -1 }, { specks: twinkles(2) }),
    f(80, { air: 4, mood: "happy", far: [55, 13], by: -1 }, { specks: twinkles(3) }),
    f(90, { bob: 3, mood: "happy", sq: 3, hx: 1, hy: 1, ear: "down" }, { cue: "squeak", specks: dust(0) }),
    f(80, { air: 6, mood: "cheer", far: [51, 14], feet: { n: { lift: 2 }, f: { lift: 3 } }, ear: "up", sq: -1, by: -1 }, { specks: twinkles(4) }),
    f(80, { air: 7, mood: "happy", far: [55, 13], feet: { n: { lift: 3 }, f: { lift: 3 } }, hy: -1, by: -1 }, { specks: twinkles(5) }),
    f(80, { air: 4, mood: "happy", far: [49, 14], by: -1 }, { specks: twinkles(6) }),
    f(90, { bob: 3, mood: "happy", sq: 3, hx: 1, hy: 1, ear: "down" }, { cue: "squeak", specks: dust(1) }),
    f(120, { bob: 1, mood: "happy", sq: 1 }, { specks: heart(31, 9) }),
    f(160, { mood: "smug", hy: -1 }),
  ],
};

/** Hurt: a flash and a jolt, it clutches the balloon tight with its eyes screwed shut; then a brave little grin. */
const hurt: Anim = {
  loop: false,
  frames: [
    f(70, { bob: 2, mood: "hurt", sq: 3, ear: "flat", hx: 1, hy: 1 }, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    f(80, { bob: 3, mood: "hurt", sq: 4, ear: "flat", hx: 1, hy: 1 }, { shake: [-1, 0], specks: sweat(0) }),
    f(90, { bob: 2, dx: -1, mood: "hurt", sq: 3, ear: "down", hx: 1, hy: 1 }, { specks: sweat(1) }),
    f(100, { bob: 1, dx: -1, mood: "rattled", sq: 2, ear: "down" }),
    f(110, { mood: "blink", sq: 1 }),
    f(120, { mood: "bold", sq: 0 }),
    f(160, { mood: "calm" }),
  ],
};

/** Check: it gasps, throws up one paw at the board twice with a squeak of the balloon, eyes wide. */
const check: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 1, mood: "gasp", ear: "up", sq: 1 }),
    f(110, { mood: "gasp", far: [54, 29], ear: "up", sq: 2, hx: 1 }, { cue: "squeak" }),
    f(90, { bob: 1, mood: "bold", far: [53, 31], sq: 1 }),
    f(110, { mood: "gasp", far: [55, 27], ear: "up", sq: 2, hx: 1 }, { cue: "squeak" }),
    f(90, { bob: 1, mood: "bold", far: [53, 30], sq: 1 }),
    f(150, { mood: "bold", sq: 1 }),
    f(160, { mood: "smug" }),
  ],
};

/** Smug: chin up, eyes half shut, a little smirk, a slow nod, a contented squeeze of the balloon. */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(150, { mood: "smug", hy: i < 3 || i > 5 ? -1 : 0, hx: i < 4 ? 0 : 1, bob: i % 4 === 2 ? 1 : 0, sq: i === 4 || i === 5 ? 1 : 0, ear: i === 5 ? "up" : "mid", tail: [0, 1, 2, 1, 0, -1, -1, 0][i], sway: i % 3 })),
};

/** Rattled: wide eyes, worried brows, sweat flying, trembling, clutching the balloon tight. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(80, { mood: "rattled", sq: 3, dx: i % 2 ? 1 : -1, bob: i % 4 === 2 ? 1 : 0, ear: "flat", tail: i % 2 ? 1 : -1, hx: 1, hy: 1, sway: i % 3 }, { specks: sweat(i) })),
};

/** Defeat: a flash and a reel, then it plops down on the ground, dizzy, still hugging the balloon (the last frame holds). */
const defeat: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 2, mood: "hurt", sq: 3, ear: "flat", hx: 1, hy: 1 }, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    f(90, { bob: 3, dx: -1, mood: "out", sq: 4, ear: "flat", hx: 1, hy: 1 }, { specks: dizzy(0) }),
    f(110, { floor: true, bob: -1, mood: "out", sq: 2, ear: "down", hx: 1, hy: 1 }, { cue: "thump", specks: [...dust(0), ...dizzy(1)] }),
    f(110, { floor: true, mood: "out", sq: 1, ear: "down", hx: 0, hy: 2 }, { specks: [...dust(1), ...dizzy(2)] }),
    f(130, { floor: true, mood: "out", sq: 1, ear: "down", hx: 0, hy: 2, tail: -1 }, { specks: dizzy(3) }),
    f(160, { floor: true, mood: "out", sq: 0, ear: "flat", hx: 0, hy: 3, tail: -1 }, { specks: dizzy(4) }),
    f(1000, { floor: true, mood: "out", sq: 0, ear: "flat", hx: 0, hy: 3, tail: -1 }, { specks: dizzy(5) }),
  ],
};

/** Victory: jumping for joy with the paw waving high, a squeeze on every landing, confetti and hearts. Then again. */
const confetti = (t: number): Speck[] => {
  const rnd = seeded(t * 13 + 7);
  const keys = ["l", "I", "u", "L"];
  return Array.from({ length: 9 }, (_, i): Speck[] => {
    // Only where nothing of the cub is: above its head, out to the right, and at the far left.
    let x = 2;
    let y = 2;
    for (let tries = 0; tries < 40; tries++) {
      x = Math.round(2 + rnd() * 58);
      y = Math.round(2 + rnd() * 34);
      if (y < 10 || (x > 43 && y < 22) || (x < 8 && y < 38)) break;
    }
    const k = keys[(i + t) % 4]!;
    return i % 2 ? [[x, y, k], [x + 1, y, k]] : [[x, y, k], [x, y + 1, k]];
  }).flat();
};
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const air = [0, 3, 5, 6, 5, 3, 0, 0, 3, 5, 3, 0][i]!;
    const paws: Pt[] = [[53, 18], [49, 13], [55, 13], [50, 13], [54, 14], [50, 15]];
    const land = i === 0 || i === 6 || i === 7;
    return f(110, { bob: land ? 2 : 0, air, sq: land ? 3 : air > 3 ? -1 : 0, mood: air > 2 ? "happy" : "cheer", far: paws[i % 6], feet: air > 2 ? { n: { lift: 3 }, f: { lift: 3 } } : {}, hy: i % 2 ? -1 : 0, ear: air > 3 ? "up" : "mid", tail: i % 2 ? 2 : -1, by: air > 3 ? -1 : 0, sway: i % 3 }, { cue: land && i !== 7 ? "squeak" : undefined, specks: [...confetti(i), ...(i % 4 === 1 ? heart(40, 3) : [])] });
  }),
};

export const sidekickBabur2: Character = {
  id: "sidekick-babur-2",
  name: "Babur's sidekick",
  w: W,
  h: H,
  foot: [24, GROUND],
  palette: SIDEKICK_PALETTE,
  halo: "#2e2218",
  parts: PARTS,
  anims: { idle, walk, sit, wave, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory },
};
