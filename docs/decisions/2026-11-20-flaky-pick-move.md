# One move picker for the e2e specs (Nov 20, 2026)

Main red on f25c38a: `recluse.spec.ts:951` (the test's a-pawn pushes let the Hidden Boss's child mate before Win this form) and
`boss-select.spec.ts:874` (the tail measured before the stage figure's chunk landed). Call made, per "fix the cause, not add a checker":
the specs' own move pickers (each had missed a case) give way to one, `pickMove` in `e2e/helpers.ts`, which never plays a move that lets
the other side mate at once; recluse, boss-bar and boss-dock use it (banner-time scripts its moves, so it keeps its own). The tail test
waits for the figure's paint like the stage's other checks. Story: `docs/history/lessons.md`, "A mate the test walked into".
