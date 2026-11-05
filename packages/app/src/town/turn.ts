/**
 * The street town's camera's turn (Nov 5; round 3 made it; round 5: north, but for a boss home's strip, strips.ts, and a drag's look
 * round, LookAround): the heading eases over `TOWN_FEEL.streetTurnMs` a quarter turn, about you (the camera keeps following you). The
 * arrow keys go through the normal heading (never the look round's). Pure: no DOM, nothing allocated on a frame.
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

/** The angle equal to `target` (mod 360) nearest `cur`: so an eased turn goes the short way round. */
export const nearestTurn = (target: number, cur: number): number => target + 360 * Math.round((cur - target) / 360);

/**
 * Looking around (Nov 5, round 5; Eric: "hold your mouse, move it a little to the left and bring it back to the right … so you could see
 * what the houses are to your left … but not where your pawn is standing or which direction he's facing … when you start to run again,
 * it snaps back"). A drag turns the camera about your pawn by an offset on top of its normal heading: dragging left turns the view left
 * (you see more to your left), `TOWN_FEEL.streetLookPerWidth` degrees a screen's width. Letting go keeps it; your first step eases it back
 * over `streetLookBackMs`. Pure: Town.tsx feeds it the drag and the step.
 */
export class LookAround {
  /** The offset (degrees) the drag set, or where the ease back started from. */
  private off = 0;
  private from = 0;
  private t0 = -Infinity;
  private dragFrom: number | null = null;
  /** The offset at `now` (degrees, clockwise: positive looks right). */
  at(now: number): number {
    if (this.t0 === -Infinity) return this.off;
    const t = (now - this.t0) / TOWN_FEEL.streetLookBackMs;
    if (t >= 1) {
      this.t0 = -Infinity;
      this.off = 0;
      return 0;
    }
    return this.from * (1 - ease(t));
  }
  /** Whether it's turned off the normal view (or still easing back) at `now`. */
  turned(now: number): boolean {
    return this.at(now) !== 0;
  }
  /** A drag begins (from wherever it is now: catching an ease back mid-way). */
  grab(now: number): void {
    this.off = this.at(now);
    this.t0 = -Infinity;
    this.dragFrom = this.off;
  }
  /** The drag is `dx` px across a box `width` px wide: dragging left (dx < 0) turns the view left. */
  drag(dx: number, width: number): void {
    if (this.dragFrom === null) return;
    this.off = this.dragFrom + (TOWN_FEEL.streetLookPerWidth * dx) / Math.max(1, width);
  }
  /** Let go: the view stays turned. */
  release(): void {
    this.dragFrom = null;
  }
  /** You set off (an arrow, a tap, the on-screen arrows): ease back to the normal view. Nothing while dragging or already there. */
  back(now: number): void {
    if (this.dragFrom !== null || this.t0 !== -Infinity || this.off === 0) return;
    // (The short way round.)
    this.off = nearestTurn(this.off, 0);
    this.from = this.off;
    this.t0 = now;
  }
}
