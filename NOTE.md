# Birdie's lobby, round 4: stills (Nov 23)

**Read first:** the runner did not read round 3's drawing (`shop-birdie-interior-3.ts`). Its tools refused that path, so it redrew the whole room by eye from `lobby-first-frame.png` and Eric's marked screenshot. The layout follows round 3 and the eight changes, but palette and pixel detail are copies, and the export shapes beyond `SHOP_BIRDIE_N`, `SHOP_BIRDIE_GATES` and `SHOP_BIRDIE_INTERIOR_4` are guesses. Decide whether to keep this drawing or redo it with round 3 in view before wiring.

## Spend (API, Opus 5.5, high effort)
- Run 1 (stopped): **$1.47**. Its drawing turn ran out of output room (48,000 tokens); nothing was saved.
- Run 2 (retry, 64,000 token ceiling): **$2.92** of a $6.50 cap. It finished and called done.
- Total: **$4.39** of the $8 Eric approved. No plan usage.

## The run's own check against the brief's eight changes
1. Bar arms raised: the bar is one U-shaped piece, 148 x 184 px, its top raised 36 px (the front face's height). Each arm has a 14 px charcoal side face toward its stools: the west one lighter, the east one darker. Each face has a dark base strip and the red stripe along its whole length. The tops are warm wood with a cream edge. Each arm's south end meets the front face at an angled corner where the two red stripes join, with no gap and no flat patch. The feeders stand on the raised tops.
2. Stools along the arms: three a side at col 4 and col 9, rows 1-3, seats tucked against the side faces. Birds sit on the west row 1 and 3 stools, the east row 2 stool, and the front col 5 and 7 stools.
3. Bigger seed: the vat (42 x 40 px, col 6 row 1) holds a 40 x 21 px mound of yellow, cream, brown and red seed with a scoop in it. The pile on the counter is 24 x 12 px. Both sized about double round 3's by eye, since the old ones could not be measured.
4. Front-left corner: the gravel, rails, ties, X marks and posts are gone; it's plain checker floor with the safety line.
5. Crossing at the table: a 296 x 36 px strip across row 7, cols 2-9: gravel, wooden ties, two steel rails and yellow-and-black striped edges. It stops one square short of each side wall's safety line, and only the table and its two stools stand on it.
6. Two gates at Eric's marks: west gate at col 4 row 6, north of the tracks, just left of the bar's front-left corner, arm pointing east; east gate at col 8 row 8, south of the tracks, just right of the table's east stool, arm pointing west. Each is a 1 x 1 square piece: striped post, red-and-white crossbuck, two red lights side by side, a motor box and a striped arm with a counterweight. idle: arm straight up, lights dark red. lower: 4 frames of 160 ms (62°, 34°, 10°, level), lights alternating. down: arm level, lights left then right, 500 ms each, looping.
7. No feeders at the table: the two on its top and the two on the floor are gone. The five on the bar stay.
8. Square chess table: 30 x 47 px, a yellow-rimmed charcoal frame around an 8 x 8 board of cream and warm wood on one wooden leg with a foot, standing on the gravel, with one stool west (col 5) and one east (col 7). No pieces on it.

## Exports
- `SHOP_BIRDIE_N` (12), `SHOP_BIRDIE_SQUARE` (37), `SHOP_BIRDIE_WALL` (83).
- `SHOP_BIRDIE_GATES`: each gate's square, its post's foot in pixels ([177,339] and [305,413]) and its arm direction.
- `SHOP_BIRDIE_GATE`: 76 x 82 px, with idle, lower and down, drawn pointing east; flip it for the west gate.
- `SHOP_BIRDIE_INTERIOR_4` (`shop-birdie-interior-4`): idle (4 x 700 ms, gates up and dark), gates-lower and gates-down, plus `review-*` pieces and 3x close-ups.

## Stills
- `lobby-first-frame.png`: the new room, frame 0, at 1x (444 x 527 px).
- `compare.png`: Eric's marked screenshot (left) beside the new room at 2x (right).
- `gates.png`: the gate character: idle, lower (4 frames), down (2 frames), at 4x.
- `table.png`: the chess table and its stools on the tracks, at 4x.
- `bar-arms.png`: both raised arms and their stools, at 3x.

## Open for Eric or the director
- The room was not drawn from round 3's file (see the top). Check its palette and pixels against round 3 before wiring.
- The runner's preview of the final animation failed; its frames were checked by hand in the drawing run.
