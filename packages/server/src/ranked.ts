/**
 * Ranked 1 v 1's records in D1 (docs/areas/ranked.md): each player's rank (ranked_1v1: the hidden rating and the
 * ladder) and each ranked game (ranked_1v1_games: its moves and times, kept RANKED_1V1.gamesKeepDays for fair play's
 * engine check of a reported player). Ranks are worked out here, on the server, from the game object's own record of
 * the game, never from anything an app sends. The tables, a guest's merge and the profile's read are in
 * ranked-schema.ts (accounts.ts includes them; this file needs accounts.ts).
 */
import { RANKED_1V1, duelCoins, newRankedRecord, rankView, rankedGame, type RankChange, type RankedRecord } from "@chessroyale/core";
import type { Color, DuelOutcome, DuelPlayerView, DuelResult, DuelReason } from "@chessroyale/chess/duel";
import { DELETED_ID, randomToken, stmt, type Sql, type Stmt, type User } from "./accounts.ts";
import { lockerState } from "./locker.ts";
import { seatName } from "./text-filter.ts";

export interface RankedRow {
  rating: number;
  rd: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  ladder: number | null;
  last_at: number | null;
}

const fromRow = (r: RankedRow): RankedRecord => ({ rating: r.rating, rd: r.rd, games: r.games, wins: r.wins, losses: r.losses, draws: r.draws, ladder: r.ladder, lastAt: r.last_at });

/** A player's ranked record, or a new one (seeded from their account's rating from other modes) if they have none. */
export async function rankedRecordOf(sql: Sql, userId: string): Promise<{ record: RankedRecord; stored: boolean }> {
  const row = await sql.first<RankedRow>("SELECT rating, rd, games, wins, losses, draws, ladder, last_at FROM ranked_1v1 WHERE user_id = ?", userId);
  if (row) return { record: fromRow(row), stored: true };
  const u = await sql.first<{ rating: number | null }>("SELECT rating FROM users WHERE id = ?", userId);
  return { record: newRankedRecord(u?.rating ?? null), stored: false };
}

/**
 * A player joining the queue, as the server reads them (never the app's word): their account's name (filtered, as a
 * lobby seat's), what they wear (the locker), their rank, and their hidden rating for pairing.
 */
export async function duelEntrant(sql: Sql, user: Pick<User, "id" | "name">): Promise<{ player: DuelPlayerView; rating: number }> {
  const { record } = await rankedRecordOf(sql, user.id);
  const look = await lockerState(sql, user.id)
    .then((l) => l.look)
    .catch(() => ({}));
  return { player: { uid: user.id, name: seatName(user.name, "Player"), look, rank: rankView(record) }, rating: record.rating };
}

/** A finished game, as the game's object hands it over to be recorded. */
export interface FinishedDuel {
  /** Unique (its code and when it was made). */
  id: string;
  players: Record<Color, string>;
  control: string;
  result: DuelResult;
  reason: DuelReason;
  moves: readonly string[];
  times: readonly number[];
  startedAt: number;
  endedAt: number;
}

const scoreFor = (result: DuelResult, c: Color): number => (result === "1/2-1/2" ? 0.5 : (result === "1-0") === (c === "w") ? 1 : 0);
const resultWord = (score: number) => (score >= 1 ? "win" : score <= 0 ? "loss" : "draw") as "win" | "draw" | "loss";

/**
 * Records a finished game and moves both players' ranks, in one batch (one transaction), once:
 *   - an aborted game records nothing;
 *   - each player's new record from both records as they stand now (core's rankedGame), unless fair play is holding
 *     them (`held`: in review): their rank stays as it is; the opponent's game counts;
 *   - coins (duelCoins) to each player's wallet;
 *   - the game's row goes in only if neither player's record changed since it was read (another game of theirs ending
 *     at the same moment): then everything else in the batch applies only if that row is this recording's (its
 *     nonce), so a game recorded twice changes nothing the second time. A row that didn't go in is read again and
 *     retried.
 * Returns what it did for each player (null: an aborted game, or one already recorded).
 */
export async function recordDuel(sql: Sql, g: FinishedDuel, held: (userId: string) => Promise<boolean>, now = g.endedAt): Promise<Record<Color, DuelOutcome> | null> {
  if (g.result === "aborted") return null;
  // (Black's count: never more than White's.)
  const fewest = Math.floor(g.moves.length / 2);
  const isHeld: Record<Color, boolean> = { w: await held(g.players.w), b: await held(g.players.b) };
  for (let attempt = 0; attempt < 4; attempt++) {
    const before = { w: await rankedRecordOf(sql, g.players.w), b: await rankedRecordOf(sql, g.players.b) };
    const nonce = randomToken(9);
    const outcome = {} as Record<Color, DuelOutcome>;
    const writes: Stmt[] = [];
    const mine = `EXISTS (SELECT 1 FROM ranked_1v1_games WHERE id = ? AND nonce = ?)`;
    for (const c of ["w", "b"] as const) {
      const me = before[c].record;
      const opp = before[c === "w" ? "b" : "w"].record;
      const score = scoreFor(g.result, c);
      const coins = duelCoins(resultWord(score), g.endedAt - g.startedAt, fewest);
      let change: RankChange | null = null;
      if (!isHeld[c]) {
        const r = rankedGame(me, opp, score, now);
        change = r.change;
        const n = r.next;
        writes.push(
          stmt(
            `INSERT INTO ranked_1v1 (user_id, rating, rd, games, wins, losses, draws, ladder, last_game, last_at)
             SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM users WHERE id = ?) AND ${mine}
             ON CONFLICT (user_id) DO UPDATE SET rating = excluded.rating, rd = excluded.rd, games = excluded.games, wins = excluded.wins,
               losses = excluded.losses, draws = excluded.draws, ladder = excluded.ladder, last_game = excluded.last_game, last_at = excluded.last_at`,
            g.players[c],
            n.rating,
            n.rd,
            n.games,
            n.wins,
            n.losses,
            n.draws,
            n.ladder,
            g.id,
            n.lastAt,
            g.players[c],
            g.id,
            nonce,
          ),
        );
      }
      if (coins > 0) {
        writes.push(
          stmt(
            `INSERT INTO wallets (user_id, coins, crates) SELECT ?, ?, 0 WHERE EXISTS (SELECT 1 FROM users WHERE id = ?) AND ${mine}
             ON CONFLICT (user_id) DO UPDATE SET coins = coins + excluded.coins`,
            g.players[c],
            coins,
            g.players[c],
            g.id,
            nonce,
          ),
        );
      }
      outcome[c] = { change, coins };
    }
    // (A player whose account was deleted during the game is the shared id "deleted" in it, as in their other games.)
    const who = "CASE WHEN EXISTS (SELECT 1 FROM users WHERE id = ?) THEN ? ELSE '" + DELETED_ID + "' END";
    const gamesNow = "COALESCE((SELECT games FROM ranked_1v1 WHERE user_id = ?), 0)";
    await sql.batch([
      stmt(
        `INSERT OR IGNORE INTO ranked_1v1_games (id, white_id, black_id, control, result, reason, moves, times, started_at, ended_at, nonce)
         SELECT ?, ${who}, ${who}, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${gamesNow} = ? AND ${gamesNow} = ?`,
        g.id,
        g.players.w,
        g.players.w,
        g.players.b,
        g.players.b,
        g.control,
        g.result,
        g.reason,
        g.moves.join(" "),
        g.times.map((t) => Math.round(t)).join(","),
        g.startedAt,
        g.endedAt,
        nonce,
        g.players.w,
        before.w.record.games,
        g.players.b,
        before.b.record.games,
      ),
      ...writes,
    ]);
    const row = await sql.first<{ nonce: string }>("SELECT nonce FROM ranked_1v1_games WHERE id = ?", g.id);
    if (row?.nonce === nonce) return outcome;
    // Recorded before (a second call for the same game): nothing more to do.
    if (row) return null;
  }
  throw new Error(`ranked 1 v 1: game ${g.id} couldn't be recorded (its players' records kept changing)`);
}

const DAY = 86_400_000;

/**
 * Deletes games older than RANKED_1V1.gamesKeepDays, except those of a player fair play has in review or banned (kept
 * as long as that lasts). On the Worker's 15-minute schedule.
 */
export async function purgeDuelGames(sql: Sql, now: number): Promise<void> {
  await sql.run(
    `DELETE FROM ranked_1v1_games WHERE ended_at < ?
       AND NOT EXISTS (SELECT 1 FROM fairplay_cases c WHERE c.user_id IN (ranked_1v1_games.white_id, ranked_1v1_games.black_id) AND c.status IN ('review', 'banned'))`,
    now - RANKED_1V1.gamesKeepDays * DAY,
  );
}

/** A player's kept games, newest first (fair play's case page, the download). */
export interface DuelGameRow {
  id: string;
  white_id: string;
  black_id: string;
  control: string;
  result: string;
  reason: string;
  moves: string;
  times: string;
  started_at: number;
  ended_at: number;
  checked: string | null;
}

export function duelGamesOf(sql: Sql, userId: string, limit = 50): Promise<DuelGameRow[]> {
  return sql.all<DuelGameRow>(
    `SELECT id, white_id, black_id, control, result, reason, moves, times, started_at, ended_at, checked FROM ranked_1v1_games
     WHERE white_id = ?1 OR black_id = ?1 ORDER BY ended_at DESC LIMIT ?2`,
    userId,
    limit,
  );
}

/** The account's part of "Download my data": its rank and its kept games (the opponent by name; not fair play's check). */
export async function rankedDownload(sql: Sql, userId: string): Promise<unknown> {
  return {
    rank: await sql.first("SELECT rating, rd, games, wins, losses, draws, ladder, last_at FROM ranked_1v1 WHERE user_id = ?", userId),
    games: await sql.all(
      `SELECT CASE WHEN g.white_id = ?1 THEN 'white' ELSE 'black' END AS color, u.name AS opponent, g.control, g.result, g.reason, g.moves, g.times,
         g.started_at, g.ended_at
       FROM ranked_1v1_games g LEFT JOIN users u ON u.id = CASE WHEN g.white_id = ?1 THEN g.black_id ELSE g.white_id END
       WHERE g.white_id = ?1 OR g.black_id = ?1 ORDER BY g.ended_at`,
      userId,
    ),
  };
}

/** Deleting the account: its rank goes; in its games it becomes the shared id "deleted" (the opponent's games stay theirs). */
export function rankedErase(userId: string): Stmt[] {
  return [
    stmt("DELETE FROM ranked_1v1 WHERE user_id = ?", userId),
    stmt("UPDATE ranked_1v1_games SET white_id = ? WHERE white_id = ?", DELETED_ID, userId),
    stmt("UPDATE ranked_1v1_games SET black_id = ? WHERE black_id = ?", DELETED_ID, userId),
  ];
}
