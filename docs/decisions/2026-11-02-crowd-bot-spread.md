# 50 v 50: bots spread over the good lines, the team's move from its top 3 (Nov 2, 2026)

**Eric (Nov 2):** "in 50v50 why do all the bots on my team play the same moves 6 and 7 (random opening start)? I looked at
engine lines and castle was best, but why do the bots not even try to play others." Then: "add weights to them so if say
45 people castle it will most likely castle but might play one of the other moves. That should be the norm. Top 3 moves
only (for now), each % decided by their relative pick rate." And, over everything: "The bots should deliberately pick
between the top moves based on the engine scores of each move, but add a random factor ... **The goal should be unique
lines favored over optimal play.**"

**The cause (a design slip, not a stray bug).** On a sharp turn (the second line gives away `botPowerUpLoss`, 15 points,
or more) every bot holding a power-up used it and played the best line. Crowd bots start with 3, and the trigger is the
same for all of them, so the team's first sharp turns were unanimous (7.8% of all turns at 95%+ one move). Eric's castle
is one: castling best, every other line 19.5 points or more worse. Elsewhere the bots scattered almost evenly over the
top 8 (the plurality's share about 29%), so the team often played the 6th to 8th line.

**What changed (50 v 50 only; raids, boss battles, Classic and Squads as before).**
- **The played move** (`crowdPlayedFromTop: 3`, `crowdTopOdds`): one of the team's 3 most-picked moves, drawn by the
  runner from the match's random source (the server's online), with odds of its picks over theirs (45 / 3 / 2 plays 90% /
  6% / 4%). My call on ties: moves tied across the last place are left out (45 / 3 / 2 / 2 plays 94% / 6%), so a stray
  pick or two never gets a share by a tie (a forced recapture with four singletons always recaptures); everyone tied
  shares evenly. A boss battle (the boss final) keeps the most popular pick.
- **The bots** (`CROWD_BOTS`, `botLean`, `botPickSpread`): each team turn draws one shared lean from the turn's seed
  before any bot picks: a focus (log-uniform 1 to 4: how closely appeal follows the engine) and a taste per line (a normal
  draw times a strength drawn from 0 to 1.2). A good line (one of the first 5 giving away under 15 points, Lichess's
  blunder) weighs exp(-focus x loss / T + taste); any other line 0.1 x exp(-loss / T). A bot holding a power-up uses it on
  a sharp turn only 25% of the time. Online the lean rides in the judge job's rules (`JudgeRules.crowdBots`, optional),
  so every device and the lobby draw the same picks.
- **Calls:** blunder 15 points (Lichess's, a 15% swing); lean strength 1.2 (1.5 herded 80%+ onto one line on 3.8% of
  turns with other good lines there, 1.2 on 2.1%); blunder weight 0.1 (0.15 and 0.2 more blunders, no more variety);
  focus 1 to 4 (0.5 to 2 put the 4th and 5th lines on the board as often as the 2nd).
- **The bots' temperatures stay** (BOT_LOBBY.skillAt). They now give away about 60% of the points a pick they did, in the
  same order by rating (1200: 5.3 to 3.3). A Maia-matched table was tried: it needs a 1200 bot to miss a plain recapture
  about half the time, and the team then played more blunders (2.3%, from 2.0%), so variety and rare blunders won.
- **Scoring is unchanged and still fits:** every pick is scored against the best line and the team's average
  (CROWD_SCORING), never against the played move.

**Measured** (`crowd-spread-probe.ts`, 48 bot-only games, 1920 turns; reports/crowd-spread.md): the plurality is the
engine's best 33% → 39% of turns; turns at 95%+ one move 7.8% → 1.4%; the played move a top-3 line 61% → 74%; played
blunders 1.9% → 1.0%; bot picks that blunder 9.7% → 3.8%. Games from the same start part ways at the first move before
and after; all 48 lines distinct by move 10 and 20.
Eric's check on the bots' strength (`crowd-bots-sim.ts tuned`, 8 full matches, an engine-best player among 99 bots):
1st or 2nd in 8 of 8 (1st in 7).

## Retune, same day (Eric: "spread better across the best 4-5 moves, or even 7 moves when it's early game", and the played move should be a top-3 line less often, not more)
- `CROWD_BOTS`: `moves` 5 → 7, `focus` [1, 4] → [0.1, 1], `lean` [0, 1.2] → [0.8, 2.5]; the taste is now centered over the
  good lines (it moves bots between good lines, never toward the blunders as a whole).
- Measured (`crowd-spread-probe.ts`, 24 games each): normal start, 40 plies: plurality = engine best 36% → 26%; played
  move a top-3 line 67% → 55% (55% of 960 turns), played blunders 1.3% → 0.7%, played ranks 1-7: 242, 165, 117, 116, 117,
  90, 110. Random opening, 16 plies: plurality = best 24%, played top-3 57%, played blunders 0.5%.
- `crowd-bots-sim.ts tuned`, 10 matches: the engine-best player finished 1st in 9, 2nd in 1.
