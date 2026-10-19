import { ownEngine } from "../engine.ts";
import { AUTOCHESS, type AutoChessSettings } from "@chessroyale/core";
import { fightStart } from "./position.ts";
import type { Army, Color } from "./types.ts";

/**
 * The browser's Stockfish for the demo: the fight's moves (a fixed small search, the same for both sides) and the bot's
 * adjust step (a smaller one). One engine of its own (`ownEngine`), never queued behind a lobby's work.
 */

/** In a row, how many times the engine failed to answer in time; at `GIVE_UP` the rest of the visit plays stand-in moves. */
let failures = 0;
const GIVE_UP = 3;
const broken = () => failures >= GIVE_UP;

/** Starts loading the engine (the screen does this as it opens, so the first fight doesn't wait for it). */
export function warmEngine(): void {
  void ownEngine().catch(() => {
    failures = GIVE_UP;
  });
}

/** The engine's move for a position, or null if it gives none in time (the fight plays a stand-in then). */
export async function enginePick(fen: string, cfg: AutoChessSettings = AUTOCHESS, timeoutMs = 4000): Promise<string | null> {
  if (broken()) return null;
  try {
    // (The first look waits for the engine to load; a slow phone gets a good while, and a stalled one is given up on.)
    const engine = await Promise.race([ownEngine(), new Promise<never>((_, no) => setTimeout(() => no(new Error("engine timeout")), timeoutMs * 2))]);
    const top = await Promise.race([engine.topMovesAt(fen, 1, cfg.fightNodes), new Promise<null>((r) => setTimeout(() => r(null), timeoutMs))]);
    if (top === null) {
      failures++;
      return null;
    }
    failures = 0;
    return top[0]?.move ?? null;
  } catch {
    failures++;
    return null;
  }
}

/**
 * How good a position is for `botColor`, 0 to 1, from a small search of the position the fight would start from
 * (its side to move's expected score, turned to the bot's side). `you`: your army as it stood when the buying locked.
 */
export function botEvaluator(you: Army, botColor: Color, cfg: AutoChessSettings = AUTOCHESS): (botArmy: Army) => Promise<number> {
  return async (botArmy) => {
    if (broken()) return 0.5;
    const white = botColor === "w" ? botArmy : you;
    const black = botColor === "w" ? you : botArmy;
    const start = fightStart(white, black);
    if (start.draw) return 0.5;
    try {
      const engine = await ownEngine();
      const top = await engine.topMovesAt(start.fen, 1, cfg.bot.adjustNodes);
      const e = top[0]?.expected;
      if (e === undefined) return 0.5;
      return start.mover === botColor ? e : 1 - e;
    } catch {
      return 0.5;
    }
  };
}


