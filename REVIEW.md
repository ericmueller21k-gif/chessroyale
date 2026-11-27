# Review: the Stranger's ultimate, the Storm of Two Worlds (PR #1009, head 8659b23e)

A boss lane quick pass, high effort, one pass, read-only. I read the diff (`origin/main...origin/claude/stranger-ult`), the design
(`notes/briefs/stranger-ult.md`), its tests, and the sim's jsonl. I didn't run the unit tests or the e2e (CI covers them). A runtime probe
on a phone (vite, solo) stopped at "Loading the engine..." in this container, so the phone items below come from reading the code and one
frame of `storm-phone-realtime.gif`.

## Blockers

None found.

## Should-fix

**S1. The storm's ring can widen the page on a phone, so the page scrolls sideways during the storm (Eric: no accidental scrolling).**
`packages/app/src/styles.css:29641` (`.power-board .sg-storm`) draws the canvas 12% of the board past each edge, and nothing clips it.
The only `overflow-x: clip` on the game screen (`styles.css:15847`, `.gm-main:has(.screen.game > .boss-dock)`) is inside
`@media (min-width: 1100px)`, so it applies on a computer only. On a 390 px phone the board is about 366 px wide, so the ring reaches about
44 px past each board edge, roughly 30 px past the screen. Frame 9 s of the GIF shows the particles running off the right edge. An
absolutely placed box that sticks out of the page adds to the document's scroll width unless an ancestor clips it.
- Failing case (likely, but not run): 390x844, `?power=storm`, during any of the 3 storm turns. `document.documentElement.scrollWidth` is
  larger than `innerWidth`, and a sideways swipe off the board pans the page.
- Fix: clip it on a phone too, for example `.gm-main:has(.sg-storm) { overflow-x: clip }` outside the media query. Then add one check to
  `e2e/stranger.spec.ts`'s storm test: `scrollWidth <= innerWidth` on every frame while `.sg-storm` shows. The recorder already runs every
  frame.

**S2. The dock's ice words promise "2 pieces", which is wrong on some ice turns.** The words are `STORM_LINES.ice` "Ice: 2 pieces + king
move." and `STORM_SHORT.ice` "Ice: 2 + king." (`packages/app/src/refused.ts:62-63`). Two cases break the promise:
- The mild pick frees the pieces of the top three moves, up to 3 (`stranger.ts:380`, `slice(0, Math.max(want, tops.length))`; stormCheck
  allows `iceFree + 1`).
- With fewer pieces that can move, the pick frees all of them, which can be 1 (`stranger.ts:374`).
- Failing case: a position where the engine's top three moves use three different pieces and every seeded pair fails the check. The
  player sees "2 pieces" while 3 are free.
- Fix: build the words from `pick.free.length`, or drop the number ("Ice: a few pieces + king.") and keep them whole on a 360 px phone.
  Rules on screen should say exactly what's true.

**S3. The server checks the host's pick against the rules only, never fairness or strength (`stormCheck`, `stranger.ts:447`).** A
modded host, who plays on the crowd's side, can make every storm turn harmless and still pass:
- fire: one mark on an empty far corner;
- ice: its own choice of 3 free pieces;
- `""`: a calm turn.

The second device under BOSS_CHECK only compares the move (`lobby.ts:2358`: the extras are the host's). Folio's Crease has the same trust,
so this isn't a blocker, but two guards would close the easy case:
- fire: at least `min(fireMarks) - 1` marks;
- ice: at least `min(iceFree, movers)` free pieces.

Also flag this for the fairplay lane, since the host softening the boss's ult leaves no signal.

**S4. The shipped meter, 2.5, has no sim run behind it.** `reports/boss-sim/raid-stranger-storm.jsonl` ran at 2.3: both storms in 25 of
40 battles (62.5%), one storm in 14, none in 1. The 15 battles that missed are all 12 to 26 moves long. The first storm came at turns 10
to 14. The note and settings say 2.5 is "by estimate for about 70%", so the share Eric asked for is unmeasured at the shipped value. One
battle (12 moves) saw no storm at all, against Eric's "every boss ults every game" (Nov 26). He isn't in `dangerBosses`
(`settings.ts:1506`). The director's call: accept the estimate, or run once at 2.5.

## Nits

- **N1.** `packages/chess/src/bosses/stranger.ts:21-22`: the header still says his ultimate is "still to come. `strangerult` is a
  placeholder". It should describe the storm, or point to settings.ts.
- **N2.** `e2e/boss-select.spec.ts`: the expected rows now come from `rowSizes` in the code under test, so a bug in `rowSizes` passes its
  own check. The test should keep at least one literal (for example 17 tiles: `[6, 6, 5]` on a phone, `[9, 8]` on a computer). Also a
  player-visible change: the computer's grid goes from Eric's "two rows of eight" (Nov 2) to 9 + 8. No eric.md guard covers it, but the
  PR body should say it.
- **N3.** The fairness check counts one pawn as one log-odds of the expected score (`burnPawnLogit: 1`). That holds near level, but the
  WDL curve is steeper between about +1 and +2, so 0.35 there is about 0.15 of a pawn. The check is then stricter and the crowd gains (more
  mild picks). In decided positions (expected clamped at 0.001 or 0.999) any pick passes. That's harmless; a note for the engine lane.
- **N4.** The scene's nudged pieces: `strangerBoard` empties their squares from `nudgeAt` until `healAt + healMs` (10.5 s), while
  `stormMoment` draws them for the whole moment (0 to 11 s). From 0 to 0.4 s and from 10.5 to 11 s both draw them on the same square. No
  visible harm, but it does work twice.
- **N5.** The burns' moments (`strangerTurnMoments`) start when this device first sees them, as the finisher's do. A reconnect during a
  burn replays it from the start, possibly past the end of his thinking. This pattern was already there; noted only.

## Checked

- **The fairness check.** One engine search per turn (`stormPick`: `topMovesAt(fen, 10, 60_000)`, `engines[0]`). It scores only the moves
  the engine ranked. Best within 0.35 and next within `max(1.25, the position's own 2nd + 0.35)`, both checked against `stormFair`.
  - Ice always frees the piece of the best non-king move, or the king's best. A pick that leaves only one free move fails, so passing
    picks leave at least two good options.
  - Both mild fallbacks are fair by construction: ice frees the top three moves' pieces; fire puts n-1 marks on empty squares where none
    of the top three moves land, castling included.
  - No answer, a throw or no legal move gives a calm turn (`stormCode` returns ""). `afterHisMove` stores a calm pick, and the storm still
    counts.
- **Solo/online parity.** Solo (`runner.ts:1524-1533`) and the host (`net.ts` hostBoss) both call `stormAnswer` on
  `applyMove(fen, move)`, and both feed `applyBossMove`'s `storm`, so `afterHisMove`'s `stormCheck` runs on the same position. The lobby
  takes it from the host only (length-capped at 48) and gives the host `stormTimeMs` more. An older app gets a calm turn.
- **The guards.**
  - King never frozen, and at least one legal move left (stormCheck, plus heldBy lifting a no-move hold).
  - Never his pieces or a king marked (stormCheck, and `everyTurn` filters the marks again).
  - At most one of yours above a pawn.
  - Burns run in order through `frostfireOutcome`'s guards (`burnAll`).
  - No marks or burn at the move cap (`turnBegun`, `stormBurn`).
  - Frostfire held from the warning until 2 turns after (`stormHolds`), and the storm never asked while a strike runs.
  - SF2's `handed` guard is pinned.
- **The ult's life.** The warning, then the storm on the next turn whose pick his move made (`land`). The admin's `ultNext` is kept until
  his turn. `ultimateRunning` keeps the meter empty during the storm and after his 2nd storm (with `ultimateMax`). `wearOff` drops stale
  picks. The view shows only this turn's pick. The 2nd storm's first kind comes from the seed with `ults`.
- **Power turns.** No fair-play signal and no Last Stand on storm turns (`powerTurn`). The judge weighs fire marks through
  `burnSquares`/`burnJudged`, and ice moves through the layer.
- **Timing.** `STRANGER_FX.storm` = 11000 sits in `POWER_FX` (shared by solo and the server), with a banner lead before it. The e2e checks
  10.5 to 13.5 s on screen, and his figure whole every frame (`rec.outside` is empty). `OVER_BOARD` adds the `storm*` anims, so
  boss-side's guard still checks the window.
- **Going live.**
  - `BOSS_ADMIN_FIRST` drops him.
  - Tower floors 10, 30 and 50 deal him to everyone; a party regrouping keeps him; his pause re-deals (SF1, written for the live rule).
  - A raid's or a party's `?boss=` needs the unlock.
  - boss-smoke gives him the smoke (the `powersOf` skip is gone, `unlockReady` was added).
  - Unlock note trimmed.
- **The phone's frame budget, by reading.** The ring is one 168 px canvas of about 2,150 `fillRect`s a frame on the shared frame loop,
  drawn from the clock alone. The cracks are one small SVG. The aura's filter steps twice every 0.36 s. That's cheap. I didn't measure it
  (the PR's `PERF=1` numbers stand).

## Not reached

- Runtime on a phone: S1's overflow and the frame rate (my probe stopped at the engine loading in this container).
- Reconnect or late join mid-scene at runtime. By reading, the scene, the ring and the board's hidden squares are all drawn from the
  moment's clock. Turn-start moments come through the generic path.
- Several bosses on one side: if another boss's power changes the board between his move and the crowd's turn, the pick is stale. The
  rules still hold (heldBy, the guards) but fairness isn't checked again.
- The unit tests and e2e on real Stockfish (CI).
