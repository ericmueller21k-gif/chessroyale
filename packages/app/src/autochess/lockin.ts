import { AUTOCHESS, type AutoChessSettings } from "@chessroyale/core";

/**
 * Lock in (v5): a side that locks in ends its buying, so its board, bench and shop freeze for the rest of the step, and the
 * first side to do it gets `lockInBonus` gold at once. When both have locked the step ends at once. The player locks by
 * pressing the button (`you`: the time, in ms since the step began); the bot locks at the time its plan gave it (`botLockAt`,
 * seconds since the step began, null if it never does), so everything here is a pure function of those two times.
 */

export type Side = "you" | "bot";

export interface Locks {
  /** When you locked in (ms into the step), or null. */
  you: number | null;
  /** Who got the first-lock bonus, or null while nobody has locked. */
  bonus: Side | null;
}

export const noLocks: Locks = { you: null, bonus: null };

/** Whether the bot has locked in by `elapsedMs` into the step. */
export const botLocked = (botLockAt: number | null, elapsedMs: number) => botLockAt !== null && elapsedMs >= botLockAt * 1000;

/** You lock in at `elapsedMs`: the first to lock gets the bonus (the bot, if its time has come by now). Locking twice changes nothing. */
export function youLock(locks: Locks, elapsedMs: number, botLockAt: number | null): Locks {
  if (locks.you !== null) return locks;
  return { you: elapsedMs, bonus: locks.bonus ?? (botLocked(botLockAt, elapsedMs) ? "bot" : "you") };
}

/** The clock moves on: when the bot's time comes and nobody was first, it is (and gets the bonus). */
export function tickLocks(locks: Locks, elapsedMs: number, botLockAt: number | null): Locks {
  return locks.bonus === null && botLocked(botLockAt, elapsedMs) ? { ...locks, bonus: "bot" } : locks;
}

/** Both sides have locked in: the buying step ends at once. */
export const bothLocked = (locks: Locks, elapsedMs: number, botLockAt: number | null) => locks.you !== null && botLocked(botLockAt, elapsedMs);

export type Freeze = "locked_in" | "time";

/** Why buying, selling, moving and rerolling are refused now, or null: you locked in, or it is the step's last seconds. */
export function buyFreeze(locks: Locks, elapsedMs: number, cfg: AutoChessSettings = AUTOCHESS): Freeze | null {
  if (locks.you !== null) return "locked_in";
  return elapsedMs >= (cfg.buySeconds - cfg.lockSeconds) * 1000 ? "time" : null;
}

export const freezeWords = (freeze: Freeze) => (freeze === "locked_in" ? "You're locked in: your board, bench and shop are frozen." : "Locked: no buying, selling or moving.");

/** The gold a side got for locking first. */
export const bonusFor = (locks: Locks, side: Side, cfg: AutoChessSettings = AUTOCHESS) => (locks.bonus === side ? cfg.lockInBonus : 0);
