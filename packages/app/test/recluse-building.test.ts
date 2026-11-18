/**
 * The Hidden Boss's building, the Walk-up (Nov 13; docs/areas/town-square.md, "The Walk-up"): in an admin's town only (admins first),
 * nobody out front, its three rooms and the stairs between them (the hall from the street, the landing, his room on the top floor), the
 * flats' doors' talk spots, his room's theme, and no challenge yet. Pure: the world, the rooms (room.ts) and their defs (shops.ts).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/town/admin-town.ts", () => ({ ADMIN_TOWN: true }));

const { ALL_HOMES, HOMES, createTown, hasFigure } = await import("../src/town/world.ts");
const { adminFirst, BOSS_ROSTER, isPlayable, menuBosses } = await import("@chessroyale/core");
const { findPath, isFloor, makeRoom, onPass, passArrive, passAt, tapTarget, inTalkRange, walkable } = await import("../src/town/shops/room.ts");
const { RECLUSE_ROOMS, canChallengeInside, roomDef, roomTheme, homeTheme, shopOf } = await import("../src/town/shops/shops.ts");
const S = await import("../src/town/shops/recluse-stairs-art.ts");
const TOP = await import("../src/town/shops/recluse-art.ts");
const { HOUSES } = await import("../src/town/houses/index.ts");
const { HOUSE_RECLUSE_DOOR } = await import("../src/town/houses/recluse.ts");
const { HOME_SPECS } = await import("../src/town/home-boxes.ts");
const SKY = await import("../src/town/sky.ts");

const defs = RECLUSE_ROOMS;
const hall = makeRoom(S.RECLUSE_HALL_LAYOUT, defs.front.keeper, S.RECLUSE_HALL_N, undefined, defs.front.talk, null, defs.front.talkAt ?? null, !!defs.front.talkNear);
const landing = makeRoom(S.RECLUSE_LANDING_LAYOUT, defs.landing.keeper, S.RECLUSE_HALL_N, undefined, defs.landing.talk, null, defs.landing.talkAt ?? null, !!defs.landing.talkNear);
const top = makeRoom(TOP.SHOP_RECLUSE_LAYOUT, defs.top.keeper, TOP.SHOP_RECLUSE_N, undefined, defs.top.talk, null, defs.top.talkAt ?? null, !!defs.top.talkNear);
for (const q of TOP.SHOP_RECLUSE_STANDING) top.blocked[q.r * top.n + q.c] = 1;
const sq = (s: { c: number; r: number }) => `${s.c},${s.r}`;

describe("the Walk-up in the town (Nov 13)", () => {
  it("is in everyone's town (Eric, Nov 13: \"It doesn't need to be admin only\"), and his Boss Battle tile stays locked (adminOnly)", () => {
    const him = BOSS_ROSTER.find((b) => b.id === "recluse")!;
    expect(adminFirst(him)).toBe(false);
    expect(him.adminOnly).toBe(true);
    expect(isPlayable(him)).toBe(false);
    // (Never on a raid menu, an admin's included: only Boss alone's hidden list has him, as before.)
    expect(menuBosses({ admin: true, raid: true }).map((b) => b.id)).not.toContain("recluse");
    expect(menuBosses({ admin: false, raid: false }).map((b) => b.id)).not.toContain("recluse");
    expect(HOMES.map((h) => h.id)).toContain("recluse");
    // (A player's town filters as world.ts HOMES does: admins first, which he no longer is.)
    expect(ALL_HOMES.filter((h) => !adminFirst(h)).map((h) => h.id)).toContain("recluse");
  });

  it("is the last home, with nobody out front: the town's figures stay one per home, each at its home's index", () => {
    expect(ALL_HOMES.at(-1)!.id).toBe("recluse");
    expect(hasFigure({ id: "recluse" })).toBe(false);
    const t = createTown();
    expect(t.bosses).toHaveLength(HOMES.length - 1);
    t.bosses.forEach((b, i) => expect(b.home, b.home.id).toBe(HOMES[i]));
  });

  it("its front: no sign (nothing written on it), its door where its box says, its home card's Go in (an inside)", () => {
    const art = HOUSES.recluse;
    expect(art.sign.w).toBe(0);
    expect([art.ch.w, art.ch.foot[0]]).toEqual([144, 72]);
    expect(HOME_SPECS.recluse.door).toBe(HOUSE_RECLUSE_DOOR);
    expect(shopOf("recluse")).toBe(defs.front);
  });
});

describe("its three rooms and the stairs (Nov 13)", () => {
  it("every square of each room has its floor tile baked in (isFloor), no flat tile stands up, and the side walls are blanks (one surface each)", () => {
    for (const [layout, n] of [[S.RECLUSE_HALL_LAYOUT, S.RECLUSE_HALL_N], [S.RECLUSE_LANDING_LAYOUT, S.RECLUSE_HALL_N]] as const) {
      const tiles = new Set(layout.filter((p) => isFloor(p.name)).map((p) => `${p.col},${p.row}`));
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) expect(tiles.has(`${c},${r}`), `${c},${r}`).toBe(true);
      for (const p of layout) expect(S.RECLUSE_STAIRS_PIECES[p.name], p.name).toBeTruthy();
      // (Their side walls one surface each, as his room's (Eric, Nov 13): solid blanks in the layout, the scene draws the walls.)
      for (let r = 0; r < n - 1; r++)
        for (const c of [0, n - 1]) expect(layout.filter((p) => !isFloor(p.name) && p.col === c && p.row === r).map((p) => p.name), `${c},${r}`).toEqual(["wall-none"]);
    }
  });

  it("the hall: the street door out, the stairs up to the landing; the landing: down to the hall, up to the top floor; the top floor: down to the landing", () => {
    expect(hall.exits.length).toBeGreaterThan(0);
    expect(hall.passes.map((p) => p.to)).toEqual(["landing"]);
    expect(landing.exits).toEqual([]);
    expect(landing.passes.map((p) => p.to).sort()).toEqual(["front", "top"]);
    expect(top.exits).toEqual([]);
    expect(top.passes.map((p) => p.to)).toEqual(["landing"]);
    // (Each room's stairs are its own: a pass's squares don't overlap another's, nor where you talk.)
    for (const room of [hall, landing, top])
      for (const p of room.passes) {
        for (const s of p.inside) expect(passAt(room, s.c, s.r)?.to, sq(s)).toBe(p.to);
        for (const s of room.talkAt ?? []) expect(onPass(room, s.c, s.r), sq(s)).toBe(false);
      }
  });

  it("you arrive at the stairs you came by (up into the landing at its front, down at its back), and can reach every door from there", () => {
    expect(passArrive(landing, "front")!.r).toBeGreaterThan(landing.n / 2);
    expect(passArrive(landing, "top")!.r).toBeLessThan(landing.n / 2);
    expect(passArrive(hall, "landing")!.r).toBeLessThan(hall.n / 2);
    expect(passArrive(top, "landing")!.r).toBeGreaterThan(top.n / 2);
    for (const [room, from] of [[hall, "landing"], [landing, "front"], [landing, "top"], [top, "landing"]] as const) {
      const a = passArrive(room, from)!;
      expect(walkable(room, a.c, a.r), `${from}: ${sq(a)}`).toBe(true);
      for (const p of room.passes) expect(findPath(room, a, p.inside[0]!), `${from} to ${p.to}`).not.toBeNull();
      for (const d of room.doors) expect(findPath(room, a, d)).not.toBeNull();
    }
    // (In from the street: the hall's start, just inside its door.)
    expect(findPath(hall, hall.start, hall.passes[0]!.inside[0]!)).not.toBeNull();
  });

  it("the flats' doors: a tap on one walks you to its own spot before it, where its card (a line, OK) shows; the lines are short", () => {
    expect(defs.front.talkAt).toEqual(S.RECLUSE_HALL_TALK);
    expect(defs.landing.talkAt).toEqual(S.RECLUSE_LANDING_TALK);
    for (const [room, layout] of [[hall, S.RECLUSE_HALL_LAYOUT], [landing, S.RECLUSE_LANDING_LAYOUT]] as const) {
      const flats = layout.filter((p) => p.name === "flat-door");
      expect(flats.length).toBe(room.talkAt!.length);
      for (const f of flats) {
        const spot = { c: f.col, r: f.row + 1 };
        expect(inTalkRange(room, spot.c, spot.r), sq(spot)).toBe(true);
        // (From the far side of the room: to this door's spot, not the nearest one.)
        expect(tapTarget(room, { c: 5, r: 5 }, f.col, f.row)).toEqual({ kind: "keeper", dest: spot });
      }
    }
    expect(defs.front.locked!.length).toBeGreaterThan(1);
    for (const l of defs.front.locked!) expect(l.length).toBeLessThanOrEqual(50);
  });

  it("his room: a tap on his board walks you round to its front, where his card shows; its Challenge isn't open yet (the next job)", () => {
    for (const q of TOP.SHOP_RECLUSE_STANDING) {
      const t = tapTarget(top, passArrive(top, "landing")!, q.c, q.r);
      expect(t.kind).toBe("keeper");
      expect(inTalkRange(top, t.dest!.c, t.dest!.r)).toBe(true);
    }
    expect(canChallengeInside("recluse")).toBe(false);
    expect(canChallengeInside("zebra")).toBe(true);
  });

  it("his theme plays in his room alone (recluse-house, in themes.json), not in the hall or on the landing; the banners' rooms", () => {
    const themes = JSON.parse(readFileSync(new URL("../public/music/themes.json", import.meta.url), "utf8")) as { themes: Record<string, unknown> };
    expect(roomTheme(defs.top)).toBe("recluse-house");
    expect(themes.themes["recluse-house"]).toBeTruthy();
    expect(roomTheme(defs.front)).toBeNull();
    expect(roomTheme(defs.landing)).toBeNull();
    expect(homeTheme("recluse")).toBe("recluse-house");
    // (Every other home's room plays its own, as before.)
    expect(roomTheme(roomDef("zebra")!)).toBe("zebra");
    expect(roomTheme(roomDef("zebra", "back")!)).toBe("zebra");
    expect([roomDef("recluse"), roomDef("recluse", "landing"), roomDef("recluse", "top")]).toEqual([defs.front, defs.landing, defs.top]);
  });
});

describe("the walk-up by the time of day (Nov 14, Eric: \"the outside shining should be like a moon at night\")", () => {
  const { roomLight, skyOverride, skyWeights } = SKY;
  it("each look of the town's sky picks one light (dawn and dusk the warm one), and the blends flip half way", () => {
    expect((["day", "dawn", "dusk", "night"] as const).map((l) => roomLight(skyOverride(l)!))).toEqual(["day", "dusk", "dusk", "night"]);
    expect(roomLight({ dawn: 0, day: 0, dusk: 0.5, night: 0.5 })).toBe("night");
    expect(roomLight({ dawn: 0, day: 0.6, dusk: 0.4, night: 0 })).toBe("day");
    // (The device's clock, as the town reads it: noon is day, midnight night.)
    expect([roomLight(skyWeights(12 * 60)), roomLight(skyWeights(0))]).toEqual(["day", "night"]);
  });
  it("his room: the day as drawn; dusk and night their own window and floor (the moon in the night's window), a gentle wash, the same pieces", () => {
    const day = TOP.recluseLit("day");
    expect(day.pieces).toBe(TOP.SHOP_RECLUSE_PIECES);
    expect(day.dim).toBeUndefined();
    for (const light of ["dusk", "night"] as const) {
      const l = TOP.recluseLit(light);
      expect(Object.keys(l.pieces).sort()).toEqual(Object.keys(day.pieces).sort());
      expect(l.pieces.window).not.toBe(day.pieces.window);
      expect(l.pieces["floor-3-2"]).not.toBe(day.pieces["floor-3-2"]);
      // (Only the window and the floor change: the bed, the horse, the walls are the day's.)
      expect(l.pieces.bed).toBe(day.pieces.bed);
      // A gentle wash: the child, his board and the rug stay easy to see.
      expect(l.dim).toBeGreaterThan(0);
      expect(l.dim).toBeLessThanOrEqual(0.4);
    }
    const win = TOP.recluseLit("night").pieces.window!;
    const grid = (win.parts.f0p0 as { grid: string[] }).grid;
    expect(grid.slice(26, 45).some((r) => r.slice(40, 60).includes("*")), "the moon high on the right").toBe(true);
    expect(grid.some((r) => r.includes(":")), "a window lit across the street").toBe(true);
    expect(win.palette["<"]).not.toBe(day.pieces.window!.palette["<"]);
  });
  it("the hall and the landing: the street door's glass and the landing's window darken at night, the sconces stay lit", () => {
    const day = S.recluseStairsLit("day");
    const night = S.recluseStairsLit("night");
    expect(day.pieces).toBe(S.RECLUSE_STAIRS_PIECES);
    expect(night.pieces.entrance!.palette.s).not.toBe(day.pieces.entrance!.palette.s);
    expect(night.pieces.window!.palette.A).not.toBe(day.pieces.window!.palette.A);
    expect(night.hall[0]).toBe(day.hall[0]);
    expect(night.landing[0]).toBe(day.landing[0]);
    expect(night.dim).toBeLessThanOrEqual(0.4);
  });
});
