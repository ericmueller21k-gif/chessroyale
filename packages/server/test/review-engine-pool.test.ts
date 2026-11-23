import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FAIRPLAY, matchSignals, playerLevel, type FairMove } from "@chessroyale/core";
import { createGuest, createSession, ensureSchema, recordResult, signInWithIdentity, type Sql, type User } from "../src/accounts.ts";
import { caseOf, decide, recordFairPlay, setCase } from "../src/fairplay.ts";
import { handleAdmin, poolExport, poolHint, poolPlayers } from "../src/admin.ts";
import { deepCheckRun, type DeepSearch } from "../src/fairplay-deep.ts";
import { MATCH_STARTED, type LobbyRecord } from "../src/lobby.ts";
import { memoryDb } from "./memory-db.ts";

// (The engine server is a Container, which needs the Workers runtime: not here.)
vi.mock("../src/engine.ts", () => ({ SERVER_RECHECK_NODES: 2_000_000, serverRecheck: async () => null, serverScoreAt: async () => null, warmEngine: async () => false }));
const { Lobby } = await import("../src/lobby-do.ts");

/**
 * The independent review of PR #618, the engine pool (branch review/engine-pool): its proof tests, each turned into a check the fixes
 * pass (M1, M2, M3, M4 (its proof "m2"), m1, m4). m3 is checked in engine-pool.test.ts (Cancel asks both queues), the Squads side of m4
 * in squads-do.test.ts, and M3's one forged lobby in review-b2.test.ts (M1).
 */

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
/** An honest match: the best move half the time, a few points lost otherwise (no deep re-check). */
const plain = engineMatch(false).map((m, i) => (i % 2 ? { ...m, move: "a1b1", loss: 6 } : m));

/** Into the pool as detection puts them: a match at the one-match bar (Nov 11: one pools; two did before). */
async function pooled(sql: Sql, name: string, at: number): Promise<User> {
  const u = await player(sql, name);
  await recordFairPlay(sql, u.id, { lobby: `${name.slice(0, 4).toUpperCase()}A`, mode: "crowd", moves: bar }, at);
  expect((await caseOf(sql, u.id))?.status).toBe("pool");
  return u;
}

/** Counts the statements a Sql runs, or a D1 binding prepares. */
function counting(sql: Sql): { sql: Sql; n: () => number; reset: () => void } {
  let n = 0;
  const wrapped: Sql = {
    run: (q, ...p) => (n++, sql.run(q, ...p)),
    first: (q, ...p) => (n++, sql.first(q, ...p)),
    all: (q, ...p) => (n++, sql.all(q, ...p)),
    batch: (s) => ((n += s.length), sql.batch(s)),
  };
  return { sql: wrapped, n: () => n, reset: () => void (n = 0) };
}

describe("the review of #618: its findings, fixed", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["Date"] }));
  afterEach(() => vi.useRealTimers());

  it("M1: the pool's download carries no email, once a person has decided the case too (Released, then pooled again)", async () => {
    vi.setSystemTime(T0);
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const p = await pooled(sql, "Pat", T0 - 10_000);
    expect(await decide(sql, p.id, "release", "admin:eric@example.com", "mail eric@example.com", T0 + 1000)).toEqual({ ok: true, status: "cleared" });
    await recordFairPlay(sql, p.id, { lobby: "BBBBB", mode: "crowd", moves: bar }, T0 + 2000);
    await recordFairPlay(sql, p.id, { lobby: "CCCCC", mode: "crowd", moves: bar }, T0 + 3000);
    expect((await caseOf(sql, p.id))?.status).toBe("pool");
    const text = JSON.stringify(await poolExport(sql, T0 + 4000));
    expect(text).not.toContain("eric@example.com");
    expect(text).not.toMatch(/@/);
  });

  it("M2: still playing at the ban bar in the pool outranks lost Boss Battles; crowd and raid losses are never 'crushed'; 1 v 1 against the pool is", async () => {
    vi.setSystemTime(T0 + 10 * DAY);
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const raids = async (u: User) => {
      for (let i = 1; i <= 5; i++) await recordResult(sql, u.id, { mode: "boss", online: true, placement: 2, players: 100, teamWon: false, rating: 2400, ranked: true }, T0 + i * HOUR);
    };
    // Pat: five raids the boss won, and a match at the ban bar again.
    const pat = await pooled(sql, "Pat", T0);
    await raids(pat);
    await recordFairPlay(sql, pat.id, { lobby: "CCCCC", mode: "raid", moves: bar }, T0 + 6 * HOUR);
    // Quinn: only the five raids. Rae: five 1 v 1 losses to Pat, pooled. Sam: three honest matches, far below what pooled them.
    const quinn = await pooled(sql, "Quinn", T0);
    await raids(quinn);
    const rae = await pooled(sql, "Rae", T0);
    for (let i = 1; i <= 5; i++)
      await sql.run(
        "INSERT INTO ranked_1v1_games (id, white_id, black_id, control, result, reason, moves, times, started_at, ended_at, nonce) VALUES (?, ?, ?, '5+0', '1-0', 'mate', '[]', '[]', ?, ?, 'n')",
        `G${i}`,
        pat.id,
        rae.id,
        T0 + i * HOUR,
        T0 + i * HOUR,
      );
    const sam = await pooled(sql, "Sam", T0);
    for (let i = 1; i <= FAIRPLAY.pool.hint.dropMatches; i++) await recordFairPlay(sql, sam.id, { lobby: `S${i}SSS`, mode: "crowd", moves: plain }, T0 + i * HOUR);
    const rows = new Map((await poolPlayers(sql)).map((r) => [r.userId, r]));
    expect(rows.get(pat.id)!.inPool).toMatchObject({ games: 5, wins: 0, matches: 1, atBar: 1, deepChecked: 20, deepMatch: 20 });
    expect(poolHint(rows.get(pat.id)!)).toBe("still playing like an engine: 1 in-pool match at the ban bar");
    expect(poolHint(rows.get(quinn.id)!)).toBe("");
    expect(rows.get(rae.id)!.inPool).toMatchObject({ duelLosses: 5, vsPool: 5, vsPoolScore: 0 });
    expect(poolHint(rows.get(rae.id)!)).toBe("getting crushed in 1 v 1 by other pooled players: likely a false positive");
    const s = rows.get(sam.id)!;
    expect(s.inPool.avgPerf! + FAIRPLAY.pool.hint.drop).toBeLessThanOrEqual(s.evidence.pooledPerf!);
    expect(poolHint(s)).toBe(`strength down ${s.evidence.pooledPerf! - s.inPool.avgPerf!} since pooled: maybe a false positive`);
  });

  it("M3, replaced (Eric, Nov 11: \"It's better we put people in this queue than under\"): one match past every one-match bar pools on its own; a strong match short of the bars doesn't", async () => {
    vi.setSystemTime(T0);
    const now = T0 + 10_000;
    // A strong match the deep re-check went through: the engine's best on 14 of 20 and 4 points off on the rest (past nearBestLoss).
    const strong = bar.map((m, i) => (i % 10 < 3 ? { ...m, move: "a1b1", loss: 4, deep: { best: "a1a2", rank: 2, loss: 4, top: ["a1a2", "a1b1", "a1b2"] } } : m));
    const at = (moves: FairMove[], t: number) => ({ ...matchSignals(moves, 1500), at: t });
    expect(at(strong, T0)).toMatchObject({ deepChecked: 20, deepMatch: 14, deepExact: 14 });
    expect(playerLevel([at(strong, T0)], now).level).not.toBe("ban");
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const s = await player(sql, "Sam");
    expect((await recordFairPlay(sql, s.id, { lobby: "AAAAA", mode: "crowd", moves: strong }, T0)).acted).not.toBe("pool");
    const p = await player(sql, "Pat");
    expect((await recordFairPlay(sql, p.id, { lobby: "BBBBB", mode: "crowd", moves: bar }, T0)).acted).toBe("pool");
    expect(await caseOf(sql, p.id)).toMatchObject({ status: "pool", reason: expect.stringMatching(/^level ban: one match/) });
  });

  it("m1: a pooled player's matches are deep-checked in full, as a review's", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const search: DeepSearch = async (_fen, moves) => moves.map((m) => ({ move: m, expected: m === "a1a2" ? 0.55 : 0.5 }));
    const checked = async (status: "pool" | "review") => {
      const u = await player(sql, `U${status}`);
      await setCase(sql, u.id, status, "detection", "test", QUIET - 3 * HOUR);
      // (The review's player: half the picks 5 points off the engine's best, far from the one-match bar, so the case stays a review and
      // shows a review's matches checked in full: the review of #629, m5.)
      await recordFairPlay(sql, u.id, { lobby: status === "pool" ? "PPPPP" : "RRRRR", mode: "crowd", moves: status === "pool" ? engineMatch(false) : plain }, QUIET - HOUR);
      for (let i = 0; i < 3; i++) await deepCheckRun(sql, search, QUIET, { userId: u.id, perRun: 500 });
      expect((await caseOf(sql, u.id))?.status).toBe(status);
      const s = JSON.parse((await sql.first<{ summary: string }>("SELECT summary FROM fairplay_matches WHERE user_id = ?", u.id))!.summary) as { deepChecked: number };
      return s.deepChecked;
    };
    expect(await checked("review")).toBe(20);
    expect(await checked("pool")).toBe(20);
  });

  it("M4: the pool list and its tab take the same number of queries for 50 pooled players as for 5; the main page none of them; the download a page of 50", async () => {
    vi.setSystemTime(T0 + DAY);
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql, d1);
    const eric = await player(sql, "Eric");
    const c = counting(sql);
    let prepared = 0;
    const counted = { prepare: (q: string) => (prepared++, d1.prepare(q)), batch: (s: D1PreparedStatement[]) => d1.batch(s) } as unknown as D1Database;
    const env = { DB: counted, ADMIN_EMAILS: "eric@example.com" };
    const cookie = `hc_session=${await createSession(sql, eric.id, T0 + DAY)}`;
    const load = async (path: string) => {
      prepared = 0;
      const res = (await handleAdmin(new Request(`https://hunchess.test${path}`, { headers: { cookie } }), env))!;
      expect(res.status).toBe(200);
      await res.text();
      return prepared;
    };
    const ids: string[] = [];
    const grow = async (n: number) => {
      while (ids.length < n) {
        const u = await player(sql, `P${ids.length}`);
        ids.push(u.id);
        await setCase(sql, u.id, "pool", "detection", "level ban: test", T0);
        await recordFairPlay(sql, u.id, { lobby: "AAAAA", mode: "crowd", moves: bar }, T0 + 1000);
        await recordResult(sql, u.id, { mode: "crowd", online: true, placement: 3, players: 100, rating: 1800, ranked: true }, T0 + 2000);
      }
    };
    const measure = async () => {
      c.reset();
      await poolPlayers(c.sql);
      return { list: c.n(), tab: await load("/admin/fairplay?status=pool"), main: await load("/admin/fairplay") };
    };
    await load("/admin/fairplay");
    const none = await load("/admin/fairplay");
    await grow(5);
    const five = await measure();
    await grow(50);
    const fifty = await measure();
    expect(fifty).toEqual(five);
    expect(five.list).toBeLessThanOrEqual(5);
    expect(fifty.main).toBe(none);
    expect((await poolPlayers(sql)).length).toBe(50);
    // The download: 50 players a file, each file's queries bounded by its 50 (well under D1's 1,000 a request); the next file after it.
    expect(FAIRPLAY.pool.exportPage).toBe(50);
    await grow(53);
    c.reset();
    const first = await poolExport(c.sql, T0 + DAY);
    const perFile = c.n();
    expect(first.players).toHaveLength(50);
    expect(perFile).toBeLessThan(600);
    const sorted = [...ids].sort();
    expect(first.next).toBe(sorted[49]);
    const second = await poolExport(sql, T0 + DAY, first.next!);
    expect(second.players.map((p) => p.userId)).toEqual(sorted.slice(50));
    expect(second.next).toBeNull();
    const tab = await (await handleAdmin(new Request("https://hunchess.test/admin/fairplay?status=pool", { headers: { cookie } }), env))!.text();
    expect(tab).toContain("Engine pool (53)");
    expect(tab).toContain(`<a href="/admin/fairplay/pool.json?after=${sorted[49]}">51–53</a>`);
  });
});

class FakeSocket {
  sent: { t: string; message?: string }[] = [];
  private attachment: unknown = null;
  serializeAttachment(a: unknown) {
    this.attachment = JSON.parse(JSON.stringify(a));
  }
  deserializeAttachment() {
    return this.attachment;
  }
  send(text: string) {
    this.sent.push(JSON.parse(text));
  }
  close() {}
}

describe("m4: a matchmade lobby seats newcomers from its own side of the engine pool only, whoever has the code; a private lobby anyone", () => {
  const RealResponse = Response;
  let pair: FakeSocket[] = [];
  beforeEach(() => {
    // (The Workers runtime's WebSocketPair and 101 answer, on Node.)
    vi.stubGlobal("WebSocketPair", function () {
      pair = [new FakeSocket(), new FakeSocket()];
      return pair;
    });
    vi.stubGlobal(
      "Response",
      class extends RealResponse {
        constructor(body?: BodyInit | null, init?: ResponseInit) {
          super(body, init?.status === 101 ? { ...init, status: 200 } : init);
        }
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("the pool's lobby turns away a clean account, a clean one a pooled account (what anyone hears once a match has begun)", async () => {
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql, d1);
    const cheat = await player(sql, "Cheat");
    const honest = await player(sql, "Honest");
    await setCase(sql, cheat.id, "pool", "detection", "level ban: test", Date.now());
    const room = async (code: string, auto?: { fillAt: number; engine?: boolean }) => {
      const store = new Map<string, unknown>();
      let loading: Promise<unknown> = Promise.resolve();
      const ctx = {
        storage: {
          get: async (k: string) => store.get(k),
          list: async () => new Map(),
          put: async (k: string | Record<string, unknown>, v?: unknown) => {
            for (const [key, val] of Object.entries(typeof k === "string" ? { [k]: v } : k)) store.set(key, JSON.parse(JSON.stringify(val)));
          },
          setAlarm: async () => undefined,
          deleteAlarm: async () => undefined,
          deleteAll: async () => store.clear(),
        },
        getWebSockets: () => [],
        acceptWebSocket: () => undefined,
        waitUntil: (p: Promise<unknown>) => void p.catch(() => undefined),
        blockConcurrencyWhile: (fn: () => Promise<unknown>) => (loading = fn()),
      };
      const lobby = new Lobby(ctx as unknown as DurableObjectState, { DB: d1 } as never);
      await loading;
      await lobby.create(code, {} as LobbyRecord["overrides"], auto);
      expect(!!(store.get("lobby") as LobbyRecord).engine).toBe(!!auto?.engine);
      /** What `u` gets on joining: a seat ("seated") or an error's message. */
      return async (u: User) => {
        const headers = { upgrade: "websocket", cookie: `hc_session=${await createSession(sql, u.id, Date.now())}` };
        await lobby.fetch(new Request(`https://hunchess.test/api/lobby/${code}/ws`, { headers }));
        const ws = pair[1]!;
        await lobby.webSocketMessage(ws as unknown as WebSocket, JSON.stringify({ t: "hello", name: u.name, device: "computer" }));
        const error = ws.sent.find((m) => m.t === "error");
        return error ? error.message : (ws.deserializeAttachment() as { playerId?: string }).playerId ? "seated" : "nothing";
      };
    };
    const fillAt = Date.now() + 60_000;
    const pool = await room("POOLS", { fillAt, engine: true });
    expect(await pool(cheat)).toBe("seated");
    expect(await pool(honest)).toBe(MATCH_STARTED);
    const clean = await room("CLEAN", { fillAt });
    expect(await clean(cheat)).toBe(MATCH_STARTED);
    expect(await clean(honest)).toBe("seated");
    const own = await room("PRIVT");
    expect(await own(cheat)).toBe("seated");
    expect(await own(honest)).toBe("seated");
  });
});
