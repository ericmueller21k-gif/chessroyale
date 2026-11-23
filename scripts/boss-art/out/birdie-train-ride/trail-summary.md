# Boss art (rider trail): birdie-train-ride

- Model claude-opus-5-5, effort medium, adaptive thinking. 3 turns, 1 renders.
- Spend: **$0.22** of the $1.5 cap (8 input, 33,977 cache-write, 53,355 cache-read, 2,178 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/birdie-train-ride/birdie-train-ride.tsx.
- The trail: its mark {"frames":3,"lifeMs":450,"every":1,"w":30,"h":14,"drawn":"28 x 13 units at most"}; nothing taken out of its frames, the rest of every frame unchanged.
- Previews: scripts/boss-art/out/birdie-train-ride/preview/idle.png, scripts/boss-art/out/birdie-train-ride/preview/move.png, scripts/boss-art/out/birdie-train-ride/preview/look.png, scripts/boss-art/out/birdie-train-ride/preview/front-idle.png, scripts/boss-art/out/birdie-train-ride/preview/front-move.png, scripts/boss-art/out/birdie-train-ride/preview/back-idle.png, scripts/boss-art/out/birdie-train-ride/preview/back-move.png, scripts/boss-art/out/birdie-train-ride/preview/views.png, scripts/boss-art/out/birdie-train-ride/preview/trail.png, scripts/boss-art/out/birdie-train-ride/preview/ride.gif. Each look it took: scripts/boss-art/out/birdie-train-ride/looks/.

## Its notes

Birdie's Train now has its trail mark: two short rail ties lying side by side across the way it ran. The ride's own frames are unchanged. I checked every frame in all three views, idle and move, and found nothing left behind to take out. The roof puff moves with the train in every view, so I kept it.

The mark:
- **Box:** 30 × 14 units, one mark on every square the train leaves.
- **Colors:** fixed for every item color. The ties are dark brown-grey (#4a3f38) with a thin dark outline and a lighter edge (#8a7a6c) on each bar.
- **Fade:** 3 frames of 150 ms each, 450 ms in all.
  - Frame 0: sharp, full size.
  - Frame 1: 55% opacity, at 88% size.
  - Frame 2: 20% opacity, at 76% size. Then it's gone.
- **Direction:**
  - Running right or left: two upright bars about 15 units apart, crossing the path. The lit edge is on their left, and the town mirrors it when running left.
  - Running up or down: two flat bars, 26 units wide, one above the other. The lit edge is on top.

At town size it reads on both light and dark squares, and it's the same in every color because its colors are fixed.

Choices you might want to change:
- The dark ties show less on the dark brown squares than on the light ones.
- The end-on marks (running up or down) are wider than the side ones, so they look like real ties under a track.
- The last frame is still faintly visible before the mark disappears.
