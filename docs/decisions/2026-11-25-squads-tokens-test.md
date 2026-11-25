# Squads Pairs: a token spent before your first pick is right; the test reads the match's tokens (Nov 25)

- Cause of squads-play.spec.ts:103's retry-pass (phone, main run 45566751900): not a display bug or a race. Each Pairs board starts from
  a library opening; one is the Steinitz Gambit (1.e4 e5 2.Nc3 Nc6 3.f4 exf4 4.d4 Qh4+), where 5.Ke2 is White's only move. A pair of
  bots to move there both pick it (`isOnlyMove`, a token left) and a token burns in half 1, as the rules say. When your first pick is in
  half 2, the board shows that squad's ×4. Reproduced locally (1 in 6) with the server logging each same-move pair: both bots on e1e2.
- Fix (the test): it compared to a fixed ×5 ×5. It now checks each squad's shown tokens equal the match's (`m.tokens`, yours and
  theirs), and that both show. Nothing in the game changes.
- Proof: 24 repeats locally, all green.
