# Street town, round 5: one fixed view, a look round, and the Colosseum against the back wall (admins only)

Title: **Street town (round 5): one fixed view, a look round, the Colosseum against the back wall, admins only**

Eric walked round 4 (live for admins since #503) and got lost:
- "There should be one view point no matter what, always. And then the only time it shifts is if you're standing … on the sidewalk …
  in front of one of their buildings, and then it turns to show their building."
- "If I press left, I start running left, but I don't change the camera angle at all."
- "The Colosseum is literally the edge of the top center of the map … you can't go past it. It's all blocked off."
- On dragging: "it should actually rotate now instead of just doing a pan … when you start to run again, it snaps back to the normal
  view."

Still **an admin's town only** (`STREET_TOWN`); a player's town is unchanged. Built on main at 6ce41d19 (round 4).
- Decision: `docs/decisions/2026-11-05-street-fixed-view.md`.
- Area page: `docs/areas/town-square.md`, "The street town", round 5.

## What changed

- **The camera** (`Town.tsx`, `town/turn.ts`, `town/strips.ts` new):
  - north, always: round 4's chase camera (`chaseTarget`, the walk's legs turning it) is gone;
  - on a boss home's front strip, facing its front, eased over `streetTurnMs` (500 ms), the short way round (`nearestTurn`);
  - the arrows go through that normal heading only;
  - a drag in the street town turns the camera about your pawn (`LookAround`) instead of panning. Letting go keeps it; your first step
    eases it back (`streetLookPerWidth` 180°, `streetLookBackMs` 300 ms).
- **The plan** (`scripts/street-plan-north.py`, its round 5 section; `town/street-plan.json` made again from the art's):
  - a grove beside the Colosseum (columns 13..16 and 29..32 from row 34 to the edge) and along the back two rows: not walked on, trees
    and shrubs;
  - the plaza only in front of it;
  - a wall with a closed gate either side of it, and the back wall on the north edge (`town/wall.ts` new; lots of kind `wall`,
    `street.ts`, `boxes.ts`);
  - the back rows' four skyline towers gone.
- **The Colosseum's street picture** (`houses/coliseum.ts HOUSE_COLISEUM_STREET`, `houses/index.ts`) leaves out the two marble pawns
  painted 78 px up at its back corners, which floated at the low camera. Its statues and pieces stand side by side on its front.
- **`feel.ts`:** `streetLookPerWidth`, `streetLookBackMs`; `streetTurnMs`'s note.
- **Test hooks:**
  - `__townCam()`: `headingBase` (the normal heading), `look` (the look round), `strip` (the home whose strip you're on), and each
    box's `x` and `y`;
  - `__townYou()`: `way` (the way you last walked).

## Player-visible changes (admins only)

- **The camera always faces north**, the Colosseum ahead; walking, the arrows and taps never turn it.
  - The arrows are screen directions: up north, down south, left west, right east.
  - Your figure shows its back, front or side as it walks.
- **On a boss home's front strip** the camera faces the home head on: every home faces south, so the view stays north. The arrow toward
  it opens its card; down steps you off.
- **A drag looks round** about your pawn, half a turn a screen's width; your pawn stays put and keeps facing its way. It stays turned
  until you move, then eases back over 0.3 s. The arrows are always the normal view's; a tap while turned walks where you tapped.
- **The Colosseum stands against the town's back wall:**
  - a stone wall with a closed gate either side of it, trees and shrubs behind;
  - nothing behind it but sky;
  - you come at it from the plaza in front and can't walk beside or behind it;
  - its statues and chess pieces stand side by side before it, planted;
  - a back wall and a grove run along the whole north edge.
- No new text.

## Changed checks (old → new)

No check guarding a rule in `docs/rules/eric.md` changed or was removed. The door rule (a tap or an arrow into a home opens its card)
is checked again in the new e2e, from a home's strip. Round 4's chase-camera checks went with the chase camera:

- `packages/app/test/town-rows.test.ts`:
  - "the chase camera's heading" (keys turning it, a tap's path turning it, a corner's turn over 0.4 to 0.6 s) → removed; replaced by
    `town-fixed.test.ts` "one fixed view" (north on every square but a strip; the arrows as screen directions; the strip turn over 0.4
    to 0.6 s, the short way round).
  - "the skyline's towers …": at least 8 → at least 6 (the back rows' four gave way to the grove).
  - "a path never crosses the north or south edge …": from the plaza's top, (14, 45), now grove → from the gate's square (22, 33);
    the path's length over 40 → over 28.
  - "the Colosseum hides behind the rows": seen from (14, 40), now grove → from the plaza, (14, 32).
- `packages/app/test/town-street.test.ts` "stands every row's front …": the walls (kind `wall`) have their own art, not a look-alike's.
- `e2e/town-street.spec.ts`: "the boxes and the chase camera's turn (2d / webgl)" → removed; replaced by `e2e/town-fixed.spec.ts`
  "one fixed view" and "looking round" (both renderers). The unused helpers went with it.
- `e2e/town-rows.spec.ts`:
  - "no sky between the fronts at street level: … both ways along each" → "… looking both ways along each". Walking along a street no
    longer turns the camera, so a drag a quarter turn each way looks along it, from round 4's squares.
  - "the north edge holds you" (it walked up the plaza beside the Colosseum, now grove) → removed; replaced by `e2e/town-fixed.spec.ts`
    "the Colosseum against the back wall", which is stopped beside it.
- `e2e/areas.json`: `e2e/town-fixed.spec.ts` in the town's area.

## New checks

- **Unit** (`packages/app/test/town-fixed.test.ts`):
  - the heading is north on every square but a home's strip;
  - each home's strip (its squares before its front, its door's among them) and the heading there, with a home facing north turning it
    round;
  - a tap on a strip square walks you there; stepping off is north;
  - the turn's time and the short way round;
  - the arrows as screen directions;
  - the look round: a drag to a heading, release keeps it, the ease back on the first step, the short way, not while dragging; the
    arrows unchanged by it; a tap while turned (at five headings) maps to the square drawn there;
  - nothing beside, behind or north of the Colosseum walkable, and no path to it;
  - the walls and the back wall where the plan puts them, trees behind them, no tower on the back rows;
  - nothing standing north of the edge;
  - no square laid twice in view at any zoom step (no Colosseum copy at the sides);
  - the statues and pieces side by side, planted, no floating back pawns.
- **e2e** (`e2e/town-fixed.spec.ts`; phone and computer, Canvas 2D and WebGL):
  - **"one fixed view":** all four arrows, each its screen direction, the camera never turning (every frame read). Then a tap on Timber's
    strip: on it, facing the home, the up arrow opens its card, down steps off and it's north again.
  - **"the Colosseum against the back wall":**
    - from the park it's ahead, in the middle, with a wall either side;
    - no box drawn behind it or its walls but the back wall, and no tower in view;
    - at the gate, up opens its card;
    - at the plaza's corners, up is stopped, and a walk asked for beside or behind it never ends there.
  - **"looking round":** half a turn by a mouse drag; your pawn's square, facing and view unchanged; the street's south row in view. Up
    eases it back (seen mid-way) and walks you north. A drag a quarter turn, then a tap on the square drawn behind you walks you there
    and eases back.
  - Every figure on screen throughout.

## Frame rate

Measured as rounds 3 and 4 were:
- Headless (software rendering), phone (iPhone 13) and computer (1440 × 900), 5 s walking on a set route.
- Round 4's build (main 6ce41d19) and this one were served in turn on the same server, the runs interleaved.
- The routes: **Fountain Street** (west and back along it, through the park) and **the plaza** (up the promenade from the park to the
  Colosseum's gate and back).
- The draws are the boxes' strips and faces in a frame, the mean over the run.

**Canvas 2D (the default), medians of 3 (fps), and the draws, round 4 → 5:**

| | Round 4 | Round 5 | Draws |
| --- | --- | --- | --- |
| Phone, Fountain Street | 57.9 | 59.3 | 44 → 32 |
| Phone, the plaza | 47.1 | 58.8 | 29 → 8 |
| Computer, Fountain Street | 53.4 | 59.5 | 60 → 47 |
| Computer, the plaza | 46.6 | 57.5 | 46 → 15 |

The fixed view looks across one street rather than down it. The plaza gains most: round 4's chase camera looked along Upper Street and
the plaza's strips past the Colosseum; now only the Colosseum and its walls stand there.

**WebGL** (`?gl=1`, software in headless; one run each):
- phone: Fountain Street 17.0 → 20.8 (draws 123 → 58), the plaza 15.3 → 17.4 (65 → 11);
- computer: Fountain Street 17.9 → 21.6 (209 → 108), the plaza 18.1 for round 5. Round 4's computer plaza run was lost: the local
  server stopped answering when a build was copied in under it.

## Stills

`docs/street-town-fixed/`, phone and computer (Canvas 2D):
- `1-street-looking-north` (Fountain Street);
- `2-home-strip-timber` (on Timber's Lumber Lodge's strip, its door's square; Timber held back at his rest square for the still);
- `3-colosseum-from-the-park`;
- `4-colosseum-plaza-close`;
- `5-statues`;
- `6-wall-corner-west`, `6-wall-corner-east`;
- `7-looking-round` (a drag on Fountain Street: its south row).

## For the director

- **All sixteen homes face south** (the north sides of their streets), so the strip turn is north on every one: the camera never turns
  in the shipped town except by a drag. It's built for any facing and unit-tested with a home facing north. The addendum's homes "on
  the south sides of streets (their fronts face north)" aren't in the plan. Moving one there needs only the plan.
- Round 4's stills test (`e2e/town-rows.spec.ts`, STILLS only) still walks along streets, which no longer turns the camera; its stills in
  `docs/street-town-rows/` are round 4's record.

## Unfinished / later

- The bigger Colosseum (Eric: "make it taller and bigger … we can do that later").
- The grove's trees are the park's tree art; the walls are new art in the town's palette.

## Lane

**Full e2e** (the `full-e2e` label): the town's plan, camera, input and drawing are shared.

Run locally (wrangler dev, phone and computer, under the shared e2e lock):
- **Unit:** `npm test`, 4233 passing; `npm run typecheck` clean.
- **e2e:** the town's whole area in `e2e/areas.json`: 230 passed, 14 skipped (stills only and the like), 2 failed, then passed on a
  re-run.
  - The specs: `town`, `town-street`, `town-rows`, `town-fixed`, `town-chat`, `town-chat-history`, `town-desktop`, `town-tags`,
    `town-webgl`, `colosseum`, `shop` and `boss-challenge`, plus `problems` and `profile` (they open the admin's town).
  - Dash's challenge in the admin's town (desktop) timed out under load and passed alone.
  - `colosseum.spec.ts` "the gear's Pieces" (desktop, the arena page, which this doesn't touch) failed twice, then passed three of
    three on this build and three of three on main's: a flake.
- `e2e/town-fixed.spec.ts` was also run twice over, and its "one fixed view" three times over, on both renderers.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
