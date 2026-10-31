# Boss art (rider trail): alfil-howdah

- Model claude-opus-5-5, effort medium, adaptive thinking. 4 turns, 3 renders.
- Spend: **$0.26** of the $1.5 cap (10 input, 35,961 cache-write, 87,386 cache-read, 3,244 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/alfil-howdah/alfil-howdah.tsx.
- The trail: its mark {"frames":3,"lifeMs":700,"every":1,"w":34,"h":24,"drawn":"36 x 24 units at most"}; nothing taken out of its frames, the rest of every frame unchanged.
- Previews: scripts/boss-art/out/alfil-howdah/preview/idle.png, scripts/boss-art/out/alfil-howdah/preview/move.png, scripts/boss-art/out/alfil-howdah/preview/look.png, scripts/boss-art/out/alfil-howdah/preview/front-idle.png, scripts/boss-art/out/alfil-howdah/preview/front-move.png, scripts/boss-art/out/alfil-howdah/preview/back-idle.png, scripts/boss-art/out/alfil-howdah/preview/back-move.png, scripts/boss-art/out/alfil-howdah/preview/views.png, scripts/boss-art/out/alfil-howdah/preview/trail.png, scripts/boss-art/out/alfil-howdah/preview/ride.gif. Each look it took: scripts/boss-art/out/alfil-howdah/looks/.

## Its notes

Alfil's Howdah now leaves a mammoth footprint on every square it leaves while it runs, and nothing at all while it stands.

The mark: one big round dark-brown print (#4a2c1a with a darker #2e1a0e rim). It has a darker hollow in the middle and four oval toenail dents in an arc along its front edge. It's flattened to the town's angle and about 30 × 16 units on the side, inside its 34 × 24 box. The colour is fixed, so it looks the same in every colour scheme.

How it fades (3 frames, 700 ms in all):
- Frame 0, 240 ms: pressed in, at 85% opacity.
- Frame 1, 230 ms: lighter, at 50%, and slightly smaller.
- Frame 2, 230 ms: faint, at 22%, and smaller again. Then it's gone.

Which way it points: the toe dents face the way it ran. That's right on the side (the town mirrors it for running left), up the screen for the back view and down for the front view. Prints take turns left and right by the mark number: 3 units across the run on the side, and 6 units side to side on the front and back runs.

Taken out of the ride's frames: nothing. No view, idle or move, leaves anything behind. The ride's own code is unchanged; I only added the trail field and the Mark function.

Choices you might want to change:
- Each square gets a single print, not a pair.
- At town size the toe dents are only a few pixels, but they still show which way it went on both the light and dark squares.
- The fade could be shortened toward the droplets' 520 ms if three prints behind it feel like too many.
