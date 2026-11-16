/**
 * Chat moderation's table in D1 (made with the rest of the schema in accounts.ts; see chat-mod.ts for what it holds and
 * how long). No imports, so accounts.ts can include it without a cycle.
 */
export const CHAT_MOD_SCHEMA = [
  // Every decision about a player's chat, which is also how a chat ban is in force: "warn", "ban" (until `until`, or
  // NULL for no end), "lift", "reset" (name and icon back to the defaults), "merged" (a guest's decisions joined this
  // account). `ended_at`: a ban ended early (lifted, or replaced by a new one). `seen`: the player has seen the notice
  // of a warning or a ban. `note`: the moderator's words to the player.
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
