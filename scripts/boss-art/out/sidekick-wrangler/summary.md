# Boss art: sidekick-wrangler

- Model claude-sonnet-5-5, effort xhigh, adaptive thinking. 57 turns, 53 renders.
- Spend: **$5.66** of the $20 cap (116 input, 414,354 cache-write, 13,890,121 cache-read, 184,118 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/sidekick-wrangler/sidekick-wrangler.ts.
- Previews: scripts/boss-art/out/sidekick-wrangler/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/sidekick-wrangler/looks/.

## Its notes

File: scripts/boss-art/out/sidekick-wrangler/sidekick-wrangler.ts, exported as `sidekickWrangler` (id "sidekick-wrangler"). The frame is 60 x 52 with the feet at (25, 48). The piglet stands about 40 px with the hat, roughly 60-65% of Wrangler. The right side of the frame is spare room for the arm, hat tip and lasso. I looked at every animation at 3-6x and at phone size beside Wrangler. The last render of each showed no edge warnings, except idle and the other Wrangler-sidekick animations I did not re-render after the final face tweak, which were clean earlier. Nothing has been tested in the game itself.

The look: a baby-pink piglet with a big round head. It has big shiny eyes (no brows, no teeth), a round light snout, little pointy ears poking up beside the hat's crown, a round tummy, stubby legs and a curly tail. The hat is a size too big, with a gold star on the band. It also wears a small red bandana and carries a short toy rope coil, held in a hoof on the near side.

Animations (ms per frame):
- **idle** (30 x 100, 3 s, loops): it breathes with a 1 px bob and the rope sways. It blinks twice and wiggles its tail twice. Its ears flick. It tips the hat back (frames 17-23) and gives a small grin. A glint runs off the star (frames 14-15). It glances ahead at the end.
- **walk** (6 x 100, loops): the legs alternate in a bouncy trot, with a hop between steps. The head bobs, the hat wobbles, the tail wags, the ears flap and the rope swings. A `step` cue fires on the down frames.
- **sit** (16 x 200, loops): it sits on a stool with the rope set down on the floor, so the hoof rests on its lap. The legs dangle and swing, it blinks slowly, and it leans forward with eyes up as if thinking, with one ear flick.
- **wave** (11 frames, 1.24 s): it crouches and perks its ears. The far hoof rises to the brim, the hat tips back and up with a sparkle, then lowers. It settles into the exact idle pose. `hello` cue.
- **entrance** (12 frames, 1.3 s): the shadow grows. The piglet drops in and lands with a squash and dust, then rebounds. It tips its hat, twinkles, and ends on idle.
- **thinking** (12 x 150, loops): the head tips up with eyes rolled up. It pushes the hat back and scratches under it. One foot taps, the tail twitches, and thought bubbles grow from a dot to a cloud.
- **move** (7 frames): a crouch, then a hop toward the board with the arm out and the rope flicked (`flick` cue). Dust on landing, then it settles.
- **capture** (11 frames): two excited hops with a small lasso spinning above its raised hoof (`whirl` cue), twinkles, dust, then a smug finish.
- **hurt** (7 frames): a white flash and shake (`poof` cue). Its eyes squeeze shut, the hat is knocked crooked, the ears droop and a sweat drop flies. Then it wobbles, blinks and grins bravely.
- **check** (8 frames): two sharp flicks of a small rope loop at the board, then a smug finish (`flick` cue).
- **smug** (8 x 150, loops): chin up, half-lidded eyes, a smirk, a slow nod and the hat brim low.
- **rattled** (8 x 80, loops): wide eyes, a wavy mouth, drooping ears and sweat flying. It trembles with one hoof up.
- **defeat** (8 frames, last holds 1 s): hit flash, dizzy stagger with the hat flying up, then it plops onto its bottom. It sits with legs out, X eyes, the hat drooped over its face and stars wheeling, and the rope dropped beside it.
- **victory** (12 x 110, loops): hops for joy, waves the rope, pops the hat up and catches it, with confetti and twinkles.

Choices Eric might want to change:
- **Defeat pose:** I first tried keeling over onto its back. The huge head made that read as a pink blob, so it now slumps sitting up. That is easy to swap.
- **Hat tipping:** it uses the far hoof reaching up past the snout, which makes a long, stretchy arm. Wave, entrance and thinking all use it.
- **Sit:** the rope is set on the floor beside the stool, not in its lap.
- **Size:** if Wrangler's measured height is smaller than I assumed, the whole figure can shrink. The pose numbers sit in one place.
- **Cue names:** `step`, `hello`, `flick`, `whirl`, `poof` and `cheer` are placeholders for whatever sounds the sidekick gets.
