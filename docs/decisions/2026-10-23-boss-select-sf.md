# The boss select as Street Fighter 6's: one tall tile, a figure and a color each, five to a row (Oct 23, 2026)

Lane: `characters`. Area pages: [bosses.md](../areas/bosses.md), [hub.md](../areas/hub.md). Replaces the look of
[2026-10-23-boss-select-grid.md](2026-10-23-boss-select-grid.md) (touching tiles with portraits), which came the same day.

## What Eric asked for

With a Street Fighter 6 character select as the picture (`eric-ref-sf6.jpg`), Oct 23: "we go back to there's a little bit of a gap
between each one. And they all should be the exact same size, with that kind of slanted rectangle look. And then I want the
character model... the full character sprite, but it simply gets... cut off on the corners of the boxes nicely, so it looks...
like they fill it out completely. And we don't need to put their names in it... use, I think, probably like their neck area ish as
like the starting point... You can see like what a typical profile shot for these characters looks like."

Then: "make the background kind of appropriate based on their colors, but... it can't be something that makes it so they're difficult
to see", and "just 5 per row, and it doesn't matter if you're on a desktop... we have the space anyway to run down vertically".

## What it is

- **One tile, the same for every boss.** A tall slanted rectangle: its slant a fifth of its width, its visible width (the width at
  mid-height) 1 to 1.55 of its height, so the box is 1.24 as tall as wide. A 5 px gap between neighbors (along their slanted edge)
  and between rows, a 2 px frame (3 px and gold on the picked one), the press shrink as before. No names on the tiles.
- **Five to a row, always** (a phone and a computer: the 480 px breakpoint for seven is gone). 5, 5, 4 now, 5, 5, 5 at fifteen
  (`rowSizes`). A short row is centered and its tiles are the same size as the rest (never stretched).
- **Phone:** the block spans the screen with the same 10 px buffer at the top and both sides. **Computer:** the tiles stop growing at
  96 px (the size on the biggest phone), so the block (423 px) sits in the middle of the 540 px column; rows are centered.
- **The figure.** Each boss's whole sprite (the frame its portrait is cut from) is drawn at full size on a canvas (`BossArt`), scaled
  crisp (`image-rendering: pixelated`) and placed by a framing table (`SELECT_FRAMING`): the **neck** (a point in the frame) is
  pinned to the tile's middle, `at` of the way down it, and `span` frame pixels fit across the tile. The head is above, the body runs
  on past the foot, and the slanted corners cut off the rest. The scale is by CSS from the tile's width, not a whole number of
  screen pixels: tiles are 67 to 96 px wide and a whole-number scale would need a size measured in JS; the existing stage scales its
  sprite the same way.
- **The color.** A color of the boss's own palette (`SELECT_TINT`), softened into a gradient with `color-mix`: darker in the dark theme
  (52% of it over the dark fill at the top, 34% at the foot), lighter in the light theme (34% over the light fill, 52% at the foot). The
  Hidden Boss's tile stays dark and "?" keeps the neutral fill.

| Boss | Color | Why it stands out |
| --- | --- | --- |
| Ginger | `#3fae4f` | her browns and white icing |
| Boingo | `#4aa3ff` | white face, red hair |
| Jefferson | `#e5566a` | orange and yellow on a dark rose |
| Hollow | `#ffcf3a` (his eyes' yellow) | black and violet on gold; any dark tint made him vanish |
| Big Boy | `#a24cf5` | skin and teal shirt |
| Sawyer | `#e1262c` | gray raccoon, yellow hat; the weakest (his grays are near any dark tint: 19% of the figure) |
| Wrangler | `#fff3b0` | pink pig, brown hat |
| Alfil | `#1d3d8c` | browns and tusks |
| Chub & Chirp | `#9fd8ff` | brown rabbit, green grasshopper |
| Smudgy | `#0e5c60` | bright green frog |
| Moo & Moon | `#5d7ad8` | the cow's whites and browns, the yellow Moon |
| Puddles | `#7fe0ae` | pinks |

## The calls I made

1. **"1 wide to 1.55 tall" is the tile's visible width (at mid-height), not its box.** The box is 1.24 as tall as wide. As a box
   ratio of 1:1.55 the grid would be 400 px tall on a 390 px phone and the stage could not fit under it (at 428 x 777 it would have
   been 113 px wide). 1.24 is also what the reference's tiles measure (about 1:1.3 in the box).
2. **Each boss has its own neck point, scale and neck height** (`neck`, `span`, `at`), because the sprites differ a lot: Wrangler
   is wide and short (his whole figure fits, so his neck is low in the tile), Jefferson tall with a long neck, the Hidden Boss a
   whole standing man. Tuned by eye in the 4x sheet of all fourteen tiles, both themes, then solved so a test can hold them: the
   head, hat and ears inside the tile (down to its tallest, 1.24), the body running on to the foot, no bare strip at either side.
3. **A boss's frame is the one its portrait is cut from** (`kit.portrait`): for most bosses the first frame of the idle, for Boingo a later one.
4. **The two-character bosses show both:** Chub & Chirp's frame is the rabbit riding the grasshopper, Moo & Moon's the cow holding
   the Moon; both fit the tile.
5. **Colors from the palette, and measured.** For each boss I scored every color of its palette by the share of its figure's pixels
   within 50 (RGB distance) of the tile's gradient, in both themes, and picked from the best, then spread the hues so neighbors
   differ (a row of blues made the first sheet dull). A test holds every figure under 20% close to its background (the worst now,
   Sawyer, is 19%) and that every color is one of the boss's palette.
6. **The tile ratio and the stage on a short screen.** The three rows of tall tiles are 320 px tall on a 390 px phone, so the stage is
   210 px wide, not 280, up to 800 px tall (Eric's iPhone is 777), and 170 px up to 700. With that the first way to play is whole in the
   window at 428 x 777 (772 of 777), 390 x 844, 360 x 740, 430 x 932 and 1280 x 800 (794 of 800). A 320 x 568 phone shows the boss's name
   and strength and scrolls to the ways to play (they start 14 px below the window; before the first grid they showed 19 px). Eric
   said he's happy to scroll ("we have the space anyway to run down vertically").
7. **Hidden Boss:** his full sprite as the black silhouette with the violet edge (1 px glow), framed the same. His tile's name is still
   "Locked boss".

## Tests

- `e2e/boss-select.spec.ts`: the grid, light and dark, at 320 x 568, 360 x 740, 390 x 844, 428 x 777, 430 x 932 and 1280 x 800: 5, 5, 4;
  every tile the same size and shape (1.24 tall, the slant a fifth of its width, 44 px targets); 4 to 6 px gaps between neighbors and
  rows, the same everywhere; each row centered; the phone's buffer (8 to 12 px each side and the top, even) and the computer's 96 px cap and
  room; bigger than the first grid; a figure covering each tile at its sides and foot, a color each (twelve different), no names; "?" and its
  tile; the gaps bare (nothing of a figure spilling out) on both sides of every slanted edge and between rows; no sideways scroll. Every tile
  tapped; either side of every gap, at its top, middle and foot, the tile that side and nothing in the gap; the press; the gold; the Hidden Boss's
  dark tile; the "?" whole in its tile. The layout: the stage under the tiles, the first way to play whole in the window from 740 px tall,
  the name and strength in it at 568.
- `packages/app/test/boss-select.test.ts`: `rowSizes` (14 to 17 tiles and every count to 60); each boss's framing (the tile's box in its
  frame: no bare strip at the sides, the head inside the top, the figure's ink reaching the foot); a palette color for each boss and none that
  blends into its figure in either theme (the stylesheet's mix constants are read from the file).
- `e2e/home-ranked.spec.ts` looks for the tile's figure (`canvas.bs-art`) where it looked for the portrait.

## Player-visible text

None changed. (Tiles lose nothing: they had no words. The names are still the tiles' accessible names.)
