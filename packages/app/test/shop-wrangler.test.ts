import { describe, expect, it } from "vitest";
import { BOSS_CRATES, adminFirst, bossCrateOf, bossDef, itemDef } from "@chessroyale/core";
import { SHOP_PIG_BOARD_AT, SHOP_PIG_COUNTER_SIGN, SHOP_PIG_CRATE_AT, SHOP_PIG_LAYOUT, SHOP_PIG_LIGHTS, SHOP_PIG_MARKS, SHOP_PIG_PIECES, SHOP_PIG_POOLS } from "../src/town/shops/pig-art.ts";
import { SHOP_PUDDLES_LAYOUT, SHOP_PUDDLES_PIECES } from "../src/town/shops/puddles-art.ts";
import {
  BOSS_PIG_INTRO,
  INTRO_PIG_BUCKET_B,
  INTRO_PIG_BUCKET_HANDLE,
  INTRO_PIG_BUCKET_W,
  INTRO_PIG_FRONT,
  INTRO_PIG_ROPE,
  INTRO_PIG_ROPE_KNOT,
  INTRO_PIG_STORM,
  INTRO_PIG_TABLE,
  INTRO_PIG_TABLE_LIFT,
  PIG_INTRO_HANDS,
  PIG_INTRO_HANDS2,
  PIG_INTRO_RELEASE,
} from "../src/town/shops/pig-intro-art.ts";
import { findPath, inTalkRange, isFloor, lightsAt, makeRoom, tapTarget, walkable } from "../src/town/shops/room.ts";
import { SHOPS, holdLine, priceLine, prizeRows, shopOf } from "../src/town/shops/shops.ts";
import { CHALLENGE_FEEL, introAt, introBeats, introCues, introLength, introOf, marksFeel, marksOf, ropeAnims, ropeAt, ropeTimes, seatedMarks, type IntroStep } from "../src/town/shops/challenge.ts";
import { SIDEKICK_SHEETS } from "../src/town/sidekick-sheets.ts";
import { ADMIN_BOTS, BOTS, TOWN_BOTS, isSprite } from "../src/town/world.ts";
import { BOSS_ART } from "../src/town/render.ts";
import { PARK_TABLE } from "../src/town/houses/park.ts";
import { TOWN_FEEL } from "../src/town/feel.ts";
import { renderFrame, type Character } from "../src/characters/sprite.ts";
import { PIG } from "../src/characters/pig.ts";

/**
 * Wrangler's barn and his challenge intro (Nov 4; docs/decisions/2026-11-04-wrangler-home.md): the art's room in the game, his rooster on
 * the counter, his crate with Pen Pony; his intro's beats (the lasso, the bale dragged in, the buckets yanked in), its cues, and where the
 * bale and the buckets land.
 */
const def = SHOPS.pig!;
const room = makeRoom(SHOP_PIG_LAYOUT, def.keeper);

describe("Wrangler's barn", () => {
  it("is a box room (no floor's shape): you come in at the doorway and can walk to the counter, the battle spot and every square that isn't solid", () => {
    expect(room.floor).toBeNull();
    expect(SHOP_PIG_LAYOUT.find((p) => p.name === "entrance")).toMatchObject({ col: 9, row: 19, exit: true });
    const from = room.start;
    expect(walkable(room, from.c, from.r)).toBe(true);
    let blockedFloor = 0;
    for (let r = 1; r < 19; r++)
      for (let c = 1; c < 19; c++) {
        if (!walkable(room, c, r)) continue;
        expect(findPath(room, from, { c, r }), `${c},${r}`).not.toBeNull();
      }
    for (let r = 1; r < 19; r++) for (let c = 1; c < 19; c++) if (!walkable(room, c, r)) blockedFloor++;
    // (Solid things: the counter, the stand, the pens, the hay, the saddles, the barrels, the troughs, the buckets.)
    expect(blockedFloor).toBeGreaterThan(20);
    // The marks and the battle spot's middle squares are free.
    for (const [c, r] of [[8, 10], [8, 11], [9, 10], [9, 11], [10, 10], [10, 11], [11, 10], [11, 11], [7, 10], [7, 11], [12, 11]] as const) expect(walkable(room, c, r), `${c},${r}`).toBe(true);
  });

  it("the board on its hay bale stands set back at (4, 3), solid: the intro's lasso target; the pens stand up whole (3 x 2 each)", () => {
    expect(SHOP_PIG_BOARD_AT).toEqual({ col: 4, row: 3 });
    expect(SHOP_PIG_LAYOUT.find((p) => p.name === "board-stand")).toMatchObject({ col: 4, row: 3, solid: true });
    expect(walkable(room, 4, 3)).toBe(false);
    for (const name of ["pen", "pen-b"]) {
      const p = SHOP_PIG_LAYOUT.find((x) => x.name === name)!;
      expect([p.w, p.d], name).toEqual([3, 2]);
    }
  });

  it("its drawn marks are on the battle spot's middle line, his west and yours east, the table halfway", () => {
    const m = marksOf(SHOP_PIG_LAYOUT, "across", SHOP_PIG_MARKS)!;
    expect([m.boss, m.you, m.table]).toEqual([{ c: 8, r: 10.5 }, { c: 11, r: 10.5 }, { c: 9.5, r: 10.5 }]);
    expect(SHOP_PIG_LAYOUT.filter((p) => p.name.startsWith("circle-")).length).toBeGreaterThan(30);
    expect(SHOP_PIG_LAYOUT.filter((p) => isFloor(p.name)).length).toBe(400);
  });

  it("lights at every placement: the four lanterns each have their halo and their pool; the windows and the doorway light", () => {
    const ups = SHOP_PIG_LAYOUT.filter((p) => !isFloor(p.name));
    const lanterns = (xs: { at: { name: string; col: number; row: number } }[]) => xs.filter((x) => x.at.name.startsWith("lantern")).map((x) => `${x.at.col},${x.at.row}`).sort();
    const four = ["5,6", "14,7", "5,15", "14,15"].sort();
    expect(lanterns(lightsAt(SHOP_PIG_LIGHTS, ups, (l) => !!l.halo))).toEqual(four);
    expect(lanterns(lightsAt(SHOP_PIG_POOLS, ups))).toEqual(four);
    expect(lightsAt(SHOP_PIG_LIGHTS, ups).filter((x) => x.at.name === "wall-win").length).toBe(ups.filter((p) => p.name === "wall-win").length);
  });
});

describe("the rooster keeps the shop, on the counter (Eric's pick)", () => {
  it("his sheet is baked (64 x 64, feet at 30, 61; idle 12, walk 6, sit 10, wave 8)", () => {
    const s = SIDEKICK_SHEETS.rooster;
    expect(s.id).toBe("sidekick-pig-rooster");
    expect([s.w, s.h, ...s.foot]).toEqual([64, 64, 30, 61]);
    expect([s.ms.idle.length, s.ms.walk.length, s.ms.sit.length, s.ms.wave.length]).toEqual([12, 6, 10, 8]);
  });

  it("he isn't a town bot: the piglet stays Wrangler's kid in the town", () => {
    for (const b of [...BOTS, ...ADMIN_BOTS, ...TOWN_BOTS]) if (isSprite(b.look)) expect(b.look.sprite.id, b.name).not.toBe("sidekick-pig-rooster");
    expect(BOTS.find((b) => b.boss === "pig")?.look).toMatchObject({ sprite: SIDEKICK_SHEETS.wrangler });
  });

  it("stands on the counter's plank top, on its middle (its own row, raised 27 px: the counter's foot to its top); his squares behind it; no name, the day tone", () => {
    expect(def).toMatchObject({ home: "pig", boss: "Wrangler", crate: "Wrangler's Boss Crate", kid: "rooster", at: [9.5, 3], keeper: [{ c: 9, r: 2 }, { c: 10, r: 2 }], roof: "barn", chatTone: "day" });
    const counter = SHOP_PIG_LAYOUT.find((p) => p.name === "counter")!;
    expect(counter).toMatchObject({ col: 8, row: 3, w: 4, solid: true });
    // (His feet on the plank top, where the crate's foot sits on it too.)
    expect(def.lift).toBe(SHOP_PIG_PIECES.counter!.foot[1] - SHOP_PIG_CRATE_AT[1]);
    expect(def.at[0]).toBe(counter.col + (counter.w! - 1) / 2);
    expect(def.at[1]).toBe(counter.row);
    // Clear of the crate on the counter's east end and of the bell and the corn basket west: the counter's middle, over its plaque.
    const mid = SHOP_PIG_PIECES.counter!.foot[0];
    expect(SHOP_PIG_CRATE_AT[0] - mid).toBeGreaterThan(30);
    expect(Math.abs(SHOP_PIG_COUNTER_SIGN.x + SHOP_PIG_COUNTER_SIGN.w / 2 - mid)).toBeLessThan(2);
    // You talk to him from in front of the counter: a tap on him walks you there.
    const there = tapTarget(room, room.start, def.keeper[0]!.c, def.keeper[0]!.r);
    expect(there.kind).toBe("keeper");
    expect([4, 5]).toContain(there.dest!.r);
    expect(inTalkRange(room, there.dest!.c, there.dest!.r)).toBe(true);
  });
});

describe("Wrangler's Boss Crate and Pen Pony", () => {
  it("in BOSS_CRATES with his ride, Pen Pony, first; sold to everyone (Wrangler is live); its words as the others'", () => {
    const crate = bossCrateOf("pig")!;
    expect(BOSS_CRATES.at(-1)).toBe(crate);
    expect([crate.id, crate.name, crate.ride]).toEqual(["boss-pig", "Wrangler's Boss Crate", "pen-pony"]);
    expect(crate.items).toContain("pen-pony");
    expect(adminFirst(bossDef("pig")!)).toBe(false);
    expect(itemDef("pen-pony")).toMatchObject({ name: "Pen Pony", tier: "mythic", slot: "ride" });
    expect(priceLine(def)).toBe("3 Wrangler tokens, or 1 Wrangler token + 1 crate key");
    expect(holdLine(def, { tokens: 1, keys: 0 })).toBe("You have 1 Wrangler token and 0 crate keys.");
    expect(prizeRows(def)[0]).toMatchObject({ id: "pen-pony", name: "Pen Pony", kind: "Mythic ride" });
  });
});

describe("Puddles' HunChess buckets (Nov 4)", () => {
  it("three, solid, where the art put them: the stack by the potting bench, one by the fountain, one by the hose reel", () => {
    for (const [name, col, row] of [["bucket-stack", 4, 3], ["bucket", 5, 9], ["bucket-b", 18, 16]] as const) {
      expect(SHOP_PUDDLES_LAYOUT.find((p) => p.name === name), name).toMatchObject({ col, row, solid: true });
      expect(SHOP_PUDDLES_PIECES[name], name).toBeDefined();
    }
    // (His shop is still walkable from the door to the counter.)
    const pr = makeRoom(SHOP_PUDDLES_LAYOUT, SHOPS.gardener!.keeper);
    expect(findPath(pr, pr.start, tapTarget(pr, pr.start, SHOPS.gardener!.keeper[0]!.c, SHOPS.gardener!.keeper[0]!.r).dest!)).not.toBeNull();
  });
});

describe("his challenge intro (Nov 4: Eric's design)", () => {
  const anims = ropeAnims({ mover: BOSS_PIG_INTRO, rope: INTRO_PIG_ROPE, table: INTRO_PIG_TABLE, bucket: INTRO_PIG_BUCKET_B, release: PIG_INTRO_RELEASE });
  const beats = introBeats(anims);
  const at = (s: IntroStep) => beats.find((b) => b.step === s)!.at;
  const T = ropeTimes(beats, anims);

  it("his own intro, across, seated: you both walk on straight to where you stand (the usual clear places), clear of the stools, and stay", () => {
    const ci = introOf("pig")!;
    expect(ci).toMatchObject({ custom: true, seated: true, layout: "across", line: "Saddle up, partner. The board's comin' to us." });
    const m = seatedMarks(marksOf(SHOP_PIG_LAYOUT, "across", SHOP_PIG_MARKS, marksFeel(null, CHALLENGE_FEEL, ci.clear))!);
    expect([m.boss.c, m.you.c]).toEqual([9.5 - CHALLENGE_FEEL.clear.boss, 9.5 + CHALLENGE_FEEL.clear.you]);
    expect([m.bossStool, m.youStool]).toEqual([{ c: 8.5, r: 10.5 }, { c: 10.5, r: 10.5 }]);
    // (Nobody hops or steps: no hop back at any time.)
    for (let t = 0; t < introLength(beats) + 1000; t += 50) expect([introAt(beats, anims, t).back, introAt(beats, anims, t).hop]).toEqual([0, 0]);
  });

  it("the beats in order, about 12 s from the marks to the wipe: the line, the spin, the throw, the catch, the drag, the landing, the cross throw, the haul, the stools, the brag, the swing", () => {
    expect(beats.map((b) => b.step)).toEqual(["face", "line", "spin", "throw", "catch", "drag", "land", "cross", "haul", "stools", "brag", "swing", "done"]);
    for (let i = 1; i < beats.length; i++) expect(beats[i]!.at, beats[i]!.step).toBe(beats[i - 1]!.end);
    for (const b of beats.slice(0, -1)) expect(b.end - b.at, b.step).toBeGreaterThan(0);
    const len = introLength(beats);
    expect(len).toBeGreaterThan(11_000);
    expect(len).toBeLessThan(13_000);
    // The art's timeline: the spin at 2.8 s, the loop on the bale at 4.4, the yank at 4.75, the bale in the middle at 6.45, the buckets
    // in at about 9.1 (within a beat).
    expect(at("spin")).toBe(2800);
    expect(T.arrive).toBe(4400);
    expect(at("drag")).toBe(4750);
    expect(at("land")).toBe(6450);
    expect(Math.abs(T.land - 9100)).toBeLessThan(150);
    // The attack swung last, `swingMs` before the storm covers.
    expect(introLength(beats) - at("swing")).toBe(CHALLENGE_FEEL.swingMs - CHALLENGE_FEEL.stormInMs);
  });

  it("the corner board is the room's until the yank; from then the bale, dragged along its curve, and lands where the table stands", () => {
    expect(ropeAt(beats, anims, at("drag") - 1).bale).toBeNull();
    expect(ropeAt(beats, anims, at("drag")).bale).toMatchObject({ u: 0 });
    expect(introAt(beats, anims, at("drag")).rope?.bale).not.toBeNull();
    // Sliding, it moves on (never back), eased in and out.
    let last = -1;
    for (let t = T.slide; t < at("land"); t += 40) {
      const u = ropeAt(beats, anims, t).bale!.u;
      expect(u).toBeGreaterThanOrEqual(last);
      last = u;
    }
    const landed = ropeAt(beats, anims, at("land"));
    expect(landed.bale).toMatchObject({ u: 1, anim: "land" });
    expect(introAt(beats, anims, at("land") - 1).table).toBe(false);
    expect(introAt(beats, anims, at("land")).table).toBe(true);
    // (To the end, it stays.)
    expect(ropeAt(beats, anims, introLength(beats) + 5000).bale).toMatchObject({ u: 1 });
    // The bale is the stand's: the table's geometry (the park table's: 111 x 50, foot [55, 44]), its foot the stand's foot.
    expect([INTRO_PIG_TABLE.w, INTRO_PIG_TABLE.h, ...INTRO_PIG_TABLE.foot]).toEqual([PARK_TABLE.w, PARK_TABLE.h, ...PARK_TABLE.foot]);
    expect(SHOP_PIG_PIECES["board-stand"]!.foot).toEqual([18, 44]);
    expect(INTRO_PIG_TABLE_LIFT.slide!.length).toBe(INTRO_PIG_TABLE.anims.slide!.frames.length);
  });

  it("the buckets tumble in on the double yank's first heave and land upside down where the stools stand; they stay", () => {
    expect(ropeAt(beats, anims, T.tumble - 1).buckets).toBeNull();
    expect(ropeAt(beats, anims, T.tumble)).toMatchObject({ buckets: { u: 0, anim: "tumble" }, tied: true });
    expect(T.tumble).toBe(at("haul") + BOSS_PIG_INTRO.anims.doubleYank!.frames[0]!.ms);
    expect(ropeAt(beats, anims, T.land).buckets).toMatchObject({ u: 1, anim: "drop" });
    expect(introAt(beats, anims, T.land - 1).stools).toBe(false);
    expect(introAt(beats, anims, T.land).stools).toBe(true);
    expect(ropeAt(beats, anims, at("brag")).buckets).toMatchObject({ u: 1, anim: "stool" });
    // Untied once landed, the ropes reeled in before his brag.
    expect(ropeAt(beats, anims, T.untie).tied).toBe(false);
    expect(T.untie + CHALLENGE_FEEL.rope.reelMs).toBeLessThanOrEqual(at("brag"));
    expect(ropeAt(beats, anims, at("brag"))).toMatchObject({ out: -1, reel2: -1, lasso: null, reel: -1 });
    // (The black one his, from our left; the white one yours.)
    expect([INTRO_PIG_BUCKET_B.id, INTRO_PIG_BUCKET_W.id]).toEqual(["intro-pig-bucket-b", "intro-pig-bucket-w"]);
    for (const k of ["b:tumble", "b:land", "w:tumble", "w:land"]) expect(INTRO_PIG_BUCKET_HANDLE[k]!.length, k).toBeGreaterThan(0);
  });

  it("the lasso: released on the throw's release frame, on the bale through the drag, free and reeled in before the cross throw", () => {
    expect(ropeAt(beats, anims, T.release)).toMatchObject({ lasso: { anim: "fly" } });
    expect(ropeAt(beats, anims, T.arrive)).toMatchObject({ lasso: { anim: "catch" } });
    expect(ropeAt(beats, anims, at("drag") + 500)).toMatchObject({ lasso: { anim: "cinched" }, move: { anim: "yank" } });
    expect(ropeAt(beats, anims, T.free)).toMatchObject({ lasso: { anim: "free" } });
    expect(T.freed + CHALLENGE_FEEL.rope.reelMs).toBeLessThanOrEqual(at("cross"));
    expect(ropeAt(beats, anims, at("cross"))).toMatchObject({ lasso: null, reel: -1, move: { anim: "crossThrow" } });
    // His fists hold the ropes where his art says, from each release on.
    expect(PIG_INTRO_HANDS.throw![PIG_INTRO_RELEASE.throw]).not.toBeNull();
    expect(PIG_INTRO_HANDS.crossThrow![PIG_INTRO_RELEASE.crossThrow]).not.toBeNull();
    expect(PIG_INTRO_HANDS2.crossThrow![PIG_INTRO_RELEASE.crossThrow]).not.toBeNull();
    for (const a of ["fly", "catch", "cinched", "free"]) expect(INTRO_PIG_ROPE_KNOT[a]!.length, a).toBe(INTRO_PIG_ROPE.anims[a]!.frames.length);
    // (His moves are drawn in his own frame: his town figure's.)
    expect([BOSS_PIG_INTRO.w, BOSS_PIG_INTRO.h, ...BOSS_PIG_INTRO.foot]).toEqual([BOSS_ART.pig.w, BOSS_ART.pig.h, ...BOSS_ART.pig.foot]);
    expect(BOSS_ART.pig).toBe(PIG);
  });

  it("every cue a sound of his own, in order; the wipe's own cues (the spurs' jingle, a cap's pop) too", () => {
    const ci = introOf("pig")!;
    const cues = introCues(beats, anims);
    for (let i = 1; i < cues.length; i++) expect(cues[i]!.at).toBeGreaterThanOrEqual(cues[i - 1]!.at);
    for (const c of cues) expect(ci.cues[c.cue], c.cue).toMatch(/^pig[A-Z]\w+$/);
    const names = new Set(cues.map((c) => c.cue));
    for (const n of ["whirl", "throw", "catch", "snap", "yank", "slide", "thunk", "flick", "windup", "clatter", "tip", "laugh", "snort", "stomp"]) expect(names.has(n), n).toBe(true);
    // (Two throws at once in the cross throw: two whooshes a hair apart.)
    expect(cues.filter((c) => c.cue === "throw" && c.at >= at("cross") && c.at < at("haul"))).toHaveLength(2);
    // Every cue his art's frames carry, his, its props' and his wipe's, has its sound.
    const all = new Set<string>();
    for (const ch of [BOSS_PIG_INTRO, INTRO_PIG_ROPE, INTRO_PIG_TABLE, INTRO_PIG_BUCKET_B, INTRO_PIG_BUCKET_W, INTRO_PIG_STORM, INTRO_PIG_FRONT] as Character[])
      for (const a of Object.values(ch.anims)) for (const f of a!.frames) if (f.cue) all.add(f.cue);
    for (const c of all) expect(ci.cues[c], c).toMatch(/^pig[A-Z]\w+$/);
    expect(ci.cues.jingle).toBe("pigJingle");
    expect(ci.cues.pop).toBe("pigPop");
  });

  it("his props are drawn: every frame of the bale, the loop and the buckets has pixels", () => {
    for (const ch of [INTRO_PIG_TABLE, INTRO_PIG_ROPE, INTRO_PIG_BUCKET_B, INTRO_PIG_BUCKET_W] as Character[])
      for (const [a, an] of Object.entries(ch.anims))
        an!.frames.forEach((fr, i) => {
          const d = renderFrame(ch, fr).data;
          let n = 0;
          for (let j = 3; j < d.length; j += 4) if (d[j]! > 0) n++;
          expect(n, `${ch.id} ${a} ${i}`).toBeGreaterThan(20);
        });
    expect(TOWN_FEEL.bossScale.pig).toBe(0.7);
  });
});
