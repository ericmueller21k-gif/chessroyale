# Big Boy's intro, second pass: bigger B and W stool blocks

The first brief (`scripts/boss-art/briefs/intro-bigboy.md`) still holds, except where this one changes it. Your drawing
exists: **read it first** (`scripts/boss-art/out/house-intro-bigboy/house-intro-bigboy.ts`). Revise it with
`edit_drawing`; don't rewrite it. Change only the two stool blocks: the table blocks, the build, the plop, the palette and
the swirl stay as they are.

## What Eric asked for (Nov 2, his words)
"Please double the size of the blocks that you sit on, the black color side block should be a B and the white color
side block shows a W. Can make the colors of the block also a dark dark gray and a bone off white color if that makes
sense."

## The stools
- **Twice the size:** about 22 px wide, with an 8-row top and a 16-row front, instead of 11 / 4 / 8. They stay where the
  park table's stools stand (x 18 and x 92 in the 111-wide picture) and stand on the same ground line as the table
  blocks. Grow the picture's frame if they'd touch its edges.
- **The black side's block:** a very dark gray toy block (near black but still a gray, so its faces and outline read),
  with a big **B** on its front in a light color.
- **The white side's block:** a bone or off-white toy block (warm, not pure white), with a big **W** on its front in the
  dark gray.
- **Look:** both are lit from the top left like the other blocks, with the same toy-block style (rounded corners, a glint,
  the letter's little drop shadow).
- **Which side is which:** in the drawing (`chairs` and `idle`), put the **B** block on the **left** and the **W** block
  on the **right**. Also export each stool as its own small `Character`, `INTRO_BIGBOY_STOOL_B` and
  `INTRO_BIGBOY_STOOL_W`, each with an `idle` (the still block, its foot at its bottom middle) and a `drop` (its fall,
  squash, bounce and settle, as in `chairs`, cue `stool` on the landing frame). The game can then put each on the side
  of whoever plays that color.
- **Seat:** the stools' tops are now about twice as high over the ground as the park stools' seat (`SEAT_H` 10). Say in
  your notes how high each stool's top is, so the code helper can raise the sitting players to match.

## Looks
- Render `chairs` and `idle` frame by frame at 3x on both backgrounds.
- Then render the review sheet at scale 1, **one frame only** (a many-image request can't take a picture over 3,000 px).
- Check that the B and W read clearly at the town's scale and that the blocks don't touch the frame's edge.

Call done with notes: the stool sizes, their tops' height, the new exports and their feet.
