/**
 * Babur's, the circus tiger's, lines (the director's draft, Oct 24, used as written: scratchpad tiger/lines.md). A circus tiger who
 * hated the roaring and the burning hoops and only wants to make balloon animals: bored, dry, a little sour about the circus, proud and
 * soft about his balloons; never mean, never scary. None says his name (TIGER_NAME in core boss.ts is one constant). "…" is the
 * ellipsis character, as the other bosses' lines.
 *
 * Each set is the beat with the same meaning in his kit (kits.ts): `place` (a new balloon on the pump), `cheer` (a balloon landed as
 * a piece: the rules' `balloonCheer`), `bigCheer` (a real queen landed: `balloonBigCheer`) and `wince` (a balloon popped) are said from
 * the screen as they play (components/Tiger.tsx); `ultimate` as the hoops are thrown. The draft's line for a move a hoop refuses
 * ("Nobody goes through my hoops. Not anymore.") isn't here: the kit has no such beat, and none was added (the brief).
 */
import type { Beat } from "./boss-beats.ts";

export const TIGER_LINES: Partial<Record<Beat, readonly string[]>> = {
  entrance: ["Ugh. Another crowd.", "No roaring tonight. Balloons only.", "Step right up. Or don't. I'm on break."],
  place: ["Let's see what this one wants to be.", "Just a little air…", "Shh. Creative process."],
  move: ["Fine. I'll move.", "Padding along.", "Quietly now.", "No leaping. I'm retired."],
  capture: ["Pop goes your piece.", "That one didn't make the show.", "Swat."],
  hurt: ["Hey! Watch the whiskers.", "Rude. I was concentrating.", "That's coming out of your ticket."],
  strike: ["Swat!", "Claws out. Just this once."],
  thinking: ["Thinking. Please hold your applause.", "Don't rush the artist."],
  check: ["Check. Ta-da.", "Check. The crowd goes mild."],
  smug: ["Now that's showmanship.", "Balloon artist. Chess genius. Same paws."],
  rattled: ["This was not in the act!", "Somebody get the ringmaster!"],
  ultimateWarn: ["Oh no. Not the hoops.", "I swore I'd never do this again…"],
  ultimate: ["Fine! The hoops! Happy now?", "One last show. Burning hoops!", "Through the hoops, everybody!"],
  cheer: ["Ta-da! Fresh from the pump.", "Balloon art. Very serious.", "Another masterpiece."],
  bigCheer: ["A queen! My finest work!", "Look at her! She's perfect!"],
  wince: ["…I meant to do that.", "Too much air. Again.", "That one was a rough draft."],
  victory: ["Show's over. Exit through the gift shop.", "Bow. Curtain. Nap."],
  defeat: ["Back to the circus, I guess…", "My balloons… all of them…"],
  kingAttack: ["A balloon for your majesty. And another.", "Bonk! Bonk! Bonk!", "Hold still. This one's a crown."],
};

/**
 * How often each moment speaks: Puddles', plus a new balloon on the pump rarely (one comes about every two minutes), a landing and a
 * pop often, a real queen and the hoops always. (Puddles' seeds and watering have no counterpart here.)
 */
export const TIGER_CHANCE: Partial<Record<Beat, number>> = {
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
  place: 0.15,
  cheer: 0.6,
  bigCheer: 1,
  wince: 0.6,
};
