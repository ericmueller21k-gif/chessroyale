/**
 * The street town's zoom (Nov 5, round 4): steps, not a switch (Eric: "3 or 4 zoom steps on + and −"), and the park's auto zoom (Eric, a
 * trial he may revert: "make it zoom out one level when you hit the area that's the … center town square … if it's like a nice
 * transition"). Pure: no DOM; Town.tsx asks it each frame where the camera's zoom is, and tells it where you stand and what you press.
 *
 * - − and + move one step (feel.ts streetZoomSteps: 0 in, 1 the default, 2 out, 3 the overview), gliding `streetZoomMs`.
 * - Coming fully into the park eases one step out (from wherever you are; nothing at the furthest step) over `parkZoomMs`; going fully
 *   out of it eases back to the step you had. A press in the park wins: you leave at the step you chose.
 * - Fully in or fully out (`parkSide`): a square of slack at the park's edge, so walking along it doesn't pump the zoom.
 */
import { STREET_PARK } from "./street.ts";
import { TOWN_FEEL } from "./feel.ts";
import { colI, rowI } from "./camera.ts";

const ease = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** Is square (c, r) the park's (its box: the plus with its twelve tables, and the walks in it)? */
export function isPark(c: number, r: number): boolean {
  const cc = colI(c);
  const rr = rowI(r);
  const P = STREET_PARK;
  return cc >= P.c0 && cc < P.c0 + P.w && rr > P.r1 - P.d && rr <= P.r1;
}
/**
 * Which side of the park's edge square (c, r) is: true fully in (a park square whose four neighbours are the park's too), false fully
 * out (no park square on it or beside it), null in the square of slack between.
 */
export function parkSide(c: number, r: number): boolean | null {
  const here = isPark(c, r);
  const n = +isPark(c + 1, r) + +isPark(c - 1, r) + +isPark(c, r + 1) + +isPark(c, r - 1);
  if (here && n === 4) return true;
  if (!here && n === 0) return false;
  return null;
}

export class StreetZoom {
  /** The step it's aiming at. */
  step: number;
  private from: number;
  private t0 = -Infinity;
  private ms = 0;
  /** The step you had as the park zoomed you out (null: the park hasn't, or you pressed − or + since). */
  before: number | null = null;
  /** Whether you're in the park (as `where` last heard: fully in, until fully out). */
  inPark: boolean;
  constructor(
    start: number = TOWN_FEEL.streetZoomStart,
    /** Where you open: in the park, it doesn't zoom you out as the town opens (you didn't come into it); it does once you leave and come back. */
    openInPark = false,
    readonly last: number = TOWN_FEEL.streetZoomSteps.length - 1,
  ) {
    this.step = this.from = start;
    this.inPark = openInPark;
  }
  /** The zoom at `now` (fractional while it glides). */
  at(now: number): number {
    if (this.ms <= 0) return this.step;
    const t = (now - this.t0) / this.ms;
    return t >= 1 ? this.step : this.from + (this.step - this.from) * ease(t);
  }
  private aim(step: number, now: number, ms: number): void {
    if (step === this.step) return;
    this.from = this.at(now);
    this.step = step;
    this.t0 = now;
    this.ms = ms;
  }
  /** − (out) or +: one step, gliding. In the park, your choice wins (leaving won't change it). Answers the step. */
  press(out: boolean, now: number): number {
    this.aim(Math.max(0, Math.min(this.last, this.step + (out ? 1 : -1))), now, TOWN_FEEL.streetZoomMs);
    this.before = null;
    return this.step;
  }
  /** Straight to `step` (a test, a shop's door): no glide; the park's memory forgotten. */
  set(step: number): void {
    this.step = this.from = step;
    this.ms = 0;
    this.before = null;
  }
  /** Where you stand (`parkSide`: true fully in the park, false fully out, null the slack): the park's zoom, eased. */
  where(side: boolean | null, now: number): void {
    if (side === null || side === this.inPark) return;
    this.inPark = side;
    if (!TOWN_FEEL.parkZoomOut) return;
    if (side) {
      if (this.step >= this.last) return;
      this.before = this.step;
      this.aim(this.step + 1, now, TOWN_FEEL.parkZoomMs);
    } else if (this.before !== null) {
      this.aim(this.before, now, TOWN_FEEL.parkZoomMs);
      this.before = null;
    }
  }
}
