import { BLACK_KNIGHT } from "./black-knight.ts";
import { CLOWN } from "./clown.ts";
import { GOD_KING } from "./god-king.ts";
import { PAWN_GOLEM } from "./pawn-golem.ts";
import type { Character } from "./sprite.ts";

export type { Character } from "./sprite.ts";

/** Every character drawn so far: the bosses, and the God King (the crowd's champion). */
export const CHARACTERS: readonly Character[] = [BLACK_KNIGHT, PAWN_GOLEM, CLOWN, GOD_KING];
