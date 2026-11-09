import { XP, gameXp, isXpNone, xpDayStart, xpGrant, xpParts, type XpFacts, type XpGrant, type XpNone, type XpPart } from "@chessroyale/core";
import type { Sql } from "./accounts.ts";
import { cond, ledgerAccount, leg, opOutcome, opStatements, type Cond, type Op } from "./ledger.ts";

/**
 * XP (Eric, Nov 9; core's xp.ts has the rules, XP in settings.ts; docs/decisions/2026-11-09-xp-*.md): the one place that decides a
 * finished game's XP and grants it. Every fact is the server's own: the match room's moves and clock, or (solo) the server's clock
 * between the game's start and its result; whether the account is a guest or banned is read here. The grant goes through the ledger
 * as asset kind `xp` (the wallet's `xp` column): one op per game per player, keyed by the game, so a retry, a second tab, a restart
 * of the room or a second device grants once.
 *
 *   - `xp:<game>:<ledger id>`: the minutes' XP (reason "xp").
 *   - `xpwin:<game>:<ledger id>`: the win's (reason "xp-win"), with its cap as the op's guard, checked in the same transaction:
 *     a friends' lobby pays it once an XP day per set of opponents (`vs`), solo `XP.soloWinsPerDay` times an XP day (the leg's
 *     source says which: `vs:<their ledger ids>` or `solo`).
 * Both go in one batch. What the screen shows is answered (`XpGrant`) and kept on the game's result row (results.xp_before,
 * xp_parts, xp_none: `xpColumns`), so an online result screen can ask for it (GET /api/xp?game=CODE).
 * (Only types come from accounts.ts: it imports this file's helpers while it loads.)
 */

/**
 * A solo game the server is timing (Nov 9): one open per account (a new start replaces it), taken off as its result comes in, so
 * it's timed once. `test_minutes`: the test switch ?xpgame=MINUTES (test servers and admins only): it counts as a game that long,
 * with enough moves. A new table: nothing older reads or writes it.
 */
export const XP_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS solo_games (
    user_id TEXT PRIMARY KEY,
    id TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    test_minutes INTEGER
  )`,
];

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

/** A solo game's end, as its result comes in: its time by the server's clock (and the test switch's minutes), once. Null: unknown, or finished already. */
export async function endSoloGame(sql: Sql, userId: string, game: unknown, now: number): Promise<{ id: string; ms: number; testMinutes: number | null } | null> {
  if (typeof game !== "string" || !SOLO_GAME.test(game)) return null;
  const row = await sql.first<{ started_at: number; test_minutes: number | null }>("DELETE FROM solo_games WHERE user_id = ? AND id = ? RETURNING started_at, test_minutes", userId, game);
  return row ? { id: game, ms: Math.max(0, now - row.started_at), testMinutes: row.test_minutes } : null;
}

/** How the win bonus is capped for this game. */
export type WinCap =
  /** None: a matchmade game (strangers), or a friends' lobby with no other account against you. */
  | null
  /** A friends' lobby: once an XP day per set of opponents (their account ids). */
  | { vs: readonly string[] }
  /** A solo game (its result is the device's word): XP.soloWinsPerDay an XP day. */
  | "solo";

export interface XpGame {
  /** The game, for the ledger's keys: unique per game ("lobby:CODE:start", "squads:…", "duel:…", "solo:<id>"). */
  key: string;
  facts: Omit<XpFacts, "guest" | "banned">;
  cap?: WinCap;
  /** Sign-in is set up here: a guest earns nothing (as boss tokens: guests could be many, merging into one account). */
  signedInOnly: boolean;
  now: number;
}

const newId = (bytes = 9) => [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");

/** An account's XP (0 for none, or no such account). */
export async function xpOf(sql: Sql, userId: string): Promise<number> {
  return (await sql.first<{ xp: number | null }>("SELECT xp FROM wallets WHERE user_id = ?", userId))?.xp ?? 0;
}

/** Who this is, for the rules: a guest (no sign-in identity), banned, and their XP now. Null: no such account (deleted). */
async function standing(sql: Sql, userId: string) {
  return sql.first<{ signed: number; banned: number; xp: number }>(
    `SELECT (u.email IS NOT NULL OR u.google_sub IS NOT NULL) AS signed,
       EXISTS (SELECT 1 FROM fairplay_cases c WHERE c.user_id = u.id AND c.status = 'banned') AS banned,
       COALESCE((SELECT w.xp FROM wallets w WHERE w.user_id = u.id), 0) AS xp
     FROM users u WHERE u.id = ?`,
    userId,
  );
}

/** The win op's cap: its leg's source and its guard (the day's count, in the same statement as the leg goes in). */
async function winCap(sql: Sql, account: string, game: XpGame): Promise<{ source: string; when?: Cond }> {
  const day = xpDayStart(game.now);
  if (game.cap === "solo") {
    return {
      source: "solo",
      when: cond(
        "(SELECT COUNT(*) FROM ledger WHERE account = ? AND asset_kind = 'xp' AND reason = 'xp-win' AND source_id = 'solo' AND created_at >= ?) < ?",
        account,
        day,
        XP.soloWinsPerDay,
      ),
    };
  }
  if (game.cap && game.cap.vs.length) {
    // (Named by their ledger ids, never their account ids: a deleted account's then names nobody.)
    const ids: string[] = [];
    for (const u of game.cap.vs) {
      const a = await ledgerAccount(sql, u);
      if (a) ids.push(a.account);
    }
    if (ids.length) {
      const source = `vs:${[...new Set(ids)].sort().join(",")}`.slice(0, 512);
      return {
        source,
        when: cond("NOT EXISTS (SELECT 1 FROM ledger WHERE account = ? AND asset_kind = 'xp' AND reason = 'xp-win' AND source_id = ? AND created_at >= ?)", account, source, day),
      };
    }
  }
  return { source: game.key };
}

/**
 * A finished game's XP for one player: decided by the rules (core's gameXp) from the server's facts, and granted through the ledger
 * once. Answers what the result screen shows. Null: no such account (deleted mid-match). A failed write throws.
 */
export async function grantXp(sql: Sql, userId: string, game: XpGame): Promise<XpGrant | null> {
  const who = await standing(sql, userId);
  if (!who) return null;
  const g = gameXp({ ...game.facts, guest: game.signedInOnly && !who.signed, banned: !!who.banned });
  if (g.none) return xpGrant(who.xp, [], g.none);
  const me = await ledgerAccount(sql, userId);
  if (!me) return null;
  const ops: { op: Op; nonce: string }[] = [];
  const time: Op = { id: `xp:${game.key}:${me.account}`, reason: "xp", now: game.now, legs: g.time ? [leg.xp(userId, g.time, game.key)] : [] };
  const capped = g.win ? await winCap(sql, me.account, game) : null;
  const win: Op = {
    id: `xpwin:${game.key}:${me.account}`,
    reason: "xp-win",
    now: game.now,
    ...(capped?.when ? { when: capped.when } : {}),
    legs: g.win ? [leg.xp(userId, g.win, capped!.source)] : [],
  };
  for (const op of [time, win]) if (op.legs.length) ops.push({ op, nonce: newId() });
  if (ops.length) await sql.batch(ops.flatMap((o) => opStatements(me, o.op, o.nonce)));
  // (A replay, its first attempt's: the same game, so the same parts.)
  const paid = async (op: Op, nonce: string | undefined) => (nonce ? (await opOutcome(sql, op.id, nonce)) !== "refused" : false);
  const nonceOf = (op: Op) => ops.find((o) => o.op === op)?.nonce;
  const timePaid = await paid(time, nonceOf(time));
  const winPaid = await paid(win, nonceOf(win));
  const parts = xpParts({ ...g, time: timePaid ? g.time : 0 }, winPaid);
  const after = await xpOf(sql, userId);
  const gained = parts.reduce((s, p) => s + p.xp, 0);
  return xpGrant(Math.max(0, after - gained), parts);
}

/** A grant as the result row keeps it (results: xp_before, xp_parts, xp_none). */
export function xpColumns(x: XpGrant | null | undefined): [number | null, string | null, string | null] {
  if (!x) return [null, null, null];
  return [x.before, x.none ? null : JSON.stringify(x.parts), x.none ?? null];
}

/** A result row's grant again (for GET /api/xp): null if it has none (a result from before XP, or one the server never decided). */
export function xpFromRow(r: { xp_before: number | null; xp_parts: string | null; xp_none: string | null }): XpGrant | null {
  if (r.xp_before === null) return null;
  if (isXpNone(r.xp_none)) return xpGrant(r.xp_before, [], r.xp_none as XpNone);
  let parts: XpPart[] = [];
  try {
    const p = JSON.parse(r.xp_parts ?? "[]") as unknown;
    if (Array.isArray(p)) parts = p.filter((x): x is XpPart => !!x && typeof x.label === "string" && typeof x.xp === "number");
  } catch {
    // (Unreadable: no parts.)
  }
  return xpGrant(r.xp_before, parts);
}

/** How long a result screen may ask for its game's XP. */
const ASK_WITHIN_MS = 2 * 3_600_000;

/** Your XP from an online game (its lobby's code), as its result row keeps it: the result screen asks. Null: not written yet. */
export async function gameXpOf(sql: Sql, userId: string, code: unknown, now: number): Promise<XpGrant | null> {
  if (typeof code !== "string" || !/^[A-Z2-9]{5}$/.test(code)) return null;
  const row = await sql.first<{ xp_before: number | null; xp_parts: string | null; xp_none: string | null }>(
    "SELECT xp_before, xp_parts, xp_none FROM results WHERE user_id = ? AND lobby = ? AND online = 1 AND played_at > ? ORDER BY played_at DESC, id DESC LIMIT 1",
    userId,
    code,
    now - ASK_WITHIN_MS,
  );
  return row ? xpFromRow(row) : null;
}

/**
 * The test switch `?xp=<n>` (test servers and admins only: the caller checks testSwitchesOn): sets an account's XP to `n` through
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
