// Chandy wired (his rules, Nov 16; docs/decisions/2026-11-16-chandy-rules.md): his moments' lengths against his art, his board layer
// (the crosshairs and their pips, the beam's cover, the queen lock's line), the Dodge view through its timeline (the scope, the vote
// with its teleports, the result), his kit at each rifle stage, the dock's words for a move his powers refuse, and the warning's
// words when the last chance brings Dodge at once.
import { describe, expect, it } from "vitest";
import { BOSS_POWERS } from "@chessroyale/core";
import { CHANDY_FIRE_AT, CHANDY_FX, dodgeRounds, dodgeTimeline, safeSquares, linesAfter } from "@chessroyale/chess";
import { BOSS_KITS, stagedKit } from "../src/characters/kits.ts";
import { EFFECTS, animLength } from "../src/characters/power-art.ts";
import { CHANDY } from "../src/characters/chandy.ts";
import { chandyItems, dodgeFen, dodgeView } from "../src/components/Chandy.tsx";
import { WARN } from "../src/components/BossPowers.tsx";
import type { MomentProps } from "../src/components/PowerParts.tsx";
import { refusedLine } from "../src/refused.ts";
import type { BossView } from "../src/game.ts";

const fire = CHANDY.anims.fire!;
const fireCue = (() => {
  let t = 0;
  for (const f of fire.frames) {
    if (f.cue === "fire") return t;
    t += f.ms;
  }
  return -1;
})();

function bossWith(chandy: object, events: object[] = [], fen = "4k3/8/8/8/8/8/8/3QK3 w - - 0 1"): BossView {
  return { id: "chandy", name: "Chandy", crowdSide: "w", crowdMoves: 4, startMove: 1, board: { id: 0, fen, history: [], ply: 0, lastMove: null }, powers: { turn: 5, events, chandy } } as unknown as BossView;
}
const EMPTY = { locks: [], upgrades: 0, unlocked: [], meter: null, rageLocked: true, scatter: null, beam: null, shields: null, dizzy: [], aim: null, shot: null, dodge: null };

describe("his moments against his art", () => {
  it("each move's moment fires at his `fire` cue and lasts past what it puts on the board", () => {
    expect(CHANDY_FIRE_AT).toBe(fireCue);
    const after = (name: keyof typeof EFFECTS, anim: string) => CHANDY_FIRE_AT + animLength(EFFECTS[name].ch.anims[anim]!);
    expect(CHANDY_FX.scatterShot).toBeGreaterThanOrEqual(after("chandyScatter", "land") + 120);
    expect(CHANDY_FX.beam).toBeGreaterThanOrEqual(after("chandyBeam", "rowIn"));
    expect(CHANDY_FX.shields).toBeGreaterThanOrEqual(after("chandyShield", "up"));
    expect(CHANDY_FX.rapidFire).toBeGreaterThanOrEqual(after("chandyDizzy", "hit") + 2 * 150);
    expect(CHANDY_FX.queenAim).toBeGreaterThanOrEqual(after("chandyQueenAim", "on"));
    expect(CHANDY_FX.queenShot).toBeGreaterThanOrEqual(CHANDY_FIRE_AT + 7 * 60 + animLength(EFFECTS.chandyShatter.ch.anims.shatter!));
    expect(CHANDY_FX.lockOn).toBeGreaterThanOrEqual(120 + animLength(EFFECTS.chandyCrosshair.ch.anims.lock!));
    expect(CHANDY_FX.upgrade).toBe(2000);
  });
});

describe("his board layer", () => {
  it("a crosshair on each lock, its pips its turns left; the beam over its 15 squares; the queen's line down her file from his side", () => {
    const items = chandyItems(bossWith({ ...EMPTY, locks: [{ square: "c3", left: 3 }, { square: "f4", left: 1 }], beam: { rank: 6, file: "b", squares: ["a6", "b6", "c6", "d6", "e6", "f6", "g6", "h6", "b1", "b2", "b3", "b4", "b5", "b7", "b8"] }, aim: "d1" }), [], 1000);
    expect(items.filter((i) => i.name === "chandyCrosshair").map((i) => [i.square, i.anim])).toEqual([
      ["c3", "held3"],
      ["f4", "held1"],
      ["d1", "held"],
    ]);
    const beam = items.filter((i) => i.name === "chandyBeam");
    expect(beam.length).toBe(15);
    expect(beam.find((i) => i.square === "b6")!.anim).toBe("cross");
    expect(beam.find((i) => i.square === "e6")!.anim).toBe("row");
    expect(beam.find((i) => i.square === "b2")!.anim).toBe("col");
    expect(items.filter((i) => i.name === "chandyQueenAim").map((i) => i.square)).toEqual(["d8", "d7", "d6", "d5", "d4", "d3", "d2"]);
  });

  it("a new lock snaps on as he points, from its moment's start", () => {
    const boss = bossWith({ ...EMPTY, locks: [{ square: "c3", left: 3 }] });
    const m = { kind: "lockOn" as const, key: "k", at: 1000, ms: CHANDY_FX.lockOn, square: "c3" };
    expect(chandyItems(boss, [m], 1050).length).toBe(0);
    expect(chandyItems(boss, [m], 1200)[0]).toMatchObject({ anim: "lock", then: "held3" });
  });
});

describe("Dodge on screen", () => {
  const d = { at: 4, n: 1, king: "g1", center: "e4", rounds: dodgeRounds("e4", 9, 1), results: [] as { placed: string; hit: boolean; votes: Record<string, number> }[] };
  const tl = dodgeTimeline();
  const run = { key: "d-1", at: 100_000, round: 0, votes: { e4: 2 }, mine: "e4" };
  it("plays the scope-in, the slide, the blank board, then the vote with its teleports, as the timeline has them", () => {
    const boss = bossWith({ ...EMPTY, dodge: d });
    const at = (ms: number) => dodgeView(boss, run, run.at + ms)!;
    expect(at(10).phase).toBe("scope");
    expect(at(tl.slideAt + 10).phase).toBe("slide");
    expect(at(tl.rounds[0]!.voteAt - 100).phase).toBe("open");
    const v = at(tl.rounds[0]!.voteAt + 50);
    expect(v.phase).toBe("vote");
    expect(v.round).toBe(1);
    expect(v.votes).toEqual({ e4: 2 });
    expect(v.mine).toBe("e4");
    expect(v.endsAt).toBe(run.at + tl.rounds[0]!.voteEnd);
    // (Four clones before the teleport; one blinked since, its afterimage fading, "TELEPORT!".)
    expect(v.lines.length).toBe(4);
    expect(v.teleport).toBe(false);
    const t = at(tl.rounds[0]!.teleports[0]! + 100);
    expect(t.teleport).toBe(true);
    expect(t.ghosts?.length).toBe(1);
    // (Black's way up flips a rank clone's side: the crowd's view.)
    expect(t.lines.length).toBe(4);
  });

  it("locks, blasts and shows the round's result once the server's tally is in; a hit says HIT", () => {
    const placed = d.rounds[0]!.safe;
    const done = bossWith({ ...EMPTY, dodge: { ...d, results: [{ placed, hit: false, votes: { [placed]: 1 } }] } });
    expect(dodgeView(done, run, run.at + tl.rounds[0]!.closeAt + 10)).toMatchObject({ phase: "locked", placed });
    expect(dodgeView(done, run, run.at + tl.rounds[0]!.blastAt + 10)).toMatchObject({ phase: "blast", placed });
    expect(dodgeView(done, run, run.at + tl.rounds[0]!.resultAt + 10)).toMatchObject({ phase: "result", result: "dodged", round: 1 });
    const wrong = safeSquares("e4", []).find((sq) => sq !== placed)!;
    const hit = bossWith({ ...EMPTY, dodge: { ...d, results: [{ placed: wrong, hit: true, votes: {} }] } });
    expect(dodgeView(hit, run, run.at + tl.rounds[0]!.resultAt + 10)).toMatchObject({ phase: "result", result: "hit" });
    // (The next round opens after the first's result.)
    expect(dodgeView(done, { ...run, round: 1, votes: {}, mine: undefined }, run.at + tl.rounds[1]!.voteAt + 10)).toMatchObject({ phase: "vote", round: 2 });
  });

  it("takes your king off the board under it (Dodge draws its own)", () => {
    const boss = bossWith({ ...EMPTY, dodge: d }, [], "4k3/8/8/8/8/8/8/6K1 w - - 0 1");
    expect(dodgeFen(boss, "4k3/8/8/8/8/8/8/6K1 w - - 0 1")).toBe("4k3/8/8/8/8/8/8/8 w - - 0 1");
    // (The view's clones are the rules' lines after the teleports seen.)
    expect(linesAfter(d.rounds[2]!, 3).length).toBe(4);
  });
});

describe("his kit and his words", () => {
  it("draws every moment at the rifle's stage now: idle_s3 at three upgrades, the plain ones at none", () => {
    const kit = BOSS_KITS.Chandy!;
    expect(kit.stageOf?.({ powers: { chandy: { upgrades: 3 } } } as never)).toBe(3);
    const at3 = stagedKit(kit, 3);
    expect(at3.anims.capture).toBe("fire_s3");
    expect(at3.loops?.idle).toBe("idle_s3");
    expect(stagedKit(kit, 0)).toBe(kit);
    for (let s = 1; s <= BOSS_POWERS.chandy.upgradesMax; s++) for (const a of Object.values(stagedKit(kit, s).anims)) expect(CHANDY.anims[a!], a).toBeTruthy();
  });

  it("the dock says why a move is refused: the beam, a scatter square, a shield, a dizzy piece", () => {
    const fen = "4k3/8/8/3p4/8/8/3P4/R3K2R w KQ - 0 1";
    const boss = (chandy: object) => ({ id: "chandy", powers: { turn: 5, chandy } });
    expect(refusedLine(boss({ beam: { squares: ["a3", "b3", "c3", "d3", "e3", "f3", "g3", "h3"] } }), fen, "d2d4")).toBe("The beam blocks that move.");
    expect(refusedLine(boss({ scatter: { squares: ["d3"] } }), fen, "d2d3")).toBe("Scatter shot blocks that square.");
    expect(refusedLine(boss({ dizzy: ["a1"] }), fen, "a1a5")).toBe("That piece is dizzy.");
    expect(refusedLine(boss({ shields: { squares: ["d5"] } }), "4k3/8/8/3p4/8/8/8/3QK3 w - - 0 1", "d1d5")).toBe("A shield guards that piece.");
  });
});

describe("Dodge's warning", () => {
  it("says when it comes: next turn as usual; now when it comes this very turn (the last chance, Eric, Nov 16)", () => {
    const said: string[] = [];
    const warn = (ultAt: number | null) => {
      const boss = { ...bossWith(EMPTY), powers: { turn: 5, events: [], ultAt, chandy: EMPTY } } as unknown as BossView;
      const props = { boss, moment: { kind: "warn", key: "k:warn", at: 0, ms: 1700 }, now: 0, t: 0, orientation: "white", side: "w", kit: null, banner: (text: string, sub?: string) => (said.push(`${text} ${sub}`), null), cast: () => null, anim: () => null } as unknown as MomentProps;
      WARN.view(props);
    };
    warn(null);
    warn(5);
    expect(said).toEqual(["RAGE! Next turn: Dodge", "RAGE! Now: Dodge"]);
  });
});
