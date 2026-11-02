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
