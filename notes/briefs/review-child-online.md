# Independent review: the Hidden Boss's child form ONLINE (branch claude/recluse-child-online), read-only, ~30 min

Effort xhigh, full lane (server, the online match). Read CLAUDE.md. The online wiring only:
`git diff origin/claude/recluse-child-form...origin/claude/recluse-child-online` (the child form itself, #678, was reviewed already;
#677's online phase 2 is on main). Its PR body: `git show origin/claude/recluse-child-online:.pr-body.md`.
Look for: the child beaten online (mate or the 🏆) → his fall → a new match against the man for everyone at once (no double start, no
lost seat, a reload mid-fall); the 🏆 spent and refused at the right moments; the child's rating per move request (host and checker
agree; a lying host); fair play and XP for the child's match (counted once, the right form); the Crowd final's settings (the child now
first online: does anything in the Crowd's results change?); `?form=adult` unreachable in production (test switch); NetMatch's reset
between forms; the guard edit to `e2e/hidden-boss-room.spec.ts` keeps every room check. Run `npx vitest run packages/server packages/core
packages/app` and typecheck. Write `review.md` on orphan branch `review/child-online`: blocker / major / minor with file:line and a
failing case, or "no findings"; push and stop.
