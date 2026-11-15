/**
 * Chandy, the special ops alligator (Eric's idea, Nov 15; mockup round 1, unwired: nothing in the game draws him yet).
 *
 * An ordinary green alligator standing upright on two feet like our other standing animals (Timber, Don Dough), not muscly: a
 * slim body with a soft cream belly in scale bands, short bowed legs, a long ridged tail lying on the ground behind him, and the
 * broad, rounded alligator snout (a U, not a croc's V) with its upper teeth showing. Special ops by his kit, not his build: black
 * war paint (two slashes under his eye, a band across his snout), a sniper's eye strap (olive webbing round his head, a small
 * scope lens over his near eye that glows the rifle's cyan), an olive sling across his chest, and on his back, slung diagonally,
 * his energy sniper rifle (its muzzle up over his back shoulder): about his full length, longer with each upgrade
 * (`RIFLE_STAGES`, 0 to 5 attachments). No bullets: its energy is cyan.
 *
 * Drawn three-quarters on, facing our right (toward the board, as Don Dough), light from the top left, in a 100 x 112 frame,
 * his feet at [46, 106], about 72 px from his feet to the top of his eye ridge (Timber's and Don Dough's height).
 *
 * Rigging (`ChandyPose`): every part is painted per pose from numbers and cached (the zebra rig's way): the breath (`bob`), the
 * tail (`sway`), the near arm (`armN`: shoulder to elbow to hand), the far arm (`armF`), the rifle (`gun`: slung, or held at an
 * angle), the rifle's stage, the eye's lens glow (`lens`), the far eye (`eye`), the jaw (`jaw`).
 */
import { lazyAnimsTogether, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "./sprite.ts";
import type { Sprite } from "./sprite-kit.ts";

const lazyAnim = lazyAnimsTogether();

export type Pt = readonly [number, number];
type Cv = string[][];

export const CHANDY_PALETTE: Record<string, string> = {
  k: "#0d130b", // outline
  a: "#1d2c16", // his green: deep shadow to highlight (an ordinary alligator green, olive leaning; Smudgy is lime)
  b: "#2c4320",
  c: "#3f5e2b",
  d: "#567c37",
  e: "#76994a",
  v: "#9cba68",
  f: "#6d6a3e", // the belly and throat: cream, shade to light
  g: "#9f9a64",
  h: "#c9c290",
  i: "#e6dfb2",
  p: "#0f130c", // war paint: black, and its softer edge
  P: "#273020",
  x: "#090a06", // the far eye's slit pupil
  y: "#a38f22", // his iris: yellow-green, dark and light
  Y: "#dcca45",
  w: "#f3eed8", // teeth and claws, their shade
  W: "#b9b196",
  m: "#3d1a16", // the mouth's line
  L: "#2a2916", // olive drab (the sling, the eye strap, the belt, the rifle's furniture): dark to light
  M: "#45442a",
  N: "#666340",
  n: "#8a865a",
  G: "#15191e", // gunmetal: dark to light
  H: "#272e36",
  I: "#414b57",
  J: "#69768a",
  j: "#a1aec0",
  q: "#0a5470", // the energy: cyan, dark to white-hot
  F: "#129cc3",
  O: "#58e6ff",
  Q: "#e4ffff",
  z: "#0d0e12", // ground shadow
};

/** The figure is painted from x 0 and shifted OX px right in its frame (room for the rifle's muzzle over his back shoulder). */
const OX = 6;
const W = 106;
const H = 112;
const GROUND = 106;
export const CHANDY_FOOT: Pt = [46 + OX, GROUND];

// ---- Painting helpers (the zebra rig's, by the same rules: whole pixels, one key a pixel, lit from the top left).

const cvs = (w = W, h = H): Cv => Array.from({ length: h }, () => Array<string>(w).fill("."));
const put = (c: Cv, x: number, y: number, k: string) => {
  x = Math.round(x);
  y = Math.round(y);
  if (y >= 0 && y < c.length && x >= 0 && x < c[0]!.length) c[y]![x] = k;
};
const get = (c: Cv, x: number, y: number) => c[y]?.[x] ?? ".";
const LX = -0.62;
const LY = -0.78;
const litOf = (nx: number, ny: number) => nx * LX + ny * LY;
const mod = (a: number, n: number) => ((a % n) + n) % n;
function crop(c: Cv, outline = true): { part: Part; at: Pt } | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < c.length; y++)
    for (let x = 0; x < c[0]!.length; x++) {
      if (c[y]![x] === ".") continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  if (x1 < 0) return null;
  return { part: { grid: c.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1).join("")), outline }, at: [x0, y0] };
}
function seg(px: number, py: number, a: Pt, b: Pt): { d: number; t: number; nx: number; ny: number } {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const L2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((px - a[0]) * vx + (py - a[1]) * vy) / L2));
  const qx = a[0] + vx * t;
  const qy = a[1] + vy * t;
  const d = Math.hypot(px - qx, py - qy);
  return { d, t, nx: d ? (px - qx) / d : 0, ny: d ? (py - qy) / d : 0 };
}
/** A tube along points, radius r0 to r1, in a 4-step ramp (dark, mid, light, lit), lit from the top left. */
function limb(c: Cv, pts: readonly Pt[], r0: number, r1: number, ramp: string, keep?: (x: number, y: number, along: number, d: number, r: number) => string | null): void {
  const n = pts.length - 1;
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]));
  const total = lens.reduce((a, b) => a + b, 0) || 1;
  const x0 = Math.floor(Math.min(...pts.map((p) => p[0])) - 8);
  const x1 = Math.ceil(Math.max(...pts.map((p) => p[0])) + 8);
  const y0 = Math.floor(Math.min(...pts.map((p) => p[1])) - 8);
  const y1 = Math.ceil(Math.max(...pts.map((p) => p[1])) + 8);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      let best = { d: Infinity, t: 0, nx: 0, ny: 0, i: 0 };
      for (let i = 0; i < n; i++) {
        const s = seg(x + 0.5, y + 0.5, pts[i]!, pts[i + 1]!);
        if (s.d < best.d) best = { ...s, i };
      }
      let along = lens[best.i]! * best.t;
      for (let j = 0; j < best.i; j++) along += lens[j]!;
      const r = r0 + (r1 - r0) * (along / total);
      if (best.d > r) continue;
      const lit = litOf(best.nx, best.ny) * (best.d / Math.max(0.6, r));
      let k = lit > 0.45 ? ramp[3]! : lit > 0.05 ? ramp[2]! : lit < -0.45 ? ramp[0]! : ramp[1]!;
      if (keep) k = keep(x, y, along, best.d, r) ?? k;
      put(c, x, y, k);
    }
}
function ellipseFill(c: Cv, cx: number, cy: number, rx: number, ry: number, fn: (x: number, y: number, nx: number, ny: number) => string | null): void {
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const k = fn(x, y, nx, ny);
      if (k) put(c, x, y, k);
    }
}
function inPoly(pts: readonly Pt[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[(i + 1) % pts.length]!;
    if (y0 <= y !== y1 <= y && x < x0 + ((y - y0) / (y1 - y0)) * (x1 - x0)) inside = !inside;
  }
  return inside;
}
function polyFill(c: Cv, pts: readonly Pt[], fn: (x: number, y: number) => string | null): void {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
    for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
      if (!inPoly(pts, x + 0.5, y + 0.5)) continue;
      const k = fn(x, y);
      if (k) put(c, x, y, k);
    }
}
/** The green skin's shade at a point of a round part (nx, ny in -1..1). */
const skinAt = (nx: number, ny: number) => {
  const l = litOf(nx, ny);
  return l > 0.62 ? "v" : l > 0.3 ? "e" : l > -0.05 ? "d" : l > -0.5 ? "c" : "b";
};

// ---- The rifle: shapes along its length (u, from the butt) and across it (v, + its top: the scope's side), drawn at any angle.

/** How many attachments it has: 0 the base rifle, 5 fully upgraded. */
export type RifleStage = 0 | 1 | 2 | 3 | 4 | 5;
/** The attachments in the order they come (Eric: "a longer barrel, and so on"; the order is my call: DESIGN.md). */
export const RIFLE_STAGES = ["Base", "Long barrel", "Big scope", "Bipod and stock", "Energy cell", "Emitter"] as const;

type Shape =
  | { poly: readonly Pt[]; ramp?: string; key?: string; hole?: boolean }
  | { rect: readonly [u0: number, u1: number, v0: number, v1: number]; ramp?: string; key?: string; hole?: boolean; glow?: string };

const GUN = "GHIJj";
const OD = "LMNn";
const R = (u0: number, u1: number, v0: number, v1: number, more: Omit<Extract<Shape, { rect: unknown }>, "rect"> = {}): Shape => ({ rect: [u0, u1, v0, v1], ramp: GUN, ...more });

/** The rifle's shapes at a stage, back to front, and its length (butt to muzzle). */
export function rifleShapes(stage: RifleStage): { shapes: Shape[]; len: number } {
  const s: Shape[] = [];
  const long = stage >= 1;
  // The stock: olive furniture, a thumbhole, a dark butt pad. At 3 a raised cheek rest and a spike under the butt.
  s.push({ poly: [[0, -5.6], [3, -5.6], [14, -3.2], [15, -3.2], [15, 3.4], [0, 3.6]], ramp: OD });
  s.push({ rect: [5, 10.5, -2.4, -0.2], hole: true });
  if (stage >= 3) {
    s.push({ rect: [3, 12, 3.4, 6], ramp: OD });
    s.push(R(1.5, 3.5, -8.8, -5.4));
  }
  s.push({ rect: [0, 1.6, -5.8, 3.8], ramp: "GGHH" });
  // The grip and the trigger.
  s.push({ poly: [[18.5, -3.4], [23.5, -3.4], [21.5, -10.5], [16.8, -10.5]], ramp: OD });
  s.push({ rect: [24.2, 25.6, -6.2, -3.4], key: "G" });
  // The receiver, its rail, and its energy line (brighter once the cell is on).
  s.push(R(14, 36.5, -3.6, 3.6));
  s.push({ rect: [15, 35, 3.6, 4.6], ramp: "IJJj" });
  for (let u = 16; u < 35; u += 2.5) s.push({ rect: [u, u + 0.9, 3.6, 4.6], key: "H" });
  s.push({ rect: [16, 34, -0.7, 0.7], key: stage >= 4 ? "O" : "F" });
  if (stage >= 4) for (let u = 17; u < 34; u += 3) s.push({ rect: [u, u + 1, -0.7, 0.7], key: "Q" });
  // A small window for the energy at the base (the cell replaces it).
  if (stage < 4) s.push({ rect: [27, 32, -6, -3.4], ramp: "HIIJ" }, { rect: [28, 31, -5.2, -3.8], key: "F" });
  // The barrel: short at 0; at 1 longer, with a vented shroud and a brake.
  const end = long ? 74 : 60;
  s.push(R(36, end, -1.7, 1.7));
  if (long) {
    s.push(R(36, 58, -3.3, 3.3));
    s.push({ rect: [36, 58, 3.3, 4.2], ramp: "IJJj" });
    for (const u of [39, 43, 47, 51, 55]) s.push({ rect: [u, u + 1.6, -1.6, 1.6], key: stage >= 4 ? "O" : "F" });
    if (stage < 5) s.push(R(69.5, 74, -2.6, 2.6, { ramp: "GHIJ" }), { rect: [71.5, 72.5, -2.6, 2.6], key: "G" });
  } else {
    s.push(R(57.5, 60, -2.3, 2.3, { ramp: "GHIJ" }));
    s.push(R(55.5, 57, 1.7, 3.8));
  }
  // 2: the big scope, on two mounts, its lens at the front.
  if (stage >= 2) {
    s.push(R(20, 22, 3.6, 5.8, { ramp: "GHHI" }), R(30, 32, 3.6, 5.8, { ramp: "GHHI" }));
    s.push(R(16.5, 36, 5.6, 9.4));
    s.push({ poly: [[33, 5.2], [37, 4.2], [41, 4.2], [41, 10.8], [37, 10.8], [33, 9.8]], ramp: GUN });
    s.push(R(13.5, 17, 5, 10, { ramp: "GHHI" }));
    s.push(R(25, 27.5, 9.2, 11, { ramp: "GHIJ" }));
    s.push({ rect: [40.2, 41.2, 5, 10], key: "O" }, { rect: [40.2, 41.2, 8.6, 10], key: "Q" });
  }
  // 3: the bipod, its two legs down and forward under the barrel (a V), and the stock's cheek rest and spike (above).
  if (stage >= 3) {
    s.push(R(48.5, 52.5, -4.6, -3, { ramp: "GHHI" }));
    s.push({ poly: [[49.5, -4.2], [52, -4.2], [60, -13.5], [57.6, -13.5]], ramp: "GHIJ" });
    s.push({ poly: [[50, -4.2], [52.4, -4.2], [55.4, -13.5], [53, -13.5]], ramp: "HIJj" });
    s.push(R(56.6, 61, -14.6, -12.8, { ramp: "GGHI" }), R(52, 56, -14.6, -12.8, { ramp: "GGHI" }));
  }
  // 4: the energy cell, under the receiver ahead of the grip, glowing, its cable to the shroud.
  if (stage >= 4) {
    s.push({ rect: [26, 38, -12, -3.4], ramp: "qFFO" });
    for (const u of [29.5, 33]) s.push({ rect: [u, u + 1, -12, -3.4], key: "q" });
    s.push({ rect: [27, 37, -6.6, -5.4], key: "Q" });
    s.push(R(25.4, 27, -12.6, -3.2, { ramp: "GHIJ" }), R(37, 38.6, -12.6, -3.2, { ramp: "GHIJ" }));
    s.push({ poly: [[38.6, -8], [42, -7], [44.5, -3.6], [43, -3], [40.8, -6], [38.6, -6.6]], ramp: "GHHI" });
  }
  // 5: the emitter: a heavy collar, two long prongs spread like a fork, a ball of energy held between them.
  if (stage >= 5) {
    s.push(R(67, 73, -3.8, 3.8));
    s.push({ rect: [69, 70, -3.8, 3.8], key: "G" });
    s.push({ poly: [[72, 2.2], [80, 4.2], [86, 6.4], [86, 8.2], [80, 7], [72, 4.4]], ramp: GUN });
    s.push({ poly: [[72, -2.2], [80, -4.2], [86, -6.4], [86, -8.2], [80, -7], [72, -4.4]], ramp: GUN });
    s.push({ rect: [72.5, 75, -2, 2], key: "F" });
    s.push({ poly: [[75, -2.6], [79, -3.2], [82, -2], [82, 2], [79, 3.2], [75, 2.6]], key: "O" });
    s.push({ rect: [76.5, 80, -1, 1], key: "Q" });
  }
  return { shapes: s, len: stage >= 5 ? 86 : end };
}

/**
 * Paints the rifle with its butt at `butt`, pointing `deg` (screen degrees: 0 right, -90 up). Its top (the scope's side) is to
 * the left of the way it points (up when it points right). Returns its muzzle.
 */
export function paintRifle(c: Cv, butt: Pt, deg: number, stage: RifleStage): Pt {
  const { shapes, len } = rifleShapes(stage);
  const rad = (deg * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  const vx = uy;
  const vy = -ux;
  // How much a shape's top faces the light (never quite flat, so a part always reads round).
  const sRaw = vx * LX + vy * LY;
  const sl = Math.sign(sRaw || 1) * Math.max(0.55, Math.abs(sRaw));
  const reach = len + 14;
  for (let y = Math.floor(butt[1] - reach); y <= Math.ceil(butt[1] + reach); y++)
    for (let x = Math.floor(butt[0] - reach); x <= Math.ceil(butt[0] + reach); x++) {
      const dx = x + 0.5 - butt[0];
      const dy = y + 0.5 - butt[1];
      const u = dx * ux + dy * uy;
      const v = dx * vx + dy * vy;
      let k: string | null = null;
      for (const sh of shapes) {
        let t: number;
        if ("rect" in sh) {
          const [u0, u1, v0, v1] = sh.rect;
          if (u < u0 || u > u1 || v < v0 || v > v1) continue;
          t = (v - v0) / (v1 - v0 || 1);
        } else {
          if (!inPoly(sh.poly, u, v)) continue;
          const vs = sh.poly.map((p) => p[1]);
          t = (v - Math.min(...vs)) / (Math.max(...vs) - Math.min(...vs) || 1);
        }
        if (sh.hole) {
          k = ".";
          continue;
        }
        if (sh.key) k = sh.key;
        else {
          const ramp = sh.ramp ?? GUN;
          const l = Math.max(0, Math.min(0.999, 0.5 + 0.5 * (2 * t - 1) * sl));
          k = ramp[Math.floor(l * ramp.length)]!;
        }
      }
      if (k && k !== ".") put(c, x, y, k);
      else if (k === ".") put(c, x, y, ".");
    }
  return [butt[0] + ux * len, butt[1] + uy * len];
}

// ---- The pose.

export type Eye = "open" | "blink" | "narrow" | "wide";
export interface ChandyPose {
  /** The breath: his upper body up (negative) or down by whole pixels. */
  bob?: number;
  /** A crouch: his hips down (and his knees out) by pixels. */
  crouch?: number;
  /** The tail's sway, -1..1 (its tip up or down). */
  sway?: number;
  /** The near arm, from its shoulder: [elbow, hand] offsets. Default: its hand on the sling at his chest. */
  armN?: readonly [Pt, Pt];
  /** The far arm, from its shoulder. Default: hanging at his side. */
  armF?: readonly [Pt, Pt];
  /** The near hand: a fist (holding), open, or pointing (one claw out). */
  handN?: "fist" | "point" | "open";
  /** The rifle: slung on his back (a pixel offset as he pulls it), or held: its butt from his near shoulder, and its angle. */
  gun?: { slung: true; dx?: number; dy?: number } | { at: Pt; deg: number; front: boolean };
  /** The scope lens's glow: 0 dim, 1 lit, 2 flaring. */
  lens?: 0 | 1 | 2;
  eye?: Eye;
  /** His jaw open, in pixels. */
  jaw?: number;
  /** The head's offset from his neck (a tilt forward to aim). */
  head?: Pt;
}

// The rest skeleton (frame px).
const SHOULDER_N: Pt = [55, 64];
const SHOULDER_F: Pt = [35, 65];
const NECK: Pt = [48, 58];
/** Where the slung rifle leaves his back at the shoulder, and the way it points (up and to our left, over his back). */
const SLING_EXIT: Pt = [34, 62];
const SLING_DEG = -121;
/** How far back from the shoulder the slung rifle's butt is (hidden in his back). */
const SLING_BACK = 20;
export const ARMS = {
  /** His hand on the sling at his chest (the soldier's rest). */
  sling: [[3, 9], [-4, 10]],
  hang: [[-3, 8], [-2, 16]],
  /** Pointing at the board: the arm out straight. */
  point: [[8, -1], [16, -2]],
  pointHalf: [[7, 4], [12, 0]],
} as const satisfies Record<string, readonly [Pt, Pt]>;

// ---- The parts, painted per pose and cached by their numbers.

export const CHANDY_PARTS: Record<string, Part> = {};
const CACHE = new Map<string, { name: string; at: Pt } | null>();
function part(key: string, paint: (c: Cv) => void, outline = true, w = W + 40, h = H): { name: string; at: Pt } | null {
  if (CACHE.has(key)) return CACHE.get(key)!;
  const c = cvs(w, h);
  paint(c);
  const b = crop(c, outline);
  const out = b ? { name: key, at: b.at } : null;
  if (b) CHANDY_PARTS[key] = b.part;
  CACHE.set(key, out);
  return out;
}
const r2 = (p: Pt) => p.map((v) => Math.round(v * 2) / 2).join(",");

function shadowPart(): { name: string; at: Pt } | null {
  return part("shadow", (c) => {
    for (let x = 6; x <= 70; x++) {
      const half = x < 30 ? 1 : 2;
      for (let y = GROUND - half + 1; y <= GROUND + 1; y++) {
        const nx = (x - 40) / 32;
        if (Math.abs(nx) < 1) put(c, x, y, "z");
      }
    }
  }, false);
}

/** The tail: thick at his hips, lying along the ground to our left, its ridge of scutes along the top. */
function tailPart(sway: number, crouch: number): { name: string; at: Pt } | null {
  const s = Math.round(sway * 2) / 2;
  return part(`tail:${s}:${crouch}`, (c) => {
    const pts: Pt[] = [[38, 90 + crouch], [28, 97 + crouch * 0.5], [17, 102], [8, 102.5 + s * 0.5], [3, 99.5 + s * 1.5]];
    limb(c, pts, 7, 1.4, "bcde", (x, y, along, d, r) => {
      // The belly side of the tail, toward the ground: cream.
      return y > 101 && along < 34 && d > r * 0.35 ? (y > 103 ? "g" : null) : null;
    });
    // The ridge: two rows of little scutes, notched along the top edge.
    for (let x = 4; x <= 38; x++) {
      let top = -1;
      for (let y = 0; y < H; y++) if (get(c, x, y) !== ".") (top = y), (y = H);
      if (top < 0) continue;
      if (mod(x, 3) === 0) put(c, x, top - 1, "c"), put(c, x, top, "b");
      else if (mod(x, 3) === 1) put(c, x, top, "e");
      if (x > 10 && mod(x, 3) === 0) put(c, x, top + 2, "c");
    }
  });
}

/** A leg: a thick gator thigh, a short shin, a long foot with claws pointing our right. */
function legPart(hip: Pt, knee: Pt, ankle: Pt, near: boolean): { name: string; at: Pt } | null {
  return part(`leg:${near ? "n" : "f"}:${[hip, knee, ankle].map(r2).join(";")}`, (c) => {
    limb(c, [hip, knee, ankle], 5.2, 3.2, near ? "bcde" : "abcd");
    // The foot: a flat wedge forward, three pale claws.
    const fx = ankle[0];
    const fy = GROUND;
    polyFill(c, [[fx - 4, fy - 4.5], [fx + 3, fy - 4.5], [fx + 9, fy - 2], [fx + 9.5, fy], [fx - 4.5, fy]], (x, y) => (y < fy - 3 ? (near ? "d" : "c") : y < fy - 1 ? (near ? "c" : "b") : near ? "b" : "a"));
    for (const [dx, dy] of [[9, -1], [10, 0], [7, 0]] as const) put(c, fx + dx, fy + dy - 0, "w");
    put(c, fx + 10, fy - 1, "W");
  });
}

/** An arm: a slim tube, a small hand with claws (a fist on the sling, open, or one claw pointing). */
function armPart(sh: Pt, elbow: Pt, hand: Pt, near: boolean, kind: "fist" | "point" | "open"): { name: string; at: Pt } | null {
  return part(`arm:${near ? "n" : "f"}:${kind}:${[sh, elbow, hand].map(r2).join(";")}`, (c) => {
    limb(c, [sh, elbow, hand], 3.3, 2.5, near ? "bcde" : "abcd");
    const ux = hand[0] - elbow[0];
    const uy = hand[1] - elbow[1];
    const L = Math.hypot(ux, uy) || 1;
    const dx = ux / L;
    const dy = uy / L;
    ellipseFill(c, hand[0] + dx, hand[1] + dy, 2.6, 2.4, (_, __, nx, ny) => skinAt(nx, ny));
    if (kind === "point") {
      // One long claw out (the pointing finger), the rest curled.
      for (let i = 2; i <= 6; i++) put(c, hand[0] + dx * (2 + i), hand[1] + dy * (2 + i), i < 5 ? "d" : "e");
      put(c, hand[0] + dx * 9, hand[1] + dy * 9, "w");
      put(c, hand[0] + dx * 2 + 1, hand[1] + dy * 2 + 2, "w");
    } else if (kind === "open") {
      for (const a of [-0.6, 0, 0.6]) put(c, hand[0] + dx * 3.5 + Math.cos(a) * 0 - dy * a * 2.5, hand[1] + dy * 3.5 + dx * a * 2.5, "w");
    } else {
      put(c, hand[0] + dx * 3, hand[1] + dy * 3 + 1, "w");
      put(c, hand[0] + dx * 3 + 1, hand[1] + dy * 3 - 1, "w");
    }
  });
}

/** The torso and neck, one part: the belly plate in scale bands, the sling across the chest, the belt and its pouch. */
function bodyPart(bob: number, crouch: number): { name: string; at: Pt } | null {
  return part(`body:${bob}:${crouch}`, (c) => {
    const dy = bob;
    const tcx = 45;
    const tcy = 76 + dy;
    const inTorso = (x: number, y: number) => {
      const a = ((x + 0.5 - tcx) / 12.5) ** 2 + ((y + 0.5 - tcy) / 17) ** 2 <= 1;
      const hips = ((x + 0.5 - 45) / 13.5) ** 2 + ((y + 0.5 - (87 + crouch)) / 8) ** 2 <= 1;
      const neck = ((x + 0.5 - NECK[0]) / 9) ** 2 + ((y + 0.5 - (NECK[1] + dy)) / 7.5) ** 2 <= 1;
      return a || hips || neck;
    };
    const inBelly = (x: number, y: number) => ((x + 0.5 - 49.5) / 8.4) ** 2 + ((y + 0.5 - (76 + dy)) / 15.5) ** 2 <= 1 && y < 92 + crouch;
    for (let y = 40; y < H; y++)
      for (let x = 20; x < 75; x++) {
        if (!inTorso(x, y)) continue;
        const nx = (x + 0.5 - tcx) / 12.5;
        const ny = (y + 0.5 - tcy) / 17;
        let k = skinAt(nx, ny);
        if (inBelly(x, y)) {
          // The belly's scale bands: a line every 3 rows, and a seam down the middle every other band.
          const band = mod(y - dy, 3) === 0;
          const lit = litOf(nx, ny);
          k = band ? "g" : lit > 0.25 ? "i" : "h";
          if (!band && x === 50 && mod(Math.floor((y - dy) / 3), 2) === 0) k = "g";
          if (x >= 56) k = band ? "f" : "g";
        }
        put(c, x, y, k);
      }
    // The throat under the jaw: cream.
    ellipseFill(c, 52, 57 + dy, 5, 4, (x, y) => (inTorso(x, y) ? (mod(y - dy, 3) === 0 ? "g" : "h") : null));
    // Scutes down the back of the neck and shoulders: little bumps on our left edge.
    for (const yy of [53, 57, 61]) {
      const y = yy + dy;
      let left = -1;
      for (let x = 20; x < 75; x++) if (inTorso(x, y)) (left = x), (x = 99);
      if (left > 0) put(c, left - 1, y, "c"), put(c, left - 1, y - 1, "d"), put(c, left, y, "b");
    }
    // The sling: olive webbing from his back shoulder down across his chest to his front hip, a steel buckle on it.
    const a: Pt = [34, 60 + dy];
    const b: Pt = [60, 87 + dy];
    for (let y = 50; y < H; y++)
      for (let x = 25; x < 70; x++) {
        if (!inTorso(x, y)) continue;
        const s = seg(x + 0.5, y + 0.5, a, b);
        if (s.d > 1.9) continue;
        const side = (x + 0.5 - (a[0] + (b[0] - a[0]) * s.t)) * -0.72 + (y + 0.5 - (a[1] + (b[1] - a[1]) * s.t)) * 0.69;
        put(c, x, y, side < -0.9 ? "n" : side > 0.9 ? "L" : "M");
      }
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) put(c, 46 + i, 73 + dy + j, i === 0 && j === 0 ? "H" : j < 0 || i < 0 ? "J" : "I");
    // The belt (his hips don't breathe): olive, a steel buckle, a pouch on the front hip.
    for (let x = 30; x < 62; x++)
      for (let y = 89 + crouch; y <= 91 + crouch; y++) if (inTorso(x, y)) put(c, x, y, y === 89 + crouch ? "N" : "M");
    for (let i = 0; i < 3; i++) put(c, 47 + i, 90 + crouch, i === 1 ? "H" : "J");
    for (let y = 88 + crouch; y <= 95 + crouch; y++)
      for (let x = 53; x <= 59; x++) put(c, x, y, y <= 89 + crouch ? "n" : y === 90 + crouch ? "L" : x === 53 ? "N" : x === 59 ? "L" : "M");
    put(c, 56, 89 + crouch, "J");
  });
}

/**
 * The head: the broad alligator skull and snout in profile toward our right, the jaw, the teeth, the eye ridges, the war paint,
 * the eye strap and its scope lens over the near eye, the far eye peeking over the skull.
 */
function headPart(at: Pt, eye: Eye, jaw: number, lens: 0 | 1 | 2): { name: string; at: Pt } | null {
  return part(`head:${r2(at)}:${eye}:${jaw}:${lens}`, (c) => {
    const [ox, oy] = at;
    const X = (x: number) => x + ox;
    const Y = (y: number) => y + oy;
    // The lower jaw first (its back hinge low), cream underneath; then the skull and upper snout over it.
    const jw = jaw;
    const jawPts: Pt[] = [[X(43), Y(50)], [X(56), Y(49 + jw * 0.3)], [X(82), Y(48.4 + jw)], [X(83), Y(50.6 + jw)], [X(78), Y(52.8 + jw)], [X(58), Y(55.2 + jw * 0.4)], [X(45), Y(55)]];
    polyFill(c, jawPts, (x, y) => {
      const fromBottom = Y(52.6 + (jw * (x - X(45))) / 37) - y;
      return fromBottom < -1.5 ? "h" : fromBottom < -0.2 ? "g" : x > X(70) ? "c" : "b";
    });
    if (jw > 0) {
      // The open mouth: dark inside, between the jaws.
      polyFill(c, [[X(56), Y(48.6)], [X(82), Y(48)], [X(82), Y(48.4 + jw)], [X(56), Y(49 + jw * 0.3)]], () => "m");
    }
    // The far eye ridge, behind the skull.
    ellipseFill(c, X(49), Y(36.8), 3.4, 2.6, (_, __, nx, ny) => (litOf(nx, ny) > 0.3 ? "d" : "c"));
    // The skull.
    ellipseFill(c, X(49), Y(45), 11, 9, (_, __, nx, ny) => skinAt(nx, ny));
    // The upper snout: broad and flat, its tip rounded (an alligator's U), lit along its top.
    const snout: Pt[] = [[X(53), Y(38.5)], [X(70), Y(39.6)], [X(80), Y(40.6)], [X(84.5), Y(42.4)], [X(86.2), Y(45)], [X(84.6), Y(47.6)], [X(56), Y(49)], [X(52), Y(46)]];
    polyFill(c, snout, (x, y) => {
      const top = Y(39.4 + ((x - X(53)) / 33) * 2.2);
      const d = y - top;
      if (x > X(83)) return d < 1.5 ? "e" : d < 4.5 ? "d" : "c";
      return d < 1 ? "v" : d < 2.2 ? "e" : d < 5 ? "d" : d < 7 ? "c" : "b";
    });
    // The nostril bump at the tip, and the nostril.
    ellipseFill(c, X(82.6), Y(40.9), 2.6, 1.6, (_, __, nx, ny) => (litOf(nx, ny) > 0.2 ? "v" : "e"));
    put(c, X(83), Y(40.8), "a");
    // Little bumps along the snout's top (the skin's texture), lit.
    for (const x of [58, 63, 68, 73, 77]) put(c, X(x), Y(40 + ((x - 53) / 33) * 2), "d");
    // The near eye ridge, high on the skull.
    ellipseFill(c, X(55.5), Y(37.6), 4.4, 3.2, (_, __, nx, ny) => skinAt(nx, ny * 1.1));
    // Scutes on the back of the head.
    for (const [x, y] of [[38, 44], [38, 48], [39, 52]] as const) put(c, X(x), Y(y), "c"), put(c, X(x) - 1, Y(y), "b");
    // War paint: three black slashes across the cheek under the lens, slanting back (his only marking: Smudgy's stripes are color).
    for (const x0 of [50, 54, 58])
      for (let i = 0; i <= 4; i++) {
        put(c, X(x0 + i * 0.6), Y(46.6 - i), "p");
        put(c, X(x0 + i * 0.6 + 1), Y(46.6 - i), i === 0 || i === 4 ? "P" : "p");
      }
    // The mouth's line: along under the snout, curling up at its back corner (the gator's grin).
    for (let x = 55; x <= 84; x++) put(c, X(x), Y(48.6 + ((x - 55) / 29) * -0.6 + (x > 83 ? -0.6 : 0)), "m");
    put(c, X(54), Y(48), "m");
    put(c, X(53), Y(47), "m");
    put(c, X(52), Y(47), "m");
    // The teeth: the upper ones over the lower jaw, a bigger one every so often.
    for (let x = 58; x <= 82; x += 3) {
      put(c, X(x), Y(49.2 + jw * 0.1), "w");
      if (x === 64 || x === 76) put(c, X(x), Y(50.2 + jw * 0.1), "W");
    }
    if (jw > 0) for (let x = 60; x <= 80; x += 4) put(c, X(x), Y(48.3 + jw), "w");
    // The eye strap: olive webbing from the back of his head to the lens.
    for (let x = 37; x <= 53; x++) {
      const yc = 42.6 - ((x - 37) / 16) * 4.4;
      put(c, X(x), Y(Math.round(yc - 0.5)), "n");
      put(c, X(x), Y(Math.round(yc + 0.5)), "M");
      put(c, X(x), Y(Math.round(yc + 1.5)), "L");
    }
    // The lens: a steel ring over the near eye, the glass glowing cyan, a glint; a short scope tube out the front.
    const lx = 56.5;
    const ly = 37.6;
    ellipseFill(c, X(lx), Y(ly), 3.4, 3.4, (_, __, nx, ny) => {
      const r = Math.hypot(nx, ny);
      if (r > 0.62) return litOf(nx, ny) > 0.2 ? "j" : litOf(nx, ny) > -0.3 ? "J" : "I";
      if (lens === 0) return r < 0.25 ? "F" : "q";
      return r < 0.3 ? (lens === 2 ? "Q" : "O") : "F";
    });
    put(c, X(lx - 1), Y(ly - 1), lens === 0 ? "F" : "Q");
    for (let x = 60; x <= 62; x++) {
      put(c, X(x), Y(36.6), "J");
      put(c, X(x), Y(37.6), "I");
      put(c, X(x), Y(38.6), "H");
    }
    put(c, X(63), Y(37.6), lens === 0 ? "q" : "O");
    put(c, X(63), Y(36.6), "I");
    put(c, X(63), Y(38.6), "H");
    // The far eye, peeking over the skull: a yellow iris, a slit pupil (shut: a line).
    const ex = 48.5;
    const ey = 35.8;
    if (eye === "blink") for (let i = -1; i <= 1; i++) put(c, X(ex + i), Y(ey + 0.5), "a");
    else {
      put(c, X(ex - 1), Y(ey), "Y");
      put(c, X(ex), Y(ey), "x");
      put(c, X(ex + 1), Y(ey), eye === "narrow" ? "a" : "Y");
      put(c, X(ex - 1), Y(ey + 1), "y");
      put(c, X(ex), Y(ey + 1), "x");
      put(c, X(ex + 1), Y(ey + 1), "y");
      if (eye === "narrow") put(c, X(ex - 1), Y(ey), "c");
      if (eye === "wide") put(c, X(ex), Y(ey - 1), "Y");
    }
  });
}

function riflePart(stage: RifleStage, butt: Pt, deg: number): { name: string; at: Pt; muzzle: Pt } | null {
  let muzzle: Pt = [0, 0];
  const p = part(`rifle:${stage}:${r2(butt)}:${Math.round(deg)}`, (c) => {
    muzzle = paintRifle(c, [butt[0] + 20, butt[1] + 20], deg, stage);
    muzzle = [muzzle[0] - 20, muzzle[1] - 20];
  }, true, W + 80, H + 40);
  if (!p) return null;
  // (Painted 20 px in from the corner so a rifle held out past the frame's edge still fits its canvas.)
  const m = MUZZLES.get(p.name) ?? muzzle;
  MUZZLES.set(p.name, m);
  return { name: p.name, at: [p.at[0] - 20, p.at[1] - 20], muzzle: m };
}
const MUZZLES = new Map<string, Pt>();

// ---- A whole figure.

export interface Built {
  layers: Layer[];
  /** The rifle's muzzle (frame px), the lens, and the near hand. */
  muzzle: Pt;
  lens: Pt;
  hand: Pt;
}
const add = (o: { x: number; y: number }, s: readonly [number, number]): Pt => [o.x + s[0], o.y + s[1]];
void add;

export function build(stage: RifleStage, p: ChandyPose): Built {
  const bob = p.bob ?? 0;
  const crouch = p.crouch ?? 0;
  const layers: Layer[] = [];
  const push = (b: { name: string; at: Pt } | null) => b && layers.push({ part: b.name, x: b.at[0], y: b.at[1] });
  push(shadowPart());
  push(tailPart(p.sway ?? 0, crouch));
  // The far leg, then the rifle on his back and the far arm, then the body, the near leg, the head and the near arm.
  push(legPart([40, 89 + crouch], [37 - crouch * 0.5, 97 + crouch * 0.5], [39, 101], false));
  const gun = p.gun ?? { slung: true };
  const sDx = "slung" in gun ? (gun.dx ?? 0) : 0;
  const sDy = "slung" in gun ? (gun.dy ?? 0) : 0;
  const rad = (SLING_DEG * Math.PI) / 180;
  const slungButt: Pt = [SLING_EXIT[0] - Math.cos(rad) * SLING_BACK + sDx, SLING_EXIT[1] - Math.sin(rad) * SLING_BACK + bob + sDy];
  let muzzle: Pt = [0, 0];
  const shN: Pt = [SHOULDER_N[0], SHOULDER_N[1] + bob];
  const shF: Pt = [SHOULDER_F[0], SHOULDER_F[1] + bob];
  let front: { name: string; at: Pt; muzzle: Pt } | null = null;
  if ("slung" in gun) {
    const r = riflePart(stage, slungButt, SLING_DEG);
    if (r) push(r), (muzzle = r.muzzle);
  } else {
    const butt: Pt = [shN[0] + gun.at[0], shN[1] + gun.at[1]];
    const r = riflePart(stage, butt, gun.deg);
    if (r) {
      muzzle = r.muzzle;
      if (gun.front) front = r;
      else push(r);
    }
  }
  const aF = p.armF ?? ARMS.hang;
  push(armPart(shF, [shF[0] + aF[0][0], shF[1] + aF[0][1]], [shF[0] + aF[1][0], shF[1] + aF[1][1]], false, "fist"));
  push(bodyPart(bob, crouch));
  push(legPart([51, 89 + crouch], [56 + crouch * 0.5, 97 + crouch * 0.5], [53, 101], true));
  const hd = p.head ?? [0, 0];
  const headAt: Pt = [hd[0], bob + hd[1]];
  push(headPart(headAt, p.eye ?? "open", p.jaw ?? 0, p.lens ?? 1));
  if (front) push(front);
  const aN = p.armN ?? ARMS.sling;
  const hand: Pt = [shN[0] + aN[1][0], shN[1] + aN[1][1]];
  push(armPart(shN, [shN[0] + aN[0][0], shN[1] + aN[0][1]], hand, true, p.handN ?? "fist"));
  for (const l of layers) l.x += OX;
  return { layers, muzzle: [muzzle[0] + OX, muzzle[1]], lens: [56.5 + headAt[0] + OX, 37.6 + headAt[1]], hand: [hand[0] + OX, hand[1]] };
}

const frame = (stage: RifleStage, ms: number, p: ChandyPose, extra: { specks?: (b: Built) => Speck[]; cue?: string; shake?: readonly [number, number]; pal?: Record<string, string> } = {}): Frame => {
  const b = build(stage, p);
  return { layers: b.layers, ms, cue: extra.cue, shake: extra.shake, pal: extra.pal, specks: extra.specks?.(b) };
};

// ---- Specks: the lens's flare, the energy's sparks, the muzzle's burst.

/** A little cross of light (a lens flare or a spark), `r` px each way. */
export function flare([x, y]: Pt, r: number, key = "Q", rim = "O"): Speck[] {
  const out: Speck[] = [[Math.round(x), Math.round(y), key]];
  for (let i = 1; i <= r; i++) {
    const k = i === r ? rim : key;
    out.push([Math.round(x + i), Math.round(y), k], [Math.round(x - i), Math.round(y), k], [Math.round(x), Math.round(y + i), k], [Math.round(x), Math.round(y - i), k]);
  }
  return out;
}
/** The energy burst at the muzzle as he fires: a hot ball and rays, `t` 0..1 (big, then fading). */
export function burst([x, y]: Pt, t: number): Speck[] {
  const out: Speck[] = [];
  const r = t < 0.5 ? 4 : 2;
  for (let j = -r; j <= r; j++)
    for (let i = -r; i <= r; i++) {
      const d = Math.hypot(i, j);
      if (d > r + 0.3) continue;
      out.push([Math.round(x + i + 2), Math.round(y + j), d < r * 0.4 ? "Q" : d < r * 0.75 ? "O" : "F"]);
    }
  if (t < 0.5) for (let i = r + 1; i < r + 9; i++) out.push([Math.round(x + i + 2), Math.round(y), i < r + 5 ? "Q" : "O"]);
  for (const [dx, dy] of [[1, -1], [1, 1], [-1, -1], [-1, 1]] as const) for (let i = r; i < r + (t < 0.5 ? 3 : 2); i++) out.push([Math.round(x + 2 + dx * i), Math.round(y + dy * i), "O"]);
  return out;
}

// ---- The animations (round 1: idle, the point at a locked piece, the firing pose).

const STAGE_SHOWN: RifleStage = 0;

/** His rest: hand on the sling, the rifle on his back, the lens lit. */
export const REST: ChandyPose = { armN: ARMS.sling, armF: ARMS.hang, gun: { slung: true }, lens: 1, eye: "open" };

/** Idle: breathing (his upper body up a pixel and back), the tail swaying along the ground, a blink, the lens's glint. */
function idleOf(stage: RifleStage): Anim {
  return {
    loop: true,
    frames: [
      frame(stage, 520, { ...REST, sway: 0 }),
      frame(stage, 360, { ...REST, sway: 0.5, bob: -1 }),
      frame(stage, 520, { ...REST, sway: 1, bob: -1 }, { specks: (b) => flare([b.lens[0] - 1, b.lens[1] - 1], 2) }),
      frame(stage, 380, { ...REST, sway: 0.5, eye: "blink" }),
    ],
  };
}
const idle = lazyAnim(() => idleOf(STAGE_SHOWN));

/** The lock-on: he points at the piece, the lens flares (it ends pointing; a raise, then the point). */
const point = lazyAnim(() => ({
  loop: false,
  frames: [
    frame(STAGE_SHOWN, 120, { ...REST, armN: ARMS.pointHalf, handN: "open", eye: "narrow" }),
    frame(STAGE_SHOWN, 160, { ...REST, armN: ARMS.point, handN: "point", eye: "narrow", lens: 2, head: [1, 0] }, { cue: "lock", specks: (b) => flare([b.lens[0] - 1, b.lens[1] - 1], 3) }),
    frame(STAGE_SHOWN, 700, { ...REST, armN: ARMS.point, handN: "point", eye: "narrow", lens: 1, head: [1, 0] }),
  ],
}));

/** The firing pose: he reaches back for the rifle, swings it round, aims it level at the board, fires. */
export const FIRE_POSES: Record<"grab" | "swing" | "aim" | "fire", ChandyPose> = {
  grab: { ...REST, armN: [[-6, -6], [-17, -7]], handN: "fist", gun: { slung: true, dx: 1, dy: -2 }, eye: "narrow", lens: 1 },
  swing: { ...REST, armN: [[2, 8], [-2, 6]], armF: [[6, 4], [15, -2]], gun: { at: [-14, 0], deg: -40, front: true }, eye: "narrow", lens: 1, bob: 1, crouch: 1 },
  aim: { ...REST, armN: [[5, 7], [13, -1]], armF: ARMS.hang, gun: { at: [-19, -7], deg: 0, front: true }, eye: "narrow", lens: 2, bob: 1, crouch: 2, head: [1, -1] },
  fire: { ...REST, armN: [[4, 7], [11, -1]], armF: ARMS.hang, gun: { at: [-21, -7], deg: -3, front: true }, eye: "narrow", lens: 2, bob: 1, crouch: 2, head: [0, -1], jaw: 2 },
};
function fireOf(stage: RifleStage): Anim {
  return {
    loop: false,
    frames: [
      frame(stage, 140, FIRE_POSES.grab, { cue: "unsling" }),
      frame(stage, 120, FIRE_POSES.swing),
      frame(stage, 260, FIRE_POSES.aim, { cue: "aim", specks: (b) => flare([b.lens[0] - 1, b.lens[1] - 1], 3) }),
      frame(stage, 90, FIRE_POSES.fire, { cue: "fire", shake: [-1, 0], specks: (b) => burst(b.muzzle, 0) }),
      frame(stage, 110, FIRE_POSES.fire, { specks: (b) => burst(b.muzzle, 1) }),
      frame(stage, 300, FIRE_POSES.aim),
    ],
  };
}
const fire = lazyAnim(() => fireOf(STAGE_SHOWN));

export const CHANDY: Character = {
  id: "chandy",
  name: "Chandy",
  w: W,
  h: H,
  foot: CHANDY_FOOT,
  palette: CHANDY_PALETTE,
  halo: "#26341f",
  parts: CHANDY_PARTS,
  anims: { idle, point },
};

/** The firing pose needs room for the rifle held out level: the same figure in a frame `FIRE_ROOM` px wider on our right. */
export const FIRE_ROOM = 44;
export const CHANDY_FIRE: Character = { ...CHANDY, id: "chandy-fire", name: "Chandy (firing)", w: W + FIRE_ROOM, anims: { idle: lazyAnim(() => ({ loop: true, frames: [frame(STAGE_SHOWN, 1000, REST)] })), fire } };

/** Chandy at each rifle stage, standing (for the sheets: his rifle on his back at 0 to 5 attachments). */
export const CHANDY_STAGES: Character = {
  ...CHANDY,
  id: "chandy-stages",
  name: "Chandy (rifle stages)",
  anims: Object.fromEntries(([0, 1, 2, 3, 4, 5] as const).map((s) => [`stage${s}`, lazyAnim(() => ({ loop: true, frames: [frame(s, 1000, REST)] }))])),
};
/** His firing pose at each stage (the aim). */
export const CHANDY_AIMS: Character = {
  ...CHANDY_FIRE,
  id: "chandy-aims",
  anims: Object.fromEntries(([0, 1, 2, 3, 4, 5] as const).map((s) => [`aim${s}`, lazyAnim(() => ({ loop: true, frames: [frame(s, 1000, FIRE_POSES.aim)] }))])),
};

/** The rifle alone, level, at each stage (the upgrade window shows it): 100 x 30, its butt at [8, 15]. */
export const RIFLE_W = 100;
export const RIFLE_H = 30;
const rifleOnly = (stage: RifleStage): Frame => {
  const r = part(`solo-rifle:${stage}`, (c) => void paintRifle(c, [8, 15], 0, stage), true, RIFLE_W, RIFLE_H);
  return { ms: 1000, layers: r ? [{ part: r.name, x: r.at[0], y: r.at[1] }] : [] };
};
export const CHANDY_RIFLE: Character = {
  id: "chandy-rifle",
  name: "Chandy's rifle",
  w: RIFLE_W,
  h: RIFLE_H,
  foot: [50, 28],
  palette: CHANDY_PALETTE,
  parts: CHANDY_PARTS,
  anims: Object.fromEntries(([0, 1, 2, 3, 4, 5] as const).map((s) => [`stage${s}`, lazyAnim(() => ({ loop: true, frames: [rifleOnly(s)] }))])),
};

/** The part of him a portrait shows (his head, lens and war paint, the rifle's barrel over his shoulder), in frame px. */
export const CHANDY_PORTRAIT = { x: 36, y: 26, w: 58, h: 36 } as const;

/** Chandy on the sprite kit: facing our right as drawn, his anchors at rest. */
export const CHANDY_SPRITE: Sprite = {
  ch: CHANDY,
  facing: "right",
  anchors: { feet: CHANDY_FOOT, head: [56 + OX, 44], hands: { sling: [SHOULDER_N[0] + ARMS.sling[1][0] + OX, SHOULDER_N[1] + ARMS.sling[1][1]] } },
  ramps: { green: "abcdev", cream: "fghi", olive: "LMNn", steel: "GHIJj", energy: "qFOQ", iris: "yY" },
  frames: { idle: "idle", attack: "point" },
  unlined: "zQOFq",
};
