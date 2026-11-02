# Big Boy's shop, second pass: a puzzle-mat battle floor with a zoo-animal rug

The first brief (`scripts/boss-art/briefs/shop-bigboy-interior.md`) still holds, except where this one changes it. Your
drawing exists: **read it first** (`scripts/boss-art/out/house-shop-bigboy/house-shop-bigboy.ts`). Revise it with
`edit_drawing`; don't rewrite the file. Change only the battle circle's floor: leave every other piece, the walkway, the
pit, the walls and the props as they are.

## What Eric asked for (Nov 2)
"Make the big boy rainbow battle area the same color pattern tile style you did for the paths leading to the shop and
exit, and the center then should be a zoo animal rug that replaces the area where the current thin white circle is, then
the little battle spots sit on the rug."

Also from Eric, for every boss home now: **the boss stands on the left (west) and you on the right (east)**, with the
table between you in the middle.

## The changes (all in `circleMat` and what it draws)
1. **The circle's floor:** instead of the rainbow wedges, use the walkway's own style. That's the same teal and yellow
   foam puzzle-mat squares, with the same colors, texture and nubs as the `walk-*` tiles, laid in the same checker so the
   walkways run straight into it. Keep the octagon's shape, its padded rainbow bumper round the edge (with the openings
   where the walkways join), and its raised toy-block side over the pit.
2. **The zoo-animal rug:** in the middle, a round rug replaces the thin white ring and everything inside it (the old
   ring is about 104 px from the center, so the rug is about 5.5 to 6 squares across).
   - **Border:** a soft rug edge (a scalloped or stitched border in a bright color).
   - **Animals:** cute toddler-nursery zoo animals on it, flat and simple like a printed rug: a lion, an elephant, a
     giraffe and a monkey, maybe a zebra or a hippo, round the middle. They should be friendly, not overly cute, and calm
     enough to stand on.
   - **The middle:** keep Big Boy's lollipop-swirl emblem small in the very center, or a sun. Your call; the table stands
     there.
   - **Drop the white middle line.**
3. **The two start marks** (the white pads with a yellow star) sit **on the rug**:
   - one on the **west** side, centered **1.5 squares west** of the circle's center (X = -55.5 px);
   - one on the **east**, centered **1.5 squares east** (X = +55.5 px);
   - both on the middle line (Y = 0). Since the center is on a square's corner, each mark is centered on the middle of
     column 8 (west) or column 11 (east), at the line between rows 10 and 11.
   - Turn the pads so each is longer north to south, or round, your call. Remove the old north and south marks.
   - **Export where they are,** for the game: `SHOP_BIGBOY_MARKS = { boss: [8, 10.5], you: [11, 10.5] }` (column and
     row, the mark's middle).

Keep the piece names and exports the same, so the game picks them up. The circle's tiles are still found and named by
the loop after `circleMat` (`circle-1`, `circle-2`, …); their number may change, which is fine.

## Looks
- Render `review-circle` at 2x, then the room still at scale 1, **one frame only** (a many-image request can't take a
  picture over 3,000 px).
- Check that:
  - the circle's mat and the walkways read as one floor;
  - the rug and its animals are clear and calm;
  - the two marks sit on the rug, west and east, on the middle line.

Call done with notes: what changed, the rug's size and animals, and the marks' squares.
