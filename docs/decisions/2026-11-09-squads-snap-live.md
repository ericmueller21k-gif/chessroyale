# Squads: your turn snaps the big board live (Nov 9, 2026)

Eric, on a phone (Relay): "The moment it becomes your turn on a board, it should snap you to that board." He had stepped back
with « while waiting, so his board showed an old position ("Move 5 · 9/11 · back to live") while the turn order said
"Your turn · play now", and he missed his turn.

Cause: the screen reset the watched board when a half asked something of you, but the board's history (`useHistoryView`)
lives in `MatchView`, keyed by match and board, so a turn on the same board kept the old ply.

Fix: when your turn on a board begins (a new half with a move for you there, every format), that board goes live. Board
switches and "Jump to my next board" already remount the board and start live. Looking back outside your turn is unchanged.
Lane: targeted. Check added: one e2e test in `e2e/squads-three-boards.spec.ts`; no unit test (no logic pulled out).
