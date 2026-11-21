/**
 * Where you talk to each Shopkeeper (Eric, Nov 21: "you have to actually be near them"): the floor right in front of the counter, under
 * the keeper's columns (room.ts frontOf), or the shop's own `talkAt`. Every shop's room: its talk squares walkable, on the floor, reachable
 * from the door; a tap on the keeper walks you onto one. docs/decisions/2026-11-21-shopkeepers-talk-in-front.md.
 */
import { describe, expect, it } from "vitest";
import { inTalkRange, makeRoom, stepsFrom, tapTarget, walkable, type Room, type ShopPlace, type Sq } from "../src/town/shops/room.ts";
import { isUp, makeLevels, type Levels } from "../src/town/shops/levels.ts";
import { SHOPS } from "../src/town/shops/shops.ts";
import * as babur from "../src/town/shops/babur-art.ts";
import * as puddles from "../src/town/shops/puddles-art.ts";
import * as alfil from "../src/town/shops/alfil-art.ts";
import * as bigboy from "../src/town/shops/bigboy-art.ts";
import * as timber from "../src/town/shops/timber-art.ts";
import * as blitz from "../src/town/shops/blitz-art.ts";
import * as hollow from "../src/town/shops/hollow-art.ts";
import * as pig from "../src/town/shops/pig-art.ts";
import * as grex from "../src/town/shops/grex-art.ts";
import * as ginger from "../src/town/shops/ginger-art.ts";
import * as folio from "../src/town/shops/folio-art.ts";
import * as smudgy from "../src/town/shops/smudgy-art.ts";
import * as boingo from "../src/town/shops/boingo-art.ts";
import * as chandy from "../src/town/shops/chandy-art.ts";
import * as zebra from "../src/town/shops/zebra-art.ts";
import * as tower from "../src/town/shops/tower-art.ts";

/** Each shop's room as ShopRoom.tsx's ART loads it, and the squares its people stand on there (blocked after makeRoom). */
interface Art {
  layout: readonly ShopPlace[];
  n?: number;
  floor?: readonly string[];
  levels?: Levels;
  standing?: readonly Sq[];
}
const ARTS: Record<string, Art> = {
  tiger: { layout: babur.SHOP_BABUR_LAYOUT },
  gardener: { layout: puddles.SHOP_PUDDLES_LAYOUT },
  alfil: { layout: alfil.SHOP_ALFIL_LAYOUT },
  bigboy: { layout: bigboy.SHOP_BIGBOY_LAYOUT },
  timber: { layout: timber.SHOP_TIMBER_LAYOUT },
  dash: { layout: blitz.SHOP_BLITZ_LAYOUT },
  hollow: { layout: hollow.SHOP_HOLLOW_LAYOUT, floor: hollow.SHOP_HOLLOW_FLOOR },
  pig: { layout: pig.SHOP_PIG_LAYOUT },
  grex: {
    layout: grex.SHOP_GREX_LAYOUT,
    floor: grex.SHOP_GREX_FLOOR,
    standing: (["leaner-a", "leaner-b", "crew-c", "crew-d"] as const).map((k) => ({ c: grex.SHOP_GREX_CREW[k].at[0], r: grex.SHOP_GREX_CREW[k].at[1] })),
  },
  gingerbread: { layout: ginger.SHOP_GINGER_LAYOUT, floor: ginger.SHOP_GINGER_FLOOR, levels: makeLevels({ upper: ginger.SHOP_GINGER_UPPER, stairs: ginger.SHOP_GINGER_STAIRS }, 20) },
  folio: { layout: folio.SHOP_FOLIO_LAYOUT },
  smudgy: { layout: smudgy.SHOP_SMUDGY_LAYOUT },
  clown: { layout: boingo.SHOP_BOINGO_LAYOUT, n: boingo.SHOP_BOINGO_N },
  chandy: { layout: chandy.SHOP_CHANDY_LAYOUT, n: chandy.SHOP_CHANDY_N },
  zebra: { layout: zebra.SHOP_ZEBRA_LAYOUT, floor: zebra.SHOP_ZEBRA_FLOOR, standing: zebra.SHOP_ZEBRA_GUARDS.map((g) => g.square) },
  tower: { layout: tower.SHOP_TOWER_LAYOUT, n: tower.SHOP_TOWER_N },
};
const roomOf = (id: string): Room => {
  const def = SHOPS[id as keyof typeof SHOPS]!;
  const a = ARTS[id]!;
  const room = makeRoom(a.layout, def.keeper, a.n ?? 20, a.floor, def.talk, a.levels ?? null, def.talkAt ?? null, !!def.talkNear);
  for (const q of a.standing ?? []) room.blocked[q.r * room.n + q.c] = 1;
  return room;
};
const key = (s: Sq) => `${s.c},${s.r}`;

describe("Shopkeepers talk from in front of their counter (Nov 21)", () => {
  it("covers every shop", () => expect(Object.keys(ARTS).sort()).toEqual(Object.keys(SHOPS).sort()));

  for (const id of Object.keys(ARTS))
    it(`${id}: its talk squares are floor, reachable from the door, and a tap on the keeper walks onto one`, () => {
      const room = roomOf(id);
      const def = SHOPS[id as keyof typeof SHOPS]!;
      expect(room.talkAt.length).toBeGreaterThan(0);
      const d = stepsFrom(room, room.start);
      for (const s of room.talkAt) {
        expect(walkable(room, s.c, s.r), key(s)).toBe(true);
        expect(isUp(room.levels, s.c, s.r), key(s)).toBe(false);
        expect(d[s.r * room.n + s.c], key(s)).toBeGreaterThanOrEqual(0);
      }
      // (Without its own `talkAt`: one square under each of the keeper's columns, south of him.)
      if (!def.talkAt) {
        expect(room.talkAt.map((s) => s.c).sort()).toEqual([...new Set(def.keeper.map((k) => k.c))].sort());
        for (const s of room.talkAt) expect(s.r).toBeGreaterThan(Math.max(...def.keeper.map((k) => k.r)));
      }
      // Nowhere else: not beside the keeper, not two squares back.
      let count = 0;
      for (let r = 0; r < room.n; r++) for (let c = 0; c < room.n; c++) if (inTalkRange(room, c, r)) count++;
      expect(count).toBe(room.talkAt.length);
      for (const k of [...def.keeper, ...room.counter]) {
        const t = tapTarget(room, room.start, k.c, k.r);
        expect(t.kind).toBe("keeper");
        expect(t.dest && inTalkRange(room, t.dest.c, t.dest.r), key(k)).toBe(true);
      }
    });

  it("the counter's front, not the floor behind it; beside a keeper with no counter in his column, right in front of him", () => {
    const at = (id: string) => roomOf(id).talkAt.map(key);
    // (Most: the keeper on row 2, the counter on row 3, you on row 4.)
    expect(at("gardener")).toEqual(["9,4", "10,4"]);
    expect(at("pig")).toEqual(["9,4", "10,4"]);
    // (Hollow's dog: floor between him and his counter on row 4; you stand at its front, row 5.)
    expect(at("hollow")).toEqual(["5,5", "6,5"]);
    // (Ginger's elf: the counter's front, not the catwalk beside him.)
    expect(at("gingerbread")).toEqual(["9,7", "10,7"]);
    // (Babur's Stripes beside the counter's east end; Jefferson's dealer with none; Chandy's frog behind his stand.)
    expect(at("tiger")).toEqual(["12,3", "13,3"]);
    expect(at("grex")).toEqual(["16,4", "17,4"]);
    expect(at("chandy")).toEqual(["9,4", "10,4"]);
    // (The clerk keeps his own: the counter's whole front.)
    expect(at("tower")).toEqual(["1,4", "2,4", "3,4"]);
  });
});
