# The ranked ladder for every mode (design, Nov 9, 2026)

A design for Eric's Nov 9 questions: ranks in 1 v 1, Duo (2 v 2, coming), Squads and 50 v 50, what "MMR" means, leaving and
dodging, bots taking a leaver's seat, the rating math, tiers and seasons, the result screens, and abuse. No game code is
changed by this doc. Mockup: [assets/ranked-ladder-results.html](assets/ranked-ladder-results.html) (render it in a browser; its picture is in the director notes, notes/briefs/assets/ranked-ladder-results.png, since images stay out of docs/).

Built today and kept as is: ranked 1 v 1 ([docs/areas/ranked.md](../areas/ranked.md)): a hidden Glicko-1 rating, the
visible ladder Wood → Radiant (five divisions of 80 RP each), Pearlescent (top 500) and Transcendent (top 100), 5
placements, "+18" on the result card, `RANKED_1V1` in settings.ts.

---

## Summary for Eric: your decisions, with my recommendation

| # | Decision | My recommendation | Why, in one line |
| --- | --- | --- | --- |
| 1 | One rank per mode, or "main + flex"? | **Decided (Eric, Nov 9): yes.** **A separate rank per mode** (1 v 1, Duo, Squads, 50 v 50). 1 v 1 is your **main rank**: home shows it, and it comes first on the profile. | The modes test different skills. Each mode has its own queue anyway, so separate ranks don't make anyone wait longer. A new mode starts from your other ranks, so placements stay short. |
| 2 | What is "MMR"? | **Decided (Eric, Nov 9): MMR is shown.** MMR = the skill number behind matchmaking, one per mode, all on the same scale (1500 to start, like chess ratings). The rank (tier, division, RP) leads; **beside each mode's rank on a profile, in gray, "MMR 1612"**. Eric: "There's no reason for us to hide it from the players. I'm not a fan of hiding MMR." | That's the meaning LoL, Valorant and Dota give it. Keeping it hidden lets RP absorb leave fees and season resets without bending the skill number. |
| 3 | 1 v 1 time controls | **One 1 v 1 MMR** for every time control, as you said. Nothing changes. | Already built that way. The vote picks the control, so nobody can farm one control. |
| 4 | Leaving | **Decided (Eric, Nov 9): yes, as written.** **Dodge** (leaving after the match is found but before both first moves) = **−5 RP** (−10 if repeated), no MMR change, a mark on your record, and a short lockout that grows if you keep doing it. **Leave** (after the game starts) = a **full loss** plus **−10 RP**. **Three or more leaves in your last 20 ranked games puts you in the delayed queue** (an extra wait before you're matched), longer at each step. | LoL's dodge tiers and Overwatch's "last 20 games" window, scaled to our short games. Nobody comes out ahead by leaving. |
| 5 | A bot takes a leaver's seat | The bot plays at **the leaver's own strength minus 100, never above it** (from their judged moves), using the bots we already have. **Teammates lose less** because the rating math knows they had a weaker bot. The leaver takes the worst result plus the leave fee. | It reuses `botSkillForRating`, so there's no new engine work. Apex's "loss forgiveness" falls out of the math with no special case. |
| 6 | The math | **Keep Glicko-1 for 1 v 1.** Use **OpenSkill** (Weng-Lin, npm `openskill` 4.1.1, **MIT**, about 8 KB minified, server only) for Duo, Squads and 50 v 50. Not TrueSkill: it's patented and Microsoft only licenses it for Xbox or non-commercial use. | OpenSkill handles any number of teams of any size, ties, and 100-player placements (about 3 ms an update). It's the open cousin of TrueSkill. |
| 7 | Tiers, seasons, decay | **The same tiers and emblems for every mode, with the same MMR → tier mapping** (Pearlescent starts at 2400 MMR plus a top-500 place; that's our "3000 is grandmaster", and yes, the number is arbitrary). **Three-month seasons.** A season keeps your MMR but drops your visible rank one tier. **No RP decay.** Only the top two tiers need recent games to keep their place. | Simple, and the same in every mode. Players re-climb a little each season, which is the fun part, and nobody loses points for taking a break. |
| 8 | The result screen | In every mode: **the result → the rank line (emblem, "Gold 2 · 45 RP (+18)", one note line) → the XP box → the buttons.** One shared component in a fixed-height row. Ranked Standing on the profile gets four tabs. | Matches what 1 v 1 already shows. Nothing moves when the numbers arrive (your "nothing shifts" rule). |
| 9 | Abuse | Party rank-gap limits in Duo and Squads, never pairing friends or same-device accounts in 1 v 1, RP shrinking after the 3rd game against the same opponent in a day, seeding new accounts from their judged moves (anti-smurf), and flags to fair play. Details in section 9. | Each rule closes a known exploit from LoL, Valorant or chess.com, using signals we already have. |

**Things only you can decide:** (1) and (2) above. Also whether the RP fees in (4) feel right (they're tunable in one
settings block), whether a season reset should drop one tier or none (7), and the **season length**. Everything else
has a default I'd go with.

**Build order** (section 14; every file it touches: section 12): the shared ladder and leave rules first (1 v 1 dodges are open right now: aborting during
the time-control vote costs nothing), then Squads, then 50 v 50, then Duo when it exists.

---

## 1. Ranks per mode

### What other games do, and why

| Game | Setup | Their reason |
| --- | --- | --- |
| League of Legends | **Solo/Duo** and **Flex** (groups of 1, 2, 3 or 5) are separate queues with separate ladders and MMR. Solo/Duo is "the" rank. | Premade groups would distort the solo ladder; Flex is for playing with friends. ([LoL wiki](https://leagueoflegends.fandom.com/wiki/Ranked), [Surrender@20, 2017 changes](https://www.surrenderat20.net/2016/10/riot-pls-ranked-pls-2017-season-ranked.html?m=1)) |
| Valorant | **One** competitive rank, solo or party; parties are limited by rank gap, and mismatched 5-stacks get 25% less RR. | One rank everyone understands; party rules stop boosting. ([Riot Competitive FAQ](https://support-valorant.riotgames.com/hc/en-us/articles/360047937633-VALORANT-Competitive-Mode-FAQ)) |
| Dota 2 | Had **solo MMR and party MMR**; merged them in 2019 (then added role MMR). | Separate solo MMR pushed people away from playing with friends ("Dota is a very teamplay heavy game"). Controversial; solo players felt party MMR wasn't taken seriously. ([GamingOnLinux](https://www.gamingonlinux.com/2019/08/dota-2-is-going-through-some-big-changes-to-matchmaking/page=1/), [AFK Gaming](https://afkgaming.com/dota2/news/2185-valve-revamps-ranked-matchmaking-no-more-solo-party-mmr)) |
| Rocket League | A separate MMR and rank for **1s, 2s and 3s**. | They are different games; a strong 1s player isn't automatically a strong 3s teammate. ([Dot Esports](https://dotesports.com/news/rocket-league-mmr-and-ranking-system-explained)) |
| Overwatch 2 | A separate rank **per role** (tank, damage, support). | Each role plays differently; you can learn a role without dragging your others down. ([ONE Esports](https://www.oneesports.gg/overwatch/overwatch-2-rank-system-explained-2024)) |
| Lichess / chess.com | A separate rating **per time control**. | A rating per kind of game predicts better. ([Lichess forum](https://lichess.org/forum/lichess-feedback/seperate-rating-systems-for-different-time-controls)) We chose otherwise for 1 v 1 (point 3), and that's fine because the vote mixes controls fairly. |

The pattern: **games split ranks where the skill differs** (Rocket League, Overwatch, chess sites) and **merge them where
splitting hurts playing with friends** (Dota). LoL keeps both: one "real" rank plus a looser team rank.

### Our modes are different skills

- **1 v 1**: your own chess, every move.
- **Duo** (2 v 2, coming): chess with a partner.
- **Squads**: 8 squads of 4 in a bracket, team clocks, Relay and Pairs boards.
- **50 v 50**: you pick moves in a crowd of 50. Your **own placement** (1st to 100th, set by your picks' scores through
  the cuts) is mostly yours, but the move played is the crowd's.

A "flex" rank combining Squads and 50 v 50 would mix a bracket of 4-player teams with a 100-player vote. The number
would predict neither one well, and matchmaking in each queue would use a number mostly earned somewhere else.

### Recommendation: all separate, with 1 v 1 as the main rank

- **Four ranks:** 1 v 1, Duo, Squads, 50 v 50. Each has its own MMR, ladder, placements, peak and record. They share
  the tiers, emblems, seasons and leave rules.
- **Separate ranks cost no queue time.** Each mode already has its own queue, so a combined number wouldn't put more
  players in any one queue.
- **No grind to place:** a mode you've never played starts from your best-known skill (your 1 v 1 MMR if it has
  settled, else your move-quality rating `users.rating`, else 1500). Its uncertainty starts wide, so it settles in a
  few games.
- **The main rank** (your "main rank, your actual ELO from 1v1"): home's line under your name and the versus screen
  show the 1 v 1 rank. Someone with no 1 v 1 games shows their most-played mode's rank with a small mode tag
  ("Squads · Gold 3"). The profile shows all four.
- **If you'd rather have fewer:** the fallback is three ranks, with 1 v 1, a **Team** rank (Duo and Squads, both team
  chess on boards) and 50 v 50. I wouldn't fold 50 v 50 into anything.

## 2. "MMR": what's called what

| Word | What it is | Who sees it |
| --- | --- | --- |
| **MMR** | The skill number, one per mode: today's 1 v 1 "hidden rating" (Glicko-1 `rating`), and OpenSkill's μ for the other modes. All on one scale: 1500 to start, where a gap means the same thing as a chess rating gap. Comes with an uncertainty (Glicko RD, OpenSkill σ). | Everyone (Eric, Nov 9): in gray beside each mode's rank on a profile, "MMR 1612" (rounded; placements show it once placed). Admins also on the fair-play page. |
| **RP** (rank points) | The visible points inside a division (0-79), as built. | Everyone. |
| **Rank** | Tier and division ("Gold 2"), or a top tier. | Everyone. |
| **Ladder** | The single stored number behind a rank (division index × 80 + RP), as built. | Code only. |
| **Strength** | The move-quality rating from the judge (`users.rating`, "Rating 1612" on the profile). Not a rank. | Everyone, as today. |

- In code and docs, rename "hidden rating" to **MMR** as files are touched (`RANKED_1V1.rating` keeps its stored
  columns: `ranked_1v1.rating`, `rd`). No stored data changes for the name.
- **Shown, not hidden (Eric, Nov 9).** The recommendation was to hide it (LoL and Valorant do, to avoid "my MMR went up but my RP
  went down"); Eric: "There's no reason for us to hide it from the players. I'm not a fan of hiding MMR." So every profile shows
  each mode's MMR in gray beside its rank. RP still carries leave fees and season resets; MMR stays the honest skill estimate. The
  FAQ explains the difference in one line ("Your rank is your ladder progress; MMR is the skill number we match you by").
- **Two numbers named like ratings:** the profile already shows Strength ("Rating 1612", the judge's move quality). Next to "MMR",
  it reads as a third rating. When MMR lands on the profile, the Strength line is relabeled (e.g. "Move quality 1612") so the two
  aren't confused.

## 3. 1 v 1 time controls

No change: one 1 v 1 MMR, whatever the vote picks. The vote's rule (halfway between the two picks) means neither player
controls the time control, so nobody can farm their best one. The control is stored with each game (`control`), so if
it ever matters, a per-control **display** (win rate by control on the profile) costs nothing extra.

## 4. Leaving: dodges, leaves, and the delayed queue

### Today's gap

In 1 v 1, leaving before both players have made their first move is an **abort**: no result, no rank change
(`canAbort`, `duel/rules.ts`). That includes the versus screen, the time-control vote and the overlay. Someone who
dislikes the voted control, or the opponent's rank on the versus screen, can leave for free and queue again. That's
exactly the case Eric described.

### What others do

- **LoL dodges** (leaving champion select): Ranked tier 1 is a 6-minute lockout and −3 LP, tier 2 is 30 minutes and
  −10 LP, tier 3 is 12 hours and −10 LP. Tiers drop by one every 12 hours. The first tier is light "to spare players
  with real emergencies". ([Riot dev post, Jul 2021](https://www.leagueoflegends.com/en-us/news/dev/dev-tackling-queue-dodging/))
  No MMR change for a dodge.
- **Valorant:** AFK and dodges cost 6-24 RR plus a 3-240 minute queue timer, with ranked restrictions for repeat
  offenders. ([Riot support](https://support.riotgames.com/en-us/valorant/penalties/be-on-your-best-behavior), [Riot dev update](https://playvalorant.com/en-us/news/dev/valorant-systems-health-series-afk-and-queue-dodge-update/))
- **Overwatch 2:** penalties are counted over your **last 20 games**. In Unranked, 2-3 leaves give a 2-minute
  suspension, rising to 10 minutes, 2 hours, then 48 hours. Competitive escalates further, up to a season ban.
  ([Blizzard support](https://support.blizzard.com/en/article/31268), [Defense Matrix post](https://overwatch.blizzard.com/en-us/news/24009615/defense-matrix-deterring-leavers-in-overwatch-%202))
- **Dota 2:** abandons send you to **low priority**: a number of games you must finish in a restricted queue before
  ranked opens again. ([esports.gg](https://esports.gg/news/dota-2/what-is-low-priority-in-dota-2-and-how-to-get-out-of-it))
- **Apex:** leaving early is an abandon (lost RP plus a penalty). Teammates of a matchmade leaver get **loss
  forgiveness**, but never if the leaver was in their party.
  ([Apex wiki](https://apexlegends.wiki.gg/wiki/Ranked), [EA Series 4](https://ea.com/games/apex-legends/news/ranked-series-4-details))
- **Lichess:** too many aborts or abandoned games bring a "playban" that grows with repeats.
  ([Lichess forum](https://lichess.org/forum/general-chess-discussion/how-many-times-does-it-take-to-ban-you-if-you-keep-on-aborting-games))

### The rules (every ranked mode)

**Dodge**: you leave after the match is found but before the game really starts.

- **1 v 1:** from "found" until both first moves: pressing Abort, closing the app, or not making your first move in
  time. (The game is still called off as today: no result for anyone.)
- **Team modes:** before move 1 (during the pre-game votes).
- **What it costs:**
  - **No MMR change.** A game that never happened says nothing about skill.
  - **RP:** −5 for the first dodge, −10 while you're at dodge level 2 or more.
  - **A dodge mark** on your record (it counts as a leave in the last-20 window).
  - **A lockout** (below).
- **The other player(s):** nothing lost, and they go straight back into the queue at the front ("Your opponent left.
  Finding another…"). The 1 v 1 queue already puts a failed pair back at the front.
- **No-shows** (never connecting within `joinSeconds`): same as a dodge for the one who didn't come.

**Leave**: you go after the game has started.

- **1 v 1:** resigning stays an honest loss with no mark (it's chess). Abandoning (disconnected and never back while
  your clock runs out) is a loss **plus a leave mark and −10 RP**. So is a "quick resign": resigning before your 3rd
  move, which is a dodge in disguise.
- **Team modes:** leaving, being removed as away (`LEAVING.awayMs`), or 50 v 50's AFK rule (4 misses).
- **What it costs:** the **worst result you could still get** (1 v 1: a loss; Squads: `worstPlacement`, as today; 50 v
  50: the last place still open, as today; Duo: a loss), counted in **MMR as a real loss**, then **−10 RP** on top, and
  a leave mark.
- **Not marked:** a leave after you're already out (cut in 50 v 50, your squad knocked out), and leaving a finished
  game.

**Dodge lockout** (short-term, like LoL; one dodge level per account, shared by every ranked queue):

| Dodge level | Lockout before you can queue ranked | RP |
| --- | --- | --- |
| 1 | none, just a warning: "Left before the game started: −5 RP" | −5 |
| 2 | 5 minutes | −10 |
| 3+ | 30 minutes, then 2 hours, 12 hours at most | −10 |

The level drops by one every 12 hours without a dodge (LoL's 2021 change: daily dodgers hit limits sooner, and an
occasional emergency is forgotten quickly).

**The delayed queue** (Eric: "penalized in a delayed queue"): this counts leave marks (dodges and leaves) in your last
20 ranked games, across all modes. It applies to ranked queues only.

| Leaves in last 20 | Effect |
| --- | --- |
| 0-2 | nothing |
| 3-4 | **Delayed queue:** your ticket waits 2 extra minutes before it can be paired. The queue screen says why and counts down. |
| 5-7 | 5 extra minutes, and a note on home: "Finish games to clear this" |
| 8+ | Ranked locked for 24 hours. A second time in a season locks it for 7 days, and a fair-play case opens (watch). |

- **Getting out:** play clean games, and each one pushes an old mark out of the window (Dota's "finish games" idea,
  no timer to wait out).
- **Why a wait, not a separate low-priority pool:** with few players online, a separate pool of leavers would never
  fill. Dota and Overwatch have millions of players; we don't yet.

**Nobody gains by leaving:**

- Dodging to avoid a stronger opponent gains nothing. Points already depend on the expected result (a win against a
  stronger player pays more, a loss to one costs less), so a game's expected RP is about 0, and a dodge is −5.
- Dodging a time control you dislike gains nothing either. You'd lose maybe a few RP over the game; the dodge costs 5
  for sure, plus a mark.
- Leaving mid-game always costs more than finishing and losing (the worst result, plus 10).
- **Disconnect forgiveness:** a reconnect within the existing holds (`LEAVING.awayMs` 120 s, a 1 v 1 seat by account)
  is not a leave. A deploy or server error that ends a game marks nobody (the server knows when it was at fault).

## 5. Team modes: a bot takes the leaver's seat

**The bot's strength** (Eric: "can't be stronger than the player … roughly around their skill level"):

- `botRating = min(leaver's strength, leaver's mode MMR) − 100`, floored at 600.
  - *Strength* is `users.rating`, measured from their own judged moves, on the same scale the bots are tuned to
    (`botSkillForRating`, `BOT_LOBBY.skillAt`). It's the best "how do they actually play" number we have.
  - Taking the lower of strength and MMR, then 100 below that, means the bot is never stronger.
- **Which engine:** the one each mode already uses for bots, so there's no new engine work.
  - Squads (and Duo, if it plays on boards the same way): the bot engine's top moves, picked at the temperature that
    rating plays like (`botSkillForRating` → temperature). That's the same path `replacementBotSkill` takes today,
    with the fixed number replaced by the leaver's rating.
  - 50 v 50: `botPick` at that rating (one voice in 50, so precision barely matters).
  - Maia stays where it already runs (the 1 v 1 bot game, bosses). Using it for team seats would put a 24 MiB model on
    a device that isn't the leaver's. Stockfish's `UCI_Elo` floor (1320) is too strong for most leavers anyway, which
    is another reason to use the temperature bots.
- Squads' existing **reclaim** stays: if the person comes back, the seat is theirs again from the next half.

**Rating changes when a seat was part bot** (OpenSkill; section 6):

- **The leaver:** the worst result plus the leave fee (section 4), counted with full weight. Leaving never thins your
  own loss.
- **Teammates:** the expected result is worked out with the leaver's slot as a time-weighted mix:
  `slot μ = w × leaver's μ + (1 − w) × bot's rating`, where `w` is the share of the match the person actually played.
  The bot is weaker, so the team's expected result drops. A loss then costs teammates less, and a win pays a bit more.
  That's Apex's "loss forgiveness", earned by the math with no special case. Only real players' MMR is updated; the
  bot's never is.
- **RP for teammates:** on top of that, when a teammate left in the first half of the match, an RP loss is **halved**
  ("A teammate left: your loss was halved", shown in the rank line's note).
- **Party exception** (Apex's rule): the leaver's own party members don't get the halving, and their expected result
  is worked out **as if the leaver had stayed**. That stops one friend leaving early to cushion the others.
- **50 v 50:** placement is individual, so a leaver mostly affects themselves (placed last still open, as today). One
  bot in 50 doesn't change anyone's expected place enough to need any forgiveness.

## 6. The math

### Comparison

| System | Teams | Many teams / 100-player placements | Uncertainty | License | Notes |
| --- | --- | --- | --- | --- | --- |
| **Elo** | Hacks only (team average) | No | No | Public domain | Slow for new players; no way to say "we don't know yet". |
| **Glicko-1** (built, 1 v 1) | No | No | Yes (RD) | Public domain (Glickman's paper) | Right for one-on-one chess. Ours is about 60 lines in `core/ranked.ts`, tested. |
| **Glicko-2** (Lichess) | No | No | RD and volatility | Public domain | Lichess's version is itself disputed ([Lichess blog](https://lichess.org/@/Toadofsky/blog/lichess-ratings-are-not-glicko-2/x1bpwn38)); no gain over Glicko-1 for us. |
| **TrueSkill** (Microsoft) | Yes | Yes | Yes | **Patented; the name is trademarked; Microsoft licenses it only for Xbox or non-commercial use** ([Wikipedia](https://en.wikipedia.org/wiki/TrueSkill), [ts-trueskill README](https://www.npmjs.com/package/ts-trueskill)) | The MIT code ports don't cover the patent. **Avoid.** |
| **TrueSkill 2** (LoL now uses a TS2-style system) | Yes, with per-player stats | Yes | Yes | Microsoft research, no library | Needs per-player game stats and is heavy. Riot says it got new high-skill accounts to the right games in about 5 matches ([esports.gg](https://esports.gg/news/league-of-legends/league-of-legends-cracks-down-on-smurfs)). |
| **OpenSkill / Weng-Lin** | Yes, any sizes, uneven teams | Yes (Plackett-Luce), ties allowed | Yes (μ, σ) | **MIT** (paper: Weng & Lin, JMLR 2011; [paper PDF](https://www.csie.ntu.edu.tw/~cjlin/papers/online_ranking/online_journal.pdf)) | The open, patent-free cousin of TrueSkill, built for multi-team games. Benchmarks: close to TrueSkill's accuracy, several times faster ([OpenSkill paper, arXiv 2401.05451](https://arxiv.org/html/2401.05451v1)). |

### Individual contribution inside a team

- **None of the open systems measure it.** All of them rate the team's result and split the change by each member's
  uncertainty. TrueSkill 2 and Fortnite-style point systems use per-player stats (kills, placement), and Valorant
  briefly used performance in its RR but leaned off it at high ranks. OpenSkill's paper lists weights as future work.
  The JS library's `weight` option is declared in its types but **not used by any model in 4.1.1** (checked in the
  package source).
- **What we do:**
  - **50 v 50 is rated on your own placement**, which already *is* individual contribution: your picks' scores
    through the cuts. That's a 100-player free-for-all among the real players, exactly the Plackett-Luce use case. Bots
    are left out of the ranking (as the Oct 7 draft said), so they can't be farmed.
  - **Squads and Duo are rated on the team result**, every member equally, as LoL, Valorant and Dota do. A performance
    nudge from judged moves (capped at ±25% of the change) could come later, once Squads' moves are judged for fair
    play. Not at launch: it invites playing for your own numbers over the team.
  - **Share played** (`w`, section 5) scales a person's change. We apply it ourselves (`μ' = μ + w × Δμ`), a one-line
    wrapper, since the library doesn't.

### Recommended library

- **`openskill` 4.1.1** on npm ([npm](https://npmjs.com/package/openskill), [GitHub philihp/openskill.js](https://github.com/philihp/openskill.js)).
- **License:** **MIT**. Its three dependencies are MIT too: `ramda` 0.32, `gaussian` 1.3, `sort-unwind` 3.1.
- **Size:** the package unpacks to 489 KB (source maps, types and both module builds). What we'd actually bundle (`rate`,
  `rating`, `predictWin`, Plackett-Luce and Bradley-Terry, ramda tree-shaken) measured **7.9 KB minified, 3.3 KB gzipped**.
- **Where it runs:** the server only (the Worker that records results), never in the app. Measured in Node: one
  100-player Plackett-Luce update takes about **3 ms**; a Squads update (8 teams of 4) is far less.
- **Settings:** `{ mu: 1500, sigma: 350 }` to share the 1 v 1 scale; `beta` and `tau` tuned by the sim (phase T1). We
  add what it lacks ourselves, each a few lines in `core/ranked.ts`:
  - a σ floor (like `minRd` 60);
  - idle growth of σ (`rdPerDay`, as built);
  - the share-played weight;
  - the bot's fixed rating in a slot.
- **Which model:**
  - Plackett-Luce for Squads (8 teams, ranks `[1,2,3,3,5,5,5,5]`) and 50 v 50 (placements).
  - Bradley-Terry (full) for Duo's two teams.
- **Measured** (equal settled players, σ 100): Squads 1st +11.6, 2nd +9.7, 3rd-4th +0.9, 5th-8th −5.8. In a 60-player
  free-for-all, 1st gains +6, 30th +2, and last loses −24 (Plackett-Luce is harsh on last place). That's why RP below
  uses its own symmetric rule rather than the raw MMR change.
- **1 v 1 stays on our Glicko-1.** It's built and tested, and for two players OpenSkill's Bradley-Terry model is "similar
  to Glicko" anyway. Moving it would change stored meaning for no gain.
- Never copy GPL/AGPL code: OpenSkill is MIT, and our Glicko-1 is our own. (The Maia box stays its own AGPL program, as
  now.)

### RP: one rule for every mode

The built 1 v 1 rule, generalized:

`RP = 2 × 20 × (result − expected) + catch-up`

- **Result** (0 to 1):
  - 1 v 1 and Duo: win 1, draw ½, loss 0.
  - Squads: the share of the other squads you finished ahead of (ties count half): 1st = 1, 2nd = 6/7, 3rd-4th ≈ 0.64,
    5th-8th ≈ 0.21.
  - 50 v 50: the share of the other real players you finished ahead of.
- **Expected:** the same, predicted from MMRs.
  - 1 v 1: Glicko's expected score (as built).
  - Duo: `predictWin`.
  - Squads and 50 v 50: the average pairwise expected score against each other squad or player, `1 / (1 + 10^((μ_j − μ_i)/400))`.
- **Catch-up:** as built, 0.05 × (MMR − the ladder's MMR), within ±10.
- So ±20 is a typical game everywhere, and RP is symmetric even where Plackett-Luce's MMR change isn't.
- A win never takes RP, a loss never gives it (as built). In placement modes, finishing above expectation never takes RP.

## 7. Tiers, MMR → tier, placements, seasons, decay

- **The tiers and emblems are the same for every mode.** No new art.
- **One mapping for all modes at launch** (as built): `ladder MMR = 800 + ladder × 4/7`.

  | Tier | Starts at (MMR) |
  | --- | --- |
  | Wood 5 | 800 |
  | Silver | ≈1029 |
  | Gold | ≈1257 |
  | Paragon | ≈1486 |
  | Illustrious | ≈1714 |
  | Sublime | ≈1943 |
  | Radiant | ≈2171 |
  | Top-tier floor | 2400 |

  - Pearlescent and Transcendent are the top 500 and top 100 **of that mode**, from 2400.
  - Eric's "3000 MMR is grandmaster" is the same idea: yes, it's arbitrary. Ours is "2400 and the top 500".
  - After a season, if a mode's MMRs bunch up (50 v 50's placements may give a narrower spread than chess results),
    that mode gets its own two numbers (`baseRating`, `ratingPerPoint`) so its tiers fill like the others'. One
    settings edit.
- **Placements per mode:**
  - 1 v 1 and Duo: 5 games.
  - Squads and 50 v 50: **3 matches** (long matches, and each one compares you with many players).
  - Seeded as in section 1, capped at Radiant 5 (as built).
  - A dodge doesn't count as a placement game; a leave does (as a loss).
- **Seasons** (the profile already says "Season 1"):
  - **Three months**, the same dates for every mode.
  - **At a reset:**
    - MMR is kept, its σ widened a little (to at least 150) so everyone moves faster for a few games.
    - The **visible rank drops one tier** (400 ladder points, never below Wood 5 0). The catch-up term brings players
      back near their MMR within a dozen games.
    - No placements again.
    - Top tiers are recounted.
  - **Rewards are cosmetic only:** a season-peak emblem frame and title per mode. The season's peak is stored.
  - Rocket League and Fortnite soft-reset the same way ([Fortnite ranks](https://esports.gg/guides/fortnite/fortnite-ranks/)).
- **Decay: none for RP.**
  - Idle time already widens uncertainty (`rdPerDay`), so a returning player moves faster.
  - **Only Pearlescent and Transcendent** need **5 ranked games in that mode in the last 14 days** to hold a top-tier
    place. Otherwise they show as Radiant 1 (their RP intact) until their next game, so the top 100 stays live.

## 8. The post-game screen and the profile

**Mockup:** [assets/ranked-ladder-results.html](assets/ranked-ladder-results.html) (dark, 360 px phone; its picture: the director notes, notes/briefs/assets/ranked-ladder-results.png).


- **One order everywhere:** the result (title and reason) → **the rank line** → **the XP box** (as built) → the buttons.
- **The rank line** is one shared component (`RankChange`, lifted from Duel.tsx's `rankLine` and the emblem), in a
  **fixed 56 px row**:
  - the 48 px emblem after the game (a promotion shows the new one);
  - "Gold 2 · 45 RP (+18)", with coins after it when they fit, else on the note line;
  - **one muted note line that's always there** (blank when there's nothing to say):
    - "Blitz 3+2";
    - "A teammate left: your loss was halved";
    - "Squad was 4th of 8 going in";
    - "Ahead of 81% of the 64 players";
    - "Left: worst result and −10 RP";
    - "Placement 2/3".
  - "Updating your rank…" holds the same row, so nothing moves when the outcome arrives.
- **Per mode:**
  - **1 v 1** as built.
  - **Duo** like 1 v 1.
  - **Squads:** on the knocked-out card and the results.
  - **50 v 50:** on Results, under the placement.
  - **A raid and Classic stay unranked:** no rank line, and no empty row either, since those screens never had one.
- **A dodge has no result screen.** Home shows a one-line note where home's notes go: "You left before the game
  started: −5 RP". With a lockout or delayed queue, the queue screen shows the countdown where its wait line is.
- **The profile's Ranked Standing** (built with "1v1 / 50 v 50 / Squads, Coming soon"):
  - four tabs (**1v1 · Duo · Squads · 50 v 50**), the same card for each (emblem, tier pill, RP, peak, W-L or
    placements, streak, and **leaves in the last 20**: my call to make it public, because it tells others whether
    you finish games);
  - a mode you haven't played reads "Unranked · play 5 to place" in the same room;
  - "Coming soon" stays on Duo until Duo exists.
- **Home** shows the main rank (section 1).

## 9. Fair play and abuse

| Abuse | What stops it |
| --- | --- |
| **Win trading** (two accounts feeding each other 1 v 1 wins) | **Built:** points depend on the expected result (trading stalls), never two accounts from one device, and fair play's checks. **Add:** (a) never pair two accounts that are **friends** (once friends exist) in ranked 1 v 1 or as opponents in Duo; (b) from the **4th ranked game between the same two accounts in a UTC day, 0 RP and 0 MMR** for both; (c) flag pairs with many short games (resign or abort in under 10 moves) to fair play as a signal. |
| **Queue sniping** (friends queueing together to meet) | With few players they'll often meet anyway. (a) and (b) above take the profit out. |
| **Smurfs** (a strong player on a new account) | **Seeding from judged moves:** a new account's starting MMR in a mode comes from its move-quality rating once it has one, not 1500. A smurf's first games are already near their real level, and the wide σ finishes the job (Valorant's smurf work got smurfs to their right MMR 2-3× faster the same way: [ONE Esports](https://www.oneesports.gg/valorant/valorant-automated-smurf-detection)). **Add:** ranked queues need **Level 2** (1,000 XP, about 100 minutes played) for new accounts. Accounts with ranked games already are grandfathered, so nobody loses 1 v 1 access. A throwaway costs time. |
| **Boosting in teams** (a high player carrying a low friend) | **Party rank-gap limit** in ranked Duo and Squads, like Valorant's (gaps of 2-3 tiers allowed; [Riot FAQ](https://support-valorant.riotgames.com/hc/en-us/articles/360047937633-VALORANT-Competitive-Mode-FAQ)): **at most 2 tiers** between the highest and lowest member; Pearlescent and Transcendent only with Radiant or above. Team MMR is the members' sum, so a lopsided party is expected to win: small gains. |
| **Queue dodging** | Section 4. |
| **Alt accounts** | Built: fair play's linked sign-in identities and the device cookie (a banned player's device puts new accounts in review). Add only a **flag** (not a block) when one device plays ranked on 2+ accounts in a season, because families share devices. |
| **Throwing / sandbagging** (losing on purpose to play weaker people) | The catch-up term and expected-result points make it slow. Chess.com treats sandbagging as rating manipulation and closes accounts ([chess.com help](https://support.chess.com/en/articles/8583380-what-is-a-sandbagger)). Our signal: quick resigns count as leaves (section 4); a fair-play signal for a run of losses with far worse moves than the player's own strength (the judge knows). |
| **A cheater's victims** | Built: a held player's games don't move their rank. **Add later** (chess.com refunds opponents): when someone is banned, RP their ranked opponents lost to them in the last 30 days is given back. MMR is left alone, since it re-settles by itself. |

All flags go to the `fairplay` lane's review page. None of these ban automatically.

## 10. Stored data it needs (full lane: D1 schema and migrations)

Additive only; nothing existing changes meaning.

- **`ranked_ratings`** (new): `user_id, mode ('duo'|'squads'|'crowd'), mu, sigma, games, wins, losses, draws, ladder,
  peak, streak, placements_left, last_at, season`, PK `(user_id, mode)`, index `(mode, ladder)` for top tiers.
  - 1 v 1 stays in `ranked_1v1` (no migration of a working table). Reading code puts the two together into one
    `RankedSummary` per mode.
  - `ranked_1v1` gains `season`.
- **`results` rows** (already one per person per match, Squads and Crowd included) gain: `mmr_before, mmr_after,
  rp_change, share_played, conduct ('left'|'away'|'afk'|null)`. No new games table.
- **`ranked_conduct`** (new): `user_id, at, mode, kind ('dodge'|'leave'), match_id`; index `(user_id, at)`. The queue
  reads your last 20 ranked games' marks and your dodge level from this table plus a count of games played.
  - **Kept 90 days**, then purged by the existing cron.
  - In the download and the privacy policy: "leaving ranked games early, which can delay your queue".
- **`users`** (or `ranked_1v1`-style columns on a small table): `dodge_level, dodge_at` for the lockout tiers.
- **`ranked_seasons`** (`id, starts_at, ends_at`) and **`ranked_season_peaks`** (`user_id, mode, season, peak_ladder`).
- Deleting an account deletes its rows. A guest's merge carries them (as `ranked_1v1` does today).

## 11. Settings it adds (one block, `RANKED_MODES`, in settings.ts)

- Per mode:
  - `placements`;
  - the OpenSkill `mu, sigma, beta, tau, minSigma`;
  - `baseRating, ratingPerPoint` (the same as 1 v 1 to start);
  - `partyMaxTierGap`.
- `LEAVES`:
  - `dodgeRp: [5, 10]`, `leaveRp: 10`;
  - `dodgeLockoutMin: [0, 5, 30, 120, 720]`, `dodgeDecayHours: 12`;
  - `window: 20`, `delayed: [{ at: 3, waitSec: 120 }, { at: 5, waitSec: 300 }]`, `lockAt: 8`;
  - `quickResignMoves: 3`;
  - `teammateLossShare: 0.5`.
- `SEASONS`: `{ months: 3, resetTiers: 1, minSigmaAtReset: 150, topTierActive: { games: 5, days: 14 } }`.
- `ABUSE`: `{ samePairPerDay: 3, minLevel: 2 }`.
- The replacement bot: `botBelow: 100`, `botFloor: 600`.

## 12. Everything ranked touches

Eric (Nov 9): "be considerate of all the spots that we'll have to touch in the game that involve that as well." Every
place that ranks for 50 v 50 and Squads (and the leave rules, for 1 v 1 too) would change or add, with its file, so
build briefs can be written straight from it. "L1", "T2" and the other codes are the phases in section 14. Paths are
from main at 74b8def.

**Duo is parked** (Eric hasn't settled its design). Where it would slot in, nothing more:
- one more mode id (`duo`) in `ranked_ratings`, `RANKED_MODES` and `queueName`;
- one more tab in Ranked Standing (shown "Coming soon" until then);
- the shared rank line on its result screen;
- its own queue in `matchmaker.ts`;
- phase D1.

Nothing below waits on it.

### The front door (lane `hub`)

| Spot | Change | Files | Phase |
| --- | --- | --- | --- |
| Home's RANKED row (50 v 50 · 1 v 1 · Squads) and the line under PLAY | The line under the row shows the picked mode's rank ("Squads · Gold 3 · 45 RP", "Placement 1/3", "Unranked"). A lockout or delayed queue shows there, greying PLAY with its countdown (nothing hidden). | `packages/app/src/screens/Home.tsx` (the RANKED row, `onRanked1v1`, `rest()`), `packages/app/src/ranked.ts` (`ranked1v1Label`, `homeRankLine`) | L1, T2, T3 |
| Home's line under your name (the main rank) | The 1 v 1 rank, or your most-played mode's with a mode tag (section 1) | `Home.tsx`, `packages/app/src/ranked.ts` (`homeRankLine`, `yourRankShown`) | T2 |
| Home's note after a dodge | One line in home's note slot: "You left before the game started: −5 RP" | `Home.tsx`; the note's data from `/api/me` | L1 |
| The queue and its waiting screen | The delayed-queue countdown and the lockout in the wait line's place. A party over the rank gap is refused, with the reason on the party screen. | `packages/app/src/screens/Queue.tsx`, `components/DuelQueueBar.tsx`, `screens/SquadsParty.tsx`, `packages/app/src/duel.ts`, `squads.ts`, `net.ts` | L1, T2 |
| The 1 v 1 versus stage | Unchanged (it already shows ranks). Aborting from here becomes a dodge: the Abort confirm says "−5 RP" | `components/DuelStage.tsx`, `screens/Duel.tsx` (the match menu's Abort), `components/MatchMenu.tsx` | L1 |
| The match menu's Resign / Leave confirms (every mode) | In a ranked match the confirm says what it costs: "Leave: counts as a leave, worst result and −10 RP" / "Dodge: −5 RP" (the words only, same box) | `packages/app/src/components/MatchMenu.tsx`, `packages/app/src/match-exit.ts` | L1, T2, T3 |
| The public profile's Ranked Standing card | Four tabs (1v1 · Duo · Squads · 50 v 50); each mode's emblem, pill, RP, peak, W-L or placements, streak, leaves in the last 20; Duo "Coming soon" | `packages/app/src/screens/PublicProfile.tsx`, `public-profile.ts`, `public-profile.css`, `components/ProfileParts.tsx` | L2, T2, T3 |
| Your own profile and its rank pill | The same summary per mode | `screens/Profile.tsx`, `screens/PlayerProfile.tsx`, `components/DuelRankPill.tsx` | L2 |
| Recent Matches on the profile | A Squads or 50 v 50 row shows its RP change, as a ranked 1 v 1's does | `PublicProfile.tsx`, server `rankedSummary` / the profile route | T2, T3 |
| The emblem | No new art. `RankEmblem` is reused as is. | `components/RankEmblem.tsx`, `packages/app/src/emblems/` | — |
| The FAQ | The ranks entry covers every mode: one rank per mode, placements, the leave rules and the delayed queue, seasons. FAQ text must match the code exactly (high effort). | `packages/app/src/faq/content.ts`, `faq/markdown.ts`, `screens/Faq.tsx` | L1, T2, S1 |
| The privacy policy | Ranked ratings per mode, leave records (90 days), season peaks | `packages/app/src/screens/Legal.tsx` (`Privacy`) | L1, T2 |
| Admin's `?rank=` switch | Takes a mode (`?rank=squads:gold-3`) so every screen can be checked | `packages/app/src/ranked.ts` (`rankFromSwitch`), `test-switches.ts` | L2 |

### In the match (lane: the director)

| Spot | Change | Files | Phase |
| --- | --- | --- | --- |
| Squads' turn-order badges | Today: the 1 v 1 emblem and rating (Nov 7). In ranked Squads: the **Squads** rank's emblem | `packages/server/src/squads-do.ts` (`badgeOf`, `PlayerBadge`), `packages/chess/src/squads/protocol.ts`, `screens/SquadsMatch.tsx` (`sq-to-emblem`) | T2 |
| In-game strips and pills | 1 v 1's strip pill unchanged. 50 v 50's standings and lists show no rank (the board's room). Squads keeps its badge row. | `screens/Duel.tsx` (`DuelStrip`), `screens/Crowd.tsx`, `components/MiniTower.tsx`, `RaceTower.tsx` | — (deliberately unchanged) |
| 1 v 1's result card | The shared rank line (`RankChange`) in place of `rankLine` and the emblem; the note line | `screens/Duel.tsx` (`rankLine`, `rankAfter`, `dv-result-*`), new `components/RankChange.tsx`, `styles.css` | L2 |
| Squads' knocked-out card and results | The rank line above the XP box | `screens/Squads.tsx` (`SquadsXp` and its cards), `squads-view.ts` | T2 |
| 50 v 50's results | The rank line under the placement, above the XP box | `screens/Results.tsx` (`XpResult` beside it) | T3 |
| The XP box | Unchanged; the rank line sits above it | `components/XpResult.tsx` | — |
| Unranked games' screens (raids, Classic, solo, bot, town) | No rank line, as today | — | — |

### Server paths (lanes `ranked`, the director, `fairplay`, `ops`)

| Spot | Change | Files | Phase |
| --- | --- | --- | --- |
| The rating math (pure) | Generalized RP rule, OpenSkill wrapper (σ floor, idle growth, share played, bot slot), seeding, leave fees, dodge levels, the delayed-queue rule | `packages/core/src/ranked.ts`, new `packages/core/src/ranked-teams.ts`, `settings.ts` (`RANKED_MODES`, `LEAVES`, `SEASONS`, `ABUSE`) | L1, T1 |
| 1 v 1's dodge | An abort after "found" (or no first move, no-show) records a dodge for the one who left; quick resign and abandon record a leave | `packages/chess/src/duel/rules.ts` (`canAbort`, `finish` reasons), `packages/server/src/duel-room.ts`, `duel-do.ts`, `packages/server/src/ranked.ts` (`recordDuel`) | L1 |
| The queue: lockouts and the delayed queue | A ticket carries its player's earliest pairing time; the queue answers "locked" with when | `packages/server/src/matchmaker.ts` (`duelNext`, the Squads and Crowd queues), `queue.ts` (`Ticket`, `QueueCore`) | L1 |
| Pairing and lobbies by MMR | Squads: parties packed by squad MMR within the rank gap (`formSquads`); 50 v 50 fills as today, the lobby's MMRs only feed the rating | `packages/chess/src/squads/lobby.ts` (`formSquads`), `packages/server/src/squads-party.ts`, `matchmaker.ts`, `queue.ts` (`PAIR_BY_RATING`) | T2 |
| Reading each player's MMR as they join | One read per player on joining (as `joiningProfileOf` reads `users.rating`) | `packages/server/src/lobby-do.ts` (`joiningProfileOf`), `squads-do.ts` | T2, T3 |
| Recording a match's ranks | One D1 batch per finished match: each human's `ranked_ratings` row and the results columns. Retried as `recordDuel` is. | `packages/server/src/lobby-do.ts` (`saveResults`, `takeLeftResults`), `squads-do.ts` (rewards and results writes), `packages/server/src/ranked.ts`, `ranked-schema.ts` | T2, T3 |
| The bot that takes a leaver's seat | Its rating from the leaver (`min(strength, MMR) − 100`) in place of the fixed `LEAVING.botSkill` / `replacementBotSkill` | `packages/server/src/lobby.ts` (`handOver`'s bot, line ~983), `squads-lobby.ts` (`replacedByBot`, line ~1573), `squads-bots.ts`, `packages/chess/src/runner.ts` (`handOver`), `settings.ts` (`botSkillForRating`) | T2, T3 |
| The outcome message | Each mode's end message carries `{ before, after, points, placed, note }` as 1 v 1's `outcome` does (optional fields: older apps ignore them) | `packages/chess/src/duel/protocol.ts` (`DuelOutcome`), `packages/chess/src/squads/protocol.ts`, `packages/chess/src/protocol.ts` (Crowd's results) | L1, T2, T3 |
| `/api/me` and `/api/profile/:id` | `RankedSummary` per mode, the dodge level and any lockout | `packages/server/src/accounts.ts`, `ranked-schema.ts` (`rankedSummary`, `rankOf`, `topPlace`), `index.ts` | L2, T2 |
| Top tiers per mode | `topPlace` counts within a mode (index `(mode, ladder)`); the one-minute cache keyed by mode | `ranked-schema.ts` | T2 |
| Kill switches | `PAUSE_RANKED_SQUADS`, `PAUSE_RANKED_CROWD` (ranked off: the mode still plays unranked, says so); leave penalties off by `PAUSE_LEAVE_PENALTIES` if they misfire | `packages/server/src/kill-switches.ts`, `docs/areas/ops.md` | L1, T2, T3 |
| Seasons | The reset job (one tier down, σ widened), peaks, top-tier activity | `packages/server/src/index.ts` (`scheduled`), `ranked.ts` | S1 |
| The cron's purge | `ranked_conduct` after 90 days | `index.ts` (`scheduled`) | L1 |

### Fair play, accounts, admin

| Spot | Change | Files | Phase |
| --- | --- | --- | --- |
| Fair play's hold | A held player's rank doesn't move in any mode (as 1 v 1 today); `eligibleForRanked` covers every ranked queue | `packages/server/src/fairplay.ts`, `ranked.ts` | T2 |
| New flags | The same pair too often, quick-resign runs, one device on 2+ ranked accounts, losing runs with moves far below strength | `packages/server/src/fairplay.ts`, `fairplay-schema.ts`, `packages/core/src/fairplay.ts` | A1 |
| The case page | Shows each mode's rank, MMR and leave record | `packages/server/src/admin.ts` (`/admin/fairplay`) | A1 |
| Refunds after a ban | RP back to opponents of the last 30 days | `fairplay.ts`, `ranked.ts` | A1 |
| Account download | `ranked_ratings`, `ranked_conduct`, season peaks, the new results columns | `packages/server/src/account-data.ts` (`rankedDownload`, the results column lists `KEPT_RESULT`) | L1, T2 |
| Account delete | The same rows erased (`rankedErase`) | `account-data.ts`, `ranked.ts` | L1, T2 |
| Guest merge | The guest's ranks move to an account without them, as `ranked_1v1` does | `packages/server/src/ranked.ts` (the merge), `accounts.ts` | T2 |
| Ops admin | Counts: dodges and leaves a day, delayed-queue players, per-mode ranked games | `packages/server/src/ops-admin.ts`, `ops.ts` | L1 |

### Stored data (full lane)

The tables are in section 10. Where each schema lives:
- `packages/server/src/ranked-schema.ts` (`RANKED_SCHEMA`, `RANKED_COLUMNS`): `ranked_ratings`, `ranked_conduct`,
  `ranked_seasons`, `ranked_season_peaks`, `ranked_1v1.season`;
- `packages/server/src/accounts.ts` (`SCHEMA`, `COLUMNS`): the `results` columns and the dodge level on `users`.

Each goes in through the repo's usual fingerprinted migration (`ensureSchema`).

### Tests

| Kind | Where | Phase |
| --- | --- | --- |
| Unit (pure) | `packages/core/test/ranked.test.ts` (generalized RP rule, leave fees, dodge levels), new `packages/core/test/ranked-teams.test.ts` (OpenSkill wrapper, share played, the bot slot, party exception), `packages/core/test/bot-lobby.test.ts` (the replacement bot's rating) | L1, T1 |
| Server | `packages/server/test/ranked-store.test.ts` (records, races, retries, top places per mode), `matchmaker.test.ts` and `squads-queue.test.ts` (lockouts, the delayed queue, the rank gap), `squads-lobby.test.ts`, `squads-do.test.ts`, `lobby.test.ts`, `lobby-do-rating.test.ts` (recording, leavers), `account-data.test.ts` (download, delete, merge), `fairplay*.test.ts` (holds, flags), `fairplay-admin.test.ts` | L1-A1 |
| The duel rules | `packages/chess/test/` (the duel's abort reasons) | L1 |
| e2e (and `e2e/areas.json`: a new "Ranked" area mapping `ranked-teams.ts`, `RankChange.tsx` and the ranked server files to its specs) | `e2e/ranked-1v1.spec.ts` (a dodge from the vote, the note on home), `e2e/home-ranked.spec.ts` (the row's line per mode, the lockout), `e2e/public-profile.spec.ts` and `e2e/profile.spec.ts` (the four tabs), `e2e/squads.spec.ts` (the rank line on its cards), `e2e/crowd.spec.ts` (on Results), `e2e/resign.spec.ts` (the confirms' words), `e2e/faq.spec.ts`, `e2e/xp.spec.ts` (the box under the rank line), `e2e/fairplay.spec.ts`, `e2e/account-delete.spec.ts` | L1-T3 |
| The rating sim | `packages/sim/scripts/` (a new `ranked-teams-sim.ts` beside the 1 v 1 ranked sim; report `reports/ranked-teams.md`) | T1 |

### Docs

- `docs/areas/ranked.md` grows a "Every mode" part.
- `docs/areas/matchmaking.md` ("Ranking today" becomes this).
- `docs/areas/crowd.md` and `docs/areas/squads.md` (leaving, bots, results).
- `docs/areas/hub.md` (home and the profile card).
- `docs/areas/fairplay.md` (new flags, refunds), `docs/areas/accounts.md` (download, delete, merge).
- `docs/areas/ops.md` (kill switches).
- `docs/rules/eric.md`, if any rule's guard test changes.
- Each phase's decision file in `docs/decisions/`.

## 13. What I checked in the repo

- `core/ranked.ts` (Glicko-1, ladder, `pointsFor`), `RANKED_1V1`, `duel/rules.ts` (`canAbort`: the dodge gap).
- `docs/areas/crowd.md`: placements through cuts, `LEAVING`, the AFK rule, bots at `botSkillForRating`.
- `docs/areas/squads.md`: `formSquads`, `worstPlacement`, `noShowsBeforeBot`, reclaim.
- `docs/areas/hub.md` (Ranked Standing), `docs/areas/accounts.md` (XP, levels).
- `docs/areas/fairplay.md`, `docs/areas/engine.md` (Maia 600-2500, `playAtElo` 1320+).
- The Oct 7 draft in `docs/history/matchmaking-and-lobbies.md` (Weng-Lin for 100 players, bots left out, seasons). This
  doc follows it where it still fits.
- Measured `openskill` 4.1.1 in Node: update sizes, speed, bundle size. Read its source for `weight` (declared, unused).

## 14. Build order (phases sized for one helper each, one at a time)

| Phase | What | Lane, effort | Needs |
| --- | --- | --- | --- |
| **L1. Leave rules, 1 v 1** | Dodge vs leave in the duel room (abort after "found" = dodge; abandon and quick resign = leave), RP fees, the dodge lockout tiers, the last-20 delayed queue in the matchmaker, `ranked_conduct`, home's note and the queue countdown, privacy policy. Closes today's free dodge. | ranked + director; **full lane** (stored data); xhigh | Eric's OK on the fees |
| **L2. Shared rank line** | `RankChange` component (fixed row, note line) used by 1 v 1; Ranked Standing's four tabs ("Coming soon" in the same room). | hub; light/targeted; medium | — |
| **T1. Team math in core** | Add `openskill` (server only); `core/ranked-teams.ts`: rating wrapper (σ floor, idle growth, share-played weight, bot slot), the generalized RP rule, seeding; unit tests; a sim calibrating `beta`/`tau` (`reports/ranked-teams.md`). | ranked; targeted; xhigh | — |
| **T2. Ranked Squads** | `ranked_ratings`, results columns, seasons tables; a ranked Squads queue (party gap limit); recording per bracket placement; the bot at the leaver's strength; teammate forgiveness and the party exception; rank line on Squads' cards; placements. | ranked + director; **full lane**; xhigh | T1 |
| **T3. Ranked 50 v 50** | Individual placement among humans (`isRankedMatch` stays the gate); rank line on Results; leave/AFK marks; placements. | ranked + director; **full lane**; xhigh | T1, T2's tables |
| **S1. Seasons** | Season dates, the one-tier reset, peaks and cosmetic rewards (item-builder for the frames), top-tier activity rule. | ranked (+ item-builder); full lane; xhigh | L1, a season date from Eric |
| **A1. Abuse rules** | Same-pair daily cap, friends never paired, Level 2 gate, flags to fair play, refunds after a ban. | fairplay + ranked; full lane; xhigh | L1 (friends when they exist) |
| **D1. Ranked Duo** | When Duo exists: Bradley-Terry two-team update, party gap, rank line. | ranked; targeted; xhigh | T1, Duo's own build |

Each phase updates `docs/areas/ranked.md` (and the area of the mode it touches) and writes its decision file.

## Sources

- LoL dodge penalties: https://www.leagueoflegends.com/en-us/news/dev/dev-tackling-queue-dodging/
- LoL ranked (Solo/Duo vs Flex): https://leagueoflegends.fandom.com/wiki/Ranked, https://www.surrenderat20.net/2016/10/riot-pls-ranked-pls-2017-season-ranked.html?m=1, https://www.dodge.gg/news/ranked-flex-guide-2026
- LoL smurfs / TrueSkill 2: https://esports.gg/news/league-of-legends/league-of-legends-cracks-down-on-smurfs
- Valorant competitive FAQ (party limits): https://support-valorant.riotgames.com/hc/en-us/articles/360047937633-VALORANT-Competitive-Mode-FAQ
- Valorant penalties: https://support.riotgames.com/en-us/valorant/penalties/be-on-your-best-behavior, https://playvalorant.com/en-us/news/dev/valorant-systems-health-series-afk-and-queue-dodge-update/
- Valorant smurf detection: https://www.oneesports.gg/valorant/valorant-automated-smurf-detection
- Overwatch 2 leaver penalties: https://support.blizzard.com/en/article/31268, https://overwatch.blizzard.com/en-us/news/24009615/defense-matrix-deterring-leavers-in-overwatch-%202
- Overwatch 2 role ranks: https://www.oneesports.gg/overwatch/overwatch-2-rank-system-explained-2024
- Dota 2 low priority: https://esports.gg/news/dota-2/what-is-low-priority-in-dota-2-and-how-to-get-out-of-it
- Dota 2 solo/party MMR merge: https://www.gamingonlinux.com/2019/08/dota-2-is-going-through-some-big-changes-to-matchmaking/page=1/, https://afkgaming.com/dota2/news/2185-valve-revamps-ranked-matchmaking-no-more-solo-party-mmr
- Rocket League per-playlist MMR: https://dotesports.com/news/rocket-league-mmr-and-ranking-system-explained
- Apex loss forgiveness: https://apexlegends.wiki.gg/wiki/Ranked, https://ea.com/games/apex-legends/news/ranked-series-4-details
- Fortnite ranked: https://esports.gg/guides/fortnite/fortnite-ranks/
- Lichess ratings and playbans: https://lichess.org/@/Toadofsky/blog/lichess-ratings-are-not-glicko-2/x1bpwn38, https://lichess.org/forum/general-chess-discussion/how-many-times-does-it-take-to-ban-you-if-you-keep-on-aborting-games
- Chess.com sandbagging: https://support.chess.com/en/articles/8583380-what-is-a-sandbagger
- TrueSkill licensing: https://en.wikipedia.org/wiki/TrueSkill, https://www.npmjs.com/package/ts-trueskill
- OpenSkill: https://npmjs.com/package/openskill, https://github.com/philihp/openskill.js, https://arxiv.org/html/2401.05451v1, Weng & Lin 2011: https://www.csie.ntu.edu.tw/~cjlin/papers/online_ranking/online_journal.pdf
