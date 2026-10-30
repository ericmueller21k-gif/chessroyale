# Boss art: sidekick-sawyer

- Model claude-sonnet-5-5, effort xhigh, adaptive thinking. 52 turns, 52 renders.
- Spend: **$4.22** of the $20 cap (106 input, 351,849 cache-write, 9,692,783 cache-read, 139,988 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/sidekick-sawyer/sidekick-sawyer.ts.
- Previews: scripts/boss-art/out/sidekick-sawyer/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/sidekick-sawyer/looks/.

## Its notes

The drawing is `scripts/boss-art/out/sidekick-sawyer/sidekick-sawyer.ts`, a 64x64 frame with feet at (30, 61), exported as `sidekickSawyer` with id "sidekick-sawyer". I rendered every animation at up to 6x (the render cap). None has edge-pixel warnings, and I checked the idle at phone size beside Sawyer and the tiger.

The kit is a big-headed raccoon in Sawyer's own palette: warm gray-brown fur, a soft black mask, big shiny brown eyes, a small closed-mouth smile and a pink ear under the brim. It has a striped tail, white gloves and a yellow hard hat far too big for it. The toy saw has a red grip, a wooden blade and a chunky serrated edge, so it echoes Sawyer's red saw.

Animations, beat by beat:
- **idle** (3 s, loops): it breathes, blinks twice, flicks an ear and swishes its tail, then glances ahead. The hat slides down over its eyes and the saw bumps it back up with a little wobble.
- **walk** (0.6 s, loops): two bouncy steps with head bob, tail swing, saw bounce, hat bob and a "step" cue on each footfall.
- **sit** (3.2 s, loops): on a stool, legs dangling and swinging, saw across its lap, head leaning in to think, slow blinks and an ear flick.
- **wave** (1.2 s, once): a happy squint, the saw goes up and waves left-right-left, the hat wobbles, a twinkle pops, then it settles on the idle frame-0 pose.
- **entrance**: a shadow grows, it drops in and lands in a puff of dust, the hat slips over its eyes, it pokes the hat up with the saw, then waves the saw ta-da.
- **thinking** (loops): head tipped back, eyes rolled up, a foot tapping, the hat sliding, and thought bubbles growing to a "…" cloud.
- **move**: a crouch, a hop toward the board, a saw flick with a few sawdust chips, then it settles.
- **capture**: two excited hops with the saw waving high, the hat bouncing, twinkles and dust.
- **hurt**: flash and shake, the hat knocked over its eyes, a sweat drop; then it pokes the hat up, blinks and grins.
- **check**: two sharp saw jabs at the board with a sawdust flick, then a smug finish.
- **smug** (loops): half-lidded eyes, a smirk and a slow nod with the hat pushed back.
- **rattled** (loops): wide eyes, trembling, drooping ears, flying sweat and a loose hat.
- **defeat**: flash, dizzy stars, it drops the saw, the hat flops over its face and it plops on its bottom. The last frame holds for 1 s.
- **victory** (loops): jumping for joy with the saw high, the hat flying off the head, confetti and twinkles.

Choices you might want to change:
- **Size:** about 41 px tall including the hat, roughly 65-70% of Sawyer at phone size. I kept the big head and shrank the body and legs. Shrinking further would mean a smaller head.
- **Eyes:** warm brown with white shines, not white-ringed. Dark eyes would vanish in the black mask. Surprise and rattled faces use white eyes.
- **Hat gag:** the toy saw is also what pushes the hat back up. There is no second arm.
- **Far ear:** only the near ear shows, because the big hat covers the far one.
- **Defeat pose:** a plop on its bottom with the hat over its face and the saw dropped beside it, not a flop on its back.
- **Cues:** only "step" (landings and footfalls) and "poof" (hurt and defeat). If you want sound on the saw, add cues on the wave, jab and poke frames.
