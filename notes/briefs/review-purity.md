# Independent review: PR #1007, exactly 100% and exactly 0% purity at 1 in 5,000 each (FULL lane: odds), Nov 27

Read `notes/briefs/rules-common.md` first. Read-only, Opus, effort xhigh, about 30 minutes. Review `git diff origin/main...origin/claude/purity-zero`
(the PR body on GitHub states the odds before → after; Eric's words are in it). Check:
- `PURITY_BANDS` (core crates.ts): the weights add to exactly 100; bands contiguous from 100 to 0 with no gap or overlap in tenths; shiny
  (90%+) still 0.4%; under 5% still 1%; exactly 100.0 and exactly 0.0 each 0.02%; 99.0-99.9 unchanged per tenth.
- `rollBlemish`: one-value bands roll that value; the boundaries (first and last draws) map right; no off-by-one at a band edge; the
  server rolls with it (crate openings, bonus crates, welcome/boss crates) and nothing else depends on the old band count or order
  (grep every PURITY_BANDS / band index use: app, server, sim, FAQ, the crate page's chips, the odds tests).
- The shown odds (crate page chips and paragraph, FAQ table and sentence) match the rolled odds and read plainly.
- Tests: do the new ones fail without the change? Any guard test (docs/rules/eric.md) touched?
Write `REVIEW.md` (blockers, should-fix, nits with file:line; Checked; Not reached) on branch `claude/purity-zero-review` from the PR head,
push, `.done`. Don't fix code, open PRs or comment on GitHub.
