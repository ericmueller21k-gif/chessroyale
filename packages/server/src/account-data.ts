/**
 * Everything the game keeps about one account, in one place: the player's download ("Download my data", GET
 * /api/me/data) and deleting the account ("Delete account", POST /api/me/delete). See
 * docs/decisions/2026-10-15-delete-my-account-and-download-my-data.md and docs/areas/accounts.md.
 *
 * Every store that keeps something about a player has its entry in ACCOUNT_STORES: what goes in the download, and
 * what deleting the account does to it. Every other table is listed in NO_ACCOUNT_DATA, with why. **A PR that adds a
 * table puts it in one or the other** (and, if it keeps anything about a player, its line in the privacy policy,
 * screens/Legal.tsx): `account-data.test.ts` fails on a table in neither, whether it's in the schema or made anywhere
 * else in the server's code.
 *
 * Deleting removes everything personal. What stays, and why:
 *   - results, without the player: their rows are written again under the account id DELETED_ID with new ids (the old
 *     ones sat next to the same match's other rows), without their lobby code, rating, best move and eval-bar flag, and
 *     with only the day they were played, so the game's own numbers (how often each boss wins, typical placements)
 *     stay right while no row names anyone (its place among its match's rows still shows a gap: the decision file);
 *   - fair play's file on an account that's banned or in review: the case, its log, the hashed email and Google id
 *     (fairplay_identities) and the device markers, under the deleted account's random id, so deleting never gets
 *     around fair play (a new account with the same identity is banned again, or goes back to review). Everything
 *     else of fair play goes (judged moves, match summaries, appeals, reports).
 * It all happens in one batch (one transaction), so it's never half done. After it, a lobby's results, a reward and
 * fair play's recording find no account and write nothing; a few other actions in flight at that very moment (a
 * report, a friend action, a shop or locker write) can still leave a row that points at nothing (the decision file's
 * known gaps).
 */
import { DELETED_ID, identityHashes, stmt, type Sql, type Stmt, type User } from "./accounts.ts";
import { caseOf } from "./fairplay.ts";
import { socialDeletes } from "./friends.ts";
import { rankedDownload, rankedErase } from "./ranked.ts";

/** What a store's erase needs to know, worked out before the batch. */
export interface EraseContext {
  now: number;
  /** The account is banned or in review: fair play's file on it stays (with these hashed identities). */
  keepFairPlay: boolean;
  identities: [kind: string, hash: string][];
}

/** One store's part of an account: its share of the download, and what deleting the account does to it. */
export interface AccountStore {
  /** Its key in the download. */
  name: string;
  /** The tables it covers (the test checks every table is someone's, or in NO_ACCOUNT_DATA). */
  tables: readonly string[];
  /** The player's rows, for the download. */
  export(sql: Sql, user: User): Promise<unknown>;
  /** The statements that delete the player's rows, or keep what must stay (saying why above); run in one batch. */
  erase(user: User, ctx: EraseContext): Stmt[];
}

const all = (sql: Sql, q: string, ...p: unknown[]) => sql.all<Record<string, unknown>>(q, ...p);
const DAY = 86_400_000;

/** A result's columns in the download (not `held`, which would say fair play is looking at the account). */
const RESULT_COLUMNS =
  "mode, online, placement, players, team, team_won, avg_score, rating, played_at, brilliant, best_move, cuts, cuts_survived, strikes, strikes_survived, survived, last_stand, boss_elo, boss_id, lobby, ranked, eval_bar";
/** A kept result's columns (every column but its id and account: a test pins the table's columns, so a new one is seen). */
const KEPT_RESULT = "mode, online, placement, players, team, team_won, avg_score, rating, played_at, brilliant, best_move, cuts, cuts_survived, strikes, strikes_survived, survived, last_stand, boss_elo, boss_id, lobby, ranked, held, eval_bar";

export const ACCOUNT_STORES: AccountStore[] = [
  {
    name: "signInCode",
    tables: ["email_codes"],
    // The latest code sent to the account's email (never the code itself, only that one was sent).
    export: async (sql, u) => (u.email ? await sql.first("SELECT email, sent_at, expires_at, attempts FROM email_codes WHERE email = ?", u.email) : null),
    erase: (u) => (u.email ? [stmt("DELETE FROM email_codes WHERE email = ?", u.email)] : []),
  },
  {
    name: "results",
    tables: ["results"],
    export: (sql, u) => all(sql, `SELECT ${RESULT_COLUMNS} FROM results WHERE user_id = ? ORDER BY played_at, id`, u.id),
    // Kept as nobody's, written again with new ids (an old id sits between its match's other rows, which keep the
    // lobby and the time), in no order: only the day, and nothing that could find the match (the lobby, the exact time)
    // or the player (the rating).
    erase: (u) => [
      stmt(
        `INSERT INTO results (user_id, ${KEPT_RESULT})
         SELECT ?, mode, online, placement, players, team, team_won, avg_score, NULL, played_at - played_at % ${DAY}, brilliant, NULL,
           cuts, cuts_survived, strikes, strikes_survived, survived, last_stand, boss_elo, boss_id, NULL, ranked, held, NULL
         FROM results WHERE user_id = ? ORDER BY random()`,
        DELETED_ID,
        u.id,
      ),
      stmt("DELETE FROM results WHERE user_id = ?", u.id),
    ],
  },
  {
    name: "shop",
    tables: ["wallets", "inventory", "equipped", "chat_picks"],
    export: async (sql, u) => ({
      wallet: await sql.first("SELECT coins, crates FROM wallets WHERE user_id = ?", u.id),
      items: await all(sql, "SELECT item_id, acquired_at FROM inventory WHERE user_id = ?", u.id),
      equipped: await all(sql, "SELECT slot, item_id FROM equipped WHERE user_id = ?", u.id),
      chatPicks: await sql.first("SELECT lines, emoji FROM chat_picks WHERE user_id = ?", u.id),
    }),
    erase: (u) => ["wallets", "inventory", "equipped", "chat_picks"].map((t) => stmt(`DELETE FROM ${t} WHERE user_id = ?`, u.id)),
  },
  {
    name: "locker",
    tables: ["items", "equipped_items"],
    export: async (sql, u) => ({
      items: await all(sql, "SELECT id, def, color, color2, blemish, seed, crate, fischer, created_at FROM items WHERE user_id = ? ORDER BY created_at", u.id),
      equipped: await all(sql, "SELECT slot, item_id FROM equipped_items WHERE user_id = ?", u.id),
    }),
    erase: (u) => [stmt("DELETE FROM equipped_items WHERE user_id = ?", u.id), stmt("DELETE FROM items WHERE user_id = ?", u.id)],
  },
  {
    // Reports about players (fair play's sheet). The download has the ones the player made; deleting removes those
    // and the ones about them. A report of a town chat line keeps the line's text and time (`line`, `line_at`): they're
    // the reported player's words, so the reporter's download leaves them out, and they go with either account.
    name: "reports",
    tables: ["reports"],
    export: async (sql, u) => ({ made: await all(sql, "SELECT target, reason, match, at FROM reports WHERE reporter = ? ORDER BY at", u.id) }),
    erase: (u) => [stmt("DELETE FROM reports WHERE reporter = ? OR target = ?", u.id, u.id)],
  },
  {
    // Friends, requests, blocks, invites and the caps' counts (friends.ts; docs/areas/accounts.md, "Data stored by
    // friends"). The settings are on the account (users.allow_invites, hide_online). Who has blocked the player isn't
    // in the download, as the app never shows it either.
    name: "friends",
    tables: ["friends", "friend_requests", "blocks", "invites", "friend_limits"],
    export: async (sql, u) => {
      const named = (q: string) => all(sql, q, u.id);
      return {
        friends: await named("SELECT f.friend_id AS id, u.name, f.since FROM friends f LEFT JOIN users u ON u.id = f.friend_id WHERE f.user_id = ? ORDER BY f.since"),
        requestsSent: await named("SELECT r.to_id AS id, u.name, r.at FROM friend_requests r LEFT JOIN users u ON u.id = r.to_id WHERE r.from_id = ? ORDER BY r.at"),
        requestsReceived: await named("SELECT r.from_id AS id, u.name, r.at FROM friend_requests r LEFT JOIN users u ON u.id = r.from_id WHERE r.to_id = ? ORDER BY r.at"),
        blocked: await named("SELECT b.blocked_id AS id, u.name, b.at FROM blocks b LEFT JOIN users u ON u.id = b.blocked_id WHERE b.user_id = ? ORDER BY b.at"),
        invitesSent: await named("SELECT i.to_id AS id, u.name, i.kind, i.code, i.at, i.expires_at FROM invites i LEFT JOIN users u ON u.id = i.to_id WHERE i.from_id = ?"),
        invitesReceived: await named("SELECT i.from_id AS id, u.name, i.kind, i.code, i.at, i.expires_at FROM invites i LEFT JOIN users u ON u.id = i.from_id WHERE i.to_id = ?"),
        limits: await named("SELECT kind, window_start, n FROM friend_limits WHERE user_id = ?"),
      };
    },
    // Both sides: their friendships, requests, blocks and invites go from everyone's lists.
    erase: (u) => socialDeletes(u.id),
  },
  {
    // Ranked 1 v 1 (ranked.ts): the player's rank (the hidden rating too: it's theirs) and their kept games, each with
    // the opponent's name. Deleting: the rank goes, and in the games kept for a while the player becomes the shared id
    // "deleted" (the opponent's games stay theirs). Fair play's check of a game (`checked`) isn't in the download, as
    // the rest of detection's records.
    name: "ranked1v1",
    tables: ["ranked_1v1", "ranked_1v1_games"],
    export: (sql, u) => rankedDownload(sql, u.id),
    erase: (u) => rankedErase(u.id),
  },
  {
    // Error records and the feedback sheet's reports (problems.ts). A bug report carries the account (if signed in);
    // feedback and ideas carry none, so they can't be found and expire with the rest (OPS.store.keepDays). An error
    // record keeps the account inside its latest sample (JSON), so deleting takes the id out and leaves the count.
    name: "problemReports",
    tables: ["ops_reports", "ops_errors"],
    export: async (sql, u) => ({
      reports: await all(sql, "SELECT id, at, kind, version, note, diag FROM ops_reports WHERE account = ? ORDER BY at", u.id),
      errors: await all(
        sql,
        "SELECT hour, kind, message, version, last_seen, sample FROM ops_errors WHERE json_valid(sample) AND json_extract(sample, '$.account') = ? ORDER BY hour",
        u.id,
      ),
    }),
    erase: (u) => [
      stmt("DELETE FROM ops_reports WHERE account = ?", u.id),
      stmt("UPDATE ops_errors SET sample = json_set(sample, '$.account', NULL) WHERE json_valid(sample) AND json_extract(sample, '$.account') = ?", u.id),
    ],
  },
  {
    // Chat moderation (chat-mod.ts; docs/areas/chat.md, "What's stored"). The download has the decisions about the
    // player's chat as they see them: a warning or a chat ban, its end, the note to them. The moderators' reasons and
    // names are left out (a person answers a request for them). Deleting removes every decision: a chat ban is the
    // account's alone (unlike fair play's ban, it never follows an email to a new account), so nothing outlives it.
    name: "chatModeration",
    tables: ["chat_mod_log"],
    export: async (sql, u) => ({
      decisions: await all(sql, "SELECT at, action, until, note, ended_at FROM chat_mod_log WHERE user_id = ? ORDER BY at, id", u.id),
    }),
    erase: (u) => [stmt("DELETE FROM chat_mod_log WHERE user_id = ?", u.id)],
  },
  {
    // The download has what the player already sees of fair play (banned or not, their appeals and the replies). The
    // detection's own records (judged moves, scores, case notes, reports about them, device markers) are left out, as
    // they'd show how cheating is found: a person answers a request for them (the privacy policy says so).
    name: "fairPlay",
    tables: ["fairplay_cases", "fairplay_log", "fairplay_matches", "fairplay_identities", "fairplay_devices", "fairplay_appeals"],
    export: async (sql, u) => ({
      banned: (await caseOf(sql, u.id))?.status === "banned",
      appeals: await all(sql, "SELECT at, text, status, decided_at, reply FROM fairplay_appeals WHERE user_id = ? ORDER BY at", u.id),
    }),
    erase: (u, { now, keepFairPlay, identities }) => {
      const gone = [stmt("DELETE FROM fairplay_matches WHERE user_id = ?", u.id), stmt("DELETE FROM fairplay_appeals WHERE user_id = ?", u.id)];
      if (!keepFairPlay) return [...gone, ...["fairplay_cases", "fairplay_log", "fairplay_identities", "fairplay_devices"].map((t) => stmt(`DELETE FROM ${t} WHERE user_id = ?`, u.id))];
      // Banned or in review: the file outlives the account, with its identities as they are now (each in its own row;
      // a ban's are already there), so a new account made with one is caught (banCheck).
      return [
        ...gone,
        ...identities.map(([kind, hash]) => stmt("INSERT OR IGNORE INTO fairplay_identities (kind, hash, user_id, at) VALUES (?, ?, ?, ?)", kind, hash, u.id, now)),
        stmt(
          "INSERT INTO fairplay_log (user_id, at, action, by, reason) VALUES (?, ?, 'account deleted', 'player', ?)",
          u.id,
          now,
          "the player deleted their account; its case, log, hashed identities and device markers are kept",
        ),
      ];
    },
  },
];

/** Tables with nothing about any player, and why (the test checks every table is here or in ACCOUNT_STORES). */
export const NO_ACCOUNT_DATA: Record<string, string> = {
  live_lobbies: "running lobbies for the live line: codes, modes and counts",
  queue_waits: "how long the queue took: mode, time, players, wait",
  fairplay_budget: "the deep re-check's searches per day",
  engine_usage: "the engine server's searches per day (engine.ts)",
  meta: "the schema's version",
};

/** The account itself (users) and its sessions: first in the download, last to go. */
const ACCOUNT_TABLES = ["users", "sessions"] as const;
/** Every table this file covers (for the test). */
export const COVERED_TABLES = [...ACCOUNT_TABLES, ...ACCOUNT_STORES.flatMap((s) => s.tables)];

/** Times in the download as dates, not milliseconds. */
const readable = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(readable);
  if (!v || typeof v !== "object") return v;
  return Object.fromEntries(
    Object.entries(v).map(([k, x]) => [k, typeof x === "number" && /(^|_)(at|seen|until|start|since|hour)$/.test(k) && x > 1e11 ? new Date(x).toISOString() : readable(x)]),
  );
};

export const DOWNLOAD_ABOUT =
  "Everything HunChess keeps about your account, as of exportedAt. Times are UTC. Fair play's detection records (judged moves, match scores, case notes, reports about you, device markers) and chat moderators' reasons and names aren't included: email support@hunchess.com for them, and a person will answer.";

/** "Download my data": everything kept about the account, readable. `extra`: what Durable Objects hold (the live hub's). */
export async function accountDownload(sql: Sql, user: User, now: number, extra: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {
    exportedAt: new Date(now).toISOString(),
    about: DOWNLOAD_ABOUT,
    account: await sql.first("SELECT * FROM users WHERE id = ?", user.id),
    sessions: await all(sql, "SELECT created_at, expires_at FROM sessions WHERE user_id = ? ORDER BY created_at", user.id),
  };
  for (const s of ACCOUNT_STORES) out[s.name] = await s.export(sql, user);
  return readable({ ...out, ...extra }) as Record<string, unknown>;
}

/**
 * Deletes an account: every store's statements, then the account and its sessions (signed out on every device), in
 * one batch, so it's all or nothing. What stays and why: this file's header.
 */
export async function deleteAccount(sql: Sql, user: User, now: number): Promise<{ keptFairPlay: boolean }> {
  const status = (await caseOf(sql, user.id))?.status;
  const keepFairPlay = status === "banned" || status === "review";
  const ctx: EraseContext = { now, keepFairPlay, identities: keepFairPlay ? await identityHashes(user) : [] };
  await sql.batch([
    ...ACCOUNT_STORES.flatMap((s) => s.erase(user, ctx)),
    stmt("DELETE FROM users WHERE id = ?", user.id),
    stmt("DELETE FROM sessions WHERE user_id = ?", user.id),
  ]);
  return { keptFairPlay: keepFairPlay };
}
