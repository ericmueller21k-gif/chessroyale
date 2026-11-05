/**
 * The street town's plan (Nov 5; code round 2, the layout): the town Eric approved (streets of the chessboard with sidewalks,
 * the lots and their buildings, the back gardens, the plus-shaped park, the Colosseum in its grove), read from
 * `street-plan.json`, the art's `town-plan-nov5.json` copied as made (claude/boss-art 11a4d903; its doc is
 * scripts/boss-art/out/town-plan-nov5.md there). Data only: world.ts builds the street town's world from it when STREET_TOWN
 * is on (admins only until round 3), and render.ts draws it.
 *
 * Squares are (c, r): c west to east, r south to north, wrapping (world.ts's way); a position (x, y) is in squares, a
 * square's middle at whole numbers.
 */
import PLAN from "./street-plan.json" with { type: "json" };
import { N } from "./camera.ts";
import type { Design } from "./buildings.ts";
import type { LookSpec } from "./lookalike.ts";
import { layRow, ROW_DEPTH, ROW_INSET, ROW_SIDES, type Facing, type RowHome } from "./rows.ts";
import type { HomeId } from "./home-boxes.ts";

/** A square's ground in the plan: the streets (the board), paving (sidewalks, the park's walks, the apron), the park's lawns, gardens (and the grove), a lot under a building, the Colosseum. */
export const STREET_GROUND_KEY = { "#": 0, "=": 1, ",": 2, g: 3, L: 4, A: 5 } as const;

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
  kind: "home" | "house" | "tall";
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
}

/** Is square (c, r) inside a row side's lots? */
const inRow = (c: number, r: number) =>
  ROW_SIDES.find((s) => {
    const [a, d] = s.facing === "S" || s.facing === "N" ? [c, r] : [r, c];
    return a > s.a0 && a < s.a1 && d >= Math.min(s.d0, s.d1) && d <= Math.max(s.d0, s.d1);
  }) ?? null;
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
  const out = lots.filter((l) => l.kind !== "house" || !covered(l));
  for (const side of ROW_SIDES) {
    const across = side.facing === "S" || side.facing === "N";
    const homes: RowHome[] = out
      .filter((l) => l.kind === "home" && l.facing === side.facing && inRow(l.c0, l.r0) === side)
      .map((l) => ({ id: (l.id === "blitz" ? "blitz" : l.id) as HomeId, a: across ? l.c0 : l.r0, w: l.w }));
    for (const p of layRow(side, homes)) {
      if (p.kind !== "look") continue;
      const mid = (p.s0 + p.s1) / 2;
      const line = side.facing === "S" || side.facing === "W" ? side.d0 - 0.5 + ROW_INSET : side.d0 + 0.5 - ROW_INSET;
      const a0 = Math.floor(p.s0 + 0.5);
      const w = Math.max(1, Math.round(p.s1 - p.s0));
      const d0 = Math.min(side.d0, side.d1);
      out.push({
        kind: "house", id: "look", v: 0, c0: across ? a0 : d0, r0: across ? d0 : a0, w, d: 3, facing: side.facing, street: side.street,
        name: "Look-alike front", inset: ROW_INSET, depth: ROW_DEPTH, look: p.look, at: across ? { x: mid, y: line } : { x: line, y: mid },
      });
    }
  }
  return out;
}
export const STREET_LOTS: readonly StreetLot[] = withRows(PLAN.lots as StreetLot[]);
/** The squares under a row (1): a lot's (not walked on), drawn paved, the sidewalk running up to the fronts (no lawn before a row). */
export const ROW_GROUND = new Uint8Array(N * N);
for (let r = 0; r < N; r++)
  for (let c = 0; c < N; c++)
    if (inRow(c, r)) {
      STREET_GROUND[r * N + c] = STREET_GROUND_KEY.L;
      ROW_GROUND[r * N + c] = 1;
    }
/** The everyday buildings (on the rows and behind them), each with its design. */
export const STREET_BUILDINGS = STREET_LOTS.filter((l) => l.kind !== "home") as readonly (StreetLot & { id: Design })[];
/** The homes' lots, by the art's home id. */
export const STREET_HOMES = STREET_LOTS.filter((l) => l.kind === "home") as readonly (StreetLot & { door: { c: number; r: number }; rest: { c: number; r: number }; wander: SqBox })[];

/** Something standing in the plan: a park thing (tree, bench, lamp, table, the fountain) or a garden's (hedge, bush, bed, shed). */
export interface StreetProp {
  kind: "tree" | "bench" | "lamp" | "table" | "fountain" | "hedge" | "bush" | "bed" | "shed";
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

/** The streets, with the way the camera faces on each (degrees from north: Seam Avenue faces east, round 3's turn). */
export const STREET_STREETS: readonly { id: string; name: string; axis: string; c0: number; c1: number; r0: number; r1: number; cam: number }[] = PLAN.streets;

/**
 * Whether the Colosseum shows from (x, y) (Nov 5, round 4; Eric: "you won't actually be able to see the Colosseum unless you're like
 * running towards it"): the rows hide it, so it shows only down a street or across a square that opens onto it. True when a straight line
 * from (x, y) reaches some square of its outline without crossing a lot (a row's or a home's). Worked out once a square (cached).
 */
const COL = PLAN.coliseum;
const colTargets: { x: number; y: number }[] = [];
for (let i = 0; i < COL.size; i++) {
  colTargets.push({ x: COL.c0 + i, y: COL.r0 }, { x: COL.c0 + i, y: COL.r0 + COL.size - 1 });
  if (i > 0 && i < COL.size - 1) colTargets.push({ x: COL.c0, y: COL.r0 + i }, { x: COL.c0 + COL.size - 1, y: COL.r0 + i });
}
const seenCache = new Map<number, boolean>();
export function colosseumSeen(x: number, y: number): boolean {
  const c0 = ((Math.round(x) % N) + N) % N;
  const r0 = ((Math.round(y) % N) + N) % N;
  const key = r0 * N + c0;
  const hit = seenCache.get(key);
  if (hit !== undefined) return hit;
  const L = STREET_GROUND_KEY.L;
  let seen = false;
  for (const t of colTargets) {
    let dx = t.x - c0;
    let dy = t.y - r0;
    dx -= N * Math.round(dx / N);
    dy -= N * Math.round(dy / N);
    const n = Math.ceil(Math.hypot(dx, dy) * 4);
    let open = true;
    for (let k = 1; k < n; k++) {
      const c = ((Math.round(c0 + (dx * k) / n) % N) + N) % N;
      const r = ((Math.round(r0 + (dy * k) / n) % N) + N) % N;
      if (c === c0 && r === r0) continue;
      if (STREET_GROUND[r * N + c] === L) {
        open = false;
        break;
      }
    }
    if (open) {
      seen = true;
      break;
    }
  }
  seenCache.set(key, seen);
  return seen;
}
