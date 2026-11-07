/**
 * The figures on the sprite kit (sprite-kit.ts), by their character's id, and the way each figure's art faces as drawn: what the
 * town, the rooms and the intros turn a figure by. Smudgy is the pilot (Nov 6); the others move onto the kit when next touched.
 */
import type { Facing, Sprite } from "./sprite-kit.ts";
import { SMUDGY_SPRITE } from "./smudgy.ts";

export const SPRITES: Readonly<Record<string, Sprite>> = { smudgy: SMUDGY_SPRITE };

/**
 * The way the art faces for a figure not on the kit yet, where a caller needs it (Nov 6): Alfil's art faces our left, while his
 * attack on a king faces our right, so his room's intro, which turned him by his attack's art, had him face away from the table.
 */
const ART_FACING: Readonly<Record<string, Facing>> = { alfil: "left" };

/** The way a figure's art faces as drawn (by its character's id), or null: not known yet (its callers keep their own rule). */
export const artFacing = (id: string): Facing | null => SPRITES[id]?.facing ?? ART_FACING[id] ?? null;
