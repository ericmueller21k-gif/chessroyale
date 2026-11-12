# Boss Battle select: six to a row, a screen that never scrolls

**Date:** 2026-11-12. **Lane:** light (layout, numbers) with a unit-test change. **Helper:** boss-select six.

**Eric, Nov 12 (his words, on the approved mockup, `notes/mockups/2026-11-12-boss-select-6-v2.png`):**
- "an immutable screen... never scroll";
- "6 per row", shorter tiles, "still... a little bit of gap";
- "bring the start button down";
- "it's okay if the boss is even a little bigger than our guy, because it's supposed to be a boss";
- of the mockup: "exactly what I want."

**What changed**
- Six tiles to a row (`TILES_PER_ROW` 6); tiles square on their box (`TILE_RATIO` 1, was 1.24); a 4 px gap (`TILE_GAP`). Both are settings in `characters/boss-select.ts` and reach the CSS as variables.
- The START form fills its window (`.rd-page:has(.bs-start)`, 100 dvh less the banner): the grid at the top, the stage pushed down into the room left, START at the bottom. The raid form (`?mode=raid`, its list of ways to play) keeps its height.
- The stage shrinks before the grid does: its spot is `min(156px, 46cqi, 100dvh - 547px)`, so 156 px at 746 px tall and up, 93 px at 640.
- The speech bubble sits in its own band above the stage, its box and tail ending above the spot's top (`.bs-say` 46 px, the bubble 16 px up), so it never covers a head.
- Stage room: the whole spot height above the feet (`STAGE_ROOM`), since the bubble is no longer inside the spot. Scale and floor are unchanged (`STAGE_SCALE` 1.5; never smaller than before).

**Calls I made**
- The desktop rules (two rows of eight on a wide column, Nov 2) stay. Eric's "six a row" is for the phone and a narrow window.
- Framing (`SELECT_FRAMING`) is unchanged, because the approved mockup changed only the tile height. The head check now allows the tip to be cut by up to 15% of the figure's width (the pig's hat, Alfil's ears, Hopper and Tiger on the shorter tile). Tiger's span went 56 to 58 so its head stays in its tile.
- The "?" keeps its own shallower slant on a phone (as in the mockup), so the grid's gap and tap-probe checks leave out the pairs beside it.

**Checks changed (old → new)**
- `boss-select.test.ts`: `TILES_PER_ROW` 5 → 6; sixteen tiles `[5,5,5,1]` → `[6,6,4]`; fourteen `[5,5,4]` → `[6,6,2]`; fifteen `[5,5,5]` → `[6,6,3]`; seventeen → eighteen `[5,5,5,2]` → `[6,6,6]`; new: nineteen (admin) `[6,6,6,1]`; head-top check: exact → up to 15% of the span cropped.
- `boss-select.spec.ts`: grid rows `[5,5,5,1]` → `[6,6,4]` (phone and a narrow window); tile height `1.24` → `1`; visible width to height `1.55` → `1.25`; gap band 4–6 px → 4–5 px, leaving out the "?"; tap probes leave out the "?" pairs; the two-row desktop check is unchanged.
- New: "the Boss Battle screen never scrolls" (guest and admin, 428 × 746 and 360 × 640: no page scroll, START on screen, the bubble's box above the boss's visible head).
- `alfil.spec.ts`, `hopper.spec.ts` stage checks: unchanged; they still hold (the floor and the in-stage checks).

Eric's standing rules (docs/rules/eric.md) are untouched.
