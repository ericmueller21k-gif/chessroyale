# Street town: the north edge, one solid back wall, the Colosseum in 3D

Eric, Nov 5: "There's nothing behind it. It's at the end of the map … it's a solid back wall … the most back thing is the Colosseum, with
gates running along and then exits out of the gates into the town … we probably have to actually draw the Colosseum out, at least on the
sides, because the way it's glitching right now looks really sloppy." Still an admin's town only (`STREET_TOWN`).

Decision note: `docs/decisions/2026-11-05-street-north-edge.md`. Area page: `docs/areas/town-square.md` (the street town, "The north edge").

**Lane: full e2e** (add the `full-e2e` label): the plan and the box drawing are shared by every street-town spec.

## What changed

- **The plan** (`scripts/street-plan-north.py`, its north edge section; `town/street-plan.json` rebuilt): 54 × 54 (was 46).
  - One back line at y = 42.5: a solid wall the whole way round but for the Colosseum, its ends running on under the ring. North of it
    only the Colosseum, a plain meadow (ground) and a few treetops over the plaza's stretches of wall. Nothing walkable there.
  - Upper Street is gone. Its four homes (Hopper's, Wrangler's, Moo's, Hollow's) stand on **Meadow Street**, a new street 8 rows south,
    between the closing row and South Street (three wide, so South Street keeps its south sidewalk), at their old columns, backed by a row facing South Street; a lane on the promenade's line.
    The world grows 8 columns east too (it's square); Seam Avenue runs from Meadow Street to Colosseum Row.
  - The plaza (rows 40–41) is walled along row 39 with three open **gateways** onto Colosseum Row (columns 15, 21–24 with a crest, 30).
    Its statues and chess pieces stand on row 42 as figures. The apron is its two walkable rows.
  - The start is the same park square, now (22, 25); the park and its zoom-out area move with it.
- **The Colosseum as a solid** (`houses/coliseum-shape.ts`, `houses/coliseum-ring.ts`, new): 18 ring boxes round its oval (outer wall
  of arches and the board's checkered band; rim, seats and podium inside) and a portal box on the plaza (gate, "THE COLOSSEUM" tablet,
  relief; banners and flag on the ring). About twice as tall as round 5's wall. Drawn where it stands like any box, over the rows' roofs
  from near enough; never left out by the near cut, cut nearer the camera and given fine strips on 2D, so a drag beside it shows its
  wall, not its bowl. Round 4's line of sight (`colosseumSeen`) and round 5's flat street picture (`HOUSE_COLISEUM_STREET`) removed.
  Today's town's Colosseum is unchanged.
- **Walls** (`town/wall.ts`): open arches (seen from both sides) and a crest.
- **Ported from `claude/street-colosseum-big`:** Moo's paddock and Ginger's dome 1.3x (`TOWN_FEEL.streetHomeScale`, `rows.ts homePx`);
  the tap guard (a tap on a building's front, side, back or roof never opens something behind it).
- Ground: the board's squares under the oval only (round it, the meadow).

## Player-visible changes (admins' street town only)

- The Colosseum is a 3D building: its curved wall shows from any heading when you look round near it.
- A wall closes the plaza, with three archways out onto Colosseum Row; a solid back wall runs behind everything.
- No street or home behind or beside the Colosseum; Upper Street's four homes are on the new Meadow Street in the south.
- Moo & Moon Meadow and Ginger Igloo are drawn bigger. No new text.

## Checks changed (old → new)

Unit (`packages/app/test`):
- `town-street.test.ts`: "is 46 x 46 …" → "is 54 x 54 …" (and the `W` ground key); start (22, 17) → (22, 25); a ring lot is checked as
  a ring stretch; the park `r1` 26 → 34.
- `town-fixed.test.ts`, "the Colosseum against the back wall":
  - "sits at the top centre" → "sits at the north edge, on the promenade's line" (centred on column 22.5, its first row the plinths').
  - "nothing beside or behind it is walkable" → "nothing past the back line is walkable" (every row from 43).
  - "a wall with a closed gate either side … the back wall along the whole edge, the grove behind" → "the back wall along the whole
    line but the ring, walls along the plaza's front with gateways" (treetops ≥ 6, was ≥ 30 grove trees).
  - "nothing stands north of the back wall" → moved to `town-north-edge.test.ts` ("nothing drawn past it").
  - "no second Colosseum (nor any square twice)" → same, over the grown map's columns and rows.
  - "the statues and chess pieces … on its front line" (the flat picture's `STANDING`) → "… on the plaza against the back line" (props).
- `town-rows.test.ts`: the streets (Upper Street → Meadow Street); Upper Street's north row over the wrap → Colosseum Row's; the
  Fountain Street line-of-sight spots 8 rows on (Colosseum Row's north row closing Seam Avenue's end may show, as Upper Street's did);
  wrap distances for 54; the plaza-to-the-bottom-street path; the park's slack squares 8 rows on. "The Colosseum hides behind the rows"
  (`colosseumSeen`) removed with the line of sight.
- `town-boxes.test.ts`: a box's along/back handedness `toBe(1)` → `toBeCloseTo(1, 9)` (the ring's are float).
- New `town-north-edge.test.ts`: nothing walkable or drawn past the line; no street or lot past it; every boss home with door, strip
  and rest square; the gateways walkable and the only ways out; the Colosseum drawn as faces from 8 headings, a closed silhouette at
  different depths; Moo's and Ginger's homes 1.3x.

e2e:
- `town-fixed.spec.ts`: coordinates 8 rows on; "the Colosseum against the back wall" rewritten (the plaza's three walls ahead from the
  park, nothing past the line, its ring drawn; up at the gate opens its card; up at the plaza's corners and walks past the line are
  stopped); new "the plaza": a drag round in eighths, nothing past the line at each, the ring's faces drawn, figures on screen; down
  through the west gateway onto Colosseum Row. New stills test.
- `town-street.spec.ts`: start (22, 25); Ginger's door (34, 31); Smudgy's (19, 16); the park table's stools row 31; new "Meadow Street:
  each moved home's card opens".
- `town-rows.spec.ts`: Fountain Street row 20 → 28, South Street row 5 → 13, the park's squares and the stills' spots 8 rows on.

## Frame rate

Not measured yet: see "Left".

## Stills

`docs/street-north-edge/`, phone and computer (Canvas 2D): `1-plaza-close`, `2-looking-west`, `3-looking-east`, `4-turned-away`, a look
round beside the Colosseum (`4b-beside-looking-north-west`, `4c-beside-looking-north-east`, `4d-beside-looking-west`),
`5-from-the-park`, `6-grand-gateway`, `6-west-gateway`, `7-meadow-street`, `8-overview` (the top zoom step).

## Test results (local)

- Typecheck clean; the town unit tests (21 files, 290 tests) pass, after merging main (83ceba92).
- e2e on phone and computer, Canvas 2D and WebGL: `town-fixed`, `town-street` and `town-rows` pass. The gateway walk and the park
  table checks were fixed and rerun on the computer. The South Street "no sky between the fronts" check was fixed (below) and rerun on
  both. `town.spec.ts` (a player's town) was not run locally.
- The South Street fix: Meadow Street is three squares wide (the others four), so South Street keeps its south sidewalk. Without it,
  its south row stood at the street's edge, where the near cut ("nothing between the camera and you") left out the fronts beside the
  camera and sky showed beside Hollow Peak's roof (0.126 against 0.005).

## Left

- Frame rate against main (plaza, Fountain Street, a look round; 2D and WebGL; phone and computer): not measured. My local Worker on
  8987 is stuck (a respawning runtime holds the port and doesn't answer), so no server to measure on.
- The full town e2e area rerun after the last layout change (Meadow Street three wide): only the sky check was rerun.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
