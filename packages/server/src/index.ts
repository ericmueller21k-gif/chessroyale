import { BOSS_TIERS, LOBBY_LIFE, CROWD_KNOCKOUTS, RAID_SETTINGS, DRAW_RULES, MAX_OPENING_MOVES, PACE_SETTINGS, definedOnly, modeSettings, speedOption, type DrawRule, type FinalFormat } from "@chessroyale/core";
import type { Lobby } from "./lobby-do.ts";
import type { Matchmaker } from "./matchmaker.ts";
import { openLobbyCode } from "./codes.ts";
import { MATCH_ENDED } from "./lobby.ts";
import { d1Sql, lobbyResult } from "./accounts.ts";
import { SIGN_IN_TO_PLAY, accountOf, handleAccountApi, isSignedIn, signInRequired, withSecrets, type AccountEnv } from "./api.ts";
import { SERVER_RECHECK_NODES, serverScoreAt, warmEngine, type EngineEnv } from "./engine.ts";

export { Lobby } from "./lobby-do.ts";
export { Matchmaker } from "./matchmaker.ts";
export { EngineServer } from "./engine.ts";

export interface Env extends AccountEnv, EngineEnv {
  LOBBIES: DurableObjectNamespace<Lobby>;
  MATCHMAKER: DurableObjectNamespace<Matchmaker>;
  ASSETS: Fetcher;
  /** Seconds a matchmade lobby waits for players before bots fill it (default 60; shorter for local tests). */
  MATCH_FILL_SECONDS?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export default {
  async fetch(request: Request, rawEnv: Env): Promise<Response> {
    const url = new URL(request.url);
    // (The sign-in secrets may live in the Secrets Store: read them as strings.)
    const env = url.pathname.startsWith("/api/") ? await withSecrets(rawEnv) : rawEnv;
    // Accounts: /api/me, /api/results, /api/auth/*
    const account = await handleAccountApi(request, env);
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
    // POST /api/play[?mode=raid] → { code }: "Play now", the queue: the 50 v 50 lobby that's filling up (bots fill
    // the rest at the fill time), or a boss raid's (no bots; the boss matches the group). Unranked.
    if (url.pathname === "/api/play" && request.method === "POST") {
      if (env.DB && signInRequired(env) && !isSignedIn(await accountOf(request, env))) return json({ message: SIGN_IN_TO_PLAY }, 401);
      const fill = Math.max(3, Math.min(600, Number(env.MATCH_FILL_SECONDS ?? 60) || 60));
      const raid = url.searchParams.get("mode") === "raid";
      const overrides = raid ? RAID_SETTINGS : modeSettings("crowd", { crowdTeams: true, augments: true });
      // ?pool=NAME: a queue of its own (tests run several queues at once without meeting).
      const pool = url.searchParams.get("pool");
      const name = `${raid ? "raid" : "crowd"}-unranked${pool && /^[a-z0-9-]{1,24}$/.test(pool) ? `-${pool}` : ""}`;
      const mm = env.MATCHMAKER.get(env.MATCHMAKER.idFromName(name));
      try {
        return json(await mm.next(JSON.parse(JSON.stringify(overrides)), fill * 1000));
      } catch {
        return json({ message: "Couldn't find a match. Try again." }, 500);
      }
    }
    // POST /api/lobby → { code }
    if (url.pathname === "/api/lobby" && request.method === "POST") {
      if (env.DB && signInRequired(env) && !isSignedIn(await accountOf(request, env))) return json({ message: SIGN_IN_TO_PLAY }, 401);
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
      const code = await openLobbyCode((c) => env.LOBBIES.get(env.LOBBIES.idFromName(c)).create(c, plain, undefined, keep));
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
        const me = await accountOf(request, env).catch(() => null);
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
    if (url.pathname.startsWith("/api/")) return json({ message: "Not found" }, 404);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
