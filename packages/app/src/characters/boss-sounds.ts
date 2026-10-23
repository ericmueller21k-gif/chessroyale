import { autochessSound } from "../autochess/sounds.ts";
import { alfilSound } from "./alfil-sounds.ts";
import { bigBoySound } from "./bigboy-sounds.ts";
import { clownSound } from "./clown-sounds.ts";
import { gingerSound } from "./gingerbread-sounds.ts";
import { gardenerSound } from "./gardener-sounds.ts";
import { godKingSound } from "./god-king-sounds.ts";
import { grexSound } from "./grex-sounds.ts";
import { hollowSound } from "./hollow-sounds.ts";
import { hopperSound } from "./hopper-sounds.ts";
import { mooSound } from "./moo-sounds.ts";
import { pigSound } from "./pig-sounds.ts";
import { recluseSound } from "./recluse-sounds.ts";
import { sawyerSound } from "./sawyer-sounds.ts";
import { smudgySound } from "./smudgy-sounds.ts";

/**
 * The bosses' synthesized sounds by module, each name its cache's (synth.ts, soundCache): one table for the page and
 * the sound worker (sound-worker.ts), so a sound made ahead off the page is the very one played. (The God King's
 * synthesized ones too: `godKing`.)
 */
const MAKERS = {
  // (Auto chess's, not a boss's: the same cache, worker and ahead-of-time making.)
  autochess: autochessSound,
  alfil: alfilSound,
  bigBoy: bigBoySound,
  clown: clownSound,
  gardener: gardenerSound,
  ginger: gingerSound,
  godKing: godKingSound,
  grex: grexSound,
  hollow: hollowSound,
  hopper: hopperSound,
  moo: mooSound,
  pig: pigSound,
  recluse: recluseSound,
  sawyer: sawyerSound,
  smudgy: smudgySound,
} as const;

/** One boss sound: its module and its name there. */
export type BossSound = { [M in keyof typeof MAKERS]: readonly [M, Parameters<(typeof MAKERS)[M]>[0]] }[keyof typeof MAKERS];

/** Makes one (or returns it from its cache). */
export const makeBossSound = ([module, name]: BossSound, rate: number): Float32Array => (MAKERS[module] as (n: string, r: number) => Float32Array)(name, rate);
