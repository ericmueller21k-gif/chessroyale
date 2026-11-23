# Flaky batch 6 (Nov 10, 2026)

Main runs 42776446535, 42780608062, 42782183428; method as #590.
**global-chat:241**: the three right-column tests pressed 1 v 1's PLAY at once and met each other; each now queues in a pool of its own, and the duel queue keeps `?pool=` as App's does.
**boss-challenge:155**: the server lost the battle's start ("Network connection lost") and the app dropped it: no chat line, no token. The start is now asked again, as the finish was.
**desktop-board:260**: knocked out at a stage's end; #604's fix covers it.
**squads-replay:230**: the board you'd play next finished first. The fix changes an Eric guard test, so it waits for his OK (the PR body).
