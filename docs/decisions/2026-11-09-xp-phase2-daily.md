# XP phase 2: the daily reward (Nov 9, 2026)

Eric (Nov 9): "go with phase two"; the approved design's section 2: "play one game today (at least 15 of your moves): +200 XP and 1 crate".

- **The day's first counted game with 15 of your own moves** pays it (`XP.dailyMinMoves`), not the day's first game: a 12-move game
  earns its XP and leaves the daily reward for the next. One ledger op a day (`daily:<XP day's start>:<ledger id>`, reason `daily`), in
  the same batch as the game's XP, so two rooms at once pay it once; its legs name the paying game, so that game's result (and a replay
  of its grant) answers it and no other.
- **Solo games also need 3 minutes of the server's own time** (`XP.dailySoloMinMinutes`): their moves are the device's word, and a
  game of 15 real moves takes that long. Without it a script could claim a crate a day with one start and one result a second apart.
- **Its XP is a part of the box** ("Daily reward +200"), so the bar's fill includes it; its crate shows in the rewards toast
  ("Daily reward: +1 Winter Crate"). The XP day is phase 1's (08:00 UTC).
- **The crate is the newest series's** (`XP.rewardCrate`: Winter today), as the design says.
