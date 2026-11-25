# The match: Crowd, 50 v 50 and the raid's flow

Lane: the director (the match screens are the director's; other lanes add to them only where their design says).
The bosses' rules are on [bosses.md](bosses.md), the judge on [engine.md](engine.md).

## How it works today
- **Its queue while you browse** (Nov 10; [matchmaking.md](matchmaking.md), "Stepping out of a lobby"; home's rows: [hub.md](hub.md)): the 50 v 50
  lobby's Exit with "Keep me in the queue" keeps your seat as you look around ("Searching · 50 v 50", "Solo queue · 37 of 100"); the lobby
  filling takes you in. Home's Start with bots ("Play bots?", Yes) leaves the queue for you and 99 bots at once, at your last Bot level.
- **The end screen** (Nov 20; [2026-11-20-end-screen.md](../decisions/2026-11-20-end-screen.md); replaces the XP box of Nov 9): the result screen (`screens/Results.tsx`; online, asked for by the lobby's code) shows `EndRewards` (`components/EndScreen.tsx`): XP EARNED
  counting from 0 (`END_SCREEN` in settings.ts), lobbing into the XP bar (`XP.perLevel` a bar), which fills from your old XP to the new
  (a level: it flashes, "Level 3!", on from 0), then the quests the game moved sliding to their counts; what made it under the number
  ("Win +50": never the minutes) or why there was none in its place. Every box at its size from the first frame; a tap anywhere but a
  button skips to the end; reduced motion: the end at once. Its sounds (Nov 20; [2026-11-20-end-screen-sounds.md](../decisions/2026-11-20-end-screen-sounds.md); `END_SCREEN.ping`, `levelUp`, `ding`): pings whose pitch follows the XP counted so far (`xpPingHz` in core's xp.ts: a smooth rise that a top game holds at its top), a level reached plays the steel pan level-up (shared with auto chess and a finished quest), the fill ends on one soft pan note. The reward card after it (Nov 22, [2026-11-22-inventory-layer.md](../decisions/2026-11-22-inventory-layer.md)) shows only crates and keys (`RewardBox endScreen`): centered, in the crate screens' blue window, OK and Go to inventory (your inventory as a layer over the end screen, `InventoryLayer`). The 50 v 50's middle is its podium; Classic's, its trophy. Its stage table is the column's width; with no judged move it is one line, "No moves judged this game." (Nov 25, round 2c), and the best and worst moves only with a move. The headline: "Victory!" / "Defeat" / "A draw" by your team, your place in its line. Its rules and storage: [accounts.md](accounts.md), "XP and levels".

- **The board on a computer** (Oct 29; docs/decisions/2026-10-29-desktop-board-size.md, [board.md](board.md); the 50 v 50's frame since
  Nov 26, below): the window's height less 92 px, never wider than the window leaves: 984 px at 1920 × 1080, 864 at 1920 × 960; width-bound
  from about 1440 px wide down (504 at 1280 × 800). The opening vote's board is the same size and place, so the game starts with the board
  where it was.
- **A computer's 50 v 50** (Nov 26, Eric's approved mock; [2026-11-26-crowd-frame.md](../decisions/2026-11-26-crowd-frame.md); built on
  the 1 v 1's frame): at 1100 px and up with a mouse (`CROWD_FRAME` in MatchMenu.tsx; board-size.css, "The 50 v 50's frame") three columns
  on one top and one bottom line, one 28 px gap between them (`--cf-gap`), centered: the scoreboard (340), the board (the window's height
  less 92, its box on its drawing step), the column (300, down to 280). The top row is the status line, each number under a small gray
  label (Hud.tsx `Stat`, `pickCount`; game.ts `nextCutValue`), right on the board and clear of its clock pill; no line over the board. The
  column: the power-ups row (the phone's `powerInBox`, in every phase: Play, `WatchScreen`, the reveal's `LockedPowerRow`) with the gear at
  its right end, the vote box's skeleton, the status box (always: `SlotIdle`'s gray "Waiting…" on your own pick), one 250 px slot; then the
  chat to the board's foot. The scoreboard's table and the chat end on the board's lines (`board-foot.ts`). The opening vote is the same
  frame (`cf-vote`: Vote.tsx `frame`, the match): its title the top row; its line that says what to do on the column's first line beside
  the gear (one line, from the column's left edge: every line it can say fits 236 px, the 280 column's); the cards filling the slot; then
  the game's chat (`UnderBoard`, the same component and place; chat is open from the lobby on), so the board, the scoreboard and the chat
  don't move as the game begins (round 2, [2026-11-26-crowd-vote-column.md](../decisions/2026-11-26-crowd-vote-column.md)). A phone's
  vote has no chat, as before. Guards: `e2e/desktop-board.spec.ts`, "a computer's 50 v 50 (Eric, Nov 26)…" and "Eric's column
  rule (Nov 25)…" (eric.md).
- **The vote box is a standing skeleton** (Nov 25; [2026-11-25-crowd-poll-skeleton.md](../decisions/2026-11-25-crowd-poll-skeleton.md);
  `SkeletonRows`, `SlotSkeleton` in `screens/Crowd.tsx`): the reveal's box always has its cap's rows (`useBarSlots`), the ones a round
  doesn't fill gray (`.poll-row.skel`), and a watched turn's result line gray (`.poll-result-skel`). A computer's slot shows the
  skeleton rows between reveals too (Play and `WatchScreen`), the status box at its foot (since Nov 26 always there: a gray "Waiting…" on
  your own pick, phone too). Since round 2 a phone's does too: its middle box
  (`--mid-h`, styles.css) is the power-up row (greyed through the reveal: `LockedPowerRow`), the rows, then a one-line 24 px status line
  (the waiting line, then the result line), 151 px with six rows (was 104); `--slots` (four to six, by the screen's height: 6 from 760
  px, 5 from 700, else 4) keeps the scoreboard's three-row room, and `useBarSlots` reads it. The box shows as many of the most-voted
  moves as it has rows. The played move is the pick rule's (Strong by default: the judge's best of the top three), not always the most
  voted. Guard: `e2e/crowd.spec.ts`, "50 v 50's vote box is a standing skeleton" (phone and computer).
- **A mode is a preset over one engine.** `modeSettings()` and `CROWD_SETTINGS` / `RAID_SETTINGS` in settings.ts
  patch `DEFAULT_SETTINGS`. Two are played on these screens:
  - **Crowd 50 v 50** (the main mode): 100 players, one board, two teams of 50, each playing one side all game. Every
    player picks a move on their team's turns; one of the team's **3 most-picked** moves is played, drawn by their picks
    (`drawRuleByStage: ["popular"]` with `crowdPlayedFromTop: 3`, `crowdTopOdds`: 30 / 15 / 5 plays 60% / 30% / 10%; moves
    tied across 3rd place are left out; a boss battle keeps the most popular; Nov 2,
    docs/decisions/2026-11-02-crowd-bot-spread.md). **A big majority always wins** (Eric, Nov 4; `crowdSureShare` 0.7):
    a move with 70% or more of the team's real picks is played, always, a blunder too (7-2-1 plays the 7; 6-3-1 draws).
    The reveal's line adds the played move's chance when it wasn't sure.
    Bots fill empty seats (see [matchmaking.md](matchmaking.md)); each plays at its own rating ("The bots" below). Always team turns (`crowdTeams` in
    `CROWD_SETTINGS`): the "everyone moves" choice went on Oct 15, 2026 (DECISIONS.md).
  - **Boss raid** (`RAID_SETTINGS`, `crowdTeams: false`): up to 50 people (no bots online) pick the crowd's moves
    together against a boss, from the starting position. Solo's "Boss alone" is a raid with a crowd of one. See
    [bosses.md](bosses.md).
- **Scoring.** Every pick is scored by how much expected score it gives away against the best move (1 point = 0.01 of
  expected score), from the judge's numbers. A miss scores `missedMoveScore` (in 50 v 50, the AFK rule below). Scores carry over all game in Crowd. A
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
- **The AFK rule (50 v 50; Eric, Nov 4; `CROWD_MISSES`, docs/decisions/2026-11-04-crowd-votes-afk.md).** A miss gets a
  pick made for it, one of the engine's top `defaultFromTop` (5) at random by the position and the player (`hashPick`:
  nothing drawn from the match's random source), kept in `defaultMove` with `move` still null, so it never counts in the
  tally, the draw, the average or the sure share; nobody on the team picked, the team plays one of those at random (team
  turns only; a final's mover and a boss battle as before). It scores the lowest round score of anyone in the group who
  picked (`scoreGroup`; nobody picked: `missCaps` as before). The reveal's line says "Missed: a move was picked for you (1 of
  3)" (`missLine` in `game.ts`; "Missed: picked for you (1 of 3)" under 380 px; the finals' "missed (2 of 3)"; `missNo` on
  the result and `NetPick`). More than `allowed` (3) misses in the game (the 4th) and you're removed for being away
  (`MatchRunner.awayOut`, `RoundReport.away`): online `LobbyCore.leaveMatch(h, "afk")`, solo `SoloMatch.removeAway`, as
  resigning (a loss, out in the last place still open, a bot in the seat where one takes it); the results read "Removed for
  being away" and "You missed 4 moves. Out in Nth place of 100."; home's note if you come back. Bots never miss. Test switch
  `?afk=0` (solo, a lobby you create, a test pool's PLAY): misses as before, for tests that idle on purpose.
- **Pre-game votes (50 v 50, `augments`).** Before move 1 everyone votes by dragging their pawn into one of three zones
  on an empty board (or tapping a zone, which puts your pawn there, Eric, Nov 2; one shared piece, `VoteZoneHits`, in every pawn vote since Nov 25; or tapping a card; the zone takes the tap, never the board
  under it). The options are words only: their emoji (on the cards, the zones and the winner's banner) were deleted (Eric, Nov 2; Squads'
  votes, on the same screen, too; docs/decisions/2026-11-02-nov2-fixes-b.md): how it ends (**team final**, **the Hidden Boss** (the boss final), **duel**), then
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
- **The vote cards fill upward** (Eric, Nov 26; [2026-11-26-vote-card-fill.md](../decisions/2026-11-26-vote-card-fill.md)): no bar;
  each card's fill rises from its foot to its share of all the votes (`.vote-card-fill`, `scaleY`), the count at its foot, the box
  unchanged; phone and computer. Guard: `e2e/vote-hint.spec.ts`, "50 v 50's vote (Eric, Nov 26)…".
- **How it starts** (Eric, Oct 24; docs/decisions/2026-10-24-opening-vote.md): the second vote. Each option's patch sets
  `crowdStart` and `openingMoves`; `MatchRunner.patchSettings` then sets the board up before move 1 (`setUpStart`), one
  start for the one board everyone shares. **Normal**: the starting position (nothing drawn: the board as made).
  **Random opening**: a balanced named line from the library, `CROWD_START.randomOpeningMoves` (4) moves a side in, drawn as
  Classic's boards are (`pickOpenings`, inside `openingBalance`, never in check since Nov 26); the board's history holds the opening's moves, so the
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
  1 v 1's) shows "Drag your pawn into a zone to vote" over the board just under the zones (above them it covered the middle
  zone's name tag: Eric, Nov 26) until they vote; never again
  on that device (`VoteHint`, `brc.voteHintSeen`; `FirstVoteHint` in `screens/Vote.tsx`, one per vote). e2e
  `vote-hint.spec.ts`.
- **The zones' name tags** (Eric, Nov 25, look B of the mockup): on every pawn vote on `VoteScreen` (this one's and Squads'), a
  small dark tag (the `.vote-banner` look, a thin gold rim, a pointer down) names each zone above it as the vote opens: it rises
  in, bobs gently and lifts away over `VOTE_TAGS.showMs` (3 s) from the vote's start, and fades in `goneMs` (0.3 s) the moment
  your vote is in. It floats over the board and takes no taps, so nothing moves; long names take two lines; reduced motion:
  no bob. 1 v 1 keeps its own labels above its zones, no tags. `components/VoteZoneTags.tsx`, `vote-tags.css`; e2e
  `votes.spec.ts` ("the zones' name tags"). [2026-11-25-vote-labels.md](../decisions/2026-11-25-vote-labels.md).
- **The endings.** Each leaves `crowdFinalists(format)` players (the lobby less `CROWD_KNOCKOUTS[format]`). Team final:
  `teamFinalSizes` players a side, the weakest out every `teamFinalMovesPerStep`. **The boss final** (Eric, Oct 14):
  always the Hidden Boss, the top 4 against him (the duel's cuts, stopping at four), for everyone, solo and online; his
  card in the vote is his roster name and icon ("Hidden Boss", 📕) with "Top 4 team up against him" (`bossFinalOption`
  in `votes.ts`: renaming him is one edit, in `BOSS_ROSTER`). The rule: `BossDef.crowdFinal` and `crowdFinalBoss()`
  (`boss.ts`), which the runner's `startBoss` meets whatever boss was picked or met last; he stays hidden from players
  everywhere else (`adminOnly`). **His child first** (Nov 13, solo and online; the settings' `recluseChild`, from
  `RECLUSE_FORMS` in `modeSettings("crowd")`): no powers (the God King's help works), Maia from `RECLUSE_CHILD.startRating`
  rising every `everyPlies` moves on the board to his top (online, each move request carries the rating and Stockfish's
  stand-in, `runner.childRatingNow` and `bossEloNow`); his level shows and climbs. Beaten, his fall (`RECLUSE_CHILD.fallMs`:
  he grows up), then one new match against the man from the starting position, for everyone (`runner.nextBossForm()`, his
  intro again); the boy winning or drawing ends the fight. `?form=adult` (a lobby test switch) starts at the man. **The man**
  is his phase 1 (from the starting position, Maia at its top, raw, the God King blocked, no strikes, the bullet clock;
  [bosses.md](bosses.md)). **Online** the lobby runs both through the shared runner, his brain on the host's device; the
  man beaten, the board holds for his collapse (the boss message's `fall`), then the results (`timeout` when he won on time).
  **Phase 2 online** (Nov 13): the man beaten, his phase change and the four boards follow for the top 4 (the server's, as
  his room's fight: bosses.md, "Phase 2 online"); the others watch. The scoreboard keeps the top 4 in from his fall until the
  results, each board's result on its row as it ends, the others out (Nov 14: bosses.md, "The scoreboard through phase 2").
  **Solo** (you and bots), if you reached him, his phase 2 follows as in Boss alone, the other
  three finalists on the other boards (`phase2Follows`, `phase2Mates` in `recluse-phase2.ts`). No reward comes from this
  path (rewards only via Squads: ROADMAP.md). Duel: the last two. `finalMaxTurns` caps a final; the engine
  adjudicates.
- **The bots** (Nov 1; docs/decisions/2026-11-01-bot-lobby.md; Eric: "mostly about 800 to 1500, some range above and
  below", "a player making the engine's best moves should finish 1st or 2nd"). Each bot has a rating fixed by its name
  (`botRatingOf`: `BOT_LOBBY.ratings`, a bell curve around 1150, 600 to 2200, in steps of 100), the same player every
  match, and picks Stockfish-style (`botPick` over the judge's top moves) at the temperature that rating plays like
  (`botSkillForRating`, `BOT_LOBBY.skillAt`: a Maia player's points given away a move at that rating, matched in the
  Crowd). `botRoster` seats them everywhere a lobby is filled (solo, online, Squads, a Solo raid). Not Maia: about
  0.75 s of Maia a team turn on a computer, about 3 s on a phone (`reports/crowd-bots.md`). Test:
  `reports/crowd-bots.md` (its sim, `crowd-bots-sim.ts`, retired with the old 50 v 50 in C4).
  **Solo's Bot level** (Nov 9; [2026-11-09-home-modes-bot-level.md](../decisions/2026-11-09-home-modes-bot-level.md)): home's Bots asks
  the bots' average (`BOT_LEVELS`: 700, 950, 1150 = the curve above, 1500, 1900, your own rating, or Random, uniform 600 to 2200), carried
  as `Settings.botLevel` into `botStrength` (each bot's rating fixed by name + level; the curve narrows near 600 and 2200 so a level's
  average holds). Solo only: online lobbies' bots are as above.
  **In 50 v 50 they spread over the good lines** (Nov 2; `CROWD_BOTS`, `botLean`, `botPickSpread` in core/match.ts;
  docs/decisions/2026-11-02-crowd-bot-spread.md; Eric: "unique lines favored over optimal play"): each team turn draws
  one shared lean from the turn's seed (a focus on the engine's numbers and a taste per line, the same for every bot of
  the team), then each bot weighs the first 5 lines under 15 points by exp(-focus x loss / T + taste) and any other line
  far lower; a bot holding a power-up uses it on a sharp turn only 25% of the time (before, all of them at once: the
  unanimous castles). Online the lean rides in the judge job's rules (`JudgeRules.crowdBots`). Report:
  reports/crowd-spread.md (its probe retired with the old 50 v 50 in C4).
- **Test switch `?weakbots=1`** (solo, and a lobby you create; `WEAK_BOTS`): every bot plays loosely (`WEAK_BOT_SKILL`:
  a temperature of 8 points or more, `botStrength`; since Nov 1 every bot is that loose anyway), and people rank above bots in the standings (`peopleFirst`), so every cut takes
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
  its foot. The ⚡ row sits at its top and the status slot under it is 42 px in every phase (empty while picking; Nov 8,
  `crowd.spec` "the match screen's rows never move"), the bars take turns in the rest. The scoreboard starts 4 px under it and fills the
  rest of the screen, and never moves. Its header reads Black · White · All · Chat (yours picked when the match starts;
  tapping the picked one or the rows opens the full list for that pick). Chat replaces the scoreboard in the same box;
  "‹ Back" returns to the pick. The reveal has no "your team watched" line any more. The box is one element for the
  whole match (Nov 1: each phase's screen used to build it anew, and its rows wiped in; `KeptBox`, QuickChat.tsx;
  docs/decisions/2026-11-01-crowd-steady-box.md); "Black" starts in line with "POS".
  It shows as many rows as fit (`pickRows`, most important first; a row that doesn't fit is skipped, not the end of the list:
  Nov 26, docs/decisions/2026-11-26-scoreboard-rows-skip.md), four at least at 390 × 750.
  Guards: `e2e/crowd.spec.ts`, "the scoreboard never moves" and "the scoreboard box is built once"; `e2e/panel.spec.ts`,
  "a phone's 50 v 50 box".
- **On screen:** every pick appears live on the board as a ghost with a name pill (one name per square, "+N"), live
  tallies, an optional motion trail (Settings → Board), the eval bar (off for everyone since Nov 1: [hub.md](hub.md)), the scoreboard
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
  - **Away:** gone longer than `LEAVING.awayMs` (120 s) is resigning (`sweepAway`); in 50 v 50 so is the 4th miss in a game (the AFK rule, above); a move locks once everyone still
    here has moved (`roundDone`). Nobody left: the match ends at once and the lobby closes (`wrapUpIfEmpty`).
- **The 50 v 50 rework (Eric, Nov 16; `notes/designs/crowd-rework.md` on `design/crowd-rework`): every 50 v 50 plays it since
  step C2** (`CROWD_SETTINGS` takes `CROWD_REWORK`; docs/decisions/2026-11-16-crowd-rework-core.md and
  2026-11-16-crowd-rework-runner.md). Where it differs from the older paragraphs on this page (the endings, the top-3 draw and its
  sure share, CROWD_STAGE_ROUNDS' cuts), it wins; those paragraphs stand for `CROWD_PRE_REWORK` (the old draw's settings stay for
  Majority mode, Eric, Nov 17; the FAQ reads the rework since C3). C4 retired the old endings' tests and sims (2026-11-17-crowd-rework-c4.md). One game to its end (mate, a draw by the rules, or after Black's move 60 the judge's verdict:
  75%+ wins; `MatchRunner.endGameIfOver`, called by the lobby and solo after each reveal and before each deal, ahead of any cut: a
  game over on a cut's move cuts nobody; a finished board is never replaced); no endings. The vote "How are moves picked?" (`CROWD_VOTES`,
  held where `crowdCuts` is set) replaces "How does it end?": **Strong** (the judge's best of the team's 3 most-picked, or one within
  3% of it, drawn; nobody votes), **Majority** (the old draw since Nov 17: 70% of the real picks or more plays, always;
  else one of the top 3 by their picks; `majorityOf`, Eric's rule "a big majority always wins"), **Chaos** (`crowdPickOdds`). Cuts by the game's move number (`CROWD_CUTS`: after 14,
  18, 22, 26, 30, 33, 39, 42, leaving 34, 23, 15, 10, 6, 4, 2, 1 a side; `crowdStageRounds`), counted from each cut's keep with
  today's tie rules; then the 1 v 1, an ordinary stage. Survivors keep 50% at each cut (`crowdCarry`, 2 decimals). The end's places
  (`finishGame`): those still in first, the winning side's then the losing side's (a draw: together), by score; each cut's below.
  `crowdPodium`: the winner (1st of a won game) and `bestPlayer` (fewest counted points a move among those who survived half the cuts
  made, never one who left: `PlayerState.leftAt`, set by `retire` and by `handOver` once a move is played). Online the results carry
  them (`podium`) and each standings row's `outAtMove` and `perMove` (`MatchRunner.crowdResults`); the vote message its `id`, which
  the app looks votes up by (`heldVotes`). No shared-blunder relief with 4 or fewer real picks (`sharedMinPicks`, the director's
  call). After the last cut there are no stage ends (`stageComplete`); the top bar says "1 v 1".
  **The screens (C3, docs/decisions/2026-11-17-crowd-rework-c3.md):** the top bar counts down (`cutCountdown` in `game.ts`: "cut in
  2", "4 v 4 next" on a cut's own move, "1 v 1 from move 43" through the 2 v 2, then "1 v 1"; to 480 px `shortCountdown`'s
  "to 4v4" and "1v1 at 43", the line there being about 60 px); one "1 V 1!" banner on the 1 v 1's
  first turn (`OneVOneBanner`, Crowd.tsx; the boss battles' `FightBanner`); the cut screen out (`CutOut`, mockup `crowd-cut`): your
  place and the gap to your team's last one through, "Why was I cut?", a fixed still-in box (each side's count and names, the stages
  to come: `stagesAhead` / `stagesLine`), and at its foot **Spectate** and **Leave the match**, side by side, always both, sticky at the
  bottom, in the same place every cut. Spectating is the watch screen ("you're watching", no premoves): online the server sends a cut
  player the watching rounds, tallies and reveals (`LobbyCore.spectatorsWatch`), and not tapping either spectates once the break
  ends; solo plays on before you once you tap Spectate (`watchesToEnd`), else the rest is played out at once to your result, as
  before (unit `packages/app/test/solo-cut-out.test.ts`). The results (`components/Podium.tsx`, mockup `crowd-podium`): the
  mode line, how the game ended (`endWords`), the podium (2nd, 1st tallest, 3rd; each player's own dressed pawn, name, points a move;
  "Winner" and "Best player" tags), a fixed best-player line, your row (place, out at move, points a move, RP's spot greyed until
  C5) and the chart of all 100 in a 330 px box that scrolls inside, your row pinned at its foot. Solo the rows' `outAtMove` / `perMove`
  come from `runner.crowdResults()` (`SoloMatch.crowdRows`), online from the results message; the phase carries `podium`. 50 v 50 has no flag fall (an empty
  bank still gets its increment; a side's last seat always goes to a bot). Test switches: `?limit=N` (the move limit), and `?format=`
  only skips the votes.
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

The rework's (in `CROWD_SETTINGS` since C2): `CROWD_REWORK`, `CROWD_CUTS`, `CROWD_PICK`, `CROWD_BEST`, `CROWD_SCORING.sharedMinPicks`;
`CROWD_PRE_REWORK` (the old 50 v 50: no screen or FAQ reads it since C3; C4 retired the rest). Majority mode reads `crowdSureShare` and `crowdPlayedFromTop` (Nov 17).
`OPENING_ALLOWANCE` (points, flatThrough, goneBy, materialPawns), `CROWD_MISSES` (the AFK rule), `crowdSureShare`, `CROWD_SCORING` (the cap and its stages and curve, the piece bar, the shared-blunder relief, streaks, rare finds, a miss, the bubble grace), `RAID_SCORING` (50 v 50's, the cap by crowd move, streaks on live moves only, no bubble), `BOSS_ALONE_SCORING`, `CROWD_START` (the start vote's random opening length), `LEAVING` (the away time, the seat's bot, the app's wait for an answer), `DEFAULT_SETTINGS`, `CROWD_SETTINGS`, `RAID_SETTINGS`, `CROWD_KNOCKOUTS` (and `crowdFinalists`), `QUICK_PACE`
(the `?pace=quick` test switch, per mode; players always play the mode's own pace), the clock (`timeBankSeconds`, `timeIncrementSeconds`, `moveClockSeconds`;
`moveClockSteps` for a rising clock, unused today), the vote keys (`voteSeconds`, `voteBotSkip`, …), `teamFinal*`. The
time controls themselves are in the vote data (`PREGAME_VOTES` in `votes.ts`).

## Tests and tools

- The opening allowance and ties: unit `packages/core/test/opening-allowance.test.ts` (the taper, counted against raw,
  brilliance on raw), `cut-ties.test.ts` (ties go through, what's owed carries, the endings' sizes, the last cut's
  tie-break, 50 v 50's teams, the boss's tied strike), `packages/chess/test/exchange.test.ts`
  (the exchange check: hanging, a missed capture, a gambit, en passant, promotion, a capture with check; two judges
  agree), `runner.test.ts` (Classic's boards with ties kept in), `packages/app/test/faq.test.ts`. Sim:
  `packages/sim/scripts/opening-allowance.ts` (the calibration, `reports/opening-allowance.md`).
- The rework: unit `packages/core/test/crowd-rework.test.ts` (each pick mode, the schedule to the 1 v 1, the carry,
  rounds of 2 and 1 a side, the relief from 5 picks, the places, best player, the move limit), `votes.test.ts` (the pick vote),
  `cut-ties.test.ts` (cuts by keep: ties, what's owed, a short side), `crowd-bot-spread.test.ts` (Strong over bots' picks);
  `packages/chess/test/crowd.test.ts` ("the 50 v 50 rework (C2)": to move 60, a mate on a cut's move, who left),
  `packages/server/test/lobby.test.ts` ("the 50 v 50 rework online"), `resign.test.ts` ("the 50 v 50 rework (C2)").
  The screens (C3): unit `packages/app/test/results-rows.test.ts` ("the 50 v 50 rework's words"), `faq.test.ts` ("the 50 v 50
  rework (C3)…"); e2e `crowd.spec.ts` (the top bar's "34 v 34 next"; "online, once you're out…": the out view, the foot fixed from
  cut to cut, spectating after the break; the full match's podium at 320 / 390 / 1280).
- 50 v 50's bots and played move: unit `packages/core/test/crowd-bot-spread.test.ts` (a team at lobby ratings never all
  picks one move, Eric's castle included; the plurality moves between good lines; the top-3 odds and ties; the draw),
  `packages/chess/test/judge.test.ts` (the lean from the seed alone), `packages/server/test/lobby.test.ts` (the live
  window leads with the played move).
- 50 v 50's sure majority and the AFK rule: unit `packages/core/test/crowd-afk.test.ts`, `packages/chess/test/crowd.test.ts`
  ("50 v 50's misses"), `packages/server/test/resign.test.ts` ("50 v 50's AFK rule"); e2e `e2e/crowd.spec.ts` ("50 v 50's
  AFK rule": the line at 390 and 320 px, the removal).
- 50 v 50's scoring: unit `packages/core/test/crowd-scoring.test.ts` (the cap's shape and its stages, pieces uncapped,
  the shared relief's thresholds, streaks and their start and ramp, a miss, rare finds and the switch, the bubble grace
  and what carries, 2 decimals), `packages/app/test/faq.test.ts`; e2e `e2e/crowd-scoring.spec.ts` (the fire's tiers,
  steady rows and no spill at 320 and 1280, reduced motion; the shoutout and its bonus, the board still);
  `reports/crowd-scoring.md` (its sims retired with the old 50 v 50 in C4).
- A raid's scoring: unit `packages/core/test/raid-scoring.test.ts` (raids on and Boss alone off, the cap by crowd move,
  streaks on live moves only, the strike by points given away and its tie-break); e2e `e2e/boss-dock.spec.ts` (the dock's
  line to 2 decimals in a Solo raid); the sim `packages/sim/scripts/raid-scoring-trace.ts` (records Maia raids through
  the runner) and `raid-scoring-sim.ts` (re-scores and re-strikes them under each variant: `reports/raid-scoring.md`).
- The start vote: unit `packages/core/test/votes.test.ts` (its cards, default, patches, `?start=`), `packages/chess/test/opening-vote.test.ts`
  (each start's board, seeded, the balance window, a Freestyle game through the runner, castling both ways, the snapshot),
  `packages/server/test/lobby.test.ts` ("the start vote online": Freestyle and Random opening, castling, a lobby that
  sleeps), `packages/app/test/board-logic.test.ts`, `faq.test.ts`; e2e `e2e/opening-vote.spec.ts`.
- Unit: `packages/core/test/match.test.ts`, `scoring.test.ts`, `votes.test.ts`, `brilliance.test.ts`,
  `packages/chess/test/crowd.test.ts`, `runner.test.ts`, `replay-cache.test.ts`, `long-match.test.ts`. The clock vote:
  `votes.test.ts` (each time control, the bank math, the calibration), `crowd.test.ts` (the runner) and
  `packages/server/test/lobby.test.ts` ("the clock vote online"); e2e `votes.spec.ts` (Bullet's clock, solo and online)
  and `formats.spec.ts` (the cards set the clock).
- Resigning: `packages/server/test/resign.test.ts`, `lobby-life.test.ts`, `packages/chess/test/crowd.test.ts` ("who left");
  e2e `e2e/resign.spec.ts` (Boss alone, a Solo 50 v 50, Squads, an online raid; phone and computer).
- The boss final (the Hidden Boss): unreached since C2, its tests retired in C4 (`crowd.test.ts`' boss finals,
  `crowd-hidden-boss.test.ts`, `e2e/crowd-hidden.spec.ts`); his code stays. His room's fight keeps its own tests
  (`packages/server/test/recluse-online.test.ts`, `e2e/hidden-boss-room.spec.ts`, `e2e/recluse.spec.ts`).
- e2e: `e2e/crowd.spec.ts`, `formats.spec.ts`, `votes.spec.ts`, `match-screen.spec.ts`, `panel.spec.ts`,
  `solo.spec.ts`, `multiplayer.spec.ts`, `castling.spec.ts`, `perf.spec.ts`.
- Frames: `npm run frames:boss` (one move, real taps), `frames:flash` (white flashes), `frames:vote`, `frames:chat`.
- Perf: `npm run perf:boss -- <dir> crowd phone 25`.
- Sims: `npm run simulate` (`reports/playtest.md`), `format-sim.ts`.

## Rules for this area (from `.claude/LESSONS.md`)

- Watch any change to a board, a move or an animation frame by frame with real taps, including the plain move.
- No opacity entrance on screens that replace each other; the board's size and canvases are set up in layout effects.
- When one screen hands the board to the next, both give it the same frame; measure the board's box on both.
- Overlays on squares size themselves in eighths of the board's own size (`--board-size`), never % of the wrap.
- Board coordinates sit inside their edge squares, either way up; measure each label against its square (`expectCoordsInSquares`).
- Check one-line rows at 360 px with their widest real content (names, six-digit scores).
- Nothing read while rendering may grow with the match; never replay from move 0 (`fenAtPly`).
