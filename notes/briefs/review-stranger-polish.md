# Quick review (boss lane): the Stranger's polish, branch `claude/stranger-polish`. Opus, medium, read-only, ~30 min

Read `notes/briefs/rules-common.md` first. Review `git diff origin/main...origin/claude/stranger-polish` against `notes/briefs/stranger-polish.md`.
Look for: the knock-back drawn only (the position and the move list never change; a move during the scene impossible or harmless); the shade
never blocking taps and always lifted (the battle ending mid-storm, resign, a reconnect); the scene's retiming (STORM_SCENE, POWER_BANNERS)
matching on the server and solo (no rule timing moved: say if any did); the entrance only on his tower floors, skippable like the others, never
stalling a floor's start; the unlock notice once per unlock (reloads); `Town.tsx`, `Results.tsx`, `boss-timing.ts` edits not changing other
bosses or screens; memory (the sheets kept through his battle, let go after; #1028's town release not undone). Write `REVIEW.md` (blockers,
should-fix, nits with file:line and a failing case; Checked; Not reached) on branch `claude/stranger-polish-review` from the PR head, push,
`.done`. Don't fix code, open PRs or comment on GitHub. No re-review loop.
