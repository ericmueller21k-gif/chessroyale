import { FISCHER, HUNCHESS_RIDES, isHunchess, itemDef, type CrateDef, type CrateRoll } from "./crates.ts";
import type { Rng } from "./rng.ts";
import { WELCOME_GIFT } from "./settings.ts";

/**
 * The HunChess Welcome Crate (Eric, Nov 6; docs/decisions/2026-11-06-welcome-crate.md): "you get it for completing 5 games in any
 * mode or any boss. It contains a special HunChess-colored random rider, with a HunChess-theme gold and black crate. Never
 * tradeable. Purity isn't listed for these. Limit one per account."
 *
 *   - Earned once per account, ever, by the server (server/welcome.ts: a stored row keyed by the account, checked and set in one
 *     statement), at WELCOME_GIFT.games finished games. Never in CRATES (the Crates tab can't open one free) nor BOSS_CRATES.
 *   - Its prize: one of every ride's HunChess colorway (HUNCHESS_RIDES in crates.ts), each as likely, rolled by the server.
 *   - Never tradeable, never listable (`tradeable`, every path that would move an item between accounts asks it), and no purity
 *     is shown for the crate or its rides.
 */

/** Its id (the opening's `{crate}`, and `items.crate` on its prize). */
export const WELCOME_CRATE_ID = "welcome-hunchess";

/** Player-visible text (Eric's words where he gave them). */
export const WELCOME_TEXT = {
  name: "HunChess Welcome Crate",
  thanks: "Thank you for being an early tester!",
  notTradeable: "Not tradeable",
  earned: "You earned a Welcome Crate!",
  /** The progress hint: "Finish 5 games to earn your Welcome Crate: 3/5". */
  progress: (games: number) => `Finish ${WELCOME_GIFT.games} games to earn your Welcome Crate: ${Math.min(games, WELCOME_GIFT.games)}/${WELCOME_GIFT.games}`,
} as const;

/**
 * The crate, as a crate (so the Crates tab's page and opening draw it): every ride's HunChess colorway behind Fischer Random, the
 * only thing on its strip, each ride as likely. Rolled with `rollWelcome`, never `rollCrate`'s colors and purity.
 */
export const WELCOME_CRATE: CrateDef = {
  id: WELCOME_CRATE_ID,
  name: WELCOME_TEXT.name,
  blurb: WELCOME_TEXT.thanks,
  look: "hunchess",
  strip: [{ tier: FISCHER, weight: 100 }],
  items: HUNCHESS_RIDES.map((d) => d.id),
  fischer: [{ tier: "mythic", weight: 100 }],
};

/**
 * The finish every HunChess ride is stored with: the colorway is the drawing's (gold and black), so its color is fixed (yellow paints
 * its colored parts gold; a two-color ride's second part midnight, black), and its blemish 0 (no purity is shown; nothing blotched).
 */
export const HUNCHESS_FINISH = { color: "yellow", color2: "midnight", blemish: 0 } as const;

/**
 * Opens the Welcome Crate: one ride from every ride's HunChess colorway, each as likely (two draws of `rng`: the ride, its seed).
 * The server's randomness only (server/welcome.ts).
 */
export function rollWelcome(rng: Rng): CrateRoll {
  const list = WELCOME_CRATE.items;
  const def = list[Math.min(list.length - 1, Math.floor(rng() * list.length))]!;
  const seed = Math.floor(rng() * 2 ** 31);
  return {
    fischer: true,
    def,
    color: HUNCHESS_FINISH.color,
    ...(itemDef(def)?.colors === 2 ? { color2: HUNCHESS_FINISH.color2 } : {}),
    blemish: HUNCHESS_FINISH.blemish,
    seed,
  };
}

/** Whether a crate id is the Welcome Crate's. */
export const isWelcomeCrate = (id: unknown) => id === WELCOME_CRATE_ID;

/**
 * Whether an item (by its def) or a crate (by its id) may be traded, given or listed. The Welcome Crate and its HunChess rides never
 * may (Eric, Nov 6: "Never tradeable"). Every path that moves an item between accounts or lists one for others asks this on the
 * server first, and refuses with `NOT_TRADEABLE` (there is no trading or listing yet, Nov 6: whatever comes must).
 */
export const tradeable = (defOrCrate: string | null | undefined): boolean => !!defOrCrate && !isHunchess(defOrCrate) && !isWelcomeCrate(defOrCrate);

/** The refusal a trade or listing of one gets. */
export const NOT_TRADEABLE = "The Welcome Crate and its HunChess rides are not tradeable.";

/** Whether an item's purity is shown (never a HunChess ride's: Eric, "Purity isn't listed for these"). */
export const showsPurity = (def: string | null | undefined) => !isHunchess(def);
