import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BOSS_POWERS, DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type BossPowerState, type Settings } from "@chessroyale/core";
import { MatchRunner, PASS_WAIT, castAnswer, fuseFrom, legalMoves, passAnswer, passLoses, passScores, passTurn, pieceAt, sanLineToUci, type EngineLike, type Opening, type UciEngine } from "../src/index.ts";
import { createNodeEngine } from "../src/node.ts";

/**
 * The pass guard (Eric, Oct 18: "I played vs the elephant and he left his queen hanging and next turn fused his pawns
 * so I captured his queen and won outright"; docs/decisions/2026-10-18-turn-passing-guard.md): one rule for every
 * power that spends his whole turn (Alfil's fusion, Chub & Chirp's Carrot Patch cast). When it's due and passing would
 * lose real material (the engine's evaluation after it, the crowd to move, passGuardPawns below his before it), it
 * waits a turn and he plays his move; it's checked again on his next turn.
 */

const LINE = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5"]);
const opening = (moves: string[]): Opening => ({ id: "o", eco: "", name: "Test", family: "Test", unusual: false, moves, namedPlies: moves.length, expected: { 10: 0.52, 11: 0.48, 12: 0.52 } });
/** A stand-in for the runner's own engine (the crowd's move judged): every legal move alike, the boss's the first. */
const flat: EngineLike = {
  topMoves: async (fen, n) => legalMoves(fen).slice(0, n).map((move) => ({ move, expected: 0.5 })),
  scoreMoves: async (_fen, moves) => moves.map((move) => ({ move, expected: 0.5 })),
  playAtElo: async (fen) => legalMoves(fen)[0]!,
};

/** A Boss alone against `bossId` from a position of our own (the crowd, White, to move), his powers set on top. */
function battle(bossId: "alfil" | "hopper", fen: string, powers: Partial<BossPowerState> = {}, patch: Partial<Settings> = {}): MatchRunner {
  const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossStumbleBelow: 0, bossId, bossUnfinished: true, lastStandFrom: 999, ...patch } as Settings;
  const r = new MatchRunner({ settings, rng: mulberry32(5), engines: [flat], library: [opening(LINE)], entrants: [{ id: "h0", name: "H", isBot: false }] });
  const board = r.boards.get(0)!;
  r.boards.set(0, { ...board, fen, bases: [...(board.bases ?? []), { ply: board.history.length, fen }] });
  r.state = { ...r.state, boss: { ...r.state.boss!, powers: { ...r.state.boss!.powers!, ...powers } } };
  expect(r.boss!.crowdSide).toBe("w");
  return r;
}
const fenOf = (r: MatchRunner) => r.boards.get(0)!.fen;
/** The crowd's move. */
async function crowd(r: MatchRunner, move: string) {
  r.deal();
  await r.score(new Map([["h0", { move, thinkMs: 1000 }]]));
}

/**
 * Eric's case: the crowd's knight (b1-c3) attacks his queen on d5 (your e2 queen behind it too), material level; his a-
 * and h-pawns are marked, so the fusion is due. Passing, he loses the queen for a knight.
 */
const HANGING = "1n2k3/p4ppp/4p3/3q4/8/7P/PP2QPP1/1N2K3 w - - 0 15";
/** The same with his queen on d6, where nothing attacks it: nothing hangs. */
const QUIET = "1n2k3/p4ppp/3qp3/8/8/7P/PP2QPP1/1N2K3 w - - 0 15";
/** His a- and h-pawns marked; the meter held back (these positions have far fewer pieces than the battle began with). */
const MARKED: Partial<BossPowerState> = { tusks: { turn: 0, at: 0, pawns: ["a7", "h7"] }, rageUsed: 1e6 };

describe("the pass guard's rule", () => {
  it("passing loses real material at passGuardPawns or more below zero; the answer is then PASS_WAIT, else the position", () => {
    expect(BOSS_POWERS.passGuardPawns).toBe(2);
    expect(passLoses(-2)).toBe(true);
    expect(passLoses(-1.99)).toBe(false);
    expect(passAnswer({ fen: "x", gain: -6 })).toBe(PASS_WAIT);
    expect(passAnswer({ fen: "x", gain: 0.4 })).toBe("x");
    expect(passAnswer(null)).toBeNull();
  });

  it("the gain is his evaluation after it (the crowd to move) against before (him to move), in pawns of log-odds; `ahead` goes on both", async () => {
    const seen: string[] = [];
    // (Before: 0.5 for him; after: 0.9 for the crowd, so 0.1 for him: log-odds 2.2 down.)
    const engine: EngineLike = { topMoves: async (f) => (seen.push(f), [{ move: "a1a2", expected: f.startsWith("before") ? 0.5 : 0.9 }]), scoreMoves: async () => [] };
    const [s] = (await passScores([engine], "before", ["after"], 1000, BOSS_POWERS, (f) => `${f}+`))!;
    expect(seen).toEqual(["before+", "after+"]);
    expect(s!.fen).toBe("after");
    expect(s!.gain).toBeCloseTo(Math.log(0.1 / 0.9) / BOSS_POWERS.bouncePawnLogit, 6);
    expect(await passScores([], "before", ["after"], 1000)).toBeNull();
  });
});

describe("the pass guard on the real engine", () => {
  let engine: UciEngine;
  beforeAll(async () => {
    engine = await createNodeEngine({ nodes: 100_000, hashMb: 16 });
  }, 60_000);
  afterAll(() => engine?.close());

  it("Eric's case: his queen en prise as the fusion comes due: it waits, the marks staying, and he moves; on his next turn it fuses", async () => {
    const r = battle("alfil", HANGING, MARKED);
    await crowd(r, "b1c3");
    expect(r.alfilStep()).toBe("fuse");
    // (The engine's measure: even the better square loses far more than two pawns.)
    expect((await fuseFrom([engine], fenOf(r), r.alfilCandidates()))!.gain).toBeLessThanOrEqual(-BOSS_POWERS.passGuardPawns);
    const before = fenOf(r);
    expect(await r.playAlfil([engine])).toBeNull();
    const p = r.boss!.powers!;
    expect(p.tusks!.pawns).toEqual(["a7", "h7"]);
    expect(p.fusion ?? null).toBeNull();
    expect(p.fused ?? 0).toBe(0);
    expect(p.passWait).toBe(r.boss!.crowdMoves);
    expect(fenOf(r)).toBe(before);
    // His move instead (asked for at once: the step is done for this turn); the queen steps back.
    expect(r.bossToMove()).toBe(true);
    expect(r.alfilStep()).toBeNull();
    r.applyBossMove("d5d6");
    // Your move takes neither marked pawn; his next turn: the fusion again, and now it comes.
    await crowd(r, "h3h4");
    expect(r.alfilStep()).toBe("fuse");
    expect(await r.playAlfil([engine])).toBe("fuse");
    const q = r.boss!.powers!;
    expect(q).toMatchObject({ tusks: null, fused: 1 });
    expect(["a7", "h7"]).toContain(q.fusion!.to);
    expect(pieceAt(fenOf(r), q.fusion!.to!)).toEqual({ color: "b", type: "b" });
    expect(r.bossToMove()).toBe(false);
  }, 60_000);

  it("nothing hanging: the fusion on time", async () => {
    const r = battle("alfil", QUIET, MARKED);
    await crowd(r, "b1c3");
    expect(r.alfilStep()).toBe("fuse");
    expect((await fuseFrom([engine], fenOf(r), r.alfilCandidates()))!.gain).toBeGreaterThan(-1);
    expect(await r.playAlfil([engine])).toBe("fuse");
    expect(r.boss!.powers!.fused).toBe(1);
    expect(r.boss!.powers!.passWait).toBeUndefined();
  }, 60_000);

  it("the Carrot Patch cast: his queen en prise, it waits, the warning staying, and he moves; on his next turn it comes; nothing hanging, on time", async () => {
    const r = battle("hopper", HANGING, {}, { bossPowerTest: "carrotpatch" });
    await crowd(r, "b1c3");
    expect(r.carrotDue()).toBe(true);
    const before = fenOf(r);
    expect(await castAnswer([engine], before)).toBe(PASS_WAIT);
    expect(await r.playCarrots([engine])).toBeNull();
    const p = r.boss!.powers!;
    expect(p.carrots).toBeUndefined();
    expect(p.passWait).toBe(r.boss!.crowdMoves);
    // (The warning stays, so "next turn" stays true: the ultimate is still on its way.)
    expect(p.warnAt).toBe(1);
    expect(r.bossView()!.powers!.warned).toBe(true);
    expect(fenOf(r)).toBe(before);
    expect(r.carrotDue()).toBe(false);
    expect(r.bossToMove()).toBe(true);
    r.applyBossMove("d5d6");
    await crowd(r, "h3h4");
    expect(r.carrotDue()).toBe(true);
    expect(await castAnswer([engine], fenOf(r))).toBe(passTurn(fenOf(r)));
    expect((await r.playCarrots([engine]))!.squares).toHaveLength(BOSS_POWERS.carrotCount);
    expect(r.bossToMove()).toBe(false);
    // Nothing hanging: the cast as it comes due.
    const quiet = battle("hopper", QUIET, {}, { bossPowerTest: "carrotpatch" });
    await crowd(quiet, "b1c3");
    expect(await quiet.playCarrots([engine])).not.toBeNull();
    // No engine (or no answer): it comes, as ever.
    const blind = battle("hopper", HANGING, {}, { bossPowerTest: "carrotpatch" });
    await crowd(blind, "b1c3");
    expect(await castAnswer([], fenOf(blind))).toBeNull();
    expect(blind.applyCarrots(null)).not.toBeNull();
  }, 60_000);
});
