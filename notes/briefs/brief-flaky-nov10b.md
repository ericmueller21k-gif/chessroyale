# Flaky batch 4 (Nov 10): two more caught by main's gate

Method as #590/#597 (docs/decisions/2026-11-09-flaky-batch-sweep.md, 2026-11-10-flaky-batch-3.md): the cause from the
retry's trace (artifact `e2e-report-shard-N` of run 42760919996, main 7bfd6e5), fixed where it lives. Never a longer
timeout, a retry, a skip or a looser number. Prove with `--repeat-each 10 --workers 2` on its project.

1. `town-leave.spec.ts:87` [phone] (shard 4): after Stay (or Escape) the 'Leave Chess Town?' alertdialog was still there
   (toHaveCount 0 failed: 1, 5 s; in `expectStayed`, ~:48). Does the dialog miss the tap/Escape under load (an app bug a
   player would hit too), or does the test act before the dialog takes input?
2. `dash.spec.ts:241` [phone] (shard 10), "Scramble Rush: 4 of 6 put back (taps and a drag)": `.rush-edge.right` 3, not 4.
   #590 moved DashRush's pointer handlers to refs; a put-back is still lost here. **Treat this as a likely app bug** (a
   player's put-back lost): find which put-back (tap or drag) and why; check the tap path (`sel` / `selNow`) as well.

Lane: targeted. Effort high. Decision note docs/decisions/2026-11-10-flaky-batch-4.md (≤ 120 words); area pages if app code
changes. Push to claude/flaky-nov10b at each real step; when done write .pr-body.md (table: test / cause / fix / proof;
changed checks) and push. Don't open the PR. Read CLAUDE.md and notes/briefs/rules-common.md first. Another helper works on
phone load (App.tsx, Home.tsx, index.html): stay out of those unless the cause is there.
