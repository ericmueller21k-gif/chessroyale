# The boss select as a fighting game's grid: touching tiles, edge to edge, bigger (Oct 23, 2026)

> Superseded the same day by [2026-10-23-boss-select-sf.md](2026-10-23-boss-select-sf.md): Eric asked for the Street Fighter 6 look
> (gaps, one size, a figure per tile, always five to a row). Still true here: the 10 px buffer, `rowSizes`, the stage's trim on short
> screens (made larger there) and the tests' method (sampling the block, probing either side of an edge).

Lane: `characters`. Area pages: [bosses.md](../areas/bosses.md), [hub.md](../areas/hub.md). Builds on
[2026-10-16-boss-character-select.md](2026-10-16-boss-character-select.md), which still says why the screen looks as it does.

## What Eric asked for

Oct 21: "The icons on the boss page should be basically the full width of the screen with a little bit of a buffer on the
top and the left and the right. And then they're touching borders... the frame that they're in now, that slanted square, is
fine... like a real fighting game, like a Tekken or Street Fighter... Super Smash."
Oct 23: "do the edge to edge on the bosses. And I may even say you could probably even make them their boxes a little bit bigger too."

## What it is now

- **Full width.** The block of tiles spans the column: a 10 px buffer at the top (under the header) and on the left and right.
  The page pads 18 px on a phone (32 px in the computer's frame), so the block takes the rest back with a negative margin.
- **Touching.** A row's tiles share their slanted edge (each starts one slant back under the last; the slant is 16% of a tile's
  width, the same in every row), the rows meet, no gaps. One thin frame line between neighbors: each tile's own 1 px ring and
  its neighbor's make 2 px; the block's outer line is 1 px of padding plus the ring, also 2 px.
- **The slanted frame is kept.** Each tile is the same parallelogram as before (`clip-path`), so a tap lands on the right tile
  even where the boxes overlap.
- **Bigger.** Five to a row on a phone, seven from 480 px. A tile's box (width x height), before to after:

  | Window | Before | After | After, at mid-height |
  | --- | --- | --- | --- |
  | 320 x 568 | 44 x 39.6 | 68.3 x 61.5 | 57.4 |
  | 360 x 740 | 50.7 x 45.6 | 77.5 x 69.8 | 65.1 |
  | 390 x 844 | 55.7 x 50.1 | 84.4 x 76.0 | 70.9 |
  | 428 x 777 | 62.0 x 55.8 | 93.1 x 83.8 | 78.2 |
  | 430 x 932 | 62.3 x 56.1 | 93.6 x 84.2 | 78.6 |
  | 1280 x 800 | 76.0 x 68.4 | 89.1 x 80.2 | 74.8 |

  The portrait grows with the tile (62% of a full row's tile width), and so does the "?".

## The calls I made

1. **Rows nest by cutting their outer ends straight, not by shifting each row by the slant.** Each row's first tile has a
   vertical left edge and its last a vertical right edge, so the block is a clean rectangle: an even buffer on both sides, no
   triangular bites at the ends, no holes inside (a test samples every few pixels). Shifting each row by one slant would make
   one continuous diagonal lattice, but the block's edges would slant (an uneven buffer, a bite at the top left and bottom
   right), and the end tiles of a lower row would lose a third of their width to the cut, below the 44 px target at 320 px.
   The dividers of one row step by a slant against the next row's, a brick-like stagger: the "tile effect" Eric liked on Oct 16.
2. **The short row's tiles are wider, so every row ends flush** (fourteen on a phone: 5, 5, 4). Not centered (it would leave the
   block's foot ragged and the buffer uneven) and not an end cap (a fifth, empty slot would read as another boss, or a locked
   one). Row height is the same in every row; the portraits and the "?" keep the size they have in a full row.
3. **How many to a row is worked out, not written down** (`rowSizes`): as few rows as the per-row count allows, the tiles shared
   out evenly, the longer rows first. Fourteen: 5, 5, 4 on a phone and 7, 7 wide; fifteen: 5, 5, 5; sixteen: 4, 4, 4, 4 on a
   phone and 6, 5, 5 wide. A new boss never leaves one tile alone on a row, and nobody has to edit CSS per boss (the old layout's
   "two rows of six and the last two on a third" was rewritten with every new boss).
4. **Seven from 480 px.** A 560 px column (the Boss raid screen's most) with five to a row would make tiles 100 px wide and the
   block 300 px tall. Switching at 480 keeps the largest five-to-a-row tile at about 105 px (it would be 114 at 520) and the smallest seven-to-a-row one at 76 px, both in the range of the phone's tiles. The breakpoint is the
   window's width, which is the column's up to 560 px; on a computer the column is 560 px and the block 540 (the same 10 px).
5. **The picked tile's frame is 3 px of gold** (a ring inside its own shape, as before), over the neighbors' 1 px lines. A press
   (`scale(0.95)`) shows the frame's color around the shrunk tile instead of a gap of the page's color.
6. **A screen 700 px tall or less has its stage 220 px wide, not 280**, because the bigger tiles pushed the ways to play down:
   at 320 x 568 their first row would have left the window altogether (it started 549 px down before and showed its top 19 px).
   With the trim it starts at 549 px, as before, and the first way to play is whole in the window at 360 x 640, 375 x 667 and
   from 740 px tall up. This is the only thing trimmed; the stage, the bubble and the name keep their sizes above 700 px.
7. **The sizes checked:** 320 x 568, 360 x 740, 390 x 844, 428 x 777 (Eric's iPhone in Safari), 430 x 932 and 1280 x 800, in light
   and dark, plus 360 x 640 and 375 x 667 by measurement.

## Tests

- `e2e/boss-select.spec.ts`: the grid (light and dark), at the six sizes: five or seven to a row (5, 5, 4 or 7, 7), neighbors'
  boxes meet one slant apart, rows meet, the outer ends in line, a 8 to 12 px even buffer, the block no wider than the window,
  no bare point in the block and its four corners tiles, every tile larger than before (at least 15% each way, the old sizes in
  the test) and a 44 px target (its height, and its width at mid-height). Every tile tapped by its middle; either side of every
  shared edge, at its top, middle and foot, the right tile is hit; the press; the gold frame; the Hidden Boss's dark tile; the
  "?" whole inside its tile. The layout test keeps its stage and sideways-scroll checks at the same sizes and adds that the
  first way to play stays in the window.
- A point counts as bare only when no tile is within half a pixel of it: two shapes meeting at a fractional position leave a
  hairline a hundredth of a pixel wide at 320 px that nothing can tap, while a hole in the block would be many pixels wide.
- `packages/app/test/boss-select.test.ts`: how the tiles are shared out over rows, for fourteen to sixteen and every count to
  sixty.

## Player-visible text

None changed. (Everything that moved is the tiles' size and place, and the stage's width on a short screen.)
