# Flaky batch 6 (Nov 10): four tests that passed only on their retry on main

Method as #590/#597/#600/#604: cause from the retry's trace (the run's `e2e-report-shard-N` artifacts), fixed where it
lives (the app if a player would feel it, else the spec); never a longer timeout, retry, skip or looser number. Prove each
with `--repeat-each 10` (`--workers 1` for specs that share one lobby).

1. `squads-replay.spec.ts:230` [phone], a `toBe` (main 1c48620, run 42776446535, shard 10 or 11).
2. `global-chat.spec.ts:241` [desktop], the page closed (a timeout?) (same run).
3. `boss-challenge.spec.ts:155` [phone], "challenging Alfil in the town ...", a `toEqual` (main 539ce42, run 42780608062, shard 3).
4. `desktop-board.spec.ts:260` [desktop], "a computer: crowd's board by the window's height ...", a `toBe`
   (main 6e3caeb, run 42782183428, shard 10). Batch 5 (#604, not merged yet: waiting on Eric) fixed :300 in the same file;
   read its branch claude/flaky-nov10c so you don't collide, and don't edit the two guard checks #604 changed.

Any guard test in docs/rules/eric.md you'd have to change: stop and say so in .pr-body.md (Eric OKs those first).

Lane: targeted. Effort high. Decision note docs/decisions/2026-11-10-flaky-batch-6.md (≤ 120 words). Push to
claude/flaky-nov10d at each real step; when done write .pr-body.md (each test: cause, fix, proof) and push. Don't open the
PR. Read CLAUDE.md and notes/briefs/rules-common.md first.
