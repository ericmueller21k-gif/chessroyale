# Crowd on a computer: the status line centered and bigger; one bottom line (Nov 25, 2026)

Eric (Nov 25, a 50 v 50 at 2000 px): the move line "should be centered and probably a bit bigger"; "the board and the two boxes should all be the same lower band"; "move up the chat box a little bit ... there is some text that we don't see here".

- A computer only (1100 × 600 and up, a mouse): the status line is centered on the board's squares at 22 px (1.4 × 16) where the board is wide enough; a narrow board's is as big as its width holds (about 18 px on 1280 × 800's 504 px board), and a too-long "Move" part ends in "…", never under the gear.
- The scoreboard (left) and the chat (right) end on the board's bottom line, its frame (the clock's bar under it) included; they scroll inside. `board-foot.ts` measures the line (CSS can't: the board is the height or the column's width, whichever is less). A raid's scoreboard ends there too; its right column (moves, God King) and Squads' own screens are unchanged.
- The gap over the chat was the reveal's vote results (six bars, the result, its note: 259 px). Call: keep that place as one fixed slot (nothing shifts at the reveal) but with thinner bars, 206 px, so the chat starts 56 px higher.
- Eric (later, Nov 25): the scoreboard "literally the same height as the chessboard": its table's top on the board's squares' top too
  (`--side-pad` from board-foot.ts), its bottom on the board's line as before.
- Scope (director, Nov 25): the scoreboard's and chat's lines apply to the 50 v 50 only (Eric's screen); a Boss Battle raid keeps its
  own column as before (`board-layout.spec.ts` pins it).
