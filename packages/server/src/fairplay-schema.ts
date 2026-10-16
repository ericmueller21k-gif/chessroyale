/**
 * Fair play's tables in D1 (made with the rest of the schema in accounts.ts; see fairplay.ts for what they hold), and
 * the statements that move a guest's file to the account it signs in to. Nothing from the server's own files at run
 * time, so accounts.ts can include it without a cycle.
 */
import { FAIRPLAY } from "@chessroyale/core";
import type { Stmt } from "./accounts.ts";

// A banned (or deleted in review) account's sign-in identities (hashed: a normalized email, a Google id), so a new
// account made with the same one is banned too (or goes to review). Each owner has its own row, so clearing one
// account forgets only its rows while another's ban with the same identity still catches it
// (docs/decisions/2026-10-16-integrity-followups.md).
const IDENTITIES = `CREATE TABLE IF NOT EXISTS fairplay_identities (
    kind TEXT NOT NULL,
    hash TEXT NOT NULL,
    user_id TEXT NOT NULL,
    at INTEGER NOT NULL,
    PRIMARY KEY (kind, hash, user_id)
  )`;

/**
 * Until Oct 16, 2026 fairplay_identities was keyed by the identity alone (one owner each): a table from then is rebuilt
 * once with the owner in its key, its rows kept, in one batch (ensureSchema, accounts.ts).
 */
export const IDENTITIES_REKEY: Stmt[] = [
  "ALTER TABLE fairplay_identities RENAME TO fairplay_identities_old",
  IDENTITIES,
  "INSERT INTO fairplay_identities (kind, hash, user_id, at) SELECT kind, hash, user_id, at FROM fairplay_identities_old",
  "DROP TABLE fairplay_identities_old",
].map((sql) => ({ sql, params: [] }));

export const FAIRPLAY_SCHEMA = [
  // One row per player with a fair-play case: watched, in review, banned or cleared, and who decided what last.
  `CREATE TABLE IF NOT EXISTS fairplay_cases (
    user_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    reason TEXT,
    opened_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    decided_at INTEGER,
    decided_by TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS fairplay_cases_status ON fairplay_cases (status, updated_at)`,
  // Every change to a case, with who made it and why (detection, reports, an admin, the automated reviewer).
  `CREATE TABLE IF NOT EXISTS fairplay_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    at INTEGER NOT NULL,
    action TEXT NOT NULL,
    by TEXT NOT NULL,
    reason TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS fairplay_log_user ON fairplay_log (user_id, at)`,
  `CREATE INDEX IF NOT EXISTS reports_target ON reports (target, at)`,
  // One row per player per online match: the match's fair-play signals and score (core/fairplay.ts), kept as the
  // player's history; `moves` (every judged pick, as JSON) is evidence, kept until `keep_until` (see fairplay.ts).
  `CREATE TABLE IF NOT EXISTS fairplay_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    lobby TEXT,
    mode TEXT NOT NULL,
    played_at INTEGER NOT NULL,
    counted INTEGER NOT NULL,
    perf INTEGER,
    score REAL NOT NULL,
    level TEXT NOT NULL,
    summary TEXT NOT NULL,
    moves TEXT,
    keep_until INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS fairplay_matches_user ON fairplay_matches (user_id, played_at)`,
  `CREATE INDEX IF NOT EXISTS fairplay_matches_keep ON fairplay_matches (keep_until)`,
  IDENTITIES,
  // A coarse device marker (a random id in a cookie, no fingerprinting): which accounts played online from it.
  `CREATE TABLE IF NOT EXISTS fairplay_devices (
    device TEXT NOT NULL,
    user_id TEXT NOT NULL,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    PRIMARY KEY (device, user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS fairplay_devices_user ON fairplay_devices (user_id)`,
  // Appeals against a ban, for a person (never the automated reviewer) to decide.
  `CREATE TABLE IF NOT EXISTS fairplay_appeals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    at INTEGER NOT NULL,
    text TEXT NOT NULL,
    status TEXT NOT NULL,
    decided_at INTEGER,
    decided_by TEXT,
    reply TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS fairplay_appeals_status ON fairplay_appeals (status, at)`,
  // The deep re-check's daily budget (fairplay-deep.ts): searches made each day.
  `CREATE TABLE IF NOT EXISTS fairplay_budget (
    day TEXT PRIMARY KEY,
    searches INTEGER NOT NULL
  )`,
];

const DAY = 86_400_000;
/** A case's status as a strength, in SQL, to keep the stricter of two: banned, review, watch, then the rest. */
const strength = (status: string) => `CASE ${status} WHEN 'banned' THEN 3 WHEN 'review' THEN 2 WHEN 'watch' THEN 1 ELSE 0 END`;

/**
 * A guest's fair-play file joins the account it signs in to: the statements, for the sign-in's one batch, run once the
 * guest's results are the account's and before its rating is worked out again. So signing in never sheds a case
 * (docs/decisions/2026-10-16-integrity-followups.md):
 *   - the guest's case, if open or a ban, takes over the account's when it's stricter, with a line in the log saying
 *     so. A guest's decision never becomes the account's: the account keeps its own decision (decided_at, decided_by)
 *     and opening date, or has none, unless a ban comes in, as when a case of its own is raised. What a person weighed
 *     stays weighed, and nothing the guest went through sets aside the account's evidence. A guest's cleared or closed
 *     case doesn't move;
 *   - the guest's log joins the account's with each action marked "guest …" ("guest cleared"): readable as the
 *     guest's, and never the account's own clearing (banCheck's line);
 *   - the guest's judged matches, appeals, device markers and reports (made and about it) become the account's; a
 *     report between the two goes (it's the same person), and so does the guest's open appeal when the account has one
 *     open (one at a time: the account's case is the one kept);
 *   - then what setCase does as a case opens: a guest's open case keeps the account's evidence the full time and queues
 *     it for the deep re-check; the account in review or banned has its online results of the last holdBackDays held,
 *     banned all of them, and a ban keeps its sign-in identities (`identities`, hashed: identityHashes).
 * A guest has no identities of its own (it has no email or Google account), so fair play keeps none for it.
 */
export function fairPlayMoves(from: string, to: string, now: number, identities: readonly [string, string][]): Stmt[] {
  const s = (sql: string, ...params: unknown[]): Stmt => ({ sql, params });
  const hasCase = (id: "?1" | "?2", statuses: string) => `EXISTS (SELECT 1 FROM fairplay_cases WHERE user_id = ${id} AND status IN (${statuses}))`;
  return [
    s(
      `INSERT INTO fairplay_log (user_id, at, action, by, reason) SELECT ?1, ?3, 'merged', 'sign-in',
         'a guest account with a ' || status || ' case signed in to this account; its records moved here' FROM fairplay_cases WHERE user_id = ?2`,
      to,
      from,
      now,
    ),
    s(
      `INSERT INTO fairplay_cases (user_id, status, reason, opened_at, updated_at, decided_at, decided_by)
       SELECT ?1, status, reason, opened_at, updated_at, CASE WHEN status = 'banned' THEN decided_at END, CASE WHEN status = 'banned' THEN decided_by END
       FROM fairplay_cases WHERE user_id = ?2 AND status IN ('watch', 'review', 'banned')
       ON CONFLICT (user_id) DO UPDATE SET status = excluded.status, reason = excluded.reason, updated_at = MAX(updated_at, excluded.updated_at),
         decided_at = CASE WHEN excluded.status = 'banned' THEN excluded.decided_at ELSE decided_at END,
         decided_by = CASE WHEN excluded.status = 'banned' THEN excluded.decided_by ELSE decided_by END
       WHERE ${strength("excluded.status")} > ${strength("fairplay_cases.status")}`,
      to,
      from,
    ),
    s("DELETE FROM fairplay_appeals WHERE user_id = ?2 AND status = 'open' AND EXISTS (SELECT 1 FROM fairplay_appeals WHERE user_id = ?1 AND status = 'open')", to, from),
    s("UPDATE fairplay_log SET user_id = ?1, action = 'guest ' || action WHERE user_id = ?2", to, from),
    ...["fairplay_matches", "fairplay_appeals"].map((t) => s(`UPDATE ${t} SET user_id = ?1 WHERE user_id = ?2`, to, from)),
    s("INSERT OR IGNORE INTO fairplay_devices (device, user_id, first_seen, last_seen) SELECT device, ?1, first_seen, last_seen FROM fairplay_devices WHERE user_id = ?2", to, from),
    s("DELETE FROM fairplay_devices WHERE user_id = ?", from),
    s("UPDATE reports SET reporter = ?1 WHERE reporter = ?2", to, from),
    s("UPDATE reports SET target = ?1 WHERE target = ?2", to, from),
    s("DELETE FROM reports WHERE reporter = ?1 AND target = ?1", to),
    s(
      `UPDATE fairplay_matches SET keep_until = MAX(COALESCE(keep_until, 0), ?3), deep_queued = CASE WHEN deep_done = 1 THEN deep_queued ELSE 1 END
       WHERE user_id = ?1 AND moves IS NOT NULL AND ${hasCase("?2", "'watch', 'review', 'banned'")}`,
      to,
      from,
      now + FAIRPLAY.evidenceDays * DAY,
    ),
    s("DELETE FROM fairplay_cases WHERE user_id = ?", from),
    s(
      `UPDATE results SET held = 1 WHERE user_id = ?1 AND online = 1
         AND ((played_at >= ?2 AND ${hasCase("?1", "'review', 'banned'")}) OR ${hasCase("?1", "'banned'")})`,
      to,
      now - FAIRPLAY.holdBackDays * DAY,
    ),
    ...identities.map(([kind, hash]) =>
      s(`INSERT OR IGNORE INTO fairplay_identities (kind, hash, user_id, at) SELECT ?2, ?3, ?1, ?4 WHERE ${hasCase("?1", "'banned'")}`, to, kind, hash, now),
    ),
  ];
}
