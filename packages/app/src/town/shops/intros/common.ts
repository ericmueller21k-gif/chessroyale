/**
 * The beats most intros share (shops/timeline.ts), from CHALLENGE_FEEL: facing each other, the line, the pause after it, the hop back
 * clear of the stools, the attack's beat. A boss's own intro (shops/intros/<boss>.ts) builds its beats from these and its art's.
 */
import { CHALLENGE_FEEL, coverMs } from "../challenge.ts";
import type { Act, Beat, Clip } from "../timeline.ts";

const F = CHALLENGE_FEEL;
/** On the marks, facing each other a moment. */
export const faceBeat = (): Beat => ({ step: "face", ms: F.faceMs });
/** Its line in the bubble over its head: the beat `ms` long (default the line's), the bubble `lineMs` (default the same). */
export const lineBeat = (ms: number = F.lineMs, lineMs: number = ms): Beat => ({ step: "line", ms, acts: [{ actor: "line", for: lineMs }] });
/** The pause after it (or between build steps: `gapMs`). */
export const pauseBeat = (ms: number = F.afterLineMs): Beat => ({ step: "pause", ms });
/** You both hop back clear of the stools as they come in (CHALLENGE_FEEL.clear, `hopMs`, `hopUp` squares at its top), `at` into a beat. */
export const hopBack = (at = 0): Act[] =>
  (["you", "boss"] as const).map((actor) => ({ actor, at, move: { to: "clear" as const, ms: F.hopMs, ease: "smooth" as const, hop: F.hopUp } }));
/** The table (its picture), its board and its stools come in, `at` into a beat. */
export const tableIn = (at = 0, stools = true): Act[] => [{ actor: "table", at, show: true }, { actor: "board", at, show: true }, ...(stools ? [{ actor: "stools", at, show: true as const }] : [])];
/** The finished table on its own a beat. */
export const tableBeat = (acts?: readonly Act[]): Beat => ({ step: "table", ms: F.tableHoldMs, acts });
/** Its God King attack, swung `swingMs` until its storm has covered the screen (challenge.ts attackStart: this beat's start). */
export const swingBeat = (acts?: readonly Act[]): Beat => ({ step: "swing", ms: Math.max(0, F.swingMs - coverMs(true)), acts });
/** An animation's length (ms) by its frames. */
export const lenOf = (c: Clip | undefined): number => (c ? c.ms.reduce((a, b) => a + b, 0) : 0);
