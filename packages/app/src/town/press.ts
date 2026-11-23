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
 * Every gesture is judged on the touch's own times (its events' `timeStamp`), never on when a busy page got round to them (Nov 14,
 * flaky round 3): a frame that runs while a quick tap's release still waits in the queue turns the press into a run (`hold`), but the
 * release, stamped before the hold time, says it was a tap after all, and `up` answers as for one: on what the finger pressed, as the
 * run has moved the camera under a finger that never moved (one that did, past `dragPx`, was no tap: nothing).
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
  /** The run came from the frame's check (`hold`), on the frame's clock, not from one of the finger's own events. */
  private byFrame = false;
  /** The finger went past `dragPx` from where it went down while running (a run's finger steers; it never drags). */
  private far = false;

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
    this.byFrame = false;
    this.far = false;
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
    } else if (this.state === "run" && Math.hypot(x - this.x0, y - this.y0) > this.dragPx) this.far = true;
    return this.state === "look";
  }

  /** The frame's check (at `now`): true the moment a press held still becomes a run (once a press). */
  hold(now: number): boolean {
    if (this.state !== "press" || now - this.t0 < this.holdMs) return false;
    this.state = "run";
    this.byFrame = true;
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

  /**
   * The finger lifted over `key` at `at` (the release's own time; unknown: it counts as late): walk (the same thing as at first, no
   * drag), cancel (another), drag, run (a run ends), or none. A run only the frame's check made, from a release stamped before the hold
   * time, was a tap: a busy page ran a frame before it handled the release. Its answer is on what the finger pressed (`walk`: the caller
   * walks to what was under the finger at first, whatever `key` is now, as the run moved the camera), or none if the finger moved.
   */
  up(key: string, at = Infinity): PressUp {
    const s = this.state;
    this.state = "idle";
    if (s === "idle") return "none";
    if (s === "look") return "drag";
    if (s === "run") {
      if (!(this.byFrame && at - this.t0 < this.holdMs)) return "run";
      return this.key && !this.far ? "walk" : "none";
    }
    if (!this.key) return "none";
    return key === this.key ? "walk" : "cancel";
  }

  /** The press was taken away (the pointer cancelled). */
  cancel(): void {
    this.state = "idle";
  }
}
