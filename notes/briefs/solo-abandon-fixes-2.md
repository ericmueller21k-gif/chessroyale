# Solo abandon (PR #881): the delta re-review's fixes (Nov 22). Opus, xhigh. Full lane. Work ON branch `claude/solo-abandon`.
Read `rereview-881.md` on branch `review/solo-abandon-delta` whole first (and `review-881.md` on `review/solo-abandon` for context).
Fix in the same PR (push to `claude/solo-abandon`; never force-push):
- **P1 (important, blocks the merge): a decided game must be kept from the moment it's decided, not from the results screen.** Today
  the result is posted/kept only at `phase.kind === "results"`, so any hold between the decisive move and the results screen (the
  Hidden Boss's 4.5 s fall, Classic's final FINAL_SHOW_MS, and any other boss's end moment: find them all in solo.ts) lets a
  close/reload record a WIN as a loss. Fix the cause in one place: keep the result (keepUnsent) as soon as the game's outcome is known
  (e.g. where finish/finishBossBattle decides it), so every end moment, current and future, is covered; the results screen then posts it
  as now. A test per window (the fall at least), and one that a future end moment can't reopen the gap (the outcome kept before any
  hold starts).
- **D3:** `signOut` sends a kept result first (`await sendUnsentResult()`), as `verifyEmailCode` does. A test.
- **D2:** store `at` in the kept record and skip the load's/another tab's re-send while the result was kept under ~15 s ago (the read
  still names `unsent`). A test.
- **D1:** no code change: the note and area page say an email sign-in in a second tab also settles the first tab's game (one open solo
  game per account).
Then CI green on your last push, update `.pr-body.md` (title line 1; add these fixes and changed checks), push `.done`. Don't open a PR.
