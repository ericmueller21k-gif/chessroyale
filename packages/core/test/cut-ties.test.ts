import { describe, expect, it } from "vitest";
import {
  CROWD_SETTINGS,
  DEFAULT_SETTINGS,
  alivePlayers,
  applyRound,
  bossKill,
  bossKillDue,
  createMatch,
  cutCount,
  cutPlan,
  endStage,
  mulberry32,
  standings,
  strikeVictim,
  teamFinalStep,
  type MatchState,
  type PlayerState,
  type Settings,
} from "../src/index.ts";

// docs/decisions/2026-10-15-opening-allowance-and-ties.md (Oct 15, 2026): at a cut everyone tied exactly with the last
// player through goes through; what that leaves over is owed by the next cut; the last cut before a fixed-size ending
// breaks an exact tie by less raw loss over the match, then less thinking time.

/** A match whose players have these scores (and raw losses, thinking times) this stage. */
function withScores(
  settings: Settings,
  rows: readonly { score: number; raw?: number; think?: number; colour?: "w" | "b" }[],
  stage = 0,
): MatchState {
  const state = createMatch(rows.map((_, i) => ({ id: `p${i}`, name: `P${i}`, isBot: true })), [0], settings);
  return {
    ...state,
    stage,
    players: state.players.map((p, i): PlayerState => {
      const r = rows[i]!;
      return {
        ...p,
        stageScore: r.score,
        lossesByStage: Array.from({ length: stage + 1 }, (_, s) => (s === stage && r.raw !== undefined ? [r.raw] : [])),
        stageThinkMs: r.think ?? 0,
        thinkMsTotal: r.think ?? 0,
        colour: r.colour ?? null,
      };
    }),
  };
}

const ids = (ps: readonly { id: string }[]) => ps.map((p) => p.id).sort();

describe("ties at a cut line go through", () => {
  // Classic-like: 4 knockouts, then 4 more; a third stage would be the last.
  const S: Settings = { ...DEFAULT_SETTINGS, knockoutsPerStage: [4, 4, 2] };

  it("everyone tied exactly with the last player through survives; nobody goes out on thinking time", () => {
    // Scores: 10 x4, 5 x3 (tied with the last through), 1, 0. Owed 4: only the two strictly below the line go.
    const state = withScores(S, [10, 10, 10, 10, 5, 5, 5, 1, 0].map((score, i) => ({ score, think: 1000 * i })));
    const end = endStage(state, mulberry32(1), [0], S);
    expect(ids(end.knockedOut)).toEqual(["p7", "p8"]);
    expect(alivePlayers(end.state)).toHaveLength(7);
    expect(cutCount(state, S)).toBe(2);
    // The two left over are owed by the next cut.
    expect(end.state.cutCarry).toEqual({ all: 2 });
  });

  it("what's owed is spread evenly over the cuts still to come, all of it by the last", () => {
    // Stage 2 of 3 (two cuts left, this one included), 2 owed: this cut takes its 4 and 1 more.
    const state = { ...withScores(S, [9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((score) => ({ score })), 1), cutCarry: { all: 2 } };
    let end = endStage(state, mulberry32(1), [0], S);
    expect(ids(end.knockedOut)).toEqual(["p5", "p6", "p7", "p8", "p9"]);
    expect(end.state.cutCarry).toEqual({ all: 1 });
    // The last cut: its 2 and the 1 still owed, exactly.
    const last = { ...end.state, players: end.state.players.map((p) => (p.alive ? { ...p, stageScore: 10 - Number(p.id.slice(1)) } : p)) };
    end = endStage(last, mulberry32(2), [0], S);
    expect(ids(end.knockedOut)).toEqual(["p2", "p3", "p4"]);
    expect(alivePlayers(end.state)).toHaveLength(2);
    expect(end.state.cutCarry).toBeUndefined();
  });

  it("the last cut before a fixed-size ending takes exactly what's owed: an exact tie goes to less raw loss, then less thinking time", () => {
    // Last stage (index 2): owed 2 + 1 carried = 3 out of 7, leaving 4. Line tie at 5: p2..p5.
    const rows = [
      { score: 9, raw: 1, think: 1 },
      { score: 8, raw: 1, think: 1 },
      { score: 5, raw: 20, think: 100 }, // most raw loss: out
      { score: 5, raw: 10, think: 900 }, // raw tie with p4, more thinking time: out
      { score: 5, raw: 10, think: 100 }, // through
      { score: 5, raw: 2, think: 999 }, // least raw loss: through
      { score: 1, raw: 0, think: 0 }, // below the line: out
    ];
    const state = { ...withScores(S, rows, 2), cutCarry: { all: 1 } };
    const end = endStage(state, mulberry32(1), [0], S);
    expect(ids(end.knockedOut)).toEqual(["p2", "p3", "p6"]);
    expect(ids(alivePlayers(end.state))).toEqual(["p0", "p1", "p4", "p5"]);
    // The fixed-size ending is reached: a 2v2 final of the last four.
    expect(end.state.final?.order).toHaveLength(4);
  });

  it("places those who go out in the last places, best of them first", () => {
    const state = withScores(S, [10, 10, 10, 10, 5, 5, 5, 1, 0].map((score) => ({ score })));
    const end = endStage(state, mulberry32(1), [0], S);
    expect(end.knockedOut.map((p) => [p.id, p.placement])).toEqual([
      ["p7", 8],
      ["p8", 9],
    ]);
  });

  it("orders the standings by score, then raw loss, then thinking time", () => {
    const state = withScores(S, [
      { score: 3, raw: 5, think: 1 },
      { score: 3, raw: 2, think: 9 },
      { score: 3, raw: 2, think: 4 },
      { score: 4, raw: 50, think: 50 },
    ]);
    expect(standings(state, mulberry32(1), S).map((p) => p.id)).toEqual(["p3", "p2", "p1", "p0"]);
  });
});

describe("Crowd 50 v 50: each team's cut", () => {
  const C: Settings = { ...DEFAULT_SETTINGS, ...CROWD_SETTINGS, knockoutsPerStage: [4, 4, 2] };

  it("ties survive within a team, the shortfall is owed by that team's later cuts, and the ending is still reached exactly", () => {
    // 12 players, 6 a side. White: a 3-way tie at the line keeps everyone; Black: two clearly lowest go.
    const white = [9, 8, 7, 2, 2, 2].map((score) => ({ score, colour: "w" as const }));
    const black = [9, 8, 7, 6, 1, 0].map((score) => ({ score, colour: "b" as const }));
    let state = withScores(C, [...white, ...black]);
    let end = endStage(state, mulberry32(1), [0], C);
    expect(end.knockedOut.filter((p) => p.colour === "w")).toHaveLength(0);
    expect(ids(end.knockedOut)).toEqual(["p10", "p11"]);
    expect(end.state.cutCarry).toEqual({ w: 2 });
    // Next cut (2 a team; White's 2 owed spread over the two cuts left): White's 3 lowest go, Black's 2, White still owes 1.
    state = { ...end.state, players: end.state.players.map((p) => (p.alive ? { ...p, stageScore: Number(p.id.slice(1)) } : p)) };
    end = endStage(state, mulberry32(2), [0], C);
    expect(end.knockedOut.filter((p) => p.colour === "w")).toHaveLength(3);
    expect(end.knockedOut.filter((p) => p.colour === "b")).toHaveLength(2);
    expect(end.state.cutCarry).toEqual({ w: 1 });
    // The last cut: one a team, exactly, whatever the ties: the duel's two (one a side) are left.
    const duel: Settings = { ...C, finalFormat: "duel" };
    state = { ...end.state, players: end.state.players.map((p) => (p.alive ? { ...p, stageScore: 0 } : p)) };
    end = endStage(state, mulberry32(3), [0], duel);
    const left = alivePlayers(end.state);
    expect(left.map((p) => p.colour).sort()).toEqual(["b", "w"]);
    expect(end.state.final?.format).toBe("duel");
  });

  it("marks who a cut would take now, the same as the cut itself", () => {
    const state = withScores(C, [...[5, 5, 5, 5].map((score) => ({ score, colour: "w" as const })), ...[4, 3, 2, 1].map((score) => ({ score, colour: "b" as const }))]);
    const ranked = standings(state, () => 0.5, C);
    // White all tied: nobody; Black: its 2 lowest.
    expect(cutPlan(state, ranked, C).out.sort()).toEqual(["p6", "p7"]);
  });
});

describe("the boss's strikes", () => {
  function battle(recent: number[], matchLosses?: number[]): MatchState {
    const state = createMatch(recent.map((_, i) => ({ id: `p${i}`, name: `P${i}`, isBot: true })), [0]);
    return {
      ...state,
      players: state.players.map((p, i) => ({ ...p, finalLosses: [0, 0, recent[i]!], lossesByStage: [[matchLosses?.[i] ?? 0]] })),
      boss: { elo: 1500, crowdSide: "w", crowdMoves: 3, sinceKill: 3, kills: [], minSurvivors: 1 },
    };
  }

  it("strikes the player who played worst since its last strike", () => {
    const state = battle([1, 9, 2]);
    expect(strikeVictim(state)).toBe("p1");
    expect(bossKillDue(state)).toBe(true);
    expect(bossKill(state, mulberry32(1)).victim).toBe("p1");
  });

  it("a tie for the worst on the match too: nobody is struck, and it waits for the next crowd move", () => {
    const state = battle([0, 0, 0, 0]);
    expect(strikeVictim(state)).toBeNull();
    expect(bossKillDue(state)).toBe(false);
    expect(bossKill(state, mulberry32(1)).victim).toBeNull();
    // A move later, one player gave something away: the strike comes.
    const later = { ...state, players: state.players.map((p, i) => ({ ...p, finalLosses: [...p.finalLosses, i === 2 ? 4 : 0] })), boss: { ...state.boss!, sinceKill: 4 } };
    expect(strikeVictim(later)).toBe("p2");
  });

  it("a tie since its last strike goes against the weaker player over the match", () => {
    const state = battle([5, 5, 1], [10, 30, 0]);
    expect(strikeVictim(state)).toBe("p1");
  });
});

describe("the team final's steps", () => {
  it("an exact tie on the match goes to less raw loss, not a coin flip", () => {
    const S: Settings = { ...DEFAULT_SETTINGS, ...CROWD_SETTINGS, teamFinalSizes: [2, 1] };
    let state = createMatch(["a", "b", "c", "d"].map((id) => ({ id, name: id, isBot: true })), [0], S);
    // Same counted average (matchLoss), different raw: a and c gave away more before the allowance.
    const raw: Record<string, number> = { a: 9, b: 3, c: 7, d: 1 };
    state = {
      ...state,
      stage: S.knockoutsPerStage.length,
      players: state.players.map((p) => ({ ...p, lossesByStage: [[raw[p.id]!]], countedLossSum: 1, colour: p.id === "a" || p.id === "b" ? "w" : "b" })),
      final: { order: ["a", "c", "b", "d"], teams: [["a", "b"], ["c", "d"]], turn: S.teamFinalMovesPerStep * 4, format: "team", step: 0, stepStart: 0, out: [] },
    };
    for (let seed = 1; seed < 20; seed++) expect(teamFinalStep(state, mulberry32(seed), S).out.sort()).toEqual(["a", "c"]);
  });
});

describe("rounds feed the cut", () => {
  it("players with the same counted losses every move tie exactly", () => {
    const S: Settings = { ...DEFAULT_SETTINGS, ...CROWD_SETTINGS, crowdTeams: false, knockoutsPerStage: [2, 2] };
    let state = createMatch(Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, isBot: true })), [0], S);
    const group = new Map([[0, state.players.map((p) => p.id)]]);
    for (let r = 0; r < 10; r++) {
      // p0..p3 always count 0 (sound moves under the allowance); p4, p5 give some away.
      state = applyRound(state, group, state.players.map((p, i) => ({ playerId: p.id, roundScore: i < 4 ? 0.7 : i === 4 ? -1 : -1.8, loss: i < 4 ? 3 : 5, counted: i < 4 ? 0 : 5, thinkMs: 1000 * (i + 1) })), S);
    }
    const scores = new Set(state.players.slice(0, 4).map((p) => p.stageScore));
    expect(scores.size).toBe(1);
    expect(cutCount(state, S)).toBe(2);
  });
});
