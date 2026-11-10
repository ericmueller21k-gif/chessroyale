# Delta review 2: PR #601's fix round 2 (read-only)

`delta.md` on orphan branch `review/fable-b1` found a blocker (a claimed device class picks the second judge). Round 2 is
`git diff 05ed5b2 origin/claude/fable-b1` (commits 68c5bb6, 4d7c8e1), explained in `.review-fixes.md` "Round 2". Read
CLAUDE.md, delta.md, and that diff. Check only:
- is the blocker closed: rerun delta.md's table (its proof test `zz-delta-b1.test.ts` on the orphan branch) against the new
  code, plus any lobby shape you think is worse (small lobbies of 4-10, two classes of similar size, all one class);
- does the median cap break honest play (a lobby with a few real fast computers among phones: who judges, round speed);
- the `kind` argument on refills, replacements and referees: can it stall a round (no judge found) or pick from one owner.
Add `delta2.md` to orphan branch `review/fable-b1` (fetch, add, push): blocker / major / minor with file:line and a failing
case, or "no new findings". Run the server tests. About 30 minutes.
