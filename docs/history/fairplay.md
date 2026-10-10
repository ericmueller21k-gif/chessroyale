# History: Fair play

The decisions behind this area, moved here word for word from `DECISIONS.md` on Oct 10, 2026 (the housekeeping pass),
in the order they were made. This is the record of why. For how it works today, read [the area page](../areas/fairplay.md).

## Fair play (Oct 8, 2026)

Eric: catch players copying an engine (a second screen or phone running Stockfish) with a high success rate, aggressive
rather than lenient; anyone at super-GM strength for a game or two, or a run of superhuman moves after the opening,
should be banned; and a report system. Built by the `fairplay` delegate (`.claude/agents/fairplay.md`), in steps.

**Reports** (step 1)
- **Where:** Report on anyone's profile, which also opens from any name tapped in a match (the profile over the game).
  Reasons: Cheating, Offensive name or icon, Something else (`FAIRPLAY.reports.reasons`). Then "Thanks, we'll look
  into it."
- **One per reporter, player and match:** a report made in a match carries its lobby code. A second one in the same
  match says "You've already reported this player in this match" and isn't stored. From a profile outside a match,
  one per player a day. 20 a day per reporter (`perDay`).
- **Reports never ban anyone.** Every report opens a *watch* case (the player's matches are kept as evidence, once
  signals are recorded: step 2). Cheating reports from 3 different signed-in accounts within 7 days put the player in
  **review** (Eric, Oct 8); 2 for a new account (fewer than 10 online matches). My calls:
  - Only "Cheating" counts towards a review: review holds a player's results, which is a fair-play measure. Name and
    other reports put the player on watch, in the queue for a person.
  - Guests' reports are stored and read, but don't count towards a review (anyone can make guest accounts; online
    players are signed in anyway).
  - After a decision on a case (a clearing, say), only reports made since count again.
- **Review holds results off ranking** until cleared: entering review marks the player's online results from the last
  7 days `held` (`results.held`, `FAIRPLAY.holdBackDays`), and results recorded while in review are held too. Held
  results don't move the rating, its chart or "Top N%" (and later leaderboards and ranked); their stats still count, so
  a profile shows nothing about a case. Clearing counts them again.
- **`eligibleForRanked(sql, userId)`** (`packages/server/src/fairplay.ts`): false while a player is in review or
  banned. The hook for the `ranked` delegate.
- **Cases** (`fairplay_cases`): one per player, status watch, review, banned or cleared, with a log of every change, who
  made it (detection, reports, an admin, the automated reviewer) and why (`fairplay_log`).

**Signals and the suspicion score** (step 2, shipped in watch-only mode)
- **Recorded on the server from the match's own judged numbers** (`LobbyCore.noteFair`, after each round's scores go
  in: the judges' agreed numbers, the engine server's verdict, or the host's), never numbers a browser makes up. For
  each person's pick (`FairMove`, `core/fairplay.ts`):
  - the loss, and the judged best move;
  - the **crowd-found rate**: how many of the other people picking in that position found the best move (within 1
    point). Bots, practice players (unlimited hints) and anyone who used a power-up don't count in anyone's crowd. My
    call: bots never stand in for humans here. They pick from the engine's own scores, so a move that's hard for people
    (a quiet move, a sacrifice) is no harder for them; with fewer than 8 other people the rate is left out;
  - position complexity (moves within 2 points of the best) and the gap to the second-best move;
  - think time (the server's own clock);
  - whether the position counts: not the opening (the first 12 plies from the starting position), not a forced move,
    not an only move or recapture that most of the crowd found (one the crowd missed does count), not a position
    already won or lost (best move's expected score past 0.9 either way), never a pick made with a power-up;
  - from the app, the one device signal: how many times the page was hidden or lost focus during the move's clock
    before the pick (`lookaway.ts`, sent with the pick; episodes, so a blur plus a hide is one).
- **Compact:** the Durable Object keeps the picks under their own storage key, written once per round (not on every
  pick or chat line). At the end, each signed-in player gets one row in D1 (`fairplay_matches`): the match's summary
  and score, and the picks as evidence.
- **Evidence kept** (Eric, Oct 8): every match's picks for 3 days, so a report made after a match still finds its
  games; 30 days when the player was flagged or reported; never deleted while their case is open (watch or review).
  A watch with nothing new for 30 days closes, and its evidence then goes. The summary rows stay as the player's
  history. The privacy page says so in plain words.
- **The match's signals** (`matchSignals`), over counted moves:
  - **strength:** an engine rating over counted moves (the same curve as the "Elo" column), with a small pull towards
    1500 so a handful of lucky moves isn't super-GM strength; and a **jump** far above the player's own history (the
    median of their last matches, 3 or more) or rating;
  - **hard finds:** finding the best move where few of the crowd did, measured as evidence (a log-likelihood) against
    an honest player of the player's own strength (the higher of their history and this match, capped at 2500): a
    find where such a player usually misses points to an engine, a miss points the other way. Also counted plainly:
    hard positions (under 10% of the crowd found the best move), hard finds and the longest run of them;
  - **timing:** hard finds made in under 5 s, and think time that doesn't follow difficulty (rank correlation);
  - **look-aways:** points only when moves with a look-away found the best far more often than the rest. Never enough
    for a ban alone.
- **Levels** (`playerLevel`, over the last 30 days, at most 10 matches): watch, review (one high match, or two adding
  up), ban (only overwhelming evidence: two matches at super-GM strength on enough counted moves with high scores, or
  one match past every bar). Every number is in `FAIRPLAY` (settings.ts).
- **Watch only for now** (`FAIRPLAY.enforcement: "watch"`): detection records each match and its level, opens a watch
  case, and logs what the level would have done; it reviews and bans nobody until the simulation's numbers are in
  (below). Reports and admins act regardless.

**Bans, appeals, the review page and the reviewer's API** (step 3)
- **A banned account can't play online:** PLAY, a new lobby and joining one (the lobby's hello) are refused (403 with
  `banned`), and the app shows a plain notice: "Your account can't play online", why, that solo games against bots
  are still open, and an appeal form. Solo stays open. A banned player's profile says "Banned" (no rating, rank or
  Top N%); nothing else about fair play is ever shown on a profile.
- **Every online result of a banned account is held** and its rating removed (out of ranking, percentiles and later
  leaderboards). A clearing (an appeal overturned) gives everything back.
- **Ban evasion, made harder without fingerprinting:**
  - A ban keeps the account's sign-in identities, hashed: a normalised email (lower case, no "+tag", Gmail without
    dots) and the Google account. A new account signed in with one of them is banned too ("evasion" in the log).
  - A coarse device marker: a random id in its own cookie (`hc_device`, 400 days), recorded against the accounts that
    play online from it. A new account on a device a banned account played from goes to **review**, not a ban
    (families share devices). Clearing cookies clears it; that's accepted.
  - Guests can't play online anyway once sign-in is set up.
- **Appeals stay human** (Eric, Oct 8): one open appeal at a time, up to 2,000 characters, queued at the top of the
  review page. An admin upholds (the ban stands) or overturns (cleared) it with a reply the player sees in the notice
  and by email. The automated reviewer can't decide appeals, nor change a banned case (the API answers 409).
- **The review page** (`/admin/fairplay`, the Worker's own server-rendered page, phone-friendly, light and dark):
  - only for signed-in accounts whose email is in `ADMIN_EMAILS` (a Worker variable or secret, comma-separated; never
    in the repo); anyone else gets "Not found";
  - lists appeals waiting, then cases (review first, then by cheating reports and scores), and recent decisions;
  - a case shows the player (with their email, for the admin only), the log, reports (who, why, which match), accounts
    on the same device, and every match: strength, score and its parts, and each judged pick with its loss, the
    crowd's found rate (hard positions in bold), complexity, think time, look-aways and whether it counted;
  - Ban, Clear, Watch and Review buttons need a written reason (and take an optional note for the player's email);
    forms are accepted only from the page itself (the cookie is SameSite=Lax and the origin is checked).
- **The reviewer's API** (Eric, Oct 8: a Claude-run reviewer, scheduled, works the queue), bearer token
  `FAIRPLAY_REVIEW_TOKEN` (a Worker secret, at least 16 characters):
  - `GET /api/admin/fairplay/cases?status=open|review|watch|banned|all`: cases with their evidence summary and the
    current policy (thresholds);
  - `GET /api/admin/fairplay/cases/ID`: one case's full games;
  - `POST /api/admin/fairplay/cases/ID/decision {decision: ban|clear|watch|review, reason, notice?}`.
  - Every decision is logged with its reason and who made it ("reviewer" or "admin:<email>"). The decision policy it
    follows is `docs/fairplay-reviewer.md`.
- **Emails** (Eric, Oct 8): on a ban, a clearing after a review or a ban, and an appeal turned down, the player gets an
  email at their sign-in address (email or Google), from fairplay@ the sign-in emails' domain, through Resend, the
  service and key that send sign-in codes (it already sends to any address). It says what happened and how to appeal;
  never anyone else's name or the evidence. Clearing a watch the player never knew about sends nothing. No address
  (a guest), or no Resend key: nothing is sent.
- **Every number** is in `FAIRPLAY` (settings.ts).

**The deep re-check, the evidence model and the thresholds** (step 4: simulated, then detection switched on)
- **Why a deep re-check.** The first simulation runs showed the judges' own numbers can't catch an engine user fast: a
  Crowd finalist makes only about 10 counted picks a match, and the judges search far less deeply than a cheater's
  engine app, so even a perfect copier "loses" a point or two a move by our judges' numbers (their match strength came
  out around 2300-2600 on our scale, not super-GM). What separates them is agreement with a strong engine: an engine
  user picks a strong engine's best move nearly every time, a 2700 player a third to a half of the time. So a flagged
  player's counted moves are searched again on the engine server (`fairplay-deep.ts`: native Stockfish 17.1, the full
  network, 2M nodes, restricted to the judges' top 8 moves and the pick), and **a ban needs that confirmation**.
  - Eric's computing rule (Oct 8): the server's own record and engine, never a device's say-so; the heavy work runs
    from the Worker's schedule (every 15 minutes: cases in review at once, the rest off-peak, 03-10 UTC), on its own
    container instance (`fairplay-1`, so a match's re-checks never wait behind it; inside `max_instances` 2) and its
    own budget (`FAIRPLAY.deep.dailySearches`, 500 a day: about 25 minutes of one instance, under $0.10).
  - Queued (an indexed flag): every match still kept of a player with a match scoring 2+, or with an open case. Earlier
    matches are checked too: an honest-looking one counts in their favour.
  - The review page has a button to run it on one player at once.
- **The evidence model** (`moveEvidence`): for each counted pick, the log-likelihood that an engine user made it
  rather than an honest player of the player's own strength (the higher of their history and this match, capped at
  2700). The crowd says how hard the move was: an honest player's chance of picking the deep re-check's best (or one
  of its top 3) comes from how many of the other people in that position picked it, adjusted for strength
  (`honestChance`, fitted on the simulation's honest players, with a floor: strong players sometimes find what nobody
  in the crowd did). An engine user picks our best 85% of the time and our top 3 almost always (its engine can differ
  from ours). So the best move the crowd missed is strong evidence, an easy best move is barely any, and a pick outside
  the engine's top 3 counts strongly the other way. Before the deep re-check, the judges' best within a point stands in;
  without a crowd (mostly bots), strength alone sets the honest chance.
  - The first, simpler model (the crowd's rate shifted by strength) was miscalibrated: strong honest players find
    crowd-missed moves far more often than it said (a 2700: 20% where it said 6%), which gave honest strong players
    false evidence. The fitted model's calibration table is in `reports/fairplay.md`.
- **Changed from step 2 after the simulation:** the opening is the first 8 plies (was 12) and only positions past 97%
  either way count as decided (was 90%): Crowd games are often lopsided early, and engine-like play there is still
  evidence. The score's parts are strength (points from 2600), a jump above history, evidence, a run of found moves,
  timing and look-aways.
- **The thresholds** (`FAIRPLAY.levels`): watch at a match score of 3; **review** at 8 in one match or 12 over two
  (results held until a person or the reviewer clears them); **auto-ban** only from deep-checked matches (8+ checked
  moves each): two or more whose evidence adds up to 9+, with 16+ moves checked, 80%+ of them the engine's best and a
  best match strength of 2200+; or one match with evidence 11+, 12+ moves checked, 90%+ the engine's best, strength
  2400+.
- **What they do** (`reports/fairplay.md`: 10,000 honest players per strength from 1200 to 2700 and 2,500 cheaters
  per type, 5 Crowd 50 v 50 matches each):

  | | Review within 1 / 2 / 5 matches | Ban within 1 / 2 / 5 matches |
  | --- | --- | --- |
  | Full engine user (top move, 3-12 s) | 45% / 73% / 98% | 5% / 47% / 89% |
  | Engine only in hard positions | 8% / 19% / 53% | 0.1% / 5% / 12% |
  | Engine when its own move is a mistake | 2% / 6% / 18% | 0% / 0.5% / 1.5% |
  | Engine's 1st/2nd/3rd choice blended | 2% / 5% / 22% | 0% / 0% / 0.2% |
  | Engine on 20-40% of moves | under 0.5% / 0.5% / 2.4% | 0 |
  | Honest players, per 1,000 (within 5) | 0.3 (1500), 2.9 (2000), 7.7 (2400), 26 (2700) | 1 of 90,000 (at 2200) |

  - With few people in the match (no crowd rates): full engine users reviewed 96% and banned 87% within 5 matches;
    honest strong players 1 ban in 25,000.
  - A more aggressive bar (evidence 8, 75%) bans 52% / 96% of full engine users within 2 / 5 matches but 3 honest
    players in 90,000; I chose the stricter one, as Eric asked for a tiny false-ban rate, with Review (results held)
    as the fast path: 73% of full engine users within 2 matches.
  - A cheater using the engine on a fifth to two fifths of moves plays like a stronger honest player; no move-by-move
    statistic tells them apart in a few matches. Reports (three in a week put them in review) and a strength far above
    their own history are what catch them.
- **Switched on:** `FAIRPLAY.enforcement: "ban"`. Detection opens reviews and bans on the evidence above, with an
  email and an appeal. The automated reviewer (`docs/fairplay-reviewer.md`) works the reviews.
- **What the simulation can't tell:** honest players are Stockfish at lower strength, not people; the cheater's engine
  agreement (85%) and the timing model are assumptions. So bans need the deep re-check and stay at the strict bar.
  Refit `honestChance` from real cleared players once there are enough, and re-run the simulation.
