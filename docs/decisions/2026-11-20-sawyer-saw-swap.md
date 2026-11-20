# Sawyer's Saw Swap (Nov 20, 2026)

**Eric, Nov 20:** "Need to add a new move for sawyer so he's modernized. For his saw, currently he cuts lines, we want another move
added where one time a game when's in check, he saws the board in half (only triggers if king is on his upper half, so he slices
down the whole middle, then his upper half down the center, and swaps the two 4x4 sides to remove his king from check, then he plays
a turn. Let's have this off by default for now in battle tower". Then: name it **"Saw Swap"**, "and he says one of several lines
about like 'let me saw my way out of this' or something", and "Yes just have it trigger anytime whenever it legally is safe to".

**Built** (Sawyer's row in docs/areas/bosses.md has the whole of it): a third power of Sawyer's, once a battle, outside his rage
meter. At the start of his turn (his `afterCrowdMove`, the way Folio's Revision rewrites the board), the first time he's in check
with his king on his half (ranks 5-8 as Black, 1-4 as White: his side, never assumed) and swapping that half's two 4 x 4 blocks is
legal, the board takes the swapped position and he then plays his move from it with his usual brain. The runner does it, so solo
and online agree (the boss kit's parity test runs `?power=sawswap` both ways). Test switch: `?power=sawswap` (`?side=b` too).

**Calls:**
1. "Legally safe" (`sawSwapFen`): after the swap he's out of check, the crowd's king isn't attacked, he has a legal move, and
   Stockfish plays the position (`stockfishRefuses`). Every piece on the blocks moves, the crowd's too, keeping its rank.
2. Never on the crowd's mate (the mate stands: the swap would undo a won game), a draw on the board, the battle's end or the move
   cap, as Revision. Not a judge or engine search: legality alone, so it costs nothing and needs no host answer.
3. After it: all his castling rights go (his king always moves, and his rooks with their blocks; one rule for every case), the
   crowd's stay (its king and rooks on their own back rank never move), the en passant square goes, and the fifty-move count starts
   again (as `withoutPiece`). A base at that ply: the history keeps every move, and no position before it counts toward a
   repetition. The board's last move is cleared (its squares mean nothing on the swapped half).
4. His other saw marks: the saw cut is always in the crowd's half, so it's never on a block; the board saw's line (between the d and
   e files) is the line the swap saws along, so it stays as it is. His split pawn's halves on his half move with their blocks.
5. The rage meter and his other powers are untouched; the crowd's round was judged before it, so nothing the crowd chose changes,
   and the crowd's next turn counts for fair play as usual.
6. The Battle Tower: `BOSS_POWERS.sawSwapInTower` (false) keeps it off on every floor, lone or shared (`settings.towerFloor`).
7. On screen, reusing what's there: the board saw's gap sprite, turned a quarter (across the middle) and halved (down his half),
   with two faster runs of its own frames (`swapRun`, `swapDown`); his `sawDown` cast at the board's corner and his existing sounds
   (the saw's `cut`, the gap's crack as the blocks come loose and its rejoin as they close). The blocks are drawn with the board's
   own square colors and pieces; the one with his king lifts over the other. 4 s, plus its banner; QUEEN SLAIN! first if the check
   took his queen (as Ginger's Super Freeze); skipped on a device that just rejoined (the same rule).
8. His lines: Eric's "Let me saw my way out of this.", and "Pardon the renovation!", "Measure twice, swap once.", "Swap shop's open!".
9. The dock line through the crowd's next turn: "Swapped out of check." (a longer one was cut with "…" on a phone; this one fits at
   320 px, measured). The move list holds his move back while the swap plays (it's worked out early in solo), as Dash's pop-off.
10. The shared boss kit plays a switch's own first move where the power waits on one (`KIT_FIRST_MOVE`: the swap's check), and
    checks its event shows, so the kit's invariants run through a swap.
