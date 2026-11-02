# Boss art (rider): smudgy-brush

- Model claude-opus-5-5, effort high, adaptive thinking. 19 turns, 11 renders.
- Spend: **$1.30** of the $6 cap (40 input, 70,862 cache-write, 781,694 cache-read, 39,231 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/smudgy-brush/smudgy-brush.tsx.
- Previews: scripts/boss-art/out/smudgy-brush/preview/idle.png, scripts/boss-art/out/smudgy-brush/preview/move.png, scripts/boss-art/out/smudgy-brush/preview/look.png. Each look it took: scripts/boss-art/out/smudgy-brush/looks/.

## Its notes

Brush Ride (smudgy-brush), mythic, side view only. It's a giant paintbrush flown like a broom, floating level with a soft ground shadow. From left to right: black bristles, a silver band, then a wooden handle. The tuft is dark and tapers to a point. It has two faint hair-strand lines and a grey highlight. The last stretch of the tip (about 18 of its 31 units) is dipped in the item's color, with a wavy dip line and a small white highlight. There's no paint blob, nothing drips and nothing hangs. The pawn sits upright near the middle on a small plum seat pad (Smudgy's beret plum) strapped to the handle. Only about its bottom 10 units are hidden (cut 84, pawnY -16, pawnX 8).

Painted part: the bristle tips, the trail in the move and the wisp in the idle. The handle, band, black bristles and pad keep fixed colors.

Width: the brush runs from about x -12 to 112.5, so about 125 units including the idle wisp. The move's trail reaches about 27 units past the tip, to x ≈ -38 at its faded end.

Idle (8 × 230 ms ≈ 1.8 s): a slow bob of ±2 units and a ±1.2° sway. The pawn sways along with it. Frames 0–1: no wisp. Frames 2–4: a little curl of color grows up out of the tips. Frames 5–6: it lifts and fades. Frame 7: gone.

Move (8 × 70 ms = 560 ms, dx 0 → 87.5 in even steps, so the next move's frame 0 lands at 100): a swoop. It dips nose-down by up to 3.5 units in the first half, then rises nose-up by 3.5. The tilt is ±3.5°, and the pawn leans 2° forward plus the tilt. Behind the tips trails a short ribbon of color with dry-brush streaks and a highlight. The ribbon follows the path the tip actually flew, so it bends with the swoop, and it fades out at the far end. The swoop takes exactly one square, so back-to-back moves join smoothly. The step from rest into move frame 0 makes a small jump in tilt (about 2°).

Choices you might want to change:
- **Seat pad colour:** plum, a nod to the beret. It could be cream like his apron, or dropped so the handle alone hides the pawn's bottom.
- **Brush thickness:** I stretched the brush 1.18× vertically (SY) so it reads at town size, which also thickens its outlines a little.
- **Trail length:** 27 units (L in Trail). Lower it if it should be shorter.
- **Midnight:** the tips are hard to tell from the black bristles. The trail still shows the color.
- **Front and back views:** I didn't draw them because the brief didn't ask for them.
