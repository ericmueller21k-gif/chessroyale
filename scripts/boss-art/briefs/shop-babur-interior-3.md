# Babur's shop, third pass: much bigger burning hoops

The first two briefs (`scripts/boss-art/briefs/shop-babur-interior.md`, `shop-babur-interior-2.md`) still hold, except
where this one changes them. Your drawing exists: **read it first** (`scripts/boss-art/out/house-shop-babur/house-shop-babur.ts`)
and revise it with `edit_drawing`. Don't rewrite the file, and leave the other pieces as they are.

## What Eric asked for (Nov 2)
"We gotta increase the size of the animated pieces… the rings for the lion should be much bigger too." He means
Babur's three burning hoops.

## The hoops, redrawn about 2.5 times as big
- **Size:** each steel ring is about 29 px across now. Make each about **70 px across**, with tongues of flame licking up
  and outward all round it.
- **Same pixel density:** each art pixel stays one pixel. Redraw them; never scale the old picture up. More room means
  more detail in the flames: layered tongues (the hot core, yellow, orange, the red tips) and a few embers.
- **Stands:** each stands on a taller stand to match, a steel post on a round base with a gold collar. The ring's bottom
  is about a square above the floor.
- **Same steel, flame colors and 8-frame flame loop**, at about 110 ms. Each hoop's flames run out of step with the
  others, a spark rises now and then, and only the flames move.
- **Each hoop gets its own space,** so their flames never touch: about 2 to 3 squares a hoop.

## Where they go
The ring (the octagon) is at columns 6-13, rows 7-14, and stays as it is. The counter is at columns 8-11, row 3, and
Stripes stands at its east end. The path from the door (columns 9-10, row 19) up to the counter must stay clear. The cold
hoop stays where it is (column 3, row 7).

The east side (columns 14-18) has room for three big hoops, one behind the other down the side, staggered so each shows.
For example, hoops at about rows 5, 9 and 13, each about 3 squares wide. Move the pin rack and the trunk (or drop one) so
nothing overlaps. Your call on the exact layout, as long as the flames don't touch and the path stays clear.

You can keep one piece, `fire-hoops`, or split it into three placed pieces (`fire-hoop-a`, `-b`, `-c`: the same drawing,
its frames shifted so they burn out of step). Splitting is likely simpler once they're apart.

Update:
- `SHOP_BABUR_HOOP_LIGHTS` and `SHOP_BABUR_HOOP_POOLS`, one each per hoop, sized to the bigger rings;
- `SHOP_BABUR_PIECES`, `SHOP_BABUR_LAYOUT` (the solid squares) and the room still;
- the viewing animations, one per hoop piece with all its frames.

## Looks
- Render a hoop frame by frame (at 2x or as big as fits).
- Then render the room still at scale 1, **one frame only**. A many-image request can't take a picture over 3,000 px.
- Check that the flames loop smoothly and read as fire round a ring, that the hoops don't touch, and that the path is
  clear.

Call done with notes: the new size in pixels and squares, where each hoop sits, what moved, and its frames beat by beat.
