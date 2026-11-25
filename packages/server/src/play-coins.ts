import { PLAY_COINS, XP, bonusStep, coinParts, gameCoins, type CoinDay, type CoinGame, type CoinResult, type GameXp, type PlayCoins } from "@chessroyale/core";
import type { Sql } from "./accounts.ts";
import { applyOp, cond, leg, type LedgerAccount, type Op } from "./ledger.ts";

/**
 * Play coins on the server (Nov 25; core's play-coins.ts has the rules, PLAY_COINS the numbers; the payments design's section 6;
 * docs/decisions/2026-11-25-play-coins.md). Paid by xp.ts grantXp with the game's XP, in the same batch, keyed by the same game, so a
 * game pays once: a retry, a second tab, a room's restart or a second device finds its ops there and pays nothing more.
 *
 *   - `coins:<game>:<ledger id>` (reason "play"): the game's play coins. Its guard: the XP day's play coins so far plus these at most
 *     PLAY_COINS.perDay, read in the same statement (two games ending at once can't pass the day's cap); a solo game's also needs its
 *     XP time op there (what XP's solo cap paid is what its coins count).
 *   - `coinsbonus:<game>:<ledger id>` (reason "play-bonus"): the game's bonus after the day's steps. Its guard: the XP day's paid bonus
 *     is still what this game's share was worked out from (equal, in the same statement), and, with a win, that the XP win op is there
 *     (XP's win rules, its friends'-lobby once-a-day included).
 * An op its guard refused (another game of the account's landed between the read and the write, or the win wasn't paid) is worked
 * out again from the ledger as it stands and tried alone, up to RETRIES times. The day's totals are the ledger's own, from the XP day's
 * start (core's xpDayStart) to its end: no table of their own.
 */

/** The ledger reasons of play coins and their bonus (the day's totals sum these). */
export const PLAY = "play";
export const PLAY_BONUS = "play-bonus";
const DAY_MS = 86_400_000;
const RETRIES = 3;

/** A game's coin ops' keys. */
export const coinOpIds = (key: string, account: string) => ({ play: `coins:${key}:${account}`, bonus: `coinsbonus:${key}:${account}` });

/** The XP day's sum of one reason's coins, in SQL (its parameters: the ledger id, the day's start and end). */
const daySum = (reason: string) =>
  `COALESCE((SELECT SUM(delta) FROM ledger WHERE account = ? AND asset_kind = 'coins' AND reason = '${reason}' AND created_at >= ? AND created_at < ?), 0)`;

/** The XP day's coins so far (`day`: its start), as the ledger has them: one read. */
export async function coinDayOf(sql: Sql, account: string, day: number): Promise<CoinDay> {
  const row = await sql.first<{ play: number | null; bonus: number | null }>(
    `SELECT COALESCE(SUM(CASE WHEN reason = '${PLAY}' THEN delta END), 0) AS play, COALESCE(SUM(CASE WHEN reason = '${PLAY_BONUS}' THEN delta END), 0) AS bonus
     FROM ledger WHERE account = ? AND asset_kind = 'coins' AND reason IN ('${PLAY}', '${PLAY_BONUS}') AND created_at >= ? AND created_at < ?`,
    account,
    day,
    day + DAY_MS,
  );
  return { play: row?.play ?? 0, bonus: row?.bonus ?? 0 };
}

/** What a game's coins depend on besides the day: XP's answer for it and the result facts, and the XP ops they hang on. */
export interface CoinPlan {
  /** The game's key (the XP ops' own). */
  key: string;
  now: number;
  /** The XP day's start (xpDayStart of `now`). */
  day: number;
  xp: GameXp;
  /** The device's word stood (XP's "solo" cap): only the minutes XP paid, no bonus. */
  solo: boolean;
  held: boolean;
  /** The bonus's facts the server has (a win comes from XP: `winPaid`). */
  result: Omit<CoinResult, "won">;
  /** The XP ops: the time op (a solo game's coins count its minutes) and the win op (the bonus's win). */
  timeOp: string;
  winOp: string;
}

/** The game's coins against `day`, with XP's time (`timeXp`, what its time op pays) and its win (`winPaid`) as given. */
export function coinsFor(p: CoinPlan, day: CoinDay, timeXp: number, winPaid: boolean): PlayCoins {
  const g: CoinGame = { xp: p.xp, solo: p.solo, held: p.held, result: { ...p.result, won: winPaid } };
  if (p.solo) g.paidMinutes = Math.floor(Math.max(0, timeXp) / XP.perMinute);
  return gameCoins(g, day);
}

/** The game's coin ops for `c` (worked out against `day`): only those that pay. Their guards are the module comment's. */
export function coinOps(me: LedgerAccount, p: CoinPlan, c: PlayCoins, day: CoinDay, which: { play?: boolean; bonus?: boolean } = { play: true, bonus: true }): Op[] {
  const ids = coinOpIds(p.key, me.account);
  const end = p.day + DAY_MS;
  const ops: Op[] = [];
  if (which.play && c.play > 0) {
    const time = p.solo ? ` AND EXISTS (SELECT 1 FROM ledger WHERE op_id = ? AND leg = 0)` : "";
    ops.push({
      id: ids.play,
      reason: PLAY,
      now: p.now,
      when: cond(`${daySum(PLAY)} + ? <= ?${time}`, me.account, p.day, end, c.play, PLAY_COINS.perDay, ...(p.solo ? [p.timeOp] : [])),
      legs: [leg.coins(me.user, c.play, p.key)],
    });
  }
  if (which.bonus && c.bonus > 0) {
    const won = c.parts.some((x) => x.label === "Win");
    ops.push({
      id: ids.bonus,
      reason: PLAY_BONUS,
      now: p.now,
      when: cond(`${daySum(PLAY_BONUS)} = ?${won ? ` AND EXISTS (SELECT 1 FROM ledger WHERE op_id = ? AND leg = 0)` : ""}`, me.account, p.day, end, day.bonus, ...(won ? [p.winOp] : [])),
      legs: [leg.coins(me.user, c.bonus, p.key)],
    });
  }
  return ops;
}

/** The game's coin ops as the ledger has them (their first legs' amounts; absent: not there). */
async function paidOf(sql: Sql, me: LedgerAccount, key: string): Promise<{ play: number | null; bonus: number | null }> {
  const ids = coinOpIds(key, me.account);
  const rows = await sql.all<{ op_id: string; delta: number }>("SELECT op_id, delta FROM ledger WHERE op_id IN (?, ?) AND leg = 0", ids.play, ids.bonus);
  const of = (id: string) => rows.find((r) => r.op_id === id)?.delta ?? null;
  return { play: of(ids.play), bonus: of(ids.bonus) };
}

/** What XP's ops for the game paid, as the ledger has them: its time op's XP and whether its win op is there. */
async function xpPaidOf(sql: Sql, p: CoinPlan): Promise<{ timeXp: number; winPaid: boolean }> {
  const row = await sql.first<{ time: number | null; win: number }>(
    "SELECT (SELECT delta FROM ledger WHERE op_id = ? AND leg = 0) AS time, EXISTS (SELECT 1 FROM ledger WHERE op_id = ? AND leg = 0) AS win",
    p.timeOp,
    p.winOp,
  );
  return { timeXp: row?.time ?? 0, winPaid: !!row?.win };
}

/**
 * After the game's batch (its coin ops `tried` beside its XP ops): what its coins paid. An op its guard refused is worked out again
 * from the ledger as it stands and applied alone (RETRIES times at most; then it pays nothing). Answers the game's coins as the
 * ledger has them, the parts as earned (the win only if XP paid it) and the day's totals now.
 */
export async function settleCoins(sql: Sql, me: LedgerAccount, p: CoinPlan, tried: readonly Op[]): Promise<PlayCoins> {
  const ids = coinOpIds(p.key, me.account);
  let paid = await paidOf(sql, me, p.key);
  for (let i = 0; i < RETRIES; i++) {
    const play = tried.some((o) => o.id === ids.play) && paid.play === null;
    const bonus = tried.some((o) => o.id === ids.bonus) && paid.bonus === null;
    if (!play && !bonus) break;
    const x = await xpPaidOf(sql, p);
    const day = await coinDayOf(sql, me.account, p.day);
    const ops = coinOps(me, p, coinsFor(p, day, x.timeXp, x.winPaid), day, { play, bonus });
    for (const op of ops) await applyOp(sql, me, op);
    paid = await paidOf(sql, me, p.key);
    if (!ops.length) break;
  }
  const x = await xpPaidOf(sql, p);
  const today = await coinDayOf(sql, me.account, p.day);
  const parts = coinParts({ ...p.result, won: x.winPaid }, p.solo);
  const bonus = paid.bonus ?? 0;
  return {
    play: paid.play ?? 0,
    bonus,
    parts,
    step: parts.length ? bonusStep(Math.max(0, today.bonus - bonus)) : null,
    today,
  };
}
