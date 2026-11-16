import type { Character, Part } from "../../characters/sprite.ts";
import { paint, grain } from "../../town/houses/kit.ts";

/** The arena floor (pale flags, tiles both ways) and the giant board's raised stone border (side, corner). */
const PALETTE = {
  k: "#2a1c14",
  "1": "#fbf0d8", "2": "#ecd9b2", "3": "#d8bf93", "4": "#bb9e70", "5": "#93784f", "6": "#6a5539",
  x: "#2e2018", z: "#150e0a",
  N: "#1f2a44", n: "#34466e",
  Y: "#f4b740", y: "#ffe08a", O: "#b97c10",
  M: "#f7f4ee", m: "#d9d3c7", o: "#a39b8d",
};

// ---- floor: staggered flags 16 x 8, joints in a soft tan, a lit top-left lip on each flag.
const floor = paint(0, 0, 32, 32, (x, y) => {
  // big flags: top half two 16 x 16, bottom half split 12 / 20 at an offset, so no brick rows read
  const top = y < 16;
  const jy = y % 16;
  const jx = top ? x % 16 : (x + 26) % 32 < 12 ? (x + 26) % 32 : (x + 26) % 32 - 12;
  const wEnd = top ? 15 : (x + 26) % 32 < 12 ? 11 : 19;
  if (jy === 15 || jx === wEnd) return "3";
  if ((jy === 0 || jx === 0) && grain(x, y, 3) < 0.6) return "1";
  const g = grain(x, y, 7);
  if (g < 0.025) return "3";
  if (g > 0.97) return "1";
  return "2";
}, false);

// ---- side: top face y0..6 (lit), front face y7..11 (shade); blocks 16 wide, front joints offset by 8.
function sideKey(x: number, y: number): string | null {
  if (y === 0) return "k";
  if (y === 1) return "2";
  if (y <= 5) {
    if (x % 16 === 15) return "4";
    if (x % 16 === 0) return "2";
    return grain(x, y, 11) < 0.06 ? "4" : "3";
  }
  if (y === 6) return "4"; // the rounded front lip
  if (y === 11) return "k";
  if ((x + 8) % 16 === 15) return "6";
  if (y === 7) return "4";
  return grain(x, y, 13) < 0.07 ? "6" : "5";
}
const side = paint(0, 0, 32, 12, (x, y) => (y < 12 ? sideKey(x, y) : null), false);

// ---- corner: the same profile turning down the left side (x mirrors y), mitred on the diagonal.
const corner = paint(0, 0, 12, 12, (x, y) => {
  if (x === 0 || y === 0) return "k";
  if (y <= 6 && y <= x) return y === 1 ? "2" : y === 6 ? "4" : x <= 5 ? (x === 1 ? "2" : "3") : sideKey(x, y);
  if (x <= 6 && x < y) return x === 1 ? "2" : x === 6 ? "4" : "3";
  // inner corner: the top side's front face (below) and the left side's inner face (right), split on the diagonal
  if (x === 11 && y >= 7) return "k";
  if (y >= x) return x === 7 ? "4" : "6"; // left side's inner face, deeper shade
  return y === 11 ? "k" : y === 7 ? "4" : "5";
}, false);

const parts: Record<string, Part> = { floor: floor.part, side: side.part, corner: corner.part };
const still = (p: string) => ({ frames: [{ layers: [{ part: p, x: 0, y: 0 }], ms: 1000 }], loop: false });

export const ARENA_FLOOR: Character = {
  id: "arena-floor",
  name: "Arena floor",
  w: 32,
  h: 32,
  foot: [0, 0],
  palette: PALETTE,
  parts,
  anims: { floor: still("floor"), side: still("side"), corner: still("corner") },
};
