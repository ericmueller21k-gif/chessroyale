# The 1 v 1 vote's "Timer" line, read from the page (Nov 26)

Flake on PR #976: `ranked-1v1.spec.ts` "…both ranks move" waited from the test process for "Timer: Blitz 3+2", which shows
for `RANKED_1V1.overlayMs` (1.5 s) starting a second after both picks. A runner that stalled the test process that long
missed the line (the page went on to play, Blitz, fine) and the wait timed out. Now Ann's page records when her pawn's
release lands and when the line first shows; the test waits for play, then checks the line showed and came within the
same bound as before (`voteBothPickedMs + 4 s` after the release). Same meaning, timed where it happens. No app change.
