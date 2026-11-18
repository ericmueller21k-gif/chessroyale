# The clock pauses and watchers; the round never locks over "Nahh, jk bro" (Nov 17, 2026)

From the review of #770 (findings 4 and 5), the director's brief `dash-watchers-pause`.
- **Finding 5, fixed:** a round done during Dash's fake move (its last pick landing in the hold, the last person it waits for
  dropping, leaving or kicked, a party's King call) locks as the hold ends: `lock()` itself waits for `stall.fake.until`, so every
  path that locks early is covered in one place. The deadline is always later (moved back by the hold). Solo can't end a move in the
  hold (it refuses moves then), so it needs nothing.
- **Finding 4, no code (my call):** nobody can watch Dash's stall or the King's strike from outside the round. Both come only in a
  boss battle, which starts only in a raid or the Crowd's boss final; there `deal()` puts everyone left in the round, and a player
  out watches the live board only with `spectatorsWatch()` (the 50 v 50 rework, not a raid), whose matches never reach a final
  (`isFinal()` is false with `crowdCuts`), so never a boss. Players out of a raid get `spectate` (no clock). Sending the pauses to
  an empty list would add protocol and tests for a case that can't happen ("simple beats flashy"). A comment at both sends says what
  to do if a boss ever meets a watching team: send them the moved deadline (the round's `stall`/`strike` messages already carry it).
