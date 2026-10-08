/**
 * The deep re-check's engine (fairplay-deep.ts): the engine server's container, on an instance of its own
 * ("fairplay-1"), so a match's re-checks never wait behind fair play's searches. Kept apart from fairplay-deep.ts so
 * that the rest of fair play doesn't load the container library.
 */
import { getContainer } from "@cloudflare/containers";
import { FAIRPLAY } from "@chessroyale/core";
import type { EngineEnv } from "./engine.ts";
import type { DeepSearch } from "./fairplay-deep.ts";

const TIMEOUT_MS = 20_000;

/** One deep search on fair play's engine instance (null without an engine server: local runs, the e2e suite). */
export function containerSearch(env: EngineEnv): DeepSearch | null {
  if (!env.ENGINE || env.ENGINE_OFF === "1") return null;
  return async (fen, moves) => {
    try {
      const stub = getContainer(env.ENGINE!, "fairplay-1");
      const res = await Promise.race([
        stub.fetch("http://engine/score", { method: "POST", body: JSON.stringify({ fen, moves: [...new Set(moves)], nodes: FAIRPLAY.deep.nodes }) }),
        new Promise<null>((r) => setTimeout(() => r(null), TIMEOUT_MS)),
      ]);
      if (!res || !res.ok) return null;
      const body = (await res.json()) as { moves?: { move: string; expected: number }[] };
      return Array.isArray(body.moves) && body.moves.length ? body.moves : null;
    } catch {
      return null;
    }
  };
}
