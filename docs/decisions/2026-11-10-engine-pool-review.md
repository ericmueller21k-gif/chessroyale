# The engine pool's review fixes (Nov 10, 2026)

Eric: "if some player accidentally does for a game, they won't get banned". **Director's call:** pool only a ban resting on two
matches from different lobbies. **Mine:** that means it still stands with any one match left out (core's `banSpread`), so one forged
lobby plus an honest match tipping the two-match bar opens a review. Skipped: the deep search's own second-best gap (a new core summary
field). **Accepted as the review says:** m2 (the new-account rule decides nothing yet; it counts fair-play rows, not games); m5 (a D1
error sends a pooled player to the usual queue once, as bans fail open); m6 (bot-filled lobbies, a party's friends meeting bots, a
shared "#1" may give the pool away).
