/**
 * Don Dough's intro (Nov 11), as data (shops/timeline.ts), played at his back room's table: met inside (`inPlace`: he's seated at its
 * head from the start, you walk to its foot from where you talked to him), the room's own table and the game's board on its roll-up
 * board from the first frame. On the marks a beat; his line ("Hope you studied. Pop!"); his `breadPop` (Eric: "he pulls out his bread
 * and holds it like a rifle, and he just pretends to shoot it at you, and you just hear like a little pop, and then he just starts
 * laughing"); a beat; the default flash and wipe. No God King attack. His moves and his figure are his art's (shops/zebra-don.ts, a copy
 * of the art branch's until his boss lands: its round may point this at the boss's own file). Played only once his boss is in the game
 * (shops.ts canChallengeInside): until then his card's Challenge says "Coming soon".
 */
import { CHALLENGE_FEEL } from "../challenge.ts";
import { BOSS_ZEBRA } from "../zebra-don.ts";
import { clipsOf, defineIntro } from "../timeline.ts";
import { faceBeat, lenOf } from "./common.ts";

const F = CHALLENGE_FEEL;
const M = clipsOf(BOSS_ZEBRA);

export const ZEBRA_INTRO = defineIntro({
  props: { board: {} },
  mover: BOSS_ZEBRA,
  figure: BOSS_ZEBRA,
  noAttack: true,
  // (He's in his wingback from the start; the board on the room's table.)
  cast: [{ actor: "boss", play: "sitListen", loop: true }, { actor: "board", show: true }],
  beats: [
    faceBeat(),
    { step: "line", ms: F.lineMs, acts: [{ actor: "line", for: F.lineMs }, { actor: "boss", play: "sitTalk", loop: true }] },
    { step: "pop", ms: lenOf(M.breadPop), acts: [{ actor: "boss", play: "breadPop" }] },
    { step: "laugh", ms: F.afterLineMs, acts: [{ actor: "boss", play: "sitListen", loop: true }] },
  ],
  view: (c) => ({ move: c.boss?.on ? c.boss.anim : null }),
});
/** (Its intro as data, by its home: shops/intro.ts finds it by its file's name.) */
export default ZEBRA_INTRO;
