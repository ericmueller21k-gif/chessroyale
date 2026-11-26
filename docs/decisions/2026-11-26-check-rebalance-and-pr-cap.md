# `check`: the typecheck on half 2, the PR-body warning at 40 lines (Nov 26, 2026)

Eric, Nov 26: "you can move the GitHub test server thing" and "You have my go ahead on everything else" (the bloat sweep's Q1 and Q3,
`notes/pipeline-audit-2026-11-26.md` on `claude/director-notes`).
- The typecheck and `edge-layer-twin.test.ts` move from chess half 1 (421 s median, the long pole) to half 2 (304 s): about 330 s and
  400 s expected, `check` about a minute quicker.
- The PR-body warning fires over 40 lines (was 60): the cap the helpers' brief already set. Still a warning, not a failure.
