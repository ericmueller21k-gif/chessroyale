import { mulberry32 } from "./rng.ts";
import { questSeed } from "./quests.ts";
import { COIN_BOOST, LEVEL_CRATE_BONUS } from "./settings.ts";
import type { PlayCoins } from "./play-coins.ts";

/**
 * The coin boost and the Crate Bonus (Eric, Nov 18; the payments design's section 7, docs/decisions/2026-11-17-payments-design.md;
 * COIN_BOOST and LEVEL_CRATE_BONUS in settings.ts; docs/decisions/2026-11-26-coin-boost.md): the rules, pure. The server rolls the drop
 * in a daily quest's completion op (server quests.ts), pays the boost beside a game's coins (server coin-boost.ts, from xp.ts grantXp)
 * and doubles a level's crates (server rewards.ts payLevels); the app shows what they answer.
 */

/** What a finished daily quest dropped: a Coin Boost Crate, a Crate Bonus, or nothing. */
export type QuestDrop = "boost" | "bonus" | null;

/** The player-facing names. */
export const BOOST_CRATE_NAME = "Coin Boost Crate";
export const CRATE_BONUS_NAME = "Crate Bonus";

/**
 * A finished daily quest's roll (one draw), from its completion op's key (`quest:<kind>:<quest id>:<ledger id>`): the same key always
 * rolls the same, so a retry of the game's grant builds the same op, and anyone holding the ledger can check a drop from its op's key
 * alone. The key holds the account's ledger id, which no player ever sees, so nobody can tell from a quest's id what it will drop (and
 * reroll the ones that won't). Below `boost` a Coin Boost Crate; below `boost + bonus` a Crate Bonus; else nothing.
 */
export function questDrop(opId: string, boost: number = COIN_BOOST.dropChance, bonus: number = LEVEL_CRATE_BONUS.dropChance): QuestDrop {
  const u = mulberry32(questSeed(`drop:${opId}`))();
  if (u < boost) return "boost";
  if (u < boost + bonus) return "bonus";
  return null;
}

/** What a boost added to one game (PlayCoins.boost): the extra coins, the boost minutes it used, the minutes left after it. */
export interface BoostPaid {
  coins: number;
  minutes: number;
  left: number;
}

/**
 * What a boost adds to a game: `base` the game's coins as paid (play coins and bonus, both counted at base toward the day's caps),
 * `minutes` its counted minutes (XP's; at least 1 a game), `left` the boost minutes there are. Nothing without boost minutes, or for a
 * game that paid no play coins (past the day's PLAY_COINS.perDay: the boost waits for tomorrow). Else the game uses `min(left,
 * minutes)` of them, and its coins get (multiplier - 1) times that share of them, rounded (half up). Nothing used for no extra coin.
 */
export function boostFor(base: { play: number; bonus: number }, minutes: number, left: number, s = COIN_BOOST): { coins: number; minutes: number } {
  const have = Math.max(0, Math.floor(left));
  if (!have || !(base.play > 0)) return { coins: 0, minutes: 0 };
  const m = Math.max(1, Math.floor(minutes));
  const used = Math.min(have, m);
  const coins = Math.round((base.play + Math.max(0, base.bonus)) * Math.max(0, s.multiplier - 1) * (used / m));
  return coins > 0 ? { coins, minutes: used } : { coins: 0, minutes: 0 };
}

/** A game's coins in all, as paid: play coins, bonus and the boost's extra. */
export const coinsPaid = (c: PlayCoins | null | undefined): number => (c ? c.play + c.bonus + (c.boost?.coins ?? 0) : 0);

/** "x2.5" (the strip's badge says "x2.5 BOOST"). */
export const boostTimes = (s = COIN_BOOST): string => `x${s.multiplier}`;

/** The Crates tab's boost line: "Coin boost: x2.5 coins · 95 min of play left", or "Coin boost: off". */
export function boostLine(minutes: number, s = COIN_BOOST): string {
  return minutes > 0 ? `Coin boost: ${boostTimes(s)} coins · ${minutes} min of play left` : "Coin boost: off";
}

/** The Crates tab's Crate Bonus line: "Crate bonus: 4 level-ups left" (1: "1 level-up left"), or "Crate bonus: none". */
export function crateBonusLine(levels: number): string {
  return levels > 0 ? `Crate bonus: ${levels} level-up${levels === 1 ? "" : "s"} left` : "Crate bonus: none";
}

/** What a Coin Boost Crate gives, in plain words (its row, its dialog, the reward card). */
export const boostCrateBlurb = (s = COIN_BOOST): string => `${s.multiplier}x coins for ${s.minutes} minutes of play. Free to open, when you choose.`;

/** What a Crate Bonus gives, in plain words. */
export const crateBonusBlurb = (s = LEVEL_CRATE_BONUS): string => `Your next ${s.levels} level-ups that give crates give double crates.`;
