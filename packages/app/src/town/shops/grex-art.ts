/**
 * Copied as drawn from `claude/boss-art` (scripts/boss-art/out/house-shop-grex/house-shop-grex.ts at 0e4f6482, Nov 4, 2026; Eric
 * approved the build Nov 4), its imports moved, its room still and review sheets (HOUSE_SHOP_GREX) left there. Built as Wrangler's
 * barn (shops/pig-art.ts) with a floor's shape as Hollow's cave (shops/hollow-art.ts). The notes: scripts/boss-art/out/shop-grex-nov4.md
 * on that branch. Its shared kit (colors, lettering, cartons, pallets, crates) is shops/warehouse-kit.ts, copied beside it.
 */
/**
 * Inside Jefferson's Fireworks: Jefferson's shop (house-shop-grex), a shady firework warehouse run by giraffes (Eric's
 * design, Nov 4). A room of 20 x 20 squares seen as the town square is seen (the camera looks north, things stand upright at
 * their foot, 37 px a square), with a floor mask (SHOP_GREX_FLOOR, as Hollow's cave): the walkable floor is 16 x 16 (columns
 * 2-17, rows 3-18), square, and everything round it is stock. Drawn by hand (Nov 4, weekly plan usage), built exactly as
 * Wrangler's barn is (out/house-shop-pig).
 *
 * Pallet racking like a warehouse club: tall steel shelves (blue uprights, orange beams) along the back and both sides,
 * loaded high with pallets of firework cartons with made-up names (some nod to the bosses: BOINGO ROCKETS, TIMBER TUMBLERS,
 * DASH DAZZLERS, WRANGLER ROUNDUP, HOLLOW NIGHT, BIG BOY BOOMERS, PUDDLES POPPERS, MOON SHOT, ROMAN CANDLES, SKY STRIPES...).
 * A grey concrete floor with painted yellow lines, a walkway from the roll-up door, high-bay lamps hanging from the roof. A bare
 * stretch of wall on the west with a NO SMOKING sign (the joke: the two shady leaners there hold sparklers like cigarettes).
 * In the middle, the battle spot: a hazard-striped safety zone with a firework star painted on it, his mark (a red plate with
 * a gold star) on the west and yours (the steel plate of a floor lift, hazard-edged) on the east, and the board already
 * standing there on a wobbly stack of wooden crates (giraffes like it high). The shop is "literally just a guy in the corner":
 * the shady dealer (sidekick-grex-dealer) in the north-east corner of the floor, by a steel column with a little white sign
 * taped to it that says SHOP in marker, and Jefferson's Boss Crate on the floor beside him (a firework crate, its fuse sparking).
 *
 * Footing: a piece's foot is the middle of its square (a wide piece's: the middle of its width, on the middle of its row).
 * Floor tiles are flat, top-down, 37 x 37, foot at their middle; the battle spot's tiles are each drawn where they lie.
 */
import type { Character, Frame, Part } from "../../characters/sprite.ts";
import { groundShadow, type LightPool, type LightSpot } from "../houses/kit.ts";
import { bits, burst, crate, cropBit, cv, DESIGNS, get, hash, load, openBox, put, rect, shopSign, textC, WAREHOUSE_PALETTE, whole, type Bit, type Cv, type Key, type Pt } from "./warehouse-kit.ts";

const PALETTE: Record<string, string> = { ...WAREHOUSE_PALETTE };

const T = 37;
interface Piece {
  name: string;
  /** Its footprint in squares (wide, deep) and its picture's size and foot in pixels. */
  sq: readonly [number, number];
  w: number;
  h: number;
  foot: Pt;
  frames: Bit[][];
  ms: number;
}
const PIECES: Record<string, Piece> = {};

function toChar(p: Piece): Character {
  const parts: Record<string, Part> = {};
  const frames: Frame[] = p.frames.map((bs, f) => ({
    ms: p.ms,
    layers: bs.map((b, i) => {
      const n = `f${f}p${i}`;
      parts[n] = b.part;
      return { part: n, x: b.at[0], y: b.at[1] };
    }),
  }));
  return { id: `shop-grex-${p.name}`, name: `Jefferson's warehouse: ${p.name}`, w: p.w, h: p.h, foot: p.foot, palette: PALETTE, parts, anims: { idle: { loop: true, frames } } };
}
function def(name: string, sq: readonly [number, number], w: number, h: number, foot: Pt, frames: Bit[][], ms = 1000): Character {
  PIECES[name] = { name, sq, w, h, foot, frames, ms };
  return toChar(PIECES[name]!);
}

// ==== The floor's shape: 20 rows of 20, `.` floor, `#` stock (racking, walls).

/** The walkable floor: columns 2-17, rows 3-18 (16 x 16), the way out at row 19, columns 9-10. Every `#` is stock or wall. */
export const SHOP_GREX_FLOOR: readonly string[] = Array.from({ length: 20 }, (_, r) =>
  Array.from({ length: 20 }, (_, c) => (r >= 3 && r <= 18 && c >= 2 && c <= 17) || (r === 19 && (c === 9 || c === 10)) ? "." : "#").join(""),
);
const isOpen = (c: number, r: number) => SHOP_GREX_FLOOR[r]?.[c] === ".";

// ==== The floor: grey concrete, a seam round each slab, aggregate specks, painted lines.

/** Concrete at room pixel (gx, gy): the base grey with specks, a darker seam on each tile's north and west edge. */
function concrete(gx: number, gy: number, seed = 1): string {
  const lx = ((gx % T) + T) % T;
  const ly = ((gy % T) + T) % T;
  if (lx === 0 || ly === 0) return "2";
  const s = hash(gx, gy, seed);
  if (s < 0.05) return "2";
  if (s > 0.965) return "5";
  if (s > 0.9) return "4";
  // Big soft patches (the slab's trowel marks), by tile.
  const patch = hash(Math.floor(gx / 9), Math.floor(gy / 7), seed + 3);
  return patch < 0.18 ? "4" : "3";
}
function tileDef(name: string, fn: (x: number, y: number) => Key): Character {
  const c = cv(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) c[y]![x] = fn(x, y) ?? ".";
  return def(name, [1, 1], T, T, [18, 18], [[whole(c)]]);
}
export const SHOP_GREX_FLOOR_A = tileDef("floor-a", (x, y) => concrete(x, y, 1));
export const SHOP_GREX_FLOOR_B = tileDef("floor-b", (x, y) => concrete(x, y, 2));
/** A hairline crack across the slab. */
export const SHOP_GREX_FLOOR_C = tileDef("floor-c", (x, y) => {
  const cy = 12 + Math.round(4 * Math.sin(x / 5) + (x > 20 ? (x - 20) / 3 : 0));
  return x > 3 && x < 33 && y === cy ? "2" : concrete(x, y, 3);
});
/** An oil stain (a forklift was parked here once). */
export const SHOP_GREX_FLOOR_D = tileDef("floor-d", (x, y) => {
  const d = Math.hypot((x - 19) / 11, (y - 21) / 7) + hash(x >> 1, y >> 1, 9) * 0.25;
  return d < 0.7 ? "6" : d < 0.95 && hash(x, y, 4) < 0.5 ? "6" : concrete(x, y, 4);
});
/** The stock's floor (under the racks): the same, scuffed. */
export const SHOP_GREX_FLOOR_STOCK = tileDef("floor-stock", (x, y) => (hash(x, y, 11) < 0.12 ? "2" : concrete(x, y, 5)));
/** A painted line along the tile (yellow, worn here and there): `n` 4 px in from the north edge, `w` / `e` from the west / east. */
const lineTile = (side: "n" | "w" | "e" | "s") => (x: number, y: number) => {
  const d = side === "n" ? y - 4 : side === "s" ? 32 - y : side === "w" ? x - 4 : 32 - x;
  if (d >= 0 && d < 3) return hash(x, y, 21) < 0.08 ? "y" : "Y";
  return concrete(x, y, 6);
};
export const SHOP_GREX_LINE_N = tileDef("floor-line-n", lineTile("n"));
export const SHOP_GREX_LINE_W = tileDef("floor-line-w", lineTile("w"));
export const SHOP_GREX_LINE_E = tileDef("floor-line-e", lineTile("e"));
/** A painted arrow (white, worn) pointing north: the forklift lane. */
export const SHOP_GREX_ARROW = tileDef("floor-arrow", (x, y) => {
  const head = y >= 8 && y < 18 && Math.abs(x - 18) <= y - 8;
  const shaft = y >= 18 && y < 31 && Math.abs(x - 18) <= 3;
  if ((head || shaft) && hash(x, y, 31) > 0.1) return "5";
  return concrete(x, y, 7);
});

// -- The battle spot: a hazard-striped safety zone, a firework star painted in the middle, the two marks.

const CX = 10 * T; // its middle, in the room's floor pixels (column 10's west edge, row 11's north edge)
const CY = 11 * T;
const ZX = 150; // the zone's half-width and half-depth, and its corners' radius
const ZY = 118;
const ZR = 44;
/** How far (gx, gy) is outside the zone's edge (negative inside). */
function zoneD(gx: number, gy: number): number {
  const qx = Math.abs(gx + 0.5 - CX) - (ZX - ZR);
  const qy = Math.abs(gy + 0.5 - CY) - (ZY - ZR);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - ZR;
}
const MARKS = { boss: [8, 10.5] as Pt, you: [11, 10.5] as Pt };
/** His mark (west) and yours (east), in squares: the table stands halfway between them. */
export const SHOP_GREX_MARKS = { boss: [8, 10.5], you: [11, 10.5] } as const;
const markPx = (m: Pt): Pt => [m[0] * T + 18.5, m[1] * T + 18.5];
/** The lift's plate (your mark): 30 px square, a hazard-striped rim, a steel plate with a tread and rivets. */
export const SHOP_GREX_PLATE = 30;
function plateKey(lx: number, ly: number): Key {
  const P = SHOP_GREX_PLATE;
  if (lx < 0 || ly < 0 || lx >= P || ly >= P) return null;
  const rim = lx < 3 || ly < 3 || lx >= P - 3 || ly >= P - 3;
  if (lx === 0 || ly === 0 || lx === P - 1 || ly === P - 1) return "m";
  if (rim) return Math.floor((lx + ly) / 3) % 2 ? "0" : "Y";
  if ((lx === 5 || lx === P - 6) && (ly === 5 || ly === P - 6)) return "I";
  // A diamond tread on the steel.
  return (lx + 2 * ly) % 6 === 0 || (lx - 2 * ly + 60) % 6 === 0 ? "I" : (lx + ly) % 2 ? "i" : "M";
}
/** His mark: a red plate, 26 px square, a dark rim, a gold star on it. */
function bossMarkKey(lx: number, ly: number): Key {
  const P = 26;
  if (lx < 0 || ly < 0 || lx >= P || ly >= P) return null;
  if (lx === 0 || ly === 0 || lx === P - 1 || ly === P - 1) return "R";
  const X = lx + 0.5 - P / 2;
  const Y = ly + 0.5 - P / 2;
  const a = Math.atan2(Y, X);
  const r = Math.hypot(X, Y);
  const R = 5 + 5.5 * Math.abs(Math.cos((5 * a) / 2 + Math.PI / 4)) ** 2;
  if (r < R * 0.98) return r < R * 0.45 ? "x" : X + Y < 0 ? "z" : "Z";
  return hash(lx, ly, 41) < 0.08 ? "R" : "r";
}
/** The painted firework star in the middle (where the crates stand): red rays and gold ones between, a white heart. */
function starKey(gx: number, gy: number): Key {
  const X = gx + 0.5 - CX;
  const Y = (gy + 0.5 - CY) * 1.15;
  const r = Math.hypot(X, Y);
  if (r > 48) return null;
  const a = Math.atan2(Y, X);
  const rays = 22 + 24 * Math.abs(Math.cos(4 * a)) ** 6;
  const gold = 16 + 18 * Math.abs(Math.cos(4 * a + Math.PI / 4)) ** 6;
  if (hash(gx, gy, 43) < 0.07) return null; // worn
  if (r < 6) return "x";
  if (r < gold) return "z";
  if (r < rays) return "r";
  return null;
}
function zoneKey(gx: number, gy: number): Key {
  const d = zoneD(gx, gy);
  if (d > 0) return null;
  for (const [m, fn, half] of [[MARKS.boss, bossMarkKey, 13], [MARKS.you, plateKey, 15]] as const) {
    const [mx, my] = markPx(m);
    const k = fn(Math.floor(gx - (mx - half)), Math.floor(gy - (my - half)));
    if (k) return k;
  }
  if (d > -2) return "0";
  if (d > -8) return Math.floor((gx + gy) / 6) % 2 ? "0" : hash(gx, gy, 45) < 0.06 ? "y" : "Y";
  if (d > -9) return "0";
  return starKey(gx, gy) ?? concrete(gx, gy, 8);
}
/** The battle spot's tiles: each square the zone touches, drawn where it lies (`circle-<col>-<row>`). */
const CIRCLE = new Set<string>();
for (let row = 0; row < 20; row++)
  for (let col = 0; col < 20; col++) {
    let any = false;
    for (let y = 0; y < T && !any; y += 3) for (let x = 0; x < T && !any; x += 3) any = zoneD(col * T + x, row * T + y) <= 0;
    if (!any) continue;
    CIRCLE.add(`${col},${row}`);
    tileDef(`circle-${col}-${row}`, (x, y) => zoneKey(col * T + x, row * T + y) ?? concrete(col * T + x, row * T + y, 1));
  }

// ==== Walls: corrugated steel (blue-grey), a dark girt, high windows onto the night (a firework far off).

const WALL_H = 150;
/** Corrugated steel at (x, y): vertical ribs every 4 px (a lit edge, a shaded trough), a girt across at `girt`. */
function corrugated(x: number, y: number, seed: number, girt = 96): string {
  if (y >= girt && y < girt + 4) return y === girt ? "i" : y === girt + 3 ? "m" : "M";
  const rib = ((x % 4) + 4) % 4;
  const k = rib === 0 ? "i" : rib === 3 ? "m" : "M";
  if (hash(x, y >> 3, seed) < 0.02) return "m"; // a dent
  return k;
}
const WIN = { y0: 12, y1: 40 } as const;
/** The night through a high window (x across the window): deep blue, a low glow, stars, and far off a firework bursting. */
function night(x: number, y: number, seed: number, wx: number): string {
  if (y > WIN.y1 - 6) return "%";
  const bx = 10 + (seed % 3) * 4;
  const by = 22;
  const d = Math.hypot(x - bx, y - by);
  if (seed % 2 === 0 && d < 7 && Math.abs(d - 5) < 0.8 && hash(x, y, seed) < 0.7) return ["z", "h", "t"][seed % 3]!;
  if (seed % 2 === 0 && d < 1.2) return "*";
  if (hash(x + wx, y, 51) < 0.035) return "*";
  return y > WIN.y1 - 12 ? "=" : "N";
}
function wallDef(name: string, seed: number, win: boolean, more?: (c: Cv) => void): Character {
  const c = cv(T, WALL_H);
  for (let y = 0; y < WALL_H; y++)
    for (let x = 0; x < T; x++) {
      let k = corrugated(x, y, seed);
      if (y < 4) k = y === 0 ? "I" : y === 3 ? "m" : "i"; // the eave's steel
      if (win && y >= WIN.y0 && y <= WIN.y1 && x >= 4 && x <= 32) {
        const frame = y === WIN.y0 || y === WIN.y1 || x === 4 || x === 32 || x === 18;
        k = frame ? (y === WIN.y1 ? "I" : "m") : night(x, y, seed, seed * 40);
      }
      c[y]![x] = k;
    }
  // A kick plate at the foot (dark, scuffed).
  for (let y = WALL_H - 8; y < WALL_H; y++) for (let x = 0; x < T; x++) c[y]![x] = y === WALL_H - 8 ? "i" : hash(x, y, seed) < 0.15 ? "M" : "m";
  more?.(c);
  return def(name, [1, 1], T, WALL_H, [18, WALL_H - 1], [[whole(c, true)]]);
}
export const SHOP_GREX_WALL = wallDef("wall", 1, false);
export const SHOP_GREX_WALL_WIN = wallDef("wall-win", 2, true);
export const SHOP_GREX_WALL_WIN_B = wallDef("wall-win-b", 4, true);
/** A steel column (an I-beam, its flange lit), safety-striped at the foot. */
function column(c: Cv, x0: number, top: number, foot: number) {
  for (let y = top; y < foot; y++)
    for (let x = x0; x < x0 + 8; x++) {
      const i = x - x0;
      let k = i === 0 ? "I" : i === 7 ? "m" : i === 1 || i === 6 ? "i" : "M";
      if (foot - y <= 14) k = Math.floor((y + i) / 3) % 2 ? "0" : "Y";
      put(c, x, y, k);
    }
}
export const SHOP_GREX_WALL_POST = wallDef("wall-post", 3, false, (c) => column(c, 14, 0, WALL_H));
/** The side walls (columns 0 and 19, and the bare stretch on the west, column 1): the same steel, 130 tall. */
const SIDE_H = 130;
function sideDef(name: string, seed: number, more?: (c: Cv) => void): Character {
  const c = cv(T, SIDE_H);
  for (let y = 0; y < SIDE_H; y++) for (let x = 0; x < T; x++) c[y]![x] = y < 3 ? (y === 0 ? "I" : "i") : y >= SIDE_H - 8 ? (y === SIDE_H - 8 ? "i" : "m") : corrugated(x, y, seed, 82);
  more?.(c);
  return def(name, [1, 1], T, SIDE_H, [18, SIDE_H - 1], [[whole(c, true)]]);
}
export const SHOP_GREX_WALL_SIDE = sideDef("wall-side", 5);
/**
 * The NO SMOKING sign (a joke, generic; the leaners under it hold sparklers like cigarettes): a white board high on the wall,
 * in the card's top 37 px (the cards in front hide the rest), a red ring and bar over a little cigarette, "NO SMOKING" under it.
 */
export const SHOP_GREX_WALL_SIDE_SIGN = sideDef("wall-side-sign", 6, (c) => {
  const x0 = 2;
  const y0 = 3;
  rect(c, x0, y0, 33, 31, (x, y) => (x === 0 || y === 0 || x === 32 || y === 30 ? "m" : "~"));
  const cx = x0 + 16.5;
  const cy = y0 + 8;
  for (let y = y0 + 1; y < y0 + 16; y++)
    for (let x = x0 + 8; x < x0 + 26; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (Math.abs(x + 0.5 - cx + (y + 0.5 - cy)) < 1.3 && d < 6) put(c, x, y, "r");
      else if (d >= 5.2 && d < 6.9) put(c, x, y, "r");
    }
  // The cigarette under the bar: white with a lit orange end.
  for (let x = x0 + 13; x < x0 + 21; x++) if (get(c, x, Math.round(cy)) !== "r") put(c, x, Math.round(cy), x < x0 + 15 ? "f" : "`");
  textC(c, cx, y0 + 17, "NO", "0");
  textC(c, cx, y0 + 24, "SMOKING", "0");
});
export const SHOP_GREX_WALL_SIDE_POST = sideDef("wall-side-post", 7, (c) => column(c, 14, 0, SIDE_H));
/** The low front wall (row 19): concrete block with a yellow line along its top. */
const HEM_H = 24;
export const SHOP_GREX_HEM = (() => {
  const c = cv(T, HEM_H);
  for (let y = 0; y < HEM_H; y++)
    for (let x = 0; x < T; x++) {
      const course = Math.floor((y - 3) / 7);
      const off = course % 2 ? 9 : 0;
      const joint = y >= 3 && ((y - 3) % 7 === 6 || (x + off) % 18 === 17);
      c[y]![x] = y < 3 ? (y === 0 ? "Y" : "y") : joint ? "2" : hash(x, y, 61) < 0.1 ? "3" : "4";
    }
  return def("hem", [1, 1], T, HEM_H, [18, HEM_H - 1], [[whole(c, true)]]);
})();
export const SHOP_GREX_HEM_POST = (() => {
  const c = cv(T, 60);
  column(c, 14, 0, 60);
  for (let y = 36; y < 60; y++) for (let x = 0; x < T; x++) if (x < 14 || x >= 22) c[y]![x] = y === 36 ? "Y" : "4";
  return def("hem-post", [1, 1], T, 60, [18, 59], [[cropBit(c)!]]);
})();
/** The way out (2 x 1, columns 9-10): a roll-up door, its slats rolled up overhead, the night lot outside, a firework far off. */
const EW = 2 * T;
const EH = 112;
const E_TOP = 30;
export const SHOP_GREX_ENTRANCE = (() => {
  const c = cv(EW, EH);
  for (let y = 0; y < EH; y++)
    for (let x = 0; x < EW; x++) {
      let k: Key = null;
      const inOpen = x >= 6 && x < EW - 6 && y >= E_TOP;
      if (x < 6 || x >= EW - 6) k = x === 0 || x === EW - 1 ? "m" : x === 5 || x === EW - 6 ? "m" : Math.floor((y + x) / 4) % 2 && EH - y < 20 ? "0" : EH - y < 20 ? "Y" : "M";
      else if (y < E_TOP) k = y < 8 ? (y % 3 === 0 ? "m" : "i") : y >= E_TOP - 3 ? "m" : (y - 8) % 4 === 0 ? "m" : (y - 8) % 4 === 1 ? "I" : "i"; // the rolled-up slats and the drum
      else if (inOpen) {
        const vy = y - E_TOP;
        const vx = x - 6;
        k = vy > 58 ? (hash(x, y, 71) < 0.08 ? "2" : "1") : vy > 52 ? "%" : night(vx, vy - 6, 6, 300);
        // A big burst far off, over the lot.
        const d = Math.hypot(vx - 38, vy - 22);
        if (vy <= 52 && Math.abs(d - 9) < 0.9 && hash(x, y, 73) < 0.75) k = Math.atan2(vy - 22, vx - 38) > 0 ? "h" : "z";
        if (vy <= 52 && d < 1.3) k = "*";
      }
      if (k) c[y]![x] = k;
    }
  // A strip of "EXIT" over the door.
  rect(c, 22, 12, 30, 9, (x, y) => (x === 0 || y === 0 || x === 29 || y === 8 ? "G" : "g"));
  textC(c, 37, 14, "EXIT", "x");
  return def("entrance", [2, 1], EW, EH, [EW / 2, EH - 1], [[whole(c, true)]]);
})();

// ==== The racking: blue uprights, orange beams, three levels over the floor's, pallets of cartons on each.

const RACK_H = 176;
const RACK_F = RACK_H - 3; // its foot (the front face's foot)
/** Each level's beam top over the floor (the floor's own level is 0: loads stand on the floor). */
const LEVELS = [0, 46, 92, 138] as const;
export const SHOP_GREX_RACK_LEVELS = LEVELS;
type Row = readonly [string, number] | readonly [string, number, string, number];
type Bay = readonly Row[] | null;
/** An upright: a blue post 5 wide with a column of slots, a lit edge, a foot plate. */
function upright(c: Cv, x0: number, top: number, foot: number) {
  for (let y = top; y <= foot; y++)
    for (let x = x0; x < x0 + 5; x++) {
      const i = x - x0;
      let k = i === 0 ? "n" : i === 4 ? "b" : "B";
      if (i === 2 && (y - top) % 5 === 2) k = "b";
      if (y >= foot - 1) k = "m";
      put(c, x, y, k);
    }
}
/** A beam across at `y` (its top), from x0 to x1: orange, 4 tall, a lit top, dark under, a safety pin at each end. */
function beam(c: Cv, x0: number, x1: number, y: number) {
  for (let x = x0; x <= x1; x++) for (let j = 0; j < 4; j++) put(c, x, y + j, j === 0 ? "P" : j === 3 ? "o" : "O");
  put(c, x0 + 1, y + 1, "I");
  put(c, x1 - 1, y + 1, "I");
}
/**
 * A rack `w` wide (its uprights at either end), its bays' loads from the floor up (each bay: one pallet the rack's width, or
 * null: empty). The back is dark between levels.
 */
function rack(w: number, bays: readonly (readonly Bay[])[], seed: number): Cv {
  const c = cv(w, RACK_H);
  // The dark inside (the rack's depth, the back wall far behind), lighter low down where the lamps reach.
  for (let y = 2; y < RACK_F; y++) for (let x = 3; x < w - 3; x++) c[y]![x] = y > RACK_F - 30 ? "8" : "9";
  bays.forEach((level, li) => {
    const base = RACK_F - LEVELS[li]!; // the pallet's foot: the beam's top (or the floor)
    const n = level.length;
    const bw = Math.floor((w - 10) / n);
    level.forEach((bay, bi) => {
      if (!bay) return;
      const fx = 5 + bi * bw + Math.floor(bw / 2);
      load(c, fx, base, bw - 2, bay, seed * 13 + li * 5 + bi);
    });
  });
  for (const lv of LEVELS.slice(1)) beam(c, 2, w - 3, RACK_F - lv);
  // A top beam, and the uprights.
  beam(c, 2, w - 3, 2);
  upright(c, 0, 0, RACK_F);
  upright(c, w - 5, 0, RACK_F);
  return c;
}
function rackDef(name: string, w: number, bays: readonly (readonly Bay[])[], seed: number, more?: (c: Cv) => void): Character {
  const c = rack(w, bays, seed);
  more?.(c);
  return def(name, [Math.round(w / T), 1], w, RACK_H, [Math.floor(w / 2), RACK_F], [[whole(c, true)]]);
}
const RW2 = 2 * T;
// Each level of a 2-square rack holds two pallets; a bay is a list of carton rows from the pallet up.
export const SHOP_GREX_RACK_A = rackDef("rack-a", RW2, [
  [[["boingo", 16], ["boingo", 14]], [["roman", 30]]],
  [[["timber", 18], ["timber", 14]], [["moon", 16], ["moon", 14]]],
  [[["stripes", 30]], [["dash", 16], ["dash", 13]]],
  [[["fizz", 14, "stars", 10]], [["neck", 18]]],
], 1);
export const SHOP_GREX_RACK_B = rackDef("rack-b", RW2, [
  [[["wrangler", 30]], [["puddles", 16], ["puddles", 14]]],
  [[["hollow", 16], ["hollow", 15]], [["bigboy", 30]]],
  [[["roman", 15], ["moon", 15]], [["tall", 30]]],
  [[["boingo", 22]], [["timber", 12, "fizz", 14]]],
], 2);
export const SHOP_GREX_RACK_C = rackDef("rack-c", RW2, [
  [[["bigboy", 16], ["bigboy", 14]], [["stars", 30]]],
  [[["moon", 30]], [["wrangler", 16], ["roman", 14]]],
  [[["dash", 16], ["puddles", 14]], [["hollow", 30]]],
  [[["stripes", 16]], [["boingo", 14, "neck", 12]]],
], 3);
// (rack-d: rack-a's loads, the levels' pallets swapped round: a copy with a difference, as Eric said is fine.)
export const SHOP_GREX_RACK_D = rackDef("rack-d", RW2, [
  [[["roman", 30]], [["boingo", 16], ["boingo", 14]]],
  [[["moon", 16], ["moon", 14]], [["timber", 18], ["timber", 14]]],
  [[["dash", 16], ["dash", 13]], [["stripes", 30]]],
  [[["neck", 18]], [["fizz", 14, "stars", 10]]],
], 4);
/** The side racks (columns 1 and 18), seen end on: one pallet a level, a row each. `rack-side-slot`: the forklift's shelf (level 1 empty). */
const sideRack = (name: string, bays: readonly (readonly Bay[])[], seed: number) => rackDef(name, T, bays, seed);
export const SHOP_GREX_RACK_SIDE = sideRack("rack-side", [[[["roman", 28]]], [[["moon", 16], ["moon", 12]]], [[["boingo", 28]]], [[["stars", 16]]]], 5);
export const SHOP_GREX_RACK_SIDE_B = sideRack("rack-side-b", [[[["timber", 15], ["fizz", 14]]], [[["bigboy", 28]]], [[["dash", 15], ["dash", 13]]], [[["hollow", 22]]]], 6);
export const SHOP_GREX_RACK_SIDE_C = sideRack("rack-side-c", [[[["puddles", 28]]], [[["stripes", 15], ["neck", 14]]], [[["wrangler", 28]]], [[["tall", 14]]]], 7);
export const SHOP_GREX_RACK_SIDE_SLOT = sideRack("rack-side-slot", [[[["moon", 15], ["moon", 14]]], [null], [[["roman", 28]]], [[["boingo", 18]]]], 8);
/** The forklift's shelf slot: the east side rack at (18, 17), level 1 (its beam's top 46 px over the floor). */
export const SHOP_GREX_SHELF_SLOT = { col: 18, row: 17, level: 1, lift: LEVELS[1] } as const;

/**
 * The dealer's corner (2 x 1, columns 16-17 of row 2, at the floor's north-east corner): no racking, a bare stretch of the
 * steel wall, a steel column at its west with the little SHOP sign taped to it, a broom leaning on the wall.
 */
export const SHOP_GREX_CORNER = (() => {
  const w = 2 * T;
  const c = cv(w, RACK_H);
  for (let y = 0; y < RACK_F; y++) for (let x = 0; x < w; x++) c[y]![x] = y < RACK_F - 8 ? corrugated(x, y, 9, 60) : y === RACK_F - 8 ? "i" : "m";
  column(c, 6, 0, RACK_F + 1);
  // The sign, taped to the column at a giraffe's eye height.
  shopSign(c, 3, RACK_F - 76);
  // A push broom leaning against the wall on the right.
  for (let j = 0; j < 58; j++) put(c, 58 - Math.round(j * 0.18), RACK_F - 10 - j, j % 5 === 0 ? "w" : "u");
  rect(c, 51, RACK_F - 10, 16, 4, (x, y) => (y === 0 ? "u" : y === 3 ? "0" : x % 2 ? "0" : "M"));
  return def("corner-shop", [2, 1], w, RACK_H, [w / 2, RACK_F], [[whole(c, true)]]);
})();
/** Where the sign is in `corner-shop`'s pixels (its top-left, 29 x 15): for the code's close camera. */
export const SHOP_GREX_SIGN_AT = { x: 3, y: RACK_F - 76, w: 29, h: 15 } as const;

// ==== Stock on the floor.

/** A pallet of cartons standing on the floor (1 x 1). */
function stackDef(name: string, rows: readonly Row[], seed: number): Character {
  const h = 6 + rows.reduce((s, r) => s + r[1], 0) + 6;
  const c = cv(T, h);
  const sh = groundShadow(18, h - 4, 17, 3);
  load(c, 18, h - 3, 34, rows, seed);
  return def(name, [1, 1], T, h, [18, h - 3], [bits(sh, whole(c, true))]);
}
export const SHOP_GREX_STACK = stackDef("pallet-stack", [["roman", 15], ["roman", 14], ["moon", 12]], 21);
export const SHOP_GREX_STACK_B = stackDef("pallet-stack-b", [["boingo", 16], ["stripes", 14, "fizz", 11]], 22);
/** The dozer's pallet: a low pallet with a flattened carton on it for a seat (crew-d sits here: its seat is 9 px up). */
export const SHOP_GREX_PALLET_SEAT_H = 9;
export const SHOP_GREX_PALLET_SEAT = (() => {
  const c = cv(T, 16);
  const sh = groundShadow(18, 12, 17, 3);
  load(c, 18, 13, 34, [["tall", 3]], 23);
  // A spare carton beside it, on its side, and a coffee flask.
  return def("pallet-seat", [1, 1], T, 16, [18, 13], [bits(sh, whole(c, true))]);
})();
/** Open cartons of loose fireworks: rockets on sticks and fat candles sticking out. */
function openDef(name: string, design: string, seed: number): Character {
  const c = cv(T, 34);
  const sh = groundShadow(18, 30, 16, 3);
  openBox(c, 18, 31, 26, 16, DESIGNS[design]!, seed);
  return def(name, [1, 1], T, 34, [18, 31], [bits(sh, cropBit(c))]);
}
export const SHOP_GREX_BOX_OPEN = openDef("box-open", "boingo", 31);
export const SHOP_GREX_BOX_OPEN_B = openDef("box-open-b", "fizz", 32);
/** A safety cone. */
export const SHOP_GREX_CONE = (() => {
  const c = cv(T, 30);
  const sh = groundShadow(18, 26, 10, 2);
  for (let y = 4; y < 25; y++) {
    const half = 1 + (y - 4) * 0.28;
    for (let x = Math.round(18 - half); x <= Math.round(18 + half); x++) put(c, x, y, y >= 11 && y < 15 ? "x" : x < 18 ? "f" : "F");
  }
  rect(c, 9, 25, 19, 3, (_, y) => (y === 0 ? "f" : "F"));
  return def("cone", [1, 1], T, 30, [18, 27], [bits(sh, cropBit(c))]);
})();

/** The board on its stand, as it always stands in the battle spot: the crate stack (house-intro-grex: INTRO_GREX_TABLE's), its plank slab and the chessboard. */
export const SHOP_GREX_TABLE_TOP = 59; // the slab's top over the foot, px (TABLE_BOARD.top is 27: this one is 32 higher)
/**
 * The stack: five crates, the biggest at the foot, each a little askew, the top one carrying the slab. `sway`: the top three
 * crates shifted that many px (the wobble). Drawn on a 111-wide canvas (the tables' geometry), the foot at [55, h - 6].
 */
export function crateStack(c: Cv, fx: number, fy: number, sway = 0): void {
  const S: { w: number; h: number; dx: number; seed: number; mark: "star" | "arrow" | "none"; lid: number }[] = [
    { w: 40, h: 14, dx: 0, seed: 1, mark: "arrow", lid: 0 },
    { w: 34, h: 12, dx: 2, seed: 2, mark: "star", lid: 0 },
    { w: 36, h: 11, dx: -2, seed: 3, mark: "none", lid: 0 },
    { w: 30, h: 10, dx: 1, seed: 4, mark: "star", lid: 0 },
    { w: 34, h: 6, dx: -1, seed: 5, mark: "none", lid: 3 },
  ];
  let y = fy;
  S.forEach((s, i) => {
    const sw = i >= 2 ? Math.round(sway * (i - 1) * 0.5) : 0;
    y -= s.h + s.lid;
    crate(c, fx - Math.floor(s.w / 2) + s.dx + sw, y, s.w, s.h, s.seed, s.lid, s.mark);
    // A shadow under each crate's overhang on the one below.
    for (let x = fx - Math.floor(s.w / 2) + s.dx + sw; x < fx + Math.ceil(s.w / 2) + s.dx + sw; x++) if (get(c, x, y + s.h + s.lid) !== ".") put(c, x, y + s.h + s.lid, "V");
  });
  // (The stack is 56 px tall: its top is the slab's foot, SHOP_GREX_TABLE_TOP - 3 over the foot.)
}
const TW = 3 * T;
const TH = 76;
const TF = TH - 6;
export const SHOP_GREX_BOARD_STAND = (() => {
  const c = cv(TW, TH);
  const sh = groundShadow(55, TF + 1, 24, 4);
  crateStack(c, 55, TF);
  // The slab (plank board, 3 thick) and the board on it, seen a little from above, as the town's tables.
  const top = TF - SHOP_GREX_TABLE_TOP;
  rect(c, 55 - 15, top, 30, 3, (x, y) => (y === 0 ? "v" : y === 2 ? "w" : x % 9 === 0 ? "w" : "u"));
  rect(c, 55 - 15, top - 8, 30, 8, (x, y) => (y === 0 ? "v" : x === 0 || x === 29 ? "U" : null));
  for (let j = 0; j < 7; j++) for (let i = 0; i < 24; i++) put(c, 55 - 12 + i, top - 7 + j, (Math.floor(i / 3) + j) % 2 ? "C" : "A");
  return def("board-stand", [2, 1], TW, TH, [55, TF], [bits(sh, whole(c, true))]);
})();
/** The board stand's square: the battle spot's middle. Its picture's foot is 19 px south of row 10's middle (on the marks' line, y = 11 x 37). */
export const SHOP_GREX_BOARD_AT = { col: 9, row: 10, footDy: 19 } as const;

/**
 * Jefferson's Boss Crate: a stout wooden firework crate, a red band with a gold star stencilled on its front, its lid nailed
 * down, a fat fuse coming out of the top and curling over (idle: the fuse's tip sparks, 6 frames x 110 ms, spitting specks).
 */
const XW = 36;
const XH = 46;
export const SHOP_GREX_CRATE = (() => {
  const base = cv(XW, XH);
  const sh = groundShadow(18, XH - 4, 17, 3);
  crate(base, 2, XH - 28, 32, 22, 7, 3, "none");
  // The red band and the star.
  rect(base, 4, XH - 18, 28, 8, (x, y) => (y === 0 ? "r" : y === 7 ? "R" : x % 9 === 0 ? "R" : "r"));
  burst(base, 18, XH - 14, "zz", false);
  put(base, 18, XH - 14, "z");
  // The fuse: green waxed cord out of the lid, curling up and over to the right.
  const fuse: Pt[] = [[17, XH - 25], [16, XH - 27], [16, XH - 29], [17, XH - 31], [19, XH - 32], [21, XH - 32], [23, XH - 31], [24, XH - 30]];
  fuse.forEach(([x, y], i) => put(base, x, y, i % 2 ? "G" : "g"));
  const tip: Pt = [25, XH - 30];
  const frames: Bit[][] = Array.from({ length: 6 }, (_, f) => {
    const s = cv(XW, XH);
    // Sparks: a hot core and specks thrown out round it, a new spray each frame.
    put(s, tip[0], tip[1], "*");
    for (let n = 0; n < 7; n++) {
      const a = hash(n, f, 81) * Math.PI * 2;
      const r = 1.5 + hash(n, f, 82) * 4.5;
      const x = tip[0] + Math.cos(a) * r;
      const y = tip[1] + Math.sin(a) * r - 1;
      put(s, x, y, r < 2.5 ? "E" : r < 4.5 ? "f" : "F");
    }
    put(s, tip[0] + 1, tip[1], f % 2 ? "E" : "f");
    put(s, tip[0], tip[1] - 1, f % 3 ? "f" : "E");
    return bits(sh, whole(base, true), cropBit(s, false));
  });
  return def("crate", [1, 1], XW, XH, [18, XH - 4], frames, 110);
})();
/** The crate's square on the floor (beside the dealer, west of him): no counter, it stands where it is. */
export const SHOP_GREX_CRATE_AT = { col: 15, row: 3 } as const;
/** The fuse's tip in the crate's pixels (its sparks, for a light). */
export const SHOP_GREX_FUSE_TIP: Pt = [25, XH - 30];
/** None needed: the shop has no counter (a guy in a corner; his sign is drawn on `corner-shop`, see SHOP_GREX_SIGN_AT). */
export const SHOP_GREX_COUNTER_SIGN = null;

/** A high-bay lamp hanging from the roof: its cord out of the top, a steel dome shade, the bulb glowing under it (not solid). */
const LP_H = 150;
const SHADE_Y = 46; // the shade's rim, this far down its picture (about 104 px over the floor)
export const SHOP_GREX_LAMP = (() => {
  const c = cv(T, LP_H);
  for (let y = 0; y < SHADE_Y - 10; y++) put(c, 18, y, y % 4 === 0 ? "i" : "m");
  for (let y = SHADE_Y - 10; y <= SHADE_Y; y++) {
    const half = 2 + (y - (SHADE_Y - 10)) * 1.15;
    for (let x = Math.round(18 - half); x <= Math.round(18 + half); x++) put(c, x, y, y === SHADE_Y ? "m" : x < 15 ? "I" : x < 20 ? "i" : "M");
  }
  rect(c, 12, SHADE_Y + 1, 13, 3, (x, y) => (y === 2 ? (x > 2 && x < 10 ? "&" : null) : x > 1 && x < 11 ? "L" : null));
  return def("lamp", [1, 1], T, LP_H, [18, LP_H - 1], [[cropBit(c, true)!]]);
})();

// ==== The lights, each on its piece (`piece`; x, y in its own pixels).

const LAMP = "#fff1c9";
const NIGHT = "#8aa2ff";
/** The high-bay lamps (steady: no flicker), the windows' and the doorway's night, the Boss Crate's fuse. */
export const SHOP_GREX_LIGHTS: readonly (LightSpot & { piece: string })[] = [
  { piece: "lamp", x: 12, y: SHADE_Y + 1, w: 13, h: 3, keys: "L&", color: LAMP, strength: 1, halo: 30 },
  ...["wall-win", "wall-win-b"].map((piece) => ({ piece, x: 4, y: WIN.y0, w: 29, h: WIN.y1 - WIN.y0 + 1, keys: "N=%*zht", color: NIGHT, strength: 0.4, halo: 12 })),
  { piece: "entrance", x: 6, y: E_TOP, w: EW - 12, h: EH - E_TOP - 4, keys: "N=%*zh12", color: NIGHT, strength: 0.4 },
  { piece: "crate", x: SHOP_GREX_FUSE_TIP[0] - 5, y: SHOP_GREX_FUSE_TIP[1] - 5, w: 11, h: 11, keys: "*Ef", color: "#ffb648", strength: 0.6, flicker: true, halo: 10 },
];
/** ... and pools on the floor: under each lamp, before the doorway. */
export const SHOP_GREX_POOLS: readonly (LightPool & { piece: string })[] = [
  { piece: "lamp", x: 18, y: LP_H + 2, rx: 54, ry: 18, color: LAMP, strength: 0.28 },
  { piece: "entrance", x: EW / 2, y: EH - 6, rx: 40, ry: 12, color: NIGHT, strength: 0.18 },
];

// ==== The layout.

export interface ShopPlace {
  name: string;
  col: number;
  row: number;
  solid: boolean;
  /** Quarter turns clockwise (floor tiles only), and mirrored left to right. */
  rot?: 0 | 1 | 2 | 3;
  flip?: boolean;
  /** Squares wide, for the wide pieces, from `col` east. */
  w?: number;
  /** Squares deep, for the deep pieces, from `row` north: it stands on `row`, and covers the rows north of it too. */
  d?: number;
  /** The way out (the entrance): walking into it leaves the shop. */
  exit?: boolean;
}
const LAYOUT: ShopPlace[] = [];
const at = (name: string, col: number, row: number, solid: boolean, more: Partial<ShopPlace> = {}) => {
  const p = PIECES[name];
  if (!p) throw new Error(`no piece ${name}`);
  LAYOUT.push({ name, col, row, solid, ...(p.sq[0] > 1 ? { w: p.sq[0] } : {}), ...(p.sq[1] > 1 ? { d: p.sq[1] } : {}), ...more });
};

// -- The floor (every square): the stock's floor off the mask; on it the battle spot, the lines, a crack, an oil stain.
const CRACK = new Set(["4,14", "13,5", "16,9", "6,16", "11,17"]);
const OIL = new Set(["15,15", "3,7", "12,14"]);
for (let row = 0; row < 20; row++)
  for (let col = 0; col < 20; col++) {
    const k = `${col},${row}`;
    if (!isOpen(col, row)) {
      at("floor-stock", col, row, false);
      continue;
    }
    if (CIRCLE.has(k)) at(`circle-${col}-${row}`, col, row, false);
    else if (row === 3) at("floor-line-n", col, row, false); // a "keep clear" line along the racks
    else if (row >= 15 && (col === 9 || col === 10)) at(col === 9 ? "floor-line-w" : "floor-line-e", col, row, false); // the walkway from the door
    else if (col === 14 && row === 16) at("floor-arrow", col, row, false); // the forklift's lane
    else if (CRACK.has(k)) at("floor-c", col, row, false);
    else if (OIL.has(k)) at("floor-d", col, row, false);
    else at((col + row) % 2 ? "floor-b" : "floor-a", col, row, false);
  }
const FLOOR_COUNT = LAYOUT.length;

// -- The walls: the back on row 0, the outer sides on columns 0 and 19, the low front on row 19.
const BACK = ["wall-post", "wall", "wall-win", "wall", "wall-win-b", "wall-post", "wall", "wall-win", "wall", "wall-win-b"];
for (let col = 0; col < 20; col++) at(BACK[col < 10 ? col : 19 - col]!, col, 0, true, col >= 10 ? { flip: true } : {});
for (let row = 1; row < 19; row++) {
  at(row === 10 ? "wall-side-post" : "wall-side", 0, row, true);
  at(row === 10 ? "wall-side-post" : "wall-side", 19, row, true, { flip: true });
}
at("hem-post", 0, 19, true);
for (let col = 1; col < 19; col++) if (col < 9 || col > 10) at("hem", col, 19, true);
at("entrance", 9, 19, false, { exit: true });
at("hem-post", 19, 19, true, { flip: true });

// -- The racking: the back row (row 2, columns 2-15), the dealer's corner (16-17), the side racks (columns 1 and 18).
["rack-a", "rack-b", "rack-c", "rack-d", "rack-b", "rack-a", "rack-c"].forEach((name, i) => at(name, 2 + 2 * i, 2, true));
at("corner-shop", 16, 2, true);
const SIDES = ["rack-side", "rack-side-b", "rack-side-c"];
for (let row = 2; row < 19; row++) {
  // West: racks, but a bare stretch of wall at rows 15-18 (the leaners' wall, the NO SMOKING sign on row 16).
  if (row >= 15) at(row === 16 ? "wall-side-sign" : "wall-side", 1, row, true);
  else at(SIDES[row % 3]!, 1, row, true);
  // East: racks all the way, the forklift's empty slot at row 17.
  at(row === SHOP_GREX_SHELF_SLOT.row ? "rack-side-slot" : SIDES[(row + 1) % 3]!, 18, row, true); // (not mirrored: the lettering reads)
}

// -- On the floor.
at("board-stand", SHOP_GREX_BOARD_AT.col, SHOP_GREX_BOARD_AT.row, true); // the board on its crates, in the battle spot
at("crate", SHOP_GREX_CRATE_AT.col, SHOP_GREX_CRATE_AT.row, true); // Jefferson's Boss Crate, by the dealer
at("pallet-stack-b", 12, 4, true); // the clipboard guy checks this one
at("pallet-seat", 4, 17, true); // the dozer's pallet
at("pallet-stack", 3, 18, true);
at("pallet-stack", 16, 15, true);
at("box-open", 7, 17, true);
at("box-open-b", 12, 15, true);
at("box-open-b", 3, 9, true);
at("cone", 16, 11, true);
for (const [c, r] of [[5, 6], [14, 6], [5, 14], [14, 14]] as const) at("lamp", c, r, false);

/** Where every piece goes: name, column (its west-most square), row (its south-most), solid; floor tiles first, then the upright pieces north to south. */
export const SHOP_GREX_LAYOUT: readonly ShopPlace[] = [...LAYOUT.slice(0, FLOOR_COUNT), ...LAYOUT.slice(FLOOR_COUNT).sort((a, b) => a.row - b.row || a.col - b.col)];

// ==== The crew's places and loops (squares; a figure's foot; see shop-grex-nov4.md).

/** The dealer (the Shopkeeper): his squares and where he's drawn, in the corner by his sign, facing west (mirrored). */
export const SHOP_GREX_KEEPER = { at: [16.8, 3.2], keeper: [{ c: 16, r: 3 }, { c: 17, r: 3 }], face: -1 } as const;
/**
 * The lift guy's loop: his scissor lift shuttles along row 5 in front of the west racks (columns 4-8), stopping three times to
 * raise its platform a hair (`up`, `upIdle`, `down`) and look at the stock. Each stop: its foot (squares) and the beat there.
 * It faces east going east and west coming back (mirrored). Wholly in view from the challenge camera on phone and computer.
 */
export const SHOP_GREX_LIFT_PATH = [
  { at: [4, 5], beat: "start" },
  { at: [6, 5], beat: "up" },
  { at: [8, 5], beat: "up" },
  { at: [6, 5], beat: "up" },
  { at: [4, 5], beat: "end" },
] as const;
/**
 * The forklift's loop, in the south-east corner (rows 17-18, columns 13-17: out of view from the challenge camera on phone and
 * computer), two laps: A, the floor pallet up onto the shelf slot; B, back down off it onto the floor (so the pallet is always
 * somewhere: on the floor, on the forks or on the shelf). It always faces east (its forks ahead): it drives forward east and
 * backs up west (`reverse`, a soft beep). Each waypoint: its foot (squares) and the beat there (shop-grex-nov4.md).
 */
export const SHOP_GREX_FORK_PATH = [
  // Lap A: pick the pallet off the floor, stack it on the shelf.
  { at: [13, 18], beat: "home" },
  { at: [15, 18], beat: "pick" }, // forks slide under the floor pallet: forksDown, then forksUp (with it) to carry
  { at: [14, 18], beat: "back" }, // backs off a square
  { at: [14, 17], beat: "turn" }, // up the lane a row
  { at: [17, 17], beat: "stack" }, // forks into the slot: raisePallet to the shelf, set it down onto the beam, the pallet's the shelf's
  { at: [15, 17], beat: "back" }, // backs out, lowerFrom to carry
  { at: [14, 17], beat: "back" },
  { at: [14, 18], beat: "turn" },
  { at: [13, 18], beat: "home" },
  // Lap B: fetch it back off the shelf, set it down on the floor.
  { at: [14, 18], beat: "turn" },
  { at: [14, 17], beat: "turn" },
  { at: [17, 17], beat: "unstack" }, // raise (empty) to under it, lift it off the beam, the pallet's the forks'
  { at: [15, 17], beat: "back" }, // backs out, lower to carry
  { at: [14, 17], beat: "back" },
  { at: [14, 18], beat: "turn" },
  { at: [15, 18], beat: "drop" }, // forksDown: it's on the floor again, the pallet's the floor's
  { at: [13, 18], beat: "home" }, // backs away home
] as const;
/** The floor pallet's spot (its foot, squares): where lap A picks it up and lap B sets it down (the forks' middle, 43 px ahead of the forklift's foot at (15, 18): NPC_GREX_FORK_AT x 89 - its foot 46). */
export const SHOP_GREX_PALLET_AT = [16.16, 18] as const;
/** The idle crew's spots (they stand there; no paths) and which way each faces (1 east, -1 west: mirrored). */
export const SHOP_GREX_CREW = {
  "leaner-a": { at: [2, 16], face: 1 }, // against the bare west wall, under the NO SMOKING sign
  "leaner-b": { at: [2, 18], face: 1 },
  "crew-c": { at: [11, 4], face: 1 }, // the clipboard guy, checking the pallet at (12, 4)
  "crew-d": { at: [4, 17], face: 1 }, // the dozer, on his pallet (seat SHOP_GREX_PALLET_SEAT_H up)
  lift: { at: [4, 5], face: 1 }, // (the lift's home: its loop's start)
  forklift: { at: [13, 18], face: 1 }, // (the forklift's home)
} as const;

/** Every piece by its name (as SHOP_GREX_LAYOUT names them), each its own Character `shop-grex-<name>`. */
export const SHOP_GREX_PIECES: Readonly<Record<string, Character>> = Object.fromEntries(Object.values(PIECES).map((p) => [p.name, toChar(p)]));


/** The warehouse's palette (the intro's props and the crew's pallet use the same colors). */
export const SHOP_GREX_PALETTE: Readonly<Record<string, string>> = PALETTE;
export type { LightPool, LightSpot };
