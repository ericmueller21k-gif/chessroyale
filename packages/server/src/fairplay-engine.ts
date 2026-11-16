/**
 * The deep re-check's engine (fairplay-deep.ts): the engine server's container, on an instance of its own
 * ("fairplay-1"), so a match's re-checks never wait behind fair play's searches. Kept apart from fairplay-deep.ts so
 * that the rest of fair play doesn't load the container library.
 */
import { FAIRPLAY } from "@chessroyale/core";
import { containerScore, type EngineEnv } from "./engine.ts";
import type { DeepSearch } from "./fairplay-deep.ts";

const TIMEOUT_MS = 20_000;

/**
 * One deep search on fair play's engine instance (null without an engine server: local runs, the e2e suite). Through
 * the engine server's one way in (`containerScore`), so a position Stockfish refuses is never sent.
 */
export function containerSearch(env: EngineEnv): DeepSearch | null {
  if (!env.ENGINE || env.ENGINE_OFF === "1") return null;
  return async (fen, moves) => {
    const out = await containerScore(env, "fairplay-1", fen, moves, FAIRPLAY.deep.nodes, TIMEOUT_MS);
    return out?.length ? out : null;
  };
}
