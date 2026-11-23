# Birdie's station, from the street: a little train station with a big nest on its roof

You are drawing a **building**, not a boss: the front of Birdie's station, a new home in Chess Town (the town where players
walk among the chess bosses' homes). It uses the same sprite format as the bosses (`Character`), with only an `idle`
animation. The render tool's boss checks don't apply (it knows: the id starts with `house-`).

## What it is (Eric, Nov 23)
"A little train station with a big nest sitting on top." Birdie is Eric's young mourning dove, who rides a yellow toy diesel
train. This is his home in Chess Town: players tap it and go in to its lobby (drawn separately). So from the street it must read
at a glance as a **cozy, charming little train station with a huge bird's nest on its roof**, the nest's rim drooping a little
over the eaves. It's small, not a skyscraper: a one-story station, the nest the one big thing about it.

## Read first
- How homes are drawn: `packages/app/src/town/houses/kit.ts` (`paint`, `grain`, `groundShadow`, `signBoard`, `signFace`,
  `LightSpot`, `LightPool`, `WARM`, `LANTERN_LIGHT`). Import it with a path relative to your file
  (`../../../../packages/app/src/town/houses/kit.ts`), and the format from `../../../../packages/app/src/characters/sprite.ts`.
  No other imports.
- Match the town's homes for light (from the top left), outline, ground shadow, pixel scale and level of detail: read
  `packages/app/src/town/houses/tiger.ts` and `packages/app/src/town/houses/gardener.ts`. Those are the neighbors your station
  stands beside (`house-tiger`, `house-gardener`): the station must read as its own building next to them.
- `scripts/boss-art/out/house-tower/house-tower.ts`: a finished building drawn this way (its box numbers, its sign face, its
  lights), as a worked example of the notes you'll write.
- The game builds each home's sides and roof as a box behind its front, from numbers measured off the front (`body`, `eave`,
  `door`). Your notes give those numbers (below).
- No reference photos for this one yet: the design below is the reference.

## The colors: Birdie's train (not a boss's)
The train's yellow, charcoal and red are the trim; warm wood for the walls; the nest's browns. Suggested ramps (add in-between
shades as needed): train **yellow** about `#f4c430`, deeper `#d9a21b`, a pale `#ffe27a`; **charcoal** `#2b2d31`, `#3a3d44`,
`#54575f`; train **red** `#c8372d` with a deeper `#8e1f1a`; **warm wood** `#a86a3c`, `#7a4a26`, `#c99866`; the **nest's browns**
`#3f2a18`, `#6b4a2b`, `#8a6038`, `#b58a55`, with a few pale straw bits `#e6cf94`; cream `#f3f1ec` and white `#ffffff` for the
sign. Outline `k` a near-black warm brown (about `#1a1714`). Warm lit windows in the town's lamp colors (about `#ffb85c` and
`#ffe2a0`); dark glass a slate blue (about `#2a3446` with a `#5a6a84` glint). Make it warm and bright, not gloomy.

## The design
- **Frame:** about **144 px wide** (a 4-square lot, 148 px, like the other homes) and **about 240 to 280 px tall**, foot at
  `[72, h - 6]` (the ground shadow under it). About the height of the Walk-up, so it sits on its street as a station, with the
  nest on top. Keep the whole picture under 300 px tall, and nothing past the frame's sides: the nest stays inside the 144.
- **The station (the body, about x 8 to 136, from the foot up to about 120 px over it):** a one-story station with warm wood
  boards (vertical planks, a grain) and cream trim, a low **charcoal roof** with a **train-red stripe** along the eave, and a
  yellow fascia board.
  - **A platform canopy** over the front: a sloped, charcoal awning on two slim posts, its edge in train yellow, the way a
    station platform's roof reads. It shelters the door.
  - **The main door** in the middle: a pair of wooden doors with a warm glass pane each, lit warm inside (about 26 to 30 px wide,
    34 to 40 tall), with a step of pale stone in front.
  - **A ticket window** on one side of the door: a small, lit window with a cream counter ledge and a little brass grille. No
    letters.
  - **A station clock** high on the front, over the door: a round face in a charcoal frame with a yellow ring, tick marks, and
    two hands. **No numbers.**
  - **A pennant** on a short pole at one roof corner: a train-red flag with a yellow stripe.
  - **A chimney** at the other corner: a short brick-red stack with a charcoal cap (a wisp of smoke in the idle).
  - **Benches** out front, one each side of the door, on the ground: warm wood slats on a charcoal frame.
  - **A sign board** over the door, under the canopy: a light face (cream or pale yellow) at least **62 px wide and 13 px tall**,
    framed in train yellow, built like `signBoard` or by hand, and exported with `signFace` (below). The game writes the name on
    it, so **never draw letters**. The working name is "Birdie's Station"; Eric may rename it.
- **The nest (the big one, on the roof):** a **big bird's nest of woven twigs**, clearly a nest: a bowl of interlaced twigs in the
  nest's browns, a few pale straw bits, the rim thick and round and **drooping a little over the eaves** on both sides (not
  past the frame). It sits on the roof's ridge, about 132 to 140 px wide and about 40 to 50 px tall, cozy and a little
  lopsided, with some twigs sticking out. No eggs (nothing else on it).
- **Ground:** a soft ground shadow under the station, the benches and the step. Nothing else stands on the lot (no trees, no
  fences): a station on its street.

## idle
Four to six frames, about 600 ms each, calm: the pennant flutters (two or three positions), a wisp of smoke rises from the
chimney and drifts a few pixels, a twig in the nest shifts one pixel (one frame), one or two of the lit windows flicker a shade.
Nothing else moves.

## Exports
- `HOUSE_BIRDIE: Character`, id `house-birdie`, name "Birdie's Station".
- `HOUSE_BIRDIE_SIGN = signFace(...)` (the sign board's face, where the game writes the name).
- `HOUSE_BIRDIE_DOOR`: the front door's middle x (px).
- `HOUSE_BIRDIE_LIGHTS` (`LightSpot`s: the door's glass, the ticket window, the clock's glow if any) and `HOUSE_BIRDIE_POOLS`
  (`LightPool`s on the ground in front), as the other homes'.
- The picture is drawn lazily by the game: each `paint` function must not lean on anything that changes after the call (a
  shared random number, a variable set later). Use a fixed hash of (x, y) for scatter (lit windows, wear, the straw bits).

## Looks
Render the idle at 2x (one frame only: it's tall) on dark and on light, then at phone size beside the neighbors (render's
`with`: `house-tiger`, `house-gardener`) to check it reads as a station with its nest, and that it stands in its row. Look at the
base at 4x (it's what players stand in front of) and the nest at 4x (it has to read as a nest, not a bush). Check: the sign board
is blank and big enough; the door reads as the way in; the nest reads as a nest; nothing is cut off at the sides.

Call done with notes: your choices; the frame size and foot; and **the box's numbers** for the game: the body's x range and its
height over the foot, the roof's height, the canopy's x range, the nest's x range and its height over the foot, the chimney's x,
the door's middle, the sign face.

## How to write it
Write a short skeleton first (palette, the station's body and roof, the nest as a plain bowl) and render it; then add the detail
with `edit_drawing`, rendering as you go. Keep each turn's writing under about 500 lines.
