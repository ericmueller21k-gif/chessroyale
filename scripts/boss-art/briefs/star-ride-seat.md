# Moon's Ride, the rounded star: a hollowed-out seat (Nov 17, third pass)

Eric, on the finished star: "It should be like the other riders where some of your pawn disappears in the center of the star,
almost like the center is a hollowed out seat."

**Start from the finished star:** `scripts/boss-art/out/_prev/star-ride-try2.tsx` (read it all; its three views are the
reference `try2-views-pawn-on-top.png`). Copy it as your drawing and **keep everything Eric liked**: the puffy rounded
five-pointed star, its turn, size and squash, one color shaded light to dark (glossy top, highlight, glint, darker rounded
sides), the hover and its bob, the ground shadow, the sparkler fizz at its back point in the move, the idle with no sparks, the
front and back views, and the trail mark (fallen sparks), all unchanged except the seat.

**The change: a hollowed-out seat in the middle of the star's top face, and the pawn sunk into it**, in **all three views**:
- A soft round **dip** in the center of the top face (an oval at the camera's squash, about as wide as the pawn's base or a
  little wider), its inside shaded darker (the far inner wall lit, the near inner wall in shade), with a soft rounded lip, so it
  reads as a cushioned seat scooped out of the star, still the item's color.
- **The pawn sits down in it:** its lower part hidden behind the dip's near lip (draw the near lip and the star's front in
  `Front`, the dip's inside and far rim in `Back`), so about the bottom third of the pawn disappears, like the bench-sit and the
  other rides (`cut` about 66 to 72; lower the pawn with `pawnY` so it sits down into the dip, not floating above it). The pawn's
  head stays well within the limit (it's lower now).
- Front and back views: the same dip at their turn, the pawn sunk into it the same amount (the same pawnY and cut as the side).
- The star's points still show round the pawn; the fizz and trail stay as they were.
- Keep within 125 units wide. The ride's `id` is "star-ride", name "Moon's Ride", description as in the finished file.
- Cap: $6, effort high. Say in your notes the cut and pawnY you chose.
