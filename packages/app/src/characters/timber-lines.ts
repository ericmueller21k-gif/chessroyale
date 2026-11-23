/**
 * Timber's lines (Nov 1; docs/decisions/2026-11-01-timber.md): a cheerful, proud beaver builder, gruff when you get the
 * better of him, who loves wood and a job done right. Plain words, a little carpentry in them.
 *
 * - `power`: a piece of his dropped on the board (the rules' `build`); `cheer`, `bigCheer`: as it lands (a queen: the big one).
 * - `ultimateWarn`: the Gnaw's warning; `ultimate`: the Gnaw (`gnaw`); `gnawNone`: a Gnaw with none of your pawns to eat.
 * - The rest are every boss's beats.
 */
import type { Beat } from "./boss-beats.ts";

export const TIMBER_LINES: Partial<Record<Beat, readonly string[]>> = {
  entrance: ["Hard hats on. We're building today.", "Measure twice, checkmate once.", "Got wood? I've got plenty."],
  move: ["Square and level.", "Nice and plumb.", "Tap, tap. There."],
  capture: ["Into the scrap pile!", "That'll make good kindling.", "Scrap! Two more for the bench."],
  hurt: ["Hey! That was load-bearing!", "Splinters! Splinters everywhere!", "You knocked my hat crooked."],
  strike: ["Whack!", "Measure that!"],
  thinking: ["Hmm. Let me sight along it.", "Where does this plank go…"],
  check: ["Check. Built that myself.", "Check. Your king's on shaky ground."],
  smug: ["Built to last.", "Not a single crooked nail."],
  rattled: ["Who's knocking down my scaffolding?!", "This wasn't in the blueprints!"],
  power: ["Fresh off the bench!", "Hot off the workbench!", "One more for the crew."],
  cheer: ["Good wood, that.", "Square and solid."],
  bigCheer: ["A queen! My finest work!", "Twelve scraps of pure craftsmanship!"],
  ultimateWarn: ["I'm feeling peckish…", "My teeth itch."],
  ultimate: ["Chomp chomp chomp!", "Pawn wood. My favorite.", "Nom. Good grain."],
  gnawNone: ["No pawns? Hmph. I'll chew on my pencil.", "Nothing to gnaw. Rude."],
  victory: ["Job done. Clean up your sawdust.", "Built to win."],
  defeat: ["My hat… my tools… my whole workshop…", "Back to the drawing board."],
};

/** How often each moment speaks: every boss's beats, his drop and his Gnaw always. */
export const TIMBER_CHANCE: Partial<Record<Beat, number>> = {
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
  power: 1,
  cheer: 1,
  bigCheer: 1,
  ultimateWarn: 1,
  ultimate: 1,
  gnawNone: 1,
};
