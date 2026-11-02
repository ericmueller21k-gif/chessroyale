# Boss art (rider trail): cheetah-shoes

- Model claude-opus-5-5, effort medium, adaptive thinking. 3 turns, 2 renders.
- Spend: **$0.23** of the $0.75 cap (8 input, 31,564 cache-write, 51,492 cache-read, 3,294 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/cheetah-shoes/cheetah-shoes.tsx.
- The trail: its mark {"frames":4,"lifeMs":450,"every":1,"w":36,"h":24,"drawn":"38 x 28 units at most"}; nothing taken out of its frames, the rest of every frame unchanged.
- Previews: scripts/boss-art/out/cheetah-shoes/preview/idle.png, scripts/boss-art/out/cheetah-shoes/preview/move.png, scripts/boss-art/out/cheetah-shoes/preview/look.png, scripts/boss-art/out/cheetah-shoes/preview/front-idle.png, scripts/boss-art/out/cheetah-shoes/preview/front-move.png, scripts/boss-art/out/cheetah-shoes/preview/back-idle.png, scripts/boss-art/out/cheetah-shoes/preview/back-move.png, scripts/boss-art/out/cheetah-shoes/preview/views.png, scripts/boss-art/out/cheetah-shoes/preview/trail.png, scripts/boss-art/out/cheetah-shoes/preview/ride.gif. Each look it took: scripts/boss-art/out/cheetah-shoes/looks/.

## Its notes

I added the trail mark: little dusty skid streaks, as the brief asked. I left the ride's own frames as they were, since nothing in them stays behind. The last trail render reported the mark spilling past its box, so I widened the box to 36 × 24 (the limit is 40 × 30) but didn't render again after that, so that fix is unchecked. Also, done didn't run its before-and-after frame check, so there's no confirmation of that either.

**The mark (SkidMark):** three short, parallel tan streaks (#e6c48c) with a dark brown edge (#6b4e2c), and a cluster of three dust puffs at their back end. It's about 28 × 8 units drawn, flattened to suit the town's angle. The colors are fixed; it doesn't take the item's color.
- **Life:** 4 frames, 110, 110, 120 and 110 ms (450 ms in all), one mark on every square it leaves.
- **Frame 0:** sharp streaks, small puffs.
- **Frame 1:** the streaks get a bit thicker, the puffs grow and the mark drops to 85% opacity.
- **Frame 2:** each streak breaks into two dashes and the puffs drift apart (60%).
- **Frame 3:** only scattered specks and small puffs are left (30%), then it's gone.
- **Which way:** side marks are horizontal with the puffs at the back (left when running right; the town mirrors it for runs to the left). Up and down marks are vertical, with the puffs at the bottom going up and at the top going down. Every other mark is shifted 1.5 units, so a run doesn't look stamped.

**Taken out:** nothing. The speed lines and dust puffs in the side, front and back runs all move along with the ride; none of it stays on the ground.

**What you might want to change:**
- **Readability:** at town size it reads well on the dark squares but is fairly faint on the light ones. The edge could be darker or the streaks thicker.
- **Vertical marks:** they're scaled to 80%, so they look a little narrow on runs up and down.
- **Size:** the box is wider than the brief's 24 × 10, because the puffs drift outward as the mark fades.
