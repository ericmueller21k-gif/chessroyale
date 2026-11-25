/**
 * Chandy's Swamp (Nov 16; docs/areas/town-square.md, "Chandy's Swamp"): its front and its plot, the room (water everywhere, the hidden
 * battle spot, the light by the time of day, the wading), the frog's shop, and the challenge's rise as data: the post first, the platform
 * under you both, the crates, his entrance, his rising wipe. Pure: the art, the room (room.ts), the timeline (timeline.ts).
 */
import { describe, expect, it } from "vitest";
import { isFloor, makeRoom, walkable } from "../src/town/shops/room.ts";
import { SHOPS, canChallengeInside, roomDef } from "../src/town/shops/shops.ts";
import { SHOP_CHANDY_LAYOUT, SHOP_CHANDY_MARKS, SHOP_CHANDY_N, SHOP_CHANDY_WADE, chandyLit } from "../src/town/shops/chandy-art.ts";
import { CHANDY_PLATFORM_FOOT, INTRO_CHANDY_PLATFORM } from "../src/town/shops/chandy-intro-art.ts";
import { CHANDY_INTRO } from "../src/town/shops/intros/chandy.ts";
import { CHALLENGE_FEEL, introOf, marksOf } from "../src/town/shops/challenge.ts";
import { standAt, timelineAt, timelineBeats, timelineCues } from "../src/town/shops/timeline.ts";
import { CHANDY_TOWN } from "../src/characters/chandy-figure.ts";
import { TOWN_FEEL } from "../src/town/feel.ts";
import { areaBannerOf } from "../src/town/AreaBanner.tsx";
import { HOUSE_CHANDY, HOUSE_CHANDY_DOOR, HOUSE_CHANDY_LIGHTS } from "../src/town/houses/chandy.ts";
import { HOME_SPECS, homeBox } from "../src/town/home-boxes.ts";
import { frameKeys } from "../src/characters/sprite.ts";

const S = CHALLENGE_FEEL.swamp;
const tl = CHANDY_INTRO.timeline;
const beats = timelineBeats(tl);
const beat = (step: string) => beats.find((b) => b.step === step)!;
const marks = marksOf(SHOP_CHANDY_LAYOUT, "across", SHOP_CHANDY_MARKS)!;
const mine = (who: "you" | "boss") => (who === "you" ? { mark: marks.you, clear: marks.youClear } : { mark: marks.boss, clear: marks.bossClear });

describe("Chandy's Swamp: the front and its plot (Nov 16)", () => {
  it("its picture stands as tall as the street's row houses (170 px) on its foot, its door its boardwalk", () => {
    expect([HOUSE_CHANDY.w, HOUSE_CHANDY.h]).toEqual([144, 170]);
    expect(HOME_SPECS.chandy.door).toBe(HOUSE_CHANDY_DOOR);
    expect(HOUSE_CHANDY_DOOR).toBeGreaterThan(80);
    // (Its box: leafy walls round it under the cypresses' crowns, the water low inside.)
    expect(HOME_SPECS.chandy.side?.mat).toBe("foliage");
    expect(HOME_SPECS.chandy.roof.every((f) => f.tex === "water")).toBe(true);
  });
  // (Round 3, Eric: "there's windows, which there shouldn't be windows. … it should actually look like a pond where that space is".)
  const keys = frameKeys(HOUSE_CHANDY, HOUSE_CHANDY.anims.idle!.frames[0]!);
  it("from the street it's a pond: open water takes the middle, going back to a far bank half way up the picture", () => {
    const water = new Set(["w", "W", "v", "V", "9", "q", "g", "G"]);
    for (const x of [50, 60, 72]) {
      const col = keys.map((row) => row[x]);
      const n = col.filter((k) => k && water.has(k)).length;
      expect(n, `water down column ${x}`).toBeGreaterThanOrEqual(40);
      // (Its far edge: the first water from the top, about 94 of 170.)
      expect(col.findIndex((k) => k && water.has(k)), `the far bank over column ${x}`).toBeLessThan(100);
    }
  });
  it("nothing behind it shows through: the wood behind the near crowns closes every gap, from under the canopy's ragged top to the foot", () => {
    for (let x = 8; x < HOUSE_CHANDY.w - 8; x++) {
      expect(keys.findIndex((row) => row[x]), `column ${x}'s top`).toBeLessThanOrEqual(16);
      for (let y = 16; y < HOUSE_CHANDY.foot[1]; y++) expect(keys[y]![x], `${x}, ${y}`).toBeTruthy();
    }
  });
  it("nothing of it lights a window: the lantern and three fireflies at dusk and night; its leafy walls none", () => {
    expect(HOUSE_CHANDY_LIGHTS.map((l) => l.keys)).toEqual(["JK", "8", "8", "8"]);
    const b = homeBox("chandy");
    for (const side of [b.left, b.right, b.back]) expect(side!.lights).toEqual([]);
  });
  it("its arrival title says its name once (no \"CHANDY'S\" over \"CHANDY'S SWAMP\"); Rolling Dough keeps its owner's line", () => {
    expect(areaBannerOf({ boss: "Chandy" }, "Chandy's Swamp")).toEqual({ sub: null, title: "CHANDY'S SWAMP" });
    expect(areaBannerOf({ boss: "Don Dough" }, "Rolling Dough")).toEqual({ sub: "DON DOUGH'S", title: "ROLLING DOUGH" });
    // (Either possessive is the same name: no "PUDDLES'S" over "PUDDLES' BOTANICAL GARDEN".)
    expect(areaBannerOf({ boss: "Puddles" }, "Puddles' Botanical Garden")).toEqual({ sub: null, title: "PUDDLES' BOTANICAL GARDEN" });
    // (Eric, Nov 16: the plain name too, never twice.)
    expect(areaBannerOf({ boss: "Ginger" }, "Ginger Igloo")).toEqual({ sub: null, title: "GINGER IGLOO" });
    expect(areaBannerOf({ boss: "Hollow" }, "Hollow Peak")).toEqual({ sub: null, title: "HOLLOW PEAK" });
    expect(areaBannerOf({ boss: "Moo & Moon" }, "Moo & Moon Meadow")).toEqual({ sub: null, title: "MOO & MOON MEADOW" });
    // (A name that only begins with the same letters keeps its owner line.)
    expect(areaBannerOf({ boss: "Dash" }, "Dashboard Diner")).toEqual({ sub: "DASH'S", title: "DASHBOARD DINER" });
  });
});

describe("inside: the swamp (Nov 16)", () => {
  const def = SHOPS.chandy!;
  const room = makeRoom(SHOP_CHANDY_LAYOUT, def.keeper, SHOP_CHANDY_N, null, def.talk, null, def.talkAt ?? null);
  it("no roof but the town's sky; the frog keeps the shop; its crate isn't sold yet (core has none of his), so Talk has lines", () => {
    expect(def.roof).toBe("sky");
    expect(def.kid).toBe("swampkeeper");
    expect(def.crate).toBeNull();
    expect(def.says?.length).toBeGreaterThan(0);
    expect(roomDef("chandy")).toBe(def);
    // (His rules are in (docs/decisions/2026-11-16-chandy-rules.md): the challenge from inside too.)
    expect(canChallengeInside("chandy")).toBe(true);
  });
  it("every square has its floor tile baked in (water), the battle spot's hidden under it as ring tiles of the same water", () => {
    const tiles = new Map(SHOP_CHANDY_LAYOUT.filter((p) => isFloor(p.name)).map((p) => [`${p.col},${p.row}`, p.name]));
    for (let r = 0; r < SHOP_CHANDY_N; r++) for (let c = 0; c < SHOP_CHANDY_N; c++) expect(tiles.has(`${c},${r}`), `${c},${r}`).toBe(true);
    const ring = [...tiles].filter(([, n]) => n.startsWith("ring-"));
    expect(ring).toHaveLength(6 * 4);
    // (Its marks are the art's: the boss west, you east, the table between.)
    expect([marks.boss.c, marks.you.c, marks.table.c]).toEqual([8, 11, 9.5]);
  });
  it("you walk the water: the marks and the clear places are open, the stand's squares aren't", () => {
    for (const s of [marks.boss, marks.you, marks.bossClear, marks.youClear]) expect(walkable(room, Math.round(s.c), Math.round(s.r)), `${s.c},${s.r}`).toBe(true);
    for (const k of def.keeper) expect(walkable(room, k.c, k.r)).toBe(false);
  });
  it("wading: the water hides a few pixels of feet, its ripple and spray colors set", () => {
    expect(SHOP_CHANDY_WADE.depth).toBeGreaterThan(0);
    expect(SHOP_CHANDY_WADE.depth).toBeLessThan(12);
  });
  it("by the time of day: by day as drawn, at dusk a warm dim with the stand's lantern, at night a deeper blue dim with its pool", () => {
    const day = chandyLit("day");
    const dusk = chandyLit("dusk");
    const night = chandyLit("night");
    expect([day.dim ?? 0, day.lights.length]).toEqual([0, 0]);
    expect(dusk.dim).toBeGreaterThan(0);
    expect(night.dim).toBeGreaterThan(dusk.dim!);
    expect(dusk.lights.map((l) => l.piece)).toEqual(["stand"]);
    expect(night.pools).toHaveLength(1);
    // (Made once a light.)
    expect(chandyLit("night")).toBe(night);
  });
});

describe("the challenge's rise, as data (Nov 16)", () => {
  it("is Chandy's own intro, across, his storm rising from the screen's foot", () => {
    expect(introOf("chandy")).toMatchObject({ custom: true, name: "Chandy", layout: "across" });
    expect(CHANDY_INTRO.storm?.rise).toBe(true);
  });
  it("plays in order: the post first, a gap, the platform, a settle, the crates, the set, his entrance, his attack's beat", () => {
    expect(beats.map((b) => b.step)).toEqual(["face", "line", "pause", "post", "pause", "platform", "settle", "crates", "table", "entrance", "swing", "done"]);
    expect(beat("post").end - beat("post").at).toBe(S.postMs);
    expect(beat("platform").end - beat("platform").at).toBe(S.platformMs);
    expect(timelineCues(tl).map((c) => c.cue)).toEqual(expect.arrayContaining(["rise", "crate"]));
  });
  it("the board rises on its post first: it's out of the water before the platform moves, the platform not shown yet", () => {
    const end = timelineAt(tl, beat("post").end - 1).cast;
    expect(end.post!.lift).toBeCloseTo(S.deckDown, 2);
    expect(end.board!.lift).toBeGreaterThan(end.post!.lift);
    expect(end.platform?.on ?? false).toBe(false);
    // (You both still stand in the water.)
    expect(end.you?.lift ?? 0).toBe(0);
    expect(end.boss?.lift ?? 0).toBe(0);
  });
  it("the platform lifts you both from the moment its deck reaches your feet, the post and the board riding on it; nobody lags it", () => {
    const p = beat("platform");
    for (let t = p.at; t <= p.end; t += 50) {
      const c = timelineAt(tl, t).cast;
      const deck = c.platform!.lift;
      // (Your feet on the deck once it's up; in the water, on the bottom, until then.)
      expect(c.you!.lift, `you at ${t}`).toBeCloseTo(Math.max(0, deck), 1);
      expect(c.boss!.lift, `him at ${t}`).toBeCloseTo(Math.max(0, deck), 1);
      expect(c.post!.lift).toBeCloseTo(deck, 5);
    }
    const end = timelineAt(tl, p.end + 1).cast;
    expect(end.you!.lift).toBeCloseTo(S.deckUp, 5);
    expect(end.platform!.lift).toBeCloseTo(S.deckUp, 5);
  });
  it("the crates land on the deck at the stools' places as you hop back clear of them, and stay", () => {
    const c = timelineAt(tl, beat("table").at + 1).cast;
    for (const k of ["crateB", "crateY"]) expect(c[k]!.lift, k).toBeCloseTo(S.deckUp, 5);
    expect(c.crateB!.anim).toBe("blue");
    expect(c.crateY!.anim).toBe("orange");
    expect(standAt(c.you!, marks, mine("you"))).toEqual(marks.youClear);
    expect(standAt(c.boss!, marks, mine("boss"))).toEqual(marks.bossClear);
    // (Still lifted: no waterline on either of you from the platform on.)
    for (const t of [beat("crates").at, beat("table").at, beat("entrance").at, beat("swing").at]) expect(timelineAt(tl, t + 1).cast.you!.lift, `${t}`).toBeCloseTo(S.deckUp, 5);
  });
  it("the platform holds you both whole with room to spare: his figure (tail and all) and your pawn on it, half a square past each", () => {
    // (Round 2, Eric: "the battleground seems a little short. Like they're basically hanging off it".)
    const west = marks.table.c - CHANDY_PLATFORM_FOOT[0] / 37;
    const east = west + INTRO_CHANDY_PLATFORM.w / 37;
    const perSq = CHANDY_TOWN.h / (TOWN_FEEL.bossSquares * (TOWN_FEEL.bossScale.chandy ?? 1));
    // (His drawn left edge, his tail's tip, from his foot; his right edge, his snout.)
    let left = CHANDY_TOWN.w;
    let right = 0;
    for (const f of CHANDY_TOWN.anims.idle!.frames) for (const l of f.layers) {
      const part = CHANDY_TOWN.parts[l.part]!;
      const w = part.grid[0]!.length;
      left = Math.min(left, l.x);
      right = Math.max(right, l.x + w);
    }
    const hisWest = marks.bossClear.c - (CHANDY_TOWN.foot[0] - left) / perSq;
    const hisEast = marks.boss.c + (right - CHANDY_TOWN.foot[0]) / perSq;
    expect(hisWest - west, "past his tail").toBeGreaterThanOrEqual(0.5);
    expect(east - (marks.youClear.c + 0.5), "past your pawn").toBeGreaterThanOrEqual(0.5);
    expect(hisEast).toBeLessThan(marks.table.c);
  });
});
