/**
 * A room's second walking level (Ginger's igloo, Nov 5: the first shop with one; shop-ginger-nov5.md on claude/boss-art, "The two
 * walking levels"): a catwalk along the back wall, `deckH` room pixels over the floor, reached only by its staircases, each one
 * straight flight on the catwalk's own row with a floor square at its foot. Pure: no DOM; tested in packages/app/test/shop-ginger.test.ts.
 *
 * - **Where you can go** is a chain of links: the foot to the flight's low square, low to high, high to the catwalk's end, and the
 *   catwalk square to square (the steps round the curve are diagonal), and the same down the other flight. A stair or catwalk square
 *   links only along the chain, so nobody steps onto the deck from the floor in front of it, or off its front edge.
 * - **How high a figure stands** is one curve for everyone (you and the elves): `liftAt(x, y)` of where its foot is (squares,
 *   fractions allowed). On the catwalk, the deck's height. On a flight, the steps' heights from the art (each quarter of a square
 *   its own step, 5 px apart), joined in straight lines between the steps' middles, so a figure walking up the flight rises evenly
 *   with no pops (a step's edge isn't a jump: at a walk's pace the 5 px steps would flicker), never more than about half a step
 *   (2.7 px) off the tread under its middle. Stepping onto the low square from its foot, the lift eases up from the floor over the half square in
 *   front of the flight (smoothly at both ends). Everywhere else, the floor: 0.
 * - **How it's drawn among the pieces** (`levelZ`): up there, just in front of the cards it stands on and next to (the mockup's rule,
 *   "at the depth of the row one nearer": half a square nearer), so the deck and the steps are behind it and everything nearer the
 *   camera in front, from every camera place.
 */
import type { Sq } from "./room.ts";

/** One staircase as the art gives it: its foot (a floor square), its two squares (low first) with each quarter's lift west to east, and the catwalk square at its top. */
export interface StairArt {
  foot: Sq;
  squares: readonly { c: number; r: number; quarters: readonly number[] }[];
  top: Sq;
}
/** The art's two levels (SHOP_GINGER_UPPER, SHOP_GINGER_STAIRS). */
export interface LevelsArt {
  upper: { h: number; squares: readonly Sq[] };
  stairs: { west: StairArt; east: StairArt };
}

/**
 * Each quarter's middle across its square (0 its west edge, 1 its east): the art's quarters are x 4-12, 13-21, 22-30 and 31-40 of
 * the 45 px card, whose square is x 4-40 (37 px), so their middles are 8.5, 17.5, 26.5 and 36 px.
 */
export const QUARTER_MID: readonly number[] = [4.5 / 37, 13.5 / 37, 22.5 / 37, 32 / 37];

interface Flight {
  foot: Sq;
  low: Sq;
  row: number;
  /** Its steps' middles (x, squares) and lifts, west to east. */
  xs: number[];
  hs: number[];
}

export interface Levels {
  n: number;
  deckH: number;
  /** 1 on every stair and catwalk square (k = r * n + c), 2 on a catwalk square. */
  up: Uint8Array;
  /** Each square's links along the chain (both ways), by k: the stairs' feet to their low squares, and the chain itself. */
  links: Map<number, number[]>;
  flights: Flight[];
}

export function makeLevels(art: LevelsArt, n: number): Levels {
  const up = new Uint8Array(n * n);
  const links = new Map<number, number[]>();
  const K = (s: Sq) => s.r * n + s.c;
  const link = (a: Sq, b: Sq) => {
    for (const [x, y] of [
      [a, b],
      [b, a],
    ] as const) {
      const l = links.get(K(x)) ?? [];
      if (!l.includes(K(y))) l.push(K(y));
      links.set(K(x), l);
    }
  };
  for (const s of art.upper.squares) up[K(s)] = 2;
  for (let i = 1; i < art.upper.squares.length; i++) link(art.upper.squares[i - 1]!, art.upper.squares[i]!);
  const flights: Flight[] = [];
  for (const st of [art.stairs.west, art.stairs.east]) {
    const [low, high] = st.squares;
    if (!low || !high) continue;
    up[K(low)] = 1;
    up[K(high)] = 1;
    link(st.foot, low);
    link(low, high);
    link(high, st.top);
    const pts: [number, number][] = [];
    for (const s of st.squares) s.quarters.forEach((h, j) => pts.push([s.c - 0.5 + QUARTER_MID[j]!, h]));
    pts.sort((a, b) => a[0] - b[0]);
    flights.push({ foot: st.foot, low: { c: low.c, r: low.r }, row: low.r, xs: pts.map((p) => p[0]), hs: pts.map((p) => p[1]) });
  }
  return { n, deckH: art.upper.h, up, links, flights };
}

/** The flight's steps' lift at x: straight between the steps' middles, level past its ends. */
function along(f: Flight, x: number): number {
  const { xs, hs } = f;
  if (x <= xs[0]!) return hs[0]!;
  for (let i = 1; i < xs.length; i++) if (x <= xs[i]!) return hs[i - 1]! + ((hs[i]! - hs[i - 1]!) * (x - xs[i - 1]!)) / (xs[i]! - xs[i - 1]!);
  return hs[hs.length - 1]!;
}
const smooth = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

/** The stair or catwalk square whose square (edges included) holds (x, y), as k; -1: none (the floor). */
function upAt(lv: Levels, x: number, y: number): number {
  const { n, up } = lv;
  const c0 = Math.round(x);
  const r0 = Math.round(y);
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const c = c0 + dc;
      const r = r0 + dr;
      if (c < 0 || r < 0 || c >= n || r >= n || !up[r * n + c]) continue;
      if (Math.abs(x - c) <= 0.5 + 1e-9 && Math.abs(y - r) <= 0.5 + 1e-9) return r * n + c;
    }
  return -1;
}

/** How high (room pixels over the floor) a figure whose foot is at (x, y) stands: the deck, a flight's steps, or the floor (0). */
export function liftAt(lv: Levels | null, x: number, y: number): number {
  if (!lv) return 0;
  const k = upAt(lv, x, y);
  if (k < 0) return 0;
  if (lv.up[k] === 2) return lv.deckH;
  const c = k % lv.n;
  const r = (k - c) / lv.n;
  for (const f of lv.flights) {
    if (f.row !== r) continue;
    if (x < f.xs[0]! - 0.5 || x > f.xs[f.xs.length - 1]! + 0.5) continue;
    const h = along(f, x);
    // (On the low square's near half, from its foot: easing up off the floor.)
    return c === f.low.c && y > r ? h * smooth((r + 0.5 - y) / 0.5) : h;
  }
  return 0;
}

/** Where a figure at (x, y), lifted `h`, is drawn among the room's pieces (their rows): on the levels, half a square nearer. */
export const levelZ = (y: number, h: number): number => y + 0.51 * Math.min(1, h / 5);

/** The squares a square links to along the chain (by k), or none. */
export const linksOf = (lv: Levels | null, k: number): readonly number[] => lv?.links.get(k) ?? NONE;
const NONE: readonly number[] = [];
/** A stair or catwalk square. */
export const isUp = (lv: Levels | null, c: number, r: number): boolean => !!lv && c >= 0 && r >= 0 && c < lv.n && r < lv.n && lv.up[r * lv.n + c]! > 0;
