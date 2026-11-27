# Quick review (boss lane): the Stranger's storm redrawn, PR on branch `claude/stranger-storm-art`. Opus, medium, read-only, ~30 min

Read `notes/briefs/rules-common.md` first. Review `git diff origin/main...origin/claude/stranger-storm-art` (art and wiring only: no rule,
timing or protocol change is claimed). Look for: the sheets loaded only for his battle and released after (memory: ~12 MB decoded);
`StormRing`/`StormRift` drawing only when needed (no per-frame allocation, no canvas resize per frame); the rift under the pieces and under
the last-move highlight, fire's marked tiles and check (they must read); the ring/dim never blocking taps (pointer-events); solo and online
the same; reduced motion; the storm ending cleanly mid-scene (resign, reconnect, the battle ending); the e2e check would fail without the
change. Write `REVIEW.md` (blockers, should-fix, nits with file:line and a failing case; Checked; Not reached) on branch
`claude/stranger-storm-art-review` from the PR head, push, `.done`. Don't fix code, open PRs or comment on GitHub. No re-review loop.
