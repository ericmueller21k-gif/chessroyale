# The Nov 9 bloat sweep's quick wins (director)

From the pipeline audit (director-notes, notes/pipeline-audit-2026-11-09.md):
- F7: the typecheck moved from `check`'s unit job (the longer one) to its chess job: about a minute off every `check`.
- F2(b): a red e2e run with no failed test (GitHub dropped the shards, runs 1157 and 1159) now says so in the run's summary:
  "No test failed … re-run once". F2(a), capping PR runs at 8 shards, not done: GitHub Pro (Nov 9) raised the limit to 40 jobs.
- F8: Boingo's colors (`FUN_PALETTE`) have their own module, so the town's claw cabinet no longer pulls the whole Funhouse drawing
  (boingo-art.ts) into the town's chunk; it's its own chunk again (11 kB), as ShopRoom's dynamic import meant.
Queued as helper PRs: F1+F6 (a flaky batch and the long fixed waits), F3 (trace every core module), F4 (desktop flows to
phone-only, split the two biggest specs). F5's word cap goes in the notes' rules. F9, F10: Eric's.
