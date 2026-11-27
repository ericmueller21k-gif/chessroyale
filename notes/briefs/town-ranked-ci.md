# #1027 (town Ranked): its new e2e fails on CI. Opus, high. Fix round (then the independent review: review-town-ranked.md)

Read `notes/briefs/rules-common.md` first, then `notes/briefs/town-ranked-tables.md`. PR #1027, branch `claude/town-ranked` (head 4445972).
CI run 46081002051, shard 10, `[phone] e2e/town-ranked.spec.ts:98` ("two players found from two tables ...") failed twice:
- try 1: `walkUpTo` (`:51`): "you walk up to table 3", the poll for being still within a square or two of the table timed out (10 s);
- retry: `locator('.dv-stage, .board-area').first()` never visible (the search or the game never showed).
It passed 4/4 locally (twice). CI's runners are slower (frames 300+ ms apart; LESSONS: short timed windows against CI's frame rate).
Find each cause with the run's trace (artifact `e2e-report-shard-10`; the GitHub MCP `actions_get` `download_workflow_run_artifact`)
or by reproducing with the CPU slowed: a test reading too early (fix the test: wait for the state, not a fixed short window) or a real
app race (two towns' hubs, the seat arriving after the found, a walk that never finishes on a slow frame: fix the app). Then run the
spec several times slowed. Push to `claude/town-ranked`, `.done2` with a 5-line note. Commits end only with your Claude-Session line.
