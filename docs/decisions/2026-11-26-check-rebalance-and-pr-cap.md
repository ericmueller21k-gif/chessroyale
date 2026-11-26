# `check`: the typecheck on half 2, the PR-body warning at 40 lines (Nov 26, 2026)

Eric, Nov 26: "you can move the GitHub test server thing" and "You have my go ahead on everything else" (the bloat sweep's Q1 and Q3,
`notes/pipeline-audit-2026-11-26.md` on `claude/director-notes`).
- The typecheck, `edge-layer-twin.test.ts` and `several-bosses.test.ts` move from chess half 1 (421 s median, the long pole) to half 2
  (304 s). Measured on #985 with the typecheck and edge-layer-twin alone: half 1 still 400 s of tests, half 2 53 + 203 s; so
  several-bosses (about 200 s) moved too, aiming at
  halves near even and `check` about a minute quicker.
- The PR-body warning fires over 40 lines (was 60): the cap the helpers' brief already set. Still a warning, not a failure.
