# The Colosseum: the API art in the arena (Oct 31, 2026)

## The brief

Swap each of the arena's placeholders for the API run's drawing (`claude/colosseum-art`, `scripts/boss-art/out/arena-*`),
one role at a time at its line in `art.ts`, keeping the pixel look, the draw calls, the pieces (Eric: the game's basic
pieces, never `arena-pieces`), the bosses' seats, the crowd as the town's dressed pawns, a generic statue, and nothing
hiding the board from any seat.

## What changed

The wall and gallery arches, the benches, the torch pillars (flame on 5 frames), the banners (sway on 6 frames), the
floor and the board's border, the statue, and a new railing in front of your seat (`docs/areas/colosseum.md`, "The art").

## Judgment calls

- **Pixel-art figures in the crowd's texture.** The pillars, the statues and the banners are drawn 1:1 into the crowd's
  canvas (nearest-neighbor magnification, uploaded once) and ride in the crowd's draw call; their loops are frames side by
  side, picked in the vertex shader from the clock. The props' canvas keeps only the cburnett pieces, magnified smoothly as
  before. No new draw call; in 3D the props' call has nothing left to draw, so 8 there, not 9.
- **The banners hang flat on their walls** (a fixed facing per instance), not turning to face you as the other figures do.
- **The pillars and the statues stand by the wall** (pillars 9.4 m out, statues 9.5 m and 3 m tall, plinth and all). At
  7.7 and 8.2 m (and before this change too) they stood in the line from several seats to the board's near corners; now a
  test checks no figure hides any of the board (squares and border) from any of the ten views.
- **The border is flush with the squares.** `arena-floor`'s `side` draws a frame raised above the board; raised 0.16 m it
  would hide half a rank from the lowest seats, so its top lies on the plinth's top and its face on the plinth's sides.
- **The benches are cut a seat at a time**, so each seat of `seats()` sits on a seat mark of the drawing (16 px a seat,
  0.62 m); the crowd sits a quarter of a pawn's height into the bench (the drawing's seat points sink 9 of 20 px; less
  here, so the crate items still show).
- **The railing is a 32 px CSS strip** (the drawing 1:1 in CSS pixels, `image-rendering: pixelated`), along the arena's
  foot under the overlay, in the seats' views only (none in the player views), taking no taps. Looking up is limited so
  the board's squares never reach it (`railPitch`, tested on a phone and a computer).
- **Not used:** `arena-crowd-back` (plain pawns would hide the crate items up close; the far stands face you anyway),
  `arena-pieces`, `arena-pieces-2` (Eric's rule).
- **The no-WebGL still** retaken from the eighth seat with the new art.

## Frame rate (eric.md's method)

Headless (software WebGL: SwiftShader, no GPU), a phone 390 × 844 (3x, the canvas capped at 2x) and a computer 1440 × 900,
5 s at the second seat while the bots play (`?fast`), main and this branch taken in turn, four runs each, one pass; the
medians.

| | main fps (runs) | branch fps (runs) | median fps main → branch | script a frame | draw calls |
| --- | --- | --- | --- | --- | --- |
| phone | 12.7, 12.6, 12.7, 12.8 | 12.7, 12.4, 13.4, 13.1 | 12.7 → 12.9 | 0.29 → 0.36 ms | 3 → 3 |
| computer | 7.0, 7.5, 6.6, 6.7 | 6.6, 8.0, 7.7, 7.5 | 6.8 → 7.6 | 0.37 → 0.33 ms | 3 → 3 |

Nothing allocated or uploaded a frame; the frame loop is unchanged (the loops' frames are picked on the GPU). No corner
needed cutting.
