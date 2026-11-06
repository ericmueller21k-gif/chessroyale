import { afterEach, describe, expect, it, vi } from "vitest";
import { BOSS_CRATES, adminFirst, bossCrateOf, bossDef, itemDef } from "@chessroyale/core";
import { SHOP_FOLIO_CRATE_AT, SHOP_FOLIO_LAYOUT, SHOP_FOLIO_LIGHTS, SHOP_FOLIO_MARKS, SHOP_FOLIO_PIECES, SHOP_FOLIO_POOLS } from "../src/town/shops/folio-art.ts";
import {
  INTRO_FOLIO_BOARD,
  INTRO_FOLIO_PLANE,
  INTRO_FOLIO_PLANE_ROUTE,
  INTRO_FOLIO_SHEETS,
  INTRO_FOLIO_STOOL,
  INTRO_FOLIO_STOOLS_AT,
  INTRO_FOLIO_TABLE,
  INTRO_FOLIO_TABLE_AT,
} from "../src/town/shops/folio-intro-art.ts";
import { BOSS_FOLIO_INTRO } from "../src/characters/folio-intro.ts";
import { FOLIO } from "../src/characters/folio.ts";
import { FOLIO_SOUNDS } from "../src/characters/folio-sounds.ts";
import { driftAt, findPath, inTalkRange, isFloor, lightsAt, litDx, makeRoom, tapTarget, walkable } from "../src/town/shops/room.ts";
import { SHOPS, holdLine, priceLine, prizeRows } from "../src/town/shops/shops.ts";
import { CHALLENGE_FEEL, chantOf, folioAnims, folioAt, folioTimes, introAt, introBeats, introCues, introLength, introOf, marksFeel, marksOf, type IntroStep } from "../src/town/shops/challenge.ts";
import { CRUMPLE_DEFAULTS, crumpleBeat, crumplePoint, fillMesh, meshBuf, meshSize } from "../src/town/shops/crumple.ts";
import { SIDEKICK_SHEETS } from "../src/town/sidekick-sheets.ts";
import { ADMIN_BOTS, BOTS, TOWN_BOTS, isSprite } from "../src/town/world.ts";
import { TOWN_FEEL } from "../src/town/feel.ts";
import { PAWN_PATH } from "../src/town/render.ts";
import { renderFrame, type Character } from "../src/characters/sprite.ts";

/**
 * Folio's sanctuary and its challenge intro (Nov 5; docs/decisions/2026-11-05-folio-home.md): the art's room in the game (the clean page,
 * the windows' drifting pools, the counter and the paper turtle), its crate with the Paper Crane; its intro's beats (the step back, the
 * stools then the table folding, the plane, the board unfolding, the bow and the quiet line), its cues; and the crumple's mesh, its clock
 * and its fallback.
 */
const def = SHOPS.folio!;
const room = makeRoom(SHOP_FOLIO_LAYOUT, def.keeper);
const SQ = 37;

describe("Folio's sanctuary", () => {
  it("is a box room (no floor's shape): you come in at the doorway and can walk to every square that isn't solid", () => {
    expect(room.floor).toBeNull();
    expect(SHOP_FOLIO_LAYOUT.find((p) => p.name === "entrance")).toMatchObject({ col: 9, row: 19, exit: true });
    const from = room.start;
    expect(walkable(room, from.c, from.r)).toBe(true);
    let blocked = 0;
    for (let r = 1; r < 19; r++)
      for (let c = 1; c < 19; c++) {
        if (!walkable(room, c, r)) {
          blocked++;
          continue;
        }
        expect(findPath(room, from, { c, r }), `${c},${r}`).not.toBeNull();
      }
    // (Solid: the counter, the desk, the fountain, the bonsai, the screens, the sketched pillars, lanterns and bench; the keeper's squares.)
    expect(blocked).toBeGreaterThan(15);
  });

  it("the clean page (columns 7-12, rows 8-13) is its battle spot: 36 flat `page-` tiles, every one free to walk; the drifting `pages` stand up", () => {
    const page = SHOP_FOLIO_LAYOUT.filter((p) => p.name.startsWith("page-"));
    expect(page).toHaveLength(36);
    for (const p of page) {
      expect(isFloor(p.name), p.name).toBe(true);
      expect(p.name).toBe(`page-${p.col}-${p.row}`);
      expect(p.col >= 7 && p.col <= 12 && p.row >= 8 && p.row <= 13, p.name).toBe(true);
      expect(walkable(room, p.col, p.row), p.name).toBe(true);
    }
    expect(isFloor("pages")).toBe(false);
    expect(SHOP_FOLIO_LAYOUT.find((p) => p.name === "pages")).toMatchObject({ col: 17, row: 2, solid: false });
    // Every square has its floor tile (the page's, folded, sketched or ruled), and no other room's tile names are `page-`.
    expect(SHOP_FOLIO_LAYOUT.filter((p) => isFloor(p.name))).toHaveLength(400);
    for (const p of SHOP_FOLIO_LAYOUT) if (isFloor(p.name)) expect(SHOP_FOLIO_PIECES[p.name], p.name).toBeDefined();
  });

  it("the clean page's marks: Folio's (west) and yours (east) on its middle line, the table halfway, as the page alone would put them", () => {
    const m = marksOf(SHOP_FOLIO_LAYOUT, "across", SHOP_FOLIO_MARKS)!;
    expect([m.boss, m.you, m.table]).toEqual([{ c: 8, r: 10.5 }, { c: 11, r: 10.5 }, { c: 9.5, r: 10.5 }]);
    // (Its page is its battle circle: without the drawn marks the table lands on the page's middle too.)
    expect(marksOf(SHOP_FOLIO_LAYOUT, "across")!.table).toEqual({ c: 9.5, r: 10.5 });
    expect([INTRO_FOLIO_TABLE_AT, ...INTRO_FOLIO_STOOLS_AT]).toEqual([[m.table.c, m.table.r], [m.bossStool.c, m.bossStool.r], [m.youStool.c, m.youStool.r]]);
  });

  it("lights at every placement: each window's panes light in their own colors wherever it stands (four on each side wall, the east mirrored), and the moon window", () => {
    const ups = SHOP_FOLIO_LAYOUT.filter((p) => !isFloor(p.name));
    const wins = ups.filter((p) => p.name === "window" || p.name === "window-b");
    expect(wins).toHaveLength(8);
    expect(wins.filter((p) => p.flip)).toHaveLength(4);
    const lit = lightsAt(SHOP_FOLIO_LIGHTS, ups);
    for (const w of wins) expect(lit.filter((x) => x.at === w).length, `${w.name} at ${w.col},${w.row}`).toBe(3);
    expect(lit.filter((x) => x.at.name === "backdrop")).toHaveLength(1);
    // (A flipped window's light sits mirrored about its foot.)
    const l = SHOP_FOLIO_LIGHTS.find((x) => x.piece === "window")!;
    const foot = SHOP_FOLIO_PIECES.window!.foot[0];
    expect(litDx(l.x, foot, true)).toBe(-litDx(l.x, foot, false));
  });

  it("the windows' pools: three a window, each drifting on one slow sine (dx, dy either way over 40 s), mirrored with a mirrored window; the moon's still", () => {
    const ups = SHOP_FOLIO_LAYOUT.filter((p) => !isFloor(p.name));
    const pools = lightsAt(SHOP_FOLIO_POOLS, ups);
    expect(pools.filter((x) => x.at.name.startsWith("window"))).toHaveLength(24);
    const out = { x: 0, y: 0 };
    for (const { l, at } of pools) {
      if (at.name === "backdrop") {
        expect(l.drift).toBeUndefined();
        expect(driftAt(l.drift, 12345, false, out)).toEqual({ x: 0, y: 0 });
        continue;
      }
      const d = l.drift!;
      expect(d.ms).toBe(40000);
      // Its swing: never past dx, dy; at a quarter of its loop (from its phase) at its furthest, half a loop on back the other way.
      let mx = 0;
      for (let t = 0; t < d.ms; t += 500) mx = Math.max(mx, Math.abs(driftAt(d, t, !!at.flip, out).x));
      expect(mx).toBeLessThanOrEqual(d.dx + 1e-9);
      const q = (0.25 - d.phase) * d.ms;
      expect(driftAt(d, q, false, out).x).toBeCloseTo(d.dx, 6);
      expect(driftAt(d, q, false, out).y).toBeCloseTo(d.dy, 6);
      expect(driftAt(d, q + d.ms / 2, false, out).x).toBeCloseTo(-d.dx, 6);
      expect(driftAt(d, q, true, out).x).toBeCloseTo(-d.dx, 6);
    }
  });
});

describe("the paper turtle keeps the shop", () => {
  it("its sheet is baked (64 x 64, feet at 33, 59; idle 12, walk 8, sit 10, wave 10)", () => {
    const s = SIDEKICK_SHEETS.folioturtle;
    expect(s.id).toBe("sidekick-folio-turtle");
    expect([s.w, s.h, ...s.foot]).toEqual([64, 64, 33, 59]);
    expect([s.ms.idle.length, s.ms.walk.length, s.ms.sit.length, s.ms.wave.length]).toEqual([12, 8, 10, 10]);
  });

  it("it isn't a town bot: Pleat, the frog, stays Folio's kid in the town", () => {
    for (const b of [...BOTS, ...ADMIN_BOTS, ...TOWN_BOTS]) if (isSprite(b.look)) expect(b.look.sprite.id, b.name).not.toBe("sidekick-folio-turtle");
    expect(BOTS.find((b) => b.boss === "folio")).toMatchObject({ name: "Pleat", look: { sprite: SIDEKICK_SHEETS.folio } });
  });

  it("stands behind the low counter's middle at the art's keeper spot; its squares behind it; no name, the day tone; you talk to it from in front", () => {
    expect(def).toMatchObject({ home: "folio", boss: "Folio", crate: "Folio's Boss Crate", kid: "folioturtle", at: [9.5, 2.4], keeper: [{ c: 9, r: 2 }, { c: 10, r: 2 }], roof: "paper", chatTone: "day" });
    expect(def.lift).toBeUndefined();
    const counter = SHOP_FOLIO_LAYOUT.find((p) => p.name === "counter")!;
    expect(counter).toMatchObject({ col: 8, row: 3, w: 4, solid: true });
    expect(def.at[0]).toBe(counter.col + (counter.w! - 1) / 2);
    // (The counter is low, 19 px over its foot at its top: the turtle shows over it. The crate sits on its east end.)
    expect(SHOP_FOLIO_PIECES.counter!.foot[1] - SHOP_FOLIO_CRATE_AT[1]).toBeLessThan(20);
    expect(SHOP_FOLIO_CRATE_AT[0]).toBeGreaterThan(SHOP_FOLIO_PIECES.counter!.foot[0] + 30);
    const there = tapTarget(room, room.start, def.keeper[0]!.c, def.keeper[0]!.r);
    expect(there.kind).toBe("keeper");
    expect([4, 5]).toContain(there.dest!.r);
    expect(inTalkRange(room, there.dest!.c, there.dest!.r)).toBe(true);
  });
});

describe("Folio's Boss Crate and the Paper Crane", () => {
  it("in BOSS_CRATES with its ride, the Paper Crane, first; sold to everyone (Folio is live); its words as the others'", () => {
    const crate = bossCrateOf("folio")!;
    expect(BOSS_CRATES).toContain(crate);
    expect([crate.id, crate.name, crate.ride]).toEqual(["boss-folio", "Folio's Boss Crate", "folio-crane"]);
    expect(crate.items).toContain("folio-crane");
    expect(adminFirst(bossDef("folio")!)).toBe(false);
    expect(itemDef("folio-crane")).toMatchObject({ name: "Paper Crane", tier: "mythic", slot: "ride" });
    expect(def.prizes).toEqual(["folio-crane"]);
    expect(priceLine(def)).toBe("3 Folio tokens, or 1 Folio token + 1 crate key");
    expect(holdLine(def, { tokens: 1, keys: 0 })).toBe("You have 1 Folio token and 0 crate keys.");
    expect(prizeRows(def)[0]).toMatchObject({ id: "folio-crane", name: "Paper Crane", kind: "Mythic ride" });
  });
});

describe("its challenge intro (Nov 5: the art's timeline)", () => {
  const anims = folioAnims({ mover: BOSS_FOLIO_INTRO, stool: INTRO_FOLIO_STOOL, table: INTRO_FOLIO_TABLE, plane: INTRO_FOLIO_PLANE, board: INTRO_FOLIO_BOARD, route: INTRO_FOLIO_PLANE_ROUTE });
  const beats = introBeats(anims);
  const T = folioTimes(anims);
  const at = (s: IntroStep) => beats.find((b) => b.step === s)!.at;
  const F = CHALLENGE_FEEL.folio;
  const C = F.crumple;

  it("its own, across, not seated: you both walk on to the clean page's marks, then step back a pace (it to 2.3 from the table's middle, you to the usual 2.2)", () => {
    const ci = introOf("folio")!;
    expect(ci).toMatchObject({ custom: true, layout: "across", clear: 2.3, line: "Every game is a draft. Shall we write one?" });
    expect(ci.seated).toBeUndefined();
    const m = marksOf(SHOP_FOLIO_LAYOUT, "across", SHOP_FOLIO_MARKS, marksFeel(anims, CHALLENGE_FEEL, ci.clear))!;
    expect([m.boss.c, m.you.c, m.bossClear.c, m.youClear.c]).toEqual([8, 11, 7.2, 9.5 + CHALLENGE_FEEL.clear.you]);
    // The step back: none before its beat, all of it after (eased, no hop).
    expect(introAt(beats, anims, at("back") - 1)).toMatchObject({ back: 0, hop: 0 });
    expect(introAt(beats, anims, at("back") + F.backMs / 2).back).toBeCloseTo(0.5, 5);
    expect(introAt(beats, anims, at("back") + F.backMs + 1)).toMatchObject({ back: 1, hop: 0 });
    // (Folio glides as it steps back; stands in its idle on its mark and after.)
    expect(folioAt(anims, at("back") + 10).move.anim).toBe("glide");
    expect(folioAt(anims, at("line") + 10).move.anim).toBe("idle");
  });

  it("the beats in order, each from where the last ended: the line, the step back, the stools, the table, the plane, the unfold, the bow, the quiet line; about 11.1 s to the crumple, every one a feel number or the art's frames", () => {
    expect(beats.map((b) => b.step)).toEqual(["face", "line", "back", "stools", "fold", "plane", "unfold", "bow", "quiet", "done"]);
    for (let i = 1; i < beats.length; i++) expect(beats[i]!.at, beats[i]!.step).toBe(beats[i - 1]!.end);
    const sum = (ms: readonly number[]) => ms.reduce((a, b) => a + b, 0);
    expect(introLength(beats)).toBe(
      CHALLENGE_FEEL.faceMs + F.lineMs + F.backMs + F.stoolLeadMs + F.stoolGapMs + F.tableAfterMs + sum(anims.table) + F.planeAfterMs + INTRO_FOLIO_PLANE_ROUTE[3]!.ms + F.fallMs + F.unfoldLeadMs + sum(anims.unfold) + F.bowAfterMs + F.quietLeadMs + F.quietMs + F.crumpleAfterMs,
    );
    expect(introLength(beats)).toBeGreaterThan(10_600);
    expect(introLength(beats)).toBeLessThan(11_600);
    expect(T.crumple).toBe(introLength(beats));
    // (No God King attack: the crumple is its transition.)
    expect(beats.some((b) => b.step === "swing")).toBe(false);
  });

  it("about 14 to 16 s in all, as the art's 14.9: from just inside the door (the walk on to the marks), through the beats and the crumple, to the match", () => {
    const m = marksOf(SHOP_FOLIO_LAYOUT, "across", SHOP_FOLIO_MARKS)!;
    const steps = Math.max(findPath(room, room.start, m.youSq)!.length, findPath(room, { c: room.start.c - 1, r: room.start.r }, m.bossSq)!.length);
    const walk = CHALLENGE_FEEL.insideMs + steps * CHALLENGE_FEEL.walkStepMs + CHALLENGE_FEEL.settleMs;
    const crumple = C.crumpleMs + C.holdMs + C.openMs + C.lingerMs;
    const total = walk + introLength(beats) + crumple;
    expect(total).toBeGreaterThan(14_000);
    expect(total).toBeLessThan(16_000);
    // (From the marks to the match: the art's 13 s to its crumple less its 0.9 s walk-on, and its crumple.)
    expect(introLength(beats) + crumple).toBeGreaterThan(13_000);
  });

  it("the furniture folds: the west stool, then the east, then the table (each from its flat sheet, which lies there until then); the table stands before the plane", () => {
    const first = (pick: (z: ReturnType<typeof folioAt>) => string, from = 0) => {
      for (let t = from; t < T.crumple; t += 10) if (pick(folioAt(anims, t)) !== "sheet") return t;
      return Infinity;
    };
    const w = first((z) => z.stools[0].anim);
    const e = first((z) => z.stools[1].anim);
    const tb = first((z) => z.table.anim);
    expect(w).toBeGreaterThanOrEqual(at("back") + F.backMs);
    expect(e - w).toBeCloseTo(F.stoolGapMs, -1);
    expect(tb).toBeGreaterThan(e);
    expect(folioAt(anims, T.plane).table).toMatchObject({ anim: "idle" });
    expect(folioAt(anims, T.plane).stools.map((s) => s.anim)).toEqual(["idle", "idle"]);
    // Walking on and saying its line, all three sheets lie flat.
    expect(folioAt(anims, at("line")).stools.map((s) => s.anim)).toEqual(["sheet", "sheet"]);
    expect(introAt(beats, anims, at("line")).folio!.table.anim).toBe("sheet");
  });

  it("the plane comes in from the east, high, lets the board go over the table's middle and leaves to the north-west, off the room", () => {
    const r = INTRO_FOLIO_PLANE_ROUTE;
    expect(r[0]!.at[0]).toBeGreaterThan(17);
    expect(r.at(-1)!.at[0]).toBeLessThan(2);
    expect(r.at(-1)!.at[1]).toBeLessThan(r[0]!.at[1]);
    for (const p of r) expect(p.at[2]).toBeGreaterThan(2);
    const drop = folioAt(anims, T.drop - 1).plane!;
    expect(Math.hypot(drop.c - INTRO_FOLIO_TABLE_AT[0], drop.r - INTRO_FOLIO_TABLE_AT[1])).toBeLessThan(0.2);
    expect(folioAt(anims, T.plane - 1).plane).toBeNull();
    expect(folioAt(anims, T.bank + 1).plane!.anim).toBe("bank");
    expect(folioAt(anims, T.drop + 1).plane!.anim).toBe("drop");
    expect(folioAt(anims, T.planeGone).plane).toBeNull();
    // The packet falls from the plane's height to the table's top, then lies there and unfolds.
    expect(folioAt(anims, T.drop + 1).packet).toMatchObject({ from: r[3]!.at[2] });
    expect(folioAt(anims, T.land).packet).toBeNull();
    expect(folioAt(anims, T.land).board).toMatchObject({ anim: "packet" });
    expect(folioAt(anims, T.unfold + 1).board).toMatchObject({ anim: "unfold", frame: 0 });
  });

  it("the board unfolds before it bows and says its quiet line: the game's own board on the table from the unfold's end, and stays", () => {
    expect(T.board).toBeLessThan(T.bow);
    expect(T.board).toBeLessThan(T.quiet);
    expect(introAt(beats, anims, T.board - 1).table).toBe(false);
    for (let t = T.board; t < T.crumple; t += 100) expect(introAt(beats, anims, t).table, `${t}`).toBe(true);
    expect(folioAt(anims, T.board + F.swapMs).board).toBeNull();
    expect(folioAt(anims, T.bow + 200).move.anim).toBe("bow");
  });

  it("its quiet line: one of the five, picked at random, from just into its bow for its time, gone before the crumple; its entrance line before", () => {
    const five = introOf("folio")!.chant!;
    expect(five).toEqual(["It's quiet in here. Stay as long as you like.", "Come back whenever it gets too loud out there.", "Take your time. The page will wait.", "Think as long as you need. I'm in no hurry.", "Quiet helps. So does a clean page."]);
    const picked = new Set<string>();
    for (let i = 0; i < 50; i++) picked.add(chantOf(introOf("folio")!, () => i / 50)!);
    expect([...picked].sort()).toEqual([...five].sort());
    expect(introAt(beats, anims, T.quiet - 1).chant).toBe(false);
    expect(introAt(beats, anims, T.quiet).chant).toBe(true);
    expect(introAt(beats, anims, T.quiet + F.quietMs - 1).chant).toBe(true);
    expect(introAt(beats, anims, T.crumple - 1).chant).toBe(false);
    expect(introAt(beats, anims, at("line")).line).toBe(true);
    expect(introAt(beats, anims, at("back")).line).toBe(false);
  });

  it("every cue a sound of its own (its existing fold, unfold and rustle; its new set, glide, land, ball and open), in order; every cue on its art's frames too", () => {
    const ci = introOf("folio")!;
    const cues = introCues(beats, anims);
    for (let i = 1; i < cues.length; i++) expect(cues[i]!.at).toBeGreaterThanOrEqual(cues[i - 1]!.at);
    for (const c of cues) expect(ci.cues[c.cue], c.cue).toMatch(/^folio[A-Z]\w+$/);
    expect(cues.filter((c) => c.cue === "fold")).toHaveLength(9);
    expect(cues.filter((c) => c.cue === "set")).toHaveLength(3);
    expect(cues.filter((c) => c.cue === "unfold")).toHaveLength(2);
    expect(cues.find((c) => c.cue === "whoosh")!.at).toBe(T.plane);
    expect(cues.find((c) => c.cue === "land")!.at).toBe(T.land);
    expect(cues.find((c) => c.cue === "bow")!.at).toBeGreaterThan(T.bow);
    const all = new Set<string>(["crumple", "open"]);
    for (const ch of [BOSS_FOLIO_INTRO, INTRO_FOLIO_STOOL, INTRO_FOLIO_TABLE, INTRO_FOLIO_PLANE, INTRO_FOLIO_BOARD] as Character[])
      for (const a of Object.values(ch.anims)) for (const f of a!.frames) if (f.cue) all.add(f.cue);
    for (const c of all) expect(ci.cues[c], c).toMatch(/^folio[A-Z]\w+$/);
    const made = new Set(FOLIO_SOUNDS.map((n) => `folio${n[0]!.toUpperCase()}${n.slice(1)}`));
    for (const s of Object.values(ci.cues)) expect(made.has(s), s).toBe(true);
  });

  it("standing back, Folio (facing east, its intro's frames at its town size) and you are clear of your stools near the floor", () => {
    const m = marksOf(SHOP_FOLIO_LAYOUT, "across", SHOP_FOLIO_MARKS, marksFeel(anims, CHALLENGE_FEEL, 2.3))!;
    const k = (TOWN_FEEL.bossSquares * (TOWN_FEEL.bossScale.folio ?? 1)) / FOLIO.h;
    // (Its east-most drawn pixel in its lowest 0.4 squares, any frame of its idle and bow, mirrored about its foot to face east.)
    const band = 0.4 / k;
    let reach = -Infinity;
    for (const a of ["idle", "bow"])
      for (const f of BOSS_FOLIO_INTRO.anims[a]!.frames) {
        const { w, h, data } = renderFrame(BOSS_FOLIO_INTRO, f);
        for (let y = Math.floor(h - (h - BOSS_FOLIO_INTRO.foot[1]) - band); y < h; y++)
          for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3]! > 120) reach = Math.max(reach, BOSS_FOLIO_INTRO.foot[0] - x);
      }
    const stoolHalf = (INTRO_FOLIO_STOOL.w - INTRO_FOLIO_STOOL.foot[0]) / SQ;
    expect(m.bossClear.c + reach * k).toBeLessThanOrEqual(m.bossStool.c - stoolHalf - 0.05);
    const [, x0, x1] = /([\d.]+),39\.5 H ([\d.]+)/.exec(PAWN_PATH)!.map(Number);
    const half = (((x1! - x0!) / 2) * TOWN_FEEL.youSquares) / 45;
    expect(m.youClear.c - half).toBeGreaterThanOrEqual(m.youStool.c + stoolHalf + 0.05);
  });

  it("its props are drawn: every frame of the sheets, the stools, the table, the plane and the board has pixels; its shadow the warm see-through brown", () => {
    for (const ch of [INTRO_FOLIO_SHEETS, INTRO_FOLIO_STOOL, INTRO_FOLIO_TABLE, INTRO_FOLIO_PLANE, INTRO_FOLIO_BOARD] as Character[])
      for (const [a, an] of Object.entries(ch.anims))
        for (const [i, f] of an!.frames.entries()) expect(renderFrame(ch, f).data.some((v, j) => j % 4 === 3 && v > 0), `${ch.id} ${a} ${i}`).toBe(true);
    expect(BOSS_FOLIO_INTRO.palette.z).toBe("#5e4c3a88");
    expect(FOLIO.palette.z).not.toBe(BOSS_FOLIO_INTRO.palette.z);
  });
});

describe("the crumple into the match", () => {
  const C = CHALLENGE_FEEL.folio.crumple;

  it("the mesh: 16 x 34 on a phone (two triangles a cell), turned on a computer; flat at 0 (the screen as it is, shaded 1), a ball at 1 with its back showing; as the art's maths", () => {
    expect(meshSize(390, 844)).toEqual({ cols: 16, rows: 34 });
    expect(meshSize(390, 664)).toEqual({ cols: 16, rows: 34 });
    expect(meshSize(1280, 800)).toEqual({ cols: 34, rows: 16 });
    const b = meshBuf(390, 664);
    expect(b.shade).toHaveLength(16 * 34 * 6);
    const o = { ...CRUMPLE_DEFAULTS, cols: b.cols, rows: b.rows };
    fillMesh(b, 0, o);
    for (let v = 0; v < b.shade.length; v++) {
      expect(b.shade[v]).toBeCloseTo(1, 6);
      expect(b.back[v]).toBe(0);
      // (Flat: each corner where its picture's point is, in clip space.)
      expect(b.pos[v * 3]!).toBeCloseTo(b.uv[v * 2]! * 2 - 1, 5);
      expect(b.pos[v * 3 + 1]!).toBeCloseTo(1 - b.uv[v * 2 + 1]! * 2, 5);
    }
    fillMesh(b, 1, o);
    let back = 0;
    let rx = 0;
    for (let v = 0; v < b.shade.length; v++) {
      back += b.back[v]!;
      rx = Math.max(rx, Math.abs(b.pos[v * 3]!) * 195);
    }
    expect(back).toBeGreaterThan(0);
    // (A ball about 0.17 of the shorter side across each way, its creases pushing it out a little: well inside the screen.)
    expect(rx).toBeLessThan(0.17 * 390 * 1.8);
    // Every grid point as the art's crumplePoint has it, at a few crumples and turns.
    for (const p of [0.2, 0.5, 0.9])
      for (const turn of [0, 0.3]) {
        fillMesh(b, p, { ...o, turn });
        for (const [i, j] of [[0, 0], [8, 17], [16, 34], [3, 29]] as const) {
          const q = crumplePoint((i / 16 - 0.5) * 390, (j / 34 - 0.5) * 664, p, 390, 664, { ...o, turn });
          const k = (j * 17 + i) * 3;
          for (let d = 0; d < 3; d++) expect(b.grid[k + d]!).toBeCloseTo(q[d]!, 2);
        }
      }
  });

  it("its clock: crumpled, held at least its beat and until the match has been ready half a hold (cross-faded on the ball), opened, the creases lingering, done", () => {
    const end = (ready: number) => Math.max(C.crumpleMs + C.holdMs, ready + C.holdMs / 2) + C.openMs + C.lingerMs;
    for (const ready of [100, C.crumpleMs + 50, 2500, 9000]) {
      const seen: string[] = [];
      let lastP = 0;
      for (let t = 0; t <= end(ready) + 100; t += 10) {
        const b = crumpleBeat(t, t >= ready ? ready : Infinity, C);
        if (seen.at(-1) !== b.phase) seen.push(b.phase);
        if (b.phase === "crumple") expect(b.p).toBeGreaterThanOrEqual(lastP);
        if (b.phase === "hold") expect(b.p).toBe(1);
        if (b.phase === "open") expect(b.mix).toBe(1);
        lastP = b.p;
      }
      expect(seen, `ready at ${ready}`).toEqual(["crumple", "hold", "open", "linger", "done"]);
      expect(crumpleBeat(end(ready), ready, C).phase).toBe("done");
    }
    // (The art's own beat when the match is there at once: 0.8 s, 0.4 s, 0.8 s, 0.26 s.)
    expect([C.crumpleMs, C.holdMs, C.openMs, C.lingerMs]).toEqual([800, 400, 800, 260]);
    expect(end(0)).toBe(2260);
  });

  it("it always ends in the match: held as a ball while the match loads, however long; its picture late once the match shows (or failing), it fades through black instead", () => {
    // Waiting on the match to load: a ball, still holding at a minute.
    expect(crumpleBeat(60_000, Infinity, C).phase).toBe("hold");
    // The match shows but its picture doesn't come: "fail" (crumple-gl.ts fades the ball to black, then off the live match).
    expect(crumpleBeat(5_000, Infinity, C, true).phase).toBe("fail");
    // Ready in time: never "fail", whatever `late` says once it's ready.
    expect(crumpleBeat(5_000, 4_000, C, true).phase).not.toBe("fail");
  });
});

describe("the crumple's fallback (no WebGL)", () => {
  const C = CHALLENGE_FEEL.folio.crumple;
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("where the page can't get a WebGL context: a fade through black, covered, then gone once the match shows; never stuck", async () => {
    vi.useFakeTimers();
    const made: { className: string; dataset: Record<string, string>; style: Record<string, string> & { cssText: string }; removed: boolean }[] = [];
    const el = () => {
      const e = {
        className: "",
        dataset: {} as Record<string, string>,
        style: { cssText: "" } as Record<string, string> & { cssText: string },
        removed: false,
        width: 0,
        height: 0,
        offsetWidth: 0,
        setAttribute: () => {},
        getContext: () => null,
        remove() {
          e.removed = true;
        },
      };
      made.push(e);
      return e;
    };
    vi.stubGlobal("document", { createElement: el, body: { append: () => {} } });
    vi.stubGlobal("window", {});
    vi.stubGlobal("innerWidth", 390);
    vi.stubGlobal("innerHeight", 664);
    vi.stubGlobal("devicePixelRatio", 3);
    vi.stubGlobal("location", { search: "" });
    const { startCrumple } = await import("../src/town/shops/crumple-gl.ts");
    const intro = { home: "folio", def: { cues: {} } } as unknown as Parameters<typeof startCrumple>[0];
    const s = startCrumple(intro);
    const cv = made[0]!;
    expect(cv.className).toBe("boss-crumple");
    expect(cv.dataset.mode).toBe("fade");
    let covered = false;
    void s.covered.then(() => (covered = true));
    await vi.advanceTimersByTimeAsync(C.fadeMs + 1);
    expect(covered).toBe(true);
    expect(cv.dataset.covered).toBe("1");
    let gone = false;
    void s.out().then(() => (gone = true));
    await vi.advanceTimersByTimeAsync(C.fadeMs + 1);
    expect(gone).toBe(true);
    expect(cv.removed).toBe(true);
    expect(cv.dataset.phase).toBe("fade-out");
  });
});
