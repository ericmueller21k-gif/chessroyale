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
