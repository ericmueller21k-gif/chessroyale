import { describe, expect, it } from "vitest";
import { FAIRPLAY, type FairMove } from "@chessroyale/core";
import { createGuest, ensureSchema, signInWithIdentity, type Sql, type User } from "../src/accounts.ts";
import { appeal, caseOf, decide, recordFairPlay } from "../src/fairplay.ts";
import { deepCheckRun, type DeepSearch } from "../src/fairplay-deep.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * Delta review of PR #610's fix round (branch review/fable-b2, delta.md): each test shows one finding. Copy into
 * packages/server/test/ and run `npx vitest run packages/server/test/delta-b2.test.ts`.
 */

const HOUR = 3_600_000;
const QUIET = Date.UTC(2026, 9, 10, 5);

async function player(sql: Sql, name: string): Promise<User> {
  const g = await createGuest(sql, 1000, name);
  return signInWithIdentity(sql, g.user, "email", `${name.toLowerCase()}@example.com`, {}, 1000);
}

/** As fairplay-deep.test's engineMatch: every counted move the best; every fourth one the crowd missed. */
function engineMatch(n = 20): FairMove[] {
  return Array.from({ length: n }, (_, i) => ({
    ply: 14 + 2 * i,
    fen: "8/8/8/8/8/8/8/K6k w - - 0 1",
    move: "a1a2",
    best: "a1a2",
    loss: 0,
    bestExp: 0.55,
    near: 1,
    gap: 3,
    crowd: 40,
    crowdFound: i % 4 === 0 ? 2 : 24,
    thinkMs: 9000,
    away: 0,
    legal: 3,
    top: ["a1a2", "a1b1", "a1b2"],
  }));
}

function fakeSearch(best = "a1a2") {
  const calls: string[][] = [];
  const search: DeepSearch = async (_fen, moves) => {
    calls.push([...moves]);
    return moves.map((m) => ({ move: m, expected: m === best ? 0.55 : 0.5 }));
  };
  return { calls, search };
}

describe("delta review of #610's fixes", () => {
  it("m4-a: a banned player's matches stop at banMatchChecked moves, and neither an appeal nor the admin's Deep re-check finishes them", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const p = await player(sql, "Appealer");
    await recordFairPlay(sql, p.id, { lobby: "AAAAA", mode: "crowd", moves: engineMatch(12) }, QUIET - HOUR);
    // A person bans (from watch, before any deep re-check ran).
    expect((await decide(sql, p.id, "ban", "admin:eric@example.com", "read the games", QUIET - HOUR)).ok).toBe(true);
    // The deep search would show the pick isn't the engine's best: exactly what an appeal needs to see.
    const { calls, search } = fakeSearch("a1b1");
    // The scheduled run: 8 of the 12 counted moves, then out of the queue, undone.
    expect((await deepCheckRun(sql, search, QUIET, { perRun: 100 })).searches).toBe(FAIRPLAY.levels.banMatchChecked);
    const row = () => sql.first<{ deep_done: number; deep_queued: number; summary: string }>("SELECT deep_done, deep_queued, summary FROM fairplay_matches WHERE user_id = ?", p.id);
    expect(await row()).toMatchObject({ deep_done: 0, deep_queued: 0 });
    // The player appeals: nothing queues the rest.
    expect(await appeal(sql, p.id, "I didn't cheat, please look at my games again.", QUIET + 1000)).toEqual({ ok: true });
    // The admin page's "Deep re-check" (admin.ts:358, the same call): no row is queued, so nothing is searched.
    expect(await deepCheckRun(sql, search, QUIET + 2000, { all: true, userId: p.id, perRun: 60 })).toEqual({ searches: 0, matches: 0 });
    expect(calls).toHaveLength(FAIRPLAY.levels.banMatchChecked);
    // The person deciding the appeal sees 8 of 12 counted moves checked, for good.
    expect(JSON.parse((await row())!.summary)).toMatchObject({ counted: 12, deepChecked: FAIRPLAY.levels.banMatchChecked });
  });

  it("m1-a: every retry of a result whose fair-play row went in logs detection's note again, and sets updated_at back to the match's time", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const p = await player(sql, "Flagged");
    const match = { lobby: "AAAAA", mode: "crowd", moves: engineMatch(20), since: 1 };
    // The first try: the row goes in and opens a review (then, say, its XP or result row fails: writeResult throws).
    expect((await recordFairPlay(sql, p.id, match, QUIET)).acted).toBe("review");
    const notes = async () => (await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM fairplay_log WHERE user_id = ? AND action = 'note'", p.id))!.n;
    expect(await notes()).toBe(0);
    // Something newer touched the case (another match, a report): updated_at is later.
    await sql.run("UPDATE fairplay_cases SET updated_at = ? WHERE user_id = ?", QUIET + 10 * 60_000, p.id);
    // writeResult's retries (each minute while that later step keeps failing: up to MATCH_SAVE.strictMinutes for XP, the welcome crate
    // and the boss token; until the lobby closes, up to MATCH_SAVE.retryHours, for the result row itself): recordFairPlay each time.
    for (let i = 0; i < 5; i++) expect((await recordFairPlay(sql, p.id, match, QUIET)).acted).toBe("review");
    // Before the fix a retry did nothing; now each one adds the same line to the case's log.
    expect(await notes()).toBe(5);
    const lines = await sql.all<{ at: number; by: string; reason: string }>("SELECT at, by, reason FROM fairplay_log WHERE user_id = ? AND action = 'note'", p.id);
    expect(new Set(lines.map((l) => `${l.at}|${l.by}|${l.reason}`)).size).toBe(1);
    // And the case's updated_at went back to the match's time.
    expect((await caseOf(sql, p.id))?.updated_at).toBe(QUIET);
  });
});
