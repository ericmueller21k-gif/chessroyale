/**
 * Copied as drawn from `claude/boss-art` (scripts/boss-art/out/npc-grex/giraffe-rig.ts at 0e4f6482, Nov 4, 2026; Eric approved the build Nov 4).
 * Changed: the import paths. The notes: scripts/boss-art/out/shop-grex-nov4.md and intro-grex-nov4.md on that branch.
 */
/**
 * The warehouse crew's giraffe (Nov 4, drawn by hand on the weekly plan usage): one giraffe, dressed seven ways (the shady
 * dealer, the lift guy, the forklift guy, the two wall leaners, the clipboard guy, the dozer). Jefferson alone looks his own
 * way (his big head, his flames, his bright yellow): the crew are plainer, a muted tan with brown patches, a normal giraffe's
 * small head on a long neck, short ossicones with dark knobs, standing on two legs as he does. About 79 px from hooves to
 * ossicones at the room's scale (37 px a square, drawn 1:1): taller than the other shops' kids, a little under Jefferson
 * (about 84 px to his flames). Three-quarters, facing our right (mirror them to face left), light from the top left.
 *
 * Frame: 64 x 104, the foot (the ground between the hooves) at [30, 100]. Rigging: each part is painted from a pose (a
 * handful of numbers: the bob, a lean, the head's offset, each foot, each arm's elbow and hoof, the eyes and mouth) and a look
 * (the hat, the top, shades, a toothpick), every part its own outlined layer, back to front; parts are made once per pose and
 * shared between frames (`PARTS`).
 */
import type { Frame, Layer, Part, Speck } from "../../characters/sprite.ts";

export type Pt = readonly [number, number];
export const W = 64;
export const H = 104;
export const GROUND = 100;
export const FOOT: Pt = [30, GROUND];

export const CREW_PALETTE: Record<string, string> = {
  k: "#1e0e05", // outline (Jefferson's)
  d: "#a8742c", // a crew giraffe's tan: dark, mid, light, lit
  c: "#c99642",
  C: "#e0b562",
  h: "#f1d38b",
  o: "#8a4f1f", // patches: mid, dark
  O: "#63360f",
  u: "#f3e3b8", // cream: muzzle, belly
  U: "#d6bb85",
  b: "#4f2d12", // hooves, ossicone knobs, the mane, the tail's tuft
  B: "#311a08",
  s: "#140f18", // the eye: pupil; white
  t: "#fbf5e6",
  m: "#5a1a0b", // the mouth
  v: "#cfe83a", // hi-vis lime: mid, shade; hi-vis orange: mid, shade
  V: "#9fb81e",
  e: "#ff8a1c",
  E: "#d4600b",
  x: "#eef2f5", // the reflective strips: bright, grey
  X: "#a9b2ba",
  y: "#ffd23a", // hard hat yellow: mid, shade, lit
  Y: "#dc9f12",
  L: "#fff2a0",
  a: "#b08a52", // the trench coat: mid, shade, lit, deep
  A: "#86653a",
  z: "#cba872",
  Z: "#5a4122",
  g: "#18161f", // sunglasses: lens, a glint
  G: "#5a5f80",
  p: "#ead6a2", // the toothpick
  n: "#3062aa", // a cap's blue: mid, shade
  N: "#1f4078",
  j: "#4a5f3c", // the leaner's bomber jacket: mid, shade; its rib
  J: "#33432a",
  i: "#7a6a52", // the leaner's flat cap: mid, shade
  I: "#57493a",
  r: "#b8322a", // the beanie's red: mid, shade
  R: "#7e1d19",
  q: "#4d6f9e", // denim: mid, shade
  Q: "#34507a",
  w: "#a3a3ae", // a sparkler's wire: light, dark
  W: "#5e5e68",
  "1": "#ffffff", // a spark: white-hot, yellow, orange, red
  "2": "#fff3a0",
  "3": "#ffc93a",
  "4": "#ff8a1f",
  "5": "#d9d4dc", // smoke: light, mid
  "6": "#a7a1ae",
  "7": "#8a5a2b", // the clipboard: its board, its clip (steel), the paper, the lines
  "8": "#b8bec8",
  "9": "#f4f3ef",
  "0": "#8b95a8",
  T: "#1f1f26", // the machines: rubber, its edge; dark steel, steel; the lift's lit orange
  l: "#3d3d47",
  S: "#2b2d35",
  M: "#5a5e69",
  F: "#ffb066",
  "-": "#0d0e1280", // ground shadow: core, rim
  "+": "#0d0e1244",
};

// ---- A small canvas.

type Cv = string[][];
const cvs = (w = W, h = H): Cv => Array.from({ length: h }, () => Array<string>(w).fill("."));
const put = (c: Cv, x: number, y: number, k: string) => {
  x = Math.round(x);
  y = Math.round(y);
  if (y >= 0 && y < c.length && x >= 0 && x < c[0]!.length) c[y]![x] = k;
};
const get = (c: Cv, x: number, y: number) => c[y]?.[x] ?? ".";
function hash(x: number, y: number, seed = 1): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Cropped to what's drawn, as a layer's part and its top-left. */
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

/** Distance from p to segment ab, and where along it (0..1), and the side. */
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
/**
 * A limb along points (each a joint), radius r0 at its start to r1 at its end, painted with `ramp` (dark, mid, light, lit)
 * by the light from the top left on its round side; `spots`: brown patches on it, seeded.
 */
function limb(c: Cv, pts: readonly Pt[], r0: number, r1: number, ramp: string, spots = 0): void {
  const n = pts.length - 1;
  const x0 = Math.floor(Math.min(...pts.map((p) => p[0])) - 4);
  const x1 = Math.ceil(Math.max(...pts.map((p) => p[0])) + 4);
  const y0 = Math.floor(Math.min(...pts.map((p) => p[1])) - 4);
  const y1 = Math.ceil(Math.max(...pts.map((p) => p[1])) + 4);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      let best = { d: Infinity, t: 0, nx: 0, ny: 0, i: 0 };
      for (let i = 0; i < n; i++) {
        const s = seg(x + 0.5, y + 0.5, pts[i]!, pts[i + 1]!);
        if (s.d < best.d) best = { ...s, i };
      }
      const along = (best.i + best.t) / n;
      const r = r0 + (r1 - r0) * along;
      if (best.d > r) continue;
      const lit = -(best.nx * 0.62 + best.ny * 0.78) * (best.d / Math.max(0.6, r));
      let k = lit > 0.45 ? ramp[3]! : lit > 0.05 ? ramp[2]! : lit < -0.45 ? ramp[0]! : ramp[1]!;
      if (spots && (k === ramp[1] || k === ramp[2]) && hash(Math.floor((x + 40) / 4), Math.floor((y + 40) / 4), spots) < 0.38 && hash(x, y, spots + 3) < 0.8) k = lit < -0.1 ? "O" : "o";
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
const litOf = (nx: number, ny: number) => -(nx * 0.62 + ny * 0.78);

// ---- The look and the pose.

export type Hat = "none" | "hard" | "cap" | "beanie" | "flat";
export type Top = "vest-lime" | "vest-orange" | "trench" | "jacket" | "denim";
export interface Look {
  id: string;
  hat: Hat;
  top: Top;
  shades?: boolean;
  toothpick?: boolean;
  /** Seeds his patches (each giraffe's own). */
  seed: number;
}
export type Eyes = "open" | "blink" | "shut" | "half" | "up" | "side";
export type Mouth = "flat" | "smile" | "smirk" | "open" | "o" | "grin";
export interface Pose {
  /** Head, neck, torso and arms down this many px (a breath, a step). */
  bob?: number;
  /** Leaning back (against a wall on his left): the top of him this many px to the left at the head, in proportion below. */
  lean?: number;
  /** The head on the neck: forward (+x), down (+y). */
  hx?: number;
  hy?: number;
  /** Each foot (far, near): its x from the foot's middle, and how far it's lifted. */
  feet?: readonly [Pt, Pt];
  /** Each arm (far, near): its elbow and its hoof, from its shoulder. */
  armF?: readonly [Pt, Pt];
  armN?: readonly [Pt, Pt];
  eyes?: Eyes;
  mouth?: Mouth;
  /** The tail's swing (-1 to 1). */
  tail?: number;
  /** Sitting on a seat this many px over the ground (legs forward, hooves on the ground). */
  sit?: number;
  /** The toothpick's tilt (0 level, 1 up: a flick). */
  pick?: number;
  /** The hard hat tipped down over his eyes (dozing). */
  tipped?: boolean;
  /** (The dealer) his coat's near side held open: 0 shut, 1 a little, 2 wide (the rockets pinned inside show). */
  open?: number;
}

/** Standing: the body's points (frame px), before the bob and lean. */
const HIP_Y = 78;
const HIP_F: Pt = [27, HIP_Y];
const HIP_N: Pt = [32, HIP_Y];
const TORSO: Pt = [29, 68];
const SHOULDER_F: Pt = [26, 59];
const SHOULDER_N: Pt = [32, 59];
const NECK_BASE: Pt = [30, 60];
const NECK_TOP: Pt = [36, 37];
/** The skull's middle at rest (the head's own points are from here). */
const SKULL: Pt = [36, 32];

export const ARMS = {
  hang: [[1, 8], [2, 16]],
  hangN: [[2, 8], [3, 16]],
  hip: [[6, 6], [3, 12]],
  cross: [[5, 8], [-1, 6]],
  crossN: [[3, 8], [-4, 7]],
  wave: [[7, -3], [9, -13]],
  waveOut: [[8, -4], [12, -12]],
  beckon: [[8, 2], [11, -6]],
  beckonIn: [[7, 3], [7, -4]],
  mouth: [[8, -4], [10, -16]],
  side: [[3, 8], [7, 13]],
  clip: [[6, 6], [11, 2]],
  pencil: [[6, 5], [10, 1]],
  pencilUp: [[6, 4], [10, -2]],
  coat: [[6, 3], [10, 6]],
  coatWide: [[8, 1], [14, 4]],
  pocket: [[3, 8], [4, 13]],
  wheel: [[8, 4], [14, 2]],
  rail: [[8, 5], [13, 6]],
  fold: [[4, 7], [0, 9]],
  foldN: [[4, 8], [-2, 9]],
} as const satisfies Record<string, readonly [Pt, Pt]>;

// ---- The parts, painted per pose (cached by their numbers).

export const PARTS: Record<string, Part> = {};
const CACHE = new Map<string, { name: string; at: Pt } | null>();
function part(key: string, paint: (c: Cv) => void, outline = true): { name: string; at: Pt } | null {
  if (CACHE.has(key)) return CACHE.get(key)!;
  const c = cvs();
  paint(c);
  const b = crop(c, outline);
  const out = b ? { name: key, at: b.at } : null;
  if (b) PARTS[key] = b.part;
  CACHE.set(key, out);
  return out;
}

const SKIN = "dcCh";
/** The lean's shift at height y (more the higher): px to the left. */
const leanAt = (lean: number, y: number) => -lean * Math.max(0, (HIP_Y + 4 - y) / (HIP_Y + 4 - 24));

/** Sleeves by top: the arm's ramp (dark, mid, light, lit) and its cuff. */
const SLEEVE: Record<Top, { ramp: string; cuff: string } | null> = {
  "vest-lime": null,
  "vest-orange": null,
  trench: { ramp: "ZAaz", cuff: "A" },
  jacket: { ramp: "JJjj", cuff: "J" },
  denim: null,
};

function armPart(look: Look, sh: Pt, elbow: Pt, hoof: Pt, near: boolean): { name: string; at: Pt } | null {
  const key = `${look.id}:arm:${near ? "n" : "f"}:${[sh, elbow, hoof].map((p) => p.map((v) => Math.round(v)).join(",")).join(";")}`;
  return part(key, (c) => {
    const sl = SLEEVE[look.top];
    const ramp = sl ? sl.ramp : SKIN;
    limb(c, [sh, elbow, hoof], 2.3, 1.9, ramp, sl ? 0 : look.seed + (near ? 11 : 12));
    // The hoof (a hand): dark, round, lit on its top.
    ellipseFill(c, hoof[0], hoof[1], 2.3, 2.1, (_, __, nx, ny) => (litOf(nx, ny) > 0.3 ? "b" : "B"));
    if (sl) {
      // The cuff just short of the hoof.
      const ux = hoof[0] - elbow[0];
      const uy = hoof[1] - elbow[1];
      const L = Math.hypot(ux, uy) || 1;
      const cx = hoof[0] - (ux / L) * 2.6;
      const cy = hoof[1] - (uy / L) * 2.6;
      ellipseFill(c, cx, cy, 1.8, 1.8, () => sl.cuff);
    }
  });
}
function legPart(look: Look, hip: Pt, knee: Pt, ankle: Pt, key: string): { name: string; at: Pt } | null {
  return part(`${look.id}:leg:${key}`, (c) => {
    limb(c, [hip, knee, ankle], 2.6, 2.1, SKIN, look.seed + 21);
    // The hoof: a dark wedge, its toe forward (to the right).
    for (let j = 0; j < 3; j++) for (let i = -2; i <= 2 + (j > 0 ? 1 : 0); i++) put(c, ankle[0] + i, ankle[1] + 1 + j, j === 0 && i < 1 ? "b" : "B");
  });
}

/** The torso and the neck as one part (one outline round both), the clothes painted on. */
function bodyPart(look: Look, p: Pose): { name: string; at: Pt } | null {
  const bob = p.bob ?? 0;
  const lean = p.lean ?? 0;
  const sitDrop = p.sit !== undefined ? (GROUND - p.sit - 3) - HIP_Y : 0;
  const dy = bob + sitDrop;
  const L = (q: Pt, extra = 0): Pt => [q[0] + leanAt(lean, q[1]) + extra, q[1] + dy];
  const top: Pt = [NECK_TOP[0] + (p.hx ?? 0) * 0.6 + leanAt(lean, NECK_TOP[1]), NECK_TOP[1] + dy + (p.hy ?? 0) * 0.6];
  const key = `${look.id}:body:${dy},${lean},${Math.round((p.hx ?? 0) * 10)},${Math.round((p.hy ?? 0) * 10)},${p.open ?? 0},${p.sit ?? "-"}`;
  return part(key, (c) => {
    const t = L(TORSO);
    // The neck: from inside the shoulders up to the head, a gentle forward curve, thick at the base.
    const mid: Pt = [(NECK_BASE[0] + top[0]) / 2 - 1.2 + leanAt(lean, 48) * 0.3, (NECK_BASE[1] + dy + top[1]) / 2];
    limb(c, [L(NECK_BASE), mid, top], 3.3, 2.4, SKIN, look.seed + 31);
    // The mane down the back of the neck: a short dark-brown fringe on its left.
    for (let s = 0.1; s < 0.95; s += 0.06) {
      const a = s < 0.5 ? L(NECK_BASE) : mid;
      const b = s < 0.5 ? mid : top;
      const u = s < 0.5 ? s * 2 : (s - 0.5) * 2;
      const x = a[0] + (b[0] - a[0]) * u;
      const y = a[1] + (b[1] - a[1]) * u;
      put(c, x - 3.2, y, "b");
      if (Math.round(y) % 3) put(c, x - 2.4, y, "b");
    }
    // The torso: a rounded body, wider low down, cream at the belly.
    ellipseFill(c, t[0], t[1], 7.6, 12.5, (x, y, nx, ny) => {
      const l = litOf(nx, ny);
      if (nx > 0.25 && ny > -0.2 && ny < 0.75) return l > 0 ? "u" : "U";
      return l > 0.45 ? "C" : l > 0.05 ? "c" : l < -0.45 ? "d" : "c";
    });
    if (p.sit === undefined) ellipseFill(c, t[0] + 0.5, t[1] + 7, 8.2, 6, (_, __, nx, ny) => (litOf(nx, ny) < -0.3 ? "d" : "c"));
    // The clothes.
    const top0 = t[1] - 12;
    const bot = t[1] + 12;
    if (look.top === "vest-lime" || look.top === "vest-orange" || look.top === "denim") {
      const [mid2, sh2] = look.top === "vest-lime" ? ["v", "V"] : look.top === "vest-orange" ? ["e", "E"] : ["q", "Q"];
      for (let y = Math.floor(top0 + 1); y <= Math.ceil(bot - 2); y++)
        for (let x = Math.floor(t[0] - 9); x <= Math.ceil(t[0] + 9); x++) {
          const k = get(c, x, y);
          if (k === "." || "bB".includes(k)) continue;
          // Open at the front (a V down to the chest), so the cream shows there.
          const front = x > t[0] + 3 - Math.max(0, (y - top0) * 0.2) && y < top0 + 10;
          if (front) continue;
          const nx = (x + 0.5 - t[0]) / 8;
          let v = nx > 0.55 ? sh2 : mid2;
          if (look.top !== "denim" && (Math.abs(y - (t[1] + 1)) < 1 || Math.abs(y - (t[1] + 6)) < 1)) v = nx > 0.55 ? "X" : "x";
          if (look.top === "denim" && (x === Math.round(t[0] + 2) || y === Math.round(bot - 3))) v = "Q";
          put(c, x, y, v);
        }
    } else if (look.top === "jacket") {
      for (let y = Math.floor(top0 + 1); y <= Math.ceil(bot); y++)
        for (let x = Math.floor(t[0] - 9); x <= Math.ceil(t[0] + 9); x++) {
          const k = get(c, x, y);
          if (k === "." || "bB".includes(k)) continue;
          const nx = (x + 0.5 - t[0]) / 8;
          put(c, x, y, y >= bot - 2 ? "J" : nx > 0.5 ? "J" : "j");
        }
      // A zip down the front.
      for (let y = Math.floor(top0 + 3); y < bot - 2; y++) put(c, t[0] + 4, y, "x");
    } else if (look.top === "trench") {
      // The coat: down past his knees, flaring a little; a belt; the collar popped up round the neck.
      const hem = p.sit !== undefined ? bot + 3 : GROUND - 12 + bob;
      const open = p.open ?? 0;
      for (let y = Math.floor(top0); y <= hem; y++) {
        const u = (y - top0) / (hem - top0);
        const half = 6.8 + u * 2.4;
        for (let x = Math.floor(t[0] - half); x <= Math.ceil(t[0] + half + (u > 0.5 ? 1 : 0)); x++) {
          if (y < t[1] + 2 && get(c, x, y) === ".") continue; // the shoulders' outline is the body's
          const nx = (x + 0.5 - t[0]) / half;
          let k = nx < -0.55 ? "z" : nx > 0.6 ? "A" : "a";
          if (y === hem) k = "Z";
          // The front edge and its overlap, a fold.
          if (Math.abs(x - (t[0] + 3.5)) < 0.6 && y > t[1] - 6) k = "Z";
          if (Math.abs(x - (t[0] - 3)) < 0.6 && y > t[1] + 6) k = "A";
          put(c, x, y, k);
        }
      }
      // The belt.
      for (let x = Math.floor(t[0] - 8); x <= Math.ceil(t[0] + 8); x++) if (get(c, x, Math.round(t[1] + 3)) !== ".") put(c, x, t[1] + 3, "Z");
      put(c, t[0] + 3, t[1] + 3, "p");
      put(c, t[0] + 4, t[1] + 3, "p");
      // Buttons.
      for (const yy of [t[1] - 6, t[1] - 2, t[1] + 8]) put(c, t[0] + 5, yy, "Z");
      // The popped collar: two flaps up either side of the neck base.
      for (let j = 0; j < 6; j++) {
        for (let i = 0; i < 3; i++) put(c, t[0] - 4 + i - j * 0.3, top0 - j + 1, i === 0 ? "z" : "a");
        for (let i = 0; i < 3; i++) put(c, t[0] + 3 + i + j * 0.3, top0 - j + 1, i === 2 ? "A" : "a");
      }
      if (open > 0) {
        // Held open on the near side: the dark lining, rockets pinned inside in a row.
        const w = open === 1 ? 4 : 8;
        for (let y = Math.floor(t[1] - 7); y <= Math.round(hem - 2); y++)
          for (let x = Math.round(t[0] + 4); x <= Math.round(t[0] + 4 + w); x++) put(c, x, y, x === Math.round(t[0] + 4 + w) ? "a" : "Z");
        const inks = ["r", "n", "v", "y", "e"];
        for (let i = 0; i < (open === 1 ? 1 : 3); i++) {
          const rx = Math.round(t[0] + 5 + i * 2.4);
          for (let j = 0; j < 10; j++) put(c, rx, t[1] - 4 + j, j < 2 ? "R" : j > 7 ? "W" : inks[(i + j) % inks.length]!);
        }
      }
    }
  });
}

/** The head: skull, muzzle, ossicones, ear, eye, mouth, and what he wears on it. */
function headPart(look: Look, p: Pose, at: Pt): { name: string; at: Pt } | null {
  const eyes = p.eyes ?? "open";
  const mouth = p.mouth ?? "flat";
  const key = `${look.id}:head:${eyes},${mouth},${Math.round((p.pick ?? 0) * 10)},${p.tipped ? 1 : 0}`;
  const h = part(key, (c) => {
    const [sx, sy] = [20, 20]; // drawn about (20, 20) in its own canvas, moved to `at` by the layer
    // The ossicones (behind the hat): two short horns, dark knobs on top.
    for (const ox of [-2.5, 1.5]) {
      for (let j = 0; j < 6; j++) put(c, sx + ox + j * 0.15, sy - 5 - j, j > 3 ? "b" : "c");
      for (let j = 0; j < 6; j++) put(c, sx + ox + 1 + j * 0.15, sy - 5 - j, j > 3 ? "B" : "d");
    }
    // The ear: a leaf pointing back and a little up.
    for (let i = 0; i < 7; i++) {
      const half = 1.6 * Math.sin((Math.PI * (i + 0.5)) / 7);
      for (let j = -Math.ceil(half); j <= Math.ceil(half); j++) if (Math.abs(j) <= half + 0.2) put(c, sx - 4 - i, sy - 2 - i * 0.35 + j, j > 0 ? "d" : i > 4 ? "C" : "c");
    }
    // Skull and muzzle.
    ellipseFill(c, sx, sy, 5.6, 5, (_, __, nx, ny) => {
      const l = litOf(nx, ny);
      return l > 0.45 ? "h" : l > 0.05 ? "C" : l < -0.45 ? "d" : "c";
    });
    ellipseFill(c, sx + 7.5, sy + 2.2, 5.2, 3.4, (_, __, nx, ny) => {
      const l = litOf(nx, ny);
      return ny > 0.35 ? "U" : l > 0.3 ? "u" : "U";
    });
    // A patch on the skull (his own), the nostril.
    if (look.seed % 2) put(c, sx - 2, sy + 2, "o"), put(c, sx - 1, sy + 2, "o"), put(c, sx - 2, sy + 1, "o");
    else put(c, sx + 1, sy - 2, "o"), put(c, sx + 2, sy - 2, "o");
    put(c, sx + 11, sy + 1, "B");
    // The eye.
    const ex = sx + 3;
    const ey = sy - 1;
    if (eyes === "open" || eyes === "up" || eyes === "side") {
      put(c, ex, ey, "t");
      put(c, ex + 1, ey, "t");
      put(c, ex, ey + 1, "t");
      put(c, ex + 1, ey + 1, eyes === "side" ? "t" : "s");
      if (eyes === "side") put(c, ex + 1, ey + 1, "t"), put(c, ex + 1, ey, "s");
      else if (eyes === "up") put(c, ex + 1, ey, "s"), put(c, ex + 1, ey + 1, "t");
      else put(c, ex + 1, ey + 1, "s"), put(c, ex, ey + 1, "s");
      put(c, ex - 1, ey - 1, "B");
      put(c, ex, ey - 1, "B");
    } else if (eyes === "half") {
      put(c, ex, ey, "B");
      put(c, ex + 1, ey, "B");
      put(c, ex, ey + 1, "t");
      put(c, ex + 1, ey + 1, "s");
    } else {
      put(c, ex - 1, ey + 1, "B");
      put(c, ex, ey + 1, "B");
      put(c, ex + 1, ey + 1, "B");
      if (eyes === "shut") put(c, ex + 2, ey, "B");
    }
    // The mouth.
    const mx = sx + 8;
    const my = sy + 4;
    const line = (pts: readonly Pt[], k = "m") => pts.forEach(([x, y]) => put(c, mx + x, my + y, k));
    if (mouth === "flat") line([[0, 0], [1, 0], [2, 0], [3, 0]]);
    else if (mouth === "smile") line([[0, -1], [1, 0], [2, 0], [3, 0], [4, -1]]);
    else if (mouth === "smirk") line([[0, 0], [1, 0], [2, 0], [3, -1], [4, -1]]);
    else if (mouth === "grin") line([[0, -1], [1, 0], [2, 0], [3, 0], [4, -1]]), line([[1, -1], [2, -1], [3, -1]], "t");
    else if (mouth === "open") line([[0, 0], [1, 0], [2, 0], [3, 0], [1, 1], [2, 1], [3, 1], [0, -1]]), line([[1, 0], [2, 0]], "m");
    else if (mouth === "o") line([[1, 0], [2, 0], [1, 1], [2, 1]]);
    // Shades: a dark lens over the eye, its rim, a glint, the arm back to the ear.
    if (look.shades) {
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 3; i++) put(c, ex + i, ey + j, j === -1 && i === 0 ? "G" : "g");
      put(c, ex + 2, ey - 1, "G");
      for (let i = 2; i <= 5; i++) put(c, ex - i, ey - 1 + (i > 3 ? 0 : 0), "g");
    }
    // A toothpick out of the corner of the mouth, its tilt.
    if (look.toothpick) {
      const tilt = p.pick ?? 0;
      for (let i = 0; i < 5; i++) put(c, mx + 4 + i, my - i * (0.2 + tilt * 0.5), "p");
    }
    // Hats.
    if (look.hat === "hard") {
      // A yellow hard hat, its two holes for the ossicones (they stick up through it), a brim all round, tipped down when dozing.
      if (p.tipped) {
        // Tipped down over his eyes: the dome forward and low, the brim slanting down over the eye.
        ellipseFill(c, sx + 1.5, sy - 2.6, 6.8, 4.4, (x, y, nx, ny) => {
          if (y > sy - 1.5) return null;
          const l = litOf(nx, ny);
          return l > 0.5 ? "L" : l > -0.2 ? "y" : "Y";
        });
        for (let i = -7; i <= 10; i++) put(c, sx + 1.5 + i, sy - 1 + Math.max(0, Math.round((i - 1) / 4)), i < -4 ? "y" : "Y");
      } else {
        ellipseFill(c, sx + 0.5, sy - 4, 6.6, 4.4, (x, y, nx, ny) => {
          if (y > sy - 3) return null;
          const l = litOf(nx, ny);
          return l > 0.5 ? "L" : l > -0.2 ? "y" : "Y";
        });
        for (let i = -8; i <= 8; i++) put(c, sx + 0.5 + i, sy - 3, i < -5 ? "y" : "Y");
        put(c, sx + 0.5, sy - 7, "Y"); // the ridge
        for (const ox of [-2.5, 1.5]) for (let j = 6; j < 10; j++) put(c, sx + ox + 0.5 + (j - 5) * 0.15, sy - j, j > 7 ? "B" : "d");
      }
    } else if (look.hat === "cap") {
      ellipseFill(c, sx, sy - 3.5, 5.8, 3.6, (x, y, nx, ny) => (y > sy - 3 ? null : litOf(nx, ny) > 0.3 ? "n" : "N"));
      for (let i = 3; i <= 10; i++) put(c, sx + i, sy - 3 + (i > 8 ? 1 : 0), "N");
      put(c, sx, sy - 7, "N");
    } else if (look.hat === "beanie") {
      ellipseFill(c, sx, sy - 3, 6.2, 4.6, (x, y, nx, ny) => (y > sy - 2 ? null : y >= sy - 4 ? "R" : (x + y) % 2 ? "r" : litOf(nx, ny) > 0.2 ? "r" : "R"));
      for (const ox of [-2.5, 1.5]) for (let j = 7; j < 10; j++) put(c, sx + ox + 0.5, sy - j, j > 7 ? "B" : "d");
    } else if (look.hat === "flat") {
      ellipseFill(c, sx + 0.5, sy - 3.4, 6.2, 3, (x, y, nx, ny) => (y > sy - 3 ? null : litOf(nx, ny) > 0.2 ? "i" : "I"));
      for (let i = 2; i <= 8; i++) put(c, sx + i, sy - 3, "I");
    }
  });
  return h ? { name: h.name, at: [h.at[0] + at[0] - 20, h.at[1] + at[1] - 20] } : null;
}

function tailPart(look: Look, p: Pose, dy: number): { name: string; at: Pt } | null {
  const sw = Math.round((p.tail ?? 0) * 2);
  const sitting = p.sit !== undefined;
  return part(`${look.id}:tail:${sw},${dy},${sitting ? 1 : 0}`, (c) => {
    const a: Pt = [22, 72 + dy];
    const b: Pt = sitting ? [16 + sw, 76 + dy] : [17 + sw, 86 + dy];
    limb(c, [a, b], 0.9, 0.7, "dddc");
    ellipseFill(c, b[0], b[1] + 2, 1.5, 2.6, () => "b");
  });
}

// ---- A whole figure: its layers (back to front), the near hoof's place (for a prop), and the head's.

export interface Built {
  layers: Layer[];
  /** The near hoof, the far hoof and the mouth's corner, in frame px. */
  hoofN: Pt;
  hoofF: Pt;
  mouth: Pt;
}
export function build(look: Look, p: Pose): Built {
  const bob = p.bob ?? 0;
  const lean = p.lean ?? 0;
  const sitDrop = p.sit !== undefined ? (GROUND - p.sit - 3) - HIP_Y : 0;
  const dy = bob + sitDrop;
  const layers: Layer[] = [];
  const add = (b: { name: string; at: Pt } | null) => b && layers.push({ part: b.name, x: b.at[0], y: b.at[1] });
  const shadow = part(`shadow:${p.sit !== undefined ? "sit" : "stand"}`, (c) => {
    for (let x = 18; x <= 44; x++) {
      const u = Math.abs(x + 0.5 - 31) / 13;
      if (u < 1) put(c, x, GROUND - 1, u < 0.6 ? "-" : "+");
      if (u < 0.7) put(c, x, GROUND, "+");
    }
  }, false);
  add(shadow);
  add(tailPart(look, p, sitDrop));
  // The far arm, behind.
  const L = (q: Pt): Pt => [q[0] + leanAt(lean, q[1]), q[1] + dy];
  const shF = L(SHOULDER_F);
  const shN = L(SHOULDER_N);
  const aF = p.armF ?? ARMS.hang;
  const aN = p.armN ?? ARMS.hangN;
  const elF: Pt = [shF[0] + aF[0][0], shF[1] + aF[0][1]];
  const hfF: Pt = [shF[0] + aF[1][0], shF[1] + aF[1][1]];
  const elN: Pt = [shN[0] + aN[0][0], shN[1] + aN[0][1]];
  const hfN: Pt = [shN[0] + aN[1][0], shN[1] + aN[1][1]];
  add(armPart(look, shF, elF, hfF, false));
  // The legs.
  const feet = p.feet ?? [[-4, 0], [4, 0]];
  const legs = ([HIP_F, HIP_N] as const).map((hip, i) => {
    const f = feet[i]!;
    if (p.sit !== undefined) {
      const hy = GROUND - p.sit - 3;
      const hp: Pt = [hip[0] - 2, hy];
      const knee: Pt = [hip[0] + 8 + i, hy - 1];
      const ankle: Pt = [hip[0] + 9 + i + f[0] * 0.2, GROUND - 4 - f[1]];
      return legPart(look, hp, knee, ankle, `sit:${p.sit},${i},${f[0]},${f[1]}`);
    }
    const hp: Pt = [hip[0] + leanAt(lean, hip[1]) * 0.5, hip[1] + bob * 0.5];
    const ankle: Pt = [FOOT[0] + f[0] + (lean > 0 ? lean * 0.35 : 0), GROUND - 4 - f[1]];
    const knee: Pt = [(hp[0] + ankle[0]) / 2 + 1.5, (hp[1] + ankle[1]) / 2 - 0.5];
    return legPart(look, hp, knee, ankle, `${hp.map((v) => Math.round(v * 2)).join(",")};${ankle.map((v) => Math.round(v)).join(",")}`);
  });
  add(legs[0]!);
  add(legs[1]!);
  add(bodyPart(look, p));
  const top: Pt = [NECK_TOP[0] + (p.hx ?? 0) * 0.6 + leanAt(lean, NECK_TOP[1]), NECK_TOP[1] + dy + (p.hy ?? 0) * 0.6];
  const skull: Pt = [Math.round(SKULL[0] + (top[0] - NECK_TOP[0]) + (p.hx ?? 0) * 0.4), Math.round(SKULL[1] + (top[1] - NECK_TOP[1]) + (p.hy ?? 0) * 0.4)];
  add(headPart(look, p, skull));
  add(armPart(look, shN, elN, hfN, true));
  return { layers, hoofN: hfN, hoofF: hfF, mouth: [skull[0] + 12, skull[1] + 4] };
}

// ---- Props drawn as specks (no outline): a sparkler, its sparks, smoke, a clipboard, Z's.

/** A lit sparkler from (x, y) along (dx, dy), `len` px: the grey wire, its burning tip fizzing with a new spray per seed. */
export function sparkler(from: Pt, dir: Pt, len: number, seed: number, fizz = 1): Speck[] {
  const out: Speck[] = [];
  const n = Math.hypot(dir[0], dir[1]) || 1;
  const ux = dir[0] / n;
  const uy = dir[1] / n;
  for (let i = 0; i <= len; i++) out.push([Math.round(from[0] + ux * i), Math.round(from[1] + uy * i), i > len - 4 ? (i % 2 ? "4" : "3") : i % 3 === 2 ? "W" : "w"]);
  const tx = from[0] + ux * len;
  const ty = from[1] + uy * len;
  out.push([Math.round(tx), Math.round(ty), "1"]);
  const count = Math.round(7 * fizz);
  for (let s = 0; s < count; s++) {
    const a = hash(s, seed, 91) * Math.PI * 2;
    const r = 1.2 + hash(s, seed, 92) * 4.2 * fizz;
    out.push([Math.round(tx + Math.cos(a) * r), Math.round(ty + Math.sin(a) * r - 0.5), r < 2.2 ? "2" : r < 3.6 ? "3" : "4"]);
  }
  return out;
}
/** A puff of smoke `t` frames on from (x, y): rising, drifting right, thinning. */
export function smoke([x, y]: Pt, t: number): Speck[] {
  if (t < 0 || t > 4) return [];
  const cx = x + t * 1.4;
  const cy = y - t * 2.2;
  const r = 1.6 + t * 0.8;
  const out: Speck[] = [];
  for (let j = -Math.ceil(r); j <= Math.ceil(r); j++)
    for (let i = -Math.ceil(r); i <= Math.ceil(r); i++) {
      if (i * i + j * j > r * r + 0.5) continue;
      if (t > 2 && hash(i, j, t) < 0.4) continue;
      out.push([Math.round(cx + i), Math.round(cy + j), i + j < 0 ? "5" : "6"]);
    }
  return out;
}
/** Z's drifting up from (x, y), `t` frames on (a 3 x 3 z, then a bigger 4 x 4). */
export function zzz([x, y]: Pt, t: number): Speck[] {
  const z = (cx: number, cy: number, s: number): Speck[] => {
    const out: Speck[] = [];
    for (let i = 0; i < s; i++) out.push([cx + i, cy, "N"], [cx + i, cy + s - 1, "N"], [cx + s - 1 - i, cy + i, "N"]);
    return out;
  };
  const p = t % 8;
  return [...z(x + Math.floor(p / 2), y - p, 4), ...(p > 3 ? z(x + 5 + Math.floor(p / 3), y - 6 - p, 5) : [])];
}
/** A clipboard held up in front of him: its board, the clip, the paper with lines and a tick, top-left at (x, y). */
export function clipboard([x, y]: Pt, ticks: number): Speck[] {
  const out: Speck[] = [];
  for (let j = 0; j < 12; j++)
    for (let i = 0; i < 9; i++) {
      const edge = i === 0 || i === 8 || j === 11;
      let k = edge ? "7" : j < 2 ? "8" : "9";
      if (!edge && j >= 3 && j % 2 === 1 && i >= 2 && i <= 6) k = "0";
      out.push([x + i, y + j, k]);
    }
  for (let n = 0; n < ticks; n++) out.push([x + 2, y + 3 + n * 2, "R"]);
  return out;
}

/** A frame from a pose, with specks (props) on top, shared parts. */
export function frame(look: Look, ms: number, p: Pose, extra: { specks?: Speck[]; cue?: string } = {}): Frame {
  const b = build(look, p);
  return { ms, layers: b.layers, ...(extra.specks ? { specks: extra.specks.filter(([x, y]) => x >= 0 && y >= 0 && x < W && y < H) } : {}), ...(extra.cue ? { cue: extra.cue } : {}) };
}

/** A walk cycle (6 frames, the feet passing, a bob): far and near feet and the bob per frame. */
export const WALK: readonly { feet: readonly [Pt, Pt]; bob: number }[] = [
  { feet: [[-5, 0], [5, 0]], bob: 1 },
  { feet: [[-3, 0], [2, 3]], bob: 0 },
  { feet: [[1, 0], [-1, 2]], bob: 0 },
  { feet: [[5, 0], [-5, 0]], bob: 1 },
  { feet: [[2, 3], [-3, 0]], bob: 0 },
  { feet: [[-1, 2], [1, 0]], bob: 0 },
];
/** The arms swinging with the walk (far, near), per frame. */
export const WALK_ARMS: readonly (readonly [readonly [Pt, Pt], readonly [Pt, Pt]])[] = [
  [[[3, 8], [6, 15]], [[0, 8], [-2, 15]]],
  [[[2, 8], [4, 16]], [[1, 8], [0, 16]]],
  [[[1, 8], [1, 16]], [[2, 8], [3, 16]]],
  [[[0, 8], [-2, 15]], [[3, 8], [6, 15]]],
  [[[1, 8], [0, 16]], [[2, 8], [4, 16]]],
  [[[2, 8], [3, 16]], [[1, 8], [1, 16]]],
];
