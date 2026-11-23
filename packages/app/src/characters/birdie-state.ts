/**
 * When Birdie is drawn as Armored Birdie (his fall: the kit's `powered`), from the battle's state every player shares and the one time
 * the screens note as his fall's cutscene plays (the hit's light at its whitest, BIRDIE_BEATS.fall.armorAt), so it's the same everywhere
 * and a screen drawn later carries on. His rules: packages/chess/src/bosses/birdie.ts; his moments on screen: components/Birdie.tsx.
 *
 * The view's `birdie.fell` is set from the start of his turn, as his fall comes (the cutscene plays while he thinks): he's armored from
 * the cutscene's hit on, and from then for the rest of the battle; a fall whose cutscene was skipped (a rejoin) or not seen yet, at once.
 */
import type { BossView } from "../game.ts";

/** The wall-clock time of each fall's hit (by battle), from the cutscene that plays it. */
const hits = new Map<string, number>();
const hitKey = (boss: Pick<BossView, "id" | "startMove">) => `${boss.id}:${boss.startMove}`;

/** His fall's cutscene plays: he's Armored Birdie from `at`. */
export function noteArmor(boss: Pick<BossView, "id" | "startMove">, at: number): void {
  hits.set(hitKey(boss), at);
  if (hits.size > 40) hits.delete(hits.keys().next().value!);
}

/** Whether he's drawn as Armored Birdie at `now`. */
export function birdieArmoredNow(boss: Pick<BossView, "id" | "startMove" | "powers">, now: number): boolean {
  if (boss.id !== "birdie") return false;
  const fell = boss.powers?.birdie?.fell;
  if (fell === null || fell === undefined) return false;
  const at = hits.get(hitKey(boss));
  return at === undefined || now >= at;
}

/** A new battle: nothing noted. */
export function resetBirdie(): void {
  hits.clear();
}
