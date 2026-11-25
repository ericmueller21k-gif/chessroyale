# A 1 v 1 spec's failure keeps both games; meet() waits on a lasting state (Nov 20, 2026)

**The flake.** Main's full run on 38e913d: `ranked-1v1.spec.ts:241` failed once and passed on its retry. White tapped e2e4 just
after play began, and Black's page never heard it: "Bo Draw's first move: 20 s" counted down to 10 s. I couldn't find the cause.
About 330 local runs didn't show it: idle, under CPU load, beside `town.spec.ts` as on the CI shard, and with both pages
CPU-throttled 6× and 20×. A server log of every message, send, alarm and storage write showed nothing wrong, and cutting the dev
proxy's links to the Worker mid-game only made both pages reconnect and carry on. The code reads sound on all three sides (the
server, White's taps and `NetDuel.move`, Black applying a `move`). CI records a trace only on the retry, so nothing was left of
White's page or of the sockets.

**Diagnostics, so the next one tells us (the director, Nov 20).** Eric's rule is to fix the cause, not add a checker
(2026-11-13-fix-the-cause.md). This is how we get the cause: it checks nothing and fails nothing. On a failure,
`ranked-1v1.spec.ts` attaches each player's `window.duel.snapshot()` and the app's breadcrumbs (`problems.ts` `breadcrumbs()`, on
`window.__crumbs` with `?debug`, next to `window.duel`) to the report. "1v1 move e2e4" in White's crumbs, with the move missing
from Black's snapshot, says the move was sent and lost on the way. No crumb says White's taps never made a move.

**meet() waited on two short moments.** It waited for the versus moment's pawn (on screen 2.5 s) and then the vote (5 s). Under
heavy local load a test process slowed for longer missed them, and the wait timed out on a game that was fine (3 of the runs
above). Now `meet()` (and the wait after Play again) polls `window.duel.snapshot()` until each page's game is in the vote, overlay or
play and not over, a state that lasts until the result. The vote's own test waits for the vote itself. The versus moment keeps its
own test ("the stage").
