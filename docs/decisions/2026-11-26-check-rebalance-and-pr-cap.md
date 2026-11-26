# `check`: the PR-body warning at 40 lines; the chess halves stay as they were (Nov 26, 2026)

Eric, Nov 26: "you can move the GitHub test server thing" and "You have my go ahead on everything else" (the bloat sweep's Q1 and Q3,
`notes/pipeline-audit-2026-11-26.md` on `claude/director-notes`).
- The PR-body warning fires over 40 lines (was 60): the cap the helpers' brief already set. Still a warning, not a failure.
- The chess halves are unchanged. Measured on #985: the typecheck on half 2 left half 1 at 400 s of tests (no gain); moving
  several-bosses too made half 2 87 + 420 s. Two single files (boss-kit-side about 280 s, several-bosses about 200 s) set each
  half's floor, so moving whole files can't even them. The saving is in those files (the sweep's H5: retire the layer twins;
  sample boss-kit-side's pairs on PRs).
