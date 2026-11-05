# Street town, rounds 3 and 4: box buildings, joined rows, the chase camera, a town that wraps east-west only (admins only)

Title: **Street town (rounds 3 and 4): box buildings, joined rows, the chase camera, the Colosseum at the north edge, admins only**

Still **an admin's town only** (`STREET_TOWN`); a player's town is unchanged. Built on round 2 (#499, merged) and main through #502.
- Round 3 (`claude/town-boxes`, 42809163, merged in): every building is a box.
- Round 4 (`claude/town-rows`): the rows, the chase camera and the new world shape.

Decisions: `docs/decisions/2026-11-05-street-town-boxes.md` (round 3) and `docs/decisions/2026-11-05-street-rows.md` (round 4). Area
page: `docs/areas/town-square.md`, "The street town".

Eric (Nov 5), round 3: "you can clearly see the houses are flat, any way to fix?" Round 4: "I described it like the Toontown streets
where everything is literally connected… you literally need to connect the houses"; "they just need to be attached like that… most of
them aren't actually like real buildings… they look alike". On the mockup: "we're definitely getting very close to what I'm
visualizing"; "I think this is a pretty good default". On the world: the Colosseum "at the top centre, at the north edge … nothing is
behind it"; "left and right wrap (Pac-Man style)".

## What changed

### Round 3: boxes (summary; its own body is `docs/street-town-boxes/pr-body.md`)

- `town/boxes.ts` and `town/box-draw.ts`: every lot, shed and hedge run is a box. Its sides a neighbour covers are skipped; its roof faces
  are painted once a heading; each part is sorted by its own depth.
- `camera.ts`: the view's heading (`setHeading`, `toCam`, `rel`, `fromCam`, the turned ground grid).
- `town/turn.ts`: the eased `Turn` and the arrow keys through the heading.
- A home's name sits over its own roof. Both renderers draw the same pieces.

### Round 4: the rows

- **The rows** (`town/rows.ts`, new). Every built side of every street is one row, 16 sides:
  - both sides of the four east-west streets;
  - Seam Avenue's own stretch;
  - the closing row along the south edge.

  The homes keep their lots, sliding along a row only to fit its end. Look-alikes of 1 to 3 squares and slim fillers (0.6 or more)
  fill every gap, butted 1 px under each neighbour. Corners turn onto the cross street. A home's neighbours are 4 floors and every
  front at least 3; one landmark a side, away from the homes. A 3-deep block is two rows back to back; a deep block has a row on each
  street with its gardens and tall blocks between.
- **Look-alike fronts and the skyline** (`town/lookalike.ts`, new):
  - a parts generator: body, colour, material, windows, a door or a shop, and a roof cap;
  - flat fronts (one flat roof face) away from corners;
  - a rear wall drawn only from behind;
  - the skyline's towers (6 to 9 floors, windows all round).
- **The plan:**
  - `town/street-plan.json` is made from the art's by `scripts/street-plan-north.py`, and `town/street.ts` lays the rows over it
    (`withRows`, `homesOn`, `ROW_GROUND`, `STREET_WRAP`, `STREET_COLISEUM`, `colosseumSeen`).
  - The plan's rows moved up 6. The art's Seam Street is South Street. A closing row runs along the south edge. The Colosseum sits at
    the north edge in a paved plaza. Seam Avenue ends at Upper Street. Still 46 × 46.

### Round 4: the world, the camera and the drawing

- **The world wraps east-west only:**
  - the switch is `camera.ts WRAP`, from the plan's `wrap`; `wrapFX`, `wrapFY`, `colI` and `rowI` give -1 off the world;
  - `world.ts` uses them for paths, steps, `walkable`, distances, the bots' and bosses' targets and the Colosseum's place (from the
    plan in the street town);
  - so do `Town.tsx` (the keys, the glide, the camera's wrap) and `render.ts` (an off-world square is a meadow; names, chips).
- **The chase camera:**
  - `turn.ts chaseTarget` (round 3's `camAt` and the far Colosseum's 45 degrees are gone), `Walker.leg`, and the walker's last way for
    the figures' views;
  - the keys go through the way you faced as the hold began, and keep their rule for a step still under way after release
    (`walkByKeys`);
  - #502's `rowsUp` is folded in (1 in the town).
- **Zoom steps and the park's step out** (`town/zoom-steps.ts`, new: `StreetZoom`, `parkSide`; `feel.ts` `streetZoomSteps`,
  `streetZoomStart`, `streetZoomMs`, `parkZoomOut`, `parkZoomMs`).
- **What the rows let you see** (`town/seen.ts`, new): rays cast from the camera's focus and the camera, worked out ahead. `render.ts`
  leaves the rest out at the close steps (`streetCull`, `streetTowerReach`).
- **`render.ts`** also:
  - hides a home's name with its home;
  - snaps slanted sign lettering;
  - shares a flat roof's painting across headings.
- **`boxes.ts`:**
  - fronts face all four ways;
  - walls are cut at the camera's near plane;
  - roofs are painted for each of the four quarters;
  - a rear wall shows from behind;
  - a row's 1 px overlaps count as butted, so the party walls between look-alikes, which the mockup still drew, are skipped;
  - an art's own pixels a square (`px`, for `streetBuildScale`, 1).
- **`feel.ts`:**
  - `camStreetTall` and `camStreetWide` (the default step);
  - `streetTurnMs` 400 → 500 (Eric: "about 0.4 to 0.6 s");
  - `boxStrip` and `boxStrips` (the 2D fallback's wall strips) 4 and 8 → 8 and 5;
  - `streetBuildScale` (1).
- **Test hooks:** `__townCam()`'s `zoom` (now the step), `parkBefore`, `horizon`.

## Player-visible changes (admins only)

- **Every street is walled in by rows of fronts**, the homes among them; sky shows over the rows and the skyline's towers, never
  between fronts at street level. Corners are closed. You see the street you're on and the openings at its ends.
- **The Colosseum is at the town's north edge** in its plaza. You reach it by running up through the town (the promenade, Upper Street,
  Colosseum Row). The rows hide it from the other streets. The south edge is a row of buildings, and east-west still wraps.
- **The camera chases you**, low behind your pawn, looking down the street; it swings round over half a second at a corner.
  - Up walks forward. Down steps back without turning. Left and right turn you and step.
  - Taps work as before.
- **Four zoom steps** on − and +: in (head height), the default (the mockup's), out, and an overview.
- **The park zooms out a step** as you arrive, and back as you leave (a trial; `parkZoomOut`).
- A home's name no longer floats over the row in front of it. Signs at a slant stay crisp.
- No new text.

## Changed checks (old → new)

No check guarding a rule in `docs/rules/eric.md` changed or was removed: a tap or an arrow into a home still opens its card, now with
the arrow that points at it. These are round 2's and round 3's own checks, moved to round 4's plan and camera.

- `packages/app/test/town-boxes.test.ts`:
  - "every lot is a box: its front on its front line, centred on its lot, facing its street" → "every lot is a box facing its street:
    a home on its lot's front line (centred, or slid along its row to fit), a row's front where its row put it". Seam Avenue's fronts
    now face the avenue both ways.
  - "is drawn in the art's order …" and "draws each building in about 12 to 20 draws …": now seen from each front's own street,
    whichever of the four ways it faces (were south and west only).
  - "a face turned away … isn't drawn": Timber's lodge (was Seam Street's bakery, now gone).
  - "leaves out what's nearer the camera than the cut": a South Street front (was the bakery).
  - "skips a side a neighbour at least as tall covers": now checks the rows' party walls (50 or more boxes) and that a corner's turned
    end is never hidden (was the bakery, shop and townhouse of round 2's Seam Street).
  - Removed:
    - "faces north everywhere but Seam Avenue …" (`camAt`) → town-rows.test.ts "the chase camera's heading";
    - "the Colosseum's far drawing shows only within 45 degrees of north" → town-rows.test.ts "the Colosseum hides behind the rows".
- `packages/app/test/town-street.test.ts`:
  - "is 46 x 46, every square's ground as the plan has it" → "…, the rows' squares lots (a row stands on them, drawn paved)";
  - "starts you on the promenade … (22, 11)" → "(22, 17)";
  - "stands every everyday building's front on its lot's front line … and every prop where the plan puts it" → "stands every row's
    front on its row's building line facing its street, the skyline's towers on their lots, and every prop where the plan puts it but
    under a row";
  - the park's table check: the park at (13, 26) (was (13, 20)).
- `packages/app/test/town-rows.test.ts`: the mockup's tests (Fountain Street only, 300 swaps) → every side, 600 swaps, and the rest
  below.
- `e2e/town-street.spec.ts`:
  - "opens zoomed in, at the start (22, 11)" → "opens at its default zoom step, at the start (22, 17)" (`zoom` 0 → 1, the step);
  - Ginger Igloo's door (34, 17) → (34, 23), along Fountain Street's rows 19 to 22. The tap waits for the glide to settle and looks
    again if the home isn't drawn.
  - Smudgy's door (19, 2) → (19, 8). "the up arrow into it opens its card" → "the arrow toward it": the key that points north as the
    chase camera faces.
  - The park table (19, 17) → (19, 23).
  - "the boxes and the turn (2d / webgl): walking east along Fountain Street onto Seam Avenue the camera turns" → "the boxes and the
    chase camera's turn": down Seam Avenue and east into Fountain Street. The camera swings south → east, eased, seen midway; both rows
    are drawn.
  - The arrows: up ahead, down back without turning, left and right turning. Mid-turn, up is the way you're heading (was: the way the
    screen's up points most nearly). A tap mid-turn and after.
  - Removed (stills only, `STILLS`): "stills: each street of the street town" (round 2's) and "stills: the boxes and the turn"
    (round 3's) → `e2e/town-rows.spec.ts` "stills: the rows (round 4)".

## New checks

- **Unit** (`town-rows.test.ts`):
  - full coverage of every side as shipped and after 600 random slot swaps;
  - every join blended (the 1 px overlap, a pilaster strip between two homes);
  - corners closed;
  - every home in a row;
  - no front under 3 floors, a home's neighbours 4 (about 3 pawn heights);
  - the skyline's towers;
  - flat fronts away from corners;
  - what the rows let you see (draws under half);
  - the wrap: paths never cross north or south, and cross east-west the short way;
  - doors reachable;
  - the zoom steps and the park's step out (slack, a press wins, the switch);
  - the chase camera's heading and the turn's 0.4 to 0.6 s;
  - the Colosseum's line of sight.
- **e2e** (`e2e/town-rows.spec.ts`, phone and computer):
  - no sky colour at street level at the sides, along Fountain Street and South Street both ways, Canvas 2D and WebGL. This catches
    sky showing through a gap at the fronts' lower floors (round 2's problem), not a gap that shows ground;
  - the zoom steps with every figure on screen at each;
  - the park's step out, in and out, and a press in it winning;
  - the north edge holding you.

## Frame rate

Measured as round 3 did:
- Headless (software rendering), phone (iPhone 13) and computer (1440 × 900), 5 s walking. Round 3's build (42809163) and this one
  were served in turn on the same server, the runs interleaved. The machine was shared, so single runs vary by ±2 fps.
- **Fountain Street:** west and back along it, through the park. Round 3's plan row 13, this one's 20.
- **The turn:** up and down Seam Avenue, through Fountain Street's and Colosseum Row's crossings. Round 3's camera turned at the
  crossings; round 4's swings half round at each end.
- The measuring script isn't in the repo: it copies each build over `packages/app/dist` in turn.

**Canvas 2D (the default), medians of 4 (fps), and the boxes' draws in the last frame:**

| | Round 3 | Round 4 | Draws, round 3 → 4 |
| --- | --- | --- | --- |
| Phone, Fountain Street | 57.3 | 57.1 | 59 → 63 |
| Phone, the turn | 56.7 | 57.7 | 82 → 59 |
| Computer, Fountain Street | 59.4 | 58.2 | 120 → 86 |
| Computer, the turn | 57.7 | 58.0 | 114 → 75 |

**The phone holds round 3's rate:**
- the turn is 1 fps up;
- Fountain Street is 0.2 fps under, within the runs' spread.
- Draws fall on three routes. Along Fountain Street on the phone they rise by 4: both rows, where round 3 had sparse lots.

**The cuts** that took round 4 there from 55.4 (the first measure; round 3 59.5 then):
- **What the rows let you see.** Culling off measured about 50 fps.
- The cover rule counting a row's 1 px overlaps as butted, so party walls aren't drawn.
- A flat roof painted once for all four headings, and the roof budget `boxBakeMs` 2.5 → 1.5 ms.
- The line of sight walked square by square (1.6 → 0.8 ms a square) and worked out a square ahead.
- The skyline's towers no ray reaches drawn out to 8 squares (`streetTowerReach`).
- The 2D fallback's wall strips 4 px / 8 → 8 px / 5, and its walls smoothed only drawn under a pixel a picture pixel
  (`wallSmooth2D`). WebGL keeps its own.

**WebGL** (`?gl=1`; software in headless, so slow either way), medians of 2:
- phone: Fountain Street 19.2 → 19.6, the turn 22.7 → 21.6;
- computer: Fountain Street 21.9 → 17.6, the turn 23.0 → 20.9.

  WebGL keeps its fine strips (`boxStripsFine` 24). Its draws are 100 → 153 on the phone's Fountain Street and 183 → 276 on the
  computer's. On a GPU those strips are a few vertices each in its few draw calls.

**The 2D fallback** keeps the same chase camera, since it holds round 3's phone rate (the decision note). The brief allowed a higher
view there; it isn't needed.

## Stills

`docs/street-town-rows/`, phone and computer:
- each street by day: `1-south-street`, `2-fountain-street`, `3-colosseum-row`, `4-upper-street`, `5-seam-avenue`;
- `6-boss-home-in-its-row` (Sawyer's woodshed);
- `7-corner-mid-turn` (Seam Avenue into Fountain Street, held midway);
- `8-colosseum-plaza` (up the promenade);
- `9-park-on-arrival` (a step out);
- `10-zoom-0-in` … `10-zoom-3-overview`;
- `11-fountain-street-dusk`.

The mockup Eric saw is in `docs/street-town-rows/mockup/`.

## Unfinished / later

- The bigger Colosseum (Eric: "make it taller and bigger … we can do that later"): the director's follow-ups.
- Moo's home is a low paddock and Ginger Igloo is a dome, so the sky shows over them in their rows; they stay as drawn.
- The look-alikes' bodies are straight-sided; only the caps bulge.

## Lane

**Full e2e** (the `full-e2e` label): the town's plan, camera, paths and drawing are shared.

Run locally (wrangler dev, phone and computer):
- unit: `npm test` (4220 passing; `npm run typecheck` clean);
- e2e: the whole town area in `e2e/areas.json`, 226 passing and 12 skipped (stills only and the like):
  - `town`, `town-street`, `town-rows`, `town-chat`, `town-chat-history`, `town-desktop`, `town-tags`, `town-webgl`;
  - `colosseum`, `shop` (#502's room keys) and `boss-challenge`;
  - `problems` and `profile` (they open the admin's town).

  The run was cut short by the local server stopping at its time limit; the tests it cut were re-run against a fresh server and passed.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
