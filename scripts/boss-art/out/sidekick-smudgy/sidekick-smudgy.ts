/**
 * Smudgy's sidekick (id "sidekick-smudgy"): a baby chameleon, a town bot that wanders the square and plays chess at the
 * park's tables. No powers, never fights: a friendly, curious kid who copies the big one, so it carries ONE small
 * paintbrush with a dab of yellow paint on its tip (and a smear of the same paint on its cheek).
 *
 * Smaller and rounder than Smudgy: a big round head with two big turret eyes and a little striped casque, a round green
 * body with a pale belly, a few of his orange and teal stripes on its back, arms and tail, stubby legs with gripping
 * feet, a spiral tail. No beret, no apron, no palette. Three-quarters, facing our right, light from the top left.
 *
 * Rigging, as Smudgy's: the head (one per mouth), the eyes (one per look), the casque, the body and the feet are painted
 * once; the tail, the legs, the arms and the brush are painted from points per pose, so a new pose is a few numbers.
 */
import { canvas, inEllipse, inPoly, roundLight, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "../../../../packages/app/src/characters/sprite.ts";

export const SIDEKICK_PALETTE = {
  k: "#14210f", // outline
  a: "#2c5e18", // skin: lime green, dark to light
  b: "#4b9023",
  c: "#74c02c",
  d: "#9fdc43",
  e: "#c9f27a",
  l: "#9bb838", // belly and jaw: yellow-green, dark to light
  m: "#c5da55",
  n: "#e6ee86",
  p: "#a93a17", // stripes: orange, dark to light
  q: "#dc5a1e",
  r: "#f5832d",
  s: "#ffb162",
  t: "#0e5c60", // teal, dark to light
  u: "#1a8985",
  v: "#34b4a8",
  x: "#74dccb",
  h: "#fbf6e4", // eye whites, and their shade under the lid
  S: "#d9d0b0",
  E: "#9b4f0d", // irises: amber, dark to light
  F: "#dd8512",
  G: "#ffc437",
  X: "#0a0c07", // pupils
  w: "#ffffff", // glints
  L: "#35200f", // the brush's handle (and the stool's shade), dark to light
  M: "#5a3516",
  N: "#85501f",
  Q: "#ad7634",
  f: "#5f6b7a", // the ferrule: silver, dark to light
  g: "#9aa6b5",
  i: "#cfd8e2",
  j: "#f4f7fb",
  U: "#8a5e30", // the bristles: dark to light
  V: "#c79a5a",
  W: "#ecd29b",
  P: "#b97c06", // the paint: yellow, dark, mid, light
  R: "#f7c60f",
  K: "#fff48c",
  B: "#76451e", // stool wood: dark, mid, light
  C: "#a96f3b",
  D: "#cf9858",
  Y: "#f2c14e", // gold sparkles
  y: "#ffe58a",
  O: "#b4840f",
  "1": "#d9342c", // mouth red
  "2": "#ff7a66", // tongue
  z: "#0d0e12", // ground shadow
  "~": "#9fd8ff", // sweat
  "9": "#4d4538", // dust, dark and light
  "0": "#7d705a",
} as const;

type Pt = readonly [number, number];
type Inside = (x: number, y: number) => boolean;
type KeyFn = (x: number, y: number) => string;

/** The frame, and the ground (the first row below the feet). */
const W = 64;
const H = 64;
const GROUND = 61;
const TAU = Math.PI * 2;

const ramp = (r: string, l: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(l * r.length)))]!;
/** Banded light for a round surface: dark to light by fixed thresholds (so the bands stay few and clean). */
const tone = (r: string, l: number) => r[l < 0.34 ? 0 : l < 0.6 ? 1 : l < 0.84 ? 2 : Math.min(3, r.length - 1)]!;
/** Light on an orb: 1 at a highlight point (`hx`, `hy`), falling off with distance (`R`): the bands are crescents. */
const orb = (hx: number, hy: number, R: number) => (x: number, y: number) => 1.02 - Math.hypot(x + 0.5 - hx, y + 0.5 - hy) / R;
const GREEN = "bcde";
const THROAT = "lmn";
const ORANGE = "pqrs";
const TEAL = "tuvx";
const HUES: Record<string, string> = { g: GREEN, o: ORANGE, t: TEAL };

// ---- Painting.

interface Painted {
  part: Part;
  at: Pt;
}

/** Paints on a frame-sized canvas, then crops to what was painted (the part's `at` is where it lands). */
function paintFrame(draw: (cv: Canvas) => void): Painted {
  const cv = canvas(W, H);
  draw(cv);
  let x0 = W;
  let y0 = H;
  let x1 = -1;
  let y1 = -1;
  cv.forEach((row, y) =>
    row.forEach((k, x) => {
      if (k === ".") return;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }),
  );
  if (x1 < 0) return { part: { grid: ["."] }, at: [0, 0] };
  return { part: { grid: cv.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1).join("")) }, at: [x0, y0] };
}

const fill = (cv: Canvas, inside: Inside, key: KeyFn): void => {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inside(x, y)) cv[y]![x] = key(x, y);
};

function stamp(cv: Canvas, rows: readonly string[], x0: number, y0: number): void {
  rows.forEach((row, j) =>
    [...row].forEach((k, i) => {
      if (k === "." || cv[y0 + j]?.[x0 + i] === undefined) return;
      cv[y0 + j]![x0 + i] = k;
    }),
  );
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

/** For a pixel near a stroke: how far along it is (0 to 1), its distance across and the normal, the radius there. */
function along(pts: readonly Pt[], r: readonly number[], p: Pt): { s: number; d: number; nx: number; ny: number; rr: number } {
  let best = { s: 0, d: Infinity, nx: 0, ny: 0, rr: r[0]! };
  pts.slice(1).forEach((q, i) => {
    const n = nearest(p, pts[i]!, q);
    const rr = r[i]! + (r[i + 1]! - r[i]!) * n.t;
    if (n.d - rr < best.d - best.rr) best = { s: (i + n.t) / (pts.length - 1), d: n.d, nx: n.nx, ny: n.ny, rr };
  });
  return best;
}

/** A stroke through `pts`, `r` its radius at each point; `key` colors a pixel from its light, how far along it is and how far across. */
function stroke(pts: readonly Pt[], r: readonly number[], key: (light: number, s: number, across: number) => string): Painted {
  return paintFrame((cv) => {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const s = along(pts, r, [x + 0.5, y + 0.5]);
        if (s.d > s.rr) continue;
        const across = s.rr ? (s.nx + s.ny) / (s.rr * Math.SQRT2) : 0;
        cv[y]![x] = key(0.64 - 0.45 * (s.nx / s.rr) - 0.5 * (s.ny / s.rr), s.s, across);
      }
  });
}

/** Stripes along a stroke: `pattern` names a band's color a letter at a time (g, o or t), each `width` pixels along it. */
function stripes(pattern: string, width: number, len: number, slant = 1.2): (light: number, s: number, across: number) => string {
  return (l, s, across) => {
    const v = Math.max(0, s * len + across * slant);
    return ramp(HUES[pattern[Math.floor(v / width) % pattern.length]!]!, l);
  };
}

// ---- Parts made the first time they're drawn.

const { parts: PARTS, add } = lazyParts();
interface Placed {
  name: string;
  at: Pt;
}
const placedAt = new Map<string, Pt>();
/** A painted part, made once by name (the name says how it's painted). */
function placed(name: string, make: () => Painted): Placed {
  let at = placedAt.get(name);
  if (!at) {
    const m = make();
    add(name, () => m.part);
    placedAt.set(name, (at = m.at));
  }
  return { name, at };
}
const r2 = (v: number) => Math.round(v * 2) / 2;
const key = (pts: readonly Pt[]) => pts.map((p) => `${r2(p[0])},${r2(p[1])}`).join(";");

// ---- The head: green above the mouth, the yellow-green jaw below it, a smear of paint on its cheek.

export type Mouth = "smile" | "grin" | "open" | "frown" | "flat" | "smirk" | "o" | "wavy";

/** A mouth is a small stamp on the snout, its top left at (`x`, `y`) on the frame ("1" the inside, "2" the tongue). */
const MOUTHS: Record<Mouth, { x: number; y: number; rows: readonly string[] }> = {
  smile: { x: 34, y: 35, rows: ["k........k", ".kk....kk.", "..kkkkkk.."] },
  grin: { x: 35, y: 35, rows: ["kkkkkkkkkk", "k11111111k", ".k112211k.", "..kkkkkk.."] },
  open: { x: 38, y: 35, rows: [".kkkk.", "k1111k", "k1221k", "k1111k", ".kkkk."] },
  frown: { x: 36, y: 37, rows: ["..kkkk..", ".k....k.", "k......k"] },
  flat: { x: 37, y: 38, rows: ["kkkkkk"] },
  smirk: { x: 36, y: 36, rows: ["k.......", ".kkkkkkk"] },
  o: { x: 38, y: 36, rows: [".kkkk.", "k1111k", "k1221k", "k1111k", ".kkkk."] },
  wavy: { x: 35, y: 37, rows: ["kk..kk..kk", ".kkk..kkk."] },
};

function headPart(mouth: Mouth): Painted {
  return paintFrame((cv) => {
    const skull = inEllipse(30.3, 31.3, 12, 9.6);
    const snout = inEllipse(38.8, 36, 5.3, 4.9);
    const inside: Inside = (x, y) => skull(x, y) || snout(x, y);
    const orbL = orb(25, 24, 28);
    const light = (x: number, y: number) => orbL(x, y);
    // The jaw is paler, yellow-green, from the line of the mouth down.
    fill(cv, inside, (x, y) => (y >= 38 - (x < 31 ? 1 : 0) ? tone(THROAT, light(x, y) + 0.2) : tone(GREEN, light(x, y))));
    const M = MOUTHS[mouth];
    stamp(cv, M.rows, M.x, M.y);
    // A nostril, and the smear of paint on the cheek.
    cv[33]![41] = "a";
    stamp(cv, ["KKRR.", "RRRRP", ".PRPP"], 22, 35);
  });
}

// ---- The eyes: a turret of skin, the white, the amber iris with its pupil and a glint.

export type Lid = "open" | "wide" | "half" | "shut" | "joy" | "dizzy";
/** How far down the opening the lid reaches, from its middle in opening radii (up is negative). */
const LID_AT: Record<Lid, number> = { open: -0.95, wide: -1.4, half: -0.05, shut: 1.4, joy: 1.4, dizzy: -1.4 };

function eyePart(cx: number, cy: number, rb: number, [gx, gy]: Pt, lid: Lid, spin = 0): Painted {
  const size = Math.ceil(rb * 2) + 1;
  const c = size / 2;
  const ro = rb - 1.8;
  const ri = ro * 0.82;
  const rp = Math.max(1.25, ri * (lid === "wide" ? 0.45 : 0.52));
  const bulb = roundLight(c, c, rb, rb, 0.14);
  const cv = canvas(size, size);
  const ix = c + gx;
  const iy = c + gy;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const d = Math.hypot(px - c, py - c);
      if (d > rb) continue;
      const covered = py < c + ro * LID_AT[lid];
      if (d > ro || covered) {
        cv[y]![x] = ramp(GREEN, bulb(x, y) - (d < ro + 1 ? 0.16 : 0));
        continue;
      }
      cv[y]![x] = py < c - ro * 0.62 && lid !== "wide" && lid !== "dizzy" ? "S" : "h";
      if (lid === "dizzy") {
        // A spiral: two rings, each with a gap, the gaps turning with `spin`, and a dot in the middle.
        const ang = (((Math.atan2(py - c, px - c) + spin) % TAU) + TAU) % TAU;
        const gap = (a: number) => Math.abs((((ang - a + Math.PI) % TAU) + TAU) % TAU - Math.PI) < 0.65;
        const ring = (r: number, g: number) => Math.abs(d - r) < 0.62 && !gap(g);
        if (ring(ro * 0.8, 0) || ring(ro * 0.42, Math.PI) || d < 0.75) cv[y]![x] = "X";
        continue;
      }
      const di = Math.hypot(px - ix, py - iy);
      if (di <= ri) cv[y]![x] = di >= ri - 0.9 ? "E" : py < iy ? "F" : "G";
      if (di <= rp) cv[y]![x] = "X";
    }
  if (lid === "shut" || lid === "joy")
    for (let x = 0; x < size; x++) {
      const t = (x + 0.5 - c) / ro;
      if (Math.abs(t) > 0.95) continue;
      const y = lid === "shut" ? Math.floor(c + 0.4) : Math.floor(c + 1.2 - 2.6 * (1 - t * t));
      for (const yy of lid === "shut" ? [y] : [y, y + 1]) if (cv[yy]?.[x]) cv[yy]![x] = "k";
    }
  // The glint: the pupil's top left pixel.
  const dark = cv.flatMap((row, y) => row.flatMap((k, x) => (k === "X" ? [[x, y] as Pt] : [])));
  const top = dark.sort((a, b) => a[1] - b[1] || a[0] - b[0])[0];
  if (top && dark.length >= 4 && lid !== "dizzy") cv[top[1]]![top[0]] = "w";
  return { part: { grid: toGrid(cv) }, at: [Math.round(cx - c), Math.round(cy - c)] };
}

// ---- The casque: a small fin behind the eyes, striped like a fan.

function casquePart(): Painted {
  // A little helmet swept back from behind the eyes, ending in a point up and behind.
  const inside = inPoly([[31, 23], [27.5, 20], [23, 18], [18.5, 17.5], [15.5, 19.5], [14.5, 23], [16, 27], [19, 30], [28, 29.5]]);
  const L = orb(21, 20, 20);
  const [px, py] = [27, 29];
  const bands: readonly (readonly [string, number])[] = [["g", 0.1], ["t", 0.3], ["o", 0.5], ["g", 0.6], ["t", 0.78], ["o", 1]];
  return paintFrame((cv) =>
    fill(cv, inside, (x, y) => {
      const a = Math.atan2(y + 0.5 - py, x + 0.5 - px);
      const t = Math.max(0, Math.min(1, (a + Math.PI) / (Math.PI * 0.62)));
      return tone(HUES[bands.find(([, to]) => t < to)?.[0] ?? "o"]!, L(x, y));
    }),
  );
}

// ---- The body: a round bean, a pale belly in front, patches of stripe on its back.

function bodyPart(): Painted {
  return paintFrame((cv) => {
    const body = inEllipse(26, 46, 10, 8.6);
    const L = orb(22.5, 41, 21);
    const belly = inEllipse(33, 49.5, 5.2, 6.2);
    fill(cv, body, (x, y) => {
      if (belly(x, y)) return tone(THROAT, L(x, y) + 0.3);
      // A few bold bands of his stripes across the back and rump.
      if (x < 23 && y > 40) {
        const m = (x * 0.7 + y * 0.9) % 10;
        if (m < 3) return tone(ORANGE, L(x, y));
        if (m < 6) return tone(TEAL, L(x, y));
      }
      return tone(GREEN, L(x, y));
    });
  });
}

// ---- Feet, hands, the stool.

/** A foot facing right: a paw with two fat toes gripping the ground; the ankle is over its third column. */
const FOOT: readonly string[] = [
  "..cddc...",
  ".cdddddcb",
  "cdddddddb",
  "cbbb.bbbb",
];
const shiftDark = (rows: readonly string[]): string[] => rows.map((r) => r.replace(/[abcde]/g, (k) => "abcde"["abcde".indexOf(k) - 1] ?? "a"));
/** A fist closed round the brush's handle. */
const FIST: readonly string[] = [
  ".cdc.",
  "cddcb",
  "cacbb",
  ".bbb.",
];
const STOOL: readonly string[] = [
  "DDDDDDDDDDDDDDDDDDDDDDDD",
  "CCCCCCCCCCCCCCCCCCCCCCCC",
  "BBBBBBBBBBBBBBBBBBBBBBBB",
  "..CB................CB..",
  "..CB" + "B".repeat(16) + "CB..",
  "..CB................CB..",
  "..CB................CB..",
  "..CB................CB..",
];
add("footN", () => ({ grid: FOOT }));
add("footF", () => ({ grid: shiftDark(FOOT) }));
add("fist", () => ({ grid: FIST }));
add("stool", () => ({ grid: STOOL }));
add("shadow", () => {
  const cv = canvas(32, 3);
  const e = inEllipse(16, 1.5, 16, 1.6);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 32; x++) if (e(x, y)) cv[y]![x] = "z";
  return { grid: toGrid(cv), outline: false };
});
add("shadowSit", () => {
  const cv = canvas(30, 3);
  const e = inEllipse(15, 1.5, 15, 1.6);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 30; x++) if (e(x, y)) cv[y]![x] = "z";
  return { grid: toGrid(cv), outline: false };
});
/** The paint on the bristles' tip: a dollop with a ragged edge and a drip; paint keys P, R, K only. */
const PAINT_GLOB: readonly string[] = [
  ".PPPP.",
  "PKKRRP",
  "PKRRRP",
  "PRRRRP",
  ".PRRP.",
  "..PP..",
];
const PAINT_SMEAR: readonly string[] = [".PRP.", "PRKRP", ".PPP."];
add("paintGlob", () => ({ grid: PAINT_GLOB }));
add("paintSmear", () => ({ grid: PAINT_SMEAR }));

// ---- Limbs.

const unit = (a: Pt, b: Pt): Pt => {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
};

function legPart(hip: Pt, knee: Pt, ankle: Pt, far: boolean, thin = false): Painted {
  const r = thin ? [2.7, 2.4, 2.1] : [3.4, 3.0, 2.5];
  const pat = thin ? "gtog" : far ? "tgo" : "ogt";
  return stroke([hip, knee, ankle], r, (l, s, across) => stripes(pat, thin ? 3 : 3.4, thin ? 11 : 9, 1.2)(l - (far ? 0.14 : 0.04), s, across));
}

const BONES: Pt = [6, 6];
/** An elbow for an arm of two bones from `s` to `t`, bent down (or as far out as it reaches). */
function elbowOf(s: Pt, t: Pt, [l1, l2]: Pt): Pt {
  const dist = Math.hypot(t[0] - s[0], t[1] - s[1]) || 0.01;
  const d = Math.min(dist, l1 + l2 - 0.01);
  const [ux, uy] = [(t[0] - s[0]) / dist, (t[1] - s[1]) / dist];
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const [mx, my] = [s[0] + ux * a, s[1] + uy * a];
  const c1: Pt = [mx - uy * h, my + ux * h];
  const c2: Pt = [mx + uy * h, my - ux * h];
  return c1[1] >= c2[1] ? c1 : c2;
}

function armPart(shoulder: Pt, elbow: Pt, wrist: Pt, far: boolean): Painted {
  const len = Math.hypot(elbow[0] - shoulder[0], elbow[1] - shoulder[1]) + Math.hypot(wrist[0] - elbow[0], wrist[1] - elbow[1]);
  const pat = stripes("gotg", len / 4, len, 1);
  return stroke([shoulder, elbow, wrist], [3.0, 2.6, 2.3], (l, s, across) => pat(l - (far ? 0.16 : 0), s, across));
}

// ---- The tail: walked along from the hip, turning as it goes; `curl` 1 the spiral, 0 a loose hook.

const TAIL_LEN = 32;
const TAIL_R0 = 7;
const TAIL_R1 = 2.9;
const TAIL_LOOSE = 9;

function tailPart(root: Pt, ground: number, curl: number, sway: number, phase: number, loose = TAIL_LOOSE): Painted {
  const steps = 44;
  const ds = TAIL_LEN / steps;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  let heading = lerp(72, 104.4, curl) * (Math.PI / 180);
  let x = root[0] - 1;
  let y = root[1] + 1.6;
  const pts: Pt[] = [root, [x, y]];
  const r: number[] = [3.2, 3.1];
  for (let i = 1; i <= steps; i++) {
    const s = (i - 0.5) * ds;
    const rad = TAIL_R0 - ((TAIL_R0 - TAIL_R1) * s) / TAIL_LEN;
    heading -= lerp(1 / loose, 1 / rad, curl) * ds;
    const h = heading + sway * Math.sin(phase - s * 0.2) * (s / TAIL_LEN);
    x -= Math.cos(h) * ds;
    y += Math.sin(h) * ds;
    const radius = 3.1 - 2.0 * (i / steps);
    pts.push([Math.max(x, 4 + radius), Math.min(y, ground - 0.5 - radius)]);
    r.push(radius);
  }
  const bands = stripes("tgotgtogtotgtgo", 3.4, TAIL_LEN, 0.9);
  return stroke(pts, r, (l, t, across) => bands(l - 0.05, t, across));
}

// ---- The brush, from the butt of its handle to the tip of its bristles.

const BRUSH_LEN = 24;
function brushPart(butt: Pt, tip: Pt): Painted {
  const len = Math.hypot(tip[0] - butt[0], tip[1] - butt[1]);
  const ax = (tip[0] - butt[0]) / len;
  const ay = (tip[1] - butt[1]) / len;
  // The side of the brush that faces the light (up and left) is `n`.
  const n1: Pt = [ay, -ax];
  const n2: Pt = [-ay, ax];
  const [nx, ny] = -n1[0] - n1[1] >= -n2[0] - n2[1] ? n1 : n2;
  const BRISTLES = 8;
  const FERRULE = 3.5;
  const radius = (u: number): number => {
    if (u < 0) return -1;
    if (u < BRISTLES) return u < 2 ? 1.6 + 0.7 * (u / 2) : 2.3;
    if (u < BRISTLES + FERRULE) return 1.6;
    return 1.1;
  };
  return paintFrame((cv) =>
    fill(
      cv,
      (x, y) => {
        const dx = x + 0.5 - tip[0];
        const dy = y + 0.5 - tip[1];
        const u = -(dx * ax + dy * ay);
        const v = dx * nx + dy * ny;
        return u >= 0 && u <= len && Math.abs(v) <= radius(u);
      },
      (x, y) => {
        const dx = x + 0.5 - tip[0];
        const dy = y + 0.5 - tip[1];
        const u = -(dx * ax + dy * ay);
        const v = dx * nx + dy * ny;
        const l = 0.62 + 0.4 * (v / radius(u));
        if (u < BRISTLES) return ramp("UVW", l + (u < 2 ? 0.1 : -0.05));
        if (u < BRISTLES + FERRULE) {
          const e = u - BRISTLES;
          return e < 0.8 || e > FERRULE - 0.9 ? "f" : ramp("fgij", l);
        }
        return ramp("LMNQ", l);
      },
    ),
  );
}

// ---- Poses.

export interface Pose {
  /** Sinks this many pixels (a breath, a crouch); the feet stay down. */
  bob?: number;
  dx?: number;
  /** The whole of it off the ground (the shadow stays). */
  air?: number;
  /** The head on the body. */
  hx?: number;
  hy?: number;
  mouth?: Mouth;
  gazeN?: Pt;
  gazeF?: Pt;
  lidN?: Lid;
  lidF?: Lid;
  spin?: number;
  /** The brush: the fist round its handle, its tilt (degrees from straight up, positive: the tip to our right), the fist's grip along it from the butt. */
  fist?: Pt;
  tilt?: number;
  grip?: number;
  paint?: "full" | "smear" | "none";
  noBrush?: boolean;
  /** The brush lying where it fell (absolute: butt, tip), in a flop. */
  brush?: readonly [Pt, Pt];
  /** The far hand. */
  handF?: Pt;
  curl?: number;
  sway?: number;
  swayPhase?: number;
  /** The casque lifted (negative) or drooped. */
  cas?: number;
  /** Feet: sideways shift and lift, per foot. */
  footN?: { x?: number; lift?: number };
  footF?: { x?: number; lift?: number };
  sit?: boolean;
  /** Sat down hard on its bottom, legs out in front (defeat). */
  flop?: boolean;
}

const SHOULDER_N: Pt = [35.5, 43];
const SHOULDER_F: Pt = [31, 41];
const REST_FIST: Pt = [44.5, 45];

export function holding(fist: Pt, tilt: number, grip = 4): Pick<Pose, "fist" | "tilt" | "grip"> {
  return { fist, tilt, grip };
}
const dirOf = (tilt: number): Pt => [Math.sin((tilt * Math.PI) / 180), -Math.cos((tilt * Math.PI) / 180)];

/** The layers of a pose, back to front, and where the brush's tip is. */
function layersOf(p: Pose): { layers: Layer[]; tip: Pt } {
  const dx = p.dx ?? 0;
  const air = p.air ?? 0;
  const b = p.bob ?? 0;
  const sit = p.sit ?? false;
  const flop = p.flop ?? false;
  const ux = dx + (sit ? -3 : flop ? -3 : 0);
  const uy = b - air + (sit ? -2 : flop ? 5 : 0);
  const out: Layer[] = [];
  const at = (name: string, x: number, y: number) => out.push({ part: name, x: Math.round(x), y: Math.round(y) });
  const put = (pl: Placed, ox = 0, oy = 0) => at(pl.name, pl.at[0] + ox, pl.at[1] + oy);
  const hox = ux + (p.hx ?? 0);
  const hoy = uy + (p.hy ?? 0);

  // Its shadow, then its tail.
  if (sit) at("shadowSit", 9, GROUND - 2);
  else if (flop) at("shadow", 12 + dx, GROUND - 2);
  else at("shadow", 10 + dx, GROUND - 2);
  const root: Pt = sit ? [16.5, 48.5] : flop ? [15, 54.5] : [18.5, 49.5];
  const ground = sit ? 61 : GROUND;
  const curl = flop ? 0.8 : p.curl ?? 1;
  const tailKey = [curl, p.sway ?? 0, p.swayPhase ?? 0].map((v) => Math.round(v * 50) / 50).join(":");
  const loose = sit ? 6.5 : TAIL_LOOSE;
  put(placed(`tail:${tailKey}:${root}:${ground}:${loose}`, () => tailPart(root, ground, curl, p.sway ?? 0, p.swayPhase ?? 0, loose)), dx, flop || sit ? 0 : -air);
  if (sit) at("stool", 8, 53);

  // The far arm, behind the body.
  const shoulderF: Pt = [SHOULDER_F[0] + ux, SHOULDER_F[1] + uy];
  const handFrest: Pt = sit ? [37, 47] : flop ? [36, 56] : [39, 48];
  const handF: Pt = p.handF ? [p.handF[0] + ux, p.handF[1] + uy] : [handFrest[0] + (sit || flop ? 0 : ux), handFrest[1] + (sit || flop ? 0 : uy)];
  const elbowF = elbowOf(shoulderF, handF, [6, 5.5]);
  put(placed(`armF:${key([shoulderF, elbowF, handF])}`, () => armPart(shoulderF, elbowF, handF, true)));
  at("fist", handF[0] - 2.5, handF[1] - 2);

  // Legs and feet.
  const stand = (far: boolean) => {
    const f = (far ? p.footF : p.footN) ?? {};
    const hip: Pt = [(far ? 29 : 22) + ux, 51 + uy];
    const ay = 57.5 - air - (f.lift ?? 0);
    const ankle: Pt = [(far ? 30.5 : 22.5) + dx + (f.x ?? 0), ay];
    const knee: Pt = [(hip[0] + ankle[0]) / 2 + (far ? 1 : -0.5) + (b > 1 ? 1 : 0), (hip[1] + ankle[1]) / 2 + 0.5];
    put(placed(`leg:${far ? "f" : "n"}:${key([hip, knee, ankle])}`, () => legPart(hip, knee, ankle, far)));
    at(far ? "footF" : "footN", ankle[0] - 2.5, 57 - air - (f.lift ?? 0));
  };
  const dangle = (far: boolean) => {
    const f = (far ? p.footF : p.footN) ?? {};
    const hip: Pt = far ? [25, 48.5] : [20.5, 49];
    const ankle: Pt = far ? [32.5 + (f.x ?? 0), 55 - (f.lift ?? 0)] : [29 + (f.x ?? 0), 55.5 - (f.lift ?? 0)];
    const knee: Pt = far ? [31, 50.5] : [27.5, 51];
    put(placed(`leg:${far ? "f" : "n"}:t:${key([hip, knee, ankle])}`, () => legPart(hip, knee, ankle, far, true)));
    at(far ? "footF" : "footN", ankle[0] - 2.5, ankle[1] - 0.5);
  };
  const sprawl = (far: boolean) => {
    const f = (far ? p.footF : p.footN) ?? {};
    const hip: Pt = far ? [26, 56.5] : [21, 57];
    const ankle: Pt = far ? [36 + (f.x ?? 0), 57.4] : [33 + (f.x ?? 0), 57.4];
    const knee: Pt = [(hip[0] + ankle[0]) / 2, (hip[1] + ankle[1]) / 2 + 0.5];
    put(placed(`leg:${far ? "f" : "n"}:t:${key([hip, knee, ankle])}`, () => legPart(hip, knee, ankle, far, true)));
    at(far ? "footF" : "footN", ankle[0] - 2.5, ankle[1] - 0.5);
  };
  const legs = sit ? dangle : flop ? sprawl : stand;
  // A brush dropped on the ground lies behind the feet.
  if (flop && p.brush && !p.noBrush) {
    put(placed(`brush:${key([...p.brush])}`, () => brushPart(p.brush![0], p.brush![1])));
    at("paintGlob", p.brush[1][0] + 0.5 * unit(p.brush[0], p.brush[1])[0] - 3, p.brush[1][1] + 0.5 * unit(p.brush[0], p.brush[1])[1] - 3);
  }
  legs(true);
  if (!sit && !flop) legs(false);

  put(placed("casque", casquePart), hox, hoy + (p.cas ?? 0));
  put(placed("body", bodyPart), ux, uy);
  if (sit || flop) legs(false);

  // The head and its eyes.
  const mouth = p.mouth ?? "smile";
  put(placed(`head:${mouth}`, () => headPart(mouth)), hox, hoy);
  const gN: Pt = p.gazeN ?? [0.8, 0.3];
  const gF: Pt = p.gazeF ?? [0.6, 0.3];
  const lidN = p.lidN ?? "open";
  const lidF = p.lidF ?? "open";
  const spin = Math.round((p.spin ?? 0) * 4) / 4;
  put(placed(`eyeF:${gF}:${lidF}:${spin}`, () => eyePart(37.5, 26, 5, gF, lidF, spin)), hox, hoy);
  put(placed(`eyeN:${gN}:${lidN}:${spin}`, () => eyePart(27, 25.5, 6, gN, lidN, spin + 1)), hox, hoy);

  // The near arm, the brush in its fist, the paint on the brush's tip.
  const fist: Pt = [(p.fist ?? REST_FIST)[0] + ux, (p.fist ?? REST_FIST)[1] + uy];
  const tilt = p.tilt ?? 20;
  const grip = p.grip ?? 4;
  const d = dirOf(tilt);
  const butt: Pt = [fist[0] - d[0] * grip, fist[1] - d[1] * grip];
  const tip: Pt = [fist[0] + d[0] * (BRUSH_LEN - grip), fist[1] + d[1] * (BRUSH_LEN - grip)];
  const shoulderN: Pt = [SHOULDER_N[0] + ux, SHOULDER_N[1] + uy];
  const elbowN = elbowOf(shoulderN, fist, BONES);
  put(placed(`armN:${key([shoulderN, elbowN, fist])}`, () => armPart(shoulderN, elbowN, fist, false)));
  if (!p.noBrush && !(flop && p.brush)) {
    put(placed(`brush:${key([butt, tip])}`, () => brushPart(butt, tip)));
    const paint = p.paint ?? "full";
    const u = unit(butt, tip);
    if (paint === "full") at("paintGlob", tip[0] + 0.5 * u[0] - 3, tip[1] + 0.5 * u[1] - 3);
    else if (paint === "smear") at("paintSmear", tip[0] + 0.5 * u[0] - 2.5, tip[1] + 0.5 * u[1] - 1.5);
  }
  at("fist", fist[0] - 2.5, fist[1] - 2);
  return { layers: out, tip };
}

// ---- Things drawn on frames: paint flecks, sparkles, dust, thoughts, sweat.

const sp = (x: number, y: number, k: string): Speck => [Math.round(x), Math.round(y), k];
/** Paint at a point: a fleck (1), a drop (2). Paint keys only, so it stays the paint's color. */
const blob = (x: number, y: number, n: 1 | 2 = 2): Speck[] => (n === 1 ? [sp(x, y, "R")] : [sp(x, y, "K"), sp(x + 1, y, "R"), sp(x, y + 1, "R"), sp(x + 1, y + 1, "P")]);
/** Flecks flung from a tip, `t` frames after, fanning out along `dir` (degrees, 0 to our right, 90 down). */
const flecks = (tip: Pt, dir: number, t: number, n = 5): Speck[] =>
  Array.from({ length: n }, (_, i): Speck[] => {
    const a = ((dir + (i - (n - 1) / 2) * 20) * Math.PI) / 180;
    const dist = 2 + t * (2.6 + (i % 3));
    return blob(tip[0] + Math.cos(a) * dist, tip[1] + Math.sin(a) * dist + 0.25 * t * t, (i % 2 === 0 ? 2 : 1) as 1 | 2);
  }).flat();
const sparkle = (x: number, y: number, big = false): Speck[] => [
  sp(x, y, "w"), sp(x - 1, y, "y"), sp(x + 1, y, "y"), sp(x, y - 1, "y"), sp(x, y + 1, "y"),
  ...(big ? [sp(x - 2, y, "Y"), sp(x + 2, y, "Y"), sp(x, y - 2, "Y"), sp(x, y + 2, "Y")] : []),
];
const dust = (t: number, n = 3, cx = 26, spread = 14): Speck[] => {
  const out: Speck[] = [];
  for (let side = -1; side <= 1; side += 2)
    for (let i = 0; i < n; i++) {
      const x = Math.round(cx + side * (spread * 0.5 + i * 3 + t * (2 + (i % 2))));
      const y = GROUND - 1 - Math.round(t * (0.5 + (i % 3) * 0.5) + (i % 2));
      const cloud: [number, number, string][] = t < 2 ? [[0, 0, "9"], [side, 0, "9"], [0, -1, "0"], [side, -1, "0"]] : [[0, 0, "0"], [side, -1, "9"]];
      for (const [ox, oy, k] of cloud) out.push(sp(x + ox, y + oy, k));
    }
  return out;
};
const groundShadow = (r: number, cx = 26): Speck[] => {
  const out: Speck[] = [];
  for (let x = -r; x <= r; x++) for (let y = -1; y <= 0; y++) if (Math.abs(x) < r - (y === -1 ? 2 : 0)) out.push(sp(cx + x, GROUND - 1 + y, "z"));
  return out;
};
const thoughts = (n: number): Speck[] =>
  ([[41, 14], [46, 9], [51, 5]] as Pt[])
    .slice(0, n)
    .flatMap(([x, y], i): Speck[] =>
      i === 2
        ? sparkle(x, y, true)
        : [sp(x, y, "y"), sp(x + 1, y, "Y"), sp(x, y + 1, "Y"), sp(x + 1, y + 1, "O"), ...(i === 1 ? [sp(x - 1, y, "O"), sp(x + 2, y, "O"), sp(x, y - 1, "Y"), sp(x + 1, y - 1, "O"), sp(x, y + 2, "O"), sp(x + 1, y + 2, "O")] : [])],
    );
const sweat = (i: number): Speck[] => {
  const t = i % 4;
  return [sp(19 - t, 18 + t * 2, "~"), sp(46 + t, 17 + t * 2, "~")];
};
const stars = (x: number, y: number, t: number): Speck[] => [
  ...sparkle(x + Math.round(4 * Math.cos(t)), y + Math.round(1.5 * Math.sin(t))),
  sp(x + Math.round(4 * Math.cos(t + 3.1)), y + Math.round(1.5 * Math.sin(t + 3.1)), "Y"),
];

/** A hit: every color goes pale. */
const FLASH: Record<string, string> = Object.fromEntries(
  Object.entries(SIDEKICK_PALETTE)
    .filter(([k]) => !["k", "z", "~", "9", "0", "w"].includes(k))
    .map(([k, c]) => {
      const n = parseInt(c.slice(1), 16);
      const mix = (v: number) => Math.round(v + (255 - v) * 0.55).toString(16).padStart(2, "0");
      return [k, `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`];
    }),
);

/** The view onto the 64 x 64 drawing (the whole of it, unless a drawing is being inspected up close). */
const VIEW = { x: 0, y: 0, w: W, h: H };
const F = (ms: number, pose: Pose = {}, extra: Partial<Frame> = {}): Frame => {
  const { layers } = layersOf(pose);
  const specks = extra.specks?.filter(([x, y]) => x >= 2 && y >= 2 && x <= W - 3 && y <= H - 3);
  return {
    ms,
    layers: layers.map((l) => ({ ...l, x: l.x - VIEW.x, y: l.y - VIEW.y })),
    ...extra,
    ...(specks ? { specks: specks.map(([x, y, k]): Speck => [x - VIEW.x, y - VIEW.y, k]) } : {}),
  };
};
const tipOf = (pose: Pose): Pt => layersOf(pose).tip;
/** Where a twinkle shows on the paint of the held-up brush in the idle. */
const glintAt = (i: number): Pt => {
  const t = tipOf({ tilt: i >= 5 && i <= 8 ? 24 : i >= 17 && i <= 19 ? 16 : 20, bob: i >= 9 && i < 21 ? 1 : 0 });
  return [Math.round(t[0]) + 4, Math.round(t[1]) - 4];
};

// ---- Brush holds.

const UP = holding([44.5, 45], 20);
const HIGH = holding([44, 39], 14);
const WAVE_L = holding([44, 38], 8);
const WAVE_M = holding([45, 38], 26);
const WAVE_R = holding([44.5, 38], 36);
const POINT = holding([45, 43], 60, 12);
const BACK = holding([43, 47], 30);
const DOWN = holding([42, 50], 112, 8);
const CHIN = holding([40.5, 41.5], 40);
const LOW = holding([41, 47], 68);

// ---- Animations.

/** Idle (3 s): breathes, its turret eyes roll about each on its own and blink, its tail curls and uncurls, the brush held up proudly. */
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 24 }, (_, i) => {
    const e = Math.sin((Math.PI * i) / 24) ** 2;
    const blink = i === 13 || i === 22;
    const half = i === 12 || i === 14;
    const gN: Pt = i >= 3 && i <= 5 ? [1.3, -0.9] : i >= 8 && i <= 10 ? [-1.4, 0.2] : i >= 16 && i <= 18 ? [0.3, -1.3] : [0.8, 0.3];
    const gF: Pt = i >= 4 && i <= 6 ? [1.4, -0.5] : i >= 9 && i <= 11 ? [-1.1, -0.8] : i >= 17 && i <= 19 ? [1.2, 0.8] : [0.6, 0.3];
    const lid: Lid = blink ? "shut" : half ? "half" : "open";
    return F(125, {
      bob: i >= 9 && i < 21 ? 1 : 0,
      mouth: i >= 15 && i <= 17 ? "grin" : "smile",
      gazeN: gN,
      gazeF: gF,
      lidN: lid,
      lidF: lid,
      curl: 1 - 0.5 * e,
      sway: 0.6 * e,
      swayPhase: (TAU * i) / 24,
      tilt: i >= 5 && i <= 8 ? 24 : i >= 17 && i <= 19 ? 16 : 20,
      cas: i >= 4 && i <= 6 ? -1 : 0,
    }, { specks: i === 7 || i === 19 ? sparkle(...glintAt(i)) : [] });
  }),
};

/** Walk (0.6 s): a careful step-and-grip, the head bobbing, the brush held up. */
const walk: Anim = {
  loop: true,
  frames: Array.from({ length: 6 }, (_, i) => {
    // A foot on the ground slides back; in the air it swings forward in an arc.
    const leg = (phase: number) => {
      const p = (((phase % 1) + 1) % 1);
      return p < 0.5 ? { x: Math.round(3 - 12 * p), lift: 0 } : { x: Math.round(-3 + 12 * (p - 0.5)), lift: Math.round(3 * Math.sin(Math.PI * ((p - 0.5) / 0.5))) };
    };
    const low = i % 3 === 0;
    return F(
      100,
      {
        bob: low ? 1 : 0,
        hx: low ? 0 : 1,
        hy: low ? 0 : -1,
        footN: leg(i / 6),
        footF: leg(i / 6 + 0.5),
        curl: 0.85,
        sway: 0.4 * (i < 3 ? 1 : -1),
        swayPhase: (TAU * i) / 6,
        handF: i < 3 ? [41, 49] : [37, 48],
        gazeN: [1.2, 0.2],
        gazeF: [1.1, 0.2],
        tilt: low ? 24 : 17,
        cas: low ? 0 : -1,
      },
      low ? { cue: "step" } : {},
    );
  }),
};

/** Sit (loops): on a stool at the chess table, facing the board, legs dangling, the brush lowered, thinking about a move. */
const SIT: Pose = { sit: true, ...LOW, tilt: 68, paint: "full" };
const sit: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) => {
    const lean = i >= 6 && i <= 11;
    const blink = i === 3 || i === 13;
    const swing = i % 8 < 4 ? 0 : 1;
    return F(200, {
      ...SIT,
      bob: i % 8 >= 4 ? 1 : 0,
      hx: lean ? 1 : 0,
      hy: lean ? 1 : 0,
      mouth: lean ? "flat" : "smile",
      lidN: blink ? "shut" : "open",
      lidF: blink ? "shut" : "open",
      gazeN: lean ? [1.4, 0.9] : [1.0, 0.3],
      gazeF: lean ? [1.2, 0.9] : [0.8, 0.3],
      footN: { lift: swing },
      footF: { lift: 1 - swing },
      fist: lean ? [41, 48] : [41, 47],
      tilt: lean ? 62 : 68,
      curl: 0.3 + 0.08 * Math.sin((TAU * i) / 16),
      sway: 0.2,
      swayPhase: (TAU * i) / 16,
    });
  }),
};

/** Wave (once, 1.2 s): it lifts the brush and waves it hello, flicking a dab of paint, then settles back to its idle pose. */
const WAVES = [WAVE_L, WAVE_M, WAVE_R, WAVE_M, WAVE_L, WAVE_M, WAVE_R, WAVE_M];
const wave: Anim = {
  loop: false,
  frames: [
    F(100, { bob: 1, mouth: "grin", lidN: "joy", lidF: "joy", ...BACK }),
    F(100, { ...HIGH, mouth: "grin", cas: -1, hy: -1, gazeN: [1.2, -0.4], gazeF: [1.0, -0.4] }, { cue: "giggle" }),
    ...WAVES.map((w, i) => {
      const pose: Pose = { ...w, mouth: "grin", lidN: i % 4 === 2 ? "joy" : "open", lidF: i % 4 === 2 ? "joy" : "open", gazeN: [1.2, -0.5], gazeF: [1.0, -0.5], bob: i % 2 ? 1 : 0, hy: i % 2 ? 0 : -1, cas: i % 2 ? 0 : -1, curl: i % 2 ? 0.8 : 0.95, sway: i % 2 ? 0.35 : -0.35, swayPhase: i * 1.3, handF: i % 2 ? [38, 49] : [40, 47] };
      return F(100, pose, { cue: i === 2 ? "splat" : undefined, specks: i === 2 || i === 3 ? flecks(tipOf(pose), 20, i - 1, 4) : i === 5 ? sparkle(54, 18) : [] });
    }),
    F(100, { ...UP, mouth: "grin", lidN: "joy", lidF: "joy" }),
    F(100, { ...UP }),
  ],
};

/** Entrance: its shadow spreads, it drops in from above and lands (dust), then lifts the brush: ta-da. */
const entrance: Anim = {
  loop: false,
  frames: [
    { ms: 100, layers: [], specks: groundShadow(6), cue: "drop" },
    { ms: 90, layers: [], specks: groundShadow(11) },
    F(70, { air: 9, curl: 0.55, sway: 0.4, lidN: "wide", lidF: "wide", mouth: "open", footN: { lift: 2 }, footF: { lift: 3 }, cas: -2, ...HIGH }),
    F(70, { air: 4, curl: 0.7, sway: 0.25, lidN: "wide", lidF: "wide", mouth: "open", footN: { lift: 1 }, footF: { lift: 2 }, cas: -1, ...HIGH }),
    F(120, { bob: 3, curl: 0.85, lidN: "shut", lidF: "shut", mouth: "smile", cas: 1 }, { cue: "thump", shake: [1, 0], specks: dust(0) }),
    F(100, { bob: 1, mouth: "grin" }, { specks: dust(1) }),
    F(120, { ...HIGH, mouth: "grin", lidN: "joy", lidF: "joy", cas: -1, hy: -1 }, { cue: "splat", specks: [...dust(2), ...flecks(tipOf(HIGH), 80, 1, 4)] }),
    F(120, { ...WAVE_L, mouth: "grin", lidN: "joy", lidF: "joy", curl: 0.9, sway: 0.3 }, { specks: flecks(tipOf(WAVE_L), 70, 3, 4) }),
    F(120, { ...WAVE_R, mouth: "grin", curl: 0.95, gazeN: [1.2, -0.4] }, { specks: sparkle(53, 17) }),
    F(140, { ...UP, mouth: "grin" }),
    F(300, {}),
  ],
};

/** Thinking (loops): the brush's handle at its chin, head tipped back, eyes rolled up, thought dots popping up, the tail curling slowly. */
const thinking: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const n = i % 6 < 1 ? 0 : i % 6 < 3 ? 1 : i % 6 < 5 ? 2 : 3;
    const tap = i % 2 === 1;
    return F(
      150,
      {
        ...CHIN,
        fist: tap ? [40.5, 40.5] : [40.5, 41.5],
        mouth: "flat",
        lidN: i === 8 ? "shut" : "open",
        lidF: i === 8 ? "shut" : "open",
        gazeN: [0.2, -1.4],
        gazeF: i === 4 ? [-0.3, -1.3] : [0.4, -1.3],
        hx: 1,
        hy: -1,
        bob: i % 6 >= 3 ? 1 : 0,
        curl: [1, 0.92, 0.84, 0.8, 0.84, 0.92][i % 6]!,
        sway: 0.1 * (tap ? 1 : -1),
        swayPhase: i,
      },
      { specks: thoughts(n) },
    );
  }),
};

/** Its move: a crouch, a hop toward the board with a flick of the brush at it, a landing and a settle. */
const move: Anim = {
  loop: false,
  frames: [
    F(100, { bob: 2, ...BACK, mouth: "grin" }),
    F(80, { air: 4, dx: 1, ...POINT, paint: "smear", mouth: "grin", lidN: "wide", lidF: "wide", footN: { lift: 2 }, footF: { lift: 3 }, curl: 0.6, sway: 0.4, cas: -1 }, { cue: "splat", specks: flecks(tipOf({ ...POINT, dx: 1, air: 4 }), 5, 1, 4) }),
    F(80, { air: 5, dx: 2, ...POINT, paint: "smear", mouth: "grin", footN: { lift: 2 }, footF: { lift: 2 }, curl: 0.5, sway: 0.3 }, { specks: flecks(tipOf({ ...POINT, dx: 2, air: 5 }), 5, 3, 4) }),
    F(110, { bob: 2, dx: 2, ...POINT, paint: "none", mouth: "smile", lidN: "shut", lidF: "shut", curl: 0.8 }, { cue: "thump", specks: dust(0, 2) }),
    F(100, { bob: 1, dx: 2, ...UP, paint: "none", mouth: "smile" }, { specks: dust(1, 2) }),
    F(110, { dx: 1, ...UP, paint: "smear" }),
    F(150, {}),
  ],
};

/** A capture: two cheering hops, the brush pumping, flicking paint, sparkles. */
const capture: Anim = {
  loop: false,
  frames: [
    F(90, { bob: 2, ...BACK, mouth: "grin" }, { cue: "splat" }),
    ...Array.from({ length: 10 }, (_, i) => {
      const odd = i % 2 === 1;
      const hold = odd ? WAVE_M : HIGH;
      const pose: Pose = { ...hold, air: [3, 2, 3, 2, 0, 3, 2, 3, 2, 0][i]!, bob: i === 4 || i === 9 ? 2 : 0, lidN: "joy", lidF: "joy", mouth: "grin", curl: odd ? 0.7 : 1, sway: odd ? 0.3 : -0.3, swayPhase: i * 1.2, cas: odd ? 0 : -1, footN: { lift: 1 }, footF: { lift: 1 } };
      return F(85, pose, { cue: i === 3 ? "giggle" : undefined, specks: [...(i < 8 ? flecks(tipOf(pose), odd ? 40 : 10, 1 + (i % 3), 4) : []), ...(i < 6 && !odd ? sparkle(52 + (i % 3), 9 + i) : [])] });
    }),
    F(160, { mouth: "smile", lidN: "half", lidF: "half" }),
  ],
};

/** Hurt: a flash, knocked back with eyes squeezed shut and the brush drooping; then it shakes it off. */
const hurt: Anim = {
  loop: false,
  frames: [
    F(70, { bob: 2, dx: -1, lidN: "shut", lidF: "shut", mouth: "o", curl: 0.7, sway: 0.5, ...DOWN, cas: 1 }, { cue: "oof", pal: FLASH, shake: [1, 0] }),
    F(80, { bob: 2, dx: -1, lidN: "shut", lidF: "shut", mouth: "o", curl: 0.75, sway: -0.4, ...DOWN, cas: 1 }, { shake: [1, 0], specks: [sp(21, 18, "~"), sp(20, 19, "~")] }),
    F(90, { bob: 1, dx: -1, lidN: "wide", lidF: "wide", mouth: "wavy", curl: 0.85, ...DOWN }),
    F(90, { bob: 1, dx: -1, lidN: "wide", lidF: "wide", mouth: "frown", ...holding([43, 47], 62, 11) }),
    F(110, { hy: 1, lidN: "half", lidF: "half", gazeN: [1.0, 0.9], gazeF: [0.9, 0.9], mouth: "frown", ...UP }),
    F(120, { lidN: "open", lidF: "half", mouth: "smile", ...UP }),
    F(160, {}),
  ],
};

/** Check: it jabs the brush at the board, twice, with a flourish of sparkle, eyes bright. */
const JAB: Pose = { ...POINT, mouth: "grin", gazeN: [1.4, 0], gazeF: [1.3, 0], hx: 1, paint: "full" };
const check: Anim = {
  loop: false,
  frames: [
    F(100, { bob: 2, ...BACK, mouth: "grin" }),
    F(120, { ...JAB }, { cue: "swish", specks: sparkle(tipOf(JAB)[0] + 2, tipOf(JAB)[1] - 4) }),
    F(100, { ...JAB, bob: 1, fist: [45, 44] }),
    F(100, { ...HIGH, mouth: "grin", lidN: "half" }),
    F(120, { ...JAB }, { cue: "swish", specks: sparkle(tipOf(JAB)[0] + 2, tipOf(JAB)[1] - 4, true) }),
    F(100, { ...JAB, bob: 1 }),
    F(150, { lidN: "half", lidF: "half", mouth: "smile" }),
    F(160, { lidN: "half", lidF: "half", mouth: "grin" }),
  ],
};

/** Smug: chin up, lids half shut, a smirk, a slow nod, the tail lazily swaying, one eye wandering. */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) =>
    F(150, {
      ...UP,
      mouth: "smirk",
      lidN: "half",
      lidF: "half",
      hy: i < 3 || i > 5 ? -1 : 0,
      hx: i < 4 ? 0 : 1,
      gazeN: [0.8, 0.5],
      gazeF: [[0.6, 0.4], [0, 0.3], [-0.6, 0.4], [-0.6, 0.4], [0, 0.3], [0.6, 0.4], [0.6, 0.4], [0.6, 0.4]][i] as Pt,
      curl: 0.95 - 0.05 * Math.sin((TAU * i) / 8),
      sway: 0.2,
      swayPhase: (TAU * i) / 8,
      bob: i % 4 === 2 ? 1 : 0,
      cas: i === 5 ? -1 : 0,
    }),
  ),
};

/** Rattled: shaking, eyes wide, mouth working, sweat flying, the tail wound tight, the brush trembling. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) =>
    F(80, { dx: i % 2 ? 1 : -1, bob: i % 4 === 2 ? 1 : 0, lidN: "wide", lidF: "wide", mouth: i % 2 ? "o" : "wavy", curl: 1, sway: 0.14 * (i % 2 ? 1 : -1), swayPhase: i, cas: 1, ...holding([45 + (i % 2 ? 1 : 0), 46], i % 2 ? 24 : 16), gazeN: [i % 2 ? 0.6 : -0.3, 0], gazeF: [i % 2 ? 0.4 : -0.4, 0] }, { specks: sweat(i) }),
  ),
};

/** Defeat: hit, a flash, dizzy eyes; the brush drops, it sits down hard with its legs out, the tail limp, stars wheeling over its head. */
const SLUMP: Pose = { flop: true, bob: 0, brush: [[38, 58], [56, 57.4]], fist: [34, 49], lidN: "dizzy", lidF: "dizzy", mouth: "wavy", hx: 2, hy: 2, cas: 2 };
const defeat: Anim = {
  loop: false,
  frames: [
    F(80, { bob: 2, dx: -1, lidN: "shut", lidF: "shut", mouth: "o", curl: 0.6, sway: 0.5, ...DOWN, cas: 1 }, { cue: "oof", pal: FLASH, shake: [1, 0], specks: flecks(tipOf(UP), 20, 1, 4) }),
    F(100, { bob: 2, dx: -1, lidN: "dizzy", lidF: "dizzy", spin: 0, mouth: "o", curl: 0.5, sway: -0.5, ...holding([43, 49], 100, 10), paint: "smear", cas: 1 }, { specks: flecks(tipOf(UP), 30, 3, 3) }),
    F(110, { bob: 4, dx: 0, lidN: "dizzy", lidF: "dizzy", spin: 1.5, mouth: "wavy", curl: 0.3, sway: 0.2, ...holding([42, 50], 112, 8), paint: "none", hy: 1, cas: 1 }),
    F(120, { ...SLUMP, spin: 3 }, { cue: "flop", specks: dust(0, 2, 28, 18) }),
    F(140, { ...SLUMP, spin: 4.5 }, { specks: [...dust(1, 2, 28, 18), ...stars(28, 17, 0)] }),
    F(160, { ...SLUMP, spin: 6 }, { specks: stars(28, 17, 1.6) }),
    F(1000, { ...SLUMP, spin: 7.5 }, { specks: stars(28, 17, 3.2) }),
  ],
};

/** Victory: it hops in place, the brush waving over its head and flicking paint, the tail corkscrewing, sparkles. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const air = [0, 2, 4, 5, 4, 2, 0, 0, 0, 0, 0, 0][i]!;
    const wv = i % 2 ? WAVE_M : HIGH;
    const pose: Pose = {
      ...wv,
      air,
      bob: i === 0 || i === 6 ? 2 : 0,
      lidN: "joy",
      lidF: "joy",
      mouth: "grin",
      curl: 0.55 + 0.4 * Math.abs(Math.sin((TAU * i) / 12)),
      sway: 0.4 * Math.sin((TAU * i) / 6),
      swayPhase: (TAU * i) / 6,
      cas: air > 0 ? -1 : 0,
      footN: air > 0 ? { lift: 1 } : {},
      footF: air > 0 ? { lift: 1 } : {},
    };
    return F(110, pose, { cue: i === 2 ? "giggle" : i === 6 ? "thump" : undefined, specks: [...(i === 6 ? dust(0, 2) : i === 7 ? dust(1, 2) : []), ...(i % 3 === 0 ? flecks(tipOf(pose), 30, 2, 3) : []), ...(i % 4 === 1 ? sparkle(14 + (i % 3) * 3, 10) : [])] });
  }),
};

export const sidekickSmudgy: Character = {
  id: "sidekick-smudgy",
  name: "Smudgy's sidekick",
  w: VIEW.w,
  h: VIEW.h,
  foot: [26, GROUND],
  palette: SIDEKICK_PALETTE,
  halo: "#26301f",
  parts: PARTS,
  anims: { idle, walk, sit, wave, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory },
};
