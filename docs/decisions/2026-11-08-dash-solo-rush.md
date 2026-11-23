# Dash's Scramble Rush: solo counts only you; the extra move always matches the verdict (Nov 8, 2026)

Eric (Nov 8 playtest): failed the put-back, Dash said so, but no second Dash move showed. "There should be no average when I'm
playing in solo mode … a different rule set for that."

- **Solo:** only your own put-back decides (`finishRush(places, only)`): no bots, no mean. Online the crowd's mean stays.
- **Cause found:** the verdict (`extra: "due"`) and the move were decided apart. Hollow's rules could skip the move afterward:
  no quiet move within his 3-point cap, the crowd in check (the turn can't pass), or solo's engine call failing
  (`.catch` → skip). The dock and his line still said "He moves again". With the solo raid's bots in the mean, your fail could
  also be outvoted.
- **Call:** once due, Dash never skips it: within the cap if he can, else the quiet move closest to it; no engine answer, a
  seeded quiet one (`rushStandIn`). The Rush waits, still warned, while the crowd is in check. No quiet move at all is
  `"skipped"` in the verdict itself, and the dock says so.
- The move list numbers rows from their FEN, so his extra move reads "14…" after "13…" (it read "14." by ply parity).
