# Squads

Lane: the director (a new mode; the match screens are the director's). Status: **the rules and a bot simulation are
built** (pure code): phase 1, then clocks in place of the pace and the move cap, now one team clock per squad for the
whole tournament (Eric, Oct 10). **The server is built** (phase 2: the lobby, parties, the queue, bots, the bracket,
the test controls, the protocol; see "The server" below). No screens or menu slot yet: nothing a player sees has
changed.

## How it works today

- **Pure rules in `packages/chess/src/squads/`**, imported as `@chessroyale/chess/squads`. They live in the chess
  package because they need chess.js (legal moves, mate in one) and the opening library; `core` stays chess-free.
  **No engine in the rules**: every game is played to the end, and nobody loses on time; only the silent safety cap
  and the test-only "Next round" fall back on material. "Better pick" exists only in the sim.
- **Lobby** (`lobby.ts`): `formSquads` packs parties (1-4) into 8 squads of 4, largest first, each into the squad with
  the fewest free seats it fits (people end up with people); parties that don't fit wait; bots fill every empty seat;
  seats are shuffled. `drawBracket` (seeded, unranked), `reportWinner`, `placements` (1, 2, 3 = 3rd-4th, 5 = 5th-8th).
  `noteActions` logs every miss; `noShowsBeforeBot` (3) in a row hands the seat to a bot (`replacedByBot`).
- **Seeded randomness**: `squadsRng(seed, ...names)` gives each decision its own stream (match, turn, half, board,
  what's drawn), so the server can replay any decision from the lobby's seed, and adding a draw never moves others.
- **Votes** (`votes.ts`): Start and Clock as `PregameVote`s, run by Crowd's machinery (`castPregameVote`,
  `botVotes`, `closePregameVote`); `rulesFromVotes` gives `SquadsRules`. Nobody voting: normal start, the Normal clock.
- **The team clock** (Eric, Oct 10): one bank per squad for the whole tournament (`Squad.bankMs`), carried from
  match to match (`startTeamClocks`, then `planMatch` brings it in, `settleTeamClocks` takes it out), with a top-up
  when a squad starts a new round. The Clock option sets the starting bank, the top-up, the free seconds a move (a
  delay) and any increment.
  - **Draining.** Each of a squad's moves being thought about drains its bank past the free seconds: a Relay mover,
    a pair (the slower picker), the final's pickers. Blockers drain nothing. Two of a squad's moves being thought
    about at once (Relay's two movers each half) drain it twice as fast (`bankRunsOut`).
  - **The per-move ceiling** (`moveCeilingSeconds`) bounds every move while the bank lasts. A mover or picker who
    hasn't chosen by then misses (a random legal move), the bank draining meanwhile; a blocker forfeits.
  - **Sudden death.** If the bank runs out during a half, the squad's moves still being thought about are cut off
    (random moves). At zero, each move must be made within the free seconds, or it's missed. There are no flag
    falls; an increment, if set, can lift a squad back out.
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
    3, so every player alternates colours turn by turn and each half two of a squad move. A finished board: whoever's
    turn it would be there scouts.
  - **Pairs** (round 2, 2 boards) and **the final** share `pairSchedule`: partners 1+2, 1+3, 1+4 (and the other two),
    player 1's pair alternating slots. Pairs: slot 0 plays board 1, slot 1 board 2. Final: slot 0 picks on its
    squad's move, slot 1 blocks on the other's. Two picks always differ; a missed pick is a random legal move other
    than the partner's; a coin plays one.
  - **Pick and Block**: two different blocks (a missed one is forfeited); a coin makes one active (an empty slot
    blocks nothing); a block is cancelled if every other legal move allows mate in one; the active block hitting a
    pick plays the other pick, otherwise a coin. No blocks at 3 or fewer legal moves. One legal move plays itself.
  - **The safety cap** (120 moves per side) is the only cap: material decides a board still going then.
  - **Clinch**: more than half the points ends the match at once. **Ties** in rounds 1 and 2: the squad with more
    team bank left at the end of the match, a seeded coin if exactly level; no Armageddon. **A drawn final**: one
    Armageddon board in Pick and Block on its own fixed clocks (`startArmageddon`: White 1:30, Black 1:00, +1 s, by
    team-clock rules with the lobby's free seconds; a draw is Black's). The squad with more team bank left picks its
    colour (`armageddonChooser`). `endByMaterial` is the test-only "Next round" (a level result goes to bank, then a
    coin).
- **What the sim says** (`reports/squads-sim.md`):
  - Median lobbies take 31-33 minutes on every option (Fast 3 min, Normal 4, Long 5; 3 free seconds); every 90th
    percentile is under 40.
  - 38-65% of squads reach sudden death, mostly in Pairs, and 5-12% of moves are made in it.
  - Faster round 1 winners carry more bank forward (19-39 s against 10-16 s).
  - Ties go to the bank, a quarter of them to the coin.
- **Bots** (`bots.ts`): the existing bot engine (Stockfish's top moves, then `botPick` at a skill) for Relay moves,
  pair picks (never the partner's), final picks (avoiding a visible block with `avoidBlockChance`) and blocks (aimed
  at the best moves, never the partner's). Winning, a bot plays with purpose (`squadBotSkill` caps its temperature;
  `candidatesFrom` breaks ties by the engine's order and plays a mate it sees). `squadBotThinkMs` paces a bot by its
  clock. Bots take Black when they choose Armageddon's colours.

## Where the code is

| What | Where |
| --- | --- |
| Boards, end detection, material, mate in one, fast legal moves | `packages/chess/src/squads/board.ts` |
| Squads, parties, the bracket, records, seeded randomness | `packages/chess/src/squads/lobby.ts` |
| Who plays where (Relay rotation, the pair schedule) | `packages/chess/src/squads/schedule.ts` |
| The votes | `packages/chess/src/squads/votes.ts` |
| Matches: setup, team clocks (bring in, drain, sudden death, carry out, views), duties, choices, visibility, resolution, clinch, ties, Armageddon | `packages/chess/src/squads/match.ts` |
| Squad bots | `packages/chess/src/squads/bots.ts` |
| The bot simulation | `packages/sim/scripts/squads-sim.ts` → `reports/squads-sim.md` |

## Settings

`SQUADS` in `packages/core/src/settings.ts`: sizes and boards, the votes (`clocks`: each option's starting bank,
top-up, free seconds and increment; `clockDefault`; vote timing), `moveCeilingSeconds`, `incrementOnMiss`,
`safetyCap`, `material`, `materialLead`, points, openings, `final` (the mercy rules and visibility: `blocksSeenBy`,
`picksSeenBy`), `armageddon` (the drawn final's fixed clocks), `noShowsBeforeBot`, `replacementBotSkill`, `bots`
(choosing, winning with purpose, pacing), and the show times.

## Tests and tools

- Unit: `packages/chess/test/squads-lobby.test.ts` (squads, records, bracket, votes, schedules),
  `squads-match.test.ts` (boards, starts, the team clock: top-up, carry-over, the views, free seconds, the double
  drain, a bank running out mid-half, sudden death, the ceiling, the increment; Relay, Pairs, the safety cap, clinch,
  the bank tiebreak), `squads-final.test.ts` (Pick and Block, the final's clock, the mercy rules, visibility,
  castling and promotion, missed actions, the drawn-final Armageddon, replay, bots).
- Sim: `npm run sim:squads -- [lobbies] [nodes] [clocks]` (about 30 minutes at the defaults; `SQUADS_SIM_SET`,
  `SQUADS_SIM_MIXES` and `SQUADS_SIM_OUT` for tuning runs). Its tables are generated; the notes after the marker in
  `reports/squads-sim.md` are written by hand and kept across runs.

## Rules for this area

- No engine in the game's rules. Bots may use the bot engine; only the sim may judge picks.
- Every random draw goes through `squadsRng` with its own name; never share a stream between decisions.
- `squadsLegalMoves` uses chess.js internals for speed; the guard test in `squads-match.test.ts` must keep passing.
- Every number in `SQUADS`, never in the rules.

## The server (phase 2)

Built around the rules: the server never decides anything the rules decide (duties, deadlines, clocks, what a miss
plays, ties). Nothing links to it until phase 3's screens. The calls are in `DECISIONS.md`, "Squads, phase 2".

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
- **A half in real time.** `halfDuties` gives who acts and their deadlines; everyone gets `turn`. People `choose` and
  `lock` (refused after their deadline plus DEFAULT_SETTINGS.lateGraceMs); bots act at `squadBotThinkMs`. The half
  ends when `halfReady`, or when the last deadline of anyone still choosing has passed; `resolveHalf` plays it with each
  player's thinking time to their last choice, `noteActions` logs misses, everyone gets the `half` (every event public)
  and the show (`moveShowSeconds`, `pairRevealSeconds`, `finalRevealSeconds`), then the next half.
- **Visibility.** Live choices go to each player as `visibleChoices` allows them (Relay and Pairs: their own squad's;
  the final: blocks to everyone, picks to the picking squad). Who has locked in goes to everyone (every squad's clock
  on screen needs who is still thinking).
- **Bots.** Every seat a bot plays (a bot, or a person's seat taken over) acts through the rules' `bots.ts` over the
  bot engine's top moves. The top moves come from players' devices (`botWork`, one job per board per half): two devices
  each, outside the match first, computers before phones, the least loaded and fastest, none holding more than
  `maxInFlight` unanswered jobs. Answers are checked (`cleanTop`) and compared exactly (the browser engine is
  deterministic). Two that disagree go to the engine server (one budgeted restricted search of their moves) or, without
  it, to a third device; the wrong device gets a strike (`strikes`: no more work). One answer stands after `graceMs`;
  none after `answerMs`, or no device at all: the server's own quick look (`fallbackTop`: material two plies deep and
  mate in one, no engine). A bot waits for its answer at most until `fallbackMarginMs` before its deadline. Settled
  positions are remembered.
- **Missed actions and takeover.** The rules' `noteActions`: three misses in a row and a bot plays the seat. The person
  can `reclaim` it (from the next half). Leaving while their squad still plays hands the seat to a bot at once.
- **Armageddon.** A drawn final: the rules' `armageddonChooser`; that squad's people pick a colour during
  `armageddonIntroSeconds` (the last pick stands; nobody: the bots' Black), then `startArmageddon`.
- **Spectating and leaving.** Everyone gets every match (the tiny boards). A knocked-out squad's people watch on, or
  `leave` (their socket closes) and queue again.
- **Placements and rewards** (unranked). When the bracket decides a squad's placement, each person on it gets a results
  row (mode "squads", placement 1, 2, 3 or 5 of 8 squads) if signed in, and `SQUADS_LOBBY.rewards` (coins into the
  wallet, crates counted in `wallets.crates` for when crates stop being free) if still playing their seat. Nothing in
  a test lobby or after a test control.
- **Test controls** (Eric). Admins (ADMIN_EMAILS), or anyone where the Worker variable SQUADS_TEST is "1" (local and
  e2e, never production), while `SQUADS_LOBBY.testControls` is on: `nextRound` in a lobby (the rules' `endByMaterial` on
  the earliest round's matches, the next round 3 s later; in the votes: they close), and `POST /api/squads/lobby?
  start=pairs|final&clock=...` for a test lobby that fills 5 s after it opens, skipping the rounds before (squads with
  more people go through).
- **The protocol** (`packages/chess/src/squads/protocol.ts`, `SQUADS_PROTOCOL` 1, typed): a lobby socket gets
  `welcome`, `lobby` (seats, squads, bracket, rules), `vote`/`voteCast`, `match` (a match in full, as you may see it),
  `turn`, `choices`, `half`, `choiceNo`, `placed`, `results`, `botWork`, `left`, `error`, `closed`, and sends `hello`,
  `vote`, `choose`, `lock`, `armageddon`, `speed`, `botTop`, `reclaim`, `leave`, `sync`, `nextRound`. A party socket
  gets `welcome`, `party`, `error`, `closed` and sends `hello`, `queue`, `cancel`, `leave`.
- **Not yet:** the live line doesn't count Squads lobbies or their players (nor does the matchmaker's overload limit);
  no quick chat in Squads lobbies; the app's side of bot work (answering `botWork` from its engine pool) comes with
  the screens.

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

Tests: `packages/server/test/squads-lobby.test.ts` (seats and parties, the fill, votes, the bracket, a full bot lobby
to its results, halves, deadlines, takeover and reclaiming, leaving, flags and ties, the final's visibility,
Armageddon, the test controls, rewards, bot work on devices), `squads-queue.test.ts` (the queue, parties, D1 rewards),
`squads-do.test.ts` (the Durable Object: storage per match, restart, closing); e2e `e2e/squads.spec.ts` (a party
through the real server; a test lobby at the final). The full-lobby run: `npx tsx scripts/squads-headless.ts --url
http://localhost:8787 --device` against `wrangler dev` (`--var SQUADS_TEST:1` for test lobbies).

## The design (Eric, Oct 10, 2026)

The brief, as given (calls marked "director's call"). Phase 1's own calls are in `DECISIONS.md`, "Squads".

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
   With random openings, each opening is played on two of a match's boards with colours swapped (director's call).
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
  block is cancelled if every other legal move allows mate in one. More rules only if playtests show anti-fun.
- Missed actions: a Picker who doesn't pick gets a random legal move in their slot; a Blocker who doesn't block
  forfeits theirs (if the coin lands on the empty slot, nothing is blocked). Both logged.
- Staging: everyone in the lobby watches; the reveal shows both picks as ghost arrows, the active block slamming
  down as a red lock, then the coin.

### Ties
- Round 1 at 2-2, round 2 at 1-1, or a drawn final: one Armageddon board (White must win, a draw counts for Black),
  played in that round's format, at the fast pace. The squad with less total thinking time picks colour.

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
