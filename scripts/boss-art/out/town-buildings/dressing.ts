/**
 * The street town's dressing (Nov 5, final art; drawn by hand on the weekly plan usage): the sidewalk's tiles and kerb, the
 * hedge (a plane with a top, so it turns with the street instead of stepping), and the back gardens' things: flower beds,
 * bushes, sheds (little boxes), benches. The lamps are the park's own (town/houses/park.ts PARK_LAMP, PARK_LAMP_LIGHTS,
 * PARK_LAMP_POOLS), and so are the benches (PARK_BENCH): nothing new to draw for those.
 *
 * Ground tiles are top-down, 37 x 37, laid on the ground like the board's squares (the renderer maps them over a square's
 * four projected corners).
 */
import type { Character } from "../../../../packages/app/src/characters/sprite.ts";
import { BASE, box, character, gableRoof, grain, MAT, sideArt, SQ, type Piece, type TownBox } from "./town-kit.ts";

// ---- The sidewalk: four slabs a square, their joints, a few worn speckles; the kerb tile has a granite edge on its street side.
const PAVE_PAL = { ...BASE, a: "#bdb3a0", b: "#d8cfbd", c: "#e6dfd0", x: "#9d9584", X: "#7d7768" };
/** A sidewalk square (`kerb`: its street edge at the top of the tile, as laid with the tile's top toward the street). */
export function sidewalkTile(kerb = false, v = 0): Character {
  const P: Piece[] = [
    box(0, 0, SQ, SQ, (i, j) => {
      if (kerb && j < 5) return j === 4 ? "X" : j === 0 ? "c" : (i + v * 7) % 18 === 0 ? "X" : "x";
      if (i === 18 || j === 18 || i === 0 || j === (kerb ? 5 : 0)) return "a";
      const g = grain(i + v * 37, j, 51);
      return g > 0.97 ? "a" : g < 0.04 ? "c" : "b";
    }, false),
  ];
  return character(`sidewalk-${kerb ? "kerb" : "plain"}-${v}`, SQ, SQ, PAVE_PAL, P, [0, SQ]);
}

// ---- The hedge: a clipped box hedge along a street's near edge, a square long, 18 px tall, 0.4 of a square deep.
const GREENS = { ...BASE, k: "#1d3a1a", r: "#7bbb57", s: "#4f903c", S: "#356b2b", t: "#ff8fb3", u: "#ffe066", "-": "#0d0e1255" };
/** The hedge's front (a plane facing the street) and its top (a top-down tile): `v` 0..2 picks its flowers. */
export function hedgeFront(v = 0): Character {
  const P: Piece[] = [box(0, 0, SQ, 18, (i, j, x, y) => {
    const g = grain(x + v * 37, y, 52);
    if (j < 2) return "r";
    if (g > 0.975) return v === 1 ? "u" : "t";
    if (g > 0.8) return j < 8 ? "r" : "s";
    return j < 6 ? "s" : j > 14 ? "S" : g < 0.2 ? "S" : "s";
  }, false), box(0, 17, SQ, 1, "k", false)];
  return character(`hedge-front-${v}`, SQ, 19, GREENS, P, [0, 18]);
}
export function hedgeTop(v = 0): Character {
  return character(`hedge-top-${v}`, SQ, SQ, GREENS, [box(0, 0, SQ, SQ, (_i, _j, x, y) => {
    const g = grain(x >> 1, (y >> 1) + v * 40, 53);
    return g > 0.97 ? (v === 1 ? "u" : "t") : g > 0.6 ? "r" : g > 0.25 ? "s" : "S";
  }, false)], [0, SQ]);
}
export const HEDGE = { tall: 18, deep: 0.4 } as const;

// ---- Back-garden things (billboards, low: none taller than about a square, so nothing ever covers you).
/** A round garden bush (`v` 0..2: small, medium, big; flowering on 2). */
export function bush(v: number): Character {
  const r = 8 + v * 2;
  const P: Piece[] = [
    box(1, 2 * r - 1, 2 * r, 4, (i, j) => (Math.hypot((i + 0.5 - r) / r, (j - 1.5) / 2) <= 1 ? "-" : null), false),
    box(1, 1, 2 * r, 2 * r, (i, j) => {
      const d = Math.hypot(i + 0.5 - r, (j + 0.5 - r) * 1.1);
      if (d > r) return null;
      const g = grain(i, j, 54 + v);
      if (v === 2 && g > 0.92) return "t";
      return i + j < r * 0.9 ? "r" : d > r * 0.72 || i + j > r * 1.7 ? "S" : g > 0.7 ? "r" : "s";
    }),
  ];
  return character(`bush-${v}`, 2 * r + 2, 2 * r + 5, GREENS, P, [r + 1, 2 * r + 2]);
}
/** A flower bed: a board edge round a row of flowers (`v` 0..2: pink, orange, purple). */
export function bed(v: number): Character {
  const pal = { ...GREENS, v: "#9a6a43", V: "#6e4a2c", t: ["#ff8fb3", "#ff9f4a", "#b58cff"][v]!, u: "#ffe066", w: "#ffffff" };
  const P: Piece[] = [
    box(1, 9, 34, 6, (i, j) => (j < 2 ? "v" : i % 8 === 0 ? "V" : j === 5 ? "V" : "v")),
    box(2, 1, 32, 9, (i, j) => {
      if (j > 5) return i % 2 ? "s" : "r";
      const c = i % 5;
      if (c === 1 && j < 3) return j === 1 && i % 10 === 1 ? "u" : "t";
      if (c === 3 && j > 1 && j < 5) return (i >> 2) % 3 === 0 ? "w" : "t";
      return j > 3 && c !== 0 ? "s" : null;
    }, false),
  ];
  return character(`bed-${v}`, 37, 17, pal, P, [18, 14]);
}
/** A low picket of the garden fence between gardens (where two back gardens meet). */
export function gardenFence(): Character {
  const P: Piece[] = [box(0, 0, SQ, 12, (i, j) => { const p = i % 5; if (j === 4 || j === 8) return "g"; if (p >= 3) return null; if (j < 2 && p !== 1) return null; return p === 2 ? "G" : "g"; })];
  return character("garden-fence", SQ, 13, BASE, P, [0, 12]);
}

// ---- The shed: a little box (its front, plank sides, a felt gable), as the buildings are, so it turns as they do.
const SHED_COLOURS = [
  { a: "#6e4a2c", b: "#9a6a43", c: "#b88a5c", d: "#3f4b3c", e: "#556653", f: "#6f8269", l: "#3f6b3f" },
  { a: "#4f6b7d", b: "#6f8fa3", c: "#93b1c3", d: "#5a3a2c", e: "#7a4f3a", f: "#9a6a4e", l: "#e6d6a8" },
  { a: "#7d4a3a", b: "#a5614a", c: "#c4836a", d: "#3d3f4a", e: "#535767", f: "#6d7286", l: "#f1e6cf" },
] as const;
export function shed(v: number): TownBox {
  const pal = { ...BASE, ...SHED_COLOURS[v % 3]! };
  const W = 34, H = 42, F = H - 3, eave = 22, rise = 12;
  const P: Piece[] = [
    box(2, F - 2, 30, 5, (i, j) => (Math.hypot((i - 14.5) / 15, (j - 2) / 2.5) <= 1 ? "-" : null), false),
    box(5, F - eave, 24, eave, (_i, _j, x, y) => MAT.plank(x, y)),
    box(2, F - eave - rise, 30, rise + 2, (i, j) => { const off = Math.abs(i + 0.5 - 15); if (off > (j + 1) * 1.25 + 0.5) return null; if (off > (j + 1) * 1.25 - 1.5) return "g"; return j % 3 === 2 ? "d" : i < 15 ? "f" : "e"; }),
    box(13, F - 16, 9, 16, (i, j) => (i === 0 || i === 8 ? "m" : j === 7 ? "m" : "l")),
    box(20, F - 9, 1, 1, "y"),
    box(7, F - 17, 5, 5, (i, j) => (i === 0 || j === 0 || i === 4 || j === 4 ? "g" : "i")),
  ];
  const front = character(`shed-${v}`, W, H, pal, P);
  const L = Math.round(0.8 * SQ);
  return {
    id: `shed-${v}`, front, lights: [], lot: { w: 1, d: 1 }, inset: 0.1, depth: 0.8, body: { x0: 5, x1: 28 },
    left: sideArt(`shed-${v}-L`, pal, { mat: "plank", corner: false }, L, eave, true),
    right: sideArt(`shed-${v}-R`, pal, { mat: "plank", corner: false }, L, eave, false),
    roof: [...gableRoof(2, 32, eave - 1, 17, eave + rise, "shingle", 0, 1.05)],
    roofPal: pal,
    taper: 1,
  };
}
