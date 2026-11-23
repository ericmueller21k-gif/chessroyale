/**
 * Birdie's Station (Nov 23; docs/areas/town-square.md, "Birdie's Station"): its front, its lobby cut from the art's one picture into the
 * room's pieces (and drawn back as the art drew it), the bartender's pour and dip, the challenge spot at the middle table, his intro as
 * data, and the split-flap board's words and flips. Pure: the art, the room (room.ts), the timeline, the board's text (flap-board.ts).
 */
import { describe, expect, it } from "vitest";
import { BOSS_ROSTER } from "@chessroyale/core";
import { renderFrame, type Character } from "../src/characters/sprite.ts";
import { SIDEKICK_BIRDIE_BARTENDER } from "../src/characters/sidekicks/birdiebartender.ts";
import { SHOP_BIRDIE_INTERIOR_3, SHOP_BIRDIE_PIECES } from "../src/town/shops/birdie-lobby-art.ts";
import * as A from "../src/town/shops/birdie-art.ts";
import { SHOPS } from "../src/town/shops/shops.ts";
import { isFloor, makeRoom, stepsFrom, walkable } from "../src/town/shops/room.ts";
import { introOf, marksOf } from "../src/town/shops/challenge.ts";
import { BIRDIE_INTRO } from "../src/town/shops/intros/birdie.ts";
import { timelineAt, timelineBeats, timelineCues } from "../src/town/shops/timeline.ts";
import { HOUSE_BIRDIE, HOUSE_BIRDIE_DOOR } from "../src/town/houses/birdie.ts";
import { HOME_SPECS, homeBox } from "../src/town/home-boxes.ts";
import { areaBannerOf } from "../src/town/AreaBanner.tsx";
import { BOARD_NAMES, FLAP_COLS, boardStops, flapSteps, newBoard, pageEntries, pageRows, rng, stepBoard } from "../src/town/shops/flap-board.ts";
import { SHOP_FEEL } from "../src/town/feel.ts";
import { ALL_HOMES } from "../src/town/world.ts";

const T = 37;
const Y0 = 83;
const def = SHOPS.birdie!;
const room = makeRoom(A.SHOP_BIRDIE_ROOM_LAYOUT, def.keeper, A.SHOP_BIRDIE_ROOM_N, undefined, def.talk, null, def.talkAt ?? null);

/** The room drawn as ShopRoom stands its pieces (each foot at its square's middle), at beat 0, into the art's picture's frame. */
function composed(): Uint8ClampedArray {
  const W = SHOP_BIRDIE_INTERIOR_3.w, H = SHOP_BIRDIE_INTERIOR_3.h;
  const out = new Uint8ClampedArray(W * H * 4);
  const blit = (ch: Character, fx: number, fy: number, rot = 0) => {
    const f = renderFrame(ch, ch.anims.idle!.frames[0]!);
    for (let y = 0; y < ch.h; y++)
      for (let x = 0; x < ch.w; x++) {
        const [sx, sy] = rot === 2 ? [ch.w - 1 - x, ch.h - 1 - y] : rot === 3 ? [ch.w - 1 - y, x] : [x, y];
        const s = (sy * ch.w + sx) * 4;
        if (f.data[s + 3]! < 128) continue;
        const X = Math.round(fx - ch.foot[0] + x), Y = Math.round(fy - ch.foot[1] + y);
        if (X >= 0 && Y >= 0 && X < W && Y < H) out.set(f.data.subarray(s, s + 4), (Y * W + X) * 4);
      }
  };
  for (const p of A.SHOP_BIRDIE_ROOM_LAYOUT) blit(A.SHOP_BIRDIE_ROOM_PIECES[p.name]!, (p.col + ((p.w ?? 1) - 1) / 2 + 0.5) * T, Y0 + (p.row + 0.5) * T, isFloor(p.name) ? (p.rot ?? 0) : 0);
  return out;
}

describe("Birdie's Station: the front (Nov 23)", () => {
  it("its picture is the art's station with the nest on top, its door in the middle, its box's walls and roof under the nest", () => {
    expect([HOUSE_BIRDIE.w, HOUSE_BIRDIE.h, ...HOUSE_BIRDIE.foot]).toEqual([144, 250, 72, 244]);
    expect(HOME_SPECS.birdie.door).toBe(HOUSE_BIRDIE_DOOR);
    expect(HOUSE_BIRDIE_DOOR).toBe(72);
    const b = homeBox("birdie");
    expect(b.left && b.right).toBeTruthy();
  });
  it("is a town boss's home: Birdie out front, admins first (core), its arrival title its name once", () => {
    expect(ALL_HOMES.find((h) => h.id === "birdie")?.name).toBe("Birdie's Station");
    expect(BOSS_ROSTER.some((b) => b.id === "birdie")).toBe(true);
    expect(areaBannerOf(def, "Birdie's Station")).toEqual({ sub: null, title: "BIRDIE'S STATION" });
  });
});

describe("Birdie's Station: the lobby, the art's picture cut into the room's pieces", () => {
  it("is 12 x 12, its way out the art's doorway, every floor square reached from the door", () => {
    expect(A.SHOP_BIRDIE_ROOM_N).toBe(12);
    expect(room.exits.map((s) => `${s.c},${s.r}`)).toEqual(["4,11", "5,11"]);
    const d = stepsFrom(room, room.start);
    for (const s of [...room.talkAt, { c: 4, r: 7 }, { c: 8, r: 7 }, { c: 1, r: 9 }, { c: 10, r: 9 }]) expect(d[s.r * 12 + s.c], `${s.c},${s.r}`).toBeGreaterThanOrEqual(0);
  });
  it("draws back as the art drew it, pixel for pixel, but where the room moved things (the vat, the pour's feeder) and the board the game writes", () => {
    const art = renderFrame(SHOP_BIRDIE_INTERIOR_3, SHOP_BIRDIE_INTERIOR_3.anims.idle!.frames[0]!).data;
    const ours = composed();
    const W = SHOP_BIRDIE_INTERIOR_3.w;
    // (The vat's old place and new, the run's middle feeder's old place and new, the board's flaps: x0, y0, x1, y1 in the art's pixels.)
    const moved = [[222, 106, 260, 230], [259, 186, 296, 233], [100, 0, 258, 85]];
    let diff = 0;
    for (let y = 0; y < SHOP_BIRDIE_INTERIOR_3.h; y++)
      for (let x = 0; x < W; x++) {
        if (moved.some(([x0, y0, x1, y1]) => x >= x0! && x < x1! && y >= y0! && y < y1!)) continue;
        const i = (y * W + x) * 4;
        if (art[i + 3]! < 128 && ours[i + 3]! < 128) continue;
        if (art[i] !== ours[i] || art[i + 1] !== ours[i + 1] || art[i + 2] !== ours[i + 2]) diff++;
      }
    expect(diff).toBe(0);
  });
  it("the bartender is the Shopkeeper: the town's light copy of his place is the art's, drawn 1:1", () => {
    expect(def.kid).toBe("birdiebartender");
    expect(def.at).toEqual(A.SHOP_BIRDIE_BARTENDER_AT);
    expect(def.tall).toBe(A.SHOP_BIRDIE_BARTENDER_TALL);
    expect(def.keeper).toEqual(A.SHOP_BIRDIE_KEEPER);
    expect(def.talkAt).toEqual(A.SHOP_BIRDIE_TALK_AT);
  });
  it("his pour lands in the feeder's top on the run's far edge, and his dip in the vat beside him", () => {
    const at = (name: string) => {
      const p = A.SHOP_BIRDIE_ROOM_LAYOUT.find((q) => q.name === name && (name !== "feeder" || (q.col === 7 && q.row === 4)))!;
      const ch = A.SHOP_BIRDIE_ROOM_PIECES[p.name]!;
      return { x: (p.col + 0.5) * T - ch.foot[0], y: Y0 + (p.row + 0.5) * T - ch.foot[1], w: ch.w, h: ch.h };
    };
    const feeders = A.SHOP_BIRDIE_ROOM_LAYOUT.filter((q) => q.name.startsWith("feeder") && q.row === 4 && q.col === 7);
    expect(feeders).toHaveLength(1);
    const ch = A.SHOP_BIRDIE_ROOM_PIECES[feeders[0]!.name]!;
    const fx = (7 + 0.5) * T - ch.foot[0], fy = Y0 + 4.5 * T - ch.foot[1];
    const [px, py] = A.SHOP_BIRDIE_POUR_AT;
    // (Its roof's top rows: the feeder's own pixels 1 to 5 under the outline.)
    expect(px).toBeGreaterThanOrEqual(fx + 2);
    expect(px).toBeLessThanOrEqual(fx + ch.w - 2);
    expect(py).toBeGreaterThanOrEqual(fy);
    expect(py).toBeLessThanOrEqual(fy + 5);
    // (The dip: his scoop's cup at frames 1 and 2, x 6 to 11, rows 18 to 26 of his frame, over the vat's picture.)
    const B = SIDEKICK_BIRDIE_BARTENDER;
    const foot = [(A.SHOP_BIRDIE_BARTENDER_AT[0] + 0.5) * T, Y0 + (A.SHOP_BIRDIE_BARTENDER_AT[1] + 0.5) * T];
    const vat = at("vat");
    const cup = { x: foot[0]! - B.foot[0] + 8.5, y: foot[1]! - B.foot[1] + 22 };
    expect(cup.x).toBeGreaterThan(vat.x + 4);
    expect(cup.x).toBeLessThan(vat.x + vat.w - 4);
    expect(cup.y).toBeGreaterThan(vat.y);
    expect(cup.y).toBeLessThan(vat.y + vat.h / 2);
    // (The vat behind him, the run in front: drawn before him, and after.)
    expect(A.SHOP_BIRDIE_ROOM_LAYOUT.find((q) => q.name === "vat")!.row).toBeLessThan(A.SHOP_BIRDIE_BARTENDER_AT[1]);
    expect(A.SHOP_BIRDIE_ROOM_LAYOUT.find((q) => q.name === "counter")!.row).toBeGreaterThan(A.SHOP_BIRDIE_BARTENDER_AT[1]);
    expect(SHOP_BIRDIE_PIECES.vat).toBeTruthy();
  });
});

describe("Birdie's challenge: the middle table and its two stools", () => {
  const marks = marksOf(A.SHOP_BIRDIE_ROOM_LAYOUT, "across", A.SHOP_BIRDIE_MARKS)!;
  it("its battle spot is the table's: you either side, clear of the stools, the boss on the left", () => {
    expect(marks.table).toEqual({ c: 6, r: 7 });
    expect([marks.boss.c, marks.you.c]).toEqual([4, 8]);
    for (const s of [marks.bossSq, marks.youSq]) expect(walkable(room, s.c, s.r), `${s.c},${s.r}`).toBe(true);
    for (const c of [5, 6, 7]) expect(walkable(room, c, 7), `${c},7`).toBe(false);
  });
  it("plays his hello as he says his line, the board pops onto the table, then the default wipe (his train's toot)", () => {
    const intro = introOf("birdie")!;
    expect(intro.custom).toBe(true);
    expect(intro.cues.hello).toBe("birdieHello");
    expect(intro.cues.wipe).toBe("birdieTrainToot");
    const tl = BIRDIE_INTRO.timeline;
    const beats = timelineBeats(tl);
    expect(beats.map((b) => b.step)).toEqual(["face", "line", "pause", "board", "table", "done"]);
    const line = beats.find((b) => b.step === "line")!;
    expect(timelineCues(tl).find((c) => c.cue === "hello")?.at).toBe(line.at);
    const board = beats.find((b) => b.step === "board")!;
    expect(timelineAt(tl, board.at - 1).cast.board?.on ?? false).toBe(false);
    expect(timelineAt(tl, board.at + 1).cast.board?.on).toBe(true);
    // (The pieces it stands in for are the room's.)
    for (const n of BIRDIE_INTRO.stands!) expect(A.SHOP_BIRDIE_ROOM_LAYOUT.some((p) => p.name === n), n).toBe(true);
    expect(A.SHOP_BIRDIE_TABLE.w).toBeGreaterThan(2 * T);
  });
});

describe("the split-flap board (flap-board.ts)", () => {
  const ids = ALL_HOMES.map((h) => h.id);
  const stops = boardStops(ids);
  it("goes to the town's buildings by their names: the Colosseum, the Battle Tower, the bosses' homes; never the Hidden Boss's or his", () => {
    expect(stops).toContain("COLOSSEUM");
    expect(stops).toContain("BATTLE TOWER");
    expect(stops).toContain("CHANDY'S SWAMP");
    const hidden = BOSS_ROSTER.find((b) => b.id === "recluse")!.name.toUpperCase();
    for (const s of stops) {
      expect(s).not.toMatch(/WALK-?UP/);
      expect(s).not.toContain(hidden);
      expect(s.length).toBeLessThanOrEqual(14);
    }
    expect(stops).not.toContain(BOARD_NAMES.birdie);
    // (Only this town's homes: a player's town has no admin-first homes on it.)
    expect(boardStops(ids.filter((i) => i !== "chandy"))).not.toContain("CHANDY'S SWAMP");
  });
  it("keeps its size: every row the same flaps, times as a board writes them, times rising down the page", () => {
    const r = rng(7);
    for (const page of ["dep", "arr"] as const) {
      const e = pageEntries(page, stops, r);
      const rows = pageRows(page, e);
      expect(rows).toHaveLength(4);
      for (const row of rows) {
        expect(row).toHaveLength(FLAP_COLS);
        expect(row.slice(0, 5)).toMatch(/^\d\d:\d\d$/);
      }
      for (let i = 1; i < e.length; i++) expect(e[i]!.mins).toBeGreaterThan(e[i - 1]!.mins);
      expect(new Set(e.map((x) => x.dest)).size).toBe(4);
    }
  });
  it("flips now and then: a row's status every few seconds, the page now and then, each flap through a few letters to its own", () => {
    const F = SHOP_FEEL.flaps;
    const r = rng(3);
    const b = newBoard(stops, r, 0);
    expect(stepBoard(b, stops, r, F.statusMs - 1)).toBe(false);
    const before = pageRows(b.page, b.entries).join("|");
    expect(stepBoard(b, stops, r, F.statusMs)).toBe(true);
    expect(pageRows(b.page, b.entries).join("|")).not.toBe(before);
    expect(b.page).toBe("dep");
    expect(stepBoard(b, stops, r, F.pageMs)).toBe(true);
    expect(b.page).toBe("arr");
    for (const [a, z] of [["A", "Z"], ["Z", "A"], [" ", "9"], ["1", "1"]] as const) {
      const s = flapSteps(a, z);
      expect(s.length).toBeLessThanOrEqual(F.maxSteps);
      if (a === z) expect(s).toEqual([]);
      else expect(s.at(-1)).toBe(z);
    }
  });
});
