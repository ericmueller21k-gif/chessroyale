# History: Matchmaking, lobbies and ranked

The decisions behind this area, moved here word for word from `DECISIONS.md` on Oct 10, 2026 (the housekeeping pass),
in the order they were made. This is the record of why. For how it works today, read [the area page](../areas/matchmaking.md).

## Milestone 4: multiplayer lobbies

- **One Durable Object per lobby, with a 5-letter code** (no 0/O/1/I/L). Invite links are `/lobby/CODE`.
- **Seats survive reloads.** Joining stores a seat token on the device; reopening the link (or reloading) rejoins the
  same seat and the server resends the current screen.
- **Host scoring.** After picks lock, the host's browser gets one job per board, scores it, and picks for the bots.
  If the host leaves, the first connected player on a computer (else any player) becomes host and gets the job. If
  nobody answers within 15 s, every pick on that round counts as equal (all score 0) rather than stalling the match.
- **Cross-check.** Every other player's browser re-scores its own group after the reveal and reports mismatches,
  which the server logs. The checker runs exactly the same searches as the host, in the same order, with the
  `searchmoves` list sorted, so honest devices agree exactly. An early version used a slightly different sequence
  and logged 2 mismatches in a test match; with identical searches the next full match logged none.
- **Rounds lock early** once every live human has picked, so nobody waits out the clock for bots.
- **Duel in multiplayer:** the server runs both clocks. If a finalist is a bot, the host's browser chooses its moves.
  The higher final-four scorer has 15 s to choose a colour, then gets White.

## Closing finished lobbies (Oct 7, 2026)

Eric opened the app hours after a match and got its results screen again ("100/100 place") at
`hunchess.com/lobby/RY8UB`: "Shouldn't we be removing these urls or something once the game has ended?" The `hub`
delegate's calls.

**Why it happened**
- A lobby's Durable Object kept its record for ever. Nothing deleted it after the results, so `/lobby/CODE` (a stale
  tab, the app reopened from the background) reconnected to the seat and the server re-sent the results.
- A lobby that's gone (or a code that never existed) refuses the WebSocket, and the app just retried with backoff, for
  ever: a typed unknown code sat on "Connecting…" with no way to tell.
- Codes were never freed. The matchmaker did already check `exists()` before `create()` (that part of the report was
  wrong), but as two calls; `create()` now refuses a code in use itself and returns false, and the matchmaker and
  POST /api/lobby try another (`openLobbyCode`). A lobby whose time is up is closed right there, so its code is
  reused.

**How long a lobby lives** (`LOBBY_LIFE` in settings.ts; the rule is `lobbyClosing` in lobby.ts, unit-tested)
- **Results: 15 minutes after the match ends** (`lobbyResultsKeepMinutes`): time to see your place, say GG and share.
  People still on the results screen don't keep it open.
- **A lobby that never started: 60 minutes after anyone last did anything in it** (`lobbyIdleMinutes`): joined, left,
  connected, dropped, sent anything. A private lobby nobody started, or a queue everyone left.
- **A match in progress is never cut short while anyone is connected.** With nobody connected, a safety cap of
  **180 minutes** after anyone was last heard from (`lobbyAbandonedMinutes`). Why 180: a match whose people all left
  plays itself out (each move waits out its clock, scoring times out after 15 s and every pick counts the same), so it
  reaches its results by itself. The unit test plays each ending out that way: team final 83 min (to its 160-turn
  cap), duel 86, boss battle 61, boss raid 51. So the cap is about twice the longest: it only ever clears a match
  that's stuck, and a match left to itself still records everyone's results first.
- **`?keep=SECONDS`** on a lobby you create (5 s up to the 15 minutes) shortens the results for tests.

**What closing does** (the Durable Object, from its alarm: its one alarm is the match's next event or the lobby's
closing time, whichever is first)
1. Results are on profiles (saved when the match ended; again here if that hadn't happened) and the live line has
   forgotten the lobby.
2. Anyone still connected gets `closed` (with the reason) and the socket closes.
3. Everything it stored goes (`deleteAlarm()`, `deleteAll()`: the lobby, the quick chat icons). The code is free.
It runs with nothing else let in meanwhile (`blockConcurrencyWhile`), so a new lobby can't take the code halfway.
The same check runs whenever the lobby is touched (a connection, `exists()`, a status), so a lobby whose alarm hasn't
run yet, or one from before this change, closes on first touch: results with no end time close at once; a match
nobody's been in for 3 hours, likewise. (Locally, 36 old test lobbies closed as the Worker started.)

**What players see**
- **Opening a closed or unknown lobby** (a stale tab, an old invite): the home screen with a short note, "That match
  has ended.", and the address goes back to `/`. If your account played it, **"See your result"** opens your profile at
  that match (outlined in gold, scrolled to). The server knows from the result itself: online results now store their
  lobby code (`results.lobby`, never shown on a profile, never set for solo games), and `GET /api/lobby/CODE` answers
  `{ open, phase }`, or 404 with your result in it. The note is whole when it appears (the result is asked for first;
  the frames check caught a version where the button arrived a moment later and pushed the screen down). A guest who
  isn't signed in gets the landing page with the same line instead of "Sign in to join lobby …".
- **An invite link** is checked before the join form opens (a moment's splash). A match that's over shows the note to
  anyone who wasn't in it, instead of "Can't join · This match has already started."
- **Results while the lobby is open:** a reload, the app reopened or brought back from the background shows them as
  before. When the 15 minutes run out with the results on screen, the app goes home with the note. A tab coming back
  into view now reconnects at once instead of waiting out its backoff.
- **Home or Play again from results** go to `/` (as before) and this device forgets its seat, so reopening the app
  (the installed one starts at `/`) lands home, and the old link shows the note.
- **A code typed into Join that leads nowhere:** "Can't join · We couldn't find a lobby with that code." (or "That
  match has ended.") instead of "Connecting…" for ever.
- **A seat from an older lobby that had the same code** (codes are reused now) is told the match has ended; it never
  joins the new lobby as a stranger.
- **Mid-match rejoin** is unchanged: a reload or the app reopened at the match's address puts you back in it.

**The "100/100"** was Eric's real place. Reproduced in a unit test: a player who closes the app as the match begins
misses every move (each counts as a 25-point loss), goes out at the first cut, last, and comes back to "100th of 100",
the same place his profile records. Someone who wasn't in it used to get "Can't join · This match has already
started."; now the note.

**Also fixed on the way**
- A queue whose fill time passed while nobody was connected never started, and anyone coming back sat on the queue
  screen at "0 s". Now it starts (bots fill the rest) when someone comes back; if nobody does, it closes after the hour.
- A private boss raid's start button said "+ 49 bots" (a raid has none): now "Start with N players".

**Checking it:** unit tests (`lobby-life.test.ts`: the keep time, the idle hour, an in-progress match never closed and
each ending played out inside the cap, the true place on return, strangers and old seats; `matchmaker.test.ts`: a
used code is never handed out; `live.test.ts`: results by lobby code, never on a profile). e2e
(`lobby-close.spec.ts`, phone and computer): a short online raid, a reload mid-match rejoins, a reload on the results
shows them, a stranger's link shows the note, the keep time runs out: home, the note, `/`, "See your result"; Home from
results; a typed unknown code. `npm run frames:close -- <dir> [dark|light]` (Worker running) records every frame
from the results to home and on to the profile with a real tap, flags blinks and logs any layout jump.

**Later (Eric's call):** reopening the installed app cold during a live match lands home, not in the match (it
rejoins only from the match's address, as before). Chess sites put you straight back into your game; we could too,
from the seat this device keeps.

## Ranked, ratings and matchmaking (draft, Oct 7, 2026; for Eric's review)

Eric: if real players arrive, how do we decide points after each match, a fair curve, ranks, ranked matchmaking that
widens its search when few are online? This draft follows what the big multiplayer games do, adapted to 100-player
matches. The `ranked` delegate builds it once Eric agrees.

**Two numbers per player, per mode**

1. **Hidden skill (matchmaking rating).**
   - A Bayesian rating built for many-player free-for-alls: the Weng–Lin method ("OpenSkill", the Plackett–Luce
     model; Weng & Lin, *Journal of Machine Learning Research*, 2011). It's the open, patent-free cousin of
     Microsoft's TrueSkill (Herbrich et al., 2006).
   - Each player has a skill estimate (μ) and an uncertainty (σ). After a match, everyone's estimate moves by how
     their finishing place compared with what their skill predicted against everyone else in that match:
     - Beating stronger players moves you up a lot; beating weaker ones moves you a little.
     - A new player's σ is large, so their first matches move them fast. It shrinks as the system learns, so a settled
       player's rating is steady.
   - Unlike chess Elo, which compares two players, it handles 100 placements at once in one update, and it's quick.
   - Only real players count. Bot seats are left out of the update entirely, so bots can't be farmed and can't drag
     anyone down.
   - A new player's starting estimate comes from their existing engine rating (how good their moves are), so placement
     isn't a long grind.
2. **Visible rank: what players see and chase.** Chess-themed tiers, each with divisions:
   - Pawn, Knight, Bishop, Rook, Queen, King (III, II, I), then Grandmaster for the top 500.
   - **Rank points (RP), 0–100 per division.** Each match adds or removes RP by your finishing place as a share of the
     match (so it works for 30 or 100 players), minus an entry cost that rises with your tier:
     - Starting point (to tune by simulation): top 1% +40, top 10% +25, top 25% +15, top half +5, bottom half −5 to
       −15, then less the tier's entry cost.
     - A small catch-up term moves rank toward hidden skill: if you're ranked below your skill, you gain more and lose
       less, so good new players climb quickly and rank can't be bought by grinding alone.
   - **Placement:** the first 5 ranked matches show "Placing…", then a rank is given from hidden skill.
   - **Protection:** no demotion for 3 matches after a promotion, and none in the lowest division.
- **The engine rating stays as its own stat,** "Chess strength": how good your moves are, shown on profiles. Rank is
  about winning matches; strength is about move quality.

**Seasons**
- About three months each.
- Ranks soft-reset to about a tier lower, and σ widens a little so everyone re-proves themselves.
- Season rewards are cosmetic only: a season border, an exclusive item.

**Who gets a ranked match**
- Signed in, and at least 10 unranked matches played (against throwaway accounts).
- A ranked match needs a minimum of real players (start at 30 of 100). Bots fill the rest and don't count.
- If a ranked queue can't reach the minimum, the players are told and offered an unranked match. A match never quietly
  becomes ranked with mostly bots.
- Leaving a ranked match counts as last place.

**Matchmaking that widens**
- One queue per mode (later per region). A player in the queue is a ticket: their skill, their uncertainty, and when
  they joined.
- About once a second the matchmaker forms lobbies:
  - Start from the longest-waiting ticket and gather tickets within ±150 of its skill.
  - The window widens by 50 every 5 s waited, and after 45 s anyone is accepted.
  - At 60 s the lobby starts, bots filling the empty seats.
  - With few players online, the windows widen quickly and everyone lands in the same lobby. With many, lobbies are
    tight.
- We log each lobby's skill spread and wait time, and tune the numbers from real data.
- Unranked "Play now" keeps today's fast fill and doesn't care about skill.

**One must-do before ranked: trustworthy scoring.**
- Today the host's browser scores everyone's moves, which is fine for fun matches.
- With ranks at stake, a modified browser could fake scores.
- For ranked matches, two players' devices score each round independently, and the server compares the results. Any
  disagreement is re-checked by the engine server, and that verdict stands.
- That costs almost nothing extra. The alternative, the engine server scoring everything, is fully trustworthy but
  costs real money at scale (about 3.5¢ a match).
- This is the `engine` delegate's job, before ranked opens.

**Leaderboards**
- Per mode and season: the top 100, your position, and friends later.
- Computed from the rank table and cached, so they're cheap to show. The `hub` shows them.

## Matchmaking types, and when a match counts for ranking (Oct 7, 2026)

Eric: three clean options for every mode instead of a separate "play with bots": **Default** (bots after 60 s, with an
ⓘ), **Bots off** (people only, with a warning) and **Solo** (you plus bots, at once); the 100 (or 50, or 64) seats
always fill on screen, quickly when they're all bots; and "anytime more than say 25% of a lobby is bots, your
ranking can't change" (since replaced: see Ranking below). The `hub` delegate's calls:

**The home screen**
- **A Matchmaking row under the mode picker,** in the same shape with a word under each option ("bots at 60 s",
  "people only", "you + bots"). The picked one gets a gold edge, not a gold fill, so the mode stays the main choice.
- **The ⓘ** sits at the end of the row (44 px, the row is too narrow on a 320 px phone for one inside "Default"). It
  explains all three, Eric's line first ("Default adds bots after 60 seconds to keep the wait short"), and the ranking
  rule.
- **Bots off shows a warning** under the row while it's picked: no bots can mean a much longer wait, and you can
  switch to Default from the queue.
- **Remembered per device** (`brc.matchmaking`). Not per account yet: the profile has no place for preferences.
- **Guests** (where online needs signing in): Default and Bots off are greyed out, Solo is picked, and the line under
  PLAY says "Sign in to play online".
- **Classic:** online Classic is still "coming" (Default and Bots off keep PLAY greyed, as before). Solo plays Classic
  against 63 bots, as "Solo vs 63 bots" did.
- **Play with friends** is lobbies only: its "Solo vs 99 bots" is gone (Solo replaces it).
- **Boss alone stays where it was** (the home's buttons and the computer's side menu). It's a different thing from a
  Solo raid: you pick every move against a boss you choose from the menu. A Solo raid is you and 49 bots in the crowd
  against a boss matched to you.

**Solo**
- Played in your browser as before (it never touches the matchmaker or the live counts).
- **The queue screen fills first:** you in seat 1, then the match's own bots (the same names and outfits as in the
  match) pop in over about 2.2 s, a few at a time and eased (`MATCHMAKING.soloFillMs`), the full grid holds for 0.9 s,
  then the match begins. Each pop comes as its bot arrives, so the count never runs ahead of the grid.
- **A Solo raid** has 49 bots in the crowd, and its boss is matched to you (`?boss=N` still picks one for tests), like
  an online raid's.

**The queues** (server)
- **One queue per mode and type** (`queueName`: crowd-default, crowd-botsoff, raid-default, raid-botsoff), so Default
  and Bots off never share a lobby.
- **Bots off, 50 v 50:** never any bots; it waits until 100 people have joined.
- **Bots off frees the seats of people who left:** after 2 minutes gone (`botsOffSeatHoldMs`), the next arrival (or a
  raid's start) frees their seat. The count is then real, and a "full" lobby never starts with people who left (the
  100/100 problem again). Back while it still waits: a new seat with the same token. Found by the e2e suite meeting an
  earlier run's Bots off lobby, which was still waiting with its people long gone.
- **Bots off, raid:** starts at 50, or once its minute is up with at least 10 people
  (`MATCHMAKING.raidBotsOffMinPlayers`). Raids already started with whoever was there, and 10 is the size of the
  Crowd's boss battle: a real crowd.
- **Default raids now fill the crowd with bots** after the minute (before, they started with just the people there).
  Private raids stay people-only. **The boss is matched to the people only:** bots don't count towards its strength.
- **Bots off → Default** ("Switch to Default", under the waiting line): the seat is handed back to the server, which
  puts you in Default's queue with your wait counting. Bots fill a minute after you first joined at the latest, but
  never sooner than 5 s (`switchMinWaitMs`) so you see it happen. If the lobby filled meanwhile, you stay in it.
  On screen, your seat stays drawn through the switch: the frames check caught it blinking out and popping again for
  two frames, so your seat is now drawn from the tap, under one key whatever the server calls you.
- **Bots in the Default queue wear their outfits** too (the approved mockup had plain pawns): the same bot looks the
  same in the queue, on the vote board and in the match.
- The typical wait under PLAY counts Default queues only.

**Ranking**
- **What "ranking" is today:** the rating on your profile (the rank under your pawn), its chart and "Top N%". There's no
  ranked mode yet (see "Ranked, ratings and matchmaking").
- **The rule: a match counts for ranking only if at least 30% of its seats are real players**
  (`RANKING.rankedMinHumanShare: 0.3`, `isRankedMatch`, `rankedMinHumans`). Exactly 30% counts.
  - **Eric chose the ranked draft's 30-of-100 minimum over his earlier 25% bots rule (Oct 7).**
  - **My call: it's a share of the mode's seats,** so it scales: 30 of a 50 v 50's 100, 15 of a raid's 50, 20 of
    Classic's 64. A match that starts short counts its empty seats too: a Bots off raid that begins with 10 people is
    unranked.
  - **Solo never counts** (all bots, and its result comes from the browser).
  - **Practice never counts** either (unlimited hints, online too).
  - Leaving bot seats out of the rating maths is the `ranked` lane's job, later. This only stores the flag and shows it.
- **Stored with each result** (`results.ranked`: 1, 0, or NULL for results from before the rule). Only ranked results
  move your rating, its chart and Top N%. Every result still counts in your stats.
- **From now on, not backwards:** older results count as before, so nobody's rank disappears overnight (ratings that
  older solo games set stay until a ranked match replaces them).
- **In words:**
  - the queue says "Unranked: fewer than 30 real players" once the bots are in (15 in a raid); Solo says "Unranked:
    solo games don't count for ranking";
  - the results say why the match didn't change your ranking;
  - a profile's recent matches say "unranked";
  - the ⓘ says what a match needs.
- **With today's numbers almost no match is ranked:** it needs 30 people in a 50 v 50.

**Back in from a fresh start** (the brief's item 7)
- **Remembered:** the match you're seated in (`brc.current`). It's set when you join a lobby, and forgotten when you
  leave on purpose (Leave, Cancel, or Home from the results), when the match ends, or when the lobby is gone.
- **Opening the app at `/`** with such a match still on puts you back in it, as chess sites do. A queue still waiting
  takes you back to the queue. A match being played shows the splash until its screen comes (no queue flash on the
  way). One that's over leaves you home.

**Checking it**
- Unit tests:
  - `lobby-types.test.ts`: Default and raid fills, Bots off waiting and its raid rule, the switch's hand-back and its
    "a minute after you joined", the 30% boundary in each mode, a raid that starts short, and practice;
  - `matchmaker.test.ts`: one queue per mode and type, Bots off lobbies with no fill, a switcher's wait;
  - `live.test.ts`: only ranked results move a rating; solo never does; older results count;
  - `solo-fill.test.ts`: the fill climbs, uses the match's bots, holds, starts; a raid's 49; Cancel.
- e2e (`matchmaking.spec.ts`, phone and computer):
  - the three types, the ⓘ, the warning, remembered;
  - Solo full in under 5 s and into the vote;
  - Bots off waiting past the fill time, a Default player in another lobby, the switch, then bots and "Unranked";
  - a Solo raid to its results ("Unranked");
  - `profile.spec.ts`: a solo result leaves "No rating yet". Its rank display then uses a rating served in the
    server's answers, since an e2e can't seat 30 people; the server's side of the rule is in `live.test.ts`.
  - `sound.spec.ts`: Solo's queue pops come first, then the match's sounds, and nothing else;
  - the app closed and opened again during a live match, and Cancel then opened again (home).
- `npm run frames:matchmaking -- <dir> [dark|light]` (Worker running): every frame through taps on the types and the
  ⓘ, a Solo fill into the vote, Bots off then the switch, and a fresh open rejoining. It flags blinks, the count going
  down, the grid vanishing, and home or the queue showing during the rejoin. Clean in light and dark.

**Later:** remembering the choice per account; skill-based queues (the `ranked` delegate's; `matchmaker.ts` keeps
one queue per mode and type for it to build on).
