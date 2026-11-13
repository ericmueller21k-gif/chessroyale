/** Each boss's home: its picture (drawn like the bosses, characters/sprite.ts) and where its sign's blank face is. */
import type { Character } from "../../characters/sprite.ts";
import type { LightPool, LightSpot } from "./kit.ts";
import type { HomeId, Place } from "../world.ts";
import { COLISEUM_CHIP } from "./coliseum.ts";
import { PORTAL } from "./coliseum-ring.ts";
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
import { HOUSE_TIMBER, HOUSE_TIMBER_SIGN, HOUSE_TIMBER_LIGHTS, HOUSE_TIMBER_POOLS } from "./timber.ts";
import { HOUSE_BLITZ, HOUSE_BLITZ_SIGN, HOUSE_BLITZ_LIGHTS, HOUSE_BLITZ_POOLS } from "./blitz.ts";
import { HOUSE_ZEBRA, HOUSE_ZEBRA_SIGN, HOUSE_ZEBRA_LIGHTS } from "./zebra.ts";
import { HOUSE_RECLUSE, HOUSE_RECLUSE_SIGN, HOUSE_RECLUSE_LIGHTS, HOUSE_RECLUSE_POOLS } from "./recluse.ts";

export interface HouseArt {
  ch: Character;
  /** The sign's blank face, in the picture's pixels: the game writes the home's name there (an empty face, w 0: no sign, nothing written). */
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
  // (In an admin's town only while Timber is in the game for admins first: world.ts ADMIN_TOWN.)
  timber: { ch: HOUSE_TIMBER, sign: HOUSE_TIMBER_SIGN, lights: HOUSE_TIMBER_LIGHTS, pools: HOUSE_TIMBER_POOLS },
  // (Dash's Kicks, the art's house-blitz; in an admin's town only while Dash is in the game for admins first: world.ts ADMIN_TOWN.)
  dash: { ch: HOUSE_BLITZ, sign: HOUSE_BLITZ_SIGN, lights: HOUSE_BLITZ_LIGHTS, pools: HOUSE_BLITZ_POOLS },
  // (Rolling Dough, Don Dough's bakery, Nov 11: the art's house-zebra; in an admin's town only while he's in the game for admins first.)
  zebra: { ch: HOUSE_ZEBRA, sign: HOUSE_ZEBRA_SIGN, lights: HOUSE_ZEBRA_LIGHTS, pools: [] },
  // (The Walk-up, the Hidden Boss's building, Nov 13: no sign (an empty face: Eric, "no address plate or name on it"); in an admin's town
  // only while he's in the game for admins first.)
  recluse: { ch: HOUSE_RECLUSE, sign: HOUSE_RECLUSE_SIGN, lights: HOUSE_RECLUSE_LIGHTS, pools: HOUSE_RECLUSE_POOLS },
};

/**
 * The Colosseum's picture (slice 5), and the icon on its edge chip (a crown over the board's squares, 24 x 24). The street town's (the
 * north edge round) is a solid (houses/coliseum-ring.ts): its place's picture is its portal's front, the gate and the tablet the game
 * writes "The Colosseum" on; the ring round it is boxes of its own.
 */
export const COLISEUM_ART: HouseArt = { ch: PORTAL.ch, sign: PORTAL.sign, lights: PORTAL.lights, pools: PORTAL.pools };
export { COLISEUM_CHIP };

/** A place's picture: its home's, or the Colosseum's. */
export const artOf = (p: Place): HouseArt => (p.id === "coliseum" ? COLISEUM_ART : HOUSES[p.id]);
