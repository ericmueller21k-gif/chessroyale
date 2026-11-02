import type { Character } from "../../../../packages/app/src/characters/sprite.ts";
import { paint, grain } from "../../../../packages/app/src/town/houses/kit.ts";

// A slice of the arena's podium wall: blocks in courses, one round arch, a cornice on top, a plinth at the foot.
// 64 x 64, repeats side by side (blocks 16 wide, so the left and right edges join).
const W = 64;
const H = 64;
const CX = 32; // arch centre (between pixels 31 and 32)
const R_IN = 10; // opening radius
const R_OUT = 15.6; // voussoir ring outer radius
const SPRING = 38; // springline (arch centre row)
const PLINTH = 54;

function key(x: number, y: number): string {
  const px = x + 0.5 - CX;
  const py = y + 0.5 - SPRING;
  const d = Math.hypot(px, py);

  // Cornice / coping: top 6 rows.
  if (y === 0) return "k";
  if (y <= 5) {
    if (y === 1) return grain(x, y, 3) < 0.15 ? "2" : "1";
    if (y === 2) return "2";
    if (y === 3) return (x % 32 === 31) ? "4" : grain(x, y, 4) < 0.12 ? "3" : "2";
    if (y === 4) return "4";
    return "6"; // shadow under the coping
  }

  // The opening.
  const inOpen = (y >= SPRING ? Math.abs(px) < R_IN : d < R_IN) && y <= 62;
  if (inOpen) {
    const edge = y >= SPRING ? R_IN - Math.abs(px) : R_IN - d;
    if (edge < 1) return "k";
    if (px > 0 && edge < 3 && y > SPRING - 6) return "x"; // the right reveal catches a little light
    if (y < SPRING && edge < 3 && px < 3) return "x";
    if (y >= 60) return "x"; // floor of the passage
    return "z";
  }
  if (y === 63) return "k";

  // Voussoirs.
  if (y < SPRING && d < R_OUT) {
    if (d >= R_OUT - 1) return "k";
    const ang = Math.atan2(-py, px); // 0 right, PI left
    const n = 7;
    const seg = (ang / Math.PI) * n;
    const s = Math.floor(seg);
    const f = seg - s;
    if ((f < 0.1 || f > 0.9) && d > R_IN + 0.6) return "6"; // joints
    const lit = s >= 4; // upper-left wedges face the light
    const key4 = s === 3;
    if (key4) return d > R_OUT - 2.2 ? "1" : f < 0.35 ? "1" : "2";
    if (d > R_OUT - 2.2) return lit ? "1" : s >= 3 ? "2" : "3";
    if (d < R_IN + 1) return lit ? "3" : "5";
    return lit ? "2" : s >= 2 ? "3" : "4";
  }
  // keystone stands proud a pixel above the ring
  if (y < SPRING && d < R_OUT + 1.2 && Math.abs(px) < 2.2) return "1";

  // Impost blocks where the arch springs.
  if ((y === SPRING || y === SPRING + 1) && Math.abs(px) < R_OUT + 1) {
    return y === SPRING ? (px < 0 ? "1" : "2") : "5";
  }

  // Plinth course.
  if (y >= PLINTH) {
    const j = y - PLINTH;
    if (j === 0) return "3";
    if ((x + 4) % 32 === 31) return "6";
    if (j === 8) return "6";
    if ((x + 4) % 32 === 0) return "4";
    return grain(x, y, 7) < 0.1 ? "5" : grain(x, y, 8) < 0.06 ? "3" : "4";
  }

  // Blocks in courses (7 rows + a mortar row).
  const cy = y - 6;
  const course = Math.floor(cy / 8);
  const r = cy % 8;
  if (r === 7) return "5";
  const off = course % 2 ? 8 : 0;
  const bx = (x + off) % 16;
  if (bx === 15) return "5";
  if (r === 0 && bx === 0) return "1";
  if (r === 0 || bx === 0) return "2";
  if (r === 6 || bx === 14) return "4";
  const g = grain(x, y, 11 + course);
  if (g < 0.04) return "4";
  if (g > 0.97) return "2";
  return "3";
}

const wall = paint(0, 0, W, H, (x, y) => key(x, y), false);

export const ARENA_WALL: Character = {
  id: "arena-wall",
  name: "Arena wall",
  w: W,
  h: H,
  foot: [32, 63],
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
  },
  parts: { wall: wall.part },
  anims: {
    idle: { loop: true, frames: [{ ms: 1000, layers: [{ part: "wall", x: 0, y: 0 }] }] },
  },
};
