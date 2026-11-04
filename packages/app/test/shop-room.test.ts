import { describe, expect, it } from "vitest";
import { SHOP_BABUR_LAYOUT } from "../src/town/shops/babur-art.ts";
import { SHOP_PUDDLES_LAYOUT } from "../src/town/shops/puddles-art.ts";
import { SHOP_ALFIL_LAYOUT } from "../src/town/shops/alfil-art.ts";
import { SHOP_BIGBOY_LAYOUT } from "../src/town/shops/bigboy-art.ts";
import { SHOP_TIMBER_LAYOUT, SHOP_TIMBER_MARKS } from "../src/town/shops/timber-art.ts";
import { SHOP_BLITZ_CRATE_AT, SHOP_BLITZ_LAYOUT, SHOP_BLITZ_MARKS, SHOP_BLITZ_PIECES } from "../src/town/shops/blitz-art.ts";
import { STORE_PANELS, ceilingPanel, findPath, inTalkRange, makeRoom, onDoor, stepsFrom, tapTarget, walkable, type Room, type Sq } from "../src/town/shops/room.ts";
import { POOL_LINE, buyBossCrate, canAfford, inInventoryLine, holdLine, priceLine, prizeRows, shopOf, wayText, SHOPS } from "../src/town/shops/shops.ts";
import { bossCrateOf } from "@chessroyale/core";
import { ALL_HOMES } from "../src/town/world.ts";
import { SHOP_FEEL } from "../src/town/feel.ts";

/**
 * Inside a shop (Nov 2, round 1; shops/room.ts): which squares you can stand on, the way out, the Shopkeeper's talking range and
 * where a tap sends you, in both rooms as the art lays them out; and the shop's words (shops/shops.ts).
 */
const babur = makeRoom(SHOP_BABUR_LAYOUT, SHOPS.tiger!.keeper);
const puddles = makeRoom(SHOP_PUDDLES_LAYOUT, SHOPS.gardener!.keeper);
const alfil = makeRoom(SHOP_ALFIL_LAYOUT, SHOPS.alfil!.keeper);
const bigboy = makeRoom(SHOP_BIGBOY_LAYOUT, SHOPS.bigboy!.keeper);
const timber = makeRoom(SHOP_TIMBER_LAYOUT, SHOPS.timber!.keeper);
const dash = makeRoom(SHOP_BLITZ_LAYOUT, SHOPS.dash!.keeper);
/**
 * Each room, and two far squares you can walk to and a wall square to tap beside: the back corners and the west wall for the first
 * three; Big Boy's crib is a ball pit (solid) but for its raised floors, so its far squares are the shop platform's back corners and
 * its wall square the back wall over the platform.
 */
const ROUND = { far: [{ c: 2, r: 2 }, { c: 17, r: 1 }], wall: { c: 0, r: 15 } };
const rooms: [string, Room, { far: Sq[]; wall: Sq }][] = [
  ["Babur's", babur, ROUND],
  ["Puddles'", puddles, ROUND],
  ["Alfil's", alfil, ROUND],
  ["Big Boy's", bigboy, { far: [{ c: 4, r: 1 }, { c: 15, r: 1 }], wall: { c: 6, r: 0 } }],
  ["Timber's", timber, ROUND],
  ["Dash's", dash, ROUND],
];

describe.each(rooms)("%s room", (_name, room, spots) => {
  it("is 20 x 20 squares; its walls (the edge) are never walkable", () => {
    expect(room.n).toBe(20);
    for (let i = 0; i < 20; i++) for (const [c, r] of [[i, 0], [i, 19], [0, i], [19, i]] as const) expect(walkable(room, c, r), `${c},${r}`).toBe(false);
    expect(walkable(room, -1, 5)).toBe(false);
    expect(walkable(room, 5, 20)).toBe(false);
  });

  it("the counter and the Shopkeeper's squares are solid", () => {
    for (let c = 8; c <= 11; c++) expect(walkable(room, c, 3), `counter ${c},3`).toBe(false);
    for (const k of room.keeper) expect(walkable(room, k.c, k.r)).toBe(false);
  });

  it("the way out: its two squares in the front wall, the two just inside where 'Go out' shows; you start a step further in", () => {
    expect(room.exits).toEqual([
      { c: 9, r: 19 },
      { c: 10, r: 19 },
    ]);
    expect(room.doors).toEqual([
      { c: 9, r: 18 },
      { c: 10, r: 18 },
    ]);
    for (const d of room.doors) expect(walkable(room, d.c, d.r)).toBe(true);
    expect(onDoor(room, 9, 18) && onDoor(room, 10, 18)).toBe(true);
    expect(onDoor(room, 10, 17)).toBe(false);
    expect(room.start).toEqual({ c: 10, r: 17 });
    expect(walkable(room, room.start.c, room.start.r)).toBe(true);
    expect(inTalkRange(room, room.start.c, room.start.r)).toBe(false);
  });

  it("every square you can stand on is reachable from the door, and a path never crosses anything solid", () => {
    const d = stepsFrom(room, room.start);
    for (let r = 0; r < 20; r++) for (let c = 0; c < 20; c++) if (walkable(room, c, r)) expect(d[r * 20 + c], `${c},${r}`).toBeGreaterThanOrEqual(0);
    const talk = tapTarget(room, room.start, room.keeper[0]!.c, room.keeper[0]!.r).dest!;
    for (const to of [talk, room.doors[0]!, ...spots.far]) {
      const path = findPath(room, room.start, to)!;
      expect(path, `${to.c},${to.r}`).not.toBeNull();
      let at: Sq = room.start;
      for (const s of path) {
        expect(Math.abs(s.c - at.c) + Math.abs(s.r - at.r)).toBe(1);
        expect(walkable(room, s.c, s.r)).toBe(true);
        at = s;
      }
      expect(at).toEqual(to);
    }
    expect(findPath(room, room.start, { c: 9, r: 3 })).toBeNull(); // (the counter)
  });

  it("a tap on the Shopkeeper or the counter walks you into talking range; on the way out, to a square just inside it; on a wall, beside it", () => {
    for (const [c, r] of [[room.keeper[0]!.c, room.keeper[0]!.r], [9, 3]] as const) {
      const t = tapTarget(room, room.start, c, r);
      expect(t.kind).toBe("keeper");
      expect(walkable(room, t.dest!.c, t.dest!.r)).toBe(true);
      expect(inTalkRange(room, t.dest!.c, t.dest!.r)).toBe(true);
    }
    const out = tapTarget(room, { c: 5, r: 10 }, 9, 19);
    expect(out.kind).toBe("door");
    expect(onDoor(room, out.dest!.c, out.dest!.r)).toBe(true);
    expect(tapTarget(room, room.start, 6, 15)).toEqual(walkable(room, 6, 15) ? { kind: "square", dest: { c: 6, r: 15 } } : expect.anything());
    const wall = tapTarget(room, room.start, spots.wall.c, spots.wall.r);
    expect(wall.kind).toBe("square");
    expect(Math.max(Math.abs(wall.dest!.c - spots.wall.c), Math.abs(wall.dest!.r - spots.wall.r))).toBe(1);
  });
});

describe("the rooms' own pieces", () => {
  it("Babur's: the three burning hoops, the pedestal and the props are solid; the ring is walkable", () => {
    for (const [c, r] of [[15, 5], [16, 5], [17, 5], [16, 9], [18, 9], [15, 13], [17, 13], [9, 10], [3, 7], [2, 3], [3, 3]] as const) expect(walkable(babur, c, r), `${c},${r}`).toBe(false);
    for (const [c, r] of [[10, 10], [8, 8], [11, 13], [14, 9]] as const) expect(walkable(babur, c, r), `${c},${r}`).toBe(true);
  });

  it("Puddles': the pond garden lies on all of its 5 x 8 squares (columns 14-18, rows 6-13), none walkable; the circle is", () => {
    for (let r = 6; r <= 13; r++) for (let c = 14; c <= 18; c++) expect(walkable(puddles, c, r), `${c},${r}`).toBe(false);
    for (const [c, r] of [[13, 10], [14, 5], [14, 14], [9, 10]] as const) expect(walkable(puddles, c, r), `${c},${r}`).toBe(true);
  });

  it("Big Boy's: you walk on the walkway, the shop's platform and the battle circle; the ball pit is solid, and so are the airplane's 3 x 3 squares and the props", () => {
    const at = (c: number, r: number) => walkable(bigboy, c, r);
    // The walkway: from the door north to the circle, from the circle to the platform, the east arm (under the airplane) and the west arm.
    for (let r = 15; r <= 18; r++) for (const c of [9, 10]) expect(at(c, r), `walkway ${c},${r}`).toBe(true);
    for (const r of [5, 6]) for (const c of [9, 10]) expect(at(c, r), `walkway ${c},${r}`).toBe(true);
    for (let c = 14; c <= 17; c++) for (const r of [10, 11]) expect(at(c, r), `east arm ${c},${r}`).toBe(true);
    for (let c = 4; c <= 5; c++) for (const r of [10, 11]) expect(at(c, r), `west arm ${c},${r}`).toBe(true);
    // The platform (columns 4-15, rows 1-4) but the counter (columns 8-11, row 3), its props and the Shopkeeper.
    for (const [c, r] of [[4, 1], [15, 1], [6, 4], [13, 3], [12, 2]] as const) expect(at(c, r), `platform ${c},${r}`).toBe(true);
    for (const [c, r] of [[8, 3], [11, 3], [9, 2], [10, 2], [5, 2], [14, 2], [12, 4]] as const) expect(at(c, r), `counter, keeper, props ${c},${r}`).toBe(false);
    // The circle: its middle squares and its marks (columns 8 and 11, rows 10-11).
    for (let r = 8; r <= 13; r++) for (let c = 7; c <= 12; c++) expect(at(c, r), `circle ${c},${r}`).toBe(true);
    // The pit: every square off the raised floors (here a sample round the room), and the airplane over columns 15-17, rows 7-9.
    for (const [c, r] of [[2, 2], [17, 2], [2, 7], [3, 13], [16, 14], [6, 17], [13, 17], [5, 6], [14, 6], [7, 16], [12, 15]] as const) expect(at(c, r), `pit ${c},${r}`).toBe(false);
    for (let r = 7; r <= 9; r++) for (let c = 15; c <= 17; c++) expect(at(c, r), `airplane ${c},${r}`).toBe(false);
    // The rocking horse at the west arm's end (columns 2-3).
    expect(at(2, 10)).toBe(false);
    // Every square you can stand on is the walkway's, the platform's, the circle's or the doorway's: none is a pit square.
    const pit = new Set(SHOP_BIGBOY_LAYOUT.filter((p) => /^pit/.test(p.name)).map((p) => `${p.col},${p.row}`));
    expect(pit.size).toBeGreaterThan(150);
    for (let r = 0; r < 20; r++) for (let c = 0; c < 20; c++) if (pit.has(`${c},${r}`)) expect(at(c, r), `pit ${c},${r}`).toBe(false);
  });

  it("Timber's: the counter, the carved king's dais (4 x 2), the stove and the props are solid; the battle circle, its marks and the way to the counter are walkable", () => {
    const at = (c: number, r: number) => walkable(timber, c, r);
    // The showpiece stands up whole on columns 15-18, rows 3-4 (its foot on row 4): all eight squares solid.
    for (let r = 3; r <= 4; r++) for (let c = 15; c <= 18; c++) expect(at(c, r), `showpiece ${c},${r}`).toBe(false);
    // The stove, the plank stack, the big king and queen, the knight, the display table, the log pile, the chopping block, the rough
    // carving, the sawhorse, the toolbox and the east plank stack.
    for (const [c, r] of [[2, 3], [4, 2], [5, 2], [2, 8], [3, 8], [2, 11], [2, 14], [3, 14], [1, 17], [2, 17], [4, 17], [15, 8], [16, 8], [15, 12], [16, 12], [17, 15], [15, 17], [16, 17]] as const) expect(at(c, r), `prop ${c},${r}`).toBe(false);
    // Columns 8-11 are clear from the door to the counter; the circle's middle squares and both start marks.
    for (let r = 4; r <= 18; r++) for (const c of [9, 10]) expect(at(c, r), `aisle ${c},${r}`).toBe(true);
    for (const m of [SHOP_TIMBER_MARKS.boss, SHOP_TIMBER_MARKS.you]) expect(at(m[0], Math.floor(m[1])) && at(m[0], Math.ceil(m[1])), `mark ${m}`).toBe(true);
    expect(SHOP_TIMBER_MARKS).toEqual({ boss: [8, 10.5], you: [11, 10.5] });
    // Round the showpiece: in front of its dais and beside it.
    for (const [c, r] of [[15, 5], [18, 5], [14, 4], [14, 3]] as const) expect(at(c, r), `by the showpiece ${c},${r}`).toBe(true);
    // Rivet behind the middle of the workbench, as Blocky and Woolly stand.
    expect(SHOPS.timber!.keeper).toEqual([{ c: 9, r: 2 }, { c: 10, r: 2 }]);
    expect(tapTarget(timber, timber.start, 9, 2).dest).toEqual({ c: 10, r: 5 });
  });

  it("Dash's: the counter, the halfpipe (4 x 2), the Cheetah Chug, the racks, benches, cases and boxes are solid; the battle circle, its marks and the running lane to the counter are walkable", () => {
    const at = (c: number, r: number) => walkable(dash, c, r);
    // The halfpipe stands up whole on columns 15-18, rows 3-4 (its foot on row 4): all eight squares solid.
    for (let r = 3; r <= 4; r++) for (let c = 15; c <= 18; c++) expect(at(c, r), `halfpipe ${c},${r}`).toBe(false);
    expect(SHOP_BLITZ_PIECES.showpiece!.w).toBe(4 * 37);
    // The counter (8-11, row 3), the pallet, the fridges, the plants, the racks, the benches, the pedestals and the boxes.
    for (let c = 8; c <= 11; c++) expect(at(c, 3), `counter ${c},3`).toBe(false);
    for (const [c, r] of [[2, 3], [3, 3], [4, 2], [1, 5], [6, 1], [13, 1], [4, 5], [5, 5], [2, 8], [3, 8], [16, 8], [17, 8], [2, 11], [3, 11], [15, 9], [16, 9], [15, 11], [17, 11], [2, 14], [3, 14], [16, 14], [17, 14], [1, 17], [3, 17], [4, 17], [6, 17], [13, 17], [15, 17], [16, 17], [18, 17], [18, 6]] as const) expect(at(c, r), `prop ${c},${r}`).toBe(false);
    // The lane: columns 9-10 clear from the door to the counter; the circle's middle squares and both start marks (try-on mats).
    for (let r = 4; r <= 18; r++) for (const c of [9, 10]) expect(at(c, r), `lane ${c},${r}`).toBe(true);
    for (const m of [SHOP_BLITZ_MARKS.boss, SHOP_BLITZ_MARKS.you]) expect(at(m[0], Math.floor(m[1])) && at(m[0], Math.ceil(m[1])), `mark ${m}`).toBe(true);
    expect(SHOP_BLITZ_MARKS).toEqual({ boss: [8, 10.5], you: [11, 10.5] });
    // In front of the halfpipe and beside it.
    for (const [c, r] of [[15, 5], [18, 5], [14, 4], [14, 3]] as const) expect(at(c, r), `by the halfpipe ${c},${r}`).toBe(true);
    // Tick behind the counter on its middle squares (30 px tall), drawn half a square back and west so his head shows over it, clear
    // of the shoe boxes; the crate on its east end.
    expect(SHOPS.dash!.keeper).toEqual([{ c: 9, r: 2 }, { c: 10, r: 2 }]);
    expect(SHOPS.dash!.at).toEqual([9, 1.5]);
    expect(tapTarget(dash, dash.start, 9, 2).dest).toEqual({ c: 10, r: 5 });
    expect(SHOP_BLITZ_CRATE_AT).toEqual([124, 16]);
  });

  it("Dash's ceiling light panels never show below the walls' tops (the director's review, Nov 3): each is cut at the highest wall top, at any width", () => {
    const out = { x: 0, y: 0, w: 0, h: 0 };
    for (const W of [320, 390, 770, 1440])
      for (let ceilY = -50; ceilY <= 900; ceilY += 7) {
        let shown = 0;
        for (let i = 0; i < STORE_PANELS.length; i++) {
          if (!ceilingPanel(i, W, ceilY, out)) continue;
          shown++;
          // Wholly above the wall tops, never taller than the mockup's panel, inside the box's width.
          expect(out.y + out.h, `${W} ${ceilY} panel ${i}`).toBeLessThanOrEqual(ceilY);
          expect(out.h).toBeGreaterThan(0);
          expect(out.h).toBeLessThanOrEqual((STORE_PANELS[i]![3] * W) / 390 + 1e-9);
          expect(out.x >= 0 && out.x + out.w <= W).toBe(true);
        }
        // With the wall tops at the screen's top (or above it) none shows; with them low enough, all five whole.
        if (ceilY <= 0) expect(shown).toBe(0);
        if (ceilY >= (142 * W) / 390) expect(shown).toBe(STORE_PANELS.length);
      }
  });

  it("talking range: three squares either way from the Shopkeeper's squares (SHOP_FEEL.talkRange)", () => {
    expect(SHOP_FEEL.talkRange).toBe(3);
    // Stripes beside the counter's east end (12, 2 and 13, 2); Drizzle behind its middle (9, 2 and 10, 2).
    expect(inTalkRange(babur, 12, 5)).toBe(true);
    expect(inTalkRange(babur, 16, 5)).toBe(true);
    expect(inTalkRange(babur, 9, 4)).toBe(true);
    expect(inTalkRange(babur, 12, 6)).toBe(false);
    expect(inTalkRange(babur, 8, 4)).toBe(false);
    expect(inTalkRange(puddles, 6, 4)).toBe(true);
    expect(inTalkRange(puddles, 13, 5)).toBe(true);
    expect(inTalkRange(puddles, 9, 6)).toBe(false);
    expect(inTalkRange(puddles, 5, 4)).toBe(false);
  });

  it("a tap on the Shopkeeper walks you in front of it, the counter between you, as far as talking reaches", () => {
    expect(tapTarget(babur, babur.start, 12, 2).dest).toEqual({ c: 12, r: 5 });
    expect(tapTarget(puddles, puddles.start, 9, 2).dest).toEqual({ c: 10, r: 5 });
  });
});

describe("the shops", () => {
  it("only Babur's, Puddles', Alfil's, Big Boy's, Timber's, Dash's, Hollow's, Wrangler's and Jefferson's homes have an inside", () => {
    expect(ALL_HOMES.filter((h) => shopOf(h.id)).map((h) => h.id).sort()).toEqual(["alfil", "bigboy", "dash", "gardener", "grex", "hollow", "pig", "tiger", "timber"]);
  });

  it("the crates' words: names, the price line, what you have; the boss's ride is a prize", () => {
    const b = shopOf("tiger")!;
    const p = shopOf("gardener")!;
    expect(b.crate).toBe("Babur's Boss Crate");
    expect(p.crate).toBe("Puddles' Boss Crate");
    expect(priceLine(b)).toBe("3 Babur tokens, or 1 Babur token + 1 crate key");
    expect(priceLine(p)).toBe("3 Puddles tokens, or 1 Puddles token + 1 crate key");
    expect(wayText(b, "tokens")).toBe("3 Babur tokens");
    expect(wayText(b, "key")).toBe("1 Babur token + 1 crate key");
    expect(holdLine(b, { tokens: 0, keys: 0 })).toBe("You have 0 Babur tokens and 0 crate keys.");
    expect(holdLine(b, { tokens: 1, keys: 1 })).toBe("You have 1 Babur token and 1 crate key.");
    expect(prizeRows(b)[0]).toMatchObject({ id: "balloon-pup", name: "Balloon Pup", kind: "Mythic ride" });
    expect(prizeRows(p)[0]).toMatchObject({ id: "puddles-mower", name: "Puddles's Mower", kind: "Mythic ride" });
    const a = shopOf("alfil")!;
    expect(a.crate).toBe("Alfil's Boss Crate");
    expect(priceLine(a)).toBe("3 Alfil tokens, or 1 Alfil token + 1 crate key");
    expect(prizeRows(a)[0]).toMatchObject({ id: "alfil-howdah", name: "Alfil's Howdah", kind: "Mythic ride" });
    const g = shopOf("bigboy")!;
    expect(g.crate).toBe("Big Boy's Boss Crate");
    expect(priceLine(g)).toBe("3 Big Boy tokens, or 1 Big Boy token + 1 crate key");
    expect(holdLine(g, { tokens: 0, keys: 0 })).toBe("You have 0 Big Boy tokens and 0 crate keys.");
    expect(prizeRows(g)[0]).toMatchObject({ id: "bigboy-buggy", name: "Big Boy's Buggy", kind: "Mythic ride" });
    const t = shopOf("timber")!;
    expect(t.crate).toBe("Timber's Boss Crate");
    expect(priceLine(t)).toBe("3 Timber tokens, or 1 Timber token + 1 crate key");
    expect(holdLine(t, { tokens: 0, keys: 0 })).toBe("You have 0 Timber tokens and 0 crate keys.");
    expect(prizeRows(t)[0]).toMatchObject({ id: "log-roller", name: "The Log Roller", kind: "Mythic ride" });
    expect([t.kid, t.roof, t.chatTone]).toEqual(["timber", "lodge", "day"]);
    const d = shopOf("dash")!;
    expect(d.crate).toBe("Dash's Boss Crate");
    expect(priceLine(d)).toBe("3 Dash tokens, or 1 Dash token + 1 crate key");
    expect(holdLine(d, { tokens: 0, keys: 0 })).toBe("You have 0 Dash tokens and 0 crate keys.");
    expect(prizeRows(d)[0]).toMatchObject({ id: "cheetah-shoes", name: "Cheetah Shoes", kind: "Mythic ride" });
    expect([d.kid, d.roof, d.chatTone]).toEqual(["blitz", "store", "day"]);
    const h = shopOf("hollow")!;
    expect(h.crate).toBe("Hollow's Boss Crate");
    expect(priceLine(h)).toBe("3 Hollow tokens, or 1 Hollow token + 1 crate key");
    expect(holdLine(h, { tokens: 0, keys: 0 })).toBe("You have 0 Hollow tokens and 0 crate keys.");
    expect(prizeRows(h)[0]).toMatchObject({ id: "hollow-bulb", name: "Hollow's Bulb", kind: "Mythic ride" });
    expect([h.kid, h.roof, h.chatTone]).toEqual(["hollowdog", "cave", "night"]);
    const w = shopOf("pig")!;
    expect(w.crate).toBe("Wrangler's Boss Crate");
    expect(priceLine(w)).toBe("3 Wrangler tokens, or 1 Wrangler token + 1 crate key");
    expect(holdLine(w, { tokens: 0, keys: 0 })).toBe("You have 0 Wrangler tokens and 0 crate keys.");
    expect(prizeRows(w)[0]).toMatchObject({ id: "pen-pony", name: "Pen Pony", kind: "Mythic ride" });
    expect([w.kid, w.roof, w.chatTone]).toEqual(["rooster", "barn", "day"]);
    const j = shopOf("grex")!;
    expect(j.crate).toBe("Jefferson's Boss Crate");
    expect(priceLine(j)).toBe("3 Jefferson tokens, or 1 Jefferson token + 1 crate key");
    expect(holdLine(j, { tokens: 0, keys: 0 })).toBe("You have 0 Jefferson tokens and 0 crate keys.");
    expect(prizeRows(j)[0]).toMatchObject({ id: "jefferson-giraffe", name: "Giraffe Gallop", kind: "Mythic ride" });
    expect([j.kid, j.roof, j.chatTone]).toEqual(["dealer", "warehouse", "day"]);
  });

  it("each shop sells its boss's crate (core's BOSS_CRATES), its ride among the prizes; a way's button needs its price held", () => {
    for (const s of [shopOf("tiger")!, shopOf("gardener")!, shopOf("alfil")!, shopOf("bigboy")!, shopOf("timber")!, shopOf("dash")!, shopOf("hollow")!, shopOf("pig")!, shopOf("grex")!]) {
      const crate = bossCrateOf(s.home)!;
      expect(crate.name).toBe(s.crate);
      expect(crate.items).toContain(s.prizes[0]);
    }
    expect(POOL_LINE).toBe("+ 24 Beta Crate items, Common to Epic");
    expect(canAfford({ tokens: 3, keys: 0 }, "tokens")).toBe(true);
    expect(canAfford({ tokens: 2, keys: 5 }, "tokens")).toBe(false);
    expect(canAfford({ tokens: 1, keys: 1 }, "key")).toBe(true);
    expect(canAfford({ tokens: 1, keys: 0 }, "key")).toBe(false);
    expect(canAfford({ tokens: 0, keys: 3 }, "key")).toBe(false);
    // A buy's answer (Eric, Nov 2): the crate is in your inventory, unopened.
    expect(inInventoryLine(shopOf("tiger")!.crate)).toBe("Babur's Boss Crate is in your inventory.");
  });

  it("buying goes through buyBossCrate: the server's purchase (round 2), its answer the crate in your inventory (Nov 2) or the server's reason", async () => {
    const asked: { url: string; body: unknown }[] = [];
    const answer = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    let next = answer(400, { message: "You need 3 Babur tokens." });
    const real = globalThis.fetch;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      asked.push({ url, body: JSON.parse(String(init?.body)) });
      return next;
    }) as typeof fetch;
    try {
      expect(await buyBossCrate("tiger", "tokens")).toEqual({ ok: false, message: "You need 3 Babur tokens." });
      next = answer(200, { crate: "boss-gardener", locker: { bossCrates: { "boss-gardener": 1 } } });
      expect(await buyBossCrate("gardener", "key")).toEqual({ ok: true, message: "Puddles' Boss Crate is in your inventory." });
      expect(asked).toEqual([
        { url: "/api/shop/boss-crate", body: { crate: "boss-tiger", way: "tokens" } },
        { url: "/api/shop/boss-crate", body: { crate: "boss-gardener", way: "key" } },
      ]);
    } finally {
      globalThis.fetch = real;
    }
  });
});
