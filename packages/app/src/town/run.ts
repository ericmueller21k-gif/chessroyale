/**
 * Hold to run (Nov 5, brief-street-controls-map.md; Eric: "If you hold your mouse click down right now, it does nothing … if you hold it
 * in the direction … up, down, left or right … right away … it starts running in that direction"). A press held still past
 * `TOWN_FEEL.streetHoldMs` (press.ts) runs you the way your finger is from your pawn on screen, snapped to up, down, left or right of the
 * view; while it's held, moving the finger changes the way (and never turns the camera: "the ability to rotate the screen is locked when
 * you're in the running state"); letting go stops you at the next square.
 *
 * The run holds one of the arrows' directions (arrows.ts `hold`), so it is the arrow keys' walk exactly: the same pace, the same squares,
 * the same normal view (up is up the screen), the same card at a home's door, and the same stop after the step it's on. Pure but for that.
 */
import { hold, type Dir } from "./arrows.ts";

/**
 * The way a finger `dx` right and `dy` down the screen from your pawn asks for: the nearer of up, down, left and right (a tie goes
 * across); null within `dead` px of it.
 */
export function runDir(dx: number, dy: number, dead: number): Dir | null {
  if (dx * dx + dy * dy <= dead * dead) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

/** The finger's run: the direction it holds now (null: none yet). */
export class FingerRun {
  dir: Dir | null = null;
  /** The finger is `dx`, `dy` from your pawn (screen px): hold the way it asks for (within `dead`: the way it had, if any). */
  steer(dx: number, dy: number, dead: number): void {
    const d = runDir(dx, dy, dead);
    if (d === null || d === this.dir) return;
    if (this.dir) hold(this.dir, false);
    this.dir = d;
    hold(d, true);
  }
  /** Let go: the held way is released (the walk stops after the step it's on). */
  stop(): void {
    if (this.dir) hold(this.dir, false);
    this.dir = null;
  }
}
