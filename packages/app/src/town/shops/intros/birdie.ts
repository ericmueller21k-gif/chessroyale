/**
 * Birdie's intro (Nov 23), as data (shops/timeline.ts): his station's middle table with its two stools is the battle spot, standing
 * there from the walk in (the art's table and stools as one picture, shops/birdie-art.ts SHOP_BIRDIE_TABLE, in their place). You both walk
 * on to your marks either side of it; a beat; he chirps his hello (his own, birdie-sounds.ts: Eric's ask for his challenge) as he says
 * his line; a pause; the board drops onto the white top with a pop; the table a beat; then the default flash and wipe (his train's toot).
 * No God King attack: his kit has none yet.
 */
import { CHALLENGE_FEEL } from "../challenge.ts";
import { SHOP_BIRDIE_TABLE } from "../birdie-art.ts";
import { defineIntro } from "../timeline.ts";
import { faceBeat, pauseBeat, tableBeat } from "./common.ts";

const F = CHALLENGE_FEEL;

export const BIRDIE_INTRO = defineIntro({
  props: { table: {}, board: {} },
  table: SHOP_BIRDIE_TABLE,
  noAttack: true,
  stands: ["match-table", "table-stool", "table-feeder"],
  cast: [{ actor: "table", show: true }],
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
