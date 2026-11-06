import { describe, expect, it } from "vitest";
import { INTRO_ALFIL_PYRAMID } from "../src/town/shops/alfil-intro-art.ts";
import { SHOP_ALFIL_LAYOUT } from "../src/town/shops/alfil-art.ts";
import { SHOP_BABUR_LAYOUT } from "../src/town/shops/babur-art.ts";
import { SHOP_PUDDLES_LAYOUT } from "../src/town/shops/puddles-art.ts";
import { SHOP_BIGBOY_LAYOUT, SHOP_BIGBOY_MARKS, SHOP_BIGBOY_PIECES } from "../src/town/shops/bigboy-art.ts";
import { SHOP_TIMBER_LAYOUT, SHOP_TIMBER_MARKS } from "../src/town/shops/timber-art.ts";
import { SHOP_BLITZ_LAYOUT, SHOP_BLITZ_MARKS } from "../src/town/shops/blitz-art.ts";
import { SHOP_HOLLOW_FLOOR, SHOP_HOLLOW_LAYOUT, SHOP_HOLLOW_MARKS, SHOP_HOLLOW_PIECES } from "../src/town/shops/hollow-art.ts";
import { SHOP_PIG_LAYOUT, SHOP_PIG_MARKS } from "../src/town/shops/pig-art.ts";
import { BOSS_PIG_INTRO, INTRO_PIG_BUCKET_B, INTRO_PIG_BUCKET_SEAT_H, INTRO_PIG_BUCKET_W } from "../src/town/shops/pig-intro-art.ts";
import { BOSS_HOLLOW_INTRO, HOLLOW_INTRO_BALL_R, HOLLOW_INTRO_HEART, INTRO_HOLLOW_BULB_RUN, INTRO_HOLLOW_DARK, INTRO_HOLLOW_DIMPOOL, INTRO_HOLLOW_LANTERN_GLOW, INTRO_HOLLOW_LANTERN_OUT, INTRO_HOLLOW_PIECES, INTRO_HOLLOW_SHOWPIECE_OUT } from "../src/town/shops/hollow-intro-art.ts";
import { INTRO_BLITZ_STOOL, INTRO_BLITZ_STOOL_SEAT_H } from "../src/town/shops/blitz-intro-art.ts";
import { INTRO_BIGBOY_BLOCKS, INTRO_BIGBOY_STOOL_B, INTRO_BIGBOY_STOOL_SEAT_H, INTRO_BIGBOY_STOOL_TOP_H, INTRO_BIGBOY_STOOL_W, INTRO_BIGBOY_SWIRL, INTRO_BIGBOY_SWIRL_FRONT, INTRO_BIGBOY_TABLE_PALETTE } from "../src/town/shops/bigboy-intro-art.ts";
import { TABLE_BOARD } from "../src/town/houses/park.ts";
import { renderFrame } from "../src/characters/sprite.ts";
import { DARK_MOVES, caveLight, chantOf, darkAnims, drainAt, seatedMarks, type DarkAnims, type IntroStep } from "../src/town/shops/challenge.ts";
import { BOSS_INTROS, CHALLENGE_FEEL, attackStart, logAnims, logWalks, marksFeel, woodAt, isLog, attackTime, boardSquare, coverMs, frameAt, hopStart, introAt, introBeats, introCues, introLength, introOf, marksOf, nextFlow, stormEdge, wipeAt, type BlocksAnims, type LogAnims, type ChallengeEvent, type ChallengeFlow, type IntroAnims, type IntroBeat } from "../src/town/shops/challenge.ts";
import { PARK_TABLE } from "../src/town/houses/park.ts";
import { INTRO_ALFIL_TABLE } from "../src/town/shops/alfil-intro-art.ts";
import { BOSS_BEAVER_INTRO, INTRO_TIMBER_FRONT, INTRO_TIMBER_LOG, INTRO_TIMBER_SHAVINGS, INTRO_TIMBER_STORM, INTRO_TIMBER_STUMP, INTRO_TIMBER_STUMP_SEAT_H, INTRO_TIMBER_TABLE, INTRO_TIMBER_TABLE_PALETTE, TIMBER_INTRO_LIFT_AT, TIMBER_INTRO_REACH } from "../src/town/shops/timber-intro-art.ts";
import { findPath, makeRoom } from "../src/town/shops/room.ts";
import { SHOPS } from "../src/town/shops/shops.ts";
import { ALL_HOMES, HOMES, START, Walker, createTown, standOf } from "../src/town/world.ts";
import { SHOP_FEEL, TOWN_FEEL } from "../src/town/feel.ts";
import { BOSS_ART, PAWN_PATH } from "../src/town/render.ts";
import { bossKit } from "../src/characters/kits.ts";
import type { Character } from "../src/characters/sprite.ts";

/**
 * A boss challenged from the town, Pokémon-gym style (Nov 2; town/shops/challenge.ts): the flow from the card's Fight to the battle,
 * the battle circle's marks, the intro's timeline on Alfil's own art, the storm's edge, and coming back to where you stood. Round 2
 * (Nov 2): the layouts (across: the boss on the left, you on the right), the table's stools and board turned to them, and the default
 * intro (Babur's and Puddles': the table pops in, the attack swung in place, a flash and a wipe).
 */
const ms = (a: "rise" | "idle" | "crack" | "crumble") => INTRO_ALFIL_PYRAMID.anims[a]!.frames.map((f) => f.ms);
/** Timber's log (Nov 3), as shops/intro.ts makes it from his art: his pixels his town figure's, `bossSquares` tall. */
const TIMBER_PER_SQ = BOSS_ART.timber.h / (TOWN_FEEL.bossSquares * (TOWN_FEEL.bossScale.timber ?? 1));
const TIMBER: LogAnims = logAnims({ mover: BOSS_BEAVER_INTRO, log: INTRO_TIMBER_LOG, fog: INTRO_TIMBER_SHAVINGS, stump: INTRO_TIMBER_STUMP, reach: TIMBER_INTRO_REACH }, TIMBER_PER_SQ);
const ALFIL: IntroAnims = { rise: ms("rise"), idle: ms("idle"), crack: ms("crack"), crumble: ms("crumble"), tableFrame: INTRO_ALFIL_PYRAMID.anims.crumble!.frames.findIndex((f) => f.cue === "table") };

describe("the challenge's flow", () => {
  const run = (events: ChallengeEvent[], from: ChallengeFlow = "town") => events.reduce<ChallengeFlow>((s, e) => nextFlow(s, e), from);

  it("goes from the town to the battle in order: the door, in, the marks, the intro, the storm in, covered, the storm out", () => {
    const seen: ChallengeFlow[] = [];
    let s: ChallengeFlow = "town";
    for (const e of ["fight", "atDoor", "inside", "onMarks", "introDone", "stormCovers", "battleReady", "stormGone"] as const) seen.push((s = nextFlow(s, e)));
    expect(seen).toEqual(["toDoor", "goingIn", "walkIn", "intro", "stormIn", "covered", "stormOut", "battle"]);
  });

  it("anything out of turn changes nothing (a second Fight, the storm before the intro)", () => {
    expect(run(["fight", "fight"])).toBe("toDoor");
    expect(run(["introDone", "stormCovers"])).toBe("town");
    expect(run(["fight", "inside"])).toBe("toDoor");
  });

  it("can be called off until the storm starts, never after: the battle is coming", () => {
    for (const s of ["toDoor", "goingIn", "walkIn", "intro"] as const) expect(nextFlow(s, "cancel"), s).toBe("town");
    for (const s of ["stormIn", "covered", "stormOut", "battle"] as const) expect(nextFlow(s, "cancel"), s).toBe(s);
    // (Called off, a new Fight starts it again.)
    expect(run(["fight", "atDoor", "cancel", "fight"])).toBe("toDoor");
  });

  it("every boss whose home has an inside has an intro (Alfil, Big Boy, Timber, Hollow, Wrangler, Jefferson, Ginger, Dash, Folio and Smudgy their own, Babur and Puddles the default); every other boss is challenged as before (the Boss raid screen)", () => {
    const withIntro = ALL_HOMES.filter((h) => introOf(h.id)).map((h) => h.id).sort();
    expect(withIntro).toEqual(["alfil", "bigboy", "dash", "folio", "gardener", "gingerbread", "grex", "hollow", "pig", "smudgy", "tiger", "timber"]);
    expect(withIntro).toEqual(Object.keys(SHOPS).sort());
    expect(introOf("alfil")).toMatchObject({ custom: true, line: "I'll show you the power of the old piece." });
    expect(introOf("tiger")).toMatchObject({ custom: false, name: "Babur", line: "Fine. One more show. Then I'm on break." });
    expect(introOf("gardener")).toMatchObject({ custom: false, name: "Puddles", line: "Wipe your feet. Then let's see what grows." });
    expect(introOf("bigboy")).toMatchObject({ custom: true, name: "Big Boy", line: "My blocks! My board! Big boy go first!" });
    expect(introOf("timber")).toMatchObject({ custom: true, name: "Timber", line: "Hard hats on. We're building today.", layout: "across", cues: { storm: "timberSwoosh" } });
    // (Dash, Nov 5: his own, round 3, his dashes and the clock rush; his line his entrance's first; you both walk on to where you stand.)
    expect(introOf("dash")).toMatchObject({ custom: true, name: "Dash", line: "Yo yo yo! Dash in the building, fam!", layout: "across", seated: true, cues: { pop: "pop", storm: "dashWhirr" } });
    // (Hollow, Nov 3: his own, the dark; his line one of his entrance's, then a channel line; you both walk on to your seats.)
    expect(introOf("hollow")).toMatchObject({ custom: true, name: "Hollow", line: "Did you leave a light on?", layout: "across", seated: true, cues: { table: "pop", blackout: "hollowBlackout" } });
    // (Wrangler, Nov 4: his own, the lasso; his line a placeholder until Eric's Gemini lines; you both walk on to where you stand clear.)
    expect(introOf("pig")).toMatchObject({ custom: true, name: "Wrangler", line: "Saddle up, partner. The board's comin' to us.", layout: "across", seated: true });
    // (Jefferson, Nov 4: his own, the crew; his call one of four at random, placeholders until Eric's Gemini lines; you both stand on
    // the marks: he stands, you on your lift.)
    expect(introOf("grex")).toMatchObject({ custom: true, name: "Jefferson", line: "Boys! We got a challenger!", layout: "across" });
    expect(introOf("grex")!.seated).toBeUndefined();
    // (Ginger, Nov 5: his own, the icicle; his line a placeholder until Eric's Gemini lines; you both stand on the marks, no stools.)
    expect(introOf("gingerbread")).toMatchObject({ custom: true, name: "Ginger", line: "Cold enough for you?", layout: "across", crewLine: "Coming, boss!" });
    expect(introOf("gingerbread")!.seated).toBeUndefined();
    // (Folio, Nov 5: its own, the folding and the plane, then the crumple; its line its entrance's; a quiet line one of five.)
    expect(introOf("folio")).toMatchObject({ custom: true, name: "Folio", line: "Every game's a draft. Write one?", layout: "across", clear: 2.3 });
    expect(introOf("folio")!.chant).toHaveLength(5);
    // (Smudgy, Nov 6: his own, the cloth whipped off, then the splatter; his line his entrance's first; his reveal line Eric's idea.)
    expect(introOf("smudgy")).toMatchObject({ custom: true, name: "Smudgy", line: "Artist at work. Wet paint!", layout: "across", seated: true, chant: ["Careful, don't get any paint on the pieces!"] });
  });

  it("the layout: across for all twelve today (the boss on the left, you on the right: Eric's normal look)", () => {
    for (const id of ["alfil", "tiger", "gardener", "bigboy", "timber", "dash", "hollow", "pig", "grex", "gingerbread", "folio", "smudgy"] as const) expect(introOf(id)!.layout, id).toBe("across");
  });
});

describe("the battle circle's marks", () => {
  const ROOMS = { alfil: SHOP_ALFIL_LAYOUT, tiger: SHOP_BABUR_LAYOUT, gardener: SHOP_PUDDLES_LAYOUT, bigboy: SHOP_BIGBOY_LAYOUT, timber: SHOP_TIMBER_LAYOUT, dash: SHOP_BLITZ_LAYOUT, hollow: SHOP_HOLLOW_LAYOUT, pig: SHOP_PIG_LAYOUT } as const;

  it("across: the boss west of the table, you east, all on the circle's middle row; each a square and a half out, just past its stool", () => {
    for (const [id, layout] of Object.entries(ROOMS)) {
      // (Wrangler's lasso ring's tiles run a row further south than north of its middle: his room's drawn marks, SHOP_PIG_MARKS, say
      // where its middle line is, as ShopRoom passes them.)
      const m = marksOf(layout, "across", id === "pig" ? SHOP_PIG_MARKS : null)!;
      // (Babur's ring has his pedestal in its middle: the table stands clearOff south of it, in front. Hollow's pond, in his cave, is
      // three columns east and a row south of the box rooms' circles.)
      const r = id === "tiger" ? 10.5 + CHALLENGE_FEEL.clearOff : id === "hollow" ? 11.5 : 10.5;
      const c = id === "hollow" ? 12.5 : 9.5;
      expect(m.table, id).toEqual({ c, r });
      expect(m.boss, id).toEqual({ c: c - 1.5, r });
      expect(m.you, id).toEqual({ c: c + 1.5, r });
      // (Each walks to its mark's south square, then the last half square north onto its middle: none for a whole row.)
      expect(m.youSq, id).toEqual({ c: c + 1.5, r: Math.ceil(r) });
      expect(m.bossSq, id).toEqual({ c: c - 1.5, r: Math.ceil(r) });
      // Facing each other: the boss right (toward you), you left.
      expect([m.bossFace, m.youFace], id).toEqual([1, -1]);
      // Once the stools are in, each a clear step outside its stool, on the same row (the hop back: CHALLENGE_FEEL.clear).
      expect(m.youClear, id).toEqual({ c: c + CHALLENGE_FEEL.clear.you, r });
      expect(m.bossClear, id).toEqual({ c: c - CHALLENGE_FEEL.clear.boss, r });
    }
  });

  it("the table stands clear of the room's pieces (Babur's pedestal, in his ring's middle, stays behind it)", () => {
    const pedestal = SHOP_BABUR_LAYOUT.find((p) => p.name === "pedestal")!;
    expect([pedestal.col, pedestal.row]).toEqual([9, 10]);
    const m = marksOf(SHOP_BABUR_LAYOUT, "across")!;
    expect(m.table.r - pedestal.row).toBeGreaterThanOrEqual(2);
    // Every square you, the boss, the table and the stools stand on is clear, in all three rooms.
    for (const [id, layout] of Object.entries(ROOMS)) {
      const mm = marksOf(layout, "across")!;
      const solid = new Set(layout.filter((p) => p.solid).flatMap((p) => Array.from({ length: p.w ?? 1 }, (_, i) => Array.from({ length: p.d ?? 1 }, (_, j) => `${p.col + i},${p.row - j}`)).flat()));
      for (const at of [mm.you, mm.boss, mm.table, mm.youStool, mm.bossStool, mm.youClear, mm.bossClear])
        for (const c of [Math.floor(at.c), Math.ceil(at.c)]) for (const r of [Math.floor(at.r), Math.ceil(at.r)]) expect(solid.has(`${c},${r}`), `${id} ${c},${r}`).toBe(false);
    }
  });

  it("facing: the boss north of the table, you south (the circle's old marks)", () => {
    const m = marksOf(SHOP_ALFIL_LAYOUT, "facing")!;
    expect(m.you).toEqual({ c: 9.5, r: 13 });
    expect(m.boss).toEqual({ c: 9.5, r: 8 });
    expect(m.table).toEqual({ c: 9.5, r: 10.5 });
    expect(m.youSq).toEqual({ c: 10, r: 13 });
    expect(m.bossSq).toEqual({ c: 9, r: 8 });
    expect([m.bossFace, m.youFace]).toEqual([null, null]);
  });

  it("the stools: one at each player's side of the table, between it and them, nothing on the empty sides", () => {
    for (const how of ["across", "facing"] as const) {
      const m = marksOf(SHOP_ALFIL_LAYOUT, how)!;
      const along = how === "across" ? "c" : "r";
      const cross = how === "across" ? "r" : "c";
      for (const [who, stool] of [["boss", m.bossStool], ["you", m.youStool]] as const) {
        const stand = m[who];
        // On the line through the table and its player, the park table's stool distance from the table's middle, short of the player.
        expect(stool[cross], `${how} ${who}`).toBe(m.table[cross]);
        expect(Math.abs(stool[along] - m.table[along]), `${how} ${who}`).toBe(CHALLENGE_FEEL.stoolOff);
        expect(Math.sign(stool[along] - m.table[along]), `${how} ${who}: on its side`).toBe(Math.sign(stand[along] - m.table[along]));
        expect(Math.abs(stand[along] - m.table[along]), `${how} ${who}: past it`).toBeGreaterThan(CHALLENGE_FEEL.stoolOff);
      }
    }
  });

  it("the table's picture is three squares across, a stool in each outer one (the park's and Alfil's alike): across it stands as drawn", () => {
    for (const t of [PARK_TABLE, INTRO_ALFIL_TABLE]) {
      expect(t.w, t.id).toBe(3 * TOWN_FEEL.housePxPerSquare);
      // (Its foot in the middle square; across, its stools fall on the players' sides, the table's west and east.)
      expect(Math.floor(t.foot[0] / TOWN_FEEL.housePxPerSquare), t.id).toBe(1);
    }
  });

  it("Alfil's and Puddles' drawn start marks are where you stand across: west and east of the emblem, a two-square pad each", () => {
    for (const layout of [SHOP_ALFIL_LAYOUT, SHOP_PUDDLES_LAYOUT]) {
      const m = marksOf(layout, "across")!;
      const pads = layout.filter((p) => /^circle-mark/.test(p.name));
      expect(pads).toHaveLength(4);
      for (const who of [m.boss, m.you]) {
        const pad = pads.filter((p) => p.col === who.c).map((p) => p.row).sort();
        expect(pad).toEqual([Math.floor(who.r), Math.ceil(who.r)]);
      }
    }
  });

  it("Timber's start marks (SHOP_TIMBER_MARKS, branded on his log's end grain) are where you stand across: the boss west, you east, on the middle line", () => {
    const drawn = marksOf(SHOP_TIMBER_LAYOUT, "across", SHOP_TIMBER_MARKS)!;
    expect([drawn.boss, drawn.you]).toEqual([{ c: 8, r: 10.5 }, { c: 11, r: 10.5 }]);
    // (The same squares the circle's own middle gives: the drawn marks only say so.)
    const own = marksOf(SHOP_TIMBER_LAYOUT, "across")!;
    expect([own.boss, own.you]).toEqual([drawn.boss, drawn.you]);
  });

  it("Dash's start marks (SHOP_BLITZ_MARKS, his try-on mats) are where you stand across: the boss west, you east, on the middle line", () => {
    const drawn = marksOf(SHOP_BLITZ_LAYOUT, "across", SHOP_BLITZ_MARKS)!;
    expect([drawn.boss, drawn.you]).toEqual([{ c: 8, r: 10.5 }, { c: 11, r: 10.5 }]);
    // (The same squares the circle's own middle gives: the drawn marks only say so.)
    const own = marksOf(SHOP_BLITZ_LAYOUT, "across")!;
    expect([own.boss, own.you]).toEqual([drawn.boss, drawn.you]);
  });

  it("Hollow's start marks (SHOP_HOLLOW_MARKS, rings etched in his pond's ice) are where you stand across: the boss west, you east, on the middle line", () => {
    const drawn = marksOf(SHOP_HOLLOW_LAYOUT, "across", SHOP_HOLLOW_MARKS)!;
    expect([drawn.boss, drawn.you]).toEqual([{ c: 11, r: 11.5 }, { c: 14, r: 11.5 }]);
    // (The same squares the pond's own middle gives: the drawn marks only say so.)
    const own = marksOf(SHOP_HOLLOW_LAYOUT, "across")!;
    expect([own.boss, own.you]).toEqual([drawn.boss, drawn.you]);
  });

  it("Big Boy's start marks (SHOP_BIGBOY_MARKS, drawn on his rug) are where you stand across: west and east of the table, a two-square pad each; none north or south", () => {
    const m = marksOf(SHOP_BIGBOY_LAYOUT, "across", SHOP_BIGBOY_MARKS)!;
    expect([m.boss, m.you]).toEqual([{ c: SHOP_BIGBOY_MARKS.boss[0], r: SHOP_BIGBOY_MARKS.boss[1] }, { c: SHOP_BIGBOY_MARKS.you[0], r: SHOP_BIGBOY_MARKS.you[1] }]);
    // (The same as the layout's own: a square and a half either side of the circle's middle, the table there.)
    expect(m).toEqual(marksOf(SHOP_BIGBOY_LAYOUT, "across"));
    // (A pad's teal edge, "T": only the marks have it on the circle.)
    const edged = (c: number, r: number) => {
      const p = SHOP_BIGBOY_LAYOUT.find((q) => q.col === c && q.row === r && /^circle-/.test(q.name))!;
      expect(p, `${c},${r}`).toBeDefined();
      return SHOP_BIGBOY_PIECES[p.name]!.anims.idle!.frames[0]!.layers.some((l) => SHOP_BIGBOY_PIECES[p.name]!.parts[l.part]!.grid.some((row) => row.includes("T")));
    };
    for (const who of [m.boss, m.you]) for (const r of [Math.floor(who.r), Math.ceil(who.r)]) expect(edged(who.c, r), `${who.c},${r}`).toBe(true);
    const marked = SHOP_BIGBOY_LAYOUT.filter((p) => /^circle-/.test(p.name) && edged(p.col, p.row)).map((p) => `${p.col},${p.row}`).sort();
    expect(marked).toEqual(["11,10", "11,11", "8,10", "8,11"]);
  });

  it("you and the boss walk in side by side from the door, neither crossing the other, each path clear and short", () => {
    for (const [id, layout] of Object.entries(ROOMS)) {
      const room = makeRoom(layout, SHOPS[id as keyof typeof SHOPS]!.keeper);
      const m = marksOf(layout, "across")!;
      const bossStart = { c: room.start.c - 1, r: room.start.r };
      const you = findPath(room, room.start, m.youSq)!;
      const boss = findPath(room, bossStart, m.bossSq)!;
      expect(you, id).not.toBeNull();
      expect(boss, id).not.toBeNull();
      // (The boss keeps to your west, row for row.)
      for (let i = 0; i < Math.min(you.length, boss.length); i++) if (you[i]!.r === boss[i]!.r) expect(boss[i]!.c, `${id} step ${i}`).toBeLessThan(you[i]!.c);
      // A slow walk up to the marks (Nov 2: "slowly walk up to the chessboard"): about a second and a half, under two.
      const ms = Math.max(you.length, boss.length) * CHALLENGE_FEEL.walkStepMs;
      expect(ms, id).toBeGreaterThanOrEqual(1000);
      expect(ms, id).toBeLessThanOrEqual(2000);
    }
  });

  it("found from any room's circle (Babur's ring has no marks drawn: its middle is enough); none in a room without one", () => {
    expect(marksOf(SHOP_BABUR_LAYOUT, "across")).not.toBeNull();
    expect(marksOf([], "across")).toBeNull();
  });
});

describe("the board on the table, turned to the layout", () => {
  it("across: white's ranks nearest you (east), black's nearest the boss (west), the a-file nearest the camera (on your left)", () => {
    expect(boardSquare("across", 0, 0)).toEqual({ x: 3.5, z: -3.5 }); // a1: east, south
    expect(boardSquare("across", 7, 0)).toEqual({ x: 3.5, z: 3.5 }); // h1: east, north
    expect(boardSquare("across", 0, 7)).toEqual({ x: -3.5, z: -3.5 }); // a8: west
    // White's two ranks are the two easternmost columns of squares, black's the two westernmost.
    for (let f = 0; f < 8; f++) {
      expect(boardSquare("across", f, 1).x).toBeGreaterThan(boardSquare("across", f, 6).x);
    }
  });

  it("facing: white's ranks nearest you (south), the a-file west (on your left)", () => {
    expect(boardSquare("facing", 0, 0)).toEqual({ x: -3.5, z: -3.5 });
    expect(boardSquare("facing", 0, 7)).toEqual({ x: -3.5, z: 3.5 });
    expect(boardSquare("facing", 7, 0)).toEqual({ x: 3.5, z: -3.5 });
  });
});

describe("the intro's timeline (Alfil's art)", () => {
  const beats = introBeats(ALFIL);
  const at = (t: number) => introAt(beats, ALFIL, t);

  it("the art's frames: rise 8, idle 2 (looping), crack 6, crumble 8; the table shows from the crumble's third frame", () => {
    expect([ALFIL.rise.length, ALFIL.idle.length, ALFIL.crack.length, ALFIL.crumble.length]).toEqual([8, 2, 6, 8]);
    expect(ALFIL.tableFrame).toBe(2);
    expect(INTRO_ALFIL_PYRAMID.anims.idle!.loop).toBe(true);
  });

  it("facing each other, the line alone, a pause, the pyramid rising, holding, cracking, crumbling, the table alone, his attack; then the storm", () => {
    const F = CHALLENGE_FEEL;
    expect(beats.map((b) => b.step)).toEqual(["face", "line", "pause", "rise", "idle", "crack", "crumble", "table", "swing", "done"]);
    const beat = (s: string) => beats.find((b) => b.step === s)!;
    const len = (s: string) => beat(s).end - beat(s).at;
    expect([len("face"), len("line"), len("pause"), len("idle"), len("table")]).toEqual([F.faceMs, F.lineMs, F.afterLineMs, F.holdMs, F.tableHoldMs]);
    // Facing each other a moment: nothing yet, no line.
    expect(at(0)).toMatchObject({ step: "face", pyramid: null, line: false, table: false, stools: false });
    // The line on its own, nothing rising under it; gone after it, and a pause.
    expect(at(beat("line").at)).toMatchObject({ step: "line", pyramid: null, line: true, table: false });
    expect(at(beat("line").end - 1)).toMatchObject({ step: "line", pyramid: null, line: true });
    expect(at(beat("pause").at)).toMatchObject({ step: "pause", pyramid: null, line: false });
    expect(at(beat("rise").at)).toMatchObject({ step: "rise", pyramid: { anim: "rise", frame: 0 }, line: false });
    expect(at(beat("idle").at + 1)).toMatchObject({ step: "idle", pyramid: { anim: "idle", frame: 0 } });
    expect(at(beat("crack").at)).toMatchObject({ step: "crack", pyramid: { anim: "crack", frame: 0 }, line: false, table: false });
    const crumble = beat("crumble");
    expect(at(crumble.at)).toMatchObject({ pyramid: { anim: "crumble", frame: 0 }, table: false });
    const clear = crumble.at + ALFIL.crumble[0]! + ALFIL.crumble[1]!;
    expect(at(clear - 1).table).toBe(false);
    expect(at(clear)).toMatchObject({ pyramid: { anim: "crumble", frame: 2 }, table: true });
    expect(at(crumble.end)).toMatchObject({ step: "table", pyramid: null, table: true, drift: true });
    expect(at(beat("swing").at)).toMatchObject({ step: "swing", table: true, drift: true });
    expect(at(introLength(beats))).toMatchObject({ step: "done", table: true });
  });

  it("the cues (their sounds) come on their beats: rumble as it rises, crack, crumble, and table on the clear frame", () => {
    const crumble = beats.find((b) => b.step === "crumble")!;
    expect(introCues(beats, ALFIL)).toEqual([
      { cue: "rumble", at: beats.find((b) => b.step === "rise")!.at },
      { cue: "crack", at: beats.find((b) => b.step === "crack")!.at },
      { cue: "crumble", at: crumble.at },
      { cue: "table", at: crumble.at + ALFIL.crumble[0]! + ALFIL.crumble[1]! },
    ]);
    // Every cue the art names has its sound (Alfil's own pack), and the storm's.
    expect(Object.keys(introOf("alfil")!.cues).sort()).toEqual(["crack", "crumble", "rumble", "storm", "table"]);
  });

  it("frameAt: through an animation once and held on its last frame, or looping", () => {
    expect(frameAt([100, 100, 100], 0, false)).toBe(0);
    expect(frameAt([100, 100, 100], 150, false)).toBe(1);
    expect(frameAt([100, 100, 100], 1000, false)).toBe(2);
    expect(frameAt([100, 100], 250, true)).toBe(0);
    expect(frameAt([100, 100], 350, true)).toBe(1);
  });
});

/** Big Boy's toy blocks' frames, as shops/intro.ts reads them from his art. */
const blocksOf = (): BlocksAnims => {
  const A = INTRO_BIGBOY_BLOCKS.anims;
  const ms = (a: "build" | "plop" | "chairs") => A[a]!.frames.map((f) => f.ms);
  const cues = (a: "build" | "plop" | "chairs") => A[a]!.frames.map((f) => f.cue);
  return { build: ms("build"), plop: ms("plop"), chairs: ms("chairs"), cues: { build: cues("build"), plop: cues("plop"), chairs: cues("chairs") } };
};

describe("the intro's timeline (Big Boy's toy blocks, Nov 2)", () => {
  const B = blocksOf();
  const beats = introBeats(B);
  const at = (t: number) => introAt(beats, B, t);
  const F = CHALLENGE_FEEL;
  const beat = (s: string) => beats.find((b) => b.step === s)!;

  it("the art: build 21 frames (6 blocks landing, the top one last), plop 5 (its first the board's touchdown), chairs 8 (2 stools); his table three squares across (and 8 px each side for the stools' puffs), the board's slab on its top block; the stools a dark gray B on the boss's side (black's), a bone W on yours", () => {
    expect(B.build).toHaveLength(21);
    expect(B.cues.build.filter(Boolean)).toEqual(["block", "block", "block", "block", "block", "block-top"]);
    expect(B.plop).toHaveLength(5);
    expect(B.cues.plop[0]).toBe("plop");
    expect(B.chairs).toHaveLength(8);
    expect(B.cues.chairs.filter(Boolean)).toEqual(["stool", "stool"]);
    const ch = INTRO_BIGBOY_BLOCKS;
    const PX = TOWN_FEEL.housePxPerSquare;
    expect([ch.w, ch.foot[0], ch.foot[1]]).toEqual([3 * PX + 16, Math.floor((3 * PX + 16) / 2), ch.h - 6]);
    // (The top block's top, in the middle, is where the town lays a table's slab: TABLE_BOARD.top over the foot.)
    const img = renderFrame(ch, ch.anims.idle!.frames[0]!);
    const topAt = (x: number) => {
      for (let y = 0; y < ch.h; y++) if (img.data[(y * ch.w + x) * 4 + 3]! > 0) return y;
      return ch.h;
    };
    const top = topAt(ch.foot[0]);
    expect(ch.foot[1] - top - TABLE_BOARD.top).toBeGreaterThanOrEqual(0);
    expect(ch.foot[1] - top - TABLE_BOARD.top).toBeLessThanOrEqual(2);
    // The stools a square either side of the foot (where the players' stools stand: stoolOff), their tops STOOL_TOP_H (24) over it
    // (its outline and glow a pixel or two above), the seat 20 (twice the park stools'); the boss (black) west, you (white) east.
    expect([INTRO_BIGBOY_STOOL_TOP_H, INTRO_BIGBOY_STOOL_SEAT_H]).toEqual([24, 20]);
    const rgb = (x: number, y: number) => "#" + Array.from(img.data.slice((y * ch.w + x) * 4, (y * ch.w + x) * 4 + 3), (v) => v.toString(16).padStart(2, "0")).join("");
    for (const [dx, face] of [[-PX * CHALLENGE_FEEL.stoolOff, "#46454c"], [PX * CHALLENGE_FEEL.stoolOff, "#e8dcc2"]] as const) {
      const x = ch.foot[0] + dx;
      expect(ch.foot[1] - topAt(x) - INTRO_BIGBOY_STOOL_TOP_H, `${dx}`).toBeGreaterThanOrEqual(0);
      expect(ch.foot[1] - topAt(x) - INTRO_BIGBOY_STOOL_TOP_H, `${dx}`).toBeLessThanOrEqual(2);
      expect(rgb(x - 8, ch.foot[1] - 9), `${dx}: its front's face`).toBe(face);
    }
    expect(boardSquare("across", 0, 0).x, "white's back rank east, yours").toBeGreaterThan(0);
    // Each stool on its own too (51 x 100, the table's ground line), idle and its drop (a "stool" cue as it lands).
    for (const st of [INTRO_BIGBOY_STOOL_B, INTRO_BIGBOY_STOOL_W]) {
      expect([st.w, st.h, ...st.foot], st.id).toEqual([51, ch.h, 25, ch.foot[1]]);
      expect(st.anims.drop!.frames.map((f) => f.cue).filter(Boolean), st.id).toEqual(["stool"]);
    }
    // His slab's and board's colors; the swirl tiles (128 a side) and its front, six frames each, looping.
    for (const k of ["1", "2", "4", "L", "D"]) expect(INTRO_BIGBOY_TABLE_PALETTE).toHaveProperty(k);
    expect([INTRO_BIGBOY_SWIRL.w, INTRO_BIGBOY_SWIRL.h, INTRO_BIGBOY_SWIRL_FRONT.h]).toEqual([128, 128, 128]);
    for (const c of [INTRO_BIGBOY_SWIRL, INTRO_BIGBOY_SWIRL_FRONT]) expect(c.anims.idle!).toMatchObject({ loop: true, frames: { length: 6 } });
  });

  it("facing each other, the line alone, a pause, the blocks stacking, a gap, the board dropping and plopping on, a gap, the stools dropping in, the table alone, his attack; then the swirl", () => {
    expect(beats.map((b) => b.step)).toEqual(["face", "line", "pause", "build", "pause", "drop", "plop", "pause", "chairs", "table", "swing", "done"]);
    const gaps = beats.filter((b) => b.step === "pause");
    expect(gaps.map((b) => b.end - b.at)).toEqual([F.afterLineMs, F.gapMs, F.gapMs]);
    expect(beat("build").end - beat("build").at).toBe(B.build.reduce((a, b) => a + b, 0));
    expect(beat("drop").end - beat("drop").at).toBe(F.boardDropMs);
    expect(beat("table").end - beat("table").at).toBe(F.tableHoldMs);
    // The line alone, nothing between you yet; then a pause.
    expect(at(beat("line").at + 100)).toMatchObject({ step: "line", line: true, blocks: null, table: false, stools: false, pyramid: null });
    expect(at(gaps[0]!.at + 1)).toMatchObject({ step: "pause", line: false, blocks: null, table: false });
    // The blocks landing, one by one, after the line; held built through the gap.
    expect(at(beat("build").at + 10)).toMatchObject({ step: "build", line: false, blocks: { anim: "build", frame: 0 }, table: false });
    expect(at(gaps[1]!.at + 1)).toMatchObject({ step: "pause", blocks: { anim: "build", frame: B.build.length - 1 }, table: false });
    // The board falling from above onto the built table (its last frame), still above it, then lower.
    const d0 = at(beat("drop").at + 1);
    const d1 = at(beat("drop").at + F.boardDropMs * 0.8);
    expect(d0).toMatchObject({ step: "drop", line: false, blocks: { anim: "build", frame: B.build.length - 1 }, table: true, stools: false });
    expect(d0.drop).toBeGreaterThan(F.dropFrom * 0.95);
    expect(d1.drop).toBeGreaterThan(0);
    expect(d1.drop).toBeLessThan(d0.drop);
    // On it as it plops (dust and stars), held through the gap; then the stools drop in, then it all stands.
    expect(at(beat("plop").at)).toMatchObject({ step: "plop", blocks: { anim: "plop", frame: 0 }, table: true, drop: 0, stools: false });
    expect(at(gaps[2]!.at + 1)).toMatchObject({ step: "pause", blocks: { anim: "plop", frame: B.plop.length - 1 }, table: true, stools: false });
    expect(at(beat("chairs").at + 1)).toMatchObject({ step: "chairs", blocks: { anim: "chairs", frame: 0 }, table: true, stools: true });
    expect(at(beat("table").at + 1)).toMatchObject({ step: "table", blocks: { anim: "idle", frame: 0 }, table: true, stools: true, drop: 0 });
    expect(at(beat("swing").at + 1)).toMatchObject({ step: "swing", blocks: { anim: "idle", frame: 0 }, table: true, stools: true });
    expect(at(introLength(beats) + 50)).toMatchObject({ step: "done", table: true, stools: true });
  });

  it("the cues (his sounds) come on the art's frames: a clack as each block lands, a bonk for the top one, his toss as the board drops, a poof as it plops on, a clack for each stool", () => {
    const cues = introCues(beats, B);
    const frameAtMs = (anim: "build" | "plop" | "chairs", i: number) => beat(anim).at + B[anim].slice(0, i).reduce((a, b) => a + b, 0);
    expect(cues).toEqual([
      ...[3, 6, 9, 12, 15].map((i) => ({ cue: "block", at: frameAtMs("build", i) })),
      { cue: "block-top", at: frameAtMs("build", 18) },
      { cue: "drop", at: beat("drop").at },
      { cue: "plop", at: beat("plop").at },
      { cue: "stool", at: frameAtMs("chairs", 3) },
      { cue: "stool", at: frameAtMs("chairs", 4) },
    ]);
    // Every cue, and the swirl's "storm", has one of his sounds.
    const map = BOSS_INTROS.bigboy!.cues;
    for (const c of [...new Set(cues.map((x) => x.cue)), "storm"]) expect(map[c], c).toMatch(/^bigboy[A-Z]/);
  });

  it("his attack: after the table's beat, swung for swingMs until the swirl has covered the screen", () => {
    const a = attackStart(beats);
    expect(a).toBe(beat("swing").at);
    expect(a).toBe(beat("table").end);
    expect(introLength(beats) + F.stormInMs - a).toBe(F.swingMs);
  });
});

describe("the intro's timeline (Timber's log, Nov 3)", () => {
  const T = TIMBER;
  const beats = introBeats(T);
  const at = (t: number) => introAt(beats, T, t);
  const F = CHALLENGE_FEEL;
  const beat = (s: string) => beats.find((b) => b.step === s)!;
  const PX = TOWN_FEEL.housePxPerSquare;

  it("the art: his moves (walk 6, lift 6, carry 6, setDown 5, gnaw 8, done 6) facing east, the log's gnawing 6, the fog's rise 8, hold 4 and settle 10, a stump's pop 6; the log stands about a square in front of him as he works; his table the park table's geometry, its stumps apart; the sweep tiles as Alfil's", () => {
    expect(isLog(T)).toBe(true);
    expect(Object.fromEntries(Object.entries(T.moves).map(([k, v]) => [k, v.length]))).toEqual({ walk: 6, lift: 6, carry: 6, setDown: 5, gnaw: 8, done: 6 });
    expect(Object.fromEntries(Object.entries(T.props).map(([k, v]) => [k, v.length]))).toEqual({ gnawed: 6, rise: 8, hold: 4, settle: 10, pop: 6 });
    // (TIMBER_INTRO_REACH: 34 of his pixels east of his foot, his town size: about 1.16 squares; his dusting off steps him 3 back.)
    expect(T.reach).toBeCloseTo(34 / TIMBER_PER_SQ);
    expect(T.reach).toBeGreaterThan(1);
    expect(T.reach).toBeLessThan(1.3);
    expect(T.back).toBeCloseTo(3 / TIMBER_PER_SQ);
    // He lifts the log at his feet (TIMBER_INTRO_LIFT_AT: straight under him), so he walks to its place.
    expect(TIMBER_INTRO_LIFT_AT[0]).toBe(0);
    expect([INTRO_TIMBER_TABLE.w, INTRO_TIMBER_TABLE.foot[0], INTRO_TIMBER_TABLE.foot[1]]).toEqual([PARK_TABLE.w, PARK_TABLE.foot[0], PARK_TABLE.foot[1]]);
    expect(INTRO_TIMBER_SHAVINGS.foot[1] - INTRO_TIMBER_SHAVINGS.h).toBeLessThan(0);
    expect(INTRO_TIMBER_TABLE_PALETTE).toMatchObject({ L: "#efcf94", D: "#94603a" });
    for (const k of ["1", "2", "4", "L", "D"]) expect(INTRO_TIMBER_TABLE_PALETTE[k], k).toMatch(/^#[0-9a-f]{6}$/);
    expect([INTRO_TIMBER_STORM.w, INTRO_TIMBER_STORM.h, INTRO_TIMBER_FRONT.w, INTRO_TIMBER_FRONT.h]).toEqual([128, 128, 48, 128]);
  });

  it("the fog's frames are the art's pixel for pixel (shops/timber-intro-art.ts's one change, for its load time, keeps them: a new copy of the art updates this hash)", async () => {
    const { createHash } = await import("node:crypto");
    const h = createHash("sha1");
    const ch = INTRO_TIMBER_SHAVINGS;
    for (const a of ["rise", "hold", "settle"]) for (const fr of ch.anims[a]!.frames) h.update(renderFrame(ch, fr).data);
    expect(h.digest("hex")).toBe("08f46ae00df09d803befa210bbb54db0e5c6b702");
  });

  it("his room's marks are the timeline's: his `standOff` from the table's middle, his clear place `log.clear`; the log lies west of his mark, clear of it and on the circle's floor", () => {
    const m = marksOf(SHOP_TIMBER_LAYOUT, "across", SHOP_TIMBER_MARKS, marksFeel(T))!;
    expect(m.table.c - m.boss.c).toBe(F.standOff.across);
    expect(m.table.c - m.bossClear.c).toBeCloseTo(F.log.clear);
    // (His own clear place, a touch further out than the others': every other boss's stays `clear.boss`.)
    expect(F.log.clear).toBeGreaterThanOrEqual(F.clear.boss);
    expect(marksFeel(ALFIL)).toBe(F);
    expect(marksFeel(null)).toBe(F);
    expect(F.log.at).toBeGreaterThan(F.standOff.across);
    // (The log lies a whole square and more past his mark; it's 64 of his pixels long, half of it each side of its middle.)
    const half = 32 / TIMBER_PER_SQ;
    expect(m.table.c - F.log.at + half).toBeLessThan(m.boss.c - 0.3);
    expect(m.table.c - F.log.at - half).toBeGreaterThan(0);
    // He works where the log he sets down stands on the table's place: his reach west of it, between his mark and the table.
    expect(m.table.c - T.reach).toBeGreaterThan(m.boss.c);
    expect(m.table.c - T.reach).toBeLessThan(m.table.c);
    const w = logWalks(T);
    expect(w.toLog).toBeCloseTo(F.log.at - F.standOff.across);
    expect(w.carry).toBeCloseTo(F.log.at - T.reach);
    expect(w.toMark).toBeGreaterThan(0);
  });

  it("the beats in order, each from where the last ended: facing each other, his line, to the log, the heave, the carry, the set-down, the gnaw, the fog's rise, hold and settle, the stumps' pop, his dusting off, to his place, his attack; then the sweep. About 12 s (Eric's target): 11 to 13", () => {
    expect(beats.map((b) => b.step)).toEqual(["face", "line", "toLog", "lift", "carry", "setDown", "gnaw", "rise", "hold", "settle", "pop", "dust", "toMark", "swing", "done"]);
    for (let i = 1; i < beats.length; i++) expect(beats[i]!.at, beats[i]!.step).toBe(beats[i - 1]!.end);
    for (const b of beats.slice(0, -1)) expect(b.end, b.step).toBeGreaterThan(b.at);
    expect(introLength(beats)).toBeGreaterThanOrEqual(11_000);
    expect(introLength(beats)).toBeLessThanOrEqual(13_000);
    // Every beat a number: the feel's, or the art's frames.
    const sum = (ms: readonly number[]) => ms.reduce((x, y) => x + y, 0);
    const len = (s: string) => beat(s).end - beat(s).at;
    expect(len("face")).toBe(F.faceMs);
    expect(len("line")).toBe(F.log.lineLeadMs);
    expect(len("toLog")).toBe(Math.round((F.log.at - F.standOff.across) * F.log.walkMs));
    expect(beats.every((b) => Number.isInteger(b.at))).toBe(true);
    expect(len("lift")).toBeCloseTo(sum(T.moves.lift));
    expect(len("carry")).toBe(Math.round((F.log.at - T.reach) * F.log.carryMs));
    expect(len("setDown")).toBeCloseTo(sum(T.moves.setDown));
    expect(len("gnaw")).toBeCloseTo(sum(T.props.gnawed));
    expect(len("rise")).toBeCloseTo(sum(T.props.rise));
    expect(len("hold")).toBeCloseTo(F.log.holdMs);
    expect(len("settle")).toBeCloseTo(sum(T.props.settle));
    expect(len("pop")).toBeCloseTo(sum(T.props.pop));
    expect(len("dust")).toBeCloseTo(sum(T.moves.done));
    expect(len("toMark")).toBe(Math.round((F.log.clear - T.reach - T.back) * F.log.walkMs));
    expect(len("swing")).toBeCloseTo(F.swingMs - F.stormInMs);
  });

  it("his line: in the bubble for its whole `lineMs` from its beat, riding his head as he sets off for the log", () => {
    const l = beat("line").at;
    expect(at(l - 1).line).toBe(false);
    expect(at(l).line).toBe(true);
    expect(at(l + F.lineMs - 1).line).toBe(true);
    expect(at(l + F.lineMs - 1).step).not.toBe("line");
    expect(at(l + F.lineMs).line).toBe(false);
    expect(F.lineMs).toBeLessThan(beat("carry").end - l);
  });

  it("where he is and how he faces: his town figure on his mark for the line's lead; walking west (mirrored) to the log; facing east (the art's way) to heave, carry, set down, gnaw and dust off; west again to his place; his town figure there to swing", () => {
    const w = (t: number) => woodAt(beats, T, t);
    expect(w(beat("line").at)).toMatchObject({ move: null, from: "mark", to: "mark" });
    expect(w(beat("toLog").at + 1)).toMatchObject({ move: { anim: "walk", flip: true }, from: "mark", to: "log" });
    expect(w((beat("toLog").at + beat("toLog").end) / 2).u).toBeCloseTo(0.5, 1);
    expect(w(beat("lift").at)).toMatchObject({ move: { anim: "lift", frame: 0, flip: false }, from: "log", to: "log" });
    expect(w(beat("carry").at + 1)).toMatchObject({ move: { anim: "carry", flip: false }, from: "log", to: "work" });
    expect(w(beat("carry").end - 1).u).toBeGreaterThan(0.99);
    for (const s of ["setDown", "gnaw", "rise", "hold", "settle", "pop", "dust"]) expect(w(beat(s).at), s).toMatchObject({ from: "work", to: "work", move: { flip: false } });
    expect(w(beat("gnaw").at).move?.anim).toBe("gnaw");
    expect(w(beat("rise").at).move?.anim).toBe("gnaw");
    expect(w(beat("hold").at).move?.anim).toBe("idle");
    expect(w(beat("dust").at).move?.anim).toBe("done");
    expect(w(beat("toMark").at + 1)).toMatchObject({ move: { anim: "walk", flip: true }, from: "stepped", to: "clear" });
    expect(w(beat("swing").at)).toMatchObject({ move: null, from: "clear", to: "clear" });
    // His attack starts on his place, once he's there.
    expect(attackStart(beats)).toBe(beat("toMark").end);
  });

  it("the log: lying on the floor from the walk in, hidden the moment the heave starts (it's in his paws, his own frames); standing in front of him from the set-down's last frame (the first without it in his paws); gnawed through the gnaw and the fog's rise; gone under the fog's hold", () => {
    const w = (t: number) => woodAt(beats, T, t);
    expect(w(0).log).toEqual({ anim: "lying", frame: 0 });
    expect(w(beat("lift").at - 1).log).toEqual({ anim: "lying", frame: 0 });
    expect(w(beat("lift").at).log).toBeNull();
    expect(w(beat("carry").at + 1).log).toBeNull();
    const sd = beat("setDown").at;
    const lastAt = sd + T.moves.setDown.slice(0, -1).reduce((x, y) => x + y, 0);
    expect(w(lastAt - 1).log).toBeNull();
    expect(w(lastAt).log).toEqual({ anim: "standing", frame: 0 });
    expect(w(beat("gnaw").at).log).toEqual({ anim: "gnawed", frame: 0 });
    expect(w(beat("gnaw").end - 1).log).toEqual({ anim: "gnawed", frame: 5 });
    expect(w(beat("rise").at).log).toEqual({ anim: "gnawed", frame: 5 });
    expect(w(beat("hold").at).log).toBeNull();
    for (let t = beat("hold").at; t < introLength(beats) + 1000; t += 50) expect(w(t).log, `${t}`).toBeNull();
  });

  it("the table and stumps are swapped in under the fog's hold, never visible before: the table from the hold's first frame (the fog covering it until it settles), the stumps popping up once it has settled; its last frame (the ring of shavings) kept to the sweep", () => {
    for (let t = 0; t < beat("hold").at; t += 10) {
      const n = at(t);
      expect(n.table, `${t}`).toBe(false);
      expect(n.stools, `${t}`).toBe(false);
      expect(n.wood!.stumps, `${t}`).toBeNull();
    }
    for (let t = beat("hold").at; t < beat("pop").at; t += 10) {
      const n = at(t);
      expect(n.table, `${t}`).toBe(true);
      expect(n.wood!.fog, `${t}: the fog over it`).not.toBeNull();
      expect(n.wood!.stumps, `${t}`).toBeNull();
    }
    expect(at(beat("rise").at).wood!.fog).toEqual({ anim: "rise", frame: 0 });
    expect(at(beat("hold").at).wood!.fog).toEqual({ anim: "hold", frame: 0 });
    expect(at(beat("settle").at).wood!.fog).toEqual({ anim: "settle", frame: 0 });
    expect(at(beat("pop").at).wood).toMatchObject({ fog: null, ring: true, stumps: { anim: "pop", frame: 0 } });
    expect(at(beat("pop").at)).toMatchObject({ table: true, stools: true });
    expect(at(beat("dust").at).wood!.stumps).toEqual({ anim: "idle", frame: 0 });
    expect(at(introLength(beats) + 500).wood).toMatchObject({ ring: true, stumps: { anim: "idle" } });
    expect(hopStart(beats, T)).toBe(beat("pop").at);
  });

  it("the stumps sit at the table's foot ± 37 (the stools' places: `stoolOff` a side, a square of the room's 37 pixels), on its row; the table's middle on the drawn marks' midpoint", () => {
    const m = marksOf(SHOP_TIMBER_LAYOUT, "across", SHOP_TIMBER_MARKS)!;
    expect((m.table.c - m.bossStool.c) * PX).toBe(37);
    expect((m.youStool.c - m.table.c) * PX).toBe(37);
    expect([m.bossStool.r, m.youStool.r]).toEqual([m.table.r, m.table.r]);
    expect(m.table).toEqual({ c: 9.5, r: 10.5 });
  });

  it("every cue on his frames and the props' has a sound of his own (characters/timber-sounds.ts), on its beat: his hup as he heaves, the thump as it stands, his gnaws and chomps, the fog's clatter, saw and slide, a knock as the stumps pop, his pat and chitter; the sweep's swoosh", () => {
    const def = introOf("timber")!;
    const cues = introCues(beats, T);
    for (const c of cues) expect(def.cues[c.cue], c.cue).toMatch(/^timber[A-Z]/);
    expect(def.cues.storm).toBe("timberSwoosh");
    // (Every cue the art has, played: none left out.)
    const named = new Set(cues.map((c) => c.cue));
    for (const k of Object.keys(def.cues).filter((k) => k !== "storm")) expect(named.has(k), k).toBe(true);
    const inBeat = (cue: string, s: string) => {
      const ts = cues.filter((c) => c.cue === cue).map((c) => c.at);
      expect(ts.length, cue).toBeGreaterThan(0);
      for (const t of ts) expect(t >= beat(s).at && t < beat(s).end, `${cue} in ${s}`).toBe(true);
      return ts;
    };
    expect(inBeat("hup", "lift")).toHaveLength(1);
    expect(inBeat("thump", "setDown")).toHaveLength(1);
    expect(inBeat("gnaw", "gnaw").length + inBeat("chomp", "gnaw").length).toBeGreaterThanOrEqual(6);
    expect(inBeat("clatter", "rise")).toEqual([beat("rise").at]);
    expect(inBeat("saw", "hold")[0]).toBe(beat("hold").at);
    expect(inBeat("slide", "settle")).toEqual([beat("settle").at]);
    expect(inBeat("knock", "pop")).toHaveLength(1);
    expect(inBeat("pat", "dust")).toHaveLength(1);
    expect(inBeat("chitter", "dust")).toHaveLength(1);
    // In time order.
    expect(cues.map((c) => c.at)).toEqual([...cues.map((c) => c.at)].sort((x, y) => x - y));
  });
});

/**
 * Hollow's own intro (Nov 3; CHALLENGE_FEEL.dark): Eric's design, approved with his changes (docs/decisions/2026-11-03-hollow-intro.md):
 * nothing jumps in the dark (the table and stools in while it's still lit, you both walk on straight to your seats and stay there), a
 * channel line as he starts to charge, the light-drinking 15% faster, the rest kept as drawn, and into the match by an iris to the board.
 */
describe("the intro's timeline (Hollow's dark, Nov 3)", () => {
  const F = CHALLENGE_FEEL;
  const D = F.dark;
  const HO: DarkAnims = darkAnims({ mover: BOSS_HOLLOW_INTRO, lantern: INTRO_HOLLOW_LANTERN_OUT, tree: INTRO_HOLLOW_SHOWPIECE_OUT, glow: INTRO_HOLLOW_LANTERN_GLOW, run: INTRO_HOLLOW_BULB_RUN, dark: INTRO_HOLLOW_DARK, pool: INTRO_HOLLOW_DIMPOOL });
  const beats = introBeats(HO);
  const at = (s: IntroStep) => beats.find((b) => b.step === s)!;
  const now = (t: number) => introAt(beats, HO, t);
  const dark = (t: number) => now(t).dark!;
  const drink = at("drink").at;
  const d = drainAt();

  it("the art: his moves (charge 8, swell 4, drink 8, full 8, settle 6) in his own frame, each with its heart and ball; a lantern's going out 6 x 170 ms (its flutter on the first, its snuff on the fourth) from each sway frame; the tree's drain 10 (its run first, its star on the ninth); the string's 57 bulbs west to east", () => {
    expect(Object.fromEntries(Object.entries(HO.moves).map(([m, ms]) => [m, ms.length]))).toEqual({ charge: 8, swell: 4, drink: 8, full: 8, settle: 6 });
    expect([BOSS_HOLLOW_INTRO.w, BOSS_HOLLOW_INTRO.h, BOSS_HOLLOW_INTRO.foot]).toEqual([BOSS_ART.hollow.w, BOSS_ART.hollow.h, BOSS_ART.hollow.foot]);
    for (const m of DARK_MOVES) {
      expect(HOLLOW_INTRO_HEART[m]!.length, m).toBe(HO.moves[m].length);
      expect(HOLLOW_INTRO_BALL_R[m]!.length, m).toBe(HO.moves[m].length);
    }
    expect(HO.gutter).toEqual([170, 170, 170, 170, 170, 170]);
    expect(HO.cues.gutter).toEqual(["gutter", undefined, undefined, "snuff", undefined, undefined]);
    for (let k = 0; k < 8; k++) expect(INTRO_HOLLOW_LANTERN_OUT.anims[`gutter${k}`]!.frames.length).toBe(6);
    expect(HO.tree.length).toBe(10);
    expect(HO.cues.tree[0]).toBe("drain");
    expect(HO.cues.tree[8]).toBe("star");
    expect(HO.bulbs).toBe(57);
    // (West to east: from the corner behind the counter to the tree.)
    expect(INTRO_HOLLOW_BULB_RUN[0]).toMatchObject({ col: 2, row: 2 });
    expect(INTRO_HOLLOW_BULB_RUN[56]).toMatchObject({ col: 16, row: 6 });
    // (The swapped pieces are the intro's own: the cave's own art is never changed by them.)
    for (const [name, ch] of Object.entries(INTRO_HOLLOW_PIECES)) expect(ch, name).not.toBe(SHOP_HOLLOW_PIECES[name]);
  });

  it("the beats in order, each from where the last ended: facing each other, his line, a pause, the table popping in and standing a beat, the charge, the swell, the drink, full, the blackout, the black, the dim light, the iris; about 15 s from the marks to the board (14 to 15.5)", () => {
    expect(beats.map((b) => b.step)).toEqual(["face", "line", "pause", "pop", "table", "charge", "swell", "drink", "full", "blackout", "black", "dim", "iris", "done"]);
    for (let i = 1; i < beats.length; i++) expect(beats[i]!.at, beats[i]!.step).toBe(beats[i - 1]!.end);
    expect(beats.map((b) => b.end - b.at).slice(0, -1)).toEqual([F.faceMs, D.lineMs, F.afterLineMs, F.popMs, F.tableHoldMs, D.chargeMs, 470, d.end, D.fullMs, INTRO_HOLLOW_DARK.blackoutMs, INTRO_HOLLOW_DARK.blackMs - INTRO_HOLLOW_DARK.blackoutMs, D.dimMs, D.irisMs]);
    expect(introLength(beats)).toBeGreaterThanOrEqual(14_000);
    expect(introLength(beats)).toBeLessThanOrEqual(15_500);
    // No attack: the dark is his transition.
    expect(attackStart(beats)).toBe(Infinity);
  });

  it("the light-drinking 15% faster: every gap of the drain as drawn times 0.85 (about 5.7 s, it was 6.7); the lanterns far to near, one by one, each seen on its own; then the string, the tree, his strand, your pawn", () => {
    expect(D.pace).toBe(0.85);
    expect(at("drink").end - drink).toBe(Math.round(6740 * 0.85));
    expect(d.end).toBeGreaterThanOrEqual(5_600);
    expect(d.end).toBeLessThanOrEqual(5_800);
    expect(d.lanterns).toEqual([140, 740, 1340, 1840, 2340].map((ms) => Math.round(ms * 0.85)));
    expect(d.stringMs).toBe(Math.round(1800 * 0.85));
    // (Far to near: the back, the middle of the passage, his wall, off the right edge, the nearest last.)
    expect(D.lanterns).toEqual([[9, 5], [11, 8], [9, 11], [17, 12], [13, 16]]);
    // One by one: each starts going out only once the last has dropped from its flare (two of its frames, its light down to 0.35).
    for (let i = 1; i < 5; i++) expect(d.lanterns[i]! - d.lanterns[i - 1]!).toBeGreaterThanOrEqual(2 * 170);
    expect(d.lanterns[4]!).toBeLessThan(d.string);
    expect(d.string + d.stringMs).toBeLessThanOrEqual(d.tree);
    expect(d.tree).toBeLessThan(d.strand[0]!);
    expect(d.strand[2]!).toBeLessThan(d.pawn);
    expect(d.pawn + D.pawnMs).toBeLessThanOrEqual(d.end);
    // Each lantern's light as it goes out (the art's), each in its turn.
    for (const [i, ms] of d.lanterns.entries()) {
      expect(dark(drink + ms - 1).lanterns[i]).toEqual({ since: -1, glow: 1 });
      expect(dark(drink + ms).lanterns[i]!.glow).toBe(INTRO_HOLLOW_LANTERN_GLOW[0]);
      expect(dark(drink + ms + 1020).lanterns[i]!.glow).toBe(0);
    }
    // At the drain's end everything is out: the string's 57, the tree, his strand.
    expect(dark(at("full").at)).toMatchObject({ run: 57, tree: { out: 1 }, bulbs: 0 });
    expect(dark(at("full").at).lanterns.every((l) => l.glow === 0)).toBe(true);
  });

  it("the table and stools come in before the charge, while it's still lit (the default's pop), and stay", () => {
    expect(now(at("pop").at - 1)).toMatchObject({ table: false, stools: false });
    expect(now(at("pop").at)).toMatchObject({ table: true, stools: true });
    const lit = now(at("charge").at - 1);
    expect(lit).toMatchObject({ table: true, stools: true, pop: 1 });
    expect(lit.dark!.level).toBe(0);
    expect(introCues(beats, HO)[0]).toEqual({ cue: "table", at: at("pop").at });
  });

  it("you both walk on straight to your seats (his clear place, yours the usual) and stay there: no hop back; from the drain's start nobody moves and nothing appears, only the light changes", () => {
    const m = seatedMarks(marksOf(SHOP_HOLLOW_LAYOUT, "across", SHOP_HOLLOW_MARKS, marksFeel(null, F, introOf("hollow")!.clear))!);
    expect([m.you, m.boss]).toEqual([m.youClear, m.bossClear]);
    expect(m.you).toEqual({ c: 12.5 + F.clear.you, r: 11.5 });
    expect(m.boss.c).toBeCloseTo(12.5 - 2.92);
    // (Each walks to its seat's square, then onto it, as onto a mark; both paths clear.)
    const room = makeRoom(SHOP_HOLLOW_LAYOUT, SHOPS.hollow!.keeper, 20, SHOP_HOLLOW_FLOOR);
    expect(findPath(room, room.start, m.youSq)).not.toBeNull();
    expect(findPath(room, { c: room.start.c - 1, r: room.start.r }, m.bossSq)).not.toBeNull();
    expect(Math.abs(m.you.c - m.youSq.c)).toBeLessThan(1);
    expect(Math.abs(m.boss.c - m.bossSq.c)).toBeLessThan(1);
    expect(hopStart(beats, HO)).toBe(Infinity);
    for (let t = 0; t < introLength(beats) + 500; t += 10) {
      const n = now(t);
      expect(n.back, `${t}`).toBe(0);
      expect(n.hop, `${t}`).toBe(0);
      if (t >= drink) expect(n, `${t}`).toMatchObject({ table: true, stools: true, pop: 1, puff: -1 });
    }
  });

  it("the dark: none before the drain; it deepens with each light gone, never back; black from the blackout on (his eyes alone, two dim slits, about 0.9 s); the dim light comes up steady, then closes in on the board", () => {
    let last = 0;
    for (let t = 0; t < introLength(beats) + 500; t += 10) {
      const k = dark(t);
      expect(k.level, `${t}`).toBeGreaterThanOrEqual(last);
      last = k.level;
      if (t < drink) expect(k.level, `${t}`).toBe(0);
      if (t >= at("blackout").end) expect(k.level, `${t}`).toBe(1);
      if (t < at("blackout").at) expect(k.eyes, `${t}`).toBe(0);
      if (t >= at("dim").at + D.eyesOutMs) expect(k.eyes, `${t}`).toBe(0);
      if (t < at("dim").at) expect(k.pool, `${t}`).toBe(0);
      if (t < at("iris").at) expect(k.iris, `${t}`).toBe(0);
    }
    expect(dark(at("blackout").at - 1).level).toBeLessThan(0.7);
    expect(dark(at("black").at + 100).eyes).toBeCloseTo(INTRO_HOLLOW_DARK.eyesAlpha);
    expect(at("dim").at - at("blackout").at).toBe(INTRO_HOLLOW_DARK.blackMs);
    // (Steady: up over the art's 700 ms, then 1, no flicker or breathing.)
    for (let t = at("dim").at + INTRO_HOLLOW_DIMPOOL.inMs; t < at("iris").at; t += 10) expect(dark(t).pool).toBe(1);
    expect(dark(at("iris").end).iris).toBe(1);
    // His moves: his idle, the charge (looping), the swell, the drink (looping), full through the black, the settle in the dim light, his idle.
    const moveAt = (t: number) => dark(t).move?.anim ?? null;
    expect([at("table").at, at("charge").at, at("swell").at, drink, at("full").at, at("black").at, at("dim").at, at("iris").at].map(moveAt)).toEqual([null, "charge", "swell", "drink", "full", "full", "settle", null]);
    // Your tag fades as the drain starts.
    expect(dark(drink - 1).tag).toBe(1);
    expect(dark(drink + D.tagMs).tag).toBe(0);
    // The cave's lights: as always without an intro (and so when you come back from the match); all out from the blackout on.
    for (const role of [{ lantern: 0 }, { out: 0, of: 4, backdrop: false }, "tree", null] as const) {
      expect(caveLight(null, role)).toBe(1);
      expect(caveLight(dark(at("blackout").end), role)).toBe(0);
    }
    expect(caveLight(dark(drink + d.string + 200), { out: 1, of: 16, backdrop: true })).toBe(0);
    expect(caveLight(dark(drink + d.string + 200), { out: 1, of: 4, backdrop: false })).toBeCloseTo(0.75);
  });

  it("his channel line: one of his four, at random each time, over his head from the charge's start for chantMs (his entrance line stays at the walk-on)", () => {
    const def = introOf("hollow")!;
    expect(def.chant).toEqual(["The dark is misunderstood.", "It's not the dark you fear. It's not knowing what's in it.", "Shh. The dark never hurt anyone.", "Nobody ever asks the dark how it feels."]);
    expect([0, 0.3, 0.6, 0.99].map((r) => chantOf(def, () => r))).toEqual(def.chant);
    for (let i = 0; i < 20; i++) expect(def.chant).toContain(chantOf(def));
    expect(chantOf(introOf("tiger")!)).toBeNull();
    expect(now(at("line").at)).toMatchObject({ line: true, chant: false });
    expect(now(at("charge").at - 1)).toMatchObject({ line: false, chant: false });
    expect(now(at("charge").at)).toMatchObject({ line: false, chant: true });
    expect(now(at("charge").at + D.chantMs - 1).chant).toBe(true);
    expect(now(at("charge").at + D.chantMs).chant).toBe(false);
    expect(D.chantMs).toBeGreaterThanOrEqual(F.lineMs);
    // (Off his head before the first lantern goes.)
    expect(at("charge").at + D.chantMs).toBeLessThanOrEqual(drink + d.lanterns[0]!);
  });

  it("every cue has a sound of his own (the table's the app's pop), each on its beat, in order; the notes' cues all there", () => {
    const def = introOf("hollow")!;
    const cues = introCues(beats, HO);
    for (const c of cues) expect(def.cues[c.cue], c.cue).toMatch(/^(hollow[A-Z]\w+|pop)$/);
    for (let i = 1; i < cues.length; i++) expect(cues[i]!.at).toBeGreaterThanOrEqual(cues[i - 1]!.at);
    const names = new Set(cues.map((c) => c.cue));
    // (Every cue in the art's notes; a mote's sip is the room's, as one lands.)
    for (const c of ["table", "hum", "deep", "swell", "gutter", "snuff", "drain", "tink", "star", "pawn", "blackout", "settle"]) expect(names.has(c), c).toBe(true);
    expect(def.cues.sip).toBe("hollowSip");
    // Each lantern's flutter as it starts going out, its snuff three frames on.
    for (const ms of d.lanterns) {
      expect(cues).toContainEqual({ cue: "gutter", at: drink + ms });
      expect(cues).toContainEqual({ cue: "snuff", at: drink + ms + 3 * 170 });
    }
    // The ticks along the string: at most one a tinkGapMs.
    const ticks = cues.filter((c) => c.cue === "tink").map((c) => c.at);
    for (let i = 1; i < ticks.length; i++) expect(ticks[i]! - ticks[i - 1]!).toBeGreaterThanOrEqual(D.tinkGapMs);
    // Nothing sounds in the black but the blackout's thoom; the settle in the dim light.
    expect(cues.filter((c) => c.at > at("blackout").at && c.at < at("dim").at)).toEqual([]);
    expect(cues).toContainEqual({ cue: "settle", at: at("dim").at });
  });
});

describe("the storm's edge", () => {
  it("in: from its front just off the left to just off the right (covered); out: from covered to its front off the right", () => {
    const w = 390;
    const fw = 144;
    expect(stormEdge("in", 0, 600, w, fw)).toBe(-fw);
    expect(stormEdge("in", 600, 600, w, fw)).toBe(w);
    expect(stormEdge("in", 900, 600, w, fw)).toBe(w);
    expect(stormEdge("out", 0, 600, w, fw)).toBe(0);
    expect(stormEdge("out", 600, 600, w, fw)).toBe(w + fw);
    expect(stormEdge("out", 300, 600, w, fw)).toBeCloseTo((w + fw) / 2);
  });
});

describe("back to the town", () => {
  it("you start where you stood as you challenged, facing the same way; with nothing to come back to, at the usual start", () => {
    const w = new Walker({ c: 23, r: 40 }, 90, true);
    w.facing = -1;
    w.view = 1;
    const stand = standOf(w);
    expect(stand).toEqual({ c: 23, r: 40, facing: -1, view: 1 });
    const t = createTown(0, undefined, null, TOWN_FEEL.botsOut, stand);
    expect(t.you.walker.here()).toEqual({ c: 23, r: 40 });
    expect([t.you.walker.facing, t.you.walker.view]).toEqual([-1, 1]);
    expect(t.you.sit).toBe(false);
    expect(createTown(0).you.walker.here()).toEqual(START);
  });

  it("where you stood is the square you were on or stepping onto as you tapped (mid-walk too)", () => {
    const w = new Walker({ c: 5, r: 5 }, 90, true);
    w.go([{ c: 6, r: 5 }, { c: 7, r: 5 }]);
    w.update(0);
    expect(standOf(w)).toMatchObject({ c: 6, r: 5 });
  });
});

describe("the boss's attack in its intro (its God King attack)", () => {
  const beats = introBeats(ALFIL);
  const beat = { lashAt: 560, leaveAt: 2380 };

  it("starts after the table's beat, swingMs before the storm has covered the screen, and keeps on until the battle shows", () => {
    const at = attackStart(beats);
    expect(at).toBe(beats.find((b) => b.step === "swing")!.at);
    expect(introLength(beats) + coverMs(true) - at).toBe(CHALLENGE_FEEL.swingMs);
    expect(introAt(beats, ALFIL, at)).toMatchObject({ step: "swing", table: true, stools: true, back: 1 });
    expect(attackTime(0, beat)).toBe(0);
    expect(attackTime(1000, beat)).toBe(1000);
    // (Where it would leap off, its lashes again, over and over.)
    expect(attackTime(2380, beat)).toBe(560);
    expect(attackTime(2380 + 1820 + 10, beat)).toBe(570);
  });

  it("Alfil's kit has one (every playable boss's does, Timber's too since Nov 2)", async () => {
    const { bossKit } = await import("../src/characters/kits.ts");
    expect(bossKit(introOf("alfil")!.name)?.kingAttack).toBeDefined();
  });
});

describe("the default intro (Babur's and Puddles')", () => {
  const beats = introBeats(null);
  const at = (t: number) => introAt(beats, null, t);
  const F = CHALLENGE_FEEL;

  it("facing each other, the line alone, a pause, the table pops in, the table alone, then the attack swung in place; then done (the flash and the wipe)", () => {
    expect(beats.map((b) => b.step)).toEqual(["face", "line", "pause", "pop", "table", "swing", "done"]);
    const beat = (s: string) => beats.find((b) => b.step === s)!;
    expect(beat("line")).toMatchObject({ at: F.faceMs, end: F.faceMs + F.lineMs });
    expect(beat("pop").end - beat("pop").at).toBe(F.popMs);
    expect(beat("table").end - beat("table").at).toBe(F.tableHoldMs);
    // A couple of seconds of swinging before the screen is covered (Eric: "just be swinging for a few seconds").
    expect(introLength(beats) + coverMs(false) - attackStart(beats)).toBe(F.swingMs);
    expect(F.swingMs).toBeGreaterThanOrEqual(1500);
    expect(F.swingMs).toBeLessThanOrEqual(3500);
  });

  it("the table pops in after the line and its pause (growing past its size and back), a dust puff round its foot; no pyramid", () => {
    const pop = beats.find((b) => b.step === "pop")!.at;
    expect(at(F.faceMs)).toMatchObject({ step: "line", line: true, table: false, pyramid: null, puff: -1 });
    expect(at(pop - 1)).toMatchObject({ step: "pause", line: false, table: false });
    expect(at(pop)).toMatchObject({ table: true, puff: 0 });
    expect(at(pop).pop).toBeCloseTo(0);
    const mid = at(pop + F.popMs * 0.7);
    expect(mid.pop).toBeGreaterThan(1);
    expect(at(pop + F.popMs).pop).toBeCloseTo(1);
    expect(at(pop + F.puffMs).puff).toBe(-1);
    // It swings with the table in.
    expect(at(attackStart(beats))).toMatchObject({ step: "swing", line: false, table: true, pop: 1, pyramid: null });
    expect(at(introLength(beats))).toMatchObject({ step: "done", table: true });
    expect(introCues(beats, null)).toEqual([{ cue: "table", at: pop }]);
  });

  it("its attack starts as it swings, in place: its lashes only, from the first, over and over (no drop-in, no leap off)", () => {
    const beat = { lashAt: 560, leaveAt: 2380 };
    expect(attackStart(beats)).toBe(beats.find((b) => b.step === "swing")!.at);
    expect(attackTime(0, beat, true)).toBe(560);
    expect(attackTime(1000, beat, true)).toBe(1560);
    expect(attackTime(1820, beat, true)).toBe(560);
    // (Every intro swings it in place since Nov 2's pacing, each boss standing clear of its stool; played at a king, its drop-in first.)
    expect(attackTime(0, beat)).toBe(0);
  });

  it("the cues: the app's pop as the table appears and the boss's own whoosh as the screen flashes", () => {
    expect(introOf("tiger")!.cues).toEqual({ table: "pop", wipe: "tigerWhoosh" });
    expect(introOf("gardener")!.cues).toEqual({ table: "pop", wipe: "gardenerWhoosh" });
  });

  it("Babur's and Puddles' kits have their attacks", async () => {
    const { bossKit } = await import("../src/characters/kits.ts");
    for (const id of ["tiger", "gardener"] as const) expect(bossKit(introOf(id)!.name)?.kingAttack, id).toBeDefined();
  });
});

describe("the default transition: a flash, then a wipe to black", () => {
  const F = CHALLENGE_FEEL;
  it("flashes white on and off, `flashes` times, then wipes in from nothing to covered, and stays covered", () => {
    const on = Array.from({ length: F.flashes * 2 }, (_, i) => wipeAt(((i + 0.5) / (F.flashes * 2)) * F.flashMs).flash);
    expect(on).toEqual(Array.from({ length: F.flashes * 2 }, (_, i) => (i % 2 === 0 ? 1 : 0)));
    expect(wipeAt(F.flashMs)).toEqual({ flash: 0, wipe: 0 });
    expect(wipeAt(F.flashMs + F.wipeMs / 2).wipe).toBeCloseTo(0.5);
    expect(wipeAt(F.flashMs + F.wipeMs).wipe).toBe(1);
    expect(wipeAt(F.flashMs + F.wipeMs + 5000).wipe).toBe(1);
  });
});


/**
 * The pacing (Eric, Nov 2, after Big Boy's live: "it happens so damn fast… It takes only, like, 2 seconds… Stretch that out a few more
 * seconds"): the whole challenge, from Fight to the screen covered, beat by beat; and standing clear of the stools ("Make sure
 * they're not standing where the chair blocks are; that looks like bad design").
 */
describe("the challenge's pacing (Nov 2)", () => {
  const F = CHALLENGE_FEEL;
  const BB = blocksOf();
  /** From Fight to covered, ms: the walk to the door (`door` squares), the zoom in, a beat inside, the walk up (`walk` squares, the rooms' 7), the settle, the intro, the cover. */
  const whole = (beats: IntroBeat[], custom: boolean, door = 3, walk = 7): number =>
    door * F.doorStepMs + SHOP_FEEL.doorZoomMs + F.insideMs + walk * F.walkStepMs + F.settleMs + introLength(beats) + coverMs(custom);

  it("about 10 to 12 s from Fight to the cover (it was about 5 to 6): Big Boy's and Alfil's 11 to 12.5, the default's (the fewest steps) 8.5 to 11", () => {
    expect(whole(introBeats(BB), true)).toBeGreaterThanOrEqual(11_000);
    expect(whole(introBeats(BB), true)).toBeLessThanOrEqual(12_500);
    expect(whole(introBeats(ALFIL), true)).toBeGreaterThanOrEqual(11_000);
    expect(whole(introBeats(ALFIL), true)).toBeLessThanOrEqual(12_500);
    expect(whole(introBeats(null), false)).toBeGreaterThanOrEqual(8_500);
    expect(whole(introBeats(null), false)).toBeLessThanOrEqual(11_000);
  });

  it("each beat: a calm walk (the town's walking pace, slower in the room), the line long enough to read, a small gap between steps, a couple of seconds' swing", () => {
    expect(F.doorStepMs).toBe(TOWN_FEEL.botStepMs);
    expect(F.doorStepMs).toBeGreaterThan(TOWN_FEEL.youStepMs);
    expect(F.walkStepMs).toBeGreaterThanOrEqual(150);
    expect(F.lineMs).toBeGreaterThanOrEqual(2400);
    for (const ms of [F.faceMs, F.afterLineMs, F.gapMs, F.tableHoldMs, F.holdMs]) {
      expect(ms).toBeGreaterThanOrEqual(250);
      expect(ms).toBeLessThanOrEqual(800);
    }
    expect(F.swingMs).toBe(2000);
  });

  it("the hop back: as the stools come in (the default's pop, Big Boy's stools dropping, Alfil's table showing, Timber's stumps popping up), over hopMs, up and down again", () => {
    for (const a of [null, BB, ALFIL, TIMBER] as const) {
      const beats = introBeats(a);
      const h = hopStart(beats, a);
      const at = (t: number) => introAt(beats, a, t);
      expect(at(h - 1)).toMatchObject({ back: 0, hop: 0 });
      expect(at(h - 1).stools).toBe(false);
      expect(at(h).stools).toBe(true);
      expect(at(h + F.hopMs / 2).back).toBeCloseTo(0.5);
      expect(at(h + F.hopMs / 2).hop).toBeCloseTo(1);
      expect(at(h + F.hopMs)).toMatchObject({ back: 1, hop: 0 });
      // Landed before the attack starts.
      expect(h + F.hopMs).toBeLessThanOrEqual(attackStart(beats));
    }
  });

  /** A picture's drawn pixels' columns (from its foot, art pixels) in its rows from its foot up `up` art pixels: [left, right]. */
  const low = (ch: Character, anim: string, up: number): [number, number] => {
    let x0 = Infinity;
    let x1 = -Infinity;
    for (const fr of ch.anims[anim]!.frames) {
      const f = renderFrame(ch, fr);
      for (let y = Math.max(0, Math.floor(ch.foot[1] - up)); y < f.h; y++)
        for (let x = 0; x < f.w; x++) if (f.data[(y * f.w + x) * 4 + 3]! > 0) [x0, x1] = [Math.min(x0, x - ch.foot[0]), Math.max(x1, x - ch.foot[0])];
    }
    return [x0, x1];
  };
  const PX = TOWN_FEEL.housePxPerSquare;
  /** A table picture's stools (squares from its foot): how far out each stool's outer edge is, and its top. */
  const stools = (ch: Character) => {
    const [l, r] = low(ch, "idle", ch.h);
    return { west: -l / PX, east: (r + 1) / PX, top: (ch.foot[1] - topOf(ch)) / PX };
  };
  const topOf = (ch: Character) => {
    const f = renderFrame(ch, ch.anims.idle!.frames[0]!);
    for (let y = 0; y < f.h; y++) for (let x = 0; x < ch.foot[0] - PX / 2; x++) if (f.data[(y * f.w + x) * 4 + 3]! > 0) return y;
    return ch.foot[1];
  };
  const TABLES = { alfil: INTRO_ALFIL_TABLE, tiger: PARK_TABLE, gardener: PARK_TABLE, bigboy: INTRO_BIGBOY_BLOCKS, hollow: PARK_TABLE } as const;
  /** Dash's shoe-box stools (his table has none in its picture, Nov 5): one `stoolOff` from the table's middle each side; their outer edges, and their seat. */
  const shoeBoxes = () => {
    const [l, r] = low(INTRO_BLITZ_STOOL, "idle", INTRO_BLITZ_STOOL.h);
    return { west: F.stoolOff - l / PX, east: F.stoolOff + (r + 1) / PX, top: INTRO_BLITZ_STOOL_SEAT_H / PX };
  };
  /** Wrangler's buckets (his stools, upside down: their `stool`), one `stoolOff` from the table's middle each side; their outer edges, and their seat. */
  const buckets = () => {
    const [l] = low(INTRO_PIG_BUCKET_B, "stool", INTRO_PIG_BUCKET_B.h);
    const [, r] = low(INTRO_PIG_BUCKET_W, "stool", INTRO_PIG_BUCKET_W.h);
    return { west: F.stoolOff - l / PX, east: F.stoolOff + (r + 1) / PX, top: INTRO_PIG_BUCKET_SEAT_H / PX };
  };
  /** Timber's stumps (his table has none in its picture): one `stoolOff` from the table's middle each side; how far out its outer edge is, and its top. */
  const stumps = () => {
    const [l, r] = low(INTRO_TIMBER_STUMP, "idle", INTRO_TIMBER_STUMP.h);
    return { west: F.stoolOff - l / PX, east: F.stoolOff + (r + 1) / PX, top: INTRO_TIMBER_STUMP_SEAT_H / PX };
  };
  const LAYOUTS = { alfil: SHOP_ALFIL_LAYOUT, tiger: SHOP_BABUR_LAYOUT, gardener: SHOP_PUDDLES_LAYOUT, bigboy: SHOP_BIGBOY_LAYOUT, timber: SHOP_TIMBER_LAYOUT, dash: SHOP_BLITZ_LAYOUT, hollow: SHOP_HOLLOW_LAYOUT, pig: SHOP_PIG_LAYOUT } as const;
  /** The gap (squares) kept between a figure near the floor and the stool's outer edge. */
  const GAP = 0.1;

  it("once the stools are in, no figure near the floor is in front of a stool: you (the pawn) and each boss standing, and its attack's feet", () => {
    for (const id of ["alfil", "tiger", "gardener", "bigboy", "timber", "dash", "hollow", "pig"] as const) {
      // (Timber's clear place his own, from his log intro; Hollow's his own, BOSS_INTROS' `clear`: his lash reaches
      // further.)
      const m = marksOf(LAYOUTS[id], "across", id === "pig" ? SHOP_PIG_MARKS : null, id === "timber" ? marksFeel(TIMBER) : marksFeel(null, F, introOf(id)!.clear))!;
      const st = id === "timber" ? stumps() : id === "pig" ? buckets() : id === "dash" ? shoeBoxes() : stools(TABLES[id]);
      // (The stools' outer edges, in the room's columns: the boss's west of the table, yours east; up to their tops.)
      const bossEdge = m.table.c - st.west;
      const youEdge = m.table.c + st.east;
      const band = st.top + 0.1;
      // The boss, facing you (east): its town figure as ShopRoom draws it (mirrored when its art faces left), `bossSquares` tall.
      const ch = BOSS_ART[id];
      const k = (TOWN_FEEL.bossSquares * (TOWN_FEEL.bossScale[id] ?? 1)) / ch.h;
      const kit = bossKit(introOf(id)!.name)!;
      const toward = ([l, r]: [number, number], left: boolean) => (left ? -l : r);
      // (A boss without a God King attack, Dash: facing as its intro says, ShopRoom's `facesLeft`.)
      const body = toward(low(ch, "idle", band / k), !!(kit.kingAttack ? kit.kingAttack.facesLeft : introOf(id)!.facesLeft)) * k;
      // (Wrangler's town figure is mirrored only walking in: in his intro he stands as drawn, below.)
      if (id !== "pig") expect(m.bossClear.c + body, `${id}: the boss's front near the floor, west of its stool`).toBeLessThanOrEqual(bossEdge - GAP);
      // (Wrangler: in his intro his figure and his moves as drawn, not mirrored; from the double yank on, once the buckets land.)
      if (id === "pig") {
        expect(m.bossClear.c + low(ch, "idle", band / k)[1] * k, "pig: his idle as drawn").toBeLessThanOrEqual(bossEdge - GAP);
        for (const a of ["doubleYank", "brag"]) expect(m.bossClear.c + low(BOSS_PIG_INTRO, a, band / k)[1] * k, `pig: his ${a}`).toBeLessThanOrEqual(bossEdge - GAP);
      }
      // Its attack, swung where it stands: its feet (the lowest 0.3 of a square) clear of the stool too. (Dash has none: he stands.)
      const ka = kit.kingAttack;
      expect(!!ka, `${id} has a God King attack`).toBe(id !== "dash");
      // (Wrangler's lasso lashes the floor nearly two squares out in front of him (0.95 at its rope's crack, 1.94 at its lash): clear
      // of his bucket he'd stand 3.5 squares out, his spin off a phone's left edge (Eric, Nov 4: sprites always on screen). He stands
      // at the usual place, his feet and all of him standing clear of it; only the swung rope crosses over it. Nov 4, Eric to confirm.)
      if (ka && id !== "pig") {
        const feet = toward(low(ka.ch, ka.anim, 0.3 / k), !!ka.facesLeft) * k;
        expect(m.bossClear.c + feet, `${id}: its attack's feet`).toBeLessThanOrEqual(bossEdge - GAP);
      }
      // You: the plain pawn (its base, from PAWN_PATH, `youSquares` tall), facing the boss (west).
      const [, x0, x1] = /([\d.]+),39\.5 H ([\d.]+)/.exec(PAWN_PATH)!.map(Number);
      const half = (((x1! - x0!) / 2) * TOWN_FEEL.youSquares) / 45;
      expect(m.youClear.c - half, `${id}: you, east of your stool`).toBeGreaterThanOrEqual(youEdge + GAP);
      // On the marks (walking in and the line) the stools aren't there yet; the hop takes each from its mark out, never in.
      expect(m.youClear.c).toBeGreaterThan(m.you.c);
      expect(m.bossClear.c).toBeLessThan(m.boss.c);
    }
  });
});
