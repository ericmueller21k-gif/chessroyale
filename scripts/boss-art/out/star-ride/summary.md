# Boss art (rider): star-ride

- Model claude-opus-5-5, effort high, adaptive thinking. 15 turns, 6 renders.
- Spend: **$0.92** of the $4 cap (32 input, 66,331 cache-write, 595,518 cache-read, 23,211 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/star-ride/star-ride.tsx.
- Previews: scripts/boss-art/out/star-ride/preview/idle.png, scripts/boss-art/out/star-ride/preview/move.png, scripts/boss-art/out/star-ride/preview/look.png, scripts/boss-art/out/star-ride/preview/front-idle.png, scripts/boss-art/out/star-ride/preview/front-move.png, scripts/boss-art/out/star-ride/preview/back-idle.png, scripts/boss-art/out/star-ride/preview/back-move.png, scripts/boss-art/out/star-ride/preview/views.png, scripts/boss-art/out/star-ride/preview/trail.png. Each look it took: scripts/boss-art/out/star-ride/looks/.

## Its notes

I took out the straight line. The edge where the star covers the pawn is now curved all the way across, in all three views and in every idle and move frame. Everything else is the same as the seat-star file: the star, the seat and its shading, cut 70, pawnY -8.5, side pawnX -3, the hover, the fizz, the shadow, the front and back views and the trail.

**What I checked:** The renders only show a plain pawn, so I tested with temporary stand-in items drawn in the pawn's layer: a coat wide enough to reach the cut line (y 61.5, x 5 to 89 in the side view), a two-feather parrot tail and a long blade. In all three views, at rest and through the move, the coat's flat bottom never showed, and the tail and blade tucked behind the star with a rounded edge. I've removed the stand-ins. The plain pawn looks the same as before.

**The curve:** On each side, the edge now leaves the near arc 30° up from the end of the seat, at y = cy + 0.5 × ry. In the side view that's (25.8, 52.6) and (68.2, 52.6). It leaves along the arc's own direction, so there's no corner at the join. It rises about 1.5 units to a soft crest just outside the seat's rim, around (21.6, 51) and (72.4, 51). From there it sweeps outward and gently down:
- At x 5 and x 89 it's at about y 56, which is 5.5 units above the pawn's cut line (y 61.5).
- At x -17 and x 111 it's at y 65.
- Beyond those x it runs off past the star, where nothing is drawn.

The curve is built from the seat's own size, so the front and back views get the same shape. It turns and bobs with the star, and the pawn does too, so it stays the same distance above the cut line in every frame. There's no outline along the new outer edge; it's just the star's face carrying on.

**One change to the lip outline you should know about:** The bold outline still traces the whole near arc and looks the same as before. But its two short upper ends, from the seat's sides down to where the curve leaves the arc, are now drawn behind the pawn instead of in front. Without that, a coat's side or a parrot's tail sticking out there would have had a dark line drawn over it, with the item showing on both sides. Now items lie cleanly over those ends.

**Choices you might want to change:**
- **Where items tuck in:** Items at the pawn's sides now show down to about y 51 to 56 before they tuck behind the star. Before, they were cut at y 44. If you'd rather they tuck in higher, set `LIP_T0` (the join, 30°) lower and `SH_DROP` (21) smaller.
- **A shade along the new edge:** I left it off. It would also show when no item crosses the edge, as a line across the star's face.
