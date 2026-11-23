# Armored Birdie keeps the train, and his brain jumps (Nov 23, 2026)

Eric, Nov 23 (`notes/designs-birdie.md`, "Eric's answers"): "He still uses his same normal move after. He just does it every 3 to 4
turns. But then, because his main thing is just we turn up the Maya to a much stronger level. And if somebody's already fighting on very
hard difficulty for him, then ... he just turns up to play maybe Stockfish slightly higher than what the Maya highest is."

- **The train after the fall:** the same rule, `armoredTrainEvery` (3) crowd turns from one warning to the next (the fall doesn't reset
  the count already set). Replaces "no train after the fall" (`2026-11-23-birdie-fall.md`).
- **His brain** (`armoredBrain` in `bosses/birdie.ts`, through the new `BossRules.brainNow` and `MatchRunner.brainNow`, asked for every
  move of his by solo's `playBoss` and the lobby's request, so every device plays the same):
  - Maia `armoredMaiaBoost` (400) higher, held at Maia's top (2500): Medium 1600 → 2000, Hard 2050 → 2450, Easy 1150 → 1550.
  - Already at Maia's top (Very hard): Stockfish at `armoredStockfishAbove` (100) over the level Maia's top stands for on our scale
    (`levelForMaia(2500)` = 2650, so 2750). Calls made: "Maia's highest" read on the game's rating scale (the one Stockfish's
    strength uses), not Maia's own 2500; the lobby sends no brain for those moves, so no Maia check is asked for them.
  - A battle he already plays on Stockfish (no Maia on offer, a raid's high strength): 400 Elo more, held at `ENGINE_MAX_ELO`. Call
    made: Eric's "much stronger" applied to the brain he has.
  - Stockfish's stand-in while Maia isn't there (and the moves Maia doesn't play): the battle's strength plus Maia's jump on the game's
    scale (`levelForMaia(new) - levelForMaia(old)`), not the new rating's level outright (a test lobby's battle at 1350 with Maia 600,
    whose level is 1800, would have jumped 800).
- The judge, fair play and the bar's level don't read his strength: unchanged.
