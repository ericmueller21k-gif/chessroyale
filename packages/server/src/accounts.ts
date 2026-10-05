/**
 * Accounts, sessions, profiles and match results, stored in Cloudflare D1
 * (SQLite). Everyone gets a guest account the first time they open the site;
 * signing in with Google or an emailed code attaches that identity to it, so
 * a profile follows you across devices. Written against a tiny SQL interface
 * so it can be tested with an in-memory SQLite.
 */

import { SHOP_CATEGORIES, SHOP_FREE, SHOP_ITEMS, shopItem, starterItem, type ShopSlot, type ShopState } from "@chessroyale/core";

export interface Sql {
  run(sql: string, ...params: unknown[]): Promise<void>;
  first<T>(sql: string, ...params: unknown[]): Promise<T | null>;
  all<T>(sql: string, ...params: unknown[]): Promise<T[]>;
}

/** The SQL interface over a D1 binding. */
export function d1Sql(db: D1Database): Sql {
  return {
    async run(sql, ...params) {
      await db.prepare(sql).bind(...params).run();
    },
    async first(sql, ...params) {
      return (await db.prepare(sql).bind(...params).first()) as never;
    },
    async all(sql, ...params) {
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
];

const ready = new WeakSet<object>();
/** Creates the tables if they don't exist yet (once per connection; cheap and idempotent). */
export async function ensureSchema(sql: Sql, key: object = sql): Promise<void> {
  if (ready.has(key)) return;
  for (const s of SCHEMA) await sql.run(s);
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
export async function userFromToken(sql: Sql, token: string | null | undefined, now: number): Promise<User | null> {
  if (!token) return null;
  const s = await sql.first<{ user_id: string; expires_at: number }>("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?", await sha256(token));
  if (!s || s.expires_at < now) return null;
  await sql.run("UPDATE users SET last_seen = ? WHERE id = ?", now, s.user_id);
  return getUser(sql, s.user_id);
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
}

export async function recordResult(sql: Sql, userId: string, r: MatchResult, now: number): Promise<void> {
  await sql.run(
    "INSERT INTO results (user_id, mode, online, placement, players, team, team_won, avg_score, rating, played_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    userId,
    r.mode === "crowd" || r.mode === "boss" ? r.mode : "classic",
    r.online ? 1 : 0,
    Math.max(1, Math.round(r.placement)),
    Math.max(1, Math.round(r.players)),
    r.team ?? null,
    r.teamWon === undefined || r.teamWon === null ? null : r.teamWon ? 1 : 0,
    r.avgScore ?? null,
    r.rating ?? null,
    now,
  );
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
  stats: { all: ModeStats; classic: ModeStats; crowd: ModeStats; boss: ModeStats };
  rating: number | null;
  recent: { mode: string; online: boolean; placement: number; players: number; teamWon: boolean | null; playedAt: number }[];
}

export async function profile(sql: Sql, user: User): Promise<Profile> {
  const rows = await sql.all<{ mode: string; online: number; placement: number; players: number; team_won: number | null; rating: number | null; played_at: number }>(
    "SELECT mode, online, placement, players, team_won, rating, played_at FROM results WHERE user_id = ? ORDER BY played_at DESC",
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
    stats: { all: stats(rows), classic: stats(rows.filter((r) => r.mode === "classic")), crowd: stats(rows.filter((r) => r.mode === "crowd")), boss: stats(rows.filter((r) => r.mode === "boss")) },
    rating: rows.find((r) => r.rating !== null)?.rating ?? null,
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

// ---------------- The shop ----------------

/** Coins, items owned (starters included) and what's equipped in each slot. */
export async function shopState(sql: Sql, userId: string): Promise<ShopState> {
  const owned = (await sql.all<{ item_id: string }>("SELECT item_id FROM inventory WHERE user_id = ?", userId)).map((r) => r.item_id).filter((id) => shopItem(id));
  const starters = SHOP_ITEMS.filter((i) => i.starter).map((i) => i.id);
  const all = [...new Set([...starters, ...owned])];
  const rows = await sql.all<{ slot: string; item_id: string }>("SELECT slot, item_id FROM equipped WHERE user_id = ?", userId);
  const equipped = Object.fromEntries(SHOP_CATEGORIES.map((c) => [c.slot, starterItem(c.slot).id])) as Record<ShopSlot, string>;
  for (const r of rows) {
    const item = shopItem(r.item_id);
    if (item && item.slot === r.slot && all.includes(item.id)) equipped[item.slot] = item.id;
  }
  const wallet = await sql.first<{ coins: number }>("SELECT coins FROM wallets WHERE user_id = ?", userId);
  return { coins: wallet?.coins ?? 0, owned: all, equipped };
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
  return { ok: true, shop: await shopState(sql, userId) };
}

/** Equips an item you own in its slot. */
export async function equipItem(sql: Sql, userId: string, itemId: unknown): Promise<{ ok: true; shop: ShopState } | { ok: false; message: string }> {
  const item = typeof itemId === "string" ? shopItem(itemId) : undefined;
  if (!item) return { ok: false, message: "That item isn't in the shop." };
  const state = await shopState(sql, userId);
  if (!state.owned.includes(item.id)) return { ok: false, message: "Get it first." };
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
  await sql.run("DELETE FROM inventory WHERE user_id = ?", from);
  await sql.run("DELETE FROM equipped WHERE user_id = ?", from);
  await sql.run("DELETE FROM wallets WHERE user_id = ?", from);
}
