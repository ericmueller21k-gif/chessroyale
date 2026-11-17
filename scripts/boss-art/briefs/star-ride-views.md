# Views: Moon's Ride, the rounded star (`star-ride`)

Add the **front** and **back** views to **Moon's Ride** (`star-ride`), the finished ride in
`scripts/boss-art/out/star-ride/star-ride.tsx`. Leave its side view exactly as it is.

- It's a puffy rounded five-pointed star lying level, so from the front and back it's **the same star, turned**: its top
  face seen from above at the same angle (the same squash), the same thick rounded side darkening underneath, the same
  shading, highlight and glint, the same hover gap and soft ground shadow. Reuse the side's star code with a different
  turn rather than drawing a new shape.
- **Back** (walking up the screen, away from us): the star turned so a point faces back toward us (down-front of the
  picture is fine) and the points spread round the pawn seen from behind; the sparkler fizz, in the move, comes from the
  point nearest us (the star's back, the way it came from), small and centered low.
- **Front** (walking down, toward us): the star turned so a point faces us; the sparkler fizz in the move comes from
  behind it, peeking out above or beside the pawn from the far point (small; it may be partly hidden by the pawn).
- **Move:** the side's glide in place: the same bob (one per square), the same timing, a slight dip toward the way it
  goes; no forward tilt sideways. **Idle:** the same slow hover bob, no sparks.
- Centered on x 50, the pawn at the same height (the same pawnY and cut as the side), pawnX about 0.
- The painted part stays the whole star (one color, shaded).
- Cap: $3, effort high.
