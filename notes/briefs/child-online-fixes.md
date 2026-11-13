# Fix round: the Hidden Boss's child form online (branch claude/recluse-child-online), ~45 min

Effort xhigh, full lane. `git pull origin claude/recluse-child-online` first; also `git merge origin/claude/recluse-child-form` (the
director merged main into #678 since). Read CLAUDE.md, then the review: `git fetch origin review/child-online && git show
FETCH_HEAD:review.md`. Fix all five minors and n1, each with a test where it's code:
- m1: one `setBoss(next)` in `net.ts` used wherever `this.boss` is replaced (boss, round, phase2, onReveal), resetting the form state
  (🏆 sent, voices, beats, banners) when the form changes; a test with a device that misses the man's intro.
- m2: drop the seat's premoves when the form changes, online (`NetMatch`) and solo (`nextForm`); a test.
- m3: the review's Crowd-final-through-the-child unit test in `crowd-hidden-boss.test.ts`; fix the dead e2e's skip in
  `e2e/crowd-hidden.spec.ts` (`!== "phone"` or drop the tag) and run it on the project it's meant for.
- m4: the FAQ line and `docs/areas/crowd.md` for the child first.
- m5: the two stale comments. n1: skip `moreLoaders` when `r.bossLoaders` is already set.
Typecheck, the unit tests of packages you touch, `e2e/hidden-boss-room.spec.ts` (both projects). Update `.pr-body.md` with a short "Review
round" section; push work in progress; then `.done`, and stop. No PRs, no CI waits, no model names in commits. Never stop silently.
