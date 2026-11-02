import type { Character, Layer } from "../../../../packages/app/src/characters/sprite.ts";

const KNIGHT = [
  "....Mm........",
  "...MMMm.......",
  "..MMMMMmm.....",
  "..MMMMMMmm....",
  ".MMMkkMMMmm...",
  ".MMMMMMMMMmm..",
  ".MMMMMMMMMMmo.",
  "MMMMMMMMmmmooo",
  "MMMMMMMm.oooo.",
  "MMMMMMm.......",
  "MMMMMMmm......",
  ".MMMMMMmm.....",
  ".MMMMMMmmo....",
  ".MMMMMMmmo....",
  ".MMMMMMmmo....",
  "MMMMMMMmmoo...",
  "MMMMMMMMmmoo..",
  ".mmmmmmmmooo..",
  "MMMMMMMMMmmooo",
  "MMMMMMMMMmmooo",
  "mmmmmmmmmooooo",
];

const ROOK = [
  "MM..MM..mo",
  "MMMMMMmmmo",
  "MMMMMMmmmo",
  ".MMMMmmmo.",
  ".MMMMmmmo.",
  ".MMMMmmmo.",
  ".MMMMmmmo.",
  ".MMMMmmmo.",
  ".MMMMmmmo.",
  ".MMMMmmmo.",
  "MMMMMMmmoo",
  "mmmmmmmooo",
  "MMMMMMmmoo",
  "mmmmmmoooo",
];

const PAWN = [
  "..MMm...",
  ".MMMMm..",
  ".MMMmmo.",
  "..Mmmo..",
  ".MMMmmo.",
  "..MMmo..",
  "..MMmo..",
  "..MMmo..",
  ".MMMmmo.",
  "MMMMmmoo",
  "mmmmmooo",
];

const POLE = [
  "........y",
  "........O",
  ".......O.",
  ".......O.",
  "......O..",
  "......O..",
  ".....O...",
  ".....O...",
  "....O....",
  "....O....",
  "...O.....",
  "...O.....",
  "..O......",
  "..O......",
];

const FLAG_A = [
  ".RRRRRRR",
  "..RRRRRr",
  "...RRRr.",
  "..RRRRr.",
  ".Rrrrr..",
];
const FLAG_B = [
  "RRRRRRRR",
  ".RRRRRRr",
  "..RRRRr.",
  ".RRRRRr.",
  "Rrrrr...",
];

const STAR = ["..Y..", ".YyY.", "YyyyO", ".YyO.", "..O.."];
const STAR_SMALL = [".Y.", "YyO", ".O."];
const PUFF = [".dd.", "dddD", ".DD."];
const PUFF_S = ["dd", "dD"];

const BOB = [0, -1, -1, 0];

function frame(i: number) {
  const b = (phase: number) => BOB[(i + phase) % 4]!;
  const rb = b(2);
  const pb = b(1);
  const kb = b(0);
  const tw = i % 2 === 1;
  const layers: Layer[] = [
    // dust kicked back from the feet, drifting left
    { part: i % 2 ? "puffS" : "puff", x: 8 - i, y: 28 },
    { part: i % 2 ? "puff" : "puffS", x: 3 - (i >> 1), y: 28 + (i % 2) },
    { part: "pole", x: 3, y: 0 + rb },
    { part: tw ? "flagB" : "flagA", x: 3 - (tw ? 1 : 0), y: 1 + rb },
    { part: "rook", x: 1, y: 13 + rb },
    { part: "pawn", x: 9, y: 18 + pb },
    { part: "knight", x: 16, y: 10 + kb },
    tw ? { part: "starS", x: 18, y: 5 + kb } : { part: "star", x: 17, y: 4 + kb },
    tw ? { part: "star", x: 24, y: 1 + kb } : { part: "starS", x: 25, y: 2 + kb },
  ];
  return { layers, ms: 200, cue: i % 2 ? undefined : "step" };
}

export const ARENA_AUTO_CARD: Character = {
  id: "arena-auto-card",
  name: "Auto chess army",
  w: 32,
  h: 32,
  foot: [16, 30],
  palette: {
    k: "#2a1c14",
    M: "#f7f4ee",
    m: "#d9d3c7",
    o: "#a39b8d",
    Y: "#f4b740",
    y: "#ffe08a",
    O: "#b97c10",
    R: "#d24a3c",
    r: "#8e2a26",
    d: "#cfba96",
    D: "#9a8566",
  },
  halo: "#ffffff22",
  parts: {
    knight: { grid: KNIGHT },
    rook: { grid: ROOK },
    pawn: { grid: PAWN },
    pole: { grid: POLE },
    flagA: { grid: FLAG_A },
    flagB: { grid: FLAG_B },
    star: { grid: STAR },
    starS: { grid: STAR_SMALL },
    puff: { grid: PUFF, outline: false },
    puffS: { grid: PUFF_S, outline: false },
  },
  anims: {
    idle: { loop: true, frames: [0, 1, 2, 3].map(frame) },
  },
};
