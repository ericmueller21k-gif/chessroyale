# The live window's e2e watches its own match (Nov 18, 2026)

- **What failed:** `live-window.spec.ts:114` passed only on its retry on main (run 44396356591, shard 13): the line read "A match
  is starting" and "The match is on" by turns for 90 s. One match's ply never goes back to 0, so the window was changing matches.
- **Cause:** the window features the matchmade match with the most people, then the newest, across the whole server. On CI the
  specs share one server, and `lobby-chat.spec.ts:144` (a queue match with two people) was running beside it and took the window.
  Reproduced locally beside that spec: the old test failed 2 of 3; the new one passed 3 of 3.
- **Not the cause:** the votes being dropped. A Crowd match keeps its votes from the reveal through the next round (sampled in
  `liveSummary` over a whole bot-filled match); after a boss's move a raid shows none, as `LiveMatchBoard` says.
- **Fix:** a test switch, `/api/live?watch=CODE` (TEST_SWITCHES only), puts that lobby's match alone in the window; the spec asks
  for its own and waits for its first reveal before looking for the votes (120 s for the match's pace, then 15 s for the window).
