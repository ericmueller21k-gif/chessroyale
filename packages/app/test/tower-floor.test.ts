import { describe, expect, it, vi } from "vitest";
import { FLOOR_DOOR, FLOOR_IN, FLOOR_TABLE, FLOOR_YOU, MATE_MARKS, TOWER_FLOOR_FEEL, arrowBlink, bossAt, bossMarks, floorArrow, floorTimes, mateAt, piecesAt, upWords, type BossNow } from "../src/town/shops/tower-floor.ts";
import { SHOP_TOWER_FLOOR_LAYOUT, SHOP_TOWER_FLOOR_N, SHOP_TOWER_FLOOR_TABLE_SQUARES, towerFloorPieces } from "../src/town/shops/tower-floor-art.ts";
import { SHOP_TOWER_KEEPER, SHOP_TOWER_LAYOUT, SHOP_TOWER_N } from "../src/town/shops/tower-art.ts";
import { SHOPS } from "../src/town/shops/shops.ts";
import { makeRoom, passArrive, isFloor, walkable, findPath, stepRound, stepsFrom, inTalkRange, tapTarget, atDoor, type Sq } from "../src/town/shops/room.ts";
import { TABLE_BOARD } from "../src/town/houses/park.ts";

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

  it("a party (Nov 20): the others walk in after you, one a step apart, to their marks beside yours, walkable and clear of each other; the board waits for them", () => {
    const n = 2;
    const solo = floorTimes(n, 1, false);
    const t = floorTimes(n, 1, false, TOWER_FLOOR_FEEL, 3);
    expect(t.mateGo).toHaveLength(3);
    expect(t.mateGo[0]).toBeGreaterThan(t.youGo);
    expect(t.mateGo[1]! - t.mateGo[0]!).toBe(TOWER_FLOOR_FEEL.stepMs);
    expect(t.board).toBeGreaterThanOrEqual(Math.max(...t.mateOn) + TOWER_FLOOR_FEEL.beatMs);
    expect(t.board).toBeGreaterThanOrEqual(solo.board);
    const out: BossNow = { c: 0, r: 0, a: 0, walking: false };
    for (const [i, m] of MATE_MARKS.entries()) {
      expect(walkable(room, Math.floor(m.c), Math.floor(m.r))).toBe(true);
      expect(Math.hypot(m.c - FLOOR_YOU.at.c, m.r - FLOOR_YOU.at.r)).toBeGreaterThan(0.9);
      expect(mateAt(i, t, t.mateGo[i]! - 1, out)).toMatchObject({ c: FLOOR_IN.c, r: FLOOR_IN.r, a: 0 });
      expect(mateAt(i, t, (t.mateGo[i]! + t.mateOn[i]!) / 2, out).walking).toBe(true);
      expect(mateAt(i, t, t.mateOn[i]!, out)).toMatchObject({ c: m.c, r: m.r, a: 1, walking: false });
      // (Back from a match, or reduced motion: on their marks.)
      expect(mateAt(i, null, 0, out)).toMatchObject({ c: m.c, r: m.r, a: 1 });
    }
    // (Solo: none.)
    expect(solo.mateGo).toEqual([]);
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

  // (Eric, Nov 21: "make it so you can't run through the chessboard ... if you just press like up while you're on like near your side of
  // the chessboard, it would just make you run around it." The room as ShopRoom builds it: the table's squares blocked and walked round.)
  const N = SHOP_TOWER_FLOOR_N;
  const solid = makeRoom(SHOP_TOWER_FLOOR_LAYOUT, [], N);
  const round = new Uint8Array(N * N);
  for (const q of SHOP_TOWER_FLOOR_TABLE_SQUARES) solid.blocked[q.r * N + q.c] = round[q.r * N + q.c] = 1;
  const onTable = (s: Sq) => !!round[s.r * N + s.c];
  /** Holding one arrow key (`dc` across, `dr` along the rows) from `from`, `n` steps (or until it stops): every square stood on. */
  const hold = (from: Sq, dc: number, dr: number, n: number): Sq[] => {
    const out = [from];
    for (let i = 0; i < n; i++) {
      const at = out.at(-1)!;
      const s = stepRound(solid, round, at.c, at.r, dc, dr);
      if (!s || !walkable(solid, s.c, s.r)) break;
      expect(Math.abs(s.c - at.c) + Math.abs(s.r - at.r), "one square a step").toBe(1);
      out.push(s);
    }
    return out;
  };

  it("the table is solid, its squares under its drawing; every other square still reachable, your mark and both doors too", () => {
    // (The table's board on the circle's middle, `TABLE_BOARD.half` each way: on the four squares, no other.)
    for (const q of SHOP_TOWER_FLOOR_TABLE_SQUARES) {
      expect(Math.abs(q.c - FLOOR_TABLE.c)).toBeLessThan(0.5 + TABLE_BOARD.half);
      expect(Math.abs(q.r - FLOOR_TABLE.r)).toBeLessThan(0.5 + TABLE_BOARD.half);
    }
    const from = passArrive(solid, "front")!;
    const d = stepsFrom(solid, from);
    const open = makeRoom(SHOP_TOWER_FLOOR_LAYOUT, [], N);
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        if (onTable({ c, r })) expect(walkable(solid, c, r)).toBe(false);
        else if (walkable(open, c, r)) expect(d[r * N + c], `${c},${r} reachable`).toBeGreaterThanOrEqual(0);
      }
    expect(d[FLOOR_YOU.sq.r * N + FLOOR_YOU.sq.c]).toBeGreaterThanOrEqual(0);
    for (const to of ["top", "front"] as const) expect(solid.passes.find((p) => p.to === to)!.inside.some((s) => d[s.r * N + s.c]! >= 0)).toBe(true);
  });

  it("up held from your side walks you round the table (its nearer side) and on north; down, left and right likewise; never onto it", () => {
    const up = hold(FLOOR_YOU.sq, 0, -1, 12);
    expect(up.some(onTable)).toBe(false);
    expect(up.at(-1)!.r, "past the table to the back wall's row").toBe(1);
    // (From column 4 round its west side, the nearer; from column 5 round its east.)
    expect(up.at(-1)!.c).toBe(3);
    expect(hold({ c: 5, r: 7 }, 0, -1, 12).at(-1)!.c).toBe(6);
    // (Down from the far side, and across from either side: round it and on.)
    const down = hold({ c: 4, r: 2 }, 0, 1, 12);
    expect(down.some(onTable)).toBe(false);
    expect(down.at(-1)!.r).toBe(N - 2);
    const right = hold({ c: 2, r: 4 }, 1, 0, 12);
    expect(right.some(onTable)).toBe(false);
    expect(right.at(-1)!.c).toBe(N - 2);
    const left = hold({ c: 7, r: 5 }, -1, 0, 12);
    expect(left.some(onTable)).toBe(false);
    expect(left.at(-1)!.c).toBe(1);
    // (Into a wall, or a room with nothing to walk round: the plain step, as before.)
    expect(stepRound(solid, round, 3, 1, 0, -1)).toEqual({ c: 3, r: 0 });
    expect(stepRound(solid, null, 4, 6, 0, -1)).toEqual({ c: 4, r: 5 });
  });

  it("a tap on the table walks you beside it; one beyond it, round it", () => {
    const t = tapTarget(solid, FLOOR_YOU.sq, 4, 4);
    expect(t.dest && onTable(t.dest)).toBe(false);
    const path = findPath(solid, FLOOR_YOU.sq, { c: 4, r: 2 })!;
    expect(path.some(onTable)).toBe(false);
    expect(path.at(-1)).toEqual({ c: 4, r: 2 });
  });

  it("a floor arrow (Nov 21) after a floor, right in front of the door you go through next, pointing at it; none in a fight", () => {
    expect(floorArrow("fight")).toBeNull();
    const up = floorArrow("won")!;
    const down = floorArrow("out")!;
    expect([up.to, up.dir, down.to, down.dir]).toEqual(["top", -1, "front", 1]);
    for (const a of [up, down]) {
      const inside = solid.passes.find((p) => p.to === a.to)!.inside;
      // (On the floor just inside its door, across its middle: between its two squares.)
      expect(inside.map((s) => s.c).sort()).toEqual([4, 5]);
      expect(a.c).toBe(4.5);
      expect(Math.abs(a.r - inside[0]!.r)).toBeLessThanOrEqual(0.35);
      // (Its whole length, nudged, on the room's floor: never under the door's own picture or the table.)
      const tip = a.r + a.dir * (TOWER_FLOOR_FEEL.arrowLen / 2 + TOWER_FLOOR_FEEL.arrowNudge);
      const tail = a.r - a.dir * (TOWER_FLOOR_FEEL.arrowLen / 2);
      for (const r of [tip, tail]) {
        expect(r).toBeGreaterThan(0.5);
        // (Clear of the front's hem and way in standing up at the last row, which would hide it.)
        expect(r).toBeLessThan(N - 1.4);
        expect(Math.abs(r - FLOOR_TABLE.r)).toBeGreaterThan(1.5);
      }
      expect(atDoor(solid, Math.round(a.c - 0.5), Math.round(a.r), a.to)).toBe(true);
    }
  });

  it("the arrow blinks: full, dimmest and nudged toward its door mid-blink, full again; held full with reduced motion", () => {
    const F = TOWER_FLOOR_FEEL;
    const b = { a: 0, nudge: 0 };
    expect(arrowBlink(0, false, b)).toEqual({ a: 1, nudge: 0 });
    arrowBlink(F.arrowBlinkMs / 2, false, b);
    expect(b.a).toBeCloseTo(F.arrowLow);
    expect(b.nudge).toBeCloseTo(F.arrowNudge);
    expect(arrowBlink(F.arrowBlinkMs, false, b).a).toBeCloseTo(1);
    expect(arrowBlink(F.arrowBlinkMs / 2, true, b)).toEqual({ a: 1, nudge: 0 });
  });
});

/**
 * The lobby's clerk (Eric, Nov 21: "This menu should only be coming up if you click like right in front of the clerk, or if you click on
 * the penguin guy ... but not anywhere else on this floor"): his card shows only on the floor right in front of his counter.
 */
describe("the tower's clerk", () => {
  const def = SHOPS.tower!;
  const lobby = makeRoom(SHOP_TOWER_LAYOUT, def.keeper, SHOP_TOWER_N, undefined, def.talk, null, def.talkAt ?? null, !!def.talkNear);
  const N = SHOP_TOWER_N;

  it("talks only from the three squares under his counter, never anywhere else on the floor", () => {
    expect(def.keeper).toEqual(SHOP_TOWER_KEEPER);
    const talk: string[] = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (walkable(lobby, c, r) && inTalkRange(lobby, c, r)) talk.push(`${c},${r}`);
    expect(talk.sort()).toEqual(["1,4", "2,4", "3,4"]);
  });

  it("a tap on him or his counter walks you in front of it; a tap on the floor near him walks you there, no card", () => {
    const from = lobby.start;
    for (const at of [...def.keeper, { c: 2, r: 3 }]) {
      const t = tapTarget(lobby, from, at.c, at.r);
      expect(t.kind).toBe("keeper");
      expect(t.dest!.r).toBe(4);
      expect(inTalkRange(lobby, t.dest!.c, t.dest!.r)).toBe(true);
    }
    // (Eric's screenshot: a tap a few squares out from him, in the old talking range.)
    for (const sq of [
      { c: 5, r: 5 },
      { c: 4, r: 3 },
      { c: 1, r: 5 },
    ]) {
      const t = tapTarget(lobby, from, sq.c, sq.r);
      expect(t).toEqual({ kind: "square", dest: sq });
      expect(inTalkRange(lobby, sq.c, sq.r)).toBe(false);
    }
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
