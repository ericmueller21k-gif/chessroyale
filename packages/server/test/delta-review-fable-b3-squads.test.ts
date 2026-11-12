/**
 * Delta review of PR #611's fix round (review/fable-b3, delta.md), Squads: its proof test, turned around (fix round 2).
 */
import { describe, expect, it, vi } from "vitest";
import { FRONT_DOOR, SQUADS, SQUADS_LOBBY, voteResultMs } from "@chessroyale/core";
import { squadsVotes } from "@chessroyale/chess/squads";
import { fallbackTop } from "../src/squads-bots.ts";
import { squadsLobby } from "./squads-fixture.ts";

// (The engine server is a Container, which needs the Workers runtime: the Squads room imports it.)
vi.mock("../src/engine.ts", () => ({ SERVER_RECHECK_NODES: 2_000_000, serverRecheck: async () => null, serverScoreAt: async () => null, warmEngine: async () => false }));

const VOTES_MS = FRONT_DOOR.fillShowMs + SQUADS.firstVoteDelaySeconds * 1000 + squadsVotes().length * (SQUADS.voteSeconds * 1000 + voteResultMs(SQUADS));

/** A test lobby on its first turn: `n` people of `n` parties (computers, their speed known). */
function parties(serverEngine = false, n = 2) {
  const L = squadsLobby({ test: { start: 0 }, fillInMs: 5_000, serverEngine });
  const ids = Array.from({ length: n }, (_, i) => L.join(`D${i}`, { device: "computer" }));
  ids.forEach((id) => L.core.message(id, { t: "speed", nps: 1_000_000 }));
  L.advance(5_000 + VOTES_MS + SQUADS_LOBBY.bracketIntroSeconds * 1000);
  return { L, ids };
}


describe("delta review of PR #611's fixes, turned around (Squads)", () => {
  it("D4 (M3): no engine server (down, ENGINE_OFF): a late answer that disagrees asks a referee device of another party, as in time, and the one it outvotes is struck", () => {
    const { L, ids } = parties(false, 3);
    const job = L.core.allMatches().flatMap((m) => Object.values(m.half?.work ?? {})).find((j) => j.devices.length === 2 && !j.how)!;
    const [liar, honest] = job.devices as [string, string];
    const referee = ids.find((id) => !job.devices.includes(id))!;
    const truth = fallbackTop(job.fen, SQUADS.bots.candidates);
    const lie = [...truth].reverse().map((m, i) => ({ move: m.move, expected: 0.99 - i * 0.1 }));
    L.core.message(liar, { t: "botTop", id: job.id, top: lie });
    L.advance(SQUADS_LOBBY.botWork.graceMs + 50);
    expect(job.how).toBe("one");
    L.clear(referee);
    L.core.message(honest, { t: "botTop", id: job.id, top: truth });
    // (The bots' moves already made stand: the lie was used.)
    expect(job.top![0]!.move).toBe(lie[0]!.move);
    expect(L.server).toEqual([]);
    const work = L.all(referee, "botWork").flatMap((w) => w.jobs);
    expect(work).toEqual([expect.objectContaining({ id: `${job.id}~late`, fen: job.fen })]);
    // Someone else answering it counts for nothing; the referee's answer agrees with the honest one: the liar is struck.
    L.core.message(honest, { t: "botTop", id: `${job.id}~late`, top: truth });
    expect(L.core.record.devices[liar]!.strikes).toBe(0);
    L.core.message(referee, { t: "botTop", id: `${job.id}~late`, top: truth });
    expect(L.core.record.devices[liar]!.strikes).toBe(1);
    expect(L.core.record.devices[honest]!.strikes).toBe(0);
    expect(L.core.record.devices[referee]!.strikes).toBe(0);
    expect(L.core.record.lateChecks?.[`${job.id}~late`]).toBeUndefined();
  });

  it("D4 (M3): no engine server and no device of another party to referee: logged, nobody struck (as before)", () => {
    const { L } = parties(false, 2);
    const job = L.core.allMatches().flatMap((m) => Object.values(m.half?.work ?? {})).find((j) => j.devices.length === 2 && !j.how)!;
    const [liar, honest] = job.devices as [string, string];
    const truth = fallbackTop(job.fen, SQUADS.bots.candidates);
    const lie = [...truth].reverse().map((m, i) => ({ move: m.move, expected: 0.99 - i * 0.1 }));
    L.core.message(liar, { t: "botTop", id: job.id, top: lie });
    L.advance(SQUADS_LOBBY.botWork.graceMs + 50);
    L.core.message(honest, { t: "botTop", id: job.id, top: truth });
    expect(L.core.record.lateChecks ?? {}).toEqual({});
    expect(L.core.record.devices[liar]!.strikes + L.core.record.devices[honest]!.strikes).toBe(0);
  });
});
