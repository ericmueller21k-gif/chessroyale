import { describe, expect, it } from "vitest";
import { BOSS_CRATES, adminFirst, bossCrateOf, bossDef, itemDef } from "@chessroyale/core";
import {
  SHOP_GREX_BOARD_AT,
  SHOP_GREX_CRATE_AT,
  SHOP_GREX_CREW,
  SHOP_GREX_FLOOR,
  SHOP_GREX_FORK_PATH,
  SHOP_GREX_KEEPER,
  SHOP_GREX_LAYOUT,
  SHOP_GREX_LIFT_PATH,
  SHOP_GREX_LIGHTS,
  SHOP_GREX_MARKS,
  SHOP_GREX_PALLET_AT,
  SHOP_GREX_PIECES,
  SHOP_GREX_POOLS,
  SHOP_GREX_SHELF_SLOT,
  SHOP_GREX_TABLE_TOP,
} from "../src/town/shops/grex-art.ts";
import { BOSS_GREX_INTRO, INTRO_GREX_CREW_SETOFF, INTRO_GREX_CREW_SPOTS, INTRO_GREX_FRONT, INTRO_GREX_LIFT, INTRO_GREX_LIFT_H, INTRO_GREX_LIFT_MAX, INTRO_GREX_STORM, INTRO_GREX_TABLE } from "../src/town/shops/grex-intro-art.ts";
import { NPC_GREX } from "../src/town/shops/grex-crew-art.ts";
import { CREW_FORK_AT, CREW_SHEETS, CREW_STEP_OFF } from "../src/town/shops/grex-crew-sheets.ts";
import { Machine, along, forkLegs, liftLegs, routeLength, type Leg } from "../src/town/shops/grex-crew.ts";
import { inTalkRange, isFloor, lightsAt, makeRoom, squaresOf, tapTarget, walkable } from "../src/town/shops/room.ts";
import { SHOPS, holdLine, priceLine, prizeRows, shopOf } from "../src/town/shops/shops.ts";
import { CHALLENGE_FEEL, crewAnims, crewAt, crewCues, crewTimes, introAt, introBeats, introCues, introLength, introOf, lineOf, marksOf, type IntroStep } from "../src/town/shops/challenge.ts";
import { SIDEKICK_SHEETS } from "../src/town/sidekick-sheets.ts";
import { BOTS } from "../src/town/world.ts";
import { SHOP_FEEL } from "../src/town/feel.ts";
import { TABLE_BOARD } from "../src/town/houses/park.ts";
import { renderFrame } from "../src/characters/sprite.ts";
import { sidekickGrexDealer } from "../src/characters/sidekicks/dealer.ts";
import { crewHash } from "../../../scripts/bake-grex-crew.ts";

/**
 * Jefferson's warehouse and his challenge intro (Nov 4; docs/decisions/2026-11-04-jefferson-home.md): the art's room in the game with
 * its floor's shape, the dealer in his corner, his crate with Giraffe Gallop; the crew's baked sheets, the machines' loops (they wait for
 * anyone in their way and go on once it's clear); his intro's beats (the call, the crew walking over, your lift), its cues, the crew's
 * spots round the table.
 */
const def = SHOPS.grex!;
const room = makeRoom(SHOP_GREX_LAYOUT, def.keeper, 20, SHOP_GREX_FLOOR, def.talk);
const at = (c: number, r: number) => room.blocked[r * room.n + c] === 1;
const solidAt = (c: number, r: number) => SHOP_GREX_LAYOUT.some((p) => p.solid && !isFloor(p.name) && squaresOf(p).some((s) => s.c === c && s.r === r));

describe("Jefferson's warehouse", () => {
  it("its floor is 16 x 16 (columns 2-17, rows 3-18) and the door's two squares; everything round it is racking or wall, blocked", () => {
    expect(SHOP_GREX_FLOOR).toHaveLength(20);
    for (let r = 0; r < 20; r++)
      for (let c = 0; c < 20; c++) {
        const open = (r >= 3 && r <= 18 && c >= 2 && c <= 17) || (r === 19 && (c === 9 || c === 10));
        expect(SHOP_GREX_FLOOR[r]![c], `${c},${r}`).toBe(open ? "." : "#");
        if (!open) expect(at(c, r), `${c},${r} blocked`).toBe(true);
      }
    // You come in a step inside the door, and can walk to the dealer, the marks and round the board.
    expect(room.start).toEqual({ c: 10, r: 17 });
    expect(room.exits).toEqual([{ c: 9, r: 19 }, { c: 10, r: 19 }]);
  });

  it("the board on its crates stands in the battle spot (9-10, 10), solid, its foot 19 px south on the marks' line; the marks his west and yours east, the table halfway at (9.5, 10.5)", () => {
    const st = SHOP_GREX_LAYOUT.find((p) => p.name === "board-stand")!;
    expect([st.col, st.row, st.w, st.solid]).toEqual([9, 10, 2, true]);
    expect(SHOP_GREX_BOARD_AT).toEqual({ col: 9, row: 10, footDy: 19 });
    expect(10 + SHOP_GREX_BOARD_AT.footDy / 37).toBeCloseTo(10.5, 1);
    const m = marksOf(SHOP_GREX_LAYOUT, "across", SHOP_GREX_MARKS)!;
    expect([m.boss, m.you, m.table]).toEqual([{ c: 8, r: 10.5 }, { c: 11, r: 10.5 }, { c: 9.5, r: 10.5 }]);
    for (const s of [m.bossSq, m.youSq]) expect(walkable(room, s.c, s.r), `${s.c},${s.r}`).toBe(true);
  });

  it("no counter: a tap on the dealer's squares, his crate on the floor at (15, 3) or the bare corner behind him means talk, and walks you up in front of him", () => {
    expect(SHOP_GREX_LAYOUT.some((p) => p.name === "counter")).toBe(false);
    expect(SHOP_GREX_CRATE_AT).toEqual({ col: 15, row: 3 });
    const crate = SHOP_GREX_LAYOUT.find((p) => p.name === "crate")!;
    expect([crate.col, crate.row, crate.solid]).toEqual([15, 3, true]);
    for (const [c, r] of [[16, 3], [17, 3], [15, 3], [16, 2], [17, 2]] as const) {
      const t = tapTarget(room, room.start, c, r);
      expect(t.kind, `${c},${r}`).toBe("keeper");
      expect(inTalkRange(room, t.dest!.c, t.dest!.r), `${c},${r}`).toBe(true);
    }
  });

  it("lights at every placement: the four high-bay lamps each have their halo and their pool; the windows, the doorway and the crate's fuse light", () => {
    const places = SHOP_GREX_LAYOUT.filter((p) => !isFloor(p.name));
    const halos = lightsAt(SHOP_GREX_LIGHTS, places, (l) => !!l.halo);
    const pools = lightsAt(SHOP_GREX_POOLS, places);
    const lamps = places.filter((p) => p.name === "lamp");
    expect(lamps.map((p) => [p.col, p.row])).toEqual([[5, 6], [14, 6], [5, 14], [14, 14]]);
    for (const l of lamps) {
      expect(halos.some((h) => h.at === l), `${l.col},${l.row} halo`).toBe(true);
      expect(pools.some((h) => h.at === l), `${l.col},${l.row} pool`).toBe(true);
    }
    expect(halos.some((h) => h.at.name === "crate")).toBe(true);
    expect(halos.filter((h) => h.at.name.startsWith("wall-win")).length).toBeGreaterThan(2);
    for (const name of Object.keys(SHOP_GREX_PIECES)) expect(SHOP_GREX_PIECES[name]!.anims.idle!.frames.length, name).toBeGreaterThan(0);
  });
});

describe("the dealer keeps the shop, in his corner", () => {
  it("his sheet is baked (64 x 104, feet at 30, 100; idle 12, walk 6, sit 10, wave 8)", () => {
    const s = SIDEKICK_SHEETS.dealer;
    expect([s.id, s.w, s.h, ...s.foot]).toEqual(["sidekick-grex-dealer", 64, 104, 30, 100]);
    expect([s.ms.idle.length, s.ms.walk.length, s.ms.sit.length, s.ms.wave.length]).toEqual([12, 6, 10, 8]);
    expect(sidekickGrexDealer.id).toBe(s.id);
  });

  it("he isn't a town bot: Sparky stays Jefferson's kid in the town", () => {
    expect(BOTS.filter((b) => b.boss === "grex").map((b) => b.name)).toEqual(["Sparky"]);
  });

  it("on his squares (16, 3) and (17, 3), drawn at his art's size (79 px), facing west, by the taped SHOP sign; no name, the day tone", () => {
    expect(def).toMatchObject({ home: "grex", boss: "Jefferson", kid: "dealer", at: [16.8, 3.2], tall: 79, flip: true, roof: "warehouse", chatTone: "day" });
    expect(def.keeper).toEqual(SHOP_GREX_KEEPER.keeper);
    expect(def.at).toEqual(SHOP_GREX_KEEPER.at);
    // (His drawn height: 79 of the room's pixels, as the art draws him; the kids' is SHOP's sidekickSquares.)
    const s = SIDEKICK_SHEETS.dealer;
    const px = (def.tall! / 37 / ((s.foot[1] - s.top.idle) / s.h)) * 37;
    expect((px * (s.foot[1] - s.top.idle)) / s.h).toBeCloseTo(79, 5);
    for (const k of def.keeper) expect(at(k.c, k.r)).toBe(true);
  });
});

describe("Jefferson's Boss Crate and Giraffe Gallop", () => {
  it("in BOSS_CRATES with his ride, Giraffe Gallop, first; sold to everyone (Jefferson is live); its words as the others'", () => {
    const crate = bossCrateOf("grex")!;
    expect(BOSS_CRATES.at(-1)).toBe(crate);
    expect([crate.id, crate.name, crate.ride]).toEqual(["boss-grex", "Jefferson's Boss Crate", "jefferson-giraffe"]);
    expect(crate.items).toContain("jefferson-giraffe");
    expect(adminFirst(bossDef("grex")!)).toBe(false);
    expect(itemDef("jefferson-giraffe")).toMatchObject({ name: "Giraffe Gallop", tier: "mythic", slot: "ride" });
    expect(shopOf("grex")!.crate).toBe(crate.name);
    expect(priceLine(def)).toBe("3 Jefferson tokens, or 1 Jefferson token + 1 crate key");
    expect(holdLine(def, { tokens: 1, keys: 1 })).toBe("You have 1 Jefferson token and 1 crate key.");
    expect(prizeRows(def)[0]).toMatchObject({ id: "jefferson-giraffe", name: "Giraffe Gallop", kind: "Mythic ride" });
  });
});

describe("the crew (baked sheets)", () => {
  it("each figure's sheet is its sprite as drawn (scripts/bake-grex-crew.ts): every animation, every pixel, its times and cues", () => {
    const sheets = Object.values(CREW_SHEETS);
    expect(sheets.map((s) => s.id).sort()).toEqual(Object.keys(NPC_GREX).sort());
    for (const sh of sheets) {
      const ch = NPC_GREX[sh.id]!;
      expect([sh.w, sh.h, ...sh.foot], sh.id).toEqual([ch.w, ch.h, ...ch.foot]);
      expect(Object.keys(sh.anims), sh.id).toEqual(Object.keys(ch.anims));
      for (const [a, an] of Object.entries(sh.anims)) {
        expect(an.ms, `${sh.id} ${a}`).toEqual(ch.anims[a]!.frames.map((f) => f.ms));
        expect(an.cues, `${sh.id} ${a}`).toEqual(ch.anims[a]!.frames.map((f) => f.cue ?? null));
      }
      expect(sh.hash, `${sh.id}: run npx tsx scripts/bake-grex-crew.ts`).toBe(crewHash(ch));
    }
  }, 60_000);

  it("the idle crew stand where the art puts them (on the floor, by their wall, pallet and seat), and nobody walks through them", () => {
    expect(SHOP_GREX_CREW["leaner-a"]).toEqual({ at: [2, 16], face: 1 });
    expect(SHOP_GREX_CREW["leaner-b"]).toEqual({ at: [2, 18], face: 1 });
    expect(SHOP_GREX_CREW["crew-c"]).toEqual({ at: [11, 4], face: 1 });
    expect(SHOP_GREX_CREW["crew-d"]).toEqual({ at: [4, 17], face: 1 });
    // (ShopRoom blocks the three that stand on bare floor; the dozer sits on his solid pallet.)
    for (const k of ["leaner-a", "leaner-b", "crew-c"] as const) expect(SHOP_GREX_FLOOR[SHOP_GREX_CREW[k].at[1]]![SHOP_GREX_CREW[k].at[0]], k).toBe(".");
    expect(solidAt(4, 17)).toBe(true);
  });
});

describe("the machines' loops (Eric, Nov 4: \"If you block it, it stops. If you move out of the way, it starts moving again\")", () => {
  const F = SHOP_FEEL.crew;
  const lift = liftLegs(SHOP_GREX_LIFT_PATH, F);
  const fork = forkLegs(SHOP_GREX_FORK_PATH, F);
  const squares = (legs: readonly Leg[]) => legs.flatMap((l) => [l.from, l.to]);

  it("the lift shuttles along row 5 (columns 4-8), the forklift in the south-east corner (rows 17-18, columns 13-17): every square on the floor, clear of the racking, the board, the marks, the dealer and the crew", () => {
    const m = marksOf(SHOP_GREX_LAYOUT, "across", SHOP_GREX_MARKS)!;
    const keep = [m.bossSq, m.youSq, { c: 9, r: 10 }, { c: 10, r: 10 }, ...def.keeper, ...Object.values(SHOP_GREX_CREW).filter((x) => x !== SHOP_GREX_CREW.lift && x !== SHOP_GREX_CREW.forklift).map((x) => ({ c: x.at[0], r: x.at[1] }))];
    for (const [name, legs] of [["lift", lift], ["forklift", fork]] as const)
      for (const s of squares(legs)) {
        expect(SHOP_GREX_FLOOR[s.r]![s.c], `${name} ${s.c},${s.r} on the floor`).toBe(".");
        expect(solidAt(s.c, s.r), `${name} ${s.c},${s.r} clear of stock`).toBe(false);
        expect(keep.some((k) => k.c === s.c && k.r === s.r), `${name} ${s.c},${s.r} clear`).toBe(false);
      }
    expect(new Set(squares(lift).map((s) => s.r))).toEqual(new Set([5]));
    for (const s of squares(fork)) expect(s.r >= 17 && s.c >= 13 && s.c <= 17, `${s.c},${s.r}`).toBe(true);
    // (Its forks reach a square east of its foot: the floor pallet's square, the shelf slot's.)
    expect(SHOP_GREX_PALLET_AT).toEqual([16.16, 18]);
    expect(SHOP_GREX_SHELF_SLOT).toEqual({ col: 18, row: 17, level: 1, lift: 46 });
    expect(solidAt(18, 17)).toBe(true);
  });

  it("each leg a step to the next square or a beat in place; the lift faces the way it goes, the forklift always east (backing up west)", () => {
    for (const legs of [lift, fork])
      for (const l of legs) expect(Math.abs(l.to.c - l.from.c) + Math.abs(l.to.r - l.from.r), JSON.stringify(l)).toBeLessThanOrEqual(1);
    for (const l of lift) if (l.to.c !== l.from.c) expect(l.flip).toBe(l.to.c < l.from.c);
    for (const l of fork) {
      expect(l.flip).toBe(false);
      if (l.to.c > l.from.c && l.still === undefined) expect(l.anim).toBe("drive");
      if (l.to.c < l.from.c && l.still === undefined) expect(l.anim).toBe("reverse");
    }
    // The lift raises its platform at each of its three stops.
    expect(lift.filter((l) => l.anim === "up").map((l) => l.from.c)).toEqual([6, 8, 6]);
  });

  it("the pallet goes floor, forks, shelf, forks, floor on its two laps, never conjured: picked up at (15, 18), stacked and unstacked at (17, 17)", () => {
    const hands = fork.filter((l) => l.pallet).map((l) => `${l.pallet}@${l.from.c},${l.from.r}`);
    expect(hands).toEqual(["forks@15,18", "shelf@17,17", "forks@17,17", "floor@15,18"]);
    const m = new Machine("forklift", fork);
    const seen: string[] = [m.pallet];
    for (let t = 0; t < 120_000; t += 50) {
      m.update(50, () => false);
      if (seen.at(-1) !== m.pallet) seen.push(m.pallet);
    }
    expect(seen.slice(0, 5)).toEqual(["floor", "forks", "shelf", "forks", "floor"]);
    // (Backing out of the slot its forks stay up, its last frame held, then lower; the pallet rides on them per frame.)
    const held = fork.filter((l) => l.still !== undefined);
    expect(held.length).toBe(4);
    for (const l of held) expect(CREW_FORK_AT[l.anim]![l.still!], l.anim).toBeDefined();
  });

  it("goes round its loop at a slow walk, a square every stepMs", () => {
    const m = new Machine("lift", lift);
    const total = lift.reduce((a, l) => a + l.ms, 0);
    const moves = lift.filter((l) => l.from.c !== l.to.c).length;
    expect(moves).toBe(8);
    expect(lift.filter((l) => l.from.c !== l.to.c).every((l) => l.ms === F.stepMs)).toBe(true);
    m.update(total, () => false);
    expect([m.i, m.t]).toEqual([0, 0]);
  });

  it("stops when someone stands on the square it's stepping onto or the one after it, waits there, and goes on once they're clear; it blocks walkers where it stands", () => {
    const m = new Machine("lift", lift);
    const pose = { c: 0, r: 0, anim: "", frame: 0, flip: false, waiting: false };
    // You on (6, 5): it rests at (4, 5), steps to (5, 5) (its next square and the one after it: (5, 5) and (6, 5)... taken), so waits at (4, 5).
    let you = { c: 6, r: 5 };
    const taken = (c: number, r: number) => c === you.c && r === you.r;
    m.update(F.endMs + 10, taken);
    m.pose(pose);
    expect([pose.c, pose.r, pose.waiting]).toEqual([4, 5, true]);
    for (let i = 0; i < 100; i++) m.update(50, taken);
    m.pose(pose);
    expect([pose.c, pose.r, pose.waiting, pose.anim]).toEqual([4, 5, true, "idle"]);
    expect(m.occupies(4, 5)).toBe(true);
    expect(m.occupies(5, 5)).toBe(false);
    // You step aside: it goes on.
    you = { c: 6, r: 7 };
    m.update(F.stepMs / 2, taken);
    m.pose(pose);
    expect(pose.waiting).toBe(false);
    expect(pose.c).toBeCloseTo(4.5, 5);
    expect([m.occupies(4, 5), m.occupies(5, 5)]).toEqual([true, true]);
    m.update(F.stepMs / 2, taken);
    m.pose(pose);
    expect([pose.c, pose.r]).toEqual([5, 5]);
    // The forklift blocks its forks' square too (ahead of its foot, east).
    const f = new Machine("forklift", fork);
    expect([f.occupies(13, 18), f.occupies(14, 18), f.occupies(12, 18)]).toEqual([true, true, false]);
  });

  it("once a step has begun it finishes (nobody is cut off mid-square); stopped (the intro) it parks where it is", () => {
    const m = new Machine("lift", lift);
    m.update(F.endMs + F.stepMs / 2, () => false);
    const pose = { c: 0, r: 0, anim: "", frame: 0, flip: false, waiting: false };
    m.update(F.stepMs / 4, () => true);
    m.pose(pose);
    expect(pose.c).toBeCloseTo(4.75, 5);
    m.stop();
    m.update(10_000, () => false);
    m.pose(pose);
    expect(pose.c).toBeCloseTo(4.75, 5);
    expect(m.occupies(5, 5)).toBe(true);
  });
});

describe("his challenge intro (Nov 4: Eric's design)", () => {
  const anims = crewAnims({ mover: BOSS_GREX_INTRO, lift: INTRO_GREX_LIFT, table: INTRO_GREX_TABLE });
  const beats = introBeats(anims);
  const atStep = (s: IntroStep) => beats.find((b) => b.step === s)!.at;
  const intro = introOf("grex")!;

  it("his own intro, across, on the marks: one of his four calls at random (placeholders until Eric's Gemini lines)", () => {
    expect(intro).toMatchObject({ name: "Jefferson", layout: "across", custom: true });
    expect(intro.lines).toEqual(["Boys! We got a challenger!", "Take five, everybody. We're playing chess.", "Who wants a fifteen-minute break?", "Forks down, boys. Somebody wants a game."]);
    expect(intro.line).toBe(intro.lines![0]);
    expect(intro.lines!.map((_, i) => lineOf(intro, () => (i + 0.5) / 4))).toEqual(intro.lines);
    expect(lineOf(intro, () => 0.999999)).toBe(intro.lines![3]);
  });

  it("the beats in order, about 13 s from the marks to the wipe (Eric: 13-15): the line, the call, the wave over, the walk, your lift, the creak, the brag, the swing", () => {
    expect(beats.map((b) => b.step)).toEqual(["face", "line", "call", "wave", "walk", "lift", "creak", "brag", "swing", "done"]);
    for (let i = 1; i < beats.length; i++) expect(beats[i]!.at, beats[i]!.step).toBe(beats[i - 1]!.end);
    const total = introLength(beats) + CHALLENGE_FEEL.stormInMs;
    expect(total).toBeGreaterThan(12_500);
    expect(total).toBeLessThan(15_000);
    // (The crew stop in his call, set off just after; your lift `walkMs` after that.)
    const T = crewTimes(beats, anims);
    expect(T.stop).toBe(atStep("call") + CHALLENGE_FEEL.crew.stopMs);
    expect(T.setOff).toBe(T.stop + CHALLENGE_FEEL.crew.setOffMs);
    expect(T.lift).toBe(T.setOff + CHALLENGE_FEEL.crew.walkMs);
    expect(T.locked).toBe(atStep("creak"));
  });

  it("his moves in their beats; the crew stop and set off; your lift flush, rising, then up; the table there from the start, its creak as your lift locks", () => {
    const now = (t: number) => introAt(beats, anims, t);
    expect(now(atStep("line") + 10)).toMatchObject({ line: true, table: true, stools: false, crew: { move: null, stopped: -1, walk: -1, lift: { anim: "flush" } } });
    expect(now(atStep("call") + 10).crew!.move!.anim).toBe("call");
    expect(now(atStep("wave") + 10).crew!.move!.anim).toBe("waveOver");
    expect(now(atStep("walk") + 10).crew!.move).toBeNull();
    expect(now(atStep("walk") + 10).crew!.walk).toBeGreaterThan(0);
    expect(now(atStep("lift") + 10).crew!.lift.anim).toBe("rise");
    expect(now(atStep("creak") + 10).crew).toMatchObject({ lift: { anim: "up" }, table: { anim: "creak" } });
    expect(now(atStep("brag") + 10).crew).toMatchObject({ move: { anim: "brag" }, table: { anim: "idle" } });
    expect(now(atStep("swing") + 10).crew!.move).toBeNull();
    // (No hop back: there are no stools; you both stand on the marks.)
    for (const t of [0, atStep("lift"), atStep("swing")]) expect([now(t).back, now(t).hop], `${t}`).toEqual([0, 0]);
    expect(crewAt(beats, anims, atStep("creak")).untilLocked).toBe(0);
  });

  it("your lift ends level with the board: its plate 32 px up, the board's slab 59 over its foot, so 27 over your feet, as a park table's over the floor (within a pixel)", () => {
    expect(INTRO_GREX_LIFT_MAX).toBe(32);
    expect(INTRO_GREX_LIFT_H.rise!.at(-1)).toBe(INTRO_GREX_LIFT_MAX);
    expect(INTRO_GREX_LIFT_H.up).toEqual([32, 32]);
    expect(INTRO_GREX_LIFT_H.flush).toEqual([0]);
    // (A park table's slab is TABLE_BOARD.top over the floor, 26 in the game (the art's notes say 27): within a pixel.)
    expect(Math.abs(SHOP_GREX_TABLE_TOP - INTRO_GREX_LIFT_MAX - TABLE_BOARD.top)).toBeLessThanOrEqual(1);
    // (It rises steadily: never back down on the way.)
    const h = INTRO_GREX_LIFT_H.rise!;
    for (let i = 1; i < h.length; i++) expect(h[i]!).toBeGreaterThanOrEqual(h[i - 1]!);
  });

  it("every cue a sound of his own, in order: his hollers, his whoosh, the machine guys' steps, the dozer's snort, your lift's hiss and clunk, the crates' creaks, his brag's; the wipe's whistle, pop, bang and fizz", () => {
    const cues = introCues(beats, anims);
    for (let i = 1; i < cues.length; i++) expect(cues[i]!.at).toBeGreaterThanOrEqual(cues[i - 1]!.at);
    for (const c of cues) expect(intro.cues[c.cue], c.cue).toBeTruthy();
    const names = new Set(cues.map((c) => c.cue));
    for (const n of ["shout", "whoosh", "step", "snort", "hiss", "clunk", "creak", "creakSoft", "laugh", "fizz", "stomp"]) expect(names.has(n), n).toBe(true);
    expect(cues.filter((c) => c.cue === "shout").length).toBe(2);
    expect(cues.find((c) => c.cue === "hiss")!.at).toBe(atStep("lift"));
    // The crew's walking steps are the room's (their sheets' `step` cues): a sound too.
    for (const sh of Object.values(CREW_SHEETS)) if ("walk" in sh.anims) expect(new Set(sh.anims.walk.cues.filter(Boolean)), sh.id).toEqual(new Set(["step"]));
    expect(intro.cues.step).toBe("grexStep");
    // The wipe's own (its frames' cues, the front's fizz as it starts).
    for (const f of INTRO_GREX_STORM.anims.idle!.frames) if (f.cue) expect(intro.cues[f.cue], f.cue).toBeTruthy();
    expect(INTRO_GREX_FRONT.anims.idle!.frames.some((f) => f.cue === "fizz")).toBe(true);
    expect(intro.cues.storm).toBe("grexFizz");
    // (crewCues takes the sheets' step-off and wake from the baked metadata.)
    expect(crewCues(beats, anims).length).toBe(cues.length);
  });

  it("the crew's spots: a loose ring behind (north of) the table, him and you, each facing the table; each walks round its north side and is there by the time your lift locks", () => {
    const m = marksOf(SHOP_GREX_LAYOUT, "across", SHOP_GREX_MARKS)!;
    const keys = Object.keys(INTRO_GREX_CREW_SPOTS) as (keyof typeof INTRO_GREX_CREW_SPOTS)[];
    expect(keys.sort()).toEqual(Object.keys(INTRO_GREX_CREW_SETOFF).sort());
    expect(keys.length).toBe(7);
    for (const k of keys) {
      const s = INTRO_GREX_CREW_SPOTS[k];
      expect(s.at[1], k).toBeLessThan(m.table.r);
      expect(s.face, k).toBe(s.at[0] < m.table.c ? 1 : -1);
      expect(SHOP_GREX_FLOOR[Math.round(s.at[1])]![Math.round(s.at[0])], k).toBe(".");
    }
    // Their ways (from their places; the machine guys from beside their machines' homes): never between him and the table or you and
    // the table (the marks' row west of the table to his mark, east of it to yours), each there before the lock at `speed` or faster.
    const K = CHALLENGE_FEEL.crew;
    const T = crewTimes(beats, anims);
    const lead = (from: readonly [number, number]) => ({ c: from[0], r: from[1] });
    const home = {
      "lift-guy": { c: 4 + CREW_STEP_OFF.lift[0] / 37, r: 5 + CREW_STEP_OFF.lift[1] / 37 },
      "fork-guy": { c: 13 + CREW_STEP_OFF.forklift[0] / 37, r: 18 + CREW_STEP_OFF.forklift[1] / 37 },
      "leaner-a": lead(SHOP_GREX_CREW["leaner-a"].at),
      "leaner-b": lead(SHOP_GREX_CREW["leaner-b"].at),
      "crew-c": lead(SHOP_GREX_CREW["crew-c"].at),
      "crew-d": lead(SHOP_GREX_CREW["crew-d"].at),
      dealer: lead(SHOP_GREX_KEEPER.at),
    };
    const out = { c: 0, r: 0, face: 1 as 1 | -1, done: false };
    for (const k of keys) {
      const pts = [home[k], ...K.via[k].map(([c, r]) => ({ c, r })), { c: INTRO_GREX_CREW_SPOTS[k].at[0], r: INTRO_GREX_CREW_SPOTS[k].at[1] }];
      const L = routeLength(pts);
      for (let d = 0; d <= L; d += 0.05) {
        along(pts, 1, d * 1000, out);
        const between = Math.abs(out.r - m.table.r) < 0.45 && ((out.c > m.boss.c - 0.2 && out.c < m.table.c + 0.6) || (out.c > m.table.c - 0.6 && out.c < m.you.c + 0.2));
        expect(between, `${k} at ${out.c.toFixed(2)},${out.r.toFixed(2)}`).toBe(false);
      }
      // (The room's: he goes his setoff after the stop (the machine guys once off, the dozer once awake), at `speed` or as much faster
      // as he must to be there as your lift locks: never more than a third faster.)
      const off = CREW_SHEETS.lift.anims.stepOff.ms.reduce((a, b) => a + b, 0);
      const wake = CREW_SHEETS["crew-d"].anims.wake.ms.reduce((a, b) => a + b, 0);
      const own = K.setOffMs + INTRO_GREX_CREW_SETOFF[k];
      const start = k === "lift-guy" || k === "fork-guy" ? Math.max(own, off) : k === "crew-d" ? own + wake : own;
      const left = T.locked - T.stop - start;
      expect(L / (left / 1000), k).toBeLessThan(K.speed * 1.35);
    }
  });

  it("his moves and props are drawn: every frame of his call, wave over and brag, the table and your lift has pixels", () => {
    for (const [ch, list] of [[BOSS_GREX_INTRO, ["call", "waveOver", "brag"]], [INTRO_GREX_TABLE, ["idle", "creak"]], [INTRO_GREX_LIFT, ["rise", "up"]]] as const)
      for (const a of list)
        for (const f of ch.anims[a]!.frames) {
          const { data } = renderFrame(ch, f);
          let n = 0;
          for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) n++;
          expect(n, `${ch.id} ${a}`).toBeGreaterThan(50);
        }
  });
});
