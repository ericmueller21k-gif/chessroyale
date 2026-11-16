# The park's chess tables come alive

**Date:** Oct 27, 2026. **Who:** Eric asked and approved the look (two rounds of mockups); the director built it.
**Platforms:** both.

## Eric's words (Oct 27)
- "When you sit btw we should put a little ring circle green soft light under the available chair to show the other
  person is looking for a match. When the match is started it should show a little 2d timer in 3d space above the board
  with the time the match has elapsed, the pieces on the board should move but it can be totally random … even tiny
  little pieces that look like pieces … they could also be facing the right way … alternate one color moves one direction,
  one the other. And then maybe every, like, 7 or 8 moves, it just resets the boards back to, like, base … without making
  anything run too slowly."
- Round 2: "you could make the back row look slightly different"; the timer "should actually just be, like, a black timer
  that floats above the board with nothing behind it … a slight 3D effect … directly above, between the two players."
- Approval: "the drawing looks absolutely killer. And the way the pieces move." Two changes: "it doesn't need to say chess
  table … it's not centered anyway", and "when it's full … if you click on the table, when people are actually playing,
  you have an option to spectate their game as well."

## What it is
- **The boards** lie flat on each table, between its stools; the pieces stand on them (the back ranks' shapes from the
  a-file, pawns in front; black's knights face white). Drawn through the camera each frame (`drawBoard`), the table's
  picture keeping only its leg and stools.
- **Who sits decides** (`tableStates`): two people, neither you, play; one, not you, waits (the green ring under the free
  stool); otherwise the pieces stand set up. My call: **you at a table show nothing yet**, neither a game (you'd be
  playing a bot) nor the ring (you aren't searching: Casual and Ranked are greyed). With the tables' matchmaking, you
  searching will show the ring too.
- **A game**: white and black in turn, a piece a step or three forward (a sideways step at most), a capture fading out,
  every `tableMoves` (8) moves back to the start; a move every 1.1 s. Look only: no rules.
- **The clock**: black 3 x 5 pixel digits with a lighter top edge and a grey side a pixel under, no background, floating
  over the middle of the board, counting from when the second player sat.
- **The card**: no "Chess table" title (still the dialog's name for screen readers). At a table where two others play,
  **"Spectate"** greyed with "Coming soon" instead of Casual and Ranked (nothing hidden: shown, not tappable), and you walk
  beside it without sitting. It works once real games are played at the tables (their matchmaking): the app already has a
  spectate screen to reuse.

## Speed
Eric asked that it not slow anything. The boards' script costs about 0.9 ms a frame for all ten; what costs more is
drawing them, in a browser without a graphics card. So each board's slab, squares and pieces become one cached picture
while nothing on it moves and the camera holds still (made on the second identical frame, `boardCache`); a moving piece or
camera draws it directly. Headless Chromium, warmed 6 s, medians of 3, at most three tables playing (bots held seated),
under the e2e lock:

| | Phone (390 x 844 @3x), still | walking | Computer (1440 x 900), still | walking |
|---|---|---|---|---|
| main | 54.8 | 52.6 | 38.3 | 42.0 |
| this, before the cache | 46.1 | 52.8 | 33.6 | 43.7 |
| **this, with the cache** | **54.2** | **53.7** | **40.3** | **44.4** |

## Numbers
All in `TOWN_FEEL` (`tableMoveMs` 1100, `tableSlideMs` 350, `tableHop` 0.05, `tableTakeMs` 260, `tableMoves` 8,
`tableResetMs` 1400, `tableRingR` 0.36, `tableRingPulseMs` 420, `tableFarCut` 0.5) and `TABLE_BOARD` in `houses/park.ts`.
