# The scoreboard's reorder, the final's team panel and two small gutters (Oct 15, 2026)

From the slop audit (V9, V16, V22, V26). CSS, plus the scoreboard's keys for long moves. Nothing about rules or data.

- **Rows that slide past each other no longer print over each other.** Watched frame by frame (every animation on the
  page paused as the rows start moving, then stepped 80 ms at a time): in a Crowd reveal on a computer, rows moving
  past each other mixed their text for about 400 ms ("French Fred" over "O-O-O Olga"). Their background was
  see-through, a tint at most. Now each row has the scoreboard's own color under its tint (the tints are layers on
  top), so a sliding row covers the one it passes. A row that moves more than four places (`JUMP_ROWS` in
  `RaceTower.tsx`) no longer slides through all the rows between: it is drawn anew at its new place and fades in
  (0.45 s), under the rows still sliding. A reveal can move dozens of rows at once. Checked the same way after the
  change, and in real time: no text over text, and nothing left faded 1.2 s after the reorder.
- **Names shrink to "…", never the mark beside them.** The name is a button, and the line it sat on cut it as one block,
  so a name beside a mark was cut to nothing: the final's crowned top player showed as "👑 …", and on the
  scoreboard every player who had moved this round showed as "✓ …". The name now gets the ellipsis itself, and the
  crown, ✓ and 💡 always show. The final's row also keeps a gap before the score, so "Perpetual Per3.2" reads
  "Perpetual Pe… 3.2".
- **A duel's two sides** are labeled by their color ("White", "Black"), not "Team 1 · White" for one player each.
- **The profile's emoji chips:** 10 px between them (was 6). Each ✕ overhangs its chip by 7 px with its ring, so it
  sat on the next emoji at 360 px.
- **The reveal's move bars** keep the scoreboard's 10 px side gutter on a phone. At 320 px they ran edge to edge.
