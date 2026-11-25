# The scoreboard skips a row that doesn't fit (Nov 26, 2026)

- Main went red on `[phone] panel.spec.ts:282` ("four rows or more" at 390 × 750): 3 rows, then passed on retry.
- Cause: `pickRows` stopped at the first row that didn't fit. You last on your team: you, the leader, the last safe row, then the first row past the cut (a "⋯" gap and the cut line: 142.4 px > the 137 px body) ended the list, though your neighbor fit (132.4 px). Rank-dependent, so 2 runs in 20.
- Fix: a row that doesn't fit is skipped and the next that fits is shown (`packages/app/src/pick-rows.ts`). No CSS, box or threshold change; nothing moves.
- Call made: fix the picking, not the box (`--slots` stays 5 at 750 px, Eric's Nov 25 thresholds). Guard: a unit test of that exact case (`pick-rows.test.ts`).
