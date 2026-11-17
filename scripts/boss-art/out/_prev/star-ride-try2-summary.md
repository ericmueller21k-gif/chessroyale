# Boss art (rider): star-ride

- Model claude-opus-5-5, effort high, adaptive thinking. 12 turns, 8 renders.
- Spend: **$0.95** of the $20 cap (28 input, 57,913 cache-write, 497,855 cache-read, 27,981 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/star-ride/star-ride.tsx.
- Previews: scripts/boss-art/out/star-ride/preview/idle.png, scripts/boss-art/out/star-ride/preview/move.png, scripts/boss-art/out/star-ride/preview/look.png. Each look it took: scripts/boss-art/out/star-ride/looks/.

## Its notes

Moon's Ride (mythic), second try: a puffy, rounded five-pointed star, side view only.

What it is: a thick star like a plump cookie, hovering level under the pawn. We look down on it more steeply than in the first try (squashed to 0.7, up from 0.55), so its top face clearly shows the star. The points are long with deep notches and round tips. One point faces down-front toward the camera, one faces forward, one back-left, one low on the left, and the back point shows to the right of the pawn's neck. The rounded side is 14 units deep and darkens as it curves under. It's all one painted color: a lighter, glossy domed top with a soft highlight and a white glint, getting darker over the rounded edges and underside, with bold dark outlines. Dark colors get a lighter top so Midnight still shows its shape; pale colors get darker sides so Pearl does too.

Width: the star is about 93 units across (x 4 to 97). With the sparks in the move, about 110 units, under the 125 limit.

Idle (12 frames × 170 ms): a slow, smooth bob of 2.5 units with the pawn riding along. The soft shadow stays on the ground and shrinks a little as the star rises. No sparks at rest.

Move (8 frames × 70 ms, dx 0 to 100): a smooth glide with one 2-unit bob per square and a 3° forward tilt (star and pawn together, around the pawn's base). From the back-left point, a sparkler fizz pops one new spark each frame: tiny pale-gold and white stars that fly a few units out and fade over 3 frames, staying with the star. The last frame leads into the next move's first.

Choices you might want to change:
- The pawn sits on the middle-front of the top face, not the back half. Seating it further back would put its head about 15 units above the y −9 limit. To show more points, the two front points and both side points stick out round the pawn, and the back point shows beside its neck. Fixing this properly would mean a smaller star or a thinner side.
- The shadow's middle is at y 99.5 and its bottom reaches about y 104, a little below the usual ground line, to keep 6 to 8 units of air under the star. The tile's frame is [−2, −9, 104, 114].
- The star hovers fairly low (the bottom of its side is around y 89), so the pawn's head stays at about y −8.5 at the top of the bob.
- The description is kept from the first try: "A whole star to sit on. Wishes not included; parking is a nightmare."
