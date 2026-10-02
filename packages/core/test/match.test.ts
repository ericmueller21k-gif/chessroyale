import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  alivePlayers,
  applyRound,
  assignGroups,
  botPick,
  createMatch,
  endStage,
  finishDuel,
  isDuel,
  keepBoards,
  mulberry32,
  retireReason,
  stagePlan,
  standings,
  type MatchState,
} from "../src/index.ts";

const entrants = Array.from({ length: 32 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, isBot: i > 0, skill: i }));
const boards = [0, 1, 2, 3, 4, 5, 6, 7];

describe("stagePlan", () => {
  it("matches the spec's table", () => {
    expect(stagePlan().map((s) => [s.players, s.boards, s.knockouts])).toEqual([
      [32, 8, 8],
      [24, 6, 8],
      [16, 4, 8],
      [8, 2, 4],
      [4, 1, 2],
    ]);
  });
});

describe("assignGroups", () => {
  it("puts 4 players on each board and never the same board twice in a row while 4+ boards", () => {
    const rng = mulberry32(1);
    let state: MatchState = createMatch(entrants, boards);
    for (let round = 0; round < 8; round++) {
      const groups = assignGroups(rng, state);
      expect([...groups.values()].every((g) => g.length === 4)).toBe(true);
      expect(new Set([...groups.values()].flat()).size).toBe(32);
      for (const [b, ids] of groups) {
        for (const id of ids) {
          const p = state.players.find((x) => x.id === id)!;
          expect(p.lastBoard).not.toBe(b);
        }
      }
      state = applyRound(
        state,
        groups,
        state.players.map((p) => ({ playerId: p.id, roundScore: 0, loss: 0, thinkMs: 0 })),
      );
    }
  });

  it("avoids repeat groupmates where possible", () => {
    const rng = mulberry32(2);
    let state: MatchState = createMatch(entrants, boards);
    const g1 = assignGroups(rng, state);
    state = applyRound(state, g1, state.players.map((p) => ({ playerId: p.id, roundScore: 0, loss: 0, thinkMs: 0 })));
    const g2 = assignGroups(rng, state);
    let repeats = 0;
    for (const ids of g2.values())
      for (const id of ids) {
        const p = state.players.find((x) => x.id === id)!;
        repeats += ids.filter((o) => o !== id && p.lastGroupmates.includes(o)).length;
      }
    expect(repeats).toBe(0);
  });
});

describe("stages", () => {
  it("knocks out the lowest scorers, with less thinking time breaking ties, and resets scores", () => {
    let state = createMatch(entrants, boards);
    const groups = assignGroups(mulberry32(3), state);
    state = applyRound(
      state,
      groups,
      state.players.map((p, i) => ({
        playerId: p.id,
        roundScore: i < 8 ? -10 : 5, // p0..p7 score lowest
        loss: 0,
        thinkMs: i === 7 ? 1000 : 9000, // p7 thought least, but still among the lowest
      })),
    );
    // Tie at 5 among p8..p31: those with less thinking time rank higher.
    const end = endStage(state, mulberry32(4), [0, 1, 2, 3, 4, 5]);
    expect(end.knockedOut.map((p) => p.id).sort()).toEqual(["p0", "p1", "p2", "p3", "p4", "p5", "p6", "p7"].sort());
    expect(end.knockedOut.every((p) => p.placement! >= 25)).toBe(true);
    expect(alivePlayers(end.state)).toHaveLength(24);
    expect(alivePlayers(end.state).every((p) => p.stageScore === 0)).toBe(true);
    expect(end.state.boards).toEqual([0, 1, 2, 3, 4, 5]);
    // p7 had the least thinking time of the -10 group, so it ranks 25th, not 32nd.
    expect(end.knockedOut.find((p) => p.id === "p7")!.placement).toBe(25);
  });

  it("carries scores over when set to", () => {
    let state = createMatch(entrants, boards);
    state = applyRound(state, assignGroups(mulberry32(3), state), state.players.map((p, i) => ({ playerId: p.id, roundScore: i, loss: 0, thinkMs: 0 })));
    const end = endStage(state, mulberry32(4), boards, { ...DEFAULT_SETTINGS, scoresBetweenStages: "carry" });
    expect(alivePlayers(end.state).find((p) => p.id === "p31")!.stageScore).toBe(31);
  });

  it("runs through all five stages to the duel", () => {
    let state = createMatch(entrants, boards);
    const rng = mulberry32(5);
    for (const plan of stagePlan()) {
      expect(alivePlayers(state)).toHaveLength(plan.players);
      const groups = assignGroups(rng, state);
      state = applyRound(state, groups, alivePlayers(state).map((p) => ({ playerId: p.id, roundScore: rng(), loss: 0, thinkMs: 0 })));
      const next = stagePlan()[plan.index + 1];
      state = endStage(state, rng, state.boards.slice(0, next?.boards ?? 1)).state;
    }
    expect(isDuel(state)).toBe(true);
    expect(alivePlayers(state)).toHaveLength(2);
    const [a] = standings(state, rng);
    state = finishDuel(state, a!.id);
    const placements = state.players.map((p) => p.placement).sort((x, y) => x! - y!);
    expect(placements).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
  });
});

describe("boards", () => {
  it("retires finished or decided games", () => {
    expect(retireReason({ id: 0, expected: 0.5, gameOver: true })).toBe("game_over");
    expect(retireReason({ id: 0, expected: 0.92, gameOver: false })).toBe("decided");
    expect(retireReason({ id: 0, expected: 0.08, gameOver: false })).toBe("decided");
    expect(retireReason({ id: 0, expected: 0.7, gameOver: false })).toBeNull();
  });

  it("keeps the most balanced boards when shrinking", () => {
    expect(
      keepBoards(
        [
          { id: 1, expected: 0.8, gameOver: false },
          { id: 2, expected: 0.52, gameOver: false },
          { id: 3, expected: 0.45, gameOver: false },
          { id: 4, expected: 0.3, gameOver: false },
        ],
        2,
      ),
    ).toEqual([2, 3]);
  });
});

describe("botPick", () => {
  const candidates = [
    { move: "a", loss: 0 },
    { move: "b", loss: 5 },
    { move: "c", loss: 30 },
  ];
  it("strong bots mostly play the best move, weak bots spread out", () => {
    const rng = mulberry32(6);
    const count = (skill: number) => {
      let best = 0;
      for (let i = 0; i < 5000; i++) if (botPick(rng, candidates, skill, ["a", "b", "c", "z"]) === "a") best++;
      return best / 5000;
    };
    expect(count(0.5)).toBeGreaterThan(0.95);
    expect(count(20)).toBeLessThan(0.6);
  });
});
