import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { CAPACITY, FRONT_DOOR } from "@chessroyale/core";
import { createGuest, ensureSchema, userFromToken, type Sql } from "../src/accounts.ts";
import { LiveBoard, liveCounts, reportLobby, writeLastSeen, type LobbySummary } from "../src/live.ts";
import { RateLimiter, rateLimited } from "../src/limits.ts";
import { cachedUserId, markSeen } from "../src/presence.ts";

/** Capacity (DECISIONS.md, "Capacity: built"): the live hub's board, presence, batched last_seen, rate limits. */

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

function memorySql(): Sql & { statements: string[] } {
  const db = new DatabaseSync(":memory:");
  const statements: string[] = [];
  return {
    statements,
    async run(q, ...p) {
      statements.push(q);
      db.prepare(q).run(...(p as never[]));
    },
    async first(q, ...p) {
      statements.push(q);
      return (db.prepare(q).get(...(p as never[])) ?? null) as never;
    },
    async all(q, ...p) {
      statements.push(q);
      return db.prepare(q).all(...(p as never[])) as never;
    },
  };
}

const lobby = (code: string, patch: Partial<LobbySummary> = {}): LobbySummary => ({
  code,
  mode: "crowd",
  kind: "queue",
  phase: "playing",
  humans: 3,
  alive: 80,
  total: 100,
  bossElo: null,
  startedAt: 1000,
  ...patch,
});

describe("the live hub's board", () => {
  it("the home page's live window: the running match with the most people in it, with its board (no names); none without a board", () => {
    const now = 50_000_000;
    const board = new LiveBoard();
    const at = (fen: string, ply: number) => ({ fen, lastMove: "e2e4", votes: [["e4", 31], ["d4", 12]] as [string, number][], ply });
    board.report(lobby("AAAAA", { humans: 2, startedAt: now - 60_000, board: at("a", 10) }), now - 1000);
    board.report(lobby("BBBBB", { humans: 5, startedAt: now - 90_000, board: at("b", 20) }), now - 1000);
    board.report(lobby("CCCCC", { humans: 9, startedAt: now - 30_000 }), now - 1000);
    board.report(lobby("DDDDD", { humans: 0, board: at("d", 3) }), now - 1000);
    board.report(lobby("EEEEE", { humans: 50, board: at("e", 3) }), now - FRONT_DOOR.matchStaleMs - 1);
    const c = board.counts(now, { crowd: null, boss: null });
    expect(c.featured).toEqual({ mode: "crowd", alive: 80, total: 100, bossElo: null, startedAt: now - 90_000, board: at("b", 20) });
    expect(JSON.stringify(c.featured)).not.toMatch(/AAAAA|BBBBB|code|humans/);
    // A tie on people: the newest. The match ending: the next one.
    board.report(lobby("FFFFF", { humans: 5, startedAt: now - 10_000, board: at("f", 2) }), now - 500);
    expect(board.counts(now, { crowd: null, boss: null }).featured?.board.fen).toBe("f");
    board.report(lobby("FFFFF", { phase: "over" }), now);
    board.report(lobby("BBBBB", { phase: "over" }), now);
    expect(board.counts(now, { crowd: null, boss: null }).featured?.board.fen).toBe("a");
    board.report(lobby("AAAAA", { phase: "over" }), now);
    expect(board.counts(now, { crowd: null, boss: null }).featured).toBeNull();
  });

  it("gives the same numbers as the D1 live line for the same reports and visits", async () => {
    const sql = memorySql();
    await ensureSchema(sql);
    const now = 50_000_000;
    const board = new LiveBoard();
    const reports: [LobbySummary, number][] = [
      [lobby("AAAAA", { startedAt: now - 60_000 }), now - 1000],
      [lobby("BBBBB", { mode: "boss", kind: "private", alive: 7, total: 9, bossElo: 2000, startedAt: now - 5_000 }), now - 1000],
      [lobby("CCCCC", { phase: "waiting", humans: 4, alive: null, total: null, startedAt: null }), now - 2000],
      [lobby("DDDDD", { phase: "waiting", humans: 2, alive: null, total: null, startedAt: null, mode: "boss" }), now - 2000],
      [lobby("EEEEE", { phase: "waiting", kind: "private", humans: 5 }), now - 2000],
      [lobby("FFFFF", { humans: 0 }), now - 1000],
      [lobby("GGGGG"), now - FRONT_DOOR.matchStaleMs - 1],
      [lobby("HHHHH", { phase: "over" }), now - 1000],
    ];
    for (const [s, at] of reports) {
      await reportLobby(sql, s, at);
      board.report(s, at);
    }
    const users = await Promise.all(["Ann", "Bo", "Cy"].map((n) => createGuest(sql, now - 5 * 60_000, n)));
    for (const [i, u] of users.entries()) {
      const at = now - [10_000, 59_000, 61_000][i]!;
      await sql.run("UPDATE users SET last_seen = ? WHERE id = ?", at, u.user.id);
      board.markSeen([u.user.id], at);
    }
    const waits = { crowd: null, boss: null };
    expect(board.counts(now, waits)).toEqual(await liveCounts(sql, now));
    expect(board.counts(now, waits)).toMatchObject({ online: 2, matches: 2, queue: 6 });
    // The overload limit counts people in lobbies: queues and running matches (not a private lobby still waiting).
    expect(board.players(now)).toBe(3 + 3 + 4 + 2);
    board.forget("AAAAA");
    expect(board.counts(now, waits).matches).toBe(1);
  });

  it("last_seen: written once per account per minute at most, in one statement for many accounts", async () => {
    const sql = memorySql();
    await ensureSchema(sql);
    const t = 10_000_000;
    const ids = (await Promise.all(Array.from({ length: 30 }, (_, i) => createGuest(sql, t - 600_000, `P${i}`)))).map((g) => g.user.id);
    const board = new LiveBoard();
    const every = CAPACITY.presence.lastSeenWriteMs;
    // A heartbeat every 5 s for two minutes, with a write pass every 5 s: each account written at most once a minute.
    let writes = 0;
    let statements = 0;
    for (let s = 0; s <= 120; s += 5) {
      board.markSeen(ids, t + s * 1000);
      const due = board.lastSeenDue(t + s * 1000, every);
      writes += due.length;
      const before = sql.statements.length;
      if (due.length) await writeLastSeen(sql, due);
      statements += sql.statements.length - before;
    }
    expect(writes).toBe(30 * 3); // at 0 s, 60 s and 120 s
    expect(statements).toBe(3);
    const row = await sql.first<{ last_seen: number }>("SELECT last_seen FROM users WHERE id = ?", ids[0]);
    expect(row!.last_seen).toBe(t + 120_000);
    // Never moves backwards.
    await writeLastSeen(sql, [{ id: ids[0]!, at: t }]);
    expect((await sql.first<{ last_seen: number }>("SELECT last_seen FROM users WHERE id = ?", ids[0]))!.last_seen).toBe(t + 120_000);
  });

  it("restarting: who was online comes back from D1, and isn't written again", () => {
    const board = new LiveBoard();
    board.restoreSeen([{ id: "a", last_seen: 1000 }]);
    expect(board.isOnline("a", 1000 + FRONT_DOOR.onlineWindowMs - 1)).toBe(true);
    expect(board.lastSeenDue(2000, 60_000)).toEqual([]);
    board.markSeen(["a"], 70_000);
    expect(board.lastSeenDue(70_000, 60_000)).toEqual([{ id: "a", at: 70_000 }]);
  });

  it("forgets presence long gone and lobbies silent for an hour", () => {
    const board = new LiveBoard();
    board.markSeen(["a"], 0);
    board.lastSeenDue(0, 60_000);
    board.report(lobby("AAAAA"), 0);
    expect(board.prune(61 * 60_000)).toEqual(["AAAAA"]);
    expect(board.size).toEqual({ seen: 0, lobbies: 0 });
  });
});

describe("presence", () => {
  it("passes who it has seen to the hub in batches, at most every flushMs", async () => {
    const calls: string[][] = [];
    const env = { LIVE: { idFromName: () => "g", get: () => ({ seen: async (ids: string[]) => void calls.push(ids) }) } } as never;
    const waits: Promise<unknown>[] = [];
    const t = Date.now() + 10 * 60_000; // (well after any earlier flush in this instance)
    markSeen(env, "a", t, (p) => waits.push(p));
    markSeen(env, "b", t + 10, (p) => waits.push(p));
    markSeen(env, "c", t + 20, (p) => waits.push(p));
    await Promise.all(waits);
    expect(calls).toEqual([["a"], ["b", "c"]]);
  }, CAPACITY.presence.flushMs + 2000);

  it("the heartbeat's session lookup is cached: one D1 read, and no write", async () => {
    const sql = memorySql();
    await ensureSchema(sql);
    const now = 10_000_000;
    const g = await createGuest(sql, now, "Ann");
    const before = sql.statements.length;
    for (let i = 0; i < 5; i++) expect(await cachedUserId(sql, g.token, now + i * 30_000)).toBe(g.user.id);
    expect(sql.statements.length - before).toBe(1);
    expect(await cachedUserId(sql, "nope", now)).toBeNull();
    // Requests that load the account mark it seen through the hub instead of writing D1.
    const seen: string[] = [];
    const n = sql.statements.length;
    await userFromToken(sql, g.token, now, (id) => void seen.push(id));
    expect(seen).toEqual([g.user.id]);
    expect(sql.statements.slice(n).some((q) => /^UPDATE/i.test(q.trim()))).toBe(false);
  });
});

describe("the schema check", () => {
  it("a new Worker instance on an up-to-date database makes one read, not the whole schema", async () => {
    const sql = memorySql();
    await ensureSchema(sql, {});
    const first = sql.statements.length;
    expect(first).toBeGreaterThan(20);
    await ensureSchema(sql, {}); // another instance
    expect(sql.statements.length - first).toBe(1);
  });
});

describe("rate limits", () => {
  it("counts per key per window and says when to try again", () => {
    const l = new RateLimiter(3, 60_000);
    expect([1, 2, 3].map(() => l.hit("a", 0).ok)).toEqual([true, true, true]);
    expect(l.hit("a", 10_000)).toEqual({ ok: false, retryMs: 50_000 });
    expect(l.hit("b", 10_000).ok).toBe(true);
    expect(l.hit("a", 60_000).ok).toBe(true);
  });

  it("generous for players: the home screen's polling and PLAY in line never hit them; a runaway script does", () => {
    const L = CAPACITY.rateLimits;
    let t = 1_000_000;
    // Ten minutes on the home screen (every 5 s) plus a PLAY in line (every 3 s) from one account.
    for (let s = 0; s < 600; s++, t += 1000) {
      if (s % 5 === 0) expect(rateLimited({ ip: "1.1.1.1", session: "tok-a", play: false }, t)).toBeNull();
      if (s % 3 === 0) expect(rateLimited({ ip: "1.1.1.1", session: "tok-a", play: true }, t)).toBeNull();
    }
    // A phone reloading a match screen 20 times in a minute, about 15 requests each.
    for (let i = 0; i < 20 * 15; i++) expect(rateLimited({ ip: "4.4.4.4", session: "tok-c", play: false }, t + i * 200)).toBeNull();
    // A script hammering from one account.
    let limited = 0;
    for (let i = 0; i < L.perUser.limit + 10; i++) if (rateLimited({ ip: "2.2.2.2", session: "tok-b", play: false }, t) !== null) limited++;
    expect(limited).toBe(10);
    // The per-address limit can be lifted for a load test from one machine (staging), never the per-account one.
    for (let i = 0; i < L.perIp.limit + 5; i++) rateLimited({ ip: "3.3.3.3", session: null, play: false }, t);
    expect(rateLimited({ ip: "3.3.3.3", session: null, play: false }, t)).not.toBeNull();
    expect(rateLimited({ ip: "3.3.3.3", session: null, play: false }, t, true)).toBeNull();
  });
});
