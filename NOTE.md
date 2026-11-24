# Birdie's miss ride (Nov 24): six phone stills

Eric: "we still need to show the birdie driving his train across the board animation, even when there's no pieces to hit. He just
simply drives across and then everything misses."

A solo raid on the test phone (iPhone 13, ?power=train). His warning is on the b-file: your b2 pawn is the only one of your pieces
there, and his b8 knight and b7 pawn stand on it too. You move the pawn b2 to b3, which saves it even though it stays on the line.
1. Your warned turn: the crossing on the line, the sign over your pawn, and the dock says "Move your pawn!".
2. Your move lands and he pulls away. The dock says "Birdie: Nothing hit!" for his whole turn.
3. The train comes in from his side, and his knight on b8 steps aside.
4. It crosses the board, and his pieces are back where they stood once it has passed.
5. Your pawn on b3 steps aside as it passes: nothing is hit, no sign, no smash.
6. After: the board is exactly as your move left it, and he rolls back in before his move.

Watched frame by frame (every display frame, two runs): the train moves on all 117 frames of its 1.93 s crossing, never still and
never backward. The three pieces on the line step aside 18 px and back in turn. No frame is missing a piece: the board drops to
28 pieces and his layer draws the 3 on the same frame, and gives them back on the same frame.
