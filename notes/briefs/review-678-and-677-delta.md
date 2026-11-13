# Two short read-only reviews, one after the other

Effort high. Read CLAUDE.md first. Write both results in one `review.md` on orphan branch `review/678-and-677-delta`, push it, stop.

## 1. PR #678: the Hidden Boss's child form (boss lane, quick pass, ~25 min)
`git diff origin/main...origin/claude/recluse-child-form` and its PR body (ericmueller21k-gif/chessroyale#678). Look for: the Maia ramp
(rating per move, the cap, what happens while Maia loads), the form order (the child beaten → a new match with the adult; the child
winning or a draw ends the fight), the 🏆 in the child form, anything that changes another boss or the adult form when the child form is
off (online today), the growing step (plays once; no double play), music switching, lines (never his name), and **whether its changes
could move the match screen's power-up row**: CI's `e2e/crowd-play.spec.ts:187` [desktop] ("power-up row top at 390×844") failed once
and passed on retry on this PR. Run `npx vitest run packages/chess packages/app packages/core` and typecheck.

## 2. PR #677: delta re-review of the fix round (~20 min)
The first review is `git show origin/review/recluse-online-phase2:review.md`. The fix round is the commits after `5eefa1f3` on
`origin/claude/recluse-online-phase2` (`git diff 5eefa1f3 origin/claude/recluse-online-phase2 -- packages`). Check each finding is fixed
as its PR-body "Review round" says, and that the fixes broke nothing: phase 2's unvouch now scoped to phase 2's result (ranked, XP,
fair play of phase 1 untouched), asks re-sent to a new or reloaded host, `ply` refusals, lean broadcasts vs what a reconnect gets.
Run `npx vitest run packages/server packages/core packages/app`.

Findings: blocker / major / minor with file:line and a failing case, or "no findings", per PR.
