import { BOSS_TIERS, CROWD_KNOCKOUTS, RAID_SETTINGS, DRAW_RULES, MAX_OPENING_MOVES, PACE_SETTINGS, definedOnly, modeSettings, type DrawRule, type FinalFormat } from "@chessroyale/core";
import type { Lobby } from "./lobby-do.ts";
import type { Matchmaker } from "./matchmaker.ts";
import { randomCode } from "./codes.ts";
import { SIGN_IN_TO_PLAY, accountOf, handleAccountApi, isSignedIn, signInRequired, withSecrets, type AccountEnv } from "./api.ts";

export { Lobby } from "./lobby-do.ts";
export { Matchmaker } from "./matchmaker.ts";

export interface Env extends AccountEnv {
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
    // POST /api/play → { code }: "Play now", the 50 v 50 lobby that's filling up (unranked).
    if (url.pathname === "/api/play" && request.method === "POST") {
      if (env.DB && signInRequired(env) && !isSignedIn(await accountOf(request, env))) return json({ message: SIGN_IN_TO_PLAY }, 401);
      const fill = Math.max(3, Math.min(600, Number(env.MATCH_FILL_SECONDS ?? 60) || 60));
      const overrides = modeSettings("crowd", { crowdTeams: true, augments: true });
      const mm = env.MATCHMAKER.get(env.MATCHMAKER.idFromName("crowd-unranked"));
      try {
        return json(await mm.next(JSON.parse(JSON.stringify(overrides)), fill * 1000));
      } catch {
        return json({ message: "Couldn't find a match. Try again." }, 500);
      }
    }
    // POST /api/lobby → { code }
    if (url.pathname === "/api/lobby" && request.method === "POST") {
      if (env.DB && signInRequired(env) && !isSignedIn(await accountOf(request, env))) return json({ message: SIGN_IN_TO_PLAY }, 401);
      for (let i = 0; i < 5; i++) {
        const code = randomCode();
        const stub = env.LOBBIES.get(env.LOBBIES.idFromName(code));
        if (await stub.exists()) continue;
        // Playtest overrides, e.g. POST /api/lobby?rounds=2&clock=15
        const n = (k: string) => (url.searchParams.has(k) ? Math.max(1, Math.min(600, Number(url.searchParams.get(k)) || 0)) : undefined);
        const draw = url.searchParams.get("draw") as DrawRule | null;
        // The mode first (its own pace and rules), then pace and playtest overrides on top.
        const raid = url.searchParams.get("mode") === "raid";
        const mode = raid || url.searchParams.get("mode") === "crowd" ? "crowd" : "classic";
        const overrides = {
          ...(raid ? RAID_SETTINGS : modeSettings(mode, { crowdTeams: url.searchParams.get("turns") !== "all", augments: url.searchParams.get("augments") !== "0" })),
          ...(url.searchParams.get("pace") === "quick" ? (mode === "crowd" ? { revealSeconds: 2, drawnMoveSeconds: 1.2 } : PACE_SETTINGS.quick) : {}),
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
        };
        await stub.create(code, JSON.parse(JSON.stringify(overrides)));
        return json({ code });
      }
      return json({ message: "Couldn't create a lobby. Try again." }, 500);
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
