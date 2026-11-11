/**
 * Don Dough's intro (Nov 11), as data (shops/timeline.ts), played on his front room's pad (Eric: "The main room is still where you fight
 * … 4 of his goons who follow you in carry a chair and a board and a table"). You both come out of the back door and walk to where you
 * stand while his goons carry the table, the chairs and the board out and set them up (the room's: zebra-scene.ts SetupScene, drawn by
 * ShopRoom); on the marks a beat; a hold while the last of them step back to watch (SHOP_FEEL.zebra.setup.holdMs); his line ("Hope you
 * studied. Pop!"); his `breadPop` (Eric: "he pulls out his bread and holds it like a rifle … a little pop, and then he just starts
 * laughing"); a beat; the default flash and wipe. No God King attack. His moves and his figure are his art's (shops/zebra-don.ts, a copy
 * of the art branch's until his boss lands). Played only once his boss is in the game (shops.ts canChallengeInside).
 */
import { CHALLENGE_FEEL } from "../challenge.ts";
import { SHOP_FEEL } from "../../feel.ts";
import { BOSS_ZEBRA } from "../zebra-don.ts";
import { clipsOf, defineIntro } from "../timeline.ts";
import { faceBeat, lenOf, pauseBeat } from "./common.ts";

const F = CHALLENGE_FEEL;
const M = clipsOf(BOSS_ZEBRA);

export const ZEBRA_INTRO = defineIntro({
  props: {},
  mover: BOSS_ZEBRA,
  figure: BOSS_ZEBRA,
  noAttack: true,
  beats: [
    faceBeat(),
    { ...pauseBeat(SHOP_FEEL.zebra.setup.holdMs), step: "setup" },
    { step: "line", ms: F.lineMs, acts: [{ actor: "line", for: F.lineMs }] },
    { step: "pop", ms: lenOf(M.breadPop), acts: [{ actor: "boss", play: "breadPop" }] },
    { step: "laugh", ms: F.afterLineMs, acts: [{ actor: "boss", play: null }] },
  ],
  view: (c) => ({ move: c.boss?.on ? c.boss.anim : null }),
});
/** (Its intro as data, by its home: shops/intro.ts finds it by its file's name.) */
export default ZEBRA_INTRO;
