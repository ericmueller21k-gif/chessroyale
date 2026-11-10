/**
 * Squads and the outside review of Nov 10 (finding 5; docs/decisions/2026-11-10-boss-and-lone-devices.md): a lobby whose bots one
 * party's devices moved alone pays no coins or crates (XP as a solo game's), and a placement's coins and crates have a daily cap
 * (SQUADS_LOBBY.rewardsPerDay), checked as the reward is written.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FRONT_DOOR, SQUADS, SQUADS_LOBBY, voteResultMs } from "@chessroyale/core";
import { squadsVotes } from "@chessroyale/chess/squads";
import { createGuest, ensureSchema, signInWithIdentity, type Sql } from "../src/accounts.ts";
import { clearTopCache, type SquadsReward } from "../src/squads-lobby.ts";
import { fallbackTop } from "../src/squads-bots.ts";
import { memoryDb } from "./memory-db.ts";
import { squadsLobby } from "./squads-fixture.ts";

// (The engine server is a Container, which needs the Workers runtime: the Squads room imports it.)
vi.mock("../src/engine.ts", () => ({ SERVER_RECHECK_NODES: 2_000_000, serverRecheck: async () => null, serverScoreAt: async () => null, warmEngine: async () => false }));
const { writeReward } = await import("../src/squads-do.ts");

const VOTES_MS = FRONT_DOOR.fillShowMs + SQUADS.firstVoteDelaySeconds * 1000 + squadsVotes().length * (SQUADS.voteSeconds * 1000 + voteResultMs(SQUADS));

describe("review of PR #611 (Squads, two parties)", () => {
  it("a fast party's lie beats an honest slower device of another party by the grace: it stands, the late honest answer is dropped unread, nobody is struck, and the lobby stays paying", () => {
    const L = squadsLobby({ test: { start: 0 }, fillInMs: 5_000 });
    const ids = [L.join("D0", { device: "computer" }), L.join("D1", { device: "computer" })];
    ids.forEach((id) => L.core.message(id, { t: "speed", nps: 1_000_000 }));
    L.advance(5_000 + VOTES_MS + SQUADS_LOBBY.bracketIntroSeconds * 1000);
    const job = L.core.allMatches().flatMap((m) => Object.values(m.half?.work ?? {})).find((j) => j.devices.length === 2 && !j.how)!;
    const [liar, honest] = job.devices as [string, string];
    const truth = fallbackTop(job.fen, SQUADS.bots.candidates);
    // The lie: the same moves, the worst one named best.
    const lie = [...truth].reverse().map((m, i) => ({ move: m.move, expected: 0.99 - i * 0.1 }));
    L.core.message(liar, { t: "botTop", id: job.id, top: lie });
    L.advance(SQUADS_LOBBY.botWork.graceMs + 50);
    expect(job.how).toBe("one");
    expect(job.top![0]!.move).toBe(truth.at(-1)!.move);
    // The honest phone-speed answer, 0.5 s later: ignored (no comparison, no server, no strike).
    L.core.message(honest, { t: "botTop", id: job.id, top: truth });
    expect(L.core.record.devices[liar]!.strikes).toBe(0);
    expect(L.core.record.unvouched).toBeUndefined();
  });

  it("two parties, the other one's device goes (knocked out and closed the page): the next job unvouches the whole lobby, and the placement blames 'only your party and bots'", () => {
    const L = squadsLobby({ test: { start: 0 }, fillInMs: 5_000 });
    const ids = [L.join("D0", { device: "computer" }), L.join("D1", { device: "computer" })];
    ids.forEach((id) => L.core.message(id, { t: "speed", nps: 1_000_000 }));
    L.advance(5_000 + VOTES_MS + SQUADS_LOBBY.bracketIntroSeconds * 1000);
    expect(L.core.record.unvouched).toBeUndefined();
    L.core.disconnect(ids[1]!);
    const job = L.core.allMatches().flatMap((m) => Object.values(m.half?.work ?? {})).find((j) => j.devices.includes(ids[0]!) && !j.how)!;
    L.core.message(ids[0]!, { t: "botTop", id: job.id, top: fallbackTop(job.fen, SQUADS.bots.candidates) });
    L.advance(SQUADS_LOBBY.botWork.graceMs + 50);
    expect(job.how).toBe("one");
    expect(L.core.record.unvouched).toMatch(/one party's devices/);
  });
});

