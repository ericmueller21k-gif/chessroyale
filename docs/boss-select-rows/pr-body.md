Title: Boss Battle picker: two rows of tiles on a computer's middle column

## What changed

- On a computer, when the page's column (the middle column less its 32 px sides) is 660 px or more, the boss tiles go in two rows across it: nine and eight with seventeen tiles (an admin's, with Timber), eight and eight with sixteen. Narrower windows and every phone keep five a row.
- The page takes the middle column's width. The select fills it; the stage, the ways to play and the header keep their 496 px column. The versus row, the bubble and START move up under the tiles: START is in the window at 1280 x 800, 1440 x 900 and 1920 x 1080.
- Markup: the component also sets `--bs-two` (the first row's count). The rows stay in the DOM; the layout is CSS (`@container rd-page` in `packages/app/src/styles.css`).
- Decision: `docs/decisions/2026-11-02-boss-select-rows.md`. Area pages updated: `docs/areas/bosses.md`, `docs/areas/hub.md`.

## Player-visible changes

- Computer, wide: two rows instead of four; START and the stage move up. The "?" beside the Hidden Boss is a card's full height (still 0.82 of a card wide, with the bosses' slant), with a bigger "?". Alone in a row of five it keeps its small size.
- Phone: none (the still is byte-identical). Narrow computer windows: none.
- New text: none.

Stills in `docs/boss-select-rows/`: `computer-1280x800.png`, `computer-1440x900.png`, `computer-1920x1080.png`, `narrow-1100x800-fallback.png`, `phone-390x844.png`, and Eric's `eric-before.png`.

## Checks changed (old → new), `e2e/boss-select.spec.ts`

- The grid test (light and dark): its name now says two rows of eight across a computer's column. Rows on a computer `[5, 5, 5, 1]` → `[8, 8]` at 1280 x 800 (phone unchanged).
- The grid test, computer: the cards "capped at 96 px" (`toBeCloseTo(96)`) → "90 px or more".
- The grid test, computer: "room each side > 20" → removed. The 8 to 12 px left and right buffer, checked on a phone before, is now checked on the computer too.
- The grid test, computer: the "?" height half a card → a full card (phone unchanged).
- `measureGrid` (helper): rows read from the `.bs-row` boxes → rows read from the tiles' tops. The same rows on a phone.
- The layout test: the row count read from the `.bs-row` boxes → the tiles' lines. The same count on a phone.
- Added (computer only): "on a computer the tiles go in two rows across the middle column, and START shows at 1280 x 800 (Eric, Nov 2); a window under 1280 px wide keeps five a row".
- No check removed. `docs/rules/eric.md` has no guard on the grid's shape. "Nothing shifts" holds on the phone; on the computer the stage moves up because Eric asked for it.

## Lane

Light: layout only (CSS, one style variable, no logic). Local checks: typecheck of `packages/app`; `e2e/boss-select.spec.ts` on both projects under the e2e lock (22 passed, 6 skipped as project-only).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
