# Big Boy's toy-block tower (Nov 18, 2026)

Eric: "he starts stacking the blocks every turn ... up to 10 ... once there's more than one block, you can actually put a piece there to ... topple them ... they randomly will go into ... open squares around them ... it favors the closer ones ... they persist for his turn, and then for your turn, and then they go away ... he starts ... building another tower right away."
- What changed: his block every 4 turns is now a tower, one block more each crowd turn up to `towerMax` 10; a crowd piece may move onto it from `towerEnter` 2 and topples it; its blocks scatter and block for one crowd turn, then a new tower. Snack and Big Bounce unchanged.
- Calls: at 10 it stands a crowd turn wobbling, then falls as the next begins; scatter within 3 squares, weight 1/d², seeded, nearest first, never onto a piece, skipping a square that would leave the side to move no move; castling never topples it; a piece landing on it through a lifted limit topples it too.
- Calls: the tower is drawn under the pieces (they stay in view); your topple plays while he thinks (his thinking waits for it, solo and online); placeholder lines at 3, 6, 9, 10 and each topple.
- Side effects: nearly every turn is now a power turn (fair play) and a Last Stand sits-out turn (boardAltered), as the block's turns were; the Big Bounce now also drops candidates that hand him a new promotion (the boss kit caught one).
- Art: the art runner (`claude/boss-art`, out/bigboy-tower), $1.63 of an $8 cap. Test switch `?boss=bigboy&power=tower` (8 tall at once).
