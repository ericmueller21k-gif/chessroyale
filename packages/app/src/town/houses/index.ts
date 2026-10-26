/** Each boss's home: its picture (drawn like the bosses, characters/sprite.ts) and where its sign's blank face is. */
import type { Character } from "../../characters/sprite.ts";
import type { HomeId } from "../world.ts";
import { HOUSE_GINGER, HOUSE_GINGER_SIGN } from "./gingerbread.ts";
import { HOUSE_GREX, HOUSE_GREX_SIGN } from "./grex.ts";
import { HOUSE_HOLLOW, HOUSE_HOLLOW_SIGN } from "./hollow.ts";
import { HOUSE_MOO, HOUSE_MOO_SIGN } from "./moo.ts";
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
};
