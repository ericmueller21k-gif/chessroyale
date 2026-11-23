/**
 * Big Boy's intro (Nov 2), as data (shops/timeline.ts): after his line and a pause, his toy blocks stack into the table (`build`); a
 * gap; the board drops onto the top block from `dropFrom` squares up over `boardDropMs` (his toss, "drop") and plops on (`plop`); a
 * gap; the stools drop in (`chairs`) and you both hop back clear of them; it all stands (`idle`); his attack; his lollipop swirl. The
 * blocks are the table and its stools: the board's slab rests on the top block. Every other cue is on the art's frames.
 */
import { CHALLENGE_FEEL } from "../challenge.ts";
import { INTRO_BIGBOY_BLOCKS, INTRO_BIGBOY_SWIRL, INTRO_BIGBOY_SWIRL_FRONT, INTRO_BIGBOY_TABLE_PALETTE } from "../bigboy-intro-art.ts";
import { clipsOf, defineIntro } from "../timeline.ts";
import { faceBeat, hopBack, lenOf, lineBeat, pauseBeat, swingBeat, tableBeat } from "./common.ts";

const F = CHALLENGE_FEEL;
const B = clipsOf(INTRO_BIGBOY_BLOCKS);

export const BIGBOY_INTRO = defineIntro({
  props: { blocks: { ch: INTRO_BIGBOY_BLOCKS }, board: { rest: true } },
  table: INTRO_BIGBOY_BLOCKS,
  palette: INTRO_BIGBOY_TABLE_PALETTE,
  storm: { tile: INTRO_BIGBOY_SWIRL, front: INTRO_BIGBOY_SWIRL_FRONT },
  beats: [
    faceBeat(),
    lineBeat(),
    pauseBeat(),
    { step: "build", ms: lenOf(B.build), acts: [{ actor: "blocks", play: "build" }] },
    pauseBeat(F.gapMs),
    { step: "drop", ms: F.boardDropMs, acts: [{ actor: "board", show: true, lift: { from: F.dropFrom, to: 0, ms: F.boardDropMs, ease: "in" } }, { cue: "drop" }] },
    { step: "plop", ms: lenOf(B.plop), acts: [{ actor: "blocks", play: "plop" }] },
    pauseBeat(F.gapMs),
    { step: "chairs", ms: lenOf(B.chairs), acts: [{ actor: "blocks", play: "chairs" }, { actor: "stools", show: true }, ...hopBack()] },
    tableBeat([{ actor: "blocks", play: "idle", frame: 0 }]),
    swingBeat(),
  ],
  view: (c) => ({ blocks: c.blocks?.on ? { anim: c.blocks.anim, frame: c.blocks.frame } : null, drop: c.board?.lift ?? 0 }),
});
/** (Its intro as data, by its home: shops/intro.ts finds it by its file's name.) */
export default BIGBOY_INTRO;
