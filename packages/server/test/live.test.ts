import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { FRONT_DOOR, itemDef } from "@chessroyale/core";
import { createGuest, ensureSchema, publicProfile, recordResult, signInWithIdentity, touchSession, userFromToken, type Sql } from "../src/accounts.ts";
import { handleAccountApi } from "../src/api.ts";
import { equipLocker, openCrate } from "../src/locker.ts";
import { liveCounts, recordWait, reportLobby, typicalWait, type LobbySummary } from "../src/live.ts";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

function memoryDb() {
  const db = new DatabaseSync(":memory:");
  const sql: Sql = {
    async run(q, ...p) {
      db.prepare(q).run(...(p as never[]));
    },
    async first(q, ...p) {
      return (db.prepare(q).get(...(p as never[])) ?? null) as never;
    },
    async all(q, ...p) {
      return db.prepare(q).all(...(p as never[])) as never;
    },
  };
  const stmt = (q: string, params: unknown[] = []) => ({
    bind: (...p: unknown[]) => stmt(q, p),
    run: async () => (db.prepare(q).run(...(params as never[])), { success: true }),
    first: async () => db.prepare(q).get(...(params as never[])) ?? null,
    all: async () => ({ results: db.prepare(q).all(...(params as never[])) }),
  });
  const d1 = { prepare: (q: string) => stmt(q) } as unknown as D1Database;
  return { db, sql, d1 };
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

describe("the live line", () => {
  it("online: accounts seen in the last minute; a heartbeat counts, written at most every 15 s", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const now = 10_000_000;
    const a = await createGuest(sql, now - 5 * 60_000, "Ann");
    const b = await createGuest(sql, now - 5 * 60_000, "Bo");
    await createGuest(sql, now - 5 * 60_000, "Cy");
    expect((await liveCounts(sql, now)).online).toBe(0);
    await touchSession(sql, a.token, now);
    await userFromToken(sql, b.token, now - 30_000);
    expect((await liveCounts(sql, now)).online).toBe(2);
    // A minute later only a fresh heartbeat keeps you online.
    await touchSession(sql, a.token, now + 50_000);
    expect((await liveCounts(sql, now + 61_000)).online).toBe(1);
    // Within 15 s nothing is written (last_seen stays put).
    await touchSession(sql, a.token, now + 55_000);
    const row = await sql.first<{ last_seen: number }>("SELECT last_seen FROM users WHERE id = ?", a.user.id);
    expect(row!.last_seen).toBe(now + 50_000);
    await touchSession(sql, "not-a-token", now);
  });

  it("matches running, the queue and the playing-now list come from what lobbies report; stale ones drop out", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const now = 50_000_000;
    await reportLobby(sql, lobby("AAAAA", { startedAt: now - 60_000 }), now - 1000);
    await reportLobby(sql, lobby("BBBBB", { mode: "boss", kind: "private", alive: 7, total: 9, bossElo: 2000, startedAt: now - 5_000 }), now - 1000);
    // Waiting in the queue: 4 + 2 people.
    await reportLobby(sql, lobby("CCCCC", { phase: "waiting", humans: 4, alive: null, total: null, startedAt: null }), now - 1000);
    await reportLobby(sql, lobby("DDDDD", { phase: "waiting", humans: 2, alive: null, total: null, startedAt: null, mode: "boss" }), now - 1000);
    // Private lobbies still waiting aren't listed; a match nobody is connected to doesn't count.
    await reportLobby(sql, lobby("EEEEE", { phase: "waiting", kind: "private", humans: 5 }), now - 1000);
    await reportLobby(sql, lobby("FFFFF", { humans: 0 }), now - 1000);
    // A lobby that stopped reporting (crashed, say) drops out.
    await reportLobby(sql, lobby("GGGGG"), now - FRONT_DOOR.matchStaleMs - 1);
    const live = await liveCounts(sql, now);
    expect(live.matches).toBe(2);
    expect(live.queue).toBe(6);
    expect(live.playing).toEqual([
      { mode: "boss", alive: 7, total: 9, bossElo: 2000, startedAt: now - 5_000 },
      { mode: "crowd", alive: 80, total: 100, bossElo: null, startedAt: now - 60_000 },
    ]);
    // The match ends: off the list.
    await reportLobby(sql, lobby("AAAAA", { phase: "over" }), now);
    expect((await liveCounts(sql, now)).matches).toBe(1);
  });

  it("the typical wait: the median of recent matchmade starts, rounded to 5 s; none without history", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const now = 900_000_000;
    expect(await typicalWait(sql, "crowd", now)).toBeNull();
    for (const [i, ms] of [12_000, 19_000, 23_000, 60_000, 21_000].entries()) await recordWait(sql, "crowd", 3, ms, now - i * 1000);
    expect(await typicalWait(sql, "crowd", now)).toBe(20);
    expect(await typicalWait(sql, "boss", now)).toBeNull();
    // Waits older than a week don't count.
    expect(await typicalWait(sql, "crowd", now + 8 * 86_400_000)).toBeNull();
    expect((await liveCounts(sql, now)).waits).toEqual({ crowd: 20, boss: null });
  });

  it("GET /api/live answers without an account and marks a session's account online", async () => {
    const { d1, sql } = memoryDb();
    const env = { DB: d1 };
    const me = await handleAccountApi(new Request("https://hunchess.com/api/me"), env as never);
    const cookie = me!.headers.get("set-cookie")!.split(";")[0]!;
    const anon = await handleAccountApi(new Request("https://hunchess.com/api/live"), env as never);
    expect(anon!.status).toBe(200);
    expect(await anon!.json()).toMatchObject({ online: 1, matches: 0, queue: 0, playing: [], waits: { crowd: null, boss: null } });
    await sql.run("UPDATE users SET last_seen = 0");
    const res = await handleAccountApi(new Request("https://hunchess.com/api/live", { headers: { cookie } }), env as never);
    expect(res!.status).toBe(200);
    const seen = await sql.first<{ last_seen: number }>("SELECT last_seen FROM users");
    expect(seen!.last_seen).toBeGreaterThan(0);
  });
});

describe("profiles", () => {
  it("stats come only from what was recorded: cuts, brilliant moves, raids, bosses beaten, the rating chart", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const { user } = await createGuest(sql, 1000, "Eric");
    // An older result, recorded before these stats existed: it counts as a game, nothing more.
    await recordResult(sql, user.id, { mode: "crowd", online: true, placement: 30, players: 100 }, 2000);
    await recordResult(sql, user.id, { mode: "crowd", online: true, placement: 1, players: 100, rating: 1500, brilliant: 2, bestMove: "Nxe5", cuts: 11, cutsSurvived: 11 }, 3000);
    await recordResult(sql, user.id, { mode: "crowd", online: false, placement: 23, players: 100, rating: 1560, brilliant: 0, bestMove: "Bb5", cuts: 6, cutsSurvived: 5 }, 4000);
    await recordResult(
      sql,
      user.id,
      { mode: "boss", online: true, placement: 1, players: 8, teamWon: true, rating: 1612, brilliant: 1, bestMove: "Qh5", strikes: 4, strikesSurvived: 4, survived: true, lastStand: true, bossElo: 2000 },
      5000,
    );
    await recordResult(sql, user.id, { mode: "boss", online: true, placement: 6, players: 8, teamWon: null, strikes: 2, strikesSurvived: 1, survived: false, lastStand: false, bossElo: 2200 }, 6000);
    // A made-up boss strength or a bad move string isn't stored.
    await recordResult(sql, user.id, { mode: "boss", online: false, placement: 1, players: 1, teamWon: true, bossElo: 1234, bestMove: "<script>" }, 7000);
    const p = (await publicProfile(sql, user.id, 7000))!;
    expect(p.crowd).toEqual({ games: 3, wins: 1, avgPlace: 18, best: 1, cutsSurvivedPct: 94, brilliant: 2 });
    expect(p.boss).toEqual({ raids: 3, bossesBeaten: 1, strikesSurvived: 5, lastStands: 1, survivedPct: 50, brilliant: 1 });
    expect(p.bossesBeaten).toEqual([2000]);
    expect(p.ratingHistory).toEqual([1500, 1560, 1612]);
    expect(p.rating).toBe(1612);
    expect(p.tier).toEqual({ label: "Gold II", color: "#f2c14e" });
    expect(p.recent[0]).toMatchObject({ mode: "boss", bestMove: null, bossElo: null, won: true });
    expect(p.recent[2]).toMatchObject({ mode: "boss", bestMove: "Qh5", bossElo: 2000 });
    // Not enough rated players for a percentile yet.
    expect(p.topPercent).toBeNull();
    expect(p.online).toBe(true);
  });

  it("nothing private: no email, no sign-in method, no icon; and the percentile once enough players are rated", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const { user } = await createGuest(sql, 1000, "Eric");
    const signed = await signInWithIdentity(sql, user, "email", "eric@example.com", {}, 2000);
    const r = await openCrate(sql, signed.id, "winter-1", {}, 3000);
    if (!r.ok) throw new Error(r.message);
    await equipLocker(sql, signed.id, itemDef(r.item.def)!.slot, r.item.id);
    for (let i = 0; i < 12; i++) {
      const g = await createGuest(sql, 1000, `P${i}`);
      await recordResult(sql, g.user.id, { mode: "crowd", online: true, placement: 5, players: 100, rating: 1000 + i * 100 }, 4000);
    }
    await recordResult(sql, signed.id, { mode: "crowd", online: true, placement: 5, players: 100, rating: 1950 }, 5000);
    const p = (await publicProfile(sql, signed.id, 5000))!;
    const text = JSON.stringify(p);
    expect(text).not.toContain("eric@example.com");
    expect(text).not.toMatch(/email|google|signedIn|icon/i);
    expect(Object.keys(p.look)).toHaveLength(1);
    // 13 rated; 2 above (2000, 2100): 3rd of 13 = top 24%.
    expect(p.topPercent).toBe(24);
    expect(await publicProfile(sql, "nobody", 5000)).toBeNull();
  });

  it("GET /api/profile/ID: anyone's, by id; 404 for no such player", async () => {
    const { d1 } = memoryDb();
    const env = { DB: d1 };
    const me = await handleAccountApi(new Request("https://hunchess.com/api/me?name=Ann"), env as never);
    const mine = (await me!.json()) as { user: { id: string } };
    const res = await handleAccountApi(new Request(`https://hunchess.com/api/profile/${mine.user.id}`), env as never);
    expect(res!.status).toBe(200);
    expect(await res!.json()).toMatchObject({ id: mine.user.id, name: "Ann", crowd: { games: 0 }, boss: { raids: 0 } });
    expect((await handleAccountApi(new Request("https://hunchess.com/api/profile/nope"), env as never))!.status).toBe(404);
  });

  it("migrations: new columns are added once, and the latest rating is filled in from stored results", async () => {
    const { sql } = memoryDb();
    // The tables as they were before (no new columns), with results already stored.
    await sql.run("CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, icon TEXT NOT NULL DEFAULT '♟', email TEXT UNIQUE, google_sub TEXT UNIQUE, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL)");
    await sql.run(
      "CREATE TABLE results (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, mode TEXT NOT NULL, online INTEGER NOT NULL, placement INTEGER NOT NULL, players INTEGER NOT NULL, team TEXT, team_won INTEGER, avg_score REAL, rating INTEGER, played_at INTEGER NOT NULL)",
    );
    await sql.run("INSERT INTO users (id, name, created_at, last_seen) VALUES ('u1', 'Old', 1, 1)");
    await sql.run("INSERT INTO results (user_id, mode, online, placement, players, rating, played_at) VALUES ('u1', 'crowd', 1, 3, 100, 1400, 10)");
    await sql.run("INSERT INTO results (user_id, mode, online, placement, players, rating, played_at) VALUES ('u1', 'crowd', 1, 3, 100, 1720, 20)");
    await sql.run("INSERT INTO results (user_id, mode, online, placement, players, rating, played_at) VALUES ('u1', 'crowd', 1, 3, 100, NULL, 30)");
    await ensureSchema(sql);
    await ensureSchema(sql, {});
    const u = await sql.first<{ rating: number }>("SELECT rating FROM users WHERE id = 'u1'");
    expect(u!.rating).toBe(1720);
    const p = (await publicProfile(sql, "u1", 100))!;
    expect(p.crowd).toMatchObject({ games: 3, cutsSurvivedPct: null, brilliant: null });
  });
});
