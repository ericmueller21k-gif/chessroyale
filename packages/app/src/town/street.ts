/**
 * The street town's plan (Nov 5; code round 2, the layout): the town Eric approved (streets of the chessboard with sidewalks,
 * the lots and their buildings, the back gardens, the plus-shaped park, the Colosseum in its grove), read from
 * `street-plan.json`: the art's `town-plan-nov5.json` (claude/boss-art 11a4d903; its doc is scripts/boss-art/out/town-plan-nov5.md
 * there) as round 4 reshaped it (scripts/street-plan-north.py: the Colosseum at the north edge, a closing row along the south edge).
 * Data only: world.ts builds the town's world from it (everyone's town since Nov 13), and render.ts draws it.
 *
 * Squares are (c, r): c west to east, r south to north, wrapping east-west only (round 4: the plan's `wrap`; camera.ts WRAP); a
 * position (x, y) is in squares, a square's middle at whole numbers.
 */
import PLAN from "./street-plan.json" with { type: "json" };
import { adminFirst } from "@chessroyale/core";
import { ADMIN_TOWN } from "./admin-town.ts";
import { N } from "./camera.ts";
import type { Design } from "./buildings.ts";
import type { LookSpec } from "./lookalike.ts";
import type { WallSpec } from "./wall.ts";
import { layRow, ROW_PX, ROW_SIDES, type Facing, type RowHome, type RowSide } from "./rows.ts";
import type { HomeId } from "./home-boxes.ts";
import { CAVEA, PORTAL_DEPTH, RING } from "./houses/coliseum-shape.ts";

/**
 * A square's ground in the plan: the streets (the board), paving (sidewalks, the park's walks, the plaza), the park's lawns, gardens (and
 * the meadow behind the back wall), a lot under a building, the Colosseum, and (the north edge round) a wall's or a plinth's square on the
 * plaza: paved, not walked on, and not in the way of a look (seen.ts stops at lots only).
 */
export const STREET_GROUND_KEY = { "#": 0, "=": 1, ",": 2, g: 3, L: 4, A: 5, W: 6 } as const;

/** Each square's ground (index r * N + c), as the plan's letters say (STREET_GROUND_KEY's numbers). */
export const STREET_GROUND = new Uint8Array(N * N);
PLAN.ground.forEach((line, r) => {
  for (let c = 0; c < N; c++) STREET_GROUND[r * N + c] = STREET_GROUND_KEY[line[c] as keyof typeof STREET_GROUND_KEY];
});

/** A box in squares (a boss's wander box): x0..x1 across, y0..y1 along (its foot stays inside). */
export interface SqBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/**
 * A lot and what stands on it: a boss's home (`home`), an everyday building on a street's row (`house`) or a bigger one behind
 * the rows (`tall`). Its squares are c0..c0 + w - 1 across and r0..r0 + d - 1 deep; its front faces south (`S`, onto an
 * east-west street, on row r0's south edge) or west (`W`, onto Seam Avenue, on column c0's west edge). Its front picture stands on
 * its front line, the lot's front edge plus `inset` squares, centred on the lot.
 */
export interface StreetLot {
  kind: "home" | "house" | "tall" | "wall" | "ring" | "portal";
  /** A home's id (the art's: "blitz" is the game's "dash"), or an everyday building's design. */
  id: string;
  /** The colourway (0..2). */
  v: number;
  c0: number;
  r0: number;
  w: number;
  d: number;
  facing: Facing;
  street: string;
  name: string;
  inset: number;
  depth: number;
  /** A home's door square (the sidewalk square before its door), its boss's rest square, and its boss's wander box. */
  door?: { c: number; r: number };
  rest?: { c: number; r: number };
  wander?: SqBox;
  /** A row's look-alike front (round 4, rows.ts): its recipe, and its front line's middle (world), exact to the pixel. */
  look?: LookSpec;
  at?: { x: number; y: number };
  /** A home slid along its row to fit (squares east): its lot, door and wander box stay; its picture moves (rows.ts layRow). */
  shift?: number;
  /** (Round 5) The back wall's and the plaza's walls' recipe (wall.ts). */
  wall?: WallSpec;
  /** (The north edge round) A stretch of the Colosseum's ring (houses/coliseum-ring.ts RING): its number, its front's way along (world). */
  ring?: number;
  dir?: { ux: number; uy: number };
}

/** Where along a row side square coordinate `a` is: itself, or once round (a row running over the east-west wrap: a1 past N), or null. */
const alongIn = (s: RowSide, a: number): number | null => (a > s.a0 && a < s.a1 ? a : a + N > s.a0 && a + N < s.a1 ? a + N : null);
/** Is square (c, r) inside a row side's lots? */
const inRow = (c: number, r: number) =>
  ROW_SIDES.find((s) => {
    const [a, d] = s.facing === "S" || s.facing === "N" ? [c, r] : [r, c];
    return alongIn(s, a) !== null && d >= Math.min(s.d0, s.d1) && d <= Math.max(s.d0, s.d1);
  }) ?? null;
/** The homes anchoring row side `side`: the plan's homes on its lots, facing its way, where along it each lot begins. */
export function homesOn(side: RowSide, lots: readonly StreetLot[] = PLAN.lots as StreetLot[]): RowHome[] {
  const across = side.facing === "S" || side.facing === "N";
  return lots
    .filter((l) => l.kind === "home" && l.facing === side.facing && inRow(l.c0, l.r0) === side)
    .map((l) => ({ id: l.id as HomeId, a: alongIn(side, across ? l.c0 : l.r0)!, w: l.w }));
}
/**
 * The rows (round 4, rows.ts) over the plan: on each row side, the plan's everyday buildings go (its homes stay, anchoring the row) and
 * look-alike fronts fill the row from corner to corner; the ground under a row is a lot's, and the garden things it covers go.
 */
function withRows(lots: StreetLot[]): StreetLot[] {
  const covered = (l: StreetLot) => {
    for (let dc = 0; dc < (l.facing === "S" || l.facing === "N" ? l.w : l.d); dc++)
      for (let dr = 0; dr < (l.facing === "S" || l.facing === "N" ? l.d : l.w); dr++) if (inRow(l.c0 + dc, l.r0 + dr)) return true;
    return false;
  };
  // (A row replaces the everyday buildings it covers; a bigger one behind the rows that a row now covers goes too: Seam Avenue's.)
  const out = lots.filter((l) => l.kind === "home" || !covered(l)).map((l) => ({ ...l }));
  for (const side of ROW_SIDES) {
    const across = side.facing === "S" || side.facing === "N";
    for (const p of layRow(side, homesOn(side, out))) {
      if (p.kind === "home") {
        const lot = out.find((l) => l.kind === "home" && l.id === p.home)!;
        if (p.shift) lot.shift = p.shift;
        continue;
      }
      // (Its middle in the world: a row over the wrap brought back into [0, N).)
      const mid = (((p.s0 + p.s1) / 2) % N + N) % N;
      const line = side.facing === "S" || side.facing === "W" ? side.d0 - 0.5 + side.inset : side.d0 + 0.5 - side.inset;
      const a0 = Math.floor(mid - (p.s1 - p.s0) / 2 + 0.5);
      const w = Math.max(1, Math.round(p.s1 - p.s0));
      const d0 = Math.min(side.d0, side.d1);
      out.push({
        kind: "house", id: "look", v: 0, c0: across ? a0 : d0, r0: across ? d0 : a0, w, d: 3, facing: side.facing, street: side.street,
        name: "Look-alike front", inset: side.inset, depth: p.look!.depth, look: p.look, at: across ? { x: mid, y: line } : { x: line, y: mid },
      });
    }
  }
  // The skyline (round 4): the bigger buildings behind the rows, towers of look-alike parts taller than any row (6 to 9 floors), windows
  // on every side; their sky shows over them. Each keeps its lot.
  out.forEach((l, i) => {
    // (Round 5: a wall's front line: its lot's front edge plus its inset, centred along its lot.)
    if (l.kind === "wall") l.at = { x: l.c0 + l.w / 2 - 0.5, y: l.r0 - 0.5 + l.inset };
    if (l.kind !== "tall") return;
    const tower = l.id === "tower";
    const seed = 7001 + i * 97;
    l.look = { seed, w: Math.round(l.w * ROW_PX), tall: 2, floors: (tower ? 8 : 6) + (seed % 3), corner: null, depth: l.depth, px: ROW_PX, free: true, flat: false };
    l.at = { x: l.c0 + l.w / 2 - 0.5, y: l.r0 - 0.5 + l.inset };
  });
  return out;
}
/**
 * The Colosseum (the north edge round): its portal on the plaza's back line (its own box, the Colosseum's place's: houses/index.ts), and
 * the stretches of its ring round the oval, each a box facing out (houses/coliseum-ring.ts). Their squares are the Colosseum's ground.
 */
function colosseumLots(): StreetLot[] {
  const C = PLAN.coliseum;
  const portal: StreetLot = {
    kind: "portal", id: "portal", v: 0, c0: C.c0 + C.size / 2 - 3, r0: C.r0, w: 5, d: 1, facing: "S", street: "plaza", name: "The Colosseum",
    inset: 0, depth: PORTAL_DEPTH, at: { x: C.c0 + (C.size - 1) / 2, y: C.r0 - 0.5 },
  };
  return [
    portal,
    ...RING.map((s): StreetLot => ({
      kind: "ring", id: `ring-${s.k}`, v: 0, c0: Math.round(s.mx), r0: Math.round(s.my), w: 1, d: 1, facing: s.facing, street: "plaza",
      name: "The Colosseum", inset: 0, depth: CAVEA, at: { x: s.mx, y: s.my }, ring: s.k, dir: { ux: s.ux, uy: s.uy },
    })),
  ];
}
/**
 * Whether a lot is in this town: every one in an admin's; a home whose boss is in the game for admins first (core's BOSS_ADMIN_FIRST:
 * Timber's, Dash's, Rolling Dough) in an admin's only (world.ts HOMES). Anyone else's town leaves its lot out before the rows are laid,
 * so its row fills the place with look-alike fronts, as anywhere else along it (Nov 13: no half-built home for a player).
 */
const lotHere = (l: StreetLot): boolean => l.kind !== "home" || ADMIN_TOWN || !adminFirst({ id: l.id === "blitz" ? "dash" : l.id });
export const STREET_LOTS: readonly StreetLot[] = [...withRows((PLAN.lots as StreetLot[]).filter(lotHere)), ...colosseumLots()];
/** The squares under a row (1): a lot's (not walked on), drawn paved, the sidewalk running up to the fronts (no lawn before a row). */
export const ROW_GROUND = new Uint8Array(N * N);
for (let r = 0; r < N; r++)
  for (let c = 0; c < N; c++)
    if (inRow(c, r)) {
      STREET_GROUND[r * N + c] = STREET_GROUND_KEY.L;
      ROW_GROUND[r * N + c] = 1;
    }
/** The everyday buildings (on the rows and behind them), each with its design. */
export const STREET_BUILDINGS = STREET_LOTS.filter((l) => l.kind !== "home" && l.kind !== "portal") as readonly (StreetLot & { id: Design })[];
/** The homes' lots in this town (lotHere), by the art's home id. */
export const STREET_HOMES = STREET_LOTS.filter((l) => l.kind === "home") as readonly (StreetLot & { door: { c: number; r: number }; rest: { c: number; r: number }; wander: SqBox })[];
/** Every home's lot as the plan has it, in this town or not (world.ts ALL_HOMES: a home not in this town keeps its plan's place, unused). */
export const PLAN_HOMES = (PLAN.lots as StreetLot[]).filter((l) => l.kind === "home") as unknown as typeof STREET_HOMES;

/** Something standing in the plan: a park thing (tree, bench, lamp, table, the fountain) or a garden's (hedge, bush, bed, shed). */
export interface StreetProp {
  kind: "tree" | "bench" | "lamp" | "table" | "fountain" | "hedge" | "bush" | "bed" | "shed" | "piece" | "statue";
  /** Where its foot stands (a hedge's: the back of its top; the fountain's: the middle of its front edge). */
  x: number;
  y: number;
  v: number;
}
export const STREET_PROPS: readonly StreetProp[] = (PLAN.props as StreetProp[]).filter((p) => !(p.kind !== "lamp" && inRow(Math.round(p.x), Math.round(p.y))));

/** The park (the plus): its first column, its north row, its size. Its 12 tables (stools west and east of each) and the fountain's four squares. */
export const STREET_PARK = { c0: PLAN.park.c0, r1: PLAN.park.r1, w: PLAN.park.w, d: PLAN.park.d } as const;
export const STREET_TABLES: readonly { c: number; r: number }[] = PLAN.park.tables;
export const STREET_FOUNTAIN: readonly { c: number; r: number }[] = PLAN.park.fountain;

/** Where you start: on the promenade just south of the fountain, facing north up it. */
export const STREET_START = { c: PLAN.start.c, r: PLAN.start.r } as const;

/** Which ways the town wraps (round 4, Eric's call): east-west (one switch, Eric may close it later) and north-south (no). */
export const STREET_WRAP: { readonly ew: boolean; readonly ns: boolean } = PLAN.wrap;
/** The Colosseum: its first column and row, its size (at the north edge, its top row the world's last). */
export const STREET_COLISEUM = { c0: PLAN.coliseum.c0, r0: PLAN.coliseum.r0, size: PLAN.coliseum.size } as const;

/** The streets, with the way the camera faces on each (degrees from north: Seam Avenue faces east, round 3's turn). */
export const STREET_STREETS: readonly { id: string; name: string; axis: string; c0: number; c1: number; r0: number; r1: number; cam: number }[] = PLAN.streets;

