/**
 * Puddles', the hippo gardener's, lines (the director's, Oct 21, used as written: scratchpad hippo/lines.md). A big, unhurried,
 * proud gardener: patient and warm, a little smug about his garden, never mean. None says his name (GARDENER_NAME in core
 * boss.ts is one constant, so nothing here needs an edit when it changes). "…" is the ellipsis character, as the other
 * bosses' lines.
 *
 * Each set is the beat with the same meaning in his kit (kits.ts): his powers' moments (`plantMany`, `plant`, `ultimate`,
 * `cheer`, `bigCheer`, `shrug`) say theirs from the screen (components/Gardener.tsx); `ownEaten` is said as a killer plant eats
 * one of his own pieces. The one line the director also wrote for a crowd move a plant refuses ("Keep off the grass.") isn't
 * here: the kit has no such beat, and none was added (the brief, Oct 23).
 */
import type { Beat } from "./boss-beats.ts";

export const GARDENER_LINES: Partial<Record<Beat, readonly string[]>> = {
  entrance: ["Mind the flower beds.", "Big feet, gentle hands. Wipe yours.", "Welcome to my garden. Stay as long as you like. Longer, ideally."],
  plantMany: ["A few seeds to start…", "Good soil here. Very good soil."],
  plant: ["Another one.", "Take your time. They grow either way.", "Plop."],
  move: ["Slow and steady.", "One step at a time.", "Easy does it.", "Patience."],
  capture: ["Weeded out.", "Pulled it up by the roots.", "That one was crowding the bed."],
  hurt: ["My petunias!", "Hey! I just watered that.", "Ouch. That'll leave a mark on the lawn."],
  strike: ["Spritz!", "Little drink for you!"],
  thinking: ["Hmm… let it grow.", "Good things take time."],
  check: ["Check. Feeling the heat?", "Check. Nowhere to plant your feet."],
  smug: ["Everything's coming up roses.", "Green thumb. Both of them."],
  rattled: ["Somebody's trampling my garden!", "This was not in the seed catalog."],
  ultimateWarn: ["Clouds are rolling in…", "Feels like rain."],
  ultimate: ["Watering time!", "Let's see what comes up!", "Drink up, little ones!"],
  cheer: ["Look at that! A fine crop.", "Grown it myself!"],
  bigCheer: ["A queen! Prize of the county fair!", "Now that's what I call a harvest!"],
  shrug: ["Hm. Dry year.", "Next season."],
  ownEaten: ["Not that one! Bad plant!", "Well… it was hungry."],
  victory: ["Another fine harvest.", "Everything in its season."],
  defeat: ["Trampled… my whole garden…", "I'll replant. I always do."],
  kingAttack: ["Hold still, your majesty. You look thirsty.", "Spritz! Spritz! Spritz!", "A royal soaking!"],
};

/** How often each moment speaks: Moo's, plus the opening five seeds, the watering, its reactions and a killer plant's meal always, and the 30 s seed rarely (Moo's moon, flurry and daze have no counterpart here). */
export const GARDENER_CHANCE: Partial<Record<Beat, number>> = {
  entrance: 1,
  move: 0.12,
  capture: 0.6,
  check: 0.75,
  hurt: 0.6,
  thinking: 0.08,
  smug: 0.8,
  rattled: 0.8,
  defeat: 1,
  victory: 1,
  strike: 0.8,
  kingAttack: 1,
  ultimate: 1,
  plantMany: 1,
  plant: 0.15,
  cheer: 1,
  bigCheer: 1,
  shrug: 1,
  ownEaten: 1,
};
