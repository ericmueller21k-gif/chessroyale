# Battle Tower PR 9: saving (Nov 19, 2026)

The design's section 5, built: server `tower.ts` ([battle-tower.md](../areas/battle-tower.md), "Saving"). The calls:

1. Routes sit with the account routes (`api.ts` → `towerResponse`): the guest cookie; `index.ts` already rate-limits.
2. The best is the highest floor won (99: the top), worked out again from the runs after every result and before old runs go.
3. An ended run stays until the next new run of its kind, which deletes an open run it replaces (after the best counts it): few rows, a plain privacy line.
4. A start with a floor under way answers that floor (same id and start): a retry or a reload's rejoin, never a fresh floor.
5. A win sooner than `BATTLE_TOWER.soloWinMinSeconds` (10) is refused, the floor still under way; waived with TEST_SWITCHES.
6. A mid-floor stop needs the floor's id; no `moves` counts as a loss. Nothing under way: a clean "between".
7. PAUSE_SOLO refuses a new run or floor, never one under way.
8. Merge: of two open runs the higher floor stays, the account's on a tie; the other is set aside (`abandoned`, the merge's alone).
9. The download leaves out the seed and the deck (the floors to come).
10. PR 12 must clear the account from others' party `members` on merge and delete.

Review fixes (the independent review, Nov 19):

11. A floor whose bosses no longer pass the pool (a kill switch since it began) is left free at any move: our pause, not your
    leave. Its `under` answer says `resting`.
12. The last result taken is kept (`tower_runs.last`): sent again, the same answer. Any other result for a floor not under way is a
    409 with `run` and `best`: PR 10 reads it as "read the run again", never an error.
13. A run whose deal doesn't parse answers 409 `confirm` (start a new run). The best is at most `BATTLE_TOWER.floors`, only ever raised.
14. A solo best is the device's word, so it stays off any leaderboard and out of anything that pays; solo emblems are marked "solo"
    (the design). Left: the best's `at` on its repair path and a merge copying the guest's best (both heal themselves).
