import { describe, expect, it } from "vitest";
import { SHOP_TOWER_LAYOUT, SHOP_TOWER_N } from "../src/town/shops/tower-art.ts";
import { SHOP_TOWER_FLOOR_LAYOUT, SHOP_TOWER_FLOOR_N } from "../src/town/shops/tower-floor-art.ts";
import { SHOP_BABUR_LAYOUT } from "../src/town/shops/babur-art.ts";
import { atDoor, doorGoal, doorOf, findPath, makeRoom, onDoorPic, onDoor, opaqueNear, passAt } from "../src/town/shops/room.ts";
import { SHOPS } from "../src/town/shops/shops.ts";
import { SHOP_FEEL } from "../src/town/feel.ts";

/**
 * Inside rooms, a tap on a door's picture from anywhere opens its card, and its button runs you to the door (Eric, Nov 20: "you should
 * be able to tap on the door, like no matter where you're standing, and then hit go in, and then it would just run you to the door").
 * The room's pure side (room.ts): which pieces are doors, the finger's box on a door's picture, where its Go runs you, and that you're
 * at the door there (where the card's action happens). The pictures' boxes on screen and the cards: e2e/battle-tower.spec.ts.
 */
const lobby = makeRoom(SHOP_TOWER_LAYOUT, SHOPS.tower!.keeper, SHOP_TOWER_N);
const floor = makeRoom(SHOP_TOWER_FLOOR_LAYOUT, [], SHOP_TOWER_FLOOR_N);
const babur = makeRoom(SHOP_BABUR_LAYOUT, SHOPS.tiger!.keeper);

describe("a door's picture inside a room (Nov 20)", () => {
  it("the doors are the way out and each door to another room: the lobby's elevator (up) and its way out; the floor's elevator and way down", () => {
    const doors = (layout: typeof SHOP_TOWER_LAYOUT) => layout.map(doorOf).filter((d) => d !== null);
    expect(doors(SHOP_TOWER_LAYOUT).sort()).toEqual(["out", "top"]);
    expect(doors(SHOP_TOWER_FLOOR_LAYOUT).sort()).toEqual(["front", "top"]);
    expect(doors(SHOP_BABUR_LAYOUT)).toEqual(["out"]);
    // (Floor tiles named for a door, the lobby's mat inside its doors, are never a door.)
    expect(SHOP_TOWER_LAYOUT.filter((p) => p.name.startsWith("floor-door")).map(doorOf)).toEqual([null, null]);
  });

  it("a finger finds the picture: its box grown a little each way, and a small one to a finger's size at least", () => {
    const pad = SHOP_FEEL.doorPad;
    const big = { x0: 100, y0: 50, x1: 180, y1: 200 };
    expect(onDoorPic(big, 140, 120)).toBe(true);
    expect(onDoorPic(big, 100 - pad + 1, 50 - pad + 1)).toBe(true);
    expect(onDoorPic(big, 100 - pad - 1, 120)).toBe(false);
    expect(onDoorPic(big, 140, 200 + pad + 1)).toBe(false);
    const tiny = { x0: 10, y0: 10, x1: 14, y1: 14 };
    expect(onDoorPic(tiny, 12 + SHOP_FEEL.doorMinPx / 2 - 1, 12)).toBe(true);
    expect(onDoorPic(tiny, 12 + SHOP_FEEL.doorMinPx / 2 + 1, 12)).toBe(false);
  });

  it("what you see is the door: a drawn pixel of its picture near the finger; the floor through a gap in its box is not", () => {
    // (A 10 x 10 picture, drawn only in its middle 4 x 4, its top 8 rows shown.)
    const w = 10;
    const a = new Uint8ClampedArray(w * w * 4);
    for (let y = 3; y < 7; y++) for (let x = 3; x < 7; x++) a[(y * w + x) * 4 + 3] = 255;
    expect(opaqueNear(a, w, 8, 5, 5, 0)).toBe(true);
    expect(opaqueNear(a, w, 8, 0, 0, 1)).toBe(false);
    expect(opaqueNear(a, w, 8, 1, 1, 2)).toBe(true);
    expect(opaqueNear(a, w, 8, 9, 9, 2)).toBe(false);
    // (Rows past its shown strip don't count.)
    expect(opaqueNear(a, w, 3, 5, 5, 1)).toBe(false);
  });

  it("from every square of each room, Go runs you to a square just inside that door, where you're at it (its card's action happens there)", () => {
    for (const [name, room, tos] of [
      ["lobby", lobby, ["out", "top"]],
      ["floor", floor, ["front", "top"]],
      ["Babur's", babur, ["out"]],
    ] as const)
      for (const to of tos)
        for (let r = 0; r < room.n; r++)
          for (let c = 0; c < room.n; c++) {
            if (room.blocked[r * room.n + c]) continue;
            const from = { c, r };
            const goal = doorGoal(room, from, to);
            expect(goal, `${name} ${to} from (${c}, ${r})`).not.toBeNull();
            expect(atDoor(room, goal!.c, goal!.r, to), `${name} ${to}: (${goal!.c}, ${goal!.r}) is at it`).toBe(true);
            expect(findPath(room, from, goal!), `${name} ${to}: a way there`).not.toBeNull();
            // (Already there: it's where you stand, no walk.)
            if (atDoor(room, c, r, to)) expect(goal).toEqual(from);
          }
  });

  it("at a door is the arrival card's own test: the way out's squares inside it (onDoor), a door to another room's by where it leads (passAt)", () => {
    for (const room of [lobby, floor, babur])
      for (let r = 0; r < room.n; r++)
        for (let c = 0; c < room.n; c++) {
          expect(atDoor(room, c, r, "out")).toBe(onDoor(room, c, r));
          for (const to of ["front", "top"] as const) expect(atDoor(room, c, r, to)).toBe(passAt(room, c, r)?.to === to);
        }
  });
});
