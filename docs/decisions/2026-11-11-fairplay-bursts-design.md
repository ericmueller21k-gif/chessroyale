# Fair play: selective cheating is measured against a player's own baseline (design, Nov 11, 2026)

Eric: "all of a sudden for 4 or 5 moves they're playing at 3,000 Elo, and there's a pattern of that for more than just a game or two, that's a mega must-notify, and drop them in the same cheater queue."
The call (design only, nothing built): a baseline per player (median match strength, last 50 matches), bursts (3+ near-best picks in a row that the baseline makes very unlikely) and a summed score for critical positions; three deep-confirmed burst matches pool and alert Eric on Discord.
Why: today's evidence is measured against the match's own strength and never adds up across matches, so the simulation's 20-40% cheater is pooled 0% of the time.
The design, sources, targets and build plan: [docs/ideas/fairplay-bursts.md](../ideas/fairplay-bursts.md).
