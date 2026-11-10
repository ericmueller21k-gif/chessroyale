# Delta review: PR #601's fix round (read-only)

The first review is `review.md` on orphan branch `review/fable-b1`. The fixes are commits 459713f..05ed5b2 on
claude/fable-b1 (`git diff 8651755 origin/claude/fable-b1`), explained in `.review-fixes.md` there. Read CLAUDE.md, the
first review, and that diff.

Check only: does each fix do what `.review-fixes.md` says, and does it introduce a new problem? In particular:
- the class-paired second judge: a claimed `kind` at hello is the device's word. Can an attacker use it to land both
  judges more often than the 1.9% stated (e.g. two accounts claiming a rare class)? Can a lobby end up with no judge or a
  stuck pair (class empty, one device, all excluded)?
- the Squads party checker: no path where two devices of one party are the only check on a job that a reward or another
  lobby depends on; a referee never from the same party.
- `atTheDoor`: nothing the app really sends is dropped.
- the `judges.test.ts:216` change keeps the test's claim.
Write `delta.md` on the same orphan branch `review/fable-b1` (add the file, push): findings ranked blocker / major / minor
with file:line and a failing case, or "no new findings". Run the server tests. About 30 minutes.
