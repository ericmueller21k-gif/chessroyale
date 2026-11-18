# Big Boy: a tower turn alters the board only when a block takes a move away (Nov 18, 2026)

Eric (Nov 18, on the choice the tower's balance note and its review raised): "B seems like the obvious choice". Lane: bosses
and fair play (the full lane: fair play; the director runs the review).

## Why

His tower (or its scattered blocks) stands on nearly every crowd turn from turn 2. `powerTurn` was true whenever it stood, so
nearly every turn against him gave fair play no signal, and `boardAltered` (his `bossStops`) kept the God King's Last Stand
off for the whole battle (before the tower, about one turn in four had a block).

## What

- **Fair play:** a turn with his toys up is a power turn only when a block takes one of the crowd's legal moves away
  (`toysTakeMove`: onto or through a scattered block, through the tower, onto it while it's too short to topple). A tower
  nothing slides through, standing where a crowd piece may topple it, takes nothing away: those picks count. If his toys
  would take every move, the limit lifts and nothing is taken.
- **The Last Stand:** it sits out for his toys only when they take away the reply it would replay: the boss's best answer to
  the crowd's move, as the judge names it (the reply the save shows), checked against his toys as they'll stand for that
  reply (`toysAfterCrowd`, the same function the match runs after the crowd's move: an expiring scatter gone, a topple's
  scattered blocks in, the tower open to him on his rare turns).
- **Interface:** `BossRules.powerTurn(boss, fen?)` (every other boss ignores the position) and a new optional hook,
  `standAltered(boss, fen, played, reply)`, that replaces `boardAltered`'s general rule for a boss that has it. Only Big
  Boy has it, so every other boss is unchanged (the boss kit and the `AUDIT` table pass as they were).
- **Solo and online alike:** both resolve the round in the runner (`resolveBoard`), which passes the position, the move and
  the judge's reply; the server records the round's `power` flag as before. A server test checks that online.

## Calls

- **The reply not known** (the judge's line has none): the Last Stand sits out while his toys stand, as before. A save on a
  reply nobody can check is the case Eric's Oct 24 rule exists for.
- **Only the reply, not the crowd's moves, for the Last Stand** (the brief's wording). The judge already measures the loss
  against the best move the crowd may play (`withoutBarred`), and the re-pick keeps to the allowed moves.
- **Deeper lines stay plain chess:** a block his second move or the crowd's next one would meet isn't looked at. That's what
  (b) accepts; one move deep is what the save names and shows.
- **`powerTurn` without the position** (only tests call it so) answers as before: his toys up count.

## The review's fixes (Nov 18, PR #791)

- **Online, his reply is the judges' joint word.** The Last Stand now turns on the judge's reply for Big Boy, and two judges
  were compared only on their numbers: a modified client could name a reply his toys leave open and call the save past them
  (or the reverse). Fix (the review's least-code one): a job judges settle together keeps only the replies both name alike
  (`sharedReplies`: agreed, and two of three); a re-check keeps the replies settled with the quick part. My call: the engine
  server's verdict too. It names no replies, so the closer judge's stood, and a tie in distance went to the first judge, the
  same opening. A missing or disputed reply reads as not known: the save sits out while his toys
  stand, the call above. Honest engines are deterministic, so their replies match and nothing changes for them.
- **Not** adding replies to `boardsAgree`: a mismatch would then be a dispute, sent to the engine server, for a value that
  only Big Boy's save reads.
- `baseBoard` drops a reply that isn't a legal move after its move (the runner already showed only legal ones).
- A judge answering alone, the host, or a dispute with no verdict: the reply is that device's word, as its numbers are
  (spot-checked, or the match unvouched).
- `toysTakeReply` returns false when no block stands (a scatter with none left), reply known or not.

