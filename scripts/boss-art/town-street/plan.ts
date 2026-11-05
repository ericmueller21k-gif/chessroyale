/**
 * The street town (Nov 5 mockup, Eric's direction): a plan of the same 46 x 46 world that wraps, for the mockups only (the
 * overhead plan, plan-map.ts, and the street views, view.ts). Nothing here is game code: the game's world.ts would get its
 * own version once Eric picks.
 *
 * Squares (c, r): c 0..45 west to east, r 0..45 south to north (world.ts's way: the camera looks north, r rising).
 *
 * The rule that shapes everything: the camera looks across a street at the row of buildings on its far side, so it always
 * sees fronts. Every east-west street looks north (its far row faces south); the one north-south street, Seam Avenue,
 * looks east (its far row faces west). So every block has its fronts on its south side (and on Seam Avenue, its west
 * side), and its back gardens on the north. The near side of a street (between the camera and you) is the back of the next
 * block: gardens, hedges and lamps, nothing tall.
 */

export const N = 46;
export const wrap = (v: number): number => ((v % N) + N) % N;
/** Into [-N/2, N/2): the shortest way round. */
export const wrapF = (v: number): number => ((((v + N / 2) % N) + N) % N) - N / 2;

// ---- Ground.
export const BOARD = 0; // the chessboard: the streets
export const PAVE = 1; // sidewalks, the park's walks, the Colosseum's apron
export const GRASS = 2; // the park's lawns
export const GARDEN = 3; // back gardens and the Colosseum's grove
export const LOT = 4; // under a building
export const ARENA = 5; // the Colosseum's own ground
export const ground = new Uint8Array(N * N).fill(GARDEN);
const at = (c: number, r: number) => wrap(r) * N + wrap(c);
const fill = (c0: number, c1: number, r0: number, r1: number, g: number) => {
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) ground[at(c, r)] = g;
};

/** The camera's heading on a street: 0 north (east-west streets, the park, the plaza), 90 east (Seam Avenue). */
export interface Street {
  id: string;
  name: string;
  axis: "EW" | "NS";
  /** Its board squares (inclusive; c or r ranges may run past 45 and wrap). */
  c0: number;
  c1: number;
  r0: number;
  r1: number;
  /** Which way the camera faces on it (degrees: 0 north, 90 east). */
  cam: 0 | 90;
}
export const STREETS: readonly Street[] = [
  { id: "seam-st", name: "Seam Street", axis: "EW", c0: 0, c1: 45, r0: 44, r1: 47, cam: 0 },
  { id: "fountain-st", name: "Fountain Street", axis: "EW", c0: 33, c1: 58, r0: 13, r1: 16, cam: 0 },
  { id: "colosseum-row", name: "Colosseum Row", axis: "EW", c0: 0, c1: 45, r0: 21, r1: 24, cam: 0 },
  { id: "upper-st", name: "Upper Street", axis: "EW", c0: 33, c1: 58, r0: 30, r1: 33, cam: 0 },
  { id: "seam-ave", name: "Seam Avenue", axis: "NS", c0: 44, c1: 47, r0: 0, r1: 45, cam: 90 },
];

// ---- The park (the plus): 20 across (c 13..32), 12 deep (r 9..20). A row a line from north to south, a square a letter:
// `=` paving, `.` grass, `t` a tree, `b` a bench (on grass), `T` a chess table with its stools `s` either side, `F` the
// fountain (2 x 2; `f` its other squares), `L` a lamp (on paving). The promenade (4 wide) runs north to south; the new walk
// (4 wide) crosses it east to west through the fountain; three tables in each lawn, tucked into the walks' edges.
export const PARK = { c0: 13, r1: 20, w: 20, d: 12 } as const;
export const PARK_PLAN = [
  "L======L====L======L",
  "=.t..sTs====sTs..t.=",
  "=t..b...====...b..t=",
  "LsTs.sTs====sTs.sTsL",
  "====================",
  "=========Ff=========",
  "=========ff=========",
  "====================",
  "LsTs.sTs====sTs.sTsL",
  "=t..b...====...b..t=",
  "=.t..sTs====sTs..t.=",
  "L======L====L======L",
] as const;

export interface Prop {
  kind: "tree" | "bench" | "fountain" | "table" | "lamp" | "hedge" | "bush" | "shed" | "bed";
  /** Where its picture's foot stands (squares). */
  x: number;
  y: number;
  v: number;
}
export const PROPS: Prop[] = [];
export const TABLES: { c: number; r: number }[] = [];
/** The fountain's four squares (it stands on them). */
export const FOUNTAIN: { c: number; r: number }[] = [];

// ---- Sidewalks, then the streets' board over them where they cross.
// Seam Street's (r 43 and 2) and Seam Avenue's (c 43 and 2) all the way round; Fountain Street's (r 12 and 17), Colosseum
// Row's north one (r 25) and Upper Street's (r 29 and 34) outside the middle (the park and the Colosseum's grove).
fill(0, 45, 43, 43, PAVE);
fill(0, 45, 2, 2, PAVE);
fill(43, 43, 0, 45, PAVE);
fill(2, 2, 0, 45, PAVE);
for (const r of [12, 17, 25, 29, 34]) fill(33, 58, r, r, PAVE);
for (const s of STREETS) fill(s.c0, s.c1, s.r0, s.r1, BOARD);

// ---- The park: its plan over the middle (the new walk is Fountain Street's stretch through it).
PARK_PLAN.forEach((line, v) => {
  const r = PARK.r1 - v;
  for (let u = 0; u < PARK.w; u++) {
    const ch = line[u]!;
    const c = PARK.c0 + u;
    ground[at(c, r)] = ".tb".includes(ch) ? GRASS : PAVE;
    if (ch === "t") PROPS.push({ kind: "tree", x: c, y: r, v: (u * 7 + v * 3) % 3 });
    if (ch === "b") PROPS.push({ kind: "bench", x: c, y: r, v: 0 });
    if (ch === "L") PROPS.push({ kind: "lamp", x: c, y: r, v: 0 });
    if (ch === "T") (PROPS.push({ kind: "table", x: c, y: r, v: 0 }), TABLES.push({ c, r }));
    if (ch === "F") PROPS.push({ kind: "fountain", x: c + 0.5, y: r - 1.5, v: 0 });
    if (ch === "F" || ch === "f") FOUNTAIN.push({ c, r });
  }
});
// The park's south walk out to Seam Street (South Lane: paving, c 21..24, r 3..8).
fill(21, 24, 3, 8, PAVE);

// ---- The Colosseum (as today: 12 x 12 at c 17..28, r 28..39; its gate faces south over its apron, r 25..27) in its own grove:
// trees round its sides and back, so it is only ever seen from the south (the park, the plaza, Colosseum Row), front on.
export const COLISEUM = { c0: 17, r0: 28, size: 12 } as const;
fill(17, 28, 28, 39, ARENA);
fill(13, 32, 25, 25, PAVE);
fill(17, 28, 25, 27, PAVE);
export const STATUES = [
  { c: 17, r: 27 },
  { c: 28, r: 27 },
];

// ---- Buildings.
import type { HomeId } from "../out/town-buildings/home-boxes.ts";
import type { Design } from "../out/town-buildings/buildings.ts";
import { HOME_DOOR_PX } from "../out/town-buildings/home-boxes.ts";
import { HOUSES } from "../../../packages/app/src/town/houses/index.ts";
/** Each home's sign's middle on its front (px); Timber's and Dash's drafts have none yet. */
const SIGN_MID_PX: Partial<Record<HomeId, number>> = Object.fromEntries(Object.entries(HOUSES).map(([k, h]) => [k, h.sign.x + h.sign.w / 2]));
export type { HomeId, Design };
export type Facing = "S" | "W";
export interface Lot {
  /** A boss home, an everyday front-row building, or a bigger one standing behind. */
  kind: "home" | "house" | "tall";
  id: HomeId | Design;
  /** Its colourway (an everyday design's: 0..2, buildings.ts COLOURWAYS). */
  v: number;
  /** Its ground: first column and row (its south-west square), across and deep, in squares along the street and away from it. */
  c0: number;
  r0: number;
  w: number;
  d: number;
  facing: Facing;
  /** Which street its front is on. */
  street: string;
  /** An exposed side wall on Seam Avenue (a corner lot's west side). */
  side?: boolean;
}
export const LOTS: Lot[] = [];
/** A row of buildings facing south onto an east-west street: their fronts on row `front` (the first row of the lots). */
function rowS(street: string, front: number, c: number, items: readonly (readonly [Lot["kind"], Lot["id"], number, number?])[], d = 3) {
  for (const [kind, id, w, v = 0] of items) {
    LOTS.push({ kind, id, v, c0: c, r0: front, w, d, facing: "S", street, side: wrap(c) === 3 });
    c += w;
  }
}
/** A row facing west onto Seam Avenue: fronts on column 3, from row `r` northward. */
function rowW(r: number, items: readonly (readonly [Lot["kind"], Lot["id"], number, number?])[]) {
  for (const [kind, id, w, v = 0] of items) {
    LOTS.push({ kind, id, v, c0: 3, r0: r, w, d: 3, facing: "W", street: "seam-ave" });
    r += w;
  }
}

// Seam Street (the Gallery quarter): fronts on r 3, 18 squares either side of South Lane.
rowS("seam-st", 3, 3, [
  ["house", "bakery", 3, 0],
  ["house", "townhouse", 2, 1],
  ["home", "gardener", 4],
  ["house", "skinny", 3, 0],
  ["house", "shop", 2, 1],
  ["home", "smudgy", 4],
]);
rowS("seam-st", 3, 25, [
  ["home", "folio", 4],
  ["house", "townhouse", 2, 2],
  ["house", "flats", 3, 0],
  ["home", "alfil", 6],
  ["house", "cottage", 3, 1],
]);
// Fountain Street (Fire & Ice): r 18, both sides of the seam.
rowS("fountain-st", 18, 3, [
  ["home", "timber", 4],
  ["house", "townhouse", 2, 0],
  ["home", "sawyer", 4],
]);
rowS("fountain-st", 18, 33, [
  ["home", "gingerbread", 4],
  ["home", "grex", 4],
  ["house", "shop", 2, 2],
]);
// Colosseum Row (the Funfair, either side of the plaza): r 26.
rowS("colosseum-row", 26, 3, [
  ["home", "clown", 4],
  ["house", "shop", 2, 0],
  ["home", "tiger", 4],
]);
rowS("colosseum-row", 26, 33, [
  ["home", "bigboy", 4],
  ["house", "townhouse", 2, 1],
  ["home", "blitz", 4],
]);
// Upper Street (the Meadow): r 35.
rowS("upper-st", 35, 3, [
  ["home", "hopper", 4],
  ["house", "cottage", 2, 2],
  ["home", "pig", 4],
]);
rowS("upper-st", 35, 33, [
  ["home", "moo", 4],
  ["home", "hollow", 4],
  ["house", "skinny", 2, 1],
]);
// Seam Avenue's own fronts (c 3, facing west): between the corner lots.
rowW(6, [
  ["house", "flats", 3, 1],
  ["house", "skinny", 3, 2],
]);
rowW(38, [
  ["house", "cottage", 3, 0],
  ["house", "townhouse", 2, 2],
]);
// The bigger buildings behind the front rows (you can't reach them): behind Seam Street, behind Upper Street.
const tall = (id: Design, c0: number, r0: number, w: number, v: number, street: string) => LOTS.push({ kind: "tall", id, v, c0, r0, w, d: 3, facing: "S", street });
tall("block", 6, 6, 4, 0, "seam-st");
tall("tower", 14, 6, 2, 0, "seam-st");
tall("block", 17, 6, 4, 1, "seam-st");
tall("block", 27, 6, 4, 2, "seam-st");
tall("tower", 33, 6, 2, 1, "seam-st");
tall("block", 38, 6, 4, 0, "seam-st");
tall("block", 6, 38, 4, 1, "upper-st");
tall("tower", 11, 38, 2, 2, "upper-st");
tall("block", 34, 38, 4, 2, "upper-st");
tall("tower", 41, 38, 2, 0, "upper-st");
for (const l of LOTS) for (let i = 0; i < l.w; i++) for (let j = 0; j < l.d; j++) ground[l.facing === "S" ? at(l.c0 + i, l.r0 + j) : at(l.c0 + j, l.r0 + i)] = LOT;

// ---- The grove round the Colosseum (its sides and back), the street ends' hedges, the back gardens' trees and hedges.
for (let r = 26; r <= 42; r += 2) for (const c of [13.5, 15.5, 29.5, 31.5]) PROPS.push({ kind: "tree", x: c, y: r + (c % 4 > 2 ? 1 : 0), v: (r + c) % 3 | 0 });
for (let c = 17.5; c <= 28.5; c += 2) for (const r of [40.5, 42]) PROPS.push({ kind: "tree", x: c, y: r, v: (c | 0) % 3 });
// Lamps along the sidewalks (one every 6 squares on the fronts' side, one every 6 on the near side, offset).
// (Each lamp stands on a whole sidewalk square, the park's lamp; never on a door square: plan-doc.ts checks.)
for (let c = 4; c < 46; c += 6) if (c < 13 || c > 32) for (const r of [12, 17, 25, 29, 34]) PROPS.push({ kind: "lamp", x: c, y: r, v: 0 });
for (let c = 1; c < 46; c += 6) if (c < 20 || c > 25) PROPS.push({ kind: "lamp", x: c, y: 2, v: 0 });
for (let c = 4; c < 46; c += 6) PROPS.push({ kind: "lamp", x: c, y: 43, v: 0 });
for (let r = 4; r < 46; r += 6) PROPS.push({ kind: "lamp", x: 2, y: r, v: 0 }, { kind: "lamp", x: 43, y: r + 3, v: 0 });
// The back gardens' low hedges along the near sidewalks (a hedge prop per square: drawn low, never covering you).
for (let c = 0; c < N; c++) {
  for (const r of [42, 11, 28, 20]) {
    if (ground[at(c, r)] === GARDEN || ground[at(c, r)] === LOT) PROPS.push({ kind: "hedge", x: c, y: r + 0.45, v: c % 3 });
  }
}
for (let r = 0; r < N; r++) if (ground[at(42, r)] === GARDEN || ground[at(42, r)] === LOT) PROPS.push({ kind: "hedge", x: 42.45, y: r, v: r % 3 });
// The back gardens behind the hedges: a flower bed, a bush, now and then a shed (low things only: the near side never covers you).
const gardenSq = (c: number, r: number) => ground[at(c, r)] === GARDEN && !(wrap(c) >= 13 && wrap(c) <= 32 && wrap(r) >= 25);
for (let c = 0; c < N; c++)
  for (let r = 0; r < N; r++) {
    if (!gardenSq(c, r)) continue;
    const h = (c * 7 + r * 13) % 11;
    if (h === 0) PROPS.push({ kind: "shed", x: c, y: r + 0.2, v: (c + r) % 3 });
    else if (h === 3 || h === 7) PROPS.push({ kind: "bed", x: c, y: r, v: (c * 3 + r) % 3 });
    else if (h === 5 || h === 9) PROPS.push({ kind: "bush", x: c + 0.2, y: r - 0.1, v: (c + r) % 3 });
  }

/** Where the camera faces at (c, r): Seam Avenue east (outside its crossings), everywhere else north. */
export function camAt(c: number, r: number): 0 | 90 {
  const cc = wrap(Math.round(c));
  const onAve = cc >= 43 || cc <= 2;
  if (!onAve) return 0;
  const rr = wrap(Math.round(r));
  const crossing = [
    [43, 47],
    [12, 17],
    [21, 25],
    [29, 34],
  ].some(([a, b]) => (rr >= a! && rr <= b!) || (rr + N >= a! && rr + N <= b!));
  return crossing ? 0 : 90;
}

/** Each home's boss and colors (world.ts HOMES; Timber's and Dash's from the plan of today). */
export const HOME_INFO: Record<HomeId, { boss: string; name: string; color: string; theme: string }> = {
  gardener: { boss: "Puddles", name: "Puddles' Botanical Garden", color: "#d6747b", theme: "Gallery" },
  smudgy: { boss: "Smudgy", name: "Smudgy's Art Gallery", color: "#f5832d", theme: "Gallery" },
  folio: { boss: "Folio", name: "Folio's Folded House", color: "#d8432a", theme: "Gallery" },
  alfil: { boss: "Alfil", name: "Alfil's Pyramid", color: "#b4840f", theme: "Gallery" },
  timber: { boss: "Timber", name: "Timber's Lumber Lodge", color: "#ea7816", theme: "Fire & Ice" },
  sawyer: { boss: "Sawyer", name: "Sawyer's Woodshed", color: "#d39a0b", theme: "Fire & Ice" },
  gingerbread: { boss: "Ginger", name: "Ginger Igloo", color: "#3fae4f", theme: "Fire & Ice" },
  grex: { boss: "Jefferson", name: "Jefferson's Fireworks", color: "#e5566a", theme: "Fire & Ice" },
  clown: { boss: "Boingo", name: "Boingo's Funhouse", color: "#7d3b93", theme: "Funfair" },
  tiger: { boss: "Babur", name: "Babur's Circus", color: "#2f7fe0", theme: "Funfair" },
  bigboy: { boss: "Big Boy", name: "Big Boy's Crib", color: "#23a8a8", theme: "Funfair" },
  blitz: { boss: "Dash", name: "Dash's Kicks", color: "#137a7a", theme: "Funfair" },
  hopper: { boss: "Chub & Chirp", name: "Chub & Chirp's Grassland", color: "#447a1f", theme: "Meadow" },
  pig: { boss: "Wrangler", name: "Wrangler's Stall", color: "#8f5629", theme: "Meadow" },
  moo: { boss: "Moo & Moon", name: "Moo & Moon Meadow", color: "#5d7ad8", theme: "Meadow" },
  hollow: { boss: "Hollow", name: "Hollow Peak", color: "#7a4fd0", theme: "Meadow" },
};

// ---- What the layout code needs beyond the lots (Nov 5, final): door squares, where bosses wander, where people walk,
// your start, the camera's turn zones.

/** Where you start: the promenade just south of the fountain, facing north up it (the plaza and the Colosseum ahead). */
export const START = { c: 22, r: 11, heading: 0 } as const;

/** A home's door square: the sidewalk square in front of its door (Eric, Nov 5: the square a tap on the home walks you to). */
export function doorSquare(l: Lot): { c: number; r: number } {
  const px = HOME_DOOR_PX[l.id as HomeId];
  const picW = l.id === "alfil" ? 208 : 144;
  const along = Math.floor((px + (l.w * 37 - picW) / 2) / 37);
  return l.facing === "S" ? { c: wrap(l.c0 + along), r: wrap(l.r0 - 1) } : { c: wrap(l.c0 - 1), r: wrap(l.r0 + l.w - 1 - along) };
}
/**
 * Where a boss may wander (Eric, Nov 5): its own lot's front strip (the yard before its front, inset squares deep) and the
 * sidewalk in front, the lot's width along. In squares (centres), inclusive: x0..x1 across, y0..y1 deep.
 */
export function wanderBox(l: Lot): { x0: number; x1: number; y0: number; y1: number } {
  return { x0: l.c0 - 0.3, x1: l.c0 + l.w - 0.7, y0: l.r0 - 1.3, y1: l.r0 - 0.15 };
}
/**
 * Where a boss rests when it stops wandering (so its home's front stays in view, Eric: "the boss homes always visible"):
 * on its sidewalk at the end of its wander box farther from its door, unless that end is in front of its sign's middle.
 */
export function restSquare(l: Lot): { c: number; r: number } {
  const d = doorSquare(l);
  const sign = SIGN_MID_PX[l.id as HomeId];
  const signC = sign === undefined ? -1 : wrap(l.c0 + Math.floor((sign + (l.w * 37 - (l.id === "alfil" ? 208 : 144)) / 2) / 37));
  const ends = [wrap(l.c0), wrap(l.c0 + l.w - 1)].filter((c) => c !== d.c && c !== signC);
  const far = (ends.length ? ends : [wrap(l.c0)]).sort((a, b) => Math.abs(wrapF(b - d.c)) - Math.abs(wrapF(a - d.c)))[0]!;
  return { c: far, r: wrap(l.r0 - 1) };
}
/** Squares a prop stands on and blocks (a tree, a table and its stools, the fountain, a bench, a lamp, a shed). */
export function blockedSquares(): Set<number> {
  const b = new Set<number>();
  for (const p of PROPS) {
    if (p.kind === "hedge" || p.kind === "bed" || p.kind === "bush") continue;
    if (p.kind === "fountain") {
      for (const f of FOUNTAIN) b.add(at(f.c, f.r));
      continue;
    }
    b.add(at(Math.round(p.x), Math.round(p.y)));
    if (p.kind === "table") (b.add(at(Math.round(p.x) - 1, Math.round(p.y))), b.add(at(Math.round(p.x) + 1, Math.round(p.y))));
  }
  return b;
}
/** Where people (you and the bots) may walk: the streets, the sidewalks, South Lane, the park's walks and lawns, the Colosseum's apron; not the lots, the gardens, the grove or anything a prop stands on. */
export function walkable(c: number, r: number, blocked = blockedSquares()): boolean {
  const g = ground[at(c, r)]!;
  return (g === BOARD || g === PAVE || g === GRASS) && !blocked.has(at(c, r));
}
/** Seam Avenue's four crossings: the squares where the camera faces north while you're on the avenue (rows inclusive, wrapping). */
export const TURN_ZONES = [
  { street: "seam-st", rows: [43, 47] },
  { street: "fountain-st", rows: [12, 17] },
  { street: "colosseum-row", rows: [21, 25] },
  { street: "upper-st", rows: [29, 34] },
] as const;

// ---- The lamps, settled: only on sidewalk squares, never on a door square or a boss's rest square (one there steps a square along the sidewalk).
{
  const doors = new Set(LOTS.filter((l) => l.kind === "home").flatMap((l) => [doorSquare(l), restSquare(l)].map((d) => at(d.c, d.r))));
  for (let i = PROPS.length - 1; i >= 0; i--) {
    const p = PROPS[i]!;
    if (p.kind !== "lamp") continue;
    if (ground[at(p.x, p.y)] !== PAVE) { PROPS.splice(i, 1); continue; }
    const alongX = ground[at(p.x + 1, p.y)] === PAVE || ground[at(p.x - 1, p.y)] === PAVE;
    for (const step of [0, 1, -1, 2, -2]) {
      const [x, y] = alongX ? [p.x + step, p.y] : [p.x, p.y + step];
      if (ground[at(x, y)] === PAVE && !doors.has(at(x, y))) { p.x = wrap(x); p.y = wrap(y); break; }
    }
  }
}
