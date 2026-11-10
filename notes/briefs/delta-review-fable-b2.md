# Delta review: PR #610's fix round (read-only)

The first review is `review.md` on orphan branch `review/fable-b2`. The fixes are commits 364c1ae..2d689d8 on claude/fable-b2
(`git diff 2970b78 2d689d8`), explained in `.review-fixes.md` at 2d689d8 (`git show 2d689d8:.review-fixes.md`); the branch head
has since merged main. Read CLAUDE.md, the first review, and that diff.

Check only: does each fix do what `.review-fixes.md` says, and does it introduce a new problem? In particular:
- m2: results written in the background (`ctx.waitUntil`) with no re-arm after the write: can a result now wait past its retry,
  or a lobby close (or be evicted) with a write still running, or two writes of one result overlap?
- m1: a retried fair-play write runs `actOn` again: can it email twice, open a second case, or double-count a match in the level?
- m3: `failedAt` and 30 minutes: an old stored record (from before this field) still drains; nothing is held forever.
- m4: the whole-position budget update: a position that can't get its budget, and a server that stops answering, leave the budget
  and the queue consistent; a banned case's capped check (the helper's note) is fine for appeals, or say why not.
- m5: the app stops asking after 401/429 for one game only, and a new game asks again.
- M1: no route left where the reviewer's token bans (API, admin page, appeal decisions, evasion).
Write `delta.md` on the same orphan branch `review/fable-b2` (add the file, push): findings ranked blocker / major / minor with
file:line and a failing case, or "no new findings". Run the server tests. About 30 minutes.
