import { XP, XP_DAILY, gameXp, isXpNone, readRewards, xpDayStart, xpGrant, xpParts, type XpFacts, type XpGrant, type XpNone, type XpPart } from "@chessroyale/core";
import type { Sql } from "./accounts.ts";
import { cond, ledgerAccount, leg, opStatements, type Cond, type Op } from "./ledger.ts";
import { dailyOp, gameRewards, payLevels } from "./rewards.ts";

/**
 * XP (Eric, Nov 9; core's xp.ts has the rules, XP in settings.ts; docs/decisions/2026-11-09-xp-*.md): the one place that decides a
 * finished game's XP and grants it. Every fact is the server's own: the match room's moves and clock, or (solo) the server's clock
 * between the game's start and its result; whether the account is a guest or banned is read here. The grant goes through the ledger
 * as asset kind `xp` (the wallet's `xp` column): one op per game per player, keyed by the game, so a retry, a second tab, a restart
 * of the room or a second device grants once.
 *
 *   - `xp:<game>:<ledger id>`: the minutes' XP (reason "xp").
 *   - `xpwin:<game>:<ledger id>`: the win's (reason "xp-win"), with its cap as the op's guard, checked in the same transaction:
 *     a friends' lobby pays it once an XP day per opponent (`vs`: none of them beaten yet today), solo `XP.soloWinsPerDay` times
 *     an XP day (the leg's source says which: `vs:<their ledger ids>` or `solo`).
 *   - A solo game's time leg has source `solo`: capped at XP.soloMinutesPerDay minutes an XP day, its guard in the same statement.
 * Both go in one batch, with phase 2's daily reward (rewards.ts: `daily:<XP day>:<ledger id>`, once a day, for a game of
 * XP.dailyMinMoves of your own moves); then the level rewards owed at the XP it reached (rewards.ts payLevels: `level:<n>:<ledger id>`,
 * once per level). Nothing at all while rewards are paused (PAUSE_REWARDS: `paused`). What the screen shows is answered (`XpGrant`) and kept on the game's result row (results.xp_before,
 * xp_parts, xp_none: `xpColumns`), so an online result screen can ask for it (GET /api/xp?game=CODE).
 * (Only types come from accounts.ts: it imports this file's helpers while it loads.)
 */

/**
 * A solo game the server is timing (Nov 9): one open per account (a new start replaces it), taken off as its result comes in, so
 * it's timed once. `test_minutes`: the test switch ?xpgame=MINUTES (test servers only; SOLO_TESTED for an admin's elsewhere): it
 * counts as a game that long, with enough moves. A new table: nothing older reads or writes it.
 */
export const XP_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS solo_games (
    user_id TEXT PRIMARY KEY,
    id TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    test_minutes INTEGER
  )`,
];

/**
 * `test_minutes` for a solo game an admin started with ?xpgame where TEST_SWITCHES is off (production): a test game, no XP (review
 * m1, Nov 9). Any other value is the switch's minutes (TEST_SWITCHES on), or NULL for none.
 */
export const SOLO_TESTED = -1;

/** A solo game's id: 18 hex characters. */
const SOLO_GAME = /^[0-9a-f]{18}$/;

/** A solo game begins (any solo game: Solo, a Solo raid, Boss alone): the server notes when, by its own clock. Answers its id. */
export async function startSoloGame(sql: Sql, userId: string, now: number, testMinutes: number | null = null): Promise<string> {
  const id = newId(9);
  await sql.run(
    `INSERT INTO solo_games (user_id, id, started_at, test_minutes) SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)
     ON CONFLICT (user_id) DO UPDATE SET id = excluded.id, started_at = excluded.started_at, test_minutes = excluded.test_minutes`,
    userId,
    id,
    now,
    testMinutes,
    userId,
  );
  return id;
}

/**
 * A solo game's end, as its result comes in: its time by the server's clock (and the test switch's minutes), once. Null: unknown,
 * or finished already. (Taken off before its XP is granted: if the grant then throws, that game's time is lost and a retry can't
 * get it back, as its result is answered "no XP". Rare (a failed write), and the safe way round: never paid twice.)
 */
export async function endSoloGame(sql: Sql, userId: string, game: unknown, now: number): Promise<{ id: string; ms: number; testMinutes: number | null } | null> {
  if (typeof game !== "string" || !SOLO_GAME.test(game)) return null;
  const row = await sql.first<{ started_at: number; test_minutes: number | null }>("DELETE FROM solo_games WHERE user_id = ? AND id = ? RETURNING started_at, test_minutes", userId, game);
  return row ? { id: game, ms: Math.max(0, now - row.started_at), testMinutes: row.test_minutes } : null;
}

/** How the win bonus is capped for this game. */
export type WinCap =
  /** None: a matchmade game (strangers), or a friends' lobby with no other account against you. */
  | null
  /** A friends' lobby: once an XP day per opponent (their account ids): no win today against any of them yet. */
  | { vs: readonly string[] }
  /** A solo game (its result is the device's word): XP.soloWinsPerDay wins and XP.soloMinutesPerDay minutes an XP day. */
  | "solo";

export interface XpGame {
  /** The game, for the ledger's keys: unique per game ("lobby:CODE:start", "squads:…", "duel:…", "solo:<id>"). */
  key: string;
  facts: Omit<XpFacts, "guest" | "banned">;
  cap?: WinCap;
  /** Sign-in is set up here: a guest earns nothing (as boss tokens: guests could be many, merging into one account). */
  signedInOnly: boolean;
  now: number;
  /** The kill switch PAUSE_REWARDS is on (Nov 9): no XP and no rewards for this game; the box says so. */
  paused?: boolean;
}

const newId = (bytes = 9) => [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");

/** An account's XP (0 for none, or no such account). */
export async function xpOf(sql: Sql, userId: string): Promise<number> {
  return (await sql.first<{ xp: number | null }>("SELECT xp FROM wallets WHERE user_id = ?", userId))?.xp ?? 0;
}

/** A solo time leg's source (the daily cap counts these), and the win's. */
const SOLO = "solo";

/**
 * Who this is, for the rules: a guest (no sign-in identity), banned, their XP now, their ledger id (null: none yet) and, for the
 * solo cap, the solo time XP already paid this XP day: one read. Null: no such account (deleted).
 */
async function standing(sql: Sql, userId: string, day: number) {
  return sql.first<{ signed: number; banned: number; xp: number; account: string | null; solo: number }>(
    `SELECT (u.email IS NOT NULL OR u.google_sub IS NOT NULL) AS signed,
       EXISTS (SELECT 1 FROM fairplay_cases c WHERE c.user_id = u.id AND c.status = 'banned') AS banned,
       COALESCE((SELECT w.xp FROM wallets w WHERE w.user_id = u.id), 0) AS xp,
       a.account AS account,
       COALESCE((SELECT SUM(l.delta) FROM ledger l WHERE l.account = a.account AND l.asset_kind = 'xp' AND l.reason = 'xp' AND l.source_id = '${SOLO}' AND l.created_at >= ?), 0) AS solo
     FROM users u LEFT JOIN ledger_accounts a ON a.user_id = u.id WHERE u.id = ?`,
    day,
    userId,
  );
}

/**
 * Several accounts' ledger ids at once (the friends' cap; review m5): one query per 90 (D1's bound-parameter limit is 100). An
 * account with none yet gets one (ledgerAccount: once ever per account), so every opponent is named; a deleted one names nobody.
 */
async function ledgerIds(sql: Sql, userIds: readonly string[]): Promise<string[]> {
  const ids = [...new Set(userIds)];
  const found = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 90) {
    const chunk = ids.slice(i, i + 90);
    for (const r of await sql.all<{ user_id: string; account: string }>(`SELECT user_id, account FROM ledger_accounts WHERE user_id IN (${chunk.map(() => "?").join(", ")})`, ...chunk)) found.set(r.user_id, r.account);
  }
  for (const u of ids) {
    if (found.has(u)) continue;
    const a = await ledgerAccount(sql, u);
    if (a) found.set(u, a.account);
  }
  return [...new Set(found.values())].sort();
}

/** The win op's cap: its leg's source and its guard (the day's count, in the same statement as the leg goes in). */
async function winCap(sql: Sql, account: string, game: XpGame, day: number): Promise<{ source: string; when?: Cond }> {
  if (game.cap === "solo") {
    return {
      source: SOLO,
      when: cond(
        `(SELECT COUNT(*) FROM ledger WHERE account = ? AND asset_kind = 'xp' AND reason = 'xp-win' AND source_id = '${SOLO}' AND created_at >= ?) < ?`,
        account,
        day,
        XP.soloWinsPerDay,
      ),
    };
  }
  if (game.cap && game.cap.vs.length) {
    // (Named by their ledger ids, never their account ids: a deleted account's then names nobody.) Once an XP day per opponent: any win today against a set that
    // shares one of them blocks this one (review m4, Nov 9: per set, n alts gave 2^n − 1 wins). The source lists the set
    // ("vs:<id>,<id>"); the guard looks for each id in it, between commas (ledger ids are hex: no LIKE wildcards).
    const ids = await ledgerIds(sql, game.cap.vs);
    if (ids.length) {
      return {
        source: `vs:${ids.join(",")}`,
        when: cond(
          // (The ids as one JSON parameter, so the statement's parameters don't grow with the opponents: D1 allows 100; delta review D2.)
          `NOT EXISTS (SELECT 1 FROM ledger, json_each(?) j WHERE account = ? AND asset_kind = 'xp' AND reason = 'xp-win' AND source_id LIKE 'vs:%' AND created_at >= ? AND (',' || substr(source_id, 4) || ',') LIKE '%,' || j.value || ',%')`,
          JSON.stringify(ids),
          account,
          day,
        ),
      };
    }
  }
  return { source: game.key };
}

/**
 * A finished game's XP for one player: decided by the rules (core's gameXp) from the server's facts, and granted through the ledger
 * once. Answers what the result screen shows. Null: no such account (deleted mid-match). A failed write throws.
 *
 * A solo game's time XP is capped at XP.soloMinutesPerDay minutes an XP day (review M2, Nov 9): its leg's source is "solo", what's
 * left today is read first and paid (the parts say "Daily solo limit" if that trimmed it), and the guard checks the day's sum again
 * in the same statement, so two results at once can't pass the cap (the later one is refused: +0).
 */
export async function grantXp(sql: Sql, userId: string, game: XpGame): Promise<XpGrant | null> {
  const day = xpDayStart(game.now);
  const who = await standing(sql, userId, day);
  if (!who) return null;
  const g = gameXp({ ...game.facts, guest: game.signedInOnly && !who.signed, banned: !!who.banned });
  if (g.none) return xpGrant(who.xp, [], g.none);
  if (game.paused) return xpGrant(who.xp, [], "paused");
  const me = who.account ? { user: userId, account: who.account } : await ledgerAccount(sql, userId);
  if (!me) return null;
  const solo = game.cap === "solo";
  // (The daily reward: a game of XP.dailyMinMoves of your own moves; solo, also XP.dailySoloMinMinutes of the server's own time.)
  const daily = game.facts.moves >= XP.dailyMinMoves && (!solo || game.facts.ms >= XP.dailySoloMinMinutes * 60_000) ? dailyOp(me, day, game.key, game.now) : null;
  const soloLimit = XP.soloMinutesPerDay * XP.perMinute;
  const timeXp = solo ? Math.max(0, Math.min(g.time, soloLimit - (who.solo ?? 0))) : g.time;
  const time: Op = {
    id: `xp:${game.key}:${me.account}`,
    reason: "xp",
    now: game.now,
    ...(solo
      ? { when: cond(`COALESCE((SELECT SUM(delta) FROM ledger WHERE account = ? AND asset_kind = 'xp' AND reason = 'xp' AND source_id = '${SOLO}' AND created_at >= ?), 0) + ? <= ?`, me.account, day, timeXp, soloLimit) }
      : {}),
    legs: timeXp ? [leg.xp(userId, timeXp, solo ? SOLO : game.key)] : [],
  };
  const capped = g.win ? await winCap(sql, me.account, game, day) : null;
  const win: Op = {
    id: `xpwin:${game.key}:${me.account}`,
    reason: "xp-win",
    now: game.now,
    ...(capped?.when ? { when: capped.when } : {}),
    legs: g.win ? [leg.xp(userId, g.win, capped!.source)] : [],
  };
  const nonces = new Map<Op, string>();
  for (const op of [time, win, ...(daily ? [daily] : [])]) if (op.legs.length) nonces.set(op, newId());
  if (nonces.size) await sql.batch([...nonces].flatMap(([op, nonce]) => opStatements(me, op, nonce)));
  // (What went in, and the wallet after, in one read. A replay: its first attempt's leg, so the same parts. The daily reward is this
  // game's if its first leg names this game: another game today paid it otherwise.)
  const after = await sql.first<{ time: number | null; win: string | null; daily: number | null; xp: number }>(
    `SELECT (SELECT delta FROM ledger WHERE op_id = ? AND leg = 0) AS time, (SELECT nonce FROM ledger WHERE op_id = ? AND leg = 0) AS win,
       (SELECT delta FROM ledger WHERE op_id = ? AND asset_kind = 'xp' AND source_id = ?) AS daily,
       COALESCE((SELECT xp FROM wallets WHERE user_id = ?), 0) AS xp`,
    time.id,
    win.id,
    daily?.id ?? "",
    game.key,
    userId,
  );
  const timePaid = nonces.has(time) ? (after?.time ?? 0) : 0;
  const winPaid = nonces.has(win) && after?.win != null;
  const dailyPaid = daily ? (after?.daily ?? 0) : 0;
  const parts = [...(solo ? xpParts(g, winPaid, timePaid) : xpParts({ ...g, time: timePaid ? g.time : 0 }, winPaid)), ...(dailyPaid ? [{ label: XP_DAILY, xp: dailyPaid }] : [])];
  const gained = parts.reduce((s, p) => s + p.xp, 0);
  // (The cap took all of it: say so as the reason, not a box of +0s.)
  if (solo && g.time && !gained) return xpGrant(after?.xp ?? who.xp, [], "limit");
  // (The levels owed at the XP it reached: paid once each, their legs naming this game, so its result answers them; then this
  // game's rewards as the ledger has them, so a replay answers the same.)
  // (A failure here leaves the levels owed (paid at the next game, never twice) and must not cost the box this game's XP, already in:
  // review of #574, m4.)
  try {
    await payLevels(sql, me, after?.xp ?? 0, game.key, game.now);
  } catch (e) {
    console.error("payLevels", e);
  }
  // (Its own try: a failed level payout must not hide the daily reward's crate, already paid above. Delta review n2.)
  let rewards: Awaited<ReturnType<typeof gameRewards>> | undefined;
  try {
    rewards = await gameRewards(sql, me, game.key);
  } catch (e) {
    console.error("gameRewards", e);
  }
  return xpGrant(Math.max(0, (after?.xp ?? 0) - gained), parts, undefined, rewards);
}

/** A grant as the result row keeps it (results: xp_before, xp_parts, xp_none, xp_rewards). */
export function xpColumns(x: XpGrant | null | undefined): [number | null, string | null, string | null, string | null] {
  if (!x) return [null, null, null, null];
  return [x.before, x.none ? null : JSON.stringify(x.parts), x.none ?? null, x.rewards ? JSON.stringify(x.rewards) : null];
}

/** A result row's grant again (for GET /api/xp): null if it has none (a result from before XP, or one the server never decided). */
export function xpFromRow(r: { xp_before: number | null; xp_parts: string | null; xp_none: string | null; xp_rewards?: string | null }): XpGrant | null {
  if (r.xp_before === null) return null;
  if (isXpNone(r.xp_none)) return xpGrant(r.xp_before, [], r.xp_none as XpNone);
  let parts: XpPart[] = [];
  try {
    const p = JSON.parse(r.xp_parts ?? "[]") as unknown;
    if (Array.isArray(p)) parts = p.filter((x): x is XpPart => !!x && typeof x.label === "string" && typeof x.xp === "number");
  } catch {
    // (Unreadable: no parts.)
  }
  return xpGrant(r.xp_before, parts, undefined, readRewards(r.xp_rewards));
}

/** How long a result screen may ask for its game's XP. */
const ASK_WITHIN_MS = 2 * 3_600_000;

/** Your XP from an online game (its lobby's code), as its result row keeps it: the result screen asks. Null: not written yet. */
export async function gameXpOf(sql: Sql, userId: string, code: unknown, now: number): Promise<XpGrant | null> {
  if (typeof code !== "string" || !/^[A-Z2-9]{5}$/.test(code)) return null;
  const row = await sql.first<{ xp_before: number | null; xp_parts: string | null; xp_none: string | null; xp_rewards: string | null }>(
    "SELECT xp_before, xp_parts, xp_none, xp_rewards FROM results WHERE user_id = ? AND lobby = ? AND online = 1 AND played_at > ? ORDER BY played_at DESC, id DESC LIMIT 1",
    userId,
    code,
    now - ASK_WITHIN_MS,
  );
  return row ? xpFromRow(row) : null;
}

/**
 * The test switch `?xp=<n>` (test servers only: the route answers only where TEST_SWITCHES is "1", review of #574 M1): sets an account's XP to `n` through
 * the ledger (reason "test"), so a test can start a game just short of a level. Answers the XP now.
 */
export async function setTestXp(sql: Sql, userId: string, n: unknown, now: number): Promise<number | null> {
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > XP.testMax) return null;
  const me = await ledgerAccount(sql, userId);
  if (!me) return null;
  const delta = n - (await xpOf(sql, userId));
  if (delta) {
    const nonce = newId();
    await sql.batch(
      opStatements(me, { id: `xp-test:${me.account}:${newId()}`, reason: "test", now, when: cond("COALESCE((SELECT xp FROM wallets WHERE user_id = ?), 0) + ? >= 0", userId, delta), legs: [leg.xp(userId, delta)] }, nonce),
    );
  }
  return xpOf(sql, userId);
}
