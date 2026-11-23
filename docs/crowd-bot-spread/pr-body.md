# 50 v 50: bots spread over the good lines, and the team's move comes from its top 3

**Lane:** targeted (rules, the bots, the reveal's line). One note for the director: the judge job's rules carry a new
optional field (`JudgeRules.crowdBots`), so devices and the lobby draw the same bot picks. It's a small optional field,
not the protocol's core. CI runs the whole suite anyway because `packages/core` changed.

## Why the team went unanimous
On a sharp turn (the second line gives away `botPowerUpLoss`, 15 points, or more), every bot holding a power-up used it
and played the engine's best line. Crowd bots start with 3 power-ups each, and every bot sees the same trigger, so a
team's first sharp turns were unanimous. That was 7.8% of all turns. Eric's castle at move 7 of a Random opening is one
of them: castling was best and every other line was 19.5 points or more worse. On other turns the bots spread almost
evenly over the top 8 lines, so the team often played the 6th to 8th best line.

## What changed (50 v 50 only; raids, boss battles, Classic and Squads unchanged)
- **The played move** (`crowdPlayedFromTop: 3`, `crowdTopOdds`, `drawMove`): the team plays one of its 3 most-picked
  moves, with odds of its picks over the total for the three (45 / 3 / 2 picks play 90% / 6% / 4%). The runner draws
  it from the match's random source (online, that's the server). Ties across 3rd place leave the tied moves out, so a
  forced recapture with four single stray picks always recaptures. If every move is tied, they share evenly. A boss
  battle (the boss final) still plays the most popular pick.
- **The bots** (`CROWD_BOTS`, `botLean`, `botPickSpread`): each team turn draws one shared lean from the turn's seed
  before any bot picks. The lean is a focus (how closely appeal follows the engine) plus a taste per line. Each bot
  weighs the first 5 lines under 15 points by exp(-focus × loss / T + taste) and every other line far lower. A bot
  holding a power-up uses it on a sharp turn only 25% of the time. The bots' temperatures stay where they were
  (BOT_LOBBY.skillAt).
- The lean goes into the runner (solo, and the lobby's own runner), the many-judges job (`judgeBotPicks`, from the
  seed) and the host device's bot plan (`net.ts`).
- The home page's live window now always shows the played move first, then the most-voted other moves.
- New probe: `packages/sim/scripts/crowd-spread-probe.ts`. Report: `reports/crowd-spread.md`. Decision:
  `docs/decisions/2026-11-02-crowd-bot-spread.md`. Area page: `docs/areas/crowd.md`.
- Scoring (CROWD_SCORING) is unchanged and still fits: each pick is scored against the best line and the team's
  average, never against the played move.

## Measured (48 bot-only games, 1920 team turns; before → after)
- The most-picked move is the engine's best: 33% → 39% of turns.
- Turns where 95% or more of the team picked one move: 7.8% → 1.4%.
- The played move is one of the engine's top 3: 61% → 74%.
- The played move is a blunder: 1.9% → 1.0%.
- Bot picks that are blunders: 9.7% → 3.8%.
- Unique lines: games from the same start part ways at the first move, both before and after. All 48 lines are
  distinct by move 10 and by move 20.
- Points given away per pick, by bot rating: 600: 6.7 → 4.1; 900: 6.2 → 3.8; 1200: 5.3 → 3.3; 1500: 4.3 → 2.7;
  1900: 3.3 → 2.2. A table matched to Maia's losses was tried and dropped: it made the team play more blunders.
- An engine-best player among 99 bots (`crowd-bots-sim.ts tuned`, 8 matches) finished 1st or 2nd in 8 of 8.

## Player-visible changes
- **Landing, Crowd:** "Every turn your team of 50 picks a move, and the most popular pick is played." → "Every turn
  your team of 50 picks a move, and one of its three most popular picks is played: the more picks, the likelier."
- **FAQ, The modes → Crowd:** "…and the **most popular pick is played** (a tie is settled at random)." → "…and **one of
  the 3 most popular picks is played**, drawn by how many picked each: if 45 pick one move, 3 another and 2 a third,
  they're played 90%, 6% and 4% of the time. Moves tied for the last of those places are left out. So the crowd's
  favorite usually plays, but not always."
- **FAQ, scoring example:** "In Crowd the move B and C share is the most popular, so it's the one played." → "…, so
  it's the likeliest to be played."
- **Crowd reveal line:** "Crowd plays Nf3 · 12/50" → "Crowd plays Nf3 · 12/50 · 24% chance". The chance shows only
  when the played move wasn't certain, and only in 50 v 50, not in boss battles.
- **Home live window:** the bold first move is always the played move, followed by the most-voted other moves.
- The bots spread out more, herd onto different good lines from turn to turn, and blunder less often.
- Unchanged: the raid texts ("The most popular pick is played"), and the landing tagline "The crowd plays it."

## Changed checks (old → new)
- `packages/server/test/lobby.test.ts`, "the home page's live window…": old: the first vote is the played move and has
  the highest tally, and all votes are sorted most first. New: the first vote is the played move with its own tally,
  and the others are sorted most first, starting with the most-voted remaining move.
- Added: `packages/core/test/crowd-bot-spread.test.ts` (6 tests: a team at lobby ratings never all picks one move,
  Eric's castle included; the plurality moves between good lines; blunders stay rare; the lean comes from the seed;
  the top-3 odds and ties; the draw). Added one check to `packages/chess/test/judge.test.ts` (crowd bots' picks come
  from the seed alone, and they spread).
- No check guarding a rule in `docs/rules/eric.md` changed.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
