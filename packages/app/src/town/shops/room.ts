/**
 * A shop's room (Nov 2, round 1), pure: which squares you can stand on, the way out, the Shopkeeper's talk range, and where a
 * tap sends you. A room is `n` x `n` squares (20), row 0 its back (north) wall and row n - 1 its low front with the way out;
 * the camera looks north. Its pieces come from the art's layout (shops/babur-art.ts, shops/puddles-art.ts: `ShopPlace`s).
 * No DOM; tested in packages/app/test/shop-room.test.ts.
 */
import { SHOP_FEEL } from "../feel.ts";
import { isUp, linksOf, type Levels } from "./levels.ts";

export interface Sq {
  c: number;
  r: number;
}

/** One piece in a room (the art's `ShopPlace`). */
export interface ShopPlace {
  name: string;
  /** Its west-most square's column, and its row (a deep piece's south-most). */
  col: number;
  row: number;
  /** Nobody walks through it. */
  solid: boolean;
  /** Quarter turns clockwise (floor tiles), and mirrored left to right (the east wall). */
  rot?: 0 | 1 | 2 | 3;
  flip?: boolean;
  /** Squares wide (from `col` east) and deep (from `row` north). */
  w?: number;
  d?: number;
  /** The way out. */
  exit?: boolean;
}

/**
 * A floor tile: lies flat on its square (the floor, the battle circle and its emblem; Folio's clean page, `page-<col>-<row>`: not its
 * drifting `pages`, which stand up).
 */
export const isFloor = (name: string): boolean => /^(floor|ring|circle|emblem|page-)/.test(name);

export interface Room {
  n: number;
  /** 1 where nobody stands or walks: the walls, every solid piece's squares, the way out's own squares, the Shopkeeper's. */
  blocked: Uint8Array;
  /** The way out's squares (the entrance's picture), and the squares just inside it, where "Go out" shows. */
  exits: readonly Sq[];
  doors: readonly Sq[];
  /** The Shopkeeper's squares, and the counter's (a tap on either means "talk"). */
  keeper: readonly Sq[];
  counter: readonly Sq[];
  /** Where you stand as you come in: a step inside the door, facing the counter. */
  start: Sq;
  /**
   * A room that isn't a box (Hollow's cave, Nov 3): 1 on each square of its floor's shape (the art's mask, `.`), 0 on its rock (`#`,
   * blocked whatever stands there). Null: a box, its floor every square inside its walls.
   */
  floor: Uint8Array | null;
  /**
   * A room with a second walking level (Ginger's igloo, Nov 5: a catwalk and its two staircases, levels.ts): its stair and catwalk
   * squares are walkable, but only along their chain; null: one level.
   */
  levels: Levels | null;
}

/** The squares a piece covers: `w` wide from its column east, `d` deep from its row north. */
export function squaresOf(p: ShopPlace): Sq[] {
  const out: Sq[] = [];
  for (let r = p.row - (p.d ?? 1) + 1; r <= p.row; r++) for (let c = p.col; c < p.col + (p.w ?? 1); c++) out.push({ c, r });
  return out;
}

/**
 * A room from its layout and its Shopkeeper's squares; `mask` (a room that isn't a box: Hollow's cave, the art's `SHOP_HOLLOW_FLOOR`,
 * `n` rows of `n`, `.` floor and `#` rock) blocks every rock square too, besides the edge and the solid pieces. `talk`: the pieces
 * whose squares mean "talk" as the counter's do (a shop with no counter: Jefferson's crate and his bare corner, Nov 4).
 */
export function makeRoom(layout: readonly ShopPlace[], keeper: readonly Sq[], n = 20, mask?: readonly string[], talk: readonly string[] = [], levels: Levels | null = null): Room {
  const blocked = new Uint8Array(n * n);
  const block = (s: Sq) => s.c >= 0 && s.c < n && s.r >= 0 && s.r < n && (blocked[s.r * n + s.c] = 1);
  // The walls are the room's edge, whatever stands there.
  for (let i = 0; i < n; i++) [{ c: i, r: 0 }, { c: i, r: n - 1 }, { c: 0, r: i }, { c: n - 1, r: i }].forEach(block);
  let floor: Uint8Array | null = null;
  if (mask) {
    floor = new Uint8Array(n * n);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (mask[r]?.[c] === ".") floor[r * n + c] = 1;
    for (let k = 0; k < n * n; k++) if (!floor[k]) blocked[k] = 1;
  }
  const exits: Sq[] = [];
  const counter: Sq[] = [];
  for (const p of layout) {
    if (isFloor(p.name)) continue;
    if (p.solid) squaresOf(p).forEach(block);
    if (p.exit) exits.push(...squaresOf(p));
    if (p.name === "counter" || talk.includes(p.name)) counter.push(...squaresOf(p));
  }
  keeper.forEach(block);
  // (The levels' squares are the back wall's, rock on the mask and solid cards: walkable, along their chain only.)
  if (levels) for (let k = 0; k < n * n; k++) if (levels.up[k]) blocked[k] = 0;
  const doors = exits.map((s) => ({ c: s.c, r: s.r - 1 })).filter((s) => !blocked[s.r * n + s.c]);
  const start = { c: doors[doors.length - 1]?.c ?? n >> 1, r: (doors[0]?.r ?? n - 2) - 1 };
  return { n, blocked, exits, doors, keeper, counter, start, floor, levels };
}

/**
 * Where the camera may look from, inside (a drag's focus): a box room anywhere over its squares (0 to n - 1 both ways, as before);
 * a cave over its floor's shape only, the nearest point of it to (x, y), so a drag never takes the view into the rock or past the
 * cave's edge (Nov 3). Into `out`; no allocation.
 */
export function camFocus(room: Room, x: number, y: number, out: { x: number; y: number }): { x: number; y: number } {
  const { n, floor } = room;
  out.x = Math.max(0, Math.min(n - 1, x));
  out.y = Math.max(0, Math.min(n - 1, y));
  if (!floor) return out;
  const c = Math.round(out.x);
  const r = Math.round(out.y);
  if (floor[r * n + c]) return out;
  let bd = Infinity;
  let bx = out.x;
  let by = out.y;
  for (let k = 0; k < n * n; k++) {
    if (!floor[k]) continue;
    const kc = k % n;
    const kr = (k - kc) / n;
    // (The nearest point of the square, a hair inside it so it rounds to that square.)
    const px = Math.max(kc - 0.49, Math.min(kc + 0.49, out.x));
    const py = Math.max(kr - 0.49, Math.min(kr + 0.49, out.y));
    const d = (px - out.x) ** 2 + (py - out.y) ** 2;
    if (d < bd) ((bd = d), (bx = px), (by = py));
  }
  out.x = bx;
  out.y = by;
  return out;
}

/**
 * A sneaker store's ceiling light panels (Dash's, as the mockup drew them): x, y, width and height in a 390 px wide box, scaled to
 * the room's width. They're on the screen's backdrop, behind the room, so they're cut at `ceilY` (the highest top of any upright piece
 * drawn this frame): never seen through the gaps between the side walls' pieces, or over a wall, at any zoom or camera place.
 */
export const STORE_PANELS: readonly (readonly [x: number, y: number, w: number, h: number])[] = [
  [60, 18, 40, 12],
  [290, 18, 40, 12],
  [175, 60, 50, 18],
  [20, 120, 60, 22],
  [310, 120, 60, 22],
];
/** Panel `i` in a room `W` wide, cut at `ceilY` (screen px), into `out`; false when none of it is above `ceilY`. No allocation. */
export function ceilingPanel(i: number, W: number, ceilY: number, out: { x: number; y: number; w: number; h: number }): boolean {
  const p = STORE_PANELS[i]!;
  const k = W / 390;
  out.x = p[0] * k;
  out.y = p[1] * k;
  out.w = p[2] * k;
  out.h = Math.min(p[3] * k, ceilY - out.y);
  return out.h > 0;
}

/**
 * Every light of `lights` on every place its piece stands among `places`, place by place (Nov 3: a lantern or a bulb string stands in
 * several places; each place lights, not only one). `keep` picks the lights wanted (a halo, say). Made once as a room loads.
 */
export function lightsAt<L extends { piece: string }, P extends { name: string }>(lights: readonly L[], places: readonly P[], keep: (l: L) => boolean = () => true): { l: L; at: P }[] {
  const out: { l: L; at: P }[] = [];
  for (const at of places) for (const l of lights) if (l.piece === at.name && keep(l)) out.push({ l, at });
  return out;
}
/**
 * A pool of light's slow drift (Folio's windows' coloured pools, Nov 5: the art's `PoolDrift`): its middle swings `dx`, `dy` room
 * pixels either way on a sine over `ms`, starting `phase` (0 to 1) into it; every pool on one clock (the sun).
 */
export interface PoolDrift {
  readonly dx: number;
  readonly dy: number;
  readonly ms: number;
  readonly phase: number;
}
/** Where a drifting pool's middle is moved to `now` (room pixels, into `out`; mirrored with a mirrored piece). No drift: 0, 0. */
export function driftAt(d: PoolDrift | undefined, now: number, flip: boolean, out: { x: number; y: number }): { x: number; y: number } {
  if (!d) {
    out.x = out.y = 0;
    return out;
  }
  const s = Math.sin(2 * Math.PI * (now / d.ms + d.phase));
  out.x = (flip ? -d.dx : d.dx) * s;
  out.y = d.dy * s;
  return out;
}
/** A light's x in its piece's pixels, from the piece's foot, as the piece is drawn there: mirrored with a mirrored piece. */
export const litDx = (x: number, footX: number, flip: boolean): number => (flip ? footX - x : x - footX);

/** Your figure's box on screen, your feet at (x, y), `k` pixels a square, `sq` squares tall: into `out`. */
export function youBox(x: number, y: number, k: number, sq: number, out: { x0: number; y0: number; x1: number; y1: number }): void {
  out.x0 = x - 0.35 * sq * k;
  out.x1 = x + 0.35 * sq * k;
  out.y0 = y - sq * k;
  out.y1 = y;
}
/**
 * How opaque an upright piece is drawn: faded out near the camera (`nearFull` to `nearGone` deep, as before); in a cave, at most
 * `seeThrough` where it stands nearer the camera than you and its picture's box is over yours (`over`), so the rock never hides you.
 */
export function upAlpha(depth: number, over: boolean, cave: boolean): number {
  const near = Math.min(1, (depth - SHOP_FEEL.nearGone) / (SHOP_FEEL.nearFull - SHOP_FEEL.nearGone));
  return cave && over ? Math.min(near, SHOP_FEEL.seeThrough) : near;
}
/** Two boxes overlap. */
export const overlaps = (a: { x0: number; y0: number; x1: number; y1: number }, x0: number, y0: number, x1: number, y1: number): boolean =>
  a.x0 < x1 && x0 < a.x1 && a.y0 < y1 && y0 < a.y1;

export const inRoom = (room: Room, c: number, r: number): boolean => c >= 0 && r >= 0 && c < room.n && r < room.n;
export const walkable = (room: Room, c: number, r: number): boolean => inRoom(room, c, r) && !room.blocked[r * room.n + c];
const has = (list: readonly Sq[], c: number, r: number) => list.some((s) => s.c === c && s.r === r);
/** On a square just inside the way out ("Go out" shows). */
export const onDoor = (room: Room, c: number, r: number): boolean => has(room.doors, c, r);
/** How far a square is from the Shopkeeper: the larger of the two directions, to its nearest square. */
export const talkDist = (room: Room, c: number, r: number): number => Math.min(...room.keeper.map((k) => Math.max(Math.abs(k.c - c), Math.abs(k.r - r))));
/** Near enough to talk to the Shopkeeper (`SHOP_FEEL.talkRange`): on the floor (not up on a catwalk over him). */
export const inTalkRange = (room: Room, c: number, r: number, range: number = SHOP_FEEL.talkRange): boolean => !isUp(room.levels, c, r) && talkDist(room, c, r) <= range;

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/**
 * The squares one step from (c, r), walkable or not: the four next to it on the floor, and in a room with levels its links along
 * the chain (a stair's foot to its low square, the stairs and the catwalk square to square; levels.ts). A stair or catwalk square
 * steps only along its chain, and no floor square steps onto one except by a link.
 */
export function around(room: Room, c: number, r: number): Sq[] {
  const lv = room.levels;
  const out: Sq[] = [];
  if (!isUp(lv, c, r))
    for (const [dc, dr] of DIRS) {
      const nc = c + dc;
      const nr = r + dr;
      if (!isUp(lv, nc, nr)) out.push({ c: nc, r: nr });
    }
  if (lv && inRoom(room, c, r)) for (const k of linksOf(lv, r * room.n + c)) out.push({ c: k % room.n, r: Math.floor(k / room.n) });
  return out;
}
/**
 * The square an arrow key takes you to from (c, r) (`dc` across, `dr` along the room's rows), walkable or not, or null: one the
 * room steps to that way (`around`). Across (left, right): the one that way, straight or round the catwalk's curve (a diagonal
 * link); along (up, down): only straight, so on the catwalk up and down go nowhere, and from a stair's foot up climbs onto it.
 */
export function stepFor(room: Room, c: number, r: number, dc: number, dr: number): Sq | null {
  let diag: Sq | null = null;
  for (const s of around(room, c, r)) {
    const sc = Math.sign(s.c - c);
    const sr = Math.sign(s.r - r);
    if (dc !== 0) {
      if (sc !== Math.sign(dc)) continue;
      if (sr === 0) return s;
      if (Math.abs(s.c - c) === Math.abs(s.r - r)) diag ??= s;
    } else if (dr !== 0 && sc === 0 && sr === Math.sign(dr)) return s;
  }
  return diag;
}

/** Steps from `from` to every square (-1: can't get there), a square at a time, round what's blocked. */
export function stepsFrom(room: Room, from: Sq): Int16Array {
  const { n } = room;
  const d = new Int16Array(n * n).fill(-1);
  if (!inRoom(room, from.c, from.r)) return d;
  const start = from.r * n + from.c;
  d[start] = 0;
  const q = [start];
  for (let i = 0; i < q.length; i++) {
    const k = q[i]!;
    const c = k % n;
    const r = (k - c) / n;
    for (const s of around(room, c, r)) {
      if (!walkable(room, s.c, s.r) || d[s.r * n + s.c] !== -1) continue;
      d[s.r * n + s.c] = d[k]! + 1;
      q.push(s.r * n + s.c);
    }
  }
  return d;
}

/** The way from `from` to `to`, a square at a time (not `from` itself; empty if there already), or null: no way. */
export function findPath(room: Room, from: Sq, to: Sq): Sq[] | null {
  if (from.c === to.c && from.r === to.r) return [];
  if (!walkable(room, to.c, to.r)) return null;
  const d = stepsFrom(room, to); // (from the goal back: each step goes one nearer)
  if (d[from.r * room.n + from.c]! < 0) return null;
  const path: Sq[] = [];
  let at = from;
  while (at.c !== to.c || at.r !== to.r) {
    const k = d[at.r * room.n + at.c]!;
    const next = around(room, at.c, at.r).find((s) => walkable(room, s.c, s.r) && d[s.r * room.n + s.c] === k - 1)!;
    path.push(next);
    at = next;
  }
  return path;
}

/**
 * The square you can reach that suits best: the lowest `score` (null: not one), then the fewest steps; where you stand counts.
 * Null: none reachable.
 */
function best(room: Room, from: Sq, score: (c: number, r: number) => number | null): Sq | null {
  const d = stepsFrom(room, from);
  let out: Sq | null = null;
  let bs = Infinity;
  let bd = Infinity;
  for (let r = 0; r < room.n; r++)
    for (let c = 0; c < room.n; c++) {
      const k = d[r * room.n + c]!;
      if (k < 0) continue;
      const s = score(c, r);
      if (s === null) continue;
      if (s < bs || (s === bs && k < bd)) ((out = { c, r }), (bs = s), (bd = k));
    }
  return out;
}

/**
 * How well a square suits talking (lower is better; null: out of range): in front of the Shopkeeper, as far as the range
 * reaches (the counter between you, the kid in view), as near its middle column as can be.
 */
function talkSpot(room: Room, c: number, r: number): number | null {
  if (!inTalkRange(room, c, r)) return null;
  const k = room.keeper;
  const mid = k.reduce((a, s) => a + s.c, 0) / k.length;
  const front = Math.max(...k.map((s) => s.r)) + SHOP_FEEL.talkRange;
  return Math.abs(c - mid) + 2 * Math.abs(r - front);
}

/** What a tap means inside: a square to walk to, the Shopkeeper (walk into talking range) or the door (walk to the way out). */
export type RoomTap = { kind: "square" | "keeper" | "door"; dest: Sq | null };

/**
 * Where a tap on the square (c, r) sends you from `from`: the Shopkeeper or the counter, into talking range (`talkSpot`: in
 * front of it, the counter between you); the way out or a square just inside it, to the nearest of those; a free square, there; anything else solid, the
 * nearest free square to it. `dest` null: nowhere to go.
 */
export function tapTarget(room: Room, from: Sq, c: number, r: number): RoomTap {
  if (has(room.keeper, c, r) || has(room.counter, c, r)) return { kind: "keeper", dest: best(room, from, (x, y) => talkSpot(room, x, y)) };
  if (has(room.exits, c, r) || has(room.doors, c, r)) return { kind: "door", dest: best(room, from, (x, y) => (onDoor(room, x, y) ? Math.abs(x - c) : null)) };
  if (walkable(room, c, r)) return { kind: "square", dest: { c, r } };
  return { kind: "square", dest: best(room, from, (x, y) => Math.max(Math.abs(x - c), Math.abs(y - r))) };
}
