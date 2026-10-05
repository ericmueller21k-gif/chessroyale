# Decisions

Judgement calls made while building, with the reason for each. Eric asked to be involved as little as possible, so
these weren't reviewed first. Most are a single line in `packages/core/src/settings.ts`.

## Milestone 1: match engine and scoring

- **Engine build: Stockfish 19 "lite single-threaded" WebAssembly** (npm `stockfish`, 1.8 MB). It's the small-network
  build the spec asks for, needs no cross-origin isolation headers, and the same file runs in Node (child process)
  and the browser (Web Worker). It speaks plain UCI over text. At 100,000 nodes a search takes about 0.15–0.25 s in
  Node here, and repeated searches give identical numbers. (Raised to 250,000 in milestone 2.)
- **One search scores a whole group.** A MultiPV search returns the top N moves with win/draw/loss for each; any
  picked move outside them gets one extra search restricted to those moves (`searchmoves`). Bots use the same top-8
  search. Every search starts with `ucinewgame`, which clears the hash.
- **Expected score** = (win + draw / 2) / 1000 from Stockfish's WDL output, from the mover's side.
- **A board's expected score for retirement** is taken from the previous round's search (the drawn move's score,
  flipped to the new side to move), so no extra search is needed before dealing.
- **Grouping:** a local search that swaps players between groups, treating "same board as last round" as a hard
  constraint (while 4+ boards) and repeat groupmates as a soft cost. In tests it reaches zero repeats.
- **Openings: Lichess chess-openings (CC0).** For each named variation, take its longest line. Short lines are
  extended with the engine's best moves to 21 plies, and each is scored at 20 and 21 plies, so any board can start
  with either side to move (a replacement board must match the others). A line is kept if either ending is inside
  0.40–0.60. "Unusual" means irregular openings: the Lichess A00/B00 families plus a short list of offbeat
  gambits (`UNUSUAL_FAMILIES` in the build script).
- **Each match picks 7 classic + 1 unusual opening from different families.**
- **Chess rules: chess.js** (BSD-2). The board UI component is chosen in milestone 3.

## Milestone 2: simulation and playtest report

The report is `reports/playtest.md` (200 full bot matches at 100,000 nodes, plus 1,000 replayed matches per variant).
Answer to its question 8, the settings changed or kept because of it:

- **Engine budget: 100,000 → 250,000 nodes.** The report found the 100k search names the same group winner as a
  search 20 times larger only 87% of the time (90th-percentile loss error 15 points). A follow-up on 60 more
  positions measured 86.6% at 100k, **91.1% at 250k** and 94.0% at 500k, at 0.25, 0.59 and 1.08 s per search in
  Node. 250k cuts the wrong-winner rate by a third. To keep the extra cost from adding a wait, each round's top-move
  searches now **start as soon as the round is dealt**, while players think (solo; in multiplayer the server sends
  the host every board at round start). After the picks lock, only a pick outside the top 8 needs a search. 500k
  would risk running past the 10-second clock on a phone in solo. If Eric's iPhone test shows slow scoring, this is
  the setting to lower.
- **Scores between stages: keep reset.** Carry-over halves how often the strongest bot reaches the duel (15% vs 33%
  at 8 rounds) without improving the overall skill order, because one bad early stage can't be recovered from.
- **Rounds per stage: keep 8.** Going to 10 or 12 barely changes the rank correlation (0.667 → 0.670 → 0.675) and
  adds 3–5 minutes. 6 rounds is about as fair and 2 minutes shorter, so it's the first thing to try if real matches
  feel long.
- **Dead rounds (43%): no change yet.** Bots almost always pick among the engine's top moves, so nearly half of
  groups tie. People with 10 seconds on an unfamiliar position will spread out much more. If real players also tie
  often, the lever is fewer quiet positions (a tighter opening balance window, or retiring boards earlier than 0.90).
- **Retirement: keep 0.90.** About 4.7 boards a match are retired, almost all for reaching 0.90, which is the
  intended way out of decided positions.
- **Placement tracks skill (rank correlation 0.67), with plenty of upsets:** a top-4 bot goes out in stage 1 about a
  quarter of the time, and the strongest bot wins about 1 match in 5. That fits a party game, so no change.
- **Bot skills:** the spread used in the report (T from 0.25 to 32, log scale) is now the `botSkillRange` setting,
  and the same spread fills empty seats in solo and in lobbies.

## Milestone 3: solo build

- **Board component: chessground** (Lichess's board, GPL-3). Tap-tap and drag, legal-square dots, last-move highlight
  and arrows for the reveal all come built in. GPL matches Stockfish's licence, so the app as a whole is GPL anyway.
- **Engines in the browser: up to 4 Web Workers** (cores − 1). The 8 boards of a round are scored in parallel, so
  scoring takes well under a second on a laptop. The results screen prints the time per round on that device.
- **Pacing.** The opening grid plays for 6 s; the reveal shows for 4 s plus 1.5 s for the drawn move, and a tap skips
  it; solo stage breaks wait for a tap. All are in `settings.ts`.
- **When you're knocked out in solo,** the rest of the match is simulated quickly (there's nobody to watch) and the
  results show where you finished. A duel between two bots is decided by lower average loss over a sample of
  positions, rather than playing a 6-minute bot game.
- **Solo duel vs a bot:** the bot thinks for a short random time (less when its clock is low), so it can lose on time
  only if you play very fast. A draw goes to the lower average loss, as the spec says.
- **Playtest overrides in the URL:** `?rounds=2&clock=15&duel=60` change those settings for that match only (also when
  creating a lobby). Handy for a quick test; normal links play the real settings.

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

## Milestone 5: spectating and polish

- **Evaluation bar** for duel spectators, computed by the spectator's own browser from the position on screen. The
  server never sends evaluations, so the players can't see it even by inspecting traffic.
- **Install:** web manifest, icons (gold crown over a pawn), and a service worker that precaches the app and the
  1.8 MB engine, so solo works offline and the app opens instantly. Pages are always fetched fresh when online (the
  Word Trap lesson), so updates show up on the next open. Android/desktop Chrome get an Install button; iPhone gets
  Share → Add to Home Screen instructions.

## Changes after Eric's first look (Oct 2, 2026)

Eric asked for these. Where they reverse the spec, the request wins; the details were my call.

- **Time bank instead of a fixed 10-second clock.** Each player has 10 minutes for the match, +5 s added at the start
  of every move, and no single move may take more than 30 s. The 30 s cap matters in lobbies: all 32 players are on the
  same round, so one slow thinker could otherwise hold everyone up for minutes. Rounds still lock early once every
  human has moved, and solo never waits for bots. With an empty bank you still get the 5 s top-up. Bots record a
  thinking time of 3–20 s, which comes out of their banks too.
- **Points are move quality only** (Eric, later the same day). Time and power-ups don't change points: a bigger bank
  already rewards whoever saves time for the hard positions, and a faster player shouldn't go through ahead of one who
  played the better move. Less thinking time only breaks an exact tie at a cut, as before. Average time per move is
  kept as a stat (results screen, and in the data for future player profiles). An interim version counted time (±2 points a
  minute) and charged 4 points per power-up; that was dropped.
- **Power-ups are free.** One at the start, plus one more for everyone who survives a cut, and unused ones carry over, so the
  choice is when to spend them. Using one shows the engine's top 3 moves as labelled arrows with each move's expected
  score. The hint comes from the search the device already runs for the eval bar, so it appears almost at once. Bots use
  one when a position is sharp (the second-best move loses 15+ points), then play the best move.
- **Practice mode** (checkbox on the first screen): unlimited power-ups, and a 💡 on the
  leaderboard so everyone can see who's using it. This replaces my earlier idea of 3 shuffled "good, okay, so-so"
  suggestions; the power-up view does the same job.
- **Evaluation bar always shown**, on the play screen and for both duel players. The spec said players never see it;
  Eric decided otherwise. On the play screen it reuses the top-moves search already running for scoring.
- **One colour per stage.** Half the boards now have White to move and half Black (openings are cut at 20 or 21
  plies). Each player is White or Black for a whole stage, so the board never flips under you, and colours swap at
  each cut, as evenly as the numbers allow. Shrinking keeps half of each colour's boards. The final four share one
  board, so colours alternate there. Grouping only seats players on boards where their colour is to move, which also
  means you never get the same board twice in a row.
- **Catching up on a board.** When you land on a board, the moves played since you last saw it are replayed (or the
  last 2 if it's new to you), up to 4 at about half a second each, before you can move. The move you watch drawn in
  the reveal counts as seen.
- **Live leaderboard, styled like a racing timing tower.** Position, name, stage points, average per move, engine rating,
  time bank and power-ups. The highest-rated player still in gets a 🔥. Rows slide to new positions after each round, a red line marks the elimination cut, and the 2 players
  either side of it pulse. On a computer it's a permanent sidebar. On a phone, a strip above the board shows your
  position, your gap to the cut and your power-ups, the reveal shows a compact tower (top 5, the bubble, you, bottom
  5), and tapping the strip opens the full tower.
- **Engine rating ("Elo" column).** Not a real Elo, since games aren't played out. It's a performance estimate on
  Stockfish's CCRL-anchored scale: Stockfish's own UCI_Elo mode (1320 to 3190) picked moves in 160 positions like the
  game's boards, and each pick was scored the way players' picks are. A straight line through log(average loss) against
  rating fits those points well (R² 0.98) and extends the scale below 1320 (`reports/rating-calibration.md`). A player's
  average loss over every move in the match maps onto that line: 8 points a move ≈ 1760, 12 ≈ 1320, 3 ≈ 2830. It
  starts as if the player had 8 average (1500-level) moves already, so it's shown after 3 moves and firms up as the
  match goes on. Missed moves don't count (they're about the clock, not chess). Bots get ratings too, the clear
  top-rated player still in gets a 🔥, and the results screen lists the 3 most dangerous players. Ratings are per
  match for now; a lifetime rating needs player profiles, which can be built later on the same free Cloudflare setup.
  Caveat: humans see these positions cold, on a clock, so expect ratings somewhat below their usual online ones.

## Round flow, after Eric's first computer test (Oct 2, 2026)

- **Your move stays on the board** once you've made it, with a "Waiting for other players · 17/32" banner. Before,
  the board snapped back to the old position while the round was scored, which looked like your move had been
  replaced.
- **The leaderboard lights up as players finish.** Names turn green with a ✓. Bots finish at their recorded
  thinking time (drawn when the round starts, and part of the server's saved state), humans as their move arrives
  (the server now tells everyone). Once every human has moved, any bot still "thinking" finishes in a quick stagger
  (about a second) while the round is scored, so a fast player never waits 20 s for bots.
- **Scores only change once everyone has finished.** Solo now scores in two steps (work out, then apply), so the
  leaderboard and round counter don't move behind the waiting banner.
- **The reveal says which pick continues the board.** One pick per group is drawn at random to carry the game on,
  and the reveal used to say so only in small print, so a different move appearing looked like a bug. Now a 🎲
  callout names the move and whose pick it was, the picks list marks it, your arrow is labelled "You" and the best
  move "★". Castling was checked with real taps and drags on phone and desktop (`e2e/castling.spec.ts`).
- **The cut line reads "Cut after round 8"**, and the danger zone is amber ("at risk") instead of dark red, which
  read as "already eliminated". The first cut is after 8 rounds; `?rounds=2` in a link makes it 2 for quick tests.

## Which move continues the board, and sounds (Oct 2, 2026)

- **Draw rule per stage (Eric's hybrid).** Stage 1 plays the **most popular** pick in the group (a tie is drawn among
  the tied moves, so with four different picks it's random, and weaker players still see their move sometimes).
  From stage 2 the **best** pick in the group continues the board. This reverses the spec's pure lottery, by Eric's
  request. Two more rules are available to compare: `weighted` (a draw where better moves get more tickets,
  `exp(-loss/4)`, so the best move usually wins but others sometimes do) and `random` (the original). Try one for a
  whole match with `?draw=weighted` (also when creating a lobby). It's `drawRuleByStage` in settings.
- **The reveal shows everyone's move at once.** See-through copies of each moved piece slide to their squares with
  the players' names stacked above (yours in blue). Then "All moves in · choosing the move", then the chosen move plays
  with the reason ("the most popular move in your group", "the best move in your group", …).
- **Sounds, synthesised in the browser** (Web Audio, so nothing to license or download): a wooden "thock" for every
  move on the main board (your move, the catch-up replay, the chosen move, the duel), a sharper double knock for
  captures, a soft chime when a round starts, a sparkle for a power-up, a ding when all moves are in, a rising chord
  when you survive a cut, a falling one when you're out, and a fanfare for winning. The countdown beeps moved into the
  same module. A 🔊/🔇 button sits next to the strip and on the first screen, remembered per device. Browsers only allow
  sound after a tap, so the first tap anywhere turns it on. Recorded samples can replace any of these later.

## Pace, the reveal, history and real piece sounds (Oct 2, 2026)

- **Piece sounds are recorded wooden knocks** from PyChess (GPL-3, the same licence as the app): one for a move, a
  double knock for a capture, king-and-rook for castling. Lichess's classic set is listed as non-free in its own
  licence file, and its alternative sets are AGPL, so PyChess was the clean choice. Other cues (round start, the
  reveal's reel ticks and landing, the 3-2-1, cuts, the win) are a soft marimba-style voice in a lower, warmer
  range than before, and the move clock's last-seconds beeps use it too.
- **Relaxed pace by default**, with a toggle on the first screen (unticked = quick; `?pace=quick` in a link). Relaxed:
  a 5 s settling-in countdown on each new board while up to the last 5 moves replay (the move clock and bank don't
  run during it), and a 9 s reveal. Quick: 2 s and 5.5 s.
- **The reveal is a sequence:** everyone's moves slide in as see-through pieces with names; "Selecting move…" fades in
  while a highlight ticks across the candidates and slows down like a reel; it lands with a green ring and a chime,
  the others fade, and the move plays with a green ring on its square; then a big translucent 3-2-1 "Next board",
  timed from the server so everyone moves on together.
- **Step through a board's game** with ◀ ▶ (and ⏮ ⏭, or the arrow keys on a computer) under the board, all the way
  back to the first move. While looking back the board can't take a move; ⏭ returns to the live position.

## 64 players, one board fewer per cut, and a 2v2 final (Oct 2, 2026)

Eric's design; the details were my call.

- **64 players on 8 boards, 8 per board.** Bigger groups make a round's score fairer (you're measured against 7
  players, not 3), and the reveal shows up to 8 moves sliding in at once.
- **Each cut removes the bottom 8 and one board**: 64/8 → 56/7 → 48/6 → 40/5 → 32/4 → 24/3 → 16/2 → 8/1, then the last 4
  play the final. The board that closes is the most lopsided (furthest from 50/50), keeping both sides to move
  represented so each colour still has boards. 5 rounds per stage (40 knockout rounds, about 25 minutes relaxed).
- **Boards are never swapped.** The same games develop all match. If a game actually ends mid-stage, that board leaves
  play and its players spread over the other boards until the cut; only if the very last board's game ends does it
  get a fresh opening. In the bot check this happened 0.16 times per match.
- **Colours stay fixed per stage with any number of boards.** Players split half White, half Black. With an odd number
  of boards the boards' sides alternate 4/3 then 3/4, so group sizes become 7-10 instead of exactly 8. With one board
  left, colours alternate as before.
- **The 2v2 final replaces the duel.** It's on the last board, the game everyone has watched. Seeds (from the last
  stage's standings) 1 & 4 play the side to move, 2 & 3 the other, and the turns go seed 1, 2, 4, 3. Each finalist
  makes 5 moves (fewer if the game ends). Every move is scored as usual and placement 1st-4th is by average loss per
  move in the final. A missed move counts as 25. A tie goes to the team that won the game, then less thinking time.
  So a deliberately bad move only hurts the player who makes it. There's no settling-in countdown in the final (it's
  one board), each move is shown for about 3 s, and bot finalists "think" for 1.5-4 s.
- **Bot check** (`reports/format-sim.md`): placement tracks skill about as well as the old format (rank correlation 0.63
  vs 0.67), a top-8 bot goes out in stage 1 about a quarter of the time, and the strongest bot reaches the final about
  1 match in 4. 6 rounds per stage was a little fairer but within noise, so 5 it is.
- **Wins on a profile** (Eric's idea) needs player profiles first; parked.

## One locked phone screen, every board on top, one countdown style, ticks only (Oct 3, 2026)

Eric's requests; the details were my call.

- **Phones get one locked screen** (anything under 900 px wide): nothing scrolls or moves around. From top to
  bottom: the 8 tiny boards, the stage/position strip, the board (a little smaller, about 300 px on a short phone
  screen), ◀ ▶, the move controls, and a small scoreboard. The scoreboard is the only part that scrolls, inside its
  own box, kept centred on you. Its rows show just position, name and points. Its header ("Leaderboard P12/64 · +3.1")
  minimises it to one line, and with it minimised the board grows into the space. The choice is remembered on the
  device. The full leaderboard is still one tap on the strip, and the stage breaks and results show it in full.
  Landscape phones (under 520 px tall) keep the scrolling layout, since a locked screen would leave no room for the board.
- **Computers keep the full scoreboard on the left** (at 1100 px and wider). Between 900 and 1100 px the small
  scoreboard sits under the move controls instead.
- **All 8 boards along the top, on every game screen** (phone and computer): tiny pixel boards (grey squares, white
  and black blocks for pieces, pawns small and kings largest, last move tinted) numbered 1-8. They're live: each one
  shows its position after every round. Yours this turn has an orange ring. A board that has closed (at a cut, or
  because its game ended) stays in its place, greyed out, so the numbers never shift. They're always drawn with White
  at the bottom. The server sends every board slot with each round, reveal, stage break, final and spectate message.
- **The move clock is a thin bar on the board's top edge.** It's full when the clock starts and shrinks right to left
  to nothing at your deadline (30 s, or less when your bank is short). It turns red for the last 10 s, with a tick
  each second. The old bar and number under the board are gone, and so is the "Get ready" pill.
- **One countdown for the start and the end of a round.** A black "ROUND START" or "ROUND END" banner, outlined in
  white, always in the same place near the top of the board, and a huge black 3, 2, 1 with a white outline in the
  middle of the board that grows, settles and fades each second. "Round start" covers the new board's settling-in
  time (the last moves replay underneath; the numbers show for its last 3 s). "Round end" shows for the last 3 s of
  your move clock. The reveal's own "Next board" 3-2-1 is gone, since the next board opens with "Round start". Once
  you've moved, the bar and the "Round end" count are hidden while you wait.
- **Sounds: piece sounds and a clock tick, nothing else.** The tick is a short, dry click (filtered noise, like a
  watch) used by every timer: the last 10 s of the move clock and the 3-2-1 of "Round start". The marimba cues for
  the round start, power-up, reel, landing, cuts and win are all removed.

## Cleaner play screen (Oct 3, 2026)

Eric's requests; the details were my call.

- **The stage/position strip moved above the tiny boards** and lost its white box and border, as did the sound
  toggle: one clean line, left to right ("S1 · R1/5  P12/64  +3.1 safe … ⚡1 ☰ 🔊"). Tapping it still opens the full
  leaderboard.
- **The board is centred on the screen.** The evaluation bar stays on the left, and an equal empty gap on the right
  balances it.
- **History is just ◀ on the left and ▶ on the right**, with no boxes. ⏮ and ⏭ are gone. While you're looking back,
  the middle says "Move 14 · 27/40 · back to live"; tap it to return.
- **Your move clock is shown small in the middle below the board** (0:24), turning red for the last 10 s, with the
  bar on the board's top edge as well. "You play White" and the bank clock are gone from the play screen. The bank
  is still in the full leaderboard.
- **The power-up is a small outlined pill** ("⚡ Power-up: top 3 moves · 1 left") instead of a full-width button.

## One line of controls, a power-up button, live numbers, a smarter small scoreboard (Oct 3, 2026)

Eric's requests; the details were my call.

- **One line of controls under the board:** back (‹‹) on the left, forward (››) on the right, each in a soft
  rounded box; between them your move clock and the power-up button. Going straight to the first move was dropped:
  there's no time for it mid-round.
- **The power-up is one round button with a lightning bolt and "x1" above it** (how many you hold). It's lit when you
  can use one and greyed out at x0. While it's in use this move it shows as an outlined ring and the count drops. When
  you earn one (and when the match starts) it flashes yellow a few times and the count ticks over. The engine's top
  3 show as arrows on the board and as one line of small chips under the controls.
- **The strip: your points are big** (green above the cut, red in the knockout zone), **then the cut line's score in
  yellow** ("CUT −1.1"). Eric asked for the lobby average there, but a points average would always read about 0.0:
  every round score is measured against your own group's average, so across the lobby they cancel out (only missed
  moves pull it below zero). The cut line's score moves as the game goes on and tells you where you stand, so I used
  that instead. Swapping it for something else is a one-line change. The power-up count left the strip, since the
  button shows it.
- **Numbers are live.** Your position, your points, the cut score and every player's points on the leaderboards count
  up or down to their new values (about 0.7 s) and flash green when they improve, red when they drop. Rows still slide
  to their new places.
- **The phone's small scoreboard never scrolls; it shows as many players as fit**, in this order: you, the leader,
  the last place through and the first place out (with the cut line between them), your neighbours, the rest of the
  top five, then outwards from you. "⋯" marks the gaps. On a 700 px-tall phone that's about 4-5 rows; on a typical
  phone it's 8-10. Each row shows position, name, points, average, rating and power-ups, with small column labels.
  Tapping it opens the full leaderboard; the arrow in its header still minimises it. Computers keep the full
  leaderboard on the left.

## Power-up slots, a centre-closing timer, shorter openings, replay from move 0 (Oct 3, 2026)

Eric's requests; the details were my call.

- **Power-ups: start with 3, hold at most 5** (one more each stage you survive; one earned on a full hand is lost).
  Under the board they're a row of 5 small round slots with a lightning bolt: lit for each one you hold, grey for
  missing or used. Tap a lit one to see the engine's top 3 on this move; the slot turns into a breathing outlined
  ring while it's in use. Tapping a grey one gives a little shake and does nothing. Newly earned ones light up with
  a few yellow flashes, one after another (and your first 3 do at the start of the match).
- **The move clock moved off the controls line.** The line under the board is now ‹‹, the power-up slots, ››, all
  smaller, so the board area is tighter and the scoreboard gets more room. **Your total time left (the bank) is in
  the top line** on the right, ticking while you think and red under a minute. The bar on the board still shows
  this move's time.
- **The timer bar is square-cornered, 3 px, with a slight glow.** It starts full and closes in from both ends to
  nothing in the middle, fading from green through yellow to red.
- **Openings are 4 moves per side by default, and a lobby setting from 0 to 10** (Eric: fewer is friendlier for a wide
  audience). It's a stepper on the first screen ("Opening moves"), remembered on the device and used for solo games and
  lobbies you create (`?moves=N` in a link). Boards where Black starts get one ply more. At 0 every White-to-move board
  starts from the initial position.
- **The opening library was rebuilt for every length from 0 to 10 moves**, from named Lichess lines only (no engine
  filler moves): for each length, the distinct positions named lines reach, one per named variation, most travelled
  first (up to 100 classic and 30 unusual per length). Each is scored at both lengths it can be shown at and kept if
  balanced (40-60%), and each board is named after the longest named line its moves actually match (so a 4-move
  board says "Italian Game", not the name of a 12-move line it was cut from). Short lengths have few families, so
  boards may share a family (or, at 0 moves, the starting position).
- **A board you've never seen replays from move 0.** On a board you've seen before, the moves you missed replay
  (up to 5), as before. A whole game replays quickly to fit in the "Round start" countdown (as fast as 0.09 s a
  move), and the piece sounds are thinned to one knock every 0.18 s so it isn't a clatter.
- **The phone scoreboard has a bit of margin left and right.**
- **Stage 1 is longer: 8 rounds before the first cut** (later stages stay at 5). Eric: bad players shouldn't be
  punished instantly. The cut ranks the whole stage's points, so one bad move early is diluted over 8. It adds about
  3 rounds (roughly 2 minutes relaxed). `firstStageRounds` in settings; `?rounds=N` in a playtest link sets every stage.

## Timer bar flush with the board; the reveal reel's sound is back (Oct 3, 2026)

- **The timer bar touches the board's top edge**, 3 px, square, no glow, starting dark green and fading through
  yellow to red.
- **The "selecting move" reel has a sound again**, aiming at a kart racer's item roulette: each reel step is a quick,
  bright two-note flick climbing a major arpeggio (C-E-G-C), so it rolls faster then slower with the reel. When it
  lands, the winning move blinks three times with three identical tones. Both are synthesised placeholders until Eric
  finds a sample.

## Paid hosting and a domain are on the table (Oct 3, 2026)

Eric will front money for hosting and services, and wants a good URL. Plan: stay on Cloudflare and add a custom
domain bought through Cloudflare Registrar (sold at cost, no markup) so DNS, hosting and the Worker live in one
account. Accounts, profiles and ranked will use Cloudflare D1 (SQL) for players and match history. Workers Paid
($5/month) only if we outgrow the free limits (Durable Object requests or CPU time). Eric does the purchases; I'll
recommend specific options with prices when we get there.

## "15 opening moves", a sound lab, and a sound for every board moving (Oct 3, 2026)

- **Eric saw about 15 opening moves in the first rounds.** The opening itself is right (8 plies, 9 where Black
  starts). What he saw was the replay from move 0 that plays on a board you haven't seen before: in stage 1 you land on
  a new board almost every round, and by round 5-6 that board has the opening plus 5-6 drawn moves. It now says so on
  the board, under "Round start": "New board: replaying it from the start" (or "Replaying the moves you missed").
- **Sound lab** (a link on the first screen, or `?soundlab`): play a full roulette in each voice and choose the one the
  game uses on this device: steel pan (the new default, aiming at Mario Kart 64's warm item roulette: harmonic
  partials, a slight pitch settle on each strike and a soft stick tap), kalimba, marimba, glockenspiel, music box and
  the 8-bit blip. It also previews the other sounds, and says where to find or make a sample (freesound.org CC0,
  BeepBox) to replace any of them.
- **A sound when every board moves after a round:** a quick ripple of 8 soft wooden knocks while the tiny boards light
  up one after another. It happens when the chosen move plays on your board, and the tiny boards now hold their old
  positions until then, so they no longer give away the chosen move during the selecting reel.

## Crowd mode: 100 players, one board (Oct 3, 2026)

Eric's design; the details were my call. The 8-board version stays as **Classic** (the version before modes is commit
`bd726b5` on main; the session's git proxy wouldn't push a tag). The first screen has a mode picker.

- **One game from the starting position, 100 players, the most popular pick always played.** Scoring is unchanged:
  your move's quality against the average of everyone who picked with you.
- **Two ways to play, a lobby setting:**
  - **50 v 50 (default):** random even teams, you play your side all game. Your team picks on your side's turns; on the
    other team's turns you watch their vote come in (a count of who's voted), then see it. Cuts take the same number
    from each team (each team has its own cut line, so the leaderboard shows your team), and the final is each team's
    top two, teammates alternating.
  - **Everyone moves:** everyone picks for whichever side is to move, every turn; cuts by overall score; the final is
    seeds 1 & 4 against 2 & 3.
- **No cuts for the first 10 moves (20 plies), then a cut after every move** (2 plies): 100 → 84 → 70 → 58 → 48 → 40 →
  32 → 26 → 20 → 16 → 12 → 8 → 6 → 4 (all even, so the teams stay even), then the 2v2 final (5 moves each). Scores carry
  over all game, since a "stage" is only one move: a cut ranks your whole game, not one move.
- **3 power-ups, none earned.** 20 s move clock. No settling-in countdown or opening grid (it's one board everyone has
  been watching).
- **If the game ends before the final** (mate, stalemate, repetition), a fresh game starts from the starting position
  and the cuts carry on. In the final, the game ending ends the final.
- **Winning the game goes on your record, not your score** (Eric). Placement is move quality only; the results screen
  says whether your team won the game (the side that mated, or the side the engine rates 60%+ when the final ends),
  ready for profiles.
- **Augments (on by default; a switch turns them off):** after each cut, three cards: More time (+5 s), Same, Less time
  (−5 s), for the next round's move clock (10-40 s). I made it a vote (the majority decides; a tie or no votes keeps
  it), since Eric described it as pacing; in solo your vote decides. It can become a personal pick, and more augments
  can be added as cards.
- **The reveal is a live poll, not the shuffle:** the most picked moves grow as vote bars and as arrows on the board
  with vote counts, with a roulette blip per bar; the winner blinks three times with the three tones, then it's
  played. You see your pick, your score for it and the best move.
- **The cut screen:** CUT, how many went out and how many are left, the names struck through, whether you're through,
  the augment cards and a countdown (about 7 s; 4 s without augments).
- Bots past the name list get numbered names ("Queenie 2") for 100-player lobbies.

## Crowd: every pick on the board, live tallies, an animations switch (Oct 3, 2026)

Eric's requests; the details were my call.

- **Every pick is a ghost piece with names.** Each picked move gets a tag over its square with the top three names (by
  leaderboard, you first) and "+N" for the rest; names are cut to about a square and a half so neighbouring tags stay
  readable. Cluttered on purpose.
- **Animations on (default):** every single pick is its own see-through piece sliding onto its square, in quick
  succession and in a mixed order (20 knight picks are 20 knights; all 50 in about two seconds), silently. Then the
  winner blinks three times with the three tones, the others fade, and it's played.
- **Animations off** (a checkbox on the first screen, remembered on the device; `?anim=0` in a link): the tags and one
  still ghost per move, all at once, and only the chosen piece moves.
- **Live tallies.** You never see other picks before making yours. Once you've picked (and all along for the team
  that's watching), everyone's picks appear as they're made: humans the moment they pick, bots the moment they finish
  thinking, as fainter ghosts with tags. To make that possible, bots now decide their picks at the start of the round
  (from the search that already runs then) instead of at scoring time; online, the host decides them and sends the plan
  to the server, which streams the picks only to players allowed to see them and has the host score with that plan.
- **"23/50 picked"** now shows above the board while you're choosing, as well as in the waiting banner and while you
  watch the other team.

## Crowd: no double animation (Oct 3, 2026)

- Picks are always tracked; they're just invisible until you've picked. **The moment you pick, the picks already made
  catch up in a quick wave** (one every 35 ms, all 50 in under two seconds), then the rest arrive live as they're made.
  The watching team sees them live all along.
- **At the end of the turn, picks you've already seen stay where they are.** Only picks you hadn't seen yet animate in;
  then straight to the winner's three blinks and tones, and the move. If you missed your move (so saw nothing live),
  the reveal animates them all as before.
- Because most of it now happens live, **the Crowd reveal is shorter**: 4 s (2.5 + 1.5) instead of 5.5 s, 3.2 s at
  quick pace.

## The board never moves (Oct 3, 2026)

Eric: the board changed size between choosing a move and the end-of-turn selection, which was dizzying. Cause: the
reveal screens (Classic and Crowd) drew the board without the evaluation bar beside it, so on a phone it grew from
314 to 362 px and shifted left. Both reveals now use the same eval bar + board row as the play screen (the bar shows
the position on the board, including the chosen move once played). Measured every 100 ms through whole turns on
phones (390×780, 390×664) and computers (1440×900, 1000×760), both modes: one position and size for the board in
every phase. An e2e test now fails if the board moves or resizes during a turn.

## Accounts and profiles (Oct 4, 2026)

- **Guest by default.** The first visit makes a guest account with a session cookie (`hc_session`, HttpOnly, 365 days). Nobody has to sign in to play, and guests still get a profile with stats.
- **Two ways to sign in: Google, and a 6-digit code sent by email (Resend).** These are the two options Eric asked for, and there are no passwords to store. A code works for 10 minutes and only once, allows 5 tries, needs 30 s between resends and is limited to 5 sends an hour per address. Codes and session tokens are stored hashed (SHA-256).
- **Signing in keeps what you played as a guest.** If the Google account or email is new, it is attached to your current account. If it already belongs to an account, you switch to that account, your guest results move over to it and the empty guest account is deleted.
- **Sign-in buttons appear only once the secrets are set.** `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` turn Google on and `RESEND_API_KEY` turns email on. `/api/auth/config` tells the app what is available, so nothing breaks before Eric finishes the setup.
- **The database schema is made at runtime** (`CREATE TABLE IF NOT EXISTS`, once per Worker instance). Workers Builds runs `wrangler deploy` and doesn't apply D1 migrations, so this way no extra deploy step is needed.
- **Who records results.** The server records online matches when a lobby reaches results, for every player connected with an account. The browser posts solo matches against bots, since no server sees them. Solo results are marked `online = 0`, so ranked can ignore them later.
- **Stats** are shown for All, Classic and Crowd: matches, wins, final four, average placement and best placement, plus team wins in Crowd. A Crowd team win goes on your record, not your score, as decided earlier.
- **Google's ID token is read without checking its signature.** It comes straight from Google's token endpoint over TLS in exchange for our client secret. We still check `aud`, and we use the email only when Google marks it verified.

## The name: HunChess (Oct 4, 2026)

Eric picked **HunChess**, one word, for the domain hunchess.com ("hun" as in hunter or hundred). The title, install name, home logo, share text and sign-in emails all use it. Lowercase `hunchess` is for URLs and identifiers. The internal package names (`@chessroyale/*`) and the Worker name (`chessroyale`) stay as they are, because renaming them would change the deploy setup for no visible gain.

## A landing page, online play for signed-in players only, and Crowd first (Oct 4, 2026)

Eric's worry is that guests make cheating too easy, so the plan is now:

- **Online play needs a signed-in account.** Guests can play solo against 99 bots, the full game. The server enforces this, not just the app. Creating a lobby without a signed-in account gets a 401. Joining one connects, then receives "Sign in to play online" and is closed. This rule switches on as soon as either sign-in method is set up (`signInRequired`), so local dev and the tests, which have no secrets, keep online play open. I chose this over "guests are eliminated after round 1": that would still let a guest into a real match, and a cheater would just play the first round.
- **The landing page is the first screen for anyone not signed in.** It has the HunChess logo, a one-line pitch, a 24 s looping 50 v 50 demo, Google and email sign-in, "or", then "Play vs 99 bots as a guest", an FAQ, and links to the privacy policy and terms. On a computer the video sits beside the sign-in. A guest who picks bots isn't shown the landing page again on that device; Home has a "Sign in to play online" card that brings it back. An invite link always shows it ("Sign in to join lobby ABCDE"). After Google, you come back to the page you started on: the lobby for an invite link, otherwise Home. The return address is kept in a 10-minute cookie and must be a path on this site, so the sign-in can't be used to redirect people elsewhere.
- **The demo video is a real solo 50 v 50 match**, recorded on a phone-sized screen by `scripts/record-demo.ts` and cut by `scripts/encode-demo.sh`: H.264 MP4, 600 px wide, muted, about 1 MB. Later it can be swapped for a live match that's being played.
- **Crowd 50 v 50 is the default mode** and comes first in the mode picker. Classic is still there.
- **Privacy policy and terms** are at `/privacy` and `/terms`. They are short and plain, written to match what the code actually stores. Google's consent screen asks for both links. The contact address is privacy@hunchess.com, which Eric needs to forward to himself (Cloudflare Email Routing, free) or swap for another address.
- **Fixed: Crowd games used some Classic rules.** An unset playtest option such as `?rounds` was spread over the Crowd settings as `undefined`, which erased the Crowd value. Classic's 8 rounds before the first cut, a cut every 5, and the 30 s clock then came back, and online Crowd lobbies also lost "start from move 0". The overrides now drop unset keys (`definedOnly`), with a test. Earlier 50 v 50 playtests ran under the wrong timing, so they're worth repeating.

**Cheating, beyond accounts (next, in ROADMAP.md):** every move is already scored against Stockfish, so we can flag players whose engine-match rate and timing are out of line with their rating. Other next steps: block disposable email domains, add Cloudflare Turnstile (free) on email sign-in, ban by account, and add a report button. In Crowd a single cheater can't steer the board (the most popular pick wins), but they could still top the leaderboard, so detection matters most there.

## Sign-in secrets in the Secrets Store (Oct 4, 2026)

Eric put `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `RESEND_API_KEY` in the account Secrets Store (store `c4aab92a84ec4217acd83a530a799d80`), not in the Worker's own secrets. I bound them in `wrangler.jsonc` (`secrets_store_secrets`) instead of asking him to redo it, since the store keeps them in one place for the whole account. `withSecrets()` reads each one as a plain string whether it comes from the store (`.get()`, cached for 5 minutes) or is a Worker secret, so either setup works. `keep_vars` is also on, so variables set in the dashboard survive deploys.

## 50 v 50 revamp: pre-game votes, three endings, a boss, and Play now (Oct 4, 2026)

Eric's brief (voice, late at night, "make the calls"): the 50 v 50 becomes the main mode. Players pick how each match goes by pushing pawns into squares in the middle of the board, the 2v2 ending is replaced by bigger endings including a Stockfish boss, and matchmaking replaces lobbies for the main mode. My calls, in order:

**Pre-game votes (`packages/core/src/votes.ts`).**
- **Three zones, not four.** Each zone is a 2×2 block on files b–c, d–e and f–g, ranks 4–5. Leaving out the a- and h-files is the "cut out the far left and right" option Eric suggested, and it gives three clean, even zones.
- **How you vote.** Push one of your pawns two squares into a zone: White pawns land on rank 4, Black pawns on rank 5. Both teams vote at once, so 100 ghost pawns stream in from both sides, with a live count in each zone. You can also tap a card under the board (quicker, and accessible).
- **Timing.** One vote each, 8 seconds per vote. The result shows for 2.5 s with the winning zone pulsing.
- **Order.** How it ends comes first, then the speed: the speed of a boss battle or a duel feels different, so the format is decided first.
- **Counting.** Most votes wins. A tie is drawn at random; no votes gives the default (Team final, Standard).
- **Bots.** Each vote gets a fresh random lean, so results vary from game to game and a few humans can swing a close one.
- **Easy to change.** Options, names, icons and what each one sets are plain data in `PREGAME_VOTES`.
- **Speeds.** Slow is 30 s a move, Standard 20 s, Bullet 10 s.
- **The toggle.** The old "augments" switch now turns these votes on and off. Off means Team final at Standard. The vote after each cut (more / same / less time) is replaced; it's still in the code behind `cutClockVote`, which is off.
- **Board orientation.** From Black's side the board is flipped, so the cards are mirrored to match the zones.

**The three endings.** They come from `FinalFormat`, and the knockouts adjust to leave the right number of players.
- **Team final (top 8).** It starts 4v4, with teammates taking turns for their side (every 4th move of your side is yours).
  - After each player has moved 3 times, the weakest on each side goes out: 4v4 → 3v3 → 2v2.
  - The 2v2 plays to the end of the game. 160 moves is a safety cap; past it, the engine's verdict decides.
  - **Who goes out is decided by average loss per move over the whole match** (`matchLoss`, with a miss counting 25), not by the final's moves alone. That answers Eric's worry that one blunder, or one brilliant move the engine misjudges, could decide it: a whole game of moves sits behind every cut.
  - Winning the game goes on both teammates' records, as Eric asked. Placement (and later rating) still comes from your own move quality.
- **Boss battle (top 10).** The third option has two parts:
  - **The board.** At first I had the ten start a fresh game from the starting position. Eric then asked for a position from **the game they just played**, around moves 5–12, roughly even, and never better for the boss. So the battle starts from a position in that game with White (the crowd) to move, between moves 5 and 12:
    - If possible, one where White's expected score is 0.50–0.60, taking the one nearest move 8.
    - Otherwise, the position closest to even that still favours White.
    - Otherwise, the starting position, which is even by definition.
  - **Choosing it costs nothing.** Every position's evaluation was recorded when that move was scored (`BoardState.evals`), so no extra engine search is needed and it works the same solo and online.
  - **The intro.** A 5.5 s screen shows the boss appearing and says which move of their game it takes over from.
  - **How moves are chosen.** The most popular pick is played, and picks are scored as usual.
  - **Strikes.** Every 3 crowd moves the boss strikes down the player who lost the most points over those 3 moves; a tie goes against the weaker player over the match. Strikes continue down to 3 survivors.
  - **The strike animation.** A white-red flash, a skull, the victim's name shaken and crossed out, and a slight screen shake. No new sound, keeping to Eric's earlier "piece sounds, ticks and the reveal only".
  - **The end.** The battle ends on mate, a draw, or 60 crowd moves; at the cap, the engine's verdict decides. Those still standing share the result on their records.
  - **The boss's strength.** It's set from the ten's own engine ratings, weighted towards the best: the top player counts 10 times, the 10th once. Then an offset is added, clamped to 800–3000, and Stockfish plays at UCI_Elo. The number stays secret. Instead the boss has a name and look that scale with its strength (The Pawn Golem 🗿, The Iron Bishop 🤖, The Black Knight 🐴, The Tower Tyrant 🏰, The Grandmaster Wraith 👻, The Engine Eternal 👹) and a 1–5 skull threat rating.
  - **Calibration.** See below.
- **Duel (top 2).** This is the third option Eric left to me. The best player on each side plays 1v1 to the end, and the winner of the game places first. It's cheap to build (it's the team final with one player a side) and it's a real contrast to the other two: a showdown instead of a team effort.

**Boss calibration (`packages/sim/scripts/boss-sim.ts`, `reports/boss-calibration.md`).**
- **The setup.** Crowds of 10 bots (the most popular pick played, the weakest struck down every 3 moves) played White against Stockfish at the crowd's weighted rating plus an offset.
- **Crowd types.** I modelled human-like crowds (expert, club, casual, beginner) as bots that also play a random move now and then.
- **Findings** (6–8 games a row, so noisy, in `reports/boss-calibration.md`):
  - **Strong crowds.** A boss at the crowd's own weighted rating gave the expert crowd 33% wins and 50% draws. About 150 points weaker made it easy (83% wins).
  - **Club crowds.** At about 100 points weaker, they won 38%, drew 25% and lost 38%. That's the target: very hard but beatable. So **the offset is −100.**
  - **Weak crowds** (rated below about 1900 on our scale) lost almost every game, even against Stockfish's floor of UCI_Elo 1320. A crowd of shaky voters plays worse than its rating suggests.
  - **The fix for weak crowds.** Below 2100 the boss **stumbles**: now and then it plays a random legal move instead, a real mistake the crowd can punish. The chance is (2100 − strength) / 1000, at most 25%.
  - **How I got there.** A random top-5 move wasn't enough, because those are still good moves. Stumbling from 2300 at up to 50% went too far: weak crowds won 7–8 of 8. At up to 40% they still won 6–7 of 8, so the cap is now 25%.
  - **This is a starting point for real players.** Real human crowds probably agree on natural moves better than random bots do. With actual games, the offset and the stumble are the two numbers to tune (`bossEloOffset`, `bossStumbleBelow`, `bossStumbleMax` in settings.ts).

**Play now (matchmaking).**
- **The flow.** One button, no lobby: you join the 50 v 50 lobby that's filling up and watch the count climb towards 100. The match starts when it's full, or 60 s after the lobby opened, with bots in the empty seats. Unranked only for now, since nobody has a rating yet.
- **How it's built.** A `Matchmaker` Durable Object hands out the current lobby, one request at a time, so two players arriving together never open two lobbies. A matchmade lobby has no host button and starts itself on an alarm.
- **Settings.** Local tests use an 8 s fill (`MATCH_FILL_SECONDS`).
- **Later.** Filling with bots "around players' ratings" waits for ranked: bot strength is a temperature, not a rating, and mapping between the two needs its own calibration. It's in the roadmap.
- **Private lobbies.** Create and Join with a code still work, for playing with friends.

**Other details.**
- **Who plays the boss online.** The host's browser plays the boss's moves (`bossRequest` → `bossMove`), the same way it already scores rounds: the free Worker can't run Stockfish. If the host doesn't answer in 15 s, another player is asked; if nobody can, the boss plays a random legal move so the match never stalls.
- **The boss bar.** During the battle it replaces the board strip above the board on every screen, so the board stays put throughout the battle.
- **Playtest URL options.** `?format=team|boss|duel` skips the votes; `?finalTurns=N` and `?bossMoves=N` shorten those endings for tests.

**The King, the crowd's champion in the boss battle.** Eric's idea, 90% built for him to test.
- **Charges.** When the battle starts, the ten's leftover power-ups become the King's charges: one per 10 left (rounded), at least 1, at most 3. Their individual power-ups go to zero. Eric wondered whether charges should be individual or shared. I made them shared because the battle is a team effort, and saving power-ups through the game now pays off at the end.
- **Calling him.** On a crowd move, anyone can tap **Call the King** as well as picking their move. If more than half the crowd calls and a charge is left, the King plays instead of the popular move. Picks are still scored as usual, so calling never protects you from the boss's strikes.
  - Bots call him when the crowd's popular move would lose 6 points or more, and back a human's call 60% of the time. That way a lone human in a solo game can still bring him in.
- **His strength.** The King plays the engine's best move at full strength: the same search that scores the picks, so it costs nothing extra. It's always stronger than the boss, which plays limited to its UCI_Elo. On screen this reads as "plays at full strength".
- **How he looks.** A king piece in the crowd's colour with a sword at his side, beside the board in place of the power-ups during the battle. Charges show as crowns. He sways gently, and the sword wiggles.
  - When he plays, a gold card appears over the board ("The King steps in", with his move) as he rises and raises his sword. The poll shows a 👑 King row with the number who called.
  - No confirmation step, as Eric said.

**The King's strike (Eric's idea, to test).** The King has a second action for the same charge: **Strike the boss**.
- **How it's called.** The same way as the play: more than half the crowd must call. If both are called, playing the move wins.
- **What it does.** The boss's next move becomes a staggered one: from its top 8 moves, the one that loses nearest 10 points (range 5–15, `kingStrikeLoss`). That's a clear step back, never a catastrophe.
- **Bots** never start a strike, but back a human's call 60% of the time.
- **On screen.** An orange "The King strikes the boss!" card. The boss's move then says it "staggered from the King's strike". The poll shows a ⚔️ Strike row.
- **How to use it best (Eric wasn't sure yet).** It's worth more in quiet positions, where the boss's best move matters most. Playing the King yourself is worth more when the crowd can't find the move. Players will work this out, which adds skill.

## Boss raid: a mode of its own (Oct 4, 2026)

Eric: friends will want to queue up together for a boss, so make it a standalone mode with up to 50 people, a handful of engine strengths, always stronger than the lobby's average.
- **What it is.** A third mode card, **Boss raid**. Up to 50 players and no bots, picking the crowd's moves together (most popular wins).
  - **With friends:** create a raid and share the code; the host starts.
  - **Alone:** take the boss on yourself; you are the whole crowd.
  - Play now stays 50 v 50 only.
- **The board.** It starts from a named classical opening 5 moves in, from the opening library, the same balanced named lines as Classic. This was Eric's first boss idea ("four to six moves, lines every decent player knows"). A short roulette of famous opening names flicks past before the real one lands.
- **The boss's strength comes in six tiers**: 1400, 1700, 2000, 2300, 2600 and 2900. Each is one boss: The Pawn Golem, The Iron Bishop, The Black Knight, The Tower Tyrant, The Grandmaster Wraith and The Engine Eternal, ready for sprites later.
  - **The rule.** A raid gets the weakest tier that's stronger than the group's average rating.
  - **Ratings.** Each player's rating comes from their profile (their last engine rating), sent when they join. No rating counts as 1500.
  - **Low tiers.** The stumble rule above still applies, so the 1400 and 1700 bosses are beatable for new players.
- **Strikes and the King.** The boss still strikes down the worst recent mover every 3 moves, but only down to half the group, so a small group of friends isn't wiped out. The King has all 3 charges (there are no power-ups to convert).
- **Records.** Results go on profiles as their own mode ("Boss" tab). Those still standing share the win.

## The God King (Oct 4, 2026)

Eric asked for the King to become a real character: a custom piece, summoned with lightning, striking with his sword, and leaving in holy light, with SNES-style sounds.
- **The sprite** (`components/GodKing.tsx`) is my own SVG, inspired by Eric's reference image. It's a crowned, visored knight-king on a three-tier chess base, holding a sword point down, drawn in the crowd's colour with the board's outline style and gold for the crown and hilt, so it still reads as a chess piece.
  - It's drawn in parts so it can move: a gentle bob and sway, and the sword swings up to his side when he commands.
  - In the move picker, the ordinary king stands by with his small sword; the God King only appears when summoned.
- **The summoning** (about 3.6 s over the board, CSS timings):
  1. Three slow bolts converge.
  2. A beam of light, then a flash, and the God King stands there.
  3. He raises his sword, and a thin bolt strikes the piece he moves (then it moves) or, for a strike, the boss's king, with a floating "−10 HP".
  4. Holy light takes him away, and the plain king drops in and fades.
- **Timing.** The reveal gets 3.9 s extra whenever he acts, solo and online. His move plays right after his bolt; his strike comes after the crowd's own move.
- **Sounds** (`public/sounds/god-king/`, all CC0, credits in the folder). They play at summon, appear, the "hyuah!" sword raise, the bolt, the hit and the exit.
  - Most come from Juhani Junkala's retro 512-effect pack. The battle cry is a grunt from HaelDB's yell pack with a light 16-bit crunch.
  - Each file can be swapped by replacing it under the same name.

## The God King, reworked after Eric's first look (Oct 4, 2026)

- **Calling him is your turn.** Tapping "Call the King" or "Strike the boss" asks "Are you sure? You won't pick a move." Yes sends the call instead of a move.
  - Callers abstain from the round. They score 0 for it, it doesn't count as a miss, and they don't vote. For the boss's strike-down they count the round's average loss, so calling neither shields nor punishes you.
  - Once you've called you can't also pick, and a pick rules out calling.
- **No figure below the board.** Only the two buttons and the crowns stay.
- **Everything happens on your king's square.**
  - A dozen thin bolts converge on the square where your king stands, then a beam and a flash.
  - The God King takes the king's place there, at exactly one square's size (the real king is hidden while he's on the board).
  - He raises his sword, and a thin bolt hits the piece he moves, or the boss's king with "−N HP" (the middle of `kingStrikeLoss`).
  - If his move is a king move, he walks with it.
  - As the round ends, holy light takes him away from whatever square he's on, and the ordinary king drops back there.
- **Leave sound.** The laser-like exit sound is replaced with a synthesised falling shimmer that fades out (`leave.mp3`), so he vanishes rather than fires.

## The God King's strike happens during the move; the eval bar holds steady (Oct 4, 2026)

Eric's second look: the God King animation is right, but the eval bar jumped around, and a strike also played a move.

- **Eval bar.** Every screen change (your move → reveal → the boss's turn → your next move) mounted a fresh bar that started at 50% and slid back to the real value, so it moved several times per move.
  - The bar now remembers what it last showed and each position's value, so it only moves when a move lands on the board: once when the God King's move plays, once for the boss's reply.
- **The strike is no longer your turn.**
  - "Strike the boss" (confirmed: "The clock stops while he strikes, then you pick your move") counts towards a strike during the move. When more than half the crowd has called (bots back a human's call as before), he strikes at once, on everyone's screen.
  - The move clock stands still for the strike (`kingStrikeMs`, 4.4 s). Every deadline moves back by that long, and so do bots still thinking. Time on the move leaves it out.
  - Then the move goes on and everyone picks as usual. One strike per move. The button shows "Strike called 2/4" while calls come in, and "Boss struck" after.
  - Calling him to *play* the move is still your whole turn (callers abstain, as before).
- **Three slashes.** The strike shows as three quick slashes on the boss's king. Each has a slash sound (the last also the hit) and a yellow number, adding up to the middle of `kingStrikeLoss`: −3, −3, −4. The effect is unchanged: the boss's next move loses 5–15 points.
- **Slash sound.** `slash.mp3` is a short noise swish with a metallic ring, synthesised with ffmpeg.

## Boss battle: one fixed dock under the board (Oct 4, 2026)

Eric: during a God King move, the text and the leaderboard below the board kept moving from screen to screen.

- **What moved.** Each screen of a boss move had its own content below the board, so the leaderboard's top edge jumped between 490 and 574 px on a phone:
  - your move: the King buttons, whose crowns wrapped onto a second line
  - the reveal: a "👑 King" vote bar (the green bar with a 1: how many called him) and a score line
  - the boss's turn: a status line and a four-line God King explanation
- **The dock.** In boss battles, every screen now has the same dock under the board, with two rows of fixed height:
  1. The King's buttons and crowns, always there and greyed out when they can't be used. On the boss's turn they show their plain labels, so nothing from the last move carries over. "Are you sure?" swaps them for "Yes, summon him" and "No", with the question in the status line.
  2. A fixed two-line status, for example:
     - "Your move. Or summon the God King."
     - "👑 The God King plays Ng3 · 1 of 1 called him" / "You called the King: no score for you this move."
     - "The crowd plays e4 · 6 of 10 votes" / "You picked e4 (+0.4) · best was d4"
     - "The Iron Bishop is thinking…"
     - "🤖 The Iron Bishop played a5" / "Your move in 2"
- The leaderboard now stays at the same height on every screen of a boss move (checked on a phone screen: 540 px throughout).
- **Removed.**
  - The vote bars in boss battles: the ghost pieces on the board already show the votes.
  - The King vote bar.
  - The long explanation (the confirmation and the home page's FAQ cover it).
  - The old KingCalls component.
- **The line above the board** reads the same on each screen ("BOSS BATTLE · you play White · …"), with only the short note at the end changing.

## Boss intro replays the opening, then "START!"; a fighting-game banner for big moments (Oct 4, 2026)

Eric asked for this.

- **The intro, from the normal starting position.**
  - The boss's card (with the opening roulette in a raid) sits over the starting position.
  - The card fades, and the game so far is replayed one move at a time, White, Black, White, Black, with the usual move sounds.
  - Then a fighting-game "START!" banner, and the first move.
  - Timing (`bossIntroTimeline` in the chess package, shared by the server and solo): card 2.6 s; then moves at 2.4 s ÷ plies (110–260 ms each; a raid's 10 plies take 240 ms each); then a 0.25 s beat and the 1.5 s banner. A raid's intro is about 6.75 s.
  - In a raid there's no opening screen first any more, since it would show the finished position before the replay.
- **The banner (`FightBanner`), reusable.**
  - A flash, then a slanted band shoots in over moving speed lines, big italic outlined text slams down, holds, and the band shoots off.
  - Its sizes follow the board's width, so it fits any board.
  - Two looks: "start" (red and orange) and "boss" (purple and dark red, with the boss's face in a ring).
- **The boss takes your queen.** "QUEEN DOWN!", with "<boss> takes your queen", its face (its emoji for now; a sprite can replace it later) and a roar.
  - The boss's move now records what it captured (`lastMove.captured`).
  - That screen stays up 1.3 s longer (`bossShowMs`) so the banner plays out.
- **Sounds** (`public/sounds/banner/`, credits in the folder).
  - `start.mp3`: a whoosh, a punch and a short blast.
  - `boss-roar.mp3`: a CC0 yell pitched down into a growl, over a low rumble.

## The God King stands by the board, talks, and takes commands like a Final Fantasy unit (Oct 4, 2026)

Eric asked for this.

- **He's the button.**
  - The two King buttons are gone. The God King stands at the right of the dock under the board, in your colour, with his charges as crowns at his feet.
  - He idles like an RPG unit: he breathes, his crown bobs and his sword sways.
  - He glows gold when he can be called, is dimmed when he can't, and turns grey when his charges are spent. He steps away while he's on the board.
- **His commands.**
  - Tap him and a little blue window opens above his head, like an old Final Fantasy battle menu, with a ▶ cursor and retro menu blips: "Play move" (his move at full strength; you won't pick) and "Strike" (the boss's next move is weaker; the clock stops, then you pick).
  - Strike is greyed out once struck, or while your call waits for the others.
  - Tap him again to close the menu. Choosing a command is the confirmation (two deliberate taps), so there's no separate "Are you sure?".
  - The pause-menu version (dimmed screen, window over the board) was built first; Eric preferred this. It's kept as a generic `PauseMenu` component for later menus.
- **His lines** (`godKing.ts`). 49 lines across 17 moments, shown in a pixel speech bubble (Press Start 2P, OFL, hosted with the app) that types itself out over the board's corner.
  - The moments: introducing himself on your first move; your queen in danger (attacked by a cheaper piece, or attacked and undefended); your king in check; great, good and bad crowd moves (by the played move's loss: ≤1, ≤4, ≥12); crowd captures and checks; boss captures; a boss blunder (a ≥30-point swing in the eval bar's numbers); the boss staggered; his strike; him playing the move; winning or losing (≥85% / ≤15%); out of charges; idle small talk.
  - Urgent moments (queen, check, his own actions) always speak. Others roll a chance and wait at least 6 s after the last line. Each moment speaks once, and a moment never repeats its previous line.
- **Sounds.** Menu blips from the same CC0 retro pack (`public/sounds/menu/`).

## The God King, toned down: he's secondary to the chess (Oct 4, 2026)

Eric's feedback after playing it: too much King.

- **No instruction text.**
  - The dock's "Tap the God King" / "God King · N charges" line is gone; that row is just the move-history arrows now.
  - The status line says just "Your move." (plus the staggered note when it applies).
  - Instead, at most once every six moves while he has charges, he may say "Need a hand? Tap me." or similar.
- **Smaller.** The figure is about 20% smaller (40 × 60 px), and his command window is narrower (176 px) with one-line notes ("Full strength. Uses your turn." / "Weakens its next move.").
- **Paced by moves, not seconds.** Eric wants him to speak 5–10 times a game, about every 4–5 moves; before this he was mostly silent.
  - Small talk (idle chatter, the tap-me reminder, winning or losing) rests for 3 moves after any line. Then its chance grows by 30% with each quiet move. That's about 6–7 lines of small talk in a 35-move game, by simulation and unit test.
  - Reactions add to that: good move 35%, captures 50%, bad or great move 75–80%.
  - Urgent moments always speak: queen in danger, check, his own actions, a boss blunder.
  - Two lines that aren't urgent stay at least 8 s apart, so the reveal and the boss's move can't both talk over each other.
- **Boss blunders.** The boss screen compares the engine's numbers before and after the boss's move (the eval bar's, cached). A swing of 15 points or more toward the crowd always gets a line, such as "It's reeling! Want me to finish it?" or "A blunder! Find the punishing move." This catches the weak bosses' random stumbles and real blunders alike.

## The God King's bubble carries across screens (Oct 5, 2026)

Eric saw the bubble flash a couple of times as it ended. Each screen of a turn (your move, the reveal, the boss's turn) draws its own God King, and a line still showing when the screen changed popped in and retyped from the first letter on the new screen, sometimes only 0.1 s before it ended. Now the line remembers when it started: a new screen picks it up where it was (no second pop-in, no retyping), and it fades out over its last quarter-second.

## The God King's cut-in banner (Oct 5, 2026)

Eric asked for a Fire Emblem style banner the moment the God King raises his sword, before he moves the piece.

- **What it shows.** It uses the START banner's motion (flash, slanted band over speed lines, slam), in his colours instead of red: navy and indigo with gold borders. Left to right:
  - his pixel portrait: crowned, helmed, eyes burning white with a blue glow, a red cape behind;
  - "GOD KING" over what he's doing: the move in SAN (e.g. "Bxe7") or "STRIKE!";
  - the target: the piece he moves (the board's own piece art), or the boss's face for a strike.
- **The portrait.** After two simpler tries that didn't read as godlike, it's a detailed 64 × 60 pixel image in the style of Eric's reference (an ornate armoured lord), as a holy version:
  - a steel helm under a five-spiked gold crown with a cross and jewels, and burning gold eyes in an angled visor;
  - one big gold-rimmed pauldron per shoulder, its layered plates shown as seams inside it (two stacked plates read as four shoulders), with gold spikes; a gold gorget, the king's cross on his chest, and a crimson cape (it was royal blue at first, but blended into the navy banner);
  - golden sparks around him.
  - It's drawn from shapes with light from the top left and outlined, by `scripts/god-king-portrait.py`. It's shown scaled up with crisp pixels and a pulsing golden glow.
  - **Two versions, always** (Eric: everything the God King shows comes in both colours). `god-king-portrait-w.png` and `-b.png` (about 1 KB each) are the same picture with the armour recoloured: white steel for White, blackened steel for Black; gold, eyes, cape and sparks unchanged. The cut-in picks the crowd's colour, like his figure on the board, beside it and in the summon.
- **Timing.** The banner plays for 1.5 s right after his "hyuah!" sword raise. His bolt, the move and the strike's three slashes all come 1.5 s later than before.
  - The reveal where he plays the move gets 5.4 s extra (was 3.9 s), in solo and online.
  - A strike stops the clock for 5.9 s (`kingStrikeMs`, was 4.4 s).
- **Sound.** `cutin.mp3`: a whoosh into a sword ring (CC0 retro pack).

## Boss dock: one row (Oct 5, 2026)

Eric: the replay arrows' row was empty space, so the status box moves between them.

- The dock is now a single 62 px row: « [status box] » beside the God King. It was 90 px (an arrows row over a status row), so the board area gains 28 px; the leaderboard starts at 512 px on an iPhone 13 instead of 540.
- While you step back through the game, the box shows "Move 5 · 9/10 · back to live" (tap it to return).
- The God King's column shrinks to match (figure 33 × 50 px, crowns at his feet).
- The status lines are shorter to fit the narrower box (13 px / 12 px), for example:
  - "👑 God King plays Be2" / "You called him · no score" (or "3 of 8 called him · no score")
  - "Crowd plays e4 · 6/10" / "You: e4 (+0.4) · best d4"
  - "🤖 Boss plays a5" / "Your move in 2"
  - "👑 He strikes the boss!" / "Clock stopped."

## Ten boss tiers (Oct 5, 2026)

- `BOSS_TIERS` is now 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000, 3190. 3190 is the strongest Stockfish plays with its strength limited; full, unlimited strength is deliberately not a tier.
- One boss per tier, with placeholder names (Eric will rename them): Pawn Golem, Iron Bishop, Bone Archer, Black Knight, Storm Witch, Tower Tyrant, Frost Dragon, Grandmaster Wraith, Demon Lord, Engine Eternal. Two bosses per skull, 1–5.
- A raid still meets the weakest boss above the group's average rating. An unrated player (1500) now meets the 1600 boss (was 1700).

## The shop (Oct 5, 2026)

Eric wants a shop to test with (designs and prices to come). Everything is free while `SHOP_FREE` is on.

- **Catalog** (`core/shop.ts`, shared by app and server). Each category fills one slot. You own any number of its items and equip one, and every slot has a free starter.
  - God King effects: Holy Light (starter), Stormcaller, Hellfire, Voidborn, Emerald Oath. They recolour his lightning, beam and glow through CSS variables.
  - Pawn hats: none (starter), Party Hat, Little Crown, Wizard Hat, Top Hat, Viking Helm. They're SVG hats on your pawn in the pre-game votes.
  - Kill moves and other animations are listed as coming later.
- **Server.** Three D1 tables: `inventory`, `equipped`, and `wallets` (coins, for later).
  - `GET /api/shop`, `POST /api/shop/buy {item}`, `POST /api/shop/equip {item}`. Buying checks coins unless `SHOP_FREE`; equipping requires owning the item.
  - The profile carries the shop state, so the app knows your look in a match.
  - A guest's items, choices and coins join the account they sign in to; the account's own choices win.
- **App.** A Shop button beside the logo on the home screen opens the shop (also at `/shop`): category tabs and item cards with previews, Get · Free / Equip / Equipped.
- Cosmetics are what *you* see. In a crowd game, each player sees their own King effect for now; showing the caller's (or the winner's) look to everyone is for later.

## The pixel icon builder (Oct 5, 2026)

Eric asked for something like the old Call of Duty emblem editor.

- Player icons are now 48 × 48 pixel drawings (close to the suggested 50 × 50, and a cleaner size for scaling). The emoji picker is gone.
- Tap your icon on your profile ("Edit") to open the builder. The tools are deliberately few: pencil, eraser, fill bucket, colour picker, 1/2/3 px brushes, undo, clear, a 24-colour palette and a custom colour.
- It saves a PNG data URL (well under 1 KB for most drawings) in the existing `users.icon` column. The server only accepts a real 48 × 48 PNG (signature, IHDR size, base64 only, at most 16 KB). The old emoji stay valid for older accounts.
- No moderation yet (Eric: worry about that later).

## Crowd pieces: one spot per square (Oct 5, 2026)

Eric: mid-round the crowd's pieces looked misaligned and sloppy; every piece should snap to one rigid spot per square.

- **Cause, measured.** Every pick slid from its square to the target over 0.55 s. With up to 50 picks arriving in quick succession, up to 25 were between squares at once, smearing into streaks, with dozens of translucent copies stacked. Chessground also rounds its board to whole device pixels, so overlays drifted by up to 1 px.
- **Now.** Each picked square has exactly one ghost piece on it, and it never slides. It pops in place when a pick arrives (a 0.2 s pulse), and it gets bolder the more players picked it. The name tags still show who and how many.
- Overlays are sized to chessground's exact board (`--cg-size`, measured from `cg-container`). A browser check during a 50-player round: every crowd piece sat 0.00 px from its square at every moment.

## Bosses never throw pieces away (Oct 5, 2026)

Eric: the Iron Bishop (the 1600 boss) just blundered its queen. "It's boss mode, not idiot mode."

- **Two causes, measured.**
  - Below 2100 the boss "stumbled" on up to 1 move in 4 (25% at 1600). A stumble was a *random legal move*, so it hung queens.
  - Stockfish's own limited strength (UCI_Elo) is also loose at the low end. A probe at 1600, with no stumbles, gave away more than 20 points of expected score on 13% of its moves (63 of 480), mostly by hanging a piece.
- **Now, a blunder guard on every boss move** (`bossMoveFrom`; settings `bossMaxLoss` 10 and `bossMaxLogitLoss` 1).
  - Each move is checked against the engine's top 8.
  - A move that gives away more than 10 points (about a pawn, from an even position) is swapped for a slip. So is one that loses more than 1 in log-odds, which is the same guard in a position that's already won or lost, where points shrink.
- **A stumble is now a slip.** It's a small deliberate inaccuracy from the top moves, losing 2–7 points (`bossSlipLoss`), never a random move. Weak bosses stay beatable by out-playing them, not by waiting for a free queen.
- The King's strike (stagger) stays within its own 5–15 point range, but can no longer fall back to bigger losses.
- **One more check before any move but the best.** The 8-line search spreads its effort thin and now and then misjudges a move. So any move other than the best is re-scored head to head with the best in one focused search, and if it fails the guard there, the boss plays its best move.
- Cost: one 8-line search per boss move, plus one or two focused ones.
- **Measured** (`packages/sim/scripts/boss-blunders.ts`: 240 to 480 boss moves per run, judged by a separate search):

  | Moves that give away | 1600 before | 1600 now | 1400 now |
  | --- | --- | --- | --- |
  | more than 20 points | 13% | 1.3% (worst 23, in already-worse positions) | 0.8% |
  | more than 30 points (a piece or worse) | 9.4% | 0 | 0.4% (1 move) |

  The one left at 1400 was the engine's own top choice misjudging a deep tactic within its search budget, which no guard on top of the engine can catch. The low bosses are now noticeably more solid; they lose on accumulated inaccuracies.
- The only random boss move left is the server's emergency fallback, when no device in the lobby can run the engine at all.

## Pick your boss (Oct 5, 2026)

Eric wants to choose which boss to fight.

- Boss raid shows a row of boss cards (name, skulls, strength), weakest first, plus "Match me" (the old behaviour: a step above your rating, the default).
- The choice is saved on the device and used for solo ("Take on the boss alone") and for raids you create. The server takes `?boss=<tier>` and keeps the pick for rematches; an unpicked raid still matches the group.

## A banner when you take the boss's queen (Oct 5, 2026)

Only the boss's capture had a banner ("QUEEN DOWN!").

- Now yours does too: "QUEEN SLAIN!" in holy gold and blue with the God King's face (white or black to match your side), while the boss thinks.
- The boss waits for it to finish. Its minimum think time goes from 1.2 s to 2 s after you take its queen, in solo and online (the server holds the host's reply until then).

## Motion trail, an option (Oct 5, 2026)

Eric liked the cleaner fixed ghosts but missed seeing everyone "move their pieces". He asked for the motion back as a toggle, ending with every piece on the same spot.

- **What was wrong before** was the fixed piece itself sliding (up to 25 mid-slide at once, stacked translucent copies). So the motion is now separate from the piece that stays.
  - Each new pick launches a short-lived flyer from its piece's square. It's placed on the landing square and starts offset by whole squares (a GPU transform), so it ends exactly where the fixed ghost stands. It has two fading echoes behind it (the trail), lasts 0.42 s, and fades out as it lands.
  - The fixed ghost then appears (a new square) or pops (one more pick), so pieces only ever stop on one spot.
- **Limits that keep it clean.** At most one flyer per move is in the air at a time (a popular move otherwise stacked into a streak, as a first try showed), and at most 14 overall; any extra pick just pops. In a 50-player round, at most 7 were in the air at once.
- Measured in a phone browser during a full round with the trail on: every fixed ghost's centre was within 0.02 px of its square at every sample.
- **Settings.** "Motion trail" sits under Animations on the home screen (needs Animations on), and `?trail=1` turns it on. It was off by default at first. Eric tried it on his phone and made it the default (Oct 5): on unless switched off on this device. Reduced-motion devices never show the flyers.

## One name per square (Oct 5, 2026)

Eric suggested one name over each picked square, "You" when it's your move, plus the count.

- Each square shows one name pill: "You" if you picked it, otherwise the best-placed player who did. The pill is never wider than the square.
- "+N" (everyone else) is now an orange badge on the piece's top-right corner, inside the square.
- Before, up to three names plus "+N" stacked above each square, and neighbouring columns overlapped. Now nothing on one square can cover another's.

## The engine server: a hybrid (Oct 5, 2026)

Eric agreed the judge must be strong and put the account on Workers Paid. He asked about cost if the game got popular, and whether players' computers could help.

- **Hybrid, not "the server does everything".** Players' devices still do the routine scoring, as before. The server re-checks only the close calls that decide cuts. Lichess's fishnet is the precedent for using players' machines; the catch, cheating, is handled by never letting a device's number decide a close call.
- **The server:** native Stockfish 17.1 (the full network) in a Cloudflare Container (`engine/Dockerfile`, `standard-2`: 1 vCPU, 6 GiB). One shared instance, asleep after 3 idle minutes, woken when someone joins a lobby or starts a solo game.
  - Measured: about 700k nodes/s on one core. A re-check (the best move plus up to 3 disputed picks, 2M nodes) takes about 3 s at depth ~30. With 8 boards (Classic), the depth is shared (at least 400k each), so a round stays a few seconds.
- **Online:** the lobby Durable Object re-checks the host's close calls on the server before the lobby uses them, so the server's numbers decide. The host's phone skips its own re-check only when the server answered its wake-up ping.
- The lobby remembers "the server answered" in memory only; if the lobby object sleeps and wakes mid-match, the host's own re-check is used until the next player joins (safe, rare during an active match).
- **Solo:** re-checks go to `POST /api/engine/score` first, falling back to the device's own re-check (lite at 700k nodes).
- **Cost:** Cloudflare's published rates are $5/month plus usage. A cap of 3000 re-checks a day (`ENGINE_DAILY_SEARCHES`) keeps the worst case around $25/month; past it, devices' numbers stand. A whole-match-on-server design would have been about 3.5¢ a match (memory while awake); the hybrid is well under 1¢.
- **Later, if traffic grows:** cache analysed positions (crowd games share their openings), spot-check devices' numbers against the server, and run more instances.
- **Verified locally:** with the container running under `wrangler dev`, an online Classic match made 17 server re-checks (0.6–3 s), and solo games 35 (median 1.2 s).

## The re-check of close calls (Oct 5, 2026)

The top-8 search gives each move about an eighth of 250k nodes, which is why close calls are noisy (`reports/judge-accuracy.md`).

- Picked moves that lose 5–60 points are searched again, the most picked first (up to 3), together with the best move, in one search restricted to them: 700k nodes on a device, 2M on the server. Those numbers replace the first ones.
- The range goes up to 60 so a sacrifice the quick search called a blunder gets a second look. If a rechecked move beats the best, it becomes the best.
- In the simulation (`judge-cuts.ts`), re-checking roughly halves the strong players cut unfairly with a device's engine, and the server-grade version cuts it about 7 times.

## Brilliant moves (Oct 5, 2026)

- A move is brilliant when, among at least 6 picks, the moves within 1.5 points of the best were found by at most 20% of the pickers, and everyone else gave away 8+ points on average (`brilliance` in `core/scoring.ts`).
- **Never with a power-up** (Eric): a power-up shows the engine's top moves, so those picks are flagged (`usedPowerUp` on the round's results, sent online too) and never count. The reveal still shows the move, noting that a power-up pick doesn't count.
- The reveal shows "‼ Brilliant move: Nxf7 · only 3 of 40 found it", in brighter colours if you found it.

## Elimination breakdown (Oct 5, 2026)

Eric wants eliminated players to see why, so they can learn rather than argue.

- **On the cut screen,** "Why was I cut?" opens it; on the results screen, "Why you went out" (or "Your game, move by move" for anyone).
- **It shows:**
  - your score against the last player through
  - the three moves that cost you most: your move, the best, how many found it, and your score for it
  - every move
  - any brilliant moves you made
- Tap a move to see the position with your move (red arrow) and the best (green).
- It's built from each reveal on your own device (solo and online alike), so no new server messages were needed.

## The cut as a judgement (Oct 5, 2026)

Eric's design:
- **The pawns:** every player is a pawn in a 10 × 10 grid, White's team on the left five columns and Black's on the right, in fixed seats so you can find yourself (gold ring). You wear your equipped hat; bots wear random ones (a hint of the shop); other online players have none for now.
- **The judge:** a gavel piece in the board's own piece style, on a wooden sound block.
- **The sequence:** the doomed pawns glow red, the gavel raises and slams at 1.5 s (two heavy wooden knocks, the piece sounds pitched down, and a small shake), and the cut pawns fade to grey. Pawns cut earlier stay faint.
- **Then:** the verdict, "Why was I cut?" if you're out, and the names.
- **Length:** 10 s (Crowd's `stageBreakSeconds`, was 4); quick pace (tests) keeps 4.
- **Eric asked whether a whole side could be wiped out:** not in 50 v 50, since every cut takes the same number from each team.

## Crates: Winter Crate · Series 1 (Oct 5, 2026)

Eric's design, a fun bonus for now: free and unlimited while testing, and fully compliant (odds shown, regional rules) if it ever involves money.

- **Three independent layers of rarity** (`core/crates.ts`):
  - **Tier, which decides the item.** The tier names honour Puzzle Pirates:

    | Tier | Item | Slot | Chance |
    | --- | --- | --- | --- |
    | Novice | Santa Beard | face | 42% |
    | Broad | Antlers | head | 26% |
    | Paragon | Santa Hat | head | 16% |
    | Sublime | Snowman, Present, Gingerbread Man, Chimney | skin, head, skin, skin | 14% in all (3.5% each) |
    | Fischer Random (a second spin) | Exalted Gift-Wrap Tube (weapon, 40%) or Candy Cane (weapon, 40%), Transcendent Fire & Ice Crown (head, 20%) | | 2% |

    So the crown is 0.4%.
  - **Colour:** Red 30%, Yellow 30%, Sage 14%, Opal 9%, Cobalt 7%, Midnight 4.5%, Emerald 3%, Oceanic 2%, Pearl 0.5%. Opal, Oceanic and Pearl have a two-tone sheen.
  - **Purity:** 100% minus a blemish of 0–49%, rolled as 49 × u^0.431. Shiny (blemish under 10%) is about 2.5% of rolls; under 1% blemish is about 1 in 8,000.
  - **Stacked:** a shiny Pearl crown is about 1 in 2 million; a Pearl crown at 99%+ about 1 in 400 million. A test of 100,000 rolls checks the proportions.
- **Slots:** head, face, skin and weapon (new: held at the pawn's side). Skins replace the pawn and combine with the rest (a Snowman in a Santa Hat). They show in the votes and on the cut screen, not on the game board. Other online players see your look (sent on joining, cleaned by the server). The old shop hats still show when no crate item is on the head.
- **Paint system** (`components/Items.tsx`), Eric's suggestion:
  - Each item is drawn once on the pawn's square with marked paint regions. Those get the colour automatically, then the blemish, then the shine; outlines and fixed parts (white fur, coal, ice) stay as drawn.
  - **Blemish:** a seeded noise field cut so exactly that share of cells is blotched; overlapping dark round blotches in one path, so even 100 pawns are cheap.
  - **Shine:** a sweeping highlight plus a sparkle.
  - The Fire & Ice Crown's flames burn in its rolled colour. The tube has tri-blend stripes (its colour, a light tint and white).
- **Server-side rolls.** Crates open on the server (`POST /api/locker/open`), and each item is stored with its colour, blemish and seed (D1 tables `items`, `equipped_items`), so nobody can make themselves a Pearl crown. A guest's items follow them when they sign in.
- **Opening:**
  - A CS:GO-style strip: decoy tiles by the odds, with Fischer Random shown three times as often as it lands to tease.
  - It eases out over 6.2 s with a click per passing tile, so the clicks slow as it lands.
  - Landing on Fischer Random shows a gold crown with "?", the "FISCHER RANDOM!" banner, and a second spin among Exalted and Transcendent items.
  - The reveal is an FF-style window (the God King's menu style) with the tier, name, colour, purity and "Shiny!".
- **Where:** Shop → Crates (with each crate's page of odds) and Shop → Locker (avatar preview, items rarest first, tap to wear or take off).
- **Shine, after Eric's first look:** the sparkle sat off to the side. Now a broad soft band of light rolls slowly across each painted region of a shiny item (CSS-animated, 4.2 s, then a pause), sized to the item itself so thin items like the tube get it too.
- **Sound, after Eric's first look:** the strip's clicks were silent on his iPhone. The app turned sound on only on the very first touch (a `pointerdown`), which iPhones don't count as a tap. Every tap now tries until sound is on, and the Open button turns it on directly.
- **Layers (Eric):** worn items are drawn in front of the piece (a hat's brim over the pawn's head, a weapon in front). Chessground gives every piece z-index 2, which had put the pawn over its items; the avatar now has explicit layers: items flagged `layer: "back"` (a cape, wings), then the piece or skin, then the rest. Items may rise at most about a tenth of a square above their square (a clip caps them).
- **Fitting items to the piece (Eric: the beard sat high, the party hat swallowed the head):**
  - Every piece has anchor points: where a hat's brim sits (a few points below the top of the head, like a real hat) and where a beard starts (the middle of the head). The pawn's are 25 and 40; the snowman's are 14 and 22.
  - Each head or face item names the line in its own drawing that meets its anchor (`ATTACH` in Items.tsx: the hat's brim, the beard's top edge), and the avatar shifts it there, on a pawn or a skin.
  - A new item needs only that number; a new skin, its anchors.
  - The old shop hats moved up 9 points to sit snug on the head too.
- **Four more items (Eric, Oct 5):** Present, Candy Cane, Gingerbread Man and Chimney.
  - **Odds.** Eric asked for the tier below Exalted to be "close to like 12–15% odds". I read that as the Sublime tier, now four items, at 14% in all (3.5% each). Reading it as each item at 12–15% would make Sublime about half of all drops, commoner than the Novice beard, which breaks the "each tier rarer" ladder. To make room, the beard, antlers and hat went from 55/25/12 to 42/26/16. The candy cane splits the Exalted share of Fischer Random with the tube (40/40), and the crown stays at 20% (0.4% overall). Each tier is still rarer than the one before.
  - **Present: two colours.** It's a helmet: the box covers the head down to the neck, with a bow on top. The box and the ribbon (and bow) each roll a colour with the usual odds, independently, so a matching pair is possible (red & red, about 9%). Items flagged `colors: 2` roll the second colour, stored as `color2`. D1 gets a new column, added once by `ALTER TABLE` on start-up. Both colours share one blemish, with separate blotches. Shown as "Red & Emerald".
  - **Candy Cane:** always white, striped in its rolled colour; held at the side like the tube.
  - **Gingerbread Man (skin):** the whole cookie takes the colour, as Eric suggested. White icing and a smile (chocolate icing on the black side), with red and green gumdrop buttons. Anchors: hat 15, beard 26.
  - **Chimney (skin):** the pawn itself, sitting in a chimney up to its chest. The bricks are always red with white mortar; the rolled colour paints the chimney's cap. The pawn is drawn in the skin, so the anchors are the pawn's.
  - All four were checked on white and black pawns, on the other skins, and with the other items worn.
- **Testing switches** (while `CRATES_FREE`): checkboxes on the crate page, or `?fischer=1` / `?shiny=1`, force Fischer Random and a shiny. The server ignores them once crates aren't free.
