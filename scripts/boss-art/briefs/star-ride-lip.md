# Moon's Ride, the rounded star: no straight edge round the seat (Nov 17, fourth pass)

Eric, on the live star with his own look (a suit, a crown, a parrot on the shoulder): **"WHATS WITH THE HORIZONTAL LINE"**.

**Start from the finished seat star:** `scripts/boss-art/out/_prev/star-ride-seat.tsx` (read it all). Copy it as your drawing
and keep everything: the star, the seat, its shading, the pawn's numbers (`cut` 70, `pawnY` -8.5, side `pawnX` -3), the hover,
the fizz, the shadow, the front and back views and the trail. Change only what's below.

**What's wrong (measured).** The reference pictures show the town's own composition: the ride's Back, then the dressed pawn
hidden below its `cut`, then the ride's Front. Front draws the star through a mask, `frontClipD`: inside the dip, below its near
arc (good); **outside the dip, below a straight horizontal line at the rim's middle (`cy`)**. Anything at the pawn's sides that's
wider than the dip (the parrot's tail, a katana's blade, a tommy gun, a coat's sides, the far rim's light band) is chopped off
along that straight line: see `1-erics-look-the-straight-line.png` (the parrot's tail tips and the rim's light band both end flat
at the same height) and `2-more-looks-cut-flat.png` (front view; a coat and parrot in the move; a katana; a tommy gun). The
pawn's own cut is NOT showing anywhere: inside the dip the near arc covers it in every frame (checked), so keep that.

**The fix: the edge of what Front draws over the pawn is curved everywhere, never straight,** in all three views and every frame:
- Inside the dip it stays the near lip's arc, as now.
- Outside the dip, replace the horizontal line with a smooth curve, a continuation of the lip, so whatever crosses it (a tail,
  a blade) tucks behind the star with a rounded edge, the way it tucks behind the near lip. For example: the edge leaves the
  near arc smoothly partway up each side and sweeps outward and gently down, like the soft roll of the star's face round the
  seat. No corners where it joins the arc, and no straight run anywhere a pawn's item could cross it (x -10 to 110, y 25 to 80).
- **Hard limit, so the pawn's flat cut never shows:** everywhere along the pawn's cut line, the Front must stay opaque. The
  cut line is the pawn's own y 70 (CUT) for the pawn's own x 8 to 92 (outfits and side items reach that far), moved by the pose
  (pawnX, pawnY, the move's tilt round the pawn's base). In the side view at rest that's y 61.5 from x 5 to 89; with the bob it
  rises with the star. So outside the dip the new edge must stay at or above that line out to those x, in every frame and view.
- Draw the lip's dark outline only along the dip's near arc, as now (the new outer edge is the star's face continuing, so no
  outline there), unless a soft shade along it reads better.
- The far rim's light band and everything behind the pawn are unchanged.
- Cap: $4, effort high. Say in your notes the curve you chose (its shape and where it meets the arc).
