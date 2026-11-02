# Puddles' shop, second pass: a much bigger pond garden

The first brief (`scripts/boss-art/briefs/shop-puddles-interior.md`) still holds, except where this one changes it. Your
drawing exists: **read it first** (`scripts/boss-art/out/house-shop-puddles/house-shop-puddles.ts`) and revise it with
`edit_drawing`. Don't rewrite the file, and leave the other pieces as they are.

## What Eric asked for (Nov 2)
"We gotta increase the size of the animated pieces… I want the pond to be like 3x the size it is."

## The piece: `pond-garden`, redrawn about 3 times as big
- It's 3 x 2 squares now (111 x 96 px). Aim for about **3 times as wide and as deep**.
- **Same pixel density as the rest of the room:** 37 px a square, and each art pixel stays one pixel. Never scale the
  old picture up. Redraw it bigger, with more detail:
  - a bigger pond in a ring of stones, with more lily pads and two or three pink water lilies;
  - more reeds, cattails and foxgloves, and flower clumps round the edge in his pinks and greens;
  - a stepping-stone path or a little wooden footbridge across a narrow part;
  - maybe a frog on a pad, or a few small fish under the water.
- **Keep the same kind of loop:** 8 frames at about 190 ms. Ripples spread across the water, the lily pads bob, a drop
  falls from a leaf now and then, flowers nod and a fish turns under the water. Lively but calm.
- Draw the water flat-ish, seen from above at the town's angle, and the plants upright, as now.

## Where it goes
The room is 20 x 20, with walls on columns 0 and 19. The battle circle is at columns 6-13, rows 7-14, and stays exactly
where it is: it's the middle of the building. The counter is at row 3. The path from the door (columns 9-10, row 19)
runs up through the circle to the counter, and must stay clear.

Eric's ideal is about 9 x 6 squares, and that **can't fit** beside the circle. The east side, columns 14-18, is only
5 squares wide. So put the pond garden on the east side as a long pond: **5 squares wide and about 7 to 9 deep**, roughly
columns 14-18, rows 5-13. That's about 3 times the old area. Its picture can rise above its back row.

Your call if you find something better, as long as it's at least 7 x 5 squares (or 5 x 7) and keeps the circle, the
counter and the path clear. Move the hose reel and the wheelbarrow, or drop one, so nothing overlaps. Keep the palm.

Update `SHOP_PUDDLES_LAYOUT` (its `w` and the solid squares: mark the squares it covers), `SHOP_PUDDLES_PIECES`, the
room still and the `pond-garden` and `review-pond` viewing animations.

## Looks
- Render `pond-garden` frame by frame (at 2x, or as big as fits).
- Then render the room still at scale 1, **one frame only**. A many-image request can't take a picture over 3,000 px.
- Check that the loop is smooth, that it reads as the room's eye-catcher, and that the path and circle are clear.

Call done with notes: the new size in pixels and squares, where it sits, what moved, and its frames beat by beat.
