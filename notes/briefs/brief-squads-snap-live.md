# Squads: your turn snaps you to your board, LIVE (Eric, Nov 9, phone playtest)

Eric missed his turn: the turn order said "You · Your turn · play now", the big board was his board (Board 2, Black), but it was
still showing an old position ("Move 5 · 9/11 · back to live"): he had stepped back through the moves and nothing brought him
back. Eric: "The moment it becomes your turn on a board, it should snap you to that board."

Likely cause (director's read): packages/app/src/screens/SquadsMatch.tsx, the `useLayoutEffect` on `[mine?.key, seq, !!duty]`
resets `watch` (the board shown) when a half asks something of you, but the board's history view (`useHistoryView`,
components/HistoryNav.tsx, the `history` passed to `<HistoryNav>` near line 760) keeps its `ply`, so you stay looking back.

Fix: whenever your turn begins (a new half with a duty for you, any format, Relay included), the big board is your board AND
live (`history.live()`), at once. Also check the other ways it can begin (the jump to your next board, a board switch while
browsing, the half ending at once). Don't change anything else (watching others outside your turn stays as it is).

Tests: one focused e2e check in the squads spec that covers turns (step back with « while waiting, then your turn comes: the board
is live, "back to live" gone, your move playable). Unit test if the logic is pulled into a function.

Model plan (Eric, Nov 9: Haiku and Opus in tandem): Haiku fixes (small, clear UI state); then a short read-only Opus review of
the diff only (~15 min), whose findings the director applies or hands back. Lane: targeted (squads screens).
