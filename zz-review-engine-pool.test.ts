import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type FairMove } from "@chessroyale/core";
import { createGuest, ensureSchema, recordResult, signInWithIdentity, type Sql, type User } from "../src/accounts.ts";
import { caseOf, decide, recordFairPlay, setCase } from "../src/fairplay.ts";
import { poolExport, poolHint, poolPlayers } from "../src/admin.ts";
import { deepCheckRun, type DeepSearch } from "../src/fairplay-deep.ts";
import { memoryDb } from "./memory-db.ts";

// The independent review of PR #618 (the engine pool): proof tests for its findings. Each `it` passes on the PR's code,
// showing the defect as it stands; the fix flips the marked expectation.

const DAY = 86_400_000;
const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 10, 1, 12);
const QUIET = Date.UTC(2026, 9, 10, 5);

async function player(sql: Sql, name: string): Promise<User> {
  const g = await createGuest(sql, 1000, name);
  return signInWithIdentity(sql, g.user, "email", `${name.toLowerCase()}@example.com`, {}, 1000);
}

/** engine-pool.test.ts's fixture: near-perfect engine play, the deep re-check agreeing on every pick (or not run). */
function engineMatch(deep: boolean): FairMove[] {
  return Array.from({ length: 20 }, (_, i) => ({
    ply: 14 + 2 * i,
    fen: "8/8/8/8/8/8/8/K6k w - - 0 1",
    move: "a1a2",
    best: "a1a2",
    loss: 0,
    bestExp: 0.55,
    near: 2,
    gap: 3,
    crowd: 40,
    crowdFound: i % 4 === 0 ? 2 : 24,
    thinkMs: 3500,
    away: 0,
    legal: 3,
    top: ["a1a2", "a1b1", "a1b2"],
    ...(deep ? { deep: { best: "a1a2", rank: 1, loss: 0, top: ["a1a2", "a1b1", "a1b2"] } } : {}),
  }));
}
const bar = engineMatch(true);

/** Counts the statements a Sql runs. */
function counting(sql: Sql): { sql: Sql; n: () => number; reset: () => void } {
  let n = 0;
  const wrapped: Sql = {
    run: (q, ...p) => (n++, sql.run(q, ...p)),
    first: (q, ...p) => (n++, sql.first(q, ...p)),
    all: (q, ...p) => (n++, sql.all(q, ...p)),
    batch: (s) => (n++, sql.batch(s)),
  };
  return { sql: wrapped, n: () => n, reset: () => void (n = 0) };
}

describe("review of #618: proofs", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["Date"] }));
  afterEach(() => vi.useRealTimers());

  it("M1: the pool's JSON download carries an admin's email once a person has decided the case (Released, then pooled again)", async () => {
    vi.setSystemTime(T0);
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const p = await player(sql, "Pat");
    await recordFairPlay(sql, p.id, { lobby: "AAAAA", mode: "crowd", moves: bar }, T0);
    expect(await decide(sql, p.id, "release", "admin:eric@example.com", "", T0 + 1000)).toEqual({ ok: true, status: "cleared" });
    await recordFairPlay(sql, p.id, { lobby: "BBBBB", mode: "crowd", moves: bar }, T0 + 2000);
    expect((await caseOf(sql, p.id))?.status).toBe("pool");
    const text = JSON.stringify(await poolExport(sql, T0 + 3000));
    // The fix (forReviewer on each file, or byForReviewer on log/decided_by): this becomes .not.toContain.
    expect(text).toContain("eric@example.com");
  });

  it("M2: a cheater still playing at the ban bar in the pool, whose Boss Battles the boss wins, is labeled 'likely a false positive'", async () => {
    vi.setSystemTime(T0 + 10 * DAY);
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const p = await player(sql, "Pat");
    await recordFairPlay(sql, p.id, { lobby: "AAAAA", mode: "crowd", moves: bar }, T0);
    expect((await caseOf(sql, p.id))?.status).toBe("pool");
    // In the pool: five raids the boss won (crowds win 15-45% of raids in the boss sims), and a match at the ban bar again.
    for (let i = 1; i <= 5; i++) await recordResult(sql, p.id, { mode: "raid", online: true, placement: 2, players: 100, teamWon: false, rating: 2400, ranked: true }, T0 + i * HOUR);
    await recordFairPlay(sql, p.id, { lobby: "CCCCC", mode: "raid", moves: bar }, T0 + 6 * HOUR);
    const row = (await poolPlayers(sql)).find((r) => r.userId === p.id)!;
    expect(row.inPool).toMatchObject({ games: 5, wins: 0, deepChecked: 20, deepMatch: 20 });
    expect(poolHint(row)).toBe("getting crushed: likely a false positive");
  });

  it("m1: a pooled player's matches are deep-checked only to the watch cap (8 moves) and only off-peak, unlike a review's", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const search: DeepSearch = async (_fen, moves) => moves.map((m) => ({ move: m, expected: m === "a1a2" ? 0.55 : 0.5 }));
    const checked = async (status: "pool" | "review") => {
      const u = await player(sql, `U${status}`);
      await setCase(sql, u.id, status, "detection", "test", QUIET - 3 * HOUR);
      await recordFairPlay(sql, u.id, { lobby: status === "pool" ? "PPPPP" : "RRRRR", mode: "crowd", moves: engineMatch(false) }, QUIET - HOUR);
      for (let i = 0; i < 3; i++) await deepCheckRun(sql, search, QUIET, { userId: u.id, perRun: 500 });
      // (The review, checked in full, reaches the one-match bar and is pooled; the pool stays pooled.)
      if (status === "pool") expect((await caseOf(sql, u.id))?.status).toBe("pool");
      const s = JSON.parse((await sql.first<{ summary: string }>("SELECT summary FROM fairplay_matches WHERE user_id = ?", u.id))!.summary) as { deepChecked: number };
      return s.deepChecked;
    };
    expect(await checked("review")).toBe(20);
    // The fix (cap Infinity for 'pool' too in fairplay-deep.ts): 20.
    expect(await checked("pool")).toBe(8);
  });

  it("m2: the review page's pool list costs about 6 queries per pooled player, the download about 16 (every load of /admin/fairplay)", async () => {
    vi.setSystemTime(T0 + DAY);
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const c = counting(sql);
    const per: number[] = [];
    for (const n of [5, 10]) {
      while ((await poolPlayers(sql)).length < n) {
        const u = await player(sql, `P${Math.random().toString(36).slice(2, 7)}`);
        await recordFairPlay(sql, u.id, { lobby: "AAAAA", mode: "crowd", moves: bar }, T0);
      }
      c.reset();
      await poolPlayers(c.sql);
      const list = c.n();
      c.reset();
      await poolExport(c.sql, T0 + DAY);
      per.push(list, c.n());
    }
    const [list5, export5, list10, export10] = per as [number, number, number, number];
    console.log(`pool list: ${list5} queries for 5, ${list10} for 10; export: ${export5} for 5, ${export10} for 10`);
    expect((list10 - list5) / 5).toBeGreaterThanOrEqual(6);
    expect((export10 - export5) / 5).toBeGreaterThanOrEqual(14);
  });
});
