# Big Boy's tower: the review's fixes (Nov 18, 2026)

Eric's rule for the scattered blocks: "they persist for his turn, and then for your turn, and then they go away".
- Lifetimes: every scatter goes at the end of the crowd's next turn (`afterCrowdMove`, before his reply). Your topple on turn T:
  his reply to T and your turn T+1. His topple or a fall by itself: your next turn only. Before, each also stood through one more
  move of his. The FAQ and the screen (the puff as your move is played) say the same.
- A scattered block his piece stands on (his only move, the limit lifted) is dropped as the next turn begins, as the crowd's are.
- Solo's Big Bounce now waits for your topple (`bigboyTurnMs`), as the server does.
- The tower no longer hides square marks: see the PR body for the way chosen.
