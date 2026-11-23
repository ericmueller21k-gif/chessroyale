/**
 * Birdie's ultimate, scene A: the fall. A full-bleed cinematic picture (200 x 260, every pixel filled), not arena art.
 *  - fall (loop, 5 x 120 ms): a blurred cartoon sky, banded blue-grey to haze, pale clouds far below; young Birdie
 *    tumbling backward through it, wings flung up, tie streaming, beak open, eye wide; his cap flying off above him;
 *    vertical speed lines streaming up (a dash period of 5 steps, so the loop is seamless) and diagonal wind streaks.
 *  - approach (once, 9 x 390 ms, holds): the same sky and Birdie; the track rises out of the haze below (two rails to a
 *    far point at the upper right, sleepers, ballast), his yellow toy diesel comes up it nose first, from a dot in the
 *    haze to the bottom third, its headlights (keys W, the near lamp, and V, the far one) brighter each frame; Birdie
 *    sinks toward it; the lines stream faster and the wind streaks thicken.
 * Layers: the sky (one part), the ground and track (one part per approach frame), the lines, the train (outlined),
 * then Birdie as parts (far wing, body, near wing, tie) and his cap, all outlined in k.
 */
import { canvas, toGrid } from "../../../../packages/app/src/characters/paint.ts";
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "../../../../packages/app/src/characters/sprite.ts";

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

/** His pose for a tumble phase (0..4 loops). */
function pose(ph: number) {
  const a = (TAU * ph) / 5;
  return {
    turn: Math.round(38 + 14 * Math.sin(a)),
    flap: Math.round(16 * Math.sin(a + 0.9)),
    tie: Math.round(10 * Math.sin(a + 2)),
    tiePh: ph,
  };
}

/** The body, head and tail, turned `turn` degrees clockwise (0: upright, facing left). */
function bodyFn(turn: number): Fn {
  const tail: Pt[] = [[9, -1], [33, 5], [37, 9], [33, 13], [9, 9]];
  const [ex, ey] = rot(-19.5, -13, turn);
  return (px, py) => {
    const X = px + 0.5;
    const Y = py + 0.5;
    // The eye, upright on the screen: a pale ring, a small dark pupil (wide with fright), a glint at its top left.
    const de = Math.hypot(X - ex, Y - ey);
    if (de <= 2.6) return Math.floor(X) === Math.floor(ex - 1) && Math.floor(Y) === Math.floor(ey - 1) ? "w" : "x";
    if (de <= 5.3) return "o";
    const [lx, ly] = rot(X, Y, -turn);
    const l = 0.6 - (0.4 * X) / 22 - (0.5 * Y) / 22;
    // Open beak: two mandibles, the mouth between.
    if (pip([[-25, -15], [-34, -13.4], [-25, -11]], lx, ly)) return ly < -13.4 + 0.5 ? "B" : "B";
    if (pip([[-25, -11], [-31.5, -9.2], [-25, -8.6]], lx, ly)) return "R";
    if (pip([[-25, -8.8], [-31, -8.6], [-25, -6.2]], lx, ly)) return "B";
    const head = Math.hypot(lx + 16, ly + 11) <= 11.5;
    const neck = ((lx + 10) / 8) ** 2 + ((ly + 3) / 8.5) ** 2 <= 1;
    const body = ((lx - 2) / 17) ** 2 + ((ly - 2) / 13) ** 2 <= 1;
    const fluff = ((lx - 2) / 19.5) ** 2 + ((ly - 2) / 15) ** 2 <= 1 && hash(Math.floor(lx), Math.floor(ly)) % 7 < 2 && lx > -6;
    const tl = pip(tail, lx, ly);
    if (head) {
      // The dark mark under his eye.
      if (Math.abs(lx + 14) < 1 && ly > -9 && ly < -6) return "s";
      const face = lx < -15 && ly > -12.5;
      return face ? ramp("fgh", l + 0.15) : ramp("bcde", l);
    }
    if (body || neck || fluff) {
      const breast = ((lx + 6) / 10.5) ** 2 + ((ly - 1) / 12) ** 2 <= 1 || ly > 11;
      if (breast) {
        const fleck = ly > -2 && Math.floor(ly) % 3 === 0 && (Math.floor(lx) + Math.floor(ly)) % 4 === 0;
        return ramp("fgh", l + 0.1 - (fleck ? 0.3 : 0));
      }
      return ramp("bcde", l - 0.05);
    }
    if (tl) {
      if (lx > 33) return "e";
      if (lx > 31) return "s";
      return ramp("bc", l + 0.2);
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

/** His tie: the knot at his throat, the blade streaming up and out to the left, rippling. */
function tieFn(turn: number, sway: number, ph: number): Fn {
  const [tx, ty] = rot(-10, 5, turn);
  const deg = -158 + sway;
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
function birdParts(ph: number) {
  const p = pose(ph);
  const [nsx, nsy] = rot(2, -7, p.turn);
  const [fsx, fsy] = rot(9, -9, p.turn);
  const dt = p.turn - 38;
  return {
    far: add(`wf:${ph}`, () => box(-BR, -BR, 2 * BR, 2 * BR, zoom(wingFn(fsx, fsy, -4 + dt - p.flap * 0.8, 33, true)))),
    body: add(`bd:${p.turn}`, () => box(-BR, -BR, 2 * BR, 2 * BR, zoom(bodyFn(p.turn)))),
    near: add(`wn:${ph}`, () => box(-BR, -BR, 2 * BR, 2 * BR, zoom(wingFn(nsx, nsy, -66 + dt + p.flap, 37, false)))),
    tie: add(`tie:${ph}`, () => box(-BR, -BR, 2 * BR, 2 * BR, zoom(tieFn(p.turn, p.tie, ph)))),
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
  return [at(b.far), at(b.body), at(b.near), at(b.tie), { part: capPart(kd), x: Math.round(kx) - 24, y: Math.round(ky) - 24 }];
}

// ---------------------------------------------------------------- the ground, the track and the train

/** The track's far point (x) and the near rails' spread: a rail is x = VX + σ (DXC ± GAUGE), σ = (y - horizon) / 110. */
const VX = 172;
const DXC = -80;
const GAUGE = 60;
/** The train's body recedes toward a point to the right of the track's (a slight turn, so we see its side). */
const QX = VX + 34;

interface Approach {
  hz: number;
  s: number;
  L: number;
}
function approachAt(j: number): Approach {
  const t = j / 8;
  return { hz: Math.round(218 - 98 * Math.pow(t, 1.15)), s: 0.14 + 0.86 * Math.pow(t, 1.9), L: t };
}
const trainAt = (a: Approach): Pt => [VX + DXC * a.s, a.hz + 110 * a.s];

/** Where the headlights are, in frame pixels: the near (W) and far (V) lamp's middles and radii. */
const LAMP_W: readonly [number, number, number] = [-38, -31, 9.5];
const LAMP_V: readonly [number, number, number] = [38, -31, 8.5];

function groundPart(j: number): Part {
  const a = approachAt(j);
  const [tcx, tby] = trainAt(a);
  const sleepers = Array.from({ length: 60 }, (_, k) => 1 / (0.52 + 0.13 * k));
  const lamps = [LAMP_W, LAMP_V].map(([u, , r]) => [tcx + u * a.s, r * a.s] as const);
  return box(
    0,
    0,
    FW,
    FH,
    (x, y) => {
      if (y < a.hz) return null;
      const sg0 = (y + 0.5 - a.hz) / 110;
      // The haze: in the first frames even the nearest ground is far and pale.
      const fog = Math.min(1, 0.22 + 0.2 * j);
      const sg = sg0 * fog;
      const X = x + 0.5;
      // The ground, haze at the horizon, a little darker nearer.
      let k: string;
      if (sg < 0.04) k = "8";
      else if (sg < 0.07) k = (x + y) % 2 ? "8" : "7";
      else if (sg < 0.2) k = "7";
      else if (sg < 0.26) k = (x + y) % 2 ? "7" : "0";
      else if (sg < 0.55) k = "0";
      else if (sg < 0.62) k = (x + y) % 2 ? "0" : "G";
      else k = "G";
      // Faint field bands in the haze.
      if (sg > 0.1 && Math.floor(1 / sg) % 3 === 0 && (x + y) % 3 === 0) k = k === "7" ? "8" : k === "0" ? "7" : k === "G" ? "0" : k;
      const mid = VX + sg0 * DXC;
      const far = sg < 0.1;
      // Ballast under the track.
      const ball = Math.abs(X - mid) < GAUGE * 1.5 * sg0;
      if (ball) {
        if (far) k = "7";
        else if (sg < 0.25) k = (x + y) % 2 ? "0" : "7";
        else {
          const hh = hash(x, y);
          k = hh < 14 ? "d" : hh < 30 ? "c" : hh < 40 ? "e" : hh < 50 ? "l" : sg > 0.5 ? "G" : "0";
        }
      }
      // Sleepers.
      let onSleeper = false;
      if (sg >= 0.16)
        for (const sk of sleepers) {
          const yk = a.hz + 110 * sk;
          const th = Math.max(0.5, 3.4 * sk);
          if (Math.abs(y + 0.5 - yk) <= th && Math.abs(X - (VX + sk * DXC)) <= GAUGE * 1.28 * sk) {
            const top = y + 0.5 - yk < -th + 1.2;
            k = sg < 0.3 ? "G" : top ? "c" : y + 0.5 - yk > th - 1.2 ? "a" : "b";
            onSleeper = true;
          }
        }
      // The rails.
      for (const side of [-1, 1]) {
        const rc = VX + sg0 * (DXC + side * GAUGE);
        const rw = Math.max(0.5, 2.6 * sg0);
        const rel = (X - rc) / rw;
        if (Math.abs(rel) <= 1) {
          if (far) k = sg < 0.05 ? "7" : "6";
          else if (sg < 0.25) k = "l";
          else k = rel < -0.35 ? "J" : rel < 0.45 ? "l" : "j";
          // Rivets on the near rails.
          if (sg > 0.75 && rel > -0.35 && rel < 0.45 && (y % 7 === 0)) k = "j";
        } else if (onSleeper && sg > 0.45 && Math.abs(rel) <= 1.9) k = Math.abs(rel) > 1.55 && y % 2 === 0 ? "J" : "j";
        else if (sg > 0.4 && rel > 1 && rel <= 1.6 && !onSleeper) k = "m";
      }
      // The headlights' light thrown ahead of the train on the track: brighter each frame.
      if (y > tby && a.L > 0.2)
        for (const [lx, lr] of lamps) {
          const dy = (y + 0.5 - tby) / (a.s * 34 * (0.6 + a.L));
          const dx = (X - lx) / (lr * (2.2 + dy * 1.5));
          const d = dx * dx + dy * dy;
          if (d > 1) continue;
          const lit = k === "J" || k === "l" ? (d < 0.5 ? "w" : "Y") : onSleeper && (k === "c" || k === "b") ? "Y" : null;
          const dens = a.L * (1 - d);
          if (lit && (dens > 0.55 || (dens > 0.3 && (x + y) % 2 === 0) || (dens > 0.12 && (x + 2 * y) % 4 === 0))) k = lit;
        }
      return k;
    },
    false,
  );
}

/** The train: front three-quarter, nose toward us. Scale `s`, the front's bottom middle at (cx, by), lamps lit `L`. */
function trainPart(j: number): Part {
  const a = approachAt(j);
  const { s, L, hz } = a;
  const [cx, by] = trainAt(a);
  const F = (u: number, v: number): Pt => [cx + u * s, by + v * s];
  const fb = 0.7;
  const B = (p: Pt): Pt => [QX + (p[0] - QX) * fb, hz + (p[1] - hz) * fb];
  const HW = 66;
  const sideQ: Pt[] = [F(HW, -74), F(HW, -5), B(F(HW, -5)), B(F(HW, -74))];
  const roofQ: Pt[] = [F(-56, -79), F(56, -79), F(HW, -74), B(F(HW, -74)), B(F(56, -79)), B(F(-56, -79))];
  const rr = (u: number, v: number, x0: number, x1: number, y0: number, y1: number, rt: number, rb: number) => {
    if (u < x0 || u > x1 || v < y0 || v > y1) return false;
    const r = v < (y0 + y1) / 2 ? rt : rb;
    if (r <= 0) return true;
    const cxr = u < x0 + r ? x0 + r : u > x1 - r ? x1 - r : u;
    const cyr = v < (y0 + y1) / 2 ? (v < y0 + r ? y0 + r : v) : v > y1 - r ? y1 - r : v;
    return Math.hypot(u - cxr, v - cyr) <= r;
  };
  const lamp = (u: number, v: number, X: number, Y: number, spec: readonly [number, number, number], key: string): string | null => {
    const [lu, lv, r] = spec;
    const [px, py] = F(lu, lv);
    const R = r * s;
    const d = Math.hypot(X - px, Y - py);
    if (R < 1.6) return Math.floor(X) === Math.floor(px) && Math.floor(Y) === Math.floor(py) ? (L > 0.5 ? "w" : key) : null;
    const core = R * (0.08 + 0.6 * L);
    if (d <= core) return "w";
    if (d <= R) return key;
    if (d <= R + Math.max(1, 1.5 * s)) return d < R + 1 && (X - px) + (Y - py) < 0 ? "J" : "j";
    return null;
  };
  return box(0, 0, FW, FH, (x, y) => {
    const X = x + 0.5;
    const Y = y + 0.5;
    const u = (X - cx) / s;
    const v = (Y - by) / s;
    let k: string | null = null;
    // The side going back (its far end toward QX), with the stripe and a row of windows.
    if (pip(sideQ, X, Y)) {
      const xF = sideQ[0]![0];
      const xB = sideQ[3]![0];
      const t = Math.max(0, Math.min(1, (X - xF) / (xB - xF)));
      const top = sideQ[0]![1] + (sideQ[3]![1] - sideQ[0]![1]) * t;
      const bot = sideQ[1]![1] + (sideQ[2]![1] - sideQ[1]![1]) * t;
      const hh = (Y - top) / (bot - top);
      k = hh < 0.06 ? "m" : hh > 0.86 ? "u" : hh < 0.4 ? "v" : "v";
      if (Math.abs(hh - 0.74) < 0.035 + 0.5 / Math.max(1, bot - top)) k = "q";
      if (hh > 0.14 && hh < 0.32 && t > 0.12 && Math.floor(t * 9) % 2 === 1) k = hh < 0.19 ? "Z" : "z";
      if (hh > 0.93) k = "j";
    }
    if (pip(roofQ, X, Y)) k = (Math.floor((X - Y * 0.6) / Math.max(2, 6 * s)) % 3 === 0) ? "N" : "n";
    // The cab front, its sloped windshield.
    if (rr(u, v, -58, 58, -79, -48, 9, 0)) {
      k = v < -74 ? (v < -77.5 ? "N" : "n") : u < -50 ? "Y" : u > 48 ? "v" : "y";
      if (pip([[-51, -52], [-44, -71], [-4, -71], [-4, -52]], u, v) || pip([[4, -52], [4, -71], [44, -71], [51, -52]], u, v))
        k = ((((u - v * 0.7) % 26) + 26) % 26) < 4 ? "Z" : "z";
    }
    // The trucks, the wheels, the pilot.
    if (Math.abs(u) >= 44 && Math.abs(u) <= 70 && v >= -14 && v <= 0) {
      k = v < -12 ? "l" : "j";
      if (((Math.abs(u) - 57) / 10) ** 2 + ((v + 4.5) / 5) ** 2 <= 1) k = v < -6 ? "l" : "m";
    }
    if (v >= -16 && v <= -1 && Math.abs(u) <= 52 - (v + 16) * 0.6) k = v < -14.5 ? "J" : Math.floor(v) % 3 === 0 ? "j" : "l";
    // The rounded nose.
    if (rr(u, v, -HW, HW, -50, -13, 18, 3)) {
      k = "y";
      if (u > 50 || (u > 40 && v > -24)) k = "v";
      if (v < -45 || u < -58) k = "Y";
      if (v > -16.5) k = "u";
      // The thin red stripe sweeping down to the middle of the nose.
      if (Math.abs(v - (-17.5 - 6 * (Math.abs(u) / HW))) <= Math.max(1.2, 0.8 / s)) k = "q";
    }
    const lw = lamp(u, v, X, Y, LAMP_W, "W");
    if (lw) k = lw;
    const lv = lamp(u, v, X, Y, LAMP_V, "V");
    if (lv) k = lv;
    return k;
  });
}

// ---------------------------------------------------------------- frames

const START: Pt = [102, 94];
const END: Pt = [94, 112];
/** The cap's place from his middle, and its turn, for a tumble phase. */
function capAt(ph: number, extra = 0): [number, number, number] {
  const a = (TAU * ph) / 5;
  return [-30 + 2 * Math.cos(a) - 2.5 * extra, -58 - 2 * Math.sin(a) - 0.9 * extra, -24 + 14 * Math.sin(a) - 22 * extra];
}

add("lines:f0", () => linesPart(0, 6, false));

/** Loose feathers whirling up off him (step `i`, 5 steps loop), about his middle. */
function fluff(i: number, cx: number, cy: number): Speck[] {
  const seeds: [number, number, number][] = [[-30, 6, 0], [34, 22, 2], [-12, 34, 4], [40, -26, 1]];
  return seeds.flatMap(([dx, dy, o]): Speck[] => {
    const st = (i + o) % 5;
    const x = Math.round(cx + dx + (dx < 0 ? -st : st));
    const y = Math.round(cy + dy - st * 5);
    const flip = st % 2 === 0;
    return flip ? [[x, y, "e"], [x + 1, y, "d"], [x + 2, y + 1, "c"]] : [[x, y + 1, "e"], [x + 1, y, "d"], [x + 2, y, "c"]];
  });
}
const fall: Anim = {
  loop: true,
  frames: Array.from({ length: 5 }, (_, i): Frame => {
    const [kx, ky, kd] = capAt(i);
    const lines = add(`lines:f${i}`, () => linesPart(i, 6, false));
    return {
      ms: 120,
      layers: [{ part: "sky", x: 0, y: 0 }, { part: lines, x: 0, y: 0 }, ...birdie(i, START[0], START[1], START[0] + kx, START[1] + ky, kd)],
      specks: fluff(i, START[0], START[1]),
    };
  }),
};

const approach: Anim = {
  loop: false,
  frames: Array.from({ length: 9 }, (_, j): Frame => {
    const t = Math.pow(j / 8, 1.2);
    const cx = Math.round(START[0] + (END[0] - START[0]) * t);
    const cy = Math.round(START[1] + (END[1] - START[1]) * t);
    const [kx, ky, kd] = capAt(j % 5, j);
    const lines = j === 0 ? "lines:f0" : add(`lines:a${j}`, () => linesPart(j * 3.5, 6, j >= 4));
    return {
      ms: 390,
      ...(j === 0 ? { cue: "approach" } : j === 8 ? { cue: "hit" } : {}),
      layers: [
        { part: "sky", x: 0, y: 0 },
        { part: add(`ground:${j}`, () => groundPart(j)), x: 0, y: 0 },
        { part: lines, x: 0, y: 0 },
        { part: add(`train:${j}`, () => trainPart(j)), x: 0, y: 0 },
        ...birdie(j % 5, cx, cy, Math.round(START[0] + kx), Math.round(START[1] + ky), kd),
      ],
      specks: fluff(j % 5, cx, cy),
    };
  }),
};

export const ARENA_BIRDIE_FALL: Character = {
  id: "arena-birdie-fall",
  name: "Birdie's fall",
  w: FW,
  h: FH,
  foot: [100, 255],
  palette: PALETTE,
  parts: PARTS,
  anims: { fall, approach },
};
