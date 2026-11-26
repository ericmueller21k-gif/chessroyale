# The split bar's check waited on the last floor's match (Nov 26)

Director's brief: fix the flake in `e2e/battle-tower.spec.ts` ("the split bar as an accordion", desktop) at its cause. Main's run on
227ad6a: `boardBox()` read null at line 808. Cause: `window.match` (App.tsx's debug hook) is set when a match starts and never cleared,
so after leaving floor 1 it still held that match, phase "play". `floorThenMatch` waited on that phase, so floor 4's checks could begin
during its intro, and the intro's screen swapped for the play screen (a new board) mid-measure. Fix: `floorThenMatch` waits for a match in
play whose bosses are the floor's. The checks keep their meaning; no app change. Nov 22's null (8027a71) was likely the same cause.
