/**
 * Chat moderation's tables in D1 (made with the rest of the schema in accounts.ts; see chat-mod.ts for what they
 * hold and how long), and the shape of a reported line. No imports, so accounts.ts and the lobby (lobby.ts, which
 * the simulations load too) can include it without a cycle or the Worker's types.
 */

/**
 * A line kept with a report (a name and words, no account ids). `mark`: "this", the line reported; "sender", another
 * of that player's; "reporter", one of the reporter's; "bot", a bot's.
 */
export interface ContextLine {
  at: number;
  name: string;
  text: string;
  mark?: "this" | "sender" | "reporter" | "bot";
}

/** The line reported, as the server kept it: whose account said it, their name as shown, its words, and around it. */
export interface ReportedLine {
  target: string;
  name: string;
  text: string;
  saidAt: number;
  context: ContextLine[];
}

export const CHAT_MOD_SCHEMA = [
  // A report about one chat line: who said it (`target`, their name as shown and the line's words), where ("global" or
  // "lobby:CODE"), when it was said, the lines around it as the server kept them (JSON), who reported it and when.
  // Open until a moderator resolves it ("dismissed", or "actioned": a warning, a chat ban or a reset).
  `CREATE TABLE IF NOT EXISTS chat_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER NOT NULL,
    reporter TEXT NOT NULL,
    target TEXT NOT NULL,
    channel TEXT NOT NULL,
    said_at INTEGER NOT NULL,
    name TEXT NOT NULL,
    text TEXT NOT NULL,
    context TEXT NOT NULL,
    status TEXT NOT NULL,
    resolved_at INTEGER,
    resolved_by TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS chat_reports_target ON chat_reports (target, status, at)`,
  `CREATE INDEX IF NOT EXISTS chat_reports_reporter ON chat_reports (reporter, at)`,
  `CREATE INDEX IF NOT EXISTS chat_reports_status ON chat_reports (status, resolved_at)`,
  // Every decision about a player's chat, which is also how a pause is in force: "auto" (reports from several
  // players, until a moderator looks), "ban" (until `until`, or NULL for no end), "warn", "lift", "dismiss", "reset"
  // (name and icon back to the defaults). `ended_at`: a pause ended early (a review, a lift, a new ban). `seen`: the
  // player has seen the notice of a warning or a ban. `note`: the moderator's words to the player.
  `CREATE TABLE IF NOT EXISTS chat_mod_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    at INTEGER NOT NULL,
    action TEXT NOT NULL,
    until INTEGER,
    by TEXT NOT NULL,
    reason TEXT,
    note TEXT,
    ended_at INTEGER,
    seen INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE INDEX IF NOT EXISTS chat_mod_log_user ON chat_mod_log (user_id, at)`,
];
