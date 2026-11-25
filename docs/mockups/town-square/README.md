# Town square prototype (Oct 25, 2026)

`prototype.html` is the look-only prototype of Boss raid's town square that Eric tested on his phone. Open it in a browser;
it is one self-contained file (images and fonts inlined), with nothing connected to the game. Its plan is in `ROADMAP.md`,
"Boss raid: the town square". Add `#noblur` to the address to see the far-edge fade without the extra blur.

What it shows: tap a square to walk (about 90 ms a square, a little hop and tilt); drag to look; "Back to me"; −/+ zoom
(and the mouse wheel); chips at the edge pointing to bosses off screen; a boss card with "Challenge alone" and the
"Test2 is battling …" label; a player card with "Invite to party" and a greyed "Trade · Coming soon"; the 13 bosses roaming
near their placeholder homes with their real idle animations and lines; a 40 × 40 world that loops; the far edge fading into
haze. You are your small pawn in the middle (the big pawn in the corner was dropped, Oct 25). On a phone the map takes most of the screen above an empty strip; on a computer the menus and a static panel picture
sit around it. The houses, the pawns' look, the clouds and the bubbles are placeholders.

## The camera it settled on

Drawn on one 2D canvas. A pitched pinhole camera over a ground that drops away from the focus point (a small round world),
cut at a rim that forms the horizon. Heights and distances are in board squares; the map box's width-to-height ratio blends
the two sets (0.6 = phone, 1.4 = computer).

| | Height | Pitch | Back | Curve radius | Sideways curve | Focal length | Lens centre | Rim |
|---|---|---|---|---|---|---|---|---|
| Computer | 7.8 | 36° | 6.7 | 30 | 0.40 | 0.72 W | 0.39 H | 11.5 |
| Phone | 9.3 | 42° | 5.7 | 30 | 0.42 | 1.31 W | 0.36 H | 12.5 |

- The horizon sits about 22% down the map box (as in Eric's reference), about 14 rows out, about 10 columns across the bottom
  on a computer and 5.6 on a phone.
- Zooming out raises the camera 1.75×, moves it back 1.45×, adds 6° of pitch and lets the rim reach 25% further.
- The last 30% of the way to the rim blends toward the sky (93% at the rim); far sprites fade, haze and blur (a cheap
  scale-down blur that works without `ctx.filter`). Houses, bosses and pawns are drawn only once their square is inside
  the rim, always whole, fading in over their first half square; the haze strip is drawn behind them.
- Frame rate in a headless browser with software rendering: about 54–59 fps on both sizes. Not yet measured on a real phone.

## Eric's pictures for the homes (Oct 26, 2026)

`ginger-igloo.webp` (Ginger Igloo), `hollow-peak.webp` (Hollow Peak) and `moo-meadow.webp` (Moo & Moon Meadow): small copies
of the pictures Eric sent for the bosses' homes. The game takes each one's idea and shape, drawn in its own pixel style
(`packages/app/src/town/houses/`); the names are written by the game, never part of the art. Slice 1 of the square is at
`/town`: `docs/areas/town-square.md`.
