/**
 * The street town's camera's turn (Nov 5; round 3 made it, round 4's chase camera aims it): the heading eases over
 * `TOWN_FEEL.streetTurnMs` a quarter turn, about you (the camera keeps following you). The arrow keys go through it. Pure: no DOM,
 * nothing allocated on a frame.
 */
import { TOWN_FEEL } from "./feel.ts";

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
  out.dc = dc * fr + dr * fc || 0;
  out.dr = -dc * fc + dr * fr || 0;
}

/**
 * The chase camera's heading (Nov 5, round 4; brief-town-rows.md "the player's view"): behind you, looking the way you walk, snapped to
 * the four board directions. `cur` is where it's aiming now (any multiple of 90, unwrapped); a step (dc, dr) on a leg of `leg` squares
 * that way (`last`: the path's last leg) turns it, the shortest way round, when:
 *  - by the keys (`keys`): any step but one straight back (down steps back without turning; left and right turn you);
 *  - on a tap's path: a leg of 2 squares or more, or the last leg (so a zig-zag doesn't whip it round).
 * Answers the heading to aim at (`cur` if it stays).
 */
export function chaseTarget(cur: number, dc: number, dr: number, leg: number, last: boolean, keys: boolean): number {
  if (!dc && !dr) return cur;
  const want = dc > 0 ? 90 : dc < 0 ? 270 : dr > 0 ? 0 : 180;
  const d = ((((want - cur) % 360) + 540) % 360) - 180;
  if (Math.abs(d) < 1) return cur;
  if (keys) return Math.abs(d) > 179 ? cur : cur + d;
  return leg >= 2 || last ? cur + (Math.abs(d) > 179 ? 180 : d) : cur;
}
