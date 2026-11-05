/**
 * The street town's everyday buildings (Nov 5, final art; drawn by hand on the weekly plan usage). Eight designs, each in
 * three colourways, each a box (town-kit.ts TownBox): its front, its two sides in its material with its windows and trim
 * carried round, its roof as a few textured faces. At the town's 37 px a square; every one under 4 squares (148 px) tall, so
 * the computer's zoomed-in view keeps sky over the rooftops (town-art-nov5.md).
 *
 *   cottage    3 wide   a cottage behind a picket fence: siding, a shingled gable, shutters, flower boxes, a chimney
 *   townhouse  2 wide   three storeys: brick or plaster, a bay window, a stoop, a cornice, a slate mansard with a dormer
 *   skinny     3 or 2   a row of skinny houses, each its own colour and roof (a gable, a stepped gable, a flat cornice)
 *   flats      3 wide   small flats: brick, three floors of balconies with pots, an entrance canopy, a tank on the roof
 *   bakery     3 wide   a bakery and cafe: plaster, a striped awning, a window of loaves and cakes, a table out front
 *   shop       2 wide   a corner shop: a false front, a scalloped awning, a window of jars, fruit crates on the step
 *   block      4 wide   a bigger block behind the rows (unreachable): four floors of brick, arched top windows, a water tower
 *   tower      2 wide   a clock tower behind the rows: stone, a clock face, a belfry, a slate spire (the spire is roof faces)
 *
 * Signs carry pictures, never words or brands: a loaf on the bakery's, a jar on the shop's.
 */
import type { LightSpot } from "./houses/kit.ts";
import {
  awning, blockF, box, character, cornice, doorAt, flatRoof, flowerBox, gable, gableRoof, grain, MAT, paletteOf, quadF, shadow, sideArt, SQ, WARM, windowAt,
  type Colourway, type Face, type Mat, type Piece, type SideSpec, type TownBox,
} from "./town-kit.ts";

export type Design = "cottage" | "townhouse" | "skinny" | "flats" | "bakery" | "shop" | "block" | "tower";
export const DESIGN_NAMES: Record<Design, string> = {
  cottage: "Cottage", townhouse: "Townhouse", skinny: "Skinny houses", flats: "Small flats", bakery: "Bakery and cafe", shop: "Corner shop", block: "Big block (behind)", tower: "Clock tower (behind)",
};
/** Each design's lot width (squares) and whether it stands behind the rows. */
export const DESIGN_LOT: Record<Design, { w: readonly number[]; behind: boolean }> = {
  cottage: { w: [3, 2], behind: false }, townhouse: { w: [2], behind: false }, skinny: { w: [3, 2], behind: false }, flats: { w: [3], behind: false },
  bakery: { w: [3], behind: false }, shop: { w: [2], behind: false }, block: { w: [4], behind: true }, tower: { w: [2], behind: true },
};

// ---- Colour ramps (dark, mid, light).
const R = {
  butter: ["#d2ad5c", "#efd48a", "#fbeab4"], sky: ["#7f9fc4", "#a7c4e2", "#d0e2f3"], mint: ["#84b897", "#acd8bb", "#d4efdd"],
  rose: ["#cf8594", "#eeaebb", "#f9d4db"], lilac: ["#9f90c8", "#c3b6e6", "#e0d8f6"], peach: ["#d3925f", "#eeb488", "#f8d5b6"],
  cream: ["#c9b48e", "#e8dcc0", "#f7f0de"], sage: ["#8a9c76", "#adbf98", "#d2dfc0"],
  redbrick: ["#7e3f2e", "#a55642", "#c3765c"], brownbrick: ["#6c4e3e", "#8e6c56", "#ae8b72"], greybrick: ["#5a6377", "#7a8499", "#9ba6ba"], tanbrick: ["#8a6a45", "#a9895f", "#c8aa7e"],
  greystone: ["#8d877c", "#b2ac9f", "#d4cfc4"], warmstone: ["#a08a6c", "#c4ae8c", "#e2d2b4"], bluestone: ["#7a8796", "#9eabb9", "#c3ced9"],
} as const;
const ROOF = {
  red: ["#8a2c27", "#b4443a", "#d8695a"], slate: ["#38465f", "#52637f", "#7488a6"], green: ["#3d6438", "#55864d", "#79aa6c"],
  brown: ["#674630", "#8a6244", "#ad835e"], teal: ["#2c6566", "#3c8886", "#5fabaa"], plum: ["#5a3a5e", "#7a5480", "#9e78a3"],
} as const;
const AWN = { red: ["#d84545", "#fbf3e6"], blue: ["#3f86c9", "#fbf3e6"], green: ["#3f9a55", "#fbf3e6"], orange: ["#e58a2f", "#fff2d6"], plum: ["#9c55b8", "#fbf3e6"] } as const;

/** Three colourways a design (and the material its walls are in, where a colourway changes it). */
export const COLOURWAYS: Record<Design, readonly (Colourway & { mat?: Mat })[]> = {
  cottage: [
    { name: "Butter, red roof", wall: R.butter, roof: ROOF.red, door: "#3f6b3f" },
    { name: "Sky, slate roof", wall: R.sky, roof: ROOF.slate, door: "#a33a3a" },
    { name: "Rose, green roof", wall: R.rose, roof: ROOF.green, door: "#2f5d8a" },
  ],
  townhouse: [
    { name: "Red brick, slate", wall: R.redbrick, roof: ROOF.slate, door: "#2f4f7a", mat: "brick" },
    { name: "Cream plaster, teal", wall: R.cream, roof: ROOF.teal, door: "#8a2f3c", mat: "plaster" },
    { name: "Grey brick, plum", wall: R.greybrick, roof: ROOF.plum, door: "#d1a23a", mat: "brick" },
  ],
  skinny: [
    { name: "Mint, peach, lilac", wall: R.mint, roof: ROOF.red, door: "#7a4a2c", extra: ramp("123", R.peach, ramp("456", R.lilac)) },
    { name: "Sky, butter, rose", wall: R.sky, roof: ROOF.slate, door: "#8a2f3c", extra: ramp("123", R.butter, ramp("456", R.rose)) },
    { name: "Sage, cream, peach", wall: R.sage, roof: ROOF.brown, door: "#2f5d8a", extra: ramp("123", R.cream, ramp("456", R.peach)) },
  ],
  flats: [
    { name: "Red brick", wall: R.redbrick, roof: ROOF.slate, door: "#2f4f7a" },
    { name: "Tan brick", wall: R.tanbrick, roof: ROOF.brown, door: "#3f6b3f" },
    { name: "Grey brick", wall: R.greybrick, roof: ROOF.slate, door: "#8a2f3c" },
  ],
  bakery: [
    { name: "Cream, red awning", wall: R.cream, roof: ROOF.brown, door: "#7a4a2c", awning: AWN.red },
    { name: "Peach, blue awning", wall: R.peach, roof: ROOF.slate, door: "#2f5d8a", awning: AWN.blue },
    { name: "Mint, orange awning", wall: R.mint, roof: ROOF.red, door: "#8a2f3c", awning: AWN.orange },
  ],
  shop: [
    { name: "Butter, green awning", wall: R.butter, roof: ROOF.green, door: "#3f6b3f", awning: AWN.green, mat: "siding" },
    { name: "Lilac, plum awning", wall: R.lilac, roof: ROOF.plum, door: "#5a3f7a", awning: AWN.plum, mat: "plaster" },
    { name: "Sky, red awning", wall: R.sky, roof: ROOF.red, door: "#a33a3a", awning: AWN.red, mat: "siding" },
  ],
  block: [
    { name: "Red brick", wall: R.redbrick, roof: ROOF.brown, door: "#2f4f7a" },
    { name: "Brown brick", wall: R.brownbrick, roof: ROOF.brown, door: "#3f6b3f" },
    { name: "Grey brick", wall: R.greybrick, roof: ROOF.slate, door: "#8a2f3c" },
  ],
  tower: [
    { name: "Warm stone, slate", wall: R.warmstone, roof: ROOF.slate, door: "#6e4a2c" },
    { name: "Grey stone, green copper", wall: R.greystone, roof: ROOF.teal, door: "#6e4a2c" },
    { name: "Blue stone, red", wall: R.bluestone, roof: ROOF.red, door: "#6e4a2c" },
  ],
};
function ramp(keys: string, r: readonly string[], into: Record<string, string> = {}): Record<string, string> {
  return { ...into, [keys[0]!]: r[0]!, [keys[1]!]: r[1]!, [keys[2]!]: r[2]! };
}

/** What a design draws: its front's pieces and lights, its box's body, sides and roof. */
interface Drawn {
  W: number;
  H: number;
  P: Piece[];
  L: LightSpot[];
  body: { x0: number; x1: number };
  /** The side walls' heights (px) and what's on them; a right side may use other wall keys (a skinny row's last house). */
  eaveL: number;
  eaveR: number;
  side: SideSpec;
  sideR?: SideSpec & { keys?: string };
  sideKeysL?: string;
  roof: Face[];
  depth?: number;
}
const wallFn = (mat: Mat, keys = "abc") => (_i: number, _j: number, x: number, y: number) => {
  const k = MAT[mat](x, y);
  return k === "a" ? keys[0]! : k === "b" ? keys[1]! : keys[2]!;
};

function cottage(wsq: number, v: number): Drawn {
  const W = wsq * SQ, H = 108, F = H - 3;
  const P: Piece[] = [], L: LightSpot[] = [];
  const bw = Math.min(W - 18, 80), bx = Math.round((W - bw) / 2);
  const eave = 44, top = F - eave, rise = 32;
  P.push(shadow(W / 2, F, bw / 2 + 6));
  P.push(box(bx, top, bw, eave, wallFn("siding")));
  P.push(box(bx, F - 5, bw, 5, (i, j) => (j === 0 ? "X" : i % 9 === 0 ? "X" : "x"))); // a stone plinth
  P.push(gable(bx - 6, top + 2, bw + 12, rise));
  // The gable's round window.
  P.push(box(bx + bw / 2 - 6, top - 19, 12, 12, (i, j) => { const d = Math.hypot(i - 5.5, j - 5.5); return d > 6 ? null : d > 4.4 ? "g" : i === 5 || j === 5 ? "g" : i + j < 9 ? "j" : "i"; }));
  L.push({ x: bx + bw / 2 - 5, y: top - 18, w: 10, h: 10, keys: "ij", color: WARM, strength: 0.7 });
  doorAt(bx + bw / 2 - 7, F - 30, 14, 30, P, L, true);
  P.push(box(bx + bw / 2 - 10, F - 33, 20, 3, "G")); // the door's hood
  const wy = top + 9;
  windowAt(bx + 9, wy, 14, 15, P, L, { shut: "l" });
  windowAt(bx + bw - 23, wy, 14, 15, P, L, { shut: "l" });
  flowerBox(bx + 8, wy + 19, 16, P);
  flowerBox(bx + bw - 24, wy + 19, 16, P);
  // The picket fence across the lot, the gate open; a bush at each end; a path of stepping stones.
  P.push(box(0, F - 14, W, 14, (i, j) => {
    if (Math.abs(i + 0.5 - W / 2) < 10) return null;
    const p = i % 5;
    if (j === 5 || j === 10) return p === 4 ? "G" : "g";
    if (p >= 3) return null;
    if (j < 2 && p !== 1) return null;
    return p === 2 ? "G" : "g";
  }));
  for (const bxx of [1, W - 17]) P.push(box(bxx, F - 19, 16, 14, (i, j) => { const d = Math.hypot((i - 7.5) / 8, (j - 7.5) / 7); if (d > 1) return null; if (grain(i, j, 41) > 0.93) return "t"; return i + j < 10 ? "r" : d > 0.75 ? "S" : "s"; }));
  P.push(box(W / 2 - 6, F - 2, 12, 3, (i) => (i % 6 < 4 ? "x" : null), false));
  const body = { x0: bx, x1: bx + bw - 1 };
  return {
    W, H, P, L, body, eaveL: eave, eaveR: eave,
    side: { mat: "siding", rows: [{ y: 9, h: 15 }], every: 34, plinth: 5 },
    roof: [
      ...gableRoof(bx - 6, bx + bw + 6, eave - 1, bx + bw / 2, eave + rise, "shingle", 0, 1.04),
      ...blockF(bx + bw - 20, bx + bw - 11, 0.5, 0.64, eave + 10, eave + rise + 6, "wall", "tar"), // the chimney, back on the ridge's right
    ],
  };
}

function townhouse(wsq: number, v: number): Drawn {
  const W = wsq * SQ, H = 132, F = H - 3;
  const P: Piece[] = [], L: LightSpot[] = [];
  const mat = COLOURWAYS.townhouse[v]!.mat ?? "brick";
  const bx = 3, bw = W - 6, eave = 96, top = F - eave, mans = 16;
  P.push(shadow(W / 2, F, bw / 2 + 2));
  // The mansard (slate) and its dormer.
  P.push(box(bx + 1, top - mans, bw - 2, mans + 1, (i, j) => { const inset = Math.round((mans - j) * 0.35); if (i < inset || i > bw - 3 - inset) return null; return j % 4 === 3 ? "d" : (i + (j >> 2) * 3) % 7 === 0 ? "d" : i < bw / 2 ? "f" : "e"; }));
  P.push(box(bx + bw / 2 - 9, top - mans - 6, 18, 18, (i, j) => (j < 5 ? (Math.abs(i - 8.5) < j * 2 + 1.5 ? (j === 4 ? "G" : "e") : null) : i < 2 || i > 15 ? "g" : null)));
  windowAt(bx + bw / 2 - 6, top - mans + 1, 12, 9, P, L, { cross: false });
  P.push(box(bx, top, bw, eave, wallFn(mat)));
  P.push(cornice(bx - 2, top, bw + 4));
  P.push(box(bx - 1, top + 36, bw + 2, 3, (_i, j) => (j < 2 ? "g" : "G"))); // the string course
  for (const fy of [top + 10, top + 44]) {
    for (const wx of [bx + 8, bx + bw - 22]) {
      P.push(box(wx - 2, fy - 3, 18, 3, "x")); // a stone lintel
      windowAt(wx, fy, 14, 20, P, L);
      if (fy > top + 20) flowerBox(wx - 1, fy + 24, 16, P);
    }
  }
  // The ground floor: a bay window, the door up the stoop under a fanlight.
  P.push(box(bx + 3, F - 34, 28, 30, (i, j) => (j < 3 ? (j === 0 ? "G" : "g") : i === 0 || i === 27 || i === 9 || i === 18 ? "g" : j < 17 ? (i === 2 && j === 5 ? "I" : i + j < 14 ? "j" : "i") : j === 17 ? "g" : wallFn(mat)(i, j, i + bx, j))));
  L.push({ x: bx + 4, y: F - 31, w: 26, h: 14, keys: "ijI", color: WARM, strength: 0.9 });
  doorAt(bx + bw - 24, F - 40, 15, 31, P, L, true);
  P.push(box(bx + bw - 28, F - 9, 23, 9, (_i, j) => (j % 3 === 0 ? "g" : "x"))); // the stoop's steps
  P.push(box(bx + bw - 29, F - 24, 2, 15, "X"), box(bx + bw - 29, F - 25, 4, 2, "X")); // its rail
  const body = { x0: bx, x1: bx + bw - 1 };
  const h2 = eave + mans;
  return {
    W, H, P, L, body, eaveL: eave, eaveR: eave,
    side: { mat, rows: [{ y: 10, h: 20 }, { y: 44, h: 20 }, { y: 66, h: 18 }], every: 32, trim: [0, 36] },
    roof: [
      quadF([bx, 0, eave], [bx + 6, 0.06, h2], [bx + 6, 0.94, h2], [bx, 1, eave], "slate", "t"),
      quadF([bx + 6, 0.06, h2], [bx + bw - 6, 0.06, h2], [bx + bw - 6, 0.94, h2], [bx + 6, 0.94, h2], "tar", "u", true),
      quadF([bx + bw - 6, 0.06, h2], [bx + bw, 0, eave], [bx + bw, 1, eave], [bx + bw - 6, 0.94, h2], "slate", "t"),
      ...blockF(bx + bw / 2 - 9, bx + bw / 2 + 9, 0, 0.16, eave + 8, h2 + 6, "slate"), // the dormer's cheeks and its top
      ...blockF(bx + 1, bx + 11, 0.55, 0.72, h2 - 2, h2 + 10, "wall", "tar"), // a chimney stack on the party wall
    ],
  };
}

function skinny(wsq: number, v: number): Drawn {
  const n = wsq >= 3 ? 3 : 2;
  const W = wsq * SQ, H = 136, F = H - 3;
  const each = Math.floor((W - 2) / n);
  const P: Piece[] = [], L: LightSpot[] = [];
  const keys = ["abc", "123", "456"];
  P.push(shadow(W / 2, F, W / 2 - 2));
  const roof: Face[] = [];
  const hs: number[] = [];
  for (let k = 0; k < n; k++) {
    const x = 1 + k * each;
    const ky = keys[k]!;
    const style = (k + v) % 3;
    const tall = [98, 112, 104][(k + v) % 3]!;
    hs.push(tall);
    const top = F - tall;
    if (style === 0) {
      P.push(gable(x - 1, top + 2, each + 2, 18));
      roof.push(...gableRoof(x - 1, x + each + 1, tall - 1, x + each / 2, tall + 16, "shingle"));
    }
    if (style === 1) {
      // A stepped gable (a stair-stepped parapet over a ridge running back).
      P.push(box(x + 1, top - 16, each - 2, 17, (i, j) => { const step = Math.floor(j / 4) * 3 + 4; const off = Math.abs(i + 0.5 - (each - 2) / 2); if (off > step) return null; return j % 4 === 0 && off > step - 3 ? "g" : ky[2]!; }));
      roof.push(...gableRoof(x + 2, x + each - 2, tall - 1, x + each / 2, tall + 13, "clay", 0.04, 1));
    }
    P.push(box(x, top, each, tall, wallFn("siding", ky)));
    if (style === 2) {
      P.push(cornice(x - 1, top, each + 2));
      roof.push(...flatRoof(x, x + each, tall + 1));
    }
    for (let fy = top + 12, f = 0; fy < F - 40; fy += 26, f++) {
      windowAt(x + each / 2 - 6, fy, 12, 17, P, L, { arch: style === 1 && f === 0 });
      if (k === 1 && f === 1) P.push(box(x + each / 2 - 9, fy + 18, 18, 6, (i, j) => (j === 0 ? "X" : i % 3 === 0 ? "X" : null))); // a little balcony
    }
    doorAt(x + each / 2 - 6, F - 25, 12, 25, P, L, k % 2 === 0, k % 2 === 1);
    P.push(box(x + each / 2 - 8, F - 3, 16, 3, "x"));
  }
  const body = { x0: 1, x1: n * each };
  return {
    W, H, P, L, body, eaveL: hs[0]!, eaveR: hs[n - 1]!,
    side: { mat: "siding", rows: [{ y: 12, h: 17 }, { y: 38, h: 17 }, { y: 64, h: 17 }], every: 30 },
    sideR: { mat: "siding", rows: [{ y: 12, h: 17 }, { y: 38, h: 17 }, { y: 64, h: 17 }], every: 30, keys: keys[n - 1]! },
    roof,
  };
}

function flats(wsq: number, v: number): Drawn {
  const W = wsq * SQ, H = 146, F = H - 3;
  const P: Piece[] = [], L: LightSpot[] = [];
  const bx = 3, bw = W - 6, eave = 122, top = F - eave;
  P.push(shadow(W / 2, F, bw / 2 + 2));
  P.push(box(bx, top, bw, eave, wallFn("brick")));
  P.push(cornice(bx - 2, top, bw + 4));
  P.push(box(bx, F - 6, bw, 6, (i, j) => (j === 0 ? "G" : i % 12 === 0 ? "X" : "x")));
  const fh = 29;
  for (let f = 0; f < 3; f++) {
    const fy = top + 10 + f * fh;
    for (let k = 0; k < 2; k++) {
      const wx = bx + 9 + k * Math.round(bw / 2);
      P.push(box(wx - 2, fy - 3, 20, 3, "x"));
      windowAt(wx, fy, 16, 18, P, L);
      // The balcony: a slab, a railing, a pot of flowers on every other one.
      P.push(box(wx - 4, fy + 18, 24, 3, (_i, j) => (j ? "X" : "x")));
      P.push(box(wx - 4, fy + 10, 24, 8, (i, j) => (j === 0 ? "X" : i % 3 === 0 ? "X" : null)));
      if ((f + k + v) % 2 === 0) P.push(box(wx + 15, fy + 5, 6, 5, (_i, j) => (j < 2 ? "t" : j < 3 ? "s" : "q")));
    }
  }
  // The ground floor: a canopy over glass doors, a window each side.
  const gy = top + 10 + 3 * fh;
  P.push(box(bx + bw / 2 - 15, gy - 2, 30, 4, (_i, j) => (j < 2 ? "e" : "d")));
  P.push(box(bx + bw / 2 - 11, gy + 2, 22, F - gy - 2, (i, j) => (j < 2 ? "g" : i === 0 || i === 21 || i === 10 || i === 11 ? "g" : i === 3 && j === 4 ? "I" : i + j < 13 ? "j" : "i")));
  L.push({ x: bx + bw / 2 - 10, y: gy + 4, w: 20, h: F - gy - 4, keys: "ijI", color: WARM, strength: 1 });
  windowAt(bx + 7, gy + 3, 14, 14, P, L);
  windowAt(bx + bw - 21, gy + 3, 14, 14, P, L);
  const body = { x0: bx, x1: bx + bw - 1 };
  return {
    W, H, P, L, body, eaveL: eave, eaveR: eave,
    side: { mat: "brick", rows: [0, 1, 2, 3].map((f) => ({ y: 10 + f * fh, h: 16 })), every: 28, trim: [0], plinth: 6 },
    roof: [
      ...flatRoof(bx, bx + bw, eave + 1),
      ...blockF(bx + bw - 34, bx + bw - 14, 0.3, 0.52, eave + 6, eave + 20, "plank", "shingle"), // the water tank, on short legs
      ...blockF(bx + bw - 32, bx + bw - 30, 0.32, 0.34, eave, eave + 6, "metal"),
      ...blockF(bx + bw - 18, bx + bw - 16, 0.32, 0.34, eave, eave + 6, "metal"),
      ...blockF(bx + 8, bx + 18, 0.62, 0.78, eave, eave + 7, "metal", "tar"), // a stair hatch
    ],
  };
}

function bakery(wsq: number, v: number): Drawn {
  const W = wsq * SQ, H = 114, F = H - 3;
  const P: Piece[] = [], L: LightSpot[] = [];
  const bx = 3, bw = W - 6, eave = 82, top = F - eave, rise = 24;
  P.push(shadow(W / 2, F, bw / 2 + 2));
  P.push(gable(bx - 3, top + 2, bw + 6, rise));
  P.push(box(bx, top, bw, eave, wallFn("plaster")));
  P.push(box(bx + bw / 2 - 5, top - 14, 10, 9, (i, j) => (i === 0 || j === 0 || i === 9 || j === 8 ? "g" : i + j < 7 ? "j" : "i")));
  L.push({ x: bx + bw / 2 - 4, y: top - 13, w: 8, h: 7, keys: "ij", color: WARM, strength: 0.6 });
  for (const wx of [bx + 10, bx + bw / 2 - 7, bx + bw - 24]) windowAt(wx, top + 8, 14, 15, P, L, { shut: wx === bx + bw / 2 - 7 ? undefined : "n" });
  // The sign: a painted loaf on a board (no words).
  const sx = bx + bw / 2 - 16, sy = top + 28;
  P.push(box(sx, sy, 32, 12, (i, j) => (i < 2 || j < 2 || i > 29 || j > 9 ? "P" : "p")));
  P.push(box(sx + 9, sy + 3, 14, 6, (i, j) => (Math.hypot((i - 6.5) / 7, (j - 3.5) / 3.5) > 1 ? null : j < 2 ? "y" : (i % 4 === 1 && j < 4) ? "y" : "Y")));
  P.push(awning(bx - 2, top + 43, bw + 4, 9));
  // The big window: a shelf of loaves and cakes; the door with its glass.
  const wy = top + 57;
  const ww = bw - 34;
  P.push(box(bx + 6, wy, ww, F - wy - 4, (i, j) => {
    const hh = F - wy - 4;
    if (i === 0 || j === 0 || i === ww - 1 || j === hh - 1) return "g";
    if (j === hh - 9) return "v";
    if (j > hh - 9) return i % 8 < 5 ? (["y", "t", "w"] as const)[Math.floor(i / 8) % 3]! : "i";
    if (j > hh - 16 && j < hh - 9 && i % 10 > 2 && i % 10 < 8) return ["Y", "t"][Math.floor(i / 10) % 2]!;
    return i === 3 && j === 3 ? "I" : i + j < 14 ? "j" : "i";
  }));
  L.push({ x: bx + 7, y: wy + 1, w: ww - 2, h: F - wy - 6, keys: "ijI", color: WARM, strength: 1 });
  doorAt(bx + bw - 24, wy - 2, 17, F - wy + 2, P, L, false, true);
  // A cafe table and two chairs out front.
  P.push(box(bx + 18, F - 13, 18, 3, "X"), box(bx + 26, F - 10, 2, 10, "X"));
  P.push(box(bx + 10, F - 12, 3, 12, (i, j) => (j < 6 && i === 0 ? "X" : j >= 5 ? "X" : null), false), box(bx + 41, F - 12, 3, 12, (i, j) => (j < 6 && i === 2 ? "X" : j >= 5 ? "X" : null), false));
  P.push(box(bx + 21, F - 16, 5, 3, "t"), box(bx + 29, F - 16, 4, 3, "w"));
  const body = { x0: bx, x1: bx + bw - 1 };
  return {
    W, H, P, L, body, eaveL: eave, eaveR: eave,
    side: { mat: "plaster", rows: [{ y: 8, h: 15 }, { y: 54, h: 16 }], every: 32, trim: [42] },
    roof: [
      ...gableRoof(bx - 3, bx + bw + 3, eave - 1, bx + bw / 2, eave + rise - 1, "clay", 0, 1.03),
      ...blockF(bx + 12, bx + 22, 0.55, 0.7, eave + 6, eave + rise + 6, "wall", "tar"), // the oven's chimney
    ],
  };
}

function shop(wsq: number, v: number): Drawn {
  const W = wsq * SQ, H = 100, F = H - 3;
  const P: Piece[] = [], L: LightSpot[] = [];
  const mat = COLOURWAYS.shop[v]!.mat ?? "siding";
  const bx = 3, bw = W - 6, eave = 80, top = F - eave;
  P.push(shadow(W / 2, F, bw / 2 + 2));
  P.push(box(bx, top, bw, eave, wallFn(mat)));
  // The false front: a stepped parapet with a sign of a painted jar (no words).
  P.push(box(bx - 2, top - 8, bw + 4, 10, (i, j) => { const mid = Math.abs(i - (bw + 3) / 2); if (j < 4 && mid > 14) return null; return j === 0 || (j === 4 && mid > 14) ? "g" : j < 3 ? "g" : "G"; }));
  windowAt(bx + bw / 2 - 9, top + 6, 18, 15, P, L);
  P.push(box(bx + 6, top + 25, bw - 12, 11, (i, j) => (i < 2 || j < 2 || i > bw - 15 || j > 8 ? "P" : "p")));
  P.push(box(bx + bw / 2 - 4, top + 27, 8, 7, (i, j) => (j === 0 ? "l" : i === 0 || i === 7 ? "Y" : j < 3 ? "w" : "q")));
  P.push(awning(bx - 3, top + 38, bw + 6, 8, false));
  const wy = top + 51;
  const ww = bw - 25;
  P.push(box(bx + 4, wy, ww, F - wy - 3, (i, j) => {
    const hh = F - wy - 3;
    if (i === 0 || j === 0 || i === ww - 1 || j === hh - 1) return "g";
    if (j === 9 || j === 17) return "v";
    if ((j > 4 && j < 9) || (j > 12 && j < 17)) return i % 5 === 1 ? "i" : (["q", "u", "r", "t"] as const)[Math.floor(i / 5) % 4]!;
    return i === 2 && j === 2 ? "I" : i + j < 10 ? "j" : "i";
  }));
  L.push({ x: bx + 5, y: wy + 1, w: ww - 2, h: F - wy - 5, keys: "ijI", color: WARM, strength: 1 });
  doorAt(bx + bw - 18, wy - 3, 14, F - wy + 3, P, L, false, true);
  // Crates of fruit on the step.
  P.push(box(bx + 4, F - 9, 13, 9, (i, j) => (j < 3 ? (i % 3 ? "q" : "u") : j === 3 ? "V" : i % 6 === 0 ? "V" : "v")));
  const body = { x0: bx, x1: bx + bw - 1 };
  return {
    W, H, P, L, body, eaveL: eave, eaveR: eave,
    side: { mat, rows: [{ y: 6, h: 15 }], every: 34, trim: [38] },
    roof: [...flatRoof(bx, bx + bw, eave - 2, "tar", 0.03, 1)],
  };
}

function block(wsq: number, v: number): Drawn {
  const W = wsq * SQ, H = 146, F = H - 3;
  const P: Piece[] = [], L: LightSpot[] = [];
  const bx = 4, bw = W - 8, eave = 118, top = F - eave;
  P.push(box(bx, top, bw, eave, wallFn("brick")));
  P.push(cornice(bx - 3, top, bw + 6));
  P.push(box(bx - 1, top + 26, bw + 2, 3, (_i, j) => (j < 2 ? "g" : "G")));
  P.push(box(bx, F - 22, bw, 22, (i, j) => (j < 2 ? "g" : i % 16 === 0 ? "G" : "x"))); // a stone ground storey
  const cols = Math.floor((bw - 8) / 22);
  const gap = (bw - cols * 14) / (cols + 1);
  for (let f = 0; f < 4; f++)
    for (let k = 0; k < cols; k++) {
      const wx = bx + gap + k * (14 + gap), wy = top + 8 + f * 23;
      windowAt(wx, wy, 14, f === 0 ? 16 : 15, P, L, { cross: f !== 0, arch: f === 0, strength: (k * 7 + f * 3 + v) % 5 === 0 ? 0 : 0.75 });
    }
  for (let k = 0; k < cols; k++) P.push(box(bx + gap + k * (14 + gap), F - 17, 14, 15, (i, j) => (i === 0 || i === 13 || j === 0 ? "g" : i + j < 9 ? "j" : "i")));
  L.push({ x: bx, y: F - 17, w: bw, h: 15, keys: "ij", color: WARM, strength: 0.6 });
  const body = { x0: bx, x1: bx + bw - 1 };
  return {
    W, H, P, L, body, eaveL: eave, eaveR: eave, depth: 2.4,
    side: { mat: "brick", rows: [0, 1, 2, 3].map((f) => ({ y: 8 + f * 23, h: 15, arch: f === 0 })), every: 26, trim: [0, 26], plinth: 22 },
    roof: [
      ...flatRoof(bx, bx + bw, eave + 1),
      // The water tower: a wooden tank with a pointed cap, on iron legs.
      ...blockF(bx + 20, bx + 42, 0.28, 0.55, eave + 9, eave + 24, "plank", "shingle"),
      ...[bx + 21, bx + 39].map((u) => blockF(u, u + 2, 0.3, 0.33, eave, eave + 9, "metal")).flat(),
      ...[bx + 21, bx + 39].map((u) => blockF(u, u + 2, 0.5, 0.53, eave, eave + 9, "metal")).flat(),
      ...blockF(bx + bw - 22, bx + bw - 10, 0.6, 0.76, eave, eave + 8, "metal", "tar"),
    ],
  };
}

function tower(wsq: number, v: number): Drawn {
  const W = wsq * SQ, H = 146, F = H - 3;
  const P: Piece[] = [], L: LightSpot[] = [];
  const bw = 46, bx = Math.round((W - bw) / 2);
  const body = 82, bel = 24, top = F - body, btop = top - bel;
  // The shaft (stone courses), its string course; the belfry over it with arched openings; the clock on the belfry.
  P.push(box(bx, top, bw, body, wallFn("stone")));
  P.push(box(bx + 3, btop, bw - 6, bel + 1, (i, j, x, y) => { const k = MAT.stone(x, y); return k; }));
  P.push(cornice(bx - 2, top - 1, bw + 4));
  P.push(cornice(bx + 1, btop - 1, bw - 2, false));
  for (const ox of [bx + 7, bx + bw - 15]) P.push(box(ox, btop + 6, 8, 15, (i, j) => (j < 4 && Math.hypot(i - 3.5, j - 4) > 4 ? null : i === 0 || i === 7 ? "g" : "m")));
  P.push(box(bx + bw / 2 - 11, top + 6, 22, 22, (i, j) => {
    const d = Math.hypot(i - 10.5, j - 10.5);
    if (d > 11) return null;
    if (d > 9.2) return "y";
    if (d > 8.4) return "Y";
    if ((i === 10 || i === 11) && j > 3 && j < 12) return "k";
    if ((j === 10 || j === 11) && i > 10 && i < 16) return "k";
    if (d > 7 && ((i + j) % 5 === 0)) return "X";
    return "w";
  }));
  L.push({ x: bx + bw / 2 - 9, y: top + 8, w: 18, h: 18, keys: "w", color: "#ffe9b0", strength: 0.55 });
  for (let f = 0; f < 2; f++) windowAt(bx + bw / 2 - 5, top + 34 + f * 22, 10, 15, P, L, { arch: true, cross: false });
  doorAt(bx + bw / 2 - 8, F - 22, 16, 22, P, L, true);
  P.push(box(bx - 4, F - 3, bw + 8, 3, "x"));
  const apex = body + bel + 38;
  const x0 = bx + 2, x1 = bx + bw - 2, xc = bx + bw / 2;
  const d = bw / SQ;
  return {
    W, H, P, L, body: { x0: bx, x1: bx + bw - 1 }, eaveL: body, eaveR: body, depth: d,
    side: { mat: "stone", rows: [{ y: 34, h: 15, w: 10, arch: true }, { y: 56, h: 15, w: 10, arch: true }], every: 40, trim: [0] },
    roof: [
      ...flatRoof(bx, bx + bw, body + 1, "tar"),
      // The belfry stands back a little on the shaft (its sides as faces), the spire on it: a square pyramid.
      quadF([bx + 3, 0.94, body], [bx + 3, 0.06, body], [bx + 3, 0.06, body + bel], [bx + 3, 0.94, body + bel], "wallstone", "t"),
      quadF([bx + bw - 3, 0.06, body], [bx + bw - 3, 0.94, body], [bx + bw - 3, 0.94, body + bel], [bx + bw - 3, 0.06, body + bel], "wallstone", "t"),
      { pts: [[x0, 0.04, body + bel], [x1, 0.04, body + bel], [xc, 0.5, apex]], tex: "slate", rows: "u" },
      { pts: [[x0, 0.96, body + bel], [x0, 0.04, body + bel], [xc, 0.5, apex]], tex: "slate", rows: "t" },
      { pts: [[x1, 0.04, body + bel], [x1, 0.96, body + bel], [xc, 0.5, apex]], tex: "slate", rows: "t" },
    ],
  };
}

const DRAW: Record<Design, (wsq: number, v: number) => Drawn> = { cottage, townhouse, skinny, flats, bakery, shop, block, tower };

/** Depth (squares) from the front line back, and the front's inset on its lot: an everyday building, a bigger one behind. */
export const DEPTH = { house: 2.6, tall: 2.4 } as const;
export const INSET = { house: 0.12, tall: 0.3 } as const;
const cache = new Map<string, TownBox>();
/** A design at a lot's width (squares) in a colourway (0..2): its front, sides and roof. */
export function building(id: Design, wsq: number, v: number): TownBox {
  const key = `${id}-${wsq}-${v}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const cw = COLOURWAYS[id][v % 3]!;
  const pal = paletteOf(cw);
  const d = DRAW[id](wsq, v % 3);
  const behind = DESIGN_LOT[id].behind;
  const depth = d.depth ?? (behind ? DEPTH.tall : DEPTH.house);
  const L = Math.round(depth * SQ);
  const front = character(key, d.W, d.H, pal, d.P);
  const palR = d.sideR?.keys ? { ...pal, a: pal[d.sideR.keys[0]!]!, b: pal[d.sideR.keys[1]!]!, c: pal[d.sideR.keys[2]!]! } : pal;
  const box: TownBox = {
    id: key,
    front,
    lights: d.L,
    lot: { w: wsq, d: 3 },
    inset: behind ? INSET.tall : INSET.house,
    depth,
    body: d.body,
    left: sideArt(`${key}-L`, pal, d.side, L, d.eaveL, true),
    right: sideArt(`${key}-R`, palR, d.sideR ?? d.side, L, d.eaveR, false),
    roof: d.roof,
    roofPal: pal,
    taper: 1,
  };
  cache.set(key, box);
  return box;
}
