import { describe, expect, it, vi } from "vitest";
import { FAIRPLAY, matchSignals, skipReason, type FairMove } from "@chessroyale/core";
import { createGuest, ensureSchema, signInWithIdentity, d1Sql, type Sql, type User } from "../src/accounts.ts";
import { caseOf, decide, recordFairPlay } from "../src/fairplay.ts";
import { deepCheckRun, deepResult, type DeepSearch } from "../src/fairplay-deep.ts";
import { newLobbyRecord, type PendingResult } from "../src/lobby.ts";
import { memoryDb } from "./memory-db.ts";

vi.mock("../src/engine.ts", () => ({ SERVER_RECHECK_NODES: 2_000_000, serverRecheck: async () => null, serverScoreAt: async () => null, warmEngine: async () => false }));
import { Lobby } from "../src/lobby-do.ts";

/**
 * The independent review of PR #610 (branch review/fable-b2): its proof tests, each turned into a check the fixes pass (M1, m1, m2).
 * m3 to m6 are checked where their code's tests are: match-end-save, fairplay-deep, engine-server and welcome.
 */

const HOUR = 3_600_000;
const QUIET = Date.UTC(2026, 9, 10, 5);

async function player(sql: Sql, name: string): Promise<User> {
  const g = await createGuest(sql, 1000, name);
  return signInWithIdentity(sql, g.user, "email", `${name.toLowerCase()}@example.com`, {}, 1000);
}

/**
 * What two lying judges report for an honest player's match: each pick "the best", in "hard" positions (2 of 40 found it), and no
 * only move (gap 3). By the server's own deep search (onlyMoveSearch) every one of these picks was an only move (35 points clear).
 */
function forgedMatch(n = 20): FairMove[] {
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

/** The engine server's answer: a1a2 0.60, every other move 0.25 (an only move: 35 points, past FAIRPLAY.signals.onlyGap). */
const onlyMoveSearch: DeepSearch = async (_fen, moves) => moves.map((m) => ({ move: m, expected: m === "a1a2" ? 0.6 : 0.25 }));

describe("the review of #610: its findings, fixed", () => {
  it("M1 (still open, so the reviewer never bans): which moves count (only move, decided) comes from the judges' numbers, not the deep search's", () => {
    const moves = forgedMatch(16);
    for (const m of moves) m.deep = deepResult(m.move, [{ move: "a1a2", expected: 0.6 }, { move: "a1b1", expected: 0.25 }, { move: "a1b2", expected: 0.25 }])!;
    const s = matchSignals(moves, 1500);
    // Every one counted, and every one a "deep match"...
    expect(s.counted).toBe(16);
    expect(s.deepChecked).toBe(16);
    expect(s.deepMatch).toBe(16);
    // ...though by the server's own numbers 3 in 4 are only moves most of the crowd found, which count for nothing. (Steps 1-3 of the
    // review's fix, before Eric turns bans back on: ROADMAP.md, fair play.)
    expect(skipReason({ ...moves[1]!, gap: 35 })).toBe("only");
  });

  it("M1: an honest player's obvious moves, reported by lying judges in one lobby, reach the ban bar: a review, never the pool; the reviewer's token can't ban them; a person can", async () => {
    expect(FAIRPLAY.enforcement).toBe("pool");
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const p = await player(sql, "Honest");
    await recordFairPlay(sql, p.id, { lobby: "AAAAA", mode: "crowd", moves: forgedMatch() }, QUIET - HOUR);
    expect((await caseOf(sql, p.id))?.status).toBe("review");
    for (let i = 0; i < 5; i++) await deepCheckRun(sql, onlyMoveSearch, QUIET, { all: true, perRun: 200 });
    // At the ban bar on that one match, so on one lobby's judges: a review (a person looks), not the engine pool (the #618 review, M3).
    expect((await sql.all<{ reason: string }>("SELECT reason FROM fairplay_log WHERE user_id = ? AND action = 'note'", p.id)).map((l) => l.reason)).toContainEqual(
      expect.stringMatching(/^level ban on one match \(two would pool\): one match/),
    );
    const r = await decide(sql, p.id, "ban", "reviewer", "deep re-check confirms engine moves", QUIET + 1000);
    expect(r).toEqual({ ok: false, status: 409, message: expect.stringMatching(/^a ban is for a person/) });
    expect((await caseOf(sql, p.id))?.status).toBe("review");
    // Review, watch and clear stay the reviewer's.
    expect(await decide(sql, p.id, "watch", "reviewer", "obvious moves the crowd missed", QUIET + 2000)).toEqual({ ok: true, status: "watch" });
    expect((await decide(sql, p.id, "ban", "admin:eric@example.com", "a person read the games", QUIET + 3000)).ok).toBe(true);
    expect((await caseOf(sql, p.id))?.status).toBe("banned");
  });

  it("m1: a fair-play write that failed after its row went in opens the case and queues the deep re-check on the retry, weighing the match once", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const p = await player(sql, "Cheat");
    // Control: no failure, the verdict opens a review and queues the deep re-check.
    const q = await player(sql, "Control");
    const control = await recordFairPlay(sql, q.id, { lobby: "AAAAA", mode: "crowd", moves: forgedMatch(), since: 1 }, QUIET);
    expect((await caseOf(sql, q.id))?.status).toBe("review");
    // The same match for p, with D1 failing once right after the row went in (at queueDeep), then retried as writeResult does.
    let blip = true;
    const flaky: Sql = {
      ...sql,
      run: async (query: string, ...params: unknown[]) => {
        if (blip && /SET deep_queued = 1/.test(query)) {
          blip = false;
          throw new Error("D1 blip");
        }
        return sql.run(query, ...params);
      },
    };
    await expect(recordFairPlay(flaky, p.id, { lobby: "AAAAA", mode: "crowd", moves: forgedMatch(), since: 1 }, QUIET)).rejects.toThrow("D1 blip");
    const retry = await recordFairPlay(flaky, p.id, { lobby: "AAAAA", mode: "crowd", moves: forgedMatch(), since: 1 }, QUIET);
    // Weighed once (its own row isn't counted twice): the same score and level as the control's.
    expect(retry.summary.score).toBe(control.summary.score);
    expect(retry.verdict).toEqual(control.verdict);
    expect(retry.acted).toBe("review");
    expect((await caseOf(sql, p.id))?.status).toBe("review");
    expect((await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM fairplay_matches WHERE user_id = ?", p.id))?.n).toBe(1);
    expect((await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM fairplay_matches WHERE user_id = ? AND deep_queued = 1", p.id))?.n).toBe(1);
  });

  it("m2: while results wait to be written, an event arms the match's alarm first and writes them in the background", async () => {
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql);
    const u = await player(sql, "Ann");
    // D1 that answers only once released (slow, as in a D1 incident).
    let release!: () => void;
    let closed = false;
    const gated = new Promise<void>((r) => (release = r));
    const gate = { then: (f: () => void) => (closed ? gated.then(f) : Promise.resolve().then(f)) };
    const real = d1 as unknown as { prepare(q: string): any; batch(s: any[]): Promise<any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
    const slow = (st: any): any => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
      bind: (...p: unknown[]) => slow(st.bind(...p)),
      run: async () => (await gate, st.run()),
      first: async () => (await gate, st.first()),
      all: async () => (await gate, st.all()),
      _raw: st,
    });
    const db = { prepare: (q: string) => slow(real.prepare(q)), batch: async (s: any[]) => (await gate, real.batch(s.map((x) => x._raw ?? x))) }; // eslint-disable-line @typescript-eslint/no-explicit-any
    await ensureSchema(d1Sql(db as never), db as never);
    closed = true;
    const events: string[] = [];
    const pending: Promise<unknown>[] = [];
    let loading: Promise<unknown> = Promise.resolve();
    const ctx = {
      storage: { get: async () => undefined, list: async () => new Map(), put: async () => undefined, setAlarm: async () => void events.push("setAlarm"), deleteAlarm: async () => void events.push("deleteAlarm"), deleteAll: async () => undefined },
      getWebSockets: () => [],
      acceptWebSocket: () => undefined,
      waitUntil: (pr: Promise<unknown>) => void pending.push(pr.catch(() => undefined)),
      blockConcurrencyWhile: (fn: () => Promise<unknown>) => (loading = fn()),
    };
    const lobby = new Lobby(ctx as never, { DB: db, RESEND_API_KEY: "x" } as never) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    await loading;
    const now = Date.now();
    const rec = newLobbyRecord("ABCDE", now);
    const p: PendingResult = {
      playerId: "p1",
      userId: u.id,
      result: { playerId: "p1", placement: 1, players: 2, team: null, teamWon: null, avgScore: null, rating: null, brilliant: 0, bestMove: null, ranked: false, evalBar: null } as never,
      at: now,
      span: { moves: 12, ms: 300_000 },
      opponents: [],
      battle: null,
    };
    rec.saveQueue = [p];
    lobby.record = rec;
    // The event finishes while D1 is still waiting: its alarm (the results' next try, a second on) armed, the write not done.
    await lobby.persist(lobby.core("ABCDE"));
    expect(events).toEqual(["setAlarm"]);
    expect(rec.saveQueue).toHaveLength(1);
    // D1 answers: the background write goes in, once.
    release();
    await Promise.all(pending);
    expect(rec.saveQueue).toEqual([]);
    expect((await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM results WHERE user_id = ?", u.id))?.n).toBe(1);
  });
});
