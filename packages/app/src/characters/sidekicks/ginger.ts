/**
 * Ginger's sidekick (id "sidekick-ginger"): a little gingerbread kid in a candy-cane-striped scarf, a town bot that
 * wanders the square and plays chess at the park's tables. No powers, never fights: a friendly, curious kid who copies
 * the big one. It carries no cane: its one prop is the red-and-white scarf, whose ends flutter and flick.
 *
 * Softer and rounder than Ginger: a big round head with big friendly icing eyes, rosy cheeks, a small icing smile and a
 * dollop of icing on top; a round little body with one gumdrop button, stubby arms and legs with icing cuffs.
 * Three-quarters, facing our right, light from the top left.
 *
 * Rigging: the head (one per face), the body, the scarf band, its hanging end and the dollop are painted once; the
 * arms, the legs and the scarf's two flying tails are painted from points per pose, so a new pose is a handful of
 * numbers. The tails ripple (a cols wave pinned at the knot).
 */
import { canvas, ellipse, toGrid, type Canvas } from "../paint.ts";
import { lieDown, partSize, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "../sprite.ts";

export const SIDEKICK_GINGER_PALETTE = {
  k: "#1c0d07", // outline
  d: "#6e3414", // gingerbread, dark to light (Ginger's browns)
  c: "#9a4f1d",
  C: "#bf6c2c",
  h: "#d98b45",
  w: "#fbfdff", // icing
  W: "#bfe3f5",
  m: "#3a1208", // pupils, inside the mouth
  q: "#ff8f9c", // rosy cheeks
  Q: "#ffc0c4",
  r: "#e8303a", // gumdrop
  R: "#9e1d2a",
  E: "#ffd2c4",
  s: "#e2343b", // scarf: red and cream stripes, lit and in shade
  S: "#a3202b",
  v: "#f6f1ea",
  V: "#cfc6c2",
  o: "#c98f4e", // stool wood, light to dark
  p: "#a06a33",
  P: "#6c4222",
  x: "#ffffff", // sparkle white
  y: "#ffe27a", // sparkle yellow
  Y: "#ffc233",
  l: "#ff9bd6", // sprinkles
  n: "#7fe08a",
  i: "#9fe8ff",
  j: "#7fd3ff", // sweat
  t: "#fff8e6", // thought dots
  g: "#b8b0b8", // dust
  G: "#7d7580",
  z: "#0d0e12", // ground shadow
} as const;

type Pt = readonly [number, number];

/** The frame, and the ground (the first row below the feet). */
const W = 56;
const H = 52;
const GROUND = 49;
const CX = 27;

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

// ---- Small painting helpers (pixel-center coordinates: an integer is the middle of that pixel).

/** A rounded cookie shape: a superellipse, a little boxier than an ellipse. */
const sup = (cx: number, cy: number, rx: number, ry: number, n = 2.3) => (x: number, y: number) =>
  Math.abs((x - cx) / rx) ** n + Math.abs((y - cy) / ry) ** n <= 1;
/** Gingerbread by a light value (0 dark to 1 light): banded, never blended. */
const tone = (l: number) => (l < 0.25 ? "d" : l < 0.5 ? "c" : l < 0.78 ? "C" : "h");
/** Light from the top left on a round surface. */
const roundL = (cx: number, cy: number, rx: number, ry: number, bias = 0) => (x: number, y: number) =>
  0.52 + bias - 0.45 * ((x - cx) / rx) - 0.55 * ((y - cy) / ry);
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
/** Baked texture: a few darker crumbs, the same every time. */
function speckle(cv: Canvas, seed: number, every = 23): void {
  cv.forEach((row, y) =>
    row.forEach((k, x) => {
      if ((k === "c" || k === "C") && ((x * 7 + y * 13 + seed) * 2654435761) % 1000 < 1000 / every) cv[y]![x] = k === "C" ? "c" : "d";
    }),
  );
}

// ---- Faces. A big round head: two big icing eyes (white, a dark pupil looking our way), rosy cheeks, a small icing smile.

export type Mood = "calm" | "blink" | "happy" | "cheer" | "think" | "thinkBlink" | "smug" | "rattled" | "hurt" | "out" | "bold" | "wow";
type Eye = "open" | "up" | "wide" | "half" | "arc" | "shut" | "pinch" | "x";
type Brow = "up" | "worried" | "bold" | "smug";
type Mouth = "smile" | "grin" | "flat" | "smirk" | "wavy" | "o" | "big";

/** The near eye (6 x 7, on our left) and the far one (5 x 6, by the bridge of its nose), by look. */
const NEAR_EYE: Record<Eye, readonly string[]> = {
  open: [".kkkk.", "kxxmmk", "kxmmmk", "kmmmmk", "kmmmmk", "kmmmmk", ".kkkk."],
  up: [".kkkk.", "kmmxxk", "kmmmxk", "kmmmmk", "kwmmwk", "kwwwwk", ".kkkk."],
  wide: [".kkkk.", "kwwwwk", "kwwwwk", "kwxmwk", "kwmmwk", "kwwwwk", ".kkkk."],
  half: ["......", "......", "kkkkkk", "kxmmmk", "kmmmmk", ".kkkk.", "......"],
  arc: ["......", "......", ".kkkk.", "k....k", "......", "......", "......"],
  shut: ["......", "......", "......", "......", "k....k", ".kkkk.", "......"],
  pinch: ["......", "kk....", ".kkk..", "...kkk", ".kkk..", "kk....", "......"],
  x: ["......", "k...k.", ".k.k..", "..k...", ".k.k..", "k...k.", "......"],
};
const FAR_EYE: Record<Eye, readonly string[]> = {
  open: [".kkkk.", "kxxmmk", "kxmmmk", "kmmmmk", "kmmmmk", ".kkkk."],
  up: [".kkkk.", "kmmxxk", "kmmmxk", "kmmmmk", "kwwwwk", ".kkkk."],
  wide: [".kkkk.", "kwwwwk", "kwxmwk", "kwmmwk", "kwwwwk", ".kkkk."],
  half: ["......", "......", "kkkkkk", "kxmmmk", ".kkkk.", "......"],
  arc: ["......", "......", ".kkkk.", "k....k", "......", "......"],
  shut: ["......", "......", "......", "k....k", ".kkkk.", "......"],
  pinch: ["......", "...kk.", "..kk..", ".kk...", "..kk..", "...kk."],
  x: ["......", ".k..k.", "..kk..", "..kk..", ".k..k.", "......"],
};
/** Icing brows: [near, far] pixel lists on the head grid. */
const BROWS: Record<Brow, readonly [readonly Pt[], readonly Pt[]]> = {
  up: [[[6, 2], [7, 2], [8, 2]], [[14, 2], [15, 2], [16, 2]]],
  worried: [[[5, 3], [6, 2], [7, 2], [8, 1]], [[13, 1], [14, 2], [15, 2], [16, 3]]],
  bold: [[[5, 2], [6, 2], [7, 3], [8, 3]], [[13, 3], [14, 3], [15, 2], [16, 2]]],
  smug: [[[5, 3], [6, 3], [7, 3]], [[14, 1], [15, 1], [16, 2]]],
};
const MOUTHS: Record<Mouth, readonly string[]> = {
  smile: ["w...w", ".www."],
  grin: ["wwwww", "wmmmw", ".www."],
  big: ["wwwww", "wmmmw", "wmmmw", ".www."],
  flat: ["wwww"],
  smirk: ["....w", "wwww."],
  wavy: ["w.w.w", ".w.w."],
  o: [".ww.", "wmmw", ".ww."],
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
  out: { near: "x", far: "x", mouth: "wavy" },
  bold: { near: "open", far: "open", brow: "bold", mouth: "grin", blush: true },
  wow: { near: "wide", far: "wide", brow: "up", mouth: "o", blush: true },
};

const HW = 22;
const HH = 17;
/** Where the head grid sits at rest (its top-left), on the frame. */
const HX0 = 18;
const HY0 = 14;

function head(mood: Mood): Part {
  const cv = canvas(HW, HH);
  const skull = sup(10.5, 8, 11.2, 8.9, 2.4);
  fill(cv, skull, roundL(11, 8, 11.5, 9.4, 0.12));
  speckle(cv, 3, 26);
  const face = FACES[mood];
  if (face.blush) {
    stamp(cv, ["qQq", "qqq"], 3, 12);
    stamp(cv, ["qQq", "qqq"], 18, 12);
  }
  stamp(cv, NEAR_EYE[face.near], 5, 5);
  stamp(cv, FAR_EYE[face.far], 13, 5);
  if (face.brow) for (const side of BROWS[face.brow]) dots(cv, side, "w");
  const mouth = MOUTHS[face.mouth];
  stamp(cv, mouth, face.mouth === "flat" ? 12 : face.mouth === "smirk" || face.mouth === "o" ? 12 : 11, 13);
  return { grid: toGrid(cv) };
}
const MOODS: readonly Mood[] = ["calm", "blink", "happy", "cheer", "think", "thinkBlink", "smug", "rattled", "hurt", "out", "bold", "wow"];
for (const m of MOODS) PARTS[`head:${m}`] = head(m);

/** A dollop of icing on top of its head, leaning a little. */
PARTS["dollop"] = { grid: [".www.", "wwwwW", "wwWWW"] };

PARTS["shadow"] = (() => {
  const cv = canvas(24, 3);
  ellipse(cv, 12, 1.5, 12, 1.5, "z");
  return { grid: toGrid(cv), outline: false };
})();

PARTS["stool"] = {
  grid: [
    "oooooooooooooooooooo",
    "pppppppppppppppppppp",
    "PPPPPPPPPPPPPPPPPPPP",
    "..pP............pP..",
    "..pP............pP..",
    "..pP............pP..",
    "..pPPPPPPPPPPPPPPP..",
    "..pP............pP..",
    "..pP............pP..",
    "..pP............pP..",
  ],
};

// ---- Body: a round little cookie with a gumdrop button and an icing hem.

PARTS["body"] = (() => {
  const cv = canvas(15, 12);
  const inside = sup(7, 5.5, 7.7, 6.3, 2.3);
  fill(cv, inside, roundL(7, 5.5, 8, 6.6, 0.1));
  speckle(cv, 5, 22);
  // The icing hem: a wavy line near the bottom, lit on the left.
  for (let x = 1; x <= 13; x++) {
    const y = 9 + ((x & 3) === 1 || (x & 3) === 2 ? 1 : 0);
    if (cv[y]![x] !== ".") cv[y]![x] = x < 8 ? "w" : "W";
  }
  stamp(cv, [".rr.", "rErR", "RRRR"], 8, 4);
  return { grid: toGrid(cv) };
})();

// ---- The scarf: a striped band round the neck, a short end hanging down the chest, and two ends flying behind.

const STRIPE = (x: number, y: number, ph = 0) => ((x + y + ph) & 3) < 2;
const scarfKey = (red: boolean, lit: boolean) => (red ? (lit ? "s" : "S") : lit ? "v" : "V");

PARTS["band"] = (() => {
  const w = 16;
  const cv = canvas(w, 5);
  for (let x = 0; x < w; x++) {
    const off = Math.round(Math.sin((Math.PI * x) / (w - 1)));
    for (let y = 0; y < 4; y++) cv[y + off]![x] = scarfKey(STRIPE(x, y), y < 2);
  }
  return { grid: toGrid(cv) };
})();

PARTS["hang"] = (() => {
  const cv = canvas(4, 8);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) if (!(y === 7 && (x & 1))) cv[y]![x] = scarfKey(STRIPE(x, y, 1), x < 2);
  return { grid: toGrid(cv) };
})();

/** How a tail slopes toward its free end (rising pixels per pixel of length): droop, flat, up, up high. */
type Slope = "d" | "f" | "u" | "U";
const SLOPE: Record<Slope, number> = { d: -0.34, f: 0, u: 0.3, U: 0.62 };
/** A flying scarf end `len` long, 4 thick, sheared by `slope` (its pinned end at the right); `py` = row of its pinned top. */
function tail(len: number, slope: Slope): { name: string; py: number } {
  const s = SLOPE[slope];
  const dy = (x: number) => -Math.round(s * (len - 1 - x));
  const ys = Array.from({ length: len }, (_, x) => dy(x));
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const name = `tail:${len}:${slope}`;
  if (!PARTS[name]) {
    const cv = canvas(len, 4 + hi - lo);
    for (let x = 0; x < len; x++)
      for (let y = 0; y < 4; y++) {
        if (x === 0 && y % 2) continue;
        cv[y + dy(x) - lo]![x] = scarfKey(STRIPE(x, y, 2), y < 2);
      }
    PARTS[name] = { grid: toGrid(cv) };
  }
  return { name, py: -lo };
}

// ---- Limbs: a round stroke through a few points, cylinder-shaded, with an icing cuff near the end.

function near(p: Pt, a: Pt, b: Pt): { d: number; nx: number; ny: number; t: number } {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy || 1)));
  const nx = p[0] - (a[0] + t * vx);
  const ny = p[1] - (a[1] + t * vy);
  return { d: Math.hypot(nx, ny), nx, ny, t };
}
interface LimbOpts {
  endR?: number;
  /** Distance from the end where the icing cuff starts. */
  cuff?: number;
  far?: boolean;
}
function limb(pts: readonly Pt[], r: number, o: LimbOpts = {}): Painted {
  const cv = canvas(W, H);
  const end = pts[pts.length - 1]!;
  const endR = o.endR ?? r;
  const segLen = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let best = { d: Infinity, nx: 0, ny: 0, fromEnd: 0 };
      for (let i = 0; i + 1 < pts.length; i++) {
        const n = near([x, y], pts[i]!, pts[i + 1]!);
        if (n.d < best.d) best = { d: n.d, nx: n.nx, ny: n.ny, fromEnd: segLen.slice(i + 1).reduce((s, l) => s + l, 0) + (1 - n.t) * segLen[i]! };
      }
      const de = Math.hypot(x - end[0], y - end[1]);
      const inBall = de <= endR;
      if (best.d > r && !inBall) continue;
      let nx = best.nx;
      let ny = best.ny;
      let rr = r;
      if (inBall && de < best.d + 0.8) {
        nx = x - end[0];
        ny = y - end[1];
        rr = endR;
      }
      const l = 0.62 - 0.45 * (nx / rr) - 0.5 * (ny / rr) - (o.far ? 0.12 : 0);
      let k = tone(l);
      if (o.cuff !== undefined && best.d <= r && best.fromEnd >= o.cuff && best.fromEnd < o.cuff + 1.15) k = nx + ny < 0.6 ? "w" : "W";
      cv[y]![x] = k;
    }
  return crop(cv);
}
const armPart = (pts: readonly Pt[], far: boolean) => painted(`arm:${far ? "f" : "n"}:${pts.map((p) => p.join(",")).join(";")}`, () => limb(pts, 1.95, { endR: 2.2, cuff: 1.7, far }));
const legPart = (pts: readonly Pt[], far: boolean) => painted(`leg:${far ? "f" : "n"}:${pts.map((p) => p.join(",")).join(";")}`, () => limb(pts, 2.2, { endR: 2.7, cuff: 2.0, far }));

/** Arms, as points from the shoulder (at rest on the body, bob 0). The far arm (our right) is behind the body unless it's raised. */
const SH_N: Pt = [21.5, 35.5];
const SH_F: Pt = [33.5, 35.5];
export type NearArm = "rest" | "fwd" | "back" | "hip" | "up" | "flail" | "out" | "lap" | "cheek";
export type FarArm = "rest" | "fwd" | "back" | "hip" | "up" | "waveL" | "waveM" | "waveR" | "point" | "chin" | "out" | "flail" | "reach" | "cheek";
const NEAR_ARMS: Record<NearArm, readonly Pt[]> = {
  rest: [SH_N, [19.5, 38.5], [19.5, 42]],
  fwd: [SH_N, [23, 39], [25.5, 41.5]],
  back: [SH_N, [18.5, 38], [16.5, 40.5]],
  hip: [SH_N, [17, 37.5], [21, 41]],
  up: [SH_N, [17, 31], [16, 24]],
  flail: [SH_N, [16, 33], [12, 29]],
  out: [SH_N, [16, 36], [11, 38]],
  lap: [SH_N, [23.5, 39], [29, 40]],
  cheek: [SH_N, [18, 34], [21, 29]],
};
const FAR_ARMS: Record<FarArm, { pts: readonly Pt[]; front?: boolean }> = {
  rest: { pts: [SH_F, [35.5, 38.5], [36, 42]] },
  fwd: { pts: [SH_F, [36, 38], [38.5, 40]] },
  back: { pts: [SH_F, [35, 38.5], [34, 41.5]] },
  hip: { pts: [SH_F, [38, 37.5], [34.5, 41]] },
  up: { pts: [SH_F, [38, 31], [39, 24]], front: true },
  waveL: { pts: [SH_F, [39, 31], [41.5, 24.5]], front: true },
  waveM: { pts: [SH_F, [39.5, 31], [44, 25]], front: true },
  waveR: { pts: [SH_F, [39.5, 32], [46.5, 27.5]], front: true },
  point: { pts: [SH_F, [39, 35], [44.5, 33]], front: true },
  chin: { pts: [SH_F, [38, 34], [34.5, 29.5]], front: true },
  out: { pts: [SH_F, [39, 36], [44, 38]] },
  flail: { pts: [SH_F, [39, 34], [43, 30]], front: true },
  reach: { pts: [SH_F, [38, 37], [43, 36]], front: true },
  cheek: { pts: [SH_F, [38, 34], [36, 29]], front: true },
};

// ---- Poses.

interface FootPose {
  x?: number;
  lift?: number;
}
export interface Pose {
  mood?: Mood;
  /** The whole upper body down this many pixels (a breath, a crouch). */
  bob?: number;
  /** The head on the body. */
  hx?: number;
  hy?: number;
  /** The dollop of icing's sway, in pixels. */
  dol?: number;
  dx?: number;
  /** Off the ground. */
  air?: number;
  feet?: { n?: FootPose; f?: FootPose };
  an?: NearArm;
  af?: FarArm;
  /** The scarf's ends: slope of the long and short end, ripple phase and size. */
  sc?: { a?: Slope; b?: Slope; ph?: number; amp?: number };
  /** Hanging end swings (pixels). */
  swing?: number;
  /** On the stool; `kick` swings the shins (-1, 0, 1). */
  sit?: boolean;
  kick?: number;
  noShadow?: boolean;
}

const SIT_RISE = -4;

function build(p: Pose): Layer[] {
  const dx = p.dx ?? 0;
  const air = p.air ?? 0;
  const sit = p.sit ?? false;
  const by = (p.bob ?? 0) - air + (sit ? SIT_RISE : 0);
  const layers: Layer[] = [];
  const put = (part: string, x: number, y: number, extra: Partial<Layer> = {}) => layers.push({ part, x, y, ...extra });
  const add = (l: { name: string; at: Pt }) => put(l.name, l.at[0], l.at[1]);
  const shift = (pts: readonly Pt[]): Pt[] => pts.map(([x, y]): Pt => [x + dx, y + by]);
  if (!p.noShadow) put("shadow", CX - 12 + dx, GROUND - 2);
  if (sit) put("stool", 17, 38);

  // Legs.
  if (sit) {
    const k = p.kick ?? 0;
    const sb = SIT_RISE - air;
    add(legPart([[27.5 + dx, 40.5 + by], [34, 42 + sb], [34.5 - k, 47 + sb - 1]], true));
    add(legPart([[25.5 + dx, 40.5 + by], [31.5, 42 + sb], [32.5 + k, 48 + sb - 1]], false));
  } else {
    const fn = p.feet?.n ?? {};
    const ff = p.feet?.f ?? {};
    const foot = (x: number, f: FootPose): Pt => [x + (f.x ?? 0) + dx, 44.5 - air - (f.lift ?? 0)];
    add(legPart([[30.5 + dx, 38 + by], foot(30.5, ff)], true));
    add(legPart([[23.5 + dx, 38 + by], foot(23.5, fn)], false));
  }

  // The scarf's flying ends, behind the body.
  const sc = p.sc ?? {};
  const amp = sc.amp ?? 1;
  const ph = sc.ph ?? 0;
  const ta = tail(11, sc.a ?? "f");
  const tb = tail(8, sc.b ?? "d");
  put(ta.name, 9 + dx, 30 + by - ta.py, { wave: { along: "cols", amp, len: 9, phase: ph, pin: "right" } });
  put(tb.name, 13 + dx, 32 + by - tb.py, { wave: { along: "cols", amp: amp * 0.8, len: 8, phase: ph + 1.7, pin: "right" } });

  // The far arm, behind the body unless it's raised.
  const farSpec = FAR_ARMS[p.af ?? "rest"];
  if (!farSpec.front) add(armPart(shift(farSpec.pts), true));

  put("body", 20 + dx, 30 + by);
  put("hang", 23 + dx + (p.swing ?? 0), 31 + by, p.swing ? { wave: { along: "rows", amp: 1, len: 8, phase: 0, pin: "top" } } : {});
  put("band", 19 + dx, 29 + by);
  add(armPart(shift(NEAR_ARMS[p.an ?? "rest"]), false));

  const hx = HX0 + (p.hx ?? 0) + dx;
  const hy = HY0 + (p.hy ?? 0) + by;
  put(`head:${p.mood ?? "calm"}`, hx, hy);
  put("dollop", hx + 7 + (p.dol ?? 0), hy - 3);
  if (farSpec.front) add(armPart(shift(farSpec.pts), true));
  return layers;
}

// ---- Effects.

function seeded(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => ((s = (s * 1103515245 + 12345) >>> 0) >>> 8) / 16777216;
}
/** A twinkle: a little plus. */
const star = (x: number, y: number, k = "y"): Speck[] => [[x, y, "x"], [x - 1, y, k], [x + 1, y, k], [x, y - 1, k], [x, y + 1, k]];
function twinkles(t: number, n = 4, box: readonly [number, number, number, number] = [6, 4, 50, 38]): Speck[] {
  const rnd = seeded(t * 31 + 5);
  return Array.from({ length: n }, (_, i) => star(Math.round(box[0] + rnd() * (box[2] - box[0])), Math.round(box[1] + rnd() * (box[3] - box[1])), (i + t) % 2 ? "y" : "i")).flat();
}
/** Sprinkles: little two-pixel candy bits scattered round it. */
function sprinkles(t: number, n = 8, box: readonly [number, number, number, number] = [6, 4, 50, 40]): Speck[] {
  const rnd = seeded(t * 17 + 3);
  const keys = ["l", "y", "n", "i", "s"];
  return Array.from({ length: n }, (_, i): Speck[] => {
    const x = Math.round(box[0] + rnd() * (box[2] - box[0]));
    const y = Math.round(box[1] + rnd() * (box[3] - box[1]));
    const k = keys[(i + t) % keys.length]!;
    return rnd() < 0.5 ? [[x, y, k], [x + 1, y, k]] : [[x, y, k], [x, y + 1, k]];
  }).flat();
}
/** Dust puffing out along the ground at the feet. */
const dust = (t: number, dx = 0): Speck[] =>
  [-1, 1].flatMap((side) => [0, 1, 2].map((i): Speck => [Math.round(CX + dx + side * (8 + i * 3 + t * 2)), GROUND - 2 - (i % 2) - (t > 0 ? 1 : 0), t > 1 ? "G" : "g"]));
/** The shadow on the ground, growing as it drops in. */
const dropShadow = (r: number): Speck[] => Array.from({ length: r * 2 + 1 }, (_, i): Speck => [CX - r + i, GROUND - 1, "z"]);
/** Thought dots beside the head. */
const thoughts = (n: number): Speck[] =>
  ([[43, 17], [47, 13], [51, 9]] as const).slice(0, n).flatMap(([x, y], k): Speck[] => {
    const big = k === 2;
    return [[x, y, "t"], [x + 1, y, "t"], [x, y + 1, "t"], [x + 1, y + 1, "g"], ...(big ? ([[x - 1, y, "t"], [x + 2, y, "t"], [x, y - 1, "t"], [x + 1, y - 1, "t"], [x - 1, y + 1, "g"], [x + 2, y + 1, "G"], [x, y + 2, "g"], [x + 1, y + 2, "G"]] as Speck[]) : [])];
  });
/** Sweat flying off the head. */
const sweat = (i: number): Speck[] => {
  const t = i % 4;
  return [[16 - t, 17 + t, "j"], [16 - t, 18 + t, "x"], [42 + t, 14 + t, "j"], [42 + t, 15 + t, "x"]];
};
/** A crumb chip flying off the head after a hit (`t` frames after). */
const crumbs = (t: number): Speck[] =>
  ([[-1.2, -1.2], [1.2, -1.6], [1.8, -0.6], [-1.8, -0.4]] as const).flatMap(([vx, vy], i): Speck[] => {
    const px = Math.round(30 + vx * t * 2.4);
    const py = Math.round(16 + vy * t * 2.4 + 0.45 * t * t);
    return [[px, py, i % 2 ? "C" : "c"], [px + 1, py, "d"]];
  });
/** An exclamation mark. */
const bang = (x: number, y: number): Speck[] => [[x, y, "Y"], [x + 1, y, "y"], [x, y + 1, "Y"], [x + 1, y + 1, "y"], [x, y + 2, "Y"], [x + 1, y + 2, "y"], [x, y + 4, "Y"], [x + 1, y + 4, "y"]];

const FLASH: Record<string, string> = { d: "#c98a5a", c: "#e8b486", C: "#fbd9b8", h: "#fff4e6" };

/** One frame: the pose and anything extra. */
function f(ms: number, p: Pose, extra: Partial<Frame> = {}): Frame {
  const specks = (extra.specks ?? []).filter(([x, y]) => x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2);
  return { ms, layers: build(p), ...extra, specks };
}

// ---- Animations.

/** Idle (3 s): breathes, blinks, glances ahead, its dollop nods and the scarf's ends flutter. */
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 30 }, (_, i) => {
    const bob = i % 15 >= 8 ? 1 : 0;
    const blink = i === 11 || i === 12 || i === 27;
    const hx = i >= 22 && i <= 28 ? 1 : 0;
    const gust = i >= 4 && i <= 9;
    return f(100, { bob, mood: blink ? "blink" : "calm", hx, dol: i % 15 >= 9 ? 0 : i % 15 >= 4 ? 1 : 0, sc: { a: gust ? "u" : "f", b: "d", ph: i * 0.55, amp: gust ? 1.6 : 1.1 }, feet: { f: i === 17 || i === 18 || i === 20 || i === 21 ? { lift: 1 } : {} } });
  }),
};

/** Walk (0.6 s): a stiff, bouncy little cookie step, the head bobbing, the scarf swinging. */
const NEAR_SWING: readonly NearArm[] = ["rest", "back", "back", "rest", "fwd", "fwd"];
const FAR_SWING: readonly FarArm[] = ["rest", "fwd", "fwd", "rest", "back", "back"];
const walk: Anim = {
  loop: true,
  frames: Array.from({ length: 6 }, (_, i) => {
    const th = (i / 6) * Math.PI * 2;
    const leg = (off: number): FootPose => ({ x: Math.round(2 * Math.sin(th + off * Math.PI * 2)), lift: Math.max(0, Math.round(2 * Math.cos(th + off * Math.PI * 2))) });
    const bob = i % 3 === 0 ? 0 : 1;
    return f(100, { bob, hy: i % 3 === 2 ? -1 : 0, mood: "calm", feet: { n: leg(0), f: leg(0.5) }, an: NEAR_SWING[i]!, af: FAR_SWING[i]!, sc: { a: "u", b: "f", ph: i * 1.05, amp: 1.8 }, swing: bob ? 1 : 0, dol: i % 3 === 0 ? 0 : 1 }, i % 3 === 2 ? { cue: "step" } : {});
  }),
};

/** Sit (loops): on a stool at the chess table, facing the board, legs dangling, a hand on its lap; thinks about a move. */
const sit: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) => {
    const lean = i >= 6 && i <= 11;
    const blink = i === 3 || i === 4 || i === 13;
    return f(200, { sit: true, mood: blink ? (lean ? "thinkBlink" : "blink") : lean ? "think" : "calm", bob: i % 8 >= 4 ? 1 : 0, hx: lean ? 2 : 0, hy: lean ? 1 : 0, kick: i % 8 < 2 ? 0 : i % 8 < 4 ? 1 : i % 8 < 6 ? 0 : -1, an: "lap", af: lean ? "chin" : "reach", sc: { a: "d", b: "d", ph: i * 0.5, amp: 0.8 }, dol: lean ? 1 : 0 });
  }),
};

/** Wave (once, 1.2 s): waves a stubby arm hello, the scarf flicking up, then settles back to its idle pose. */
const WAVES: readonly FarArm[] = ["waveL", "waveM", "waveR", "waveM", "waveL", "waveM", "waveR", "waveM"];
const wave: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 1, mood: "happy", af: "fwd", sc: { a: "f", b: "d", ph: 0.5 } }),
    f(100, { mood: "cheer", af: "up", hy: -1, sc: { a: "U", b: "u", ph: 1, amp: 1.8 } }, { cue: "hello" }),
    ...WAVES.map((af, i) =>
      f(100, { mood: i % 2 ? "cheer" : "happy", af, hx: af === "waveL" ? -1 : af === "waveR" ? 1 : 0, hy: i % 2 ? 0 : -1, bob: i % 2 ? 1 : 0, dol: i % 2 ? 1 : 0, sc: { a: i < 4 ? "U" : "u", b: i < 4 ? "u" : "f", ph: 2 + i * 0.9, amp: 1.8 }, an: "rest" }, { specks: i % 3 === 0 ? star(48 + (i % 3), 13 + (i % 4) * 2) : [] }),
    ),
    f(100, { mood: "happy", af: "fwd", sc: { a: "u", b: "d", ph: 9 } }),
    f(100, { mood: "calm", sc: { a: "f", b: "d", ph: 10 } }),
  ],
};

/** Entrance: drops in from above on its shadow, lands with a squash and a puff of dust, then waves hello. */
const entrance: Anim = {
  loop: false,
  frames: [
    { ms: 90, layers: [], specks: dropShadow(4) },
    { ms: 80, layers: [], specks: dropShadow(8) },
    f(70, { air: 8, mood: "cheer", an: "up", af: "up", feet: { n: { lift: 1 }, f: { lift: 2 } }, sc: { a: "U", b: "u", ph: 1, amp: 1.8 }, noShadow: true }, { specks: dropShadow(10) }),
    f(70, { air: 3, mood: "cheer", an: "up", af: "up", feet: { n: { lift: 1 }, f: { lift: 1 } }, sc: { a: "U", b: "u", ph: 2, amp: 1.8 } }),
    f(100, { bob: 3, mood: "blink", sc: { a: "d", b: "d", ph: 3, amp: 0.6 } }, { cue: "step", specks: dust(0) }),
    f(90, { bob: 1, mood: "happy", af: "up", sc: { a: "u", b: "f", ph: 4 } }, { specks: dust(1) }),
    f(110, { mood: "cheer", af: "waveL", hy: -1, sc: { a: "U", b: "u", ph: 5, amp: 1.8 } }, { cue: "hello", specks: [...dust(2), ...sprinkles(1, 6)] }),
    f(110, { mood: "happy", af: "waveR", hx: 1, sc: { a: "U", b: "u", ph: 6, amp: 1.8 } }, { specks: sprinkles(2, 6) }),
    f(110, { mood: "happy", af: "waveL", hx: -1, sc: { a: "u", b: "f", ph: 7, amp: 1.4 } }),
    f(120, { mood: "happy", af: "fwd", sc: { a: "u", b: "d", ph: 8 } }),
    f(300, { mood: "calm", sc: { a: "f", b: "d", ph: 9 } }),
  ],
};

/** Thinking (loops): head tipped up, eyes rolled up, a hand on its chin, a foot tapping, thought dots popping up. */
const thinking: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) =>
    f(150, { mood: i === 8 ? "thinkBlink" : "think", af: "chin", an: "rest", hx: 2, hy: -1, bob: i % 6 >= 3 ? 1 : 0, feet: { f: i % 4 === 1 ? { lift: 2 } : {} }, sc: { a: "f", b: "d", ph: i * 0.5, amp: 0.9 }, dol: 1 }, { specks: thoughts(i % 6 < 1 ? 0 : i % 6 < 3 ? 1 : i % 6 < 5 ? 2 : 3) }),
  ),
};

/** Its move: a hop toward the board and a point at it. */
const move: Anim = {
  loop: false,
  frames: [
    f(90, { bob: 2, mood: "bold", af: "back", an: "back", sc: { a: "d", b: "d", ph: 1 } }),
    f(80, { air: 4, dx: 1, mood: "bold", af: "point", an: "back", feet: { n: { lift: 2, x: -1 }, f: { lift: 2, x: 1 } }, sc: { a: "u", b: "f", ph: 2, amp: 1.6 } }, { cue: "hop" }),
    f(80, { air: 5, dx: 2, mood: "bold", af: "point", an: "back", feet: { n: { lift: 2 }, f: { lift: 2 } }, sc: { a: "U", b: "u", ph: 3, amp: 1.6 } }),
    f(100, { bob: 2, dx: 2, mood: "happy", af: "point", sc: { a: "d", b: "d", ph: 4, amp: 1.2 } }, { specks: [...dust(0, 2), ...sprinkles(1, 4, [38, 22, 50, 38])] }),
    f(100, { bob: 1, dx: 2, mood: "happy", af: "point", sc: { a: "f", b: "d", ph: 5 } }),
    f(110, { dx: 1, mood: "happy", af: "fwd", sc: { a: "f", b: "d", ph: 6 } }),
    f(150, { mood: "calm", sc: { a: "f", b: "d", ph: 7 } }),
  ],
};

/** A capture: two excited hops, both arms up, sprinkles everywhere. */
const capture: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 2, mood: "bold", an: "back", af: "back" }),
    f(80, { air: 5, mood: "cheer", an: "up", af: "up", feet: { n: { lift: 2 }, f: { lift: 3 } }, sc: { a: "U", b: "u", ph: 1, amp: 1.8 } }, { cue: "cheer", specks: sprinkles(1, 6) }),
    f(80, { air: 6, mood: "happy", an: "flail", af: "waveL", feet: { n: { lift: 3 }, f: { lift: 3 } }, hy: -1, sc: { a: "U", b: "u", ph: 2, amp: 1.8 } }, { specks: sprinkles(2, 8) }),
    f(80, { air: 4, mood: "happy", an: "up", af: "waveR", sc: { a: "u", b: "f", ph: 3, amp: 1.8 } }, { specks: sprinkles(3, 8) }),
    f(80, { bob: 2, mood: "cheer", an: "back", af: "back", sc: { a: "d", b: "d", ph: 4 } }, { specks: dust(0) }),
    f(80, { air: 6, mood: "happy", an: "up", af: "up", feet: { n: { lift: 2 }, f: { lift: 3 } }, sc: { a: "U", b: "u", ph: 5, amp: 1.8 } }, { specks: sprinkles(4, 8) }),
    f(80, { air: 6, mood: "happy", an: "flail", af: "waveR", feet: { n: { lift: 3 }, f: { lift: 3 } }, hy: -1, sc: { a: "U", b: "u", ph: 6, amp: 1.8 } }, { specks: sprinkles(5, 8) }),
    f(80, { air: 3, mood: "happy", an: "up", af: "waveL", sc: { a: "u", b: "f", ph: 7, amp: 1.5 } }, { specks: sprinkles(6, 6) }),
    f(90, { bob: 2, mood: "cheer", an: "back", af: "back", sc: { a: "d", b: "d", ph: 8 } }, { specks: dust(1) }),
    f(120, { bob: 1, mood: "happy", af: "up", sc: { a: "u", b: "f", ph: 9 } }),
    f(160, { mood: "smug", an: "hip", af: "hip", sc: { a: "f", b: "d", ph: 10 } }),
  ],
};

/** Hurt: hit, a flash, a crumb chips off, eyes screwed shut; then it shakes it off with a brave little grin. */
const hurt: Anim = {
  loop: false,
  frames: [
    f(70, { bob: 2, mood: "hurt", an: "out", af: "out", dol: -1, sc: { a: "d", b: "d", ph: 1, amp: 0.5 } }, { cue: "poof", pal: FLASH, shake: [1, 0], specks: crumbs(0) }),
    f(80, { bob: 3, mood: "hurt", an: "out", af: "out", dol: -1, sc: { a: "u", b: "u", ph: 2, amp: 1.8 } }, { shake: [-1, 0], specks: [...crumbs(1), [18, 17, "j"], [18, 18, "x"]] }),
    f(90, { bob: 2, dx: -1, mood: "hurt", an: "cheek", af: "cheek", sc: { a: "u", b: "d", ph: 3, amp: 1.2 } }, { specks: [...crumbs(2), [17, 19, "j"], [17, 20, "x"]] }),
    f(100, { bob: 1, dx: -1, mood: "rattled", an: "cheek", af: "cheek", sc: { a: "f", b: "d", ph: 4 } }, { specks: crumbs(3) }),
    f(110, { mood: "blink", an: "hip", af: "hip", sc: { a: "f", b: "d", ph: 5 } }),
    f(120, { mood: "bold", an: "hip", af: "hip", sc: { a: "u", b: "f", ph: 6 } }),
    f(160, { mood: "calm", sc: { a: "f", b: "d", ph: 7 } }),
  ],
};

/** Check: an excited gasp, then two sharp points at the board, hopping. */
const POINT: Pose = { bob: 2, dx: 1, mood: "bold", af: "point", an: "back" };
const check: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 1, mood: "wow", an: "up", af: "up", sc: { a: "u", b: "f", ph: 1, amp: 1.6 } }, { specks: bang(41, 4) }),
    f(110, { ...POINT, sc: { a: "u", b: "f", ph: 2, amp: 1.6 } }, { cue: "ping", specks: bang(41, 4) }),
    f(90, { air: 2, dx: 1, mood: "bold", af: "point", an: "back", feet: { n: { lift: 1 }, f: { lift: 1 } }, sc: { a: "U", b: "u", ph: 3, amp: 1.8 } }),
    f(110, { ...POINT, sc: { a: "u", b: "f", ph: 4, amp: 1.6 } }, { cue: "ping", specks: [...bang(41, 4), ...star(47, 28)] }),
    f(90, { bob: 1, dx: 1, mood: "bold", af: "point", an: "back", sc: { a: "f", b: "d", ph: 5 } }),
    f(150, { dx: 1, mood: "happy", af: "point", sc: { a: "f", b: "d", ph: 6 } }),
    f(160, { mood: "smug", an: "hip", af: "hip", sc: { a: "f", b: "d", ph: 7 } }),
  ],
};

/** Smug: hands on hips, chin up, half-shut eyes, a little smirk, a slow nod and a foot tap. */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) =>
    f(150, { mood: "smug", an: "hip", af: "hip", hy: i < 3 || i > 5 ? -1 : 0, hx: i < 4 ? 0 : 1, bob: i % 4 === 2 ? 1 : 0, feet: { f: i % 4 < 2 ? { lift: 1 } : {} }, dol: i < 4 ? 0 : 1, sc: { a: "f", b: "d", ph: i * 0.6, amp: 1 } }),
  ),
};

/** Rattled: wide eyes, worried brows, sweat flying, trembling, its arms flapping, the scarf whipping about. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) =>
    f(80, { mood: "rattled", an: i % 2 ? "up" : "cheek", af: i % 2 ? "up" : "cheek", dx: i % 2 ? 1 : -1, bob: i % 4 === 2 ? 1 : 0, dol: i % 2 ? 1 : -1, sc: { a: i % 2 ? "U" : "u", b: i % 2 ? "u" : "d", ph: i * 1.3, amp: 2 } }, { specks: sweat(i) }),
  ),
};

/** Defeat: hit, dizzy eyes, wobbles and keels over onto its back like a dropped cookie (the last frame holds). */
function lying(extra: Partial<Frame> = {}, lift = 0, mood: Mood = "out"): Frame {
  // (Its scarf's flying ends are left off: they'd hang below it, and cloth lying still is just the band.)
  const standing = build({ mood, an: "up", af: "up", noShadow: true, sc: { a: "d", b: "d", amp: 0 } }).filter((l) => !l.part.startsWith("tail:"));
  // On its back, head to the left, face up: the whole standing picture turned a quarter, then set on the ground.
  const turned = lieDown(PARTS, { layers: standing }, 0, 0, "left").layers;
  const box = turned.map((l) => {
    const [w, h] = partSize(PARTS[l.part]!, l.rot ?? 0);
    return [l.x, l.y, l.x + w, l.y + h] as const;
  });
  const x0 = Math.min(...box.map((b) => b[0]));
  const x1 = Math.max(...box.map((b) => b[2]));
  const y1 = Math.max(...box.map((b) => b[3]));
  const sx = CX - Math.round((x0 + x1) / 2);
  const sy = GROUND - 3 - y1 - lift;
  return {
    ms: 120,
    ...extra,
    layers: [{ part: "shadow", x: CX - 12, y: GROUND - 2 }, ...turned.map((l) => ({ ...l, x: l.x + sx, y: l.y + sy }))],
  };
}
const defeat: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 2, mood: "hurt", an: "out", af: "out", sc: { a: "d", b: "d", ph: 1, amp: 0.5 } }, { cue: "poof", pal: FLASH, shake: [1, 0], specks: crumbs(0) }),
    f(90, { bob: 2, dx: -1, mood: "out", an: "cheek", af: "cheek", hx: -1, sc: { a: "u", b: "d", ph: 2 } }, { specks: crumbs(1) }),
    f(110, { bob: 3, dx: 1, mood: "out", an: "out", af: "out", hx: 1, sc: { a: "d", b: "d", ph: 3 } }, { specks: crumbs(2) }),
    f(110, { air: 2, dx: 1, mood: "out", an: "flail", af: "flail", feet: { n: { lift: 2 }, f: { lift: 2 } }, hy: 1, sc: { a: "U", b: "u", ph: 4, amp: 1.5 } }, { specks: crumbs(3) }),
    lying({ ms: 90 }, 7),
    lying({ ms: 110, cue: "poof", shake: [0, 1], specks: [...dust(0)] }),
    lying({ ms: 90 }, 2),
    lying({ ms: 120, specks: [...dust(1)] }),
    lying({ ms: 200, specks: [...star(14, 28), ...star(24, 24, "i")] }),
    lying({ ms: 1000, specks: [...star(16, 26, "l"), ...star(26, 25)] }),
  ],
};

/** Victory: jumping for joy, both arms high, sprinkles popping all round. Then again. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const air = [0, 3, 5, 6, 5, 3, 0, 0, 3, 5, 3, 0][i]!;
    const afs: FarArm[] = ["up", "waveL", "waveM", "waveR", "waveM", "waveL", "up", "up", "waveR", "waveM", "waveL", "up"];
    return f(110, { bob: i === 0 || i === 6 || i === 7 ? 2 : 0, air, mood: air > 2 ? "happy" : "cheer", an: air > 0 ? "up" : "back", af: afs[i]!, feet: air > 2 ? { n: { lift: 2 }, f: { lift: 3 } } : {}, hy: i % 2 ? -1 : 0, dol: i % 2 ? 1 : -1, sc: { a: "U", b: "u", ph: i * 1.1, amp: 1.9 } }, { specks: [...sprinkles(i, 7), ...twinkles(i, 2)], cue: i === 2 ? "cheer" : undefined });
  }),
};

export const sidekickGinger: Character = {
  id: "sidekick-ginger",
  name: "Ginger's sidekick",
  w: W,
  h: H,
  foot: [CX, GROUND],
  palette: SIDEKICK_GINGER_PALETTE,
  halo: "#2c2622",
  parts: PARTS,
  anims: { idle, walk, sit, wave, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory },
};
