# Boss art (rider trail): smudgy-brush

- Model claude-opus-5-5, effort medium, adaptive thinking. 15 turns, 1 renders.
- Spend: **$0.71** of the $1.5 cap (32 input, 57,296 cache-write, 624,664 cache-read, 15,052 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/smudgy-brush/smudgy-brush.tsx.
- The trail: its mark {"frames":4,"lifeMs":700,"every":1,"w":30,"h":24,"drawn":"28 x 21 units at most"}; taken out of 26 frame pictures (side idle 2 (red): 43 px; side idle 3 (red): 64 px; side idle 4 (red): 96 px; side idle 5 (red): 98 px; side idle 6 (red): 77 px; side move 0 (red): 276 px; …; preview/trail-check.png), the rest of every frame unchanged.
- Previews: scripts/boss-art/out/smudgy-brush/preview/idle.png, scripts/boss-art/out/smudgy-brush/preview/move.png, scripts/boss-art/out/smudgy-brush/preview/look.png, scripts/boss-art/out/smudgy-brush/preview/front-idle.png, scripts/boss-art/out/smudgy-brush/preview/front-move.png, scripts/boss-art/out/smudgy-brush/preview/back-idle.png, scripts/boss-art/out/smudgy-brush/preview/back-move.png, scripts/boss-art/out/smudgy-brush/preview/views.png, scripts/boss-art/out/smudgy-brush/preview/trail.png, scripts/boss-art/out/smudgy-brush/preview/ride.gif. Each look it took: scripts/boss-art/out/smudgy-brush/looks/.

## Its notes

Trail mark: paint dabs and a swipe, flat in the item's color (p.hex). Each has a darker edge (the color darkened by 50%) so it reads on light and dark floors. Box 30 × 24, one mark per square, 4 frames, 700 ms in all:
- Frame 0 (180 ms): wet. A tapered swipe and three round dabs, with a white gloss.
- Frame 1 (180 ms): drying matte, opacity 0.88.
- Frame 2 (180 ms): breaking up. The swipe splits in two and the dabs shrink, opacity 0.62.
- Frame 3 (160 ms): specks at opacity 0.32.

Which way: the swipe lies along the run and thins toward where the brush went (right on the side, which the town mirrors for left; up for back; down for front). The dabs are the same every way.

Taken out:
- Side: the move's color ribbon and the idle wisp (frames 2–6), switched off.
- Front: the stroke behind the pawn (move) and the idle wisp. A thin rim of the stroke is kept right at the tuft's edge, so its outline isn't changed.
- Back: kept as it was. Its little ribbon and wisp lie entirely over the bristle end and its shadow, so they read as paint on the brush going along with it, and removing them would change the tips.

Choices you might want to change:
- The swipe's thin end leads. It could be flipped.
- On midnight the dark edge barely shows on the dark squares.
- The life is 700 ms, a little longer than the droplets' 520 ms.
- The back view's on-tuft streak could be redrawn as part of the tips if you want it gone too.
