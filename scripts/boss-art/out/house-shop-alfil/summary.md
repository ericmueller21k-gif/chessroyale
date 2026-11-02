# Boss art: house-shop-alfil

- Model claude-opus-5-5, effort high, adaptive thinking. 48 turns, 28 renders.
- Spend: **$5.97** of the $10 cap (100 input, 361,158 cache-write, 9,461,562 cache-read, 113,327 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/house-shop-alfil/house-shop-alfil.ts.
- Previews: the final preview failed: . Each look it took: scripts/boss-art/out/house-shop-alfil/looks/.

## Its notes

Alfil's shop (house-shop-alfil) is finished and every animated piece has been rendered and checked. It's a bright sandstone hall inside his pyramid in his colours: the sandstone, Alfil's red, blue and gold, and gold trim. It has the same structure as Puddles' shop: each piece is its own Character in SHOP_ALFIL_PIECES, with SHOP_ALFIL_LAYOUT, the room still HOUSE_SHOP_ALFIL, the same footing and flat 37 x 37 floor tiles. The file imports kit.ts as well as sprite.ts and paint.ts, because the brief asks for signFace and the LightSpot/LightPool types; Puddles' and Babur's shops do the same.

THE SHOWPIECE: the Elephant Sand Fountain ("sand-fountain", 4 x 3 squares, 148 x 233 px, d: 3).
- A sandstone pylon carries a winged sun disk and Alfil's carved head: brow ornament, ivory tusks, and a trunk that curls into a gold spout.
- The spout pours golden desert sand into a wide stone basin, and small braziers burn on the basin's back corners.
- Why: it is Alfil (an elephant), it is the desert (sand instead of water), and it is calm, like an hourglass that never stops.
- The basin's sand is drawn flat, seen from above; the pylon, braziers and falling stream stand upright, each on its own layer.
- Its loop is 8 frames at 130 ms:
  1. Grains slide down the stream, 3 px a frame, so the stream loops cleanly.
  2. Rings spread across the sand from where it lands, 1.25 px a frame; after 8 frames they've moved exactly one ring, so there's no jump.
  3. Grains kick up at the landing spot.
  4. Both fires flicker, out of step with each other.

OTHER ANIMATIONS (all loop):
- Crate (6 x 220 ms): a sparkle runs along the lid's gold rim, then winks on the gold elephant on top.
- Relics (8 x 200 ms): a sparkle hops from relic to relic.
- Pyramid model (4 x 300 ms): the capstone glints.
- Brazier (8 x 120 ms): the flames lick.

PIECES (squares; px):
- Floor:
  - floor-a and floor-b are calm sandstone flags with a soft bevel, one faint dithered worn patch and rare specks.
  - floor-c is sand drifted into a corner; the layout turns it so the drift sits against a wall.
  - floor-d is a cracked flag; floor-door is daylight fading in from the door.
  - All are 1 x 1, 37 x 37, and tile without seams.
- Battle circle:
  - The floor is polished pale stone.
  - The border is gold, then a blue band carrying gold ankhs, sun disks and little chess pieces, then gold and a thin red line. On the 45-degree sides the glyphs become gold studs, because they won't draw on the slant.
  - The start marks are red pads with a gold lotus, two squares wide; the middle line is gold and blue.
  - The 2 x 2 emblem is Alfil's head in deep blue on a gold sun disk, inside a ring of blue studded with gold.
  - Tiles: circle-a, circle-b, circle-edge, -diag, -diag-b, -corner, circle-line, circle-line-b, circle-mark-l, circle-mark-r, emblem-nw, -ne, -sw, -se.
- Walls:
  - wall and wall-b: 1 x 1, 37 x 130. Tall openings between piers look out on a pale sky, haze, far pyramids and dunes, under a fluted cornice in red, blue and gold. Two views alternate along the wall (one pyramid or two).
  - wall-pillar: 37 x 150, a papyrus column with a blue and gold capital and painted bands.
  - wall-side and wall-side-b: 37 x 130, alternating down the side walls. One is a procession of elephants in caparisons; the other shows the old alfil piece beside the shah, with an ankh. All are faded red, blue and gold carvings.
  - wall-side-pillar: 37 x 150.
  - hem: 37 x 22, a low wall with a painted band. hem-pillar: 37 x 150.
  - entrance: 2 x 1, 74 x 112. A stone gateway with a fluted cornice and a winged sun disk, bright sky and sand outside.
- Shop:
  - backdrop: 4 x 1, 148 x 150. A painted shrine of shelves (scrolls, jars, a gold elephant head, a row of chess pieces, gems) under a winged sun disk, with the openings still showing either side.
  - counter: 4 x 1, 148 x 44. The counter body is 29 px tall, low enough for the kid to show behind it. It has a gold-framed blank plaque (SHOP_ALFIL_COUNTER_SIGN), his red and blue cloth hung at both ends, and gold coins and a scroll on top.
  - crate: 30 x 27, a cedar casket with a blue vaulted lid, gold corners, a red and blue band and a gold elephant on top. It sits at SHOP_ALFIL_CRATE_AT = [122, 15], on the right so the plaque stays clear.
- Props:
  - elephant-statue: 2 x 1, 74 x 174. The alfil as a great chess piece with Alfil's head (fanned ears, brow ornament, tusks, trunk over a red caparison) on a fluted plinth with a carved elephant panel.
  - pharaoh-statue: 1 x 1, 44 x 146. An elephant-headed king with a striped headcloth, collar, crook and flail.
  - pyramid-model: 1 x 1, 40 x 62. Alfil's stepped pyramid in gold on a cushion and stand.
  - relics: 2 x 1, 74 x 62. A low table with a gold jar, an ankh, a blue scarab, a bowl of gems and an alabaster jar.
  - urns: 1 x 1, 40 x 52. Three canopic jars with elephant, king and falcon lids.
- My two extras: brazier (1 x 1, 30 x 62) and chess-table (1 x 1, 44 x 46), a shatranj board with an alfil, a shah and a pawn.

LAYOUT:
- Counter and crate at columns 8-11, row 3, with braziers at (7,3) and (12,3).
- Pyramid model at (3,3); urns at (17,2) and (3,17).
- Elephant statue at columns 2-3, row 9; relics at columns 2-3, row 14.
- Fountain at columns 15-18, rows 8-10 (it stands on row 10).
- Chess table at (16,15).
- Two pharaoh statues guard the door at (7,18) and at (12,18), the second one flipped.
- Columns 9-10 stay clear from the door to the counter; column 14 is open beside the circle; the circle is walkable.

LIGHTS: SHOP_ALFIL_LIGHTS covers the brazier flame and the fountain's two corner fires, each with `piece` set and only the flame pixels lit (keys "90@"), flickering with a halo. SHOP_ALFIL_POOLS has a warm pool under the brazier and one over the fountain basin.

THINGS THE OWNER MIGHT CHANGE:
- I added two variant tiles, wall-b and wall-side-b; the layout alternates them.
- The guardian pharaohs are fairly slim.
- The diagonal sides of the circle's border are thinner than the straight sides, as in Puddles' shop.
- The entrance's opening is only about 26 px wide.
- The file has extra review-only animations: review-floor, review-circle, review-props, strip-<name> and room-live.
