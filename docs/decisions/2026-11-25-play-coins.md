# Play coins in every counted game (Nov 25, 2026): the payments build's PR 2

**Eric (Nov 18):** "coins from every mode, time-based, capped ... but you can also continue to get more ... if you place well". **Eric (Nov 9, on XP):** "we dont want players to know they could just stall".

- **Coins are paid with each counted game's XP**, from `PLAY_COINS` in settings, keyed by the game so it pays once. Ranked's and Squads' placement coins are gone; Squads' crates stay.
- **A day's play coins stop at 300.** Day totals come from the ledger.
- **Retries:** a refused op is tried 4 times, then once with the bonus held to the day's 300, then logged.
- **A new `results.coins` column** keeps each game's coins beside its XP. It's stored data, so this PR is in the full lane.
- **Held by fair play** (review or banned) means no coins.
- **Solo** pays the minutes XP paid under its 120-minute cap, with no bonus.
- **Squads:** 1st pays 40, the placement is the bonus, and the win's 15 isn't paid too.
- **Steps:** a win pays 15, then 8, then 4, then 0.
- **The FAQ** gives no per-minute numbers: "more for a longer game, up to 54 a game".
- **Review:** a failed D1 call never costs a game its coins. Ranked keeps the outcome and retries for up to 24 hours. A game pays at most one daily reward.

Full design and measurements: PR #950.
