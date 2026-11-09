# Auto chess: bigger players (Nov 9, 2026)

- **Eric (Nov 9, from his phone):** the pawn avatars much bigger, about as tall as a bench tile; each player block (pawn, name, level, HP and XP) filling its bench row's height, with bigger text and taller, wider bars; the top block the same as the bottom one.
- **Round 1 (shipped, the director checked the stills and sent it back):** the pawn grew only 44 → 45 px at 390; the page kept about 150 px under the action box; the computer's top block was cramped.

## Round 2

- **Rows grow into the spare height.** `--spare` is the room left under the action box after the board, the box and the rows at their old size, less the free margin and 8 px. Each player row takes half of it (`--grow`), capped at 0.7x its old height, so a row is at most 1.7x. The board keeps its size (it is still sized by the width or the height as before); the box moves down by what the rows grow. Nothing grows at 320 x 568 or on a computer (its spare is under the margin).
- **The pawn's drawn figure is the row's usable height.** The usable height is the row less its gap and the hop's room (`--pD`). The default pawn's figure is 0.678 of its square (the piece's pawn spans y 9 to 39.5 of 45), so the square is `--pD` / 0.678, scaled into place with its feet on the row's foot and its head at the hop's room. The layout box is only as wide as the figure, so the block beside it keeps its width. The shadow sits at the feet.
- **The block fills the row.** The name at the top, the level, then the HP and XP bars at the foot (`justify-content: space-between`). The text and bars grow with `--pD`; the name is also capped by the block's width (`--iw`: 104 to 150 px), so a 12-letter name fits at every size.
- **Top matches bottom.** Both sides use the same block, pawn and sizes, and the check asserts it.
- **Calls made:**
  - The 1.7x cap and "the space under the action box is at most the free margin + 8 px" cannot both hold at 390 x 844. Half the spare at 390 would be 2.1x the old row, and at 2.1x the figure (about 135 px) and the block's name would not fit the 187 px column beside the board. I kept the cap, so 390 x 844 keeps about 64 px under the box. Raising the cap to about 2.1x (one number, `0.7` in `--grow`) closes the rest of the gap; the call is the director's.
  - At 320 x 568 the pawn's figure grows from about 35 to 44 px (it is the row's usable height there) while the rows stay put.
  - Bench tiles and the board are unchanged; the bench tiles still sit at the foot of the top row and the top of ours.
- **Checks, old → new** (`e2e/autochess.spec.ts`):
  - "the players (Nov 9)" → "the players (Nov 9, round 2)": the drawn figure at least 85% of the row's usable height (was: pawn box ≥ 80% of a bench tile); the block fills its row (≥ the row less 5 px, was ≥ 90%); the figure at least 1.5x a bench tile on a phone (new); both blocks and both pawns the same size (kept); the block's text and width fit, including its height (new); the rows at most 1.7x and never smaller, and either at the cap or the space under the box at most the free margin + 8 px (new).
  - v5 screen test: a thin bar at most 10 px → 13 px (the bars grow with the row).
