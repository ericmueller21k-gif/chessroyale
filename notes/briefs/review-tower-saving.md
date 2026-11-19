# Independent review: PR #812 (Battle Tower saving), read-only, ONE round. Opus, xhigh, alone

PR #812 (branch `claude/tower-saving`) adds D1 tables `tower_runs` and `tower_best`, the `/api/tower/*` routes, the sign-in merge,
export and delete. Production's database is live (guests included): a mistake can lose or corrupt a player's data, let a device fake
progress, or keep the site from starting. Read CLAUDE.md, the design `docs/decisions/2026-11-18-battle-tower-design.md` §3 and §5,
the PR body and `docs/decisions/2026-11-19-tower-saving.md`, then the diff (`git diff origin/main...origin/claude/tower-saving`).
Rank only what matters (blocker / major; minors short):
- The schema on a fresh database and the live one (the schema runner, `ensureSchema`; the partial unique index on D1/SQLite).
- Every route: the guest cookie and session, rate limits, the ban gate, PAUSE_SOLO and kill switches; a run's seed never the device's.
- Results: only the started floor, once (the CAS); racing or replayed requests from two tabs or devices; a win too soon; a stale stop;
  free leave vs counted leave; floor 99; the best always the highest floor won; nothing a device can send to skip floors or reset a loss.
- The sign-in merge (both directions, ties, two open runs), export (no seed or deck) and delete (every row, in the one transaction).
- Core's deal state stored in `met`: what if `BATTLE_TOWER`, the pool or the roster changes between saves (PR 8's `startFloor` re-deal).
Don't fix. Write `.review.md` on an orphan branch `review/tower-saving` (findings with file:line, a failing case and the fix; then
"checked, fine"), plus an empty `.done`. Run the server unit tests and any you write (the local D1 via wrangler if useful). About 45
minutes. Push and stop. Commits end with the `Claude-Session:` line only.
