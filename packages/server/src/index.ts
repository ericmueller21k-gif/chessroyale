import { DRAW_RULES, MAX_OPENING_MOVES, PACE_SETTINGS, modeSettings, type DrawRule } from "@chessroyale/core";
import type { Lobby } from "./lobby-do.ts";
import { handleAccountApi, type AccountEnv } from "./api.ts";

export { Lobby } from "./lobby-do.ts";

export interface Env extends AccountEnv {
  LOBBIES: DurableObjectNamespace<Lobby>;
  ASSETS: Fetcher;
}

/** Lobby codes: 5 characters with no look-alikes (no I, L, O, 0, 1). */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const randomCode = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => ALPHABET[b % ALPHABET.length]).join("");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // Accounts: /api/me, /api/results, /api/auth/*
    const account = await handleAccountApi(request, env);
    if (account) return account;
    // POST /api/lobby → { code }
    if (url.pathname === "/api/lobby" && request.method === "POST") {
      for (let i = 0; i < 5; i++) {
        const code = randomCode();
        const stub = env.LOBBIES.get(env.LOBBIES.idFromName(code));
        if (await stub.exists()) continue;
        // Playtest overrides, e.g. POST /api/lobby?rounds=2&clock=15
        const n = (k: string) => (url.searchParams.has(k) ? Math.max(1, Math.min(600, Number(url.searchParams.get(k)) || 0)) : undefined);
        const draw = url.searchParams.get("draw") as DrawRule | null;
        // The mode first (its own pace and rules), then pace and playtest overrides on top.
        const mode = url.searchParams.get("mode") === "crowd" ? "crowd" : "classic";
        const overrides = {
          ...modeSettings(mode, { crowdTeams: url.searchParams.get("turns") !== "all", augments: url.searchParams.get("augments") !== "0" }),
          ...(url.searchParams.get("pace") === "quick" ? (mode === "crowd" ? { revealSeconds: 2, drawnMoveSeconds: 1.2 } : PACE_SETTINGS.quick) : {}),
          roundsPerStage: n("rounds"),
          firstStageRounds: n("rounds"),
          moveClockSeconds: n("clock"),
          drawRuleByStage: draw && DRAW_RULES.includes(draw) ? [draw] : undefined,
          // Opening moves per side on each board (0-10), chosen by the lobby's creator.
          openingMoves: mode === "classic" && url.searchParams.has("moves")
            ? Math.max(0, Math.min(MAX_OPENING_MOVES, Math.round(Number(url.searchParams.get("moves")) || 0)))
            : undefined,
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
