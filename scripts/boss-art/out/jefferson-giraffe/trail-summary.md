# Boss art (rider trail): jefferson-giraffe

- Model claude-opus-5-5, effort medium, adaptive thinking. 4 turns, 2 renders.
- Spend: **$0.32** of the $1.5 cap (10 input, 45,894 cache-write, 111,286 cache-read, 3,459 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/jefferson-giraffe/jefferson-giraffe.tsx.
- The trail: its mark {"frames":3,"lifeMs":600,"every":1,"w":26,"h":26,"drawn":"26 x 23 units at most"}; nothing taken out of its frames, the rest of every frame unchanged.
- Previews: scripts/boss-art/out/jefferson-giraffe/preview/idle.png, scripts/boss-art/out/jefferson-giraffe/preview/move.png, scripts/boss-art/out/jefferson-giraffe/preview/look.png, scripts/boss-art/out/jefferson-giraffe/preview/front-idle.png, scripts/boss-art/out/jefferson-giraffe/preview/front-move.png, scripts/boss-art/out/jefferson-giraffe/preview/back-idle.png, scripts/boss-art/out/jefferson-giraffe/preview/back-move.png, scripts/boss-art/out/jefferson-giraffe/preview/views.png, scripts/boss-art/out/jefferson-giraffe/preview/trail.png, scripts/boss-art/out/jefferson-giraffe/preview/ride.gif. Each look it took: scripts/boss-art/out/jefferson-giraffe/looks/.

## Its notes

Jefferson's Giraffe (Giraffe Gallop) now leaves a trail of hoofprints. Each mark is a staggered pair of two-toed hoofprints in a fixed dark earthy brown (#5a3218, with a darker #2e180a line and a faint tan rim). The pair is about 20 × 14 units, inside a 26 × 26 box. The town drops one on every square the giraffe leaves.

**Frame by frame** (3 frames × 200 ms, 600 ms in all):
- Frame 0: freshly pressed, full strength.
- Frame 1: lighter (60% opacity), slightly smaller.
- Frame 2: faint (28%), a little smaller again.
- Then it's gone.

**Which way it points:** each print's toes point the way the giraffe ran: right for the side view (the town mirrors it for left), up the screen for the back view and down for the front view. The whole mark is flattened to 0.9 to lie on the floor. The pair is staggered, and which side is ahead flips with each mark, so the prints go left and right in turn.

**How it reads at town size:** the prints show as small brown pairs of dots on light squares. They're easiest to see when fresh on dark squares, and the faint last frame nearly disappears there. The mark is the same in every color.

**What I took out of the ride:** nothing. I checked every view's idle and move, and the giraffe leaves nothing behind in its own frames. The mane, horn and tail flames all stay with it, and I left them as they were. I added only the `trail` field, its `HoofMark` code and the `TrailProps` type import.

**Choices you might want to change:**
- The tan rim is barely visible. On dark squares you could make it stronger, or make the mark bigger.
- You could make the mark fade more slowly (for example 250 ms per frame) so more prints show behind a run.
