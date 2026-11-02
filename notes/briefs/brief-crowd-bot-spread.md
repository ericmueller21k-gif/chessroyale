# Brief: 50 v 50 bots all pick the same move (Opus high)

Eric, Nov 2: "in 50v50 why do all the bots on my team play the same moves 6 and 7 (random opening start)? I looked at engine
lines and castle was best, but why do the bots not even try to play others. I want players who just play with bots to have a
more realistic experience. Or is the issue something else? Not saying only 10 should pick the best move or something, but at
least distribute them a bit more so it's not so boring."

What the code says should happen (director's read, unverified): bots pick with `botChoose` → `botPick` (core/match.ts ~l.825):
weight exp(-loss/T) over the judge's top `botCandidateMoves` 8, loss = (best expected − move's expected) × 100; T from the bot's
rating (`BOT_LOBBY.skillAt`, ~27 at 1200). With opening moves a few points apart that should spread picks widely. So find what
actually collapses them. Candidates to check: the candidate list's length in a real crowd turn (MultiPV, the allowed search,
`judgeCandidates`/`jobRanked`, the opening allowance), the bots' `skill` actually passed (null → 5? the lobby rating mapping,
`?weakbots`), the power-up rule (`botPowerUpLoss`), one shared rng seed making every bot draw the same number (`judgeBotPicks`
uses `mulberry32(job.seed)` once — check each bot draws its own), the `planned` cache in `runner.ts botPicksFor`, the online
lobby's path (`lobby.ts` botPicks, `net.ts` botPlan) vs solo. Reproduce with a real 50 v 50 position at moves 6-7 (a random
opening start) and print the distribution of the team's bot picks.

Fix the cause. Target (Eric): realistic spread, the best move the most common but clearly not unanimous; weaker bots wander more.
Keep the bots' overall strength by rating (BOT_LOBBY calibration, reports/crowd-bots.md) unless the cause was a bug that made
them stronger than calibrated; re-run the probe and report the before/after distribution and average loss per rating.
Tests: a unit test that a team of bots at lobby ratings over a typical opening position doesn't all pick one move. PR-body file
docs/crowd-bot-spread/pr-body.md. Push; no PR.

## Eric's design (Nov 2, follow-up) — this replaces the "target" above
"I don't want 'the best move is always the most common choice': that's the problem, then the best move is always played,
which is not how humans of varying skill will actually choose moves. It should decide between the best 5-6 moves on each side
and the majority should pick sometimes the 4th or whatever. Maybe the issue is that we need to sometimes not go with the
majority vote always … add weights to them so if say 45 people castle it will most likely castle but might play one of the
other moves. That should be the norm. Top 3 moves only (for now), each % decided by their relative pick rate."

1. **The team's played move in 50 v 50 (every player, not only bot games):** no longer always the most picked. Take the 3 most
   picked moves; play one at random with probability = its picks / the top 3's picks (e.g. 45 / 3 / 2 → 90% / 6% / 4%). Server
   decides (fair play), from the turn's seed; ties for 3rd place as you see fit (say how). Number of moves (3) in settings
   (`crowdPlayedFromTop: 3`). Only 50 v 50 (crowd) for now; other modes unchanged. Check what the UI says about how the move is
   chosen (the FAQ, the rules box, any "majority" wording, the pick reveal) and update it; list every text change. Check crowd
   scoring (CROWD_SCORING) still makes sense when the played move isn't the plurality (scores are per pick, should be fine; say).
2. **Bots spread over the best 5-6 moves**, and the team's most-picked move is not always the engine's best: sometimes the
   2nd, 3rd or 4th. Humans herd: give each turn a shared random "taste" (correlated noise on the candidates' appeal, the same
   for all bots of a team that turn) on top of each bot's own temperature, so the crowd's plurality lands on different good
   moves from turn to turn, and weaker bots scatter more. Candidates: the top 6 (`botCandidateMoves` may stay 8). Tune so, over
   many opening and middlegame positions: the best move is the plurality roughly half the time or less (report the rate), the
   team's played move (after part 1) is a top-3 engine move most of the time, and blunders stay rare. Report bots' average
   loss per rating before/after; their ratings may need re-calibrating (BOT_LOBBY.skillAt, reports/crowd-bots.md): do it.
3. Also find and fix whatever made them unanimous (the original bug), if it's a bug.

## Eric, one more (Nov 2) — the goal, over everything above
"The bots should deliberately pick between the top moves based on the engine scores of each move, but add a random factor. So
if engine lines 1-5 are not blunders … we really just want it so the bots aren't hijacking which move is chosen every time, and
this allows for every game to have unique positions and also feel more human. Sometimes they lean stronger, sometimes they
don't. **The goal should be unique lines favored over optimal play.**"
- So: among the engine's top 5 that aren't blunders (define "blunder" by loss, in settings), appeal follows the engine score
  only loosely, plus the turn's random lean; the lean's strength itself varies turn to turn (some turns the bots crowd onto the
  best, some turns they scatter or herd elsewhere). Moves that are blunders stay rare.
- Measure "unique lines": play many bot-only 50 v 50 games from the same start and report how soon games diverge and how
  many distinct positions by move 10/20, before vs after. Favor variety over strength; keep blunders rare.
