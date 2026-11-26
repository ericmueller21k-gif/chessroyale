// Chandy wired (his rules, Nov 16; docs/decisions/2026-11-16-chandy-rules.md): his moments' lengths against his art, his board layer
// (the crosshairs and their pips, the beam's cover, the Lock-on Shot's line), the Dodge view through its timeline (the scope, the vote
// with its teleports, the result; a Dodge from your mate: its opening, step by step, and the win beat), his kit at each rifle stage,
// the dock's words for a move his powers refuse, and the warning's words.
import { describe, expect, it } from "vitest";
import { BOSS_POWERS } from "@chessroyale/core";
import { CHANDY_FIRE_AT, CHANDY_FX, dodgeRounds, dodgeTimeline, safeSquares, linesAfter } from "@chessroyale/chess";
import { BOSS_KITS, stagedKit } from "../src/characters/kits.ts";
import { EFFECTS, animLength } from "../src/characters/power-art.ts";
import { CHANDY } from "../src/characters/chandy.ts";
import { CHANDY_MOVE_NAMES, CHANDY_WORDS, MATE_LINE, chandyFen, chandyItems, dodgeDock, dodgeFen, dodgeView, shotHitAt } from "../src/components/Chandy.tsx";
import { barRows } from "../src/characters/zebra-lines.ts";
import { CHANDY_MATE_LINES } from "../src/characters/chandy-lines.ts";
import { POWER_WORDS } from "../src/power-words.ts";
import { KING_LINES } from "../src/godKing.ts";
import { WARN } from "../src/components/BossPowers.tsx";
import type { MomentProps } from "../src/components/PowerParts.tsx";
import { refusedLine } from "../src/refused.ts";
import type { BossView, GameView } from "../src/game.ts";
import { lookKey, weaponView } from "../src/components/ChandyWeapon.tsx";

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
    expect(CHANDY_FX.queenShot).toBeGreaterThanOrEqual(shotHitAt(8) + animLength(EFFECTS.chandyShatter.ch.anims.shatter!));
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

  it("the queen lock's shot: the hit piece stays on the board until the round reaches it, the round flying a square at a time (Eric, Nov 20)", () => {
    // (The game's board has lost the d2 pawn as his turn began; the round flies d8 to d2.)
    const after = "4k3/8/8/8/8/8/8/3QK3 b - - 0 1";
    const boss = bossWith(EMPTY, [], after);
    const m = { kind: "queenShot" as const, key: "s", at: 1000, ms: CHANDY_FX.queenShot, square: "d2", squares: ["d8", "d7", "d6", "d5", "d4", "d3", "d2"], shape: "p" };
    const hit = 1000 + shotHitAt(7);
    expect(hit).toBe(1000 + CHANDY_FIRE_AT + 6.5 * BOSS_POWERS.chandy.shotStepMs);
    expect(chandyFen(boss, [m], 1000, after)).toBe("4k3/8/8/8/8/8/3P4/3QK3 b - - 0 1");
    expect(chandyFen(boss, [m], hit - 1, after)).toContain("3P4");
    expect(chandyFen(boss, [m], hit, after)).toBe(after);
    expect(chandyFen(boss, [{ ...m, fizzled: ["d1"] }], 1000, after)).toBe(after);
    // (The round reaches each square in turn, one square's slice each, stopping on d2; the shatter only as it arrives.)
    const at = (t: number) => chandyItems(boss, [m], t);
    expect(at(1000 + CHANDY_FIRE_AT + 2 * BOSS_POWERS.chandy.shotStepMs).filter((i) => i.name === "chandyRound").map((i) => i.square)).toEqual(["d8", "d7", "d6"]);
    expect(at(hit - 1).some((i) => i.name === "chandyShatter")).toBe(false);
    expect(at(hit).filter((i) => i.name === "chandyRound").map((i) => i.anim)).toEqual(["pass", "pass", "pass", "pass", "pass", "pass", "hit"]);
    expect(at(hit).find((i) => i.name === "chandyShatter")).toMatchObject({ square: "d2", since: hit });
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
    // (The warning volley: its clones on lines that miss your king, the beams, then "Dodge the next one!".)
    const volley = at(tl.volley.at + 10);
    expect(volley).toMatchObject({ phase: "volley", hits: 0 });
    expect(volley.warned).toBeUndefined();
    expect(volley.beams?.at).toBe(run.at + tl.volley.fireAt);
    expect(at(tl.volley.landAt + 10).warned).toBe(true);
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

  it("locks, sends the beams and shows the round's result once the server's tally is in; a first hit cracks your king, the second is the kill", () => {
    const placed = d.rounds[0]!.safe;
    const done = bossWith({ ...EMPTY, dodge: { ...d, results: [{ placed, hit: false, votes: { [placed]: 1 } }] } });
    const r0 = tl.rounds[0]!;
    expect(dodgeView(done, run, run.at + r0.closeAt + 10)).toMatchObject({ phase: "locked", placed });
    expect(dodgeView(done, run, run.at + r0.blastAt + 10)).toMatchObject({ phase: "blast", placed, beams: { at: run.at + r0.blastAt } });
    expect(dodgeView(done, run, run.at + r0.hitAt + 10)).toMatchObject({ phase: "result", result: "dodged", round: 1, hits: 0 });
    // (The beams held through the result, until just before the next round.)
    expect(dodgeView(done, run, run.at + r0.end - 10)!.beams!.fadeAt).toBeLessThan(run.at + r0.end);
    const wrong = safeSquares("e4", []).find((sq) => sq !== placed)!;
    const hit = { placed: wrong, hit: true, votes: {} };
    const once = bossWith({ ...EMPTY, dodge: { ...d, results: [hit] } });
    expect(dodgeView(once, run, run.at + r0.blastAt + 10)!.cracked).toBeUndefined();
    expect(dodgeView(once, run, run.at + r0.hitAt + 10)).toMatchObject({ phase: "result", result: "hit", hits: 1, cracked: run.at + r0.hitAt });
    // (Cracked for the rest of Dodge: the next round's vote too.)
    expect(dodgeView(once, { ...run, round: 1, votes: {}, mine: undefined }, run.at + tl.rounds[1]!.voteAt + 10)).toMatchObject({ phase: "vote", round: 2, hits: 1, cracked: run.at + r0.hitAt });
    const r1 = tl.rounds[1]!;
    const twice = bossWith({ ...EMPTY, dodge: { ...d, results: [hit, { ...hit, placed: wrong }] } });
    expect(dodgeView(twice, run, run.at + r1.hitAt + 10)).toMatchObject({ phase: "kill", result: "hit", hits: 2, killAt: run.at + r1.hitAt });
    // (The kill holds the screen past the round's usual end, to the shatter and the result.)
    expect(dodgeView(twice, run, run.at + r1.hitAt + tl.killMs - 10)!.phase).toBe("kill");
    // (The next round opens after the first's result.)
    expect(dodgeView(done, { ...run, round: 1, votes: {}, mine: undefined }, run.at + tl.rounds[1]!.voteAt + 10)).toMatchObject({ phase: "vote", round: 2 });
  });

  it("the art keeps the timeline's beats: the kill as long as dodgeKillMs, the shatter inside dodgeShatterMs, a beam's start under its travel step", () => {
    const S = BOSS_POWERS.chandy;
    const king = EFFECTS.chandyDodgeKing.ch.anims;
    // (The kill's steps, then its empty last frame.)
    expect(animLength(king.kill!) - king.kill!.frames.at(-1)!.ms).toBe(S.dodgeKillMs);
    expect(animLength(king.killUp!)).toBe(animLength(king.kill!));
    for (const a of ["shatter00", "shatter11", "shatter22"]) expect(animLength(king[a]!)).toBeLessThanOrEqual(S.dodgeShatterMs);
    expect(animLength(EFFECTS.chandyDodgeRow.ch.anims.travel!)).toBeLessThanOrEqual(S.dodgeTravelMs);
  });

  it("takes your king off the board under it (Dodge draws its own)", () => {
    const boss = bossWith({ ...EMPTY, dodge: d }, [], "4k3/8/8/8/8/8/8/6K1 w - - 0 1");
    expect(dodgeFen(boss, "4k3/8/8/8/8/8/8/6K1 w - - 0 1")).toBe("4k3/8/8/8/8/8/8/8 w - - 0 1");
    // (The view's clones are the rules' lines after the teleports seen.)
    expect(linesAfter(d.rounds[2]!, 3).length).toBe(4);
  });

  it("from your mate (Eric, Nov 26): his opening before the Dodge's start, step by step, the board as it is (your king on it); the Dodge as ever; survived, the win beat, your mate back", () => {
    const fen = "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4";
    const mate = { ...d, king: "e1", mate: true as const };
    const boss = bossWith({ ...EMPTY, dodge: mate }, [], fen);
    const at = (b: BossView, ms: number) => dodgeView(b, run, run.at + ms)!;
    const steps: string[] = [];
    for (let ms = -tl.openingMs; ms < 0; ms += 100) {
      const v = at(boss, ms);
      expect(v.phase).toBe("mate");
      if (steps.at(-1) !== v.step) steps.push(v.step!);
      expect(v.since).toBe(run.at + tl.opening[v.step!].at);
      expect(dodgeFen(boss, fen, run, run.at + ms)).toBe(fen);
    }
    expect(steps).toEqual(["pause", "jump", "reach", "zap", "line"]);
    expect(dodgeDock(boss, run, run.at - 10).line).toBe("Checkmate?");
    // (Then the Dodge as ever: the scope-in, your king off the board under it.)
    expect(at(boss, 10).phase).toBe("scope");
    expect(dodgeFen(boss, fen, run, run.at + 10)).not.toBe(fen);
    // (Survived: from its last round's end, the win beat, the board your mate's; lost, the kill as ever.)
    const ok = (k: number) => ({ placed: mate.rounds[k]!.safe, hit: false, votes: {} });
    const won = bossWith({ ...EMPTY, dodge: { ...mate, results: [ok(0), ok(1), ok(2)] } }, [], fen);
    expect(at(won, tl.win.at - 10).phase).toBe("result");
    expect(at(won, tl.win.at + 10)).toMatchObject({ phase: "win", since: run.at + tl.win.at });
    expect(dodgeFen(won, fen, run, run.at + tl.win.at + 10)).toBe(fen);
    expect(dodgeDock(won, run, run.at + tl.win.at + 10)).toEqual({ line: "Checkmate!", sub: "You beat Chandy." });
    const hit = (k: number) => ({ placed: "a1", hit: true, votes: {} });
    const lost = bossWith({ ...EMPTY, dodge: { ...mate, results: [hit(0), ok(1), hit(2)] } }, [], fen);
    expect(at(lost, tl.win.at + 10).phase).toBe("kill");
    // (A Dodge from his meter: no opening, no win beat.)
    expect(at(bossWith({ ...EMPTY, dodge: d }), -10).phase).toBe("scope");
    // (His line: not Eric's example, three to pick from, Eric's pick said; each sentence whole in a phone's bar, two rows at 320 px
    // (the line in one piece took three and was cut off: the director's still, Nov 26).)
    expect(CHANDY_MATE_LINES).toHaveLength(3);
    expect(MATE_LINE.text).toBe("Mate? Negative. One shot left in the chamber.");
    for (const l of CHANDY_MATE_LINES) {
      expect(l.join(" ")).not.toMatch(/trick up my sleeve/i);
      for (const s of l) expect(barRows(s), s).toBeLessThanOrEqual(2);
    }
    // (Both sentences typed by the end of its step, so the whole line is read before the scope-in.)
    expect(MATE_LINE.typedMs).toBeLessThanOrEqual(BOSS_POWERS.chandy.mateLineMs);
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
  it("says when it comes: next turn as usual; now when it comes this very turn (the words every boss's warning has)", () => {
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

describe("his weapon screen (Eric, Nov 18: tap him to see his rifle and its upgrades)", () => {
  it("before any upgrade: the rifle at stage 0, all five moves greyed, the meter off, how he upgrades", () => {
    const v = weaponView(EMPTY);
    expect(v.stage).toBe(0);
    expect(v.label).toBe("Base 0/5");
    expect(v.moves.map((m) => m.id)).toEqual(["scatter", "beam", "shields", "rapidfire", "queenlock"]);
    expect(v.moves.every((m) => !m.on)).toBe(true);
    expect(v.meter).toBeNull();
    expect(v.note).toMatch(/locked piece he takes upgrades his rifle/);
  });
  it("lights the moves he has, in one fixed order whatever order they came in; the stage and meter from his view", () => {
    const v = weaponView({ upgrades: 2, unlocked: ["queenlock", "beam"], meter: 0.456 });
    expect(v.stage).toBe(2);
    expect(v.label).toBe("Big scope 2/5");
    expect(v.moves.filter((m) => m.on).map((m) => m.id)).toEqual(["beam", "queenlock"]);
    expect(v.meter).toBe(46);
    const full = weaponView({ upgrades: 5, unlocked: ["scatter", "beam", "shields", "rapidfire", "queenlock"], meter: 1 });
    expect(full.stage).toBe(5);
    expect(full.moves.every((m) => m.on)).toBe(true);
    expect(full.note).toBe("Fully upgraded.");
  });
  it("can open only on the crowd's turn with him in play: never in his turn, in Dodge or once the battle's over; any move closes it", () => {
    const boss = bossWith({ ...EMPTY, upgrades: 1, unlocked: ["beam"], meter: 0 });
    const play = { kind: "play" } as GameView["phase"];
    const k = lookKey({ boss, phase: play });
    expect(k).not.toBeNull();
    expect(lookKey({ boss, phase: { kind: "scoring" } as GameView["phase"] })).toBe(k);
    expect(lookKey({ boss, phase: { kind: "boss" } as GameView["phase"] })).toBeNull();
    expect(lookKey({ boss: bossWith({ ...EMPTY, dodge: {} }), phase: play })).toBeNull();
    expect(lookKey({ boss: { ...boss, result: "boss" } as BossView, phase: play })).toBeNull();
    const moved = { ...boss, board: { ...boss.board, history: ["e2e4"] } } as BossView;
    expect(lookKey({ boss: moved, phase: play })).not.toBe(k);
  });
});

describe("the Lock-on Shot's words (Nov 24: the queen lock renamed, as it may aim at a rook)", () => {
  it("is named the Lock-on Shot everywhere a player reads it; its words never say queen unless the piece is one", () => {
    expect([CHANDY_MOVE_NAMES.queenlock, POWER_WORDS.queenlock]).toEqual(["Lock-on Shot", "Lock-on Shot"]);
    expect(CHANDY_WORDS.shot("r", false)).toBe("Lock-on Shot: your rook took it.");
    expect(CHANDY_WORDS.shot("p", false)).toBe("Lock-on Shot: your pawn took it.");
    expect(CHANDY_WORDS.shot("q", false)).toBe("Lock-on Shot: your queen fell.");
    expect(CHANDY_WORDS.shot(null, true)).toBe("Lock-on Shot: the shot was stopped.");
    for (const p of ["p", "n", "b", "r"]) expect(CHANDY_WORDS.shot(p, false)).not.toMatch(/queen/i);
    expect(CHANDY_WORDS.aim("r")).not.toMatch(/queen/i);
  });

  it("the God King's warning as it's aimed: a piece in front of the target, the queen's words for her, the rook's for a rook", () => {
    for (const line of KING_LINES.shotQueen) expect(line).toMatch(/queen/i);
    for (const line of KING_LINES.shotRook) expect(line).toMatch(/rook/);
    for (const line of KING_LINES.shotRook) expect(line).not.toMatch(/queen/i);
    // (The round follows its target down whatever file it ends on: never "out of the line", always a piece in front of it.)
    for (const line of [...KING_LINES.shotQueen, ...KING_LINES.shotRook]) {
      expect(line).not.toMatch(/out of the line/i);
      expect(line).toMatch(/front|behind|block/i);
    }
  });
});
