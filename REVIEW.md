# Review: the Stranger's swords, PR #1002 (boss lane quick pass, Nov 27)

Diff: `origin/main...origin/claude/stranger-swords` at `a04aa159`. Read-only. No blockers.

## Blockers
None.

## Should fix
1. **The block's wait is counted from the wrong moment, so there's up to 3 s of dead air before his hop.**
   `finisherLeadMs` (`packages/chess/src/bosses/stranger.ts:71`) adds `FINISHER_BLOCK_MS` (1800) to the hold *from when the finisher is
   marked* (`strangerBattle.finisher`, `:376`). The app does the same from when the event is first seen (`components/Stranger.tsx:220`,
   `at: at + finisherLeadMs(...)`). But the block itself is the dock's `hurt` beat (`boss-beats.ts:225`), which starts when the crowd's
   move shows, at the *start* of his thinking. The move is marked only after the thinking minimum: solo's `beforeShow` waits for `thinkEnd`
   (`solo.ts:1462`, `bossThinkMs` at least 1200 ms, or QUEEN SLAIN's banner plus 500 when his queen went), and online it waits for the host's
   answer (bot `thinkMs` 600 to 2600) and `thinkMinAt`.
   Failing case (solo, `?power=finisher`): Bxf6 lands at T0. The block plays from T0 to T0+1730 (`animLength(block)`). The event is marked
   at T0+1200 or later, so the hop starts at T0+3000 or later: he stands idle for at least 1.27 s after the block. If you took his queen, the
   whole 1.8 s is added on top of the banner wait. The same thing happens on every device, so sync is fine; it's just waiting that wasn't asked for.
   Simplest fix: put the block into the thinking minimum, the way `burnt ? FIRE_BURN_MS` already is (`boss-timing.ts:304`, and the server's
   `thinkMinAt`): Stranger with `hisLoss >= 3` gives at least `FINISHER_BLOCK_MS`. Then drop `finisherLeadMs` from the hold and from
   `strangerTurnMoments`. The chess test `held === finisher + FINISHER_BLOCK_MS` (`chess/test/stranger.test.ts`) changes with it.
2. **The hop's highest point on a phone isn't covered by the whole-on-screen check.** The e2e (`e2e/stranger.spec.ts`, "his finisher")
   records `.sg-fig` only for the cut on f6/f3. On a phone the worst frame is the arc's peak toward a piece on the top rank:
   stand y = 24.7 (`finisherStand`'s floor), corner y = 6, arc height 14, so the feet reach y ≈ 1.35 and the drawing's top
   (`UP * PX` = 32.7) is about 31.3% of the board's width above the board's top. The highest the e2e proves is the corner at rest (box top
   about 30.2%). That's about 4 px past what's proven on a 370 px board, so probably fine, but Eric's rule calls for proof. The unit test
   (`app/test/stranger.test.ts`, "where he stands") checks only the stand, not the arc. Cheapest fix: a number check that the arc's peak
   (`arc(CORNER, stand, 14, 0.5)`) for every square stays at or below the corner's height. Or lower the arc height so the peak never
   rises above the corner.

## Nits
- **A reload or late join mid-finisher restarts it** from when that device first saw it (`turnSeen`, `Stranger.tsx:211`), and the block
  lead is added again. The server's move then cuts it off partway, and the board just shows the move. This is Chandy's precedent
  (`Chandy.tsx:236`); Birdie fixes it by sending the server's start (`turnAt`). Fine to leave for now.
- **Room for network delay is thin on the frostfire.** By my sums of the frames: flame `homeAt` 3640, ice 3920, cut 3700, frostfire 4160 (the hop
  ends at 4360), against a 4600 ms hold. Online, the client starts at the time it receives the event, so with more than about 240 ms of delay the
  frostfire's landing frames get cut when the move arrives. The unit test's `homeAt + 100 <= ms` margin is thinner than real phone delays.
- **PR body wording.** "Frame rate on a phone slowed 4×" reads like a regression. It means the CPU was throttled 4×. 16.7 ms median, 20 ms p95 and
  39 ms worst are well inside the perf specs' p95 < 50 budget (`e2e/perf.spec.ts`), so the numbers are fine.
- **`hisLoss` doesn't skip a base that goes back** (Folio's Revision), but `bossBeat` does (`boss-beats.ts:221`). On a floor of several, that
  would mean a lead with no block. Edge case only.
- `Boss.tsx:432`: `chandyFen(...)` is computed twice, once inside the `strangerBoard` argument and once in the fallback. Harmless.
- **Already on main, not this PR:** the Stranger's existing Frostfire burn moment plays Grex's `grexPoof`, because `FireBurn`'s `pieceBurn`
  item isn't quiet (`Grex.tsx:128`). `boss-sounds-own.test.ts` reads only the kits' sounds, not the components' board effects, so it doesn't see this.

## Checked
- **The server's hold** (`lobby.ts:2885`) takes exactly Chandy's path: `bossMinAt`, then `bossPlay` replays the pending move through `playBoss`.
  The second `bossMoveMoment` returns 0 because the finisher is marked once a turn. The single timer slot replaces `bossTimeout`. The
  move is final by then (`bossCheck` is cleared first), so a finisher is never marked for a move that gets replaced. Solo's `beforeShow`
  matches it: it shows the snapshot with the event, then waits `ms`, then plays the move.
- **The pick** is `powerRoll(seed, "finisher", turn, square)`, the same on every device; `finisher-<kind>` forces it. A pawn, the king,
  a finished battle and other bosses get no finisher. The events are cleared once his move plays, so it never replays in the crowd's turn.
- **The core change** is only an optional event kind and new test-switch names. Other bosses are untouched: `bossMoveMoment` tries Chandy
  first, and `strangerBattle` returns 0 for any other boss. `POWER_FX` now has `finisher: 4600`, but nothing totals it outside the
  thinking moments.
- **The clock during the hold:** the crowd's banks don't run in his turn, the same as during Chandy's lock.
- **The bar figure** hides while the finisher draws him on the board (`.screen:has(.power-moment .boss-moment)`), and shows during the
  block, because `momentAt` doesn't start the finisher before its `at`. So there's never two of him on screen, and the block is visible.
- **The quiet `pieceBurn` doesn't leak sound either way.** `quiet` is checked per item, the `played` set is filled only when a sound plays,
  and each tag includes its `since` (`BossEffect.tsx:320`, `spriteFrameAt`). The finishers' own sounds come from `strangerSquare`'s cues
  (`strangerBurn`, `strangerFreeze`, `strangerShatter`) and his figure's cues.
- **`gkHyuah` is the only exception**, and it's Eric's. It picks one of `gkShout1..4` at random, and `boss-sounds-own.test.ts` passes it
  because `gk` isn't a boss pack. The two new sounds (`clang`, `shatter`) are his own synthesized ones. The shared code is now
  `BossCharacter`'s `animOf`/`beatShot` and `BeatResult.shot`, and with no `animOf` both fall back to the old lookup exactly.
- **`OVER_BOARD.stranger`** (`/^(hop|fin_\w+)$/`) matches only the hop and the four finishers. The new `SIDE_SWING` and `barShift`
  values match the new swings (I couldn't re-measure them here). `finisherStand` keeps him inside the board side to side (x from 15 to 85,
  his box ±19), and on a computer his corner is inside the board.
- Every finisher's timeline is in order: land, strike, hit, gone, back, home, all before the hold ends. The block's animation (1730 ms) is
  shorter than `FINISHER_BLOCK_MS`. The decision note and the area page are within their size limits.

## Not reached
- I ran no tests here (this container has no `node_modules`). CI (the unit tests, chess, and the full e2e on 15 shards) was still running when I reviewed.
- I didn't open the stills or GIFs, or watch `frames:boss` with real taps. The frame-rate numbers are as the PR reports them.
- A solo game kept across a reload during the hold. Floors with several bosses on them.
