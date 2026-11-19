import { describe, expect, it, vi } from "vitest";
import { FLOOR_DOOR, FLOOR_TABLE, FLOOR_YOU, TOWER_FLOOR_FEEL, bossAt, bossMarks, floorTimes, piecesAt, upWords, type BossNow } from "../src/town/shops/tower-floor.ts";
import { SHOP_TOWER_FLOOR_LAYOUT, SHOP_TOWER_FLOOR_N, towerFloorPieces } from "../src/town/shops/tower-floor-art.ts";
import { makeRoom, passArrive, isFloor, walkable, findPath } from "../src/town/shops/room.ts";

/** The Battle Tower's floor room (PR 11b, Eric, Nov 19): where everyone stands and when, its doors, its floor tiles. */
describe("the tower's floor room", () => {
  const room = makeRoom(SHOP_TOWER_FLOOR_LAYOUT, [], SHOP_TOWER_FLOOR_N);

  it("has two doors: the elevator up (top) and the way down to the lobby (front); you come in at the way down", () => {
    expect(room.passes.map((p) => p.to).sort()).toEqual(["front", "top"]);
    expect(room.exits).toHaveLength(0);
    const at = passArrive(room, "front")!;
    expect(at.r).toBe(SHOP_TOWER_FLOOR_N - 2);
    // (Your mark is a walk away from there, round nothing.)
    expect(walkable(room, FLOOR_YOU.sq.c, FLOOR_YOU.sq.r)).toBe(true);
    expect(findPath(room, at, FLOOR_YOU.sq)).not.toBeNull();
  });

  it("lays every square's floor tile (named floor-, circle- or ring-) and none mirrored (the game ignores flip on floor tiles)", () => {
    const tiles = SHOP_TOWER_FLOOR_LAYOUT.filter((p) => isFloor(p.name));
    expect(tiles).toHaveLength(SHOP_TOWER_FLOOR_N * SHOP_TOWER_FLOOR_N);
    expect(tiles.filter((p) => p.flip)).toEqual([]);
  });

  it("shows the floor's number on its back wall's panels, one picture a floor, and has its elevator open", () => {
    const four = towerFloorPieces(4);
    const fifty = towerFloorPieces(57);
    expect(four["number-panel"]!.id).not.toBe(fifty["number-panel"]!.id);
    expect(towerFloorPieces(57)).toBe(fifty);
    expect(four["elevator-open"]).toBeTruthy();
  });

  it("spreads 1, 2 or 3 bosses' marks across the table's far side, in the room, clear of each other", () => {
    for (const n of [1, 2, 3]) {
      const m = bossMarks(n);
      expect(m).toHaveLength(n);
      for (const p of m) {
        expect(p.r).toBeLessThan(FLOOR_TABLE.r - 1.5);
        expect(p.c).toBeGreaterThan(1);
        expect(p.c).toBeLessThan(SHOP_TOWER_FLOOR_N - 2);
      }
      for (let i = 1; i < n; i++) expect(m[i]!.c - m[i - 1]!.c).toBeGreaterThan(1.5);
    }
    expect(FLOOR_YOU.at.r).toBeGreaterThan(FLOOR_TABLE.r + 1.5);
  });

  it("brings the bosses out one after another, then the board up, then the match; each walks from the elevator's doorway to his mark", () => {
    const t = floorTimes(3, 1, false);
    expect(t.bossGo[1]! - t.bossGo[0]!).toBe(TOWER_FLOOR_FEEL.gapMs);
    expect(t.doorsOpen).toBeLessThan(t.bossGo[0]!);
    expect(t.doorsShut).toBeGreaterThan(t.bossGo[2]!);
    expect(t.board).toBeGreaterThanOrEqual(Math.max(t.youOn, ...t.bossOn));
    expect(t.go).toBeGreaterThan(t.board + TOWER_FLOOR_FEEL.boardMs);
    const b: BossNow = { c: 0, r: 0, a: 0, walking: false };
    expect(bossAt(2, 3, t.bossGo[2]! - 1, t, b).a).toBe(0);
    bossAt(0, 3, t.bossGo[0]!, t, b);
    expect([b.c, b.r, b.walking]).toEqual([FLOOR_DOOR.c, FLOOR_DOOR.r, true]);
    bossAt(0, 3, t.bossOn[0]! + 1, t, b);
    expect([b.c, b.r, b.a, b.walking]).toEqual([bossMarks(3)[0]!.c, bossMarks(3)[0]!.r, 1, false]);
    expect(piecesAt(t.board - 1, t)).toBe(0);
    expect(piecesAt(t.board + TOWER_FLOOR_FEEL.boardMs, t)).toBe(1);
  });

  it("with reduced motion, nobody walks: everyone on their marks from the start, the pieces come up, then the match", () => {
    const t = floorTimes(2, 1, true);
    const b: BossNow = { c: 0, r: 0, a: 0, walking: false };
    for (const i of [0, 1]) {
      bossAt(i, 2, 0, t, b);
      expect([b.c, b.r, b.a, b.walking]).toEqual([bossMarks(2)[i]!.c, bossMarks(2)[i]!.r, 1, false]);
    }
    expect(t.doorsShut).toBe(t.doorsOpen);
    expect(t.go).toBeGreaterThan(t.board);
  });

  it("opens the elevator up only once a floor's won; shut (greyed, why under it) otherwise", () => {
    expect(upWords("won", 4)).toEqual({ word: "Up to floor 5", on: true, note: null });
    expect(upWords("out", 4).on).toBe(false);
    expect(upWords("out", 4).note).toContain("run is over");
    expect(upWords("fight", 4).on).toBe(false);
  });
});

/**
 * Its music (Eric, Nov 19): the tower's own theme in its lobby and floor room ("just for when you're idling in the tower"); a floor's
 * battle plays one of its bosses' themes, picked once and kept, avoiding the last floors' ("it doesn't reuse the same one for, 5 or 6 rounds").
 */
describe("the tower's music", () => {
  it("the lobby and the floor room play `tower` (in themes.json, a loop from `pad`, 160 s)", async () => {
    const { readFileSync } = await import("node:fs");
    const { TOWER_FLOOR, homeTheme, roomDef, roomTheme } = await import("../src/town/shops/shops.ts");
    const { musicPlan } = await import("../src/music.ts");
    const themes = JSON.parse(readFileSync(new URL("../public/music/themes.json", import.meta.url), "utf8"));
    expect([roomTheme(roomDef("tower")!), roomTheme(TOWER_FLOOR), homeTheme("tower")]).toEqual(["tower", "tower", "tower"]);
    expect(musicPlan(themes, "tower", 0)).toMatchObject({ intro: null, loop: { name: "tower-loop", offset: 0.5, loopStart: 0.5, loopEnd: 160.5 } });
  });

  it("a floor's battle: one of its bosses' themes, kept (a reload too), avoiding the last floors', else the least recent", async () => {
    const { FloorPlay, pickFloorTheme, readKept, recentFloorThemes } = await import("../src/tower.ts");
    const has = (id: string) => id !== "nomusic";
    // (Not a recent one; none fresh: the least recently played; no boss with a theme: none.)
    expect(pickFloorTheme(["grex", "zebra", "moo"], ["grex", "zebra"], has, () => 0)).toBe("moo");
    expect(pickFloorTheme(["grex", "zebra"], ["zebra", "pig", "grex"], has, () => 0.99)).toBe("zebra");
    expect(pickFloorTheme(["nomusic", "grex"], [], has, () => 0)).toBe("grex");
    expect(pickFloorTheme(["nomusic"], [], has)).toBeNull();
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
    try {
      const play = new FloorPlay({ v: 1, fight: "f1", floor: 3, bosses: ["grex", "zebra"], settings: {}, beaten: [] }, 0);
      expect(play.music(null)).toBeNull(); // (themes.json not read yet: no pick yet)
      const pick = play.music(has)!;
      expect(["grex", "zebra"]).toContain(pick);
      // (The same for the whole match, whatever is asked after, and after a reload.)
      expect(play.music(() => false)).toBe(pick);
      expect(new FloorPlay(readKept(store.get("brc.tower.solo")!)!, 0).music(has)).toBe(pick);
      expect(recentFloorThemes()).toEqual([pick]);
      // (The next floor with the same bosses plays the other.)
      const next = new FloorPlay({ v: 1, fight: "f2", floor: 4, bosses: ["grex", "zebra"], settings: {}, beaten: [] }, 0);
      expect(next.music(has)).toBe(pick === "grex" ? "zebra" : "grex");
      // (Only the last MUSIC.towerRecent are remembered.)
      for (const [i, b] of ["a", "b", "c", "d", "e", "f"].entries()) new FloorPlay({ v: 1, fight: `g${i}`, floor: 5, bosses: [b], settings: {}, beaten: [] }, 0).music(has);
      expect(recentFloorThemes()).toEqual(["b", "c", "d", "e", "f"]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
