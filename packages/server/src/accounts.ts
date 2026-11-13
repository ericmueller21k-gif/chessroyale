/**
 * Accounts, sessions, profiles and match results, stored in Cloudflare D1
 * (SQLite). Everyone gets a guest account the first time they open the site;
 * signing in with Google or an emailed code attaches that identity to it, so
 * a profile follows you across devices. Written against a tiny SQL interface
 * so it can be tested with an in-memory SQLite.
 */

import { countD1 } from "./ops.ts";
import {
  BOSS_TIERS,
  bossDef,
  FRONT_DOOR,
  SHOP_CATEGORIES,
  SHOP_FREE,
  SHOP_ITEMS,
  adminShopCopies,
  chatPack,
  chatPicks,
  chatPicksAfterGetting,
  cleanChatPickList,
  cleanPawnColor,
  ownedChatPacks,
  pawnColorOf,
  type PawnColor,
  shopItem,
  starterItem,
  topPercent,
  type ChatPickKind,
  type ItemLook,
  type EquipSlot,
  type ShopState,
  type StoredChatPicks,
  levelOf,
  XP,
  type XpGrant,
} from "@chessroyale/core";
import { LOCKER_COLUMNS, LOCKER_SCHEMA, NO_ADMINS, lockerMoves, lockerState, type AdminCheck, type LockerState } from "./locker.ts";
import { BOSS_TOKENS_SCHEMA, tokenMoves } from "./boss-tokens.ts";
import { CLAW_SCHEMA } from "./claw.ts";
import { WELCOME_SCHEMA, grantWelcomeCrate } from "./welcome.ts";
import { LEDGER_SCHEMA, LEDGER_TRIGGERS, applyOp, cond, keyFor, leg, ledgerAccount, mergeMoves, type Cond, type OpKey, type Outcome } from "./ledger.ts";
import { LIVE_SCHEMA } from "./live.ts";
import { FAIRPLAY_SCHEMA, IDENTITIES_REKEY, NOT_POOLED, fairPlayMoves } from "./fairplay-schema.ts";
import { FRIENDS_COLUMNS, FRIENDS_SCHEMA, SIGNED_IN, socialDeletes } from "./friends.ts";
import type { RankedLeaves } from "@chessroyale/core";
import { RANKED_COLUMNS, RANKED_SCHEMA, rankedLeaves, rankedMoves, rankedSummary, type RankedSummary } from "./ranked-schema.ts";
import { CHAT_MOD_SCHEMA } from "./chat-mod-schema.ts";
import { XP_SCHEMA, xpColumns, xpOf } from "./xp.ts";
import { ENGINE_CALLS_SCHEMA } from "./engine-calls.ts";
import { QUESTS_COLUMNS, QUESTS_SCHEMA, questDeletes } from "./quests.ts";
import { isBlockedText } from "./text-filter.ts";
import { chatModMoves, chatStanding, type ChatNotice } from "./chat-mod.ts";
import type { ChatBlock } from "@chessroyale/chess";

export interface Sql {
  run(sql: string, ...params: unknown[]): Promise<void>;
  first<T>(sql: string, ...params: unknown[]): Promise<T | null>;
  all<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  /** Runs statements as one transaction: all of them or none (D1's batch). */
  batch(statements: readonly Stmt[]): Promise<void>;
}

/** A statement for `Sql.batch`. */
export interface Stmt {
  sql: string;
  params: unknown[];
}
export const stmt = (sql: string, ...params: unknown[]): Stmt => ({ sql, params });

/** The SQL interface over a D1 binding. */
export function d1Sql(db: D1Database): Sql {
  return {
    async run(sql, ...params) {
      countD1(sql);
      await db.prepare(sql).bind(...params).run();
    },
    async first(sql, ...params) {
      countD1(sql);
      return (await db.prepare(sql).bind(...params).first()) as never;
    },
    async all(sql, ...params) {
      countD1(sql);
      return (await db.prepare(sql).bind(...params).all()).results as never;
    },
    async batch(statements) {
      for (const s of statements) countD1(s.sql);
      if (statements.length) await db.batch(statements.map((s) => db.prepare(s.sql).bind(...s.params)));
    },
  };
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '♟',
    email TEXT UNIQUE,
    google_sub TEXT UNIQUE,
    created_at INTEGER NOT NULL,
    last_seen INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id)`,
  `CREATE TABLE IF NOT EXISTS email_codes (
    email TEXT PRIMARY KEY,
    code_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    sent_at INTEGER NOT NULL,
    hour_start INTEGER NOT NULL,
    sends_this_hour INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    online INTEGER NOT NULL,
    placement INTEGER NOT NULL,
    players INTEGER NOT NULL,
    team TEXT,
    team_won INTEGER,
    avg_score REAL,
    rating INTEGER,
    played_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS results_user ON results (user_id, played_at)`,
  // The shop: what each player owns and has equipped, and their coins.
  `CREATE TABLE IF NOT EXISTS inventory (
    user_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    acquired_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, item_id)
  )`,
  `CREATE TABLE IF NOT EXISTS equipped (
    user_id TEXT NOT NULL,
    slot TEXT NOT NULL,
    item_id TEXT NOT NULL,
    PRIMARY KEY (user_id, slot)
  )`,
  `CREATE TABLE IF NOT EXISTS wallets (
    user_id TEXT PRIMARY KEY,
    coins INTEGER NOT NULL DEFAULT 0
  )`,
  // Quick chat: the lines and emoji each player picked to see in their games (JSON lists of line ids; NULL: never
  // chosen, so the defaults in settings.ts).
  `CREATE TABLE IF NOT EXISTS chat_picks (
    user_id TEXT PRIMARY KEY,
    lines TEXT,
    emoji TEXT
  )`,
  // Crate items and what's equipped (locker.ts).
  ...LOCKER_SCHEMA,
  // Boss tokens, the drops that gave them and an open solo boss battle (boss-tokens.ts).
  ...BOSS_TOKENS_SCHEMA,
  // The Welcome Crate (Nov 6): one row per account that earned it (welcome.ts).
  ...WELCOME_SCHEMA,
  // The ledger (Nov 6): every change to a balance or an inventory, append-only (ledger.ts).
  ...LEDGER_SCHEMA,
  // Boingo's claw machine (Nov 6): one row a play (claw.ts).
  ...CLAW_SCHEMA,
  // The live line: running lobbies, queue waits (live.ts).
  ...LIVE_SCHEMA,
  // Reports about players (the profile's Report button), for a person to read.
  `CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter TEXT NOT NULL,
    target TEXT NOT NULL,
    reason TEXT NOT NULL,
    at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS reports_reporter ON reports (reporter, at)`,
  // Fair play: cases and their log (fairplay.ts).
  ...FAIRPLAY_SCHEMA,
  // Errors (the app's and the server's), one row per kind of error per hour, and the feedback sheet's reports: bugs,
  // feedback and ideas (problems.ts).
  // Nothing personal beyond a signed-in account's id: no IP addresses, emails or chat (docs/areas/ops.md).
  `CREATE TABLE IF NOT EXISTS ops_errors (
    fingerprint TEXT NOT NULL,
    hour INTEGER NOT NULL,
    source TEXT NOT NULL,
    kind TEXT NOT NULL,
    message TEXT NOT NULL,
    version TEXT NOT NULL,
    count INTEGER NOT NULL,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    sample TEXT NOT NULL,
    PRIMARY KEY (fingerprint, hour)
  )`,
  `CREATE INDEX IF NOT EXISTS ops_errors_hour ON ops_errors (hour)`,
  `CREATE TABLE IF NOT EXISTS ops_reports (
    id TEXT PRIMARY KEY,
    at INTEGER NOT NULL,
    kind TEXT NOT NULL,
    account TEXT,
    version TEXT NOT NULL,
    note TEXT NOT NULL,
    diag TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS ops_reports_at ON ops_reports (at)`,
  // Friends, requests, blocks, invites and their caps (friends.ts).
  ...FRIENDS_SCHEMA,
  // Chat moderation: the moderators' decisions about a player's chat (chat-mod.ts).
  ...CHAT_MOD_SCHEMA,
  // Ranked 1 v 1: each player's rank, and each ranked game kept for a while (ranked.ts).
  ...RANKED_SCHEMA,
  // XP (Nov 9): the solo game the server is timing for each account (xp.ts).
  ...XP_SCHEMA,
  // Quests (Nov 9, phase 3): each account's quests, each game that moved one, and the day last dealt (quests.ts).
  ...QUESTS_SCHEMA,
  // The engine server's per-account cap (Nov 10): each account's calls to its open routes today (engine-calls.ts).
  ...ENGINE_CALLS_SCHEMA,
];

/**
 * Columns added after a table first shipped: [table, column, type]. Each is added once (the table's columns are
 * read first); `then` runs right after a column is added, to fill it in from what's already stored.
 */
const COLUMNS: { table: string; column: string; type: string; then?: string[] }[] = [
  // The locker's (locker.ts): a present's second color.
  ...LOCKER_COLUMNS,
  // The profile's stats (Oct 6, 2026): recorded from then on; older results leave them empty.
  { table: "results", column: "brilliant", type: "INTEGER" },
  { table: "results", column: "best_move", type: "TEXT" },
  { table: "results", column: "cuts", type: "INTEGER" },
  { table: "results", column: "cuts_survived", type: "INTEGER" },
  { table: "results", column: "strikes", type: "INTEGER" },
  { table: "results", column: "strikes_survived", type: "INTEGER" },
  { table: "results", column: "survived", type: "INTEGER" },
  { table: "results", column: "last_stand", type: "INTEGER" },
  { table: "results", column: "boss_elo", type: "INTEGER" },
  // Which boss a boss battle met (Oct 8, 2026: bosses became identities; BOSS_ROSTER ids), with team_won its outcome:
  // each boss's win rate, for nudging its strength offset later.
  { table: "results", column: "boss_id", type: "TEXT" },
  // An online match's lobby code (Oct 7, 2026), so a closed lobby's link can offer "See your result". Never shown on a profile.
  { table: "results", column: "lobby", type: "TEXT" },
  // Whether a result counts for ranking (Oct 7, 2026): 1 ranked, 0 not (under 30% real players, solo, practice), NULL from
  // before the rule (counted as before). Ranking is the rating, its chart, "Top N%" and the rank.
  { table: "results", column: "ranked", type: "INTEGER" },
  // Fair play (Oct 8, 2026): a result held off ranking while its player is in review (1), released when cleared (0 or NULL).
  { table: "results", column: "held", type: "INTEGER" },
  // Whether the player had the eval bar on (Oct 10, 2026: Settings can switch it off): 1 on, 0 off, NULL unknown (older
  // results, older apps). To see later who turns it off and how they do.
  { table: "results", column: "eval_bar", type: "INTEGER" },
  // A result recorded because its player abandoned the match (Nov 6: gone too long, idle or removed mid-match): 1; NULL otherwise
  // (and for every result from before). The Welcome Crate's count of finished games leaves these out (welcome.ts).
  { table: "results", column: "abandoned", type: "INTEGER" },
  // A report made during a match: that match's lobby code (one report per reporter, player and match).
  { table: "reports", column: "match", type: "TEXT" },
  // A report of a line in the town square's chat (Oct 28, 2026): the line's text and when it was said, from the server's
  // room (never from the reporter), so a moderator sees what was said. Kept as the report is.
  { table: "reports", column: "line", type: "TEXT" },
  { table: "reports", column: "line_at", type: "INTEGER" },
  // Fair play's deep re-check (fairplay-deep.ts): 1 while a match waits for it, and 1 once its counted moves have all
  // been searched again.
  { table: "fairplay_matches", column: "deep_queued", type: "INTEGER" },
  { table: "fairplay_matches", column: "deep_done", type: "INTEGER" },
  // Crates earned (Squads' placement rewards, Oct 10, 2026), counted for when crates stop being free. Since Nov 9 (XP phase 2) crates
  // are held by series (ledger.ts, series_crates): a count here is turned into crates of the newest series as the locker is read
  // (rewards.ts, seriesFromWallet), and nothing adds to it any more but a guest's merge.
  { table: "wallets", column: "crates", type: "INTEGER NOT NULL DEFAULT 0" },
  // Crate keys (Nov 2, 2026: a boss crate takes one; an admin's test grant gives them): boss-tokens.ts.
  { table: "wallets", column: "crate_keys", type: "INTEGER NOT NULL DEFAULT 0" },
  // XP (Nov 9, 2026; xp.ts): each account's XP, its level worked out from it (core's levelOf). Moved only through the ledger (asset
  // kind "xp"). Every row from before starts at 0.
  { table: "wallets", column: "xp", type: "INTEGER NOT NULL DEFAULT 0" },
  // Boss crates to pick (Nov 9, 2026, XP phase 2: every 10th level's; rewards.ts): moved only through the ledger (asset kind
  // "boss_pick"). Every row from before has none.
  { table: "wallets", column: "boss_picks", type: "INTEGER NOT NULL DEFAULT 0" },
  // A game's XP (Nov 9, 2026; xp.ts): the player's time in it and their own moves (online: as the match room counted them; solo: the
  // server's clock between the game's start and its result, and the device's count of moves), and what the result screen showed: their XP before, the parts (JSON [{label, xp}]) or why none
  // ("short", "resigned", "left", "guest", "test", "banned"). NULL on every result from before (and a solo result from an app before XP).
  { table: "results", column: "play_ms", type: "INTEGER" },
  { table: "results", column: "moves", type: "INTEGER" },
  { table: "results", column: "xp_before", type: "INTEGER" },
  { table: "results", column: "xp_parts", type: "TEXT" },
  { table: "results", column: "xp_none", type: "TEXT" },
  // What the game paid beside its XP (Nov 9, 2026, XP phase 2): JSON {crate, daily, crates, keys, bossPicks, levels} (core's
  // XpRewards), for the result screen's rewards box. NULL: nothing (and every result from before).
  { table: "results", column: "xp_rewards", type: "TEXT" },
  // Each account's latest rating, for the percentile (filled in from the results already stored).
  { table: "users", column: "rating", type: "INTEGER", then: [`UPDATE users SET rating = ${LATEST_RATING("users.id")}`] },
  // Friends (Oct 15, 2026): who may invite you, hiding when you're online (friends.ts).
  ...FRIENDS_COLUMNS,
  // The default pawn color (Nov 7, 2026): "white" or "black"; NULL: white (core's pawn-color.ts). Saved by PATCH /api/me.
  { table: "users", column: "pawn_color", type: "TEXT" },
  // The age gate (Oct 16, 2026): when the account's holder said they were old enough (AGE_GATE.minAge), the first time
  // they signed in after the question. NULL: signed in before the gate, or a guest. Never the birth date
  // (docs/decisions/2026-10-16-age-gate-and-real-money.md).
  { table: "users", column: "age_ok_at", type: "INTEGER" },
  // Ranked 1 v 1's columns added after its table first shipped (to a test server).
  ...RANKED_COLUMNS,
  // The chat's opt-in (Nov 7, 2026: typed chat, off by default): 1 once the player turned chat on (after its one-time notice); NULL off.
  // Only a signed-in account's; a guest's is on its device. docs/decisions/2026-11-07-typed-chat-column.md.
  { table: "users", column: "chat_on", type: "INTEGER" },
  // Quests (Nov 10, 2026: one reroll per daily): the day a reroll dealt a quest (quests.ts).
  ...QUESTS_COLUMNS,
  // Test accounts (Nov 10, 2026; test-accounts.ts): 1 for an account an admin's script made (a dummy email at test.hunchess), left out
  // of public rankings; NULL for everyone else.
  { table: "users", column: "test", type: "INTEGER" },
];
const AFTER_COLUMNS = [
  `CREATE INDEX IF NOT EXISTS users_rating ON users (rating)`,
  // (The friends page's player search, Nov 11, 2026: a name's prefix in any case is a range on this, never a scan: friends.ts, searchPlayers.)
  `CREATE INDEX IF NOT EXISTS users_name ON users (name COLLATE NOCASE)`,
  // (The same search where signing in is set up: only signed-in accounts, so the many guests named "Player" are never read.
  // Its WHERE is friends.ts's SIGNED_IN, word for word: SQLite uses a partial index only for a query that says the same.)
  `CREATE INDEX IF NOT EXISTS users_name_signed ON users (name COLLATE NOCASE) WHERE ${SIGNED_IN}`,
  // (The few test accounts, so 1 v 1's top places leave them out without scanning the table: ranked-schema.ts, topPlace.)
  `CREATE INDEX IF NOT EXISTS users_test ON users (id) WHERE test = 1`,
  // (The deep re-check's queue: only the matches waiting, so the scheduled run never scans the whole table.)
  `CREATE INDEX IF NOT EXISTS fairplay_matches_deep ON fairplay_matches (deep_queued) WHERE deep_queued = 1`,
  // Solo results stopped counting for ranking (Oct 16, 2026: their rating is the browser's word, and the ones from
  // before Oct 7 were stored with ranked NULL, which counted). The accounts that have one get their rating again from
  // their online results; only those, so it's cheap each time the schema changes
  // (docs/decisions/2026-10-16-server-side-rating.md).
  `UPDATE users SET rating = ${LATEST_RATING("users.id")} WHERE id IN (SELECT user_id FROM results WHERE online = 0 AND ranked IS NULL AND rating IS NOT NULL)`,
];

/**
 * The latest rating among a user's results that count for ranking (online, ranked or from before the rule, and not
 * held by a fair-play review), in SQL. Never a solo result's: its rating is the browser's word.
 */
function LATEST_RATING(userId: string) {
  return `(SELECT r.rating FROM results r WHERE r.user_id = ${userId} AND r.online = 1 AND r.rating IS NOT NULL AND (r.ranked IS NULL OR r.ranked = 1) AND (r.held IS NULL OR r.held = 0) ORDER BY r.played_at DESC, r.id DESC LIMIT 1)`;
}
/** A result row counts for ranking (online; ranked, or from before the rule; not held by a fair-play review). */
const countsForRanking = (r: { online: number; ranked: number | null; held?: number | null }) => r.online === 1 && r.ranked !== 0 && !r.held;

/** Sets an account's ranking rating from its results again (after results are held or released by fair play). */
export async function refreshRating(sql: Sql, userId: string): Promise<void> {
  await sql.run(`UPDATE users SET rating = ${LATEST_RATING("users.id")} WHERE id = ?`, userId);
}

const ready = new WeakSet<object>();
/** The schema run on its way for each database, and when it started (ensureSchema). */
const running = new WeakMap<object, { run: Promise<void>; at: number }>();
/**
 * How long a request waits for a schema run another request started before running its own: a run whose request was
 * cut short (its player gone) may never finish, and a normal one takes a few round trips.
 */
const SCHEMA_WAIT_MS = 5_000;
/** Every schema statement, as one fingerprint: a database that has it recorded needs none of them run again. */
const SCHEMA_VERSION = (() => {
  const text = JSON.stringify([SCHEMA, LEDGER_TRIGGERS, COLUMNS, AFTER_COLUMNS]);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return `${text.length}-${(h >>> 0).toString(36)}`;
})();
/** The schema's parts, for the tests (schema-fast.test.ts runs them one statement at a time, as before, to compare). */
export const schemaParts = { SCHEMA, LEDGER_TRIGGERS, COLUMNS, AFTER_COLUMNS, version: SCHEMA_VERSION };

/**
 * Makes sure the database has every table, column, index and trigger, once per Worker instance: a later request costs
 * nothing, and the requests that come while it runs wait for that one run (its failure is theirs too, and the next
 * request tries again). A database already at this schema answers one read (`meta.schema`): in a surge every new
 * instance makes it, so it mustn't be a burst of statements into the one database (DECISIONS.md, "Capacity"). Otherwise
 * a few round trips (schemaRun; docs/decisions/2026-11-10-schema-fast.md).
 */
export async function ensureSchema(sql: Sql, key: object = sql): Promise<void> {
  let waited: Promise<void> | undefined;
  for (let flight = running.get(key); !ready.has(key) && flight && flight.run !== waited; flight = running.get(key)) {
    waited = flight.run;
    if (await settlesWithin(flight.run, flight.at + SCHEMA_WAIT_MS - Date.now())) return;
  }
  if (ready.has(key)) return;
  const run: Promise<void> = schemaRun(sql)
    .then(() => void ready.add(key))
    .finally(() => {
      if (running.get(key)?.run === run) running.delete(key);
    });
  running.set(key, { run, at: Date.now() });
  await run;
}

/** True once `run` is done, false if `ms` pass first; its failure is thrown. */
async function settlesWithin(run: Promise<void>, ms: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([run.then(() => true), new Promise<boolean>((done) => (timer = setTimeout(() => done(false), Math.max(0, ms))))]);
  } finally {
    clearTimeout(timer);
  }
}

/** The tables whose columns the schema run reads: fairplay_identities (for its key) and every table COLUMNS adds to. */
const COLUMN_TABLES = [...new Set(["fairplay_identities", ...COLUMNS.map((c) => c.table)])];

/**
 * Every schema statement, in order, in a few round trips (a fresh database or an upgrade by a column: 4; before Nov 10,
 * one per statement, 134 and 97): the version read; the tables, indexes and triggers (all IF NOT EXISTS) as one batch; the
 * columns of every table that gains some, in one read; then the missing columns, the statements after them and this
 * schema's version last, as one batch. A batch is one transaction (all or none); one that's refused falls back to the
 * statements one at a time, as before.
 */
async function schemaRun(sql: Sql): Promise<void> {
  const at = await sql.first<{ value: string }>("SELECT value FROM meta WHERE key = 'schema'").catch(() => null);
  if (at?.value === SCHEMA_VERSION) return;
  await sql.batch([...SCHEMA, ...LEDGER_TRIGGERS].map((s) => stmt(s))).catch(async () => {
    // (The ledger's append-only triggers are a second lock beside ledger.ts's own: a database that refused them would still load.)
    await sql.batch(SCHEMA.map((s) => stmt(s)));
    for (const s of LEDGER_TRIGGERS) await sql.run(s).catch((e: unknown) => console.error(`ledger trigger not made: ${String(e)}`));
  });
  let columns = await columnsOf(sql);
  // fairplay_identities' key gained the owner (Oct 16, 2026): a table from before is rebuilt once (fairplay-schema.ts).
  const ownerKey = columns.get("fairplay_identities")?.get("user_id");
  if (ownerKey === 0) {
    await sql.batch(IDENTITIES_REKEY);
    columns = await columnsOf(sql);
  }
  const missing = COLUMNS.filter((c) => !columns.get(c.table)?.has(c.column));
  const last = [
    ...AFTER_COLUMNS.map((s) => stmt(s)),
    stmt("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)"),
    stmt("INSERT INTO meta (key, value) VALUES ('schema', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", SCHEMA_VERSION),
  ];
  const adds = missing.flatMap((c) => [stmt(`ALTER TABLE ${c.table} ADD COLUMN ${c.column} ${c.type}`), ...(c.then ?? []).map((t) => stmt(t))]);
  await sql.batch([...adds, ...last]).catch(async (refused: unknown) => {
    if (!missing.length) throw refused;
    // (Another instance may have added a column first: each column with its follow-ups as its own batch, all or nothing, so a
    // column is never left without its fill (review, Nov 10); "duplicate column" is fine. Any other refusal: the whole batch
    // rolled back, so throw and the next request retries it.)
    if (!/duplicate column/i.test(String(refused))) throw refused;
    for (const c of missing)
      await sql.batch([stmt(`ALTER TABLE ${c.table} ADD COLUMN ${c.column} ${c.type}`), ...(c.then ?? []).map((t) => stmt(t))]).catch((e: unknown) => {
        if (!/duplicate column/i.test(String(e))) throw e;
      });
    await sql.batch(last);
  });
}

/**
 * Each of COLUMN_TABLES' columns and its place in the table's primary key (0: not in it), in one read: one row, a JSON list
 * of [name, pk] for each table (D1 takes pragma_table_info only with the table named, and at most 5 terms in a UNION). A
 * database that refuses it gets each table's `PRAGMA table_info`, one at a time, as before.
 */
async function columnsOf(sql: Sql): Promise<Map<string, Map<string, number>>> {
  const read = `SELECT ${COLUMN_TABLES.map((t, i) => `(SELECT json_group_array(json_array(name, pk)) FROM pragma_table_info('${t}')) AS t${i}`).join(", ")}`;
  const lists = await sql.first<Record<string, string | null>>(read).then(
    (row) => COLUMN_TABLES.map((_, i) => JSON.parse(row?.[`t${i}`] ?? "[]") as [string, number][]),
    async (e: unknown) => {
      console.error(`schema: columns read a table at a time (${String(e)})`);
      const each: [string, number][][] = [];
      for (const t of COLUMN_TABLES) each.push((await sql.all<{ name: string; pk: number }>(`PRAGMA table_info(${t})`)).map((c) => [c.name, c.pk]));
      return each;
    },
  );
  return new Map(COLUMN_TABLES.map((t, i) => [t, new Map(lists[i])]));
}

// ---------------- Helpers ----------------

const SESSION_DAYS = 365;
const DAY = 86_400_000;

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export const randomToken = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));
export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The emoji icons from before the icon builder (still accepted for older accounts). */
export const ICONS = ["♟", "♞", "♝", "♜", "♛", "♚", "🦁", "🦊", "🐺", "🦅", "🐉", "🔥", "⚡", "👑", "🎯", "🧠"] as const;

/**
 * A player's drawn icon: a 48 × 48 PNG as a data URL, at most 16 KB. The PNG's
 * signature and its header's size are checked, so nothing else gets stored.
 */
export const PIXEL_ICON_SIZE = 48;
const MAX_ICON_CHARS = 16_000;
export function isPixelIcon(icon: unknown): icon is string {
  const prefix = "data:image/png;base64,";
  if (typeof icon !== "string" || !icon.startsWith(prefix) || icon.length > MAX_ICON_CHARS) return false;
  const b64 = icon.slice(prefix.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return false;
  let head: string;
  try {
    head = atob(b64.slice(0, 32));
  } catch {
    return false;
  }
  const byte = (i: number) => head.charCodeAt(i);
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => byte(i) === b);
  const ihdr = head.slice(12, 16) === "IHDR";
  const u32 = (i: number) => ((byte(i) << 24) | (byte(i + 1) << 16) | (byte(i + 2) << 8) | byte(i + 3)) >>> 0;
  return signature && ihdr && u32(16) === PIXEL_ICON_SIZE && u32(20) === PIXEL_ICON_SIZE;
}

/** A display name: trimmed, 1-16 visible characters, no control characters, nothing the name filter refuses (text-filter.ts). */
export function cleanName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const n = name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 16);
  return n.length && !isBlockedText(n) ? n : null;
}

/** A normalized email address, or null if it doesn't look like one. */
export function cleanEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const e = email.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/**
 * An email as one person's address (fair play's ban evasion): lower case, without a "+tag", and for Gmail without dots
 * (Gmail ignores them), so a.b+2@gmail.com and ab@gmail.com are the same.
 */
export function normalizeEmail(email: string): string {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@");
  const base = local.split("+")[0]!;
  const gmail = domain === "gmail.com" || domain === "googlemail.com";
  return `${gmail ? base.replace(/\./g, "") : base}@${gmail ? "gmail.com" : domain}`;
}

/** An account's sign-in identities as fair play keeps them for a ban: hashed. */
export async function identityHashes(u: Pick<User, "email" | "google_sub">): Promise<[string, string][]> {
  const out: [string, string][] = [];
  if (u.email) out.push(["email", await sha256(`email:${normalizeEmail(u.email)}`)]);
  if (u.google_sub) out.push(["google", await sha256(`google:${u.google_sub}`)]);
  return out;
}

/**
 * A deleted account's results keep this as their account (account-data.ts): no account has it (ids are 16 random
 * characters), so no profile shows them, while the game's own numbers stay right.
 */
export const DELETED_ID = "deleted";
/** What an admin's page shows for an account that was deleted (its fair-play file can outlive it). */
export const DELETED_NAME = "Deleted player";

/**
 * Writes for an account that may have been deleted since (a lobby's results, a reward) go through this in the same
 * statement, so a deleted account gets nothing new and no extra read is made.
 */
const IF_ACCOUNT = "WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)";

export interface User {
  id: string;
  name: string;
  icon: string;
  email: string | null;
  google_sub: string | null;
  created_at: number;
  /** The default pawn color (users.pawn_color; NULL: white). */
  pawn_color?: string | null;
}

// ---------------- Users and sessions ----------------

/** A new guest account and a session for it. */
export async function createGuest(sql: Sql, now: number, name = "Player"): Promise<{ user: User; token: string }> {
  const id = randomToken(12);
  await sql.run("INSERT INTO users (id, name, created_at, last_seen) VALUES (?, ?, ?, ?)", id, cleanName(name) ?? "Player", now, now);
  const token = await createSession(sql, id, now);
  return { user: (await getUser(sql, id))!, token };
}

export async function createSession(sql: Sql, userId: string, now: number): Promise<string> {
  const token = randomToken();
  await sql.run("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)", await sha256(token), userId, now, now + SESSION_DAYS * DAY);
  return token;
}

export async function endSession(sql: Sql, token: string): Promise<void> {
  await sql.run("DELETE FROM sessions WHERE token_hash = ?", await sha256(token));
}

export const getUser = (sql: Sql, id: string) =>
  sql.first<User>("SELECT id, name, icon, email, google_sub, created_at, pawn_color FROM users WHERE id = ?", id);

/** The user a session token belongs to (null if unknown or expired). */
/**
 * `touch` marks the account as seen: by default a D1 write (at most every 15 s); the Worker passes the live hub's
 * presence instead (presence.ts), which writes D1 at most once a minute.
 */
export async function userFromToken(sql: Sql, token: string | null | undefined, now: number, touch?: (userId: string) => unknown): Promise<User | null> {
  if (!token) return null;
  // (The session and its account in one read, Nov 10: each D1 read is a round trip, and every signed-in request starts here.)
  const s = await sql.first<User & { expires_at: number }>(
    "SELECT u.id, u.name, u.icon, u.email, u.google_sub, u.created_at, u.pawn_color, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?",
    await sha256(token),
  );
  if (!s || s.expires_at < now) return null;
  if (touch) touch(s.id);
  else await touchUser(sql, s.id, now);
  const { expires_at: _, ...user } = s;
  return user;
}

/** Marks an account as seen now (what "online" counts). Written at most every 15 s per account. */
export async function touchUser(sql: Sql, userId: string, now: number): Promise<void> {
  await sql.run("UPDATE users SET last_seen = ? WHERE id = ? AND last_seen < ?", now, userId, now - 15_000);
}

/** The heartbeat: marks the session's account as seen, without loading it. */
export async function touchSession(sql: Sql, token: string | null | undefined, now: number): Promise<void> {
  if (!token) return;
  const s = await sql.first<{ user_id: string; expires_at: number }>("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?", await sha256(token));
  if (s && s.expires_at >= now) await touchUser(sql, s.user_id, now);
}

export async function updateProfile(sql: Sql, userId: string, patch: { name?: unknown; icon?: unknown; pawn?: unknown }): Promise<User> {
  const name = patch.name === undefined ? null : cleanName(patch.name);
  if (name) await sql.run("UPDATE users SET name = ? WHERE id = ?", name, userId);
  // The default pawn color: only "white" or "black" (the route refuses anything else before this).
  const pawn = cleanPawnColor(patch.pawn);
  if (pawn) await sql.run("UPDATE users SET pawn_color = ? WHERE id = ?", pawn, userId);
  // A drawn icon (the icon builder), or one of the old emoji icons.
  if (isPixelIcon(patch.icon) || (typeof patch.icon === "string" && (ICONS as readonly string[]).includes(patch.icon))) {
    await sql.run("UPDATE users SET icon = ? WHERE id = ?", patch.icon, userId);
  }
  return (await getUser(sql, userId))!;
}

/**
 * The age gate (docs/decisions/2026-10-16-age-gate-and-real-money.md). An account signed in after its holder said they
 * were old enough keeps when they first did (and nothing else about it); later sign-ins leave that time as it is.
 */
/** The chat's opt-in (Eric, Nov 7: off by default, "stored per account"): users.chat_on, 1 on, NULL off. */
export async function setChatOn(sql: Sql, userId: string, on: boolean): Promise<void> {
  await sql.run("UPDATE users SET chat_on = ? WHERE id = ?", on ? 1 : null, userId);
}

export async function markAgeOk(sql: Sql, userId: string, now: number): Promise<void> {
  await sql.run("UPDATE users SET age_ok_at = ? WHERE id = ? AND age_ok_at IS NULL", now, userId);
}

/** A guest whose device answered "too young": back to the default name and icon (anything they chose is gone). */
export async function resetNameAndIcon(sql: Sql, userId: string): Promise<void> {
  await sql.run("UPDATE users SET name = 'Player', icon = '♟' WHERE id = ?", userId);
}

/**
 * Signs in with a Google account or an email address. If that identity already
 * has an account, you switch to it (and a guest account's results move over);
 * otherwise it's attached to the account you're on, or a new one if that
 * account already has a different identity of the same kind.
 */
export async function signInWithIdentity(
  sql: Sql,
  current: User | null,
  kind: "google" | "email",
  value: string,
  extra: { email?: string | null } = {},
  now: number,
): Promise<User> {
  return (await signIn(sql, current, kind, value, extra, now, true))!;
}

/**
 * A sign-in from a device that hasn't answered the age question (Eric, Nov 12: "log in without having to select an age if you
 * already have an account"; docs/decisions/2026-11-12-signin-without-age.md): it goes ahead only into an account whose holder
 * already said they were old enough (`users.age_ok_at`), the identity's own or, for a new identity, the signed-in account you're
 * on. Anything else (an identity with no account, which would make one or turn a guest into one; an account from before the
 * question) is null, and nothing is written: the device is asked first.
 */
export async function signInIfAnswered(sql: Sql, current: User | null, kind: "google" | "email", value: string, extra: { email?: string | null } = {}, now: number): Promise<User | null> {
  return signIn(sql, current, kind, value, extra, now, false);
}

/**
 * Whether a sign-in with this identity would land on an account that has answered the age question (signInIfAnswered's rule,
 * read only). The email check reads it before the code, so a right code is used up only by the request that signs in.
 */
export async function answeredSignIn(sql: Sql, current: User | null, kind: "google" | "email", value: string): Promise<boolean> {
  const col = kind === "google" ? "google_sub" : "email";
  const owner = await sql.first<{ age_ok_at: number | null }>(`SELECT age_ok_at FROM users WHERE ${col} = ?`, value);
  if (owner) return owner.age_ok_at !== null;
  return attachAnswered(sql, current, col);
}

/** No account has the identity: it's added to `current` if that's a signed-in account without one of its kind, which has answered. */
async function attachAnswered(sql: Sql, current: User | null, col: "google_sub" | "email"): Promise<boolean> {
  if (!current || current[col] || !(current.email || current.google_sub)) return false;
  const row = await sql.first<{ age_ok_at: number | null }>("SELECT age_ok_at FROM users WHERE id = ?", current.id);
  return row?.age_ok_at != null;
}

async function signIn(
  sql: Sql,
  current: User | null,
  kind: "google" | "email",
  value: string,
  extra: { email?: string | null },
  now: number,
  answered: boolean,
): Promise<User | null> {
  const col = kind === "google" ? "google_sub" : "email";
  const found = await sql.first<User & { age_ok_at: number | null }>(`SELECT id, name, icon, email, google_sub, created_at, age_ok_at FROM users WHERE ${col} = ?`, value);
  // (Not answered on this device: only into an account that has, checked before anything is moved or made.)
  if (!answered && (found ? found.age_ok_at === null : !(await attachAnswered(sql, current, col)))) return null;
  if (found) {
    const { age_ok_at: _answeredAt, ...owner } = found;
    if (current && current.id !== owner.id && !current.email && !current.google_sub) {
      // A guest signing in to an existing account: its matches, items, coins, reports, fair-play and chat files and the rest join
      // the account and the guest goes, in one batch (one transaction), so nothing lands halfway: a buy in another tab
      // is wholly before it (and moves) or wholly after (and finds no guest wallet), two sign-ins at once move the wallet
      // once, and a failure moves nothing (docs/decisions/2026-10-16-sign-in-races.md). Nothing stays under the guest's
      // id, where deleting the account couldn't reach it, and a case can't be shed by signing in
      // (docs/decisions/2026-10-16-integrity-followups.md).
      await sql.batch([
        stmt("UPDATE results SET user_id = ? WHERE user_id = ?", owner.id, current.id),
        ...fairPlayMoves(current.id, owner.id, now, await identityHashes(owner)),
        ...chatModMoves(current.id, owner.id, now),
        stmt(`UPDATE users SET rating = ${LATEST_RATING("users.id")} WHERE id = ?`, owner.id),
        ...shopMoves(current.id, owner.id),
        ...lockerMoves(current.id, owner.id),
        ...tokenMoves(current.id, owner.id),
        // (The balances themselves, with their ledger legs: ledger.ts.)
        ...mergeMoves(current.id, owner.id, now),
        ...rankedMoves(current.id, owner.id),
        // (Quests, Nov 9: the guest's go; the account keeps its own. What they paid is in the balances moved above.)
        ...questDeletes(current.id),
        // (The guest's calls to the engine server today: the account's own count stands.)
        stmt("DELETE FROM engine_calls WHERE user_id = ?", current.id),
        stmt("DELETE FROM sessions WHERE user_id = ?", current.id),
        ...socialDeletes(current.id),
        stmt("DELETE FROM users WHERE id = ?", current.id),
      ]);
    }
    if (kind === "google" && !owner.email && (await adoptGoogleEmail(sql, owner.id, extra.email))) return (await getUser(sql, owner.id))!;
    return owner;
  }
  if (current && !current[col]) {
    await sql.run(`UPDATE users SET ${col} = ? WHERE id = ?`, value, current.id);
    if (kind === "google" && !current.email) await adoptGoogleEmail(sql, current.id, extra.email);
    return (await getUser(sql, current.id))!;
  }
  const id = randomToken(12);
  // A new account is "Player" until its owner picks a name: never their Google name or the start of their email,
  // which everyone would see (docs/decisions/2026-10-15-delete-my-account-and-download-my-data.md).
  await sql.run(`INSERT INTO users (id, name, ${col}, created_at, last_seen) VALUES (?, 'Player', ?, ?, ?)`, id, value, now, now);
  if (kind === "google") await adoptGoogleEmail(sql, id, extra.email);
  return (await getUser(sql, id))!;
}

/**
 * A Google account brings its (verified) email to an account that has none, when no other account uses it: on every
 * Google sign-in, so accounts made before this, or made fresh by Google, get it too (admins and fair play match on it).
 */
async function adoptGoogleEmail(sql: Sql, userId: string, email: string | null | undefined): Promise<boolean> {
  const e = cleanEmail(email);
  if (!e || (await sql.first("SELECT id FROM users WHERE email = ?", e))) return false;
  await sql.run("UPDATE users SET email = ? WHERE id = ? AND email IS NULL", e, userId);
  return true;
}

// ---------------- Email codes ----------------

const CODE_MINUTES = 10;
const RESEND_SECONDS = 30;
const SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

export type CodeStart = { ok: true; code: string } | { ok: false; message: string };

/**
 * Sign-in code records go an hour after their last code was sent (by then it has expired and its hour's count is
 * spent): the Worker's 15-minute schedule runs this (index.ts), so none stays much past the hour.
 */
export async function purgeEmailCodes(sql: Sql, now: number): Promise<void> {
  await sql.run("DELETE FROM email_codes WHERE sent_at < ?", now - 3_600_000);
}

/** A fresh 6-digit sign-in code for an address (rate-limited). */
export async function startEmailCode(sql: Sql, email: string, now: number): Promise<CodeStart> {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000;
  const code = String(n).padStart(6, "0");
  // One statement checks the limits and records the send, so starts at once can't all pass them and send more emails
  // (docs/decisions/2026-10-16-integrity-followups.md): it writes the code only if the last one went RESEND_SECONDS
  // ago or more and the hour has sends left (a new hour starts the count again). Only the start that wrote it sends it.
  const sent = await sql.first<{ sent: number }>(
    `INSERT INTO email_codes (email, code_hash, expires_at, attempts, sent_at, hour_start, sends_this_hour) VALUES (?1, ?2, ?3, 0, ?4, ?4, 1)
     ON CONFLICT (email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, sent_at = excluded.sent_at,
       hour_start = CASE WHEN ?4 - hour_start > ?7 THEN ?4 ELSE hour_start END,
       sends_this_hour = CASE WHEN ?4 - hour_start > ?7 THEN 1 ELSE sends_this_hour + 1 END
     WHERE ?4 - sent_at >= ?5 AND (?4 - hour_start > ?7 OR sends_this_hour < ?6)
     RETURNING 1 AS sent`,
    email,
    await sha256(`${email}:${code}`),
    now + CODE_MINUTES * 60_000,
    now,
    RESEND_SECONDS * 1000,
    SENDS_PER_HOUR,
    3_600_000,
  );
  if (sent) return { ok: true, code };
  // Refused: the resend gap, or the hour's limit (the read only picks the message).
  const row = await sql.first<{ sent_at: number }>("SELECT sent_at FROM email_codes WHERE email = ?", email);
  if (row && now - row.sent_at < RESEND_SECONDS * 1000) return { ok: false, message: "A code was just sent. Wait a few seconds and try again." };
  return { ok: false, message: "Too many codes for this address. Try again in an hour." };
}

/**
 * Checks a code; it works once, for 10 minutes, with 5 tries. `keep`: a right code is reported but left live, for a sign-in that
 * must ask the age question before it can finish (docs/decisions/2026-11-12-signin-without-age.md): the finish sends the same code
 * again, and that check uses it up. Every check counts a try either way.
 */
export async function verifyEmailCode(sql: Sql, email: string, code: string, now: number, keep = false): Promise<boolean> {
  // One statement, so checks at once can't share a code or a try (docs/decisions/2026-10-16-sign-in-races.md): it
  // counts the try while the code is live with tries left, and uses the code up if it's right (unless kept). Only the check whose
  // statement used it up gets in.
  const hash = await sha256(`${email}:${String(code).trim()}`);
  const row = await sql.first<{ ok: number }>(
    `UPDATE email_codes SET attempts = attempts + 1, expires_at = CASE WHEN code_hash = ?1 AND ?5 = 0 THEN 0 ELSE expires_at END
     WHERE email = ?2 AND expires_at >= ?3 AND attempts < ?4 RETURNING code_hash = ?1 AS ok`,
    hash,
    email,
    now,
    MAX_ATTEMPTS,
    keep ? 1 : 0,
  );
  return row?.ok === 1;
}

/** A code spent without signing in (a sign-in refused for a ban, api.ts): it can't be checked again. */
export async function spendEmailCode(sql: Sql, email: string): Promise<void> {
  await sql.run("UPDATE email_codes SET expires_at = 0 WHERE email = ?", email);
}

// ---------------- Results and profiles ----------------

export interface MatchResult {
  mode: "classic" | "crowd" | "boss" | "squads";
  online: boolean;
  placement: number;
  players: number;
  team?: "w" | "b" | null;
  teamWon?: boolean | null;
  avgScore?: number | null;
  rating?: number | null;
  /** The profile's stats (recorded from Oct 6, 2026; see MatchFeats in core). */
  brilliant?: number | null;
  bestMove?: string | null;
  cuts?: number | null;
  cutsSurvived?: number | null;
  strikes?: number | null;
  strikesSurvived?: number | null;
  survived?: boolean | null;
  lastStand?: boolean | null;
  bossElo?: number | null;
  bossId?: string | null;
  /** An online match: its lobby's code (the server sets it; a solo result has none). */
  lobby?: string | null;
  /** It counts for ranking (the lobby decides: isRankedMatch). Solo results never do. */
  ranked?: boolean | null;
  /** Held off ranking: its player is in a fair-play review (or banned). Counted again if they're cleared. */
  held?: boolean;
  /** The player had the eval bar on (Settings), as far as their app said. */
  evalBar?: boolean | null;
  /** Recorded because the player abandoned the match (gone too long, idle or removed: the match room says; never the app's word). */
  abandoned?: boolean;
  /** XP (Nov 9; xp.ts): the player's time in the game and own moves, as the server counted them, and the game's XP as granted. */
  playMs?: number | null;
  moves?: number | null;
  xp?: XpGrant | null;
}

/** A count from a result (0-500), or null. */
const count = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(500, Math.round(n))) : null);
const flag = (b: unknown) => (b === true ? 1 : b === false ? 0 : null);
/** A move in SAN (e.g. Nxe5, O-O-O, e8=Q+), or null. */
export const cleanSan = (m: unknown) => (typeof m === "string" && /^(?:[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?|O-O(?:-O)?)[+#]?$/.test(m) ? m : null);

/** `once.since`: written only if this account has no result from this online lobby (`r.lobby`) since then (a lobby writing it again). */
export async function recordResult(sql: Sql, userId: string, r: MatchResult, now: number, once?: { since: number }): Promise<void> {
  const rating = typeof r.rating === "number" && Number.isFinite(r.rating) ? Math.round(r.rating) : null;
  const cuts = count(r.cuts);
  const strikes = count(r.strikes);
  const mode = r.mode === "crowd" || r.mode === "boss" || r.mode === "squads" ? r.mode : "classic";
  // Only an online match the lobby judged ranked counts (a solo result, posted by the browser, never does).
  const ranked = r.online && r.ranked === true;
  const lobby = r.online && typeof r.lobby === "string" && /^[A-Z2-9]{5}$/.test(r.lobby) ? r.lobby : null;
  // (One batch: the row and the rating it moves go in together. The rating is the latest counting result's, read again, so a
  // result written late, or twice, never puts an older rating back: Nov 10, finding 9.)
  const rated = rating !== null && ranked && !r.held;
  await sql.batch([
    stmt(
      `INSERT INTO results (user_id, mode, online, placement, players, team, team_won, avg_score, rating, played_at,
         brilliant, best_move, cuts, cuts_survived, strikes, strikes_survived, survived, last_stand, boss_elo, lobby, ranked, held, boss_id, eval_bar, abandoned,
         play_ms, moves, xp_before, xp_parts, xp_none, xp_rewards)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? ${IF_ACCOUNT}
       ${once ? "AND NOT EXISTS (SELECT 1 FROM results WHERE user_id = ? AND lobby = ? AND online = 1 AND played_at >= ?)" : ""}`,
      userId,
      mode,
      r.online ? 1 : 0,
      Math.max(1, Math.round(r.placement)),
      Math.max(1, Math.round(r.players)),
      r.team ?? null,
      r.teamWon === undefined || r.teamWon === null ? null : r.teamWon ? 1 : 0,
      r.avgScore ?? null,
      rating,
      now,
      count(r.brilliant),
      cleanSan(r.bestMove),
      cuts,
      cuts === null ? null : Math.min(cuts, count(r.cutsSurvived) ?? 0),
      strikes,
      strikes === null ? null : Math.min(strikes, count(r.strikesSurvived) ?? 0),
      flag(r.survived),
      flag(r.lastStand),
      mode === "boss" && typeof r.bossElo === "number" && BOSS_TIERS.includes(r.bossElo) ? r.bossElo : null,
      lobby,
      ranked ? 1 : 0,
      r.held ? 1 : 0,
      typeof r.bossId === "string" && bossDef(r.bossId) ? r.bossId : null,
      flag(r.evalBar),
      // (Only an online match's room says a player abandoned it.)
      r.online && r.abandoned === true ? 1 : null,
      // (XP's facts are the server's: the caller's, never the app's.)
      typeof r.playMs === "number" && Number.isFinite(r.playMs) ? Math.max(0, Math.round(r.playMs)) : null,
      typeof r.moves === "number" && Number.isFinite(r.moves) ? Math.max(0, Math.min(10_000, Math.round(r.moves))) : null,
      ...xpColumns(r.xp),
      // (An account deleted mid-match gets nothing new.)
      userId,
      ...(once ? [userId, lobby, once.since] : []),
    ),
    // Only a ranked match moves your ranking (and not while fair play holds your results).
    ...(rated ? [stmt(`UPDATE users SET rating = ${LATEST_RATING("users.id")} WHERE id = ?`, userId)] : []),
  ]);
}

/** Your result in an online match, by its lobby's code (the latest, if a code was used again): for "See your result". */
export interface LobbyResult {
  mode: string;
  placement: number;
  players: number;
  /** When it was recorded: the same as the profile's recent match. */
  playedAt: number;
}

export async function lobbyResult(sql: Sql, userId: string, code: string): Promise<LobbyResult | null> {
  const row = await sql.first<{ mode: string; placement: number; players: number; played_at: number }>(
    "SELECT mode, placement, players, played_at FROM results WHERE user_id = ? AND lobby = ? AND online = 1 ORDER BY played_at DESC, id DESC LIMIT 1",
    userId,
    code,
  );
  return row ? { mode: row.mode, placement: row.placement, players: row.players, playedAt: row.played_at } : null;
}

export interface ModeStats {
  matches: number;
  wins: number;
  finals: number;
  avgPlacement: number | null;
  best: number | null;
  teamWins: number;
}

export interface Profile {
  user: Pick<User, "id" | "name" | "icon"> & { signedIn: boolean; email: string | null; google: boolean; pawn: PawnColor };
  shop: ShopState;
  locker: LockerState;
  stats: { all: ModeStats; classic: ModeStats; crowd: ModeStats; boss: ModeStats };
  rating: number | null;
  /** Ranked 1 v 1: the rank ("Gold 2 · 45 RP", "Placement 2/5") and the record. */
  ranked1v1: RankedSummary;
  recent: { mode: string; online: boolean; placement: number; players: number; teamWon: boolean | null; playedAt: number }[];
  /** Your chat ban in force and a moderator's notice you haven't seen (chat-mod.ts); missing when neither. */
  chatMod?: { block?: ChatBlock; notice?: ChatNotice };
  /** Chat is on for this account (its opt-in, users.chat_on; off by default, and always for a guest: theirs is on the device). */
  chatOn: boolean;
  /** Your XP (Nov 9): your level and its ring come from it (core's levelOf, levelProgress). */
  xp: number;
  /**
   * Ranked's leave rules (L1, Nov 9; ranked.ts rankedLeaves): a lockout, the delayed queue, what a dodge would cost now, and home's
   * note after a dodge. Null while PAUSE_LEAVE_PENALTIES is on (nothing applies).
   */
  leaves: RankedLeaves | null;
}

/** Your profile. `admins`: who's an admin (admin.ts): an admin's shop and locker have one of every item, never stored. */
export async function profile(sql: Sql, user: User, admins: AdminCheck = NO_ADMINS, opts: { leaves?: boolean } = {}): Promise<Profile> {
  const admin = admins(user);
  // The Welcome Crate's backfill (Nov 6): an account that has finished enough games gets it here, on its next sign-in or app load,
  // once ever (welcome.ts). Never in the way of the profile. The locker's holdings are read after it; nothing else waits on it.
  const welcome = grantWelcomeCrate(sql, user.id, Date.now()).catch((e: unknown) => console.log(`welcome crate for ${user.id}: ${String(e)}`));
  // Every part's reads at once (Nov 10): each D1 read is a round trip (about 40 ms from a Worker), and the app's home waits on this.
  // One after another they were 28 round trips, over a second; at once, about four (test/me-round-trips.test.ts).
  const [rows, chatMod, chatOnRow, shop, locker, ranked1v1, xp, leaves] = await Promise.all([
    sql.all<{ mode: string; online: number; placement: number; players: number; team_won: number | null; rating: number | null; played_at: number; ranked: number | null; held: number | null }>(
      "SELECT mode, online, placement, players, team_won, rating, played_at, ranked, held FROM results WHERE user_id = ? ORDER BY played_at DESC",
      user.id,
    ),
    chatStanding(sql, user.id, Date.now()).catch(() => null),
    sql.first<{ chat_on: number | null }>("SELECT chat_on FROM users WHERE id = ?", user.id).catch(() => null),
    shopState(sql, user.id, admin),
    lockerState(sql, user.id, admin, welcome),
    rankedSummary(sql, user.id, admins),
    xpOf(sql, user.id),
    opts.leaves === false ? null : rankedLeaves(sql, user.id, Date.now()).catch(() => null),
  ]);
  const stats = (rs: typeof rows): ModeStats => ({
    matches: rs.length,
    wins: rs.filter((r) => r.placement === 1).length,
    finals: rs.filter((r) => r.placement <= 4).length,
    avgPlacement: rs.length ? Math.round((rs.reduce((s, r) => s + r.placement, 0) / rs.length) * 10) / 10 : null,
    best: rs.length ? Math.min(...rs.map((r) => r.placement)) : null,
    teamWins: rs.filter((r) => r.team_won === 1).length,
  });
  const chatOn = chatOnRow?.chat_on === 1;
  return {
    user: { id: user.id, name: user.name, icon: user.icon, signedIn: !!(user.email || user.google_sub), email: user.email, google: !!user.google_sub, pawn: pawnColorOf(user.pawn_color) },
    shop,
    locker,
    stats: { all: stats(rows), classic: stats(rows.filter((r) => r.mode === "classic")), crowd: stats(rows.filter((r) => r.mode === "crowd")), boss: stats(rows.filter((r) => r.mode === "boss")) },
    rating: rows.find((r) => r.rating !== null && countsForRanking(r))?.rating ?? null,
    ranked1v1,
    xp,
    leaves,
    recent: rows.slice(0, 10).map((r) => ({
      mode: r.mode,
      online: !!r.online,
      placement: r.placement,
      players: r.players,
      teamWon: r.team_won === null ? null : r.team_won === 1,
      playedAt: r.played_at,
    })),
    ...(chatMod ? { chatMod } : {}),
    chatOn,
  };
}

// ---------------- Public profiles ----------------

/** Crowd stats on a profile. A stat is null when none of the results it counts has it recorded. */
export interface CrowdStats {
  games: number;
  wins: number;
  avgPlace: number | null;
  best: number | null;
  /** Cuts survived out of cuts faced, as a percentage. */
  cutsSurvivedPct: number | null;
  brilliant: number | null;
}

export interface RaidStats {
  raids: number;
  /** Different bosses (tiers) beaten online (a solo win is the browser's word). */
  bossesBeaten: number;
  /** The boss's strikes you lived through (it struck someone else). */
  strikesSurvived: number | null;
  /** Raids in which the God King made his Last Stand. */
  lastStands: number | null;
  /** Raids you were still standing at the end of, as a percentage. */
  survivedPct: number | null;
  brilliant: number | null;
}

/**
 * What anyone can see of a player: their name, their icon and what they wear and have played; no email, no sign-in
 * method, nothing about the account itself. The icon became public on Oct 28, 2026 (Eric: it's the picture behind the
 * pawn on the public profile; icons are reportable and a moderator can reset one, so it was never a secret to
 * moderate). The same structure for your own profile and everyone else's.
 */
export interface PublicProfile {
  id: string;
  name: string;
  /** Their drawn icon (a 48 × 48 PNG data URL), or an older account's emoji; "♟" is the default (none of their own). */
  icon: string;
  /** What they wear: crate items. */
  look: ItemLook;
  /** Their default pawn color (white unless they chose black). */
  pawn: PawnColor;
  joinedAt: number;
  lastSeen: number | null;
  online: boolean;
  /** They hide when they're online (Settings → Friends): `online` false and `lastSeen` null, whatever the truth. */
  hidden?: boolean;
  /** Their level (Nov 9: from their XP; core's levelOf). Public, as the public profile shows it. */
  level: number;
  rating: number | null;
  /** "Top 18%" among rated players (null until enough players have a rating). */
  topPercent: number | null;
  /** Banned for fair play (the profile says "Banned"; nothing else about a fair-play case is ever shown). */
  banned: boolean;
  /** Ranked 1 v 1: the rank (the rank shown everywhere since Oct 28), the record, the peak, the streak and the recent games (null when banned, as the rating). */
  ranked1v1: RankedSummary | null;
  crowd: CrowdStats;
  boss: RaidStats;
  /** The rating after each of the last 30 rated matches, oldest first. */
  ratingHistory: number[];
  /** Boss tiers (their strengths) beaten in online raids (a solo win is the browser's word). */
  bossesBeaten: number[];
  recent: {
    mode: string;
    online: boolean;
    placement: number;
    players: number;
    /** Crowd: the side played (50 v 50), or null (everyone moves, a choice until Oct 15, 2026). */
    team: "w" | "b" | null;
    won: boolean | null;
    /** A boss battle: still standing at the end. */
    survived: boolean | null;
    bestMove: string | null;
    bossElo: number | null;
    /** A boss raid: which boss (a BOSS_ROSTER id; null from before bosses had identities). */
    bossId?: string | null;
    playedAt: number;
    /** It counted for ranking (false: under 30% real players, solo or practice; null: from before the rule). */
    ranked: boolean | null;
  }[];
}

interface ResultRow {
  mode: string;
  online: number;
  team: string | null;
  placement: number;
  players: number;
  team_won: number | null;
  rating: number | null;
  played_at: number;
  brilliant: number | null;
  best_move: string | null;
  cuts: number | null;
  cuts_survived: number | null;
  strikes: number | null;
  strikes_survived: number | null;
  survived: number | null;
  last_stand: number | null;
  boss_elo: number | null;
  boss_id?: string | null;
  ranked: number | null;
  held: number | null;
}

/** The sum of a column over the rows that have it (null if none do). */
const sumOf = (rows: ResultRow[], pick: (r: ResultRow) => number | null) => {
  const xs = rows.map(pick).filter((x): x is number => x !== null);
  return xs.length ? xs.reduce((a, b) => a + b, 0) : null;
};
const pct = (part: number | null, whole: number | null) => (part === null || !whole ? null : Math.round((100 * part) / whole));

export function crowdStats(rows: ResultRow[]): CrowdStats {
  const cuts = sumOf(rows, (r) => r.cuts);
  return {
    games: rows.length,
    wins: rows.filter((r) => r.placement === 1).length,
    avgPlace: rows.length ? Math.round((rows.reduce((a, r) => a + r.placement, 0) / rows.length) * 10) / 10 : null,
    best: rows.length ? Math.min(...rows.map((r) => r.placement)) : null,
    cutsSurvivedPct: pct(sumOf(rows.filter((r) => r.cuts !== null), (r) => r.cuts_survived), cuts),
    brilliant: sumOf(rows, (r) => r.brilliant),
  };
}

export function raidStats(rows: ResultRow[]): RaidStats {
  const standing = rows.filter((r) => r.survived !== null);
  return {
    raids: rows.length,
    bossesBeaten: new Set(rows.filter((r) => r.online === 1 && r.team_won === 1 && r.boss_elo !== null).map((r) => r.boss_elo)).size,
    strikesSurvived: sumOf(rows, (r) => r.strikes_survived),
    lastStands: sumOf(rows, (r) => r.last_stand),
    survivedPct: standing.length ? pct(standing.filter((r) => r.survived === 1).length, standing.length) : null,
    brilliant: sumOf(rows, (r) => r.brilliant),
  };
}

/**
 * Anyone's profile by account id (null if there's no such account). `admins`: who's an admin (admin.ts), so an admin's
 * look has the admin copies they wear (the email is read only for that, never answered).
 */
export async function publicProfile(sql: Sql, userId: string, now: number, admins: AdminCheck = NO_ADMINS): Promise<PublicProfile | null> {
  const u = await sql.first<{ id: string; name: string; icon: string; email: string | null; created_at: number; last_seen: number | null; rating: number | null; hide_online: number | null; pawn_color: string | null; test: number | null }>(
    "SELECT id, name, icon, email, created_at, last_seen, rating, hide_online, pawn_color, test FROM users WHERE id = ?",
    userId,
  );
  if (!u) return null;
  const rows = await sql.all<ResultRow>(
    `SELECT mode, online, placement, players, team, team_won, rating, played_at, brilliant, best_move, cuts, cuts_survived, strikes,
       strikes_survived, survived, last_stand, boss_elo, boss_id, ranked, held
     FROM results WHERE user_id = ? ORDER BY played_at DESC, id DESC`,
    userId,
  );
  const rating = u.rating ?? rows.find((r) => r.rating !== null && countsForRanking(r))?.rating ?? null;
  let top: number | null = null;
  if (rating !== null) {
    // (The engine pool is left out of everyone's "Top N%": a pooled player's own is worked out among the rest and them, so it looks
    // as ever: fairplay.ts, NOT_POOLED. Test accounts likewise: test-accounts.ts.)
    const pooled = (await sql.first<{ status: string }>("SELECT status FROM fairplay_cases WHERE user_id = ?", userId))?.status === "pool";
    const self = pooled || u.test === 1 ? 1 : 0;
    const total = ((await sql.first<{ n: number }>(`SELECT COUNT(*) AS n FROM users WHERE rating IS NOT NULL AND test IS NOT 1 AND ${NOT_POOLED("id")}`))?.n ?? 0) + self;
    if (total >= FRONT_DOOR.percentileMinPlayers) {
      const above = (await sql.first<{ n: number }>(`SELECT COUNT(*) AS n FROM users WHERE rating > ? AND test IS NOT 1 AND ${NOT_POOLED("id")}`, rating))?.n ?? 0;
      top = topPercent(above + 1, total);
    }
  }
  const raids = rows.filter((r) => r.mode === "boss");
  const banned = (await sql.first<{ status: string }>("SELECT status FROM fairplay_cases WHERE user_id = ?", userId))?.status === "banned";
  return {
    id: u.id,
    name: u.name,
    icon: u.icon,
    look: (await lockerState(sql, u.id, admins(u))).look,
    pawn: pawnColorOf(u.pawn_color),
    joinedAt: u.created_at,
    lastSeen: u.hide_online ? null : u.last_seen,
    online: !u.hide_online && u.last_seen !== null && now - u.last_seen < FRONT_DOOR.onlineWindowMs,
    ...(u.hide_online ? { hidden: true } : {}),
    rating: banned ? null : rating,
    topPercent: banned ? null : top,
    banned,
    ranked1v1: banned ? null : await rankedSummary(sql, u.id, admins),
    level: levelOf(await xpOf(sql, u.id)),
    crowd: crowdStats(rows.filter((r) => r.mode === "crowd")),
    boss: raidStats(raids),
    ratingHistory: rows
      .filter((r) => r.rating !== null && countsForRanking(r))
      .slice(0, 30)
      .map((r) => r.rating!)
      .reverse(),
    bossesBeaten: [...new Set(raids.filter((r) => r.online === 1 && r.team_won === 1 && r.boss_elo !== null).map((r) => r.boss_elo!))].sort((a, b) => a - b),
    recent: rows.slice(0, 10).map((r) => ({
      mode: r.mode,
      online: !!r.online,
      placement: r.placement,
      players: r.players,
      team: r.team === "w" || r.team === "b" ? r.team : null,
      won: r.team_won === null ? null : r.team_won === 1,
      survived: r.survived === null ? null : r.survived === 1,
      bestMove: r.best_move,
      bossElo: r.boss_elo,
      bossId: r.boss_id ?? null,
      playedAt: r.played_at,
      ranked: r.ranked === null ? null : r.ranked === 1,
    })),
  };
}

// ---------------- The shop ----------------

/**
 * Coins, items owned (starters included) and what's equipped in each slot. `admin`: an admin's, which also owns every
 * God King effect (admin copies, core/admin-copies.ts: never stored; listed in `admin`). Chat packs aren't worn, so an
 * admin's are what they really own.
 */
export async function shopState(sql: Sql, userId: string, admin = false): Promise<ShopState> {
  // (Its four reads at once: every D1 read is a round trip, and /api/me waits on this.)
  const [inventory, rows, wallet, picks] = await Promise.all([
    sql.all<{ item_id: string }>("SELECT item_id FROM inventory WHERE user_id = ?", userId),
    sql.all<{ slot: string; item_id: string }>("SELECT slot, item_id FROM equipped WHERE user_id = ?", userId),
    sql.first<{ coins: number }>("SELECT coins FROM wallets WHERE user_id = ?", userId),
    storedChatPicks(sql, userId),
  ]);
  const stored = inventory.map((r) => r.item_id).filter((id) => shopItem(id));
  const starters = SHOP_ITEMS.filter((i) => i.starter).map((i) => i.id);
  const all = [...new Set([...starters, ...stored])];
  const copies = admin ? adminShopCopies(all) : [];
  const owned = [...all, ...copies];
  const equipped = Object.fromEntries(SHOP_CATEGORIES.filter((c) => !c.ownOnly).map((c) => [c.slot, starterItem(c.slot).id])) as Record<EquipSlot, string>;
  for (const r of rows) {
    const item = shopItem(r.item_id);
    if (item && item.slot !== "chat" && item.slot === r.slot && owned.includes(item.id)) equipped[item.slot] = item.id;
  }
  return { coins: wallet?.coins ?? 0, owned, equipped, chat: chatPicks(picks, all), ...(copies.length ? { admin: copies } : {}) };
}

/** Quick chat picks as stored (each kind a list, or null for the defaults). */
async function storedChatPicks(sql: Sql, userId: string): Promise<StoredChatPicks> {
  const row = await sql.first<{ lines: string | null; emoji: string | null }>("SELECT lines, emoji FROM chat_picks WHERE user_id = ?", userId);
  const list = (v: string | null | undefined): string[] | null => {
    if (v === null || v === undefined) return null;
    try {
      const x = JSON.parse(v) as unknown;
      return Array.isArray(x) ? x.filter((id): id is string => typeof id === "string") : null;
    } catch {
      return null;
    }
  };
  return { lines: list(row?.lines), emoji: list(row?.emoji) };
}

async function storeChatPicks(sql: Sql, userId: string, kind: ChatPickKind, ids: readonly string[] | null): Promise<void> {
  const v = ids === null ? null : JSON.stringify(ids);
  await sql.run("INSERT OR IGNORE INTO chat_picks (user_id) VALUES (?)", userId);
  await sql.run(`UPDATE chat_picks SET ${kind === "lines" ? "lines" : "emoji"} = ? WHERE user_id = ?`, v, userId);
}

/**
 * Quick chat: the lines and/or emoji a player picked in their profile, in their order. Each is cleaned (known lines
 * of that kind, from packs they own, no repeats, at most the cap); null puts that kind back to the defaults.
 */
export async function setChatPicks(sql: Sql, userId: string, body: { lines?: unknown; emoji?: unknown }, admin = false): Promise<ShopState> {
  const packs = ownedChatPacks((await shopState(sql, userId)).owned);
  for (const kind of ["lines", "emoji"] as const) {
    const v = body[kind];
    if (v === null) await storeChatPicks(sql, userId, kind, null);
    else if (Array.isArray(v)) await storeChatPicks(sql, userId, kind, cleanChatPickList(v, kind, packs));
  }
  return shopState(sql, userId, admin);
}

/**
 * Gets an item (free while SHOP_FREE is on, otherwise paid in coins). What you really own decides (an admin copy is
 * never one: it neither stops nor pays for a real one); `admin` only shapes the shop it answers with, as shopState's.
 */
export async function buyItem(sql: Sql, userId: string, itemId: unknown, now: number, admin = false): Promise<{ ok: true; shop: ShopState } | { ok: false; message: string }> {
  const item = typeof itemId === "string" ? shopItem(itemId) : undefined;
  if (!item) return { ok: false, message: "That item isn't in the shop." };
  const state = await shopState(sql, userId);
  if (state.owned.includes(item.id)) return { ok: true, shop: admin ? await shopState(sql, userId, true) : state };
  const price = SHOP_FREE ? 0 : item.price;
  if (price > state.coins) return { ok: false, message: "Not enough coins." };
  // One op in the ledger (`shop:<ledger id>:<item>`; ledger.ts), as one transaction (D1's batch: all of it or none), as another buy
  // may have run since the read above (docs/decisions/2026-10-16-atomic-shop-purchase.md): it applies only while the item isn't yours
  // and the coins are there, checked in that same transaction; then the item goes in and the coins come off. Two taps on one item pay
  // once (the second is the same op); two items at once can't go below zero.
  const me = await ledgerAccount(sql, userId);
  const done = me
    ? await applyOp(sql, me, {
        id: `shop:${me.account}:${item.id}`,
        reason: "shop",
        now,
        when: price
          ? cond("NOT EXISTS (SELECT 1 FROM inventory WHERE user_id = ? AND item_id = ?) AND EXISTS (SELECT 1 FROM wallets WHERE user_id = ? AND coins >= ?)", userId, item.id, userId, price)
          : cond("NOT EXISTS (SELECT 1 FROM inventory WHERE user_id = ? AND item_id = ?)", userId, item.id),
        legs: [leg.shopItem(userId, item.id, now), ...(price ? [leg.coins(userId, -price)] : [])],
      })
    : "refused";
  // Owned: bought now, or by another buy since (this one refused, changing nothing): a no-op success, as above.
  if (done !== "applied" && !(await sql.first("SELECT 1 FROM inventory WHERE user_id = ? AND item_id = ?", userId, item.id))) return { ok: false, message: "Not enough coins." };
  // A chat pack's lines go into any empty slots of the player's quick chat (the rest they pick in their profile).
  if (item.slot === "chat" && item.look.pack) {
    const { picks, added } = chatPicksAfterGetting(state.chat, item.look.pack);
    const kind: ChatPickKind = chatPack(item.look.pack)?.kind === "emoji" ? "emoji" : "lines";
    if (added.length) await storeChatPicks(sql, userId, kind, picks[kind]);
  }
  return { ok: true, shop: await shopState(sql, userId, admin) };
}

/** Equips an item you own in its slot. `admin`: as shopState's, so an admin may wear any God King effect. */
export async function equipItem(sql: Sql, userId: string, itemId: unknown, admin = false): Promise<{ ok: true; shop: ShopState } | { ok: false; message: string }> {
  const item = typeof itemId === "string" ? shopItem(itemId) : undefined;
  if (!item) return { ok: false, message: "That item isn't in the shop." };
  const state = await shopState(sql, userId, admin);
  if (!state.owned.includes(item.id)) return { ok: false, message: "Get it first." };
  // Chat packs aren't equipped: every one you own is yours to use.
  if (item.slot === "chat") return { ok: true, shop: state };
  await sql.run("INSERT INTO equipped (user_id, slot, item_id) VALUES (?, ?, ?) ON CONFLICT (user_id, slot) DO UPDATE SET item_id = excluded.item_id", userId, item.slot, item.id);
  return { ok: true, shop: await shopState(sql, userId, admin) };
}

/**
 * A placement reward (Squads): coins into the wallet, and crates of the newest series (XP.rewardCrate, since Nov 9: each opens with a
 * crate key). One ledger
 * op, keyed by `op` (Squads': opKeys.squadsReward, so its lobby can write it again after a failure or a restart and it pays once;
 * none: a fresh key). `cap`: a guard on the account's ledger id (Squads' daily cap): "refused" past it. Answers what became of it; null:
 * nothing to give, or no such account (deleted mid-match). A failed write throws.
 */
export async function grantReward(sql: Sql, userId: string, coins: number, crates: number, op?: OpKey, now = Date.now(), cap?: (account: string) => Cond): Promise<Outcome | null> {
  const c = Math.max(0, Math.round(coins));
  const k = Math.max(0, Math.round(crates));
  if (!c && !k) return null;
  const me = await ledgerAccount(sql, userId);
  if (!me) return null;
  return applyOp(sql, me, {
    id: op === undefined ? `reward:${crypto.randomUUID()}` : keyFor(op, me),
    reason: "reward",
    now,
    // (A daily cap, checked in the same statement as the reward goes in: refused past it.)
    ...(cap ? { when: cap(me.account) } : {}),
    legs: [...(c ? [leg.coins(userId, c)] : []), ...(k ? [leg.seriesCrates(userId, XP.rewardCrate, k)] : [])],
  });
}

/**
 * A guest's equipped choices and chat picks join the account they sign in to (the account's own choices win): the statements, for
 * the sign-in's one batch. (Its items, coins, crates and crate keys move with their ledger legs: ledger.ts, mergeMoves.)
 */
function shopMoves(from: string, to: string): Stmt[] {
  return [
    stmt("INSERT OR IGNORE INTO equipped (user_id, slot, item_id) SELECT ?, slot, item_id FROM equipped WHERE user_id = ?", to, from),
    stmt("INSERT OR IGNORE INTO chat_picks (user_id, lines, emoji) SELECT ?, lines, emoji FROM chat_picks WHERE user_id = ?", to, from),
    stmt("DELETE FROM equipped WHERE user_id = ?", from),
    stmt("DELETE FROM chat_picks WHERE user_id = ?", from),
  ];
}
