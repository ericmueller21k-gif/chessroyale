import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, clockAfterVote, modeSettings, mulberry32, type Settings } from "@chessroyale/core";
import { legalMoves, MatchRunner, START_FEN, sanLineToUci, type EngineLike, type Opening } from "../src/index.ts";

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
const line = sanLineToUci(["e4", "e5", "Nf3"]);
const library: Opening[] = [
  { id: "start", eco: "", name: "Starting position", family: "Starting position", unusual: false, moves: line.slice(0, 1), namedPlies: 1, expected: { 0: 0.5, 1: 0.5 } },
];

async function playKnockouts(settings: Settings, seed: number) {
  const runner = new MatchRunner({
    settings,
    rng: mulberry32(seed),
    engines: [fake],
    library,
    entrants: Array.from({ length: 100 }, (_, i) => ({ id: `b${i}`, name: `B${i}`, isBot: true, skill: 1 + (i % 20) })),
  });
  expect(runner.boards.get(0)!.fen).toBe(START_FEN);
  const sizes: number[] = [];
  let plies = 0;
  while (!runner.isFinal()) {
    const groups = runner.deal();
    expect(groups.size).toBe(1);
    const [[boardId, ids]] = [...groups] as [[number, string[]]];
    const side = runner.boards.get(boardId)!.fen.split(" ")[1];
    if (settings.crowdTeams) {
      // Only the team whose side is to move picks.
      expect(ids.every((id) => runner.player(id).colour === side)).toBe(true);
      expect(ids.length).toBe(runner.alive().length / 2);
    } else {
      expect(ids.length).toBe(runner.alive().length);
    }
    await runner.score(new Map());
    plies++;
    if (runner.stageComplete()) {
      runner.endStage();
      sizes.push(runner.alive().length);
      if (settings.crowdTeams) {
        // Teams stay even all the way down.
        const w = runner.alive().filter((p) => p.colour === "w").length;
        expect(w * 2).toBe(runner.alive().length);
      }
    }
  }
  return { runner, sizes, plies };
}

describe("Crowd mode", () => {
  const base: Settings = { ...DEFAULT_SETTINGS, ...modeSettings("crowd") };

  it("50 v 50: one board, teams alternate, cuts after move 10 and every move, team top-twos in the final", async () => {
    const settings: Settings = { ...base, crowdTeams: true };
    const { runner, sizes, plies } = await playKnockouts(settings, 1);
    expect(sizes).toEqual([84, 70, 58, 48, 40, 32, 26, 20, 16, 12, 8, 6, 4]);
    expect(plies).toBe(20 + 2 * 12);
    // The final: each team's top two, the side to move first, alternating teams.
    const f = runner.final!;
    const side = runner.boards.get(runner.state.boards[0]!)!.fen.split(" ")[1];
    expect(f.teams[0].every((id) => runner.player(id).colour === side)).toBe(true);
    expect(f.teams[1].every((id) => runner.player(id).colour !== side)).toBe(true);
    expect(f.order).toEqual([f.teams[0][0], f.teams[1][0], f.teams[0][1], f.teams[1][1]]);
    while (!runner.stageComplete()) {
      runner.deal();
      await runner.score(new Map());
    }
    runner.finishFinal();
    expect(runner.isOver()).toBe(true);
    expect(runner.state.players.map((p) => p.placement).sort((a, b) => a! - b!)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
    expect(runner.leaderboard()[0]!.team).toMatch(/^[wb]$/);
  });

  it("everyone moves: all alive pick every ply, cut by overall standings", async () => {
    const settings: Settings = { ...base, crowdTeams: false };
    const { runner, sizes } = await playKnockouts(settings, 2);
    expect(sizes.at(-1)).toBe(4);
    expect(runner.final!.order).toHaveLength(4);
    expect(runner.leaderboard()[0]!.team).toBeNull();
  });

  it("bot picks decided at the start of a round are the ones scored", async () => {
    const settings: Settings = { ...base, crowdTeams: true };
    const runner = new MatchRunner({
      settings,
      rng: mulberry32(5),
      engines: [fake],
      library,
      entrants: Array.from({ length: 100 }, (_, i) => ({ id: `b${i}`, name: `B${i}`, isBot: true, skill: 1 + (i % 20) })),
    });
    for (let round = 0; round < 3; round++) {
      runner.deal();
      const planned = new Map(await runner.planBotPicks());
      expect(planned.size).toBe(50);
      const report = await runner.score(new Map());
      for (const p of report.boards[0]!.result.players) expect(p.move).toBe(planned.get(p.playerId));
    }
  });

  it("augment votes: majority moves the clock by a step, within limits; ties keep it", () => {
    expect(clockAfterVote(20, ["more", "more", "less"], base)).toBe(25);
    expect(clockAfterVote(20, ["less", "less", "same"], base)).toBe(15);
    expect(clockAfterVote(20, ["more", "less"], base)).toBe(20);
    expect(clockAfterVote(20, [], base)).toBe(20);
    expect(clockAfterVote(40, ["more"], base)).toBe(40);
    expect(clockAfterVote(10, ["less"], base)).toBe(10);
  });
});
