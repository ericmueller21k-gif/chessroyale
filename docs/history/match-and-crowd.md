# History: The match, Crowd and 50 v 50

The decisions behind this area, moved here word for word from `DECISIONS.md` on Oct 10, 2026 (the housekeeping pass),
in the order they were made. This is the record of why. For how it works today, read [the area page](../areas/crowd.md).

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

## Crowd pieces: one spot per square (Oct 5, 2026)

Eric: mid-round the crowd's pieces looked misaligned and sloppy; every piece should snap to one rigid spot per square.

- **Cause, measured.** Every pick slid from its square to the target over 0.55 s. With up to 50 picks arriving in quick succession, up to 25 were between squares at once, smearing into streaks, with dozens of translucent copies stacked. Chessground also rounds its board to whole device pixels, so overlays drifted by up to 1 px.
- **Now.** Each picked square has exactly one ghost piece on it, and it never slides. It pops in place when a pick arrives (a 0.2 s pulse), and it gets bolder the more players picked it. The name tags still show who and how many.
- Overlays are sized to chessground's exact board (`--cg-size`, measured from `cg-container`). A browser check during a 50-player round: every crowd piece sat 0.00 px from its square at every moment.

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

## A crowd of one keeps its move on the board (Oct 6, 2026)

Eric: in a solo boss raid, a moved piece jumped back to where it was, then moved again about 1.5 s later.

- In Crowd mode your pick is a vote, shown as a ghost over the unchanged position until the reveal moves the winner.
  With a crowd of one (a solo raid), your pick *is* the move, so the snap-back and the second move were pointless.
- Now, when you're the only one picking, the piece stays where you put it, and the reveal starts with the move
  already played: no ghost and no vote count. The God King's lines, the boss's reply and a Last Stand all play as
  before; a Last Stand now starts from the piece already on its square.
- Crowds of more than one are unchanged.
- How it was found, and the rule that follows: `.claude/LESSONS.md`.

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

## Match screen: timers, the ring, chat on a computer (Eric, Oct 9, 2026)

From Eric's marked-up screenshot of a Crowd match. My calls:

- **The ring was off its square.** Chessground draws the squares in a box it rounds down to a whole multiple of 8
  device pixels, up to 8 px smaller than the board's wrap (5-6 CSS px at a 125% display scale, as Eric's). The ring
  was placed in % of the wrap, so it drifted toward the board's far side, a few pixels at most squares. Now the ring,
  the bars, the clock and the ghost layers size by chessground's own number (`---cg-width`, which it writes every
  time it sizes the board), so they can't drift. The ring's corners are square and its glow is inside, so nothing
  of it reads wider than the square. `e2e/match-screen.spec.ts` checks it within 1 px at two widths on a phone and
  on a 125% computer, at sizes picked where the rounding gap is widest (the old ring failed there).
- **The bar** is 6 px (was 3): Eric asked for a few pixels. One setting, `--timer-bar-h` in `styles.css`.
- **The mirror under the board** shows on phones and computers. It sits in the 8 px gap above the next row, so the
  board keeps its size. One switch: `TIMER_BAR_BELOW` in `components/Countdown.tsx`. On a computer the gaps above and
  below the board are 8 px now (were 6), as on a phone, to fit the bars.
- **The board's clock** sits in the line above the board, level with the board's right edge: this move's seconds
  ("12s") and your bank ("9:50", the leaderboard's BANK). No labels: they made it too wide for a phone's line, and
  the formats tell them apart; the full words are its tooltip. The seconds go red under 5 s on your own move; the
  bank red under a minute. Once you've moved, your bank stops and the seconds go grey. Watching the other team, the
  seconds are theirs (never red). In the reveal only the bank shows, in the same place.
  - Beside it, the line's own "⏱ 20 s" shows only when it's lit (the clock went up, "▲"); otherwise it repeated the
    clock. On a phone the line's text is centred in the room left of the clock; it drops "Your pick for" only while
    the lit note is in it below 430 px, and "you're on White" below 375 px.
  - Crowd only (not the boss raid, which has the dock, or Classic, which shows the bank in its top bar).
- **Chat on a computer** was already in the right column, under the vote results, in online matches (solo has no
  chat). But the panel above it changed height every phase, so chat jumped down at each reveal and back up at each
  move. The panel keeps one height now (room for five vote rows, yours and the result line), so chat stays put. From
  900 to 1099 px it's still beside the scoreboard (no leaderboard down the side there).
