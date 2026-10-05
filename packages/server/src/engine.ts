import { Container, getContainer } from "@cloudflare/containers";
import { recheckCloseCalls, type EngineLike, type MoveScore, type RecheckSettings } from "@chessroyale/chess";

/**
 * The engine server: native Stockfish 17.1 (the full network) in a Cloudflare Container (engine/Dockerfile).
 * Phones and computers still do the routine scoring; the server re-checks the close calls that decide who's
 * cut (reports/judge-accuracy.md), with a much deeper search than any phone, and its numbers are the ones
 * used. One shared instance, asleep after 3 idle minutes. A daily budget caps the cost: past it (or with no
 * server), the players' devices' numbers stand, as before.
 */
export class EngineServer extends Container {
  defaultPort = 8080;
  sleepAfter = "3m";
}

export interface EngineEnv {
  ENGINE?: DurableObjectNamespace<EngineServer>;
  DB?: D1Database;
  /** Re-checks a day before the server stops (default 3000: well under $1 a day). */
  ENGINE_DAILY_SEARCHES?: string;
  /** "1": no engine server (local runs without its container, e.g. the e2e suite). */
  ENGINE_OFF?: string;
}

const engineOn = (env: EngineEnv) => !!env.ENGINE && env.ENGINE_OFF !== "1";

/** The server's re-check budget per search (about 3 s on one core, depth ~30). */
export const SERVER_RECHECK_NODES = 2_000_000;
const TIMEOUT_MS = 12_000;

let tableReady = false;

/** Counts one search against today's budget; false once it's spent (or if counting fails). */
async function takeBudget(env: EngineEnv): Promise<boolean> {
  if (!env.DB) return true;
  try {
    if (!tableReady) {
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS engine_usage (day TEXT PRIMARY KEY, searches INTEGER NOT NULL)").run();
      tableReady = true;
    }
    const day = new Date().toISOString().slice(0, 10);
    const row = await env.DB.prepare(
      "INSERT INTO engine_usage (day, searches) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET searches = searches + 1 RETURNING searches",
    )
      .bind(day)
      .first<{ searches: number }>();
    return (row?.searches ?? 0) <= Number(env.ENGINE_DAILY_SEARCHES ?? 3000);
  } catch {
    return false;
  }
}

/** One restricted search on the engine server; null if there's no server, no budget left, or no answer in time. */
export async function serverScoreAt(env: EngineEnv, fen: string, moves: readonly string[], nodes = SERVER_RECHECK_NODES): Promise<MoveScore[] | null> {
  if (!engineOn(env) || !moves.length) return null;
  if (!(await takeBudget(env))) return null;
  try {
    const stub = getContainer(env.ENGINE!, "engine-1");
    const res = await Promise.race([
      stub.fetch("http://engine/score", { method: "POST", body: JSON.stringify({ fen, moves: [...new Set(moves)], nodes }) }),
      new Promise<null>((r) => setTimeout(() => r(null), TIMEOUT_MS)),
    ]);
    if (!res || !res.ok) return null;
    const body = (await res.json()) as { moves?: MoveScore[] };
    return Array.isArray(body.moves) ? body.moves : null;
  } catch {
    return null;
  }
}

/** Wakes the engine server (a match is starting), so the first re-check doesn't wait for it to boot. */
export async function warmEngine(env: EngineEnv): Promise<boolean> {
  if (!engineOn(env)) return false;
  try {
    const res = await Promise.race([getContainer(env.ENGINE!, "engine-1").fetch("http://engine/ping"), new Promise<null>((r) => setTimeout(() => r(null), 20_000))]);
    return !!res?.ok;
  } catch {
    return false;
  }
}

/** The engine server as an engine for the re-check (only `scoreMovesAt`; it throws when the server can't answer). */
export function serverEngine(env: EngineEnv, nodes = SERVER_RECHECK_NODES): EngineLike {
  const unsupported = () => Promise.reject(new Error("engine server: re-check only"));
  return {
    topMoves: unsupported,
    scoreMoves: unsupported,
    scoreMovesAt: async (fen, moves) => {
      const out = await serverScoreAt(env, fen, moves, nodes);
      if (!out) throw new Error("engine server unavailable");
      return out;
    },
  };
}

/**
 * Re-checks one board's close calls on the server (the host's numbers otherwise stand). With several boards
 * (Classic) the budget per board shrinks, so the whole round still takes a few seconds.
 */
export async function serverRecheck(
  env: EngineEnv,
  fen: string,
  evaluation: { bestMove: string; bestExpected: number; expectedAfter: Record<string, number> },
  picks: readonly (string | null)[],
  settings: RecheckSettings,
  boards = 1,
): Promise<{ bestMove: string; bestExpected: number; expectedAfter: Record<string, number> }> {
  const nodes = Math.max(400_000, Math.round(SERVER_RECHECK_NODES / Math.max(1, boards)));
  try {
    const out = await recheckCloseCalls(serverEngine(env, nodes), fen, evaluation, picks, { ...settings, recheckNodes: nodes });
    return { bestMove: out.bestMove, bestExpected: out.bestExpected, expectedAfter: out.expectedAfter };
  } catch {
    return evaluation;
  }
}
