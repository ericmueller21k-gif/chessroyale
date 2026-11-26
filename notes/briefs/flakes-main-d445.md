# Main d44548ba: three retry-passes (Nov 26); fix each at its cause

Main run 45876195807 (d44548ba) was red (FLAKY_RED). Logs: `gh api repos/ericmueller21k-gif/chessroyale/actions/jobs/<id>/logs` for
shards 1, 9, 13 of that run; the traces are in each shard's e2e-report artifact.

1. `e2e/dash.spec.ts:778` [desktop], "the clock tap's crawl always finishes": no joke line within 3 s (line 806). Its second time:
   #984 already sends the move from the page the instant `match.phase.stall.beat === "tap"` shows. The director's trace of the cause:
   solo sets the tap beat with `at: Date.now()` and the scoring phase synchronously (`packages/app/src/solo.ts` stallBeat, score),
   but `DashTap` (`packages/app/src/components/DashStall.tsx`, `tapSeen`) stamps `moved` with `Date.now()` *at its render*. On a
   runner drawing 3-4 fps, that render can land after `downAt` (the lie-down is 540 ms), so the joke (move in before he's down) is
   skipped although the move went in at once. A slow phone does the same: a player who moves instantly gets the plain tap. Fix the
   cause in the product: stamp `moved` with when the move actually went in (solo and online: the move's own time, e.g. a time on
   the scoring phase or your pick), not when the screen noticed. Keep it small; no protocol change unless needed (then say so).
2. `e2e/shop.spec.ts:493` [desktop], Hollow Peak: `getByRole("dialog")` (the Shopkeeper's `town-card`) still visible after
   `viewOnYou` at line 545. Find why the card is open there (opened by the walk? a late open?) and fix at the cause.
3. `e2e/xp.spec.ts:81` [phone], the level-up bar: a frame read `Level 2` with share 0.98 (line 137: "and goes on from empty"). The
   label and the bar's fill may change in different frames: if so, a player sees one frame of "Level 2" with a full bar. Find it;
   if it's real, fix the screen so the label and the reset land in one frame; if it's the test's reading, fix the reading.

Lane: targeted. Each fix: show the failure first where you can (e.g. throttle the CPU in Playwright, `--repeat-each`), then the same
check passing. Unit tests for any logic change. One short decision note (about five lines each, or one note for all three).
