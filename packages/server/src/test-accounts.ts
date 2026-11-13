/**
 * Test accounts (Eric, Nov 10: "if that requires you to make accounts for them, then that's fine ... you can just put dummy
 * emails in"; docs/decisions/2026-11-10-cheater-demo.md): named accounts with no real email, for scripts that play the live game
 * as people do (scripts/cheater-demo.ts). Admins only: an admin's session (from the site itself), a script through Cloudflare Access
 * with the one service token `TEST_ACCOUNTS_CLIENT_ID` names (unset or empty: no token gets in, whatever Access fronts; it's cleared
 * before launch: ROADMAP.md), or the e2e's local key (`x-e2e-sql`, never set outside its server). Anyone else: "Not found".
 *
 *   POST   /api/admin/test-accounts {name}  → makes the account (or finds it); a script (the token or the e2e's key) is signed in as
 *                                            it (the session cookie), an admin isn't (their own browser stays theirs)
 *   GET    /api/admin/test-accounts         → every test account, its fair-play case and its matches' numbers
 *   DELETE /api/admin/test-accounts         → deletes every test account as any account is deleted (account-data.ts: its results
 *                                            and 1 v 1 games stay in the game's numbers re-keyed to the deleted id, its ledger rows
 *                                            kept), and fair play's file on it too
 *
 * A test account: the email `<name>@test.hunchess` (no such domain: no mail, no sign-in by code) and `users.test` = 1. It plays as
 * anyone does, with normal play's rewards and nothing granted. Public rankings leave it out (`users.test`: the "Top N%" in
 * accounts.ts, 1 v 1's top places in ranked-schema.ts), and its reports never put anyone in review (fairplay.ts, reviewIfReported).
 * Only a test account is ever signed in to here: an address on a real account is refused.
 */
import { cleanName, createSession, d1Sql, ensureSchema, getUser, userFromToken, type Sql, type User } from "./accounts.ts";
import { viaAccess, type AccessEnv } from "./access.ts";
import { isAdmin, type AdminEnv } from "./admin.ts";
import { SESSION_COOKIE, readCookie, sessionCookie } from "./api.ts";
import { banAnswer } from "./ban-gate.ts";
import { deleteAccount } from "./account-data.ts";
import { caseOf } from "./fairplay.ts";
import { e2eSqlAllowed, type E2eSqlEnv } from "./e2e-sql.ts";

export type TestAccountsEnv = AdminEnv &
  AccessEnv &
  E2eSqlEnv & {
    /**
     * The switch for scripts through Access: the one service token's client ID (its JWT's `common_name`) the route takes. Unset or
     * empty, no token gets in (an admin's session and the e2e's key still do). A client ID is an identifier, not a secret
     * (wrangler.jsonc's `vars`); `OPS_ACCESS_CLIENT_ID`, the health view's pin, has no say here.
     */
    TEST_ACCOUNTS_CLIENT_ID?: string;
  };

/** Checks Access's token for the route, with `env.OPS_ACCESS_CLIENT_ID` set to the one client ID it may carry (viaAccess). */
type AccessCheck = (request: Request, env: AccessEnv) => Promise<boolean>;

/** The test accounts' email domain: not a real one, so nothing is ever sent and no code sign-in can reach them. */
export const TEST_DOMAIN = "test.hunchess";

/** A test account's email from its name: "Engine Eddie" → engine-eddie@test.hunchess (null: no letters or digits in it). */
export function testEmail(name: string): string | null {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug ? `${slug}@${TEST_DOMAIN}` : null;
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });
const notFound = () => json({ message: "Not found" }, 404);

/**
 * Who's asking, if they may: "access" (through Access with the service token `TEST_ACCOUNTS_CLIENT_ID` names, while it's set), "e2e"
 * (the local e2e's key), "admin:<email>" (an admin's session; a change only from the site itself: the origin is checked); null for
 * anyone else.
 */
async function caller(request: Request, env: TestAccountsEnv, sql: Sql, now: number, access: AccessCheck): Promise<string | null> {
  // (The route's own switch, not Access's setup: a token Access issued for another path, the health view's at launch, carries a valid
  // signature and audience too. The PR #622 review, finding 1.)
  const client = env.TEST_ACCOUNTS_CLIENT_ID?.trim();
  if (client && (await access(request, { ...env, OPS_ACCESS_CLIENT_ID: client }))) return "access";
  if (e2eSqlAllowed(env.E2E_SQL, request.headers.get("x-e2e-sql"))) return "e2e";
  const user = await userFromToken(sql, readCookie(request, SESSION_COOKIE), now);
  if (!isAdmin(env, user)) return null;
  if (request.method !== "GET" && request.headers.get("origin") !== new URL(request.url).origin) return null;
  return `admin:${user!.email!.toLowerCase()}`;
}

/** Makes the named test account, or finds it. Refused (null) for a name with no usable address, or an address a real account has. */
export async function testAccount(sql: Sql, name: unknown, now: number): Promise<{ user: User; created: boolean } | { error: string; status: number }> {
  const clean = cleanName(name);
  const email = clean ? testEmail(clean) : null;
  if (!clean || !email) return { error: "a name is required (letters or digits, at most 16 characters)", status: 400 };
  const found = await sql.first<{ id: string; test: number | null }>("SELECT id, test FROM users WHERE email = ?", email);
  if (found && found.test !== 1) return { error: "that address belongs to an account that isn't a test account", status: 409 };
  if (found) return { user: (await getUser(sql, found.id))!, created: false };
  const id = `test-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  // (One statement: two scripts making the same name at once make one account; the second finds it.)
  await sql.run("INSERT INTO users (id, name, email, created_at, last_seen, test) VALUES (?, ?, ?, ?, ?, 1) ON CONFLICT (email) DO NOTHING", id, clean, email, now, now);
  const made = await sql.first<{ id: string; test: number | null }>("SELECT id, test FROM users WHERE email = ?", email);
  if (!made || made.test !== 1) return { error: "that address belongs to an account that isn't a test account", status: 409 };
  return { user: (await getUser(sql, made.id))!, created: made.id === id };
}

/** Every test account, with its fair-play case, the case's log and each match's numbers (oldest first). */
export async function testAccountsReport(sql: Sql) {
  const users = await sql.all<{ id: string; name: string; email: string; created_at: number }>("SELECT id, name, email, created_at FROM users WHERE test = 1 ORDER BY created_at, id");
  const out = [];
  for (const u of users) {
    const c = await sql.first<{ status: string; reason: string | null; opened_at: number; decided_at: number | null; decided_by: string | null }>(
      "SELECT status, reason, opened_at, decided_at, decided_by FROM fairplay_cases WHERE user_id = ?",
      u.id,
    );
    const log = await sql.all<{ at: number; action: string; by: string; reason: string | null }>("SELECT at, action, by, reason FROM fairplay_log WHERE user_id = ? ORDER BY at, id", u.id);
    const rows = await sql.all<{ lobby: string | null; mode: string; played_at: number; counted: number; perf: number | null; score: number; level: string; summary: string; deep_done: number | null; deep_queued: number | null }>(
      "SELECT lobby, mode, played_at, counted, perf, score, level, summary, deep_done, deep_queued FROM fairplay_matches WHERE user_id = ? ORDER BY played_at, id",
      u.id,
    );
    const matches = rows.map((r) => {
      let s: Record<string, unknown> = {};
      try {
        s = JSON.parse(r.summary) as Record<string, unknown>;
      } catch {
        // (A summary that won't read: the row's own columns still say enough.)
      }
      const pick = (k: string) => (typeof s[k] === "number" ? (s[k] as number) : null);
      return {
        lobby: r.lobby,
        mode: r.mode,
        playedAt: r.played_at,
        moves: pick("moves"),
        counted: r.counted,
        perf: r.perf,
        found: pick("found"),
        evidence: pick("evidence"),
        deepChecked: pick("deepChecked") ?? 0,
        deepMatch: pick("deepMatch") ?? 0,
        // (Its very best alone; null on a summary from before the near-best count, Nov 11.)
        deepExact: pick("deepExact"),
        deepDone: r.deep_done === 1,
        deepQueued: r.deep_queued === 1,
        score: r.score,
        level: r.level,
      };
    });
    const results = await sql.all<{ played_at: number; placement: number; players: number; team_won: number | null }>(
      "SELECT played_at, placement, players, team_won FROM results WHERE user_id = ? AND online = 1 ORDER BY played_at, id",
      u.id,
    );
    out.push({ ...u, case: c ?? null, log, matches, results });
  }
  return out;
}

/**
 * Deletes every test account as any account is deleted (account-data.ts: results re-keyed to the deleted id, ledger rows kept), fair
 * play's file included (a test account's case is never evidence).
 */
export async function deleteTestAccounts(sql: Sql, now: number): Promise<number> {
  const ids = await sql.all<{ id: string }>("SELECT id FROM users WHERE test = 1");
  for (const { id } of ids) {
    const user = await getUser(sql, id);
    if (user) await deleteAccount(sql, user, now, { purgeFairPlay: true });
  }
  return ids.length;
}

/** The routes (null: not one of them). */
export async function handleTestAccounts(
  request: Request,
  env: TestAccountsEnv,
  opts: { now?: number; fetcher?: typeof fetch; access?: AccessCheck } = {},
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/admin/test-accounts") return null;
  if (!env.DB) return notFound();
  const sql = d1Sql(env.DB);
  await ensureSchema(sql, env.DB);
  const now = opts.now ?? Date.now();
  const who = await caller(request, env, sql, now, opts.access ?? ((r, e) => viaAccess(r, e, now, opts.fetcher)));
  if (!who) return notFound();
  if (request.method === "GET") return json({ accounts: await testAccountsReport(sql) });
  if (request.method === "DELETE") {
    const deleted = await deleteTestAccounts(sql, now);
    console.log(`test accounts: ${deleted} deleted by ${who}`);
    return json({ deleted });
  }
  if (request.method === "POST") {
    const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
    const r = await testAccount(sql, body?.name, now);
    if ("error" in r) return json({ message: r.error }, r.status);
    if (r.created) console.log(`test account ${r.user.id} (${r.user.name}) made by ${who}`);
    const answer = { id: r.user.id, name: r.user.name, email: r.user.email, created: r.created };
    // (An admin on the site isn't signed in as it: that would sign them out of their own account in that browser. The review, minor 1.)
    if (who.startsWith("admin:")) return json(answer);
    // (A ban means you can't sign in, here too (Eric, Nov 13): a banned test account gets the ban answer, no session. ban-gate.ts.)
    if ((await caseOf(sql, r.user.id))?.status === "banned") return banAnswer(sql, readCookie(request, SESSION_COOKIE), r.user.id);
    return json(answer, 200, { "set-cookie": sessionCookie(await createSession(sql, r.user.id, now)) });
  }
  return json({ message: "GET, POST or DELETE" }, 405);
}
