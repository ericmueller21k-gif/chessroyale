import { describe, expect, it } from "vitest";
import { SHOP_GINGER_DECK_H, SHOP_GINGER_FLOOR, SHOP_GINGER_LAYOUT, SHOP_GINGER_STAIRS, SHOP_GINGER_STEP, SHOP_GINGER_UPPER } from "../src/town/shops/ginger-art.ts";
import { QUARTER_MID, levelZ, liftAt, makeLevels } from "../src/town/shops/levels.ts";
import { around, findPath, makeRoom, stepFor, tapTarget, walkable, type Sq } from "../src/town/shops/room.ts";
import { SHOPS } from "../src/town/shops/shops.ts";

/**
 * Ginger's igloo candy shop and his challenge intro (Nov 5; docs/decisions/2026-11-05-ginger-home.md). This part: the room's two
 * walking levels (Eric, Nov 5: "The real test will be when I try to run up the stairs with the pawn and just see if it connects
 * properly ... it's actually connected to the ground and it's just like a continuous thing").
 */
const def = SHOPS.gingerbread!;
const LV = makeLevels({ upper: SHOP_GINGER_UPPER, stairs: SHOP_GINGER_STAIRS }, 20);
const room = makeRoom(SHOP_GINGER_LAYOUT, def.keeper, 20, SHOP_GINGER_FLOOR, def.talk, LV);
const sq = (c: number, r: number): Sq => ({ c, r });
const WEST = [sq(5, 6), sq(5, 5), sq(6, 5), sq(7, 5)];
const DECK = [sq(7, 5), sq(8, 4), sq(9, 4), sq(10, 4), sq(11, 4), sq(12, 5)];
const EAST = [sq(12, 5), sq(13, 5), sq(14, 5), sq(14, 6)];
/** Every point (every 1/200 of a square) along a walk from square to square, as a Walker goes (straight lines). */
function walkPoints(path: readonly Sq[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    for (let j = 0; j < 200; j++) out.push([a.c + ((b.c - a.c) * j) / 200, a.r + ((b.r - a.r) * j) / 200]);
  }
  const z = path[path.length - 1]!;
  out.push([z.c, z.r]);
  return out;
}

describe("the two levels: the height curve", () => {
  it("the art's numbers: the deck 40 px up, eight steps of 5 px a flight, the west flight (5, 5) low / (6, 5) high from its foot (5, 6), the east mirrored", () => {
    expect(SHOP_GINGER_DECK_H).toBe(40);
    expect(SHOP_GINGER_STEP).toBe(5);
    expect(SHOP_GINGER_UPPER.squares.map((s) => [s.c, s.r])).toEqual(DECK.map((s) => [s.c, s.r]));
    const w = SHOP_GINGER_STAIRS.west;
    const e = SHOP_GINGER_STAIRS.east;
    expect([w.foot, w.top, e.foot, e.top]).toEqual([sq(5, 6), sq(7, 5), sq(14, 6), sq(12, 5)]);
    expect(w.squares.map((s) => [s.c, s.r, ...s.quarters])).toEqual([
      [5, 5, 5, 10, 15, 20],
      [6, 5, 25, 30, 35, 40],
    ]);
    expect(e.squares.map((s) => [s.c, s.r, ...s.quarters])).toEqual([
      [14, 5, 20, 15, 10, 5],
      [13, 5, 40, 35, 30, 25],
    ]);
  });

  it("0 on the floor at each foot, 40 on the deck; on every step's middle, that step's height exactly", () => {
    for (const f of [sq(5, 6), sq(14, 6), sq(5, 7), sq(14, 7)]) expect(liftAt(LV, f.c, f.r), `${f.c},${f.r}`).toBe(0);
    for (const d of DECK) expect(liftAt(LV, d.c, d.r)).toBe(40);
    for (const st of [SHOP_GINGER_STAIRS.west, SHOP_GINGER_STAIRS.east])
      for (const s of st.squares) s.quarters.forEach((h, j) => expect(liftAt(LV, s.c - 0.5 + QUARTER_MID[j]!, s.r), `${s.c},${s.r} quarter ${j}`).toBeCloseTo(h, 9));
    // Nowhere on a flight is a figure more than about half a step (2.7 px: the art's last quarter is a pixel wider) off the step its
    // middle stands on.
    for (const st of [SHOP_GINGER_STAIRS.west, SHOP_GINGER_STAIRS.east])
      for (const s of st.squares)
        for (let x = s.c - 0.5; x <= s.c + 0.5; x += 0.01) {
          const q = Math.min(3, Math.max(0, [4, 13, 22, 31].findLastIndex((px) => (x - s.c + 0.5) * 37 + 4 >= px)));
          expect(Math.abs(liftAt(LV, x, s.r) - s.quarters[q]!), `${s.c},${s.r} at ${x.toFixed(2)}`).toBeLessThanOrEqual(2.7);
        }
    // The floor everywhere else, the squares in front of the deck too.
    for (const f of [sq(8, 5), sq(9, 6), sq(11, 5), sq(6, 6), sq(13, 6), sq(9.5, 9.5)]) expect(liftAt(LV, f.c, f.r)).toBe(0);
  });

  it("continuous: walking up either flight, along the catwalk and down the other, the lift never jumps (at most 0.5 px per 1/200 of a square) and rises (falls) steadily", () => {
    const route = [...WEST, ...DECK.slice(1), ...EAST.slice(1)];
    const pts = walkPoints(route);
    let prev = 0;
    let most = 0;
    for (const [x, y] of pts) {
      const h = liftAt(LV, x, y);
      most = Math.max(most, Math.abs(h - prev));
      prev = h;
    }
    expect(most).toBeLessThanOrEqual(0.5);
    expect(liftAt(LV, 5, 6)).toBe(0);
    expect(prev).toBe(0);
    // Up the west flight it only rises; down the east it only falls.
    const up = walkPoints(WEST).map(([x, y]) => liftAt(LV, x, y));
    const down = walkPoints(EAST).map(([x, y]) => liftAt(LV, x, y));
    for (let i = 1; i < up.length; i++) expect(up[i]!).toBeGreaterThanOrEqual(up[i - 1]! - 1e-9);
    for (let i = 1; i < down.length; i++) expect(down[i]!).toBeLessThanOrEqual(down[i - 1]! + 1e-9);
    expect(up[up.length - 1]).toBe(40);
    // Off the foot: still on the floor until the flight's front (the low square's south edge), then easing up onto the steps.
    expect(liftAt(LV, 5, 5.5)).toBe(0);
    expect(liftAt(LV, 5, 5.25)).toBeGreaterThan(0);
    expect(liftAt(LV, 5, 5)).toBeCloseTo(10 + (5 * (0.5 - 13.5 / 37)) / (9 / 37), 9);
  });

  it("drawn among the pieces half a square nearer once up (in front of the cards it stands on and next to), smoothly", () => {
    expect(levelZ(4, 40)).toBeCloseTo(4.51, 9);
    expect(levelZ(5, 40)).toBeCloseTo(5.51, 9);
    expect(levelZ(6, 0)).toBe(6);
    // Behind the floor in front: the shopkeeper (5.2) and the stand (row 6) are nearer than a figure on the deck over them.
    expect(levelZ(4, 40)).toBeLessThan(def.at[1]);
    let prev = levelZ(6, 0);
    for (const [x, y] of walkPoints(WEST)) {
      const z = levelZ(y, liftAt(LV, x, y));
      expect(Math.abs(z - prev)).toBeLessThan(0.02);
      prev = z;
    }
  });
});

describe("the two levels: walking", () => {
  it("the stair and catwalk squares are walkable, but only along the chain: from the floor only from a foot, and never off the deck's front edge", () => {
    for (const s of [...WEST, ...DECK, ...EAST]) expect(walkable(room, s.c, s.r), `${s.c},${s.r}`).toBe(true);
    const key = (s: Sq) => `${s.c},${s.r}`;
    const nb = (c: number, r: number) => around(room, c, r).filter((s) => walkable(room, s.c, s.r)).map(key).sort();
    expect(nb(5, 6)).toEqual(["5,5", "5,7", "6,6"]);
    expect(nb(5, 5)).toEqual(["5,6", "6,5"]);
    expect(nb(6, 5)).toEqual(["5,5", "7,5"]);
    expect(nb(7, 5)).toEqual(["6,5", "8,4"]);
    expect(nb(9, 4)).toEqual(["10,4", "8,4"]);
    expect(nb(12, 5)).toEqual(["11,4", "13,5"]);
    expect(nb(14, 5)).toEqual(["13,5", "14,6"]);
    // The floor in front of the deck and the high steps: no way up.
    for (const [c, r] of [[8, 5], [11, 5], [6, 6], [13, 6], [7, 6], [12, 6]] as const) for (const s of nb(c, r)) expect(LV.up[+s.split(",")[1]! * 20 + +s.split(",")[0]!], `${c},${r} -> ${s}`).toBe(0);
  });

  it("a tap on a deck square from the floor walks to the nearer staircase and up it; from the deck down the nearer one", () => {
    const path = (from: Sq, to: Sq) => findPath(room, from, to)!.map((s) => `${s.c},${s.r}`);
    expect(path(sq(6, 8), sq(9, 4)).slice(-6)).toEqual(["5,6", "5,5", "6,5", "7,5", "8,4", "9,4"]);
    const fromEast = path(sq(13, 8), sq(10, 4));
    expect(fromEast.slice(-5)).toEqual(["14,5", "13,5", "12,5", "11,4", "10,4"]);
    expect(fromEast).toContain("14,6");
    expect(path(sq(8, 4), sq(9, 9)).slice(0, 4)).toEqual(["7,5", "6,5", "5,5", "5,6"]);
    expect(tapTarget(room, sq(9, 12), 9, 4)).toEqual({ kind: "square", dest: sq(9, 4) });
  });

  it("the arrow keys: up from a foot climbs on, left and right go along the flight and round the catwalk's curve, up and down on the deck go nowhere", () => {
    expect(stepFor(room, 5, 6, 0, -1)).toEqual(sq(5, 5));
    expect(stepFor(room, 5, 5, 1, 0)).toEqual(sq(6, 5));
    expect(stepFor(room, 5, 5, 0, 1)).toEqual(sq(5, 6));
    expect(stepFor(room, 5, 5, 0, -1)).toBeNull();
    expect(stepFor(room, 7, 5, 1, 0)).toEqual(sq(8, 4));
    expect(stepFor(room, 8, 4, -1, 0)).toEqual(sq(7, 5));
    expect(stepFor(room, 9, 4, 0, 1)).toBeNull();
    expect(stepFor(room, 9, 4, 0, -1)).toBeNull();
    expect(stepFor(room, 12, 5, 1, 0)).toEqual(sq(13, 5));
    expect(stepFor(room, 14, 5, 0, 1)).toEqual(sq(14, 6));
    // On the floor in front of the deck, up is the wall.
    expect(stepFor(room, 8, 5, 0, -1)).toBeNull();
    expect(stepFor(room, 9, 9, 0, -1)).toEqual(sq(9, 8));
  });

  it("no talking to the shopkeeper from the catwalk over him", async () => {
    const { inTalkRange } = await import("../src/town/shops/room.ts");
    expect(inTalkRange(room, 9, 4)).toBe(false);
    expect(inTalkRange(room, 10, 4)).toBe(false);
  });
});
