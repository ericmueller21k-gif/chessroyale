import { describe, expect, it } from "vitest";
import { legalMoves, stockfishRefuses } from "@chessroyale/chess";
import { FAIRPLAY, matchSignals, type FairMove } from "@chessroyale/core";
import { createGuest, ensureSchema, signInWithIdentity, type Sql, type User } from "../src/accounts.ts";
import { caseOf, decide, recordFairPlay, setCase, type CaseMailer } from "../src/fairplay.ts";
import { RECOUNT_BEFORE, deepCheckRun, deepResult, offPeak, recountDeep, type DeepSearch } from "../src/fairplay-deep.ts";
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
    expect(deepResult("a", scores)).toEqual({ best: "a", rank: 1, loss: 0, top: ["a", "b", "c"] });
    expect(deepResult("c", scores)).toEqual({ best: "a", rank: 3, loss: 10, top: ["a", "b", "c"] });
    expect(deepResult("z", scores)).toBeNull();
  });

  it("off-peak hours", () => {
    expect(offPeak(QUIET)).toBe(true);
    expect(offPeak(BUSY)).toBe(false);
  });

  it("checks a flagged player's counted moves (every legal move, the pick's group first), then the level can ban", async () => {
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
      // (The engine's own candidates: every legal move of the position, the pick first; a1 has three.)
      expect(calls[0]![0]).toBe("a1a2");
      expect([...calls[0]!].sort()).toEqual(["a1a2", "a1b1", "a1b2"]);
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

  it("as shipped (Nov 10, the engine pool), detection never bans: the same overwhelming evidence pools them, and emails nobody", async () => {
    expect(FAIRPLAY.enforcement).toBe("pool");
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const p = await player(sql, "Cheat");
    const sent: string[] = [];
    const mail: CaseMailer = async (_u, kind) => void sent.push(kind);
    await recordFairPlay(sql, p.id, { lobby: "AAAAA", mode: "crowd", moves: engineMatch() }, QUIET - 2 * HOUR, mail);
    await recordFairPlay(sql, p.id, { lobby: "BBBBB", mode: "crowd", moves: engineMatch() }, QUIET - HOUR, mail);
    await deepCheckRun(sql, fakeSearch().search, QUIET, { mail, perRun: 100 });
    expect(JSON.parse((await sql.first<{ summary: string }>("SELECT summary FROM fairplay_matches ORDER BY id LIMIT 1"))!.summary)).toMatchObject({ deepChecked: 20, deepMatch: 20 });
    expect((await caseOf(sql, p.id))?.status).toBe("pool");
    expect(sent).toEqual([]);
  });

  it("the near-best catch-up (Nov 11): an open case's matches stored before the count are worked out again from their stored deep results, no searches; an engine user pools with no new match; a second run changes nothing", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const p = await player(sql, "Eddie");
    // Another engine's top move every pick: our deep re-check's exact best on 15 of 20, the rest half a point off (Stockfish 19 against
    // our 17.1, the live demo). As the deep re-check stored it before Nov 11: deepMatch the exact count, no deepExact.
    const top = ["a1a2", "a1b1", "a1b2"];
    const eddie = engineMatch().map((m, i) => ({ ...m, deep: i % 4 === 1 ? { best: "a1b1", rank: 2, loss: 0.5, top: ["a1b1", "a1a2", "a1b2"] } : { best: "a1a2", rank: 1, loss: 0, top } }));
    const old = (moves: FairMove[]) => {
      const { deepExact, ...rest } = matchSignals(moves, null);
      return JSON.stringify({ ...rest, deepMatch: deepExact });
    };
    for (const [lobby, at] of [["AAAAA", QUIET - 2 * HOUR], ["BBBBB", QUIET - HOUR]] as const) {
      await recordFairPlay(sql, p.id, { lobby, mode: "crowd", moves: engineMatch() }, at);
      await sql.run("UPDATE fairplay_matches SET moves = ?, summary = ?, deep_done = 1, deep_queued = 0 WHERE user_id = ? AND lobby = ?", JSON.stringify(eddie), old(eddie), p.id, lobby);
    }
    await setCase(sql, p.id, "review", "detection", "a match scored 14", QUIET - HOUR);
    // Someone with no open case: left alone.
    const q = await player(sql, "Quiet");
    await recordFairPlay(sql, q.id, { lobby: "CCCCC", mode: "crowd", moves: engineMatch() }, QUIET - HOUR);
    await sql.run("UPDATE fairplay_matches SET moves = ?, summary = ? WHERE user_id = ?", JSON.stringify(eddie), old(eddie), q.id);
    await sql.run("DELETE FROM fairplay_cases WHERE user_id = ?", q.id);
    expect(await recountDeep(sql, QUIET)).toBe(2);
    const rows = await sql.all<{ summary: string }>("SELECT summary FROM fairplay_matches WHERE user_id = ?", p.id);
    for (const r of rows) expect(JSON.parse(r.summary)).toMatchObject({ deepChecked: 20, deepMatch: 20, deepExact: 15 });
    expect(await caseOf(sql, p.id)).toMatchObject({ status: "pool", reason: expect.stringMatching(/^level ban: .*moves near the engine's best/) });
    expect(JSON.parse((await sql.first<{ summary: string }>("SELECT summary FROM fairplay_matches WHERE user_id = ?", q.id))!.summary).deepExact).toBeUndefined();
    // Idempotent: nothing left to catch up, so no new log line either.
    const log = async () => (await sql.all("SELECT id FROM fairplay_log WHERE user_id = ?", p.id)).length;
    const lines = await log();
    expect(await recountDeep(sql, QUIET + HOUR)).toBe(0);
    expect(await log()).toBe(lines);
    expect((await caseOf(sql, p.id))?.status).toBe("pool");
  });

  it("the catch-up's bounds (the review of #629, m3 and m5): a cleared case (a Release) and any match played from RECOUNT_BEFORE on are left as they are", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const top = ["a1a2", "a1b1", "a1b2"];
    const eddie = engineMatch().map((m, i) => ({ ...m, deep: i % 4 === 1 ? { best: "a1b1", rank: 2, loss: 0.5, top: ["a1b1", "a1a2", "a1b2"] } : { best: "a1a2", rank: 1, loss: 0, top } }));
    const { deepExact, ...rest } = matchSignals(eddie, null);
    // (As the deep re-check stored it before Nov 11: deepMatch the exact count, no deepExact.)
    const old = JSON.stringify({ ...rest, deepMatch: deepExact });
    const store = async (userId: string, lobby: string, at: number) => {
      await recordFairPlay(sql, userId, { lobby, mode: "crowd", moves: engineMatch() }, at);
      await sql.run("UPDATE fairplay_matches SET moves = ?, summary = ?, deep_done = 1, deep_queued = 0 WHERE user_id = ? AND lobby = ?", JSON.stringify(eddie), old, userId, lobby);
    };
    const row = async (userId: string, lobby: string) => {
      const r = (await sql.first<{ summary: string; moves: string | null }>("SELECT summary, moves FROM fairplay_matches WHERE user_id = ? AND lobby = ?", userId, lobby))!;
      return { deepExact: (JSON.parse(r.summary) as { deepExact?: number }).deepExact, kept: r.moves !== null };
    };
    const lines = async (userId: string) => (await sql.all("SELECT id FROM fairplay_log WHERE user_id = ?", userId)).length;
    // Released from the pool (a clearing): a person weighed these matches, so they stay as they are, moves and all.
    const r = await player(sql, "Released");
    await store(r.id, "AAAAA", RECOUNT_BEFORE - 3 * HOUR);
    await setCase(sql, r.id, "pool", "detection", "level ban: one match", RECOUNT_BEFORE - 3 * HOUR);
    expect(await decide(sql, r.id, "release", "admin:eric@example.com", "", RECOUNT_BEFORE - 2 * HOUR)).toEqual({ ok: true, status: "cleared" });
    // In review: a match from before the cutoff, and one from it on.
    const l = await player(sql, "Late");
    await store(l.id, "BBBBB", RECOUNT_BEFORE - HOUR);
    await store(l.id, "CCCCC", RECOUNT_BEFORE);
    expect((await caseOf(sql, l.id))?.status).toBe("review");
    const released = await lines(r.id);
    expect(await recountDeep(sql, RECOUNT_BEFORE + HOUR)).toBe(1);
    expect(await row(r.id, "AAAAA")).toEqual({ deepExact: undefined, kept: true });
    expect((await caseOf(sql, r.id))?.status).toBe("cleared");
    expect(await lines(r.id)).toBe(released);
    expect(await row(l.id, "BBBBB")).toEqual({ deepExact: 15, kept: true });
    expect(await row(l.id, "CCCCC")).toEqual({ deepExact: undefined, kept: true });
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
    // The watched player waits for the quiet hours; then, not in review, only as far as a ban could need (banMatchChecked moves).
    expect((await deepCheckRun(sql, search, BUSY, { perRun: 100 })).searches).toBe(0);
    expect((await deepCheckRun(sql, search, QUIET, { perRun: 100 })).searches).toBe(FAIRPLAY.levels.banMatchChecked);
    expect(calls).toHaveLength(12 + FAIRPLAY.levels.banMatchChecked);
    const row = () => sql.first<{ deep_done: number; summary: string }>("SELECT deep_done, summary FROM fairplay_matches WHERE user_id = ?", watched.id);
    expect(await row()).toMatchObject({ deep_done: 0 });
    expect(JSON.parse((await row())!.summary)).toMatchObject({ deepChecked: FAIRPLAY.levels.banMatchChecked });
    // In review (that much evidence puts them there, or a person does): the rest.
    await setCase(sql, watched.id, "review", "reports", "3 reports", QUIET);
    expect((await deepCheckRun(sql, search, QUIET, { perRun: 100 })).searches).toBe(12 - FAIRPLAY.levels.banMatchChecked);
    expect(await row()).toMatchObject({ deep_done: 1 });
    // The budget: no more than the day's searches.
    await sql.run("INSERT OR REPLACE INTO fairplay_budget (day, searches) VALUES (?, ?)", new Date(QUIET + 2 * 86_400_000).toISOString().slice(0, 10), FAIRPLAY.deep.dailySearches);
    const late = await player(sql, "Late");
    await recordFairPlay(sql, late.id, { lobby: "CCCCC", mode: "crowd", moves: engineMatch(12) }, QUIET + 2 * 86_400_000 - HOUR);
    expect((await deepCheckRun(sql, search, QUIET + 2 * 86_400_000, { perRun: 100 })).searches).toBe(0);
  });

  it("outside a review, a match checked as far as a ban could need leaves the queue undone; a review queues it again (the review of #610, m4)", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const p = await player(sql, "Strong");
    await recordFairPlay(sql, p.id, { lobby: "AAAAA", mode: "crowd", moves: engineMatch(12) }, QUIET - HOUR);
    await setCase(sql, p.id, "watch", "reports", "a report", QUIET - HOUR);
    // The deep search prefers another move: the evidence drops, the case stays on watch.
    const { calls, search } = fakeSearch("a1b1");
    expect((await deepCheckRun(sql, search, QUIET, { perRun: 100 })).searches).toBe(FAIRPLAY.levels.banMatchChecked);
    expect((await caseOf(sql, p.id))?.status).toBe("watch");
    const row = () => sql.first<{ deep_done: number; deep_queued: number }>("SELECT deep_done, deep_queued FROM fairplay_matches WHERE user_id = ?", p.id);
    expect(await row()).toEqual({ deep_done: 0, deep_queued: 0 });
    expect((await deepCheckRun(sql, search, QUIET + 1000, { perRun: 100 })).searches).toBe(0);
    await setCase(sql, p.id, "review", "admin:eric@example.com", "a closer look", QUIET + 2000);
    expect(await row()).toEqual({ deep_done: 0, deep_queued: 1 });
    expect((await deepCheckRun(sql, search, QUIET + 3000, { perRun: 100 })).searches).toBe(12 - FAIRPLAY.levels.banMatchChecked);
    expect(calls).toHaveLength(12);
    expect(await row()).toEqual({ deep_done: 1, deep_queued: 0 });
  });

  it("a position's whole budget is taken before its first search: never half a position searched and thrown away (the review of #610, m4)", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const p = await player(sql, "Pat");
    // Kings and a rook: 19 legal moves, three searches a position.
    const fen = "6k1/8/6K1/8/8/8/8/R7 w - - 0 1";
    await recordFairPlay(sql, p.id, { lobby: "AAAAA", mode: "crowd", moves: engineMatch(12).map((m) => ({ ...m, fen, move: "a1a8", best: "a1a8" })) }, QUIET - HOUR);
    await setCase(sql, p.id, "review", "reports", "3 reports", QUIET - HOUR);
    const day = new Date(QUIET).toISOString().slice(0, 10);
    const used = async () => (await sql.first<{ searches: number }>("SELECT searches FROM fairplay_budget WHERE day = ?", day))?.searches;
    await sql.run("INSERT OR REPLACE INTO fairplay_budget (day, searches) VALUES (?, ?)", day, FAIRPLAY.deep.dailySearches - 5);
    const { calls, search } = fakeSearch("a1a8");
    // Room for one position (3), not two: one searched, the second never started, its 2 left in the budget.
    expect(await deepCheckRun(sql, search, QUIET, { perRun: 100 })).toEqual({ searches: 3, matches: 0 });
    expect(calls).toHaveLength(3);
    expect(await used()).toBe(FAIRPLAY.deep.dailySearches - 2);
    // A server that stops answering halfway: the searches it never made go back.
    await sql.run("UPDATE fairplay_budget SET searches = 0 WHERE day = ?", day);
    let n = 0;
    await deepCheckRun(sql, async (_f, ms) => (++n === 1 ? ms.map((m) => ({ move: m, expected: 0.5 })) : null), QUIET, { perRun: 100 });
    expect(await used()).toBe(2);
  });

  it("queues a player's every kept match once one is flagged (an earlier, honest-looking match can clear them)", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const p = await player(sql, "Pat");
    const quiet = engineMatch(12).map((m, i) => ({ ...m, move: i % 2 ? "a1b1" : "a1a2", loss: i % 2 ? 9 : 0, crowdFound: 30 }));
    await recordFairPlay(sql, p.id, { lobby: "AAAAA", mode: "crowd", moves: quiet }, QUIET - 2 * HOUR);
    const queued = () => sql.all<{ lobby: string; deep_queued: number | null }>("SELECT lobby, deep_queued FROM fairplay_matches ORDER BY id");
    expect((await queued()).map((r) => r.deep_queued ?? 0)).toEqual([0]);
    await recordFairPlay(sql, p.id, { lobby: "BBBBB", mode: "crowd", moves: engineMatch(12) }, QUIET - HOUR);
    expect((await queued()).map((r) => r.deep_queued)).toEqual([1, 1]);
    const { calls, search } = fakeSearch();
    await deepCheckRun(sql, search, QUIET, { perRun: 100 });
    expect(calls).toHaveLength(24);
    expect((await queued()).map((r) => r.deep_queued)).toEqual([0, 0]);
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

  it("the candidates are the engine's own: a judges' list forged to make the pick look best (poor moves and the pick) can't (Nov 10, finding 3)", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const p = await player(sql, "Victim");
    // Kings and a rook: 19 legal moves for White, so three searches (7, 6 and 6). The engine's best is the mate in one (a1a8), which the
    // forged list leaves out; it names the pick (g6h6) best among two other king moves.
    const fen = "6k1/8/6K1/8/8/8/8/R7 w - - 0 1";
    const forged = engineMatch(12).map((m) => ({ ...m, fen, move: "g6h6", best: "g6h6", top: ["g6h6", "g6f6", "g6f5"] }));
    await recordFairPlay(sql, p.id, { lobby: "AAAAA", mode: "crowd", moves: forged }, QUIET - HOUR);
    await setCase(sql, p.id, "review", "reports", "forged", QUIET - HOUR);
    const calls: string[][] = [];
    const search: DeepSearch = async (_fen, moves) => {
      calls.push([...moves]);
      return moves.map((m) => ({ move: m, expected: m === "a1a8" ? 1 : m === "g6h6" ? 0.6 : 0.55 }));
    };
    await deepCheckRun(sql, search, QUIET, { perRun: 100 });
    // Every legal move searched, at most 8 a search, the pick's group first.
    expect(calls.slice(0, 3).flat().sort()).toEqual(legalMoves(fen).sort());
    expect(calls.every((c) => c.length <= 8)).toBe(true);
    expect(calls[0]![0]).toBe("g6h6");
    const kept = JSON.parse((await sql.first<{ moves: string }>("SELECT moves FROM fairplay_matches"))!.moves) as FairMove[];
    const checked = kept.filter((m) => m.deep);
    expect(checked.length).toBeGreaterThan(0);
    // The engine's best is its own (the mate), so the pick is never a "deep match".
    expect(checked.every((m) => m.deep!.best === "a1a8" && m.deep!.rank === 2)).toBe(true);
  });

  it("a position Stockfish refuses is passed over, not waited on: the match is still done", async () => {
    // (The engine server never gets one, so it would never answer: engine.ts, containerScore. No game makes one.)
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const p = await player(sql, "Pat");
    const ninePawns = "4k3/8/8/8/8/P7/PPPPPPPP/4K3 w - - 0 1";
    expect(stockfishRefuses(ninePawns)).not.toBeNull();
    const moves = engineMatch(12).map((m, i) => (i === 3 ? { ...m, fen: ninePawns } : m));
    await recordFairPlay(sql, p.id, { lobby: "AAAAA", mode: "crowd", moves }, QUIET - HOUR);
    const fens: string[] = [];
    const search: DeepSearch = async (fen, ms) => {
      fens.push(fen);
      return stockfishRefuses(fen) ? null : ms.map((m) => ({ move: m, expected: m === "a1a2" ? 0.55 : 0.5 }));
    };
    const r = await deepCheckRun(sql, search, QUIET, { perRun: 100 });
    expect(fens).toHaveLength(11);
    expect(fens).not.toContain(ninePawns);
    expect(r.matches).toBe(1);
    expect((await sql.first<{ deep_done: number | null }>("SELECT deep_done FROM fairplay_matches"))!.deep_done).toBe(1);
  });
});
