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

## A rate limit sized by the wrong number (Oct 8, 2026)

**Seen** (by the capacity work, before it shipped): `e2e/panel.spec.ts` failed on the phone, twice, and passed on
main: after about 15 reloads of a match screen, the chat panel under the board was too short.

**The cause:** the new per-account rate limit was 300 requests a minute, sized by the home screen's polling (12 a
minute). But a reload of a match screen makes a burst of calls (account, live line, lobby, socket, shop and more),
and the test reloads about 20 times a minute: over 300. Past the limit some of those calls got a 429, and the screen
drew with what it had.

**How it was found:** the failure came late in the test (tap 14, tap 18), after many reloads; the same test passed on
main; with the limit raised it passed.

**The rule:**
- Size a limit by the app's own worst burst, measured (reloads, reconnects, the app coming back from the background),
  not by its steady rate. Then leave a few times that as margin, and add a test that the burst stays under it.
- When a test passes on main and fails on a branch late in its run, look for something that accumulates: a counter,
  a limit, a cache.
