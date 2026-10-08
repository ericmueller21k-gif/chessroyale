/**
 * Ginger Snap, the Freeze boss: an angry gingerbread man with white icing trim, a green bow tie, red gumdrop buttons
 * and a big candy cane he holds like a weapon, after Eric's reference picture, redrawn. He's the Freeze boss, so his
 * icing glints like frost, his eyes go ice-blue and his cane glows when he casts. Drawn facing front, light from the
 * top left.
 *
 * Rigging: the head, bow tie and torso are typed or painted once; the arms, legs and the cane are painted from their
 * pose's points (a shoulder, an elbow, a fist; a hip and a foot; the cane's grip and direction), so a new pose is a
 * handful of numbers. The cane hand (his right, on our left) always grips the cane; the other arm is free.
 */
import { canvas, ellipse, inEllipse, roundLight, shade, toGrid, type Canvas } from "./paint.ts";
import { lieDown, partSize, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "./sprite.ts";

export const GINGER_PALETTE = {
  k: "#1c0d07", // outline
  d: "#6e3414", // gingerbread, dark to light
  c: "#9a4f1d",
  C: "#bf6c2c",
  h: "#d98b45",
  w: "#fbfdff", // icing
  W: "#bfe3f5", // icing in shadow: frosty blue
  f: "#8fdcff", // frost glint
  F: "#ffffff",
  e: "#ff3b2f", // eyes
  E: "#ffd2c4",
  m: "#3a1208", // inside the mouth
  g: "#3fae4f", // bow tie
  G: "#22713a",
  j: "#86dc78",
  r: "#e8303a", // gumdrops
  R: "#9e1d2a",
  s: "#e2343b", // the cane: red and white stripes
  S: "#a3202b",
  v: "#f6f1ea",
  V: "#cfc6c2",
  i: "#c8f4ff", // ice and his casting glow
  I: "#5cc8ff",
  J: "#2a7fd4",
  z: "#0d0e12", // ground shadow
} as const;

type Pt = readonly [number, number];

// ---- Head: one face per mood.

export type Mood = "angry" | "laugh" | "shout" | "hurt" | "smug" | "rattled" | "think" | "out";

/** Left-side features (the right side is their mirror), in the head's 22 x 20 grid. */
const BROWS: Record<string, readonly string[]> = {
  angry: ["ww...", ".www.", "...ww"],
  worried: ["...ww", ".www.", "ww..."],
  flat: [".....", "wwww.", "....."],
  high: ["wwww.", ".....", "....."],
};
const EYES: Record<string, readonly string[]> = {
  angry: ["kk..", "keek", ".kkk"],
  wide: [".kk.", "kwek", ".kk."],
  squint: ["kk..", ".kkk", "...."],
  x: ["k.k.", ".k..", "k.k."],
  half: ["....", "kkkk", "keek"],
  look: ["kkkk", "k.ee", ".kkk"],
};
const MOUTHS: Record<string, readonly string[]> = {
  frown: ["..www..", ".w...w.", "w.....w"],
  laugh: ["wwwwwww", "wmmmmmw", ".wmmmw.", "..www.."],
  shout: [".www.", "wmmmw", "wmmmw", ".www."],
  o: [".ww.", "wmmw", ".ww."],
  smirk: [".....w", "wwwww."],
  wavy: ["ww..ww.", "..ww..w"],
  flat: ["wwwww"],
};
const FACES: Record<Mood, { brows: string; right?: string; eyes: string; mouth: string }> = {
  angry: { brows: "angry", eyes: "angry", mouth: "frown" },
  laugh: { brows: "angry", eyes: "squint", mouth: "laugh" },
  shout: { brows: "angry", eyes: "angry", mouth: "shout" },
  hurt: { brows: "worried", eyes: "x", mouth: "o" },
  smug: { brows: "angry", right: "high", eyes: "half", mouth: "smirk" },
  rattled: { brows: "worried", eyes: "wide", mouth: "wavy" },
  think: { brows: "flat", eyes: "look", mouth: "flat" },
  out: { brows: "flat", eyes: "x", mouth: "wavy" },
};

function stamp(cv: Canvas, rows: readonly string[], x0: number, y0: number, mirror = false): void {
  rows.forEach((row, y) =>
    [...row].forEach((k, i) => {
      if (k === ".") return;
      const x = mirror ? x0 + row.length - 1 - i : x0 + i;
      if (cv[y0 + y]?.[x] !== undefined && cv[y0 + y]![x] !== ".") cv[y0 + y]![x] = k;
    }),
  );
}

/** A wavy line of icing (two pixels up, two down), lit on the left. */
function icingLine(cv: Canvas, x0: number, x1: number, y: (x: number) => number): void {
  for (let x = x0; x <= x1; x++) {
    const yy = Math.round(y(x)) + ((x & 3) === 1 || (x & 3) === 2 ? 1 : 0);
    if (cv[yy]?.[x] !== undefined && cv[yy]![x] !== ".") cv[yy]![x] = x < (x0 + x1) / 2 + 2 ? "w" : "W";
  }
}

/** Baked texture: a few darker pixels, the same every time. */
function speckle(cv: Canvas, seed: number, every = 23): void {
  cv.forEach((row, y) =>
    row.forEach((k, x) => {
      if ((k === "c" || k === "C") && ((x * 7 + y * 13 + seed) * 2654435761) % 1000 < 1000 / every) cv[y]![x] = k === "C" ? "c" : "d";
    }),
  );
}

/** Cracks across his head after a hit (1: one, 2: two). */
const HEAD_CRACKS: readonly (readonly Pt[])[] = [
  [[16, 2], [15, 3], [16, 4], [15, 5], [14, 6]],
  [[4, 12], [5, 13], [4, 14], [5, 15]],
];

function head(mood: Mood, cracks = 0): Part {
  const cv = canvas(22, 20);
  shade(cv, inEllipse(11, 10, 11, 10), "dcCh", roundLight(11, 10, 11, 10, 0.08));
  speckle(cv, 3, 29);
  icingLine(cv, 4, 17, (x) => 2.6 + 0.045 * (x - 11) ** 2);
  const f = FACES[mood];
  stamp(cv, BROWS[f.brows]!, 4, 6);
  stamp(cv, BROWS[f.right ?? f.brows]!, 13, 6, true);
  stamp(cv, EYES[f.eyes]!, 5, 9);
  stamp(cv, EYES[f.eyes]!, 13, 9, true);
  const mouth = MOUTHS[f.mouth]!;
  stamp(cv, mouth, 11 - Math.floor(mouth[0]!.length / 2), 14);
  for (const crack of HEAD_CRACKS.slice(0, cracks)) for (const [x, y] of crack) cv[y]![x] = "k";
  return { grid: toGrid(cv) };
}

// ---- Torso, bow tie.

const torso: Part = (() => {
  const cv = canvas(22, 19);
  const inside = (x: number, y: number) => {
    const cx = Math.max(3, Math.min(18, x + 0.5));
    const cy = Math.max(3, Math.min(15, y + 0.5));
    return (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= 9.5;
  };
  shade(cv, inside, "dcCh", (x, y) => 0.92 - 0.032 * x - 0.018 * y);
  speckle(cv, 5);
  // Two red gumdrop buttons.
  for (const y of [6, 11]) stamp(cv, [".rr.", "rErR", "RRRR"], 9, y);
  // The icing belt.
  icingLine(cv, 2, 19, () => 15);
  return { grid: toGrid(cv) };
})();

const bowTie: Part = {
  grid: [
    "jg.......gG", //
    "jggg.k.gggG",
    "jgggkgkgGGG",
    "jggG.k.gGGG",
    "jG.......GG",
  ],
};

const shadow: Part = (() => {
  const cv = canvas(32, 3);
  ellipse(cv, 16, 1.5, 16, 1.5, "z");
  return { grid: toGrid(cv), outline: false };
})();

// ---- Limbs: a thick round stroke along a few points, cylinder-shaded, with an icing cuff near the end.

interface Painted {
  part: Part;
  /** The part's top-left in his drawing space. */
  at: Pt;
}

function nearest(p: Pt, a: Pt, b: Pt): { d: number; nx: number; ny: number; t: number } {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2));
  const nx = p[0] - (a[0] + t * vx);
  const ny = p[1] - (a[1] + t * vy);
  return { d: Math.hypot(nx, ny), nx, ny, t };
}

/** A limb along `pts` (shoulder to fist, or hip to foot), `r` thick, the end a little rounder (a fist, a foot). */
function paintLimb(pts: readonly Pt[], r: number, cuff: number, endR = r): Painted {
  const pad = Math.ceil(Math.max(r, endR)) + 1;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs)) - pad;
  const y0 = Math.floor(Math.min(...ys)) - pad;
  const w = Math.ceil(Math.max(...xs)) + pad - x0 + 1;
  const h = Math.ceil(Math.max(...ys)) + pad - y0 + 1;
  const cv = canvas(w, h);
  const end = pts[pts.length - 1]!;
  // Distance along the limb from its end, for the icing cuff.
  const segLen = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p: Pt = [x0 + x + 0.5, y0 + y + 0.5];
      let best = { d: Infinity, nx: 0, ny: 0, fromEnd: 0 };
      for (let i = 0; i + 1 < pts.length; i++) {
        const n = nearest(p, pts[i]!, pts[i + 1]!);
        if (n.d < best.d) best = { d: n.d, nx: n.nx, ny: n.ny, fromEnd: segLen.slice(i + 1).reduce((s, l) => s + l, 0) + (1 - n.t) * segLen[i]! };
      }
      const de = Math.hypot(p[0] - end[0], p[1] - end[1]);
      const inLimb = best.d <= r;
      const inEnd = de <= endR;
      if (!inLimb && !inEnd) continue;
      const [nx, ny, rr] = inEnd && de < best.d + 0.8 ? [p[0] - end[0], p[1] - end[1], endR] : [best.nx, best.ny, r];
      const light = 0.62 - 0.42 * (nx / rr) - 0.5 * (ny / rr);
      cv[y]![x] = "dcCh"[Math.max(0, Math.min(3, Math.floor(light * 4)))]!;
      // The cuff: a zigzag band of icing across the limb, `cuff` pixels from its end.
      const across = Math.round(nx * 1.3 + ny * 1.3);
      if (cuff > 0 && Math.abs(best.fromEnd - cuff - (across & 1) * 0.9) < 0.55 && best.d <= r) cv[y]![x] = nx + ny < 0 ? "w" : "W";
    }
  return { part: { grid: toGrid(cv) }, at: [x0, y0] };
}

// ---- The candy cane: a striped stroke from its tip, through the grip, up to a hook.

type CaneLook = { part: Part; glow: Part; at: Pt; tip: Pt; hookTop: Pt };

/**
 * The cane held at `grip`: `dir` points from the grip towards the hook end, `up` pixels to where the hook starts,
 * `down` pixels the other way to the tip. The hook curls round to the left of `dir` (`curl` -1 for the right).
 */
function paintCane(grip: Pt, dir: Pt, up: number, down: number, curl: 1 | -1 = 1): CaneLook {
  const n = Math.hypot(dir[0], dir[1]);
  const ux = dir[0] / n;
  const uy = dir[1] / n;
  // The left of dir (screen coordinates, y down): (uy, -ux).
  const lx = uy * curl;
  const ly = -ux * curl;
  const R = 4.2;
  const path: { p: Pt; s: number }[] = [];
  let s = 0;
  const push = (p: Pt) => {
    const last = path[path.length - 1];
    if (last) s += Math.hypot(p[0] - last.p[0], p[1] - last.p[1]);
    path.push({ p, s });
  };
  for (let t = -down; t <= up; t += 0.25) push([grip[0] + ux * t, grip[1] + uy * t]);
  const top: Pt = [grip[0] + ux * up, grip[1] + uy * up];
  const centre: Pt = [top[0] + lx * R, top[1] + ly * R];
  // Half a turn round the centre, from the shaft's top over to the other side, then a short tail down.
  for (let a = 0; a <= Math.PI; a += 0.06) {
    const c = Math.cos(a);
    const sn = Math.sin(a);
    push([centre[0] - lx * R * c + ux * R * sn, centre[1] - ly * R * c + uy * R * sn]);
  }
  const tail: Pt = [centre[0] + lx * R, centre[1] + ly * R];
  for (let t = 0; t <= 2.5; t += 0.25) push([tail[0] - ux * t, tail[1] - uy * t]);
  const xs = path.map((q) => q.p[0]);
  const ys = path.map((q) => q.p[1]);
  const x0 = Math.floor(Math.min(...xs)) - 3;
  const y0 = Math.floor(Math.min(...ys)) - 3;
  const w = Math.ceil(Math.max(...xs)) + 4 - x0;
  const h = Math.ceil(Math.max(...ys)) + 4 - y0;
  const cv = canvas(w, h);
  const glow = canvas(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const px = x0 + x + 0.5;
      const py = y0 + y + 0.5;
      let best = Infinity;
      let at = path[0]!;
      for (const q of path) {
        const d = (q.p[0] - px) ** 2 + (q.p[1] - py) ** 2;
        if (d < best) {
          best = d;
          at = q;
        }
      }
      const d = Math.sqrt(best);
      if (d <= 3.4) glow[y]![x] = "i";
      if (d > 1.95) continue;
      // Diagonal stripes: by distance along the cane, slanted by the side of it the pixel is on.
      const side = (px - at.p[0]) * -uy + (py - at.p[1]) * ux;
      const red = Math.floor((at.s + side * 1.2) / 3.2) % 2 === 0;
      const lit = (px - at.p[0]) * -0.6 + (py - at.p[1]) * -0.8 > 0.35;
      cv[y]![x] = red ? (lit ? "s" : "S") : lit ? "v" : "V";
    }
  const tipP: Pt = [grip[0] - ux * down, grip[1] - uy * down];
  return { part: { grid: toGrid(cv) }, glow: { grid: toGrid(glow), outline: false }, at: [x0, y0], tip: tipP, hookTop: [centre[0] + ux * R, centre[1] + uy * R] };
}

// ---- Parts and poses.

const PARTS: Record<string, Part> = { torso, bowTie, shadow };
const MOODS: readonly Mood[] = ["angry", "laugh", "shout", "hurt", "smug", "rattled", "think", "out"];
for (const m of MOODS) for (const c of [0, 1, 2]) PARTS[`head:${m}:${c}`] = head(m, c);

const LIMBS = new Map<string, Painted>();
function limb(kind: "arm" | "leg", pts: readonly Pt[]): { name: string; at: Pt } {
  const name = `${kind}:${pts.map((p) => p.join(",")).join(";")}`;
  let l = LIMBS.get(name);
  if (!l) {
    l = kind === "arm" ? paintLimb(pts, 3.5, 3.6, 4.2) : paintLimb(pts, 4.5, 3.4, 4.6);
    LIMBS.set(name, l);
    PARTS[name] = l.part;
  }
  return { name, at: l.at };
}
const CANES = new Map<string, CaneLook>();
function cane(c: CaneSpec): { name: string; glow: string; look: CaneLook } {
  const name = `cane:${c.grip.join(",")}:${c.dir.join(",")}:${c.up}:${c.down}:${c.curl ?? 1}`;
  let look = CANES.get(name);
  if (!look) {
    look = paintCane(c.grip, c.dir, c.up, c.down, c.curl ?? 1);
    CANES.set(name, look);
    PARTS[name] = look.part;
    PARTS[`glow:${name}`] = look.glow;
  }
  return { name, glow: `glow:${name}`, look };
}

interface CaneSpec {
  grip: Pt;
  dir: Pt;
  up: number;
  down: number;
  curl?: 1 | -1;
  /** The cane arm's elbow (none: a straight arm). */
  elbow?: Pt;
  /** Drawn in front of his body (held across him). */
  front?: boolean;
}

/** Where he holds the cane, in his drawing space (50 x 58, the ground at y 58). */
export type CanePose = "rest" | "lift" | "raise" | "overhead" | "aim" | "thrust";
const CANE: Record<CanePose, CaneSpec> = {
  rest: { grip: [11, 37], dir: [-0.12, -1], up: 30, down: 20 },
  lift: { grip: [11, 34], dir: [-0.12, -1], up: 30, down: 20 },
  raise: { grip: [14, 17], dir: [0.2, -1], up: 13, down: 15, elbow: [15, 25] },
  overhead: { grip: [13, 7], dir: [0.06, -1], up: 15, down: 10, elbow: [15, 18] },
  aim: { grip: [14, 36], dir: [-1, -0.28], up: 6, down: 30, curl: -1, front: true },
  thrust: { grip: [18, 35], dir: [-1, -0.28], up: 6, down: 30, curl: -1, front: true },
};
const SHOULDER_L: Pt = [21, 26];
const SHOULDER_R: Pt = [37, 26];

/** The free arm (his left, on our right). */
export type FreePose = "hip" | "chin" | "up" | "out" | "point";
const FREE: Record<FreePose, { pts: Pt[]; front?: boolean }> = {
  hip: { pts: [SHOULDER_R, [45, 31], [42, 38]] },
  chin: { pts: [SHOULDER_R, [41, 33], [33, 25]], front: true },
  up: { pts: [SHOULDER_R, [42, 20], [41, 12]] },
  out: { pts: [SHOULDER_R, [44, 25], [47, 19]] },
  point: { pts: [SHOULDER_R, [42, 28], [47, 28]] },
};

export type Feet = "stand" | "wide" | "tap" | "step";
const FEET: Record<Feet, [Pt, Pt]> = {
  stand: [[19, 53], [39, 53]],
  wide: [[17, 53], [41, 53]],
  tap: [[19, 53], [40, 51]],
  step: [[19, 53], [41, 49]],
};

/** Where his own drawing space (50 x 58, the ground at y 58) sits on the frame. */
const OX = 14;
const OY = 30;
const GROUND = 58;

export interface GingerPose {
  /** Off the ground (a jump), the whole of him. */
  air?: number;
  /** Down at the hips, feet planted (a landing, bracing). */
  crouch?: number;
  /** Head, body and arms down a pixel (a breath). */
  bob?: number;
  /** Sideways, the whole of him. */
  dx?: number;
  mood?: Mood;
  headDx?: number;
  headDy?: number;
  cane?: CanePose;
  free?: FreePose;
  feet?: Feet;
  /** The cane glows ice-blue (casting). */
  glow?: boolean;
  /** Cracks on his head, 0 to 2. */
  cracks?: number;
}

export function gingerLayers(p: GingerPose): Layer[] {
  const dx = p.dx ?? 0;
  const air = p.air ?? 0;
  const crouch = p.crouch ?? 0;
  const body = crouch + (p.bob ?? 0) - air; // head, torso and arms
  const hips = crouch - air;
  const at = (part: string, x: number, y: number, extra: Partial<Layer> = {}): Layer => ({ part, x: OX + x + dx, y: OY + y, ...extra });
  const down = (pts: readonly Pt[]): Pt[] => pts.map((q): Pt => [q[0], q[1] + body]);
  const [footL, footR] = FEET[p.feet ?? "stand"];
  const legL = limb("leg", [[24, 39 + hips], [footL[0], footL[1] - air]]);
  const legR = limb("leg", [[34, 39 + hips], [footR[0], footR[1] - air]]);
  const c = CANE[p.cane ?? "rest"];
  const caneGrip = gripOf(p);
  const cn = cane({ ...c, grip: caneGrip });
  const armL = limb("arm", c.elbow ? [[SHOULDER_L[0], SHOULDER_L[1] + body], [c.elbow[0], c.elbow[1] + body], caneGrip] : [[SHOULDER_L[0], SHOULDER_L[1] + body], caneGrip]);
  const fr = FREE[p.free ?? "hip"];
  const armR = limb("arm", down(fr.pts));
  const hx = p.headDx ?? 0;
  const hy = body + (p.headDy ?? 0);
  const L = (l: { name: string; at: Pt }) => at(l.name, l.at[0], l.at[1]);
  const caneLayers = [...(p.glow ? [at(cn.glow, cn.look.at[0], cn.look.at[1])] : []), at(cn.name, cn.look.at[0], cn.look.at[1])];
  return [
    at("shadow", 13, GROUND - 2),
    ...(c.front ? [] : caneLayers),
    L(legL),
    L(legR),
    ...(fr.front ? [] : [L(armR)]),
    at("torso", 18, 21 + body),
    at(`head:${p.mood ?? "angry"}:${p.cracks ?? 0}`, 18 + hx, 3 + hy),
    at("bowTie", 24 + Math.round(hx / 2), 21 + body),
    ...(c.front ? caneLayers : []),
    L(armL),
    ...(fr.front ? [L(armR)] : []),
  ];
}

/** The cane's grip in a pose: it moves with his body, except when the cane stands on the ground (its tip stays put). */
function gripOf(p: GingerPose): Pt {
  const c = CANE[p.cane ?? "rest"];
  const grounded = (p.cane ?? "rest") === "rest" || p.cane === "lift";
  const dy = grounded ? -(p.air ?? 0) : (p.crouch ?? 0) + (p.bob ?? 0) - (p.air ?? 0);
  return [c.grip[0], c.grip[1] + dy];
}

/** Where the cane's tip is in a pose, in frame pixels (his bolt leaves from there). */
export function caneTip(p: GingerPose): Pt {
  const c = CANE[p.cane ?? "rest"];
  const look = cane({ ...c, grip: gripOf(p) }).look;
  return [Math.round(OX + look.tip[0] + (p.dx ?? 0)), Math.round(OY + look.tip[1])];
}

// ---- Effects drawn on his frames: frost sparkles, snow, his bolt, crumbs.

const pose = gingerLayers;
const f = (ms: number, p: GingerPose, extra: Partial<Frame> = {}): Frame => ({ ms, layers: pose(p), ...extra });

/** A four-point frost sparkle: a white core and ice-blue rays. */
const sparkle = (x: number, y: number, big = false): Speck[] => [
  [x, y, "F"],
  [x - 1, y, "I"],
  [x + 1, y, "I"],
  [x, y - 1, "I"],
  [x, y + 1, "I"],
  ...(big ? ([[x - 2, y, "f"], [x + 2, y, "f"], [x, y - 2, "f"], [x, y + 2, "f"]] as Speck[]) : []),
];
/** Icing spots on him where a frost glint can catch (head trim, belt, cuffs), in frame pixels at rest. */
const GLINTS: readonly Pt[] = [[OX + 23, OY + 6], [OX + 33, OY + 7], [OX + 25, OY + 36], [OX + 34, OY + 36], [OX + 20, OY + 50], [OX + 38, OY + 50]];

/** A ring of snowflakes round him, turning (`turn` 0-1) at radius `r` about his middle. */
const swirl = (turn: number, r: number, n = 10, cy = 28): Speck[] =>
  Array.from({ length: n }, (_, i): Speck[] => {
    const a = (i / n + turn) * Math.PI * 2;
    const x = Math.round(OX + 28 + Math.cos(a) * r * 1.25);
    const y = Math.round(OY + cy + Math.sin(a) * r * 0.75);
    return i % 3 === 0 ? sparkle(x, y) : [[x, y, "F"], [x + 1, y + 1, i % 2 ? "I" : "J"]];
  }).flat();

/** Snow falling, seeded by frame. */
const snow = (i: number, n = 14): Speck[] =>
  Array.from({ length: n }, (_, k): Speck => {
    const x = (k * 41 + 7 + Math.round(Math.sin(i * 0.7 + k) * 2)) % 80;
    const y = ((k * 29 + i * 4) % 84) + 2;
    return [x + 2, y, k % 3 ? "F" : "I"];
  }).flatMap((sp, k): Speck[] => (k % 3 ? [sp, [sp[0] + 1, sp[1] + 1, "I"]] : [sp]));

/** A burst of frost round a point (the cane's tip on the ground, a slam). */
const frostBurst = ([x, y]: Pt, r: number): Speck[] =>
  Array.from({ length: 8 }, (_, i): Speck[] => {
    const a = (i / 8) * Math.PI * 2;
    const px = Math.round(x + Math.cos(a) * r * 1.4);
    const py = Math.min(y + 1, Math.round(y + Math.sin(a) * r * 0.6) - 1);
    return i % 2 ? [[px, py, "I"]] : sparkle(px, py);
  }).flat();

/** Crumbs knocked off his head, flying out and falling (`t` frames after the hit). */
const crumbs = (t: number, [x, y]: Pt = [OX + 30, OY + 6]): Speck[] =>
  [[-1, -1], [1, -1.4], [1.6, -0.6], [-1.7, -0.5], [0.5, -1.8]].flatMap(([vx, vy], i): Speck[] => {
    const px = Math.round(x + vx! * t * 2.2);
    const py = Math.round(y + vy! * t * 2.2 + 0.5 * t * t);
    return [[px, py, i % 2 ? "C" : "c"], [px + 1, py, "d"]];
  });

/** His ice bolt: a bright shard pointing right, with a trail of sparkles behind (`x`, `y` its tip). */
const bolt = (x: number, y: number, trail = 3): Speck[] => {
  const out: Speck[] = [];
  const rows = ["......iii....", "...JIIiiiFF..", "kJJIIiiFFFFFF", "...JIIiiiFF..", "......iii...."];
  rows.forEach((row, r) =>
    [...row].forEach((k, c) => {
      if (k !== ".") out.push([x - row.length + c + 1, y - 2 + r, k]);
    }),
  );
  for (let t = 1; t <= trail; t++) out.push([x - 13 - t * 2, y + (t % 2 ? -1 : 1), t === 1 ? "i" : "f"]);
  return out;
};

const ICY_EYES = { e: "#9ff0ff", E: "#ffffff" };
const GLOW_PULSE = { s: "#7fe0ff", S: "#2f9be0", v: "#f0fdff", V: "#b5ecff" };
const GLOW_HALF = { v: "#dff6ff", V: "#9fd8f5" };
const GLOW_BRIGHT = { s: "#b5f0ff", S: "#5cc8ff", v: "#ffffff", V: "#dff6ff" };
/** A white flash for the frame he's hit. */
const FLASH: Record<string, string> = { d: "#c98a5a", c: "#f0c49a", C: "#ffe2c4", h: "#ffffff" };

/** Breathing: [bob] per frame, a slow in and out. */
const BREATH = [0, 0, 0, 1, 1, 1, 0, 0] as const;

/**
 * Idle: he breathes, glowering, and a frost glint runs round his icing; every 6 s or so he thumps his cane on the
 * ground in a puff of frost. Silent.
 */
const idle: Anim = {
  loop: true,
  frames: [
    ...Array.from({ length: 5 }, (_, n) => BREATH.map((bob, i) => f(130, { bob }, { specks: i === 3 || i === 4 ? sparkle(...GLINTS[(n * 2 + (i - 3)) % GLINTS.length]!, i === 3) : undefined }))).flat(),
    f(110, { cane: "lift", crouch: 1 }),
    f(90, { cane: "lift", crouch: 1, mood: "shout" }),
    f(90, { cane: "rest" }, { specks: frostBurst([OX + 10, OY + GROUND - 1], 2), shake: [0, 1] }),
    f(110, { cane: "rest" }, { specks: frostBurst([OX + 10, OY + GROUND - 1], 4) }),
    f(130, { cane: "rest" }, { specks: frostBurst([OX + 10, OY + GROUND - 2], 5).filter((_, i) => i % 2 === 0) }),
    f(200, {}),
  ],
};

/** Snowflake thought dots popping up beside his head, one by one. */
const thoughtFlakes = (n: number): Speck[] =>
  [[OX + 43, OY + 8], [OX + 48, OY + 3], [OX + 54, OY - 2]].slice(0, n).flatMap(([x, y], i) => (i === 2 ? sparkle(x!, y!, true) : sparkle(x!, y!)));
/** Thinking: a hand on his chin, eyes rolled up, tapping a foot, snowflakes for thoughts. */
const thinking: Anim = {
  loop: true,
  frames: [0, 1, 2, 3].flatMap((n) => [0, 1, 2, 3].map((i) => f(130, { mood: "think", free: "chin", feet: i % 2 ? "tap" : "stand", bob: i === 2 ? 1 : 0 }, { specks: thoughtFlakes(n) }))),
};

/** Smug: leaning on his cane, a brow up, a slow foot tap. */
const smug: Anim = {
  loop: true,
  frames: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => f(150, { mood: "smug", feet: i % 4 < 2 ? "tap" : "stand", bob: i % 4 === 1 ? 1 : 0, headDx: i < 4 ? 0 : 1 })),
};

/** His icing "sweating": drops running off his head. */
const drips = (i: number): Speck[] => {
  const t = i % 4;
  return [
    [OX + 19 - t, OY + 9 + t * 2, "W"],
    [OX + 19 - t, OY + 10 + t * 2, "I"],
    [OX + 39 + t, OY + 8 + t * 2, "W"],
    [OX + 39 + t, OY + 9 + t * 2, "I"],
  ];
};
/** Rattled: worried brows, wide eyes, his icing sweating, shaking where he stands. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(80, { mood: "rattled", dx: i % 2 ? 1 : -1, bob: i % 4 === 2 ? 1 : 0, free: "hip" }, { specks: drips(i) })),
};

/** His move: a stamp forward and a jab of the cane at the board. */
const move: Anim = {
  loop: false,
  frames: [
    f(100, { crouch: 1, cane: "lift" }),
    f(100, { feet: "step", cane: "aim" }),
    f(90, { crouch: 2, feet: "wide", cane: "thrust", free: "point", mood: "shout" }, { cue: "jingle", shake: [0, 1] }),
    f(130, { crouch: 1, feet: "wide", cane: "thrust", free: "point" }),
    f(160, { feet: "wide", cane: "aim", free: "point" }),
    f(110, { crouch: 1, cane: "lift" }),
    f(160, {}),
  ],
};

/** A capture: he cackles, shaking a fist in the air, bells jingling. */
const capture: Anim = {
  loop: false,
  frames: [
    f(90, { crouch: 1 }),
    ...Array.from({ length: 12 }, (_, i) =>
      f(80, { mood: "laugh", free: "up", headDy: i % 2 ? -1 : 0, dx: i % 2 ? 1 : -1, bob: i % 4 === 0 ? 1 : 0, air: i % 4 === 2 ? 2 : 0 }, i === 0 ? { cue: "jingle" } : {}),
    ),
    f(140, { mood: "smug" }),
  ],
};

/** Hurt: hit, crumbs fly off his head and a crack appears; he flinches, then glares. */
const hurt: Anim = {
  loop: false,
  frames: [
    f(70, { crouch: 3, mood: "hurt", cracks: 1, free: "out" }, { cue: "crunch", pal: FLASH, shake: [1, 0], specks: crumbs(0) }),
    f(80, { crouch: 3, mood: "hurt", cracks: 1, free: "out" }, { shake: [-1, 0], specks: crumbs(1) }),
    f(90, { crouch: 2, mood: "hurt", cracks: 1, free: "out", dx: -1 }, { specks: crumbs(2) }),
    f(90, { crouch: 1, mood: "rattled", cracks: 1, dx: -1 }, { specks: crumbs(3) }),
    f(110, { mood: "rattled", cracks: 1 }),
    f(120, { mood: "angry", cracks: 1, free: "up" }),
    f(120, { mood: "angry", cracks: 1, free: "up", bob: 1 }),
    f(160, { mood: "angry" }),
  ],
};

/** Check: he lunges with the cane like a sword, twice, frost sparking off its tip. */
const tipSpark = (p: GingerPose, big = true) => sparkle(...(caneTip(p).map((v, i) => v + (i === 0 ? 2 : 0)) as [number, number]), big);
const THRUST: GingerPose = { crouch: 2, feet: "wide", cane: "thrust", free: "up", mood: "shout", glow: true };
const AIM: GingerPose = { crouch: 1, feet: "wide", cane: "aim", free: "hip", mood: "angry" };
const check: Anim = {
  loop: false,
  frames: [
    f(100, AIM),
    f(110, THRUST, { cue: "crackle", pal: GLOW_PULSE, specks: tipSpark(THRUST) }),
    f(90, THRUST, { pal: GLOW_HALF, specks: tipSpark(THRUST, false) }),
    f(110, AIM),
    f(110, THRUST, { cue: "crackle", pal: GLOW_PULSE, specks: tipSpark(THRUST) }),
    f(90, THRUST, { pal: GLOW_HALF, specks: tipSpark(THRUST, false) }),
    f(150, { ...AIM, mood: "laugh" }),
    f(160, { mood: "smug" }),
  ],
};

/** Defeat: hit, cracked, he totters and topples over backwards; crumbs, then still (the last frame holds). */
function fallen(mood: Mood, extra: Speck[] = []): Partial<Frame> & { layers: Layer[] } {
  const standing = gingerLayers({ mood, cracks: 2, cane: "overhead", free: "up" }).filter((l) => !l.part.startsWith("cane:") && !l.part.startsWith("glow:") && l.part !== "shadow");
  // On his side, feet to the left and head to the right, his back on the ground, in the middle of the frame.
  const lying = lieDown(PARTS, { layers: standing }, 0, 0, "right").layers;
  const box = lying.map((l) => {
    const [w, h] = partSize(PARTS[l.part]!, l.rot ?? 0);
    return [l.x, l.y, l.x + w, l.y + h] as const;
  });
  const x0 = Math.min(...box.map((b) => b[0]));
  const x1 = Math.max(...box.map((b) => b[2]));
  const y1 = Math.max(...box.map((b) => b[3]));
  const sx = OX + 27 - Math.round((x0 + x1) / 2);
  const sy = OY + GROUND - 1 - y1;
  const caneDown = cane({ grip: [8, GROUND - 4], dir: [-1, 0], up: 2, down: 36, curl: -1 });
  return {
    layers: [
      { part: "shadow", x: OX + 11, y: OY + GROUND - 2 },
      { part: caneDown.name, x: OX + caneDown.look.at[0], y: OY + caneDown.look.at[1] },
      ...lying.map((l) => ({ ...l, x: l.x + sx, y: l.y + sy })),
    ],
    specks: extra,
  };
}
/** Where his head lands when he falls, in frame pixels (for the crumbs). */
const FALLEN_HEAD: Pt = [OX + 46, OY + GROUND - 16];
const defeat: Anim = {
  loop: false,
  frames: [
    f(80, { crouch: 3, mood: "hurt", cracks: 1, free: "out" }, { cue: "crunch", pal: FLASH, shake: [1, 0], specks: crumbs(0) }),
    f(90, { crouch: 2, mood: "hurt", cracks: 2, free: "out", dx: -1 }, { specks: crumbs(1) }),
    f(110, { crouch: 1, mood: "out", cracks: 2, dx: 1 }, { specks: crumbs(2) }),
    f(110, { crouch: 2, mood: "out", cracks: 2, dx: 2, free: "out" }, { specks: crumbs(3) }),
    { ms: 120, cue: "crunch", shake: [0, 1], ...fallen("hurt", crumbs(1, FALLEN_HEAD)) },
    { ms: 120, ...fallen("out", crumbs(2, FALLEN_HEAD)) },
    { ms: 160, ...fallen("out", crumbs(3, FALLEN_HEAD)) },
    { ms: 1000, ...fallen("out") },
  ],
};

/** Victory: the cane raised high, a fist up, jumping for joy in the snow; bells. Then again. */
const victory: Anim = {
  loop: true,
  frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => {
    const air = [0, 2, 5, 6, 5, 2, 0, 0, 0, 0, 0, 0][i]!;
    return f(110, { mood: "laugh", cane: "overhead", free: "up", air, crouch: i === 0 || i === 6 ? 2 : 0, feet: air > 3 ? "wide" : "stand", headDy: i % 2 ? -1 : 0 }, { specks: snow(i), cue: i === 2 ? "jingle" : undefined, pal: air > 4 ? GLOW_HALF : undefined });
  }),
};

/** Entrance: a whirl of snow, he drops into it, slams his cane down in a burst of frost and glares. */
const entrance: Anim = {
  loop: false,
  frames: [
    { ms: 100, layers: [], specks: swirl(0, 8, 8), cue: "jingle" },
    { ms: 100, layers: [], specks: swirl(0.12, 14, 10) },
    f(90, { air: 18, feet: "wide", free: "up" }, { specks: swirl(0.24, 20, 12) }),
    f(90, { air: 8, feet: "wide", free: "up" }, { specks: swirl(0.36, 24, 12) }),
    f(100, { crouch: 3, feet: "wide" }, { shake: [0, 1], specks: frostBurst([OX + 28, OY + GROUND - 1], 6) }),
    f(100, { crouch: 1, feet: "wide" }),
    f(120, { cane: "raise", glow: true, mood: "shout" }, { pal: GLOW_HALF }),
    f(120, { cane: "raise", glow: true, mood: "shout" }, { pal: { ...GLOW_PULSE, ...ICY_EYES } }),
    f(90, { crouch: 2, cane: "rest" }, { cue: "crackle", shake: [0, 1], specks: frostBurst([OX + 10, OY + GROUND - 1], 3) }),
    f(110, { crouch: 1, cane: "rest" }, { specks: frostBurst([OX + 10, OY + GROUND - 1], 6) }),
    f(140, {}, { specks: sparkle(...GLINTS[0]!, true) }),
    f(320, {}),
  ],
};

/**
 * His passive power, freezing a piece: he raises the cane, it glows ice-blue, his eyes go icy, he points it two-handed
 * and an ice bolt flies from its tip (the frame with the "freeze" cue: the bolt leaves him there, and the board's
 * bolt takes over).
 */
const RAISE: GingerPose = { crouch: 1, cane: "raise", glow: true, mood: "shout" };
const CAST: GingerPose = { crouch: 2, feet: "wide", cane: "thrust", free: "up", glow: true, mood: "shout" };
const castTip = caneTip(CAST);
/** Frost gathering round the cane's hook as he charges it. */
const gather = (n: number): Speck[] => {
  const [hx, hy] = [OX + 12, OY + 4];
  return Array.from({ length: 6 }, (_, i): Speck => {
    const a = (i / 6) * Math.PI * 2 + n;
    const r = 9 - n * 2.5;
    return [Math.round(hx + Math.cos(a) * r), Math.round(hy + Math.sin(a) * r), i % 2 ? "F" : "I"];
  });
};
const freezeCast: Anim = {
  loop: false,
  frames: [
    f(110, { crouch: 1, cane: "lift" }),
    f(110, RAISE, { pal: GLOW_HALF, specks: gather(0) }),
    f(110, RAISE, { pal: { ...GLOW_PULSE, ...ICY_EYES }, specks: gather(1) }),
    f(110, RAISE, { pal: { ...GLOW_PULSE, ...ICY_EYES }, specks: [...gather(2), ...sparkle(OX + 12, OY + 4, true)] }),
    f(80, CAST, { cue: "freeze", pal: { ...GLOW_PULSE, ...ICY_EYES }, specks: sparkle(castTip[0] + 2, castTip[1], true), shake: [-1, 0] }),
    f(70, CAST, { pal: { ...GLOW_PULSE, ...ICY_EYES }, specks: bolt(castTip[0] + 12, castTip[1], 1) }),
    f(70, { ...CAST, dx: -1 }, { pal: GLOW_PULSE, specks: bolt(castTip[0] + 18, castTip[1], 3) }),
    f(90, { ...CAST, dx: -1, mood: "laugh" }, { pal: GLOW_HALF, specks: [[castTip[0] + 12, castTip[1] - 1, "I"], [castTip[0] + 16, castTip[1] + 1, "J"]] }),
    f(140, { ...CAST, glow: false, mood: "laugh", crouch: 1 }),
    f(140, { crouch: 1, cane: "lift", mood: "smug" }),
    f(160, { mood: "smug" }),
  ],
};

/**
 * His ultimate, the blizzard: the cane raised high and glowing, a fist up, he calls the storm; snow whirls round him,
 * faster and wider, until it bursts outwards (the frame with the "blizzard" cue: start the board's blizzard sweep
 * there). Then he cackles.
 */
const STORM: GingerPose = { cane: "overhead", free: "up", glow: true, mood: "shout", feet: "wide" };
const blizzard: Anim = {
  loop: false,
  frames: [
    f(110, { crouch: 2, cane: "lift", feet: "wide", mood: "shout" }, { cue: "jingle" }),
    f(110, { ...RAISE, feet: "wide" }, { pal: GLOW_HALF, specks: swirl(0, 12, 8) }),
    ...Array.from({ length: 7 }, (_, i) =>
      f(100, { ...STORM, crouch: i % 2, headDy: i % 2 ? 0 : -1 }, { pal: i % 2 ? { ...GLOW_BRIGHT, ...ICY_EYES } : { ...GLOW_PULSE, ...ICY_EYES }, specks: [...swirl(0.1 + i * 0.09, 14 + i * 1.5, 10 + i), ...snow(i, 6 + i)], shake: i >= 5 ? [i % 2 ? 1 : -1, 0] : undefined }),
    ),
    f(110, { ...STORM, crouch: 1 }, { cue: "blizzard", pal: { ...GLOW_PULSE, ...ICY_EYES, w: "#ffffff", W: "#e6f8ff" }, specks: [...swirl(0.8, 26, 16), ...sparkle(OX + 14, OY - 12, true)], shake: [0, 1] }),
    f(110, { ...STORM, mood: "laugh" }, { pal: GLOW_PULSE, specks: [...swirl(0.9, 30, 12), ...snow(9, 16)] }),
    f(120, { ...STORM, mood: "laugh", headDy: -1 }, { pal: GLOW_HALF, specks: snow(10, 18) }),
    f(120, { ...STORM, mood: "laugh", glow: false }, { specks: snow(11, 14) }),
    f(140, { crouch: 1, cane: "lift", mood: "smug" }, { specks: snow(12, 8) }),
    f(200, { mood: "smug" }),
  ],
};

export const GINGERBREAD: Character = {
  id: "gingerbread",
  name: "Ginger Snap",
  w: OX + 50 + 20,
  h: OY + GROUND + 5,
  foot: [OX + 29, OY + GROUND],
  palette: GINGER_PALETTE,
  halo: "#2c2622",
  parts: PARTS,
  anims: { idle, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory, freezeCast, blizzard },
};

/** The part of him a portrait shows (head, bow tie and the cane's hook), in frame pixels. */
export const GINGER_PORTRAIT = { x: OX + 8, y: OY, w: 40, h: 30 } as const;

/**
 * His lines: short, cold and cross, never instructions, rare (each moment's chance of a line is in GINGER_CHANCE).
 * `power` is a piece frozen, `ultimateWarn` the blizzard coming, `ultimate` the blizzard itself.
 */
export const GINGER_LINES: Partial<Record<import("./boss-beats.ts").Beat, readonly string[]>> = {
  entrance: ["Ginger Snap is here!", "You'll crumble!", "Fresh out of the freezer!"],
  move: ["Snap!", "Hmph!", "Out of my way!", "Cold move. Colder heart."],
  capture: ["Crumbs to crumbs!", "Into the cookie jar!", "Snapped it up!", "That one's iced!"],
  check: ["Check! Feeling a chill?", "Your king's on thin ice!", "Snap! Check!"],
  hurt: ["My icing!", "Ow! I'm cracking!", "You'll pay for that crumb!"],
  thinking: ["Sugar and spite…", "Let it simmer…", "Cooling down… not."],
  smug: ["Half-baked, all of you!", "Stale! So stale!", "Cool as ice."],
  rattled: ["My gumdrops are sweating!", "Stop! I'll melt!", "Not my icing!"],
  defeat: ["I… crumble…", "Oh, snap…", "Back to the oven…"],
  victory: ["Snap! I win!", "Sweet, sweet victory!", "Iced you all! Ha!"],
  strike: ["Snap! You're done!", "Crumbled!"],
  power: ["Freeze!", "Chill out!", "Stay frosty!", "On ice you go!", "Cold feet?"],
  ultimateWarn: ["A storm is brewing…", "Feel that chill?", "Wrap up warm…", "The frost is coming…"],
  ultimate: ["BLIZZARD!", "Let it snow!", "Freeze, all of you!", "Snow day! Ha!"],
};
export const GINGER_CHANCE: Partial<Record<import("./boss-beats.ts").Beat, number>> = {
  entrance: 1,
  move: 0.12,
  capture: 0.6,
  check: 0.75,
  hurt: 0.6,
  thinking: 0.08,
  smug: 0.8,
  rattled: 0.8,
  defeat: 1,
  victory: 1,
  strike: 0.8,
  power: 0.5,
  ultimateWarn: 1,
  ultimate: 1,
};
