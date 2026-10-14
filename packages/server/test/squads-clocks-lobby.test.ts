import { beforeEach, describe, expect, it } from "vitest";
import { FRONT_DOOR, SQUADS, SQUADS_LOBBY } from "@chessroyale/core";
import { halfDuties, squadsVotes, type SquadsMatch } from "@chessroyale/chess/squads";
import { SquadsCore, clearTopCache, parseTestClock, testLobbyOptions, type LiveMatch, type SquadsRecord } from "../src/squads-lobby.ts";
import { library, squadsLobby } from "./squads-fixture.ts";

/**
 * Squads' three chess time controls on the server (Eric, Oct 13; DECISIONS.md, "Squads: three chess time controls"):
 * the Clock vote's winner is the lobby's clock (every squad's bank, each match's free seconds, increment and cap, the
 * duties' deadlines), a test link names an option (old ids too) or gives its numbers, and a lobby stored before the time
 * controls keeps playing on the clock it voted.
 */

const VOTES_MS = FRONT_DOOR.fillShowMs + squadsVotes().length * (SQUADS.voteSeconds + SQUADS.voteResultSeconds) * 1000;

beforeEach(() => clearTopCache());

/** A matchmade lobby with one person in it, run to its bracket: the Clock vote's result (its bots and non-voters decide). */
function toBracket(seed: number) {
  const L = squadsLobby({ seed });
  const ann = L.join("Ann");
  L.advance(60_000 + VOTES_MS + 1_000);
  return { L, ann };
}

describe("squads lobby: the Clock vote's time control", () => {
  it("whichever option wins (Bullet, Blitz or Rapid), the lobby plays it: banks, each match's free seconds, increment and cap, the deadlines", () => {
    // (Each option needs a lobby whose vote it wins: the seeds are searched for one each, rather than trusted.)
    const found = new Map<string, ReturnType<typeof toBracket>>();
    for (let seed = 1; seed <= 80 && found.size < SQUADS.clocks.length; seed++) {
      const run = toBracket(seed);
      const id = run.L.core.record.rules?.clock.id;
      if (id && !found.has(id)) found.set(id, run);
    }
    expect([...found.keys()].sort()).toEqual(SQUADS.clocks.map((c) => c.id).sort());
    for (const clock of SQUADS.clocks) {
      const { L, ann } = found.get(clock.id)!;
      const result = L.core.record.voteResults.clock!;
      expect(SQUADS.clocks[result]).toBe(clock);
      const lobby = L.last(ann, "lobby")!.lobby;
      expect(lobby.rules!.clock).toEqual(clock);
      expect(L.last(ann, "clocks")!.clocks.every((c) => c.bankMs === clock.bankSeconds * 1000)).toBe(true);
      // Every round 1 match carries the option's numbers, to the app too.
      const matches = L.all(ann, "match").map((m) => m.match);
      expect(matches).toHaveLength(4);
      for (const m of matches) expect(m).toMatchObject({ delayMs: clock.delaySeconds * 1000, incrementMs: clock.incrementSeconds * 1000, capMs: clock.capSeconds * 1000 });
      // The first half: each move's deadline is the option's cap.
      L.advance(SQUADS_LOBBY.bracketIntroSeconds * 1000);
      const turn = L.last(ann, "turn")!;
      expect(turn.current.duties.every((d) => d.deadline - turn.current.startedAt === clock.capSeconds * 1000)).toBe(true);
    }
  });

  it("a whole bot lobby on Bullet reaches its results; its bots, pacing themselves by the bank, are seldom out of time", () => {
    const L = squadsLobby({ seed: 5, test: { start: 0, clock: parseTestClock("bullet")! }, fillInMs: 5_000 });
    L.join("Tess");
    L.runUntil(() => L.core.record.phase === "results", 3 * 3_600_000, "the results");
    const misses = L.core.record.squads.flatMap((sq) => sq.players).reduce((t, p) => t + p.misses, 0);
    const moves = L.core.allMatches().reduce((t, lm) => t + lm.m.boards.reduce((u, b) => u + b.moves.length, 0), 0);
    // (Tess never moves: her own misses aside, the bots' moves are made in time.)
    const tess = L.core.record.squads.flatMap((sq) => sq.players).find((p) => !p.isBot)!;
    expect((misses - tess.misses) / moves).toBeLessThan(0.01);
    expect(L.core.record.rules!.clock.id).toBe("bullet");
  });
});

describe("squads lobby: a test link's clock", () => {
  it("names an option (bullet, blitz, rapid; the old fast, normal, long map to them; one we don't know gets Blitz) or gives its numbers", () => {
    const [rapid, blitz, bullet] = SQUADS.clocks;
    expect(parseTestClock("bullet")).toBe(bullet);
    expect(parseTestClock("Blitz")).toBe(blitz);
    expect(parseTestClock("rapid")).toBe(rapid);
    expect(parseTestClock("fast")).toBe(bullet);
    expect(parseTestClock("normal")).toBe(blitz);
    expect(parseTestClock("long")).toBe(rapid);
    expect(parseTestClock("whatever")).toBe(blitz);
    // Numbers: bank, top-up, free seconds, increment, and the cap; without a cap, the old ceiling (older links keep their meaning).
    expect(parseTestClock("120,30,3,1,10")).toEqual({ id: "test", label: "Test", bankSeconds: 120, topUpSeconds: 30, delaySeconds: 3, incrementSeconds: 1, capSeconds: 10 });
    expect(parseTestClock("90,0,3,0")).toMatchObject({ capSeconds: SQUADS.legacyCapSeconds, incrementSeconds: 0 });
    for (const bad of [null, "", "1,2", "120,30,0,1", "120,30,3,1,0", "0,0,3,0", "120,30,3,1,10,5", "bullet!"]) expect(parseTestClock(bad)).toBeNull();
    expect(testLobbyOptions(new URLSearchParams("start=relay&clock=fast"), 0).test.clock).toBe(bullet);
  });
});

describe("squads lobby: stored before the time controls", () => {
  it("a lobby in play on the old Normal clock keeps its numbers and the old 20 s ceiling, and plays on to its results", () => {
    const L = squadsLobby({ seed: 9, test: { start: 1 }, fillInMs: 5_000 });
    L.join("Tess");
    L.advance(5_000 + VOTES_MS + SQUADS_LOBBY.bracketIntroSeconds * 1000 + 2_000);
    expect(L.core.allMatches().some((lm) => lm.state === "half")).toBe(true);
    // What an earlier version stored: the Normal clock (no cap, no increment) and matches without a cap of their own.
    const normal = { id: "normal", label: "Normal", bankSeconds: 240, topUpSeconds: 60, delaySeconds: 3, incrementSeconds: 0 };
    const old = <T extends object>(x: T, drop: string): T => Object.fromEntries(Object.entries(x).filter(([k]) => k !== drop)) as T;
    const stored = JSON.parse(JSON.stringify(L.core.record)) as SquadsRecord;
    stored.rules = { ...stored.rules!, clock: normal as never };
    stored.plan = { ...stored.plan!, rules: { ...stored.plan!.rules, clock: normal as never } };
    const matches: Record<string, LiveMatch> = {};
    for (const lm of L.core.allMatches()) {
      const copy = JSON.parse(JSON.stringify(lm)) as LiveMatch;
      matches[lm.key] = { ...copy, m: old(copy.m, "capMs") as SquadsMatch };
    }
    expect(Object.values(matches).every((lm) => !("capMs" in lm.m))).toBe(true);
    // The Durable Object wakes on today's code.
    const core = new SquadsCore(stored, matches, L.io, library);
    expect(core.record.rules!.clock).toEqual({ ...normal, capSeconds: 20 });
    expect(core.record.plan!.rules.clock).toEqual({ ...normal, capSeconds: 20 });
    for (const lm of core.allMatches()) {
      expect(lm.m.capMs).toBe(20_000);
      for (const d of halfDuties(lm.m).duties) expect(d.deadlineMs).toBe(lm.m.banks[d.side] > 0 ? 20_000 : 3_000);
    }
    // It plays on to its results; the final, planned after the wake, is on the Normal clock's numbers too.
    for (let guard = 0; core.record.phase !== "results" && guard < 400_000; guard++) {
      const next = core.nextAlarm;
      if (next === null) break;
      L.now = Math.max(L.now, next);
      core.alarm();
    }
    expect(core.record.phase).toBe("results");
    // (A drawn final went on to Armageddon: its own clocks, the final's cap.)
    const fin = core.allMatches().find((lm) => lm.round === 2)!;
    expect(fin.drawn ?? fin.m).toMatchObject({ delayMs: 3_000, incrementMs: 0, capMs: 20_000 });
    if (fin.drawn) expect(fin.m).toMatchObject({ armageddon: true, capMs: 20_000, incrementMs: SQUADS.armageddon.incrementSeconds * 1000 });
  });
});
