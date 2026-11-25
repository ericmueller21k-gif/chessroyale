# The Battle Tower: audit 2, the first playable solo tower (Nov 19, 2026)

The auditor's report after PR 10 ([the brief](../areas/battle-tower-audit.md)). Read-only: nothing in the build was changed. The
screen findings were proved in a real browser (the built app on the local Worker, started as the e2e starts it, an emulated iPhone
13, throwaway Playwright scripts that were never committed); the rules by throwaway tests over the kit's own `runBattle` and core's
`tower.ts`. Each proof says how to see it again. Audit 1's findings were all fixed (#810, #811) and are not repeated.

## 1. Summary

- **Audited:** `main` at `e8d8305`: the climb's rules (#811), saving (#812), the solo screens (#816), the skyscraper and its lobby
  (#815), and the audit-1 fixes (#810). No open Battle Tower PR was named.
- **Verdict:** the rules, the deal and the server's saving hold; frames on a slowed phone are the same with three bosses as with
  one. The screens are not ready for a playtest of floors with 2 or 3 bosses (74 of the 99): the board, the banners, the refusal's
  words and the move list all show one boss only, the one in focus. Two more ways to lose or bend a run: a reload takes back the
  bosses' reply, and one lost answer from the server ends a run.
- **Do first:** finding 1 (every boss's marks, moments and moves on a shared floor), before Eric plays floor 2.

## 2. Findings, most severe first

### 1. Blocking: on a floor of 2 or 3 bosses the screen shows only the boss in focus (§3.1)

- **Where:** the view, `packages/chess/src/runner.ts:2189-2200` (`buildBossView`: the top level is the boss in focus; the others are
  only under `side`) and `:2246-2270` (`powers`: only `iced`, `events` and `allowed` are the side's). The app reads `side` in one file,
  `screens/TowerBar.tsx` (the bar and the dock's "plays" line). Everything else is handed the top level:
  `screens/Play.tsx:299-301` (`PowerBoard`, `boingoDecor`, `zebraGold`, `elephants`, `refusedLine`), `screens/Boss.tsx:575`
  (`PowerMoment boss={boss}`), `components/MovePanel.tsx:81-101` (`Who`), `refused.ts:71-84`.
- **What happens,** on every shared floor, to everyone:
  1. **A mark binds but isn't drawn.** A boss's lasting marks (Sawyer's cut, Boingo's pies, Big Boy's blocks, Puddles' plants,
     Babur's balloons and hoops, Folio's crease, Jefferson's fire, Don Dough's gold, Chandy's beam and shields …) are drawn only on
     the turns he is in focus. On your other turns the move is still refused (`sideCrowdAllowed` merges every boss), so you meet a
     wall you can't see. Only ice shows always (`sideIcedSquares`).
  2. **The refusal has no words.** `refusedLine` asks the boss in focus why; for another boss's mark it answers the catch-all line.
  3. **A boss's moment is credited to another boss.** The queue plays every boss's events with the boss in focus as the caster:
     Sawyer's cut came up as a banner reading "Ginger · SAW CUT! · No crossing d3-d4" with Ginger's face, and Ginger said "Chill out!".
  4. **The move list repaints who moved.** Every move of the side carries the face of the boss in focus now, so the column flips
     each turn (all Ginger, then all Sawyer). While any of them thinks, the dock says "The boss is thinking…".
- **Proof (browser):** a run's row set to floor 2 with Ginger then Sawyer (`met` edited through the e2e's SQL route), `/tower?debug&pace=quick&power=cuts`:

  | Your turn | In focus | Sawyer's cut (his own part of the view) | Drawn (`.sw-cut`) | Moves refused |
  | --- | --- | --- | --- | --- |
  | 3 | Ginger | a3-a4 | **no** | a2a4 (and the frozen queen's) |
  | 4 | Sawyer | a3-a4 | yes | a2a4 |
  | 5 | Ginger | a3-a4 | **no** | a2a4 |
  | 7 | Ginger | h1-h2 | **no** | h1h2, h1g1 |
  | 8 | Sawyer | h1-h2 | yes | h1h2, h1g1 |

  Stills of turn 3 (no cut on the board) and turn 4 (the cut), and four frames of the "Ginger · SAW CUT!" banner, were looked at;
  images aren't committed. **How often (the kit, natural meters, 40 moves; about 27 pair floors and 12 threes):** a move stopped by a boss
  not in focus, that the view of the boss in focus can't explain, on 129 of 1,098 of your turns with two bosses (11.7%) and 113 of
  477 with three (23.7%). E.g. `gingerbread + clown`, seed 77, turn 3: `e2e3` refused, the view's `pies` empty, his own `e3, g3`.
- **Why CI didn't see it:** `e2e/battle-tower.spec.ts` checks the bar's two parts; nothing checks a mark, a banner or the list on a
  shared floor. Audit 1 left this as a note for PR 10 ("a screen drawn from it would change with the focus").
- **Fix (the cause, the least code):** the screens draw each boss from his own view, which `sideOf` (TowerBar.tsx) already builds:
  `PowerBoard` (and the decor, gold and elephants) once a boss on the side; `refusedLine` the first boss with a reason. Two things
  the view must add: each event names its boss (the runner knows as it joins them: `runner.ts:2262`), for the banner's caster and
  the bubble; and who made each of the side's moves (the runner has `state.moved`; one id a ply), for the move list and "… is
  thinking". Then one check in the existing spec: Sawyer's cut drawn on the turn Ginger is to move, and the banner's name.

### 2. High: a reload takes back the bosses' reply, and gives your turn's time back (§3.1, §3.5)

- **Where:** `packages/app/src/solo.ts:318-321` (`keepFloor`), called only from `nextRound` (`:1468`); the bosses' move is played at
  `:1096` and shown for `showMs` before the next `nextRound` (`:1105`; the same shape after every power's step, `:1122-1242`).
  Solo's random source is `Math.random` (`solo.ts:102`, given to the restored runner at `:330`; `runner.ts:1420`).
- **What happens:** the floor is kept on the device only as each round begins. While the bosses' reply (and its moments, or his
  mate's attack) is on screen, the kept game still has him to move. A reload then rejoins before his move, and he picks again from a
  fresh random draw. So a player who doesn't like the reply (a piece lost, a mate) reloads until a weaker one comes: the design's
  call 6, "a reload can't dodge a loss", doesn't hold on Maia floors. Separately, the turn's start isn't kept (the PR's note says
  so): a reload on your move starts the turn's clock again, so nobody need ever lose on time.
- **Proof (browser, floor 1, the game's real pace):** his reply `e5` was on screen 476 ms before the device kept it (a plain move;
  longer with a moment). Then, after 1.e4 e5 2.Nf3, six reloads, each as his second reply showed: it was `d6`, `Nc6`, `Nf6`, `Nf6`,
  `Nc6`, `Nc6` (three different replies to the same move; the kept position each time still `… b KQkq - 1 2`). The clock: 10:20 as
  the turn began, 10:00 after 20 s, 10:20 again after a reload, three times running (60 s of thinking for nothing).
- **Fix:** keep the floor whenever the runner has changed, not only as a round begins: `keepFloor()` right after his move is applied
  (and after each power's step), so a reload rejoins after it. The moments already live in the kept state's events. For the clock,
  keep the turn's start with the game and give it back in `resume` (a call first: "For Eric").

### 3. High: one lost answer to "start the floor" ends the run (§3.1)

- **Where:** `packages/app/src/tower.ts:69-91` (`ask`: a failed request is sent once more), `:190-196` (`floorPlan`), `:317-326`
  (`askFloor`); `packages/server/src/tower.ts:271-272` (a floor under way is answered `under`).
- **What happens:** you tap CONTINUE FLOOR n (or Continue after a win). The server starts the floor, and its answer is lost on the
  way back (a phone changing cells, the tab closed in that second). The app's own second try is answered `under`, nothing is kept on
  the device yet, so the plan is "elsewhere": "This floor is under way on another device. Leaving it here counts as a loss and ends
  your run." Cancel leaves a floor that can never be played (every start answers the same); "Leave it" ends the run. Nothing was
  played.
- **Proof (browser):** the first `POST /api/tower/floor/start` let through to the server and its answer dropped
  (`route.fetch()` then `route.abort()`): 2 requests sent, the dialog above, no battle, nothing in `brc.tower.solo`, the row's
  `fight` set. After "Leave it": `status: "out"`, the card "No run yet".
- **Fix:** the app marks the ask as its own before sending it: a random id kept on the device and sent with the start; the server
  keeps it in `fight` and answers it back; `floorPlan` reads an `under` answer carrying this device's id, with no game kept, as
  "fresh". About ten lines, and "elsewhere" then means what it says.

### 4. Medium: the tower's screen says "No run yet" when it couldn't read the run (§3.1)

- **Where:** `packages/app/src/screens/Tower.tsx:73-78` (`load`: on a failed read, the note and `busy` off, `state` still null) and
  `:122-127`, `:228-231` (no state is drawn as no run).
- **What happens:** with a run on floor 12 and the read failing (both tries), the card says "No run yet", the button START A RUN.
  Tapping it once the connection is back asks "Start a new run? Your run on floor 12 ends."; "New run" deletes the run.
- **Proof (browser):** `GET /api/tower` dropped twice with a run on floor 12: the card "No run yet … Floor 1 · 1 boss · 800", the
  button "START A RUN", the note "Couldn't reach the tower…"; the tap then showed the replace question for floor 12.
- **Fix:** no state is not "no run": while `state` is null the button reads TRY AGAIN and calls `load`, and the card says it
  couldn't be read. A 409 carrying `run` from START A RUN shows that run instead of asking to replace it.

### 5. Low: a win the server finds "too soon" is forgotten by the device (§3.1; read, not run)

- **Where:** `packages/app/src/tower.ts:237-241` (`settleKept`: any 409 with `run` clears the kept result) against
  `packages/server/src/tower.ts:318` (too soon: a 409 with `run`, `best` and `fight`, the floor still under way).
- **What happens:** the kept result goes, the result screen says "Floor n cleared!", and Continue meets finding 3's question (the
  floor is still under way, nothing kept). No real win comes inside 10 s, so nobody should meet it; the answer is still read wrongly.
- **What would prove it:** a unit test of `settleKept` with a stand-in `fetch` (TEST_SWITCHES waives the check on the local server).
- **Fix:** a 409 carrying `fight` means "still under way": keep the result and send it again later.

### 6. Low: a rejoin starts the floor's XP game again (§3.4; read)

- **Where:** `packages/app/src/App.tsx:1423` (`noteSoloGame(m)` on every way into a floor) and `packages/server/src/xp.ts:50-61`
  (one `solo_games` row an account: a new start replaces the last).
- **What happens:** after a reload the floor's XP minutes count from the reload, not from the floor's start. It can only pay less.
- **Fix:** not on a rejoin (`e.game` set).

### 7. Low: with a kill switch flipped mid-run, a boss can sit twice in the deck (§3.1)

- **Where:** `packages/core/src/tower.ts:144-147` (`deal`: the new deck is the whole pool, added after what the old one still held).
- **Proof:** 400 runs of 99 floors, half with kill switches flipping: 28 of 19,800 floors left a boss twice in the deck (e.g. seed
  158,380, floor 80: Smudgy twice). He then comes twice before some boss comes once. Never with no kill switch.
- **Fix:** the new deck without the bosses still waiting in the old one.

### Nits

- `docs/areas/battle-tower.md:10` and the audit brief's §1 still say the tower sits "next to Auto chess" on home; Eric's Nov 19
  call (the town's clerk only) is further down the same page.
- `TowerResult.tsx:49`: "Stop here (saved)" is offered beside an error line when the result couldn't be sent (it is kept on the
  device and sent later, so it's nearly true).
- No `@perf` test covers a tower floor (PR 10 added the split bar's three animated figures); the numbers below are in budget.

## 3. Measurements (§3.2)

**Frames on a slowed phone** (the perf spec's method: iPhone 13 emulation, CPU slowed 4 times, six of your moves a floor; "idle":
1.5 s on your move; "the bosses' turn": from your move to your next turn):

| Floor | Idle: p95, dropped, longest | The bosses' turn: p95, dropped, longest | DOM | Running animations | The floor kept | `keep()` a step |
| --- | --- | --- | --- | --- | --- | --- |
| 1 boss | 16.8 ms, 1%, 50 ms | 16.8 ms, 5%, 200 ms | 371 | 15 | 3.2 KB | 0.6 ms (longest 1.7) |
| 2 bosses | 16.8 ms, 1%, 50 ms | 33.3 ms, 6%, 250 ms | 391 | 15 | 4.0 KB | 0.5 ms (longest 1.2) |
| 3 bosses | 16.8 ms, 1%, 50 ms | 33.3 ms, 6%, 267 ms | 519 | 16 | 4.2 KB | 0.8 ms (longest 5.0) |

So the split bar and the stacked figures cost nothing while you think, and keeping the floor at every step costs under a frame even
slowed. The one long frame of a turn is there with one boss too (not the tower's). The repo's own `@perf` specs were not run: none
plays a tower floor.

**The runner** (Node, the kit's stand-in engine, the same shared floors of 40 moves): the saved match is 4.6 KB on average with two
bosses and 4.9 KB with three (longest 8.8 KB); a view with every boss's part builds in about a millisecond or less (the test
runner's clock steps by 1 ms).

**The reload window:** 476 ms for a plain reply at the game's real pace; a reply with moments stays open for their whole length
(audit 1 measured 2.1 s a turn on average with three bosses).

## 4. Checked and found right

- **The deal** (core `tower.ts`): 400 seeded runs to floor 99 (39,600 floors), half with kill switches flipping at random: never a
  side `sideRefusal` refuses, never a boss on two floors in a row, never fewer bosses than the pattern with six or more in the pool,
  the settings always the deal's, every run ending at the top; with no kill switch every boss once before any twice. Only finding 7.
- **The floor's strength:** read against the design's table and the tests that pin it (`several-bosses.test.ts`, core
  `tower.test.ts`); "Next floor 800" on floor 2's strip is right (700 + 100, two bosses).
- **Saving** (server `tower.ts`, read end to end): the seed is the server's; a start is written only over the run as it was read; a
  result is taken once, in one statement, only for the floor under way, and the same result sent again gets the same answer; the
  best only rises and is worked out before rows go; the merge keeps the higher of two open runs; the download leaves out the seed
  and deck; deleting takes both tables (`ACCOUNT_STORES`). Its tests were not run again (CI's).
- **Nothing pays or ranks on the device's word:** `tower_best` is read only by `tower.ts` and the download; the lobby's "Best
  floors" board is a drawing; no crate, coin or leaderboard reads a solo result. Forging a solo best is possible by design (a start,
  a wait, a "won") and buys nothing.
- **No Last Stand on a floor** (`runner.ts:1126`) and no strikes; the God King's charges as Boss alone's.
- **Leaving:** free before your 2nd move on the device (`leaveIsFree`) and on the server (`leaveFloor`) by the same setting; a
  counted leave shows the run's end; a free one goes back to the tower with the floor waiting (their e2e, read).
- **The kept floor:** read back defensively (`readKept`), never sent twice at once (`settling`), a result kept until the server
  takes it and sent again from the tower's screen; a rejoin gives back the same position when the reload comes on your move.
- **Lag:** the table above; nothing in the bar runs every frame beyond the sprites' own animations; the figures' drawn boxes and
  their one scale are worked out once.
- **Fair play:** a solo floor gives no signals, as Boss alone; nothing to judge yet (the party is PR 12).
- **Not there yet, so not audited:** the floor room's walk-in (PR 11b), the party (PR 12), the sim (PR 14), rewards and milestones.
  PR 11's building and lobby were read only for what they show of the tower's data (nothing).

## 5. For Eric

- **Does your clock keep running while you're away from a floor?** Today a reload on your move gives the turn's time back, so a
  floor can't be lost on time. Running it on would mean a floor left overnight is lost on time when you come back.
- **A solo floor counts as a solo Boss Battle** for your profile, the boss quests and XP (the device names the mode). Floor 1 plays
  at 800, easier than Easy (1150), so it is the quickest "beat a boss" in the game. Fine, or should the tower's floors count apart?
