# The match: Crowd, 50 v 50 and the raid's flow

Lane: the director (the match screens are the director's; other lanes add to them only where their design says).
The bosses' rules are on [bosses.md](bosses.md), the judge on [engine.md](engine.md).

## How it works today

- **The board on a computer** (Oct 29; docs/decisions/2026-10-29-desktop-board-size.md, [board.md](board.md)): the window's height
  less 170 px (the title line, the line over the board, the row under it), never wider than its column: 904 px at 1920 × 1080
  (the scoreboard 360 px on the left, the column 340 on the right); width-bound from about 1440 px wide down (456 at
  1280 × 800, as before). The opening vote's board is the same size, so the game starts with the board where it was.
- **A mode is a preset over one engine.** `modeSettings()` and `CROWD_SETTINGS` / `RAID_SETTINGS` in settings.ts
  patch `DEFAULT_SETTINGS`. Two are played on these screens:
  - **Crowd 50 v 50** (the main mode): 100 players, one board, two teams of 50, each playing one side all game. Every
    player picks a move on their team's turns; the **most popular** pick is played (`drawRuleByStage: ["popular"]`).
    Bots fill empty seats (see [matchmaking.md](matchmaking.md)). Always team turns (`crowdTeams` in
    `CROWD_SETTINGS`): the "everyone moves" choice went on Oct 15, 2026 (DECISIONS.md).
  - **Boss raid** (`RAID_SETTINGS`, `crowdTeams: false`): up to 50 people (no bots online) pick the crowd's moves
    together against a boss, from the starting position. Solo's "Boss alone" is a raid with a crowd of one. See
    [bosses.md](bosses.md).
- **Scoring.** Every pick is scored by how much expected score it gives away against the best move (1 point = 0.01 of
  expected score), from the judge's numbers. A miss scores `missedMoveScore`. Scores carry over all game in Crowd. A
  **brilliant** move is one that separated the field (among enough pickers); a pick made after a power-up's hints
  can't be brilliant.
- **The opening allowance** (Eric, Oct 15; docs/decisions/2026-10-15-opening-allowance-and-ties.md;
  `OPENING_ALLOWANCE`, `reports/opening-allowance.md`). A pick's **counted loss** is its raw loss less
  `openingAllowance(n)`: `points` (8) through move `flatThrough` (10), then in a line to nothing at `goneBy` (14). `n`
  is the game's own move number (the position's fullmove number), the same in every mode: Crowd from move 1, a raid
  from move 6, Classic's boards from move 5 (and a replaced board's again), the Crowd's boss final from move 1 of its
  fresh board. **The material fallback:** a pick that gives up `materialPawns` (1) or more against the engine's best
  move by the exchange check (`exchangeNet`, `materialSlips` in `packages/chess/src/rules.ts`: its own small board,
  one capture and the exchange on its square, about 0.15 ms a move) gets no allowance (`material`: "gave" or
  "missed"). The runner works it out in `resolveBoard` (`allowanceFor`: only while the allowance applies, only the
  distinct picks), after the bosses' rules have adjusted the numbers (`judgeEvaluation`), and hands `scoreGroup` each
  pick's allowance. Counted losses make the round scores (and the group average), standings, cuts, the boss's strikes
  (`finalLosses`), `matchLoss` (`countedLossSum`) and final placements; **raw** losses stay for the board's draw,
  brilliance, ratings and fair play (`lossesByStage`), and a miss costs as before. Bots unchanged. The reveal says it
  in one line of plain words, one number at most (`allowanceNote` in `game.ts`; a phone's 50 v 50 reveal shortens it to
  `allowanceShort`: "8 forgiven", "no allowance"): "1.2 forgiven · opening", "8 of 9.6
  forgiven · opening", "no allowance · gave up material", "no allowance · missed a capture" (Crowd under the poll,
  Classic under the round score, a boss battle as the dock's second line, shortened under 380 px: "8 of 9.6
  forgiven", "no allowance"); the breakdown says what counted, and the group's average as it counted. Squads isn't scored per move: untouched.
- **50 v 50's scoring** (Eric, Oct 23; docs/decisions/2026-10-24-crowd-scoring.md; `CROWD_SCORING` in settings.ts, as
  `crowdScoring` in `CROWD_SETTINGS`, off in Classic; raids have their own, below; measured with Maia players in
  `reports/crowd-scoring.md`).
  `scoreGroup` shapes each round score when it gets a `ScoreContext` (the runner's `scoreContext`: the stage, whether
  streaks count, each player's streak): a losing pick many made counts less (`sharedFactor`), then the round score goes
  through a soft cap that widens by stage (`softCap`, `capFor`: `cap` from `capFrom`; `capCurve`), except that a pick
  giving up a piece by the exchange check (`uncapPawns`: the runner's `allowanceFor` marks it all game, `uncap`) keeps a
  minus score whole; a strong move (raw loss within `streakStrong`) adds to the player's streak, and from `streakFrom` in
  a row earns `streakBonus` on top of the capped score (`streakCounts`: from the `streakFromMove`th picked move on the
  usual start, the first in Random opening and Freestyle; picked moves count from the board's dealt opening, never the
  game's move number); a miss scores `missCaps` times the cap below zero. Every round score is kept to 2 decimals
  (`round2`); the screens show 2 (`scoreDp`). After power-ups are marked, `MatchRunner.finishRound` runs `crowdBrilliant`:
  a rare find (`brilliance` with `brilliantMinGap`; `brilliantMaxFound` or fewer found it, exactly one when
  `brilliantFewLeft` or fewer picked) adds `brilliantBonus` to the finders and sets `result.brilliant`, which the
  reveal shows as a mark on its bar ("‼ +1", "+1 each" for several finders; its label names the finders; online the
  reveal message's `brilliant`). The
  standings carry `streak` from `streakFrom` (`NetStanding.streak`), and the scoreboard draws our own fire as a badge on the
  rank square's corner, never in the name's cell, so a name keeps all its room (`components/StreakFire.tsx`, in `RaceTower`'s `.t-pos`: orange, red from 2 more, a white-blue core from 4 more; a flicker, still under reduced
  motion). A phone's 50 v 50 reveal puts the streak ("🔥+0.50") in its one result line; the others' reveal adds "+0.50
  streak bonus" under your score, and "not capped · gave up a piece" after the allowance.
  Test switches (solo): `?streaks=1` (every seat on a streak, 3 to 9), `?shoutout=1` (your first pick gets a shoutout).
- **A raid's scoring** (Eric, Oct 25: "Raids should use the 50 v 50 math"; docs/decisions/2026-10-25-raid-scoring.md;
  `RAID_SCORING` in settings.ts, `RAID_SETTINGS.crowdScoring`; measured with Maia raids in `reports/raid-scoring.md`):
  50 v 50's math (the shared relief, the soft cap, pieces uncapped, streaks and the fire, rare finds, a miss at 2 caps, 2
  decimals), the whole crowd as one team. A raid has no cuts, so its cap widens by the crowd's move instead of the stage
  (`capFromMove`: the runner's `scoreContext` passes the boss battle's crowd move, 1 up, and `capFor` reads it when the
  scoring has `capFromMove`). A raid plays on in decided games, where every move is "strong", so a move counts for
  streaks only when the crowd gave away `streakMinAverage` or more on average by raw loss; otherwise a streak neither
  grows nor ends (unset in 50 v 50). No bubble (`cutGrace` 0: nothing is cut). The boss's strike goes by the points given
  away, not by these ([bosses.md](bosses.md), "The strike"). Online raids and a Solo raid (Raid with bots) score this
  way; **Boss alone** keeps the old scoring (`BOSS_ALONE_SCORING`, put over the settings by `SoloMatch` when a raid has
  no bots).
- **The cut.** After each stage (`roundsInStage`: Classic `firstStageRounds`, then `roundsPerStage`; 50 v 50 its own
  list, `stageRounds`) the lowest scorers are knocked out (`knockoutsPerStage`; in 50 v 50 the same number from each team).
  **50 v 50's cuts** (Eric, Nov 1: fewer, bigger cuts, longer rounds; docs/decisions/2026-11-01-crowd-cuts.md):
  `CROWD_STAGE_ROUNDS` [20, 10, 8, 8, 6, 6, 6, 4] plies, so cuts after moves 10, 15, 19, 23, 26 and 29 taking
  `CROWD_KNOCKOUTS` 30, 22, 16, 12, 8 and 4 (100 → 70 → 48 → 32 → 20 → 12 → 8: the team final from move 30), then 4
  after move 32 (the boss final's four) and 2 after move 34 (the duel). A test's `?rounds=N` empties `stageRounds`, so
  every stage is N rounds. The top bar counts down in moves, as the board numbers them ("Move 12 · cut in 4"; "cut now"
  on the stage's last move). **Ties at the line go through** (`cutPlan` in
  `match.ts`): everyone tied exactly (`sameScore`) with the last player through stays in (in 50 v 50 so does anyone within
  `cutGrace` of them, the bubble grace, except at the last cut); nobody goes out on thinking
  time or a coin flip. What that leaves over is owed by the cuts still to come, spread evenly over them (`cutCarry`, per
  team in 50 v 50; each cut takes its share rounded up), so the endings keep their sizes and no one cut takes a
  pile-up of owed places. **The last cut before a fixed-size ending** (`isLastCut`) takes exactly what's owed: an exact tie
  there goes to less raw loss over the match (`rawLossTotal`, a miss counting `finalMissLoss`), then less thinking time
  (over the match in Crowd, the stage in Classic), then a coin. `standings()` orders by the same keys, so a cut is always
  the bottom of the list. The team final's steps break a tie the same way. Classic keeps enough boards for its
  survivors (`ceil(survivors / groupSize)`, never fewer than the plan's). Every screen draws the line from the runner:
  `cutoff()` (how many would go through now) and each standing's `cut` flag (a team's line in 50 v 50, `towerView`).
  The cut is a judgment: every player's pawn in a 10 × 10 grid, the gavel, the verdict ("N out · M left", or "Nobody
  out, ties go through"), "Why was I cut?" (the elimination breakdown: "level with the last player through" only at the
  last cut, with why). `stageBreakSeconds` 10.
- **Pre-game votes (50 v 50, `augments`).** Before move 1 everyone votes by dragging their pawn into one of three zones
  on an empty board (or tapping a card): how it ends (**team final**, **the Hidden Boss** (the boss final), **duel**), then
  "How does it start?" (**Normal**, **Random opening**, **Freestyle**; Normal when nobody votes; below), then "How fast?", a
  chess time control (**Bullet 3+2**, **Blitz 5+3**, **Rapid 10+5**, left to right; Blitz when nobody votes). The options and what
  they change are plain data in `packages/core/src/votes.ts` (a time control is one `timeControl(...)` entry: its bank,
  increment and cap; the card's label and blurb are made from them). **Every vote's options keep one order** on every
  screen, every game (Eric, Oct 13): the data's order, left to right; a speed vote Bullet on the left, the longest on
  the right (Eric, Oct 16; slowest-left until then). From Black's side the
  board turns but the order doesn't: the zones are taken the other way round (`voteZoneFor`), and the cards never
  flip. A default is named by its option's id (`optionIndex`), never by its place. Non-voters (and `voteBotSkip` of the bots) join
  the winner, then the winner's banner; each result shows `voteResultSeconds` (4.2 s since Eric's Oct 15 "every banner a
  second longer"; was 3.2). `?speed=bullet|blitz|rapid` skips the vote for tests (old ids map over: normal → rapid, variable →
  blitz; an unknown id gets Blitz).
- **How it starts** (Eric, Oct 24; docs/decisions/2026-10-24-opening-vote.md): the second vote. Each option's patch sets
  `crowdStart` and `openingMoves`; `MatchRunner.patchSettings` then sets the board up before move 1 (`setUpStart`), one
  start for the one board everyone shares. **Normal**: the starting position (nothing drawn: the board as made).
  **Random opening**: a balanced named line from the library, `CROWD_START.randomOpeningMoves` (4) moves a side in, drawn as
  Classic's boards are (`pickOpenings`, inside `openingBalance`); the board's history holds the opening's moves, so the
  game's move number (and the opening allowance) starts at 5, and a phone new to the board replays them from the start,
  whether it first watches or plays (`WatchScreen` replays through `useReplay` too, Oct 25; the Animations setting doesn't
  change it: docs/decisions/2026-10-25-opening-with-animations-off.md).
  **Freestyle** (FIDE's name for Chess960; the only name players see): a Chess960 start drawn from the match's own random
  source, never the usual one (`freestyleStart`), in a base at ply 0 (`freestyleBoard`, opening `FREESTYLE_OPENING`), so
  every replay, the history and a restored lobby start there; the rules, the judge (Stockfish's `UCI_Chess960`, from the
  position's castling field), the bots and the board's castling (the king onto its rook, or onto its g/c square) are
  Chess960's (`chess960.ts`). A game that ends before the final restarts from another start of the same kind
  (`replaceBoard`). The team final and the duel play on the same board; **the boss final is always from the usual
  starting position** (the Hidden Boss starts there anyway; any boss after a Freestyle game does too). The vote message
  carries `start` (Freestyle's position) so the pieces that drop in after the last vote are the game's. `?start=normal|random|freestyle`
  sets it for tests (with `?format=`, like `?speed=`; an unknown id is Normal).
- **The first-time hint** (Oct 16): the first pawn vote a player meets on a device (any mode: this one, Squads' or
  1 v 1's) shows "Drag your pawn into a zone to vote" over the board just above the zones until they vote; never again
  on that device (`VoteHint`, `brc.voteHintSeen`; `FirstVoteHint` in `screens/Vote.tsx`, one per vote). e2e
  `vote-hint.spec.ts`.
- **The endings.** Each leaves `crowdFinalists(format)` players (the lobby less `CROWD_KNOCKOUTS[format]`). Team final:
  `teamFinalSizes` players a side, the weakest out every `teamFinalMovesPerStep`. **The boss final** (Eric, Oct 14):
  always the Hidden Boss, the top 4 against him (the duel's cuts, stopping at four), for everyone, solo and online; his
  card in the vote is his roster name and icon ("Hidden Boss", 📕) with "Top 4 team up against him" (`bossFinalOption`
  in `votes.ts`: renaming him is one edit, in `BOSS_ROSTER`). The rule: `BossDef.crowdFinal` and `crowdFinalBoss()`
  (`boss.ts`), which the runner's `startBoss` meets whatever boss was picked or met last; he stays hidden from players
  everywhere else (`adminOnly`). His rules there are his phase 1 (from the starting position, Maia at its top, raw, the
  God King blocked, no strikes, the bullet clock; [bosses.md](bosses.md)). **Online** the lobby runs them through the
  shared runner, his brain on the host's device; beaten, the board holds `RECLUSE_FALL_MS` for his collapse (the boss
  message's `fall`), then the results (`timeout` when he won on time). **Phase 2 isn't online:** phase 1 won is the
  crowd's victory there. **Solo** (you and bots), if you reached him, his phase 2 follows as in Boss alone, the other
  three finalists on the other boards (`phase2Follows`, `phase2Mates` in `recluse-phase2.ts`). No reward comes from this
  path (rewards only via Squads: ROADMAP.md). Duel: the last two. `finalMaxTurns` caps a final; the engine
  adjudicates.
- **Test switch `?weakbots=1`** (solo, and a lobby you create; `WEAK_BOTS`): every bot plays loosely (`WEAK_BOT_SKILL`:
  a temperature of 8 points or more), and people rank above bots in the standings (`peopleFirst`), so every cut takes
  bots first and a test's player surely reaches the boss final's top 4. Loose bots alone stopped doing it on Oct 15: the
  opening allowance leaves them level with the engine's best move, and one pick the judge's final numbers rank above it
  then decides the strict last cut (docs/decisions/2026-10-16-flaky-e2e-batch-2.md). Never for players.
- **Online, the vote's result** patches the app's settings as the server's (`NetMatch`'s "vote"), so the last cut names
  the right ending and the leaderboard's cut line follows the right knockouts (a reload mid-match falls back to the
  queue's settings: the team final's).
- **The clock is a chess time control** (Eric, Oct 13): a **time bank** for the match (`timeBankSeconds`), an
  **increment added at the start of every move** (`timeIncrementSeconds`) and a **cap** on any one move
  (`moveClockSeconds`, read through `moveClockAt`), because 50 people pick together and every turn has to end. A move
  takes what you think beyond the increment out of the bank; a quicker move banks the rest, as on a chess clock (the
  bank isn't capped at its start). An empty bank still leaves the increment. The clock vote sets all three; the match is
  made with the default bank, so the vote's patch resets every bank before move 1 (`startBanks`, from
  `MatchRunner.patchSettings`). Without the vote (raids, or the `?augments=0` test switch) it's Rapid 10+5, 20 s a move. Only
  your own team's moves run your clock. The board's clock shows this move's seconds and your bank, draining live from
  bank + increment as you think; the scoreboard's BANK updates after each move. Online, each `round` message carries
  the move's cap (`moveClock`) and the increment (`increment`), so a reloaded app has them. The finals (team final,
  duel, boss battle) use the same bank, increment and cap; how many moves each bank lasts is in `DECISIONS.md`, "Crowd
  50 v 50: three chess time controls".
- **Power-ups:** 3 at the start in Crowd (`powerUpsAtStart`); one shows the engine's top 3 moves for that turn.
- **The phone's layout (Nov 1; docs/decisions/2026-11-01-crowd-phone-scoreboard.md, then 2026-11-01-crowd-phone-tabs.md):**
  the middle box under the board is one fixed height (`--mid-h`, styles.css, the locked phone screen), exactly the vote
  box's: its bars (14 px each, six at most; `--slots` steps down on short screens) and the one result line, which sits at
  its foot. The ⚡ row, the status line and the bars take turns in it. The scoreboard starts 4 px under it and fills the
  rest of the screen, and never moves. Its header reads Black · White · All · Chat (yours picked when the match starts;
  tapping the picked one or the rows opens the full list for that pick). Chat replaces the scoreboard in the same box;
  "‹ Back" returns to the pick. The reveal has no "your team watched" line any more.
  Guards: `e2e/crowd.spec.ts`, "the scoreboard never moves"; `e2e/panel.spec.ts`, "a phone's 50 v 50 box".
- **On screen:** every pick appears live on the board as a ghost with a name pill (one name per square, "+N"), live
  tallies, an optional motion trail (Settings → Board), the eval bar (testers only: [hub.md](hub.md)), the scoreboard
  and chat under the board. A crowd of one keeps its
  move on the board (no ghost, no snap-back). The board never moves between screens.
- **What the reveal draws each frame** (Oct 16; docs/decisions/2026-10-16-the-reveal-draws-only-what-changed.md):
  Crowd's reveal (`CrowdReveal`, also a raid's and the Last Stand's) keeps a clock that ticks every frame, and Classic's
  (`RevealScreen`) one that ticks 20 times a second, for what moves with them: the board and what's over it (the ghosts,
  the reel, the God King's moments), the eval bar, the board's shake. The header, the chat or scoreboard, the boss by the
  board, the board's clock and Classic's list of picks are elements kept on `useStillKey` (as on a boss screen,
  [bosses.md](bosses.md)); the dock (raids), the poll (Crowd) and Classic's words under the picks also on the few
  clock-read values they show (the move landed and played, the vote bars' count, the Last Stand's steps). A new word
  read from the clock there goes in its list; otherwise it waits up to 200 ms for the next `useStillKey` tick.
- **Resigning and leaving** (Eric, Oct 13; `LEAVING`; DECISIONS.md, "Resign: leaving a match in every mode"). The
  top line of every screen with a chessboard ends in the match's control (`components/MatchMenu.tsx`): a gear (Eric, Oct 24
  and 25: the same on a phone and a computer; docs/decisions/2026-10-24-match-menu.md and
  2026-10-25-gear-everywhere.md) that opens a list in the middle of the screen over the blurred match: Sound, Animations
  (every mode), Motion trail (a crowd match only; the vote screen's and the openings' gears too, Oct 25), Light / Dark (Nov 1:
  the same pick as Settings → Theme, shown as the theme on screen; `ThemeRow`), Resign or Leave,
  Report a bug, which asks first. On a computer the
  gear sits at the right end of the title line over the board's column, after an admin's testing items in boss battles
  (the brain's pill, which ellipsizes first, and "Trigger ultimate (testing)": `Hud.tsx`, `.match-tools`; Eric, Oct 13);
  a phone keeps those as tiny icons beside the God King (Oct 24). The list's confirms are centered too (Cancel focused).
  Before move 1 it's **Leave**; once out, **Leave the match** (also a plain button on the cut screen, Classic's watching
  and stage break, and solo's play-out: "Skip to your result"). The screens with a chessboard and no top line of their
  own (the openings, Classic's watching, a stage break, the results) carry the gear in their top right corner
  (`.mm-corner`).
  - **Solo:** the match stops at once (`SoloMatch.resign`: every timer, every step after an engine search, Maia and the
    scout), out in the last place still open (`runner.retire`), "You resigned" on the results.
  - **Online** (`LobbyCore.resign`): out in the last place still open, a loss recorded at once (`takeLeftResults`), the
    seat to a bot under a new id (`runner.handOver`; Default and private Crowd lobbies, and with Bots off only a final's
    seat or the last of a side; otherwise `runner.retire`). Before move 1 nothing is recorded (`runner.withdraw` if no
    bot sits in). Already out: their place is recorded with everyone's at the end. The match stays ranked as it was.
  - **Away:** gone longer than `LEAVING.awayMs` (120 s) is resigning (`sweepAway`); a move locks once everyone still
    here has moved (`roundDone`). Nobody left: the match ends at once and the lobby closes (`wrapUpIfEmpty`).
- **Classic** (64 players, 8 boards, rotating) still runs but is frozen: Eric will rework it; don't invest in it.

## Where the code is

| What | Where |
| --- | --- |
| Stages, grouping, the cut, retirement, bot picks (pure) | `packages/core/src/match.ts` |
| Scoring, the opening allowance, brilliant moves, 50 v 50's scoring (`scoreGroup`'s context, `crowdBrilliant`) | `packages/core/src/scoring.ts`; streaks in `applyRound` (`match.ts`); the fire `components/StreakFire.tsx`; the exchange check `packages/chess/src/rules.ts` (`exchangeNet`, `materialSlips`) |
| The cut: ties, what's owed, the last cut's tie-break | `packages/core/src/match.ts` (`cutPlan`, `standings`, `endStage`) |
| Pre-game votes | `packages/core/src/votes.ts`; screen `packages/app/src/screens/Vote.tsx` |
| The start vote's boards (Normal, Random opening, Freestyle) | `MatchRunner.setUpStart` / `freshStart` (`runner.ts`), `freestyleBoard` (`boards.ts`), `freestyleStart` (`chess960.ts`) |
| The match runner (rounds, judging, the boss battle) | `packages/chess/src/runner.ts` |
| Boards and their positions (bases, replays) | `packages/chess/src/boards.ts`, `rules.ts` (`fenAtPly`) |
| The lobby protocol | `packages/chess/src/protocol.ts` |
| Solo (in the browser) / online | `packages/app/src/solo.ts` / `packages/app/src/net.ts`; screens see both through `game.ts` |
| Screens | `packages/app/src/screens/` (`Play`, `Crowd`, `Reveal`, `StageBreak`, `Final`, `Results`, `Hud`, `Spectate`) |
| The board and its overlays | `components/Board.tsx` (the board itself: [board.md](board.md)), `CrowdGhosts.tsx`, `EvalBar.tsx`, `Breakdown.tsx`, `Gavel.tsx`, `ShadeMoves.tsx` |
| Online lobby flow | `packages/server/src/lobby.ts` (pure), `lobby-do.ts` (the Durable Object) |
| Resigning and leaving | `components/MatchMenu.tsx` (the gear and its list, the confirms), `match-exit.ts` (what it offers, its words), `SoloMatch.resign`, `NetMatch.resign`, `LobbyCore.resign` (`lobby.ts`), `runner.handOver` / `retire` / `withdraw` |

## Settings

`OPENING_ALLOWANCE` (points, flatThrough, goneBy, materialPawns), `CROWD_SCORING` (the cap and its stages and curve, the piece bar, the shared-blunder relief, streaks, rare finds, a miss, the bubble grace), `RAID_SCORING` (50 v 50's, the cap by crowd move, streaks on live moves only, no bubble), `BOSS_ALONE_SCORING`, `CROWD_START` (the start vote's random opening length), `LEAVING` (the away time, the seat's bot, the app's wait for an answer), `DEFAULT_SETTINGS`, `CROWD_SETTINGS`, `RAID_SETTINGS`, `CROWD_KNOCKOUTS` (and `crowdFinalists`), `QUICK_PACE`
(the `?pace=quick` test switch, per mode; players always play the mode's own pace), the clock (`timeBankSeconds`, `timeIncrementSeconds`, `moveClockSeconds`;
`moveClockSteps` for a rising clock, unused today), the vote keys (`voteSeconds`, `voteBotSkip`, …), `teamFinal*`. The
time controls themselves are in the vote data (`PREGAME_VOTES` in `votes.ts`).

## Tests and tools

- The opening allowance and ties: unit `packages/core/test/opening-allowance.test.ts` (the taper, counted against raw,
  brilliance on raw), `cut-ties.test.ts` (ties go through, what's owed carries, the endings' sizes, the last cut's
  tie-break, 50 v 50's teams, the boss's tied strike, the team final's steps), `packages/chess/test/exchange.test.ts`
  (the exchange check: hanging, a missed capture, a gambit, en passant, promotion, a capture with check; two judges
  agree), `runner.test.ts` (Classic's boards with ties kept in), `packages/app/test/faq.test.ts`. Sims:
  `packages/sim/scripts/opening-allowance.ts` (the calibration, `reports/opening-allowance.md`) and
  `allowance-sim.ts` (before/after Crowd matches, `reports/allowance-sim.md`).
- 50 v 50's scoring: unit `packages/core/test/crowd-scoring.test.ts` (the cap's shape and its stages, pieces uncapped,
  the shared relief's thresholds, streaks and their start and ramp, a miss, rare finds and the switch, the bubble grace
  and what carries, 2 decimals), `packages/app/test/faq.test.ts`; e2e `e2e/crowd-scoring.spec.ts` (the fire's tiers,
  steady rows and no spill at 320 and 1280, reduced motion; the shoutout and its bonus, the board still); the sim
  `packages/sim/scripts/crowd-scoring-trace.ts` (records Maia or bot matches) and `crowd-scoring-sim.ts` (re-scores them
  under every variant: `reports/crowd-scoring.md`).
- A raid's scoring: unit `packages/core/test/raid-scoring.test.ts` (raids on and Boss alone off, the cap by crowd move,
  streaks on live moves only, the strike by points given away and its tie-break); e2e `e2e/boss-dock.spec.ts` (the dock's
  line to 2 decimals in a Solo raid); the sim `packages/sim/scripts/raid-scoring-trace.ts` (records Maia raids through
  the runner) and `raid-scoring-sim.ts` (re-scores and re-strikes them under each variant: `reports/raid-scoring.md`).
- The start vote: unit `packages/core/test/votes.test.ts` (its cards, default, patches, `?start=`), `packages/chess/test/opening-vote.test.ts`
  (each start's board, seeded, the balance window, a Freestyle game through the runner, castling both ways, the snapshot),
  `packages/server/test/lobby.test.ts` ("the start vote online": Freestyle and Random opening, castling, a lobby that
  sleeps), `packages/app/test/board-logic.test.ts`, `faq.test.ts`; e2e `e2e/opening-vote.spec.ts`; the sim
  `crowd-sim.ts [matches] [start] [team|boss|duel]` (the cuts, before → after: `reports/crowd-sim.md`, Nov 1).
- Unit: `packages/core/test/match.test.ts`, `scoring.test.ts`, `votes.test.ts`, `brilliance.test.ts`,
  `packages/chess/test/crowd.test.ts`, `runner.test.ts`, `replay-cache.test.ts`, `long-match.test.ts`. The clock vote:
  `votes.test.ts` (each time control, the bank math, the calibration), `crowd.test.ts` (the runner) and
  `packages/server/test/lobby.test.ts` ("the clock vote online"); e2e `votes.spec.ts` (Bullet's clock, solo and online)
  and `formats.spec.ts` (the cards set the clock).
- Resigning: `packages/server/test/resign.test.ts`, `lobby-life.test.ts`, `packages/chess/test/crowd.test.ts` ("leaving");
  e2e `e2e/resign.spec.ts` (Boss alone, a Solo 50 v 50, Squads, an online raid; phone and computer).
- The boss final (the Hidden Boss): unit `packages/core/test/votes.test.ts` (his card, the knockouts), `boss.test.ts`
  (`crowdFinalBoss`), `packages/chess/test/crowd.test.ts` ("50 v 50 boss final"), `packages/server/test/crowd-hidden-boss.test.ts`
  (online: his brain and strength, the God King tried, the bullet clock and a loss on time, his fall then the results),
  `packages/app/test/recluse-phase2.test.ts` (phase 2 in a solo Crowd's final), `faq.test.ts`; e2e
  `e2e/crowd-hidden.spec.ts` (the card; solo through phase 2; online), `formats.spec.ts`.
- e2e: `e2e/crowd.spec.ts`, `formats.spec.ts`, `votes.spec.ts`, `match-screen.spec.ts`, `panel.spec.ts`,
  `solo.spec.ts`, `multiplayer.spec.ts`, `castling.spec.ts`, `perf.spec.ts`.
- Frames: `npm run frames:boss` (one move, real taps), `frames:flash` (white flashes), `frames:vote`, `frames:chat`.
- Perf: `npm run perf:boss -- <dir> crowd phone 25`.
- Sims: `npm run simulate` (`reports/playtest.md`), `packages/sim/scripts/crowd-sim.ts`, `format-sim.ts`.

## Rules for this area (from `.claude/LESSONS.md`)

- Watch any change to a board, a move or an animation frame by frame with real taps, including the plain move.
- No opacity entrance on screens that replace each other; the board's size and canvases are set up in layout effects.
- When one screen hands the board to the next, both give it the same frame; measure the board's box on both.
- Overlays on squares size themselves in eighths of the board's own size (`--board-size`), never % of the wrap.
- Board coordinates sit inside their edge squares, either way up; measure each label against its square (`expectCoordsInSquares`).
- Check one-line rows at 360 px with their widest real content (names, six-digit scores).
- Nothing read while rendering may grow with the match; never replay from move 0 (`fenAtPly`).
