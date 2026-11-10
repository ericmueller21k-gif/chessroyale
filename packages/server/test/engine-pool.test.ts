import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FAIRPLAY, atBanBar, matchSignals, newAccountPool, type FairMove } from "@chessroyale/core";
import { SQUADS_PROTOCOL } from "@chessroyale/chess/squads";
import { createGuest, createSession, ensureSchema, publicProfile, recordResult, signInWithIdentity, type Sql, type User } from "../src/accounts.ts";
import { caseOf, decide, eligibleForRanked, purgeEvidence, recordFairPlay, reportPlayer, setCase, type CaseMailer } from "../src/fairplay.ts";
import { handleAdmin, poolExport, poolPlayers } from "../src/admin.ts";
import { purgeDuelGames } from "../src/ranked.ts";
import { deleteAccount } from "../src/account-data.ts";
import { memoryDb } from "./memory-db.ts";

// (The engine server's container needs the Workers runtime; nothing here reaches it.)
vi.mock("@cloudflare/containers", () => ({ Container: class {}, getContainer: () => ({ fetch: async () => new Response("{}") }) }));
vi.mock("../src/engine.ts", async (real) => ({ ...(await real<object>()), serverScoreAt: async () => null }));
const { default: worker } = await import("../src/index.ts");
const { SquadsParty } = await import("../src/squads-do.ts");

/**
 * The engine pool (Eric, Nov 10; docs/decisions/2026-11-10-engine-pool.md): detection's ban level, or a new account with 2 of its first
 * 10 matches at the one-match ban bar, puts an account in the pool; every queue then seats it only with other pooled accounts or bots,
 * from the account (never the browser); a person's Release takes it out; it's left out of public rankings; its evidence is kept.
 */

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 1, 12);

async function player(sql: Sql, name: string): Promise<User> {
  const g = await createGuest(sql, 1000, name);
  return signInWithIdentity(sql, g.user, "email", `${name.toLowerCase()}@example.com`, {}, 1000);
}

/** A match's judged picks: near-perfect engine play, the deep re-check agreeing on every one (at the one-match ban bar) or not run. */
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
/** An honest match: the best move half the time, a few points lost otherwise. */
function honestMatch(): FairMove[] {
  return engineMatch(false).map((m, i) => (i % 2 ? { ...m, move: "a1b1", loss: 6 } : m));
}
const bar = engineMatch(true);
const plain = honestMatch();

/** The level path out of the way (no matches in its window), so the new-account rule shows on its own. */
async function withoutLevels<T>(run: () => Promise<T>): Promise<T> {
  const lv = FAIRPLAY.levels as { windowMatches: number };
  const saved = lv.windowMatches;
  lv.windowMatches = 0;
  try {
    return await run();
  } finally {
    lv.windowMatches = saved;
  }
}

describe("into the pool", () => {
  it("the fixtures: an engine match the deep re-check confirmed is at the one-match ban bar; an honest one isn't", () => {
    expect(atBanBar(matchSignals(bar, 1500))).toBe(true);
    expect(atBanBar(matchSignals(engineMatch(false), 1500))).toBe(false);
    expect(atBanBar(matchSignals(plain, 1500))).toBe(false);
    expect(FAIRPLAY.enforcement).toBe("pool");
    expect(FAIRPLAY.pool).toEqual({ newGames: 10, newHits: 2 });
  });

  it("the new-account rule (core): 2 of the first 10 at the bar pools; 1 doesn't; nor hits after the 10th, nor ones a decision weighed", () => {
    const at = { ...matchSignals(bar, 1500), counts: true };
    const not = { ...matchSignals(plain, 1500), counts: true };
    expect(newAccountPool([at, not, at])).toBe("new account: 2 of its first 3 matches at the one-match ban bar");
    expect(newAccountPool([at, not, not])).toBeNull();
    expect(newAccountPool([...Array(10).fill(not), at, at])).toBeNull();
    expect(newAccountPool([...Array(9).fill(not), at, at])).toBeNull();
    expect(newAccountPool([...Array(8).fill(not), at, at])).toMatch(/^new account: 2 of its first 10/);
    expect(newAccountPool([{ ...at, counts: false }, at, not])).toBeNull();
  });

  it("the new-account rule (server): a new account's second match at the bar puts it in the pool straight away, no review, no email", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const sent: string[] = [];
    const mail: CaseMailer = async (_u, kind) => void sent.push(kind);
    await withoutLevels(async () => {
      const one = await player(sql, "One");
      await recordFairPlay(sql, one.id, { lobby: "AAAAA", mode: "crowd", moves: bar }, T0, mail);
      for (let i = 0; i < 3; i++) await recordFairPlay(sql, one.id, { lobby: `B${i}BBB`, mode: "crowd", moves: plain }, T0 + (i + 1) * 1000, mail);
      expect((await caseOf(sql, one.id))?.status).not.toBe("pool");
      const two = await player(sql, "Two");
      expect((await recordFairPlay(sql, two.id, { lobby: "AAAAA", mode: "crowd", moves: bar }, T0, mail)).acted).not.toBe("pool");
      await recordFairPlay(sql, two.id, { lobby: "BBBBB", mode: "crowd", moves: plain }, T0 + 1000, mail);
      expect((await recordFairPlay(sql, two.id, { lobby: "CCCCC", mode: "crowd", moves: bar }, T0 + 2000, mail)).acted).toBe("pool");
      expect(await caseOf(sql, two.id)).toMatchObject({ status: "pool", reason: "new account: 2 of its first 3 matches at the one-match ban bar", decided_by: null });
      // Past its first 10: not a new account any more.
      const old = await player(sql, "Old");
      for (let i = 0; i < 10; i++) await recordFairPlay(sql, old.id, { lobby: `O${i}OOO`, mode: "crowd", moves: plain }, T0 + i * 1000, mail);
      for (let i = 0; i < 2; i++) await recordFairPlay(sql, old.id, { lobby: `X${i}XXX`, mode: "crowd", moves: bar }, T0 + (20 + i) * 1000, mail);
      expect((await caseOf(sql, old.id))?.status).not.toBe("pool");
    });
    expect(sent).toEqual([]);
  });

  it("the level path: what used to ban (here one match at the bar) pools any account; results not held, the profile as ever", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const sent: string[] = [];
    const mail: CaseMailer = async (_u, kind) => void sent.push(kind);
    const p = await player(sql, "Pat");
    await recordResult(sql, p.id, { mode: "crowd", online: true, placement: 1, players: 100, rating: 2500, ranked: true }, T0 - 1000);
    const before = (await publicProfile(sql, p.id, T0))!;
    const r = await recordFairPlay(sql, p.id, { lobby: "AAAAA", mode: "crowd", moves: bar }, T0, mail);
    expect(r).toMatchObject({ verdict: { level: "ban" }, acted: "pool" });
    expect(await caseOf(sql, p.id)).toMatchObject({ status: "pool", reason: expect.stringMatching(/^level ban: one match/) });
    expect(sent).toEqual([]);
    expect(await eligibleForRanked(sql, p.id)).toBe(true);
    expect((await sql.first<{ held: number }>("SELECT held FROM results WHERE user_id = ?", p.id))?.held).toBe(0);
    const after = (await publicProfile(sql, p.id, T0))!;
    expect(after).toMatchObject({ banned: false, rating: before.rating, topPercent: before.topPercent });
    // More evidence, reports, a review's bar: they stay in the pool (only a person's Release takes them out), the log notes it.
    await recordFairPlay(sql, p.id, { lobby: "BBBBB", mode: "crowd", moves: bar }, T0 + 1000, mail);
    const reporter = await player(sql, "Rae");
    await reportPlayer(sql, reporter, p.id, "Cheating", "BBBBB", T0 + 2000);
    expect((await caseOf(sql, p.id))?.status).toBe("pool");
    expect((await sql.all<{ action: string }>("SELECT action FROM fairplay_log WHERE user_id = ? ORDER BY id", p.id)).map((l) => l.action)).toEqual(["pool", "note", "note"]);
  });

  it("public rankings leave the pool out: others' Top N% don't count a pooled player; theirs looks as ever", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      const u = await player(sql, `P${i}`);
      ids.push(u.id);
      await recordResult(sql, u.id, { mode: "crowd", online: true, placement: 2, players: 100, rating: 1000 + 100 * i, ranked: true }, T0);
    }
    const top = await player(sql, "Top");
    await recordResult(sql, top.id, { mode: "crowd", online: true, placement: 1, players: 100, rating: 3000, ranked: true }, T0);
    // The 1900 player is 2nd of 11; with the 3000 player pooled, 1st of 10.
    const before = (await publicProfile(sql, ids[9]!, T0))!.topPercent;
    const topBefore = (await publicProfile(sql, top.id, T0))!.topPercent;
    await setCase(sql, top.id, "pool", "detection", "level ban: test", T0);
    expect((await publicProfile(sql, ids[9]!, T0))!.topPercent).toBeLessThan(before!);
    expect((await publicProfile(sql, top.id, T0))!.topPercent).toBe(topBefore);
  });
});

describe("every queue sends a pooled account to the pool's own (from the account, never the browser)", () => {
  const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
  let ip = 0;
  async function world() {
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql, d1);
    const names: string[] = [];
    const parties: { queue: string; pool?: string }[] = [];
    const MATCHMAKER = {
      idFromName: (n: string) => n,
      get: (n: string) => ({
        next: async () => (names.push(n), { code: "ABCDE" }),
        duelNext: async () => (names.push(n), { searching: true, ticket: "ticket-0001", waitedMs: 0 }),
        cancel: async () => (names.push(n), {}),
      }),
    };
    const PARTIES = { idFromName: (c: string) => c, get: () => ({ create: async (_c: string, queue: string, _f: number, _k: unknown, pool?: string) => (parties.push({ queue, pool }), true) }) };
    const env = { DB: d1, MATCHMAKER, PARTIES, TEST_SWITCHES: "1" };
    const cheat = await player(sql, "Cheat");
    const honest = await player(sql, "Honest");
    await setCase(sql, cheat.id, "pool", "detection", "level ban: test", Date.now());
    const cookie = async (u: User) => `hc_session=${await createSession(sql, u.id, Date.now())}`;
    const post = async (u: User, path: string) => {
      names.length = 0;
      const res = await worker.fetch(new Request(`https://hunchess.test${path}`, { method: "POST", headers: { cookie: await cookie(u), "cf-connecting-ip": `10.2.0.${++ip}` } }), env as never, ctx);
      return { status: res.status, body: (await res.json()) as Record<string, unknown>, names: [...names] };
    };
    return { sql, cheat, honest, post, parties };
  }

  it("50 v 50 and Boss Battle online (Default and Bots off), Squads alone, 1 v 1 and its Cancel; the answers look the same", async () => {
    const w = await world();
    const routes: [string, string][] = [
      ["/api/play", "crowd-default"],
      ["/api/play?type=botsoff", "crowd-botsoff"],
      ["/api/play?mode=raid", "raid-default"],
      ["/api/play?mode=raid&type=botsoff", "raid-botsoff"],
      ["/api/squads/play", "squads-default"],
      ["/api/1v1/play", "ranked1v1-default"],
      ["/api/1v1/cancel?ticket=ticket-0001", "ranked1v1-default"],
    ];
    for (const [path, queue] of routes) {
      const cheat = await w.post(w.cheat, path);
      const honest = await w.post(w.honest, path);
      expect(cheat.names, path).toEqual([`${queue}.engine`]);
      expect(honest.names, path).toEqual([queue]);
      expect(Object.keys(cheat.body).sort(), path).toEqual(Object.keys(honest.body).sort());
      expect(cheat.status, path).toBe(honest.status);
    }
    // A test's own pool keeps the engine pool apart too; the browser can't ask for the pool's queue (?pool=engine is a test's own).
    expect((await w.post(w.cheat, "/api/play?pool=t1")).names).toEqual(["crowd-default-t1.engine"]);
    expect((await w.post(w.honest, "/api/play?pool=engine")).names).toEqual(["crowd-default-engine"]);
    // Released: back in the usual queues.
    await decide(w.sql, w.cheat.id, "release", "admin:eric@example.com", "", Date.now());
    expect((await w.post(w.cheat, "/api/play")).names).toEqual(["crowd-default"]);
  });

  it("a Squads party is made with both queues; it queues in the pool's when any member is pooled", async () => {
    const w = await world();
    expect((await w.post(w.honest, "/api/squads/party")).status).toBe(200);
    expect(w.parties).toEqual([{ queue: "squads-default", pool: "squads-default.engine" }]);
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql, d1);
    const a = await player(sql, "Ann");
    const b = await player(sql, "Bea");
    const asked = async (pooled: boolean) => {
      await setCase(sql, b.id, pooled ? "pool" : "cleared", "admin:eric@example.com", "test", Date.now());
      const names: string[] = [];
      const env = { DB: d1, MATCHMAKER: { idFromName: (n: string) => n, get: (n: string) => ({ next: async () => (names.push(n), { code: "LOBBY" }) }) } };
      const party = await partyRuntime(env);
      await party.it.create("PARTY", "squads-default", 1000, undefined, "squads-default.engine");
      const ann = party.socket({ userId: a.id, name: "Ann" });
      const bea = party.socket({ userId: b.id, name: "Bea" });
      await party.send(ann, { t: "hello", v: SQUADS_PROTOCOL });
      await party.send(bea, { t: "hello", v: SQUADS_PROTOCOL });
      await party.send(ann, { t: "queue" });
      await vi.waitFor(() => expect(names).toHaveLength(1));
      return names[0];
    };
    expect(await asked(false)).toBe("squads-default");
    expect(await asked(true)).toBe("squads-default.engine");
  });
});

describe("Release, the reviewer, the kept evidence and the admin list", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["Date"] }));
  afterEach(() => vi.useRealTimers());

  it("Release is a person's: back to the usual queues, logged, no email; old evidence doesn't put them back", async () => {
    vi.setSystemTime(T0);
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const sent: string[] = [];
    const mail: CaseMailer = async (_u, kind) => void sent.push(kind);
    const p = await player(sql, "Pat");
    await recordFairPlay(sql, p.id, { lobby: "AAAAA", mode: "crowd", moves: bar }, T0, mail);
    await recordFairPlay(sql, p.id, { lobby: "BBBBB", mode: "crowd", moves: bar }, T0 + 1000, mail);
    expect((await caseOf(sql, p.id))?.status).toBe("pool");
    // The reviewer's token can't release, clear or move a pooled case; nor ban.
    for (const d of ["release", "clear", "watch", "review", "ban"]) expect(await decide(sql, p.id, d, "reviewer", "looks like a false positive", T0 + 2000)).toMatchObject({ ok: false, status: 409 });
    const q = await player(sql, "Quinn");
    expect(await decide(sql, q.id, "release", "admin:eric@example.com", "", T0 + 2000)).toEqual({ ok: false, status: 409, message: "this player isn't in the engine pool" });
    expect(await decide(sql, p.id, "release", "admin:eric@example.com", "", T0 + 3000, { mail })).toEqual({ ok: true, status: "cleared" });
    expect(await caseOf(sql, p.id)).toMatchObject({ status: "cleared", reason: "released from the engine pool", decided_by: "admin:eric@example.com" });
    expect(sent).toEqual([]);
    // Their next match, an honest one: the matches before the Release were weighed by it.
    await recordFairPlay(sql, p.id, { lobby: "CCCCC", mode: "crowd", moves: plain }, T0 + 4000, mail);
    expect((await caseOf(sql, p.id))?.status).not.toBe("pool");
    // A new one at the bar (detection's level again, from the matches since): back in.
    await recordFairPlay(sql, p.id, { lobby: "DDDDD", mode: "crowd", moves: bar }, T0 + 5000, mail);
    expect((await caseOf(sql, p.id))?.status).toBe("pool");
  });

  it("a pooled player's evidence and 1 v 1 games are kept past their dates; deleting the account keeps the case, and a new one goes back in", async () => {
    vi.setSystemTime(T0);
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const p = await player(sql, "Pat");
    await recordFairPlay(sql, p.id, { lobby: "AAAAA", mode: "crowd", moves: bar }, T0);
    expect((await caseOf(sql, p.id))?.status).toBe("pool");
    await sql.run(
      "INSERT INTO ranked_1v1_games (id, white_id, black_id, control, result, reason, moves, times, started_at, ended_at, nonce) VALUES ('G1', ?, 'x', '5+0', '1-0', 'mate', '[]', '[]', ?, ?, 'n')",
      p.id,
      T0,
      T0,
    );
    const later = T0 + 400 * DAY;
    await purgeEvidence(sql, later, true);
    await purgeDuelGames(sql, later);
    expect((await sql.first<{ moves: string | null }>("SELECT moves FROM fairplay_matches WHERE user_id = ?", p.id))?.moves).not.toBeNull();
    expect(await sql.first("SELECT id FROM ranked_1v1_games WHERE id = 'G1'")).not.toBeNull();
    await deleteAccount(sql, p, later);
    expect((await caseOf(sql, p.id))?.status).toBe("pool");
    const again = await player(sql, "Pat");
    const { banCheck } = await import("../src/fairplay.ts");
    expect(await banCheck(sql, again, null, later + 1000)).toEqual({ banned: false, pooled: true });
    expect(await caseOf(sql, again.id)).toMatchObject({ status: "pool", reason: expect.stringMatching(/deleted while in the engine pool$/) });
  });

  it("the Engine pool list: when and why, the numbers, the evidence and how they do in the pool; Release; the JSON download", async () => {
    vi.setSystemTime(T0 + 10 * DAY);
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql, d1);
    const eric = await player(sql, "Eric");
    const p = await player(sql, "Pat");
    const q = await player(sql, "Quinn");
    await recordResult(sql, p.id, { mode: "crowd", online: true, placement: 1, players: 100, rating: 2400, ranked: true }, T0 - DAY);
    await recordFairPlay(sql, p.id, { lobby: "AAAAA", mode: "crowd", moves: bar }, T0);
    await recordFairPlay(sql, q.id, { lobby: "BBBBB", mode: "crowd", moves: bar }, T0);
    // In the pool: Pat loses both 1 v 1 games to Quinn (pooled) and one crowd match.
    for (const [id, at] of [["G1", T0 + DAY], ["G2", T0 + 2 * DAY]] as const)
      await sql.run(
        "INSERT INTO ranked_1v1_games (id, white_id, black_id, control, result, reason, moves, times, started_at, ended_at, nonce) VALUES (?, ?, ?, '5+0', '1-0', 'mate', '[]', '[]', ?, ?, 'n')",
        id,
        q.id,
        p.id,
        at,
        at,
      );
    await recordResult(sql, p.id, { mode: "crowd", online: true, placement: 60, players: 100, team: "w", teamWon: false, rating: 2300, ranked: true }, T0 + 3 * DAY);
    const rows = await poolPlayers(sql);
    const pat = rows.find((r) => r.userId === p.id)!;
    expect(pat).toMatchObject({
      name: "Pat",
      since: T0,
      by: "detection",
      why: expect.stringMatching(/^level ban/),
      games: 2,
      evidence: { matches: 1, atBar: 1, deepMatch: 20, deepChecked: 20, bestPerf: 3400 },
      inPool: { games: 1, wins: 0, duelWins: 0, duelLosses: 2, duelDraws: 0, vsPool: 2, matches: 0 },
    });
    const env = { DB: d1, ADMIN_EMAILS: "pat-admin@example.com,eric@example.com" };
    const cookie = `hc_session=${await createSession(sql, eric.id, Date.now())}`;
    const call = (path: string, init: RequestInit = {}) => handleAdmin(new Request(`https://hunchess.test${path}`, { ...init, headers: { cookie, ...(init.headers ?? {}) } }), env);
    const page = await (await call("/admin/fairplay"))!.text();
    expect(page).toContain("Engine pool (2)");
    expect(page).toContain(`action="/admin/fairplay/case/${p.id}"`);
    expect(page).toContain('value="release">Release</button>');
    // The download: every pooled player's file, moves and all, no emails.
    const dl = (await call("/admin/fairplay/pool.json"))!;
    expect(dl.headers.get("content-disposition")).toMatch(/^attachment; filename="engine-pool-/);
    const text = await dl.text();
    expect(text).not.toMatch(/@/);
    const json = JSON.parse(text) as Awaited<ReturnType<typeof poolExport>>;
    expect(json.players.map((x) => x.userId).sort()).toEqual([p.id, q.id].sort());
    expect(json.players.find((x) => x.userId === p.id)!.file!.matches[0]!.moves).toHaveLength(20);
    // Release from the list (no reason needed).
    const origin = "https://hunchess.test";
    const res = (await call(`/admin/fairplay/case/${p.id}`, { method: "POST", body: new URLSearchParams({ action: "release" }), headers: { origin, "content-type": "application/x-www-form-urlencoded" } }))!;
    expect(res.status).toBe(303);
    expect((await caseOf(sql, p.id))?.status).toBe("cleared");
    expect((await poolPlayers(sql)).map((r) => r.userId)).toEqual([q.id]);
  });
});

/** A Squads party's Durable Object on a fake runtime (as boss-party-do.test.ts's). */
async function partyRuntime(env: object) {
  type Sock = { sent: unknown[]; closed: number | null; att: unknown; serializeAttachment(a: unknown): void; deserializeAttachment(): unknown; send(t: string): void; close(c: number): void };
  const store = new Map<string, unknown>();
  const sockets: Sock[] = [];
  const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
  let loading: Promise<unknown> = Promise.resolve();
  const ctx = {
    storage: {
      get: async (k: string) => clone(store.get(k)),
      put: async (k: string, v: unknown) => void store.set(k, clone(v)),
      setAlarm: async () => {},
      deleteAlarm: async () => {},
      deleteAll: async () => store.clear(),
    },
    getWebSockets: () => sockets.filter((s) => s.closed === null),
    acceptWebSocket: (ws: Sock) => void sockets.push(ws),
    waitUntil: (p: Promise<unknown>) => void p.catch(() => undefined),
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => (loading = fn()),
  };
  const it = new SquadsParty(ctx as unknown as DurableObjectState, env as never);
  await loading;
  const socket = (attached: Record<string, unknown>): Sock => {
    const ws: Sock = {
      sent: [],
      closed: null,
      att: clone(attached),
      serializeAttachment(a) {
        this.att = clone(a);
      },
      deserializeAttachment() {
        return this.att;
      },
      send(t) {
        this.sent.push(JSON.parse(t));
      },
      close(c) {
        this.closed = c;
      },
    };
    sockets.push(ws);
    return ws;
  };
  const send = (ws: Sock, msg: object) => it.webSocketMessage(ws as unknown as WebSocket, JSON.stringify(msg));
  return { it, socket, send };
}
