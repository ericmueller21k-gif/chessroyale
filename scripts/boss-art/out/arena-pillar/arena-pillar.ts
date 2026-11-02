import type { Character, Frame, Part, Speck } from "../../../../packages/app/src/characters/sprite.ts";

/** Arena scenery: a square sandstone pillar with a bronze brazier and a burning flame on top. 24 x 96, foot (12, 95). */

const W = 24;
const H = 96;

// Pillar outline by row: [y0, y1, left, right] tiers, top to bottom.
const TIERS: [number, number, number, number][] = [
  [28, 29, 2, 21], // abacus slab
  [30, 30, 3, 20],
  [31, 32, 4, 19], // echinus
  [33, 33, 5, 18], // neck band
  [34, 85, 5, 18], // shaft
  [86, 86, 4, 19], // torus
  [87, 88, 3, 20],
  [89, 94, 2, 21], // plinth
];

const hash = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
const darker = (c: string) => String(Math.min(6, Number(c) + 1));

function pillarGrid(): string[] {
  const rows: string[][] = Array.from({ length: H }, () => Array<string>(W).fill("."));
  for (const [y0, y1, l, r] of TIERS) {
    const w = r - l + 1;
    const split = l + Math.round(w * 0.55); // first column of the shaded right face
    const shaft = y0 === 34;
    for (let y = y0; y <= y1; y++) {
      for (let x = l; x <= r; x++) {
        const lit = x < split;
        let c = lit ? (x === l + 1 ? "1" : "2") : x >= r - 2 ? "5" : "4";
        if (x === split - 1) c = "1"; // the corner catches the light
        if (x === split) c = "3";
        if (!shaft) {
          if (y === y0 && y1 > y0) c = lit ? "1" : "3"; // tops of the mouldings catch light
          if (y === y1 && y1 > y0) c = darker(c);
        } else {
          const course = Math.floor((y - 34) / 9);
          const inCourse = (y - 34) % 9;
          if (inCourse === 8) c = lit ? "3" : "5"; // bed joint
          else if (inCourse === 0) c = lit ? "1" : c; // block top edge
          else {
            const vj = course % 2 === 0 ? l + 3 : r - 2; // staggered head joint
            if (x === vj) c = lit ? "3" : "5";
            else if (hash(x, y) % 19 === 0) c = darker(c);
          }
        }
        rows[y]![x] = c;
      }
    }
  }
  return rows.map((r) => r.join(""));
}

const BOWL: string[] = [
  "yyYYYYYYYYYYYYYOOb",
  "YOOOOOOOOOOOOOObbc",
  ".YOOObOOOOObOOObc.",
  "..YOOOOOOOOOObbc..",
  "...YOOOOOOOObbc...",
  ".....YOOOObbc.....",
  ".......YObc.......",
  "......YOObbc......",
];

// Flame column heights (13 columns), one row per frame: the tips shift and lick.
const FLAMES: number[][] = [
  [5, 7, 9, 12, 14, 16, 18, 16, 15, 12, 10, 8, 6],
  [6, 8, 11, 13, 15, 17, 16, 19, 14, 12, 9, 7, 5],
  [5, 8, 10, 11, 15, 16, 19, 15, 13, 13, 10, 7, 5],
  [6, 7, 10, 13, 14, 19, 17, 15, 14, 11, 11, 8, 5],
  [5, 7, 9, 12, 15, 15, 17, 18, 15, 12, 9, 8, 6],
];
for (const hs of FLAMES) hs.forEach((h, i) => (hs[i] = h + 3 + (Math.abs(i - 6) < 3 ? 1 : 0)));
const FH = 24;

function flameGrid(hs: number[]): string[] {
  const rows: string[][] = Array.from({ length: FH }, () => Array<string>(hs.length).fill("."));
  hs.forEach((h, i) => {
    const d = Math.abs(i - 6);
    for (let u = 0; u < h; u++) {
      const heat = 1 - Math.max(0, u - 5) / Math.max(1, h - 5) - d * 0.1;
      let c = heat > 0.72 ? "W" : heat > 0.55 ? "y" : heat > 0.38 ? "Y" : heat > 0.2 ? "F" : "R";
      if (u === h - 1) c = "R";
      rows[FH - 1 - u]![i] = c;
    }
  });
  return rows.map((r) => r.join(""));
}

const parts: Record<string, Part> = {
  pillar: { grid: pillarGrid() },
  bowl: { grid: BOWL },
};
FLAMES.forEach((hs, i) => (parts[`flame${i}`] = { grid: flameGrid(hs), outline: false }));

// Two sparks rising, out of step.
const SPARKS: Speck[][] = [
  [[17, 9, "y"], [6, 3, "F"]],
  [[17, 7, "Y"], [5, 1, "R"]],
  [[18, 5, "Y"], [6, 9, "y"]],
  [[17, 3, "F"], [5, 7, "Y"]],
  [[18, 1, "R"], [6, 5, "Y"]],
];

const frames: Frame[] = FLAMES.map((_, i) => ({
  ms: 120,
  layers: [
    { part: "pillar", x: 0, y: 0 },
    { part: `flame${i}`, x: 5, y: 2 },
    { part: "bowl", x: 3, y: 19 },
  ],
  specks: SPARKS[i],
}));

export const ARENA_PILLAR_FLAME: { x: number; y: number } = { x: 12, y: 12 };

export const ARENA_PILLAR: Character = {
  id: "arena-pillar",
  name: "Arena pillar",
  w: W,
  h: H,
  foot: [12, 95],
  palette: {
    k: "#2a1c14",
    "1": "#fbf0d8",
    "2": "#ecd9b2",
    "3": "#d8bf93",
    "4": "#bb9e70",
    "5": "#93784f",
    "6": "#6a5539",
    x: "#2e2018",
    z: "#150e0a",
    N: "#1f2a44",
    n: "#34466e",
    Y: "#f4b740",
    y: "#ffe08a",
    O: "#b97c10",
    M: "#f7f4ee",
    m: "#d9d3c7",
    o: "#a39b8d",
    b: "#7a4a1c",
    c: "#4a2c12",
    W: "#fffbe6",
    F: "#f08a24",
    R: "#c8461a",
  },
  halo: "#fff2d630",
  parts,
  anims: { idle: { frames, loop: true } },
};
