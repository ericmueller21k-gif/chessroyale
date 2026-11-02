# The Colosseum's chess pieces, redrawn as clean Game Boy Advance pixel art (trial: the rook and the knight)

You are drawing **scenery, not a boss**: the giant chess pieces that stand on the board in the middle of the Colosseum in
HunChess's town, where a chess match is watched from the stands. Draw each piece alone, on a transparent background.

## What's wrong today (look first)
Look at every reference (view_reference) before drawing:
- `a-eric-reference.jpg` (and its board close-up `a-eric-reference-board.jpg`): Eric's picture of the look he wants: the arena from high in the stands behind White, pixel art,
  **cream White** pieces, **navy-charcoal Black** pieces, both **trimmed in gold** (a gold band round the base and at the
  collar on Black; the king's cross and the queen's points gold). Note the shapes: chunky Staunton pieces with a stepped
  base, the rook a straight tower with square battlements, the knight a proper horse's head.
- `b-current-computer.png`, `b-current-phone.png` and `b-current-board-closeup-2x.png`: what the game draws today. Its
  pieces are 3D models squashed onto a low-resolution pixel grid, and Eric says they look **"smeared and sloppy… like a JPEG
  saved 100 times"**: muddy in-between tones, shapes that don't read (the rook and knight are lumpy, the knight's head isn't a
  horse), noisy speckles inside the shapes. In his words: *"if you look at a Game Boy Advance game, it's not like the
  drawings are all smeared… correct it so they actually look like defined features of pieces, but still in this Game Boy
  Advance / N64 form."*

## The look we want
- **Hand-placed pixel art, crisp as a Game Boy Advance sprite.** Every pixel deliberate. A clean **1-pixel dark outline**
  all round each piece. **Flat cel shading** in 3 or 4 tones per material (highlight, light, mid, shade), in clean bands
  with the light from the **top left**; no gradients, no dithering, no single stray pixels of an odd tone, no anti-aliasing
  against the outside.
- **Defined features:** the rook's battlements as clear square crenels with gaps you can see, a tower body with a lit left
  face and a shaded right; the knight a horse's head in profile **facing left**: a clear muzzle and jaw, an eye, an ear,
  a mane down the back of its neck in a contrasting tone (gold on Black reads well), on the same stepped base.
- Both pieces stand on the same **stepped base** (a wider lower step, a narrower upper one; the base's top shows as a thin
  flat ellipse since we look from a little above), then the body above.

## Colors (use these keys and values)
- White (cream): `W` `#fcf8ec` highlight, `w` `#eedec2` light, `c` `#ccb494` mid, `C` `#967a60` shade.
- Black (navy-charcoal): `B` `#646a84` highlight, `b` `#3c3e4e` mid, `d` `#242530` shade.
- Gold: `Y` `#ffde8c` highlight, `G` `#e4a848` gold, `g` `#966426` shade.
- Outline: `k` `#2e211a` on White, `K` `#141216` on Black.
- Gold trim on **both** colors: a gold band on the base's lower step and a gold ring at the collar (White's may be its own
  cream if gold looks busy there; Black's always gold, as in Eric's picture). The knight's eye: a dark pixel on White,
  gold on Black.
White and Black are **the same drawing, only the colors differ**: build each piece once (a function or a shared grid with
keys swapped) so the two stay identical in shape.

## The size (important: this is what makes it crisp)
These sprites are drawn **one sprite pixel = one pixel of the arena's pixel grid**, never scaled by a fraction. In the
high view behind White, a board square near White is about **20 art pixels wide**. So:
- **Frame 26 wide x 34 tall**, the piece's foot (bottom center of its base) at **(13, 33)**; center the piece on x = 13
  (the base symmetric about it; odd widths fine).
- Heights, outline included: **rook 19 px**, **knight 22 px** (the full set later: pawn 16, bishop 23, queen 25, king 30).
- Base width, outline included: rook about **13**, knight about **14** (pawn 12, bishop 13, queen 14, king 14 later).
That is small, so features must be designed for the grid: every pixel counts, like a GBA chess game's pieces.

## Format
- One Character, id **`arena-pieces-gba`**, exported as `ARENA_PIECES_GBA`, name "Arena pieces (GBA)", w 26, h 34,
  anchor at the foot (13, 33).
- **Four single-frame animations:** `wr`, `br` (rook, White and Black) and `wn`, `bn` (knight, White and Black). The
  other four pieces come in a later run once Eric approves these two, so make the shared base and palette easy to reuse
  (a base function, the palettes as constants).
- Read `packages/app/src/characters/sprite.ts` for the format; skip the bosses. Import with a path relative to your file:
  `../../../../packages/app/src/characters/sprite.ts`. Never draw letters or numbers.

## How to check
Render `anim: "*"` at `scale` 4 on both backgrounds (`bg` dark and light); the bottom row shows the first piece at 1x and
2x, which is about its true size on a phone and a computer. Check: the rook could never be mistaken for anything else; the knight is unmistakably a horse's head facing left;
no muddy pixels; the outline is unbroken; White and Black match in shape. Pace yourself: a cap of a few dollars, so a few
render-and-fix rounds, then `done` with notes (the frame, the anchor, the palette keys, and how to add the other four).
