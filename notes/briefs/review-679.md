# Quick review (boss lane): PR #679, the Hidden Boss's cutscene wired into the fight, read-only, ~25 min

Effort high. Read CLAUDE.md. `git diff origin/main...origin/claude/recluse-cutscene` (main now has #677, the online phase 2) and the PR
(ericmueller21k-gif/chessroyale#679). Look for: the scene's timing solo and online (starts at the fall's end / the server's
`recluseCutscene`; `holdMs` = the timeline's length; the phase change after it unchanged, so the music's cut still lands); a reload during
the scene (`NetPhase2.cutAt`, from #677's review round) shows the scene from the right point or skips cleanly; nothing can be tapped or
moved during it (no board moves, no leave that breaks it; leaving during the scene for a board player = resign, per #677); the test
switches (`?cutscene=`, `CUTSCENE_HOLD_MS`) unreachable in production; `Voice.hush` and the hidden figure restored after; the kneel pose;
the absorb line's paging; the name nowhere; anything that changes another boss. Run `npx vitest run packages/app packages/server
packages/core` and typecheck. Write `review.md` on orphan branch `review/679`: blocker / major / minor with file:line and a failing case,
or "no findings"; push and stop.
