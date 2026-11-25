# Play coins in every counted game (Nov 25, 2026): the payments build's PR 2

Eric's ask (Nov 18): "coins from every mode, time-based, capped ... but you can also continue to get more ... if you place well". The
rule is the approved design's section 6 (`2026-11-17-payments-design.md`; its "Calls made here" 1-2): `PLAY_COINS` in settings.ts,
core's `gameCoins()`, paid with each counted game's XP. Ranked's own coins and Squads' placement coins are gone (Squads' crates stay).
The per-day table: `reports/coin-report.md`. Calls made in building it (the director's, for review):

1. **Paid in XP's own batch, keyed by the game** (`coins:<game>:<ledger id>` reason `play`, `coinsbonus:<game>:<ledger id>` reason
   `play-bonus`), so a game pays once however it's retried. Each op's guard reads the XP day's totals in the same statement (play: the
   day's 300; bonus: the day's paid bonus as read, and XP's win op when it pays a win). One refused by a game landing at once is worked
   out again from the ledger and tried alone, up to 3 times; the last try's bonus is held to the day's 300 only (never starved; a
   coin or two off the steps then, never past the ceiling).
2. **The day's totals are the ledger's own sums** (reasons `play` and `play-bonus`, from `xpDayStart` to the next day's), as XP's solo
   minutes are: no table. A room's late retry counts in its own game's day.
3. **`results.coins`** (a new nullable TEXT column, JSON `PlayCoins`): the result row keeps the game's coins beside its XP, so
   `GET /api/xp` answers them (the Squads end screen now; PR 3's strip). Stored data: this PR is in the full lane.
4. **"Held by fair play" is review or banned** (as ranked's coins were): no coins; XP stays its own rule (banned only).
5. **Solo, and an online game on one device's word** (XP's "solo" cap): the minutes XP paid under its 120-minute cap, no minimum of 1
   (so solo can never pass 216 a day by many short games) and no bonus.
6. **Squads:** the placement is the bonus; 1st pays 40, never the win's 15 too (the design's "1st 94"). A member who resigned or left
   gets no placement bonus (their old reward paid nothing either). The "placed" message's `coins` stays 0 for apps from before.
7. **50 v 50 top 3:** the first 3 rows of your team on the leaderboard at the end, bots' seats counted; not in a boss battle.
8. **The steps without drift:** a game's bonus moves the day's paid total to the steps' value at the earned bonus it stands for plus
   this game's, rounded; the paid total is the only state, and the day can never pass 300. (A win: 15, then 8, then 4, then 0.)
9. **Ranked's `coin_day` and `coin_games`** stay on the row with what they had, no longer read or moved (no destructive migration).
10. **The FAQ gives no per-minute numbers** for coins either (Eric's XP rule, Nov 9: "we dont want players to know they could just
    stall"): "more for a longer game, up to 54 a game".
