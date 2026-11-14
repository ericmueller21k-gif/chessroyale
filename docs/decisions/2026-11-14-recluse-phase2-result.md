# The Hidden Boss's phase 2: the result reads as the fight's (Nov 14)

Visual check #12 (review/recluse-visual-qa): after all four boards were won in his room, the result read "4th of 4" over "You beat the
Hidden Boss on all 4 boards!", and its review replayed phase 1's first form ("Move 1 of 11"), not the boards just won.

- **Headline:** where everyone in the match played a board (his room's fight), the boards decided it, so it reads "Victory!" or
  "Defeated" (a boss alone's words), with the place under it. A Crowd final keeps the place as its headline (most of its crowd watched;
  crowd-hidden.spec.ts already asks for that).
- **Review:** the board you played, opening on its end; phase 2's moves aren't judged, so no scores. Watchers keep phase 1's review.
- **Nothing stored or rewarded changed:** the placements, the server's results message, XP and rank are as before. Only what the
  screen shows; the board comes from this device's phase 2 view (a page reloaded at the result has none and shows phase 1's review).
- The scoreboard through phase 2 (the brief's first part) had already shipped in #706; this finishes the brief with #12.
