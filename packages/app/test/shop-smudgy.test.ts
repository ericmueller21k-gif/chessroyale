import { afterEach, describe, expect, it, vi } from "vitest";
import { BOSS_CRATES, adminFirst, bossCrateOf, bossDef, itemDef } from "@chessroyale/core";
import { KNIGHT_TURN, LIFE_CLASS, PAINTERS, PAINTER_LOOP, SHOP_SMUDGY_CRATE_AT, SHOP_SMUDGY_LAYOUT, SHOP_SMUDGY_MARKS, SHOP_SMUDGY_PIECES, SHOP_SMUDGY_TABLE_AT, painterPose, stageOf } from "../src/town/shops/smudgy-art.ts";
import { INTRO_SMUDGY_CLOTH, INTRO_SMUDGY_TABLE, WHIP_BOARD_FRAME } from "../src/town/shops/smudgy-intro-art.ts";
import { sidekickSmudgyKeeper } from "../src/characters/sidekicks/smudgykeeper.ts";
import { SMUDGY_LINES } from "../src/characters/smudgy.ts";
import { SMUDGY_SOUNDS, smudgySound } from "../src/characters/smudgy-sounds.ts";
import { findPath, inTalkRange, isFloor, makeRoom, tapTarget, walkable } from "../src/town/shops/room.ts";
import { SHOPS, holdLine, priceLine, prizeRows } from "../src/town/shops/shops.ts";
import { CHALLENGE_FEEL, chantOf, clothAnims, hopStart, introAt, introBeats, introCues, introLength, introOf, marksOf, seatedMarks, type IntroStep } from "../src/town/shops/challenge.ts";
import { splatTimes, strokeAt } from "../src/town/shops/smudgy-splatter.ts";
import { SIDEKICK_SHEETS } from "../src/town/sidekick-sheets.ts";
import { ADMIN_BOTS, BOTS, TOWN_BOTS, isSprite } from "../src/town/world.ts";
import { renderFrame } from "../src/characters/sprite.ts";

/**
 * Smudgy's studio and his challenge intro (Nov 6; docs/decisions/2026-11-06-smudgy-home.md): the room (the drop cloth and its marks,
 * the covered table, the counter and the gallery owner, the life class), his crate with the Brush Ride; his intro's beats (the line,
 * the cloth whipped off, the reveal line), its cues; and the splatter into the match.
 */
const def = SHOPS.smudgy!;
const room = makeRoom(SHOP_SMUDGY_LAYOUT, def.keeper);

describe("Smudgy's studio", () => {
  it("is a box room: you come in at the doorway and can walk to every square that isn't solid", () => {
    expect(room.floor).toBeNull();
    expect(SHOP_SMUDGY_LAYOUT.find((p) => p.name === "entrance")).toMatchObject({ col: 9, row: 19, exit: true });
    expect(walkable(room, room.start.c, room.start.r)).toBe(true);
    let blocked = 0;
    for (let r = 1; r < 19; r++)
      for (let c = 1; c < 19; c++) {
        if (!walkable(room, c, r)) {
          blocked++;
          continue;
        }
        expect(findPath(room, room.start, { c, r }), `${c},${r}`).not.toBeNull();
      }
    // (Solid: the counter, the platform, the eight painters, the table, the sculptures, easels, canvases, pots and jars; the keeper's squares.)
    expect(blocked).toBeGreaterThan(25);
    expect(SHOP_SMUDGY_LAYOUT.filter((p) => isFloor(p.name))).toHaveLength(400);
    for (const p of SHOP_SMUDGY_LAYOUT) expect(SHOP_SMUDGY_PIECES[p.name], p.name).toBeDefined();
  });

  it("the drop cloth (columns 6-13, rows 13-15) is its battle spot: 24 flat `circle-` tiles; the covered table stands on it between the marks, solid, and the rest is free to walk", () => {
    const tarp = SHOP_SMUDGY_LAYOUT.filter((p) => p.name.startsWith("circle-"));
    expect(tarp).toHaveLength(24);
    for (const p of tarp) {
      expect(isFloor(p.name), p.name).toBe(true);
      expect(p.name).toBe(`circle-${p.col}-${p.row}`);
      expect(p.col >= 6 && p.col <= 13 && p.row >= 13 && p.row <= 15, p.name).toBe(true);
      expect(walkable(room, p.col, p.row), p.name).toBe(!(p.row === 14 && (p.col === 9 || p.col === 10)));
    }
    expect(SHOP_SMUDGY_LAYOUT.find((p) => p.name === "table")).toMatchObject({ col: 9, row: 14, w: 2, solid: true });
    // (Its picture is the intro's table under the cloth: the same size and feet.)
    expect([SHOP_SMUDGY_PIECES.table!.w, ...SHOP_SMUDGY_PIECES.table!.foot]).toEqual([INTRO_SMUDGY_TABLE.w, ...INTRO_SMUDGY_TABLE.foot]);
  });

  it("the marks: Smudgy's (west) and yours (east) on the cloth's middle line, the table halfway; seated, you both walk on straight to them (his clear place a hair outside his)", () => {
    const m = marksOf(SHOP_SMUDGY_LAYOUT, "across", SHOP_SMUDGY_MARKS)!;
    expect([m.boss, m.you, m.table]).toEqual([{ c: 7, r: 14 }, { c: 12, r: 14 }, SHOP_SMUDGY_TABLE_AT]);
    const s = seatedMarks(m);
    expect(s.you).toEqual({ c: 12, r: 14 });
    expect(s.boss.c).toBeCloseTo(9.5 - CHALLENGE_FEEL.clear.boss);
    // Both walk on: their squares are free, and reachable from the door.
    for (const q of [s.youSq, s.bossSq]) expect(findPath(room, room.start, q), `${q.c},${q.r}`).not.toBeNull();
  });

  it("the counter at the back and the gallery owner behind its middle; its squares behind it; no name, the night tone; you talk to it from in front", () => {
    expect(def).toMatchObject({ home: "smudgy", boss: "Smudgy", crate: "Smudgy's Boss Crate", kid: "smudgykeeper", at: [9.5, 2.4], keeper: [{ c: 9, r: 2 }, { c: 10, r: 2 }], roof: "studio", chatTone: "night" });
    const counter = SHOP_SMUDGY_LAYOUT.find((p) => p.name === "counter")!;
    expect(counter).toMatchObject({ col: 8, row: 3, w: 4, solid: true });
    expect(def.at[0]).toBe(counter.col + (counter.w! - 1) / 2);
    expect(SHOP_SMUDGY_PIECES.counter!.foot[1] - SHOP_SMUDGY_CRATE_AT[1]).toBeLessThan(20);
    const there = tapTarget(room, room.start, def.keeper[0]!.c, def.keeper[0]!.r);
    expect(there.kind).toBe("keeper");
    expect(inTalkRange(room, there.dest!.c, there.dest!.r)).toBe(true);
  });

  it("the gallery owner's sheet is baked (Dabble's rig: 64 x 64; idle 24, walk 6, sit 16, wave 12) and it isn't a town bot: Dabble stays Smudgy's kid", () => {
    const s = SIDEKICK_SHEETS.smudgykeeper;
    expect(s.id).toBe("sidekick-smudgy-keeper");
    expect([s.w, s.h]).toEqual([64, 64]);
    expect([s.ms.idle.length, s.ms.walk.length, s.ms.sit.length, s.ms.wave.length]).toEqual([24, 6, 16, 12]);
    for (const b of [...BOTS, ...ADMIN_BOTS, ...TOWN_BOTS]) if (isSprite(b.look)) expect(b.look.sprite.id, b.name).not.toBe("sidekick-smudgy-keeper");
    expect(BOTS.find((b) => b.boss === "smudgy")).toMatchObject({ name: "Dabble", look: { sprite: SIDEKICK_SHEETS.smudgy } });
    // (Its smock and glasses on every frame.)
    for (const a of ["idle", "walk", "sit", "wave"]) for (const f of sidekickSmudgyKeeper.anims[a]!.frames) expect(f.layers.map((l) => l.part)).toEqual(expect.arrayContaining(["smock", "glasses"]));
  });
});

describe("the life class", () => {
  it("the knight turns on its platform in the middle of the back half (16 frames, 6 s a turn); eight painters in a ring round it, each facing it", () => {
    const pl = SHOP_SMUDGY_LAYOUT.find((p) => p.name === "platform")!;
    expect(pl).toMatchObject({ col: 9, row: 8, w: 2, solid: true });
    expect(pl.col + 0.5).toBe(LIFE_CLASS.c);
    expect(SHOP_SMUDGY_PIECES.platform!.anims.idle!.frames).toHaveLength(KNIGHT_TURN.frames);
    expect(KNIGHT_TURN.frames * KNIGHT_TURN.ms).toBe(6000);
    const ps = SHOP_SMUDGY_LAYOUT.filter((p) => p.name.startsWith("painter-"));
    expect(ps).toHaveLength(8);
    for (const p of ps) {
      const d = Math.hypot(p.col - LIFE_CLASS.c, p.row - LIFE_CLASS.r);
      expect(d, p.name).toBeGreaterThan(2.5);
      expect(d, p.name).toBeLessThan(5);
      // (Drawn facing east: the west side's as drawn, the east side's mirrored.)
      expect(!!p.flip, `${p.col},${p.row}`).toBe(p.col > LIFE_CLASS.c);
    }
    // Every quarter of the ring has its painters.
    expect(new Set(ps.map((p) => `${p.col < LIFE_CLASS.c}${p.row < LIFE_CLASS.r}`)).size).toBe(4);
  });

  it("their loops are offset: three colors' frames shared by all eight, each starting an eighth of the loop after the last; never two alike at once", () => {
    const ps = SHOP_SMUDGY_LAYOUT.filter((p) => p.name.startsWith("painter-"));
    expect(new Set(ps.map((p) => p.name)).size).toBeLessThanOrEqual(4);
    const loop = PAINTER_LOOP.frames * PAINTER_LOOP.ms;
    const t0s = ps.map((p) => p.t0 ?? 0).sort((a, b) => a - b);
    expect(t0s).toEqual([0, 1, 2, 3, 4, 5, 6, 7].map((i) => (i * loop) / 8));
    for (const name of new Set(ps.map((p) => p.name))) expect(SHOP_SMUDGY_PIECES[name]!.anims.idle!.frames, name).toHaveLength(PAINTER_LOOP.frames);
    expect(PAINTERS).toHaveLength(8);
  });

  it("each loop: the canvas goes blank, outline, blocked colors, finished; painting then a dip of the brush in every stage", () => {
    expect(Array.from({ length: PAINTER_LOOP.frames }, (_, f) => stageOf(f))).toEqual([0, 1, 2, 3].flatMap((s) => Array(PAINTER_LOOP.stage).fill(s)));
    for (let s = 0; s < 4; s++) {
      const dips = Array.from({ length: PAINTER_LOOP.stage }, (_, i) => painterPose(s * PAINTER_LOOP.stage + i).dip);
      expect(dips.filter(Boolean)).toHaveLength(PAINTER_LOOP.stage - PAINTER_LOOP.dip);
      expect(dips.indexOf(true)).toBe(PAINTER_LOOP.dip);
    }
    // (The canvas changes between stages: its pixels differ.)
    const P = SHOP_SMUDGY_PIECES["painter-a"]!;
    const px = (f: number) => renderFrame(P, P.anims.idle!.frames[f]!).data.join(",");
    expect(new Set([0, 8, 16, 24].map(px)).size).toBe(4);
  });
});

describe("Smudgy's Boss Crate and the Brush Ride", () => {
  it("in BOSS_CRATES with his ride, the Brush Ride, first; sold to everyone (Smudgy is live); its words as the others'", () => {
    const crate = bossCrateOf("smudgy")!;
    expect(BOSS_CRATES.at(-1)).toBe(crate);
    expect([crate.id, crate.name, crate.ride]).toEqual(["boss-smudgy", "Smudgy's Boss Crate", "smudgy-brush"]);
    expect(crate.items).toContain("smudgy-brush");
    expect(adminFirst(bossDef("smudgy")!)).toBe(false);
    expect(itemDef("smudgy-brush")).toMatchObject({ name: "Brush Ride", tier: "mythic", slot: "ride" });
    expect(def.prizes).toEqual(["smudgy-brush"]);
    expect(priceLine(def)).toBe("3 Smudgy tokens, or 1 Smudgy token + 1 crate key");
    expect(holdLine(def, { tokens: 1, keys: 0 })).toBe("You have 1 Smudgy token and 0 crate keys.");
    expect(prizeRows(def)[0]).toMatchObject({ id: "smudgy-brush", name: "Brush Ride", kind: "Mythic ride" });
    expect(SHOP_SMUDGY_PIECES.crate!.anims.idle!.frames.length).toBeGreaterThan(1);
  });
});

describe("his challenge intro (Nov 6: the cloth)", () => {
  const anims = clothAnims({ cloth: INTRO_SMUDGY_CLOTH, boardFrame: WHIP_BOARD_FRAME });
  const beats = introBeats(anims);
  const at = (s: IntroStep) => beats.find((b) => b.step === s)!.at;
  const K = CHALLENGE_FEEL.smudgy;
  const whip = anims.whip.reduce((a, b) => a + b, 0);

  it("its own, across, seated (the stools are there already: you both walk straight to your marks); his line his entrance's first; the reveal line Eric's; no attack", () => {
    const ci = introOf("smudgy")!;
    expect(ci).toMatchObject({ custom: true, layout: "across", seated: true, line: SMUDGY_LINES.entrance![0] });
    expect(chantOf(ci)).toBe("Careful, don't get any paint on the pieces!");
    expect(hopStart(beats, anims)).toBe(Infinity);
    expect(beats.some((b) => b.step === "swing")).toBe(false);
  });

  it("the beats in order, each from where the last ended: face, the line, a pause, the whip, the reveal; then done (the splatter)", () => {
    expect(beats.map((b) => b.step)).toEqual(["face", "line", "pause", "whip", "reveal", "done"]);
    for (let i = 1; i < beats.length; i++) expect(beats[i]!.at).toBe(beats[i - 1]!.end);
    expect(at("whip")).toBe(CHALLENGE_FEEL.faceMs + K.lineMs + K.grabMs);
    expect(introLength(beats)).toBe(at("whip") + whip + K.revealLeadMs + K.revealMs + K.afterMs);
  });

  it("the cloth before the board, the board before the reveal line: covered, whipped off (the board showing once it's off the top), in its heap to the end", () => {
    const now = (t: number) => introAt(beats, anims, t);
    expect(now(0).cloth).toEqual({ anim: "covered", frame: 0 });
    expect(now(at("whip") - 1)).toMatchObject({ cloth: { anim: "covered" }, table: false, line: false });
    expect(now(at("line") + 10)).toMatchObject({ line: true, chant: false });
    expect(now(at("whip") + 1)).toMatchObject({ cloth: { anim: "whip", frame: 0 }, table: false });
    const off = at("whip") + anims.whip.slice(0, WHIP_BOARD_FRAME).reduce((a, b) => a + b, 0);
    expect(now(off)).toMatchObject({ cloth: { anim: "whip", frame: WHIP_BOARD_FRAME }, table: true });
    expect(now(at("whip") + whip)).toMatchObject({ cloth: { anim: "heap" }, table: true });
    // The reveal line after the cloth is down, for its time, gone before the splatter.
    const r = at("reveal") + K.revealLeadMs;
    expect(r).toBeGreaterThan(at("whip") + whip - 1);
    expect(now(r - 1).chant).toBe(false);
    expect(now(r + 1).chant).toBe(true);
    expect(now(r + K.revealMs + 1).chant).toBe(false);
    expect(now(introLength(beats) + 5000)).toMatchObject({ cloth: { anim: "heap" }, table: true, chant: false });
  });

  it("every cue a sound of his own: the whoosh as it lifts, the flop as it lands; the splatter's splat and swipe; every sound in his pack and finite", () => {
    const cues = introCues(beats, anims);
    expect(cues.map((c) => c.cue)).toEqual(["whoosh", "flop"]);
    expect(cues[0]!.at).toBe(at("whip"));
    expect(cues[1]!.at).toBeLessThan(at("reveal"));
    const def = introOf("smudgy")!;
    for (const c of [...cues.map((c) => c.cue), "splat", "swipe"]) expect(def.cues[c], c).toMatch(/^smudgy[A-Z]/);
    for (const n of ["whoosh", "flop", "splat", "swipe"] as const) {
      expect(SMUDGY_SOUNDS).toContain(n);
      const s = smudgySound(n, 24000);
      expect(s.length).toBeGreaterThan(1000);
      expect(s.every(Number.isFinite)).toBe(true);
      expect(Math.max(...s.map(Math.abs))).toBeGreaterThan(0.01);
    }
  });

  it("its props are drawn: the table, the cloth covered, every whip frame, the heap", () => {
    const has = (ch: typeof INTRO_SMUDGY_CLOTH, a: string, i: number) => renderFrame(ch, ch.anims[a]!.frames[i]!).data.some((v, k) => k % 4 === 3 && v > 0);
    expect(has(INTRO_SMUDGY_TABLE, "idle", 0)).toBe(true);
    expect(has(INTRO_SMUDGY_CLOTH, "covered", 0)).toBe(true);
    expect(has(INTRO_SMUDGY_CLOTH, "heap", 0)).toBe(true);
    INTRO_SMUDGY_CLOTH.anims.whip!.frames.forEach((_, i) => expect(has(INTRO_SMUDGY_CLOTH, "whip", i), `whip ${i}`).toBe(true));
  });
});

describe("the splatter into the match", () => {
  const S = CHALLENGE_FEEL.smudgy.splat;
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("splats land faster and faster until the cover (about 1.2 s); the brush stroke sweeps across in about 0.5 s", () => {
    const t = splatTimes();
    expect(t[0]).toBe(0);
    expect(t.at(-1)!).toBeLessThan(S.coverMs);
    const gaps = t.slice(1).map((x, i) => x - t[i]!);
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]!).toBeLessThanOrEqual(gaps[i - 1]! + 1e-9);
    expect(gaps[0]).toBeCloseTo(S.firstGapMs, 0);
    expect(t.length).toBeGreaterThan(20);
    expect(S.coverMs).toBe(1200);
    expect(S.wipeMs).toBe(500);
    expect([strokeAt(0), strokeAt(S.wipeMs / 2), strokeAt(S.wipeMs), strokeAt(S.wipeMs * 3)]).toEqual([0, 0.5, 1, 1]);
  });

  it("it always ends in the match, by the clock: covered at its time (even with no canvas to draw on), held its beat, wiped, then gone", async () => {
    vi.useFakeTimers();
    const made: { className: string; dataset: Record<string, string>; removed: boolean }[] = [];
    const el = () => {
      const e = { className: "", dataset: {} as Record<string, string>, style: { cssText: "" }, removed: false, width: 0, height: 0, setAttribute: () => {}, getContext: () => null, remove() { e.removed = true; } };
      made.push(e);
      return e;
    };
    vi.stubGlobal("document", { createElement: el, body: { append: () => {} } });
    vi.stubGlobal("innerWidth", 390);
    vi.stubGlobal("innerHeight", 664);
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const { startSplatter } = await import("../src/town/shops/smudgy-splatter.ts");
    const intro = { home: "smudgy", def: { cues: {} } } as unknown as Parameters<typeof startSplatter>[0];
    const s = startSplatter(intro);
    const cv = made[0]!;
    expect(cv.className).toBe("boss-splatter");
    expect(cv.dataset.phase).toBe("in");
    let covered = false;
    void s.covered.then(() => (covered = true));
    await vi.advanceTimersByTimeAsync(S.coverMs + 1);
    expect(covered).toBe(true);
    expect(cv.dataset.covered).toBe("1");
    let gone = false;
    void s.out().then(() => (gone = true));
    await vi.advanceTimersByTimeAsync(S.holdMinMs + 1);
    expect(cv.dataset.phase).toBe("out");
    await vi.advanceTimersByTimeAsync(S.wipeMs + 1);
    expect(gone).toBe(true);
    expect(cv.removed).toBe(true);
  });
});
