# Squads

Lane: the director (a new mode; the match screens are the director's). Status: **the rules and a bot simulation are
built** (pure code): phase 1, then chess clocks in place of the pace and the move cap (Eric, Oct 10). No server,
screens or menu slot yet: nothing a player sees has changed.

## How it works today

- **Pure rules in `packages/chess/src/squads/`**, imported as `@chessroyale/chess/squads`. They live in the chess
  package because they need chess.js (legal moves, mate in one) and the opening library; `core` stays chess-free.
  **No engine in the rules**: every game is played to the end on a chess clock; only the silent safety cap and the
  test-only "Next round" fall back on material. "Better pick" exists only in the sim.
- **Lobby** (`lobby.ts`): `formSquads` packs parties (1-4) into 8 squads of 4, largest first, each into the squad with
  the fewest free seats it fits (people end up with people); parties that don't fit wait; bots fill every empty seat;
  seats are shuffled. `drawBracket` (seeded, unranked), `reportWinner`, `placements` (1, 2, 3 = 3rd-4th, 5 = 5th-8th).
  `noteActions` logs every miss; `noShowsBeforeBot` (3) in a row hands the seat to a bot (`replacedByBot`).
- **Seeded randomness**: `squadsRng(seed, ...names)` gives each decision its own stream (match, turn, half, board,
  what's drawn), so the server can replay any decision from the lobby's seed, and adding a draw never moves others.
- **Votes** (`votes.ts`): Start and Clock as `PregameVote`s, run by Crowd's machinery (`castPregameVote`,
  `botVotes`, `closePregameVote`); `rulesFromVotes` gives `SquadsRules`. Nobody voting: normal start, the Normal clock.
- **Clocks**: every board gives each side a bank and an increment (the Clock vote's option). In Relay a squad's four
  players share their side's clock on each board; in Pairs and the final the side's clock runs while its pickers
  think (the slower picker's time). Blockers aren't on a clock. A side whose bank runs out loses that board, unless
  the other side can't mate (a lone king, or king and one minor piece: `canMate`), which draws it.
- **The per-move ceiling** (`moveCeilingSeconds`): nobody can hold a half up longer. A mover or picker who hasn't
  chosen by then misses (a random legal move), their side's bank charged the whole ceiling and no increment earned;
  a blocker forfeits. If the bank is shorter than the ceiling, running out of it is a flag fall instead.
- **A match** (`match.ts`) is played in turns of two halves (White's moves, then Black's). The server's loop:
  `halfDuties` (who acts, with each duty's deadline: the ceiling, or the side's bank if shorter; who scouts; forced
  moves; the mercy rule), `choose` / `lockIn` / `halfReady` while the clocks run, `visibleChoices` for what each viewer
  may see, then `resolveHalf` with each player's thinking time: it charges the clocks, plays the half (or a flag
  falls), and returns the events, who acted and who missed. Then the safety cap, the result, the next half.
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
    clock time left across its boards (`timeLeft`), a seeded coin if exactly level; no Armageddon. **A drawn final**:
    one Armageddon board in Pick and Block (`armageddonChooser`: the squad with more time left in the final picks its
    colour; `startArmageddon`: White 1:30, Black 1:00, +1 s, a draw is Black's). `endByMaterial` is the test-only
    "Next round" (a level result goes to time left, then a coin).
- **What the sim says** (`reports/squads-sim.md`):
  - Median lobbies take 24 minutes (Fast 1+2), 31 (Normal 1:45+2) and 36 (Long 2+3); every 90th percentile is under
    40.
  - The price of short clocks is flags: they decide 23-64% of Pairs boards and 37-75% of finals (Fast the most).
    Eric's 4+2 would take about 43 minutes with few flags.
  - Ties in rounds 1 and 2 (about a third of matches) are settled by time left; Armageddon is rare.
- **Bots** (`bots.ts`): the existing bot engine (Stockfish's top moves, then `botPick` at a skill) for Relay moves,
  pair picks (never the partner's), final picks (avoiding a visible block with `avoidBlockChance`) and blocks (aimed
  at the best moves, never the partner's). Winning, a bot plays with purpose (`squadBotSkill` caps its temperature;
  `candidatesFrom` breaks ties by the engine's order and plays a mate it sees). `squadBotThinkMs` paces a bot by its
  clock. Bots take Black when they choose Armageddon's colours.

## Where the code is

| What | Where |
| --- | --- |
| Boards and their clocks, end detection, flag falls, mating material, material, mate in one, fast legal moves | `packages/chess/src/squads/board.ts` |
| Squads, parties, the bracket, records, seeded randomness | `packages/chess/src/squads/lobby.ts` |
| Who plays where (Relay rotation, the pair schedule) | `packages/chess/src/squads/schedule.ts` |
| The votes | `packages/chess/src/squads/votes.ts` |
| Matches: setup, duties, clocks, choices, visibility, resolution, flags, clinch, ties, Armageddon | `packages/chess/src/squads/match.ts` |
| Squad bots | `packages/chess/src/squads/bots.ts` |
| The bot simulation | `packages/sim/scripts/squads-sim.ts` → `reports/squads-sim.md` |

## Settings

`SQUADS` in `packages/core/src/settings.ts`: sizes and boards, the votes (`clocks`, `clockDefault`, vote timing),
`moveCeilingSeconds`, `incrementOnMiss`, `safetyCap`, `material`, `materialLead`, points, openings, `final` (the mercy
rules and visibility: `blocksSeenBy`, `picksSeenBy`), `armageddon` (the drawn final's clocks), `noShowsBeforeBot`,
`replacementBotSkill`, `bots` (choosing, winning with purpose, pacing), and the show times.

## Tests and tools

- Unit: `packages/chess/test/squads-lobby.test.ts` (squads, records, bracket, votes, schedules),
  `squads-match.test.ts` (boards, clocks, flags, the ceiling, starts, Relay, Pairs, the safety cap, clinch, the
  time-left tiebreak), `squads-final.test.ts` (Pick and Block, the final's clock, the mercy rules, visibility,
  castling and promotion, missed actions, the drawn-final Armageddon, replay, bots).
- Sim: `npm run sim:squads -- [lobbies] [nodes] [clocks]` (about 10 minutes at the defaults; `SQUADS_SIM_SET`,
  `SQUADS_SIM_MIXES` and `SQUADS_SIM_OUT` for tuning runs). Its tables are generated; the notes after the marker in
  `reports/squads-sim.md` are written by hand and kept across runs.

## Rules for this area

- No engine in the game's rules. Bots may use the bot engine; only the sim may judge picks.
- Every random draw goes through `squadsRng` with its own name; never share a stream between decisions.
- `squadsLegalMoves` uses chess.js internals for speed; the guard test in `squads-match.test.ts` must keep passing.
- Every number in `SQUADS`, never in the rules.

## The design (Eric, Oct 10, 2026)

The brief, as given (calls marked "director's call"). Phase 1's own calls are in `DECISIONS.md`, "Squads".

**Changed since (Eric, Oct 10, after phase 1's sim):** chess clocks replace the per-move pace and the move cap; one
Clock vote (Fast, Normal, Long) replaces the Pace and Length votes; every game is played to the end; ties in rounds 1
and 2 go to the squad with more clock time left (no Armageddon); a drawn final goes to Armageddon with White on more
time. A lobby should take about 20-40 minutes. "How it works today" above is current; the brief below is as first
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
