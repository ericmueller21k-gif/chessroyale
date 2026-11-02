import { describe, expect, it } from "vitest";
import { INTRO_ALFIL_PYRAMID } from "../src/town/shops/alfil-intro-art.ts";
import { SHOP_ALFIL_LAYOUT } from "../src/town/shops/alfil-art.ts";
import { SHOP_BABUR_LAYOUT } from "../src/town/shops/babur-art.ts";
import { SHOP_PUDDLES_LAYOUT } from "../src/town/shops/puddles-art.ts";
import { CHALLENGE_FEEL, attackStart, attackTime, frameAt, introAt, introBeats, introCues, introLength, introOf, marksOf, nextFlow, stormEdge, type ChallengeEvent, type ChallengeFlow, type IntroAnims } from "../src/town/shops/challenge.ts";
import { findPath, makeRoom } from "../src/town/shops/room.ts";
import { SHOPS } from "../src/town/shops/shops.ts";
import { HOMES, START, Walker, createTown, standOf } from "../src/town/world.ts";
import { TOWN_FEEL } from "../src/town/feel.ts";

/**
 * A boss challenged from the town, Pokémon-gym style (Nov 2; town/shops/challenge.ts): the flow from the card's Fight to the battle,
 * the battle circle's marks, the intro's timeline on Alfil's own art, the storm's edge, and coming back to where you stood.
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

  it("only Alfil has an intro so far: every other boss is challenged as before (the Boss raid screen)", () => {
    expect(HOMES.filter((h) => introOf(h.id)).map((h) => h.id)).toEqual(["alfil"]);
    expect(introOf("alfil")!.line).toBe("I'll show you the power of the old piece.");
    // (Alfil's home has its inside, the room the challenge plays in.)
    expect(SHOPS.alfil).toBeDefined();
  });
});

describe("the battle circle's marks", () => {
  it("Alfil's: you on the south mark (near the door), the boss on the north, the table halfway, all on one column", () => {
    const m = marksOf(SHOP_ALFIL_LAYOUT)!;
    expect(m.you).toEqual({ c: 9.5, r: 13 });
    expect(m.boss).toEqual({ c: 9.5, r: 8 });
    expect(m.table).toEqual({ c: 9.5, r: 10.5 });
    expect(m.youSq).toEqual({ c: 10, r: 13 });
    expect(m.bossSq).toEqual({ c: 9, r: 8 });
  });

  it("you and the boss walk in side by side from the door, neither crossing the other, each path clear", () => {
    const room = makeRoom(SHOP_ALFIL_LAYOUT, SHOPS.alfil!.keeper);
    const m = marksOf(SHOP_ALFIL_LAYOUT)!;
    const bossStart = { c: room.start.c - 1, r: room.start.r };
    const you = findPath(room, room.start, m.youSq)!;
    const boss = findPath(room, bossStart, m.bossSq)!;
    expect(you.every((s) => s.c === 10)).toBe(true);
    expect(boss.every((s) => s.c === 9)).toBe(true);
    // Under 6 s in all: the walk in at the challenge's pace is about a second.
    expect(Math.max(you.length, boss.length) * CHALLENGE_FEEL.walkStepMs).toBeLessThanOrEqual(1200);
  });

  it("found from any room's art (Puddles' circle has its marks too; Babur's ring has none drawn yet: his intro would need them)", () => {
    expect(marksOf(SHOP_PUDDLES_LAYOUT)).not.toBeNull();
    expect(marksOf(SHOP_BABUR_LAYOUT)).toBeNull();
    expect(marksOf([])).toBeNull();
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
