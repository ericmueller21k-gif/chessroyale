# Review 2: claude/tower-easy-floors (head 528321af), fair play, the fix round (3a035044, 22eb1ba9)

**1. Should-fix: the throw-strike skip and its online test cover a path no tower floor reaches.** Every online floor is a party
room (`squads-do.ts:818`, `partyLobby`). A party gets no boss checker (`lobby.ts:2210`), so `checkBoss` gives it seed 0 and
`settleBoss` plays the host's answer alone, unvouched (`lobby.ts:2328`). `bossServerScored` never runs on a floor, before or after
this PR, so no strike is lost and a host gains nothing new. But the decision note (line 11) and `engine.md:154` read as if a looser
floor's moves were checked, just without a strike. The new test builds a non-party `raid()` room with tower settings
(`boss-check.test.ts:347`), a room production never makes, so "host and checker agree" holds only there. Suggest: say in the note
and the engine page that online floors are the host's move alone, unvouched (as any party's battle). Then either drop the skip or keep
it as a guard for later. If it stays, narrow it: it also drops the strike when neither answer is Maia's (two seeded Stockfish
fallbacks, or Boingo's funhouse move), which the floor's draw doesn't touch. Gate it on `a.by || b.by`.

**2. Should-fix: a real gift now passes (`boss-brain.ts:36-43`, `matesAfterTake`).** It checks only the other side's *cheapest*
capture. `6k1/5ppp/3n4/8/r7/8/2Q2PPP/4R1K1 w - - 0 1`, `c2c4`: Nxc4 allows Re8#, but Rxc4 wins the queen with no mate (checked
with chess.js). `giftedMaterial` returns 0 here (9 before the fix), so a floor plays the gift. Fix: skip only when *every* legal
capture on `to` leaves a mate in one. Fairness is unharmed (both devices compute it alike); it only weakens the boss, rarely.
Otherwise sound: `c.moves()` lists legal moves only, and "#" is chess.js's mate mark ("+" a check): no mix-up.

**3. Nit: test 1's `expect(b).toBe(a)` is true by construction.** Both calls get the same request and the same mock, and the test
builds the brain itself (`{ ...r.brain!, seed, engine }`), not through `net.ts:1116`. What it really shows: the two requests match
(brain with `draw`, fen, seed), and `bossMoveFrom` asks Maia at the floor's temperature. That is the claim worth having. `net.ts:1116`
does pass `brain.draw` on (checked by reading).

Checked and fine. `drawLooser` reads only `this.r.bossBrain.draw`, set by `bossBrainNow` from the server's own plan
(`runner.bossBrainPlan`, `settings.towerFloor` from the server-made run: `tower.ts:801`). No device message sets it: `bossMove`
carries move, by and extras only (`lobby.ts:1822`), and `lobbyOptions` has no `towerFloor`, so no request can switch strikes off
elsewhere. Even where the skip applies, the better move still plays (gap ≥ 0.8 > `maiaGap`). Unchanged: floor 10 and up (`floorDraw`
there is BOSS_BRAIN's own; `carelessDraw`'s last row is 10), Stockfish floors (no brain: `drawLooser(undefined)` false), raids,
Boss alone, the Hidden Boss (no `towerFloor`), and the junk-move and missed-window strikes. The first review's blocker is fixed:
`bossRequest.brain.draw` now reaches the host. Ran the `boss-check`, `tower` and `boss-brain` tests: 69 passed.
