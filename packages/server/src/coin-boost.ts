import { COIN_BOOST, LEVEL_CRATE_BONUS, boostFor, questDrop, type PlayCoins } from "@chessroyale/core";
import type { Sql } from "./accounts.ts";
import { applyOp, cond, keyFor, leg, ledgerAccount, opKeys, type Leg, type LedgerAccount } from "./ledger.ts";
import { coinOpIds } from "./play-coins.ts";

/**
 * The coin boost and the Crate Bonus on the server (Eric, Nov 18; the payments design's section 7; COIN_BOOST and LEVEL_CRATE_BONUS in
 * settings.ts, core's coin-boost.ts; docs/decisions/2026-11-26-coin-boost.md). Never sold. Every change goes through the ledger, each
 * keyed so it happens once, and the counts are the wallet's (`boost_crates`, `boost_minutes`, `crate_bonus`; asset kinds
 * `boost_crate`, `boost_min`, `crate_bonus`):
 *
 *   - **The drop** (quests.ts questStatements): a daily quest's completion op (`quest:<kind>:<quest id>:<ledger id>`) carries its drop's
 *     leg, rolled from that key (core's questDrop): +1 Coin Boost Crate, or +LEVEL_CRATE_BONUS.levels Crate Bonus level-ups. The op pays
 *     once, so the drop does; a replay builds the same op and the same roll.
 *   - **Opening a Coin Boost Crate** (POST /api/locker/boost {request}: `boost-open:<ledger id>:<request>`): one crate off, COIN_BOOST.minutes
 *     of boost on, guarded by a crate being there. A retry opens it once.
 *   - **A boosted game** (`boost:<game>:<ledger id>`, reason "coin-boost", from xp.ts grantXp once the game's coins are settled): the
 *     extra coins (core's boostFor, from the coins as the ledger has them: the base, which alone the day's caps count) and the boost
 *     minutes it used, guarded by those minutes being there and the game's coin ops being there at the amounts it was worked out from.
 *     One a game: a retry, a second tab or a room's restart finds it and pays nothing more. Refused (another game used the minutes
 *     meanwhile): worked out again from the wallet as it stands, up to TRIES times.
 *   - **The Crate Bonus** (rewards.ts payLevels): a paying level's `lvlbonus:<level>:<ledger id>`, its crates again and one level-up off.
 */

/** The ledger reason of a boosted game's extra coins (never "play" or "play-bonus": the day's caps don't count them). */
export const BOOST = "coin-boost";
/** A game's boost op key. */
export const boostOpId = (key: string, account: string) => `boost:${key}:${account}`;
/** The tries at a game's boost (the first, and the retries after a refusal). */
const TRIES = 3;

/**
 * A daily quest's drop, as legs of its completion op (`opId`, whose key seeds the roll): a Coin Boost Crate, the Crate Bonus's level-ups,
 * or none. `source`: the game that finished the quest (its result answers the drop: quests.ts questsPaidBy).
 */
export function questDropLegs(user: string, opId: string, source: string): Leg[] {
  const d = questDrop(opId);
  if (d === "boost") return [leg.boostCrates(user, 1, source)];
  if (d === "bonus" && LEVEL_CRATE_BONUS.levels > 0) return [leg.crateBonus(user, LEVEL_CRATE_BONUS.levels, source)];
  return [];
}

/** What a game's boost depends on: the game's key (its coin ops' own), the time, its counted minutes (XP's; solo, the minutes XP paid). */
export interface BoostPlan {
  key: string;
  now: number;
  minutes: number;
}

/**
 * A game's boost, after its coins are settled (`coins`: as the ledger has them, play-coins.ts settleCoins): its op applied if the boost
 * has minutes and the game paid play coins (core's boostFor), or found if an earlier attempt applied it. Answers the coins with the
 * boost's part (`boost`: the extra, the minutes used, the minutes left), or as they were when there's none. A D1 failure throws (the
 * callers try the whole grant again; it pays once).
 */
export async function settleBoost(sql: Sql, me: LedgerAccount, p: BoostPlan, coins: PlayCoins): Promise<PlayCoins> {
  const id = boostOpId(p.key, me.account);
  const ops = coinOpIds(p.key, me.account);
  for (let i = 0; ; i++) {
    const row = await sql.first<{ there: number; coins: number | null; used: number | null; left: number }>(
      `SELECT EXISTS (SELECT 1 FROM ledger WHERE op_id = ?1 AND leg = 0) AS there,
         (SELECT delta FROM ledger WHERE op_id = ?1 AND asset_kind = 'coins') AS coins,
         (SELECT -delta FROM ledger WHERE op_id = ?1 AND asset_kind = 'boost_min') AS used,
         COALESCE((SELECT boost_minutes FROM wallets WHERE user_id = ?2), 0) AS left`,
      id,
      me.user,
    );
    if (row?.there) return row.coins ? { ...coins, boost: { coins: row.coins, minutes: row.used ?? 0, left: row.left } } : coins;
    const use = boostFor(coins, p.minutes, row?.left ?? 0);
    if (!use.minutes) return coins;
    if (i >= TRIES) {
      // (Refused each time: other games of the account kept using the minutes between the read and the write. This one goes unboosted.)
      console.log(`boost for ${p.key}: refused ${TRIES} times`);
      return coins;
    }
    await applyOp(sql, me, {
      id,
      reason: BOOST,
      now: p.now,
      when: cond(
        `EXISTS (SELECT 1 FROM wallets WHERE user_id = ? AND boost_minutes >= ?) AND EXISTS (SELECT 1 FROM ledger WHERE op_id = ? AND leg = 0 AND delta = ?)${coins.bonus > 0 ? " AND EXISTS (SELECT 1 FROM ledger WHERE op_id = ? AND leg = 0 AND delta = ?)" : ""}`,
        me.user,
        use.minutes,
        ops.play,
        coins.play,
        ...(coins.bonus > 0 ? [ops.bonus, coins.bonus] : []),
      ),
      legs: [leg.coins(me.user, use.coins, p.key), leg.boostMinutes(me.user, -use.minutes, p.key)],
    });
  }
}

const newId = (bytes = 9) => [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");

/** The refusal of an open with no Coin Boost Crate to open. */
export const NO_BOOST_CRATE = "You have no Coin Boost Crate to open.";

/**
 * Opens a Coin Boost Crate (POST /api/locker/boost {request}; free, no key: its contents are fixed): one crate off and COIN_BOOST.minutes
 * of boost on, in one op (`boost-open:<ledger id>:<request>`: a retry or a double tap opens it once), refused without a crate. A boost
 * running already gets the minutes added; the multiplier is one number, so it never stacks.
 */
export async function openBoostCrate(sql: Sql, userId: string, request: string | null, now: number): Promise<{ ok: true } | { ok: false; message: string }> {
  const me = await ledgerAccount(sql, userId);
  if (!me) return { ok: false, message: NO_BOOST_CRATE };
  const id = request ? keyFor(opKeys.request("boost-open", request), me) : `boost-open:${me.account}:${newId()}`;
  const done = await applyOp(sql, me, {
    id,
    reason: "boost open",
    now,
    when: cond("EXISTS (SELECT 1 FROM wallets WHERE user_id = ? AND boost_crates >= 1)", userId),
    legs: [leg.boostCrates(userId, -1), leg.boostMinutes(userId, COIN_BOOST.minutes)],
  });
  return done === "refused" ? { ok: false, message: NO_BOOST_CRATE } : { ok: true };
}
