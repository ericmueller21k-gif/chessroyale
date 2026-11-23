# The lobby chat spec raced the full lobby's 1.8 s (Nov 15, 2026)

- Brief: main red, `[phone] e2e/lobby-chat.spec.ts:28` a retry-pass three runs running, each at a different step after the bots fill.
- Cause (the test, not the game): the full lobby shows `FRONT_DOOR.fillShowMs` (1.8 s) before the votes; the bots' hello lands
  0.3 to 1.4 s in. The test then made about ten round trips (the count, the hello, the phase, four boxes) and on a slow runner the
  last landed after the votes began. Reproduced on a 4x-slowed CPU: 4 of 5 failed (a box gone, the chat over the leaving queue).
- Fix: the page watches every frame from before the fill (an init script) and records, on the first frame with all seats filled and a
  bot's hello showing, the phase and the queue's boxes. Slowed 4x, all 5 saw both before the votes: the player does see the hello.
- Also: `--repeat-each` repeats shared one queue pool (3 or 4 players); the pool name now carries the repeat's index.
