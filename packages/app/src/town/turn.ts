/**
 * The street town's camera's turn (Nov 5; round 3 made it; round 5: north, but for a boss home's strip, strips.ts, and a drag's look
 * round, LookAround): the heading eases over `TOWN_FEEL.streetTurnMs` a quarter turn, about you (the camera keeps following you). The
 * arrow keys go through the normal heading (never the look round's). Since Nov 5 (brief-street-controls-map.md) the normal heading off a
 * strip is the base heading, any of the four quarters: a look round snapped to a quarter and locked in by a tap or a run (`lockIn`); north
 * as the town opens and after a building. Pure: no DOM, nothing allocated on a frame.
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

/** A heading brought into 0..360 (0, 90, 180, 270 for the quarters). */
export const mod360 = (h: number): number => ((h % 360) + 360) % 360;

/**
 * Looking around (Nov 5, round 5; Eric: "hold your mouse, move it a little to the left and bring it back to the right … so you could see
 * what the houses are to your left … but not where your pawn is standing or which direction he's facing … when you start to run again,
 * it snaps back"). A drag turns the camera about your pawn by an offset on top of its normal heading: dragging left turns the view left
 * (you see more to your left), `TOWN_FEEL.streetLookPerWidth` degrees a screen's width. Pure: Town.tsx feeds it the drag and the step.
 *
 * Locking a new view (Nov 5, brief-street-controls-map.md; Eric: "if it detects that you're … within 10 degrees of a new 90-degree
 * baseline, and then you tap in that direction, it switches your view … it locks in"):
 * - **Letting go** (`release` with the normal heading): within `streetSnapDeg` of a quarter (north, east, south or west), the view eases
 *   to it exactly over `streetSnapMs`; when that quarter isn't the normal heading's, it's `snapped`. Otherwise it stays where you left it.
 * - **A tap or a run next** (`lock`): a snapped quarter becomes the new base heading (Town.tsx turns the camera's normal heading to it, and
 *   the offset goes to 0: the camera doesn't move).
 * - **Not snapped**, or **an arrow next**: your first step eases it back to the normal view over `streetLookBackMs` (`back`), as before;
 *   a snap is forgotten.
 */
export class LookAround {
  /** The offset (degrees) the drag set, or where an ease is going. */
  private off = 0;
  private from = 0;
  private t0 = -Infinity;
  private ms = 0;
  private dragFrom: number | null = null;
  /** The quarter (0, 90, 180 or 270: a heading on the world) the last let-go snapped to, when it isn't the normal heading's; else null. */
  snapped: number | null = null;
  /** The offset at `now` (degrees, clockwise: positive looks right). */
  at(now: number): number {
    if (this.t0 === -Infinity) return this.off;
    const t = (now - this.t0) / this.ms;
    if (t >= 1) {
      this.t0 = -Infinity;
      // (A whole turn round is no turn: kept small.)
      if (mod360(this.off) === 0) this.off = 0;
      return this.off;
    }
    return this.from + (this.off - this.from) * ease(t);
  }
  /** Whether it's turned off the normal view (or still easing) at `now`. */
  turned(now: number): boolean {
    return this.at(now) !== 0;
  }
  /** Whether a drag is on. */
  dragging(): boolean {
    return this.dragFrom !== null;
  }
  /** A drag begins (from wherever it is now: catching an ease mid-way). A snap is forgotten until the drag's let go. */
  grab(now: number): void {
    this.off = this.at(now);
    this.t0 = -Infinity;
    this.dragFrom = this.off;
    this.snapped = null;
  }
  /** The drag is `dx` px across a box `width` px wide: dragging left (dx < 0) turns the view left. */
  drag(dx: number, width: number): void {
    if (this.dragFrom === null) return;
    this.off = this.dragFrom + (TOWN_FEEL.streetLookPerWidth * dx) / Math.max(1, width);
  }
  /**
   * Let go: the view stays turned; or, given the normal heading (the street town), within `streetSnapDeg` of a quarter it eases there
   * exactly (from `now`), and a quarter other than the normal heading's is `snapped`. Answers `snapped`.
   */
  release(now = 0, normal: number | null = null): number | null {
    if (this.dragFrom === null) return this.snapped;
    this.dragFrom = null;
    if (normal === null) return this.snapped;
    const total = normal + this.off;
    const q = Math.round(total / 90) * 90;
    if (Math.abs(total - q) > TOWN_FEEL.streetSnapDeg) return this.snapped;
    this.ease(q - normal, now, TOWN_FEEL.streetSnapMs);
    this.snapped = mod360(q) === mod360(normal) ? null : mod360(q);
    return this.snapped;
  }
  /**
   * A tap's walk or a run begins: a snapped quarter is taken (answered: the new base heading) and the offset goes to 0; the caller turns
   * the normal heading by `taken` (`lockTurn`), so the camera doesn't move. Null (nothing snapped): nothing changes.
   */
  lock(): number | null {
    const s = this.snapped;
    if (s === null || this.dragFrom !== null) return null;
    this.snapped = null;
    this.off = 0;
    this.t0 = -Infinity;
    return s;
  }
  /** You set off (an arrow, a tap, the on-screen arrows): ease back to the normal view, a snap forgotten. Nothing while dragging or already there. */
  back(now: number): void {
    if (this.dragFrom !== null) return;
    this.snapped = null;
    const cur = this.at(now);
    if (cur === 0 && this.t0 === -Infinity) return;
    // (Already easing back to the normal view: left alone.)
    if (this.t0 !== -Infinity && mod360(this.off) === 0) return;
    // (The short way round.)
    this.ease(0, now, TOWN_FEEL.streetLookBackMs, nearestTurn(cur, 0));
  }
  /** Straight to the normal view, no easing, nothing snapped (the town opening, coming out of a building). */
  reset(): void {
    this.off = this.from = 0;
    this.t0 = -Infinity;
    this.dragFrom = null;
    this.snapped = null;
  }
  /** Eases from where it is at `now` (or `from`) to offset `to` over `ms`. */
  private ease(to: number, now: number, ms: number, from = this.at(now)): void {
    this.from = from;
    this.off = to;
    this.t0 = now;
    this.ms = ms;
  }
}

/**
 * Locks a snapped quarter in as the base heading (Nov 5, brief-street-controls-map.md: a tap's walk or a run after a snap): the look
 * round's offset is taken into the camera's normal heading, so the camera stays where it is (a snap still easing finishes its last few
 * degrees as a turn). Answers the new base heading (0, 90, 180 or 270), or null when nothing was snapped (then nothing changes: your
 * first step eases the view back, `LookAround.back`).
 */
export function lockIn(turn: Turn, look: LookAround, now: number): number | null {
  const off = look.at(now);
  const base = look.lock();
  if (base === null) return null;
  const h = turn.at(now) + off;
  turn.set(h);
  turn.aim(nearestTurn(base, h), now);
  return base;
}

/**
 * The view as the town opens and as you come out of a building (Nov 5, brief-street-controls-map.md; Eric: "It'll always default back to
 * the normal [view] if you go into a building and come out"): the look round and any snap gone, the camera placed (no easing) at the
 * normal heading `normal` with the base heading north (`baseHeading(c, r, 0)`: north, or your square's strip's). Answers the base: 0.
 */
export function freshView(turn: Turn, look: LookAround, normal: number): 0 {
  look.reset();
  turn.set(normal);
  return 0;
}
