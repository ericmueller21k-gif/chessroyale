import { BLACK_KNIGHT } from "./black-knight.ts";
import { CLOWN } from "./clown.ts";
import { PAWN_GOLEM } from "./pawn-golem.ts";
import type { Character } from "./sprite.ts";

export type { Character } from "./sprite.ts";

/** Every boss drawn so far. */
export const CHARACTERS: readonly Character[] = [BLACK_KNIGHT, PAWN_GOLEM, CLOWN];
