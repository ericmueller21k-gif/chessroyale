# Fix main's red: panel.spec:282, the phone's 50 v 50 scoreboard rows (Nov 26). Opus high, targeted, branch `claude/flake-panel-282`

Main's run on 5dd1f196 (run 45683760374, shard 14) went red (FLAKY_RED): `[phone] e2e/panel.spec.ts:282` "a phone's 50 v 50 box
(Nov 1): at 390 × 750 the scoreboard starts under the reveal's one line, with four rows or more" got `rows: 3` (expected ≥ 4), then
passed on retry. The same test failed the same way on #949's stale full run (8a4ae8d9, Nov 25). Measured at failure:
result line t 551 b 575 (24 px); scoreboard box t 579 b 744 (165 px); `under_mt: -2px`.
Suspect: crowd-poll-skeleton round 2 (merged Nov 25: the phone's standing box 151 px, six rows from 760 px tall, five from 700, else four;
`useBarSlots` reads `--slots`). At 390×750, five rows: is the scoreboard's 165 px sometimes 3 rows and sometimes 4 (row height, a
header, a late font or the box measured mid-change)? Find which, from evidence.

Do:
1. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/areas/crowd.md`, the test, `MiniTower` and the slot thresholds. Reproduce with
   `--repeat-each=20 --project phone` under the shared e2e lock; log what differs between a 3-row and a 4-row run.
2. Fix the cause. If the layout really gives 3 rows at 390×750 sometimes, the layout is wrong (Eric's floor: four rows there): fix the
   threshold or the sizes so it is always ≥ 4 and nothing shifts. If the test reads too early, wait on the real settled state (never a
   fixed sleep). Never loosen the ≥ 4, skip or retry.
3. Show it: the failure reproduced before, `--repeat-each=20` passing after; `crowd*.spec.ts` and `panel.spec.ts` on phone pass; typecheck.
4. `.pr-body.md` (cause, fix, evidence, checks changed old → new), a five-line decision note. COMMIT and push `.pr-body.md` and an empty
   `.done`, then stop. Don't open a PR.
Note: branch `claude/crowd-frame` (the 50 v 50 COMPUTER layout) is in flight; stay in the phone's CSS and say if you must touch shared files.
Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By). American English.
Wait with one foreground `timeout 590 bash -c 'until ...; do sleep 30; done'`, never Monitor. Big output to files.
