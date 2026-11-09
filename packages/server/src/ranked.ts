/**
 * Ranked 1 v 1's records in D1 (docs/areas/ranked.md): each player's rank (ranked_1v1: the hidden rating and the
 * ladder) and each ranked game (ranked_1v1_games: its moves and times, kept RANKED_1V1.gamesKeepDays for fair play's
 * engine check of a reported player). Ranks are worked out here, on the server, from the game object's own record of
 * the game, never from anything an app sends. The tables, a guest's merge and the profile's read are in
 * ranked-schema.ts (accounts.ts includes them; this file needs accounts.ts).
 */
import { LEAVES, RANKED_1V1, dodgeCost, dodgeLevelAt, duelCoins, ladderAfterFee, newRankedRecord, rankedGame, ratingNow, type RankChange, type RankedRecord } from "@chessroyale/core";
import type { Color, DuelConduct, DuelOutcome, DuelPlayerView, DuelResult, DuelReason } from "@chessroyale/chess/duel";
import { DELETED_ID, randomToken, stmt, type Sql, type Stmt, type User } from "./accounts.ts";
import { lockerState } from "./locker.ts";
import { cond, leg, ledgerAccount, opStatements, type LedgerAccount } from "./ledger.ts";
import { marksOf, rankOf } from "./ranked-schema.ts";
export { marksOf, rankedLeaves } from "./ranked-schema.ts";
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
  coin_day: number | null;
  coin_games: number;
  peak: number | null;
  streak: number | null;
}

const DAY = 86_400_000;
/** A time's UTC day (the daily coin cap's day). */
const dayOf = (t: number) => Math.floor(t / DAY);

const fromRow = (r: RankedRow): RankedRecord => ({ rating: r.rating, rd: r.rd, games: r.games, wins: r.wins, losses: r.losses, draws: r.draws, ladder: r.ladder, lastAt: r.last_at });

/**
 * A player's ranked record, or a new one (seeded from their account's rating from other modes) if they have none; and
 * the daily coin cap's count as stored (`coins`: the UTC day of their last paying game and how many paid that day).
 */
export async function rankedRecordOf(
  sql: Sql,
  userId: string,
): Promise<{ record: RankedRecord; stored: boolean; coins: { day: number | null; games: number }; peak: number | null; streak: number }> {
  const row = await sql.first<RankedRow>("SELECT rating, rd, games, wins, losses, draws, ladder, last_at, coin_day, coin_games, peak, streak FROM ranked_1v1 WHERE user_id = ?", userId);
  if (row) return { record: fromRow(row), stored: true, coins: { day: row.coin_day, games: row.coin_games ?? 0 }, peak: row.peak ?? row.ladder, streak: row.streak ?? 0 };
  const u = await sql.first<{ rating: number | null }>("SELECT rating FROM users WHERE id = ?", userId);
  return { record: newRankedRecord(u?.rating ?? null), stored: false, coins: { day: null, games: 0 }, peak: null, streak: 0 };
}

/** The highest ladder reached after a game: the stored peak (or, from before peaks were kept, the ladder), or the new ladder if higher. */
export const peakAfter = (peak: number | null, ladder: number | null): number | null => (ladder === null ? peak : peak === null ? ladder : Math.max(peak, ladder));

/** The run of wins after a game: one more after a win; a loss or a draw ends it. */
export const streakAfter = (streak: number, score: number): number => (score >= 1 ? streak + 1 : 0);

/**
 * The daily coin cap for a game that ended on `day`, against the stored count: the paying games so far that day, and
 * the count to store after it (paying or not). A game recorded after one of a later day (a retry across midnight)
 * leaves the later day's count as it is, and isn't held to its own day's (that count is gone): it pays as usual.
 */
export function coinCount(stored: { day: number | null; games: number }, day: number, pays: (paidSoFar: number) => boolean): { pays: boolean; store: { day: number | null; games: number } } {
  if (stored.day !== null && stored.day > day) return { pays: pays(0), store: stored };
  const paid = stored.day === day ? stored.games : 0;
  const ok = paid < RANKED_1V1.coins.perDay && pays(paid);
  const games = ok ? paid + 1 : paid;
  return { pays: ok, store: games > 0 ? { day, games } : { day: null, games: 0 } };
}

/**
 * A player joining the queue, as the server reads them (never the app's word): their account's name (filtered, as a
 * lobby seat's), what they wear (the locker; `admin`: an admin's, admin copies included), their rank, and their hidden
 * rating (and its deviation now) for pairing.
 */
export async function duelEntrant(sql: Sql, user: Pick<User, "id" | "name">, now = Date.now(), admin = false): Promise<{ player: DuelPlayerView; rating: number; rd: number }> {
  const { record } = await rankedRecordOf(sql, user.id);
  const look = await lockerState(sql, user.id, admin)
    .then((l) => l.look)
    .catch(() => ({}));
  const { rating, rd } = ratingNow(record, now);
  return { player: { uid: user.id, name: seatName(user.name, "Player"), look, rank: await rankOf(sql, record) }, rating, rd: Math.round(rd) };
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
  /** A test's clock (seconds a side): unranked where test switches are off (duel-do.ts). */
  testSeconds?: number | null;
  /** Who left early (ranked's leave rules: duel rules' conductOf), as the game's room decided it. Missing: nobody. */
  conduct?: DuelConduct;
}

const scoreFor = (result: DuelResult, c: Color): number => (result === "1/2-1/2" ? 0.5 : (result === "1-0") === (c === "w") ? 1 : 0);
const resultWord = (score: number) => (score >= 1 ? "win" : score <= 0 ? "loss" : "draw") as "win" | "draw" | "loss";

/**
 * Records a finished game and moves both players' ranks, in one batch (one transaction), once:
 *   - an aborted game records nothing;
 *   - each player's new record from both records as they stand now (core's rankedGame), unless fair play is holding
 *     them (`held`: in review): their rank stays as it is and they earn nothing; the opponent's game counts;
 *   - coins (duelCoins) to each player's wallet, at most RANKED_1V1.coins.perDay paying games a UTC day per account
 *     (the count is kept on their ranked_1v1 row, written in the same batch), each a ledger op (`ranked:<game>:<color>`,
 *     ledger.ts), so a game pays a player once even if its row were ever written again;
 *   - the game's row goes in only if neither player's record changed since it was read (another game of theirs ending
 *     at the same moment): then everything else in the batch applies only if that row is this recording's (its
 *     nonce), so a game recorded twice changes nothing the second time. A row that didn't go in is read again and
 *     retried.
 *   - ranked's leave rules (L1, `g.conduct`; off with `penalties: false`, the kill switch PAUSE_LEAVE_PENALTIES): a leaver's
 *     loss counts as ever, then LEAVES.leaveRp more rank points, and a mark (ranked_conduct) in the same batch, only with this
 *     recording's game row. An aborted game that someone dodged records the dodge (recordDodges); any other records nothing.
 * Returns what it did for each player (null: an aborted game nobody dodged). A game recorded before (a try whose answer was
 * lost) answers each player's rank as it stands, with no points or coins named.
 */
export async function recordDuel(
  sql: Sql,
  g: FinishedDuel,
  held: (userId: string) => Promise<boolean>,
  now = g.endedAt,
  { penalties = true }: { penalties?: boolean } = {},
): Promise<Record<Color, DuelOutcome> | null> {
  if (g.result === "aborted") return penalties && g.conduct && Object.values(g.conduct).includes("dodge") ? recordDodges(sql, g, held) : null;
  // (Black's count: never more than White's.)
  const fewest = Math.floor(g.moves.length / 2);
  const isHeld: Record<Color, boolean> = { w: await held(g.players.w), b: await held(g.players.b) };
  const day = dayOf(g.endedAt);
  // (Each player's ledger id, read once: null for an account deleted since, which is paid nothing.)
  const ledgerIds: Partial<Record<Color, LedgerAccount | null>> = {};
  for (let attempt = 0; attempt < 4; attempt++) {
    const before = { w: await rankedRecordOf(sql, g.players.w), b: await rankedRecordOf(sql, g.players.b) };
    const nonce = randomToken(9);
    const outcome = {} as Record<Color, DuelOutcome>;
    const writes: Stmt[] = [];
    // (Each player's record after the game, for their rank's place among the top ladders once it's in.)
    const after: Partial<Record<Color, RankedRecord>> = {};
    // The top tiers go by place among the top ladders, which core's rankedGame can't know: before the game as it stands
    // now (counted before this game's write), after it once it's in.
    const shown = { w: await rankOf(sql, before.w.record), b: await rankOf(sql, before.b.record) };
    const mine = `EXISTS (SELECT 1 FROM ranked_1v1_games WHERE id = ? AND nonce = ?)`;
    for (const c of ["w", "b"] as const) {
      const me = before[c].record;
      const opp = before[c === "w" ? "b" : "w"].record;
      const score = scoreFor(g.result, c);
      // (Nothing while fair play holds them, nor past the day's paying games.)
      const earned = isHeld[c] ? 0 : duelCoins(resultWord(score), g.endedAt - g.startedAt, fewest);
      const count = coinCount(before[c].coins, day, () => earned > 0);
      const coins = count.pays ? earned : 0;
      let change: RankChange | null = null;
      // Ranked's leave rules (L1): a leave is the loss, then LEAVES.leaveRp more rank points (none in placements, or while held).
      const leaving = penalties && g.conduct?.[c] === "leave";
      let fee = 0;
      if (!isHeld[c]) {
        const r = rankedGame(me, opp, score, now);
        change = r.change;
        let n = r.next;
        if (leaving && n.ladder !== null) {
          const ladder = ladderAfterFee(n.ladder, LEAVES.leaveRp)!;
          fee = n.ladder - ladder;
          n = { ...n, ladder };
          if (change.points !== null) change = { ...change, points: change.points - fee };
        }
        after[c] = n;
        writes.push(
          stmt(
            `INSERT INTO ranked_1v1 (user_id, rating, rd, games, wins, losses, draws, ladder, last_game, last_at, coin_day, coin_games, peak, streak)
             SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM users WHERE id = ?) AND ${mine}
             ON CONFLICT (user_id) DO UPDATE SET rating = excluded.rating, rd = excluded.rd, games = excluded.games, wins = excluded.wins,
               losses = excluded.losses, draws = excluded.draws, ladder = excluded.ladder, last_game = excluded.last_game, last_at = excluded.last_at,
               coin_day = excluded.coin_day, coin_games = excluded.coin_games, peak = excluded.peak, streak = excluded.streak`,
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
            count.store.day,
            count.store.games,
            peakAfter(before[c].peak, n.ladder),
            streakAfter(before[c].streak, score),
            g.players[c],
            g.id,
            nonce,
          ),
        );
      }
      if (leaving) {
        // (The mark, kept LEAVES.keepDays: the player's games after this one, so the last-20 window counts it. Only with this game's row.)
        writes.push(
          stmt(
            `INSERT OR IGNORE INTO ranked_conduct (user_id, match_id, at, mode, kind, games, rp, nonce)
             SELECT ?, ?, ?, '1v1', 'leave', ?, ?, ? WHERE EXISTS (SELECT 1 FROM users WHERE id = ?) AND ${mine}`,
            g.players[c],
            g.id,
            g.endedAt,
            after[c]?.games ?? me.games,
            fee,
            nonce,
            g.players[c],
            g.id,
            nonce,
          ),
        );
      }
      if (coins > 0 && !(c in ledgerIds)) ledgerIds[c] = await ledgerAccount(sql, g.players[c]);
      const payee = coins > 0 ? ledgerIds[c] : null;
      if (payee) {
        // (Paid only if this recording's game row went in: `mine`.)
        writes.push(...opStatements(payee, { id: `ranked:${g.id}:${c}`, reason: "ranked", now: g.endedAt, when: cond(mine, g.id, nonce), legs: [leg.coins(g.players[c], coins, g.id)] }, nonce));
      }
      outcome[c] = { change, coins, ...(leaving ? { conduct: { kind: "leave" as const, rp: fee } } : {}) };
    }
    // (A player whose account was deleted during the game is the shared id "deleted" in it, as in their other games.)
    const who = "CASE WHEN EXISTS (SELECT 1 FROM users WHERE id = ?) THEN ? ELSE '" + DELETED_ID + "' END";
    const gamesNow = "COALESCE((SELECT games FROM ranked_1v1 WHERE user_id = ?), 0)";
    await sql.batch([
      stmt(
        `INSERT OR IGNORE INTO ranked_1v1_games (id, white_id, black_id, control, result, reason, moves, times, started_at, ended_at, nonce, white_points, black_points)
         SELECT ?, ${who}, ${who}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${gamesNow} = ? AND ${gamesNow} = ?`,
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
        // (Each side's rank points: null in placements and for a side fair play holds.)
        outcome.w.change?.points ?? null,
        outcome.b.change?.points ?? null,
        g.players.w,
        before.w.record.games,
        g.players.b,
        before.b.record.games,
      ),
      ...writes,
    ]);
    const row = await sql.first<{ nonce: string }>("SELECT nonce FROM ranked_1v1_games WHERE id = ?", g.id);
    if (row?.nonce === nonce) {
      for (const c of ["w", "b"] as const) {
        const ch = outcome[c].change;
        const n = after[c];
        if (ch && n) outcome[c] = { ...outcome[c], change: { ...ch, before: shown[c], after: await rankOf(sql, n) } };
      }
      return outcome;
    }
    // Recorded before (a try whose answer was lost): nothing more to do; each player hears their rank as it stands.
    if (row) {
      const now2 = { w: await rankedRecordOf(sql, g.players.w), b: await rankedRecordOf(sql, g.players.b) };
      const asItStands = async (c: Color): Promise<DuelOutcome> => {
        const v = await rankOf(sql, now2[c].record);
        const mark = await markOf(sql, g.players[c], g.id);
        return { change: isHeld[c] ? null : { before: v, after: v, points: null, placed: false }, coins: 0, ...(mark ? { conduct: mark } : {}) };
      };
      return { w: await asItStands("w"), b: await asItStands("b") };
    }
  }
  throw new Error(`ranked 1 v 1: game ${g.id} couldn't be recorded (its players' records kept changing)`);
}

// ---------------- Leaving early (ranked's leave rules, L1; docs/areas/ranked.md "Leaving") ----------------

/** A player's mark for one game (its kind and the rank points it cost), or null. */
async function markOf(sql: Sql, userId: string, matchId: string): Promise<{ kind: "dodge" | "leave"; rp: number } | null> {
  const row = await sql.first<{ kind: string; rp: number }>("SELECT kind, rp FROM ranked_conduct WHERE user_id = ? AND match_id = ?", userId, matchId);
  return row ? { kind: row.kind === "leave" ? "leave" : "dodge", rp: row.rp } : null;
}

/**
 * A dodge (the game called off before both first moves, by the one who left: duel rules' conductOf), recorded once per player
 * and game: the mark (ranked_conduct, keyed by player and game) and its fee off their ladder (LEAVES.dodgeRp by the dodge level
 * it brings; none in placements, nor while fair play holds them), in one batch: the fee only with this recording's own mark
 * (its nonce), so a retry, or a second recording of the same game, takes nothing more. No hidden-rating change: a game that
 * never happened says nothing about skill. The lockout it brings is read from the marks (leaveStanding), never stored.
 */
async function recordDodges(sql: Sql, g: FinishedDuel, held: (userId: string) => Promise<boolean>): Promise<Record<Color, DuelOutcome>> {
  const out: Record<Color, DuelOutcome> = { w: { change: null, coins: 0 }, b: { change: null, coins: 0 } };
  for (const c of ["w", "b"] as const) {
    if (g.conduct?.[c] !== "dodge") continue;
    const uid = g.players[c];
    const had = await markOf(sql, uid, g.id);
    if (!had) {
      const dodges = (await marksOf(sql, uid)).filter((m) => m.kind === "dodge").map((m) => m.at).reverse();
      const level = dodgeLevelAt(dodges, g.endedAt) + 1;
      const { record, stored } = await rankedRecordOf(sql, uid);
      const fee = stored && !(await held(uid)) ? dodgeCost(level).rp : 0;
      const ladder = stored ? record.ladder : null;
      const rp = ladder === null ? 0 : ladder - ladderAfterFee(ladder, fee)!;
      const nonce = randomToken(9);
      await sql.batch([
        stmt(
          `INSERT OR IGNORE INTO ranked_conduct (user_id, match_id, at, mode, kind, games, rp, nonce)
           SELECT ?, ?, ?, '1v1', 'dodge', ?, ?, ? WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)`,
          uid,
          g.id,
          g.endedAt,
          record.games,
          rp,
          nonce,
          uid,
        ),
        stmt(
          `UPDATE ranked_1v1 SET ladder = MAX(0, ladder - ?) WHERE user_id = ? AND ladder IS NOT NULL AND ? > 0
             AND EXISTS (SELECT 1 FROM ranked_conduct WHERE user_id = ? AND match_id = ? AND nonce = ?)`,
          rp,
          uid,
          rp,
          uid,
          g.id,
          nonce,
        ),
      ]);
    }
    const mark = had ?? (await markOf(sql, uid, g.id));
    if (mark) out[c] = { ...out[c], conduct: mark };
  }
  return out;
}

/** Marks past LEAVES.keepDays are deleted (the 15-minute cron). */
export async function purgeConduct(sql: Sql, now: number): Promise<void> {
  await sql.run("DELETE FROM ranked_conduct WHERE at < ?", now - LEAVES.keepDays * DAY);
}

/**
 * Deletes games older than RANKED_1V1.gamesKeepDays, except while a player in one has a fair-play case open (watch or
 * review) or an appeal of a ban waiting: fair play's own rule for evidence (fairplay.ts, purgeEvidence). A banned
 * player's games go like anyone's once no appeal is open. On the Worker's 15-minute schedule.
 */
export async function purgeDuelGames(sql: Sql, now: number): Promise<void> {
  await sql.run(
    `DELETE FROM ranked_1v1_games WHERE ended_at < ?
       AND NOT EXISTS (SELECT 1 FROM fairplay_cases c WHERE c.user_id IN (ranked_1v1_games.white_id, ranked_1v1_games.black_id) AND c.status IN ('watch', 'review'))
       AND NOT EXISTS (SELECT 1 FROM fairplay_appeals a WHERE a.user_id IN (ranked_1v1_games.white_id, ranked_1v1_games.black_id) AND a.status = 'open')`,
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

/** The account's part of "Download my data": its rank, its marks for leaving early, and its kept games (the opponent by name; not fair play's check). */
export async function rankedDownload(sql: Sql, userId: string): Promise<unknown> {
  return {
    rank: await sql.first("SELECT rating, rd, games, wins, losses, draws, ladder, last_at, coin_day, coin_games, peak, streak FROM ranked_1v1 WHERE user_id = ?", userId),
    // (Leaving ranked games early: each dodge and leave kept LEAVES.keepDays, the rank points it cost.)
    leaves: await sql.all("SELECT match_id AS game, at, mode, kind, rp FROM ranked_conduct WHERE user_id = ? ORDER BY at", userId),
    games: await sql.all(
      `SELECT CASE WHEN g.white_id = ?1 THEN 'white' ELSE 'black' END AS color, u.name AS opponent, g.control, g.result, g.reason, g.moves, g.times,
         g.started_at, g.ended_at, CASE WHEN g.white_id = ?1 THEN g.white_points ELSE g.black_points END AS points
       FROM ranked_1v1_games g LEFT JOIN users u ON u.id = CASE WHEN g.white_id = ?1 THEN g.black_id ELSE g.white_id END
       WHERE g.white_id = ?1 OR g.black_id = ?1 ORDER BY g.ended_at`,
      userId,
    ),
  };
}

/** Deleting the account: its rank and its marks go; in its games it becomes the shared id "deleted" (the opponent's games stay theirs). */
export function rankedErase(userId: string): Stmt[] {
  return [
    stmt("DELETE FROM ranked_1v1 WHERE user_id = ?", userId),
    stmt("DELETE FROM ranked_conduct WHERE user_id = ?", userId),
    stmt("UPDATE ranked_1v1_games SET white_id = ? WHERE white_id = ?", DELETED_ID, userId),
    stmt("UPDATE ranked_1v1_games SET black_id = ? WHERE black_id = ?", DELETED_ID, userId),
  ];
}
