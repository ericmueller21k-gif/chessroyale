# Big Boy's tower: the review's fixes (Nov 18, 2026)

Eric's rule for the scattered blocks: "they persist for his turn, and then for your turn, and then they go away".
- Lifetimes: every scatter goes at the end of the crowd's next turn (`afterCrowdMove`, before his reply). Your topple on turn T:
  his reply to T and your turn T+1. His topple or a fall by itself: your next turn only. Before, each also stood through one more
  move of his. The FAQ and the screen (the puff as your move is played) say the same.
- A scattered block his piece stands on (his only move, the limit lifted) is dropped as the next turn begins, as the crowd's are.
- Solo's Big Bounce now waits for your topple (`bigboyTurnMs`), as the server does.
- The tower no longer hides square marks: the move dot, last-move, selected and check marks take the pieces' z-index (2), over
  the under-layers (1); the pieces come later in the board, so they stay on top. No renumbering, no see-through tower.
- Not done: a reconnect mid-topple still starts it from this device's first sight (every boss's "your move" moment works so;
  the server's hold isn't in the view, so it needs a protocol field). Cosmetic.
