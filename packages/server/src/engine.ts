import { Container, getContainer } from "@cloudflare/containers";
import { ENGINE_SERVER } from "@chessroyale/core";
import { legalMoves, recheckCloseCalls, stockfishRefuses, type EngineLike, type MoveScore, type RecheckSettings } from "@chessroyale/chess";
import { moveGroups } from "./fairplay-deep.ts";

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

/**
 * Whose search it is: a match's (its re-checks and verdicts, Squads' bot work), a solo game's (/api/engine/score), or the Hidden
 * Boss's own moves in his phase 2 online ("recluse"). Solo's are counted twice: against their own share
 * (ENGINE_SERVER.soloDailySearches, the row "<day>:solo") and the day's budget, so however busy solo is, matches always keep the
 * rest of the day (the outside review of Nov 10, finding 4). His are never refused (they're bounded by the fights, and a refusal
 * would end a fight with no result: the review of #683, M2): each position is counted on his own row alone ("<day>:recluse", the
 * health view), never the day's budget, so the judges can't starve him and he can't starve them.
 */
export type EnginePool = "match" | "solo" | "recluse";

/** Solo's share of a day's `cap`: ENGINE_SERVER.soloDailySearches, and never more than `soloShare` of it (a lowered cap, staging). */
export const soloCap = (cap: number): number => Math.min(ENGINE_SERVER.soloDailySearches, Math.floor(cap * ENGINE_SERVER.soloShare));

/** Today's day (UTC), the key of the day's rows in engine_usage. */
const today = () => new Date().toISOString().slice(0, 10);

/** One more on a row of engine_usage (the day's budget, a share, a count): its new total. Throws if counting fails. */
async function bump(env: EngineEnv, key: string): Promise<number | null> {
  if (!tableReady) {
    await env.DB!.prepare("CREATE TABLE IF NOT EXISTS engine_usage (day TEXT PRIMARY KEY, searches INTEGER NOT NULL)").run();
    tableReady = true;
  }
  const row = await env
    .DB!.prepare("INSERT INTO engine_usage (day, searches) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET searches = searches + 1 RETURNING searches")
    .bind(key)
    .first<{ searches: number }>();
  return row?.searches ?? null;
}

/**
 * Counts one search against today's budget (and solo's share); false once it's spent (or if counting fails). His ("recluse"): on
 * his own row only, and always true (never refused, even if counting fails).
 */
async function takeBudget(env: EngineEnv, pool: EnginePool = "match"): Promise<boolean> {
  if (!env.DB) return true;
  try {
    const day = today();
    if (pool === "recluse") {
      await bump(env, `${day}:recluse`);
      return true;
    }
    const cap = Number(env.ENGINE_DAILY_SEARCHES ?? 3000);
    if (pool === "solo" && ((await bump(env, `${day}:solo`)) ?? Infinity) > soloCap(cap)) return false;
    return ((await bump(env, day)) ?? 0) <= cap;
  } catch {
    return pool === "recluse";
  }
}

/**
 * A Hidden Boss's fight ended with no result (his move never came from the engine server, phase 1 or 2): counted on today's row
 * "<day>:recluse-none", for the health view (the review of #683, M2). Never throws.
 */
export async function countRecluseNoResult(env: EngineEnv): Promise<void> {
  if (!env.DB) return;
  try {
    await bump(env, `${today()}:recluse-none`);
  } catch {
    // (The health view just shows one fewer.)
  }
}

/** When this instance last wrote the engine server's last answer and last failure (meta "engine.ok", "engine.fail"). */
const marked = { ok: 0, fail: 0 };

/**
 * The health view's "last success" and "last failure" (ops-admin.ts): times in D1's `meta`, written at most once a
 * minute (a success) or every 10 s (a failure) per instance, so a busy server costs a write a minute. Never throws.
 * Only the match engine's instance ("engine-1") is marked, never waited on (`containerScore`): best effort, so a mark
 * cut short is just an older time.
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
  // The health view's marks are the match engine's alone (fair play's instance would blur them), and never awaited.
  const mark = (ok: boolean, why: string) => {
    if (instance === "engine-1") void markEngine(env, ok, why);
  };
  try {
    const stub = getContainer(env.ENGINE!, instance);
    const res = await Promise.race([
      stub.fetch("http://engine/score", { method: "POST", body: JSON.stringify({ fen, moves: [...new Set(moves)], nodes }) }),
      new Promise<null>((r) => setTimeout(() => r(null), timeoutMs)),
    ]);
    if (!res || !res.ok) {
      mark(false, res ? `answered ${res.status}` : "no answer in time");
      return null;
    }
    const body = (await res.json()) as { moves?: MoveScore[] };
    mark(Array.isArray(body.moves), "an answer without moves");
    return Array.isArray(body.moves) ? body.moves : null;
  } catch (e) {
    mark(false, String(e).slice(0, 120));
    return null;
  }
}

/**
 * The engine server today, for the health view: searches used of the day's budget, its last answer and last failure; and the
 * Hidden Boss's fights today (`recluse`): his positions searched (his own row, outside the budget: phase 2's moves, and phase 1's no
 * device answered) and the fights that ended with no result (his move never came: the review of #683, M2), today and yesterday (UTC
 * days: the morning digest names both, the delta review of #683, m2).
 */
export async function engineHealth(
  env: EngineEnv,
  now: number,
): Promise<{ on: boolean; searches: number; cap: number; lastOk: number | null; lastFail: { at: number; why: string } | null; recluse: { searches: number; noResults: number; noResultsYesterday: number } }> {
  const day = new Date(now).toISOString().slice(0, 10);
  const yesterday = new Date(now - 86_400_000).toISOString().slice(0, 10);
  const read = async <T>(sql: string, ...params: unknown[]) => (env.DB ? await env.DB.prepare(sql).bind(...params).first<T>().catch(() => null) : null);
  const used = await read<{ searches: number }>("SELECT searches FROM engine_usage WHERE day = ?", day);
  const his = await read<{ searches: number }>("SELECT searches FROM engine_usage WHERE day = ?", `${day}:recluse`);
  const none = await read<{ searches: number }>("SELECT searches FROM engine_usage WHERE day = ?", `${day}:recluse-none`);
  const noneBefore = await read<{ searches: number }>("SELECT searches FROM engine_usage WHERE day = ?", `${yesterday}:recluse-none`);
  const ok = await read<{ value: string }>("SELECT value FROM meta WHERE key = 'engine.ok'");
  const fail = await read<{ value: string }>("SELECT value FROM meta WHERE key = 'engine.fail'");
  let lastFail: { at: number; why: string } | null = null;
  try {
    lastFail = fail ? (JSON.parse(fail.value) as { at: number; why: string }) : null;
  } catch {
    // An unreadable mark: none.
  }
  return {
    on: engineOn(env),
    searches: used?.searches ?? 0,
    cap: Number(env.ENGINE_DAILY_SEARCHES ?? 3000),
    lastOk: ok ? Number(ok.value) : null,
    lastFail,
    recluse: { searches: his?.searches ?? 0, noResults: none?.searches ?? 0, noResultsYesterday: noneBefore?.searches ?? 0 },
  };
}

/** One restricted search on the engine server; null if there's no server, no budget left, or no answer in time. `pool`: whose. */
export async function serverScoreAt(env: EngineEnv, fen: string, moves: readonly string[], nodes = SERVER_RECHECK_NODES, pool: EnginePool = "match"): Promise<MoveScore[] | null> {
  if (!engineOn(env) || !moves.length) return null;
  if (!(await takeBudget(env, pool))) return null;
  return containerScore(env, "engine-1", fen, moves, nodes, TIMEOUT_MS);
}

/**
 * Every legal move of a position scored on the engine server (the Hidden Boss's phase 2 online, bosses/recluse.ts: his moves, a
 * bot's no device played, a person's fair-play numbers): the moves in groups of at most 8 (its limit; fairplay-deep.ts moveGroups),
 * one search a group at `nodes`, one after another, the whole position counted once against `pool`'s budget (its groups together
 * search fewer nodes than one re-check; his: "recluse", never refused, so never waited on: counted beside the search, handed to
 * `background` (the Durable Object's waitUntil) to finish, the delta review of #683, m1) unless `uncounted` (a try again at a position
 * already counted: the review of #683, m2). The first group is tried twice (a container still waking answers the second: the review of
 * #677, M2). The whole try takes at most `withinMs` (from its start, every group's wait included; a group still running then is
 * left to the container, nothing more is sent), so a try's worst case is known and the caller never sends a new one while an earlier
 * one could still be running (the review of #683, M1). `instance`: the match engine's ("engine-1", his queue) or fair play's
 * ("fairplay-1": phase 2's fair-play numbers, never in his queue). Null when there's no server, no budget left, a position
 * Stockfish refuses, or any group without an answer in time.
 */
export async function serverAllMovesAt(
  env: EngineEnv,
  fen: string,
  nodes: number,
  o: { pool?: EnginePool; instance?: "engine-1" | "fairplay-1"; withinMs: number; uncounted?: boolean; background?: (p: Promise<unknown>) => void },
): Promise<MoveScore[] | null> {
  if (!engineOn(env)) return null;
  const end = Date.now() + o.withinMs;
  let legal: string[];
  try {
    legal = legalMoves(fen);
  } catch {
    return null;
  }
  if (!legal.length) return null;
  if (!o.uncounted) {
    // (His: the groups go at once, the count beside them: a slow or hung D1 never holds up his move. The others: the budget decides.)
    if (o.pool === "recluse") {
      const counting = takeBudget(env, "recluse");
      if (o.background) o.background(counting);
      else void counting.catch(() => undefined);
    } else if (!(await takeBudget(env, o.pool))) return null;
  }
  const out: MoveScore[] = [];
  for (const group of moveGroups(legal, legal[0]!)) {
    const search = () => {
      const left = end - Date.now();
      return left > 0 ? containerScore(env, o.instance ?? "engine-1", fen, group, nodes, left) : Promise.resolve(null);
    };
    const got = (await search()) ?? (out.length ? null : await search());
    if (!got) return null;
    out.push(...got);
  }
  return out;
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
