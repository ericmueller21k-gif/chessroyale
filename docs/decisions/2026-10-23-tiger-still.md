# The circus tiger: one still for review (Oct 23, 2026)

**Eric:** a circus tiger who hated his role (the loud roaring, the hoops) and wanted to make the silly balloon animals he saw
someone making. No name yet; his code id is `tiger` (no clash in the roster or the code). Reference: a realistic tiger on all
fours, a small black top hat with a red band, a red and gold ringmaster's vest, one front paw up holding the strings of
chess-piece balloons, a striped tail (`input/1-tiger-balloons-USE.png`; the standing pose is for later). This step is his look
only: one still. His powers (the pump, the balloons, the hoops) and his animations come later.

## What was built

`packages/app/src/characters/tiger.ts`: `TIGER` (`TIGER_PALETTE`, one `idle` frame), `TIGER_PORTRAIT` (his hat and head).
Not in `CHARACTERS`, `BOSS_KITS` or the roster; nothing in the game draws him. The preview draws him with its `extra=` option.
`packages/app/test/tiger.test.ts` checks the still (palette, the stage's 70 px, nothing cut off at the frame's edge, the feet, the
portrait inside the frame).

Parts are painted once and each piece is its own part, so later poses are numbers: the raised paw and its strings, each balloon
(they bob; one is handed to the pump), the hat (it tips), the head and jaw (a yawn, a grin), the ears, the eyes (a blink), the tail
(a swish), the four legs (later he stands on his hind legs).

## Calls made

- **Facing:** the reference flipped, side on, facing our left (toward the board), so the balloons are toward the board.
- **Balloons: four, no king.** Bishop (yellow), knight (blue), rook (green), pawn (purple). The pink pawn is left out (four read
  better than six at this size; Eric's note: four or five). Each balloon has a 1 px dark outline and at least one clear pixel of air
  from its neighbors. The bishop's and rook's silhouettes are typed by hand (the notch, the battlements), the knight's too (a horse's
  head with its ear and mane), the pawn is shaped (it already read). Each has a shine on its top left.
- **Strings** are 1-pixel lines with no outline. The bishop's goes level above his head, then down in front of his nose, so no string
  crosses his face. The paw sits under his chin, below the muzzle.
- **Proportions:** a first pass was long and low; after comparing with the reference (upright, longer legs, a bigger head), the body
  is shorter and shallower, the legs longer, the head bigger, and the hat sits on the larger skull.
- **Face:** the forehead's three black bars, two cheek bars, a cream muzzle and cheek ruff, a pink nose, amber eyes with a black
  slit pupil. It reads as a tiger at 1x (`tiger-face-1x-3x.png`).

## Size

- **Height:** 64 px from the halo to the feet, inside the select stage's 70 px (`TALLEST / PX`, balloons included). The frame is
  78 x 70, the feet at (42, 65).
- **Width, from his feet (halo included):** 41 px left (the balloon bunch), 26 px right (the tail). The phone bar's usual box holds
  24 px each side and `wide` holds 29, so **he needs more than `wide` on the left**: the box must reach about 41 px left of his feet,
  or the bunch must come in. Not changed here: the bunch is what makes the balloons readable.
- **Height on the bar:** 64 px fits the usual height (`tall` isn't needed).

## Palette, in words

Orange fur in five tones (light from the top left), black stripes, cream chest, muzzle and paws, amber eyes with a black pupil, a
pink nose, a black hat with a red band, a red vest with gold trim and two gold buttons, four balloon colors in four tones each
(yellow, blue, green, purple), green-brown strings, outline `#1d120e`, halo `#2c2622`: the same conventions as the others.

## Simplified for the pixel size

- The body has three black stripes on the back and three on the tail; the legs have one band each and no toes (three dark nails).
- No whiskers; the cream muzzle carries the face.
- The vest is one red panel with a gold trim and two buttons; it shows under the chin, the arm covers part of it.
- The hat is a typed top hat, a crown, a band and a brim, tilted by nothing yet.
