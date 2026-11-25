# The town square, slice 1: the world at /town (Oct 26, 2026)

## Eric's words (Oct 26, trimmed)

"we would go through it like one thing at a time… if you just rendered the world and all that was live for me, like a
URL… being able to run around and with… say a couple of the boss houses… and then the sky, and that was all it was,
then… I can feel, see how it feels, and we could throw a couple bots in there… somewhere on a hidden URL, but then we can
drop in more stuff and build it out from there."

Then, the same evening: two more homes (Jefferson's, Hollow's); keep the walk's idea but tune it if it can feel better,
subtly, with the prototype's numbers kept beside ours; every number that shapes the feel in one file; his own pictures
for Ginger's, Hollow's and a fifth home, Moo & Moon's (`docs/mockups/town-square/*.webp`), replacing the descriptions;
the homes' names written by the game two ways, to compare.

## What's in slice 1

The town square's world, playable at the hidden address `/town`, phone and computer: the sky with its drifting clouds,
the curved 40 × 40 ground that loops, the haze at the far edge; five boss homes, about 8 squares from your start in five
directions, each with its boss roaming near it (their real idle frames) and now and then saying one of its lines; six
bots wandering the plaza; you, your pawn in the middle with a gold ring and your name. Tap to walk, drag to look, "Back
to me", − / + zoom, chips to the homes off screen. The code is its own chunk, loaded only on that page. Area page:
`docs/areas/town-square.md`.

The homes and their names: **Ginger Igloo**, **Hollow Peak**, **Moo & Moon Meadow** (Eric's names), **Jefferson's
Fireworks** and **Babur's Circus** (the director's).

## Left for later

The bottom strip, the boss card and "Challenge alone", the player card ("Invite to party", "Trade"), the shop, the Arena,
the other bosses' homes, dressed pawns, real players and rooms (the server), the Simple map setting, a loading bar,
sounds.

## The camera

The prototype's numbers, unchanged (`town/feel.ts`, `camWide` and `camTall`, the zoom's four numbers).

## Judgment calls

- **The walk, tuned a little** (Eric allowed it, subtly). Kept: 90 ms a square, square to square, the hobble's hop (0.12
  of a square) and tilt (3.6°). Changed: (1) your first step eases off from standing and your last eases into the stop
  (`walkEase` 0.5; the prototype's 0 started and stopped at full speed); the steps between stay even, and the eased curves
  meet them at the same speed, so a long walk keeps one pace with no jolt between squares. (2) The camera follows on a
  critically damped spring (`followSpring` 14) instead of the prototype's exponential follow (rate 7): it trails a walk
  by the same 1.6 squares, but eases into motion instead of jumping to full speed the moment you set off, and settles
  without a jerk. Either goes back in one line.
- **Where the homes stand:** Ginger's straight ahead (so the first view has a home and its boss in it), Babur's to the
  right, Jefferson's to the left, Hollow's behind on the right, Moo & Moon's behind on the left.
- **Homes' size:** 37 picture pixels a square, so the tent (144 pixels) is about 3.9 squares wide, like the prototype's
  placeholder roofs. Each home's picture stands half a square in front of its plot's middle; the plot is tinted a little
  darker (the prototype's 0.9). The bosses keep the prototype's size (their frame 3 squares tall). Hollow Peak stands
  taller than the rest (150 pixels: Eric allowed it).
- **The art** follows each reference's idea and shape in the game's own pixel style and the bosses' palettes, without the
  grey plate under each picture. Ginger's frosty cottage, drawn first from the director's description, was redrawn as the
  igloo when Eric's picture came; Hollow's den likewise became the peak, without the string of lights. Jefferson's stand
  carries its name on a header board under its roof rather than a sign on posts (a stand's natural place for it).
- **Names, both ways, both on:** the floating name fades in from 4 squares from the plot to fully there at 2, rising 6
  pixels; the sign's name is written in the game's pixel font (Press Start 2P, already the game's) and only at 6 pixels
  or more, so a far home's board stays blank rather than smudged.
- **The bosses roam** up to 2 squares from their plot (the prototype: the 1-square ring), 1 or 2 squares a walk, pausing
  1.2 to 2.8 s. A line every 3.5 to 6.5 s, from a boss on screen and not deep in the haze, one at a time, for 3.2 s (the
  prototype's). Moo's pixel icons in his lines show as ♥ and ? (as in the prototype).
- **The bots:** six of the prototype's names (Berlin Wally, Castle Cass, Gambit Gwen, Fork Frank, Tempo Tess, Pin Pete),
  three tinted (pink, light blue, dark green); one walks every 2.6 to 4.2 s to a free square 2 to 4 steps away, never onto
  the ring next to a home. You and the bots are one list of people (`town.people`) that the drawing and the taps only
  read: the director's note, so real players replace the bots later without touching the drawing.
- **You are the plain pawn** with a gold ring and your name in a gold tag. The dressed pawn (`components/Items.tsx`,
  `Avatar`) is SVG layers per item; drawing it on the canvas is more than a small job, so it's for a later slice.
- **Taps:** a home, a boss or a bot walks you to the nearest free square next to it; your own pawn and the sky do
  nothing; a square you can't reach does nothing (the prototype's toast is left out: no new text).
- **Speed:** the squares' seams are drawn as a fill under each square's inset face rather than a stroke (strokes cost
  most of a frame's time in the browser's software path; the look is the same). Measured headless for 5 s while walking:
  about 58 fps on a phone (390 × 844) and 52 fps on a computer (1440 × 900, a box 2.2× the prototype's), level with the
  prototype in the same runs.
- **Stockfish isn't warmed on /town** (nothing there plays chess; it would cost a phone while the world first draws), as
  on /autochess.
- **While the page's code loads** (a moment, once), the screen is its plain background: no loading bar (the brief).
- **The feel file** is `packages/app/src/town/feel.ts`, not `packages/core/src/settings.ts`: these are the client's own
  look-and-feel numbers, nothing the rules or the server read (the director's suggestion).
- **Main bundle:** 2,248,855 → 2,250,493 bytes (+1.6 kB; +0.97 kB gzipped): the page's mount, its lazy loader, and the
  main chunk now exporting the 16 bindings the town's chunk shares with it (the bosses' sprites, `renderFrame`, Preact).
  The town's chunk: 55 kB (+2 kB of CSS).
