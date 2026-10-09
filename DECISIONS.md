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
- **Speeds.** Now Normal (20 s), Variable (10 s rising to 30 s) and Bullet (10 s); Slow is gone. See "Pre-game vote overhaul (Oct 7, 2026)".
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

## The boss menu comes first (Oct 5, 2026)

Eric: when you take on the boss alone, the first thing should be choosing which boss to fight, with each one's strength alongside.

- **A menu, not a row.** "Take on the boss alone" now opens "Choose your boss": all ten bosses in one list, weakest first. Each row has the icon, the name, its skulls, its strength (1400 to 3190), and a coloured "vs you" (−100 green, ≈ your level gold, +300 orange, +500 and up red). A bar for each boss puts them all on one scale, with a line at your rating. A tap picks the boss and starts. The old scrolling row of cards on the home screen is gone.
- **Solo always fights a named boss.** "Match me" is gone from the solo menu. The boss it would have picked (the weakest above your rating) is tagged "your match", and it's highlighted the first time. After that, your last pick is highlighted. Your rating is your profile's engine rating, or 1500 if you're unrated, and the header shows which.
- **"Create a raid" opens the same menu,** plus "Match the group" at the top (the old behaviour: the weakest boss above the group's average, decided when the raid starts). I did raids too so there's one way to pick a boss, not a menu for solo and a row of cards for raids. Joining a raid by code skips it: the host picked.
- **`?boss=N` skips the menu** (for tests and links). The pick is kept on the device as before, and in memory too, for browsers without storage.
- Checked on a 390 px and a 320 px phone, light and dark. Ten rows fit without scrolling on an iPhone 13; on a 320 px phone the list scrolls inside the sheet.

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
  - **Tier, which decides the item.** The strip lands on a tier's present (colour-coded), which opens to one of that tier's items, each as likely as the others; or on Fischer Random (Eric, Oct 6). The tiers run Common to Mythic (renamed Oct 6 from the Puzzle Pirates names, which went to player ranks; entries below written before then use the old names):

    | Present | Chance | Items inside (slot) | Each |
    | --- | --- | --- | --- |
    | Common (grey) | 40% | Santa Beard (face), Beanie (head), Christmas Tree Tee (skin) | 13.3% |
    | Uncommon (green) | 26% | Antlers (head) | 26% |
    | Rare (blue) | 18% | Santa Hat (head), Ski Goggles (face) | 9% |
    | Epic (purple) | 14% | Snowman (skin), Present (head), Gingerbread Man (skin), Chimney (skin) | 3.5% |
    | Fischer Random (a gold crown, not a present; a second spin) | 2% | Legendary Gift-Wrap Tube (weapon, 40%) or Candy Cane (weapon, 40%), Mythic Fire & Ice Crown (head, 20%) | 0.8%, 0.8%, 0.4% |

    So the crown is 0.4%. (Before the presents, odds were per item: 16% each for the commons, 12% antlers, 8% hat.)
  - **Colour:** Red 30%, Yellow 30%, Sage 14%, Opal 9%, Cobalt 7%, Midnight 4.5%, Emerald 3%, Oceanic 2%, Pearl 0.5%. Opal, Oceanic and Pearl have a two-tone sheen.
  - **Purity:** 100% minus a blemish of 0–100%, rolled by bands (retuned Oct 5, below). Shiny (90%+) is 1 in 250; under 5% is 1 in 100; 80% of items land between 30% and 70%.
  - **Stacked:** a shiny Pearl crown is about 1 in 12.5 million; a Pearl crown at 99%+ about 1 in 1.25 billion. A test of 100,000 rolls checks the proportions.
- **Slots:** head, face, skin and weapon (new: held at the pawn's side). Skins replace the pawn and combine with the rest (a Snowman in a Santa Hat). They show in the votes and on the cut screen, not on the game board. Other online players see your look (sent on joining, cleaned by the server). The old shop hats still show when no crate item is on the head.
- **Paint system** (`components/Items.tsx`), Eric's suggestion:
  - Each item is drawn once on the pawn's square with marked paint regions. Those get the colour automatically, then the blemish, then the shine; outlines and fixed parts (white fur, coal, ice) stay as drawn.
  - **Blemish:** a seeded noise field, cut so exactly that share of the item itself is blotched (measured on its painted parts; see the fix below); overlapping dark round blotches in one path, so even 100 pawns are cheap.
  - **Shine:** a sweeping highlight plus a sparkle.
  - The Fire & Ice Crown's flames burn in its rolled colour. The tube has tri-blend stripes (its colour, a light tint and white).
- **Server-side rolls.** Crates open on the server (`POST /api/locker/open`), and each item is stored with its colour, blemish and seed (D1 tables `items`, `equipped_items`), so nobody can make themselves a Pearl crown. A guest's items follow them when they sign in.
- **Opening:**
  - A CS:GO-style strip: decoy tiles by the odds, with Fischer Random shown three times as often as it lands to tease.
  - It eases out over 6.2 s with a click per passing tile, so the clicks slow as it lands.
  - Landing on Fischer Random shows a gold crown with "?", the "FISCHER RANDOM!" banner, and a second spin among Legendary and Mythic items.
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
- **Purity, retuned (Eric, Oct 5):** shiny showed up too often, and purity now goes all the way to 0%.
  - **The odds** (`PURITY_BANDS` in `core/crates.ts`), even within each band, purity to one decimal:

    | Purity | Chance |
    | --- | --- |
    | 99–100% ✨ | 0.004% (1 in 25,000) |
    | 90–98.9% ✨ | 0.396% |
    | 70–89.9% | 9.6% |
    | 30–69.9% | 80% |
    | 5–29.9% | 9% |
    | 0–4.9% | 1% |

    So shiny is exactly 1 in 250 (was about 1 in 40), under 5% exactly 1 in 100, and an average item is about 50% pure (was about 66%). I picked 80% for "most between 30% and 70%", split the rest evenly above and below, and kept 99%+ as a 1-in-25,000 brag inside the shiny band. A band table, not a curve, so each number Eric names is one line to change; the crate page lists the same table.
  - **Shiny is 90.0% and up, as shown.** It was "blemish under 10", which made a 90.0% item not shiny, against Eric's "90%+". Only an item at exactly 90.0% changes.
  - **0% looks** blotched all over: the blotch colour over the whole painted part, a darker shade of its colour (red goes dark red, yellow mustard, Pearl a grey lavender). Blotches now also run past the square's edge (antler tips, the crown's flames), copying the nearest blotch inside, so those are covered too. The Present's bow knot became a painted part, so it darkens with the rest. Fixed parts (the candy cane's white, fur, ice) stay as drawn.
  - **Items people own keep their purity:** the stored blemish isn't touched (old rolls are all 51–100%), and their blotches keep their shape; only the parts past the square's edge and the Present's knot now pick up blotches too. Only the odds for new rolls changed.
  - **The strip's decoy tiles** already rolled their purity with the real roll, so they follow the new odds: about one shiny decoy every six opens, instead of about one per open (some 42 decoy items pass by in each open).
  - The fitting sheet (`npm run preview:items`) now shows cards at 95, 70, 50, 30, 5 and 0% purity (`purities=` to choose).
- **Blotches match the purity on the item (Eric, Oct 6: a 41.4% Exalted tube was almost fully covered):**
  - The blotch pattern was cut so that share of the *whole square* was blotched, so an item got whatever share of the pattern it happened to sit on. Measured over 120 patterns at 58.6% blemish: the tube was blotched anywhere from 11% to 100%, the beard, hat and scarf from 0% to 100%. Wide items averaged out; thin and small ones swung wildly. The old 51–100% range hid it.
  - Now the cut is measured on each painted part itself: the app samples the part's area (one point per square unit, once per item drawing) and cuts the same pattern where it covers exactly that share. The last blotch is drawn partway (a spot growing from its centre or, in a clean spot already ringed by blotches, closing in from the edge), so the share is exact rather than a whole blotch at a time. Now every item lands within about 3 points of its purity, usually within 1.
  - Same patterns, so owned items keep their look in shape; only how much of them is blotched now matches the purity shown. About 1 ms a pawn, as before.
  - A test checks the coverage on a thin tube over many patterns.
- **Three commons and two redesigns (Eric, Oct 6):**
  - **Odds.** Eric: make the three new items commons, "there should be more commons", and keep the odds worked out. Novice now has four items at 16% each (64%). Each tier must stay rarer per item than the one below, so the antlers went from 26% to 12% and the Santa hat from 16% to 8%. Sublime stays at 14% (3.5% each) and Fischer Random at 2%. Per item: 16, 12, 8, 3.5, 0.8 (Exalted) and 0.4% (Transcendent). A test checks that ladder.
  - **Beanie** (head): a plain knit beanie, crown and ribbed cuff, in its colour. No bobble, so it doesn't compete with the Santa hat.
  - **Ski Goggles** (face, two colours like the present): the frame and strap in the colour, the lens in a second colour at 60% opacity, so the face shows through, with a glint. Outlines are thinner than usual (1.6, not 3): at the usual width they swallowed the frame on a pawn-sized avatar.
    - Goggles go at the eyes, which no anchor marked (the face anchor is where a beard starts, well below the eyes on the pawn). Pieces now have an `eyes` anchor too (pawn 29, snowman 18, gingerbread 21), and an item can name the anchor it meets (`ATTACH_TO`).
    - They're a face item so they can be worn with a beanie, and they're drawn over a hat (`OVER_HAT`). Other face items still go under it: the present's box covers the top of a beard.
  - **Christmas Tree Tee** (a skin): the pawn in a T-shirt with a printed tree. Only the bulbs take the colour. The shirt is white on the white side and charcoal on the black side (pure black disappeared on the black pawn). A skin, like the chimney, because a shirt fitted to the pawn wouldn't fit the snowman or the gingerbread man. So it doesn't combine with them; a separate "body" slot could do that later.
  - **Present: a visor.** An oval cut out of the box's front at face height, with a hint of glass and a glint. The ribbon stops above and below it. You see the face through it: the pawn's head, the snowman's eyes and nose, the gingerbread face.
  - **Chimney: bricks in the colour.** The bricks and the cap take the colour. The mortar is a shade of it (lighter on dark colours, darker on light ones such as yellow and Pearl), so the bricks still read. The whole chimney now blotches. Owned chimneys change with it.
  - The fitting sheet takes `with=` to wear other items too (goggles over a beanie).
- **Presents by tier (Eric, Oct 6):** "the crate opens thematic": the strip holds colour-coded presents, one per tier, and Fischer Random (2%, the only tile that isn't a present). A present opens to one of its tier's items, split evenly.
  - **The present odds** (40/26/18/14/2): Eric said the rest of the 98% is "split between the other rarities". I read that as a ladder, each colour rarer than the one below (an even split would make a purple present as common as a grey one). Sublime stays at Eric's earlier "12–15%" (14%, so its four items keep 3.5% each), and Novice, Broad and Paragon step down from there.
  - **A side effect to know:** Broad holds one item, so the antlers (26%) are likelier than any single Novice item (13.3%). Adding Broad items spreads that out.
  - **Ski Goggles moved to Paragon (Eric, Oct 6),** next to the Santa hat: 9% each. The Novice present now holds three items, 13.3% each.
  - **Opening:** the strip spins to a present; the present shakes and bursts ("Common present", in its colour, 1.1 s); then the reveal. Fischer Random is unchanged (banner, a 4.8 s second spin among its items). The strip still shows Fischer Random three times as often as it lands, to tease.
  - **No second spin for presents (Eric, Oct 7):** at first a present holding several items had a second, shorter spin among them, and a one-item present (the Uncommon antlers) went straight to the reveal. Eric liked the straight-to-reveal one ("quicker, and it looks nicer"), so every present does that now; only Fischer Random spins again.
  - **Leaving during the spin (Eric, Oct 8):** the item is yours as soon as the server rolls it, but leaving the crate screen mid-spin used to lose the show, and coming back started over. Now the result is kept as "not seen yet" (on the device, and in memory if storage is off) the moment the server answers, and coming back to Crates opens straight to its reveal card, once; the reveal clears it. It's dropped if that item's gone from your locker (deleted).
- **The locker: stacks, hold to delete, and the free items (Eric, Oct 8):**
  - **Stacks.** Copies of the same item in the same colour (both colours, for the present and the goggles) show as one tile with "×3" in the top right. The purest copy is the one shown, and the one you wear when you tap the stack. Stacks sort like single items did (rarest, rarest colour, purest).
  - **Hold to delete** (about half a second; right-click on a computer), then a confirmation: "It's gone for good." A single item: Delete or Cancel. A stack: delete the extras and keep the best, delete all, or Cancel. If the copy you wore goes, the one you keep goes on. Moving your finger (a scroll) cancels the hold, and the phone's own long-press menu is off on items. The server deletes only your own items (`POST /api/locker/delete`) and takes them off first.
  - **One place to wear things (Eric).** Pawn hats and God King effects were bought *and* equipped in the Shop tab, so a hat you owned wasn't in your locker and stayed on when you took a crate hat off. Now the shop sells them (as before; free while testing) and says "In your Locker ›" once you have one; the locker lists what you got under "From the shop" (with a God King filter), next to the crate items, and that's where you wear or take off everything. The Shop tab keeps all three categories (God King effects, pawn hats, chat packs); "No hat" isn't for sale (you take a hat off in the locker). Shop items can't be deleted for now (no refunds yet).
  - **One head.** A pawn hat and a crate head item used to be worn at once, the shop hat showing whenever the crate one came off. Now wearing either takes off the other (on the server, both ways), and taking one off leaves the head bare. A God King effect is always on (tapping another switches it). Someone already wearing both from before sees the pawn hat as "Worn" in the locker once the crate hat comes off, and can take it off there.
  - **The crate page** lists the presents with their odds (and how many items each holds), then every item with its own chance.
  - Server rolls: the tier, then an item evenly from that tier's present (`presentItems`). Nothing stored changes.
- **Tier names: Common to Mythic (Eric, Oct 6):** "I kind of just want to revert to a common, uncommon, rare, etc.
  style." The Puzzle Pirates names move to the player rank ladder (the hub's work), so the items no longer use them.

  | Was | Now | Colour (unchanged) |
  | --- | --- | --- |
  | Novice | Common | grey |
  | Broad | Uncommon | green |
  | Paragon | Rare | blue |
  | Sublime | Epic | purple |
  | Exalted (Fischer Random) | Legendary | gold |
  | Transcendent (Fischer Random) | Mythic | red |

  - **Legendary and Mythic for the two Fischer Random tiers,** not Eric's "mythic and unknown": "Unknown" on a tier pill
    ("Head · Red · 80% pure · Unknown") reads like missing data. Legendary then Mythic is the ladder players already
    know, and keeps his "Mythic" at the very top. Swapping in "Unknown" is a one-line change in `TIERS` if he prefers it.
  - **The ids changed too** (`common` … `mythic`), so the code doesn't keep names that are now player ranks. Nothing
    stores a tier: the locker stores the item (`def`) and the tier comes from `ITEM_DEFS`, as do looks sent to others
    online. No migration; owned items show the new names at once.
  - Odds, items and art are unchanged. A test pins the six names, their order (the locker sorts by it) and colours.

## The God King's Last Stand (Oct 5, 2026; built)

Eric's idea: when the God King has nothing left to give, he still has himself. Once per game, if the crowd plays a
disastrous move, he dives onto the board, takes the blow meant for that piece, and falls. The move is undone. The
director's design (Oct 5) set the beats; Eric then changed the rule: always armed, a bar that eases off as the game
goes on, and an early hung queen or piece in a solo raid must set it off.

**The rule** (`lastStandBar` and `lastStandDue` in `core/boss.ts`, the runner's `lastStandFor`; numbers in settings.ts):
- **Where:** every boss battle (the 50 v 50 boss final and the boss raid), solo and online.
- **Always armed, once per game,** whether or not he still has charges. If he falls with charges left, he leaves them
  to the crowd: every player still in gets that many ⚡ power-ups (Eric, Oct 7; see "The Last Stand, after Eric played
  it" below). No menu, no crowns. The charges he fell with are recorded on the battle (`lastStand.charges`).
- **A disaster:** the crowd's played move gives away at least the bar, in points of expected score against the best
  move, by the judge's own numbers for that round (after the re-check; the same numbers that score the picks).
- **The bar eases off:** `lastStandLoss` 30 on the first crowd move, plus `lastStandChargedExtra` 5 while he still
  has charges, falling in a straight line to `lastStandLossFloor` 13, reached after `lastStandDecayMoves` 22 crowd
  moves without one. So 35 → 18 with charges, 30 → 13 without.
- **Not when it's already lost:** the best move was worth at least `lastStandFrom` 40. A lost endgame never sets it off.
- **Not when the God King plays the move himself** (he plays the best move).
- **Fair:** the round's scores stand (whoever picked the blunder still loses for it; the judge's verdict is never
  changed), and the re-pick is an ordinary scored round.

**What happens:**
- The move isn't played. The board, the crowd's move count and the boss's turn are as before it: it's still the same
  crowd move. The boss's strike waits until the re-pick has been played (then it weighs both rounds' picks), so
  nothing comes between his fall and the re-pick.
- The crowd picks again from the same position with a fresh clock. The move he took back is barred: a grey arrow
  with ✕ on the board and "✕ Nxe5" in the status; the board won't play it, the server rejects it, no bot picks it,
  and it isn't the best move on offer in the re-pick either.
- He has fallen: his figure lies in the dock for the rest of the battle, toppled on his side like a beaten chess piece,
  armour cracked, crown and sword on the ground, greyed. No menu, no crowns, no more lines. Above him, a ⚡ button
  with the power-ups he left (Oct 7).
- On the result screen he rises again in holy light ("A god does not stay down.") if the crowd won. If it lost or
  drew, he stays down, without a word.
- Online, the reveal carries the Last Stand and the battle as it now stands (`lastStand`, `boss`), so every screen
  plays it at once; each round message carries the battle too (the barred move); the host's bot picks and scoring
  leave the barred move out.

**The moment** (`LAST_STAND` in `chess/boss-timing.ts`, ms after the blunder lands on the board; the reveal lasts
`LAST_STAND_MS` = 9,900 ms longer, solo and online, and the next move's clock only starts after it, so nobody loses
any time). Updated Oct 7: a 1,300 ms warning comes first, everything after it 1,300 ms later, and nothing flashes white.

| Beat | From (ms) | What |
| --- | --- | --- |
| 0. Warning | 0, for 1,300 | A red "??" badge pops on the piece's square (80 ms), the square pulses red three times under the piece, a danger sting plays, the eval bar plunges to the crowd's chances after the move, and the dock says what it loses in plain words. |
| 1. Freeze | 1,550 | A dark red pulse; the board goes cold and grey. |
| 2. Leap and crash | 1,950 / 2,450 / 2,700 | He leaps up out of the dock (450 ms), falls onto the piece's square in a gold streak (250 ms), and lands at 2,700: a dark red shockwave with an orange ring, dust, the board shakes (450 ms). The piece is knocked aside; the badge goes. |
| 3. Banner | 3,250, for 2,100 | "LAST STAND", his battle-worn portrait and one of his lines (the same on every screen for the move). His usual cut-in is 1,500 ms; this one is held longer so the line can be read. Its flash is dark red. |
| 4. Slide back | 5,450, for 450 | The piece slides back to its square; he stands alone where it was. The eval bar goes back to what it was. |
| 5. The blow | 5,950 to 7,950 | 25 slashes, one every 80 ms, each a red-white cut with a red damage number (6 to 14, seeded by the move) spiralling off around him; his armour cracks at 6,350, 6,950 and 7,550; grunts of agony at the 2nd, 11th and 20th slash; four stylised red drops. |
| 6. Fall | 8,100 / 8,550 / 9,100 | He staggers, collapses onto his side with a death groan, and fades from the board (500 ms). His fallen figure appears in the dock with his last words: "Finish… it… for me.", and the ⚡ power-ups he left beside him. |
| 7. Re-pick | 9,900 | The reveal ends; the crowd picks again. |

**Measured: an early hung piece sets it off** (`packages/sim/scripts/last-stand-blunders.ts`). 30 real raid starts
(named openings, 10 plies in), a few sensible moves played on to crowd moves 1 to 10, then a move that hangs the
queen or a minor piece, judged as a phone judges (top 8 at 250k nodes, re-checked at 700k): 30 of 30 crossed the bar.
The judge gave a hung queen 50 to 62 points and a hung minor piece 47 to 53, against a bar of at most 35. Unit tests
do the same with the real engine for three of them (Qg4 in the Open Sicilian, Ne4 in the QGD Exchange, Bh6 in the
King's Indian Fianchetto) against the 3190 boss on crowd move 1. Online, a one-player raid lobby: Bb5, hanging the
bishop to a pawn on move 1, was scored 52.6 by the host's engine, and he made his Last Stand.

**Measured: how often** (`packages/sim/scripts/last-stand-sim.ts`, `reports/last-stand.md`). Bot crowds against the
real boss (its strength, slips and blunder guard), every crowd move judged as the game judges it, the rule tried
afterwards (once per game, so a game up to its first one is the game as played). Solo crowds are one player
(strong, club or casual: a skill and a share of random moves) who keeps all three charges (the higher bar all game);
the 50 v 50 final is ten bots with two charges, which the bots spend whenever the popular move loses 6+.

| Crowd | Boss | Games | With a Last Stand | Crowd moves it came on |
| --- | --- | --- | --- | --- |
| One casual player (solo raid) | 1400 | 8 | 5 (63%) | 1, 1, 3, 7, 22 |
| One casual player | 1800 | 8 | 6 (75%) | 2, 2, 3, 3, 5, 7 |
| One club player | 1800 | 8 | 4 (50%) | 4, 8, 15, 40 |
| One club player | 2200 | 8 | 4 (50%) | 6, 7, 9, 16 |
| One club player | 2600 | 8 | 4 (50%) | 10, 10, 19, 59 |
| One strong player | 2600 | 6 | 3 (50%) | 2, 8, 12 |
| Ten club bots (50 v 50 final) | 2000 | 8 | 5 (63%) | 25, 29, 29, 32, 52 |
| Ten expert bots (50 v 50 final) | 2600 | 6 | 1 (17%) | 42 |
| **All** | | **60** | **32 (53%)** | |

- **About 0.5 per game overall** (53%): once every other raid for most crowds, more for casual players (who hang pieces
  early), less for a strong ten-player crowd (whose popular move rarely blunders while it's still in the game).
- **The floor and its pace barely matter here.** While the crowd isn't lost yet, its moves are almost all either
  fine or a piece-sized disaster: 92% gave away under 5 points, 3.4% gave away 30 or more, and only 2.5% fell
  between 12 and 30. A mid-sized mistake (12 to 30 points, half a pawn to a pawn) mostly tips the position under 40
  at once, after which nothing sets it off. Any floor from 10 to 18 and any pace from 15 to 30 moves gave 52 to 55%
  (the grid in the report), so 13 and 22 sit in the middle of Eric's ranges. The lever that would change it is
  `lastStandFrom` (or the starting bar), which Eric set.

**Art, sounds and lines:**
- **Sprite:** his figure is now drawn from parts (body, crown, sword), so there is a cracked variant (three levels,
  dark jagged splits with a bright chipped edge) and a fallen pose (the same figure toppled on its side, crown knocked
  off, sword on the ground). White and black, armour only, like the rest of him. A dev sheet shows them all:
  `node scripts/preview-god-king.mjs out.png banner=1 epilogue=rise`.
- **Portrait:** `god-king-portrait-hurt-w.png` and `-b.png` (from `scripts/god-king-portrait.py`; the usual portraits
  are unchanged byte for byte): cracks across the helm, a cheek plate, both pauldrons and the chest, a crown spike
  broken off, the cape's hem torn, embers among the sparks, and three small stylised red drops.
- **Sounds** (`public/sounds/god-king/last-*.mp3`, CC0, credited there; cut by `scripts/god-king-last-stand-sounds.py`):
  the leap (a heavy jump into a falling whistle), the crash, the 25 slashes (one 2 s flurry of sword swishes landing
  with hits), two grunts of agony and the death groan, from the same two packs as his other sounds.
- **Lines** (`godKing.ts`): the banner's "Fall back! This blow is mine.", "Not while I stand!", "Retreat — I'll hold
  the line!" and "Go! I'll take it from here."; his last words "Finish… it… for me."; and "A god does not stay down."

**Calls I made:**
- **The taken-back move doesn't count as a crowd move,** and the boss's strike waits for the re-pick: otherwise the
  move counter jumps by two and a strike could land between his fall and the re-pick.
- ~~**The eval bar holds still** through it~~: reversed on Oct 7 (Eric): it plunges during the warning, then goes back.
- **His crowns stay on screen until he leaps,** although the charges are already gone: losing them is part of his fall.
- **A king move taken back** just slides back (the king is never taken off the board, even for a moment).
- **The re-pick can be brilliant** like any round: it's the crowd's own choice, not a power-up.
- **Test switches** (solo): `?laststand=1` makes the battle's next crowd move set it off whatever it is (unless the
  God King plays it), for screenshots and the e2e test; Eric can just blunder a piece instead. `?side=b` plays a solo
  raid as Black, to see the black God King.

## A crowd of one keeps its move on the board (Oct 6, 2026)

Eric: in a solo boss raid, a moved piece jumped back to where it was, then moved again about 1.5 s later.

- In Crowd mode your pick is a vote, shown as a ghost over the unchanged position until the reveal moves the winner.
  With a crowd of one (a solo raid), your pick *is* the move, so the snap-back and the second move were pointless.
- Now, when you're the only one picking, the piece stays where you put it, and the reveal starts with the move
  already played: no ghost and no vote count. The God King's lines, the boss's reply and a Last Stand all play as
  before; a Last Stand now starts from the piece already on its square.
- Crowds of more than one are unchanged.
- How it was found, and the rule that follows: `.claude/LESSONS.md`.

## The front door: home, queue, profiles (design, Oct 6, 2026; to build)

Eric approved the mockup as drawn ("I like exactly how you have it"): the canvas "HunChess front door" in his
Artifacts. Its source is in `docs/mockups/front-door/`: `Main.dc.html` (home), `Queue.dc.html`, `Profile.dc.html`.
The `hub` delegate builds it. Phone layouts as in the mockup; desktop as below.

**Home**
- **Top bar:** the "Hun**Chess**" logo ("Chess" in gold), the coin balance, and your dressed pawn in a gold ring. The
  pawn opens your profile.
- **Live line:** a green dot, "N online · M matches running · Q in queue", from the server and refreshed every few
  seconds. Online = connected in the last minute, anywhere in the app.
- **Your dressed pawn**, large, with your name, rank and what you're wearing.
- **Mode picker** (Crowd 50 v 50 / Boss raid / Classic "coming", while Classic is being reworked). The line under
  PLAY changes with it, e.g. the typical wait.
- **PLAY**, big and gold, joins the queue for that mode.
- **Four smaller buttons:** Play with friends (the private code lobbies), Boss alone, Shop & crates, Profile.

**Queue (no lobby screen for matchmade games)**
- PLAY puts you in the queue: the existing "Play now" matchmaker underneath. The waiting screen replaces the lobby
  screen for matchmade games. Private code games keep the lobby.
- **Shows:** "38 / 100", a progress bar, "Finding players · N s, then bots fill the rest", and a 10 × 10 grid of seats.
  Each joined player's dressed pawn pops into the next seat. Yours is first, ringed in gold, with "You're in · seat 1"
  below.
- **The pop (Eric):** each new pawn scales up past full size, then settles (about 0.35 s, a springy overshoot), with a
  short soft "pop" sound. When many join at once, the pops are staggered about 40 ms apart and the sound is
  rate-limited, so 30 joins never become 30 overlapping sounds. Respect the mute switch.
- **When the 60 s runs out,** bots fill the empty seats as plain pawns: a quick cascade, quieter pops.
- **Cancel** leaves the queue and goes home.
- **Phone:** the grid fills the panel's width, so pawns are about 30 px. **Desktop (Eric):** the grid gets most of the
  screen, so pawns are 60–80 px. The joining is the show.

**Profile:** one structure for everyone, opened by tapping your pawn or any name (leaderboards, cut screen, results).
- **Header:** dressed pawn (large), name, online now or last seen, joined month, rank tier and rating, percentile.
- **Wearing:** each equipped item drawn as it looks (crates' `ItemArt`: its colour, blotches and shine), slot,
  colour, purity (and "Shiny"), and a tier pill in its tier colour. (Eric, Oct 6: the mockup's plain colour swatch
  read as "just coloured shapes, not the item itself". A shop hat shows on its pawn.)
- **Stats:**
  - Mode tabs (Crowd / Boss raid).
  - Crowd: games, wins, average place, best finish, cuts survived %, brilliant moves.
  - Boss raid: raids, bosses beaten, strikes, Last Stands, survived %, brilliant moves.
  - Only stats the server really records. Add what's missing, or leave it out.
- **Rating chart:** the last 30 games.
- **Bosses beaten:** the 10 tiers, lit gold once beaten.
- **Recent matches:** place, mode, best move, when.
- **Yours only:** Edit name & icon, Open locker (and settings and sign-in where they live now).
- **Someone else's only:** Report, and "Add friend" greyed out until friends exist.
- **Never shown to others:** email, sign-in method, anything private.

**Desktop (Eric: "similar to the chess sites, our own style")**
- At 1024 px and wider, a three-column frame:
  - a **left side menu**: logo, Play, Boss alone, Play with friends, Shop & crates, Profile, then settings
  - the **centre** for the screen itself
  - a **right panel**: the live line, a "playing now" list of running matches (mode, players left, a watch link
    where spectating exists), and later a leaderboard
- The home screen's centre: your pawn and PLAY, side by side.
- The game screens keep their current desktop layout; only the front door changes.

**Phone or app store?** The website is the app.
- It already installs to the home screen like an app (manifest, icons, offline shell, install prompt) and runs full
  screen. No app-store app is needed now.
- Later, an app-store listing can wrap the same site for discovery or push notifications, with no rewrite.
- Keep everything working in the browser first.

### Built, step 1: home and the live line (Oct 6, 2026)

The `hub` delegate's calls while building the home screen. The layout, sizes, colours and copy are the mockup's;
every number on it comes from the server.

- **Online** means an account the server heard from in the last minute (`FRONT_DOOR.onlineWindowMs`).
  - Any request from the app counts. A front-door screen asks for the live line every 5 s; every other screen (a
    match) says "still here" every 30 s; a hidden tab says nothing.
  - It's stored as `users.last_seen` in D1 (indexed, and written at most every 15 s per account). No new Durable
    Object: nothing runs, or bills, between requests.
- **Matches running** are online lobbies (Play now and private) in a match with someone still connected. Each lobby
  reports itself to a D1 table, `live_lobbies`, when something on the line changes (a join, the start, a cut, the
  end) and at least once a minute while it runs. A lobby silent for 3 minutes drops out.
  - Solo games against bots aren't counted: no server sees them. Their players still count as online.
- **In queue** is the people waiting in Play now lobbies, both modes.
- **The line under PLAY:**
  - Crowd: "Usually about N s to find a match", the median wait of the last 20 matchmade starts in the past week
    (each lobby records its people's average wait when it fills). Until there's any history: "Starts within 60 s;
    bots fill any empty seats".
  - Boss raid: the mockup's "Join a raid; the boss matches the group".
  - Classic: "Classic is being reworked", and PLAY is greyed out.
- **PLAY in Boss raid joins a raid queue** (new): the same matchmaker as 50 v 50, a lobby of up to 50 that fills for
  60 s, no bots, and the boss is the weakest that's stronger than the group's average rating.
- **Guests, where online play needs signing in:** PLAY plays 99 bots (Crowd) or opens the boss menu (Boss raid), and
  the line under PLAY says so, with "Sign in to play online".
- **Under your pawn:** your rank and rating ("Weighty · 1612") and what you wear. "No rating yet" until a match
  gives you one.
  - There's no ranked rating yet, so the rank comes from the engine rating your profile already has (the one the
    boss raid uses). Ranked can swap the number underneath later.
  - (Built first as Bronze to Grandmaster with divisions; replaced the same day by the rank ladder, below.)
- **Where the old home's parts went:**
  - The name box is gone: you play under your profile's name.
  - The options (practice, pace, 50 v 50 or everyone moves, animations, motion trail, pre-game votes, opening moves,
    sound, the sound lab) moved to **Settings** (`/settings`), with the rules ("How to play"), the install card,
    sign-in and the Stockfish credit.
  - Lobbies with a code, and solo practice against 99 bots, are in **Play with friends** ("or practise alone"). An
    invite link opens it with the code filled in.
- **Fonts:** Archivo and Archivo Black are self-hosted (`public/fonts`, OFL).
- **The profile's new stats start recording now** (more in step 3), so there's real data by the time the profile
  shows them.

### Built, step 2: the queue (Oct 6, 2026)

- **PLAY goes straight to the queue screen** (no lobby screen): "38 / 100", the bar, "Finding players · N s, then
  bots fill the rest", and a 10 × 10 grid of seats (10 × 5 for a raid, "then the raid begins"). Private lobbies with
  a code keep the lobby screen.
- **Seats:** yours is seat 1, ringed in gold, then everyone else in the order they joined, then the bots. Each
  person's dressed pawn arrives with them (the lobby sends each look once; the item-builder's `Avatar` draws it).
- **The pop:** a pawn scales from small up to 124%, back to 92%, a touch over 100%, and settles, in 0.35 s.
  - Pawns arriving together start 40 ms apart; the pop sound plays at most every 70 ms however many arrive, and
    only with sound on (the mute switch sits in the header's empty corner).
  - The sound is synthesised: a short sine that drops in pitch, like a bubble, with a little tap; its pitch varies
    a little so a run of them isn't mechanical. Bots get the same at under half the volume.
  - Your own pawn pops first when you arrive, then everyone already there, 40 ms apart.
- **When time's up,** the server fills the empty seats with bots and holds the full grid for 1.8 s
  (`FRONT_DOOR.fillShowMs`) before the votes begin, so the bots' cascade (spread over that moment) is seen on every
  phone. A raid has no bots: it begins.
- **Cancel** (and the back arrow) leaves the queue and frees the seat.
- **Phone:** the grid fills the panel's width: about 30 px pawns on a 390 px phone. **Computer:** the grid takes the
  height of the window beside a column with the count, the bar, your seat and Cancel: 65-75 px pawns at 1280-1440
  px wide.
- **Empty seats** are small dots; a seat's dot stays until its pawn pops in, then fades.
- **Tests run separate queues:** `?pool=NAME` on the page sends PLAY to a queue of its own (any lowercase name), so
  e2e tests running side by side don't land in each other's lobbies.
- **Checked frame by frame** with `npm run frames:queue` (`scripts/frames-queue-pop.mjs`; the Worker must be running).
  It slows the animations 10×, saves the grid every ~100 ms and logs every seat's scale per frame:
  - each pawn grows from 0.15 to 1.24, dips to 0.92, rises to 1.04 and settles at exactly 1, once (no pawn pops
    twice or jumps);
  - two arriving together start apart (the second a frame behind);
  - when time's up, the bots' cascade runs row by row in about 1.2 s, and the votes begin 1.8 s after the fill.
  - (Found and fixed in step 4: a pop still waiting its turn could jump ahead if someone else arrived meanwhile, as
    the grid redrew with a shorter delay. Each pawn's delay is now fixed when it arrives; checked with three arriving
    at once.)

### Built, step 3: profiles (Oct 6, 2026)

- **One screen for everyone**, the mockup's structure. It opens from your pawn or Profile on the home screen, and
  from any name: the leaderboard beside the board and the full leaderboard sheet, the cut screen's list, the results
  (the winner, the most dangerous players), the final, a private lobby's list, and a person's pawn in the queue.
  - The small leaderboard under a phone's board keeps its own tap (it opens the full sheet, where names work).
  - Outside a match a profile is a page (`/profile` for yours, `/profile/ID` for anyone's). During a match it opens
    over the game, which goes on underneath.
  - A bot's name opens a bot's card: bots fill empty seats and have no profile.
- **What anyone can see** (`GET /api/profile/ID`): name, what they wear, online now or last seen, the month they
  joined, tier and rating, "Top N%", the stats, the rating line, bosses beaten and recent matches. **Never**: email,
  sign-in method, whether they're a guest, or their pixel icon. Profiles are found by account id, which other players
  only see in a lobby or match they share (ids are random, so profiles can't be listed by guessing).
- **Top N%** ranks your latest rating among every account's latest rating. It shows once 10 or more accounts have a
  rating (`FRONT_DOOR.percentileMinPlayers`), so the first players don't see "Top 100%".
- **Stats, all from stored results:**
  - Crowd: games, wins, average place (shown rounded, as a place), best finish: from results, as before. **New:**
    cuts survived (%) and brilliant moves.
  - Boss raid: raids. **New:** bosses beaten (different tiers won), strikes survived (the boss's strikes that took
    someone else while you stood; I read the mockup's "strikes" this way and labelled it so), Last Stands (raids in
    which the God King made his Last Stand), survived (% of raids you were still standing at the end) and brilliant
    moves.
  - The new ones are recorded from today on. A stat counts only results that have it, and shows "—" when none do,
    so nothing is invented for older matches. Bosses beaten likewise counts only raids recorded with their boss.
  - Online, the server records them: the lobby notes each person's brilliant moves and best pick every round. Solo
    games are recorded by the browser, as before.
  - **Best move** in a match: a brilliant one if any, else the pick that beat the field by most (the highest round
    score).
- **The rating line:** the rating after each of the last 30 rated matches, any mode: the same number as the header's.
- **Recent matches:** the place (Won, Lost, Out or Draw for a raid), the mode ("solo" for games against bots, the
  boss's name and strength for a raid), the best move and when.
- **Yours only:** Edit name & icon (your name, and the pixel icon builder), Open locker (the shop's locker tab), the
  settings (the gear, and a link at the bottom), and signing in for a guest.
- **Someone else's only:** Report (Cheating, Name or Something else), stored in D1's `reports` for a person to read
  (`SELECT * FROM reports ORDER BY at DESC`); one per player per reporter a day, 20 a day per reporter. "Add friend"
  is there, greyed out "(later)".

### Built, step 4: the computer's frame (Oct 6, 2026)

- **At 1024 px and wider, three columns** (front-door pages: home, profile, settings, the shop):
  - **Left, the side menu:** the logo, Play, Boss alone, Play with friends, Shop & crates, Profile (with your
    pawn), and Settings at the bottom. The page you're on is marked with a gold bar. Play is the home screen (PLAY
    lives there); Boss alone and Play with friends open the home screen's boss menu and sheet.
  - **The centre:** the page. Your pawn and PLAY sit side by side from 1280 px (stacked, as on a phone, from 1024 to
    1279, where they don't both fit); a profile goes to two columns from 1280 px.
  - **Right, the live panel:** the live line (one number to a line) and **Playing now**: each running match's mode
    (and the raid's boss), players left and how long it's been going. No names, nothing a stranger couldn't see from
    outside.
  - **No watch links yet:** nobody outside a match can watch it (only knocked-out players inside it can), so the
    list says watching comes later. A leaderboard can join the panel once ranked exists.
- **The queue keeps the whole window** (no menu or panel): the grid is the show, and a menu click there would have to
  mean leaving the queue. Private lobbies and every game screen keep their own layouts. (Replaced Oct 8: the queue
  fills in place on the home screen, below.)
- **Phones** (below 1024 px) never see the menu or the panel: one column, as in the mockups.

### The rank ladder (Eric, Oct 6, 2026)

- **Fourteen ranks, Puzzle Pirates' skill ladder** (the names honour it): Novice, Neophyte, Apprentice, Narrow,
  Broad, Solid, Weighty, Expert, Paragon, Illustrious, Sublime, Revered, Exalted, Transcendent. No divisions: the
  label is the name ("Weighty · 1612"). They replace Bronze to Grandmaster, on home and on profiles.
- **Fixed cutoffs, in 50s** (`RATING_RANKS` in settings.ts), aimed at the spread Eric asked for. The assumption: our
  ratings spread like chess ratings, centred on 1500 with an SD of 350. Nothing better exists yet: the sim reports
  model bot crowds, not people, and a new player's rating starts at 1500 and is pulled towards it for the first
  moves. Once real ratings are stored in numbers, refit the cutoffs to them (change `from` in settings.ts).

  | Rank | From | Asked | Gets (1500 ± 350) |
  | --- | --- | --- | --- |
  | Novice | 0 | 5% | 5.8% |
  | Neophyte | 950 | 7% | 6.9% |
  | Apprentice | 1100 | 9% | 11.1% |
  | Narrow | 1250 | 10% | 9.7% |
  | Broad | 1350 | 11% | 10.9% |
  | Solid | 1450 | 12% | 11.4% |
  | Weighty | 1550 | 11% | 10.9% |
  | Expert | 1650 | 10% | 9.7% |
  | Paragon | 1750 | 9% | 7.9% |
  | Illustrious | 1850 | 7% | 5.9% |
  | Sublime | 1950 | 5% | 5.6% |
  | Revered | 2100 | 2.5% | 2.7% |
  | Exalted | 2250 | 1.2% | 1.3% |
  | Transcendent | 2450 | 0.3% | 0.3% |

  A band of 50 holds about 5.7% of players near the middle, so the middle ranks can't land closer than a point or
  two; the cutoffs are the set of 50s nearest the ideal that fits best overall. A unit test holds the shares near
  these, so a change to the cutoffs or the assumption is a deliberate one.
- **Colours climb:** dull grey and stone at the bottom, then clay and copper, olive, greens, teal, sky blue, periwinkle
  and violet. The top three stand out: **Revered** is gold with a gold ring and a sheen, **Exalted** fire orange with
  a ring and a glow, **Transcendent** a slowly moving rainbow with dark text (held still for anyone who asks for reduced motion). On home
  the rank's name takes its colour. Every pill reads at 4.5:1 or better in both themes, and a unit test checks it.
- **Item tiers get their own names** (Common to Mythic, the item-builder's change alongside this one), so a rank never
  reads like an item's rarity.

### Light and dark, a switch (Eric, Oct 8, 2026)

Eric, on his computer: "why the sun next to the settings button? it does nothing … I also don't see a light dark mode
toggle". The "sun" was Settings' icon; nothing in the app could change the theme (it followed the device only).

- **The sun is the switch** (`ThemeButton`, `theme.ts`): a bright gold sun in light mode, a black sun with a gold rim
  in dark mode (Eric: "when you click the sun, it switches to a black sun, and then it makes it dark mode"). A tap
  shows the other theme and remembers it on this device (`brc.theme`). 44 px, `aria-pressed` = dark.
  - **Computer:** its own small round button in the side menu, just above Settings. Settings now has a real gear (the
    profile's).
  - **Phone:** the home's top bar, before your coins and pawn.
  - **Settings → Theme:** Match device / Light / Dark. Match device is the default until someone picks, and follows
    the device live (switching the phone to dark at sunset switches the app).
- **No flash of the wrong theme:** a few lines in `index.html`'s `<head>` set `<html data-theme>` before the first
  paint, from the pick or the device. `theme.ts` keeps it in step afterwards by the same rules; a unit test runs the
  inline script against `theme.ts` for every case (picked, not, junk, no storage, no media queries).
- **One rule for light in the stylesheet:** the page always carries the theme it shows (`data-theme="light|dark"`),
  so every light rule is `:root[data-theme="light"] …`. The old `@media (prefers-color-scheme: light)` blocks (the
  base colours, the front door's, the rank pills, quick chat's bubble and page chat) became that. Before, a light pick
  on a dark device would have missed them; quick chat's page-chat had only half its light rules duplicated.
- **The phone's top bar, measured:** with the sun it holds the logo, the sun, your coins and your pawn. The bar
  already ran off a 320 px phone with a 4-digit balance (and a 390 px one with 5 digits once the sun was in). Now:
  the coins' word goes when it doesn't fit (it wraps onto a line the pill doesn't show; the gold dot is the coin),
  the logo steps down a little below 400 px, and below 360 px a balance of 10,000 or more shows short ("123k").
  `e2e/home-layout.spec.ts` checks 320-430 px with 123,456 coins.
- **Checked:** `e2e/home-layout.spec.ts` (the sun on a computer and a phone, the pick through a reload with every
  value `data-theme` took logged from the first moment, Settings' three choices, following the device live, every
  front-door page in a forced theme) and `npm run frames:home` (one jump in brightness per tap; a reload with a pick
  shows no frame of the other theme, both ways).

### A cleaner computer home, and the queue in place (Eric, Oct 8, 2026)

Eric marked up the computer's home: the pawn card sat low with a big empty space above it (arrow up and left); the
coins and profile button should go to the top right; and "when you click play, that area [the mode picker, PLAY and
the buttons] should become the large lobby that starts filling up players, and also there should be a chat while you
wait … right now the whole screen is the hundred player loading". Phones keep their layout; everything here is
scoped to 1024 px and wider.

**Home (computer)**
- **Your coins and pawn: the top right of the page,** at the top of the live panel, level with the side menu's logo.
  On every page in the computer's frame (home, profile, settings, the shop), as the chess sites do. The home's own top
  bar (and its live line) are a phone's only now; the logo and the sun live in the side menu.
- **One box from the top:** your card and the play column start at the top (24 px, level with the logo) and share
  one box that fills the window's height, up to 720 px. Your card fills its column top to bottom (nothing above it);
  the play column sits in its middle, level with your pawn. On a tall screen the space is below everything, not
  above.
- **Sizes:** the card up to 540 px wide, the play column 320 px (1280-1439) or 360 px (1440+), 24 px apart, centred
  in a centre of up to 1,080 px (it was 920: a 1,860 px screen had wide empty bands). The live panel is 280 px below
  1440 px (320 above), so the lobby gets the room. 1024-1279: stacked, as before.

**The queue in place (computer)**
- **PLAY no longer takes the whole window.** The queue is a state of the home screen (`HomeScreen`'s `queue`): the
  side menu and the live panel stay, the play column becomes the lobby (the mode, the sound, "N / 100", the line, the
  bar, the grid, your seat and Cancel, "Switch to Default" for Bots off, and "Unranked …"), and your card shrinks to
  the top of the left column with the lobby's chat under it. When the match starts it goes to the game as before.
  Cancel is home again, in place.
- **Sizes:** the left column 280 px (300 from 1440), the lobby the rest; the grid is as wide as the lobby and never
  taller than the window allows, so Cancel is always in view: about 40 px pawns at 1280 × 800, 48 at 1440 × 900,
  about 65 on a 1920 × 1080 screen. (Eric's Oct 6 "60-80 px" was for a queue with the whole window; with the frame
  and the chat kept, it's smaller on a laptop.) At 1024-1279 the lobby takes the centre, your card is in your seat's
  card, and the chat goes under the lobby.
- **"Unranked …" sits beside the count,** so when the bots arrive it doesn't push the grid down mid-show. Your seat
  and Cancel share a row. No back arrow in the lobby (Cancel is there, and the side menu).
- **The side menu while you wait:** Play is where you are; your profile opens over the queue (as a pawn tapped in it
  does); anything else (Boss alone, Play with friends, the shop, Settings) leaves the queue first, then goes there, as
  leaving the page does on the chess sites. My call: a seat you can't see isn't one you're waiting in.
- **The live panel keeps its numbers fresh while you wait** (every 5 s, as on home; the full-window queue only said
  "still here" every 30 s). The server caches the live line for 3 s per Worker, so this costs no more than home.
- **Phones:** the full-screen queue, unchanged (its screenshots match the old ones pixel for pixel).
- **How it's built:** App renders home and the queue through one function, so the frame and the home screen stay
  mounted from home to the queue and back (no blink of the menu or panel). The private lobby keeps its own screen.
- **The lobby's chat** (the social delegate's `LobbyChat`, built alongside): on a computer, under your card in the
  left column, as tall as the lobby so it ends level with Cancel (below 1280 px, under the lobby, 280 px or more). One
  chat at a time: App decides by the window (`useMedia`, 1024 px), and the queue screen leaves its own spot empty.
- **A phone's queue, with the chat, fits a common phone** (390 × 664 and 375 × 667: the count, the grid and Cancel in
  view without scrolling). Before the chat it already ran 72 px past a 664 px screen, Cancel half off. My calls:
  - **Your seat is one line** under the grid ("You're in · seat 1"): the card's pawn and its "gold-ringed" line go on
    a phone (your pawn is the gold-ringed one in the grid). A computer keeps the card.
  - **The chat goes under Cancel** and fills the rest of the screen: on a tall phone it's all in view; on a 664 px one
    its header shows at the bottom and the rest is a short scroll. The count, the grid and Cancel come first.
  - The back arrow still leaves the queue (as Cancel does).
- **A private lobby on a computer** is a 640 px column in the middle (it took the game screens' 1,100 px), so its
  chat box and the player list read as one column. Phones unchanged.
- **Checked:** `e2e/home-layout.spec.ts` (the queue in place at 1024, 1280 and 1440 with the menu, panel and card,
  the lobby between them and Cancel in view, Cancel home, into the match, the menu while you wait, the phone's queue
  full screen, no sideways scroll), and `npm run frames:home` (every frame from PLAY to the vote and from PLAY to
  Cancel, dark and light: the menu and panel never missing, the grid never moving, the count never going down, no
  blinks).

## Quick chat in matches (design, Oct 6, 2026; built Oct 7, 2026)

Eric: a chat in 50 v 50, preset messages only (no typing), some unlockable, each with the sender's icon and name.
Roomy on desktop, closed but expandable on a phone. The `social` delegate builds it. My calls:

- **Where:** online 50 v 50 matches and multiplayer boss raids. Not solo (nobody to talk to), and not Classic while
  it's being reworked. The front-door queue can come later.
- **Preset messages only.** No typing anywhere, so there's nothing to moderate. A message is a phrase id; the server
  relays only known phrases the sender owns.
- **The phrases.** About 16 free to start, in four groups:
  - **Hello:** "Good luck!", "Have fun!", "Hi all!", "Let's go!"
  - **Reactions:** "Nice move!", "Wow!", "Oops…", "So close!"
  - **Plans:** "Trust the crowd", "Defend the king!", "Push the pawns!", "Go for mate!"
  - **Sporting:** "GG", "Well played", "Thanks!", "Rematch?"
- **Unlockable phrase packs** in the shop for coins (no money), each a few lines:
  - a God King pack ("For the crown!", "Not while I stand!")
  - a Winter pack ("Ho ho ho!", "Snow way!")
  - a Spicy pack ("Calculated.", "Was that a sacrifice?")
  - Later, packs can come from crates or achievements. The list lives in one file (`core/chat.ts`), so a new pack is a
    few lines.
- **Who hears it.** In 50 v 50, **your team** by default. The Hello and Sporting phrases can also go to **everyone**
  (one switch: Team / All), so plans stay inside the team. In a raid, everyone is one team.
- **Each message shows:** the sender's pixel icon, their name (in the leaderboard's colour for their team) and the
  phrase. Tapping the name opens their profile once the hub's profiles exist.
- **Limits** (server-enforced, in settings.ts): one message every 3 s, at most 5 in 30 s; repeats of the same phrase
  are dropped. Over the limit, the buttons grey out briefly.
- **Muting.**
  - Tap a name to mute that player for the match.
  - A "Chat off" switch hides it all, remembered on the device.
  - Report stays on profiles.
- **Bots chat a little,** so a lobby with bots doesn't feel dead: an occasional "Good luck!" at the start, "Nice move!"
  after a great crowd move, "GG" at the end. At most a few lines a minute across all bots.
- **Desktop (1024 px+):** a chat panel at the right of the game screen. The feed shows the last ~30 messages, with the
  phrase buttons below it in their groups.
- **Phone (revised by Eric, Oct 7): chat and the scoreboard share the space under the board.**
  - **Split, the default:** the scoreboard on the left and chat on the right, side by side, each in its own panel.
    The scoreboard's narrow form shows place, name and points. Chat shows the last few messages with their icons,
    and a row of phrase and emoji buttons.
  - **Each panel has an expand button** (⤢) in its header. Tapping it makes that panel full width and hides the other
    entirely, header and all.
  - **The full panel's button turns into "split"** (⇆), which brings both back side by side.
  - So: split → scoreboard full → split → chat full → split. You can't open both full, and you're never more than one
    tap from seeing both.
  - **The choice is remembered** on the device, so people who only want the scoreboard (or only chat) keep it that way.
  - **Unread messages:** while chat is hidden, the scoreboard's header shows an unread count, and the newest message
    shows for about 2 s as a small one-line bubble under the top bar (icon, name, phrase), never over the board. The
    bubble can be switched off.
  - The board is never covered, and moves are never blocked.
- **Emoji packs (Eric, Oct 7).** Alongside the phrases, players can send a single emoji: a quick reaction, shown in the
  feed with the sender's icon and name, and floating briefly above their row on the scoreboard.
  - **Free to start, "Basics":** 👍 👏 😂 😮 😬 🔥 💀 🎉.
  - **Unlockable packs for coins** in the shop, like the phrase packs:
    - "Chess": ♟️ 👑 🏰 🐴 ⚔️ 🛡️
    - "Winter": ❄️ ⛄ 🎄 🎁 🦌 🍪
    - "Royal": 🤴 👸 💎 🏆 ⚜️ 🐉
  - The same limits as phrases (one every 3 s, 5 in 30 s). Muting a player hides their emoji too.
  - Packs live in the same `core/chat.ts` list as the phrases, so a new pack is a few lines. Custom pixel emotes can
    replace system emoji later.
- **Sound:** a soft tick for a team message, never louder than a move, and none when muted.

### Built (Oct 7, 2026)

The `social` delegate built it as designed. The lines and packs are in `core/chat.ts`, every number in
`QUICK_CHAT` (settings.ts), the relay in `server/lobby.ts`, the app's side in `app/chat.ts` and
`components/QuickChat.tsx`. My calls where the design left room:

- **Where the panel is.**
  - Phone: the split under the board on every screen that has the scoreboard (your move, watching the other team,
    the reveal, the boss).
  - Computer: the column beside the board, under the move's panel, from 1100 px (not 1024), where the leaderboard
    moves to the side of the screen. From 900 to 1099 px the scoreboard is still in that column, so it keeps the
    phone's split there.
  - Pages: the results (so the GGs work), a boss raid's "watching" page, and the cut screen once you're out
    (knocked-out players stay on it until the results, and can keep cheering their team).
  - The pre-game votes and the final's own screen have no panel (their space is the vote and the final's teams): new
    lines come as the bubble there.
  - No chat button in the top bar: the revised design puts the unread count on the scoreboard's header.
- **The split.**
  - Half and half.
  - In the split, the Team / All switch takes the "Chat" title's place (there's no room for both).
  - It shows only whole lines (no half-cut line at the top).
  - The scoreboard's old ▾ now folds both panels to their headers and grows the board, as before (same remembered
    choice).
  - The unread count's tap brings chat back beside the scoreboard.
- **Tapping a name** opens a small menu in place of the buttons, with Profile and Mute for this match. The design
  asked for both on the same tap, and nothing pops up over the board.
- **Team / All.**
  - Emoji stay in your team, like the reactions (a 😂 to the other team after their blunder is a taunt). (Changed
    by Eric the same day: emoji can go to All. See "Emoji to All, and your picks in the profile" below.)
  - Each pack phrase joins one of the four groups, so the rule stays one sentence: "Hello and Sporting lines go to
    both teams".
  - With All on, the team-only buttons grey out and the feed says why.
  - There's no switch where everyone is one team: a raid, "everyone moves", and a 50 v 50's boss battle.
- **Team colours.** A white or black chip before the name, only on lines sent to everyone. A team line is always
  your team's, and a black name can't be read on the dark panel.
- **Limits.**
  - "Repeats are dropped" means the same line as your last one, within 30 s; other lines still go.
  - Over the limit the buttons grey out until they work again. At the 5-in-30-s limit, the feed says when.
  - The server checks everything and tells the sender why it dropped a line. Free text, unknown ids and pack lines
    you don't own never reach anyone.
- **Muting.**
  - A mute is for this match, on this device. It's kept with the lobby's code, so a reload keeps it. The server
    stops sending that player's lines to you.
  - Chat off is per device. The server sends you nothing, you can't send, and the panel says so with "Turn chat on".
  - Both switches are in the panel's ⋯ menu and in Settings (Quick chat, and the bubble).
- **The packs.**
  - Each has Eric's two lines and two more in the same spirit:
    - God King: "Call the King!", "Long live the King!"
    - Winter: "Ice cold.", "Happy holidays!"
    - Spicy: "Spicy!", "All in!"
  - Prices are in coins (`QUICK_CHAT.packPrices`): phrase packs 300 / 200 / 250, emoji packs 200 / 200 / 300.
    They're free while `SHOP_FREE` is on.
  - They're shop items in a "Chat packs" tab. You own them, there's nothing to equip, and the free ones show as
    "Free · yours".
  - The server reads what you own from your account when you join. A pack bought during a match works from the
    next one (or after a reload).
- **Icons.**
  - Each line shows the sender's pixel icon, as Eric asked. Profiles still don't show it to others (the hub's call).
  - An icon goes out once per sender per player, with their first line.
  - Icons are stored beside the lobby's record, not in it (Durable Object values are limited to 128 KB).
  - Bots, and people without a drawing, get a pawn.
- **Bots.**
  - "Good luck!"-type lines at the start: 90% of matches, from one or two bots, to everyone.
  - "Nice move!" or "Wow!": 30% of the time after a crowd move that lost at most 1 point, from a bot on that team.
  - "GG" or "Well played" at the end: 90%, from one or two bots.
  - Each comes 1.5-6 s after the moment. Across all bots there are at most 3 lines a minute.
  - They use their own randomness, so chat never changes how a match plays out.
- **Sound.** A tick at a quarter of the clock's tick, for team lines from others only, at most every 0.4 s. It
  follows the mute switch.
- **Looks.**
  - The panel is dark in both themes, like the scoreboard beside it. A page's chat follows the theme.
  - The bubble is a dark pill on light pages and a lighter pill with an edge in dark mode.
  - The bubble shows whenever no chat panel is on screen (scoreboard full, folded, a reveal too short for the
    split's feed, the votes). It sits between the top bar and the board. If there's no room it rides up over the bar,
    never over the board, and it takes no taps.
- **Classic has no chat** (server and app), and neither does the queue. (The queue does since Oct 8: "Lobby chat",
  below.)
- **Checked frame by frame** with `npm run frames:chat -- <dir> [moves] [dark|light] [split|chat|board]`
  (`scripts/frames-chat-move.mjs`, Worker running). It plays real taps on a phone while another player's lines
  arrive, records every painted frame, the board's box, the bubble's box and each change of the pieces.
  - In all three layouts and both themes: one board box throughout, every tap's move picked, no bubble ever over
    the board, and no flash.
  - The only brightness jumps were the reveal's poll appearing.
  - The pieces' frames match the same run on `main`: after a pick, Crowd's piece slides back and your pick shows as
    a vote. That's unchanged.

### Emoji to All, and your picks in the profile (Eric, Oct 7, 2026)

Eric: "we can add emojis to all chat that's fine. In profile players can select up to 10 quick chats which are the
ones they see in their games, for the total list it can just be a clean dropdown menu with a search function in the
profile under quick chat and emoji selection." My calls:

- **Emoji follow the Team / All switch,** like Hello and Sporting lines (`canSayToAll`). The server checks them the
  same way: ownership, the limits, mute and chat off. Reactions and plans still stay in the team.
  - The panel's All note now reads "Hello and Sporting lines and emoji go to both teams. Plans and reactions stay in
    your team."
  - **On the other team's screen,** the scoreboard shows only their own team, so the sender has no row to float
    from. An emoji whose sender has no row floats from the scoreboard's header instead, in a small dark pill with
    the sender's white or black chip (when it went to everyone). The same goes for a teammate whose row a phone's
    short scoreboard isn't showing. It's in the feed (with the chip) and the bubble as before.
  - There's still no tick for lines to everyone, emoji included.
- **The profile section "Quick chat and emoji"** is the social lane's, on your own profile only, under Wearing (your
  look, then your voice; it also balances the computer's two columns). Its code is `components/ChatPicks.tsx`; the
  profile screen only places it.
  - Two blocks, Lines (n/10) and Emoji (n/8). Your picks show as chips in your order; tapping one takes it out.
  - Each has a "Choose lines" / "Choose emoji" dropdown. It opens in place (no popup) with a search box at the top
    (16 px, so iOS doesn't zoom), then the whole list by pack: yours first, then the shop's. Picked rows have a
    gold check. Rows are 50 px tall; emoji are 56 px squares.
  - The search matches a line's words, its group (so "plans" finds the plans), an emoji's name ("fire") and the
    pack's own name. Every pack's name ends in "pack" or "emoji", so those words are left out, or "pa" would match
    them all. Emoji got names for this (and for screen readers).
  - A new pick goes at the end. There's no drag to reorder: take one out and add it again. At the cap, the
    unpicked rows grey out and the menu says "10/10 picked. Take one out to add another."
  - Lines from packs you don't own show locked, with a 🔒 and the pack's name ("God King pack ›"). A tap opens the
    shop on its Chat packs tab. In a match (your profile opened over the game) the shop isn't one tap away, so they
    show locked without the link.
  - Each change saves to your account at once, with no Save button. "Back to the defaults" shows once a list
    differs from them.
  - You can take every line out. Then the match panel says to pick some in your profile.
- **The caps, in `QUICK_CHAT`:** 10 lines (Eric) and **8 emoji**. Eight is what the free Basics pack has, so the
  defaults are all the free emoji and nobody's emoji row changes. Eight fit one row of a phone's full-width chat
  without scrolling (about 37 px each on a 390 px phone; the row is a grid of equal columns). In the narrow split
  they scroll sideways, as before.
- **The defaults** (`QUICK_CHAT.defaultLines`, `defaultEmoji`) are for everyone who hasn't chosen, new and
  existing players alike. They're stored as "not chosen", not copied, so a change to the defaults reaches them.
  - Lines: Good luck!, Have fun!, Nice move!, Wow!, Oops…, Trust the crowd, Defend the king!, Go for mate!, GG,
    Thanks!. Two of each group and three reactions and plans, all free. Five go to All, so the switch still does
    something.
  - Left out: Hi all! and Let's go! (Good luck! and Have fun! say it), So close!, Push the pawns!, Well played
    (GG says it), Rematch? (a 100-player match has no rematch). Thanks! stays, to answer a "Nice move!".
  - Emoji: the eight free ones, in their order.
  - Someone who owns a pack sees the defaults too until they pick its lines. Ten slots can't hold everything, and
    while the shop is free most testers own every pack.
- **Lines and emoji are chosen apart.** Picking lines leaves your emoji on the defaults, and the other way round.
- **In the match** the buttons are your picks in your order. They replace the four fixed groups: a phone's sideways
  row of lines and a row of emoji, and the computer's lines wrapping with the emoji under them. There are no group
  headings any more. With All on, the lines that can't go to everyone grey out, as before.
- **Getting a pack:** its lines go into any empty slots, in the pack's order, up to the cap. This happens on the
  server, as part of the purchase. Most players are full (the defaults are 10/10 and 8/8), so the shop then shows
  "Your quick chat lines are full (10/10), so nothing changed in your games yet." with **Pick these in your
  profile ›**. If only some went in, it names what went in and offers the same button. The button opens your
  profile at Quick chat and emoji, and closing it goes back to the shop.
- **The shop's Chat packs text** says to choose your 10 lines and 8 emoji in your profile (the numbers come from
  settings). The tab ends with a "Choose your lines and emoji in your profile ›" button. Settings' Quick chat
  switch says the same.
- **Where the picks live:** with the shop's state in D1, in a `chat_picks` table (one row per player: each kind a
  JSON list, or NULL for the defaults). `shopState` returns them as `chat`, so they come with your profile, like
  your equipped items. `POST /api/shop/chat {lines?, emoji?}` saves them; null puts a kind back to the defaults.
  - The server cleans what it's sent: known lines of that kind, from packs you own, no repeats, at most the cap.
  - Signing in to an existing account brings a guest's picks along, unless the account has its own (as with
    equipped items).
- **The server doesn't enforce picks, only ownership.** Picks only decide which buttons show. Any line you own is
  still yours to say, so an old tab or a pack just got never has a line refused.
  - The app reads the picks from your account, which is loaded before any match. A change made in your profile
    during a match shows at once.
- **Bots keep their own full list** (`botChatLines` is unchanged).

### The panel under the board: one view, never an empty box (Eric, Oct 7, 2026)

Eric, on his iPhone: "the scoreboard can be both large like this and not showing because there's 2 buttons which
control its view. If it's enlarged like so it should reset the other toggle or switch it". His screenshot showed a
tall, empty black box about two thirds of the screen wide, under the header "White team · tap for all 50".

- **The cause.** Two settings, one per button: the layout (`brc.underBoard`: split, board, chat) and the fold
  (`brc.miniTower`). Folding side by side, then tapping the scoreboard's ⤢, gave "scoreboard full width, folded".
  - Its class was `under-board board closed`, and `.board` is the chessboard's own rule
    (`width: 100%; height: 100%`).
  - Open, `flex: 1 1 0` overrode that height. Folded (`flex: none`), the panel took the screen's full height.
  - The folded scoreboard inside it kept only its header's width (about 60%) and stretched to that height, with no
    rows.
  - Every saved combination was reproduced on an emulated iPhone. Only "full width + folded" was empty, with chat
    on or off. Open, the same class collision also made the panel 20 px too wide.
- **One view** (`prefs.ts`, `underBoardView`): `{ layout, open }`, kept in one setting (`brc.underBoardView`). Every
  panel and the scoreboard read it and redraw together.
  - Showing a layout always opens it: a panel's ⤢, "side by side" (□□), and the unread count's tap.
  - The arrow folds or opens and keeps the layout. Folded, the panel is just its header bar, the full width (side by
    side: both headers, half each).
  - The layout classes are now `ub-split`, `ub-board` and `ub-chat`, so nothing of the chessboard's applies.
- **Old settings fix themselves on load.** The two old keys become the one view and are removed. A full-width panel
  that was folded opens: in the new view you can't fold one by making it bigger, and folded it was the empty box.
  Side by side and folded stays folded, since it was always a small bar. Eric's phone shows the full scoreboard on
  its next reload.
- **No chat (solo, Classic) or chat off:** the scoreboard alone, full width, with its own fold arrow and no split
  buttons. With chat off, the phone no longer shows a "Chat is off" panel; Settings turns chat back on, and the
  remembered layout returns.
- **Tested:**
  - `e2e/panel.spec.ts` taps every button from every state, folded and open, and reloads after each tap. It also
    loads each old-build combination, runs a match with chat off, and folds and opens a solo Crowd match. After
    every step the panel shows rows, chat or a small bar, and fits the screen.
  - On the old code it failed at the second tap, Eric's box (652 px tall, no rows).
  - `app/test/under-board.test.ts` covers the view, the migration, and a device without storage.

### Lobby chat: quick chat while the match fills (Eric, Oct 8, 2026)

Eric: "there should be a chat while you wait for players … the chat could be initiated at this point and then you
could see the lobby chat." The `social` delegate's calls:

- **Where:** the queue (Play now's Default and Bots off, raids), private lobbies, and Solo's queue. Crowd and raids
  only: Classic still has no chat. Not the "servers are busy" line (no seat yet, so no lobby to talk in).
- **One channel, "Lobby",** for everyone in the lobby. There are no teams yet, so there's no Team / All switch, and
  every line you own can go, plans included: there's no other team to keep a plan from. Team / All begins with the
  match.
- **The lobby's lines carry on into the match's feed.** Eric's "initiated at this point" reads as one conversation
  that starts in the queue. They're marked as the lobby's: a small "lobby" tag where tags show (the computer's panel,
  a phone's full-width chat), and no team chip, since nobody had a team when they said it. Lines already seen in the
  queue don't count as unread or bubble up. A rejoin mid-match gets them too.
- **The same rules as in the match:** the presets, your 10 lines and 8 emoji from your profile, mute, chat off, the
  limits (one every 3 s, 5 in 30 s, no repeats), and the server's checks (known lines you own; names from the lobby,
  never the message). A mute made in the queue lasts into the match (it's kept with the lobby's code). The limits
  are kept by account, so Cancel and PLAY again into the same lobby doesn't reset them.
- **Someone who leaves the queue** takes their seat and their name with them. Their lines stay on the screens that
  already showed them (the app keeps the names it has seen), and newcomers never get them (the server sends only lines
  from people still in the lobby).
- **The bots say hello as they fill the empty seats** (Default, a matchmade raid): one or two of "Hi all!", "Have
  fun!" and "Let's go!", 0.3-0.9 s after they sit down (the second 0.5 s later), inside the 1.8 s the full grid shows.
  - Always at least one (`botLobbyChance` 1): the moment is short, and an empty chat looks dead.
  - They count toward the 3-a-minute cap on bot lines, so with the match's own "Good luck!" it's three at most.
  - Bots off has no bots, so no hellos. A private lobby's bots arrive with Start, which begins the match at once,
    so they greet as the match begins, as before.
- **Solo:** its queue (3.1 s) has the chat too. There's no server, so the app stands in for one with the same checks
  (`SoloLobbyChat` in `app/chat.ts`). The bots already seated halfway through the fill say hello, so their lines land
  while the queue is up. Solo matches still have no chat, so it closes as the match begins. A mute there isn't stored.
- **No sound for lobby lines.** They go to everyone there, like All lines in a match (which don't tick), and the
  queue already has its pops.
- **The server** relays chat in the waiting phase, with the same validation. Chat never keeps a lobby open:
  - chat and chat settings don't count as activity (`activeAt`), so a lobby nobody starts closes an hour after the
    last join, leave, connection or drop, however much is said. The hub's rule ("sent anything") is now "anything but
    quick chat";
  - chat sets no timers, so the fill time, the match's start and the close time are untouched.
  - Icons already sent in the queue aren't sent again as the match begins.
- **Where it shows** (`components/LobbyChat.tsx`, self-contained: it takes its size from the box it's put in, with
  no fixed positioning, so the hub can place it):
  - Phone: under the grid, inside the queue's panel, above "You're in". At least two whole lines
    (`QUICK_CHAT.lobbyFeedLines`), more when there's room. Its header says "Lobby · Everyone here · teams come with
    the match", with ⋯ for chat off and the mutes.
  - Computer: for now in the right column under Cancel (the queue grid's free cell). The hub's new layout moves it.
  - Private lobby: a 210 px box under the players.
  - It follows the page's theme (the queue's own colours).
  - On an iPhone 13 in Safari (390 × 664), the count, the grid and the whole chat are in view while the queue fills.
    "You're in" and Cancel are below. The queue already ran 72 px past that screen before the chat (Cancel was half
    off it); the back arrow also leaves the queue.
- **Checked:**
  - Unit tests: `server/test/lobby-chat.test.ts` (the relay, validation, mute and chat off, the limits, bot hellos
    and their cap, close-out never held up by chat, the carry-over), and the lobby moment in `core/test/chat.test.ts`
    and `app/test/chat.test.ts`.
  - e2e: `e2e/lobby-chat.spec.ts` (phone and computer): two players in a Default queue see each other's lines, the
    bots say hello, and the lines carry into the match; Solo's queue; a private lobby.
  - Frame by frame: `npm run frames:lobbychat -- <dir> [dark|light]` (Worker running) records every frame on a
    phone while lines arrive, a real tap on a line and on an emoji, people pop in, then the fill and the bots' hellos.
    In both themes the chat never covered the count, the grid or Cancel, and nothing moved or resized while lines
    arrived. The only move was the queue's own "Unranked" line appearing at the fill, which moves everything under it
    down 28 px.

### Global chat on the home page (Eric, Oct 9, 2026)

Eric marked a "GLOBAL CHAT" box in the computer's right column, under Playing now: "Simulate slow bot chat for beta,
timestamp of chat, name, icon, rating if possible, limited to 1 message per 30s". The director's brief: preset lines
only for now, desktop only, signed-in players post, guests read, bots behind one switch. The `social` delegate's calls:

- **Where:** the computer's home page only (the right column from 1024 px, under Playing now), filling the rest of
  the column's height: the feed scrolls inside it, the buttons stay at its foot. Not the queue (the lobby has its own
  chat in the centre), the shop, the profile or Settings, and not on a phone yet. The hub owns the column; the panel
  is one self-contained component (`components/GlobalChat.tsx`) placed after Playing now.
- **Preset lines only, as in quick chat.** No text box anywhere, and the server takes only a line's id
  (`canSayHome`, `core/chat.ts`):
  - **A new free "Lobby" pack, for the home page only** (20 lines): Hey everyone!, Morning all!, Evening all!,
    Welcome!, Hello again!, Anyone up for a raid?, Anyone for 50 v 50?, Queueing now, join me!, One more game?, Just
    won one!, Beat the boss!, Knocked out early…, What a nail-biter!, The crowd was wild!, That boss is tough!, GG
    all!, Thanks for the games!, BRB, Bye for now!, See you on the board!. It isn't in the shop, the profile's picks
    or a match (a match's server refuses its lines). No line uses "close" or "back": the home page's other buttons
    are found by those words (Close, Back), in the app and its tests.
  - **The general lines:** Hello, Reactions and Sporting lines of every pack you own (the free ones, and God King,
    Winter and Spicy once got). **Plans** ("Defend the king!") are left out: they're orders to a team, and there's no
    team on the home page.
  - **Emoji:** every emoji pack you own.
  - **The buttons** are three tabs: **Lobby** (the pack), **Yours** (your profile's picked lines that suit the home
    page) and **Emoji** (your picked emoji). Owned packs reach it through your picks, as in matches; the server checks
    ownership, not picks, as in matches.
- **Each line shows** its time ("2:41 PM" today, "Oct 8" before), the icon (a drawing, an older account's emoji, else
  a pawn), the name, the rating if the player has one, and the line. Your own lines say "You", in gold. Names,
  ratings and icons come from the account on the server, never from the request. Nothing private goes out: no
  email or sign-in method. A line does carry the account id, so tapping a name can open the profile (ids are random;
  a player who posts in a public room can be looked up, like anyone in a shared lobby).
- **The limit: one message per account every 30 s** (`GLOBAL_CHAT.gapMs`), enforced by the live hub. It's checked
  against the last line kept too, so a restart doesn't reset it. The app mirrors it: after a line, every button
  greys out with "Next message in 28 s", also after a reload (your own last line says when). The server's 429
  carries how long to wait, and the app takes that too.
- **Who can post:** signed-in players, wherever a way to sign in is set up (production), the same rule as online
  play. Guests read, with "Sign in to chat. Guests can read." and a Sign in button. Banned players can't post (fair
  play's ban). Locally, with no sign-in set up, anyone can post, as anyone can play online there (so the e2e can).
- **The server:** the existing live hub Durable Object (`live-hub.ts`) holds one shared room (`server/global-chat.ts`,
  pure and tested). It keeps the last 50 lines (`GLOBAL_CHAT.keep`, nothing older than a day) in its storage, so a
  newcomer sees recent chat and a deploy doesn't wipe it.
- **No new socket or poll.** There's no presence socket: presence is the live line's poll (`GET /api/live`, every 5 s
  while a front-door screen is open). The chat rides on it: `?chat=N` asks for the lines after N, and the answer
  carries only those (usually none). Each Worker instance keeps the room for 3 s, like the live line's numbers. So a
  line reaches others within about 8 s, which suits a room limited to one line in 30 s. Posting is
  `POST /api/chat {say}`, whose answer brings the poster's view up to date at once. Requests without `?chat` (matches'
  heartbeats) are unchanged.
- **Drawn icons** never go in the lines (up to 16 KB each). A line carries the drawing's key (a hash of it), and the
  app shows `/api/chat/icon/KEY`, which the browser caches for good (the key changes with the drawing). The hub keeps
  only the icons of lines it still holds.
- **Bots chatter for the beta**, behind one switch: **`GLOBAL_CHAT_BOTS` in settings.ts. Eric wants it off when the
  game goes live** (set it to `false`).
  - A bot says something about every 30-90 s (`GLOBAL_CHAT.botGapMs`), and the first 4-15 s after someone opens the
    chat when nobody had it open, so a quiet room comes to life soon.
  - **Only while someone has it open, with nothing running otherwise.** There's no timer or alarm: a bot's line is
    made when an app asks for the chat and one is due. With nobody watching for over 15 s, nothing is said, and
    nothing is made up for the gap when someone comes back.
  - The names are the match bots' list, with the pawn icon, like the bots in a match's chat. Every bot line has a
    **"bot" tag** after the name, and no rating. No bot speaks twice in six lines, and no line repeats in six.
  - Their lines (`HOME_BOT_LINES`): hellos, "Anyone up for a raid?" and "Anyone for 50 v 50?" (most often),
    results, good sport, and 👍 😂 🔥 🎉.
- **Light:** at most 50 lines in memory and on screen (on the server and in the app). No per-frame work: the panel
  redraws when a line arrives, and once a second only while your countdown runs. No new paid service: the live hub,
  its storage (one small write per line) and the Worker, as before.
- **Mute and report:**
  - Tapping a name gives Profile and Mute, in place of the buttons.
  - Mute hides that player's lines on this device (remembered, up to 200 players). The header shows "🔇 2 muted ·
    unmute" to bring them all back.
  - Report is on the profile, as before (fair play's reports).
  - Quick chat's "Chat off" switch (Settings) turns this chat off too. Nothing is fetched then, and the panel says
    so, with "Turn chat on".
- **Tested:** `core/test/global-chat.test.ts` (the presets-only rule, the lobby pack kept out of matches and the
  shop, the buttons, the bots' lines and turns), `server/test/global-chat.test.ts` (the 30 s limit, through a
  restart; presets only; the bot tag; bots only while watched, never catching up; the switch off; the live hub's
  relay, history, restart and icons; the API: guests read but can't post where sign-in is set up, banned players
  can't post, no email in what goes out), `app/test/global-chat.test.ts` (the 50-line cap, the mirrored limit, mute)
  and `e2e/global-chat.spec.ts` (computer: post a line, a second player sees it, the buttons rest, the server's 429,
  free text refused, the wait kept through a reload, an emoji, a bot's tagged line, mute; phone: no panel).

## No flash between a match's screens (Oct 6, 2026)

Eric: in a solo boss raid on his phone, the screen flashed white between moves.

- **The cause:** each phase of a match (play, reveal, boss, watching…) is a new screen. Every screen faded in from 40%
  opacity, and its board was built only after the first paint. So two or three times a move, for about 50 ms, the board
  vanished and the screen washed out: white in light mode, a dark blink in dark mode. Every mode had it. Details and
  the rule that follows are in `.claude/LESSONS.md`.
- **The fix:** a match's screens (play, reveal, boss, watching, votes, final, the cut, the stage break, spectating, the
  opening grid, the results) appear at once, with no fade. Screens outside a match keep theirs. The board is built
  before the paint.
- **Checked** with a new tool, `npm run frames:flash`, which records every painted frame on an iPhone-sized screen and
  flags brightness jumps: boss, Crowd and Classic, light and dark. No flagged frame at any phase change after the fix.
- **A boss battle's results headline follows the result.** Alone, it read "1st of 1 · You won the match!" right above
  "The Iron Bishop won." Now a solo raid's headline is **Victory!**, **Defeated** or **A draw**, with 🏆, 💀 or 🤝. With
  several players it still shows your place in the crowd, as "You were the best in the crowd" rather than "You won the
  match".

## e2e: two flaky solo tests (Oct 6, 2026)

The cause and how it was found are in `.claude/LESSONS.md`. The calls made:

- **Fixed in the tests, not the game.** Less thinking time breaking an exact tie at a cut is the rule as decided above.
  What was wrong was the test charging its own engine lookup to the player.
- **Every context a test opens is closed when the test ends**, by the `test` exported from `e2e/helpers.ts` (pass or
  fail), rather than a `close()` at the end of each test, which a failure would skip.
- **Strong play's move is searched before the clock starts:** during the stage's last reveal and the stage break,
  using the game's own `prefetch()` (the round scores with the same searches, so it's still exactly the best move).
  Stopping the page's clock with Playwright's fake clock was tried and dropped: it slows the whole page.
- **Strong play plays the highest-scoring line**, not the engine's first line: the judge rates picks by score, and in
  about 2% of positions a later line scores higher. Left as it is in the game, and passed on: the reveal's "Best was"
  and the bots' and power-up's idea of the best move follow the first line (the engine lane's to decide).
- **Strong play keeps its 240 s limit.** With the leftover pages closed it takes about 3.5 minutes in a full run; the
  match's own pacing (the final's bot turns most of all) is about 200 s of that.

## A solo boss raid flows like a chess site (Oct 6, 2026)

Eric: "when you do solo versus boss, you don't need the green confirmation highlighting on the tiles and you don't need
the beeping sound. It should just be you play your move and it's played", unless the God King steps in. Smooth, like
chess.com, for any solo mode (the solo boss raid is the only one where you're the whole crowd).

- **Before** (about 8 s a move): your move, "Move in. Waiting", a 4 s reveal ("Crowd plays Bb5 · 1/1") with a green
  ring on your piece and three tones, the boss thinking, its move with another green ring, then "Your move in 2… 1…"
  with ticks before your clock started.
- **Now:** you move and it stays played. The dock says "The boss is thinking…" while your move is scored, the boss's
  move slides in (the usual last-move squares, no ring), and your clock starts as it lands. About 3.5–4.5 s from your
  tap to your turn on the test machine, most of it the engine scoring your move (the boss's minimum think time now
  counts from your move, so the two overlap).
- **What still stops the game:** the God King's Last Stand (it plays out, about 9 s, then you pick again), a move he
  plays for you (his cut-in), the boss taking your queen (its banner), and running out of time (the reveal shows the
  move made for you).
- **The God King still comments on your move** (great move, bad move, a check, a capture): the reveal used to trigger it,
  so the same lines now fire straight from the solo game (`crowdMoveCues` in `godKing.ts`, shared with the reveal).
- **Only alone.** Raids with friends and the 50 v 50 boss final keep the reveal, the rings and the countdown: there,
  the crowd's choice is news. An online raid of one still has the old flow (the server runs its timing); solo is what
  Eric plays.
- **Later (Eric):** the Last Stand's own flashes (the freeze and the crash) are on purpose, but Eric thinks they need
  changing too. Not touched here.
- An e2e case checks it: a plain move goes play → scoring → boss → play, with no reveal, no ring and no countdown.

## The Last Stand, after Eric played it (Oct 7, 2026)

Eric played it live: "I played the piece, and then there's nothing, and then all of a sudden the king drops in, so we
just need something there." He wanted a warning on the piece (red, an exclamation), the move's strength without
numbers he doesn't know, details at the end of the game for anyone who taps, and no more white flashes. And his
leftover charges shouldn't just vanish.

**1. The warning beat** (the first 1,300 ms of the Last Stand; the timeline above):
- A red **"??" badge** pops on the corner of the piece's square, like a chess site's blunder mark. The square pulses red
  under the piece three times (the board's own highlight, so the piece stays plain to see), and a danger sting plays:
  `warn.mp3`, two low-health beeps from the CC0 retro pack over a soft thud (credited in the God King sound credits;
  cut by `scripts/god-king-last-stand-sounds.py <dir> warn`).
- **The eval bar plunges** to the crowd's chances after the blunder (the judge's own number), ringed red, and goes back
  as the piece slides back.
- **The dock, in plain words:** "?? Blunder: Nb5" over "Loses your knight", "Allows mate", or, when the boss's reply
  wins nothing a player could name, "Your chances 52% → 9%" ("Chances 52% → 9%" on phones under 360 px, to fit). It
  stays until the piece slides back; then "He takes the blow!" and "The God King has fallen" as before, with "He leaves
  you ⚡×3" when he had charges.
- **Where "what it loses" comes from:** the judge's own searches, at no extra engine time. Every search line's second
  move is the opponent's best reply, and `score mate` gives a forced mate; `uci.ts` now keeps both on each scored move
  (the `scoreAfter` fallback keeps its best move as the reply). The runner (solo) and the host (online, in its scores)
  pass them along; the Last Stand record carries the boss's reply (only if legal there), a mate it allows (`mateIn`),
  and the crowd's chances after the best move and after the blunder (`before`, `after`), on the round and on the
  battle, solo and online.
- **The words** (`blunderCost` in `chess/rules.ts`, wording in `godKing.ts`): a mate in 3 or fewer first ("allows
  mate"); then a piece the reply wins outright, a knight, bishop, rook or queen worth at least two pawns more than
  whatever takes it back ("loses your queen" for a queen lost to a bishop, but not for a queen trade); then a longer
  mate; otherwise the chances. A pawn is never named: a 30-point blunder that "loses a pawn" would mislead.
- **No white flash anywhere in it:** the freeze's flash is a dark red pulse, the crash a dark red shockwave with an
  orange ring and dust, the streak gold, the banner's flash dark red. Checked with `npm run frames:flash -- <dir> 2
  light boss laststand=1` and the same in dark: no flagged frame; in light mode no frame of the Last Stand is brighter
  than the screen's median, and the biggest frame-to-frame rise is 7 (the flag is 20).

**2. The Last Stand card on the results screen** (`LastStandCard` in `LastStand.tsx`), under his epilogue figure,
solo and online: one line, "Move 7: Nb5?? · loses your knight". Tapped open: your move with a red ??, the boss's
reply and what it won ("dxe4 · wins your knight", "Qh4# · checkmate", "mate in 3"), the best move instead (green),
your chances before and after ("52% → 9%"), and the position on a small board with your blunder as a red arrow and
the best move as a green one. Stacked on phones, the board beside the facts from 420 px.

**3. His leftover charges become power-ups.** When he falls, every player still in gets `lastStandPowerUps` (1) ⚡
power-ups for each charge he had left: the same as Crowd's, the engine's top 3 moves at full strength with the usual
hint arrows. It's done in the runner, so the solo raid (just you), online raids and the 50 v 50 boss final (bots too,
who use them as bots do in Crowd) share it. The ⚡ button, with the count left, sits in the dock above his fallen
figure, where his menu was (the whole column is the button; gold and glowing on your move, grey otherwise, ringed
while one is in use). A power-up move is an ordinary pick, marked as a power-up move (⚡ in the move list) and never
brilliant.

**Calls I made:**
- **The warning is 1,300 ms** (Eric said 1.2–1.5 s); everything after it moved 1,300 ms later, so the Last Stand is
  9.9 s instead of 8.6 s. The clock stays frozen throughout, solo and online, as before.
- **The badge and the red square stay until he lands on it** (2.7 s), not just the 1.3 s warning, so the danger is
  still marked while he leaps.
- **"Chances" are the judge's expected score** (a win plus half a draw), rounded to whole per cent: the same number the
  eval bar shows.
- **The words name a piece only when the reply wins it outright** (two pawns or more net), and never a pawn; anything
  subtler gets the chances.
- **The leaderboard shows the new power-ups as soon as the round is scored** (during the warning), since it shows
  everyone's power-ups as they stand.
- **One power-up per leftover charge** (`lastStandPowerUps`, a setting).
- **In a crowd's reveal, the chosen move's green ring gives way to the red pulse** when the move is a Last Stand.
- **The test switch** is still `?laststand=1` (and `?side=b` for Black): the first crowd move sets it off whatever it
  is, so the warning may name a small loss ("Your chances 52% → 49%"). Blunder a piece for the real thing.

## Match screen fixes (Oct 7, 2026)

Five things the quick-chat build noticed, and one found on the way. My calls:

- **A later cut, once you're out (online Crowd).** Knocked-out players stay on the cut screen until the results, so
  they see every later cut, and those said "You're through."
  - Now they say "You went out earlier, in 37th place." There's no "Why was I cut?" there (the results have "Why you
    went out"), and no clock vote (the server ignores the vote of a player who's out).
  - Each later cut is now its own judgement. The screen used to be reused, so the gavel never fell again and the
    newly cut pawns went straight to grey, with no sound.
  - Classic has the same bug online ("You're through to stage 3" for players already out). Not fixed: Classic is
    being reworked.
- **The cut screen's names.**
  - When names became tappable (they open profiles), the shared name style replaced the chips: plain 16 px text, not
    struck through, in a box that cut its last row in half and hid "+N". The chips are back.
  - The list shows only whole rows (four on a phone, at most 12 names). Names that don't fit join "+N", so long names
    or a narrow phone just show fewer. You come first, so the list never hides you. "+N" isn't struck through.
- **The top bar on phones.**
  - On most phones its line was wider than the bar, by up to 100 px at 360 px with wide scores, so the cut pill ran
    under the sound button and off the screen.
  - Under 480 px: Crowd's label is two short lines ("Move 34" over "cut in 2"), with a little less space between
    items, the rank at 15 px (its "/50" at 12 px) and your score at 18 px.
  - The numbers never shrink. On a screen narrower than 360 px, only the label is shortened, with "…".
  - Checked at 360 and 375 px, light and dark, with the widest real values: move 34, −112.5, a cut line of −120, and
    "P100/100" in Everyone moves. Classic's and the boss's labels are unchanged.
- **The iPhone SE's cut screen** is still a few pixels taller than the screen (7 px, was 21). Not changed here.
- **Two tests that failed now and then.** Both were test bugs; the game is right in each.
  - The Crowd test played one round a stage, so each stage was a single ply. At the first cut, the team that hadn't
    moved yet was all tied on 0, and its cut was a coin flip: in about 1 run in 12 you went out before ever playing.
    A real stage is a move for each team, so the test now plays two rounds a stage (about 5 minutes).
  - The sound test: in about 1 solo Classic match in 170, your first board is a Caro-Kann line ending 5.Nxf6+.
    Black is in check with only two legal moves, so the power-up rightly shows two. The test now expects the top 3,
    or every legal move when there are fewer.
  - For the Classic rework: some library lines start the board in check with one or two replies.
- **Found and passed on to the engine lane:** a top-N search can list one move twice and leave out another.
  - When the node budget runs out mid-search, Stockfish marks the line it was searching as a bound. `parseInfo`
    skips bound lines, so that slot keeps the previous depth's move, often one that's also in another slot.
  - In 59 of 202 Classic start positions, a top-8 search repeated a move. In 9 the repeat was in the top 3, so the
    power-up showed the same move twice and missed a good one.
  - The bots' candidates and the judge's top 8 have the same gap. Not fixed here: it's the judge's code (`uci.ts`).

## Pre-game vote overhaul (Oct 7, 2026)

Eric: keep the three zones; replace Slow with a Variable speed (Normal on the left, Variable in the middle, Bullet on
the right); and start the votes on a board wiped of pieces, with every player shown as their own dressed pawn,
everyone else's faint, yours easy to find. The calls he made: the schedule below, one vote each (he may let players
change it later: "we will consider it"), and Variable when nobody votes. Mine:

**The speeds.**
- **The schedule is data**: `VARIABLE_CLOCK` in settings.ts, one step per entry (moves 1–5: 10 s, 6–10: 15 s, 11–15:
  20 s, 16–20: 25 s, 21 on: 30 s). One function, `moveClockAt(settings, move)`, gives the clock on a move, and every
  clock goes through it: solo, the lobby server, the finals, the boss battle, the time you're allowed (`allowedMs`)
  and the bots' thinking. A speed is a patch: Normal and Bullet set `moveClockSeconds` and no steps; Variable sets
  `moveClockSteps`.
- **"Move" is the number on the top bar** ("Move 6"): White's move and Black's reply share it, so both teams get 10 s
  for their first five moves. The runner works it out from the board (`clockMove`), the server sends each move's
  clock with the round, and the screens show what they're sent.
- **The finals.** The team final and the duel play on the same board, so they carry on counting (they start after
  move 20, so 30 s). The boss battle goes back to a position from moves 5–12 of the game, but its clock doesn't: it
  counts on from the move the game had reached (`clockFromMove`), so it's 30 s too. Starting the boss at 10 s, right
  after the whole game earned the most time, would be backwards for "more time as the game goes on".
- **Votes off** is Normal (20 s), as before. **Nobody votes** is Variable, the middle option. Raids have no speed
  vote (20 s).
- **The bots' timing.** A bot now thinks within 85% of the move's clock. On a long clock nothing changes (Crowd's 2–14 s
  fits inside 17 s); on 10 s, a third of the bots used to finish exactly on the buzzer, a pile of ghosts at the end.
- **On screen.** Your move's line above the board says the clock ("Your pick for White · ⏱ 10 s · 3/50 picked"). On
  the move it goes up it's lit green with a ▲ ("⏱ 15 s ▲", a short flash), and plain again on your next move. Nothing
  covers the board. The watching screen doesn't show it (solo squeezes the other team's turn into 5 s). The timer bar
  is full at each move's own clock. The "cut in N" count is moves, not seconds, so it's unaffected. The last-10-seconds
  ticks are unchanged: on a 10 s clock they tick all move, as Bullet always has.
- **Explained** on the Variable card ("10 s, rising to 30 s"), in full in the result banner when Variable wins, and as
  a table in How to play (Settings), with what a move is.
- **Nothing old says Slow.** `?speed=normal|variable|bullet` (new, solo and lobby creation, for tests, with
  `?format=`) maps a stale `slow` (and `standard`, the old name) to Normal. No preference ever stored a speed. A lobby
  mid-vote at the deploy: results are indexes, so an old Slow win reads as Normal and Standard as Variable; a match
  already voted keeps its seconds.

**The vote board.**
- **Everyone is their own pawn**, the cut screen's drawing (`Avatar`): you in your shop hat and crate items, others in
  the crate items they sent, bots in a hat seeded by their id (the cut screen's rule, now shared: `pawnLook` in
  looks.ts). Nothing on: a plain pawn in your team's colour. No chess pieces while the votes run.
- **Starting spots** (`voteHomeSpots`): White's team spread over ranks 1–2, Black's over 7–8. Even, with no clumps or
  holes at 50 a side (a low-discrepancy sequence plus a little jitter), not on squares, overlapping a little. Who
  stands where is seeded by the player's id, so a pawn keeps its spot between renders and between the two votes.
  Pawns lower on the screen stand in front.
- **Sizes.** Everyone else's pawn is 0.62 of a square (22 px on a 360 px phone), faint (40%; 55% once in a zone).
  Yours is 0.93 of a square, solid, with a white edge and a blue glow, a blue ring at its feet and a "You" tag, above
  everyone else's, and it bobs gently until you vote. Checked at 360 px in light and dark, as White and Black.
- **Voting.** Drag your pawn into a zone (it lands where you let go across the zone, on your side's half), or tap it
  (it rises, the zones pulse blue) and then tap a zone, or tap a card. Anywhere else, it walks back. A big invisible
  area around it takes the touch, with no scrolling or zooming while you drag (`touch-action: none`).
- **In the zones.** White's votes land on the zone's rank-4 half and Black's on its rank-5 half, so the sides stay
  apart; each lands on the next free spot, in the order the votes arrive. The icon and the count sit in one row on
  the far half (the other team's), so your team's votes and your pawn are in full view; in a zone your "You" tag
  moves under your pawn. Everyone else's pawn glides in (0.7 s, on a slight curve) as their vote arrives.
- **The tally bubbles up.** Each vote that lands bumps its zone's count and its card's count (a 240 ms, 1.2× pop: small,
  as a hundred votes come in) while the card's bar grows. A count goes up as the pawn lands, not as it sets off (0.7 s
  later; yours at once; all of them once the vote is counted).
- **One vote each** stays, as a setting: `voteChangeAllowed` (off). On, your pawn and the cards stay live after you
  vote and a new zone replaces your vote; the server, solo and the online client all go through one rule
  (`castPregameVote`), and the vote tells the screen (`changeAllowed`).
- **Between the votes**, over the result's last 0.65 s, everyone walks back to their spot and the banner fades, so
  the second vote opens with everyone home.
- **The hand-off.** Over the last vote's final 0.95 s, the zones, pawns, counts, banner and cards fade (0.28 s); then
  the real pieces drop into the starting position (pawns first, the rest 0.11 s later; 0.38 s), and the eval bar
  appears. The game's first screen takes over with the same pieces in the same place: no flash (checked frame by
  frame, light and dark), and the board's box is the same to the pixel.
- **The board's box.** It used to move: on a phone the vote's board was 20 px wider and 8 px lower than the game's, and
  on a computer the vote had no leaderboard beside it. The vote now uses the game screens' frame: the title in the
  top line ("Vote 1 of 2" over "How does it end?", the sound button beside it), the hint in the line above the board,
  and the eval bar's slot (hidden until the pieces come). On a computer the leaderboard sits beside it as in the
  game (from 1100 px), and the cards take the panel's place. With the scoreboard minimised (its own setting), a
  phone's game board is bigger, and so is the vote's. Checked at 360 and 390 px and at 1000 and 1280 px.
- **Board orientation** as before: from Black's side the board, the zones and the cards are mirrored, and Black's
  pawns are at the bottom.
- **Animations off** (the Crowd setting): pawns jump instead of gliding. Reduced motion: fades only.
- **Gone:** the pawn pushes (`voteMoves`, `voteOptionOf`).
- **Checking it.** `npm run frames:vote -- <dir> [light|dark] [width] [w|b]` records every frame of both votes on a
  narrow phone with a real finger (a drag in the first vote, a tap and a tap in the second) and the hand-off, flags
  flashes and says whether the board's box moved. `e2e/votes.spec.ts` drags with real touch on the phone (a mouse on
  the computer), and checks the Variable clock (10 s on move 1, 15 s on move 6).

### Vote board follow-ups (Eric, Oct 7, 2026)

Eric, after seeing the vote board: no halo or "You" banner under your pawn; the same size as everyone else's, "maybe
just 10-15% bigger if that"; "fully solid and not a ghost" (a card tap works too, so finding your pawn isn't a worry);
8 seconds a vote; and "when not moved it defaults to the most popular one". Also more variety in the bots' names and
outfits. Mine:

**Your pawn.**
- Everyone else's size times `voteYouScale` (1.12, settings.ts): 0.70 of a square, 25 px on a 360 px phone (theirs
  22 px). Fully solid; no ring, "You" tag, blue glow, white edge or bob. Still drawn above everyone else's.
- Kept: it rises a little when you tap it (the zones pulse), and grows slightly while it's under your finger. That's
  feedback while you move it, not a marker.
- The area that takes your touch is invisible and 2.2 times the pawn (about 55 px on a 360 px phone), so a tap just
  beside it picks it up (`e2e/votes.spec.ts` taps off its edge).
- Its starting spot is your seeded spot, kept inside the board's edge; it's no longer pulled in to fit a ring and tag.

**8 seconds.** `voteSeconds` was already 8. Checked on screen: the timer bar's window is 8000 ms solo
(`e2e/votes.spec.ts`) and online (`e2e/formats.spec.ts`, "Play now"). Left as it was.

**Not moved means most popular.**
- One rule, `closePregameVote` (votes.ts), used by solo and the lobby server; the app shows what they send. When
  time's up the winner is counted first (a tie drawn among the tied, as before; nobody voting gives the default:
  Team final, Variable), then everyone who didn't vote, people and bots alike, is added to the winner. They're added
  after the count, so they never change the outcome; the final counts and the pawns show them. Each one is marked
  `joined` in the vote (protocol `NetVote`), so the app can tell them apart.
- **A few bots don't vote** (`voteBotSkip`, 10%), as a real crowd wouldn't all vote. That way the rule shows in every
  match, not only when you sit one out. It doesn't sway results: the lean is drawn the same way and the abstainers join
  the winner afterwards.
- **On screen.** At time's up the winning zone lights and the non-voters walk into it (the usual 0.7 s glide),
  each count popping as they land. The banner waits until they've landed, because it covers the zones and would hide
  the walk. So the result shows for 3.2 s (`voteResultSeconds`, was 2.5): the walk plus the banner's time as before.
  The line above the board says "You didn't vote, so you're with the crowd." if you didn't, else "Didn't vote?
  You're with the crowd." for about 1.8 s, then the countdown to what's next. Nothing new covers the board. How to play
  says it too: "You have 8 seconds; if you don't vote, you go with the crowd (the most popular choice)."
- Online, a vote that reaches the server after time's up doesn't count, as before: the server joins you to the winner
  and your pawn walks there from where you put it.

**Bot names.** 72 more (140 in all), so a 100-player lobby (99 bots) never repeats one; past 140 the numbered
fallback ("Queenie 2") stays. Same style: chess terms, openings, mates and puns, most with an alliterative first name
("Zeitnot Zelda", "Ladder Lola", "J'adoube Jade", "Rook and Roll"). None is a real player.
- **Measured, not counted.** On a 360 px phone the scoreboard's name column is 103 px (bold 12 px). Every new name
  fits it with room to spare: 97 px at most in Arial's widths, since an iPhone's font runs a little wider. The first
  list had six that didn't fit ("Woodpusher Woody", 120 px) and five near the edge; they were swapped for shorter ones.
- Three of the older names don't fit and show with "…" ("Queen's Gambit Quinn", "Trompowsky Trina", "Zwischenzug
  Zak"). They're left as they are; `e2e/crowd.spec.ts` uses them as the longest real names.

**Bot outfits** (`botLook`, core/bot-looks.ts; odds `BOT_LOOKS` in settings.ts).
- Out of 100: 42 plain; 24 a shop hat; 11 a crate head piece (beanie, antlers, Santa hat, present); 11 a face piece
  (Santa beard, ski goggles); 5 a weapon (gift-wrap tube, candy cane); 7 two things (a hat, then a face piece, or now
  and then a weapon). Never more than two.
- **Seeded by the bot's name**, not its id. Bot ids are `bot0` to `bot98` in every match while the names are shuffled,
  so seeding by id would give the same seats the same clothes each match and a name a new outfit every time. By name,
  "Gambit Gus" always looks like Gambit Gus.
- Only items that already exist, drawn by the usual `Avatar`. No skins (they replace the pawn, and with it the team's
  colour, which the vote board and the cut screen read by). Not the Mythic Fire & Ice Crown (the rarest item stays
  the players'). Colours by the crates' odds. Purity evenly 55-88%: clean enough to read on a 22 px pawn, and never
  shiny (90%+), which stays the players'.
- Checked on a 360 px phone on the vote board, the cut screen and the scoreboard (the scoreboard shows names only).

**Checking it.** `npm run frames:vote -- <dir> [light|dark] [width] [w|b] [plan]` now takes a plan per vote
(`drag`, `tap` or `none`; default `drag,tap`). `none,tap` records you sitting out the first vote and walking to the
winner. Its timeline logs the line above the board, the banner and how many joined.

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

## Capacity: what if 10,000 players arrived? (assessment, Oct 7, 2026)

Eric asked whether the servers could take 10,000 players at once. Short answer: the design scales, but three single
points would choke first, and we've never load-tested it.

**What already scales**
- **Matches:** each match is its own Durable Object, and Cloudflare spreads them over its machines. 10,000 players is
  about 100 Crowd matches at once, which is no problem in principle.
- **Scoring:** today it runs on players' own devices, so it grows with the player base for free.
- **The app itself:** files served from Cloudflare's edge.

**What would choke first**
1. **The matchmaker is one object for the whole world.** It handles one "Play" press at a time and waits on lobby
   objects inside each, so thousands pressing Play in the same minute would queue up behind each other.
   - Fix: keep queue tickets in memory, form lobbies on a one-second timer, and split the matchmaker by mode and
     region.
2. **The database (D1) is one SQLite database.**
   - Every request updates "last seen", and every running match reports itself at least once a minute. At 10,000
     players that's hundreds of writes a second into one database, near what a single D1 database handles.
   - Fix: write "last seen" at most once a minute per player, and keep live counts in memory (a Durable Object) instead
     of database rows.
3. **The engine server** runs on at most 2 containers with a cap of 3,000 deep searches a day. At scale the cap runs
   out early each day.
   - Then phones take over the re-checks: the game keeps working, but cuts are slightly less fair.
   - Raising the cap costs money (Eric's call).

**Rough cost at that scale**
- Cloudflare charges by use (about $0.15 per million Durable Object requests, and about $12.50 per million GB-seconds
  of object time).
- 100 matches running around the clock is very roughly $100–500 a month; real traffic peaks for a few hours a day, so
  far less in practice.
- The load test below would give a real number. Set a billing alert first.

**What to do before any launch push** (the `ops` delegate):
- **A load test:** a staging copy of the site and simulated players (scripted connections that join, pick moves and
  chat) at 1,000, then 5,000, then 10,000. Measure where it breaks.
- **Fix the three choke points** above.
- **Monitoring and alerts:** errors, object CPU, database latency, queue waits and spend.
- **Fail gracefully:** a "servers are busy, you're in line" message rather than errors.
- **Per-player rate limits** on the API.

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

## Many judges (Oct 8, 2026)

Eric approved: online scores must be trustworthy (a modified browser could fake them, and one host did all the work),
before ranked opens. Built by the `engine` delegate. Numbers: `reports/judge-determinism.md` and
`reports/many-judges.md`.

**How it works**
- **A speed check on joining.** Each app times one 150k-node search (`UciEngine.speed`) and tells the lobby
  (`speed`). An app that never says (an old tab) is never a judge.
- **Two judges per board.** As a round starts, the lobby draws each board's two judges at random, weighted by speed
  cubed (a computer is drawn far more often than a phone), the costliest boards first, a device's weight dropping with
  each job it already has. The judges search the position while players think (the prefetch, as the host did).
- **The job names nobody:** the position, the people's picks (sorted, one per picker), the bots' skills and a seed. A
  judge runs exactly the host's old searches (`runJudgeJob`) and sends back the engines' raw output. The lobby works the
  board out from it with the same code (`judgedBoard`): the best move, every score, and the bots' picks, drawn from the
  seed (so two honest devices pick the same bot moves, and a report that doesn't follow from its own numbers is caught
  on its own: a strike).
- **The engine is deterministic,** so two honest answers are identical, not just close. Measured on 201 realistic jobs
  (498 searches, the device's own re-check included): identical on two separate engine processes, on a "used" engine
  that had just searched elsewhere and played a boss move, and in a Web Worker in Chromium. The build has no
  relaxed-SIMD instructions, the one WebAssembly feature that may differ between CPUs. So the lobby demands an exact
  match (`JUDGES.tolerance` 0). Not tested: a real ARM phone; any platform difference would show at once in the logs
  as honest devices disagreeing.
- **Agree:** used. **Disagree:** the engine server scores every move either judge scored at its deep node count, and
  its numbers are used. Blame: a third device gets the same job (a second opinion, which holds nothing up); the judge it
  doesn't match exactly gets a strike. Without a third device, the judge further from the verdict on the disputed moves
  is struck if it's further by `JUDGES.blameMargin` (4) points. Two strikes: no more jobs that match (and no more
  hosting). Every disagreement, strike and fallback is logged.
- **Never slower.** After the first answer the lobby waits `graceMs` (150 ms) or a quarter of the first's time for the
  second, then uses the first alone. The late answer is still compared when it comes; a disagreement is then settled
  for blame (the third device, the server). A device with a strike is never trusted alone. A judge that drops is
  replaced; a job whose second judge never answers gets a spot check on the server 25% of the time
  (`spotCheckShare`), blamed only past 50 points (`soloBlame`, above the worst honest difference measured, 47.5:
  a phone's quick search and the server's deep one can differ that much on a sharp move).
- **No engine server** (down, out of budget): the judges re-check close calls themselves (checked like the rest), and a
  dispute waits up to 5 s for the third device: two of three decide. No third device: the judge with fewer strikes,
  then the faster, stands (as the host's did), and the logs say so.
- **Close calls get depth, wider.** Picks by players within 25 points of the cut line (each team's line in 50 v 50)
  are re-checked first, from 1 point of loss (`recheckCutLoss`, `recheckCutMax` 5, `recheckCutPoints`), on top of the
  usual ones; any tie in which moves to re-check is now broken by the move, so every device and the server choose
  alike. With judges the re-check goes to the engine server once the judges agree; it applies to the host's path too.
- **Unchanged:** solo, bot-only rounds, a lobby with one device that can judge (the host scores, as before), boss moves
  (the host). `JUDGES.on = false` turns it all off. Nothing on screen changed.

**Tested against liars** (`packages/sim/scripts/many-judges.ts`: the real lobby logic, whole Crowd matches, real
Stockfish, simulated time; cheaters claim 3M nodes/s to be drawn as often as possible; 2 matches per scenario, each
also played the old way):

| Scenario | Cheater's gain, old way (points) | With judges | Cheater benched at round | Honest devices struck |
|---|---:|---:|---|---:|
| Scores its own pick as the best | 364 | 0 | 4, 3 | 0 |
| Random noise on every score | (noise, not a gain) | 0 | 2, 2 | 0 |
| Every move as good as the best | 88 | 0 | 2, 2 | 0 |
| Answers from a 5k-node search | 15 | 0 | 2, 3 | 0 |
| Inflater, with dropping and slow phones | 364 | 0 | 6, 3 | 0 |
| Inflater, engine server down | 581 | 0 | 4, 3 | 0 |
| Only two devices: a fast inflater and an honest phone | 213 | 23 | 10, 11 | 0 |

- Scores matched the honest devices exactly on every job two honest judges settled (none moved, 0.0 points), and the
  rest used the engine server's verdict or two of three devices. Every cheater was benched in every match; no honest
  device was ever struck.
- The one gap: with only two devices, a fast cheater's answer is used alone when its honest partner is a slower phone,
  until it's caught (its first lie is caught when the phone's answer comes). Seven such jobs in two matches, 23 points
  in all (the old way: 213).
- **Timing** (lock to reveal, simulated): with two computers judging, the same as the old way (median 287 ms); with a
  computer and a phone, 150 ms more (437 ms, the grace); the 95th percentile is the server's re-check either way
  (about 3.4 s). `graceMs` 0 makes it never slower at all, at the price of relying on the late comparison.
- **Engine server calls:** about the same as before: 15–20 per Crowd match (mostly close calls before cuts, the
  widened set included), plus about 2 verdicts per cheater per match and the odd spot check.

**Left, or for the director**
- *Proposal (a visible change, so not built):* when a late answer shows the one used was a lie, correct that round's
  scores before the next cut. That would close the two-device gap above.
- Two cheaters colluding (both drawn for the same job, both lying the same way) would agree and pass; random draws make
  it rare with many devices, and spot checks don't catch it.
- Crowd's early bot picks (shown live) still come from one judge; the scoring job checks them (a wrong plan: a strike),
  but the live tally could have been wrong for that round.
- A quirk found on the way, left as it is (it would change every score): Stockfish's MultiPV output, cut short by the
  node budget, sometimes lists one move on two lines with different scores; the later line's score is kept.
- Server budget: with judges, the cap of 3000 searches a day lasts about 190 Crowd matches a day (16 searches each),
  then devices' numbers stand. Raising it is Eric's call (cost scales with the cap: about $25 a month per 3000 a day,
  worst case).

## Capacity: built (Oct 7, 2026)

The `ops` delegate's work on the assessment above. Eric: server cost isn't his worry; make it ready so popularity
never catches us out. Reports in `reports/load/`; how to run them, staging and monitoring in DEPLOY.md.

**The load test** (`scripts/load/`)
- Simulated players speak the real protocol: a guest account (GET /api/me), the home screen's live line every 5 s,
  PLAY, the lobby's WebSocket (hello), votes, a random legal move (chess.js) within each clock (3% miss it), a
  quick-chat line in 10% of rounds, the 30 s heartbeat, then they leave (at the results, or after `--session`).
- Whoever the lobby makes host answers the host's work (scores, bot plans, the boss's move) with deterministic fake
  numbers at once, so the test measures the servers, not Stockfish.
- It measures PLAY → lobby (until the lobby's welcome), the queue wait, the round trip of a pick (until the server's
  "moved") and of a chat line, every HTTP call and the server's own time for it (a `Server-Timing` header), errors and
  dropped sockets. With `OPS_STATS` set (local and staging only) the server counts D1 statements by table, requests
  by route and Durable Object calls (`/api/ops/stats`, `ops.ts`).
- `scripts/load/burst.ts`: N PLAY presses at the same moment, no sockets: the matchmaker alone.
  `scripts/load/record-size.ts`: how big a 100-player lobby's stored record gets.
- **Local limits:** wrangler runs every Worker and Durable Object in one process, which saturates one core at about
  1,000 players. So locally we find code-level choke points (calls, writes, serialisation) and compare before with
  after; absolute capacity needs staging (below). Its dev proxy also drops requests when that process is saturated
  (the "play 500" rows in the local reports, before and after alike; not a server error).

**Before** (main at a5fd5c8 plus the counters; 500 players over 20 s, and 1,000 over 30 s)
- **The matchmaker overfilled lobbies.** It handed out the filling lobby's code until 100 people had *connected*,
  but players connect a second or two after PLAY answers, so in a surge it promised the same lobby to far more than
  100. 124 of 500 and 365 of 1,000 players got "This match has already started". In the burst test all 1,000 PLAY
  presses were given one 100-seat lobby.
- **It serialised:** one PLAY at a time, each waiting on a call to the lobby object inside `blockConcurrencyWhile`
  (1,000 presses = 1,000 locked cross-object calls; server time p50 655 ms at 500 players, 1.1 s at 1,000).
- **D1 writes:** 1.8 per player per minute in steady play (the conditional `UPDATE users SET last_seen` on every
  request and heartbeat, 1.46, and `live_lobbies` reports, 0.31), plus a guest account's two inserts once. That's
  ~300 writes/s at 10,000 players, in one SQLite database.
- **Every new Worker instance ran ~35 schema statements** (CREATE IF NOT EXISTS, PRAGMA, ALTER) against D1. In a
  surge Cloudflare starts many instances at once.
- In matches a pick's round trip was fine at 500 (p50 47 ms) and 2.2 s at the p90 with 1,000 (the one process).

**What changed**
1. **Matchmaker** (`matchmaker.ts`, pure logic in `queue.ts`): a PLAY press is a ticket in memory; tickets are seated
   in batches. A batch starts as soon as the last one finishes (so a lone press isn't held up; under load batches grow
   by themselves), and again every second (`CAPACITY.queue.formEveryMs`) while anyone waits in line. Each batch makes
   one seat-reservation call per lobby (`Lobby.reserve`), and a new lobby takes its reservation in its `create`
   call. A lobby counts promised seats (held 20 s for the player to connect) as taken, so it's never overfilled; a
   cancelled seat goes to the next player as before. Nothing waits on another object while holding the queue.
   - Kept: 60 s fill then bots, Boss raid's own queue, `?pool=` test queues, private code lobbies untouched.
   - Why not "form lobbies only on a 1 s timer", as the assessment said: it would add up to a second to every PLAY at
     quiet times. Batching as soon as the last batch is done gives the same grouping under load and none of the wait.
   - **Ranked's hook:** `MatchRules.group(tickets, now)` returns groups that never share a lobby (a ticket can carry
     `info`, such as a skill estimate); tickets it leaves out stay in line, in order. The default fills in order. The
     queue's name has a slot for a region (`queueName`, `regionOf`, location hints), off until there are players
     enough (`CAPACITY.queue.byRegion`).
2. **Overload** ("degrade, don't die"): at most `admitPerSecond` (300, burst 600) players a second are let into
   lobbies per queue, and none while more than `CAPACITY.overload.maxPlayers` (20,000) people are in lobbies (the
   live hub's count). Beyond that PLAY answers, after holding up to 2.5 s for a seat, `{ busy, ticket, position,
   waitSeconds }`. The queue screen shows **"Servers are busy, you're in line: about N s"** (N: place in line over the
   admission rate, or the last minute's real rate when the player cap holds the line; rounded up to 5 s) and asks
   again every 3 s with the ticket, keeping its place. Cancel leaves the line. People in lobbies and matches are
   never affected. An old app that doesn't know "busy" shows the same sentence as its error.
   - The queue screen change is the smallest that shows it (`QueueLine` in Queue.tsx: the queue's header, line,
     empty grid and Cancel, "You're in line"). Checked at 360 px (`e2e/busy.spec.ts`).
   - Why 300 a second and 20,000: 10,000 players arriving in one minute is 167 a second, so 300 never slows a real
     surge, but a burst far past anything we've measured is metered instead of hitting every object at once. 20,000
     people is twice the target; past it we're beyond anything tested. Both are settings.
3. **The live hub** (`live-hub.ts`, a new Durable Object, `LIVE`; pure logic `LiveBoard` in live.ts): who's online,
   which lobbies are running or filling, kept in memory. The live line's numbers are the same as before (a test
   checks the two give identical numbers for the same events):
   - Each Worker instance batches who it has seen and passes them on at most every 5 s (`presence.ts`); a player's
     first request in a minute is passed on at once, so you count the moment the home screen loads. The heartbeat's
     session lookup is cached per instance (10 min), so a heartbeat is usually no D1 call at all.
   - Lobbies report changes at most every 2 s (the latest state follows when the 2 s are up), and at least once a
     minute; the hub keeps them in its own storage, so a restart keeps the playing-now list, and seeds who's online
     from D1's last minute.
   - `users.last_seen` (profiles' "last seen") is written by the hub once a minute per account at most, in one
     statement per 500 accounts. A profile's "online now" asks the hub.
   - Without the binding (unit tests), everything falls back to D1 as before.
4. **Schema check:** a database already at the current schema answers one read (`meta.schema`, a fingerprint of
   every schema statement) instead of ~35. Production showed why it matters (the Server-Timing header from step 1,
   Oct 8): at today's low traffic requests keep landing on fresh Worker instances, and every route that touches D1
   took about 1 s (`/api/profile/x` 1,012-1,061 ms, `/api/live` 1,056-1,464 ms) while one without D1 took 0-42 ms
   (`/api/auth/config`).
5. **A lobby's stored record:** each person's last message (re-sent on reconnect) is stored under its own key, and
   only when it changes. Measured with V8's serialiser (what Durable Object storage writes), a 100-player record is
   about 150 KB (the 2.4 MB JSON size is misleading: JSON repeats the standings every message shares); a pick now
   writes about 80 KB instead of about 150 KB.
6. **Rate limits** (`limits.ts`, `CAPACITY.rateLimits`): per address 10,000 a minute (a school or a mobile network
   shares one address), per account 1,200 a minute, PLAY and new lobbies 40 a minute per account (in line asks 20
   times). The per-account limit was first 300 (the home screen asks 12 times a minute); it's 1,200 so a burst of
   reloads and reconnects (a match screen makes several calls each time it opens) never gets near it, while a script
   in a loop, making hundreds a second, still does. (A flaky panel test was first blamed on the 300; it wasn't the
   cause: see LESSONS, "One lucky pass taken for a cause". The higher limit stays on its own merits.) Past one: 429 "Too many requests. Wait a few seconds and try again."
   with `Retry-After`. Counted in each Worker instance's memory, so they stop runaway clients and scripts, not a
   determined attacker (that's Cloudflare's WAF rate-limiting rules, Eric's call if ever needed). `LOAD_TEST=1`
   (staging only) lifts the per-address one, since every simulated player comes from one machine.

**After** (same runs)

| | Before | After |
| --- | --- | --- |
| 500 over 20 s: players who got into a match | 308 of 500 (124 overfilled) | 453 of 500 (0 overfilled; 47 local proxy drops) |
| 1,000 over 30 s: players who got into a match | 406 of 1,000 (365 overfilled) | 658 of 1,000 (0 overfilled; 342 local proxy drops) |
| Burst of 1,000 PLAY at once | 1 lobby promised to 1,000; 1,000 locked calls | 10 lobbies of 100; 23 calls |
| Burst of 2,500 PLAY at once | (not run: the same overfill) | 25 lobbies of ≤ 100, 39 told "busy, in line", 0 errors |
| PLAY, server time p50 / p99 (500) | 655 / 2,725 ms | 21 / 95 ms |
| PLAY, server time p50 / p99 (1,000) | 1,072 / 3,857 ms | 66 / 263 ms |
| Heartbeat, server time p99 (1,000) | 3,514 ms | 94 ms |
| D1 writes per player per minute (steady play) | 1.8 (≈ 300/s at 10,000) | ≈ 0.01, plus one batched last_seen statement per 500 players a minute (≈ 2/s at 10,000) |
| D1 statements per new Worker instance | ~35 | 1 |
| Pick round trip p50 / p90 (1,000) | 83 / 2,166 ms | 47 / 628 ms |

**In production** (Server-Timing, the Worker's own time per request, sampled before and after the deploy on Oct 8):
`/api/live` 886-1,464 ms → 79-279 ms; `/api/profile/…` 805-1,061 ms → 34-106 ms. Most of it is the schema check: at
today's traffic requests keep landing on fresh Worker instances, and each ran ~35 D1 statements first.

**Where it breaks next** (from the numbers above and Cloudflare's published limits; staging will confirm)
- **The live hub and each matchmaker are single objects.** At 10,000 players the hub gets roughly 200-400 calls a
  second (instances' batches, lobby reports, arrivals, the live line); a Durable Object manages about 1,000 simple
  calls a second. Next step if it's hot: shard presence by account id across a few hubs and sum them.
- **Results at the end of a match** are written one statement at a time per player (about 5 each): a 100-player
  match ending is ~500 sequential D1 statements from that lobby, and 10,000 players finishing every ~15 minutes is
  ~50 writes a second. Fine for D1, but the next thing to batch (D1's `batch()`).
- **Requests (cost, not capacity):** the home screen asks for the live line every 5 s. At 10,000 players on the home
  screen that's 2,000 requests a second (≈ $0.30 per million beyond the plan's 10 million a month). Worth 10-15 s if
  it gets busy (the hub's lane).
- **The engine server** (below): 2 containers and 3,000 re-checks a day run out within the first hour at this scale;
  phones then do the re-checks (cuts slightly less fair).

**Staging and the big runs:** no Cloudflare API token was available in this session, so staging is prepared, not
run: `env.staging` in wrangler.jsonc (its own Worker, Durable Objects and D1; no engine, no sign-in, `LOAD_TEST`),
`scripts/load/staging.sh up | run N | down`, and the token's exact permissions in DEPLOY.md. One machine like this
container (4 cores) can drive about 5,000-6,000 simulated players; 10,000 needs two.

**The engine server at 10,000 players (a recommendation; not changed, it's shared with the `engine` delegate)**
- Demand: ~100 Crowd matches at once, each about 40 rounds in ~15 minutes, most with a close call re-checked (~3 s
  of one core each): ~16,000 re-checks an hour, ~45 core-hours an hour, i.e. ~13 standard-2 instances busy at peak.
  Today: 2 instances (at most ~2,400 re-checks an hour) and 3,000 a day.
- Cost: a standard-2 (1 vCPU, 6 GiB) awake costs about $0.13 an hour at Cloudflare's container rates (memory
  $0.0000025/GiB-s, CPU $0.00002/vCPU-s), about $0.0001 a re-check. 64,000 re-checks a day (four busy hours) is
  **about $200 a month**; around the clock at that load, about $1,200.
- Recommendation, when real traffic gets near it: `max_instances` 16 and `ENGINE_DAILY_SEARCHES` 60,000 (≈ $200 a
  month at the cap), plus the cheaper wins first: cache analysed positions (Crowd games share openings) and re-check
  only cuts that matter (the bottom few places). Until then, today's 2 and 3,000 keep the worst case near $25 a month.

**Rough running cost at 10,000 players at once** (estimate; staging will give a real number): Durable Object time
≈ $0.0015 a match (a lobby awake ~15 minutes at 128 MB), so 100 matches at once around the clock ≈ $400 a month;
Worker requests ≈ $20 a day at that polling; D1 well inside the plan. Real traffic peaks a few hours a day, so a
fraction of that. Set the billing alerts in DEPLOY.md first.

**Staging results (Oct 8, 2026)** (`reports/load/staging-*.md`; staging torn down afterwards). **1,000 players**
(60 s ramp, 5 min each), on a warm database: all 1,000 played, no errors and no dropped sockets. PLAY p50 71 ms /
p95 ~0.5 s; heartbeat p50 37 ms; lobby moves (pick round trip) p50 228 ms / p90 734 ms; D1 0.3 writes/s. The
strain was guest sign-in: `/api/me` p50 15.7 s / p90 19.9 s, which also made PLAY-to-lobby 12 s p50; `/api/live`
p50 1.3 s. The first 1,000 run, on a brand-new database (`staging-1000-cold-db.md`), lost 596 players: every new
request ran the whole schema migration (644 CREATE statements) into the one database and `/api/me` timed out.
**5,000 players** (120 s ramp): only 1,177 got in. 3,823 failed at `/api/me` with 500s (plus 338 `/api/live` and
370 heartbeat 500s). The players who got in played normally: PLAY p50 58 ms / p99 447 ms, moves p50 63 ms, chat
48 ms. D1 2.1 writes/s. **The choke point is D1 on the sign-in path**, made worse by a feedback loop:
`ensureSchema`'s `meta` read is `.catch(() => null)`, so a busy or timed-out D1 looks like "no schema" and the
request runs the ~35-statement migration (383 CREATEs on a warm database at 5,000). Proposed fixes, for `ops`:
(1) in `ensureSchema`, only migrate when `meta` is really missing (rethrow other errors) and share one in-flight
promise per isolate; (2) make guest creation one `db.batch` (insert user, insert session, read profile) instead of
~10 sequential round trips; (3) cache `/api/live` across isolates (KV or the LIVE Durable Object) rather than per
isolate; (4) re-run 5,000 on staging, then 10,000 from two machines.

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

## Deep checks on players' computers (Oct 8, 2026; built, ships off)

Eric's idea, via the director: have two fast computers re-check the close calls before a cut instead of the engine
server, so the server is only used when a lobby has no capable devices or the devices disagree. Then Eric set the rule
for all engine work: fair scoring, correct results and smooth play first; players' devices wherever they can do the
job; our servers when truly needed, never skimping. Numbers: `reports/deep-timing.md`, `reports/deep-accuracy.md`,
`reports/deep-checks.md`.

**Built** (`JUDGES.deepOnDevices`, with tests and an e2e check):
- A capable device is a computer (never a phone: a 2M-node search every round drains a battery) whose speed check
  says it can do at least 1M nodes in 3 s (about 390k nodes/s). With two capable devices connected, a board's two
  judges are drawn from them, and the job asks them to re-check the close calls too, at the depth the slower one fits
  in 3 s (what the server takes today), at most the server's 2M.
- The device sends its quick answer first, as before, then its re-check (`judgedDeep`), so the quick numbers never
  wait for it. Both re-checks exactly alike: used. They differ (a strike for the one further from the server's), or
  don't come within 3.5 s: the engine server re-checks, as today.
- Measured in Chrome on this machine (`deep-timing.ts`): the app's engine runs about 490k nodes/s, so 2M nodes take
  4.1 s and 1.2M fit the window. The speed check (150k nodes) reads the same speed, so it predicts the re-check's time.

**Why it ships off.** The browsers' engine is the lite network; the server runs the full one. On the 267 close calls
of the judge-accuracy positions (`deep-accuracy.ts`), re-checked as the game does at 2M nodes:

| Re-check | Off the referee by 10+ points | Top-quarter players cut unfairly | Top-half players cut unfairly |
|---|---:|---:|---:|
| Engine server (full network) | 26 of 267 | 0.37% | 2.09% |
| Two computers (lite network) | 43 of 267 | 0.63% | 3.52% |

About 1.7 times as many unfair cuts. By Eric's rule, close calls stay with the server. The full network on computers
would match it, but in Chrome it runs at 260k nodes/s here (8 s for 2M nodes: too slow for a round), and its 99 MB
file is over Cloudflare's 25 MiB limit for a static file. Turn the switch on only with a device engine measured as
good as the server's (`deep-accuracy.ts`, then `judge-cuts.ts`).

**What it would save** (`many-judges.ts`, JUDGE_OUT=deep-checks; 6-person Crowd matches, 2 each):

| Capable devices in the lobby | Engine-server calls per match, as shipped | With the switch on |
|---|---:|---:|
| 0 | 15.5 | 15.5 |
| 1 | 15.5 | 15.5 |
| 2 | 15.5 | 0 |
| 5 | 15.5 | 0 |

(With the switch on and two computers, a round's wait for close calls fell from about 3.3 s to 2.2 s at the 95th
percentile.) A lobby has fewer than two computers 15% of the time at 10 people and 1% at 20, assuming 30% of players
on computers (with 20%: 38% and 7%); a ranked match (30+ people) almost never.

**Shipped (they cost nothing in fairness or time):**
- **Knocked-out players keep judging** while their page is open (watching, the cut screen, results), invisibly. It was
  already so in the lobby (judges are any connected device); now tested, and covered by the harness.
- **Disputes, never slower:** when two judges disagree, a third device (a capable one if the job carries a re-check)
  and the engine server are asked at the same moment; whichever settles it first stands: two of three devices exactly
  alike (the honest number, which is what agreement would have given), or the server's verdict. The server is still
  asked every time (disputes only come from cheaters, about 2 per cheater per match), because a third device can
  be slow, and a round must never wait longer than it does for the server. A late answer that disagrees is settled
  for blame by a third device alone when there is one (no server call).
- **Live players judge their own boards** (they always did: a job names nobody, and an exact match with an independent
  device catches a lie). The harness covers a lobby down to two people, both judging, and the endgame below.

**A match's endgame** (20 people, 6 on computers; a share of the knocked-out close the tab): the server is called
about 22 times a match as shipped, worst case 22 ($0.0022 at $0.0001 a search), almost all during the cut stages
with 8+ people connected (0.22 calls a round). In the last 10 rounds (the final, with 1–14 people connected,
depending on how many left) there were no calls at all: a final turn has one pick, rarely a close call, and no cut line.
With 90% leaving, one person was left connected at the end, and the host path scored it as before.

## Boss characters: style test (Oct 8, 2026)

Phase 1, before building any boss into the game: two bosses drawn as code-defined pixel art, to check the look with
Eric. Nothing in the game changes yet; the bosses still show as emoji icons.

- **What's drawn:** the Black Knight, after Eric's reference picture (a dark armoured knight, plumed helm, winged
  spear, ragged cape), and the Pawn Golem (a white stone pawn come to life, gold runes, floating boulder fists). Each
  has an idle loop (8 frames) and an attack: the knight's spear thrust (wind-up, lunge, a spark at the tip), the
  golem's two-fisted ground slam (fists over its head, a blur, dust and stone chips). Preview:
  `npm run preview:characters -- <dir> [ref=picture.png]` writes GIFs at 4x, frame sheets and a phone-size comparison.
- **Pixel art from parts, not whole frames** (`packages/app/src/characters/`): a palette, small grids of palette keys
  (typed by hand for hard surfaces, painted with shapes for cloth and stone), and frames that stack the parts at
  whole-pixel offsets, with quarter turns, mirroring and ripples for cloth. Why: an animation is a list of numbers
  (a lunge is `dx: -4`), so a boss's whole pack (idle, attack, hurt, death, taunt) costs a pose function, not dozens of
  redrawn frames; a recolour is a palette swap; and each part has its own outline, so the outlines stay right however
  the parts move.
- **Cues live on frames** (`cue: "thrust"`, `"hit"`, `"slam"`, `"impact"`): the sprite component will fire the sound
  and screen effect when that frame shows, so a sound pack lines up with the picture by construction.
- **Dark bosses on the dark ground:** the reference is nearly black, which vanishes on `#14161b`. The knight keeps the
  reference's near-black and warm highlights but a step lighter, and every boss gets a faint 1-pixel halo around its
  silhouette (not around its ground shadow or effects).
- **Eyes and runes as reactions:** the knight's eyes light red as he winds up, white-hot at the strike; the golem's runes
  breathe while idle and flare as it attacks. Palette flashes, so they cost nothing to add to any frame.
- The golem was picked over the Frost Dragon for the second boss: it's the first boss every new player meets, and a
  living chess pawn says "HunChess" more than a dragon does; a pale stone boss also shows the range against the
  knight's black steel.

### Boingo the Clown, the first boss built (Oct 8, 2026)

The clown on a pogo stick, from Eric's reference, is the 1500 raid boss (the Iron Bishop's placeholder slot). Built
end to end: sprite, portrait, animations, sounds, lines, and where he stands.

- **Name:** "Boingo the Clown" (short, says pogo; Eric can rename it in `packages/core/src/boss.ts`). His emoji is 🤡
  wherever a screen has no room for his drawing (the boss menu, the front menu).
- **Art:** my redraw (version 1 of the two style versions sent to Eric; the other was Gemini's clown converted 1:1).
  48 x 60 px from parts. The pogo's top is rigid, its spring slides, the gloves hold the handlebar and the shoes
  stand on the foot bar, and the body rides on top. He has eight faces (grin, laugh, hurt, smug, rattled, think,
  honk, out), so a new animation is a list of poses. If Eric picks version 2, only the parts change.
- **Where he stands:** kitty-corner across the board from the God King, never over a piece or a tap
  (`pointer-events: none`).
  - **Phone:** at the left of the boss bar above the board, since the God King is under it on the right.
  - **Computer:** by the board's bottom-left corner, at twice the size, since the God King is by its top-right.
  - The other layout's placement is hidden. His portrait takes the emoji's place in the bar, the "QUEEN DOWN!" banner,
    the entrance card and the God King's cut-in.
- **What he does, and when:** one moment per state change, all from the match state every player already has, so
  there are no new messages. The pure logic is in `characters/boss-beats.ts`.
  - **Entrance:** at the intro, he pops out of a puff of smoke and honks his nose.
  - **Thinking:** while the boss thinks, a hand on his chin and thought dots. **Hurt** comes first if the crowd's
    move took one of his pieces: a flash, crossed eyes, his hat knocked off.
  - **His move:** a hop, pointing. **Capture:** a laugh. **Check:** he honks his nose twice. **A strike:** he laughs.
  - **The crowd's turn:** his mood. **Smug** 3 or more pawns of material ahead, **rattled** 3 or more behind
    (sweat, a wobbly mouth), otherwise his idle: always bouncing, with a lower big jump every 6 s or so.
  - **Defeat:** he's knocked off the pogo and sits dazed. **Victory:** spinning leaps in confetti. Both also play on
    the results screen.
- **The mood comes from material, not the eval** (a change from the brief's "from the eval"). Each device works out
  its own eval, a moment apart and not always the same, but the board is identical everywhere, so material keeps
  every player's clown in the same mood.
- **In step online:** a moment's animation plays once from when this device first saw it, so a new screen mid-moment
  carries on rather than restarting; the loops run by the clock. A moment's key is its kind and the move number.
- **Lines:** short taunts in his own pixel text box, never instructions.
  - **Rare:** each kind of moment has a chance of a line (his plain moves 12%, thinking 8%, captures 60%, check 75%,
    his entrance and the end always).
  - **The same everywhere:** the line, and whether there is one, comes from a hash of the moment's key, so every
    player gets the same line at the same time.
  - **Mood lines** only when the mood changes.
- **Sounds:** synthesised in code (`characters/clown-sounds.ts`), so there are no files or licences: a pogo boing, a
  bulb-horn honk, a rubber squeak, a slide whistle up and down, and a kazoo laugh (no voice).
  - **Quieter than a move:** a unit test measures each one against the move sample's peak and mean level; each sits
    about 3 dB under it.
  - **Mute:** they play through `sound.ts`, so the mute switch silences them.
  - **No repeats:** his plain bounces are silent, and a sound never plays twice for the same frame (both placements,
    or a new screen).
- **Checking it:**
  - `npm run frames:character -- <dir> [boss] [phone|desktop|both]` screenshots a Boss-alone raid on a phone and a
    computer and saves the frames around him.
  - `npm run preview:characters` writes every animation as a GIF.
  - `e2e/boss-character.spec.ts` plays a raid against him on both layouts.

### Ginger, the Freeze boss, and the power art (Oct 8, 2026)

The gingerbread man from Eric's reference, drawn as the Freeze boss, plus the effect sprites his powers and Boingo's
need. The art, lines and sounds only: the power rules, the board overlays, the banners and making him playable are
the power rules' job (he becomes playable once he has powers too). `packages/core/src/boss.ts` is unchanged.

- **Name:** "Ginger" (Eric, Oct 9; drawn first as "Ginger Snap"). His kit is keyed by that name in
  `characters/kits.ts`, so the boss entry uses the same one. His "Snap!" lines stay: they're words, not his name.
- **Art** (`characters/gingerbread.ts`): 50 x 58 px from parts, in an 84 x 93 frame. Head (eight faces: angry,
  laugh, shout, hurt, smug, rattled, think, out; up to two cracks), torso with two gumdrop buttons and an icing belt,
  a green bow tie, and arms, legs and the cane painted from each pose's points (a shoulder, an elbow, a fist; a hip
  and a foot; the cane's grip and direction), so a new pose is a few numbers. The cane is in his right hand (our
  left), as in the reference.
  - **The frosty edge:** his icing's shadow is a cold blue, a frost glint runs round his icing while he idles, and when
    he casts his cane glows ice-blue (stripes recoloured, a pale rim round it) and his red eyes go icy.
  - **The cast points low:** he thrusts the cane forward and down across his legs, to his right, where the board is
    on both layouts (pointing it across his chest hid it behind his arms).
  - **Defeat:** cracked, he topples over on his side, the cane on the ground; no crumbling to pieces (drama, no gore).
- **Moments:** the same eleven as Boingo's (entrance: a whirl of snow, he drops in and slams the cane in a burst of
  frost; thinking: hand on chin, snowflake thoughts; move: a stamp and a cane jab; capture: a cackle, fist up;
  hurt: crumbs fly, a crack; check: two frosty cane lunges; smug; rattled: his icing sweats; defeat; victory: cane
  high, jumping in snow). Two power moments: `freezeCast` (cane raised and charged, then thrust; the bolt leaves at
  the "freeze" cue) and `blizzard` (cane high, snow whirling faster and wider, bursting at the "blizzard" cue).
- **Lines:** his own, short and cross (cookie and frost puns), as rare as Boingo's, plus three new moments for every
  boss: `power` (a piece frozen: "Freeze!", "Chill out!"), `ultimateWarn` ("A storm is brewing…") and `ultimate`
  ("BLIZZARD!", "Let it snow!"). Boingo got lines for them too (the pie, the funhouse). They're in the `Beat` type
  now; `bossBeat` doesn't produce them: the power rules say when they happen.
- **Sounds** (`characters/gingerbread-sounds.ts`, synthesised, no voice): a cookie crunch (hurt, defeat), a
  sleigh-bell jingle (entrance, his move, capture, victory), an ice crackle (frost slams, the cast, the ice) and the
  blizzard's wind (with the sweep). Seeded noise, so each is the same every time and testable. Each sits about 3 dB
  under a move's mean level, the wind about 5 dB (it's long), with a soft ceiling keeping peaks under half a move's.
  The shared synth helpers moved to `characters/synth.ts`; Boingo's sounds are unchanged.
- **Boingo's new moments,** added without changing his others: `pieThrow` (a pie up behind his head, wind-up, throw;
  the pie leaves at the "throw" cue, with a slide whistle) and `funhouse` (played on the board: his shadow grows, he
  drops in, lands with a boing, springs into a spin — the board flips at the "flip" cue — and lands laughing,
  pointing). New sounds: a pie splat and the funhouse boing-flip.
- **Effect sprites** (`characters/effects.ts`), each frame exactly the area it covers, so placing one is sizing its
  canvas to a square or the board:
  - `iceOverlay` (a square, 32 px): freeze (frost creeps in, the ice closes and flashes), frozen (loop, a glint now
    and then), thaw (cracks, chips, melts to a puddle, gone). The ice is see-through, so the piece shows under it.
  - `blizzardSweep` (the whole board, 24 px a square): a ragged cloud front and driven snow crossing left to right in
    1.3 s, a haze thinning behind it; the wind starts with it.
  - `pieSplat` (a square): splat (the pie comes down, SPLAT, cream flies), pied (loop), fade.
  - `iceBolt` and `pieFly` (a square each, loops): the bolt and the pie in flight, for flying them to the square.
- **Renderer:** a palette colour may be `#rrggbbaa` (see-through), for the ice and the haze. Old palettes are
  unaffected.
- **The contract** (`characters/power-art.ts`, also exported from `characters/index.ts`): `POWER_MOMENTS` (per boss:
  each power's animation, the cue of its hit, whether it plays on the board, the effects that follow), `EFFECTS`
  (each effect's sprite, what it covers, its start, loop and end animations, its sounds), `EFFECT_NAMES`,
  `POWER_ANIMS`, `cueAt` and `animLength`. `components/BossEffect.tsx` plays any of it (`<BossEffect>`, and
  `<BossMoment>` for a boss's animation away from his spot), with its sounds from the frames' cues, once, through
  the mute switch, from a shared start time so everyone online sees the same frame.
- **Checking it:**
  - `npm run preview:characters -- <dir> only=gingerbread` writes his GIFs; the effects are drawn over the board
    (a white pawn under the ice) as `fx-<id>-<anim>.gif` (`only=fx` for just those).
  - `npm run frames:character -- <dir> Boingo both kit="Ginger" fx` plays a raid with his kit in Boingo's place,
    then plays every effect and power moment over the real board and his spot, with frames every ~70 ms.
  - `packages/app/test/gingerbread.test.ts`: his kit, lines, cast and sounds; the power moments; the effects.

### Ideas for later, not built (Eric, Oct 8, 2026)

- **Real boss abilities, never game-breaking:** freezing most of the team for a turn, or making the crowd move a
  particular piece, but only when that piece has a move that isn't a blunder. They need the rules, the server and
  the engine (the director's call, with `engine` and `god-king`).
- **Bosses jumping to the centre of the board to cast something** (an ability's wind-up), the way the God King leaps
  onto the board.
- **More bosses drawn from Eric's references:** a farmer with a string trimmer, and a gingerbread man with a candy cane.

## Boss powers and the boss raid rework (design, Oct 8, 2026; the template, Freeze and Boingo built: see below)

Eric's design, with the director's review folded in and Eric's answers to its questions. Names are placeholders for
the kind of boss. Nothing here is built yet; when it is, each part gets its own section.

**The raid itself**
- **A random boss every match, at the lobby's strength.** The lobby's strength sets how strong the boss plays; which
  boss you meet is random, drawn from a shuffled deck per player so you meet every boss before any repeats. The threat
  skulls still show how hard this one is.
- **Each boss has an opening or passive ability and one ultimate.** A boss with nastier powers plays a little weaker
  underneath (a per-boss strength offset), so every boss is about equally beatable.
- **Self-balancing, not simulations** (Eric: don't burn tokens on balance testing): the game records how often the crowd
  beats each boss and nudges that boss's offset toward a target win rate. Rules get cheap unit tests (no power may leave
  zero legal moves or an illegal position); balance comes from real games.
- **Banners:** every boss power uses the God King's banner style: the boss on the left, the moment in the middle, your
  side's king or the God King on the right.
- **Ultimates are telegraphed:** a rage meter in the boss bar fills as the boss loses material; when full, a one-turn
  warning, then the ultimate. Once per match. (A proposal; some ultimates have their own trigger, below.)

**Ground rules for every power**
1. **The judge plays by the same rules as the crowd.** A power that limits moves tells the judge which moves are
   allowed, and the best move is chosen from those (Stockfish's `searchmoves`). A moment that can't be judged fairly is
   not scored (a blind turn, a move the boss plays for you).
2. **A power never leaves you without a legal move and never breaks check.** If a restriction would leave no legal move,
   or the only escape from check is a restricted piece, it lifts for that turn. The king is never frozen, burned or
   removed.
3. **The server decides every power,** from the match's seed and state, so everyone online sees the same thing and no
   device can tamper with it.
4. **Fair play skips power turns:** forced or restricted moves, duels and blind turns don't count as detection signals.

**The bosses**
- **Fire.** Passive: tiles catch fire under your pieces only (his pieces never burn), with a 3-2-1 countdown; a piece
  still on the tile at 0 is destroyed. At most 1-2 tiles at a time, never under the king; sliding pieces may pass over.
  The judge treats a piece about to burn as already gone, so saving it is never scored as a mistake. Ultimate: when the
  engine finds a forced mate for the crowd in 3-5, the whole board catches fire: find the mate within its length + 2
  moves or lose (the + 2 is the director's suggestion; Eric's note said + 1).
- **Sludge.** Opening, both sides: pawns can't make the double step; rooks and bishops move only one square on their
  first move, then the sludge is gone. (No double steps also means no en passant.) Ultimate, your pieces only: a sludge
  flood: for 2 turns your rooks, bishops and queen move at most one square.
- **Zombie.** Passive: 1-2 of his pieces have two lives, shown with a glow; when captured, a piece comes back on its
  starting square, or the nearest empty one on his back row. Pawns can't stand on the back row, so they come back on
  their starting rank. A respawn never gives check. Ultimate: the next piece he captures rises on his side; a queen never
  rises as a queen (a knight or bishop at most).
- **Reflect.** Opening: he mirrors your move for the first 5 turns, unless it's impossible or would walk into mate in 1
  or hang his queen. Ultimate: for 5 turns you must move the same type of piece he just moved. He only plays a type you
  still have and can legally move; it ends early if you have none. If he moves his king you're free that turn, and in
  check any legal escape is allowed.
- **Freeze.** Passive: freezes one of your pieces (never the king) for 2 turns; a frozen piece still defends and gives
  check. Ultimate, the blizzard: a cold sweep of cloud and snow crosses the board, every piece ices over except your
  queen, and the God King says a line (several variants) like "Looks like our queen withstood the storm!", hinting she's
  the one to move. One turn, then the ice melts. If you have no queen, or she can't move, your king may move instead.
- **The Challenger.** Passive, the spotlight: every 2-3 moves he calls out one player by name ("Ana, show me what you've
  got!", several variants). That player's pick carries extra weight in choosing the crowd's move, enough to tip a close
  call about a quarter of the time, but never enough to pick a blunder (a pick the judge scores far below the best gets
  no extra weight). People only, never bots; never the same player twice running. Ultimate, the duel: your last-placed
  person moves alone for one turn, without power-ups; nobody else is scored that turn; if they run out of time, the God
  King makes a safe move.
- **Boingo the Clown.** Passive, the pie: he throws a pie at one empty square, which stays pied for 3 turns (nobody can
  move a piece onto it), then 2 clear turns, then another pie. The square is near the centre and chosen so it's roughly
  even for both sides (the engine checks it changes the eval little). Ultimate, the funhouse: as the turn passes to
  you, he pogos down onto the board, the board flips, he says a line and plays your move for you: a weak but
  recoverable one (about 1-2.5 pawns worse than the best, never hanging mate or the queen outright). That turn isn't
  scored. The board stays flipped for your next 2 turns (the director's call). The engine already picks deliberately
  weaker moves with a bounded loss (the boss's slips) and the God King already plays moves for the crowd; this reuses both.
- **Darkness.** Opening: fog hides his half of the board for 5 moves, with a counter. No move hints under the fog; an
  invalid move costs the most points a move can lose; you're still told when you're in check. Ultimate: one blind turn
  that starts on his move. His move is shown as text in his speech box (blindfold players always hear the move), the
  board is hidden, power-ups are off, you move by tapping a square then a square, and an invalid move costs the most
  points; maybe a few seconds' extra time. Line ideas: "I have never needed eyes to see your fear."; "Now we are equals.
  Sight was only ever the illusion."

**A base boss template** (so a new boss is mostly filling in a form): name and title; art kit (sprite, portrait,
animations); sounds; lines for every moment (entrance, thinking, his move, capture, hurt, check, smug, rattled, power
used, ultimate warning, ultimate, defeat, victory), several each, picked the same for everyone online; a strength
offset; a passive (when it fires and what it does) and an ultimate (its trigger, warning, effect, length and banner);
and, for each power, the rules it answers: which moves are allowed this turn, what happens after a move, what each
player can see, and whether the turn is scored and counted for fair play.

**Who builds what:** the characters delegate the art, lines and sounds; the god-king delegate the power rules (it owns
the boss battle's rules and how the God King's powers meet a boss's, e.g. whether the Last Stand undoes a burn); the
engine delegate judging with allowed moves and picking the clown's weak move. First to build: the template and power
system with two powers that prove it: Freeze (move limits and judging) and Boingo's funhouse (banners, warnings, the
engine choosing a move, and online sync).

**Later ideas:** boss drops (a themed crate item for beating a boss: a clown nose, a zombie hand); bosses jumping to the
centre of the board to cast; the farmer and the gingerbread man as bosses.

### Built: the boss template, Freeze and Boingo (Oct 8, 2026)

Built by the `god-king` delegate, which now owns boss powers and boss selection. Playable now: **Ginger, the
gingerbread man (Freeze)** and **Boingo the Clown (pie and funhouse)**, the only bosses in every boss mode. Their art,
moments, lines, sounds and the effect sprites are the `characters` delegate's (`characters/power-art.ts`).

**The template** (`packages/core/src/boss.ts`, `BOSS_ROSTER`): each boss has an id, name, icon, strength offset, a
passive and an ultimate (power ids), and its character kit (the app's `BOSS_KITS` key, for art, moments, lines and
sounds). Each power's rules live in `packages/chess/src/boss-powers.ts`: the moves allowed this turn (`crowdAllowed`,
`bossAllowed`), what happens as a turn begins (`prepareTurn`), what each player sees (`NetBoss.powers`: ice, pie,
flip, rage, the turn's events), whether a turn counts for fair play (`powerTurn`), and the funhouse (the only unscored
turn).
- **Playable = a complete character and powers** (`isPlayable`, `playableBosses`, `chooseBoss`): one rule for the raid,
  the Crowd's boss final and solo's menu. A boss's `kit` is set in the roster once its character is complete; an app
  test checks every playable boss's kit has every moment, its powers' moments, lines and a portrait.
- **Strength:** the lobby's (a raid: a step above the group's average; the Crowd final: the crowd's weighted rating)
  plus the boss's offset. Both offsets are −100 for now. The skulls follow the strength.
- **Which boss:** random each match (one draw from the match's seed, which also seeds its powers), never the one to
  avoid when there's another: solo, the last boss this device met (`boss-history.ts`); online, the one most of the
  lobby met last (each app sends its last boss when it joins; a strict plurality, else none is avoided). A raid's
  creator can still pick one (`?boss=<id>`); a test link's `?boss=<tier>` fixes the strength.
- **Solo's boss menu:** "Random boss" (a different one from last time), then each playable boss with its portrait,
  skulls, powers in a few words and its strength against yours. The ten-tier list is gone: the strength always
  matches you now (Eric's design: the lobby's strength, a random boss).
- **Records:** each result stores the boss (`results.boss_id`) with its outcome (`team_won`), solo and online, raid and
  Crowd final, for self-balancing later. The nudge itself isn't built: it needs real games first, then a small daily
  job (each boss's win rate → its offset).

**The power system** (the ground rules, as built)
- **The server decides** every power as each crowd turn begins (after the boss's move, or as the battle starts), from
  the battle's seed and the position (`prepareTurn`, once per turn: the Last Stand's re-pick doesn't re-roll). Solo
  runs the same code. The state travels in the shared match state (`BossState.powers`, `NetBoss.powers`): no new
  messages, only optional fields (`allowed` on jobs and boss requests, `funhouse` on a boss request, `lastBoss` on
  hello).
- **Never zero moves, never breaks check:** the allowed moves are always legal moves; a restriction that would leave
  none lifts for the turn (in check, that's whenever the only escapes are restricted). The king is never frozen.
  The boss is limited too, by the pie only.
- **The judge uses the allowed moves:** the best move is the best of the allowed ones (filtered from the top-8 search;
  if none of the top moves is allowed, one search over every allowed move, Stockfish's `searchmoves`); bots pick from
  them; a pick of a disallowed move is refused (the screens don't offer it, the server and solo reject it). The same
  code runs on judges, the host and solo, so honest devices still agree exactly.
- **Fair play:** a turn a power touches (a frozen piece, a pie, the blizzard, a flipped board) is scored, but never
  counted as a signal (`FairMove.power`, skip reason `bossPower`). The funhouse turn isn't scored at all, and the
  boss's strike doesn't count it.
- **Rage and the ultimate:** the rage meter (in the boss bar, beside the skulls) fills as the boss loses its own
  material, full at 9 (a queen's worth; `BOSS_POWERS.rageFull`). Full as a turn begins: the warning ("RAGE!", the meter
  pulsing) that turn; the ultimate the next. Once a match; the meter is gone after. A boss that never loses material
  never uses it.
- **Moments:** as the turn passes to the crowd, after the boss's move shows, each power that came with it plays in
  turn, in the God King's banner style (the boss's portrait on the left, the moment in the middle, the God King on
  the right). Then the boss steps up to the board's top-left corner (its side) and plays its kit's moment there
  (`freezeCast`, `pieThrow`, its warning, `blizzard`), timed so the moment's hit cue lands on the effect; its usual
  spot is empty meanwhile, and the dock shows its line for the moment (its kit's `power`, `ultimateWarn` or
  `ultimate` lines, the same for everyone). The crowd's clock starts after them, solo and online (`POWER_FX`, `powerMomentMs` in `boss-timing.ts`):
  a freeze 2.3 s, a pie 2.3 s, the warning 1.7 s, the blizzard 3.6 s, the funhouse 5.2 s.

**Ginger (Freeze)**
- **Passive:** from the crowd's 2nd turn, every 5-7 turns, one crowd piece (never the king) is iced for 2 turns: a
  pick from the three that matter most (pieces before pawns, by value and mobility), never one without a move or whose
  freeze leaves no other legal move. Its moves aren't allowed; it still defends and gives check. The moment: "FREEZE!"
  ("Your knight is frozen"), then he thrusts his cane, the ice bolt flies to the piece, and the ice (`iceOverlay`)
  forms on it and shimmers while it lasts.
- **Ultimate, the blizzard:** "BLIZZARD!", then the storm bursts from his raised cane and sweeps the board left to
  right (`blizzardSweep`, 1.3 s), and every crowd piece ices over as it passes, except the queen (no queen, or she can't move: the king; neither: no ice that turn).
  One turn. Then the God King says one of his blizzard lines ("Looks like our queen withstood the storm!", and three
  more; for the king, two). The passive waits a turn on the ultimate's turn.

**Boingo the Clown**
- **Passive, the pie:** from the crowd's 2nd turn, a pie on one empty square near the centre (c3 to f6) for 3 crowd
  turns and the boss's replies in between, then 2 clear turns, again and again. Nobody may move onto it. The moment:
  "PIE!", then he throws: the pie tumbles in from his side (`pieFly`) and splats on the square (`pieSplat`).
- **Ultimate, the funhouse:** as the turn passes to the crowd, "FUNHOUSE!", then he drops onto the middle of the board
  (his kit's `funhouse`), the board spins a half turn on its `flip` cue, he says a line ("Let me get that for you!", three more, or his kit's own) and plays the
  crowd's move: 10-25 points worse than the best (about 1 to 2.5 pawns from an even position, `funhouseLoss`), never
  past 1.6 in log-odds, never a move whose line allows a forced mate or leaves the queen to be taken (a queen trade is
  fine). It reuses the boss's slip code (the engine's top moves, then a head-to-head check with the best) and is
  played online by the host's engine, as the boss's own moves are. Not scored. Then the boss replies, and the crowd's
  next 2 turns show the board flipped (the crowd seen from the boss's side).

**Calls I made (Eric may want to change)**
- The pie's square is chosen without the engine: the empty central square the fewest moves of either side can reach
  right now (usually none), so blocking it costs nobody a move this turn. The design said the engine checks the eval;
  the server can't run one, and this keeps the server deciding.
- Rage counts the boss's own material lost, never coming back down (a trade fills it too).
- The freeze can ice the queen (she's often the piece that matters most); never the king.
- The board "flip" is a half-turn spin in the board's plane (pieces upside down for 0.7 s), then the board is drawn
  from the other side: a 3D card flip made the board measure its squares wrongly mid-turn.
- After his Last Stand the God King is silent, except for the blizzard's line (it names the one piece that can move).
- Strength offsets are both −100; self-balancing will move them.
- A boss leaves its usual spot (hidden) while it casts at the board's corner or, Boingo, jumps on the board.

**Checking it**
- `npm run frames:powers -- <dir> [gingerbread|clown|both] [phone|desktop|both] [light|dark]` plays a solo raid with
  real taps and saves every painted frame of each moment, stills and a GIF.
- Test switch: `?power=blizzard` or `?power=funhouse` (with `?boss=gingerbread` or `?boss=clown`) warns as the second
  turn begins and unleashes the ultimate on the third; the passive comes on the second turn anyway. Online too, on a
  raid's link.
- Tests: `packages/chess/test/boss-powers.test.ts` (no zero-move states, check, the pie and freeze never block the only
  escape, the blizzard's fallbacks, deterministic choices, judging with allowed moves, the funhouse's move),
  `packages/core/test/boss.test.ts` (the playable rule, avoiding repeats), `packages/app/test/boss-kits.test.ts`
  (playable bosses have complete kits), `packages/server/test/boss-powers-lobby.test.ts` (online: everyone sees the
  same powers, picks and jobs follow the allowed moves, the funhouse from the host, avoiding the lobby's last boss),
  `e2e/boss-powers.spec.ts` (a Freeze match and a Boingo match on phone and desktop, the funhouse online).

## The God King, redrawn as pixel art (Oct 8, 2026)

Eric's reference: a holy knight in white plate with gold trim, a winged crown-helmet with glowing gold eyes, a flaming
golden sword, a blue tabard with gold crosses and a long torn white-and-gold cape. The director asked for a full
overhaul in the boss characters' format, so the crowd's champion looks as grand as the bosses.

- **The sprite** (`packages/app/src/characters/god-king.ts`, listed with the bosses so their tests and preview cover
  him): his drawing space is one board square, 60 x 60 px with his feet at the bottom centre, in a 108 x 104 frame
  that leaves room for his wings, raised sword and cape. It's made of parts: a helm with a T-visor and glowing eyes, a
  five-spiked crown, gold helmet wings, spiked pauldrons with a gold cross, a breastplate with a gold sun-cross and blue
  banners, faulds, the tabard, legs with gold knee cops, sabatons, the cape, and white back wings (folded, half open
  or spread).
  - The sword arm is drawn from its pose's shoulder, elbow and fist. The sword (a gold hilt and a blade of fire) hangs
    off the fist in the pose's direction, so a swing is a list of poses. The flame flickers in three shapes, flares
    when he raises it, and burns down to embers when he falls.
  - Parts that move: the sword arm, the flame, the cape and tabard (ripples), the back wings, the helmet wings (a
    flap), and the eyes (glowing, blazing, dim, dark).
- **Both sides:** a `black` look swaps the four armour colours for dark steel, a step lighter than black so he reads
  on the dark ground. Gold, eyes, cape, cloth, wings and flame stay the same (his standing rule, so the cape stays
  white on Black). A unit test checks that no other pixel changes.
- **Renderer additions** (backwards-compatible; the clown and his tests are unchanged): `lieDown` turns a whole frame
  a quarter (a fallen figure), each part with its own outline; `partSize`; and the preview draws every look too
  (`<id>-<look>-*` files, a comparison tile each).
- **His animations, and where each plays:**
  - **The dock:** `idle`, by the clock: he breathes, the cape ripples, the flame flickers and sheds embers, the
    helmet wings lift, the eyes glint. The ready, dimmed and spent looks are as before. His Last Stand leap is `leap`
    (a crouch, then up with the sword raised) under the same CSS rise and fade. Fallen, he's `fallen`: on his side,
    cracked, eyes dark, his crown rolled off, the sword down to embers.
  - **Summoned** (`KingSummon`): he lands out of the beam with wings spread (`appear`, at 1,300 ms), raises the
    flaming sword with wings spread and eyes blazing (`raise`, at 1,550 ms as before), and holds it through the cut-in.
    Then either he points it and his bolt leaves its tip (`point`; its bolt frame lands exactly on the bolt), or he
    cuts once for each slash (`slash`; its cut frame lands exactly on each slash), with a bolt from the raised blade
    before each cut. `summonMoment` picks the animation and is unit tested.
  - **The Last Stand:** one animation built from `LAST_STAND`, so it can't drift from the effects and sounds:
    - the dive (sword down, wings up) and the crash (low, sword planted);
    - guard over the square (sword across him, wings spread) through the banner and the slide back;
    - the 25 blows, each a 50 ms red-white flash and a one-pixel jolt, with cracks at the three `crackAt`;
    - the stagger, the collapse to one knee, then lying as he fades, the same picture as his fallen figure in the
      dock.

    It replaces the CSS hurt filter, the jolt and the stagger and collapse rotations.
  - **The results:** fallen; or, if the crowd won, `rise` (from the ground to one knee, up, the sword raised), then
    the raised loop.
  - **The shop's King effect preview:** sword raised.
- **Portraits from his kit** (replacing the Python-made PNGs, removed with their script): a 50 x 37 crop of a portrait
  pose (sword raised, eyes blazing, wings spread) for his cut-in and the QUEEN SLAIN! face; battle-worn (cracks, eyes
  dim, embers, three small red drops) for the Last Stand banner.
- **Sizes:**
  - On the board, his drawing space is the square, as before.
  - In the dock on a phone, a 50 px box, the old figure's height.
  - In the dock on a computer, twice his size (120 px), like the boss across the board; the dock has room there, and
    the status box keeps its height.
  - On the results, the epilogue is 184 px tall when he rises (was 156), so his raised sword clears his words.
- **Timing:** no moment's timing, sound or line changed. His sounds stay on their timers; the frames' cues are for
  the tests and the preview, not sounds.
- **Calls I made:**
  - While he acts on the board (his raise and the cut-in, about 2 s, never at rest), his spread wings and raised sword
    reach a few pixels into the next squares. I kept that for the grandeur. He never takes a tap.
  - On the board he bobs but no longer rocks: rotating pixel art blurs it.
  - His bolt starts at his sword's tip instead of just above his square.
- **Checking it:**
  - `npm run frames:god-king -- <dir> [w|b] [phone|desktop|both] [summon|laststand|all] [light|dark]` plays a solo
    raid: the dock, a strike, a played move and a Last Stand, with frames and stills.
  - `npm run preview:characters -- <dir> only=god-king` writes GIFs and sheets for both looks.
  - `node scripts/preview-god-king.mjs out.png banner=1` writes the sheet with his banners.
  - Test switches: `?laststand=1` and `?side=b`.

## Lag that grew with the match (Oct 9, 2026)

Eric: a solo boss battle against Ginger slowed with every move, on his phone and his computer, and was unplayable by
move 13-15; the blizzard glitched.

- **The cause:** the screens read the boss battle's view dozens of times per redraw, and in a solo battle every read
  rebuilt it, replaying the whole game with chess.js. The boss screen replayed it on every frame too. Details, numbers
  and the rule are in `.claude/LESSONS.md`.
- **The fix:** the view is built once per change; replays (`fenAfter`, `gameEnd`) and position lookups (`pieceAt`) are
  remembered; sprite frames draw about three times faster, with the same pixels; the rating curve is worked out once
  (Crowd's standings re-sorted it 5,100 times a redraw). Nothing a player sees or hears changed, and no timing either.
- **Bounded caches:** the last 256 lines and endings, the last 32 positions read. A cached answer is always the one a
  fresh replay gives (the key is the whole line), and an illegal move still throws.
- **Measured** with `npm run perf:boss` (a whole battle on a computer and on a phone slowed 4x, per move); also run on
  Boingo, a Crowd match and an online raid. **Guarded** by `packages/chess/test/long-match.test.ts` and
  `e2e/perf.spec.ts`.
