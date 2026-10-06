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
