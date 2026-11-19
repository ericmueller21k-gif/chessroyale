# The Battle Tower (designed; being built)

Lane: the director (the rules: `god-king`; the floor art: `characters`; saving: the director, full lane). **Built so far: the
board layer (PR 1); every boss on it (PRs 2-5); several bosses in the match runner (PR 6: a runner option, `settings.bossIds`); the
climb's rules (PR 8: core `tower.ts`, a floor's start from the deal; no screens or saving yet).**
The design, its calls settled with Eric (Nov 18): [docs/decisions/2026-11-18-battle-tower-design.md](../decisions/2026-11-18-battle-tower-design.md).

## What it will be

- A climb of up to 99 floors (a skyscraper), alone or as a party of up to 4, next to Auto chess under home's Other modes. Each floor is
  one game from the starting position against 1, 2 or 3 bosses at once on one board (the pattern 1, 2, 2, 3 looping), taking turns
  to move, each with its own powers and meter, stronger every floor: Maia from 600, +100 a floor, to 2500 (a lone boss +200);
  from floor 51 Stockfish from 2500, +25 a floor, to full strength.
- Every boss's moves are in, a few with a one-line rule; Hollow and Smudgy never share a floor, and for now neither do Smudgy + Alfil, Alfil + Jefferson and Dash + Smudgy (Nov 19); the Hidden Boss isn't in the tower.
- You play White (random sides later). One loss (or a draw, or leaving) ends the run. Every floor is one snug room in HunChess's colors (the town's
  challenge room as the model: `town/shops/challenge.ts`), its number big on both side walls; you walk in to the board and the
  floor's bosses come out of the top door. Between floors you may stop: the run is saved on the server (guests too) and resumes
  on that floor; a solo floor rejoins after a reload.
- A party picks every move: the most picked is played, a tie goes to the engine's best (`partyMove`), the Boss Battle party's
  no-pick rules.
- Built on **the board layer** (`packages/chess/src/board-layer.ts`, built Nov 18): one state per square, edge and piece, every
  boss's marks at once, the most restrictive winning, one "always a legal move" lift; today's bosses move onto it with no change
  to any boss battle (PRs 2-5).

## The board layer (built)

- **Marks:** square (`noLand`, `noPass`, both a wall, neither drawn: fire), edge (`across: "straight"`: rank and file moves only;
  `"all"`: every move whose line meets it, corners included), piece (`held`, `shieldFrom: "pawns" | "all"`, or drawn); each with
  `binds` ("both", "crowd", "bosses": the layer's `crowd` says which side is the crowd's), `until` (its last crowd turn) and `by`.
- **Functions:** `movePaths` (castling's king and rook, Chess960's too), `layerStop` (the first mark that stops a legal move:
  held, squares, edges, shields), `layerMoves` (`{ moves, lifted }`), `followLayer`, `wearLayer`, `mergeLayers`. Sawyer's
  `edgeOf` and `moveEdges` live here now.
- Calls made: [2026-11-18-board-layer.md](../decisions/2026-11-18-board-layer.md).

## Several bosses in the runner (built, PR 6)

- **The side:** `settings.bossIds` (2-3 ids, the order they take turns) starts a raid with them all, from the starting position; never
  two `BATTLE_TOWER.apart` keeps apart (Hollow and Smudgy; Smudgy + Alfil, Alfil + Jefferson, Dash + Smudgy for now: `docs/decisions/2026-11-19-tower-apart-pairs.md`). `MatchState.bosses` holds each one's own part (`BossOwn`: id, strength,
  powers); `state.boss` is always the boss in focus in full, with the battle's shared fields, so every boss's code runs as alone.
  `state.moved`: who made the side's last move.
- **The focus:** the bosses to move: the boss whose move comes out of turn (`BossRules.outOfTurn`: Wrangler's duel reply, Folio's
  move again after Revision), else the boss after the one who moved. The crowd to move: the boss to move next (his turn change),
  or Hollow while his second move is due.
- **Each crowd turn:** every boss's `prepareTurn` (passive, meter at `BATTLE_TOWER.rageScale`); each one's ultimate step only at his
  own turn change (after his move for a `triggerAtHisTurn` ultimate, before it for the rest), one ultimate a turn change. **An
  ultimate that can't wait** (`BossRules.ultimateNow`, Nov 19: Chandy's last chance, a mate in one open as your turn begins) runs
  its step first at any turn change, the others waiting but one the boss who just moved prepared (Wrangler's line-up is on the
  board already); its boss then holds the crowd's turn (`focusNow`), so his Dodge plays as at his own turn change. Its question
  reads the side's allowed moves (`TurnContext.crowdMoves`: every boss's steps on a copy, worked out only when a mate is on the
  board): docs/decisions/2026-11-19-ultimate-now.md. A hook reading a meter outside a step reads the floor's rates
  (`Battle.rageRates`: Folio's `creaseDue`).
- **The side's rules:** the dispatcher's `sideCrowdAllowed` (every boss's marks merged, every `crowdFilter`, one lift, the barred
  move), `sideBossAllowed` (every mark binding the bosses, his own `bossStops`, the others' `sideStops`), the judge, fair play, the
  Last Stand, and the moments queue (the view's `events`: every boss's, the one in focus first).
- **Every move reaches every boss:** after the crowd's move every boss's `afterCrowdMove` (from the boss who moved last: Folio's
  Revision may cross the move out, and then the others never see it), each with its judged numbers; after a boss's move (his extra
  move, the leapfrog hop) every other boss's `followMove`, and the mover's `followedBy` when one changed (Folio's Revision never crosses
  that move out); after every boss's turn and crowd move every boss's `followBoard` (a tracked piece another boss's power moved is let
  go). A move of the side is named as any boss on it masks it (`sideMoveName`: Smudgy's hidden rook stepped as a pawn, "d6"). A
  hook's `bossToMove()` is true only for the boss whose turn it is (`hisTurn`).
- Calls made: [2026-11-18-several-bosses.md](../decisions/2026-11-18-several-bosses.md).

## The climb (built, PR 8)

- **Core `tower.ts`**, plain data and pure functions for the server to save (PR 9): `floorBossCount` (`BATTLE_TOWER.pattern` looping),
  `floorStrength(floor, bosses)` (Maia `maiaStart` + `maiaStep` a floor, held at Maia's top; a lone boss `soloBonus` more, within
  the caps; Stockfish from `stockfishFrom` at `stockfishStart` + `stockfishStep`, held at `ENGINE_MAX_ELO` on floor 79, its best from
  80), `towerPool(off)` (every playable boss: never the hidden one or one in the game for admins first; minus the kill switches).
- **A run** (`TowerRun`: `seed`, `floors` dealt so far, the last the floor to fight, `deck`, `decks`, `status` open, top or out):
  `newRun(seed, pool)`, `startFloor(run, pool)` (the only way into a floor: its bosses from the deal, dealt again if the pool no longer
  allows them; its runner settings), `finishFloor(run, "won" | "lost" | "drawn", pool)` (a win deals the next floor; floor 99 won:
  top; a loss or draw: out), `leaveFloor(run, crowdMoves)` (free before your 2nd move, `leaveFreeBefore`, else a loss).
- **The deal:** a seeded deck of the pool, in order, a new deck when it runs out: every boss once before any twice, never the same boss
  on two floors in a row, never an `apart` pair (a deck that would leave a pair waiting at its end is shuffled again).
- **In the runner** (`settings.towerFloor`, set by `startFloor`): every boss at the floor's strength (`elo` the floor's rating, no
  offset or difficulty; the brain Maia at that rating for one player or a party alike, Stockfish from floor 51; "best" from 80). A side
  core's `sideRefusal` refuses still throws in `startSide` (test switch, tests); a room never gets there (finding 7).
- Calls made: [2026-11-19-tower-climb-rules.md](../decisions/2026-11-19-tower-climb-rules.md).

## The audit

An independent auditor (Fable, high) checks the build three times (after PRs 6, 10 and 12): its brief is
[battle-tower-audit.md](battle-tower-audit.md). Audit 1 (after PR 6): [its report](../decisions/2026-11-19-battle-tower-audit-1.md);
findings 1-6 and the nits fixed in one PR (docs/decisions/2026-11-19-tower-audit-1-fixes.md); finding 7 (what the deal must not
take from `startSide`) fixed in PR 8 (above).

## Where the code will be

| Part | Files (planned) |
| --- | --- |
| The board layer | `packages/chess/src/board-layer.ts` (built; exported through `boss-powers.ts`); the dispatcher reads it (`limitCrowd`, `bossAllowed`, `bossStopped`, `boardAltered`) through each boss's `layer` hook: held pieces from PR 2, shields (Don Dough's gold, Chandy's shields) from PR 5, square marks (pies, toy blocks, plants, Chandy's beam and scatter, Don Dough's dough) from PR 3 |
| Several bosses on one board | built: `MatchState.bosses`, `focus`, `moved` (`packages/core/src/match.ts`); the runner's side section (`sideBosses`, `startSide`, `prepareSide`, `focusNow`); the dispatcher's `side*` functions (`boss-powers.ts`); `BATTLE_TOWER.rageScale` and `apart` (`settings.ts`) |
| The climb | built: core `tower.ts`, `BATTLE_TOWER` in `packages/core/src/settings.ts`; the runner's `towerStrength` (`settings.towerFloor`) |
| Saving | `packages/server/src/tower.ts` (`tower_runs`, `tower_best`), `account-data.ts`, the sign-in merge |
| The party | Boss Battle's party (`PartyCore`, kind "tower", max 4), the lobby on the draw rule "party" |
| The screens | the tower's screen, the tower's room (the challenge room's walking and seating), the boss bar for 2-3 bosses; the home card in `screens/Home.tsx` |

## Tests (planned)

`packages/chess/test/board-layer.test.ts` (every mark, overlaps, the lift, castling, promotion, en passant); each family's twin
(today's rule, frozen, against the layer over seeded battles: `held-layer-twin.test.ts` for the held pieces, `square-layer-twin.test.ts` for the square marks, `shield-layer-twin.test.ts` for the shields); the boss kit (`packages/chess/test/boss-kit.test.ts`) and `e2e/boss-smoke.spec.ts` guard every boss
moved onto the layer; `boss-kit-side.test.ts` runs the kit over every pair and a sample of threes (and audit 1's seeds), `several-bosses.test.ts` the side's
rules (Chandy's last chance in every order, Folio's crease line at the floor's rates), and `boss-kit-parity.test.ts` solo against online
for every boss in a pair and two threes (more by hand: `KIT_PARITY_SIDES`); core `tower.test.ts` (the design's table, the deal over 300 seeds and two pools, the run's steps, finding 7's start) and the runner's
side of finding 7 in `several-bosses.test.ts`; `e2e/battle-tower.spec.ts` (its
`e2e/areas.json` entry).
