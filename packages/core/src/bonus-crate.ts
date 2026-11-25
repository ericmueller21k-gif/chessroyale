import { adminFirst } from "./boss.ts";
import { BOSS_CRATES, CRATES, bossCrateDef, crateDef, type CrateDef } from "./crates.ts";
import type { Rng } from "./rng.ts";
import { CRATE_BONUS } from "./settings.ts";

/**
 * The bonus crate (Eric, Nov 24; CRATE_BONUS in settings.ts; docs/decisions/2026-11-24-bonus-crate.md). Every crate opening also has
 * CRATE_BONUS.chance of a bonus: one more crate, unopened, into your inventory, and a crate key with it when that crate opens with one.
 * Rolled by the server only (locker.ts openCrate, boss-tokens.ts openBossCrate), with the item's own roll, in the same ledger op.
 *
 *   - **The pool:** every crate there is, retired ones too, each as likely: every series crate (CRATES) and every boss's crate
 *     (BOSS_CRATES). Built from those lists, so a new crate joins it with no change here. Not the Welcome Crate (one per account, its
 *     own rules: it's in neither list), and not the crate of a boss still in the game for admins first (BOSS_ADMIN_FIRST: it would show
 *     unreleased content), except to an admin. The crate just opened may come up.
 *   - **The key:** a series crate opens with a crate key, so it comes with one; a boss crate opens without.
 *   - **A bonus crate never rolls a bonus** (Eric: "flag if a crate came from another crate so ... you can't just keep crating into
 *     other crates"): the server stores it as a bonus one and its opening skips the roll.
 */

/** Every crate a bonus can be, each as likely (admins: also the crates of bosses in the game for admins first). */
export function bonusPool(admin = false): CrateDef[] {
  return [...CRATES, ...BOSS_CRATES.filter((c) => admin || !adminFirst({ id: c.boss }))];
}

/** Whether a crate opens with a crate key (a series crate does; a boss crate doesn't), so its bonus comes with one. */
export const opensWithKey = (crate: string): boolean => !!crateDef(crate) && !bossCrateDef(crate);

/** A bonus: which crate (its id: "winter-1", "boss-tiger") and whether a crate key comes with it. */
export interface BonusRoll {
  crate: string;
  key: boolean;
}

/**
 * Rolls an opening's bonus with the opening's own randomness (`rng`: the server's, already used for the item): CRATE_BONUS.chance of
 * a crate from the pool, each as likely, and its key if it opens with one; null, none. `force` (a test switch: the server passes it only
 * where TEST_SWITCHES is "1"): `true`, a bonus for sure, its crate rolled; a crate's id from the pool, that one (any other id: as `true`).
 */
export function rollBonus(rng: Rng, opts: { admin?: boolean; force?: true | string } = {}): BonusRoll | null {
  const pool = bonusPool(opts.admin);
  // (No crate to give, e.g. a list emptied in a test: no bonus, never a throw that would fail the opening.)
  if (!pool.length) return null;
  const hit = rng() < CRATE_BONUS.chance;
  const forced = typeof opts.force === "string" ? pool.find((c) => c.id === opts.force) : undefined;
  if (!hit && !opts.force) return null;
  const crate = forced ?? pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))]!;
  return { crate: crate.id, key: opensWithKey(crate.id) };
}

/** A share as a percentage, to one decimal place at most ("25%", "8.3%"). */
const pct = (x: number): string => `${Math.round(x * 1000) / 10}%`;

/**
 * The bonus in plain, exact words, as every crate's odds panel and the FAQ show it (an odds disclosure must be exact; the review, Nov 25):
 * which openings roll it (a series or boss crate's: not the Welcome Crate's, not a bonus crate's), the chance, how many crates it's one
 * of and each one's share (`crates`: a player's pool, `bonusPool()`), the key, and what the pool leaves out. Today: "Opening a series or
 * boss crate: 25% chance of a bonus crate, one of N crates chosen evenly (about X% each, so about Y% of openings for each), with its key
 * if it needs one. The Welcome Crate and crates of bosses not yet released aren't in it. Opening a bonus crate never gives another."
 */
export function bonusOddsLine(chance: number = CRATE_BONUS.chance, crates: number = bonusPool().length): string {
  if (crates <= 0 || chance <= 0) return "Opening a crate gives no bonus crate for now.";
  const each = crates === 1 ? "that one crate" : `one of ${crates} crates chosen evenly (about ${pct(1 / crates)} each, so about ${pct(chance / crates)} of openings for each)`;
  return `Opening a series or boss crate: ${pct(chance)} chance of a bonus crate, ${each}, with its key if it needs one. The Welcome Crate and crates of bosses not yet released aren't in it. Opening a bonus crate never gives another.`;
}
