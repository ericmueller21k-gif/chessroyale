# The Nov 19 bloat sweep's quick wins

Eric's twice-weekly sweep (notes/pipeline-audit-2026-11-19.md on claude/director-notes) found the first load had grown back:
#775's static `DashTap` import in App.tsx pulled every boss's kit into the entry chunk (1,290 kB after the Nov 16 split, 2,214 kB
today). `DashTap` now comes from the match chunk (`game-screens.ts`, `game.screen("DashTap", null)`), like every match piece:
the entry is 1,341 kB / 476 kB gzip again. And the PR-body warning's hint now says "detail goes on the area page", not "in the
decision note", which had steered text into decision notes.
