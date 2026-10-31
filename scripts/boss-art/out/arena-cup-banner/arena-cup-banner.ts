import type { Character, Frame, Layer, Part, Speck } from "../../../../packages/app/src/characters/sprite.ts";

/** The Colosseum Cup title banner: navy cloth, gold border, a laurel-and-trophy at each end, a plain middle for words. */

const PALETTE: Record<string, string> = {
  k: "#2a1c14",
  "1": "#fbf0d8", "2": "#ecd9b2", "3": "#d8bf93", "4": "#bb9e70", "5": "#93784f", "6": "#6a5539",
  x: "#2e2018", z: "#150e0a",
  N: "#1f2a44", n: "#34466e", b: "#4a5f8f",
  Y: "#f4b740", y: "#ffe08a", O: "#b97c10",
  M: "#f7f4ee", m: "#d9d3c7", o: "#a39b8d",
};

const W = 112;
const H = 36;

// Banner body: 96 x 24 at (8, 3).
const BW = 96;
const BH = 24;

const EMBLEM = [
  "y.yyyYYYO.O",
  "Yy.yYYYO.OO",
  ".Y.yYYYO.O.",
  "YY..yYO..OO",
  ".Y...Y...O.",
  "YY...Y...OO",
  ".Y.yYYYO.O.",
  "..Y.....O..",
  "...YY.OO...",
  ".....y.....",
];

function bannerGrid(): string[] {
  const rows: string[][] = [];
  for (let y = 0; y < BH; y++) {
    const r: string[] = [];
    for (let x = 0; x < BW; x++) {
      let c: string;
      if (x === BW - 1 || y === BH - 1) c = "O";
      else if (x === 0 || y === 0) c = "Y";
      else if (x === BW - 2 || y === BH - 2) c = "Y";
      else if (x === 1 || y === 1) c = "y";
      else if (x === 2 || y === 2 || x === BW - 3 || y === BH - 3) c = "N";
      else if (y === BH - 4) c = "N";
      else if (x === 16 || x === 79) c = "N";
      else if (y === 3 || x === 3 || x === 17 || x === 80) c = "b";
      else c = "n";
      r.push(c);
    }
    rows.push(r);
  }
  const stamp = (ox: number, oy: number, flip: boolean) => {
    EMBLEM.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        let c = row[flip ? row.length - 1 - i : i]!;
        if (c === ".") continue;
        if (flip) c = c === "y" ? "y" : c; // light stays from the top left
        rows[oy + j]![ox + i] = c;
      }
    });
  };
  stamp(4, 7, false);
  stamp(BW - 15, 7, false);
  return rows.map((r) => r.join(""));
}

// A tail: 24 x 14 ribbon behind the banner's end, running outward; its outer end (column 0) is cut in a swallowtail.
const TW = 24;
const TH = 14;
function tailGrid(): string[] {
  const rows: string[] = [];
  for (let y = 0; y < TH; y++) {
    let r = "";
    const cut = 6 - Math.abs(y - 6.5) + 0.5;
    for (let x = 0; x < TW; x++) {
      if (x < cut - 1) { r += "."; continue; }
      let c: string;
      if (y === 0) c = "Y";
      else if (y === 1) c = "y";
      else if (y === TH - 1) c = "O";
      else if (y === TH - 2) c = "Y";
      else if (x > TW - 6 + (y - 2) / 3) c = "z"; // the fold, tucked under the front cloth
      else if (y === 2) c = "n";
      else if (y === TH - 3) c = "z";
      else c = "N";
      r += c;
    }
    rows.push(r);
  }
  return rows;
}

const ROD = ["y".repeat(102), "O".repeat(102)];
const FINIAL = [".yY.", "yYYO", "YYOO", ".OO."];
const COLLAR = ["y", "Y", "O"];

const parts: Record<string, Part> = {
  banner: { grid: bannerGrid() },
  tail: { grid: tailGrid() },
  rod: { grid: ROD },
  finial: { grid: FINIAL },
  collar: { grid: COLLAR },
};

const PHASES = [0, 1, 2, 3, 4, 5].map((i) => (i / 6) * Math.PI * 2);

function frame(i: number): Frame {
  const ph = PHASES[i]!;
  const layers: Layer[] = [
    { part: "tail", x: 2, y: 20, wave: { along: "cols", amp: 1.4, len: 48, phase: ph, pin: "right" } },
    { part: "tail", x: W - 2 - TW, y: 20, flipX: true, wave: { along: "cols", amp: 1.4, len: 48, phase: ph + Math.PI, pin: "left" } },
    { part: "banner", x: 8, y: 3 },
    { part: "rod", x: 5, y: 2 },
    { part: "collar", x: 5, y: 2 },
    { part: "collar", x: 106, y: 2 },
    { part: "finial", x: 0, y: 1 },
    { part: "finial", x: 108, y: 1 },
  ];
  // A glint sliding along the rod's lit row.
  const gx = 8 + i * 19;
  const specks: Speck[] = [[gx, 2, "M"], [gx + 1, 2, "M"], [gx + 2, 2, "M"], [gx - 1, 2, "y"], [gx + 3, 2, "y"], [gx + 1, 3, "y"]];
  return { layers, ms: 220, specks };
}

export const ARENA_CUP_BANNER: Character = {
  id: "arena-cup-banner",
  name: "Cup banner",
  w: W,
  h: H,
  foot: [56, 1],
  palette: PALETTE,
  halo: "#fbf0d833",
  parts,
  anims: {
    idle: { loop: true, frames: [0, 1, 2, 3, 4, 5].map(frame) },
  },
};
