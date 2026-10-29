# Ranked 1 v 1

Lanes: `ranked` (the rating math, ranks, pairing), the director (the game's rules and screens), `hub` (the home screen's
1 v 1 pick in its RANKED row: PLAY calls `startRanked1v1()`, the line under the row shows `ranked1v1Label()`; [hub.md](hub.md)). Why it's built this way:
[docs/decisions/2026-10-16-ranked-1v1.md](../decisions/2026-10-16-ranked-1v1.md). Every number is in `RANKED_1V1`
(`packages/core/src/settings.ts`).

## How it works today

- **The mode** (Eric, Oct 16): "1 v 1 · Classic chess". Normal chess between two signed-in players: checkmate wins, real
  clocks, no power-ups, no engine scoring. One tap queues (`/1v1`, or `startRanked1v1()` from any screen); no
  settings. Online needs an account wherever sign-in is set up (`mayPlay`, as every mode), so guests and under-13
  devices can't queue there; banned players can't either.
- **Its kill switch:** `PAUSE_RANKED1V1` ([ops.md](ops.md) "Kill switches"): the queue answers 503 with "1 v 1 is resting
  for a bit. Back soon."; games already running finish.
- **The queue** (`matchmaker.ts`'s duel mode, `queue.ts` `PAIR_BY_RATING`, core's `pairUp`): the Matchmaker object for
  `ranked1v1-default` (and a test's `?pool=`). The first ask reads the player on the server (`duelEntrant`: the
  account's name through the name filter, the locker's look, the rank, the hidden rating) and makes a ticket; one ticket
  per account (a second tab or device is the same ticket, also while it's being seated, and an account never meets
  itself). The app asks again at once with its ticket (each ask waits up to `CAPACITY.queue.holdMs`): `{ searching }`
  until paired, then `{ code }`. Pairs: the longest wait first, with the closest hidden rating within
  `startRange + perSecond × seconds waited` (the longer wait's) `+ perRd ×` the larger of the two deviations (as they
  stand that day), at most `maxRange` (`RANKED_1V1.match`: 100, +10 a second, +1 × deviation, 1000; so two players in
  placements, still uncertain, meet at once, and settled ones at 160); never two accounts on one device (fair play's
  device cookie, hashed, on the ticket). A ticket is only made with its player: one being seated (its game opening) is
  still known, so its ask waits for the game; a game that couldn't be opened (`create` answered no, or the call threw)
  puts the pair back at the front of the line at once, still searching, and the next batch tries again (a second later,
  or at their next ask); one the queue doesn't know (gone while the app slept, or made up) is answered `expired` and the
  app asks afresh. Cancel takes the ticket out (one still on its way back with the first ask is canceled when it
  comes); a pairing made that very moment is called off for that player (`DuelGame.abandon`: an abort before any move,
  nothing recorded). After `fewPlayersSeconds` (45) the app offers "Few players online right now" with Keep waiting and
  Play a bot (unranked).
- **The stage** (Eric, Oct 16: "your character's sitting there, and then there's like kind of this empty platform thing
  like waiting, and then when your opponent joins, like their pawn loads up next to you"; `components/DuelStage.tsx`,
  styles `dv-st-`; why: [docs/decisions/2026-10-16-ranked-1v1-versus-screen.md](../decisions/2026-10-16-ranked-1v1-versus-screen.md)).
  The search and the versus moment are one screen, in the home screen's frame (the side menu stays on a computer; its
  pages browse with the search going, below; during the versus moment they leave the game):
  - **searching:** "‹ Home" at the top left (browse, still searching: below), "1 v 1 / Classic chess" at the top; your big dressed pawn drops onto a platform on the left (gold
    rim), your name and rank under it; on the right an empty platform, a faint pawn's outline breathing and rings
    rising off it, "Finding opponent…" and the time waited under it; Cancel at the bottom, and "Few players online right
    now" above it when it comes;
  - **found:** while the game object waits for both players the right platform stays empty ("Opponent found…"); as the
    versus moment starts the opponent's pawn drops onto it (0.42 s), their name and rank rise in under it, "VS" pops in
    between, and "You play White" (or Black) takes Cancel's place. It holds for the rest of `versusMs`, then the board
    (the bot game: the same, with the bot's pawn);
  - **sizes:** each side half the width (the pawn's box a little wider, into the gutter and the gap), never so tall
    that the stage with "Few players online" and Cancel leaves the screen, at most 320 px (a computer). The space under
    the stage is always as tall as "Few players online" and Cancel together, and the names' space as tall as the
    longest name and rank on two lines each, so nothing on the stage moves when the opponent (or the bot) arrives;
  - **motion:** transforms and opacity only (the drops, the waiting rings and outline, a slight breathing of each pawn
    from its foot, "VS"); `prefers-reduced-motion` turns them all off.
- **Browsing while queued** (Eric, Oct 16: "a back button or they can view inventory", "no confirmation needed";
  `components/DuelQueueBar.tsx`, styles `dq-`; why:
  [docs/decisions/2026-10-16-1v1-browse-while-queued.md](../decisions/2026-10-16-1v1-browse-while-queued.md)):
  - **away from the stage:** "‹ Home" on the search stage (or a computer's side menu) goes home and keeps the search
    going: the queue is the app's (`DuelQueue` in App.tsx), not the screen's, so it keeps asking (and its ticket stays
    known) wherever you are. No confirm. Cancel on the stage still leaves the queue;
  - **the bar,** at the top of every screen while you browse: a green dot, "Searching 1 v 1 · 0:42 ›" (back to the
    stage, the same search and wait) and Cancel (out of the queue, no confirm; the page stays). Under the maintenance
    banner; its height is `--qbar-h`, which `--banner-h` adds to the banner's `--maint-h`, so the page starts under it;
  - **few players:** at `fewPlayersSeconds` the bar turns gold and says "Few players online · 0:45 ›"; its words take
    you to the stage, where Keep waiting and Play a bot (unranked) are. Keep waiting is the queue's (`keepWaiting`), so
    it holds as you come and go;
  - **found while browsing:** a sound (`bannerStart`) and a buzz (`navigator.vibrate`, 90-60-160 ms; none while sound is
    off), the page you were on closes, and the stage opens with the game's waiting and versus moment as ever;
  - **another mode while searching** (PLAY for 50 v 50 or Squads, the Boss raid's choices, Boss alone, a lobby made or
    joined from home): "Leave the 1 v 1 queue?" / "Starting this ends your 1 v 1 search." / Stay, Leave queue: the only
    confirm. 1 v 1's PLAY goes back to the stage. Anything else that puts you in a match (an invite's lobby, a party's)
    ends the search;
  - **a reload** carries on with the search (`savedDuelQueue`: its ticket, when it began and its test switches in the
    tab's sessionStorage after every ask; dropped when found, cancelled or refused, or 2 minutes after the last ask):
    on the stage from /1v1, else with the bar. A refusal while browsing (the mode resting) brings you to the stage,
    which says why.
- **A game** (`duel-room.ts`, pure, around the rules in `@chessroyale/chess/duel`; `duel-do.ts`, the `DuelGame` object):
  - **waiting** for both players' sockets (seats by account: a reload or another device of theirs goes straight back
    in), at most `joinSeconds` (10), or it's called off ("no_show", nothing recorded);
  - **versus** (`versusMs`, 2.5 s): the "found" moment on the stage (above): both players' pawns, names and ranks;
  - **the vote** (`voteSeconds`, 5): three zones on the game's own board (ranks 4 and 5; Bullet, Blitz, Rapid left to
    right from either side), each player's dressed pawn off the grid on their own side's line between their second and
    third ranks. Drag it into a zone, or tap it and then a zone; it can change until time's up; the other's moves live.
    The control is halfway between the two picks (`votedControl`): the same pick, that control; neighbors, the one
    between (Bullet 2+1, Blitz 5+3); Bullet against Rapid, Blitz 3+2; one pick counts alone; none: Blitz 3+2;
  - **the overlay** (`overlayMs`, 1.5 s): "Timer: Blitz 3+2" over the board (a line, not a banner); the pawns are gone;
  - **play:** each first move within `firstMoveSeconds` (20; White's from the start, Black's from White's) or the game
    is aborted (no result, no rank change). The clocks start after Black's first move; then Fischer: the mover's
    thinking off their clock, the increment on after the move. Ends: checkmate; resigning (before both first moves,
    resigning is Abort); flagging (a loss, a draw when the side on time has a lone king, or a king and one knight or one
    bishop: `canMate`); stalemate, threefold repetition (a position count kept with the game), the 50-move rule (at
    100 half-moves, a mate on that move still wins), not enough material; a draw both agree to (an offer lapses when
    the other player moves; after a decline or a lapse its maker offers again after `drawOfferEveryMoves`, 3, moves of
    their own). A disconnected player's clock keeps running; back, they're in the same game;
  - **over:** recorded (below), each player told what it did for them (`outcome`), the results up
    `resultsKeepMinutes` (10), then the object deletes everything it stored and its code is free again.
- **Timing** is the rules' own: `tick` moves the game on (the vote's close, the start, a first move that never came, a
  flag at the moment the clock reached zero), and the object's alarm is the next deadline. A move after the flag is
  never played. Moves carry their ply, so a move resent after a reconnect is never played twice; a refused move
  answers with the game, and the app's board goes back to it. No lag compensation: the server times each move as it
  arrives. **Premoves** (chess.com's, the board's own: [board.md](board.md), "Arrows, highlights and premoves"): sent as
  an ordinary move the moment your turn shows, so the clock charges one the time from your opponent's move reaching the
  server to yours reaching it, about a round trip (chess.com charges 0.1 s); the bot game, on the device, about a frame.
  Nothing marks a premove for the server (1 v 1 has no timing signal), so nothing a premove does changes a rank.
- **Quick chat** as in other online matches (`MatchChat`, `ChatPanel`), one channel (no teams: every line a player
  owns goes to both), the limits of `QUICK_CHAT`, mute by account on the device (`chat-mod.ts` in the app) and on the
  server (`chatPrefs`), and #252's chat bans (read as each player connects, again at most every `CHAT_MOD.recheckMs` as
  they chat: "mod" refusals).
- **Ranks** (core's `ranked.ts`; Eric, Oct 28: Puzzle Pirates' names, "each tier has numbers 1-5 within it wood 5 being
  the lowest", "80 per division"; [2026-10-28-ranked-tiers.md](../decisions/2026-10-28-ranked-tiers.md)):
  - **The hidden rating:** Glicko-1, each game its own period; a new player starts at their account's rating from
    other modes (`users.rating`, clamped 800-2400) or 1500, deviation 350, down to 60 with games, back up with idle days.
  - **The ladder:** one integer per player: division index × 80 + rank points (Wood 5 0 = 0). Wood, Silver, Gold,
    Paragon, Illustrious, Sublime and Radiant, divisions 5 → 1 of 80 RP (0-2799; each tier 400 points, as the old
    Iron … Diamond were, so a stored ladder kept its meaning on Oct 28). Crossing 80 points is the next division (the
    extra carried), below 0 the one before; no promotion series, no demotion shields; never below Wood 5 0.
  - **The top two tiers** (`topTiers`, `topFloor`), no divisions: **Pearlescent** at `topFloor` (2800, Radiant 1's 80 RP)
    or more and among the 500 highest ladders, **Transcendent** among the 100 highest; their RP count from the floor
    ("Transcendent · 120 RP"). At the floor or more but outside the top 500 a player stays Radiant 1, the RP counting on
    past 80 ("Radiant 1 · 95 RP"). The place is 1 + how many ladders are higher (equal ladders share a place), counted
    by the server (`topPlace` in `ranked-schema.ts`): only for a ladder at the floor or more, one `COUNT(*)` on the
    `ranked_1v1_ladder` index (the entries above it, never the table), kept a minute per ladder in each Worker
    instance. Falling below the floor is Radiant 1 again.
  - **Rank points a game:** 2 × 20 × (the result − the expected result from the two hidden ratings): ±20 between
    equals, more for beating someone stronger, less for beating someone weaker; plus 0.05 × (hidden rating − the
    ladder's rating), that adjustment within ±10 (a draw: half). A win never takes points, a loss never gives them.
    The ladder's rating: 800 at Wood 5 0, +1600/2800 a point (2400 at the top tiers' floor).
  - **Placements:** the first 5 rated games show "Placement N/5"; the fifth places the player from the hidden rating,
    at most Radiant 5 0 (2400). Aborted games don't count.
  - **Fair play's hold:** a player in review keeps their rank as it is (their games don't move it); their opponent's
    game counts as usual.
  - **The rank shown everywhere** (Oct 28: `RATING_RANKS` retired): home's line under your name, the profile card's pill.
  - **Kept for the public profile** (Oct 28; `RankedSummary` in core: the decision file has its exact shape): the peak
    (`ranked_1v1.peak`, only ever up), the current win streak (`ranked_1v1.streak`), each game's points by side
    (`ranked_1v1_games.white_points`, `black_points`), and the last 5 kept games (`recent`: when, the opponent by id, name
    and look, the result, your points). Never the hidden rating.
  - **Shown as** `RankView.label` and its emblem (`RankView.emblem`, below): "Gold 2 · 45 RP", "Radiant 1 · 95 RP",
    "Transcendent · 120 RP", "Placement 2/5"; on the profile (your own: a "1 V 1" section; anyone's, yours as others see it
    included: the public profile's Ranked Standing card, [hub.md](hub.md), "Profiles"; null for a banned player), in the game's strips (the pill only) and the versus moment, and on the result card ("Gold 2 · 45 RP
    (+18)", "Placed: Gold 4 · 25 RP"). With 1 v 1 picked, the home screen's panel under its RANKED row reads
    `ranked1v1Rank()` (`packages/app/src/ranked.ts`): "Your rank: Gold 2 · 45 RP". Each tier's pill color is its
    emblem's main color, 4.5:1 or better on both themes.
- **The emblems** (Eric's set, approved Oct 28: a chess piece in a cut-gem badge; d5 plain, d4 studs, d3 wings, d2 a
  crest, d1 a gem crown and a wide glow; Pearlescent and Transcendent 2 s loops):
  - **The drawing** is `packages/app/src/characters/rank-set.ts` (as drawn on `claude/boss-art`, a8d5aa57; only its
    imports changed). `npx tsx scripts/bake-emblems.ts` bakes it into one picture, `packages/app/src/emblems/rank-emblems.png`
    (384 × 432, 22 KB: a row per tier, its divisions 5 → 1; a row per top tier, its 8 frames), with
    `rank-emblems.ts` (each emblem's cell, its frames and times, a hash the test checks against the drawing). No art
    code runs on a device.
  - **Shown by** `components/RankEmblem.tsx`: a cut of the picture in a box of 48 × `scale` px (whole steps, smoothing
    off), always that size with or without an emblem (placements, a bot) and before the picture loads. The loops
    step along their row by a CSS transform (8 steps in 2 s: no script, no repaint per frame), still on their first
    frame under reduced motion. Nothing of them in the town's frame loop (the town shows no rank).
  - **Where:** the stage (each pawn's inner top corner, facing each other above "VS": 48 px on a phone, 96 on a
    computer; it lands with its pawn), the result card (your rank after the game: a division or tier up shows the new
    one; its room kept from "Updating your rank…"), home's 1 v 1 panel (48), the profile's 1 V 1 section (96), the public profile's Ranked Standing card (96 on a phone, 144 on a
    computer), and the
    FAQ's ranks entry (each tier's division 5, Gold's five divisions, the top two). The in-game strips keep the pill
    alone (the board's room).
  - **An admin's `?rank=`** (`rankFromSwitch` in `ranked.ts`): `?rank=gold-3`, `?rank=wood-5`, `?rank=pearlescent`,
    `?rank=transcendent` shows that rank (45 RP into a division; 120 RP for a top tier) in place of your own on your own
    screens (home, the stage, your strip, the result, your profile, even before a game), only where
    `testSwitchesAllowed()`; read once as the page opens. A player's is ignored.
- **Coins** (`duelCoins`): per minute of the game's length by result (win 2.4, draw 1.6, loss 0.8), at least 1, at
  most 70, only when both sides made 10 moves; none for an aborted or a bot game, nor for a player fair play holds (in
  review). At most `coins.perDay` (20) paying games a UTC day per account (`coin_day`, `coin_games` on their
  `ranked_1v1` row, written in the game's batch); later games still count for the rank. Lined up with what a Squads
  lobby pays per minute (the decision file has the table and the farming numbers).
- **Recording** (`ranked.ts`, `recordDuel`): one D1 batch per finished game: the game's row, both players' ranks (from
  both records as they stand now), their coins. The game's row goes in only if neither player's record changed since it
  was read (another game of theirs ending at the same moment), and everything else applies only if that row is this
  recording's (its nonce), so a game is recorded once; a row that didn't go in is read again and retried. The object
  starts a try at the end and again on any wake while no outcome has come back (15 s after the last try started, 4
  tries: a slow failure, an eviction or a deploy mid-way loses nothing); a game already in answers each player's rank as
  it stands. A game on a test's clock where `TEST_SWITCHES` isn't "1" records nothing ("Unranked game").
- **The bot game** (`BotDuel` in `packages/app/src/duel.ts`): "Play a bot (unranked)" plays on the device by the same
  rules, the same vote (the bot picks at random) and the same board: Maia at the player's hidden rating (the first
  queue answer's `botRating`; the bosses' human-like engine, its own draw, `BOSS_BRAIN` temperature and top-p) when
  that's within `bot.maiaMin`-`maiaMax` and Maia may run here, else (and while Maia loads) Stockfish at that strength
  (`playAtElo`, 1320-3190). It thinks within `bot.thinkMs`, never more than `clockShare` of its clock; it takes a draw
  only when clearly behind on material. No chat, no rank, no coins, nothing recorded. The town square's bots play the
  same game (`town`: the bot's name and rating, no versus moment, Maia's loading step before the vote, "Casual game",
  "Back to town"; [town-square.md](town-square.md), "The bots and playing them").
- **Fair play** ([fairplay.md](fairplay.md), "1 v 1"): reports from the profile, as everywhere (opened from the game,
  a report names it); the case page's engine check covers the player's kept 1 v 1 games, reported ones first, each move
  against every legal move in near-equal groups of at most 8 (the engine server's limit), within the deep re-check's
  daily budget; a position whose groups can't all be searched (the press's searches or the day's budget run out
  partway) is dropped and searched whole next time; shown for the reviewer, never in the suspicion score.
- **The first-time vote hint** (`components/VoteHint.tsx`, shared by every pawn vote): "Drag your pawn into the speed
  you want" at the foot of the board, the first time a device meets a pawn vote (`brc.voteHintSeen`), until the pawn is
  dropped or the vote ends.

## The protocol

`packages/chess/src/duel/protocol.ts` (`DUEL_PROTOCOL` 1; an app on another answers `error` with `reload`, and it
reloads once). HTTP: POST `/api/1v1/play[?ticket=&pool=&clock=]`, POST
`/api/1v1/cancel?ticket=`, GET `/api/1v1/game/CODE`, `/api/1v1/game/CODE/ws`. The socket gets `welcome` (your side, the
game in full), `game` (a phase change, a sync, the end), `picks`, `move` (with the clocks), `moveNo` (with the game),
`draw`, `presence`, `outcome`, `chat`, `chatLog`, `chatNo`, `error`, `closed`, each with the server's `now`; it sends
`hello`, `pick`, `move` (with its ply), `resign`, `draw`, `drawNo`, `chat`, `chatPrefs`, `sync`. The versus moment ends
by the clock (`voteAt`); everything else comes as a message.

## Data stored

| Table / column | What | Kept |
| --- | --- | --- |
| `ranked_1v1` (user_id, rating, rd, games, wins, losses, draws, ladder, last_game, last_at, coin_day, coin_games, peak, streak; index `ranked_1v1_ladder` on ladder, Oct 28) | A player's hidden rating, record and ladder place; the UTC day of their last paying game and how many paid that day; the highest ladder reached and the current run of wins (from Oct 28) | With the account; deleted with it; in the download; a guest's moves to an account without one on sign-in |
| `ranked_1v1_games` (id, white_id, black_id, control, result, reason, moves, times, started_at, ended_at, checked, nonce, white_points, black_points) | Each ranked game (never an aborted one): moves (UCI), think times (ms), how it ended; fair play's engine check by side; the rank points it moved for each side (from Oct 28) | `gamesKeepDays` (30) after it ends (the 15-minute cron, `purgeDuelGames`); longer only while a player in it has a fair-play case open (watch or review) or an appeal of a ban waiting (`purgeEvidence`'s rule); on account deletion that player becomes "deleted" in it; the download has a player's games (opponent by name, not the check) |

No `results` rows for 1 v 1 (Crowd's stats and `users.rating` stay as they were). The privacy policy's "1 v 1 (ranked)"
entry says the same.

## Where the code is

| What | Where |
| --- | --- |
| The vote's rule, Glicko-1, the ladder, rank points, placements, pairing, coins (pure) | `packages/core/src/ranked.ts`; numbers `RANKED_1V1` |
| The game's rules and the protocol (pure, shared with the app) | `packages/chess/src/duel/` (`@chessroyale/chess/duel`) |
| The game's room (pure) and object | `packages/server/src/duel-room.ts`, `duel-do.ts` (binding `DUELS`, migration v6) |
| Ranks and games in D1; the schema, a guest's merge, the profile's read | `packages/server/src/ranked.ts`, `ranked-schema.ts` |
| The queue | `packages/server/src/matchmaker.ts` (duel mode, `duelNext`, `cancel`), `queue.ts` (`PAIR_BY_RATING`) |
| Routes, the cron's purge | `packages/server/src/index.ts` (`duelRoute`, `scheduled`) |
| Fair play's engine check of 1 v 1 games | `packages/server/src/fairplay-duel.ts`; the case page in `admin.ts` |
| The app: queue, online game, bot game, the way in | `packages/app/src/duel.ts` |
| The screens (`DuelFront`: the stage, then the board); the stage; the vote on the board; the hint; the rank pill; the emblem | `packages/app/src/screens/Duel.tsx`, `components/DuelStage.tsx`, `DuelVote.tsx`, `VoteHint.tsx`, `DuelRankPill.tsx`, `RankEmblem.tsx`; styles `dv-` and `re-` in `styles.css` |
| The emblems: the drawing, its bake, the baked picture | `packages/app/src/characters/rank-set.ts`, `scripts/bake-emblems.ts`, `packages/app/src/emblems/` |
| The top tiers' place (the count and its minute's cache), a rank with it | `packages/server/src/ranked-schema.ts` (`topPlace`, `rankOf`) |
| The stage, recorded (GIFs and stills, light and dark, 320-1280 px) | `scripts/frames-versus.mjs` |
| Browsing while queued: the bar, the leave confirm, the found alert; App's `duelAway` | `packages/app/src/components/DuelQueueBar.tsx` (mounted in `main.tsx`), `App.tsx`; recorded by `scripts/frames-queue-browse.mjs` |
| The home screen's helper; an admin's `?rank=` | `packages/app/src/ranked.ts` (`ranked1v1Label`, `ranked1v1Rank`, `rankFromSwitch`, `yourRankShown`) |
| Wiring (`/1v1`, `/1v1/CODE`) | `packages/app/src/App.tsx` |

## Settings

`RANKED_1V1` (controls, the vote and the game's timings, pairing, the hidden rating, tiers, the top tiers and their
floor, rank points, placements, coins, games kept, the bot); `CAPACITY.queue` (the queue's asks); `QUICK_CHAT`, `CHAT_MOD`; the
kill switch `PAUSE_RANKED1V1`.

## Tests and tools

- Unit: `packages/core/test/ranked.test.ts` (every pair of picks and missing picks, Glicko-1, the ladder's labels,
  placements, promotion and demotion, the floor, rank points with the expected result, farming bounded, pairing's
  widening, deviations and devices, coins), `packages/chess/test/duel-rules.test.ts` (the vote and the start, first
  moves and the abort, Fischer clocks, flags and the draw when the other side can't mate, every ending, repetition by
  position (castling rights, en passant), resign and abort, draw offers), `packages/server/test/duel-room.test.ts` (the
  timeline, no-shows, aborts, moves and refusals, a resent ply never played twice, checkmate handed over, recording
  tried again until an outcome is in, disconnect and reconnect with the clock running and the flag while gone, draws,
  a test clock, closing, chat: relay, limits, mute, off, a chat ban), `duel-do.test.ts` (the object on a fake runtime:
  a game to mate over its sockets, recorded once, a restart, closing; a recording slow to fail or lost to an eviction
  tried again without the alarm spinning; a test clock unranked without test switches; an old app told to reload;
  nothing stored for a sync or a refused move; a seat without a player refused; only its two players get in),
  `duel-queue.test.ts` (pairing and widening, one ticket per account and one device, a ticket without its player
  never paired, an expired or made-up ticket, an ask while its game is being opened, Cancel, the Matchmaker's duel
  mode; a game whose opening throws: the pair back in line in order and seated next, the batch's other pairs too, a
  throw every time tried once a second, never at once; putBack leaving placed tickets placed; an account's other
  device while its ticket is being seated), `ranked-store.test.ts` (recording:
  placements, ranks, coins, the daily cap, once (and the answer to a repeat), a race with another game, aborted games,
  fair play's hold (no rank change, no coins), a deleted account; the purge by fair play's rule; the profile; the
  download, deleting, a guest's merge), `fairplay-duel.test.ts` (the engine check within the engine server's 8 moves
  a search), `kill-switches.test.ts` (the 1 v 1 queue resting), `account-data.test.ts` (the tables pinned and covered);
  `packages/app/test/duel.test.ts` (the hint once per device, an expired ticket, the clock sample, a move resent after
  a reconnect, clocks, the result's words, the home screen's label), `faq.test.ts` (1 v 1's words follow the
  settings).
- Tiers and emblems (Oct 28): `packages/core/test/ranked.test.ts` (every ladder to its tier, division and RP at the
  edges; the top tiers' floor, top 500 and top 100; stored ladders 0-4000 keep their hidden rating; each pill's
  contrast), `packages/server/test/ranked-store.test.ts` ("the top tiers": the place counted, ties sharing it, the
  count's plan on the index and its minute's cache, the profile, the queue and a result), `packages/app/test/rank-emblems.test.ts`
  (the baked picture is the drawing, every rank's emblem in it, `?rank=`'s values), `e2e/ranked-tiers.spec.ts` (the
  versus screen's emblems, a division up's result, home's panel and the profile, `?rank=` for an admin and not a
  player, the loops still under reduced motion), and the stills: `npx tsx scripts/frames-ranked-tiers.ts <dir> [url]`.
- Simulation: `npx tsx packages/sim/scripts/ranked-1v1-sim.ts` → `reports/ranked-1v1.md` (synthetic players with a
  known strength through core's own functions: convergence, the rank distribution, the scale, waits and gaps,
  sandbagging, trading wins). Run it again after changing `RANKED_1V1`'s rating, points, placements or pairing.
- e2e: `e2e/ranked-1v1.spec.ts` (two players on phones and computers: the queue, the vote on the board by drag and by
  tap, the overlay, the board unmoved from the vote to the game, checkmate by taps, ranks moving; resigning, then a
  flag after Play again; every change drawn with the page's clock held still (the result, then the rank); an aborted game; a reload mid-game back into the same game with its clocks running, a
  declined draw offer then a draw both agree to; Leave before the first moves; the search's Cancel, "Few players
  online", Keep waiting, a bot game arriving on the same stage; the stage: your pawn on the left platform while
  searching, the opponent's pawn, name and rank on the right when found, your pawn's element kept and nothing on the
  stage moved, held for `versusMs`, then the board; the stage whole at 320, 360 and 390 px (1280 on a computer) with
  the longest names and ranks, searching with "Few players online" and in the versus moment (held there by the test's
  own copy of the game's messages), no scroll either way, nothing animating under reduced motion).
- e2e: `e2e/ranked-1v1-browse.spec.ts` (phones and computers: Home from the search, still asking, the bar on home and
  in the shop over nothing, back to the stage with the same wait, Cancel from the bar; found in the shop: the sound and
  the buzz, straight to the stage, the versus moment whole, then the board; 1 v 1's PLAY back to the stage, another
  mode's confirm, Stay and Leave queue; a reload on the stage and from home carrying on, then found, no buzz with
  sound off, no bar after; the bar whole at 320/360/390 (1280), gold at Few players online and to its choices).
- Frames: `node scripts/frames-queue-browse.mjs <dir>` records browsing while queued at 390 px, light and dark: the
  stage, home and the shop with the bar, found in the shop, the board (GIFs), and the bar at Few players online, the
  confirm and home at 320 px.
- Frames: `node scripts/frames-versus.mjs <dir>` (against a local Worker) records the search and an opponent arriving
  at 390 px, light and dark (GIFs), stills at 320, 360, 390 and 1280 px, "Few players online" and the bot, and flags
  the stage moving or the page scrolling sideways.

## Rules for this area

- Ranks are worked out on the server from the game object's own record, never from anything an app sends; bots never
  move a rank.
- Every number in `RANKED_1V1`; the FAQ quotes them from there. A change to the rating, the points, placements or
  pairing is measured with the simulation first (the ranked lane's rule).
- The search and the versus moment are the same `DuelStage` element under the same component (`DuelFront`), so Preact
  keeps it from one to the other: your pawn is never drawn again (its drop would play twice). Render them through
  `searchStage` / `versusStage`, never as components of their own.
- Nothing on the stage moves when something arrives or goes: anything new on it is absolute, or has its room kept.
- 1 v 1's CSS classes start with `dv-` (the shared hint's is `first-vote-hint`): a generic name can already be someone
  else's. (`.vote-hint` was Crowd's line above its vote board; styling it moved that board 12 px, caught by
  `votes.spec.ts`.)
- The game screen redraws by a count, never by setting the time as state: Preact skips a state set to the value it
  holds, so a change in the same millisecond as the last draw was lost ("Updating your rank…" for good;
  [2026-10-28-two-flaky-tests.md](../decisions/2026-10-28-two-flaky-tests.md)).
- A phone's game screen is locked (nothing scrolls) while the game is played; once it's over it scrolls, so the result
  card never clips the chat (which never gets less than 140 px).
- The board never moves from the vote to the result: anything new for the vote or the game is drawn over it, in
  eighths of `--board-size`.
- Anything the game object starts has an end (a result, an abort, a no-show, closing after its results): a test for
  each.
- A new table (or column) goes in `ACCOUNT_STORES` or `NO_ACCOUNT_DATA` and the privacy policy in the same PR.
