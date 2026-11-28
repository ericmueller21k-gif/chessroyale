# The 1 v 1 "Timer" line shows by the app's clock (Nov 28)

Main went red (flaky) on 13320d59: `ranked-1v1.spec.ts` "…both ranks move" never saw "Timer: Blitz 3+2". The cause is real:
the line came only from the server's message at the vote's close (an alarm). An alarm late by 1.5 s (a busy runner, a busy
server) ticks the room from the vote straight to play, and the line is never sent, so a player could miss it too.
The call: the app closes the vote by its own clock, as it already opens it, showing the line from the picks
(`votedControl`); the server's overlay or play takes over when it arrives. Proven by dropping the server's overlay message
on one page: the old app fails the test's line-202 check, the new one passes. One edge: a test-switch clock (`clock=`) game's
line shows the normal control for the moment before the server's word.
