import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, RAID_SETTINGS, RECLUSE_PHASE2, SPEECH, bossBannerMs } from "@chessroyale/core";
import { LAST_STAND, legalMoves, phase2Numbers, type MoveScore } from "@chessroyale/chess";
import { ARC_LIFE, ARC_STRIKES, PHASE_CHANGE, Phase2Game, absorbKing, arcPoints, phase2Follows, phase2Mates, phaseChangeRun, smoothPath } from "../src/recluse-phase2.ts";
import { ON_BOARD_ANIMS, RECLUSE, RECLUSE_BUST } from "../src/characters/recluse.ts";
import { CRITICAL, NORMAL, Voice, bossVoice, holdMs, typeMs } from "../src/speech.tsx";
import { SoloMatch } from "../src/solo.ts";
import { KING_LINES, kingLine, kingSay, resetKingSpeech } from "../src/godKing.ts";
import { KING_VS_RECLUSE, RECLUSE_LINES } from "../src/characters/recluse-lines.ts";
import { animLength } from "../src/characters/power-art.ts";

// The Hidden Boss's phase 2 on this device (recluse-phase2.ts): the phase change's beats, and the four boards driven
// with pretend engines and a pretend clock. Its rules: packages/chess/test/recluse-phase2.test.ts.

describe("when phase 2 follows, and who plays it beside you", () => {
  const won = { bossId: "recluse", result: "crowd" };
  it("after phase 1 won against him: alone (Boss alone) and in a solo Crowd's boss final (Oct 14); never a Solo raid, another boss, or a loss", () => {
    expect(phase2Follows({ ...won, raid: true, raidBots: false, crowdFinal: false })).toBe(true);
    expect(phase2Follows({ ...won, raid: false, raidBots: false, crowdFinal: true })).toBe(true);
    expect(phase2Follows({ ...won, raid: true, raidBots: true, crowdFinal: false })).toBe(false);
    expect(phase2Follows({ ...won, raid: false, raidBots: false, crowdFinal: false })).toBe(false);
    for (const result of ["boss", "draw", null]) expect(phase2Follows({ ...won, result, raid: false, raidBots: false, crowdFinal: true })).toBe(false);
    expect(phase2Follows({ ...won, bossId: "clown", raid: false, raidBots: false, crowdFinal: true })).toBe(false);
  });

  it("the other boards: the finalists who fought beside you, then fresh bots for any left (Boss alone: all fresh), one a board", () => {
    const fresh = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `bot${i}`, name: `Fresh ${i}` }));
    const boards = RECLUSE_PHASE2.boards;
    const finalists = [{ id: "bot7", name: "Ann" }, { id: "bot0", name: "Bo" }, { id: "bot3", name: "Cy" }];
    expect(phase2Mates(finalists, boards, fresh)).toEqual(finalists);
    expect(phase2Mates([], boards, fresh)).toEqual(fresh(boards - 1));
    expect(phase2Mates([...finalists, { id: "bot9", name: "Di" }], boards, fresh)).toEqual(finalists);
    // One short (somebody struck): a fresh bot, under an id of its own.
    const two = phase2Mates(finalists.slice(0, 2), boards, fresh);
    expect(two).toHaveLength(boards - 1);
    expect(new Set(two.map((b) => b.id)).size).toBe(boards - 1);
    expect(two.slice(0, 2)).toEqual(finalists.slice(0, 2));
  });
});

describe("the phase change", () => {
  it("is 25 to 30 s with its short fall (Eric: \"this epic thing\"; Oct 17: about 10 s slower), its beats in order: the God King's absorption, rage, leap, the book thrown down, the chant, the split, the book back, the leap back", () => {
    const C = PHASE_CHANGE;
    expect(C.fallMs).toBeGreaterThanOrEqual(1500);
    expect(C.fallMs).toBeLessThanOrEqual(2000);
    expect(C.fallMs + C.total).toBeGreaterThanOrEqual(25_000);
    expect(C.fallMs + C.total).toBeLessThanOrEqual(30_000);
    const order = [0, C.kingAt, C.talkAt, C.seizeAt, C.drainAt, C.igniteAt, C.riseAt, C.leapAt, C.upAt, C.landAt, C.dropAt, C.thudAt, C.chantAt, C.arcAt, C.crackAt, C.partAt, C.growAt, C.growAt + C.growMs, C.pickupAt, C.catchAt, C.backAt, C.homeAt, C.bannerAt, C.total];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // The absorption first (about 5 s): the God King triumphant, then drained into the boss's raised hand for as long as
    // his Last Stand's blows run to his stagger, gone just after the power lands, before the boss is on his feet.
    expect(C.drainMs).toBe(LAST_STAND.staggerAt - LAST_STAND.slashAt);
    // (The drain starts as his hand is up: `seize`'s `reach`.)
    expect(C.drainAt).toBe(C.seizeAt + RECLUSE.anims.seize!.frames.slice(0, 3).reduce((t, f) => t + f.ms, 0));
    expect(RECLUSE.anims.seize!.frames[3]!.cue).toBe("reach");
    expect(C.goneAt).toBeGreaterThan(C.igniteAt);
    expect(C.goneAt).toBeLessThanOrEqual(C.riseAt + C.rageMs);
    // (From his line about the power on, as on Oct 17 (10 to 12 s to the rise with the line at 4.65 s); the mumbling
    // before it as long as the speech rule makes it, 1.5 s longer since Oct 24.)
    expect(C.riseAt - C.talkAt).toBeGreaterThanOrEqual(10_000 - 4652);
    expect(C.riseAt - C.talkAt).toBeLessThanOrEqual(12_000 - 4652);
    expect(C.talkAt).toBe(-C.fallMs + animLength(RECLUSE.anims.collapse!) + holdMs(RECLUSE_LINES.fall[0]) + 150);
    // He gets up where he stands, then the board takes him over; the light is up through the cracks and the split.
    expect(C.leapAt).toBe(C.riseAt + animLength(RECLUSE.anims.rage!));
    expect(C.chantAt + C.lightMs).toBeLessThanOrEqual(C.crackAt);
    // (The pieces fly to their Chess960 squares as the book comes back to him, and land before "PHASE 2".)
    expect(C.shuffleAt).toBeGreaterThanOrEqual(C.pickupAt);
    expect(C.shuffleAt + C.shuffleMs).toBeLessThanOrEqual(C.bannerAt);
    // (Then the countdown on phase 2's boards before the clocks: a setting.)
    expect(C.countdownMs).toBe(RECLUSE_PHASE2.change.countdownSeconds * 1000);
    // (Phase 2's frames, all drawn: his idle, his slam and laugh, the placeholder's glow.)
    for (const a of ["idle2", "slam2", "laugh2", "spellbook2", "spellLoop2", "collapseLoop"]) expect(RECLUSE.anims[a], a).toBeDefined();
  });

  it("Eric, Oct 17 (\"way too fast\"): about 10 s more from the mate to the split, every added time a setting, the animations unchanged", () => {
    const C = PHASE_CHANGE;
    const P = RECLUSE_PHASE2.change;
    // His words before the seize, a hold as the power lands, a longer cast: about 10 s in all, the talk 4 to 5 s of it and
    // the cast 3 to 5 s longer.
    expect(P.talkMs + P.absorbHoldMs + P.castHoldMs).toBeGreaterThanOrEqual(9_000);
    expect(P.talkMs + P.absorbHoldMs + P.castHoldMs).toBeLessThanOrEqual(11_000);
    expect(P.talkMs).toBeGreaterThanOrEqual(4_000);
    expect(P.talkMs).toBeLessThanOrEqual(5_000);
    expect(P.castHoldMs).toBeGreaterThanOrEqual(3_000);
    expect(P.castHoldMs).toBeLessThanOrEqual(5_000);
    expect(P.countdownSeconds).toBe(5);
    // Where each lands: the seize after the talk, the rise after the hold, the crack after the cast.
    // (Or once his line about the power has typed out, after his mumbling: Oct 24, the speech rule's longer lines.)
    expect(C.seizeAt).toBe(Math.max(1700 + P.talkMs, C.talkAt + Math.max(...RECLUSE_LINES.seizeTalk.map(typeMs)) + 100));
    expect(C.riseAt).toBe(C.igniteAt + animLength(RECLUSE.anims.seized!) + P.absorbHoldMs);
    expect(C.crackAt - C.chantAt).toBe(1700 + P.castHoldMs);
    // (The beats themselves keep their lengths: the drain, the rage, the split, the shuffle, the leap back.)
    expect(C.drainMs).toBe(LAST_STAND.staggerAt - LAST_STAND.slashAt);
    expect([C.partAt - C.crackAt, C.growAt - C.partAt, C.growMs, C.shuffleMs]).toEqual([750, 400, 900, 900]);
  });

  it("before the seize he says he'll take the God King's power: after his mumbling, typed out before his hand goes up, and read before the power lands", () => {
    const C = PHASE_CHANGE;
    // (His mumbling is his fall's first line, from the end of his collapse in the fall: it's over as his new line comes.)
    const mumbleEnd = -C.fallMs + animLength(RECLUSE.anims.collapse!) + holdMs(RECLUSE_LINES.fall[0]);
    expect(C.talkAt).toBeGreaterThanOrEqual(mumbleEnd);
    expect(RECLUSE_LINES.seizeTalk.length).toBeGreaterThanOrEqual(1);
    for (const line of RECLUSE_LINES.seizeTalk) {
      // (The last words before he seizes it are about taking its power.)
      expect(line, line).toMatch(/power/i);
      expect(C.talkAt + typeMs(line), line).toBeLessThanOrEqual(C.seizeAt);
      // Up from when it's said, whole for at least two and a half seconds before his word as the power lands cuts in.
      const v = new Voice();
      v.say(RECLUSE_LINES.fall[0], "mumble", NORMAL, mumbleEnd - holdMs(RECLUSE_LINES.fall[0]));
      v.say(line, "talk", NORMAL, C.talkAt);
      expect(v.line(C.talkAt)?.text).toBe(line);
      expect(v.line(C.absorbLineAt - 1)?.text).toBe(line);
      expect(C.absorbLineAt - C.talkAt - typeMs(line), line).toBeGreaterThanOrEqual(2500);
    }
  });

  it("where he stands: slumped while the God King gloats, his hand up through the drain, his fist as it lands, up in a rage at riseAt", () => {
    const C = PHASE_CHANGE;
    const run = phaseChangeRun(1000);
    expect(run).toMatchObject({ since: 1000 + C.seizeAt, before: "collapseLoop", loop: "idle2" });
    const len = (n: string) => animLength(RECLUSE.anims[n]!);
    const steps = run.anims.map((a) => (typeof a === "string" ? [a, len(a)] : [a.anim, a.ms]) as const);
    expect(steps.map(([n]) => n)).toEqual(["seize", "seizeLoop", "seized", "rage"]);
    // (His fist closed held a moment as the power sinks in: `seized` once, then its last frame.)
    expect(steps[2]![1]).toBe(len("seized") + C.absorbHoldMs);
    // (Each step where the timeline says: the fist closes as the power lands, he's up as the leap begins.)
    expect(C.seizeAt + steps[0]![1] + steps[1]![1]).toBe(C.igniteAt);
    expect(C.seizeAt + steps[0]![1] + steps[1]![1] + steps[2]![1]).toBe(C.riseAt);
    expect(C.riseAt + steps[3]![1]).toBe(C.leapAt);
    expect(steps[1]![1]).toBeGreaterThan(1500);
  });

  it("the God King in his place: triumphant, drained (his Last Stand's blows to its stagger as the power lands), fading, then gone for good", () => {
    const C = PHASE_CHANGE;
    const at = 50_000;
    expect(absorbKing(0, at)).toEqual({ anim: "raise", since: at, then: "raised", class: "gk-triumph" });
    expect(absorbKing(C.drainAt - 1, at)).toMatchObject({ class: "gk-triumph" });
    const drained = absorbKing(C.drainAt, at);
    expect(drained).toMatchObject({ anim: "lastStand", class: "gk-drained" });
    // (His frames at the drain's start are the first of the blows; at the power's landing, his stagger.)
    const since = (drained as { since: number }).since;
    expect(at + C.drainAt - since).toBe(LAST_STAND.slashAt - LAST_STAND.fallAt);
    expect(at + C.igniteAt - since).toBe(LAST_STAND.staggerAt - LAST_STAND.fallAt);
    expect(absorbKing(C.igniteAt, at)).toMatchObject({ anim: "lastStand", class: "gk-fading" });
    for (const t of [C.goneAt, C.leapAt, C.total, C.total + 600_000]) expect(absorbKing(t, at)).toBe("gone");
  });

  it("arcs strike the board from his raised hands as it splits: onto the cracks, smooth, two big ones as it cracks and as it parts", () => {
    const C = PHASE_CHANGE;
    expect(ARC_STRIKES.length).toBeGreaterThanOrEqual(12);
    for (const s of ARC_STRIKES) {
      expect(s.at).toBeGreaterThanOrEqual(C.arcAt);
      expect(s.at + ARC_LIFE).toBeLessThanOrEqual(C.arcEnd + ARC_LIFE);
      // (On a crack: down the middle or across it.)
      expect(s.to[0] === 50 || s.to[1] === 50, JSON.stringify(s)).toBe(true);
      for (const v of s.to) expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThanOrEqual(100);
    }
    expect(ARC_STRIKES.filter((s) => s.big).map((s) => s.at)).toEqual([C.crackAt, C.crackAt, C.partAt, C.partAt]);
    // (Never two seconds of nothing: one strikes at least every quarter second.)
    const at = ARC_STRIKES.map((s) => s.at);
    for (let i = 1; i < at.length; i++) expect(at[i]! - at[i - 1]!).toBeLessThanOrEqual(250);
    // (Their crackle's two snaps fall on the big ones: recluse-sounds.ts, `arc`.)
    expect([C.crackAt - C.arcAt, C.partAt - C.arcAt]).toEqual([200, 950]);
    // An arc runs from its hand to its point, the same for the same seed, another for another, and its path has no corners.
    const pts = arcPoints([40, 18], [50, 90], 7);
    expect(pts[0]).toEqual([40, 18]);
    expect(pts.at(-1)).toEqual([50, 90]);
    expect(pts).toHaveLength(17);
    expect(arcPoints([40, 18], [50, 90], 7)).toEqual(pts);
    expect(arcPoints([40, 18], [50, 90], 8)).not.toEqual(pts);
    for (const p of pts) expect(Math.abs(p[0] - (40 + ((p[1] - 18) / 72) * 10))).toBeLessThan(16);
    expect(smoothPath(pts)).toMatch(/^M40 18( Q[\d. -]+){15} L50 90$/);
  });

  it("one book on screen: his own, in his frames; the board draws his whole figure (a phone too), his place only his rage", () => {
    for (const a of ON_BOARD_ANIMS) {
      expect(RECLUSE.anims[a], a).toBeDefined();
      expect(RECLUSE_BUST.anims[a], `${a} (the bust)`).toBeUndefined();
    }
    for (const ch of [RECLUSE, RECLUSE_BUST]) expect(ch.anims.rage!.frames.at(-1)!.layers.some((l) => l.part.startsWith("book:")), ch.id).toBe(true);
    // In every frame of it, the book is drawn once: held, falling, lying open, or flying back up.
    for (const a of ["rage", ...ON_BOARD_ANIMS]) RECLUSE.anims[a]!.frames.forEach((f, i) => expect(f.layers.filter((l) => l.part.startsWith("book:")), `${a} ${i}`).toHaveLength(1));
    // He leaps with no shadow under him, and lands in a cloud of dust.
    const leap = RECLUSE.anims.leap!.frames;
    expect(leap.some((f) => !f.layers.some((l) => l.part === "shadow"))).toBe(true);
    expect(leap.find((f) => f.cue === "land")!.specks?.length).toBeGreaterThan(0);
  });
});

describe("his phase 2 lines", () => {
  it("has a line for each moment; the God King's last are his triumph and his cry as he's drained (none in phase 2)", () => {
    for (const k of ["absorb", "engine", "revive", "phase2", "boardWon", "boardLost", "beaten2", "chant"] as const) expect(RECLUSE_LINES[k].length, k).toBeGreaterThan(0);
    for (const p of [1, 2] as const) for (const k of ["early", "middle", "late"] as const) expect(RECLUSE_LINES.talk[p][k].length, `${p} ${k}`).toBeGreaterThan(0);
    expect(Object.keys(KING_VS_RECLUSE).sort()).toEqual(["blocked", "drained", "intro", "triumph"]);
    expect(Object.keys(KING_LINES).filter((c) => c.startsWith("foe")).sort()).toEqual(["foeBlocked", "foeDrained", "foeIntro", "foeTriumph"]);
    // (Placeholders, ours: "Mind and machine", never the film's title.)
    expect(RECLUSE_LINES.absorb).toContain("Mind and machine. Both mine now.");
    for (const line of [...RECLUSE_LINES.absorb, ...RECLUSE_LINES.engine]) expect(line).not.toMatch(/beautiful mind/i);
    expect(RECLUSE_LINES.engine).toEqual(expect.arrayContaining(["Fun, isn't it?", "Look how much fun we're having.", "Not so nice when the engine's on my side, is it?"]));
  });

  it("the boss's word as the power lands comes as it lands (cutting in on his word before the seize), whole until his chant, whose line follows it before the board cracks", () => {
    const C = PHASE_CHANGE;
    expect(C.absorbLineAt).toBeGreaterThanOrEqual(C.igniteAt);
    for (const line of RECLUSE_LINES.absorb) {
      const v = new Voice();
      v.say(RECLUSE_LINES.seizeTalk[0], "talk", NORMAL, C.talkAt);
      v.say(line, "absorb", CRITICAL, C.absorbLineAt);
      expect(v.line(C.absorbLineAt)?.text).toBe(line);
      // (Its whole time, up to the chant at most.)
      expect(v.line(Math.min(C.chantAt, C.absorbLineAt + holdMs(line)) - 1)?.text).toBe(line);
      v.say(RECLUSE_LINES.chant[0], "chant", CRITICAL, C.chantAt);
      // (The chant's line as soon as it's over, while he chants: before the board cracks. Within about a second of the
      // chant until Oct 24; up to about 2.6 s since, the speech rule's longer lines.)
      const chantShows = Math.max(C.chantAt, C.absorbLineAt + holdMs(line));
      expect(v.line(chantShows)?.text, line).toBe(RECLUSE_LINES.chant[0]);
      expect(chantShows + typeMs(RECLUSE_LINES.chant[0]), line).toBeLessThan(C.crackAt);
      // (Typed out, and on screen whole for at least two seconds and a half.)
      expect(C.absorbLineAt + holdMs(line) - SPEECH.fadeMs - (C.absorbLineAt + typeMs(line)), line).toBeGreaterThanOrEqual(2500);
    }
  });

  it("the God King's triumph gives way to his cry as he's drained, each in his own voice; since Oct 17 the triumph has its whole time first", () => {
    resetKingSpeech();
    expect(KING_VS_RECLUSE.triumph).toContain(kingSay("foeTriumph", "t", 1000));
    expect(KING_VS_RECLUSE.triumph).toContain(kingLine(1500)?.text);
    expect(KING_VS_RECLUSE.drained).toContain(kingSay("foeDrained", "d", 1000 + PHASE_CHANGE.drainAt));
    expect(KING_VS_RECLUSE.drained).toContain(kingLine(1100 + PHASE_CHANGE.drainAt)?.text);
    // (Short enough to read before it's cut: typed out in about a second.)
    for (const l of KING_VS_RECLUSE.triumph) expect(l.length).toBeLessThanOrEqual(30);
    for (const l of KING_VS_RECLUSE.triumph) expect(150 + holdMs(l), l).toBeLessThanOrEqual(PHASE_CHANGE.drainAt);
    resetKingSpeech();
  });

  it("names his rivals but never their country or its people (Eric, Oct 14); his own words from the article word for word", () => {
    const all = (o: unknown): string[] => (typeof o === "string" ? [o] : Array.isArray(o) ? o.flatMap(all) : o && typeof o === "object" ? Object.values(o).flatMap(all) : []);
    for (const line of all(RECLUSE_LINES)) expect(line, line).not.toMatch(/soviet|russia/i);
    expect(RECLUSE_LINES.chant.some((l) => /Petrosian/.test(l) && /Keres/.test(l) && /Geller/.test(l))).toBe(true);
    // (Verified on the printed pages of his Sports Illustrated article, Aug 20, 1962: never altered.)
    expect(RECLUSE_LINES.chant).toContain("They worked as a team.");
    // (Each in one phase's chatter only, so a fight never says one twice there.)
    const { 1: p1, 2: p2 } = RECLUSE_LINES.talk;
    expect(p1.middle).toEqual(expect.arrayContaining(["They consulted during the games.", "They would openly analyze my game while I was still playing it."]));
    expect(p1.late).toContain("It made me mad that they thought they could get away with it.");
    expect(p2.middle).toContain("They agreed ahead of time to draw the games they played against each other.");
    expect(p2.late).toEqual(expect.arrayContaining(["They worked as a team.", "I will never again play in one of these tournaments."]));
    const one = all(p1);
    for (const line of all(p2)) expect(one, line).not.toContain(line);
    // (Korchnoi only among the names, never with a word about a game he played.)
    for (const line of all(RECLUSE_LINES).filter((l) => /Korchnoi/.test(l))) expect(line.replace(/[.\s]/g, "")).toMatch(/^(Petrosian|Keres|Geller|Tal|Korchnoi)+$/);
  });
});

/** Pretend engines: his plays the first legal move (sorted), and counts what it's asked; the bots' the same. */
function engines() {
  const asked: { fen: string; elo: number; nodes?: number; moveMs?: number }[] = [];
  const first = (fen: string) => [...legalMoves(fen)].sort()[0]!;
  const boss = {
    playAtElo: (fen: string, elo: number, nodes?: number, moveMs?: number) => {
      asked.push({ fen, elo, nodes, moveMs });
      return Promise.resolve(first(fen));
    },
  };
  const bots = {
    playAtElo: (fen: string) => Promise.resolve(first(fen)),
    topMoves: (fen: string): Promise<MoveScore[]> => Promise.resolve(legalMoves(fen).includes("h5f7") ? [{ move: "h5f7", expected: 1 }] : [{ move: first(fen), expected: 0.5 }]),
  };
  return { boss, bots, asked };
}

describe("phase 2's four boards on this device", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const make = (over: Partial<ConstructorParameters<typeof Phase2Game>[0]> = {}) => {
    const e = engines();
    const done = vi.fn();
    const results: string[] = [];
    const g = new Phase2Game({
      players: ["you", "b1", "b2", "b3"],
      numbers: phase2Numbers(5),
      human: "you",
      boss: e.boss,
      bots: e.bots,
      rng: () => 0.5,
      onChange: () => undefined,
      onResult: (b) => results.push(`${b.id}:${b.result!.winner}:${b.result!.how}`),
      onDone: done,
      ...over,
    });
    return { g, e, done, results };
  };

  it("the test switch: the bots mate at once, your Qxf7 mates too, and all four won beat him", async () => {
    const { g, done, results } = make({ win: true });
    g.start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(g.outcome).toMatchObject({ won: 3, decided: false });
    g.move(0, "h5f7");
    await vi.advanceTimersByTimeAsync(10);
    expect(g.outcome).toMatchObject({ won: 4, beaten: true, decided: true });
    expect(done).toHaveBeenCalledTimes(1);
    expect(results.sort()).toEqual(["0:crowd:mate", "1:crowd:mate", "2:crowd:mate", "3:crowd:mate"]);
  });

  it("he answers on every board with Stockfish at his strength and budget only; your move is yours alone", async () => {
    const moved: number[] = [];
    const { g, e } = make({ onBossMove: (n) => moved.push(n) });
    g.start();
    // (Your move on a bot's board, or an illegal one, does nothing.)
    g.move(1, legalMoves(g.board(1)!.board.fen)[0]!);
    expect(g.board(1)!.board.history).toHaveLength(0);
    g.move(0, [...legalMoves(g.board(0)!.board.fen)].sort()[0]!);
    await vi.advanceTimersByTimeAsync(3000);
    expect(g.board(0)!.board.history.length).toBe(2);
    for (const b of g.state.boards) expect(b.board.history.length).toBeGreaterThanOrEqual(2);
    expect(e.asked.length).toBeGreaterThanOrEqual(4);
    for (const a of e.asked) expect(a).toMatchObject({ elo: RECLUSE_PHASE2.elo, nodes: RECLUSE_PHASE2.nodes, moveMs: RECLUSE_PHASE2.moveMs });
    // (Each of his moves counted, on all the boards together.)
    const his = g.state.boards.reduce((n, b) => n + Math.floor(b.board.history.length / 2), 0);
    expect(moved).toEqual(Array.from({ length: his }, (_, i) => i + 1));
    expect(g.bossMoves).toBe(his);
    g.stop();
  });

  it("your clock runs out: your board is lost on time; the others played on", async () => {
    const { g, results } = make();
    g.start();
    await vi.advanceTimersByTimeAsync(RECLUSE_PHASE2.bankSeconds * 1000 + 400);
    expect(results).toContain("0:boss:time");
    expect(g.board(0)!.result).toEqual({ winner: "boss", how: "time" });
    // (The bots moved all along, each on its own clock: their boards went on after yours stopped.)
    expect(g.state.boards.slice(1).every((b) => b.board.history.length > 2)).toBe(true);
    g.stop();
  });

  it("his ultimate (the admins' trigger): from then on, out of your few seconds, a random legal move is played for you (no loss)", async () => {
    const ult = vi.fn();
    const { g } = make({ onUlt: ult });
    g.start();
    g.ult();
    expect(ult).toHaveBeenCalledTimes(1);
    expect(g.state.ultAt).not.toBeNull();
    // (Its banner first: the few seconds start as it goes, Oct 24.)
    await vi.advanceTimersByTimeAsync(bossBannerMs() + RECLUSE_PHASE2.ultMoveSeconds * 1000 + 300);
    expect(g.board(0)!.result).toBeNull();
    expect(g.board(0)!.board.history.length).toBeGreaterThanOrEqual(1);
    g.ult();
    expect(ult).toHaveBeenCalledTimes(1);
    g.stop();
  });

  it("slow moves count for the team, yours and the bots' (now and then a bot thinks past slowMoveSeconds), each on its board; the 10th brings his ultimate", async () => {
    const slow: [number, boolean][] = [];
    const ult = vi.fn();
    // (rng 0.05: every bot's move is a slow one.)
    const { g } = make({ onSlow: (id, u) => slow.push([id, u]), onUlt: ult, rng: () => 0.05 });
    g.start();
    await vi.advanceTimersByTimeAsync(RECLUSE_PHASE2.botSlowMs[1] + 500);
    expect(g.state.slow).toBeGreaterThanOrEqual(3);
    expect(ult).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(4 * RECLUSE_PHASE2.botSlowMs[1]);
    expect(ult).toHaveBeenCalledTimes(1);
    expect(g.state.slow).toBe(RECLUSE_PHASE2.slowMovesForUlt);
    // One call a slow move, naming its board (the bots' here, never yours: you haven't moved); the last one brought it.
    expect(slow).toHaveLength(RECLUSE_PHASE2.slowMovesForUlt);
    for (const [id] of slow) expect([1, 2, 3]).toContain(id);
    expect(slow.map(([, u]) => u)).toEqual([...Array(RECLUSE_PHASE2.slowMovesForUlt - 1).fill(false), true]);
    g.stop();
  });

  it("resigning your board: lost; the battle ends only once every board is decided", async () => {
    const { g, done } = make();
    g.start();
    g.resign(0);
    expect(g.board(0)!.result?.how).toBe("resign");
    expect(done).not.toHaveBeenCalled();
    g.stop();
  });
});

describe("phase 2 without the God King (Eric, Oct 14: absorbed in the phase change)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("the boards set, a countdown before the clocks (Eric, Oct 17): nothing runs, nobody can move or resign, then every clock starts", () => {
    const m = new SoloMatch([], "Ann", { ...DEFAULT_SETTINGS, ...RAID_SETTINGS }) as unknown as Record<string, (...a: unknown[]) => unknown> & { phase2: unknown; phase: { kind: string; at: number }; exit: unknown; simul: unknown };
    let started = 0;
    let moved = 0;
    m.phase2 = { start: () => started++, stop() {}, move: () => moved++, outcome: { beaten: false, won: 0, of: 4, decided: false }, state: { boards: [], slow: 0, ultAt: null } };
    const t0 = Date.now();
    m.startSimul!();
    expect(m.phase).toEqual({ kind: "simul", at: t0 + PHASE_CHANGE.countdownMs });
    expect(m.exit).toBeNull();
    m.simulMove!(0, "e2e4");
    vi.advanceTimersByTime(PHASE_CHANGE.countdownMs - 1);
    expect([started, moved]).toEqual([0, 0]);
    vi.advanceTimersByTime(1);
    expect(started).toBe(1);
    expect(m.phase).toEqual({ kind: "simul", at: t0 + PHASE_CHANGE.countdownMs });
    m.simulMove!(0, "e2e4");
    expect(moved).toBe(1);
    (m as unknown as { stop(): void }).stop?.();
  });

  it("says nothing as phase 2 begins, as a board is won or lost, or as all four are won; the boss still has his words", () => {
    // (White-box: the moments of SoloMatch's phase 2 that had the God King speak, driven with a pretend Phase2Game.)
    const m = new SoloMatch([], "Ann", { ...DEFAULT_SETTINGS, ...RAID_SETTINGS }) as unknown as Record<string, (...a: unknown[]) => unknown> & { phase2: unknown };
    const outcome = { beaten: false, won: 0, of: 4, decided: false };
    m.phase2 = { start() {}, stop() {}, outcome, state: { boards: [], slow: 0, ultAt: null } };
    resetKingSpeech();
    bossVoice.reset();
    m.startSimul!();
    // (The countdown first: then the clocks, and his line.)
    vi.advanceTimersByTime(PHASE_CHANGE.countdownMs);
    m.phase2Result!("crowd");
    m.phase2Result!("boss");
    Object.assign(outcome, { beaten: true, won: 4, decided: true });
    m.phase2Done!();
    expect(kingLine()).toBeNull();
    expect(bossVoice.line()).not.toBeNull();
    (m as unknown as { stop(): void }).stop?.();
  });
});
