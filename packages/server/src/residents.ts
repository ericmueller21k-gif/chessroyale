/**
 * Residents (Eric, Nov 25: "literally have 200 bots made which just sit on the server and play ranked, play 50v50 ... we need to
 * simulate a small soft launch"; the design: `notes/residents-design.md` on claude/director-notes; docs/decisions/2026-11-25-residents-server.md):
 * real accounts (`users.resident` = 1) a program outside the game's servers plays as people do, through the same routes and sockets.
 * Unlike test accounts they count everywhere a player counts (the "Top N%", 1 v 1's top places, name search), because Eric wants to
 * see them there. Fair play records their signals but never opens a case for one (fairplay.ts); the engine server is never woken for
 * a lobby of residents alone (lobby.ts residentsOnly); a lobby's host is a real person whenever one is connected (lobby.ts pickHost).
 *
 *   POST /api/admin/residents {name, look?}  → makes the resident (or finds it) and signs the program in as it (the session cookie);
 *                                               an admin is answered without being signed in (their own browser stays theirs)
 *   GET  /api/admin/residents                → every resident, today's numbers, fair play's "would have" counts, the last heartbeat
 *   POST /api/admin/residents/beat {…}       → the program's heartbeat (its own numbers), kept in D1 `meta` (the latest only)
 *
 * Callers: an admin's session (from the site itself), the e2e's local key, or a script through Cloudflare Access with the service token
 * `RESIDENTS_CLIENT_ID` names (the residents' own: the always-on host, residents-host.ts), or the one `TEST_ACCOUNTS_CLIENT_ID` names
 * (the director's own runs, kept on purpose). Anyone else: "Not found". The POSTs are refused while the kill switch `PAUSE_RESIDENTS` is on (503, `RESIDENTS_PAUSED`).
 */

import { CRATES, rollCrate, tierItems, type CrateDef, type Rng } from "@chessroyale/core";
import { cleanName, createSession, d1Sql, ensureSchema, getUser, sha256, updateProfile, userFromToken, type Sql, type User } from "./accounts.ts";
import { viaAccess, type AccessEnv } from "./access.ts";
import { isAdmin, type AdminEnv } from "./admin.ts";
import { SESSION_COOKIE, readCookie, sessionCookie } from "./api.ts";
import { banAnswer } from "./ban-gate.ts";
import { caseOf } from "./fairplay.ts";
import { e2eSqlAllowed, type E2eSqlEnv } from "./e2e-sql.ts";
import { RESIDENTS_PAUSED, residentsPaused } from "./kill-switches.ts";
import { hostPlan, type HostPlan, type ResidentsHostEnv } from "./residents-host.ts";
import { applyOp, keyFor, leg, ledgerAccount } from "./ledger.ts";
import { openingRng } from "./locker.ts";

export { RESIDENTS_PAUSED };

/** POST /api/admin/residents: make the resident named `name` (or find it), and sign in as it. */
export interface ResidentRequest {
  /** Its name (through cleanName and the name filter, at most 16 characters); its email is `<slug>@resident.hunchess`. */
  name: string;
  /** Only when it's made (ignored for one that exists): its default pawn color and its icon (one of the free emoji icons, or a drawn one). */
  look?: { pawn?: "white" | "black"; icon?: string };
}

/**
 * The answer to POST /api/admin/residents. For the token's and the e2e key's callers it carries the session cookie (`hc_session`) in
 * `Set-Cookie`, unless the request already carried a live session of this resident (`reused`: kept, no new cookie). Every new session
 * ends the resident's others, so restarts never pile up session rows.
 */
export interface ResidentAnswer {
  id: string;
  name: string;
  email: string;
  /** Made by this call (false: it existed). */
  created: boolean;
  /** The common locker items it was given when it was made (their defs; [] for one that existed, or none drawn). */
  seeded: string[];
  /** The request's own session of this resident was live and is kept (no Set-Cookie). Absent for an admin. */
  reused?: boolean;
}

/** POST /api/admin/residents/beat: the program's heartbeat, any JSON object of its own numbers (at most BEAT_MAX_BYTES). */
export type ResidentBeat = Record<string, unknown>;

/** The answer to POST /api/admin/residents/beat. */
export interface ResidentBeatAnswer {
  ok: true;
  at: number;
}

/** What detection would have done about a resident's match, had it been anyone's (fairplay.ts): stored as `fairplay_matches.would`. */
export type WouldHave = "watch" | "review" | "pool" | "ban";

/** One resident in GET /api/admin/residents. */
export interface ResidentRow {
  id: string;
  name: string;
  createdAt: number;
  lastSeen: number | null;
  /** Its ranking rating (users.rating), and its 1 v 1 rating (ranked_1v1), or null. */
  rating: number | null;
  duelRating: number | null;
  /** Online results today (UTC), every mode. */
  gamesToday: number;
}

/** The answer to GET /api/admin/residents. */
export interface ResidentsReport {
  /** PAUSE_RESIDENTS is on. */
  paused: boolean;
  /** What the 15-minute cron does about the always-on host (residents-host.ts hostPlan), from the Worker's variables. */
  host: HostPlan;
  /** The program's last heartbeat: when it came, who sent it ("access", "e2e", "admin:<email>"), and what it said. */
  beat: { at: number; by: string; beat: ResidentBeat } | null;
  today: {
    /** Midnight UTC, today. */
    since: number;
    /** Online results of residents today, by mode ("crowd", "1v1", …). */
    results: Record<string, number>;
    /** Residents with a result today. */
    players: number;
    /** Ranked 1 v 1 games ended today with a resident in them, and of those, games against a real person. */
    duels: number;
    duelsWithPeople: number;
  };
  /** Fair play over residents' kept matches: how many were recorded, and what detection would have done (never done for a resident). */
  fairPlay: { matches: number; would: Record<WouldHave, number> };
  residents: ResidentRow[];
}


/** The heartbeat's largest body: the program's counts, errors by kind and judge times fit in a few kilobytes. */
export const BEAT_MAX_BYTES = 16_384;
/** Where the latest heartbeat is kept (D1 `meta`). */
export const BEAT_KEY = "residents:beat";
/** The residents' email domain: not a real one, so nothing is ever sent and no code sign-in can reach them. */
export const RESIDENT_DOMAIN = "resident.hunchess";
/** How many common locker items a new resident is given, at most (0 to this many, evenly). */
export const SEED_MAX = 3;

export type ResidentsEnv = AdminEnv &
  AccessEnv &
  E2eSqlEnv & {
    /**
     * The residents program's service token: its client ID (its JWT's `common_name`). Unset or empty, no token gets in through it
     * (wrangler.jsonc `vars`: an identifier, not a secret). Emptied at launch, with the token deleted (ROADMAP.md).
     */
    RESIDENTS_CLIENT_ID?: string;
    /** The test accounts' token (test-accounts.ts), taken here too: the director's own runs of the program, from its sessions. */
    TEST_ACCOUNTS_CLIENT_ID?: string;
    /** The kill switch (kill-switches.ts residentsPaused): "1" refuses the POSTs here, and every resident everywhere. */
    PAUSE_RESIDENTS?: string;
  };

/** Checks Access's token for the route, with `env.OPS_ACCESS_CLIENT_ID` set to the one client ID it may carry (viaAccess). */
type AccessCheck = (request: Request, env: AccessEnv) => Promise<boolean>;

/** A resident's email from its name: "Mossy Bishop" → mossy-bishop@resident.hunchess (null: no letters or digits in it). */
export function residentEmail(name: string): string | null {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug ? `${slug}@${RESIDENT_DOMAIN}` : null;
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });
const notFound = () => json({ message: "Not found" }, 404);
/** The refusal while PAUSE_RESIDENTS is on: 503, as a resting part's (kill-switches.ts pausedResponse), naming "residents". */
export const residentsPausedResponse = () => json({ message: RESIDENTS_PAUSED, paused: "residents" }, 503);

/**
 * Who's asking, if they may: "access" (through Access with the service token `RESIDENTS_CLIENT_ID` names, or the one
 * `TEST_ACCOUNTS_CLIENT_ID` names, while set), "e2e" (the local e2e's key), "admin:<email>" (an admin's session; a change only from
 * the site itself: the origin is checked); null for anyone else.
 */
async function caller(request: Request, env: ResidentsEnv, sql: Sql, now: number, access: AccessCheck): Promise<string | null> {
  // (Each token by its own client ID: a token Access issued for another path carries a valid signature and audience too. test-accounts.ts.)
  const clients = [...new Set([env.RESIDENTS_CLIENT_ID?.trim(), env.TEST_ACCOUNTS_CLIENT_ID?.trim()])].filter((c): c is string => !!c);
  for (const client of clients) if (await access(request, { ...env, OPS_ACCESS_CLIENT_ID: client })) return "access";
  if (e2eSqlAllowed(env.E2E_SQL, request.headers.get("x-e2e-sql"))) return "e2e";
  const user = await userFromToken(sql, readCookie(request, SESSION_COOKIE), now);
  if (!isAdmin(env, user)) return null;
  if (request.method !== "GET" && request.headers.get("origin") !== new URL(request.url).origin) return null;
  return `admin:${user!.email!.toLowerCase()}`;
}

/** The crates with common items, and those items' own crate (a seeded item says which crate it's from, as an opened one does). */
const SEED_CRATES: readonly CrateDef[] = CRATES.filter((c) => tierItems(c, "common").length > 0);

/**
 * 0 to SEED_MAX common locker items for a new resident, rolled as a crate's common box rolls them (its item evenly, its color by the
 * usual odds, its purity on the usual curve): one ledger op, `resident-seed:<ledger id>`, so it applies once however often it's tried.
 * The items' defs (none: []).
 */
export async function seedLocker(sql: Sql, userId: string, now: number, rng: Rng = openingRng()): Promise<string[]> {
  const n = Math.min(SEED_MAX, Math.floor(rng() * (SEED_MAX + 1)));
  if (!n || !SEED_CRATES.length) return [];
  const me = await ledgerAccount(sql, userId);
  if (!me) return [];
  const rolls = Array.from({ length: n }, () => {
    const crate = SEED_CRATES[Math.min(SEED_CRATES.length - 1, Math.floor(rng() * SEED_CRATES.length))]!;
    // (The crate's common box alone: rollCrate's own draw of an item, color and purity, never Fischer Random.)
    const roll = rollCrate(rng, { ...crate, strip: [{ tier: "common", weight: 1 }], fischer: [] });
    const id = [...crypto.getRandomValues(new Uint8Array(9))].map((b) => b.toString(16).padStart(2, "0")).join("");
    return { crate: crate.id, item: { ...roll, id } };
  });
  const done = await applyOp(sql, me, {
    id: keyFor((a) => `resident-seed:${a}`, me),
    reason: "resident seed",
    now,
    legs: rolls.map((r) => leg.item(userId, r.item, r.crate, now)),
  });
  return done === "applied" ? rolls.map((r) => r.item.def) : [];
}

/**
 * Makes the named resident, or finds it. Refused for a name with no usable address, one the name filter refuses, or an address a
 * non-resident account has. A new one gets `look` (its pawn color and icon, as PATCH /api/me checks them) and its seeded items.
 */
export async function residentAccount(
  sql: Sql,
  name: unknown,
  look: unknown,
  now: number,
  rng?: Rng,
): Promise<{ user: User; created: boolean; seeded: string[] } | { error: string; status: number }> {
  const clean = cleanName(name);
  const email = clean ? residentEmail(clean) : null;
  if (!clean || !email) return { error: "a name is required (letters or digits, at most 16 characters, and one the name filter allows)", status: 400 };
  const found = await sql.first<{ id: string; resident: number | null }>("SELECT id, resident FROM users WHERE email = ?", email);
  if (found && found.resident !== 1) return { error: "that address belongs to an account that isn't a resident", status: 409 };
  if (found) return { user: (await getUser(sql, found.id))!, created: false, seeded: [] };
  const id = `res-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  // (One statement: two calls making the same name at once make one account; the second finds it.)
  await sql.run("INSERT INTO users (id, name, email, created_at, last_seen, resident) VALUES (?, ?, ?, ?, ?, 1) ON CONFLICT (email) DO NOTHING", id, clean, email, now, now);
  const made = await sql.first<{ id: string; resident: number | null }>("SELECT id, resident FROM users WHERE email = ?", email);
  if (!made || made.resident !== 1) return { error: "that address belongs to an account that isn't a resident", status: 409 };
  if (made.id !== id) return { user: (await getUser(sql, made.id))!, created: false, seeded: [] };
  const l = look && typeof look === "object" ? (look as { pawn?: unknown; icon?: unknown }) : {};
  const user = l.pawn !== undefined || l.icon !== undefined ? await updateProfile(sql, id, { pawn: l.pawn, icon: l.icon }) : (await getUser(sql, id))!;
  const seeded = await seedLocker(sql, id, now, rng);
  return { user, created: true, seeded };
}

/**
 * Signs the program in as `user`: the request's own session when it's this resident's and live (kept: null), else a new one (its
 * token), every other session of the resident ended, so a restart that lost its cookies never piles up session rows. Sessions are
 * stored only as hashes, so the program's cookie is the only way to reuse one.
 */
export async function residentSession(sql: Sql, request: Request, userId: string, now: number): Promise<string | null> {
  const token = readCookie(request, SESSION_COOKIE);
  const hash = token ? await sha256(token) : null;
  const s = hash ? await sql.first<{ user_id: string; expires_at: number }>("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?", hash) : null;
  if (s && s.user_id === userId && s.expires_at >= now) return null;
  const fresh = await createSession(sql, userId, now);
  await sql.run("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?", userId, await sha256(fresh));
  return fresh;
}

const DAY = 86_400_000;
const RESIDENTS = "SELECT id FROM users WHERE resident = 1";

/** GET's answer: every resident, today's numbers, fair play's "would have" counts and the program's last heartbeat. */
export async function residentsReport(sql: Sql, env: object, now: number): Promise<ResidentsReport> {
  const since = Math.floor(now / DAY) * DAY;
  const [users, perUser, byMode, duels, fairCount, would, beat] = await Promise.all([
    sql.all<{ id: string; name: string; created_at: number; last_seen: number | null; rating: number | null; duel: number | null }>(
      "SELECT u.id, u.name, u.created_at, u.last_seen, u.rating, r.rating AS duel FROM users u LEFT JOIN ranked_1v1 r ON r.user_id = u.id WHERE u.resident = 1 ORDER BY u.name COLLATE NOCASE, u.id",
    ),
    sql.all<{ user_id: string; n: number }>(`SELECT user_id, COUNT(*) AS n FROM results WHERE online = 1 AND played_at >= ? AND user_id IN (${RESIDENTS}) GROUP BY user_id`, since),
    sql.all<{ mode: string; n: number }>(`SELECT mode, COUNT(*) AS n FROM results WHERE online = 1 AND played_at >= ? AND user_id IN (${RESIDENTS}) GROUP BY mode`, since),
    sql.first<{ n: number; people: number | null }>(
      `SELECT COUNT(*) AS n, SUM(CASE WHEN w.resident IS 1 AND b.resident IS 1 THEN 0 ELSE 1 END) AS people
       FROM ranked_1v1_games g LEFT JOIN users w ON w.id = g.white_id LEFT JOIN users b ON b.id = g.black_id
       WHERE g.ended_at >= ? AND (w.resident = 1 OR b.resident = 1)`,
      since,
    ),
    sql.first<{ n: number }>(`SELECT COUNT(*) AS n FROM fairplay_matches WHERE user_id IN (${RESIDENTS})`),
    sql.all<{ would: string; n: number }>(`SELECT would, COUNT(*) AS n FROM fairplay_matches WHERE would IS NOT NULL AND user_id IN (${RESIDENTS}) GROUP BY would`),
    sql.first<{ value: string }>("SELECT value FROM meta WHERE key = ?", BEAT_KEY),
  ]);
  const games = new Map(perUser.map((r) => [r.user_id, r.n]));
  const wouldHave: Record<WouldHave, number> = { watch: 0, review: 0, pool: 0, ban: 0 };
  for (const w of would) if (Object.hasOwn(wouldHave, w.would)) wouldHave[w.would as WouldHave] = w.n;
  let last: ResidentsReport["beat"] = null;
  try {
    last = beat ? (JSON.parse(beat.value) as ResidentsReport["beat"]) : null;
  } catch {
    // (A kept beat that won't read: none.)
  }
  return {
    paused: residentsPaused(env),
    host: hostPlan(env as ResidentsHostEnv),
    beat: last,
    today: {
      since,
      results: Object.fromEntries(byMode.map((r) => [r.mode, r.n])),
      players: perUser.length,
      duels: duels?.n ?? 0,
      duelsWithPeople: duels?.people ?? 0,
    },
    fairPlay: { matches: fairCount?.n ?? 0, would: wouldHave },
    residents: users.map((u) => ({ id: u.id, name: u.name, createdAt: u.created_at, lastSeen: u.last_seen, rating: u.rating, duelRating: u.duel, gamesToday: games.get(u.id) ?? 0 })),
  };
}

/** POST /beat: the program's numbers, kept as the latest (one row in `meta`). Refused: not a JSON object, or over BEAT_MAX_BYTES. */
export async function keepBeat(sql: Sql, text: string, by: string, now: number): Promise<{ ok: true; at: number } | { error: string; status: number }> {
  if (new TextEncoder().encode(text).length > BEAT_MAX_BYTES) return { error: `a heartbeat is at most ${BEAT_MAX_BYTES} bytes`, status: 413 };
  let beat: unknown;
  try {
    beat = JSON.parse(text);
  } catch {
    beat = null;
  }
  if (!beat || typeof beat !== "object" || Array.isArray(beat)) return { error: "a heartbeat is a JSON object", status: 400 };
  await sql.run(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
    BEAT_KEY,
    JSON.stringify({ at: now, by, beat }),
  );
  return { ok: true, at: now };
}

/** The routes (null: not one of them). */
export async function handleResidents(
  request: Request,
  env: ResidentsEnv,
  opts: { now?: number; fetcher?: typeof fetch; access?: AccessCheck; rng?: Rng } = {},
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/admin/residents" && url.pathname !== "/api/admin/residents/beat") return null;
  if (!env.DB) return notFound();
  const sql = d1Sql(env.DB);
  await ensureSchema(sql, env.DB);
  const now = opts.now ?? Date.now();
  const who = await caller(request, env, sql, now, opts.access ?? ((r, e) => viaAccess(r, e, now, opts.fetcher)));
  if (!who) return notFound();
  const beat = url.pathname.endsWith("/beat");
  if (request.method === "GET" && !beat) return json(await residentsReport(sql, env, now));
  if (request.method !== "POST") return json({ message: beat ? "POST" : "GET or POST" }, 405);
  // (The kill switch: nothing new while it's on. The report still answers, so the dashboard shows the switch.)
  if (residentsPaused(env)) return residentsPausedResponse();
  if (beat) {
    // (Too big by its own word: refused before the body is read.)
    if (Number(request.headers.get("content-length") ?? 0) > BEAT_MAX_BYTES) return json({ message: `a heartbeat is at most ${BEAT_MAX_BYTES} bytes` }, 413);
    const r = await keepBeat(sql, await request.text(), who, now);
    return "error" in r ? json({ message: r.error }, r.status) : json(r satisfies ResidentBeatAnswer);
  }
  const body = (await request.json().catch(() => null)) as { name?: unknown; look?: unknown } | null;
  const r = await residentAccount(sql, body?.name, body?.look, now, opts.rng);
  if ("error" in r) return json({ message: r.error }, r.status);
  if (r.created) console.log(`resident ${r.user.id} (${r.user.name}) made by ${who}, ${r.seeded.length} items`);
  const answer: ResidentAnswer = { id: r.user.id, name: r.user.name, email: r.user.email!, created: r.created, seeded: r.seeded };
  // (An admin on the site isn't signed in as it: that would sign them out of their own account in that browser.)
  if (who.startsWith("admin:")) return json(answer);
  // (A ban means you can't sign in, here too (Eric, Nov 13): a banned resident gets the ban answer, no session. ban-gate.ts.)
  if ((await caseOf(sql, r.user.id))?.status === "banned") return banAnswer(sql, readCookie(request, SESSION_COOKIE), r.user.id);
  const token = await residentSession(sql, request, r.user.id, now);
  if (!token) return json({ ...answer, reused: true });
  return json({ ...answer, reused: false }, 200, { "set-cookie": sessionCookie(token) });
}

/**
 * This instance's answers to "is this session a resident's?", only asked while PAUSE_RESIDENTS is on (kept RESIDENT_CHECK_MS), keyed
 * by the token's hash (as sessions are stored), never the token itself.
 */
const RESIDENT_CHECK_MS = 60_000;
const RESIDENT_CHECKS_MAX = 10_000;
const residentChecks = new Map<string, { resident: boolean; until: number }>();

/** Whether this session token is a live resident session (cached RESIDENT_CHECK_MS per instance; a read that fails: no). */
export async function residentSessionOf(sql: Sql, token: string, now: number): Promise<boolean> {
  const hash = await sha256(token);
  const hit = residentChecks.get(hash);
  if (hit && hit.until > now) return hit.resident;
  const s = await sql
    .first<{ resident: number | null; expires_at: number }>("SELECT u.resident, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?", hash)
    .catch(() => null);
  const resident = !!s && s.resident === 1 && s.expires_at >= now;
  if (residentChecks.size >= RESIDENT_CHECKS_MAX) residentChecks.delete(residentChecks.keys().next().value!);
  residentChecks.set(hash, { resident, until: now + RESIDENT_CHECK_MS });
  return resident;
}

/**
 * The residents' gate (index.ts, beside the ban gate, before every `/api/*` route, the rooms' WebSockets included): while
 * PAUSE_RESIDENTS is on, a request with a resident's session gets 503 "Residents are paused." and nothing else. Off (always, but for a
 * pause): nothing read at all.
 */
export async function residentGate(env: object & { DB?: D1Database }, request: Request, now: number): Promise<Response | null> {
  if (!residentsPaused(env) || !env.DB) return null;
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const sql = d1Sql(env.DB);
  await ensureSchema(sql, env.DB).catch(() => undefined);
  return (await residentSessionOf(sql, token, now)) ? residentsPausedResponse() : null;
}
