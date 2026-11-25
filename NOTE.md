# Squads on a computer: the shared frame (Nov 26)

This branch holds stills only (the code is on `claude/squads-frame`).

## mock/ (before building)
Main's live Squads screens at 1536 × 730 (125%, Eric's laptop) with the frame's CSS injected (`mock/mock-squads.spec.ts`):
- `mock-squads-pairs-1536x730.png`: a Pairs match. The standings (team clocks) left, the board, the column right. All three start on the
  board's top line and end on its foot. No title line: the board line ("1 Their move here") is the top strip, centered on the board. The
  score and round sit at the column's top, with the replay button and the gear at its right end, level with it. Under them: the tiny boards
  on the board's top line, then the panel to the board's foot. With nothing to pick it shows the gray "Waiting…", as the 50 v 50's status box.
- `mock-squads-relay-1536x730.png`: a Relay. Its turn order fills the panel to the board's foot. (In this injected mock its board keeps
  the old 250 px room, and the menu keeps its labels: both fixed in the build.)
- `mock-squads-vote-1536x730.png`: the votes. These use the 50 v 50's vote frame (its title is the top row, its line and cards in the
  column). Squads has no chat, so under the cards the column ends in the lobby's votes, listed to the board's foot.
