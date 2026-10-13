# Squads

Lane: the director (a new mode; the match screens are the director's). Status: **playable**. The rules and a bot
simulation (phase 1), then clocks in place of the pace and the move cap, now one team clock per squad for the whole
tournament (Eric, Oct 10). **The server** (phase 2: the lobby, parties, the queue, bots, the bracket, the test controls,
the protocol; see "The server" below). **The screens** (phase 3: the menu slot, parties, the waiting room, the votes,
the standings and team clocks, Relay, Pairs, the final's staging, spectating, the results, the test controls on
screen, the app's side of bot work, the sounds; see "The screens" below). **Squads v2** (Eric, Oct 12; DECISIONS.md,
"Squads v2"): same-move tokens in Pairs (refunded by the judge on players' devices), move blocks in every round, and
the final a majority vote of the whole squad; the old Pick and Block is gone. **Modes** (Eric, Oct 12; DECISIONS.md,
"Squads modes: Classic and Mercenary"): the first vote picks **Classic** (just chess: same-move tokens, no blocks, no
coins) or **Mercenary** (coins, a team shop between rounds, items for the next match; blocks on), and shows a third
mode as "Coming soon". Mercenary was called Pillage in the first notes; it's `mercenary` everywhere. **Time controls**
(Eric, Oct 13; DECISIONS.md, "Squads: three chess time controls"): the Clock vote picks **Bullet 1+1**, **Blitz 3+2** or
**Rapid 5+3** (nobody voting: Blitz), each a team bank with a chess increment that banks and its own cap on a move.

## How it works today

- **Pure rules in `packages/chess/src/squads/`**, imported as `@chessroyale/chess/squads`. They live in the chess
  package because they need chess.js (legal moves, mate in one) and the opening library; `core` stays chess-free.
  **No engine in the rules but one**: a same-move token's refund weighs the judge's top moves, given to the rules as
  data (`judgeTokenUse`); every game is played to the end, and nobody loses on time; only the silent safety cap and
  the test-only "Next round" fall back on material. "Better pick" exists only in the sim.
- **Lobby** (`lobby.ts`): `formSquads` packs parties (1-4) into 8 squads of 4, largest first, each into the squad with
  the fewest free seats it fits (people end up with people); parties that don't fit wait; bots fill every empty seat;
  seats are shuffled. `drawBracket` (seeded, unranked), `reportWinner`, `placements` (1, 2, 3 = 3rd-4th, 5 = 5th-8th).
  `noteActions` logs every miss; `noShowsBeforeBot` (3) in a row hands the seat to a bot (`replacedByBot`).
- **Seeded randomness**: `squadsRng(seed, ...names)` gives each decision its own stream (match, turn, half, board,
  what's drawn), so the server can replay any decision from the lobby's seed, and adding a draw never moves others.
- **Votes** (`votes.ts`): Mode, Start and Clock as `PregameVote`s, run by Crowd's machinery (`castPregameVote`,
  `botVotes`, `closePregameVote`); `rulesFromVotes` gives `SquadsRules`. Nobody voting: Classic, the normal start, the
  Blitz clock (the middle option). The Mode vote's third option is `disabled` ("Coming soon": shown, never votable: `votable`). Bots vote
  on the mode by a lean drawn per lobby (`botModeVotes`, `modeVote.classicLean`: most lobbies' bots lean Classic). A test
  lobby's bots sit the Mode vote out (its opener decides), and its link's `mode=` skips it (`heldVotes`).
- **The team clock** (Eric, Oct 10): one bank per squad for the whole tournament (`Squad.bankMs`), carried from
  match to match (`startTeamClocks`, then `planMatch` brings it in, `settleTeamClocks` takes it out), with a top-up
  when a squad starts a new round. The Clock option (Eric, Oct 13: three chess time controls) sets the starting bank,
  the top-up, the free seconds a move (a delay), the increment and the cap on a move; each match carries its own
  (`delayMs`, `incrementMs`, `capMs`), so a match never changes clock under its players.
  - **The options** (`SQUADS.clocks`), on the cards in chess form (`clockLabel`: "Bullet 1+1"; `teamClockLine`;
    `teamClockDetail` for the result's banner; `matchClockLine` on each match's opening card):

    | Option | Bank | Increment | Free seconds | Cap on a move | Top-up a round |
    | --- | --- | --- | --- | --- | --- |
    | Bullet 1+1 | 1:00 | +1 s | 2 s | 10 s | +15 s |
    | Blitz 3+2 (nobody votes) | 3:00 | +2 s | 2 s | 15 s | +30 s |
    | Rapid 5+3 | 5:00 | +3 s | 2 s | 20 s | +1:00 |
  - **Old ids** (`clockById`): fast → bullet, normal → blitz, long → rapid; one we don't know gets Blitz, never an
    error. A stored vote's result is the option's place, so an old Fast, Normal or Long vote reads as Bullet, Blitz or
    Rapid. A clock stored before the time controls (`upgradeClock`, `upgradeRules`; a match: `upgradeMatch`) keeps its
    own numbers and the one ceiling every option had then (`legacyCapSeconds`, 20 s): a lobby in play across that
    deploy finishes on the clock it voted.
  - **Draining.** Each of a squad's moves being thought about drains its bank past the free seconds: a Relay mover,
    a pair (the slower picker), the final's voting squad (its slowest picker). Placing a block is thinking time too: a
    move's time runs to the block if that came later. Two of a squad's moves being thought about at once (Relay's two
    movers each half) drain it twice as fast (`bankRunsOut`).
  - **The cap on a move** (the option's `capSeconds`, the match's `capMs`) bounds every move while the bank lasts. A
    mover or picker who hasn't chosen by then misses (a random move it may play), the bank draining meanwhile.
  - **The increment** banks, as on a chess clock: each move made in time earns it, credited after the half (`earned`;
    a missed move earns none, `incrementOnMiss`). A move quicker than the free seconds and the increment together
    adds to the bank (not capped at its start); a slower one costs only what's past them. So a squad's bank settles
    where its drain and its increments meet (in the sim about 20 s on Bullet, 35 on Blitz, 45 on Rapid), and the
    increment, more than the bank, sets an option's pace.
  - **Sudden death.** If the bank runs out during a half, the squad's moves still being thought about are cut off
    (random moves). At zero, each move must be made within the free seconds, or it's missed. There are no flag
    falls. Each move made in time earns the increment, which lifts the squad out again: near zero a squad lives on
    it (each move the free seconds and the increment). The "sudden_death" event comes only when a bank is still
    empty once the half's increments are in.
  - **What every player sees:** each squad's bank and whether it's in sudden death (`teamClocks` for the lobby,
    `matchClocks` live in a match, and the half's `bank` and `sudden_death` events).
  - **Records:** `resolveHalf` returns `timeouts` among the missed (out of time, not absent). The sim leaves them out
    of the no-show streak, so a slow move in sudden death doesn't hand a seat to a bot.
- **A match** (`match.ts`) is played in turns of two halves (White's moves, then Black's). The server's loop:
  `halfDuties` (who acts, with each duty's deadline: the ceiling, or the free seconds in sudden death; who scouts;
  forced moves; the mercy rule), `choose` / `lockIn` / `halfReady` while the clocks run, `visibleChoices` for what each
  viewer may see, then `resolveHalf` with each player's thinking time: it drains the banks, plays the half, and returns
  the events, who acted, who missed and who ran out of time. Then the safety cap, the result, the next half.
  - **Relay** (round 1, 4 boards): seat i is on board (i + turn) mod 4 (`relaySeat`). Side 0 is White on boards 1 and
    3, so every player alternates colors turn by turn and each half two of a squad move. A finished board: whoever's
    turn it would be there scouts.
  - **Pairs** (round 2, 2 boards): `pairSchedule`: partners 1+2, 1+3, 1+4 (and the other two), player 1's pair
    alternating slots; slot 0 plays board 1, slot 1 board 2. Each picks; a coin plays one. A missed pick is a random
    move other than the partner's. One move to play: it plays itself.
  - **Same-move tokens** (Pairs; `tokens.ts`): each squad has `tokens.perMatch` (5) a match. Both partners on the same
    move with a token left: it plays (no coin) and a token burns, logged in the match's `tokenLog`. At 0, picks must
    differ (`choose`: "no_tokens"). After the half the server asks the judge (`judgeTokenUse` over the bot engine's
    top moves for the position, from players' devices): the best move, and every other worse by `refundGap` (0.37 of
    expected score, about two pawns from level), refunds it (`settleTokenUse`); no judge, no refund. Every use, its
    verdict and its numbers (pawns' worth: the gap over `pawnWorth`) make the post-match breakdown.
  - **The final** (one board): the whole squad to move votes (one duty, four players). Every pick made in time counts
    once; the most picked move plays; a tie for the most, a seeded coin between the tied moves; nobody picked, a
    random move (the "vote" event). Picks show live to their own squad only. No tokens.
  - **Move blocks** (Mercenary, every round; `blocks.ts`; Classic's block bank is 0, so none): on its turn on a board, before its move there is settled, any of a
    squad's players with a duty there may block moves of the other squad (`placeBlock`): a piece to a square, by how
    the piece moves (a slider up to and onto the first piece in its way, a pawn's pushes and diagonals, castling while
    they have the right). Paid at once from the squad's block bank for the match (`blocks.bankPerMatch`, 5; pawn 1,
    knight, bishop or rook 2, queen 3, castling 2, the king's ordinary moves never), as many a turn as the bank allows
    (`maxPerTurn` null). After the squad's move, each board's blocks are weighed together (`liftBlocks`): one whose
    move isn't possible any more is lifted; in check, all are; then, while they'd leave no move or only moves allowing
    mate in one, the most recent is lifted. Lifted blocks are refunded ("block" events say which and why). The rest are
    in effect on the other squad's next turn there (`m.blocks`: `choose` refuses them, "blocked"; misses, forced moves
    and bots never play them), then gone.
  - **The safety cap** (120 moves per side) is the only cap: material decides a board still going then.
  - **Clinch**: more than half the points ends the match at once. **Ties** in rounds 1 and 2: the squad with more
    team bank left at the end of the match, a seeded coin if exactly level; no Armageddon. **A drawn final**: one
    Armageddon board, a vote too, on its own fixed clocks (`startArmageddon`: White 1:30, Black 1:00, +1 s, by
    team-clock rules with the lobby's free seconds; a draw is Black's), each squad keeping the block bank the final
    left it. The squad with more team bank left picks its color (`armageddonChooser`). `endByMaterial` is the
    test-only "Next round" (a level result goes to bank, then a coin).
- **Mercenary** (`mercenary.ts`; numbers `SQUADS.mercenary`; the calibration `reports/squads-mercenary.md`):
  - **The wallet.** One per squad for the tournament, shared by its players (`Wallet`: coins, `earned` by play and by
    round, catch-up, what it has `bought` this tournament, its `cart` for the next match). Coins left carry on.
  - **Earning** (Eric, Oct 13: shaped like CS's or Valorant's economy, a steady base with play on top). The match's
    rules emit "coins" events (a Mercenary match only): the base, `played`, to both squads as a match ends (most of the
    coins; a drawn final's Armageddon doesn't pay it again) and the match won; on top, a capture by the piece taken (en
    passant a pawn), a board won and more for a mate, a drawn board to each side. A board's coins are
    multiplied by `roundScale` (Relay ×1, Pairs ×2, the final ×4: fewer boards, more each), so every round pays a
    squad about the same (Eric, Oct 13: 500-800 a round on average). A **brilliant move**
    (`brilliantCandidate`, then `isBrilliant` over the judge's top moves): a quiet move (no capture, not out of check),
    from ply `brilliant.fromPly`, the best by `brilliant.gap` of expected score over every other move in a position
    still in the balance, found without a Stockfish token. It pays `brilliant.coins` (25) at most
    `brilliant.capPerMatch` (2) times per squad per match (`brilliantPay`; the lobby counts them in the match's
    `brilliantPaid`, Armageddon with its final); past that it's announced with no coins. **Catch-up** (`catchUpCoins`) as a match of round 2 or the
    final is set: the squad that has earned less by play gets a share of the gap (spending never counts).
  - **The shop.** Open from a squad's match's end until its next match's first half (the wait that's there anyway),
    for squads still in, never before round 1. `buyItem`/`unbuyItem`: each item's price rises by `priceStep` for every
    one bought before this tournament (`itemPrice`; the Time chip has its own list, `items.chip.prices`: 25, 25, 50,
    50, then 50); at most `items[x].cap` in one cart (the Time chip: held and in the cart, `capCount`). `takeCart` as
    the match starts: the cart becomes the match's kit (`applyKits`): block points into the block bank, Stockfish
    tokens and shields, and the squad's Time chips (all it holds, `kit.chip`, into the match's `chips`; the wallet's
    `chips` go back up as the match ends, `returnChips`). A drawn final's Armageddon carries the final's on. Four
    items. Taken out on Oct 13 (Eric): the Breather (double free seconds), and the time coin (+30 s on the bank), which
    became the Time chip; a match or wallet stored with one is read without it (`upgradeMatch`, `upgradeWallet`: one
    still in an open shop's cart is refunded, `itemCounts`).
  - **The Time chip** (Eric, Oct 13: "like a poker chip"; `useChip`): the squad's, kept from round to round, at most
    `items.chip.cap` (3) held. A player on a move being thought about taps it during their squad's move (in Pairs
    both partners share the board's), `seen` saying how many they saw on it so two at once spend one. It gives that
    move `chipSeconds` (30): the move's deadline that much later (`dutyDeadline`), and the bank held still for those
    seconds from the tap, not before the free seconds end (`chipWindows`); any of them unused is lost, never banked.
    Several stack. In sudden death it's the free seconds and 30 s more. The bank's run-out with chips:
    `bankTimeline`, `moveCutoffs` (a move a chip is holding when the bank runs out runs to the chip's end), and
    `liveCutoff` for a tap during the half. Never automatic (Eric rejected an automatic trigger as confusing).
  - **The Stockfish token** (`useStockfish`): on your own decision this half (your move before it's made, your pick or
    vote before you lock in), paid at once; one a player a half (the final: one for the squad). Its lines are your top
    moves in your position, your side to move (`tokenLines`: blocked moves out, never a reply), shown to you (the
    final: the whole squad, `assistShownTo`), worked out on each such device. Logged in the match's `assists`, and the
    events' `assisted` say whose choice had them on screen (`isAssisted`): never brilliant, never fair-play evidence.
  - **The shield** acts as the half is played: the first block placed against its squad that would take effect (the
    mercy rules and lifts weighed first) is "shielded": not in effect, its points still spent.
  - **Bots** (`botShop`, `botUsesStockfish`, `botChipTap`): a squad of bots shops a few seconds into its window, saving
    some rounds, spending most of its wallet in the final; blocks and Time chips most (chips up to what it may hold), a
    Stockfish token now and then. A bot uses one of its squad's tokens rarely (more when the engine's best stands out)
    and then plays the best move. It taps a Time chip on a move in sudden death (60%) or with under 20 s of bank (30%),
    0.7-1.8 s in, and thinks on into it. Never for a squad with people playing.
- **What the sim says** (`reports/squads-sim.md`, the time controls, Classic):
  - Median lobbies take 26.9 (Bullet), 33.5 (Blitz) and 43.9 (Rapid) minutes; 90th percentiles 34.7, 40.9 and 54.5.
    Mercenary: 29.9, 37.8 and 43.9. Bullet can't reach 20: about 11 minutes of every lobby is reveals, votes and the
    bracket (shorter reveals in Bullet: 24.0, Eric's call). Through the real server a Bullet bot lobby took 32.9
    minutes (one 13-minute Relay match), its bots never out of time.
  - 17-31% of squads reach sudden death, mostly in Pairs, but only 0.2-0.5% of moves are made in it (the increment lifts
    a squad out); 0.3-0.7% of actions become random moves for want of time.
  - Bots use 1-2 same-move tokens a Pairs match, 76-80% refunded (Mercenary's blocks: `reports/squads-mercenary.md`).
  - The final's vote: a clear majority on 54-72% of moves, the coin on 11-18%.
  - Ties go to the bank, and no longer to the coin (0 of 258: banks are rarely both at zero).
- **Bots** (`bots.ts`): the existing bot engine (Stockfish's top moves, then `botPick` at a skill; blocked moves left
  out, `topAllowed`) for Relay moves, pair picks (never the partner's, unless it's the bot's own best move and an only
  move, `isOnlyMove` at `bots.sameMoveGap`, with a token left: then the same), and the final's votes (`botVotePick`:
  sometimes a person's pick on the squad, `copyHumanChance`). Blocks, sparingly (`botBlock`): the other squad's
  likely reply to the bot's own move (the engine line's second move), at `blockChance` a move or `sharpChance` for a
  capture or a check (shared among the players choosing that move), keeping `blockReserve` unless sharp, never one a
  mercy rule would lift. Winning, a bot plays with purpose (`squadBotSkill` caps its temperature; `candidatesFrom`
  breaks ties by the engine's order and plays a mate it sees). `squadBotThinkMs` paces a bot by its clock. Bots take
  Black when they choose Armageddon's colors. Since the time controls (Oct 13) a bot's think also stays within 90% of when
  its squad's bank would run out with all its moves going (`cutoffMs`, `liveCutoff` as the half begins; `bots.inTime`),
  so bots living on Bullet's increment near zero move in time instead of being cut off.

## Where the code is

| What | Where |
| --- | --- |
| Boards, end detection, material, mate in one, fast legal moves | `packages/chess/src/squads/board.ts` |
| Move blocks: what a block can name and costs, allowed moves, the mercy rules (`liftBlocks`) | `packages/chess/src/squads/blocks.ts` |
| Same-move tokens: the judge's verdict (`judgeTokenUse`), the breakdown's numbers | `packages/chess/src/squads/tokens.ts` |
| Squads, parties, the bracket, records, seeded randomness | `packages/chess/src/squads/lobby.ts` |
| Who plays where (Relay rotation, the pair schedule) | `packages/chess/src/squads/schedule.ts` |
| The votes | `packages/chess/src/squads/votes.ts` |
| Matches: setup, team clocks (bring in, drain, sudden death, carry out, views), duties, choices, blocks placed, visibility, resolution (tokens, the vote, blocks), clinch, ties, Armageddon | `packages/chess/src/squads/match.ts` |
| Squad bots | `packages/chess/src/squads/bots.ts` |
| Mercenary: earning, brilliant moves, wallets, the shop, catch-up, the bots' shopping, a token's lines | `packages/chess/src/squads/mercenary.ts` |
| The bot simulation | `packages/sim/scripts/squads-sim.ts` → `reports/squads-sim.md` |

## Settings

`SQUADS` in `packages/core/src/settings.ts`: sizes and boards, the votes (`clocks`: each time control's starting bank,
top-up, free seconds, increment and cap on a move; `clockDefault`; vote timing), `legacyCapSeconds` (a clock stored
before the time controls), `incrementOnMiss`,
`safetyCap`, `material`, `materialLead`, points, openings, `tokens` (per match, `refundGap`, `pawnWorth`), `blocks`
(`bankPerMatch`, `cost`, `castlingCost`, `maxPerTurn`, `liftBeforeMate`, `liftInCheck`), `final` (`tie`),
`armageddon` (the drawn final's fixed clocks), `noShowsBeforeBot`, `replacementBotSkill`, `bots` (choosing, same
moves, blocks, copying in the final, winning with purpose, pacing), `modeVote` (the bots' lean), `mercenary` (earnings, catch-up, the price step, each item's price and cap, what
each item gives, the token's search, the test wallet, the bots' shopping and token use), and the show times. A mode
gives a match its own block banks (`MatchSetup.blockBanks`: 0 in Classic) without touching the rules.

## Tests and tools

- Unit: `packages/chess/test/squads-lobby.test.ts` (squads, records, bracket, votes, schedules),
  `squads-match.test.ts` (boards, starts, the team clock: top-up, carry-over, the views, free seconds, the double
  drain, a bank running out mid-half, sudden death, the cap, the increment; the time controls: each option into every
  match, the increment banking, the cap, sudden death and the increment lifting a squad out, living on the increment,
  bots on Bullet in time, a match stored before them; Relay, Pairs, the safety cap, clinch, the bank tiebreak), `squads-final.test.ts` (the final's vote: majorities, ties, missed picks, nobody picking,
  visibility, copying, the clock, castling and promotion, the drawn-final Armageddon, replay, bots),
  `squads-v2.test.ts` (tokens: burn, the 0-token rule, refunds and their threshold, the breakdown's data; blocks:
  costs, the king, castling, several a turn, the mercy rules together with refunds, visibility, thinking time; bots'
  same moves and blocks), `squads-mercenary.test.ts` (the Mode vote and Classic's no blocks; coins, catch-up, the
  wallet carried on; the shop's caps, prices and putting back; the kit for the next match only; every item; the
  Stockfish token never showing the other squad's moves; fair play leaving assisted moves out; the bots' shopping).
- Sim: `npm run sim:squads -- [lobbies] [nodes] [clocks]` (about 30 minutes at the defaults; `SQUADS_SIM_SET`,
  `SQUADS_SIM_MIXES` and `SQUADS_SIM_OUT` for tuning runs). Its tables are generated; the notes after the marker in
  `reports/squads-sim.md` are written by hand and kept across runs.

## Rules for this area

- No engine in the game's rules, but a token's refund, which takes the judge's numbers as data. Bots may use the bot
  engine; only the sim judges picks.
- Every random draw goes through `squadsRng` with its own name; never share a stream between decisions.
- `squadsLegalMoves` uses chess.js internals for speed; the guard test in `squads-match.test.ts` must keep passing.
- Every number in `SQUADS`, never in the rules.

## The server (phase 2)

Built around the rules: the server never decides anything the rules decide (duties, deadlines, clocks, what a miss
plays, ties). The calls are in `DECISIONS.md`, "Squads, phase 2".

- **Objects.** One Durable Object per lobby (`SquadsLobby`, binding `SQUADS`) and one per party (`SquadsParty`,
  `PARTIES`). The lobby's logic is pure (`squads-lobby.ts`, `SquadsCore`); the object stores it (the record under
  "lobby", each match under "m:<key>", only those that changed), runs its alarms and talks over hibernating
  WebSockets (`squads-do.ts`).
- **The queue.** `POST /api/squads/play` (one player) asks the Squads matchmaker (`squads-default`: the same Matchmaker
  object and queue as Crowd, so batches, admission and "busy, you're in line" work the same). Each ticket is a group,
  `{ size, pass }`. A lobby takes a group only if every party in it still fits the squads whole (`partiesFit`: the
  rules' own `formSquads` packing); otherwise the next lobby. Solo players are parties of one.
- **Parties.** `POST /api/squads/party` makes one (a 5-character code; the invite link is `/squads/party/CODE`). Up to
  4 connect to `/api/squads/party/CODE/ws`. The leader (the first in; the next if they leave or drop) sends `queue`:
  the party asks the matchmaker for seats for everyone connected under a fresh pass (again every
  `partyRetryMs` while busy), then tells everyone `placed { lobby, pass }`. Each joins the lobby with
  `hello { party: pass }` and sits in one squad. The leader can queue again after a lobby. A party closes after
  `partyIdleMinutes` with nobody in it.
- **A lobby's life.** waiting (people join until the fill time, MATCH_FILL_SECONDS as for Crowd, or 32 people) →
  filled (`formSquads`: parties whole, bots in every empty seat; the full grid for FRONT_DOOR.fillShowMs) → vote (Start,
  then Clock, on Crowd's vote machinery; bots vote) → bracket (drawn; round 1's matches after `bracketIntroSeconds`;
  each later match `roundBreakSeconds` after its second feeder ends) → results. It closes as Crowd's lobbies do
  (LOBBY_LIFE): 15 minutes after its results, 60 if it never filled, 180 with nobody connected (a bracket left to its
  bots reaches its results in under an hour).
- **A half in real time.** `halfDuties` gives who acts and their deadlines; everyone gets `turn`. People `choose`,
  `lock` and `block` (refused after their deadline plus DEFAULT_SETTINGS.lateGraceMs); a block placed goes to everyone
  at once (`block`, with the squad's bank), a refused one back (`blockNo`). Bots act at `squadBotThinkMs` (a block, if
  any, just before their move). The half ends when `halfReady`, or when the last deadline of anyone still choosing has
  passed; `resolveHalf` plays it with each player's thinking time to their last choice, `noteActions` logs misses,
  everyone gets the `half` (every event public) and the show (`moveShowSeconds`, `pairRevealSeconds`,
  `finalRevealSeconds`), then the next half.
- **The judge for same-move tokens.** Each token burned goes to the judge as a bot-work job for the position it was
  played in (`requestJudge`, `LiveMatch.judge`): the half's own bot work on that board if it had any, else the
  remembered answer, else two devices (outside the match first, the token's own squad last), compared like any bot
  work. Once the pair's reveal is over (`notBefore`), the rules' verdict lands (`settleTokenUse`) and everyone gets
  `token` (the use, its verdict, both squads' tokens). No device answering: no refund ("no_judge"). A finished match's
  tokens are still judged, for its breakdown.
- **Team clocks** are the rules': `startTeamClocks` when the bracket is drawn, each match's banks from `planMatch`
  (topped up in later rounds), drained in `resolveHalf`, carried on by `settleTeamClocks` when a match ends. Every
  player gets every squad's clock (`teamClocks`, and `matchClocks` for squads playing): in the lobby view and a `clocks`
  message whenever a half begins or ends anywhere. During a half a screen runs a squad's clock down from the match's
  banks, its duties and who has locked in; the exact bank comes with each `half`. Out of time (the rules' `timeouts`) is
  a miss on the record but not a no-show, unless the person is gone (disconnected, no move).
- **Visibility.** Live choices go to each player as `visibleChoices` allows them: their own squad's, in every round.
  Blocks are public: placed ones (`block`, and `placed` in a `match`) and those in effect (`NetSquadsMatch.blocks`),
  with each squad's block bank and tokens, for everyone. Who has locked in goes to everyone (every squad's clock on
  screen needs who is still thinking).
- **Bots.** Every seat a bot plays (a bot, or a person's seat taken over) acts through the rules' `bots.ts` over the
  bot engine's top moves. The top moves come from players' devices (`botWork`, one job per board per half): two devices
  each, outside the match first, computers before phones, the least loaded and fastest, none holding more than
  `maxInFlight` unanswered jobs (the rest wait for a device to answer, the soonest-needed first). Boards in the same
  position (the first turn's starts) share one job, and each says how deep to search (`nodes`). Answers are checked (`cleanTop`) and compared exactly (the browser engine is
  deterministic). Two that disagree go to the engine server (one budgeted restricted search of their moves) or, without
  it, to a third device; the wrong device gets a strike (`strikes`: no more work). One answer stands after `graceMs`;
  none after `answerMs`, or no device at all: the server's own quick look (`fallbackTop`: material two plies deep and
  mate in one, no engine). A bot waits for its answer at most until `fallbackMarginMs` before its deadline, and (Oct 13) until 90% of when its
  squad's bank would run out (`liveCutoff`, `bots.inTime`): near zero a quick look in time beats a random move. Settled
  positions are remembered.
- **Missed actions and takeover.** The rules' `noteActions`: three misses in a row and a bot plays the seat. The person
  can `reclaim` it (from the next half). Leaving while their squad still plays hands the seat to a bot at once.
- **Resigning** (Oct 13; DECISIONS.md, "Resign: leaving a match in every mode"). `leave` once the lobby has filled is
  for good (`leaveForGood`): with the squad still in the bracket, a loss on the record at once at the worst place it
  can still finish (`worstPlacement`: 5, 3 or 2; no reward; never the squad's later place), "left" saying `how` and
  `result`; before the bracket (the votes), nothing recorded; the squad already out, it just goes. Someone who comes
  back with the seat's token gets `error` with `left`. **When nobody is left** (everyone left, or gone longer than
  `LEAVING.awayMs`; someone away otherwise keeps the three-misses rule) the lobby ends at once (`wrapUpIfEmpty`:
  anyone still seated recorded as leaving, `wrapped`, `keepMs` 0) and closes.
- **Armageddon.** A drawn final: the rules' `armageddonChooser`; that squad's people pick a color during
  `armageddonIntroSeconds` (the last pick stands; nobody: the bots' Black), then `startArmageddon`.
- **Spectating and leaving.** Everyone gets every match (the tiny boards). A knocked-out squad's people watch on, or
  `leave` (their socket closes) and queue again.
- **Placements and rewards** (unranked). When the bracket decides a squad's placement, each person on it gets a results
  row (mode "squads", placement 1, 2, 3 or 5 of 8 squads) if signed in, and `SQUADS_LOBBY.rewards` (coins into the
  wallet, crates counted in `wallets.crates` for when crates stop being free) if still playing their seat. Nothing in
  a test lobby or after a test control.
- **Test controls** (Eric). Admins (ADMIN_EMAILS), or anyone where the Worker variable SQUADS_TEST is "1" (local and
  e2e, never production), while `SQUADS_LOBBY.testControls` is on (`squadsTestAllowed`): `nextRound` in a lobby (the
  rules' `endByMaterial` on the earliest round's matches, the next round 3 s later; in the votes: they close), and a
  test lobby, `POST /api/squads/lobby?start=votes|relay|pairs|final&clock=bullet|blitz|rapid` (a time control; the old
  fast, normal and long map to them, an unknown id gives Blitz) or `clock=BANK,TOPUP,FREE,INC[,CAP]` (a team clock in
  seconds; without CAP the old 20 s ceiling, so older links keep their meaning; `testLobbyOptions`), that fills 5 s after it opens, skipping the rounds before (squads with more people go
  through). For tests also `fen=` (the first round's boards start there: a legal position, White to move),
  `bots=strong` (every bot at the strongest skill), `bots=blocks` (bots block whenever they can; `bots=strong,blocks`
  for both) and `seat=white` (the opener plays White on their first board). `mode=mercenary|classic` sets the mode
  (no Mode vote); without it the Mode vote is held and the bots sit it out, so the opener's vote decides. A Mercenary
  test lobby that starts at Pairs or the final gives the squads still in a test wallet (`mercenary.testWallet`) and an
  intro of `SQUADS_LOBBY.testShopSeconds` to shop in. `start=votes` (Eric, Oct 12) fills the moment its opener
  connects (`fillAt` = now): seated, bots in every other seat, the first vote after the full grid's moment, then the
  whole tournament.
- **Mercenary** (the record's `wallets`, one per squad; `botShop` times). Each half's "coins" events go into the
  wallets (`earnFrom`), and everyone gets `wallets` (every squad's: coins, earned, cart, bought, its shop). A squad's
  shop (`shopOf`) is open from its match's end until its next match's first half (the other match feeding it, then
  the round break): `buy`/`unbuy` from any of its people, refused (`shopNo`) when closed, capped or short; each
  purchase goes to the squad's people as `bought` (who, what, the price). As a match of round 2 or the final is set,
  catch-up (`coins`, why "catch_up", to everyone). As its first half starts, each squad's cart comes in as its kit
  (`bringKits`: `takeCart`, `applyKits`; the match again to everyone). A Stockfish token: `assist` from a person with
  a duty (`useStockfish`; refused `assistNo`), then to everyone `assist` with the use (who, where, `shownTo`) and
  both squads' tokens left: the lines are worked out on `shownTo`'s own devices; nothing about them crosses the
  server. A Time chip: `chip` from a person with a duty (`humanChip`: `useChip` against the move's live cutoff,
  `liveCutoff` with the half's `at`; refused `chipNo`), then to everyone `chip` (where, who, when, both squads' chips
  left, the move's new deadline); the half's view carries its `chips`, every deadline and the half's end count them
  (`dutyDeadline`), and the chips a squad didn't use go back to its wallet as the match ends. A brilliant move is asked of the judge like a token (`requestBrilliant`: the half's own bot work on that
  board, else a remembered answer, else devices for a person's move; bots' moves only from work already done); its
  verdict after the show, `coins` (why "brilliant", the move and who found it; `capped` with 0 coins past the squad's
  cap for the match) to everyone. Bots: a squad nobody is
  playing (`botRun`) shops `mercenary.bots.shopSeconds` into its window (`botShop`), now and then uses a token
  (`botUsesStockfish`: then the best move), and plans a Time chip tap as a half starts (`botChipTap`, `botChips`),
  thinking with its time; never a squad with people playing.
- **The protocol** (`packages/chess/src/squads/protocol.ts`, `SQUADS_PROTOCOL` 7, typed; 6: the time controls, a
  clock's `capSeconds` and a match's `capMs`; 7: "left" with `how` and `result`, "error" with `left`): a lobby socket gets
  `welcome`, `lobby` (seats, squads, bracket, rules, every squad's clock and wallet), `vote`/`voteCast`, `match` (a
  match in full, as you may see it: tokens, block banks, blocks in effect and placed, the token log; its mode, each
  side's free seconds, kits, Stockfish tokens and shields left, the tokens used and being used, coins this match),
  `turn`, `clocks`, `choices`, `half`, `choiceNo`, `block`, `blockNo`, `token`, `assist`, `assistNo`, `wallets`,
  `bought`, `shopNo`, `coins`, `placed`, `results`, `botWork`, `left`, `error`, `closed`, and sends `hello`, `vote`,
  `choose`, `lock`, `block`, `assist`, `buy`, `unbuy`, `armageddon`, `speed`, `botTop` (each line with its reply),
  `reclaim`, `leave`, `sync`, `nextRound`. A party socket
  gets `welcome`, `party`, `error`, `closed` and sends `hello`, `queue`, `cancel`, `leave`.
- **Not yet:** the live line doesn't count Squads lobbies or their players (nor does the matchmaker's overload limit);
  no quick chat in Squads lobbies.

| What | Where |
| --- | --- |
| The lobby's logic (seats, parties, fill, votes, bracket, halves, bots, Armageddon, rewards, test controls, views) | `packages/server/src/squads-lobby.ts` |
| Checking and comparing devices' answers; the server's quick look | `packages/server/src/squads-bots.ts` |
| Parties (pure) | `packages/server/src/squads-party.ts` |
| The lobby's and the party's Durable Objects | `packages/server/src/squads-do.ts` |
| The Squads queue (groups seated whole) | `packages/server/src/matchmaker.ts` (`seatSquads`) |
| Routes (`/api/squads/*`) | `packages/server/src/index.ts` (`squadsRoute`) |
| Results and rewards in D1 | `packages/server/src/accounts.ts` (`recordResult`, `grantReward`) |
| The protocol | `packages/chess/src/squads/protocol.ts` |
| A headless player (tests, the full-lobby run) | `e2e/squads-client.ts`, `scripts/squads-headless.ts` |

Settings: `SQUADS_LOBBY` in settings.ts (the bracket's intro, rewards, bot work, the test controls' switch and test
fill, parties); Worker variables `MATCH_FILL_SECONDS` and `SQUADS_TEST`.

Tests: `packages/server/test/resign.test.ts` ("resigning in Squads": mid-bracket, in the votes, the last one out and
everyone away), `packages/server/test/squads-lobby.test.ts` (seats and parties, the fill, votes, the bracket, a full bot lobby
to its results, halves, deadlines, takeover and reclaiming, leaving, team clocks and sudden death, ties, the final's
visibility, Armageddon, the test controls, rewards, bot work on devices), `squads-v2-lobby.test.ts` (tokens through
the server and the judge on devices: refunded, kept, no judge; blocks placed, seen, paid, refused, lifted, in effect;
the final's vote with a block; test lobbies' position, strong bots and White seat; what each side sees),
`squads-clocks-lobby.test.ts` (the time controls: whichever option the Clock vote picks, the lobby plays it; a whole
bot lobby on Bullet in time; a test link's clock by name, old ids and numbers; a lobby stored on the old Normal clock
playing on to its results), `squads-mercenary-lobby.test.ts` (the Mode vote; every wallet to everyone; one shared wallet, purchases live to the
squad, caps, putting back, closed once the match starts; the kit; catch-up; the Stockfish token and a shield through
the server; bots' shopping; a whole Mercenary bot lobby's coins adding up), `squads-queue.test.ts` (the queue,
parties, D1 rewards), `squads-do.test.ts` (the Durable Object: storage per match,
restart, closing); e2e `e2e/squads.spec.ts` (a party through the real server; a test lobby at the final);
`e2e/squads-test-tools.spec.ts` (the start link and Cheat lines, and a player without them); `e2e/squads-v2.spec.ts`
(a token burned and refunded, a block and its arrow until they've moved, Cheat lines while blocking);
`e2e/squads-clocks.spec.ts` (the Clock vote's cards in chess form, whole at 320 px; the winner on the match's card,
in its deadlines, and the clock line whole at 320 px); `e2e/squads-mercenary.spec.ts` (choosing Mercenary in the Mode vote, earning coins, the shop between rounds, a
Stockfish token and a shield). The full-lobby run: `npx tsx scripts/squads-headless.ts
--url http://localhost:8787 --device` against `wrangler dev` (`--var SQUADS_TEST:1` for test lobbies).

## The screens (phase 3)

The calls are in `DECISIONS.md`, "Squads, phase 3: the screens". Phone and computer, light and dark, in the front
door's look; every class is `sq-`.

- **The menu.** Squads takes Classic's spot: Crowd · Squads · Boss raid (Classic still plays with `?mode=classic`).
  With Squads picked, PLAY is the solo queue (`POST /api/squads/play`; busy: the queue's "you're in line" screen) and
  the Matchmaking row becomes **Party** (as does "Play with friends"): create a party (its code and invite link,
  `/squads/party/CODE`, copy or share), or join by code or link; the members (leader, connected); the leader presses
  PLAY for everyone. When the party is placed, everyone joins the lobby with its pass, the party's socket closes, and
  after the lobby "Back to your party" reconnects (the leader queues again).
- **The waiting room** is the home screen's queue (as Crowd's), 32 seats: people as they join (your party's dashed),
  then the eight squads of four once bots fill. **The votes** use Crowd's vote board (`VoteScreen`, given Squads' own
  votes, no eval bar, no chimes or ticks): everyone's pawn on one side, three zones, three cards.
- **Standings everywhere.** Every squad's name (display only, by id: Rooks, Knights, Bishops, Queens, Kings, Pawns,
  Towers, Crowns, each with a color), members, where it stands in the bracket, and its team clock counting down
  (`squads-view.ts`: `liveBank` runs a bank down during a half from the match's banks, its duties and who has locked
  in; ▼▼ when two moves drain it at once; the exact bank comes with each half). Sudden death turns red and pulses. A
  computer: a side panel (from 1100 px). A phone: a strip of eight chips (name and clock), tapped for the whole table
  and the bracket. The standings' foot has "Leave the lobby" (it asks again while your squad still plays: "Resign: a
  loss, and a bot takes your seat"). The match's top line ends in the match's control as in every mode
  (`MatchMenu`: a phone's "⋯" with Sound and Resign, a computer's flag; `squadsExit` says what it offers), and the
  votes' top line too; resigning shows "You resigned" (your record, the bot in your seat), then Queue again or Home.
- **A match** (`screens/SquadsMatch.tsx`): the score and round on top, the strip, every board in the lobby as tiny
  boards (`TinyBoard`, match by match, your squad's ringed, YOU on your board and NEXT on next turn's; tappable only once
  you've moved or locked in: one opens full size with "Back to my board"; a new half that asks something of you brings
  you back), your board full size with « » through its moves (from its own start), and under it both squads' clocks
  with the free seconds counting down between them. The timer bar over the board is your move's deadline (no ticks).
  - **Relay:** your move shows on your board at once and stays (no snap-back); "Moved · waiting for the half to end".
  - **Pairs:** your pick green, your partner's live in blue; lock in. Their move too: "Same move: it plays for sure,
    and uses a token"; with none left the board won't take it ("No same-move tokens left: pick a different move").
    The reveal is Crowd's ghost-move reveal (`ShadeMoves`): both picks slide in with their pickers' names, a reel steps
    between them and lands on the coin's, then the move plays; the same move: one ghost with both names, no coin
    ("Same move: Qxd4 plays · a token used"). A refund a few seconds later: "Token refunded: only move".
  - **The final:** "Vote with your squad"; teammates' picks live as blue arrows with their names where they land
    (`PickTags`), each with Copy in the panel; lock in. The reveal: every pick as a ghost with its voters' names, then
    the most picked lands ("Nf3 plays · 3 of 4 votes"), or a reel between the tied moves lands on the coin's.
  - **Blocks** (`components/SquadsBlocks.tsx`): Block (with the squad's points) in the panel while your squad's move
    there isn't settled; their pieces that can be blocked are ringed with their cost; tap one, then a dot where it
    could go; as many as the points allow, then Done blocking. Every blocked move shows to everyone as an arrow from the
    piece to the square that draws like a move arrow, then keeps redrawing itself slowly and softly with a lock pulsing
    on it (`BlockArrows`, the beat kept from when it was placed), through your turn and theirs until they've moved.
    The line above the board says it for a few seconds ("You blocked Qd8–f6 (−3)", "Knights blocked your Qd8–f6",
    "Block lifted: it would have left no move (refunded)").
  - **Each squad's block points and tokens** under its clock, both squads, always (`SquadResources`).
  - **The token breakdown** after a Pairs match (`TokenBreakdown`; between matches, and on the results): every use,
    refunded or not, why, with numbers ("Qxd4: refunded, every other move lost at least 3.1 pawns").
  - **Staging:** each match opens with a card over the board (its round, its squads, one line of rules, the lobby's
    time control, `matchClockLine`: "Blitz 3+2 · +2 s a move · max 15 s", the count);
    the final's is "SQUAD FINAL" with both squads' members. Knocked-out squads watch the final on the same screen.
    Armageddon: the choosing squad's people pick White or Black on the card (the times from settings).
  - A bot playing your seat (three misses): "Take my seat back" (`reclaim`).
- **Knocked out:** a sheet with your placement and reward: "Spectate the bracket" or "Queue again" ("Back to your
  party" for a party). Through and waiting: a card and the bracket, every tiny board to watch. **Results:** every
  squad's placement and members, yours ringed, your reward, the bracket; Play again or Home.
- **Test controls on screen** (only when the server's `welcome` says `test`): "Next round" beside the title in a
  match, "Skip votes" in the votes. A test lobby: an admin's Party sheet has Start · Relay · Pairs · Final, and the link
  `/squads/test[/start|relay|pairs|final][?clock=bullet|blitz|rapid or BANK,TOPUP,FREE,INC[,CAP]]` opens one (admins on hunchess.com; anyone
  locally with `SQUADS_TEST`); `/squads/test` alone (or `/start`) is the whole tournament from the first vote.
- **Cheat lines** (test controls only, Eric Oct 12): a switch in the panel wherever you choose (`cheatLinesAt`: your
  Relay move, a Pairs or final pick, a block, Armageddon's colors). On, it draws the engine's top 3 in the position
  (`SQUADS_LOBBY.cheatLines`: moves, nodes) as arrows colored by rank (green, blue, yellow, as the power-up hints),
  each labeled with its evaluation for the side to move (`cheatEval`: pawns turned back from the expected score, or
  a mate), and lists them as "1 · Nf3 +0.8". While blocking, the lines are the other squad's moves after yours (your
  pick, or a teammate's; with none yet, the move handed over: `blockCheatFen`), the ones worth blocking. It stays on (`SquadsClient.cheatLines`, this device only) until switched off, searching
  each new position on an engine of its own (`ownEngine()`, never queued behind bot work). Nothing is sent; scoring,
  bots and the server never see it. A page whose `welcome` says no `test` never shows it, and the switch can't turn on.
- **The Mode vote** is Crowd's vote board with three cards: Classic, Mercenary, and "Coming soon" (dashed and hatched,
  its card disabled; a pawn dropped on it walks back).
- **Mercenary on screen** (`components/MercenaryShop.tsx`; classes `mc-`):
  - **The shop** (`MercenaryShop`): a sheet at the foot of the screen while your squad's shop is open (nothing behind it
    dimmed), until your next match starts: the one line "Spend your coins on items for the next round or save them for
    later.", your squad's coins and the other squad's (with its cart), any catch-up, every item (its icon, what it does,
    the price now, how many of the round's cap are in the cart, − and Buy), and the last few purchases by name. "Hide"
    folds it into a pill ("Shop" and the coins) that opens it again. The first time an account sees it (on this device:
    `brc.mercenary.seen.<user id>`), a short explainer with "Got it".
  - **In a match:** a line in the panel with both squads' coins and what's left of their kits (Stockfish tokens,
    shields, Time chips); under the clocks each squad's block points (none in Classic), tokens and Time chips. On your
    move, a "+30s" chip button by your squad's clock; tapped (yours or a teammate's), that squad's clock jumps by the
    chip's time and counts it down while the bank stands still, and "+30 s" floats up from it for both squads (the
    timer bar takes the move's later deadline). On your decision: "Stockfish token · N left"; used, your top moves as arrows colored by rank
    with their evaluations and listed under it ("Your Stockfish lines"; in the final, a teammate's token shows the
    squad's). Blocking against a squad with a shield: the line under Block says so. The line above the board: a block
    a shield canceled (both squads) and a brilliant move ("Brilliant! Nf5 by Pam: +25 coins for Rooks"; past the cap,
    "Brilliant! Nf5 by Pam: no coins (cap of 2 a match reached)").
  - **The standings** show every squad's coins (the side panel; the phone's sheet).
- **Bot work on this device:** after `welcome` the page runs its engine speed check once (`engineSpeed()`, shared with
  Crowd's judges) and sends `speed`; each `botWork` job is searched on the engine pool (`topMovesAt(fen, n, nodes)`,
  every engine at once) and answered with `botTop`. A knocked-out player's page keeps answering while it's open.
- **Sounds:** the normal knocks for moves (the big board's own); `sqTick` in the last two seconds of your free time
  while you still have a choice to make (not blockers); `sqSting` when a squad on the big board enters sudden death
  (the moment its clock hits zero on screen, or the half's `sudden_death`), and again only once its bank has been back
  up to the low line (`LOW_BANK_MS`, 30 s): a squad living on its increment near zero runs out and is lifted again
  half after half, and hears it once. Both quieter than a move
  (`measureSound`, checked in e2e), both through mute, no chimes anywhere in Squads.
- **Rejoining:** the seat's token is kept per lobby (`brc.squads.CODE`); a reload or the app reopened at `/` goes back
  in while the lobby is on (`/squads/CODE` is its address).

| What | Where |
| --- | --- |
| The client: the lobby's and the party's sockets, local times, optimistic choices, bot work, sounds | `packages/app/src/squads.ts` |
| What the screens work out (clocks run down, YOU/NEXT, standings, names) | `packages/app/src/squads-view.ts` |
| The waiting room, votes, bracket phase, knocked out, results | `packages/app/src/screens/Squads.tsx` |
| A match: Relay, Pairs, the final's vote, reveals, staging, blocking | `packages/app/src/screens/SquadsMatch.tsx` |
| Blocked moves' arrows, the block picker, pick tags, block points and tokens, the token breakdown | `packages/app/src/components/SquadsBlocks.tsx` |
| The party sheet | `packages/app/src/screens/SquadsParty.tsx` |
| Standings, clocks, tiny boards, the bracket | `packages/app/src/components/SquadsParts.tsx` |
| The menu slot | `packages/app/src/screens/Home.tsx` (`MODES`, `chosenHomeMode`); routes in `App.tsx` |

Tests: `packages/app/test/squads-view.test.ts`; e2e `e2e/squads-play.spec.ts` (through the real server with its bots, on
a phone and a computer: Pairs, the final, a Relay half with the board's coordinates in their squares both ways up, Next
round, the party, the sounds). Frames:
`npm run frames:squads -- <dir> relay|pairs|final|block|token|menu|standings|clockvote|clockline http://localhost:8787` against `wrangler
dev --var SQUADS_TEST:1` (every painted frame, the big board's pieces and blocked moves' arrows logged per frame, a
GIF). Never beside an e2e run from the
same checkout without `--persist-to` a folder of its own: two local servers on one `.wrangler/state` lock each other's
storage (SQLITE_BUSY), and the e2e's lobbies fail.

## The design (Eric, Oct 10, 2026)

The brief, as given (calls marked "director's call"). Phase 1's own calls are in `DECISIONS.md`, "Squads".

**Changed since (Eric, Oct 13, time controls):** the Clock vote's Fast, Normal and Long became three chess time
controls, Bullet, Blitz and Rapid, each a team bank with an increment that banks and its own cap on a move
(DECISIONS.md, "Squads: three chess time controls").

**Changed since (Eric, Oct 12, Squads v2):** same-move tokens in Pairs, move blocks in every round, and the final a
majority vote of the whole squad, replacing Pick and Block below (DECISIONS.md, "Squads v2").

**Changed since (Eric, Oct 10, after phase 1's sim):** chess clocks replace the per-move pace and the move cap; one
Clock vote (Fast, Normal, Long) replaces the Pace and Length votes; every game is played to the end; ties in rounds 1
and 2 go to the squad with more clock time left (no Armageddon); a drawn final goes to Armageddon with White on more
time. A lobby should take about 20-40 minutes. Then option B: quick early rounds and a roomier final, each Clock
option setting both. "How it works today" above is current; the brief below is as first
given.


A new full mode in the Classic slot of the mode menu: Crowd · Squads · Boss raid. Squads of 4 play team chess.
No engine in the game: no move scoring, no God King, no power-ups. Playing to win.

### Lobby
- 8 squads of 4 (32 players). Parties of up to 4 by invite link or code, or solo queue into a squad. Bots fill any
  empty seat, teammates included.
- Bracket: round 1 = 4 squad matches on 16 boards; round 2 = 2 matches on 4 boards; final = 1 board.
- Knocked-out squads spectate the bracket or queue again. Rewards by placement (1st, 2nd, 3rd-4th, 5th-8th) with the
  existing coins and crates. Unranked to start.

### Pre-game votes
1. Start: the normal starting position / every board from the same opening / each board its own random opening.
   With random openings, each opening is played on two of a match's boards with colors swapped (director's call).
2. Pace: about 10, 15 or 25 seconds per move.
3. Length, for rounds 1 and 2 (Eric): play to the end / a move cap (director's call: 40 moves). At the cap, a board
   still going is decided by material count (no engine); level material is a draw. The final is always played to the
   end. A silent safety cap at move 120 (material) guards against endless games in "to the end" (director's call).

### Round 1, Relay (4 boards per match, one player per move)
- Your squad is White on 2 boards and Black on 2. Every turn you make one move, each turn on the next board along
  (board 1, 2, 3, 4, 1...); each board gets exactly one of you per turn.
- A turn has two halves: every board's White move, then every board's Black move (so in each half two of your squad
  move and two wait). A half ends when everyone has moved or the timer runs out; after both halves everyone shifts one
  board.
- If a board has finished, whoever's turn it would be on it sits that turn out (they scout).
- Screen: tiny boards across the top for every board in the lobby (the old TinyBoard/MiniBoard), your squad's 4
  highlighted, YOU and NEXT marked; your board full size; « » keep stepping through that board's moves. The tiny
  boards become tappable only after you have moved: tap to watch one full size, "Back to my board".
- Missed move: a random legal move is played (Eric: not playing must always hurt), logged on the player's record;
  repeat no-shows are replaced by a bot.
- Board win 1, draw ½. A squad that passes half the points (2.5 of 4) has clinched: the match ends at once.

### Round 2, Pairs (2 boards per match, two players per move)
- The pair rule: both pick, each sees the other's pick, you can't pick the same move, a coin flip picks which plays
  (the existing reveal animation).
- Partners change every turn (1+2 & 3+4, then 1+3 & 2+4, then 1+4 & 2+3) and your board alternates.
- Missed pick: that slot becomes a random legal move, so the coin may play junk.
- Clinch at 1.5 of 2.

### Final, Pick and Block (4 v 4 on one board, always to the end)
- On a squad's move: 2 of its players are Pickers (two different moves); at the same time 2 of the other squad are
  Blockers (two different moves of the side to move, so every block is legal). A coin flip makes one of the two
  blocks active. If the active block hits a pick, the other pick plays; otherwise a coin flip between the picks.
  Two different picks and one active block: a squad always has a move.
- Visibility (Eric, Oct 10; a setting so it can be reverted): Blockers' choices show live to everyone, both squads,
  as red arrows; Picks show live only to the picking squad. Everything can change until the timer ends (or all four
  lock in); the state at that moment is resolved.
- Roles rotate every full turn: each player alternates picking (on their squad's move) and blocking (on the other
  squad's), and partners cycle 1+2, 1+3, 1+4.
- Blocks from move 1 (Eric). Mercy rules (settings): no blocks when the side to move has 3 or fewer legal moves; a
  block is canceled if every other legal move allows mate in one. More rules only if playtests show anti-fun.
- Missed actions: a Picker who doesn't pick gets a random legal move in their slot; a Blocker who doesn't block
  forfeits theirs (if the coin lands on the empty slot, nothing is blocked). Both logged.
- Staging: everyone in the lobby watches; the reveal shows both picks as ghost arrows, the active block slamming
  down as a red lock, then the coin.

### Ties
- Round 1 at 2-2, round 2 at 1-1, or a drawn final: one Armageddon board (White must win, a draw counts for Black),
  played in that round's format, at the fast pace. The squad with less total thinking time picks color.

### Testing (Eric)
- An admin/test-only "Next round" button that ends the current round (boards decided by material) and moves on, and
  a test switch to start straight at round 2 or the final.

### Build order
1. Rules and a bot simulation (pure, no screens): rotation, halves, pairs, pick and block, mercy rules, clinches,
   caps, Armageddon, missed actions, votes; a sim report on game lengths per pace and length vote, how often blocks
   hit, how often the coin plays the weaker pick, mercy-rule triggers, total match time.
2. Server: squads lobby, parties, matchmaking, bots, the bracket, spectating, the test controls.
3. Screens: menu slot, votes, tiny boards and scouting, the pair and pick-and-block panels, the final's staging.
4. e2e and polish.
