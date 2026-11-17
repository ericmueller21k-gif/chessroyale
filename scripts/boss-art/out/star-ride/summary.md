# Boss art (rider): star-ride

- Model claude-opus-5-5, effort high, adaptive thinking. 10 turns, 7 renders.
- Spend: **$1.40** of the $6 cap (22 input, 85,493 cache-write, 468,380 cache-read, 43,826 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/star-ride/star-ride.tsx.
- Previews: scripts/boss-art/out/star-ride/preview/idle.png, scripts/boss-art/out/star-ride/preview/move.png, scripts/boss-art/out/star-ride/preview/look.png, scripts/boss-art/out/star-ride/preview/front-idle.png, scripts/boss-art/out/star-ride/preview/front-move.png, scripts/boss-art/out/star-ride/preview/back-idle.png, scripts/boss-art/out/star-ride/preview/back-move.png, scripts/boss-art/out/star-ride/preview/views.png, scripts/boss-art/out/star-ride/preview/trail.png. Each look it took: scripts/boss-art/out/star-ride/looks/.

## Its notes

I've given Moon's Ride (star-ride, mythic) a hollowed-out seat in the middle of the star, and the pawn now sits down in it in all three views. I copied the finished file and changed only the seat; the description is unchanged.

**The seat**
- A round dip in the middle of the top face, squashed to an oval by the camera angle: 49 units wide, about the width of the pawn's base, and centered on the star.
- Inside, it's the item's color shaded darker: a lit band along the far inner wall, a darker floor with the pawn's own shade, and the near wall in shadow under the lip.
- A thin soft light band runs along the far rim, and a lighter line just under the near lip's edge reads as its rounded top.
- **Behind the pawn (`Back`):** the dip's inside and its far rim.
- **In front of the pawn (`Front`):** the part of the star in front of the near lip, plus the lip's outline. That outline curves up at the pawn's sides, so it looks like the pawn sits down into a round hole.
- I hide that front part with a mask rather than a clip. A clip drew a faint line along its edge.

**Pawn numbers (all three views):** cut **70**, pawnY **-8.5** (it was -26 with no cut). The pawn is now about 17 units lower, so its head top sits at about y 11.5. In the side view pawnX is -3, which centers the pawn on the star's middle at x 47. Front and back use pawnX 0.

**Motion: unchanged from the finished star**
- **Idle (12 × 170 ms):** a slow hover bob of about 2.5 units, with the ground shadow shrinking as the star rises. No sparks.
- **Move (8 × 70 ms, dx 0 to 100):** a faster bob and a 3° lean forward, with the sparkler fizz popping from the back point.
- **Front and back views:** the star still pitches a little toward the way it's going. It now pivots round the seat, so the pawn, its cut and the lip stay lined up in every frame.
- **Trail:** the fallen-spark mark is untouched.

I looked at it in red, yellow, cobalt, pearl and midnight, with white and black pawns, in all three views at 4x and at town size. There were no warnings, and it's still under 125 units wide.

**Choices you might want to change**
- **How deep the pawn sinks:** at the middle about the bottom quarter of the pawn is hidden, more at the sides where the lip curves up. A cut of 72 with pawnY -10.5 would raise it a little.
- **Seat size:** the dip's radius is 24.5 in the star's own plane, close to the inner notches (about 26.5). The rim nearly touches the notches, and it can't get much bigger without breaking through them.
- **Tile box:** I changed it to [-4, 4, 106, 102] because the pawn is lower now.
