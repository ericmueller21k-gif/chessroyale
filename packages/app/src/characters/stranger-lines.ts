/**
 * The Stranger's lines (Nov 27; docs/decisions/2026-11-27-stranger-art.md): **placeholders for Eric**, short, in a calm, cold voice
 * (the anti-king: a wandering swordsman of fire and ice who wears a crown he took, not one he was given). His power's words come with
 * his rules job.
 *
 * - `entrance`: his challenge as the battle begins; `power`: his twin-tip cast, said as the tips meet; `powerHit`: a square struck.
 * - `ultimateWarn`, `ultimate`: kept short for whatever his rules make his ultimate.
 * - The rest are every boss's beats.
 */
import type { Beat } from "./boss-beats.ts";

export const STRANGER_LINES: Partial<Record<Beat, readonly string[]>> = {
  entrance: ["Kneel, or draw.", "A crown is only borrowed. I came to collect."],
  move: ["Hm.", "As expected.", "Go on."],
  capture: ["Cut down.", "One less.", "Too slow."],
  hurt: ["A scratch.", "Interesting."],
  strike: ["Fall."],
  thinking: ["Fire, or ice…", "Patience is a blade too."],
  check: ["Check. Your king trembles.", "Check. Where will you run?"],
  smug: ["You were never a match.", "Is this your crowd's best?"],
  rattled: ["Impossible…", "You… are no ordinary crowd."],
  power: ["Burn, and freeze.", "Fire and ice, as one."],
  powerHit: ["Frozen. Then ash.", "Hold still."],
  ultimateWarn: ["Enough. Watch closely."],
  ultimate: ["Twin blades. One end."],
  victory: ["Kneel.", "The crown stays with me."],
  defeat: ["So… this is defeat.", "Keep the crown… for now."],
};
