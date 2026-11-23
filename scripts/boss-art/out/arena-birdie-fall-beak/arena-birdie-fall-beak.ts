/**
 * Birdie's ultimate, scene A: the fall. A full-bleed cinematic picture (200 x 260, every pixel filled), not arena art.
 *  - fall (loop, 5 x 120 ms): a blurred cartoon sky, banded blue-grey to haze, pale clouds far below; young Birdie
 *    free falling for fun through it like a happy skydiver: belly toward us, head three-quarter left, wings spread
 *    wide, feet kicked out, tie streaming up over his shoulder, his eye a happy closed curve, his beak open in a whoop;
 *    his cap floating just above him to the right, his lifted right wing tip reaching for it; a little bank, bob and
 *    wing ride across the loop;
 *    vertical speed lines streaming up (a dash period of 5 steps, so the loop is seamless) and diagonal wind streaks.
 *  - approach (once, 9 x 390 ms, holds): the same sky and Birdie; the track rises out of the haze below, seen straight
 *    down its length by one camera (two rails a gauge apart running up the middle to one vanishing point at the centre
 *    of the horizon, sleepers evenly spaced so they close up with distance, gravel between), and his yellow diesel
 *    comes straight at us along it: a streamlined "bulldog" nose (a curved body, ray-marched and shaded from its
 *    surface: the chin tucked under, the nose bulging round the headlights, curving back to the two-pane windscreen,
 *    the charcoal roof cap, the red stripe right round it, a raked silver pilot below), from two dots in the haze to
 *    the bottom half, its headlights (keys W and V) brighter each frame and lighting the rails ahead; Birdie (still
 *    gliding happily, the cap with him) drops straight down into its path, centred over the track, and in the last frame the nose is on him, the lamps
 *    flaring either side of him; the lines stream faster and the wind streaks thicken.
 * Layers: the sky (one part), the ground and track (one part per approach frame), the lines, the train (outlined),
 * then Birdie as parts (right wing, left wing, body, tie) and his cap, all outlined in k.
 */
import { canvas, toGrid } from "../../../../packages/app/src/characters/paint.ts";
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Part } from "../../../../packages/app/src/characters/sprite.ts";

const PALETTE: Record<string, string> = {
  k: "#1d1411", // outline
  a: "#3d2e27", // his brown: deep shadow to light (and the sleepers' wood)
  b: "#5c4638",
  c: "#7c624f",
  d: "#9c8069",
  e: "#bfa58b",
  f: "#8f6c5b", // breast and face: warm buff
  g: "#b08773",
  h: "#cea58c",
  s: "#2b1f1b", // dark feather edges and spots
  o: "#cfd8d6", // the ring round his eye
  x: "#0d0909", // the eye
  w: "#fffaf0", // the glint; a lamp's hot core
  B: "#3e373c", // beak
  R: "#6a1222", // tie: burgundy, dark to light (and his open mouth)
  T: "#a52238",
  U: "#d64a5a",
  "1": "#0f1328", // cap: navy, dark to light
  "2": "#1c2850",
  "3": "#2d3f7c",
  "4": "#4a60a8",
  K: "#a87414", // gold band
  L: "#f2c14e",
  u: "#9a6a08", // the train: yellow, dark to light
  v: "#d49a12",
  y: "#f4c21e",
  Y: "#ffe27a",
  m: "#23232b", // roof: charcoal
  n: "#3b3b46",
  N: "#5a5a68",
  q: "#cc2a2a", // the red stripe
  j: "#4a4f5a", // silver: dark, mid, light (trucks, pilot, rails)
  l: "#8d94a1",
  J: "#d3d8e0",
  W: "#fff3b8", // the near headlight
  V: "#fff3b8", // the far headlight
  z: "#24303e", // windows
  Z: "#6d8aa2",
  "5": "#7f93ab", // the sky: blue-grey at the top to a pale haze
  "6": "#9aaec2",
  "7": "#b7c7d4",
  "8": "#d3dee5",
  "9": "#ecf1f3",
  "0": "#94a4a8", // the ground in the haze, far to near
  G: "#7a8c92",
};

const FW = 200;
const FH = 260;
const TAU = Math.PI * 2;
const rad = (d: number) => (d * Math.PI) / 180;
type Pt = readonly [number, number];
type Fn = (x: number, y: number) => string | null;

const ramp = (r: string, l: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(l * r.length)))]!;
const hash = (x: number, y: number) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 97;
const rot = (x: number, y: number, deg: number): Pt => {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [x * c - y * s, x * s + y * c];
};
function pip(pts: readonly Pt[], x: number, y: number): boolean {
  let inside = false;
  pts.forEach(([x0, y0], i) => {
    const [x1, y1] = pts[(i + 1) % pts.length]!;
    if (y0 <= y !== y1 <= y && x < x0 + ((y - y0) / (y1 - y0)) * (x1 - x0)) inside = !inside;
  });
  return inside;
}

/** A part from a function over a box: (x0, y0) its top left in the coordinates `fn` is given (pixel indices). */
function box(x0: number, y0: number, w: number, h: number, fn: Fn, outline = true): Part {
  const cv = canvas(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = fn(x + x0, y + y0);
      if (k) cv[y]![x] = k;
    }
  return { grid: toGrid(cv), outline };
}

const { parts: PARTS, add } = lazyParts();

// ---------------------------------------------------------------- the sky

/** Banded with a 6-row dither between bands. */
const BANDS: readonly [number, string][] = [
  [46, "6"],
  [100, "7"],
  [158, "8"],
];
function skyBand(x: number, y: number): string {
  let k = "5";
  for (const [b, next] of BANDS) {
    const r = y - (b - 3);
    if (r >= 6) k = next;
    else if (r >= 0) {
      const lower = r < 2 ? (x + y) % 4 === 0 : r < 4 ? (x + y) % 2 === 0 : (x + y) % 4 !== 0;
      if (lower) k = next;
      break;
    } else break;
  }
  return k;
}
/** Soft clouds far below and blurred wisps: [cx, cy, rx, ry, key]. */
const CLOUDS: readonly [number, number, number, number, string][] = [
  [150, 72, 34, 2.5, "7"],
  [30, 118, 26, 3, "8"],
  [176, 150, 22, 3.5, "9"],
  [34, 196, 36, 7, "9"],
  [168, 214, 30, 6, "9"],
  [96, 236, 40, 8, "9"],
  [18, 246, 22, 5, "9"],
  [186, 250, 26, 6, "9"],
];
function skyKey(x: number, y: number): string {
  let k = skyBand(x, y);
  for (const [cx, cy, rx, ry, ck] of CLOUDS) {
    const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
    if (d <= 0.55) k = ck;
    else if (d <= 1 && (x + y) % 2 === 0) k = ck;
    else if (d <= 1.4 && (x + 2 * y) % 4 === 0) k = ck;
  }
  return k;
}
add("sky", () => box(0, 0, FW, FH, skyKey, false));

// ---------------------------------------------------------------- the lines (speed lines up, wind streaks across)

/** Vertical speed lines: [x, period, dash, phase, dark]. Each moves up period/5 a step, so 5 steps loop. */
const SPEED: readonly [number, number, number, number, boolean][] = [
  [7, 90, 44, 3, false],
  [21, 60, 26, 41, false],
  [34, 90, 52, 61, true],
  [48, 60, 22, 17, false],
  [61, 90, 30, 80, false],
  [139, 60, 28, 9, false],
  [152, 90, 46, 33, true],
  [166, 60, 24, 50, false],
  [179, 90, 38, 12, false],
  [192, 60, 30, 27, false],
];
/** Wind streaks: [x0, y0, length, slope, phase]. Dashed along themselves, moving a step each frame. */
const WIND: readonly [number, number, number, number, number][] = [
  [8, 34, 46, 0.18, 0],
  [124, 22, 60, 0.12, 7],
  [140, 104, 50, -0.22, 3],
  [4, 150, 40, -0.3, 11],
  [60, 176, 54, 0.1, 5],
  [150, 186, 44, 0.2, 13],
];
function linesPart(step: number, speed: number, thick: boolean): Part {
  const cv = canvas(FW, FH);
  for (const [x, period, dash, phase, dark] of SPEED) {
    const off = phase + step * speed * (period / 30);
    for (let y = 0; y < FH; y++) {
      const m = (((y + off) % period) + period) % period;
      if (m >= dash) continue;
      // Light lines: pale on the blue, a hair paler in the haze; a few darker ones low down. The tail end dashed.
      if (m > dash * 0.7 && m % 2 === 1) continue;
      const k = dark ? (y < 110 ? "8" : "6") : y < 110 ? "8" : "9";
      cv[y]![x] = k;
      if (!dark && m < 3) cv[y]![x] = "9";
    }
  }
  for (const [x0, y0, len, slope, phase] of WIND) {
    for (let i = 0; i < len; i++) {
      const m = (i + phase + step * 5) % 25;
      if (m >= 16) continue;
      const x = x0 + i;
      const y = Math.round(y0 + i * slope);
      if (x >= FW || y < 0 || y >= FH) continue;
      cv[y]![x] = "9";
      if (thick && m > 2 && m < 13) cv[y + 1] && (cv[y + 1]![x] = "8");
    }
  }
  return { grid: toGrid(cv), outline: false };
}

// ---------------------------------------------------------------- Birdie (painted in pixels about his middle)

const BR = 80; // half the size of each of his parts' boxes

/** His pose for a glide phase (0..4 loops): a little bank one way then the other, the wings riding the air, a bob. */
function pose(ph: number) {
  const a = (TAU * ph) / 5;
  return {
    tilt: Math.round(4 * Math.sin(a)),
    flap: Math.round(7 * Math.sin(a + 1.2)),
    bob: Math.round(2 * Math.sin(a + 0.6)),
    tie: Math.round(12 * Math.sin(a + 2)),
    kick: Math.sin(a + 0.4),
  };
}

/** Distance from (x, y) to the segment a-b. */
function segD(x: number, y: number, a: Pt, b: Pt): number {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(x - a[0] - t * vx, y - a[1] - t * vy);
}

/**
 * The happy skydiver: belly toward us, head three-quarter to the left (his beak open in a whoop, his eye a happy
 * closed curve), a short tail fanned below, his feet kicked out. Banked `tilt` degrees; `kick` (-1..1) swings his feet.
 */
function bodyFn(tilt: number, kick: number): Fn {
  const tail: Pt[] = [[-6, 12], [6, 12], [9.5, 24], [4, 26.5], [0, 24.5], [-4, 26.5], [-9.5, 24]];
  const legL: [Pt, Pt] = [[-5, 14], [-11, 19.5 - 1.5 * kick]];
  const legR: [Pt, Pt] = [[5, 14], [11.5, 18.5 + 1.5 * kick]];
  return (px, py) => {
    const X = px + 0.5;
    const Y = py + 0.5;
    const [lx, ly] = rot(X, Y, -tilt);
    const l = 0.62 - (0.4 * X) / 20 - (0.5 * Y) / 22;
    // The happy eye: a closed upward curve (his joy lid).
    const de = Math.hypot(lx + 7, ly + 14.6);
    if (Math.abs(de - 2.6) < 0.95 && ly < -14.2) return "x";
    // The open beak: the upper mandible and the lower one dropped in a whoop, the sky seen between them.
    // (Drawn tipped up 18 degrees about its base: a whoop at the sky.)
    const [bx, by] = rot(lx + 12, ly + 13, -14);
    // Each half a little curved: the upper's ridge arched to a slightly dipped tip, the lower's chin rounded.
    const UPPER: Pt[] = [[1.5, -6.2], [-3.5, -5.5], [-8, -4.4], [-11.2, -3], [-8.5, -2.6], [1.5, -1]];
    const LOWER: Pt[] = [[0.5, 1.6], [-8.6, 3], [-6.5, 4.6], [-2, 5.4], [0.5, 5.5]];
    if (pip(UPPER, bx, by)) return segD(bx, by, [1.5, -5.7], [-7.5, -4.1]) < 0.8 ? "l" : "B";
    if (pip(LOWER, bx, by)) return segD(bx, by, [0.5, 4.9], [-5, 4.5]) < 0.7 ? "j" : "B";
    // Between the halves: nothing (a gap the sky shows through; the part's own outline rings each half), but for the
    // gape's corner, which the face fills.
    if (pip([[1, -1.2], [-12, -3.4], [-10, 3.2], [0.5, 1.6]], bx, by) && bx < -1.2) return null;
    const head = Math.hypot(lx + 3, ly + 15) <= 10.5;
    const neck = ((lx + 2) / 8.5) ** 2 + ((ly + 6) / 7) ** 2 <= 1;
    const body = (lx / 14.5) ** 2 + ((ly - 3.5) / 13.8) ** 2 <= 1;
    const fluff = (lx / 16.2) ** 2 + ((ly - 3.5) / 15.4) ** 2 <= 1 && hash(Math.floor(lx), Math.floor(ly)) % 7 < 2 && ly > -4;
    if (head) {
      // A rosy cheek under the eye, the dark sparrow mark behind it.
      if (((lx + 5.2) / 2.3) ** 2 + ((ly + 10.6) / 1.2) ** 2 <= 1 && (Math.floor(X) + Math.floor(Y)) % 2 === 0) return "U";
      if (lx > 0.5 && lx < 2.2 && ly > -12.5 && ly < -9) return "s";
      const face = ((lx + 7) / 7.5) ** 2 + ((ly + 11) / 7.5) ** 2 <= 1 || ly > -8.5;
      if (face) return ramp("fgh", l + 0.15);
      // The brown crown, streaked darker.
      const streak = (Math.floor(lx * 0.8 + ly * 0.4) % 3 === 0 && ly < -16) ? 0.25 : 0;
      return ramp("bcde", l - 0.2 - streak);
    }
    if (body || neck || fluff) {
      const breast = ((lx + 2) / 10) ** 2 + ((ly - 4) / 12.5) ** 2 <= 1 || (neck && ly < -2);
      if (breast) {
        const fleck = ly > 0 && Math.floor(ly) % 3 === 0 && (Math.floor(lx) + Math.floor(ly)) % 4 === 0;
        return ramp("fgh", l + 0.28 - (fleck ? 0.3 : 0));
      }
      return ramp("bcde", l - 0.18);
    }
    // His feet kicked out: thin legs, a little three-toed foot at each end.
    for (const [a, b] of [legL, legR]) {
      if (segD(lx, ly, a, b) < 1.1) return lx < 0 ? "U" : "T";
      const dir = b[0] < 0 ? -1 : 1;
      for (const ang of [-40, 0, 40]) {
        const [tx, ty] = rot(dir * 3, 0, dir * (ang + 20));
        if (segD(lx, ly, b, [b[0] + tx, b[1] + ty]) < 0.95) return "U";
      }
    }
    if (pip(tail, lx, ly)) {
      if (ly > 23.5) return "s";
      return ramp("bc", l + 0.25);
    }
    return null;
  };
}

/** A covert feather's tile (5 x 4): `*` is its body. */
const FEATHER = ["b***c", "b***b", "ab*ba", "aeeea"];
const DARKER: Record<string, string> = { e: "d", d: "c", c: "b", b: "a", a: "a", s: "s" };

/** An open wing from shoulder (sx, sy), heading `deg` degrees on the screen, `len` long. */
function wingFn(sx: number, sy: number, deg: number, len: number, far: boolean): Fn {
  const ux = Math.cos(rad(deg));
  const uy = Math.sin(rad(deg));
  let nx = -uy;
  let ny = ux;
  if (-nx - ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  const lead = (f: number) => 1.2 + 4.2 * (1 - f * f);
  const trail = (f: number) => 7.6 * Math.sin(Math.PI * (0.2 + 0.8 * Math.min(1, f) ** 1.3));
  return (px, py) => {
    const X = px + 0.5 - sx;
    const Y = py + 0.5 - sy;
    const s = X * ux + Y * uy;
    const t = X * nx + Y * ny;
    if (s < 0) {
      if (!(s * s + t * t <= 20 && t <= lead(0) && t >= -trail(0))) return null;
    } else {
      if (s > len) return null;
      const f = s / len;
      if (t > lead(f) || t < -trail(f)) return null;
      if (f > 0.45 && t < -trail(f) + 2 && Math.floor(s) % 4 === 0) return null;
    }
    const f = Math.max(0, s / len);
    const l = 0.55 + 0.07 * t - 0.25 * f;
    let k: string;
    if (f > 0.5 || t < -trail(f) * 0.35) {
      if (f <= 0.55 && t < -trail(f) + 1.5) k = "e";
      else if (Math.floor(t + 20) % 2 === 0) k = f > 0.8 ? "s" : "a";
      else k = f > 0.85 ? "b" : ramp("bc", l + 0.3);
    } else if (t > lead(f) - 1.2) k = "e";
    else {
      const ix = Math.floor(px);
      const iy = Math.floor(py);
      const row = Math.floor(iy / 4);
      const cu = (((ix + (((row % 2) + 2) % 2) * 3) % 5) + 5) % 5;
      const cv = ((iy % 4) + 4) % 4;
      const c = FEATHER[cv]![cu]!;
      k = c === "*" ? ramp("cde", l + 0.2) : c;
    }
    return far ? DARKER[k] ?? k : k;
  };
}

/** His tie: the knot at his throat, the blade streaming up over his shoulder in the wind, rippling. */
function tieFn(tilt: number, sway: number, ph: number): Fn {
  const [tx, ty] = rot(-2.5, -3, tilt);
  const deg = -30 + tilt + sway;
  const ux = Math.cos(rad(deg));
  const uy = Math.sin(rad(deg));
  const nx = -uy;
  const ny = ux;
  const LEN = 15;
  return (px, py) => {
    const X = px + 0.5 - tx;
    const Y = py + 0.5 - ty;
    const s = X * ux + Y * uy;
    if (s < -1.8 || s > LEN) return null;
    const wave = 1.6 * Math.sin(ph * 1.3 + s / 3) * Math.max(0, (s - 3) / LEN);
    const t = X * nx + Y * ny - wave;
    // The knot (square), a narrow neck, the blade widening to a point.
    const hw = s < 1.8 ? 1.9 : s < 3 ? 1.1 : s < LEN - 3.5 ? 1.3 + (s - 3) * 0.17 : 3.2 * ((LEN - s) / 3.5);
    if (Math.abs(t) > hw) return null;
    if (s < 1.8) return t < -0.4 ? "T" : "R";
    return t < -hw * 0.3 ? "U" : t > hw * 0.5 ? "R" : "T";
  };
}

/** The cap, turned `deg`: a round navy crown, the gold band, the stiff brim to the left. */
function capFn(deg: number): Fn {
  return (px, py) => {
    const X = px + 0.5;
    const Y = py + 0.5;
    const [lx, ly] = rot(X, Y, -deg);
    const l = 0.6 - (0.45 * X) / 12 - (0.5 * Y) / 9;
    if (ly <= 1.5 && ((lx - 1) / 10) ** 2 + ((ly - 1.5) / 8.5) ** 2 <= 1) {
      if (Math.hypot(lx - 1, ly + 6.5) < 1.3) return "4";
      return ramp("234", l);
    }
    if (ly > 1.5 && ly <= 4.5 && lx >= -9 && lx <= 11) return ly <= 3 ? "L" : "K";
    if (ly > 4.5 && ly <= 7 && lx >= -16 && lx <= -4) return ly <= 5.5 ? "2" : "1";
    return null;
  };
}

/** He is painted this much bigger than his shapes' units (every pixel still sampled on its own). */
const ZS = 1.32;
const zoom = (fn: Fn, z = ZS): Fn => (px, py) => fn((px + 0.5) / z - 0.5, (py + 0.5) / z - 0.5);
/** His wings spread wide: the left one gliding level under his beak, the right one (a shade darker) lifted, its tip reaching for the cap. */
function birdParts(ph: number) {
  const p = pose(ph);
  const [lsx, lsy] = rot(-9, -2, p.tilt);
  const [rsx, rsy] = rot(9, -4, p.tilt);
  return {
    far: add(`wf:${ph}`, () => box(-BR, -BR, 2 * BR, 2 * BR, zoom(wingFn(rsx, rsy, -36 + p.tilt - p.flap, 36, true)))),
    near: add(`wn:${ph}`, () => box(-BR, -BR, 2 * BR, 2 * BR, zoom(wingFn(lsx, lsy, -166 + p.tilt + p.flap, 37, false)))),
    body: add(`bd:${ph}`, () => box(-BR, -BR, 2 * BR, 2 * BR, zoom(bodyFn(p.tilt, p.kick)))),
    tie: add(`tie:${ph}`, () => box(-BR, -BR, 2 * BR, 2 * BR, zoom(tieFn(p.tilt, p.tie, ph)))),
  };
}
function capPart(deg: number): string {
  const d = ((Math.round(deg) % 360) + 360) % 360;
  return add(`cap:${d}`, () => box(-24, -24, 48, 48, zoom(capFn(d), 1.2)));
}

/** Birdie's layers, his middle at (cx, cy), the cap's middle at (kx, ky) turned kd. */
function birdie(ph: number, cx: number, cy: number, kx: number, ky: number, kd: number): Layer[] {
  const b = birdParts(ph);
  const at = (part: string): Layer => ({ part, x: cx - BR, y: cy - BR });
  return [at(b.far), at(b.near), at(b.body), at(b.tie), { part: capPart(kd), x: Math.round(kx) - 24, y: Math.round(ky) - 24 }];
}

// ---------------------------------------------------------------- the ground, the track and the train

/**
 * One camera for the track and the train, in metres: X across the track (its middle 0, + toward the camera's side), Y up
 * (the rails' tops 0), Z along the track away from us. The camera sits at (CX, CH, 0) looking straight down the track,
 * so the rails run to one vanishing point (OX on the horizon); the horizon slides up as he falls.
 */
const OX = 100;
const FL = 120;
const CX = 0;
const CH = 2.5;
/** The track: the rails' middles at ±GAUGE, their heads RAIL each side of that, RAILH tall; sleepers every SLEEP, SLW
 * wide, SLL each side of the middle; the ballast BAL each side, its top at BALY. */
const GAUGE = 0.8;
const RAIL = 0.085;
const RAILH = 0.17;
const SLEEP = 0.72;
const SLW = 0.3;
const SLL = 2.2;
const BAL = 2.7;
const BALY = -0.35;
/** The train's nose: from Z_FAR (two dots in the haze) to Z_NEAR (the bottom third). */
const Z_FAR = 70;
const Z_NEAR = 2.95;
/** The headlights set into the nose: at X ±LAMP_X (W at +, V at -), LAMP_Y up, LAMP_R round. */
const LAMP_X = 0.98;
const LAMP_Y = 1.72;
const LAMP_R = 0.25;

interface Approach {
  j: number;
  hz: number;
  /** The nose's distance. */
  zt: number;
  /** How bright the lamps are, 0..1. */
  L: number;
  /** The haze: distances look this much farther (the early frames are all haze). */
  fog: number;
}
function approachAt(j: number): Approach {
  const t = j / 8;
  return {
    j,
    hz: Math.round(218 - 98 * Math.pow(t, 1.15)),
    zt: Z_NEAR * Math.pow(Z_FAR / Z_NEAR, 1 - Math.pow(t, 1.1)),
    L: t,
    fog: 1 + 2.5 * Math.pow(1 - t, 1.5),
  };
}
const proj = (a: Approach, X: number, Y: number, Z: number): Pt => [OX + (FL * (X - CX)) / Z, a.hz + (FL * (CH - Y)) / Z];

/** The ground and the track for an approach frame: every pixel below the horizon, cast back onto the ground. */
function groundPart(j: number): Part {
  const a = approachAt(j);
  return box(
    0,
    0,
    FW,
    FH,
    (x, y) => {
      if (y < a.hz) return null;
      const sx = x + 0.5;
      const dy = Math.max(0.3, y + 0.5 - a.hz);
      const chk = (x + y) % 2 === 0;
      const toX = (Z: number) => CX + ((sx - OX) * Z) / FL;
      // The land: haze at the horizon, a little darker nearer, faint field bands.
      const zg = (FL * (CH - BALY)) / dy;
      const fz = zg * a.fog;
      let k = fz > 75 ? "8" : fz > 55 ? (chk ? "8" : "7") : fz > 30 ? "7" : fz > 22 ? (chk ? "7" : "0") : fz > 11 ? "0" : fz > 8 ? (chk ? "0" : "G") : "G";
      if (fz > 11 && fz < 75 && Math.floor(Math.log(zg) * 7) % 4 === 0 && (x + y) % 3 === 0) k = k === "7" ? "8" : k === "0" ? "7" : k;
      // What the headlights can light here, and where it is.
      let lit: "rail" | "sleeper" | "ballast" | null = null;
      let zq = zg;
      let xq = toX(zg);
      // The ballast under the track: gravel near, a darker band receding into the haze.
      if (Math.abs(xq) < BAL) {
        if (fz > 65) k = chk ? "8" : "7";
        else if (fz > 38) k = "0";
        else if (fz > 22) k = chk ? "0" : "c";
        else {
          const hh = hash(x, y);
          k = hh < 16 ? "d" : hh < 34 ? "c" : hh < 44 ? "e" : hh < 54 ? "l" : hh < 70 ? "b" : "0";
        }
        lit = "ballast";
      }
      // The sleepers, row by row (a row of the picture is one distance down the track): evenly spaced on the ground, so
      // closer together and thinner with distance; left out where they'd be under 2.4 pixels apart (the haze takes over).
      const KS = FL * (CH + RAILH);
      const zs = KS / dy;
      const sp = (KS * SLEEP) / (zs * zs);
      if (sp >= 2.4 && zs * a.fog < 46) {
        const za = KS / (dy + 0.5);
        const zb = dy > 0.5 ? KS / (dy - 0.5) : 1e9;
        const n0 = Math.round(zs / SLEEP);
        let hit: string | null = null;
        for (let n = n0 - 1; n <= n0 + 1 && !hit; n++) {
          const s0 = n * SLEEP - SLW / 2;
          const s1 = n * SLEEP + SLW / 2;
          const ov = Math.min(zb, s1) - Math.max(za, s0);
          if (ov > 0.5 * Math.min(zb - za, SLW) && Math.abs(toX(n * SLEEP)) <= SLL) {
            hit = zb > s1 && zb - za < SLW * 0.6 ? "edge" : "top";
            zq = n * SLEEP;
          }
        }
        // The sleeper's near face, under its top.
        for (let n = n0; n <= n0 + 2 && !hit; n++) {
          const zf = n * SLEEP - SLW / 2;
          const yh = CH - (dy * zf) / FL;
          if (yh >= BALY && yh <= -RAILH && Math.abs(toX(zf)) <= SLL) {
            hit = "front";
            zq = zf;
          }
        }
        if (hit) {
          const sfz = zq * a.fog;
          k = sfz < 18 ? (hit === "front" ? "a" : hit === "edge" ? "d" : "c") : sfz < 30 ? (hit === "front" ? "a" : "b") : chk ? "b" : "0";
          lit = "sleeper";
          xq = toX(zq);
        }
      }
      // The rails: a head (lit at its left) and the web's side under it, toward us; faint lines in the haze.
      const zr = (FL * CH) / dy;
      const zr2 = (FL * (CH + RAILH)) / dy;
      const rfz = zr * a.fog;
      if (rfz < 95)
        for (const xr of [-GAUGE, GAUGE]) {
          let lo = OX + (FL * (xr - RAIL - CX)) / zr;
          let hi = OX + (FL * (xr + RAIL - CX)) / zr;
          const web = OX + (FL * (xr + RAIL - CX)) / zr2;
          if (hi - lo < 1) {
            const m = (lo + hi) / 2;
            lo = m - 0.5;
            hi = m + 0.5;
          }
          if (sx >= lo && sx < hi) {
            if (rfz > 60) k = "7";
            else if (rfz > 36) k = "6";
            else if (rfz > 20) k = "l";
            else {
              k = sx - lo < (hi - lo) * 0.55 ? "J" : "l";
              // Rivets along the near rails' heads.
              const ra = (FL * CH) / (dy + 0.5);
              const rb = (FL * CH) / (dy - 0.5);
              if (hi - lo >= 2.4 && Math.floor(rb / 0.45) !== Math.floor(ra / 0.45) && Math.abs(sx - (lo + hi) / 2) < 0.75) k = "j";
            }
            lit = "rail";
            zq = zr;
            xq = xr;
          } else if (sx >= hi && sx < web && rfz < 36) k = rfz > 20 ? "j" : lit === "sleeper" ? "m" : "j";
        }
      // The headlights' light thrown ahead of the train onto the track: brighter each frame.
      if (a.L > 0.2 && lit) {
        const dz = a.zt - zq;
        const reach = 1.5 + 5 * a.L;
        if (dz > 0 && dz < reach)
          for (const lx of [-LAMP_X, LAMP_X]) {
            const u = (xq - lx) / (0.5 + 0.3 * dz);
            const d = u * u + (dz / reach) ** 2;
            if (d >= 1) continue;
            const dens = a.L * (1 - d);
            if (lit === "rail") k = dens > 0.45 ? "w" : dens > 0.22 ? "Y" : k;
            else if (lit === "sleeper" && Math.abs(u) < 0.7 && (dens > 0.6 || (dens > 0.4 && chk))) k = k === "a" ? "d" : "Y";
            else if (lit === "ballast" && dens > 0.65 && (x + 2 * y) % 4 === 0) k = "e";
          }
      }
      return k;
    },
    false,
  );
}

/**
 * The locomotive as boxes in its own metres (z from the nose's front back along the track), each painting its faces:
 * f its front (toward us), t its top, r its right side (toward the camera), l, b. Light from the top left: tops
 * brightest, fronts lit, the right sides in shade.
 */
type Face = "f" | "t" | "r" | "l" | "b";
interface Solid {
  x: readonly [number, number];
  y: readonly [number, number];
  z: readonly [number, number];
  paint: (f: Face, X: number, Y: number, z: number, px: number, sy: number) => string;
  /** A hit counts only where this holds (round wheels, the nose's round corners). */
  keep?: (X: number, Y: number, z: number) => boolean;
}
/** Within `hw` of `c`, but never under a pixel thick (px: pixels per metre there). */
const near = (v: number, c: number, hw: number, px: number) => Math.abs(v - c) * px < Math.max(0.5, hw * px);
type Paint = Solid["paint"];

/** The hood's side vents, its roof fans, the two trucks' middles. */
const VENTS: readonly [number, number][] = [[5.0, 6.6], [7.2, 8.8], [9.4, 11.0], [11.6, 13.2], [13.8, 15.6]];
const FANS = [12.2, 14.2, 16.1];
const TRUCKS = [2.7, 14.3];

const SOLIDS: Solid[] = [];
const solid = (x: Solid["x"], y: Solid["y"], z: Solid["z"], paint: Paint, keep?: Solid["keep"]) => SOLIDS.push({ x, y, z, paint, keep });

// The coupler, poking out of the pilot.
solid([-0.13, 0.13], [0.5, 0.68], [-0.72, -0.2], (f) => (f === "t" ? "l" : "j"));
// The underframe, dark.
solid([-1.0, 1.0], [0.7, 0.96], [0.4, 17.2], () => "m");
// The fuel tank between the trucks.
solid([-1.3, 1.3], [0.42, 0.96], [5.4, 11.6], (f, X, Y, z, px) => (f === "t" ? "l" : f === "f" ? "j" : near(Y, 0.9, 0.04, px) ? "l" : Y < 0.52 ? "m" : "j"));
// The trucks: big wheels on the rails (round, a hub, a lit rim at the top left), a silver side frame across them.
for (const zc of TRUCKS) {
  for (const wz of [zc - 1.15, zc, zc + 1.15])
    for (const xs of [[0.72, 1.04], [-1.04, -0.72]] as const)
      solid(
        xs,
        [0, 1.0],
        [wz - 0.5, wz + 0.5],
        (f, X, Y, z) => {
          if (f !== "r" && f !== "l") return "m";
          const d = Math.hypot(z - wz, Y - 0.5) / 0.5;
          if (d > 0.8) return "m";
          if (d < 0.26) return "l";
          if (d > 0.56 && Y > 0.45 && z < wz + 0.15) return "l";
          return "j";
        },
        // Round from the side; from the front (its leading face) a wheel is a dark block standing on the rail.
        (X, Y, z) => Math.hypot(z - wz, Y - 0.5) <= 0.5 || Math.abs(z - (wz - 0.5)) < 0.01,
      );
  solid([-1.22, 1.22], [0.62, 0.92], [zc - 1.75, zc + 1.75], (f, X, Y, z, px) => (f === "t" ? "J" : f === "f" ? "j" : near(Y, 0.89, 0.04, px) ? "J" : Y < 0.68 ? "j" : "l"));
}
// The deck (the walkway along the hood), yellow, the thin red stripe right round it.
solid([-1.9, 1.9], [0.95, 1.36], [4.3, 17.4], (f, X, Y, z, px) => {
  if (f === "t") return "u";
  if (near(Y, 1.17, 0.06, px)) return "q";
  if (f === "f") return Y > 1.17 ? "y" : "v";
  return Y > 1.17 ? "v" : "u";
});
/**
 * The streamlined "bulldog" nose and cab, one curved body (not boxes): z = 0 is the nose's most forward point. In side
 * view the chin tucks under, the nose bulges forward round the headlights and curves back up to a near-flat top, the
 * windscreen slopes back above it, then the roof's curve; in plan the whole front is rounded back toward its sides; in
 * cross-section the roof has round shoulders. Shaded from its true surface normal, light from the top left.
 */
const NW = 1.9; // half its width
const NB = 0.85; // its bottom (the chin)
const NT = 4.45; // its roof
const NR = 0.62; // the roof's shoulder radius
const NBACK = 4.3; // where it meets the hood
const NOSE_Y = 1.72; // the nose's most forward height
const SCREEN = [3.12, 4.04] as const; // the windscreen's band
const LV = (() => {
  const v = [-0.5, 0.8, -0.55];
  const m = Math.hypot(v[0]!, v[1]!, v[2]!);
  return v.map((c) => c / m) as [number, number, number];
})();
function roofY(ax: number): number {
  const c = NW - NR;
  return ax <= c ? NT : NT - NR + Math.sqrt(Math.max(0, NR * NR - (ax - c) ** 2));
}
/** How far back the front surface is at height Y on the middle line. */
function prof(Y: number): number {
  if (Y < NOSE_Y) {
    const u = Math.min(1, (NOSE_Y - Y) / (NOSE_Y - NB));
    return 0.3 * (1 - Math.sqrt(1 - 0.96 * u * u));
  }
  if (Y < SCREEN[0]) {
    const u = (Y - NOSE_Y) / (SCREEN[0] - NOSE_Y);
    return 1.6 * (1 - Math.sqrt(1 - 0.94 * u * u));
  }
  const z0 = 1.6 * (1 - Math.sqrt(0.06));
  if (Y < SCREEN[1]) return z0 + (Y - SCREEN[0]) * 0.72;
  const z1 = z0 + (SCREEN[1] - SCREEN[0]) * 0.72;
  const u = Math.min(1, (Y - SCREEN[1]) / (NT - SCREEN[1]));
  return z1 + 0.55 * (1 - Math.sqrt(1 - 0.98 * u * u));
}
/** The front surface: the profile, rounded back toward the sides (more on the nose than on the cab). */
function zf(ax: number, Y: number): number {
  const r = Math.min(1, ax / NW);
  const p = Y < 2.8 ? 1.0 : Y > 3.4 ? 0.6 : 1.0 - (0.4 * (Y - 2.8)) / 0.6;
  return prof(Y) + p * (0.35 * r * r + 0.65 * (1 - Math.sqrt(1 - 0.95 * r ** 4)));
}
function noseIn(X: number, Y: number, z: number): boolean {
  const ax = Math.abs(X);
  if (ax > NW || Y < NB || z > NBACK || Y > roofY(ax)) return false;
  return z >= zf(ax, Y);
}
/** The pilot (cowcatcher): a raked, rounded apron under the nose, narrower at the bottom. */
const PB = 0.38;
const pilotHW = (Y: number) => 1.2 + ((Y - PB) / (NB - PB)) * 0.4;
const pilotZ = (ax: number, Y: number) => -0.42 + (Y - PB) * 0.7 + 0.5 * (ax / pilotHW(Y)) ** 2;
function pilotIn(X: number, Y: number, z: number): boolean {
  if (Y < PB || Y > NB || z > 1.0) return false;
  const ax = Math.abs(X);
  if (ax > pilotHW(Y)) return false;
  return z >= pilotZ(ax, Y);
}
const norm = (v: [number, number, number]): [number, number, number] => {
  const m = Math.hypot(...v) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
};
const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
/** The outward normal of the nose where a ray met it. */
function noseNormal(X: number, Y: number, z: number): [number, number, number] {
  const ax = Math.abs(X);
  const sg = X < 0 ? -1 : 1;
  const dRoof = roofY(ax) - Y;
  const dFront = z - zf(ax, Y);
  if (dRoof < dFront) {
    const c = NW - NR;
    return ax <= c ? [0, 1, 0] : norm([(ax - c) * sg, Y - (NT - NR), 0]);
  }
  const e = 0.012;
  const gx = (zf(ax + e, Y) - zf(Math.max(0, ax - e), Y)) / (ax + e - Math.max(0, ax - e));
  const gy = (zf(ax, Y + e) - zf(ax, Y - e)) / (2 * e);
  return norm([gx * sg, gy, -1]);
}
const yellow = (lum: number) => (lum >= 0.7 ? "Y" : lum >= 0.42 ? "y" : lum >= 0.16 ? "v" : "u");
const glass = (u: number, v: number) => ((((u + v * 0.9) % 1) + 1) % 1 < 0.17 ? "Z" : "z");
/** The windscreen's two panes (|X|, Y): rounded at their outer top corners. */
function inPane(ax: number, Y: number, grow: number): boolean {
  const x0 = 0.15 - grow;
  const x1 = 1.42 + grow;
  const y0 = SCREEN[0] + 0.1 - grow;
  const y1 = SCREEN[1] - 0.1 + grow;
  if (ax < x0 || ax > x1 || Y < y0 || Y > y1) return false;
  const rc = 0.34 + grow;
  if (ax > x1 - rc && Y > y1 - rc && Math.hypot(ax - (x1 - rc), Y - (y1 - rc)) > rc) return false;
  const rb = 0.14 + grow;
  if (ax > x1 - rb && Y < y0 + rb && Math.hypot(ax - (x1 - rb), Y - (y0 + rb)) > rb) return false;
  return true;
}
function paintNose(X: number, Y: number, z: number, px: number): string {
  const ax = Math.abs(X);
  const n = noseNormal(X, Y, z);
  const lum = dot(n, LV);
  const hair = 1 / px;
  // The roof: charcoal, lit at its left shoulder.
  if (Y > SCREEN[1] + 0.1) return lum > 0.72 ? "N" : lum > 0.4 ? "n" : "m";
  // The windscreen: two panes, a dark frame round each, the body-coloured post between.
  if (inPane(ax, Y, 0)) return glass(X * 1.4, Y - SCREEN[0]);
  if (inPane(ax, Y, Math.max(0.07, hair))) return "m";
  // The red stripe, right round the nose at one height (it curves on the screen with the body).
  if (Y >= 1.24 && Y <= 1.24 + Math.max(0.2, 2 * hair)) return lum < 0.1 ? "T" : "q";
  // A thin pale line along the stripe's top edge where the light catches it.
  return yellow(lum);
}
function paintPilot(X: number, Y: number, z: number, px: number): string {
  const ax = Math.abs(X);
  if (Y > NB - Math.max(0.06, 1 / px)) return X < 0.4 ? "J" : "l";
  if (Y < PB + Math.max(0.06, 1 / px)) return "m";
  const slat = Math.floor((X + 3) / 0.15) % 2 === 0;
  if (ax / pilotHW(Y) > 0.7 && X > 0) return slat ? "j" : "m";
  return slat ? (X < -0.5 ? "J" : "l") : ax / pilotHW(Y) > 0.7 ? "m" : "j";
}
// The long hood behind the cab: side vents (louvres), its dark roof with fans and a stack.
solid([-1.5, 1.5], [1.36, 3.5], [4.25, 17.0], (f, X, Y, z, px, sy) => {
  if (f === "t") {
    for (const c of FANS) {
      const d = Math.hypot(X, z - c);
      if (d <= 0.62) return d > 0.46 ? "m" : d < 0.16 ? "l" : "j";
    }
    return X < -1.15 ? "N" : X > 1.3 ? "m" : "n";
  }
  if (f === "r") {
    if (Y > 3.3) return "y";
    for (const [z0, z1] of VENTS) {
      if (z >= z0 && z <= z1 && Y >= 2.05 && Y <= 3.1) return sy % 2 ? "m" : "u";
      if (near(z, z1 + 0.3, 0.03, px) && Y < 3.25) return "u";
    }
    return Y < 1.55 ? "u" : "v";
  }
  return "v";
});
solid([-0.22, 0.22], [3.5, 3.85], [5.4, 5.9], (f) => (f === "t" ? "m" : "j"));

/** Where a ray from the camera (dx, dy per metre along Z) first meets a solid placed with its nose at zt. */
function hitSolid(s: Solid, dx: number, dy: number, zt: number): { t: number; face: Face } | null {
  let tn = zt + s.z[0];
  let tf = zt + s.z[1];
  let face: Face = "f";
  const slab = (o: number, d: number, lo: number, hi: number, fLo: Face, fHi: Face): boolean => {
    if (Math.abs(d) < 1e-9) return o >= lo && o <= hi;
    let a = (lo - o) / d;
    let b = (hi - o) / d;
    let fa = fLo;
    if (a > b) {
      [a, b] = [b, a];
      fa = fHi;
    }
    if (a > tn) {
      tn = a;
      face = fa;
    }
    tf = Math.min(tf, b);
    return true;
  };
  if (!slab(CX, dx, s.x[0], s.x[1], "l", "r")) return null;
  if (!slab(CH, dy, s.y[0], s.y[1], "b", "t")) return null;
  if (tn > tf || tn <= 0) return null;
  return { t: tn, face };
}

/** The train in an approach frame: every pixel cast against the solids, edges inked where one solid stands before another, then the handrails and the headlights. */
function trainPart(j: number): Part {
  const a = approachAt(j);
  const zt = a.zt;
  const sig = FL / zt;
  const cv = canvas(FW, FH);
  const depth = Array.from({ length: FH }, () => Array<number>(FW).fill(Infinity));
  const who = Array.from({ length: FH }, () => Array<number>(FW).fill(-1));
  const ends = [proj(a, -2, 0, zt - 0.7), proj(a, -2, 4.5, zt - 0.7), proj(a, 2, 4.5, zt + 17.5), proj(a, 2, 0, zt - 0.7)];
  const x0 = Math.max(0, Math.floor(Math.min(...ends.map((p) => p[0]))) - 1);
  const x1 = Math.min(FW - 1, Math.ceil(Math.max(...ends.map((p) => p[0]))) + 1);
  const y0 = Math.max(0, Math.floor(Math.min(...ends.map((p) => p[1]))) - 1);
  const y1 = Math.min(FH - 1, Math.ceil(Math.max(...ends.map((p) => p[1]))) + 1);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - OX) / FL;
      const dy = -(y + 0.5 - a.hz) / FL;
      let best = Infinity;
      let key: string | null = null;
      for (let i = 0; i < SOLIDS.length; i++) {
        const s = SOLIDS[i]!;
        const h = hitSolid(s, dx, dy, zt);
        if (!h || h.t >= best) continue;
        const X = CX + dx * h.t;
        const Y = CH + dy * h.t;
        const z = h.t - zt;
        if (s.keep && !s.keep(X, Y, z)) continue;
        best = h.t;
        key = s.paint(h.face, X, Y, z, FL / h.t, y);
        who[y]![x] = i;
      }
      // The curved nose and the pilot: marched along the ray, the first touch refined.
      const at = (t: number) => [CX + dx * t, CH + dy * t, t - zt] as const;
      const which = (t: number) => {
        const [X, Y, z] = at(t);
        return noseIn(X, Y, z) ? 1 : pilotIn(X, Y, z) ? 2 : 0;
      };
      const tEnd = Math.min(best, zt + NBACK + 0.05);
      const STEP = 0.025;
      for (let t = zt - 0.65; t < tEnd; t += STEP) {
        const w = which(t);
        if (!w) continue;
        let lo = t - STEP;
        let hi = t;
        for (let r = 0; r < 7; r++) {
          const m = (lo + hi) / 2;
          if (which(m)) hi = m;
          else lo = m;
        }
        const [X, Y, z] = at(hi);
        const k2 = which(hi) || w;
        best = hi;
        key = k2 === 1 ? paintNose(X, Y, z, FL / hi) : paintPilot(X, Y, z, FL / hi);
        who[y]![x] = 100 + k2;
        break;
      }
      if (key) {
        cv[y]![x] = key;
        depth[y]![x] = best;
      }
    }
  // Ink where a nearer solid stands in front of a farther one (the cab's back edge on the hood, the roof's lip).
  if (sig >= 3) {
    const ink: [number, number][] = [];
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const w = who[y]![x]!;
        if (w < 0) continue;
        for (const [ex, ey] of N4S) {
          const o = who[y + ey]?.[x + ex];
          if (o === undefined || o < 0 || o === w) continue;
          if (depth[y + ey]![x + ex]! < depth[y]![x]! - 0.35) {
            ink.push([x, y]);
            break;
          }
        }
      }
    for (const [x, y] of ink) cv[y]![x] = "k";
  }
  // The handrails: posts and a rail along the walkway, drawn where nothing nearer hides them.
  const line = (p: readonly [number, number, number], q: readonly [number, number, number], key: string) => {
    const [ax, ay] = proj(a, p[0], p[1], zt + p[2]);
    const [bx, by] = proj(a, q[0], q[1], zt + q[2]);
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const px = Math.floor(ax + (bx - ax) * t);
      const py = Math.floor(ay + (by - ay) * t);
      if (px < 0 || py < 0 || px >= FW || py >= FH) continue;
      const iz = 1 / (zt + p[2]) + (1 / (zt + q[2]) - 1 / (zt + p[2])) * t;
      if (1 / iz <= depth[py]![px]! + 0.2) cv[py]![px] = key;
    }
  };
  if (sig >= 2.4) {
    const RX = 1.84;
    const RY = 2.4;
    line([RX, RY, 4.4], [RX, RY, 17.3], "J");
    for (const z of [4.4, 5.95, 7.5, 9.05, 10.6, 12.15, 13.7, 15.25, 16.8]) line([RX, 1.38, z], [RX, RY, z], "l");
  }
  // The headlights: round, W the near lamp and V the far one; the hot core w grows each frame; a silver rim.
  for (const [lx, key] of [[LAMP_X, "W"], [-LAMP_X, "V"]] as const) {
    const [cx, cy] = proj(a, lx, LAMP_Y, zt + zf(Math.abs(lx), LAMP_Y));
    const R = LAMP_R * sig;
    if (R < 1.3) {
      cv[Math.floor(cy)]![Math.floor(cx)] = a.L > 0.45 ? "w" : key;
      continue;
    }
    const core = R * (0.12 + 0.58 * a.L);
    const rim = R >= 2.2 ? 1 : 0;
    for (let y = Math.floor(cy - R - 2); y <= cy + R + 2; y++)
      for (let x = Math.floor(cx - R - 2); x <= cx + R + 2; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= core) cv[y]![x] = "w";
        else if (d <= R) cv[y]![x] = key;
        else if (d <= R + rim) cv[y]![x] = x + 0.5 - cx + (y + 0.5 - cy) < 0 ? "J" : "j";
      }
  }
  return { grid: toGrid(cv), outline: true };
}
const N4S = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

// ---------------------------------------------------------------- frames

const START: Pt = [102, 94];
const END: Pt = [100, 133];
/** The cap's place from his middle, and its turn, for a tumble phase. */
/** The cap's place from his middle (just above him, up by his left wing tip, bobbing in the wind), and its turn. */
function capAt(ph: number): [number, number, number] {
  const a = (TAU * ph) / 5;
  return [40 + 1.5 * Math.cos(a), -52 - 2 * Math.sin(a + 0.3), 14 + 10 * Math.sin(a)];
}

add("lines:f0", () => linesPart(0, 6, false));

const fall: Anim = {
  loop: true,
  frames: Array.from({ length: 5 }, (_, i): Frame => {
    const [kx, ky, kd] = capAt(i);
    const lines = add(`lines:f${i}`, () => linesPart(i, 6, false));
    const cy = START[1] + pose(i).bob;
    return {
      ms: 120,
      layers: [{ part: "sky", x: 0, y: 0 }, { part: lines, x: 0, y: 0 }, ...birdie(i, START[0], cy, START[0] + kx, cy + ky, kd)],
    };
  }),
};

const approach: Anim = {
  loop: false,
  frames: Array.from({ length: 9 }, (_, j): Frame => {
    const t = Math.pow(j / 8, 1.2);
    const cx = Math.round(START[0] + (END[0] - START[0]) * t);
    const cy = Math.round(START[1] + (END[1] - START[1]) * t) + pose(j % 5).bob;
    const [kx, ky, kd] = capAt(j % 5);
    const lines = j === 0 ? "lines:f0" : add(`lines:a${j}`, () => linesPart(j * 3.5, 6, j >= 4));
    return {
      ms: 390,
      ...(j === 0 ? { cue: "approach" } : j === 8 ? { cue: "hit" } : {}),
      layers: [
        { part: "sky", x: 0, y: 0 },
        { part: add(`ground:${j}`, () => groundPart(j)), x: 0, y: 0 },
        { part: lines, x: 0, y: 0 },
        { part: add(`train:${j}`, () => trainPart(j)), x: 0, y: 0 },
        ...birdie(j % 5, cx, cy, Math.round(cx + kx), Math.round(cy + ky), kd),
      ],
    };
  }),
};

export const ARENA_BIRDIE_FALL: Character = {
  id: "arena-birdie-fall-beak",
  name: "Birdie's fall",
  w: FW,
  h: FH,
  foot: [100, 255],
  palette: PALETTE,
  parts: PARTS,
  anims: { fall, approach },
};
