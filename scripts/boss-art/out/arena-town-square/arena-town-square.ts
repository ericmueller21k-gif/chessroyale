import type { Character, Frame, Layer, Part, Speck } from "../../../../packages/app/src/characters/sprite.ts";
import { grain, paint } from "../../../../packages/app/src/town/houses/kit.ts";

const PALETTE: Record<string, string> = {
  k: "#2a1c14",
  M: "#f7f4ee", m: "#d9d3c7", o: "#a39b8d",
  Y: "#f4b740", y: "#ffe08a", O: "#b97c10",
  N: "#1f2a44", n: "#34466e", B: "#5a73a8",
  T: "#e8805a", R: "#d0533a", r: "#9e3a2a",
  G: "#9fd36a", g: "#6db34a", h: "#4a8a36", j: "#2f6128",
  c: "#f2dfb4", d: "#d8be8c", p: "#f0b48a", q: "#d08e66", s: "#cfe0ec", t: "#a8bfd0",
  W: "#b98454", w: "#8a5a32", V: "#5e3b1e",
  a: "#a9dcf2", e: "#6bb6dc",
  "1": "#e6dfd2", "2": "#bfb6a6", "3": "#9a9081", "4": "#73695c",
  J: "#6c707b", I: "#4a4d55",
  L: "#f4dcae", D: "#8e6440",
  X: "#6a615a", x: "#3e3834", z: "#26211f",
  b: "#c8553d",
};

type Placed = { part: Part; at: readonly [number, number] };
const parts: Record<string, Part> = {};
const still: Layer[] = [];
const add = (name: string, p: Placed) => {
  parts[name] = p.part;
  still.push({ part: name, x: p.at[0], y: p.at[1] });
};

// ---- The cobbled plaza.
add("ground", paint(1, 26, 110, 9, (x, y) => {
  const row = y - 26;
  const off = row % 2 ? 2 : 0;
  if ((x + off) % 4 === 0 || row % 2 === 1 && false) return "3";
  if (row === 0) return "3";
  const g = grain(Math.floor((x + off) / 4), y, 3);
  if (row === 8) return "3";
  return g > 0.7 ? "1" : g < 0.2 ? "3" : "2";
}));

// ---- House fronts: a gable roof, a wall, a window, a striped awning over a shop window, a door.
function house(x0: number, w: number, peak: number, wallTop: number, roof: string, wall: string, awn: string, doorLeft: boolean, seed: number): Placed {
  const cx = x0 + (w - 1) / 2;
  const foot = 26;
  return paint(x0 - 1, peak, w + 2, foot - peak, (x, y) => {
    const i = x - x0;
    if (y < wallTop) {
      const half = ((y - peak + 1) / (wallTop - peak)) * (w / 2 + 1);
      if (Math.abs(x + 0.5 - (cx + 0.5)) > half) return null;
      if ((y - peak) % 3 === 2) return roof[2]!;
      return x < cx ? roof[0]! : roof[1]!;
    }
    if (i < 0 || i >= w) return null;
    const r = y - wallTop;
    // upper window
    const wx = Math.round(cx) - 2;
    if (r >= 1 && r <= 4 && x >= wx && x <= wx + 4) {
      if (r === 1 || r === 4 || x === wx || x === wx + 4 || x === wx + 2) return "V";
      return x === wx + 1 && r === 2 ? "a" : r === 2 ? "a" : "e";
    }
    // awning over the shop front
    const ax0 = doorLeft ? x0 + 8 : x0 + 1;
    const ax1 = doorLeft ? x0 + w - 2 : x0 + w - 9;
    const ar = foot - 9; // awning top row
    if (!awn) {
      // no shop: a plain wall behind the table, a flower box under the window
      if (r === 5 && x >= wx - 1 && x <= wx + 5) return (x - wx) % 2 ? "G" : "b";
      if (r === 6 && x >= wx - 1 && x <= wx + 5) return "w";
    } else if (x >= ax0 && x <= ax1 && y >= ar && y <= ar + 2) {
      if (y === ar + 2 && (x - ax0) % 2 === 1) return wall[0]!;
      return Math.floor((x - ax0) / 2) % 2 ? awn[1]! : awn[0]!;
    }
    if (awn && x >= ax0 + 1 && x <= ax1 - 1 && y >= ar + 4 && y <= foot - 2) {
      if (y === foot - 2) return "V";
      return (x - ax0) % 4 === 0 ? "V" : y === ar + 4 ? "a" : "e";
    }
    // door
    const dx0 = doorLeft ? x0 + 2 : x0 + w - 7;
    if (x >= dx0 && x <= dx0 + 4 && y >= foot - 8) {
      if (x === dx0 + 3 && y === foot - 4) return "Y";
      return x === dx0 ? "W" : x === dx0 + 4 ? "V" : "w";
    }
    // wall, lit on its left, shaded under the eaves
    if (r === 0 || i === w - 1 || grain(x, y, seed) > 0.93) return wall[1]!;
    return wall[0]!;
  });
}
add("h1", house(13, 25, 3, 12, "TRr", "cd", "RM", true, 1));
add("h2", house(40, 27, 1, 11, "Bnn", "pq", "", true, 2));
add("h3", house(69, 25, 4, 13, "TRr", "st", "NY", true, 3));

// ---- A round tree on the left.
add("trunk", paint(7, 18, 3, 9, (x) => (x === 7 ? "W" : x === 8 ? "w" : "V")));
add("crown", paint(1, 3, 16, 17, (x, y) => {
  const clumps: [number, number, number][] = [[8.5, 12, 6.5], [5, 9, 4.5], [11.5, 8.5, 4.5], [8.5, 6, 4.5]];
  let hit: [number, number, number] | null = null;
  for (const c of clumps) if (Math.hypot(x + 0.5 - c[0], y + 0.5 - c[1]) < c[2]) hit = c;
  if (!hit) return null;
  const l = -0.6 * (x + 0.5 - hit[0]) / hit[2] - 0.7 * (y + 0.5 - hit[1]) / hit[2] + (grain(x, y, 7) - 0.5) * 0.5;
  return l > 0.45 ? "G" : l > -0.25 ? "g" : "h";
}));

// ---- A lamppost on the right.
add("lampFoot", paint(97, 31, 5, 2, (x, y) => (y === 31 && (x === 97 || x === 101) ? null : x < 99 ? "J" : "I")));
add("pole", paint(98, 9, 3, 22, (x, y) => (y === 18 ? (x === 98 ? "J" : "I") : x === 99 ? (x === 99 && y > 9 ? "I" : "I") : x === 98 ? "J" : null)));
add("lamp", paint(96, 2, 7, 7, (x, y) => {
  const i = x - 96, j = y - 2;
  if (j === 0) return i >= 2 && i <= 4 ? "I" : null;
  if (j === 1) return i >= 1 && i <= 5 ? (i < 3 ? "J" : "I") : null;
  if (j === 6) return i >= 1 && i <= 5 ? "I" : null;
  if (i === 0 || i === 6) return null;
  if (i === 1 || i === 5 || i === 3) return "I";
  return j < 4 && i === 2 ? "y" : "Y";
}));

// ---- A flower box and a bench-ish crate to keep it busy: little flower pots in front of house 3.
add("pots", paint(82, 23, 9, 3, (x, y) => {
  if (y === 23) return (x - 82) % 2 === 0 ? ((x - 82) % 4 === 0 ? "b" : "Y") : "g";
  return y === 24 ? "W" : "w";
}));

// ---- The park table with its chessboard, its stools.
add("leg", paint(55, 26, 3, 6, (x) => (x === 55 ? "2" : x === 56 ? "3" : "4")));
add("tfoot", paint(52, 31, 9, 2, (x, y) => (y === 31 ? (x < 55 ? "1" : "2") : "3")));
add("top", paint(46, 21, 21, 5, (x, y) => {
  if (y >= 24) return y === 24 ? (x < 50 ? "W" : "w") : "V";
  const i = x - 48;
  if (x <= 47 || x >= 65) return x <= 47 ? "W" : "w";
  return (Math.floor(i / 2) + (y - 21)) % 2 ? "D" : "L";
}));
const stool = (x0: number): Placed => paint(x0, 29, 7, 4, (x, y) => (y === 29 ? (x < x0 + 3 ? "1" : "2") : x < x0 + 2 ? "2" : x > x0 + 4 ? "4" : "3"));
add("stoolL", stool(37));
add("stoolR", stool(69));

// Pieces standing on the board (the hopping one is added per frame).
const pc = (cols: string) => ({ grid: [`.${cols[0]}.`, cols.slice(0, 3)] });
parts.pW = pc("MMm");
parts.pB = pc("xxz");
const boardPieces: Layer[] = [
  { part: "pB", x: 49, y: 19 },
  { part: "pB", x: 61, y: 19 },
  { part: "pW", x: 58, y: 19 },
];

// ---- The pawns: the game's pawn shape, banded from the top left.
const pawnRows = [1, 2, 2, 1, 2, 1, 1, 1, 2, 3, 3];
const pawn = (ramp: string): Part =>
  paint(0, 0, 7, pawnRows.length, (x, y) => {
    const hw = pawnRows[y]!;
    const d = x - 3;
    if (Math.abs(d) > hw) return null;
    if (y === 4) return ramp[2]!; // the collar's lit top
    if (d === -hw && hw > 1) return ramp[2]!;
    if (y === 1 && d === -1) return ramp[2]!;
    if (d >= hw - (hw > 1 ? 0 : 0) && d > 0) return ramp[0]!;
    return ramp[1]!;
  }).part;
parts.pawnW = pawn("omM");
parts.pawnB = pawn("zxX");

parts.birdUp = { grid: ["b...b", ".bbb."] };
parts.birdDn = { grid: [".bbb.", "b...b"] };

// ---- The idle: the white pawn hops a piece across the board, the black one bobs, a bird flits over.
const hop: [number, number][] = [[51, 20], [52, 18], [54, 17], [56, 18], [53, 20], [51, 20]];
const hopNow: [number, number][] = [[52, 19], [53, 16], [54, 15], [55, 19], [55, 19], [55, 19]];
void hop;
const lean = [0, -1, -1, 0, 0, 0];
const bob = [0, 0, -1, -1, 0, 0];
const birdAt: [number, number][] = [[104, 9], [88, 6], [72, 8], [56, 5], [40, 7], [24, 4]];

const frames: Frame[] = hopNow.map(([px, py], f) => {
  const [bx, by] = birdAt[f]!;
  const layers: Layer[] = [
    ...still,
    ...boardPieces,
    { part: "pW", x: px, y: py },
    { part: "pawnW", x: 37 + (f >= 1 && f <= 3 ? 1 : 0), y: 18 + lean[f]! },
    { part: "pawnB", x: 69, y: 18 + bob[f]! },
    { part: f % 2 ? "birdDn" : "birdUp", x: bx, y: by },
  ];
  const specks: Speck[] = [];
  return { ms: 250, layers, specks };
});

export const ARENA_TOWN_SQUARE: Character = {
  id: "arena-town-square",
  name: "Town square",
  w: 112,
  h: 36,
  foot: [56, 34],
  palette: PALETTE,
  halo: "#fff4dc30",
  parts,
  anims: { idle: { loop: true, frames } },
};
