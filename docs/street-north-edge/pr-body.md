# Street town: the north edge, one solid back wall, the Colosseum in 3D

Eric, Nov 5: "There's nothing behind it. It's at the end of the map … it's a solid back wall … the most back thing is the Colosseum, with
gates running along and then exits out of the gates into the town … we probably have to actually draw the Colosseum out, at least on the
sides, because the way it's glitching right now looks really sloppy."

Eric, Nov 6, on the first stills: the plaza's wall "looks like the Colosseum is behind this random wall, and it looks very small"; and
"Moo & Moon Meadow and Hollow Peak right next to each other, with a little building squeezed in … Nothing should be that close … not two
bosses." On the redesign: "Yes, everything looks good… run one quick test… rotate the camera… 15 degrees… Make sure… the Colosseum's not
glitching… If that passes, then we're good to push it." The rotation check passes (below).

Still an admin's town only (`STREET_TOWN`). Decision note: `docs/decisions/2026-11-05-street-north-edge.md`. Area page:
`docs/areas/town-square.md` (the street town, "The north edge").

**Lane: full e2e** (the `full-e2e` label): the plan and the box drawing are shared by every street-town spec.

## What changed

- **The plan** (`scripts/street-plan-north.py`, its north edge section; `town/street-plan.json` rebuilt): 54 × 54 (was 46).
  - **One back line at y = 43.5:** a solid wall the whole way round, meeting the Colosseum's ring at its flanks; the Colosseum is its
    centerpiece, about 1.5 squares proud of it. North of it only the Colosseum, a plain meadow (ground) and trees. Nothing walkable there.
  - **Two gates** in the back wall, either side of the Colosseum, a little past the statues (columns 13–16 and 29–32): a taller stretch
    with a grand arch, open onto trees, the crown's crest over it. You walk up to one, never through.
  - **The plaza is open to Colosseum Row** (rows 40–43, columns 13–32): no wall in front of the Colosseum. The queen and king flank the
    portal, the statues stand before the ring's flanks, the bishop and rook and the knight and pawn mark the plaza's front corners.
  - **Meadow Street:** Upper Street is gone; its four homes (Hopper's, Wrangler's, Moo's, Hollow's) stand on a new street 8 rows south,
    between the closing row and South Street (three wide, so South Street keeps its south sidewalk), backed by a row facing South Street; a
    lane on the promenade's line. The world grows 8 columns east too (it's square); Seam Avenue runs from Meadow Street to Colosseum Row.
  - **Boss homes are never neighbors:** a whole look-alike between any two in a row, and no look-alike narrower than 1 square
    (`rows.ts ROW_MIN_W`, the narrowest normal one; the slim fillers went down to 0.6). Lots moved along their rows with their doors, rest
    squares and wander boxes: Hollow +2, Hopper +1, Wrangler +1, G-Rex +1, Timber +1, Sawyer −1, Tiger −1. Lamps that landed on
    a door or rest square step aside.
  - The start is the same park square, now (22, 25); the park and its zoom-out area move with it.
- **The Colosseum as a solid** (`houses/coliseum-shape.ts`, `houses/coliseum-ring.ts`, new): 18 ring boxes round an oval 17.6 × 14
  squares (outer wall of arches and the board's checkered band; rim, seats and podium inside) and a portal box on the plaza (gate, "THE
  COLOSSEUM" tablet, relief; banners and flag on the ring), drawn 1.2x (about 8.5 squares to the rim). Drawn where it stands like any box,
  over the rows' roofs from near enough; never left out by the near cut and cut nearer the camera, so a drag beside it shows its wall, not
  its bowl; below its rim its bowl is left out (hidden anyway), and only stretches close by get the fine strips on 2D. Round 4's line of
  sight (`colosseumSeen`) and round 5's flat street picture (`HOUSE_COLISEUM_STREET`) removed. Today's town's Colosseum is unchanged.
- **Walls** (`town/wall.ts`): open arches (seen from both sides) and a crest.
- **Statues and chess pieces** on the plaza fade out when nearer the camera than you, as trees do (`render.ts`).
- **The row behind a home with no side walls is never culled** (`boxes.ts openBehind`, `BoxInst.open`; `render.ts`): Ginger's igloo,
  drawn 1.3x, overhangs its own walls, and looking along Fountain Street the sky showed under its dome's edge where the rows' culling had
  left out Colosseum Row's back-to-back row behind it (CI, WebGL, computer, Fountain Street west: 0.008). The fronts back to back behind
  Ginger's, Hollow's, Hopper's and Alfil's homes are drawn whatever the rows hide (15 fronts in the town).
- **Ported from `claude/street-colosseum-big`:** Moo's paddock and Ginger's dome 1.3x (`TOWN_FEEL.streetHomeScale`, `rows.ts homePx`);
  the tap guard (a tap on a building's front, side, back or roof never opens something behind it).
- Ground: the board's squares under the oval only (round it, the meadow).
- Test hook: each box in `__townCam().boxes` has `foot`, its front's drawn ends on screen and the world points they stand for.

## Player-visible changes (admins' street town only)

- The Colosseum is a big 3D building at the head of the plaza, the centerpiece of a back wall that closes the town, with a grand gate on
  each side.
- The plaza opens straight onto Colosseum Row.
- No street or home behind or beside the Colosseum; Upper Street's four homes are on the new Meadow Street in the south.
- Boss homes are spaced: never two side by side, no thin building squeezed between.
- Moo & Moon Meadow and Ginger Igloo are drawn bigger. No new text.

## Checks changed (old → new)

Unit (`packages/app/test`):
- `town-street.test.ts`: "is 46 x 46 …" → "is 54 x 54 …" (and the `W` ground key); start (22, 17) → (22, 25); a ring lot is checked as
  a ring stretch; the park `r1` 26 → 34.
- `town-fixed.test.ts`, "the Colosseum against the back wall":
  - "sits at the top center" → "sits at the north edge, on the promenade's line" (centered on column 22.5; the line 1.5 past its first row).
  - "nothing beside or behind it is walkable" → "nothing past the back line is walkable" (every row from 44).
  - "a wall with a closed gate either side … the back wall along the whole edge, the grove behind" → "the back wall along the whole line,
    the Colosseum its centerpiece, a gate either side of it; the plaza open to Colosseum Row" (every column but 17–28 once; the gates at
    13–16 and 29–32 with a crest; row 39 walkable across the plaza; trees ≥ 6, was ≥ 30 grove trees).
  - "nothing stands north of the back wall" → moved to `town-north-edge.test.ts` ("nothing drawn past it").
  - "no second Colosseum (nor any square twice)" → same, over the grown map's columns and rows.
  - "the statues and chess pieces … on its front line" (the flat picture's `STANDING`) → "… stand on the plaza, planted, never
    overlapping" (props; side by side along each row they stand on; none walked through).
- `town-rows.test.ts`:
  - the streets: Upper Street → Meadow Street; Upper Street's north row over the wrap → Colosseum Row's;
  - the Fountain Street line-of-sight spots 8 rows on (Colosseum Row's north row closing Seam Avenue's end may show, as Upper Street's did);
  - "draws fall to well under half" from Fountain Street: shown / near `< 0.5` → `< 0.55` (with no look-alike under a square there are
    fewer, wider fronts near: 27 of 52 shown, was 28 of 55);
  - wrap distances for 54; the plaza-to-the-bottom-street path; the park's slack squares 8 rows on;
  - "The Colosseum hides behind the rows" (`colosseumSeen`) removed with the line of sight.
- `town-boxes.test.ts`: a box's along/back handedness `toBe(1)` → `toBeCloseTo(1, 9)` (the ring's are float); the roofs drawn in the art's
  order counted over boxes but the ring's (its bowl is left out below its rim).
- New `town-north-edge.test.ts`: nothing walkable or drawn past the line; no street or lot past it; every boss home with door, strip and
  rest square; the plaza open to Colosseum Row; the gates either side, past the statues, walked up to and never through; **boss homes
  never neighbors and no look-alike under a square, every row**; the Colosseum drawn as faces from 8 headings, a closed silhouette at
  different depths; Moo's and Ginger's homes 1.3x.

e2e:
- `town-fixed.spec.ts`:
  - coordinates 8 rows on; Timber's door (4, 31) → (5, 31).
  - "the Colosseum against the back wall" rewritten: from the park, no wall before it and its two gates in view, nothing past the line,
    its ring drawn; up at the gate opens its card; up before each gate and walks past the line stopped.
  - New "the plaza": a drag round in eighths, nothing past the line at each, the ring's faces drawn, figures on screen; then straight
    down onto Colosseum Row.
  - New **"the Colosseum stays put as the view turns"** (2D and WebGL, phone and computer): from (22, 38), four squares before the portal,
    turning 0, +15, +30, +45, 0, −15, −30, −45 degrees: at each, both ends of the portal's drawn foot and of every ring stretch in view lie
    within 2 px of their own world points' projection; from step to step the portal's foot moves as the ground under it does (within 3 px)
    and by more than 20 px. Eric's rotation check, so the old "follows the camera around" can't come back.
  - The stills test: Eric's set (below), and the rotation stills and frames.
- `town-street.spec.ts`: start (22, 25); Ginger's door (34, 23) → (34, 31); Smudgy's (19, 16); the park table's stools row 31; new
  "Meadow Street: each moved home's card opens".
- `town-rows.spec.ts`: Fountain Street row 20 → 28, South Street row 5 → 13, the park's squares and the stills' spots 8 rows on.

## Frame rate

Headless (software rendering), phone (iPhone 13) and computer (1280 × 800), 5 s a route, main (83ceba92) and this branch served in turn
from the same local Worker, medians of 3 (fps), and the boxes' draws a frame (the mean). Routes: **the plaza** (up the promenade from the
park to the gate and back), **Fountain Street** (east along it through the park), **a look round** beside the Colosseum (dragging across
the box again and again at (20, 41)).

| | Main (fps) | This branch (fps) | Draws |
| --- | --- | --- | --- |
| Phone, 2D, the plaza | 59.6 | 60.1 | 7 → 19 |
| Phone, 2D, Fountain Street | 59.3 | 60.1 | 19 → 26 |
| Phone, 2D, a look round | 57.2 | 53.1 | 26 → 63 |
| Computer, 2D, the plaza | 59.2 | 60.0 | 11 → 38 |
| Computer, 2D, Fountain Street | 60.0 | 59.7 | 43 → 38 |
| Computer, 2D, a look round | 57.5 | 53.1 | 38 → 89 |
| Phone, WebGL, the plaza | 17.6 | 18.7 | 7 → 69 |
| Phone, WebGL, Fountain Street | 22.3 | 21.8 | 36 → 47 |
| Phone, WebGL, a look round | 15.0 | 16.3 | 49 → 127 |
| Computer, WebGL, the plaza | 20.7 | 24.4 | 17 → 94 |
| Computer, WebGL, Fountain Street | 26.3 | 26.0 | 85 → 81 |
| Computer, WebGL, a look round | 19.1 | 18.3 | 81 → 153 |

- WebGL runs on software GL headless, so its numbers are low on both builds; they move together.
- **The one drop: the 2D look round beside the Colosseum, about 57 → 53 fps (−7%).** Main draws one flat picture there; this draws the
  ring's 18 stretches and the portal as you turn. Two cuts already in: below its rim its bowl (rim, seats, podium) is left out, hidden
  behind its wall anyway (that took the plaza back to 60), and only stretches close by get the fine strips on 2D. Without them, the
  first measurement was 44 fps.
- If the director wants it back to main's: left out ring stretches whose front faces away (behind the ring's own front) a frame earlier,
  in `planBox` (today they're planned and found facing away), or draw the ring's far stretches with fewer strips. Not done here.

## Stills

`docs/street-north-edge/`, phone and computer (Canvas 2D): `1-from-the-park`, `2-from-colosseum-row`, `3-plaza-close`,
`4-beside-west-looking-east`, `4-beside-west-looking-west`, `5-beside-east-looking-west`, `5-beside-east-looking-east`, `6-west-gate`,
`7-meadow-street`, `8-overview` (the top zoom step). The rotation check: `rot-2d-phone--30`, `rot-2d-phone-0`, `rot-2d-phone-+30`,
`rot-webgl-desktop-0`, and the turns from −45 to +45 degrees, `rot-2d-phone-turn.gif` and `rot-webgl-phone-turn.gif`.

## Test results (local)

- Typecheck clean; the town unit tests pass (21 files, 292 tests).
- e2e, phone and computer, Canvas 2D and WebGL, `town-fixed`, `town-street`, `town-rows`, `town.spec.ts`, plus `account.spec.ts` on the
  phone: 90 passed, 7 skipped (stills only, account's computer run), 1 failed: "the plaza" (WebGL, phone), a bot walking past the box's
  left edge at 1.2 px past it for one sampled frame while the view turned. That check now waits a moment for a figure crossing the edge to
  fade (whole on screen at rest, Eric's rule, unchanged); the test then passed 3 of 3 on the phone, 2D and WebGL.
- **CI's "no sky between the fronts" (286ed215):** fixed (the row behind a home with no side walls is never culled, above). Fountain
  Street west, WebGL, computer: 0.008 → 0; the check passes on phone and computer, 2D and WebGL, 3 of 3 on the phone, and under 4x CPU
  throttling every spot is under 0.0005. CI's phone failure at South Street east (WebGL, 0.013) didn't reproduce locally (0 to 0.0003,
  throttled or not).
- **`account.spec.ts` (CI shard 1, phone: the solo match stuck "simulating"):** not this branch. Under 4x CPU throttling it passes on both
  builds, 182 s on main (83ceba92) and 170 s here. Today's town (a guest's) costs the same to draw: `__townBench(60)`, medians of 5, phone
  9.66 and 10.20 ms on main against 9.45 and 9.86 here, computer 8.30 and 7.64 against 7.79 and 8.64. The guest test never opens the town.
- The rotation check, "the Colosseum stays put as the view turns", passes on phone and computer, 2D and WebGL.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
