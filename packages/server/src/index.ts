import { BOSS_TIERS, LOBBY_LIFE, CROWD_KNOCKOUTS, RAID_SETTINGS, DRAW_RULES, MAX_OPENING_MOVES, PACE_SETTINGS, definedOnly, modeSettings, speedOption, type DrawRule, type FinalFormat } from "@chessroyale/core";
import type { Lobby } from "./lobby-do.ts";
import type { Matchmaker } from "./matchmaker.ts";
import type { LiveHub } from "./live-hub.ts";
import { openLobbyCode } from "./codes.ts";
import { MATCH_ENDED } from "./lobby.ts";
import { d1Sql, ensureSchema, lobbyResult, type User } from "./accounts.ts";
import { DEVICE_COOKIE, SESSION_COOKIE, SIGN_IN_TO_PLAY, accountOf, handleAccountApi, isSignedIn, readCookie, signInRequired, withSecrets, type AccountEnv, type WaitUntil } from "./api.ts";
import { BANNED_MESSAGE, banCheck } from "./fairplay.ts";
import { caseMailer } from "./fairplay-mail.ts";
import { handleAdmin, type AdminEnv } from "./admin.ts";
import { containerSearch, deepCheckRun } from "./fairplay-deep.ts";
import { REGION_HINT, queueName, regionOf } from "./queue.ts";
import { TOO_MANY, rateLimited } from "./limits.ts";
import { countRoute, opsStats, routeOf } from "./ops.ts";
import { SERVER_RECHECK_NODES, serverScoreAt, warmEngine, type EngineEnv } from "./engine.ts";

export { Lobby } from "./lobby-do.ts";
export { Matchmaker } from "./matchmaker.ts";
export { EngineServer } from "./engine.ts";
export { LiveHub } from "./live-hub.ts";

export interface Env extends AccountEnv, EngineEnv, AdminEnv {
  LOBBIES: DurableObjectNamespace<Lobby>;
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
  async fetch(request: Request, rawEnv: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    // (The fair-play review page is the Worker's own; everything else outside /api is the app.)
    const admin = url.pathname === "/admin/fairplay" || url.pathname.startsWith("/admin/fairplay/");
    if (!url.pathname.startsWith("/api/") && !admin) return rawEnv.ASSETS.fetch(request);
    // Load-test counters (OPS_STATS set, and the matching key): see ops.ts.
    if (url.pathname === "/api/ops/stats" && rawEnv.OPS_STATS && request.headers.get("x-ops-key") === rawEnv.OPS_STATS) {
      return json(opsStats(url.searchParams.get("reset") === "1"));
    }
    const t = Date.now();
    // Rate limits (limits.ts): a friendly 429 with when to try again.
    const wait = rateLimited(
      { ip: request.headers.get("cf-connecting-ip"), session: readCookie(request, SESSION_COOKIE), play: request.method === "POST" && (url.pathname === "/api/play" || url.pathname === "/api/lobby") },
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
  },

  /**
   * The Worker's schedule (wrangler.jsonc, every 15 minutes): fair play's deep re-check of flagged players' moves on
   * the engine server (cases in review at once, the rest off-peak; fairplay-deep.ts).
   */
  async scheduled(_event: ScheduledController, rawEnv: Env, ctx: ExecutionContext): Promise<void> {
    if (!rawEnv.DB) return;
    const env = await withSecrets(rawEnv);
    const search = containerSearch(env);
    if (!search) return;
    const sql = d1Sql(rawEnv.DB);
    ctx.waitUntil(
      ensureSchema(sql, rawEnv.DB)
        .then(() => deepCheckRun(sql, search, Date.now(), { mail: caseMailer(env) }))
        .then((r) => r.searches && console.log(`fair play deep re-check: ${r.searches} searches, ${r.matches} matches done`))
        .catch((e: unknown) => console.log(`fair play deep re-check: ${String(e)}`)),
    );
  },
} satisfies ExportedHandler<Env>;

async function route(request: Request, rawEnv: Env, url: URL, waitUntil: WaitUntil): Promise<Response> {
  {
    // (The sign-in secrets may live in the Secrets Store: read them as strings.)
    const env = await withSecrets(rawEnv);
    // Fair play's review page and the automated reviewer's API (admins and the reviewer's token only).
    const review = await handleAdmin(request, env, caseMailer(env), waitUntil, containerSearch(env));
    if (review) return review;
    // Accounts: /api/me, /api/results, /api/auth/*
    const account = await handleAccountApi(request, env, fetch, waitUntil);
    if (account) return account;
    // POST /api/engine/score {fen, moves} → {moves}: the engine server's deeper look at a few moves (solo games'
    // re-checks); 503 when there's no server or today's budget is spent (the device then re-checks itself).
    if (url.pathname === "/api/engine/score" && request.method === "POST") {
      const body = (await request.json().catch(() => null)) as { fen?: unknown; moves?: unknown; boards?: unknown } | null;
      const moves = Array.isArray(body?.moves) ? body.moves.filter((m): m is string => typeof m === "string").slice(0, 8) : [];
      if (typeof body?.fen !== "string" || !moves.length) return json({ message: "Bad request" }, 400);
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
      const overrides = raid ? RAID_SETTINGS : modeSettings("crowd", { crowdTeams: true, augments: true });
      // ?pool=NAME: a queue of its own (tests run several queues at once without meeting). Split by region when
      // that's on (queue.ts). ?ticket=ID: a player in line asking again (they keep their place).
      const region = regionOf(request.cf as { continent?: unknown } | undefined);
      const name = queueName(raid ? "raid" : "crowd", type, url.searchParams.get("pool"), region);
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
    // POST /api/lobby → { code }
    if (url.pathname === "/api/lobby" && request.method === "POST") {
      const refused = await mayPlay(request, env, waitUntil);
      if (refused) return refused;
      // Playtest overrides, e.g. POST /api/lobby?rounds=2&clock=15
      const n = (k: string) => (url.searchParams.has(k) ? Math.max(1, Math.min(600, Number(url.searchParams.get(k)) || 0)) : undefined);
      const draw = url.searchParams.get("draw") as DrawRule | null;
      // The mode first (its own pace and rules), then pace and playtest overrides on top.
      const raid = url.searchParams.get("mode") === "raid";
      const mode = raid || url.searchParams.get("mode") === "crowd" ? "crowd" : "classic";
      const overrides = {
        ...(raid ? RAID_SETTINGS : modeSettings(mode, { crowdTeams: url.searchParams.get("turns") !== "all", augments: url.searchParams.get("augments") !== "0" })),
        ...(url.searchParams.get("pace") === "quick" ? (mode === "crowd" ? { revealSeconds: 2, drawnMoveSeconds: 1.2, stageBreakSeconds: 4 } : PACE_SETTINGS.quick) : {}),
        // Playtest overrides and the creator's choices: only the ones that are set.
        ...definedOnly({
          // Boss raid: the boss the creator picked (one of the tiers), else one a step above the group.
          ...(() => {
            const b = Number(url.searchParams.get("boss"));
            return raid && BOSS_TIERS.includes(b) ? { bossFixedElo: b, bossPicked: b } : {};
          })(),
          roundsPerStage: n("rounds"),
          firstStageRounds: n("rounds"),
          moveClockSeconds: n("clock"),
          finalMaxTurns: n("finalTurns"),
          bossMaxMoves: n("bossMoves"),
          drawRuleByStage: draw && DRAW_RULES.includes(draw) ? [draw] : undefined,
          // Opening moves per side on each board (0-10), chosen by the lobby's creator.
          openingMoves: mode === "classic" && url.searchParams.has("moves")
            ? Math.max(0, Math.min(MAX_OPENING_MOVES, Math.round(Number(url.searchParams.get("moves")) || 0)))
            : undefined,
        }),
        // ?format=team|boss|duel: skip the pre-game votes and play that ending (for testing).
        ...(() => {
          const f = url.searchParams.get("format") as FinalFormat | null;
          return mode === "crowd" && f && f in CROWD_KNOCKOUTS ? { finalFormat: f, knockoutsPerStage: CROWD_KNOCKOUTS[f], augments: false } : {};
        })(),
        // ?speed=normal|variable|bullet: that speed (for testing, with ?format=; a stale "slow" is Normal).
        ...(mode === "crowd" ? (speedOption(url.searchParams.get("speed"))?.patch ?? {}) : {}),
      };
      // ?keep=SECONDS: its results stay up this long (5 s up to the usual 15 minutes), for tests.
      const keep = url.searchParams.has("keep") ? Math.max(5, Math.min(LOBBY_LIFE.lobbyResultsKeepMinutes * 60, Number(url.searchParams.get("keep")) || 0)) * 1000 : undefined;
      const plain = JSON.parse(JSON.stringify(overrides));
      const code = await openLobbyCode(async (c) => (await env.LOBBIES.get(env.LOBBIES.idFromName(c)).create(c, plain, undefined, keep)) !== false);
      return code ? json({ code }) : json({ message: "Couldn't create a lobby. Try again." }, 500);
    }
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
