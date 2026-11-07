/**
 * Alfil's intro (Nov 2), as data (shops/timeline.ts): after his line and a pause, the sand pyramid rises between you, holds, cracks
 * and crumbles; from its crumble's clear frame (the art's "table" cue) his table and board are there, its stools, and you both hop back
 * clear of them; the crumble's last frame (a low drift of sand) lies over the table's foot until the storm; the table alone a beat,
 * his attack, his sandstorm. Every cue is on the art's frames (rumble, crack, crumble, table).
 */
import { CHALLENGE_FEEL } from "../challenge.ts";
import { INTRO_ALFIL_FRONT, INTRO_ALFIL_PYRAMID, INTRO_ALFIL_STORM, INTRO_ALFIL_TABLE, INTRO_ALFIL_TABLE_PALETTE } from "../alfil-intro-art.ts";
import { clipsOf, defineIntro, frameStart } from "../timeline.ts";
import { faceBeat, hopBack, lenOf, lineBeat, pauseBeat, swingBeat, tableBeat, tableIn } from "./common.ts";

const P = clipsOf(INTRO_ALFIL_PYRAMID);
const clear = frameStart(P.crumble!, "table");

export const ALFIL_INTRO = defineIntro({
  props: { table: {}, board: {}, pyramid: { ch: INTRO_ALFIL_PYRAMID } },
  table: INTRO_ALFIL_TABLE,
  palette: INTRO_ALFIL_TABLE_PALETTE,
  storm: { tile: INTRO_ALFIL_STORM, front: INTRO_ALFIL_FRONT },
  beats: [
    faceBeat(),
    lineBeat(),
    pauseBeat(),
    { step: "rise", ms: lenOf(P.rise), acts: [{ actor: "pyramid", play: "rise" }] },
    { step: "idle", ms: CHALLENGE_FEEL.holdMs, acts: [{ actor: "pyramid", play: "idle", loop: true }] },
    { step: "crack", ms: lenOf(P.crack), acts: [{ actor: "pyramid", play: "crack" }] },
    { step: "crumble", ms: lenOf(P.crumble), acts: [{ actor: "pyramid", play: "crumble" }, ...tableIn(clear), ...hopBack(clear)] },
    tableBeat(),
    swingBeat(),
  ],
  // (The test hook's: the pyramid while it plays, none once it has crumbled to its drift.)
  view: (c) => ({ pyramid: c.pyramid?.on && !(c.pyramid.anim === "crumble" && c.pyramid.ended) ? { anim: c.pyramid.anim, frame: c.pyramid.frame } : null }),
});
/** (Its intro as data, by its home: shops/intro.ts finds it by its file's name.) */
export default ALFIL_INTRO;
