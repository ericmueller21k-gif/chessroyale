# Chandy: the move-mix review's follow-ups (Nov 18). Opus, xhigh (boss brain), alone

Branch `claude/chandy-mix-followup` from main (after #797 merged). About 45 min. The review: `git show origin/review/chandy-move-mix:.review.md`.
1. The queen lock as his first unlock only when it could come now (`queenLockOk` on the position at the unlock, him to move, as
   the review suggests); else the random unlock (Eric: "make that upgrade happen earlier", and the decision's "never wastes an
   early slot"). Measure: battles where the first unlock never fired before upgrade 2, before/after (review: ~6 of 20).
2. One focused test: a queen shot and his second taught capture's lock on the same turn: the shot's event before the `first`
   lockOn, and online the hold covers both (`bossMinAt` ≥ the shot's end + `CHANDY_FX.lockOn`).
3. The stale "first capture"/"first lock" comments the review lists.
Boss lane. Done: `.pr-body.md` (under 25 lines, changed checks old → new) and `.done`; push and end.
