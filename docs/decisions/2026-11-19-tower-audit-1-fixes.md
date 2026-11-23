# Battle Tower audit 1: the fixes and the calls in them (Nov 19, 2026)

The audit: docs/decisions/2026-11-19-battle-tower-audit-1.md. Finding 2's call has its own note (2026-11-19-ultimate-now.md).
Finding 7 is PR 8's (the deal), so `startSide` is unchanged here.

- **Finding 1, one en passant rule (`keptEnPassant`, rules.ts).** It replaces Alfil's check in `editedFen`, Timber's `tidyEnPassant`
  and the tiger's `placed`. The square is kept only while it and the square behind it are empty, the pawn stands there, and a capture
  there is legal. Stockfish's own test plus chess.js's, which writes the square only when the capture is legal. Alfil's copy lacked
  the last part, so an edited position with a pinned taker now drops its square as chess.js would. No test changed.
  `landCheck` (Babur's balloons, Timber's drops) refuses the square behind the en passant square, as it refuses the square itself:
  fairer to you than clearing your capture. Don Dough's dough rises where it stands, so there the rule clears the square.
- **Finding 6, a restored runner built as every runner is.** The brief named `turnOf: null` in `restore`'s list. The test found three
  more fields that list missed (`lean`, `forceShoutout`, `bossForceWin`), after Big Boy's store went missing the same way before. So
  `restore` now constructs the runner (`new MatchRunner(opts, snapshot)` returns early, after every field initializer has run) and drops
  the hand-kept list (CLAUDE.md, Nov 13: fix the cause).
- **Finding 5, the parity harness.** Its host picks extra moves as `net.ts` does, and the side checks leave the cap's last turn out of
  the events compared. The default sides are unchanged, as the brief asked. `KIT_PARITY_SIDES` adds sides by hand, which is how the
  audit's four were shown to part before and agree after.
