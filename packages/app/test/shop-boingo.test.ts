import { describe, expect, it } from "vitest";
import { BOSS_CRATES, BOSS_CRATE_PRICE, bossCrateOf, itemDef } from "@chessroyale/core";
import { RACE, SHOP_BOINGO_CLAW_AT, SHOP_BOINGO_CLAW_SPOT, SHOP_BOINGO_LAYOUT, SHOP_BOINGO_LIGHTS, SHOP_BOINGO_MARKS, SHOP_BOINGO_N, SHOP_BOINGO_PIECES, SHOP_BOINGO_POOLS, POGO_SIGN, pogoSign, raceAt, MAT } from "../src/town/shops/boingo-art.ts";
import { findPath, lightsAt, makeRoom, walkable } from "../src/town/shops/room.ts";
import { prizeRows, shopOf } from "../src/town/shops/shops.ts";
import { introOf } from "../src/town/shops/challenge.ts";

/** Boingo's Funhouse (Nov 6): docs/decisions/2026-11-06-boingo-home.md. */
const def = shopOf("clown")!;
const room = makeRoom(SHOP_BOINGO_LAYOUT, def.keeper, SHOP_BOINGO_N);

describe("Boingo's Funhouse: the room", () => {
  it("is 24 x 24, every piece drawn, the floor whole; every free square reached from the door", () => {
    expect(room.n).toBe(24);
    for (const p of SHOP_BOINGO_LAYOUT) expect(SHOP_BOINGO_PIECES[p.name], p.name).toBeDefined();
    const floor = SHOP_BOINGO_LAYOUT.filter((p) => /^(floor|ring)/.test(p.name));
    expect(floor).toHaveLength(24 * 24);
    expect(room.doors.map((s) => `${s.c},${s.r}`)).toEqual(["11,22", "12,22"]);
    for (let r = 0; r < 24; r++) for (let c = 0; c < 24; c++) if (walkable(room, c, r)) expect(findPath(room, room.start, { c, r }), `${c},${r}`).not.toBeNull();
  });

  it("the battle mat: 6 x 6 open squares in the middle, the marks on it, Boingo's west", () => {
    for (let r = MAT.r0; r <= MAT.r1; r++) for (let c = MAT.c0; c <= MAT.c1; c++) expect(walkable(room, c, r), `${c},${r}`).toBe(true);
    const [bc, br] = SHOP_BOINGO_MARKS.boss;
    const [yc, yr] = SHOP_BOINGO_MARKS.you;
    expect(bc).toBeLessThan(yc);
    expect(br).toBe(yr);
    for (const [c, r] of [SHOP_BOINGO_MARKS.boss, SHOP_BOINGO_MARKS.you]) expect(c >= MAT.c0 && c <= MAT.c1 && r >= MAT.r0 && r <= MAT.r1).toBe(true);
  });

  it("the counter and the keeper: the attendant behind the glass counter, 'Shopkeeper', talked to from in front", () => {
    expect(def).toMatchObject({ home: "clown", boss: "Boingo", crate: "Boingo's Boss Crate", kid: "funkeeper", roof: "tent", chatTone: "night" });
    expect(room.counter.map((s) => s.c)).toEqual([9, 10, 11, 12]);
    for (const k of def.keeper) expect(k.r).toBeLessThan(room.counter[0]!.r);
    expect(def.keeper.every((k) => k.c >= 9 && k.c <= 12)).toBe(true);
  });

  it("the claw machine: solid, its play spot in front of it open and reachable", () => {
    expect(walkable(room, SHOP_BOINGO_CLAW_AT.col, SHOP_BOINGO_CLAW_AT.row)).toBe(false);
    expect(SHOP_BOINGO_CLAW_SPOT).toEqual({ c: SHOP_BOINGO_CLAW_AT.col, r: SHOP_BOINGO_CLAW_AT.row + 1 });
    expect(findPath(room, room.start, SHOP_BOINGO_CLAW_SPOT)).not.toBeNull();
  });

  it("the squirt race: five knights, one wins each race (a different lane next time), and the loop starts again", () => {
    for (let race = 0; race < RACE.players; race++) {
      const end = raceAt(RACE.winAt, race);
      expect(end).toHaveLength(5);
      expect(end[race % RACE.players]).toBe(1);
      expect(end.filter((x) => x >= 1)).toHaveLength(1);
      expect(raceAt(0, race).every((x) => x === 0)).toBe(true);
    }
    expect(SHOP_BOINGO_PIECES["squirt-race"]!.anims.idle!.frames).toHaveLength(RACE.frames * 2);
  });

  it("lights at every placement: every wall's bulbs, every lane's lights, the games, the pogo's spotlight", () => {
    const lit = lightsAt(SHOP_BOINGO_LIGHTS, SHOP_BOINGO_LAYOUT);
    for (const p of SHOP_BOINGO_LAYOUT.filter((p) => /^(wall|lane|spin|claw|squirt|pogo)/.test(p.name))) expect(lit.some((x) => x.at === p), `${p.name} at ${p.col},${p.row}`).toBe(true);
    for (const l of [...SHOP_BOINGO_LIGHTS, ...SHOP_BOINGO_POOLS]) expect(SHOP_BOINGO_LAYOUT.some((p) => p.name === l.piece), l.piece).toBe(true);
  });
});

describe("Boingo's Boss Crate and his pogo", () => {
  it("in BOSS_CRATES with his ride, Boingo's Pogo, first; its sign's price the crate's", () => {
    const crate = bossCrateOf("clown")!;
    expect(BOSS_CRATES).toContain(crate);
    expect([crate.id, crate.name, crate.ride]).toEqual(["boss-clown", "Boingo's Boss Crate", "boingo-pogo"]);
    expect(itemDef("boingo-pogo")).toMatchObject({ name: "Boingo's Pogo", slot: "ride" });
    expect(prizeRows(def)[0]).toMatchObject({ id: "boingo-pogo", name: "Boingo's Pogo" });
    expect(POGO_SIGN).toBe(`BOINGO'S POGO: ${BOSS_CRATE_PRICE.tokens} Boingo tokens`);
    expect(pogoSign(1)).toBe("BOINGO'S POGO: 1 Boingo token");
  });

  it("his challenge: the default intro, his line", () => {
    expect(introOf("clown")).toMatchObject({ custom: false, name: "Boingo", line: "Step right up! Honk honk!", layout: "across" });
  });
});
