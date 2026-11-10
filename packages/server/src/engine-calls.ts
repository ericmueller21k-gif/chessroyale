import { ENGINE_SERVER } from "@chessroyale/core";
import type { Sql } from "./accounts.ts";

/**
 * The engine server's per-account cap (ENGINE_SERVER.perAccountDaily; the outside review of Nov 10, finding 4): each account's calls
 * to /api/engine/score and /api/engine/ping, counted per UTC day in D1, so one account (or a script) can't spend the server's day.
 * Kept apart from engine.ts, which loads the container library, so the schema can sit with the others (accounts.ts). A day's
 * counts are deleted once the day is over. (Only types come from accounts.ts: it imports this file's schema while it loads.)
 */
export const ENGINE_CALLS_SCHEMA = [
  // One row per account and UTC day ("2026-11-10"): its calls to the engine server's open routes that day.
  `CREATE TABLE IF NOT EXISTS engine_calls (
    user_id TEXT NOT NULL,
    day TEXT NOT NULL,
    n INTEGER NOT NULL,
    PRIMARY KEY (user_id, day)
  )`,
];

/** A time's UTC day, as the engine's budgets count it. */
export const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);

let purgedAt = 0;

/** Counts one call of this account's today: false once it's past ENGINE_SERVER.perAccountDaily (or the count fails). */
export async function takeEngineCall(sql: Sql, userId: string, now: number): Promise<boolean> {
  try {
    const day = utcDay(now);
    const row = await sql.first<{ n: number }>(
      "INSERT INTO engine_calls (user_id, day, n) VALUES (?, ?, 1) ON CONFLICT (user_id, day) DO UPDATE SET n = n + 1 RETURNING n",
      userId,
      day,
    );
    // (Past days' counts go, at most every 10 minutes per instance.)
    if (now - purgedAt > 10 * 60_000) {
      purgedAt = now;
      await sql.run("DELETE FROM engine_calls WHERE day < ?", day);
    }
    return !!row && row.n <= ENGINE_SERVER.perAccountDaily;
  } catch {
    return false;
  }
}
