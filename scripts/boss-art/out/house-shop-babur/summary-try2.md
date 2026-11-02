# Boss art: house-shop-babur

- Model claude-opus-5-5, effort high, adaptive thinking. 27 turns, 19 renders.
- Spend: **$3.37** of the $8.86 cap (56 input, 230,744 cache-write, 3,067,194 cache-read, 80,080 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/house-shop-babur/house-shop-babur.ts.
- Previews: scripts/boss-art/out/house-shop-babur/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/house-shop-babur/looks/.

## Its notes

Babur's shop, the inside of his big top: scripts/boss-art/out/house-shop-babur/house-shop-babur.ts. It uses tiger.ts's tent palette value for value (reds A/B/C, whites D/E/F, blues G-I, golds J-M, woods N-Q, balloon greens X-Z, purples a-c, yellows d-f, outline k). I added a few keys of my own: a shaded red "r" and shaded white "q" for the inside of the canvas, two sawdust tones (1-3, 4-6), the ring's sawdust (7-0), the worn path (g/h), daylight on the floor (y/z) and the day outside (u/v/p/o). Nothing is on fire: the hoop is plain cold gold and the counter's bulbs are unlit.

Each piece is its own Character, `shop-babur-<name>` (exported as SHOP_BABUR_* and also all together as `SHOP_BABUR_PIECES`). The whole room is in `HOUSE_SHOP_BABUR` (740 x 894: the floor plus 150 px above row 0 for the back wall). Where each piece goes is in `SHOP_BABUR_LAYOUT` (name, col, row, solid, plus rot / flip / w / exit where they apply).

**Footing.** A piece's foot is the middle of its width, on the middle of its row; this applies to wide pieces too. I chose that so the entrance lines up with the hem beside it. The brief said a wide piece's foot is the middle of its front edge; if the game measures from the front edge, wide pieces would sit half a square (18 px) lower than in my still.

**Floor** (flat, top-down, 37 x 37, no outline, foot at 18,18):
- `floor-a` and `floor-b`: sawdust in two straw tones, with sparse 2 px flecks. Laid as a checker they show no seams or visible repeat.
- `floor-c`: shavings and a purple balloon scrap, drawn on the a tone, so it only goes on a squares.
- `floor-d`: a soft scuffed path, drawn on the b tone, so it only goes on b squares.
- `ring-a` and `ring-b`: darker, redder raked sawdust. The rake marks are short furrows pointing every way, so a turned tile looks the same as an unturned one.
- `ring-edge`: red and white curb blocks, one pair per square, with a 2 px gold lip on the ring side, along the tile's north side. The layout turns it with `rot`.
- `ring-edge-diag`: the 45° side with sawdust on the a tone; `ring-edge-diag-b` is the same on the b tone.
- **Extra tile, `ring-edge-corner`:** the ring square just inside each corner of the octagon. The diagonal band clips that square's corner, so it needs its own tile.
- The octagon fills columns 6-13, rows 7-14. Its diagonal sides are two squares long, and its curb joins without breaks.
- `floor-door`: a warm wedge of daylight, dithered so it has no seam where its two squares meet.

**Walls:**
- `wall`: 37 x 130 (1 x 3.5 squares). Red and white stripes, one pair per square, with a dithered fold down each stripe; a gold rope along the top; a red and white scalloped valance; bunting in blue, green, purple and yellow. It tiles seamlessly side by side.
- `wall-pole`: 37 x 150, a wall with a wooden pole in front (gold ball on top, a gold rope tie with a tassel).
- `wall-side`: 37 x 130, narrow red and white folds with a thin gold edge. It's drawn for the west wall; the east wall uses it mirrored (`flip`). Stacked down a column it reads as pleats going away from you. The repeated top edge shows a little, every square.
- `wall-side-pole`: 37 x 150.
- `hem`: 37 x 20.
- `hem-pole`: 37 x 150, for the two front corners.
- `entrance`: 74 x 112 (2 x 3 squares). Two poles, a striped valance, red curtain halves tied back with gold, and bright day between them (sky over the square's paving). In the layout it is not solid and is marked `exit: true`.
- **Extra piece, `backdrop`:** 148 x 150 (4 squares) at columns 8-11 of row 0, filling the "counter's backdrop" line in the brief. It's the wall dressed as a little stage: red velvet drapes tied back, a swag with gold fringe, and a gold-rimmed medallion with a blue balloon knight.

**Poles.** Instead of one pole halfway along the back wall, there are two, at columns 6 and 13, flanking the backdrop. A single pole in the middle would stand right behind Stripes. The other poles are at the four corners and at row 10 on each side.

**Shop and props:**
- `counter`: 148 x 58 (4 x 1). A wooden top over a red front panel with gold trim, a row of unlit bulbs, two gold stars and red corner posts topped with gold balls. Its blank plaque is exported as `SHOP_BABUR_COUNTER_SIGN = signFace(44, 27, 60, 20)`.
- `crate`: 30 x 27. A wooden crate with red bands, gold corners, a gold star and a bow of red balloons on top. Its spot is `SHOP_BABUR_CRATE_AT = [112, 13]` in counter pixels (to the right, so the plaque stays clear). Its idle is 4 frames at 450 ms: a glint moves round its gold corners. In the layout it's listed at the counter's place, marked not solid.
- `balloon-stand`: 74 x 96 (2 x 1). A red cart with gold trim on wheels; a pegboard of limp balloons in five colours; a red and gold pump; a yellow, a purple pawn and a blue knight balloon tied to it. Its idle is 4 frames at 300 ms: each balloon bobs 1 px, out of step with the others.
- `hoop-stand`: 37 x 86. A cold gold hoop on a stand with a blue ribbon bow. Still.
- `balloon-stack`: 37 x 60 (the pieces stand about 45 px tall). A green rook and a purple pawn on a low crate, a blue knight on top of them, and a yellow bishop leaning on the side.
- `pedestal`: 37 x 72. A red drum with gold bands and a star, and a big blue balloon king on top.
- **Extra prop, `trunk`:** 37 x 44, at (16,12). A costume trunk with a spare top hat and a striped scarf on it. It fills the "second stack or pedestal" spot.
- **Extra prop, `pin-rack`:** 37 x 46, at (17,8). Four juggling pins with red and blue bands on a wooden rack.

**Path.** From the door (columns 9-10, row 19) the way runs north through the ring (columns 10-12; the pedestal is at (9,10)) to the counter at row 3. It's at least 2 squares wide all the way, and the whole ring floor is walkable.

**For review only.** The render tool doesn't crop, so each piece's animation in the room character is pre-scaled by a whole number (up to 4x): floor tiles are shown 3 x 3, wall pieces three side by side. There are also three review animations: `review-floor` (a 6 x 6 patch), `review-ring` (the octagon as laid out, at 2x) and `review-props`. The game shouldn't use any of these; it should use the separate piece Characters.

**Things you may want to change:**
- Whether the extras stay: the backdrop, the trunk, the pin rack and the corner tile.
- The king balloon is blue. A red king would vanish against the red drum.
- The balloon stack is on the small side.
- The east wall is a mirror of the west wall, so its folds are lit from the other side.
