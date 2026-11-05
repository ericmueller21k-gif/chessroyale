# Hollow's ten bulbs, his bigger darkness and his taunts (Nov 5, 2026)

Eric, Nov 5 (condensed): "It still says −5 when you are solo and do a wrong move. I thought we discussed like 10 bulbs and each
wrong play put one out." At 3 and 7 out you're forced into a bad move; at 10 you lose (the screen goes black, he says something,
then the loss). "Bulbs only apply in solo for now to avoid a griever spamming bad moves." Also: bigger darkness everywhere he
plays (a few 2 x 2 blocks, "if you don't know where say the bishop moves to in it, that's just your loss", and once a game a
3 x 3 for 2 turns), and his taunts on each misplay ("Nice try.", "What, can't play in the dark?" and about 6 more). Eric
confirmed on Nov 5 that the bulbs are for solo only.

## What changed

- **Boss alone: ten bulbs instead of points** (`settings.hollowBulbs`, set by `solo.ts` for Boss alone; his powers' `strand`).
  Each wrong move into the dark puts one out: no −5, no 5-a-turn cutoff. As the 3rd and the 7th go out, the dark plays that
  turn's move for you; as the 10th goes out, the battle is his (`blackout`).
- **Crowds keep today's points.** A raid, the Crowd's boss final and a Boss Battle party (and any online lobby) never get a
  strand: −5 a wrong try, the 5th a missed move, as before. Eric's reason: a griever could spam wrong moves to burn a shared
  strand.
- **Deeper dark, everywhere he plays** (rule set 2): a 2 x 2 block after his 6th, 12th and 18th moves, dark for 4 turns; his
  3 x 3 once a game after his 9th move, dark for 2 turns. Banners "DEEPER DARK!" ("2×2 dark for 4 turns") and "PITCH BLACK!"
  ("3×3 dark for 2 turns"), cast like a cover.
- **His taunt on each misplay**, alone and in a crowd: one of eight at random, never the one he said last.

## The calls

- **"Solo" is Boss alone** (one person, no bots, picking every move: `bossAlone`). A Solo raid (you and 49 bots) plays as a
  raid, its move the crowd's vote, so a forced move "for you" wouldn't mean anything there: it keeps the points. The rules also
  check the battle has one player, so a setting slipped into a crowd does nothing.
- **Fair play:** every bulb, forced move and loss is decided by the shared rules (`hollowBattle.darkTry`,
  `darkForcedMoveFrom`, the runner's `stageComplete`/`finishBossBattle`), the same code the server runs; Boss alone runs it on
  the device as it already did for the whole battle (it has no server). The screen only shows `strand`, `forced` and
  `blackout` from the battle's view. The forced move, once picked, is the turn's only allowed move (Hollow's `crowdFilter`), so
  nothing else can be played for it, and it doesn't count for fair play (`powerTurn`).
- **Versioned:** a battle records its rule set as it begins (`hv: 2`, and the `strand` for Boss alone). A battle begun
  before this (no `hv`) keeps the single squares only and the points; nothing changes mid-battle.
- **The forced move: how bad.** Boingo's funhouse picker (`funhouseMoveFrom`) with Hollow's own band: a move giving away
  **15 to 30 points** of expected score against the best (the funhouse's is 10 to 25: Eric wants this one "genuinely bad"),
  the one nearest the middle, never more than 2 in log-odds, never one whose line lets him force mate, never one that leaves
  the queen to be taken (unless it takes his), and never a move that ends the game on the spot (a mate or a stalemate, either
  way). Short of the band: the weakest move under it. In a position the engine already counts as decided (every move scores
  the same), there is no worse move to find, so it can be no worse than the best (the sim's forced moves: below).
- **"The dark moves for you."** His line in his bubble, the dock's whole line, a dark flash closing in over the board for
  1.3 s (`DarkForced`), a low breath-and-drag sound (`hollowForced`); 1.7 s after the 3rd/7th bulb the move plays as yours,
  scored by the judge as any move (it's your turn's move; the bulbs cost no points on top). Taps do nothing meanwhile.
- **Total darkness:** the whole screen fades to black (1.4 s), your ten dark bulbs on their wire, "HOLLOW / Lights out.
  Forever." types out, then "Your last bulb went out." (2.6 s), his `blackout` thoom; at 4.6 s the loss screen: "Defeated",
  "Hollow won: the last of your ten bulbs went out." So it reads as the bulbs, never as a bug.
- **Where the bulbs show:** his strand of ten (`lifeStrand`, the same bulbs and battle colors as his figure's strand,
  `lights.ts`) in the boss bar's free room (`barProp`, as Timber's and Babur's props): under the status on a phone, beside his
  bars on a computer. The three-bulb countdown to his next cover stays where it was. A bulb going out flickers, sparks and
  dies with a small fizz and pop (`hollowFizz`); the dock says "Bulb out · 9 left".
- **Block placement** (`chooseDarkBlock`): wholly on the board; never on either king's square, so a block can never cover all
  of a king's escape squares (any block holding a king's neighbors on both sides holds the king); holding at least 2 pieces
  (the 3 x 3: 3) when such a block exists, else at least one, else any; from the battle's seed. **Overlap:** a square already
  dark keeps its one entry and stays dark until the later of its two ends; only the newly dark squares play the cover's
  gathering (so a square never flashes visible mid-cast). Anything moving inside dark squares stays hidden as today.
- **Cadence** (all in `BOSS_POWERS`: `darkBlockAt` [6, 12, 18], `darkBlockTurns` 4, `darkBigAt` 9, `darkBigTurns` 2,
  `darkBlockMinPieces` 2, `darkBigMinPieces` 3): never on a move that brings a single cover (his 1st, 4th, 7th…), so one cast
  at a time; the first block after his 6th move, once the game has shape; three 2 x 2s and the 3 x 3 by his 18th move, which a
  typical battle (34 to 47 crowd moves in the sims) reaches.
- **Taunts** (placeholders but Eric's two, until Eric's Gemini lines): "Nice try.", "What, can't play in the dark?",
  "Something was there. Wasn't it?", "You reached for nothing.", "Feeling around, are we?", "The dark remembers. You don't.",
  "Not there. Never there.", "Wrong. And it's getting darker." Picked on the device (looks only), never the same twice
  running (`hollowTaunt`).
- **Sounds:** the bulb's fizz and the forced move are new synthesized sounds (low, no chimes, under a move's loudness;
  `boss-sounds-finite.test.ts` passes); the blackout reuses his `blackout` thoom from his challenge intro.
- **Test switches:** `?bulbs=N` (N bulbs out as the battle begins, never all), `?darkblock=2|3` (that block with his first
  cover).

## The sims (`packages/sim/scripts/boss-sim.ts raid hollow …`, rows in `reports/boss-sim/raid-hb*.jsonl`)

The bots know the board, so on their own they never try a move into the dark. For Boss alone the sim adds a player in the dark
(`darkMiss` 0.3: on a turn whose pick touches the dark, a wrong try first with that chance, and again after each wrong one).

| Run | Battles | Player score (W/D/L) | Crowd moves | Dark-touching turns / wrong tries a battle | Forced moves | Blackouts |
|---|---|---|---|---|---|---|
| Crowd (Solo raid, 50 bots), old rules (`hbOldC1`) | 13 | 0.15 ± 0.09 (1/2/10) | 47 | (bots never try) | – | – |
| Crowd, new rules (`hbNewC1`) | 13 | 0.08 ± 0.05 (0/2/11) | 44 | (bots never try); 4 blocks a battle | – | – |
| Boss alone, Medium, old rules (`hbOldS1`, `hbOldS31`) | 26 | 0.00 (0/0/26) | 35 | 3.5 / 1.6 | – | – |
| Boss alone, Medium, new rules (`hbNewS1`, `hbNewS31`) | 26 | 0.00 (0/0/26) | 36 | 6.5 / 2.9 | 16 | 0 |
| Boss alone, Very easy, bulbs off (`hbEasy-false`) | 13 | 0.00 (0/0/13) | 35 | 5.8 / 2.1 | – | – |
| Boss alone, Very easy, bulbs on (`hbEasy-true`) | 13 | 0.00 (0/0/13) | 34 | 5.8 / 2.1 | 4 | 0 |

- **Crowd:** inside the roster's band (about 0.08 to 0.55, docs/decisions/2026-10-18-hopper-leapfrog.md); the change is noise
  (the blocks can't move bots, who never try the dark; the two runs overlap within a standard error). Hollow at Oct 15's
  code scored 0.79 in the same sim; today's code, before this change, 0.15.
- **Boss alone:** one sim bot loses every battle to him even at Very easy, with or without the bulbs, so the sim can't show a
  win rate moving; what it shows is how much the bulbs bite: with the blocks the dark touches nearly twice as many turns (3.5
  → 6.5 a battle), a player who misremembers 30% of the time loses about 3 bulbs a battle, the dark moves for them about once
  every two battles, and nobody reached the 10th (the most out in a battle: 9). Of the 20 forced moves, 5 cost 18 to 34 points
  (the band, with the funhouse's 5-point recheck margin), 3 cost 5 to 12 (no move in the band), and 12 cost 0: in a battle the
  bot had already lost, the engine scores every move the same (checked by hand on such positions), so there is no worse move
  to find. Difficulty stays set by
  Boss alone's own levels; the bulbs add a cost only to wrong moves, which a careful player never makes.

## Changed checks (old → new)

- `packages/chess/test/hollow.test.ts`, "in a battle: each dark square lasts 10 crowd turns…, never two on one" → "…lasts as
  long as the longest cover over it (10 turns for a single square, 4 for a 2 x 2 block, 2 for the 3 x 3)…": each square's end
  checked against its covers; "about 4 at once" → 4 single squares plus the blocks' squares (≤ 17).
- `e2e/hollow.spec.ts`, "Hollow's dark: … a wrong attempt (-5), … the 5-try cutoff" (Boss alone) → "Hollow's dark, Boss
  alone: … his ten bulbs, a wrong attempt (a bulb out and a taunt), … the dark's move at the 3rd bulb": `.pw-cost` "−5" and
  "4 tries left" → no "−5", "Bulb out · 9 left", the strand 10 → 9 lit, a taunt; the move's roundScore −5 → 0; "five wrong
  attempts end it as a missed move (−25)" → "two more and the 3rd bulb: the dark moves for you". (The −5 and the 5th-try miss
  are still checked in a crowd: the online test's −5, and `hollow-bulbs.test.ts` "a crowd keeps today's points".)
- `packages/chess/test/boss-kit-lib.ts`: `KNOWN_STEPS` gains `darkForcedDue` (the driver plays the dark's move when due).
- None of these guarded a rule in `docs/rules/eric.md`. New guards for Eric's rules are listed there.
