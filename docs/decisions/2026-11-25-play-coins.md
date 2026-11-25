# Play coins in every counted game (Nov 25, 2026): the payments build's PR 2

Eric's ask (Nov 18): "coins from every mode, time-based, capped ... but you can also continue to get more ... if you place well". The
rule is the approved design's section 6 (`2026-11-17-payments-design.md`; its "Calls made here" 1-2): `PLAY_COINS` in settings.ts,
core's `gameCoins()`, paid with each counted game's XP. Ranked's own coins and Squads' placement coins are gone (Squads' crates stay).
The per-day table: `reports/coin-report.md`. Calls made in building it (the director's, for review):

1. **Paid in XP's own batch, keyed by the game** (`coins:<game>:<ledger id>` reason `play`, `coinsbonus:<game>:<ledger id>` reason
   `play-bonus`), so a game pays once however it's retried. Each op's guard reads the XP day's totals in the same statement (play: the
   day's 300; bonus: the day's paid bonus as read, and XP's win op when it pays a win). One refused by a game landing at once is worked
   out again from the ledger and tried alone: 4 tries in all with these guards, then one with the bonus held to the day's 300 only,
   then logged. Never past 300; in a burst of many games of one account at once, some may be paid at an earlier step and the last ones
   may get nothing (the review's m1: 50 wins at once from mid-day; 4 to 10 at once paid what one after another pays).
2. **The day's totals are the ledger's own sums** (reasons `play` and `play-bonus`, from `xpDayStart` to the next day's), as XP's solo
   minutes are: no table. A room's late retry counts in its own game's day.
3. **`results.coins`** (a new nullable TEXT column, JSON `PlayCoins`): the result row keeps the game's coins beside its XP, so
   `GET /api/xp` answers them (the Squads end screen now; PR 3's strip). Stored data: this PR is in the full lane.
4. **"Held by fair play" is review or banned** (as ranked's coins were): no coins; XP stays its own rule (banned only).
5. **Solo, and an online game on one device's word** (XP's "solo" cap): the minutes XP paid under its 120-minute cap, no minimum of 1
   (so solo can never pass 216 a day by many short games) and no bonus. **A Squads squad on its own party's devices' word**
   (`SquadsRecord.unvouched`: only its devices moved its match's bots) too, for its coins (`XpGame.soloCoins`; XP keeps its own
   rules): no placement bonus (the director's call on the review's m2). Its crates stay Eric's Nov 10 "paid as any", under the 5 a
   day; the old 5-a-day cap on Squads' coins, which bounded that, is gone, so its coins go the solo way.
6. **Squads:** the placement is the bonus; 1st pays 40, never the win's 15 too (the design's "1st 94"). A member who resigned or left
   gets no placement bonus (their old reward paid nothing either). The "placed" message's `coins` stays 0 for apps from before.
7. **50 v 50 top 3:** the first 3 rows of your team on the leaderboard at the end, bots' seats counted; not in a boss battle.
8. **The steps, rounded per game:** a game's bonus moves the day's paid total to the steps' value at the earned bonus it stands for
   plus this game's, rounded (half up); the paid total is the only state, and the day can never pass 300. (A win: 15, then 8 for 7.5,
   then 4 for 3.75, then 0.) The rounding isn't carried over, so a day can run a few coins off the steps' exact curve: only wins
   reach 300 at the 35th, not about the 37th; only draws run up to 16.5 ahead midway and reach it at the 113th, not the 110th (the
   review's m4 corrected an earlier "never drifts").
9. **Ranked's `coin_day` and `coin_games`** stay on the row with what they had, no longer read or moved (no destructive migration).
10. **The FAQ gives no per-minute numbers** for coins either (Eric's XP rule, Nov 9: "we dont want players to know they could just
    stall"): "more for a longer game, up to 54 a game".

**The review's fixes** (Nov 25; `REVIEW.md` on `review/pay-play-coins`):

11. **A failed D1 call never costs a game its coins (M1).** grantXp throws when settling its coins fails, as when its batch does;
    every op is keyed, so the caller's next try pays once. Ranked: `withXp` tries a grant 3 times at once; still failing, the room
    keeps `recordDuel`'s answer (`DuelRecord.ranks`) and its next try (15 s, then every minute, up to 24 h) goes on from it, never
    recording the game twice (a replay of `recordDuel` would answer no rank-point change). Squads: the reward waits for its XP and
    coins up to `MATCH_SAVE.strictMinutes` (30) after its first failed write (`failedAt`), then goes without them, logged, as a 50 v 50
    result does. Solo has no retry (its game is ended before the grant): there a failure settling the coins now costs the result its
    XP box (the XP and coins that went in stay in), as a failed batch always did; a share a race refused isn't tried again there.
12. **A game the code before this PR paid coins for pays none again (m3):** the coin ops also need `ranked:<duel id>:<color>`
    (that account's) and the Squads reward op's coins leg absent; `settleCoins` then doesn't try again.
13. **Squads' crate cap counts only lobbies that pay crates (n3):** 1st and 2nd. Before, a 3rd-8th place (which paid coins) used up
    one of the day's 5 too; now it doesn't, which loosens the cap a little.
14. **For PR 3 (n5):** `PlayCoins.step` is worked out from the day as it stands when the grant answers (a replay later in the day
    answers a later one); the result row keeps the first answer, so the strip reads the row.
15. **The day's reads by index (n7):** `ledger_reason (account, reason, created_at)`, made by the schema run as every index is
    (`LEDGER_SCHEMA`), serves play coins' day sums, XP's solo caps and Squads' crate cap (checked with `EXPLAIN QUERY PLAN`).

**The delta review's fixes** (Nov 25; `DELTA-REVIEW.md` on `review/pay-play-coins-delta`; the director's calls,
`notes/briefs/payments-pr2-delta-fixes.md`):

16. **A game pays at most one daily reward (N1).** The daily op (`daily:<day>:<ledger id>`) was keyed by the day only, so a grant tried
    again after the XP day rolled over (ranked's retry since M1; a Squads reward written again since Nov 9) paid the new day's too.
    Its guard now needs no `daily` leg of this account naming this game (`rewards.ts dailyOp`, served by `ledger_reason`), and the
    grant reads the game's daily reward by the game, so the replay answers the one it paid. Fixed at the cause, for every caller,
    rather than giving each caller a fixed time.
17. **Squads' reward queue shares one window (N2, Squads).** A failed write marks every reward still waiting (`failedAt ??= now`), so a
    lasting grant fault holds the lobby's rewards `MATCH_SAVE.strictMinutes`, not that long for each one after another.
18. **Known pre-launch limit: ranked has no lenient window (N2, ranked; a follow-up, not this PR).** A grant that fails every time (a bug
    in `grantXp`, a statement D1 always refuses) fails each recording try for `RANKED_1V1.recordRetryHours` (24): the players get no
    outcome message (the rank change itself is stored), and at 24 h the room closes saying the game was never recorded, although it
    was. The fix (stamp the first failed XP try beside `ranks`, then send the outcome from the kept ranks without XP, logged and
    counted, as `soft()` does) is hold-and-release logic, so it gets its own PR. A short D1 outage isn't affected.
19. **The ranked old-key guard searches the primary key (N3):** `AND leg = 0` (the old op had one leg), so it no longer reads the
    account's whole ledger. Left as the review allowed: N4 (solo's settle failure costs the box, call 11), N5 (no test of the 4th
    strict try).
