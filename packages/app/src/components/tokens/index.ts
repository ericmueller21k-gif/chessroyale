import type { Character } from "../../characters/sprite.ts";
import { TOKEN_ALFIL } from "./token-alfil.ts";
import { TOKEN_BEAVER } from "./token-beaver.ts";
import { TOKEN_BIGBOY } from "./token-bigboy.ts";
import { TOKEN_CLOWN } from "./token-clown.ts";
import { TOKEN_FOLIO } from "./token-folio.ts";
import { TOKEN_GARDENER } from "./token-gardener.ts";
import { TOKEN_GINGER } from "./token-ginger.ts";
import { TOKEN_GREX } from "./token-grex.ts";
import { TOKEN_HOLLOW } from "./token-hollow.ts";
import { TOKEN_HOPPER } from "./token-hopper.ts";
import { TOKEN_MOO } from "./token-moo.ts";
import { TOKEN_PIG } from "./token-pig.ts";
import { TOKEN_SAWYER } from "./token-sawyer.ts";
import { TOKEN_SMUDGY } from "./token-smudgy.ts";
import { TOKEN_TIGER } from "./token-tiger.ts";

/**
 * Every boss's token picture, by boss id (core's BOSS_ROSTER): copied as drawn from claude/boss-art
 * (`scripts/boss-art/out/token-<name>/token-<name>.ts`; Ginger's and Blitz's approved Nov 1, the rest drawn Nov 2), only their
 * import lines changed. One chunk, loaded when a token is first shown (components/TokenArt.tsx). A boss without one here shows
 * a plain coin. (Blitz's is drawn too, waiting for its boss.)
 */
export const TOKEN_ART: Readonly<Record<string, Character>> = {
  gingerbread: TOKEN_GINGER,
  clown: TOKEN_CLOWN,
  grex: TOKEN_GREX,
  hollow: TOKEN_HOLLOW,
  bigboy: TOKEN_BIGBOY,
  sawyer: TOKEN_SAWYER,
  pig: TOKEN_PIG,
  alfil: TOKEN_ALFIL,
  hopper: TOKEN_HOPPER,
  smudgy: TOKEN_SMUDGY,
  moo: TOKEN_MOO,
  gardener: TOKEN_GARDENER,
  tiger: TOKEN_TIGER,
  folio: TOKEN_FOLIO,
  timber: TOKEN_BEAVER,
};
