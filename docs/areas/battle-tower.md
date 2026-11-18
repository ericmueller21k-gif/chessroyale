# The Battle Tower (designed, not built)

Lane: the director (the rules: `god-king`; the floor art: `characters`; saving: the director, full lane). **Nothing is built yet.**
The design and its calls, waiting for Eric's OK: [docs/decisions/2026-11-18-battle-tower-design.md](../decisions/2026-11-18-battle-tower-design.md).

## What it will be

- A climb of 12 floors (a skyscraper), alone or as a party of up to 4, next to Auto chess under home's Other modes. Each floor is
  one game from the starting position against 1, 2 or 3 bosses at once on one board (blocks of 1, 2, 2, 3), taking turns to move,
  each with its own powers and meter, their Maia rating rising from 600 to 1800.
- Every boss's moves are in except the Hidden Boss's (a few with a one-line limit; Hollow and Smudgy never share a floor).
- You play White (random sides later). Three hearts a run. Every floor is one snug room in HunChess's colors (the town's
  challenge room as the model: `town/shops/challenge.ts`), its number big on both side walls; you walk in to the board and the
  floor's bosses come out of the top door. Between floors you may stop: the run is saved on the server (guests too) and resumes
  on that floor.
- A party picks every move: the most picked is played, a tie goes to the engine's best (`partyMove`), the Boss Battle party's
  no-pick rules.
- Built on **the board layer** (`packages/chess/src/board-layer.ts`, first): one state per square, edge and piece, every boss's
  marks at once, the most restrictive winning, one "always a legal move" lift; today's bosses move onto it with no change to
  any boss battle.

## Where the code will be

| Part | Files (planned) |
| --- | --- |
| The board layer | `packages/chess/src/board-layer.ts`; the dispatcher reads it (`boss-powers.ts`) |
| Several bosses on one board | `MatchState.bosses` (`packages/core/src/match.ts`), the runner and `prepareTurn` per boss |
| The climb | core `tower.ts`, `BATTLE_TOWER` in `packages/core/src/settings.ts` |
| Saving | `packages/server/src/tower.ts` (`tower_runs`, `tower_best`), `account-data.ts`, the sign-in merge |
| The party | Boss Battle's party (`PartyCore`, kind "tower", max 4), the lobby on the draw rule "party" |
| The screens | the tower's screen, the tower's room (the challenge room's walking and seating), the boss bar for 2-3 bosses; the home card in `screens/Home.tsx` |

## Tests (planned)

`board-layer` unit tests; the boss kit (`packages/chess/test/boss-kit.test.ts`) and `e2e/boss-smoke.spec.ts` guard every boss
moved onto the layer, and run over pairs and threes of bosses; core `tower` unit tests; `e2e/battle-tower.spec.ts` (its
`e2e/areas.json` entry).
