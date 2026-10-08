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
  FRONT_DOOR,
  SHOP_CATEGORIES,
  SHOP_FREE,
  SHOP_ITEMS,
  chatPack,
  chatPicks,
  chatPicksAfterGetting,
  cleanChatPickList,
  equippedLook,
  ownedChatPacks,
  ratingTier,
  shopItem,
  starterItem,
  topPercent,
  type ChatPickKind,
  type ItemLook,
  type RankEffect,
  type EquipSlot,
  type ShopState,
  type StoredChatPicks,
} from "@chessroyale/core";
import { LOCKER_MIGRATIONS, LOCKER_SCHEMA, lockerState, moveLocker, type LockerState } from "./locker.ts";
import { LIVE_SCHEMA } from "./live.ts";
import { FAIRPLAY_SCHEMA } from "./fairplay-schema.ts";

export interface Sql {
  run(sql: string, ...params: unknown[]): Promise<void>;
  first<T>(sql: string, ...params: unknown[]): Promise<T | null>;
  all<T>(sql: string, ...params: unknown[]): Promise<T[]>;
}

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
];

/**
 * Columns added after a table first shipped: [table, column, type]. Each is added once (the table's columns are
 * read first); `then` runs right after a column is added, to fill it in from what's already stored.
 */
const COLUMNS: { table: string; column: string; type: string; then?: string[] }[] = [
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
  // An online match's lobby code (Oct 7, 2026), so a closed lobby's link can offer "See your result". Never shown on a profile.
  { table: "results", column: "lobby", type: "TEXT" },
  // Whether a result counts for ranking (Oct 7, 2026): 1 ranked, 0 not (under 30% real players, solo, practice), NULL from
  // before the rule (counted as before). Ranking is the rating, its chart, "Top N%" and the rank.
  { table: "results", column: "ranked", type: "INTEGER" },
  // Fair play (Oct 8, 2026): a result held off ranking while its player is in review (1), released when cleared (0 or NULL).
  { table: "results", column: "held", type: "INTEGER" },
  // A report made during a match: that match's lobby code (one report per reporter, player and match).
  { table: "reports", column: "match", type: "TEXT" },
  // Each account's latest rating, for the percentile (filled in from the results already stored).
  { table: "users", column: "rating", type: "INTEGER", then: [`UPDATE users SET rating = ${LATEST_RATING("users.id")}`] },
];
const AFTER_COLUMNS = [`CREATE INDEX IF NOT EXISTS users_rating ON users (rating)`];

/**
 * The latest rating among a user's results that count for ranking (ranked, or from before the rule, and not held by a
 * fair-play review), in SQL.
 */
function LATEST_RATING(userId: string) {
  return `(SELECT r.rating FROM results r WHERE r.user_id = ${userId} AND r.rating IS NOT NULL AND (r.ranked IS NULL OR r.ranked = 1) AND (r.held IS NULL OR r.held = 0) ORDER BY r.played_at DESC, r.id DESC LIMIT 1)`;
}
/** A result row counts for ranking (ranked, or from before the rule; not held by a fair-play review). */
const countsForRanking = (r: { ranked: number | null; held?: number | null }) => r.ranked !== 0 && !r.held;

/** Sets an account's ranking rating from its results again (after results are held or released by fair play). */
export async function refreshRating(sql: Sql, userId: string): Promise<void> {
  await sql.run(`UPDATE users SET rating = ${LATEST_RATING("users.id")} WHERE id = ?`, userId);
}

const ready = new WeakSet<object>();
/** Every schema statement, as one fingerprint: a database that has it recorded needs none of them run again. */
const SCHEMA_VERSION = (() => {
  const text = JSON.stringify([SCHEMA, LOCKER_MIGRATIONS, COLUMNS, AFTER_COLUMNS]);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return `${text.length}-${(h >>> 0).toString(36)}`;
})();

/**
 * Creates the tables if they don't exist yet (once per Worker instance, cheap and idempotent). A database already
 * at this schema answers one read (`meta.schema`) instead of the ~35 statements: in a surge, every new Worker
 * instance runs this once, so it mustn't be a burst of statements into the one database (DECISIONS.md, "Capacity").
 */
export async function ensureSchema(sql: Sql, key: object = sql): Promise<void> {
  if (ready.has(key)) return;
  const at = await sql.first<{ value: string }>("SELECT value FROM meta WHERE key = 'schema'").catch(() => null);
  if (at?.value === SCHEMA_VERSION) {
    ready.add(key);
    return;
  }
  for (const s of SCHEMA) await sql.run(s);
  for (const s of LOCKER_MIGRATIONS)
    await sql.run(s).catch((e: unknown) => {
      if (!/duplicate column/i.test(String(e))) throw e;
    });
  const have = new Map<string, Set<string> | null>();
  for (const c of COLUMNS) {
    if (!have.has(c.table)) {
      const cols = await sql.all<{ name: string }>(`PRAGMA table_info(${c.table})`).catch(() => null);
      have.set(c.table, cols ? new Set(cols.map((r) => r.name)) : null);
    }
    if (have.get(c.table)?.has(c.column)) continue;
    const added = await sql.run(`ALTER TABLE ${c.table} ADD COLUMN ${c.column} ${c.type}`).then(
      () => true,
      (e: unknown) => {
        if (!/duplicate column/i.test(String(e))) throw e;
        return false;
      },
    );
    if (added) for (const t of c.then ?? []) await sql.run(t);
  }
  for (const s of AFTER_COLUMNS) await sql.run(s);
  await sql.run("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  await sql.run("INSERT INTO meta (key, value) VALUES ('schema', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", SCHEMA_VERSION);
  ready.add(key);
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

/** A display name: trimmed, 1-16 visible characters, no control characters. */
export function cleanName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const n = name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 16);
  return n.length ? n : null;
}

/** A normalised email address, or null if it doesn't look like one. */
export function cleanEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const e = email.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

export interface User {
  id: string;
  name: string;
  icon: string;
  email: string | null;
  google_sub: string | null;
  created_at: number;
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
  sql.first<User>("SELECT id, name, icon, email, google_sub, created_at FROM users WHERE id = ?", id);

/** The user a session token belongs to (null if unknown or expired). */
/**
 * `touch` marks the account as seen: by default a D1 write (at most every 15 s); the Worker passes the live hub's
 * presence instead (presence.ts), which writes D1 at most once a minute.
 */
export async function userFromToken(sql: Sql, token: string | null | undefined, now: number, touch?: (userId: string) => unknown): Promise<User | null> {
  if (!token) return null;
  const s = await sql.first<{ user_id: string; expires_at: number }>("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?", await sha256(token));
  if (!s || s.expires_at < now) return null;
  if (touch) touch(s.user_id);
  else await touchUser(sql, s.user_id, now);
  return getUser(sql, s.user_id);
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

export async function updateProfile(sql: Sql, userId: string, patch: { name?: unknown; icon?: unknown }): Promise<User> {
  const name = patch.name === undefined ? null : cleanName(patch.name);
  if (name) await sql.run("UPDATE users SET name = ? WHERE id = ?", name, userId);
  // A drawn icon (the icon builder), or one of the old emoji icons.
  if (isPixelIcon(patch.icon) || (typeof patch.icon === "string" && (ICONS as readonly string[]).includes(patch.icon))) {
    await sql.run("UPDATE users SET icon = ? WHERE id = ?", patch.icon, userId);
  }
  return (await getUser(sql, userId))!;
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
  extra: { email?: string | null; name?: string | null } = {},
  now: number,
): Promise<User> {
  const col = kind === "google" ? "google_sub" : "email";
  const owner = await sql.first<User>(`SELECT id, name, icon, email, google_sub, created_at FROM users WHERE ${col} = ?`, value);
  if (owner) {
    if (current && current.id !== owner.id && !current.email && !current.google_sub) {
      // A guest signing in to an existing account: bring the guest's matches along.
      await sql.run("UPDATE results SET user_id = ? WHERE user_id = ?", owner.id, current.id);
      await sql.run(`UPDATE users SET rating = ${LATEST_RATING("users.id")} WHERE id = ?`, owner.id);
      await moveShop(sql, current.id, owner.id);
      await sql.run("DELETE FROM sessions WHERE user_id = ?", current.id);
      await sql.run("DELETE FROM users WHERE id = ?", current.id);
    }
    return owner;
  }
  if (current && !current[col]) {
    await sql.run(`UPDATE users SET ${col} = ? WHERE id = ?`, value, current.id);
    // A Google account brings its email too, when no other account uses it.
    if (kind === "google" && extra.email && !current.email) {
      const taken = await sql.first("SELECT id FROM users WHERE email = ?", extra.email);
      if (!taken) await sql.run("UPDATE users SET email = ? WHERE id = ?", extra.email, current.id);
    }
    return (await getUser(sql, current.id))!;
  }
  const id = randomToken(12);
  await sql.run(
    `INSERT INTO users (id, name, ${col}, created_at, last_seen) VALUES (?, ?, ?, ?, ?)`,
    id,
    cleanName(extra.name) ?? (kind === "email" ? value.split("@")[0]!.slice(0, 16) : "Player"),
    value,
    now,
    now,
  );
  return (await getUser(sql, id))!;
}

// ---------------- Email codes ----------------

const CODE_MINUTES = 10;
const RESEND_SECONDS = 30;
const SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

export type CodeStart = { ok: true; code: string } | { ok: false; message: string };

/** A fresh 6-digit sign-in code for an address (rate-limited). */
export async function startEmailCode(sql: Sql, email: string, now: number): Promise<CodeStart> {
  const row = await sql.first<{ sent_at: number; hour_start: number; sends_this_hour: number }>(
    "SELECT sent_at, hour_start, sends_this_hour FROM email_codes WHERE email = ?",
    email,
  );
  if (row && now - row.sent_at < RESEND_SECONDS * 1000) return { ok: false, message: "A code was just sent. Wait a few seconds and try again." };
  const newHour = !row || now - row.hour_start > 3_600_000;
  const sends = newHour ? 0 : row!.sends_this_hour;
  if (sends >= SENDS_PER_HOUR) return { ok: false, message: "Too many codes for this address. Try again in an hour." };
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000;
  const code = String(n).padStart(6, "0");
  await sql.run(
    `INSERT INTO email_codes (email, code_hash, expires_at, attempts, sent_at, hour_start, sends_this_hour)
     VALUES (?, ?, ?, 0, ?, ?, ?)
     ON CONFLICT (email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0,
       sent_at = excluded.sent_at, hour_start = excluded.hour_start, sends_this_hour = excluded.sends_this_hour`,
    email,
    await sha256(`${email}:${code}`),
    now + CODE_MINUTES * 60_000,
    now,
    newHour ? now : row!.hour_start,
    sends + 1,
  );
  return { ok: true, code };
}

/** Checks a code; it works once, for 10 minutes, with 5 tries. */
export async function verifyEmailCode(sql: Sql, email: string, code: string, now: number): Promise<boolean> {
  const row = await sql.first<{ code_hash: string; expires_at: number; attempts: number }>(
    "SELECT code_hash, expires_at, attempts FROM email_codes WHERE email = ?",
    email,
  );
  if (!row || row.expires_at < now || row.attempts >= MAX_ATTEMPTS) return false;
  const ok = row.code_hash === (await sha256(`${email}:${String(code).trim()}`));
  if (ok) await sql.run("UPDATE email_codes SET expires_at = 0 WHERE email = ?", email);
  else await sql.run("UPDATE email_codes SET attempts = attempts + 1 WHERE email = ?", email);
  return ok;
}

// ---------------- Results and profiles ----------------

export interface MatchResult {
  mode: "classic" | "crowd" | "boss";
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
  /** An online match: its lobby's code (the server sets it; a solo result has none). */
  lobby?: string | null;
  /** It counts for ranking (the lobby decides: isRankedMatch). Solo results never do. */
  ranked?: boolean | null;
  /** Held off ranking: its player is in a fair-play review (or banned). Counted again if they're cleared. */
  held?: boolean;
}

/** A count from a result (0-500), or null. */
const count = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(500, Math.round(n))) : null);
const flag = (b: unknown) => (b === true ? 1 : b === false ? 0 : null);
/** A move in SAN (e.g. Nxe5, O-O-O, e8=Q+), or null. */
export const cleanSan = (m: unknown) => (typeof m === "string" && /^(?:[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?|O-O(?:-O)?)[+#]?$/.test(m) ? m : null);

export async function recordResult(sql: Sql, userId: string, r: MatchResult, now: number): Promise<void> {
  const rating = typeof r.rating === "number" && Number.isFinite(r.rating) ? Math.round(r.rating) : null;
  const cuts = count(r.cuts);
  const strikes = count(r.strikes);
  const mode = r.mode === "crowd" || r.mode === "boss" ? r.mode : "classic";
  // Only an online match the lobby judged ranked counts (a solo result, posted by the browser, never does).
  const ranked = r.online && r.ranked === true;
  await sql.run(
    `INSERT INTO results (user_id, mode, online, placement, players, team, team_won, avg_score, rating, played_at,
       brilliant, best_move, cuts, cuts_survived, strikes, strikes_survived, survived, last_stand, boss_elo, lobby, ranked, held)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    r.online && typeof r.lobby === "string" && /^[A-Z2-9]{5}$/.test(r.lobby) ? r.lobby : null,
    ranked ? 1 : 0,
    r.held ? 1 : 0,
  );
  // Only a ranked match moves your ranking (and not while fair play holds your results).
  if (rating !== null && ranked && !r.held) await sql.run("UPDATE users SET rating = ? WHERE id = ?", rating, userId);
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
  user: Pick<User, "id" | "name" | "icon"> & { signedIn: boolean; email: string | null; google: boolean };
  shop: ShopState;
  locker: LockerState;
  stats: { all: ModeStats; classic: ModeStats; crowd: ModeStats; boss: ModeStats };
  rating: number | null;
  recent: { mode: string; online: boolean; placement: number; players: number; teamWon: boolean | null; playedAt: number }[];
}

export async function profile(sql: Sql, user: User): Promise<Profile> {
  const rows = await sql.all<{ mode: string; online: number; placement: number; players: number; team_won: number | null; rating: number | null; played_at: number; ranked: number | null; held: number | null }>(
    "SELECT mode, online, placement, players, team_won, rating, played_at, ranked, held FROM results WHERE user_id = ? ORDER BY played_at DESC",
    user.id,
  );
  const stats = (rs: typeof rows): ModeStats => ({
    matches: rs.length,
    wins: rs.filter((r) => r.placement === 1).length,
    finals: rs.filter((r) => r.placement <= 4).length,
    avgPlacement: rs.length ? Math.round((rs.reduce((s, r) => s + r.placement, 0) / rs.length) * 10) / 10 : null,
    best: rs.length ? Math.min(...rs.map((r) => r.placement)) : null,
    teamWins: rs.filter((r) => r.team_won === 1).length,
  });
  return {
    user: { id: user.id, name: user.name, icon: user.icon, signedIn: !!(user.email || user.google_sub), email: user.email, google: !!user.google_sub },
    shop: await shopState(sql, user.id),
    locker: await lockerState(sql, user.id),
    stats: { all: stats(rows), classic: stats(rows.filter((r) => r.mode === "classic")), crowd: stats(rows.filter((r) => r.mode === "crowd")), boss: stats(rows.filter((r) => r.mode === "boss")) },
    rating: rows.find((r) => r.rating !== null && countsForRanking(r))?.rating ?? null,
    recent: rows.slice(0, 10).map((r) => ({
      mode: r.mode,
      online: !!r.online,
      placement: r.placement,
      players: r.players,
      teamWon: r.team_won === null ? null : r.team_won === 1,
      playedAt: r.played_at,
    })),
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
  /** Different bosses (tiers) beaten. */
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
 * What anyone can see of a player: no email, no sign-in method, no icon, nothing about the account itself.
 * The same structure for your own profile and everyone else's.
 */
export interface PublicProfile {
  id: string;
  name: string;
  /** What they wear: crate items, and the shop hat (shown when no crate item is on the head). */
  look: ItemLook;
  hat: string;
  joinedAt: number;
  lastSeen: number | null;
  online: boolean;
  rating: number | null;
  /** The rank ("Weighty"), its place on the ladder (0 = Novice), its colour and a top rank's pill effect. */
  tier: { label: string; level: number; color: string; effect: RankEffect | null } | null;
  /** "Top 18%" among rated players (null until enough players have a rating). */
  topPercent: number | null;
  /** Banned for fair play (the profile says "Banned"; nothing else about a fair-play case is ever shown). */
  banned: boolean;
  crowd: CrowdStats;
  boss: RaidStats;
  /** The rating after each of the last 30 rated matches, oldest first. */
  ratingHistory: number[];
  /** Boss tiers (their strengths) beaten in raids. */
  bossesBeaten: number[];
  recent: {
    mode: string;
    online: boolean;
    placement: number;
    players: number;
    /** Crowd: the side played (50 v 50), or null (everyone moves). */
    team: "w" | "b" | null;
    won: boolean | null;
    /** A boss battle: still standing at the end. */
    survived: boolean | null;
    bestMove: string | null;
    bossElo: number | null;
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
    bossesBeaten: new Set(rows.filter((r) => r.team_won === 1 && r.boss_elo !== null).map((r) => r.boss_elo)).size,
    strikesSurvived: sumOf(rows, (r) => r.strikes_survived),
    lastStands: sumOf(rows, (r) => r.last_stand),
    survivedPct: standing.length ? pct(standing.filter((r) => r.survived === 1).length, standing.length) : null,
    brilliant: sumOf(rows, (r) => r.brilliant),
  };
}

/** Anyone's profile by account id (null if there's no such account). */
export async function publicProfile(sql: Sql, userId: string, now: number): Promise<PublicProfile | null> {
  const u = await sql.first<{ id: string; name: string; created_at: number; last_seen: number | null; rating: number | null }>(
    "SELECT id, name, created_at, last_seen, rating FROM users WHERE id = ?",
    userId,
  );
  if (!u) return null;
  const rows = await sql.all<ResultRow>(
    `SELECT mode, online, placement, players, team, team_won, rating, played_at, brilliant, best_move, cuts, cuts_survived, strikes,
       strikes_survived, survived, last_stand, boss_elo, ranked, held
     FROM results WHERE user_id = ? ORDER BY played_at DESC, id DESC`,
    userId,
  );
  const rating = u.rating ?? rows.find((r) => r.rating !== null && countsForRanking(r))?.rating ?? null;
  let top: number | null = null;
  if (rating !== null) {
    const total = (await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE rating IS NOT NULL"))?.n ?? 0;
    if (total >= FRONT_DOOR.percentileMinPlayers) {
      const above = (await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE rating > ?", rating))?.n ?? 0;
      top = topPercent(above + 1, total);
    }
  }
  const raids = rows.filter((r) => r.mode === "boss");
  const banned = (await sql.first<{ status: string }>("SELECT status FROM fairplay_cases WHERE user_id = ?", userId))?.status === "banned";
  const tier = ratingTier(banned ? null : rating);
  return {
    id: u.id,
    name: u.name,
    look: (await lockerState(sql, u.id)).look,
    hat: equippedLook(await shopState(sql, u.id), "hat").hat ?? "none",
    joinedAt: u.created_at,
    lastSeen: u.last_seen,
    online: u.last_seen !== null && now - u.last_seen < FRONT_DOOR.onlineWindowMs,
    rating: banned ? null : rating,
    tier: tier ? { label: tier.label, level: tier.level, color: tier.color, effect: tier.effect } : null,
    topPercent: banned ? null : top,
    banned,
    crowd: crowdStats(rows.filter((r) => r.mode === "crowd")),
    boss: raidStats(raids),
    ratingHistory: rows
      .filter((r) => r.rating !== null && countsForRanking(r))
      .slice(0, 30)
      .map((r) => r.rating!)
      .reverse(),
    bossesBeaten: [...new Set(raids.filter((r) => r.team_won === 1 && r.boss_elo !== null).map((r) => r.boss_elo!))].sort((a, b) => a - b),
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
      playedAt: r.played_at,
      ranked: r.ranked === null ? null : r.ranked === 1,
    })),
  };
}

// ---------------- The shop ----------------

/** Coins, items owned (starters included) and what's equipped in each slot. */
export async function shopState(sql: Sql, userId: string): Promise<ShopState> {
  const owned = (await sql.all<{ item_id: string }>("SELECT item_id FROM inventory WHERE user_id = ?", userId)).map((r) => r.item_id).filter((id) => shopItem(id));
  const starters = SHOP_ITEMS.filter((i) => i.starter).map((i) => i.id);
  const all = [...new Set([...starters, ...owned])];
  const rows = await sql.all<{ slot: string; item_id: string }>("SELECT slot, item_id FROM equipped WHERE user_id = ?", userId);
  const equipped = Object.fromEntries(SHOP_CATEGORIES.filter((c) => !c.ownOnly).map((c) => [c.slot, starterItem(c.slot).id])) as Record<EquipSlot, string>;
  for (const r of rows) {
    const item = shopItem(r.item_id);
    if (item && item.slot !== "chat" && item.slot === r.slot && all.includes(item.id)) equipped[item.slot] = item.id;
  }
  const wallet = await sql.first<{ coins: number }>("SELECT coins FROM wallets WHERE user_id = ?", userId);
  return { coins: wallet?.coins ?? 0, owned: all, equipped, chat: chatPicks(await storedChatPicks(sql, userId), all) };
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
export async function setChatPicks(sql: Sql, userId: string, body: { lines?: unknown; emoji?: unknown }): Promise<ShopState> {
  const packs = ownedChatPacks((await shopState(sql, userId)).owned);
  for (const kind of ["lines", "emoji"] as const) {
    const v = body[kind];
    if (v === null) await storeChatPicks(sql, userId, kind, null);
    else if (Array.isArray(v)) await storeChatPicks(sql, userId, kind, cleanChatPickList(v, kind, packs));
  }
  return shopState(sql, userId);
}

/** Gets an item (free while SHOP_FREE is on, otherwise paid in coins). */
export async function buyItem(sql: Sql, userId: string, itemId: unknown, now: number): Promise<{ ok: true; shop: ShopState } | { ok: false; message: string }> {
  const item = typeof itemId === "string" ? shopItem(itemId) : undefined;
  if (!item) return { ok: false, message: "That item isn't in the shop." };
  const state = await shopState(sql, userId);
  if (state.owned.includes(item.id)) return { ok: true, shop: state };
  const price = SHOP_FREE ? 0 : item.price;
  if (price > state.coins) return { ok: false, message: "Not enough coins." };
  if (price > 0) await sql.run("UPDATE wallets SET coins = coins - ? WHERE user_id = ?", price, userId);
  await sql.run("INSERT OR IGNORE INTO inventory (user_id, item_id, acquired_at) VALUES (?, ?, ?)", userId, item.id, now);
  // A chat pack's lines go into any empty slots of the player's quick chat (the rest they pick in their profile).
  if (item.slot === "chat" && item.look.pack) {
    const { picks, added } = chatPicksAfterGetting(state.chat, item.look.pack);
    const kind: ChatPickKind = chatPack(item.look.pack)?.kind === "emoji" ? "emoji" : "lines";
    if (added.length) await storeChatPicks(sql, userId, kind, picks[kind]);
  }
  return { ok: true, shop: await shopState(sql, userId) };
}

/** Equips an item you own in its slot. */
export async function equipItem(sql: Sql, userId: string, itemId: unknown): Promise<{ ok: true; shop: ShopState } | { ok: false; message: string }> {
  const item = typeof itemId === "string" ? shopItem(itemId) : undefined;
  if (!item) return { ok: false, message: "That item isn't in the shop." };
  const state = await shopState(sql, userId);
  if (!state.owned.includes(item.id)) return { ok: false, message: "Get it first." };
  // Chat packs aren't equipped: every one you own is yours to use.
  if (item.slot === "chat") return { ok: true, shop: state };
  await sql.run("INSERT INTO equipped (user_id, slot, item_id) VALUES (?, ?, ?) ON CONFLICT (user_id, slot) DO UPDATE SET item_id = excluded.item_id", userId, item.slot, item.id);
  return { ok: true, shop: await shopState(sql, userId) };
}

/** A guest's items, equipped choices and coins join the account they sign in to (the account's own choices win). */
async function moveShop(sql: Sql, from: string, to: string): Promise<void> {
  await sql.run("INSERT OR IGNORE INTO inventory (user_id, item_id, acquired_at) SELECT ?, item_id, acquired_at FROM inventory WHERE user_id = ?", to, from);
  await sql.run("INSERT OR IGNORE INTO equipped (user_id, slot, item_id) SELECT ?, slot, item_id FROM equipped WHERE user_id = ?", to, from);
  const coins = (await sql.first<{ coins: number }>("SELECT coins FROM wallets WHERE user_id = ?", from))?.coins ?? 0;
  if (coins > 0) {
    await sql.run("INSERT INTO wallets (user_id, coins) VALUES (?, ?) ON CONFLICT (user_id) DO UPDATE SET coins = coins + excluded.coins", to, coins);
  }
  await sql.run("INSERT OR IGNORE INTO chat_picks (user_id, lines, emoji) SELECT ?, lines, emoji FROM chat_picks WHERE user_id = ?", to, from);
  await sql.run("DELETE FROM inventory WHERE user_id = ?", from);
  await sql.run("DELETE FROM equipped WHERE user_id = ?", from);
  await sql.run("DELETE FROM wallets WHERE user_id = ?", from);
  await sql.run("DELETE FROM chat_picks WHERE user_id = ?", from);
  await moveLocker(sql, from, to);
}
