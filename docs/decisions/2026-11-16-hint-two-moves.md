# Power-up hints: fewer than 3 when the position has fewer moves (Nov 16, 2026)

- **Seen:** `e2e/multiplayer.spec.ts:58` read 2 hints instead of 3 (main, Nov 11, 12 and 16; retries passed).
- **Cause:** not the engine. Classic deals Black's boards one ply past the opening length (9 plies), and the library holds
  one start there in check with two replies: the Caro-Kann's 5.Nxf6+ (exf6, gxf6). The search lists both, so the
  power-up shows 2. About 1 match in 21 deals that board and the guest sits at it about 1 time in 8: roughly 1 run in 170.
- **Ruled out:** the top-8 search came back full on all 2,421 opening starts (250k nodes, the app's options), and the
  same after other searches on the same engine (searchmoves, MultiPV 2-3, other budgets: 486 positions, identical);
  no consumer of the cached search changes its array; no boss limit applies in Classic.
- **Fix:** the spec expects `min(3, legal moves)` hints. Not changed: the library still deals the few starts in check
  (1-2 replies at 9, 12, 13, 14 and 17 plies). Whether a board should start that way is the director's call.
