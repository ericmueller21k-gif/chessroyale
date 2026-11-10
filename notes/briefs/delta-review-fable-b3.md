# Delta review: PR #611's fix round (read-only)

The first review is `review.md` on orphan branch `review/fable-b3`. The fixes are commits e6976a3..c87ce56 on claude/fable-b3
(`git diff a64a605 c87ce56`), explained in `.review-fixes.md` at c87ce56 (`git show c87ce56:.review-fixes.md`); the branch head
has since merged main. Read CLAUDE.md, the first review, and that diff.

Check only: does each fix do what `.review-fixes.md` says, and does it introduce a new problem? In particular:
- B1: can a liar now claim `by: "maia"` to get a bad move played unstruck (anything short of 0.8 a move, every move)? What does
  that do to a raid over 30 moves, and is that acceptable next to Maia's honest losses? A raid still never stalls.
- E1/`maiaReady`/`maiaSaved`: a device that lies about being ready or saved; a raid where no device is ready (unvouched, smooth).
- M1 re-asks and M2 misses: no double strike, no stall, no loop of re-asks; the bare request still decides the same move.
- M3 Squads late answers: a server down or slow; an honest phone struck; the grace.
- M4 per squad and m7: the right squads unpaid, and the cap's notice right after a reconnect.
- m1 `eloDraw`: the boss's strength at each UCI_Elo stays what it was (the PR body's numbers).
Write `delta.md` on the same orphan branch `review/fable-b3` (add the file, push): findings ranked blocker / major / minor with
file:line and a failing case, or "no new findings". Run the server and chess tests and the boss kit. About 30 minutes.
