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
  entrance: ["Strange place. Show me your strongest.", "Someone strong lives here. Is it you?", "Passing through. Make it worth it."],
  move: ["Hm.", "Is that all?", "Go on."],
  capture: ["Taken. Next.", "That's the best this world has?", "You left it open."],
  hurt: ["Not bad. For this place.", "Hm. A spark of something."],
  strike: ["Down."],
  thinking: ["Even the air is wrong here.", "Something strong hides here.", "My way home is past the best."],
  check: ["Check. I expected more.", "Check. Is this your best?"],
  smug: ["Back home, children play better.", "This is the strength of your world?"],
  rattled: ["Wait. That was real skill.", "So this world has teeth after all."],
  power: ["Fire, then ice.", "Burn, and freeze."],
  powerHit: ["Frozen. Then gone.", "Hold still."],
  ultimateWarn: ["Enough. Let me show you my world."],
  ultimate: ["Twin blades. One end."],
  victory: ["Not you, then. I'll keep looking.", "Still not the one I came for.", "You were only a step toward home."],
  defeat: ["So the strength I felt was you.", "Hm. This world isn't so small after all."],
};

/**
 * His entrance on a Battle Tower floor of his own (Eric, Nov 27: "he walks out and the first thing he says is like 'you must be pretty
 * strong to have gotten this far' or something. And then he says something cool, and then the fight starts"): out of the elevator, the
 * first, then the second, then his blades (town/shops/tower-floor.ts STRANGER_ENTRANCE). The floor room's alone, never a battle's beat.
 */
export const STRANGER_FLOOR_LINES = ["You climbed this far. You must be strong.", "I crossed worlds for a real fight. Be one."] as const;
