import type { Character, Frame, Speck } from "../../../../packages/app/src/characters/sprite.ts";

/** The Colosseum Cup: a gold trophy for the weekly tournament's top 3 (silver and bronze as palette swaps). */

const W = 40;
const H = 48;
const g: string[][] = Array.from({ length: H }, () => Array<string>(W).fill("."));
const set = (x: number, y: number, c: string) => {
  if (x >= 0 && y >= 0 && x < W && y < H) g[y]![x] = c;
};
/** A symmetric span about the center line (between x 19 and 20), shaded lit-left to shade-right. */
const shade = (t: number, bands: readonly [number, string][]) => {
  for (const [lim, c] of bands) if (t < lim) return c;
  return bands[bands.length - 1]![1];
};
const GOLD: [number, string][] = [[0.22, "y"], [0.6, "Y"], [0.84, "O"], [2, "D"]];
const NAVY: [number, string][] = [[0.25, "n"], [0.85, "N"], [2, "z"]];
const span = (y: number, hw: number, bands: readonly [number, string][]) => {
  for (let x = 20 - hw; x <= 19 + hw; x++) set(x, y, shade((x - (20 - hw) + 0.5) / (2 * hw), bands));
};

// Handles: half-ellipse loops either side of the bowl.
const BOWL: Set<string> = new Set();
for (let y = 11; y <= 27; y++) {
  for (let x = 0; x < W; x++) {
    for (const [cx, side] of [[8, -1], [31, 1]] as const) {
      const dx = (x - cx) / 6.2;
      const dy = (y - 18.5) / 6.6;
      const din = (x - cx) / 3.6;
      const dyi = (y - 18.5) / 4.2;
      const out = dx * dx + dy * dy <= 1;
      const inn = din * din + dyi * dyi <= 1;
      if (out && !inn && (x - cx) * side >= 0) {
        // lit on the top/left of each loop
        const lit = side < 0 ? y < 16 || x < cx - 4 : y < 15;
        const dark = side > 0 ? x > cx + 4 || y > 21 : y > 22;
        set(x, y, lit ? "y" : dark ? "O" : "Y");
      }
    }
  }
}

// Bowl.
for (let y = 12; y <= 26; y++) {
  const f = (y - 11) / 16;
  const hw = Math.round(12 * Math.sqrt(1 - f * f));
  span(y, hw, GOLD);
  for (let x = 20 - hw; x <= 19 + hw; x++) BOWL.add(`${x},${y}`);
}
// Rim lip: a bright top row and a shade line below it.
for (let x = 8; x <= 31; x++) set(x, 12, x < 26 ? "y" : "Y");
for (let x = 9; x <= 30; x++) set(x, 13, g[13]![x] === "y" ? "Y" : g[13]![x] === "Y" ? "O" : "D");
// Laurel band: a gold-dark stem with leaves, a navy medallion at the front.
for (let y = 17; y <= 20; y++) {
  const f = (y - 11) / 16;
  const hw = Math.round(12 * Math.sqrt(1 - f * f));
  for (let x = 21 - hw; x <= 18 + hw; x++) {
    const rel = x - (21 - hw);
    if (y === 18 || y === 19) {
      if (y === 18 && rel % 3 === 0) set(x, y, "O");
      if (y === 19 && rel % 3 === 1) set(x, y, "O");
    }
    if (y === 17 || y === 20) set(x, y, g[y]![x] === "y" ? "Y" : g[y]![x] === "Y" ? "O" : "D");
  }
}
for (const [x, y, c] of [
  [19, 17, "n"], [20, 17, "N"], [18, 18, "n"], [19, 18, "Y"], [20, 18, "n"], [21, 18, "N"],
  [18, 19, "n"], [19, 19, "N"], [20, 19, "N"], [21, 19, "z"], [19, 20, "N"], [20, 20, "z"],
] as const)
  set(x, y, c);

// Lid and the little king on top.
span(11, 10, GOLD);
span(10, 8, GOLD);
span(9, 5, GOLD);
for (let x = 10; x <= 29; x++) set(x, 11, x < 24 ? "Y" : "O");
// (the king is a part of its own, outlined against the lid)
const KING = [
  "...yY...",
  "..yyYO..",
  "y..yY..O",
  "yyyyYOOO",
  ".yyYYOO.",
  "...yY...",
  "..yYYO..",
  ".yyYYOO.",
];

// Stem with a knot.
span(27, 3, GOLD);
span(28, 2, GOLD);
span(29, 3, GOLD);
span(30, 4, GOLD);
span(31, 3, GOLD);
span(32, 2, GOLD);
// Base: gold collar, navy block with a gold crown, gold trim, navy plinth.
span(33, 6, GOLD);
span(34, 7, GOLD);
for (let x = 13; x <= 26; x++) set(x, 34, x < 22 ? "O" : "D");
for (let y = 35; y <= 41; y++) span(y, 10, NAVY);
for (let x = 10; x <= 29; x++) set(x, 35, x < 25 ? "n" : "N");
// crown emblem
for (const [x, y, c] of [
  [17, 37, "Y"], [19, 37, "y"], [20, 37, "Y"], [22, 37, "O"],
  [17, 38, "Y"], [18, 38, "Y"], [19, 38, "y"], [20, 38, "Y"], [21, 38, "Y"], [22, 38, "O"],
  [17, 39, "O"], [18, 39, "O"], [19, 39, "O"], [20, 39, "O"], [21, 39, "O"], [22, 39, "O"],
] as const)
  set(x, y, c);
span(42, 12, GOLD);
for (let x = 9; x <= 30; x++) set(x, 42, x < 26 ? "y" : "Y");
span(43, 12, GOLD);
for (let x = 8; x <= 31; x++) set(x, 43, x < 26 ? "O" : "D");
for (let y = 44; y <= 46; y++) span(y, 14, NAVY);
for (let x = 6; x <= 33; x++) set(x, 46, "z");
for (let x = 6; x <= 29; x++) set(x, 44, "n");

const grid = g.map((r) => r.join(""));

/** The glint: a short diagonal of white across the bowl, sliding left to right. */
const glint = (at: number): Speck[] => {
  const out: Speck[] = [];
  for (let y = 14; y <= 25; y++) {
    if (y >= 17 && y <= 20) continue;
    const x0 = Math.round(at - (y - 14) * 0.5);
    for (const [dx, c] of [[0, "W"], [1, "y"]] as const) {
      const x = x0 + dx;
      if (BOWL.has(`${x},${y}`) && !(x >= 18 && x <= 21 && y <= 20)) out.push([x, y, c]);
    }
  }
  return out;
};
const sparkle = (x: number, y: number, big: boolean): Speck[] =>
  big
    ? [[x, y, "W"], [x - 1, y, "y"], [x + 1, y, "y"], [x, y - 1, "y"], [x, y + 1, "y"], [x - 2, y, "Y"], [x + 2, y, "Y"], [x, y - 2, "Y"], [x, y + 2, "Y"]]
    : [[x, y, "W"], [x - 1, y, "Y"], [x + 1, y, "Y"], [x, y - 1, "Y"], [x, y + 1, "Y"]];

const L = [{ part: "cup", x: 0, y: 0 }, { part: "king", x: 16, y: 1 }];
const SILVER = { y: "#ffffff", Y: "#cdd3dc", O: "#8e97a6", D: "#5c6473", W: "#ffffff" };
const BRONZE = { y: "#f2b27a", Y: "#cd7f3e", O: "#8f4e22", D: "#5e3114", W: "#ffe6c8" };

const idle: Frame[] = [
  { layers: L, ms: 250, specks: glint(10) },
  { layers: L, ms: 250, specks: [...glint(17), ...sparkle(3, 11, false)] },
  { layers: L, ms: 250, specks: [...glint(24), ...sparkle(3, 11, true)] },
  { layers: L, ms: 250, specks: [...glint(31), ...sparkle(3, 11, false)] },
];

export const ARENA_CUP_TROPHY: Character = {
  id: "arena-cup-trophy",
  name: "Colosseum Cup",
  w: W,
  h: H,
  foot: [20, 47],
  palette: {
    k: "#2a1c14",
    x: "#2e2018",
    z: "#150e0a",
    N: "#1f2a44",
    n: "#34466e",
    Y: "#f4b740",
    y: "#ffe08a",
    O: "#b97c10",
    D: "#7a4f08",
    W: "#fffbe8",
  },
  halo: "#fff4d630",
  parts: { cup: { grid }, king: { grid: KING } },
  anims: {
    idle: { loop: true, frames: idle },
    silver: { loop: false, frames: [{ layers: L, ms: 1000, pal: SILVER }] },
    bronze: { loop: false, frames: [{ layers: L, ms: 1000, pal: BRONZE }] },
  },
};
