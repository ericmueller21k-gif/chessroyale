/**
 * The street town's everyday buildings (Nov 5 mockup): rough fronts in the homes' format (characters/sprite.ts, drawn at the
 * town's 37 px a square), each one a design a street can repeat in other colors. Rough on purpose: they get drawn properly
 * once Eric picks. Not game code.
 *
 *   cottage    a little cottage behind a picket fence, flower boxes, a round-topped door, a chimney
 *   townhouse  two storeys and an attic over a front stoop, a bay window, a cornice
 *   skinny     a row of skinny houses, each its own color and roof (stepped, pointed, flat)
 *   flats      small apartments: three floors of balconies with flower pots, a water tank on the roof
 *   bakery     a corner bakery and cafe: a striped awning, a window of cakes, a table and chairs out front
 *   shop       a little shop under a scalloped awning, a display window
 *   block      a bigger building behind the rows: six floors of windows, a water tower
 *   tower      a tall clock tower behind the rows
 *
 * And the low things on the near side of a street: a hedge, a bush.
 */
import type { Character, Layer, Part } from "../../../packages/app/src/characters/sprite.ts";
import { grain, paint, WARM, type LightSpot } from "../../../packages/app/src/town/houses/kit.ts";
import type { Design } from "./plan.ts";

const SQ = 37;
type Piece = { part: Part; at: readonly [number, number] };
type Fn = (i: number, j: number, x: number, y: number) => string | null;

/** A part over (x0, y0, w, h): `f` is a key, or a function of the pixel inside the box (i, j) and on the picture (x, y). */
const box = (x0: number, y0: number, w: number, h: number, f: string | Fn, outline = true): Piece =>
  paint(Math.round(x0), Math.round(y0), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), (x, y) => (typeof f === "string" ? f : f(x - Math.round(x0), y - Math.round(y0), x, y)), outline);

// ---- Colors: walls (dark, mid, light), roofs (dark, mid, light), awnings (two stripes), doors.
const WALLS = [
  ["#d8b86a", "#f1d78f", "#fbeab4"], // butter
  ["#86a9cc", "#a9c7e4", "#cfe2f3"], // sky
  ["#8fc0a1", "#b1dbbf", "#d6f0de"], // mint
  ["#d793a0", "#efb3bf", "#f9d5db"], // rose
  ["#a99bd0", "#c6bae8", "#e0d8f6"], // lilac
  ["#d99a6c", "#f0b88d", "#f8d6b8"], // peach
  ["#b9b1a4", "#d8d0c2", "#eee8dc"], // stone
] as const;
const BRICK = [
  ["#8e4a35", "#b0614a", "#c97e62"],
  ["#7a5a48", "#9a7660", "#b8937a"],
  ["#5f6f86", "#7d8da5", "#9fb0c6"],
  ["#8a6d4a", "#a98a62", "#c6a97e"],
] as const;
const ROOFS = [
  ["#8e2f2a", "#b8453a", "#d9685a"], // red tile
  ["#3e4f6e", "#566a8f", "#7a8fb3"], // slate
  ["#3f6a3c", "#568c50", "#79ad6d"], // green
  ["#6b4a33", "#8a6244", "#ab815d"], // brown
  ["#2f6b6b", "#3f8c8a", "#62aeab"], // teal
] as const;
const AWNINGS = [
  ["#d84545", "#fbf3e6"],
  ["#3f86c9", "#fbf3e6"],
  ["#3f9a55", "#fbf3e6"],
  ["#e58a2f", "#fff2d6"],
  ["#9c55b8", "#fbf3e6"],
] as const;
const DOORS = ["#7a4a2c", "#2f5d8a", "#8a2f3c", "#3f6b3f", "#5a3f7a"] as const;

function palette(v: number, d: number): Record<string, string> {
  const w = WALLS[(v * 3 + d) % WALLS.length]!;
  const b = BRICK[(v + d) % BRICK.length]!;
  const r = ROOFS[(v + d * 2) % ROOFS.length]!;
  const a = AWNINGS[(v + d) % AWNINGS.length]!;
  return {
    k: "#2a2118",
    a: w[0], b: w[1], c: w[2], // walls
    A: b[0], B: b[1], C: b[2], // brick
    d: r[0], e: r[1], f: r[2], // roof
    g: "#f7f1e3", G: "#cfc4ad", // trim: light, shade
    i: "#3b4d6b", j: "#8fb4d9", // window glass: dark, light
    l: DOORS[(v + d) % DOORS.length]!, m: "#2a1d14", // door, its dark
    n: a[0], o: a[1], // awning stripes
    p: "#e9d29a", P: "#c9ab66", // a blank sign board: face, frame
    r: "#5f9e45", s: "#3f7a32", // greens
    t: "#ff7aa8", u: "#ffd84a", // flowers
    v: "#9a6a43", V: "#6e4a2c", // wood
    x: "#9a958c", X: "#6f6b64", // stone, iron
    Y: "#f2c14e", // brass
    w: "#ffffff",
    "-": "#0d0e1266", // ground shadow
  };
}

/** A sash window: trim round it, glass with a light top-left, a mullion cross, a sill. */
function windowAt(x: number, y: number, w: number, h: number, out: Piece[], lights: LightSpot[], cross = true) {
  out.push(
    box(x, y, w, h, (i, j) => {
      if (i === 0 || j === 0 || i === w - 1 || j === h - 1) return "g";
      if (cross && (i === Math.floor(w / 2) || j === Math.floor(h / 2))) return "g";
      return i + j < Math.min(w, h) * 0.55 ? "j" : "i";
    }),
  );
  out.push(box(x - 1, y + h, w + 2, 2, "G"));
  lights.push({ x, y, w, h, keys: "ij", color: WARM, strength: 0.8 });
}
/** A flower box under a window. */
const flowerBox = (x: number, y: number, w: number, out: Piece[]) => {
  out.push(box(x, y - 2, w, 3, (i) => (i % 3 === 1 ? "t" : i % 3 === 2 ? "r" : "u"), false));
  out.push(box(x, y + 1, w, 3, "v"));
};
/** A door: a panelled door (arched on top if `arch`), its knob. */
function doorAt(x: number, y: number, w: number, h: number, out: Piece[], lights: LightSpot[], arch = false) {
  out.push(
    box(x, y, w, h, (i, j) => {
      if (arch && j < w / 2 && Math.hypot(i + 0.5 - w / 2, j + 0.5 - w / 2) > w / 2) return null;
      if (i === w - 3 && j === Math.floor(h * 0.55)) return "Y";
      if (j > 3 && j < h - 2 && (i === 2 || i === w - 3) && i !== w - 3) return "m";
      return "l";
    }),
  );
  if (arch) lights.push({ x: x + 2, y: y + 2, w: w - 4, h: 4, keys: "l", color: WARM, strength: 0.25 });
}
/** A wall of siding (horizontal boards) or plaster with a little grain. */
const siding: Fn = (_i, j, x, y) => (j % 5 === 4 ? "a" : grain(x, y, 3) > 0.93 ? "c" : "b");
const plaster: Fn = (_i, _j, x, y) => (grain(x, y, 5) > 0.95 ? "a" : grain(x, y, 6) > 0.95 ? "c" : "b");
const brick: Fn = (_i, j, x) => (j % 4 === 3 ? "A" : (x + (Math.floor(j / 4) % 2) * 3) % 6 === 0 ? "A" : "B");
/** A gable roof over (x0..x0+w) rising h from its eaves at `y`: shingle rows, lit on the left. */
const gable = (x0: number, y: number, w: number, h: number): Piece =>
  box(x0, y - h, w, h + 2, (i, j) => {
    const half = w / 2;
    const reach = ((j + 1) / (h + 2)) * half + 1;
    if (Math.abs(i + 0.5 - half) > reach) return null;
    if (j % 4 === 3) return "d";
    return i < half ? "f" : "e";
  });
/** A cornice: a trim band with a shadow under it. */
const cornice = (x: number, y: number, w: number): Piece => box(x, y, w, 4, (_i, j) => (j < 2 ? "g" : "G"));
const shadow = (cx: number, foot: number, rx: number): Piece => box(cx - rx, foot - 2, rx * 2, 4, (i, j) => (Math.hypot((i + 0.5 - rx) / rx, (j - 1.5) / 2) <= 1 ? "-" : null), false);

function make(id: string, w: number, h: number, pal: Record<string, string>, pieces: Piece[], lights: LightSpot[]): Facade {
  const parts: Record<string, Part> = {};
  const layers: Layer[] = [];
  pieces.forEach((p, n) => {
    parts[`p${n}`] = p.part;
    layers.push({ part: `p${n}`, x: p.at[0], y: p.at[1] });
  });
  const ch: Character = { id, name: id, w, h, foot: [Math.floor(w / 2), h - 3], palette: pal, parts, anims: { idle: { frames: [{ layers, ms: 1000 }], loop: true } } };
  return { ch, lights };
}

export interface Facade {
  ch: Character;
  lights: LightSpot[];
}

// ---- The designs. Each takes the lot's width in squares and its color variant.

function cottage(wsq: number, v: number): Facade {
  const W = wsq * SQ;
  const H = 104;
  const F = H - 3;
  const pal = palette(v, 0);
  const P: Piece[] = [];
  const L: LightSpot[] = [];
  const bw = Math.min(W - 10, 74);
  const bx = Math.round((W - bw) / 2);
  const top = F - 46;
  P.push(shadow(W / 2, F, bw / 2 + 4));
  P.push(box(bx + bw - 16, top - 34, 8, 20, (i, j) => (j < 3 ? "X" : i < 3 ? "C" : "B"))); // chimney
  P.push(box(bx, top, bw, F - top, siding));
  P.push(gable(bx - 6, top + 1, bw + 12, 30));
  // A round window in the gable.
  P.push(box(bx + bw / 2 - 5, top - 17, 10, 10, (i, j) => (Math.hypot(i - 4.5, j - 4.5) > 5 ? null : Math.hypot(i - 4.5, j - 4.5) > 3.6 ? "g" : i + j < 8 ? "j" : "i")));
  L.push({ x: bx + bw / 2 - 4, y: top - 16, w: 8, h: 8, keys: "ij", color: WARM, strength: 0.7 });
  doorAt(bx + bw / 2 - 7, F - 28, 14, 28, P, L, true);
  windowAt(bx + 6, top + 12, 14, 14, P, L);
  windowAt(bx + bw - 20, top + 12, 14, 14, P, L);
  flowerBox(bx + 5, top + 29, 16, P);
  flowerBox(bx + bw - 21, top + 29, 16, P);
  // The picket fence across the lot, a gate in the middle (open), and a bush.
  P.push(
    box(0, F - 13, W, 13, (i, j) => {
      const gate = Math.abs(i + 0.5 - W / 2) < 9;
      if (gate) return null;
      const p = i % 5;
      if (j === 4 || j === 9) return p === 4 ? "G" : "g";
      if (p >= 3) return null;
      if (j < 2 && p !== 1) return null;
      return p === 2 ? "G" : "g";
    }),
  );
  P.push(box(2, F - 18, 14, 12, (i, j) => (Math.hypot((i - 7) / 7, (j - 7) / 6) > 1 ? null : i + j < 9 ? "r" : "s")));
  return make(`cottage-${wsq}-${v}`, W, H, pal, P, L);
}

function townhouse(wsq: number, v: number): Facade {
  const W = wsq * SQ;
  const H = 128;
  const F = H - 3;
  const pal = palette(v, 1);
  const P: Piece[] = [];
  const L: LightSpot[] = [];
  const bx = 3;
  const bw = W - 6;
  const top = F - 98;
  P.push(shadow(W / 2, F, bw / 2 + 2));
  P.push(box(bx + 2, top - 16, bw - 4, 18, (i, j) => (j % 4 === 3 ? "d" : i < 6 ? "f" : "e"))); // mansard
  P.push(box(bx + bw / 2 - 8, top - 24, 16, 14, (i, j) => (j < 4 ? (Math.abs(i - 7.5) < j * 2 + 2 ? "e" : null) : "g"))); // dormer
  windowAt(bx + bw / 2 - 5, top - 18, 10, 8, P, L, false);
  P.push(box(bx, top, bw, F - top, v % 2 ? brick : plaster));
  P.push(cornice(bx - 2, top, bw + 4));
  P.push(cornice(bx - 1, top + 34, bw + 2));
  for (const fy of [top + 8, top + 42]) {
    windowAt(bx + 7, fy, 14, 20, P, L);
    windowAt(bx + bw - 21, fy, 14, 20, P, L);
  }
  // A bay window on the ground floor, the door up the stoop.
  P.push(box(bx + 4, F - 30, 24, 26, (i, j) => (j < 3 ? "g" : i === 0 || i === 23 || i === 8 || i === 15 ? "g" : j < 13 ? (i + j < 12 ? "j" : "i") : "b")));
  L.push({ x: bx + 5, y: F - 27, w: 22, h: 10, keys: "ij", color: WARM, strength: 0.9 });
  doorAt(bx + bw - 22, F - 34, 14, 26, P, L);
  P.push(box(bx + bw - 26, F - 8, 22, 8, (_i, j) => (j % 3 === 0 ? "g" : "x"))); // the stoop's steps
  P.push(box(bx + bw - 27, F - 22, 2, 14, "X")); // its rail
  return make(`townhouse-${wsq}-${v}`, W, H, pal, P, L);
}

function skinny(wsq: number, v: number): Facade {
  const n = wsq >= 3 ? 3 : 2;
  const W = wsq * SQ;
  const each = Math.floor((W - 2) / n);
  const H = 132;
  const F = H - 3;
  const pal = palette(v, 2);
  // Each house its own wall color (keys a/b/c, then 1/2/3, then 4/5/6).
  const keys = ["abc", "123", "456"];
  WALLS[(v + 2) % WALLS.length]!.forEach((c, i) => (pal[String(i + 1)] = c));
  WALLS[(v + 4) % WALLS.length]!.forEach((c, i) => (pal[String(i + 4)] = c));
  const P: Piece[] = [];
  const L: LightSpot[] = [];
  P.push(shadow(W / 2, F, W / 2 - 2));
  for (let h = 0; h < n; h++) {
    const x = 1 + h * each;
    const k = keys[h]!;
    const tall = [100, 114, 92][(h + v) % 3]!;
    const top = F - tall;
    const roof = (h + v) % 3;
    if (roof === 0) P.push(gable(x - 1, top + 1, each + 2, 18));
    if (roof === 1)
      P.push(box(x + 2, top - 14, each - 4, 16, (i, j) => (Math.abs(i + 0.5 - (each - 4) / 2) > Math.floor(j / 4) * 3 + 4 ? null : k[2]!))); // stepped gable
    P.push(box(x, top, each, F - top, (_i, j, xx, yy) => (j % 5 === 4 ? k[0]! : grain(xx, yy, 7) > 0.95 ? k[2]! : k[1]!)));
    if (roof === 2) P.push(cornice(x - 1, top, each + 2));
    for (let fy = top + 10; fy < F - 36; fy += 24) windowAt(x + each / 2 - 6, fy, 12, 16, P, L);
    doorAt(x + each / 2 - 6, F - 24, 12, 24, P, L, h % 2 === 0);
  }
  return make(`skinny-${wsq}-${v}`, W, H, pal, P, L);
}

function flats(wsq: number, v: number): Facade {
  const W = wsq * SQ;
  const H = 150;
  const F = H - 3;
  const pal = palette(v, 3);
  const P: Piece[] = [];
  const L: LightSpot[] = [];
  const bx = 3;
  const bw = W - 6;
  const top = F - 128;
  P.push(shadow(W / 2, F, bw / 2 + 2));
  P.push(box(bx + bw - 30, top - 18, 18, 14, (i, j) => (j < 3 ? "V" : i % 6 === 0 ? "V" : "v"))); // the water tank
  P.push(box(bx + bw - 28, top - 4, 2, 4, "V"));
  P.push(box(bx + bw - 16, top - 4, 2, 4, "V"));
  P.push(box(bx, top, bw, F - top, brick));
  P.push(cornice(bx - 2, top, bw + 4));
  const floors = 3;
  const fh = 30;
  for (let f = 0; f < floors; f++) {
    const fy = top + 8 + f * fh;
    for (let k = 0; k < 2; k++) {
      const wx = bx + 8 + k * (bw / 2);
      windowAt(wx, fy, 16, 18, P, L);
      // The balcony: a slab and a railing, a flower pot.
      P.push(box(wx - 3, fy + 18, 22, 3, "x"));
      P.push(box(wx - 3, fy + 11, 22, 7, (i, j) => (j === 0 ? "X" : i % 3 === 0 ? "X" : null)));
      if ((f + k + v) % 2 === 0) P.push(box(wx + 14, fy + 7, 5, 4, (_i, j) => (j < 2 ? "t" : "v")));
    }
  }
  // The ground floor: the entrance (glass doors) and the bell panel.
  const gy = top + 8 + floors * fh;
  P.push(box(bx + bw / 2 - 12, gy + 2, 24, F - gy - 2, (i, j) => (j < 3 ? "g" : i === 0 || i === 23 || i === 11 || i === 12 ? "g" : i + j < 14 ? "j" : "i")));
  L.push({ x: bx + bw / 2 - 11, y: gy + 5, w: 22, h: F - gy - 5, keys: "ij", color: WARM, strength: 1 });
  windowAt(bx + 6, gy + 4, 14, 14, P, L);
  windowAt(bx + bw - 20, gy + 4, 14, 14, P, L);
  return make(`flats-${wsq}-${v}`, W, H, pal, P, L);
}

/** A striped awning over (x, y): `w` across, `h` deep, scalloped along its foot. */
const awning = (x: number, y: number, w: number, h: number, stripes = true): Piece =>
  box(x, y, w, h + 3, (i, j) => {
    if (j >= h && Math.hypot(((i % 8) - 3.5) / 4, (j - h + 0.5) / 3) > 1) return null;
    return stripes ? (Math.floor(i / 8) % 2 ? "o" : "n") : j < 2 ? "o" : "n";
  });

function bakery(wsq: number, v: number): Facade {
  const W = wsq * SQ;
  const H = 112;
  const F = H - 3;
  const pal = palette(v, 4);
  const P: Piece[] = [];
  const L: LightSpot[] = [];
  const bx = 3;
  const bw = W - 6;
  const top = F - 88;
  P.push(shadow(W / 2, F, bw / 2 + 2));
  P.push(gable(bx - 3, top + 1, bw + 6, 20));
  P.push(box(bx, top, bw, F - top, plaster));
  windowAt(bx + 10, top + 8, 14, 16, P, L);
  windowAt(bx + bw / 2 - 7, top + 8, 14, 16, P, L);
  windowAt(bx + bw - 24, top + 8, 14, 16, P, L);
  P.push(box(bx + 10, top + 30, bw - 20, 10, (i, j) => (i < 2 || j < 2 || i > bw - 23 || j > 7 ? "P" : "p"))); // the blank sign
  P.push(awning(bx - 2, top + 42, bw + 4, 9));
  // The big window, cakes on its shelf; the door.
  const wy = top + 56;
  P.push(box(bx + 6, wy, bw - 34, F - wy - 4, (i, j) => (i === 0 || j === 0 || i === bw - 35 || j === F - wy - 5 ? "g" : j > F - wy - 12 ? (i % 7 < 4 ? ["t", "u", "w"][Math.floor(i / 7) % 3]! : "v") : i + j < 14 ? "j" : "i")));
  L.push({ x: bx + 7, y: wy + 1, w: bw - 36, h: F - wy - 6, keys: "ij", color: WARM, strength: 1 });
  doorAt(bx + bw - 24, wy - 2, 16, F - wy + 2, P, L);
  // A cafe table and two chairs out front, a chalkboard.
  P.push(box(bx + 16, F - 12, 16, 3, "X"), box(bx + 23, F - 9, 2, 9, "X"));
  P.push(box(bx + 9, F - 11, 2, 11, "X"), box(bx + 36, F - 11, 2, 11, "X"));
  P.push(box(bx + 19, F - 15, 5, 3, "t"));
  return make(`bakery-${wsq}-${v}`, W, H, pal, P, L);
}

function shop(wsq: number, v: number): Facade {
  const W = wsq * SQ;
  const H = 100;
  const F = H - 3;
  const pal = palette(v, 5);
  const P: Piece[] = [];
  const L: LightSpot[] = [];
  const bx = 3;
  const bw = W - 6;
  const top = F - 80;
  P.push(shadow(W / 2, F, bw / 2 + 2));
  P.push(box(bx, top, bw, F - top, v % 2 ? plaster : siding));
  P.push(box(bx - 2, top - 6, bw + 4, 8, (i, j) => (j < 3 ? "g" : Math.abs(i - (bw + 4) / 2) < 10 ? "G" : "g"))); // the false front
  windowAt(bx + bw / 2 - 9, top + 6, 18, 16, P, L);
  P.push(box(bx + 6, top + 26, bw - 12, 9, (i, j) => (i < 2 || j < 2 || i > bw - 15 || j > 6 ? "P" : "p")));
  P.push(awning(bx - 3, top + 37, bw + 6, 8, false));
  const wy = top + 50;
  P.push(box(bx + 5, wy, bw - 26, F - wy - 3, (i, j) => (i === 0 || j === 0 || i === bw - 27 || j === F - wy - 4 ? "g" : j > F - wy - 10 ? (i % 6 < 3 ? "u" : "r") : i + j < 10 ? "j" : "i")));
  L.push({ x: bx + 6, y: wy + 1, w: bw - 28, h: F - wy - 5, keys: "ij", color: WARM, strength: 1 });
  doorAt(bx + bw - 18, wy - 2, 13, F - wy + 2, P, L);
  return make(`shop-${wsq}-${v}`, W, H, pal, P, L);
}

function block(wsq: number, v: number): Facade {
  const W = wsq * SQ;
  const H = 168;
  const F = H - 3;
  const pal = palette(v, 6);
  const P: Piece[] = [];
  const L: LightSpot[] = [];
  const bx = 4;
  const bw = W - 8;
  const top = F - 140;
  // The water tower on its legs.
  P.push(box(bx + 18, top - 22, 22, 18, (i, j) => (j < 4 ? (Math.abs(i - 10.5) < j * 3 + 2 ? "d" : null) : i % 5 === 0 ? "V" : "v")));
  P.push(box(bx + 20, top - 4, 2, 4, "X"), box(bx + 36, top - 4, 2, 4, "X"));
  P.push(box(bx, top, bw, F - top, brick));
  P.push(cornice(bx - 2, top, bw + 4));
  const cols = Math.floor((bw - 8) / 22);
  const gap = (bw - cols * 14) / (cols + 1);
  for (let f = 0; f < 6; f++) for (let k = 0; k < cols; k++) windowAt(bx + gap + k * (14 + gap), top + 9 + f * 21, 14, 14, P, L, false);
  return make(`block-${wsq}-${v}`, W, H, pal, P, L);
}

function tower(wsq: number, v: number): Facade {
  const W = wsq * SQ;
  const H = 186;
  const F = H - 3;
  const pal = palette(v, 7);
  const P: Piece[] = [];
  const L: LightSpot[] = [];
  const bw = Math.min(W - 10, 50);
  const bx = Math.round((W - bw) / 2);
  const top = F - 140;
  P.push(gable(bx - 4, top - 30, bw + 8, 34)); // the spire
  P.push(box(bx + 2, top - 30, bw - 4, 30, (_i, _j, x, y) => (grain(x, y, 9) > 0.96 ? "C" : "B")));
  // The clock.
  P.push(box(bx + bw / 2 - 11, top - 26, 22, 22, (i, j) => {
    const d = Math.hypot(i - 10.5, j - 10.5);
    if (d > 11) return null;
    if (d > 9) return "Y";
    if ((i === 10 || i === 11) && j > 4 && j < 12) return "k";
    if ((j === 10 || j === 11) && i > 10 && i < 16) return "k";
    return "w";
  }));
  P.push(box(bx, top, bw, F - top, (_i, j, x, y) => (j % 8 === 7 ? "x" : grain(x, y, 4) > 0.95 ? "X" : "x").replace("x", (j >> 3) % 2 ? "C" : "B")));
  P.push(cornice(bx - 2, top, bw + 4));
  for (let f = 0; f < 4; f++) windowAt(bx + bw / 2 - 6, top + 10 + f * 30, 12, 20, P, L);
  doorAt(bx + bw / 2 - 8, F - 22, 16, 22, P, L, true);
  return make(`tower-${wsq}-${v}`, W, H, pal, P, L);
}

const DESIGNS: Record<Design, (wsq: number, v: number) => Facade> = { cottage, townhouse, skinny, flats, bakery, shop, block, tower };
const cache = new Map<string, Facade>();
/** A design at a lot's width (squares) in a color variant. */
export function facade(id: Design, wsq: number, v: number): Facade {
  const key = `${id}-${wsq}-${v}`;
  let f = cache.get(key);
  if (!f) cache.set(key, (f = DESIGNS[id](wsq, v)));
  return f;
}
export const DESIGN_NAMES: Record<Design, string> = {
  cottage: "Cottage",
  townhouse: "Townhouse",
  skinny: "Skinny houses",
  flats: "Small flats",
  bakery: "Bakery and cafe",
  shop: "Corner shop",
  block: "Big block (behind)",
  tower: "Clock tower (behind)",
};

// ---- The low things on a street's near side.
const GREENS = { k: "#1d3a1a", r: "#6aaa4c", s: "#4c8a3a", S: "#356b2b", t: "#ff8fb3", u: "#ffe066", "-": "#0d0e1255" };
/** A clipped hedge a square long (20 px tall): lit on top, a few flowers. */
export function hedge(v: number): Character {
  const P: Piece[] = [box(0, 2, 37, 18, (i, j, x, y) => (j < 3 ? "r" : grain(x + v * 37, y, 11) > 0.97 ? "t" : j < 8 ? "s" : "S"))];
  return make(`hedge-${v}`, 37, 22, GREENS, P, []).ch;
}
/** A round garden bush. */
export function bush(v: number): Character {
  const r = 9 + v * 2;
  const P: Piece[] = [shadow(r + 1, 2 * r + 2, r), box(1, 1, 2 * r, 2 * r, (i, j) => (Math.hypot(i + 0.5 - r, j + 0.5 - r) > r ? null : i + j < r ? "r" : i + j < 1.6 * r ? "s" : "S"))];
  return make(`bush-${v}`, 2 * r + 2, 2 * r + 5, GREENS, P, []).ch;
}

/** A little garden shed (about a square tall): plank walls, a door, a felt roof. */
export function shed(v: number): Character {
  const pal = { ...palette(v, 2), "-": "#0d0e1255" };
  const P: Piece[] = [shadow(17, 33, 15), box(6, 14, 24, 20, (i) => (i % 4 === 3 ? "V" : "v")), box(3, 6, 30, 9, (i, j) => (Math.abs(i + 0.5 - 15) > j * 1.8 + 2 ? null : j % 3 === 2 ? "d" : "e")), box(13, 20, 9, 14, "l"), box(20, 27, 1, 1, "Y")];
  return make(`shed-${v}`, 36, 37, pal, P, []).ch;
}
/** A flower bed: a low edge of boards round a row of flowers. */
export function bed(v: number): Character {
  const pal = { ...GREENS, v: "#9a6a43", V: "#6e4a2c", w: "#ffffff", t: ["#ff8fb3", "#ff9f4a", "#b58cff"][v]!, u: "#ffe066" };
  const P: Piece[] = [box(2, 10, 32, 5, (_i, j) => (j < 2 ? "v" : "V")), box(3, 3, 30, 8, (i, j) => (j > 4 ? (i % 2 ? "s" : "r") : i % 4 === 1 ? (j < 2 ? "t" : "s") : i % 4 === 3 && j > 1 ? (j < 3 ? "u" : "r") : null), false)];
  return make(`bed-${v}`, 37, 17, pal, P, []).ch;
}
