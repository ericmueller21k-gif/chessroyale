# Flaky batch 3 (Nov 10): the tests main's new gate catches

Since #594 a test that passes only on its retry turns main's e2e run red ("No flaky test on main"). Fix each at its cause,
by #590's method (docs/decisions/2026-11-09-flaky-batch-sweep.md): find the cause from the CI trace/log (the shard's
`e2e-report-shard-N` artifact has the retry's trace), fix it where it lives (the app, or a test racing the app). Never a
longer timeout, a retry, a skip, or a looser number. Prove each with `--repeat-each 10` at `--workers 2` on its project
(tests that share one lobby or queue: `--workers 1`).

The two so far (main run 42739404441, a706681, shard 13):
1. `colosseum.spec.ts:42` [phone]: `canvas.town-canvas` not found within 5 s after `page.goto("/town")` (the shard's first
   test: cold start?). What is the page doing in those 5 s; what should the test wait on?
2. `sawyer.spec.ts:113` [phone]: "the split came" (expect toBeTruthy). Sawyer's split timing.
Also check main's runs after a706681 (Actions → e2e on main) for any new flaky test while you work, and add it.

Lane: targeted. Effort high. Decision note docs/decisions/2026-11-10-flaky-batch-3.md (≤ 120 words). Area pages if app code
changes. Push to claude/flaky-nov10 at each real step; when done write .pr-body.md (short: table test / cause / fix / proof;
changed checks) and push. Don't open the PR. Read CLAUDE.md and notes/briefs/rules-common.md (branch claude/director-notes) first.
