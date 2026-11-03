/**
 * Dash's figure as the game draws it (docs/decisions/2026-11-03-dash.md): his approved drawing and animations (boss-blitz.ts,
 * the art's own name), in a frame with DASH_ROOM pixels more on the right: his entrance's two zip-in frames start partly past
 * the art's 72 x 104 frame on purpose (its notes, "They get it on purpose"), and the game's frames never cut a drawing off at
 * their edge (characters.test.ts). Nothing of his drawing changes and his feet stay where they are; only the room round it.
 */
import { BOSS_BLITZ } from "./boss-blitz.ts";
import type { Character } from "./sprite.ts";

/** The room added on his right, in his own pixels (his zip-in's blur reaches 32 past the art's frame). */
export const DASH_ROOM = 33;

/** His figure: the approved one in a frame with room on its right (105 x 104). */
export const DASH_FIGURE: Character = { ...BOSS_BLITZ, w: BOSS_BLITZ.w + DASH_ROOM };
