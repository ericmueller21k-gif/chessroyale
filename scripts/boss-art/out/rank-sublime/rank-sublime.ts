/**
 * Sublime, tier 6 of the ranked ladder: a queen of amethyst standing in front of a faceted octagon badge, set in gold.
 * Five stills, one per division: d5 the badge and the queen alone; d4 adds four studs; d3 adds a pair of gold wings;
 * d2 adds a crest at the top; d1 adds a glint on the queen and a thin glow round the badge.
 */
import { canvas, edge, poly, toGrid } from "../../../../packages/app/src/characters/paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../../../packages/app/src/characters/sprite.ts";

const PALETTE = {
  k: "#1a0a2e", // outline
  // gold, dark to light
  D: "#6a3a08",
  O: "#a8680e",
  Y: "#dc9a1c",
  L: "#f6c93a",
  W: "#fff3a6",
  // amethyst (the queen), dark to light
  a: "#35146b",
  b: "#5a26a3",
  c: "#8447d4",
  d: "#ad78f0",
  e: "#d3b0ff",
  f: "#f4e8ff",
  // the badge's deep purple field, dark to light
  r: "#1b0b38",
  s: "#291058",
  t: "#371a78",
  u: "#472292",
  v: "#582cab",
  // glint and glow
  w: "#ffffff",
  i: "#e8d6ff",
  z: "#ead2ffb8",
  Z: "#c096ff64",
} as const;

type Pt = readonly [number, number];

// ---- The badge: a 34 x 34 octagon, a gold bezel cut in eight facets round a deep purple table.

const BW = 34;
const CUT = 8;
const BX = 7; // badge top-left on the 48 x 48 frame
const BY = 7;

/** The octagon inset by `inset` from the badge's box, its corner cuts kept at 45 degrees. */
function oct(inset: number, size = BW, cut = CUT): Pt[] {
  const a = cut + inset * Math.SQRT2 - inset;
  const lo = inset;
  const hi = size - inset;
  return [[a, lo], [size - a, lo], [hi, a], [hi, size - a], [size - a, hi], [a, hi], [lo, size - a], [lo, a]];
}

function badge(): Part {
  const cv = canvas(BW, BW);
  const O = oct(0);
  const T = oct(4);
  // top, top-right, right, bottom-right, bottom, bottom-left, left, top-left: light from the top left.
  const gold = ["L", "Y", "O", "D", "O", "Y", "L", "W"];
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    poly(cv, [O[i]!, O[j]!, T[j]!, T[i]!], gold[i]!);
  }
  poly(cv, T, "D");
  const I = oct(5);
  const c: Pt = [BW / 2, BW / 2];
  const field = ["u", "t", "s", "r", "s", "t", "u", "v"];
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    poly(cv, [c, I[i]!, I[j]!], field[i]!);
  }
  return { grid: toGrid(cv) };
}

// ---- The queen: 16 x 24, drawn as runs per row, then shaded from the top left.

const QW = 20;
const QH = 25;
const QX = 14;
const QY = 12;

const RUNS: readonly (readonly [number, number][])[] = [
  [[9, 10]],
  [[8, 11]],
  [[8, 11]],
  [[5, 5], [9, 10], [14, 14]],
  [[4, 6], [8, 11], [13, 15]],
  [[1, 1], [4, 6], [8, 11], [13, 15], [18, 18]],
  [[0, 2], [4, 6], [8, 11], [13, 15], [17, 19]],
  [[0, 2], [4, 6], [8, 11], [13, 15], [17, 19]],
  [[1, 3], [5, 14], [16, 18]],
  [[2, 17]],
  [[4, 15]],
  [[6, 13]],
  [[7, 12]],
  [[7, 12]],
  [[6, 13]],
  [[6, 13]],
  [[7, 12]],
  [[6, 13]],
  [[6, 13]],
  [[5, 14]],
  [[5, 14]],
  [[4, 15]],
  [[4, 15]],
  [[3, 16]],
  [[2, 17]],
];

function isGold(x: number, y: number): boolean {
  if (y <= 3) return true; // the orb and the first pearls
  if (y === 4) return x <= 6 || x >= 13;
  if (y === 5 || y === 6) return x <= 2 || x >= 17;
  if (y === 9 || y === 14 || y === 15) return true; // the crown's band, the collar
  return y >= 22;
}

function queen(): Part {
  const cv = canvas(QW, QH);
  const has = (x: number, y: number) => RUNS[y]?.some(([a, b]) => x >= a && x <= b) ?? false;
  RUNS.forEach((runs, y) => {
    for (const [x0, x1] of runs) {
      for (let x = x0; x <= x1; x++) {
        const u = (x - x0 + 0.5) / (x1 - x0 + 1);
        const g = isGold(x, y);
        let idx = u < 0.2 ? 4 : u < 0.45 ? 3 : u < 0.72 ? 2 : 1;
        if (!has(x, y + 1)) idx = Math.max(0, idx - 1);
        else if (!has(x, y - 1) && u < 0.45 && idx >= 3) idx = Math.min(g ? 4 : 5, idx + 1);
        cv[y]![x] = (g ? "DOYLW" : "abcdef")[idx]!;
      }
    }
  });
  return { grid: toGrid(cv) };
}

// ---- Studs: four small amethysts on the badge's cut corners.

const STUD: Part = { grid: [".ed.", "edcb", "dcbb", ".bb."] };

// ---- The crest: a small gold crown with an amethyst, sitting over the badge's top edge.

const CREST: Part = {
  grid: [
    ".....LY.....",
    "LY...LY...LY",
    "LY..LecY..LY",
    "LLYYLedcYYOO",
    "LYYYYdcbYYOO",
    ".LYYYYYYYYO.",
    "..OOOOOOOO..",
  ],
};

// ---- The glow: a lilac ring round the badge, two pixels thick, no outline.

function glow(): Part {
  const size = BW + 6;
  const cv = canvas(size, size);
  const cut = CUT + 6 - 3 * Math.SQRT2; // the badge's cut corner, three pixels out (the outline takes the first)
  poly(cv, oct(0, size, cut), "Z");
  poly(cv, oct(1, size, cut), "z");
  return { grid: toGrid(cv), outline: false };
}

// ---- The wings: four gold feathers a side, fanned from under the badge.

interface Feather {
  part: Part;
  x: number;
  y: number;
}

function feather(bx: number, by: number, tx: number, ty: number, hw: number, mirror: boolean): Feather {
  const mx = (x: number) => (mirror ? 48 - x : x);
  const dx = tx - bx;
  const dy = ty - by;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const at = (t: number, s: number): Pt => [mx(bx + dx * t + nx * s), by + dy * t + ny * s];
  const pts: Pt[] = [at(0, hw * 0.6), at(0.55, hw), at(0.85, hw * 0.8), at(1, hw * 0.3), at(1, -hw * 0.3), at(0.85, -hw * 0.8), at(0.55, -hw), at(0, -hw * 0.6)];
  const x0 = Math.floor(Math.min(...pts.map((p) => p[0])));
  const y0 = Math.floor(Math.min(...pts.map((p) => p[1])));
  const x1 = Math.ceil(Math.max(...pts.map((p) => p[0])));
  const y1 = Math.ceil(Math.max(...pts.map((p) => p[1])));
  const cv = canvas(x1 - x0, y1 - y0);
  poly(cv, pts.map(([x, y]) => [x - x0, y - y0] as Pt), "Y");
  edge(cv, 0, 1, "Y", "O");
  edge(cv, 1, 0, "Y", "O");
  edge(cv, 0, -1, "Y", "L");
  edge(cv, -1, 0, "Y", "L");
  return { part: { grid: toGrid(cv) }, x: x0, y: y0 };
}

// base x, base y, tip x, tip y, half width: back to front.
const FEATHERS: readonly (readonly [number, number, number, number, number])[] = [
  [10, 27, 2.5, 30.5, 2.4],
  [10, 26, 2.5, 25, 2.6],
  [10, 25, 2.5, 19, 2.6],
  [10, 24, 5, 9.5, 2.8],
];

const wingParts: Record<string, Part> = {};
const wingLayers: Layer[] = [];
FEATHERS.forEach((f, i) => {
  for (const mirror of [false, true]) {
    const fe = feather(f[0], f[1], f[2], f[3], f[4], mirror);
    const name = `wing${mirror ? "R" : "L"}${i}`;
    wingParts[name] = fe.part;
    wingLayers.push({ part: name, x: fe.x, y: fe.y });
  }
});

// ---- The five divisions.

const STUDS: readonly (readonly [number, number])[] = [
  [9, 9],
  [35, 9],
  [9, 35],
  [35, 35],
];

function glint(cx: number, cy: number): Speck[] {
  return [
    [cx, cy, "w"],
    [cx - 1, cy, "w"],
    [cx + 1, cy, "w"],
    [cx, cy - 1, "w"],
    [cx, cy + 1, "w"],
    [cx - 2, cy, "i"],
    [cx + 2, cy, "i"],
    [cx, cy - 2, "i"],
    [cx, cy + 2, "i"],
  ];
}

function division(n: 1 | 2 | 3 | 4 | 5): Frame {
  const layers: Layer[] = [];
  if (n === 1) layers.push({ part: "glow", x: BX - 3, y: BY - 3 });
  if (n <= 3) layers.push(...wingLayers);
  layers.push({ part: "badge", x: BX, y: BY });
  if (n <= 4) for (const [x, y] of STUDS) layers.push({ part: "stud", x, y });
  layers.push({ part: "queen", x: QX, y: QY });
  if (n <= 2) layers.push({ part: "crest", x: 18, y: 2 });
  return { layers, ms: 1000, specks: n === 1 ? glint(19, 22) : undefined };
}

const still = (n: 1 | 2 | 3 | 4 | 5): Anim => ({ frames: [division(n)], loop: false });

export const rankSublime: Character = {
  id: "rank-sublime",
  name: "Sublime",
  w: 48,
  h: 48,
  foot: [24, 44],
  palette: PALETTE,
  parts: { badge: badge(), queen: queen(), stud: STUD, crest: CREST, glow: glow(), ...wingParts },
  anims: { d5: still(5), d4: still(4), d3: still(3), d2: still(2), d1: still(1) },
};
