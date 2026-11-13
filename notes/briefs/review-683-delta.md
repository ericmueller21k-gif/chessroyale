# Delta re-review: PR #683 (never a weak move), review round, read-only, ~20-30 min

Effort xhigh. The first review: `git show origin/review/server-only:review.md`. The fix round: commits on
`origin/claude/recluse-server-only` after `f000aa44` up to `30bb86a6` (`git diff f000aa44 30bb86a6 -- packages docs`); then the director
merged main (child form online, cutscene) with test-file conflicts resolved by keeping both sides. Check each major/minor is fixed as the
PR body's "Review round" says (ericmueller21k-gif/chessroyale#683): his queue holds only his searches in a fight (fair play on `fairplay-1`,
bots device-first); no new try while one could still run (`searchMs`, `SERVER_LOST_MS`); never refused for budget, counted once; no
result for board players only, watchers' results stand (XP, rank, fair play) with the right line; m1 pause + bot handover; the alarm's
check. And the merge: the child form online (#684) and the cutscene hold still work with these changes (his child/adult forms untouched;
the cutscene hold before phase 2). Run `npx vitest run packages/server packages/core packages/app` and typecheck. Write `review.md` on orphan
branch `review/683-delta` (findings or "no findings"), push, stop.
