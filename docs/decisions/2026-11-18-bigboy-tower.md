# Big Boy's toy-block tower (Nov 18, 2026)

Eric (voice, Nov 18): "he eats one of your pawns at the start ... when he throws his first block, that's still the same. You can't
go on that square. But then ... he starts stacking the blocks every turn. He stacks another block up to 10 ... Like it should look
like a cool sort of like actual stack of like toy blocks, so they're not quite set evenly. As they get taller, they get a bit more
wobbly. ... Once there's more than one block, you can actually put a piece there to ... topple them. And what they do is they
randomly will go into ... open squares around them ... it favors the closer ones ... all of those blocks function like his one block
things where you can't go there ... nobody can go on them. ... they persist for his turn, and then for your turn, and then they go
away. And then, the moment they go away, though, he starts ... building another tower ... once they hit 10, they start to ...
wobble, and then they topple over ... If they topple on his turn, then it goes on your turn."

## What changed
His block (one every 4 turns for 3) is now a tower: the first block lands as before (turn 2, an empty square of the crowd's half a
crowd piece could move to, TOY BLOCK!); each crowd turn after it begins with one more block on it (his toss, no banner), up to
`towerMax` 10. Nothing slides through it; nothing moves onto one block; from `towerEnter` 2 a crowd piece may move onto it, which
topples it. Its blocks scatter to empty squares near it and block (nothing onto them or through them, either side) for one crowd
turn, then vanish, and a new tower starts at once. The snack and the Big Bounce are unchanged (the bounce never lands a piece on a
block). Numbers in `BOSS_POWERS` (`towerMax`, `towerEnter`, `towerScatterReach`, `towerScatterPower`, `towerTest`); `blockEvery`
and `blockTurns` are gone.

## Calls made (each easy to change)
- **At 10 it stands one crowd turn, wobbling, then topples by itself as the next crowd turn begins** (after his move): the 10th
  block is a real block you can knock over, and the wobble is that turn's big sway. Its topple moment opens with a short wobble
  (`TOPPLE.tipAt`).
- **The topple's scatter:** up to its height in blocks, onto empty squares within 3 (any direction) of the tower, each drawn in
  turn with weight 1 / distance² (most land next to it; about a fifth reach the third ring), seeded from the battle's seed, the
  turn and who toppled it, so the server, solo and every replay agree. Never onto a piece, never off the board, never the tower's
  own square; fewer when there aren't enough. Landing order: nearest first.
- **Never no move:** a scatter square that would leave the side to move (the crowd's on his own topple; his on the crowd's)
  without a legal move is passed over; and, as every power, the blocks lift for a turn that would leave anyone without a move or
  block the only way out of check.
- **Lifetimes (the brief's reading):** toppled by the crowd's move, the blocks stand through his move and the crowd's next turn;
  by itself, through the crowd's turn as it begins. `until` is the last crowd turn they stand.
- **A piece that lands on the tower another way** (a limit lifted for want of any other move, his or the crowd's) topples it too;
  a scattered block a piece lands on that way is gone.
- **Castling never topples it** (the king's way runs on past it to the rook's corner): it's blocked as a slide.
- **The tower is drawn under the pieces** (it rises up to three and a quarter squares over the squares behind its own; the
  pieces stay in view). Its scattered blocks are today's block, on their squares, over the board as before.
- **The crowd's topple plays while he thinks** (as Chub & Chirp's carrot pull does: `yourTopple`); his own topple is a moment of
  the turn, after his move. Neither has a banner; the stack moment is his toss alone (0.9 s a turn).
- **Lines** (placeholders in his voice for Eric, `stack3`, `stack6`, `stack9`, `wobble`, `toppleYours`, `toppleHis` in
  `BIGBOY_LINES`): as it reaches 3, 6 and 9 blocks, at 10, when you knock it over, when it falls by itself.
- **Fair play and the Last Stand:** a turn with his tower or blocks on the board is a power turn (as the block's turns were), and
  the God King's Last Stand sits out on it (boardAltered). The tower stands nearly every turn from turn 2, so both now hold for
  almost all of a Big Boy battle (before, 3 turns in 4). Flagged for the fairplay and god-king lanes.
- **Test switch:** `?boss=bigboy&power=tower`: the battle's first tower starts `towerTest` (8) blocks tall, so it tops out on
  turn 4 and falls on turn 5 unless you knock it over first.

## Art
Drawn by the art runner (Opus, high effort, `claude/boss-art`, `scripts/boss-art/out/bigboy-tower`, brief
`briefs/bigboy-tower.md`): $1.63 of an $8 cap. `stand1`-`stand10` (the sway grows with height; 10 a big wobble), `add1`-`add10`
(a block drops on), `tip2`-`tip10` (it goes over, ends empty). The base block is today's block; the ones above get smaller going
up, each a little off-center. Copied into `packages/app/src/characters/effects/bigboy-tower.ts` as drawn.
