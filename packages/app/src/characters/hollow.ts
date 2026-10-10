/**
 * Hollow, the Darkness boss: a lanky, shaggy creature of charcoal-black fur, after Eric's reference picture, redrawn
 * as an original. The villagers tore him apart; the darkness brought him back and holds him together through the
 * middle, so where his belly was there is a band of violet-black darkness with a void at its heart, slowly swirling.
 * Torn seams across his shoulder, his cheek and his thigh are bound the same way. He carries a long strand of
 * Christmas lights held in the middle, its two halves hanging with five bulbs each (red, gold, blue in turn; Eric's
 * reference), which count down to his next cover of the dark. Glowing gold eyes, a thin violet
 * edge glow (his halo) so he never vanishes on the dark ground. Drawn facing front, light from the top left.
 *
 * Rigging: the head (one per face), ruff, hips and the band of darkness are painted once; the void is painted per
 * swirl phase and size; the arms and legs are painted from their pose's points (a shoulder, an elbow, a hand; a hip, a
 * knee, an ankle) as shaggy strokes; the strand is painted from the hand that holds it. So a new pose is a few numbers.
 *
 * The bulbs have palette keys of their own per colour (main, shade, glint, glow), so a look (`bulbs2`, `bulbs1`,
 * `bulbs0`) puts a colour out (about a third of the strand) without redrawing anything, and their glints are specks in
 * the same keys (an unlit bulb never glints).
 */
import type { LightsOutTarget } from "@chessroyale/core";
import type { Beat } from "./boss-beats.ts";
import { canvas, ellipse, line, poly, toGrid, type Canvas } from "./paint.ts";
import { lazyParts, lieDown, partSize, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "./sprite.ts";

/** The bulbs' keys by colour: [main, shade, glint, glow]; red, gold, blue (bulb `i` on the strand is colour `i % 3`). */
export const BULB_KEYS = [
  ["1", "4", "7", "!"],
  ["2", "5", "8", "^"],
  ["3", "6", "9", "~"],
] as const;
const BULB_LIT: readonly (readonly [string, string, string, string])[] = [
  ["#ff4a4a", "#b3172c", "#ffe0da", "#ff4a4a55"], // red
  ["#ffc93a", "#c2830f", "#fff8d6", "#ffc93a55"], // gold
  ["#4ab3ff", "#1d5fd0", "#e0f4ff", "#4ab3ff55"], // blue
];
/** An unlit bulb: dark glass, no glow. */
const BULB_OFF = ["#2e2a36", "#1d1a23", "#463f52", "#00000000"] as const;

export const HOLLOW_PALETTE: Record<string, string> = {
  k: "#08070c", // outline
  n: "#0f0e13", // deep fur shadow, brows, strands
  d: "#1a1920", // charcoal fur, dark to light
  c: "#27252e",
  C: "#36333e",
  h: "#4b4756",
  v: "#1b1029", // the darkness binding him: violet-black to bright violet
  V: "#30194f",
  u: "#5b36a3",
  U: "#9c6cff",
  x: "#e9ddff",
  o: "#000000", // the void's heart
  O: "#0b0614",
  e: "#ffcf3a", // eyes: a gold glow, its hot core
  E: "#fff5c8",
  m: "#050407", // nose, mouth
  t: "#d3ccbd", // fangs
  y: "#8c8597", // claws
  w: "#3b3844", // the strand's wire and sockets
  W: "#5d5968",
  g: "#f2eeff", // glass shards
  j: "#8fd0ff", // sweat
  z: "#0d0e12", // ground shadow
  ...Object.fromEntries(BULB_KEYS.flatMap((keys, b) => keys.map((k, i) => [k, BULB_LIT[b]![i]!]))),
};

/**
 * His bulbs put out a colour at a time, from the last (`bulbs<n>`: n colours still lit: blue goes out first, then gold,
 * then red, about a third of the strand each, as the strip by the board loses a bulb); the dark stance's look is a
 * frame palette (DARK).
 */
const bulbsOff = (from: number): Record<string, string> => Object.fromEntries(BULB_KEYS.slice(from).flatMap((keys) => keys.map((k, i) => [k, BULB_OFF[i]!])));
export const HOLLOW_LOOKS = { bulbs3: {}, bulbs2: bulbsOff(2), bulbs1: bulbsOff(1), bulbs0: bulbsOff(0) } as const;
/** The look for `n` lit bulbs on the strip (0 to 3): that many thirds of the strand lit. */
export const bulbsLook = (n: number) => `bulbs${Math.max(0, Math.min(3, Math.round(n)))}` as keyof typeof HOLLOW_LOOKS;

type Pt = readonly [number, number];

/** A seeded number in [0, 1) for a pixel: fur texture, the same every time. */
const hash2 = (x: number, y: number, s: number) => (((Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(s, 83492791)) >>> 0) % 10007) / 10007;
/** A triangle wave peaking at the middle of each unit: fur tufts round an edge. */
const tri = (u: number) => 1 - Math.abs(2 * (u - Math.floor(u)) - 1);

/** Light from the top left on fur, by the surface's normal (nx, ny in -1..1), banded into the fur ramp. */
const FUR = "dcCh";
const furKey = (light: number) => FUR[Math.max(0, Math.min(3, Math.floor(light * 4)))]!;

/** Strands of darker fur, seeded: short vertical streaks (one pixel and the one below it). */
function strands(cv: Canvas, seed: number, every = 0.11): void {
  const src = cv.map((r) => [...r]);
  for (let y = 0; y < cv.length; y++)
    for (let x = 0; x < cv[0]!.length; x++) {
      const k = src[y]![x]!;
      if (!FUR.includes(k) || k === "d") continue;
      if (hash2(x, y, seed) < every) {
        cv[y]![x] = FUR[FUR.indexOf(k) - 1]!;
        if (src[y + 1]?.[x] && FUR.includes(src[y + 1]![x]!) && src[y + 1]![x] !== "d") cv[y + 1]![x] = FUR[FUR.indexOf(src[y + 1]![x]!) - 1]!;
      }
    }
}

/** A seam of darkness across the fur (a tear bound shut): a jagged violet-black line, glinting violet. */
function seam(cv: Canvas, pts: readonly Pt[]): void {
  const lines = canvas(cv[0]!.length, cv.length);
  pts.forEach((p, i) => i > 0 && line(lines, pts[i - 1]![0], pts[i - 1]![1], p[0], p[1], "v"));
  let n = 0;
  lines.forEach((row, y) =>
    row.forEach((k, x) => {
      if (k !== "v" || cv[y]![x] === ".") return;
      cv[y]![x] = n++ % 3 === 1 ? "u" : "v";
      // The torn fur either side of it, darker.
      for (const [dx, dy] of [[0, -1], [0, 1]] as const) if (FUR.includes(cv[y + dy]?.[x + dx] ?? ".")) cv[y + dy]![x + dx] = "n";
    }),
  );
}

// ---- The head: a shaggy round face with flared cheek tufts and a tuft on top, one per face.

export type Mood = "grim" | "sneer" | "laugh" | "roar" | "hurt" | "rattled" | "think" | "out" | "dark";

/** The left eye (the right is its mirror) and brow, rows of keys, in the head's grid; 5 wide. */
const EYES: Record<string, readonly string[]> = {
  grim: ["nn....", ".nnnn.", ".eEEen", "..eeen"],
  sneer: ["......", "nnnnnn", ".eEEEn", "..nnnn"],
  high: ["nnnn..", "....n.", ".eEEe.", "..eee."],
  wide: [".nnnn.", "n....n", ".eEEe.", ".eEEe."],
  squint: ["nn....", ".nnnn.", ".eeeen", "..nnnn"],
  shut: ["......", "nnnn..", "..nnnn", "......"],
  look: ["nnnnn.", "......", ".mmeEe", "..mee."],
  x: ["......", ".m..m.", "..mm..", ".m..m."],
  slit: ["nn....", ".nnnn.", ".eEEen", "..nnnn"],
};
const MOUTHS: Record<string, readonly string[]> = {
  frown: [".mmmmmm.", "m......m"],
  sneer: [".....mm.", "mmmmm..."],
  laugh: ["mmmmmmmm", "mtmmmmtm", ".mmmmmm."],
  roar: [".mmmmmm.", "mtmmmmtm", "mmmmmmmm", ".mtmmtm."],
  o: [".mm.", "m..m", ".mm."],
  wavy: ["mm..mm..", "..mm..mm"],
  flat: [".mmmmmm."],
  none: [],
};
const FACES: Record<Mood, { eyes: string; right?: string; mouth: string }> = {
  grim: { eyes: "grim", mouth: "frown" },
  sneer: { eyes: "sneer", right: "high", mouth: "sneer" },
  laugh: { eyes: "squint", mouth: "laugh" },
  roar: { eyes: "grim", mouth: "roar" },
  hurt: { eyes: "shut", mouth: "o" },
  rattled: { eyes: "wide", mouth: "wavy" },
  think: { eyes: "look", mouth: "flat" },
  out: { eyes: "x", mouth: "wavy" },
  dark: { eyes: "slit", mouth: "none" },
};

function stamp(cv: Canvas, rows: readonly string[], x0: number, y0: number, mirror = false): void {
  rows.forEach((row, y) =>
    [...row].forEach((k, i) => {
      if (k === ".") return;
      const x = mirror ? x0 + row.length - 1 - i : x0 + i;
      if (cv[y0 + y]?.[x] !== undefined && cv[y0 + y]![x] !== ".") cv[y0 + y]![x] = k;
    }),
  );
}

const HEAD_W = 36;
const HEAD_H = 30;
/** The face's middle in its own grid. */
const HC: Pt = [18, 17];

/** Fur spikes round the face, as triangles [base, base, tip]: cheek tufts flaring out at the jaw, a wild tuft on top. */
const HEAD_SPIKES: readonly (readonly [Pt, Pt, Pt])[] = [
  // Cheeks (our right; the left mirrors them).
  [[26, 13], [27.5, 18], [33.5, 15.5]],
  [[26.5, 17], [27, 22], [34.5, 21]],
  [[25, 20.5], [24.5, 25], [31.5, 26.5]],
  // The tuft on top, leaning to our right.
  [[12, 12.5], [15, 10.5], [10.5, 6.5]],
  [[15, 10], [19, 9], [16.5, 2]],
  [[18, 9.5], [22, 10], [23.5, 0.5]],
  [[21, 10.5], [24.5, 12.5], [29, 5]],
  // The chin's beard.
  [[15.5, 25], [20.5, 25], [18, 29]],
];
const mirrorX = ([x, y]: Pt): Pt => [36 - x, y];
/** Inside the head's shaggy outline: a round face, the spikes, little tufts all round. */
const inHead = (() => {
  const cv = canvas(HEAD_W, HEAD_H);
  for (let y = 0; y < HEAD_H; y++)
    for (let x = 0; x < HEAD_W; x++) {
      const dx = (x + 0.5 - HC[0]) / 9.6;
      const dy = (y + 0.5 - HC[1]) / 8.8;
      const a = Math.atan2(dy, dx);
      if (Math.hypot(dx, dy) <= 1 + 0.07 * tri((a / (2 * Math.PI)) * 26) ** 1.4) cv[y]![x] = "#";
    }
  HEAD_SPIKES.forEach((t, i) => {
    poly(cv, t, "#");
    if (i < 3) poly(cv, t.map(mirrorX), "#");
  });
  return (x: number, y: number) => cv[y]?.[x] === "#";
})();

function head(mood: Mood): Part {
  const cv = canvas(HEAD_W, HEAD_H);
  for (let y = 0; y < HEAD_H; y++)
    for (let x = 0; x < HEAD_W; x++) {
      if (!inHead(x, y)) continue;
      const nx = (x + 0.5 - HC[0]) / 12;
      const ny = (y + 0.5 - HC[1]) / 11;
      cv[y]![x] = furKey(0.56 - 0.38 * nx - 0.5 * ny);
    }
  strands(cv, 11, 0.12);
  // The muzzle: a lighter patch round the nose and mouth.
  for (let y = 19; y < 26; y++) for (let x = 12; x < 24; x++) if (cv[y]![x] !== "." && ((x + 0.5 - 18) / 5.2) ** 2 + ((y + 0.5 - 22) / 3.4) ** 2 <= 1) cv[y]![x] = y < 22 ? "C" : "c";
  // A torn cheek, bound by the dark.
  seam(cv, [[27, 17], [29, 19], [28, 21], [30, 23]]);
  const f = FACES[mood];
  stamp(cv, EYES[f.eyes]!, 11, 13);
  stamp(cv, EYES[f.right ?? f.eyes]!, 19, 13, true);
  // The nose.
  stamp(cv, ["mm", "mm"], 17, 19);
  const mouth = MOUTHS[f.mouth]!;
  if (mouth.length) stamp(cv, mouth, 18 - Math.floor(mouth[0]!.length / 2), 23);
  return { grid: toGrid(cv) };
}

// ---- The body: a fluffy ruff, the band of darkness (and its void), the hips.

const RUFF_W = 32;
const RUFF_H = 11;
const ruff = (): Part => {
  const cv = canvas(RUFF_W, RUFF_H);
  for (let y = 0; y < RUFF_H; y++)
    for (let x = 0; x < RUFF_W; x++) {
      const u = (x + 0.5) / RUFF_W; // 0 to 1 across
      const side = Math.abs(u - 0.5) * 2; // 0 in the middle, 1 at the shoulders' tips
      // Narrow at the neck, the shoulders sloping out in spiky tufts; the bottom edge torn into spikes.
      const top = 1 + side * 3 - 1.5 * tri(u * 11) ** 2;
      const bottom = 9.5 - side * side * 4.5 + 1.5 * tri(u * 8 + 0.5) ** 1.4;
      const reach = 0.86 + 0.14 * tri(y * 0.45 + 0.2) ** 1.5;
      if (y + 0.5 < top || y + 0.5 > bottom || side > reach) continue;
      const nx = u * 2 - 1;
      const ny = ((y + 0.5 - top) / Math.max(1, bottom - top)) * 2 - 1;
      cv[y]![x] = furKey(0.62 - 0.38 * nx - 0.42 * ny);
    }
  strands(cv, 23, 0.14);
  // A torn shoulder (his left, our right), bound by the dark.
  seam(cv, [[22, 3], [24, 5], [26, 4], [28, 6]]);
  return { grid: toGrid(cv) };
};

const BAND_W = 20;
const BAND_H = 12;
/** The darkness between his ruff and his hips: violet-black smoke, ragged, slowly churning (`phase`). */
function band(phase: number): Part {
  const cv = canvas(BAND_W, BAND_H);
  for (let y = 0; y < BAND_H; y++)
    for (let x = 0; x < BAND_W; x++) {
      const u = (x + 0.5) / BAND_W;
      // Narrower than the fur at its waist, wisps reaching out at the sides.
      const half = 0.4 + 0.08 * Math.cos(((y + 0.5) / BAND_H) * Math.PI * 2) + 0.07 * tri(y * 0.37 + phase * 0.25);
      if (Math.abs(u - 0.5) > half) continue;
      const swirl = Math.sin(x * 0.7 + y * 0.45 - phase * 0.8) + Math.sin(x * 0.31 - y * 0.9 + phase * 0.55);
      cv[y]![x] = swirl > 1.1 ? "u" : swirl > 0.1 ? "V" : "v";
    }
  return { grid: toGrid(cv) };
}

/**
 * The void at his heart: a black core in a dark rim, two spiral arms of violet turning round it (`phase` 0-7), and a
 * thin tilted ring round it all. `size` 0 at rest, 1 flaring, 2 at its widest (casting, the test's pulse).
 */
function voidPart(phase: number, size: 0 | 1 | 2): Part {
  const W = 26;
  const H = 18;
  const cv = canvas(W, H);
  const cx = W / 2;
  const cy = H / 2;
  const core = [3.6, 4.1, 4.8][size]!;
  const rim = core + [1.9, 2.4, 3]![size]!;
  const turn = (phase / 8) * Math.PI * 2;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx;
      const dy = (y + 0.5 - cy) * 1.15;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      // The tilted orbit ring (an ellipse round the void).
      const ex = dx / (rim + 5);
      const ey = (y + 0.5 - cy) / ((rim + 5) * 0.32);
      const ringD = Math.abs(Math.hypot(ex, ey) - 1);
      if (r <= core) cv[y]![x] = r <= core - 1.4 ? "o" : "O";
      else if (r <= rim) {
        // Two spiral arms, turning.
        const arm = Math.sin(2 * (a - turn) + r * 1.15);
        cv[y]![x] = arm > 0.55 ? (size === 2 ? "U" : "u") : arm > -0.2 ? "V" : "O";
      } else if (ringD < 0.09 && (y + 0.5 > cy || r > rim + 2)) cv[y]![x] = Math.cos(a * 3 - turn * 2) > 0.3 ? "U" : "u";
    }
  // Glints riding the ring.
  for (let i = 0; i < 2; i++) {
    const a = turn * 1.0 + i * Math.PI;
    const px = Math.round(cx - 0.5 + Math.cos(a) * (rim + 5));
    const py = Math.round(cy - 0.5 + Math.sin(a) * (rim + 5) * 0.32);
    if (cv[py]?.[px] !== undefined) cv[py]![px] = "x";
  }
  return { grid: toGrid(cv), outline: false };
}

const HIPS_W = 20;
const HIPS_H = 8;
const hips = (): Part => {
  const cv = canvas(HIPS_W, HIPS_H);
  for (let y = 0; y < HIPS_H; y++)
    for (let x = 0; x < HIPS_W; x++) {
      const u = (x + 0.5) / HIPS_W;
      // The top edge torn into spikes (held by the dark above), the bottom a shaggy curve between the legs.
      const top = 3.2 - 2.6 * tri(u * 7 + 0.5) ** 1.6 + (u < 0.12 || u > 0.88 ? 2.4 : 0);
      const bottom = 7.8 - (Math.abs(u - 0.5) < 0.12 ? 2.2 : 0) - 0.8 * tri(u * 11) ** 2;
      if (y + 0.5 < top || y + 0.5 > bottom) continue;
      cv[y]![x] = furKey(0.52 - 0.4 * (u * 2 - 1) - 0.35 * ((y + 0.5) / HIPS_H - 0.4));
    }
  strands(cv, 31, 0.14);
  return { grid: toGrid(cv) };
};

const shadow = (): Part => {
  const cv = canvas(36, 3);
  ellipse(cv, 18, 1.5, 18, 1.5, "z");
  return { grid: toGrid(cv), outline: false };
};

// ---- Limbs: shaggy strokes along a few points, round-shaded, with tufts sticking out along their edges.

interface Painted {
  part: Part;
  /** The part's top-left in his drawing space. */
  at: Pt;
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

/**
 * A limb along `pts`, `r` thick, shaggy (tufts jut out along it), the end a little rounder; for an arm, `claws`
 * reach on from the hand along the last segment (spread), a foot's toes along the ground.
 */
/** The box a limb is painted in (its top-left in his drawing space, its size). */
function limbBox(pts: readonly Pt[], r: number, endR: number): { x0: number; y0: number; w: number; h: number } {
  const pad = Math.ceil(Math.max(r, endR)) + 5;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs)) - pad;
  const y0 = Math.floor(Math.min(...ys)) - pad;
  return { x0, y0, w: Math.ceil(Math.max(...xs)) + pad - x0 + 1, h: Math.ceil(Math.max(...ys)) + pad - y0 + 1 };
}

function paintLimb(pts: readonly Pt[], r: number, o: { endR?: number; claws?: "open" | "grip" | "point" | "none"; seed?: number; seamAt?: number } = {}): Painted {
  const endR = o.endR ?? r;
  const { x0, y0, w, h } = limbBox(pts, r, endR);
  const cv = canvas(w, h);
  const end = pts[pts.length - 1]!;
  const segLen = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]));
  const seed = o.seed ?? 1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p: Pt = [x0 + x + 0.5, y0 + y + 0.5];
      let best = { d: Infinity, nx: 0, ny: 0, along: 0 };
      for (let i = 0; i + 1 < pts.length; i++) {
        const n = nearest(p, pts[i]!, pts[i + 1]!);
        if (n.d < best.d) best = { d: n.d, nx: n.nx, ny: n.ny, along: segLen.slice(0, i).reduce((s, l) => s + l, 0) + n.t * segLen[i]! };
      }
      // Tufts: the edge juts out in little spikes along the limb, more on the outer (shadow) side.
      const side = best.nx * 0.6 + best.ny * 0.8 > 0 ? 1 : 0;
      const tuft = 1.25 * tri(best.along / 2.6 + side * 0.5 + seed * 0.37) ** 2.2;
      const de = Math.hypot(p[0] - end[0], p[1] - end[1]);
      const inLimb = best.d <= r + tuft;
      const inEnd = de <= endR;
      if (!inLimb && !inEnd) continue;
      const [nx, ny, rr] = inEnd && de < best.d + 0.8 ? [p[0] - end[0], p[1] - end[1], endR] : [best.nx, best.ny, r + 1];
      cv[y]![x] = furKey(0.6 - 0.42 * (nx / rr) - 0.48 * (ny / rr));
      if (o.seamAt !== undefined && Math.abs(best.along - o.seamAt - (best.nx > 0 ? 0.6 : -0.6)) < 0.6 && best.d <= r) cv[y]![x] = Math.round(best.d * 3) % 3 === 1 ? "u" : "v";
    }
  strands(cv, seed * 7 + 3, 0.13);
  // Claws: thin pale lines on from the hand, in the direction of the last segment.
  if (o.claws && o.claws !== "none") {
    const a = pts[pts.length - 2]!;
    const dir = Math.atan2(end[1] - a[1], end[0] - a[0]);
    const spread = o.claws === "open" ? [-0.55, 0, 0.55] : o.claws === "point" ? [0] : [-0.9, 0.9];
    const len = o.claws === "grip" ? 2 : o.claws === "point" ? 4 : 3;
    for (const s of spread) {
      const sx = end[0] + Math.cos(dir + s) * (endR - 0.4);
      const sy = end[1] + Math.sin(dir + s) * (endR - 0.4);
      for (let t = 1; t <= len; t++) {
        const px = Math.round(sx + Math.cos(dir + s * (o.claws === "grip" ? 1.6 : 1)) * t) - x0;
        const py = Math.round(sy + Math.sin(dir + s * (o.claws === "grip" ? 1.6 : 1)) * t) - y0;
        if (cv[py]?.[px] !== undefined) cv[py]![px] = t === len ? "y" : "n";
      }
    }
  }
  return { part: { grid: toGrid(cv) }, at: [x0, y0] };
}

/** A big flat foot with three clawed toes, pointing out (`dir` -1 to our left, 1 to our right). */
function foot(dir: 1 | -1): Part {
  const rows = ["...cCCc...", "..cCCCCcc.", ".cCccccCcc", "dcccdcccdc", "y.dy.dy.dy"];
  return { grid: dir === 1 ? rows : rows.map((r) => [...r].reverse().join("")) };
}

// ---- The strand of lights: a long wire held in the middle, its two halves hanging, five bulbs on each.

/** Bulbs on the strand, numbered along the wire: the inner half from its end up to his hand (0-4), then the outer half
 * from his hand down to its end (5-9). Bulb `i` is colour `i % 3`. */
export const BULBS = 10;
const PER_HALF = BULBS / 2;
/** Where the bulbs sit along each half, from the hand (0) to the end (1). */
const ALONG = [0.27, 0.45, 0.63, 0.81, 0.98] as const;
/** Lights out smashes the strand in three strikes, a section at a time: the inner half's low end, the middle by his
 * hand, the outer half's low end. */
export const STRAND_SECTIONS: readonly (readonly number[])[] = [
  [0, 1, 2],
  [3, 4, 5, 6],
  [7, 8, 9],
];
const ALL_BULBS: readonly number[] = Array.from({ length: BULBS }, (_, i) => i);
/** A bulb's colour keys. */
const keysOf = (i: number) => BULB_KEYS[i % 3]!;

/** A bulb, 4 x 5: a socket on top, glass pointing down; in colour `c`'s keys. */
const bulbRows = (c: number): string[] => {
  const [M, S, G] = BULB_KEYS[c]!;
  return [".WW.", ".ww.", `${G}${M}${M}${S}`, `${M}${M}${M}${S}`, `.${M}${S}.`];
};
/** A smashed bulb: the socket and a few jagged teeth of glass left. */
const brokenRows = (c: number): string[] => {
  const [, S] = BULB_KEYS[c]!;
  return [".WW.", ".ww.", `${S}.${S}${S}`, `.${S}..`];
};

export interface StrandSpec {
  /** Where the hand holds its middle (drawing space). */
  hand: Pt;
  /** Where each half's end hangs, from the hand: the inner half (nearer him), then the outer. */
  ends?: readonly [Pt, Pt];
  /** How far each half bows sideways at its middle. */
  bows?: readonly [number, number];
  /** Bulbs smashed (by number). */
  broken?: readonly number[];
  /** Only this much of it is out (0-1): the fresh strand spilling out of the void. */
  out?: number;
}

/** The strand's wire (with its bulbs on it, one part) and the glow round its lit bulbs (another, behind). */
function strand(s: StrandSpec): { wire: { name: string; at: Pt }; glow: { name: string; at: Pt }; bulbs: Pt[] } {
  const ends = s.ends ?? [[-2, 23], [11, 20]];
  const bows = s.bows ?? [-2, 3];
  const out = s.out ?? 1;
  const key = `strand:${s.hand.join(",")}:${ends.map((e) => e.join(",")).join(";")}:${bows.join(",")}:${(s.broken ?? []).join(".")}:${out}`;
  const [hx, hy] = s.hand;
  // Each half a quadratic curve from the hand to its end, bowing sideways at its middle.
  const along = (h: 0 | 1, t: number): Pt => {
    const [ex, ey] = [hx + ends[h][0], hy + ends[h][1]];
    const mx = (hx + ex) / 2 + bows[h];
    const my = (hy + ey) / 2;
    return [(1 - t) ** 2 * hx + 2 * (1 - t) * t * mx + t * t * ex, (1 - t) ** 2 * hy + 2 * (1 - t) * t * my + t * t * ey];
  };
  const x0 = Math.floor(Math.min(hx, hx + ends[0][0], hx + ends[1][0]) - 8);
  const y0 = Math.floor(hy - 4);
  // Where each bulb hangs (its socket's top-left), in drawing space, and the wire point it hangs from: the bulbs
  // alternate either side of the wire on short stems, as in Eric's reference.
  const spots: { at: Pt; wire: Pt; i: number }[] = [];
  for (let i = 0; i < BULBS; i++) {
    const h = i < PER_HALF ? 0 : 1;
    const t = ALONG[h === 0 ? PER_HALF - 1 - i : i - PER_HALF]!;
    if (t > out + 0.02) continue;
    const w = along(h, t);
    // (Either side of a steep half, a little either side of a shallow one.)
    const side = (i % 2 === 0 ? -1 : 1) * (Math.abs(ends[h][0]) < ends[h][1] / 2 ? 2 : 1);
    spots.push({ i, wire: [Math.round(w[0]), Math.round(w[1])], at: [Math.round(w[0]) - 1 + side, Math.round(w[1]) + 1] });
  }
  const bulbs: Pt[] = Array.from({ length: BULBS }, (_, i) => spots.find((sp) => sp.i === i)?.at).filter((b): b is Pt => !!b);
  const paint = () => {
    const cv = canvas(48, 46);
    const glow = canvas(48, 46);
    for (const h of [0, 1] as const) {
      let prev: Pt | null = null;
      for (let t = 0; t <= out + 1e-9; t += 0.02) {
        const p = along(h, t);
        const q: Pt = [Math.round(p[0] - x0), Math.round(p[1] - y0)];
        if (prev) line(cv, prev[0], prev[1], q[0], q[1], "w");
        prev = q;
      }
    }
    for (const { at: [X, Y], wire: [wx, wy], i } of spots) {
      const [bx, by] = [X - x0, Y - y0];
      const c = i % 3;
      const lit = !(s.broken ?? []).includes(i);
      // The stem from the wire to the socket.
      line(cv, wx - x0, wy - y0, bx + (i % 2 === 0 ? 2 : 1), by, "w");
      const rows = lit ? bulbRows(c) : brokenRows(c);
      // A little light round a lit bulb: its glass's colour, see-through, either side of it.
      if (lit) for (const [gx, gy] of [[-1, 3], [4, 3], [-1, 4], [4, 4], [1, 6], [2, 6]] as const) glow[by + gy] && (glow[by + gy]![bx + gx] = BULB_KEYS[c]![3]);
      rows.forEach((row, y) => [...row].forEach((k, x) => k !== "." && cv[by + y] && (cv[by + y]![bx + x] = k)));
    }
    return { wire: { grid: toGrid(cv) } as Part, glow: { grid: toGrid(glow), outline: false } as Part };
  };
  let painted: ReturnType<typeof paint> | null = null;
  add(key, () => (painted ??= paint()).wire);
  add(`glow:${key}`, () => (painted ??= paint()).glow);
  return { wire: { name: key, at: [x0, y0] }, glow: { name: `glow:${key}`, at: [x0, y0] }, bulbs };
}

// ---- Parts and poses.

// Every part is painted the first time a frame that uses it shows (sprite.ts lazyParts), so he costs nothing at load.
const { parts: PARTS, add } = lazyParts();
add("ruff", ruff);
add("hips", hips);
add("shadow", shadow);
add("footL", () => foot(-1));
add("footR", () => foot(1));
const MOODS: readonly Mood[] = ["grim", "sneer", "laugh", "roar", "hurt", "rattled", "think", "out", "dark"];
for (const m of MOODS) add(`head:${m}`, () => head(m));
for (let p = 0; p < 8; p++) {
  add(`band:${p}`, () => band(p));
  for (const s of [0, 1, 2] as const) add(`void:${p}:${s}`, () => voidPart(p, s));
}

function limb(kind: "arm" | "leg", pts: readonly Pt[], claws: "open" | "grip" | "point" | "none" = "none", seed = 1): { name: string; at: Pt } {
  const name = `${kind}:${pts.map((p) => p.join(",")).join(";")}:${claws}:${seed}`;
  const [r, endR] = kind === "arm" ? [1.5, 2.3] : [1.9, 2.1];
  add(name, () => (kind === "arm" ? paintLimb(pts, r, { endR, claws, seed }) : paintLimb(pts, r, { endR, seed, seamAt: seed === 2 ? 4 : undefined })).part);
  const box = limbBox(pts, r, endR);
  return { name, at: [box.x0, box.y0] };
}

const SHOULDER_L: Pt = [20, 25];
const SHOULDER_R: Pt = [44, 25];

/** His free arm (his right, on our left). */
export type FreeArm = "hang" | "chin" | "up" | "claw" | "wind" | "flick" | "fist" | "grab" | "out" | "hip";
const FREE: Record<FreeArm, { pts: Pt[]; claws: "open" | "grip" | "point"; front?: boolean }> = {
  hang: { pts: [SHOULDER_L, [15, 36], [14, 47]], claws: "open" },
  chin: { pts: [SHOULDER_L, [16, 37], [26, 28]], claws: "grip", front: true },
  up: { pts: [SHOULDER_L, [12, 16], [14, 6]], claws: "open" },
  claw: { pts: [SHOULDER_L, [10, 27], [8, 18]], claws: "open" },
  wind: { pts: [SHOULDER_L, [11, 31], [6, 24]], claws: "open" },
  flick: { pts: [SHOULDER_L, [28, 33], [44, 31]], claws: "point", front: true },
  fist: { pts: [SHOULDER_L, [12, 18], [16, 10]], claws: "grip" },
  /** Reaching across to his strand (crushing a bulb, catching a fresh strand). */
  grab: { pts: [SHOULDER_L, [28, 34], [46, 28]], claws: "grip", front: true },
  out: { pts: [SHOULDER_L, [10, 31], [6, 38]], claws: "open" },
  hip: { pts: [SHOULDER_L, [13, 33], [21, 41]], claws: "grip" },
};

/** The arm that holds the strand (his left, on our right). */
export type StrandArm = "hold" | "high" | "swing" | "low" | "up";
/** The lowest the strand's ends hang (drawing space): its last bulb just above the ground. */
const STRAND_LOWEST = 62;
/** Each arm pose, and where the strand's two halves hang from his hand (see StrandSpec). */
const STRAND_ARM: Record<StrandArm, { pts: Pt[]; ends: [Pt, Pt]; bows: [number, number] }> = {
  hold: { pts: [SHOULDER_R, [50, 32], [52, 40]], ends: [[-5, 22], [9, 20]], bows: [-2, 4] },
  low: { pts: [SHOULDER_R, [49, 34], [50, 43]], ends: [[-5, 19], [9, 18]], bows: [-2, 4] },
  swing: { pts: [SHOULDER_R, [52, 28], [58, 26]], ends: [[-4, 24], [7, 22]], bows: [-2, 4] },
  high: { pts: [SHOULDER_R, [52, 21], [51, 11]], ends: [[-4, 24], [9, 21]], bows: [-2, 4] },
  /** Held up in front of him, to smash its bulbs. */
  up: { pts: [SHOULDER_R, [52, 26], [47, 19]], ends: [[-4, 23], [7, 23]], bows: [-3, 4] },
};

export type Feet = "stand" | "wide" | "step" | "tap" | "crouch";
const FEET: Record<Feet, [Pt, Pt]> = {
  stand: [[25, 63], [39, 63]],
  wide: [[22, 63], [42, 63]],
  step: [[25, 63], [42, 60]],
  tap: [[25, 63], [40, 61]],
  crouch: [[21, 63], [43, 63]],
};

/** Where his own drawing space (64 x 66, the ground at y 66) sits on the frame. */
const OX = 18;
const OY = 30;
const GROUND = 66;
/** The void's middle in his drawing space, at rest. */
const VOID: Pt = [32, 35];
/** The void's middle on the frame, at rest. */
const AT_HEART: Pt = [OX + VOID[0], OY + VOID[1]];

export interface HollowPose {
  air?: number;
  crouch?: number;
  bob?: number;
  dx?: number;
  mood?: Mood;
  headDx?: number;
  headDy?: number;
  free?: FreeArm;
  /** His free claw reaching to this point instead (drawing space): crushing a section of the strand. */
  reach?: Pt;
  arm?: StrandArm;
  feet?: Feet;
  /** The void's swirl (0-7) and size (0 at rest, 1 flaring, 2 widest). */
  phase?: number;
  size?: 0 | 1 | 2;
  /** The strand's sway: its ends swing by this many pixels. */
  sway?: number;
  /** Smashed bulbs; or no strand at all (`false`). */
  broken?: readonly number[];
  strand?: boolean | StrandSpec;
}

export interface Built {
  layers: Layer[];
  /** Where the bulbs hang (frame pixels), first to last, for glints and sparks. */
  bulbs: Pt[];
  /** The void's middle (frame pixels). */
  heart: Pt;
}

export function hollowBuild(p: HollowPose): Built {
  const dx = p.dx ?? 0;
  const air = p.air ?? 0;
  const crouch = p.crouch ?? 0;
  const body = crouch + (p.bob ?? 0) - air;
  const hipsY = crouch - air;
  const at = (part: string, x: number, y: number): Layer => ({ part, x: OX + x + dx, y: OY + y });
  const down = (pts: readonly Pt[], by = body): Pt[] => pts.map((q, i): Pt => [q[0], q[1] + (i === 0 ? body : by)]);
  const L = (l: { name: string; at: Pt }) => at(l.name, l.at[0], l.at[1]);
  const feet = FEET[p.feet ?? (crouch >= 3 ? "crouch" : "stand")];
  const knee = (hip: Pt, ft: Pt, out: number): Pt => [(hip[0] + ft[0]) / 2 + out, (hip[1] + ft[1]) / 2 + Math.max(0, crouch - 1)];
  const hipL: Pt = [27, 45 + hipsY];
  const hipR: Pt = [37, 45 + hipsY];
  const footL: Pt = [feet[0][0], feet[0][1] - air];
  const footR: Pt = [feet[1][0], feet[1][1] - air];
  const legL = limb("leg", [hipL, knee(hipL, footL, -1.5 - crouch * 0.6), footL], "none", 2);
  const legR = limb("leg", [hipR, knee(hipR, footR, 1.5 + crouch * 0.6), footR], "none", 3);
  const fr = p.reach ? { pts: [SHOULDER_L, [(SHOULDER_L[0] + p.reach[0]) / 2, Math.max(SHOULDER_L[1], p.reach[1]) + 7] as Pt, p.reach], claws: "grip" as const, front: true } : FREE[p.free ?? "hang"];
  const armF = limb("arm", down(fr.pts), fr.claws, 4);
  const sa = STRAND_ARM[p.arm ?? "hold"];
  const armS = limb("arm", down(sa.pts), "grip", 5);
  const hand = down(sa.pts).at(-1)!;
  const phase = ((p.phase ?? 0) % 8 + 8) % 8;
  const size = p.size ?? 0;
  const heart: Pt = [OX + VOID[0] + dx, OY + VOID[1] + body];
  const layers: Layer[] = [at("shadow", 14, GROUND - 2)];
  let bulbs: Pt[] = [];
  const sway = p.sway ?? 0;
  const strandSpec: StrandSpec | null =
    p.strand === false
      ? null
      : typeof p.strand === "object"
        ? p.strand
        : {
            hand: [hand[0] + 1, hand[1] + 1],
            // (Crouching, its ends rest on the ground and slide outward a little.)
            ends: sa.ends.map(([x, y], h): Pt => {
              const lift = Math.max(0, hand[1] + 1 + y - STRAND_LOWEST);
              return [x + sway + (h ? lift : -lift), y - lift];
            }) as [Pt, Pt],
            bows: [sa.bows[0] + Math.round(sway / 2), sa.bows[1] + Math.round(sway / 2)],
            broken: p.broken,
          };
  let strandLayers: Layer[] = [];
  if (strandSpec) {
    const s = strand(strandSpec);
    strandLayers = [L(s.glow), L(s.wire)];
    bulbs = s.bulbs.map((b): Pt => [OX + b[0] + dx, OY + b[1]]);
  }
  layers.push(L(legL), L(legR), at("footL", footL[0] - 8, footL[1] - 2), at("footR", footR[0] - 1, footR[1] - 2));
  layers.push(at("hips", 22, 40 + hipsY), at(`band:${phase}`, 22, 29 + Math.round((body + hipsY) / 2)));
  if (!fr.front) layers.push(L(armF));
  layers.push(L(armS));
  layers.push(at("ruff", 16, 20 + body));
  layers.push(at(`void:${phase}:${size}`, VOID[0] - 13, VOID[1] - 9 + body));
  layers.push(at(`head:${p.mood ?? "grim"}`, 14 + (p.headDx ?? 0), -7 + body + (p.headDy ?? 0)));
  layers.push(...strandLayers);
  if (fr.front) layers.push(L(armF));
  return { layers, bulbs, heart };
}

const build = hollowBuild;
const f = (ms: number, p: HollowPose, extra: Partial<Frame> = {}): Frame => ({ ms, layers: build(p).layers, ...extra });

// ---- Things drawn on his frames: glints, wisps, sparks.

/** A glint on a bulb (in its own glint key: an unlit bulb shows nothing). */
const bulbGlint = (p: HollowPose, b: number, big = false): Speck[] => {
  const at = build(p).bulbs[b];
  if (!at) return [];
  const g = keysOf(b)[2];
  const [x, y] = [at[0] + 1, at[1] + 2];
  return [[x, y, g], ...(big ? ([[x - 1, y, g], [x, y - 1, g], [x + 1, y + 1, g]] as Speck[]) : [])];
};
/** Wisps of darkness curling up off him (`t` frames in), from `n` points round `at`. */
const wisps = ([x, y]: Pt, t: number, n = 4, spread = 10): Speck[] =>
  Array.from({ length: n }, (_, i): Speck[] => {
    const px = Math.round(x + Math.sin(i * 2.1 + t * 0.6) * spread * (0.4 + (i % 3) * 0.3));
    const py = Math.round(y - ((t * 2 + i * 5) % 14));
    return [[px, py, i % 2 ? "V" : "u"], [px + (i % 2 ? 1 : -1), py - 1, "v"]];
  }).flat();
/** A violet four-point sparkle. */
const sparkle = (x: number, y: number, big = false): Speck[] => [
  [x, y, "x"],
  [x - 1, y, "U"],
  [x + 1, y, "U"],
  [x, y - 1, "U"],
  [x, y + 1, "U"],
  ...(big ? ([[x - 2, y, "u"], [x + 2, y, "u"], [x, y - 2, "u"], [x, y + 2, "u"]] as Speck[]) : []),
];
/** Darkness gathering into the void: specks spiralling in (`t` 0 to 1). */
const gather = ([x, y]: Pt, t: number, n = 10): Speck[] =>
  Array.from({ length: n }, (_, i): Speck => {
    const a = (i / n) * Math.PI * 2 + t * 3;
    const r = 18 * (1 - t) + 4;
    return [Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.7), i % 3 === 0 ? "U" : i % 2 ? "u" : "V"];
  });
/** A gush of darkness pouring out of the void to our right (towards the board), `t` frames in. */
const pour = ([x, y]: Pt, t: number): Speck[] => {
  const out: Speck[] = [];
  for (let i = 0; i < 26; i++) {
    const d = i * 1.3 + t * 5;
    if (d > 44 || x + d > OX + 64 + 20) continue;
    const wob = Math.round(Math.sin(i * 0.9 + t) * (1 + d * 0.06));
    const k = i % 5 === 0 ? "U" : i % 2 ? "v" : "V";
    out.push([Math.round(x + d), y + wob, k], [Math.round(x + d), y + wob + 1, "v"]);
    if (i % 3 === 0) out.push([Math.round(x + d), y + wob - 1, "u"]);
  }
  return out;
};
/** Glass flying off a bulb as it's smashed (`t` frames after), with violet-white sparks. */
const shards = ([x, y]: Pt, t: number, b: number): Speck[] =>
  [[-1.4, -1.2], [1.3, -1.5], [1.8, 0.2], [-1.7, 0.4], [0.3, -2], [-0.6, 1.1]].flatMap(([vx, vy], i): Speck[] => {
    const px = Math.round(x + 1 + vx! * (2 + t * 2.4));
    const py = Math.round(y + 3 + vy! * (2 + t * 2.4) + 0.4 * t * t);
    return [[px, py, i % 2 ? "g" : keysOf(b)[0]]];
  });
/** Tufts of fur knocked off him (`t` frames after a hit). */
const tufts = (t: number, [x, y]: Pt = [OX + 32, OY + 6]): Speck[] =>
  [[-1, -1.2], [1.2, -1.4], [1.6, -0.4], [-1.7, -0.3]].flatMap(([vx, vy], i): Speck[] => {
    const px = Math.round(x + vx! * t * 2.4);
    const py = Math.round(y + vy! * t * 2.4 + 0.5 * t * t);
    return [[px, py, i % 2 ? "C" : "c"], [px + 1, py, "d"]];
  });
/** His drop shadow growing on the ground as he comes down from above (`r` its half-width). */
const dropShadow = (r: number): Speck[] => {
  const out: Speck[] = [];
  for (let x = -r; x <= r; x++) for (let y = -1; y <= 0; y++) if (Math.abs(x) < r - (y === -1 ? 2 : 0)) out.push([OX + 32 + x, OY + GROUND - 1 + y, "z"]);
  return out;
};

/** His eyes flaring (casting, in check), and a bright void. */
const EYES_HOT = { e: "#fff1a8", E: "#ffffff" };
const VOID_HOT = { u: "#7a4fd0", U: "#c4a2ff", V: "#432470" };
/** The dark stance: no light but the void (his fur barely there), his eyes two dim violet slits. */
export const DARK_PAL: Record<string, string> = { d: "#0b0a10", c: "#0f0d16", C: "#14111d", h: "#1b1727", n: "#08070b", e: "#7d5bc8", E: "#b89cff", y: "#3a3448", m: "#050407" };
/** Halfway into (or out of) the dark. */
const DUSK_PAL: Record<string, string> = { d: "#121118", c: "#1a1822", C: "#24212d", h: "#312d3c", n: "#0c0b10" };
/** A hit: the fur flashes pale. */
const FLASH: Record<string, string> = { d: "#5e5868", c: "#8a8494", C: "#b3adbd", h: "#ffffff" };
/** His bulbs flickering (hurt, a hit): all of them dim for a frame. */
const FLICKER: Record<string, string> = Object.fromEntries(BULB_KEYS.flatMap((keys) => keys.map((k, i) => [k, i === 3 ? "#00000000" : BULB_OFF[i]!])));
/** His bulbs flashing bright (victory). */
const BULBS_BRIGHT: Record<string, string> = { "7": "#ffffff", "8": "#ffffff", "9": "#ffffff", "!": "#ff4a4a99", "^": "#ffc93a99", "~": "#4ab3ff99" };

// ---- His animations.

/** Breathing: [bob] per frame. */
const BREATH = [0, 0, 0, 1, 1, 1, 0, 0] as const;
/** The strand's sway while idle, [px] per frame. */
const SWAY = [0, 0, 1, 1, 1, 0, 0, -1, -1, -1, 0, 0, 1, 1, 0, -1] as const;

/**
 * Idle: he breathes, glowering; the void at his heart swirls (a full turn every second); the strand sways a little, and
 * a glint runs along the bulbs, one after another, up one half and down the other. Silent.
 */
const IDLE_P = (i: number): HollowPose => ({ bob: BREATH[i % 8]!, phase: i, sway: SWAY[i % 16]! });
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) => {
    const p = IDLE_P(i);
    const glint = i >= 3 && i < 3 + BULBS ? bulbGlint(p, i - 3, i % 2 === 0) : [];
    const spark = i === 13 ? sparkle(...(build(p).heart.map((v, n) => v + (n ? -1 : 6)) as [number, number])) : [];
    return f(125, p, { specks: [...glint, ...spark] });
  }),
};

/** Entrance: darkness gathers into a whirl, he rises out of it, eyes snapping open; his bulbs light a colour at a time. */
const entrance: Anim = {
  loop: false,
  frames: [
    { ms: 110, layers: [], specks: gather(AT_HEART, 0, 8), cue: "hum" },
    { ms: 110, layers: [], specks: gather(AT_HEART, 0.3, 12) },
    { ms: 110, layers: [], specks: [...gather(AT_HEART, 0.6, 14), ...sparkle(...AT_HEART, true)] },
    f(110, { crouch: 4, mood: "dark", size: 2, phase: 0, free: "out" }, { pal: { ...DARK_PAL, ...FLICKER }, specks: wisps([OX + 32, OY + 50], 0, 6, 14) }),
    f(110, { crouch: 2, mood: "dark", size: 2, phase: 1, free: "out" }, { pal: { ...DUSK_PAL, ...FLICKER }, specks: wisps([OX + 32, OY + 48], 1, 6, 14) }),
    f(120, { crouch: 1, mood: "roar", size: 1, phase: 2, free: "claw" }, { pal: { ...EYES_HOT, ...FLICKER }, specks: wisps([OX + 32, OY + 46], 2, 4, 14) }),
    f(120, { mood: "roar", size: 1, phase: 3, free: "claw" }, { cue: "light", pal: { ...EYES_HOT, ...bulbsOff(1) } }),
    f(120, { mood: "grim", phase: 4, free: "claw" }, { pal: bulbsOff(2) }),
    f(140, { mood: "grim", phase: 5 }, { specks: bulbGlint({ phase: 5 }, 2, true) }),
    f(300, { mood: "sneer", phase: 6 }),
  ],
};

/** Thinking: a claw on his chin, eyes to the side, little orbs of darkness for thoughts. */
const thoughtOrbs = (n: number): Speck[] =>
  [[OX + 50, OY + 4], [OX + 55, OY - 1], [OX + 60, OY - 7]].slice(0, n).flatMap(([x, y], i): Speck[] => (i === 2 ? sparkle(x!, y!, true) : [[x!, y!, "u"], [x! + 1, y!, "V"], [x!, y! - 1, "U"]]));
const thinking: Anim = {
  loop: true,
  frames: [0, 1, 2, 3].flatMap((n) => [0, 1, 2, 3].map((i) => f(130, { mood: "think", free: "chin", feet: i % 2 ? "tap" : "stand", bob: i === 2 ? 1 : 0, phase: n * 2 + (i >> 1), sway: i === 1 ? 1 : 0 }, { specks: thoughtOrbs(n) }))),
};

/** Smug: a claw on his hip, a brow up, swinging the strand slowly. */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(150, { mood: "sneer", free: "hip", feet: i % 4 < 2 ? "tap" : "stand", bob: i % 4 === 1 ? 1 : 0, phase: i, sway: [0, 1, 2, 1, 0, -1, -2, -1][i]!, headDx: i < 4 ? 0 : 1 }, { specks: i === 2 ? bulbGlint({ sway: 2 }, 1, true) : [] })),
};

/** Sweat running off his fur. */
const sweat = (i: number): Speck[] => {
  const t = i % 4;
  return [
    [OX + 18 - t, OY + 4 + t * 2, "j"],
    [OX + 46 + t, OY + 4 + t * 2, "j"],
  ];
};
/** Rattled: wide eyes, shaking, sweating; the void wobbles and darkness leaks off him. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(80, { mood: "rattled", dx: i % 2 ? 1 : -1, bob: i % 4 === 2 ? 1 : 0, phase: i, size: i % 3 === 0 ? 1 : 0, free: "out", sway: i % 2 ? 1 : -1 }, { specks: [...sweat(i), ...wisps([AT_HEART[0], AT_HEART[1] - 1], i, 3, 12)] })),
};

/** His move: a step and a flourish of the strand towards the board, bulbs clinking. */
const move: Anim = {
  loop: false,
  frames: [
    f(100, { crouch: 1, phase: 0, arm: "low" }),
    f(100, { feet: "step", phase: 1, arm: "swing", sway: 2 }, { cue: "clink" }),
    f(120, { feet: "step", crouch: 1, phase: 2, arm: "swing", sway: 3, mood: "sneer" }, { specks: bulbGlint({ arm: "swing", sway: 3 }, 0, true) }),
    f(130, { feet: "step", phase: 3, arm: "swing", sway: 1, mood: "sneer" }),
    f(120, { phase: 4, arm: "hold", sway: -1 }),
    f(160, { phase: 5 }),
  ],
};

/** A capture: he cackles, shoulders heaving, the void flaring, the strand jangling. */
const capture: Anim = {
  loop: false,
  frames: [
    f(90, { crouch: 1, phase: 0 }),
    ...Array.from({ length: 10 }, (_, i) =>
      f(85, { mood: "laugh", free: "claw", phase: i, size: i % 2 ? 1 : 2, headDy: i % 2 ? -1 : 0, bob: i % 2, sway: i % 2 ? 2 : -1 }, { cue: i === 0 ? "clink" : undefined, pal: i % 4 === 0 ? VOID_HOT : undefined, specks: i % 3 === 0 ? bulbGlint({ free: "claw", sway: -1 }, i % 3, true) : [] }),
    ),
    f(160, { mood: "sneer", phase: 2 }),
  ],
};

/** Hurt: a flash, tufts of fur fly, his bulbs flicker and the void sputters; he flinches, then glares. */
const hurt: Anim = {
  loop: false,
  frames: [
    f(70, { crouch: 3, mood: "hurt", free: "out", size: 2, phase: 0 }, { cue: "pop", pal: { ...FLASH, ...FLICKER }, shake: [1, 0], specks: tufts(0) }),
    f(80, { crouch: 3, mood: "hurt", free: "out", size: 0, phase: 1 }, { shake: [-1, 0], pal: FLICKER, specks: tufts(1) }),
    f(90, { crouch: 2, mood: "hurt", free: "out", dx: -1, size: 2, phase: 2 }, { specks: [...tufts(2), ...wisps([AT_HEART[0], AT_HEART[1] - 1], 0, 3, 10)] }),
    f(90, { crouch: 1, mood: "rattled", dx: -1, phase: 3 }, { pal: FLICKER, specks: tufts(3) }),
    f(110, { mood: "rattled", phase: 4 }),
    f(120, { mood: "roar", free: "claw", phase: 5 }, { pal: EYES_HOT }),
    f(160, { mood: "grim", phase: 6 }),
  ],
};

/** Check: he looms, claws up, eyes and void flaring, twice. */
const LOOM: HollowPose = { crouch: 1, feet: "wide", free: "claw", arm: "high", mood: "roar", size: 2 };
const check: Anim = {
  loop: false,
  frames: [
    f(100, { feet: "wide", mood: "grim", phase: 0 }),
    f(120, { ...LOOM, phase: 1 }, { cue: "hum", pal: { ...EYES_HOT, ...VOID_HOT }, specks: wisps([AT_HEART[0], AT_HEART[1] - 1], 0, 4, 12) }),
    f(100, { ...LOOM, phase: 2, size: 1 }, { pal: EYES_HOT, specks: wisps([AT_HEART[0], AT_HEART[1] - 1], 1, 4, 12) }),
    f(100, { feet: "wide", mood: "grim", phase: 3, arm: "high" }),
    f(120, { ...LOOM, phase: 4 }, { pal: { ...EYES_HOT, ...VOID_HOT }, specks: wisps([AT_HEART[0], AT_HEART[1] - 1], 2, 4, 12) }),
    f(100, { ...LOOM, phase: 5, size: 1 }, { pal: EYES_HOT }),
    f(150, { mood: "laugh", phase: 6, free: "claw" }),
    f(160, { mood: "sneer", phase: 7 }),
  ],
};

/** Defeat: the darkness lets go. The void sputters and shrinks to nothing, his bulbs go out a colour at a time, and he slumps into a heap of fur. */
function heap(mood: Mood, extra: Speck[] = []): Partial<Frame> & { layers: Layer[] } {
  const standing = build({ mood, free: "out", strand: false }).layers.filter((l) => l.part !== "shadow" && !l.part.startsWith("void:"));
  const lying = lieDown(PARTS, { layers: standing }, 0, 0, "right").layers;
  const box = lying.map((l) => {
    const [w, h] = partSize(PARTS[l.part]!, l.rot ?? 0);
    return [l.x, l.y, l.x + w, l.y + h] as const;
  });
  const x0 = Math.min(...box.map((b) => b[0]));
  const x1 = Math.max(...box.map((b) => b[2]));
  const y1 = Math.max(...box.map((b) => b[3]));
  const sx = OX + 30 - Math.round((x0 + x1) / 2);
  const sy = OY + GROUND - 4 - y1;
  const s = strand({ hand: [50, 53], ends: [[-12, 8], [14, 7]], bows: [2, -2], broken: [] });
  return {
    layers: [{ part: "shadow", x: OX + 12, y: OY + GROUND - 2 }, ...lying.map((l) => ({ ...l, x: l.x + sx, y: l.y + sy })), { part: s.wire.name, x: OX + s.wire.at[0], y: OY + s.wire.at[1] }],
    specks: extra,
  };
}
const defeat: Anim = {
  loop: false,
  frames: [
    f(80, { crouch: 3, mood: "hurt", free: "out", size: 2 }, { cue: "pop", pal: { ...FLASH, ...FLICKER }, shake: [1, 0], specks: tufts(0) }),
    f(100, { crouch: 2, mood: "rattled", free: "out", size: 1, phase: 2 }, { pal: bulbsOff(2), specks: wisps([AT_HEART[0], AT_HEART[1] - 1], 1, 5, 12) }),
    f(110, { crouch: 2, mood: "rattled", free: "out", size: 0, phase: 4, dx: 1 }, { cue: "hum", pal: bulbsOff(1), specks: wisps([AT_HEART[0], AT_HEART[1] - 2], 2, 6, 14) }),
    f(120, { crouch: 4, mood: "out", free: "out", size: 0, phase: 6 }, { pal: { ...bulbsOff(0), o: "#1b1029", O: "#30194f" }, specks: wisps([AT_HEART[0], AT_HEART[1] - 4], 3, 6, 16) }),
    { ms: 130, cue: "pop", shake: [0, 1], pal: bulbsOff(0), ...heap("out", [...wisps([OX + 32, OY + 56], 4, 6, 14), ...tufts(1, [OX + 46, OY + 52])]) },
    { ms: 140, pal: bulbsOff(0), ...heap("out", wisps([OX + 32, OY + 52], 5, 4, 14)) },
    { ms: 1000, pal: bulbsOff(0), ...heap("out") },
  ],
};

/** Victory: the strand held high, its bulbs flashing, he leaps and cackles, the void flaring. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const air = [0, 2, 5, 6, 5, 2, 0, 0, 0, 0, 0, 0][i]!;
    return f(110, { mood: "laugh", free: "fist", arm: "high", air, crouch: i === 0 || i === 6 ? 2 : 0, feet: air > 3 ? "wide" : "stand", headDy: i % 2 ? -1 : 0, phase: i, size: air > 4 ? 2 : 1, sway: i % 2 ? 2 : -2 }, { cue: i === 2 ? "clink" : undefined, pal: i % 3 === 0 ? { ...BULBS_BRIGHT, ...VOID_HOT } : undefined });
  }),
};

/**
 * His passive, casting the dark: he draws his free arm back as darkness spirals into the void, then flicks it at the
 * board; at the "cast" cue the darkness pours out of his chest towards the board (the board's darkPour takes over
 * there), and he sneers.
 */
const CAST_P: HollowPose = { crouch: 1, feet: "wide", free: "flick", mood: "roar", size: 2 };
const darkCast: Anim = {
  loop: false,
  frames: [
    f(110, { crouch: 1, free: "wind", mood: "grim", phase: 0 }, { cue: "hum", specks: gather(AT_HEART, 0) }),
    f(110, { crouch: 1, free: "wind", mood: "grim", phase: 1, size: 1 }, { pal: VOID_HOT, specks: gather(AT_HEART, 0.35) }),
    f(110, { crouch: 2, free: "wind", mood: "roar", phase: 2, size: 2 }, { pal: { ...VOID_HOT, ...EYES_HOT }, specks: gather(AT_HEART, 0.7) }),
    f(80, { ...CAST_P, phase: 3 }, { cue: "cast", pal: { ...VOID_HOT, ...EYES_HOT }, shake: [1, 0], specks: [...pour(build({ ...CAST_P }).heart, 0), ...sparkle(AT_HEART[0], AT_HEART[1] + 1, true)] }),
    f(80, { ...CAST_P, phase: 4 }, { pal: VOID_HOT, specks: pour(build(CAST_P).heart, 1) }),
    f(90, { ...CAST_P, phase: 5, size: 1 }, { specks: pour(build(CAST_P).heart, 2) }),
    f(100, { ...CAST_P, phase: 6, size: 1, mood: "sneer" }, { specks: pour(build(CAST_P).heart, 3).filter((_, i) => i % 2 === 0) }),
    f(140, { crouch: 1, phase: 7, mood: "sneer", free: "hang" }),
    f(180, { phase: 0, mood: "sneer" }),
  ],
};

/**
 * Claiming the dark side (the intro, when the crowd would have been black): he points at himself, then sweeps his arm
 * wide as the darkness rises round him like a cloak, eyes flaring; a sneer.
 */
const claimDark: Anim = {
  loop: false,
  frames: [
    f(120, { mood: "think", free: "chin", phase: 0 }),
    f(140, { mood: "sneer", free: "chin", phase: 1 }, { cue: "hum" }),
    f(110, { mood: "grim", free: "out", phase: 2, size: 1 }, { specks: wisps([OX + 32, OY + 64], 0, 8, 20) }),
    f(110, { mood: "roar", free: "up", phase: 3, size: 2, feet: "wide" }, { cue: "cast", pal: { ...EYES_HOT, ...VOID_HOT }, specks: [...wisps([OX + 32, OY + 58], 1, 10, 22), ...gather(AT_HEART, 0.2, 12)] }),
    f(120, { mood: "roar", free: "up", phase: 4, size: 2, feet: "wide" }, { pal: { ...EYES_HOT, ...DUSK_PAL }, specks: [...wisps([OX + 32, OY + 50], 2, 10, 22), ...gather(AT_HEART, 0.5, 12)] }),
    f(130, { mood: "roar", free: "up", phase: 5, size: 1, feet: "wide" }, { pal: DUSK_PAL, specks: wisps([OX + 32, OY + 42], 3, 10, 22) }),
    f(140, { mood: "sneer", free: "hip", phase: 6 }, { specks: wisps([AT_HEART[0], AT_HEART[1] - 4], 4, 6, 20) }),
    f(320, { mood: "sneer", free: "hip", phase: 7 }),
  ],
};

/**
 * His ultimate, Lights out, played ON THE BOARD (hide him in his usual spot meanwhile): his shadow grows, he drops in
 * from above (he has left his corner), lands, raises the strand in front of him and crushes it in his claw a section at
 * a time (STRAND_SECTIONS): "smash1", "smash2", "smash3" (dim the board a step at each). With the last bulb the light goes out of him too:
 * the last frames are his dark stance (the void the only light), which holds until the test (`lightsTest`) takes over.
 */
const UP_P: HollowPose = { arm: "up", free: "hang", mood: "grim" };
const smash = (k: number, phase: number): Frame[] => {
  const broken = STRAND_SECTIONS.slice(0, k).flat();
  const section = STRAND_SECTIONS[k]!;
  const now = [...broken, ...section];
  const p: HollowPose = { ...UP_P, broken: now, phase, free: "grab", mood: "roar" };
  const at = build({ ...UP_P, broken }).bulbs;
  const dim = k === 2 ? DUSK_PAL : {};
  // Glass off every bulb in the section; his claw closes on its middle bulb, with a sparkle.
  const glass = (t: number, n = 6) => section.flatMap((b) => shards(at[b]!, t, b).slice(0, n));
  const mid = at[section[Math.floor(section.length / 2)]!]!;
  p.reach = [mid[0] - OX + 2, mid[1] - OY + 2];
  return [
    f(150, { ...UP_P, broken, phase, mood: "sneer", free: "wind" }, { pal: dim, specks: section.flatMap((b) => bulbGlint({ ...UP_P, broken }, b, b === section[0])) }),
    f(70, p, { cue: `smash${k + 1}`, shake: [1, 1], pal: { ...dim, ...EYES_HOT }, specks: [...glass(0), ...sparkle(mid[0] + 1, mid[1] + 3, true)] }),
    f(90, { ...p, phase: phase + 1 }, { pal: dim, specks: glass(1) }),
    f(130, { ...p, phase: phase + 2, mood: "laugh" }, { pal: dim, specks: glass(2, 3) }),
  ];
};
const lightsOut: Anim = {
  loop: false,
  frames: [
    { ms: 100, layers: [], specks: dropShadow(5), cue: "hum" },
    { ms: 100, layers: [], specks: dropShadow(10) },
    f(80, { air: 17, free: "up", mood: "roar", feet: "wide", sway: -3 }, { specks: dropShadow(14) }),
    f(80, { air: 9, free: "up", mood: "roar", feet: "wide", sway: -2 }, { specks: dropShadow(16) }),
    f(110, { crouch: 4, free: "out", mood: "roar", feet: "crouch", sway: 2, size: 2 }, { cue: "land", shake: [0, 1], specks: wisps([OX + 32, OY + 64], 0, 8, 22) }),
    f(110, { crouch: 2, free: "out", mood: "grim", feet: "wide", phase: 1, sway: 1 }, { specks: wisps([OX + 32, OY + 62], 1, 6, 22) }),
    f(160, { ...UP_P, phase: 2, mood: "sneer" }),
    ...smash(0, 3),
    ...smash(1, 6),
    ...smash(2, 1),
    // The light goes out of him too: only the void is left.
    f(140, { ...UP_P, broken: ALL_BULBS, phase: 4, mood: "dark", free: "hang", size: 1 }, { pal: DUSK_PAL }),
    f(160, { mood: "dark", broken: ALL_BULBS, arm: "low", phase: 5, size: 2 }, { pal: DARK_PAL }),
    f(400, { mood: "dark", broken: ALL_BULBS, arm: "low", phase: 6, size: 1 }, { pal: DARK_PAL }),
  ],
};

/** The void's pulse in the dark: brighter and wider on the beat. */
const PULSE_PAL: Record<string, string> = { ...DARK_PAL, u: "#8657e0", U: "#d3b6ff", V: "#4a2a80", x: "#ffffff" };
const DARK_P = (phase: number, size: 0 | 1 | 2 = 1): HollowPose => ({ mood: "dark", broken: ALL_BULBS, arm: "low", phase, size });
/** The test stance (a loop): in the dark, only the void, pulsing slowly (once a second). */
const lightsTest: Anim = {
  loop: true,
  frames: [
    f(140, DARK_P(0, 2), { pal: PULSE_PAL }),
    f(140, DARK_P(1, 1), { pal: DARK_PAL }),
    ...[2, 3, 4, 5].map((ph) => f(180, DARK_P(ph, 1), { pal: DARK_PAL })),
  ],
};
/**
 * The test's countdown, `s` seconds: the void throbs once a second ("tick"), wider and brighter as time runs out, and
 * twice in the last second; at the end it flares. Then `lightsTest` again.
 */
const countdown = (s: number): Anim => ({
  loop: false,
  frames: Array.from({ length: s }, (_, n) => {
    const last = n === s - 1;
    const beat = (ms: number, k: number): Frame[] => [
      f(120, DARK_P(k, 2), { cue: "tick", pal: PULSE_PAL, shake: last ? [0, 1] : undefined, specks: last ? sparkle(...AT_HEART, true) : [] }),
      f(ms - 120, DARK_P(k + 1, 1), { pal: DARK_PAL }),
    ];
    return last ? [...beat(500, n * 2), ...beat(500, n * 2 + 2)] : beat(1000, n * 2);
  }).flat(),
});

/** In the test: a piece found (he recoils, hissing, the void sputters) or missed (he cackles in the dark). */
const testFound: Anim = {
  loop: false,
  frames: [
    f(90, { ...DARK_P(0, 0), crouch: 2, free: "out", mood: "hurt" }, { cue: "hum", pal: DARK_PAL, shake: [1, 0] }),
    f(110, { ...DARK_P(1, 2), crouch: 1, free: "out", mood: "rattled" }, { pal: PULSE_PAL }),
    f(160, { ...DARK_P(2, 1), mood: "dark" }, { pal: DARK_PAL }),
  ],
};
const testMiss: Anim = {
  loop: false,
  frames: [
    ...Array.from({ length: 6 }, (_, i) => f(90, { ...DARK_P(i, i % 2 ? 1 : 2), mood: "laugh", free: "claw", headDy: i % 2 ? -1 : 0 }, { cue: i === 0 ? "hum" : undefined, pal: i % 2 ? DARK_PAL : PULSE_PAL })),
    f(160, DARK_P(6, 1), { pal: DARK_PAL }),
  ],
};

/**
 * Lights back, after the test: the void flares and a fresh strand spills out of it, its bulbs lighting a colour at a time
 * ("relight"), the light comes back into him, he takes the strand in hand and leaps back to his corner (the last
 * frame is empty: he's gone from this spot).
 */
/** The fresh strand spilling out of the void, both halves hanging from his heart. */
const SPILL: StrandSpec = { hand: [VOID[0] + 1, VOID[1] + 1], ends: [[-6, 24], [10, 23]], bows: [-3, 4], broken: [] };
const lightsBack: Anim = {
  loop: false,
  frames: [
    f(140, DARK_P(0, 2), { pal: PULSE_PAL }),
    ...[0.25, 0.5, 0.75, 1].map((out, i) =>
      f(110, { mood: "dark", strand: { ...SPILL, out }, arm: "low", phase: 1 + i, size: 2 }, { cue: i === 0 ? "relight" : undefined, pal: { ...DARK_PAL, ...(i < 3 ? bulbsOff(i) : {}) }, specks: sparkle(OX + VOID[0], OY + VOID[1], i % 2 === 0) }),
    ),
    f(120, { mood: "roar", strand: SPILL, arm: "low", phase: 5, size: 1 }, { pal: { ...DUSK_PAL, ...EYES_HOT } }),
    f(120, { mood: "sneer", free: "grab", phase: 6, size: 1 }),
    f(150, { mood: "sneer", phase: 7 }, { specks: bulbGlint({}, 0, true) }),
    f(110, { crouch: 3, feet: "crouch", mood: "grim", phase: 0 }),
    f(80, { air: 10, free: "up", mood: "grim", feet: "wide", phase: 1, sway: 3 }, { cue: "hum" }),
    f(80, { air: 17, free: "up", mood: "grim", feet: "wide", phase: 2, sway: 4 }, { specks: dropShadow(10) }),
    { ms: 80, layers: [], specks: dropShadow(6) },
    { ms: 60, layers: [] },
  ],
};

export const HOLLOW: Character = {
  id: "hollow",
  name: "Hollow",
  w: OX + 64 + 22,
  h: OY + GROUND + 6,
  foot: [OX + 32, OY + GROUND],
  palette: HOLLOW_PALETTE,
  halo: "#6a46c4",
  looks: HOLLOW_LOOKS,
  parts: PARTS,
  anims: {
    idle,
    entrance,
    thinking,
    move,
    capture,
    hurt,
    check,
    smug,
    rattled,
    defeat,
    victory,
    darkCast,
    claimDark,
    lightsOut,
    lightsTest,
    test3: countdown(3),
    test4: countdown(4),
    test5: countdown(5),
    testFound,
    testMiss,
    lightsBack,
  },
};

/** The part of him a portrait shows (his head and the top of his ruff), in frame pixels. */
export const HOLLOW_PORTRAIT = { x: OX + 13, y: OY - 4, w: 38, h: 34 } as const;

/** Where the void is (frame pixels) at rest and as he casts: the darkness leaves from there. */
export const HOLLOW_HEART: Pt = build({}).heart;
export const HOLLOW_CAST_FROM: Pt = build(CAST_P).heart;

/**
 * His lines: quiet, cold, a little cruel; about memory and the dark; never instructions. Everyone sees the same ones
 * (picked by the moment's key). `power` is a later cover of the dark (taunts, now and then), `darkFirst` the first one,
 * `claim` the intro when he takes the dark side, `ultimate` Lights out, `found` / `missed` a piece found or missed in the
 * test, `lightsBack` the lights coming back. The test's prompt names the pieces: findLine().
 */
export const HOLLOW_LINES: Partial<Record<Beat, readonly string[]>> = {
  entrance: ["Hollow is here.", "Did you leave a light on?", "I was always here.", "Hush now."],
  move: ["Mm.", "Quietly…", "Step by step.", "Into the dark."],
  capture: ["Gone. Like you'll forget.", "Mine now.", "Swallowed.", "Into the void."],
  check: ["Check. Look closer.", "Your king can't hide.", "Check. Feel the cold?"],
  hurt: ["You'll pay for that.", "That… stung.", "I've been torn before."],
  thinking: ["Let it get darker…", "Shh…", "Patience…"],
  smug: ["How do you like the dark?", "Lost already?", "Can you still see it?"],
  rattled: ["Too bright… too bright!", "No… not the light!", "I'm coming apart!"],
  defeat: ["The light… again…", "Remember me…", "Torn… apart…"],
  victory: ["Lights out. For good.", "Darkness wins.", "You forgot. They all do."],
  strike: ["Forgotten.", "Gone dark."],
  darkFirst: ["Don't forget what's there. Forgetting costs."],
  power: ["Can you still see it?", "How do you like the dark?", "Remember it?", "Dark there now.", "Forgetting yet?"],
  claim: ["The dark side is mine.", "I'll take the dark.", "Black suits me."],
  ultimateWarn: ["It's getting dark…", "Feel it?"],
  ultimate: ["It's time."],
  found: ["Hmph. You remembered.", "Lucky.", "Not bad… for now."],
  missed: ["Forgotten already?", "Forgetting costs.", "Wrong. So wrong."],
  lightsBack: ["Remember that.", "Lights on. For now.", "Keep your eyes open."],
};
export const HOLLOW_CHANCE: Partial<Record<Beat, number>> = {
  entrance: 1,
  move: 0.12,
  capture: 0.6,
  check: 0.75,
  hurt: 0.6,
  thinking: 0.08,
  smug: 0.8,
  rattled: 0.8,
  defeat: 1,
  victory: 1,
  strike: 0.8,
  darkFirst: 1,
  power: 0.5,
  claim: 1,
  ultimateWarn: 1,
  ultimate: 1,
  found: 0.6,
  missed: 0.6,
  lightsBack: 1,
};

const PIECE_WORD: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
/**
 * The test's prompt, naming what he hides in a round (Eric, Oct 9): a type ("my queen"; he has several: "one of my
 * rooks", any counts), or a pawn by its file ("my pawn on the c-file"; a last resort with several there: "one of my
 * pawns on the c-file"). "Find my queen.", "Find my queen and one of my rooks.", "Find my knight, my bishop and my pawn
 * on the c-file." A bare piece letter (an older round) reads as "my <piece>".
 */
export function findLine(targets: readonly (string | LightsOutTarget)[]): string {
  const names = targets.map((x) => {
    const t = typeof x === "string" ? { type: x } : x;
    const word = PIECE_WORD[t.type.toLowerCase()] ?? "piece";
    const what = t.several ? `one of my ${word}s` : `my ${word}`;
    return t.file ? `${what} on the ${t.file}-file` : what;
  });
  const list = names.length <= 1 ? (names[0] ?? "my pieces") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `Find ${list}.`;
}

/**
 * The prompt for the dock's one line: findLine when it's short enough, else a compact list ("Find: a rook, a knight,
 * e-pawn"), since his own words show in full in his text box over the board.
 */
export function findShort(targets: readonly (string | LightsOutTarget)[], max = 30): string {
  const full = findLine(targets);
  if (full.length <= max) return full;
  const names = targets.map((x) => {
    const t = typeof x === "string" ? { type: x } : x;
    const word = PIECE_WORD[t.type.toLowerCase()] ?? "piece";
    if (t.file) return `${t.several ? "a " : ""}${t.file}-pawn`;
    return t.several ? `a ${word}` : word;
  });
  return `Find: ${names.join(", ")}`;
}
