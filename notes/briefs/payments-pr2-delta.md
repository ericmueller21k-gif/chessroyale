# Delta review: Payments PR 2 (#950) review fixes (Nov 25). Opus xhigh, READ-ONLY.

The first review: `git show origin/review/pay-play-coins:REVIEW.md` (head a4de7fcc). The fixes: commits a4de7fcc..158d12db on
`claude/pay-play-coins` (`git diff a4de7fcc 158d12db`), mapped in `DELTA.md` on that branch, and the director's calls in
`notes/briefs/payments-pr2-fixes.md` on claude/director-notes (m2: no bonus for a Squads lobby whose bots only its own devices moved).
For each finding (M1, m1-m4, the nits taken): is it fixed at its cause, with a test that would fail without it? Then look for NEW problems
the fixes brought (a retry that now pays twice, a propagated error that loops or blocks a queue forever, the strict/loose tries, the
old-key guards wrongly blocking a new game, the index's schema change on the live D1). Run core + server unit tests. Write `DELTA-REVIEW.md`
on a new branch `review/pay-play-coins-delta` (from 158d12db): each finding → fixed / not fixed / partly, and any new findings ranked
blocker/major/minor/nit with file:line and a failure scenario. Push it only, then stop. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By). About 30-45 minutes.
