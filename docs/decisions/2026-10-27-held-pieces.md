# Held pieces: one rule for every boss

**Date:** Oct 27, 2026. **Who:** Eric asked; the director built it.

## Eric's words (Oct 27)
"I feel like we probably need to add a global rule that for the bosses and stuff … for things like castling, because
trying to verify that through each individual boss, sounds like it's going to be a lot more code than trying to write
something that just checks for maybe it's frozen pieces or any piece that has a special thing attached to it."

## Why
Three powers hold the crowd's pieces: Ginger's freeze (and his blizzard's ice), Moo's moonbeam, Folio's fold. Each left
the held pieces' moves out in its own `crowdFilter`, and each had to remember that castling is the king's move but moves
the rook too. Moo remembered (`stunnedIn`); Ginger didn't (fixed in #380); Folio didn't at first (its review found it).

## What it is now
- `BossRules.held(boss, fen)`: the crowd's pieces a boss's powers hold this turn, by square. That's all a boss says.
- The dispatcher (`limitCrowd` in `boss-powers.ts`, used by `crowdAllowed` and `boardAltered`) leaves out every move of a
  held piece and castling with a held rook (`heldIn`, in `bosses/base.ts`: Moo's `stunnedIn`, moved and renamed), then
  applies the boss's other limits (`crowdFilter`), and lifts them all for the turn when no move is left, as before.
- Ginger, Moo and Folio now say `held`; their `crowdFilter`s keep only their other limits (Folio's crease). The dock's
  words (`refused.ts`) use `heldIn` for each of their pieces ("That piece is frozen.", "Moonlight holds that piece.",
  "That piece is folded.").
- A future boss that holds pieces gets castling (and the lift) for free. The area page's hooks table says a power that
  holds pieces uses `held`, never `crowdFilter`.

## Tests
- `boss-powers.test.ts`: the one rule with a stand-in boss (a held a1 rook: no castling long; a held h1 rook: no
  castling short; the boss's other limits see only what's left), and every boss whose powers hold pieces says so through
  `held` (Ginger, Moo, Folio).
- Each boss's own castling tests stay as they were (Ginger's freeze and blizzard, Moo's stunned rook, Folio's folded rook),
  and every package's unit tests pass: no rule changes for any boss.

No player-visible change.
