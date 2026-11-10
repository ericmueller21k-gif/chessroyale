# Flaky batch 7 (Nov 10): tests that passed only on their retry on main

Method as #590/#597/#600/#604/#608: cause from the retry's trace (the run's `e2e-report-shard-N` artifacts), fixed where it lives
(the app if a player would feel it, else the spec); never a longer timeout, retry, skip or looser number. Prove each with
`--repeat-each 10` (`--workers 1` for specs that share one lobby).
1. `tiger.spec.ts:305` [phone], Babur's balloon frame list (run 42792103353).
2. `recluse.spec.ts:824` [phone], `toHaveCount` (run 42800137294).
3. `search-home.spec.ts:61` [phone], `toEqual` (runs 42817948595 and 42845262025: twice; new from #607).
4. `squads-watch.spec.ts:167` [phone], `toBeVisible` (run 42847929954).
5. `home-layout.spec.ts:207` [desktop], `toContainText` (run 42847929954; touches #607's queue changes).
6. `matchmaking.spec.ts:22` [desktop], `toBeLessThan` (run 42847929954; same).
7. `squads-replay.spec.ts:237` [desktop], "Cannot read properties of undefined (reading 'from')" (run 42849806128): its `move()` helper
   finds no quiet move when only captures are legal: fall back to a legal non-promotion move. (Eric OKed edits to this test today.)
Any other guard test in docs/rules/eric.md you'd have to change: stop and say so in .pr-body.md. Two other helpers are working on home
(Boss Battle wording; quest pop-up): keep to the specs and the smallest app fixes. Lane: targeted. Effort high. Decision note
docs/decisions/2026-11-10-flaky-batch-7.md (≤ 120 words). Push to claude/flaky-nov10e at each step; when done write .pr-body.md and
push. Don't open the PR. Read CLAUDE.md and notes/briefs/rules-common.md first.
