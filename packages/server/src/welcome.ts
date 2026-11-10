import { WELCOME_CRATE, WELCOME_CRATE_ID, WELCOME_GIFT, XP, mulberry32, nextWelcomeMilestone, rollWelcome, type CrateRoll, type ItemInstance } from "@chessroyale/core";
import type { Sql } from "./accounts.ts";
import { applyOp, cond, leg, ledgerAccount, type LedgerAccount } from "./ledger.ts";

/**
 * The HunChess Welcome Crates on the server (Eric, Nov 6; core's welcome.ts; docs/decisions/2026-11-06-welcome-crate.md): "the first
 * one you get after 5 games, the next one you get after 25". Everything that counts is decided here, never by the app: whether an
 * account has finished enough games, each grant (once per account and milestone, ever), the prize's roll (the server's own
 * randomness, a different ride from the first's) and each opening (once).
 *
 * One table, `welcome_crates`: one row per account and milestone it earned, keyed by both (PRIMARY KEY (user_id, milestone)), so a
 * second row for one can't exist: the grant is one statement that inserts each earned milestone's row only while the account is
 * signed in and its finished games (counted in that same statement) reach it, and does nothing for a row that's there. So retries,
 * races, two tabs and two Workers grant each once. Each grant and each opening is a ledger op (ledger.ts: `welcome:<ledger id>:<n>`,
 * `welcome-open:<ledger id>:<n>`), one transaction each. Nothing older reads or writes the table: an account without rows reads as
 * none earned yet. (Only types come from accounts.ts: it imports this file's schema while it loads.)
 */
export const WELCOME_SCHEMA = [
  // One row per account and milestone it earned (Eric: "the first one you get after 5 games, the next one you get after 25"):
  // `milestone` (WELCOME_GIFT.milestones: 5, 25), `granted_at`: when it was earned; `games`: the finished games counted then;
  // `seen_at`: when its owner closed its "You earned a Welcome Crate!" notice (NULL: not yet: it shows); `opened_at`, `item_id` and
  // `def`: when it was opened, the ride it gave (an `items` row, crate 'welcome-hunchess') and that ride's item (kept here too, so
  // the next crate gives a different one even if the ride is deleted). NULL: not opened.
  `CREATE TABLE IF NOT EXISTS welcome_crates (
    user_id TEXT NOT NULL,
    milestone INTEGER NOT NULL,
    granted_at INTEGER NOT NULL,
    games INTEGER NOT NULL,
    seen_at INTEGER,
    opened_at INTEGER,
    item_id TEXT,
    def TEXT,
    PRIMARY KEY (user_id, milestone)
  )`,
];

/**
 * An account's finished games, in SQL (`?` is the account's id, twice). A game counts when it reached a result (a win, a loss or a
 * draw), in any mode or against any boss:
 *   - every row of `results` for an online match (written by its match room: Classic, Crowd and 50 v 50, boss raids, friends' lobbies,
 *     Squads), except one recorded because its player abandoned it (`abandoned` = 1: gone too long, idle or removed mid-match; since
 *     Nov 6). A match left before its first move is never recorded, so never counted;
 *   - a solo match's row (posted by the app from the result screen) only with XP.minMoves moves (as its XP) and when the server timed
 *     it for WELCOME_GIFT.soloMinSeconds (`play_ms`, the server's clock: Nov 10, the outside review's finding 10; empty posts had
 *     earned crates). Solo rows from before the server timed games (Nov 9) no longer count;
 *   - every ranked 1 v 1 game (`ranked_1v1.games`: aborted games are never recorded).
 * Results from before Nov 6 have `abandoned` NULL and count (they can't be told apart). Not stored anywhere, so not counted: auto
 * chess (played on the device), and a ranked 1 v 1 game while its player was held by fair play.
 */
export const FINISHED_GAMES_SQL = `((SELECT COUNT(*) FROM results WHERE user_id = ? AND (abandoned IS NULL OR abandoned = 0)
    AND (online = 1 OR (play_ms >= ${WELCOME_GIFT.soloMinSeconds * 1000} AND moves >= ${XP.minMoves})))
  + COALESCE((SELECT games FROM ranked_1v1 WHERE user_id = ?), 0))`;

/** An account's finished games (as FINISHED_GAMES_SQL counts them). */
export async function finishedGames(sql: Sql, userId: string): Promise<number> {
  return (await sql.first<{ n: number }>(`SELECT ${FINISHED_GAMES_SQL} AS n`, userId, userId))?.n ?? 0;
}

/** A signed-in account (an email or a Google account: never a guest), in SQL (`?`: its id). */
const SIGNED_IN = "EXISTS (SELECT 1 FROM users WHERE id = ? AND (email IS NOT NULL OR google_sub IS NOT NULL))";

/**
 * Grants every Welcome Crate this account has earned and hasn't got (WELCOME_GIFT.milestones: at 5 finished games, then 25): each is
 * a ledger op (`welcome:<ledger id>:<n>`) that applies only while the account is signed in, its finished games (counted in the same
 * transaction) reach the milestone and it has no row for it; the row is keyed by (account, milestone) too. So a second grant of one
 * does nothing: retries, races, two tabs and two Workers grant each once. Only a signed-in account (bots have no account). Answers the
 * milestones this call granted (none: not earned yet, or granted before). Called where an account's games are counted (a result saved,
 * a ranked game recorded) and on every sign-in and profile load (`/api/me`), which is the backfill: an account that had finished 5 or 25
 * games before gets them the next time it opens the app or finishes a game.
 */
export async function grantWelcomeCrate(sql: Sql, userId: string, now: number): Promise<number[]> {
  const had = new Set((await sql.all<{ milestone: number }>("SELECT milestone FROM welcome_crates WHERE user_id = ?", userId)).map((r) => r.milestone));
  const due = WELCOME_GIFT.milestones.filter((m) => !had.has(m));
  if (!due.length) return [];
  const games = await sql.first<{ n: number }>(`SELECT ${FINISHED_GAMES_SQL} AS n WHERE ${SIGNED_IN}`, userId, userId, userId);
  const earned = due.filter((m) => games && games.n >= m);
  const me = earned.length ? await ledgerAccount(sql, userId) : null;
  const granted: number[] = [];
  for (const m of me ? earned : []) {
    const done = await applyOp(sql, me!, {
      id: `welcome:${me!.account}:${m}`,
      reason: "welcome",
      now,
      when: cond(
        `${SIGNED_IN} AND ${FINISHED_GAMES_SQL} >= ? AND NOT EXISTS (SELECT 1 FROM welcome_crates WHERE user_id = ? AND milestone = ?)`,
        userId,
        userId,
        userId,
        m,
        userId,
        m,
      ),
      legs: [leg.welcomeIn(userId, m, now, cond(FINISHED_GAMES_SQL, userId, userId))],
    });
    if (done === "applied") granted.push(m);
  }
  return granted.sort((a, b) => a - b);
}

/** What the app hears about the Welcome Crates (the locker's `welcome`). */
export interface WelcomeState {
  /** Finished games so far (for "Finish 25 games for your second Welcome Crate: 7/25"). */
  games: number;
  /** The next milestone not earned yet (5, then 25), or null once both are. */
  next: number | null;
  /** How many are earned and not opened yet. */
  unopened: number;
  /** One is waiting to be opened ("ready"), all earned are opened ("opened"), or none is earned yet ("locked"). */
  status: "locked" | "ready" | "opened";
  /** A "You earned a Welcome Crate!" notice is due (one earned whose notice isn't closed yet). */
  notice: boolean;
  /** The ride the latest opened crate gave (an `items` id). */
  item?: string;
}

/** An account's Welcome Crates, read only (an account with no rows: none earned yet, as every account before Nov 6). */
export async function welcomeState(sql: Sql, userId: string): Promise<WelcomeState> {
  const [rows, games] = await Promise.all([
    sql
      .all<{ milestone: number; seen_at: number | null; opened_at: number | null; item_id: string | null }>(
        "SELECT milestone, seen_at, opened_at, item_id FROM welcome_crates WHERE user_id = ? ORDER BY milestone",
        userId,
      )
      .catch(() => []),
    finishedGames(sql, userId).catch(() => 0),
  ]);
  const unopened = rows.filter((r) => r.opened_at === null).length;
  const latest = rows.filter((r) => r.opened_at !== null && r.item_id).sort((a, b) => b.opened_at! - a.opened_at! || b.milestone - a.milestone)[0];
  return {
    games,
    next: nextWelcomeMilestone(rows.map((r) => r.milestone)),
    unopened,
    status: unopened ? "ready" : rows.length ? "opened" : "locked",
    notice: rows.some((r) => r.seen_at === null),
    ...(latest?.item_id ? { item: latest.item_id } : {}),
  };
}

/** Closes the "You earned a Welcome Crate!" notice for good (once for each crate: every earned one's is closed). */
export async function seenWelcomeNotice(sql: Sql, userId: string, now: number): Promise<void> {
  await sql.run("UPDATE welcome_crates SET seen_at = ? WHERE user_id = ? AND seen_at IS NULL", now, userId);
}

const randomHex = (bytes: number) => [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Why the Welcome Crate couldn't be opened. */
export const NO_WELCOME_CRATE = "You have no Welcome Crate to open.";

/**
 * Opens your next Welcome Crate (the earliest earned and unopened): one ride from every ride's HunChess colorway, each as likely, never
 * one an earlier Welcome Crate gave while another is left (rollWelcome), with the server's own randomness (never a test switch), into
 * your locker. One ledger op per crate (`welcome-open:<ledger id>:<n>`), one transaction: it applies only while that crate is unopened
 * and (while another is left) no Welcome Crate of yours gave that ride; then the ride goes in and the crate is marked opened with it.
 * Two opens at once with two crates waiting open both, with different rides (the second finds the first crate's op taken, and opens
 * the next, rolling with the first's ride counted); with one waiting, one ride. An open with none waiting gives nothing new: it answers
 * the ride the latest gave (`again`). An account that hasn't earned one is refused.
 */
export async function openWelcomeCrate(
  sql: Sql,
  userId: string,
  now: number,
  rng: () => number = mulberry32(crypto.getRandomValues(new Uint32Array(1))[0]!),
): Promise<{ ok: true; roll: CrateRoll; item: ItemInstance; again: boolean } | { ok: false; message: string }> {
  let me: LedgerAccount | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const rows = await sql.all<{ milestone: number; opened_at: number | null; def: string | null }>(
      "SELECT milestone, opened_at, def FROM welcome_crates WHERE user_id = ? ORDER BY milestone",
      userId,
    );
    const next = rows.find((r) => r.opened_at === null);
    me ??= next ? await ledgerAccount(sql, userId) : null;
    if (!next || !me) break;
    const won = rows.flatMap((r) => (r.def ? [r.def] : []));
    const roll = rollWelcome(rng, won);
    const fresh = won.length < WELCOME_CRATE.items.length ? 1 : 0;
    const item: ItemInstance = { id: randomHex(9), def: roll.def, color: roll.color, ...(roll.color2 ? { color2: roll.color2 } : {}), blemish: roll.blemish, seed: roll.seed };
    const done = await applyOp(sql, me, {
      id: `welcome-open:${me.account}:${next.milestone}`,
      reason: "welcome open",
      now,
      when: cond(
        "EXISTS (SELECT 1 FROM welcome_crates WHERE user_id = ? AND milestone = ? AND opened_at IS NULL) AND (? = 0 OR NOT EXISTS (SELECT 1 FROM welcome_crates WHERE user_id = ? AND def = ?))",
        userId,
        next.milestone,
        fresh,
        userId,
        roll.def,
      ),
      legs: [leg.welcomeOut(userId, next.milestone, item, now), leg.item(userId, { ...roll, id: item.id, fischer: true }, WELCOME_CRATE_ID, now)],
    });
    if (done === "applied") return { ok: true, roll, item, again: false };
    // Not applied: another open took this crate first (then the next, if one waits), or took this ride (then roll again).
  }
  const row = await sql.first<{ item_id: string | null }>(
    "SELECT item_id FROM welcome_crates WHERE user_id = ? AND opened_at IS NOT NULL ORDER BY opened_at DESC, milestone DESC LIMIT 1",
    userId,
  );
  if (!row?.item_id) return { ok: false, message: NO_WELCOME_CRATE };
  const it = await sql.first<ItemInstance & { color2: string | null }>("SELECT id, def, color, color2, blemish, seed FROM items WHERE id = ? AND user_id = ?", row.item_id, userId);
  // (Opened, and its ride since deleted from the locker: nothing to show again.)
  if (!it) return { ok: false, message: NO_WELCOME_CRATE };
  const item: ItemInstance = { id: it.id, def: it.def, color: it.color, ...(it.color2 ? { color2: it.color2 } : {}), blemish: it.blemish, seed: it.seed };
  return { ok: true, roll: { fischer: true, def: item.def, color: item.color, ...(item.color2 ? { color2: item.color2 } : {}), blemish: item.blemish, seed: item.seed }, item, again: true };
}

// (A guest signing in to an account: a guest never earns a Welcome Crate (the grant needs a signed-in account), so it has none to
// bring; any row under its id is dropped with its ledger leg, never moved: ledger.ts, mergeMoves.)
