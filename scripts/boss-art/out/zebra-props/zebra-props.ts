/**
 * The zebra bakery's props (Eric's design, Nov 10; drawn by hand on the weekly plan usage).
 *
 * 1. ZEBRA_ROLL (40 x 40, foot [20, 38]): the bread rifle on its own, the crew's 32 px French roll: `table` (lying on the back
 *    room's table, a little shadow under it) and `lean` (stood on end, leaning, for the guards' wall or a corner).
 * 2. INTRO_ZEBRA_PUFF (32 x 24, foot [3, 13]: the foot is the muzzle; put it on BOSS_ZEBRA_MUZZLE's point): the flour-and-
 *    crumb burst out of the roll's end, `puff` once, 6 x 70 ms (cue `pop` f0). Drawn facing right; mirror it with him.
 * 3. INTRO_ZEBRA_STORM (128 x 128, tiles both ways) and INTRO_ZEBRA_FRONT (48 x 128, tiles top to bottom): his battle splash,
 *    "loaves of bread as the splash screen", played as Alfil's sandstorm, Jefferson's fireworks and Ginger's blizzard are: the
 *    tile at 3x behind its front, sweeping in from the left. A warm flour-dusted haze in soft diagonal bands, French rolls,
 *    baguettes and round boules tumbling, flour drifting; its front a rolling wall of flour with crumbs flung ahead.
 *    6 x 70 ms, looping; cues `whoosh` f0 (the front), `tumble` f0 (the storm). No flashing: the haze never changes brightness.
 */
import type { Character, Frame, Part } from "../../../../packages/app/src/characters/sprite.ts";
import { hash, paintRoll, ROLL_LEN, ZEBRA_PALETTE, type Pt } from "../crew-zebra/zebra-rig.ts";

type Key = string | null;
const mod = (a: number, n: number) => ((a % n) + n) % n;
const PALETTE: Record<string, string> = {
  ...ZEBRA_PALETTE,
  "(": "#f4e8cc", // the splash's haze: light, mid, deep
  ")": "#ecdcb8",
  "[": "#e2cb9e",
};
const cv = (w: number, h: number) => Array.from({ length: h }, () => Array<string>(w).fill("."));
const grid = (c: string[][]): Part => ({ grid: c.map((r) => r.join("")) });
const full = (fn: (x: number, y: number) => Key, w: number, h: number): Part => ({ grid: Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => fn(x, y) ?? ".").join("")), outline: false });
const one = (part: string, ms = 1000, cue?: string): Frame => ({ ms, layers: [{ part, x: 0, y: 0 }], ...(cue ? { cue } : {}) });

// ================================================================================================================
// 1. The roll on its own.

const rollParts: Record<string, Part> = {};
{
  const c = cv(40, 40);
  paintRoll(c, [4, 35], -3, ROLL_LEN);
  rollParts.table = grid(c);
  const sh = cv(40, 40);
  for (let x = 6; x <= 34; x++) sh[38]![x] = x < 9 || x > 31 ? "+" : "-";
  rollParts.tableShadow = { grid: sh.map((r) => r.join("")), outline: false };
  const l = cv(40, 40);
  paintRoll(l, [16, 37], -76, ROLL_LEN);
  rollParts.lean = grid(l);
}
export const ZEBRA_ROLL: Character = {
  id: "zebra-roll",
  name: "The bread rifle",
  w: 40,
  h: 40,
  foot: [20, 38],
  palette: PALETTE,
  parts: rollParts,
  anims: {
    table: { loop: true, frames: [{ ms: 1000, layers: [{ part: "tableShadow", x: 0, y: 0 }, { part: "table", x: 0, y: 0 }] }] },
    lean: { loop: true, frames: [one("lean")] },
  },
};

// ================================================================================================================
// 2. The muzzle puff: a pop of flour, a cloud rolling on and thinning, crumbs flung ahead and falling.

const PW = 32;
const PH = 24;
const PF: Pt = [3, 13];
function puffKey(x: number, y: number, t: number): Key {
  const dx = x + 0.5 - PF[0];
  const dy = y + 0.5 - PF[1];
  if (t === 0) {
    // The pop: a white-hot four-point star with a flour ring.
    const ax = Math.abs(dx - 3);
    const ay = Math.abs(dy);
    if (ax + ay < 2.2) return "*";
    if ((ay < 0.7 && ax < 5) || (ax < 0.7 && ay < 4)) return "h";
    if (Math.hypot(dx - 3, dy) < 4.2 && hash(x, y, 3) < 0.4) return "~";
    return null;
  }
  // The cloud: three lumps rolling forward and up, growing, thinning from t 3.
  const r = 2.4 + t * 1.3;
  for (const [ox, oy, s] of [[3 + t * 2.6, -t * 0.4, 1], [1 + t * 2, 1.5 - t * 0.2, 0.75], [5 + t * 3, -1.5 - t * 0.6, 0.65]] as const) {
    const d = Math.hypot(dx - ox, dy - oy);
    if (d > r * s) continue;
    if (t >= 3 && hash(x, y, t + 11) < (t - 2) * 0.22) return null;
    const lit = -(dx - ox) * 0.4 - (dy - oy) * 0.8;
    return lit > r * s * 0.35 ? "h" : lit > -r * s * 0.3 ? "~" : "^";
  }
  // Crumbs flung ahead, falling.
  for (let n = 0; n < 5; n++) {
    const cxp = PF[0] + 6 + t * (3 + n * 0.9) + n;
    const cyp = PF[1] - 3 + n * 1.6 + t * t * 0.35;
    if (Math.round(cxp) === x && Math.round(cyp) === y) return n % 2 ? "8" : "9";
  }
  return null;
}
const puffParts: Record<string, Part> = {};
const puffFrames: Frame[] = Array.from({ length: 6 }, (_, t) => {
  puffParts[`p${t}`] = full((x, y) => puffKey(x, y, t), PW, PH);
  return one(`p${t}`, 70, t === 0 ? "pop" : undefined);
});
export const INTRO_ZEBRA_PUFF: Character = {
  id: "intro-zebra-puff",
  name: "The kingpin's muzzle puff",
  w: PW,
  h: PH,
  foot: PF,
  palette: PALETTE,
  parts: puffParts,
  anims: { puff: { loop: false, frames: puffFrames } },
};

// ================================================================================================================
// 3. The splash: loaves of bread.

const ST = 128;
const FW = 48;
/** The haze: soft diagonal bands (period 64, so it tiles), a light flour dust that twinkles slowly. */
function haze(x: number, y: number, f: number): string {
  const b = Math.floor(mod(x + y, 64) / 16);
  const k = ["(", ")", "[", ")"][b]!;
  const h = hash(x, y, 41);
  if (h < 0.012) return (Math.floor(h * 1000) + f) % 6 < 3 ? "h" : k;
  return k;
}
type Loaf = { x: number; y: number; kind: "roll" | "baguette" | "boule"; a0: number; spin: number; bob: number };
/** The loaves (tile px), their kind, angle, spin per frame (degrees; a roll's look repeats every 180, a boule's every 90). */
const LOAVES: readonly Loaf[] = [
  { x: 24, y: 22, kind: "roll", a0: 20, spin: 30, bob: 0 },
  { x: 86, y: 18, kind: "boule", a0: 0, spin: 15, bob: 2 },
  { x: 66, y: 58, kind: "baguette", a0: -35, spin: -30, bob: 4 },
  { x: 16, y: 82, kind: "boule", a0: 40, spin: -15, bob: 1 },
  { x: 104, y: 84, kind: "roll", a0: 70, spin: 30, bob: 3 },
  { x: 52, y: 106, kind: "roll", a0: -10, spin: -30, bob: 5 },
  { x: 114, y: 44, kind: "baguette", a0: 60, spin: 30, bob: 2 },
];
/** A loaf's key at (dx, dy) from its middle, turned `deg`: crust lit from the top left in screen space, its scoring, its outline. */
function loafKey(dx: number, dy: number, kind: Loaf["kind"], deg: number): Key {
  const a = (deg * Math.PI) / 180;
  const u = dx * Math.cos(a) + dy * Math.sin(a);
  const v = -dx * Math.sin(a) + dy * Math.cos(a);
  let d: number; // depth inside the edge, px
  let nx: number;
  let ny: number;
  let r: number;
  if (kind === "boule") {
    r = 8.5;
    const q = Math.hypot(dx, dy);
    d = r - q;
    nx = dx / r;
    ny = dy / r;
  } else {
    const half = kind === "roll" ? 13 : 18;
    r = kind === "roll" ? 4.6 : 3.2;
    const cu = Math.max(-half, Math.min(half, u));
    const end = half - Math.abs(cu);
    const rr = end < 4 ? r * (0.55 + 0.45 * Math.sqrt(end / 4)) : r;
    const q = Math.hypot(u - cu, v);
    d = rr - q;
    // Back to screen space for the light.
    const lu = (u - cu) / rr;
    const lv = v / rr;
    nx = lu * Math.cos(a) - lv * Math.sin(a);
    ny = lu * Math.sin(a) + lv * Math.cos(a);
    r = rr;
  }
  if (d < 0) return null;
  if (d < 1) return "k";
  const lit = -(nx * 0.62 + ny * 0.78);
  let k = lit > 0.5 ? "0" : lit > 0.05 ? "9" : lit > -0.45 ? "8" : "7";
  if (kind === "boule") {
    // A cross scored on top, its cuts pale with a dark lip.
    if ((Math.abs(u) < 0.8 || Math.abs(v) < 0.8) && d > 2.2) k = "%";
    else if ((Math.abs(u) < 1.6 || Math.abs(v) < 1.6) && d > 2.2) k = "&";
  } else {
    // Slashes slanting across, mirrored about the middle so the roll looks the same turned half round.
    const sl = mod(Math.abs(u) - Math.sign(u) * v * 1.1, kind === "roll" ? 6 : 5);
    if (d > 1.6 && sl < 1.1 && Math.abs(u) > 2) k = "%";
    else if (d > 1.6 && sl < 1.9 && Math.abs(u) > 2) k = "&";
  }
  return k;
}
function stormKey(x: number, y: number, f: number): string {
  for (const L of LOAVES) {
    const by = Math.round(Math.sin(((f + L.bob) / 6) * Math.PI * 2) * 1.2);
    const dx = mod(x - L.x + 64, ST) - 64 + 0.5;
    const dy = mod(y - L.y - by + 64, ST) - 64 + 0.5;
    if (Math.abs(dx) > 22 || Math.abs(dy) > 22) continue;
    const k = loafKey(dx, dy, L.kind, L.a0 + L.spin * f);
    if (k) return k;
  }
  return haze(x, y, f);
}
const stormParts: Record<string, Part> = {};
const stormFrames: Frame[] = Array.from({ length: 6 }, (_, f) => {
  stormParts[`s${f}`] = full((x, y) => stormKey(x, y, f), ST, ST);
  return one(`s${f}`, 70, f === 0 ? "tumble" : undefined);
});
export const INTRO_ZEBRA_STORM: Character = {
  id: "intro-zebra-storm",
  name: "The kingpin's splash (tile)",
  w: ST,
  h: ST,
  foot: [ST / 2, ST - 1],
  palette: PALETTE,
  parts: stormParts,
  anims: { idle: { loop: true, frames: stormFrames } },
};

/** The leading edge: the haze on its left (no seam with the storm), then a rolling wall of flour, crumbs flung out ahead. */
function edgeX(y: number, f: number): number {
  const ph = (2 * Math.PI * f) / 6;
  return 22 + 3 * Math.sin((2 * Math.PI * 3 * y) / ST + ph) + 2 * Math.sin((2 * Math.PI * 7 * y) / ST - ph * 2);
}
function frontKey(x: number, y: number, f: number): Key {
  const e = edgeX(y, f);
  if (x < e - 10) return stormKey(x, y, f);
  if (x < e + 1) {
    // Billows of flour: lumps along the edge, lit from the top left.
    const u = (x - (e - 10)) / 11;
    const lump = Math.sin((2 * Math.PI * 5 * y) / ST + f) * 0.5 + 0.5;
    const h = hash(x, y, f + 5);
    if (u < 0.25 && h < 0.5) return stormKey(x, y, f);
    if (lump > 0.6 && u > 0.6) return "^";
    return h < 0.3 + u * 0.3 ? "h" : "~";
  }
  // Flour puffs and crumbs flying out ahead.
  const dx = x - e;
  if (dx < 16 && hash(x, y, f * 7 + 1) < 0.09 - dx * 0.005) return "~";
  if (dx < 22 && hash(x, y, f * 13 + 3) < 0.03 - dx * 0.001) return hash(x, y, 2) < 0.5 ? "9" : "8";
  return null;
}
const frontParts: Record<string, Part> = {};
const frontFrames: Frame[] = Array.from({ length: 6 }, (_, f) => {
  frontParts[`f${f}`] = full((x, y) => frontKey(x, y, f), FW, ST);
  return one(`f${f}`, 70, f === 0 ? "whoosh" : undefined);
});
export const INTRO_ZEBRA_FRONT: Character = {
  id: "intro-zebra-front",
  name: "The kingpin's splash (its leading edge)",
  w: FW,
  h: ST,
  foot: [0, ST - 1],
  palette: PALETTE,
  parts: frontParts,
  anims: { idle: { loop: true, frames: frontFrames } },
};
