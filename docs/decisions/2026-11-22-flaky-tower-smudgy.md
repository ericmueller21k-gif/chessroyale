# Flaky: the shared Smudgy floor test caught Jefferson's turn live (Nov 22)
Main's full run on d30c64b went red on `e2e/battle-tower.spec.ts:882` (phone; passed on retry). After your move it polled for "Jefferson
is thinking" (phase boss, focus grex) and asserted the hidden square then. His turn can last under a second, and a poll runs every second
by then, so the turn passed unseen and the poll timed out at 60 s. Nothing in the game was wrong.
- Fix at the cause: an init script records every frame of a boss's turn (whose, what's drawn on the hidden square); the test reads that
  record. Same check, never timing-dependent. A rule in `.claude/LESSONS.md`.
