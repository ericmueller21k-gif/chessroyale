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
