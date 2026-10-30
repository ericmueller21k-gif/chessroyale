/**
 * Folio's lines (the director's, Oct 26, used as written: docs/decisions/2026-10-27-folio-rules.md). A paper crane folded
 * from a page of handwriting: calm, honest, a little unsettling. It tells you the truth, but it never takes anything back
 * for you. One line per event, no more (the brief): the wiring lane puts them in its kit (kits.ts) as its beats. "It"
 * everywhere, never "he".
 *
 * - `entrance`: as it's met (and its select line: SELECT_LINES in boss-select.ts).
 * - `power`: its Draft's ink mark (the rules' `draft`).
 * - `fold`: a marked piece folded (`fold`).
 * - `ultimateWarn`: the Crease's warning (`warn`, with its line shown: `creaseWarn`); said once, not again for the line.
 * - `revision`: its Revision (`revision`).
 * - `victory`, `defeat`: the battle's end.
 */
import type { Beat } from "./boss-beats.ts";

export const FOLIO_LINES: Partial<Record<Beat, readonly string[]>> = {
  entrance: ["Every game is a draft. Shall we write one?"],
  power: ["I'll be honest: that piece is next."],
  fold: ["Folded. It'll keep."],
  ultimateWarn: ["Mind the crease."],
  revision: ["Let me write that again."],
  victory: ["Well played. Keep the crane."],
  defeat: ["Beautifully written. I'll fold this one away."],
};
