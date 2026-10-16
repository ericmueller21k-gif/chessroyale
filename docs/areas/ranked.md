# Ranked 1 v 1

Lanes: `ranked` (the rating math, ranks, pairing), the director (the game's rules and screens), `hub` (the home screen's
1 v 1 button: not built yet; it calls `startRanked1v1()` and shows `ranked1v1Label()`). Why it's built this way:
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
  account's name through the name filter, the locker's look, the rank, the hidden rating) and makes a ticket; one
  ticket per account (a second tab is the same ticket, and an account never meets itself). The app asks again at once
  with its ticket (each ask waits up to `CAPACITY.queue.holdMs`): `{ searching }` until paired, then `{ code }`. Pairs:
  the longest wait first, with the closest hidden rating within `startRange + perSecond × seconds waited` (the longer
  wait's) `+ perRd ×` the larger of the two deviations (as they stand that day), at most `maxRange` (`RANKED_1V1.match`:
  100, +10 a second, +1 × deviation, 1000; so two players in placements, still uncertain, meet at once, and settled
  ones at 160). Cancel takes the ticket out; a pairing made
  that very moment is called off for that player (`DuelGame.abandon`: an abort before any move, nothing recorded).
  After `fewPlayersSeconds` (45) the app offers "Few players online right now" with Keep waiting and Play a bot
  (unranked).
- **A game** (`duel-room.ts`, pure, around the rules in `@chessroyale/chess/duel`; `duel-do.ts`, the `DuelGame` object):
  - **waiting** for both players' sockets (seats by account: a reload or another device of theirs goes straight back
    in), at most `joinSeconds` (10), or it's called off ("no_show", nothing recorded);
  - **versus** (`versusMs`, 2.5 s): the "found" moment, both players' names, looks and ranks (the versus art comes
    later; today a plain placeholder, `DuelVersus`);
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
  arrives.
- **Quick chat** as in other online matches (`MatchChat`, `ChatPanel`), one channel (no teams: every line a player
  owns goes to both), the limits of `QUICK_CHAT`, mute by account on the device (`chat-mod.ts` in the app) and on the
  server (`chatPrefs`), and #252's chat bans (read as each player connects, again at most every `CHAT_MOD.recheckMs` as
  they chat: "mod" refusals).
- **Ranks** (core's `ranked.ts`; LoL's, Eric: "we can even like take from there exactly"):
  - **The hidden rating:** Glicko-1, each game its own period; a new player starts at their account's rating from
    other modes (`users.rating`, clamped 800-2400) or 1500, deviation 350, down to 60 with games, back up with idle days.
  - **The ladder:** one integer per player: division index × 100 + rank points (Iron 4 0 = 0). Iron, Bronze, Silver,
    Gold, Platinum, Emerald and Diamond, divisions 4 → 1 (0-2799); then Master (2800+), Grandmaster from 200 RP above
    Master's start, Champion from 500 (no divisions, no leaderboard rule). Crossing 100 points is the next division
    (the extra carried), below 0 the one before; no promotion series, no demotion shields; never below Iron 4 0.
  - **Rank points a game:** 2 × 20 × (the result − the expected result from the two hidden ratings): ±20 between
    equals, more for beating someone stronger, less for beating someone weaker; plus 0.05 × (hidden rating − the
    ladder's rating), that adjustment within ±10 (a draw: half). A win never takes points, a loss never gives them.
    The ladder's rating: 800 at Iron 4 0, +1600/2800 a point (2400 at Master's start).
  - **Placements:** the first 5 rated games show "Placement N/5"; the fifth places the player from the hidden rating,
    at most Diamond 4 0. Aborted games don't count.
  - **Fair play's hold:** a player in review keeps their rank as it is (their games don't move it); their opponent's
    game counts as usual.
  - **Shown as** `RankView.label`: "Gold 2 · 45 RP", "Master · 120 RP", "Placement 2/5"; on the profile (yours and
    anyone's: a "1 V 1" section, null for a banned player), in the game's strips and the versus moment, and on the
    result card ("Gold 2 · 45 RP (+18)", "Placed: Gold 4 · 25 RP"). The home screen's button reads
    `ranked1v1Label()` (`packages/app/src/ranked.ts`).
- **Coins** (`duelCoins`): per minute of the game's length by result (win 2.4, draw 1.6, loss 0.8), at least 1, at
  most 70, only when both sides made 10 moves; none for an aborted or a bot game. Lined up with what a Squads lobby pays
  per minute (the decision file has the table).
- **Recording** (`ranked.ts`, `recordDuel`): one D1 batch per finished game: the game's row, both players' ranks (from
  both records as they stand now), their coins. The game's row goes in only if neither player's record changed since it
  was read (another game of theirs ending at the same moment), and everything else applies only if that row is this
  recording's (its nonce), so a game is recorded once; a row that didn't go in is read again and retried. A failed
  recording is tried again on the object's alarm (15 s apart, 4 tries).
- **The bot game** (`BotDuel` in `packages/app/src/duel.ts`): "Play a bot (unranked)" plays on the device by the same
  rules, the same vote (the bot picks at random) and the same board: Maia at the player's hidden rating (the first
  queue answer's `botRating`; the bosses' human-like engine, its own draw, `BOSS_BRAIN` temperature and top-p) when
  that's within `bot.maiaMin`-`maiaMax` and Maia may run here, else (and while Maia loads) Stockfish at that strength
  (`playAtElo`, 1320-3190). It thinks within `bot.thinkMs`, never more than `clockShare` of its clock; it takes a draw
  only when clearly behind on material. No chat, no rank, no coins, nothing recorded.
- **Fair play** ([fairplay.md](fairplay.md), "1 v 1"): reports from the profile, as everywhere (opened from the game,
  a report names it); the case page's engine check covers the player's kept 1 v 1 games, reported ones first, within
  the deep re-check's daily budget; shown for the reviewer, never in the suspicion score.
- **The first-time vote hint** (`components/VoteHint.tsx`, shared by every pawn vote): "Drag your pawn into the speed
  you want" at the foot of the board, the first time a device meets a pawn vote (`brc.voteHintSeen`), until the pawn is
  dropped or the vote ends.

## The protocol

`packages/chess/src/duel/protocol.ts` (`DUEL_PROTOCOL` 1). HTTP: POST `/api/1v1/play[?ticket=&pool=&clock=]`, POST
`/api/1v1/cancel?ticket=`, GET `/api/1v1/game/CODE`, `/api/1v1/game/CODE/ws`. The socket gets `welcome` (your side, the
game in full), `game` (a phase change, a sync, the end), `picks`, `move` (with the clocks), `moveNo` (with the game),
`draw`, `presence`, `outcome`, `chat`, `chatLog`, `chatNo`, `error`, `closed`, each with the server's `now`; it sends
`hello`, `pick`, `move` (with its ply), `resign`, `draw`, `drawNo`, `chat`, `chatPrefs`, `sync`. The versus moment ends
by the clock (`voteAt`); everything else comes as a message.

## Data stored

| Table / column | What | Kept |
| --- | --- | --- |
| `ranked_1v1` (user_id, rating, rd, games, wins, losses, draws, ladder, last_game, last_at) | A player's hidden rating, record and ladder place | With the account; deleted with it; in the download; a guest's moves to an account without one on sign-in |
| `ranked_1v1_games` (id, white_id, black_id, control, result, reason, moves, times, started_at, ended_at, checked, nonce) | Each ranked game (never an aborted one): moves (UCI), think times (ms), how it ended; fair play's engine check by side | `gamesKeepDays` (30) after it ends (the 15-minute cron, `purgeDuelGames`), longer while a player in it is in review or banned; on account deletion that player becomes "deleted" in it; the download has a player's games (opponent by name, not the check) |

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
| The screens; the vote on the board; the hint; the rank pill | `packages/app/src/screens/Duel.tsx`, `components/DuelVote.tsx`, `VoteHint.tsx`, `DuelRankPill.tsx`; styles `dv-` in `styles.css` |
| The home screen's helper | `packages/app/src/ranked.ts` (`ranked1v1Label`, `ranked1v1Rank`) |
| Wiring (`/1v1`, `/1v1/CODE`) | `packages/app/src/App.tsx` |

## Settings

`RANKED_1V1` (controls, the vote and the game's timings, pairing, the hidden rating, tiers and apex tiers, rank
points, placements, coins, games kept, the bot); `CAPACITY.queue` (the queue's asks); `QUICK_CHAT`, `CHAT_MOD`; the
kill switch `PAUSE_RANKED1V1`.

## Tests and tools

- Unit: `packages/core/test/ranked.test.ts` (every pair of picks and missing picks, Glicko-1, the ladder's labels,
  placements, promotion and demotion, the floor, rank points, pairing's widening, coins),
  `packages/chess/test/duel-rules.test.ts` (the vote and the start, first moves and the abort, Fischer clocks, flags and
  the draw when the other side can't mate, every ending, resign and abort, draw offers),
  `packages/server/test/duel-room.test.ts` (the timeline, no-shows, aborts, moves and refusals, checkmate handed over
  once, a failed recording retried, disconnect and reconnect with the clock running and the flag while gone, draws, a
  test clock, closing, chat: relay, limits, mute, off, a chat ban), `duel-do.test.ts` (the object on a fake runtime:
  a game to mate over its sockets, recorded once, a restart, closing; only its two players get in), `duel-queue.test.ts`
  (pairing and widening, one ticket per account, Cancel, the Matchmaker's duel mode), `ranked-store.test.ts` (recording:
  placements, ranks, coins, once, a race with another game, aborted games, fair play's hold, a deleted account; the
  purge; the profile; the download, deleting, a guest's merge), `fairplay-duel.test.ts` (the engine check),
  `kill-switches.test.ts` (the 1 v 1 queue resting), `account-data.test.ts` (the tables pinned and covered);
  `packages/app/test/duel.test.ts` (the hint once per device, clocks, the result's words, the home screen's label),
  `faq.test.ts` (1 v 1's words follow the settings).
- Simulation: `npx tsx packages/sim/scripts/ranked-1v1-sim.ts` → `reports/ranked-1v1.md` (synthetic players with a
  known strength through core's own functions: convergence, the rank distribution, the scale, waits and gaps,
  sandbagging, trading wins). Run it again after changing `RANKED_1V1`'s rating, points, placements or pairing.
- e2e: `e2e/ranked-1v1.spec.ts` (two players on phones and computers: the queue, the vote on the board by drag and by
  tap, the overlay, the board unmoved from the vote to the game, checkmate by taps, ranks moving; resigning, then a
  flag after Play again; an aborted game; the search's Cancel, "Few players online", Keep waiting, a bot game).

## Rules for this area

- Ranks are worked out on the server from the game object's own record, never from anything an app sends; bots never
  move a rank.
- Every number in `RANKED_1V1`; the FAQ quotes them from there. A change to the rating, the points, placements or
  pairing is measured with the simulation first (the ranked lane's rule).
- The board never moves from the vote to the result: anything new for the vote or the game is drawn over it, in
  eighths of `--board-size`.
- Anything the game object starts has an end (a result, an abort, a no-show, closing after its results): a test for
  each.
- A new table (or column) goes in `ACCOUNT_STORES` or `NO_ACCOUNT_DATA` and the privacy policy in the same PR.
