# Boss art (rider trail): birdie-train-ride

- Model claude-opus-5-5, effort medium, adaptive thinking. 4 turns, 1 renders.
- Spend: **$0.24** of the $1.5 cap (10 input, 34,404 cache-write, 85,842 cache-read, 2,341 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/birdie-train-ride/birdie-train-ride.tsx.
- The trail: its mark {"frames":3,"lifeMs":450,"every":1,"w":30,"h":24,"drawn":"28 x 21 units at most"}; nothing taken out of its frames, the rest of every frame unchanged.
- Previews: scripts/boss-art/out/birdie-train-ride/preview/idle.png, scripts/boss-art/out/birdie-train-ride/preview/move.png, scripts/boss-art/out/birdie-train-ride/preview/look.png, scripts/boss-art/out/birdie-train-ride/preview/front-idle.png, scripts/boss-art/out/birdie-train-ride/preview/front-move.png, scripts/boss-art/out/birdie-train-ride/preview/back-idle.png, scripts/boss-art/out/birdie-train-ride/preview/back-move.png, scripts/boss-art/out/birdie-train-ride/preview/views.png, scripts/boss-art/out/birdie-train-ride/preview/trail.png, scripts/boss-art/out/birdie-train-ride/preview/ride.gif. Each look it took: scripts/boss-art/out/birdie-train-ride/looks/.

## Its notes

Birdie's Train now leaves a pair of small rail ties behind it as it runs. They're drawn in fixed colours: dark brown-grey bars (#4a3f3a) with a thin dark outline and a lighter edge (#8a7b70) on each bar. They read on both the light tan and the dark brown squares at town size, and look the same in every item colour.

**The mark (box 30 × 24, one on every square it leaves, 3 frames × 150 ms = 450 ms):**
- **Frame 0:** sharp, at full strength.
- **Frame 1:** 60% opacity and scaled to 0.92.
- **Frame 2:** 28% opacity and scaled to 0.84. After that it's gone.

**Which way it points:** the ties lie across the way the train ran.
- **Running right or left:** two upright bars, each 5.5 wide and 19 tall, side by side 14 apart along the path. The town mirrors them for left.
- **Running up or down (back or front view):** two flat bars, each 26 wide and 5 tall, one above the other.

**Taken out of the ride's frames:** nothing. I found nothing left behind in any view, idle or move. The stack puff rises and fades while staying with the train, so it stays as it was. The front and back views' ground shadow also moves with the train. The ride's code is unchanged: the only edits are the `trail` field, the TieMark function and an extra type in the import line.

**Choices you might want to change:**
- **The side box is taller than the brief's size.** The side ties are 19 tall, so the box is 30 × 24 rather than about 30 × 12. Fitting 12 would mean making those upright bars shorter.
- **The marks are small at town size.** They read, but the bars could be made bigger if you want them to show more.
- **The fade is gentle.** The last frame is still faint at 28% opacity rather than nearly invisible.
