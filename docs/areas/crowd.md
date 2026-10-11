# The match: Crowd, 50 v 50 and the raid's flow

Lane: the director (the match screens are the director's; other lanes add to them only where their design says).
The bosses' rules are on [bosses.md](bosses.md), the judge on [engine.md](engine.md).

## How it works today

- **A mode is a preset over one engine.** `modeSettings()` and `CROWD_SETTINGS` / `RAID_SETTINGS` in settings.ts
  patch `DEFAULT_SETTINGS`. Three modes are played:
  - **Crowd 50 v 50** (the main mode): 100 players, one board, two teams of 50, each playing one side all game. Every
    player picks a move each turn; the **most popular** pick is played (`drawRuleByStage: ["popular"]`). Bots fill
    empty seats (see [matchmaking.md](matchmaking.md)).
  - **Crowd "everyone moves"** (`crowdTeams: false`): everyone picks for whichever side is to move; a 2v2 final of the
    last four.
  - **Boss raid** (`RAID_SETTINGS`): up to 50 people (no bots online) pick the crowd's moves together against a boss,
    from a named opening 5 moves in. Solo's "Boss alone" is a raid with a crowd of one. See [bosses.md](bosses.md).
- **Scoring.** Every pick is scored by how much expected score it gives away against the best move (1 point = 0.01 of
  expected score), from the judge's numbers. A miss scores `missedMoveScore`. Scores carry over all game in Crowd. A
  **brilliant** move is one that separated the field (among enough pickers); a pick made after a power-up's hints
  can't be brilliant.
- **The cut.** After each stage (`firstStageRounds`, then `roundsPerStage`) the lowest scorers are knocked out
  (`knockoutsPerStage`; in 50 v 50 the same number from each team). The cut is a judgement: every player's pawn in a
  10 × 10 grid, the gavel, the verdict, "Why was I cut?" (the elimination breakdown). `stageBreakSeconds` 10.
- **Pre-game votes (50 v 50, `augments`).** Before move 1 everyone votes by dragging their pawn into one of three zones
  on an empty board (or tapping a card): how it ends (**team final**, **boss battle**, **duel**) and how fast it is
  (normal 20 s, variable, …). The options and what they change are plain data in `packages/core/src/votes.ts`.
  Non-voters (and `voteBotSkip` of the bots) join the winner.
- **The endings.** Team final: `teamFinalSizes` players a side, the weakest out every `teamFinalMovesPerStep`.
  Boss battle: the last 10 against a boss (the God King joins). Duel: the last two. `finalMaxTurns` caps a final; the
  engine adjudicates.
- **Power-ups:** 3 at the start in Crowd (`powerUpsAtStart`); one shows the engine's top 3 moves for that turn.
- **On screen:** every pick appears live on the board as a ghost with a name pill (one name per square, "+N"), live
  tallies, an optional motion trail, the eval bar (unless switched off in Settings: [hub.md](hub.md)), the scoreboard
  and chat under the board. A crowd of one keeps its
  move on the board (no ghost, no snap-back). The board never moves between screens.
- **Classic** (64 players, 8 boards, rotating) still runs but is frozen: Eric will rework it; don't invest in it.

## Where the code is

| What | Where |
| --- | --- |
| Stages, grouping, the cut, retirement, bot picks (pure) | `packages/core/src/match.ts` |
| Scoring, brilliant moves | `packages/core/src/scoring.ts` |
| Pre-game votes | `packages/core/src/votes.ts`; screen `packages/app/src/screens/Vote.tsx` |
| The match runner (rounds, judging, the boss battle) | `packages/chess/src/runner.ts` |
| Boards and their positions (bases, replays) | `packages/chess/src/boards.ts`, `rules.ts` (`fenAtPly`) |
| The lobby protocol | `packages/chess/src/protocol.ts` |
| Solo (in the browser) / online | `packages/app/src/solo.ts` / `packages/app/src/net.ts`; screens see both through `game.ts` |
| Screens | `packages/app/src/screens/` (`Play`, `Crowd`, `Reveal`, `StageBreak`, `Final`, `Results`, `Hud`, `Spectate`) |
| The board and its overlays | `components/Board.tsx`, `CrowdGhosts.tsx`, `EvalBar.tsx`, `Breakdown.tsx`, `Gavel.tsx`, `ShadeMoves.tsx` |
| Online lobby flow | `packages/server/src/lobby.ts` (pure), `lobby-do.ts` (the Durable Object) |

## Settings

`DEFAULT_SETTINGS`, `CROWD_SETTINGS`, `RAID_SETTINGS`, `CROWD_KNOCKOUTS`, `CROWD_EVERYONE_KNOCKOUTS`, `PACE_SETTINGS`
(relaxed/quick; tests use quick), `VARIABLE_CLOCK`, the vote keys (`voteSeconds`, `voteBotSkip`, …), `teamFinal*`.

## Tests and tools

- Unit: `packages/core/test/match.test.ts`, `scoring.test.ts`, `votes.test.ts`, `brilliance.test.ts`,
  `packages/chess/test/crowd.test.ts`, `runner.test.ts`, `replay-cache.test.ts`, `long-match.test.ts`.
- e2e: `e2e/crowd.spec.ts`, `formats.spec.ts`, `votes.spec.ts`, `match-screen.spec.ts`, `panel.spec.ts`,
  `solo.spec.ts`, `multiplayer.spec.ts`, `castling.spec.ts`, `perf.spec.ts`.
- Frames: `npm run frames:boss` (one move, real taps), `frames:flash` (white flashes), `frames:vote`, `frames:chat`.
- Perf: `npm run perf:boss -- <dir> crowd phone 25`.
- Sims: `npm run simulate` (`reports/playtest.md`), `packages/sim/scripts/crowd-sim.ts`, `format-sim.ts`.

## Rules for this area (from `.claude/LESSONS.md`)

- Watch any change to a board, a move or an animation frame by frame with real taps, including the plain move.
- No opacity entrance on screens that replace each other; chessground and canvases are set up in layout effects.
- When one screen hands the board to the next, both give it the same frame; measure the board's box on both.
- Overlays on squares size themselves in eighths of chessground's board (`--cg-size`), never % of the wrap.
- Check one-line rows at 360 px with their widest real content (names, six-digit scores).
- Nothing read while rendering may grow with the match; never replay from move 0 (`fenAtPly`).
