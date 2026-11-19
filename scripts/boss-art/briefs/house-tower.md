# The Battle Tower, from the street: a skyscraper in Chess Town

You are drawing a **building**, not a boss: the front of the Battle Tower, a new building in Chess Town (the town where players
walk among the chess bosses' homes). It uses the same sprite format as the bosses (`Character`), with only an `idle`
animation. The render tool's boss checks don't apply (it knows: the id starts with `house-`).

## What it is (Eric, Nov 18-19)
"It's a giant skyscraper ... 99 floors." Players go into the town, walk into "the big building in there", talk to the clerk at
the front counter, then "go up and then it begins": a climb of 99 floors, a chess game against the bosses on each floor. So
from the street it must read at a glance as **the tallest thing in town, a real skyscraper whose top is lost toward the sky**,
with a welcoming glass front door and a sign over it.

## Read first
- How homes are drawn: `packages/app/src/town/houses/kit.ts` (`paint`, `grain`, `groundShadow`, `signBoard`, `signFace`,
  `LightSpot`, `LightPool`, `WARM`, `LANTERN_LIGHT`). Import it with a path relative to your file
  (`../../../../packages/app/src/town/houses/kit.ts`), and the format from `../../../../packages/app/src/characters/sprite.ts`.
  No other imports.
- The town's tallest home today, The Walk-up (a 4-story corner walk-up, 144 x 224, foot [72, 218]):
  `/home/user/main-wt/packages/app/src/town/houses/recluse.ts`. Match its light (from the top left), its outline, its ground
  shadow, its pixel scale (a story is about 44 px there; a skyscraper's floors are lower, see below) and its level of detail.
  Rolling Dough's bakery (`/home/user/main-wt/packages/app/src/town/houses/zebra.ts`) shows a sign board and its `signFace`.
- `/home/user/main-wt/packages/app/src/town/home-boxes.ts`: every front stands on its lot's front line, and the game builds the
  building's sides and roof as a box behind it from numbers measured off the front (`body`, `eave`, `door`). Your notes give
  those numbers (below).
- References: `street-walkup-phone.png` and `colosseum-row-phone.png`, the street town on a phone today (the default zoom):
  how big a 4-square front looks, the rows of plain look-alike townhouses (about 3 to 4 stories) that will stand beside it, and
  the sky behind. Your tower stands on such a row, so it must tower over them.

## The colors: HunChess's own (not a boss's)
The game's own palette, from its screens: deep slate `#16181d`, `#20232a`, `#2a2e37`, `#343946` (the app's dark surfaces), a
cool lit slate about `#4a5163`; **gold** `#f4b740` (the accent), `#c8860d` (its deeper tone), a dark gold about `#8a5c08`;
cream `#f3f1ec` and white `#ffffff`; the chessboard's squares `#f0d9b5` (light) and `#b58863` (dark). Build ramps from these
(add in-between shades as needed). Outline `k` a near-black slate (about `#0e1014`). Warm lit windows in the town's lamp
colors (about `#ffb85c` and `#ffe2a0`); dark glass a slate blue (about `#2a3446` with a `#5a6a84` glint).

## The design
An **Art Deco skyscraper** (the 1930s kind: strong vertical piers, gold trim, a stepped silhouette), in slate and gold:
- **Frame:** about **144 px wide** (the lot is 4 squares, 148 px; the other homes are 144 wide) and **about 520 to 600 px tall**,
  foot at `[72, h - 6]` (the ground shadow under it). That's many times the Walk-up's 224: it must clearly be the tallest thing
  on its street. Keep the whole picture under 600 px tall.
- **The base (the lobby floors, the bottom 70 to 90 px, the full width, about x 4 to 140):** a grand entrance in the middle,
  - a **glass front door**: two tall glass doors in gold frames (about 28 to 34 px wide in all, 34 to 40 tall), warm light
    inside, a glimpse of a checkered lobby floor through the glass; a step or two of pale stone in front;
  - over the door a **sign board for the name** (the game writes "BATTLE TOWER" on it in its own pixel capitals, dark ink, so
    **never draw letters**): a light face (cream or pale gold) at least **62 px wide and 13 px tall**, framed in gold, built
    like `signBoard` or by hand; export its face with `signFace` (below);
  - a gold Art Deco sunburst or a small gold chess-king crown over the sign (an emblem, no letters);
  - tall lobby windows either side of the door, lit warm; slate piers with gold capitals; a pair of lamps or sconces by the
    door (their light as `LightSpot`s);
  - a **checkered band** (the board's tan and brown, small squares) running across the top of the base, a chessboard frieze:
    the one strong touch of "chess" on the outside.
- **The shaft (above the base):** set back a little (about x 12 to 132), straight up, **floors about 9 to 11 px each** (so
  dozens of floors show): slate piers running the whole height with thin gold lines, and between them rows of windows, most
  dark slate glass with a glint, **about one in six lit warm** (scattered, not a pattern). Optional: one more setback higher up
  (the shaft narrowing once, about x 24 to 120), if it reads.
- **The top is lost toward the sky:** no roof, no spire, no top edge is ever seen. Over the top 90 to 130 px of the picture
  the tower **dissolves into the sky**: its pixels thin out in an ordered dither (fully see-through pixels mixed in, more and
  more of them going up) until nothing is left, and two or three soft pixel-art **cloud wisps** drift across it there (white
  and pale blue-white, flat-bottomed puffs like the town's clouds). Use see-through pixels for the dissolve (not a painted
  sky color), so it melts into whatever sky the town shows: day, dusk or night. Keep the outline off the dissolving edge.
- Nothing hangs past the frame's sides; nothing else stands on the lot (no trees, no fences): it's a city tower on its row.

## idle
Four to six frames, about 600 ms each, calm: a few of the shaft's lit windows go dark and others light (two or three per
frame), a slow glint slides down the glass front door, the cloud wisps drift 1 px. Nothing else moves.

## Exports
- `HOUSE_TOWER: Character`, id `house-tower`, name "Battle Tower".
- `HOUSE_TOWER_SIGN = signFace(...)` (the sign board's face, where the game writes the name).
- `HOUSE_TOWER_DOOR`: the front door's middle x (px).
- `HOUSE_TOWER_LIGHTS` (`LightSpot`s: the door's lamps and the lobby glass) and `HOUSE_TOWER_POOLS` (`LightPool`s on the
  ground in front), as the Walk-up's.
- The picture is drawn lazily by the game: each `paint` function must not lean on anything that changes after the call (a
  shared random number, a variable set later). Use a fixed hash of (x, y) for scatter (lit windows, wear).

## Looks
Render the idle at 2x (one frame only: it's tall) on dark and on light, then at phone size beside other homes (render's
`with`: `house-gardener`, `house-tiger`) to check it towers over them, and look at the base at 4x (it's what players stand in
front of). Check: the sign board is blank and big enough; the glass door reads as the way in; the dissolve reads as a tower
going up into the sky, not a broken picture.

Call done with notes: your choices; the frame size and foot; and **the box's numbers** for the game: the base's x range and
height over the foot, the shaft's x range (and the setback's, if any) and the height where the dissolve begins, the door's
middle, the sign face.

## How to write it
Write a short skeleton first (palette, the base, a plain shaft, the dissolve) and render it; then add the detail with
`edit_drawing`, rendering as you go. Keep each turn's writing under about 500 lines.
