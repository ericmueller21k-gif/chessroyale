import { describe, expect, it } from "vitest";
import { BOSS_CRATES, adminFirst, bossCrateOf, bossDef, itemDef } from "@chessroyale/core";
import {
  SHOP_GINGER_CARD,
  SHOP_GINGER_DECK_H,
  SHOP_GINGER_DISPENSE_PATH,
  SHOP_GINGER_FLOOR,
  SHOP_GINGER_KEEPER,
  SHOP_GINGER_LAYOUT,
  SHOP_GINGER_LIGHTS,
  SHOP_GINGER_MARKS,
  SHOP_GINGER_PIECES,
  SHOP_GINGER_POOLS,
  SHOP_GINGER_STAIRS,
  SHOP_GINGER_STEP,
  SHOP_GINGER_UPPER,
  SHOP_GINGER_WALKERS,
} from "../src/town/shops/ginger-art.ts";
import { INTRO_GINGER_BLAST, INTRO_GINGER_BOARD, INTRO_GINGER_BOARD_ROUTE, INTRO_GINGER_CAM, INTRO_GINGER_CRACK, INTRO_GINGER_ELF_SPOTS, INTRO_GINGER_LIGHT, INTRO_GINGER_PUFF, INTRO_GINGER_SHARD, INTRO_GINGER_TABLE, INTRO_GINGER_TABLE_AT, INTRO_GINGER_TABLE_TOP } from "../src/town/shops/ginger-intro-art.ts";
import { BOSS_GINGER_INTRO } from "../src/characters/ginger-intro.ts";
import { ELF_BOARD_HANDS, NPC_GINGER_ELF_BOARD_A, NPC_GINGER_ELF_BOX } from "../src/town/shops/ginger-elves-art.ts";
import { ElfLoop, elfB, loopMs, pairLegs, walkerLegs, type ElfPose } from "../src/town/shops/ginger-elves.ts";
import { QUARTER_MID, levelZ, liftAt, makeLevels, squareOf } from "../src/town/shops/levels.ts";
import { around, findPath, inTalkRange, isFloor, lightsAt, makeRoom, squaresOf, stepFor, tapTarget, walkable, type Sq } from "../src/town/shops/room.ts";
import { SHOPS, holdLine, priceLine, prizeRows, shopOf } from "../src/town/shops/shops.ts";
import { BOSS_INTROS, CHALLENGE_FEEL, iceAnims, iceAt, iceCues, iceTimes, introBeats, introCam, introCues, introLength, introOf, marksOf, type IntroStep } from "../src/town/shops/challenge.ts";
import { SIDEKICK_SHEETS } from "../src/town/sidekick-sheets.ts";
import { BOTS } from "../src/town/world.ts";
import { SHOP_FEEL } from "../src/town/feel.ts";
import { sidekickGingerElf } from "../src/characters/sidekicks/elf.ts";
import { renderFrame } from "../src/characters/sprite.ts";

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

  it("drawn among the pieces half a square nearer once up at all (in front of the cards it stands on and next to), never behind the stairs' card for a frame", () => {
    expect(levelZ(4, 40)).toBeCloseTo(4.51, 9);
    expect(levelZ(5, 40)).toBeCloseTo(5.51, 9);
    expect(levelZ(6, 0)).toBe(6);
    // Behind the floor in front: the shopkeeper (5.2) and the stand (row 6) are nearer than a figure on the deck over them.
    expect(levelZ(4, 40)).toBeLessThan(def.at[1]);
    // (Eric, Nov 5: "on the turn for a frame it bugs like crazy". Eased in over the first 5 px as it was, a figure at (5, 5.444) lifted
    // 0.44 px was drawn at 5.489: behind the stairs' cards on row 5 (5.5) for that frame, between frames in front of them.) Every point
    // of the way up on the stairs' row (the low square, lifted): in front of the row's cards.
    expect(levelZ(5.444, 0.44)).toBeGreaterThan(5.5);
    for (const [x, y] of walkPoints(WEST)) {
      if (y < 4.99 || y >= 5.5) continue;
      expect(levelZ(y, liftAt(LV, x, y)), `(${x}, ${y})`).toBeGreaterThan(5.5);
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

  it("no talking to the shopkeeper from the catwalk over him", () => {
    expect(inTalkRange(room, 9, 4)).toBe(false);
    expect(inTalkRange(room, 10, 4)).toBe(false);
  });
});

const blockedAt = (c: number, r: number) => room.blocked[r * room.n + c] === 1;
describe("Ginger's igloo", () => {
  it("its floor is round, 10 across round (9.5, 9.5), with the tunnel and the stairs' feet; everything else is ice, blocked (but the levels' squares)", () => {
    expect(SHOP_GINGER_FLOOR).toHaveLength(20);
    const feet = ["5,6", "5,7", "14,6", "14,7"];
    for (let r = 0; r < 20; r++)
      for (let c = 0; c < 20; c++) {
        const open = (c - 9.5) ** 2 + (r - 9.5) ** 2 < 25 || ((c === 9 || c === 10) && r >= 15 && r <= 18) || feet.includes(`${c},${r}`);
        expect(SHOP_GINGER_FLOOR[r]![c], `${c},${r}`).toBe(open ? "." : "#");
        if (!open && !LV.up[r * 20 + c]) expect(blockedAt(c, r), `${c},${r} blocked`).toBe(true);
      }
    expect(SHOP_GINGER_FLOOR[5]).toBe("########....########");
    expect(SHOP_GINGER_FLOOR[8]).toBe("#####..........#####");
    expect(room.exits).toEqual([{ c: 9, r: 18 }, { c: 10, r: 18 }]);
    // (You come in a step inside the doorway.)
    expect(room.start).toEqual({ c: 10, r: 16 });
  });

  it("its walls are one curve of cards, 45 x 150 (4 px over each neighbour), on every square round the floor (corners too): no gap, no outside colour", () => {
    expect(SHOP_GINGER_CARD).toEqual({ w: 45, h: 150, foot: [22, 149], over: 4 });
    const open = (c: number, r: number) => SHOP_GINGER_FLOOR[r]?.[c] === ".";
    const upright = SHOP_GINGER_LAYOUT.filter((p) => !isFloor(p.name));
    const has = (c: number, r: number) => upright.some((p) => squaresOf(p).some((q) => q.c === c && q.r === r));
    for (let r = 0; r < 18; r++)
      for (let c = 0; c < 20; c++) {
        if (open(c, r)) continue;
        const ring = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].some(([dc, dr]) => open(c + dc!, r + dr!) && r + dr! < 18);
        if (ring) expect(has(c, r), `a wall card at ${c},${r}`).toBe(true);
      }
    for (const p of upright.filter((p) => /^(bay|side|stair|ice|hem|tunnel)/.test(p.name))) {
      const ch = SHOP_GINGER_PIECES[p.name]!;
      expect([ch.w, ch.h, ...ch.foot], p.name).toEqual([45, 150, 22, 149]);
    }
    // Every square has its floor tile (the snow, the battle spot's ice, the planks and snow under the walls, the night outside).
    for (let r = 0; r < 20; r++) for (let c = 0; c < 20; c++) expect(SHOP_GINGER_LAYOUT.some((p) => isFloor(p.name) && p.col === c && p.row === r), `${c},${r}`).toBe(true);
  });

  it("lights at every placement: the catwalk's bulbs on every back bay, both ice lanterns, the doorway; pools along every bay's foot", () => {
    const placed = SHOP_GINGER_LAYOUT.filter((p) => !isFloor(p.name));
    const lit = lightsAt(SHOP_GINGER_LIGHTS, placed);
    for (const name of ["bay-b", "bay-door", "bay-c", "bay-d", "bay-corner", "bay-sign-w", "bay-sign-e", "ice-lamp", "entrance"]) {
      const n = placed.filter((p) => p.name === name).length;
      expect(n, name).toBeGreaterThan(0);
      expect(lit.filter((x) => x.at.name === name).length, name).toBeGreaterThanOrEqual(n);
    }
    expect(lightsAt(SHOP_GINGER_POOLS, placed).filter((x) => x.at.name.startsWith("side-")).length).toBe(placed.filter((p) => p.name.startsWith("side-")).length);
  });

  it("the stand at (9-10, 6), solid, means talk; the marks his west and yours east on the middle line, the table halfway at (9.5, 9.5)", () => {
    expect([blockedAt(9, 6), blockedAt(10, 6)]).toEqual([true, true]);
    expect(room.counter).toEqual([{ c: 9, r: 6 }, { c: 10, r: 6 }]);
    expect(tapTarget(room, room.start, 9, 6).kind).toBe("keeper");
    expect(SHOP_GINGER_MARKS).toEqual({ boss: [8, 9.5], you: [11, 9.5] });
    const m = marksOf(SHOP_GINGER_LAYOUT, "across", SHOP_GINGER_MARKS)!;
    expect([m.table.c, m.table.r]).toEqual([9.5, 9.5]);
    expect(INTRO_GINGER_TABLE_AT).toEqual([9.5, 9.5]);
  });
});

describe("the shopkeeper elf", () => {
  it("his sheet is baked (36 x 44, feet at 17, 41; idle 12, walk 6, sit 10, wave 8), the art's sprite", () => {
    const k = SIDEKICK_SHEETS.elf;
    expect([k.id, k.w, k.h, ...k.foot]).toEqual(["sidekick-ginger-elf", 36, 44, 17, 41]);
    expect([k.ms.idle.length, k.ms.walk.length, k.ms.sit.length, k.ms.wave.length]).toEqual([12, 6, 10, 8]);
    expect(sidekickGingerElf.id).toBe(k.id);
  });

  it("behind his stand on (9, 5) and (10, 5), drawn at his art's size (25 px), facing our right; no name, the day tone; not a town bot (Crumb stays Ginger's kid)", () => {
    expect(def).toMatchObject({ home: "gingerbread", boss: "Ginger", kid: "elf", at: [9.5, 5.2], tall: 25, roof: "igloo", chatTone: "day" });
    expect(def.flip).toBeUndefined();
    expect(def.keeper).toEqual(SHOP_GINGER_KEEPER.keeper);
    expect(def.at).toEqual(SHOP_GINGER_KEEPER.at);
    for (const k of def.keeper) expect(blockedAt(k.c, k.r)).toBe(true);
    expect(BOTS.filter((b) => b.boss === "gingerbread").map((b) => b.name)).toEqual(["Crumb"]);
  });
});

describe("Ginger's Boss Crate and the Candy Cane Sled", () => {
  it("in BOSS_CRATES with his ride first; sold to everyone (Ginger is live); its id is his boss id's, never the Gingerbread Man skin's", () => {
    const crate = bossCrateOf("gingerbread")!;
    expect(BOSS_CRATES).toContain(crate);
    expect([crate.id, crate.name, crate.boss, crate.ride]).toEqual(["boss-gingerbread", "Ginger's Boss Crate", "gingerbread", "ginger-sled"]);
    expect(crate.items).toContain("ginger-sled");
    expect(crate.items.at(-1)).toBe("ginger-sled");
    expect(adminFirst(bossDef("gingerbread")!)).toBe(false);
    expect(itemDef("ginger-sled")).toMatchObject({ name: "Candy Cane Sled", tier: "mythic", slot: "ride" });
    // ("gingerbread" is also the Gingerbread Man skin's item id: the crate isn't an item, and no item is called boss-gingerbread.)
    expect(itemDef("gingerbread")).toMatchObject({ slot: "skin" });
    expect(itemDef(crate.id)).toBeUndefined();
    expect(shopOf("gingerbread")!.crate).toBe(crate.name);
    expect(priceLine(def)).toBe("3 Ginger tokens, or 1 Ginger token + 1 crate key");
    expect(holdLine(def, { tokens: 2, keys: 0 })).toBe("You have 2 Ginger tokens and 0 crate keys.");
    expect(prizeRows(def)[0]).toMatchObject({ id: "ginger-sled", name: "Candy Cane Sled", kind: "Mythic ride" });
  });
});

describe("the elves at work", () => {
  const E = SHOP_FEEL.elves;
  const stopMs = (["tap", "boxOut", "fill", "full"] as const).reduce((s, a) => s + NPC_GINGER_ELF_BOX.anims[a]!.frames.reduce((x, f) => x + f.ms, 0), 0) + E.stopBeatMs;
  const pairL = pairLegs(SHOP_GINGER_DISPENSE_PATH, E.pairSpeed, stopMs);
  const stops = SHOP_GINGER_DISPENSE_PATH.filter((p) => p.stop).map((p) => ({ face: p.stop!.face, b: p.b! }));
  const onFloorOrUp = (x: number, y: number) => {
    const s = squareOf(LV, x, y, { c: 0, r: 0 });
    return walkable(room, s.c, s.r) || SHOP_GINGER_FLOOR[s.r]![s.c] === ".";
  };
  /** Every pose, every 16 ms of a loop. */
  const sweep = (loop: ElfLoop, f: (p: ElfPose, b: ElfPose) => void) => {
    const p: ElfPose = { x: 0, y: 0, face: 1, anim: "", t: 0, waiting: false };
    const b: ElfPose = { ...p };
    for (let t = 0; t < loop.total; t += 16) {
      loop.update(16, () => false, E.look);
      loop.pose(p, (k) => stops[k]!.face);
      elfB(loop, stops, E.bBehind, E.bMoveMs, b);
      f(p, b);
    }
  };

  it("the pair's loop: five stops at the lower row, up the east stairs, five at the upper, down the west; about 47.5 s", () => {
    expect(SHOP_GINGER_DISPENSE_PATH.filter((p) => p.stop?.row === "lower")).toHaveLength(5);
    expect(SHOP_GINGER_DISPENSE_PATH.filter((p) => p.stop?.row === "upper")).toHaveLength(5);
    expect(loopMs(pairL) / 1000).toBeGreaterThan(46.5);
    expect(loopMs(pairL) / 1000).toBeLessThan(48.5);
  });

  it("they climb the same stairs on the same curve: A and B never jump (in place or in height), up on the catwalk at 40 at every upper stop, never off the floor or the levels", () => {
    const pair = new ElfLoop(pairL);
    let pa: [number, number, number] | null = null;
    let pb: [number, number, number] | null = null;
    let up = 0;
    sweep(pair, (a, b) => {
      for (const [p, prev, who] of [[a, pa, "A"], [b, pb, "B"]] as const) {
        const h = liftAt(LV, p.x, p.y);
        expect(onFloorOrUp(p.x, p.y), `${who} at ${p.x.toFixed(2)},${p.y.toFixed(2)}`).toBe(true);
        if (prev) {
          const d = Math.hypot(p.x - prev[0], p.y - prev[1]);
          // (At most 5 squares a second: B's eased step over to his place at a stop is the quickest.)
          expect(d, `${who} moves smoothly`).toBeLessThan(0.08);
          expect(Math.abs(h - prev[2]), `${who}'s lift at ${p.x.toFixed(2)},${p.y.toFixed(2)}`).toBeLessThan(2);
        }
      }
      pa = [a.x, a.y, liftAt(LV, a.x, a.y)];
      pb = [b.x, b.y, liftAt(LV, b.x, b.y)];
      up = Math.max(up, pa[2]);
    });
    expect(up).toBe(40);
    for (const p of SHOP_GINGER_DISPENSE_PATH.filter((x) => x.stop?.row === "upper")) expect(liftAt(LV, p.at[0], p.at[1]), `${p.at}`).toBe(40);
    for (const p of SHOP_GINGER_DISPENSE_PATH.filter((x) => x.stop?.row === "lower")) expect(liftAt(LV, p.at[0], p.at[1]), `${p.at}`).toBe(0);
  });

  it("the walkers' loops stay on the floor, off the battle spot's ice (the table and both marks) and off the stand (the red one brushes past the sack's corner, as the art has him)", () => {
    for (const [k, pts] of Object.entries(SHOP_GINGER_WALKERS)) {
      const loop = new ElfLoop(walkerLegs(pts, E.walkerSpeed));
      const p: ElfPose = { x: 0, y: 0, face: 1, anim: "", t: 0, waiting: false };
      for (let t = 0; t < loop.total; t += 16) {
        loop.update(16, () => false, E.look);
        loop.pose(p);
        const s = squareOf(LV, p.x, p.y, { c: 0, r: 0 });
        expect(SHOP_GINGER_FLOOR[s.r]![s.c], `${k} at ${p.x.toFixed(2)},${p.y.toFixed(2)}`).toBe(".");
        expect(room.counter.concat(room.keeper).some((q) => q.c === s.c && q.r === s.r), `${k} off the stand`).toBe(false);
        expect(liftAt(LV, p.x, p.y)).toBe(0);
        // (The battle spot's ice: an ellipse 104 x 78 px round (9.5, 9.5), half-axes in squares.)
        expect(Math.hypot((p.x - 9.5) / (104 / 37), (p.y - 9.5) / (78 / 37)), `${k} off the ice`).toBeGreaterThan(1);
      }
    }
    // The pair's lower stops are clear of the marks and the table too.
    for (const p of SHOP_GINGER_DISPENSE_PATH) for (const m of [SHOP_GINGER_MARKS.boss, SHOP_GINGER_MARKS.you, [9.5, 9.5]] as const) expect(Math.hypot(p.at[0] - m[0], p.at[1] - m[1])).toBeGreaterThan(2);
  });

  it("stops while someone stands on or just ahead of its way, waits there, and goes on once they're clear; a stop once begun is played out", () => {
    const loop = new ElfLoop(walkerLegs(SHOP_GINGER_WALKERS.red, E.walkerSpeed));
    const p: ElfPose = { x: 0, y: 0, face: 1, anim: "", t: 0, waiting: false };
    // (Someone on (6, 10): on his way down column 6.)
    const taken = (x: number, y: number) => Math.round(x) === 6 && Math.round(y) === 10;
    let held: [number, number] | null = null;
    for (let t = 0; t < 20_000; t += 16) {
      loop.update(16, taken, E.look);
      loop.pose(p);
      if (p.waiting) {
        held = [p.x, p.y];
        break;
      }
    }
    expect(held, "he waits").not.toBeNull();
    // He waits a square or so short of you, not on your square.
    expect(Math.abs(held![1] - 10)).toBeGreaterThan(0.4);
    for (let t = 0; t < 3000; t += 16) {
      loop.update(16, taken, E.look);
      loop.pose(p);
      expect([p.x, p.y, p.waiting]).toEqual([held![0], held![1], true]);
    }
    loop.update(16, () => false, E.look);
    loop.update(16, () => false, E.look);
    loop.pose(p);
    expect(p.waiting).toBe(false);
    expect([p.x, p.y]).not.toEqual(held);
    // Standing at a stop (the pair's first), someone in front changes nothing until it walks on.
    const pair = new ElfLoop(pairL, 1300 + 100);
    const t0 = pair.t;
    pair.update(500, () => true, E.look);
    expect(pair.t).toBe(t0 + 500);
  });
});

describe("his challenge intro (Nov 5: Eric's design)", () => {
  const A = iceAnims(
    { mover: BOSS_GINGER_INTRO, blast: INTRO_GINGER_BLAST, shard: INTRO_GINGER_SHARD, crack: INTRO_GINGER_CRACK, puff: INTRO_GINGER_PUFF, table: INTRO_GINGER_TABLE, light: INTRO_GINGER_LIGHT, board: INTRO_GINGER_BOARD, carrier: NPC_GINGER_ELF_BOARD_A },
    ELF_BOARD_HANDS.toss.findIndex((h) => h === null),
    INTRO_GINGER_BOARD_ROUTE.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - INTRO_GINGER_BOARD_ROUTE[i - 1]![0], p[1] - INTRO_GINGER_BOARD_ROUTE[i - 1]![1]) : 0), 0),
  );
  const beats = introBeats(A);
  const T = iceTimes(A);
  const at = { route: INTRO_GINGER_BOARD_ROUTE, table: INTRO_GINGER_TABLE_AT, top: INTRO_GINGER_TABLE_TOP, hands: ELF_BOARD_HANDS, spots: INTRO_GINGER_ELF_SPOTS };
  const d = introOf("gingerbread")!;

  it("his own, across, on the marks; his line a placeholder (\"Cold enough for you?\") until Eric's Gemini lines; the carriers' \"Coming, boss!\"", () => {
    expect(d).toMatchObject({ name: "Ginger", custom: true, layout: "across", line: "Cold enough for you?", crewLine: "Coming, boss!" });
    expect(A.key).toEqual({ blast: 1, letGo: 3, light: 3 });
  });

  it("the beats in order, about 13.2 s from the marks to the wipe: the line, the charge, the blast, the fall, the stab, the carry, the toss, the cast, the brag, the swing", () => {
    expect(beats.map((b) => b.step)).toEqual(["face", "line", "charge", "blast", "fall", "stab", "carry", "toss", "cast", "brag", "swing", "done"] satisfies IntroStep[]);
    for (let i = 1; i < beats.length; i++) expect(beats[i]!.at, beats[i]!.step).toBe(beats[i - 1]!.end);
    expect(introLength(beats) / 1000).toBeGreaterThan(12.6);
    expect(introLength(beats) / 1000).toBeLessThan(13.8);
    // The art's timeline (intro-ginger-nov5.md), within a beat: the charge 2.8, the blast 3.9, the fall 5.0, the stab 5.32, the door
    // 6.0, the toss 8.0, the board on 8.78, the cast 9.0, the pieces by 10.55, the brag 10.6 (after the cast: his attack follows it).
    const near = (ms: number, s: number, by = 0.15) => expect(Math.abs(ms / 1000 - s), `${ms} ms against ${s} s`).toBeLessThan(by);
    near(T.charge, 2.8);
    near(T.blast, 3.85);
    near(T.fall, 5.0);
    near(T.land, 5.32);
    near(T.door, 6.0);
    near(T.toss, 7.9, 0.2);
    near(T.landed, 8.7, 0.2);
    near(T.cast, 8.9, 0.2);
    near(T.lit, 10.5, 0.2);
    near(T.brag, 10.6, 0.2);
  });

  it("the icicle: formed at 70 px in the burst, falling faster and faster to the floor, stabbing in; the table from then on (in place long before any cover), the crack staying", () => {
    expect(iceAt(A, T.form + 10, at).shard).toMatchObject({ anim: "form", lift: 70 });
    const mid = iceAt(A, T.fall + CHALLENGE_FEEL.ice.fallMs / 2, at).shard!;
    expect(mid.anim).toBe("fall");
    expect(mid.lift).toBeCloseTo(70 * 0.75, 5);
    expect(iceAt(A, T.land + 1, at)).toMatchObject({ shard: { anim: "land", lift: 0 }, table: -1, crack: { anim: "crack" } });
    expect(iceAt(A, T.table, at)).toMatchObject({ shard: null });
    expect(iceAt(A, T.table, at).table).toBeGreaterThanOrEqual(0);
    for (let t = T.table; t < introLength(beats) + 3000; t += 50) {
      const n = iceAt(A, t, at);
      expect(n.table, `${t}`).toBeGreaterThanOrEqual(0);
      expect(n.crack).not.toBeNull();
    }
    // The table's top is the park table's (27 px: no stools, no step for you).
    expect(INTRO_GINGER_TABLE_TOP).toBe(27);
  });

  it("the carriers out of the stockroom door (open while they come), round behind you to the table, the toss, the board on it; then to their watch spots, still before the brag (nobody steps after it lands)", () => {
    expect(iceAt(A, T.setOff - 1, at).carriers).toBeNull();
    expect(iceAt(A, T.setOff + 1, at)).toMatchObject({ door: true });
    expect(iceAt(A, T.setOff + 1, at).carriers![0].r).toBeCloseTo(4.75, 1);
    expect(iceAt(A, T.doorShut, at).door).toBe(false);
    // Their way stays behind (north of) the marks and the table, and on the floor.
    for (let t = T.setOff; t < T.toss; t += 30) {
      const n = iceAt(A, t, at);
      for (const c of n.carriers!) {
        expect(c.r, `${t}`).toBeLessThan(9.5);
        const s = squareOf(LV, c.c, c.r, { c: 0, r: 0 });
        expect(SHOP_GINGER_FLOOR[s.r]![s.c], `${c.c},${c.r}`).toBe(".");
      }
      expect(n.board).not.toBeNull();
    }
    expect(iceAt(A, T.letGo + 1, at).board).toMatchObject({ anim: "spin" });
    const land = iceAt(A, T.landed, at);
    expect([land.board, land.onTable]).toEqual([null, true]);
    for (let t = T.watching; t < introLength(beats) + 2000; t += 50) {
      const n = iceAt(A, t, at);
      expect(n.carriers!.map((c) => [c.c, c.r, c.anim])).toEqual([
        [11.3, 7.9, "idle"],
        [7.0, 7.9, "idle"],
      ]);
    }
    expect(T.watching).toBeLessThan(T.brag);
    expect(T.landed).toBeLessThan(introLength(beats));
  });

  it("the light on the board from his cast's light frame; the pieces come in as it fades, all in before his brag", () => {
    expect(iceAt(A, T.light - 1, at).light).toBeNull();
    expect(iceAt(A, T.light + 1, at).light?.anim).toBe("appear");
    expect(iceAt(A, T.shine + 1, at).light?.anim).toBe("shine");
    expect(iceAt(A, T.fade + 1, at).light?.anim).toBe("fade");
    expect(iceAt(A, T.fade - 1, at).pieces).toBe(0);
    expect(iceAt(A, T.lit, at).pieces).toBe(1);
    expect(T.lit).toBeLessThanOrEqual(T.brag);
  });

  it("every cue a sound of his own, in order: the charge, the blast, the whoosh, the burst, the ice forming, the crunch, the elves' steps and heave, the board's whoosh and clack, the cast, the sparkle, his laugh and thump; the storm's blizzard and gust", () => {
    const cues = introCues(beats, A);
    expect(cues).toEqual(iceCues(A));
    for (const c of cues) expect(d.cues[c.cue], c.cue).toBeTruthy();
    for (let i = 1; i < cues.length; i++) expect(cues[i]!.at).toBeGreaterThanOrEqual(cues[i - 1]!.at);
    const names = new Set(cues.map((c) => c.cue));
    for (const n of ["charge", "blast", "whoosh", "burst", "freeze", "crunch", "step", "heave", "clack", "cast", "sparkle", "laugh", "thump"]) expect(names.has(n), n).toBe(true);
    for (const n of ["blizzard", "gust", "storm"]) expect(d.cues[n], n).toBeTruthy();
    expect(cues.find((c) => c.cue === "crunch")!.at).toBe(T.land);
    expect(cues.find((c) => c.cue === "clack")!.at).toBe(T.landed);
  });

  it("his own camera (centred on the table, the art's INTRO_GINGER_CAM), only his and Don Dough's (Nov 11, his small back room's): every other boss's is the challenge camera for its layout, as before", () => {
    expect(introCam(d)).toEqual(INTRO_GINGER_CAM);
    expect(introCam(d)).not.toEqual(CHALLENGE_FEEL.cam.across);
    expect(BOSS_INTROS.zebra!.cam).toEqual({ south: -0.8, west: -0.35, zoom: 1 });
    for (const [id, b] of Object.entries(BOSS_INTROS)) {
      if (id === "gingerbread" || id === "zebra") continue;
      expect(b!.cam, id).toBeUndefined();
      expect(introCam(b!), id).toBe(CHALLENGE_FEEL.cam[b!.layout]);
    }
    expect(CHALLENGE_FEEL.cam).toEqual({ across: { south: 0.8, west: 0.75, zoom: 1 }, facing: { south: 1.5, west: 0, zoom: 1 } });
  });

  it("his moves and props are drawn: every frame of his charge, blast, cast and brag, the icicle, the table, the board and the light has pixels", () => {
    const drawn = (ch: typeof BOSS_GINGER_INTRO, a: string) => ch.anims[a]!.frames.every((f) => renderFrame(ch, f).data.some((v, i) => i % 4 === 3 && v > 0));
    for (const a of ["charge", "blast", "cast", "brag"]) expect(drawn(BOSS_GINGER_INTRO, a), a).toBe(true);
    for (const [ch, a] of [[INTRO_GINGER_SHARD, "fall"], [INTRO_GINGER_TABLE, "idle"], [INTRO_GINGER_BOARD, "spin"], [INTRO_GINGER_LIGHT, "shine"], [INTRO_GINGER_BLAST, "fly"]] as const) expect(drawn(ch, a), `${ch.id} ${a}`).toBe(true);
  });
});
