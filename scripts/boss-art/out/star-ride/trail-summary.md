# Boss art (rider trail): star-ride

- Model claude-opus-5-5, effort medium, adaptive thinking. 3 turns, 2 renders.
- Spend: **$0.22** of the $1.5 cap (8 input, 30,914 cache-write, 50,581 cache-read, 2,790 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/star-ride/star-ride.tsx.
- The trail: its mark {"frames":4,"lifeMs":600,"every":1,"w":30,"h":18,"drawn":"30 x 16 units at most"}; nothing taken out of its frames, the rest of every frame unchanged.
- Previews: scripts/boss-art/out/star-ride/preview/idle.png, scripts/boss-art/out/star-ride/preview/move.png, scripts/boss-art/out/star-ride/preview/look.png, scripts/boss-art/out/star-ride/preview/front-idle.png, scripts/boss-art/out/star-ride/preview/front-move.png, scripts/boss-art/out/star-ride/preview/back-idle.png, scripts/boss-art/out/star-ride/preview/back-move.png, scripts/boss-art/out/star-ride/preview/views.png, scripts/boss-art/out/star-ride/preview/trail.png, scripts/boss-art/out/star-ride/preview/ride.gif. Each look it took: scripts/boss-art/out/star-ride/looks/.

## Its notes

Moon's Ride now has its trail mark: a small cluster of sparkler sparks lying flat on the floor (squashed to 0.72). Its box is 30 × 18 units, a bit bigger than the brief's 24 × 14 so it shows on a 31 px square. Colors are fixed: pale gold, white and deeper gold, each with a thin dark outline.

How it fades, 600 ms in all (one mark on every square it leaves):
- **Frame 0 (160 ms):** three five-pointed sparks and three specks, at full brightness, with a small white glint on the biggest spark.
- **Frame 1 (150 ms):** the sparks shrink to 70% and fade to 85%.
- **Frame 2 (150 ms):** only the three specks are left, at 60%.
- **Frame 3 (140 ms):** nothing; it's gone.

It's the same in every direction. Every other mark (odd n) is mirrored left to right, so the run's marks don't look stamped.

Taken out of the ride's frames: nothing, as the brief says. The sparkler fizz at the back point goes along with the star, so the ride's code is unchanged. I only added the `trail` field and the TrailMark function after the ride's code; it reuses the existing sparkD star shape.

Choices you might want to change:
- **Town size:** in the town render the cluster reads, but it's subtle. Larger sparks or a box up to 40 × 30 would make it stand out more.
- **Last frame:** it's left empty, so about 0.45 s of the mark actually shows. If you'd rather it linger, frame 3 could keep one faint speck.
