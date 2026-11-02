# Boss art (rider trail): ginger-sled

- Model claude-opus-5-5, effort medium, adaptive thinking. 4 turns, 1 renders.
- Spend: **$0.25** of the $1.5 cap (10 input, 34,095 cache-write, 83,765 cache-read, 3,154 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/ginger-sled/ginger-sled.tsx.
- The trail: its mark {"frames":4,"lifeMs":650,"every":1,"w":34,"h":28,"drawn":"37 x 29 units at most"}; taken out of 30 frame pictures (side move 1 (red): 27 px; side move 2 (red): 158 px; side move 3 (red): 355 px; side move 4 (red): 389 px; side move 5 (red): 397 px; side move 6 (red): 394 px; …; preview/trail-check.png), the rest of every frame unchanged.
- Previews: scripts/boss-art/out/ginger-sled/preview/idle.png, scripts/boss-art/out/ginger-sled/preview/move.png, scripts/boss-art/out/ginger-sled/preview/look.png, scripts/boss-art/out/ginger-sled/preview/front-idle.png, scripts/boss-art/out/ginger-sled/preview/front-move.png, scripts/boss-art/out/ginger-sled/preview/back-idle.png, scripts/boss-art/out/ginger-sled/preview/back-move.png, scripts/boss-art/out/ginger-sled/preview/views.png, scripts/boss-art/out/ginger-sled/preview/trail.png, scripts/boss-art/out/ginger-sled/preview/ride.gif. Each look it took: scripts/boss-art/out/ginger-sled/looks/.

## Its notes

I gave the sled its trail mark: two pressed runner tracks with four tiny candy specks. I also took the trailing snow puffs out of its move in all three views. The trail render shows the mark reading at town size on light and dark squares, with no warnings. I didn't render the side, front or back moves again after the change; done's before-and-after frame check is the test that only the puffs went.

**The mark:** the box is 34 × 28 units and its colors are fixed (the same in every color scheme). Each track is a pale snow line (#eef2f6) with a darker blue-grey edge (#8f9aa6). The specks are candy red, white and mint, each with a thin dark outline.
- **Which way it points:** when the sled runs right or left, the two tracks run across the square, 9 units apart and 32 long. When it runs up or down, they run up the screen, 14 apart and 24 long.
- **Specks:** each mark has four, scattered between and beside the tracks. Every other mark (odd n) flips their layout, so the run doesn't look stamped.
- **Fade:** four frames, 160, 160, 160 and 170 ms, so each mark lasts 650 ms. One mark lands on every square the sled leaves.
  - Frame 0: crisp.
  - Frame 1: the tracks drop to 72% opacity; the specks stay almost full.
  - Frame 2: the tracks drop to 45%, and the specks shrink and fade to 40%.
  - Frame 3: only faint tracks are left (20%), with no specks; then the mark is gone.

**What I took out:**
- **Side view, move:** the snow puffs kicked up behind the runners that stayed where they landed. That loop in `Back` is now switched off (`if (false as boolean && …)`), so it draws nothing.
- **Front and back views, move:** the `EndPuffs` snow puffs beside the runners. I removed the two lines that drew them; the function is still in the file but unused.

Everything else is unchanged: the frost sparkles, the snowflake, the spray off the hooks at the stop (it moves with the sled), and all poses and timings. The only other code change is adding `TrailProps` to the import line.

**Choices you might want to change:**
- **Track spacing:** going up or down, the tracks are only 14 units apart, narrower than the sled's runners look end-on, so the mark stays compact.
- **Speck size:** the specks are tiny (radius 1.6), so at town size they read as a few dots of color rather than distinct candies.
