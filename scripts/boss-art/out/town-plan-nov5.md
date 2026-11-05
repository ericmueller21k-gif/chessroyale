# The street town's plan, exact (Nov 5)

The data the layout code (code round 2) needs, generated from `scripts/boss-art/town-street/plan.ts` by
`npx tsx scripts/boss-art/town-street/plan-doc.ts`, which also writes the same data as [town-plan-nov5.json](town-plan-nov5.json)
and runs the checks at the end. The picture: [town-art/0-plan.png](town-art/0-plan.png). The art each lot names is in
`out/town-buildings/` (`town-art-nov5.md` says how to use it). Eric approved this plan in the mockups (Nov 5); nothing in it
moved since, except the colourways (now three a design), the lamps (now on whole sidewalk squares, off every door and rest
square) and what's new below (doors, rest squares, wander boxes, the start, the walking and the turn zones).

## Squares

- The world is 46 x 46 and wraps (as today). A square is (c, r): c 0..45 west to east, r 0..45 south to north (world.ts's way).
  A range written `44..1` wraps (44, 45, 0, 1).
- A thing's position (x, y) is in squares, a square's middle at whole numbers (a square (c, r) runs from c - 0.5 to c + 0.5).
- Ground: `BOARD` the streets (the chessboard), `PAVE` sidewalks, the park's walks, South Lane and the Colosseum's apron,
  `GRASS` the park's lawns, `GARDEN` back gardens and the grove, `LOT` under a building, `ARENA` the Colosseum.

## Streets and the camera

| Street | Board squares | Sidewalks | Camera faces |
| --- | --- | --- | --- |
| Seam Street | c 0..45, r 44..1 | r 43 (its near side) and r 2 (its fronts' side), all the way round | north (0) |
| Fountain Street | c 33..12, r 13..16 | r 12 and r 17, c 33..12 (through the park it's the park's walk) | north (0) |
| Colosseum Row | c 0..45, r 21..24 | r 25, c 33..12 (the plaza's apron in the middle); none on its south side (Fountain Street's lots back onto it) | north (0) |
| Upper Street | c 33..12, r 30..33 | r 29 and r 34, c 33..12 (it ends at the Colosseum's grove both sides) | north (0) |
| Seam Avenue | c 44..1, r 0..45 | c 43 (its near side) and c 2 (its fronts' side), all the way round | east (90) |
| South Lane | (paving) c 21..24, r 3..8 | it is paving | north |
| The park, the plaza | see below | | north |

- **Heading:** the camera faces north (0) everywhere except on Seam Avenue (c 43..2), where it faces east (90).
- **Turn zones** (Seam Avenue's four crossings; on these squares of the avenue the camera faces north):
  - Seam Street: c 43..2, r 43..1 (the street and its sidewalks)
  - Fountain Street: c 43..2, r 12..17 (the street and its sidewalks)
  - Colosseum Row: c 43..2, r 21..25 (the street and its sidewalks)
  - Upper Street: c 43..2, r 29..34 (the street and its sidewalks)
- **The turn:** the target heading is the square you're on's (`camAt`); the camera eases toward it, about you (it keeps
  following you), over about 0.5 s (a run across the crossing's four squares), shortest way round. The sky's clouds slide
  with the heading; the sun stays.
- **The Colosseum** is only drawn from afar (today's `drawFarColiseum`) while the camera faces within 45 degrees of north.
- **Nothing between the camera and you:** fronts, sides and roofs nearer the camera than about 0.9 squares behind you aren't
  drawn (the near side is back gardens and the backs of the next street's lots; their backs are never seen). Low things there
  (hedges, beds, bushes) are drawn; sheds aren't when that near; trees fade out over the last 1.5 squares (as the shops' near
  pieces do now).

## Lots

Every building's lot, its art (`homeBox` from home-boxes.ts, `building` from buildings.ts), which way its front faces, its
front line (where its front picture stands: the lot's front edge plus its inset) and the box's depth back from that line.
A lot facing S has its front on its south edge (row r0), onto an east-west street; facing W, on its west edge (column c0),
onto Seam Avenue. `Corner side` marks a lot whose west side wall faces Seam Avenue (seen from the avenue).

| Street | Building | Art | Squares | Faces | Front line | Depth | Corner side |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Seam Street | Bakery and cafe (Cream, red awning) | `building("bakery", 3, 0)` | c 3..5, r 3..5 | S | y = 2.62 | 2.60 | yes |
| Seam Street | Townhouse (Cream plaster, teal) | `building("townhouse", 2, 1)` | c 6..7, r 3..5 | S | y = 2.62 | 2.60 |  |
| Seam Street | Puddles' Botanical Garden | `homeBox("gardener")` | c 8..11, r 3..5 | S | y = 2.95 | 2.30 |  |
| Seam Street | Skinny houses (Mint, peach, lilac) | `building("skinny", 3, 0)` | c 12..14, r 3..5 | S | y = 2.62 | 2.60 |  |
| Seam Street | Corner shop (Lilac, plum awning) | `building("shop", 2, 1)` | c 15..16, r 3..5 | S | y = 2.62 | 2.60 |  |
| Seam Street | Smudgy's Art Gallery | `homeBox("smudgy")` | c 17..20, r 3..5 | S | y = 2.95 | 2.30 |  |
| Seam Street | Folio's Folded House | `homeBox("folio")` | c 25..28, r 3..5 | S | y = 2.95 | 2.30 |  |
| Seam Street | Townhouse (Grey brick, plum) | `building("townhouse", 2, 2)` | c 29..30, r 3..5 | S | y = 2.62 | 2.60 |  |
| Seam Street | Small flats (Red brick) | `building("flats", 3, 0)` | c 31..33, r 3..5 | S | y = 2.62 | 2.60 |  |
| Seam Street | Alfil's Pyramid | `homeBox("alfil")` | c 34..39, r 3..5 | S | y = 2.95 | 2.30 |  |
| Seam Street | Cottage (Sky, slate roof) | `building("cottage", 3, 1)` | c 40..42, r 3..5 | S | y = 2.62 | 2.60 |  |
| Fountain Street | Timber's Lumber Lodge | `homeBox("timber")` | c 3..6, r 18..20 | S | y = 17.95 | 2.30 | yes |
| Fountain Street | Townhouse (Red brick, slate) | `building("townhouse", 2, 0)` | c 7..8, r 18..20 | S | y = 17.62 | 2.60 |  |
| Fountain Street | Sawyer's Woodshed | `homeBox("sawyer")` | c 9..12, r 18..20 | S | y = 17.95 | 2.30 |  |
| Fountain Street | Ginger Igloo | `homeBox("gingerbread")` | c 33..36, r 18..20 | S | y = 17.95 | 2.30 |  |
| Fountain Street | Jefferson's Fireworks | `homeBox("grex")` | c 37..40, r 18..20 | S | y = 17.95 | 2.30 |  |
| Fountain Street | Corner shop (Sky, red awning) | `building("shop", 2, 2)` | c 41..42, r 18..20 | S | y = 17.62 | 2.60 |  |
| Colosseum Row | Boingo's Funhouse | `homeBox("clown")` | c 3..6, r 26..28 | S | y = 25.95 | 2.30 | yes |
| Colosseum Row | Corner shop (Butter, green awning) | `building("shop", 2, 0)` | c 7..8, r 26..28 | S | y = 25.62 | 2.60 |  |
| Colosseum Row | Babur's Circus | `homeBox("tiger")` | c 9..12, r 26..28 | S | y = 25.95 | 2.30 |  |
| Colosseum Row | Big Boy's Crib | `homeBox("bigboy")` | c 33..36, r 26..28 | S | y = 25.95 | 2.30 |  |
| Colosseum Row | Townhouse (Cream plaster, teal) | `building("townhouse", 2, 1)` | c 37..38, r 26..28 | S | y = 25.62 | 2.60 |  |
| Colosseum Row | Dash's Kicks | `homeBox("blitz")` | c 39..42, r 26..28 | S | y = 25.95 | 2.30 |  |
| Upper Street | Chub & Chirp's Grassland | `homeBox("hopper")` | c 3..6, r 35..37 | S | y = 34.95 | 2.30 | yes |
| Upper Street | Cottage (Rose, green roof) | `building("cottage", 2, 2)` | c 7..8, r 35..37 | S | y = 34.62 | 2.60 |  |
| Upper Street | Wrangler's Stall | `homeBox("pig")` | c 9..12, r 35..37 | S | y = 34.95 | 2.30 |  |
| Upper Street | Moo & Moon Meadow | `homeBox("moo")` | c 33..36, r 35..37 | S | y = 34.95 | 2.30 |  |
| Upper Street | Hollow Peak | `homeBox("hollow")` | c 37..40, r 35..37 | S | y = 34.95 | 2.30 |  |
| Upper Street | Skinny houses (Sky, butter, rose) | `building("skinny", 2, 1)` | c 41..42, r 35..37 | S | y = 34.62 | 2.60 |  |
| Seam Avenue | Small flats (Tan brick) | `building("flats", 3, 1)` | c 3..5, r 6..8 | W | x = 2.62 | 2.60 |  |
| Seam Avenue | Skinny houses (Sage, cream, peach) | `building("skinny", 3, 2)` | c 3..5, r 9..11 | W | x = 2.62 | 2.60 |  |
| Seam Avenue | Cottage (Butter, red roof) | `building("cottage", 3, 0)` | c 3..5, r 38..40 | W | x = 2.62 | 2.60 |  |
| Seam Avenue | Townhouse (Grey brick, plum) | `building("townhouse", 2, 2)` | c 3..5, r 41..42 | W | x = 2.62 | 2.60 |  |
| Seam Street (behind) | Big block (behind) (Red brick) | `building("block", 4, 0)` | c 6..9, r 6..8 | S | y = 5.80 | 2.40 |  |
| Seam Street (behind) | Clock tower (behind) (Warm stone, slate) | `building("tower", 2, 0)` | c 14..15, r 6..8 | S | y = 5.80 | 1.24 |  |
| Seam Street (behind) | Big block (behind) (Brown brick) | `building("block", 4, 1)` | c 17..20, r 6..8 | S | y = 5.80 | 2.40 |  |
| Seam Street (behind) | Big block (behind) (Grey brick) | `building("block", 4, 2)` | c 27..30, r 6..8 | S | y = 5.80 | 2.40 |  |
| Seam Street (behind) | Clock tower (behind) (Grey stone, green copper) | `building("tower", 2, 1)` | c 33..34, r 6..8 | S | y = 5.80 | 1.24 |  |
| Seam Street (behind) | Big block (behind) (Red brick) | `building("block", 4, 0)` | c 38..41, r 6..8 | S | y = 5.80 | 2.40 |  |
| Upper Street (behind) | Big block (behind) (Brown brick) | `building("block", 4, 1)` | c 6..9, r 38..40 | S | y = 37.80 | 2.40 |  |
| Upper Street (behind) | Clock tower (behind) (Blue stone, red) | `building("tower", 2, 2)` | c 11..12, r 38..40 | S | y = 37.80 | 1.24 |  |
| Upper Street (behind) | Big block (behind) (Grey brick) | `building("block", 4, 2)` | c 34..37, r 38..40 | S | y = 37.80 | 2.40 |  |
| Upper Street (behind) | Clock tower (behind) (Warm stone, slate) | `building("tower", 2, 0)` | c 41..42, r 38..40 | S | y = 37.80 | 1.24 |  |

The bigger buildings behind (`tall`) stand on lots 3 squares behind the front rows; nobody can reach them, and they never
face a camera but north's.

## The boss homes: doors and where the bosses wander

- **Door square:** the sidewalk square in front of the home's door (Eric, Nov 5: a tap on the home walks you there). The
  door's middle on the front picture is `HOME_SPECS[id].door` (px); the front is centred on its lot.
- **Rest square:** where the boss stands when it stops (and where it first appears): its sidewalk square at the end of its
  wander box farther from its door, unless that end is in front of its sign's middle. So the door, the sign and most of the
  front stay in view (Eric: "the boss homes always visible"). It walks the whole box between rests.
- **Wander box:** the boss's own yard (the strip between the lot's front edge and its front line) and the sidewalk in front,
  its lot's width along; in square coordinates (a boss's foot stays inside).

| Home | Boss | Lot | Door square | Rest square | Wander box (x, y) |
| --- | --- | --- | --- | --- | --- |
| Puddles' Botanical Garden | Puddles | c 8..11, r 3..5 | (9, 2) | (11, 2) | x 7.70..11.30, y 1.70..2.85 |
| Smudgy's Art Gallery | Smudgy | c 17..20, r 3..5 | (19, 2) | (17, 2) | x 16.70..20.30, y 1.70..2.85 |
| Folio's Folded House | Folio | c 25..28, r 3..5 | (26, 2) | (25, 2) | x 24.70..28.30, y 1.70..2.85 |
| Alfil's Pyramid | Alfil | c 34..39, r 3..5 | (37, 2) | (34, 2) | x 33.70..39.30, y 1.70..2.85 |
| Timber's Lumber Lodge | Timber | c 3..6, r 18..20 | (4, 17) | (6, 17) | x 2.70..6.30, y 16.70..17.85 |
| Sawyer's Woodshed | Sawyer | c 9..12, r 18..20 | (10, 17) | (12, 17) | x 8.70..12.30, y 16.70..17.85 |
| Ginger Igloo | Ginger | c 33..36, r 18..20 | (34, 17) | (36, 17) | x 32.70..36.30, y 16.70..17.85 |
| Jefferson's Fireworks | Jefferson | c 37..40, r 18..20 | (39, 17) | (37, 17) | x 36.70..40.30, y 16.70..17.85 |
| Boingo's Funhouse | Boingo | c 3..6, r 26..28 | (5, 25) | (3, 25) | x 2.70..6.30, y 24.70..25.85 |
| Babur's Circus | Babur | c 9..12, r 26..28 | (10, 25) | (12, 25) | x 8.70..12.30, y 24.70..25.85 |
| Big Boy's Crib | Big Boy | c 33..36, r 26..28 | (35, 25) | (33, 25) | x 32.70..36.30, y 24.70..25.85 |
| Dash's Kicks | Dash | c 39..42, r 26..28 | (41, 25) | (39, 25) | x 38.70..42.30, y 24.70..25.85 |
| Chub & Chirp's Grassland | Chub & Chirp | c 3..6, r 35..37 | (5, 34) | (3, 34) | x 2.70..6.30, y 33.70..34.85 |
| Wrangler's Stall | Wrangler | c 9..12, r 35..37 | (11, 34) | (9, 34) | x 8.70..12.30, y 33.70..34.85 |
| Moo & Moon Meadow | Moo & Moon | c 33..36, r 35..37 | (35, 34) | (33, 34) | x 32.70..36.30, y 33.70..34.85 |
| Hollow Peak | Hollow | c 37..40, r 35..37 | (39, 34) | (37, 34) | x 36.70..40.30, y 33.70..34.85 |

Lamps stand in some wander boxes' sidewalk (a boss walks round them):
- Smudgy: a lamp at (20, 2)
- Alfil: a lamp at (38, 2)
- Timber: a lamp at (5, 17)
- Sawyer: a lamp at (11, 17)
- Ginger: a lamp at (35, 17)
- Jefferson: a lamp at (40, 17)
- Boingo: a lamp at (4, 25)
- Babur: a lamp at (11, 25)
- Big Boy: a lamp at (34, 25)
- Dash: a lamp at (40, 25)
- Chub & Chirp: a lamp at (4, 34)
- Wrangler: a lamp at (10, 34)
- Moo & Moon: a lamp at (34, 34)
- Hollow: a lamp at (40, 34)

## The park (the plus)

20 x 12: c 13..32, r 9..20. A row a line, north at the top; `=` paving, `.` grass, `t` a
tree, `b` a bench (on grass), `T` a chess table with its stools `s` either side (west and east), `F` the fountain (2 x 2, `f` its
other squares), `L` a lamp (on paving). The promenade (c 21..24) runs north to south, the new walk (Fountain Street's
stretch, r 13..16) east to west, crossing at the fountain.

```
r 20  L======L====L======L
r 19  =.t..sTs====sTs..t.=
r 18  =t..b...====...b..t=
r 17  LsTs.sTs====sTs.sTsL
r 16  ====================
r 15  =========Ff=========
r 14  =========ff=========
r 13  ====================
r 12  LsTs.sTs====sTs.sTsL
r 11  =t..b...====...b..t=
r 10  =.t..sTs====sTs..t.=
r  9  L======L====L======L
      c 13              32
```

- Tables (12): (19, 19), (26, 19), (15, 17), (19, 17), (26, 17), (30, 17), (15, 12), (19, 12), (26, 12), (30, 12), (19, 10), (26, 10); each table's stools on (c - 1, r) and (c + 1, r).
- The fountain: (22, 15), (23, 15), (22, 14), (23, 14).
- Trees: (15, 19), (30, 19), (14, 18), (31, 18), (14, 11), (31, 11), (15, 10), (30, 10).
- Benches: (17, 18), (28, 18), (17, 11), (28, 11).
- Lamps: (13, 20), (20, 20), (25, 20), (32, 20), (13, 17), (32, 17), (13, 12), (32, 12), (13, 9), (20, 9), (25, 9), (32, 9).
- The four walks lead out: north onto Colosseum Row and the plaza, west and east along Fountain Street, south down South Lane.

## The Colosseum and its grove

- The Colosseum (as today): c 17..28, r 28..39 (`ARENA`), its front on y = 27.5, facing south, one flat picture (always seen front on).
- Its apron: c 17..28, r 25..27 (paving), the plaza's sidewalk r 25 from c 13 to 32; the gate at c 22..23 on r 27.
- Its statues: (17, 27), (28, 27) (drawn in its picture, as the game does).
- The grove (garden, unwalkable), trees at: (13.5, 26), (15.5, 27), (29.5, 26), (31.5, 27), (13.5, 28), (15.5, 29), (29.5, 28), (31.5, 29), (13.5, 30), (15.5, 31), (29.5, 30), (31.5, 31), (13.5, 32), (15.5, 33), (29.5, 32), (31.5, 33), (13.5, 34), (15.5, 35), (29.5, 34), (31.5, 35), (13.5, 36), (15.5, 37), (29.5, 36), (31.5, 37), (13.5, 38), (15.5, 39), (29.5, 38), (31.5, 39), (13.5, 40), (15.5, 41), (29.5, 40), (31.5, 41), (13.5, 42), (15.5, 43), (29.5, 42), (31.5, 43), (17.5, 40.5), (17.5, 42), (19.5, 40.5), (19.5, 42), (21.5, 40.5), (21.5, 42), (23.5, 40.5), (23.5, 42), (25.5, 40.5), (25.5, 42), (27.5, 40.5), (27.5, 42).
- Upper Street ends at the grove on both sides (c 12 and c 33); Seam Street runs behind it facing north (the Colosseum is behind the camera there).

## Street dressing

- Lamps (the park's lamp, each on a whole sidewalk square; 43 along the streets): (4, 12), (5, 17), (4, 25), (4, 29), (4, 34), (10, 12), (11, 17), (11, 25), (10, 29), (10, 34), (34, 12), (35, 17), (34, 25), (34, 29), (34, 34), (40, 12), (40, 17), (40, 25), (40, 29), (40, 34), (7, 2), (13, 2), (20, 2), (31, 2), (38, 2), (43, 2), (4, 43), (10, 43), (16, 43), (22, 43), (28, 43), (34, 43), (40, 43), (2, 4), (43, 7), (2, 10), (43, 19), (43, 25), (2, 28), (2, 34), (43, 37), (2, 40), (43, 43).
- Hedges: one a square along each near sidewalk's garden (or lot-back) edge: on r 42, 11, 28 and 20 where those squares are garden
  or lot (the hedge's face toward the camera at y = r + 0.05, its top running to r + 0.45), and on c 42 along Seam Avenue (its
  face at x = 42.05). Each is `hedgeFront(v)` standing as a plane plus `hedgeTop(v)` as its top face (`v` = c % 3, or r % 3).
- Back gardens: 12 sheds, 29 flower beds, 29 bushes, placed by plan.ts's hash (every square in the JSON). Nothing there stands
  taller than about a square.
- Sidewalk squares get the slabbed tile; a sidewalk square that shares an edge with the street gets the kerb along that edge.

## Walking

- **You and the bots** walk on `BOARD`, `PAVE` and `GRASS` squares, except where a prop stands: a tree, a bench, a lamp, a
  table and its two stools, the fountain's four squares, a shed. Not on lots, gardens, the grove or the Colosseum's ground.
- **Bosses** stay in their wander boxes.
- **Your start:** (22, 11), on the promenade just south of the fountain, facing north (the plaza and the Colosseum ahead).

The whole world (north at the top; `#` board, `=` paving, `,` grass, `g` garden, `L` lot, `A` arena, `x` a prop on a walkable square,
`D` a door square, `@` your start):

```
45 ##############################################
44 ##############################################
43 ##==x=====x=====x=====x=====x===x=x=====x==x##
42 ##=LLLggggggggggggggggggggggggggggggggggggg=##
41 ##=LLLggggggggggggggggggggggggggggggggggggg=##
40 ##xLLLLLLLgLLgggggggggggggggggggggLLLLgggLL=##
39 ##=LLLLLLLgLLggggAAAAAAAAAAAAgggggLLLLgggLL=##
38 ##=LLLLLLLgLLggggAAAAAAAAAAAAgggggLLLLgggLL=##
37 ##=LLLLLLLLLLggggAAAAAAAAAAAAggggLLLLLLLLLLx##
36 ##=LLLLLLLLLLggggAAAAAAAAAAAAggggLLLLLLLLLL=##
35 ##=LLLLLLLLLLggggAAAAAAAAAAAAggggLLLLLLLLLL=##
34 ##x=xD====xD=ggggAAAAAAAAAAAAgggg=xD===Dx===##
33 #############ggggAAAAAAAAAAAAgggg#############
32 #############ggggAAAAAAAAAAAAgggg#############
31 #############ggggAAAAAAAAAAAAgggg#############
30 #############ggggAAAAAAAAAAAAgggg#############
29 ##==x=====x==ggggAAAAAAAAAAAAgggg=x=====x===##
28 ##xLLLLLLLLLLggggAAAAAAAAAAAAggggLLLLLLLLLL=##
27 ##=LLLLLLLLLLgggg============ggggLLLLLLLLLL=##
26 ##=LLLLLLLLLLgggg============ggggLLLLLLLLLL=##
25 ##==xD====Dx======================xD====xD=x##
24 ##############################################
23 ##############################################
22 ##############################################
21 ##############################################
20 ##=LLLLLLLLLLx======x====x======xLLLLLLLLLL=##
19 ##=LLLLLLLLLL=,x,,xxx====xxx,,x,=LLLLLLLLLLx##
18 ##=LLLLLLLLLL=x,,x,,,====,,,x,,x=LLLLLLLLLL=##
17 ##==Dx====Dx=xxxx,xxx====xxx,xxxx=Dx===Dx===##
16 #############====================#############
15 #############=========xx=========#############
14 #############=========xx=========#############
13 #############====================#############
12 ##==x=====x==xxxx,xxx====xxx,xxxx=x=====x===##
11 ##=LLLggggggg=x,,x,,,=@==,,,x,,x=gggggggggg=##
10 ##xLLLggggggg=,x,,xxx====xxx,,x,=gggggggggg=##
 9 ##=LLLgggggggx======x====x======xgggggggggg=##
 8 ##=LLLLLLLggggLLgLLLL====ggLLLLggLLgggLLLLg=##
 7 ##=LLLLLLLggggLLgLLLL====ggLLLLggLLgggLLLLgx##
 6 ##=LLLLLLLggggLLgLLLL====ggLLLLggLLgggLLLLg=##
 5 ##=LLLLLLLLLLLLLLLLLL====LLLLLLLLLLLLLLLLLL=##
 4 ##xLLLLLLLLLLLLLLLLLL====LLLLLLLLLLLLLLLLLL=##
 3 ##=LLLLLLLLLLLLLLLLLL====LLLLLLLLLLLLLLLLLL=##
 2 ##=====x=D===x=====Dx=====D====x=====Dx====x##
 1 ##############################################
 0 ##############################################
   0         1         2         3         4     
   0123456789012345678901234567890123456789012345
```

## Checks

Run by plan-doc.ts each time (it fails if any does).

**Every home's front is seen whole from its street's camera** (the camera faces its front; every square between the street's
far half and its front is street or sidewalk, out of any turn zone, with no tree or shed on it):

- Puddles' Botanical Garden: seen whole from Seam Street (camera north)
- Smudgy's Art Gallery: seen whole from Seam Street (camera north)
- Folio's Folded House: seen whole from Seam Street (camera north)
- Alfil's Pyramid: seen whole from Seam Street (camera north)
- Timber's Lumber Lodge: seen whole from Fountain Street (camera north)
- Sawyer's Woodshed: seen whole from Fountain Street (camera north)
- Ginger Igloo: seen whole from Fountain Street (camera north)
- Jefferson's Fireworks: seen whole from Fountain Street (camera north)
- Boingo's Funhouse: seen whole from Colosseum Row (camera north)
- Babur's Circus: seen whole from Colosseum Row (camera north)
- Big Boy's Crib: seen whole from Colosseum Row (camera north)
- Dash's Kicks: seen whole from Colosseum Row (camera north)
- Chub & Chirp's Grassland: seen whole from Upper Street (camera north)
- Wrangler's Stall: seen whole from Upper Street (camera north)
- Moo & Moon Meadow: seen whole from Upper Street (camera north)
- Hollow Peak: seen whole from Upper Street (camera north)

**Nobody's start or path is blocked:**

- Puddles's door square (9, 2): open, reached from the start; rest square (11, 2): open
- Smudgy's door square (19, 2): open, reached from the start; rest square (17, 2): open
- Folio's door square (26, 2): open, reached from the start; rest square (25, 2): open
- Alfil's door square (37, 2): open, reached from the start; rest square (34, 2): open
- Timber's door square (4, 17): open, reached from the start; rest square (6, 17): open
- Sawyer's door square (10, 17): open, reached from the start; rest square (12, 17): open
- Ginger's door square (34, 17): open, reached from the start; rest square (36, 17): open
- Jefferson's door square (39, 17): open, reached from the start; rest square (37, 17): open
- Boingo's door square (5, 25): open, reached from the start; rest square (3, 25): open
- Babur's door square (10, 25): open, reached from the start; rest square (12, 25): open
- Big Boy's door square (35, 25): open, reached from the start; rest square (33, 25): open
- Dash's door square (41, 25): open, reached from the start; rest square (39, 25): open
- Chub & Chirp's door square (5, 34): open, reached from the start; rest square (3, 34): open
- Wrangler's door square (11, 34): open, reached from the start; rest square (9, 34): open
- Moo & Moon's door square (35, 34): open, reached from the start; rest square (33, 34): open
- Hollow's door square (39, 34): open, reached from the start; rest square (37, 34): open
- The 12 tables' 24 stools: 24 of 24 reached from a walkable neighbour
- The Colosseum's gate (22..23, 27): reached
- Street (board) squares reached: 696 of 696
- Lamps on a door square: none

All pass.
