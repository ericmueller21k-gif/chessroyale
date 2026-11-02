import {
  BOSS_CRATE_PRICE,
  BOSS_TOKENS,
  TOKEN_WINDOW_MS,
  battleCounts,
  bossCrateDef,
  dropBosses,
  dropLimit,
  isTokenBoss,
  mulberry32,
  rollCrate,
  tokenBossName,
  type CrateRoll,
  type ItemInstance,
} from "@chessroyale/core";
import type { Sql, Stmt } from "./accounts.ts";
import { lockerState, type LockerState } from "./locker.ts";

/**
 * Boss tokens, crate keys and buying a boss's crate (Eric, Nov 2; BOSS_TOKENS and BOSS_CRATE_PRICE in core's settings;
 * docs/decisions/2026-11-02-boss-tokens.md; docs/areas/shop.md, "Boss tokens"). Everything that counts is decided here, on the
 * server, with its own clock and randomness: whether a battle counted, whether it dropped a token, which boss's, and a purchase.
 *
 *   - An online boss battle is counted by its match room (lobby-do.ts, `saveResults`): the room counts each player's picks and
 *     knows when the match began, so "10 of your moves or 5 minutes" is its own count.
 *   - A solo boss battle (Boss alone, a Solo raid) runs on the device, so the server can't see its moves. It counts by the
 *     server's clock alone: the app asks to start one as the battle begins (`startSoloBattle`: the server notes the time) and
 *     finishes it on the result screen (`finishSoloBattle`): it counts when 5 minutes or more passed between the two, as the
 *     server saw them. One open at a time per account (a new start replaces the last), and each counts once.
 *   - Only signed-in accounts earn tokens where sign-in is set up (`signedInOnly`): a guest's things move to the account it signs
 *     in to, so many guests could fill one account past the window's cap.
 *
 * Tables (each an account's: account-data.ts, "bossTokens"): `boss_tokens` (how many of each boss's tokens an account holds),
 * `boss_token_drops` (every token a battle dropped: the rolling window counts these, and the result screen finds its battle's),
 * `solo_battles` (the solo battle an account has open), `boss_crates` (the boss crates an account bought and hasn't opened yet: one
 * row each, Nov 2). Crate keys are a wallet's `crate_keys` (accounts.ts, COLUMNS).
 * (Only types come from accounts.ts: it imports this file's schema while it loads.)
 */
export const BOSS_TOKENS_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS boss_tokens (
    user_id TEXT NOT NULL,
    boss TEXT NOT NULL,
    n INTEGER NOT NULL CHECK (n >= 0),
    PRIMARY KEY (user_id, boss)
  )`,
  `CREATE TABLE IF NOT EXISTS boss_token_drops (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    boss TEXT NOT NULL,
    at INTEGER NOT NULL,
    battle TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS boss_token_drops_user ON boss_token_drops (user_id, at)`,
  `CREATE TABLE IF NOT EXISTS solo_battles (
    user_id TEXT PRIMARY KEY,
    id TEXT NOT NULL,
    started_at INTEGER NOT NULL
  )`,
  // A boss crate bought and not opened yet (Eric, Nov 2: the buy puts it in your inventory; you open it there). One row a crate, so a
  // buy's payment and an opening's item each hang off the row they make or take, as the coin shop's item does (buyBossCrate,
  // openBossCrate). `crate`: its BOSS_CRATES id ("boss-tiger"). A new table: nothing older reads or writes it.
  `CREATE TABLE IF NOT EXISTS boss_crates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    crate TEXT NOT NULL,
    bought_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS boss_crates_user ON boss_crates (user_id, crate)`,
];

const stmt = (sql: string, ...params: unknown[]): Stmt => ({ sql, params });
const randomHex = (bytes: number) => [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
/** The server's own randomness, 0 to 1. */
export const serverRandom = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;

/** What a drop needs to know besides the account and the time. */
export interface DropOptions {
  /** The battle: an online match's lobby code, or a solo battle's id (the result screen finds its battle's drop by it). */
  battle: string;
  /** Bosses resting (kill switches): no tokens of theirs. */
  off?: readonly string[];
  /** Sign-in is set up here: only a signed-in account earns a token (a guest gets none). */
  signedInOnly?: boolean;
  /** The randomness (tests); the server's own otherwise. */
  rng?: () => number;
}

/**
 * A boss battle that counted: maybe a token (BOSS_TOKENS). The first in the rolling window always drops one; after that one in
 * four, up to the cap. Which boss's: one of the live bosses, each as likely. One transaction: the drop goes in only while the
 * window has room for it (counted in the same statement, so two battles counted at once can't both take the last place), and the
 * token comes with it, only if the drop went in. Answers the boss whose token dropped, or null. (An account deleted since gets
 * nothing.)
 */
export async function countBossBattle(sql: Sql, userId: string, now: number, opts: DropOptions): Promise<string | null> {
  const bosses = dropBosses(opts.off);
  if (!bosses.length) return null;
  const rng = opts.rng ?? serverRandom;
  const lucky = rng() < BOSS_TOKENS.chance;
  const boss = bosses[Math.min(bosses.length - 1, Math.floor(rng() * bosses.length))]!.id;
  const id = randomHex(12);
  await sql.batch([
    stmt(
      `INSERT INTO boss_token_drops (id, user_id, boss, at, battle)
       SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM users WHERE id = ? AND (? = 0 OR email IS NOT NULL OR google_sub IS NOT NULL))
         AND (SELECT COUNT(*) FROM boss_token_drops WHERE user_id = ? AND at > ?) < ?`,
      id,
      userId,
      boss,
      now,
      opts.battle.slice(0, 64),
      userId,
      opts.signedInOnly ? 1 : 0,
      userId,
      now - TOKEN_WINDOW_MS,
      dropLimit(lucky),
    ),
    stmt(
      `INSERT INTO boss_tokens (user_id, boss, n) SELECT ?, ?, 1 WHERE EXISTS (SELECT 1 FROM boss_token_drops WHERE id = ?)
       ON CONFLICT (user_id, boss) DO UPDATE SET n = n + 1`,
      userId,
      boss,
      id,
    ),
  ]);
  return (await sql.first("SELECT 1 FROM boss_token_drops WHERE id = ?", id)) ? boss : null;
}

/** A solo battle's id: 18 hex characters. */
const SOLO_ID = /^[0-9a-f]{18}$/;

/**
 * A solo boss battle begins (Boss alone, a Solo raid): the server notes when, by its own clock, and answers the battle's id (the
 * app sends it back from the result screen). One open at a time: this replaces any other (never counted). Null: this account
 * can't earn tokens (a guest where sign-in is set up), so nothing is noted.
 */
export async function startSoloBattle(sql: Sql, userId: string, now: number, signedInOnly: boolean): Promise<string | null> {
  if (signedInOnly && !(await sql.first("SELECT 1 FROM users WHERE id = ? AND (email IS NOT NULL OR google_sub IS NOT NULL)", userId))) return null;
  const id = randomHex(9);
  await sql.run(
    "INSERT INTO solo_battles (user_id, id, started_at) VALUES (?, ?, ?) ON CONFLICT (user_id) DO UPDATE SET id = excluded.id, started_at = excluded.started_at",
    userId,
    id,
    now,
  );
  return id;
}

/** A solo battle's end, as its result screen hears it. */
export interface SoloFinish {
  /** It counted: BOSS_TOKENS.minutes or more between its start and now, by the server's clock. */
  counted: boolean;
  /** The boss whose token it dropped, or null. */
  token: string | null;
}

/**
 * A solo boss battle ends (its result screen, victory or defeat): it's taken off the open battle in one statement (so it's
 * finished once, whoever asks twice), and it counts if the server's clock says BOSS_TOKENS.minutes passed since it began. Its
 * moves aren't counted: they're only the device's word. An unknown or replaced battle counts nothing.
 */
export async function finishSoloBattle(sql: Sql, userId: string, battle: unknown, now: number, opts: Omit<DropOptions, "battle"> = {}): Promise<SoloFinish> {
  if (typeof battle !== "string" || !SOLO_ID.test(battle)) return { counted: false, token: null };
  const row = await sql.first<{ started_at: number }>("DELETE FROM solo_battles WHERE user_id = ? AND id = ? RETURNING started_at", userId, battle);
  if (!row) return { counted: false, token: null };
  const counted = battleCounts({ moves: 0, ms: now - row.started_at });
  return { counted, token: counted ? await countBossBattle(sql, userId, now, { ...opts, battle }) : null };
}

/** How long the result screen may ask for its battle's token. */
const ASK_WITHIN_MS = 2 * 3_600_000;

/** The token an online battle (its lobby code) dropped for this account, if any: the result screen asks. */
export async function battleToken(sql: Sql, userId: string, battle: unknown, now: number): Promise<string | null> {
  if (typeof battle !== "string" || !/^[A-Z2-9]{5}$/.test(battle)) return null;
  const row = await sql.first<{ boss: string }>(
    "SELECT boss FROM boss_token_drops WHERE user_id = ? AND battle = ? AND at > ? ORDER BY at DESC LIMIT 1",
    userId,
    battle,
    now - ASK_WITHIN_MS,
  );
  return row?.boss ?? null;
}

/** An account's boss tokens (only bosses it has some of) and crate keys, for its locker. */
export async function tokenHoldings(sql: Sql, userId: string): Promise<{ tokens: Record<string, number>; keys: number }> {
  const rows = await sql.all<{ boss: string; n: number }>("SELECT boss, n FROM boss_tokens WHERE user_id = ? AND n > 0 ORDER BY boss", userId);
  const keys = (await sql.first<{ crate_keys: number | null }>("SELECT crate_keys FROM wallets WHERE user_id = ?", userId))?.crate_keys ?? 0;
  return { tokens: Object.fromEntries(rows.map((r) => [r.boss, r.n])), keys };
}

/** A boss crate's two prices: all tokens, or a token and a crate key. */
export type CrateWay = "tokens" | "key";
/** What a way costs. */
export const wayCost = (way: CrateWay) => (way === "tokens" ? { tokens: BOSS_CRATE_PRICE.tokens, keys: 0 } : BOSS_CRATE_PRICE.withKey);

/** Why a buy couldn't be paid: "You need 3 Babur tokens." / "You need 1 Babur token and 1 crate key." */
export function notEnough(boss: string, way: CrateWay): string {
  const c = wayCost(way);
  const n = (k: number, one: string) => `${k} ${one}${k === 1 ? "" : "s"}`;
  const tokens = n(c.tokens, `${tokenBossName(boss)} token`);
  return `You need ${c.keys ? `${tokens} and ${n(c.keys, "crate key")}` : tokens}.`;
}

/** The boss crates an account holds, unopened, by crate id ("boss-tiger": only those it has some of). */
export async function bossCrateHoldings(sql: Sql, userId: string): Promise<Record<string, number>> {
  const rows = await sql.all<{ crate: string; n: number }>("SELECT crate, COUNT(*) AS n FROM boss_crates WHERE user_id = ? GROUP BY crate ORDER BY crate", userId);
  return Object.fromEntries(rows.map((r) => [r.crate, r.n]));
}

/**
 * Buys a boss's crate (BOSS_CRATES) one of its two ways, into your inventory (Eric, Nov 2: "Buying a boss crate from shopkeepers adds
 * the crate to your inventory"; until then a buy opened it at once): a `boss_crates` row, unopened, which the Crates tab opens
 * (openBossCrate). One transaction (D1's batch: all of it or none; as the coin shop's buyItem): the crate goes in only if the tokens
 * (and the key) are there, then they come off, only if that crate went in. Nothing can change between the statements of one
 * transaction, so the price is paid exactly when the crate is given: never one without the other. Two taps or two devices at once
 * are two buys, each paid for in full or refused; a count can't go below zero (the table's CHECK, and the guards).
 */
export async function buyBossCrate(
  sql: Sql,
  userId: string,
  crateId: unknown,
  way: unknown,
  now: number,
  admin = false,
): Promise<{ ok: true; crate: string; locker: LockerState } | { ok: false; message: string }> {
  const crate = typeof crateId === "string" ? bossCrateDef(crateId) : undefined;
  if (!crate) return { ok: false, message: "No such crate." };
  if (way !== "tokens" && way !== "key") return { ok: false, message: "No such price." };
  const cost = wayCost(way);
  const id = randomHex(9);
  const paid = "EXISTS (SELECT 1 FROM boss_crates WHERE id = ? AND user_id = ?)";
  await sql.batch([
    stmt(
      `INSERT INTO boss_crates (id, user_id, crate, bought_at)
       SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM boss_tokens WHERE user_id = ? AND boss = ? AND n >= ?)
         AND (? = 0 OR EXISTS (SELECT 1 FROM wallets WHERE user_id = ? AND crate_keys >= ?))`,
      id,
      userId,
      crate.id,
      now,
      userId,
      crate.boss,
      cost.tokens,
      cost.keys,
      userId,
      cost.keys,
    ),
    stmt(`UPDATE boss_tokens SET n = n - ? WHERE user_id = ? AND boss = ? AND ${paid}`, cost.tokens, userId, crate.boss, id, userId),
    ...(cost.keys ? [stmt(`UPDATE wallets SET crate_keys = crate_keys - ? WHERE user_id = ? AND ${paid}`, cost.keys, userId, id, userId)] : []),
  ]);
  if (!(await sql.first(`SELECT 1 FROM boss_crates WHERE id = ? AND user_id = ?`, id, userId))) return { ok: false, message: notEnough(crate.boss, way) };
  return { ok: true, crate: crate.id, locker: await lockerState(sql, userId, admin) };
}

/** Why a boss crate couldn't be opened: "You have no Babur's Boss Crate to open." */
export const noneToOpen = (name: string) => `You have no ${name} to open.`;

/**
 * Opens one of your boss crates (the Crates tab, Nov 2), as a crate opens: the roll is the server's (its own randomness, never a test
 * switch: a boss crate is paid for), from that crate's pool, and the item goes into the locker. One transaction: the item goes in only
 * if you hold one of these crates, then one of them (the oldest) comes off, only if that item went in. So a crate opens once, never
 * twice (two taps or two devices at once: one item, one crate gone, the other refused), and nobody opens one they haven't got.
 */
export async function openBossCrate(
  sql: Sql,
  userId: string,
  crateId: unknown,
  now: number,
  admin = false,
): Promise<{ ok: true; roll: CrateRoll; item: ItemInstance; locker: LockerState } | { ok: false; message: string }> {
  const crate = typeof crateId === "string" ? bossCrateDef(crateId) : undefined;
  if (!crate) return { ok: false, message: "No such crate." };
  const roll = rollCrate(mulberry32(crypto.getRandomValues(new Uint32Array(1))[0]!), crate);
  const id = randomHex(9);
  await sql.batch([
    stmt(
      `INSERT INTO items (id, user_id, def, color, color2, blemish, seed, crate, fischer, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM boss_crates WHERE user_id = ? AND crate = ?)`,
      id,
      userId,
      roll.def,
      roll.color,
      roll.color2 ?? null,
      roll.blemish,
      roll.seed,
      crate.id,
      roll.fischer ? 1 : 0,
      now,
      userId,
      crate.id,
    ),
    stmt(
      `DELETE FROM boss_crates WHERE id = (SELECT id FROM boss_crates WHERE user_id = ? AND crate = ? ORDER BY bought_at, id LIMIT 1)
         AND EXISTS (SELECT 1 FROM items WHERE id = ? AND user_id = ?)`,
      userId,
      crate.id,
      id,
      userId,
    ),
  ]);
  if (!(await sql.first(`SELECT 1 FROM items WHERE id = ? AND user_id = ?`, id, userId))) return { ok: false, message: noneToOpen(crate.name) };
  const item: ItemInstance = { id, def: roll.def, color: roll.color, ...(roll.color2 ? { color2: roll.color2 } : {}), blemish: roll.blemish, seed: roll.seed };
  return { ok: true, roll, item, locker: await lockerState(sql, userId, admin) };
}

/** A whole number from 0 to BOSS_TOKENS.grantMax, or 0. */
const grantCount = (n: unknown) => (typeof n === "number" && Number.isInteger(n) ? Math.max(0, Math.min(BOSS_TOKENS.grantMax, n)) : 0);

/**
 * An admin's test grant (the Crates tab's admin box; the API checks it's an admin): crate keys, and any boss's tokens, to their
 * own account. Never a drop: the window doesn't count it.
 */
export async function grantTestItems(sql: Sql, userId: string, body: { keys?: unknown; boss?: unknown; tokens?: unknown }): Promise<{ ok: true } | { ok: false; message: string }> {
  const keys = grantCount(body.keys);
  const tokens = isTokenBoss(body.boss) ? grantCount(body.tokens) : 0;
  if (!keys && !tokens) return { ok: false, message: "Nothing to give." };
  await sql.batch([
    ...(keys ? [stmt("INSERT INTO wallets (user_id, crate_keys) VALUES (?, ?) ON CONFLICT (user_id) DO UPDATE SET crate_keys = crate_keys + excluded.crate_keys", userId, keys)] : []),
    ...(tokens ? [stmt("INSERT INTO boss_tokens (user_id, boss, n) VALUES (?, ?, ?) ON CONFLICT (user_id, boss) DO UPDATE SET n = n + excluded.n", userId, body.boss, tokens)] : []),
  ]);
  return { ok: true };
}

/**
 * A guest's tokens, drops, open solo battle and unopened boss crates join the account it signs in to, for the sign-in's one batch
 * (its crate keys go with the wallet: accounts.ts, shopMoves). Tokens are added up; the drops come along, so the account's window
 * counts them; the account's own open battle wins; the crates come along. (Where sign-in is set up a guest earns none, so this moves nothing there.)
 */
export const tokenMoves = (from: string, to: string): Stmt[] => [
  stmt(
    "INSERT INTO boss_tokens (user_id, boss, n) SELECT ?, boss, n FROM boss_tokens WHERE user_id = ? AND n > 0 ON CONFLICT (user_id, boss) DO UPDATE SET n = n + excluded.n",
    to,
    from,
  ),
  stmt("DELETE FROM boss_tokens WHERE user_id = ?", from),
  stmt("UPDATE boss_token_drops SET user_id = ? WHERE user_id = ?", to, from),
  stmt("INSERT OR IGNORE INTO solo_battles (user_id, id, started_at) SELECT ?, id, started_at FROM solo_battles WHERE user_id = ?", to, from),
  stmt("DELETE FROM solo_battles WHERE user_id = ?", from),
  // (Its unopened boss crates come along, each one.)
  stmt("UPDATE boss_crates SET user_id = ? WHERE user_id = ?", to, from),
];

/** Drops are kept this long (the window needs a day; the rest is for a person looking into a question), then go. */
export const DROPS_KEEP_DAYS = 30;
/** The Worker's schedule clears old drops (index.ts). */
export async function purgeTokenDrops(sql: Sql, now: number): Promise<void> {
  await sql.run("DELETE FROM boss_token_drops WHERE at < ?", now - DROPS_KEEP_DAYS * 86_400_000);
}
