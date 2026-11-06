/**
 * A finger on the world, as a button (Eric, Oct 26: "pressing down feels like pressing down, lifting up releases"): down
 * on something presses the square you'd walk to; up on the same thing releases it and you set off; moving past a few
 * pixels first turns it into a look-around drag, and the square lets go without walking. No DOM here (Town.tsx feeds it
 * the pointer and acts on what it says), so it's tested on its own.
 *
 * Hold to run (the street town, Nov 5; brief-street-controls-map.md): three gestures, told apart by the drag threshold (`dragPx`) and
 * a hold time (`holdMs`):
 * - a quick tap (up before `holdMs`, never past `dragPx`): a walk, as before;
 * - a press that moves past `dragPx` before `holdMs`: a look round (a drag);
 * - a press held still past `holdMs`: a run. From then on the finger only steers: moving it never makes it a drag, and letting go
 *   ends the run (no walk).
 * Today's town passes no hold time (Infinity): its presses are taps and drags, as before.
 */
export type PressUp = "walk" | "cancel" | "drag" | "run" | "none";

/** What a press is now: nothing pressed, a press (a tap so far), a look round (a drag), a run. */
export type Gesture = "idle" | "press" | "look" | "run";

export class Press {
  private state: Gesture = "idle";
  private x0 = 0;
  private y0 = 0;
  private t0 = 0;
  /** What was under the finger at first (a key: the same thing under it at the end means "the same square"). */
  private key = "";

  constructor(
    private readonly dragPx: number,
    private readonly holdMs: number = Infinity,
  ) {}

  /** The finger went down at (x, y) on `key` (empty: nothing to press, only a drag or a run can follow) at `now` (ms). */
  down(x: number, y: number, key: string, now = 0): void {
    this.state = "press";
    this.x0 = x;
    this.y0 = y;
    this.t0 = now;
    this.key = key;
  }

  /**
   * The finger moved (at `now`): true once it has gone past the threshold and become a drag (the press is cancelled). A press already
   * held past the hold time is a run, whatever the finger does next (a move that comes in late, after the hold time, makes it one too):
   * a run's finger steers, it never drags.
   */
  move(x: number, y: number, now = 0): boolean {
    if (this.state === "press") {
      if (now - this.t0 >= this.holdMs) this.state = "run";
      else if (Math.hypot(x - this.x0, y - this.y0) > this.dragPx) this.state = "look";
    }
    return this.state === "look";
  }

  /** The frame's check (at `now`): true the moment a press held still becomes a run (once a press). */
  hold(now: number): boolean {
    if (this.state !== "press" || now - this.t0 < this.holdMs) return false;
    this.state = "run";
    return true;
  }

  /** What the press is now. */
  gesture(): Gesture {
    return this.state;
  }

  /** Pressed and not yet a drag or a run. */
  pressing(): boolean {
    return this.state === "press" && this.key !== "";
  }

  dragged(): boolean {
    return this.state === "look";
  }

  running(): boolean {
    return this.state === "run";
  }

  /** The finger lifted over `key`: walk (the same thing as at first, no drag), cancel (another), drag, run (a run ends), or none. */
  up(key: string): PressUp {
    const s = this.state;
    this.state = "idle";
    if (s === "idle") return "none";
    if (s === "look") return "drag";
    if (s === "run") return "run";
    if (!this.key) return "none";
    return key === this.key ? "walk" : "cancel";
  }

  /** The press was taken away (the pointer cancelled). */
  cancel(): void {
    this.state = "idle";
  }
}
