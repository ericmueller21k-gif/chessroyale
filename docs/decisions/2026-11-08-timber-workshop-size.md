# Timber's workshop strip: bigger pieces (Nov 8, 2026)

Eric: the workshop pieces and Rivet are tiny; "we have plenty of space in the boss container up here." Make them about a chess piece on the board, as big as fits, on phone and computer; bars, counts and Rivet grow in proportion, and the bar keeps its size and place.
- Phone: 35 px squares (28 px below 341 px wide), three to a row in two rows: about 78% of a board square at 390 px (checked floor 70%).
- Computer: one row of six at 42 px, the bar's height: about 56% of a board square (checked floor 50%).
- Counts sit over a dark chip in each square's top right corner, above the piece (`.ws-meta` z-index 3; the shared `.hb-pieces piece` is z 2). The scrap bump lifts 3 px, not 6, so it stays clear of the status line.
