/**
 * The bakery's zebras (Eric's design, Nov 10; drawn by hand on the weekly plan usage): one zebra, dressed six ways (the
 * kingpin and his five crew). They stand as the giraffes do (the dealer, Jefferson's crew: out/npc-grex/giraffe-rig.ts):
 * upright on two legs like a person, hooves for hands, three-quarters facing our right, light from the top left, the same
 * outline, shading and pixel scale (room scale 1:1, 37 px a square). A zebra's head is a horse's: a long muzzle with a dark
 * nose, upright ears, a short standing mane; a shorter, thicker neck than a giraffe's, so a zebra stands about 69 px from
 * hooves to ear tips, a head under the giraffes (79). Black stripes on white, curving round each part.
 *
 * Frame: 96 x 104, the foot (the ground between the hooves) at [36, 100] (wider than the giraffes' 64 for the bread rifle
 * held out in front). Each part is painted from a pose (a handful of numbers) and a look (hat, top, face things, belly), every
 * part its own outlined layer, back to front; parts are made once per pose and shared between frames (`PARTS`).
 *
 * The bread rifle: a long French roll, its crust scored with pale diagonal slashes, held two-handed like a rifle (the near
 * hoof at its back end, the far hoof under its middle). `gun` in a pose gives its angle; `Built.muzzle` is where a puff
 * leaves its front end.
 */
import type { Frame, Layer, Part, Speck } from "../../../../packages/app/src/characters/sprite.ts";

export type Pt = readonly [number, number];
export const W = 96;
export const H = 104;
export const GROUND = 100;
export const FOOT: Pt = [36, GROUND];
/** The back room's table top over the floor, in px (a park table's), for the seated pokes and the roll lying on it. */
export const ZEBRA_TABLE_TOP = 27;

export const ZEBRA_PALETTE: Record<string, string> = {
  k: "#120d14", // outline
  d: "#a29fb2", // white fur: shade, mid, light, lit
  c: "#d7d5df",
  C: "#efeef4",
  h: "#ffffff",
  s: "#231e29", // the stripes, the brows
  n: "#3d3843", // the nose and the ears' insides: dark, lit
  N: "#5c5663",
  b: "#2c2731", // hooves: lit, dark
  B: "#17131b",
  e: "#0e0b12", // the eye: pupil, white
  t: "#fbf8f2",
  m: "#4a1420", // the mouth, the tongue
  T: "#d9667a",
  v: "#6e1f2e", // the kingpin's pinstripe vest: mid, shade, lit, its pinstripes
  V: "#4a1220",
  w: "#8c3445",
  x: "#a8566a",
  g: "#f2c14e", // gold (the pinky ring, a tooth, buttons, the dizzy stars), its shade
  G: "#b98a1e",
  q: "#2c2b36", // a black vest: mid, shade, lit
  Q: "#1b1a22",
  j: "#454452",
  a: "#f4efe2", // an apron, a baker's cap: mid, shade, a deep fold
  A: "#d3cab4",
  z: "#b3a68a",
  o: "#3a3533", // the kingpin's fedora: mid, shade, lit; its band
  O: "#24201f",
  l: "#57514d",
  R: "#a8302a",
  p: "#7b808c", // a grey fedora: mid, shade
  P: "#545864",
  y: "#7a6a52", // a tweed flat cap: mid, shade
  Y: "#57493a",
  u: "#c0382e", // a red beanie: mid, shade
  U: "#7e1d19",
  E: "#34467a", // a navy turtleneck: mid, shade
  F: "#222f55",
  M: "#cf9f34", // a mustard sweater vest: mid, shade
  L: "#94701c",
  X: "#18161f", // shades' lens, a glint; glasses' lens
  Z: "#5a5f80",
  H: "#bfe3f0",
  "1": "#ead6a2", // a toothpick
  "2": "#ffd23a", // a pencil, its point
  "3": "#3a3533",
  "4": "#e8c79a", // a sticking plaster: mid, shade
  "5": "#c49a68",
  "6": "#d77a8a", // a scar
  "7": "#7a3f12", // the roll's crust: deep, mid, light, lit
  "8": "#ab5f1d",
  "9": "#d68a35",
  "0": "#f0b45a",
  "%": "#f8e3ae", // its scoring slashes: the pale cut, its shadowed lip
  "&": "#8a4a16",
  "~": "#efe8d8", // a flour puff: light, shade (with h)
  "^": "#d3c6a8",
  "=": "#e6edf2", // steam: light, shade
  ":": "#b9c4ce",
  "!": "#8fd3ff", // a drop of sweat
  "*": "#fffbe8", // a pop's white-hot heart
  "-": "#0d0e1280", // ground shadow: core, rim
  "+": "#0d0e1244",
};

// ---- A small canvas.

type Cv = string[][];
const cvs = (w = W, h = H): Cv => Array.from({ length: h }, () => Array<string>(w).fill("."));
export const put = (c: Cv, x: number, y: number, k: string) => {
  x = Math.round(x);
  y = Math.round(y);
  if (y >= 0 && y < c.length && x >= 0 && x < c[0]!.length) c[y]![x] = k;
};
const get = (c: Cv, x: number, y: number) => c[Math.round(y)]?.[Math.round(x)] ?? ".";
export function hash(x: number, y: number, seed = 1): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const mod = (a: number, n: number) => ((a % n) + n) % n;
function crop(c: Cv, outline = true): { part: Part; at: Pt } | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  c.forEach((row, y) =>
    row.forEach((k, x) => {
      if (k === ".") return;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }),
  );
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
const litOf = (nx: number, ny: number) => -(nx * 0.62 + ny * 0.78);
const FUR = "dcCh";
/**
 * A limb along points (joints), radius r0 to r1, painted with `ramp` (dark, mid, light, lit) lit from the top left;
 * `stripes`: a zebra's bands round it, one every `stripes` px along it (0: none).
 */
function limb(c: Cv, pts: readonly Pt[], r0: number, r1: number, ramp: string, stripes = 0, phase = 0): void {
  const n = pts.length - 1;
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]));
  const total = lens.reduce((a, b) => a + b, 0) || 1;
  const x0 = Math.floor(Math.min(...pts.map((p) => p[0])) - 5);
  const x1 = Math.ceil(Math.max(...pts.map((p) => p[0])) + 5);
  const y0 = Math.floor(Math.min(...pts.map((p) => p[1])) - 5);
  const y1 = Math.ceil(Math.max(...pts.map((p) => p[1])) + 5);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      let best = { d: Infinity, t: 0, nx: 0, ny: 0, i: 0 };
      for (let i = 0; i < n; i++) {
        const s = seg(x + 0.5, y + 0.5, pts[i]!, pts[i + 1]!);
        if (s.d < best.d) best = { ...s, i };
      }
      const alongPx = lens.slice(0, best.i).reduce((a, b) => a + b, 0) + lens[best.i]! * best.t;
      const r = r0 + (r1 - r0) * (alongPx / total);
      if (best.d > r) continue;
      const lit = -(best.nx * 0.62 + best.ny * 0.78) * (best.d / Math.max(0.6, r));
      let k = lit > 0.45 ? ramp[3]! : lit > 0.05 ? ramp[2]! : lit < -0.45 ? ramp[0]! : ramp[1]!;
      // Bands round the limb, bowed a little by the round of it (so they read as wrapping).
      if (stripes && mod(alongPx + phase + best.d * 0.35, stripes) < 1.15) k = "s";
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
/** The fur's shade at a point of a round part (nx, ny in -1..1). */
const furAt = (nx: number, ny: number) => {
  const l = litOf(nx, ny);
  return l > 0.5 ? "h" : l > 0.1 ? "C" : l < -0.45 ? "d" : "c";
};
/** Stripes round a ball (a torso, the belly): meridians, bowed by its round, `n` across its width. */
const ballStripe = (nx: number, ny: number, n: number, ph = 0) => mod((nx / Math.sqrt(Math.max(0.2, 1 - ny * ny))) * n * 0.5 + ph, 1) < 0.34;

// ---- The look and the pose.

export type Hat = "none" | "fedora" | "fedoraGrey" | "flat" | "paper" | "toque" | "beanie";
export type Top = "pin" | "black" | "blackApron" | "apron" | "turtle" | "mustard";
export interface Look {
  id: string;
  hat: Hat;
  top: Top;
  shades?: boolean;
  glasses?: boolean;
  toothpick?: boolean;
  pencil?: boolean;
  plaster?: boolean;
  scar?: boolean;
  bowtie?: boolean;
  /** The kingpin: the big pudgy belly, a waist apron under it, flour dust, the pinky ring, a gold tooth. */
  boss?: boolean;
  /** Seeds his stripes' phase and his flour (each zebra's own). */
  seed: number;
}
export type Eyes = "open" | "blink" | "shut" | "half" | "up" | "fwd" | "back" | "wide" | "mad" | "dizzy";
export type Mouth = "flat" | "smile" | "smirk" | "grin" | "open" | "laugh" | "o" | "frown" | "grit" | "pout";
export interface Pose {
  /** Head, neck, torso and arms down this many px (a breath). */
  bob?: number;
  /** The belly's jiggle (the kingpin): + rounder and lower, - pulled in. */
  jig?: number;
  /** The head on the neck: forward (+x), down (+y). */
  hx?: number;
  hy?: number;
  /** All of him up off the ground (a hop), px. */
  air?: number;
  /** All of him sideways (a recoil, a shake), px; the shadow stays. */
  dx?: number;
  /** Each foot (far, near): its x from the foot's middle, and how far it's lifted. */
  feet?: readonly [Pt, Pt];
  /** Each arm (far, near): the hoof from its shoulder, or [elbow, hoof]. Ignored for a hoof on the roll. */
  armF?: Pt | readonly [Pt, Pt];
  armN?: Pt | readonly [Pt, Pt];
  eyes?: Eyes;
  mouth?: Mouth;
  /** Brows: down (cross, sure), up (surprised, worried), one (one up: a smug doubt). */
  brows?: "down" | "up" | "one";
  tail?: number;
  /** Sitting on a seat this many px over the ground. */
  sit?: number;
  pick?: number;
  /** The hat lifted off his head (a tip), or knocked askew (x, y px), or flown off to a place in the frame (abs). */
  hatLift?: number;
  hatAt?: Pt;
  hatGone?: boolean;
  /**
   * The bread rifle in his hooves: its angle in degrees (0 points right, -90 straight up, 90 down) and where the near hoof
   * holds it from his near shoulder (`at`); `grip`: how far along from its back end that hoof holds it (default 5); `both`:
   * the far hoof holds it too, `far` px further along (default 11); `back`: drawn behind his head (on his shoulder).
   */
  gun?: { deg: number; at: Pt; grip?: number; both?: boolean; far?: number; back?: boolean; broken?: boolean; farHold?: boolean };
  /** The roll slung across his back (its top end over his far shoulder), when it isn't in his hooves. */
  slung?: boolean;
  /** Sweat drops on his brow (rattled). */
  sweat?: number;
}

const HIP_Y = 78;
const HIP_F: Pt = [33, HIP_Y];
const HIP_N: Pt = [38, HIP_Y];
const TORSO: Pt = [35, 68];
const SHOULDER_F: Pt = [32, 59];
const SHOULDER_N: Pt = [38, 59];
const NECK_BASE: Pt = [36, 61];
const NECK_TOP: Pt = [40, 48];
const SKULL: Pt = [40, 42];

/** Arms (the hoof from the shoulder, or [elbow, hoof]). */
export const ARMS = {
  hang: [[1, 8], [2, 16]],
  hangN: [[2, 8], [3, 16]],
  hip: [[7, 6], [4, 12]],
  belly: [[6, 8], [10, 12]],
  bellyF: [[5, 8], [9, 13]],
  chin: [[8, 6], [8, -5]],
  wave: [[7, -3], [9, -13]],
  calm: [[9, 2], [14, -2]],
  calmLow: [[9, 4], [15, 3]],
  point: [[8, -1], [16, -5]],
  finger: [[8, 1], [10, -11]],
  poke: [[9, 5], [16, 11]],
  pokeUp: [[9, 3], [15, 5]],
  open: [[9, 1], [15, -3]],
  fold: [[4, 7], [0, 9]],
  foldN: [[4, 8], [-2, 9]],
  up: [[3, -8], [5, -17]],
  pocket: [[3, 8], [5, 13]],
  mouth: [[8, 2], [11, -7]],
  shrug: [[9, -1], [13, -4]],
} as const satisfies Record<string, readonly [Pt, Pt]>;

// ---- The parts, painted per pose (cached by their numbers).

export const PARTS: Record<string, Part> = {};
const CACHE = new Map<string, { name: string; at: Pt } | null>();
function part(key: string, paint: (c: Cv) => void, outline = true, w = W, h = H): { name: string; at: Pt } | null {
  if (CACHE.has(key)) return CACHE.get(key)!;
  const c = cvs(w, h);
  paint(c);
  const b = crop(c, outline);
  const out = b ? { name: key, at: b.at } : null;
  if (b) PARTS[key] = b.part;
  CACHE.set(key, out);
  return out;
}
const r1 = (p: Pt) => p.map((v) => Math.round(v * 2) / 2).join(",");

/** Sleeves by top: the arm's ramp and its cuff (none: a bare striped arm). */
const SLEEVE: Partial<Record<Top, { ramp: string; cuff: string }>> = { turtle: { ramp: "FEEE", cuff: "F" } };

/** An elbow for a hoof, bent down and back (two 8.5 px bones), when the pose gives only the hoof. */
function elbowFor(sh: Pt, hoof: Pt): Pt {
  const L = 8.5;
  const dx = hoof[0] - sh[0];
  const dy = hoof[1] - sh[1];
  const d = Math.hypot(dx, dy) || 1;
  if (d >= 2 * L - 0.5) return [sh[0] + dx / 2, sh[1] + dy / 2];
  const a = Math.sqrt(Math.max(0, L * L - (d / 2) ** 2));
  // The two solutions either side of the line; take the lower one (elbows hang).
  const mx = sh[0] + dx / 2;
  const my = sh[1] + dy / 2;
  const px = -dy / d;
  const py = dx / d;
  const e1: Pt = [mx + px * a, my + py * a];
  const e2: Pt = [mx - px * a, my - py * a];
  return e1[1] > e2[1] ? e1 : e2;
}

function armPart(look: Look, sh: Pt, elbow: Pt, hoof: Pt, near: boolean): { name: string; at: Pt } | null {
  const key = `${look.id}:arm:${near ? "n" : "f"}:${[sh, elbow, hoof].map(r1).join(";")}`;
  return part(key, (c) => {
    const sl = SLEEVE[look.top];
    limb(c, [sh, elbow, hoof], look.boss ? 2.7 : 2.3, look.boss ? 2.2 : 1.9, sl ? sl.ramp : FUR, sl ? 0 : 3.4, look.seed + (near ? 0 : 1.5));
    ellipseFill(c, hoof[0], hoof[1], 2.3, 2.1, (_, __, nx, ny) => (litOf(nx, ny) > 0.3 ? "b" : "B"));
    if (sl) {
      const ux = hoof[0] - elbow[0];
      const uy = hoof[1] - elbow[1];
      const L = Math.hypot(ux, uy) || 1;
      ellipseFill(c, hoof[0] - (ux / L) * 2.6, hoof[1] - (uy / L) * 2.6, 1.8, 1.8, () => sl.cuff);
    }
    // The kingpin's pinky ring, on the near hoof.
    if (look.boss && near) put(c, hoof[0] + 1, hoof[1] + 1, "g"), put(c, hoof[0] + 2, hoof[1] + 1, "G");
  });
}
function legPart(look: Look, hip: Pt, knee: Pt, ankle: Pt, key: string): { name: string; at: Pt } | null {
  return part(`${look.id}:leg:${key}`, (c) => {
    limb(c, [hip, knee, ankle], look.boss ? 3.1 : 2.7, look.boss ? 2.3 : 2.1, FUR, 3.3, look.seed + 0.7);
    for (let j = 0; j < 3; j++) for (let i = -2; i <= 2 + (j > 0 ? 1 : 0); i++) put(c, ankle[0] + i, ankle[1] + 1 + j, j === 0 && i < 1 ? "b" : "B");
  });
}

/** The torso and the neck as one part (one outline round both), the mane and the clothes painted on. */
function bodyPart(look: Look, p: Pose, dy: number): { name: string; at: Pt } | null {
  const jig = p.jig ?? 0;
  const top: Pt = [NECK_TOP[0] + (p.hx ?? 0) * 0.6, NECK_TOP[1] + dy + (p.hy ?? 0) * 0.6];
  const sitting = p.sit !== undefined;
  const key = `${look.id}:body:${dy},${jig},${Math.round((p.hx ?? 0) * 10)},${Math.round((p.hy ?? 0) * 10)},${sitting ? 1 : 0},${p.bob ?? 0}`;
  return part(key, (c) => {
    const t: Pt = [TORSO[0], TORSO[1] + dy];
    const base: Pt = [NECK_BASE[0], NECK_BASE[1] + dy];
    const mid: Pt = [(base[0] + top[0]) / 2 - 0.6, (base[1] + top[1]) / 2];
    // The neck: short and thick, banded.
    limb(c, [base, mid, top], 4.2, 3.4, FUR, 3.2, look.seed + 0.4);
    // The torso: a rounded body; stripes round it.
    const rx = look.boss ? 9.2 : 7.8;
    const ry = look.boss ? 12.5 : 12.5;
    ellipseFill(c, t[0], t[1], rx, ry, (_, __, nx, ny) => (ballStripe(nx, ny, 7, look.seed * 0.13) ? "s" : furAt(nx, ny)));
    if (!sitting) ellipseFill(c, t[0] + 0.5, t[1] + 7, rx + 0.6, 6, (_, __, nx, ny) => (ballStripe(nx, ny * 0.5, 7, look.seed * 0.13) ? "s" : litOf(nx, ny) < -0.3 ? "d" : "c"));
    // The kingpin's belly: a big round ball out front, low.
    const belly: Pt = [t[0] + 7, t[1] + 5 + jig * 0.5];
    const brx = 12.6 + Math.max(0, jig) * 0.5 - Math.max(0, -jig) * 0.5;
    const bry = 11.4 + jig * 0.5;
    if (look.boss) ellipseFill(c, belly[0], belly[1], brx, bry, (_, __, nx, ny) => (ballStripe(nx, ny, 9, 0.2) ? "s" : furAt(nx, ny)));
    // The mane: a short standing crest down the back of the neck, black and white by turns, a dark forelock at its top.
    const ux = top[0] - base[0];
    const uy = top[1] - base[1];
    const ul = Math.hypot(ux, uy) || 1;
    const nxm = -uy / ul; // pointing back (left) and up
    const nym = ux / ul;
    const back = nxm > 0 ? -1 : 1;
    for (let s = 0; s <= ul + 1; s += 0.5) {
      const r = 3.6 - (s / ul) * 0.6;
      const cx = base[0] + (ux / ul) * s + back * nxm * r;
      const cy = base[1] + (uy / ul) * s + back * nym * r;
      const dark = Math.floor(s / 1.5) % 2 === 0;
      for (let h = 0; h < 3; h++) put(c, cx + back * nxm * h, cy + back * nym * h, dark ? "s" : h === 2 ? "c" : "C");
    }
    const bot = t[1] + 12;
    const top0 = t[1] - 12;
    // ---- The clothes.
    const vest = (mid2: string, sh2: string, lit2: string, pins: boolean, to: number) => {
      for (let y = Math.floor(top0 + 1); y <= to; y++)
        for (let x = Math.floor(t[0] - 13); x <= Math.ceil(t[0] + 18); x++) {
          const k = get(c, x, y);
          if (k === ".") continue;
          // Under the neck's stripes only on the torso (not up the neck): below the shoulders.
          if (y < t[1] - 9 && x > t[0] + 2) continue;
          // Open at the front in a V down to the chest, so his stripes show there.
          const front = x > t[0] + 2.5 - Math.max(0, (y - top0) * 0.25) && y < top0 + 9;
          if (front) continue;
          const nx = (x + 0.5 - t[0]) / (look.boss ? 14 : 8);
          let v = nx < -0.6 ? lit2 : nx > 0.55 ? sh2 : mid2;
          if (pins && mod(x - Math.round(t[0]), 4) === 0) v = nx > 0.55 ? "V" : "x";
          put(c, x, y, v);
        }
    };
    if (look.top === "pin") {
      // The kingpin's pinstripe vest straining over the belly: buttons down the front, gaps pulled open between them.
      const to = Math.round(belly[1] + 3);
      vest("v", "V", "w", true, to);
      // The hem, curved round the belly's underside.
      for (let x = Math.floor(t[0] - 9); x <= Math.ceil(belly[0] + brx); x++) {
        const y = to - Math.round(Math.max(0, (x - belly[0]) / brx) ** 2 * 3);
        if (get(c, x, y) !== ".") put(c, x, y, "V");
        for (let yy = y + 1; yy <= to; yy++) if ("vVwx".includes(get(c, x, yy))) put(c, x, yy, ".");
      }
      // Fill back the belly under the cut-away (his stripes peeking out under the vest).
      ellipseFill(c, belly[0], belly[1], brx, bry, (x, y, nx, ny) => (get(c, x, y) === "." && y > to - 4 ? (ballStripe(nx, ny, 9, 0.2) ? "s" : furAt(nx, ny)) : null));
      // The buttons and the strain: the front edge follows the belly's front, gold buttons, little gaps between.
      for (let y = Math.round(top0 + 9); y <= to - 2; y++) {
        const ny = (y + 0.5 - belly[1]) / bry;
        const fx = Math.abs(ny) < 1 ? belly[0] + brx * Math.sqrt(1 - ny * ny) * 0.62 : t[0] + 3;
        const ex = Math.max(t[0] + 3, fx);
        put(c, ex, y, "V");
        if (mod(y - top0, 4) === 0) put(c, ex - 1, y, "g");
        else if (mod(y - top0, 4) === 2 && y > belly[1] - bry * 0.6) put(c, ex + 1, y, "s"), put(c, ex + 2, y, "h");
      }
      // Flour: a dusting on the vest, heaviest low on the belly where he leans on the counter.
      for (let y = Math.floor(top0); y <= to; y++)
        for (let x = Math.floor(t[0] - 10); x <= Math.ceil(belly[0] + brx); x++)
          if ("vVwx".includes(get(c, x, y)) && hash(x, y, look.seed + 5) < (y > belly[1] ? 0.16 : 0.05)) put(c, x, y, hash(x, y, 9) < 0.5 ? "h" : "~");
      // The waist apron tied under the belly, hanging over his thighs.
      const ay = Math.round(belly[1] + bry - 2);
      for (let y = ay; y <= (sitting ? ay + 4 : GROUND - 14 + (p.bob ?? 0)); y++) {
        const u = (y - ay) / 10;
        for (let x = Math.round(t[0] - 7 + u); x <= Math.round(belly[0] + 6 + u * 2); x++) {
          let k = x > belly[0] + 3 + u * 2 ? "A" : "a";
          if (y === ay) k = "A";
          if (Math.abs(x - (t[0] + 2 + u)) < 0.6 && y > ay + 2) k = "z";
          if (hash(x, y, look.seed + 9) < 0.08) k = "h";
          put(c, x, y, k);
        }
      }
      // The strings, a bow at the back.
      put(c, t[0] - 8, ay, "A"), put(c, t[0] - 9, ay - 1, "a"), put(c, t[0] - 9, ay + 1, "a"), put(c, t[0] - 10, ay + 2, "A");
    } else if (look.top === "black" || look.top === "blackApron") {
      vest("q", "Q", "j", false, Math.round(bot - 3));
      for (let y = Math.round(top0 + 9); y < bot - 4; y += 3) put(c, t[0] + 4, y, "j");
      // A white shirt collar at the V.
      put(c, t[0] + 2, top0 + 1, "a"), put(c, t[0] + 4, top0 + 1, "a"), put(c, t[0] + 3, top0 + 2, "A");
    } else if (look.top === "turtle") {
      for (let y = Math.floor(top0 - 2); y <= bot - 1; y++)
        for (let x = Math.floor(t[0] - 10); x <= Math.ceil(t[0] + 10); x++) {
          if (get(c, x, y) === ".") continue;
          if (y < t[1] - 10 && Math.hypot(x - base[0], y - base[1]) > 5) continue;
          const nx = (x + 0.5 - t[0]) / 8;
          put(c, x, y, y >= bot - 2 ? "F" : nx > 0.5 ? "F" : (y + x) % 4 === 0 && nx < 0 ? "F" : "E");
        }
      // The rolled neck.
      ellipseFill(c, base[0], base[1] - 1, 4.6, 2.2, (_, __, nx, ny) => (litOf(nx, ny) > 0 ? "E" : "F"));
    } else if (look.top === "mustard") {
      for (let y = Math.floor(top0 + 1); y <= bot - 2; y++)
        for (let x = Math.floor(t[0] - 10); x <= Math.ceil(t[0] + 10); x++) {
          if (get(c, x, y) === "." || (y < t[1] - 9 && x > t[0] + 2)) continue;
          const front = x > t[0] + 2 - Math.max(0, (y - top0) * 0.3) && y < top0 + 7;
          if (front) continue;
          const nx = (x + 0.5 - t[0]) / 8;
          // A knit: little diamonds.
          put(c, x, y, y >= bot - 3 ? "L" : nx > 0.5 ? "L" : mod(x + y, 4) === 0 || mod(x - y, 4) === 0 ? "L" : "M");
        }
    }
    if (look.top === "apron" || look.top === "blackApron") {
      // A white apron from the chest to the knees, its neck strap, flour hoof prints.
      const ay0 = Math.round(top0 + 6);
      const ay1 = sitting ? Math.round(bot + 3) : GROUND - 13 + (p.bob ?? 0);
      for (let y = ay0; y <= ay1; y++) {
        const u = (y - ay0) / Math.max(1, ay1 - ay0);
        for (let x = Math.round(t[0] - 2 - u * 3); x <= Math.round(t[0] + 8 + u * 2); x++) {
          if (y < t[1] && get(c, x, y) === ".") continue;
          let k = x > t[0] + 5 + u * 2 ? "A" : "a";
          if (y === ay1) k = "A";
          if (Math.abs(x - (t[0] + 1)) < 0.6 && y > t[1] + 4) k = "z";
          put(c, x, y, k);
        }
      }
      for (let j = 1; j < 6; j++) put(c, t[0] + 1 + j * 0.4, ay0 - j, "a"); // the strap up round his neck
      for (let x = Math.round(t[0] - 6); x <= t[0] + 8; x++) if (get(c, x, t[1] + 3) !== ".") put(c, x, t[1] + 3, "A"); // the waist tie
      put(c, t[0] + 4, t[1] + 8, "~"), put(c, t[0] + 5, t[1] + 8, "~"), put(c, t[0] + 4, t[1] + 9, "~"); // a floury hoof print
    }
    if (look.bowtie) {
      const bx = Math.round(top[0] - 1);
      const by = Math.round(base[1] - 1);
      for (const [i, j] of [[-2, -1], [-2, 0], [-2, 1], [-1, 0], [0, 0], [1, 0], [2, -1], [2, 0], [2, 1]] as const) put(c, bx + i, by + j, i === 0 ? "U" : "u");
    }
  });
}

/** The hat as its own part (it can lift, tilt and fly), drawn in the head's canvas (the skull's middle at 20, 20). */
function hatPaint(c: Cv, hat: Hat, look: Look): void {
  const sx = 20;
  const sy = 20;
  if (hat === "fedora" || hat === "fedoraGrey") {
    const [m, sh, lt, band] = hat === "fedora" ? ["o", "O", "l", "R"] : ["p", "P", "p", "Q"];
    // The crown: pinched on top, a dent; the band; a wide brim, snapped down at the front.
    for (let y = sy - 10; y <= sy - 5; y++) {
      const half = y === sy - 10 ? 3.5 : y === sy - 9 ? 4.8 : 5.4;
      for (let x = Math.round(sx - half); x <= Math.round(sx + half + 0.5); x++) {
        let k = x < sx - 2 ? lt : x > sx + 3 ? sh : m;
        if (y === sy - 10 && Math.abs(x - sx) < 1) k = sh; // the dent
        if (y >= sy - 6) k = band;
        put(c, x, y, k);
      }
    }
    for (let x = sx - 9; x <= sx + 10; x++) put(c, x, sy - 4, x < sx - 5 ? lt : m);
    for (let x = sx + 4; x <= sx + 10; x++) put(c, x, sy - 3, sh);
    if (look.boss) for (const [x, y] of [[sx - 3, sy - 9], [sx + 1, sy - 8], [sx - 7, sy - 4], [sx + 6, sy - 4]] as const) put(c, x, y, "h");
  } else if (hat === "flat") {
    ellipseFill(c, sx + 0.5, sy - 4.6, 6.4, 3.2, (x, y, nx, ny) => (y > sy - 4 ? null : (x + y) % 3 === 0 ? "Y" : litOf(nx, ny) > 0.1 ? "y" : "Y"));
    for (let x = sx + 3; x <= sx + 10; x++) put(c, x, sy - 4 + (x > sx + 8 ? 1 : 0), "Y");
  } else if (hat === "paper") {
    // A baker's paper cap (a soda-fountain boat), a crease down its side.
    for (let y = sy - 9; y <= sy - 4; y++) {
      const half = 5 + (y - (sy - 9)) * 0.4;
      for (let x = Math.round(sx - half); x <= Math.round(sx + half); x++) put(c, x, y, y === sy - 4 ? "A" : x > sx + 3 ? "A" : x === sx ? "z" : "a");
    }
    put(c, sx - 4, sy - 10, "a"), put(c, sx + 4, sy - 10, "a");
  } else if (hat === "toque") {
    // A tall chef's toque: a band, a big pleated puff.
    for (let y = sy - 8; y <= sy - 4; y++) for (let x = sx - 5; x <= sx + 6; x++) put(c, x, y, x > sx + 3 ? "A" : "a");
    for (const [cx, cy, r] of [[sx - 4, sy - 13, 4.3], [sx + 4, sy - 13, 4.3], [sx, sy - 16, 5]] as const)
      ellipseFill(c, cx, cy, r, r * 0.9, (x, _, nx, ny) => (litOf(nx, ny) > 0.35 ? "h" : litOf(nx, ny) < -0.4 ? "A" : x % 3 === 0 ? "A" : "a"));
  } else if (hat === "beanie") {
    ellipseFill(c, sx, sy - 4.5, 6, 4.6, (x, y, nx, ny) => (y > sy - 3 ? null : y >= sy - 5 ? "U" : x % 2 ? "u" : litOf(nx, ny) > 0.2 ? "u" : "U"));
    ellipseFill(c, sx - 1, sy - 10, 1.8, 1.6, () => "u");
  }
}

/** The head: skull, muzzle, eye, mouth, brows and what's worn on the face (the ears and hat are their own parts). */
function headPart(look: Look, p: Pose, at: Pt): { name: string; at: Pt } | null {
  const eyes = p.eyes ?? "open";
  const mouth = p.mouth ?? "flat";
  const key = `${look.id}:head:${eyes},${mouth},${p.brows ?? "-"},${Math.round((p.pick ?? 0) * 10)},${p.sweat ?? 0}`;
  const h = part(key, (c) => {
    const [sx, sy] = [20, 20];
    // The skull, and the long muzzle forward and down to a dark nose. Stripes arc over the face, none round the eye.
    const muz = (x: number, y: number) => {
      // A rotated ellipse: the muzzle's middle (27, 22.6), 8.4 long, 3.7 deep, tilted 17 degrees down.
      const a = (17 * Math.PI) / 180;
      const dx = x + 0.5 - 27;
      const dy = y + 0.5 - 22.6;
      const u = (dx * Math.cos(a) + dy * Math.sin(a)) / 8.4;
      const v = (-dx * Math.sin(a) + dy * Math.cos(a)) / 3.7;
      return { u, v, in: u * u + v * v <= 1 };
    };
    for (let y = 8; y <= 32; y++)
      for (let x = 8; x <= 38; x++) {
        const nx = (x + 0.5 - sx) / 5.4;
        const ny = (y + 0.5 - sy) / 5;
        const inSkull = nx * nx + ny * ny <= 1;
        const m = muz(x, y);
        if (!inSkull && !m.in) continue;
        let k: string;
        if (m.in && m.u > 0.5) k = m.v < -0.3 && m.u < 0.8 ? "N" : "n";
        else {
          const l = inSkull ? litOf(nx, ny) : litOf(m.u * 0.2, m.v);
          k = l > 0.5 ? "h" : l > 0.1 ? "C" : l < -0.45 ? "d" : "c";
          // Stripes: a few arcs over the brow and cheek at the back of the head, thin bars across the bridge, none by the eye.
          const d = Math.hypot(x + 0.5 - 12, y + 0.5 - 31);
          const nearEye = Math.hypot(x + 0.5 - (sx + 2.5), y + 0.5 - (sy - 0.5)) < 3;
          if (!nearEye && inSkull && !m.in && mod(d + look.seed * 0.7, 3.4) < 1.1) k = "s";
          if (m.in && m.u > -0.15 && m.v < 0.1 && mod(m.u * 8.4, 2.8) < 0.95) k = "s";
        }
        put(c, x, y, k);
      }
    // The nostril, the mouth's line under the nose.
    put(c, 33, 22, "B");
    put(c, 34, 23, "B");
    const ex = sx + 2;
    const ey = sy - 1;
    // The eye.
    const E = (pts: readonly (readonly [number, number, string])[]) => pts.forEach(([x, y, k]) => put(c, ex + x, ey + y, k));
    if (eyes === "open" || eyes === "up" || eyes === "fwd" || eyes === "back" || eyes === "wide" || eyes === "mad") {
      E([[0, 0, "t"], [1, 0, "t"], [0, 1, "t"], [1, 1, "t"], [-1, 0, "t"], [-1, 1, "t"]]);
      if (eyes === "open") E([[0, 0, "e"], [0, 1, "e"]]);
      else if (eyes === "fwd" || eyes === "mad") E([[1, 0, "e"], [1, 1, "e"]]);
      else if (eyes === "back") E([[-1, 0, "e"], [-1, 1, "e"]]);
      else if (eyes === "up") E([[0, 0, "e"]]);
      else if (eyes === "wide") E([[0, 1, "e"], [-1, -1, "t"], [0, -1, "t"], [1, -1, "t"]]);
      if (eyes === "mad") E([[-1, 0, "s"], [0, 0, "s"]]);
    } else if (eyes === "half") {
      E([[-1, 0, "s"], [0, 0, "s"], [1, 0, "s"], [-1, 1, "t"], [0, 1, "e"], [1, 1, "e"]]);
    } else if (eyes === "blink") {
      E([[-1, 1, "s"], [0, 1, "s"], [1, 1, "s"]]);
    } else if (eyes === "shut") {
      // Happy shut: an arch.
      E([[-1, 1, "s"], [0, 0, "s"], [1, 1, "s"]]);
    } else if (eyes === "dizzy") {
      E([[-1, -1, "s"], [1, -1, "s"], [0, 0, "s"], [-1, 1, "s"], [1, 1, "s"]]);
    }
    // Brows.
    if (p.brows === "down" || eyes === "mad") E([[-2, -2, "s"], [-1, -2, "s"], [0, -1, "s"], [1, -1, "s"]]);
    else if (p.brows === "up") E([[-2, -2, "s"], [-1, -3, "s"], [0, -3, "s"], [1, -2, "s"]]);
    else if (p.brows === "one") E([[-1, -3, "s"], [0, -3, "s"], [1, -2, "s"]]);
    // The mouth, under the nose's back.
    const mx = 28;
    const my = 26;
    const line = (pts: readonly Pt[], k = "m") => pts.forEach(([x, y]) => put(c, mx + x, my + y, k));
    if (mouth === "flat") line([[0, 0], [1, 0], [2, 0], [3, 0]]);
    else if (mouth === "smile") line([[-1, -1], [0, 0], [1, 0], [2, 0], [3, 0]]);
    else if (mouth === "smirk") line([[0, 0], [1, 0], [2, 0], [-1, -1], [-2, -1]]);
    else if (mouth === "frown") line([[-1, 1], [0, 0], [1, 0], [2, 0], [3, 1]]);
    else if (mouth === "pout") line([[1, 0], [2, 0], [3, 0]]);
    else if (mouth === "grin" || mouth === "grit") {
      line([[-1, -1], [0, 0], [1, 0], [2, 0], [3, 0], [4, -1]]);
      line([[0, -1], [1, -1], [2, -1], [3, -1]], "t");
      if (mouth === "grit") line([[0, 1], [1, 1], [2, 1], [3, 1]]), line([[1, -1]], "m");
      if (look.boss && mouth === "grin") line([[2, -1]], "g");
    } else if (mouth === "open" || mouth === "laugh") {
      const deep = mouth === "laugh" ? 3 : 2;
      for (let j = 0; j < deep; j++) for (let i = 0; i < 5 - (j === deep - 1 ? 1 : 0); i++) put(c, mx + i - 1, my + j, j === deep - 1 && i > 0 && i < 3 ? "T" : "m");
      line([[0, -1], [1, -1], [2, -1]], "t");
      if (look.boss) line([[1, -1]], "g");
    } else if (mouth === "o") line([[1, 0], [2, 0], [1, 1], [2, 1]]);
    // Face things.
    if (look.shades) {
      for (let j = -1; j <= 1; j++) for (let i = -2; i <= 2; i++) put(c, ex + i, ey + j, j === -1 && i === -1 ? "Z" : "X");
      put(c, ex + 3, ey, "X");
      for (let i = 3; i <= 6; i++) put(c, ex - i, ey - 1, "X");
    }
    if (look.glasses) {
      for (let j = -1; j <= 2; j++) for (let i = -2; i <= 2; i++) put(c, ex + i, ey + j, Math.abs(i) === 2 || j === -1 || j === 2 ? "X" : get(c, ex + i, ey + j) === "e" ? "e" : "H");
      put(c, ex + 3, ey, "X");
      for (let i = 3; i <= 6; i++) put(c, ex - i, ey - 1, "X");
    }
    if (look.scar) for (let i = 0; i < 5; i++) put(c, ex - 2 + i, ey - 3 + i * 1.2, "6");
    if (look.plaster) {
      // A sticking plaster crossed on the bridge of his muzzle.
      for (let i = -2; i <= 2; i++) put(c, 26 + i, 20 + i * 0.6, "4"), put(c, 26 + i, 21 - i * 0.6, i === 0 ? "5" : "4");
    }
    if (look.toothpick) {
      const tilt = p.pick ?? 0;
      for (let i = 0; i < 5; i++) put(c, mx - 1 - i, my - 0.5 - i * (0.15 + tilt * 0.45), "1");
    }
    if (p.sweat) {
      put(c, sx - 3, sy - 4, "!");
      put(c, sx - 3, sy - 3, "!");
      if (p.sweat > 1) put(c, sx - 6, sy - 1, "!"), put(c, sx - 6, sy, "!");
    }
  });
  return h ? { name: h.name, at: [h.at[0] + at[0] - 20, h.at[1] + at[1] - 20] } : null;
}
/** The ears (on top of the hat: they poke up through it), and a pencil tucked behind the near one. */
function earsPart(look: Look, at: Pt, flat = 0): { name: string; at: Pt } | null {
  const e = part(`${look.id}:ears:${flat}`, (c) => {
    const [sx, sy] = [20, 20];
    for (const [bx, by, lean, inner] of [[sx - 3, sy - 4, -0.55, false], [sx - 0.5, sy - 4.5, -0.3, true]] as const) {
      const len = 10 - flat;
      for (let i = 0; i < len; i++) {
        const half = 2 * Math.sin((Math.PI * (i + 1.2)) / (len + 1.6));
        const cx = bx + i * lean + flat * i * -0.4;
        for (let j = -Math.ceil(half); j <= Math.ceil(half); j++) {
          if (Math.abs(j) > half + 0.25) continue;
          const tip = i >= len - 2;
          put(c, cx + j, by - i, tip ? "s" : inner && j >= 0 && i > 0 && i < len - 2 ? "n" : j < 0 ? "C" : "c");
        }
      }
    }
    if (look.pencil) for (let i = 0; i < 7; i++) put(c, sx - 6 + i, sy - 3 - i * 0.5, i === 6 ? "3" : i === 5 ? "1" : "2");
  });
  return e ? { name: e.name, at: [e.at[0] + at[0] - 20, e.at[1] + at[1] - 20] } : null;
}
function hatPart(look: Look, hat: Hat, at: Pt): { name: string; at: Pt } | null {
  if (hat === "none") return null;
  const hp = part(`${look.id}:hat:${hat}`, (c) => hatPaint(c, hat, look));
  return hp ? { name: hp.name, at: [hp.at[0] + at[0] - 20, hp.at[1] + at[1] - 20] } : null;
}
function tailPart(look: Look, p: Pose, dy: number): { name: string; at: Pt } | null {
  const sw = Math.round((p.tail ?? 0) * 2);
  const sitting = p.sit !== undefined;
  return part(`${look.id}:tail:${sw},${dy},${sitting ? 1 : 0}`, (c) => {
    const a: Pt = [28, 72 + dy];
    const b: Pt = sitting ? [22 + sw, 76 + dy] : [23 + sw, 86 + dy];
    limb(c, [a, b], 0.9, 0.7, "dddc");
    ellipseFill(c, b[0], b[1] + 2, 1.5, 2.8, () => "s");
  });
}

// ---- The bread rifle.

/** Its length (px) for the crew; the kingpin's is longer. */
export const ROLL_LEN = 32;
export const BOSS_ROLL_LEN = 36;
const ROLL_R = 2.8;
/**
 * The roll from its back end `a` along `deg`, `len` px: a long fat capsule, tapered at both ends, the crust lit from the top
 * left, pale scoring slashes slanting across its top. `broken`: snapped in two, the front half drooping, crumb showing.
 */
export function paintRoll(c: Cv, a: Pt, deg: number, len: number, broken = false): void {
  const rad = (deg * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  // The side of the roll that faces up (toward the light): the normal with the smaller y.
  let vx = -uy;
  let vy = ux;
  if (vy > 0 || (vy === 0 && vx > 0)) (vx = -vx), (vy = -vy);
  const x0 = Math.floor(Math.min(a[0], a[0] + ux * len) - 4);
  const x1 = Math.ceil(Math.max(a[0], a[0] + ux * len) + 4);
  const y0 = Math.floor(Math.min(a[1], a[1] + uy * len) - 4);
  const y1 = Math.ceil(Math.max(a[1], a[1] + uy * len) + 4);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - a[0];
      const dy = y + 0.5 - a[1];
      const u = dx * ux + dy * uy;
      const v = dx * vx + dy * vy; // + toward the top side
      if (u < 0 || u > len) continue;
      if (broken && Math.abs(u - len * 0.55) < 0.6) continue; // the break
      const end = Math.min(u, len - u);
      const r = end < 4 ? ROLL_R * Math.sqrt(Math.max(0, end / 4)) * 0.85 + 0.6 : ROLL_R;
      if (Math.abs(v) > r) continue;
      const rr = v / r; // -1 bottom, 1 top
      let k = rr > 0.55 ? "0" : rr > 0.0 ? "9" : rr > -0.55 ? "8" : "7";
      // The scoring: slashes slanting across the top half, a pale cut with a dark lip after it.
      const sl = mod(u - v * 1.1 - 1, 6);
      if (end > 3 && rr > -0.35 && sl < 1.1) k = "%";
      else if (end > 3 && rr > -0.35 && sl < 1.9) k = "&";
      // The broken ends: pale crumb.
      if (broken && Math.abs(u - len * 0.55) < 1.6) k = "%";
      put(c, x, y, k);
    }
}

// ---- A whole figure.

export interface Built {
  layers: Layer[];
  hoofN: Pt;
  hoofF: Pt;
  /** The middle of the head (for a hat, a puff), and where a puff leaves the roll's front end (null: no roll). */
  head: Pt;
  muzzle: Pt | null;
  /** The mouth's corner (for a breadstick, a laugh's lines). */
  mouth: Pt;
}
const arm = (sh: Pt, a: Pt | readonly [Pt, Pt]): [Pt, Pt] => {
  if (typeof a[0] === "number") {
    const hoof: Pt = [sh[0] + (a as Pt)[0], sh[1] + (a as Pt)[1]];
    return [elbowFor(sh, hoof), hoof];
  }
  const [e, h] = a as readonly [Pt, Pt];
  return [[sh[0] + e[0], sh[1] + e[1]], [sh[0] + h[0], sh[1] + h[1]]];
};
export function build(look: Look, p: Pose): Built {
  const bob = p.bob ?? 0;
  const air = p.air ?? 0;
  const ox = p.dx ?? 0;
  const sitDrop = p.sit !== undefined ? GROUND - p.sit - 3 - HIP_Y : 0;
  const dy = bob + sitDrop;
  const layers: Layer[] = [];
  const add = (b: { name: string; at: Pt } | null, sx = ox, sy = -air) => b && layers.push({ part: b.name, x: b.at[0] + sx, y: b.at[1] + sy });
  // The shadow stays on the ground (it shrinks a little as he hops).
  const shadow = part(`zshadow:${p.sit !== undefined ? "sit" : "stand"}:${look.boss ? 1 : 0}:${air > 2 ? 1 : 0}`, (c) => {
    const half = (look.boss ? 16 : 13) - (air > 2 ? 3 : 0);
    for (let x = FOOT[0] - half - 2; x <= FOOT[0] + half + 2; x++) {
      const u = Math.abs(x + 0.5 - (FOOT[0] + 1)) / half;
      if (u < 1) put(c, x, GROUND - 1, u < 0.6 ? "-" : "+");
      if (u < 0.7) put(c, x, GROUND, "+");
    }
  }, false);
  add(shadow, 0, 0);
  add(tailPart(look, p, sitDrop));
  const shF: Pt = [SHOULDER_F[0], SHOULDER_F[1] + dy];
  const shN: Pt = [SHOULDER_N[0], SHOULDER_N[1] + dy];
  // The roll (if held): the near hoof's spot, the roll's back end and angle; the far hoof on it if both.
  let [elN, hfN] = arm(shN, p.armN ?? ARMS.hangN);
  let [elF, hfF] = arm(shF, p.armF ?? ARMS.hang);
  let rollA: Pt | null = null;
  let muzzle: Pt | null = null;
  const len = look.boss ? BOSS_ROLL_LEN : ROLL_LEN;
  if (p.gun?.farHold) {
    // Held low in the far hoof, behind him (his near hoof free).
    const rad = (p.gun.deg * Math.PI) / 180;
    hfF = [shF[0] + p.gun.at[0], shF[1] + p.gun.at[1]];
    elF = elbowFor(shF, hfF);
    const grip = p.gun.grip ?? 5;
    rollA = [hfF[0] - Math.cos(rad) * grip, hfF[1] - Math.sin(rad) * grip];
  } else if (p.gun) {
    const rad = (p.gun.deg * Math.PI) / 180;
    const ux = Math.cos(rad);
    const uy = Math.sin(rad);
    hfN = [shN[0] + p.gun.at[0], shN[1] + p.gun.at[1]];
    elN = elbowFor(shN, hfN);
    const grip = p.gun.grip ?? 5;
    rollA = [hfN[0] - ux * grip, hfN[1] - uy * grip];
    if (p.gun.both) {
      const f = grip + (p.gun.far ?? 11);
      hfF = [rollA[0] + ux * f, rollA[1] + uy * f + 1];
      elF = elbowFor(shF, hfF);
    }
    muzzle = p.gun.broken ? null : [Math.round(rollA[0] + ux * (len - 0.5)), Math.round(rollA[1] + uy * (len - 0.5))];
  }
  const rollPart = rollA ? part(`${look.id}:roll:${r1(rollA)}:${p.gun!.deg}:${len}:${p.gun!.broken ? 1 : 0}`, (c) => paintRoll(c, rollA!, p.gun!.deg, len, p.gun!.broken)) : null;
  if (rollPart && p.gun?.farHold) add(rollPart);
  if (p.slung && !p.gun) {
    const sa: Pt = [46, 84 + dy];
    add(part(`${look.id}:slung:${dy}`, (c) => paintRoll(c, sa, -118, len)));
  }
  add(armPart(look, shF, elF, hfF, false));
  // The legs.
  const feet = p.feet ?? (look.boss ? [[-5, 0], [5, 0]] : [[-4, 0], [4, 0]]);
  const legs = ([HIP_F, HIP_N] as const).map((hip, i) => {
    const f = feet[i]!;
    if (p.sit !== undefined) {
      const hy = GROUND - p.sit - 3;
      const hp: Pt = [hip[0] - 2, hy];
      const knee: Pt = [hip[0] + 8 + i, hy - 1];
      const ankle: Pt = [hip[0] + 9 + i + f[0] * 0.2, GROUND - 4 - f[1]];
      return legPart(look, hp, knee, ankle, `sit:${p.sit},${i},${f[0]},${f[1]}`);
    }
    const hp: Pt = [hip[0], hip[1] + bob * 0.5];
    const ankle: Pt = [FOOT[0] + f[0], GROUND - 4 - f[1] + air * 0];
    const knee: Pt = [(hp[0] + ankle[0]) / 2 + 1.5, (hp[1] + ankle[1]) / 2 - 0.5];
    return legPart(look, hp, knee, ankle, `${r1(hp)};${r1(ankle)}`);
  });
  add(legs[0]!);
  add(legs[1]!);
  add(bodyPart(look, p, dy));
  // The far hoof, re-drawn over the belly when it reaches across the front to hold the roll (so the grip reads).
  const top: Pt = [NECK_TOP[0] + (p.hx ?? 0) * 0.6, NECK_TOP[1] + dy + (p.hy ?? 0) * 0.6];
  const skull: Pt = [Math.round(SKULL[0] + (top[0] - NECK_TOP[0]) + (p.hx ?? 0) * 0.4), Math.round(SKULL[1] + (top[1] - NECK_TOP[1]) + (p.hy ?? 0) * 0.4)];
  if (rollPart && p.gun?.back) add(rollPart);
  add(earsPart(look, skull));
  add(headPart(look, p, skull));
  const hat = p.hatGone || p.hatAt ? "none" : look.hat;
  add(hatPart(look, hat, [skull[0], skull[1] - (p.hatLift ?? 0)]));
  if (p.hatAt) add(hatPart(look, look.hat, p.hatAt));
  if (rollPart && !p.gun?.back && !p.gun?.farHold) {
    if (p.gun?.both) add(armPart(look, shF, elF, hfF, false));
    add(rollPart);
    if (p.gun?.both) add(part(`${look.id}:hoofF:${r1(hfF)}`, (c) => ellipseFill(c, hfF[0], hfF[1], 2.3, 2.1, (_, __, nx, ny) => (litOf(nx, ny) > 0.3 ? "b" : "B"))));
  }
  add(armPart(look, shN, elN, hfN, true));
  const sh = (q: Pt): Pt => [q[0] + ox, q[1] - air];
  return { layers, hoofN: sh(hfN), hoofF: sh(hfF), head: sh(skull), muzzle: muzzle ? sh(muzzle) : null, mouth: sh([skull[0] + 8, skull[1] + 6]) };
}

// ---- Specks (no outline): a muzzle puff, steam, crumbs, stars, laugh lines, sound lines.

/** The little muzzle puff of flour at (x, y), `t` frames on (0: the pop, 1-3: a cloud drifting on and thinning). */
export function puff([x, y]: Pt, t: number, dir = 1): Speck[] {
  const out: Speck[] = [];
  if (t === 0) {
    // The pop: a white-hot star of flour.
    for (const [i, j, k] of [[0, 0, "*"], [1, 0, "*"], [2, 0, "h"], [1, -1, "h"], [1, 1, "h"], [3, 0, "~"], [2, -2, "~"], [2, 2, "~"], [0, -1, "~"], [0, 1, "~"]] as const) out.push([x + i * dir, y + j, k]);
    return out;
  }
  const cx = x + (2 + t * 2) * dir;
  const cy = y - t * 0.6;
  const r = 1.4 + t * 0.9;
  for (let j = -Math.ceil(r); j <= Math.ceil(r); j++)
    for (let i = -Math.ceil(r); i <= Math.ceil(r); i++) {
      if (i * i + j * j > r * r + 0.4) continue;
      if (t >= 2 && hash(i, j, t + 3) < 0.25 * t - 0.2) continue;
      out.push([Math.round(cx + i), Math.round(cy + j), i * dir + j < -1 ? "h" : i * dir + j < 1.5 ? "~" : "^"]);
    }
  // Crumbs flung on ahead, falling.
  for (let n = 0; n < 3; n++) out.push([Math.round(cx + (r + 1 + n * 1.5) * dir), Math.round(cy + n - 1 + t * 0.7), n % 2 ? "8" : "9"]);
  return out;
}
/** A curl of steam rising from (x, y), `t` frames on: a little cartoon S, drifting up and thinning. */
export function steam([x, y]: Pt, t: number): Speck[] {
  if (t < 0 || t > 5) return [];
  const out: Speck[] = [];
  for (let i = 0; i < 6; i++) {
    const yy = y - t * 1.5 - i;
    const xx = x + Math.round(1.2 * Math.sin((i + t) * 0.9));
    if (t >= 4 && i % 2) continue;
    out.push([xx, Math.round(yy), i < 3 ? "=" : ":"]);
  }
  return out;
}
/** A warm breadstick clamped in the corner of his mouth like a cigar (from the mouth's corner, out and down), its tip. */
export function breadstick([x, y]: Pt, tilt = 0): { specks: Speck[]; tip: Pt } {
  const out: Speck[] = [];
  const dy = 0.3 - tilt * 0.5;
  for (let i = 0; i < 7; i++) {
    const px = Math.round(x + 1 + i);
    const py = Math.round(y + i * dy);
    out.push([px, py, i % 3 === 1 ? "%" : "9"], [px, py + 1, i === 6 ? "9" : "7"]);
  }
  return { specks: out, tip: [Math.round(x + 8), Math.round(y + 6 * dy - 1)] };
}
/** Dizzy stars round (x, y), `t` frames on. */
export function stars([x, y]: Pt, t: number): Speck[] {
  const out: Speck[] = [];
  for (let n = 0; n < 3; n++) {
    const a = t * 0.9 + (n * Math.PI * 2) / 3;
    const sx = Math.round(x + Math.cos(a) * 8);
    const sy = Math.round(y + Math.sin(a) * 2.5);
    out.push([sx, sy, "g"], [sx - 1, sy, "G"], [sx + 1, sy, "G"], [sx, sy - 1, "G"], [sx, sy + 1, "G"]);
  }
  return out;
}
/** Laugh lines: little "ha" ticks off the mouth (two short dashes up and out), `t` frames on. */
export function hahas([x, y]: Pt, t: number): Speck[] {
  const o = t % 2;
  return [
    [x + 3 + o, y - 4 - o, "h"],
    [x + 4 + o, y - 5 - o, "h"],
    [x + 5 + o, y - 1, "h"],
    [x + 6 + o, y - 1, "h"],
    [x + 3 + o, y + 2 + o, "h"],
    [x + 4 + o, y + 3 + o, "h"],
  ];
}
/** Flour and crumbs falling like confetti over (x0..x1), `t` frames on. */
export function crumbFall(x0: number, x1: number, y0: number, t: number, seed = 1): Speck[] {
  const out: Speck[] = [];
  for (let n = 0; n < 10; n++) {
    const x = Math.round(x0 + hash(n, 1, seed) * (x1 - x0) + Math.sin(t + n) * 1.2);
    const y = Math.round(y0 + mod(hash(n, 2, seed) * 30 + t * 4, 34));
    out.push([x, y, n % 3 === 0 ? "9" : n % 3 === 1 ? "h" : "~"]);
  }
  return out;
}

/** A frame from a pose, with specks on top (kept inside the frame), shared parts. */
export function frame(look: Look, ms: number, p: Pose, extra: { specks?: (b: Built) => Speck[]; cue?: string; shake?: readonly [number, number]; pal?: Record<string, string> } = {}): Frame {
  const b = build(look, p);
  const specks = extra.specks?.(b).filter(([x, y]) => x >= 0 && y >= 0 && x < W && y < H);
  return {
    ms,
    layers: b.layers,
    ...(specks?.length ? { specks } : {}),
    ...(extra.cue ? { cue: extra.cue } : {}),
    ...(extra.shake ? { shake: extra.shake } : {}),
    ...(extra.pal ? { pal: extra.pal } : {}),
  };
}
/** The muzzle point of a pose (where a puff leaves the roll), for the notes and the code. */
export const muzzleOf = (look: Look, p: Pose): Pt | null => build(look, p).muzzle;
