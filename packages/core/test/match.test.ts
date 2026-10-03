import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  alivePlayers,
  applyRound,
  allowedMs,
  assignColours,
  assignGroups,
  botChoose,
  botPick,
  createMatch,
  endStage,
  finalComplete,
  finalMover,
  finishFinal,
  isFinal,
  keepBoards,
  mulberry32,
  stagePlan,
  standingPoints,
  standings,
  type MatchState,
} from "../src/index.ts";

const entrants = Array.from({ length: 64 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, isBot: i > 0, skill: i }));
const boards = [0, 1, 2, 3, 4, 5, 6, 7];

describe("stagePlan", () => {
  it("matches the spec's table", () => {
    // 64 players on 8 boards; each cut removes 8 players and one board, down to 8 on one board, then the final four.
    expect(stagePlan().map((s) => [s.players, s.boards, s.knockouts])).toEqual([
      [64, 8, 8],
      [56, 7, 8],
      [48, 6, 8],
      [40, 5, 8],
      [32, 4, 8],
      [24, 3, 8],
      [16, 2, 8],
      [8, 1, 4],
    ]);
  });
});

describe("assignGroups", () => {
  it("puts 8 players on each board and never the same board twice in a row while 4+ boards", () => {
    const rng = mulberry32(1);
    let state: MatchState = createMatch(entrants, boards);
    for (let round = 0; round < 8; round++) {
      const groups = assignGroups(rng, state);
      expect([...groups.values()].every((g) => g.length === 8)).toBe(true);
      expect(new Set([...groups.values()].flat()).size).toBe(64);
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

  it("keeps repeat groupmates well below chance", () => {
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
    // By chance each player would meet ~0.8 of last round's 7 groupmates again (~50 in all); the search does far better.
    expect(repeats).toBeLessThan(20);
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
    // Tie at 5 among p8..p63: those with less thinking time rank higher.
    const end = endStage(state, mulberry32(4), [0, 1, 2, 3, 4, 5, 6]);
    expect(end.knockedOut.map((p) => p.id).sort()).toEqual(["p0", "p1", "p2", "p3", "p4", "p5", "p6", "p7"].sort());
    expect(end.knockedOut.every((p) => p.placement! >= 57)).toBe(true);
    expect(alivePlayers(end.state)).toHaveLength(56);
    expect(alivePlayers(end.state).every((p) => p.stageScore === 0)).toBe(true);
    expect(end.state.boards).toEqual([0, 1, 2, 3, 4, 5, 6]);
    // p7 had the least thinking time of the -10 group, so it ranks 57th, not 64th.
    expect(end.knockedOut.find((p) => p.id === "p7")!.placement).toBe(57);
  });

  it("carries scores over when set to", () => {
    let state = createMatch(entrants, boards);
    state = applyRound(state, assignGroups(mulberry32(3), state), state.players.map((p, i) => ({ playerId: p.id, roundScore: i, loss: 0, thinkMs: 0 })));
    const end = endStage(state, mulberry32(4), boards, { ...DEFAULT_SETTINGS, scoresBetweenStages: "carry" });
    expect(alivePlayers(end.state).find((p) => p.id === "p63")!.stageScore).toBe(63);
  });

  it("runs through all eight stages to a 2v2 final, then places the finalists by move quality", () => {
    let state = createMatch(entrants, boards);
    const rng = mulberry32(5);
    for (const plan of stagePlan()) {
      expect(alivePlayers(state)).toHaveLength(plan.players);
      const groups = assignGroups(rng, state);
      state = applyRound(state, groups, alivePlayers(state).map((p) => ({ playerId: p.id, roundScore: rng(), loss: 0, thinkMs: 0 })));
      const next = stagePlan()[plan.index + 1];
      state = endStage(state, rng, state.boards.slice(0, next?.boards ?? 1)).state;
    }
    expect(isFinal(state)).toBe(true);
    expect(alivePlayers(state)).toHaveLength(4);
    const f = state.final!;
    // Seeds 1 & 4 against 2 & 3, moving 1, 2, 4, 3.
    expect(f.teams[0]).toEqual([f.order[0], f.order[2]]);
    expect(f.teams[1]).toEqual([f.order[1], f.order[3]]);
    // Each finalist moves in turn; the one who loses least per move wins.
    const lossOf: Record<string, number> = { [f.order[0]!]: 3, [f.order[1]!]: 1, [f.order[2]!]: 5, [f.order[3]!]: 2 };
    while (!finalComplete(state)) {
      const mover = finalMover(state.final!);
      const groups = new Map([[state.boards[0]!, [mover]]]);
      state = applyRound(state, groups, [{ playerId: mover, roundScore: 0, loss: lossOf[mover]!, thinkMs: 1000 }]);
    }
    expect(state.final!.turn).toBe(4 * DEFAULT_SETTINGS.finalMovesPerPlayer);
    state = finishFinal(state, rng);
    const place = (id: string) => state.players.find((p) => p.id === id)!.placement;
    expect([f.order[1], f.order[3], f.order[0], f.order[2]].map((id) => place(id!))).toEqual([1, 2, 3, 4]);
    const placements = state.players.map((p) => p.placement).sort((x, y) => x! - y!);
    expect(placements).toEqual(Array.from({ length: 64 }, (_, i) => i + 1));
  });

  it("counts a missed move in the final as a big loss", () => {
    let state = createMatch(entrants.slice(0, 4), [0]);
    state = { ...state, stage: DEFAULT_SETTINGS.knockoutsPerStage.length, final: { order: ["p0", "p1", "p2", "p3"], teams: [["p0", "p2"], ["p1", "p3"]], turn: 0 } };
    state = applyRound(state, new Map([[0, ["p0"]]]), [{ playerId: "p0", roundScore: -25, loss: null, thinkMs: 30000 }]);
    expect(state.players[0]!.finalLosses).toEqual([DEFAULT_SETTINGS.finalMissLoss]);
  });
});

describe("boards", () => {
  it("drops finished games first, then the most lopsided, when shrinking", () => {
    expect(
      keepBoards(
        [
          { id: 1, expected: 0.8, gameOver: false },
          { id: 2, expected: 0.5, gameOver: true },
          { id: 3, expected: 0.45, gameOver: false },
          { id: 4, expected: 0.3, gameOver: false },
        ],
        2,
      ),
    ).toEqual([3, 4]);
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

describe("time bank and power-ups", () => {
  const s = DEFAULT_SETTINGS;

  it("caps a move at the move clock, adds the increment, and never goes below zero", () => {
    void s;
    let state = createMatch(entrants, boards);
    const me = () => state.players[0]!;
    expect(me().bankMs).toBe(600_000);
    expect(allowedMs(me())).toBe(30_000);
    const groups = assignGroups(mulberry32(1), state);
    const play = (thinkMs: number) =>
      (state = applyRound(state, groups, [{ playerId: "p0", roundScore: 0, loss: 0, thinkMs }]));
    play(12_000); // 600 + 5 - 12
    expect(me().bankMs).toBe(593_000);
    play(99_000); // capped at 30 s
    expect(me().bankMs).toBe(568_000);
    state = { ...state, players: state.players.map((p, i) => (i === 0 ? { ...p, bankMs: 2000 } : p)) };
    expect(allowedMs(me())).toBe(7000);
    play(7000);
    expect(me().bankMs).toBe(0);
    expect(allowedMs(me())).toBe(5000);
  });

  it("ranks on move quality only: time and power-ups don't change points; using a power-up spends one", () => {
    let state = createMatch(entrants, boards);
    const groups = assignGroups(mulberry32(1), state);
    state = applyRound(state, groups, [
      { playerId: "p0", roundScore: 3, loss: 0, thinkMs: 5000, usedPowerUp: true },
      { playerId: "p1", roundScore: 3, loss: 0, thinkMs: 5000 },
    ]);
    const [p0, p1] = state.players;
    expect(p0!.powerUps).toBe(2);
    expect(p0!.powerUpsUsed).toBe(1);
    expect(p1!.powerUps).toBe(3);
    expect(standingPoints(p1!)).toBeCloseTo(3);
    expect(standingPoints(p0!)).toBeCloseTo(3);
    expect(p0!.thinkMsTotal).toBe(5000);
    expect(p0!.movesTimed).toBe(1);
    // A player with none left can't use one.
    for (let i = 0; i < 3; i++) state = applyRound(state, groups, [{ playerId: "p0", roundScore: 0, loss: 0, thinkMs: 0, usedPowerUp: true }]);
    expect(state.players[0]!.powerUps).toBe(0);
    expect(state.players[0]!.powerUpsUsed).toBe(3);
    // Survivors get another at the cut, up to 5 held.
    let next = endStage(state, mulberry32(3), [0, 1, 2, 3, 4, 5]).state;
    expect(next.players.find((p) => p.id === "p1")!.powerUps).toBe(4);
    next = endStage(next, mulberry32(4), [0, 1, 2, 3, 4, 5]).state;
    next = endStage(next, mulberry32(5), [0, 1, 2, 3, 4, 5]).state;
    expect(next.players.find((p) => p.id === "p1")!.powerUps).toBe(5);
  });

  it("practice players have unlimited power-ups", () => {
    let state = createMatch([{ id: "me", name: "Me", isBot: false, practice: true }, ...entrants.slice(1)], boards);
    const groups = assignGroups(mulberry32(1), state);
    for (let i = 0; i < 3; i++) {
      state = applyRound(state, groups, [{ playerId: "me", roundScore: 0, loss: 0, thinkMs: 0, usedPowerUp: true }]);
    }
    expect(state.players[0]!.powerUps).toBe(3);
    expect(state.players[0]!.powerUpsUsed).toBe(3);
  });

  it("bots spend a power-up on sharp positions only", () => {
    const sharp = [{ move: "a", loss: 0 }, { move: "b", loss: 30 }];
    const quiet = [{ move: "a", loss: 0 }, { move: "b", loss: 2 }];
    expect(botChoose(mulberry32(1), sharp, { skill: 20, powerUps: 1 }, ["a", "b"])).toEqual({ move: "a", usedPowerUp: true });
    expect(botChoose(mulberry32(1), sharp, { skill: 20, powerUps: 0 }, ["a", "b"]).usedPowerUp).toBe(false);
    expect(botChoose(mulberry32(1), quiet, { skill: 20, powerUps: 1 }, ["a", "b"]).usedPowerUp).toBe(false);
  });
});

describe("colours per stage", () => {
  it("splits players evenly and swaps last stage's colours where it can", () => {
    let state = assignColours(createMatch(entrants, boards), mulberry32(1), 32);
    expect(state.players.filter((p) => p.colour === "w")).toHaveLength(32);
    const before = new Map(state.players.map((p) => [p.id, p.colour]));
    state = assignColours(state, mulberry32(2), 32);
    expect(state.players.every((p) => p.colour !== before.get(p.id))).toBe(true);
    expect(assignColours(state, mulberry32(3), null).players.every((p) => p.colour === null)).toBe(true);
  });

  it("groups players only onto boards where their colour is to move", () => {
    const state = assignColours(createMatch(entrants, boards), mulberry32(1), 32);
    const sides = new Map(boards.map((b) => [b, b < 4 ? ("w" as const) : ("b" as const)]));
    const groups = assignGroups(mulberry32(4), state, DEFAULT_SETTINGS, 4000, sides);
    for (const [b, ids] of groups) {
      expect(ids).toHaveLength(8);
      for (const id of ids) expect(state.players.find((p) => p.id === id)!.colour).toBe(sides.get(b));
    }
  });
});

describe("odd board counts", () => {
  it("keeps colours fixed with an odd number of boards: group sizes follow the numbers", () => {
    const players = entrants.slice(0, 56);
    let state = assignColours(createMatch(players, [0, 1, 2, 3, 4, 5, 6]), mulberry32(1), 28);
    // 4 boards White to move, 3 Black; next round it flips.
    for (const whiteBoards of [[0, 1, 2, 3], [0, 1, 2]]) {
      const sides = new Map([0, 1, 2, 3, 4, 5, 6].map((b) => [b, whiteBoards.includes(b) ? ("w" as const) : ("b" as const)]));
      const groups = assignGroups(mulberry32(whiteBoards.length), state, DEFAULT_SETTINGS, 4000, sides);
      const sizes = [...groups.values()].map((g) => g.length);
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(56);
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(7);
      expect(Math.max(...sizes)).toBeLessThanOrEqual(10);
      for (const [b, ids] of groups) for (const id of ids) expect(state.players.find((p) => p.id === id)!.colour).toBe(sides.get(b));
      state = applyRound(state, groups, []);
    }
  });
});

