# Birdie's fix round (#896). Opus, high. Boss lane: fix in the same PR, no second review

Branch `claude/birdie` (PR #896). The review is `review-896.md` on branch `review/birdie` (`git show origin/review/birdie:review-896.md`).
Also read `notes/briefs/birdie-fixes-pre.md` on `claude/director-notes` (two items the director collected). Start:
`git fetch origin claude/birdie main && git checkout -B claude/birdie origin/claude/birdie && git log --oneline -1`. Fix, one commit
each, push each:
1. **I1** (important): `trainRanked` and `trainJudged` break ties by what the move leaves to the train, lower first (a king left on the
   line never ranks level with saving it). The unit test the review names.
2. **N1**: no warning on a turn the move cap ends (in the rules, so the judge and the ride agree).
3. **N2**: the lobby's train-win hold sets `this.r.birdieAt` before its broadcast, as `thinkMinAt` does.
4. **N3**: solo's train-win hold sets `birdieAt` as `bossTurn` does and shortens the hold by the time kept, so a reload doesn't wait the
   whole hold again.
5. **The CI failure** (pre-item 1): `e2e/town-street.spec.ts:489`'s expected music list dedupes files (a loop shared by two themes is
   fetched once). And find out whether `town-solo-a.mp3` was really fetched twice (on main too?); fix that at its cause if it's real.
6. **The crossing over the piece** (pre-item 2): the crossing belongs on the board layer under the pieces, as Grex's fire tiles. A
   phone still of the warning, with the piece fully visible, for the director.
Prove it with typecheck, the unit tests you touch, `e2e/birdie.spec.ts` and `e2e/town-street.spec.ts` (phone) locally, and the boss
kit. Update `.pr-body.md` (a "Review fixes" section, changed checks old → new), write `.done`, push and stop. Don't open PRs or wait
on CI. Commits end with the `Claude-Session:` line only.
