# The Locker opens slowly (Eric, Nov 27 ~08:00 UTC)

Read `notes/briefs/rules-common.md` first, then CLAUDE.md and `.claude/LESSONS.md`. Branch `claude/locker-speed` from main. Targeted lane.
Opus, effort high (drawing and frame timing).

Eric: "clicking locker from another screen lags for a sec, im assuming its some server thing, which is fine, but just curious why its laggy
to load vs other screens, and if theres a way to make it faster" (his screenshot: the Locker tab on a computer, an admin account).
The director's read: no server call (LockerPanel, `packages/app/src/screens/Crates.tsx`, reads `profile.locker`); an admin's locker has
one of every item (`adminCopies`: all 79 ITEM_DEFS), and the tab draws every cell's `ItemArt` (colors, blotches) plus the big preview
at once: one long task. Players with a few items barely feel it.
1. Measure first (a computer and a phone, `npm run frames:*` or a Playwright trace with a long-task observer): the tab's first paint and
   its longest task, for an admin and for a player with ~10 items. Say what costs what (ItemArt per cell? blotches? the preview?).
2. Fix the cause, simplest first (Eric: "simple beats flashy... less lag"): e.g. cache each item's drawn art by (def, color, blemish, seed)
   so it's drawn once per session; draw the cells in view first and the rest in small chunks after the first paint (nothing shifts:
   each cell keeps its size and place from the start, its art filling in). No change to what's shown.
3. Show the before and after numbers in the PR body. One focused perf check if a cheap one fits an existing `@perf` spec.
`.pr-body.md` at most 40 lines, a 5-line decision note, then `.done`. No stills needed unless the look changes.
