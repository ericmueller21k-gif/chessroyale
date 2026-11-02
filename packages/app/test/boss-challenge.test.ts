import { describe, expect, it } from "vitest";
import { INTRO_ALFIL_PYRAMID } from "../src/town/shops/alfil-intro-art.ts";
import { SHOP_ALFIL_LAYOUT } from "../src/town/shops/alfil-art.ts";
import { SHOP_BABUR_LAYOUT } from "../src/town/shops/babur-art.ts";
import { SHOP_PUDDLES_LAYOUT } from "../src/town/shops/puddles-art.ts";
import { CHALLENGE_FEEL, attackStart, attackTime, boardSquare, frameAt, introAt, introBeats, introCues, introLength, introOf, marksOf, nextFlow, stormEdge, wipeAt, type ChallengeEvent, type ChallengeFlow, type IntroAnims } from "../src/town/shops/challenge.ts";
import { PARK_TABLE } from "../src/town/houses/park.ts";
import { INTRO_ALFIL_TABLE } from "../src/town/shops/alfil-intro-art.ts";
import { findPath, makeRoom } from "../src/town/shops/room.ts";
import { SHOPS } from "../src/town/shops/shops.ts";
import { HOMES, START, Walker, createTown, standOf } from "../src/town/world.ts";
import { TOWN_FEEL } from "../src/town/feel.ts";

/**
 * A boss challenged from the town, Pokémon-gym style (Nov 2; town/shops/challenge.ts): the flow from the card's Fight to the battle,
 * the battle circle's marks, the intro's timeline on Alfil's own art, the storm's edge, and coming back to where you stood. Round 2
 * (Nov 2): the layouts (across: the boss on the left, you on the right), the table's stools and board turned to them, and the default
 * intro (Babur's and Puddles': the table pops in, the attack swung in place, a flash and a wipe).
 */
const ms = (a: "rise" | "idle" | "crack" | "crumble") => INTRO_ALFIL_PYRAMID.anims[a]!.frames.map((f) => f.ms);
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

  it("every boss whose home has an inside has an intro (Alfil his own, Babur and Puddles the default); every other boss is challenged as before (the Boss raid screen)", () => {
    const withIntro = HOMES.filter((h) => introOf(h.id)).map((h) => h.id).sort();
    expect(withIntro).toEqual(["alfil", "gardener", "tiger"]);
    expect(withIntro).toEqual(Object.keys(SHOPS).sort());
    expect(introOf("alfil")).toMatchObject({ custom: true, line: "I'll show you the power of the old piece." });
    expect(introOf("tiger")).toMatchObject({ custom: false, name: "Babur", line: "Fine. One more show. Then I'm on break." });
    expect(introOf("gardener")).toMatchObject({ custom: false, name: "Puddles", line: "Wipe your feet. Then let's see what grows." });
    expect(introOf("hollow")).toBeNull();
  });

  it("the layout: across for all three today (the boss on the left, you on the right: Eric's normal look)", () => {
    for (const id of ["alfil", "tiger", "gardener"] as const) expect(introOf(id)!.layout, id).toBe("across");
  });
});

describe("the battle circle's marks", () => {
  const ROOMS = { alfil: SHOP_ALFIL_LAYOUT, tiger: SHOP_BABUR_LAYOUT, gardener: SHOP_PUDDLES_LAYOUT } as const;

  it("across: the boss west of the table, you east, all on the circle's middle row; each a square and a half out, just past its stool", () => {
    for (const [id, layout] of Object.entries(ROOMS)) {
      const m = marksOf(layout, "across")!;
      expect(m.table, id).toEqual({ c: 9.5, r: 10.5 });
      expect(m.boss, id).toEqual({ c: 8, r: 10.5 });
      expect(m.you, id).toEqual({ c: 11, r: 10.5 });
      // (Each walks to its mark's south square, then the last half square north onto its middle.)
      expect(m.youSq, id).toEqual({ c: 11, r: 11 });
      expect(m.bossSq, id).toEqual({ c: 8, r: 11 });
      // Facing each other: the boss right (toward you), you left.
      expect([m.bossFace, m.youFace], id).toEqual([1, -1]);
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
      // Under 6 s in all: the walk in at the challenge's pace is about a second.
      expect(Math.max(you.length, boss.length) * CHALLENGE_FEEL.walkStepMs, id).toBeLessThanOrEqual(1200);
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

  it("the line, the pyramid rising under it, holding till the line's done, cracking, crumbling, the table alone; then the storm", () => {
    expect(beats.map((b) => b.step)).toEqual(["line", "rise", "idle", "crack", "crumble", "table", "done"]);
    expect(at(0)).toMatchObject({ step: "line", pyramid: null, line: true, table: false });
    expect(at(CHALLENGE_FEEL.riseAtMs)).toMatchObject({ step: "rise", pyramid: { anim: "rise", frame: 0 }, line: true });
    const idle = beats.find((b) => b.step === "idle")!;
    expect(idle.end).toBe(CHALLENGE_FEEL.lineMs);
    expect(at(idle.at + 1)).toMatchObject({ step: "idle", pyramid: { anim: "idle", frame: 0 }, line: true });
    const crack = beats.find((b) => b.step === "crack")!;
    // (The line is over once it cracks.)
    expect(at(crack.at)).toMatchObject({ step: "crack", pyramid: { anim: "crack", frame: 0 }, line: false, table: false });
    const crumble = beats.find((b) => b.step === "crumble")!;
    expect(at(crumble.at)).toMatchObject({ pyramid: { anim: "crumble", frame: 0 }, table: false });
    const clear = crumble.at + ALFIL.crumble[0]! + ALFIL.crumble[1]!;
    expect(at(clear - 1).table).toBe(false);
    expect(at(clear)).toMatchObject({ pyramid: { anim: "crumble", frame: 2 }, table: true });
    expect(at(crumble.end)).toMatchObject({ step: "table", pyramid: null, table: true, drift: true });
    expect(at(introLength(beats))).toMatchObject({ step: "done", table: true });
  });

  it("is short: the line to the storm about 4 s, and the whole challenge, the walk in and the storm too, under 6 s", () => {
    const len = introLength(beats);
    expect(len).toBeGreaterThan(3000);
    expect(len).toBeLessThan(4500);
    const walk = 9 * CHALLENGE_FEEL.walkStepMs + CHALLENGE_FEEL.settleMs;
    expect(walk + len + CHALLENGE_FEEL.stormInMs).toBeLessThan(6000);
  });

  it("the cues (their sounds) come on their beats: rumble as it rises, crack, crumble, and table on the clear frame", () => {
    const crumble = beats.find((b) => b.step === "crumble")!;
    expect(introCues(beats, ALFIL)).toEqual([
      { cue: "rumble", at: CHALLENGE_FEEL.riseAtMs },
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

  it("starts attackLeadMs before the storm covers the screen (so during the crumble), and keeps on until the battle shows", () => {
    const at = attackStart(beats);
    expect(at).toBe(introLength(beats) + CHALLENGE_FEEL.stormInMs - CHALLENGE_FEEL.attackLeadMs);
    expect(introAt(beats, ALFIL, at).step).toMatch(/crack|crumble|table/);
    expect(attackTime(0, beat)).toBe(0);
    expect(attackTime(1000, beat)).toBe(1000);
    // (Where it would leap off, its lashes again, over and over.)
    expect(attackTime(2380, beat)).toBe(560);
    expect(attackTime(2380 + 1820 + 10, beat)).toBe(570);
  });

  it("Alfil's kit has one (every playable boss's does but Timber's: his intro would skip it)", async () => {
    const { bossKit } = await import("../src/characters/kits.ts");
    expect(bossKit(introOf("alfil")!.name)?.kingAttack).toBeDefined();
  });
});

describe("the default intro (Babur's and Puddles')", () => {
  const beats = introBeats(null);
  const at = (t: number) => introAt(beats, null, t);
  const F = CHALLENGE_FEEL;

  it("the line, then the attack swung in place; then done (the flash and the wipe)", () => {
    expect(beats.map((b) => b.step)).toEqual(["line", "swing", "done"]);
    expect(beats[0]).toMatchObject({ at: 0, end: F.lineMs });
    expect(beats[1]).toMatchObject({ at: F.lineMs, end: F.lineMs + F.swingMs });
    expect(introLength(beats)).toBe(F.lineMs + F.swingMs);
    // A few seconds of swinging (Eric: "just be swinging for a few seconds").
    expect(F.swingMs).toBeGreaterThanOrEqual(1500);
    expect(F.swingMs).toBeLessThanOrEqual(3500);
  });

  it("the table pops in during the line (growing past its size and back), a dust puff round its foot; no pyramid", () => {
    expect(at(0)).toMatchObject({ step: "line", line: true, table: false, pyramid: null, puff: -1 });
    expect(at(F.popAtMs - 1).table).toBe(false);
    expect(at(F.popAtMs)).toMatchObject({ table: true, puff: 0 });
    expect(at(F.popAtMs).pop).toBeCloseTo(0);
    const mid = at(F.popAtMs + F.popMs * 0.7);
    expect(mid.pop).toBeGreaterThan(1);
    expect(at(F.popAtMs + F.popMs).pop).toBeCloseTo(1);
    expect(at(F.popAtMs + F.puffMs).puff).toBe(-1);
    expect(F.popAtMs + F.popMs).toBeLessThan(F.lineMs);
    // The line goes as it swings; the table stays.
    expect(at(F.lineMs)).toMatchObject({ step: "swing", line: false, table: true, pop: 1, pyramid: null });
    expect(at(introLength(beats))).toMatchObject({ step: "done", table: true });
    expect(introCues(beats, null)).toEqual([{ cue: "table", at: F.popAtMs }]);
  });

  it("its attack starts as it swings, in place: its lashes only, from the first, over and over (no drop-in, no leap off)", () => {
    const beat = { lashAt: 560, leaveAt: 2380 };
    expect(attackStart(beats)).toBe(F.lineMs);
    expect(attackTime(0, beat, true)).toBe(560);
    expect(attackTime(1000, beat, true)).toBe(1560);
    expect(attackTime(1820, beat, true)).toBe(560);
    // (Alfil's own: its drop-in first, as before.)
    expect(attackTime(0, beat)).toBe(0);
  });

  it("the cues: the app's pop as the table appears and the boss's own whoosh as the screen flashes", () => {
    expect(introOf("tiger")!.cues).toEqual({ table: "pop", wipe: "tigerWhoosh" });
    expect(introOf("gardener")!.cues).toEqual({ table: "pop", wipe: "gardenerWhoosh" });
  });

  it("is short: the walk in, the intro and the flash and wipe under about 6 s", () => {
    const walk = 9 * F.walkStepMs + F.settleMs;
    expect(walk + introLength(beats) + F.flashMs + F.wipeMs).toBeLessThan(6000);
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

