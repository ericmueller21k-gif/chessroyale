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
| Jefferson (`grex`; G-REX until Oct 10) | the game so far | **Sparkler:** a tile on the crowd's half catches fire and burns in `fireStages` stages, one a crowd turn; a crowd piece left on it after the crowd's move on the last stage burns (never the king, never one whose loss leaves a king in check: it fizzles) | **Roman candle:** `candleShots` fireballs in waves (`candleWaves`) from `candleDelay` turns later, each wave's squares shown as growing shadows `candleAhead` turns ahead |
| Hollow (`hollow`) | always Black, from the starting position (he claims the dark side in the intro if the crowd would have been Black) | **The dark:** after his first move he covers the square of the piece he moved, then another every `darkEvery`-th move (a random occupied square, never a king's) for `darkTurns`; pieces there are hidden; a move touching the dark goes unchecked, an illegal one costs `darkTryCost` and the `darkTries`-th ends the turn as a miss | **Lights out:** at the start of his turn, a memory test in rounds (`lightsOutRounds`: find 1, 2, then 3 of his pieces); each piece missed costs `lightsOutMiss`; below `lightsOutHold` found, he plays an extra quiet move (`lightsOutExtraGain`) |
| Big Boy (`bigboy`) | from the starting position less the crowd's d- or e-pawn, which he eats (his snack) | **Toy blocks:** every `blockEvery` turns from turn 2, a block on an empty square in the crowd's half that a crowd piece could move to, for `blockTurns`; nothing (either side) may move onto it or slide through it; a knight jumps it; it never stops an attack | **Big Bounce:** at the start of his turn (after the warning), `bouncePieces` crowd pieces thrown to empty squares within `bounceReach` (pawns sideways), into a position `bounceLoss` pawns worse for the crowd (nearest `bounceTarget`) |
| Sawyer (`sawyer`) | the game so far; his first move is a pawn's, then the **split pawn**: that pawn sawn in two, a second pawn of his on an empty square beside it (a seeded side; never where it attacks a crowd piece or gives check), both tracked and drawn as halves wherever they go. With no room for another pawn of his (8 already, or 32 pieces: the engine's limit) it waits for his first pawn move once there is | **Saw cuts:** every `sawEvery` turns from `sawFirst` (turn 3), an edge between two squares of the crowd's half that one of its moves crosses, for `sawTurns`: no straight move across it (a slide, a pawn's step, the king's, castling's way), either side; knights and diagonal moves pass; taped over as it heals | **Board saw:** the meter full, turn `boardSawFrom` or later, and a half of the board (a-d or e-h) his on material: the warning, then for `boardSawTurns` no move crosses between the d and e files (knights included), either side; then the halves rejoin |

- **Test switches:** `?boss=<id>` picks the boss (`?boss=jefferson` too: `BOSS_ALIASES`, read by `bossIdFromLink`);
  `?power=<id>` brings its ultimate early (warned as turn 2 begins, unleashed on turn 3; its passive as usual); admins
  see "Trigger ultimate (testing)" in any boss battle (`ultimateTestButton`, `triggerUltimate`: the ultimate as the next
  crowd turn begins, no warning).
- **What a boss says** (`packages/app/src/speech.tsx`, numbers in `SPEECH`; Eric, Oct 10: Ginger's line came and went
  at once): every line (its powers' moments, its ultimate, its warning, its reactions, Hollow's claim and Lights out
  words, Big Boy's snack) goes into the boss's voice and shows in its text box beside it (in the boss bar on a phone,
  by the board on a computer), on every screen of the battle, also while it stands at the board's corner for a
  moment. Each line types out, then stays fully readable for 2.2 s plus 35 ms a character (at most 4.5 s: a short
  line about 2.5 s, a long one about 4 s; Eric, later on Oct 10: "a few seconds… not that long"), whatever the screen
  does next. One line at a time: only a critical line (an ultimate's, Hollow's first cover of the dark, his
  claim, the battle's end) cuts in on another; the rest wait their turn, highest first, and lapse after 5 s of waiting.
  A move that brings a power's moment says nothing of its own (the moment's line is the boss's word that turn). The
  dock says the moment's word ("Freeze!"). Lights out's round prompt keeps its own box above the board for the whole
  round (and the dock).
- **Same for everyone online:** what a boss does and says on screen comes only from the shared match state
  (`boss-beats.ts`): one-shot animations play once per moment from when the device first saw it, loops run by the
  clock, lines are picked by a hash of the moment. No new protocol for a boss's looks.

## Where the code is

Each boss lives in its own files, one per layer, on a shared base. The shared files only put them together.

| Layer | Shared | Each boss (Ginger, Boingo, Jefferson, Hollow, Big Boy, Sawyer) |
| --- | --- | --- |
| The roster, the playable rule, choosing a boss, strength | `packages/core/src/boss.ts` (`BOSS_ROSTER`; power ids, event kinds and every boss's state fields in `BossPowerState`) | its line in `BOSS_ROSTER` |
| Rules: each turn's powers, allowed moves, what the judge sees, after-move effects, fair-play turns, its opening, its screen fields | `packages/chess/src/bosses/base.ts` (the base boss, `BossRules`, and shared helpers), `bosses/index.ts` (the registry), `boss-powers.ts` (the dispatcher: `prepareTurn`, `crowdAllowed`, `bossAllowed`, `powerTurn`, `icedSquares`, the judge's hooks) | `packages/chess/src/bosses/<boss>.ts`: `ginger.ts`, `boingo.ts`, `grex.ts`, `hollow.ts`, `bigboy.ts`, `sawyer.ts` |
| Timings the server and the screens share | `packages/chess/src/boss-timing.ts` (`POWER_FX` spreads each boss's `<BOSS>_FX`; `powerFxMs`, `bossIntroTimeline`) | in its rules file (`GINGER_FX`, `FIRE_BURN_MS`, `LIGHTS_OUT`, `CLAIM_MS`, `SNACK`, `BOUNCE`, `BLOCK`, `SPLIT`, `SAW_CUT`, `BOARD_SAW`…) |
| Its moments in the match runner (the funhouse, Lights out, the extra move, the bounce) | `packages/chess/src/runner.ts` hands each a `Battle` (base.ts) and keeps one-line methods (`playFunhouse`, `startLightsOut`, `playBounce`…) | `<boss>Battle` in its rules file, with its engine pick (`funhouseMoveFrom`, `extraMoveFrom`, `bounceFrom`) |
| The lobby server | `packages/server/src/lobby.ts` (the boss's turn; the host-engine requests for the funhouse, the extra move and the bounce), `packages/server/src/bosses/base.ts` (`BossLobby`) | `packages/server/src/bosses/hollow.ts` (dark tries, Lights out) |
| Solo | `packages/app/src/solo.ts` (drives the same runner; its own timing of Lights out) | |
| Art and sounds | `characters/index.ts` (`CHARACTERS`), `characters/kits.ts` (`BOSS_KITS`: animations per moment, lines, portrait), `characters/power-art.ts` (each power's moments and effects) | `characters/<boss>.ts`, `<boss>-sounds.ts` (`gingerbread`, `clown`, `grex`, `hollow`, `bigboy`, `sawyer`) |
| Board effect sprites | `characters/effects.ts` (`EFFECT_SPRITES`), `characters/effects/common.ts` | `characters/effects/<boss>.ts`: `ginger.ts`, `boingo.ts`, `grex.ts`, `hollow.ts`, `bigboy.ts`, `sawyer.ts` |
| Speech: every line's time and turn, the text box | `packages/app/src/speech.tsx` (`Voice`, `bossVoice`, `SpeechBox`, `holdMs`); power moments' lines said in `BossPowers.tsx` (`useMomentSpeech`), reactions in `BossCharacter.tsx` | a moment's `line`, `lineAt` and `priority` in its `BossUi` (only when the kit's lines aren't the whole story) |
| Powers on screen: moments, banners, the board layer, the rage meter | `components/BossPowers.tsx` (`momentsOf`, `PowerMoment`, `PowerBoard`, `BossBarExtra`, `dockLine`, the warning), `components/PowerParts.tsx` (`BossUi`, `Moment`, `Flight`, `PowerBanner`), `components/BossEffect.tsx` | `components/Ginger.tsx`, `Boingo.tsx`, `Grex.tsx`, `Hollow.tsx` (+ `LightsOut.tsx`), `BigBoy.tsx`, `Sawyer.tsx` |
| The boss screen | `packages/app/src/screens/Boss.tsx` (still names a few bosses: see below; Sawyer's split hides the new half until the crack, and his board saw jolts the board) | |
| The boss menu's power words | `packages/app/src/power-words.ts` (`Record<PowerId, …>`) | |

### The base boss (`packages/chess/src/bosses/base.ts`)

A boss's rules are a `BossRules` object; every hook sees only its own boss's battles and its own state:

| Hook | What it does | Who uses it |
| --- | --- | --- |
| `id` | Its `BOSS_ROSTER` id | all |
| `wearOff(next, t)` | As a crowd turn begins, first: what wore off | Ginger (ice), Boingo (pie), Big Boy (block) |
| `ultimate(next, t)` | The ultimate's step until it has come: true when it comes now. `warnThenUnleash` is the usual one (warn, then the next turn) | all |
| `ultimateOnHisTurn` | It comes at the start of the boss's turn instead (the test trigger waits for it) | Hollow, Big Boy |
| `everyTurn(next, t)` | Every turn after the ultimate's step | Jefferson (the barrage), Sawyer (the split's moment) |
| `passive(next, t)` | The passive's step (it waits a turn if the ultimate came now) | all |
| `crowdFilter`, `bossStops` | Its limits on the crowd's and the boss's moves (the dispatcher lifts them if none are left) | Ginger, Boingo, Big Boy, Sawyer (his first move a pawn's; the cuts) |
| `powerTurn` | A turn its powers touch doesn't count for fair play | all but Hollow (Sawyer: a cut or the board saw on) |
| `iced` | The squares that show ice | Ginger |
| `judge` | What the judge must score too, how it ranks and reads moves | Jefferson (fire) |
| `afterCrowdMove(b, move)` | After any crowd move, in the match | Jefferson (the burn), Sawyer (the halves follow) |
| `afterBossMove(b, move)` | After the boss's own move, in the match, before the crowd's turn is set up | Sawyer (the split: a base on the board; the halves follow) |
| `scoreRound(b, players)` | Its own costs on a round's scores | Hollow (dark tries) |
| `opening` | `fromStart`, `crowdWhite`, `setUp` before move 1 | Hollow, Big Boy (the snack), Sawyer (his cuts from turn 3) |
| `view(p)` | Its fields for the screens (`NetBossPowers`) | Hollow, Big Boy, Sawyer |

A boss's screen file fills in a `BossUi` (`components/PowerParts.tsx`): its moments by event kind (`order`, `kit` moment, `dock` word, `appearAt`, `own` screen, `line`, `lineAt`, `priority`, `view`), its ultimate's name for the warning, an optional `bar` piece by the rage meter and its `board` layer. A moment's line is said for it (its kit's line for the moment, as the moment begins, an ultimate's critical): a view never draws a boss's words itself.

### Adding a boss

1. **Design it** with Eric (opening, passive, ultimate) and record it in `DECISIONS.md`.
2. **Template** (`packages/core/src/boss.ts`): its line in `BOSS_ROSTER` (id, name, icon, kit name, offset, powers); new power ids in `PowerId` and `POWER_IDS`, new moment kinds in `PowerEventKind`, its state's fields in `BossPowerState`.
3. **Numbers** in `BOSS_POWERS` (`packages/core/src/settings.ts`): every tunable stays there.
4. **Rules**: `packages/chess/src/bosses/<boss>.ts` with its `BossRules` (start from the closest boss's file), its choose functions (seeded with `powerRoll`), its moments' lengths (`<BOSS>_FX`) and any beats the server and screens share. Register it: one line each in `bosses/index.ts`, `boss-powers.ts` (`export *`) and `boss-timing.ts` (`POWER_FX`). Its screen fields go in `NetBossPowers` (`protocol.ts`) and its `view` hook.
5. **Character and art**: `characters/<boss>.ts` (+ sounds), in `characters/index.ts` and `BOSS_KITS` (`kits.ts`); its effects in `characters/effects/<boss>.ts`, in `effects.ts` and `power-art.ts`'s `EFFECTS`; its moments in `power-art.ts`.
6. **Screen**: `components/<Boss>.tsx` with its `BossUi`; add it to `BOSS_UI` and `MOMENT_UI` in `BossPowers.tsx` (the compiler names any moment kind without a view). Its power words in `power-words.ts` (the compiler names a missing one). Its lines need nothing more: its kit's lines for each moment are said into its voice and held by the speech rule (`speech.tsx`); give a moment `lineAt` if the boss speaks partway through it, and say any other line with `bossVoice.say` (or `<Say>`), never in a box of its own.
7. **Only if it has a moment of its own beyond these** (and these still mean shared edits, because they're protocol):
   - one the host's engine plays (like the funhouse, the extra move, the bounce): a `<boss>Battle` with one-line runner methods, the lobby's request, answer and timeout (`lobby.ts`, `bossKind`), the host's handler (`net.ts`) and solo's (`solo.ts`), and the request's flag in `protocol.ts`;
   - one the server times (like Lights out): `packages/server/src/bosses/<boss>.ts` on `BossLobby`, routed from `lobby.ts`, its messages in `protocol.ts`, and solo's timing in `solo.ts`;
   - anything that changes the board the boss screen shows, or the intro (like the funhouse's flip, the bounce, the burn, Hollow's claim, Big Boy's snack, Sawyer's split): `screens/Boss.tsx`.
   - anything that changes the position outside a move leaves a base (`afterCrowdMove`, `afterBossMove`, or the boss's own moment), and never a ninth pawn of one side or a 33rd piece (the engine refuses those positions).
8. **Tests**: `packages/chess/test/<boss>.test.ts` (rules: never no legal move, never breaks check, deterministic from the seed, the judge's view), a lobby test in `packages/server/test/boss-powers-lobby.test.ts`, app tests for its character and moments, `e2e/<boss>.spec.ts`. Watch it frame by frame (`npm run frames:powers`, or a `frames-<boss>.mjs`), run `npm run perf:boss -- <dir> <boss id> both 25`, and give Eric the test links (`?boss=<id>`, `?power=<ultimate>`).
9. **Docs**: its row in the table above, and this checklist if the shape changed.

## Settings

`BOSS_POWERS` in `packages/core/src/settings.ts` (every power's numbers), the `boss*` keys of `Settings`,
`BOSS_DIFFICULTY`, `BOSS_TIERS` and each boss's `offset` in `boss.ts`.

## Tests and tools

- Unit: `packages/chess/test/boss-powers.test.ts`, `grex.test.ts`, `hollow.test.ts`, `bigboy.test.ts`, `sawyer.test.ts`,
  `long-match.test.ts`, `packages/core/test/boss.test.ts`, `packages/server/test/boss-powers-lobby.test.ts`,
  `packages/app/test/boss-kits.test.ts`, `characters.test.ts`, `boss-character.test.ts`, `gingerbread.test.ts`,
  `grex.test.ts`, `hollow.test.ts`, `bigboy.test.ts`, `sawyer.test.ts`, `fire-replays.test.ts`, `power-words.test.ts`.
- e2e: `e2e/boss-powers.spec.ts`, `grex.spec.ts`, `hollow.spec.ts`, `bigboy.spec.ts`, `sawyer.spec.ts`, `boss-character.spec.ts`,
  `boss-speech.spec.ts` (one moment of each boss: its line held whole and in view for its full time, every frame, and
  gone on time),
  `perf.spec.ts`. Unit: `packages/app/test/speech.test.ts` (the speech rule).
- Frames: `npm run frames:powers -- <dir> [gingerbread|clown|grex|all|both] [phone|desktop|both]`, `frames:hollow`,
  `frames:bigboy`, `frames:sawyer`, `frames:character -- <dir> [boss] [phone|desktop|both]`, `frames:wip`.
- Previews: `npm run preview:characters -- <dir>` (GIFs and sheets of every boss and effect).
- Perf: `npm run perf:boss -- <dir> <boss id> [phone|desktop|both] 25`.
- Sims: `packages/sim/scripts/boss-sim.ts` (modes `snack`, Big Boy's; `split`, Sawyer's), `boss-blunders.ts`
  (`reports/boss-sim/`, `reports/boss-calibration.md`).

## Rules for this area (from `.claude/LESSONS.md`)

- No power may put a ninth pawn of one side, or a 33rd piece, on the board: the engine (Stockfish 19, everywhere)
  refuses the position, and a search sent one never answers. Sawyer's split waits for room (`splitRoom`).

- Anything that changes the position outside a move (a burn, a snack, a bounce) leaves a base, and nothing replays a
  board's history from move 0: use `fenAtPly(history, ply, bases)`. Grep for `fenAfter(` and `.history` and check each.
- Never change what chessground draws (orientation, size) while a transform is on it or an ancestor.
- An effect that can appear many times at once goes on a shared canvas (`BoardEffects`), never a loop per sprite.
- Measure a new effect's first showing on a slowed phone; draw many new frames ahead, a slice a frame; make a boss's
  sounds before their cue; nothing a boss needs only in its battle is made when the app loads.
- Nothing read while rendering may grow with the match; run `npm run perf:boss` late in the match.
- Tables keyed by a closed set (powers, events) are typed by it (`Record<PowerId, …>`).
- Text a player must read to play (Lights out's prompt) stays on screen as long as it applies, outside the speech box.
- A boss's words go into its voice (`speech.tsx`), never into a box a screen or a moment owns: a line lives as long as
  the rule says, not as long as the screen that said it. Nothing hides a speech box to make it fit: it shrinks, then
  moves into view. Test a line's whole time on screen, every frame (`e2e/boss-speech.spec.ts`).
