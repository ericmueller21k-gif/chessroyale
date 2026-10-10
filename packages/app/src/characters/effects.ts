/**
 * Effect sprites for the bosses' powers, for the board: pixel art in the characters' format (palettes, parts,
 * frames, cues), each frame exactly the area it covers, so placing one is sizing its canvas to a square (or the whole
 * board) with `image-rendering: pixelated`. See power-art.ts for the list and how each is meant to play.
 *
 * Colours may be see-through (`#rrggbbaa`): the ice over a frozen piece lets the piece show, the blizzard's haze
 * lets the board show.
 */
import type { Character } from "./sprite.ts";
import { BLIZZARD_SWEEP, ICE_BOLT, ICE_OVERLAY } from "./effects/ginger.ts";
import { PIE_FLY, PIE_SPLAT } from "./effects/boingo.ts";
import { CANDLE_SHOT, CANDLE_SHOTS, FIREBALL_FALL, FIRE_SHADOW, FIRE_TILE, PIECE_BURN, SPARK_FLY } from "./effects/grex.ts";
import { BULB_STRAND, DARK_MISS, DARK_POUR, DARK_SQUARE, NIGHT_LABEL, NIGHT_SQUARE } from "./effects/hollow.ts";
import { BLOCK_FLY, BOUNCE_CRASH, BOUNCE_PUFF, TOY_BLOCK } from "./effects/bigboy.ts";

// Each boss's effects are drawn in its own file (effects/<boss>.ts); what they share is in effects/common.ts.
export { BOARD_CELL, SQUARE } from "./effects/common.ts";
export { SHADOW_R } from "./effects/grex.ts";
export { NIGHT_TILES, STRAND_H, STRAND_W } from "./effects/hollow.ts";
export { TOY_LETTER_NAMES, type ToyLetter } from "./effects/bigboy.ts";

/** Every effect sprite, by name. */
export const EFFECT_SPRITES = {
  iceOverlay: ICE_OVERLAY,
  iceBolt: ICE_BOLT,
  blizzardSweep: BLIZZARD_SWEEP,
  pieSplat: PIE_SPLAT,
  pieFly: PIE_FLY,
  fireTile: FIRE_TILE,
  pieceBurn: PIECE_BURN,
  sparkFly: SPARK_FLY,
  candleShot: CANDLE_SHOT,
  fireballFall: FIREBALL_FALL,
  candleShots: CANDLE_SHOTS,
  fireShadow: FIRE_SHADOW,
  darkSquare: DARK_SQUARE,
  darkPour: DARK_POUR,
  darkMiss: DARK_MISS,
  bulbStrand: BULB_STRAND,
  nightSquare: NIGHT_SQUARE,
  nightLabel: NIGHT_LABEL,
  toyBlock: TOY_BLOCK,
  blockFly: BLOCK_FLY,
  bouncePuff: BOUNCE_PUFF,
  bounceCrash: BOUNCE_CRASH,
} as const satisfies Record<string, Character>;
