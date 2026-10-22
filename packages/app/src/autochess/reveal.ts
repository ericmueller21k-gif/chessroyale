import { AUTOCHESS, mulberry32, type AutoChessSettings } from "@chessroyale/core";
import { botAt, type BotEvent } from "./bot.ts";
import type { Kind, StarCount } from "./types.ts";

/**
 * What you see of the opponent's board while you buy (v6, Eric Oct 20): every piece as a plain circle (pawns too), 2 s behind;
 * and every `revealSeconds` of the buy step one of their pieces is revealed at random, and stays shown as the piece it is while
 * it is on the board (5, 10, 15, 20 and 25 s of the 30: five reveals). Everything is a pure function of the bot's plan, the
 * round's seed and the time, so a test can say what shows when.
 */

/** The times (seconds into the buy step) at which a piece is revealed: every `revealSeconds`, while the step is on. */
export function revealTimes(cfg: AutoChessSettings = AUTOCHESS): number[] {
  const out: number[] = [];
  for (let k = 1; k * cfg.revealSeconds < cfg.buySeconds; k++) out.push(k * cfg.revealSeconds);
  return out;
}

export interface Revealed {
  square: string;
  kind: Kind;
  /** When it was revealed (seconds into the step). */
  at: number;
  /** Its stars as they are now (v8): a revealed piece shows them, and a star it gains after it was revealed shows too; none for a plain piece. */
  stars?: StarCount;
}

/**
 * The pieces revealed by `seconds` into the step, in the order they were: at each reveal time one of the pieces on their board
 * then that isn't revealed yet, picked at random by the seed. (The pieces on their board, not only the circles you can see by
 * then, which are 2 s behind: a reveal is never wasted on a bot that places late; a piece whose circle hasn't shown yet simply
 * appears as the piece.) With nothing on their board, nothing is revealed that time. A revealed piece stays while it is on the
 * board: it is dropped here only if the bot's board no longer has it (the bot sells nothing, so this is for a rule that changes).
 */
export function revealedAt(events: readonly BotEvent[], seed: number, seconds: number, cfg: AutoChessSettings = AUTOCHESS): Revealed[] {
  const out: Revealed[] = [];
  revealTimes(cfg).forEach((at, k) => {
    if (at > seconds) return;
    const circles = botAt(events, at).squares;
    const open = Object.keys(circles)
      .filter((sq) => !out.some((r) => r.square === sq))
      .sort();
    if (!open.length) return;
    const square = open[Math.floor(mulberry32((seed ^ Math.imul(k + 1, 0x9e3779b1)) >>> 0)() * open.length)]!;
    out.push({ square, kind: circles[square]!, at });
  });
  const now = botAt(events, seconds);
  return out.filter((r) => now.squares[r.square] === r.kind).map((r) => (now.stars[r.square] ? { ...r, stars: now.stars[r.square]! } : r));
}

/** What shows of their board `seconds` into the buy step: circles (all but the revealed), the revealed pieces, and what they have spent and the XP they have bought (2 s behind). */
export function botSeen(
  events: readonly BotEvent[],
  seed: number,
  seconds: number,
  cfg: AutoChessSettings = AUTOCHESS,
): { circles: string[]; revealed: Revealed[]; spent: number; xpBuys: number } {
  const behind = botAt(events, Math.max(0, seconds - cfg.circlesDelaySeconds));
  const revealed = revealedAt(events, seed, seconds, cfg);
  const shown = new Set(revealed.map((r) => r.square));
  return { circles: Object.keys(behind.squares).filter((sq) => !shown.has(sq)), revealed, spent: behind.spent, xpBuys: behind.xpBuys };
}
