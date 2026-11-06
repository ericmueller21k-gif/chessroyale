import { bossCrateOf, clawWins, isTokenBoss, mulberry32, tokenBossName } from "@chessroyale/core";
import type { Sql, Stmt } from "./accounts.ts";
import { serverRandom } from "./boss-tokens.ts";
import { lockerState, type LockerState } from "./locker.ts";

/**
 * Boingo's claw machine (Eric, Nov 6: "you put in boss tokens, and there's a chance you get a crate from a boss that's openable right
 * away"; CLAW in core's settings; docs/decisions/2026-11-06-claw-machine.md; docs/areas/shop.md, "The claw machine"). One play spends
 * one token of the boss you pick and, `CLAW.winChance` of the time, puts that boss's Boss Crate in your inventory, unopened (a
 * `boss_crates` row, so it opens as a bought one: boss-tokens.ts, openBossCrate). Everything is decided here, as the coin goes in:
 * the roll is the server's own (crypto), never the device's; the claw on screen only shows the answer (the stop tap is for show).
 *
 * Safe to retry and to race: the app sends its own id for each play (`request`, made once per coin), and
 *   - one transaction (D1's batch: all of it or none) writes the play's row only if the token is there, then takes the token off
 *     only if that row went in, then puts the crate in only if that row went in and won. Nothing can change between the statements
 *     of one transaction, so the token is spent exactly when the play is logged, and the crate given exactly when it won;
 *   - the play's row is unique per account and request id: a retry of the same play (a lost answer, a double tap) writes nothing,
 *     spends nothing and gives nothing, and answers the first play's outcome;
 *   - two plays at once (two taps with different ids, two devices) are two transactions, one after the other: each finds the token
 *     there or not, and a count can't go below zero (boss_tokens' CHECK).
 *
 * The log (`claw_plays`): every play, its account, boss, outcome and time, kept with the account (account-data.ts, "claw").
 */
export const CLAW_SCHEMA = [
  // One row a play: `request` is the app's id for it (unique per account: a retry finds the first play); `crate` is the BOSS_CRATES id
  // it won (null on a loss). A new table: nothing older reads or writes it.
  `CREATE TABLE IF NOT EXISTS claw_plays (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    request TEXT NOT NULL,
    boss TEXT NOT NULL,
    won INTEGER NOT NULL,
    crate TEXT,
    at INTEGER NOT NULL,
    UNIQUE (user_id, request)
  )`,
];

const stmt = (sql: string, ...params: unknown[]): Stmt => ({ sql, params });
const randomHex = (bytes: number) => [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");

/** The app's id for one play: 8 to 64 letters, digits, "-" or "_". */
const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** A play's answer: the outcome, the crate it won (its BOSS_CRATES id), the boss, and your locker after it. */
export interface ClawPlay {
  ok: true;
  won: boolean;
  crate?: string;
  boss: string;
  /** This answer repeats a play already made with this request id (a retry): nothing was spent or given again. */
  again?: true;
  locker: LockerState;
}

export interface ClawOptions {
  /** The roll (0 to 1). The server's own randomness unless a test gives one (unit tests; `seed` below for the e2e). */
  rng?: () => number;
  /**
   * The e2e's seed hook: the roll is mulberry32(seed)'s first number. The API passes it only where TEST_SWITCHES is "1" (local, the
   * e2e server, staging; never production), never an admin's: a seed could pick a win.
   */
  seed?: number;
  admin?: boolean;
}

/** Why a play was refused: "You need a Folio token." */
export const clawNeedsToken = (boss: string) => {
  const n = tokenBossName(boss);
  return `You need ${/^[aeiou]/i.test(n) ? "an" : "a"} ${n} token.`;
};

/**
 * One play of the claw machine: one of `boss`'s tokens in, a roll, and that boss's crate on a win. One transaction (above). Answers
 * the outcome, or the first play's for a request id already used; or why it was refused (no such boss or crate, no token).
 */
export async function playClaw(
  sql: Sql,
  userId: string,
  boss: unknown,
  request: unknown,
  now: number,
  opts: ClawOptions = {},
): Promise<ClawPlay | { ok: false; message: string }> {
  if (typeof request !== "string" || !REQUEST_ID.test(request)) return { ok: false, message: "No play to make." };
  const answer = async (row: { id: string; boss: string; won: number; crate: string | null }, again: boolean): Promise<ClawPlay> => ({
    ok: true,
    won: row.won === 1,
    ...(row.won === 1 && row.crate ? { crate: row.crate } : {}),
    boss: row.boss,
    ...(again ? { again: true as const } : {}),
    locker: await lockerState(sql, userId, opts.admin ?? false),
  });
  // A retry of a play already made: its outcome, nothing spent again (whatever boss it names now).
  const first = await sql.first<{ id: string; boss: string; won: number; crate: string | null }>(
    "SELECT id, boss, won, crate FROM claw_plays WHERE user_id = ? AND request = ?",
    userId,
    request,
  );
  if (first) return answer(first, true);
  const crate = isTokenBoss(boss) ? bossCrateOf(boss) : undefined;
  if (!crate) return { ok: false, message: "No such crate." };
  const roll = opts.seed !== undefined ? mulberry32(opts.seed >>> 0)() : (opts.rng ?? serverRandom)();
  const won = clawWins(roll);
  const id = randomHex(12);
  const crateRow = randomHex(9);
  const played = "EXISTS (SELECT 1 FROM claw_plays WHERE id = ? AND user_id = ?)";
  await sql.batch([
    // The play goes in only if a token is there (and only once per request id: a retry racing this one writes nothing).
    stmt(
      `INSERT INTO claw_plays (id, user_id, request, boss, won, crate, at)
       SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM boss_tokens WHERE user_id = ? AND boss = ? AND n >= 1)
       ON CONFLICT (user_id, request) DO NOTHING`,
      id,
      userId,
      request,
      crate.boss,
      won ? 1 : 0,
      won ? crate.id : null,
      now,
      userId,
      crate.boss,
    ),
    // The token comes off only if that play went in.
    stmt(`UPDATE boss_tokens SET n = n - 1 WHERE user_id = ? AND boss = ? AND ${played}`, userId, crate.boss, id, userId),
    // The crate goes in only if that play went in and won: unopened, as a bought one (openBossCrate opens it).
    stmt(`INSERT INTO boss_crates (id, user_id, crate, bought_at) SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM claw_plays WHERE id = ? AND user_id = ? AND won = 1)`, crateRow, userId, crate.id, now, id, userId),
  ]);
  const row = await sql.first<{ id: string; boss: string; won: number; crate: string | null }>(
    "SELECT id, boss, won, crate FROM claw_plays WHERE user_id = ? AND request = ?",
    userId,
    request,
  );
  if (!row) return { ok: false, message: clawNeedsToken(crate.boss) };
  if (row.id === id) console.log(`claw: ${userId} played a ${crate.boss} token at ${new Date(now).toISOString()}: ${won ? `won ${crate.id}` : "lost"}`);
  return answer(row, row.id !== id);
}
