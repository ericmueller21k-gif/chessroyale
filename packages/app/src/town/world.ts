/**
 * The town square's world: where the homes stand, who walks where, and the little lives of the bosses and bots (no
 * drawing, no DOM). Everyone in the square, you and the bots, is a Person in one list (`people`): the drawing and the
 * taps only read that list, so real players (a room of up to about a hundred, fed by a server, later) can replace the
 * bots without touching either. The bots are one source that moves its people. Ported from the prototype Eric tested (docs/mockups/town-square/prototype.html): the same
 * square-to-square walk, the same hobble, the same pauses. Every number that shapes the feel is in feel.ts.
 */
import { SELECT_LINES } from "../characters/boss-select.ts";
import { N, wrapF, wrapI } from "./camera.ts";
import { TOWN_FEEL } from "./feel.ts";

export interface Sq {
  c: number;
  r: number;
}

/**
 * The Colosseum's ground in the world's middle (12 x 12 squares since slice 6, which made it about twice its size; slice 5
 * built it on 6 x 6: solid, you walk round it). `c0`, `r0` its first column and row. Its gate faces south, over the park
 * toward your start. (Row 28 since the park moved away from it: `WALK_ROWS`.)
 */
export const COLISEUM = { c0: 17, r0: 28, size: 12 } as const;
/** Whether (c, r) is the Colosseum's ground. */
export const onColiseum = (c: number, r: number): boolean => {
  const i = wrapI(c) - COLISEUM.c0;
  const j = wrapI(r) - COLISEUM.r0;
  return i >= 0 && i < COLISEUM.size && j >= 0 && j < COLISEUM.size;
};
/**
 * The apron: the open squares in front of the Colosseum's gate, as wide as the Colosseum and `APRON_ROWS` deep, where people
 * gather (nothing is built there; your start is on it). Nearest the gate first: a tap on the Colosseum ends you on the
 * first free one (`destFor`), so a crowd at the gate grows outward from it in a half ring.
 */
export const APRON_ROWS = 3;
/**
 * Between the apron and the park's north walk, the promenade carries on across this many rows of the town's board, so
 * the park stands back from the Colosseum (Eric, Oct 26: "It shouldn't literally be right next to it… 8 to 10 tiles away";
 * its nearest tables are 8 rows from its wall).
 */
export const WALK_ROWS = 4;
/** The middle of the gate's sill, on the Colosseum's front edge (between its two middle columns). */
const GATE_X = COLISEUM.c0 + (COLISEUM.size - 1) / 2;
const GATE_Y = COLISEUM.r0 - 0.5;
export const APRON: readonly Sq[] = Array.from({ length: COLISEUM.size * APRON_ROWS }, (_, i) => ({ c: COLISEUM.c0 + (i % COLISEUM.size), r: COLISEUM.r0 - 1 - Math.floor(i / COLISEUM.size) })).sort(
  (a, b) => Math.hypot(a.c - GATE_X, a.r - GATE_Y) - Math.hypot(b.c - GATE_X, b.r - GATE_Y),
);

/** The two statues on the Colosseum's front (houses/statues.ts draws them): the marble statue and the bronze statue. */
export type StatueId = "marble" | "bronze";
/**
 * A statue, and the apron square right in front of it (c, r) where you stand to look at it: stopping there (or where a
 * tap on the statue sent you) brings the camera in close on it, and its quote renders in on its pedestal.
 */
export interface Statue {
  id: StatueId;
  c: number;
  r: number;
  /** Its quote, word for word (no attribution: Eric). */
  quote: string;
}
/**
 * The marble statue (the Hidden Boss in stone) before the Colosseum ground's first column, on the gate's left; the bronze
 * statue before its last, on the gate's right (from the ground's size, so they follow it if it grows). Quotes: Eric's,
 * Oct 26.
 */
export const STATUES: readonly Statue[] = [
  { id: "marble", c: COLISEUM.c0, r: COLISEUM.r0 - 1, quote: "Nothing is so healing as the human touch" },
  { id: "bronze", c: COLISEUM.c0 + COLISEUM.size - 1, r: COLISEUM.r0 - 1, quote: "Concrete considerations always take precedence over general principles" },
];
/** The statue whose viewing square (c, r) is, or null. */
export const statueAt = (c: number, r: number): Statue | null => STATUES.find((s) => s.c === wrapI(c) && s.r === wrapI(r)) ?? null;

// ---- The park (slice 6; Eric, Oct 26: "a little park… filled with chess boards on little tables where you can walk up
// and sit… benches, sidewalks, even a water fountain in the middle, trees… a very cozy city park feel. I'd say 10 chess
// boards to start with… open up the space in front of the coliseum and it can go there").

/**
 * The park in front of the Colosseum's gate, south of its apron and the walk: 20 squares across (the Colosseum's 12 and 4
 * more each side), 11 deep. `c0` its first column, `r1` its row nearest the gate (the camera looks north, r rising).
 */
export const PARK = { c0: COLISEUM.c0 - 4, r1: COLISEUM.r0 - APRON_ROWS - WALK_ROWS - 1, w: 20, d: 11 } as const;
/**
 * Its plan, a row a line from the gate's side (north) to the plaza's (south), a square a letter: `=` paving, `.` grass,
 * `t` a tree (on grass), `b` a bench (on grass, facing south), `B` a bench on paving, `T` a chess table (its two stools
 * `s` either side, facing each other across it), `F` the fountain (2 x 2, on paving; `f` its other squares). A paved
 * walk all round; the promenade (4 wide) runs up the middle from the plaza to the gate, round the fountain in the
 * middle; five tables either side of it; lawns with trees and benches outside them.
 */
const PARK_PLAN = [
  "====================",
  "=.t..sTs====sTs..t.=",
  "=...b...====...b...=",
  "=t...sTs====sTs...t=",
  "=......B====B......=",
  "=.t..sTs=Ff=sTs..t.=",
  "=......==ff==......=",
  "=t...sTs====sTs...t=",
  "=...b...====...b...=",
  "=.t..sTs====sTs..t.=",
  "====================",
] as const;

/** What a square of ground is: the town's board, paving (the park's walks, the Colosseum's apron) or the park's grass. */
export const BOARD_GROUND = 0;
export const PAVING = 1;
export const GRASS = 2;
/** Each square's ground (index r * N + c). */
export const groundAt = new Uint8Array(N * N);

/** A chess table: its square (solid) and its two stools (walkable), west and east of it, facing each other across it. */
export interface Table {
  i: number;
  c: number;
  r: number;
  stools: readonly [Sq, Sq];
}
/** Something standing in the park: a tree, a bench, the fountain, a chess table (with its stools) or a lamp. */
export interface Prop {
  kind: "tree" | "bench" | "fountain" | "table" | "lamp";
  /** Its square (the fountain's: its front left one). */
  c: number;
  r: number;
  /** Where its picture's foot stands (the fountain's: the middle of its front edge). */
  x: number;
  y: number;
  /** Its variant (the trees differ a little: 0 to 2). */
  v: number;
  /** A table's index in TABLES (-1: not a table). */
  table: number;
}
const tables: Table[] = [];
const props: Prop[] = [];
/** Squares something in the park stands on (walked round). */
const parkSolid = new Uint8Array(N * N);
PARK_PLAN.forEach((line, v) => {
  const r = PARK.r1 - v;
  for (let u = 0; u < PARK.w; u++) {
    const ch = line[u]!;
    const c = PARK.c0 + u;
    const k = r * N + c;
    groundAt[k] = ch === "." || ch === "t" || ch === "b" ? GRASS : PAVING;
    if (ch === "t" || ch === "b" || ch === "B") {
      parkSolid[k] = 1;
      props.push({ kind: ch === "t" ? "tree" : "bench", c, r, x: c, y: r, v: (u * 7 + v * 3) % 3, table: -1 });
    } else if (ch === "T") {
      parkSolid[k] = 1;
      const t: Table = { i: tables.length, c, r, stools: [{ c: c - 1, r }, { c: c + 1, r }] };
      tables.push(t);
      props.push({ kind: "table", c, r, x: c, y: r, v: 0, table: t.i });
    } else if (ch === "F" || ch === "f") {
      parkSolid[k] = 1;
      if (ch === "F" && line[u + 1] === "f") props.push({ kind: "fountain", c, r: r - 1, x: c + 0.5, y: r - 1.5, v: 0, table: -1 });
    }
  }
});
// The Colosseum's apron is paved too, and the promenade's 4 squares across the walk between them.
for (let r = COLISEUM.r0 - APRON_ROWS; r < COLISEUM.r0; r++) for (let c = COLISEUM.c0; c < COLISEUM.c0 + COLISEUM.size; c++) groundAt[r * N + c] = PAVING;
for (let r = PARK.r1 + 1; r < COLISEUM.r0 - APRON_ROWS; r++) for (let c = PARK.c0 + 8; c < PARK.c0 + 12; c++) groundAt[r * N + c] = PAVING;

/**
 * The park's lamps (Oct 27, Eric: "street lamps or like park style lamps, so when it's night and also dusk that they turn
 * on for the little park"): ten, each on a square of its own, solid (walked round) and on paving, where no path needs the
 * square. A pair flanking the promenade where it leaves the park toward the Colosseum and where it comes in from the
 * plaza (on the board's square just outside the park's walk either side of it, paved for its foot), a pair beside the
 * fountain (on the paving either side of its front row, between the tables' stools), and one at each corner of the
 * park's walk (a corner square: walking round it on the grass inside is no longer). The first is the one ahead on your
 * left as the page opens (the e2e test finds it there).
 */
export const LAMPS: readonly Sq[] = [
  { c: PARK.c0 + 7, r: PARK.r1 + 1 },
  { c: PARK.c0 + 12, r: PARK.r1 + 1 },
  { c: PARK.c0 + 7, r: PARK.r1 - 6 },
  { c: PARK.c0 + 12, r: PARK.r1 - 6 },
  { c: PARK.c0, r: PARK.r1 },
  { c: PARK.c0 + PARK.w - 1, r: PARK.r1 },
  { c: PARK.c0 + 7, r: PARK.r1 - PARK.d },
  { c: PARK.c0 + 12, r: PARK.r1 - PARK.d },
  { c: PARK.c0, r: PARK.r1 - PARK.d + 1 },
  { c: PARK.c0 + PARK.w - 1, r: PARK.r1 - PARK.d + 1 },
];
for (const l of LAMPS) {
  const k = l.r * N + l.c;
  parkSolid[k] = 1;
  groundAt[k] = PAVING;
  props.push({ kind: "lamp", c: l.c, r: l.r, x: l.c, y: l.r, v: 0, table: -1 });
}
/** The ten chess tables, in the plan's order (north to south, west to east). */
export const TABLES: readonly Table[] = tables;
/** Everything standing in the park. */
export const PROPS: readonly Prop[] = props;
/** The table whose stool (c, r) is, or null. */
export const stoolAt = (c: number, r: number): Table | null => {
  const wc = wrapI(c);
  const wr = wrapI(r);
  return TABLES.find((t) => t.stools.some((s) => s.c === wc && s.r === wr)) ?? null;
};
/** The table on square (c, r), or null. */
export const tableAt = (c: number, r: number): Table | null => TABLES.find((t) => t.c === wrapI(c) && t.r === wrapI(r)) ?? null;

/**
 * Your square when the page opens: in the park on its promenade, between its two rows of tables nearest the Colosseum,
 * facing it (the camera looks north, r rising): the tables round you, the fountain behind you, and the walk across to
 * the Colosseum looming beyond (near enough to stand inside the view's rim, not on its horizon).
 */
export const START: Sq = { c: PARK.c0 + 9, r: PARK.r1 - 3 };

export type HomeId = "tiger" | "gingerbread" | "grex" | "hollow" | "moo" | "clown" | "bigboy" | "sawyer" | "pig" | "smudgy" | "hopper" | "gardener" | "alfil";

/**
 * A place with a picture, a name (floating over it and on its sign) and an edge chip: a boss's home, or the Colosseum.
 * (cx, cy) is its ground's middle.
 */
export interface Place {
  id: HomeId | "coliseum";
  /** Its name: written by the game (floating over it, and on its sign), never drawn into the art. */
  name: string;
  /** The chip's ring color. */
  color: string;
  cx: number;
  cy: number;
  /** Half its ground's side, in squares (a home's 3 x 3 plot: 1.5). */
  half: number;
  /** Where its picture's foot stands, in squares in front of (cx, cy) (a home's: half a square). */
  foot: number;
}

/** A boss's home: a 3 x 3 plot. (cx, cy) is its middle square. */
export interface Home extends Place {
  id: HomeId;
  /** The boss's name. */
  boss: string;
}

/**
 * The Colosseum as a place: its name, its chip's ring (the game's navy), its ground's middle; its picture's foot (the
 * gate's sill) stands on its ground's front edge.
 */
export const COLISEUM_PLACE: Place = { id: "coliseum", name: "The Colosseum", color: "#1f2530", cx: GATE_X, cy: COLISEUM.r0 + (COLISEUM.size - 1) / 2, half: COLISEUM.size / 2, foot: COLISEUM.size / 2 };

/**
 * The thirteen homes, spread evenly round the middle (the Colosseum and its park) over the 46 x 46 world that wraps: every
 * home's nearest neighbor is 8 to 10 squares away, as on slice 3's smaller map, and no home's roaming ground reaches the
 * park or the Colosseum (docs/decisions/2026-10-26-town-square-slice-6.md has the map). Pairs that play off each other
 * stand side by side: Ginger Igloo and Jefferson's Fireworks (ice and fire), Hollow Peak and Moo & Moon Meadow (dark and
 * night). Names: "Ginger Igloo", "Hollow Peak" and "Moo & Moon Meadow" are Eric's; the rest the director's.
 */
export const HOMES: readonly Home[] = (
  [
    { id: "gingerbread", boss: "Ginger", name: "Ginger Igloo", color: "#3fae4f", cx: 39, cy: 11 },
    { id: "grex", boss: "Jefferson", name: "Jefferson's Fireworks", color: "#e5566a", cx: 39, cy: 3 },
    { id: "tiger", boss: "Babur", name: "Babur's Circus", color: "#2f7fe0", cx: 28, cy: 4 },
    { id: "bigboy", boss: "Big Boy", name: "Big Boy's Crib", color: "#23a8a8", cx: 43, cy: 31 },
    { id: "hollow", boss: "Hollow", name: "Hollow Peak", color: "#7a4fd0", cx: 0, cy: 43 },
    { id: "moo", boss: "Moo & Moon", name: "Moo & Moon Meadow", color: "#5d7ad8", cx: 8, cy: 40 },
    { id: "alfil", boss: "Alfil", name: "Alfil's Pyramid", color: "#b4840f", cx: 23, cy: 43 },
    { id: "smudgy", boss: "Smudgy", name: "Smudgy's Art Gallery", color: "#f5832d", cx: 35, cy: 40 },
    { id: "clown", boss: "Boingo", name: "Boingo's Funhouse", color: "#7d3b93", cx: 5, cy: 27 },
    { id: "hopper", boss: "Chub & Chirp", name: "Chub & Chirp's Grassland", color: "#447a1f", cx: 6, cy: 8 },
    { id: "gardener", boss: "Puddles", name: "Puddles' Botanical Garden", color: "#d6747b", cx: 16, cy: 2 },
    { id: "sawyer", boss: "Sawyer", name: "Sawyer's Woodshed", color: "#d39a0b", cx: 40, cy: 23 },
    { id: "pig", boss: "Wrangler", name: "Wrangler's Stall", color: "#8f5629", cx: 4, cy: 17 },
  ] satisfies Omit<Home, "half" | "foot">[]
).map((h) => ({ ...h, half: 1.5, foot: 0.5 }));
/** Every place: the homes (in the bosses' order), then the Colosseum. */
export const PLACES: readonly Place[] = [...HOMES, COLISEUM_PLACE];

/** How a person's pawn looks: its side (white or black), and a tint for a few. (Dressed pawns come later.) */
export interface Look {
  side: "light" | "dark";
  tint: string | null;
}

/** The bots' names (six of the prototype's) and their pawns' looks. */
export const BOTS: readonly ({ name: string } & Look)[] = [
  { name: "Berlin Wally", side: "light", tint: null },
  { name: "Castle Cass", side: "light", tint: "#ffb3c6" },
  { name: "Gambit Gwen", side: "dark", tint: null },
  { name: "Fork Frank", side: "light", tint: "#9fd3ff" },
  { name: "Tempo Tess", side: "dark", tint: "#3c6e5a" },
  { name: "Pin Pete", side: "dark", tint: null },
];

/** Which home stands on each square (index r * N + c), or null. */
export const plotAt: (Home | null)[] = new Array(N * N).fill(null);
for (const h of HOMES) for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) plotAt[wrapI(h.cy + dr) * N + wrapI(h.cx + dc)] = h;

/** A square you can stand on: not a home's plot, not the Colosseum's ground, nothing in the park standing on it (a stool is a square you stand on). */
export const walkable = (c: number, r: number): boolean => {
  const k = wrapI(r) * N + wrapI(c);
  return plotAt[k] === null && !parkSolid[k] && !onColiseum(c, r);
};
/** Steps between two squares, the short way round. */
export const tdist = (a: Sq, b: Sq): number => Math.abs(wrapF(a.c - b.c)) + Math.abs(wrapF(a.r - b.r));
/** How far a square is from a home's plot (0 on it, 1 on the ring around it). */
export const plotDist = (h: Home, c: number, r: number): number => Math.max(0, Math.abs(wrapF(c - h.cx)) - 1, Math.abs(wrapF(r - h.cy)) - 1);

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** The shortest path (4 ways, wrapping) from `from` to the nearest square that `isGoal` takes, through squares `ok` takes. */
export function findPath(from: Sq, isGoal: (c: number, r: number) => boolean, ok: (c: number, r: number) => boolean): Sq[] | null {
  const start = from.r * N + from.c;
  const prev = new Int32Array(N * N).fill(-1);
  prev[start] = start;
  const q = [start];
  let found = -1;
  for (let qi = 0; qi < q.length; qi++) {
    const k = q[qi]!;
    const c = k % N;
    const r = (k - c) / N;
    if (k !== start && isGoal(c, r)) {
      found = k;
      break;
    }
    for (const [dc, dr] of DIRS) {
      const nc = wrapI(c + dc);
      const nr = wrapI(r + dr);
      const nk = nr * N + nc;
      if (prev[nk] !== -1 || !ok(nc, nr)) continue;
      prev[nk] = k;
      q.push(nk);
    }
  }
  if (found < 0) return null;
  const path: Sq[] = [];
  for (let k = found; k !== start; k = prev[k]!) path.push({ c: k % N, r: (k - (k % N)) / N });
  return path.reverse();
}

/** Where a walker is this frame: its position in squares (unwrapped near its square) and the hobble. */
export interface Pose {
  x: number;
  y: number;
  /** 0 to 1 to 0 over a step. */
  hop: number;
  /** -1 to 1 over a step. */
  tilt: number;
}

/** Claims are numbered in the order they're made: the earlier claim on a square keeps it (keepApart). */
let claims = 0;

/** Someone who walks square to square: you, a bot or a boss. */
export class Walker {
  c: number;
  r: number;
  facing: 1 | -1 = 1;
  /** When it claimed the square it will end on (its goal): the order of `go`s, 0 for where it first stood. */
  claim = 0;
  private queue: Sq[] = [];
  /** The step being taken: from, to, when it began, and whether it eases off from standing and eases into a stop. */
  private step: { fc: number; fr: number; to: Sq; dc: number; dr: number; t0: number; first: boolean; last: boolean } | null = null;
  constructor(
    sq: Sq,
    readonly stepMs: number,
    readonly hobble: boolean,
    /** How much the walk eases into its first step and out of its last (TOWN_FEEL.walkEase; 0 = even steps). */
    readonly ease = 0,
  ) {
    this.c = sq.c;
    this.r = sq.r;
  }
  /** The square it's on, or stepping onto. */
  here(): Sq {
    return this.step ? this.step.to : { c: this.c, r: this.r };
  }
  hereC(): number {
    return this.step ? this.step.to.c : this.c;
  }
  hereR(): number {
    return this.step ? this.step.to.r : this.r;
  }
  moving(): boolean {
    return !!this.step || this.queue.length > 0;
  }
  /** The square it will end on: its path's last, or where it's stepping, or where it stands. */
  goalC(): number {
    return this.queue.length ? this.queue[this.queue.length - 1]!.c : this.hereC();
  }
  goalR(): number {
    return this.queue.length ? this.queue[this.queue.length - 1]!.r : this.hereR();
  }
  goal(): Sq {
    return { c: this.goalC(), r: this.goalR() };
  }
  /** Walk this path (after the step it's on), claiming its last square. */
  go(path: Sq[]): void {
    this.queue = path.slice();
    this.claim = ++claims;
  }
  update(now: number): void {
    for (let g = 0; g < 64; g++) {
      if (this.step) {
        const end = this.step.t0 + this.stepMs;
        if (now < end) return;
        this.c = this.step.to.c;
        this.r = this.step.to.r;
        // (A step that eased into a stop, then got a new path, sets off again as from standing: no jolt.)
        const stopped = this.step.last;
        this.step = null;
        if (!this.queue.length) return;
        this.begin(this.queue.shift()!, end, stopped);
      } else {
        if (!this.queue.length) return;
        this.begin(this.queue.shift()!, now, true);
      }
    }
  }
  /** `first`: a step off from standing still. Whether it's the last is known now (a new path later doesn't change it). */
  private begin(to: Sq, t0: number, first: boolean): void {
    const dc = wrapF(to.c - this.c);
    const dr = wrapF(to.r - this.r);
    if (dc) this.facing = dc < 0 ? -1 : 1;
    this.step = { fc: this.c, fr: this.r, to, dc, dr, t0, first, last: this.queue.length === 0 };
  }
  /** Its pose at `now`, into `out`. */
  pose(now: number, out: Pose): Pose {
    const s = this.step;
    if (!s) {
      out.x = this.c;
      out.y = this.r;
      out.hop = 0;
      out.tilt = 0;
      return out;
    }
    const t = Math.max(0, Math.min(1, (now - s.t0) / this.stepMs));
    const e = this.ease ? ease(t, s.first, s.last, this.ease) : t;
    out.x = s.fc + s.dc * e;
    out.y = s.fr + s.dr * e;
    out.hop = this.hobble ? Math.sin(Math.PI * t) : 0;
    out.tilt = this.hobble ? Math.sin(2 * Math.PI * t) : 0;
    return out;
  }
}

/**
 * Where a step has got to at t (0 to 1): even, or eased into a first step from standing and out of a last one by
 * `amount`. The eased curves meet the even steps at the same speed, so a walk never jolts between squares.
 */
export function ease(t: number, first: boolean, last: boolean, amount: number): number {
  const e = first && last ? t * t * (3 - 2 * t) : first ? t * t * (2 - t) : last ? t * (1 + t - t * t) : t;
  return t + amount * (e - t);
}

/**
 * Someone in the square: you, a bot, later a real player. Their square and the path they're walking are their walker's.
 * The drawing and the taps read only this.
 */
export interface Person {
  id: string;
  name: string;
  look: Look;
  /** This device's player (a gold tag; the camera follows them). */
  you: boolean;
  walker: Walker;
  /**
   * Sits down when it stops on a chess table's stool (`seated`): a bot always does; you do when a tap on a table sent you
   * there, until you walk on or its card closes.
   */
  sit: boolean;
}

/** Whether a person sits at a chess table now: stopped on one of its stools, meaning to sit. Its table, or null. */
export function seated(p: Person): Table | null {
  const w = p.walker;
  return p.sit && !w.moving() ? stoolAt(w.c, w.r) : null;
}

export interface Boss {
  home: Home;
  walker: Walker;
  /** When it next walks (null: pick a pause). */
  nextAt: number | null;
  /** Whether it was drawn on screen, near enough to talk, last frame (render.ts sets it). */
  onScreen: boolean;
  /** Held where it is (its card is open): it doesn't roam off. */
  held: boolean;
  lastLine: string | null;
}

export interface Town {
  /** Everyone in the square, you first. */
  people: Person[];
  you: Person;
  /** The people the bot source moves (a part of `people`). */
  bots: Person[];
  bosses: Boss[];
  all: Walker[];
  rnd: () => number;
  /** The line being said now: who, what, until when; and when the next may start. */
  speech: { boss: Boss | null; line: string; until: number; next: number };
  nextBotAt: number;
}

/** A small seeded generator (the prototype's), in [0, 1). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** The town as the page opens. `now`: the clock the loop runs on (performance.now). */
export function createTown(now: number, seed = 20261025): Town {
  const rnd = lcg(seed);
  const f = TOWN_FEEL;
  const you: Person = { id: "you", name: "", look: { side: "light", tint: null }, you: true, walker: new Walker(START, f.youStepMs, true, f.walkEase), sit: false };
  // Each boss starts on the square in front of its home's middle (toward the camera).
  const bosses: Boss[] = HOMES.map((home) => ({ home, walker: new Walker({ c: home.cx, r: wrapI(home.cy - 2) }, f.bossStepMs, false), nextAt: null, onScreen: false, held: false, lastLine: null }));
  // The bots stand around you in the park (16 x 14 squares round you), apart, off the bosses' roaming ground.
  const bots: Person[] = [];
  for (const b of BOTS) {
    let c = 0;
    let r = 0;
    for (let tries = 0; tries < 800; tries++) {
      c = wrapI(START.c - 8 + Math.floor(rnd() * 16));
      r = wrapI(START.r - 4 + Math.floor(rnd() * 14));
      const sq = { c, r };
      if (walkable(c, r) && !statueAt(c, r) && tdist(sq, START) >= 3 && !HOMES.some((h) => plotDist(h, c, r) <= f.bossRoam) && !bots.some((o) => tdist(sq, o.walker.here()) < 3)) break;
    }
    bots.push({ id: `bot:${bots.length}`, name: b.name, look: { side: b.side, tint: b.tint }, you: false, walker: new Walker({ c, r }, f.botStepMs, true), sit: true });
  }
  return {
    people: [you, ...bots],
    you,
    bots,
    bosses,
    all: [you.walker, ...bots.map((b) => b.walker), ...bosses.map((b) => b.walker)],
    rnd,
    speech: { boss: null, line: "", until: 0, next: now + f.speechFirstMs },
    nextBotAt: now + f.botFirstMs,
  };
}

const between = (t: Town, [a, b]: readonly [number, number]) => a + t.rnd() * (b - a);
const pick = <T>(t: Town, a: readonly T[]): T => a[Math.floor(t.rnd() * a.length)]!;

/**
 * Whether (c, r) is someone else's: the square another walker stands on or will end on (one pawn a square, like chess).
 * Passing over a square doesn't claim it: people walk through each other; only where they stop counts.
 */
export function taken(t: Town, c: number, r: number, except: Walker | null): boolean {
  for (const w of t.all) if (w !== except && w.goalC() === c && w.goalR() === r) return true;
  return false;
}

/** Steps from `from` to every square (-1: no way there), around the homes; people don't block. */
export function stepsFrom(from: Sq, ok: (c: number, r: number) => boolean = walkable): Int16Array {
  const d = new Int16Array(N * N).fill(-1);
  const start = from.r * N + from.c;
  d[start] = 0;
  const q = [start];
  for (let qi = 0; qi < q.length; qi++) {
    const k = q[qi]!;
    const c = k % N;
    const r = (k - c) / N;
    for (const [dc, dr] of DIRS) {
      const nk = wrapI(r + dr) * N + wrapI(c + dc);
      if (d[nk] !== -1 || !ok(wrapI(c + dc), wrapI(r + dr))) continue;
      d[nk] = d[k]! + 1;
      q.push(nk);
    }
  }
  return d;
}

/** How far out a ring around a spot is looked for a free square (the rings fill nearest first). */
const RINGS = 6;

/**
 * Where `w` should end up to stand at `at` (`beside`: next to it), one pawn a square: `at` itself if it's free (and not
 * `beside`), else the nearest free square around it, ring by ring (the 8 squares touching it, then the 16 round those,
 * ...), and in a ring the one `w` reaches in fewest steps. Null if there's none (or no way there).
 */
export function spotNear(t: Town, w: Walker, at: Sq, beside: boolean): Sq | null {
  const d = stepsFrom(w.here());
  for (let k = beside ? 1 : 0; k <= RINGS; k++) {
    let best: Sq | null = null;
    let bestD = Infinity;
    for (let dr = -k; dr <= k; dr++)
      for (let dc = -k; dc <= k; dc++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== k) continue;
        const c = wrapI(at.c + dc);
        const r = wrapI(at.r + dr);
        const s = d[r * N + c]!;
        if (s < 0 || s >= bestD || !walkable(c, r) || taken(t, c, r, w)) continue;
        best = { c, r };
        bestD = s;
      }
    if (best) return best;
  }
  return null;
}

/** What a tap asks for: a square, the squares beside someone, the ring around a home, the Colosseum's apron, a statue's square or a chess table's stool. */
export type Target = { kind: "square"; c: number; r: number } | { kind: "beside"; at: Sq } | { kind: "home"; home: Home } | { kind: "coliseum" } | { kind: "statue"; statue: Statue } | { kind: "table"; table: Table };

/**
 * The square `w` would end on for a target (null: none; where it stands already counts). A square: itself if free, else
 * the nearest free one next to it. Someone: the nearest free square beside them. A home: the nearest free square on the
 * ring around its plot. The Colosseum (or its ground): the free square of its apron nearest the gate (of two as near, the
 * one `w` reaches in fewer steps); a full apron, the nearest free square round the gate.
 */
export function destFor(t: Town, w: Walker, target: Target): Sq | null {
  if (target.kind === "coliseum" || (target.kind === "square" && onColiseum(target.c, target.r))) {
    const d = stepsFrom(w.here());
    let best: Sq | null = null;
    let bestK = Infinity;
    for (const s of APRON) {
      const k = Math.round(Math.hypot(s.c - GATE_X, s.r - GATE_Y) * 1000) * 1000 + d[s.r * N + s.c]!;
      if (d[s.r * N + s.c]! >= 0 && k < bestK && !taken(t, s.c, s.r, w)) {
        best = s;
        bestK = k;
      }
    }
    return best ?? spotNear(t, w, APRON[0]!, false);
  }
  if (target.kind === "home") {
    const h = target.home;
    const here = w.here();
    if (plotDist(h, here.c, here.r) === 1 && !taken(t, here.c, here.r, w)) return here;
    const path = findPath(here, (c, r) => plotDist(h, c, r) === 1 && walkable(c, r) && !taken(t, c, r, w), walkable);
    return path ? path[path.length - 1]! : null;
  }
  if (target.kind === "beside") return spotNear(t, w, target.at, true);
  // A chess table: its free stool `w` reaches in fewer steps (where it sits already counts); both taken, the nearest free
  // square beside the table.
  if (target.kind === "table") {
    const d = stepsFrom(w.here());
    let best: Sq | null = null;
    for (const s of target.table.stools) {
      const k = d[s.r * N + s.c]!;
      if (k >= 0 && !taken(t, s.c, s.r, w) && (!best || k < d[best.r * N + best.c]!)) best = s;
    }
    return best ?? spotNear(t, w, target.table, true);
  }
  // A statue: its viewing square, or (someone stands there) the nearest free square beside it.
  if (target.kind === "statue") return spotNear(t, w, target.statue, false);
  if (plotAt[target.r * N + target.c]) {
    const h = plotAt[target.r * N + target.c]!;
    return destFor(t, w, { kind: "home", home: h });
  }
  return spotNear(t, w, { c: target.c, r: target.r }, false);
}

/** `w` walks to `to` the shortest way round the homes (through people). False if there's no way. */
export function walkWalker(w: Walker, to: Sq): boolean {
  const h = w.here();
  if (h.c === to.c && h.r === to.r) {
    w.go([]);
    return true;
  }
  const path = findPath(h, (c, r) => c === to.c && r === to.r, walkable);
  if (!path) return false;
  w.go(path);
  return true;
}

/**
 * One pawn a square: when two walkers will end on the same square, the later claim gives way to the nearest free square
 * beside it (someone stepped onto your last square while you walked).
 */
export function keepApart(t: Town): void {
  const all = t.all;
  for (let i = 0; i < all.length; i++) {
    const w = all[i]!;
    const gc = w.goalC();
    const gr = w.goalR();
    for (let j = 0; j < all.length; j++) {
      const o = all[j]!;
      if (o === w || o.goalC() !== gc || o.goalR() !== gr || o.claim > w.claim || (o.claim === w.claim && j > i)) continue;
      // `o` was there first: `w` stops beside it instead.
      const to = spotNear(t, w, { c: gc, r: gr }, true);
      if (to) walkWalker(w, to);
      break;
    }
  }
}

/** One tick of the town's life: everyone steps, the bosses roam, a bot may walk, a boss may talk. */
export function tick(t: Town, now: number): void {
  for (const w of t.all) w.update(now);
  keepApart(t);
  bossesRoam(t, now);
  botsWander(t, now);
  updateSpeech(t, now);
}

function bossesRoam(t: Town, now: number): void {
  const f = TOWN_FEEL;
  for (const b of t.bosses) {
    const w = b.walker;
    if (w.moving() || b.held) continue;
    if (b.nextAt === null) {
      b.nextAt = now + between(t, f.bossPauseMs);
      continue;
    }
    if (now < b.nextAt) continue;
    b.nextAt = null;
    // A free square of its roaming ground (around its plot), one to a few steps away.
    const h = w.here();
    const near = (c: number, r: number) => walkable(c, r) && plotDist(b.home, c, r) <= f.bossRoam;
    const targets: Sq[] = [];
    const n = f.bossWalkSquares;
    for (let dc = -n; dc <= n; dc++)
      for (let dr = -n; dr <= n; dr++) {
        const d = Math.abs(dc) + Math.abs(dr);
        const c = wrapI(h.c + dc);
        const r = wrapI(h.r + dr);
        if (d >= 1 && d <= n && near(c, r) && !taken(t, c, r, w)) targets.push({ c, r });
      }
    if (!targets.length) continue;
    const to = pick(t, targets);
    const path = findPath(h, (c, r) => c === to.c && r === to.r, (c, r) => near(c, r) && !taken(t, c, r, w));
    if (path && path.length <= n) w.go(path);
  }
}

function botsWander(t: Town, now: number): void {
  const f = TOWN_FEEL;
  if (now < t.nextBotAt) return;
  t.nextBotAt = now + between(t, f.botGapMs);
  const free = t.bots.filter((b) => !b.walker.moving());
  if (!free.length) return;
  const bot = pick(t, free);
  const w = bot.walker;
  const h = w.here();
  const [lo, hi] = f.botWalk;
  // (Never on a statue's viewing square: it's kept free for whoever comes to look.)
  const ok = (c: number, r: number) => walkable(c, r) && !taken(t, c, r, w) && !t.bosses.some((b) => plotDist(b.home, c, r) === 1) && !statueAt(c, r);
  const targets: Sq[] = [];
  // Now and then one goes to sit at a chess table nearby (a free stool), and one sitting may stay a while longer.
  if (seated(bot) && t.rnd() < f.botStaySeated) return;
  const sitting = t.rnd() < f.botSitChance;
  const reach = sitting ? f.botSitReach : hi;
  for (let dc = -reach; dc <= reach; dc++)
    for (let dr = -reach; dr <= reach; dr++) {
      const d = Math.abs(dc) + Math.abs(dr);
      const c = wrapI(h.c + dc);
      const r = wrapI(h.r + dr);
      if (d >= lo && d <= reach && ok(c, r) && (!sitting || stoolAt(c, r)) && (sitting || d <= hi)) targets.push({ c, r });
    }
  if (!targets.length) return;
  const to = pick(t, targets);
  const path = findPath(h, (c, r) => c === to.c && r === to.r, ok);
  if (path) w.go(path);
}

function updateSpeech(t: Town, now: number): void {
  const f = TOWN_FEEL;
  const s = t.speech;
  if (s.boss && now >= s.until) {
    s.boss = null;
    s.next = now + between(t, f.speechGapMs);
  }
  if (s.boss || now < s.next) return;
  s.next = now + between(t, f.speechGapMs);
  const cands = t.bosses.filter((b) => b.onScreen);
  if (!cands.length) return;
  const b = pick(t, cands);
  const pool = SELECT_LINES[b.home.id] ?? [];
  if (!pool.length) return;
  const line = pool.length > 1 ? pick(t, pool.filter((l) => l !== b.lastLine)) : pool[0]!;
  b.lastLine = line;
  s.boss = b;
  s.line = line.replace("{heart}", "♥").replace("{question}", "?"); // (Moo's pixel icons, as plain characters here)
  s.until = now + f.speechMs;
}

/** You walk to a target (a square, someone, a home): to the square `destFor` gives. False if there's none. */
export function walkYou(t: Town, target: Target): boolean {
  const to = destFor(t, t.you.walker, target);
  return !!to && walkWalker(t.you.walker, to);
}
