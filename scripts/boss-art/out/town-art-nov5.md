# The street town, round 1: the final art (Nov 5)

Brief: `notes/briefs/brief-town-art.md`. Eric approved the street-town mockups (Nov 5:
"you're good on the building the town, it seems great from the last screenshots"; see
[town-street-mockup-nov5.md](town-street-mockup-nov5.md)). This round makes that town's art final and game-ready. Every
call in the mockups is kept:
- the plan, with one-sided streets and back gardens on the near side;
- the Colosseum front on in its grove;
- the camera turning at Seam Avenue's crossings;
- the wrap's seam streets;
- every building a box.

Eric's two asks are kept too: the boss homes are always visible, and nothing looks flat in a turn.

**Art only: no app code changed.** All drawn by hand on the weekly plan usage. There was no API spend.

## Where everything is

| What | Where |
| --- | --- |
| The building kit: materials, side walls, roof tiles and faces, the `TownBox` format | `out/town-buildings/town-kit.ts` |
| The eight everyday designs, three colourways each | `out/town-buildings/buildings.ts` |
| The 16 boss homes' own sides and roofs | `out/town-buildings/home-boxes.ts` |
| Street dressing: sidewalk and kerb tiles, the hedge, beds, bushes, sheds | `out/town-buildings/dressing.ts` |
| The sheets | `out/town-buildings/buildings-sheet.png`, `homes-sheet.png`, `dressing-sheet.png` |
| The plan, exact (for the layout code), and the same as data | [town-plan-nov5.md](town-plan-nov5.md), [town-plan-nov5.json](town-plan-nov5.json) |
| The stills | `out/town-art/` (below) |
| The scripts that make them | `scripts/boss-art/town-street/`: `plan.ts` (the plan), `plan-doc.ts` (the plan's doc, JSON and checks), `plan-map.ts` (the plan picture), `harness.ts` (the box renderer), `view.ts`, `stills.ts` |

```sh
npx tsx scripts/boss-art/town-street/plan-doc.ts                                   # the plan doc and JSON, and its checks
npx tsx scripts/boss-art/town-street/plan-map.ts scripts/boss-art/out/town-art/0-plan.png
npx tsx scripts/boss-art/town-street/stills.ts          # every still and sheet (CHECK=1 prints each figure's box)
npx tsx scripts/boss-art/town-street/stills.ts art      # the three sheets only
npx tsc -p scripts/boss-art --noEmit
```

**Copying it in:** copy `out/town-buildings/*.ts` next to `town/houses/`. Then change only the import paths at the top of
each file:
- `characters/sprite.ts`, `town/houses/kit.ts` and `town/houses/index.ts`;
- `home-boxes.ts` also imports Timber's and Dash's drafts from `out/house-timber` and `out/house-blitz` (copy those in with them, as
  the shop round planned).

Everything is in the homes' own format: `Character`s made of parts and palettes, `LightSpot`s for dusk and night, and the
37 px a square scale. Recolours are palette swaps.

## The stills (`out/town-art/`)

| File | What it shows |
| --- | --- |
| `0-plan.png` | The final plan, north up. It shows every lot in its colourway's roof and front colour, the 16 homes named, each home's door square (gold), each boss's wander box (dashed), your start, the turn zones (hatched), the lamps, the park's tables and trees, and the Colosseum's grove. |
| `1-seam-street-day-*.png` | Seam Street (the Gallery) by day, phone and computer. Puddles (and Smudgy, on the computer) are on their rest squares. |
| `2-fountain-street-day-*.png` | Fountain Street (Fire & Ice): Timber's lodge, a townhouse, Sawyer's woodshed. |
| `3-colosseum-row-day-*.png` | Colosseum Row (the Funfair), east of the plaza: Big Boy's crib, a townhouse, Dash's Kicks. |
| `4-upper-street-day-*.png` | Upper Street (the Meadow), east: Moo & Moon's meadow, Hollow Peak, skinny houses, with the bigger buildings behind. |
| `5-seam-avenue-day-*.png` | Seam Avenue, the camera facing east. You see its own fronts (flats, skinny houses), and the corner lots' side walls and roofs at either end (Seam Street's bakery, Timber's lodge). |
| `6-turn-phone.png`, `6-turn-computer.png` (frames `6-turn-before/mid/after-*.png`) | The corner turn's three frames, from Seam Street onto Seam Avenue. The phone sheet adds the dusk frame. |
| `6-turn-mid-dusk-*.png` | Mid-turn at dusk. The sides and roofs take the dusk tint and haze, and the side windows light up as the fronts' do. |
| `7-night-seam-street-*.png` | Seam Street at night: the windows, the shop fronts, Puddles' glasshouse and the lamps lit. |

The sheets (`out/town-buildings/`):
- `buildings-sheet.png`: per design, a 3/4 view of the box, its three colourways' fronts at 2x, its two sides at 2x, and its roof
  tiles at 3x.
- `homes-sheet.png`: each home straight on and at 3/4.
- `dressing-sheet.png`: the dressing, flat and at 3/4.

**Sprites always on screen:** every figure in every still (you, the bots, the bosses) was checked by its drawn pixels, and
none is cut off by the frame. (`view.ts` flags any that is. One was, Big Boy on the phone's Colosseum Row, and the framing was
moved.)

## The format the code draws (`TownBox`, town-kit.ts)

A building is a box:

- **`front`**: its picture, standing upright on its front line, drawn exactly as a home's is today, cut-out rule and all: a point
  h px up is drawn h x k / 37 above its foot. The front line is the lot's front edge plus `inset` squares.
- **`body.x0..x1`**: the front picture's columns that the walls run back from. Fences, signs and yard bits outside them stay on
  the front only.
- **`left`, `right`**: the side walls. Each is a picture `depth` x 37 px wide and its eave tall, with its foot on its bottom row.
  - It stands upright from the body's edge straight back over `depth` squares.
  - The left wall runs from the back corner to the front corner, so its front edge is its picture's right edge. The right wall
    runs from the front corner back.
  - `null` means no wall: a slope runs to the ground there (the pyramid, the peak, the dome, the mound).
- **`back`** (some homes): a wall at the back facing the street, seen over a low or open box (the crib's back rail, the stall's
  back, the paddock's far fence).
- **`roof`**: faces. Each is a polygon of points (u, t, h):
  - `u`: a front column (px);
  - `t`: 0 at the front line to 1 at the back;
  - `h`: px above the ground (the same cut-out rule).
  - A face is textured with its `tex` tile (37 x 37, top-down, in `roofPal`), its rows running along `u` or along `t`
    (`rows`).
  - `rim` marks a flat roof's parapet (a light line just inside its edge).
  - `soft` marks a dome's or a vault's own faces (no ink line round them).
- **`taper`**: the box's width at its back as a share of the front's. A point at t is pulled toward the body's middle by
  t x (1 - taper). This is used by the tent (0.7), the paddock (0.8), the peak (0.55) and the pyramid (0.3).

**Lighting** (as the mockups, which Eric saw):
- The light comes from the top left. A side wall turned to the screen's left gets 6% shade, one turned right 30%.
- A face's brightness is `0.74 + 0.36 x (n · L)`, clamped to 0.55..1.12:
  - n is its normal in the camera's frame (oriented up);
  - L = (-0.5, -0.35, 0.79) (left, toward the camera, up).
- The dusk tint, the haze (`hazeMix`) and the edge fade (`enterOf`) fall on sides and roofs as on fronts.

**Dusk and night:** fronts keep their `lights`. Each side has its own `lights` (its windows, keyed `ijI`), baked into a glow
as `bakeGlow` does now and laid on with the world's `lightsAt` strength. Roofs don't glow.

**Order:** sort each face by its own depth: the front, each side wall, the back, and the roof as one item, its faces sorted
far to near inside it. A side tucked against a neighbour at least as tall is covered by that neighbour's front. Better still,
skip it: the plan knows the neighbours.

**Nothing between the camera and you:** fronts, sides and roofs nearer than about 0.9 squares behind you aren't drawn, as in
the mockups. Hedges, beds and bushes are drawn; sheds aren't when that near; trees fade over their last 1.5 squares.

### Draws (what a build should cost)

The stills' counts are not a build's. The mockup renderer paints a front in 2 px strips and textures each roof face in
3 px cells (5,000 to 26,000 cells a frame) to make the pictures. A build draws whole faces:

| | Front | Sides (each) | Back | Roof faces |
| --- | --- | --- | --- | --- |
| Cottage | 4 to 6 slices | 1 | | 6 (2 slopes, a 4-face chimney) |
| Townhouse | 4 | 1 | | 11 (mansard 3, dormer 4, chimney 4) |
| Skinny houses | 6 | 1 | | 4 or 5 |
| Small flats | 6 | 1 | | 17 (flat 1, tank 4, legs 8, hatch 4) |
| Bakery | 6 | 1 | | 6 |
| Corner shop | 4 | 1 | | 1 |
| Big block | 8 | 1 | | 25 (flat 1, tower 4, legs 16, hatch 4) |
| Clock tower | 4 | 1 | | 6 (shaft top, belfry 2, spire 3) |
| Homes | 6 to 8 | 1 or none | 1 (3 homes) | 1 to 16; the dome and the mound 50 (one curved mesh) |

- **Cheapest per frame:** skip the faces turned away (a roof face whose screen winding is reversed, a side wall the camera
  can't see) and the sides a neighbour covers.
- **The tank's and tower's legs** (16 tiny faces) can be dropped below a few pixels.
- **The dome and the mound:** draw each as one mesh in WebGL. On the 2D fallback, cut them to 6 x 3 faces.
- **Total:** about 25 buildings in view at 12 to 20 draws each, so roughly 300 to 500 a frame, as the mockups estimated.
  While the camera turns, the slices can double.

## The everyday buildings (buildings.ts)

`building(design, lotWidth, colourway)` returns a `TownBox`. All fronts are 37 px a square, foot at the bottom middle, 3 px
above the last row. Every one is under 4 squares (148 px) tall.

| Design | Lot | Front px | Walls | Depth | Material | Roof | Colourways (0, 1, 2) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cottage | 3 (or 2) x 3 | 111 x 108 | 44 | 2.6 | siding, a stone plinth | shingle gable along the depth, a brick chimney | Butter with a red roof; Sky with slate; Rose with green |
| Townhouse | 2 x 3 | 74 x 132 | 96 | 2.6 | brick or plaster (by colourway) | slate mansard, a tar top, a dormer, a chimney | Red brick with slate; Cream plaster with teal; Grey brick with plum |
| Skinny houses | 3 or 2 x 3 | 111 x 136 | 98 to 112 | 2.6 | siding, each house its own colour | a gable, a stepped gable or a flat cornice, each its own | Mint, peach and lilac; Sky, butter and rose; Sage, cream and peach |
| Small flats | 3 x 3 | 111 x 146 | 122 | 2.6 | brick, a stone base | flat (parapet), a water tank, a hatch | Red brick; Tan brick; Grey brick |
| Bakery and cafe | 3 x 3 | 111 x 114 | 82 | 2.6 | plaster | clay gable, the oven's chimney | Cream with a red awning; Peach with blue; Mint with orange |
| Corner shop | 2 x 3 | 74 x 100 | 80 | 2.6 | siding or plaster | flat behind its false front | Butter with a green awning; Lilac with plum; Sky with red |
| Big block (behind) | 4 x 3 | 148 x 146 | 118 | 2.4 | brick, a stone ground storey | flat, a water tower, a hatch | Red, brown and grey brick |
| Clock tower (behind) | 2 x 3 | 74 x 146 | 82 | 1.24 (square) | stone | a belfry and a slate spire, both roof faces | Warm stone with slate; Grey stone with green copper; Blue stone with red |

- **Signs carry pictures, never words or brands:** a loaf on the bakery's board, a jar on the shop's.
- **Cheap:** each front is one picture. Each material is one texture function (`MAT`), keyed to the wall's dark, mid and light
  keys, so a side is that texture in the colourway's palette, its window rows and trim stamped on.
- **Sides:** the front's window rows, string courses and cornice carry round, and a corner trim stands at the front edge.
  - A skinny row's right side takes its last house's colours.
  - The block's windows are mostly lit at night, a few dark.
- **Palettes:** keys `a b c` wall, `d e f` roof, `g G` trim, `i j I` glass, `l m` door, `n o` awning, `p P` sign, `r s S` greens,
  `t u` flowers, `v V` wood, `x X` stone and iron, `y Y` brass, `q Q` a painted sign's picture.

## The boss homes as boxes (home-boxes.ts)

`homeBox(id)`. The fronts stay the game's (`HOUSES`), plus Timber's and Dash's drafts. Each home's body columns, eaves and
ridge were measured from its front's own silhouette, so the roof meets the front's outline. Lots are 4 x 3 (Alfil's 6 x 3).
The front line is 0.45 squares in, so the yard stays off the sidewalk, and the box runs 2.3 squares deep.

| Home | Sides | Roof | Door (px) |
| --- | --- | --- | --- |
| Puddles' Botanical Garden | glass panes in green frames, 84 px | a glass gable | 70 |
| Smudgy's Art Gallery | pale stone with framed pictures for windows, 68 | the hedge carried back as a box, a turf roof garden, a hedge bed | 72 |
| Folio's Folded House | folded paper, 52 and 62 | a striped paper gable | 47 |
| Alfil's Pyramid | none | sandstone courses to its point (taper 0.3) | 104 |
| Timber's Lumber Lodge | logs, 62 | a hipped shingle roof along the street | 66 |
| Sawyer's Woodshed | logs, 62 | a shingle gable, its stove pipe | 58 |
| Ginger Igloo | none | a gingerbread dome with gumdrops in its crumb, iced on top | 71 |
| Jefferson's Fireworks | orange and yellow stripes, 74 | a striped canvas pyramid | 72 |
| Boingo's Funhouse | pink plaster, round windows, 90 | a striped barrel vault, its blue corner towers carried back | 72 |
| Babur's Circus | red and white canvas, 60 | a striped tent roof to its pole (taper 0.7) | 70 |
| Big Boy's Crib | wooden slats, 86 | a quilt on the mattress inside, the back rail, corner posts | 72 |
| Dash's Kicks | dark brick, teal trim, 98 | flat tar, its parapet, an air-con box | 95 |
| Chub & Chirp's Grassland | none | a turf mound, a dome | 87 |
| Wrangler's Stall | a plank counter, 40, its back wall 70 | a striped canvas awning sloping back, posts | 72 |
| Moo & Moon Meadow | a rail fence, 22, the far fence | the paddock's grass (taper 0.8) | 72 |
| Hollow Peak | none | dark crystal rock to its peak (taper 0.55) | 81 |

## Street dressing (dressing.ts)

- **Lamps:** the park's own (`PARK_LAMP`, `PARK_LAMP_LIGHTS`, `PARK_LAMP_POOLS`). There are 43 along the streets, each on a whole
  sidewalk square, every 6 squares, off every door and rest square (town-plan-nov5.md lists them all).
- **Benches:** the park's (`PARK_BENCH`).
- **Sidewalk:** `sidewalkTile(false)` is four slabs. `sidewalkTile(true)` has a granite kerb along its top edge: lay it with
  that edge toward the street on every sidewalk square beside the board.
- **The hedge:** a plane, not a billboard, so it turns with the street. `hedgeFront(v)` is 37 x 19 (foot 18) and stands on the
  garden's edge facing the camera. `hedgeTop(v)` is its top face, 18 px up, 0.4 squares deep. `v` is 0..2 (pink or yellow
  flowers).
- **Back gardens:**
  - `bed(v)`: a flower bed, pink, orange or purple.
  - `bush(v)`: small, medium, or big and flowering.
  - `shed(v)`: a little box (`TownBox`, plank sides, a felt gable) in three colours.
  - `gardenFence()`: a picket, for where two gardens meet (not placed in this plan).
- **Crossing markings: none.** The board is the street, and a painted crossing on chess squares would read as part of the
  board. The turn needs no marking: the camera does it.

## My calls

1. **Behind buildings kept under 4 squares.** The big block and the clock tower are now 146 px (3.9 squares; they were 168
   and 186).
   - On the computer's zoomed-in view the sky shows over the rooftops on every street. On Seam Avenue, the block behind Seam
     Street's corner brings its water tower within a few pixels of the top (`5-seam-avenue-day-computer.png`), not past it.
   - So no camera change is needed. If Eric wants a band of sky over everything on the computer, open it a step out (the
     town's zoom about 0.15).
2. **The clock tower's spire is roof faces, not part of its front picture**, so it turns as a square spire should. The front
   ends at the belfry.
3. **Three colourways a design** (the brief said two or three). Each street repeats designs, so three keeps neighbours apart.
4. **Materials changed from the mockup's guesses** where the front said otherwise. Each now matches its front:
   - Sawyer: logs (it was planks);
   - Ginger: gingerbread and icing (it was ice; the front is a gingerbread dome);
   - Jefferson: painted stripes (it was brick; the front is a painted booth);
   - Chub & Chirp: a turf mound (it was planks);
   - Big Boy: crib slats (it was siding).
5. **Bosses rest away from their doors.** Each boss's rest square (where it stands when it stops, and where it first
   appears) is its sidewalk square at the end of its box farther from its door, unless a sign's middle is there. So the door,
   the sign and most of the front stay in view (Eric: "the boss homes always visible").
   - In the first stills Hollow stood on his doorstep and hid most of Hollow Peak.
   - Bosses still wander the whole box: the yard strip plus the sidewalk in front, their lot's width.
6. **Door squares from the door, not the front's middle** (Eric, Nov 5). Each home's door is measured on its picture. For
   example, Sawyer's door is left of middle, and Dash's is at his shop's right.
7. **Lamps moved off doors and crossings.** Six lamps stood on door squares and five on the avenue's crossings: each steps a
   square along its sidewalk, or goes (on a crossing). `plan-doc.ts` checks this.
8. **Your start: (22, 11)**, on the promenade just south of the fountain, facing north up it (the plaza and the Colosseum
   ahead).
9. **Hedges as planes with tops; sheds as boxes**, so neither steps or flattens mid-turn. A shed between the camera and you
   isn't drawn (as the lots aren't). Near the camera a hedge is big on screen: it is the back gardens' edge Eric saw in the
   mockups, now solid.
10. **The corner shop's name stays, though it isn't on corners.** The corners are the bakery's and the homes'. It is just "the
    shop".

## Checks (`plan-doc.ts`, all pass)

- **Every home's front is seen whole from its street's camera.** The camera faces the front, and every square between the
  street's far half and the front is street or sidewalk, out of the turn zones, with no tree or shed on it.
- **Nothing blocks a path.**
  - The start is walkable.
  - All 16 door squares and rest squares are open and reached from the start.
  - All 24 stools are reached, and so is the Colosseum's gate.
  - Every street square is reached (696 of 696).
  - No lamp stands on a door.

## What the code rounds must know

**Round 2, the layout:** take everything from [town-plan-nov5.json](town-plan-nov5.json). It has:
- the ground grid and the streets with their camera headings;
- the turn zones and the start;
- every lot: its art call, facing, inset, depth, and a home's door, rest square and wander box;
- the park, the Colosseum and every prop.

Walkable squares are BOARD, PAVE and GRASS without a prop on them: a tree, bench, lamp, table and its stools, the fountain's
four squares, or a shed. Today's e2e and unit tests that know the map (the start, the lamp ahead on your left, the tables)
will need their numbers changed.

**Round 3, the boxes and the turn:** draw each `TownBox` as above.
- The heading is the square's (`camAt`), eased over about 0.5 s, turning about you.
- Taps (`pickSquare`) and the arrow keys go through the heading.
- The Colosseum's far drawing shows only within 45 degrees of north.

**Still drafts:** Timber's and Dash's fronts are the drafts in `out/house-timber` and `out/house-blitz`, which have no sign
data yet. Their names don't show on their signs in the stills.

## What's rough or a stand-in (in the stills only)

- The chess tables' tops are a plain stand-in (no pieces). Names are in Arial (the game's Archivo Black isn't installed here).
- The near hedge's top is chunky close up on the computer. A build could fade the top over the last square.
- The lights at dusk and night are simpler than the game's: no flicker, and a plain blur for the spill.
- The mockup renderer paints roofs in cells. A build textures whole faces, so its roofs will be smoother at the edges.
