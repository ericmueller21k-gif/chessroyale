import { BLACK_KNIGHT } from "./black-knight.ts";
import { CLOWN } from "./clown.ts";
import { GINGERBREAD } from "./gingerbread.ts";
import { GOD_KING } from "./god-king.ts";
import { GREX } from "./grex.ts";
import { HOLLOW } from "./hollow.ts";
import { PAWN_GOLEM } from "./pawn-golem.ts";
import type { Character } from "./sprite.ts";

export type { Character } from "./sprite.ts";

/** Every character drawn so far: the bosses, and the God King (the crowd's champion). */
export const CHARACTERS: readonly Character[] = [BLACK_KNIGHT, PAWN_GOLEM, CLOWN, GINGERBREAD, GREX, HOLLOW, GOD_KING];

// The bosses' powers: the moments their characters play and the effect sprites for the board (see power-art.ts).
export { EFFECT_NAMES, EFFECTS, POWER_ANIMS, POWER_MOMENTS, animLength, cueAt, type BossPowerMoments, type Effect, type EffectName, type PowerAnim, type PowerMoment } from "./power-art.ts";
export { EFFECT_SPRITES, BOARD_CELL, SQUARE } from "./effects.ts";
