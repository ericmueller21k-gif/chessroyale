# Boss art (rider trail): moon-ride

- Model claude-opus-5-5, effort medium, adaptive thinking. 9 turns, 2 renders.
- Spend: **$0.36** of the $1.5 cap (20 input, 38,579 cache-write, 245,361 cache-read, 6,083 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/moon-ride/moon-ride.tsx.
- The trail: its mark {"frames":4,"lifeMs":650,"every":1,"w":30,"h":18,"drawn":"29 x 17 units at most"}; taken out of 18 frame pictures (side move 0 (red): 144 px; side move 1 (red): 135 px; side move 2 (red): 181 px; side move 3 (red): 129 px; side move 4 (red): 147 px; side move 5 (red): 126 px; …; preview/trail-check.png), the rest of every frame unchanged.
- Previews: scripts/boss-art/out/moon-ride/preview/idle.png, scripts/boss-art/out/moon-ride/preview/move.png, scripts/boss-art/out/moon-ride/preview/look.png, scripts/boss-art/out/moon-ride/preview/front-idle.png, scripts/boss-art/out/moon-ride/preview/front-move.png, scripts/boss-art/out/moon-ride/preview/back-idle.png, scripts/boss-art/out/moon-ride/preview/back-move.png, scripts/boss-art/out/moon-ride/preview/views.png, scripts/boss-art/out/moon-ride/preview/trail.png, scripts/boss-art/out/moon-ride/preview/ride.gif. Each look it took: scripts/boss-art/out/moon-ride/looks/.

## Its notes

Moon's Ride now leaves a little dust of fading stars as its trail, and the sparkle trail is gone from its move frames in every view. The first check failed on the back view; I restored the two dots it flagged and called done again, but haven't re-rendered since.

**The trail mark** (box 30 × 18 units, one on every square it leaves, 4 frames, 650 ms in total):
- **Frame 0 (180 ms):** bright. Three flattened four-point stars, two pale gold (#ffe27a) and one white, plus three tiny specks. Each has a thin brown outline so it shows on the light squares.
- **Frame 1 (170 ms):** the stars twinkle down to about 60% size and a little fainter; the specks stay.
- **Frame 2 (160 ms):** specks only, at 60% opacity.
- **Frame 3 (140 ms):** gone.
- **Direction:** it's the same in every direction. Every second mark (odd n) has its scatter mirrored left to right, so the run doesn't look stamped. The colors are fixed and don't take the item's color.

**Taken out of the ride's move frames** (the idle twinkling stars are untouched in every view):
- **Side:** the three sparkles drifting back behind the tail, the two pale streaks and the two tiny dots.
- **Front:** the three sparkles drifting up behind the pawn and the two small dots.
- **Back:** the three sparkles dropping off the tips.

**Kept:** the back view's two tiny dots stay. The check counted them as part of the ride because they sit on the moon's belly, so removing them would change the ride itself.

**Choices you might want to change:**
- The box is 30 × 18 rather than the suggested 24 × 14. At the smaller size the stars were too faint to read at town size.
- At town size it reads as a small glint. It shows a bit more on the dark squares than on the light tan ones.
- The `ms` list sets how long the mark lasts if you'd like it to stay longer.
