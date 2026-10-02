import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, finishDuel, mulberry32, type Settings } from "@chessroyale/core";
import { legalMoves, MatchRunner, START_FEN, sanLineToUci, fenAfter, type EngineLike, type Opening } from "../src/index.ts";

/** A stand-in engine: every legal move gets a deterministic pseudo-score. */
const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};
const fake: EngineLike = {
  async topMoves(fen, n) {
    return legalMoves(fen)
      .map((move) => ({ move, expected: 0.3 + 0.4 * hash(fen + move) }))
      .sort((a, b) => b.expected - a.expected)
      .slice(0, n);
  },
  async scoreMoves(fen, moves) {
    return moves.map((move) => ({ move, expected: 0.3 + 0.4 * hash(fen + move) }));
  },
};

const line = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5", "Bb3", "d6", "c3", "O-O", "h3", "Nb8", "d4", "Nbd7", "c4"]);
const library: Opening[] = Array.from({ length: 30 }, (_, i) => ({
  id: `o${i}`,
  eco: "C95",
  name: `Opening ${i}`,
  family: `Family ${i}`,
  unusual: i >= 25,
  moves: line,
  namedPlies: 21,
  expected: { 20: 0.5, 21: 0.5 },
}));

describe("MatchRunner", () => {
  it("plays a whole match of 32 bots down to the duel; players keep one colour per stage", async () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, roundsPerStage: 3 };
    const rng = mulberry32(1);
    const runner = new MatchRunner({
      settings,
      rng,
      engines: [fake, fake],
      library,
      entrants: Array.from({ length: 32 }, (_, i) => ({ id: `b${i}`, name: `B${i}`, isBot: true, skill: 1 + i })),
    });
    expect(fenAfter(line.slice(0, 20))).toBe(runner.boards.get(0)!.fen);
    let rounds = 0;
    let lastStage = -1;
    let colours = new Map<string, string | null>();
    while (!runner.isDuel()) {
      const groups = runner.deal();
      const sides = [...groups.keys()].map((id) => runner.boards.get(id)!.fen.split(" ")[1]);
      if (groups.size >= 2) {
        // Half the boards have each side to move, and everyone sits on a board where their colour is to move.
        expect(sides.filter((s) => s === "w")).toHaveLength(groups.size / 2);
        for (const [id, ids] of groups) for (const pid of ids) expect(runner.player(pid).colour).toBe(runner.boards.get(id)!.fen.split(" ")[1]);
      }
      // Colours stay fixed through a stage, and most players swap at the break.
      const now = new Map(runner.alive().map((p) => [p.id, p.colour]));
      if (runner.state.stage === lastStage) expect(now).toEqual(colours);
      else if (lastStage >= 0 && groups.size >= 2) {
        const swapped = [...now].filter(([id, c]) => colours.get(id) && colours.get(id) !== c).length;
        expect(swapped).toBeGreaterThanOrEqual(now.size / 2);
      }
      lastStage = runner.state.stage;
      colours = now;
      expect([...groups.values()].every((g) => g.length === 4)).toBe(true);
      const report = await runner.score(new Map());
      for (const b of report.boards) {
        const sum = b.result.players.reduce((s, p) => s + p.roundScore, 0);
        expect(sum).toBeCloseTo(0, 6);
      }
      rounds++;
      if (runner.stageComplete()) runner.endStage();
    }
    expect(rounds).toBe(15);
    expect(runner.alive()).toHaveLength(2);
    runner.state = finishDuel(runner.state, runner.alive()[0]!.id);
    expect(runner.state.players.map((p) => p.placement).sort((a, b) => a! - b!)).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
  });

  it("scores a human's pick and a miss", async () => {
    const rng = mulberry32(2);
    const runner = new MatchRunner({
      settings: DEFAULT_SETTINGS,
      rng,
      engines: [fake],
      library,
      entrants: [{ id: "me", name: "Me", isBot: false }, ...Array.from({ length: 31 }, (_, i) => ({ id: `b${i}`, name: `B${i}`, isBot: true, skill: 2 }))],
    });
    runner.deal();
    const board = runner.boardOf("me")!;
    const move = legalMoves(board.fen)[0]!;
    const report = await runner.score(new Map([["me", { move, thinkMs: 3000 }]]));
    const mine = report.boards.flatMap((b) => b.result.players).find((p) => p.playerId === "me")!;
    expect(mine.move).toBe(move);
    expect(mine.loss).not.toBeNull();

    runner.deal();
    const report2 = await runner.score(new Map());
    const missed = report2.boards.flatMap((b) => b.result.players).find((p) => p.playerId === "me")!;
    expect(missed.roundScore).toBe(-25);
    void START_FEN;
  });

  it("can be saved and restored mid-match (as the lobby server does between messages)", async () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, roundsPerStage: 2 };
    const runner = new MatchRunner({
      settings,
      rng: mulberry32(3),
      engines: [fake],
      library,
      entrants: Array.from({ length: 32 }, (_, i) => ({ id: `b${i}`, name: `B${i}`, isBot: true, skill: 3 })),
    });
    runner.deal();
    await runner.score(new Map());
    const saved = JSON.parse(JSON.stringify(runner.snapshot()));
    const restored = MatchRunner.restore(saved, { settings, rng: mulberry32(4), engines: [fake], library });
    expect(restored.state).toEqual(runner.state);
    expect(restored.boards.get(0)!.fen).toBe(runner.boards.get(0)!.fen);
    restored.deal();
    const report = await restored.score(new Map());
    expect(report.boards).toHaveLength(8);
    expect(restored.stageComplete()).toBe(true);
  });
});

