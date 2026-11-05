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
  facing: "S" | "W";
  street: string;
  name: string;
  inset: number;
  depth: number;
  /** A home's door square (the sidewalk square before its door), its boss's rest square, and its boss's wander box. */
  door?: { c: number; r: number };
  rest?: { c: number; r: number };
  wander?: SqBox;
}
export const STREET_LOTS: readonly StreetLot[] = PLAN.lots as StreetLot[];
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
export const STREET_PROPS: readonly StreetProp[] = PLAN.props as StreetProp[];

/** The park (the plus): its first column, its north row, its size. Its 12 tables (stools west and east of each) and the fountain's four squares. */
export const STREET_PARK = { c0: PLAN.park.c0, r1: PLAN.park.r1, w: PLAN.park.w, d: PLAN.park.d } as const;
export const STREET_TABLES: readonly { c: number; r: number }[] = PLAN.park.tables;
export const STREET_FOUNTAIN: readonly { c: number; r: number }[] = PLAN.park.fountain;

/** Where you start: on the promenade just south of the fountain, facing north up it. */
export const STREET_START = { c: PLAN.start.c, r: PLAN.start.r } as const;

/** The streets, with the way the camera faces on each (degrees from north: Seam Avenue faces east, round 3's turn). */
export const STREET_STREETS: readonly { id: string; name: string; axis: string; c0: number; c1: number; r0: number; r1: number; cam: number }[] = PLAN.streets;
