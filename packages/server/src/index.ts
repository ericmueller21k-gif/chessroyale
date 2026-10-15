import { stockfishRefuses } from "@chessroyale/chess";
import { RAID_SETTINGS, modeSettings } from "@chessroyale/core";
import { Lobby } from "./lobby-do.ts";
import { SquadsLobby, SquadsParty } from "./squads-do.ts";
import { squadsTestAllowed, testLobbyOptions } from "./squads-lobby.ts";
import { Matchmaker } from "./matchmaker.ts";
import { LiveHub } from "./live-hub.ts";
import { openLobbyCode } from "./codes.ts";
import { MATCH_ENDED } from "./lobby.ts";
import { d1Sql, ensureSchema, lobbyResult, type User } from "./accounts.ts";
import { DEVICE_COOKIE, SESSION_COOKIE, SIGN_IN_TO_PLAY, accountOf, handleAccountApi, isSignedIn, readCookie, signInRequired, withSecrets, type AccountEnv, type WaitUntil } from "./api.ts";
import { BANNED_MESSAGE, banCheck } from "./fairplay.ts";
import { caseMailer } from "./fairplay-mail.ts";
import { handleAdmin, isAdmin, testSwitchesOn, type AdminEnv } from "./admin.ts";
import { asksTestSwitches, lobbyOptions } from "./lobby-options.ts";
import { deepCheckRun } from "./fairplay-deep.ts";
import { containerSearch } from "./fairplay-engine.ts";
import { REGION_HINT, queueName, regionOf } from "./queue.ts";
import { TOO_MANY, rateLimited } from "./limits.ts";
import { countRoute, opsStats, routeOf } from "./ops.ts";
import { codeInPath, guardEntries, handleProblems, pruneProblems, serverError } from "./problems.ts";
import { handleOpsAdmin } from "./ops-admin.ts";
import type { AccessEnv } from "./access.ts";
import { SERVER_RECHECK_NODES, serverScoreAt, warmEngine, type EngineEnv } from "./engine.ts";

export { Lobby, SquadsLobby, SquadsParty, Matchmaker, LiveHub };
export { EngineServer } from "./engine.ts";

// The Durable Objects' entry points (their fetch, WebSocket handlers, alarm and the methods the Worker calls): an
// error in one is logged and counted (problems.ts), then thrown on as before.
guardEntries(Lobby, "Lobby", ["fetch", "webSocketMessage", "webSocketClose", "alarm", "exists", "status", "create", "joinable", "reserve", "release", "hurry"]);
guardEntries(SquadsLobby, "SquadsLobby", ["fetch", "webSocketMessage", "webSocketClose", "alarm", "exists", "status", "create", "reserve"]);
guardEntries(SquadsParty, "SquadsParty", ["fetch", "webSocketMessage", "webSocketClose", "alarm", "create", "status"]);
guardEntries(Matchmaker, "Matchmaker", ["next"]);
guardEntries(LiveHub, "LiveHub", ["seen", "arrive", "report", "forget", "liveCounts", "players", "health", "presence", "chatRead", "chatPost", "chatIcon", "alarm"]);

export interface Env extends AccountEnv, EngineEnv, AdminEnv, AccessEnv {
  LOBBIES: DurableObjectNamespace<Lobby>;
  /** Squads: one object per lobby, and one per party (squads-do.ts). */
  SQUADS: DurableObjectNamespace<SquadsLobby>;
  PARTIES: DurableObjectNamespace<SquadsParty>;
  /** "1" (local and e2e only, never production): anyone may use Squads' test controls (else admins only). */
  SQUADS_TEST?: string;
  /**
   * "1" (local and e2e only, never production): everyone in a lobby counts as an admin for the Maia boss (BOSS_BRAIN:
   * a lobby of admins only meets it while it's off for players), so a test can play an online battle on Maia. Only a
   * device that may run Maia (an admin's, in the app) loads it; the rest play Stockfish's move as host.
   */
  MAIA_TEST?: string;
  MATCHMAKER: DurableObjectNamespace<Matchmaker>;
  LIVE?: DurableObjectNamespace<LiveHub>;
  ASSETS: Fetcher;
  /** Seconds a matchmade lobby waits for players before bots fill it (default 60; shorter for local tests). */
  MATCH_FILL_SECONDS?: string;
  /** Load-test counters at /api/ops/stats, for requests with this as their x-ops-key (unset in production). */
  OPS_STATS?: string;
  /** "1" on staging for load tests from one machine: the per-address rate limit is off (never in production). */
  LOAD_TEST?: string;
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });

export default {
  /** Every request: an error anywhere in it is logged and counted (problems.ts), and the answer is a plain 500. */
  async fetch(request: Request, rawEnv: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await handle(request, rawEnv, ctx);
    } catch (e) {
      const url = new URL(request.url);
      serverError(rawEnv, { kind: "fetch", route: routeOf(request.method, url.pathname), code: codeInPath(url.pathname) }, e, (p) => ctx.waitUntil(p));
      return json({ message: "Something went wrong. Try again." }, 500);
    }
  },

  /**
   * The Worker's schedule (wrangler.jsonc, every 15 minutes): old errors and player reports deleted (problems.ts), and
   * fair play's deep re-check of flagged players' moves on the engine server (cases in review at once, the rest
   * off-peak; fairplay-deep.ts). An error is logged and counted like any other.
   */
  async scheduled(_event: ScheduledController, rawEnv: Env, ctx: ExecutionContext): Promise<void> {
    if (!rawEnv.DB) return;
    const db = rawEnv.DB;
    ctx.waitUntil(
      (async () => {
        const sql = d1Sql(db);
        await ensureSchema(sql, db);
        await pruneProblems(sql, Date.now());
        const env = await withSecrets(rawEnv);
        const search = containerSearch(env);
        if (!search) return;
        const r = await deepCheckRun(sql, search, Date.now(), { mail: caseMailer(env) });
        if (r.searches) console.log(`fair play deep re-check: ${r.searches} searches, ${r.matches} matches done`);
      })().catch((e: unknown) => serverError(rawEnv, { kind: "cron", route: "scheduled" }, e, (p) => ctx.waitUntil(p))),
    );
  },
} satisfies ExportedHandler<Env>;

async function handle(request: Request, rawEnv: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  // (The admin pages, fair play's and ops', are the Worker's own; everything else outside /api is the app.)
  const admin = /^\/admin\/(fairplay|ops)(\/|$)/.test(url.pathname);
  if (!url.pathname.startsWith("/api/") && !admin) return rawEnv.ASSETS.fetch(request);
  // Load-test counters (OPS_STATS set, and the matching key): see ops.ts.
  if (url.pathname === "/api/ops/stats" && rawEnv.OPS_STATS && request.headers.get("x-ops-key") === rawEnv.OPS_STATS) {
    return json(opsStats(url.searchParams.get("reset") === "1"));
  }
  const t = Date.now();
  // Rate limits (limits.ts): a friendly 429 with when to try again.
  const wait = rateLimited(
    {
      ip: request.headers.get("cf-connecting-ip"),
      session: readCookie(request, SESSION_COOKIE),
      play: request.method === "POST" && (url.pathname === "/api/play" || url.pathname === "/api/lobby" || /^\/api\/squads\/(play|party|lobby)$/.test(url.pathname)),
    },
    t,
    rawEnv.LOAD_TEST === "1",
  );
  if (wait !== null) {
    countRoute("429", 0);
    return json({ message: TOO_MANY, retryMs: wait }, 429, { "retry-after": String(Math.ceil(wait / 1000)) });
  }
  const res = await route(request, rawEnv, url, (p) => ctx.waitUntil(p));
  const ms = Date.now() - t;
  countRoute(routeOf(request.method, url.pathname), ms);
  // How long the Worker took (the load test reads it; browsers show it in their network panel).
  if (res.status === 101 || res.webSocket) return res;
  const out = new Response(res.body, res);
  out.headers.append("server-timing", `app;dur=${ms}`);
  return out;
}

async function route(request: Request, rawEnv: Env, url: URL, waitUntil: WaitUntil): Promise<Response> {
  {
    // POST /api/problems: errors a device caught, or the feedback sheet's report (a bug, feedback, an idea: problems.ts).
    if (url.pathname === "/api/problems") return handleProblems(request, rawEnv, waitUntil);
    // (The sign-in secrets may live in the Secrets Store: read them as strings.)
    const env = await withSecrets(rawEnv);
    // Fair play's review page and the automated reviewer's API (admins and the reviewer's token only).
    const review = await handleAdmin(request, env, caseMailer(env), waitUntil, containerSearch(env));
    if (review) return review;
    // The ops page and the health view (admins only; the health view's JSON also for scripts through Access).
    const ops = await handleOpsAdmin(request, env);
    if (ops) return ops;
    // Accounts: /api/me, /api/results, /api/auth/*
    const account = await handleAccountApi(request, env, fetch, waitUntil);
    if (account) return account;
    // POST /api/engine/score {fen, moves} → {moves}: the engine server's deeper look at a few moves (solo games'
    // re-checks); 503 when there's no server or today's budget is spent (the device then re-checks itself). A position
    // Stockfish refuses is a bad request, turned away before the budget (it would end the server's Stockfish: engine.ts).
    if (url.pathname === "/api/engine/score" && request.method === "POST") {
      const body = (await request.json().catch(() => null)) as { fen?: unknown; moves?: unknown; boards?: unknown } | null;
      const moves = Array.isArray(body?.moves) ? body.moves.filter((m): m is string => typeof m === "string").slice(0, 8) : [];
      if (typeof body?.fen !== "string" || !moves.length || stockfishRefuses(body.fen)) return json({ message: "Bad request" }, 400);
      // Several boards re-checked at once (Classic) share the budget, so the round still takes a few seconds.
      const boards = Math.max(1, Math.min(8, Math.round(Number(body.boards) || 1)));
      const out = await serverScoreAt(env, body.fen, moves, Math.max(400_000, Math.round(SERVER_RECHECK_NODES / boards)));
      return out ? json({ moves: out }) : json({ message: "Engine server unavailable" }, 503);
    }
    // GET /api/engine/ping: wakes the engine server (a solo game is starting).
    if (url.pathname === "/api/engine/ping") {
      return json({ ok: await warmEngine(env) });
    }
    // POST /api/play?mode=crowd|raid&type=default|botsoff → { code }: PLAY, the queue for a mode and matchmaking type
    // (one queue each). Default: the lobby that's filling up, bots in the empty seats at the fill time. Bots off: people
    // only, waiting until it's full (a raid: or a minute with enough people). (Solo is played in the browser.)
    // &from=CODE with { seat }: Bots off → Default, keeping your wait: you leave that lobby and bots fill a minute after
    // you first joined it at the latest. 409 if that lobby has started meanwhile (stay in it).
    if (url.pathname === "/api/play" && request.method === "POST") {
      const refused = await mayPlay(request, env, waitUntil);
      if (refused) return refused;
      const fill = Math.max(3, Math.min(600, Number(env.MATCH_FILL_SECONDS ?? 60) || 60));
      const raid = url.searchParams.get("mode") === "raid";
      const type = url.searchParams.get("type") === "botsoff" ? "botsoff" : "default";
      const overrides = raid ? RAID_SETTINGS : modeSettings("crowd", { augments: true });
      // ?pool=NAME: a queue of its own (a test switch: tests run several queues at once without meeting). Split by
      // region when that's on (queue.ts). ?ticket=ID: a player in line asking again (they keep their place).
      const region = regionOf(request.cf as { continent?: unknown } | undefined);
      const name = queueName(raid ? "raid" : "crowd", type, await testPool(request, env, url, waitUntil), region);
      const mm = env.MATCHMAKER.get(env.MATCHMAKER.idFromName(name), region ? { locationHint: REGION_HINT[region] } : undefined);
      const ticket = url.searchParams.get("ticket");
      let since: number | undefined;
      const from = url.searchParams.get("from")?.toUpperCase();
      if (from && type === "default") {
        const body = (await request.json().catch(() => null)) as { seat?: unknown } | null;
        const released = /^[A-Z2-9]{5}$/.test(from) && typeof body?.seat === "string" ? await env.LOBBIES.get(env.LOBBIES.idFromName(from)).release(body.seat) : null;
        if (!released) return json({ message: "That lobby has started." }, 409);
        since = released.joinedAt;
      }
      try {
        // A code, or "Servers are busy, you're in line: about N s" (busy, with the ticket to ask again with).
        const opts = { botsOff: type === "botsoff", crowdWaitsForFull: !raid, since };
        return json(await mm.next(JSON.parse(JSON.stringify(overrides)), fill * 1000, opts, ticket && /^[\w-]{8,64}$/.test(ticket) ? ticket : null));
      } catch {
        return json({ message: "Couldn't find a match. Try again." }, 500);
      }
    }
    // POST /api/lobby → { code }: the creator's choices, and the test switches for those allowed them (lobby-options.ts).
    if (url.pathname === "/api/lobby" && request.method === "POST") {
      const refused = await mayPlay(request, env, waitUntil);
      if (refused) return refused;
      const test = asksTestSwitches(url.searchParams) && (await testSwitches(request, env, waitUntil));
      const { overrides, keepMs } = lobbyOptions(url.searchParams, test);
      const code = await openLobbyCode(async (c) => (await env.LOBBIES.get(env.LOBBIES.idFromName(c)).create(c, overrides, undefined, keepMs)) !== false);
      return code ? json({ code }) : json({ message: "Couldn't create a lobby. Try again." }, 500);
    }
    // Squads (docs/areas/squads.md, "The server"): its queue, parties and lobbies, and the test lobby.
    const squads = await squadsRoute(request, env, url, waitUntil);
    if (squads) return squads;
    // GET /api/lobby/CODE → { open: true, phase } | 404 { open: false, message }: whether a lobby (an invite link, a
    // stale tab) is still open. Once its match is over, also your result in it, for "See your result".
    const st = url.pathname.match(/^\/api\/lobby\/([A-Z2-9]{5})$/i);
    if (st && request.method === "GET") {
      const code = st[1]!.toUpperCase();
      const status = await env.LOBBIES.get(env.LOBBIES.idFromName(code)).status();
      let result = null;
      if ((!status || status.phase === "over") && env.DB) {
        const me = await accountOf(request, env, waitUntil).catch(() => null);
        if (me) result = await lobbyResult(d1Sql(env.DB), me.id, code).catch(() => null);
      }
      if (!status) return json({ open: false, message: MATCH_ENDED, ...(result ? { result } : {}) }, 404);
      return json({ open: true, phase: status.phase, ...(result ? { result } : {}) });
    }
    // GET /api/lobby/CODE/ws → WebSocket to that lobby's Durable Object
    const m = url.pathname.match(/^\/api\/lobby\/([A-Z2-9]{5})\/ws$/i);
    if (m) {
      const stub = env.LOBBIES.get(env.LOBBIES.idFromName(m[1]!.toUpperCase()));
      if (!(await stub.exists())) return json({ message: "We couldn't find that lobby." }, 404);
      return stub.fetch(request);
    }
    return json({ message: "Not found" }, 404);
  }
}

/**
 * Squads (nothing links here until its screens ship, phase 3):
 *   POST /api/squads/play[?pool=&ticket=] → { code } | busy: the Squads queue, one player (a party queues from its own
 *     object). Lobbies fill with bots after MATCH_FILL_SECONDS.
 *   POST /api/squads/party → { code }: a new party (the invite link is /squads/party/CODE).
 *   GET /api/squads/party/CODE → { open, members, state } | 404; /api/squads/party/CODE/ws: its WebSocket.
 *   GET /api/squads/lobby/CODE → { open, phase } | 404; /api/squads/lobby/CODE/ws: its WebSocket.
 *   POST /api/squads/lobby?start=votes|relay|pairs|final&clock=BANK,TOPUP,FREE,INC&keep=S → { code }: a test lobby
 *     (test controls: admins, or anyone where SQUADS_TEST is "1"; else 404). It fills with bots SQUADS_LOBBY.testFillSeconds
 *     after it opens (start=votes: as soon as its opener connects, at the first vote), and records and rewards nothing.
 */
async function squadsRoute(request: Request, env: Env, url: URL, waitUntil: WaitUntil): Promise<Response | null> {
  if (!url.pathname.startsWith("/api/squads/")) return null;
  const fill = Math.max(3, Math.min(600, Number(env.MATCH_FILL_SECONDS ?? 60) || 60));
  const region = regionOf(request.cf as { continent?: unknown } | undefined);
  const queue = async () => queueName("squads", "default", await testPool(request, env, url, waitUntil), region);
  if (url.pathname === "/api/squads/play" && request.method === "POST") {
    const refused = await mayPlay(request, env, waitUntil);
    if (refused) return refused;
    const mm = env.MATCHMAKER.get(env.MATCHMAKER.idFromName(await queue()), region ? { locationHint: REGION_HINT[region] } : undefined);
    const ticket = url.searchParams.get("ticket");
    try {
      return json(await mm.next({}, fill * 1000, { squads: true }, ticket && /^[\w-]{8,64}$/.test(ticket) ? ticket : null, { size: 1, pass: "" }));
    } catch {
      return json({ message: "Couldn't find a match. Try again." }, 500);
    }
  }
  if (url.pathname === "/api/squads/party" && request.method === "POST") {
    const refused = await mayPlay(request, env, waitUntil);
    if (refused) return refused;
    const name = await queue();
    const code = await openLobbyCode(async (c) => env.PARTIES.get(env.PARTIES.idFromName(c)).create(c, name, fill * 1000));
    return code ? json({ code }) : json({ message: "Couldn't make a party. Try again." }, 500);
  }
  if (url.pathname === "/api/squads/lobby" && request.method === "POST") {
    const me = await accountOf(request, env, waitUntil).catch(() => null);
    if (!squadsTestAllowed(env.SQUADS_TEST, isAdmin(env, me))) return json({ message: "Not found" }, 404);
    const opts = testLobbyOptions(url.searchParams, Date.now());
    const code = await openLobbyCode(async (c) => (await env.SQUADS.get(env.SQUADS.idFromName(c)).create(c, opts)) !== false);
    return code ? json({ code }) : json({ message: "Couldn't create a lobby. Try again." }, 500);
  }
  const m = url.pathname.match(/^\/api\/squads\/(party|lobby)\/([A-Z2-9]{5})(\/ws)?$/i);
  if (!m) return json({ message: "Not found" }, 404);
  const code = m[2]!.toUpperCase();
  if (m[1] === "party") {
    const stub = env.PARTIES.get(env.PARTIES.idFromName(code));
    if (m[3]) return (await stub.status()) ? stub.fetch(request) : json({ message: "We couldn't find that party." }, 404);
    const status = request.method === "GET" ? await stub.status() : null;
    return status ? json({ open: true, ...status }) : json({ open: false, message: "That party has closed." }, 404);
  }
  const stub = env.SQUADS.get(env.SQUADS.idFromName(code));
  if (m[3]) return (await stub.exists()) ? stub.fetch(request) : json({ message: "We couldn't find that lobby." }, 404);
  const status = request.method === "GET" ? await stub.status() : null;
  return status ? json({ open: true, phase: status.phase }) : json({ open: false, message: MATCH_ENDED }, 404);
}

/**
 * Whether this request may use the test switches (testSwitchesOn in admin.ts): TEST_SWITCHES on here, or an admin's.
 * Asked only when a request carries one, so other requests never look up who's asking for it.
 */
async function testSwitches(request: Request, env: Env, waitUntil: WaitUntil): Promise<boolean> {
  if (env.TEST_SWITCHES === "1") return true;
  return testSwitchesOn(env, await accountOf(request, env, waitUntil).catch(() => null));
}

/** ?pool=NAME, a queue of its own: a test switch (else the usual queue). */
async function testPool(request: Request, env: Env, url: URL, waitUntil: WaitUntil): Promise<string | null> {
  const pool = url.searchParams.get("pool");
  return pool && (await testSwitches(request, env, waitUntil)) ? pool : null;
}

/**
 * Whether this request may start online play (PLAY, a new lobby): signed in where sign-in is set up (401 otherwise),
 * and not banned for fair play (403, with `banned` so the app shows the ban notice and its appeal). Null: go ahead.
 */
async function mayPlay(request: Request, env: Env, waitUntil: WaitUntil): Promise<Response | null> {
  if (!env.DB) return null;
  const me: User | null = await accountOf(request, env, waitUntil);
  if (signInRequired(env) && !isSignedIn(me)) return json({ message: SIGN_IN_TO_PLAY }, 401);
  const ban = await banCheck(d1Sql(env.DB), me, readCookie(request, DEVICE_COOKIE), Date.now()).catch(() => ({ banned: false }));
  return ban.banned ? json({ message: BANNED_MESSAGE, banned: true }, 403) : null;
}
