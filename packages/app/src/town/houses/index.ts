/** Each boss's home: its picture (drawn like the bosses, characters/sprite.ts) and where its sign's blank face is. */
import type { Character } from "../../characters/sprite.ts";
import type { LightPool, LightSpot } from "./kit.ts";
import type { HomeId, Place } from "../world.ts";
import { COLISEUM_CHIP, HOUSE_COLISEUM, HOUSE_COLISEUM_SIGN, HOUSE_COLISEUM_LIGHTS, HOUSE_COLISEUM_POOLS } from "./coliseum.ts";
import { HOUSE_GINGER, HOUSE_GINGER_SIGN, HOUSE_GINGER_LIGHTS, HOUSE_GINGER_POOLS } from "./gingerbread.ts";
import { HOUSE_GREX, HOUSE_GREX_SIGN, HOUSE_GREX_LIGHTS } from "./grex.ts";
import { HOUSE_HOLLOW, HOUSE_HOLLOW_SIGN, HOUSE_HOLLOW_LIGHTS } from "./hollow.ts";
import { HOUSE_MOO, HOUSE_MOO_SIGN, HOUSE_MOO_LIGHTS } from "./moo.ts";
import { HOUSE_ALFIL, HOUSE_ALFIL_SIGN, HOUSE_ALFIL_LIGHTS, HOUSE_ALFIL_POOLS } from "./alfil.ts";
import { HOUSE_BIGBOY, HOUSE_BIGBOY_SIGN, HOUSE_BIGBOY_LIGHTS } from "./bigboy.ts";
import { HOUSE_CLOWN, HOUSE_CLOWN_SIGN, HOUSE_CLOWN_LIGHTS, HOUSE_CLOWN_POOLS } from "./clown.ts";
import { HOUSE_GARDENER, HOUSE_GARDENER_SIGN, HOUSE_GARDENER_LIGHTS, HOUSE_GARDENER_POOLS } from "./gardener.ts";
import { HOUSE_HOPPER, HOUSE_HOPPER_SIGN, HOUSE_HOPPER_LIGHTS } from "./hopper.ts";
import { HOUSE_PIG, HOUSE_PIG_SIGN, HOUSE_PIG_LIGHTS } from "./pig.ts";
import { HOUSE_SAWYER, HOUSE_SAWYER_SIGN, HOUSE_SAWYER_LIGHTS, HOUSE_SAWYER_POOLS } from "./sawyer.ts";
import { HOUSE_SMUDGY, HOUSE_SMUDGY_SIGN, HOUSE_SMUDGY_LIGHTS, HOUSE_SMUDGY_POOLS } from "./smudgy.ts";
import { HOUSE_TIGER, HOUSE_TIGER_SIGN, HOUSE_TIGER_LIGHTS, HOUSE_TIGER_POOLS } from "./tiger.ts";
import { HOUSE_FOLIO, HOUSE_FOLIO_SIGN, HOUSE_FOLIO_LIGHTS, HOUSE_FOLIO_POOLS } from "./folio.ts";

export interface HouseArt {
  ch: Character;
  /** The sign's blank face, in the picture's pixels: the game writes the home's name there. */
  sign: { x: number; y: number; w: number; h: number };
  /** Where it glows from inside at dusk and night (its windows, its doorway, its lanterns), in the picture's pixels (Oct 27). */
  lights: readonly LightSpot[];
  /** The pools of light it lays on the ground in front at dusk and night (an open door's). */
  pools: readonly LightPool[];
}

export const HOUSES: Record<HomeId, HouseArt> = {
  tiger: { ch: HOUSE_TIGER, sign: HOUSE_TIGER_SIGN, lights: HOUSE_TIGER_LIGHTS, pools: HOUSE_TIGER_POOLS },
  gingerbread: { ch: HOUSE_GINGER, sign: HOUSE_GINGER_SIGN, lights: HOUSE_GINGER_LIGHTS, pools: HOUSE_GINGER_POOLS },
  grex: { ch: HOUSE_GREX, sign: HOUSE_GREX_SIGN, lights: HOUSE_GREX_LIGHTS, pools: [] },
  hollow: { ch: HOUSE_HOLLOW, sign: HOUSE_HOLLOW_SIGN, lights: HOUSE_HOLLOW_LIGHTS, pools: [] },
  moo: { ch: HOUSE_MOO, sign: HOUSE_MOO_SIGN, lights: HOUSE_MOO_LIGHTS, pools: [] },
  clown: { ch: HOUSE_CLOWN, sign: HOUSE_CLOWN_SIGN, lights: HOUSE_CLOWN_LIGHTS, pools: HOUSE_CLOWN_POOLS },
  bigboy: { ch: HOUSE_BIGBOY, sign: HOUSE_BIGBOY_SIGN, lights: HOUSE_BIGBOY_LIGHTS, pools: [] },
  sawyer: { ch: HOUSE_SAWYER, sign: HOUSE_SAWYER_SIGN, lights: HOUSE_SAWYER_LIGHTS, pools: HOUSE_SAWYER_POOLS },
  pig: { ch: HOUSE_PIG, sign: HOUSE_PIG_SIGN, lights: HOUSE_PIG_LIGHTS, pools: [] },
  smudgy: { ch: HOUSE_SMUDGY, sign: HOUSE_SMUDGY_SIGN, lights: HOUSE_SMUDGY_LIGHTS, pools: HOUSE_SMUDGY_POOLS },
  hopper: { ch: HOUSE_HOPPER, sign: HOUSE_HOPPER_SIGN, lights: HOUSE_HOPPER_LIGHTS, pools: [] },
  gardener: { ch: HOUSE_GARDENER, sign: HOUSE_GARDENER_SIGN, lights: HOUSE_GARDENER_LIGHTS, pools: HOUSE_GARDENER_POOLS },
  alfil: { ch: HOUSE_ALFIL, sign: HOUSE_ALFIL_SIGN, lights: HOUSE_ALFIL_LIGHTS, pools: HOUSE_ALFIL_POOLS },
  folio: { ch: HOUSE_FOLIO, sign: HOUSE_FOLIO_SIGN, lights: HOUSE_FOLIO_LIGHTS, pools: HOUSE_FOLIO_POOLS },
};

/** The Colosseum's picture (slice 5), and the icon on its edge chip (a crown over the board's squares, 24 x 24). */
export const COLISEUM_ART: HouseArt = { ch: HOUSE_COLISEUM, sign: HOUSE_COLISEUM_SIGN, lights: HOUSE_COLISEUM_LIGHTS, pools: HOUSE_COLISEUM_POOLS };
export { COLISEUM_CHIP };

/** A place's picture: its home's, or the Colosseum's. */
export const artOf = (p: Place): HouseArt => (p.id === "coliseum" ? COLISEUM_ART : HOUSES[p.id]);
