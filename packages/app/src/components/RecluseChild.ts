/**
 * The Hidden Boss's child form on screen (BossView.form "child"; RECLUSE_CHILD; Eric, Nov 12-13): his figure grows as his level
 * rises, from the view alone (solo and online alike), each step up played once as it comes:
 * - **His age** (core childAge, from his ramp's step `formStep`): the child, 13, 20, then his adult look at the top. A step up plays
 *   the growing step (recluse-ages.ts: a shimmer, a flash, the two silhouettes flickering, the older one in color) where he stands,
 *   with a line for his new age; a step of his level that isn't one (his level's pop, BossLevel) has a line of its own now and then.
 * - **Beaten** (his result, "crowd"): his line (the kit's `defeat`), then he grows up into his adult look at once (`growUpAt` into his
 *   fall), the man the next match meets (the runner's nextBossForm).
 * His figure is set by a figure run (BossCharacter's setFigureRun) that keeps his beats' lines (`talks`); a new battle forgets it all
 * (resetBeats, resetGrowing). Drawn again (a new screen, the other placement), nothing plays twice: the run keeps when it began.
 */
import { RECLUSE_CHILD, childAge, childRating } from "@chessroyale/core";
import { GROWING_LOOPS, growAnim, growUpAnim } from "../characters/recluse-ages.ts";
import { RECLUSE_CHILD_LINES } from "../characters/recluse-lines.ts";
import type { BossView } from "../game.ts";
import { LOW, NORMAL, bossVoice } from "../speech.tsx";
import type { FigureRun } from "./BossCharacter.tsx";

/** His age at a step of his ramp (0 the child, 1 about 13, 2 about 20, 3 his adult look). */
export const ageAtStep = (step: number): number => childAge(childRating(step * RECLUSE_CHILD.everyPlies));

/** What this device has shown of the battle's child: his battle, the step and age last shown, and whether he's grown up (beaten). */
let shown = { battle: "", step: 0, age: 0, up: false };
export function resetGrowing(): void {
  shown = { battle: "", step: 0, age: 0, up: false };
}

const pick = <T>(list: readonly T[], n: number): T => list[Math.abs(n) % list.length]!;

/**
 * The figure run his view calls for now, or null when nothing changes (not his child form, or already shown). Says the step's
 * line as it comes. `now`: when the change is seen (a step up starts then).
 */
export function growingRun(boss: Pick<BossView, "id" | "startMove" | "form" | "formStep" | "result">, now = Date.now()): FigureRun | null {
  if (boss.form !== "child") return null;
  const battle = `${boss.id}:${boss.startMove}`;
  const step = boss.formStep ?? 0;
  const age = ageAtStep(step);
  const loop = (a: number) => GROWING_LOOPS[Math.max(0, Math.min(3, a))]!;
  // (A battle first seen part way through: his age as it is, no step up played.)
  if (shown.battle !== battle) {
    shown = { battle, step, age, up: false };
    if (boss.result !== "crowd") return age > 0 ? { since: now, anims: [], loop: loop(age), talks: true } : null;
  }
  if (boss.result === "crowd") {
    if (shown.up) return null;
    shown.up = true;
    // (At his adult look already, at the top: nothing more to grow.)
    if (shown.age >= 3) return { since: now, anims: [], loop: loop(3), talks: true };
    return { since: now + RECLUSE_CHILD.growUpAt, before: loop(shown.age), anims: [growUpAnim(shown.age)], loop: loop(3), talks: true };
  }
  if (step <= shown.step) return null;
  const from = shown.age;
  shown.step = step;
  if (age > from) {
    shown.age = age;
    bossVoice.say(pick(RECLUSE_CHILD_LINES.grow[age - 1]!, boss.startMove + step), `${battle}:child:grow:${age}`, NORMAL, now);
    return { since: now, before: loop(from), anims: [growAnim(age)], loop: loop(age), talks: true };
  }
  bossVoice.say(pick(RECLUSE_CHILD_LINES.levelUp, step), `${battle}:child:level:${step}`, LOW, now);
  return null;
}
