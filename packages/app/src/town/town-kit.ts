/**
 * The street town's building kit (Nov 5, final art; drawn by hand on the weekly plan usage): what the everyday buildings
 * (buildings.ts), the boss homes' boxes (home-boxes.ts) and the street dressing (dressing.ts) share. Same format as the homes
 * (characters/sprite.ts, town/houses/kit.ts), at the town's 37 picture pixels a square. Copy this folder next to
 * town/houses/ (the imports below are the only paths to change).
 *
 * A building is a box (Eric, Nov 5: "no flat-looking buildings in a turn"):
 *  - its FRONT: a picture standing upright on its lot's front line, as a home's is today;
 *  - its two SIDES: pictures standing upright from the front's body edges straight back over the box's depth (a side's
 *    picture is `depth` px wide, its foot the bottom row; the left side's front edge is its right edge, the right side's its
 *    left edge), in the building's material, with its window rows and trim carried round;
 *  - its ROOF: a few faces (`Face`), each a polygon in the box's own space, textured with a top-down tile (`ROOF_TILES`) in
 *    the building's palette.
 *
 * The box's own space, for faces: `u` is a column of the front picture (px, left to right), `t` runs from the front line (0)
 * to the back (1), `h` is the height above the ground (px; a point h px up is drawn h x k / 37 above its foot, the town's
 * cut-out rule). A building whose back narrows (a tent, a pyramid) gives `taper`: its width at the back, as a share of the
 * front's (the u of a point at t is pulled toward the body's middle by t x (1 - taper)).
 */
import type { Character, Layer, Part } from "../characters/sprite.ts";
import { grain, paint, WARM, type LightSpot } from "./houses/kit.ts";

export const SQ = 37;
export { grain, WARM };
export type Piece = { part: Part; at: readonly [number, number] };
export type Fn = (i: number, j: number, x: number, y: number) => string | null;

/** A part over (x0, y0, w, h): `f` is a key, or a function of the pixel inside the box (i, j) and on the picture (x, y). */
export const box = (x0: number, y0: number, w: number, h: number, f: string | Fn, outline = true): Piece => {
  const X = Math.round(x0), Y = Math.round(y0);
  return paint(X, Y, Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), (x, y) => (typeof f === "string" ? f : f(x - X, y - Y, x, y)), outline);
};

/** Pieces into a Character (one idle frame), the foot at the bottom middle, 3 px above the last row (as the homes). */
export function character(id: string, w: number, h: number, pal: Record<string, string>, pieces: Piece[], foot?: readonly [number, number]): Character {
  const parts: Record<string, Part> = {};
  const layers: Layer[] = [];
  pieces.forEach((p, n) => {
    parts[`p${n}`] = p.part;
    layers.push({ part: `p${n}`, x: p.at[0], y: p.at[1] });
  });
  return { id, name: id, w, h, foot: foot ?? [Math.floor(w / 2), h - 3], palette: pal, parts, anims: { idle: { frames: [{ layers, ms: 1000 }], loop: true } } };
}

// ---- The shared palette keys (every building's palette has them; a colourway swaps some).
//   k outline · a b c wall dark/mid/light · d e f roof dark/mid/light · g G trim light/shade · i j I glass dark/light/glint
//   l m door/its dark · n o awning stripes · p P sign face/frame · r s S greens · t u flowers · v V wood · x X stone/iron
//   y Y brass/its dark · w white · q Q accent (a painted sign's picture) · "-" ground shadow
export const BASE: Record<string, string> = {
  k: "#2a2118",
  g: "#f7f1e3", G: "#cfc4ad",
  i: "#34466a", j: "#8fb4d9", I: "#d9ecfb",
  m: "#2a1d14",
  p: "#f1deb0", P: "#9a6a43",
  r: "#6aaa4c", s: "#4c8a3a", S: "#356b2b",
  t: "#ff7aa8", u: "#ffd84a",
  v: "#a4744a", V: "#6e4a2c",
  x: "#a7a196", X: "#6f6b64",
  y: "#f2c14e", Y: "#b5842a",
  w: "#ffffff",
  q: "#d8453a", Q: "#7a3a22",
  "-": "#0d0e1266",
};
/** A colourway: its wall ramp, roof ramp, door, awning stripes (and anything else it changes). */
export interface Colourway {
  name: string;
  wall: readonly [string, string, string];
  roof: readonly [string, string, string];
  door: string;
  awning?: readonly [string, string];
  extra?: Record<string, string>;
}
export function paletteOf(cw: Colourway): Record<string, string> {
  return {
    ...BASE,
    a: cw.wall[0], b: cw.wall[1], c: cw.wall[2],
    d: cw.roof[0], e: cw.roof[1], f: cw.roof[2],
    l: cw.door,
    n: cw.awning?.[0] ?? "#d84545", o: cw.awning?.[1] ?? "#fbf3e6",
    ...cw.extra,
  };
}

// ---- The materials: one texture each, keyed a/b/c (dark, mid, light of the wall), so a colourway's palette tints it.
// The fronts paint their walls with the same functions, so a side carries the front's material round the corner exactly.
export type Mat = "brick" | "siding" | "plaster" | "stone" | "log" | "plank" | "glass" | "ice" | "canvas" | "paper" | "gingerbread" | "turf" | "slat" | "rock" | "sandstone" | "stripe";
/** A material's key at (x, y) on a wall (px; y from the wall's top). */
export const MAT: Record<Mat, (x: number, y: number) => string> = {
  brick: (x, y) => (y % 5 === 4 ? "a" : (x + (Math.floor(y / 5) % 2) * 4) % 8 === 0 ? "a" : grain(x >> 3, (y / 5) | 0, 3) > 0.85 ? "c" : "b"),
  siding: (x, y) => (y % 5 === 4 ? "a" : y % 5 === 0 ? "c" : grain(x, y, 3) > 0.96 ? "a" : "b"),
  plaster: (x, y) => (grain(x, y, 5) > 0.95 ? "a" : grain(x, y, 6) > 0.93 ? "c" : "b"),
  stone: (x, y) => (y % 8 === 7 || (x + (Math.floor(y / 8) % 2) * 6) % 12 === 0 ? "a" : grain((x + (Math.floor(y / 8) % 2) * 6) / 12 | 0, y >> 3, 9) > 0.6 ? "c" : "b"),
  sandstone: (x, y) => (y % 9 === 8 ? "a" : (x + (Math.floor(y / 9) % 2) * 9) % 18 === 0 ? "a" : y % 9 === 0 ? "c" : grain(x, y, 4) > 0.94 ? "a" : "b"),
  log: (x, y) => (y % 7 === 6 ? "a" : y % 7 === 0 || y % 7 === 1 ? "c" : grain(x >> 2, y, 2) > 0.9 ? "a" : "b"),
  plank: (x, y) => (x % 7 === 6 ? "a" : x % 7 === 0 ? "c" : grain(x, y >> 2, 7) > 0.93 ? "a" : "b"),
  slat: (x) => (x % 9 >= 7 ? "a" : x % 9 === 0 ? "c" : "b"),
  glass: (x, y) => (x % 12 === 0 || y % 14 === 0 ? "a" : (x + y) % 23 < 3 ? "c" : "b"),
  ice: (x, y) => (y % 8 === 7 || (x + (Math.floor(y / 8) % 2) * 6) % 12 === 0 ? "c" : grain(x, y, 8) > 0.9 ? "c" : "b"),
  canvas: (x) => (Math.floor(x / 9) % 2 ? "b" : "c"),
  stripe: (x) => (Math.floor(x / 8) % 2 ? "b" : "c"),
  paper: (x, y) => (grain(x, y, 11) > 0.96 ? "a" : (y % 16 === 9 && (x % 13) < 6) ? "a" : "b"),
  gingerbread: (x, y) => (grain(x, y, 12) > 0.94 ? "a" : grain(x, y, 13) > 0.95 ? "c" : "b"),
  turf: (x, y) => (grain(x, y, 14) > 0.8 ? "a" : grain(x, y, 15) > 0.85 ? "c" : "b"),
  rock: (x, y) => (grain(x >> 2, y >> 2, 16) > 0.82 ? "c" : grain(x, y, 17) > 0.9 ? "a" : "b"),
};

/** A sash window: a trim frame, glass lit top-left, a glint, mullions, a sill (and shutters in `shut`). */
export function windowAt(x: number, y: number, w: number, h: number, out: Piece[], lights: LightSpot[], o: { cross?: boolean; shut?: string; arch?: boolean; strength?: number } = {}) {
  const cross = o.cross ?? true;
  if (o.shut) {
    out.push(box(x - 5, y, 4, h, (_i, j) => (j % 3 === 2 ? "k" : o.shut!)));
    out.push(box(x + w + 1, y, 4, h, (_i, j) => (j % 3 === 2 ? "k" : o.shut!)));
  }
  out.push(
    box(x, y, w, h, (i, j) => {
      if (o.arch && j < w / 2) {
        const d = Math.hypot(i + 0.5 - w / 2, j + 0.5 - w / 2);
        if (d > w / 2) return null;
        if (d > w / 2 - 1.3) return "g";
      }
      if (i === 0 || j === 0 || i === w - 1 || j === h - 1) return "g";
      if (cross && (i === Math.floor(w / 2) || j === Math.floor(h / 2))) return "g";
      if (i === 2 && j === 2) return "I";
      return i + j < Math.min(w, h) * 0.6 ? "j" : "i";
    }),
  );
  out.push(box(x - 1, y + h, w + 2, 2, (_i, j) => (j ? "G" : "g")));
  lights.push({ x, y, w, h, keys: "ijI", color: WARM, strength: o.strength ?? 0.8 });
}
/** A flower box under a window. */
export const flowerBox = (x: number, y: number, w: number, out: Piece[]) => {
  out.push(box(x, y - 3, w, 4, (i, j) => (j < 2 ? (i % 3 === 1 ? "t" : i % 3 === 2 ? "u" : "r") : i % 2 ? "s" : "r"), false));
  out.push(box(x, y + 1, w, 3, (_i, j) => (j ? "V" : "v")));
};
/** A panelled door (arched on top with a fanlight if `arch`), its knob; lit through its glass. */
export function doorAt(x: number, y: number, w: number, h: number, out: Piece[], lights: LightSpot[], arch = false, glass = false) {
  out.push(
    box(x, y, w, h, (i, j) => {
      if (arch && j < w / 2 && Math.hypot(i + 0.5 - w / 2, j + 0.5 - w / 2) > w / 2) return null;
      if (arch && j < w / 2 - 1 && Math.hypot(i + 0.5 - w / 2, j + 0.5 - w / 2) < w / 2 - 2) return i + j < w / 2 ? "j" : "i";
      if (glass && j > (arch ? w / 2 + 1 : 3) && j < h * 0.5 && i > 2 && i < w - 3) return i + j < w ? "j" : "i";
      if (i === w - 3 && j === Math.floor(h * 0.58)) return "y";
      if (i === 0 || i === w - 1) return "m";
      if (j > h * 0.55 && j < h - 3 && (i === 2 || i === w - 3)) return "m";
      return "l";
    }),
  );
  out.push(box(x - 2, y + h - 2, w + 4, 2, "x"));
  if (arch) lights.push({ x: x + 2, y, w: w - 4, h: Math.ceil(w / 2), keys: "ij", color: WARM, strength: 0.7 });
  if (glass) lights.push({ x: x + 2, y: y + 3, w: w - 4, h: Math.ceil(h * 0.5), keys: "ij", color: WARM, strength: 0.9 });
}
/** A cornice: a trim band with dentils and a shadow under it. */
export const cornice = (x: number, y: number, w: number, dentils = true): Piece =>
  box(x, y, w, 5, (i, j) => (j < 2 ? "g" : j === 2 ? "G" : dentils && i % 4 < 2 ? "g" : j === 4 ? "a" : "G"));
/** A soft shadow on the ground under a building. */
export const shadow = (cx: number, foot: number, rx: number): Piece =>
  box(cx - rx, foot - 2, rx * 2, 5, (i, j) => (Math.hypot((i + 0.5 - rx) / rx, (j - 2) / 2.5) <= 1 ? "-" : null), false);
/** A striped awning over (x, y): `w` across, `h` deep, scalloped along its foot. */
export const awning = (x: number, y: number, w: number, h: number, stripes = true): Piece =>
  box(x, y, w, h + 3, (i, j) => {
    if (j >= h && Math.hypot(((i % 8) - 3.5) / 4, (j - h + 0.5) / 3) > 1) return null;
    if (j === 0) return "k";
    const st = stripes ? (Math.floor(i / 8) % 2 ? "o" : "n") : j < 2 ? "o" : "n";
    return j === 1 && st === "n" ? "n" : st;
  });
/** A gable roof over (x0..x0+w) rising h from its eaves at `y`: shingle rows offset course by course, lit on the left, a bargeboard. */
export const gable = (x0: number, y: number, w: number, h: number, bargeboard = true): Piece =>
  box(x0, y - h, w, h + 3, (i, j) => {
    const half = w / 2;
    const reach = ((j + 1) / (h + 3)) * half + 1;
    const off = Math.abs(i + 0.5 - half);
    if (off > reach) return null;
    if (bargeboard && off > reach - 2.2) return "g";
    if (j % 4 === 3) return "d";
    if ((i + (Math.floor(j / 4) % 2) * 3) % 6 === 0) return "d";
    return i < half ? "f" : "e";
  });

// ---- A side wall: the building's material over `L` px (its depth) by `H` (its eave there), its window rows carried round,
// its trim rows, a corner trim at the front edge. Windows at dusk light up as the front's (its LightSpots).
export interface SideSpec {
  mat: Mat;
  /** Window rows, y from the wall's top (px): each { y, h }, a window every `every` px along (none: a blank wall). */
  rows?: { y: number; h: number; w?: number; arch?: boolean }[];
  every?: number;
  /** Trim rows (a cornice, a string course), y from the top. */
  trim?: number[];
  /** A corner trim at the front edge (default true). */
  corner?: boolean;
  /** A plinth of stone at the foot, this tall. */
  plinth?: number;
}
export interface SideArt {
  ch: Character;
  lights: LightSpot[];
}
export function sideArt(id: string, pal: Record<string, string>, spec: SideSpec, L: number, H: number, frontAtRight: boolean): SideArt {
  const P: Piece[] = [];
  const lights: LightSpot[] = [];
  const top = 0;
  const f = MAT[spec.mat];
  P.push(box(0, top, L, H, (i, j) => (spec.plinth && j >= H - spec.plinth ? (i % 10 === 0 || j === H - spec.plinth ? "X" : "x") : f(frontAtRight ? L - 1 - i : i, j)), false));
  for (const y of spec.trim ?? []) if (y >= 0 && y < H) P.push(box(0, y, L, 3, (_i, j) => (j < 2 ? "g" : "G"), false));
  const every = spec.every ?? 30;
  for (const r of spec.rows ?? []) {
    const ww = r.w ?? 12;
    // Windows spaced along the wall, the first well clear of the front corner.
    for (let d = 10; d + ww < L - 5; d += every) {
      const x = frontAtRight ? L - d - ww : d;
      windowAt(x, r.y, ww, r.h, P, lights, { cross: r.h >= 12, arch: r.arch, strength: 0.7 });
    }
  }
  if (spec.corner !== false) P.push(box(frontAtRight ? L - 3 : 0, 0, 3, H, (i) => (i === (frontAtRight ? 0 : 2) ? "G" : "g"), false));
  // The ink: the wall's top edge and its back edge.
  P.push(box(0, 0, L, 1, "k", false));
  P.push(box(frontAtRight ? 0 : L - 1, 0, 1, H, "k", false));
  return { ch: character(id, L, H + 1, pal, P, [frontAtRight ? L : 0, H]), lights };
}

// ---- Roof tiles: 37 x 37 top-down textures (rows run along the tile's x), keyed in the roof's ramp (d e f) or a material's.
export type RoofTex = "wall" | "wallstone" | "wallplain" | "crumb" | "shingle" | "slate" | "clay" | "tar" | "glass" | "canvas" | "turf" | "hedge" | "sand" | "icing" | "paper" | "plank" | "crystal" | "quilt" | "grass" | "metal" | "thatch";
export const ROOF_TILES: Record<RoofTex, (x: number, y: number) => string> = {
  wall: (x, y) => MAT.brick(x, y),
  wallstone: (x, y) => MAT.stone(x, y),
  wallplain: (x, y) => MAT.plaster(x, y),
  crumb: (x, y) => (grain(x >> 1, y >> 1, 42) > 0.985 ? "t" : grain(x >> 1, y >> 1, 43) > 0.985 ? "u" : MAT.gingerbread(x, y)),
  shingle: (x, y) => (y % 5 === 4 ? "d" : (x + (Math.floor(y / 5) % 2) * 3) % 6 === 0 ? "d" : grain(x, y, 21) > 0.9 ? "f" : "e"),
  slate: (x, y) => (y % 6 === 5 ? "d" : (x + (Math.floor(y / 6) % 2) * 4) % 8 === 0 ? "d" : y % 6 === 0 ? "f" : "e"),
  clay: (x, y) => (y % 6 === 5 ? "d" : x % 5 === 0 ? "d" : x % 5 === 1 ? "f" : "e"),
  tar: (x, y) => (grain(x, y, 22) > 0.93 ? "X" : grain(x, y, 23) > 0.95 ? "G" : "x"),
  glass: (x, y) => (x % 12 === 0 || y % 12 === 0 ? "a" : (x + y) % 19 < 3 ? "I" : "j"),
  canvas: (x) => (Math.floor(x / 9) % 2 ? "n" : "o"),
  turf: (x, y) => (grain(x, y, 24) > 0.82 ? "S" : grain(x, y, 25) > 0.8 ? "r" : grain(x, y, 26) > 0.985 ? "t" : "s"),
  hedge: (x, y) => (grain(x >> 1, y >> 1, 27) > 0.7 ? "r" : grain(x, y, 28) > 0.9 ? "S" : "s"),
  sand: (x, y) => (y % 9 === 8 ? "a" : (x + (Math.floor(y / 9) % 2) * 9) % 18 === 0 ? "a" : y % 9 === 0 ? "c" : "b"),
  icing: (x, y) => (grain(x, y, 29) > 0.97 ? "t" : grain(x, y, 30) > 0.97 ? "u" : grain(x, y, 31) > 0.97 ? "j" : grain(x, y, 32) > 0.9 ? "G" : "w"),
  paper: (x, y) => (grain(x, y, 33) > 0.97 ? "a" : Math.floor(x / 10) % 2 ? "b" : "c"),
  plank: (x, y) => (y % 7 === 6 ? "V" : y % 7 === 0 ? "f" : grain(x >> 2, y, 34) > 0.9 ? "V" : "v"),
  crystal: (x, y) => (grain(x >> 2, y >> 1, 35) > 0.9 ? "c" : grain(x, y, 36) > 0.8 ? "a" : "b"),
  quilt: (x, y) => ((Math.floor(x / 9) + Math.floor(y / 9)) % 2 ? "n" : "o"),
  grass: (x, y) => (grain(x, y, 37) > 0.75 ? "r" : grain(x, y, 38) > 0.9 ? "S" : "s"),
  metal: (x) => (x % 6 === 0 ? "X" : x % 6 === 1 ? "w" : "x"),
  thatch: (x, y) => (grain(x, y >> 1, 39) > 0.6 ? "e" : grain(x, y, 40) > 0.8 ? "d" : "f"),
};
/** A roof tile as a Character (37 x 37, no outline) in a palette: what the box renderer textures a face with. */
export function roofTile(tex: RoofTex, pal: Record<string, string>, id: string = tex): Character {
  return character(`roof-${id}`, SQ, SQ, pal, [box(0, 0, SQ, SQ, (_i, _j, x, y) => ROOF_TILES[tex](x, y), false)], [0, SQ]);
}

// ---- Faces.
/** A point of a face: (u px across the front, t 0..1 back over the depth, h px up). */
export type FP = readonly [u: number, t: number, h: number];
export interface Face {
  pts: readonly FP[];
  tex: RoofTex;
  /** Which way its texture's rows run: along u (rows of constant t: a face sloping toward the front) or along t (constant u: a slope to the side). */
  rows: "u" | "t";
  /** A flat roof's parapet: a light rim drawn round it. */
  rim?: boolean;
  /** Part of a curved surface (a dome, a vault): no ink line round it. */
  soft?: boolean;
}
export const quadF = (a: FP, b: FP, c: FP, d: FP, tex: RoofTex, rows: "u" | "t" = "t", rim = false): Face => ({ pts: [a, b, c, d], tex, rows, rim });
/** A gable roof whose ridge runs straight back: two slopes from the eaves (x0 and x1 at `eave`) up to the ridge at (rx, rh). */
export const gableRoof = (x0: number, x1: number, eave: number, rx: number, rh: number, tex: RoofTex, t0 = 0, t1 = 1): Face[] => [
  quadF([x0, t0, eave], [rx, t0, rh], [rx, t1, rh], [x0, t1, eave], tex, "t"),
  quadF([rx, t0, rh], [x1, t0, eave], [x1, t1, eave], [rx, t1, rh], tex, "t"),
];
/** A flat roof at h (a parapet's rim round it). */
export const flatRoof = (x0: number, x1: number, h: number, tex: RoofTex = "tar", t0 = 0, t1 = 1): Face[] => [quadF([x0, t0, h], [x1, t0, h], [x1, t1, h], [x0, t1, h], tex, "u", true)];
/**
 * A hipped roof: its ridge from the front at (rx, rh) back to `rb` (0..1), then sloping down to the back's eaves; its two
 * long slopes down to the eaves at x0 and x1. With eave 0 and rb about 0.5 it's a pyramid (a tent's, a peak's).
 */
export const hipRoof = (x0: number, x1: number, eave: number, rx: number, rh: number, rb: number, tex: RoofTex): Face[] => [
  quadF([x0, 0, eave], [rx, 0, rh], [rx, rb, rh], [x0, 1, eave], tex, "t"),
  quadF([rx, 0, rh], [x1, 0, eave], [x1, 1, eave], [rx, rb, rh], tex, "t"),
  { pts: [[x0, 1, eave], [rx, rb, rh], [x1, 1, eave]], tex, rows: "u" },
];
/** A hipped roof with a ridge along the street (rx0..rx1 at rh, running back to rb): hips at the ends, a slope down the back. */
export const hipWideRoof = (x0: number, x1: number, eave: number, rx0: number, rx1: number, rh: number, rb: number, tex: RoofTex): Face[] => [
  quadF([x0, 0, eave], [rx0, 0, rh], [rx0, rb, rh], [x0, 1, eave], tex, "t"),
  quadF([rx0, 0, rh], [rx1, 0, rh], [rx1, rb, rh], [rx0, rb, rh], tex, "u"),
  quadF([rx1, 0, rh], [x1, 0, eave], [x1, 1, eave], [rx1, rb, rh], tex, "t"),
  quadF([x0, 1, eave], [rx0, rb, rh], [rx1, rb, rh], [x1, 1, eave], tex, "u"),
];
/** A dome over the front's arc (x0..x1, from `base` up to `top` at the middle), carried back as a quarter ellipsoid: n x m faces. */
export function domeRoof(x0: number, x1: number, base: number, top: number, tex: RoofTex, n = 8, m = 5): Face[] {
  const cx = (x0 + x1) / 2, rx = (x1 - x0) / 2, rh = top - base;
  const P = (a: number, b: number): FP => {
    // a: round the front arc (0 left .. PI right); b: from the front (0) to the back (PI/2).
    const s = Math.cos(b);
    return [cx - Math.cos(a) * rx * s, Math.sin(b), base + Math.sin(a) * rh * s];
  };
  const out: Face[] = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) {
      const a0 = (i / n) * Math.PI, a1 = ((i + 1) / n) * Math.PI, b0 = (j / m) * (Math.PI / 2), b1 = ((j + 1) / m) * (Math.PI / 2);
      out.push({ ...quadF(P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1), tex, "u"), soft: true });
    }
  return out;
}
/** A barrel vault: the front's arch (x0..x1 from `base` up to `top`) carried straight back: n faces. */
export function vaultRoof(x0: number, x1: number, base: number, top: number, tex: RoofTex, n = 8): Face[] {
  const cx = (x0 + x1) / 2, rx = (x1 - x0) / 2, rh = top - base;
  const P = (a: number, t: number): FP => [cx - Math.cos(a) * rx, t, base + Math.sin(a) * rh];
  const out: Face[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI, a1 = ((i + 1) / n) * Math.PI;
    out.push({ ...quadF(P(a0, 0), P(a1, 0), P(a1, 1), P(a0, 1), tex, "t"), soft: true });
  }
  return out;
}
/** A little box on the roof (a chimney, a tank, a dormer's cheeks): its front, sides and top, from h0 to h1 over (u0..u1, t0..t1). */
export function blockF(u0: number, u1: number, t0: number, t1: number, h0: number, h1: number, tex: RoofTex, top: RoofTex = tex): Face[] {
  return [
    quadF([u0, t0, h0], [u1, t0, h0], [u1, t0, h1], [u0, t0, h1], tex, "u"),
    quadF([u0, t1, h0], [u0, t0, h0], [u0, t0, h1], [u0, t1, h1], tex, "t"),
    quadF([u1, t0, h0], [u1, t1, h0], [u1, t1, h1], [u1, t0, h1], tex, "t"),
    quadF([u0, t0, h1], [u1, t0, h1], [u1, t1, h1], [u0, t1, h1], top, "u"),
  ];
}

/** A building as a box: what the layout and the box renderer need (code rounds 2 and 3). */
export interface TownBox {
  id: string;
  /** Its front (the picture), the lights in it, a home's sign face. */
  front: Character;
  lights: readonly LightSpot[];
  sign?: { x: number; y: number; w: number; h: number };
  /** Its lot in squares: across the street front, and deep. */
  lot: { w: number; d: number };
  /** How far its front line stands back from the lot's front edge, and how deep the box runs back from it (squares). */
  inset: number;
  depth: number;
  /** The front's body: the columns (px) its walls run back from. */
  body: { x0: number; x1: number };
  /** Its side walls (left: from the back to the front at body.x0; right: from the front at body.x1 back). null: no wall there (a slope runs to the ground). */
  left: SideArt | null;
  right: SideArt | null;
  /** A wall standing at its back (seen over a low or open box: a crib's, a paddock's), as wide as the body. */
  back?: SideArt;
  /**
   * Its back wall seen from behind (round 4: the chase camera faces any way, so a row's backs and a tower's show from the gardens and the
   * park), as wide as the body. Used when it has no `back`. Turned away (from the street) it isn't drawn, so it costs nothing there.
   */
  rear?: SideArt;
  /** Its roof faces, and the palette their tiles are painted in. */
  roof: readonly Face[];
  roofPal: Readonly<Record<string, string>>;
  /** Its width at the back as a share of the front's (1: a straight box). */
  taper: number;
  /** Its picture's pixels a world square (37, the town's, unless drawn bigger: the street town's buildings, TOWN_FEEL.streetBuildScale). */
  px?: number;
}
