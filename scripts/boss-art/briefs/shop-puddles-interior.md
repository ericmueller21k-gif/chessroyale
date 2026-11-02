# Inside Puddles' Botanical Garden: Puddles' shop

You are drawing a **room**, not a boss: the inside of Puddles' home on the town square, a wood-and-glass greenhouse.
Puddles is the hippo gardener who waters plants and plants seeds. The player walks up to Puddles' Botanical Garden, taps
"Go in", and the view fades into this room, about **20 x 20 squares**, seen the way the town is seen. Inside, a
Shopkeeper stands behind a counter that sells "Puddles' Boss Crate". The Shopkeeper is Drizzle, Puddles' kid, a baby hippo;
the game reuses Drizzle's existing sprite, so **don't draw Drizzle**. The game's code (written later by another helper)
lays your pieces out from your layout.

This is the second shop. The first was Babur's circus tent: `scripts/boss-art/out/house-shop-babur/house-shop-babur.ts`,
with its brief `scripts/boss-art/briefs/shop-babur-interior.md`. **Read both first and follow the same structure**: one file;
each piece its own `Character` (`shop-puddles-<name>`, all in `SHOP_PUDDLES_PIECES`); `SHOP_PUDDLES_LAYOUT`; the whole room
as one still, `HOUSE_SHOP_PUDDLES` (id `house-shop-puddles`), with one extra animation per piece for viewing; the same
footing (a wide piece stands on the middle of its width, on the middle of its row) and the same flat 37 x 37 floor tiles.
Reuse its helpers' ideas, but not its colors.

## How it's seen (Eric, Nov 2)
Inside a building the default view is **close, third person**: about 3x the town's zoomed-in scale (a square is about 146
px on a phone, so one art pixel is about 4 screen pixels). The player can zoom out to the town's own view. So:
- The pieces must look good blown up 3x and still read at the town's scale. The Babur shop's level of detail was judged
  enough (Eric: "that quality is sufficient").
- **The floor is on screen most of the time, big.** Keep the floor tiles calm: soft, sparse texture, no busy fine
  patterns (in Babur's shop the raked ring floor looked like a maze up close).

## Read first
- Puddles' greenhouse from outside, `packages/app/src/town/houses/gardener.ts`, and Puddles himself,
  `packages/app/src/characters/gardener.ts` (`GARDENER_PALETTE`). Use those colors: his greens, pinks, water blues, wood,
  stone and glass. The inside must read as the inside of *that* greenhouse.
- Drizzle, the Shopkeeper: `packages/app/src/characters/sidekicks/puddles.ts` (for size: about 0.9 squares tall in the
  town).
- `packages/app/src/town/houses/kit.ts` and `packages/app/src/town/houses/park.ts`, as before.

## The room (columns 0-19 west to east, rows 0-19 north to south; you come in at the south)
```
row 0      back wall: glass panes in a white-painted wood frame, the counter's backdrop in the middle
rows 1-4   the shop: counter at columns 8-11, row 3 (Drizzle stands behind it on row 2)
           a potting bench at 2-3, row 3; a big potted palm or fern at 16, row 3
rows 6-15  the battle circle (below), columns 6-13, rows 7-14
           planters and props round the sides, clear of the paths
row 19     the front: a low wall of glass and wood, the entrance (glass double doors) at columns 9-10 (the way out)
cols 0, 19 side walls: glass panes in wood frames, receding (drawn for the west wall; the game mirrors it for the east)
```
Keep a path at least 2 squares wide from the door to the counter, and the circle walkable. Only the walls, the counter and
the props are solid.

## The battle circle (Eric, Nov 2: every building gets one)
The middle of each building is a **themed battle circle where future battles take place**: a clear, bold arena floor in
the home's own theme, like the battle floor of a game's gym. Here: a round **garden arena** about 8 squares across: a
border of low clipped hedge or a stone edging with flowers set in it; inside it a floor of smooth flagstones or packed
earth. Paint a big emblem in its middle (a leaf or a sprout in a circle, in his greens) and a **start mark on its north and
south sides** (where two sides would stand), with a line across the middle. Make it bold and readable from above and from
the close camera, and calm enough to stand on. Draw it as floor tiles: the plain floor inside, edge tiles (straight and
45° pieces, plus any corner tile you need, as Babur's ring had) and the emblem and marks as tiles of their own, laid by
the layout.

## The pieces (sizes in squares, 1 square = 37 px; heights are a guide)
**Floor** (flat 37 x 37, top-down, no outline, tiles seamlessly):
1. `floor-a`, `floor-b`: the greenhouse floor: worn terracotta tiles or brick, two alternating tones, quiet.
2. `floor-c`, `floor-d`: variety: a little moss in the cracks; a few fallen leaves and a puddle (he's Puddles).
3. The circle's tiles (above).
4. `floor-door`: daylight falling in at the doors.

**Walls** (upright):
5. `wall` (1 x about 3.5 squares tall: 37 x ~130): greenhouse glass panes in white-painted wood mullions, a little green
   tint and a soft sky glow through the glass, a vine trailing along the top. Tiles side by side.
6. `wall-pillar` (1 square wide, a little taller): a wall piece with a cast-iron or wooden column in front, a hanging
   basket of flowers on it.
7. `wall-side`, `wall-side-pillar`: the side walls receding (as Babur's), glass and frames foreshortened.
8. `hem`, `hem-pillar` and `entrance` (2 squares wide, ~3 tall): the front stays low so it never hides the room. The
   entrance: glass double doors standing open, bright day outside. It must clearly read as the way out.
9. `backdrop` (4 squares wide, behind the counter): a wall of shelves with seed packets, pots and a watering can, or a
   big trellis of climbing roses, your call.

**The shop and props** (upright, with the town's soft ground shadow):
10. `counter` (4 x 1 squares): a potting-shed counter: a wooden top, its front of planks painted his green, flower pots
    along it. **Keep it low, at most about 32 px tall**, so Drizzle, about 0.9 squares tall, shows behind it (Babur's
    58 px counter hid his kid). A blank plaque on its front for the game to write on (`SHOP_PUDDLES_COUNTER_SIGN =
    signFace(...)`).
11. `crate` (about 30 x 26 px, on the counter): **Puddles' Boss Crate**: a wooden crate in his style (green bands, a
    leaf or a water drop on its lid, a ribbon), clearly the thing you buy. `SHOP_PUDDLES_CRATE_AT` in counter pixels,
    to one side so the plaque stays clear. Idle: a glint, or a drop of water running down it.
12. `potting-bench` (2 x 1, ~70 tall): seed trays, a trowel, a sack of soil, small pots with sprouts.
13. `palm` (1 x 1, ~110 tall): a big potted palm or fern in a terracotta pot. Idle: its fronds sway 1 px.
14. `fountain` (1 x 1, ~70 tall): a small tiered fountain like the one outside his home. Idle: the water runs.
15. `hose-reel` (1 x 1, ~50 tall): his green hose coiled on a reel, a brass nozzle.
16. `flower-bed` (2 x 1, ~40 tall): a raised wooden bed of flowers in his pinks.
17. **`pond-garden`, the home's animated showpiece** (Eric, Nov 2: "every house will have an animated piece, the hippo
    will have a flower garden/pond"): about 3 x 2 squares, east of the circle (columns 15-17, rows 9-10, solid), clear of
    the path. A small round pond in a ring of stones with a flower garden round it in his pinks and greens: lily pads with a
    pink water lily or two, reeds, and a little stepping-stone. **It's the room's eye-catcher, so give it a real, looping
    animation**, 6 to 8 frames: ripples spreading across the water, the lily pads bobbing, a drop falling from a leaf now and
    then, and flowers nodding. Lively but calm, not distracting. Draw it flat-ish like the fountain in the park (its water
    seen from above at the town's angle) and upright where the plants stand. Check it frame by frame at 4x.
18. Your call, at most two more small things in his spirit (a watering-can rack, a wheelbarrow of seedlings, a bench).
    Keep the room uncluttered.

## Looks
Render each piece at 3x or 4x on both backgrounds, then the room still (scale 1). Check:
- the floor tiles tile with no seams and no visible repeat, and stay calm at 4x;
- the circle reads clearly as a battle floor with its two start marks;
- the walls tile side by side;
- everything reads as the inside of gardener.ts's greenhouse, in its colors;
- the pond garden's animation loops smoothly and reads at both zooms;
- the counter is low enough for Drizzle to show behind it;
- the path from the door to the counter is clear.

Call done with notes on your choices and each piece's size in pixels and squares.

## How to write it
Build the file in steps: first `write_drawing` a short skeleton (the palette, the floor tiles, the circle, the wall, the
layout and the room still) and render it; then add the other pieces a few at a time with `edit_drawing`, rendering as you
go. Keep each turn's writing under about 600 lines.
