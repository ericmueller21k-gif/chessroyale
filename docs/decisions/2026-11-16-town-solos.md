# The town's piano solos: sometimes early, always within 3 minutes (Nov 16, 2026)

Eric: "the piano solos are not firing in the town … change it so it fires the solos sometimes in the first minute 30 or sometimes later,
not every time early maybe like 33% of the time, but it should always play a solo before 5 minutes or so of looping". Cause: 3 passes
before the first solo (8:56), counted again each time the music restarts. Now (`TOWN_MUSIC`, music.ts `townEntry`): each start rolls;
a third of the time the theme starts partway in on a bar line (bar 77 or 61, a 1 s fade-in), the first solo at 0:37 or 1:07; otherwise
from its top, the solo after 1 pass (2:59). Then 1 or 2 passes between solos, at random. Calls made: an early solo stuck waiting for
another solo to be let go now looks again every second (it had no timer left); `?townsolo` uses the usual test-switch gate (admins and
test servers), the way Eric's phone can hear it.
