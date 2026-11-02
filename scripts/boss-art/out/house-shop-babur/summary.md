# Boss art: house-shop-babur

- Model claude-opus-5-5, effort high, adaptive thinking. 15 turns, 10 renders.
- Spend: **$1.37** of the $3.5 cap (34 input, 123,687 cache-write, 951,348 cache-read, 28,229 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/house-shop-babur/house-shop-babur.ts.
- Previews: the final preview failed: . Each look it took: scripts/boss-art/out/house-shop-babur/looks/.

## Its notes

I redrew Babur's three burning hoops at about 2.5 times their old size and split them into three pieces. I looked at all 8 frames of fire-hoop-a and the first two of b and c, plus the room still at scale 1. The flames loop smoothly and read as fire round a ring, the hoops don't touch, and the path from the door (columns 9-10) to the counter is clear.

**Size**
- **Ring:** 71 px across (radius 35, steel 5 px thick), up from 29 px. Each art pixel is still one pixel; I redrew it rather than scaling the old picture.
- **Picture:** 119 x 152 px; each hoop takes 3 x 1 squares, with a 4 px margin each side.
- **Flames:** reach up to about 30 px above the ring and about 20 px at the sides. Along the bottom they're short and lean outward, with none where the collar grips the ring.
- **Stand:** the ring's bottom is one square (37 px) above the floor. It stands on a steel post 5 px wide, lit on its left, on a round steel base. A gold collar grips the ring's bottom and a thin gold band sits where the post meets the base.
- **Colours:** the same steel and fire colours as before. The ring's steel is shaded like a round tube lit from the top left, with slanted dark tape on it. There are two layers of tongues, big ones and short hotter ones between them, each running from the white-hot core through yellow, orange and red to dark-red tips.

**Where each hoop sits**
- **fire-hoop-a:** columns 15-17, row 5.
- **fire-hoop-b:** columns 16-18, row 9 (one square east, to stagger the line).
- **fire-hoop-c:** columns 15-17, row 13.
- The hoops are four rows apart. Each hoop's flame tips end below the base of the hoop to the north of it.
- Hoop b's east flames stop just short of the east wall.
- Column 14 stays open beside the octagon. The octagon, counter, door, cold hoop (3,7), balloon stand, pedestal and balloon stack haven't moved.

**What moved or changed**
- **Pieces:** the old `fire-hoops` piece is replaced by `fire-hoop-a`, `-b` and `-c`. They're one drawing with their frames shifted by 0, 3 and 5 frames.
- **Exports renamed:** `SHOP_BABUR_FIRE_HOOPS` is now `SHOP_BABUR_FIRE_HOOP_A`, `_B` and `_C`. Any game code that imports the old name needs updating.
- **Trunk:** moved from (16,12) to (17,16).
- **Pin rack:** moved from (17,6) to (15,17).
- **Lights:** `SHOP_BABUR_HOOP_LIGHTS` (halo 56) and `SHOP_BABUR_HOOP_POOLS` (rx 52, ry 15) now have one entry per hoop. Each entry has a new `piece` field naming its hoop, and its coordinates are in that piece's own pixels. Code that reads the lights needs to use that field to place them.
- **Also updated:** `SHOP_BABUR_PIECES`, `SHOP_BABUR_LAYOUT` (each hoop's three squares are solid) and the room still. Each hoop has its own viewing animation with all 8 frames.

**The flame loop, beat by beat** (8 frames x 110 ms = 880 ms, looping; only the flames and sparks move)
- **Throughout:** each tongue swells and sinks once or twice per loop, so the loop has no seam. A lick runs up each tongue twice per loop, swaying it most at the tip. Where tongues overlap, the hotter colour shows.
- **Frames 1-4:** a spark rises off the top, left of centre.
- **Frames 3-6:** a spark rises off the right side.
- **Frames 5-8:** a spark rises off the top, right of centre.
- **Frame 7 through frame 2 (wrapping round):** a spark rises off the left side.
- Each spark climbs 5 px a frame and drifts a pixel sideways, cooling from white-hot to dark red. One to three are in the air at any moment.
- **Out of step:** b's frame 0 is a's frame 3 and c's frame 0 is a's frame 5, so the three never pulse together.

**Choices you might want to change**
- The lower flames are deliberately lighter than the top ones; they can be made heavier.
- The stagger direction (b to the east) can be swapped.
- The trunk and pin rack can go elsewhere.
- The render still warns that a pixel touches the room still's edge. I didn't track it down; I believe it's just the floor tiles running to the edge of the frame, which isn't new.
