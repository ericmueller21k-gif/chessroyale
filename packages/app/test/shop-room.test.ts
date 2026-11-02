import { describe, expect, it } from "vitest";
import { SHOP_BABUR_LAYOUT } from "../src/town/shops/babur-art.ts";
import { SHOP_PUDDLES_LAYOUT } from "../src/town/shops/puddles-art.ts";
import { SHOP_ALFIL_LAYOUT } from "../src/town/shops/alfil-art.ts";
import { findPath, inTalkRange, makeRoom, onDoor, stepsFrom, tapTarget, walkable, type Room, type Sq } from "../src/town/shops/room.ts";
import { POOL_LINE, buyBossCrate, canAfford, inInventoryLine, holdLine, priceLine, prizeRows, shopOf, wayText, SHOPS } from "../src/town/shops/shops.ts";
import { bossCrateOf } from "@chessroyale/core";
import { HOMES } from "../src/town/world.ts";
import { SHOP_FEEL } from "../src/town/feel.ts";

/**
 * Inside a shop (Nov 2, round 1; shops/room.ts): which squares you can stand on, the way out, the Shopkeeper's talking range and
 * where a tap sends you, in both rooms as the art lays them out; and the shop's words (shops/shops.ts).
 */
const babur = makeRoom(SHOP_BABUR_LAYOUT, SHOPS.tiger!.keeper);
const puddles = makeRoom(SHOP_PUDDLES_LAYOUT, SHOPS.gardener!.keeper);
const alfil = makeRoom(SHOP_ALFIL_LAYOUT, SHOPS.alfil!.keeper);
const rooms: [string, Room][] = [
  ["Babur's", babur],
  ["Puddles'", puddles],
  ["Alfil's", alfil],
];

describe.each(rooms)("%s room", (_name, room) => {
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
    for (const to of [talk, room.doors[0]!, { c: 2, r: 2 }, { c: 17, r: 1 }]) {
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
    const wall = tapTarget(room, room.start, 0, 15);
    expect(wall.kind).toBe("square");
    expect(Math.max(Math.abs(wall.dest!.c - 0), Math.abs(wall.dest!.r - 15))).toBe(1);
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
  it("only Babur's, Puddles' and Alfil's homes have an inside", () => {
    expect(HOMES.filter((h) => shopOf(h.id)).map((h) => h.id).sort()).toEqual(["alfil", "gardener", "tiger"]);
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
  });

  it("each shop sells its boss's crate (core's BOSS_CRATES), its ride among the prizes; a way's button needs its price held", () => {
    for (const s of [shopOf("tiger")!, shopOf("gardener")!, shopOf("alfil")!]) {
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
