# Boss art (rider views): log-roller

- Model claude-opus-5-5, effort high, adaptive thinking. 6 turns, 4 renders.
- Spend: **$0.85** of the $1.5 cap (14 input, 55,177 cache-write, 175,222 cache-read, 26,769 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/log-roller/log-roller.tsx.
- The side view: unchanged, and the front and back views are drawn.
- Previews: scripts/boss-art/out/log-roller/preview/idle.png, scripts/boss-art/out/log-roller/preview/move.png, scripts/boss-art/out/log-roller/preview/look.png, scripts/boss-art/out/log-roller/preview/front-idle.png, scripts/boss-art/out/log-roller/preview/front-move.png, scripts/boss-art/out/log-roller/preview/back-idle.png, scripts/boss-art/out/log-roller/preview/back-move.png, scripts/boss-art/out/log-roller/preview/views.png. Each look it took: scripts/boss-art/out/log-roller/looks/.

## Its notes

I've added the front and back views. I didn't change the side view: the new code comes after the side's functions, and the only other edits are the `views` field and one added type import.

**What the new views show:** the log lies lengthwise across the screen, about 73 units wide (x 13–87) and the same height as the side (top at y 35, ground at y 96). The bark is brown with scrolling grain dashes, a fixed highlight near the top and a darker bottom. At each end there's a narrow cream face with a bark rim, two rings and a heart dot. The pawn stands centered on top at the same pawnY and cut as the side (87), so turning a corner doesn't make it jump.
- **Painted part:** still the band, with the same Region name ("log-band"). It shows as stripes running along the bark at two opposite points round the log, plus the side's stripe across each end face, squeezed to fit the narrow ellipse.
- **Branch stub:** it sits at the same angle round the log as in the side view, so the two views differ only here.
  - From the back it's near the left end and faces you at rest, a cream knot on the bark.
  - From the front it's near the right end, hidden behind the top at rest, and it comes round into view as the log rolls.

**Idle (10 frames, the side's timing):** the side's rock (+7°, then −4°) shows as the band and stub sliding a few units round the log. The whole ride dips a hair toward the way it rocks (down from the front, up from the back), and the pawn's catch becomes a small sideways roll at half the side's lean (about ±4°).

**Move (8 × 85 ms, in place, one full turn per square like the side):**
- The grain, band and stub scroll 45° a frame round the log. From the front they come over the top and down toward us; from the back they go up and over, away from us. The last frame leads straight into the first.
- The pawn moves as in the side view: lifts on frames 1 and 5, ±5° tilts and the small shuffle left and right.
- The log hops up to 4 units on frames 4–6, just as the stub comes underneath. The stub is shortened there so it never pokes below the ground.
- From the back, two small dust puffs stay with the log at its bottom corners. From the front the dust would be behind the log, so there are none. Nothing is left behind, and there's still no trail mark.

**Choices you might want to change:**
- **Width:** at 73 units it's a bit wider than the side's log (54, about 63 with the stub). Any narrower and it read as a drum or barrel rather than a log. It could go wider (the limit is 125) if you want it to look more log-like.
- **Thin band on some frames:** on move frames 1, 5 and 6 the bark bands are near the top or bottom edge, so the color shows mostly on the end faces.
- **End faces:** both are drawn as full ellipses. A real camera wouldn't see either end from this angle, so this is cartoon licence to show the rings as the brief asked.
- **Height:** as with the side view, the pawn's head reaches past the −9 limit.
