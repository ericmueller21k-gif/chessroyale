# Lessons

Things learned the hard way. Every session reads this before changing anything a player sees. One entry per lesson:
what Eric saw, the cause, how it was found, and the rule that follows. Add to it when something slips through.

## A move that snaps back (Oct 6, 2026)

**Eric saw:** in a solo boss raid, you move a piece, it animates there, then jumps back to where it was. About 1.5 s
later it moves again. It feels like the app froze.

**The cause:**
- In Crowd mode your pick is only a vote, so the play screen puts the piece back and shows your pick as a ghost.
  The reveal then counts the votes and moves the winning piece.
- A solo boss raid is Crowd mode with a crowd of one. Your pick *is* the move, so the snap-back, the ghost and the
  second move were all noise.
- It was old behaviour (since the crowd ghosts), not the Last Stand work, which only made it more noticeable.
- Every test passed throughout: tests check *what* ends up on the board, not *how it gets there*.

**How it was found:**
- `npm run frames:boss -- <dir>` (`scripts/frames-boss-move.mjs`) plays one move the way a player does (two taps), and
  saves a frame every time the pieces or the phase change.
- The timeline showed the piece on its new square, then back on the old one with a ghost, then on the new one again.
- Running the same script on the commit before the suspected change (`git checkout <sha>`, run, check out the branch
  again) showed the same frames. So the bug was older, and the fix belonged wherever the behaviour came from.

**The fix:**
- A crowd of one keeps your move on the board (`Play.tsx`: crowd mode only when more than one is picking).
- Its reveal starts with the move already played (`Crowd.tsx`: `alone`).
- Crowds of more than one are unchanged.

**The rule:**
- Before calling any change to a board, a move or an animation done, watch it frame by frame, with real taps on a
  phone-sized screen. Use `npm run frames:boss`, or a script like it for other modes.
- Look for any piece that moves twice, jumps back or flickers.
- Do this for the most common path (one plain move), not only for the new feature: a feature can be perfect and
  the plain move next to it still broken.

## Purity that didn't match the item (Oct 6, 2026)

**Eric saw:** a Legendary (then called Exalted) Gift-Wrap Tube at 41.4% purity was almost fully blotched. It should have been about 59%.

**The cause:**
- The blotch pattern was cut so the right share of the *whole 100 × 100 square* was blotched. An item got whatever
  share of the pattern it happened to sit on.
- Wide items averaged out. Thin or small ones swung wildly: the tube from 11% to 100%, a beard from 0% to 100%.
- Every test passed, and the fitting sheet looked fine: it shows one pattern per purity, and one pattern can be lucky.

**How it was found:** a script drew each item's blotches for 120 patterns, filled them on a canvas, and counted the
pixels inside the item. That turned "looks off" into numbers, before and after the fix.

**The rule:** when a number on screen describes a drawing (a purity, a meter, a share), measure the drawing against
the number over many cases, not one preview. Then add a test that does the same.

## Coloured squares instead of the item (Oct 6, 2026)

**Eric saw:** the profile's Wearing list showed a plain coloured square beside each item, "not the item itself".

**The cause:** the mockup drew a colour swatch there, and it was built exactly as drawn. On a real profile, a swatch
next to an item's name reads as a missing picture. Every test passed: none looked at what stood in for the item.

**The fix:** each row draws the item with the crates' `ItemArt` (the same drawing as the locker and the reveal), and
`e2e/profile.spec.ts` checks the row holds an item drawing.

**The rule:** wherever an item is named on screen, show the item, drawn by `ItemArt` or `Avatar`, never a stand-in
(a swatch, an emoji, an icon). When a mockup uses a placeholder for real art, build it with the real art.

## A white flash between moves (Oct 6, 2026)

**Eric saw:** in a solo boss raid on his phone, going frame by frame after a move, the screen flashed white here and
there, "in between" things happening.

**The cause:**
- Every phase of a match (play, scoring, reveal, boss, watching) is its own screen component, so each phase change
  mounts a new screen, and with it a new board.
- Every `.screen` faded in from 40% opacity over 160 ms: two or three times a move, the whole screen washed out
  toward the page background, which is near-white in light mode (a dark blink in dark mode).
- The board (chessground) was built in a `useEffect`, which Preact runs after the browser paints. So each new
  screen's first frame had no board at all, only the background where it should be.
- It hit every mode (boss, Crowd, Classic). Every test passed: tests check what's on screen, not every frame of how it
  gets there.

**How it was found:** `npm run frames:flash -- <dir> [moves] [light|dark] [boss|crowd|classic]`
(`scripts/frames-flash.mjs`) records every frame the browser paints (Chrome's screencast) while playing moves on an
iPhone-sized screen, measures each frame's brightness, and flags jumps. Before the fix: at every phase change, about
50 ms with 70% of the screen near-white in light mode. After: none.

**The fix:** no fade on a match's screens (`.screen.game` and the cut, break, spectate, grid and results screens), and
the board is built and kept in step in layout effects, before the paint.

**The rule:**
- Anything imperative that draws what a player sees on a screen's first frame (chessground, a canvas, measured
  sizes) goes in `useLayoutEffect`, not `useEffect`.
- No opacity entrance on screens that replace each other during play.
- Check a change to screens or transitions with `npm run frames:flash` in light **and** dark mode: a blink that's
  invisible in one scheme is glaring in the other.

## Two flaky solo tests: leftover pages, the test's own thinking, the engine's first line (Oct 6, 2026)

**Seen:** "strong play survives…" and "missing every move…" (`e2e/solo.spec.ts`) sometimes failed in a full
`npm run e2e` and passed when run alone, on `main` too.

**The cause:**
- Tests that open their own browser context (a second player: `browser.newContext()`) never closed it, and Playwright
  doesn't until the worker exits. A page left in a live match keeps playing it, and a host's page runs its engines every
  round. By the time the solo tests ran, the desktop worker had five such pages (from "Play now", "home → queue → match"
  and the queue test). The stages before the final took 224 s instead of 75 s.
- So strong play ran out of its 240 s. The match's own pacing is already about 200 s of that (the final's 15 bot turns
  are 7 s each).
- Strong play asked the engine for its move after the clock had started, so the lookup counted as the player's
  thinking time: up to 10 s on the busy worker. Late cuts are often exact ties (several players find the best move),
  broken by less thinking time, and bots think 3–20 s. In one run, strong play kept its place at the stage 6 cut only
  because it thought less than 7.3 s.
- "Missing every move" looked for the results 200 times (about 50 s). Once you're out, the rest of the match is played
  out at the engines' speed, which took 33 s of that: 3 s spare.
- Both tests tapped through the reveal 3.6 s in, only about 100 ms after it starts taking taps. A late frame would cost
  a 3.7 s retry.
- Found after the first fix, in one run of five: strong play played the engine's first line, but the judge rates a pick
  by its line's score, and the first line isn't always the highest. When the node budget runs out partway through a
  depth, the lines not yet searched again keep the last depth's score: in 2% of balanced positions a later line scores
  higher (by up to 5 points). Four bots played that line (Qg4, rated best), strong play the first (Qf6, −1.0, while
  the reveal said "Best was Qf6"), and it fell at the last cut.

**How it was found:**
- The failing test's trace listed five other live pages, with the earlier tests' URLs (`pool=formats`,
  `pool=profile`), still drawing a match throughout.
- Logging in the tests over full runs: time per phase, the engine lookup, the player's thinking time, and everyone tied
  with you at each cut.
- The first line: the failing run's trace showed the reveal's picks and losses. Then 720 top-8 searches of match-like
  positions (library openings plus a few good moves) counted how often the first line isn't the highest.
- Tried and dropped: Playwright's fake clock (`page.clock`), to stop the player's clock during the lookup. On a busy
  page it runs up to 40% slower than real time (8 s behind after a minute), which stretched the whole match.

**The fix (tests only; no game code changed):**
- `e2e/helpers.ts` exports a `test` that closes every context a test opened, pass or fail. The files that open contexts
  use it.
- Strong play has the next stage's boards searched during the reveal and the stage break (no clock runs; the break waits
  for your tap). The round reuses those searches to score with, so the move is known when the clock starts.
- Strong play plays the highest-scoring line of that search, and taps the piece again if the board wasn't taking moves
  yet. Both tests tap through the reveal when it says "Tap to continue".
- "Missing every move" waits for the results to a deadline, not a count of looks.

**The rule:**
- A test that opens a context uses `test` from `e2e/helpers.ts`. A page left open keeps playing.
- The player's clock is part of what's tested: do the test's own work (engine lookups) before the clock starts, not on
  it.
- Wait for what the screen says (a prompt, a phase), with a deadline for slow machines. Not a fixed pause, not a count of
  looks.
- When a test passes alone and fails in the full suite, look at what else is running in that worker (the trace lists
  every live context).
- "The engine's best move" is the line with the highest score, not the first line.

## Cut names that lost their chips, and a top bar too wide for phones (Oct 7, 2026)

**Seen** (by the quick-chat build): on the Crowd cut screen, the last row of knocked-out names was cut in half. On
narrow phones, the sound button sat over the top bar's "CUT".

**The cause:**
- When names became tappable (`PlayerName`), its `.player-name` style replaced the cut screen's `.cut-name` chips:
  it comes later in `styles.css` with the same specificity. The names became 16 px plain text in a 120 px box with
  `overflow: hidden`, which hid the last row's bottom half and the "+N".
- The top bar's items never shrink. On most phones they're wider than the bar once scores have a few digits, so the
  line ran under the sound button and off the screen.
- Every test passed: the names were all in the page, just not all visible, and the tests' phone (390 px) had small
  scores.

**How it was found:** a script played a solo Crowd match on 360 and 375 px phones, light and dark, with the longest
real bot names and the widest scores. It measured each name's box against the list's, the bar's `scrollWidth`
against its width, and the cut pill against the sound button. Then `e2e/crowd.spec.ts` did the same.

**The rule:**
- When a screen adopts a shared component, check its own styles still apply: computed styles, not only the markup.
- Check anything kept to one line on a phone at 360 px with its widest real content (long names, six-character
  scores). Measure it; don't only look at a screenshot at the test phone's size.
- A fixed-height box with `overflow: hidden` hides what doesn't fit, and no test fails. Show whole items and count
  the rest instead.

## An empty box under the board (Oct 7, 2026)

**Eric saw:** on his iPhone, the scoreboard under the board was a tall black box with nothing in it, about two thirds
of the screen wide.

**The cause:**
- Two buttons each kept half of the view: the layout (side by side, or one panel full width) and the fold. Folding,
  then making the scoreboard full width, left "full width, folded".
- That layout's class was the bare word `board`, so the chessboard's `.board { width: 100%; height: 100% }` applied
  to the panel. Open, its flex sizing hid that. Folded, the panel took the screen's full height, with only the
  folded header inside.
- Every test passed: none folded the panel and then changed its layout, and none looked for an empty box.

**How it was found:** a script loaded an online match on an emulated iPhone with each saved combination and measured
the panel (height, rows, chat). Then it listed every CSS rule matching the empty panel, and `.board` was among them.

**The rule:**
- Give state classes a prefix (`ub-board`, not `board`). A plain word can already be another component's rule.
- One state per view, changed only by named actions, not one setting per button. When a control makes something
  bigger, it shows its content.
- For a panel with several controls, test every button from every state, with a reload after each, and assert the
  panel is never an empty box (`e2e/panel.spec.ts`).

## A vote board that jumped, and zones that pulsed green (Oct 7, 2026)

**Seen** (by the vote overhaul, before it shipped):
- The board moved when the game began. On a phone the vote's board was 20 px wider and 8 px lower than the game's: the
  vote had its own big heading and no eval bar beside the board. On a computer the game has the leaderboard down the
  side and the vote didn't. It had been so since the votes were built, and every test passed.
- With your pawn picked up, the three zones were meant to pulse blue. They showed vivid green.

**The cause:**
- Each screen built its own frame around the board, so the board's box depended on what was above and beside it.
- Chrome animates between a `color-mix(in srgb, X 80%, transparent)` colour and a plain one through values far out
  of range (its computed border read `oklab(1 129 245 / 1)`), drawn as bright green.

**How it was found:** a script measured the board's box (and the rows above it) on the vote and on the game's first
screen, at 360 and 390 px and on a computer; then `npm run frames:vote` recorded every frame with a real finger, and
the frame of the tap showed the green.

**The rule:**
- When one screen hands a board to the next, give both the same frame (top line, the line above the board, the eval
  bar's slot, the sidebar) and measure the board's box on both, on a phone and a computer. Don't trust a screenshot.
- Don't transition or animate between colours made with `color-mix(…, transparent)`. Switch them, or fade a layer's
  opacity, or animate a shadow.
- Also caught (by `e2e/crowd.spec.ts`, "the board never moves", on the computer only): the move's clock added to the
  line above the board ("⏱ 10 s") made that line 1 px taller on your move, so the board moved. The emoji's font is
  taller than the text's, and the line's height was `normal` (a phone's is fixed). An emoji or symbol in a line
  above the board gets `line-height: 1`.

## A lobby that never closed (Oct 7, 2026)

**Eric saw:** he opened the app hours after a match and got its results screen again, at the lobby's old address.

**The cause:**
- Every lobby's Durable Object kept its record for ever: nothing ended its life after the results, so its address
  reconnected and replayed them.
- A lobby that's gone refuses the WebSocket, and the app treated a refusal like a dropped connection: retry, for ever.
  A typed unknown code sat on "Connecting…".
- Every test passed: they all followed a match to its results and stopped there. None asked what happens after, to
  the lobby, its code or an old link.

**How it was found:** reading what the Durable Object does after `phase === "results"` (nothing), and opening an
unknown code: the socket's 404 never reaches the page.

**The rule:**
- Anything the server starts (a lobby, a queue, a session) has an end, written down with its numbers, and a test for
  each way it ends, including "nobody is there any more".
- Test the stale case: the old link, the tab reopened later, the app back from the background.
- A refused WebSocket says nothing about why: ask the server (an ordinary request) before retrying.

## Tests that leaned on a lucky seed, and names that looked short (Oct 7, 2026)

**Seen** (by the vote tweaks, before they shipped):
- Eight quick-chat lobby tests failed when the bot name list grew from 68 to 140. Nothing about chat had changed.
- Six of the new bot names, all 16 characters or fewer, were cut short with "…" on a 360 px phone's scoreboard.

**The cause:**
- The tests' lobby is seeded (`mulberry32(7)`), and the chat helper needed two people on one team and one on the
  other. Teams are a random draw. Shuffling a longer name list takes more draws from the same random source, so
  seed 7 then put all three on one team. The tests had depended on what one seed happened to give, not on the rules.
- Characters aren't widths: in the column's bold 12 px, "Woodpusher Woody" (16 characters) is 120 px and "Pawn Island
  Isla" (also 16) is 94 px.

**How it was found:** the failing helper read `team(undefined)`: no one was alone on a team. For the names, a script
read the scoreboard's name column (103 px at 360 px) and measured every name in its own font with a canvas.

**The rule:**
- A test that needs a particular random outcome looks for a seed that gives it (and says what it needs), rather than
  trusting that a fixed seed always will. Anything new that draws from the match's random source moves everything
  drawn after it.
- Check text that must fit by measuring it in the real font and box, with some room for other fonts (an iPhone's runs
  wider than headless Chrome's), not by counting characters.

## One lucky pass taken for a cause (Oct 8, 2026)

**Seen** (by the capacity work, before it shipped): `e2e/panel.spec.ts` failed on the phone three times out of four
on the capacity branch and passed on main: after about 15 reloads of a match screen, the chat panel under the board
read too short (16-24 px, the test wants more than 30).

**The wrong turn:** the branch had just added a per-account rate limit (300 a minute), the failure came late in the
test, after many reloads, and with the limit raised the test passed once. That looked like proof, and the limit
went up. The next run failed again with the higher limit.

**The cause:** the test's steps don't wait for the round. Its reload step accepts the reveal and scoring phases, and
in a reveal the move tallies sit above the panel (about 90 px on a phone), so the chat feed shrinks. Whether a check
lands in a reveal depends on where the first round's deadline falls during the walk: luck. Main came close too
(scoring at tap 15, a smaller row, so it passed).

**How it was found:** a copy of the test logged, at every step on both branches, the phase, the seconds left in the
round, and the top and height of the board, the panel and the chat's parts. The panel moved down 93 px exactly when
the phase was the reveal.

**The fix:** the panel test measures only while a move is being chosen (play or watching), waiting for it.

**The rule:**
- One passing run doesn't confirm a cause. Before changing anything for a suspected cause, log what the test sees at
  each step on both branches (the phase, times, boxes) and find the step where they differ.
- A test that measures a layout waits for the phase it means to measure; a phase change in the middle is a different
  screen.

## A top bar that only fit a new player (Oct 8, 2026)

**Seen** (by the light/dark switch, before it shipped): adding the sun to the phone's home top bar, a measurement at
320-430 px with bigger balances showed the bar already ran off a 320 px phone at 1,250 coins (and off a 390 px one
at 12,345 once the sun was in). Every test passed: every test account has 0 coins.

**The cause:** the bar's items never shrink, and the coin pill grows with the balance. Tests and screenshots only ever
saw "0 coins", the narrowest the pill gets.

**How it was found:** a script set the pill to 0, 1,250, 9,999, 12,345, 123,456 and 999,999 coins at 320, 360, 375,
390 and 430 px and measured each item's box against the bar and the page's `scrollWidth`.

**The rule:**
- A number on screen that grows (coins, ratings, counts, scores) is tested at its widest realistic value, not the
  value a fresh test account has. Fake the server's answer in the test (`page.route`) if that's the only way to get it.
- When something new joins a row of fixed-size items, measure the row at 320 px with that widest content first.

## A board that vanished after it flipped (Oct 8, 2026)

**Seen** (by the boss powers, before they shipped): Boingo's funhouse flips the board. Built as a 3D card flip (the
board turned edge-on, its orientation swapped, then back), every square and piece vanished after the flip and stayed
gone. Every test passed: the orientation, the fen and the moves were all right.

**The cause:** chessground measures its board (`getBoundingClientRect`) when it redraws, and an orientation change
redraws it. Edge-on, the board measured nearly 0 px wide, so it drew everything at nearly no size, and nothing
measured it again (it only does on a resize).

**How it was found:** `npm run frames:powers` saved every painted frame of the moment: the board was fine up to the
swap and empty from then on.

**The fix:** the board spins a half turn in its own plane (the pieces upside down for a moment), and the orientation
swaps once the spin has ended, with nothing transformed.

**The rule:** never change what chessground draws (its orientation, its size) while a transform is on it or an
ancestor. Animate it, then change it once the transform is gone, and watch the frames after the change too.

## Lag that grows with the match (Oct 9, 2026)

**Eric saw:** in a solo boss battle against Ginger, on his phone and his computer, the game started smooth and got
steadily worse: dragging a piece dropped frames after about 5 moves, worse at 10, unplayable by move 13-15. Ginger's
blizzard was glitchy too.

**What grew:** the work done on every redraw, not the page. DOM nodes, running animations, rAF callbacks per frame,
timers and the heap all stayed flat; only frame times climbed.
- The screens read the boss battle (`match.boss`) many times per redraw. The play screen redraws five times a second
  and reads it about 20 times; the top bar, the boss bar, the dock and the boss read it too, and the boss screen
  redraws every frame.
- In a solo battle `match.boss` looked like a field but was a getter that rebuilt the whole view on every read
  (`runner.bossView()`). Each build replayed the whole game with chess.js twice (the board's "last few moves" view
  worked out the position before them from move 0) and generated the legal moves for the powers. So every redraw cost
  a little more with each move.
- The boss's turn had the same thing: the boss screen replayed the whole game on every frame (`lastMoveTookQueen`), and
  the match flow did it again in `gameEnd` several times a round.
- The blizzard added its own cost: its pixel frames are drawn the first time they show (each part's outline redone
  for every frame, each pixel's colour parsed from text), and the ice over every piece built a chess.js game per
  square on every redraw (`pieceAt`).
- Checking the other modes found the same kind of cost in Crowd. From move 4 (once ratings show), the standings
  re-sorted the rating curve 51 times per player, for 100 players, on every redraw: drag p95 went from 17 ms to 150-180
  ms on the slowed phone.
- No test saw it: tests play a few moves and check what's on the screen, never how long a frame takes at move 20.

**How it was found:** `npm run perf:boss` (`scripts/perf-boss.mjs`) plays a whole battle with real drags, on a computer
and on a phone with its CPU slowed 4x (CDP), and after every move records frame times (sitting, dragging, the boss's
turn) with DOM nodes, animations, rAF callbacks, timers, listeners, heap and audio nodes. Everything was flat except
frame times, so the cost per frame was growing. A CPU profile at move 8 (`PERF_PROFILE=8`: an unminified build)
put most of the time in chess.js under `get boss` → `bossView` → `netBoard`. A profile of the boss's turn
(`PERF_PROFILE_BOSS=1`) found `lastMoveTookQueen` → `fenAfter`, and the blizzard's showed the sprite drawing and
`pieceAt`.

**The numbers** (frames while dragging a piece, p95 and share dropped; a dropped frame is one over 20 ms):

| Move | Computer, before | Computer, after | Phone (4x slower), before | Phone (4x slower), after |
| ---: | --- | --- | --- | --- |
| 5 | 67 ms, 13% | 17 ms, 0% | 367 ms, 70% | 17 ms, 0% |
| 15 | 150 ms, 24% | 17 ms, 0% | 717 ms, 61% | 17 ms, 1% |
| 25 | 217 ms, 73% | 17 ms, 0% | 1,100 ms, 67% | 17 ms, 0% |

The boss's turn at move 25 went from every frame dropped (p95 200 ms on the computer, 400-1,100 ms on the phone) to
17 ms with 0-1% dropped. With the view and replays fixed, Ginger's blizzard on the slowed phone still had p95 50 ms
(9% dropped); the sprite and `pieceAt` changes brought it to 17 ms (4%).

**The fix:**
- `bossView` keeps its last view, keyed by everything it is built from, so a kept view is always the one a fresh
  build would give.
- `fenAfter` and `gameEnd` remember their answers; a line a move or two on from a known one carries on from it.
  `pieceAt` reads a position once.
- Sprite frames work out each part's outline once per way it's drawn and each colour once per frame. Every frame of
  every character and effect is byte for byte the same.
- The rating curve's sorted points and the prior's loss are worked out once per curve.

**The guard:**
- `packages/chess/test/long-match.test.ts` plays a 40-plus move battle. Reading the boss view again must do no
  chess.js work, and a new move only a handful of steps.
- `e2e/perf.spec.ts` (phone, CPU slowed 4x) plays four moves, checking that DOM nodes, animations, rAF callbacks and
  timers don't grow. It then makes the game 120 plies long and checks frames while sitting, dragging and through the
  boss's turn: p95 under 50 ms and under 15% dropped.

**The rule:**
- Anything a screen reads while rendering must be cheap and must not depend on how long the match is. A getter that
  looks like a field gets read dozens of times a frame, so it must never rebuild anything.
- Never replay a game from move 0 per redraw, per read or per round. Use the board's FEN or the remembered `fenAfter`.
- Before calling a change to a board, the boss or an animation done, run `npm run perf:boss -- <dir> gingerbread phone
  25`. Frame times late in the match must match the early ones. The same script runs `clown`, `crowd` and `online` (an
  online raid on a local server).

## A ring a few pixels off its square (Oct 9, 2026)

**Eric saw:** on his computer, the green ring on the crowd's move sat a little low and to the side of its square.

**The cause:** chessground draws the squares in a box it rounds down to a whole multiple of 8 device pixels, up to
8 px smaller than the board's wrap. The ring was placed in % of the wrap, so the error grew toward the board's far
side: 1-4 px on most squares, more at a fractional display scale (Eric's is 125%). At the tests' sizes the gap was
small or zero, and no test compared an overlay with the square under it.

**How it was found:** a script measured the ring's box against chessground's `square.last-move` box and the wrap
against `cg-container`, at several widths and display scales (1, 1.1, 1.25, 1.5, 3).

**The rule:**
- Anything drawn over the squares sizes and places itself in eighths of chessground's board (`--cg-size`, from the
  `---cg-width` chessground writes on the wrap), never in % of the wrap.
- Check an overlay against the square it marks, within 1 px, at a size where the rounding gap is widest (wrap width
  times the display scale just under a multiple of 8), not only at the test phone's size.

## A dozen sprites, a dozen loops (Oct 9, 2026)

**Found before it shipped:** G-REX's fire can put a dozen burning tiles on the board at once, with fireballs and
rockets on top. Mounted as one `<BossEffect>` each, a storm of 22 sprites on a phone slowed 4x dropped 25-33% of frames,
against 7-11% on the plain board. Each sprite ran its own animation-frame loop and redrew its own canvas: 30
callbacks a frame instead of 5.

**The fix:** every effect sprite shares one animation-frame loop (`onEachFrame` in `BossEffect.tsx`), and
`<BoardEffects>` draws many square effects on one canvas over the board, redrawing only the squares whose frame
changed. The same storm then measured like the plain board.

**The rule:** an effect that can appear many times at once goes on a shared canvas, not a canvas each; never start a
loop per sprite. Measure the worst case at once on a slowed phone (`npm run frames:character -- <dir> Boingo phone
kit="G-REX" fxperf`), not one effect at a time.

## A move only legal after a burn (Oct 9, 2026)

**Seen** (by G-REX's fire, before it shipped): watching a G-REX battle frame by frame, the page threw "Invalid move
d8d1" on every redraw a few moves after a pawn burnt on d4. Every unit test passed.

**The cause:** the fire destroys a piece between moves, so the board's history is no longer a game you can replay from
the starting position: the boss's queen went d8-d1 down a file the burnt pawn had blocked. The boss's reactions
(`boss-beats.ts`) replayed the history from move 0 to find the position a move or two back, and chess.js refused the
queen's move. The tests replayed short histories that never had a move made possible by a burn.

**How it was found:** `npm run frames:powers -- <dir> grex` logs page errors; the error repeated on every frame from
the queen's move on.

**The fix:** a board keeps a base where its position changed (`BoardState.bases`), and every replay plays from the
latest base at or before the ply it wants (`fenAtPly`, `gameEndWith`, `recentMoves`, the history arrows, a newcomer's
replay, the boss's reactions). `packages/app/test/fire-replays.test.ts` replays a game whose last move is only legal
after a burn.

**The rule:** anything that changes the position outside a move must leave a base, and nothing may replay a board's
history from move 0 directly: use `fenAtPly(history, ply, bases)`. When adding such a power, grep for `fenAfter(` and
`.history` and check each.

## A navigation that never happened (Oct 9, 2026)

**Seen:** `e2e/grex.spec.ts:53` (G-REX's barrage) failed now and then, on the phone and the computer, and passed on a
rerun. Most often: "page.evaluate: Execution context was destroyed, most likely because of a navigation", in the
test's `play()`, in the middle of the barrage. The same message had hit `boss-powers.spec.ts` (Ginger) and
`crowd.spec.ts` once each. Twice more, the check for a piece burning failed (not found; once, two found).

**The cause:** two races in the test, none in the game.
- Nothing navigated. Each of those tests awaited the engine's search inside `page.evaluate`
  (`await m.runner.topMovesFor(fen)`), holding a `Runtime.callFunctionOn` open for seconds while the page was busy.
  Playwright reports any protocol failure of that call (anything but a JavaScript exception or a closed page) as
  "Execution context was destroyed, most likely because of a navigation" (`rewriteError` in its
  `crExecutionContext.js`), and the call can fail that way without a navigation: an evaluate whose awaited promise is
  dropped and collected gives the very same message (checked with a two-line script).
- A piece burning shows for 1.5 s as the boss's turn begins. The test looked for it after its own wait for the turn to
  change (`expect.poll` steps up to a second apart), so under load it could look too late; and when two tiles burnt
  at once, its locator matched both (Playwright's strict mode).

**How it was found:** a copy of the test that set an id on `window` before the app loaded (`addInitScript`) and, on the
failure, read it back with the URL, then started the same search again and polled for it; it also logged every engine
call and every `until` listener with times. On a failure the id and URL were unchanged (no navigation), the fresh
search answered at once, and every search the page had started had finished (the failure came as the awaited one
resolved). The burn was caught by running the test six times with four workers (one strict-mode failure).

**The fix:** `engineTop(page)` in `e2e/helpers.ts` starts the search in the page, keeps its answer on `window` and
polls for it, so no evaluate is held open while the engine thinks. `watchFor(page, …)` puts a MutationObserver in the
page before the move, so a burn that shows for a moment is never missed, and the test reads what burnt from the shared
state (`powers.burnt`) before expecting it on screen.

**The rule:**
- Never await long app work (an engine search, a server round trip) inside `page.evaluate`. Start it in the page, keep
  the answer on `window`, and poll for it from the test. ("Execution context was destroyed" without a navigation is
  this; it hit Ginger's test again in the full run while this was being fixed, so `boss-powers.spec.ts` uses
  `engineTop` too.) `crowd.spec.ts`, `formats.spec.ts` and `boss-character.spec.ts` still await `topMovesFor` inside
  an evaluate (two of them inside a 12 s race, which only narrows it): move them to `engineTop` when they're next
  touched.
- Something on screen for a moment is checked by watching for it from before it can appear, not by looking for it
  after a wait for something else.

## A stall the first time an effect shows (Oct 9, 2026)

**Seen** (by Hollow's art, before it shipped): his Lights out on a phone slowed 4x froze for 480-530 ms as the first
bulb smashed, and dropped 7-11% of frames for the next few seconds. Every frame after that was smooth, and every test
passed: tests and previews see an effect's frames, not the first time they're made.

**The cause:** everything is made the first time it's needed, in the frame that needs it.
- The smash's synthesised sound took 150 ms to make on a computer (16 little glass bells, each running its oscillators
  for the whole sound), so about 500 ms on the slowed phone, at the cue.
- At the last smash the night's 32 tile variants all showed for the first time in one frame, and each new frame of the
  night's loop made 32 more.
- Earlier, his art painted every part of every frame when the app loaded: about 350 ms more on every start.

**How it was found:** `npm run frames:wip -- <dir> Hollow lightsout phone 21 perf` measures frames a second at a time
through the moment (e2e/perf-probe.js); the stall sat in the second the first smash landed. Timing each piece in Node
(the sound, a frame's first render, the night's tiles) named them.

**The fix:** parts are painted when first shown (`lazyParts`); the night is drawn ahead, a slice a frame (`prewarm`,
from when he drops in); the glass sounds are closed-form (30 ms) and a boss's sounds are made in idle moments once his
character shows (`warmSounds`). Lights out then measured like the plain board.

**The rule:**
- Measure a new effect's first showing on a slowed phone, not only its steady state: a second at a time, from the
  moment it starts.
- Anything that shows many new frames at once (a board of tiles) is drawn ahead, a slice a frame. A sound made in code
  is made before its cue, and costs no more than about 30 ms on a computer.
- Nothing a boss needs only in its battle is made when the app loads.
