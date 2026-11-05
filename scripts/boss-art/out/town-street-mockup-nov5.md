# A street town: mockups (Nov 5)

For Eric to look at and steer. Mockups only: no app code changed. Everything here is drawn by
`scripts/boss-art/town-street/` (the plan `plan.ts`, the rough fronts `facades.ts`, the renderer `harness.ts`, the plan
picture `plan-map.ts`, every still `stills.ts`), using the town's real camera (`town/camera.ts`: curve, pitch, the
zoomed-in default), its sky (`town/sky-draw.ts`), the real homes, Colosseum, statues, park props, bosses and the pawn, at
the town's scale (37 picture pixels a square).

```sh
npx tsx scripts/boss-art/town-street/stills.ts            # every still and sheet
npx tsx scripts/boss-art/town-street/plan-map.ts scripts/boss-art/out/town-street/0-plan.png
```

## The stills (`scripts/boss-art/out/town-street/`)

| File | What it shows |
| --- | --- |
| `0-plan.png` | The revised plan, 46 x 46, north up: the five streets (board) and their sidewalks, the plus park with 12 tables, South Lane, the Colosseum in its grove, every lot (the 16 boss homes named, the everyday ones as roofs with their front edge pale, the bigger ones behind in grey with a shadow), the back gardens, and arrows for which way the camera faces on each street. The key, the numbers and the four quarters are beside it. |
| `1-park-phone.png`, `1-park-computer.png` | In the park, just south of the fountain, looking north up the promenade: the new east-west walk crossing at the fountain, the tables tucked into the lawns' corners by the walks, the plaza, and the Colosseum beyond (drawn from afar, sunk behind the curve, as the game does today). Bots at two tables. |
| `2-street-day-phone.png`, `2-street-day-computer.png` | On Seam Street (the Gallery), by day: the fronts wall to wall (bakery, townhouse, Puddles' Botanical Garden, skinny houses, shop, Smudgy's Art Gallery on the computer), the bigger buildings behind them (blocks with water tanks, a clock tower), the sky over the rooftops. Puddles out on the sidewalk by her home (and Smudgy by his, on the computer). |
| `3-street-sunset-*.png` | The same at dusk: the town's own dusk sky and tint, the windows, shop fronts and lamps lit. |
| `4-turn-phone.png`, `4-turn-computer.png` (and the frames `4-turn-before/mid/after-*.png`) | Walking west on Seam Street and turning north onto Seam Avenue at the crossing: before (facing north), mid-turn (north-east), after (facing east, at the avenue's fronts). The camera still follows you; the fronts foreshorten as it swings, people and lamps keep facing you. |
| `5-near-phone.png`, `5-near-computer.png` (and `5-near-open-*`, `5-near-cut-*`) | The near side of a street, two ways, side by side: A, no near row (back gardens); B, a near row cut away low. |
| `6-seam-phone.png`, `6-seam-computer.png` | Standing on the corner where both seams cross (Seam Street meets Seam Avenue). The white dotted lines are drawn on only to show where the seams are: in the game nothing shows. |
| `7-everyday-buildings.png` | The sheet of everyday buildings: eight rough fronts, each in two colors, then Seam Street's west row as the plan has it, wall to wall, with the bigger buildings behind. |

Sprites always on screen: every figure in every still (you, the bots, the bosses) was checked by its drawn pixels
(`view.ts` flags any cut off by the frame); none is.

## My calls

### The camera faces one way per street (and why the plan looks the way it does)

The camera always faces across a street at its far row, so it always sees fronts. Every east-west street faces **north**
(as the town does today, so the park, the plaza and the Colosseum keep their look); the one north-south street, **Seam
Avenue, faces east**. So every block has its fronts on its south side (on Seam Avenue, its west side), and its back gardens
on the side you never look at. That is why each street in the plan is lined on one side and has back gardens on the other:
from the camera every street is wall to wall, and no building ever needs a back drawn.

### The near side: no near row (recommended), over a cut-away row

`5-near-*.png`. **A, no near row**: the near side of a street is the back gardens of the next street's row, behind a low
hedge: flower beds, bushes, the odd shed, the sidewalk's lamps. Nothing there stands taller than about a square, so
nothing ever covers you or anyone near you; tall things that do stand there (a tree) fade out as they pass between the
camera and you, as the shops' near pieces do now. **B, a near row cut away**: both sides of the street built up, the near
row drawn as the backs of its walls cut off at knee height, like a dollhouse.

I recommend **A**. It reads as a street you've been dropped into, it leaves the near sidewalk clear to tap, it needs no art
for backs that are never seen whole, and it's cheaper to draw (B drew 30 to 60% more front strips in these stills). B tells
you there's a row behind you, but the cut walls look like a stage set across the bottom of the screen. (Faded full backs,
the other choice, put big see-through shapes over the bottom of the screen, which reads worse than either and costs the
most; low roofs only would read much like B from the camera's height. I didn't mock those two.)

### The Colosseum stays one flat front picture, always seen front on

No more angles and no 3D build. The plan keeps every view of it front on:

- It stands where it is today (12 x 12, its gate facing south over its apron), and it is only ever on the far side of a
  north-facing view: from the park, the plaza on Colosseum Row, and (from afar) Fountain Street in the park.
- Trees fill its grove on both sides and behind it; Upper Street ends at the grove on both sides rather than passing it;
  Seam Street runs behind it, facing north, so it's behind the camera there.
- The only street that faces another way, Seam Avenue, is 16 or more squares from it, past the horizon in both directions.
- The far drawing (today's `drawFarColiseum`) would only be drawn while the camera faces within 45 degrees of north.

### The corner turn

- The camera's heading belongs to the street: north on the east-west streets, the park, the plaza and South Lane; east on
  Seam Avenue. It turns only at Seam Avenue's four crossings (Seam Street, Fountain Street, Colosseum Row, Upper Street),
  eased, I'd say, over the crossing's four squares (about half a second at a run), turning about you, so it keeps following you.
  The mid-turn frame is that halfway point (45 degrees).
- Turning north from westbound Seam Street keeps you running the same way on the screen (left), which is the turn that
  feels best; turning the other way flips which way you run on the screen, as walking round a real corner would.
- The fronts are flat pictures standing in the world on their lot's front line (not billboards turned to face the
  camera), so as the camera swings they foreshorten like walls; people, trees and lamps stay billboards, as today.
- The sky is a backdrop: the clouds slide across it as the camera turns, so the turn reads, but the sun stays where it is,
  so the sunset is always in view whichever way the street faces.
- The hedges along a street's edge are billboards in the mockup, so mid-turn they look stepped (`4-turn-mid-*`). A build
  would stand them up as planes too, like the fronts.

### The seam

The wrap stays, and nothing shows when you cross it (`6-seam-*.png`): the world was already a wrapped one, and now the
seams carry streets, so walking off one side is just walking down Seam Street or Seam Avenue. Stopping the camera at the
far left and right doesn't fit a town whose streets turn: Seam Avenue runs along that seam, Seam Street would be cut in
two, and the edge would need a wall the camera can face. So: keep the wrap.

### The default view

Every still is at the zoomed-in view (the town's zoom 0), which would become the default (today `feel.ts` opens zoomed
out). On the phone it shows about 10 squares across at the fronts, the sky over the rooftops in the top quarter. On the
computer it is close: the fronts and the bigger buildings behind them reach the top of the screen, and the sky shows
between and over the lower ones. If Eric wants sky over every roof on the computer too, the computer could open a step out
(the town's zoom about 0.3), or the buildings behind could stay under 4 squares tall.

### The plan's numbers

- Streets: 4 squares of chessboard, a sidewalk of 1 on each side.
  - Seam Street (rows 44 to 1, across the north-south seam), Fountain Street (13 to 16; its middle is the park's new walk),
    Colosseum Row (21 to 24; its middle is the plaza before the Colosseum), Upper Street (30 to 33, ending at the grove);
    Seam Avenue (columns 44 to 1, across the east-west seam); South Lane (paving, columns 21 to 24, from the park down to
    Seam Street).
- Lots 3 deep. Fronts: boss homes 4 squares wide (Alfil's pyramid 6), everyday ones 2 or 3, the bigger ones behind 2 or 4.
- 16 boss homes, 17 everyday fronts, 10 bigger buildings behind; 107 squares of street front in all (Seam Street 36,
  Fountain Street, Colosseum Row and Upper Street 20 each, Seam Avenue 11 plus four corner side walls).
- The four quarters, Eric's pairs side by side:
  - Seam Street, the Gallery: Puddles, Smudgy | Folio, Alfil (either side of South Lane).
  - Fountain Street, Fire & Ice: Timber, Sawyer | Ginger beside Jefferson.
  - Colosseum Row, the Funfair: Boingo, Babur | Big Boy, Dash (either side of the Colosseum's plaza).
  - Upper Street, the Meadow: Chub & Chirp, Wrangler | Moo & Moon beside Hollow.
  - Seam Avenue: everyday fronts only.
- The park: 20 x 12 (columns 13 to 32, rows 9 to 20: a row more than today, to the south), the promenade and the new walk
  each 4 wide, crossing at the fountain; the middle table on each side gone (the walk is there), 4 added (two north and two
  south of the walk), 12 in all, 3 in each lawn, each tucked into the lawn's corner by the walks; no trees on the walks.
  The four walks lead out: north onto Colosseum Row, west and east along Fountain Street, south down South Lane.
- One thing the boss homes being 4 squares wide means: on a 46-square world with fronts on one side of each street, about
  two thirds of the street front is boss homes. The everyday buildings are narrow (2 or 3) and the bigger buildings
  behind fill the skyline, so the streets still read as a town with the homes among it.

## What's rough or a stand-in

- The everyday fronts are rough (drawn by code, to be drawn properly once Eric picks), and so are the side walls on Seam
  Avenue's corners, the hedges, beds, bushes and sheds.
- The chess tables' tops are a plain stand-in (the slab and the board's squares, no pieces). Names are in Arial (the
  game's Archivo Black isn't installed here). Timber's and Dash's homes are the drafts from `out/house-timber` and
  `out/house-blitz` (no sign text).
- The lights at dusk are simpler than the game's (no flicker, a plain blur for the spill), and the haze on the fronts is
  laid on as a flat wash.

## What it would take to build

1. **The plan** (`world.ts`): streets, sidewalks, lots, back gardens and their props, the new park plan and lamps, where
   you start, what's walkable (streets, sidewalks, the park; not the lots or the gardens), where each boss wanders (the
   sidewalk in front of their own home).
2. **The camera turning** (`camera.ts`): a heading; every projection turns world squares into the camera's frame first
   (`harness.ts` `rel`); the ground's square scan becomes a turned one; taps (`pickSquare`) and arrow keys go through the
   heading too; the heading zones and the eased turn (new numbers in `feel.ts`).
3. **Flat fronts in the world** (`render.ts`): each building drawn as upright slices on its front line (so it follows the
   curve and foreshortens), its lights and haze the same way; the near-side rule (no buildings drawn between the camera and
   you; tall props fade); the Colosseum's far drawing only facing north.
4. **The art**: the eight everyday designs drawn properly, with color variants; corner side walls; hedges and the garden
   things; Timber's and Dash's homes wired in.
5. **Tests**: the e2e and unit tests that know today's map (the start square, the lamp ahead on your left, the tables).

## What could hurt the frame rate

- **The front slices.** The mockup draws each front in 2-pixel slices: about 400 to 580 slices a frame on the phone and
  650 to 1,000 on the computer (`stills.ts` prints the counts), and twice that where the haze lays its wash. That is fine
  in the town's WebGL painter (one batch of quads) but too many for the 2D fallback on an older phone. A build needs far
  fewer: on a straight street the curve is gentle, so 4 to 8 slices a front (100 to 200 a frame) look the same, more only
  while the camera turns.
- **The lights at dusk and night** double the slices for every lit front; baking each front's glow into a second texture
  (as `bakeGlow` does now) keeps that one more draw per slice.
- **More things on screen**: about 80 to 100 things a frame on the phone and 130 to 170 on the computer, against today's
  open board (the gardens' props are most of them). They're all small, but they're sorted every frame.
- **The cut-away near row (B)** adds 30 to 60% more slices; the recommended option (A) draws nothing there.
- The sky and the ground cost what they do today.
