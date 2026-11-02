import type { Character, Frame, Part } from "../../characters/sprite.ts";

const PALETTE = {
  k: "#2a1c14",
  "1": "#fbf0d8", "2": "#ecd9b2", "3": "#d8bf93", "4": "#bb9e70", "5": "#93784f", "6": "#6a5539",
  x: "#2e2018", z: "#150e0a",
  N: "#1f2a44", n: "#34466e", v: "#141b2e",
  Y: "#f4b740", y: "#ffe08a", O: "#b97c10",
  M: "#f7f4ee", m: "#d9d3c7", o: "#a39b8d",
  B: "#c08a4a", b: "#7a4e24", r: "#b8323a",
};

const W = 16;
const H = 50;

const CROWN = [
  "y...yy...O",
  "Yy..yY..YO",
  "YY.yYYY.YO",
  "YYyYYYYYOO",
  "yYYYYYYYYO",
  "OOOOOOOOOO",
  "yMYYrrYYMO",
  "yYYYYYYYYO",
  "OOOOOOOOOO",
];
const CROWN_X = 3;
const CROWN_Y = 13;

function cloth(): Part {
  const rows: string[] = [];
  for (let y = 0; y < H; y++) {
    let row = "";
    for (let x = 0; x < W; x++) {
      const d = y - 40;
      const half = d * 0.8;
      if (d > 0 && Math.abs(x - 7.5) < half) { row += "."; continue; }
      // gold edge along the notch
      if (d > 0 && Math.abs(x - 7.5) < half + 1) { row += x < 8 ? "Y" : "O"; continue; }
      if (d === 0 && (x === 7 || x === 8)) { row += x === 7 ? "Y" : "O"; continue; }
      if (x === 0) { row += "Y"; continue; }
      if (x === W - 1) { row += "O"; continue; }
      if (y <= 3) { row += y === 3 ? "O" : x < 5 ? "y" : x < 12 ? "Y" : "O"; continue; }
      // inner thin trim near the bottom
      if (y === 36 && x > 1 && x < W - 2) { row += x < 8 ? "Y" : "O"; continue; }
      const cx = x - CROWN_X;
      const cy = y - CROWN_Y;
      const c = CROWN[cy]?.[cx];
      if (c && c !== ".") { row += c; continue; }
      // folds: dark line with a lit line to its left
      if (x === 5 && y > 24 && y < 44) { row += "v"; continue; }
      if (x === 4 && y > 26 && y < 42) { row += "n"; continue; }
      if (x === 11 && y > 6 && y < 12) { row += "v"; continue; }
      if (x === 11 && y > 23 && y < 46) { row += "v"; continue; }
      if (x === 10 && y > 25 && y < 44) { row += "n"; continue; }
      if (x <= 2) { row += "n"; continue; }
      if (x >= 13) { row += "v"; continue; }
      row += "N";
    }
    rows.push(row);
  }
  return { grid: rows };
}

const parts: Record<string, Part> = {
  cloth: cloth(),
  rod: {
    grid: [
      "yY.......yO.......yY",
      "YYBBBBBBBBBBBBBBBBYO",
      "YObbbbbbbbbbbbbbbbYO",
      "OO................OO",
    ],
  },
};

const PHASES = 6;
const frames: Frame[] = Array.from({ length: PHASES }, (_, i) => ({
  ms: 220,
  layers: [
    { part: "cloth", x: 4, y: 3, wave: { along: "rows", amp: 1.1, len: 400, phase: (2 * Math.PI * i) / PHASES, pin: "top" } },
    { part: "rod", x: 2, y: 1 },
  ],
}));

export const ARENA_BANNER: Character = {
  id: "arena-banner",
  name: "Arena banner",
  w: 24,
  h: 56,
  foot: [12, 1],
  palette: PALETTE,
  halo: "#ffe08a26",
  parts,
  anims: { idle: { frames, loop: true } },
};
