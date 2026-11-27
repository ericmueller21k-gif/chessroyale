# Review: claude/stranger-rules (eabda7fb), boss lane quick pass (Nov 27)
Read: the whole diff, its decision note, CLAUDE.md, docs/rules/eric.md. Not run: unit tests, e2e, sims (read-only pass).
## Should-fix
1. **Boss alone with an unlocked Stranger opens an empty menu.** `packages/app/src/screens/Home.tsx:180` (BossMenu's list is `menuBosses()`,
   which has no unlock bosses) with `:777` (`bossAlone` opens it with `only = pick`, which also hides the Random row). Case: win floor 10,
   pick his card, tap Boss alone: the menu has no row, so he can't be played alone. `:97` (prefetchBossAlone) has the same gap, so Maia
   isn't fetched ahead for him. You can reach it now with `?wip=1`; it blocks the art PR. `e2e/stranger.spec.ts:124` only checks that the button is enabled; it should tap it.
2. **The unlock counts floor-10 wins that never met him.** `server/src/tower.ts` towerUnlocks reads `MAX(tower_best.floor) >= 10`. Until his
   kit is set, production's floor 10 still deals two normal bosses (towerPool skips him), so every floor-10 win from this merge until the art
   PR unlocks him, as does every best of 10 or more already stored. Eric's rule is "Beat him in the tower". The decision note only
   covers the case where a life is spent. This is the director's call: record it, or key the unlock to a win against him.
## Nits
3. Test servers only: `server/src/tower.ts:586` passes `testSwitches` (unfinished) to towerPool, but `squads-do.ts:771,810` and
   `lobby-do.ts:878` don't. On a TEST_SWITCHES server a solo run's floor 10 is his and a party run's isn't. The gap closes when his art lands.
4. Tests that can pass without checking anything (item 5 of the brief): `packages/chess/test/stranger.test.ts:123` returns early with no assertion when nothing can move off
   (`if (!off.length) return`). `:118` skips the tile-empty check when the burn spared the piece. Assert that the seeds really reach the cases.
5. `stranger.test.ts:141`: the name says "the frozen turn and the flee turn", but only the frozen turn is checked. `:147`: "again once the last has burnt"
   only checks `next === 4`, and no second strike is checked. `:156`: "no ultimate comes" is checked right after the trigger, not on later turns.
## Checked, none found
- (1) Frostfire timing: the strike comes in `passive` as crowd turn 3 begins, then every 4 turns. Frozen until `turn`, the burn at `turn + 1` (afterCrowdMove,
  `crowdMoves === burnAt`). Both paths use the same runner and the seeded roll. The king is spared. A gap left open next to either king, a promotion handed to him, or no move left for him: spared. Castling rights and en passant
  are fixed by withoutPiece and keptEnPassant. A frozen piece he captured, or a piece promoted onto the tile, burns as "whatever's on it", and the judge (burnLoss) agrees. The crowd always
  has a move (chooseStrike, plus heldBy lifting the freeze). Near the move cap, turnBegun drops a strike that could never burn. No illegal position found.
- (2) Fairness: a lobby pick (`index.ts`, the uid from the session), a party pick (the leader's tower_best, read on the server), matchmade raids (no pick)
  and the tower deal (on the server) all check canPick or deal on the server. Every writer of `bossId` checks it, so chooseBoss's new
  `unlockReady` branch is safe. Solo trusts the device, as it already did by design.
- (3) Scope: no other boss's rules changed. Only `stranger` carries `unlock`. Other floors and decks only change when his id is in the pool. floorDraw
  is untouched (floor 10 already used BOSS_BRAIN's own draw).
- (4) Ult: only the `ultimate: () => false` stub stands in the way, and the admin trigger waits. The ult PR adds `strangerult` to the boss-smoke map.
