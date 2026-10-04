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
