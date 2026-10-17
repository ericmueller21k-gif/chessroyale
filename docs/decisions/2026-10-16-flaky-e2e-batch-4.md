# Seven flaky e2e tests: two game bugs, three tests' own doing, two not reproduced (Oct 16, 2026)

CI's `e2e` run listed these as flaky (passed only on the retry), or they failed once locally. Each was traced from CI's
logs, the failing tries' page snapshots and the retries' traces, and reproduced locally before anything changed
(`--repeat-each`, and by forcing the suspected condition). No assertion was loosened, skipped or given a longer
timeout, and no sleep was added. Two were real bugs a player could meet (a chat menu that closed by itself, an Escape
the party sheet ignored); three were the tests' own timing or play (the last found on this PR's own CI run); two (both
in `squads-mercenary.spec.ts`) didn't reproduce, and the leads given for them turned out not to be their causes.

## A name's menu closed when the round moved on (a real bug): `chat.spec.ts:72` "quick chat picks in the profile…" (desktop)

- **Seen:** the computer tapped the phone's name in its chat and waited for the menu's Mute; the button was "not
  stable", then "detached from the DOM", and the click waited until the test's 9 minutes ran out.
- **Cause:** the menu (Profile, Mute) was the chat panel's own state, and every phase of a match draws its own screen
  with its own panel (`PlayScreen`, `WatchScreen`, `CrowdReveal` in `App.tsx`, each with its `UnderBoard`). So at the
  next phase (in Crowd's team turns, every few seconds) the menu closed by itself, under the player's finger. The chat's
  options panel (⋯) had the same flaw. Logged every frame in a match: the menu open, then gone at the phase change, 2
  of 2.
- **Fix (game):** what's open in the panel is the match chat's (`MatchChat.menuFor`, `optionsOpen` in `chat.ts`), not
  the panel's, so a new screen's panel shows it open (`ChatPanel` in `QuickChat.tsx`). Closing is as before (a choice,
  ✕, Done). New test (`chat.spec.ts`, "a name's menu and the chat options stay open when the round moves on"): every
  frame from the tap through a phase change has the menu, Mute still works; the same for the options.

## Escape lost as the party sheet opened (a real bug): `kill-switches.spec.ts:67` "Squads resting…" (phone)

- **Seen:** twice on CI today (#256's branch, then main at 0bc02a1): after Escape the sheet was still there.
- **Cause:** the sheet listened for Escape from a `useEffect`, which Preact runs after the next paint; the test checks
  three things in the sheet and presses Escape, and on a busy runner that came before the listener. A player pressing
  Escape as it opens has it ignored too. The listener also kept the sheet's first `onClose`, from before any party was
  made: App's `closeParty` reads the party of its render, so Escape after making a party in the open sheet dropped the
  party without leaving it (its member stayed in it on the server: 2 of 2).
- **Reproduced:** Escape as soon as the sheet was visible, 1 of 20 ignored; Escape dispatched the moment the sheet is in
  the page (a MutationObserver), 10 of 10.
- **Fix (game):** the listener is added in a layout effect (as the sheet is drawn) and calls the latest `onClose`
  (`SquadsParty.tsx`). New test (`squads-play.spec.ts`, "the party sheet: Escape closes it from its first frame…").

## The panel measured in the reveal: `panel.spec.ts:71` "the panel under the board is never empty" (phone)

- **Seen:** on #255's run, "tap 14 "Side by side"": the chat's feed 24 px, the test wants more than 30.
- **Cause:** the test measures while a move is being chosen (a reveal adds its tally row above the panel), but it read
  the phase, then waited for the layout, then measured, in three looks: the round moved on to its reveal in between. The
  failing try's page shows the reveal's tally ("Your team watched this one · best was h3"). Measured every frame: the
  split's feed is 109 px in play and 107 watching, 16 to 24 px in a reveal.
- **#256** (the split chat's header) made the Team / All switch 24 px instead of 20: the feed in play is 109 px either
  way (its CSS forced back to 20 px in the page). It doesn't matter here, and the CI failure came from a branch without
  it.
- **Fix:** the phase is read in the same look as the sizes, and a look taken outside a move being chosen is measured
  again at the next one. Forcing the round to its reveal between the wait and the look at tap 14: the old test failed 3
  of 3 (feed 24 and 16 px, as on CI), the new one 0 of 3.

## Boingo's battle drawn by repetition: `boss-powers.spec.ts:390` "Boingo's funhouse at every angle" (desktop)

- **Seen:** four times on CI on Oct 15-16 (#255's branch, and the branches of kill switches, the opening grace and a
  copy change), on a phone and a computer, ending at turn 11, 11, 14 and 15 of 16: each failing try's page says "A
  draw with Boingo the Clown".
- **The draw rule:** the battle ends when its board's game does (`stageComplete`: `finalGameOver`, `gameEnd` in
  `packages/chess/src/rules.ts`): mate, stalemate, threefold repetition, too little material, the fifty-move rule; or at
  the move cap. Anything but mate is a draw (`gameWinner` null, `finishBossBattle` "draw"). At turns 11 to 15 neither
  material nor fifty moves can apply.
- **Cause:** the test plays the engine's best move but never a mate (commit 1a1cdc9). Once it's winning, many moves
  score exactly 1.0 and their order is arbitrary, the mate among them. The retries' traces show what follows: in one,
  Qh7# was first on the list every move from move 18; the test took the next 1.0 move each time, its queen going h6, g6,
  h6 and Boingo's king g8, h8, g8. Two more such moves are a threefold repetition: a draw, the battle over before turn
  16. (Another retry shows the queen giving check after check around the king, the same kind of loop.)
- **Fix:** the test's "lasting" moves are now the best ones after which the battle goes on: not mate, stalemate or any
  other draw (`isGameOver` over the board's moves since the start), and not a position the board has already had
  (`lasts`, `firstLasting`). The test checks the same things. Locally no draw came in 12 runs before or 12 after; on
  that CI game's own engine lists, the old rule's moves are the ones it played from move 16 to 20, and at move 21 it
  would have played Qg6 again (the position after 19.Qg6, a second time) where the new one plays Be3.

## Not reproduced: the capture's coins, `squads-mercenary.spec.ts:99` "earning coins…" (desktop)

- **Seen:** on #255's run, no coins event for your capture (g5f6) in 60 s. The failing try's page, 60 s later, shows
  Relay's T3, both squads on 6 coins.
- **The lead, checked:** the test reads only the last half (`m.last`), which the next half replaces. Recorded every half
  as it came (`window.squads.subscribe`) beside the test's own looks, 69 runs: the half with your capture stays the last
  half for 5.7 to 9.1 s (the next one is the other squad's, whose bots think at least 1.5 s after a show), and the test
  looks at least every 1.1 s. It never missed it. So that isn't what happened, and collecting events by `subscribe`
  would change nothing.
- **What did happen, the one time it reproduced** (1 of 12, the first diagnostic run): the half with your move came
  after 19.6 s, at the move's 20 s cap, without a g5f6 in it: your move was never made (the test's two taps didn't make
  it), so the time ran out and a random move was played. Logged after that with what each tap hit, the status line at
  each tap, and the move registering: 0 of 69 (16 plain, 8 with the page's CPU slowed 6 times, 30 plain, 15 beside
  `multiplayer.spec.ts`, which the other worker ran when it failed on CI). Every time the screen said "Your move ·
  Board N" before the first tap (150 to 220 ms after the duty arrived, slowed; the taps came 800 ms or more after it),
  both taps hit the board's squares, and the move was in.
- **No fix, a sharper check:** the cause of the ignored taps isn't found, and a fix without one would be a guess. The
  test now checks right after its taps that your move is in (locked in by the server, or already on the board), within
  5 s: if it comes back, it fails there, with the page as it was then, not 60 s later.

## Not reproduced: the shield, `squads-mercenary.spec.ts:134` "the shop between rounds…", its shield step (desktop)

- **Seen (locally, on the Ranked 1 v 1 branch, 1 of 24):** no shielded block of the other squad's in your match for
  120 s.
- **The lead, checked:** the collector looks at the last half every 100 ms. With every half logged as it came: the
  shield is spent in the match's first half (24 of 24, `bots=blocks` blocks whenever it can), and that half stays the
  last for seconds (its show, then the next half's thinking: 47.0 to 57.4 s in the failing try itself). The collector
  saw it each time.
- **What the failing try shows:** its trace's frames have your squad's shield beside its coins until the first half
  lands (46.5 s) and gone after (47.5 s): spent. But the page never showed the note a spent shield brings ("Your shield
  canceled…", 4 s, `.sq-note`), nor its banner, and the collector got nothing: the page never handled that half's
  message. The only way the page has a spent shield without the half's events is the match coming back whole (`match`,
  the server's `resendTo`), which follows a reconnect. Why the socket dropped there isn't known (nothing in that run's
  server log).
- **No fix, a sharper check:** 0 of 24 with the logging. The test now waits for the shield seen and your squad's
  shields left together, so a failure says which (seen 0 with none left: the page wasn't told). A page that reconnects
  at a half's end misses its news (the shield's banner and note): that's how a reconnect works today, and changing it
  is the protocol's (a lane of its own).

## Your board lost during a wait: `recluse.spec.ts:642` "phase 2's slow moves…" (phone; this PR's CI run)

- **Seen:** on this PR's first CI run (it passed on the retry): the test waited 30 s for its next turn on its phase 2
  board, or the Hidden Boss's ultimate. The failing try's page: "Your board: lost. The others play on.", slow moves 7 of
  10.
- **Cause:** the test plays quiet pawn moves (each after 5 s, to be slow) against Stockfish 2750, so its board is often
  lost before the tenth slow move; it checked for that only before its wait, and Stockfish's answer can end the board
  right after. Then no turn comes, and the bots' remaining slow moves can take longer than 30 s. The test's own next step
  already allows "your board decided first: the bots' slow moves bring the rest".
- **Fix:** the wait also ends when your board is decided, and the loop leaves it to the bots then. Forcing it (your
  board resigned right after the check, at 6 slow moves): the old test failed 2 of 3 as on CI, the new one 0 of 3.

## Before and after (local, `--repeat-each` or forced, failures over runs)

| Test | Before | After |
| --- | --- | --- |
| `chat.spec.ts` the menu across a phase change (desktop) | 2 / 2 (menu gone) | the new test 0 / 6; the file, one worker, 0 / 6 (two copies at once share `pool=chat` and meet in one match) |
| `kill-switches.spec.ts` Escape as the sheet opens (phone) | 1 / 20; forced 10 / 10; the new test 3 / 3 | the new test 0 / 3; the file 0 / 6 |
| `panel.spec.ts` the panel (phone) | forced 3 / 3 (feed 24, 16) | forced 0 / 3; the file 0 / 9 |
| `boss-powers.spec.ts` funhouse at every angle (desktop) | 0 / 12; CI 4 draws | 0 / 12; that game's move 21 no longer repeats |
| `squads-mercenary.spec.ts` the capture's coins (desktop) | 1 / 93 (a move not made); CI 1 | a sharper check; the Squads files, both projects twice: 0 / 34 |
| `squads-mercenary.spec.ts` the shield step (desktop) | 0 / 24 (1 / 24 on the Ranked 1 v 1 branch: not heard, a reconnect) | a sharper check; as above |
| `recluse.spec.ts` phase 2's slow moves (phone) | forced 2 / 3; CI 1 | forced 0 / 3; both projects 0 / 8 |
