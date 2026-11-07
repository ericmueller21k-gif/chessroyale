# Auto chess redesign (Eric, Nov 7; APPROVED: "go ahead and start firing it off")

Mockups: notes/briefs/assets/autochess-v4-desktop.png, autochess-v4-phone.png (generator autochess-v4-gen.py), Eric's reference
notes/briefs/assets/autochess-eric-ref.webp (follow its look: gold/black/white, line work; original art, ours). Mockup proportions are
rough; build it properly (shared components at every size, number checks).

## Final changes on top of v4 (Eric's last message)
- Phone: the two players (big piece left of name/Lv/HP/XP bars) CENTERED above the board (equal space left and right), about 5 px
  above the board. "Auto chess / Round 2" top left; the gear (settings: resign etc.) top right.
- Benches: pieces about 75% bigger than in v4 (they run further along the board's side; fine), drawn in their own side's normal piece
  look (not the green placement glow); a tiny square label under each (e.g. "g4"); empty slots faint. Ours runs up the left side from
  our corner; theirs down the right side from their corner (on computer below the opponent's block).
- Computer: the right column's fixed top slot (the town's TOWN slot, see brief-chat-column.md) shows "AUTO CHESS" with "Round 2 ·
  Planning phase" under it, centered like the town's. (If the chat-column job isn't merged yet, build on top of it once it is.)

## From v1–v4 (all kept)
- Board: our real square board, a little bigger; thin square double border (thin black, gold, thin black). The action box: one piece,
  same width as the board, same border, a bit below the board.
- Action box top band (dark, gold line work between sections and under it): gold count, "Income +N" (N green; click/tap opens a
  breakdown: base, interest, win/loss streak, round bonus, total), the gold hexagon timer with its own border, PLANNING (or the phase)
  over the time, centered; the piece odds with bigger piece icons. No green timer bars anywhere in this mode.
- Shop row: Buy XP (cost, triple chevron icon) and Reroll (cost, bigger reroll icon) stacked at left; the shop cards about square
  (same ratio on phone and computer), none highlighted.
- Computer: you sit left of the action box (piece above name, Lv, HP/XP); the opponent across, right of the board's top. The left menu
  and right column never move (today the left menu shifts on /autochess: find why and fix). Phone: as above.
- Removed for now: the old back button/title block on computer (the gear has Leave/resign).
- Tests: number checks for the column positions, board square, action box width = board width, card aspect, hexagon text centered,
  bench sizes; both projects; the existing autochess specs updated (old → new listed in the PR), guards kept.
