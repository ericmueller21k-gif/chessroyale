/**
 * Inside Birdie's Station (Nov 23): the lobby, as the game's rooms are drawn (ShopRoom.tsx), built from the art's own parts as drawn
 * (shops/birdie-lobby-art.ts, the art copied in from claude/boss-art: never redrawn here). The art is one picture of the whole 12 x 12
 * room; this cuts it into the room's pieces, each standing at its foot as every room's do, so the picture the game draws is the art's.
 *
 * How the art's places become the room's (room.ts ShopPlace):
 * - A square (c, r) of the room is the art's 37 px square at x = 37 c, y = 83 + 37 r (the back wall's face above row 0). A piece's foot is
 *   its south row's middle, at the middle of its width; each piece's picture keeps the art's pixel place round that foot.
 * - The art draws in its own order (`z`: a piece's south edge, or its own: a feeder on the counter just after the counter). The room
 *   sorts by row, so each piece takes the row its `z` gives and the layout keeps the art's order within a row.
 * - Flat things (the floor, the crossing's road, the side walls) are 37 x 37 floor tiles: the 2-square road and the side walls cut into
 *   squares, the east wall's and the safety line's east edge mirrored here.
 * - A piece mirrored, nudged or animated in the art is a piece of its own (`feeder`, `feeder-2`, …), its frames the art's idle beats.
 *
 * The room's own calls (docs/decisions/2026-11-23-birdie-home.md):
 * - The bartender pours into a counter feeder (the art's notes: the pour lands 26 px right and 28 px up of his feet; his dip reaches back
 *   and down into the vat on his left). He stands just behind the front run of the bar (BARTENDER_FOOT), drawn before it, so the run's
 *   top hides him from its far edge down as the art's notes have it (his head, bow tie and the top of his vest over it); the vat moved
 *   from the back of the U to just west of him behind the run (VAT_NUDGE), its heaped top over the counter, where his scoop dips; and the
 *   middle feeder of the run moved to the run's far edge under the pour (POUR_FEEDER).
 * - The challenge spot is the middle table with its two stools (the art's `match-table`, its stools `table-stool`): its floor squares are
 *   the room's battle circle (`ring-`), the boss's mark west of the west stool, yours east of the east one.
 * - The split-flap board's flaps are written by the game (shops/flap-board.ts) over the art's board, in its box (SHOP_BIRDIE_BOARD_BOX).
 */
import type { Character, Frame, Grid, Layer, Part } from "../../characters/sprite.ts";
import { SIDEKICK_SHEETS } from "../sidekick-sheets.ts";
import type { LightPool, LightSpot } from "../houses/kit.ts";
import { SHOP_BIRDIE_BOARD_BOX, SHOP_BIRDIE_INTERIOR_3 as ART, SHOP_BIRDIE_LAYOUT, SHOP_BIRDIE_N, SHOP_BIRDIE_PIECES, SHOP_BIRDIE_WALL_H } from "./birdie-lobby-art.ts";
import type { ShopPlace } from "./room.ts";

const T = 37;
/** The top of row 0's floor in the art's picture. */
const Y0 = SHOP_BIRDIE_WALL_H - T;
export const SHOP_BIRDIE_ROOM_N = SHOP_BIRDIE_N;
/** The art's idle: 8 beats of 500 ms. */
const BEATS = 8;
const BEAT_MS = 500;

/** Where the room's square (c, r)'s middle is in the art's picture. */
const artX = (c: number) => (c + 0.5) * T;
const artY = (r: number) => Y0 + (r + 0.5) * T;

// ---- The bartender, the vat and the feeder he pours into (see the header).

/** His feet in the art's pixels: the run's far edge (y 200) 22 px over them, so it hides him from his vest's top down. */
const BARTENDER_FOOT = [257, 222] as const;
/** The vat: moved down from the U's back (its art place, (6, 1)) to just west of him behind the run, its rim where his scoop dips. */
const VAT_AT = { col: 6, row: 2 } as const;
const VAT_NUDGE = { dx: 0, dy: 21 } as const;
/** The run's middle feeder, moved to the run's far edge under his pour (26 px right of his feet, 28 up: the art's notes). */
const POUR_FEEDER = { col: 7, row: 4, dx: 6, dy: -22 } as const;

/** The Shopkeeper's place in the room's squares (ShopDef `at`), and how tall he's drawn: 1:1 with the art (his feet to his head's top). */
const sheet = SIDEKICK_SHEETS.birdiebartender;
export const SHOP_BIRDIE_BARTENDER_AT: readonly [number, number] = [BARTENDER_FOOT[0] / T - 0.5, (BARTENDER_FOOT[1] - Y0) / T - 0.5];
export const SHOP_BIRDIE_BARTENDER_TALL = sheet.foot[1] - sheet.top.idle;
/** Where his pour lands, in the art's pixels (his feet + the art's 26 right, 28 up): the test checks a feeder's top is under it. */
export const SHOP_BIRDIE_POUR_AT = [BARTENDER_FOOT[0] + 26, BARTENDER_FOOT[1] - 28] as const;

// ---- The pieces.

const parts: Record<string, Part> = { ...ART.parts };
const dims = (part: string): [number, number] => {
  const g = parts[part]!.grid;
  return [Math.max(...g.map((r) => r.length)), g.length];
};
/** One art layer, in the art's pixels: a part at (x, y), mirrored or not. */
type At = { part: string; x: number; y: number; flipX?: boolean };
/**
 * A piece: its frames' layers in the art's pixels, cut to their box (each part's 1-pixel outline included), its foot at the art's
 * (fx, fy).
 */
function piece(id: string, frames: readonly (readonly At[])[], fx: number, fy: number): Character {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of frames)
    for (const l of f) {
      const [w, h] = dims(l.part);
      x0 = Math.min(x0, l.x - 1);
      y0 = Math.min(y0, l.y - 1);
      x1 = Math.max(x1, l.x + w + 1);
      y1 = Math.max(y1, l.y + h + 1);
    }
  const out: Frame[] = frames.map((f) => ({ ms: frames.length > 1 ? BEAT_MS : 1000, layers: f.map((l): Layer => ({ part: l.part, x: l.x - x0, y: l.y - y0, flipX: l.flipX })) }));
  return { id: `shop-birdie-${id}`, name: id, w: x1 - x0, h: y1 - y0, foot: [fx - x0, fy - y0], palette: ART.palette, parts, anims: { idle: { loop: true, frames: out } } };
}

/** A floor tile from a part's 37 x 37 square at (sx, sy), mirrored or not. */
function tile(id: string, part: string, sx: number, sy: number, flip = false): Character {
  const g = parts[part]!.grid;
  let rows: string[] = g.slice(sy, sy + T).map((r) => r.slice(sx, sx + T).padEnd(T, "."));
  if (flip) rows = rows.map((r) => [...r].reverse().join(""));
  const name = `tile:${id}`;
  parts[name] = { grid: rows as Grid, outline: false };
  return { id: `shop-birdie-${id}`, name: id, w: T, h: T, foot: [T / 2, T / 2], palette: ART.palette, parts, anims: { idle: { loop: true, frames: [{ ms: 1000, layers: [{ part: name, x: 0, y: 0 }] }] } } };
}

/** The art's part for a place at beat f (its `partFor`): the arches' trains, the crossing's lights in turn. The board: as it stands. */
function partAt(piece: string, col: number, flip: boolean, f: number): string {
  if (piece === "arch" || piece === "arch-east") return `${piece}-${f}`;
  if (piece === "counter-arm") return col === 8 ? "counter-arm-east" : "counter-arm";
  if (piece === "crossing-post") return (f + (flip ? 1 : 0)) % 2 ? "crossing-post-r" : "crossing-post-l";
  return piece;
}
const ANIMATED = new Set(["arch", "arch-east", "crossing-post"]);
/** The challenge spot's pieces, by their room names (the intro stands in for them: intros/birdie.ts). */
const TABLE_ROW = 7;
const TABLE_COL = 6;

const PIECES: Record<string, Character> = {};
/** The room's names for a picture already made (the same art at the same place round its foot: one piece). */
const named = new Map<string, string>();
function nameFor(base: string, key: string, make: () => Character): string {
  const hit = named.get(key);
  if (hit) return hit;
  let name = base;
  for (let k = 2; PIECES[name]; k++) name = `${base}-${k}`;
  PIECES[name] = make();
  named.set(key, name);
  return name;
}

const LAYOUT: ShopPlace[] = [];
// -- The floor: every tile flat on its square; the challenge spot's three squares the battle circle (`ring-`).
const isRing = (c: number, r: number) => r === TABLE_ROW && c >= TABLE_COL - 1 && c <= TABLE_COL + 1;
const floorName = (n: string, c: number, r: number) => (isRing(c, r) ? `ring-${n.replace(/^floor-/, "")}` : n);
for (const p of SHOP_BIRDIE_LAYOUT) {
  const c = p.col, r = p.row;
  if (p.piece.startsWith("floor-")) {
    const id = floorName(`${p.piece}${p.flip ? "-e" : ""}`, c, r);
    if (!PIECES[id]) PIECES[id] = tile(id, p.piece, 0, 0, !!p.flip);
    LAYOUT.push({ name: id, col: c, row: r, solid: false, rot: p.rot });
  } else if (p.piece === "road" || p.piece === "road-rails") {
    // (Two squares a piece in the art; the south end turned half round, which swaps its halves.)
    for (const half of [0, 1]) {
      const id = `floor-${p.piece}-${half ? "e" : "w"}`;
      if (!PIECES[id]) PIECES[id] = tile(id, p.piece, half * T, 0);
      LAYOUT.push({ name: id, col: c + (p.rot === 2 ? 1 - half : half), row: r, solid: false, rot: p.rot === 2 ? 2 : undefined });
    }
  } else if (p.piece === "side-wall") {
    for (let k = 0; k < (p.d ?? 1); k++) {
      const id = `floor-wall-${k}${p.flip ? "-e" : ""}`;
      PIECES[id] = tile(id, "side-wall", 0, k * T, !!p.flip);
      LAYOUT.push({ name: id, col: c, row: r + k, solid: true });
    }
  }
}
const FLOOR_COUNT = LAYOUT.length;

// -- The upright pieces, in the art's drawing order (its `z`, then its list's order), each on the row its `z` gives.
const zOf = (p: (typeof SHOP_BIRDIE_LAYOUT)[number]) => p.z ?? (p.row === 0 && p.piece.startsWith("wall") ? 0.1 : p.row + (p.d ?? 1));
type Up = { z: number; i: number; place: ShopPlace };
const ups: Up[] = [];
SHOP_BIRDIE_LAYOUT.forEach((src, i) => {
  if (src.piece.startsWith("floor-") || src.piece === "road" || src.piece === "road-rails" || src.piece === "side-wall") return;
  let p = src;
  // (The bartender's corner: the vat down beside him, the run's middle feeder under his pour.)
  if (p.piece === "vat") p = { ...p, ...VAT_AT, ...VAT_NUDGE };
  if (p.piece === "feeder" && p.col === POUR_FEEDER.col && p.row === POUR_FEEDER.row) p = { ...p, dx: POUR_FEEDER.dx, dy: POUR_FEEDER.dy };
  const def = SHOP_BIRDIE_PIECES[p.piece]!;
  const w = p.w ?? def.w;
  const d = p.d ?? def.d;
  const z = p.piece === "vat" ? p.row + d : zOf(p);
  const row = Math.max(0, Math.floor(z - 1 + 1e-6));
  const x = p.col * T + def.ox + (p.dx ?? 0);
  const y = Y0 + p.row * T + def.oy + (p.dy ?? 0);
  const fx = (p.col + w / 2) * T;
  const fy = artY(row);
  const flip = !!p.flip;
  const frames = ANIMATED.has(p.piece) ? Array.from({ length: BEATS }, (_, f) => [{ part: partAt(p.piece, p.col, flip, f), x, y, flipX: flip }]) : [[{ part: partAt(p.piece, p.col, flip, 0), x, y, flipX: flip }]];
  // (The sconce's glow behind it, as the art lays it.)
  if (p.piece === "sconce") frames[0]!.unshift({ part: "sconce-glow", x: x - 5, y: y - 14, flipX: false });
  const atTable = p.row === TABLE_ROW && (p.piece === "match-table" || p.piece === "stool" || p.piece === "feeder");
  const base = atTable ? (p.piece === "stool" ? "table-stool" : p.piece === "feeder" ? "table-feeder" : "match-table") : p.piece === "counter-arm" ? `counter-arm-${p.col === 8 ? "e" : "w"}` : p.piece;
  const key = `${base}|${frames.map((f) => f.map((l) => `${l.part}:${l.x - fx},${l.y - fy},${l.flipX ? 1 : 0}`).join(";")).join("/")}`;
  const name = nameFor(base, key, () => piece(base, frames, fx, fy));
  // (Solid where the art says, else furniture: a feeder on a counter or table, the bell, the floor's feeders and the doorway aren't.)
  const solid = src.solid ?? true;
  ups.push({ z, i, place: { name, col: p.col, row, solid, ...(w > 1 ? { w } : {}), ...(d > 1 ? { d } : {}), ...(p.exit ? { exit: true } : {}) } });
});
// -- The birds on the stools, each with its own beat (the art's BIRD_SEATS), just after their stools.
const BIRD_SEATS: readonly { col: number; row: number; bird: "dove" | "sparrow"; west?: boolean; beat: string }[] = [
  { col: 4, row: 1, bird: "dove", beat: "uubuuubu" },
  { col: 4, row: 3, bird: "sparrow", beat: "uuuussuu" },
  { col: 5, row: 5, bird: "dove", beat: "tttuuuuu" },
  { col: 7, row: 5, bird: "sparrow", west: true, beat: "ubuubuuu" },
  { col: 9, row: 1, bird: "sparrow", west: true, beat: "suuuuuus" },
  { col: 9, row: 2, bird: "dove", west: true, beat: "uuuuubuu" },
];
const POSE: Record<string, string> = { u: "up", b: "bob", s: "sip", t: "tuck" };
BIRD_SEATS.forEach((b, k) => {
  const stool = SHOP_BIRDIE_PIECES.stool!;
  const x = b.col * T + stool.ox + 6;
  const y = Y0 + b.row * T + stool.oy - 4;
  const frames = Array.from({ length: BEATS }, (_, f) => [{ part: `${b.bird}-${POSE[b.beat[f]!]!}`, x, y, flipX: !!b.west }]);
  const name = `bird-${k + 1}`;
  PIECES[name] = piece(name, frames, artX(b.col), artY(b.row));
  ups.push({ z: b.row + 1.05, i: 10000 + k, place: { name, col: b.col, row: b.row, solid: false } });
});
ups.sort((a, b) => a.z - b.z || a.i - b.i);
LAYOUT.push(...ups.map((u) => u.place));

/** Every piece's place: the floor tiles first, then the upright ones in the art's order. */
export const SHOP_BIRDIE_ROOM_LAYOUT: readonly ShopPlace[] = LAYOUT;
export const SHOP_BIRDIE_ROOM_PIECES: Readonly<Record<string, Character>> = PIECES;
/** The deep pieces that stand up (the bar's arms, 3 squares deep), not laid flat as a plan. */
export const SHOP_BIRDIE_UPRIGHT: readonly string[] = Object.keys(PIECES).filter((n) => n.startsWith("counter-arm"));
/** The battle spot's marks: the boss west of the west stool, you east of the east one (as every room's: the boss on the left). */
export const SHOP_BIRDIE_MARKS = { boss: [TABLE_COL - 2, TABLE_ROW], you: [TABLE_COL + 2, TABLE_ROW] } as const;
/** The Shopkeeper's squares (inside the U, behind the run), and where you talk to him: the floor past the run's stools. */
export const SHOP_BIRDIE_KEEPER = [{ c: 6, r: 3 }, { c: 7, r: 3 }] as const;
export const SHOP_BIRDIE_TALK_AT = [{ c: 6, r: 6 }, { c: 7, r: 6 }] as const;
// ---- Its lights: the floor lamps' and the sconces' glow; the pools under the lamps, at the bar, at the table and at the door.

const placesOf = (name: string) => LAYOUT.filter((p) => p.name === name);
/** A piece's picture's top-left in the art's pixels, standing at `p`. */
const picAt = (p: ShopPlace) => {
  const ch = PIECES[p.name]!;
  return { x: artX(p.col + ((p.w ?? 1) - 1) / 2) - ch.foot[0], y: artY(p.row) - ch.foot[1] };
};
const glow = (name: string, ax: number, ay: number, halo: number): LightSpot & { piece: string } => {
  const at = picAt(placesOf(name)[0]!);
  return { piece: name, x: ax - at.x - 2, y: ay - at.y - 2, w: 4, h: 4, color: "#ffe2a0", strength: 0.55, halo };
};
/** The board's piece and the box its flaps fill, in its picture's pixels (the game writes them: shops/flap-board.ts). */
const boardSrc = SHOP_BIRDIE_LAYOUT.find((p) => p.piece === "board")!;
const boardAt = picAt(placesOf("board")[0]!);
export const SHOP_BIRDIE_FLAPS = {
  piece: "board",
  box: {
    x: boardSrc.col * T + SHOP_BIRDIE_PIECES.board!.ox + SHOP_BIRDIE_BOARD_BOX.x - boardAt.x,
    y: Y0 + boardSrc.row * T + SHOP_BIRDIE_PIECES.board!.oy + SHOP_BIRDIE_BOARD_BOX.y - boardAt.y,
    w: SHOP_BIRDIE_BOARD_BOX.w,
    h: SHOP_BIRDIE_BOARD_BOX.h,
  },
} as const;
const lamp = placesOf("lamp")[0]!;
const lampAt = picAt(lamp);
const sconce = placesOf("sconce")[0]!;
const sconceAt = picAt(sconce);
export const SHOP_BIRDIE_ROOM_LIGHTS: readonly (LightSpot & { piece: string })[] = [
  glow("lamp", lampAt.x + 10 + 9, lampAt.y + 1 + 12, 22),
  glow(sconce.name, sconceAt.x + 6 + 6, sconceAt.y + 15, 14),
];
const pool = (name: string, ax: number, ay: number, rx: number, ry: number, color: string, strength: number): LightPool & { piece: string } => {
  const at = picAt(placesOf(name)[0]!);
  return { piece: name, x: ax - at.x, y: ay - at.y, rx, ry, color, strength };
};
const table = placesOf("match-table")[0]!;
const door = placesOf("entrance")[0]!;
export const SHOP_BIRDIE_ROOM_POOLS: readonly (LightPool & { piece: string })[] = [
  pool("lamp", lamp.col * T + 18, Y0 + lamp.row * T + 30, 30, 14, "#ffe2a0", 0.25),
  pool("match-table", table.col * T + 18, Y0 + table.row * T + 18, 44, 26, "#ffe2a0", 0.2),
  pool("entrance", door.col * T + T, Y0 + (door.row - 1) * T + 22, 42, 22, "#fff8e2", 0.25),
];

// ---- The challenge's table (intros/birdie.ts): the art's table and its two stools as one picture, three squares across, its foot the
// table's (as the park table's: the slab and the board sit TABLE_BOARD.top over it, on its white top).
const tableParts = LAYOUT.filter((p) => p.row === TABLE_ROW && (p.name === "match-table" || p.name.startsWith("table-stool")));
export const SHOP_BIRDIE_TABLE: Character = (() => {
  const layers: At[] = [];
  for (const p of tableParts) {
    const ch = PIECES[p.name]!;
    const at = picAt(p);
    for (const l of ch.anims.idle!.frames[0]!.layers) layers.push({ part: l.part, x: at.x + l.x, y: at.y + l.y, flipX: l.flipX });
  }
  return piece("challenge-table", [layers], artX(TABLE_COL), artY(TABLE_ROW));
})();
