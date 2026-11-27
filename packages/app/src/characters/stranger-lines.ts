/**
 * The Stranger's lines (Eric, Nov 27): he's from another world and wants to get home (said plainly, never whining); this world's
 * chess is beneath him, so he's hunting its strongest player, and he can sense someone strong hidden here (never named). Chess is
 * chess everywhere: no line says it's played differently here. Calm, short, unamused.
 *
 * - `entrance`: his challenge as the battle begins; `power`: his twin-tip cast, said as the tips meet; `powerHit`: a square struck.
 * - `ultimateWarn`, `ultimate`: kept short for whatever his rules make his ultimate.
 * - The rest are every boss's beats.
 */
import type { Beat } from "./boss-beats.ts";

export const STRANGER_LINES: Partial<Record<Beat, readonly string[]>> = {
  entrance: ["Strange place. Show me your strongest.", "I heard someone strong lives here. Is it you?", "I'm only passing through. Make it worth it."],
  move: ["Hm.", "Is that all?", "Go on."],
  capture: ["Taken. Next.", "That's the best this world has?", "You left it open."],
  hurt: ["Not bad. For this place.", "Hm. A spark of something."],
  strike: ["Down."],
  thinking: ["Even the air is wrong here.", "Something strong hides here. I can feel it.", "The way home is through the strongest."],
  check: ["Check. I expected more.", "Check. Is this your best?"],
  smug: ["Where I'm from, children play better.", "This is the strength of your world?"],
  rattled: ["Wait. That was real skill.", "So this world has teeth after all."],
  power: ["Fire, then ice.", "Burn, and freeze."],
  powerHit: ["Frozen. Then gone.", "Hold still."],
  ultimateWarn: ["Enough. Let me show you my world."],
  ultimate: ["Twin blades. One end."],
  victory: ["Not you, then. I'll keep looking.", "Still not the one I came for.", "Home is still far. You were only a step."],
  defeat: ["So the strength I felt was you.", "Hm. This world isn't so small after all."],
};
