/**
 * Inside Birdie's Station (Nov 23; round 4 the same day, docs/decisions/2026-11-23-birdie-lobby-4.md): the lobby, as the game's rooms are
 * drawn (ShopRoom.tsx), built from the art's own parts as drawn (shops/birdie-lobby-art.ts, the art copied in from claude/boss-art: never
 * redrawn here). The art is one picture of the whole 12 x 12 room (its idle's layers, each at its pixel place); this cuts it into the
 * room's pieces, each standing at its foot as every room's do, so the picture the game draws is the art's.
 *
 * How the art's places become the room's (room.ts ShopPlace):
 * - A square (c, r) of the room is the art's 37 px square at x = 37 c, y = 83 + 37 r (the back wall's face above row 0). A piece's foot is
 *   its row's middle, at the middle of its width; each piece's picture keeps the art's pixel place round that foot.
 * - Flat things (the floor with its side walls and safety line, the crossing's gravel and rails) are 37 x 37 floor tiles cut from the art's
 *   floor and tracks as drawn; the back wall stands up on row 0, the front wall's face (cut from the floor) on row 11 beside the doorway.
 * - Each other layer of the art is a piece on the row its foot is on (its picture's bottom), in the art's own order within a row. A layer
 *   that changes over the art's idle (the birds' bob) is a piece of 4 beats; the gates are a piece each (their post, motor, arm, lights and
 *   crossbuck), with their `lower` and `down` as pieces of their own (SHOP_BIRDIE_GATE_PLAYS), which ShopRoom plays for a challenge.
 * - The bar is one U-shaped picture in the art, its top raised 36 px over its squares: it's cut into the arms' rows (each arm's square of
 *   top with the 36 px under it: its raised top and its side face, standing on its row) and the front run (its top and front face, on
 *   row 4), so in the room's camera each reads as a raised counter, as the run always has. The cuts carry the bar's own outline.
 *
 * The room's own calls (docs/decisions/2026-11-23-birdie-lobby-4.md):
 * - The bartender pours into a counter feeder (the art's notes: the pour lands 26 px right and 28 px up of his feet; his dip reaches back
 *   and down into the vat on his left). He stands just behind the front run of the bar (BARTENDER_FOOT), drawn before it, so the run's
 *   top hides him from its far edge down (his head, bow tie and the top of his vest over it); the vat moved down from the back of the U to
 *   just west of him behind the run (VAT_NUDGE), its heaped top over the counter, where his scoop dips; and the run's feeder (the art's,
 *   at its west corner) moved to the run's far edge under the pour (POUR_FEEDER).
 * - The east crossing gate stands a square east of the art's (GATE_SHIFT), clear of your mark.
 * - The chess table is the town's table (park.ts PARK_TABLE's geometry: its leg in his wood, and the art's two stools as drawn either side),
 *   its top the renderer's flat slab and board in the art's table's colors (SHOP_BIRDIE_TABLE_PALETTE: the yellow rim, the charcoal frame,
 *   cream and wood squares), as every boss's battle table, so it lies flat in the room's camera; standing at its row's middle as every
 *   room's table, 14 px north of the art's. Its three squares are the battle circle (`ring-`), the boss's mark west of the west stool,
 *   yours east of the east one.
 * - The split-flap board's flaps are written by the game (shops/flap-board.ts) over the art's board, in its box (SHOP_BIRDIE_BOARD_BOX).
 */
import { frameKeys, type Character, type Frame, type Grid, type Layer, type Part } from "../../characters/sprite.ts";
import { SIDEKICK_SHEETS } from "../sidekick-sheets.ts";
import { crate, groundShadow, paint, type LightPool, type LightSpot, type Pt } from "../houses/kit.ts";
import { PARK_TABLE } from "../houses/park.ts";
import { SHOP_BIRDIE_GATES, SHOP_BIRDIE_INTERIOR_4 as ART, SHOP_BIRDIE_N, SHOP_BIRDIE_SQUARE, SHOP_BIRDIE_WALL } from "./birdie-lobby-art.ts";
import type { ShopPlace } from "./room.ts";
import { FlapBoard, boardStops, type FlapInk } from "./flap-board.ts";
import { HOMES } from "../world.ts";

const T = SHOP_BIRDIE_SQUARE;
/** The top of row 0's floor in the art's picture. */
const Y0 = SHOP_BIRDIE_WALL;
export const SHOP_BIRDIE_ROOM_N = SHOP_BIRDIE_N;
const W = ART.w;
const H = ART.h;
const P = ART.palette;

/** Where the room's square (c, r)'s middle is in the art's picture. */
const artX = (c: number) => (c + 0.5) * T;
const artY = (r: number) => Y0 + (r + 0.5) * T;
const rowY = (r: number) => Y0 + r * T;

/** The art's idle (its beats: the birds bob), and its gates' two plays (the whole room each beat, the lights in its palette). */
const IDLE = ART.anims.idle!.frames;
const LOWER = ART.anims["gates-lower"]!.frames;
const DOWN = ART.anims["gates-down"]!.frames;
const L0 = IDLE[0]!.layers;

// ---- The bartender, the vat and the feeder he pours into (see the header).

/** His feet in the art's pixels: the run's far edge (y 195) 22 px over them, so it hides him from his vest's top down. */
const BARTENDER_FOOT = [257, 217] as const;
/**
 * The vat: moved down from the U's back (its art place, x 224, y 115) to just west of him behind the run, its heap where his scoop dips,
 * level with his head, so it shows over the run's far edge as he does; standing on his row, its foot under its bottom as his is.
 */
const VAT_AT = { col: 6, row: 3 } as const;
const VAT_NUDGE = { dx: 0, dy: 47 } as const;
/**
 * The gates as the art places them (SHOP_BIRDIE_GATES), but the east one a square further east (col 9, row 8): at the art's col 8 it
 * stands just in front of your mark (8, 7), its crossbuck over you through the challenge.
 */
const GATE_SHIFT = [0, 1] as const;
/** The run's feeder, moved from its west corner to the run's far edge under his pour (26 px right of his feet, 28 up: the art's notes). */
const POUR_FEEDER = { col: 7, row: 4, x: 277, y: 187 } as const;

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
/** A piece's beat: its layers in the art's pixels, how long it shows, its lights (the art's frame palette). */
type Beat = { layers: readonly At[]; ms: number; pal?: Readonly<Record<string, string>> };
/** A piece: its beats' layers in the art's pixels, cut to their box (each part's 1-pixel outline included), its foot at the art's (fx, fy). */
function piece(id: string, beats: readonly Beat[], fx: number, fy: number, palette: Record<string, string> = P): Character {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of beats)
    for (const l of b.layers) {
      const [w, h] = dims(l.part);
      x0 = Math.min(x0, l.x - 1);
      y0 = Math.min(y0, l.y - 1);
      x1 = Math.max(x1, l.x + w + 1);
      y1 = Math.max(y1, l.y + h + 1);
    }
  const out: Frame[] = beats.map((b) => ({ ms: b.ms, layers: b.layers.map((l): Layer => ({ part: l.part, x: l.x - x0, y: l.y - y0, flipX: l.flipX })), ...(b.pal ? { pal: b.pal } : {}) }));
  return { id: `shop-birdie-${id}`, name: id, w: x1 - x0, h: y1 - y0, foot: [fx - x0, fy - y0], palette, parts, anims: { idle: { loop: true, frames: out } } };
}

/** The art's pixels as drawn by some of its layers (outlines and all), to cut flat pieces from. */
const cellsOf = (layers: readonly Layer[]) => frameKeys({ ...ART, w: W, h: H, parts }, { layers, ms: 0 });
/** A cut of drawn pixels (x0 to x1, y0 to y1, the art's), as a part of its own (its outline already in it). */
function cut(name: string, cells: readonly (readonly (string | null)[])[], x0: number, y0: number, x1: number, y1: number): string {
  const rows: string[] = [];
  for (let y = y0; y < y1; y++) {
    let s = "";
    for (let x = x0; x < x1; x++) s += cells[y]?.[x] ?? ".";
    rows.push(s);
  }
  parts[name] = { grid: rows as Grid, outline: false };
  return name;
}
/** A floor tile: the drawn floor's 37 x 37 square (c, r). */
function tile(id: string, cells: readonly (readonly (string | null)[])[], c: number, r: number): Character {
  const part = cut(`tile:${id}`, cells, c * T, rowY(r), (c + 1) * T, rowY(r + 1));
  return { id: `shop-birdie-${id}`, name: id, w: T, h: T, foot: [T / 2, T / 2], palette: P, parts, anims: { idle: { loop: true, frames: [{ ms: 1000, layers: [{ part, x: 0, y: 0 }] }] } } };
}

/** The challenge spot: the table's square, its stools either side (the intro stands in for them: intros/birdie.ts). */
const TABLE_ROW = 7;
const TABLE_COL = 6;

const PIECES: Record<string, Character> = {};
/** The room's names for a picture already made (the same art at the same place round its foot: one piece). */
const named = new Map<string, string>();
function nameFor(base: string, beats: readonly Beat[], fx: number, fy: number): string {
  const key = `${base}|${beats.map((b) => `${b.ms}:${JSON.stringify(b.pal ?? null)}:${b.layers.map((l) => `${l.part}:${l.x - fx},${l.y - fy},${l.flipX ? 1 : 0}`).join(";")}`).join("/")}`;
  const hit = named.get(key);
  if (hit) return hit;
  let name = base;
  for (let k = 2; PIECES[name]; k++) name = `${base}-${k}`;
  PIECES[name] = piece(name, beats, fx, fy);
  named.set(key, name);
  return name;
}

const LAYOUT: ShopPlace[] = [];

// -- The floor: every tile flat on its square (the art's floor and the crossing's tracks as drawn); the challenge spot's three squares the
// battle circle (`ring-`); the side walls' squares solid.
const iOf = (part: string, from = 0) => L0.findIndex((l, i) => i >= from && l.part === part);
const flat = cellsOf([L0[iOf("floor")]!, L0[iOf("crossing-track")]!]);
const isRing = (c: number, r: number) => r === TABLE_ROW && c >= TABLE_COL - 1 && c <= TABLE_COL + 1;
for (let r = 0; r < SHOP_BIRDIE_N; r++)
  for (let c = 0; c < SHOP_BIRDIE_N; c++) {
    const id = `${isRing(c, r) ? "ring" : "floor"}-${c}-${r}`;
    PIECES[id] = tile(id, flat, c, r);
    LAYOUT.push({ name: id, col: c, row: r, solid: c === 0 || c === SHOP_BIRDIE_N - 1 });
  }

// -- The upright pieces: each on its row, in the art's order within a row (`i`).
type Up = { row: number; i: number; place: ShopPlace };
const ups: Up[] = [];
/** Puts a piece on (col, row), `w` squares wide; its foot that row's middle. */
function stand(base: string, beats: readonly Beat[], col: number, row: number, i: number, opts: Partial<ShopPlace> = {}) {
  const w = opts.w ?? 1;
  const name = nameFor(base, beats, (col + w / 2) * T, artY(row));
  ups.push({ row, i, place: { name, col, row, solid: true, ...opts } });
}
/** A layer's own beats over the art's idle: one if it never changes, else its four. */
const beatsOf = (idx: readonly number[], move: (l: Layer) => At = (l) => l): Beat[] => {
  const all = IDLE.map((f) => ({ layers: idx.map((i) => move(f.layers[i]!)), ms: f.ms }));
  const same = all.every((b) => JSON.stringify(b.layers) === JSON.stringify(all[0]!.layers));
  return same ? [{ layers: all[0]!.layers, ms: 1000 }] : all;
};
/** The row a picture's foot is on: its bottom (the art's last drawn row, less its outline's). */
const rowOf = (y: number, h: number) => Math.min(SHOP_BIRDIE_N - 1, Math.max(0, Math.floor((y + h - 2 - Y0) / T)));
const colOf = (x: number, w: number) => Math.floor((x + w / 2) / T);
/** Wide pieces' widths in squares (the rest: one). */
const WIDE: Record<string, number> = { "back-wall": 12, "window-sea": 2, "window-train": 2, "flap-board": 4, shelves: 2, "airport-seats": 3, door: 2 };
/** On the back wall (row 0, after the wall). */
const ON_WALL = new Set(["window-sea", "window-train", "flap-board", "shelves", "sconce"]);
const GATE_PART = (p: string) => p.startsWith("gate-") || p.startsWith("arm-");
/** The gates' layers in the art's list, west then east (each a run of its five). */
const gateRuns: number[][] = [];
L0.forEach((l, i) => {
  if (!GATE_PART(l.part)) return;
  const run = gateRuns[gateRuns.length - 1];
  if (run && run[run.length - 1] === i - 1) run.push(i);
  else gateRuns.push([i]);
});
const NOT_WALKED = new Set(["bird", "feeder", "seed-pile"]);
/** The bar's own picture as drawn (its outline round it), to cut into its arms' rows and its front run. */
const barI = iOf("bar");
const bar = L0[barI]!;
const barCells = cellsOf([bar]);
const [BAR_W, BAR_H] = dims("bar");
/** How far the bar's top is raised over its squares (the art's: its front face's height), and where its front run's top starts. */
const BAR_UP = 36;
const RUN_TOP = rowY(4) - BAR_UP;

L0.forEach((l, i) => {
  const part = l.part;
  if (part === "floor" || part === "crossing-track" || GATE_PART(part)) return;
  const [w, h] = dims(part);
  if (part === "back-wall") return stand("back-wall", beatsOf([i]), 0, 0, i, { w: WIDE[part] });
  if (ON_WALL.has(part)) {
    const ww = WIDE[part] ?? 1;
    const col = ww > 1 ? Math.round(l.x / T) : colOf(l.x, w);
    return stand(part === "flap-board" ? "board" : part, part === "flap-board" ? [{ layers: [l], ms: 1000 }] : beatsOf([i]), col, 0, i, { ...(ww > 1 ? { w: ww } : {}) });
  }
  if (part === "bar") {
    // (Each arm's rows, 1 to 3: the square of its raised top and the 36 px under it; the cut carries the bar's outline, the U's inside
    // edge with it. Then the front run, its top and its front face, on row 4.)
    const x0 = bar.x - 1;
    const x1 = bar.x + BAR_W + 1;
    for (const [side, cx0, cx1, col] of [["w", x0, bar.x + T + 1, 5], ["e", bar.x + BAR_W - T - 1, x1, 8]] as const)
      for (let r = 1; r <= 3; r++) {
        const y0 = r === 1 ? bar.y - 1 : rowY(r) - BAR_UP;
        const name = cut(`counter-arm-${side}-${r}`, barCells, cx0, y0, cx1, rowY(r + 1));
        stand(`counter-arm-${side}-${r}`, [{ layers: [{ part: name, x: cx0, y: y0 }], ms: 1000 }], col, r, i);
      }
    const run = cut("counter-run", barCells, x0, RUN_TOP - 1, x1, bar.y + BAR_H + 1);
    return stand("counter", [{ layers: [{ part: run, x: x0, y: RUN_TOP - 1 }], ms: 1000 }], 5, 4, i, { w: 4 });
  }
  if (part === "vat") {
    // (Down beside him: see the header.)
    return stand("vat", beatsOf([i], (q) => ({ ...q, x: q.x + VAT_NUDGE.dx, y: q.y + VAT_NUDGE.dy })), VAT_AT.col, VAT_AT.row, i);
  }
  if (part === "feeder" && l.y + h > RUN_TOP) {
    // (The run's feeder: under his pour.)
    return stand("feeder", [{ layers: [{ ...l, x: POUR_FEEDER.x, y: POUR_FEEDER.y }], ms: 1000 }], POUR_FEEDER.col, POUR_FEEDER.row, i, { solid: false });
  }
  if (part === "chess-table") return; // (the town's table in its place: below)
  // (A thing on the bar's raised top stands on the row of its foot's square under the top: 36 px further down.)
  const onBar = (part === "feeder" || part === "seed-pile") && l.x + w / 2 > bar.x && l.x + w / 2 < bar.x + BAR_W;
  const row = rowOf(l.y + (onBar ? BAR_UP : 0), h);
  const col = WIDE[part] ? Math.round(l.x / T) : colOf(l.x, w);
  // (The table's stools are its picture's: below.)
  if (part === "stool" && row === TABLE_ROW) return;
  stand(part, beatsOf([i]), col, row, i, { solid: !NOT_WALKED.has(part), ...(WIDE[part] ? { w: WIDE[part] } : {}), ...(part === "door" ? { exit: true, solid: false } : {}) });
});

// -- The gates (SHOP_BIRDIE_GATES: their squares): idle as the art's room stands, and their `lower` and `down` (SHOP_BIRDIE_GATE_PLAYS).
const GATE_NAMES = ["gate-w", "gate-e"] as const;
/** Where each gate stands in the room (the art's squares, the east one moved: GATE_SHIFT). */
export const SHOP_BIRDIE_GATE_AT = SHOP_BIRDIE_GATES.map((g, i) => ({ col: g.col + GATE_SHIFT[i]!, row: g.row }));
gateRuns.forEach((idx, g) => {
  const at = SHOP_BIRDIE_GATE_AT[g]!;
  const dx = GATE_SHIFT[g]! * T;
  const name = GATE_NAMES[g]!;
  const fx = artX(at.col);
  const fy = artY(at.row);
  const move = (l: Layer): At => ({ ...l, x: l.x + dx });
  const of = (fs: readonly Frame[]): Beat[] => fs.map((f) => ({ layers: idx.map((i) => move(f.layers[i]!)), ms: f.ms, ...(f.pal ? { pal: f.pal } : {}) }));
  PIECES[name] = piece(name, beatsOf(idx, move), fx, fy);
  PIECES[`${name}-lower`] = piece(`${name}-lower`, of(LOWER), fx, fy);
  PIECES[`${name}-down`] = piece(`${name}-down`, of(DOWN), fx, fy);
  ups.push({ row: at.row, i: idx[0]!, place: { name, col: at.col, row: at.row, solid: true } });
});
/** Each gate's plays for a challenge (ShopRoom): from you both on your marks its `lower` once, then its `down` on and on. */
export const SHOP_BIRDIE_GATE_PLAYS: Readonly<Record<string, { readonly lower: string; readonly down: string }>> = Object.fromEntries(GATE_NAMES.map((n) => [n, { lower: `${n}-lower`, down: `${n}-down` }]));

// -- The front wall's face, standing on row 11 beside the doorway (cut from the floor as drawn).
const FRONT_FACE = 494;
const DOOR_COLS = [4, 5];
for (let c = 0; c < SHOP_BIRDIE_N; c++) {
  if (DOOR_COLS.includes(c)) continue;
  const part = cut(`hem-${c}`, flat, c * T, FRONT_FACE, (c + 1) * T, H);
  // (Before the doorway on its row, as the art drew the front wall under it.)
  stand("hem", [{ layers: [{ part, x: c * T, y: FRONT_FACE }], ms: 1000 }], c, SHOP_BIRDIE_N - 1, -100 + c);
}

// ---- The chess table (Eric, Nov 23: "a squared table with a chessboard on it, just like every other boss has"): PARK_TABLE's geometry
// (111 x 50, its foot [55, 44], the slab's top 27 over it), its leg in the art's wood, the art's two stools either side as drawn (their feet
// 2 px over the table's, as the art has them); the slab and its board are the renderer's, flat, in SHOP_BIRDIE_TABLE_PALETTE.
const tableArt = L0.find((l) => l.part === "chess-table")!;
const [TW_ART, TH_ART] = dims("chess-table");
/** The art's table's foot (its leg's middle, under its bottom row). */
const TABLE_FOOT_ART = [tableArt.x + TW_ART / 2, tableArt.y + TH_ART] as const;
const parkLayers = PARK_TABLE.anims.idle!.frames[0]!.layers;
/** PARK_TABLE's leg (its last layer: the pedestal), in the art's wood. */
const legPart = parkLayers[parkLayers.length - 1]!;
parts["table-leg"] = PARK_TABLE.parts[legPart.part]!;
const TABLE_PALETTE: Record<string, string> = { ...P, "2": P.p!, "3": P.o!, "4": P.O!, "5": P.O! };
export const SHOP_BIRDIE_TABLE: Character = (() => {
  const [fx, fy] = PARK_TABLE.foot;
  const layers: Layer[] = [];
  for (const l of L0) if (l.part === "stool" && rowOf(l.y, dims("stool")[1]) === TABLE_ROW) layers.push({ part: "stool", x: Math.round(l.x - TABLE_FOOT_ART[0] + fx), y: l.y - TABLE_FOOT_ART[1] + fy });
  layers.push({ part: "table-leg", x: legPart.x, y: legPart.y });
  return { id: "shop-birdie-challenge-table", name: "Birdie's chess table", w: PARK_TABLE.w, h: PARK_TABLE.h, foot: PARK_TABLE.foot, palette: TABLE_PALETTE, parts, anims: { idle: { loop: true, frames: [{ ms: 1000, layers }] } } };
})();
/** The slab's and board's colors (the renderer's keys, as park.ts's): the art's table's yellow rim, charcoal frame, wood front, and its cream and wood squares. */
export const SHOP_BIRDIE_TABLE_PALETTE: Record<string, string> = { k: P.k!, "1": P.y!, "2": P.m!, "3": P.n!, "4": P.O!, "5": P.M!, L: P.i!, D: P.o!, P: "#fbfbf6", Q: "#262321" };
PIECES["match-table"] = SHOP_BIRDIE_TABLE;
ups.push({ row: TABLE_ROW, i: L0.indexOf(tableArt), place: { name: "match-table", col: TABLE_COL - 1, row: TABLE_ROW, w: 3, solid: true } });

ups.sort((a, b) => a.row - b.row || a.i - b.i);
LAYOUT.push(...ups.map((u) => u.place));

// ---- His Boss Crate on the bar (Nov 23), as every shop's stands on its counter (Babur's: babur-art.ts SHOP_BABUR_CRATE): the houses
// kit's wooden crate in his colors (his cap's navy, his tie's burgundy, his cap band's gold), a gold diamond on its front (his cap's),
// a little feather of his on the lid, and the same slow glint round its gold corners. ShopRoom stands it on the run (the `counter`
// piece) at SHOP_BIRDIE_CRATE_AT, drawn just after it; the art has none, so it's the room's own.

/** Where the crate stands on the run: its foot, in the `counter` piece's pixels (the run's top, left of him, before his talk squares). */
export const SHOP_BIRDIE_CRATE_AT: Pt = [61, 31];
const CRATE_PALETTE: Record<string, string> = {
  k: "#1d1411", // outline (his)
  N: "#0f1328", // the planks: his cap's navy, dark to light
  O: "#1c2850",
  P: "#2d3f7c",
  Q: "#4a60a8",
  A: "#6a1222", // the bands: his tie's burgundy, dark to light
  B: "#a52238",
  C: "#d64a5a",
  J: "#6e4a0c", // gold: his cap band's (K, L), a shade and a light
  K: "#a87414",
  L: "#f2c14e",
  M: "#ffe58a",
  F: "#fffaf0", // the glint
  c: "#7c624f", // his feather: his brown, dark to light, and its shaft
  d: "#9c8069",
  e: "#bfa58b",
  i: "#e6c6ac",
  "-": "#0d0e1280", // its shadow on the bar: core, rim
  "+": "#0d0e1244",
};
const XW = 30;
const XH = 27;
export const SHOP_BIRDIE_CRATE: Character = (() => {
  const box = crate(1, 8, 28, 18, "NOPQ");
  const trim = paint(1, 8, 28, 18, (x, y) => {
    const i = x - 1;
    const j = y - 8;
    const corner = (i < 4 || i > 23) && (j < 4 || j > 13);
    if (corner) return (i < 4 ? i : 27 - i) + (j < 4 ? j : 17 - j) > 4 ? null : i < 4 && j < 4 ? "M" : i > 23 || j > 13 ? "K" : "L";
    if ((i >= 7 && i <= 9) || (i >= 18 && i <= 20)) return j === 0 ? "C" : i === 7 || i === 18 ? "C" : i === 9 || i === 20 ? "A" : "B";
    const diamond = ["..L..", ".LML.", "LMLLK", ".LKK.", "..K.."];
    const s = diamond[j - 6]?.[i - 12];
    return s && s !== "." ? s : null;
  }, false);
  // (His feather on the lid, lying from its quill at the left to its tip up at the right: lit above its shaft, shaded below, a notch
  // in its vane.)
  const [ax, ay, bx, by] = [8, 7.5, 22.5, 2];
  const len = Math.hypot(bx - ax, by - ay);
  const feather = paint(6, 0, 19, 9, (x, y) => {
    const px = x + 0.5 - ax;
    const py = y + 0.5 - ay;
    const u = (px * (bx - ax) + py * (by - ay)) / (len * len);
    const v = (px * (ay - by) + py * (bx - ax)) / len;
    if (u < 0 || u > 1) return null;
    if (u < 0.2) return Math.abs(v) < 0.6 ? "i" : null;
    const half = 2.4 * Math.sin(Math.PI * Math.min(1, (u - 0.2) / 0.8)) ** 0.5;
    if (Math.abs(v) > half) return null;
    if (Math.abs(v) < 0.55) return "i";
    if (v < 0 && u > 0.55 && u < 0.62) return null;
    return v < 0 ? (u > 0.6 ? "e" : "d") : "c";
  });
  const glints: Pt[] = [[3, 9], [26, 9], [26, 24], [3, 24]];
  const frames = glints.map(([gx, gy]) => {
    const g = paint(gx - 1, gy - 1, 3, 3, (x, y) => (x === gx && y === gy ? "F" : x === gx || y === gy ? "M" : null), false);
    return [groundShadow(XW / 2, XH - 2, 13, 2), box, trim, feather, g];
  });
  const crateParts: Record<string, Part> = {};
  const out: Frame[] = frames.map((bits, f) => ({
    ms: 450,
    layers: bits.map((b, n): Layer => {
      crateParts[`f${f}p${n}`] = b.part;
      return { part: `f${f}p${n}`, x: b.at[0], y: b.at[1] };
    }),
  }));
  return { id: "shop-birdie-crate", name: "Birdie's shop: crate", w: XW, h: XH, foot: [XW / 2, XH - 2], palette: CRATE_PALETTE, parts: crateParts, anims: { idle: { loop: true, frames: out } } };
})();
PIECES.crate = SHOP_BIRDIE_CRATE;
LAYOUT.push({ name: "crate", col: 5, row: 4, solid: false }); // on the run (see SHOP_BIRDIE_CRATE_AT): its place is the counter's

/** Every piece's place: the floor tiles first, then the upright ones by row, in the art's order within a row. */
export const SHOP_BIRDIE_ROOM_LAYOUT: readonly ShopPlace[] = LAYOUT;
export const SHOP_BIRDIE_ROOM_PIECES: Readonly<Record<string, Character>> = PIECES;
/** No deep piece: everything stands up at its foot. */
export const SHOP_BIRDIE_UPRIGHT: readonly string[] = [];
/** The table's flat top (ShopRoom: the renderer's slab and board over its leg, no pieces, as the room stands). */
export const SHOP_BIRDIE_TABLE_TOP = { piece: "match-table", palette: SHOP_BIRDIE_TABLE_PALETTE } as const;
/** The battle spot's marks: the boss west of the west stool, you east of the east one (as every room's: the boss on the left). */
export const SHOP_BIRDIE_MARKS = { boss: [TABLE_COL - 2, TABLE_ROW], you: [TABLE_COL + 2, TABLE_ROW] } as const;
/** The Shopkeeper's squares (inside the U, behind the run), and where you talk to him: the floor past the run's stools. */
export const SHOP_BIRDIE_KEEPER = [{ c: 6, r: 3 }, { c: 7, r: 3 }] as const;
export const SHOP_BIRDIE_TALK_AT = [{ c: 6, r: 6 }, { c: 7, r: 6 }] as const;

// ---- Its lights: the floor lamps' and the sconces' glow; the pools under the lamps, at the table and at the door.

const placesOf = (name: string) => LAYOUT.filter((p) => p.name === name);
/** A piece's picture's top-left in the art's pixels, standing at `p`. */
const picAt = (p: ShopPlace) => {
  const ch = PIECES[p.name]!;
  return { x: artX(p.col + ((p.w ?? 1) - 1) / 2) - ch.foot[0], y: artY(p.row) - ch.foot[1] };
};
/** The pieces made from an art part (its every place's), and each one's picture's top-left. */
const piecesOf = (base: string) => Object.keys(PIECES).filter((n) => n === base || n.startsWith(`${base}-`) && /^\d+$/.test(n.slice(base.length + 1)));
const glow = (name: string, ax: number, ay: number, halo: number): LightSpot & { piece: string } => {
  const at = picAt(placesOf(name)[0]!);
  return { piece: name, x: ax - at.x - 2, y: ay - at.y - 2, w: 4, h: 4, color: "#ffe2a0", strength: 0.55, halo };
};
/** Where a part is drawn in a piece, in the art's pixels (its first layer of that part). */
const partAt = (name: string, part: string) => {
  const at = picAt(placesOf(name)[0]!);
  const l = PIECES[name]!.anims.idle!.frames[0]!.layers.find((q) => q.part === part)!;
  return { x: at.x + l.x, y: at.y + l.y };
};
/** The board's piece and the box its flaps fill, in its picture's pixels (the game writes them: shops/flap-board.ts). */
const boardAt = partAt("board", "flap-board");
const boardPic = picAt(placesOf("board")[0]!);
/** The art's board (140 x 74): its flaps' box (inside its dark face, y 12 to 71), its header strip (y 3 to 11) and the gap under it. */
export const SHOP_BIRDIE_BOARD_BOX = { x: 6, y: 15, w: 128, h: 52 } as const;
const HEADER = 9;
const HEADER_GAP = 3;
export const SHOP_BIRDIE_FLAPS = {
  piece: "board",
  box: { x: boardAt.x - boardPic.x + SHOP_BIRDIE_BOARD_BOX.x, y: boardAt.y - boardPic.y + SHOP_BIRDIE_BOARD_BOX.y, w: SHOP_BIRDIE_BOARD_BOX.w, h: SHOP_BIRDIE_BOARD_BOX.h },
} as const;
export const SHOP_BIRDIE_ROOM_LIGHTS: readonly (LightSpot & { piece: string })[] = [
  // (A lamp's bulb under its shade: the art's part's (10, 12).)
  ...piecesOf("lamp").map((n) => {
    const a = partAt(n, "lamp");
    return glow(n, a.x + 10, a.y + 12, 22);
  }),
  // (A sconce's: under its shade, (8, 15).)
  ...piecesOf("sconce").map((n) => {
    const a = partAt(n, "sconce");
    return glow(n, a.x + 8, a.y + 15, 14);
  }),
];
const pool = (name: string, ax: number, ay: number, rx: number, ry: number, color: string, strength: number): LightPool & { piece: string } => {
  const at = picAt(placesOf(name)[0]!);
  return { piece: name, x: ax - at.x, y: ay - at.y, rx, ry, color, strength };
};
const door = placesOf("door")[0]!;
export const SHOP_BIRDIE_ROOM_POOLS: readonly (LightPool & { piece: string })[] = [
  ...piecesOf("lamp").map((n) => {
    const p = placesOf(n)[0]!;
    return pool(n, artX(p.col), artY(p.row) + 12, 30, 14, "#ffe2a0", 0.25);
  }),
  pool("match-table", artX(TABLE_COL), artY(TABLE_ROW), 44, 26, "#ffe2a0", 0.2),
  pool("door", door.col * T + T, rowY(door.row) - 10, 42, 22, "#fff8e2", 0.25),
];

// ---- The split-flap board (flap-board.ts): over the art's header strip and its flaps, written by the game.

/** The board as the room shows it: made as the room loads (ShopRoom's `flaps`), its stops this town's buildings (never the walk-up). */
export function birdieFlaps(now: number) {
  const box = SHOP_BIRDIE_FLAPS.box;
  const ink: FlapInk = { flap: P.m!, flapLit: P.n!, split: P.M!, letter: "#f4efe2", status: P.y!, header: P.y!, headerInk: P.k! };
  const board = new FlapBoard({ w: box.w, header: HEADER, gap: HEADER_GAP, h: box.h }, ink, boardStops(HOMES.map((h) => h.id)), Math.floor(now) ^ 0x5eed, now);
  return { piece: SHOP_BIRDIE_FLAPS.piece, x: box.x, y: box.y - HEADER - HEADER_GAP, w: box.w, h: HEADER + HEADER_GAP + box.h, board };
}
