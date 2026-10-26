# The town square, slice 3: all thirteen homes (Oct 26, 2026)

## Eric's words (Oct 26)

He sent ChatGPT pictures for seven more homes: "they are just suggestions, you can make the final call… Jefferson's
firework stand was good work." And for Alfil: "I'll let you design Alfil's pyramid." The pictures are small webp copies in
`docs/mockups/town-square/` (`clown-funhouse`, `bigboy-crib`, `sawyer-woodshed`, `pig-stall`, `smudgy-gallery`,
`hopper-grassland`, `gardener-botanical`).

## What's in slice 3

Eight new homes, drawn in the game's pixel style like the first five (each picture's idea and shape, not its pixels; no
grey plate; about the tent's size; a blank sign board the game writes on; a small idle), each with its boss roaming near
it (its real idle frames and `SELECT_LINES`) and an edge chip with its head:

| Home (the director's names) | Boss | Idle |
| --- | --- | --- |
| Boingo's Funhouse | Boingo (`clown`) | the marquee bulbs chase |
| Big Boy's Crib | Big Boy (`bigboy`) | the mobile turns |
| Sawyer's Woodshed | Sawyer (`sawyer`) | the lantern flickers, the blade glints |
| Wrangler's Stall | Wrangler (`pig`) | the awning flutters, the lantern flickers |
| Smudgy's Art Gallery | Smudgy (`smudgy`) | a drip of paint runs down |
| Chub & Chirp's Grassland | Chub & Chirp (`hopper`) | the carrot top wiggles, the tall grass sways |
| Puddles' Botanical Garden | Puddles (`gardener`) | the fountain's water runs |
| Alfil's Pyramid (our design) | Alfil (`alfil`) | the banners stir, the capstone glints |

## The layout

Thirteen homes on the 40 × 40 world that wraps: the points of a lattice on the torus (14 points, step (40/14, 3 × 40/14),
one of them the Coliseum's middle), so the homes are as evenly spread as they can be: every home's nearest neighbor is 8
to 10 squares away, so you walk a little between neighbors and the world never feels empty. The **Coliseum's 6 × 6 ground**
(columns 17 to 22, rows 16 to 21) is kept clear in the middle, and **you start just south of it** (20, 13), facing it
(north is ahead of the camera). Of the lattice's orientations, the one chosen keeps every home at least 7.8 squares from
the start, so the plaza around the middle (where the bots stand) stays open. Pairs that play off each other stand side by
side: **Ginger Igloo and Jefferson's Fireworks** (ice and fire), on the left as you start; **Hollow Peak and Moo & Moon
Meadow** (dark and night), ahead on the left; Alfil's Pyramid stands straight ahead beyond the Coliseum.

A text map, two squares a character, north up (`#` the Coliseum's ground, `@` your start):

```
F...................   F Boingo's Funhouse (0, 39)
...............GG...   G Smudgy's Art Gallery (31, 36)
...............GG...
...........AA.......   A Alfil's Pyramid (23, 33)
.......M............   M Moo & Moon Meadow (14, 30)
...H...M............   H Hollow Peak (6, 28)
...H................
..................CC   C Big Boy's Crib (37, 25)
..............BB....   B Babur's Circus (29, 22)
.........###..BB....
.........###........
.....II..###........   I Ginger Igloo (11, 16)
.....II.............
.JJ.......@.........   J Jefferson's Fireworks (3, 13)
.................W..   W Wrangler's Stall (34, 10)
.............S...W..   S Sawyer's Woodshed (26, 8)
.............S......
........PP..........   P Puddles' Botanical Garden (17, 5)
....RR..............   R Chub & Chirp's Grassland (9, 2)
....RR..............
```

## Judgment calls

- **The layout** as above: a lattice for evenness (the most even 14 points on this torus have neighbors 9 squares apart),
  the orientation that keeps the plaza open, and the boss for each point chosen for the pairs and for the first view
  (two homes on the left, Babur's on the right, the pyramid straight ahead past the Coliseum).
- **The Coliseum's ground is only kept clear of homes**: you and the bots can walk across it until the Coliseum is built.
- **Chips no longer stack.** With thirteen homes, the four nearest off-screen homes often point the same way, and their
  chips landed on top of each other. A chip that would overlap a nearer home's chip now slides along its edge until it's
  clear (`CHIP_GAP`, 50 pixels); its arrow still points at its home. Still four chips at most, nearest to you first.
- **Where each sign hangs:** in the funhouse's marquee arch (the picture's lettering was misspelled; ours is the game's),
  on the crib's bars, on posts by the woodshed and the pyramid, on the stall's and the grassland's front rails, among the
  gallery's vines and on the greenhouse's gable, so each stays in view and covers no doorway. Alfil's pyramid: six sandstone tiers lit from the left, a gold capstone, a stone lintel
  over a dark doorway with a carved elephant in a panel above it, his red and blue banners trimmed in each other's color
  with gold discs and fringe, fallen blocks and sand; the sign on posts at its front left so the doorway shows.
- **The chips' faces**: a box in each boss's first idle frame (`BOSS_FACE`), each checked at 2× (Alfil's moved from his
  headdress to his face).
- **Shared pieces** (balls, crates, lanterns, pines, flowers, grass tufts, log ends) are in `houses/kit.ts`, so the homes
  stay alike in their details. Grass tufts and strings have no outline (an outline made thin blades look like arrows).
- **Frame rate**: only homes and bosses drawn inside the rim cost anything (a boss's frames are drawn the first time each
  shows; the rest is a little arithmetic a frame). With more homes in view on a wide computer box, its first seconds cost
  more while newly seen bosses draw their idle frames once; after that it's back near slice 2's. The numbers are in the PR.
