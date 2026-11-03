# The Last Stand waits for the crowd's 6th move (Nov 2, 2026)

Eric, Nov 2: "sometimes it triggers on the first move… it doesn't matter if it's a random position opening like Fischer
Random or a piece gets eaten or whatever… always hard set each side five moves in no matter what before it will even look to
make a save… it can literally be disabled until it detects that you've played five moves and then it can flip on."

- **What changed:** `lastStandFromMove: 5` in settings; `lastStandDue` returns false while `crowdMoves < lastStandFromMove`, so
  every caller (runner solo and online, the sims) gets it. `crowdMoves` there is the crowd's moves already played in the
  battle, so the 1st to 5th moves never see him and the 6th (`crowdMoves` 5) is the first he can save. FAQ says so.
- **Calls made:** it counts the battle's own crowd moves (they start at 0 in every battle, whatever the opening or the game's
  move number); a move the God King plays or Boingo's funhouse plays counts, like any played crowd move. The bar keeps falling
  from move 1 as before (31.1 with charges on move 6), as the brief said "from its 6th move on, as now". `?laststand=1` still
  forces him on any move.
