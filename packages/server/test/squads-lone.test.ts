/**
 * Squads and the outside review of Nov 10 (finding 5; docs/decisions/2026-11-10-boss-and-lone-devices.md): a lobby whose bots one
 * party's devices moved alone is noted, and paid as any (Eric, Nov 10), and a placement's coins and crates have a daily cap
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

describe("Squads: a lobby that rests on one party's devices (noted, paid under the daily cap)", () => {
  beforeEach(() => clearTopCache());
  afterEach(() => clearTopCache());

  it("one person alone with bots: noted, and paid as any placement (Eric, Nov 10), XP as an online game's", () => {
    const L = squadsLobby({ seed: 3 });
    const a = L.join("Ann", { userId: "ua" });
    L.players.add(a);
    L.runUntil(() => L.core.record.phase === "results", 3 * 3_600_000, "the results");
    const ann = L.core.takeRewards().find((r) => r.playerId === a)!;
    expect(L.core.record.unvouched?.[ann.squadId]).toBe("one party in the lobby");
    const pays = SQUADS_LOBBY.rewards[ann.placement];
    expect(ann).toMatchObject({ userId: "ua", recorded: true, coins: pays.coins, crates: pays.crates });
    expect(ann.solo).toBeUndefined();
    expect(ann.why).toBeUndefined();
    expect(L.last(a, "placed")).toMatchObject({ coins: pays.coins, crates: pays.crates });
  }, 120_000);

  /** A test lobby on its first turn: two people of two parties, `speeds` of them with apps that take bot work. */
  function firstTurn(speeds: number) {
    const L = squadsLobby({ test: { start: 0 }, fillInMs: 5_000 });
    const ids = [L.join("D0", { device: "computer" }), L.join("D1", { device: "computer" })];
    ids.slice(0, speeds).forEach((id) => L.core.message(id, { t: "speed", nps: 1_000_000 }));
    L.advance(5_000 + VOTES_MS + SQUADS_LOBBY.bracketIntroSeconds * 1000);
    const job = L.core.allMatches().flatMap((m) => Object.values(m.half?.work ?? {})).find((j) => j.devices.length && !j.how)!;
    return { L, ids, job };
  }

  it("two parties, one device up to do bot work: a job it answers alone (and those following it) unvouches only its own party's squad", () => {
    const { L, ids, job } = firstTurn(1);
    expect(L.core.record.unvouched).toBeUndefined();
    expect(job.devices).toEqual([ids[0]]);
    L.core.message(ids[0]!, { t: "botTop", id: job.id, top: fallbackTop(job.fen, SQUADS.bots.candidates) });
    expect(job.how).toBe("one");
    const squadOf = (id: string) => L.core.allMatches().flatMap((m) => m.m.sides).find((x) => x.seats.includes(id))!.squadId;
    const marked = Object.keys(L.core.record.unvouched ?? {}).map(Number);
    // (Its own match follows the same start here: its squad rests on it, the other party's player in it too. No other squad does.)
    expect(marked).toEqual([squadOf(ids[0]!)]);
  });

  it("two parties, both devices up: a first answer that stands alone after the grace (the other slower) doesn't", () => {
    const { L, ids, job } = firstTurn(2);
    expect(job.devices.length).toBe(2);
    L.core.message(job.devices[0]!, { t: "botTop", id: job.id, top: fallbackTop(job.fen, SQUADS.bots.candidates) });
    L.advance(SQUADS_LOBBY.botWork.graceMs + 50);
    expect(job.how).toBe("one");
    expect(L.core.record.unvouched).toBeUndefined();
    expect(ids.length).toBe(2);
  });

  it("the daily cap's word reaches the player: their placement again, nothing, and why", () => {
    const L = squadsLobby({ seed: 3 });
    const a = L.join("Ann", { userId: "ua" });
    L.join("Bo", { userId: "ub" });
    L.players.add(a);
    L.runUntil(() => Object.keys(L.core.record.placed).length > 0 && !!L.last(a, "placed"), 3 * 3_600_000, "Ann's placement");
    L.core.record.unvouched = undefined;
    L.core.rewardCapped(a);
    const placed = L.last(a, "placed")!;
    expect(placed).toMatchObject({ coins: 0, crates: 0 });
    if (SQUADS_LOBBY.rewards[placed.placement].coins) expect(placed.why).toBe("daily");
  }, 120_000);
});

describe("Squads: the daily cap on placement rewards (SQUADS_LOBBY.rewardsPerDay)", () => {
  const signedIn = async (sql: Sql, name: string) => signInWithIdentity(sql, (await createGuest(sql, Date.now(), name)).user, "email", `${name.toLowerCase()}@example.com`, {}, Date.now());

  it("that many lobbies a UTC day pay; the next is refused (nothing paid) whatever its place; the next day pays again; a retry pays nothing more", async () => {
    const { sql, db } = memoryDb();
    await ensureSchema(sql);
    const ann = await signedIn(sql, "Ann");
    const coins = () => (db.prepare("SELECT coins FROM wallets WHERE user_id = ?").get(ann.id) as { coins: number } | undefined)?.coins ?? 0;
    const day = Date.UTC(2026, 10, 10);
    const won = (): SquadsReward => ({ playerId: "p1", userId: ann.id, squadId: 0, placement: 1, coins: 100, crates: 1, recorded: false });
    for (let i = 0; i < SQUADS_LOBBY.rewardsPerDay; i++) expect(await writeReward(sql, `SQ${i}`, day + i, won(), day + 3_600_000 + i, false)).toBe("applied");
    expect(coins()).toBe(100 * SQUADS_LOBBY.rewardsPerDay);
    // One more today: refused, nothing paid.
    expect(await writeReward(sql, "SQX", day + 99, won(), day + 20 * 3_600_000, false)).toBe("refused");
    expect(coins()).toBe(100 * SQUADS_LOBBY.rewardsPerDay);
    // A retry of one already paid: a replay, nothing more.
    expect(await writeReward(sql, "SQ0", day, won(), day + 21 * 3_600_000, false)).toBe("replay");
    // The next UTC day: pays again.
    expect(await writeReward(sql, "SQY", day + 100, won(), day + 24 * 3_600_000 + 60_000, false)).toBe("applied");
    expect(coins()).toBe(100 * (SQUADS_LOBBY.rewardsPerDay + 1));
  });

  it("a reward marked solo (writeReward's own path; no lobby marks one since Nov 10): its XP goes in as a solo game's", async () => {
    const { sql, db } = memoryDb();
    await ensureSchema(sql);
    const bo = await signedIn(sql, "Bo");
    const now = Date.UTC(2026, 10, 10, 12);
    await writeReward(sql, "SQS", now - 3_600_000, { playerId: "p1", userId: bo.id, squadId: 0, placement: 1, coins: 0, crates: 0, recorded: true, solo: true, moves: 30, playMs: 20 * 60_000 }, now, false);
    const legs = db.prepare("SELECT reason, source_id FROM ledger WHERE asset_kind = 'xp' AND reason IN ('xp', 'xp-win') ORDER BY reason").all() as { reason: string; source_id: string }[];
    expect(legs).toEqual([
      { reason: "xp", source_id: "solo" },
      { reason: "xp-win", source_id: "solo" },
    ]);
  });
});
