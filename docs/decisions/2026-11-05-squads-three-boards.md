# Squads: Relay on 3 boards, and a cleaner match screen (Nov 5, 2026)

Eric (Nov 5): "each team, there's only 3 [boards] going, meaning that there's always at the start one person on each team
who's just spectating, and then they jump to whichever board becomes available first. That's just where they slot in,
and that becomes their static position … the person who's on the first board would just be simply waiting then for
them … best 2 out of 3."

His screenshots (`notes/briefs/assets/squads-nov5/`): the bottom of the Relay screen cut off under the browser bar, a
grayed finished mini board, the "Jump to my next board" switch and its line under the board. Stills of what's built:
`docs/squads-three-boards/`.

## The rules

- **3 boards, squads of 4** (`SQUADS.boards.relay: 3`). Pairs and the final are unchanged.
- **The ring** (`packages/chess/src/squads/schedule.ts`): a squad's moves are numbered in the order they're played, and
  move k is seat k mod 4's. Within a turn: the squad's White boards (the first half), then its Black ones, each half's
  in an order that runs one board along (side 0: boards 3, 1, 2; side 1: boards 2, 3, 1). So:
  - seats 1-3 start at the boards, seat 4 waits and takes the first board to come free (two free in one half: the
    ring's order decides, so nothing depends on who's quicker);
  - each squad move goes to the next player in the ring; after you move, your next move is one board along;
  - one seat a squad sits out each turn (4, 3, 2, 1, 4...); every place is fixed for the match ("static").
- **Colors** (side 0 White on boards 1 and 3, side 1 on board 2, as before): each player plays each board once every
  three of their moves, so every player of a squad has exactly the squad's split (side 0: 2 White to 1 Black; side 1 the
  reverse) and never three of one color running. That's as fair as 3 boards allow: a squad with two White boards makes
  two thirds of its moves as White.
- **The drain**: a squad moves on two boards in one half and one in the other; the team clock already counts who's
  thinking at once.
- **The result**: best 2 of 3. The match ends as soon as the other squad can't catch up even winning every board left
  (the director's call, Nov 5). Each finished board shares out one point, so this is exactly "more than half the
  points": 1½–½ with one board left can still end level, and plays on.
- **The tie** (the director's call on Eric's "if it was all draws … black gets an extra point for a draw or whatever";
  **Eric's to change**): 1. more boards drawn as Black (as Armageddon gives a draw to Black); 2. more team bank left;
  3. the seeded coin. It applies to rounds 1 and 2; in Pairs the first never decides.
- **Random openings**: boards 1 and 2 share one opening, colors swapped; board 3 has its own (3 boards can't all be
  mirrored). The director: OK.
- **Mercenary's coins**: Relay's `roundScale` ×4/3 (three boards pay what four did at ×1). Eric (Nov 5): "we still need
  to revisit it, don't look at Mercenary at all": no calibration run, nothing else changed there.
- **Stored matches**: a Relay match stored on 4 boards (a lobby in play across the deploy) finishes on 4: `relaySeat`
  keeps the old rotation when a match has as many boards as a squad has players, and its coins stay ×1 (the scale goes
  by the match's own board count). The new tie order applies to it too.

## The screen

- **Mini boards**: 3 a match, side by side, centered. A finished board: a border and a check mark in the winning squad's
  color, not grayed; a drawn board: a neutral border and "½" (the director's call).
- **"Next round"** (test only): a tiny icon hard left. On a phone's Relay, Cheat lines (test only) is a tiny icon beside
  it, its lines the arrows on the board (the director: OK), so it never pushes the screen down.
- **The replay button**: no box, only the drawn ring. A tap steps off (grayed) → the last 2 moves (a moderate spin, a
  short trail) → all moves since you last played there (twice as fast, a longer trail) → off. Off on a device's first
  match; the first button's stored on reads as all, off as off.
- **When replay plays** (Eric, Nov 5, replacing the director's "only the unseen moves"): as your move on a board starts.
  If you were viewing that board when both of its last two moves landed (your teammate's, then the opponent's reply),
  nothing replays: you saw them live. Otherwise the normal replay runs for the setting, never a partial rewind. The
  extra free time is the rule's either way.
- **Quick board jump**: today's "Jump to my next board", the same behavior and stored choice, now an on/off in the gear's
  list and in Settings → Squads (with its line). The switch and "Each turn you make one move, one board along." are gone
  from under the board.
- **Under the board**: only the move arrows and the turn order. Removed: "Back to my board" (a tap on your own tiny board
  does it; the third coach mark says so), the "Your move" box and the rules line.
- **The turn order** (Eric's correction: "one queue for the board you're viewing"): all 8 players in the order they'll
  move on the board on screen, the next there on top; whoever moves drops to the bottom. The ring makes the next 8 moves
  on any board all 8 players once. Your row: "Your turn · play now", or "Waiting for 2 players" (how many move there
  before you). Each row: the squad's color and the move they last played (a tap shows that position). A phone shows 4
  rows, a tap opens all 8 over the board (upward, so nothing below moves); a computer all 8 beside the board. One call:
  with you further down than 4th, a phone's folded box shows the top 3 and your row, so it always says where you
  stand. (Options mocked first: the 6 seated players, or all 8 in two team columns; Eric picked all 8, then asked for
  the one queue.)
- **Nothing cut off at the bottom** with the browser bar: 390 × 664 (iPhone 13), 393 × 659 (iPhone 15), 428 × 746, a
  short Android at 360 × 560 (its tiny boards and rows a little smaller).
- **The coach marks** (in place of the replay tip): three, one at a time, at a player's Relay: "Tap here for
  settings, like Quick board jump.", "Tap to replay moves: the last 2, all of them, or off.", "Tap a board to watch it.
  Tap yours to come back." The rest dims, a ring and a short line point at the thing; a tap anywhere or OK goes on.
  Eric: the last gets "Don't show these again": ticked, never again on that device; not ticked, again next time.
- **The tick**: only while your squad's real bank runs out (its last 5 s, `SQUADS_LOBBY.tickBankSeconds`), never in the
  free seconds. Eric: in the free seconds it "makes you panic".

## The first vote waits 3 s

Eric (Nov 5): players reading the intro messages missed the first vote. It now opens `SQUADS.firstVoteDelaySeconds` (3)
after the full lobby shows; its timer and the bots' votes start with it. The coach marks come at the first Relay, after
every vote, so nothing first-time sits over a vote (the old replay tip over the votes is gone).

## What the sim says

`reports/squads-sim.md` (Classic, 108 lobbies, every option and skill mix), against a 4-board run of the same code
(`SQUADS_SIM_SET='{"boards":{"relay":4,...}}'`): see the PR body and the report for the numbers. Relay on 3 boards
drains the team banks less (one fewer move to think about at a time in one half of every turn), so far fewer squads
reach sudden death and squads carry more bank into Pairs and the final, where they then think longer.
