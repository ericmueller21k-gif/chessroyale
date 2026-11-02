import { describe, expect, it } from "vitest";
import { INTRO_ALFIL_PYRAMID } from "../src/town/shops/alfil-intro-art.ts";
import { SHOP_ALFIL_LAYOUT } from "../src/town/shops/alfil-art.ts";
import { SHOP_BABUR_LAYOUT } from "../src/town/shops/babur-art.ts";
import { SHOP_PUDDLES_LAYOUT } from "../src/town/shops/puddles-art.ts";
import { SHOP_BIGBOY_LAYOUT, SHOP_BIGBOY_MARKS, SHOP_BIGBOY_PIECES } from "../src/town/shops/bigboy-art.ts";
import { INTRO_BIGBOY_BLOCKS, INTRO_BIGBOY_STOOL_B, INTRO_BIGBOY_STOOL_SEAT_H, INTRO_BIGBOY_STOOL_TOP_H, INTRO_BIGBOY_STOOL_W, INTRO_BIGBOY_SWIRL, INTRO_BIGBOY_SWIRL_FRONT, INTRO_BIGBOY_TABLE_PALETTE } from "../src/town/shops/bigboy-intro-art.ts";
import { TABLE_BOARD } from "../src/town/houses/park.ts";
import { renderFrame } from "../src/characters/sprite.ts";
import { BOSS_INTROS, CHALLENGE_FEEL, attackStart, attackTime, boardSquare, frameAt, introAt, introBeats, introCues, introLength, introOf, marksOf, nextFlow, stormEdge, wipeAt, type BlocksAnims, type ChallengeEvent, type ChallengeFlow, type IntroAnims } from "../src/town/shops/challenge.ts";
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

  it("every boss whose home has an inside has an intro (Alfil and Big Boy their own, Babur and Puddles the default); every other boss is challenged as before (the Boss raid screen)", () => {
    const withIntro = HOMES.filter((h) => introOf(h.id)).map((h) => h.id).sort();
    expect(withIntro).toEqual(["alfil", "bigboy", "gardener", "tiger"]);
    expect(withIntro).toEqual(Object.keys(SHOPS).sort());
    expect(introOf("alfil")).toMatchObject({ custom: true, line: "I'll show you the power of the old piece." });
    expect(introOf("tiger")).toMatchObject({ custom: false, name: "Babur", line: "Fine. One more show. Then I'm on break." });
    expect(introOf("gardener")).toMatchObject({ custom: false, name: "Puddles", line: "Wipe your feet. Then let's see what grows." });
    expect(introOf("bigboy")).toMatchObject({ custom: true, name: "Big Boy", line: "My blocks! My board! Big boy go first!" });
    expect(introOf("hollow")).toBeNull();
  });

  it("the layout: across for all four today (the boss on the left, you on the right: Eric's normal look)", () => {
    for (const id of ["alfil", "tiger", "gardener", "bigboy"] as const) expect(introOf(id)!.layout, id).toBe("across");
  });
});

describe("the battle circle's marks", () => {
  const ROOMS = { alfil: SHOP_ALFIL_LAYOUT, tiger: SHOP_BABUR_LAYOUT, gardener: SHOP_PUDDLES_LAYOUT, bigboy: SHOP_BIGBOY_LAYOUT } as const;

  it("across: the boss west of the table, you east, all on the circle's middle row; each a square and a half out, just past its stool", () => {
    for (const [id, layout] of Object.entries(ROOMS)) {
      const m = marksOf(layout, "across")!;
      // (Babur's ring has his pedestal in its middle: the table stands clearOff south of it, in front.)
      const r = id === "tiger" ? 10.5 + CHALLENGE_FEEL.clearOff : 10.5;
      expect(m.table, id).toEqual({ c: 9.5, r });
      expect(m.boss, id).toEqual({ c: 8, r });
      expect(m.you, id).toEqual({ c: 11, r });
      // (Each walks to its mark's south square, then the last half square north onto its middle: none for a whole row.)
      expect(m.youSq, id).toEqual({ c: 11, r: Math.ceil(r) });
      expect(m.bossSq, id).toEqual({ c: 8, r: Math.ceil(r) });
      // Facing each other: the boss right (toward you), you left.
      expect([m.bossFace, m.youFace], id).toEqual([1, -1]);
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
      for (const at of [mm.you, mm.boss, mm.table, mm.youStool, mm.bossStool])
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

  it("the line, the blocks building under it, the board dropping and plopping on, the stools dropping in, the table alone; then the swirl", () => {
    expect(beats.map((b) => b.step)).toEqual(["line", "build", "drop", "plop", "chairs", "table", "done"]);
    expect(beat("build").at).toBe(F.riseAtMs);
    expect(beat("build").end - beat("build").at).toBe(B.build.reduce((a, b) => a + b, 0));
    expect(beat("drop").end - beat("drop").at).toBe(F.boardDropMs);
    expect(beat("table").end - beat("table").at).toBe(F.tableHoldMs);
    // The line alone, nothing between you yet.
    expect(at(100)).toMatchObject({ step: "line", line: true, blocks: null, table: false, stools: false, pyramid: null });
    // The blocks landing, one by one, under the line.
    expect(at(F.riseAtMs + 10)).toMatchObject({ step: "build", line: true, blocks: { anim: "build", frame: 0 }, table: false });
    // The board falling from above onto the built table (its last frame), still above it, then lower; the line done.
    const d0 = at(beat("drop").at + 1);
    const d1 = at(beat("drop").at + F.boardDropMs * 0.8);
    expect(d0).toMatchObject({ step: "drop", line: false, blocks: { anim: "build", frame: B.build.length - 1 }, table: true, stools: false });
    expect(d0.drop).toBeGreaterThan(F.dropFrom * 0.95);
    expect(d1.drop).toBeGreaterThan(0);
    expect(d1.drop).toBeLessThan(d0.drop);
    // On it as it plops (dust and stars), then the stools drop in, then it all stands.
    expect(at(beat("plop").at)).toMatchObject({ step: "plop", blocks: { anim: "plop", frame: 0 }, table: true, drop: 0, stools: false });
    expect(at(beat("chairs").at + 1)).toMatchObject({ step: "chairs", blocks: { anim: "chairs", frame: 0 }, table: true, stools: true });
    expect(at(beat("table").at + 1)).toMatchObject({ step: "table", blocks: { anim: "idle", frame: 0 }, table: true, stools: true, drop: 0 });
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

  it("is short: the line to the swirl under 4 s, and the whole challenge, the walk in and the swirl too, under 6 s; his attack from 2 s before the swirl covers", () => {
    const len = introLength(beats);
    expect(len).toBeLessThanOrEqual(4000);
    const walk = 9 * F.walkStepMs + F.settleMs;
    expect(walk + len + F.stormInMs).toBeLessThan(6000);
    const a = attackStart(beats);
    expect(a).toBe(len + F.stormInMs - F.attackLeadMs);
    expect(a).toBeGreaterThan(beat("drop").at);
    expect(a).toBeLessThan(len);
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

  it("Alfil's kit has one (every playable boss's does, Timber's too since Nov 2)", async () => {
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

