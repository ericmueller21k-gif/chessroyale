# Boss art: sidekick-boingo

- Model claude-sonnet-5-5, effort xhigh, adaptive thinking. 48 turns, 54 renders.
- Spend: **$6.02** of the $20 cap (98 input, 519,657 cache-write, 12,852,017 cache-read, 214,530 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/sidekick-boingo/sidekick-boingo.ts.
- Previews: scripts/boss-art/out/sidekick-boingo/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/sidekick-boingo/looks/.

## Its notes

The sidekick is done: `scripts/boss-art/out/sidekick-boingo/sidekick-boingo.ts`, exported as `sidekickBoingo`, id "sidekick-boingo". I looked at every animation at 3x to 8x. The idle, sit and face got the most checking, including on a light background, and the idle at phone size beside Boingo. Every frame renders with no edge warnings. I haven't type-checked the file or loaded it in the game.

**The look.** A big round peach head with big brown eyes and rosy cheeks. The red ball nose is its own outlined part, so it sticks out past the cheek. Red curly tufts either side of a small purple cone hat with a gold pompom. The suit is purple with red polka dots and gold pompom buttons, over a white ruff, red bloomers with frilly cuffs, and big floppy orange shoes. It holds a gold squirting flower on a green stem in one fist; the water is blue specks along an arc. The palette is Boingo's red, purple and gold, plus peach skin and blue water. It's about 42 px tall (Boingo is 64 on his pogo, so about two thirds). The frame is 56x55 with feet at (20, 52). That's smaller than Jefferson's sidekick, which is about 56 tall.

**Animations**
- **idle** (3 s): breathes and bobs, the pompom bobs, glances ahead at 0.4 s, blinks at 1.1 s and 2.7 s, and at 1.9 to 2.4 s the hand squeezes and the flower gives a tiny squirt while it giggles.
- **walk** (0.6 s): a bouncy waddle. The body sways, the head bobs, the shoes alternate, the arms swing and the flower bounces. Step cues on the two contact frames.
- **sit** (3.2 s, loops): on a stool, facing the board, with the flower resting on its knee. The shoes swing out of phase and it blinks slowly. About halfway through it tilts its head up and scratches its head, as if thinking about a move.
- **wave** (1.2 s, plays once): it squats a little, then waves its free hand left and right while the flower squirts a long arc to the right. It settles back to the idle pose.
- **entrance**: its shadow grows, it drops in, lands with a squash and dust, then does a ta-da with both arms up and a big squirt, and a small wave.
- **thinking**: head tipped up, eyes rolled up, scratching its head, a foot tapping, thought dots popping up.
- **move**: crouch, a hop toward the board pointing the flower arm, and a squirt arc.
- **capture**: two excited hops, arms up, laughing, a long squirt and twinkles.
- **hurt**: white flash, hat knocked off, the flower dribbles, then a brave grin.
- **check**: two sharp squirt jabs at the board, then smug.
- **smug**: half-closed eyes, a smirk, hands on hips, a slow nod.
- **rattled**: wide eyes, a frown, trembling, sweat flying.
- **defeat**: hit, dizzy x eyes, the hat flies off, it plops onto the ground with legs out, the flower wilts and dizzy stars circle. The last frame holds.
- **victory**: jumping with both arms up, long squirts, confetti.

**Choices you might change**
- **Flower in hand, not pinned.** I tried it pinned at the collar first. At this size it read as a gold badge, so I moved it onto a stem in the fist. That's the only way it stood out from the body and moved with the arms.
- **Size.** I made it smaller than Jefferson's sidekick to follow the "about 60% of Boingo at most" line; the file header explains it. It could be scaled back up a few px, but not by changing one constant.
- **Cue names.** The game has no sound for the new `squirt` cue (on idle, wave, move, capture, check, entrance and victory), so it needs one or a different name. `step` and `poof` are names other bosses already use.
- **Hat.** It's a small solid purple cone, not Boingo's harlequin diamonds, on purpose.
