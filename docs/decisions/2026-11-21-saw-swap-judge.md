# The judge scores a check that sets off Sawyer's Saw Swap on the board after it (Nov 21, 2026)

**Eric, Nov 21:** "Yeah, that sounds good." This closes the gap the review of #856 found: a checking fork scored as winning the rook, though the swap breaks it.

- **Which moves:** while the swap is still to come, every crowd move that sets it off is scored on the board after the swap, him to move. A side of several bosses gets none, since which boss moves isn't settled until it lands.
- **Searched up front**, so devices prefetch the boards during the turn.
- **The search** is the usual top-moves search at `engineNodes` (250k). The engine server's verdict stays plain chess's.
- **Trust:** the swapped look counts only where two devices agree exactly. A lone or disputed judge's look is one device's word, so its moves are scored as plain chess.
- **Fair play** is unchanged: a check that sets off the swap is recorded as plain chess.
- **Hints and the eval bar** agree with the judge, so a paid hint never recommends a fork the judge calls a blunder.
- **Review:** a lone judge with the engine server on keeps no look. A dispute keeps the look all or nothing.

Full design and measurements: PR #863.
