/** Each boss's home: its picture (drawn like the bosses, characters/sprite.ts) and where its sign's blank face is. */
import type { Character } from "../../characters/sprite.ts";
import type { HomeId } from "../world.ts";
import { HOUSE_GINGER, HOUSE_GINGER_SIGN } from "./gingerbread.ts";
import { HOUSE_GREX, HOUSE_GREX_SIGN } from "./grex.ts";
import { HOUSE_HOLLOW, HOUSE_HOLLOW_SIGN } from "./hollow.ts";
import { HOUSE_MOO, HOUSE_MOO_SIGN } from "./moo.ts";
import { HOUSE_ALFIL, HOUSE_ALFIL_SIGN } from "./alfil.ts";
import { HOUSE_BIGBOY, HOUSE_BIGBOY_SIGN } from "./bigboy.ts";
import { HOUSE_CLOWN, HOUSE_CLOWN_SIGN } from "./clown.ts";
import { HOUSE_GARDENER, HOUSE_GARDENER_SIGN } from "./gardener.ts";
import { HOUSE_HOPPER, HOUSE_HOPPER_SIGN } from "./hopper.ts";
import { HOUSE_PIG, HOUSE_PIG_SIGN } from "./pig.ts";
import { HOUSE_SAWYER, HOUSE_SAWYER_SIGN } from "./sawyer.ts";
import { HOUSE_SMUDGY, HOUSE_SMUDGY_SIGN } from "./smudgy.ts";
import { HOUSE_TIGER, HOUSE_TIGER_SIGN } from "./tiger.ts";

export interface HouseArt {
  ch: Character;
  /** The sign's blank face, in the picture's pixels: the game writes the home's name there. */
  sign: { x: number; y: number; w: number; h: number };
}

export const HOUSES: Record<HomeId, HouseArt> = {
  tiger: { ch: HOUSE_TIGER, sign: HOUSE_TIGER_SIGN },
  gingerbread: { ch: HOUSE_GINGER, sign: HOUSE_GINGER_SIGN },
  grex: { ch: HOUSE_GREX, sign: HOUSE_GREX_SIGN },
  hollow: { ch: HOUSE_HOLLOW, sign: HOUSE_HOLLOW_SIGN },
  moo: { ch: HOUSE_MOO, sign: HOUSE_MOO_SIGN },
  clown: { ch: HOUSE_CLOWN, sign: HOUSE_CLOWN_SIGN },
  bigboy: { ch: HOUSE_BIGBOY, sign: HOUSE_BIGBOY_SIGN },
  sawyer: { ch: HOUSE_SAWYER, sign: HOUSE_SAWYER_SIGN },
  pig: { ch: HOUSE_PIG, sign: HOUSE_PIG_SIGN },
  smudgy: { ch: HOUSE_SMUDGY, sign: HOUSE_SMUDGY_SIGN },
  hopper: { ch: HOUSE_HOPPER, sign: HOUSE_HOPPER_SIGN },
  gardener: { ch: HOUSE_GARDENER, sign: HOUSE_GARDENER_SIGN },
  alfil: { ch: HOUSE_ALFIL, sign: HOUSE_ALFIL_SIGN },
};
