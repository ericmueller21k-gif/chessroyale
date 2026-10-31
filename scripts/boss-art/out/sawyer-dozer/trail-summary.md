# Boss art (rider trail): sawyer-dozer

- Model claude-opus-5-5, effort medium, adaptive thinking. 4 turns, 1 renders.
- Spend: **$0.16** of the $1.5 cap (10 input, 8,088 cache-write, 114,482 cache-read, 4,747 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/sawyer-dozer/sawyer-dozer.tsx.
- The trail: its mark {"frames":3,"lifeMs":720,"every":1,"w":34,"h":16,"drawn":"33 x 16 units at most"}; taken out of 14 frame pictures (side move 0 (red): 25 px; side move 1 (red): 32 px; side move 2 (red): 22 px; side move 4 (red): 24 px; side move 5 (red): 26 px; side move 6 (red): 21 px; …; preview/trail-check.png), the rest of every frame unchanged.
- Previews: scripts/boss-art/out/sawyer-dozer/preview/idle.png, scripts/boss-art/out/sawyer-dozer/preview/move.png, scripts/boss-art/out/sawyer-dozer/preview/look.png, scripts/boss-art/out/sawyer-dozer/preview/front-idle.png, scripts/boss-art/out/sawyer-dozer/preview/front-move.png, scripts/boss-art/out/sawyer-dozer/preview/back-idle.png, scripts/boss-art/out/sawyer-dozer/preview/back-move.png, scripts/boss-art/out/sawyer-dozer/preview/views.png, scripts/boss-art/out/sawyer-dozer/preview/trail.png, scripts/boss-art/out/sawyer-dozer/preview/ride.gif. Each look it took: scripts/boss-art/out/sawyer-dozer/looks/.

## Its notes

Sawyer's Dozer now leaves tread marks. Each mark is two bands of short cleat lines in a dark earthy brown, like a crawler's tracks pressed into the floor. Its box is 34 × 16 and it lasts 720 ms (3 frames of 240 ms), one on every square the dozer leaves.

**The mark, frame by frame**
- **Frame 0:** crisp, nearly solid cleats on a faint pressed band.
- **Frame 1:** fades to about 60%.
- **Frame 2:** fades to 35% and breaks up, with every third cleat missing, staggered between the two bands. Then it's gone.
- **Direction:**
  - **Running sideways:** the bands lie along the run and the cleats cross them. The town mirrors the mark for runs to the left.
  - **Running up or down:** the two bands stand upright and the cleats run across them. These upright bands are only 16 units tall, to fit the box.

**Taken out of the ride's frames**
- **Side view, move:** I removed the dirt crumbs behind the rear track (x about −4 to 3). The crumbs at the blade stay.
- **Back view, move:** I removed the crumbs that flew out past the tracks. The one crumb drawn right on top of each track stays, because removing it would show an edge of the track that the crumb was hiding, and that counts as changing the ride.

Nothing else changed.

**Choices you might want to change**
- **Exhaust puffs:** I kept them in every view. On the side move they drift back only 3–6 units a frame while the dozer moves 12.5, so they still travel forward with it and aren't left behind. If you'd rather lose the trailing ones, take out the second puff on the side move.
- **Front-view crumbs:** I kept the crumbs flying out beside the tracks in the front view, since that's the front of the dozer, where they go along with it. You could remove them too.
- **Rim on the bands:** each band has a faint light-tan rim, but the mark itself is all dark brown.
