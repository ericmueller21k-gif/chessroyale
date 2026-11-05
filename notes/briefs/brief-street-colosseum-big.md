# Brief: the street town's Colosseum, bigger and looming; Moo's and Ginger's homes up in their rows (art and code; Opus high)

Worktree `/home/user/cr-bigcol`, branch `claude/street-colosseum-big`, from main f5e73337 (round 5, #504, live for admins). Set it
up with `npm ci`; never symlink node_modules. Ports 8997, inspector 9497. Include notes/briefs/rules-common.md. Still admins only
(`STREET_TOWN`). Draw by hand, with no API or art runner. Push as you go.

Read first:
- `docs/decisions/2026-11-05-street-fixed-view.md` and `docs/street-town-fixed/pr-body.md` (round 5);
- `packages/app/src/town/houses/coliseum.ts`, especially `HOUSE_COLISEUM_STREET`;
- `town/wall.ts`;
- `scripts/street-plan-north.py`.

## 1. The Colosseum looms
Eric (Nov 5): "make it taller and bigger, so it really feels like a true overwhelmingly large kind of building … you won't actually
be able to see the Colosseum unless you're running towards it."
- **In the street town only, make it about twice as tall and clearly wider**, a true landmark. Today's Colosseum elsewhere stays
  as it is.
  - Add tiers of arches, more height above the gate and banners.
  - Keep its look and palette; it's the same building, grander.
  - Keep its front and gate at the plaza, and keep "THE COLOSSEUM" readable.
- **It should show over the rooftops** from the streets south of it as you face north (the fixed view): its top tiers rise behind
  the rows, so you always know where it is. Round 5's camera always faces north, so this is your landmark.
  - Check the row heights and culling so its top draws behind the rows and never through them.
  - Check its depth sort against the walls, gates, trees and statues.
- **The back wall, gates and grove** stay as round 5 placed them, scaled to fit beside it if needed. Behind it is still only sky.
- **The statues** stay planted and spaced on the plaza in front.
- **Nothing beside or behind it is walkable**, as now. Any extra width gets grove squares in the plan (`street-plan-north.py`),
  with the plan rebuilt and the round 5 unit tests kept green.
- **Frame rate:** measure the plaza and Fountain Street routes against main (2D and WebGL, phone and computer), as round 5 did. It
  must not drop noticeably. Give the numbers.

## 2. Moo's paddock and Ginger's dome sit low in their rows
In the street town their homes look sunk or short beside their neighbours. Raise or rescale them so their fronts line up with
the row's ground line and their height sits with the others. Keep their doors, cards and rest squares working.

## Done
- **Unit tests:**
  - the Colosseum's street box size;
  - its top visible over the rows from at least two street spots;
  - nothing walkable beside or behind it;
  - no square drawn twice;
  - Moo's and Ginger's ground lines.
- **e2e:** round 5's town-fixed checks still green on phone and computer, on both renderers. Add one check that the Colosseum's top
  is in view from a street south of the park.
- **Stills** in `docs/street-colosseum-big/`, on phone and computer:
  - from a street south of the park looking north (its top over the roofs);
  - from the park;
  - at the plaza;
  - Moo's and Ginger's rows.
- **The PR body** in `docs/street-colosseum-big/pr-body.md`. Lane: the town area, or full e2e if shared drawing code changes.
- **A decision note** in `docs/decisions/2026-11-05-street-colosseum-big.md`.
- Don't open the PR. Stop with a short report.
