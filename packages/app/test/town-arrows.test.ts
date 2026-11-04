import { beforeEach, describe, expect, it } from "vitest";
import { KEY_DIR, hold, isHeld, keySteps, keyWalk, releaseAll, type KeyStep } from "../src/town/arrows.ts";
import { TOWN_FEEL } from "../src/town/feel.ts";
import { Walker } from "../src/town/world.ts";

/**
 * Walking with the arrow keys (Eric, Nov 4; docs/areas/town-square.md, "Arrow keys"): hold a key and you run that way, square to
 * square at a tap's pace; two held is a diagonal (the axes alternate); the walk stops after the step in progress once nothing is
 * held, and at a wall. The keys: the arrows and WASD.
 */

const fresh = (): KeyStep[] => [
  { dc: 0, dr: 0, axis: 0 },
  { dc: 0, dr: 0, axis: 1 },
];

beforeEach(() => releaseAll());

describe("the held directions: the step each asks for", () => {
  it("nothing held asks for no step; up is one square along (away from you), right one square across", () => {
    const out = fresh();
    expect(keySteps(0, out)).toBe(0);
    hold("up", true);
    expect(keySteps(0, out)).toBe(1);
    expect(out[0]).toMatchObject({ dc: 0, dr: 1, axis: 1 });
    releaseAll();
    hold("right", true);
    expect(keySteps(1, out)).toBe(1);
    expect(out[0]).toMatchObject({ dc: 1, dr: 0, axis: 0 });
  });

  it("opposite keys cancel, so left and right together ask for nothing", () => {
    hold("left", true);
    hold("right", true);
    expect(keySteps(0, fresh())).toBe(0);
  });

  it("a diagonal (two held) asks for both axes, the one the last step didn't use first, so the walk alternates", () => {
    hold("up", true);
    hold("right", true);
    const out = fresh();
    expect(keySteps(0, out)).toBe(2);
    expect(out[0]).toMatchObject({ dc: 0, dr: 1, axis: 1 });
    expect(out[1]).toMatchObject({ dc: 1, dr: 0, axis: 0 });
    expect(keySteps(1, out)).toBe(2);
    expect(out[0]).toMatchObject({ dc: 1, dr: 0, axis: 0 });
  });

  it("the arrows and WASD are the same keys", () => {
    expect(KEY_DIR.ArrowUp).toBe("up");
    expect(KEY_DIR.KeyW).toBe("up");
    expect(KEY_DIR.ArrowDown).toBe("down");
    expect(KEY_DIR.KeyS).toBe("down");
    expect(KEY_DIR.ArrowLeft).toBe("left");
    expect(KEY_DIR.KeyA).toBe("left");
    expect(KEY_DIR.ArrowRight).toBe("right");
    expect(KEY_DIR.KeyD).toBe("right");
    expect(KEY_DIR.KeyE).toBeUndefined();
  });

  it("a press and a release set a direction; a second press of it changes nothing", () => {
    expect(isHeld("up")).toBe(false);
    hold("up", true);
    hold("up", true);
    expect(isHeld("up")).toBe(true);
    hold("up", false);
    expect(isHeld("up")).toBe(false);
  });
});

describe("keyWalk: a held key runs the walker on, at a tap's pace, and a release stops it after the step it's on", () => {
  /** Runs the walker `ms` on from `now`, asking for the key walk each frame (16 ms), and returns the time after. */
  const run = (w: Walker, k: { start: () => void }, now: number, ms: number): number => {
    for (let t = 0; t < ms; t += 16) {
      k.start();
      w.update(now + t);
    }
    return now + ms;
  };

  it("holding right walks on square after square with no stop between them, and stops after release", () => {
    const w = new Walker({ c: 5, r: 5 }, TOWN_FEEL.youStepMs, true, TOWN_FEEL.walkEase);
    const k = keyWalk(w, () => true);
    hold("right", true);
    let now = run(w, k, 0, 150);
    expect(w.moving()).toBe(true);
    now = run(w, k, now, 600);
    expect(w.hereC(), "several squares on").toBeGreaterThanOrEqual(10);
    expect(w.moving(), "still walking while held").toBe(true);
    hold("right", false);
    now = run(w, k, now, 1000);
    expect(w.moving(), "stopped once the step in progress was done").toBe(false);
    expect(w.hereR()).toBe(5);
  });

  it("a wall ends the walk at the square before it", () => {
    const w = new Walker({ c: 5, r: 5 }, TOWN_FEEL.youStepMs, true, TOWN_FEEL.walkEase);
    const k = keyWalk(w, (c) => c < 8);
    hold("right", true);
    const now = run(w, k, 0, 1500);
    expect(w.moving()).toBe(false);
    expect(w.hereC()).toBe(7);
    expect(now).toBeGreaterThan(0);
  });

  it("two held walks a diagonal: both squares change, and it's still one square a step", () => {
    const w = new Walker({ c: 5, r: 5 }, TOWN_FEEL.youStepMs, true, TOWN_FEEL.walkEase);
    const k = keyWalk(w, () => true);
    hold("up", true);
    hold("right", true);
    const now = run(w, k, 0, 1200);
    const dc = w.hereC() - 5;
    const dr = w.hereR() - 5;
    expect(dc).toBeGreaterThanOrEqual(3);
    expect(dr).toBeGreaterThanOrEqual(3);
    expect(Math.abs(dc - dr)).toBeLessThanOrEqual(1);
    expect(now).toBeGreaterThan(0);
  });

  it("a held key the walker can't step onto (a wall on one side) walks the other way that's open", () => {
    const w = new Walker({ c: 5, r: 5 }, TOWN_FEEL.youStepMs, true, TOWN_FEEL.walkEase);
    const k = keyWalk(w, (c) => c < 6);
    hold("up", true);
    hold("right", true);
    run(w, k, 0, 1000);
    expect(w.hereC()).toBeLessThanOrEqual(6);
    expect(w.hereR()).toBeGreaterThanOrEqual(8);
  });
});
