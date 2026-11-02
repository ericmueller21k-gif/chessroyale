# Boss art: arena-stands

- Model claude-opus-5-5, effort medium, adaptive thinking. 6 turns, 2 renders.
- Spend: **$0.35** of the $2 cap (14 input, 27,726 cache-write, 86,179 cache-read, 9,566 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/arena-stands/arena-stands.ts.
- Previews: scripts/boss-art/out/arena-stands/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/arena-stands/looks/.

## Its notes

I drew arena-stands as a 64 x 88 straight slice of four tiered stone bench rows with a low front parapet at the bottom. It's one idle frame. I rendered it at 4x on dark and light backgrounds, and with tile "x" the left and right edges join with no visible seam.

**What's in it**
- **Colours:** the coliseum's travertine 1–6 and outline k, same keys and values. The light comes from the top left. There are no letters, numbers or figures.
- **Each row is 19 px tall, back row first, and each is its own part.** From top to bottom, a row has:
  - a lit bench top (5 px) with a faint groove between seats every 16 px (at x = 0, 16, 32, 48);
  - a bright front lip (1 px), then a dark shadow line under it;
  - a shaded riser (11 px) in two courses of stone blocks, with the joints staggered row to row.
- **Seams:** every pattern repeats every 16 px, so it tiles cleanly at 64 px. Each part's outline runs past the frame's left and right edges, so no dark line shows where slices meet.
- **Foot:** (32, 88), the bottom centre. The bottom edge (the parapet's foot) sits on top of arena-wall. Row tops are at y = 1, 20, 39 and 58, and the parapet starts at 77.

**Exported points**
- `ARENA_STANDS_SEATS`: 16 points, [x, y] with x = 8, 24, 40, 56 in every row. The y values are 29, 48, 67 and 86, from back row to front. Each is 9 px below the top of the stone in front of it, so a 16 x 20 pawn shows its top 11 px and the rest is hidden.
- `ARENA_STANDS_ROWS`: four bands, back row first, with top and bottom both inclusive and the outline included: {0,19}, {19,38}, {38,57}, {57,76}. Bands next to each other share their outline line.

**One addition you should check:** the lowest row's seats need stone in front of them to hide their lower halves. So the slice ends in a low parapet (y 77–87), the "first row's front", which is a fifth part called "front". This adds an export the brief didn't ask for, `ARENA_STANDS_FRONT` = {top 76, bottom 87}, which the game's code will need to handle. The drawing order is: row0, its crowd, row1, crowd, row2, crowd, row3, crowd, then front.

**Choices you might want to change**
- I left out the halo, since this is scenery that tiles edge to edge.
- The seat grooves are subtle; they could be removed or made stronger.
- The stone has a little speckle (grain) for texture, and there are no navy or gold accents.
- If you'd rather not have the parapet, the front row's seats could sit below the frame and be hidden behind arena-wall instead.
