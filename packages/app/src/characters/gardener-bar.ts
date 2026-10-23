/**
 * The hippo gardener as a phone's boss bar draws him (kits.ts `bar`; docs/decisions/2026-10-23-gardener-wired.md): the same
 * drawing, parts, palette, frames and cues, with the water off. From his feet he reaches 28 px left and 25 right, inside the
 * bar's `wide` box (29 each side), but his spray runs 16 farther left (44), past it and into his name; the still's own note is to
 * draw it short or off on the bar (`spray: 4` or `0`), so every frame's spray layer is left out here. His watering, where the
 * water matters, is cast at the board's corner from the full drawing, and so is his attack on a king. A computer and the
 * results keep the full drawing, with the spray.
 */
import { GARDENER } from "./gardener.ts";
import type { Anim, Character } from "./sprite.ts";

/** A layer of the spray (gardener.ts names it `spray:<tip>:<tilt>:<length>:<droop>:<seed>`). */
export const isSpray = (part: string): boolean => part.startsWith("spray:");

const noSpray = (a: Anim): Anim => ({ ...a, frames: a.frames.map((f) => ({ ...f, layers: f.layers.filter((l) => !isSpray(l.part)) })) });

export const GARDENER_BAR: Character = {
  ...GARDENER,
  anims: Object.fromEntries(Object.entries(GARDENER.anims).map(([name, a]) => [name, noSpray(a)])),
};
