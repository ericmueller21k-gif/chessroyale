# The flaky batch: three e2e tests, three causes (Nov 9, 2026)

Eric, Nov 9: fix the flaky tests (they kept turning PRs red, 20 minutes a round). Each had a real cause; two were the app.

- **`squads-three-boards.spec.ts:152`** (the Relay match to a result; desktop): two causes.
  - **App:** the strip of tiny boards (`shownMatches`) hid every finished match once any match of a later round
    existed. The next round's match is created, in its 20 s break, the moment both its squads are known, so your own
    match and its winner's check marks went within a second of the result (measured: 0.8 s). **Fix:** the latest round
    counts only once one of its matches has begun; until then the round just played stays, results and all.
    `spectateDefault` keeps picking from every match not over (the final the moment it's made).
  - **Test lobby:** `bots=strong` bots still made a random move 2% of the time (`botRandomMoveChance`), so the test's
    mate in one was sometimes not played and the match ran on past the test's wait. **Fix:** `bots=strong` also means
    no random move (`NO_RANDOM_MOVES`; test lobbies only).
  - The test now also checks the marks once the match is over and the next round waits (it failed every time without
    the strip fix).
- **`town-leave.spec.ts:144` and `:193`** (the circus's card; phone): a tap meant for Babur's Circus met Babur strolling
  in front of it (or landed while the camera glided), so his card opened; it then covers the circus's tap point, so every
  later tap landed on his card (the CI trace: his card open for all 20 s; locally, one tap hit his "Challenge alone").
  **Fix (test):** `openCard` closes any open town card with Escape before tapping, as `town.spec.ts`'s already did.
- **`squads-watch.spec.ts:167`** (who's watching; phone): **app.** `notWatchers` (the board's own players, never shown as
  watchers) used `myBoards().you`, which for a squad's waiting seat on 3 boards is the board of its next move. When the
  seating made Wes the waiting seat with his next move on Tess's board (the CI snapshot's turn order: "Wes, in 3"), his
  pawn was hidden. **Fix:** only the players whose move this turn is on the board are left out.

Lane: targeted. `e2e/dash.spec.ts` left alone (open PRs #560, #561 change it).
