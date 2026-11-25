/**
 * A boss battle's figure state that the first load sets (net.ts at a new battle, recluse-online.ts in the Hidden Boss's phase 2), out of
 * BossCharacter.tsx, which is the match's chunk (Nov 16, the bundle split). BossCharacter reads it and adds its own reset.
 */

/**
 * What the boss's figure shows instead of its beat, for as long as it's set (the Hidden Boss's phase 2): `before` (a loop)
 * until `since`, then `anims` in turn (a loop given with `ms` plays that long; a one-shot given with `ms` plays once and
 * holds its last frame for the rest), then `loop` for good. Its beat's lines and
 * fall lines are quiet meanwhile (his phase 2 says its own). Runs in place (playInPlace) still play over it. Cleared by a
 * new battle (resetBeats). `talks`: its beat's lines are said as usual meanwhile (the Hidden Boss's child growing up).
 */
export type FigureRun = { since: number; anims: readonly (string | { readonly anim: string; readonly ms: number })[]; loop: string; before?: string; talks?: boolean };
export const figure: { run: FigureRun | null } = { run: null };
export function setFigureRun(run: FigureRun | null) {
  figure.run = run;
}

/**
 * The Hidden Boss's final form (Eric, Nov 15: the black trench coat, his hair rising, the aura and the binary helix; the name
 * `suit` is round 3b's): from `at` (his transformation's white-out) to the end of the battle, worn on every drawing of him where he
 * stands (his frames' parts swapped for the final form's, plus its own layers: recluse.ts, `coated`). Cleared by a new battle
 * (resetBeats).
 */
export const suit: { at: number | null } = { at: null };
export function setSuitAt(at: number | null) {
  suit.at = at;
}

/** What else a new battle clears: registered by the modules that keep a battle's state (BossCharacter.tsx), as they load. */
const resets: (() => void)[] = [];
export const onResetBeats = (reset: () => void) => void resets.push(reset);

/**
 * A new boss battle (its intro, with the voices' reset): the moments seen and sounds played in the last one are
 * forgotten, so its entrance, and its defeat or victory, play again (their keys repeat from battle to battle).
 */
export function resetBeats() {
  figure.run = null;
  suit.at = null;
  for (const reset of resets) reset();
}
