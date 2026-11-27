# Delta review: PR #1012, crates Nov 27 (FULL lane: crate grants), the fix round

Read `notes/briefs/rules-common.md` first. Read-only, Opus, effort xhigh, about 30 minutes. The first review's findings are `REVIEW.md` on
branch `claude/crates-nov27-review`; the fix round's commits are `553b096e`, `dec95369`, `a71c58d9` on `claude/crates-nov27` (head now
`0a685aea`, main merged in). Check:
- each finding (S1-S4, N1-N11) is truly fixed, with a check that would fail without the fix where one was asked for;
- the fixes broke nothing: the grant (once per signed-in account ever, server-side, idempotent; never a guest), the level-5 gate (server
  refuses below level 5, level from the server's XP), the notice under the walkthrough (S4), "Nothing to open" counting only what opens;
- no guard test (docs/rules/eric.md) edited; the main merge left nothing broken (`npm run typecheck`, the touched packages' unit tests).
Write `DELTA.md` (blockers, should-fix, nits with file:line and a failing case; Checked; Not reached) on branch
`claude/crates-nov27-delta` from the PR head, push, `.done`. Don't fix code, open PRs or comment on GitHub.
