import { AUTOCHESS, type AutoChessSettings } from "@chessroyale/core";
import type { FightSoFar } from "./fight.ts";
import { rulesFor } from "./fight.ts";
import type { HunReply, HunRequest } from "./hunchess-worker.ts";
import { fightStart } from "./position.ts";
import type { Army, Color } from "./types.ts";

/**
 * The HunChess engine for Auto chess (docs/decisions/2026-10-21-hunchess-engine.md), in a Web Worker of its own: the fight's moves
 * (a fixed node budget, the same for both sides) and the bot's adjust step (a smaller one). It knows every rule of a fight, so the
 * fight no longer filters an engine's choices. Stockfish isn't loaded on this screen.
 */

/** In a row, how many times the engine failed to answer in time; at `GIVE_UP` the rest of the visit plays stand-in moves. */
let failures = 0;
const GIVE_UP = 3;
const broken = () => failures >= GIVE_UP;

let worker: Worker | null = null;
let nextId = 0;
const waiting = new Map<number, (r: HunReply) => void>();

/** A test switch (`?stall=1`): the engine never answers, so the fight plays stand-in moves (the timeout path). */
let stalled = false;
export function stallEngine(on: boolean): void {
  stalled = on;
}

function engineWorker(): Worker | null {
  if (worker || broken()) return worker;
  try {
    worker = new Worker(new URL("./hunchess-worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<HunReply>) => {
      const resolve = waiting.get(e.data.id);
      waiting.delete(e.data.id);
      resolve?.(e.data);
    };
    worker.onerror = () => {
      failures = GIVE_UP;
    };
  } catch {
    failures = GIVE_UP;
  }
  return worker;
}

/** Starts the engine's worker (the screen does this as it opens). */
export function warmEngine(): void {
  engineWorker();
}

/** A fight starts: the engine forgets the last one (so a fight plays the same way every time). */
export function newFight(): void {
  engineWorker()?.postMessage({ type: "new", id: ++nextId } satisfies HunRequest);
}

/** Asks the engine for a move; null if it doesn't answer within `timeoutMs` (its late answer is ignored). */
function ask(game: FightSoFar, nodes: number, cfg: AutoChessSettings, timeoutMs: number): Promise<HunReply | null> {
  const w = engineWorker();
  if (!w || broken()) return Promise.resolve(null);
  // (Stalled: no answer comes, so the caller's timeout runs out, as with a stuck worker.)
  if (stalled) return new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs));
  const id = ++nextId;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      waiting.delete(id);
      resolve(null);
    }, timeoutMs);
    waiting.set(id, (r) => {
      clearTimeout(timer);
      resolve(r);
    });
    w.postMessage({ type: "move", id, startFen: game.startFen, moves: game.moves, rules: rulesFor(cfg), nodes, cashInValue: cfg.cashInValue } satisfies HunRequest);
  });
}

/**
 * The engine's move for the fight so far, one of the fight's `allowed` moves, or null if it gives none in time (the fight plays a
 * stand-in then; three misses in a row and the rest of the visit plays stand-ins).
 */
export async function enginePick(game: FightSoFar, allowed: readonly string[], cfg: AutoChessSettings = AUTOCHESS, timeoutMs = 4000): Promise<string | null> {
  const r = await ask(game, cfg.fightNodes, cfg, timeoutMs);
  if (!r || !r.move) {
    failures++;
    return null;
  }
  failures = 0;
  return allowed.includes(r.move) ? r.move : null;
}

/**
 * How good a position is for `botColor`, 0 to 1, from a small search of the position the fight would start from (its side to
 * move's expected score, turned to the bot's side). `you`: your army as it stood when the buying locked.
 */
export function botEvaluator(you: Army, botColor: Color, cfg: AutoChessSettings = AUTOCHESS): (botArmy: Army) => Promise<number> {
  return async (botArmy) => {
    const white = botColor === "w" ? botArmy : you;
    const black = botColor === "w" ? you : botArmy;
    const start = fightStart(white, black);
    if (start.draw) return 0.5;
    const r = await ask({ startFen: start.fen, moves: [] }, cfg.bot.adjustNodes, cfg, 4000);
    if (!r) return 0.5;
    return start.mover === botColor ? r.expected : 1 - r.expected;
  };
}
