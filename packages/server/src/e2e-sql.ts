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

/**
 * `GET /api/e2e/sw.js?key=…&version=brc-…` (Nov 15): the app's service worker as the next deploy's would be, for town.spec's "a deploy
 * landed, the service worker in charge": its version `version`, none of this version's files under /assets/ (a new version's have new
 * names), and the server without this version's code (its network refuses every script and style under /assets/; a picture keeps its
 * name, so its place on the server, until it changes). The test registers it in /sw.js's
 * place, as an update would. (The browser fetches a worker's script itself, past the tests' routes and without their headers: so the
 * key is in the query.) The same locks as the SQL route: only the e2e's local server, only with its key.
 */
export async function e2eWorker(url: URL, env: E2eSqlEnv & { ASSETS?: Fetcher }): Promise<Response | null> {
  if (url.pathname !== "/api/e2e/sw.js" || !env.ASSETS || !e2eSqlAllowed(env.E2E_SQL, url.searchParams.get("key"))) return null;
  const version = url.searchParams.get("version") ?? "";
  if (!/^brc-[0-9a-f]{12}$/.test(version)) return Response.json({ message: "No version" }, { status: 400 });
  const sw = await (await env.ASSETS.fetch(new URL("/sw.js", url))).text();
  const files = (JSON.parse(/const FILES = (\[.*?\]);/s.exec(sw)?.[1] ?? "[]") as string[]).filter((f) => !f.startsWith("/assets/"));
  const gone =
    "const NET = fetch;\n" +
    'self.fetch = (r, o) => (/^\\/assets\\/.*\\.(js|css)$/.test(new URL(typeof r === "string" ? r : r.url, location.href).pathname) ? Promise.resolve(new Response("", { status: 404 })) : NET(r, o));\n';
  const body = gone + sw.replace(/const VERSION = "[^"]*";/, `const VERSION = "${version}";`).replace(/const FILES = \[.*?\];/s, `const FILES = ${JSON.stringify(files)};`);
  return new Response(body, { headers: { "content-type": "text/javascript; charset=utf-8", "service-worker-allowed": "/", "cache-control": "no-store" } });
}
