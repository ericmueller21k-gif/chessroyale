/**
 * The figures on the sprite kit (sprite-kit.ts), by their character's id, and the way each figure's art faces as drawn: what the
 * town, the rooms and the intros turn a figure by. Smudgy is the pilot (Nov 6); Big Boy (Nov 7, facing front: never mirrored); the
 * others move onto the kit when next touched.
 */
import type { ArtFacing, Sprite } from "./sprite-kit.ts";
import { SMUDGY_SPRITE } from "./smudgy.ts";
import { BIGBOY_SPRITE } from "./bigboy.ts";

export const SPRITES: Readonly<Record<string, Sprite>> = { smudgy: SMUDGY_SPRITE, bigboy: BIGBOY_SPRITE };

/**
 * The way the art faces as drawn for every boss not on the kit yet, by its character's id (judged by eye at 4x, Nov 17: Eric, "Can we send
 * a helper to have all the bosses facing the right way"; docs/decisions/2026-11-17-boss-facing.md). What every place turns a boss by: the
 * board's figure, the select stage, the town, the rooms (kits.ts `facingOf`). Nov 6: Alfil's art faces our left, while his attack on a
 * king faces our right, so his room's intro, which turned him by his attack's art, had him face away from the table.
 */
const ART_FACING: Readonly<Record<string, ArtFacing>> = {
  clown: "front",
  gingerbread: "front",
  grex: "right",
  hollow: "front",
  sawyer: "left",
  pig: "left",
  alfil: "left",
  hopper: "left",
  moo: "left",
  gardener: "left",
  tiger: "left",
  folio: "left",
  timber: "left",
  dash: "left",
  zebra: "right",
  // (Birdie, Nov 23: his train's nose and his face to our left.)
  birdie: "left",
  recluse: "front",
};

/**
 * The way a figure's art faces as drawn (by its character's id), or null: not known yet (its callers keep their own rule). A boss's town
 * figure (`<id>-town`: Birdie's, Chandy's, its idle alone) faces as its character does: Nov 23, Eric, "He's facing the wrong way in the
 * building": `birdie-town` wasn't known, so the room and the town square took his left-facing art for a right-facing one.
 */
export const artFacing = (id: string): ArtFacing | null => {
  const of = id.endsWith("-town") ? id.slice(0, -5) : id;
  return SPRITES[of]?.facing ?? ART_FACING[of] ?? null;
};
