/**
 * Ranked 1 v 1's tables (made with the rest of the schema in accounts.ts), a guest's merge and the profile's read:
 * nothing from the server's own files at run time, so accounts.ts can include it without a cycle (ranked.ts has the
 * rest).
 */
import { mayBeTop, rankView, type RankView } from "@chessroyale/core";
import type { Sql, Stmt } from "./accounts.ts";

const stmt = (sql: string, ...params: unknown[]): Stmt => ({ sql, params });

export const RANKED_SCHEMA = [
  // One row per player who has played a ranked 1 v 1 game: the hidden rating (Glicko-1: rating, rd), the record, and
  // the ladder (null until the placements are done). `last_game`: the game that last changed it. `coin_day`,
  // `coin_games`: the UTC day of their last paying game and how many paid that day (RANKED_1V1.coins.perDay).
  `CREATE TABLE IF NOT EXISTS ranked_1v1 (
    user_id TEXT PRIMARY KEY,
    rating REAL NOT NULL,
    rd REAL NOT NULL,
    games INTEGER NOT NULL,
    wins INTEGER NOT NULL,
    losses INTEGER NOT NULL,
    draws INTEGER NOT NULL,
    ladder INTEGER,
    last_game TEXT,
    last_at INTEGER,
    coin_day INTEGER,
    coin_games INTEGER NOT NULL DEFAULT 0
  )`,
  // Each ranked game (never an aborted one): its moves (UCI) and each move's thinking time (ms), kept
  // RANKED_1V1.gamesKeepDays (longer only while a player in it has a fair-play case open, or an appeal of a ban). `checked`: fair play's
  // engine check of each side's moves, by side (fairplay-duel.ts). `nonce`: the recording that wrote it (a game is recorded once).
  `CREATE TABLE IF NOT EXISTS ranked_1v1_games (
    id TEXT PRIMARY KEY,
    white_id TEXT NOT NULL,
    black_id TEXT NOT NULL,
    control TEXT NOT NULL,
    result TEXT NOT NULL,
    reason TEXT NOT NULL,
    moves TEXT NOT NULL,
    times TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL,
    checked TEXT,
    nonce TEXT NOT NULL
  )`,
  // (The top tiers' place, topPlace below: the ladders above one counted from this index, never the table. Oct 28, 2026.)
  `CREATE INDEX IF NOT EXISTS ranked_1v1_ladder ON ranked_1v1 (ladder)`,
  `CREATE INDEX IF NOT EXISTS ranked_1v1_games_white ON ranked_1v1_games (white_id, ended_at)`,
  `CREATE INDEX IF NOT EXISTS ranked_1v1_games_black ON ranked_1v1_games (black_id, ended_at)`,
  `CREATE INDEX IF NOT EXISTS ranked_1v1_games_ended ON ranked_1v1_games (ended_at)`,
];

/** Columns added after the table first shipped on a test server (accounts.ts adds them to a table made before). */
export const RANKED_COLUMNS: { table: string; column: string; type: string }[] = [
  // The daily coin cap (Oct 16, 2026: RANKED_1V1.coins.perDay).
  { table: "ranked_1v1", column: "coin_day", type: "INTEGER" },
  { table: "ranked_1v1", column: "coin_games", type: "INTEGER NOT NULL DEFAULT 0" },
];

/** How long a ladder's place among the top ladders is kept (in this Worker instance) before it's counted again. */
export const TOP_PLACE_MS = 60_000;
/** At most this many ladders' places kept at once (the oldest go first). */
const TOP_PLACES_KEPT = 2_000;
const topPlaces = new Map<number, { place: number; at: number }>();

/**
 * Where a ladder stands among the top ladders (Pearlescent, Transcendent: RANKED_1V1.topTiers): 1 + how many ladders
 * are higher. Equal ladders share a place (the same ladder is always the same tier). Asked only at
 * RANKED_1V1.topFloor or above (null below: no top tier there), as one count on the ladder's index (ranked_1v1_ladder:
 * the entries above it, never the table), and kept a minute per ladder in this Worker instance (`TOP_PLACE_MS`), so a
 * busy profile or queue costs one count a minute per ladder.
 */
export async function topPlace(sql: Sql, ladder: number | null | undefined, now = Date.now()): Promise<number | null> {
  if (!mayBeTop(ladder)) return null;
  const kept = topPlaces.get(ladder);
  if (kept && now - kept.at < TOP_PLACE_MS) return kept.place;
  const above = (await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM ranked_1v1 WHERE ladder > ?", ladder))?.n ?? 0;
  const place = above + 1;
  topPlaces.delete(ladder);
  if (topPlaces.size >= TOP_PLACES_KEPT) topPlaces.delete(topPlaces.keys().next().value!);
  topPlaces.set(ladder, { place, at: now });
  return place;
}

/** Forgets every kept place (tests). */
export const forgetTopPlaces = () => topPlaces.clear();

/** A record's rank as it shows, its place among the top ladders counted where it may be in a top tier. */
export async function rankOf(sql: Sql, row: { games: number; ladder: number | null } | null | undefined, now = Date.now()): Promise<RankView> {
  return rankView(row ? { ...row, place: await topPlace(sql, row.ladder, now) } : row);
}

/** What a profile shows of a player's 1 v 1: the rank and the record. */
export interface RankedSummary {
  rank: RankView;
  games: number;
  wins: number;
  losses: number;
  draws: number;
}

export async function rankedSummary(sql: Sql, userId: string): Promise<RankedSummary> {
  const row = await sql.first<{ games: number; wins: number; losses: number; draws: number; ladder: number | null }>("SELECT games, wins, losses, draws, ladder FROM ranked_1v1 WHERE user_id = ?", userId);
  return { rank: await rankOf(sql, row), games: row?.games ?? 0, wins: row?.wins ?? 0, losses: row?.losses ?? 0, draws: row?.draws ?? 0 };
}

/**
 * A guest signing in to an account (accounts.ts, signInWithIdentity's one batch): the guest's rank becomes the
 * account's only if the account has none (online play needs signing in wherever sign-in is set up, so only a server
 * without sign-in has guests with ranks), and its games become the account's. Nothing stays under the guest's id.
 */
export function rankedMoves(from: string, to: string): Stmt[] {
  return [
    stmt(
      `INSERT OR IGNORE INTO ranked_1v1 (user_id, rating, rd, games, wins, losses, draws, ladder, last_game, last_at, coin_day, coin_games)
       SELECT ?, rating, rd, games, wins, losses, draws, ladder, last_game, last_at, coin_day, coin_games FROM ranked_1v1 WHERE user_id = ?`,
      to,
      from,
    ),
    stmt("DELETE FROM ranked_1v1 WHERE user_id = ?", from),
    stmt("UPDATE ranked_1v1_games SET white_id = ? WHERE white_id = ?", to, from),
    stmt("UPDATE ranked_1v1_games SET black_id = ? WHERE black_id = ?", to, from),
  ];
}
