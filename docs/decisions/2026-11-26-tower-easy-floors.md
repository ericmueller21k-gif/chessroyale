# The Battle Tower's first floors play like bad players (Nov 26, 2026)

- **Eric:** "Like 1,000 ELO chess player should be breezing through the first 5 or 6 ... I don't want these bosses to [be] giving up
  your queen for nothing, but ... if they leave their queen hanging because they just like miss a move ... that's normal for a bad
  player ... play like bad players for the first 8 to 10 levels."
- **The call (engine lane):** Maia is at its floor (600) already, so floors 1 to 10 draw its move looser (`BATTLE_TOWER.carelessDraw`:
  temperature 1.6 and top-p 1 on floor 1, easing to BOSS_BRAIN's 0.8 and 0.9 by floor 10). On every Maia floor, a drawn queen or
  rook move that's simply lost (3+ pawns, a chess.js static exchange, no engine) is drawn again (`giftPieces`, `giftLoss`). Rooks
  too: a rook for nothing reads as a gift. The plan carries the draw, so solo and online agree. The climb from 10 is unchanged: the
  sim doesn't show floors 10 to 30 too easy (reports/tower-sim.md). The gift check is `maia-raw`'s only (an admin's guarded brain
  is already guarded). Online, a looser draw gets no throw strike (`drawLooser`, the director's call); the better move still plays.
