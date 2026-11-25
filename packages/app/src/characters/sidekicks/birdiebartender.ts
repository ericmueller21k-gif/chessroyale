/**
 * (Copied from claude/boss-art, scripts/boss-art/out/sidekick-birdie-bartender, Nov 23, as drawn: Birdie's Station's Shopkeeper.)
 *
 * Birdie's bartender (id "sidekick-birdie-bartender", "Bartender"): the friendly grey pigeon who runs the little bar in
 * Birdie's station lobby (and keeps the shop). Third pass: no glass, no towel; he works a short metal scoop with a
 * wooden handle, dipping it into the big vat of birdseed beside him and tipping the seed into a feeder on the counter.
 *
 * A grey pigeon in a red vest over a white apron, a little navy bow tie, a green-violet sheen on his neck, a dark beak
 * with a pale cere, red-orange feet. Three-quarters facing our right, light from the top left. 56 x 60 frame, feet on
 * row 57 (ground row 58). The bar's counter hides him below row 27 (31 px above the ground), so the head, the sheen,
 * the bow tie, the top of the vest and the scoop all live above that line.
 *
 * Rig: the body (with vest, apron, neck sheen), tail, feet and bow tie are painted once; the head is painted per mood
 * and tilt (the whole head turned a few degrees about the neck); the near wing is a stroke from shoulder to elbow to
 * hand; the scoop is painted per angle and fill, its grip in the wing's hand. A pose is a handful of numbers.
 */
import { canvas, toGrid, type Canvas } from "../paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "../sprite.ts";

const PALETTE = {
  k: "#0e1014", // outline
  A: "#4b5260", // pigeon greys, dark to light
  B: "#6b7384",
  C: "#8c95a5",
  D: "#afb7c4",
  E: "#d2d8e1",
  g: "#2f7a5e", // the neck sheen: greens and violets
  G: "#4fae84",
  v: "#5e4488",
  V: "#8a68b8",
  r: "#7e1b20", // the vest, dark to light
  R: "#b8322c",
  Q: "#dc5142",
  y: "#e9c24a", // vest buttons
  a: "#bdb6a6", // the apron and shirt, shade to light
  b: "#e2dccd",
  c: "#f8f4ea",
  x: "#23262d", // the beak, dark and its lit top; the eye
  X: "#4c515c",
  O: "#e98a3a", // the orange of the eye
  W: "#ffffff", // glints
  p: "#e48f98", // blush; the inside of the beak
  q: "#9e3d4c",
  f: "#b93a28", // feet
  F: "#e5603f",
  z: "#1f2840", // the bow tie and its sheen
  Z: "#4f64a0",
  m: "#5d6f86", // the scoop's metal (a bluish tin), dark to light
  n: "#a9c2db",
  o: "#eef7ff",
  h: "#7a4e2c", // its wooden handle
  s: "#d6aa5c", // birdseed
  t: "#8f6230",
  S: "#f1d998",
  Y: "#ffd85a", // sparkles
  P: "#e8566a", // a heart
  j: "#9fd8ff", // sweat
} as const;

type Pt = readonly [number, number];
const W = 56;
const H = 60;
const GROUND = 58;
/** Where the scoop's seed lands: the top of the feeder on the counter. */
const LAND: Pt = [51, 30];

const PARTS: Record<string, Part> = {};
interface Painted {
  name: string;
  at: Pt;
}
const MADE = new Map<string, Pt>();
function reg(name: string, make: () => { grid: string[]; at: Pt }): Painted {
  let at = MADE.get(name);
  if (!at) {
    const r = make();
    PARTS[name] = { grid: r.grid };
    MADE.set(name, (at = r.at));
  }
  return { name, at };
}
function crop(cv: Canvas): { grid: string[]; at: Pt } {
  let x0 = cv[0]!.length, y0 = cv.length, x1 = -1, y1 = -1;
  cv.forEach((row, y) =>
    row.forEach((k, x) => {
      if (k === ".") return;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }),
  );
  if (x1 < 0) return { grid: ["."], at: [0, 0] };
  return { grid: cv.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1).join("")), at: [x0, y0] };
}

// ---- Helpers (pixel-center coordinates: an integer is the middle of that pixel).

const ell = (cx: number, cy: number, rx: number, ry: number) => (x: number, y: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const roundL = (cx: number, cy: number, rx: number, ry: number, bias = 0) => (x: number, y: number) => 0.52 + bias - 0.45 * ((x - cx) / rx) - 0.55 * ((y - cy) / ry);
const inPoly = (pts: readonly Pt[]) => (x: number, y: number) => {
  let inside = false;
  pts.forEach(([x0, y0], i) => {
    const [x1, y1] = pts[(i + 1) % pts.length]!;
    if (y0 <= y !== y1 <= y && x < x0 + ((y - y0) / (y1 - y0)) * (x1 - x0)) inside = !inside;
  });
  return inside;
};
const grey = (l: number) => (l < 0.15 ? "A" : l < 0.4 ? "B" : l < 0.68 ? "C" : l < 0.9 ? "D" : "E");
function fill(cv: Canvas, inside: (x: number, y: number) => boolean, color: (x: number, y: number) => string): void {
  for (let y = 0; y < cv.length; y++) for (let x = 0; x < cv[0]!.length; x++) if (inside(x, y)) cv[y]![x] = color(x, y);
}
function stamp(cv: Canvas, rows: readonly string[], x0: number, y0: number): void {
  rows.forEach((row, y) => [...row].forEach((k, i) => k !== "." && cv[y0 + y]?.[x0 + i] !== undefined && (cv[y0 + y]![x0 + i] = k)));
}

// ---- The body: a round grey pigeon, the neck sheen, the red vest with its V and buttons, the white apron.

const BODY = reg("body", () => {
  const cv = canvas(W, H);
  const low = ell(24, 45, 12.5, 11.5);
  const up = ell(26, 34, 10.5, 10.5);
  const neck = ell(25.5, 23, 6.8, 6.2);
  const inside = (x: number, y: number) => low(x, y) || up(x, y) || neck(x, y);
  const L = roundL(23, 38, 14, 18, 0.06);
  fill(cv, inside, (x, y) => grey(L(x, y)));
  // The sheen: green above, violet below, lit toward the back of the neck.
  fill(cv, (x, y) => neck(x, y) && y >= 19 && y <= 26 && x >= 20, (x, y) => (y <= 22 ? (x <= 25 ? "G" : "g") : x <= 24 ? "V" : "v"));
  const vestTop = (x: number) => 25 + Math.max(0, (21 - x) * 0.5);
  const hem = (x: number) => 45 + Math.max(0, 3.5 - Math.abs(x - 31));
  const vee = inPoly([[27.2, 23.5], [36, 23.5], [31.4, 33.5]]);
  const VL = roundL(22, 32, 14, 14, 0.12);
  fill(cv, (x, y) => inside(x, y) && x >= 13 && y >= vestTop(x) && y <= hem(x), (x, y) => {
    if (vee(x, y)) return x >= 33 ? "b" : "c";
    const l = VL(x, y);
    return l > 0.82 ? "Q" : l > 0.08 ? "R" : "r";
  });
  // The vest's front edge below the V, and its buttons.
  for (let y = 34; y <= 47; y++) if (cv[y]![31] !== ".") cv[y]![32] = "r";
  for (const y of [37, 41]) cv[y]![31] = "y";
  // The apron: white below the vest, to the bottom, its back edge where the grey shows.
  fill(cv, (x, y) => inside(x, y) && x >= 15 && y > hem(x), (x, y) => {
    const l = 0.6 - 0.05 * (x - 24) - 0.02 * (y - 50);
    return l > 0.55 ? "c" : l > 0.2 ? "b" : "a";
  });
  for (let x = 15; x < W; x++) if (cv[52]![x] === "c") cv[52]![x] = "b";
  return crop(cv);
});

const TAIL = reg("tail", () => {
  const cv = canvas(W, H);
  const t = inPoly([[16, 42], [3.5, 47.5], [4.5, 52.5], [16, 51]]);
  fill(cv, t, (x, y) => (x <= 6 ? "A" : y <= 47 ? "C" : "B"));
  return crop(cv);
});
PARTS["foot:near"] = { grid: [".FFF..", "FfFFFF"] };
PARTS["foot:far"] = { grid: [".ff.", "ffff"] };
PARTS["bowtie"] = { grid: ["zz.zz", "zZZZz", "zz.zz"] };

// ---- The head: round and grey, a dark beak with a pale cere, a shiny eye with an orange rim; tilted about the neck.

export type Mood = "calm" | "half" | "blink" | "happy" | "cheer" | "think" | "smug" | "rattled" | "hurt" | "out" | "bold";
type Eye = "open" | "half" | "shut" | "arc" | "up" | "wide" | "pinch" | "x";
const EYES: Record<Eye, readonly string[]> = {
  open: [".xx.", "xWxx", "xxxx", ".OO."],
  half: ["....", "kkkk", "xWxx", ".OO."],
  shut: ["....", "....", "kkkk", "...."],
  arc: ["....", ".kk.", "k..k", "...."],
  up: ["xWxx", "xxxx", ".xx.", "...."],
  wide: [".xx.", "xWWx", "xWxx", ".xx."],
  pinch: ["kk..", "..kk", "kk..", "...."],
  x: ["k..k", ".kk.", ".kk.", "k..k"],
};
type Brow = "smug" | "worried" | "bold";
const BROWS: Record<Brow, readonly Pt[]> = {
  smug: [[0, -1], [1, -1], [2, -1], [3, -2]],
  worried: [[0, -1], [1, -2], [2, -2], [3, -3]],
  bold: [[0, -3], [1, -2], [2, -2], [3, -1]],
};
const FACES: Record<Mood, { eye: Eye; brow?: Brow; open?: boolean; blush?: boolean }> = {
  calm: { eye: "open", blush: true },
  half: { eye: "half", blush: true },
  blink: { eye: "shut", blush: true },
  happy: { eye: "arc", open: true, blush: true },
  cheer: { eye: "open", open: true, blush: true },
  think: { eye: "up" },
  smug: { eye: "half", brow: "smug", blush: true },
  rattled: { eye: "wide", brow: "worried", open: true },
  hurt: { eye: "pinch", brow: "worried", open: true },
  out: { eye: "x", open: true },
  bold: { eye: "open", brow: "bold" },
};
const PIV: Pt = [25, 20];
const EYE_AT: Pt = [28, 8];

function headPart(mood: Mood, tilt: number): Painted {
  return reg(`head:${mood}:${tilt}`, () => {
    const cv = canvas(W, H);
    const th = (tilt * 7 * Math.PI) / 180;
    const cs = Math.cos(th);
    const sn = Math.sin(th);
    const back = (x: number, y: number): Pt => {
      const dx = x - PIV[0], dy = y - PIV[1];
      return [PIV[0] + dx * cs + dy * sn, PIV[1] - dx * sn + dy * cs];
    };
    const fwd = (x: number, y: number): Pt => {
      const dx = x - PIV[0], dy = y - PIV[1];
      return [PIV[0] + dx * cs - dy * sn, PIV[1] + dx * sn + dy * cs];
    };
    const face = FACES[mood];
    const skull = ell(25, 12.5, 8.4, 8.1);
    const beak = inPoly(face.open ? [[32.2, 10.8], [39, 12.6], [38, 15.4], [32.4, 16.8]] : [[32.2, 10.8], [39.2, 13.2], [38.6, 14.6], [32.4, 15.8]]);
    const L = roundL(24, 11, 10, 10, 0.1);
    fill(cv, (x, y) => true, (x, y) => {
      const [u, w] = back(x, y);
      if (u >= 32 && u <= 34.4 && w >= 9.9 && w <= 11.6) return "c";
      if (beak(u, w)) return face.open && w > 13.4 && w < 14.9 && u > 33.6 ? "q" : w < 12.4 ? "X" : "x";
      if (skull(u, w)) return grey(L(u, w));
      return ".";
    });
    const [ex, ey] = fwd(EYE_AT[0] + 1.5, EYE_AT[1] + 1.5);
    const e0: Pt = [Math.round(ex - 1.5), Math.round(ey - 1.5)];
    stamp(cv, EYES[face.eye], e0[0], e0[1]);
    if (face.brow) for (const [bx, by] of BROWS[face.brow]) cv[e0[1] + by]![e0[0] + bx] = "k";
    if (face.blush) for (const bx of [-1, 0]) cv[e0[1] + 5]![e0[0] + bx] = "p";
    return crop(cv);
  });
}

// ---- Wings: a stroke from shoulder to elbow to the hand, shaded round, two dark bars, darker primaries.

function nearestSeg(p: Pt, a: Pt, b: Pt) {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy || 1)));
  const nx = p[0] - (a[0] + t * vx), ny = p[1] - (a[1] + t * vy);
  return { d: Math.hypot(nx, ny), nx, ny, t };
}
function wingPart(pts: readonly Pt[], far: boolean): Painted {
  const rs = [3.0, 2.6, 2.0];
  return reg(`wing:${far ? "f" : "n"}:${pts.map((p) => p.join(",")).join(";")}`, () => {
    const cv = canvas(W, H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let best = { s: 0, d: Infinity, nx: 0, ny: 0, rr: 1 };
        for (let i = 0; i + 1 < pts.length; i++) {
          const n = nearestSeg([x, y], pts[i]!, pts[i + 1]!);
          const rr = rs[i]! + (rs[i + 1]! - rs[i]!) * n.t;
          if (n.d - rr < best.d - best.rr) best = { s: (i + n.t) / (pts.length - 1), d: n.d, nx: n.nx, ny: n.ny, rr };
        }
        if (best.d > best.rr) continue;
        const l = 0.62 - 0.45 * (best.nx / best.rr) - 0.5 * (best.ny / best.rr) - (far ? 0.3 : 0);
        const s = best.s;
        cv[y]![x] = (s > 0.42 && s < 0.5) || (s > 0.56 && s < 0.64) ? "A" : s > 0.86 ? (l > 0.55 ? "C" : "B") : grey(l);
      }
    return crop(cv);
  });
}

// ---- The scoop: a metal cup on a short wooden handle, painted at any angle (its grip at the hand), empty or heaped.

function scoopPart(a: number, full: number): Painted & { grip: Pt } {
  const S = 31, c = 15;
  const r = reg(`scoop:${a}:${full}`, () => {
    const cv = canvas(S, S);
    const fx = Math.cos((a * Math.PI) / 180), fy = Math.sin((a * Math.PI) / 180);
    const sg = fx >= -0.01 ? 1 : -1;
    const px = -fy * sg, py = fx * sg;
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const dx = x - c, dy = y - c;
        const u = dx * fx + dy * fy;
        const v = dx * px + dy * py;
        const l = 0.5 - 0.5 * (v / 2.2) * py - 0.25 * (v / 2.2) * px;
        if (u >= 3.5 && u <= 10.4 && Math.abs(v) <= 2.4) {
          const seedy = "stSst"[(x * 7 + y * 3) % 5]!;
          cv[y]![x] =
            u >= 9.5 ? (full > 0 && v < 1.4 ? seedy : Math.abs(v) < 1.5 ? "m" : "o")
            : u <= 4.4 ? "m"
            : v < -1.5 ? "o" : v > 1.2 ? "m" : l > 0.5 ? "n" : "m";
        } else if (u >= -0.6 && u < 3.5 && Math.abs(v) <= 0.6) cv[y]![x] = "h";
        else if (full > 0 && v < -2.4) {
          const c0 = full > 1 ? 7.2 : 8.6, ru = full > 1 ? 3.6 : 2.2, rv = full > 1 ? 2.2 : 1.3;
          if (((u - c0) / ru) ** 2 + ((v + 2.4) / rv) ** 2 <= 1) cv[y]![x] = v < -3.6 ? "S" : "stSst"[(x * 7 + y * 3) % 5]!;
        }
      }
    return crop(cv);
  });
  return { ...r, grip: [c - r.at[0], c - r.at[1]] };
}
/** Where seed leaves a scoop held at `hand` at angle `a`: the lower lip of its open front. */
const mouthOf = (hand: Pt, a: number): Pt => {
  const fx = Math.cos((a * Math.PI) / 180), fy = Math.sin((a * Math.PI) / 180);
  return [Math.round(hand[0] + fx * 10.4 - fy * 1.6), Math.round(hand[1] + fy * 10.4 + fx * 1.6)];
};

// ---- Poses.

type Wing = readonly [Pt, Pt];
const SH: Pt = [19, 32];
const FSH: Pt = [29, 31];
const WG = {
  dip: [[13, 26], [9, 15]],
  dip2: [[13, 27], [9, 16]],
  lift: [[15, 25], [15, 14]],
  swing: [[20, 31], [22, 25]],
  level: [[27, 30], [32, 23]],
  out: [[31, 28], [39, 19]],
  tip: [[32, 28], [40, 18]],
  back: [[27, 30], [33, 22]],
  hold: [[25, 30], [31, 24]],
  ret: [[19, 28], [21, 21]],
  rest: [[29, 30], [38, 25]],
  raise: [[17, 26], [13, 16]],
  waveA: [[16, 24], [9, 13]],
  waveB: [[18, 23], [15, 10]],
  low: [[21, 29], [26, 23]],
  chin: [[25, 27], [30, 21]],
  jab: [[29, 26], [38, 19]],
  clutch: [[24, 29], [28, 23]],
  high: [[16, 27], [12, 15]],
  droop: [[22, 28], [27, 22]],
} satisfies Record<string, Wing>;
type WingName = keyof typeof WG;

export interface Pose {
  mood?: Mood;
  /** Head tilt in 7-degree steps (beak down); his usual is 1. */
  tilt?: number;
  hx?: number;
  hy?: number;
  /** The upper body (head, wing) down this many pixels. */
  bob?: number;
  /** The whole bird sideways (a shudder). */
  dx?: number;
  wing?: WingName;
  /** The scoop in his hand: its angle (0 = pointing right, down is positive) and how full (0, 1, 2). */
  scoop?: readonly [number, number];
  /** The scoop set down on the counter instead: its grip and angle. */
  down?: readonly [Pt, number];
  /** The far wing raised (behind him), its elbow and hand. */
  far?: Wing;
}

function build(p: Pose): { layers: Layer[]; mouth?: Pt } {
  const dx = p.dx ?? 0;
  const bob = p.bob ?? 0;
  const layers: Layer[] = [];
  const put = (name: string, x: number, y: number) => layers.push({ part: name, x, y });
  const add = (l: Painted, ox = 0, oy = 0) => put(l.name, l.at[0] + ox, l.at[1] + oy);
  const up = (q: Pt): Pt => [q[0] + dx, q[1] + bob];
  if (p.far) add(wingPart([up(FSH), up(p.far[0]), up(p.far[1])], true));
  add(TAIL, dx);
  put("foot:far", 16 + dx, 55);
  add(BODY, dx);
  put("foot:near", 24 + dx, 55);
  put("bowtie", 28 + dx, 23 + Math.min(bob, 1));
  add(headPart(p.mood ?? "calm", p.tilt ?? 1), (p.hx ?? 0) + dx, (p.hy ?? 0) + bob);
  const [elbow, hand] = WG[p.wing ?? "hold"];
  const hd = up(hand);
  let mouth: Pt | undefined;
  if (p.down) {
    const s = scoopPart(p.down[1], 0);
    put(s.name, p.down[0][0] - s.grip[0], p.down[0][1] - s.grip[1]);
  } else {
    const [a, full] = p.scoop ?? [0, 0];
    const s = scoopPart(a, full);
    put(s.name, hd[0] - s.grip[0], hd[1] - s.grip[1]);
    mouth = mouthOf(hd, a);
  }
  add(wingPart([up(SH), up(elbow), hd], false));
  return { layers, mouth };
}

// ---- Effects.

/** Seed falling from the scoop's mouth onto the feeder at LAND: one seed per entry, `t` 0 (at the lip) to 1 (landed). */
const seeds = (m: Pt, ts: readonly number[]): Speck[] =>
  ts.flatMap((t, i): Speck[] => {
    // Out over the lip first, then down onto the feeder: x eases out, y falls.
    const x = Math.round(m[0] + (LAND[0] - m[0]) * Math.sqrt(t));
    const y = Math.round(m[1] + (LAND[1] - m[1]) * t * t);
    const k = "sSs"[i % 3]!;
    return i % 2 ? [[x, y, k]] : [[x, y, k], [x, y + 1, "t"]];
  });
const star = (x: number, y: number, k = "Y"): Speck[] => [[x, y, "W"], [x - 1, y, k], [x + 1, y, k], [x, y - 1, k], [x, y + 1, k]];
const heart = (x: number, y: number): Speck[] => [
  [x + 1, y, "P"], [x + 3, y, "P"],
  [x, y + 1, "P"], [x + 1, y + 1, "p"], [x + 2, y + 1, "P"], [x + 3, y + 1, "P"], [x + 4, y + 1, "P"],
  [x + 1, y + 2, "P"], [x + 2, y + 2, "P"], [x + 3, y + 2, "P"],
  [x + 2, y + 3, "P"],
];
const feathers = (t: number): Speck[] =>
  ([[-1.2, -1], [1.3, -1.3], [-1.6, 0.2], [1.5, 0.1]] as const).flatMap(([vx, vy], i): Speck[] => {
    const x = Math.round(25 + vx * (3 + t * 3));
    const y = Math.round(20 + vy * (3 + t * 3) + 0.4 * t * t);
    return [[x, y, i % 2 ? "D" : "E"], [x + 1, y, "C"]];
  });
const sweat = (i: number): Speck[] => {
  const t = i % 4;
  return [[15 - t, 9 + t, "j"], [15 - t, 10 + t, "W"], [41 + t, 6 + t, "j"], [41 + t, 7 + t, "W"]];
};
const dizzy = (t: number): Speck[] =>
  [0, 1, 2].flatMap((i) => {
    const a = (t * 0.9 + i * 2.1) % (Math.PI * 2);
    return star(Math.round(25 + Math.cos(a) * 9), Math.round(5 + Math.sin(a) * 2));
  });
const thoughts = (n: number): Speck[] => {
  const out: Speck[] = [];
  if (n >= 1) out.push([41, 9, "c"], [42, 9, "b"]);
  if (n >= 2) out.push([44, 5, "c"], [45, 5, "c"], [44, 6, "b"], [45, 6, "b"]);
  if (n >= 3) {
    [".ccc.", "ccccc", ".bbb."].forEach((row, j) => [...row].forEach((k, i) => k !== "." && out.push([47 + i, 1 + j, k])));
    out.push([49, 2, "s"]);
  }
  return out;
};
const confetti = (i: number): Speck[] =>
  [0, 1, 2, 3, 4].map((j): Speck => [4 + ((j * 11 + i * 5) % 46), 2 + ((j * 7 + i * 3) % 18), "sSYts"[j]!]);

const FLASH: Record<string, string> = { A: "#8a90a0", B: "#a8afbe", C: "#c8cfda", D: "#e3e8ef", E: "#ffffff", r: "#c0605a", R: "#e98a7f", Q: "#f6aea4" };

function f(ms: number, p: Pose, extra: Partial<Frame> & { pour?: readonly number[] } = {}): Frame {
  const b = build(p);
  const { pour, ...rest } = extra;
  const all = [...(pour && b.mouth ? seeds(b.mouth, pour) : []), ...(rest.specks ?? [])];
  return { ms, layers: b.layers, ...rest, specks: all.filter(([x, y]) => x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2) };
}

// ---- Animations.

/**
 * Idle (5.3 s): dips the scoop into the vat behind him, lifts it heaped, swings it round to the front, holds it out
 * over the feeder and tips it: seed falls in a short arc onto the feeder. Then he watches it, nods, blinks slowly,
 * and reaches back for more.
 */
const POUR_M = mouthOf(WG.tip[1], 42);
const idle: Anim = {
  loop: true,
  frames: [
    f(300, { wing: "dip", scoop: [95, 0], tilt: 2, hx: -1 }),
    f(300, { wing: "dip2", scoop: [100, 2], tilt: 2, hx: -1, bob: 1 }, { specks: [[4, 21, "S"], [3, 23, "s"], [13, 22, "s"]] }),
    f(260, { wing: "lift", scoop: [205, 2], tilt: 1, hx: -1 }),
    f(200, { wing: "swing", scoop: [-20, 2], tilt: 1 }),
    f(200, { wing: "level", scoop: [-5, 2], tilt: 1 }),
    f(260, { wing: "out", scoop: [-5, 2], tilt: 0 }),
    f(220, { wing: "tip", scoop: [25, 2], tilt: -1 }, { cue: "pour", pour: [0, 0.1, 0.25] }),
    f(220, { wing: "tip", scoop: [35, 1], tilt: -1 }, { pour: [0, 0.08, 0.18, 0.3, 0.44, 0.6, 0.78, 0.95] }),
    f(220, { wing: "tip", scoop: [42, 0], tilt: -1 }, { pour: [0.15, 0.3, 0.48, 0.66, 0.84, 1] }),
    f(260, { wing: "back", scoop: [5, 0], tilt: 1 }),
    f(450, { wing: "hold", tilt: 2 }),
    f(250, { wing: "hold", tilt: 2, hy: 1 }),
    f(250, { wing: "hold", tilt: 2 }),
    f(500, { wing: "hold", tilt: 1 }),
    f(150, { wing: "hold", tilt: 1, mood: "half" }),
    f(250, { wing: "hold", tilt: 1, mood: "blink" }),
    f(150, { wing: "hold", tilt: 1, mood: "half" }),
    f(600, { wing: "hold", tilt: 1 }),
    f(260, { wing: "ret", scoop: [160, 0], tilt: 1 }),
  ],
};

/** Wave (once, 1.2 s): sets the scoop down on the counter, waves hello with his wing, picks the scoop back up. */
const DOWN: readonly [Pt, number] = [[38, 25], 0];
const wave: Anim = {
  loop: false,
  frames: [
    f(120, { wing: "rest", scoop: [0, 0], tilt: 2 }),
    f(110, { wing: "raise", down: DOWN, mood: "cheer", tilt: 0 }, { cue: "coo" }),
    f(110, { wing: "waveA", down: DOWN, mood: "happy", tilt: 0, hy: -1 }),
    f(110, { wing: "waveB", down: DOWN, mood: "happy", tilt: 1 }, { specks: heart(39, 3) }),
    f(110, { wing: "waveA", down: DOWN, mood: "happy", tilt: 0, hy: -1 }, { specks: heart(40, 1) }),
    f(110, { wing: "waveB", down: DOWN, mood: "cheer", tilt: 1 }),
    f(110, { wing: "waveA", down: DOWN, mood: "happy", tilt: 0, hy: -1 }),
    f(110, { wing: "low", down: DOWN, mood: "calm", tilt: 1 }),
    f(110, { wing: "rest", scoop: [0, 0], tilt: 1 }),
    f(120, { wing: "hold", tilt: 1 }),
  ],
};

/** Entrance: comes up from a bartender's bow, scoop raised in greeting, a sparkle. */
const entrance: Anim = {
  loop: false,
  frames: [
    f(140, { wing: "hold", bob: 2, hy: 3, tilt: 4, mood: "blink" }),
    f(120, { wing: "hold", bob: 1, hy: 1, tilt: 3, mood: "blink" }),
    f(120, { wing: "hold", tilt: 1, mood: "calm" }),
    f(140, { wing: "high", scoop: [-70, 2], tilt: 0, mood: "cheer", hy: -1 }, { cue: "coo", specks: star(36, 6) }),
    f(160, { wing: "high", scoop: [-70, 2], tilt: 0, mood: "happy" }, { specks: star(38, 4, "S") }),
    f(140, { wing: "level", scoop: [-5, 2], tilt: 1, mood: "happy" }),
    f(300, { wing: "hold", tilt: 1 }),
  ],
};

/** Thinking (loops): head up, eye rolled up, the scoop's handle tapping under his beak, thought puffs rising. */
const thinking: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) =>
    f(160, { wing: "chin", scoop: [15, 0], bob: i % 4 === 1 ? 1 : 0, tilt: -1, hx: i >= 6 ? 1 : 0, mood: i === 9 ? "blink" : "think" }, { specks: thoughts(i % 6 < 1 ? 0 : i % 6 < 3 ? 1 : i % 6 < 5 ? 2 : 3) }),
  ),
};

/** His move: a scoop of seed held out and a quick pinch poured, as if serving the move. */
const move: Anim = {
  loop: false,
  frames: [
    f(90, { wing: "level", scoop: [-5, 2], tilt: 1, mood: "bold" }),
    f(100, { wing: "out", scoop: [0, 2], tilt: 2, hx: 1, mood: "bold" }, { cue: "pour" }),
    f(110, { wing: "tip", scoop: [35, 1], tilt: 2, hx: 1 }, { pour: [0.1, 0.4, 0.8] }),
    f(110, { wing: "back", scoop: [5, 0], tilt: 2, hx: 1, mood: "happy" }),
    f(150, { wing: "hold", tilt: 1 }),
  ],
};

/** A capture: scoop thrown up high in triumph, both wings up, seed sparkles. */
const capture: Anim = {
  loop: false,
  frames: [
    f(80, { wing: "hold", bob: 2, mood: "bold", tilt: 2 }),
    f(90, { wing: "high", scoop: [-70, 2], far: [[35, 25], [41, 19]], mood: "cheer", tilt: 0, hy: -1 }, { cue: "coo", specks: star(38, 4) }),
    f(90, { wing: "high", scoop: [-80, 2], far: [[35, 24], [42, 17]], mood: "happy", tilt: -1, hy: -1 }, { specks: [...star(12, 6), ...confetti(1)] }),
    f(90, { wing: "high", scoop: [-70, 2], far: [[35, 25], [41, 19]], mood: "happy", tilt: 0 }, { specks: [...star(44, 10), ...confetti(2)] }),
    f(90, { wing: "high", scoop: [-80, 2], far: [[35, 24], [42, 17]], mood: "happy", tilt: -1, hy: -1 }, { specks: confetti(3) }),
    f(120, { wing: "level", scoop: [-5, 2], mood: "smug", tilt: 1 }),
    f(160, { wing: "hold", mood: "calm", tilt: 1 }),
  ],
};

/** Hurt: a flash, a shudder, a puff of feathers, eyes squeezed; then he shakes it off. */
const hurt: Anim = {
  loop: false,
  frames: [
    f(70, { wing: "droop", scoop: [15, 0], mood: "hurt", tilt: -1, hx: -2, bob: 1 }, { cue: "poof", pal: FLASH, shake: [1, 0], specks: feathers(0) }),
    f(80, { wing: "droop", scoop: [15, 0], mood: "hurt", tilt: -1, hx: -2, bob: 2 }, { shake: [-1, 0], specks: feathers(1) }),
    f(100, { wing: "low", scoop: [20, 0], mood: "hurt", tilt: 0, hx: -1, bob: 1 }, { specks: feathers(2) }),
    f(110, { wing: "low", scoop: [10, 0], mood: "rattled", tilt: 1 }),
    f(120, { wing: "hold", mood: "blink", tilt: 1 }),
    f(160, { wing: "hold", mood: "calm", tilt: 1 }),
  ],
};

/** Check: two sharp jabs of the scoop at the board, a determined eye. */
const check: Anim = {
  loop: false,
  frames: [
    f(100, { wing: "level", scoop: [-5, 0], mood: "bold", tilt: 1 }),
    f(110, { wing: "jab", scoop: [-5, 0], mood: "bold", tilt: 2, hx: 1 }, { cue: "coo", specks: star(51, 18) }),
    f(90, { wing: "level", scoop: [-5, 0], mood: "bold", tilt: 1 }),
    f(110, { wing: "jab", scoop: [-5, 0], mood: "bold", tilt: 2, hx: 1 }, { specks: star(51, 17) }),
    f(150, { wing: "jab", scoop: [-5, 0], mood: "smug", tilt: 1, hx: 1 }),
    f(160, { wing: "hold", mood: "smug", tilt: 1 }),
  ],
};

/** Smug (loops): chin up, eyelids low, the scoop propped at his shoulder, a slow pleased nod. */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(170, { wing: i >= 3 && i <= 5 ? "back" : "hold", scoop: [-10, 0], mood: "smug", tilt: i >= 3 && i <= 5 ? 0 : -1, hy: i === 4 ? 1 : 0 })),
};

/** Rattled (loops): wide eyes, worried brows, beak open, the scoop clutched to his chest, trembling, sweat flying. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(80, { wing: "clutch", scoop: [-25, 0], mood: "rattled", tilt: 0, dx: i % 2 ? 1 : -1, bob: i % 4 === 2 ? 1 : 0 }, { specks: sweat(i) })),
};

/** Defeat: a flash, dizzy eyes, the scoop drops onto the counter, he slumps with his head hung, stars circling. */
const SLUMP: Pose = { wing: "droop", down: [[41, 27], 0], mood: "out", tilt: 4, bob: 3, hy: 2 };
const defeat: Anim = {
  loop: false,
  frames: [
    f(80, { wing: "droop", scoop: [15, 0], mood: "hurt", tilt: -1, hx: -1 }, { cue: "poof", pal: FLASH, shake: [1, 0], specks: feathers(0) }),
    f(100, { wing: "droop", scoop: [30, 0], mood: "out", tilt: 1, bob: 1 }, { specks: [...feathers(1), ...dizzy(0)] }),
    f(120, { ...SLUMP, bob: 2, hy: 1, tilt: 3 }, { cue: "thud", specks: dizzy(1.5) }),
    f(140, SLUMP, { specks: dizzy(3) }),
    f(160, SLUMP, { specks: dizzy(4.5) }),
    f(1000, SLUMP, { specks: dizzy(6) }),
  ],
};

/** Victory (loops): bouncing with both wings up, the scoop held high, seed confetti and sparkles. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const upb = i % 4 < 2;
    return f(110, { wing: "high", scoop: [upb ? -80 : -65, 2], far: upb ? [[35, 24], [42, 17]] : [[35, 25], [41, 20]], mood: i % 6 === 5 ? "cheer" : "happy", tilt: upb ? -1 : 0, hy: upb ? -1 : 0, bob: upb ? 0 : 1 }, {
      cue: i === 0 ? "coo" : undefined,
      specks: [...confetti(i), ...(i % 3 === 0 ? star(8 + (i % 4) * 2, 8) : []), ...(i % 4 === 1 ? heart(44, 4) : [])],
    });
  }),
};

export const SIDEKICK_BIRDIE_BARTENDER: Character = {
  id: "sidekick-birdie-bartender",
  name: "Bartender",
  w: W,
  h: H,
  foot: [25, GROUND],
  palette: PALETTE,
  halo: "#2a2e38",
  parts: PARTS,
  // (In the game, Nov 23: the town's bake wants a walk and a sit (scripts/bake-sidekicks.ts); he never walks or sits (he keeps the bar,
  // not a town bot), so both are his idle's first frame, held.)
  anims: { idle, walk: { loop: true, frames: [idle.frames[0]!] }, sit: { loop: true, frames: [idle.frames[0]!] }, wave, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory },
};
