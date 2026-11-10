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
 * Independent review of PR #610 (review/fable-b2): tests that show three findings. Read-only: not part of the PR.
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

describe("review of #610: findings shown", () => {
  it("M1: the deep re-check scores every legal move, but which moves count (only move, decided) still comes from the judges' numbers", () => {
    const moves = forgedMatch(16);
    for (const m of moves) m.deep = deepResult(m.move, [{ move: "a1a2", expected: 0.6 }, { move: "a1b1", expected: 0.25 }, { move: "a1b2", expected: 0.25 }])!;
    const s = matchSignals(moves, 1500);
    // Every one counted, and every one a "deep match"...
    expect(s.counted).toBe(16);
    expect(s.deepChecked).toBe(16);
    expect(s.deepMatch).toBe(16);
    // ...though by the server's own numbers 3 in 4 are only moves most of the crowd found (the 4th: a "hard" one only because the
    // judges said the crowd missed it), which count for nothing.
    expect(skipReason({ ...moves[1]!, gap: 35 })).toBe("only");
  });

  it("M1: end to end, an honest player's obvious moves, reported by lying judges, reach the ban bar, and the reviewer's token can ban", async () => {
    expect(FAIRPLAY.enforcement).toBe("review");
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const p = await player(sql, "Honest");
    await recordFairPlay(sql, p.id, { lobby: "AAAAA", mode: "crowd", moves: forgedMatch() }, QUIET - 2 * HOUR);
    await recordFairPlay(sql, p.id, { lobby: "BBBBB", mode: "crowd", moves: forgedMatch() }, QUIET - HOUR);
    expect((await caseOf(sql, p.id))?.status).toBe("review");
    for (let i = 0; i < 5; i++) await deepCheckRun(sql, onlyMoveSearch, QUIET, { all: true, perRun: 200 });
    const r = await decide(sql, p.id, "ban", "reviewer", "deep re-check confirms engine moves", QUIET + 1000);
    expect(r).toEqual({ ok: true, status: "banned" });
    expect((await caseOf(sql, p.id))?.status).toBe("banned");
  });

  it("m1: a fair-play write that failed after its row went in never opens the case or queues the deep re-check on the retry", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const p = await player(sql, "Cheat");
    // Control: no failure, the verdict opens a review and queues the deep re-check.
    const q = await player(sql, "Control");
    await recordFairPlay(sql, q.id, { lobby: "AAAAA", mode: "crowd", moves: forgedMatch(), since: 1 }, QUIET);
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
    expect(retry.verdict.level).not.toBe("none");
    expect(retry.acted).toBe("none");
    expect(await caseOf(sql, p.id)).toBeNull();
    expect((await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM fairplay_matches WHERE user_id = ? AND deep_queued = 1", p.id))?.n).toBe(0);
  });

  it("m2: while results wait to be written, every event's persist waits on the write before it arms the match's alarm", async () => {
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
    let loading: Promise<unknown> = Promise.resolve();
    const ctx = {
      storage: { get: async () => undefined, list: async () => new Map(), put: async () => undefined, setAlarm: async () => void events.push("setAlarm"), deleteAlarm: async () => void events.push("deleteAlarm"), deleteAll: async () => undefined },
      getWebSockets: () => [],
      acceptWebSocket: () => undefined,
      waitUntil: (pr: Promise<unknown>) => void pr.catch(() => undefined),
      blockConcurrencyWhile: (fn: () => Promise<unknown>) => (loading = fn()),
    };
    const lobby = new Lobby(ctx as never, { DB: db, RESEND_API_KEY: "x" } as never) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    await loading;
    const now = Date.now();
    const rec = newLobbyRecord("ABCDE", now);
    const pending: PendingResult = {
      playerId: "p1",
      userId: u.id,
      result: { playerId: "p1", placement: 1, players: 2, team: null, teamWon: null, avgScore: null, rating: null, brilliant: 0, bestMove: null, ranked: false, evalBar: null } as never,
      at: now,
      span: { moves: 12, ms: 300_000 },
      opponents: [],
      battle: null,
    };
    rec.saveQueue = [pending];
    lobby.record = rec;
    const persisting = lobby.persist(lobby.core("ABCDE"));
    await new Promise((r) => setTimeout(r, 200));
    // The write is waiting on D1: no alarm armed yet (the match's next event, or anything else this event decided).
    expect(events).toEqual([]);
    release();
    await persisting;
    expect(events).toEqual(["setAlarm"]);
  });
});
