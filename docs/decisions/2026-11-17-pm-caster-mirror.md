# A phone's cast at the board's corner faces the board too (Nov 17, 2026)

Eric, Nov 17: "have all the bosses facing the right way". #774 left one place: a phone's casters at the board's top-left corner (`.pm-caster`).

- **Changed:** the caster turns by the same rule (kits.ts `PLACE_FACING.caster`, the board's way), mirrored about its feet (`.pm-mirror`), so its
  feet stay on the corner. Nine turn: Sawyer, Wrangler (his warning), Alfil, Chub & Chirp, Moo, Puddles, Babur, Folio, Timber (Dash casts in place).
- **Projectiles:** only two leave a hand at the corner: Chub's carrots and Babur's hoops. Both go through one helper, `casterPoint` (PowerParts.tsx),
  whose mirror is `figurePoint`'s (`drawnX`). Babur's paw is now a frame pixel (24, 70 at `throw1`, by eye at 6x) instead of a board point.
  The rest (Moo's beams from above, Puddles' sweep across the board, Folio's ink, Alfil's glow, Sawyer's cut, Timber's teeth) don't start at a hand.
- **Room:** every turned cast stays on screen: its mirrored drawing reaches no further left than the unturned one did, within a point of the board
  (measured per frame; Wrangler's warning -10.6% of the board against -11.3%).
