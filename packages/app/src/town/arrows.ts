/**
 * Walking with the arrow keys (Eric, Nov 4): hold a key and your character runs that way, as long as it's held; two held is a
 * diagonal (one square across, then one along, so every step is the same as a tap's). The on-screen arrows (bottom right, over the
 * zoom pill) and the keyboard's arrow keys (and WASD) feed one set of held directions; the walker asks for its next square as it
 * begins each step (Walker.run), so the walk runs on without stopping between squares, and stops after the step in progress once
 * nothing is held. Walls, the floor and people are the walker's own checks (`ok`). Nothing here allocates on a frame that walks
 * nowhere. No DOM beyond the window's key events, so the choices are tested on their own.
 */
import type { Walker, Sq } from "./world.ts";

export type Dir = "up" | "down" | "left" | "right";

/** Which directions are held (by a key or an on-screen arrow). Booleans, not a Set: a frame reads them without an iterator. */
const on = { up: false, down: false, left: false, right: false };
const listeners = new Set<() => void>();

/** Presses (true) or releases (false) a direction; tells the listeners (the arrows' lit state). */
export function hold(d: Dir, down: boolean): void {
  if (on[d] === down) return;
  on[d] = down;
  for (const f of listeners) f();
}

/** Whether a direction is held now. */
export const isHeld = (d: Dir): boolean => on[d];

/** Whether any direction is held now. */
export const anyHeld = (): boolean => on.up || on.down || on.left || on.right;

/** Calls `f` whenever a direction is pressed or released. Returns its stop. */
export function onHeld(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** Every direction off (a window losing focus or going hidden: a key's release may never come). */
export function releaseAll(): void {
  for (const d of ["up", "down", "left", "right"] as const) hold(d, false);
}

/** The key (KeyboardEvent.code) to direction: the arrows, and WASD (it clashes with nothing in the app). */
export const KEY_DIR: Readonly<Record<string, Dir>> = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };

/** Whether a key press is for typing (an input, a text box, a chat log's list): the arrows then do what they always do. */
export function typingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || !!t.closest('[role="log"], [role="textbox"]');
}

/** Listens to the keyboard on `win` (the arrows and WASD, not while typing): returns its stop. */
export function listenKeys(win: Window = window): () => void {
  const down = (e: KeyboardEvent) => {
    const d = KEY_DIR[e.code];
    if (!d || e.altKey || e.ctrlKey || e.metaKey || typingTarget(e.target)) return;
    e.preventDefault();
    hold(d, true);
  };
  const up = (e: KeyboardEvent) => {
    const d = KEY_DIR[e.code];
    if (d) hold(d, false);
  };
  const off = () => releaseAll();
  const vis = () => document.hidden && releaseAll();
  win.addEventListener("keydown", down);
  win.addEventListener("keyup", up);
  win.addEventListener("blur", off);
  document.addEventListener("visibilitychange", vis);
  return () => {
    win.removeEventListener("keydown", down);
    win.removeEventListener("keyup", up);
    win.removeEventListener("blur", off);
    document.removeEventListener("visibilitychange", vis);
    releaseAll();
  };
}

/** One step on the grid: across (c) or along (r), by `dc` or `dr`. `axis` is the one it moves along (0 across, 1 along). */
export interface KeyStep {
  dc: number;
  dr: number;
  axis: 0 | 1;
}

/**
 * The steps the held arrows ask for, most wanted first (written into `out`, two at most): up is along +1 (the town's rows run
 * away from you), right is across +1. Two held (a diagonal) gives both axes, the one the last step did not use first, so a
 * diagonal is a staircase at the same pace as a walk. Opposite keys cancel. Returns how many (0: none). Writes into the
 * objects it's given: nothing is allocated (a frame may ask every frame).
 */
export function keySteps(lastAxis: 0 | 1, out: KeyStep[]): number {
  const dc = (on.right ? 1 : 0) - (on.left ? 1 : 0);
  const dr = (on.up ? 1 : 0) - (on.down ? 1 : 0);
  if (dc === 0 && dr === 0) return 0;
  if (dc !== 0 && dr !== 0) {
    const a: 0 | 1 = lastAxis === 0 ? 1 : 0;
    const b: 0 | 1 = a === 1 ? 0 : 1;
    setStep(out[0]!, a, dc, dr);
    setStep(out[1]!, b, dc, dr);
    return 2;
  }
  setStep(out[0]!, dc !== 0 ? 0 : 1, dc, dr);
  return 1;
}
const setStep = (s: KeyStep, axis: 0 | 1, dc: number, dr: number): void => {
  s.axis = axis;
  s.dc = axis === 0 ? dc : 0;
  s.dr = axis === 1 ? dr : 0;
};

/**
 * Keeps `w` walking with the held arrows: `ok(c, r)` says whether a square can be stood on (a wall, the floor, someone's square:
 * the walker's own check), `wrap` brings a square into the world (the town's wraps; a room's doesn't). Returns `start`, to call each
 * frame while a direction is held: a walker standing still takes its first step. The walker asks `run` for the square after each
 * step it begins, so a held key keeps it going (no stop between squares); with no key held, the walk ends after the step it's on.
 */
export function keyWalk(w: Walker, ok: (c: number, r: number) => boolean, wrap: (v: number) => number = (v) => v): { start: () => void } {
  let lastAxis: 0 | 1 = 0;
  const steps: KeyStep[] = [
    { dc: 0, dr: 0, axis: 0 },
    { dc: 0, dr: 0, axis: 1 },
  ];
  const next = (fc: number, fr: number): Sq | null => {
    const n = keySteps(lastAxis, steps);
    for (let i = 0; i < n; i++) {
      const s = steps[i]!;
      const c = wrap(fc + s.dc);
      const r = wrap(fr + s.dr);
      if (ok(c, r)) {
        lastAxis = s.axis;
        return { c, r };
      }
    }
    return null;
  };
  w.run(next);
  return {
    start: () => {
      if (w.moving() || !anyHeld()) return;
      const n = next(w.hereC(), w.hereR());
      if (n) w.go([n]);
    },
  };
}
