/**
 * When Moo & Moon are drawn powered up (the Full Moon; the director's call, Oct 20: every animation he plays during it draws
 * powered, until he's dazed and his colors go back), from the battle's state every player shares and two times the screens
 * note as their moments play (the transformation's `swap` and the daze's `calm`), so it's the same everywhere and a screen
 * drawn later carries on. His rules: packages/chess/src/bosses/moo.ts; his moments on screen: components/Moo.tsx.
 *
 * - The view's `fullMoon` is set from the start of his turn, as the Full Moon comes (his transformation plays while he thinks),
 *   until his last move at full strength is made: he's powered through all of it, but not before the transformation's `swap`.
 * - Then `dazed` is among the next turn's events, and his colors go back at its `calm`: his last powered move and the start of
 *   the daze draw powered too. (Only on the boss's own screen: from the crowd's turn on, the daze is over.)
 */
import type { Stage } from "./boss-beats.ts";
import type { BossView } from "../game.ts";

/** The wall-clock time of each transformation's `swap` and each daze's `calm`, from the moments that play them. */
const swaps = new Map<string, number>();
const calms = new Map<string, number>();
const remember = (map: Map<string, number>, key: string, at: number) => {
  map.set(key, at);
  if (map.size > 40) map.delete(map.keys().next().value!);
};
const swapKey = (boss: Pick<BossView, "id" | "startMove" | "powers">) => `${boss.id}:${boss.startMove}:${boss.powers?.ultAt}`;
const calmKey = (boss: Pick<BossView, "id" | "startMove" | "powers">) => `${boss.id}:${boss.startMove}:${boss.powers?.turn}`;

/** The transformation plays: his colors go gold at `at`. */
export const noteSwap = (boss: Pick<BossView, "id" | "startMove" | "powers">, at: number) => remember(swaps, swapKey(boss), at);
/** The daze plays: his colors go back at `at`. */
export const noteCalm = (boss: Pick<BossView, "id" | "startMove" | "powers">, at: number) => remember(calms, calmKey(boss), at);

/** Whether he's drawn powered up at `now`, on a screen at `stage`. */
export function mooPowered(boss: Pick<BossView, "id" | "startMove" | "powers">, now: number, stage?: Stage): boolean {
  const p = boss.powers;
  if (!p || boss.id !== "moo") return false;
  if (p.fullMoon) {
    const swap = swaps.get(swapKey(boss));
    return swap === undefined || now >= swap;
  }
  // (His last powered move, then the daze: the next turn's events have it, and its `calm` takes the colors back.)
  if (stage !== "bossMove" || !p.events.some((e) => e.kind === "dazed" && e.turn === p.turn)) return false;
  const calm = calms.get(calmKey(boss));
  return calm === undefined || now < calm;
}

/** A new battle: nothing noted. */
export function resetMoo() {
  swaps.clear();
  calms.clear();
}
