/**
 * Babur's figure as the game draws it (docs/decisions/2026-10-24-tiger-wired.md): his approved drawing and animations (tiger.ts), plus
 * one made from them for the trip to the pump on a phone's boss bar: `hopTrip`, his `hop` with its airborne frame (TIGER_HOP_AIR)
 * held for HOP_AIR_MS while the bar moves him (components/Tiger.tsx). Nothing of his drawing changes.
 */
import { TIGER, TIGER_HOP_AIR } from "./tiger.ts";
import type { Anim, Character } from "./sprite.ts";

/** How long he is in the air on his hop to the pump and back (ms): the bar moves him across it. */
export const HOP_AIR_MS = 300;

/** When the airborne frame starts in `hop` (ms): he leaves the ground there. */
export const HOP_AIR_AT = TIGER.anims.hop!.frames.slice(0, TIGER_HOP_AIR).reduce((t, f) => t + f.ms, 0);

const hop = TIGER.anims.hop!;
const hopTrip: Anim = { loop: false, frames: hop.frames.map((f, i) => (i === TIGER_HOP_AIR ? { ...f, ms: HOP_AIR_MS } : f)) };

/** His figure: the approved one and the trip's hop. */
export const TIGER_FIGURE: Character = { ...TIGER, anims: { ...TIGER.anims, hopTrip } };
