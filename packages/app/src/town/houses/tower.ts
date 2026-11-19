/**
 * The Battle Tower (Nov 19): Chess Town's skyscraper, 99 floors, seen from the street. An Art Deco tower in HunChess's slate
 * and gold: the lobby floors across the full width (the glass front door under a blank sign board and a gold sunburst, tall
 * lit lobby windows, slate piers with gold capitals, two sconces, a chessboard frieze over it all), then the shaft set back
 * (piers and rows of windows, about one in six lit), set back once more higher up, its top dissolving into the sky through
 * an ordered dither with cloud wisps drifting across it. 144 x 592, foot [72, 586].
 * Idle: 6 frames (3.6 s): a few windows go dark and others light, a glint slides down the door's glass, the clouds drift.
 */
import type { Character, Frame, Layer, Part } from "../../characters/sprite.ts";
import { grain, groundShadow, paint, signBoard, signFace, WARM, type LightPool, type LightSpot } from "./kit.ts";

const PALETTE: Record<string, string> = {
  k: "#0e1014", // outline
  // Slate: deepest to lit.
  "1": "#16181d",
  "2": "#20232a",
  "3": "#2a2e37",
  "4": "#343946",
  "5": "#4a5163",
  "6": "#646d82",
  h: "#7d879c", // the palest, high up in the haze
  // Gold: dark, deep, gold, bright.
  d: "#8a5c08",
  g: "#c8860d",
  G: "#f4b740",
  Y: "#ffd877",
  // Cream (the sign's face): shade, cream, white.
  C: "#d9d2c2",
  c: "#f3f1ec",
  W: "#ffffff",
  // The chessboard's squares (the frieze, the lobby floor), and their shades.
  t: "#f0d9b5",
  b: "#b58863",
  T: "#c9ab84",
  B: "#8a6446",
  // Dark glass: deep, glass, glint.
  n: "#1f2735",
  a: "#2a3446",
  A: "#5a6a84",
  // Lit glass: deep warm, warm, bright.
  o: "#c97a2a",
  l: "#ffb85c",
  L: "#ffe2a0",
  // Pale stone (the steps, the sills): shade, stone, lit.
  s: "#8f8a80",
  S: "#bdb7aa",
  Z: "#dcd7cb",
  // Clouds: white, pale blue-white, its shade.
  w: "#ffffff",
  v: "#e4ecf6",
  V: "#c3d1e3",
  // Ground shadow (see-through).
  "-": "#0d0e1280",
  "+": "#0d0e1240",
};

const W = 144;
const H = 592;
const FOOT = 586;
/** The base (lobby floors): x range, top. */
const BX0 = 4;
const BX1 = 139;
const BASE_TOP = 496;
/** The shaft: x range; the setback's x range and the line it starts at; floor pitch. */
const SX0 = 12;
const SX1 = 131;
const UX0 = 24;
const UX1 = 119;
const SETBACK = 236;
const FLOOR = 10;
/** Over this line the tower dissolves into the sky (solid below). */
const DISSOLVE = 128;
/** The front door's middle (px). */
export const HOUSE_TOWER_DOOR = 72;
/** The sign board (signBoard box). */
const SIGN = { x: 38, y: 519, w: 68, h: 20 } as const;
/** The door: its gold frame's box; the glass inside. */
const DOOR = { x0: 54, x1: 89, y0: 541, y1: 581 } as const;
/** The lobby windows (glass boxes, inclusive). */
const LOBBY = [
  { x0: 14, x1: 31 },
  { x0: 112, x1: 129 },
] as const;
const LOBBY_Y0 = 512;
const LOBBY_Y1 = 575;
/** The sconces' middles. */
const SCONCES = [45, 98] as const;
const SCONCE_Y = 548;

type Cv = (string | null)[][];
const cv = (): Cv => Array.from({ length: H }, () => Array<string | null>(W).fill(null));
const put = (c: Cv, x: number, y: number, k: string | null) => {
  if (x >= 0 && y >= 0 && x < W && y < H) c[y]![x] = k;
};
const rect = (c: Cv, x0: number, y0: number, x1: number, y1: number, fn: string | ((x: number, y: number) => string | null)) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(c, x, y, typeof fn === "string" ? fn : fn(x, y));
};

/** The window columns (left x of each 8-wide window) in a span. */
const winCols = (x0: number, x1: number) => {
  const out: number[] = [];
  for (let k = 0; k < 9; k++) {
    const x = 20 + 12 * k;
    if (x > x0 && x + 7 < x1) out.push(x);
  }
  return out;
};
/** A floor's top line (r 0: the lowest floor of the shaft). */
const floorTop = (r: number) => BASE_TOP - FLOOR * (r + 1);
/** A window that lights and darkens through the idle: on for half the loop, from its own phase. */
const toggles = (x: number, r: number) => grain(x, r, 9) < 0.03 && floorTop(r) > DISSOLVE + 4;
const litAt = (x: number, r: number) => !toggles(x, r) && grain(x, r, 3) < 0.15 && floorTop(r) > DISSOLVE;
const toggleOn = (x: number, r: number, f: number) => (f + Math.floor(grain(x, r, 11) * 6)) % 6 < 3;

/** A window's glass, 8 x 7 (i, j from its top left): dark with a glint, or lit warm. */
const glass = (i: number, j: number, lit: boolean, seed: number) => {
  if (lit) return j === 0 ? "L" : i === 0 || j === 6 ? "o" : seed < 0.5 && j < 3 && i > 4 ? "L" : "l";
  if (i === 0 || j === 0) return "n";
  if (seed < 0.45 && i + j === 4 && i > 1 && i < 4) return "A";
  if (seed > 0.8 && i + j === 9 && i > 4) return "A";
  return "a";
};

/** The shaft from y0 to y1 between x0 and x1: piers, floors, windows. */
function shaft(c: Cv, x0: number, x1: number, y0: number, y1: number): void {
  const cols = winCols(x0, x1);
  for (let y = y0; y <= y1; y++) {
    const r = Math.floor((BASE_TOP - 1 - y) / FLOOR);
    const j = y - floorTop(r);
    for (let x = x0; x <= x1; x++) {
      // The edge piers: lit left, a gold line, shade right.
      const e = Math.min(x - x0, x1 - x);
      if (x - x0 < 8 || x1 - x < 8) {
        const left = x - x0 < 8;
        const i = left ? x - x0 : x - (x1 - 7);
        put(c, x, y, i === 0 ? "6" : i === 7 ? "3" : i === 3 ? (left ? "G" : "g") : i < 3 ? "5" : "4");
        continue;
      }
      const wx = cols.find((cx) => x >= cx && x < cx + 8);
      if (wx !== undefined && j >= 3) {
        put(c, x, y, glass(x - wx, j - 3, litAt(wx, r), grain(wx, r, 5)));
        continue;
      }
      if (wx !== undefined) {
        // The spandrel under the window above: recessed dark slate; the middle bay's in gold, a chevron each floor.
        put(c, x, y, j === 0 ? "3" : "2");
        continue;
      }
      // An inner pier, 4 wide: lit on its left; the two flanking the middle bay carry a gold line all the way up.
      const p = (x - 20) % 12 - 8;
      const gold = x === 65 || x === 78;
      put(c, x, y, gold ? (x < 72 ? "G" : "g") : p === 0 ? "6" : p === 1 ? "5" : p === 3 ? "3" : "4");
      void e;
    }
  }
}

/** The lobby floors: the frieze, the walls and piers, the windows, the sign and its sunburst, the door, the steps. */
function base(c: Cv): void {
  // The wall: slate in courses.
  rect(c, BX0, BASE_TOP, BX1, FOOT - 1, (x, y) => ((y - 508) % 7 === 6 ? "3" : "4"));
  // The cornice: gold over the frieze.
  rect(c, BX0 - 1, BASE_TOP, BX1 + 1, BASE_TOP, "G");
  rect(c, BX0 - 1, BASE_TOP + 1, BX1 + 1, BASE_TOP + 1, "g");
  // The chessboard frieze: two rows of 4-px squares, a gold line under it.
  rect(c, BX0, BASE_TOP + 2, BX1, BASE_TOP + 9, (x, y) => {
    const light = (Math.floor((x - BX0) / 4) + Math.floor((y - BASE_TOP - 2) / 4)) % 2 === 0;
    return light ? ((y - BASE_TOP - 2) % 4 === 3 ? "T" : "t") : (y - BASE_TOP - 2) % 4 === 3 ? "B" : "b";
  });
  rect(c, BX0, BASE_TOP + 10, BX1, BASE_TOP + 10, "g");
  rect(c, BX0, BASE_TOP + 11, BX1, BASE_TOP + 11, "1");
  // The piers: the corners and those flanking the door, with gold capitals.
  for (const [p0, p1] of [[BX0, BX0 + 7], [BX1 - 7, BX1], [34, 39], [104, 109]] as const) {
    rect(c, p0, BASE_TOP + 12, p1, FOOT - 1, (x) => (x === p0 ? "6" : x === p1 ? "3" : "5"));
    rect(c, p0, BASE_TOP + 12, p1, BASE_TOP + 12, "G");
    rect(c, p0, BASE_TOP + 13, p1, BASE_TOP + 13, "g");
    rect(c, p0 + 1, BASE_TOP + 14, p1 - 1, BASE_TOP + 14, "d");
  }
  // The lobby windows: a gold frame, mullions, lit warm inside.
  for (const { x0, x1 } of LOBBY) {
    rect(c, x0 - 1, LOBBY_Y0 - 1, x1 + 1, LOBBY_Y1 + 1, "g");
    const mid = (x0 + x1) >> 1;
    const tr = LOBBY_Y0 + 12;
    rect(c, x0, LOBBY_Y0, x1, LOBBY_Y1, (x, y) => {
      if (x === mid || x === mid + 1) return x === mid ? "G" : "g";
      if (y === tr || y === tr + 1) return y === tr ? "G" : "g";
      // The upper lights: a gold fan grille over warm glass.
      if (y < tr) {
        const px = x < mid ? (x0 + mid - 1) / 2 : (mid + 2 + x1) / 2;
        const a = Math.atan2(tr - y, x + 0.5 - px - 0.5);
        if (Math.hypot(x + 0.5 - px - 0.5, (tr - y) * 1.1) < 3.2) return "G";
        return Math.floor(a * 3.2) % 2 === 0 ? "L" : "l";
      }
      // The main lights: the lobby inside, its floor's checker at the foot, a glint across the left light.
      const j = y - tr - 2;
      const i = x < mid ? x - x0 : x - mid - 2;
      if (y > LOBBY_Y1 - 6) return (Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0 ? "T" : "B";
      if (y > LOBBY_Y1 - 8) return "o";
      if (i === 0) return "o";
      if (x < mid && (i + j === 9 || i + j === 10 || i + j === 15)) return "L";
      if (x > mid && i + j === 13) return "L";
      return j < 3 ? "L" : "l";
    });
    // Its sill.
    rect(c, x0 - 2, LOBBY_Y1 + 2, x1 + 2, LOBBY_Y1 + 2, "Z");
    rect(c, x0 - 2, LOBBY_Y1 + 3, x1 + 2, LOBBY_Y1 + 3, "s");
  }
  // The plinth: dark stone under it all.
  rect(c, BX0, FOOT - 7, BX1, FOOT - 1, (x, y) => (y === FOOT - 7 ? "5" : "2"));
  // The sunburst over the sign: a half sun, gold rays fanning out of it, outlined.
  const cx = 72;
  const cy = SIGN.y;
  const sun = (x: number, y: number) => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    const d = Math.hypot(dx, dy * 1.45);
    if (d < 5.2) return d > 4.2 ? "g" : dx < 0 && dy < -1.5 ? "Y" : "G";
    if (d < 14.5) {
      const a = Math.atan2(-dy, dx);
      const ray = Math.floor((a / Math.PI) * 11 + 0.5);
      if (ray % 2 === 0) return d < 6.3 ? null : dx < -1 ? "G" : "g";
    }
    return null;
  };
  for (let y = cy - 11; y < cy; y++)
    for (let x = cx - 16; x < cx + 16; x++) {
      const k = sun(x, y);
      if (k) put(c, x, y, k);
      else if ([[0, 1], [0, -1], [1, 0], [-1, 0]].some(([ox, oy]) => sun(x + ox!, y + oy!) && y + oy! < cy)) put(c, x, y, "1");
    }
  // The sign board: gold frame, a blank cream face (the game writes the name), a dark line round it.
  rect(c, SIGN.x - 1, SIGN.y - 1, SIGN.x + SIGN.w, SIGN.y + SIGN.h, "k");
  {
    const sb = signBoard(SIGN.x, SIGN.y, SIGN.w, SIGN.h, "dgGY", "CcW", "d");
    sb.part.grid.forEach((row, j) => [...row].forEach((k, i) => k !== "." && put(c, sb.at[0] + i, sb.at[1] + j, k)));
  }
  // The sconces either side of the door: a gold cap and foot round a tall frosted glass, on a bracket.
  for (const sx of SCONCES) {
    rect(c, sx - 3, SCONCE_Y - 1, sx + 3, SCONCE_Y + 11, "k");
    rect(c, sx - 2, SCONCE_Y, sx + 2, SCONCE_Y + 10, (x, y) => {
      const j = y - SCONCE_Y;
      if (j === 0) return x === sx - 2 ? "Y" : "G";
      if (j === 1) return "g";
      if (j === 10) return "d";
      if (j === 9) return x === sx - 2 ? "G" : "g";
      if (x === sx - 2) return "L";
      if (x === sx + 2) return "l";
      return j < 5 ? "W" : "L";
    });
    rect(c, sx - 1, SCONCE_Y + 11, sx + 1, SCONCE_Y + 12, (x, y) => (y === SCONCE_Y + 11 ? "g" : "d"));
    put(c, sx - 2, SCONCE_Y + 12, "k");
    put(c, sx + 2, SCONCE_Y + 12, "k");
    rect(c, sx - 1, SCONCE_Y + 13, sx + 1, SCONCE_Y + 13, "k");
  }
  // The door's surround: a deep portal (its reveals lit left, shaded right), gold reeds either side, a gold frame, the glass.
  rect(c, DOOR.x0 - 5, DOOR.y0 - 2, DOOR.x1 + 5, DOOR.y1, (x) =>
    x === DOOR.x0 - 5 || x === DOOR.x1 + 5 ? "k" : x === DOOR.x0 - 4 || x === DOOR.x1 + 4 ? (x < 72 ? "Y" : "g") : x === DOOR.x0 - 3 || x === DOOR.x1 + 3 ? "d" : x < 72 ? "3" : "1");
  rect(c, DOOR.x0 - 2, DOOR.y0 - 2, DOOR.x1 + 2, DOOR.y0 - 1, "1");
  rect(c, DOOR.x0, DOOR.y0, DOOR.x1, DOOR.y1, (x, y) => (x === DOOR.x0 || y === DOOR.y0 ? "G" : "g"));
  rect(c, DOOR.x0 + 2, DOOR.y0 + 2, DOOR.x1 - 2, DOOR.y1, (x, y) => doorGlass(x, y));
  // The steps of pale stone.
  rect(c, DOOR.x0 - 4, FOOT - 4, DOOR.x1 + 4, FOOT - 3, (x, y) => (y === FOOT - 4 ? "Z" : "S"));
  rect(c, DOOR.x0 - 8, FOOT - 2, DOOR.x1 + 8, FOOT - 1, (x, y) => (y === FOOT - 2 ? "Z" : "s"));
}

/** The door's glass: the transom and two leaves, warm light inside, the lobby's checkered floor through it. */
function doorGlass(x: number, y: number): string {
  const tr = DOOR.y0 + 8; // the transom bar
  if (y === tr || y === tr + 1) return y === tr ? "G" : "g";
  if (x === 71 || x === 72) return x === 71 ? "G" : "g";
  if (y < tr) return (x + y) % 4 === 0 ? "L" : "l";
  // The lobby floor, seen through the leaves: a checker, its squares smaller toward the back.
  const fy = DOOR.y1 - 9;
  if (y > fy) {
    const sz = y > fy + 4 ? 3 : 2;
    return (Math.floor((x - 56) / sz) + Math.floor((y - fy) / sz)) % 2 === 0 ? "t" : "b";
  }
  // Handles: long gold bars by the meeting stiles.
  if ((x === 68 || x === 75) && y > tr + 11 && y < tr + 21) return x === 68 ? "Y" : "G";
  if ((x === 68 || x === 75) && (y === tr + 11 || y === tr + 21)) return "d";
  // The clerk's counter at the back of the lobby: dark wood under a gold top.
  if (y >= fy - 5 && x > 59 && x < 84) return y === fy - 5 ? "G" : y === fy - 4 ? "g" : "B";
  // The lobby's back wall, warm; a glint down the glass (the idle's, drawn on top).
  if (x === 56 || x === 73) return "o";
  return y < tr + 5 ? "L" : "l";
}

/** The building's outline: a ring of `k` round everything drawn. */
function outline(c: Cv): void {
  const mask = c.map((row) => row.map((k) => k !== null));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (mask[y]![x]) continue;
      if (mask[y - 1]?.[x] || mask[y + 1]?.[x] || mask[y]![x - 1] || mask[y]![x + 1]) c[y]![x] = "k";
    }
}

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
/** The top melting into the sky: an ordered dither, fewer pixels kept going up. */
function dissolve(c: Cv): void {
  for (let y = 0; y < DISSOLVE; y++) {
    const d = Math.max(0, (y - 10) / (DISSOLVE - 10));
    for (let x = 0; x < W; x++) if ((BAYER[y % 4]![x % 4]! + 0.5) / 16 > d) c[y]![x] = null;
  }
}

/** Going up, the air pales the tower: a dither of pixels one step lighter, more of them higher. */
const PALER: Record<string, string> = { "1": "2", "2": "3", "3": "4", "4": "5", "5": "6", "6": "h", n: "a", a: "4", A: "h", k: "2", d: "g", g: "G", o: "l" };
function haze(c: Cv): void {
  const top = DISSOLVE + 70;
  for (let y = 0; y < top; y++) {
    const h = 0.85 * ((top - y) / top) ** 1.3;
    for (let x = 0; x < W; x++) {
      const k = c[y]![x];
      if (k && PALER[k] && (BAYER[(y + 2) % 4]![(x + 1) % 4]! + 0.5) / 16 < h) c[y]![x] = PALER[k]!;
    }
  }
}

function building(): Cv {
  const c = cv();
  shaft(c, SX0, SX1, SETBACK, BASE_TOP - 1);
  shaft(c, UX0, UX1, 0, SETBACK - 1);
  // The setback's ledge: a gold cap on the lower block, a shadow under it.
  rect(c, SX0, SETBACK, SX1, SETBACK + 3, (x, y) => ["G", "g", "d", "1"][y - SETBACK]!);
  base(c);
  outline(c);
  haze(c);
  dissolve(c);
  return c;
}

/** Each shaft window's left x and glass top, by floor (r 0: the lowest). */
function windows(): { x: number; y: number; r: number }[] {
  const out: { x: number; y: number; r: number }[] = [];
  for (let r = 0; floorTop(r) >= 0; r++) {
    const top = floorTop(r);
    for (const x of top >= SETBACK ? winCols(SX0, SX1) : winCols(UX0, UX1)) out.push({ x, y: top + 3, r });
  }
  return out;
}

/** A cloud wisp: puffs on a flat bottom, lit on top, pale blue-white below (no outline: it's soft). */
function cloud(w: number, h: number, puffs: readonly (readonly [number, number])[]): Part {
  return paint(0, 0, w, h, (x, y) => {
    const by = h - 1;
    let inside = false;
    let right = false;
    for (const [px, r] of puffs) {
      const dx = x + 0.5 - px;
      const dy = (y + 0.5 - (by - 0.5)) * 1.25;
      if (Math.hypot(dx, dy) < r) {
        inside = true;
        right = right || (dx > r * 0.35 && dy > -r * 0.6);
      }
    }
    if (!inside) return null;
    if (y === by) return "V";
    if (y >= by - 2 || right) return "v";
    return "w";
  }, false).part;
}

/** The whole front, worked out the first time it's painted (not as the town loads: 144 x 592 pixels). */
let bld: Cv | null = null;

const parts: Record<string, Part> = {};
const layers0: Layer[] = [];
{
  const sh = groundShadow(72, FOOT, 72, 4);
  parts.shadow = sh.part;
  layers0.push({ part: "shadow", x: sh.at[0], y: sh.at[1] });
  parts.tower = paint(0, 0, W, H, (x, y) => (bld ??= building())[y]![x]!, false).part;
  layers0.push({ part: "tower", x: 0, y: 0 });
}

// The idle's moving bits: windows lighting and going dark, the door's glint, the clouds.
parts.lit0 = paint(0, 0, 8, 7, (i, j) => glass(i, j, true, 0.2), false).part;
parts.lit1 = paint(0, 0, 8, 7, (i, j) => glass(i, j, true, 0.9), false).part;
parts.cloudA = cloud(66, 15, [[7, 5], [16, 9], [27, 13], [38, 11], [48, 8], [57, 6], [63, 3]]);
parts.cloudB = cloud(54, 12, [[6, 4], [14, 8], [25, 11], [35, 9], [44, 6], [50, 3]]);
parts.cloudC = cloud(34, 8, [[5, 4], [13, 7], [22, 6], [29, 4]]);
const GLINT_TOP = DOOR.y0 + 10;
for (let f = 0; f < 6; f++)
  parts[`glint${f}`] = paint(56, GLINT_TOP, 32, 16, (x, y) => {
    if (x > 70 && x < 73) return null;
    const s = (x < 72 ? x - 56 : x - 73) + (y - GLINT_TOP) - 4 - 4 * f;
    return s === 0 || s === 1 ? "W" : s === 2 ? "L" : null;
  }, false).part;
const TOGGLERS = windows().filter((w) => toggles(w.x, w.r));
const CLOUDS = [
  { part: "cloudA", x: 2, y: 44, drift: [0, 0, 1, 1, 1, 0] },
  { part: "cloudB", x: 86, y: 84, drift: [0, 0, 0, -1, -1, -1] },
  { part: "cloudC", x: 64, y: 14, drift: [0, 1, 1, 1, 0, 0] },
] as const;

const frames: Frame[] = [];
for (let f = 0; f < 6; f++) {
  const layers: Layer[] = [...layers0];
  for (const w of TOGGLERS) if (toggleOn(w.x, w.r, f)) layers.push({ part: grain(w.x, w.r, 5) < 0.5 ? "lit0" : "lit1", x: w.x, y: w.y });
  layers.push({ part: `glint${f}`, x: 56, y: GLINT_TOP });
  for (const cl of CLOUDS) layers.push({ part: cl.part, x: cl.x + cl.drift[f]!, y: cl.y });
  frames.push({ ms: 600, layers: layers });
}

export const HOUSE_TOWER: Character = {
  id: "house-tower",
  name: "Battle Tower",
  w: W,
  h: H,
  foot: [72, FOOT],
  palette: PALETTE,
  parts,
  anims: { idle: { loop: true, frames } },
};
/** The sign board's face, where the game writes "BATTLE TOWER". */
export const HOUSE_TOWER_SIGN = signFace(SIGN.x, SIGN.y, SIGN.w, SIGN.h);
/** Its lights at dusk and night: the two sconces (brightest, a halo each), the door's glass, the lobby windows, the shaft's lit windows. */
export const HOUSE_TOWER_LIGHTS: readonly LightSpot[] = [
  ...SCONCES.map((sx): LightSpot => ({ x: sx - 2, y: SCONCE_Y + 2, w: 5, h: 7, keys: "WLl", color: "#ffe2a0", strength: 0.9, halo: 9 })),
  { x: DOOR.x0 + 2, y: DOOR.y0 + 2, w: DOOR.x1 - DOOR.x0 - 3, h: DOOR.y1 - DOOR.y0 - 15, keys: "lL", color: "#ffd08a", strength: 0.8 },
  ...LOBBY.map(({ x0, x1 }): LightSpot => ({ x: x0, y: LOBBY_Y0, w: x1 - x0 + 1, h: LOBBY_Y1 - LOBBY_Y0 - 6, keys: "lLo", color: WARM, strength: 0.7 })),
  { x: SX0, y: DISSOLVE - 14, w: SX1 - SX0 + 1, h: BASE_TOP - DISSOLVE + 14, keys: "lLo", color: WARM, strength: 0.55 },
];
/** The pools of light on the sidewalk: the door's (with the sconces'), the lobby windows'. */
export const HOUSE_TOWER_POOLS: readonly LightPool[] = [
  { x: HOUSE_TOWER_DOOR, y: FOOT + 2, rx: 30, ry: 4, color: "#ffd08a", strength: 0.4 },
  ...LOBBY.map(({ x0, x1 }): LightPool => ({ x: (x0 + x1 + 1) / 2, y: FOOT + 2, rx: 14, ry: 3, color: WARM, strength: 0.3 })),
];
