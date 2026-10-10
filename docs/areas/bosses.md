# Bosses and their powers

Lanes: `god-king` (the template, the powers' rules, server side and screens), `characters` (each boss's art,
moments, lines and sounds), `engine` (the boss's chess strength). The God King himself is on
[god-king.md](god-king.md).

## How it works today

- **Where bosses are met:** the boss raid (up to 50 people, online; or a Solo raid with 49 bots), the Crowd 50 v 50's
  boss-battle ending (the last 10), and solo's "Boss alone" (you pick every move against a boss you choose from the
  boss menu, at a difficulty from Easy to Hardest, `BOSS_DIFFICULTY`).
- **The roster is a template** (`BOSS_ROSTER` in `packages/core/src/boss.ts`): each boss has an id, a name, an icon,
  a character kit (its art, moments, lines and sounds, by name), an Elo `offset` (nastier powers play a little weaker
  underneath) and its powers: a **passive** and an **ultimate**. Only a **playable** boss (`isPlayable`: a complete
  kit and powers) is ever chosen, in every mode. A random boss avoids the one met last (`chooseBoss`; online, the boss
  most of the lobby met last).
- **Strength:** Stockfish at a UCI_Elo from the crowd's ratings, the raid's tiers or solo's difficulty, plus the boss's
  offset, with the blunder guard (see [engine.md](engine.md)).
- **The ground rules of every power** (the server decides, the same everywhere):
  - Every power comes from the battle's seed (drawn once, as it starts) and the position, so the server, the solo game
    and every screen work out the same thing (`powerRoll`).
  - A power never leaves anyone without a legal move and never breaks check: a restriction that would leave no move
    (or no escape from check) lifts for that turn. The king is never frozen.
  - The judge plays by the same rules: the best move is the best of the allowed ones.
  - A turn the boss plays for the crowd (the funhouse) isn't scored; any turn a power touches doesn't count for fair
    play (`powerTurn`).
  - The clock stands still through every power's moment (`POWER_FX`, `powerMomentMs`): the crowd's clock starts after
    them, solo and online, so a power never costs anyone thinking time.
  - Turns are the crowd's: turn N is the crowd's Nth move of the battle.
- **The rage meter** fills over time (`ragePerMove` a crowd move, up to `rageAheadMax` more while the crowd is ahead on
  the judged eval) and with the boss's own material lost (a queen's worth fills it). Full: a "RAGE!" warning, then the
  ultimate as the next crowd turn begins, once a match. Hollow's Lights out and Big Boy's Big Bounce come at the start
  of the boss's turn instead (Lights out's only warning is the full meter).
- **The bosses:**

| Boss (id) | Opening | Passive | Ultimate |
| --- | --- | --- | --- |
| Ginger (`gingerbread`) | the game so far | **Freeze:** a crowd piece (never the king, one that matters: a pick from the top three) iced for `freezeTurns`, every `freezeEvery` turns from turn 2 | **Blizzard:** for one turn only the queen moves (no queen, or she can't: the king) |
| Boingo the Clown (`clown`) | the game so far | **Pie:** an empty square near the centre that the fewest moves reach is pied for `pieTurns` (nobody, either side, may move onto it), then `pieGap` clear | **Funhouse:** he plays the crowd's move (weak but recoverable: `funhouseLoss`, never past `funhouseMaxLogit`), unscored; the board shows flipped for `flipTurns` |
| G-REX (`grex`) | the game so far | **Sparkler:** a tile on the crowd's half catches fire and burns in `fireStages` stages, one a crowd turn; a crowd piece left on it after the crowd's move on the last stage burns (never the king, never one whose loss leaves a king in check: it fizzles) | **Roman candle:** `candleShots` fireballs in waves (`candleWaves`) from `candleDelay` turns later, each wave's squares shown as growing shadows `candleAhead` turns ahead |
| Hollow (`hollow`) | always Black, from the starting position (he claims the dark side in the intro if the crowd would have been Black) | **The dark:** after his first move he covers the square of the piece he moved, then another every `darkEvery`-th move (a random occupied square, never a king's) for `darkTurns`; pieces there are hidden; a move touching the dark goes unchecked, an illegal one costs `darkTryCost` and the `darkTries`-th ends the turn as a miss | **Lights out:** at the start of his turn, a memory test in rounds (`lightsOutRounds`: find 1, 2, then 3 of his pieces); each piece missed costs `lightsOutMiss`; below `lightsOutHold` found, he plays an extra quiet move (`lightsOutExtraGain`) |
| Big Boy (`bigboy`) | from the starting position less the crowd's d- or e-pawn, which he eats (his snack) | **Toy blocks:** every `blockEvery` turns from turn 2, a block on an empty square in the crowd's half that a crowd piece could move to, for `blockTurns`; nothing (either side) may move onto it or slide through it; a knight jumps it; it never stops an attack | **Big Bounce:** at the start of his turn (after the warning), `bouncePieces` crowd pieces thrown to empty squares within `bounceReach` (pawns sideways), into a position `bounceLoss` pawns worse for the crowd (nearest `bounceTarget`) |

- **Test switches:** `?boss=<id>` picks the boss; `?power=<id>` brings its ultimate early (warned as turn 2 begins,
  unleashed on turn 3; its passive as usual); admins see "Trigger ultimate (testing)" in any boss battle
  (`ultimateTestButton`, `triggerUltimate`: the ultimate as the next crowd turn begins, no warning).
- **Same for everyone online:** what a boss does and says on screen comes only from the shared match state
  (`boss-beats.ts`): one-shot animations play once per moment from when the device first saw it, loops run by the
  clock, lines are picked by a hash of the moment. No new protocol for a boss's looks.

## Where the code is

| What | Where |
| --- | --- |
| The roster, the playable rule, choosing a boss, strength | `packages/core/src/boss.ts` |
| Every power's rules (allowed moves, each turn's powers, after-move effects, visibility, judging with allowed moves) | `packages/chess/src/boss-powers.ts` |
| Timings the server and the screens share (`POWER_FX`, each boss's beats) | `packages/chess/src/boss-timing.ts` |
| The battle in the match runner (the snack, Hollow's side, the dark's tries, the fire, the funhouse, Lights out, the extra move, the bounce, the boss view) | `packages/chess/src/runner.ts` |
| Online: the server's side | `packages/server/src/lobby.ts` (the boss's turn, the funhouse/extra/bounce requests to the host, Lights out's rounds), `protocol.ts` |
| Solo | `packages/app/src/solo.ts` |
| Each boss's art and sounds | `packages/app/src/characters/<boss>.ts`, `<boss>-sounds.ts`; registered in `characters/index.ts`; the kit (animations per moment, lines, portrait) in `characters/kits.ts` |
| Power art: each power's moment and effect sprites | `characters/power-art.ts`, `characters/effects.ts`, `components/BossEffect.tsx` |
| Powers on screen (ice, pie, fire, dark, blocks, banners, the rage meter) | `components/BossPowers.tsx`, `BigBoy.tsx`, `LightsOut.tsx` |
| The boss screen | `packages/app/src/screens/Boss.tsx` |
| The boss menu's power words | `packages/app/src/power-words.ts` |

## Settings

`BOSS_POWERS` in `packages/core/src/settings.ts` (every power's numbers), the `boss*` keys of `Settings`,
`BOSS_DIFFICULTY`, `BOSS_TIERS` and each boss's `offset` in `boss.ts`.

## Tests and tools

- Unit: `packages/chess/test/boss-powers.test.ts`, `grex.test.ts`, `hollow.test.ts`, `bigboy.test.ts`,
  `long-match.test.ts`, `packages/core/test/boss.test.ts`, `packages/server/test/boss-powers-lobby.test.ts`,
  `packages/app/test/boss-kits.test.ts`, `characters.test.ts`, `boss-character.test.ts`, `gingerbread.test.ts`,
  `grex.test.ts`, `hollow.test.ts`, `bigboy.test.ts`, `fire-replays.test.ts`, `power-words.test.ts`.
- e2e: `e2e/boss-powers.spec.ts`, `grex.spec.ts`, `hollow.spec.ts`, `bigboy.spec.ts`, `boss-character.spec.ts`,
  `perf.spec.ts`.
- Frames: `npm run frames:powers -- <dir> [gingerbread|clown|grex|all|both] [phone|desktop|both]`, `frames:hollow`,
  `frames:bigboy`, `frames:character -- <dir> [boss] [phone|desktop|both]`, `frames:wip`.
- Previews: `npm run preview:characters -- <dir>` (GIFs and sheets of every boss and effect).
- Perf: `npm run perf:boss -- <dir> <boss id> [phone|desktop|both] 25`.
- Sims: `packages/sim/scripts/boss-sim.ts`, `boss-blunders.ts` (`reports/boss-sim/`, `reports/boss-calibration.md`).

## Rules for this area (from `.claude/LESSONS.md`)

- Anything that changes the position outside a move (a burn, a snack, a bounce) leaves a base, and nothing replays a
  board's history from move 0: use `fenAtPly(history, ply, bases)`. Grep for `fenAfter(` and `.history` and check each.
- Never change what chessground draws (orientation, size) while a transform is on it or an ancestor.
- An effect that can appear many times at once goes on a shared canvas (`BoardEffects`), never a loop per sprite.
- Measure a new effect's first showing on a slowed phone; draw many new frames ahead, a slice a frame; make a boss's
  sounds before their cue; nothing a boss needs only in its battle is made when the app loads.
- Nothing read while rendering may grow with the match; run `npm run perf:boss` late in the match.
- Tables keyed by a closed set (powers, events) are typed by it (`Record<PowerId, …>`).
- Text a player must read to play (Lights out's prompt) stays on screen as long as it applies, outside the speech box.
