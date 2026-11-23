/**
 * The street town's home strips (Nov 5, round 5; Eric: "the only time it shifts is if you're standing … on the sidewalk … in front of
 * one of their buildings, and then it turns to show their building. And then when you step off back onto the street, it should [turn
 * back]"). A boss home's front strip is the sidewalk squares directly in front of its front, as wide as its front (its picture's body,
 * where its row put it). Standing on one, the camera faces that home's front head-on; anywhere else it faces north.
 *
 * Pure: no canvas. Town.tsx asks `stripAt` for the square you're on.
 */
import { N, colI, rowI } from "./camera.ts";
import { homeSpan, type Facing } from "./rows.ts";
import { STREET_GROUND, STREET_GROUND_KEY, STREET_HOMES } from "./street.ts";
import type { HomeId } from "./home-boxes.ts";

/** The heading (degrees from north, clockwise) that looks at a front facing `f` head-on: a front facing south is seen looking north. */
export const headingFacing = (f: Facing): number => ({ S: 0, W: 90, N: 180, E: 270 })[f];

export interface Strip {
  /** The art's home id (Dash's is "blitz"). */
  home: HomeId;
  facing: Facing;
  /** The camera's heading there: facing the home's front. */
  heading: number;
  /** Its squares, along its front. */
  squares: { c: number; r: number }[];
}

/**
 * A home's strip: the sidewalk squares on the row before its lot's front edge (S and N; the column before it, W and E) whose middles
 * lie over its body (at least half of each square under the front), paving only (a lamp stands on paving too: you just can't stand
 * on that square).
 */
export function stripOf(l: (typeof STREET_HOMES)[number]): Strip {
  const across = l.facing === "S" || l.facing === "N";
  const a = across ? l.c0 : l.r0;
  const [s0, s1] = homeSpan(l.id as HomeId, a, l.w, l.facing);
  const shift = l.shift ?? 0;
  const squares: { c: number; r: number }[] = [];
  const line = l.facing === "S" ? l.r0 - 1 : l.facing === "N" ? l.r0 + l.d : l.facing === "W" ? l.c0 - 1 : l.c0 + l.d;
  for (let k = Math.floor(s0 + shift) - 1; k <= Math.ceil(s1 + shift) + 1; k++) {
    // (The share of square k under the front: its middle within the body, give or take half a square.)
    const lo = Math.max(k - 0.5, s0 + shift);
    const hi = Math.min(k + 0.5, s1 + shift);
    if (hi - lo < 0.5) continue;
    const c = colI(across ? k : line);
    const r = rowI(across ? line : k);
    if (c < 0 || r < 0 || STREET_GROUND[r * N + c] !== STREET_GROUND_KEY["="]) continue;
    squares.push({ c, r });
  }
  return { home: l.id as HomeId, facing: l.facing, heading: headingFacing(l.facing), squares };
}

/** Every home's strip. */
export const STRIPS: readonly Strip[] = STREET_HOMES.map(stripOf);
const byKey = new Map<number, Strip>();
for (const s of STRIPS) for (const q of s.squares) byKey.set(q.r * N + q.c, s);

/** The strip square (c, r) is on, or null (a look-alike's sidewalk, the street, the park: none). */
export function stripAt(c: number, r: number): Strip | null {
  const cc = colI(Math.round(c));
  const rr = rowI(Math.round(r));
  return cc < 0 || rr < 0 ? null : (byKey.get(rr * N + cc) ?? null);
}

/**
 * The camera's normal heading on square (c, r): its strip's, or the base heading `base` (north unless a look round was locked in: Nov 5,
 * brief-street-controls-map.md). A strip's turn doesn't change the base: stepping off it goes back to the base heading.
 */
export const baseHeading = (c: number, r: number, base = 0): number => stripAt(c, r)?.heading ?? base;
