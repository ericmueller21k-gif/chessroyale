# Ranked L1: the review's fixes (Nov 9, 2026)

The independent review of #582 (`review/582`) found a free dodge through the queue's Cancel and two fairness holes. The calls:
- **Cancel** excuses only a player who never connected to the game (the room's `seen`): pressed the moment it was found. From
  one who saw it, Cancel is their own Abort or Resign, and `conductOf` decides as for any other.
- **Gone means gone for a while:** a player counts as gone (for who left) only after `LEAVES.goneGraceMs` (12 s) without a
  socket. Within it an Abort is the presser's dodge, a missed first move the side to move's, and a flag a plain loss (which also
  covers a deploy's staggered reconnects). 12 s: iOS drops a backgrounded socket in a few seconds and the app reconnects at once,
  so a real return is well inside it; a dodger waiting out the other's flicker would need it to last 12 s.
- **A no-show is charged only once told:** option (a). The matchmaker tells the game (once per player) when an ask is answered
  with its code; a no-show whose code never reached its player (a phone asleep as it paired) is nobody's. A failed call to the
  game leaves the player untold, never charged for the server's slip. The FAQ: "not turning up once your device was told".
- The game that completes placements: a leave there is the loss and the mark, no fee (as the FAQ and the confirm said).

## The delta review (`review/582-delta`), fixed by the director
- **D1 (medium):** the no-show had no grace: a player who connected and blinked away just before the join time was charged.
  Now the room waits out the grace (`noShowAt`: the join time, or a moment-away side's `goneAt + goneGraceMs`), so a phone that
  blinked can come back and play, and one that closed the app is still charged once the grace runs out (taking the grace at the
  join time instead would have made "connect, then close the app" a free dodge). Both here: the game starts whatever the clock.
- **N2:** the FAQ says "gone 12 seconds or more" (the code's `>=`). **N3:** `duel.test.ts`'s result-card test has a 20 s limit (a cold
  import of Duel.tsx).
- Left for later (`-not-yet.md`): M1 ("told" means the server answered, not that the app heard: a 2.5 s window), M2 (a locked
  account's ticket caught mid-seating stays in line until it expires), N1 (the Abort confirm could say the opponent is only away).
