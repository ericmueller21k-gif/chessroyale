# Flake: birdie.spec.ts:426 "Birdie's fall" (desktop), recurred Nov 27. Opus high, targeted. Fix at the cause.

Read `notes/briefs/rules-common.md` first. Branch `claude/flake-birdie-fall` from main. The test failed then passed on its retry in
PR #1010's full run (shard 10, desktop): "Birdie's fall: his cutscene plays as he thinks (the fall, the approach, the reveal, the hold),
then Armored Birdie in the bar, and his train warns", `expect(received).toBeLessThan(expected)`. It's the "birdie fall flake" parked
earlier (STATUS: "only if it recurs"); it recurred. Download that run's `e2e-report-shard-10` trace (gh run download), find which
timing bound failed and why (a frame budget on a loaded runner? a timer measured from the wrong moment?), and fix the cause (the app's
timing or the test's measurement, whichever is wrong). Never loosen a bound just to pass. Run the test 5x on desktop (one worker).
`.pr-body.md` at most 40 lines, `.done`.

**Also (main 055db17's run, Nov 27 ~11:05):** `e2e/birdie-home.spec.ts:98` (phone) "his challenge: his hello as he says his line at the
middle table, the board's pop, his wipe": `expect(locator).toBeAttached()` failed, passed on retry (shard 15). Same boss, maybe the same
cause (a moment's timing on a loaded runner). Fix both at their causes in this PR.
