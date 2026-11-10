# Delta review: PR #611's fix round (claude/fable-b3, e6976a3..a5dcf2e)

Independent, read-only. Read: CLAUDE.md, `review.md` (this branch), `git diff a64a605 a5dcf2e`, `.review-fixes.md` and the PR body
(both at f1fa9d8). The branch head 08e5f52 has the same code as a5dcf2e (it only drops the PR files). Line numbers are at 08e5f52.

**Proof tests** (in `proof/` on this branch; copy into `packages/server/test/` and run `npx vitest run <file>` from the repo root).
Each passes by showing the failure it names:
- `delta-review-fable-b3.test.ts`: D1, D2, D3 (built on the PR's own `review-fable-b3.test.ts` harness).
- `delta-review-fable-b3-squads.test.ts`: D4.

**Runs:** server unit suite 1083/1083 (the PR's 1075 plus my 8); chess unit suite, with the boss kit (`boss-kit.test.ts`) and
`boss-brain.test.ts`: 1154 passed, 2 skipped (boss kit 22/22, boss-brain 34/34); my proofs 9/9.

## Verdict

Most fixes do what `.review-fixes.md` says: M1's re-asks, M2's misses and second device, m2, m3, m4, m5, M4's per-squad unpaid and m7
all hold, with no double strike, no stall and no re-ask loop that I could find. But B1's part 1 opens a bigger hole than the one it
closes: the server believes any device's `by: "maia"`, on any move, and plays that device's move against the other's "fallback"
unless the gap is 0.8. From an even position no move is 0.8 worse than another (a queen for nothing is about 0.48), so a liar's move
plays, unstruck. On the Stockfish brain (strength 2800 and up), on the King's strike and on every bridge-band share move it works every
move, from either seat; on the Maia brain it works whenever the honest device fell back. One such move loses the battle. That re-opens
finding 2 wider than before the fix round (then the better of the two moves always played). I'd fix D1 before merging; D2 should go
in the same PR, since it silently drops boss powers.

## Blocker

### D1. A liar's `by: "maia"` gets its move played, unstruck, short of 0.8 a move
- **Where.** `lobby.ts:1432` (`msg.by === "maia"` taken on any checked move, whatever the request carried), `:1948-1949`
  (`maiaOf`: the device claiming Maia against one that didn't plays unless it's `thrown`), `:1947` with `settings.ts:2209`
  (`throwLoss: 0.8`), and `:1920` (`bossDefault`: with no engine server the Maia claim wins too).
- **Why 0.8 almost never fires.** `expected` is the boss's chances, 0 to 1. A move can only be 0.8 worse than another if the boss stood
  at 0.8 or better. From 0.5 the worst possible move is 0.5 worse; a queen for nothing is about 0.48. So "a throw never plays" holds
  only for throws from won positions; everything else a liar sends is treated as an honest Maia move. Maia's own honest moves give away
  10.8 points a move on average (reports/maia-boss.md, maia-raw at 1500), 21% over 25 points, worst 0.757 (from a won position).
- **Failing cases** (proofs "D1 (B1)"):
  1. *The Stockfish brain* (BOSS_BRAIN.stockfishFrom, 2800, and up: the strongest raids; `bossBrainNow()` is null, so no request carries
     a brain and no honest app sends `by`). The checker answers with any move short of 0.8 and `by: "maia"`. Its move plays, every move
     (5 of 5 in the proof), no strike, the raid vouched. The same from the host's seat (the honest checker's move is dropped). The same
     holds for the King's strike (`stagger`), `best` and the funhouse on any brain, since `by` is honored whatever the kind.
  2. *The bridge band's share moves* (strength 2500-2800, `stockfishShare` from 0 to 1): both honest devices draw the same share with the
     seed and play Stockfish, so neither says Maia. A liar saying Maia wins every share move, from either seat.
  3. *The Maia brain, the honest host fell back*: its Maia not loaded yet (move 1 of a raid, as the PR's e2e saw), failed beside Stockfish
     on a phone (the Oct 14 iPhone case: every move), past 1.5 s on a phone, or the guard vetoed every Maia candidate (maia-light/strict).
     The checker lies with `by: "maia"`: its move plays every such move (proof: 5 of 5), unstruck.
  4. *No engine server* (down, cold past 14 s, budget spent, ENGINE_OFF): `bossDefault` plays the Maia claim, so a lying *checker* now
     controls the move unvouched. Before the fix round only the host's move could play there.
- **And `maiaReady` is the server taking the app's word** (`lobby.ts:1447-1450`). A device that says it without loading anything becomes a
  checker for Maia moves; where honest phones can't (no Maia saved: most phones), it's the only one, so it's drawn every move (proof "D1
  (E1)": host, two phones, the liar phone: the liar checks every Maia move). With case 3 on a phone host, one liar turns a raid that would
  have been unvouched (paying as solo) into a vouched one whose boss it throws, ranked if 15+ people.
- **Over a 30-move raid.** One played lie from an even position (a queen, ~0.48) loses the battle; after that every move is "close" (the
  boss is lost, every move scores near 0), so nothing is ever 0.8 apart and the liar plays on unstruck. Next to Maia's honest losses
  (about 0.11 a move, one in five over 0.25), that's not comparable: case 1 and 2 give a liar the whole battle, case 3 every move the
  honest device fell back. The PR body's "A device lying by less than a throw is never struck (its move never plays; a search a move)" is
  not true: its move plays whenever it claims Maia and the other device didn't. (Its other cost stands: a liar that loses the comparison
  is never struck either, so it can make the engine server search every boss move for free.)
- **Fix** (least code first):
  1. Take `by` only where Maia could have played: `c.maia` (the request carried a Maia brain, kind `elo`/`stumble`), and not on a share
     move. Simplest for the share: the server draws it (its own rng, as it draws the seed) and sends `share: true` (no brain) to both, so
     `c.maia` is false for it. That closes cases 1 and 2.
  2. For Maia against a fallback, cap the Maia move's gap at a Maia-sized number, not a throw: e.g. play it if it's within 0.25 of the
     fallback's (four honest Maia moves in five), else the better one, with no strike either way. A liar's gain is then at most 0.25, and
     only on moves where the honest device really fell back. Keep `throwLoss` for strikes.
  3. With no verdict (`bossDefault`), play the host's as before the fix round, unvouched.
  4. Optionally: count a device's "Maia against a fallback" wins per battle; one that keeps winning them against a `maiaReady` device is
     suspicious (an honest Maia device rarely falls back once loaded).

## Major

### D2. When the checker's move plays, his powers' extras are lost for that turn (M2's bare request)
- **Where.** `lobby.ts:1998`, `:2001`, `:2030` (`bare`: no beam, balloon, hoops, Crease, drag or showdown in the checker's request), then
  whichever answer plays brings its own extras: `:1952` (`bossServerScored`: `c.answers[pick].extras`), `:1878` (same move: the
  fuller extras, which is right), `:1902-1903` (one answer alone).
- **Failing cases** (proofs "D2 (M2)"). (1) Maia's against a fallback, the checker's Maia move plays (D1's honest case 3, the very case
  B1's fix is for): `applyBossMove` gets no drag, showdown, beam, balloon, hoops or Crease. Before the fix round the checker had the
  whole request, so its extras came with its move. With a phone host whose Maia fails, that's every move: Wrangler never drags or fires
  his showdown (`pig.ts:1191`: `checkLineup(…, undefined)` is null, so no showdown that turn), the tiger's balloon and hoops, Moo's lines
  and Folio's Crease never land. (2) The host is silent and the checker's answer stands (alone or with the second device's, which is
  bare too): no extras either. The extras can't be borrowed from the host's answer: they're worked out on the position after the host's
  own move.
- **Fix.** When the move that plays isn't the host's and the turn has extras (the host's request asked for any), ask the host for them on
  that move: the full request again with `allowed: [move]` and the same seed (its engine plays that move and works out the rest). Or, least
  code: send the checker the whole request on the turns that have extras (they're a few a battle), and keep the bare one otherwise.

## Minor

- **D3. A new host asked late in the window is counted as missing it.** `reaskBoss` (`lobby.ts:1802-1818`) moves the timer only when an
  answer is in (`:1817`). With none in, the new host keeps the old host's deadline; at `bossTimeout` every device asked gets a miss
  (`:2333`), the new one included (proof "D3 (M1)": the host drops a second before its window ends; the new host had the request for one
  second and gets a miss). Two such misses are a strike (BOSS_CHECK.missStrikes). The dropped host is counted too, which is fair enough,
  but a phone that reloads twice mid-move is then on its way to the bench. Fix: on a host change with no answer in, restart the window
  (`bossTimeoutMs(...)` from now), or count no miss for a device asked less than `waitMs` ago.
- **D4. Squads' late dispute with no engine server: the lie stands, nobody is struck, both squads are paid** (proof "D4 (M3)"). `lateTop`
  returns at `squads-lobby.ts:2396`. The PR body says so ("logged, no blame"), but M3's failing case is then fully open whenever the server
  is down or ENGINE_OFF: the fast party's lie plays, the slower party's device was up so nothing is unvouched. The in-time path already asks
  a referee device when there's no server (`settle`, `pickDevices(lm, 1, …)`); the late path could do the same.
- **D5 (m1). `eloDraw` doesn't keep the strength above about 2000, by the PR body's own numbers** (`runner-tools.ts:548`, 561-571). Mean loss
  a move, seeded vs UCI_LimitStrength, both guarded, 40 positions: 1600 1.28 vs 1.33 (same); 2200 1.24 vs 1.01 (+23%); 2800 1.04 vs 0.74
  (+40%). Seeded 2800 gives away about what UCI 2200 did, so "a little weaker up top" undersells it: the strongest raids (the Stockfish
  brain, every move) and the bridge band's share moves get easier by something like the gap between those levels. The temperature is
  `lossForRating(elo)` (12.0 points at 1320, 5.4 at 2200, 3.1 at 2800, 2.2 at 3190), which falls more slowly than UCI's guarded losses do.
  40 positions is a small sample (per-move losses are heavy-tailed), so the trend is the point, not the exact numbers. Fix: measure on about
  200 positions at 1600, 2200, 2500 and 2800, then scale T per Elo (one factor, or a short table in settings) until the seeded mean is
  within about 10% of UCI's. This is a calibration matter, not fairness: both devices still agree.
- **D6 (E1). A phone checker for the King's strike downloads Maia.** The request carries the brain for `stagger` (`lobby.ts:2027`), where
  `c.maia` is false, so any seeded phone may check it, and the app's `hostBoss` calls `useBrain(brain)` without `check` (`net.ts:908`), which
  loads Maia whatever's saved: 40 MB, maybe on mobile data, against E1's "no phone downloads it for this". Fix: leave the brain out of
  a bare request when `!c.maia` (the strike's move doesn't use Maia or the share draw), or don't load in `hostBoss` for a check.
- **D7. A move that waits on its host's Maia at move 1 unvouches the whole match.** Only the host prefetches Maia (`net.ts`, `maiaAhead`);
  loaders are told at the intro and computers download 40 MB then. If no loader's Maia is ready by the boss's first Maia move, it has no
  checker, the match is unvouched for good (`unvouch` is sticky) and pays as solo, though checkers are ready from move 2. Likely on a
  device's first raid on a slow line. Not a fairness hole; just worth knowing, or prefetch on the loaders as the lobby fills (computers
  only) so they're ready in time.

## Checked, fine

- **M1.** Answers are kept by device; one device never counts twice (`bossAnswer` takes one answer per id in `asked`). The review's case
  (host answers, drops, the checker becomes host and throws) now compares both and the server picks the honest move, vouched. A checker that
  becomes host before the host answered gets a fresh checker with the same seed. `reaskBoss` adds a fresh checker only while fewer than two
  devices answered or can, so repeated reconnects can't keep adding devices; it never re-asks a device that answered. A junk answer removes
  its device from `asked` (it can't answer again unless it's the host and is re-asked, which only a liar would answer with junk again).
- **M2.** The bare request decides the same move: the move is worked out before any extra (`pigTurn` plays `ordinary()` first; beam,
  hoops, balloon and Crease are after the move), and the pull, landing guard, race, brain, seed and `allowed` stay. Misses count once a
  move per device (`c.missed`); `missStrikes` misses make one strike; the checker that missed is replaced next move; one more device is
  asked once (`second`), then the move stands alone. Every path has a timer (the checker's 4 s from the host's answer, the second device's
  4 s, the server's 14 s, the host's full window), so nothing stalls.
- **E1 / no device ready.** With no checker the move has no seed and the first answer plays at once, unvouched (a5dcf2e); one more loader is
  told each Maia move while the pool lasts. Smooth. A `maiaSaved` lie only gets the phone told to load (the honest app checks again
  locally); its harm is the `maiaReady` lie's, above.
- **M3 with a server.** A late answer that disagrees goes to the server; the device further from its verdict is struck; agreeing, nothing.
  A slow server is fine (nothing waits on `~late`); a failed one answers null and nothing happens. An honest late phone isn't struck unless
  it's further from the verdict than the first answer. The grace is `max(400 ms, 0.5 × the first's time)`, bounded by `answerMs` for the
  first answer, so a job settles within about 6 s.
- **M4 per squad.** `noteAlone` unvouches only the squads in that match whose seats are in the answering party, and only when no other
  party's device is up; a twin's lone answer counts for its followers; a one-party lobby marks its squads at the bracket. The review's case
  (the other party gone, the remaining party's final against bots) still pays nothing, now with true words ("nobody outside your party
  checked the bots' moves"); that's the design Eric should know about (review.md M4).
- **m7.** The refusal is stored on the record (`squads-do.ts:213`), and `resendTo` sends the placement with `rewardFor`, so a reconnect after
  the write is told "daily"; a write after the reconnect sends it live (`rewardCapped`). Persisted whenever the lobby is still the live one.
- **m2, m3, m4, m5.** Unseeded apps never check and an unseeded host plays alone (unvouched); the checker is drawn with `jrng` among
  eligible devices, never the host's account, never in a party's battle; an unvouched match writes no fair-play rows; the results line
  replaces the unranked line.

## Runs

- Server unit suite: 1083/1083 (with my 8 proofs; 1075 without, as the PR body says).
- Chess unit suite: 1154 passed, 2 skipped (real Stockfish); `boss-kit.test.ts` 22/22, `boss-brain.test.ts` 34/34 (with the PR's new m1 test).
- Proofs: `delta-review-fable-b3.test.ts` 8/8, `delta-review-fable-b3-squads.test.ts` 1/1.
- I didn't run e2e (`boss-smoke` ran on the PR's CI and locally for the author).
