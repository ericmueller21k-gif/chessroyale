import type { BossView } from "./game.ts";

/**
 * A Battle Tower floor of several bosses, as the screens read it (audit 2, finding 1: every boss drawn from his own view). The view's
 * top level is the boss in focus; each boss's own part (`side.bosses`: his name, meters, powers and marks) is given the battle's board
 * here, so a screen draws each boss as it would draw him alone. With one boss every helper answers the boss himself, as before.
 */

export interface Side {
  bosses: BossView[];
  toMove: number;
  moved: number;
  movers: readonly number[];
}

// (One per view: the screens ask many times a frame, and a view is replaced, never changed, as the battle moves.)
const sides = new WeakMap<BossView, Side | null>();

/** Each boss on a floor of several, as a screen draws him (his own view, with the battle's board); null with one boss. */
export function sideOf(boss: BossView): Side | null {
  let s = sides.get(boss);
  if (s !== undefined) return s;
  const side = boss.side;
  s = side && side.bosses.length >= 2 ? { bosses: side.bosses.map((b) => ({ ...b, board: boss.board }) as BossView), toMove: side.toMove, moved: side.moved, movers: side.movers ?? [] } : null;
  sides.set(boss, s);
  return s;
}

/** Every boss on the side (each his own part), or the boss alone. */
export const partsOf = (boss: BossView): BossView[] => sideOf(boss)?.bosses ?? [boss];

/** The boss with this id on the side (his own part), else the boss in view (with one boss, him): for a boss's own drawing or words. */
export function partOf(boss: BossView, id: string | null | undefined): BossView {
  return (id && sideOf(boss)?.bosses.find((b) => b.id === id)) || boss;
}

/** The boss who made the side's last move (the dock's "Ginger plays e5"): the one who moved on a floor of several, else the boss. */
export function moverOf(boss: BossView): BossView {
  const s = sideOf(boss);
  return s ? (s.bosses[s.moved] ?? boss) : boss;
}

/** The boss who made the side's move at board ply `ply` (the move list's face): as the view notes it, else the last to move. */
export function plyMoverOf(boss: BossView, ply: number): BossView {
  const s = sideOf(boss);
  return s ? (s.bosses[s.movers[ply] ?? s.moved] ?? boss) : boss;
}

/** The first thing a boss on the side has (`f`), in turn order: one boss's drawing on the board (Alfil's elephants, Don Dough's gold). */
export function onSide<T>(boss: BossView, f: (b: BossView) => T | null | undefined): T | undefined {
  for (const b of partsOf(boss)) {
    const x = f(b);
    if (x !== null && x !== undefined) return x;
  }
  return undefined;
}
