# The Battle Tower: audit 1, the rules core (Nov 19, 2026)

The auditor's report after PR 6 ([the brief](../areas/battle-tower-audit.md)). Read-only: nothing in the build was changed. Every
finding was proved with a throwaway script (the kit's own `runBattle` and invariants, driven from files that were never committed);
each proof names the battle and seed so it can be played again.

## 1. Summary

- **Audited:** `main` at `ccab83c`: the board layer (#802), today's bosses on it (#803, #804, #806, #807) and several bosses in the
  match runner (#808, with the Nov 19 `apart` pairs). No open Battle Tower PR was named.
- **Verdict:** the rules core holds. Over 765 seeded battles (one boss, every pair twice, 120 threes; 40 to 60 crowd moves; every kit
  invariant, Stockfish as referee) nothing went wrong that the several-bosses code caused: no wrong result, no illegal move, nobody
  left without a move, the marks combine as designed, a restored runner and the online path agree with solo. Two real rule
  problems came out of it (one is an old one-boss bug the deeper run met), one lag problem, and one false alarm in the kit itself.
- **Do first:** finding 1 (an en passant square the engine drops after Babur's balloon or Timber's drop). It is in today's Boss
  Battles against Babur (and Timber, admins first), not only in the tower, and its least fix is one line.

## 2. Findings, most severe first

To play a kit battle named below again (the throwaway scripts were not kept): `runBattle({ boss: bosses[0], bosses, seed, side: "w",
test: "", triggerFrom: 2, strikes: [4, 11, 19], maxMoves, opening: KIT_OPENING }, sf)` from `packages/chess/test/boss-kit-lib.ts`,
inside `quickSearches()`, as `boss-kit-side.test.ts` does; its `failures` are the kit's own words quoted here.

### 1. High: a balloon or a drop on the square a pawn just double-stepped from leaves an en passant move the engine doesn't have (§3.1)

- **Where:** `packages/chess/src/bosses/tiger.ts:371` (`placed`) and `:387` (`landCheck`), which Timber's drops use too
  (`timber.ts:139`, `dropSquare`); the same rule written again in `timber.ts:154` (`tidyEnPassant`, also Don Dough's `riseCheck`,
  `zebra.ts:183`). One boss or several: it is not the tower's code.
- **What happens:** Babur (or Timber) plays a pawn's double step, and at the end of the same turn his balloon (his finished piece)
  lands on the square that pawn came from. Both helpers keep the en passant square "while a capture there is still legal" by
  chess.js. Stockfish also wants the square behind it empty, so it drops the square: the crowd is offered a capture the judge
  and the boss's engine don't have. This is #275's S2 again (docs/decisions/2026-10-18-boss-test-kit.md), fixed then in Alfil's
  `editedFen` (`alfil.ts:82`, which checks "it and the square behind it"), but the rule lives in two more copies that don't.
  Timber sets his pieces down on his two back ranks first, so his drops go looking for exactly that square.
- **Proof:** the kit's battle `clown + tiger`, seed 56479, crowd White, no test switch, trigger from turn 2, strikes 4, 11, 19, 40
  moves, fails invariants 1 and 2 after `f7f5` ("an en passant square Stockfish drops (f6)"; base at ply 48,
  `2rq1b2/pP1kpp2/2p5/4Pp1P/1P3Q2/3b1P1N/2b4P/R1B1KBrR w KQ f6 0 25`). Directly: `landCheck("2rq1b2/pP1kp3/2p5/4Pp1P/1P3Q2/3b1P1N/2b4P/R1B1KBrR w KQ f6 0 25", shape, "f7", [])`
  returns a position for every shape (p, n, b, r, q) in which chess.js has `e5f6` and Stockfish's `go perft 1` doesn't. What the
  judge then does with a crowd that picks it was not traced.
- **Fix (the cause, not a check):** one rule for "the en passant square the engine keeps" (Alfil's: the square and the one behind
  it empty, the pawn there, a taker beside it) in `rules.ts`, used by `editedFen`, `tidyEnPassant` and tiger's `placed`
  (which is `tidyEnPassant` written twice). Fairer to the crowd than clearing the square: `landCheck` refuses the square behind the
  en passant square, as it already refuses the square itself.

### 2. High: Chandy's last-chance Dodge comes only when the mate opens at his own turn change (§3.1, §3.5)

- **Where:** `packages/chess/src/runner.ts:2536-2537` (`prepareSide`: `hold` for every boss but the one whose turn change it is);
  `packages/chess/src/bosses/chandy.ts:878` (`ultimate`, the last chance: `mateOpen`, `:811`).
- **What happens:** alone, "as your turn begins, if he hasn't used it and you have a move that mates him, Dodge comes now" (Eric,
  Nov 16: "he still fires his ult anyway"). That rule sits inside his ultimate's step, and on a side every boss's step runs only
  at his own turn change. So on a 2-boss floor the last chance is missed when the mate opens after Chandy's own move, and on a
  3-boss floor two times in three: the crowd simply mates. Whether he dodges depends on the order the bosses were dealt. The
  design lists Dodge as plain "IN", and every boss "behaves on a tower floor as he does in his own battle".
- **Proof:** Scholar's mate against him (`e4 e5 Bc4 Nc6 Qh5 Nf6`, `Qxf7#` open as turn 4 begins; the bosses' moves played with
  `applyBossMove`, seed 5):

  | Side (order dealt) | Who made Black's 3rd move | Dodge as turn 4 begins |
  | --- | --- | --- |
  | chandy | chandy | yes (`warn`, `dodge`) |
  | timber, chandy / zebra, chandy | the other boss | yes |
  | chandy, timber / chandy, zebra | chandy | **no**: no warning, no Dodge, `Qxf7#` allowed |
  | chandy, timber, zebra | zebra | yes |
  | timber, zebra, chandy / timber, chandy, zebra | chandy / zebra | **no** |

- **Fix:** a call first (below, "For Eric"). If it should fire: a boss's rules name an ultimate that can't wait (one optional
  hook, `ultimateNow?(next, t)`, Chandy's is `mateOpen`), and `prepareSide` doesn't hold him when it says yes; it goes first that
  turn change and the others wait, as a prepared ultimate already does. `mateOpen` also reads only his own marks: on a side it
  should ask the side's allowed moves (a mate another boss's freeze stops isn't open).
- **The same class, checked:** every other boss's `ultimate` step only warns and lands on a later turn (`t.turn > warnAt`), so a
  step skipped for a turn or two only delays it. Chandy's is the one rule in a step that must act on the turn it is true.

### 3. Medium: Folio's Crease line is searched on moves the floor's slower meter doesn't call for (§3.2)

- **Where:** `packages/chess/src/bosses/folio.ts:469` (`creaseDue(b, s = BOSS_POWERS)`), called with no rates from `:485`
  (`creaseAsk`), the runner's `creaseAsk` (`runner.ts:1590`) and the lobby (`lobby.ts:721`, `:2393`).
- **What happens:** `creaseDue` asks "will my meter be full as the next turn begins" at the one-boss speed. On a floor of 2 or 3
  the meter really fills at 75% or 60% (`sideRates`), so for a stretch of his moves it says yes, the host (or your device) searches
  every candidate line at `creaseNodes` (20,000 each) before his move shows, and the answer is thrown away: his step, which reads
  the floor's rates, doesn't warn. No rule breaks; it is engine work and waiting for nothing.
- **Proof** (natural meters, 60 crowd moves, 3 seeds a side; a search counted as "not called for" when `creaseDue` with the
  floor's own rates says no):

  | Floor | Folio's moves | Line searches | Warnings that followed | Searches not called for |
  | --- | --- | --- | --- | --- |
  | Folio alone (3 battles) | 173 | 11 | 11 | 0 |
  | 2 bosses (12 battles) | 350 | 84 | 34 | 50 (1 of his moves in 7) |
  | 3 bosses (9 battles) | 170 | 58 | 18 | 40 (1 in 4) |

- **Fix:** `creaseDue` reads the floor's rates (the runner's `rageRates()`, given to the hook through `Battle`), as his step does.
  Nothing else reads a meter at the one-boss speed: every other `meterFull` goes through the step's own `t`.

### 4. Medium: the kit's invariant 9 fails on legal positions (§3.3)

- **Where:** `packages/chess/test/boss-kit-lib.ts:462-473`.
- **What happens:** invariant 9 ("the boss to move is never held to another boss's own forced move") takes every stop of the other
  boss (`bossStops`) for his own. But some bind the whole side by design: Smudgy's disguise (`sideStops`) and all of Babur's hoops
  (no `sideStops`: all of them). When such a guard leaves the side one move, the check fails though the game is right. CI passes
  only because its one seed a pair doesn't meet it; the next change that shifts a game will turn a PR red for nothing.
- **Proof:** two hits in 378 deeper battles. `smudgy + clown`, seed 30210 (40 moves, trigger from 2, strikes 4, 11, 19): after
  `d1h5` Black is in check with two legal moves, `g7g6` and `g7f7`, both the hidden rook's; `camo.due` is null (no forced move);
  the disguise alone leaves `g7g6`, and the kit reports "clown to move is held to smudgy's own forced move g7g6".
  `tiger + bigboy + sawyer`, seed 7972 (45 moves): the hoops leave the lone king `f7e7`, reported as "tiger's own forced move".
- **Fix:** compare against the other boss's own part only: skip a boss with no `sideStops`, and skip when his `sideStops` alone
  already leaves that single move.

### 5. Low: two things the solo-against-online check can't see (§3.1)

- **Where:** `packages/server/test/boss-kit-parity.test.ts:84` and its move cap.
- **What happens:** (a) the test's host answers every extra-move request with Hollow's picker (`extraMoveFrom`); the app's host
  uses Dash's for Dash (`packages/app/src/net.ts:1202`). So when Dash's Scramble Rush fails in a parity battle the two paths part
  for a reason that isn't the game's, and a real disagreement there would look the same. (b) Known and written in the file: a
  moment on the cap's last crowd move is read solo and never sent online.
- **Proof:** a wider sample through the same harness (78 sides: every boss first with three partners, 24 threes; a throwaway copy
  of the file with the list swapped): 73 agree. `moo + dash` parts at turn 10: online the host answers `""` and the server plays
  the seed's stand-in (`e7e6`), solo plays `dashExtraMoveFrom`'s `a7a6`. `timber + clown + smudgy` parts at turn 14 on Timber's
  clock (the harness's known limit). Three more (`alfil + tiger`, `gardener + tiger`, `hopper + smudgy`) differ only in the
  events seen, on the cap's last turn (`hoopsOut` on turn 16); with the cap at 19 the first two agree and the third's only
  difference is a `carrot` event on turn 19, the cap's turn again. None is the game's.
- **Fix:** the test's host picks as `net.ts` does (by the boss in focus); the cap's last turn left out of the events compared.
  Then the parity check can run more sides than 11 without false alarms, which the party (PR 12) will want.

### 6. Low: `turnOf` is missing from the restored runner's fields (§3.3)

- **Where:** `packages/chess/src/runner.ts:2399` (`private turnOf: number | null = null`) against the list in `restore`
  (`:1310-1337`), whose own comment tells the story: "Object.create skips the class's own initializers. A restored runner without
  the bosses' store crashed Big Boy's Big Bounce online: every event of a lobby restores."
- **What happens:** on every restored runner (every lobby event) `turnOf` is `undefined`, not `null`. Nothing breaks today
  because each read goes through `??` (measured: 6,973 steps on restored copies, the same allowed moves and the same turn owner
  as the live runner). The next read written as `=== null` breaks online only.
- **Fix:** `turnOf: null` in `restore`'s list.

### 7. Low: three things the deal (PR 8) must not take from `startSide` (§3.1, §3.4)

- **Where:** `packages/chess/src/runner.ts:2558-2606`.
- `startSide` throws on an unknown id, a repeated id or an `apart` pair. Right for a test switch; a match room must never be handed
  ids a device chose. Today nothing can: `bossIds` is read only by the runner and tests (checked: no route, no protocol field).
- It doesn't look at the kill switches (`bossesOff`, `rosterWithout`), which the one-boss start does (`:401`): a resting boss given
  in `bossIds` is met.
- Each boss gets his own roster strength (`bossStrength(tier, def, …)`: Folio +150, most −250), where the design gives every boss
  the floor's rating.

### Nits

- `packages/core/src/settings.ts:1256-1260`: `BOSS_POWERS`'s doc comment now sits above `BATTLE_TOWER`'s (the new block went in
  between it and its constant).
- `runner.ts:507`: `bossBlackout` asks `blackedOut(this.state.boss)` again after asking every boss on the side.
- The design's first line still says "Status: design only, nothing built"; the area page is right.

## 3. Measurements (§3.2)

No screen or drawing changed in PRs 1 to 6 (`packages/app` wasn't touched; `e2e/folio.spec.ts` only swapped a helper), so the
`@perf` specs and a slowed phone have nothing of the tower's to measure yet: that is audit 2's. They were not run. What was measured is the runner, in
Node on this container (4 cores), with the kit's stand-in engine.

**The cost of the rules a turn** (idle machine, natural meters, 40 crowd moves, three sides of each size):

| Floor | `crowdAllowed` a call | calls a crowd turn (the kit's driver and checks included) | `bossAllowed` a call | the boss view a build | `sideBosses`, all calls a turn |
| --- | --- | --- | --- | --- | --- |
| 1 boss | 1.26 ms | 5 | 0.07 ms | 0.51 ms | 0.03 ms |
| 2 bosses | 1.38 ms | 5 | 0.72 ms | 0.57 ms | 0.33 ms |
| 3 bosses | 1.35 ms | 5 | 0.58 ms | 0.54 ms | 0.39 ms |

So a shared floor adds about a tenth of a millisecond to each of the crowd's allowed-moves questions (nearly all of that call is
chess.js listing the legal moves, the same with one boss) and under a millisecond to each boss move. Nothing runs per frame. The
match's saved state stays under 10 KB and the view under 5 KB with three bosses (7.3 KB and 4.2 KB with one); a floor is a new
runner, so nothing grows over a run.

**How long the queued moments hold a turn** (`powerFxMs` summed over the view's events as each crowd turn begins; natural meters,
40 crowd moves; 18, 36 and 36 battles):

| Floor | Mean a turn | Turns with a moment | Turns held 5 s or more | 90th percentile | Longest |
| --- | --- | --- | --- | --- | --- |
| 1 boss | 0.98 s | 37% | 1.8% | 3.5 s | 11.0 s |
| 2 bosses | 1.63 s | 49% | 7.3% | 4.3 s | 9.3 s |
| 3 bosses | 2.07 s | 66% | 11.2% | 5.2 s | 12.5 s |

**The meters and the ultimates** (natural meters, 60 crowd moves; 54 one-boss battles, all 149 pairs, 40 threes):

- Ultimates met a 60-move floor: 3.06 alone, 4.59 with two bosses (1.5 times), 5.50 with three (1.8 times): what `rageScale`
  (2 × 0.75, 3 × 0.6) says it should be.
- From the warning to the ultimate: 1 turn alone; 2 turns on every 2-boss floor, 3 on every 3-boss floor (the step comes only at
  his own turn change).
- Two bosses with meters of their own seldom get there on a shared floor: Wrangler no showdown in 8 of 17 pair battles and 2 of 3
  threes, Chandy no Dodge in 6 of 17 and 4 of 8 (alone, always at least one). For the sim (PR 14).

**How tight the crowd's turns are** (the same runs): the share of legal moves still allowed is 96% alone, 94% with two, 90% with
three; the lift (every limit together leaving no move) came on about 3 of 10,320 shared crowd turns. A power touches the turn
(`powerTurn`) on 31% of crowd turns alone, 49% with two, 61% with three. A power has changed the board for the Last Stand's test
(`boardAltered`) on 44%, 62% and 81%.

## 4. Checked and found right

- **No wrong position, no missing move, no illegal move:** 765 battles through `runBattle` with every kit invariant and Stockfish's
  own move list: 298 pair battles (every pair, two seeds, 40 moves, ultimates pulled from turn 2), 80 threes (45 moves), 54
  one-boss, then 243 more at 60 moves on natural meters, then 90 with a forced Last Stand: about 64,000 checked steps before the
  Last Stand runs. Three battles failed: finding 1 once, finding 4 twice.
- **The most restrictive mark wins, with one lift:** on 72 shared floors (2,514 crowd turns, 1,348 of them limited; 2,325 boss
  turns, 589 limited) `sideCrowdAllowed` was exactly the moves every boss's own limits allow, and `sideBossAllowed` exactly what the
  merged layer and the side's guards allow; where they left nothing (7 and 2 turns) every legal move came back. Never a difference.
- **One boss is unchanged:** 108 one-boss battles with no failure; a side of one goes down the old functions (`several()` is
  false, each `side*` function hands a side of one to the one-boss function). The layer PRs changed the helper the old boss tests
  call (`crossesCut`, `crossesCrease`, `crossesMiddle`, `held` to the layer's `marksStop` and `heldBy`) and kept every expected
  value; Big Boy's lost two assertions with the removed `topples` and one now has him to move (the layer binds by side), both
  written in the square-marks note.
- **The turn order:** each boss moves in the order dealt; Hollow's second move, Wrangler's reply to the duel and Folio's move again
  come out of turn and the order goes on after them (read, and `several-bosses.test.ts` plays each).
- **A restored runner is the same runner:** on 90 battles (6,973 steps), a copy restored from the snapshot at every step gave the
  same allowed moves and the same turn owner (no state the side needs lives outside the match's state; see finding 6 for the one field).
- **Solo and online:** 73 of 78 sides the same positions, events and result; the other five are the harness's (finding 5).
- **The God King:** a Last Stand forced on turn 6 of 72 shared floors: every invariant held and the move he took back was never
  offered again. His strike staggers the next boss to move and its rage goes to the boss in focus, as the decision says.
- **Marks on pieces after another boss's power:** no held mark was ever found on an empty square or the wrong side's piece
  (Chandy's beam marks its whole line by design).
- **The meters:** each fills at the floor's scale and the bar reads the same rates; only Folio's `creaseDue` doesn't (finding 3).
- **Simpler code:** the old per-boss checks are gone or go through the layer (`toyStops`, the pie's and the crease's `stopReason`
  call `marksStop`); no rule is written twice between a boss and the layer. The one idea found written three times is finding 1's.
- **Not there yet, so not audited:** the climb, saving (`packages/server/src/tower.ts` doesn't exist), the party, every screen.
  Fair play: the design gives the tower no fair-play signals, so nothing to judge; the numbers above are for the record.
- **For PR 10, known and only noted:** the view carries the powers of the boss in focus alone (pies, fire, the funhouse's angle,
  the dark), so a screen drawn from it would change with the focus; the decision file already says the per-boss view waits for
  the screens. The same crowd turn's moments of the other bosses stay in their `events` after a Revision replays the turn: check
  the queue doesn't play them twice.

## 5. For Eric

- **Chandy's last chance on a shared floor** (finding 2): should he still fire his Dodge whenever you have a mate in one, even
  when it isn't his turn next? Today he does only half the time with two bosses, a third with three.
- **A warned ultimate lands 2 turns later on a 2-boss floor and 3 on a 3-boss floor** (1 alone): the design said "the second waits
  a turn"; built, every ultimate waits for its boss's own turn. More time to prepare, and the warning stays up that long.
- **The Last Stand is off most of the time with three bosses:** a power has "changed the board" on 81% of your turns (44% against
  one boss), and he sits out on those. If he should still save you in the tower, the rule needs a narrower test there.
- **Three bosses' animations hold your turn about twice as long** (2.1 s a turn against 1.0 s; one turn in nine waits 5 s or more).
  One to feel in the first playtest before tuning anything.
