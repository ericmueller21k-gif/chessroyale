# Birdie's rules: the Train (Nov 23, 2026)

Design: `notes/designs-birdie.md`. Calls made (`bosses/birdie.ts`; numbers in `BOSS_POWERS.birdie`):

- **Admins first** (`BOSS_ADMIN_FIRST`) until Eric plays him; then the Battle Tower takes him, as every boss.
- **Cadence:** warned for your 2nd move, then every 3rd (2, 5, 8 …: `trainFrom`, `trainEvery`).
- **A line:** a rank or file with exactly one of your pieces (your king too), that piece able to move, and its smash a legal position
  (not your king's last shield, not your back-rank square his pawn promotes on). The seed picks among them.
- **Resolved at the start of his turn** (`afterCrowdMove`, as Grex's fire): moved = saved; left = smashed; your king = his win
  (`trainWin`). **Spared** when the smash would leave a position the engine can't take (no moves, a promotion handed over, a king in check).
- No train once the game is over or at the move cap; it rides before his fall on the same turn. No warning either on the turn the cap
  ends (review of #896, N1: a warning there was judged but never rode; `turnBegun` drops it, as it sees the match's `bossMaxMoves`).
- **Fair play:** a warned turn's job names the square (`train`); the judges count the piece as lost if left (king: a loss), so hints
  and eval do too. The Last Stand sits out a warned turn (`powerTurn`). An equal score goes to the move that leaves the train less
  (review of #896, I1: lost, every move scores 0, and your king left on the line ranked level with saving it by the move's name).
