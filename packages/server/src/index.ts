import { DRAW_RULES, type DrawRule } from "@chessroyale/core";
import type { Lobby } from "./lobby-do.ts";

export { Lobby } from "./lobby-do.ts";

export interface Env {
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
    // POST /api/lobby → { code }
    if (url.pathname === "/api/lobby" && request.method === "POST") {
      for (let i = 0; i < 5; i++) {
        const code = randomCode();
        const stub = env.LOBBIES.get(env.LOBBIES.idFromName(code));
        if (await stub.exists()) continue;
        // Playtest overrides, e.g. POST /api/lobby?rounds=2&clock=15
        const n = (k: string) => (url.searchParams.has(k) ? Math.max(1, Math.min(600, Number(url.searchParams.get(k)) || 0)) : undefined);
        const draw = url.searchParams.get("draw") as DrawRule | null;
        const overrides = {
          roundsPerStage: n("rounds"),
          moveClockSeconds: n("clock"),
          duelClockSeconds: n("duel"),
          drawRuleByStage: draw && DRAW_RULES.includes(draw) ? [draw] : undefined,
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
