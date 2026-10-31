# Boss art: arena-town-square

- Model claude-opus-5-5, effort medium, adaptive thinking. 11 turns, 5 renders.
- Spend: **$0.44** of the $3 cap (24 input, 32,630 cache-write, 224,513 cache-read, 11,560 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/arena-town-square/arena-town-square.ts.
- Previews: scripts/boss-art/out/arena-town-square/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/arena-town-square/looks/.

## Its notes

I drew `arena-town-square` (exported as ARENA_TOWN_SQUARE, name "Town square"). The frame is 112 x 36 with a transparent background, meant for 2x or 3x on the Chess Town button. I rendered all six frames at small and large scale on both the dark and light backgrounds, and it reads clearly on both.

**The picture, left to right:**
- A round tree.
- Three house fronts with gable roofs:
  - Cream with a red roof and a red-and-white striped awning.
  - Peach with a blue roof, taller, behind the table.
  - Pale blue with a red roof, a navy-and-gold striped awning and a flower box.
- An iron lamppost with a gold lantern.
- Cobbles across the whole bottom.
- In the middle, a wooden park table with a checkered board and three small pieces on it.
- A white pawn and a black pawn, in the game's pawn shape with no faces, sitting on stone stools on either side of the table.

Everything is outlined in `k`, lit from the top left, with banded shading, plus a faint warm halo so it stands out on the navy panel. There are no letters or numbers.

**`idle`: 6 frames at 250 ms (1.5 s loop):**
1. All still; a small red bird appears at the right, past the lamppost.
2. The white pawn leans in (up 1, right 1) and lifts a white piece off the board.
3. The piece is at the top of its hop and the black pawn bobs up 1.
4. The piece lands two squares over and the white pawn sits back; the black pawn is still up.
5. The black pawn comes back down.
6. All settled; the bird flaps right to left across the sky the whole loop.

The loop starts with the moved piece back in its first square, so the move plays again every 1.5 s.

**Choices you might want to change:**
- **No awning on the middle house:** I left it off because its stripes behind the board made the pieces hard to read. So only two houses have awnings; the middle one has a window with a flower box instead.
- **Table colour:** the table is wood rather than the town park's grey stone, so it stands out from the cobbles and walls.
- **Pawn size:** the pawns are big compared with the houses (their heads come up past the table), on purpose so they read at a glance.
- **Empty right edge:** there's a little empty space right of the lamppost; the bird starts its flight there.
- **The bird:** it's small (5 x 2 pixels plus its outline) and is the subtlest part of the motion. It could be made bigger, or turned into a leaf.
- **Halo:** it's `#fff4dc30`; drop it if the light mode looks fuzzy.
