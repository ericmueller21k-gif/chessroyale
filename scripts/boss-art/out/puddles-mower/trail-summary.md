# Boss art (rider trail): puddles-mower

- Model claude-opus-5-5, effort medium, adaptive thinking. 12 turns, 5 renders.
- Spend: **$0.48** of the $1.5 cap (26 input, 26,157 cache-write, 447,139 cache-read, 13,045 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/puddles-mower/puddles-mower.tsx.
- The trail: its mark {"frames":4,"lifeMs":700,"every":1,"w":38,"h":28,"drawn":"38 x 30 units at most"}; taken out of 24 frame pictures (side move 0 (red): 555 px; side move 1 (red): 604 px; side move 2 (red): 661 px; side move 3 (red): 752 px; side move 4 (red): 538 px; side move 5 (red): 613 px; …; preview/trail-check.png), the rest of every frame unchanged.
- Previews: scripts/boss-art/out/puddles-mower/preview/idle.png, scripts/boss-art/out/puddles-mower/preview/move.png, scripts/boss-art/out/puddles-mower/preview/look.png, scripts/boss-art/out/puddles-mower/preview/front-idle.png, scripts/boss-art/out/puddles-mower/preview/front-move.png, scripts/boss-art/out/puddles-mower/preview/back-idle.png, scripts/boss-art/out/puddles-mower/preview/back-move.png, scripts/boss-art/out/puddles-mower/preview/views.png, scripts/boss-art/out/puddles-mower/preview/trail.png, scripts/boss-art/out/puddles-mower/preview/ride.gif. Each look it took: scripts/boss-art/out/puddles-mower/looks/.

## Its notes

Trail mark: a strip of fresh-cut grass clippings. It's 14 small blades in a band about 30 × 9 units (box 38 × 28). They're fixed colours: lime, leaf green and a few dark-green blades, each with a thin dark-green outline. One mark lands on every square, and it lives for 700 ms over 4 frames (180/180/170/170): all the blades fresh and bright; about 70% left at 0.9 opacity; about 40% scattered at 0.7; two or three faint blades at 0.4, then gone. The strip lies along the way the mower ran: horizontal on the side view, vertical going up or down. Every other mark is mirrored across the strip.

Taken out: side move, all the clippings, and the exhaust puffs left behind (only the fresh puff at the pipe stays, at frames 0 and 4). Front and back moves: the clippings thrown out to the sides. They're clipped to the mower's own outline, so the edges stay exactly as before. The puffs that rise in place with the mower are kept. Nothing else changed.

Choices: at town size the mark is a small green squiggle, quieter on the dark squares. The outline is dark green rather than the house ink colour, to keep the lime bright.
