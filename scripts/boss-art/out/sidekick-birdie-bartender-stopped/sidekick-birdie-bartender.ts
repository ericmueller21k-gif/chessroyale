/**
 * Birdie's bartender (id "sidekick-birdie-bartender"): the friendly grey pigeon who runs the little bar in Birdie's
 * station lobby and minds the shop. Third pass: no glass, no towel; he scoops birdseed from the big vat beside him (a
 * piece of the room, to his left/back) and tips it into a feeder on the counter in front of him (to his right).
 *
 * A grey pigeon in a red vest over a white apron, a little dark bow tie, a green-violet sheen on his neck, a dark beak
 * with a pale cere, red-orange feet. Three-quarters, facing our right, light from the top left.
 *
 * He stands behind the counter (31 px tall): the counter's top is frame row 27, so everything he does with the scoop
 * stays above it. Rig: the head (per mood, look and beak tilt), the body, neck and tail are painted once; the near wing
 * is painted from shoulder, elbow and tip per pose; the scoop is painted at an angle and held at the wing's tip.
 */
import { canvas, poly, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../../../packages/app/src/characters/sprite.ts";

const PALETTE = {
  k: "#0e1014", // outline
  a: "#3a3f4b", // pigeon greys, dark to light
  b: "#565d6c",
  c: "#7a8292",
  d: "#9fa7b5",
  e: "#c6ccd6",
  g: "#2c7656", // neck sheen: greens and violets
  G: "#4cae7e",
  v: "#5a3f8e",
  V: "#8a6cc8",
  B: "#2e2a30", // beak, its top light, the cere
  n: "#5c5358",
  W: "#e9e4da",
  x: "#0b0b0e", // pupils
  w: "#ffffff", // eye whites, glints
  p: "#e7959c", // blush, inside the beak
  R: "#7a1a1f", // the vest, dark to light
  r: "#a8282a",
  Q: "#cf3d34",
  q: "#e8664f",
  y: "#f2c14e", // gold buttons, sparkles
  Y: "#b4840f",
  "1": "#bdb19e", // the apron, shade to light
  "2": "#ddd5c4",
  "3": "#f6f1e6",
  t: "#1c1e26", // the bow tie and its sheen
  T: "#565c70",
  f: "#b8381c", // feet
  F: "#ee6a34",
  m: "#6d7c8c", // the scoop's metal (a bright steel), dark to light, and its inside
  M: "#b4c3d1",
  L: "#eaf2f8",
  i: "#2a3340",
  u: "#7c4e2a", // its wooden handle
  U: "#b07a45",
  s: "#d6ad55", // birdseed
  S: "#9c7230",
  o: "#f1d58c",
  h: "#e8667a", // a heart
  j: "#9fd8ff", // sweat
  z: "#0d0e12", // ground shadow
} as const;

type Pt = readonly [number, number];
const W = 52;
const H = 60;
const GROUND = 58;
/** The bar counter's top row in his frame (31 px above the ground): the scoop always stays above it. */
const COUNTER = 27;

const PARTS: Record<string, Part> = {};
const AT = new Map<string, Pt>();
function crop(cv: Canvas): { grid: string[]; at: Pt } {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  cv.forEach((row, y) => row.forEach((k, x) => {
    if (k === ".") return;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }));
  if (x1 < 0) return { grid: ["."], at: [0, 0] };
  return { grid: cv.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1).join("")), at: [x0, y0] };
}
/** A part painted once by name on a canvas; returns the name and where its top-left sits on that canvas. */
function painted(name: string, make: () => Canvas): { name: string; at: Pt } {
  if (!PARTS[name]) {
    const c = crop(make());
    PARTS[name] = { grid: c.grid };
    AT.set(name, c.at);
  }
  return { name, at: AT.get(name)! };
}

const ell = (cx: number, cy: number, rx: number, ry: number) => (x: number, y: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const roundL = (cx: number, cy: number, rx: number, ry: number, bias = 0) => (x: number, y: number) => 0.52 + bias - 0.45 * ((x - cx) / rx) - 0.55 * ((y - cy) / ry);
const grey = (l: number) => (l < 0.18 ? "a" : l < 0.4 ? "b" : l < 0.68 ? "c" : l < 0.9 ? "d" : "e");
const red = (l: number) => (l < 0.25 ? "R" : l < 0.5 ? "r" : l < 0.8 ? "Q" : "q");
const cream = (l: number) => (l < 0.35 ? "1" : l < 0.72 ? "2" : "3");
function fill(cv: Canvas, inside: (x: number, y: number) => boolean, color: (x: number, y: number) => string): void {
  for (let y = 0; y < cv.length; y++) for (let x = 0; x < cv[0]!.length; x++) if (inside(x, y)) cv[y]![x] = color(x, y);
}
function stamp(cv: Canvas, rows: readonly string[], x0: number, y0: number): void {
  rows.forEach((row, y) => [...row].forEach((k, i) => {
    if (k !== "." && cv[y0 + y]?.[x0 + i] !== undefined) cv[y0 + y]![x0 + i] = k;
  }));
}
const dots = (cv: Canvas, pts: readonly Pt[], k: string) => pts.forEach(([x, y]) => cv[y]?.[x] !== undefined && (cv[y]![x] = k));

// ---- The head: a round grey head, a big white eye near the beak, the dark beak with its pale cere.

type Mood = "calm" | "half" | "blink" | "happy" | "cheer" | "think" | "smug" | "rattled" | "hurt" | "out" | "bold";
type Look = "fwd" | "down" | "back" | "up";
type Eye = "open" | "half" | "shut" | "arc" | "wide" | "pinch" | "x";
const FACES: Record<Mood, { eye: Eye; brow?: Pt[]; open?: boolean; blush?: boolean }> = {
  calm: { eye: "open", blush: true },
  half: { eye: "half", blush: true },
  blink: { eye: "shut", blush: true },
  happy: { eye: "arc", open: true, blush: true },
  cheer: { eye: "open", open: true, blush: true },
  think: { eye: "open", brow: [[11, 2], [12, 2], [13, 3]] },
  smug: { eye: "half", brow: [[10, 3], [11, 3], [12, 3], [13, 2]], blush: true },
  rattled: { eye: "wide", brow: [[10, 3], [11, 2], [12, 2], [13, 2]] },
  hurt: { eye: "pinch", brow: [[10, 2], [11, 3]] },
  out: { eye: "x" },
  bold: { eye: "open", open: true, brow: [[10, 2], [11, 2], [12, 3], [13, 3]], blush: true },
};
const PUPIL: Record<Look, Pt> = { fwd: [2, 1], down: [2, 2], back: [1, 1], up: [2, 1] };
function headPart(mood: Mood, look: Look, tip: number): string {
  const name = `head:${mood}:${look}:${tip}`;
  if (PARTS[name]) return name;
  const cv = canvas(25, 18);
  const skull = ell(9.5, 8.5, 8.4, 7.7);
  const L = roundL(8, 7, 9, 8, 0.06);
  fill(cv, skull, (x, y) => grey(L(x, y)));
  // A hint of the neck sheen under the cheek.
  dots(cv, [[6, 15], [7, 15], [8, 15]], "v");
  dots(cv, [[9, 15], [10, 15], [11, 15], [12, 14], [13, 14]], "g");
  // The beak: a dark wedge, its tip tilting down a pixel a step; the cere a pale bump at its base.
  const t = tip;
  const face = FACES[mood];
  if (face.open) {
    poly(cv, [[16, 7], [23.4, 8.2 + t], [23.2, 9.2 + t], [16, 9.8]], "B");
    poly(cv, [[16, 10.2], [21.4, 10.6 + t], [21.2, 11.6 + t], [16, 12]], "B");
    poly(cv, [[16.5, 9.8], [20.5, 9.8 + t], [20.5, 10.6 + t], [16.5, 10.2]], "p");
  } else {
    poly(cv, [[16, 7], [23.4, 8.3 + t], [23, 9.6 + t], [16, 11.2]], "B");
  }
  dots(cv, [[17, 7], [18, 7], [19, 8 + (t > 1 ? 1 : 0)], [20, 8 + (t > 0 ? 1 : 0)]], "n");
  dots(cv, [[16, 6], [17, 6], [16, 7]], "W");
  // The eye: a white ring-eyed look, 5 x 5 with its own dark rim, pupil by where he looks.
  const ex = 10;
  const ey = 4;
  const ring = [".kkk.", "kwwwk", "kwwwk", "kwwwk", ".kkk."];
  if (face.eye === "open" || face.eye === "wide" || face.eye === "half") {
    stamp(cv, ring, ex, ey);
    if (face.eye === "wide") cv[ey + 2]![ex + 2] = "x";
    else {
      const [px, py] = face.eye === "half" ? [2, 2] : look === "up" ? [2, 0] : PUPIL[look];
      const qx = Math.min(px, 2);
      stamp(cv, ["xx", "xx"], ex + qx, ey + Math.min(py, 2));
      cv[ey + Math.min(py, 2)]![ex + qx] = "x";
    }
    if (face.eye === "half") stamp(cv, [".kkk.", "kccck", "kkkkk"], ex, ey);
  } else if (face.eye === "shut") stamp(cv, [".....", ".....", "kkkkk", ".kkk."], ex, ey);
  else if (face.eye === "arc") stamp(cv, [".....", ".kkk.", "k...k", "....."], ex, ey);
  else if (face.eye === "pinch") stamp(cv, ["kk...", "..kk.", "....k", "..kk.", "kk..."], ex, ey);
  else if (face.eye === "x") stamp(cv, ["k...k", ".k.k.", "..k..", ".k.k.", "k...k"], ex, ey);
  if (face.blush) dots(cv, [[11, 11], [12, 11]], "p");
  if (face.brow) dots(cv, face.brow, "k");
  PARTS[name] = { grid: toGrid(cv) };
  return name;
}

// ---- Body, neck, bow tie, tail, feet.

const BODY = painted("body", () => {
  const cv = canvas(W, H);
  const lower = ell(24, 41.6, 12.5, 13.8);
  const upper = ell(26, 30.5, 9.6, 9.5);
  const inside = (x: number, y: number) => lower(x, y) || upper(x, y);
  // Round light: a sphere-ish normal from the body's middle, lit from the top left.
  const L = (x: number, y: number) => {
    const nx = (x - 25) / 14, ny = (y - 37) / 20;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    return 0.32 - 0.55 * nx - 0.45 * ny + 0.35 * nz;
  };
  const vestEnd = (x: number) => 44 + Math.max(0, Math.min(4, (x - 22) * 0.4));
  fill(cv, inside, (x, y) => (y < vestEnd(x) ? red(L(x, y)) : cream(L(x, y) + 0.15)));
  // The vest's lapel, its hem's shadow, gold buttons down the front.
  for (let y = 23; y <= 33; y++) cv[y]![Math.round(28 + (y - 23) * 0.35)] = "R";
  for (let x = 13; x < 37; x++) { const y = Math.floor(vestEnd(x)); if (inside(x, y)) cv[y]![x] = "1"; }
  dots(cv, [[32, 30], [33, 35], [33, 40]], "y");
  dots(cv, [[32, 31], [33, 36], [33, 41]], "Y");
  // Apron strings at the waist and a pocket line.
  dots(cv, [[14, 45], [15, 45], [16, 46]], "1");
  return cv;
});
const NECK = painted("neck", () => {
  const cv = canvas(W, H);
  const e = ell(26.5, 20, 7, 4);
  const L = roundL(25, 19, 8, 5, 0.05);
  fill(cv, e, (x, y) => (x < 25 ? (L(x, y) > 0.62 ? "V" : "v") : L(x, y) > 0.55 ? "G" : "g"));
  return cv;
});
PARTS["bow"] = { grid: ["Tt.Tt", "ttTtt", "tt.tt"] };
const TAIL = painted("tail", () => {
  const cv = canvas(W, H);
  poly(cv, [[16, 43], [12, 44], [3, 53], [5, 56], [10, 56], [19, 50]], "c");
  poly(cv, [[3, 53], [5, 56], [10, 56], [9, 54], [5, 52]], "a");
  for (let i = 0; i < 6; i++) cv[47 + i]![13 - i] = "b";
  return cv;
});
PARTS["foot:near"] = { grid: ["FFFf", "fFff"] };
PARTS["foot:far"] = { grid: ["Fff", "fff"] };
PARTS["shadow"] = { grid: [".zzzzzzzzzzzzzzzzzzz.", "zzzzzzzzzzzzzzzzzzzzz", ".zzzzzzzzzzzzzzzzzzz."], outline: false };

// ---- The near wing: a stroke from shoulder to elbow to tip, grey with two dark bars and dark primaries.

function nearestSeg(p: Pt, a: Pt, b: Pt) {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy || 1)));
  const nx = p[0] - (a[0] + t * vx), ny = p[1] - (a[1] + t * vy);
  return { d: Math.hypot(nx, ny), nx, ny, t };
}
function wingPart(pts: readonly Pt[]): { name: string; at: Pt } {
  const rs = [3.3, 2.7, 1.7];
  return painted(`wing:${pts.map((p) => p.join(",")).join(";")}`, () => {
    const cv = canvas(W + 10, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W + 10; x++) {
      let best = { s: 0, d: 1e9, rr: 1, nx: 0, ny: 0 };
      for (let i = 0; i + 1 < pts.length; i++) {
        const n = nearestSeg([x, y], pts[i]!, pts[i + 1]!);
        const rr = rs[i]! + (rs[i + 1]! - rs[i]!) * n.t;
        if (n.d - rr < best.d - best.rr) best = { s: (i + n.t) / (pts.length - 1), d: n.d, rr, nx: n.nx, ny: n.ny };
      }
      if (best.d > best.rr) continue;
      const l = 0.62 - 0.45 * (best.nx / best.rr) - 0.5 * (best.ny / best.rr);
      const bar = (best.s > 0.3 && best.s < 0.37) || (best.s > 0.46 && best.s < 0.53);
      cv[y]![x] = best.s > 0.8 ? (l > 0.6 ? "b" : "a") : bar ? "a" : grey(l);
    }
    return cv;
  });
}

// ---- The scoop: a metal cup on a short wooden handle, painted at an angle (degrees, 0 = cup to the grip's right,
// positive tips the cup down), mirrored to point left. `full`: 0 empty, 1 seed in its mouth, 2 heaped.

const SCOOP_LEN = 9;
function scoopPart(ang: number, mirror: boolean, full: number): { name: string; at: Pt } {
  return painted(`scoop:${ang}:${mirror ? 1 : 0}:${full}`, () => {
    const S = 31, G = 15;
    const cv = canvas(S, S);
    const th = (ang * Math.PI) / 180;
    const dx = Math.cos(th), dy = Math.sin(th), px = -Math.sin(th), py = Math.cos(th);
    const seed = (x: number, y: number) => ["o", "s", "s", "S", "s", "o", "S"][(x * 5 + y * 3) % 7]!;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const wx = (mirror ? -1 : 1) * (x - G), wy = y - G;
      const u = wx * dx + wy * dy, v = wx * px + wy * py;
      if (u >= -0.5 && u < 2.5 && Math.abs(v) <= 0.6) cv[y]![x] = v < 0 ? "U" : "u";
      else if (u >= 2.5 && u <= SCOOP_LEN && Math.abs(v) <= 3.1 && !(u < 4 && Math.abs(v) > 2.1)) {
        const mouth = u > SCOOP_LEN - 1.4 && Math.abs(v) < 2;
        cv[y]![x] = mouth ? (full ? seed(x, y) : "i") : v < -1.4 ? "L" : v > 1.6 ? "m" : u < 3.6 ? "L" : "M";
      } else if (full === 2 && u > 3.5 && u < SCOOP_LEN + 0.6 && v < -2.8 && ((u - 6.5) / 3.2) ** 2 + ((v + 2.8) / 2.2) ** 2 <= 1) cv[y]![x] = seed(x, y);
    }
    // Mark the grip so the part's offset can be found after cropping.
    const c = crop(cv);
    AT.set(`grip:${ang}:${mirror ? 1 : 0}:${full}`, [G - c.at[0], G - c.at[1]]);
    return cv;
  });
}
function scoopLayer(gx: number, gy: number, ang: number, mirror: boolean, full: number): Layer {
  const { name } = scoopPart(ang, mirror, full);
  const [ox, oy] = AT.get(`grip:${ang}:${mirror ? 1 : 0}:${full}`)!;
  return { part: name, x: gx - ox, y: gy - oy };
}
/** Where the scoop's mouth is, for the seed it pours. */
function mouthOf(gx: number, gy: number, ang: number): Pt {
  const th = (ang * Math.PI) / 180;
  return [Math.round(gx + Math.cos(th) * (SCOOP_LEN + 1)), Math.round(gy + Math.sin(th) * (SCOOP_LEN + 1))];
}

// ---- Poses.

type WingName = "rest" | "turn" | "reach" | "dip" | "lift" | "cross" | "carry" | "tilt" | "pour" | "pour2" | "set" | "low" | "up" | "waveL" | "waveM" | "waveR" | "chin" | "point" | "droop";
/** Each wing pose: elbow, tip (the grip), and the scoop held there: angle, mirrored. */
const SH: Pt = [19, 28];
const WINGS: Record<WingName, { e: Pt; t: Pt; ang: number; mir?: boolean }> = {
  rest: { e: [27, 30], t: [35, 24], ang: -12 },
  turn: { e: [19, 22], t: [21, 16], ang: -40, mir: true },
  reach: { e: [15, 23], t: [13, 18], ang: 15, mir: true },
  dip: { e: [16, 24], t: [15, 19], ang: 38, mir: true },
  lift: { e: [16, 22], t: [16, 16], ang: -15, mir: true },
  cross: { e: [24, 27], t: [30, 21], ang: -20 },
  carry: { e: [27, 28], t: [36, 20], ang: -6 },
  tilt: { e: [28, 27], t: [37, 18], ang: 18 },
  pour: { e: [30, 25], t: [39, 16], ang: 40 },
  pour2: { e: [30, 25], t: [39, 16], ang: 50 },
  set: { e: [27, 29], t: [35, 24], ang: 0 },
  low: { e: [24, 30], t: [29, 25], ang: -50 },
  up: { e: [17, 21], t: [13, 14], ang: -20, mir: true },
  waveL: { e: [15, 22], t: [10, 16], ang: -60, mir: true },
  waveM: { e: [16, 21], t: [12, 14], ang: -60, mir: true },
  waveR: { e: [17, 21], t: [15, 13], ang: -60, mir: true },
  chin: { e: [27, 29], t: [34, 22], ang: -30 },
  point: { e: [29, 25], t: [36, 21], ang: -4 },
  droop: { e: [25, 26], t: [31, 24], ang: 10 },
};

interface Pose {
  mood?: Mood;
  look?: Look;
  /** The beak's tip tilted down 0..2 px (his head tilt toward the feeder). */
  tip?: number;
  hx?: number;
  hy?: number;
  /** The whole upper body down (a breath, a nod, a slump), and sideways. */
  bob?: number;
  dx?: number;
  wing?: WingName;
  /** The scoop in the wing: 0 empty, 1 seed in the mouth, 2 heaped; null: not held (lying on the counter). */
  full?: number;
  free?: boolean;
  /** The scoop's angle, if not the wing pose's own. */
  ang?: number;
}

const DOWN_ON_COUNTER: Pt = [35, COUNTER - 4];

function build(p: Pose): Layer[] {
  const dx = p.dx ?? 0;
  const by = p.bob ?? 0;
  const layers: Layer[] = [];
  const put = (part: string, x: number, y: number) => layers.push({ part, x, y });
  const add = (q: { name: string; at: Pt }, ox = 0, oy = 0) => put(q.name, q.at[0] + ox, q.at[1] + oy);
  put("shadow", 14, GROUND - 2);
  add(TAIL, Math.max(0, dx), Math.min(by, 1));
  put("foot:far", 30, 55);
  add(BODY, dx, Math.min(by, 1));
  put("foot:near", 23, 55);
  add(NECK, dx, by);
  put("bow", 27 + dx, 20 + by);
  put(headPart(p.mood ?? "calm", p.look ?? "fwd", p.tip ?? 0), 17 + dx + (p.hx ?? 0), 3 + by + (p.hy ?? 0));
  const w = WINGS[p.wing ?? "rest"];
  const o = (q: Pt): Pt => [q[0] + dx, Math.min(q[1] + by, COUNTER - 2)];
  const grip = o(w.t);
  if (p.free) layers.push(scoopLayer(DOWN_ON_COUNTER[0], DOWN_ON_COUNTER[1], 0, false, 0));
  else layers.push(scoopLayer(grip[0], grip[1], p.ang ?? w.ang, w.mir ?? false, p.full ?? 0));
  add(wingPart([o(SH), o(w.e), grip]));
  return layers;
}

// ---- Effects.

const star = (x: number, y: number, k = "y"): Speck[] => [[x, y, "w"], [x - 1, y, k], [x + 1, y, k], [x, y - 1, k], [x, y + 1, k]];
const heart = (x: number, y: number): Speck[] => [
  [x + 1, y, "h"], [x + 3, y, "h"], [x, y + 1, "h"], [x + 1, y + 1, "p"], [x + 2, y + 1, "h"], [x + 3, y + 1, "h"], [x + 4, y + 1, "h"],
  [x + 1, y + 2, "h"], [x + 2, y + 2, "h"], [x + 3, y + 2, "h"], [x + 2, y + 3, "h"],
];
/** Where the poured seed lands: the feeder's mouth on the counter (frame pixels). */
const FEEDER: Pt = [47, COUNTER - 1];
/**
 * Seed falling from the scoop's mouth in a short arc (drifting forward as it drops) onto the feeder below. `phase`
 * staggers the grains so they seem to fall; `upto` how far the stream has reached (rows below the mouth); `landed`
 * adds the grains settled on the feeder.
 */
function pourSeeds(m: Pt, phase: number, upto: number, landed: boolean, from = 0): Speck[] {
  const out: Speck[] = [];
  const ks = ["o", "s", "S", "s"];
  for (let r = from; r <= upto; r++) {
    const y = m[1] + 1 + r;
    if (y > FEEDER[1]) break;
    const x = m[0] + Math.floor((r + 1) / 2);
    if ((r + phase) % 2 === 0) out.push([x, y, ks[(r + phase) % 4]!], [x + 1, y, r % 4 ? "S" : "o"]);
    else if (r < 2) out.push([x + 1, y, "s"]);
  }
  if (landed) out.push([FEEDER[0] - 1, FEEDER[1], "s"], [FEEDER[0], FEEDER[1], "o"], [FEEDER[0] + 1, FEEDER[1], "S"]);
  return out;
}
const kick = (n: number): Speck[] => ([[6, 20, "o"], [9, 19, "s"], [4, 21, "S"], [11, 18, "o"]] as const).slice(0, n).map(([x, y, k]): Speck => [x, y, k]);
const sweat = (i: number): Speck[] => { const t = i % 3; return [[16 - t, 7 + t, "j"], [16 - t, 8 + t, "w"]]; };
const fluff = (t: number): Speck[] => ([[-1, -1], [1, -1.3], [-1.5, 0.2], [1.6, 0]] as const).map(([vx, vy], i): Speck => [Math.round(26 + vx * (4 + t * 3)), Math.round(12 + vy * (4 + t * 3) + t * t * 0.4), i % 2 ? "d" : "e"]);
const dizzy = (t: number): Speck[] => [0, 1, 2].flatMap((i) => { const a = t * 0.9 + i * 2.1; return star(Math.round(26 + Math.cos(a) * 9), Math.round(4 + Math.sin(a) * 1.5)); });
const thoughts = (n: number): Speck[] => {
  const out: Speck[] = [];
  if (n >= 1) out.push([40, 6, "e"], [41, 6, "e"], [40, 7, "d"], [41, 7, "d"]);
  if (n >= 2) out.push([43, 2, "e"], [44, 2, "e"], [45, 2, "d"], [43, 3, "d"], [44, 3, "d"], [45, 3, "c"]);
  if (n >= 3) out.push([47, 1, "y"]);
  return out;
};
const FLASH: Record<string, string> = { a: "#8b92a0", b: "#b4bbc8", c: "#d6dbe3", d: "#eceff4", e: "#ffffff", R: "#c0504a", r: "#de6a5c", Q: "#f08a78", q: "#ffb0a0" };

function f(ms: number, p: Pose, extra: Partial<Frame> = {}): Frame {
  const specks = (extra.specks ?? []).filter(([x, y]) => x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2);
  return { ms, layers: build(p), ...extra, specks };
}

// ---- Animations.

const REST: Pose = { wing: "rest", look: "down", tip: 1 };
const pourMouth = (w: WingName, ang: number): Pt => mouthOf(WINGS[w].t[0], WINGS[w].t[1], ang);

/** Idle (about 5 s): dip the scoop in the vat behind him, lift it heaped, turn to the counter, tip the seed into the
 * feeder (a short arc), then watch it with a little nod; a slow blink in the pause. */
const idle: Anim = {
  loop: true,
  frames: [
    f(420, { ...REST }),
    f(160, { wing: "turn", look: "back", hx: -1 }),
    f(200, { wing: "reach", look: "back", hx: -1, tip: 1 }),
    f(240, { wing: "dip", look: "back", hx: -1, tip: 2, bob: 1 }, { specks: kick(2), cue: "scoop" }),
    f(200, { wing: "dip", ang: 25, full: 1, look: "back", hx: -1, tip: 2, bob: 1 }, { specks: kick(4) }),
    f(300, { wing: "lift", full: 2, look: "back", hx: -1, tip: 1 }),
    f(180, { wing: "cross", full: 2, look: "fwd" }),
    f(300, { wing: "carry", full: 2, look: "down", tip: 1 }),
    f(200, { wing: "tilt", full: 2, look: "down", tip: 2 }),
    f(150, { wing: "pour", full: 1, look: "down", tip: 1, hx: -1 }, { specks: pourSeeds(pourMouth("pour", 40), 0, 1, false), cue: "pour" }),
    f(150, { wing: "pour", full: 1, look: "down", tip: 1, hx: -1 }, { specks: pourSeeds(pourMouth("pour", 40), 1, 4, false) }),
    f(150, { wing: "pour2", look: "down", tip: 1, hx: -1 }, { specks: pourSeeds(pourMouth("pour2", 50), 0, 5, true) }),
    f(150, { wing: "pour2", look: "down", tip: 1, hx: -1 }, { specks: pourSeeds(pourMouth("pour2", 50), 1, 5, true, 2) }),
    f(200, { ...REST, tip: 2 }, { specks: pourSeeds(pourMouth("pour2", 50), 0, 5, true, 4) }),
    f(380, { ...REST, tip: 2 }, { specks: pourSeeds(FEEDER, 0, -1, true) }),
    f(200, { ...REST, tip: 2, bob: 1, hy: 1 }),
    f(260, { ...REST, tip: 1 }),
    f(300, { ...REST, mood: "calm", look: "fwd", tip: 0 }),
    f(130, { ...REST, mood: "half", look: "fwd", tip: 0 }),
    f(220, { ...REST, mood: "blink", look: "fwd", tip: 0 }),
    f(130, { ...REST, mood: "half", look: "fwd", tip: 0 }),
    f(400, { ...REST, look: "fwd", tip: 0, bob: 1 }),
  ],
};

/** Wave (once, 1.2 s): he sets the scoop down on the counter, waves hello with his wing, picks it back up. */
const WAVES: WingName[] = ["waveL", "waveM", "waveR", "waveM", "waveL", "waveM"];
const wave: Anim = {
  loop: false,
  frames: [
    f(110, { wing: "set", look: "fwd", tip: 1 }),
    f(110, { wing: "up", free: true, mood: "cheer", hy: -1 }, { cue: "coo" }),
    ...WAVES.map((w, i) => f(120, { wing: w, free: true, mood: i % 2 ? "cheer" : "happy", hx: i % 2 ? 0 : -1, bob: i % 2 }, { specks: i === 1 ? heart(41, 2) : i === 3 ? star(44, 4) : [] })),
    f(120, { wing: "set", mood: "happy", tip: 1 }),
    f(120, { ...REST }),
  ],
};

const entrance: Anim = {
  loop: false,
  frames: [
    f(120, { ...REST, bob: 6, mood: "blink" }),
    f(100, { ...REST, bob: 3, mood: "calm", look: "up" }),
    f(110, { wing: "up", mood: "cheer", hy: -1 }, { cue: "coo" }),
    f(120, { wing: "waveL", mood: "happy" }, { specks: star(42, 4) }),
    f(120, { wing: "waveR", mood: "happy" }, { specks: heart(41, 2) }),
    f(130, { wing: "set", mood: "happy", tip: 1 }),
    f(300, { ...REST }),
  ],
};

const thinking: Anim = {
  loop: true,
  frames: Array.from({ length: 10 }, (_, i) =>
    f(170, { wing: "chin", mood: i === 6 ? "blink" : "think", look: "up", hx: 1, hy: i % 5 >= 3 ? 0 : -1, bob: i % 5 >= 3 ? 1 : 0 }, { specks: thoughts(i % 5 < 1 ? 0 : i % 5 < 3 ? 1 : i % 5 < 4 ? 2 : 3) }),
  ),
};

const move: Anim = {
  loop: false,
  frames: [
    f(90, { wing: "rest", mood: "bold", bob: 1 }),
    f(100, { wing: "point", mood: "bold", hx: 1 }, { cue: "coo" }),
    f(110, { wing: "point", mood: "bold", hx: 1, tip: 1 }, { specks: star(49, 18) }),
    f(120, { wing: "carry", mood: "happy" }),
    f(150, { ...REST, mood: "calm" }),
  ],
};

const capture: Anim = {
  loop: false,
  frames: [
    f(80, { ...REST, mood: "bold", bob: 2 }),
    f(90, { wing: "up", mood: "cheer", hy: -1 }, { cue: "coo", specks: star(42, 6) }),
    f(90, { wing: "waveM", mood: "happy", hy: -1 }, { specks: heart(40, 1) }),
    f(90, { wing: "waveR", mood: "happy", bob: 1 }, { specks: star(46, 10) }),
    f(90, { wing: "waveM", mood: "happy", hy: -1 }, { specks: star(8, 6) }),
    f(120, { wing: "carry", mood: "cheer" }),
    f(160, { ...REST, mood: "smug" }),
  ],
};

const hurt: Anim = {
  loop: false,
  frames: [
    f(70, { wing: "low", mood: "hurt", bob: 2 }, { cue: "poof", pal: FLASH, shake: [1, 0], specks: fluff(0) }),
    f(80, { wing: "low", mood: "hurt", bob: 2, dx: -1 }, { shake: [-1, 0], specks: fluff(1) }),
    f(100, { wing: "low", mood: "rattled", bob: 1, dx: -1 }, { specks: fluff(2) }),
    f(110, { wing: "rest", mood: "blink" }),
    f(160, { ...REST, mood: "calm" }),
  ],
};

const check: Anim = {
  loop: false,
  frames: [
    f(100, { wing: "up", mood: "bold", hy: -1 }),
    f(110, { wing: "point", mood: "bold", hx: 1 }, { cue: "coo" }),
    f(90, { wing: "up", mood: "bold", hy: -1 }),
    f(110, { wing: "point", mood: "bold", hx: 1 }, { cue: "coo", specks: star(49, 16) }),
    f(150, { wing: "carry", mood: "happy" }),
    f(160, { ...REST, mood: "smug" }),
  ],
};

const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(160, { wing: "rest", mood: "smug", look: "fwd", hy: i < 3 || i > 5 ? -1 : 0, hx: i < 4 ? 0 : 1, bob: i % 4 === 2 ? 1 : 0 })),
};

const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 6 }, (_, i) => f(90, { wing: "low", mood: "rattled", dx: i % 2 ? 1 : -1, bob: i % 3 === 2 ? 1 : 0 }, { specks: sweat(i) })),
};

const defeat: Anim = {
  loop: false,
  frames: [
    f(80, { wing: "low", mood: "hurt", bob: 2 }, { cue: "poof", pal: FLASH, shake: [1, 0], specks: fluff(0) }),
    f(110, { wing: "droop", mood: "out", bob: 2, dx: -1 }, { specks: dizzy(0) }),
    f(130, { wing: "droop", mood: "out", bob: 3, hx: 1, hy: 1, tip: 2 }, { specks: dizzy(1.5) }),
    f(150, { wing: "droop", mood: "out", bob: 4, hx: 1, hy: 2, tip: 2 }, { specks: dizzy(3) }),
    f(1000, { wing: "droop", mood: "out", bob: 4, hx: 1, hy: 2, tip: 2 }, { specks: dizzy(4.5) }),
  ],
};

const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => {
    const w: WingName[] = ["up", "waveL", "waveM", "waveR", "waveM", "waveL", "up", "carry"];
    return f(120, { wing: w[i]!, full: 2, mood: i % 2 ? "happy" : "cheer", hy: i % 2 ? 0 : -1, bob: i % 4 === 3 ? 1 : 0 }, { cue: i === 1 ? "coo" : undefined, specks: [...(i % 3 === 0 ? star(43, 3 + (i % 2) * 4) : []), ...(i % 4 === 1 ? heart(40, 1) : [])] });
  }),
};

export const SIDEKICK_BIRDIE_BARTENDER: Character = {
  id: "sidekick-birdie-bartender",
  name: "Bartender",
  w: W,
  h: H,
  foot: [26, GROUND],
  palette: PALETTE,
  halo: "#2a2c34",
  parts: PARTS,
  anims: { idle, wave, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory },
};
