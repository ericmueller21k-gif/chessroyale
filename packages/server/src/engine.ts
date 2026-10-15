import { Container, getContainer } from "@cloudflare/containers";
import { recheckCloseCalls, stockfishRefuses, type EngineLike, type MoveScore, type RecheckSettings } from "@chessroyale/chess";

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

/** When this instance last wrote the engine server's last answer and last failure (meta "engine.ok", "engine.fail"). */
const marked = { ok: 0, fail: 0 };

/**
 * The health view's "last success" and "last failure" (ops-admin.ts): times in D1's `meta`, written at most once a
 * minute (a success) or every 10 s (a failure) per instance, so a busy server costs a write a minute. Never throws.
 */
export async function markEngine(env: EngineEnv, ok: boolean, why = ""): Promise<void> {
  const now = Date.now();
  if (!env.DB || now - marked[ok ? "ok" : "fail"] < (ok ? 60_000 : 10_000)) return;
  marked[ok ? "ok" : "fail"] = now;
  try {
    await env.DB.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value")
      .bind(ok ? "engine.ok" : "engine.fail", ok ? String(now) : JSON.stringify({ at: now, why }))
      .run();
  } catch {
    // (The health view just shows an older time.)
  }
}

/**
 * The one way into the engine server's searches: `serverScoreAt` (every match's re-checks, the judges' verdicts, Squads'
 * bot work, `/api/engine/score`) and fair play's deep re-check (`fairplay-engine.ts`) all search through here. A
 * position Stockfish refuses (`stockfishRefuses`) is never sent: Stockfish ends its process on one, and the container
 * goes down with it until it restarts, taking every lobby's re-checks along. It's "no answer" instead (null), which
 * every caller already handles (DECISIONS.md, "The engine server never gets a position Stockfish refuses", Oct 15).
 */
export async function containerScore(env: EngineEnv, instance: string, fen: string, moves: readonly string[], nodes: number, timeoutMs: number): Promise<MoveScore[] | null> {
  if (!engineOn(env) || !moves.length) return null;
  const refused = stockfishRefuses(fen);
  if (refused) {
    console.log(`engine server: not sent, a position Stockfish refuses (${refused}): ${fen}`);
    return null;
  }
  try {
    const stub = getContainer(env.ENGINE!, instance);
    const res = await Promise.race([
      stub.fetch("http://engine/score", { method: "POST", body: JSON.stringify({ fen, moves: [...new Set(moves)], nodes }) }),
      new Promise<null>((r) => setTimeout(() => r(null), timeoutMs)),
    ]);
    if (!res || !res.ok) {
      await markEngine(env, false, res ? `answered ${res.status}` : "no answer in time");
      return null;
    }
    const body = (await res.json()) as { moves?: MoveScore[] };
    await markEngine(env, Array.isArray(body.moves), "an answer without moves");
    return Array.isArray(body.moves) ? body.moves : null;
  } catch (e) {
    await markEngine(env, false, String(e).slice(0, 120));
    return null;
  }
}

/** The engine server today, for the health view: searches used of the day's budget, its last answer and last failure. */
export async function engineHealth(env: EngineEnv, now: number): Promise<{ on: boolean; searches: number; cap: number; lastOk: number | null; lastFail: { at: number; why: string } | null }> {
  const day = new Date(now).toISOString().slice(0, 10);
  const read = async <T>(sql: string, ...params: unknown[]) => (env.DB ? await env.DB.prepare(sql).bind(...params).first<T>().catch(() => null) : null);
  const used = await read<{ searches: number }>("SELECT searches FROM engine_usage WHERE day = ?", day);
  const ok = await read<{ value: string }>("SELECT value FROM meta WHERE key = 'engine.ok'");
  const fail = await read<{ value: string }>("SELECT value FROM meta WHERE key = 'engine.fail'");
  let lastFail: { at: number; why: string } | null = null;
  try {
    lastFail = fail ? (JSON.parse(fail.value) as { at: number; why: string }) : null;
  } catch {
    // An unreadable mark: none.
  }
  return { on: engineOn(env), searches: used?.searches ?? 0, cap: Number(env.ENGINE_DAILY_SEARCHES ?? 3000), lastOk: ok ? Number(ok.value) : null, lastFail };
}

/** One restricted search on the engine server; null if there's no server, no budget left, or no answer in time. */
export async function serverScoreAt(env: EngineEnv, fen: string, moves: readonly string[], nodes = SERVER_RECHECK_NODES): Promise<MoveScore[] | null> {
  if (!engineOn(env) || !moves.length) return null;
  if (!(await takeBudget(env))) return null;
  return containerScore(env, "engine-1", fen, moves, nodes, TIMEOUT_MS);
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
  priority: readonly string[] = [],
): Promise<{ bestMove: string; bestExpected: number; expectedAfter: Record<string, number> }> {
  const nodes = Math.max(400_000, Math.round(SERVER_RECHECK_NODES / Math.max(1, boards)));
  try {
    const out = await recheckCloseCalls(serverEngine(env, nodes), fen, evaluation, picks, { ...settings, recheckNodes: nodes }, priority);
    return { bestMove: out.bestMove, bestExpected: out.bestExpected, expectedAfter: out.expectedAfter };
  } catch {
    return evaluation;
  }
}
