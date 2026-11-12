import { afterEach, describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
import { DEFAULT_SETTINGS, MATCH_SAVE, RAID_SETTINGS, mulberry32, type Settings } from "@chessroyale/core";
import { legalMoves, type BoardScore, type ServerMessage } from "@chessroyale/chess";
import { LobbyCore, newLobbyRecord, type LobbyRecord } from "../src/lobby.ts";
import { library } from "./lobby-fixture.ts";
import { createGuest, d1Sql, ensureSchema, recordResult, signInWithIdentity } from "../src/accounts.ts";
import { opsStats } from "../src/ops.ts";
import { memoryDb } from "./memory-db.ts";

// (The engine server is a Container, which needs the Workers runtime: not here.)
vi.mock("../src/engine.ts", () => ({ SERVER_RECHECK_NODES: 2_000_000, serverRecheck: async () => null, serverScoreAt: async () => null, warmEngine: async () => false }));
import { Lobby } from "../src/lobby-do.ts";

/**
 * A match's end on players' profiles (the outside review of Nov 10, finding 9; its proof test, turned around): a raid played to its
 * end in memory, then its results written by the lobby's Durable Object. Before, saving again (as after a restart before
 * `resultsSaved` was stored) doubled every row, a failed write was swallowed with `resultsSaved` already set, and all of a match's
 * D1 calls ran in one go. Now the results wait in the record until written, every write is keyed to the lobby, a few players are
 * written per wake, and a failure is kept to try again and reported.
 */

type Msg = ServerMessage;
const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const play = (fen: string, uci: string) => {
  const c = new Chess(fen);
  c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  return c;
};
/** What the side to move can win at once: mate = 100, else the best capture's value. */
const gain = (fen: string, moves: string[]) => {
  let best = { move: moves[0]!, v: -1 };
  for (const m of moves) {
    const before = new Chess(fen);
    const cap = before.get(m.slice(2, 4) as never);
    let v = cap ? VAL[cap.type]! : 0;
    try {
      if (play(fen, m).isCheckmate()) v = 100;
    } catch {
      continue;
    }
    if (v > best.v) best = { move: m, v };
  }
  return best;
};

/** A raid of `n` people played to its end in memory (the boss's worst moves, the crowd's best captures): its record. */
function raidToTheEnd(n: number): { core: LobbyCore; rec: LobbyRecord; ids: string[] } {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  const settings: Partial<Settings> = { ...RAID_SETTINGS, raidOpening: true };
  const core = new LobbyCore(newLobbyRecord("ABCDE", now), { now: () => now, send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), { ...msg, now } as Msg]) }, library, mulberry32(7), {
    ...DEFAULT_SETTINGS,
    boardIntroSeconds: 0,
    ...settings,
  });
  const last = <T extends Msg["t"]>(id: string, t: T) => [...(inbox.get(id) ?? [])].reverse().find((m) => m.t === t) as Extract<Msg, { t: T }> | undefined;
  const drop = (id: string, t: Msg["t"]) => inbox.set(id, (inbox.get(id) ?? []).filter((m) => m.t !== t));
  const advance = (ms: number) => {
    now += ms;
    if (core.nextAlarm && core.nextAlarm <= now) core.alarm();
  };
  const ids = Array.from({ length: n }, (_, i) => `p${i + 1}`);
  ids.forEach((_, i) => core.connect(undefined, `P${i + 1}`, i ? "phone" : "computer", false, 1500));
  core.message("p1", { t: "start" });
  advance(1000);
  advance(60_000);
  for (let i = 0; i < 600 && core.record.phase !== "results"; i++) {
    const phase = core.record.phase;
    if (phase === "boss") {
      const req = last("p1", "bossRequest");
      if (req) {
        const allowed = req.allowed ?? legalMoves(req.fen);
        let worst = { move: allowed[0]!, v: -1 };
        for (const m of allowed) {
          let a: Chess;
          try {
            a = play(req.fen, m);
          } catch {
            continue;
          }
          const v = gain(a.fen(), legalMoves(a.fen())).v;
          if (v > worst.v) worst = { move: m, v };
        }
        core.message("p1", { t: "bossMove", key: req.key, move: worst.move });
        drop("p1", "bossRequest");
      }
    } else if (phase === "play") {
      const r = last("p1", "round");
      if (r?.board && !core.record.round?.picks.p1) {
        const ok = r.boss?.powers?.allowed ?? legalMoves(r.board.fen);
        const pick = gain(r.board.fen, ok).move;
        for (const id of ids) {
          const rr = last(id, "round");
          if (rr) core.message(id, { t: "pick", key: rr.key, move: pick });
        }
      }
    } else if (phase === "scoring") {
      const req = last("p1", "scoreRequest");
      if (req) {
        const boards: BoardScore[] = req.jobs.map((j) => {
          const legal = legalMoves(j.fen);
          return { boardId: j.boardId, bestMove: legal[0]!, bestExpected: 0.6, expectedAfter: Object.fromEntries(legal.map((m) => [m, 0.5])), botPicks: {}, botThinkMs: {} };
        });
        core.message("p1", { t: "scores", key: req.key, boards });
        drop("p1", "scoreRequest");
      }
    }
    advance(20_000);
  }
  expect(core.record.phase).toBe("results");
  return { core, rec: core.save(), ids };
}

/** D1 over the in-memory database, counting calls (a batch is one) and able to be down. */
function countingD1(d1: D1Database) {
  const state = { calls: 0, down: false };
  const fail = async () => {
    throw new Error("D1 is down");
  };
  const real = d1 as unknown as { prepare(q: string): any; batch(s: any[]): Promise<any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
  const wrap = (st: any): any => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    bind: (...p: unknown[]) => wrap(st.bind(...p)),
    run: async () => (state.calls++, state.down ? fail() : st.run()),
    first: async () => (state.calls++, state.down ? fail() : st.first()),
    all: async () => (state.calls++, state.down ? fail() : st.all()),
    _raw: st,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = { prepare: (q: string) => wrap(real.prepare(q)), batch: async (s: any[]) => (state.calls++, state.down ? fail() : real.batch(s.map((x) => x._raw ?? x))) };
  return { db: db as unknown as D1Database, state };
}

/** The lobby's Durable Object on a fake runtime, holding `rec`, writing to `db`. */
async function lobbyOn(db: D1Database, rec: LobbyRecord) {
  const pending: Promise<unknown>[] = [];
  let loading: Promise<unknown> = Promise.resolve();
  const ctx = {
    storage: { get: async () => undefined, list: async () => new Map(), put: async () => undefined, setAlarm: async () => undefined, deleteAlarm: async () => undefined, deleteAll: async () => undefined },
    getWebSockets: () => [],
    acceptWebSocket: () => undefined,
    waitUntil: (p: Promise<unknown>) => void pending.push(p.catch(() => undefined)),
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => (loading = fn()),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lobby = new Lobby(ctx as never, { DB: db, RESEND_API_KEY: "x" } as never) as any;
  // (Its load from storage first, as a wake's: then the record it holds.)
  await loading;
  lobby.record = rec;
  return lobby as { record: LobbyRecord; queueResults(core: LobbyCore, rec: LobbyRecord): void; writeResults(): Promise<boolean> };
}

async function world(n: number) {
  const { core, rec, ids } = raidToTheEnd(n);
  // (One device scored and played the boss in this raid (unvouched): taken as a checked match's, so fair play's rows are written.)
  delete rec.unvouched;
  const { sql, d1, db } = memoryDb();
  await ensureSchema(sql);
  rec.accounts = {};
  for (const id of ids) {
    const g = await createGuest(sql, Date.now(), id);
    rec.accounts[id] = (await signInWithIdentity(sql, g.user, "email", `${id}@example.com`, {}, Date.now())).id;
  }
  const counting = countingD1(d1);
  // (The room's own schema check, done: a failure below is a write's.)
  await ensureSchema(d1Sql(counting.db), counting.db);
  const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
  return { core, rec, ids, sql, db, counting, count, lobby: await lobbyOn(counting.db, rec) };
}

const saved = { ...MATCH_SAVE };
afterEach(() => Object.assign(MATCH_SAVE as Record<string, number>, saved));

describe("a match's end: saved once, a few players a wake, a failure kept and retried (Nov 10, finding 9)", () => {
  it("saving again, as after a restart before `resultsSaved` was stored, writes nothing more (before: 10 rows became 20)", async () => {
    const w = await world(10);
    w.lobby.queueResults(w.core, w.rec);
    expect(w.rec.resultsSaved).toBe(true);
    expect(w.rec.saveQueue).toHaveLength(10);
    for (let i = 0; i < 20 && w.rec.saveQueue?.length; i++) expect(await w.lobby.writeResults()).toBe(true);
    const rows = { results: w.count("results"), fair: w.count("fairplay_matches"), ledger: w.count("ledger") };
    expect(rows.results).toBe(10);
    expect(rows.fair).toBe(10);
    // The restart: the record from before it stored `resultsSaved` (and the queue's last removals). Everything again: nothing new.
    w.rec.resultsSaved = false;
    w.rec.saveQueue = [];
    w.lobby.queueResults(w.core, w.rec);
    expect(w.rec.saveQueue).toHaveLength(10);
    for (let i = 0; i < 20 && w.rec.saveQueue?.length; i++) expect(await w.lobby.writeResults()).toBe(true);
    expect({ results: w.count("results"), fair: w.count("fairplay_matches"), ledger: w.count("ledger") }).toEqual(rows);
  }, 60_000);

  it("a match that rested on one device's word (unvouched) writes its results but no fair-play rows (the review of #611, m4)", async () => {
    const w = await world(3);
    w.rec.unvouched = "the host scored a round alone";
    w.lobby.queueResults(w.core, w.rec);
    for (let i = 0; i < 20 && w.rec.saveQueue?.length; i++) expect(await w.lobby.writeResults()).toBe(true);
    expect({ results: w.count("results"), fair: w.count("fairplay_matches") }).toEqual({ results: 3, fair: 0 });
  });

  it("at most MATCH_SAVE.perWake players a wake, so a wake's D1 calls stay far under D1's 1,000 a invocation", async () => {
    (MATCH_SAVE as Record<string, number>).perWake = 4;
    const w = await world(10);
    w.lobby.queueResults(w.core, w.rec);
    const perWake: number[] = [];
    for (let i = 0; i < 20 && w.rec.saveQueue?.length; i++) {
      const before = w.counting.state.calls;
      await w.lobby.writeResults();
      perWake.push(w.counting.state.calls - before);
    }
    expect(perWake).toHaveLength(3);
    expect(w.count("results")).toBe(10);
    // (About 20 a player: MATCH_SAVE's default 20 players a wake is about 400.)
    for (const n of perWake) expect(n).toBeLessThan(4 * 30);
    expect(Math.max(...perWake) * (saved.perWake / 4)).toBeLessThan(1000);
  }, 60_000);

  it("a failed write is kept in the record and tried again (never swallowed with `resultsSaved` set), and the ops page hears of it", async () => {
    const w = await world(3);
    const failedBefore = opsStats().calls["lobby.saveFailed"] ?? 0;
    w.counting.state.down = true;
    w.lobby.queueResults(w.core, w.rec);
    expect(await w.lobby.writeResults()).toBe(false);
    expect(w.rec.resultsSaved).toBe(true);
    expect(w.rec.saveQueue).toHaveLength(3);
    expect(w.rec.saveQueue![0]!.failedAt).toBeLessThanOrEqual(Date.now());
    expect(opsStats().calls["lobby.saveFailed"]).toBe(failedBefore + 1);
    expect(w.count("results")).toBe(0);
    // D1 back: the next try writes them all, once.
    w.counting.state.down = false;
    expect(await w.lobby.writeResults()).toBe(true);
    expect(w.rec.saveQueue).toEqual([]);
    expect(w.count("results")).toBe(3);
    expect(w.count("fairplay_matches")).toBe(3);
  }, 60_000);

  it("a write that stopped halfway (fair play and XP in, the result not) is finished by the next try, adding nothing twice", async () => {
    const w = await world(2);
    w.lobby.queueResults(w.core, w.rec);
    // D1 goes down right after the first player's fair play row (their XP and result not yet in).
    const real = w.counting.db.prepare.bind(w.counting.db);
    let armed = true;
    (w.counting.db as { prepare: unknown }).prepare = (q: string) => {
      if (armed && /^\s*INSERT INTO fairplay_matches/.test(q)) {
        armed = false;
        const st = real(q);
        return { ...st, bind: (...p: unknown[]) => ({ ...st.bind(...p), first: async () => ((await st.bind(...p).first()), (w.counting.state.down = true), null) }) };
      }
      return real(q);
    };
    expect(await w.lobby.writeResults()).toBe(false);
    expect(w.count("fairplay_matches")).toBe(1);
    expect(w.count("results")).toBe(0);
    w.counting.state.down = false;
    expect(await w.lobby.writeResults()).toBe(true);
    expect(w.count("fairplay_matches")).toBe(2);
    expect(w.count("results")).toBe(2);
  }, 60_000);

  it("one result that keeps failing never holds up the others; MATCH_SAVE.strictMinutes after its first failure its fair play stops holding it up", async () => {
    const w = await world(3);
    const bad = w.rec.accounts!.p2!;
    // Fair play's row always fails for one player (a lasting bug, say); everything else works.
    const real = w.counting.db.prepare.bind(w.counting.db);
    (w.counting.db as { prepare: unknown }).prepare = (q: string) => {
      const st = real(q);
      if (!/^\s*INSERT INTO fairplay_matches/.test(q)) return st;
      return { ...st, bind: (...p: unknown[]) => (p[0] === bad ? { first: async () => Promise.reject(new Error("a lasting bug")) } : st.bind(...p)) };
    };
    w.lobby.queueResults(w.core, w.rec);
    expect(await w.lobby.writeResults()).toBe(false);
    // The other two went in; the failing one waits at the back.
    expect(w.count("results")).toBe(2);
    const first = w.rec.saveQueue![0]!.failedAt!;
    expect(w.rec.saveQueue!.map((p) => p.userId)).toEqual([bad]);
    expect(first).toBeGreaterThan(Date.now() - 60_000);
    // However many tries fail within MATCH_SAVE.strictMinutes of the first (a short D1 outage, say), its fair play still holds it up.
    for (let i = 0; i < 5; i++) expect(await w.lobby.writeResults()).toBe(false);
    expect(w.count("results")).toBe(2);
    expect(w.rec.saveQueue![0]!.failedAt).toBe(first);
    // MATCH_SAVE.strictMinutes on: its result goes in without its fair play row (logged).
    w.rec.saveQueue![0]!.failedAt = first - MATCH_SAVE.strictMinutes * 60_000;
    expect(await w.lobby.writeResults()).toBe(true);
    expect(w.rec.saveQueue).toEqual([]);
    expect(w.count("results")).toBe(3);
    expect(w.count("fairplay_matches")).toBe(2);
  }, 60_000);

  it("a result written late (a retry, hours on) never puts an older rating back: the rating is the latest counting result's", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const g = await createGuest(sql, 1000, "Ann");
    const ann = await signInWithIdentity(sql, g.user, "email", "ann@example.com", {}, 1000);
    const rating = async () => (await sql.first<{ rating: number | null }>("SELECT rating FROM users WHERE id = ?", ann.id))?.rating;
    const ranked = { mode: "crowd" as const, online: true, placement: 3, players: 100, ranked: true };
    await recordResult(sql, ann.id, { ...ranked, rating: 1600, lobby: "BBBBB" }, 2_000_000, { since: 1_900_000 });
    expect(await rating()).toBe(1600);
    // An older match's result, written only now (its lobby was retrying): on the profile, but the rating stays the newer one.
    await recordResult(sql, ann.id, { ...ranked, rating: 1500, lobby: "AAAAA" }, 1_000_000, { since: 900_000 });
    expect(await rating()).toBe(1600);
    // And once per lobby: again, nothing new.
    await recordResult(sql, ann.id, { ...ranked, rating: 1500, lobby: "AAAAA" }, 1_000_000, { since: 900_000 });
    expect((await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM results WHERE user_id = ?", ann.id))?.n).toBe(2);
  });
});
