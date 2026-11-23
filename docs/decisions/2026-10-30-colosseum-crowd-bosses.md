# The Colosseum's crowd: each boss once, beside its sidekick (Oct 30, 2026)

**Eric (Oct 30, on the live Colosseum):** "I want the boss and their sidekicks next to each other in the crowd in the first 3
rows, the bosses' sprites are expected to be a little bigger … I do see some of them but they are small, and Sawyer appears in
multiple spots at once; when I change views he's in a new spot every time."

**What changed:** `buildCrowd` no longer scatters random bosses (about 1.2% of seats, so repeats) and sidekicks. Each of the 14
bosses with a sidekick sits once, its sidekick beside it, in rows 1 to 3, at fixed seats (`bossSeats` in arena.ts); pawns
fill the rest. The crowd's cells are made in BOTS' order (they were in loading order, so a cell could change from load to load).

**Calls made:** a boss is 1.4 m tall (was 1.15). Seats are rejected when the figure, at its full jump, would cover the board
from any of the ten views, checked by projecting both from each eye; the rest are picked nearest to 14 evenly spread angles,
rows taking turns, at least 9° apart. The crowd is built once, so the frame loop is unchanged and there was no frame-rate pass.
