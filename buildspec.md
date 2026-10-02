Battle Royale Chess: v1 build spec
Oct 2, 2026 · @eric james
What this is
Battle Royale Chess (working title) is a 32-player chess game where you win by playing better moves than the field, not by winning a game. Nobody owns a board. Each round, you are handed a position you have not seen and get 10 seconds to move. A chess engine scores every move, and the weakest scorers are knocked out in stages until two players remain and play a real game for the win.
This spec is the brief for the first playable version. Build it in the order given under Build order, and stop for Eric's review after each milestone. Every number here is a starting value to tune, so keep them all in one settings file.
The first goal is to learn whether the format is fair and fun, using bots, before any real multiplayer is built.
Match structure
A match is six stages. The first five knock players out on move quality, and the sixth is a duel.
Stage
Players
Boards
Rounds
Knocked out
1
32
8
8
8
2
24
6
8
8
3
16
4
8
8
4
8
2
8
4
Final four
4
1
8
2
Duel
2
1
One blitz game
1
• Every position is dealt to 4 players at once, so the number of boards is always the number of players divided by 4.
• A stage's score is the sum of a player's round scores in that stage. The lowest scorers are knocked out.
• Scores reset at the start of each stage. Build carry-over as a setting too, so the playtest report can compare the two.
• Ties on stage score go to the player with less total thinking time in that stage, then to a coin flip.
• A round lasts about 15 seconds: up to 10 to move and about 4 for the reveal. A full match is about 12 minutes plus the duel.
• Knocked-out players can stay and watch, or leave.
One round
Every player moves at the same time on a shared clock, so nobody ever waits on anyone.
1. Deal. Each board holds one position with one side to move. Players are split into groups of 4, one group per board. Each player sees only their own board.
2. Pick. Each player has 10 seconds to make one legal move. A pick is final once made and is hidden from the rest of the group. The round ends early if every player has picked.
3. Score. The engine scores every picked move. A player's round score is how much better or worse their move was than their group's average (see Scoring).
4. Draw. One of the group's picks is drawn at random and played on the board. Each pick is one ticket, so a move chosen by two players has twice the chance. If nobody picked, the engine's best move is played.
5. Reveal. Each player sees their score, the group's picks and which move was played.
6. Rotate. Players are regrouped at random. While there are 4 or more boards, no player gets the same board twice in a row. Repeat groupmates are avoided where possible.
Other rules
• Every board has the same side to move in a given round, so each player alternates White and Black from round to round.
• The server holds the clock. A pick that arrives more than 300 ms after the deadline counts as a miss.
• Engine scores for a round are never sent to any player until every pick in that round is locked.
• Promotion defaults to a queen, with a picker for the other pieces.
Scoring
A move is scored by the winning chances it gives away, compared with the other three players who faced the same position.
Expected score. For any position, the engine gives the side to move an expected score from 0 to 1: the chance of a win plus half the chance of a draw. Take this from the engine's own win/draw/loss output.
Loss of a move. Loss is the expected score after the engine's best move minus the expected score after the picked move, both from the mover's side. It is measured in points, where 1 point is 0.01 of expected score. Loss is never negative: if a picked move evaluates above the engine's own choice, treat the picked move as the best.
Round score. Round score is the group's average loss minus the player's own loss. A positive score means the player beat their group.
Missed move. A player who does not pick scores -25 for the round. They are left out of the group's average and out of the draw.
Worked example (use as unit tests). The best move leaves the mover an expected score of 0.62.
Player
Expected score after their move
Loss
Round score
A
0.62
0
+10
B
0.58
4
+6
C
0.58 (same move as B)
4
+6
D
0.30
32
-22
The group's average loss is 10. In the draw, the move B and C share has a 50% chance, and A's and D's moves have 25% each.
If D misses instead, the average loss over A, B and C is 2.67. A scores +2.67, B and C score -1.33 each, and D scores -25. The shared move then has a 2 in 3 chance of being played.
Checks
• Round scores in a group with no misses always sum to zero.
• A player handed a losing position can still top their group. Only the chances they give away count.
Boards
A board is a supply of positions, not a game to finish. The match ends on the round count, never on the games.
Openings
• Every board starts from the normal starting position and animates through a named opening to about move 10 (20 plies).
• Each board in a match gets a different opening. Seven are classic named openings and one is an unusual one.
• The opening's name is shown on the board.
• At match start, all 8 boards animate at once on a grid of small boards, over about 5 seconds, before round 1 is dealt.
• Build a library of at least 60 classic lines and 15 unusual ones from an openly licensed source. Record the source and its licence in the repo.
• A line only qualifies if the engine gives the side to move an expected score between 0.40 and 0.60 at its end.
• Lines are trimmed by a ply where needed, so every board has the same side to move.
Retiring a board. Before each round, a board is retired and replaced with a fresh opening in either of these cases:
• The game is over: checkmate, stalemate, or a draw by repetition, the 50-move rule or insufficient material.
• Either side's expected score has reached 0.90. Past that point, every move scores about the same.
The replacement animates in quickly and has the same side to move as the other boards.
Shrinking. When a stage ends and fewer boards are needed, keep the boards whose expected score is closest to 0.50 and drop the rest.
The duel
The last two players play one real game against each other, and that game decides the match.
• It is a normal game from the starting position on a 3-minute clock with no increment.
• The player with the higher final-four score chooses their colour.
• Checkmate, resignation or the clock decides it.
• A draw goes to the player with the lower average loss per move in the duel.
• Standard draw rules apply. There are no draw offers.
• Spectators see a live evaluation bar. It is never sent to the two players.
Bots and playtesting
The format is tested with bots of known strength before any human plays it, and bots fill empty seats in every later build.
How a bot picks. For each position, one multi-line engine search gives the loss of each candidate move. A bot with skill setting T picks among them with probability proportional to exp(-loss / T). A low T plays near-best moves and a high T plays loosely. Each bot also has a small chance per move of playing a random legal move.
Bots in live play. Bot picks are computed only after the humans' picks lock, in the same search that scores the round. A round never waits for a bot. Each bot is given a random recorded thinking time of 2 to 8 seconds for tie-breaks.
Simulated matches. Run full matches of 32 bots with a wide spread of skill settings, with no UI and no clock. Run at least 200 matches, and more if runtime allows.
The playtest report. Write a short report that answers these questions, then stop for review.
1. Does final placement track bot skill? Report the rank correlation between skill and placement.
2. How often does one of the 4 strongest bots go out in stage 1? How often does the strongest bot reach the duel?
3. Do reset scores or carried-over scores separate skill better?
4. How do those answers change with 6, 8, 10 and 12 rounds per stage?
5. How many rounds are dead, meaning every pick in the group is within 1 point of the others?
6. How many boards are retired per match, and for which reason?
7. Does the engine budget hold up? On a sample of positions, compare its scores with a search 20 times larger.
8. Which settings does the evidence suggest changing?
What bots cannot tell us. They show whether the structure is fair and how noisy it is. They cannot show whether reading a cold position in 10 seconds is fun, or whether engine loss matches human skill. Those need the solo build and real players.
Engine
The engine is Stockfish, used through one small interface so that where it runs can change later.
• Interface. One call takes a position and a list of moves, and returns the expected score after the best move and after each listed move. A second call returns the top N moves with their expected scores, for bots.
• One build everywhere. Use a single WebAssembly build of Stockfish that runs in both Node and the browser, so simulations and live play produce the same numbers.
• Fixed budget. Search to a fixed node count, starting at 100,000 nodes, on one thread with a fixed hash size. Clear the hash between positions. The same position must give the same score on any device.
• Win/draw/loss. Turn on the engine's win/draw/loss output and compute expected score from it.
• Single-threaded build. It avoids the cross-origin isolation headers that a multi-threaded build needs. For speed, run several engine instances in separate web workers.
• Separation. Keep the engine in its own worker and talk to it over the standard UCI text protocol.
• Licence. Stockfish is GPL-licensed. Include its licence and a link to its source, and see Parked for later.
• Phones. Use a small-network build, and confirm it loads and runs on a real iPhone.
Platform and architecture
It is a web app for computer and phone, hosted free on Cloudflare from the GitHub repo, with the engine running in the browser.
Why the engine runs in the browser. Cloudflare's free plan allows 10 ms of CPU time per request (Workers limits), far too little for an engine search. Durable Objects, which can hold a live lobby and its WebSocket connections, are available on the free plan (Durable Objects pricing). So the free server can run the clock and pass messages, but it cannot score moves.
The builds
• Milestones 1 to 3 need no server. The solo build is a static site: one human and 31 bots, with the engine and the match logic all in the browser.
• The multiplayer build adds one Worker and one Durable Object per lobby. The Durable Object holds the clock, the groups, the picks and the draw. Use WebSocket hibernation and alarms for round timing.
• In multiplayer on the free plan, the lobby host's browser scores every group and computes bot picks, after picks lock. Other players' browsers score their own group as a cross-check, and mismatches are logged. The host should be on a computer.
• That trust model is for playtests among friends only. Ranked or public play needs the engine on a server, which means paid hosting (see Open items).
Requirements
• Use TypeScript throughout.
• Keep the match engine as a pure module with no UI, network or chess-engine code. It covers stages, grouping, scoring, the draw and board retirement. The simulation, the solo build and the server all import it.
• Use an established open-source chess library for move generation and rules, and an existing board component. Check their licences.
• Deploy on Cloudflare from the GitHub repo, the same way as Word Trap. Ask Eric for that setup if it is not in this repo.
• Ask Eric before adding any paid service.
• The layout works on a phone in portrait and on a computer. On a phone it must feel like an app, not a shrunken web page.
Screens
Play happens on one large board. The grid of small boards is for the opening, the stage breaks and spectators.
Screen
What it shows
Lobby
The player list, an invite link, and Start for the host. Empty seats fill with bots on start.
Opening
A grid of all boards animating through their named openings
Play
One large board from the mover's side, the last move highlighted, the opening's name, the countdown, the stage and round, and the player's rank with a marker when they are in the knockout zone
Reveal
The group's picks as arrows on the board, each pick's loss, the player's round score, then the drawn move animating
Stage break
Standings with the knockout line, who went out, and the grid of surviving boards
Spectate
The grid of boards and live standings, for knocked-out players
Duel
A standard game view with two clocks. Spectators also see the evaluation bar.
Results
Final placement, average loss in each stage, and the player's best and worst move
Interaction
• Move by tapping a piece and then a square, or by dragging. Legal squares are marked.
• A pick is final once made. There are no premoves.
• The board is always shown from the side to move.
• The last 3 seconds of the countdown are signalled with sound and colour.
• No replay of earlier moves is shown during play. The highlighted last move is the only history.
Settings
Every tunable lives in one settings file, so playtesting changes never touch game code.
Setting
Starting value
Lobby size
32
Group size
4
Move clock
10 seconds
Late-pick grace
300 ms
Reveal time
4 seconds
Rounds per stage
8
Knockouts per stage
8, 8, 8, 4, 2
Scores between stages
Reset (carry-over available)
Missed-move score
-25
Opening length
20 plies
Opening balance window
0.40 to 0.60
Board retirement threshold
0.90
Engine budget
100,000 nodes per search
Bot candidate moves
Top 8
Bot skill settings
A spread of T values, chosen in milestone 2
Bot random-move chance
2%
Duel clock
3 minutes, no increment
Build order
Build in five milestones and stop for Eric's review after each one.
1. Match engine and scoring. The pure match module, the engine wrapper with its fixed budget, and the opening library with its balance filter. Unit tests include the worked examples under Scoring. There is no UI.
2. Simulation and playtest report. Run the simulated matches and write the report described under Bots and playtesting. The results may change the settings, so review them before any UI work.
3. Solo build. One human and 31 bots, entirely in the browser, deployed as a static site. It includes every screen except the lobby, and a duel against a bot. If the human is knocked out, the rest of the match is simulated quickly and the results are shown. Report how long scoring a round takes on a phone. This is the first feel test, on phone and computer.
4. Multiplayer lobbies. The Worker and Durable Object, invite links, bots filling empty seats, host scoring with the cross-check, and reconnecting after a dropped connection.
5. Spectating and polish. The spectator grid, the evaluation bar in the duel, the full results screen, and installing to the phone's home screen.
Parked for later
None of these are in v1. Do not build them, but do not design them out.
• Ranked ladder. Lobbies of similar skill, with rank driven by placement in the lobby. An estimated rating from move quality is shown as a stat only.
• Anti-cheat. The score is agreement with the engine, so anyone running an engine scores perfectly. The short clock is the main defence. Ranked play also needs the engine on a server and some form of detection.
• Server-side engine. Scoring that players cannot see or tamper with, on paid hosting.
• Accounts, a matchmaking queue and re-queueing.
• Move confirmation and premoves as options.
• Native app wrappers for the app stores.
• Before any public release. Review the licence terms of Stockfish, the chess and board libraries and the opening data, and choose a final name.
Open items for Eric
[ ] Scores reset each stage, or carry over? The default is reset, and the playtest report compares both.
[ ] Confirm the free-hosting trade-off: the engine runs in browsers and the host's computer scores friend playtests.
[ ] Should a pick be final, or changeable until the clock ends? The default is final.
[ ] After the playtest report, confirm rounds per stage, the missed-move score and the 10-second clock.
[ ] Choose a name. Battle Royale Chess is a working title.