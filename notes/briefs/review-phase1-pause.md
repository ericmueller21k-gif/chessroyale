# Independent review: the Hidden Boss's phase 1 server move (branch claude/recluse-phase1-pause), read-only, ~30 min

Effort xhigh, full lane. Read CLAUDE.md, then `git diff origin/main...origin/claude/recluse-phase1-pause` and its PR body (on GitHub, the
newest PR from that branch). Look for: his phase 1 move never random in his fights (every path: no host, a silent host, a reload, a host
change, a late device answer after the server was asked); `bossMoveFromScores` truly matching a device's seeded pick at each strength
(the child's rising Maia stand-in, the man's level); the BOSS_CHECK flow for OTHER bosses unchanged; no-result in phase 1 (scope: those
in the battle; watchers' results; XP, rank, fair play, results rows); retries and budget (his row, never refused, counted once); the
#683 minors (D1 count off the search's path under waitUntil; the digest's yesterday/today; the doc). Run `npx vitest run packages/server
packages/core packages/app packages/chess` and typecheck. Write `review.md` on orphan branch `review/phase1-pause`: blocker / major /
minor with file:line and a failing case, or "no findings"; push and stop.
