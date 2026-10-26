/**
 * A finger on the world, as a button (Eric, Oct 26: "pressing down feels like pressing down, lifting up releases"): down
 * on something presses the square you'd walk to; up on the same thing releases it and you set off; moving past a few
 * pixels first turns it into a look-around drag, and the square lets go without walking. No DOM here (Town.tsx feeds it
 * the pointer and acts on what it says), so it's tested on its own.
 */
export type PressUp = "walk" | "cancel" | "drag" | "none";

export class Press {
  private on = false;
  private dragging = false;
  private x0 = 0;
  private y0 = 0;
  /** What was under the finger at first (a key: the same thing under it at the end means "the same square"). */
  private key = "";

  constructor(private readonly dragPx: number) {}

  /** The finger went down at (x, y) on `key` (empty: nothing to press, only a drag can follow). */
  down(x: number, y: number, key: string): void {
    this.on = true;
    this.dragging = false;
    this.x0 = x;
    this.y0 = y;
    this.key = key;
  }

  /** The finger moved: true once it has gone past the threshold and become a drag (the press is cancelled). */
  move(x: number, y: number): boolean {
    if (!this.on) return false;
    if (!this.dragging && Math.hypot(x - this.x0, y - this.y0) > this.dragPx) this.dragging = true;
    return this.dragging;
  }

  /** Pressed and not yet a drag. */
  pressing(): boolean {
    return this.on && !this.dragging && this.key !== "";
  }

  dragged(): boolean {
    return this.on && this.dragging;
  }

  /** The finger lifted over `key`: walk (the same thing as at first, no drag), cancel (another), drag, or none. */
  up(key: string): PressUp {
    if (!this.on) return "none";
    this.on = false;
    if (this.dragging) return "drag";
    if (!this.key) return "none";
    return key === this.key ? "walk" : "cancel";
  }

  /** The press was taken away (the pointer cancelled). */
  cancel(): void {
    this.on = false;
  }
}
