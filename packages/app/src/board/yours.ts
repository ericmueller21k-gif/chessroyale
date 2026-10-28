/**
 * What you draw and move ahead on a board (chess.com's habits; docs/areas/board.md, "Arrows, highlights and premoves"):
 * your arrows and highlighted squares, and your premoves, kept by the board's key, so they stay through every screen of
 * a game that passes the same key (a raid's turn, then the boss's) and a board with another key starts clean. A board
 * without a game's key keeps its own (`board:N`), dropped as it goes.
 *
 * Only on this device: your arrows and highlights are never sent anywhere. A premove becomes a move only when your turn
 * comes (the board plays it through its `onMove`); an online crowd match tells its server the first one ahead (net.ts,
 * `premove`), so fair play can tell a premove from a fast move.
 */
import { NO_MARKS, marksEmpty, type Premove, type UserMarks } from "./logic.ts";

export interface Yours {
  /** Your premoves, first first. */
  queue: readonly Premove[];
  marks: UserMarks;
}

const EMPTY: Yours = { queue: [], marks: NO_MARKS };
/** (A few games' worth: the oldest key goes first.) */
const KEEP = 8;
const entries = new Map<string, Yours>();
const listeners = new Set<(key: string) => void>();

export function yours(key: string): Yours {
  return entries.get(key) ?? EMPTY;
}

function put(key: string, next: Yours) {
  // (Kept last, as the newest; nothing to keep, nothing kept.)
  entries.delete(key);
  if (next.queue.length || !marksEmpty(next.marks)) entries.set(key, next);
  while (entries.size > KEEP) entries.delete(entries.keys().next().value!);
  for (const l of [...listeners]) l(key);
}

export function setQueue(key: string, queue: readonly Premove[]) {
  const was = yours(key);
  if (was.queue === queue) return;
  put(key, { ...was, queue });
}

export function setMarks(key: string, marks: UserMarks) {
  const was = yours(key);
  if (was.marks === marks) return;
  put(key, { ...was, marks });
}

/**
 * A premove made: after the others on a computer (`many`: made with a mouse, chess.com's queue), in place of any other on
 * a phone (chess.com's app holds one).
 */
export function addPremove(key: string, p: Premove, many: boolean) {
  setQueue(key, many ? [...yours(key).queue, p] : [p]);
}

/** Forgets a key's premoves and marks (a board of its own going away). Nobody is told: nothing shows them. */
export function dropYours(key: string) {
  entries.delete(key);
}

/** Every premove on every board cancelled (Settings → Board, Premoves switched off). */
export function clearAllPremoves() {
  for (const [key, e] of [...entries]) if (e.queue.length) put(key, { ...e, queue: [] });
}

/** Hears every change: the key that changed. */
export function onYours(fn: (key: string) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let matches = 0;
const matchKeys = new WeakMap<object, string>();

/** A short key for a game object (a match or a 1 v 1 session), the same for its whole life: the start of its boards' keys. */
export function gameKey(game: object): string {
  let k = matchKeys.get(game);
  if (!k) {
    k = `g${++matches}`;
    matchKeys.set(game, k);
  }
  return k;
}

/** A board's premove key in a game: the game, the board, and the side you move for there. */
export const seatKey = (game: object, board: number | string, side: "w" | "b") => `${gameKey(game)}:${board}:${side}`;
