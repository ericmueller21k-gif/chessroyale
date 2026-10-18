import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type CarrotPatch, type Settings } from "@chessroyale/core";
import { MatchRunner, crowdRace, legalMoves, type EngineLike, type Opening, type UciEngine } from "@chessroyale/chess";
import { SoloMatch } from "../src/solo.ts";
import { NetMatch } from "../src/net.ts";

/**
 * The eval bar during Chub & Chirp's Carrot Patch race reads the engine's own evaluation, carrots ignored, solo and
 * online (docs/decisions/2026-10-18-carrot-patch.md): the race's judge weighs moves by what the carrots are worth,
 * which isn't the position's value.
 */

// (Your rook on b1 and his knight on d6 each a move from the b5 carrot: the race prefers b1b5; the engine scores h1g1
// 0.52 and every other move 0.5.)
const FEN = "4k3/8/3n4/8/8/8/8/1R5K w - - 0 30";
const engine: EngineLike = {
  topMoves: async (fen, n) =>
    legalMoves(fen)
      .map((move) => ({ move, expected: move === "h1g1" ? 0.52 : 0.5 }))
      .sort((a, b) => b.expected - a.expected || (a.move < b.move ? -1 : 1))
      .slice(0, n),
  scoreMoves: async (fen, moves) => [...new Set(moves)].sort().map((move) => ({ move, expected: move === "h1g1" ? 0.52 : 0.5 })),
  playAtElo: async (fen) => legalMoves(fen).sort()[0]!,
};
const RUY = ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6", "b5a4", "g8f6", "e1g1", "f8e7", "f1e1", "b7b5"];
const opening: Opening = { id: "o", eco: "", name: "Test", family: "Test", unusual: false, moves: RUY, namedPlies: RUY.length, expected: { 10: 0.52, 11: 0.48, 12: 0.52 } };

/** A Boss alone against him, from FEN with the race on (the five carrots in the ground). */
function racing(): MatchRunner {
  const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossId: "hopper", bossUnfinished: true, lastStandFrom: 999 } as Settings;
  const r = new MatchRunner({ settings, rng: mulberry32(5), engines: [engine], library: [opening], entrants: [{ id: "h0", name: "H", isBot: false }] });
  const board = r.boards.get(0)!;
  r.boards.set(0, { ...board, fen: FEN, bases: [...(board.bases ?? []), { ply: board.history.length, fen: FEN }] });
  const carrots: CarrotPatch = { at: 0, squares: ["b5", "h8", "a3", "h4", "e5"], pulls: [], crowdMoves: 0, bossMoves: 0 };
  r.state = { ...r.state, boss: { ...r.state.boss!, powers: { ...r.state.boss!.powers!, ultAt: 0, ults: 1, carrots } } };
  return r;
}

describe("the eval bar during the Carrot Patch race", () => {
  it("solo: the engine's own evaluation (White's 0.52), not the race's weighing the judge and the hints use", async () => {
    const m = new SoloMatch([engine as UciEngine], "Ann", DEFAULT_SETTINGS);
    m.runner = racing();
    expect(crowdRace(m.runner.boss, FEN)).not.toBeNull();
    // (The race's weighing puts b1b5 first and lowers the engine's best: what the bar showed before.)
    const judged = await m.runner.topMovesFor(FEN);
    expect(judged[0]!.move).toBe("b1b5");
    expect(judged[0]!.expected).toBeLessThan(0.52);
    expect(await m.evaluate(FEN)).toBe(0.52);
  });

  it("online: the engine's own evaluation too (the app's search, no boss rules)", async () => {
    const m = new NetMatch("TEST", "Ann", async () => [engine as unknown as UciEngine]);
    expect(await m.evaluate(FEN)).toBe(0.52);
  });
});
