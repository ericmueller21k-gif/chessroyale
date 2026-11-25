# Chandy's queen lock aims at your best rook when your queen is gone (Nov 19, 2026)

Eric, Nov 19 (on "when the queen is gone, Chandy's queen lock targets the best rook"): "yes on chandy good idea". Why: the queen lock
was a dead upgrade in games where the queens came off early (his playtest, Nov 18).

- **Target:** your queen as before; with no queen of yours it can aim at (none, or none with a pawn, knight or bishop that can get in
  front of her), your best rook with such a save (`queenLockAim`). Neither: it can't come, as today.
- **Call made, "best":** the rook `lockRank` rates most gettable (free, then under-defended, then pinned or trapped), ties from the
  seed. Simple and already shared by solo and the server; no engine call.
- Everything else follows the target: `queenLockFirst`, the meter's "can it land", the aim (follows the rook, castling too), the
  shot, the aim event's `shape` ("r") for the banner's words, the weapon screen and the FAQ. The name stays "Queen lock".
