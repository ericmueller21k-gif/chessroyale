/**
 * Smudgy's intro (Nov 6), as data (shops/timeline.ts): his round table under its drop cloth stands there from the walk in (its stools
 * in its picture), in the room's table's place; on the marks a beat, his line, a pause; he whips the cloth off (up, over him, down in a
 * heap: the art's whoosh and flop), the board on the table from the whip's WHIP_BOARD_FRAME; a beat, his reveal line, a beat; then
 * the splatter (smudgy-splatter.ts). No attack: the splatter is his. Seated (challenge.ts BOSS_INTROS): nobody moves.
 */
import { CHALLENGE_FEEL } from "../challenge.ts";
import { INTRO_SMUDGY_CLOTH, INTRO_SMUDGY_TABLE, INTRO_SMUDGY_TABLE_PALETTE, WHIP_BOARD_FRAME } from "../smudgy-intro-art.ts";
import { clipsOf, defineIntro, frameStart } from "../timeline.ts";
import { faceBeat, lenOf, lineBeat, pauseBeat } from "./common.ts";

const K = CHALLENGE_FEEL.smudgy;
const W = clipsOf(INTRO_SMUDGY_CLOTH).whip!;

export const SMUDGY_INTRO = defineIntro({
  props: { table: {}, board: {}, cloth: { ch: INTRO_SMUDGY_CLOTH } },
  table: INTRO_SMUDGY_TABLE,
  palette: INTRO_SMUDGY_TABLE_PALETTE,
  splatter: true,
  noAttack: true,
  stands: ["table"],
  cast: [{ actor: "table", show: true }, { actor: "cloth", play: "covered", frame: 0 }],
  beats: [
    faceBeat(),
    lineBeat(K.lineMs),
    pauseBeat(K.grabMs),
    { step: "whip", ms: lenOf(W), acts: [{ actor: "cloth", play: "whip" }, { actor: "board", at: frameStart(W, WHIP_BOARD_FRAME), show: true }] },
    { step: "reveal", ms: K.revealLeadMs + K.revealMs + K.afterMs, acts: [{ actor: "cloth", play: "heap", frame: 0 }, { actor: "chant", at: K.revealLeadMs, for: K.revealMs }] },
  ],
  view: (c) => ({ cloth: c.cloth?.on ? c.cloth.anim : null }),
});
