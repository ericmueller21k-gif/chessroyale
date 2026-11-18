# Boss Assists (designed, not built)

Lane: the director (the rules: `god-king`; the screens: the director). **Nothing is built yet.** The design and its calls, waiting
for Eric's OK: [docs/decisions/2026-11-18-boss-assists-design.md](../decisions/2026-11-18-boss-assists-design.md).

## What it will be

- A 1 v 1 game of chess (a bot on the device if nobody comes), next to Auto chess under home's Other modes.
- Each side is dealt three random bosses at the start (the reveal): two give a normal move, one its ultimate. A meter fills as
  you play; on your turn you arm an assist you can afford and it lands as the opponent's turn begins. Its boss picks the target
  as it does in a raid (you as the boss, the opponent as the crowd); nothing is picked by a player.
- Only moves whose pick is a pure function of the position and the seed are in (no engine search, no whole-turn moves, no move
  played for anyone, no cinematics): the list, boss by boss, is in the design.
- What assists do to movement goes on **the board layer** (`packages/chess/src/board-layer.ts`, to be built first): one state per
  square (open, no landing, a wall, …), edge (a saw cut, the board saw) and piece (held, shielded, marked), both players' marks
  at once, the most restrictive winning, and one "always a legal move" lift. Today's bosses move onto it too, one family a PR,
  with no change to any boss battle.

## Where the code will be

| Part | Files (planned) |
| --- | --- |
| The board layer | `packages/chess/src/board-layer.ts`; the dispatcher reads it (`boss-powers.ts`: `limitCrowd`, `bossAllowed`, `stopReason`) |
| The assist rules | `packages/chess/src/assists/` (the list, `dealAssists`, the meter, `castAssist`, the steps); `BOSS_ASSISTS` in `packages/core/src/settings.ts` |
| The game | the 1 v 1's game object with a mode (`packages/server/src/duel-do.ts`, `duel-room.ts`), queue `assists-default`; `duel/rules.ts` gains `bases` and a move filter; `duel/protocol.ts` v2 carries `assists` |
| The screens | the 1 v 1's (`screens/Duel.tsx`, `components/DuelStage.tsx`, `duel.ts`'s `NetDuel` and `BotDuel`) with the reveal and the assist bar; the home card in `screens/Home.tsx` |

## Tests (planned)

`board-layer` unit tests; the boss kit (`packages/chess/test/boss-kit.test.ts`) and `e2e/boss-smoke.spec.ts` guard every boss
moved onto the layer; the assist rules' unit tests and fuzz; `e2e/boss-assists.spec.ts` (its `e2e/areas.json` entry).
