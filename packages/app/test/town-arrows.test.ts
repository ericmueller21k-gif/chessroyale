import { beforeEach, describe, expect, it } from "vitest";
import { KEY_DIR, hold, isHeld, keySteps, keyWalk, releaseAll, type KeyStep } from "../src/town/arrows.ts";
import { TOWN_FEEL } from "../src/town/feel.ts";
import { Walker, screenRow } from "../src/town/world.ts";
import { makeRoom, stepFor } from "../src/town/shops/room.ts";

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

/**
 * Eric's rule (Nov 5: "if you hold up in one of the rooms, it actually gave you the kind of sensation you're running down"): up is up
 * the screen everywhere, in the town and in every room. The town's rows run away from the camera (a row more is up the screen), a
 * room's toward it (a row less is up): the walker knows which (`rowsUp`), and its view and the arrow keys both follow it.
 */
describe("Eric's rule (Nov 5): up is up the screen in the town and in every room (Walker.rowsUp)", () => {
  const run = (w: Walker, k: { start: () => void }, ms: number) => {
    for (let t = 0; t < ms; t += 16) {
      k.start();
      w.update(t);
    }
  };
  /** Where `dir` held for a few steps takes a walker on (5, 5) whose rows run `rowsUp`, as the screen sees it, and the view it shows. */
  const walk = (rowsUp: 1 | -1, dir: "up" | "down" | "left" | "right", to?: (c: number, r: number, dc: number, dr: number) => { c: number; r: number } | null) => {
    const w = new Walker({ c: 5, r: 5 }, TOWN_FEEL.youStepMs, true, TOWN_FEEL.walkEase);
    w.rowsUp = rowsUp;
    const k = keyWalk(w, (c, r) => c >= 2 && c <= 8 && r >= 2 && r <= 8, undefined, to);
    hold(dir, true);
    run(w, k, 130);
    const view = w.view;
    hold(dir, false);
    run(w, k, 1000);
    // (On screen: right is a column more, up is a row more times rowsUp.)
    return { right: Math.sign(w.hereC() - 5), up: Math.sign(screenRow(w.hereR() - 5, rowsUp)) || 0, view };
  };
  const want = { up: { right: 0, up: 1, view: 1 }, down: { right: 0, up: -1, view: 2 }, left: { right: -1, up: 0, view: 0 }, right: { right: 1, up: 0, view: 0 } } as const;

  it("screenRow: a row more is up the screen in the town, down it in a room; the same flip both ways", () => {
    expect(screenRow(1, 1)).toBe(1);
    expect(screenRow(1, -1)).toBe(-1);
    expect(screenRow(-1, -1)).toBe(1);
    for (const up of [1, -1] as const) for (const d of [-2, -1, 0, 1, 2]) expect(screenRow(screenRow(d, up), up)).toBe(d);
  });

  for (const [where, rowsUp] of [["the town", 1], ["a room", -1]] as const)
    for (const dir of ["up", "down", "left", "right"] as const)
      it(`${where}: ${dir} goes ${dir} the screen and shows its ${dir === "up" ? "back" : dir === "down" ? "front" : "side"}`, () => {
        expect(walk(rowsUp, dir)).toEqual(want[dir]);
      });

  it("a room's row: up is a row less (toward the counter), down a row more (toward the door), through the room's own steps (stepFor)", () => {
    const room = makeRoom([], [], 20);
    const to = (c: number, r: number, dc: number, dr: number) => stepFor(room, c, r, dc, dr);
    for (const dir of ["up", "down", "left", "right"] as const) expect(walk(-1, dir, to), dir).toEqual(want[dir]);
  });

  it("the walker's view follows rowsUp for any walk (a tap's too): a row less in a room is its back, in the town its front", () => {
    const room = new Walker({ c: 5, r: 5 }, 100, false);
    room.rowsUp = -1;
    room.go([{ c: 5, r: 4 }]);
    room.update(0);
    expect(room.view, "a room: a row less is up the screen, its back").toBe(1);
    const town = new Walker({ c: 5, r: 5 }, 100, false);
    town.go([{ c: 5, r: 4 }]);
    town.update(0);
    expect(town.view, "the town: a row less is down the screen, its front").toBe(2);
  });
});
