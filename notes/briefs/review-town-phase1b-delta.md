# Delta re-review: town phase 1b's review fixes. Opus, xhigh, read-only. Full lane. About 30 minutes.

Read `notes/briefs/rules-common.md`. The first review is `REVIEW.md` on `origin/claude/town-phase1b-review` (head 9e9c2046). The fixes are
`git diff 60210c3e..origin/claude/town-phase1b` (970085d0, 9c235859, b2a7e0bd), summed up in that branch's `.pr-body-add.md` and `.done2`.
Check each fix (S1-S5, the nits, the precache's check) closes its finding, and look hardest at what the fixes could break: the stall limit
(`stallMs`, counted in bytes: never cuts off a slow load still moving; never paints over a load that's about to finish; hidden time);
the aborts (home's stop and the town's `closed`: no half-uploaded atlas, no decode left running, no fetch the worker keeps half);
`adoptOrKeep`; the worker's install (a copy failing never fails it; the `/assets/` page check never refuses a real asset); home's fetch
waiting for the controller (never waits forever where no worker comes); clearing the old save (never clears anything else). Write
`REVIEW2.md` (blockers, should-fix, nits with file:line and a failing case; Checked; Not reached) on `claude/town-phase1b-review`, commit
AND push it with `.done2` (`git add -f`), check `git ls-remote`, stop. No code fixes, no PRs, no comments.
