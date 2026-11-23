# Ginger: a frozen rook can't castle

**Date:** Oct 27, 2026. **Who:** the director (a bug fix; no rule of Eric's changes).

## What was wrong
Ginger's freeze and blizzard left out of the crowd's moves only the moves *starting* on an iced square. Castling is a
king's move, so a frozen rook could still castle (it moved, while "frozen"), and a king the blizzard left free could
castle with a rook its ice held. The dock gave no reason, since the refused-move check looked only at the moving piece.
The independent review of Folio's fold found it (the fold copies the freeze); it was already on the follow-up list from
Moo, whose moonbeam had fixed the same hole for itself with `stunnedIn`.

## The fix
- `bosses/ginger.ts`: the freeze and the blizzard use Moo's `stunnedIn` (the piece's own move, or castling with a held
  rook) everywhere they asked "does this move start on an iced square": the crowd's moves (`crowdFilter`), the
  blizzard's mercy thaw (`blizzardStep`), the ice shown (`iced`), and the freeze's pick (`chooseFreeze` never picks a
  piece whose freeze leaves no move, now counting castling).
- `app/src/refused.ts`: castling with an iced rook says "That piece is frozen."
- Tests: a frozen rook can't castle (`boss-powers.test.ts`), a free king can't castle with an iced rook
  (`ginger.test.ts`), and the dock's words (`refused.test.ts`). All three fail on main.

No number changes; no other boss changes. The sim isn't re-run: castling with a frozen rook is rare, and the change only
takes moves away in that case.
