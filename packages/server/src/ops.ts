/**
 * Load-test counters (see scripts/load/ and DECISIONS.md, "Capacity"). Counted per isolate, in memory: D1 statements
 * (reads and writes, by table), requests by route, and Durable Object calls. GET /api/ops/stats answers with them
 * only where the OPS_STATS variable is set and the request's `x-ops-key` header matches it (locally and on staging,
 * never in production, where each isolate would only see its own share anyway).
 */

export interface OpsCounters {
  since: number;
  d1: Record<string, number>;
  d1Reads: number;
  d1Writes: number;
  routes: Record<string, { n: number; ms: number }>;
  calls: Record<string, number>;
}

const fresh = (): OpsCounters => ({ since: Date.now(), d1: {}, d1Reads: 0, d1Writes: 0, routes: {}, calls: {} });
let counters = fresh();

/** One D1 statement: its verb and table ("UPDATE users", "SELECT sessions"). Schema statements are counted apart. */
export function countD1(sql: string) {
  const s = sql.trim().replace(/\s+/g, " ");
  const verb = s.split(" ")[0]!.toUpperCase();
  const table =
    verb === "SELECT"
      ? (s.match(/\bFROM (\w+)/i)?.[1] ?? "?")
      : verb === "INSERT"
        ? (s.match(/\bINTO (\w+)/i)?.[1] ?? "?")
        : verb === "UPDATE"
          ? (s.match(/^UPDATE (\w+)/i)?.[1] ?? "?")
          : verb === "DELETE"
            ? (s.match(/\bFROM (\w+)/i)?.[1] ?? "?")
            : "schema";
  const key = `${verb} ${table}`;
  counters.d1[key] = (counters.d1[key] ?? 0) + 1;
  if (verb === "SELECT" || verb === "PRAGMA") counters.d1Reads++;
  else counters.d1Writes++;
}

export function countRoute(route: string, ms: number) {
  const r = (counters.routes[route] ??= { n: 0, ms: 0 });
  r.n++;
  r.ms += ms;
}

export function countCall(name: string, n = 1) {
  counters.calls[name] = (counters.calls[name] ?? 0) + n;
}

export function opsStats(reset = false): OpsCounters {
  const out = counters;
  if (reset) counters = fresh();
  return out;
}

/** The route a request is counted under (codes and ids folded away). */
export function routeOf(method: string, path: string): string {
  return `${method} ${path.replace(/\/api\/lobby\/[A-Z2-9]{5}/i, "/api/lobby/:code").replace(/\/api\/profile\/[^/]+/, "/api/profile/:id")}`;
}
