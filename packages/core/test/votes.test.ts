import { describe, expect, it } from "vitest";
import {
  CROWD_SETTINGS,
  DEFAULT_SETTINGS,
  PREGAME_VOTES,
  VARIABLE_CLOCK,
  VOTE_SPOT_MARGIN,
  allowedMs,
  botThinkMs,
  botVotes,
  castPregameVote,
  clampToZone,
  closePregameVote,
  clockScheduleLine,
  clockStepRanges,
  modeSettings,
  moveClockAt,
  mulberry32,
  speedOption,
  tallyVotes,
  voteHomeSpots,
  voteZoneAt,
  voteZoneBox,
  voteZoneCentre,
  voteZoneSpot,
  type Settings,
} from "../src/index.ts";

const crowd: Settings = { ...DEFAULT_SETTINGS, ...modeSettings("crowd", { crowdTeams: true }) };
const speed = PREGAME_VOTES.find((v) => v.id === "speed")!;
const variable: Settings = { ...crowd, ...speed.options[1]!.patch };

describe("the move clock", () => {
  it("Variable: 10 s for moves 1-5, then 5 s more every 5 moves, capped at 30 s from move 21", () => {
    const at = (move: number) => moveClockAt(variable, move);
    // Each step's first and last move.
    expect([1, 5].map(at)).toEqual([10, 10]);
    expect([6, 10].map(at)).toEqual([15, 15]);
    expect([11, 15].map(at)).toEqual([20, 20]);
    expect([16, 20].map(at)).toEqual([25, 25]);
    // The cap: 30 s from move 21 on, however long the game.
    expect([21, 22, 40, 80, 500].map(at)).toEqual([30, 30, 30, 30, 30]);
    // Before the schedule starts (never in play): the first step.
    expect(at(0)).toBe(10);
  });

  it("the schedule is data: the steps in settings, read as ranges, in any order", () => {
    expect(clockStepRanges(VARIABLE_CLOCK)).toEqual([
      { from: 1, to: 5, seconds: 10 },
      { from: 6, to: 10, seconds: 15 },
      { from: 11, to: 15, seconds: 20 },
      { from: 16, to: 20, seconds: 25 },
      { from: 21, to: null, seconds: 30 },
    ]);
    const shuffled = { ...crowd, moveClockSteps: [...VARIABLE_CLOCK].reverse() };
    expect(moveClockAt(shuffled, 7)).toBe(15);
    expect(clockScheduleLine()).toBe("Moves 1–5: 10 s · 6–10: 15 s · 11–15: 20 s · 16–20: 25 s · 21+: 30 s");
  });

  it("Normal and Bullet are static; no schedule means moveClockSeconds every move", () => {
    const normal = { ...variable, ...speed.options[0]!.patch };
    const bullet = { ...variable, ...speed.options[2]!.patch };
    for (const move of [1, 6, 21, 60]) {
      expect(moveClockAt(normal, move)).toBe(20);
      expect(moveClockAt(bullet, move)).toBe(10);
      expect(moveClockAt(DEFAULT_SETTINGS, move)).toBe(DEFAULT_SETTINGS.moveClockSeconds);
    }
    // Crowd without the votes (or with them off): Normal, 20 s.
    expect(moveClockAt(crowd, 1)).toBe(20);
    expect(CROWD_SETTINGS.moveClockSeconds).toBe(20);
  });

  it("the time you're allowed and the bots' thinking follow the move's clock", () => {
    const fresh = { bankMs: variable.timeBankSeconds * 1000 };
    expect(allowedMs(fresh, variable, 1)).toBe(10_000);
    expect(allowedMs(fresh, variable, 6)).toBe(15_000);
    expect(allowedMs(fresh, variable, 30)).toBe(30_000);
    // A bank running low still caps it.
    expect(allowedMs({ bankMs: 2_000 }, variable, 30)).toBe(2_000 + variable.timeIncrementSeconds * 1000);
    const rng = mulberry32(4);
    const think = (move: number) => Array.from({ length: 300 }, () => botThinkMs(rng, variable, move));
    expect(Math.max(...think(1))).toBeLessThanOrEqual(8_500);
    expect(Math.min(...think(1))).toBeGreaterThanOrEqual(variable.botThinkSeconds[0] * 1000);
    // On a long clock, the bots' usual range (2-14 s in Crowd).
    expect(Math.max(...think(25))).toBeGreaterThan(12_000);
  });
});

describe("the speed vote", () => {
  it("Normal, Variable, Bullet from left to right; nobody votes: Variable", () => {
    expect(speed.options.map((o) => o.label)).toEqual(["Normal", "Variable", "Bullet"]);
    expect(speed.options.map((o) => o.id)).toEqual(["normal", "variable", "bullet"]);
    expect(speed.defaultOption).toBe(1);
    expect(tallyVotes([], 3, speed.defaultOption, mulberry32(1))).toBe(1);
    expect(speed.options[1]!.blurb).toBe("10 s, rising to 30 s");
    expect(speed.options[1]!.detail).toContain("21+: 30 s");
    // No Slow left anywhere in the votes.
    expect(PREGAME_VOTES.flatMap((v) => v.options).some((o) => /slow/i.test(o.id + o.label + o.blurb))).toBe(false);
  });

  it("a stale ?speed=slow (or the old 'standard') is Normal; unknown speeds are nothing", () => {
    expect(speedOption("slow")!.id).toBe("normal");
    expect(speedOption("standard")!.id).toBe("normal");
    expect(speedOption("variable")!.patch.moveClockSteps).toEqual(VARIABLE_CLOCK);
    expect(speedOption("bullet")!.patch.moveClockSeconds).toBe(10);
    expect(speedOption("ludicrous")).toBeNull();
    expect(speedOption(null)).toBeNull();
  });

  it("one vote each: the first counts; with voteChangeAllowed a later one replaces it", () => {
    expect(DEFAULT_SETTINGS.voteChangeAllowed).toBe(false);
    const first = castPregameVote([], { playerId: "me", option: 0 }, false)!;
    expect(first).toEqual([{ playerId: "me", option: 0 }]);
    expect(castPregameVote(first, { playerId: "me", option: 2 }, false)).toBeNull();
    expect(castPregameVote(first, { playerId: "me", option: 2 }, true)).toEqual([{ playerId: "me", option: 2 }]);
    expect(castPregameVote(first, { playerId: "me", option: 0 }, true)).toBeNull();
    expect(castPregameVote(first, { playerId: "you", option: 1 }, false)).toHaveLength(2);
  });
});

describe("time's up: everyone who didn't vote joins the winner", () => {
  const format = PREGAME_VOTES.find((v) => v.id === "format")!;
  const join = (playerId: string, option: number) => ({ playerId, option, joined: true as const });
  const everyone = ["ann", "bo", "cy", "di", "ed"];

  it("a tie is broken first (the same draw as the count alone), then the non-voters join the winner", () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) {
      const cast = [
        { playerId: "ann", option: 0 },
        { playerId: "bo", option: 2 },
      ];
      const { result, votes, joined } = closePregameVote(cast, everyone, format, mulberry32(seed), join);
      // The non-voters never change the outcome: it's the tie's own draw.
      expect(result).toBe(tallyVotes([0, 2], 3, format.defaultOption, mulberry32(seed)));
      expect([0, 2]).toContain(result);
      seen.add(result);
      expect(joined).toEqual(["cy", "di", "ed"]);
      // The voters keep their votes; each non-voter is counted once, with the winner.
      expect(votes.slice(0, 2)).toEqual(cast);
      expect(votes.slice(2)).toEqual(joined.map((id) => ({ playerId: id, option: result, joined: true })));
      expect(votes.filter((v) => v.option === result)).toHaveLength(4);
      expect(votes.filter((v) => v.option !== result)).toHaveLength(1);
    }
    // Either side of the tie can win.
    expect([...seen].sort()).toEqual([0, 2]);
  });

  it("a clear winner stays the winner, however many didn't vote", () => {
    const cast = [
      { playerId: "ann", option: 1 },
      { playerId: "bo", option: 1 },
      { playerId: "cy", option: 2 },
    ];
    const many = [...everyone, ...Array.from({ length: 95 }, (_, i) => `bot${i}`)];
    const { result, votes } = closePregameVote(cast, many, format, mulberry32(5), join);
    expect(result).toBe(1);
    expect(votes).toHaveLength(100);
    expect(votes.filter((v) => v.option === 1)).toHaveLength(99);
  });

  it("nobody votes: the option's default wins (Team final, Variable) and everyone goes there", () => {
    const labels = PREGAME_VOTES.map((vote) => {
      const { result, votes, joined } = closePregameVote([], everyone, vote, mulberry32(3), join);
      expect(result).toBe(vote.defaultOption);
      expect(joined).toEqual(everyone);
      expect(votes.map((v) => v.option)).toEqual(everyone.map(() => vote.defaultOption));
      return vote.options[result]!.label;
    });
    expect(labels).toEqual(["Team final", "Variable"]);
  });

  it("everyone voted: nobody joins", () => {
    const cast = everyone.map((playerId, i) => ({ playerId, option: i % 3 }));
    const { votes, joined } = closePregameVote(cast, everyone, format, mulberry32(8), join);
    expect(joined).toEqual([]);
    expect(votes).toEqual(cast);
  });

  it("a few bots don't vote (voteBotSkip); none skip with it at 0", () => {
    const ids = Array.from({ length: 99 }, (_, i) => `bot${i}`);
    expect(DEFAULT_SETTINGS.voteBotSkip).toBeGreaterThan(0);
    let skipped = 0;
    for (let seed = 1; seed <= 20; seed++) skipped += 99 - botVotes(mulberry32(seed), ids, 3, 8000, DEFAULT_SETTINGS.voteBotSkip).length;
    expect(skipped / (20 * 99)).toBeCloseTo(DEFAULT_SETTINGS.voteBotSkip, 1);
    expect(botVotes(mulberry32(1), ids, 3, 8000, 0)).toHaveLength(99);
    expect(botVotes(mulberry32(1), ids, 3, 8000)).toHaveLength(99);
  });
});

describe("the vote board", () => {
  const players = Array.from({ length: 100 }, (_, i) => ({ id: `p${i * 7919}`, side: (i % 2 ? "b" : "w") as "w" | "b" }));
  const spots = voteHomeSpots(players);
  const m = VOTE_SPOT_MARGIN;

  it("White's pawns start on ranks 1-2 and Black's on ranks 7-8, inside the board's edges", () => {
    expect(spots.size).toBe(100);
    for (const p of players) {
      const s = spots.get(p.id)!;
      expect(s.x).toBeGreaterThanOrEqual(m);
      expect(s.x).toBeLessThanOrEqual(8 - m);
      if (p.side === "w") {
        expect(s.y).toBeGreaterThanOrEqual(m);
        expect(s.y).toBeLessThanOrEqual(2 - m);
      } else {
        expect(s.y).toBeGreaterThanOrEqual(6 + m);
        expect(s.y).toBeLessThanOrEqual(8 - m);
      }
    }
  });

  it("each pawn keeps its spot: the same every time, whatever order the players come in", () => {
    const again = voteHomeSpots([...players].reverse());
    for (const p of players) expect(again.get(p.id)).toEqual(spots.get(p.id));
  });

  it("50 a side spread over the whole band (no clumps): every square of ranks 1-2 has a pawn near it", () => {
    const white = players.filter((p) => p.side === "w").map((p) => spots.get(p.id)!);
    for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) expect(white.some((s) => Math.floor(s.x) === x && Math.floor(s.y) === y)).toBe(true);
    // And not on a grid: no two pawns share a spot.
    expect(new Set(white.map((s) => `${s.x.toFixed(3)},${s.y.toFixed(3)}`)).size).toBe(white.length);
  });

  it("zones: b-c, d-e, f-g on ranks 4-5; voters land inside, White on the rank-4 half and Black on the rank-5 half", () => {
    expect([0, 1, 2].map(voteZoneBox)).toEqual([
      { x0: 1, x1: 3, y0: 3, y1: 5 },
      { x0: 3, x1: 5, y0: 3, y1: 5 },
      { x0: 5, x1: 7, y0: 3, y1: 5 },
    ]);
    for (const option of [0, 1, 2]) {
      for (let k = 0; k < 50; k++) {
        const w = voteZoneSpot(option, "w", k);
        const b = voteZoneSpot(option, "b", k);
        expect(voteZoneAt(w)).toBe(option);
        expect(voteZoneAt(b)).toBe(option);
        expect(w.y).toBeLessThan(4);
        expect(b.y).toBeGreaterThan(4);
      }
      expect(voteZoneAt(voteZoneCentre(option, "w"))).toBe(option);
      // Your pawn dropped on the zone's edge: nudged inside, on your side's half (wherever you let go up and down).
      const z = voteZoneBox(option);
      const w = clampToZone(option, { x: z.x0, y: z.y1 }, "w");
      expect(w.x).toBeCloseTo(z.x0 + 0.46);
      expect(w.y).toBe(3.5);
      const b = clampToZone(option, { x: z.x1 - 0.7, y: z.y0 }, "b");
      expect(b.x).toBeCloseTo(z.x1 - 0.7);
      expect(b.y).toBe(4.5);
    }
  });
});
