/**
 * Ranked 1 v 1's tables (made with the rest of the schema in accounts.ts), a guest's merge and the profile's read:
 * nothing from the server's own files at run time, so accounts.ts can include it without a cycle (ranked.ts has the
 * rest).
 */
import { RANKED_1V1, mayBeTop, rankView, type RankView, type RankedRecentGame, type RankedSummary } from "@chessroyale/core";
import { looksOf } from "./locker.ts";

/** A deleted account in its games (accounts.ts DELETED_ID; written here so this file needs nothing of accounts.ts at run time). */
const DELETED = "deleted";
import type { Sql, Stmt } from "./accounts.ts";

const stmt = (sql: string, ...params: unknown[]): Stmt => ({ sql, params });

export const RANKED_SCHEMA = [
  // One row per player who has played a ranked 1 v 1 game: the hidden rating (Glicko-1: rating, rd), the record, and
  // the ladder (null until the placements are done). `last_game`: the game that last changed it. `coin_day`,
  // `coin_games`: the UTC day of their last paying game and how many paid that day (RANKED_1V1.coins.perDay). `peak`: the
  // highest ladder reached (kept from Oct 28, 2026; it started at the ladder then), `streak`: the current run of wins.
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
    coin_games INTEGER NOT NULL DEFAULT 0,
    peak INTEGER,
    streak INTEGER NOT NULL DEFAULT 0
  )`,
  // Each ranked game (never an aborted one): its moves (UCI) and each move's thinking time (ms), kept
  // RANKED_1V1.gamesKeepDays (longer only while a player in it has a fair-play case open, or an appeal of a ban). `checked`: fair play's
  // engine check of each side's moves, by side (fairplay-duel.ts). `nonce`: the recording that wrote it (a game is recorded once).
  // `white_points`, `black_points`: the rank points it moved for each side (null in placements, for a side fair play held,
  // and for games recorded before Oct 28, 2026).
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
    nonce TEXT NOT NULL,
    white_points INTEGER,
    black_points INTEGER
  )`,
  // (The top tiers' place, topPlace below: the ladders above one counted from this index, never the table. Oct 28, 2026.)
  `CREATE INDEX IF NOT EXISTS ranked_1v1_ladder ON ranked_1v1 (ladder)`,
  `CREATE INDEX IF NOT EXISTS ranked_1v1_games_white ON ranked_1v1_games (white_id, ended_at)`,
  `CREATE INDEX IF NOT EXISTS ranked_1v1_games_black ON ranked_1v1_games (black_id, ended_at)`,
  `CREATE INDEX IF NOT EXISTS ranked_1v1_games_ended ON ranked_1v1_games (ended_at)`,
];

/** Columns added after the table first shipped on a test server (accounts.ts adds them to a table made before). */
export const RANKED_COLUMNS: { table: string; column: string; type: string; then?: string[] }[] = [
  // The daily coin cap (Oct 16, 2026: RANKED_1V1.coins.perDay).
  { table: "ranked_1v1", column: "coin_day", type: "INTEGER" },
  { table: "ranked_1v1", column: "coin_games", type: "INTEGER NOT NULL DEFAULT 0" },
  // The public profile's numbers (Oct 28, 2026), kept from then on: the peak starts at each player's ladder then; the
  // streak at 0; older games have no points.
  { table: "ranked_1v1", column: "peak", type: "INTEGER", then: ["UPDATE ranked_1v1 SET peak = ladder WHERE peak IS NULL"] },
  { table: "ranked_1v1", column: "streak", type: "INTEGER NOT NULL DEFAULT 0" },
  { table: "ranked_1v1_games", column: "white_points", type: "INTEGER" },
  { table: "ranked_1v1_games", column: "black_points", type: "INTEGER" },
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

export type { RankedSummary };

/** How many recent games a profile shows (RankedSummary.recent). */
export const RECENT_GAMES = 5;

/**
 * What a profile shows of a player's 1 v 1 (core's RankedSummary): the rank, the record, the peak (its place among the
 * top ladders as they stand now), the current streak, and the last RECENT_GAMES kept games, newest first (each from
 * this player's side, the opponent by id, name and look; the hidden rating never). Two reads and one for the
 * opponents' looks, plus a place count only at the top tiers' floor.
 */
export async function rankedSummary(sql: Sql, userId: string): Promise<RankedSummary> {
  const row = await sql.first<{ games: number; wins: number; losses: number; draws: number; ladder: number | null; peak: number | null; streak: number | null }>(
    "SELECT games, wins, losses, draws, ladder, peak, streak FROM ranked_1v1 WHERE user_id = ?",
    userId,
  );
  const games = await sql.all<{ ended_at: number; white_id: string; black_id: string; result: string; white_points: number | null; black_points: number | null; name: string | null }>(
    `SELECT g.ended_at, g.white_id, g.black_id, g.result, g.white_points, g.black_points, u.name FROM ranked_1v1_games g
     LEFT JOIN users u ON u.id = CASE WHEN g.white_id = ?1 THEN g.black_id ELSE g.white_id END
     WHERE g.white_id = ?1 OR g.black_id = ?1 ORDER BY g.ended_at DESC, g.id DESC LIMIT ?2`,
    userId,
    RECENT_GAMES,
  );
  const opponentOf = (g: (typeof games)[number]) => (g.white_id === userId ? g.black_id : g.white_id);
  const looks = await looksOf(sql, [...new Set(games.map(opponentOf).filter((id) => id !== DELETED))]);
  const recent: RankedRecentGame[] = games.map((g) => {
    const white = g.white_id === userId;
    const id = opponentOf(g);
    const result: RankedRecentGame["result"] = g.result === "1/2-1/2" ? "draw" : (g.result === "1-0") === white ? "win" : "loss";
    return { at: g.ended_at, opponent: { id, name: g.name ?? "Deleted account", look: looks.get(id) ?? (g.name === null ? null : {}) }, result, points: white ? g.white_points : g.black_points };
  });
  const peak = row && row.games >= RANKED_1V1.placements.games ? (row.peak ?? row.ladder) : null;
  return {
    rank: await rankOf(sql, row),
    games: row?.games ?? 0,
    wins: row?.wins ?? 0,
    losses: row?.losses ?? 0,
    draws: row?.draws ?? 0,
    peak: peak === null ? null : await rankOf(sql, { games: row!.games, ladder: peak }),
    streak: row?.streak ?? 0,
    recent,
  };
}

/**
 * A guest signing in to an account (accounts.ts, signInWithIdentity's one batch): the guest's rank becomes the
 * account's only if the account has none (online play needs signing in wherever sign-in is set up, so only a server
 * without sign-in has guests with ranks), and its games become the account's. Nothing stays under the guest's id.
 */
export function rankedMoves(from: string, to: string): Stmt[] {
  return [
    stmt(
      `INSERT OR IGNORE INTO ranked_1v1 (user_id, rating, rd, games, wins, losses, draws, ladder, last_game, last_at, coin_day, coin_games, peak, streak)
       SELECT ?, rating, rd, games, wins, losses, draws, ladder, last_game, last_at, coin_day, coin_games, peak, streak FROM ranked_1v1 WHERE user_id = ?`,
      to,
      from,
    ),
    stmt("DELETE FROM ranked_1v1 WHERE user_id = ?", from),
    stmt("UPDATE ranked_1v1_games SET white_id = ? WHERE white_id = ?", to, from),
    stmt("UPDATE ranked_1v1_games SET black_id = ? WHERE black_id = ?", to, from),
  ];
}
