import type { Character, Frame, Speck } from "../../../../packages/app/src/characters/sprite.ts";
import { paint, grain } from "../../../../packages/app/src/town/houses/kit.ts";

const C = 20; // the crest's middle (pixel corner)
const rad = (x: number, y: number) => Math.hypot(x + 0.5 - C, y + 0.5 - C);
const inside = (x: number, y: number) => rad(x, y) < 13.6;

// The crest: gold rim, dark ring, navy sky, cobbles at the foot.
const disc = paint(0, 0, 40, 40, (x, y) => {
  const dx = x + 0.5 - C;
  const dy = y + 0.5 - C;
  const r = Math.hypot(dx, dy);
  if (r > 18.4) return null;
  if (r > 15) {
    const lit = (-dx - dy) / (r * Math.SQRT2);
    // rivets round the band
    const a = Math.atan2(dy, dx);
    const step = Math.PI / 4;
    const near = Math.abs(a / step - Math.round(a / step)) * step * r < 0.6;
    if (near && r > 16.2 && r < 17.3) return "O";
    if (r > 17.6) return lit > 0.3 ? "Y" : lit < -0.4 ? "O" : "Y";
    return lit > 0.35 ? "y" : lit < -0.45 ? "O" : "Y";
  }
  if (r > 14.2) return "k";
  if (y >= 30) {
    // cobbles: staggered stones, lit along their tops
    const row = Math.floor((y - 30) / 2);
    const j = (y - 30) % 2;
    const off = row % 2 ? 2 : 0;
    const i = (x + off) % 4;
    if (i === 3) return "q";
    if (j === 0) return i === 0 ? "m" : "o";
    return grain(x, y, 3) > 0.7 ? "q" : "o";
  }
  if (y === 29) return "q";
  if (y >= 25) return "n";
  return "N";
});

// The left house: cream walls, red roof, a lit window and a door.
const houseL = paint(4, 15, 12, 15, (x, y) => {
  if (!inside(x, y)) return null;
  const j = y - 15;
  if (j <= 5) {
    const half = j + 0.5;
    const d = x + 0.5 - 10;
    if (Math.abs(d) > half + 0.2) return null;
    return d < -half + 1.5 ? "p" : d > half - 1.5 ? "R" : "r";
  }
  if (x < 6 || x > 14) return null;
  if (x >= 7 && x <= 8 && y >= 22 && y <= 24) return "u";
  if (x >= 11 && x <= 12 && y >= 25) return "d";
  return x === 14 ? "W" : "w";
});

// The clock tower, behind on the right.
const tower = paint(23, 9, 8, 21, (x, y) => {
  if (!inside(x, y)) return null;
  const j = y - 9;
  if (j <= 4) {
    const half = j * 0.6 + 0.4;
    const d = x + 0.5 - 27;
    if (Math.abs(d) > half) return null;
    if (j === 0) return "Y";
    return d < -0.5 ? "p" : d > 0.8 ? "R" : "r";
  }
  if (x < 25 || x > 29) return null;
  // the clock face: a white disc with two hands
  const cd = Math.hypot(x + 0.5 - 27.5, y + 0.5 - 16.5);
  if (cd < 1.8) return (x === 27 && (y === 16 || y === 15)) || (x === 28 && y === 16) ? "O" : "y";
  if (x === 27 && (y === 21 || y === 22)) return "x";
  if (y === 14) return "c";
  return x === 25 ? "a" : x === 29 ? "c" : "b";
});

// The right house, in front of the tower's foot.
const houseR = paint(27, 18, 9, 12, (x, y) => {
  if (!inside(x, y)) return null;
  const j = y - 18;
  if (j <= 4) {
    const half = j + 0.6;
    const d = x + 0.5 - 31.5;
    if (Math.abs(d) > half) return null;
    return d < -half + 1.5 ? "p" : d > half - 1.2 ? "R" : "r";
  }
  if (x < 28) return null;
  if (x >= 30 && x <= 31 && y >= 24 && y <= 26) return "v";
  return "w";
});

// The giant pawn, front and middle.
const pawnHalf = (y: number): number => {
  if (y < 9) return -1;
  if (y <= 15) {
    const d = y + 0.5 - 12.5;
    return Math.sqrt(Math.max(0, 3.7 * 3.7 - d * d));
  }
  if (y <= 17) return 4.6; // collar
  if (y <= 25) return 2.4 + ((y - 18) / 7) ** 2 * 2.4; // the waist flaring out
  if (y <= 27) return 5.8;
  return 7;
};
const pawn = paint(12, 9, 16, 21, (x, y) => {
  const hw = pawnHalf(y);
  const d = x + 0.5 - C;
  if (hw < 0 || Math.abs(d) > hw) return null;
  const t = d / hw;
  if (y === 16 || y === 26 || y === 28) {
    // the rims of the collar and base: lit tops
    return t < 0.4 ? "M" : "m";
  }
  if (y <= 15 && t < -0.1 && t > -0.75 && y >= 10 && y <= 12) return "M";
  return t < -0.35 ? "M" : t > 0.45 ? "o" : "m";
});

const W = (part: string, at: readonly [number, number]) => ({ part, x: at[0], y: at[1] });
const layers = [W("disc", disc.at), W("tower", tower.at), W("houseR", houseR.at), W("houseL", houseL.at), W("pawn", pawn.at)];

// A glint riding round the rim, a quarter turn a frame.
function glint(i: number): Speck[] {
  const a = (-135 + i * 90) * (Math.PI / 180);
  const r = 16.7;
  const at = (da: number, rr = r): [number, number] => [Math.floor(C + rr * Math.cos(a + da) - 0.5 + 0.5), Math.floor(C + rr * Math.sin(a + da) - 0.5 + 0.5)];
  const [x, y] = at(0);
  const [x1, y1] = at(0.09);
  const [x2, y2] = at(-0.09);
  return [[x1, y1, "y"], [x2, y2, "y"], [x, y - 2, "y"], [x, y + 2, "y"], [x - 2, y, "y"], [x + 2, y, "y"], [x, y - 1, "M"], [x, y + 1, "M"], [x - 1, y, "M"], [x + 1, y, "M"], [x, y, "M"]];
}

const LIT = "#ffd36a";
const frame = (i: number): Frame => ({
  layers,
  ms: 300,
  specks: [...glint(i), [9, 4, "y"]].filter((s) => s[0] !== 9) as Speck[],
  pal: i >= 2 ? { v: LIT } : undefined,
});

export const ARENA_TOWN_BADGE: Character = {
  id: "arena-town-badge",
  name: "Chess Town crest",
  w: 40,
  h: 40,
  foot: [20, 39],
  palette: {
    k: "#2a1c14",
    Y: "#f4b740",
    y: "#ffe08a",
    O: "#b97c10",
    N: "#1f2a44",
    n: "#34466e",
    M: "#f7f4ee",
    m: "#d9d3c7",
    o: "#a39b8d",
    q: "#6b6358",
    r: "#c4513a",
    R: "#8f3226",
    p: "#e27a55",
    w: "#efe0c0",
    W: "#c9b48a",
    d: "#6a4428",
    a: "#d8c49a",
    b: "#b39c72",
    c: "#857150",
    u: LIT,
    v: "#3a3350",
    x: LIT,
  },
  halo: "#ffe08a33",
  parts: {
    disc: disc.part,
    tower: tower.part,
    houseL: houseL.part,
    houseR: houseR.part,
    pawn: pawn.part,
  },
  anims: {
    idle: { loop: true, frames: [0, 1, 2, 3].map(frame) },
  },
};
