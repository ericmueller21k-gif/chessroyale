/**
 * The e2e tests' way to write to (or read) the local database (Nov 10): `POST /api/e2e/sql` with `{ sql }` (or one statement and its `params`) runs it on the server's
 * own D1 and answers `{ rows }` (the last statement's). Before, the tests ran `wrangler d1 execute --local` beside the running server:
 * two processes on one SQLite file, and while the test's held the lock, a player's request on the server failed with SQLITE_BUSY
 * (a 500 on `GET /api/me` in an unrelated test: main run 42769640391, colosseum.spec.ts). One writer, the server, ends that.
 *
 * Only where `E2E_SQL` is set to a key of 32 characters or more, and the request carries that key (`x-e2e-sql`): playwright.config.ts
 * makes a new random key each run and gives it to its local server on the command line; nothing else sets it (never in wrangler.jsonc,
 * so never production or staging). Two locks, because `keep_vars` would keep a var set in the dashboard across deploys, and this route
 * reads and writes the whole database: such a var would still need the key. Anywhere else the route doesn't exist.
 */
export interface E2eSqlEnv {
  /** The e2e's local server only (playwright.config.ts): a random key of 32+ characters; `POST /api/e2e/sql` with it runs SQL. Never set in wrangler.jsonc. */
  E2E_SQL?: string;
  DB?: D1Database;
}

/** The route is on: a key of 32+ characters is set, and the request carries exactly it. */
export const e2eSqlAllowed = (key: string | undefined, sent: string | null): boolean => !!key && key.length >= 32 && sent === key;

/** The route's answer, or null where it doesn't apply (any other path, or not the e2e's local server). */
export async function e2eSql(request: Request, url: URL, env: E2eSqlEnv): Promise<Response | null> {
  if (url.pathname !== "/api/e2e/sql" || !env.DB || !e2eSqlAllowed(env.E2E_SQL, request.headers.get("x-e2e-sql"))) return null;
  if (request.method !== "POST") return Response.json({ message: "POST only" }, { status: 405 });
  const body = (await request.json().catch(() => null)) as { sql?: unknown; params?: unknown } | null;
  if (typeof body?.sql !== "string" || !body.sql.trim()) return Response.json({ message: "No sql" }, { status: 400 });
  // (With `params`: one statement, its ? bound to them.)
  if (Array.isArray(body.params)) return Response.json({ rows: (await env.DB.prepare(body.sql).bind(...body.params).all()).results });
  // (Each statement on its own, in order, as `wrangler d1 execute --command` ran them; the last one's rows answered.)
  const statements = body.sql.split(/;\s*(?=(?:[^']*'[^']*')*[^']*$)/).map((s) => s.trim()).filter(Boolean);
  const results = await env.DB.batch(statements.map((s) => env.DB!.prepare(s)));
  return Response.json({ rows: results.at(-1)?.results ?? [] });
}
