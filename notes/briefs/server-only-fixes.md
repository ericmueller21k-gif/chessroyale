# Fix round: PR #683 (the Hidden Boss never plays a weak move)

Effort xhigh, full lane. Branch `claude/recluse-server-only` (`git pull` first; then `git merge origin/main`: the child form and the
cutscene are on main). Read CLAUDE.md, then the review: `git fetch origin review/server-only && git show FETCH_HEAD:review.md`.
The director's calls (Eric: smooth play first; no weak moves):
- **M1 (load): his searches never wait behind others.** Phase 2's fair-play searches move off `"engine-1"`: score them after the fight
  (or on the fair-play instance), never in his queue. Bots' searches: the device path first for bots (a bot plays for its own team), the
  engine server only if no device answers, so his queue holds his moves. No new try while an earlier one could still be running (the
  lost-search cutoff above a slow search's worst case). Log each pause's length (it already is) so we can measure on production; keep
  `pauseMs` 3000. Unit tests for the queueing order.
- **M2 (budget): his searches are never refused for the day's budget** (they're bounded by fights); his own row still counts them. Add
  his row and a count of "no result" fights to the health view. Unit tests.
- **M3: "no result" covers phase 2's board players only** (`p.names`, as `phase2Unvouched`); everyone else's result stands at their
  placement (the boss's `teamWon` null), a Crowd final's 96 included. Update the decision note. Unit test.
- **Minors:** m1 (a board handed to a bot during a pause), m2 (charge a position once), m3 (the check before `lobby.search!`), and the
  nits as the review suggests.
Typecheck, server/core/app unit tests, `e2e/hidden-boss-room.spec.ts` (both projects, after the main merge). Append a short "Review
round" to the PR body (start from `git show origin/claude/recluse-server-only~1:.pr-body.md` if needed, or the director's copy
`notes/briefs/server-only-pr-body.md`). Push work in progress at each step; `.pr-body.md`, then `.done`, and stop. No PRs, no CI waits,
no model names in commits. Never stop silently.
