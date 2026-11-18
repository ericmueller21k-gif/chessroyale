# Ginger's Super Freeze: a second meter (Nov 18, 2026)

**Eric, Nov 18:** "for Ginger ... when he freezes a piece, he still has his freeze ... We're adding another move for him, like another
ult meter bar ... his ult still stays the same as Blizzard, but now he has a super freeze ... it'll probably be around turn like 8 to
15 ... It doesn't need to be one that's already frozen ... he kind of finds a few pieces where yours are clumped, and he freezes the one
that, and then ... the ice block gets bigger and bigger until it hits all the squares around it ... nine blocks ... that animation might
even take 4 or 5 seconds for him to do a charge up and make an expanding ice block. And then again ... it's just frozen on your turn,
and then they unfreeze for his turn." His answers the same night: empty iced squares passable ("yea that works"); the king never frozen
and a legal move always left ("yes"); "up to twice in 60 moves".

## What it does

- **The meter** (`superFreezeEvery` [8, 15], `superFreezeMax` 2 in `BOSS_POWERS`): its own small bar beside the rage meter. It fills a
  step with each crowd move and is full after a number of moves drawn from the seed in 8 to 15, so it is full (and glows) on a crowd turn
  between 8 and 15. As that turn's move lands (the start of his turn) it comes; the meter empties and fills again over a new draw. At most
  two a battle; then the bar stays, empty, greyed and dashed (nothing hidden, nothing shifts).
- **The target** (`chooseSuperFreeze`): the crowd's piece, never the king, whose 3 x 3 holds the most of the crowd's pieces but the king
  (itself counted), from the position as the move lands. Every such piece in that 3 x 3 is frozen for the crowd's next turn by the held
  pieces' one rule (an iced rook can't castle); empty squares stay open. The ice thaws as his next turn starts.
- **A legal move always left** (`superHeld`): as the crowd's turn begins (after his move, which may have taken one), the pieces are let
  go one at a time, the farthest from the middle first (a corner before an edge), until the crowd has a legal move with them and the
  freeze's piece held. In check the legal moves are the answers, so an answer is always left.
- **Never with the Blizzard:** it waits (full) while the Blizzard is warned, under way (its three turns) or the admins' trigger is pulled.
- **On screen** (6.9 s of his thinking, his move waiting for it: `gingerTurnMs`, the same solo and on the server): SUPER FREEZE! (the
  usual banner with your pawn, "Your knight and 3 more are frozen"), his charge-up (1.05 s, his intro's `charge`, then 0.88 s of a held,
  glowing charge: new), his blast at the board (0.69 s), the ice bolt to the piece, the block of ice growing square by square over the
  3 x 3 (the middle, the sides, the corners: 1.52 s), a beat, then it breaks into each frozen piece's own ice (his freeze's look) through
  your turn, melting as his turn starts. His line as it begins (four placeholders in his voice: `GINGER_LINES.superFreeze`).
- **Test switch:** `?boss=gingerbread&power=superfreeze`: it comes as your first move lands, then your third.

## Calls made

1. **The meter counts crowd moves, not the rage meter's rates.** Eric gave turns ("around turn 8 to 15"), so a move count drawn from the
   seed is the simplest rule that says exactly that; the second one comes 8 to 15 moves after the first (about turns 16 to 30), inside
   "up to twice in 60 moves". The God King's strike and material don't fill it.
2. **Full on the turn it comes.** The bar lights the turn before it fires, so you see it coming (like the rage warning), without a warning
   banner of its own.
3. **Ties go to the 3 x 3 more of which is on the board, then the seed** (a piece on the edge and its neighbour often hold the same
   pieces): the block then sits on the board, not half off it. A block whose 3 x 3 runs off the board is cut at the board's edge.
4. **The freeze passive is unchanged**, except that on a Super Freeze turn it doesn't pick a piece the Super Freeze already holds.
5. **The admins' trigger on a Super Freeze turn becomes the Blizzard's warning** (it comes the next turn): the meter can't bring them
   together, since the Super Freeze waits for a warned Blizzard.
6. **Fair play:** a turn with Super Freeze pieces held is a power turn (its picks give no signal), as the freeze's.
7. **His charge-up reuses his intro's approved `charge`** (Nov 5) and adds a new held-charge loop and a blast, drawn by the art runner on
   his own rig; his drawing for the battle is GINGERBREAD with the one combined `superFreeze` cast added (`GINGER_BATTLE`), his town and
   previews keep GINGERBREAD itself.
8. **Sounds: his own pack only** (`gingerCharge`, `gingerBlast`, `gingerBurst`, `gingerCrackle`, all from his intro and freeze).

## Art

Drawn by the paid art runner on `claude/boss-art` (Opus, high), $2.95 of a $15 cap: the 3 x 3 ice block ($1.75,
`scripts/boss-art/out/ginger-superice/`) and his charge-up and blast ($1.20, `scripts/boss-art/out/ginger-supercharge/`).

## The sim (his raid, today's main as the control at the same seeds)

`npx tsx packages/sim/scripts/boss-sim.ts raid gingerbread 13 <1|31> 0 <tag>`: 50 bots against Ginger at his tier (1600, Stockfish at
1500), 26 battles each, the same seeds; rows in `reports/boss-sim/raid-sfg-{a,b}.jsonl` and the control's `raid-sfg-ctl-{a,b}.jsonl`
(main at 67a971b, run from its own checkout).

| Run | Crowd score | W-D-L | Avg crowd moves | Blizzards a battle |
|---|---|---|---|---|
| Super Freeze | 0.02 | 0-1-25 | 37.0 | 1.65 |
| Control (main) | 0.00 | 0-0-26 | 40.3 | 1.73 |

- It came twice in 25 battles of 26 (once in the other, which ended first); the second after crowd moves 16 to 30 (22.5 on average),
  freezing 2 to 6 pieces (4.2 on average). The first's timing (8 to 15, unless the Blizzard holds it) is checked in real battles by
  `ginger-superfreeze.test.ts`.
- Both runs are at the floor: today's raid sim beats the crowd almost every time against Ginger with or without it, as Big Boy's balance
  run found for him (docs/decisions/2026-11-18-bigboy-tower-balance.md: the references are from an older sim). So it can't show the Super
  Freeze's cost in score; its battles end about 3 moves sooner. Re-tune once the raid sim is re-baselined (the engine lane).
