# Boss art: sidekick-ginger

- Model claude-sonnet-5-5, effort xhigh, adaptive thinking. 25 turns, 24 renders.
- Spend: **$2.33** of the $20 cap (52 input, 252,947 cache-write, 3,398,985 cache-read, 102,193 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/sidekick-ginger/sidekick-ginger.ts.
- Previews: scripts/boss-art/out/sidekick-ginger/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/sidekick-ginger/looks/.

## Its notes

The drawing is complete in scripts/boss-art/out/sidekick-ginger/sidekick-ginger.ts, exported as `sidekickGinger` with id "sidekick-ginger". I looked at every animation at 4x or more, and the idle at phone size beside Ginger. It reads at a glance as a small gingerbread kid in a candy-cane scarf, and it comes to about 62% of Ginger's body height. The render raised no edge warnings. Frame is 56x52 with feet at (27, 49).

The look: a big round head, big dark eyes with a shine, rosy cheeks and a small white icing smile, with a dollop of icing on top. The round little body has one red gumdrop button and a wavy icing hem. Arms and legs are stubby with icing cuffs. Colours are Ginger's browns and white icing. The scarf is a red-and-cream striped band with a short end hanging down the chest and two flying ends that ripple. There is no cane.

Beat by beat:
- **idle** (3 s): breathes, blinks twice, glances ahead for a moment, dollop nods, scarf ends flutter with a short gust, and a foot tap near the end.
- **walk** (0.6 s, 6 frames): a stiff, bouncy step. Feet alternate, the body bobs, the arms swing opposite the legs, the scarf streams back and the hanging end swings. A `step` cue fires on each foot-down.
- **sit** (3.2 s): on a stool, legs dangling and swinging, one hand on its lap and the other reaching toward the board. It blinks, then leans in with a raised-brow "thinking" face and a hand on its chin.
- **wave** (1.2 s, plays once): crouches, pops up and waves a stubby arm three times. The scarf flicks up and a twinkle appears. It then settles to the idle pose. A `hello` cue fires on the pop-up.
- **entrance**: a shadow grows, it drops in, squashes with a puff of dust, waves hello and settles. `step` and `hello` cues.
- **thinking** (loop): hand on chin, eyes rolled up, a foot tapping, three thought dots pop up one by one.
- **move**: crouch, hop toward the board (`hop` cue), point with a puff of dust and sprinkles, then settle.
- **capture**: two excited hops with arms up and sprinkles flying (`cheer` cue), ending on a smug pose.
- **hurt**: flash, a crumb chips off, eyes squeezed shut, a sweat drop, hands on cheeks. It then shakes it off with a brave grin (`poof` cue).
- **check**: an excited "wow" face with arms up and an exclamation mark, then two sharp points at the board with a hop (`ping` cues), ending smug.
- **smug** (loop): hands on hips, half-lidded eyes, a smirk, a slow nod and a foot tap.
- **rattled** (loop): wide eyes, worried brows, sweat flying, trembling, arms flapping up and to its cheeks, scarf whipping.
- **defeat**: hit with a flash and crumbs, dizzy X eyes, wobbles, arms flung up, then keels over onto its back with a bounce and dust. It lies face up with stars circling, and the last frame holds for 1 s (`poof` cues).
- **victory** (loop): jumps for joy, arms high, scarf up, sprinkles and twinkles.

Choices you might want to change:
- **Eyes:** dark with a white shine, like Jefferson's sidekick, rather than white icing eyes with pupils. I tried the white version first and it read as goofy "C" shapes. White-with-pupil is still used for the startled, wow and rolled-up looks.
- **Prop:** the scarf is the only prop, since the brief says no big cane. A tiny candy cane in one hand, like the giraffe's sparkler, would be easy to add if you want a closer copy-the-big-one link.
- **Size:** it is a bit smaller than Jefferson's giraffe (about 37 px tall in a 52 px frame) to honour the 60%-of-Ginger limit. The palette is Ginger's, including his frosty-blue icing shade.
- **Defeat:** it uses the same quarter-turn lie-down trick as Ginger. The lying pose leaves off the scarf's flying ends so they don't hang below the ground. It reads as a knocked-out cookie, but it is the least intuitive frame. A flop onto its tummy would be the alternative.
