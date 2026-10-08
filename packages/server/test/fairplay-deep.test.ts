import { describe, expect, it } from "vitest";
import { FAIRPLAY, type FairMove } from "@chessroyale/core";
import { createGuest, ensureSchema, signInWithIdentity, type Sql, type User } from "../src/accounts.ts";
import { caseOf, recordFairPlay, setCase, type CaseMailer } from "../src/fairplay.ts";
import { deepCheckRun, deepResult, offPeak, type DeepSearch } from "../src/fairplay-deep.ts";
import { memoryDb } from "./memory-db.ts";

const HOUR = 3_600_000;
/** A day at 05:00 UTC (off-peak) and at 18:00 UTC (peak). */
const QUIET = Date.UTC(2026, 9, 10, 5);
const BUSY = Date.UTC(2026, 9, 10, 18);

async function player(sql: Sql, name: string): Promise<User> {
  const g = await createGuest(sql, 1000, name);
  return signInWithIdentity(sql, g.user, "email", `${name.toLowerCase()}@example.com`, {}, 1000);
}

/** An engine user's match: every counted move the best; every fourth position one the crowd missed. */
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
    thinkMs: 3500,
    away: 0,
    legal: 3,
    top: ["a1a2", "a1b1", "a1b2"],
  }));
}

/** A deep search where `best` is best and the rest lose 5 points each; counts its calls. */
function fakeSearch(best = "a1a2") {
  const calls: string[][] = [];
  const search: DeepSearch = async (_fen, moves) => {
    calls.push([...moves]);
    return moves.map((m) => ({ move: m, expected: m === best ? 0.55 : 0.5 }));
  };
  return { calls, search };
}

describe("the deep re-check", () => {
  it("a pick's rank among the candidates and its loss by the deep search's numbers", () => {
    const scores = [
      { move: "a", expected: 0.6 },
      { move: "b", expected: 0.58 },
      { move: "c", expected: 0.5 },
    ];
    expect(deepResult("a", scores)).toEqual({ best: "a", rank: 1, loss: 0 });
    expect(deepResult("c", scores)).toEqual({ best: "a", rank: 3, loss: 10 });
    expect(deepResult("z", scores)).toBeNull();
  });

  it("off-peak hours", () => {
    expect(offPeak(QUIET)).toBe(true);
    expect(offPeak(BUSY)).toBe(false);
  });

  it("checks a flagged player's counted moves (the judges' top moves and the pick), then the level can ban", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const p = await player(sql, "Cheat");
    const sent: string[] = [];
    const mail: CaseMailer = async (_u, kind) => void sent.push(kind);
    const saved = FAIRPLAY.enforcement;
    (FAIRPLAY as { enforcement: string }).enforcement = "ban";
    try {
      const a = await recordFairPlay(sql, p.id, { lobby: "AAAAA", mode: "crowd", moves: engineMatch() }, QUIET - 2 * HOUR, mail);
      const b = await recordFairPlay(sql, p.id, { lobby: "BBBBB", mode: "crowd", moves: engineMatch() }, QUIET - HOUR, mail);
      // Without the deep re-check, no ban: review at most.
      expect([a.acted, b.acted]).not.toContain("ban");
      expect((await caseOf(sql, p.id))?.status).toBe("review");
      const { calls, search } = fakeSearch();
      const r = await deepCheckRun(sql, search, QUIET, { mail, perRun: 100 });
      expect(r).toEqual({ searches: 40, matches: 2 });
      expect(calls[0]).toEqual(["a1a2", "a1b1", "a1b2"]);
      const rows = await sql.all<{ summary: string; deep_done: number }>("SELECT summary, deep_done FROM fairplay_matches ORDER BY id");
      expect(rows.map((x) => x.deep_done)).toEqual([1, 1]);
      expect(JSON.parse(rows[0]!.summary)).toMatchObject({ deepChecked: 20, deepMatch: 20 });
      expect((await caseOf(sql, p.id))?.status).toBe("banned");
      expect(sent).toEqual(["banned"]);
      // Done: nothing more to search.
      expect((await deepCheckRun(sql, search, QUIET + 1000, { mail })).searches).toBe(0);
    } finally {
      (FAIRPLAY as { enforcement: string }).enforcement = saved;
    }
  });

  it("a strong player whose picks often aren't the engine's: no ban", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const p = await player(sql, "Strong");
    const saved = FAIRPLAY.enforcement;
    (FAIRPLAY as { enforcement: string }).enforcement = "ban";
    try {
      await recordFairPlay(sql, p.id, { lobby: "AAAAA", mode: "crowd", moves: engineMatch() }, QUIET - 2 * HOUR);
      await recordFairPlay(sql, p.id, { lobby: "BBBBB", mode: "crowd", moves: engineMatch() }, QUIET - HOUR);
      // The deep search prefers another move: the picks match it half the time at most.
      const { search } = fakeSearch("a1b1");
      await deepCheckRun(sql, search, QUIET, { perRun: 100 });
      expect((await caseOf(sql, p.id))?.status).not.toBe("banned");
    } finally {
      (FAIRPLAY as { enforcement: string }).enforcement = saved;
    }
  });

  it("at peak hours only cases in review are checked; a run stops at its share and at the day's budget", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const watched = await player(sql, "Watched");
    const reviewed = await player(sql, "Reviewed");
    await recordFairPlay(sql, watched.id, { lobby: "AAAAA", mode: "crowd", moves: engineMatch(12) }, BUSY - HOUR);
    await recordFairPlay(sql, reviewed.id, { lobby: "BBBBB", mode: "crowd", moves: engineMatch(12) }, BUSY - HOUR);
    await setCase(sql, watched.id, "watch", "reports", "a report", BUSY - HOUR);
    await setCase(sql, reviewed.id, "review", "reports", "3 reports", BUSY - HOUR);
    const { calls, search } = fakeSearch();
    expect(await deepCheckRun(sql, search, BUSY, { perRun: 5 })).toEqual({ searches: 5, matches: 0 });
    expect(await deepCheckRun(sql, search, BUSY, { perRun: 100 })).toEqual({ searches: 7, matches: 1 });
    // The watched player waits for the quiet hours.
    expect((await deepCheckRun(sql, search, BUSY, { perRun: 100 })).searches).toBe(0);
    expect((await deepCheckRun(sql, search, QUIET, { perRun: 100 })).searches).toBe(12);
    expect(calls).toHaveLength(24);
    // The budget: no more than the day's searches.
    await sql.run("INSERT OR REPLACE INTO fairplay_budget (day, searches) VALUES (?, ?)", new Date(QUIET + 2 * 86_400_000).toISOString().slice(0, 10), FAIRPLAY.deep.dailySearches);
    const late = await player(sql, "Late");
    await recordFairPlay(sql, late.id, { lobby: "CCCCC", mode: "crowd", moves: engineMatch(12) }, QUIET + 2 * 86_400_000 - HOUR);
    expect((await deepCheckRun(sql, search, QUIET + 2 * 86_400_000, { perRun: 100 })).searches).toBe(0);
  });

  it("a server that doesn't answer leaves the match for a later run", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const p = await player(sql, "Pat");
    await recordFairPlay(sql, p.id, { lobby: "AAAAA", mode: "crowd", moves: engineMatch(12) }, QUIET - HOUR);
    const r = await deepCheckRun(sql, async () => null, QUIET, { perRun: 100 });
    expect(r.matches).toBe(0);
    expect((await sql.first<{ deep_done: number | null }>("SELECT deep_done FROM fairplay_matches"))!.deep_done ?? 0).toBe(0);
    const { search } = fakeSearch();
    expect((await deepCheckRun(sql, search, QUIET + 1, { perRun: 100 })).matches).toBe(1);
  });
});
