/**
 * Jefferson's sidekick: a baby giraffe, a town bot that trots round the square and plays chess at the park tables.
 * Friendly, curious, no powers; it copies the big guy with one small sparkler held up proudly in its near hoof.
 *
 * Distinct from Jefferson (grex.ts): softer and rounder, paler yellow with fewer, rounder spots, stubby ossicones with
 * no flames, a plain brown mane and a little plain tail tuft, feet together (no fighting stance). Drawn three-quarters,
 * facing our right, light from the top left.
 *
 * Rigging: the head (one per mood) and the torso with its neck are painted once; the legs (knobbly knees), arms and
 * the sparkler wire are painted from their pose's points, so a pose is a handful of numbers. The sparkler's tip spits
 * seeded sparks (specks) every frame.
 */
import { canvas, ellipse, inEllipse, inPoly, roundLight, shade, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../../../packages/app/src/characters/sprite.ts";

type Pt = readonly [number, number];

const PALETTE = {
  k: "#1e0e05", // outline
  d: "#c58a34", // pale giraffe yellow, dark to light
  c: "#e8b956",
  C: "#f7d684",
  h: "#fff1b8",
  o: "#d38a45", // spots
  O: "#a9622a",
  u: "#fff7e0", // cream: muzzle, belly
  U: "#efd6a4",
  b: "#7a4a24", // hooves, ossicone knobs, mane, tail tuft
  B: "#4e2c14",
  N: "#a8703e",
  s: "#1a1420", // eyes
  S: "#4a3466",
  t: "#fff8ec",
  p: "#f4a3a0", // cheek blush
  m: "#6a2414", // mouth, tongue
  q: "#e5566a",
  x: "#ffffff", // sparks: white-hot to red
  y: "#fff7b8",
  Y: "#ffd23a",
  f: "#ff9a1f",
  F: "#f2541b",
  w: "#a4a4b0", // sparkler wire
  W: "#5c5c66",
  g: "#b8b0b8", // smoke
  G: "#7d7580",
  l: "#c48a52", // the stool's wood
  L: "#93603a",
  D: "#5e3a1e",
  j: "#7fd3ff", // a tear, sweat
  z: "#0d0e12", // ground shadow
} as const;

const W = 64;
const OY = 5;
const H = 64 + OY;
const GROUND = 61;

const PARTS: Record<string, Part> = {};

// ---- Helpers.

function spot(cv: Canvas, cx: number, cy: number, r: number): void {
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
    for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const k = cv[y]?.[x];
      if (!k || !"dcCh".includes(k)) continue;
      if (((x + 0.5 - cx) / r) ** 2 + ((y + 0.5 - cy) / (r * 0.9)) ** 2 <= 1) cv[y]![x] = k === "d" ? "O" : "o";
    }
}

function stamp(cv: Canvas, rows: readonly string[], x0: number, y0: number): void {
  rows.forEach((row, y) =>
    [...row].forEach((k, i) => {
      if (k !== "." && cv[y0 + y]?.[x0 + i] !== undefined) cv[y0 + y]![x0 + i] = k;
    }),
  );
}

function dots(cv: Canvas, pts: readonly (readonly [number, number])[], k: string): void {
  for (const [x, y] of pts) if (cv[y]?.[x] !== undefined) cv[y]![x] = k;
}

// ---- Head: big and round, three-quarters facing right; eyes and mouth per mood.

type Mood = "open" | "blink" | "happy" | "think" | "thinkBlink" | "wow" | "worried" | "smug" | "hurt" | "sad";

const EYES: Record<string, { near: readonly string[]; far: readonly string[] }> = {
  open: { near: [".sss.", "sxxss", "sxsss", "sSSSs", "sSSxs", ".sss."], far: [".s.", "sxs", "sss", "sSs", ".s."] },
  wow: { near: [".sss.", "sxxss", "sxxss", "sSSSs", "sSSxs", ".sss."], far: [".s.", "sxs", "sxs", "sSs", ".s."] },
  blink: { near: [".....", ".....", ".....", "s...s", ".sss.", "....."], far: ["...", "...", "s.s", ".s.", "..."] },
  happy: { near: [".....", ".....", ".sss.", "s...s", ".....", "....."], far: ["...", ".s.", "s.s", "...", "..."] },
  think: { near: [".sss.", "sxsss", "sssss", "sttts", ".sss.", "....."], far: [".s.", "sxs", "sss", "sts", ".s."] },
  worried: { near: [".sss.", "sttts", "sttss", "sttss", "sttts", ".sss."], far: [".s.", "sts", "sss", "sts", ".s."] },
  smug: { near: [".....", ".....", "sssss", "sxSSs", "sSSSs", ".sss."], far: ["...", "...", "sss", "sxs", ".s."] },
  hurt: { near: ["s....", ".ss..", "...ss", ".ss..", "s....", "....."], far: ["..s", ".s.", "s..", ".s.", "..s"] },
  sad: { near: [".sss.", "sssss", "sxxss", "sxsss", "sSSSs", ".sss."], far: [".s.", "sss", "sxs", "sSs", ".s."] },
};

const MOUTHS: Record<string, readonly (readonly [number, number, string])[]> = {
  smile: [[19, 16, "k"], [20, 17, "k"], [21, 17, "k"], [22, 17, "k"], [23, 16, "k"]],
  grin: [[19, 16, "k"], [20, 16, "k"], [21, 16, "k"], [22, 16, "k"], [23, 16, "k"], [20, 17, "k"], [21, 17, "m"], [22, 17, "q"], [23, 17, "k"], [21, 18, "k"], [22, 18, "k"]],
  o: [[21, 16, "k"], [22, 16, "k"], [20, 17, "k"], [21, 17, "m"], [22, 17, "m"], [23, 17, "k"], [21, 18, "k"], [22, 18, "k"]],
  smirk: [[19, 17, "k"], [20, 17, "k"], [21, 17, "k"], [22, 17, "k"], [23, 16, "k"], [24, 15, "k"]],
  flat: [[20, 17, "k"], [21, 17, "k"], [22, 17, "k"]],
  wavy: [[19, 17, "k"], [20, 16, "k"], [21, 17, "k"], [22, 16, "k"], [23, 17, "k"]],
  frown: [[19, 18, "k"], [20, 17, "k"], [21, 17, "k"], [22, 17, "k"], [23, 18, "k"]],
};

const FACES: Record<Mood, { eyes: string; mouth: string; brow?: "worried" | "up"; tear?: boolean; blush?: boolean }> = {
  open: { eyes: "open", mouth: "smile", blush: true },
  blink: { eyes: "blink", mouth: "smile", blush: true },
  happy: { eyes: "happy", mouth: "grin", blush: true },
  think: { eyes: "think", mouth: "flat", blush: true },
  thinkBlink: { eyes: "blink", mouth: "flat", blush: true },
  wow: { eyes: "wow", mouth: "o", blush: true },
  worried: { eyes: "worried", mouth: "wavy", brow: "worried" },
  smug: { eyes: "smug", mouth: "smirk", brow: "up", blush: true },
  hurt: { eyes: "hurt", mouth: "o" },
  sad: { eyes: "sad", mouth: "frown", brow: "worried", tear: true },
};

const HEAD_W = 30;
const HEAD_H = 21;
/** Where the head grid's top-left sits on the frame at rest. */
const HEAD_AT: Pt = [15, 7];

function head(mood: Mood): Part {
  const cv = canvas(HEAD_W, HEAD_H);
  // Stubby ossicones: a short yellow stalk and a round brown knob, no flames.
  for (const hx of [9, 14]) {
    for (let y = 2; y <= 6; y++) {
      cv[y]![hx] = "C";
      cv[y]![hx + 1] = "c";
    }
    dots(cv, [[hx, 0], [hx + 1, 0]], "b");
    cv[0]![hx] = "N";
    dots(cv, [[hx - 1, 1], [hx, 1], [hx + 1, 1]], "b");
    cv[1]![hx + 2] = "B";
  }
  // Ears: the far one out to the back, the near one up behind the horns.
  const earL: Pt[] = [[0.3, 5.5], [4, 6], [7.5, 8.5], [7, 11.5], [3, 10.5], [0.3, 8]];
  const earR: Pt[] = [[18.5, 7], [23, 2.5], [26.6, 2.4], [25, 7], [21, 9.5]];
  shade(cv, inPoly(earL), "dcC", (_, y) => 1.05 - 0.07 * y);
  shade(cv, inPoly(earR), "dcC", (_, y) => 1.15 - 0.1 * y);
  for (const [x, y] of [[2, 7], [3, 7], [4, 8], [5, 9], [23, 4], [24, 4], [22, 5]] as const) if (cv[y]![x] !== ".") cv[y]![x] = "U";
  // A big round skull and a short round snout, lit from the top left.
  const skull = inEllipse(13, 12.2, 8.6, 8);
  const snout = inEllipse(21.5, 14.6, 6.2, 4.8);
  const inside = (x: number, y: number) => skull(x, y) || snout(x, y);
  shade(cv, inside, "dcCh", roundLight(13, 11, 11, 9, 0.12));
  // Two round spots, no more.
  spot(cv, 6, 14.5, 1.5);
  spot(cv, 17, 6.5, 1.1);
  // Cream muzzle and a nostril.
  const muzzle = inEllipse(22.6, 15.2, 5.4, 4.3);
  shade(cv, (x, y) => inside(x, y) && muzzle(x, y), "Uuu", (_, y) => 1.15 - 0.09 * (y - 11));
  cv[13]![25] = "B";
  const face = FACES[mood];
  const eyes = EYES[face.eyes]!;
  stamp(cv, eyes.near, 8, 8);
  stamp(cv, eyes.far, 16, 9);
  if (face.brow === "worried") dots(cv, [[7, 7], [8, 7], [9, 6], [10, 6], [11, 6]], "k");
  if (face.brow === "up") dots(cv, [[8, 8], [9, 7], [10, 7], [11, 7], [12, 8]], "k");
  if (face.blush) dots(cv, [[8, 15], [9, 15]], "p");
  if (face.tear) dots(cv, [[9, 14], [9, 15], [9, 16]], "j");
  for (const [x, y, k] of MOUTHS[face.mouth]!) cv[y]![x] = k;
  return { grid: toGrid(cv) };
}
const MOODS: readonly Mood[] = ["open", "blink", "happy", "think", "thinkBlink", "wow", "worried", "smug", "hurt", "sad"];
for (const m of MOODS) PARTS[`head:${m}`] = head(m);

// ---- Torso and neck as one part: round little body, cream belly, a short neck with a plain brown mane.

const TORSO_AT: Pt = [10, 20];
PARTS.torso = (() => {
  const cv = canvas(30, 32);
  const body = inEllipse(15, 21, 8.5, 7.8);
  shade(cv, body, "dcCh", roundLight(13, 18, 9, 9, 0.08));
  const A: Pt = [15.5, 18];
  const B: Pt = [18.5, 4];
  const r = 3.2;
  for (let y = 0; y < 17; y++)
    for (let x = 0; x < 30; x++) {
      const vx = B[0] - A[0];
      const vy = B[1] - A[1];
      const px = x + 0.5;
      const py = y + 0.5;
      const t = Math.max(0, Math.min(1, ((px - A[0]) * vx + (py - A[1]) * vy) / (vx * vx + vy * vy)));
      const nx = px - (A[0] + t * vx);
      const ny = py - (A[1] + t * vy);
      if (Math.hypot(nx, ny) > r) continue;
      const light = 0.66 - 0.5 * (nx / r) - 0.15 * (ny / r) - 0.012 * y;
      cv[y]![x] = "dcCh"[Math.max(0, Math.min(3, Math.floor(light * 4)))]!;
    }
  shade(cv, (x, y) => body(x, y) && inEllipse(19, 23, 4.4, 5.2)(x, y), "Uuu", (_, y) => 1.2 - 0.06 * (y - 17));
  spot(cv, 10.5, 18.5, 1.8);
  spot(cv, 12.5, 25.5, 1.4);
  spot(cv, 17.5, 9.5, 1.2);
  // The mane: a plain brown bristle down the back of the neck.
  for (let y = 4; y <= 14; y++) {
    const x = cv[y]!.findIndex((k) => k !== ".");
    if (x < 0) continue;
    cv[y]![x] = y % 2 ? "b" : "N";
    if (y % 2 === 0 && x > 0) cv[y]![x - 1] = "b";
  }
  return { grid: toGrid(cv) };
})();

PARTS.shadow = (() => {
  const cv = canvas(22, 3);
  ellipse(cv, 11, 1.5, 11, 1.5, "z");
  return { grid: toGrid(cv), outline: false };
})();

PARTS.hoof = { grid: ["bNbb.", "BBBBB"] };
PARTS.tuft = { grid: [".N.", "bNb", "bbB", ".B."] };
PARTS.stool = {
  grid: [
    "llllllllllllll",
    "LLLLLLLLLLLLLD",
    ".LD.......LD..",
    ".LD.......LD..",
    ".LD.......LD..",
    ".LLLLLLLLLLD..",
    ".LD.......LD..",
    ".LD.......LD..",
    ".LD.......LD..",
    ".DD.......DD..",
  ],
};

// ---- Limbs: a round stroke through a few points, cylinder-shaded, a knob at the knee, a hoof at the end.

const LIMBS = new Map<string, { name: string; at: Pt }>();
function limb(pts: readonly Pt[], r: number, opts: { knob?: number; hoofR?: number; ramp?: string } = {}): { name: string; at: Pt } {
  const name = `limb:${r}:${opts.knob ?? 0}:${opts.hoofR ?? 0}:${pts.map((p) => p.join(",")).join(";")}`;
  const done = LIMBS.get(name);
  if (done) return done;
  const big = Math.max(r, opts.knob ?? 0, opts.hoofR ?? 0);
  const pad = Math.ceil(big) + 1;
  const x0 = Math.floor(Math.min(...pts.map((p) => p[0]))) - pad;
  const y0 = Math.floor(Math.min(...pts.map((p) => p[1]))) - pad;
  const w = Math.ceil(Math.max(...pts.map((p) => p[0]))) + pad - x0 + 1;
  const h = Math.ceil(Math.max(...pts.map((p) => p[1]))) + pad - y0 + 1;
  const cv = canvas(w, h);
  const end = pts[pts.length - 1]!;
  const knee = pts.length > 2 ? pts[1]! : null;
  const ramp = opts.ramp ?? "dcCh";
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const px = x0 + x + 0.5;
      const py = y0 + y + 0.5;
      let best = { d: Infinity, nx: 0, ny: 0 };
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i]!;
        const b = pts[i + 1]!;
        const vx = b[0] - a[0];
        const vy = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((px - a[0]) * vx + (py - a[1]) * vy) / (vx * vx + vy * vy || 1)));
        const nx = px - (a[0] + t * vx);
        const ny = py - (a[1] + t * vy);
        const d = Math.hypot(nx, ny);
        if (d < best.d) best = { d, nx, ny };
      }
      let rr = r;
      let nx = best.nx;
      let ny = best.ny;
      if (knee && opts.knob) {
        const kd = Math.hypot(px - knee[0], py - knee[1]);
        if (kd <= opts.knob && kd - opts.knob < best.d - r) {
          rr = opts.knob;
          nx = px - knee[0];
          ny = py - knee[1];
        }
      }
      const de = Math.hypot(px - end[0], py - end[1]);
      if (opts.hoofR && de <= opts.hoofR) {
        const light = 0.62 - 0.42 * ((px - end[0]) / opts.hoofR) - 0.5 * ((py - end[1]) / opts.hoofR);
        cv[y]![x] = "BbN"[Math.max(0, Math.min(2, Math.floor(light * 3)))]!;
        continue;
      }
      if (Math.hypot(nx, ny) > rr) continue;
      const light = 0.64 - 0.42 * (nx / rr) - 0.5 * (ny / rr);
      cv[y]![x] = ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(light * ramp.length)))]!;
    }
  PARTS[name] = { grid: toGrid(cv) };
  const out = { name, at: [x0, y0] as Pt };
  LIMBS.set(name, out);
  return out;
}

/** The sparkler's wire from the hoof toward its burning tip (1 pixel, outlined). */
function wire(from: Pt, to: Pt, lit: boolean): { name: string; at: Pt } {
  const name = `wire:${from.join(",")}:${to.join(",")}:${lit ? 1 : 0}`;
  const done = LIMBS.get(name);
  if (done) return done;
  const x0 = Math.min(from[0], to[0]);
  const y0 = Math.min(from[1], to[1]);
  const cv = canvas(Math.abs(to[0] - from[0]) + 1, Math.abs(to[1] - from[1]) + 1);
  let [x, y] = [from[0] - x0, from[1] - y0];
  const [x1, y1] = [to[0] - x0, to[1] - y0];
  const dx = Math.abs(x1 - x);
  const dy = -Math.abs(y1 - y);
  const sx = x < x1 ? 1 : -1;
  const sy = y < y1 ? 1 : -1;
  let err = dx + dy;
  const path: Pt[] = [];
  for (;;) {
    path.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) (err += dy), (x += sx);
    if (e2 <= dx) (err += dx), (y += sy);
  }
  path.forEach(([px, py], i) => (cv[py]![px] = i === path.length - 1 ? (lit ? "f" : "W") : i % 3 === 2 ? "W" : "w"));
  PARTS[name] = { grid: toGrid(cv) };
  const out = { name, at: [x0, y0] as Pt };
  LIMBS.set(name, out);
  return out;
}

// ---- Poses.

/** An arm: elbow, hoof and (if it holds the sparkler) the sparkler's tip, in frame pixels at rest. */
interface ArmSpec {
  e: Pt;
  h: Pt;
  t?: Pt;
}
const SHOULDER_NEAR: Pt = [29, 37];
const SHOULDER_FAR: Pt = [22, 37];

type NearArm = "hold" | "up" | "waveL" | "waveR" | "waveFar" | "point" | "chin" | "lap" | "cheer" | "low" | "flinch" | "proud";
const NEAR: Record<NearArm, ArmSpec> = {
  hold: { e: [34, 41], h: [39, 36], t: [46, 28] },
  proud: { e: [36, 37], h: [42, 31], t: [48, 20] },
  up: { e: [37, 35], h: [43, 29], t: [47, 16] },
  waveL: { e: [37, 35], h: [43, 29], t: [45, 15] },
  waveR: { e: [36, 35], h: [41, 29], t: [51, 19] },
  waveFar: { e: [36, 36], h: [42, 31], t: [54, 27] },
  point: { e: [34, 40], h: [40, 38], t: [51, 35] },
  chin: { e: [34, 40], h: [37, 30], t: [46, 26] },
  lap: { e: [33, 43], h: [38, 46], t: [45, 51] },
  cheer: { e: [37, 34], h: [43, 27], t: [49, 15] },
  low: { e: [31, 42], h: [34, 45], t: [40, 49] },
  flinch: { e: [32, 41], h: [35, 43], t: [42, 40] },
};
type FarArm = "side" | "up" | "out" | "sitHold";
const FAR: Record<FarArm, ArmSpec> = {
  side: { e: [20, 41], h: [20, 45] },
  up: { e: [18, 32], h: [17, 27] },
  out: { e: [17, 39], h: [14, 41] },
  sitHold: { e: [20, 41], h: [20, 45], t: [15, 51] },
};

interface Pose {
  mood?: Mood;
  /** Upper body down a pixel (a breath, a bob). */
  bob?: number;
  /** Down at the hips, hooves planted (knees bend). */
  crouch?: number;
  /** Off the ground. */
  air?: number;
  dx?: number;
  /** The head on the neck. */
  hx?: number;
  hy?: number;
  near?: NearArm;
  far?: FarArm;
  /** Which hoof holds the sparkler (default the near one); "none" puts it away. */
  hold?: "near" | "far" | "none";
  /** Spark size: 0 the sparkler is out. */
  lit?: number;
  /** The ankles (far, near) when standing, at rest. */
  feet?: readonly [Pt, Pt];
  /** Sitting: on a stool, or on the ground (defeat). */
  seat?: "stool" | "ground";
  /** Dangling legs on the stool swing a pixel. */
  swing?: number;
  /** Tail swish. */
  tail?: number;
}

const STAND: readonly [Pt, Pt] = [[22, 58], [30, 58]];

/** The trot: feet (far, near) at step `i` of 6, the planted foot sliding back as the other swings forward. */
function trot(i: number): { feet: [Pt, Pt]; bob: number } {
  const foot = (c: number, th: number): Pt => [Math.round(c - 3.5 * Math.cos(th)), Math.round(58 - Math.max(0, Math.sin(th)) * 3)];
  const th = (2 * Math.PI * i) / 6;
  return { feet: [foot(23, th), foot(29, th + Math.PI)], bob: i % 3 === 0 ? 1 : 0 };
}

function build(p: Pose): { layers: Layer[]; tip: Pt | null } {
  const dx = p.dx ?? 0;
  const air = p.air ?? 0;
  const crouch = p.crouch ?? 0;
  const seatDrop = p.seat === "stool" ? 4 : p.seat === "ground" ? 12 : 0;
  const by = (p.bob ?? 0) + crouch - air + seatDrop - 1;
  const mv = (q: Pt, yy = by): Pt => [q[0] + dx, q[1] + yy];
  const at = (part: string, x: number, y: number): Layer => ({ part, x, y });
  const L = (l: { name: string; at: Pt }) => at(l.name, l.at[0], l.at[1]);
  const layers: Layer[] = [];
  if (p.seat !== "stool") layers.push(at("shadow", 15 + dx, GROUND - 2));
  // Tail and its plain tuft.
  const sw = p.tail ?? 0;
  const tailEnd: Pt = mv([13 - Math.abs(sw), 47 + sw]);
  layers.push(L(limb([mv([18, 43]), mv([15, 45]), tailEnd], 0.8)), at("tuft", tailEnd[0] - 1, tailEnd[1] - 1));
  if (p.seat === "stool") layers.push(at("shadow", 15 + dx, GROUND - 2), at("stool", 14 + dx, 51));
  // Arms.
  const hold = p.hold ?? "near";
  const arm = (sh: Pt, spec: ArmSpec, holding: boolean, ramp = "dcCh") => {
    const pts = [mv(sh), mv(spec.e), mv(spec.h)];
    const out: Layer[] = [];
    let tip: Pt | null = null;
    if (holding && spec.t) {
      const h = pts[2]!;
      const t = mv(spec.t);
      const n = Math.hypot(t[0] - h[0], t[1] - h[1]);
      const from: Pt = [Math.round(h[0] + ((t[0] - h[0]) / n) * 2), Math.round(h[1] + ((t[1] - h[1]) / n) * 2)];
      out.push(L(wire(from, t, (p.lit ?? 1) > 0)));
      tip = t;
    }
    out.push(L(limb(pts, 1.4, { hoofR: 1.8, ramp })));
    return { out, tip };
  };
  const far = arm(SHOULDER_FAR, FAR[p.far ?? "side"], hold === "far", "ddcC");
  layers.push(...far.out);
  // Legs: knobbly knees.
  const legPts: [Pt, Pt, Pt][] = [];
  if (p.seat === "stool") {
    const s = p.swing ?? 0;
    legPts.push([mv([25, 46]), [33 + dx, 50], [33 + dx - s, 57]], [mv([28, 47]), [37 + dx, 51], [38 + dx + s, 58]]);
  } else if (p.seat === "ground") {
    legPts.push([mv([26, 43]), [35 + dx, 55], [40 + dx, 57]], [mv([28, 44]), [38 + dx, 56], [44 + dx, 58]]);
  } else {
    const feet = p.feet ?? STAND;
    for (const [i, hipX] of [[0, 22], [1, 29]] as const) {
      const hip = mv([hipX, 46]);
      const ankle: Pt = [feet[i]![0] + dx, feet[i]![1] - air];
      const bend = Math.max(0, 12 - (ankle[1] - hip[1]));
      const knee: Pt = [Math.round((hip[0] + ankle[0]) / 2 + 0.5 + bend * 0.8), Math.round((hip[1] + ankle[1]) / 2)];
      legPts.push([hip, knee, ankle]);
    }
  }
  legPts.forEach((pts, i) => layers.push(L(limb(pts, 1.15, { knob: 2.0, ramp: i ? "dcCh" : "ddcC" })), at("hoof", pts[2][0] - 2, pts[2][1] + 1)));
  layers.push(at("torso", TORSO_AT[0] + dx, TORSO_AT[1] + by));
  layers.push(at(`head:${p.mood ?? "open"}`, HEAD_AT[0] + dx + (p.hx ?? 0), HEAD_AT[1] + by + (p.hy ?? 0)));
  const near = arm(SHOULDER_NEAR, NEAR[p.near ?? "hold"], hold === "near");
  layers.push(...near.out);
  return { layers, tip: near.tip ?? far.tip };
}

// ---- Specks: sparks, smoke, thoughts, sweat.

function rng(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => ((s = (s * 1103515245 + 12345) >>> 0) >>> 8) / 16777216;
}

/** The sparkler's burning tip: a white-hot core, four short rays (crossed or diagonal in turn) and a few loose sparks. */
function fizz([x, y]: Pt, seed: number, size: number): Speck[] {
  if (size <= 0) return [];
  const r = rng(seed + 7);
  const out: Speck[] = [];
  const reach = size >= 1.2 ? 3 : size >= 0.6 ? 2 : 1;
  const rays: readonly Pt[] = seed % 2 ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
  if (size >= 0.5) for (const [dx, dy] of rays) for (let d = 1; d <= reach; d++) out.push([x + dx * d, y + dy * d, d === reach && reach > 1 ? "f" : "Y"]);
  const n = Math.round(2 + 5 * size);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = 2 + r() * (1 + 3.2 * size);
    out.push([Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), d > 2 + 2.4 * size ? "F" : d > 3 ? "f" : "Y"]);
  }
  out.push([x, y, "x"], [x + 1, y, "y"], [x - 1, y, "y"], [x, y - 1, "y"], [x, y + 1, "y"]);
  return out;
}

/** A thin curl of smoke rising from the sparkler gone out. */
function wisp([x, y]: Pt, t: number): Speck[] {
  return [0, 1, 2].flatMap((i): Speck[] => {
    const yy = y - 1 - ((t + i * 3) % 8);
    const xx = x + Math.round(Math.sin(t * 0.9 + i * 2));
    return [[xx, yy, i % 2 ? "g" : "G"]];
  });
}

/** Thought dots popping up beside the head, one by one. */
const thoughts = (n: number): Speck[] =>
  ([[46, 12], [49, 9], [52, 5]] as const).slice(0, n).flatMap(([x, y], i): Speck[] =>
    i === 2 ? [[x, y, "u"], [x + 1, y, "u"], [x, y + 1, "u"], [x + 1, y + 1, "U"]] : [[x, y, "u"], [x + 1, y, "U"]],
  );

const sweat = (i: number): Speck[] => {
  const t = i % 4;
  return [[13 - t, 10 + t, "j"], [13 - t, 11 + t, "x"], [36 + Math.floor(t / 2), 4 + t, "j"]];
};

/** A frame from a pose: the sparkler fizzes (seeded) unless it's out. */
const fr = (ms: number, p: Pose, seed = 0, extra: Partial<Frame> = {}): Frame => {
  const b = build(p);
  const lit = p.lit ?? 0.8;
  const sparks = b.tip && p.hold !== "none" ? fizz(b.tip, seed, lit) : [];
  // (Drawn in a space with the ground at GROUND; the frame has OY more room above, for hops and sparks.)
  return {
    ms,
    ...extra,
    layers: b.layers.map((l) => ({ ...l, y: l.y + OY })),
    specks: [...sparks, ...(extra.specks ?? [])].map(([x, y, k]): Speck => [x, y + OY, k]),
  };
};
const tipOf = (p: Pose): Pt => build(p).tip ?? [0, 0];

const FLASH: Record<string, string> = { d: "#f0c070", c: "#ffe2a0", C: "#fff4cc", h: "#ffffff", o: "#f0b070", O: "#d08848", u: "#ffffff", U: "#fff2d0" };

// ---- Animations.

/** Idle (3 s): a gentle breathing bob, the tail swishing, one blink, the sparkler fizzing. */
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 24 }, (_, i) =>
    fr(125, { bob: [0, 0, 0, 1, 1, 1][i % 6]!, tail: i % 12 < 6 ? 0 : 1, mood: i === 16 || i === 17 ? "blink" : "open" }, i),
  ),
};

/** Walk (0.6 s): a short trot on its knobbly legs, head bobbing, the sparkler held up. */
const walk: Anim = {
  loop: true,
  frames: Array.from({ length: 6 }, (_, i) => {
    const t = trot(i);
    return fr(100, { feet: t.feet, bob: t.bob, hy: t.bob ? 0 : -1, tail: i % 3 === 1 ? 1 : 0 }, i, i % 3 === 0 ? { cue: "step" } : {});
  }),
};

/** Sit: on a stool facing the board, a hoof to its chin, the sparkler lowered in the other hoof, legs swinging, a slow blink. */
const sit: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) =>
    fr(
      200,
      {
        seat: "stool",
        near: "lap",
        lit: i % 4 === 0 ? 0.35 : 0.2,
        hy: i >= 12 ? 1 : 0,
        swing: i % 8 < 4 ? 0 : 1,
        bob: i % 8 >= 2 && i % 8 < 6 ? 1 : 0,
        mood: i === 10 || i === 11 ? "thinkBlink" : i >= 4 && i < 8 ? "think" : "open",
        tail: i % 8 < 4 ? 1 : 2,
      },
      i,
    ),
  ),
};

/** Wave (1.2 s): up goes the sparkler and it waves it in a little arc, happy, then settles back. */
const wave: Anim = {
  loop: false,
  frames: [
    fr(100, { crouch: 1, mood: "happy" }, 1),
    fr(120, { near: "up", mood: "happy", lit: 1.1, hx: -1 }, 2, { cue: "fizz" }),
    fr(110, { near: "waveR", mood: "happy", lit: 1.1 }, 3),
    fr(110, { near: "waveFar", mood: "happy", lit: 1.1, hx: 1, bob: 1 }, 4),
    fr(110, { near: "waveR", mood: "happy", lit: 1.1 }, 5),
    fr(110, { near: "waveL", mood: "happy", lit: 1.1, hx: -1 }, 6),
    fr(110, { near: "waveR", mood: "happy", lit: 1.1 }, 7),
    fr(110, { near: "waveFar", mood: "happy", lit: 1.1, hx: 1, bob: 1 }, 8),
    fr(110, { near: "up", mood: "happy", lit: 1, hx: -1 }, 9),
    fr(210, { mood: "open" }, 10),
  ],
};

/** Entrance: crouched with the sparkler out, it fizzes alight, the baby gasps, hops for joy and holds it up proudly. */
const entrance: Anim = {
  loop: false,
  frames: [
    fr(160, { crouch: 2, mood: "blink", lit: 0 }, 0),
    fr(120, { crouch: 1, mood: "wow", lit: 0.25 }, 1, { cue: "fizz" }),
    fr(120, { crouch: 1, mood: "wow", lit: 0.6 }, 2),
    fr(100, { crouch: 3, mood: "happy", lit: 0.9 }, 3),
    fr(90, { air: 3, mood: "happy", near: "cheer", far: "up", lit: 1.3 }, 4),
    fr(90, { air: 5, mood: "happy", near: "cheer", far: "up", lit: 1.3 }, 5),
    fr(90, { air: 3, mood: "happy", near: "cheer", far: "up", lit: 1.3 }, 6),
    fr(100, { crouch: 2, mood: "happy", lit: 1 }, 7, { cue: "step" }),
    fr(320, { near: "proud", mood: "open" }, 8),
  ],
};

/** Thinking: the sparkler up by its chin, eyes rolled up, a foot tapping, thought dots popping up one by one. */
const thinking: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) =>
    fr(
      150,
      {
        near: "chin",
        lit: 0.4,
        mood: i === 13 ? "thinkBlink" : "think",
        feet: i % 2 ? [[23, 57], [30, 58]] : STAND,
        bob: i % 4 === 2 ? 1 : 0,
      },
      i,
      { specks: thoughts(Math.floor(i / 4)) },
    ),
  ),
};

/** Its move: a little hop toward the board and the sparkler pointed at it. */
const move: Anim = {
  loop: false,
  frames: [
    fr(100, { crouch: 2, mood: "open" }, 1),
    fr(100, { air: 2, near: "point", mood: "happy", dx: 1 }, 2),
    fr(110, { crouch: 1, near: "point", mood: "wow", lit: 1.3, dx: 1 }, 3, { cue: "fizz" }),
    fr(150, { near: "point", mood: "happy", dx: 1, lit: 1 }, 4),
    fr(110, { crouch: 1, mood: "open" }, 5),
    fr(160, { mood: "open" }, 6),
  ],
};

/** A capture: bouncing for joy, both hooves up, the sparkler fizzing big. */
const capture: Anim = {
  loop: false,
  frames: [
    fr(90, { crouch: 2, mood: "wow" }, 1),
    ...[0, 2, 4, 2, 0, 2, 4, 2].map((air, i) =>
      fr(80, { air, crouch: air === 0 ? 1 : 0, near: "cheer", far: "up", mood: "happy", lit: 1.4, tail: i % 2 }, i + 2, i === 0 ? { cue: "fizz" } : {}),
    ),
    fr(110, { crouch: 1, mood: "happy" }, 12),
    fr(180, { mood: "open", near: "proud" }, 13),
  ],
};

/** Hurt: a flinch, eyes squeezed, the sparkler sputtering; then a pout, and it's all right again. */
const hurt: Anim = {
  loop: false,
  frames: [
    fr(80, { crouch: 2, dx: -1, mood: "hurt", near: "flinch", far: "out", lit: 0.3, hy: 1 }, 1, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    fr(90, { crouch: 2, dx: -2, mood: "hurt", near: "flinch", far: "out", lit: 0.2, hy: 1 }, 2, { shake: [-1, 0] }),
    fr(110, { crouch: 1, dx: -1, mood: "worried", near: "low", lit: 0.3 }, 3),
    fr(160, { mood: "sad", lit: 0.5 }, 4),
    fr(140, { mood: "open", bob: 1 }, 5),
    fr(160, { mood: "open" }, 6),
  ],
};

/** Check: two excited jabs of the sparkler at the board, a gasp each time, sparks flying. */
const check: Anim = {
  loop: false,
  frames: [
    fr(100, { crouch: 1, mood: "open" }, 1),
    fr(110, { air: 1, near: "point", mood: "wow", lit: 1.4, dx: 1 }, 2, { cue: "fizz" }),
    fr(90, { crouch: 1, near: "point", mood: "wow", lit: 1.2, dx: 1 }, 3),
    fr(100, { crouch: 1, mood: "happy" }, 4),
    fr(110, { air: 1, near: "point", mood: "wow", lit: 1.4, dx: 1 }, 5, { cue: "fizz" }),
    fr(90, { crouch: 1, near: "point", mood: "wow", lit: 1.2, dx: 1 }, 6),
    fr(160, { near: "proud", mood: "happy" }, 7),
    fr(200, { mood: "open" }, 8),
  ],
};

/** Smug: copying the big guy, chin up, eyes half shut, a smirk, the sparkler held up high; a slow nod. */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => fr(160, { near: "proud", mood: "smug", hy: i % 4 === 1 || i % 4 === 2 ? 0 : -1, hx: 1, bob: i % 4 === 2 ? 1 : 0, lit: 1 }, i)),
};

/** Rattled: wide worried eyes, a wobble, a sweat drop, the sparkler sputtering. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) =>
    fr(90, { mood: "worried", near: "low", dx: i % 2 ? 1 : 0, bob: i % 4 === 2 ? 1 : 0, lit: i % 3 === 0 ? 0 : 0.3 }, i, { specks: sweat(i) }),
  ),
};

/** Defeat: a bump, the sparkler fizzles out in a curl of smoke, and the baby plops down on its bottom, a tear rolling. */
const LOW_TIP = tipOf({ near: "low", crouch: 1 });
const defeat: Anim = {
  loop: false,
  frames: [
    fr(90, { crouch: 2, dx: -1, mood: "hurt", near: "flinch", far: "out", lit: 0.3 }, 1, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    fr(130, { crouch: 1, mood: "worried", near: "low", lit: 0.2 }, 2),
    fr(150, { crouch: 1, mood: "sad", near: "low", lit: 0 }, 3, { specks: wisp(LOW_TIP, 0) }),
    fr(130, { crouch: 4, mood: "sad", near: "low", lit: 0 }, 4, { specks: wisp([LOW_TIP[0], LOW_TIP[1] + 3], 1) }),
    fr(130, { seat: "ground", mood: "hurt", near: "low", lit: 0, hy: 1 }, 5, { cue: "thud", shake: [1, 0] }),
    fr(220, { seat: "ground", mood: "sad", near: "low", lit: 0 }, 6, { specks: wisp(tipOf({ seat: "ground", near: "low" }), 2) }),
    fr(1000, { seat: "ground", mood: "sad", near: "low", lit: 0, hy: 1 }, 7, { specks: wisp(tipOf({ seat: "ground", near: "low" }), 4) }),
  ],
};

/** Victory: jumping for joy, both hooves up, the sparkler fizzing its biggest. Then again. */
const victory: Anim = {
  loop: true,
  frames: [0, 3, 5, 6, 5, 3, 0, 0, 0, 0].map((air, i) =>
    fr(110, { air, crouch: i === 0 || i === 6 ? 2 : i === 7 ? 1 : 0, near: "cheer", far: "up", mood: "happy", lit: 1.5, tail: i % 2 }, i, i === 1 ? { cue: "fizz" } : {}),
  ),
};

export const SIDEKICK_JEFFERSON: Character = {
  id: "sidekick-jefferson-opus-high",
  name: "Jefferson's sidekick",
  w: W,
  h: H,
  foot: [26, GROUND + OY],
  palette: PALETTE,
  halo: "#2e2218",
  parts: PARTS,
  anims: { idle, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory, walk, sit, wave },
};
