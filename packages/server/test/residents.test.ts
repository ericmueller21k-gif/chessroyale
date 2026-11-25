import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ITEM_DEFS, mulberry32, modeSettings, type FairMove } from "@chessroyale/core";
import { DUEL_PROTOCOL } from "@chessroyale/chess/duel";
import { SQUADS_PROTOCOL } from "@chessroyale/chess/squads";
import { forgetAccessKeys } from "../src/access.ts";
import { createGuest, createSession, ensureSchema, getUser, publicProfile, recordResult, signInWithIdentity, userFromToken, type Sql, type User } from "../src/accounts.ts";
import { banCheck, caseOf, decide, raiseCase, recordFairPlay, relevel, reportPlayer, setCase } from "../src/fairplay.ts";
import { deepCheckRun } from "../src/fairplay-deep.ts";
import { searchPlayers } from "../src/friends.ts";
import { RESIDENTS_PAUSED, residentsPaused } from "../src/kill-switches.ts";
import { ledgerMismatches } from "../src/ledger.ts";
import type { LobbyRecord } from "../src/lobby.ts";
import { forgetTopPlaces, topPlace } from "../src/ranked-schema.ts";
import { BEAT_MAX_BYTES, SEED_MAX, handleResidents, residentEmail, type ResidentAnswer, type ResidentsReport } from "../src/residents.ts";
import { memoryDb } from "./memory-db.ts";

// (The engine server is a Container, which needs the Workers runtime: not here.)
vi.mock("@cloudflare/containers", () => ({ Container: class {}, getContainer: () => ({ fetch: async () => new Response("{}") }) }));
vi.mock("../src/engine.ts", async (real) => ({ ...(await real<object>()), serverRecheck: async () => null, serverScoreAt: async () => null, warmEngine: async () => false }));
const { Lobby } = await import("../src/lobby-do.ts");
const { DuelGame } = await import("../src/duel-do.ts");
const { SquadsLobby, SquadsParty } = await import("../src/squads-do.ts");
const { default: worker } = await import("../src/index.ts");

/**
 * Residents (residents.ts; docs/decisions/2026-11-25-residents-server.md): accounts a program plays as people do. The route makes
 * and signs them in (an admin, the e2e's key, or Access with the residents' or the test accounts' token), seeds their lockers through
 * the ledger, reports on them and keeps the program's heartbeat; they count on rankings; the kill switch PAUSE_RESIDENTS refuses them
 * everywhere (every /api/* route, every room); fair play records them and never acts on them.
 */

const T0 = Date.UTC(2026, 10, 25, 12);
const ADMIN = "boss@example.com";
const E2E_KEY = "k".repeat(40);
const URL_ = "https://hunchess.test/api/admin/residents";
const RESIDENTS_CLIENT = "residents-client.access";
const TEST_CLIENT = "demo-client.access";

afterEach(() => forgetAccessKeys());

/** A database and the route, as `as` (headers): `access` names the service token's client ID the request came through Access with. */
async function world(envExtra: Record<string, string> = {}) {
  const { sql, d1 } = memoryDb();
  await ensureSchema(sql);
  const env: Record<string, unknown> = { DB: d1, ADMIN_EMAILS: ADMIN, RESIDENTS_CLIENT_ID: RESIDENTS_CLIENT, TEST_ACCOUNTS_CLIENT_ID: TEST_CLIENT, ...envExtra };
  const call = (method: string, headers: Record<string, string> = {}, body?: unknown, opts: { access?: string; e2e?: string; path?: string; raw?: string; seed?: number } = {}) =>
    handleResidents(
      new Request(`${URL_}${opts.path ?? ""}`, {
        method,
        headers: { ...(body !== undefined || opts.raw ? { "content-type": "application/json" } : {}), ...headers },
        ...(opts.raw !== undefined ? { body: opts.raw } : body !== undefined ? { body: JSON.stringify(body) } : {}),
      }),
      { ...env, ...(opts.e2e ? { E2E_SQL: opts.e2e } : {}) } as never,
      { now: T0, access: async (_r, e) => !!opts.access && e.OPS_ACCESS_CLIENT_ID === opts.access, rng: mulberry32(opts.seed ?? 1) },
    );
  /** The program makes (or finds) a resident through its token. */
  const make = async (name: string, look?: unknown, seed?: number, cookie?: string) => {
    const res = (await call("POST", cookie ? { cookie } : {}, { name, ...(look ? { look } : {}) }, { access: RESIDENTS_CLIENT, seed }))!;
    return { res, body: (await res.clone().json()) as ResidentAnswer & { message?: string } };
  };
  return { sql, d1, env, call, make };
}

async function signedIn(sql: Sql, email: string, now = T0 - 1000) {
  const g = await createGuest(sql, now, email.split("@")[0]!);
  const u = await signInWithIdentity(sql, g.user, "email", email, {}, now);
  return { user: u, cookie: `hc_session=${await createSession(sql, u.id, now)}` };
}

const tokenOf = (res: Response) => decodeURIComponent(res.headers.get("set-cookie")?.match(/hc_session=([^;]+)/)?.[1] ?? "");

describe("residents: who may use the route", () => {
  it("is Not found to anyone but an admin, the e2e's key, or Access with the residents' or the test accounts' token", async () => {
    const { sql, call } = await world();
    const player = await signedIn(sql, "player@example.com");
    for (const headers of [{}, { cookie: player.cookie }, { authorization: "Bearer anything" }] as Record<string, string>[]) {
      for (const [method, path] of [["GET", ""], ["POST", ""], ["POST", "/beat"]] as const) expect((await call(method, headers, method === "POST" ? { name: "Mossy" } : undefined, { path }))!.status).toBe(404);
    }
    // Another token Access issued (the health view's, say): not this route's.
    expect((await call("GET", {}, undefined, { access: "ops-client.access" }))!.status).toBe(404);
    expect((await call("GET", { "x-e2e-sql": "wrong".repeat(10) }, undefined, { e2e: E2E_KEY }))!.status).toBe(404);
    // An admin's change only from the site itself.
    const admin = await signedIn(sql, ADMIN);
    expect((await call("POST", { cookie: admin.cookie }, { name: "Mossy" }))!.status).toBe(404);
    expect(await sql.first("SELECT id FROM users WHERE resident = 1")).toBeNull();
    // Each that may: the residents' token, the test accounts' (the first runs), the e2e's key, an admin.
    expect((await call("GET", {}, undefined, { access: RESIDENTS_CLIENT }))!.status).toBe(200);
    expect((await call("GET", {}, undefined, { access: TEST_CLIENT }))!.status).toBe(200);
    expect((await call("GET", { "x-e2e-sql": E2E_KEY }, undefined, { e2e: E2E_KEY }))!.status).toBe(200);
    expect((await call("GET", { cookie: admin.cookie }))!.status).toBe(200);
    // (Other paths aren't this route's.)
    expect(await handleResidents(new Request("https://hunchess.test/api/admin/test-accounts"), { DB: memoryDb().d1 })).toBeNull();
  });

  it("an empty RESIDENTS_CLIENT_ID lets no token in through it", async () => {
    const { call } = await world({ RESIDENTS_CLIENT_ID: " ", TEST_ACCOUNTS_CLIENT_ID: "" });
    expect((await call("GET", {}, undefined, { access: " " }))!.status).toBe(404);
    expect((await call("GET", {}, undefined, { access: "" }))!.status).toBe(404);
  });
});

describe("residents: making one and signing in", () => {
  it("makes <slug>@resident.hunchess with the resident flag (not a test account), its look, and signs the program in", async () => {
    const { sql, make } = await world();
    const { res, body } = await make("Mossy Bishop", { pawn: "black", icon: "🦊" });
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ name: "Mossy Bishop", email: "mossy-bishop@resident.hunchess", created: true, reused: false });
    const row = await sql.first<{ resident: number; test: number | null; pawn_color: string; icon: string }>("SELECT resident, test, pawn_color, icon FROM users WHERE id = ?", body.id);
    expect(row).toEqual({ resident: 1, test: null, pawn_color: "black", icon: "🦊" });
    // The session cookie is the resident's.
    const me = await userFromToken(sql, tokenOf(res), T0);
    expect(me).toMatchObject({ id: body.id, resident: 1 });
    // Again: found, not made again, its look kept.
    const again = await make("Mossy Bishop", { pawn: "white" });
    expect(again.body).toMatchObject({ id: body.id, created: false, seeded: [] });
    expect((await getUser(sql, body.id))!.pawn_color).toBe("black");
    expect(residentEmail("  PawnStorm77 ")).toBe("pawnstorm77@resident.hunchess");
  });

  it("refuses a name the filter refuses, an empty one, and an address a real account has", async () => {
    const { sql, make } = await world();
    expect((await make("")).res.status).toBe(400);
    expect((await make("!!!")).res.status).toBe(400);
    // (A hate code: the name filter's, text-filter.ts.)
    expect((await make("Bob1488")).res.status).toBe(400);
    await signedIn(sql, "quiet-rook@resident.hunchess");
    expect((await make("Quiet Rook")).res.status).toBe(409);
  });

  it("seeds 0 to 3 common locker items through one ledger op, once: the ledger stays balanced", async () => {
    const { sql, make } = await world();
    const counts = new Set<number>();
    for (let seed = 1; seed <= 12; seed++) {
      const { body } = await make(`Res ${seed}`, undefined, seed);
      expect(body.seeded.length).toBeLessThanOrEqual(SEED_MAX);
      counts.add(body.seeded.length);
      for (const def of body.seeded) expect(ITEM_DEFS.find((d) => d.id === def)!.tier).toBe("common");
      const items = await sql.all<{ def: string }>("SELECT def FROM items WHERE user_id = ? ORDER BY def", body.id);
      expect(items.map((i) => i.def)).toEqual([...body.seeded].sort());
      const ops = await sql.all<{ op_id: string }>("SELECT DISTINCT l.op_id FROM ledger l JOIN ledger_accounts a ON a.account = l.account WHERE a.user_id = ?", body.id);
      expect(ops.map((o) => o.op_id)).toEqual(body.seeded.length ? [expect.stringMatching(/^resident-seed:/)] : []);
      expect(await ledgerMismatches(sql, body.id)).toEqual([]);
      // (Found again: nothing more.)
      expect((await make(`Res ${seed}`, undefined, seed)).body.seeded).toEqual([]);
      expect(await sql.all("SELECT id FROM items WHERE user_id = ?", body.id)).toHaveLength(body.seeded.length);
    }
    expect(counts.size).toBeGreaterThan(1);
  });

  it("reuses the program's live session; a new one ends the resident's others, so restarts never pile up sessions", async () => {
    const { sql, make } = await world();
    const first = await make("Pawn Storm");
    const cookie = `hc_session=${tokenOf(first.res)}`;
    // With its cookie: the same session, no new cookie.
    const kept = await make("Pawn Storm", undefined, 1, cookie);
    expect(kept.body.reused).toBe(true);
    expect(kept.res.headers.get("set-cookie")).toBeNull();
    // A restart that lost its cookies: one new session, the old one ended.
    const fresh = await make("Pawn Storm");
    expect(fresh.body.reused).toBe(false);
    expect(await sql.all("SELECT token_hash FROM sessions WHERE user_id = ?", first.body.id)).toHaveLength(1);
    expect(await userFromToken(sql, tokenOf(first.res), T0)).toBeNull();
    expect((await userFromToken(sql, tokenOf(fresh.res), T0))!.id).toBe(first.body.id);
    // Another resident's cookie isn't this one's session: a new one.
    expect((await make("Quiet Rook", undefined, 1, `hc_session=${tokenOf(fresh.res)}`)).body.reused).toBe(false);
  });

  it("an admin on the site isn't signed in as it; a banned resident gets the ban answer, no session", async () => {
    const { sql, call, make } = await world();
    const admin = await signedIn(sql, ADMIN);
    const made = (await call("POST", { cookie: admin.cookie, origin: "https://hunchess.test" }, { name: "Admin Made" }))!;
    expect(made.status).toBe(200);
    expect(made.headers.get("set-cookie")).toBeNull();
    const { body } = await make("Banned Bo");
    await setCase(sql, body.id, "banned", `admin:${ADMIN}`, "by hand, a test", T0);
    const sessions = await sql.all("SELECT token_hash FROM sessions WHERE user_id = ?", body.id);
    const res = (await make("Banned Bo")).res;
    expect(res.status).toBe(403);
    expect(res.headers.getSetCookie().some((c) => /^hc_session=[^;]+/.test(c))).toBe(false);
    expect(await sql.all("SELECT token_hash FROM sessions WHERE user_id = ?", body.id)).toEqual(sessions);
  });
});

describe("residents: the report and the heartbeat", () => {
  it("GET: every resident, today's numbers by mode and 1 v 1, fair play's would-have counts, the last heartbeat", async () => {
    const { sql, call, make } = await world();
    const a = (await make("Mossy Bishop")).body;
    const b = (await make("Pawn Storm")).body;
    const real = await signedIn(sql, "eric@example.com");
    await recordResult(sql, a.id, { mode: "crowd", online: true, placement: 3, players: 100, rating: 1200, ranked: true }, T0 - 1000);
    await recordResult(sql, a.id, { mode: "crowd", online: true, placement: 3, players: 100, rating: 1210, ranked: true }, T0 - 2 * 86_400_000);
    await recordResult(sql, real.user.id, { mode: "crowd", online: true, placement: 1, players: 100, rating: 1500, ranked: true }, T0 - 1000);
    const duel = (id: string, w: string, bl: string, at: number) =>
      sql.run("INSERT INTO ranked_1v1_games (id, white_id, black_id, control, result, reason, moves, times, started_at, ended_at, nonce) VALUES (?, ?, ?, 'blitz', '1-0', 'resign', '', '', ?, ?, 'n')", id, w, bl, at - 60_000, at);
    await duel("G1", a.id, b.id, T0 - 1000);
    await duel("G2", a.id, real.user.id, T0 - 500);
    await duel("G3", real.user.id, real.user.id, T0 - 500);
    await sql.run(
      "INSERT INTO fairplay_matches (user_id, lobby, mode, played_at, counted, perf, score, level, summary, moves, keep_until, would) VALUES (?, 'ABCDE', 'crowd', ?, 10, 2500, 90, 'ban', '{}', NULL, NULL, 'pool'), (?, 'ABCDE', 'crowd', ?, 10, 1200, 1, 'none', '{}', NULL, NULL, NULL)",
      a.id,
      T0,
      b.id,
      T0,
    );
    expect((await call("POST", {}, { pool: 3, errors: { judgeLate: 2 } }, { access: RESIDENTS_CLIENT, path: "/beat" }))!.status).toBe(200);
    const report = (await (await call("GET", {}, undefined, { access: RESIDENTS_CLIENT }))!.json()) as ResidentsReport;
    expect(report.paused).toBe(false);
    expect(report.beat).toEqual({ at: T0, by: "access", beat: { pool: 3, errors: { judgeLate: 2 } } });
    expect(report.today).toEqual({ since: Date.UTC(2026, 10, 25), results: { crowd: 1 }, players: 1, duels: 2, duelsWithPeople: 1 });
    expect(report.fairPlay).toEqual({ matches: 2, would: { watch: 0, review: 0, pool: 1, ban: 0 } });
    expect(report.residents.map((r) => [r.name, r.gamesToday])).toEqual([
      ["Mossy Bishop", 1],
      ["Pawn Storm", 0],
    ]);
  });

  it("the heartbeat keeps the latest only; refuses a body that isn't a JSON object, or is too big", async () => {
    const { sql, call } = await world();
    const beat = (raw: string) => call("POST", {}, undefined, { access: RESIDENTS_CLIENT, path: "/beat", raw });
    expect((await beat(JSON.stringify({ n: 1 })))!.status).toBe(200);
    expect((await beat(JSON.stringify({ n: 2 })))!.status).toBe(200);
    expect(await sql.all("SELECT value FROM meta WHERE key = 'residents:beat'")).toEqual([{ value: JSON.stringify({ at: T0, by: "access", beat: { n: 2 } }) }]);
    for (const bad of ["[1,2]", "7", "not json", "null"]) expect((await beat(bad))!.status).toBe(400);
    expect((await beat(JSON.stringify({ pad: "x".repeat(BEAT_MAX_BYTES) })))!.status).toBe(413);
    expect((await call("GET", {}, undefined, { access: RESIDENTS_CLIENT, path: "/beat" }))!.status).toBe(405);
  });
});

describe("residents: on rankings, as anyone", () => {
  it("count in others' Top N%, 1 v 1's top places and name search (unlike test accounts)", async () => {
    const { sql, make } = await world();
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      const u = await signedIn(sql, `p${i}@example.com`);
      ids.push(u.user.id);
      await recordResult(sql, u.user.id, { mode: "crowd", online: true, placement: 2, players: 100, rating: 1000 + 100 * i, ranked: true }, T0);
    }
    const before = (await publicProfile(sql, ids[9]!, T0))!.topPercent;
    const res = (await make("Mossy Bishop")).body;
    await recordResult(sql, res.id, { mode: "crowd", online: true, placement: 1, players: 100, rating: 3000, ranked: true }, T0);
    // (The 1900 player is 2nd of 11 now: the resident counts.)
    expect((await publicProfile(sql, ids[9]!, T0))!.topPercent).not.toBe(before);
    for (const [id, ladder] of [[res.id, 3100], [ids[9]!, 3000]] as const)
      await sql.run("INSERT INTO ranked_1v1 (user_id, rating, rd, games, wins, losses, draws, ladder, last_at) VALUES (?, 2400, 60, 40, 20, 20, 0, ?, ?)", id, ladder, T0);
    forgetTopPlaces();
    expect(await topPlace(sql, 3100, T0)).toBe(1);
    expect(await topPlace(sql, 3000, T0)).toBe(2);
    expect((await searchPlayers(sql, ids[0]!, "Mossy", true)).map((p) => p.id)).toEqual([res.id]);
  });
});

describe("residents: the kill switch, PAUSE_RESIDENTS", () => {
  const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
  let ip = 0;
  const fetchAs = async (env: object, path: string, cookie?: string) => {
    const res = await worker.fetch(new Request(`https://hunchess.test${path}`, { headers: { "cf-connecting-ip": `10.2.0.${++ip}`, ...(cookie ? { cookie } : {}) } }), env as never, ctx);
    return { status: res.status, body: (await res.json().catch(() => null)) as { message?: string; paused?: string } | null };
  };

  it("read as every PAUSE_ variable; never in /api/status (the server's own switch)", async () => {
    for (const v of ["1", "true", "on", " yes "]) expect(residentsPaused({ PAUSE_RESIDENTS: v })).toBe(true);
    for (const v of [undefined, "", "0", "off"]) expect(residentsPaused({ PAUSE_RESIDENTS: v })).toBe(false);
    expect((await fetchAs({ PAUSE_RESIDENTS: "1" }, "/api/status")).body).toEqual({ paused: [], banner: null });
  });

  it("a resident's session gets 503 on every /api/* route, sockets too; nobody else's; off, nothing changes", async () => {
    const { sql, d1, make } = await world();
    const resident = `hc_session=${tokenOf((await make("Mossy Bishop")).res)}`;
    const player = await signedIn(sql, "player@example.com");
    const on = { DB: d1, PAUSE_RESIDENTS: "1" };
    for (const path of ["/api/me", "/api/live", "/api/lobby/ABCDE/ws", "/api/1v1/game/ABCDE/ws", "/api/squads/party/ABCDE/ws"]) {
      expect(await fetchAs(on, path, resident), path).toEqual({ status: 503, body: { message: RESIDENTS_PAUSED, paused: "residents" } });
    }
    expect((await fetchAs(on, "/api/me", player.cookie)).status).toBe(200);
    expect((await fetchAs({ DB: d1 }, "/api/me", `hc_session=${tokenOf((await make("Pawn Storm")).res)}`)).status).toBe(200);
  });

  it("the route: no resident made, signed in or heartbeat while it's on; the report still answers, saying so", async () => {
    const { sql, call } = await world({ PAUSE_RESIDENTS: "1" });
    for (const path of ["", "/beat"]) {
      const res = (await call("POST", {}, { name: "Mossy" }, { access: RESIDENTS_CLIENT, path }))!;
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ message: RESIDENTS_PAUSED, paused: "residents" });
    }
    expect(await sql.first("SELECT id FROM users WHERE resident = 1")).toBeNull();
    const report = (await (await call("GET", {}, undefined, { access: RESIDENTS_CLIENT }))!.json()) as ResidentsReport;
    expect(report.paused).toBe(true);
  });
});

class FakeSocket {
  sent: { t: string; message?: string }[] = [];
  closed: number | null = null;
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
  close(code: number) {
    this.closed = code;
  }
}

/** A Durable Object's fake runtime: storage, sockets (the open ones), waitUntil. */
function runtime() {
  const store = new Map<string, unknown>();
  const sockets: FakeSocket[] = [];
  let loading: Promise<unknown> = Promise.resolve();
  const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
  const ctx = {
    storage: {
      get: async (k: string | string[]) => (Array.isArray(k) ? new Map(k.filter((x) => store.has(x)).map((x) => [x, clone(store.get(x))])) : clone(store.get(k))),
      list: async () => new Map(),
      put: async (k: string | Record<string, unknown>, v?: unknown) => {
        for (const [key, val] of Object.entries(typeof k === "string" ? { [k]: v } : k)) store.set(key, clone(val));
      },
      delete: async (k: string | string[]) => void (Array.isArray(k) ? k : [k]).forEach((x) => store.delete(x)),
      setAlarm: async () => undefined,
      deleteAlarm: async () => undefined,
      getAlarm: async () => null,
      deleteAll: async () => store.clear(),
    },
    getWebSockets: () => sockets.filter((s) => s.closed === null),
    acceptWebSocket: (ws: FakeSocket) => void sockets.push(ws),
    waitUntil: (p: Promise<unknown>) => void p.catch(() => undefined),
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => (loading = fn()),
  };
  const socket = (attached: Record<string, unknown>) => {
    const ws = new FakeSocket();
    ws.serializeAttachment(attached);
    sockets.push(ws);
    return ws;
  };
  return { store, ctx: ctx as unknown as DurableObjectState, socket, loaded: () => loading };
}

const say = (room: { webSocketMessage(ws: WebSocket, m: string): Promise<void> }, ws: FakeSocket, msg: object) => room.webSocketMessage(ws as unknown as WebSocket, JSON.stringify(msg));
const refused = (ws: FakeSocket) => ws.closed === 1008 && ws.sent.some((m) => m.t === "error" && m.message === RESIDENTS_PAUSED);

describe("residents: the kill switch in every room", () => {
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

  it("the lobby: a resident's socket is marked from its session; its hello is refused while paused; a seated one's next message closes it and leaves its seat", async () => {
    const { sql, d1, make } = await world();
    const env: Record<string, unknown> = { DB: d1 };
    const rt = runtime();
    const lobby = new Lobby(rt.ctx, env as never);
    await rt.loaded();
    await lobby.create("RESID", JSON.parse(JSON.stringify(modeSettings("crowd", { augments: false }))) as LobbyRecord["overrides"]);
    const res = (await make("Mossy Bishop")).body;
    const real = await signedIn(sql, "eric@example.com");
    // Through the room's own door: the session says who's a resident.
    const join = async (cookie: string) => {
      await lobby.fetch(new Request("https://hunchess.test/api/lobby/RESID/ws", { headers: { upgrade: "websocket", cookie } }));
      return pair[1]!;
    };
    const rWs = await join(`hc_session=${await createSession(sql, res.id, Date.now())}`);
    const eWs = await join(real.cookie);
    expect((rWs.deserializeAttachment() as { resident?: boolean }).resident).toBe(true);
    expect((eWs.deserializeAttachment() as { resident?: boolean }).resident).toBeUndefined();
    // Paused: the resident's hello is refused; the person's isn't.
    env.PAUSE_RESIDENTS = "1";
    await say(lobby, rWs, { t: "hello", name: "Mossy Bishop", device: "computer" });
    expect(refused(rWs)).toBe(true);
    await say(lobby, eWs, { t: "hello", name: "Eric", device: "phone" });
    expect(eWs.closed).toBeNull();
    // Off: the resident sits; on again, its next message closes it and its seat is gone (a bot's by LEAVING.awayMs).
    delete env.PAUSE_RESIDENTS;
    const again = await join(`hc_session=${await createSession(sql, res.id, Date.now())}`);
    await say(lobby, again, { t: "hello", name: "Mossy Bishop", device: "computer" });
    const seat = (again.deserializeAttachment() as { playerId: string }).playerId;
    expect((rt.store.get("lobby") as LobbyRecord).humans.find((h) => h.id === seat)).toMatchObject({ connected: true, resident: true });
    env.PAUSE_RESIDENTS = "1";
    await say(lobby, again, { t: "chat", say: "gg" });
    expect(refused(again)).toBe(true);
    expect((rt.store.get("lobby") as LobbyRecord).humans.find((h) => h.id === seat)).toMatchObject({ connected: false });
    expect(eWs.closed).toBeNull();
  });

  it("1 v 1: a resident's hello is refused while paused; a seated one's next message closes it, a disconnect", async () => {
    const { d1, make } = await world();
    const env: Record<string, unknown> = { DB: d1, PAUSE_RESIDENTS: "1" };
    const rt = runtime();
    const game = new DuelGame(rt.ctx, env as never);
    await rt.loaded();
    const a = (await make("Mossy Bishop")).body;
    const b = (await make("Pawn Storm")).body;
    const p = (u: ResidentAnswer) => ({ uid: u.id, name: u.name, look: null, rank: null, rating: 1200 }) as never;
    expect(await game.create("DUELR", { w: p(a), b: p(b) })).toBe(true);
    const w = rt.socket({ color: "w", uid: a.id, resident: true });
    await say(game, w, { t: "hello", v: DUEL_PROTOCOL });
    expect(refused(w)).toBe(true);
    delete env.PAUSE_RESIDENTS;
    const w2 = rt.socket({ color: "w", uid: a.id, resident: true });
    await say(game, w2, { t: "hello", v: DUEL_PROTOCOL });
    expect(w2.closed).toBeNull();
    const seen = JSON.stringify(rt.store.get("game"));
    env.PAUSE_RESIDENTS = "1";
    await say(game, w2, { t: "chat", say: "gg" });
    expect(refused(w2)).toBe(true);
    expect(JSON.stringify(rt.store.get("game"))).not.toBe(seen);
  });

  it("Squads' lobby and party: a resident's hello is refused while paused", async () => {
    const env = { PAUSE_RESIDENTS: "1" };
    const rtL = runtime();
    const squads = new SquadsLobby(rtL.ctx, env as never);
    await rtL.loaded();
    expect(await squads.create("SQUAD", { fillAt: Date.now() + 5_000, test: { start: 0 } })).toEqual([]);
    const ws = rtL.socket({ userId: "res-1", guest: false, banned: false, resident: true });
    await say(squads, ws, { t: "hello", v: SQUADS_PROTOCOL, name: "Mossy" });
    expect(refused(ws)).toBe(true);
    const person = rtL.socket({ test: true });
    await say(squads, person, { t: "hello", v: SQUADS_PROTOCOL, name: "Eric" });
    expect(person.closed).toBeNull();
    const rtP = runtime();
    const party = new SquadsParty(rtP.ctx, env as never);
    await rtP.loaded();
    expect(await party.create("PARTY", "squads-q", 60_000)).toBe(true);
    const pws = rtP.socket({ userId: "res-1", guest: false, banned: false, resident: true });
    await say(party, pws, { t: "hello", v: SQUADS_PROTOCOL, name: "Mossy" });
    expect(refused(pws)).toBe(true);
  });
});

/** A match's picks: `n` counted middlegame moves, every fourth one hard; `engine` finds them all (fairplay.test.ts's). */
function picks(n: number, engine: boolean): FairMove[] {
  return Array.from({ length: n }, (_, i) => {
    const hard = i % 4 === 0;
    const loss = engine ? 0 : hard ? 15 : i % 3 === 0 ? 10 : 2;
    return { ply: 14 + 2 * i, fen: `fen ${i}`, move: engine ? "e2e4" : "d2d4", best: "e2e4", loss, bestExp: 0.55, near: 2, gap: 3, crowd: 40, crowdFound: hard ? 2 : 24, thinkMs: engine ? 3500 : hard ? 15_000 : 6000, away: 0, legal: 30 };
  });
}

describe("residents: fair play records them and never acts", () => {
  const DAY = 86_400_000;

  it("a resident's engine-like matches are recorded with what detection would have done; no case, no pool, no deep re-check queued", async () => {
    const { sql, make } = await world();
    const res = (await getUser(sql, (await make("Mossy Bishop")).body.id))!;
    const real = await signedIn(sql, "cheat@example.com");
    const t = 50 * DAY;
    // (What detection did for the real account, match by match: what each of the resident's rows says it would have done.)
    const acted: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await recordFairPlay(sql, res.id, { lobby: `AAAA${"ABC"[i]}`, mode: "crowd", moves: picks(20, true) }, t + i * 3_600_000);
      expect(r.acted).toBe("none");
      expect(r.verdict.level).not.toBe("none");
      acted.push((await recordFairPlay(sql, real.user.id, { lobby: `AAAA${"ABC"[i]}`, mode: "crowd", moves: picks(20, true) }, t + i * 3_600_000)).acted);
    }
    expect(await caseOf(sql, res.id)).toBeNull();
    expect(await sql.all("SELECT id FROM fairplay_log WHERE user_id = ?", res.id)).toEqual([]);
    const rows = await sql.all<{ would: string | null; deep_queued: number | null; counted: number }>("SELECT would, deep_queued, counted FROM fairplay_matches WHERE user_id = ? ORDER BY id", res.id);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.counted === 20 && !r.deep_queued)).toBe(true);
    expect(rows.map((r) => r.would)).toEqual(acted);
    expect(acted.every((a) => a !== "none")).toBe(true);
    // The same play from a real account: a case, as ever, and no would-have.
    expect((await caseOf(sql, real.user.id))?.status).toBeTruthy();
    expect(await sql.all("SELECT would FROM fairplay_matches WHERE user_id = ? AND would IS NOT NULL", real.user.id)).toEqual([]);
    // The deep re-check's entry point acts on nothing for them.
    expect((await relevel(sql, res.id, t + DAY)).acted).toBe("none");
    expect(await caseOf(sql, res.id)).toBeNull();
  });

  it("detection, reports, evasion and the automated reviewer never open or move a resident's case; a person still can", async () => {
    const { sql, make } = await world();
    const id = (await make("Mossy Bishop")).body.id;
    for (const by of ["detection", "reports", "evasion", "reviewer"]) await setCase(sql, id, "review", by, "a test", T0);
    expect(await raiseCase(sql, id, "watch", "detection", "a test", T0)).toBe(false);
    expect(await decide(sql, id, "review", "reviewer", "the reviewer's look", T0)).toEqual({ ok: false, status: 409, message: "a resident's case is for a person" });
    expect(await caseOf(sql, id)).toBeNull();
    await setCase(sql, id, "watch", `admin:${ADMIN}`, "Eric looked", T0);
    expect((await caseOf(sql, id))?.status).toBe("watch");
  });

  it("a resident's reports never count (nothing stored); a real player's report of a resident is kept, and opens no case", async () => {
    const { sql, make } = await world();
    const res = (await getUser(sql, (await make("Mossy Bishop")).body.id))!;
    const fresh = await signedIn(sql, "new@example.com");
    expect(await reportPlayer(sql, res, fresh.user.id, "Cheating", "ABCDE", T0)).toEqual({ ok: true });
    expect(await sql.all("SELECT id FROM reports WHERE reporter = ?", res.id)).toEqual([]);
    expect(await caseOf(sql, fresh.user.id)).toBeNull();
    for (const email of ["a@example.com", "b@example.com", "c@example.com"]) expect((await reportPlayer(sql, (await signedIn(sql, email)).user, res.id, "Cheating", null, T0)).ok).toBe(true);
    expect(await sql.all("SELECT id FROM reports WHERE target = ?", res.id)).toHaveLength(3);
    expect(await caseOf(sql, res.id)).toBeNull();
    // (Report rows from residents, however they came, never count toward a review.)
    const others = await Promise.all(["Res Two", "Res Three"].map(async (n) => (await make(n)).body.id));
    for (const r of others) await sql.run("INSERT INTO reports (reporter, target, reason, at) VALUES (?, ?, 'Cheating', ?)", r, fresh.user.id, T0);
    await reportPlayer(sql, (await signedIn(sql, "d@example.com")).user, fresh.user.id, "Cheating", null, T0 + 1);
    expect((await caseOf(sql, fresh.user.id))?.status).toBe("watch");
  });

  it("evasion never touches a resident (a banned account's device), and a resident is never pooled", async () => {
    const { sql, make } = await world();
    const banned = await signedIn(sql, "banned@example.com");
    const device = "d".repeat(20);
    await banCheck(sql, banned.user, device, T0);
    await setCase(sql, banned.user.id, "banned", `admin:${ADMIN}`, "cheating", T0);
    const res = (await getUser(sql, (await make("Mossy Bishop")).body.id))! as User;
    expect(await banCheck(sql, res, device, T0 + 1)).toEqual({ banned: false });
    expect(await caseOf(sql, res.id)).toBeNull();
    // (Its device is recorded, as anyone's.)
    expect(await sql.first("SELECT device FROM fairplay_devices WHERE user_id = ?", res.id)).toEqual({ device });
  });

  it("the deep re-check skips a resident's queued matches", async () => {
    const { sql, make } = await world();
    const id = (await make("Mossy Bishop")).body.id;
    await sql.run(
      "INSERT INTO fairplay_matches (user_id, lobby, mode, played_at, counted, perf, score, level, summary, moves, keep_until, deep_queued) VALUES (?, 'ABCDE', 'crowd', ?, 1, 2500, 90, 'ban', '{}', ?, ?, 1)",
      id,
      T0,
      JSON.stringify(picks(1, true)),
      T0 + DAY,
    );
    let searched = 0;
    const r = await deepCheckRun(sql, async () => void searched++ as never, T0, { all: true });
    expect(r).toEqual({ searches: 0, matches: 0 });
    expect(searched).toBe(0);
  });
});

describe("residents: a session knows its own", () => {
  it("userFromToken and getUser say resident: 1 for a resident, nothing for anyone else", async () => {
    const { sql, make } = await world();
    const { res, body } = await make("Mossy Bishop");
    expect((await userFromToken(sql, tokenOf(res), T0))!.resident).toBe(1);
    expect((await getUser(sql, body.id))!.resident).toBe(1);
    const other = await signedIn(sql, "x@example.com");
    expect((await getUser(sql, other.user.id))!.resident ?? null).toBeNull();
  });
});
