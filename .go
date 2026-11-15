chandy redo: round 2c (Eric, Nov 16, on Dodge's round). Everything else in 2b stands.

ERIC'S WORDS (condensed): the gators should stand at the EDGES of the board (on the board still, on its outer squares, further back
from the king, not next to the 3x3). They do an AFTERIMAGE-style TELEPORT: in round 1, one of them teleports mid-round and changes
where it stands (so its line moves); in round 2, two of them; in the final round, three ("so you have to be very quick on the last
one"). And the blast covers the WHOLE row or column across the board: a big pop.

WHAT TO DESIGN AND MOCK UP
- The clones on the board's edge squares: a row-shooter on the a- or h-file at that rank, a column-shooter on rank 1 or 8 at that
  file (they stand on top of the board, never off it). Say how they fit on a phone without covering the king's 9 squares.
- The teleport: the clone blinks out leaving a red-green afterimage that fades, and reappears on another edge square aiming at a new
  line. After every teleport the aim is still exactly 2 rows + 2 columns missing exactly one safe square, so the safe square changes.
  Pick the timing so it stays fair inside 3 s (or recommend a longer window for rounds 2 and 3 if 3 s isn't enough to react to the
  last teleport: e.g. the last teleport no later than ~1.2 s before the close). Votes made before a teleport stay where they were
  tapped; players re-tap to change.
- The fire: each beam a big pop across the whole rank or file, edge to edge (the full 8 squares), then the hit or the dodge.
- Mock up: a still of the clones on the edges; a GIF of round 3 (three teleports, the vote counts moving, the full-length blasts);
  a still of the blast. About 4 images. Update D2/D3 in DESIGN.md with the numbers.
Then .mockup "chandy round 2c" and wait for a .go containing "chandy" (the next one should be "chandy build").
