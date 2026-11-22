# Solo abandon (PR #881): the second delta re-review's fixes (Nov 22). Opus, xhigh. Full lane. Work ON branch `claude/solo-abandon`.
Read `rereview2-881.md` on branch `review/solo-abandon-delta2` whole first. Fix in the same PR (push to `claude/solo-abandon`; never
force-push). The director's calls:
- **I1 (important): a Solo raid's last move with a strike due.** Take the PR-lane fix (no rule change: the shared runner's strike rules
  stay as they are): `endOnHide` plays a complete-but-unresolved boss stage out (clear the timer, `skipReveal()` in its reveal, then
  `nextRound()` if still not decided) so `finishBossBattle` notes the result before the page goes. A test shaped like the reviewer's
  probe. Then look once for the same shape anywhere else: any phase where the game is complete but `decided` is still null.
- **The Classic cut ("Seen in passing"), same cause:** a player whose own place is fixed (Classic's cut) should count as decided for
  their own result, so a close on "You're out / See how it ends" keeps that place, not a left loss. Crowd is different (the team can
  still win): leave Crowd as is. A test.
- **N2:** before a new game's result takes the kept slot, send any other game's kept result first (the reviewer's one-liner). A test.
- **N1:** `BankTime` keeps its place (an empty span of its width) when you're out, so the top bar doesn't shift (Eric's "nothing
  shifts"). A unit or e2e check that the bar's boxes don't move.
- **N3:** no change; one line in the decision note (a second tab during an end moment can cost that game's XP, never its result).
Then CI green on your last push, update `.pr-body.md` (title line 1; add these and the changed checks), push `.done`. Don't open a PR.
