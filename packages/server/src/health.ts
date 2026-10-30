/**
 * The health view (docs/areas/ops.md, "Health"): one snapshot of the game for an admin or a script
 * (`GET /api/admin/health`, and the top of `/admin/ops`). What's deployed, who's playing (Squads included), errors
 * this hour, last hour and today by fingerprint, the Durable Objects' errors, the town's WebGL fallbacks by reason, players'
 * reports, the engine server's and fair play's budgets, and a quick D1 check. Reads only: a handful of D1 reads and one
 * call to the live hub.
 */
import { FAIRPLAY, TOWN_GL_FALLBACK, type TownGlFallback } from "@chessroyale/core";
import type { Sql } from "./accounts.ts";
import { engineHealth, type EngineEnv } from "./engine.ts";
import { liveHub } from "./live-hub.ts";
import type { LiveHealth } from "./live.ts";
import type { Env } from "./index.ts";
import type { ProblemsEnv } from "./problems.ts";

const HOUR = 3_600_000;
const hourOf = (t: number) => Math.floor(t / HOUR) * HOUR;

export interface HealthError {
  fingerprint: string;
  source: string;
  kind: string;
  message: string;
  thisHour: number;
  lastHour: number;
  day: number;
  lastSeen: number;
  versions: string;
}

export interface Health {
  at: number;
  /** The deployed build (the app's version.json): its version, commit and when it was built. */
  deploy: { version: string; commit: string | null; built: string | null };
  /** The live hub's numbers (null without one, or if it didn't answer). */
  live: LiveHealth | null;
  /**
   * Errors by the hour (rows are per clock hour): this hour so far, the hour before, and the last 24 hours; how many
   * kinds; the top 10 by this hour, then the last, then the day.
   */
  errors: { thisHour: number; lastHour: number; day: number; kinds: number; top: HealthError[] };
  /**
   * The town's WebGL fallbacks: page loads whose town asked for WebGL and drew with Canvas 2D (TOWN_GL_FALLBACK: each page
   * reports one, as an error of that kind with its reason as the message), in the last 24 hours and 7 days (by the hour,
   * as the errors), in all and by reason. Not errors, so not in `errors`; a reason that isn't one of ours isn't counted.
   */
  townFallbacks: { day: number; week: number; byReason: Record<TownGlFallback, { day: number; week: number }> };
  /** The Durable Objects' own errors in the last 24 hours, by class, then by entry point (`Class.method`). */
  durableObjects: { thisHour: number; lastHour: number; day: number; byClass: Record<string, number>; byEntry: Record<string, number> };
  /** Players' reports in the last 24 hours, by kind, and the latest 5 (their note cut to 200 characters). */
  reports: { day: Record<string, number>; latest: { id: string; kind: string; at: number; note: string }[] };
  /** The engine server: searches used of today's budget (UTC day), its last answer and last failure. */
  engine: Awaited<ReturnType<typeof engineHealth>>;
  /** Fair play's deep re-checks: searches used of today's budget. */
  fairplay: { searches: number; cap: number };
  /** One timed D1 read. */
  d1: { ok: boolean; ms: number; error?: string };
}

/** The deployed build, from the app's own version.json (through the assets binding). */
async function deployed(env: ProblemsEnv): Promise<Health["deploy"]> {
  try {
    const v = (await (await env.ASSETS!.fetch("https://assets.local/version.json")).json()) as { version?: unknown; commit?: unknown; built?: unknown };
    return { version: typeof v.version === "string" ? v.version : "unknown", commit: typeof v.commit === "string" ? v.commit : null, built: typeof v.built === "string" ? v.built : null };
  } catch {
    return { version: "unknown", commit: null, built: null };
  }
}

/** The snapshot. `sql` over the same database as `env.DB`. */
export async function health(env: ProblemsEnv & EngineEnv & Pick<Env, "LIVE">, sql: Sql, now: number): Promise<Health> {
  const t = Date.now();
  const d1 = await sql.first<{ ok: number }>("SELECT 1 AS ok").then(
    (r) => ({ ok: r?.ok === 1, ms: Date.now() - t }),
    (e: unknown) => ({ ok: false, ms: Date.now() - t, error: String(e).slice(0, 200) }),
  );
  const thisHour = hourOf(now);
  const lastHour = thisHour - HOUR;
  const since = hourOf(now - 24 * HOUR);
  const week = hourOf(now - 7 * 24 * HOUR);
  const fallback = TOWN_GL_FALLBACK.kind;
  // (A database that doesn't answer leaves zeros: the view still says what's deployed, who's playing and D1's error.)
  const safe = <T>(p: Promise<T>, none: T) => p.catch(() => none);
  const hours = `SUM(CASE WHEN hour = ? THEN count ELSE 0 END) AS thisHour, SUM(CASE WHEN hour = ? THEN count ELSE 0 END) AS lastHour, SUM(count) AS day`;
  const [deploy, live, totals, top, entries, fallbacks, reportKinds, latest, engine, fair] = await Promise.all([
    deployed(env),
    env.LIVE ? liveHub(env).health().catch(() => null) : Promise.resolve(null),
    safe(
      sql.first<{ thisHour: number | null; lastHour: number | null; day: number | null; kinds: number }>(
        `SELECT ${hours}, COUNT(DISTINCT fingerprint) AS kinds FROM ops_errors WHERE hour >= ? AND kind != ?`,
        thisHour,
        lastHour,
        since,
        fallback,
      ),
      null,
    ),
    safe(sql.all<HealthError>(
      `SELECT fingerprint, source, kind, message, ${hours}, MAX(last_seen) AS lastSeen, GROUP_CONCAT(DISTINCT version) AS versions
       FROM ops_errors WHERE hour >= ? AND kind != ? GROUP BY fingerprint ORDER BY thisHour DESC, lastHour DESC, day DESC LIMIT 10`,
      thisHour,
      lastHour,
      since,
      fallback,
    ), []),
    // (A Durable Object's errors are kinds named Class.method: problems.ts, guardEntries.)
    safe(sql.all<{ kind: string; thisHour: number; lastHour: number; day: number }>(
      `SELECT kind, ${hours} FROM ops_errors WHERE source = 'server' AND hour >= ? AND kind LIKE '%.%' GROUP BY kind`,
      thisHour,
      lastHour,
      since,
    ), []),
    // (The town's fallbacks: the devices' own kind; its message is the reason.)
    safe(sql.all<{ reason: string; day: number; week: number }>(
      `SELECT message AS reason, SUM(CASE WHEN hour >= ? THEN count ELSE 0 END) AS day, SUM(count) AS week
       FROM ops_errors WHERE hour >= ? AND source = 'client' AND kind = ? GROUP BY message`,
      since,
      week,
      fallback,
    ), []),
    safe(sql.all<{ kind: string; n: number }>("SELECT kind, COUNT(*) AS n FROM ops_reports WHERE at > ? GROUP BY kind", now - 24 * HOUR), []),
    safe(sql.all<{ id: string; kind: string; at: number; note: string }>("SELECT id, kind, at, substr(note, 1, 200) AS note FROM ops_reports WHERE at > ? ORDER BY at DESC LIMIT 5", now - 24 * HOUR), []),
    engineHealth(env, now),
    safe(sql.first<{ searches: number }>("SELECT searches FROM fairplay_budget WHERE day = ?", new Date(now).toISOString().slice(0, 10)), null),
  ]);
  const durableObjects: Health["durableObjects"] = { thisHour: 0, lastHour: 0, day: 0, byClass: {}, byEntry: {} };
  for (const e of entries) {
    const cls = e.kind.split(".")[0]!;
    durableObjects.thisHour += e.thisHour;
    durableObjects.lastHour += e.lastHour;
    durableObjects.day += e.day;
    durableObjects.byClass[cls] = (durableObjects.byClass[cls] ?? 0) + e.day;
    durableObjects.byEntry[e.kind] = e.day;
  }
  const townFallbacks: Health["townFallbacks"] = { day: 0, week: 0, byReason: Object.fromEntries(TOWN_GL_FALLBACK.reasons.map((r) => [r, { day: 0, week: 0 }])) as Health["townFallbacks"]["byReason"] };
  for (const f of fallbacks) {
    // (Only our own reasons: anyone can send an error of any kind and message.)
    if (!(TOWN_GL_FALLBACK.reasons as readonly string[]).includes(f.reason)) continue;
    const n = townFallbacks.byReason[f.reason as TownGlFallback];
    n.day += f.day;
    n.week += f.week;
    townFallbacks.day += f.day;
    townFallbacks.week += f.week;
  }
  return {
    at: now,
    deploy,
    live,
    errors: { thisHour: totals?.thisHour ?? 0, lastHour: totals?.lastHour ?? 0, day: totals?.day ?? 0, kinds: totals?.kinds ?? 0, top },
    durableObjects,
    townFallbacks,
    reports: { day: Object.fromEntries(reportKinds.map((r) => [r.kind, r.n])), latest },
    engine,
    fairplay: { searches: fair?.searches ?? 0, cap: FAIRPLAY.deep.dailySearches },
    d1,
  };
}
