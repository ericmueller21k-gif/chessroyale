# The street town, round 4: joined rows, the chase camera and a town that wraps east-west only (Nov 5, 2026)

Eric (Nov 5), on round 2's stills: "I described it like the Toontown streets where everything is literally connected… you literally
need to connect the houses." Later: "They don't need to like literally be drawn together… They just need to be attached like that. And
then most of them aren't actually like real buildings… they look alike." Every built side of every street is now one continuous row of
fronts, the camera chases you down the street, and the town is a square with the Colosseum at its north edge. Still an admin's town
only (`STREET_TOWN`). Brief: `notes/briefs/brief-town-rows.md`. The mockup Eric saw: `docs/street-town-rows/mockup/`.

## The world's shape (Eric's call)

Eric: "the Colosseum sits at the top centre, at the north edge … nothing is behind it and you can't loop round behind it"; "the
town's streets … funnel north into that Colosseum plaza. To reach the Colosseum you always run up through the town"; "the south edge
is closed by a row of buildings"; "left and right wrap (Pac-Man style)".

- **One switch:** the plan's `wrap` (`{ "ew": true, "ns": false }`); `camera.ts WRAP`, set by `world.ts` as the street town loads.
  Eric may close east-west later ("you'd have to go make that full run back"): flip `ew`, and give the rows' wrapped sides ends.
- **The plan** (`street-plan.json`, made from the art's by `scripts/street-plan-north.py`, so it can be made again):
  - the art's rows 0..39 move up 6. Its Seam Street (rows 44..1, across the old seam) is now **South Street**, rows 4..7, the bottom
    street. The art's rows 40..43 (gardens and a sidewalk north of the Colosseum's grove) go, so the Colosseum's top row is the
    world's north edge (row 45). **Still 46 × 46**: rows were not added.
  - Rows 0..2 are the **closing row**, the whole way round (its fronts face north onto South Street; nothing behind it).
  - The Colosseum's grove either side of it (columns 13..16 and 29..32, row 31 up to the edge) is **paved: the plaza**. Colosseum
    Row runs along its south side, Upper Street opens into it from west and east, and the park's promenade runs up to its gate. A tree
    stands at each strip's outer column.
  - **Seam Avenue ends at Upper Street**. North of it, the avenue's columns are Upper Street's sidewalk and lots, so Upper Street's north
    row runs from the plaza's east side round over the wrap to its west side.
  - The tall lots north of Upper Street keep their columns, 2 rows deep. Every home keeps its lot, door, rest square and wander box,
    moved up with the rows.
- **In code:** `wrapFX` and `wrapFY` (offsets the short way round, each axis by its switch), and `colI` and `rowI` (-1 off the world).
  These are used by:
  - the camera (`rel`) and the ground (off-world squares are a plain meadow, nothing on it; you can't tap them);
  - paths (`findPath`, `stepsFrom`: never a step off the world), `walkable` (false off the world), and the bots' and bosses' targets;
  - distances (`tdist`, `plotDist`, a name's fade);
  - the arrow keys (a step off the world is no step) and the edge chips (through `rel`);
  - the culling and the Colosseum's line of sight.

  There is no minimap in the app. Today's town (a player's) keeps wrapping both ways.

## The rows (`town/rows.ts`, `town/lookalike.ts`, `town/street.ts`)

- **Every built side is a row:**
  - both sides of South Street, Fountain Street, Colosseum Row and Upper Street, west and east of the park and plaza (South Street's
    north side either side of the promenade);
  - Seam Avenue's own stretch between South Street's and Fountain Street's corners (fronts face the avenue from both sides);
  - the closing row along the south edge.

  16 sides, 91 look-alike fronts, the 16 homes, and 10 skyline towers.
- **Blocks:**
  - A **3-deep block** between two streets (Fountain/Colosseum Row, Colosseum Row/Upper) is **two rows back to back**, each about 1.2
    squares deep. The back street's row stands at 0.12 squares from the lot's edge (`ROW_INSET_BACK`), clear of the homes' backs.
  - A **deep block** (South/Fountain, and the strip behind Upper Street's north row) has a row on each street. Its **gardens and tall
    blocks stay in the middle as the skyline.**
- **Slots and sizes:**
  - A row is data: its street, the way its fronts face, its building line (`inset`), its ends and whether each turns a corner, its seed,
    and its homes.
  - Everyday fronts are **look-alikes of 1 to 3 squares** (seeded picks of 1, 1.5, 2, 2, 2.5, 3).
  - A **boss home keeps its own lot and size**.
  - Height classes: 3 or 4 floors, and one **landmark** a side that asks (4 floors and a tall round or stepped cap), never beside a home.
- **The filler rules:**
  - Look-alikes fill every gap between the homes and between a home and a row's end.
  - Each takes a width while a whole one and a filler still fit. The last takes what's left: a **slim filler of 0.6 squares or more**,
    or two halves when more than 3.2 squares are left.
  - A sliver under 0.6 folds into the one before it.
  - A corner's front is 2 squares where there's room, and at least 1.5.
  - Replacing a slot re-flows the row (unit-tested on 600 random swaps over every side).
- **Homes at a row's end:**
  - A home too wide for the room by its row's end slides inward along its row; its picture moves, but its lot, door square and wander
    box don't. The most any home moves is 0.57 squares (Smudgy's).
  - A home that leaves less than a filler at a corner slides out to it and turns the corner itself, with its own side wall.
  - A home with no side wall (Ginger Igloo, Chub & Chirp's, Hollow Peak, Alfil's Pyramid: a dome or a slope to the ground) instead
    leaves 0.6 squares for a slim corner filler.
- **The blends** (Eric: "they don't need to be drawn together… just attached"):
  - Every front is a separate building butted against the next, each in its own colour.
  - Each look-alike runs 1 px under each neighbour (`ROW_OVERLAP_PX`), so a rounding crack never shows sky.
  - Between two homes, a gap under a filler's width becomes a strip at least 12 px wide over their seam (a pilaster).
  - Rooflines step: a neighbour of the same height is bumped, mostly.
  - Inner party walls are never drawn. A side is skipped when a neighbour at least as tall covers it; the cover rule now counts the
    1 px overlaps as butted, where the mockup's drew them. Over a lower neighbour a side shows (a stepped roofline).
- **Corners:**
  - A row's end onto Seam Avenue, the park, the promenade or the plaza turns the corner.
  - Its look-alike's end wall is a second front (windows on every floor, a door), or a home's own side wall.
  - The two corners of back-to-back rows sit side by side, so a crossing looks closed.
- **Flat fronts away from corners** (Eric: "making the buildings flat when they could"):
  - A look-alike that isn't a corner is a shallow box (1.2 squares; 2 on the closing row; 0.8 on the avenue's west side) with **one
    flat roof face**. Its cap (a gable, a stepped gable, a round "bulgy" cap, crenels, a mansard) stands over it as a false front, as
    the picture draws it.
  - A corner keeps its depth (2.3, or 1.2 back to back) and its 3D roof, where the eye catches it.
- **Backs:** the chase camera faces any way, so a row's backs show from the gardens, the park and the plaza.
  - Every look-alike has a rear wall (windows, no door) drawn only from behind, so it costs nothing from the street.
  - A home's rear is its own side wall's picture across its body.
- **The skyline:** the plan's ten tall lots are towers of look-alike parts with 6 to 9 floors (7 to 10 squares tall), windows on every
  side and their own backs, taller than any row. They show over the rows with sky above, and always draw.
- **Heights** (Eric, later: "make sure no front is low next to the pawn… the homes' neighbours step up to at least about 3 pawn
  heights. The right row in the mockup is about right"):
  - No look-alike is under 3 floors (as the mockup's right row).
  - A home's neighbours are 4 floors, 2.9 to 4 pawn heights at their solid top.
  - The homes stay as drawn: Eric asked not to scale the town up. `streetBuildScale` (1) is the knob tried at 1.3 after the run-through
    frames; the rows hold up to 1.3.
- **No sky-blue walls:** the look-alikes' "sky" body colour read as sky between two fronts, so it is an olive now.

## The player's view

- **The chase camera** (`turn.ts chaseTarget`, `feel.ts camStreetTall` / `camStreetWide`) sits low behind your pawn, looking along your
  heading. Headings snap to the four board directions; a quarter turn eases over `streetTurnMs`, which went **400 → 500 ms** (Eric: "a
  short smoothing on a street-corner turn is fine (about 0.4 to 0.6 s), with no lag otherwise"). On a tap's path it turns only for a
  leg of 2 squares or more, or for the last leg.
- **The controls** (recorded as the brief asked):
  - Up walks forward. **Down steps back without turning.** Left and right turn you a quarter and step that way; the camera swings.
  - A held key goes through the way you faced when the hold began.
  - A key's rule holds for the step still under way after the key is let go (it used to turn back the camera when down was released
    mid-step).
  - The on-screen arrows are the same keys.
  - Taps on the ground walk you there as before (through the drawn heading, mid-turn too).
  - #502's room keys (`Walker.rowsUp`) are folded in: in the town `rowsUp` is 1, so the step the keys hand the chase camera is still
    "up the screen", and rooms keep theirs.
- **Figures stay billboards** with the views we have: a figure's back, front or side is the way it last walked, turned through the
  camera's heading.
- **Zoom steps** (Eric: "3 or 4 zoom steps on + and −"; "I think this is a pretty good default"), `feel.ts streetZoomSteps`, phone and
  computer each, blended between steps:
  - **0, in:** low and close, at head height (h 1.5 squares), the horizon a little below the middle, the ground the lower 40% (the
    run-through frames).
  - **1, the default:** the mockup's camera, unchanged.
  - **2, out:** a step back and higher (the mockup's zoomed-out view).
  - **3, the overview:** high, for finding your way (today's town's camera).

  Each press of − or + moves one step, gliding (`streetZoomMs`, 350). Every figure stays on screen at each (e2e).
- **The park's step out** (Eric, a trial he may revert: "make it zoom out one level when you hit the area that's the … center town
  square … if it's like a nice transition"), `zoom-steps.ts`, behind one switch, `parkZoomOut`:
  - Coming **fully** into the park (a park square whose four neighbours are the park's) eases one step out over `parkZoomMs` (600).
  - Going **fully** out (no park square on it or beside it) eases back to the step you had.
  - The square of slack between does nothing, so walking along the edge doesn't pump the zoom.
  - A press of − or + in the park wins: you leave at the step you chose. Nothing happens at the overview.
  - **The call: opening the town in the park (the start is on its promenade) doesn't zoom you.** You didn't come into it, and Eric
    liked the default as the opening view. It does once you leave and come back.

## Cost

- **Draw only what the rows let you see** (`seen.ts`):
  - From your square (wherever the camera looks, as it glides) and from the camera's own square, rays are cast every half degree out
    to 20 squares. Each marks the squares it crosses up to and including the first lot.
  - At the in and default steps (`streetCull`), the ground, the props and the boxes no ray reaches are left out; the skyline's towers
    always draw. From higher up you see over the roofs, so out and the overview draw everything in reach.
  - Worked out once a square, cached.
  - From Fountain Street, under half the boxes within the rim are drawn (unit test), and never the rows behind its rows.
- **Fog:** the town's haze at the rim (16 squares) fades a street's far end, as before.
- **The 2D fallback (no WebGL): the same chase camera.** Canvas 2D is the default renderer. Headless on a phone it holds round 3's
  rate: Fountain Street 57.1 against 57.3, the turn 57.7 against 56.7 (medians of 4, interleaved; the PR body has the table). So it
  doesn't fall back to a higher view. If a slower phone needs one, the out or overview step is the brief's higher view.
- **What it took** (the first measure was 55.4 against 59.5):
  - the culling;
  - the cover rule for the rows' overlaps;
  - flat roofs painted once for all headings, and `boxBakeMs` 2.5 → 1.5;
  - the line of sight walked square by square and worked out ahead;
  - towers no ray reaches drawn only out to 8 squares;
  - on the 2D fallback only, coarser wall strips (`boxStrip` 4 → 8 px, `boxStrips` 8 → 5; the steps stay under the eaves), and walls
    smoothed only when drawn under a pixel a picture pixel (`wallSmooth2D`).

## Smaller fixes

- **A home's name shows only with its home.** The mockup's zoomed-out still had a ghost "Lodge" over the left row: Timber's name drawn
  while the lodge passed beside the camera, cut at the near side. Now a name hides while its home's front is cut at the near side or
  culled, and where a nearer building stands over the spot it would take.
- **Sign lettering at a slant is snapped:** its corner sits on a whole device pixel, and it lies level when the front's slant over it is
  under 2%, so it no longer shimmers as the camera glides.
- **The Colosseum hides behind the rows** (round 4's line of sight from the camera's focus, `colosseumSeen`; it replaces round 3's 45
  degrees of north). It shows up the promenade, across its plaza, down Upper Street, and from Colosseum Row's middle, which run onto
  it. The bigger Colosseum is a later round.
