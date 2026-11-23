# Boss art: shop-birdie-interior-4

- Model claude-opus-5-5, effort high, adaptive thinking. 26 turns, 13 renders.
- Spend: **$2.92** of the $6.5 cap (56 input, 190,716 cache-write, 2,067,771 cache-read, 77,573 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/shop-birdie-interior-4/shop-birdie-interior-4.ts.
- Previews: the final preview failed: . Each look it took: scripts/boss-art/out/shop-birdie-interior-4/looks/.

## Its notes

I've finished the round 4 lobby, but I couldn't open round 3's file: the tools refused that path. So I redrew the whole room by hand from lobby-first-frame.png and eric-marks.png. The layout matches round 3, but the palette and pixels are copies done by eye. Apart from SHOP_BIRDIE_N, SHOP_BIRDIE_GATES and SHOP_BIRDIE_INTERIOR_4, I don't know round 3's export names, so check them against the game's wiring.

I looked at the room's idle (all 4 frames), gates-lower and gates-down, close-ups at 3x of both bar arms, the table and every gate state, and the phone-size view. The vat's heap only got a close look inside the west-arm close-up. The standalone gate character isn't rendered on its own; it uses the same layers as the room. Every frame warns that a pixel touches the edge; that's expected, because the floor fills the whole frame.

ROOM: 444 x 527 px, 12 x 12 squares of 37 px under an 83 px back wall. The bartender's square (cols 6-7, rows 2-3) is clear, and the way from the door to the table and bar is open while the gate arms are up.

THE 8 CHANGES, CHECKED AGAINST ERIC'S MARKS
1. Bar arms raised: the bar is one U-shaped piece, 148 x 184 px, its top raised 36 px (the front face's height). Each arm has a 14 px charcoal side face toward its stools: the west one lighter, the east one darker. Each face has a dark base strip and the red stripe along its whole length. The tops are warm wood with a cream edge. Each arm's south end meets the front face at an angled corner where the two red stripes join, with no gap and no flat patch. The feeders stand on the raised tops.
2. Stools along the arms: three a side at col 4 and col 9, rows 1-3, seats tucked against the side faces. Birds sit on the west row 1 and 3 stools, the east row 2 stool, and the front col 5 and 7 stools.
3. Bigger seed: the vat (42 x 40 px, col 6 row 1) holds a 40 x 21 px mound of yellow, cream, brown and red seed with a scoop in it. The pile on the counter is 24 x 12 px. I sized both at about double round 3's by eye, since I couldn't measure the old ones.
4. Front-left corner: the gravel, rails, ties, X marks and posts are gone; it's plain checker floor with the safety line.
5. Crossing at the table: a 296 x 36 px strip across row 7, cols 2-9: gravel, wooden ties, two steel rails and yellow-and-black striped edges. It stops one square short of each side wall's safety line, and only the table and its two stools stand on it.
6. Two gates at Eric's marks:
   - West gate: col 4 row 6, north of the tracks, just left of the bar's front-left corner; arm points east.
   - East gate: col 8 row 8, south of the tracks, just right of the table's east stool; arm points west.
   - Each is a 1 x 1 square piece, about 24 x 72 px plus a 42 px arm: striped post, red-and-white crossbuck, two red lights side by side, a motor box and a striped arm with a counterweight. Both gates' lights flash together.
   - idle: arm straight up beside the post, behind the lights and crossbuck; lights dark red; still.
   - lower: 4 frames of 160 ms (62°, 34°, 10°, level), swinging toward the table side, lights alternating left and right. The first frame has a "crossing" sound cue.
   - down: arm level, lights left then right, 500 ms each, looping.
7. No feeders at the table: the two on its top and the two on the floor are gone. The five on the bar stay.
8. Square chess table: 30 x 47 px. A yellow-rimmed charcoal frame around an 8 x 8 board of cream and warm wood (3 px squares), on one wooden leg with a foot. The leg stands on the gravel, with one stool west (col 5) and one east (col 7) facing each other. No pieces on it.

EXPORTS
- SHOP_BIRDIE_N (12), plus SHOP_BIRDIE_SQUARE (37) and SHOP_BIRDIE_WALL (83).
- SHOP_BIRDIE_GATES: each gate's square, its post's foot in pixels ([177,339] and [305,413]) and which way its arm points.
- SHOP_BIRDIE_GATE: a 76 x 82 character with idle, lower and down, drawn pointing east; flip it for the west gate.
- SHOP_BIRDIE_INTERIOR_4 (id shop-birdie-interior-4):
  - idle: 4 x 700 ms with the gates up and dark; birds bob and one row of the board flips.
  - gates-lower and gates-down play the gates for the whole room.
  - A review-<name> for every piece, plus close-ups at 3x: review-zoom-bar-west, review-zoom-bar-east, review-zoom-table and review-zoom-gates (all 7 gate states).
  - The standard animations (entrance, thinking and the rest) reuse the idle.

CALLS ERIC MIGHT CHANGE
- The arms' side faces are a band drawn beside the top, a cheat so both sides show even though the view is from the south.
- I moved the front-run feeder to the counter's west corner and the seed pile to its east corner, so the counter in front of the bartender is clear.
- The raised arm stands next to the post and looks a bit like a second pole at phone size.
