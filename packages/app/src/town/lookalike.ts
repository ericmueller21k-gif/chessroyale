/**
 * The street town's look-alike fronts (Nov 5, round 4: the rows; Eric: "most of them aren't actually like real buildings… they look
 * alike"). The everyday fronts that fill a row between the boss homes: not enterable, made from a small set of parts (a body in a
 * material and a colour, floors of windows, a ground floor with a door or a shop window, a roof cap) so they repeat with different
 * colours, heights, windows and caps. One makes a front of any width in pixels, so it doubles as the filler for whatever a row leaves.
 *
 * Each is a box (town-kit.ts TownBox) whose front runs edge to edge: the wall fills every column of the picture, so two set side by
 * side butt with no gap (Eric: "they just need to be attached like that"). Its sides are plain party walls (a neighbour covers them;
 * boxes.ts never draws a covered one), except at a corner, where the side facing the cross street is a second front (`corner`):
 * windows on every floor and a door, so a crossing looks closed. Its roof is one or two faces (flat, a gable, a vault): depth only
 * where it shows.
 *
 * Pixel scale and palette as the town's (37 px a square, town-kit.ts's keys). No words or brands on anything.
 */
import type { LightSpot } from "./houses/kit.ts";
import {
  awning, box, character, cornice, doorAt, flatRoof, flowerBox, gable, gableRoof, MAT, paletteOf, quadF, sideArt, SQ, vaultRoof, WARM, windowAt,
  type Colourway, type Face, type Mat, type Piece, type TownBox,
} from "./town-kit.ts";

/** A look-alike's recipe: its seed (every choice), its width (px), its height class and, at a corner, which side is a second front. */
export interface LookSpec {
  seed: number;
  /** Its front's width in picture pixels (37 a square): any width from about 20 px. */
  w: number;
  /** Its height: 0 two floors, 1 three, 2 four, 3 a landmark (four floors and a tall cap). */
  tall: 0 | 1 | 2 | 3;
  /** At a row's end: the side that faces the cross street, drawn as a second front. */
  corner?: "L" | "R" | null;
  /** How deep the box runs back (squares). */
  depth: number;
  /** A flat front (away from a corner): its roof flat at the eave, its cap a false front over it. */
  flat?: boolean;
  /** Its picture's pixels a world square (the street town's buildings are drawn bigger: boxes.ts BUILD_PX). */
  px?: number;
  /** Floors, in place of its height class's (a skyline tower behind the rows: more). */
  floors?: number;
  /** Free-standing (a skyline tower): windows on both sides, not party walls. */
  free?: boolean;
}

// ---- The colours (dark, mid, light): warm cartoon walls, roofs, doors and awnings.
const WALLS: readonly (readonly [string, string, string])[] = [
  ["#d2ad5c", "#efd48a", "#fbeab4"], // butter
  ["#9a9a52", "#bcbc72", "#dcdca0"], // olive (round 4: was a sky blue, which read as sky between two fronts)
  ["#84b897", "#acd8bb", "#d4efdd"], // mint
  ["#cf8594", "#eeaebb", "#f9d4db"], // rose
  ["#9f90c8", "#c3b6e6", "#e0d8f6"], // lilac
  ["#d3925f", "#eeb488", "#f8d5b6"], // peach
  ["#c9b48e", "#e8dcc0", "#f7f0de"], // cream
  ["#8a9c76", "#adbf98", "#d2dfc0"], // sage
  ["#c4654a", "#e08766", "#f2b096"], // terracotta
  ["#d97a9e", "#f29bbd", "#fbc6dc"], // bubblegum
  ["#c8a33a", "#e6c457", "#f6e08c"], // mustard
  ["#5f9aa0", "#82bcc0", "#b4dcde"], // teal
  ["#7e3f2e", "#a55642", "#c3765c"], // red brick
  ["#8a6a45", "#a9895f", "#c8aa7e"], // tan brick
];
const ROOFS: readonly (readonly [string, string, string])[] = [
  ["#8a2c27", "#b4443a", "#d8695a"], ["#38465f", "#52637f", "#7488a6"], ["#3d6438", "#55864d", "#79aa6c"],
  ["#674630", "#8a6244", "#ad835e"], ["#2c6566", "#3c8886", "#5fabaa"], ["#5a3a5e", "#7a5480", "#9e78a3"], ["#9a5a1e", "#c47a2c", "#e3a050"],
];
const DOORS = ["#3f6b3f", "#a33a3a", "#2f5d8a", "#7a4a2c", "#8a2f3c", "#5a3f7a", "#d1a23a", "#2c6566"];
const AWNINGS: readonly (readonly [string, string])[] = [["#d84545", "#fbf3e6"], ["#3f86c9", "#fbf3e6"], ["#3f9a55", "#fbf3e6"], ["#e58a2f", "#fff2d6"], ["#9c55b8", "#fbf3e6"], ["#e0559a", "#fff0f6"]];
/** The bodies' materials: mostly plaster and siding (the cartoon look), some brick, stone or stripes. */
const MATS: readonly Mat[] = ["plaster", "plaster", "plaster", "siding", "siding", "brick", "stone", "stripe"];

/** The roof caps a front can wear. */
export type Cap = "cornice" | "gable" | "steps" | "round" | "crenel" | "mansard";
const CAPS: readonly Cap[] = ["cornice", "cornice", "gable", "gable", "steps", "round", "crenel", "mansard"];

/** A small seeded random (mulberry32): the same seed, the same front. */
export function rand(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, a: readonly T[]): T => a[Math.floor(r() * a.length) % a.length]!;

/** The floors' heights (px): the ground floor, each one over it. */
const GROUND = 40;
const FLOOR = 29;
/** Floors for each height class. */
const FLOORS = [2, 3, 4, 4] as const;

/** What a front was made of (tests, the mockup's notes): its colour index, material, cap, floors, ground floor. */
export interface LookParts {
  wall: number;
  mat: Mat;
  cap: Cap;
  floors: number;
  shop: boolean;
  eave: number;
}

const cache = new Map<string, { box: TownBox; parts: LookParts }>();

/** The look-alike for a recipe (made once a recipe). */
export function lookalike(spec: LookSpec): TownBox {
  return lookalikeWith(spec).box;
}
export function lookalikeWith(spec: LookSpec): { box: TownBox; parts: LookParts } {
  const W = Math.max(12, Math.round(spec.w));
  const key = `look-${spec.seed}-${W}-${spec.tall}-${spec.corner ?? ""}-${spec.depth}${spec.flat ? "-f" : ""}-${spec.px ?? ""}-${spec.floors ?? ""}${spec.free ? "-x" : ""}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = rand(spec.seed * 2654435761 + W);
  const wallI = Math.floor(r() * WALLS.length) % WALLS.length;
  const brickWall = wallI >= 12;
  const mat: Mat = brickWall ? "brick" : pick(r, MATS);
  const cw: Colourway = {
    name: key,
    wall: WALLS[wallI]!,
    roof: pick(r, ROOFS),
    door: pick(r, DOORS),
    awning: pick(r, AWNINGS),
    // (Trim a shade off white for some: cream or a pale of the wall.)
    extra: r() < 0.3 ? { g: WALLS[wallI]![2], G: WALLS[wallI]![1] } : undefined,
  };
  const pal = paletteOf(cw);
  const floors = spec.floors ?? FLOORS[spec.tall] + (spec.tall < 3 && W >= 90 && r() < 0.25 ? 1 : 0);
  // A narrow front (under a square and a half) keeps to a slim cap; a landmark takes the tallest.
  let cap: Cap = pick(r, CAPS);
  if (W < 50 && (cap === "crenel" || cap === "mansard")) cap = "gable";
  if (spec.tall === 3) cap = r() < 0.5 ? "round" : "steps";
  const shop = W >= 44 && r() < 0.45;
  const eave = GROUND + FLOOR * (floors - 1) + 6;
  const capH = cap === "cornice" ? 6 : cap === "crenel" ? 8 : cap === "mansard" ? 16 : Math.min(cap === "round" ? 34 : 30, Math.round(W * (cap === "round" ? 0.32 : 0.36))) + (spec.tall === 3 ? 18 : 0);
  const H = eave + capH + 3 + 4;
  const F = H - 3;
  const top = F - eave;
  const P: Piece[] = [];
  const L: LightSpot[] = [];
  const wallFn = (_i: number, _j: number, x: number, y: number) => MAT[mat](x, y);

  // The cap (behind the wall's top edge, so the wall's ink line runs over its foot).
  if (cap === "gable") P.push(gable(0, top + 2, W, capH));
  if (cap === "steps") {
    const n = Math.max(2, Math.min(4, Math.round(W / 22)));
    const stepW = W / (2 * n);
    P.push(box(0, top - capH, W, capH + 1, (i, j) => {
      const off = Math.abs(i + 0.5 - W / 2);
      const k = Math.floor(off / stepW);
      const lim = Math.round((k / n) * capH);
      if (j < lim) return null;
      return j === lim ? "g" : MAT[mat](i, j + 200);
    }));
  }
  if (cap === "round") {
    P.push(box(0, top - capH, W, capH + 1, (i, j) => {
      const dx = (i + 0.5 - W / 2) / (W / 2);
      const y = capH * (1 - Math.sqrt(Math.max(0, 1 - dx * dx * 0.92)));
      if (j < y) return null;
      if (j < y + 2) return "d";
      if (j < y + 4) return "e";
      return MAT[mat](i, j + 200);
    }));
    // A round window in the cap.
    const rw = Math.min(12, Math.round(capH * 0.45));
    if (capH > 16) {
      const cx = W / 2 - rw / 2, cy = top - capH * 0.55 - rw / 2;
      P.push(box(cx, cy, rw, rw, (i, j) => { const d = Math.hypot(i + 0.5 - rw / 2, j + 0.5 - rw / 2); return d > rw / 2 ? null : d > rw / 2 - 1.4 ? "g" : i + j < rw * 0.8 ? "j" : "i"; }));
      L.push({ x: cx + 1, y: cy + 1, w: rw - 2, h: rw - 2, keys: "ij", color: WARM, strength: 0.7 });
    }
  }
  if (cap === "mansard") {
    P.push(box(0, top - capH, W, capH + 1, (i, j) => {
      const inset = Math.round((capH - j) * 0.3);
      if (i < inset || i > W - 1 - inset) return null;
      return j % 4 === 3 ? "d" : (i + (j >> 2) * 3) % 7 === 0 ? "d" : i < W / 2 ? "f" : "e";
    }));
    for (let k = 0, n = Math.max(1, Math.floor((W - 10) / 34)); k < n; k++) {
      const x = Math.round(((k + 0.5) * W) / n) - 5;
      windowAt(x, top - capH + 4, 10, 9, P, L, { cross: false, strength: 0.6 });
    }
  }
  // The body: every column of the picture, so a neighbour butts against it with no gap.
  P.push(box(0, top, W, eave, wallFn));
  if (cap === "cornice") P.push(cornice(0, top, W));
  if (cap === "crenel") P.push(box(0, top - 8, W, 10, (i, j) => (j < 4 && i % 10 >= 5 ? null : j === 0 || (j === 4 && i % 10 >= 5) ? "g" : j < 6 ? "g" : "G")));
  if (cap !== "cornice" && cap !== "crenel") P.push(box(0, top, W, 3, (_i, j) => (j < 2 ? "g" : "G"), false));
  // A string course over the ground floor, and a plinth.
  const gTop = F - GROUND;
  P.push(box(0, gTop - 3, W, 3, (_i, j) => (j < 2 ? "g" : "G"), false));
  P.push(box(0, F - 4, W, 4, (i, j) => (j === 0 ? "X" : i % 11 === 0 ? "X" : "x"), false));

  // Upper floors: windows in a column grid, one style a front.
  const ww = W < 40 ? 10 : pick(r, [12, 14, 14, 16]);
  const wh = pick(r, [15, 17, 19]);
  const cols = Math.max(1, Math.min(4, Math.floor((W - 6) / (ww + 12))));
  const arch = r() < 0.3;
  const shut = r() < 0.35 && W >= 40 ? pick(r, ["l", "e", "n"]) : undefined;
  const boxes = r() < 0.4;
  const balcony = r() < 0.25 && floors >= 3;
  const colX = (k: number) => Math.round(((k + 0.5) * W) / cols - ww / 2);
  for (let f = 1; f < floors; f++) {
    const fy = gTop - 3 - f * FLOOR + Math.round((FLOOR - wh) / 2) + 1;
    for (let k = 0; k < cols; k++) {
      const x = colX(k);
      windowAt(x, fy, ww, wh, P, L, { arch: arch && f === floors - 1, shut: shut && x > 6 && x + ww < W - 6 ? shut : undefined, cross: wh >= 15 });
      if (boxes && f === 1) flowerBox(x - 1, fy + wh + 4, ww + 2, P);
    }
    if (balcony && f === 1 && cols >= 2) P.push(box(colX(0) - 4, fy + wh, colX(cols - 1) + ww - colX(0) + 8, 7, (i, j) => (j === 0 || j === 6 ? "X" : i % 3 === 0 ? "X" : null)));
  }
  // The ground floor: a shop (an awning over a big window and a glazed door) or a house's (a door and a window or two).
  if (shop) {
    const dw = 14;
    const winW = W - dw - 14;
    const wy = gTop + 12;
    P.push(awning(0, gTop + 1, W, 7, r() < 0.7));
    P.push(box(4, wy, winW, F - 4 - wy, (i, j) => {
      const hh = F - 4 - wy;
      if (i === 0 || j === 0 || i === winW - 1 || j === hh - 1) return "g";
      if (j === hh - 7) return "v";
      if (j > hh - 7) return i % 7 < 4 ? (["y", "t", "w", "q", "u"] as const)[Math.floor(i / 7) % 5]! : "i";
      return i === 2 && j === 2 ? "I" : i + j < 12 ? "j" : "i";
    }));
    L.push({ x: 5, y: wy + 1, w: winW - 2, h: F - 6 - wy, keys: "ijI", color: WARM, strength: 1 });
    doorAt(W - dw - 5, wy - 1, dw, F - 3 - wy + 1, P, L, false, true);
  } else {
    const dw = W < 30 ? 10 : 14;
    const dx = cols === 1 ? Math.round(W / 2 - dw / 2) : r() < 0.5 ? colX(0) : colX(cols - 1) + ww - dw;
    doorAt(dx, F - 3 - 28, dw, 28, P, L, r() < 0.5, r() < 0.4);
    for (let k = 0; k < cols; k++) {
      const x = colX(k);
      if (x < dx + dw + 3 && x + ww > dx - 3) continue;
      windowAt(x, gTop + 8, ww, 16, P, L, { cross: true });
    }
  }
  const front = character(key, W, H, pal, P);

  // The box: its sides (plain party walls, or at a corner a second front), its roof.
  const D = Math.round(spec.depth * (spec.px ?? SQ));
  const rows = Array.from({ length: floors - 1 }, (_, f) => ({ y: eave - GROUND - 3 - (f + 1) * FLOOR + Math.round((FLOOR - wh) / 2) + 1, h: wh }));
  const cornerSpec = { mat, rows: [...rows, { y: eave - GROUND + 8, h: 16 }], every: 30, trim: [eave - GROUND - 3] };
  const plain = { mat, rows: [], trim: [eave - GROUND - 3] };
  const left = sideArt(`${key}-L`, pal, spec.corner === "L" || spec.free ? cornerSpec : plain, D, eave, true);
  const right = sideArt(`${key}-R`, pal, spec.corner === "R" || spec.free ? cornerSpec : plain, D, eave, false);
  // Its back (seen from behind: from the gardens, the park, the street behind a deep block): windows, no door.
  const rear = sideArt(`${key}-B`, pal, { mat, rows, every: 30, trim: [eave - GROUND - 3] }, W, eave, false);
  let roof: Face[];
  if (spec.flat) roof = flatRoof(0, W, eave + (cap === "crenel" ? 4 : 1));
  else if (cap === "gable") roof = gableRoof(0, W, eave - 1, W / 2, eave + capH - 2, pick(r, ["shingle", "clay", "slate"] as const), 0, 1);
  else if (cap === "round") roof = vaultRoof(0, W, eave, eave + capH - 1, "slate", 5);
  else if (cap === "steps") roof = gableRoof(0, W, eave, W / 2, eave + capH - 2, "clay", 0, 1);
  else if (cap === "mansard") roof = [
    quadF([0, 0, eave], [6, 0.08, eave + capH], [6, 0.92, eave + capH], [0, 1, eave], "slate", "t"),
    quadF([6, 0.08, eave + capH], [W - 6, 0.08, eave + capH], [W - 6, 0.92, eave + capH], [6, 0.92, eave + capH], "tar", "u", true),
    quadF([W - 6, 0.08, eave + capH], [W, 0, eave], [W, 1, eave], [W - 6, 0.92, eave + capH], "slate", "t"),
  ];
  else roof = flatRoof(0, W, eave + (cap === "crenel" ? 4 : 1));
  const tb: TownBox = {
    id: key, front, lights: L, lot: { w: W / SQ, d: 3 }, inset: 0, depth: spec.depth, body: { x0: 0, x1: W }, left, right, roof, roofPal: pal, taper: 1, px: spec.px, rear,
  };
  const out = { box: tb, parts: { wall: wallI, mat, cap, floors, shop, eave } };
  cache.set(key, out);
  return out;
}
