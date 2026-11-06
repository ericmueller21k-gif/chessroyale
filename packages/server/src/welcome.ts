import { WELCOME_CRATE_ID, WELCOME_GIFT, mulberry32, rollWelcome, type CrateRoll, type ItemInstance } from "@chessroyale/core";
import type { Sql, Stmt } from "./accounts.ts";

/**
 * The HunChess Welcome Crate on the server (Eric, Nov 6; core's welcome.ts; docs/decisions/2026-11-06-welcome-crate.md). Everything
 * that counts is decided here, never by the app: whether an account has finished enough games, the grant (once per account, ever),
 * the prize's roll (the server's own randomness) and the opening (once).
 *
 * One table, `welcome_crates`: one row per account that has earned it, keyed by the account (PRIMARY KEY user_id), so a second row
 * for an account can't exist: the grant is one statement that inserts the row only while the account is signed in and has finished
 * WELCOME_GIFT.games games (counted in that same statement), and does nothing if the row is there. So retries, races, two tabs and
 * two Workers grant it once. Opening is one transaction (D1's batch): the ride goes in only while the row is unopened, and the row is
 * marked opened with that ride only if the ride went in; a second open (a double tap, two devices, a retry) finds it opened and
 * answers the ride it already gave. Nothing older reads or writes the table: an account without a row reads as not earned yet.
 * (Only types come from accounts.ts: it imports this file's schema while it loads.)
 */
export const WELCOME_SCHEMA = [
  // `granted_at`: when it was earned; `games`: the finished games counted then; `seen_at`: when its owner closed the "You earned a
  // Welcome Crate!" notice (NULL: not yet: it shows); `opened_at` and `item_id`: when it was opened and the ride it gave (NULL: not
  // opened). The ride itself is an `items` row like any other (crate 'welcome-hunchess').
  `CREATE TABLE IF NOT EXISTS welcome_crates (
    user_id TEXT PRIMARY KEY,
    granted_at INTEGER NOT NULL,
    games INTEGER NOT NULL,
    seen_at INTEGER,
    opened_at INTEGER,
    item_id TEXT
  )`,
];

const stmt = (sql: string, ...params: unknown[]): Stmt => ({ sql, params });

/**
 * An account's finished games, in SQL (`?` is the account's id, twice). A game counts when it reached a result (a win, a loss or a
 * draw), in any mode or against any boss:
 *   - every row of `results` (online matches, written by their match rooms: Classic, Crowd and 50 v 50, boss raids, friends' lobbies,
 *     Squads; and solo matches, posted by the app from the result screen, as every solo result is), except one recorded because its
 *     player abandoned it (`abandoned` = 1: gone too long, idle or removed mid-match; since Nov 6). A match left before its first
 *     move is never recorded, so never counted;
 *   - every ranked 1 v 1 game (`ranked_1v1.games`: aborted games are never recorded).
 * Results from before Nov 6 have `abandoned` NULL and count (they can't be told apart). Not stored anywhere, so not counted: auto
 * chess (played on the device), and a ranked 1 v 1 game while its player was held by fair play.
 */
export const FINISHED_GAMES_SQL = `((SELECT COUNT(*) FROM results WHERE user_id = ? AND (abandoned IS NULL OR abandoned = 0))
  + COALESCE((SELECT games FROM ranked_1v1 WHERE user_id = ?), 0))`;

/** An account's finished games (as FINISHED_GAMES_SQL counts them). */
export async function finishedGames(sql: Sql, userId: string): Promise<number> {
  return (await sql.first<{ n: number }>(`SELECT ${FINISHED_GAMES_SQL} AS n`, userId, userId))?.n ?? 0;
}

/**
 * Grants the Welcome Crate if this account has earned it and hasn't got it: one statement, so it's checked and set at once. Only a
 * signed-in account (an email or a Google account: never a guest; bots have no account) with WELCOME_GIFT.games finished games.
 * Answers whether this call granted it (false: not earned yet, or granted before). Called where an account's games are counted (a
 * result saved, a ranked game recorded) and on every sign-in and profile load (`/api/me`), which is the backfill: an account that
 * had finished 5 games before Nov 6 gets it the next time it opens the app or finishes a game.
 */
export async function grantWelcomeCrate(sql: Sql, userId: string, now: number): Promise<boolean> {
  if (await sql.first("SELECT 1 FROM welcome_crates WHERE user_id = ?", userId)) return false;
  const row = await sql.first<{ user_id: string }>(
    `INSERT INTO welcome_crates (user_id, granted_at, games)
     SELECT u.id, ?, g.n FROM users u, (SELECT ${FINISHED_GAMES_SQL} AS n) g
     WHERE u.id = ? AND (u.email IS NOT NULL OR u.google_sub IS NOT NULL) AND g.n >= ?
     ON CONFLICT (user_id) DO NOTHING
     RETURNING user_id`,
    now,
    userId,
    userId,
    userId,
    WELCOME_GIFT.games,
  );
  return !!row;
}

/** What the app hears about the Welcome Crate (the locker's `welcome`). */
export interface WelcomeState {
  /** Finished games so far (for "Finish 5 games to earn your Welcome Crate: 3/5"). */
  games: number;
  /** Earned and not opened ("ready"), opened ("opened"), or not earned yet ("locked"). */
  status: "locked" | "ready" | "opened";
  /** The one-time "You earned a Welcome Crate!" notice is due (earned, and its notice not closed yet). */
  notice: boolean;
  /** Opened: the ride it gave (an `items` id). */
  item?: string;
}

/** An account's Welcome Crate, read only (an account with no row: not earned yet, as every account before Nov 6). */
export async function welcomeState(sql: Sql, userId: string): Promise<WelcomeState> {
  const row = await sql.first<{ seen_at: number | null; opened_at: number | null; item_id: string | null }>(
    "SELECT seen_at, opened_at, item_id FROM welcome_crates WHERE user_id = ?",
    userId,
  ).catch(() => null);
  if (!row) return { games: await finishedGames(sql, userId).catch(() => 0), status: "locked", notice: false };
  return {
    games: WELCOME_GIFT.games,
    status: row.opened_at === null ? "ready" : "opened",
    notice: row.seen_at === null,
    ...(row.item_id ? { item: row.item_id } : {}),
  };
}

/** Closes the "You earned a Welcome Crate!" notice for good (it shows once). */
export async function seenWelcomeNotice(sql: Sql, userId: string, now: number): Promise<void> {
  await sql.run("UPDATE welcome_crates SET seen_at = ? WHERE user_id = ? AND seen_at IS NULL", now, userId);
}

const randomHex = (bytes: number) => [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Why the Welcome Crate couldn't be opened. */
export const NO_WELCOME_CRATE = "You have no Welcome Crate to open.";

/**
 * Opens your Welcome Crate: one ride from every ride's HunChess colorway, each as likely (rollWelcome), with the server's own
 * randomness (never a test switch), into your locker. One transaction: the ride goes in only while your crate is earned and
 * unopened, then the crate is marked opened with it, only if it went in. A second open (a double tap, two devices at once, a retry
 * after a lost answer) gives nothing new: it answers the ride the first gave (`again`). An account that hasn't earned one is refused.
 */
export async function openWelcomeCrate(
  sql: Sql,
  userId: string,
  now: number,
  rng: () => number = mulberry32(crypto.getRandomValues(new Uint32Array(1))[0]!),
): Promise<{ ok: true; roll: CrateRoll; item: ItemInstance; again: boolean } | { ok: false; message: string }> {
  const roll = rollWelcome(rng);
  const id = randomHex(9);
  const unopened = "EXISTS (SELECT 1 FROM welcome_crates WHERE user_id = ? AND opened_at IS NULL)";
  await sql.batch([
    stmt(
      `INSERT INTO items (id, user_id, def, color, color2, blemish, seed, crate, fischer, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, 1, ? WHERE ${unopened}`,
      id,
      userId,
      roll.def,
      roll.color,
      roll.color2 ?? null,
      roll.blemish,
      roll.seed,
      WELCOME_CRATE_ID,
      now,
      userId,
    ),
    stmt(
      `UPDATE welcome_crates SET opened_at = ?, item_id = ? WHERE user_id = ? AND opened_at IS NULL AND EXISTS (SELECT 1 FROM items WHERE id = ? AND user_id = ?)`,
      now,
      id,
      userId,
      id,
      userId,
    ),
  ]);
  const row = await sql.first<{ item_id: string | null }>("SELECT item_id FROM welcome_crates WHERE user_id = ?", userId);
  if (!row?.item_id) return { ok: false, message: NO_WELCOME_CRATE };
  const it = await sql.first<ItemInstance & { color2: string | null }>("SELECT id, def, color, color2, blemish, seed FROM items WHERE id = ? AND user_id = ?", row.item_id, userId);
  // (Opened, and its ride since deleted from the locker: nothing to show again.)
  if (!it) return { ok: false, message: NO_WELCOME_CRATE };
  const item: ItemInstance = { id: it.id, def: it.def, color: it.color, ...(it.color2 ? { color2: it.color2 } : {}), blemish: it.blemish, seed: it.seed };
  const again = row.item_id !== id;
  return { ok: true, roll: again ? { fischer: true, def: item.def, color: item.color, ...(item.color2 ? { color2: item.color2 } : {}), blemish: item.blemish, seed: item.seed } : roll, item, again };
}

/**
 * A guest signing in to an account (accounts.ts, the sign-in's one batch): a guest never earns a Welcome Crate (the grant needs a
 * signed-in account), so it has none to bring; any row under its id is dropped (never moved: the account keeps its own, one at
 * most), so nothing stays under the guest's id. Its locker's items move with lockerMoves; a guest can't hold a HunChess ride (only
 * opening a Welcome Crate makes one).
 */
export const welcomeMoves = (from: string): Stmt[] => [stmt("DELETE FROM welcome_crates WHERE user_id = ?", from)];
