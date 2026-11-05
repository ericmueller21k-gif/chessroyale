/**
 * The street town's turning camera (Nov 5, round 3; the art's plan, town-plan-nov5.md "Streets and the camera"): it faces north
 * everywhere except on Seam Avenue, where it faces east, so it always looks at the fronts; on the avenue's four crossings (the turn
 * zones) it faces north, so it turns as you walk out of a crossing along the avenue or into one. The heading eases over about half a
 * second a quarter turn (`TOWN_FEEL.streetTurnMs`), about you (the camera keeps following you). The arrow keys
 * go through it: up is always up the screen. Pure: no DOM, nothing allocated on a frame.
 */
import PLAN from "./street-plan.json";
import { N, wrapI } from "./camera.ts";
import { TOWN_FEEL } from "./feel.ts";

const AVE = PLAN.streets.find((s) => s.cam !== 0)!;
/** Seam Avenue's squares across (its board and a sidewalk either side: c 43..2), and the rows of its four crossings (the turn zones). */
const onAve = new Uint8Array(N);
for (let c = AVE.c0 - 1; c <= AVE.c1 + 1; c++) onAve[wrapI(c)] = 1;
const inZone = new Uint8Array(N);
for (const z of PLAN.turnZones) for (let r = z.rows[0]!; r <= z.rows[1]!; r++) inZone[wrapI(r)] = 1;

/** Where the camera faces on square (c, r): east (90) on Seam Avenue outside its crossings, north (0) everywhere else. */
export function camAt(c: number, r: number): 0 | 90 {
  const cc = wrapI(Math.round(c));
  const rr = wrapI(Math.round(r));
  return onAve[cc] && !inZone[rr] ? (AVE.cam as 90) : 0;
}

/** Smooth in and out over 0..1. */
const ease = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** The camera's heading over time: where it eases from, where to, and since when. */
export class Turn {
  from = 0;
  to = 0;
  t0 = -Infinity;
  /** How long this turn takes (ms): a quarter turn's time, less for a shorter one (a turn back caught midway). */
  ms = 0;
  constructor(start = 0) {
    this.from = this.to = start;
  }
  /** The heading at `now` (degrees: 0 north to 90 east; the town's headings are those two). */
  at(now: number): number {
    if (this.ms <= 0) return this.to;
    const t = (now - this.t0) / this.ms;
    return t >= 1 ? this.to : this.from + (this.to - this.from) * ease(t);
  }
  /** Whether it's still turning at `now`. */
  turning(now: number): boolean {
    return this.at(now) !== this.to;
  }
  /** Aims at `target` from `now` (nothing changes if it's already aiming there): from wherever it is, a quarter turn's time a quarter. */
  aim(target: number, now: number): void {
    if (target === this.to) return;
    const h = this.at(now);
    this.from = h;
    this.to = target;
    this.t0 = now;
    this.ms = (TOWN_FEEL.streetTurnMs * Math.abs(target - h)) / 90;
  }
  /** Straight to `h`, no easing (the camera placed, not turned). */
  set(h: number): void {
    this.from = this.to = h;
    this.ms = 0;
  }
}

/** The quarter turn a heading is nearest (0 north, 1 east, 2 south, 3 west): the arrow keys' frame. */
export const quarterOf = (heading: number): number => ((Math.round(heading / 90) % 4) + 4) % 4;

/**
 * A step `dc` across and `dr` up the screen (the arrow keys': right +1, up +1), as a step on the world's squares (east, north) when the
 * camera faces `quarter` (quarterOf): up is always up the screen. Writes into `out`.
 */
export function screenStep(dc: number, dr: number, quarter: number, out: { dc: number; dr: number }): void {
  // (Up the screen is the camera's ahead; right, its right: north and east facing north; east and south facing east.)
  const q = ((quarter % 4) + 4) % 4;
  const fc = q === 1 ? 1 : q === 3 ? -1 : 0;
  const fr = q === 0 ? 1 : q === 2 ? -1 : 0;
  // Right is ahead turned a quarter clockwise: (fc, fr) -> (fr, -fc).
  out.dc = dc * fr + dr * fc;
  out.dr = -dc * fc + dr * fr;
}
