# The scoreboard's fire check read the rows before they settled (Nov 26)

Director's brief: fix the flake in `e2e/crowd-scoring.spec.ts` ("360px, scoreboard: a name's room with and without the fire") at its cause.
Cause: the phone's scoreboard picks how many rows fit through a ResizeObserver, a frame or so after `setViewportSize`. The test read the
rows straight after the resize, so it sometimes got the previous width's rows: at 360 px, 3 rows with the fire and 2 without (a probe saw
3 right after a resize to 320 px, then 4). Fix: `checkTower` reads the rows with the shared `settled` helper. The checks keep their meaning; no app change.
