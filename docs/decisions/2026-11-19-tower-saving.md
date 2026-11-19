# Battle Tower PR 9: saving (Nov 19, 2026)

The design's section 5, built: server `tower.ts` ([battle-tower.md](../areas/battle-tower.md), "Saving"). The calls:

1. Routes sit with the account routes (`api.ts` → `towerResponse`): the guest cookie; `index.ts` already rate-limits.
2. The best is the highest floor won (99: the top), worked out again from the runs after every result and before old runs go.
3. An ended run stays until the next new run of its kind: few rows, a plain privacy line.
4. A start with a floor under way answers that floor (same id and start): a retry or a reload's rejoin, never a fresh floor.
5. A win sooner than `BATTLE_TOWER.soloWinMinSeconds` (10) is refused, the floor still under way; waived with TEST_SWITCHES.
6. A mid-floor stop needs the floor's id; no `moves` counts as a loss. Nothing under way: a clean "between".
7. PAUSE_SOLO refuses a new run or floor, never one under way.
8. Merge: of two open runs the higher floor stays, the account's on a tie.
9. The download leaves out the seed and the deck (the floors to come).
10. PR 12 must clear the account from others' party `members` on merge and delete.
