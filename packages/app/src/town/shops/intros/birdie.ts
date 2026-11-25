/**
 * Birdie's intro (Nov 23; round 4 the same day), as data (shops/timeline.ts): his station's chess table with its two stools is the battle
 * spot, standing there from the walk in as his room has it (shops/birdie-art.ts SHOP_BIRDIE_TABLE, its flat top and board the renderer's,
 * no pieces: the "top" prop). You both walk on to your marks either side of it (the crossing gates come down and flash from there: the
 * room's `plays`); a beat; he chirps his hello (his own, birdie-sounds.ts: Eric's ask for his challenge) as he says his line; a pause;
 * the pieces pop onto the board; the table a beat; then the default flash and wipe (his train's toot). No God King attack: his kit has
 * none yet.
 */
import { CHALLENGE_FEEL } from "../challenge.ts";
import { SHOP_BIRDIE_TABLE, SHOP_BIRDIE_TABLE_PALETTE } from "../birdie-art.ts";
import { defineIntro } from "../timeline.ts";
import { faceBeat, pauseBeat, tableBeat } from "./common.ts";

const F = CHALLENGE_FEEL;

export const BIRDIE_INTRO = defineIntro({
  props: { table: {}, top: {}, board: {} },
  table: SHOP_BIRDIE_TABLE,
  palette: SHOP_BIRDIE_TABLE_PALETTE,
  noAttack: true,
  stands: ["match-table"],
  cast: [{ actor: "table", show: true }, { actor: "top", show: true }],
  beats: [
    faceBeat(),
    { step: "line", ms: F.lineMs, acts: [{ actor: "line", for: F.lineMs }, { cue: "hello" }] },
    pauseBeat(),
    { step: "board", ms: F.gapMs, acts: [{ actor: "board", show: true }, { cue: "table" }] },
    tableBeat(),
  ],
  view: (c) => ({ board: !!c.board?.on, table: !!c.table?.on }),
});
/** (Its intro as data, by its home: shops/intro.ts finds it by its file's name.) */
export default BIRDIE_INTRO;
