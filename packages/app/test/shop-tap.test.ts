import { describe, expect, it } from "vitest";
import { newPt, newView, proj, setView } from "../src/town/camera.ts";
import { TOWN_FEEL } from "../src/town/feel.ts";
import { Press } from "../src/town/press.ts";
import { SHOP_GINGER_FLOOR, SHOP_GINGER_LAYOUT, SHOP_GINGER_STAIRS, SHOP_GINGER_UPPER } from "../src/town/shops/ginger-art.ts";
import { liftAt, makeLevels } from "../src/town/shops/levels.ts";
import { makeRoom, tapTarget } from "../src/town/shops/room.ts";
import { SHOPS } from "../src/town/shops/shops.ts";
import { pressKey, squareUnder } from "../src/town/shops/tap.ts";

/**
 * A tap in a shop's room (src/town/shops/tap.ts), on Ginger's igloo as the computer sees it (1280 x 800, zoomed out). The camera
 * trails your walk and glides on after you stop, so it can move between a finger's press and its release: the room picks what's
 * under the finger at both and walks you only if they're the same, as the town does (docs/decisions/2026-11-05-ginger-steps.md).
 */
const def = SHOPS.gingerbread!;
const room = makeRoom(SHOP_GINGER_LAYOUT, def.keeper, 20, SHOP_GINGER_FLOOR, def.talk, makeLevels({ upper: SHOP_GINGER_UPPER, stairs: SHOP_GINGER_STAIRS }, 20));
const SQ = TOWN_FEEL.housePxPerSquare;
const v = newView();
setView(v, 1280, 800, 0, 1, 0, 0, { tall: { ...TOWN_FEEL.camTall }, wide: { ...TOWN_FEEL.camWide } });
const q = [newPt(), newPt(), newPt(), newPt()];
/** Where a square's middle is drawn (up where a level lifts it) with the camera at (camX, camY). */
function mid(c: number, r: number, camX: number, camY: number) {
  const p = newPt();
  expect(proj(v, c - camX, camY - r, 0, p)).toBe(true);
  p.y -= (liftAt(room.levels, c, r) * p.k) / SQ;
  return p;
}
const keyAt = (x: number, y: number, camX: number, camY: number) => pressKey(room, false, squareUnder(room, v, camX, camY, SQ, x, y, q));

describe("a tap in a shop: the square under the finger", () => {
  it("a still camera: each square's middle is that square, on the floor, the stairs and the catwalk", () => {
    for (const [c, r] of [[5, 7], [5, 6], [5, 5], [6, 5], [7, 5], [9, 4], [12, 5], [14, 6], [7, 9]] as const) {
      const p = mid(c, r, 7, 5);
      expect(squareUnder(room, v, 7, 5, SQ, p.x, p.y, q), `${c},${r}`).toEqual({ c, r });
    }
  });

  it("the Shopkeeper's squares and the counter are one thing to press; anything else is its square; nothing is nothing", () => {
    expect(pressKey(room, true, null)).toBe("keeper");
    expect(pressKey(room, false, room.keeper[0]!)).toBe("keeper");
    if (room.counter[0]) expect(pressKey(room, false, room.counter[0])).toBe("keeper");
    expect(pressKey(room, false, { c: 5, r: 7 })).toBe("sq:5,7");
    expect(pressKey(room, false, null)).toBe("");
  });

  it("the camera gliding west between press and release (main's e2e, Nov 5): the release is on another square, so you don't walk, where the release alone sent you one short", () => {
    // You've just stepped onto (7, 5) from the catwalk, the camera still behind you (east and up) and catching up, about 0.6 of a
    // square in a 100 ms tap.
    const A = [7.6, 4.6] as const;
    const B = [7.0, 5.0] as const;
    const at = mid(5, 7, A[0], A[1]);
    const pressed = keyAt(at.x, at.y, A[0], A[1]);
    expect(pressed).toBe("sq:5,7");
    const under = squareUnder(room, v, B[0], B[1], SQ, at.x, at.y, q)!;
    expect(under).not.toEqual({ c: 5, r: 7 });
    // (Picked at the release only, as the room did: the square beside it, and a walk one short of the square pressed.)
    expect(under).toEqual({ c: 4, r: 7 });
    expect(tapTarget(room, { c: 7, r: 5 }, under.c, under.r).dest).toEqual({ c: 5, r: 6 });
    const press = new Press(TOWN_FEEL.dragPx);
    press.down(at.x, at.y, pressed);
    expect(press.up(keyAt(at.x, at.y, B[0], B[1]))).toBe("cancel");
  });

  it("the camera hardly moving between press and release: the same square, and you walk there", () => {
    const at = mid(5, 7, 7.02, 4.99);
    const press = new Press(TOWN_FEEL.dragPx);
    press.down(at.x, at.y, keyAt(at.x, at.y, 7.02, 4.99));
    expect(press.up(keyAt(at.x, at.y, 7.0, 5.0))).toBe("walk");
  });
});
