/**
 * The review of PR #611 (review/fable-b3), Squads: M3 (a fast party's lie and a slower honest answer: the late one is compared, the
 * engine server's verdict strikes the liar; the grace as JUDGES') and M4 (a squad goes unpaid only if its own matches' bot work rested on
 * its own party alone, and the placement says "nobody outside your party checked the bots' moves"). Their proof tests turned around.
 */
import { describe, expect, it, vi } from "vitest";
import { FRONT_DOOR, SQUADS, SQUADS_LOBBY, voteResultMs } from "@chessroyale/core";
import { squadsVotes } from "@chessroyale/chess/squads";
import { fallbackTop } from "../src/squads-bots.ts";
import { squadsLobby } from "./squads-fixture.ts";

// (The engine server is a Container, which needs the Workers runtime: the Squads room imports it.)
vi.mock("../src/engine.ts", () => ({ SERVER_RECHECK_NODES: 2_000_000, serverRecheck: async () => null, serverScoreAt: async () => null, warmEngine: async () => false }));

const VOTES_MS = FRONT_DOOR.fillShowMs + SQUADS.firstVoteDelaySeconds * 1000 + squadsVotes().length * (SQUADS.voteSeconds * 1000 + voteResultMs(SQUADS));

/** A test lobby on its first turn: two people of two parties (computers, their speed known). */
function twoParties(serverEngine = false) {
  const L = squadsLobby({ test: { start: 0 }, fillInMs: 5_000, serverEngine });
  const ids = [L.join("D0", { device: "computer" }), L.join("D1", { device: "computer" })];
  ids.forEach((id) => L.core.message(id, { t: "speed", nps: 1_000_000 }));
  L.advance(5_000 + VOTES_MS + SQUADS_LOBBY.bracketIntroSeconds * 1000);
  return { L, ids };
}

describe("review of PR #611 (Squads, two parties), turned around", () => {
  it("M3: a fast party's lie stands by the grace, but the honest late answer is compared: the engine server's verdict strikes the liar", () => {
    const { L } = twoParties(true);
    const job = L.core.allMatches().flatMap((m) => Object.values(m.half?.work ?? {})).find((j) => j.devices.length === 2 && !j.how)!;
    const [liar, honest] = job.devices as [string, string];
    const truth = fallbackTop(job.fen, SQUADS.bots.candidates);
    // The lie: the same moves, the worst one named best.
    const lie = [...truth].reverse().map((m, i) => ({ move: m.move, expected: 0.99 - i * 0.1 }));
    L.core.message(liar, { t: "botTop", id: job.id, top: lie });
    L.advance(SQUADS_LOBBY.botWork.graceMs + 50);
    expect(job.how).toBe("one");
    expect(job.late).toEqual([honest]);
    // The honest answer, 0.5 s later: compared, and the engine server asked.
    L.core.message(honest, { t: "botTop", id: job.id, top: truth });
    const ask = L.server.find((r) => r.id === `${job.id}~late`)!;
    expect(ask).toBeTruthy();
    // Its verdict (the truth's numbers): the liar is further from it, and struck.
    L.core.serverAnswered(ask.id, ask.moves.map((move) => truth.find((t) => t.move === move) ?? { move, expected: 0 }));
    expect(L.core.record.devices[liar]!.strikes).toBe(1);
    expect(L.core.record.devices[honest]!.strikes).toBe(0);
    expect(L.core.record.unvouched).toBeUndefined();
  });

  it("M3: a late answer that agrees asks nothing; the grace is at least graceMs, or graceFactor of the first's own time", () => {
    const { L } = twoParties(true);
    const job = L.core.allMatches().flatMap((m) => Object.values(m.half?.work ?? {})).find((j) => j.devices.length === 2 && !j.how)!;
    const [first, second] = job.devices as [string, string];
    const truth = fallbackTop(job.fen, SQUADS.bots.candidates);
    // (The first took 2 s: the second has graceFactor of that, more than graceMs.)
    L.advance(2_000);
    L.core.message(first, { t: "botTop", id: job.id, top: truth });
    L.advance(Math.max(SQUADS_LOBBY.botWork.graceMs, SQUADS_LOBBY.botWork.graceFactor * 2_000) - 100);
    expect(job.how).toBeUndefined();
    L.advance(200);
    expect(job.how).toBe("one");
    L.core.message(second, { t: "botTop", id: job.id, top: truth });
    expect(L.server.filter((r) => r.id.endsWith("~late"))).toEqual([]);
    expect(L.core.record.devices[first]!.strikes + L.core.record.devices[second]!.strikes).toBe(0);
  });

  it("M4: two parties, the other one's device goes: the bot work its party answers alone unvouches only the squad that party plays in, every other squad pays", () => {
    const L = squadsLobby({ test: { start: 0 }, fillInMs: 5_000 });
    const ids = [L.join("D0", { device: "computer" }), L.join("D1", { device: "computer" })];
    ids.forEach((id) => L.core.message(id, { t: "speed", nps: 1_000_000 }));
    L.advance(5_000 + VOTES_MS);
    // (The other party's device goes before the bracket: every job is D0's alone.)
    L.core.disconnect(ids[1]!);
    L.advance(SQUADS_LOBBY.bracketIntroSeconds * 1000);
    expect(L.core.record.unvouched).toBeUndefined();
    const matches = L.core.allMatches().filter((m) => m.half);
    const mine = matches.find((m) => m.m.sides.some((x) => x.seats.includes(ids[0]!)))!;
    const sq = mine.m.sides.find((x) => x.seats.includes(ids[0]!))!.squadId;
    // D0 answers every job of every match alone (its own match's, and the others').
    for (const m of matches) for (const job of Object.values(m.half!.work)) if (job.devices.includes(ids[0]!) && !job.how) L.core.message(ids[0]!, { t: "botTop", id: job.id, top: fallbackTop(job.fen, SQUADS.bots.candidates) });
    expect(matches.length).toBeGreaterThan(1);
    expect(L.core.record.unvouched?.[sq]).toMatch(/own party/);
    // Only its own squad: the other side of its match, and every other match's squads (the departed party's among them), pay as usual.
    expect(Object.keys(L.core.record.unvouched ?? {}).map(Number)).toEqual([sq]);
  });
});
