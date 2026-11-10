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


describe("delta review of PR #611's fixes (Squads)", () => {
  it("D4 (M3): no engine server (down, ENGINE_OFF): the fast party's lie stands, the honest late answer is only logged, nobody is struck, and no squad is unvouched (both paid)", () => {
    const { L } = twoParties(false);
    const job = L.core.allMatches().flatMap((m) => Object.values(m.half?.work ?? {})).find((j) => j.devices.length === 2 && !j.how)!;
    const [liar, honest] = job.devices as [string, string];
    const truth = fallbackTop(job.fen, SQUADS.bots.candidates);
    const lie = [...truth].reverse().map((m, i) => ({ move: m.move, expected: 0.99 - i * 0.1 }));
    L.core.message(liar, { t: "botTop", id: job.id, top: lie });
    L.advance(SQUADS_LOBBY.botWork.graceMs + 50);
    expect(job.how).toBe("one");
    L.core.message(honest, { t: "botTop", id: job.id, top: truth });
    expect(job.top![0]!.move).toBe(lie[0]!.move);
    expect(L.server).toEqual([]);
    expect(L.core.record.devices[liar]!.strikes).toBe(0);
    expect(L.core.record.devices[honest]!.strikes).toBe(0);
    expect(L.core.record.unvouched).toBeUndefined();
  });
});
