# Solo abandon: a game is kept from the moment it's decided (Nov 22, 2026)

Delta review of #881, P1: a win was recorded as left if the page went during the Hidden Boss's fall. Calls:
- The result is worked out at every update once the runner has placed everyone (`SoloMatch.decided`) and kept on the device at once,
  so every end moment, today's or a new boss's, comes after it. Classic's final places its finalists at its last move. A deciding
  move's reveal still comes before the runner's end (as online); the page going ends it.
- `at` marks a post maybe on its way: the load and a start wait 15 s to re-send (D2). A result kept as decided, or after a failed
  post, has none, so a reload in a fall sends it at once. Sign-in and sign-out always send it (D3).
