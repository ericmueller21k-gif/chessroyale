import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { BOSS_BRAIN, DEFAULT_SETTINGS, RAID_SETTINGS, RECLUSE_CHILD, childAge, childRating, childStep, childSteps, levelForMaia, maiaRatingFor, maiaTopRating, mulberry32, type Settings } from "@chessroyale/core";
import { MatchRunner, START_FEN, WIN_TEST_MOVES, bossRules, bulletMeter, kingHelpBlocked, legalMoves, sanLineToUci, type EngineLike, type HumanEngineLike, type Opening } from "../src/index.ts";

/**
 * The Hidden Boss's child form (Eric, Nov 12-13; RECLUSE_CHILD): his first form, before today's adult one. No powers, Maia at
 * 1800 rising 100 every 4 moves on the board to Maia's top (his adult form's brain), his drawings growing with it; beaten, a new
 * match against his adult form.
 */

const isKnight = (fen: string, m: string) => new Chess(fen).get(m.slice(0, 2) as never)?.type === "n";
const empty = (fen: string, m: string) => !new Chess(fen).get(m.slice(2, 4) as never);
/** A stand-in engine: knights shuffle onto empty squares when they can, so the game lasts. */
function fakeEngine(): EngineLike {
  const score = (fen: string, m: string) => 0.3 + 0.4 * ((fen.length * 31 + m.charCodeAt(1) * 7 + m.charCodeAt(3)) % 100) / 100;
  return {
    topMoves: async (fen, n) =>
      legalMoves(fen)
        .map((move) => ({ move, expected: score(fen, move) }))
        .sort((a, b) => b.expected - a.expected)
        .slice(0, n),
    scoreMoves: async (fen, moves) => [...new Set(moves)].sort().map((move) => ({ move, expected: score(fen, move) })),
    topMovesAt: async () => [{ move: "0000", expected: 0.5 }],
    playAtElo: async (fen) => {
      const all = legalMoves(fen).sort();
      return all.find((m) => isKnight(fen, m) && empty(fen, m)) ?? all[0]!;
    },
  };
}
const RUY = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7"]);
const opening = (moves: string[]): Opening => ({ id: "o", eco: "", name: "Test", family: "Test", unusual: false, moves, namedPlies: moves.length, expected: { [moves.length]: 0.52 } });
function alone(extra: Partial<Settings> = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 1400, bossId: "recluse", bossHidden: true, recluseChild: true, ...extra } as Settings;
  return new MatchRunner({ settings, rng: mulberry32(5), engines: [fakeEngine()], library: [opening(RUY)], entrants: [{ id: "h0", name: "H", isBot: false }] });
}
function crowdMove(r: MatchRunner): string {
  const fen = r.boards.get(0)!.fen;
  const allowed = r.crowdAllowed() ?? legalMoves(fen);
  return [...allowed].sort().find((m) => isKnight(fen, m) && empty(fen, m)) ?? [...allowed].sort()[0]!;
}
/** One move on the board: the boss's if it's his turn, else the crowd's (dealt and scored). */
async function step(r: MatchRunner) {
  if (r.bossToMove()) return void (await r.playBoss());
  r.deal();
  await r.score(new Map([["h0", { move: crowdMove(r), thinkMs: 1000 }]]));
}
/** A stand-in Maia: records the rating it's asked to play each move at, and plays the first allowed move. */
function fakeMaia(asked: number[]): HumanEngineLike {
  return {
    ready: () => true,
    candidates: async (fen, rating, allowed) => {
      asked.push(rating);
      const all = [...(allowed ?? legalMoves(fen))].sort();
      // (A different move each time, so the game neither repeats nor ends early.)
      const best = all[(asked.length * 7) % all.length]!;
      return { best, moves: [{ move: best, p: 1 }], ms: 1 } as never;
    },
  };
}

describe("his strength in the child form: Maia from 1800, +100 every 4 moves on the board, up to Maia's top", () => {
  it("the ramp by moves played (both sides'): 1800 for the first 4, then a step every 4, held at the top", () => {
    expect(RECLUSE_CHILD).toMatchObject({ startRating: 1800, stepRating: 100, everyPlies: 4 });
    const top = maiaTopRating();
    expect(top).toBe(2500);
    expect(BOSS_BRAIN.maiaRating.at(-1)![1]).toBe(top);
    expect([0, 1, 2, 3].map((n) => childRating(n))).toEqual([1800, 1800, 1800, 1800]);
    expect([4, 7, 8, 12, 16, 20, 24].map((n) => childRating(n))).toEqual([1900, 1900, 2000, 2100, 2200, 2300, 2400]);
    expect([27, 28, 29, 40, 200].map((n) => childRating(n))).toEqual([2400, 2500, 2500, 2500, 2500]);
    expect(childSteps()).toBe(7);
    expect([0, 3, 4, 27, 28, 400].map((n) => childStep(n))).toEqual([0, 0, 1, 6, 7, 7]);
  });

  it("the cap is Maia's top whatever its settings say (a higher top, more steps; the step never passes it)", () => {
    expect(childRating(100, RECLUSE_CHILD, 2350)).toBe(2350);
    expect(childSteps(RECLUSE_CHILD, 2350)).toBe(6);
    expect(childRating(20, RECLUSE_CHILD, 2350)).toBe(2300);
    expect(childRating(24, RECLUSE_CHILD, 2350)).toBe(2350);
  });

  it("his drawings grow with it: about 9, 13, 20, then his adult look, the last exactly at the top (the man you meet next)", () => {
    expect(RECLUSE_CHILD.ages.length).toBe(4);
    expect(RECLUSE_CHILD.ages[0]).toBe(RECLUSE_CHILD.startRating);
    expect(RECLUSE_CHILD.ages.at(-1)).toBe(maiaTopRating());
    expect([...RECLUSE_CHILD.ages].sort((a, b) => a - b)).toEqual([...RECLUSE_CHILD.ages]);
    expect([1800, 1900, 2000, 2100, 2200, 2400, 2500].map((r) => childAge(r))).toEqual([0, 0, 1, 1, 2, 2, 3]);
    // (Every age shows at some step of the ramp: none is skipped.)
    const seen = new Set(Array.from({ length: childSteps() + 1 }, (_, i) => childAge(childRating(i * RECLUSE_CHILD.everyPlies))));
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });

  it("Stockfish's stand-in strength (while Maia loads) is the level Maia's lines give that rating", () => {
    for (const r of [1800, 1900, 2200, 2499]) expect(Math.abs(maiaRatingFor(levelForMaia(r)) - r)).toBeLessThanOrEqual(2);
    expect(levelForMaia(2500)).toBe(BOSS_BRAIN.maiaRating.at(-1)![0]);
    expect(levelForMaia(1800)).toBeLessThan(levelForMaia(2400));
  });
});

describe("the child form in the match", () => {
  it("starts in it where the settings ask (solo); without them, his adult form as today", () => {
    expect(alone().boss!.form).toBe("child");
    expect(alone({ recluseChild: false }).boss!.form).toBeUndefined();
    // (Another boss never has it.)
    expect(alone({ bossId: "clown", bossHidden: false }).boss!.form).toBeUndefined();
  });

  it("no powers: no meter, no bullet clock, no 'No help' (the God King's help works); he never strikes; from the starting position", async () => {
    const r = alone();
    expect(r.boards.get(0)!.fen).toBe(START_FEN);
    const v = r.bossView()!;
    expect(v.form).toBe("child");
    expect(v.powers).toBeUndefined();
    expect(kingHelpBlocked(r.boss)).toBe(false);
    expect(bossRules(r.boss)?.noStrikes).toBe(true);
    expect(bossRules(r.boss)?.blocksKing).toBeFalsy();
    for (let i = 0; i < 20 && !r.stageComplete(); i++) await step(r);
    expect(r.bossView()!.powers).toBeUndefined();
    expect(r.boss!.powers!.ultAt).toBeUndefined();
    expect(r.bossView()!.strikeIn).toBeNull();
  });

  it("his brain plays each move at the ramp's rating (Maia, raw), and his level rises a step at a time from his first", async () => {
    const r = alone();
    const asked: number[] = [];
    const plan = r.bossBrainPlan("", true)!;
    expect(plan).toMatchObject({ brain: "maia-raw", rating: maiaTopRating() });
    r.humanBrain = { brain: plan.brain, rating: plan.rating!, engine: fakeMaia(asked) };
    const levels: number[] = [];
    const steps: number[] = [];
    for (let i = 0; i < 36 && !r.stageComplete(); i++) {
      levels.push(r.bossView()!.level!);
      steps.push(r.bossView()!.formStep!);
      await step(r);
    }
    // (The crowd is White: he moves at plies 1, 3, 5...: 1800 for his first two, then a step every two of his.)
    expect(asked.slice(0, 15)).toEqual([1800, 1800, 1900, 1900, 2000, 2000, 2100, 2100, 2200, 2200, 2300, 2300, 2400, 2400, 2500]);
    expect(asked.slice(15).every((x) => x === 2500)).toBe(true);
    expect(steps.slice(0, 9)).toEqual([0, 0, 0, 0, 1, 1, 1, 1, 2]);
    // (The level: known, never "???", rising with each step and never falling.)
    expect(levels.every((l) => typeof l === "number")).toBe(true);
    for (let i = 1; i < levels.length; i++) expect(levels[i]!).toBeGreaterThanOrEqual(levels[i - 1]!);
    expect(levels.at(-1)!).toBeGreaterThan(levels[0]!);
    expect(r.bossView()!.levelBase).toBe(levels[0]);
  });

  it("the form order: the child beaten (the admins' Win this form) places nobody; a new match against his adult form from the start; beaten again, the fight is over", async () => {
    const r = alone();
    await step(r);
    await step(r);
    expect(r.boards.get(0)!.history.length).toBe(2);
    r.bossForceWin = true;
    for (let i = 0; i < 4 && !r.stageComplete(); i++) await step(r);
    expect(r.stageComplete()).toBe(true);
    expect(r.finishBossBattle()).toBe("crowd");
    expect(r.boss).toMatchObject({ form: "child", result: "crowd" });
    expect(r.isOver()).toBe(false);
    expect(r.alive().map((p) => p.id)).toEqual(["h0"]);
    expect(r.bossForceWin).toBe(false);
    // The adult form: a new match.
    expect(r.nextBossForm()).toBe(true);
    const b = r.boss!;
    expect(b.form).toBeUndefined();
    expect(b.result).toBeUndefined();
    expect(b.crowdMoves).toBe(0);
    expect(r.boards.get(0)!.fen).toBe(START_FEN);
    expect(r.boards.get(0)!.history).toEqual([]);
    expect(r.stageComplete()).toBe(false);
    const v = r.bossView()!;
    expect(v.form).toBeUndefined();
    expect(v.level).toBeNull();
    expect(v.powers).toMatchObject({ passive: "nohelp", ultimate: "bullet" });
    expect(kingHelpBlocked(r.boss)).toBe(true);
    // (His bullet meter from empty, his own as ever.)
    expect(bulletMeter(b.powers!, 1)).toBe(0);
    // No third form: beaten again, the fight is over (his phase 2 follows on the device, as today).
    expect(r.nextBossForm()).toBe(false);
    r.bossForceWin = true;
    for (let i = 0; i < 4 && !r.stageComplete(); i++) await step(r);
    expect(r.finishBossBattle()).toBe("crowd");
    expect(r.isOver()).toBe(true);
    expect(r.nextBossForm()).toBe(false);
  });

  it("the child winning ends the fight, as his adult form's does: everyone placed, no adult form", async () => {
    // (?mate=1: the crowd mated in one, his move.)
    const r = alone({ bossMateTest: true });
    expect(r.boss!.form).toBe("child");
    await r.playBoss();
    expect(r.stageComplete()).toBe(true);
    expect(r.finishBossBattle()).toBe("boss");
    expect(r.isOver()).toBe(true);
    expect(r.nextBossForm()).toBe(false);
  });

  it("under ?win=1 each form starts a mate in one (so a test beats both)", () => {
    const r = alone({ bossWinTest: true });
    expect(r.boards.get(0)!.history).toEqual([...WIN_TEST_MOVES]);
    r.state.boss!.result = "crowd";
    expect(r.nextBossForm()).toBe(true);
    expect(r.boards.get(0)!.history).toEqual([...WIN_TEST_MOVES]);
    expect(r.boss!.startPly).toBe(WIN_TEST_MOVES.length);
  });
});
