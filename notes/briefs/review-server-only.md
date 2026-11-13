# Independent review: the Hidden Boss never plays a weak move (branch claude/recluse-server-only), read-only, ~30-40 min

Effort xhigh, full lane (server, the online match, stored results, fair play). Read CLAUDE.md, then
`git diff origin/main...origin/claude/recluse-server-only` and its PR body (`notes/briefs/` has none; read the PR on GitHub or
`git log` messages). Look for: his moves ever coming from a device; the pause (every clock and bot thinking time shifted by exactly the
pause; nothing flags or times out during it; a move made during a pause refused; a reconnect during a pause sees it); the 60 s no result
(nothing written for XP/rank/results/tokens/crates; fair play of phase 1 kept, phase 2 dropped; watchers in a Crowd final); retries
(backoff, a lost search, the budget counted once per position, his own day row `<day>:recluse` vs the day's budget); `withMates`
(correct mate-in-one marking, cost); the "no engine server set up" path reachable in production?; protocol fields optional for other
lobbies. Run `npx vitest run packages/server packages/core packages/app` and typecheck. Write `review.md` on orphan branch
`review/server-only`: blocker / major / minor with file:line and a failing case, or "no findings"; push and stop.
