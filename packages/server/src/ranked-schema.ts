/**
 * Ranked 1 v 1's tables (made with the rest of the schema in accounts.ts), a guest's merge and the profile's read:
 * nothing from the server's own files at run time, so accounts.ts can include it without a cycle (ranked.ts has the
 * rest).
 */
import { rankView, type RankView } from "@chessroyale/core";
import type { Sql, Stmt } from "./accounts.ts";

const stmt = (sql: string, ...params: unknown[]): Stmt => ({ sql, params });

export const RANKED_SCHEMA = [
  // One row per player who has played a ranked 1 v 1 game: the hidden rating (Glicko-1: rating, rd), the record, and
  // the ladder (null until the placements are done). `last_game`: the game that last changed it.
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
    last_at INTEGER
  )`,
  // Each ranked game (never an aborted one): its moves (UCI) and each move's thinking time (ms), kept
  // RANKED_1V1.gamesKeepDays (longer while a player in it is in a fair-play review or banned). `checked`: fair play's
  // engine check of it (fairplay-duel.ts). `nonce`: the recording that wrote it (a game is recorded once).
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
  `CREATE INDEX IF NOT EXISTS ranked_1v1_games_white ON ranked_1v1_games (white_id, ended_at)`,
  `CREATE INDEX IF NOT EXISTS ranked_1v1_games_black ON ranked_1v1_games (black_id, ended_at)`,
  `CREATE INDEX IF NOT EXISTS ranked_1v1_games_ended ON ranked_1v1_games (ended_at)`,
];

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
  return { rank: rankView(row), games: row?.games ?? 0, wins: row?.wins ?? 0, losses: row?.losses ?? 0, draws: row?.draws ?? 0 };
}

/**
 * A guest signing in to an account (accounts.ts, signInWithIdentity's one batch): the guest's rank becomes the
 * account's only if the account has none (online play needs signing in wherever sign-in is set up, so only a server
 * without sign-in has guests with ranks), and its games become the account's. Nothing stays under the guest's id.
 */
export function rankedMoves(from: string, to: string): Stmt[] {
  return [
    stmt(
      `INSERT OR IGNORE INTO ranked_1v1 (user_id, rating, rd, games, wins, losses, draws, ladder, last_game, last_at)
       SELECT ?, rating, rd, games, wins, losses, draws, ladder, last_game, last_at FROM ranked_1v1 WHERE user_id = ?`,
      to,
      from,
    ),
    stmt("DELETE FROM ranked_1v1 WHERE user_id = ?", from),
    stmt("UPDATE ranked_1v1_games SET white_id = ? WHERE white_id = ?", to, from),
    stmt("UPDATE ranked_1v1_games SET black_id = ? WHERE black_id = ?", to, from),
  ];
}
