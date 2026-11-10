# Delta review 2: PR #611's second fix round (read-only)

The reviews so far are `review.md` and `delta.md` on orphan branch `review/fable-b3`. The second fix round is commits 1b6ff43..e576a8e
on claude/fable-b3 (`git diff 08e5f52 e576a8e`), explained in `.review-fixes.md` at 5a01fb6 (`git show 5a01fb6:.review-fixes.md`).
After it the director made one change on Eric's word (a6ddc0c: a Squads party alone with bots is paid as any, under the daily cap;
the unvouched squad only logged). Read CLAUDE.md, delta.md and that diff.

Check only: does each D fix do what `.review-fixes.md` says, and does it open a new hole? In particular:
- D1: no move kind left where `by` is heard outside Maia's moves; the server's share draw reaches both devices the same way; the
  0.25 cap and the "no verdict: the host's" path; a liar's best gain over a 30-move raid, stated plainly.
- D2: whole requests on extra turns: a checker's extras never replace the host's; its added time can't stall the boss.
- D3/D4/D6: as `.review-fixes.md` says, no new stall or double strike; the Squads referee is never of the answering party.
- D5: the `eloDrawScale` table matches reports/elo-draw.md, and the boss's strength at each Elo stays near UCI's.
- a6ddc0c: nothing else still withholds a lone party's coins, crates or XP; the texts and protocol agree.
Write `delta2.md` on the same orphan branch (add the file, push): findings ranked blocker / major / minor with file:line and a
failing case, or "no new findings". Run the server and chess tests and the boss kit. About 30 minutes.
