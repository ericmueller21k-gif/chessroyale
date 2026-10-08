/**
 * Fair play's tables in D1 (made with the rest of the schema in accounts.ts; see fairplay.ts for what they hold).
 * No imports, so accounts.ts can include it without a cycle.
 */
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
];
