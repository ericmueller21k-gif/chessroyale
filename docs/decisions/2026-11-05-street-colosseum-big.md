# The street town, round 6: the Colosseum looms; Moo's and Ginger's homes up in their rows (Nov 5, 2026)

Eric (Nov 5): "make it taller and bigger, so it really feels like a true overwhelmingly large kind of building … you won't actually be
able to see the Colosseum unless you're running towards it." Still an admin's town only (`STREET_TOWN`); today's town keeps today's
Colosseum. Brief: `notes/briefs/brief-street-colosseum-big.md`. Round 5: [2026-11-05-street-fixed-view.md](2026-11-05-street-fixed-view.md).

## The Colosseum, grander

- **One builder, two sizes** (`houses/coliseum.ts`): `build(Size)` draws both. Today's (`TODAY`) is drawn pixel for pixel as before (its
  parts, sign, lights and pools hash the same). The street town's (`STREET`):
  - **About twice as tall:** its wall 294 px where today's is 150. Six tiers of arches where it had three, marble pawns in two of them,
    a taller tier of windows, the attic's checkered band. Its top (the flag's tip) is 547 px over its foot, today's 357.
  - **A quarter wider:** its oval 608 px (16.4 squares) where today's is 472, 33 bays where it had 27.
  - **The same building:** its palette, light, stone, seats, chessboard arena, banners, pennants and flag are today's.
  - **The gate** stays on its two squares (54 px wide, 100 tall), under a bigger tablet (124 × 44, so "THE COLOSSEUM" is written larger),
    a bigger relief, and over them a medallion with the game's crown: more height above the gate.
  - **Six long banners** on its face, six pennants on its far rim.
  - Its statues and chess pieces stand where they stood, side by side on its front line (round 5's test unchanged); no back pawns.
- **Why a quarter wider and not more:** its sides then stand over the grove's inner columns (15, 16 and 29, 30) and stop short of the
  walls' gates. Wider, it would cover the gates or reach the plaza's corners.

## Over the rooftops

- **Drawn from everywhere.** Round 4 drew it only where a straight line from you reached it past the lots (`colosseumSeen`). That's gone:
  - **Past the rim** (`render.ts drawFarStreet`), it stands where it really is, at its true size and the world's curve. It's drawn first,
    behind everything, clipped to the horizon (the curve hides its foot). From the streets south of it, its top tiers rise over the rows.
  - **Inside the rim** it's sorted with everything else by its front line, as before. Every row south of it is nearer, so it's drawn over
    it; the walls, gates, grove and back wall north of its front line are farther, so it's drawn over them.
  - Today's town keeps its far drawing (`farReach`, `farSink`).
- **One haze from near to far** (`streetColHaze` 0.4): the far band's haze, never more. It's drawn solid, not see-through, as a
  building that big would be.
- **A tap on a row's front** never opens it behind the front (`pick`): its top shows over fronts that used to hide it.
- **Where it shows** (the unit test, phone and computer, its top's columns every 4 px over every nearer box and tree, counted as the
  whole box round each block):
  - from South Street west, up the promenade and east of it;
  - from Fountain Street's east end, across the park.
  - Fountain Street's west end and Colosseum Row's ends have it off to the side, past the view's edge.

## Beside it and behind it

- **Nothing walkable**, as in round 5: its ground and the grove four columns either side, to the edge.
- **The plan** (`scripts/street-plan-north.py`, its round 6 section; `street-plan.json` rebuilt): the grove's squares under its wider sides
  stay grove; their trees and shrubs (24 trees, 4 shrubs) go, since they'd stand inside it.
- **The walls and gates keep their lots** (round 5's checks unchanged). Its sides cover their inner halves; their outer halves and
  gates show beside it. The back wall and grove behind are hidden by it, as before; only sky shows over it.

## Moo's paddock and Ginger's dome

- **Why they looked sunk or short:** their pictures' feet are on their rows' front line like every home's (within 3 px), but a paddock's
  fence and an igloo's dome stand 104 and 90 px over their feet, beside fronts of three and four floors.
- **The call:** draw both 1.3 times bigger in the street town (`streetHomeScale`; `rows.ts homePx`). Their feet stay on the row's line,
  so they grow up, not down. 1.3 is the most the rows hold (round 4); Moo's, now 4.5 squares across, slides a quarter square inward
  at its row's end, as any home too wide does. Their doors, rest squares, strips and cards are unchanged and tested.

## Frame rate

Measured as round 5 did. The numbers are in the PR body (`docs/street-colosseum-big/pr-body.md`).
