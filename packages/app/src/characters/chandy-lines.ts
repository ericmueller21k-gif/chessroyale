/**
 * Chandy's lines (Nov 16; docs/decisions/2026-11-16-chandy-rules.md): **placeholders for Eric**, short, in a calm sniper's voice (a
 * special-ops alligator who waits, watches and never misses). His banners' words are in components/Chandy.tsx (CHANDY_WORDS), placeholders too.
 *
 * - `entrance`: his challenge as the battle begins; `power`: a move of his meter's (scatter shot, beam, shields, rapid fire, the
 *   queen lock), said as he fires; `powerHit`: a lock snapping on (said now and then).
 * - `ultimateWarn`: Dodge's warning; `ultimate`: Dodge.
 * - The rest are every boss's beats.
 */
import type { Beat } from "./boss-beats.ts";

export const CHANDY_LINES: Partial<Record<Beat, readonly string[]>> = {
  entrance: ["You're already in my sights.", "Hold still. This won't take long."],
  move: ["Patience.", "Wind's still.", "Steady."],
  capture: ["Target down.", "Clean shot.", "Got it."],
  hurt: ["Hm. Missed that one.", "You moved. Rude."],
  strike: ["Clean shot."],
  thinking: ["Lining it up…", "Breathe in. Breathe out."],
  check: ["Check. In my sights.", "Check. Don't twitch."],
  smug: ["Never miss.", "Right where I wanted you."],
  rattled: ["Stay calm. Stay calm.", "Who taught you to hide like that?"],
  power: ["Upgrade online.", "Try this one.", "New toy."],
  powerHit: ["Locked.", "Got you marked."],
  ultimateWarn: ["Prepare yourself. You're in my sights."],
  ultimate: ["Dodge this."],
  victory: ["Never miss. Never.", "Target eliminated."],
  defeat: ["You moved too fast…", "Out of ammo."],
};

/**
 * His line as your mate is held for his Dodge (Eric, Nov 26: "he's says something like, I'm not I've got one last trick up my sleeve,
 * but something that's not that line"), in his speech box at his opening's `line` step (components/Chandy.tsx). The first is said;
 * the other two are Eric's to pick from (a placeholder, as his lines are).
 */
export const CHANDY_MATE_LINES = ["Mate? Negative. One shot left in the chamber.", "Pinned isn't finished. Final protocol: engage.", "Down, not out. A sniper always saves one round."] as const;
