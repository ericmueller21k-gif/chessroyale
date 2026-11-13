# Independent review: a ban means you can't sign in (branch claude/ban-blocks-sign-in), read-only, ~40 min

Effort xhigh, full lane (sign-in, security, fair play). Read CLAUDE.md, then `git diff origin/main...origin/claude/ban-blocks-sign-in` and
its PR on GitHub (the newest PR from that branch). Look for: any route, WebSocket or page path a banned account (or a marked browser)
still reaches; the gate's cost on hot paths (the live line, the town's polls) and the 30 s cache's staleness; a NON-banned player locked
out (a stale mark, a shared device, a cleared case, the engine pool, guests, an account under review, D1 down); sign-in refusal leaking
whether an address is banned; evasion matching (normalization, Google email) false positives; lifting a ban restoring everything; the
app's fetch wrapper (every call, no loop, offline); cookie flags; the privacy policy text vs what's stored; e2e changes keeping intent;
Eric's rule's guard. Run `npx vitest run packages/server packages/core packages/app` and typecheck. Write `review.md` on orphan branch
`review/bans`: blocker / major / minor with file:line and a failing case, or "no findings"; push and stop.
