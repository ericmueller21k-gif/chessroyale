# Delta re-review: PR #1027's review fixes. Opus, xhigh, read-only. Full lane.

Read `notes/briefs/rules-common.md` first. The first review is `REVIEW.md` on `origin/claude/town-ranked-review` (reviewed head `88932296`);
the fixes are `git diff 32212077..origin/claude/town-ranked` (commits ffa83758, 5dcd2c9d, 0b47e269), summed up in that branch's
`.pr-body-add.md`. Check each fix (S1-S7, N1-N4, N9) really closes its finding, with the first review's repros where they apply, and look
hardest for what the fixes themselves could break: S2's batch deadline and `form()`'s failure path (never two games, never a lost ticket);
S4's cancel during seating (no dodge charged, no game left with one player waiting out `joinSeconds`); S3's close order; S1/S5/S6 on the
watch socket (a player's socket never closed by the watcher rules; old clients). Write `REVIEW2.md` (blockers, should-fix, nits with
file:line and a failing case; Checked; Not reached) on `claude/town-ranked-review`, commit AND push it with `.done2` (`git add -f`), check
`git ls-remote`, stop. No code fixes, no PRs, no comments. Aim for about 30 minutes.
