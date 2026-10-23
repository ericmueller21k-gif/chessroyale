/**
 * Effect sprites for the bosses' powers, for the board: pixel art in the characters' format (palettes, parts,
 * frames, cues), each frame exactly the area it covers, so placing one is sizing its canvas to a square (or the whole
 * board) with `image-rendering: pixelated`. See power-art.ts for the list and how each is meant to play.
 *
 * Colors may be see-through (`#rrggbbaa`): the ice over a frozen piece lets the piece show, the blizzard's haze
 * lets the board show.
 */
import type { Character } from "./sprite.ts";
import { BLIZZARD_SWEEP, FROST_HIT, ICE_BOLT, ICE_OVERLAY } from "./effects/ginger.ts";
import { PIE_FLY, PIE_HIT, PIE_SPLAT } from "./effects/boingo.ts";
import { CANDLE_SHOT, CANDLE_SHOTS, FIREBALL_FALL, FIRE_SHADOW, FIRE_TILE, PIECE_BURN, POP_HIT, SPARK_FLY } from "./effects/grex.ts";
import { BULB_STRAND, DARK_MISS, DARK_POUR, DARK_SQUARE, LASH_HIT, NIGHT_LABEL, NIGHT_SQUARE } from "./effects/hollow.ts";
import { BLOCK_FLY, BONK_HIT, BOUNCE_CRASH, BOUNCE_PUFF, TOY_BLOCK } from "./effects/bigboy.ts";
import { BOARD_GAP, SAW_CRACK, SAW_CUT, SAW_HIT } from "./effects/sawyer.ts";
import { LASSO_HIT } from "./effects/pig.ts";
import { ANKUS_HIT } from "./effects/alfil.ts";
import { CARROT_FLY, CARROT_HIT, CARROT_ICON, CARROT_PATCH } from "./effects/hopper.ts";
import { BRUSH_STROKE, PAINT_DRIP, PAINT_FLY, PAINT_HIT, PAINT_SPLASH } from "./effects/smudgy.ts";
import { MOONBEAM, MOON_HIT, MOON_SCORCH } from "./effects/moo.ts";
import { GARDEN_PLANT, SEED_FLY, SEED_PLOP, WATER_HIT, WATER_SWEEP } from "./effects/gardener.ts";

// Each boss's effects are drawn in its own file (effects/<boss>.ts); what they share is in effects/common.ts.
export { BOARD_CELL, SQUARE } from "./effects/common.ts";
export { SHADOW_R } from "./effects/grex.ts";
export { NIGHT_TILES, STRAND_H, STRAND_W } from "./effects/hollow.ts";
export { TOY_LETTER_NAMES, type ToyLetter } from "./effects/bigboy.ts";
export { CUT_SIDES, GAP_W, type CutSide } from "./effects/sawyer.ts";

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
  lashHit: LASH_HIT,
  toyBlock: TOY_BLOCK,
  blockFly: BLOCK_FLY,
  bouncePuff: BOUNCE_PUFF,
  bounceCrash: BOUNCE_CRASH,
  sawCut: SAW_CUT,
  sawCrack: SAW_CRACK,
  boardGap: BOARD_GAP,
  ankusHit: ANKUS_HIT,
  sawHit: SAW_HIT,
  lassoHit: LASSO_HIT,
  pieHit: PIE_HIT,
  bonkHit: BONK_HIT,
  frostHit: FROST_HIT,
  popHit: POP_HIT,
  carrotPatch: CARROT_PATCH,
  carrotFly: CARROT_FLY,
  carrotHit: CARROT_HIT,
  carrotIcon: CARROT_ICON,
  paintSplash: PAINT_SPLASH,
  paintDrip: PAINT_DRIP,
  brushStroke: BRUSH_STROKE,
  paintFly: PAINT_FLY,
  paintHit: PAINT_HIT,
  moonbeam: MOONBEAM,
  moonScorch: MOON_SCORCH,
  moonHit: MOON_HIT,
  seedFly: SEED_FLY,
  seedPlop: SEED_PLOP,
  waterSweep: WATER_SWEEP,
  gardenPlant: GARDEN_PLANT,
  waterHit: WATER_HIT,
} as const satisfies Record<string, Character>;
