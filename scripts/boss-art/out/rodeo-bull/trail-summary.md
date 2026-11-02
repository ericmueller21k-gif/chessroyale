# Boss art (rider trail): rodeo-bull

- Model claude-opus-5-5, effort medium, adaptive thinking. 5 turns, 2 renders.
- Spend: **$0.35** of the $1.5 cap (12 input, 45,590 cache-write, 148,448 cache-read, 4,485 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/rodeo-bull/rodeo-bull.tsx.
- The trail: its mark {"frames":4,"lifeMs":650,"every":1,"w":26,"h":22,"drawn":"27 x 19 units at most"}; nothing taken out of its frames, the rest of every frame unchanged.
- Previews: scripts/boss-art/out/rodeo-bull/preview/idle.png, scripts/boss-art/out/rodeo-bull/preview/move.png, scripts/boss-art/out/rodeo-bull/preview/look.png, scripts/boss-art/out/rodeo-bull/preview/front-idle.png, scripts/boss-art/out/rodeo-bull/preview/front-move.png, scripts/boss-art/out/rodeo-bull/preview/back-idle.png, scripts/boss-art/out/rodeo-bull/preview/back-move.png, scripts/boss-art/out/rodeo-bull/preview/views.png, scripts/boss-art/out/rodeo-bull/preview/trail.png, scripts/boss-art/out/rodeo-bull/preview/ride.gif. Each look it took: scripts/boss-art/out/rodeo-bull/looks/.

## Its notes

Rodeo Bull now has its trail mark: a pair of dark brown cloven hoofprints with a small, flat pale tan dust puff beside them. It's on the ride's `trail` (Mark: HoofMark). Its box is 26 × 22 units, the limit is 40 × 30, and the render gave no warnings.

**The mark, frame by frame** (four frames lasting 170, 160, 160 and 160 ms, 650 ms in all; one mark on every square it leaves):
- **Frame 0:** two crisp prints, one ahead of the other, and a small puff beside them, slightly behind.
- **Frame 1:** the puff spreads out and thins (70% opacity); the prints are nearly full strength.
- **Frame 2:** the puff is wider and faint (35%); the prints lighten to about half.
- **Frame 3:** the puff is gone and only ghost prints remain (about 20%). After that the mark disappears.

**Which way it points:**
- The prints point the way the bull ran: right on the side view (the town mirrors this for left), up the screen on the back view and down on the front view.
- They're flattened 0.9 to match the town's angle.
- Each mark puts its prints and puff on the opposite side to the one before (`n` odd or even), so a run reads as left and right hooves in turn.

**Colors:** all fixed. The prints are dark brown (#4a2e1c) with a darker rim, and the puff is pale tan (#e6d3ad) with a thin brown outline so it shows on the light squares. The mark doesn't take the item's color.

**Taken out of the ride's frames:** nothing, and no other change to the ride. I checked every view's idle and move. The idle hoof-scrape dust, the landing dust, the steam puffs and the buck all stay with the bull, so none of it counts as left behind.

**Choices you might want to change:**
- At town size (a 31 px square) the prints are small, a few pixels each. They read as hoofprints on both the light and dark squares, but you could make them bigger: the box has room up to 40 × 30.
- The puff is quite faint on the light tan squares.
