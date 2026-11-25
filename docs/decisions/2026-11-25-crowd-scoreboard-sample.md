# The scoreboard test samples before it picks (Nov 25, 2026)

- Main's run 45584074647: crowd-play's "the scoreboard box is built once" never counted as done: its record began "scoring", without
  the first turn's "play".
- Cause (the test's): its tracker took its first sample on the next frame (`requestAnimationFrame`), and the loop read "play" and
  picked 5 ms after it was set up; the pick ended the turn inside that frame, so the first cut's turn had no "play" and `done` (which
  looks at the first cut) could never pass, though every later turn was fine.
- Fix: the tracker samples at once and the loop samples again right before each pick. What the test checks is unchanged.
